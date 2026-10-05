/**
 * Aceite do MVP — Parte 2 (Inspetor + offline): verificação do lado do servidor.
 * Lê o banco DEPOIS do fluxo visual e confere respostas, fotos, fila de sync,
 * auditoria e resultado, recalculado com as mesmas funções do app.
 *
 * PGlite aceita um processo só: pare a API antes de rodar.
 *   DATA_DIR=... UPLOADS_DIR=... npx tsx qa/verifica-inspecao.mts
 * (ou DATABASE_URL=postgres://... para Postgres)
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { aplicarRegras, calcularResultado, contextoDaInspecao } from "@checkvale/shared";
import { abrirDb } from "../apps/api/src/db";
import { carregarInspecoes, carregarModelo } from "../apps/api/src/mapeamento";

const db = await abrirDb({ databaseUrl: process.env.DATABASE_URL || null, dataDir: process.env.DATA_DIR || null });
const uploads = path.resolve(process.env.UPLOADS_DIR ?? "./uploads");
const LIMITE_FOTO = 400 * 1024; // compressão do app mira ~300 KB
const res: { passo: string; r: "PASSOU" | "FALHOU"; ev: string }[] = [];
const ok = (passo: string, cond: boolean, ev = "") => res.push({ passo, r: cond ? "PASSOU" : "FALHOU", ev });

const inspecoes = await carregarInspecoes(db, "true", []);
ok("há inspeção sincronizada", inspecoes.length > 0, `${inspecoes.length}`);

for (const i of inspecoes) {
  const tag = `[${i.id.slice(0, 8)}]`;
  const veic = (await db.query<{ placa: string | null; codigo: string | null }>(`SELECT placa, codigo FROM veiculos WHERE id = $1`, [i.veiculoId])).rows[0];
  const versao = (await db.query<{ status: string }>(`SELECT status FROM modelos_checklist WHERE id = $1 AND versao = $2`, [i.modeloId, i.modeloVersao])).rows[0];
  const modelo = await carregarModelo(db, i.modeloId, i.modeloVersao);
  ok(`${tag} veículo e versão`, !!veic && !!modelo && versao?.status !== "rascunho", `${veic?.placa ?? veic?.codigo} · ${modelo?.nome} v${i.modeloVersao} (${versao?.status}) · ${i.status}`);
  if (!modelo) continue;

  // Item fora da regra: o retrato do veículo gravado na inspeção decide.
  const recortado = aplicarRegras(modelo, contextoDaInspecao(i));
  const aplicaveis = new Set(recortado.categorias.flatMap((c) => c.itens.map((it) => it.id)));
  const titulo = new Map(modelo.categorias.flatMap((c) => c.itens.map((it) => [it.id, it.titulo] as const)));
  const foraDaRegra = i.respostas.filter((r) => !aplicaveis.has(r.itemId));
  ok(`${tag} nenhuma resposta em item fora da regra`, foraDaRegra.length === 0, `aplicáveis=${aplicaveis.size}; fora: ${foraDaRegra.map((r) => titulo.get(r.itemId)).join(", ") || "nenhuma"}`);

  const r = calcularResultado(recortado, i.respostas);
  const gravado = (await db.query<{ indice: number | null; situacao: string | null }>(`SELECT indice, situacao FROM inspecoes WHERE id = $1`, [i.id])).rows[0];
  ok(`${tag} resultado do servidor = recálculo`, gravado?.indice === r.indice, `índice ${gravado?.indice} vs ${r.indice}; ${r.respondidos}/${r.total}; conformes ${r.conformes} (atenção ${r.pontosAtencao}), NC ${r.naoConformes}, N/A ${r.naoAplica}`);
  if (i.status === "concluida") ok(`${tag} concluída com tudo respondido`, r.respondidos === r.total, `${r.respondidos}/${r.total}`);

  for (const resp of i.respostas) {
    const nome = titulo.get(resp.itemId);
    if (resp.status === "nao_conforme") {
      ok(`${tag} NC "${nome}" tem descrição, criticidade e foto`, !!resp.naoConformidade?.descricao && !!resp.naoConformidade?.criticidade && resp.evidenciaIds.length > 0,
        `${resp.naoConformidade?.criticidade} · ${resp.evidenciaIds.length} foto(s)`);
      ok(`${tag} NC "${nome}" no plano de ação`, r.planoAcao.some((p) => p.itemId === resp.itemId), "");
    }
    for (const evId of resp.evidenciaIds) {
      const ev = (await db.query<{ item_id: string; inspecao_id: string; bytes: number; mime: string; arquivo_chave: string | null }>(`SELECT * FROM evidencias WHERE id = $1`, [evId])).rows[0];
      const arq = ev?.arquivo_chave ? path.join(uploads, ev.arquivo_chave) : null;
      const tam = arq && existsSync(arq) ? statSync(arq).size : null;
      ok(`${tag} foto ${evId.slice(0, 8)} de "${nome}"`, !!ev && ev.item_id === resp.itemId && ev.inspecao_id === i.id && tam !== null && tam <= LIMITE_FOTO && ev.mime === "image/jpeg",
        ev ? `${ev.mime} · ${tam === null ? "ARQUIVO AUSENTE" : `${(tam / 1024).toFixed(0)} KB`} · item ${ev.item_id === resp.itemId ? "certo" : "ERRADO"}` : "evidência não registrada");
    }
  }
}

// Fotos soltas (desvinculadas ou de rascunho que não foi salvo): não é erro, só informação.
const soltas = (await db.query<{ n: number }>(
  `SELECT count(*)::int n FROM evidencias e WHERE NOT EXISTS (SELECT 1 FROM respostas r WHERE r.inspecao_id = e.inspecao_id AND e.id = ANY(r.evidencia_ids))`)).rows[0]!.n;
const semArquivo = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM evidencias WHERE arquivo_chave IS NULL`)).rows[0]!.n;
ok("todas as fotos registradas têm arquivo", semArquivo === 0, `sem arquivo: ${semArquivo}; soltas (sem vínculo): ${soltas}`);

const fila = (await db.query<{ tipo: string; status: string; n: number }>(`SELECT tipo, status, count(*)::int n FROM sync_ops GROUP BY 1,2 ORDER BY 1,2`)).rows;
ok("fila: nenhuma operação rejeitada", !fila.some((f) => f.status === "rejeitada"), fila.map((f) => `${f.tipo}/${f.status}=${f.n}`).join(" "));
const aud = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM auditoria WHERE acao LIKE 'sync.%'`)).rows[0]!.n;
const ops = fila.reduce((n, f) => n + f.n, 0);
ok("cada operação aplicada uma vez (auditoria = sync_ops)", aud === ops, `auditoria sync.*=${aud} · sync_ops=${ops}`);
const dispositivos = (await db.query<{ n: number }>(`SELECT count(DISTINCT dispositivo_id)::int n FROM sync_ops`)).rows[0]!.n;
const acoes = (await db.query<{ acao: string; n: number }>(`SELECT acao, count(*)::int n FROM auditoria WHERE acao NOT LIKE 'admin.%' GROUP BY 1 ORDER BY 1`)).rows;
console.log(JSON.stringify({ res, auditoria: Object.fromEntries(acoes.map((a) => [a.acao, a.n])), dispositivos }, null, 1));
await db.fechar();
