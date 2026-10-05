import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Catalogo, Inspecao, OperacaoSync, Resposta, SyncSaida } from "@checkvale/shared";
import { criarApp } from "./app";
import { armazenamentoMemoria } from "./armazenamento";
import { lerConfig } from "./config";
import { abrirDb, migrar, type Db } from "./db";
import { semearDemo } from "./semente/semear";

let app: FastifyInstance;
let db: Db;
let token: string;
let usuarioId: string;
let catalogo: Catalogo;
const dispositivoId = randomUUID();
const agora = () => new Date().toISOString();
const auth = () => ({ authorization: `Bearer ${token}` });

type SemData<T> = T extends unknown ? Omit<T, "criadaEm"> : never;
async function sync(operacoes: SemData<OperacaoSync>[]): Promise<SyncSaida> {
  const r = await app.inject({
    method: "POST", url: "/api/sync", headers: auth(),
    payload: { dispositivoId, operacoes: operacoes.map((o) => ({ ...o, criadaEm: agora() })) },
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json();
}

beforeAll(async () => {
  db = await abrirDb({ databaseUrl: null, dataDir: null });
  await migrar(db);
  await semearDemo(db, "senha-teste");
  app = await criarApp(lerConfig({ NODE_ENV: "test" }), db, armazenamentoMemoria());
});
afterAll(async () => {
  await app.close();
  await db.fechar();
});

describe("auth", () => {
  it("rejeita senha errada sem revelar se o e-mail existe", async () => {
    const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "inspetor@checkvale.dev", senha: "x" } });
    expect(r.statusCode).toBe(401);
    expect(r.json().erro).toBe("credenciais_invalidas");
    const r2 = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "nao@existe.dev", senha: "x" } });
    expect(r2.json()).toEqual(r.json());
  });

  it("faz login (e-mail sem diferenciar maiúsculas) e devolve o usuário", async () => {
    const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: " Inspetor@CheckVale.dev ", senha: "senha-teste" } });
    expect(r.statusCode, r.body).toBe(200);
    token = r.json().token;
    usuarioId = r.json().usuario.id;
    const eu = await app.inject({ method: "GET", url: "/api/auth/eu", headers: auth() });
    expect(eu.json().email).toBe("inspetor@checkvale.dev");
  });

  it("rotas privadas exigem token", async () => {
    const r = await app.inject({ method: "GET", url: "/api/catalogo" });
    expect(r.statusCode).toBe(401);
  });
});

describe("catálogo e veículos", () => {
  it("entrega catálogo com o modelo padrão e responde 304 com ETag", async () => {
    const r = await app.inject({ method: "GET", url: "/api/catalogo", headers: auth() });
    expect(r.statusCode).toBe(200);
    catalogo = r.json();
    expect(catalogo.modelos).toHaveLength(1);
    expect(catalogo.modelos[0]!.categorias).toHaveLength(10);
    const r2 = await app.inject({ method: "GET", url: "/api/catalogo", headers: { ...auth(), "if-none-match": r.headers.etag as string } });
    expect(r2.statusCode).toBe(304);
  });

  it("cadastra veículo pela fila e rejeita placa duplicada", async () => {
    const tipo = catalogo.tiposVeiculo[0]!.id;
    const v = { id: randomUUID(), placa: "abc1d23", codigo: null, tipoVeiculoId: tipo, descricao: "Caminhonete", marcaModelo: "Toyota Hilux", unidadeId: null, criadoEm: agora(), atualizadoEm: agora() };
    const s = await sync([{ opId: randomUUID(), tipo: "veiculo.salvar", veiculo: v }]);
    expect(s.resultados[0]!.status).toBe("aplicada");
    const dup = await sync([{ opId: randomUUID(), tipo: "veiculo.salvar", veiculo: { ...v, id: randomUUID(), placa: "ABC1D23" } }]);
    expect(dup.resultados[0]).toMatchObject({ status: "rejeitada" });
    const lista = await app.inject({ method: "GET", url: "/api/veiculos", headers: auth() });
    expect(lista.json().veiculos.some((x: { placa: string }) => x.placa === "ABC1D23")).toBe(true);
  });
});

describe("inspeção ponta a ponta via sync", () => {
  it("salva, faz merge, recebe foto, conclui e gera PDF", async () => {
    const modelo = catalogo.modelos[0]!;
    const itens = modelo.categorias.flatMap((c) => c.itens);
    const veiculos = (await app.inject({ method: "GET", url: "/api/veiculos", headers: auth() })).json().veiculos;
    const evidenciaId = randomUUID();
    const base: Inspecao = {
      id: randomUUID(), modeloId: modelo.id, modeloVersao: modelo.versao,
      unidadeId: catalogo.unidades[0]!.id, areaId: catalogo.areas[0]!.id, atividadeId: catalogo.atividades[0]!.id,
      veiculoId: veiculos[0].id, inspetorId: usuarioId, status: "em_andamento", iniciadaEm: agora(), concluidaEm: null, respostas: [],
    };
    const nc: Resposta = {
      itemId: itens[0]!.id, status: "nao_conforme", observacao: null,
      naoConformidade: { descricao: "Lanterna traseira direita com defeito.", criticidade: "alta" },
      evidenciaIds: [evidenciaId], respondidaEm: agora(),
    };

    // 1) começa offline com uma NC
    const op1 = randomUUID();
    let s = await sync([
      { opId: op1, tipo: "inspecao.salvar", inspecao: { ...base, respostas: [nc] } },
      { opId: randomUUID(), tipo: "evidencia.registrar", evidencia: { id: evidenciaId, inspecaoId: base.id, itemId: nc.itemId, mime: "image/jpeg", bytes: 3, capturadaEm: agora(), url: null } },
    ]);
    expect(s.resultados.map((r) => r.status)).toEqual(["aplicada", "aplicada"]);

    // 2) reenviar a mesma operação é seguro
    s = await sync([{ opId: op1, tipo: "inspecao.salvar", inspecao: { ...base, respostas: [nc] } }]);
    expect(s.resultados[0]!.status).toBe("duplicada");

    // 3) foto sobe depois
    const put = await app.inject({ method: "PUT", url: `/api/evidencias/${evidenciaId}/arquivo`, headers: { ...auth(), "content-type": "image/jpeg" }, payload: Buffer.from([1, 2, 3]) });
    expect(put.statusCode, put.body).toBe(200);
    const get = await app.inject({ method: "GET", url: put.json().url, headers: auth() });
    expect(get.rawPayload).toEqual(Buffer.from([1, 2, 3]));

    // 4) resposta antiga não sobrescreve a nova
    const velha: Resposta = { ...nc, status: "conforme", naoConformidade: null, evidenciaIds: [], respondidaEm: "2020-01-01T00:00:00.000Z" };
    await sync([{ opId: randomUUID(), tipo: "inspecao.salvar", inspecao: { ...base, respostas: [velha] } }]);

    // 5) completa o resto como conforme e conclui
    const resto: Resposta[] = itens.slice(1).map((it) => ({ itemId: it.id, status: "conforme", observacao: null, naoConformidade: null, evidenciaIds: [], respondidaEm: agora() }));
    s = await sync([{ opId: randomUUID(), tipo: "inspecao.salvar", inspecao: { ...base, status: "concluida", concluidaEm: agora(), respostas: [nc, ...resto] } }]);
    expect(s.resultados[0]!.status).toBe("aplicada");

    const { rows } = await db.query<{ status: string; indice: number; situacao: string }>(`SELECT status, indice, situacao FROM inspecoes WHERE id = $1`, [base.id]);
    expect(rows[0]).toEqual({ status: "concluida", indice: Math.round(((itens.length - 1) / itens.length) * 100), situacao: "apto_com_restricoes" });

    // 6) concluída não reabre
    await sync([{ opId: randomUUID(), tipo: "inspecao.salvar", inspecao: { ...base, respostas: [] } }]);
    const lista = (await app.inject({ method: "GET", url: "/api/inspecoes", headers: auth() })).json().inspecoes as Inspecao[];
    const salva = lista.find((i) => i.id === base.id)!;
    expect(salva.status).toBe("concluida");
    expect(salva.respostas.find((r) => r.itemId === nc.itemId)!.status).toBe("nao_conforme");

    // 7) PDF
    const pdf = await app.inject({ method: "GET", url: `/api/inspecoes/${base.id}/relatorio.pdf`, headers: auth() });
    expect(pdf.statusCode, pdf.body).toBe(200);
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe("%PDF");

    // 8) trilha de auditoria registrou
    const aud = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM auditoria WHERE entidade_id = $1`, [base.id]);
    expect(aud.rows[0]!.n).toBeGreaterThan(0);
  });

  it("rejeita inspeção em nome de outro inspetor e item fora do modelo", async () => {
    const modelo = catalogo.modelos[0]!;
    const insp = (inspetorId: string, itemId: string): Inspecao => ({
      id: randomUUID(), modeloId: modelo.id, modeloVersao: 1, unidadeId: catalogo.unidades[0]!.id, areaId: catalogo.areas[0]!.id,
      atividadeId: catalogo.atividades[0]!.id, veiculoId: randomUUID(), inspetorId, status: "em_andamento", iniciadaEm: agora(), concluidaEm: null,
      respostas: [{ itemId, status: "conforme", observacao: null, naoConformidade: null, evidenciaIds: [], respondidaEm: agora() }],
    });
    const s = await sync([
      { opId: randomUUID(), tipo: "inspecao.salvar", inspecao: insp(randomUUID(), modelo.categorias[0]!.itens[0]!.id) },
      { opId: randomUUID(), tipo: "inspecao.salvar", inspecao: insp(usuarioId, randomUUID()) },
      { opId: randomUUID(), tipo: "inspecao.salvar", inspecao: insp(usuarioId, modelo.categorias[0]!.itens[0]!.id) },
    ]);
    expect(s.resultados.map((r) => r.status)).toEqual(["rejeitada", "rejeitada", "rejeitada"]);
    expect(s.resultados[2]!.erro).toMatch(/veículo/);
  });
});

describe("segurança", () => {
  it("responde com cabeçalhos de segurança", async () => {
    const r = await app.inject({ method: "GET", url: "/api/saude" });
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["content-security-policy"]).toContain("default-src 'none'");
  });
});
