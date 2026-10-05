import type { Catalogo, Inspecao, SyncSaida, Veiculo } from "@checkvale/shared";
import { chamarApi, ErroDaApi, ErroRede } from "../lib/api";
import { banco, chaveModelo, gravarMeta, idDispositivo, lerMeta } from "./banco";
import { aoEnfileirar, contarPendentes } from "./fila";

/**
 * Motor de sincronização. Ordem de cada rodada:
 *  1. envia a fila (FIFO) em lotes para /sync;
 *  2. sobe os binários das fotos já registradas;
 *  3. baixa catálogo (ETag) e veículos/inspeções alterados desde o último cursor.
 * Sem rede, para no primeiro passo e tenta na próxima rodada.
 */

export interface EstadoSync {
  online: boolean;
  sincronizando: boolean;
  pendentes: number;
  rejeitadas: number;
  ultimaEm: string | null;
  erro: string | null;
}

let estado: EstadoSync = { online: navigator.onLine, sincronizando: false, pendentes: 0, rejeitadas: 0, ultimaEm: null, erro: null };
const ouvintes = new Set<(e: EstadoSync) => void>();

function publicar(parcial: Partial<EstadoSync>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((fn) => fn(estado));
}

export function observarSync(fn: (e: EstadoSync) => void): () => void {
  ouvintes.add(fn);
  fn(estado);
  return () => ouvintes.delete(fn);
}

const LOTE = 50;

async function enviarFila(): Promise<void> {
  const dispositivoId = await idDispositivo();
  // Nesta aba só há um envio por vez (sincronizar), então uma linha "enviando" aqui é órfã:
  // o envio dela morreu com a página (app fechado, recarga). Volta para a fila com o MESMO
  // opId; se outra aba ainda a estiver enviando, o servidor responde "duplicada".
  await banco.fila.where("estado").equals("enviando").modify({ estado: "pendente" });
  for (;;) {
    // Ler e marcar "enviando" na MESMA transação: enfileirar() não consegue trocar o
    // conteúdo de uma linha entre o momento em que ela é lida e o momento em que sobe.
    const lote = await banco.transaction("rw", banco.fila, async () => {
      const l = (await banco.fila.where("estado").equals("pendente").sortBy("seq")).slice(0, LOTE);
      await banco.fila.where("seq").anyOf(l.map((o) => o.seq!)).modify({ estado: "enviando" });
      return l;
    });
    if (lote.length === 0) return;
    const seqs = lote.map((o) => o.seq!);
    let saida: SyncSaida;
    try {
      saida = await chamarApi<SyncSaida>("/sync", { method: "POST", body: JSON.stringify({ dispositivoId, operacoes: lote.map((o) => o.op) }) });
    } catch (e) {
      // Volta para pendente com o MESMO opId: reenviar é seguro (idempotente no servidor).
      await banco.fila.where("seq").anyOf(seqs).and((o) => o.estado === "enviando").modify({ estado: "pendente" });
      throw e;
    }
    const porOp = new Map(saida.resultados.map((r) => [r.opId, r]));
    await banco.transaction("rw", banco.fila, async () => {
      for (const o of lote) {
        // A confirmação só vale para a operação que foi enviada. Se a linha agora guarda
        // outra (opId diferente), ela é mais nova: fica na fila para o próximo envio.
        const atual = await banco.fila.get(o.seq!);
        if (!atual || atual.op.opId !== o.op.opId) {
          if (atual?.estado === "enviando") await banco.fila.update(o.seq!, { estado: "pendente" });
          continue;
        }
        const r = porOp.get(o.op.opId);
        if (!r) await banco.fila.update(o.seq!, { estado: "pendente" });
        else if (r.status === "rejeitada") await banco.fila.update(o.seq!, { estado: "rejeitada", erro: r.erro });
        else await banco.fila.delete(o.seq!);
      }
    });
  }
}

async function enviarFotos(): Promise<void> {
  // Só depois que os metadados chegaram (a op evidencia.registrar saiu da fila).
  const pendentesNaFila = new Set(
    (await banco.fila.toArray()).filter((o) => o.op.tipo === "evidencia.registrar").map((o) => (o.op as { evidencia: { id: string } }).evidencia.id),
  );
  const fotos = await banco.evidencias.filter((e) => !e.enviada && !pendentesNaFila.has(e.id)).toArray();
  for (const f of fotos) {
    try {
      const { url } = await chamarApi<{ url: string }>(`/evidencias/${f.id}/arquivo`, { method: "PUT", body: f.arquivo, headers: { "Content-Type": f.mime } });
      await banco.evidencias.update(f.id, { enviada: true, url });
    } catch (e) {
      if (e instanceof ErroDaApi && e.status === 404) continue; // metadados ainda não aplicados: próxima rodada
      throw e;
    }
  }
}

async function baixar(): Promise<void> {
  const local = await banco.catalogo.get("atual");
  const cat = await chamarApi<Catalogo | undefined>("/catalogo", {
    headers: local ? { "If-None-Match": `"${local.catalogo.versao}"` } : {},
  });
  if (cat) {
    await banco.catalogo.put({ chave: "atual", catalogo: cat });
    await banco.modelos.bulkPut(cat.modelos.map((m) => ({ ...m, chave: chaveModelo(m.id, m.versao) })));
  }

  const desdeV = await lerMeta("cursor:veiculos");
  const v = await chamarApi<{ veiculos: Veiculo[]; servidorEm: string }>(`/veiculos${desdeV ? `?desde=${encodeURIComponent(desdeV)}` : ""}`);
  // Não sobrescreve veículo com alteração local ainda na fila.
  const naFila = new Set((await banco.fila.where("estado").anyOf("pendente", "enviando").toArray()).map((o) => o.alvo));
  await banco.veiculos.bulkPut(v.veiculos.filter((x) => !naFila.has(`veiculo:${x.id}`)));
  await gravarMeta("cursor:veiculos", v.servidorEm);

  const desdeI = await lerMeta("cursor:inspecoes");
  const i = await chamarApi<{ inspecoes: Inspecao[]; servidorEm: string }>(`/inspecoes${desdeI ? `?desde=${encodeURIComponent(desdeI)}` : ""}`);
  await banco.inspecoes.bulkPut(i.inspecoes.filter((x) => !naFila.has(`inspecao:${x.id}`)));
  await gravarMeta("cursor:inspecoes", i.servidorEm);
}

let rodando: Promise<void> | null = null;
let deNovo = false;

/** Roda uma sincronização completa. Chamadas concorrentes viram no máximo mais uma rodada. */
export function sincronizar(): Promise<void> {
  if (rodando) {
    deNovo = true;
    return rodando;
  }
  rodando = (async () => {
    publicar({ sincronizando: true, erro: null });
    try {
      do {
        deNovo = false;
        await enviarFila();
        await enviarFotos();
        await baixar();
      } while (deNovo);
      publicar({ online: true, ultimaEm: new Date().toISOString() });
    } catch (e) {
      if (e instanceof ErroRede) publicar({ online: false });
      else publicar({ erro: e instanceof Error ? e.message : String(e) });
    } finally {
      const rejeitadas = await banco.fila.where("estado").equals("rejeitada").count();
      publicar({ sincronizando: false, pendentes: await contarPendentes(), rejeitadas });
      rodando = null;
    }
  })();
  return rodando;
}

let iniciado = false;
/** Liga o motor: ao voltar a rede, a cada 30 s e logo após cada gravação local. */
export function iniciarSincronizacao(): () => void {
  if (iniciado) return () => {};
  iniciado = true;
  let espera: ReturnType<typeof setTimeout> | undefined;
  const logo = () => {
    clearTimeout(espera);
    espera = setTimeout(() => void sincronizar(), 800);
    void contarPendentes().then((pendentes) => publicar({ pendentes }));
  };
  const online = () => {
    publicar({ online: true });
    void sincronizar();
  };
  const offline = () => publicar({ online: false });
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  const parar = aoEnfileirar(logo);
  const intervalo = setInterval(() => void sincronizar(), 30_000);
  void sincronizar();
  return () => {
    iniciado = false;
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
    parar();
    clearInterval(intervalo);
    clearTimeout(espera);
  };
}
