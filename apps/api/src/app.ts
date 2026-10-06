import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { pode, type Papel, type Permissao } from "@checkvale/shared";
import type { Armazenamento } from "./armazenamento";
import type { Config } from "./config";
import type { Db } from "./db";
import { rotasAdmin } from "./rotas/admin";
import { rotasAuth } from "./rotas/auth";
import { rotasCatalogo } from "./rotas/catalogo";
import { rotasEvidencias } from "./rotas/evidencias";
import { rotasInspecoes } from "./rotas/inspecoes";
import { rotasSync } from "./rotas/sync";
import { rotasVeiculos } from "./rotas/veiculos";
import { servirWeb } from "./web";

export interface Sessao {
  sub: string;
  papel: Papel;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: Sessao;
    user: Sessao;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    armazenamento: Armazenamento;
    autenticar: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
    /** Hook que exige a permissão (RBAC). Usar depois de autenticar. */
    exigir: (p: Permissao) => (req: FastifyRequest) => Promise<void>;
    auditar: (req: FastifyRequest, acao: string, entidade: string, entidadeId: string | null, dados?: unknown) => Promise<void>;
  }
}

export class ErroHttp extends Error {
  constructor(public status: number, public codigo: string, mensagem: string, public erros?: string[]) {
    super(mensagem);
  }
}

export async function criarApp(cfg: Config, db: Db, armazenamento: Armazenamento): Promise<FastifyInstance> {
  const app = Fastify({
    logger: cfg.producao ? { redact: ["req.headers.authorization"] } : false,
    bodyLimit: 16 * 1024 * 1024,
    // Só os N saltos de proxy conhecidos: com `true` o cliente forjaria o IP (burla o limite do login e falseia a auditoria).
    // (Número aqui o Fastify trata como "não confiar em nada"; por isso a função por posição do salto.)
    trustProxy: (_endereco: string, salto: number) => salto < cfg.proxiesConfiaveis,
  });

  app.decorate("db", db);
  app.decorate("armazenamento", armazenamento);
  // API só serve JSON/PDF/imagem: CSP fechada; foto pode ser lida pelo app (cross-origin em dev).
  await app.register(helmet, { contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, crossOriginResourcePolicy: { policy: "same-site" } });
  await app.register(cors, { origin: cfg.origensCors, credentials: false });
  await app.register(rateLimit, { global: false });
  await app.register(jwt, { secret: cfg.jwtSecret, sign: { expiresIn: cfg.jwtValidade } });

  app.decorate("autenticar", async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new ErroHttp(401, "nao_autenticado", "Sessão expirada. Entre novamente.");
    }
  });

  app.decorate("exigir", (p: Permissao) => async (req: FastifyRequest) => {
    if (!pode(req.user.papel, p)) throw new ErroHttp(403, "proibido", "Seu perfil não tem acesso a esta função.");
  });

  app.decorate("auditar", async (req: FastifyRequest, acao: string, entidade: string, entidadeId: string | null, dados?: unknown) => {
    const usuarioId = (req.user as Sessao | undefined)?.sub ?? null;
    await db.query(`INSERT INTO auditoria (usuario_id, acao, entidade, entidade_id, dados, ip) VALUES ($1,$2,$3,$4,$5,$6)`, [
      usuarioId, acao, entidade, entidadeId, dados === undefined ? null : JSON.stringify(dados), req.ip,
    ]);
  });

  // Fotos chegam como binário puro.
  app.addContentTypeParser(["image/jpeg", "image/png", "image/webp"], { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  app.setErrorHandler((err, req, rep) => {
    if (err instanceof ErroHttp) return rep.status(err.status).send({ erro: err.codigo, mensagem: err.message, ...(err.erros ? { erros: err.erros } : {}) });
    if ((err as { code?: string }).code === "23505") return rep.status(409).send({ erro: "ja_existe", mensagem: "Já existe um cadastro com esses dados (código, e-mail ou placa repetido)." });
    if (err instanceof ZodError)
      return rep.status(400).send({ erro: "dados_invalidos", mensagem: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return rep.status(status).send({ erro: "requisicao_invalida", mensagem: (err as Error).message });
    req.log.error(err);
    return rep.status(500).send({ erro: "erro_interno", mensagem: "Erro inesperado. Tente novamente." });
  });

  // Saúde e prontidão: só responde depois das migrações (o listen vem depois delas) e com o banco respondendo.
  app.get("/api/saude", async (_req, rep) => {
    rep.header("cache-control", "no-store");
    await db.query("SELECT 1");
    return { ok: true, versao: cfg.versao, revisao: cfg.revisao, autocadastro: cfg.autocadastro };
  });

  await app.register(rotasAuth, { prefix: "/api/auth", autocadastro: cfg.autocadastro });
  await app.register(async (privado) => {
    privado.addHook("onRequest", app.autenticar);
    await privado.register(rotasCatalogo);
    await privado.register(rotasVeiculos);
    await privado.register(rotasInspecoes);
    await privado.register(rotasSync);
    await privado.register(rotasEvidencias);
    await privado.register(rotasAdmin, { prefix: "/admin" });
  }, { prefix: "/api" });

  if (cfg.webDir) await servirWeb(app, cfg.webDir);

  return app;
}
