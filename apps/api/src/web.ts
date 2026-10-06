import path from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

/**
 * Política do app (PWA). A da API continua `default-src 'none'` (definida no helmet);
 * esta só vale para as respostas que não são /api.
 */
export const CSP_WEB = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const ehApi = (url: string) => url === "/api" || url.startsWith("/api/") || url.startsWith("/api?");

/**
 * Serve o build da PWA (apps/web/dist) na mesma origem da API: um serviço só, sem CORS.
 * Ativado por WEB_DIR. Rota desconhecida fora de /api cai no index.html (SPA).
 */
export async function servirWeb(app: FastifyInstance, webDir: string): Promise<void> {
  const raiz = path.resolve(webDir);
  await app.register(fastifyStatic, {
    root: raiz,
    wildcard: false,
    cacheControl: false,
    setHeaders(res, arquivo) {
      // Arquivos com hash no nome nunca mudam; o resto (index, sw.js, manifest) precisa ser revalidado sempre.
      const imutavel = arquivo.startsWith(path.join(raiz, "assets") + path.sep);
      res.setHeader("cache-control", imutavel ? "public, max-age=31536000, immutable" : "no-cache");
    },
  });

  app.addHook("onSend", async (req, rep) => {
    if (!ehApi(req.url)) rep.header("content-security-policy", CSP_WEB);
  });

  app.setNotFoundHandler((req, rep) => {
    if (req.method === "GET" && !ehApi(req.url) && !path.extname(req.url.split("?")[0]!)) return rep.sendFile("index.html");
    return rep.status(404).send({ erro: "nao_encontrado", mensagem: "Recurso não encontrado." });
  });
}
