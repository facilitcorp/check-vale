import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  aplicarRegras,
  AreaEntrada,
  AtividadeEntrada,
  AtributoEntrada,
  Id,
  NovoModeloEntrada,
  RascunhoEntrada,
  SEM_RESTRICAO,
  SetorEntrada,
  TipoVeiculoEntrada,
  UnidadeEntrada,
  UsuarioEntrada,
  validarAtributos,
  validarParaPublicar,
  VeiculoEntrada,
  type ContextoRegras,
  type ModeloResumo,
  type Permissao,
  type UsuarioAdmin,
  type VersaoModelo,
} from "@checkvale/shared";
import { ErroHttp } from "../app";
import type { Db } from "../db";
import { rotasCuradoria, setorDeLinha } from "./biblioteca";
import {
  areaDeLinha,
  atividadeDeLinha,
  atributoDeLinha,
  carregarAtributos,
  modeloDeLinha,
  tipoDeLinha,
  unidadeDeLinha,
  veiculoDeLinha,
} from "../mapeamento";

/**
 * Administração do núcleo configurável. Nada é apagado: desativa-se
 * (ativo=false / status=inativo) e a auditoria guarda quem mudou o quê.
 */

type Linha = Record<string, unknown>;
const IdParam = z.object({ id: Id });

/** Colunas de uma entidade simples: campo do contrato → coluna (+ conversão para SQL). */
type Colunas = Record<string, { col: string; sql?: (v: unknown) => unknown }>;

interface Cadastro {
  caminho: string;
  tabela: string;
  entidade: string;
  entrada: z.ZodObject;
  colunas: Colunas;
  deLinha: (r: Linha) => unknown;
  ordem: string;
  /** Campos que não podem mudar depois de criados (ex.: código usado em regras). */
  imutaveis?: string[];
  validar?: (dados: Record<string, unknown>, db: Db, id: string | null) => Promise<void>;
}

const params = (cols: Colunas, dados: Record<string, unknown>) =>
  Object.entries(dados)
    .filter(([k]) => cols[k])
    .map(([k, v]) => ({ col: cols[k]!.col, valor: cols[k]!.sql ? cols[k]!.sql!(v) : v }));

function registrarCadastro(app: FastifyInstance, c: Cadastro, ler: Permissao, editar: Permissao) {
  app.get(`/${c.caminho}`, { onRequest: app.exigir(ler) }, async () =>
    (await app.db.query(`SELECT * FROM ${c.tabela} ORDER BY ${c.ordem}`)).rows.map(c.deLinha),
  );

  app.post(`/${c.caminho}`, { onRequest: app.exigir(editar) }, async (req, rep) => {
    const dados = c.entrada.parse(req.body) as Record<string, unknown>;
    await c.validar?.(dados, app.db, null);
    const id = randomUUID();
    const ps = params(c.colunas, dados);
    const { rows } = await app.db.query(
      `INSERT INTO ${c.tabela} (id, ${ps.map((p) => p.col).join(", ")}) VALUES ($1, ${ps.map((_, i) => `$${i + 2}`).join(", ")}) RETURNING *`,
      [id, ...ps.map((p) => p.valor)],
    );
    await app.auditar(req, `admin.${c.entidade}.criar`, c.entidade, id, dados);
    return rep.status(201).send(c.deLinha(rows[0]!));
  });

  app.patch(`/${c.caminho}/:id`, { onRequest: app.exigir(editar) }, async (req) => {
    const { id } = IdParam.parse(req.params);
    const dados = c.entrada.partial().parse(req.body) as Record<string, unknown>;
    const antes = (await app.db.query(`SELECT * FROM ${c.tabela} WHERE id = $1`, [id])).rows[0];
    if (!antes) throw new ErroHttp(404, "nao_encontrado", "Cadastro não encontrado.");
    for (const campo of c.imutaveis ?? [])
      if (campo in dados && dados[campo] !== (c.deLinha(antes) as Record<string, unknown>)[campo])
        throw new ErroHttp(400, "campo_imutavel", `O campo "${campo}" não pode ser alterado depois de criado.`);
    await c.validar?.({ ...(c.deLinha(antes) as Record<string, unknown>), ...dados }, app.db, id);
    const ps = params(c.colunas, dados);
    if (ps.length === 0) return c.deLinha(antes);
    const extra = c.tabela === "veiculos" ? ", servidor_em = now(), atualizado_em = now()" : "";
    const { rows } = await app.db.query(
      `UPDATE ${c.tabela} SET ${ps.map((p, i) => `${p.col} = $${i + 2}`).join(", ")}${extra} WHERE id = $1 RETURNING *`,
      [id, ...ps.map((p) => p.valor)],
    );
    await app.auditar(req, `admin.${c.entidade}.alterar`, c.entidade, id, dados);
    return c.deLinha(rows[0]!);
  });
}

const json = (v: unknown) => JSON.stringify(v);

export const rotasAdmin: FastifyPluginAsync = async (app) => {
  const L: Permissao = "config:ler";
  const E: Permissao = "config:editar";

  registrarCadastro(app, {
    caminho: "unidades", tabela: "unidades", entidade: "unidade", entrada: UnidadeEntrada, deLinha: unidadeDeLinha, ordem: "nome",
    colunas: { nome: { col: "nome" }, uf: { col: "uf" }, ativo: { col: "ativo" } },
  }, L, E);

  registrarCadastro(app, {
    caminho: "areas", tabela: "areas", entidade: "area", entrada: AreaEntrada, deLinha: areaDeLinha, ordem: "nome",
    colunas: { unidadeId: { col: "unidade_id" }, nome: { col: "nome" }, ativo: { col: "ativo" } },
  }, L, E);

  registrarCadastro(app, {
    caminho: "atividades", tabela: "atividades", entidade: "atividade", entrada: AtividadeEntrada, deLinha: atividadeDeLinha, ordem: "nome",
    colunas: { nome: { col: "nome" }, ativo: { col: "ativo" } },
  }, L, E);

  registrarCadastro(app, {
    caminho: "tipos-veiculo", tabela: "tipos_veiculo", entidade: "tipo_veiculo", entrada: TipoVeiculoEntrada, deLinha: tipoDeLinha, ordem: "ordem, nome",
    colunas: { codigo: { col: "codigo" }, nome: { col: "nome" }, ordem: { col: "ordem" }, ativo: { col: "ativo" } },
    imutaveis: ["codigo"],
  }, L, E);

  registrarCadastro(app, {
    caminho: "atributos", tabela: "atributos_veiculo", entidade: "atributo", entrada: AtributoEntrada, deLinha: atributoDeLinha, ordem: "ordem, nome",
    colunas: {
      codigo: { col: "codigo" }, nome: { col: "nome" }, tipo: { col: "tipo" }, opcoes: { col: "opcoes" }, unidadeMedida: { col: "unidade_medida" },
      tipoVeiculoIds: { col: "tipo_veiculo_ids" }, obrigatorio: { col: "obrigatorio" }, ordem: { col: "ordem" }, ativo: { col: "ativo" },
    },
    // O código é a chave usada nos veículos e nas regras dos checklists.
    imutaveis: ["codigo", "tipo"],
    validar: async (d) => {
      if (d.tipo === "lista" && !(d.opcoes as string[] | undefined)?.length) throw new ErroHttp(400, "dados_invalidos", "Atributo do tipo lista precisa de opções.");
    },
  }, L, E);

  registrarCadastro(app, {
    caminho: "veiculos", tabela: "veiculos", entidade: "veiculo", entrada: VeiculoEntrada, deLinha: veiculoDeLinha, ordem: "placa NULLS LAST, codigo",
    colunas: {
      placa: { col: "placa", sql: (v) => (v ? String(v).toUpperCase().replace(/[^A-Z0-9]/g, "") : null) },
      codigo: { col: "codigo" }, tipoVeiculoId: { col: "tipo_veiculo_id" }, fabricante: { col: "fabricante" }, modelo: { col: "modelo" },
      descricao: { col: "descricao" }, empresa: { col: "empresa" }, unidadeId: { col: "unidade_id" }, status: { col: "status" },
      atributos: { col: "atributos", sql: json },
    },
    validar: async (d, db) => {
      if (!d.placa && !d.codigo) throw new ErroHttp(400, "dados_invalidos", "Informe a placa ou o código interno.");
      const erros = validarAtributos(await carregarAtributos(db), d.tipoVeiculoId as string, (d.atributos ?? {}) as Record<string, string>);
      if (erros.length) throw new ErroHttp(400, "atributos_invalidos", erros.join(" "), erros);
    },
  }, L, E);
  registrarCadastro(app, {
    caminho: "setores", tabela: "setores", entidade: "setor", entrada: SetorEntrada, deLinha: setorDeLinha, ordem: "ordem, nome",
    colunas: { nome: { col: "nome" }, descricao: { col: "descricao" }, icone: { col: "icone" }, ordem: { col: "ordem" }, ativo: { col: "ativo" } },
  }, "biblioteca:ler", "biblioteca:editar");

  rotasUsuarios(app);
  rotasModelos(app);
  rotasCuradoria(app);
};

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

const usuarioDeLinha = (r: Linha): UsuarioAdmin => ({
  id: r.id as string, nome: r.nome as string, email: r.email as string, papel: r.papel as UsuarioAdmin["papel"], ativo: r.ativo as boolean, demo: r.demo as boolean,
});

function rotasUsuarios(app: FastifyInstance) {
  const P = app.exigir("usuario:gerenciar");
  app.get("/usuarios", { onRequest: P }, async () => (await app.db.query(`SELECT * FROM usuarios ORDER BY nome`)).rows.map(usuarioDeLinha));

  app.post("/usuarios", { onRequest: P }, async (req, rep) => {
    const d = UsuarioEntrada.parse(req.body);
    if (!d.senha) throw new ErroHttp(400, "dados_invalidos", "Informe a senha inicial (mínimo 8 caracteres).");
    const id = randomUUID();
    const { rows } = await app.db.query(
      `INSERT INTO usuarios (id, nome, email, senha_hash, papel, ativo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, d.nome, d.email, await bcrypt.hash(d.senha, 10), d.papel, d.ativo],
    );
    await app.auditar(req, "admin.usuario.criar", "usuario", id, { nome: d.nome, email: d.email, papel: d.papel });
    return rep.status(201).send(usuarioDeLinha(rows[0]!));
  });

  app.patch("/usuarios/:id", { onRequest: P }, async (req) => {
    const { id } = IdParam.parse(req.params);
    const d = UsuarioEntrada.partial().parse(req.body);
    if (id === req.user.sub && (d.ativo === false || (d.papel && d.papel !== req.user.papel)))
      throw new ErroHttp(400, "auto_bloqueio", "Você não pode desativar nem trocar o próprio perfil.");
    const sets: string[] = [];
    const vals: unknown[] = [id];
    const add = (col: string, v: unknown) => (vals.push(v), sets.push(`${col} = $${vals.length}`));
    if (d.nome !== undefined) add("nome", d.nome);
    if (d.email !== undefined) add("email", d.email);
    if (d.papel !== undefined) add("papel", d.papel);
    if (d.ativo !== undefined) add("ativo", d.ativo);
    if (d.senha) add("senha_hash", await bcrypt.hash(d.senha, 10));
    const { rows } = sets.length
      ? await app.db.query(`UPDATE usuarios SET ${sets.join(", ")} WHERE id = $1 RETURNING *`, vals)
      : await app.db.query(`SELECT * FROM usuarios WHERE id = $1`, [id]);
    if (!rows[0]) throw new ErroHttp(404, "nao_encontrado", "Usuário não encontrado.");
    await app.auditar(req, "admin.usuario.alterar", "usuario", id, { ...d, senha: d.senha ? "(trocada)" : undefined });
    return usuarioDeLinha(rows[0]);
  });
}

// ---------------------------------------------------------------------------
// Modelos de checklist: rascunho → publicar (imutável) → novo rascunho
// ---------------------------------------------------------------------------

const VersaoParam = z.object({ id: Id, v: z.coerce.number().int().positive() });

const versaoDeLinha = (r: Linha): VersaoModelo => ({
  ...modeloDeLinha(r),
  status: r.status as VersaoModelo["status"],
  demo: r.demo as boolean,
  criadaEm: new Date(r.criado_em as string).toISOString(),
  publicadaEm: r.publicada_em ? new Date(r.publicada_em as string).toISOString() : null,
});

async function obterVersao(db: Db, id: string, v: number): Promise<VersaoModelo> {
  const { rows } = await db.query(`SELECT * FROM modelos_checklist WHERE id = $1 AND versao = $2`, [id, v]);
  if (!rows[0]) throw new ErroHttp(404, "nao_encontrado", "Versão de modelo não encontrada.");
  return versaoDeLinha(rows[0]);
}

function rotasModelos(app: FastifyInstance) {
  const L = app.exigir("config:ler");
  const E = app.exigir("config:editar");
  const auditar = (req: FastifyRequest, acao: string, id: string, dados?: unknown) => app.auditar(req, `admin.modelo.${acao}`, "modelo", id, dados);

  app.get("/modelos", { onRequest: L }, async (): Promise<ModeloResumo[]> => {
    const { rows } = await app.db.query(`SELECT * FROM modelos_checklist ORDER BY nome, id, versao DESC`);
    const porId = new Map<string, ModeloResumo>();
    for (const r of rows) {
      const v = versaoDeLinha(r);
      const resumo = porId.get(v.id) ?? { id: v.id, nome: v.nome, demo: v.demo, versoes: [] };
      resumo.versoes.push({ versao: v.versao, status: v.status, publicadaEm: v.publicadaEm, itens: v.categorias.reduce((n, c) => n + c.itens.length, 0) });
      porId.set(v.id, resumo);
    }
    return [...porId.values()];
  });

  app.post("/modelos", { onRequest: E }, async (req, rep) => {
    const { nome } = NovoModeloEntrada.parse(req.body);
    const id = randomUUID();
    await app.db.query(`INSERT INTO modelos_checklist (id, versao, nome, aplicavel, categorias, status) VALUES ($1, 1, $2, $3, '[]', 'rascunho')`, [id, nome, json(SEM_RESTRICAO)]);
    await auditar(req, "criar", id, { nome });
    return rep.status(201).send(await obterVersao(app.db, id, 1));
  });

  app.get("/modelos/:id/versoes/:v", { onRequest: L }, async (req) => {
    const { id, v } = VersaoParam.parse(req.params);
    return obterVersao(app.db, id, v);
  });

  app.put("/modelos/:id/versoes/:v", { onRequest: E }, async (req) => {
    const { id, v } = VersaoParam.parse(req.params);
    const d = RascunhoEntrada.parse(req.body);
    const atual = await obterVersao(app.db, id, v);
    if (atual.status !== "rascunho") throw new ErroHttp(409, "versao_publicada", "Versão publicada não pode ser alterada. Crie um novo rascunho.");
    await app.db.query(`UPDATE modelos_checklist SET nome = $3, aplicavel = $4, categorias = $5 WHERE id = $1 AND versao = $2`, [
      id, v, d.nome, json(d.aplicavel), json(d.categorias),
    ]);
    await auditar(req, "editar_rascunho", id, { versao: v, categorias: d.categorias.length, itens: d.categorias.reduce((n, c) => n + c.itens.length, 0) });
    return obterVersao(app.db, id, v);
  });

  /** Abre rascunho a partir da última versão (mesmos ids de item → histórico comparável). Idempotente. */
  app.post("/modelos/:id/rascunho", { onRequest: E }, async (req, rep) => {
    const { id } = IdParam.parse(req.params);
    const { rows } = await app.db.query(`SELECT * FROM modelos_checklist WHERE id = $1 ORDER BY versao DESC LIMIT 1`, [id]);
    const ultima = rows[0] ? versaoDeLinha(rows[0]) : null;
    if (!ultima) throw new ErroHttp(404, "nao_encontrado", "Modelo não encontrado.");
    if (ultima.status === "rascunho") return ultima;
    const nova = ultima.versao + 1;
    await app.db.query(
      `INSERT INTO modelos_checklist (id, versao, nome, aplicavel, categorias, status, demo) VALUES ($1,$2,$3,$4,$5,'rascunho',$6)`,
      [id, nova, ultima.nome, json(ultima.aplicavel), json(ultima.categorias), ultima.demo],
    );
    await auditar(req, "novo_rascunho", id, { versao: nova, base: ultima.versao });
    return rep.status(201).send(await obterVersao(app.db, id, nova));
  });

  app.post("/modelos/:id/versoes/:v/publicar", { onRequest: app.exigir("modelo:publicar") }, async (req) => {
    const { id, v } = VersaoParam.parse(req.params);
    const versao = await obterVersao(app.db, id, v);
    if (versao.status !== "rascunho") throw new ErroHttp(409, "versao_publicada", "Só rascunho pode ser publicado.");
    const erros = validarParaPublicar(versao, (await carregarAtributos(app.db)).filter((a) => a.ativo));
    if (erros.length) throw new ErroHttp(422, "nao_publicavel", "A versão tem problemas que impedem a publicação.", erros);
    await app.db.transacao(async (tx) => {
      // A anterior fica arquivada: inspeções em andamento nela continuam válidas.
      await tx.query(`UPDATE modelos_checklist SET status = 'arquivada' WHERE id = $1 AND status = 'publicada'`, [id]);
      await tx.query(`UPDATE modelos_checklist SET status = 'publicada', publicada_em = now(), publicada_por = $3 WHERE id = $1 AND versao = $2`, [id, v, req.user.sub]);
    });
    await auditar(req, "publicar", id, { versao: v });
    return obterVersao(app.db, id, v);
  });

  /** Mostra o que o inspetor veria num contexto (tipo, área, atividade, atributos). */
  app.post("/modelos/:id/versoes/:v/previa", { onRequest: L }, async (req) => {
    const { id, v } = VersaoParam.parse(req.params);
    const ctx = z.object({ tipoVeiculoId: z.string(), areaId: z.string(), atividadeId: z.string(), atributos: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])) }).parse(req.body) as ContextoRegras;
    return aplicarRegras(await obterVersao(app.db, id, v), ctx);
  });
}
