import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEM_RESTRICAO, type SetorComContagem, type VersaoModelo } from "@checkvale/shared";
import { criarApp } from "./app";
import { armazenamentoMemoria } from "./armazenamento";
import { lerConfig } from "./config";
import { abrirDb, migrar, type Db } from "./db";
import { semearDemo } from "./semente/semear";

let app: FastifyInstance;
let db: Db;
const tokens: Record<string, string> = {};
const como = (quem: "admin" | "inspetor") => ({ authorization: `Bearer ${tokens[quem]}` });
const req = (quem: "admin" | "inspetor", method: "GET" | "POST" | "PUT" | "PATCH", url: string, payload?: unknown) =>
  app.inject({ method, url, headers: como(quem), payload: payload as never });

const item = (codigo: string, titulo: string) => ({
  id: randomUUID(), codigo, titulo, descricao: "", ordem: 1, permiteNaoAplica: true, criticidadeSugerida: null, aplicavel: SEM_RESTRICAO,
});
const conteudo = (setorIds: string[]) => ({
  setorIds, nome: "Pré-uso de caminhão", resumo: "Ponto de partida genérico", origem: "base_checkvale", fonte: null,
  categorias: [{ id: randomUUID(), codigo: "PNEUS", nome: "Pneus", icone: "geral", ordem: 1, aplicavel: SEM_RESTRICAO, itens: [item("PNEUS.1", "Calibragem"), item("PNEUS.2", "Sulco")] }],
});

beforeAll(async () => {
  db = await abrirDb({ databaseUrl: null, dataDir: null });
  await migrar(db);
  await semearDemo(db, "senha-teste");
  app = await criarApp(lerConfig({ NODE_ENV: "test" }), db, armazenamentoMemoria());
  for (const quem of ["admin", "inspetor"] as const) {
    const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: `${quem}@checkvale.dev`, senha: "senha-teste" } });
    tokens[quem] = r.json().token;
  }
});
afterAll(async () => {
  await app.close();
  await db.fechar();
});

describe("biblioteca", () => {
  let setores: SetorComContagem[];
  let bibliotecaId: string;

  it("nasce com os 10 setores iniciais, em ordem, e o inspetor não vê", async () => {
    setores = (await req("admin", "GET", "/api/biblioteca/setores")).json();
    expect(setores.map((s) => s.nome)).toEqual([
      "Mineração", "Energia elétrica", "Transporte rodoviário e logística", "Construção civil e infraestrutura", "Óleo, gás e petroquímica",
      "Agronegócio", "Portos e terminais", "Transporte de passageiros", "Indústria e siderurgia", "Saneamento, resíduos e serviços ambientais",
    ]);
    expect(setores.every((s) => s.totalModelos === 0)).toBe(true);
    expect((await req("inspetor", "GET", "/api/biblioteca/setores")).statusCode).toBe(403);
  });

  it("setor é cadastro: cria o 11º e inativo some da biblioteca", async () => {
    const r = await req("admin", "POST", "/api/admin/setores", { nome: "Aviação", descricao: "", icone: "geral", ordem: 110, ativo: true });
    expect(r.statusCode, r.body).toBe(201);
    expect((await req("admin", "GET", "/api/biblioteca/setores")).json()).toHaveLength(11);
    await req("admin", "PATCH", `/api/admin/setores/${r.json().id}`, { ativo: false });
    expect((await req("admin", "GET", "/api/biblioteca/setores")).json()).toHaveLength(10);
  });

  it("curadoria: rascunho não aparece; publicado aparece no setor com contagem", async () => {
    const mineracao = setores[0]!.id;
    const r = await req("admin", "POST", "/api/admin/biblioteca/modelos", conteudo([mineracao]));
    expect(r.statusCode, r.body).toBe(201);
    bibliotecaId = r.json().id;
    expect((await req("admin", "GET", `/api/biblioteca/modelos?setorId=${mineracao}`)).json()).toEqual([]);
    const pub = await req("admin", "POST", `/api/admin/biblioteca/modelos/${bibliotecaId}/versoes/1/publicar`);
    expect(pub.statusCode, pub.body).toBe(200);
    const lista = (await req("admin", "GET", `/api/biblioteca/modelos?setorId=${mineracao}`)).json();
    expect(lista).toMatchObject([{ id: bibliotecaId, origem: "base_checkvale", totalCategorias: 1, totalItens: 2 }]);
    expect((await req("admin", "GET", "/api/biblioteca/setores")).json()[0].totalModelos).toBe(1);
    expect((await req("admin", "GET", `/api/biblioteca/modelos?setorId=${setores[1]!.id}`)).json()).toEqual([]);
  });

  it("recusa referência sem fonte, origem 'oficial' e regra de aplicabilidade", async () => {
    const base = conteudo([setores[0]!.id]);
    expect((await req("admin", "POST", "/api/admin/biblioteca/modelos", { ...base, origem: "referencia" })).statusCode).toBe(400);
    expect((await req("admin", "POST", "/api/admin/biblioteca/modelos", { ...base, origem: "oficial" })).statusCode).toBe(400);
    const comRegra = conteudo([setores[0]!.id]);
    comRegra.categorias[0]!.aplicavel = { ...SEM_RESTRICAO, tipoVeiculoIds: [randomUUID()] };
    const r = await req("admin", "POST", "/api/admin/biblioteca/modelos", comRegra);
    expect((await req("admin", "POST", `/api/admin/biblioteca/modelos/${r.json().id}/versoes/1/publicar`)).statusCode).toBe(422);
  });

  it("personalizar cria rascunho da empresa: ids novos, mesmos códigos, origem guardada", async () => {
    const r = await req("admin", "POST", `/api/biblioteca/modelos/${bibliotecaId}/adotar`, { modo: "personalizar" });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ versao: 1, status: "rascunho" });
    const copia: VersaoModelo = (await req("admin", "GET", `/api/admin/modelos/${r.json().modeloId}/versoes/1`)).json();
    const original = (await req("admin", "GET", `/api/biblioteca/modelos/${bibliotecaId}`)).json();
    expect(copia.categorias[0]!.itens.map((i) => i.codigo)).toEqual(["PNEUS.1", "PNEUS.2"]);
    expect(copia.categorias[0]!.itens[0]!.id).not.toBe(original.categorias[0].itens[0].id);
    const { rows } = await db.query(`SELECT biblioteca_modelo_id, biblioteca_versao FROM modelos_checklist WHERE id = $1`, [r.json().modeloId]);
    expect(rows[0]).toEqual({ biblioteca_modelo_id: bibliotecaId, biblioteca_versao: 1 });
  });

  it("usar com conflito: vira rascunho, avisa o conflito e o checklist atual segue publicado", async () => {
    const antes = (await db.query(`SELECT id, nome FROM modelos_checklist WHERE status = 'publicada'`)).rows;
    const r = await req("admin", "POST", `/api/biblioteca/modelos/${bibliotecaId}/adotar`, { modo: "usar" });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().status).toBe("rascunho");
    expect(r.json().conflitos.map((c: { id: string }) => c.id).sort()).toEqual(antes.map((m) => m.id).sort());
    expect((await db.query(`SELECT id FROM modelos_checklist WHERE status = 'publicada'`)).rows).toHaveLength(antes.length);

    // Publicar sem definir a aplicabilidade é recusado; o editor mostra o motivo.
    const url = `/api/admin/modelos/${r.json().modeloId}/versoes/1`;
    const recusa = await req("admin", "POST", `${url}/publicar`);
    expect(recusa.statusCode).toBe(422);
    expect(recusa.json().erros.join(" ")).toMatch(/Aplicabilidade ambígua com o checklist publicado/);

    // Restringindo a um tipo de veículo, deixa de empatar e publica; o anterior continua publicado.
    const rascunho: VersaoModelo = (await req("admin", "GET", url)).json();
    const tipo = (await db.query(`SELECT id FROM tipos_veiculo LIMIT 1`)).rows[0]!.id as string;
    await req("admin", "PUT", url, { nome: rascunho.nome, aplicavel: { ...SEM_RESTRICAO, tipoVeiculoIds: [tipo] }, categorias: rascunho.categorias });
    const ok = await req("admin", "POST", `${url}/publicar`);
    expect(ok.statusCode, ok.body).toBe(200);
    for (const m of antes) expect((await db.query(`SELECT status FROM modelos_checklist WHERE id = $1 AND status = 'publicada'`, [m.id])).rows).toHaveLength(1);
  });

  it("usar publica direto quando não há checklist geral concorrente", async () => {
    await db.query(`UPDATE modelos_checklist SET status = 'arquivada' WHERE status = 'publicada'`);
    const r = await req("admin", "POST", `/api/biblioteca/modelos/${bibliotecaId}/adotar`, { modo: "usar", nome: "Pré-uso (nosso)" });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ status: "publicada", conflitos: [] });
    const catalogo = (await req("inspetor", "GET", "/api/catalogo")).json();
    expect(catalogo.modelos.map((m: { nome: string }) => m.nome)).toContain("Pré-uso (nosso)");
  });

  it("nova versão da biblioteca não altera a cópia já adotada", async () => {
    const rasc = await req("admin", "POST", `/api/admin/biblioteca/modelos/${bibliotecaId}/rascunho`);
    const novo = conteudo([setores[0]!.id]);
    novo.categorias[0]!.itens.push(item("PNEUS.3", "Estepe"));
    await req("admin", "PUT", `/api/admin/biblioteca/modelos/${bibliotecaId}/versoes/${rasc.json().versao}`, novo);
    await req("admin", "POST", `/api/admin/biblioteca/modelos/${bibliotecaId}/versoes/${rasc.json().versao}/publicar`);
    expect((await req("admin", "GET", `/api/biblioteca/modelos/${bibliotecaId}`)).json().categorias[0].itens).toHaveLength(3);
    const catalogo = (await req("inspetor", "GET", "/api/catalogo")).json();
    const nosso = catalogo.modelos.find((m: { nome: string }) => m.nome === "Pré-uso (nosso)");
    expect(nosso.categorias[0].itens).toHaveLength(2);
  });

  it("inspetor não adota", async () => {
    expect((await req("inspetor", "POST", `/api/biblioteca/modelos/${bibliotecaId}/adotar`, { modo: "personalizar" })).statusCode).toBe(403);
  });
});
