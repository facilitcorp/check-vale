import type { FastifyPluginAsync } from "fastify";
import type { z } from "zod";
import { aplicarRegras, calcularResultado, contextoDaInspecao, faltaEvidencia, OperacaoSync, SyncLote, validarAtributos, type CodigoRejeicao, type DetalheRejeicao, type Evidencia, type Inspecao, type ResultadoOp, type SyncSaida, type Veiculo } from "@checkvale/shared";
import type { Sessao } from "../app";
import type { Db } from "../db";
import { carregarAtributos, carregarInspecoes, carregarModelo } from "../mapeamento";

/** Erro permanente: a operação nunca vai passar, o app não deve reenviar. */
class Rejeicao extends Error {
  constructor(public codigo: CodigoRejeicao, mensagem: string, public detalhes: DetalheRejeicao[] = []) {
    super(mensagem);
  }
}

/** Operação como chegou: só o opId é garantido. */
type Bruta = { opId: string } & Record<string, unknown>;
type Alvo = Pick<ResultadoOp, "entidade" | "entidadeId" | "inspecaoId">;

export const rotasSync: FastifyPluginAsync = async (app) => {
  app.post("/sync", { onRequest: app.exigir("inspecao:executar") }, async (req): Promise<SyncSaida> => {
    const entrada = SyncLote.parse(req.body);
    const sessao = req.user;
    const resultados: ResultadoOp[] = [];

    // Em ordem: a fila do app é FIFO (inspeção antes das fotos dela). Cada operação é
    // validada e gravada sozinha: uma rejeitada não impede as outras do lote.
    for (const bruta of entrada.operacoes as Bruta[]) {
      const alvo = alvoDe(bruta);
      const ja = await app.db.query<{ status: string; erro: string | null; codigo: string | null; detalhes: DetalheRejeicao[] | null }>(
        `SELECT status, erro, codigo, detalhes FROM sync_ops WHERE op_id = $1`, [bruta.opId]);
      const anterior = ja.rows[0];
      if (anterior) {
        resultados.push(anterior.status === "rejeitada"
          ? { opId: bruta.opId, status: "rejeitada", erro: anterior.erro, codigo: anterior.codigo ?? "dados_invalidos", ...alvo, detalhes: anterior.detalhes ?? [] }
          : { opId: bruta.opId, status: "duplicada", erro: null });
        continue;
      }
      const tipo = typeof bruta.tipo === "string" ? bruta.tipo : "desconhecido";
      let resultado: ResultadoOp = { opId: bruta.opId, status: "aplicada", erro: null };
      try {
        const lida = OperacaoSync.safeParse(bruta);
        if (!lida.success) throw await invalida(app.db, bruta, lida.error);
        const op = lida.data;
        await app.db.transacao(async (tx) => {
          await aplicar(tx, sessao, op);
          await registrar(tx, sessao, entrada.dispositivoId, bruta.opId, tipo, null);
        }).catch((e) => {
          // Restrição ou formato que o banco recusa sempre: reenviar não muda nada, então não pode travar a fila.
          const classe = (e as { code?: string }).code?.slice(0, 2);
          if (classe === "22" || classe === "23") {
            req.log.warn({ err: e, opId: bruta.opId }, "sync: operação recusada pelo banco");
            throw new Rejeicao("recusada_pelo_banco", "O servidor não aceitou os dados deste registro.");
          }
          throw e;
        });
      } catch (e) {
        if (!(e instanceof Rejeicao)) throw e; // erro transitório: 500, o app reenvia o lote inteiro
        resultado = { opId: bruta.opId, status: "rejeitada", erro: e.message, codigo: e.codigo, ...alvo, detalhes: e.detalhes };
        await registrar(app.db, sessao, entrada.dispositivoId, bruta.opId, tipo, e);
      }
      await app.auditar(req, `sync.${tipo}`, alvo.entidade ?? "desconhecida", alvo.entidadeId ?? null, {
        status: resultado.status, erro: resultado.erro, codigo: resultado.codigo, dispositivoId: entrada.dispositivoId,
      });
      resultados.push(resultado);
    }
    return { resultados, servidorEm: new Date().toISOString() };
  });
};

const texto = (v: unknown) => (typeof v === "string" ? v : null);
const objeto = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** Do que der para ler da operação, mesmo inválida: qual registro e qual inspeção ela afeta. */
function alvoDe(op: Bruta): Alvo {
  if (op.tipo === "veiculo.salvar") return { entidade: "veiculo", entidadeId: texto(objeto(op.veiculo).id), inspecaoId: null };
  if (op.tipo === "inspecao.salvar") {
    const id = texto(objeto(op.inspecao).id);
    return { entidade: "inspecao", entidadeId: id, inspecaoId: id };
  }
  if (op.tipo === "evidencia.registrar") {
    const ev = objeto(op.evidencia);
    return { entidade: "evidencia", entidadeId: texto(ev.id), inspecaoId: texto(ev.inspecaoId) };
  }
  return { entidade: null, entidadeId: null, inspecaoId: null };
}

/**
 * Operação fora do contrato (app antigo, campo fora da regra). Aponta o item quando o erro
 * está numa resposta, com o título do item se a versão do modelo existir.
 */
async function invalida(db: Db, op: Bruta, erro: z.ZodError): Promise<Rejeicao> {
  const insp = objeto(op.inspecao);
  const respostas = Array.isArray(insp.respostas) ? insp.respostas : [];
  const detalhes: DetalheRejeicao[] = erro.issues.map((i) => {
    const r = i.path[0] === "inspecao" && i.path[1] === "respostas" && typeof i.path[2] === "number" ? objeto(respostas[i.path[2]]) : null;
    return { campo: i.path.join("."), mensagem: i.message, itemId: r ? texto(r.itemId) : null };
  });
  let titulos = new Map<string, string>();
  const modeloId = texto(insp.modeloId), versao = insp.modeloVersao;
  if (detalhes.some((d) => d.itemId) && modeloId && /^[0-9a-f-]{36}$/i.test(modeloId) && Number.isInteger(versao)) {
    const modelo = await carregarModelo(db, modeloId, versao as number);
    titulos = new Map(modelo?.categorias.flatMap((c) => c.itens.map((it) => [it.id, it.titulo] as const)) ?? []);
  }
  const primeiro = detalhes[0]!;
  const titulo = primeiro.itemId ? titulos.get(primeiro.itemId) : undefined;
  const onde = titulo ? `Item "${titulo}": ` : primeiro.itemId ? "Uma resposta: " : primeiro.campo ? `Campo ${primeiro.campo}: ` : "";
  const mais = detalhes.length > 1 ? ` (e mais ${detalhes.length - 1} problema(s))` : "";
  return new Rejeicao("dados_invalidos", `${onde}${primeiro.mensagem}${mais}`, detalhes);
}

async function registrar(db: Db, s: Sessao, dispositivoId: string, opId: string, tipo: string, rejeicao: Rejeicao | null) {
  await db.query(`INSERT INTO sync_ops (op_id, usuario_id, dispositivo_id, tipo, status, erro, codigo, detalhes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [
    opId, s.sub, dispositivoId, tipo, rejeicao ? "rejeitada" : "aplicada", rejeicao?.message ?? null, rejeicao?.codigo ?? null,
    rejeicao ? JSON.stringify(rejeicao.detalhes) : null,
  ]);
}

async function aplicar(tx: Db, s: Sessao, op: OperacaoSync) {
  switch (op.tipo) {
    case "veiculo.salvar":
      return salvarVeiculo(tx, s, op.veiculo);
    case "inspecao.salvar":
      return salvarInspecao(tx, s, op.inspecao);
    case "evidencia.registrar":
      return registrarEvidencia(tx, s, op.evidencia);
  }
}

async function salvarVeiculo(tx: Db, s: Sessao, v: Veiculo) {
  const tipo = await tx.query(`SELECT 1 FROM tipos_veiculo WHERE id = $1`, [v.tipoVeiculoId]);
  if (!tipo.rows[0]) throw new Rejeicao("referencia_inexistente", "Tipo de veículo inexistente.");
  const errosAtrib = validarAtributos(await carregarAtributos(tx), v.tipoVeiculoId, v.atributos);
  if (errosAtrib.length) throw new Rejeicao("atributos_invalidos", errosAtrib.join(" "), errosAtrib.map((m) => ({ campo: "veiculo.atributos", mensagem: m, itemId: null })));
  if (v.placa) {
    const dup = await tx.query(`SELECT id FROM veiculos WHERE upper(placa) = upper($1) AND id <> $2`, [v.placa, v.id]);
    if (dup.rows[0]) throw new Rejeicao("placa_duplicada", `Placa ${v.placa} já cadastrada.`, [{ campo: "veiculo.placa", mensagem: "Placa já cadastrada.", itemId: null }]);
  }
  // Última alteração vence (por atualizadoEm do aparelho). `demo` nunca vem do app.
  await tx.query(
    `INSERT INTO veiculos (id, placa, codigo, tipo_veiculo_id, descricao, fabricante, modelo, empresa, unidade_id, status, atributos, criado_por, criado_em, atualizado_em)
     VALUES ($1, upper($2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (id) DO UPDATE SET placa = EXCLUDED.placa, codigo = EXCLUDED.codigo, tipo_veiculo_id = EXCLUDED.tipo_veiculo_id,
       descricao = EXCLUDED.descricao, fabricante = EXCLUDED.fabricante, modelo = EXCLUDED.modelo, empresa = EXCLUDED.empresa,
       unidade_id = EXCLUDED.unidade_id, status = EXCLUDED.status, atributos = EXCLUDED.atributos,
       atualizado_em = EXCLUDED.atualizado_em, servidor_em = now()
     WHERE veiculos.atualizado_em <= EXCLUDED.atualizado_em`,
    [v.id, v.placa, v.codigo, v.tipoVeiculoId, v.descricao, v.fabricante, v.modelo, v.empresa, v.unidadeId, v.status, JSON.stringify(v.atributos), s.sub, v.criadoEm, v.atualizadoEm],
  );
}

async function salvarInspecao(tx: Db, s: Sessao, i: Inspecao) {
  if (i.inspetorId !== s.sub) throw new Rejeicao("outro_inspetor", "Inspeção pertence a outro inspetor.");
  const modelo = await carregarModelo(tx, i.modeloId, i.modeloVersao);
  if (!modelo) throw new Rejeicao("modelo_indisponivel", "Modelo de checklist inexistente.");
  const st = await tx.query<{ status: string }>(`SELECT status FROM modelos_checklist WHERE id = $1 AND versao = $2`, [i.modeloId, i.modeloVersao]);
  if (st.rows[0]?.status === "rascunho") throw new Rejeicao("modelo_indisponivel", "Versão de checklist ainda não publicada.");
  const itens = new Set(modelo.categorias.flatMap((c) => c.itens.map((it) => it.id)));
  const fora = i.respostas.find((r) => !itens.has(r.itemId));
  if (fora) throw new Rejeicao("item_fora_do_modelo", `Item ${fora.itemId} não pertence ao modelo.`, [{ campo: "inspecao.respostas", mensagem: "Item não pertence ao modelo.", itemId: fora.itemId }]);

  const atual = await tx.query<{ inspetor_id: string; status: string }>(`SELECT inspetor_id, status FROM inspecoes WHERE id = $1 FOR UPDATE`, [i.id]);
  if (atual.rows[0] && atual.rows[0].inspetor_id !== s.sub) throw new Rejeicao("outro_inspetor", "Inspeção pertence a outro inspetor.");
  const jaFinal = atual.rows[0] && atual.rows[0].status !== "em_andamento";

  // Evidência pedida pelo item (foto/observação) é cobrada ao concluir; em andamento o app ainda está preenchendo.
  if (!jaFinal && i.status === "concluida") {
    const respostas = new Map(i.respostas.map((r) => [r.itemId, r]));
    // Todos os itens de uma vez: o inspetor corrige tudo numa volta só.
    const faltas: DetalheRejeicao[] = [];
    const titulos: string[] = [];
    for (const it of aplicarRegras(modelo, contextoDaInspecao(i)).categorias.flatMap((c) => c.itens)) {
      const r = respostas.get(it.id);
      const falta = r && faltaEvidencia(it, r);
      if (falta) { faltas.push({ campo: "evidencia", mensagem: falta, itemId: it.id }); titulos.push(it.titulo); }
    }
    if (faltas.length) {
      const mais = faltas.length > 1 ? ` (e mais ${faltas.length - 1} item(ns))` : "";
      throw new Rejeicao("evidencia_faltando", `Item "${titulos[0]}": ${faltas[0]!.mensagem}${mais}`, faltas);
    }
  }

  if (!jaFinal) {
    await tx.query(
      `INSERT INTO inspecoes (id, modelo_id, modelo_versao, unidade_id, area_id, atividade_id, veiculo_id, inspetor_id, status, iniciada_em, concluida_em, atributos_veiculo, tipo_veiculo_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, concluida_em = EXCLUDED.concluida_em, servidor_em = now()`,
      [i.id, i.modeloId, i.modeloVersao, i.unidadeId, i.areaId, i.atividadeId, i.veiculoId, i.inspetorId, i.status, i.iniciadaEm, i.concluidaEm, JSON.stringify(i.atributosVeiculo), i.tipoVeiculoId],
    ).catch((e: { code?: string }) => {
      if (e.code === "23503") throw new Rejeicao("referencia_inexistente", "Unidade, área, atividade ou veículo inexistente. Sincronize o veículo antes.");
      throw e;
    });
    // Merge por item: só sobrescreve se a resposta recebida for mais nova.
    for (const r of i.respostas) {
      await tx.query(
        `INSERT INTO respostas (inspecao_id, item_id, status, observacao, nc_descricao, nc_criticidade, evidencia_ids, respondida_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (inspecao_id, item_id) DO UPDATE SET status = EXCLUDED.status, observacao = EXCLUDED.observacao,
           nc_descricao = EXCLUDED.nc_descricao, nc_criticidade = EXCLUDED.nc_criticidade,
           evidencia_ids = EXCLUDED.evidencia_ids, respondida_em = EXCLUDED.respondida_em
         WHERE respostas.respondida_em <= EXCLUDED.respondida_em`,
        [i.id, r.itemId, r.status, r.observacao, r.naoConformidade?.descricao ?? null, r.naoConformidade?.criticidade ?? null, r.evidenciaIds, r.respondidaEm],
      );
    }
  }

  // Resultado gravado no servidor, com as MESMAS funções do app (regras + cálculo).
  const [salva] = await carregarInspecoes(tx, "id = $1", [i.id]);
  const res = calcularResultado(aplicarRegras(modelo, contextoDaInspecao(salva!)), salva!.respostas);
  await tx.query(`UPDATE inspecoes SET indice = $2, situacao = $3 WHERE id = $1`, [i.id, res.indice, res.situacao]);
}

async function registrarEvidencia(tx: Db, s: Sessao, e: Evidencia) {
  const insp = await tx.query<{ inspetor_id: string }>(`SELECT inspetor_id FROM inspecoes WHERE id = $1`, [e.inspecaoId]);
  if (!insp.rows[0]) throw new Rejeicao("referencia_inexistente", "Inspeção da evidência não encontrada.");
  if (insp.rows[0].inspetor_id !== s.sub) throw new Rejeicao("outro_inspetor", "Inspeção pertence a outro inspetor.");
  await tx.query(
    `INSERT INTO evidencias (id, inspecao_id, item_id, mime, bytes, capturada_em, registrada_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
    [e.id, e.inspecaoId, e.itemId, e.mime, e.bytes, e.capturadaEm, s.sub],
  );
}
