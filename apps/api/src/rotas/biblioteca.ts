import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  AdotarModelo,
  copiarCategorias,
  especificidade,
  Id,
  ModeloBibliotecaEntrada,
  SEM_RESTRICAO,
  validarModeloBiblioteca,
  validarParaPublicar,
  type CategoriaChecklist,
  type ModeloBiblioteca,
  type ResultadoAdocao,
  type ResumoModeloBiblioteca,
  type Setor,
  type SetorComContagem,
  type VersaoModeloBiblioteca,
} from "@checkvale/shared";
import { ErroHttp } from "../app";
import type { Db } from "../db";
import { modeloDeLinha } from "../mapeamento";

/**
 * Biblioteca de checklists por setor (docs/BIBLIOTECA.md). A biblioteca é
 * catálogo; adotar COPIA o conteúdo para modelos_checklist, e dali em diante
 * vale o ciclo do núcleo (rascunho → publicada → arquivada).
 */

type Linha = Record<string, unknown>;
const IdParam = z.object({ id: Id });
const VersaoParam = z.object({ id: Id, v: z.coerce.number().int().positive() });
const json = (v: unknown) => JSON.stringify(v);
const lerJson = <T>(v: unknown): T => (typeof v === "string" ? JSON.parse(v) : v) as T;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const totalItens = (cs: readonly CategoriaChecklist[]) => cs.reduce((n, c) => n + c.itens.length, 0);

export const setorDeLinha = (r: Linha): Setor => ({
  id: r.id as string, nome: r.nome as string, descricao: r.descricao as string, icone: r.icone as string, ordem: r.ordem as number, ativo: r.ativo as boolean,
});

const versaoDeLinha = (r: Linha): VersaoModeloBiblioteca => ({
  id: r.id as string,
  versao: r.versao as number,
  setorIds: r.setor_ids as string[],
  nome: r.nome as string,
  resumo: r.resumo as string,
  origem: r.origem as VersaoModeloBiblioteca["origem"],
  fonte: (r.fonte as string | null) ?? null,
  status: r.status as VersaoModeloBiblioteca["status"],
  categorias: lerJson<CategoriaChecklist[]>(r.categorias),
  criadaEm: iso(r.criado_em)!,
  publicadaEm: iso(r.publicada_em),
});

const publico = ({ criadaEm: _c, publicadaEm: _p, ...m }: VersaoModeloBiblioteca): ModeloBiblioteca => m;

async function obterVersao(db: Db, id: string, v: number): Promise<VersaoModeloBiblioteca> {
  const { rows } = await db.query(`SELECT * FROM biblioteca_modelos WHERE id = $1 AND versao = $2`, [id, v]);
  if (!rows[0]) throw new ErroHttp(404, "nao_encontrado", "Versão do modelo da biblioteca não encontrada.");
  return versaoDeLinha(rows[0]);
}

async function publicadaAtual(db: Db, id: string): Promise<VersaoModeloBiblioteca> {
  const { rows } = await db.query(`SELECT * FROM biblioteca_modelos WHERE id = $1 AND status = 'publicada'`, [id]);
  if (!rows[0]) throw new ErroHttp(404, "nao_encontrado", "Modelo não encontrado na biblioteca.");
  return versaoDeLinha(rows[0]);
}

async function exigirSetores(db: Db, ids: readonly string[]) {
  const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM setores WHERE id = ANY($1::uuid[])`, [ids]);
  if ((rows[0]?.n ?? 0) !== new Set(ids).size) throw new ErroHttp(400, "dados_invalidos", "Setor inexistente na lista de setores do modelo.");
}

/** /api/biblioteca: navegar e adotar. */
export const rotasBiblioteca: FastifyPluginAsync = async (app) => {
  const L = app.exigir("biblioteca:ler");

  app.get("/setores", { onRequest: L }, async (): Promise<SetorComContagem[]> => {
    const { rows } = await app.db.query(
      `SELECT s.*, (SELECT count(*)::int FROM biblioteca_modelos m WHERE m.status = 'publicada' AND s.id = ANY(m.setor_ids)) AS total_modelos
         FROM setores s WHERE s.ativo ORDER BY s.ordem, s.nome`,
    );
    return rows.map((r) => ({ ...setorDeLinha(r), totalModelos: r.total_modelos as number }));
  });

  app.get("/modelos", { onRequest: L }, async (req): Promise<ResumoModeloBiblioteca[]> => {
    const { setorId } = z.object({ setorId: Id.optional() }).parse(req.query);
    const { rows } = await app.db.query(
      `SELECT * FROM biblioteca_modelos WHERE status = 'publicada' AND ($1::uuid IS NULL OR $1::uuid = ANY(setor_ids)) ORDER BY nome`,
      [setorId ?? null],
    );
    return rows.map(versaoDeLinha).map((m) => ({
      id: m.id, versao: m.versao, setorIds: m.setorIds, nome: m.nome, resumo: m.resumo, origem: m.origem,
      totalCategorias: m.categorias.length, totalItens: totalItens(m.categorias),
    }));
  });

  app.get("/modelos/:id", { onRequest: L }, async (req) => publico(await publicadaAtual(app.db, IdParam.parse(req.params).id)));

  /**
   * usar → checklist da empresa já publicado; personalizar → rascunho para o editor.
   * Permissão conferida por modo: personalizar = config:editar; usar = também modelo:publicar.
   */
  app.post("/modelos/:id/adotar", { onRequest: app.exigir("config:editar") }, async (req, rep): Promise<ResultadoAdocao> => {
    const { id } = IdParam.parse(req.params);
    const { modo, nome } = AdotarModelo.parse(req.body);
    if (modo === "usar") await app.exigir("modelo:publicar")(req);
    const origem = await publicadaAtual(app.db, id);
    const novo = { id: randomUUID(), nome: nome ?? origem.nome, versao: 1, aplicavel: SEM_RESTRICAO, categorias: copiarCategorias(origem.categorias) };

    if (modo === "usar") {
      // Modelo sem restrição concorre com outro sem restrição e o inspetor passaria a
      // receber um ou outro sem ninguém escolher. Nesse caso, a empresa personaliza.
      const { rows } = await app.db.query(`SELECT * FROM modelos_checklist WHERE status = 'publicada'`);
      const concorrente = rows.map(modeloDeLinha).find((m) => especificidade(m.aplicavel) === 0);
      if (concorrente)
        throw new ErroHttp(409, "conflito_aplicabilidade",
          `Já existe o checklist publicado "${concorrente.nome}" valendo para todos os veículos. Use "Personalizar" para definir onde este modelo vale antes de publicar.`);
      const erros = validarParaPublicar(novo, []);
      if (erros.length) throw new ErroHttp(422, "nao_publicavel", "O modelo tem problemas que impedem a publicação.", erros);
    }

    const status = modo === "usar" ? "publicada" : "rascunho";
    await app.db.query(
      `INSERT INTO modelos_checklist (id, versao, nome, aplicavel, categorias, status, publicada_em, publicada_por, biblioteca_modelo_id, biblioteca_versao)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [novo.id, novo.nome, json(novo.aplicavel), json(novo.categorias), status,
        modo === "usar" ? new Date().toISOString() : null, modo === "usar" ? req.user.sub : null, origem.id, origem.versao],
    );
    await app.auditar(req, `biblioteca.adotar.${modo}`, "modelo", novo.id, { bibliotecaModeloId: origem.id, bibliotecaVersao: origem.versao });
    rep.status(201);
    return { modeloId: novo.id, versao: 1, status };
  });
};

/** /api/admin/biblioteca: curadoria dos modelos (biblioteca:editar). Mesmo ciclo do núcleo. */
export function rotasCuradoria(app: FastifyInstance) {
  const E = app.exigir("biblioteca:editar");
  const auditar = (req: FastifyRequest, acao: string, id: string, dados?: unknown) => app.auditar(req, `admin.biblioteca.${acao}`, "biblioteca_modelo", id, dados);

  app.get("/biblioteca/modelos", { onRequest: app.exigir("biblioteca:ler") }, async () =>
    (await app.db.query(`SELECT * FROM biblioteca_modelos ORDER BY nome, id, versao DESC`)).rows.map(versaoDeLinha),
  );

  app.get("/biblioteca/modelos/:id/versoes/:v", { onRequest: app.exigir("biblioteca:ler") }, async (req) => {
    const { id, v } = VersaoParam.parse(req.params);
    return obterVersao(app.db, id, v);
  });

  app.post("/biblioteca/modelos", { onRequest: E }, async (req, rep) => {
    const d = ModeloBibliotecaEntrada.parse(req.body);
    await exigirSetores(app.db, d.setorIds);
    const id = randomUUID();
    await app.db.query(
      `INSERT INTO biblioteca_modelos (id, versao, setor_ids, nome, resumo, origem, fonte, categorias) VALUES ($1, 1, $2, $3, $4, $5, $6, $7)`,
      [id, d.setorIds, d.nome, d.resumo, d.origem, d.fonte, json(d.categorias)],
    );
    await auditar(req, "criar", id, { nome: d.nome, origem: d.origem });
    return rep.status(201).send(await obterVersao(app.db, id, 1));
  });

  app.put("/biblioteca/modelos/:id/versoes/:v", { onRequest: E }, async (req) => {
    const { id, v } = VersaoParam.parse(req.params);
    const d = ModeloBibliotecaEntrada.parse(req.body);
    if ((await obterVersao(app.db, id, v)).status !== "rascunho") throw new ErroHttp(409, "versao_publicada", "Versão publicada não pode ser alterada. Crie um novo rascunho.");
    await exigirSetores(app.db, d.setorIds);
    await app.db.query(
      `UPDATE biblioteca_modelos SET setor_ids = $3, nome = $4, resumo = $5, origem = $6, fonte = $7, categorias = $8 WHERE id = $1 AND versao = $2`,
      [id, v, d.setorIds, d.nome, d.resumo, d.origem, d.fonte, json(d.categorias)],
    );
    await auditar(req, "editar_rascunho", id, { versao: v, itens: totalItens(d.categorias) });
    return obterVersao(app.db, id, v);
  });

  app.post("/biblioteca/modelos/:id/rascunho", { onRequest: E }, async (req, rep) => {
    const { id } = IdParam.parse(req.params);
    const { rows } = await app.db.query(`SELECT * FROM biblioteca_modelos WHERE id = $1 ORDER BY versao DESC LIMIT 1`, [id]);
    if (!rows[0]) throw new ErroHttp(404, "nao_encontrado", "Modelo não encontrado na biblioteca.");
    const ultima = versaoDeLinha(rows[0]);
    if (ultima.status === "rascunho") return ultima;
    await app.db.query(
      `INSERT INTO biblioteca_modelos (id, versao, setor_ids, nome, resumo, origem, fonte, categorias) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, ultima.versao + 1, ultima.setorIds, ultima.nome, ultima.resumo, ultima.origem, ultima.fonte, json(ultima.categorias)],
    );
    await auditar(req, "novo_rascunho", id, { versao: ultima.versao + 1, base: ultima.versao });
    return rep.status(201).send(await obterVersao(app.db, id, ultima.versao + 1));
  });

  app.post("/biblioteca/modelos/:id/versoes/:v/publicar", { onRequest: E }, async (req) => {
    const { id, v } = VersaoParam.parse(req.params);
    const versao = await obterVersao(app.db, id, v);
    if (versao.status !== "rascunho") throw new ErroHttp(409, "versao_publicada", "Só rascunho pode ser publicado.");
    const erros = validarModeloBiblioteca(versao);
    if (erros.length) throw new ErroHttp(422, "nao_publicavel", "A versão tem problemas que impedem a publicação.", erros);
    await app.db.transacao(async (tx) => {
      // Cópias já adotadas pelas empresas não mudam: elas guardam a versão de origem.
      await tx.query(`UPDATE biblioteca_modelos SET status = 'arquivada' WHERE id = $1 AND status = 'publicada'`, [id]);
      await tx.query(`UPDATE biblioteca_modelos SET status = 'publicada', publicada_em = now(), publicada_por = $3 WHERE id = $1 AND versao = $2`, [id, v, req.user.sub]);
    });
    await auditar(req, "publicar", id, { versao: v });
    return obterVersao(app.db, id, v);
  });
}
