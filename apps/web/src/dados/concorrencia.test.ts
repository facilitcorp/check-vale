import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Inspecao, OperacaoSync, SyncEntrada } from "@checkvale/shared";
import { banco } from "./banco";
import { repositorioInspecao } from "./repositorio";
import { sincronizar } from "./sincronizacao";

/**
 * Concorrência fila × sincronização (cenário levantado pelo @dev-2):
 * a alteração B feita enquanto A está subindo NUNCA pode sumir da fila
 * quando o servidor confirmar A.
 */
const uid = () => crypto.randomUUID();
const ctx = { modeloId: uid(), modeloVersao: 1, unidadeId: uid(), areaId: uid(), atividadeId: uid(), veiculoId: uid(), inspetorId: uid(), tipoVeiculoId: uid(), atributosVeiculo: {} };
const resposta = (itemId: string) => ({ itemId, status: "conforme" as const, observacao: null, naoConformidade: null, evidenciaIds: [] });
const json = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
const vazio = (url: string) =>
  url.startsWith("/api/catalogo") ? json({ versao: "1", unidades: [], areas: [], atividades: [], tiposVeiculo: [], atributos: [], modelos: [] })
  : url.startsWith("/api/veiculos") ? json({ veiculos: [], servidorEm: new Date().toISOString() })
  : json({ inspecoes: [], servidorEm: new Date().toISOString() });

/** Servidor que segura a 1ª chamada de /sync até liberarmos (simula rede lenta). */
function servidorLento() {
  const lotes: OperacaoSync[][] = [];
  let liberar!: () => void;
  const segurando = new Promise<void>((ok) => (liberar = ok));
  let chegou!: () => void;
  const primeiraChegou = new Promise<void>((ok) => (chegou = ok));
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url !== "/api/sync") return vazio(url);
    const e = JSON.parse(init!.body as string) as SyncEntrada;
    lotes.push(e.operacoes);
    if (lotes.length === 1) {
      chegou();
      await segurando;
    }
    return json({ resultados: e.operacoes.map((o) => ({ opId: o.opId, status: "aplicada", erro: null })), servidorEm: new Date().toISOString() });
  }));
  return { lotes, liberar, primeiraChegou };
}

const respostasDe = (op: OperacaoSync) => (op as { inspecao: Inspecao }).inspecao.respostas.map((r) => r.itemId);

beforeEach(async () => {
  await Promise.all(banco.tables.map((t) => t.clear()));
});

describe("concorrência fila × sincronização", () => {
  it("B gravada durante o envio de A sobrevive à confirmação de A e é enviada depois", async () => {
    const srv = servidorLento();
    const i = await repositorioInspecao.criar(ctx);
    const itemA = uid(), itemB = uid();
    await repositorioInspecao.salvarResposta(i.id, resposta(itemA)); // alteração A na fila

    const envio = sincronizar(); // A começa a subir
    await srv.primeiraChegou;
    expect((await banco.fila.toArray()).map((o) => o.estado)).toEqual(["enviando"]);

    await repositorioInspecao.salvarResposta(i.id, resposta(itemB)); // B enquanto A está no ar
    const durante = await banco.fila.toArray();
    expect(durante.map((o) => o.estado).sort()).toEqual(["enviando", "pendente"]);

    srv.liberar(); // servidor confirma A
    await envio;

    expect(srv.lotes).toHaveLength(2);
    expect(respostasDe(srv.lotes[0]![0]!)).toEqual([itemA]);
    expect(respostasDe(srv.lotes[1]![0]!).sort()).toEqual([itemA, itemB].sort());
    expect(await banco.fila.count()).toBe(0);
  });

  it("confirmação de um opId antigo não apaga a operação que foi substituída na mesma linha da fila", async () => {
    const srv = servidorLento();
    const i = await repositorioInspecao.criar(ctx);
    const envio = sincronizar();
    await srv.primeiraChegou;
    // Simula a corrida: a linha enviada (opId X) tem o conteúdo trocado (opId Y) antes da confirmação.
    const [linha] = await banco.fila.toArray();
    const novo = { ...linha!.op, opId: uid(), inspecao: { ...(linha!.op as { inspecao: Inspecao }).inspecao, respostas: [{ ...resposta(uid()), respondidaEm: new Date().toISOString() }] } } as OperacaoSync;
    await banco.fila.update(linha!.seq!, { op: novo, estado: "pendente" });
    srv.liberar();
    await envio;
    // Y não pode ter sido apagada por causa da confirmação de X: ou foi enviada, ou ainda está na fila.
    const enviadosY = srv.lotes.flat().some((o) => o.opId === novo.opId);
    const naFila = (await banco.fila.toArray()).some((o) => o.op.opId === novo.opId);
    expect(enviadosY || naFila).toBe(true);
    expect(i.id).toBeTruthy();
  });
});

describe("fila presa em 'enviando' (aceite do MVP, parte 3)", () => {
  it("linha que ficou 'enviando' quando o app fechou no meio do envio sobe na próxima sincronização", async () => {
    const srv = servidorLento();
    srv.liberar();
    const i = await repositorioInspecao.criar(ctx);
    await repositorioInspecao.salvarResposta(i.id, resposta(uid()));
    // A página morreu com o envio no ar: a linha ficou marcada e ninguém a devolveu.
    await banco.fila.toCollection().modify({ estado: "enviando" });

    await sincronizar();

    expect(srv.lotes.flat().filter((o) => o.tipo === "inspecao.salvar")).toHaveLength(1);
    expect(await banco.fila.count()).toBe(0);
  });

  it("envio que não responde é abortado: a rodada termina e a operação volta para a fila", async () => {
    // Prazo curto no teste; no app é TEMPO_LIMITE_MS.
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const c = new AbortController();
      setTimeout(() => c.abort(new DOMException("prazo", "TimeoutError")), 20);
      return c.signal;
    });
    let travar = true;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url !== "/api/sync") return vazio(url);
      if (travar)
        return new Promise<Response>((_, falha) => {
          if (!init?.signal) return; // sem prazo: pendura para sempre
          init.signal.addEventListener("abort", () => falha(init.signal!.reason));
        });
      const e = JSON.parse(init!.body as string) as SyncEntrada;
      return json({ resultados: e.operacoes.map((o) => ({ opId: o.opId, status: "aplicada", erro: null })), servidorEm: new Date().toISOString() });
    }));
    const i = await repositorioInspecao.criar(ctx);
    await repositorioInspecao.salvarResposta(i.id, resposta(uid()));

    const rodada = await Promise.race([sincronizar().then(() => "terminou"), new Promise((ok) => setTimeout(() => ok("pendurada"), 1000))]);
    expect(rodada).toBe("terminou");
    expect((await banco.fila.toArray()).map((o) => o.estado)).toEqual(["pendente"]);

    travar = false;
    await sincronizar();
    expect(await banco.fila.count()).toBe(0);
    vi.restoreAllMocks();
  });
});
