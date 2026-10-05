import type { FastifyPluginAsync } from "fastify";
import { calcularResultado, SyncEntrada, type Evidencia, type Inspecao, type OperacaoSync, type ResultadoOp, type SyncSaida, type Veiculo } from "@checkvale/shared";
import type { Sessao } from "../app";
import type { Db } from "../db";
import { carregarInspecoes, carregarModelo } from "../mapeamento";

/** Erro permanente: a operação nunca vai passar, o app não deve reenviar. */
class Rejeicao extends Error {}

export const rotasSync: FastifyPluginAsync = async (app) => {
  app.post("/sync", async (req): Promise<SyncSaida> => {
    const entrada = SyncEntrada.parse(req.body);
    const sessao = req.user;
    const resultados: ResultadoOp[] = [];

    // Em ordem: a fila do app é FIFO (inspeção antes das fotos dela).
    for (const op of entrada.operacoes) {
      const ja = await app.db.query<{ status: string; erro: string | null }>(`SELECT status, erro FROM sync_ops WHERE op_id = $1`, [op.opId]);
      if (ja.rows[0]) {
        resultados.push({ opId: op.opId, status: ja.rows[0].status === "rejeitada" ? "rejeitada" : "duplicada", erro: ja.rows[0].erro });
        continue;
      }
      let status: ResultadoOp["status"] = "aplicada";
      let erro: string | null = null;
      try {
        await app.db.transacao(async (tx) => {
          await aplicar(tx, sessao, op);
          await registrar(tx, sessao, entrada.dispositivoId, op, "aplicada", null);
        });
      } catch (e) {
        if (!(e instanceof Rejeicao)) throw e; // erro transitório: 500, o app reenvia o lote inteiro
        status = "rejeitada";
        erro = e.message;
        await registrar(app.db, sessao, entrada.dispositivoId, op, status, erro);
      }
      await app.auditar(req, `sync.${op.tipo}`, entidadeDe(op), idDe(op), { status, erro, dispositivoId: entrada.dispositivoId });
      resultados.push({ opId: op.opId, status, erro });
    }
    return { resultados, servidorEm: new Date().toISOString() };
  });
};

const entidadeDe = (op: OperacaoSync) => op.tipo.split(".")[0]!;
const idDe = (op: OperacaoSync) =>
  op.tipo === "veiculo.salvar" ? op.veiculo.id : op.tipo === "inspecao.salvar" ? op.inspecao.id : op.evidencia.id;

async function registrar(db: Db, s: Sessao, dispositivoId: string, op: OperacaoSync, status: string, erro: string | null) {
  await db.query(`INSERT INTO sync_ops (op_id, usuario_id, dispositivo_id, tipo, status, erro) VALUES ($1,$2,$3,$4,$5,$6)`, [
    op.opId, s.sub, dispositivoId, op.tipo, status, erro,
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
  if (!tipo.rows[0]) throw new Rejeicao("Tipo de veículo inexistente.");
  if (v.placa) {
    const dup = await tx.query(`SELECT id FROM veiculos WHERE upper(placa) = upper($1) AND id <> $2`, [v.placa, v.id]);
    if (dup.rows[0]) throw new Rejeicao(`Placa ${v.placa} já cadastrada.`);
  }
  // Última alteração vence (por atualizadoEm do aparelho).
  await tx.query(
    `INSERT INTO veiculos (id, placa, codigo, tipo_veiculo_id, descricao, marca_modelo, unidade_id, criado_por, criado_em, atualizado_em)
     VALUES ($1, upper($2), $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET placa = EXCLUDED.placa, codigo = EXCLUDED.codigo, tipo_veiculo_id = EXCLUDED.tipo_veiculo_id,
       descricao = EXCLUDED.descricao, marca_modelo = EXCLUDED.marca_modelo, unidade_id = EXCLUDED.unidade_id,
       atualizado_em = EXCLUDED.atualizado_em, servidor_em = now()
     WHERE veiculos.atualizado_em <= EXCLUDED.atualizado_em`,
    [v.id, v.placa, v.codigo, v.tipoVeiculoId, v.descricao, v.marcaModelo, v.unidadeId, s.sub, v.criadoEm, v.atualizadoEm],
  );
}

async function salvarInspecao(tx: Db, s: Sessao, i: Inspecao) {
  if (i.inspetorId !== s.sub) throw new Rejeicao("Inspeção pertence a outro inspetor.");
  const modelo = await carregarModelo(tx, i.modeloId, i.modeloVersao);
  if (!modelo) throw new Rejeicao("Modelo de checklist inexistente.");
  const itens = new Set(modelo.categorias.flatMap((c) => c.itens.map((it) => it.id)));
  const fora = i.respostas.find((r) => !itens.has(r.itemId));
  if (fora) throw new Rejeicao(`Item ${fora.itemId} não pertence ao modelo.`);

  const atual = await tx.query<{ inspetor_id: string; status: string }>(`SELECT inspetor_id, status FROM inspecoes WHERE id = $1 FOR UPDATE`, [i.id]);
  if (atual.rows[0] && atual.rows[0].inspetor_id !== s.sub) throw new Rejeicao("Inspeção pertence a outro inspetor.");
  const jaFinal = atual.rows[0] && atual.rows[0].status !== "em_andamento";

  if (!jaFinal) {
    await tx.query(
      `INSERT INTO inspecoes (id, modelo_id, modelo_versao, unidade_id, area_id, atividade_id, veiculo_id, inspetor_id, status, iniciada_em, concluida_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, concluida_em = EXCLUDED.concluida_em, servidor_em = now()`,
      [i.id, i.modeloId, i.modeloVersao, i.unidadeId, i.areaId, i.atividadeId, i.veiculoId, i.inspetorId, i.status, i.iniciadaEm, i.concluidaEm],
    ).catch((e: { code?: string }) => {
      if (e.code === "23503") throw new Rejeicao("Unidade, área, atividade ou veículo inexistente. Sincronize o veículo antes.");
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

  // Resultado gravado no servidor, calculado com a MESMA função do app.
  const [salva] = await carregarInspecoes(tx, "id = $1", [i.id]);
  const res = calcularResultado(modelo, salva!.respostas);
  await tx.query(`UPDATE inspecoes SET indice = $2, situacao = $3 WHERE id = $1`, [i.id, res.indice, res.situacao]);
}

async function registrarEvidencia(tx: Db, s: Sessao, e: Evidencia) {
  const insp = await tx.query<{ inspetor_id: string }>(`SELECT inspetor_id FROM inspecoes WHERE id = $1`, [e.inspecaoId]);
  if (!insp.rows[0]) throw new Rejeicao("Inspeção da evidência não encontrada.");
  if (insp.rows[0].inspetor_id !== s.sub) throw new Rejeicao("Inspeção pertence a outro inspetor.");
  await tx.query(
    `INSERT INTO evidencias (id, inspecao_id, item_id, mime, bytes, capturada_em, registrada_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
    [e.id, e.inspecaoId, e.itemId, e.mime, e.bytes, e.capturadaEm, s.sub],
  );
}
