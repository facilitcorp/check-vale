import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp } from "./app";
import { armazenamentoMemoria } from "./armazenamento";
import { lerConfig } from "./config";
import { abrirDb, migrar, type Db } from "./db";
import { CSP_WEB } from "./web";

let app: FastifyInstance;
let db: Db;

beforeAll(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "web-"));
  await mkdir(path.join(dir, "assets"));
  await writeFile(path.join(dir, "index.html"), "<!doctype html><div id=root></div>");
  await writeFile(path.join(dir, "sw.js"), "// sw");
  await writeFile(path.join(dir, "assets", "index-abc.js"), "// app");
  db = await abrirDb({ databaseUrl: null, dataDir: null });
  await migrar(db);
  app = await criarApp(lerConfig({ NODE_ENV: "test", WEB_DIR: dir }), db, armazenamentoMemoria());
});
afterAll(async () => {
  await app.close();
  await db.fechar();
});

describe("app web na mesma origem (WEB_DIR)", () => {
  it("serve o index com a CSP do app e sem cache", async () => {
    const r = await app.inject({ url: "/" });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain("root");
    expect(r.headers["content-security-policy"]).toBe(CSP_WEB);
    expect(r.headers["cache-control"]).toBe("no-cache");
  });

  it("rota do app (deep link) cai no index.html", async () => {
    const r = await app.inject({ url: "/inspecoes/123", headers: { accept: "text/html" } });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain("root");
  });

  it("assets com hash são imutáveis; sw.js é sempre revalidado", async () => {
    expect((await app.inject({ url: "/assets/index-abc.js" })).headers["cache-control"]).toContain("immutable");
    expect((await app.inject({ url: "/sw.js" })).headers["cache-control"]).toBe("no-cache");
  });

  it("arquivo inexistente e /api desconhecida dão 404 em JSON, sem cair no index", async () => {
    for (const url of ["/assets/nao-existe.js", "/api/nao-existe"]) {
      const r = await app.inject({ url });
      expect(r.statusCode, url).toBe(404);
      expect(r.json().erro).toBe("nao_encontrado");
    }
  });

  it("a API mantém a CSP fechada", async () => {
    const r = await app.inject({ url: "/api/saude" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-security-policy"]).toContain("default-src 'none'");
  });
});
