import bcrypt from "bcryptjs";
import type { FastifyPluginAsync } from "fastify";
import { LoginEntrada, type LoginSaida, type Papel } from "@checkvale/shared";
import { ErroHttp } from "../app";

// Hash fixo para comparar mesmo quando o e-mail não existe (tempo constante, sem enumerar usuários).
const HASH_FALSO = bcrypt.hashSync("senha-inexistente", 10);

interface LinhaUsuario { id: string; nome: string; email: string; senha_hash: string; papel: Papel; ativo: boolean }

export const rotasAuth: FastifyPluginAsync = async (app) => {
  app.post("/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req): Promise<LoginSaida> => {
    const { email, senha } = LoginEntrada.parse(req.body);
    const { rows } = await app.db.query<LinhaUsuario>(`SELECT id, nome, email, senha_hash, papel, ativo FROM usuarios WHERE email = $1`, [email]);
    const u = rows[0];
    const confere = await bcrypt.compare(senha, u?.senha_hash ?? HASH_FALSO);
    if (!u || !u.ativo || !confere) {
      await app.auditar(req, "login_falhou", "usuario", u?.id ?? null, { email });
      throw new ErroHttp(401, "credenciais_invalidas", "E-mail ou senha incorretos.");
    }
    const token = app.jwt.sign({ sub: u.id, papel: u.papel });
    const { exp } = app.jwt.decode<{ exp: number }>(token)!;
    req.user = { sub: u.id, papel: u.papel };
    await app.auditar(req, "login", "usuario", u.id);
    return { token, expiraEm: new Date(exp * 1000).toISOString(), usuario: { id: u.id, nome: u.nome, email: u.email, papel: u.papel } };
  });

  app.get("/eu", { onRequest: app.autenticar }, async (req) => {
    const { rows } = await app.db.query<LinhaUsuario>(`SELECT id, nome, email, papel, ativo FROM usuarios WHERE id = $1`, [req.user.sub]);
    const u = rows[0];
    if (!u?.ativo) throw new ErroHttp(401, "nao_autenticado", "Usuário inativo.");
    return { id: u.id, nome: u.nome, email: u.email, papel: u.papel };
  });
};
