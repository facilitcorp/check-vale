import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aplicarRegras, contextoDaInspecao, SEM_RESTRICAO, type Catalogo, type Inspecao, type OperacaoSync, type Resposta, type SyncSaida, type VersaoModelo } from "@checkvale/shared";
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

describe("autocadastro", () => {
  const email = `novo-${randomUUID().slice(0, 8)}@exemplo.com`;

  it("o /saude avisa o app que o autocadastro está ligado", async () => {
    const r = await app.inject({ method: "GET", url: "/api/saude" });
    expect(r.json().autocadastro).toBe(true);
  });

  it("cria conta de inspetor, já devolve a sessão e o login passa a funcionar", async () => {
    const r = await app.inject({ method: "POST", url: "/api/auth/cadastro", payload: { email: ` ${email.toUpperCase()} `, senha: "minha-senha" } });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().usuario).toMatchObject({ email, papel: "inspetor", nome: email.split("@")[0] });
    const eu = await app.inject({ method: "GET", url: "/api/auth/eu", headers: { authorization: `Bearer ${r.json().token}` } });
    expect(eu.json().email).toBe(email);
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, senha: "minha-senha" } });
    expect(login.statusCode).toBe(200);
  });

  it("não cria duas contas com o mesmo e-mail nem troca a senha de quem já existe", async () => {
    const r = await app.inject({ method: "POST", url: "/api/auth/cadastro", payload: { email: "admin@checkvale.dev", senha: "tentativa-1234" } });
    expect(r.statusCode).toBe(409);
    expect(r.json().erro).toBe("email_em_uso");
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "admin@checkvale.dev", senha: "tentativa-1234" } });
    expect(login.statusCode).toBe(401);
  });

  it("ignora papel enviado pelo cliente e recusa senha curta", async () => {
    const r = await app.inject({ method: "POST", url: "/api/auth/cadastro", payload: { email: `x-${email}`, senha: "minha-senha", papel: "admin" } });
    expect(r.json().usuario.papel).toBe("inspetor");
    const curta = await app.inject({ method: "POST", url: "/api/auth/cadastro", payload: { email: `y-${email}`, senha: "1234567" } });
    expect(curta.statusCode).toBe(400);
  });

  it("com AUTOCADASTRO=0 a rota não existe", async () => {
    const desligado = await criarApp(lerConfig({ NODE_ENV: "test", AUTOCADASTRO: "0" }), db, armazenamentoMemoria());
    const r = await desligado.inject({ method: "POST", url: "/api/auth/cadastro", payload: { email: `z-${email}`, senha: "minha-senha" } });
    expect(r.statusCode).toBe(404);
    expect((await desligado.inject({ method: "GET", url: "/api/saude" })).json().autocadastro).toBe(false);
    await desligado.close();
  });
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
    const v = { id: randomUUID(), placa: "abc1d23", codigo: null, tipoVeiculoId: tipo, descricao: "Caminhonete", fabricante: "Toyota", modelo: "Hilux", empresa: null, unidadeId: null, status: "ativo" as const, atributos: {}, demo: false, criadoEm: agora(), atualizadoEm: agora() };
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
    const onibus = veiculos.find((v: { placa: string }) => v.placa === "BVL2E77");
    const evidenciaId = randomUUID();
    const base: Inspecao = {
      id: randomUUID(), modeloId: modelo.id, modeloVersao: modelo.versao,
      unidadeId: catalogo.unidades[0]!.id, areaId: catalogo.areas[0]!.id, atividadeId: catalogo.atividades[0]!.id,
      veiculoId: onibus.id, inspetorId: usuarioId, tipoVeiculoId: onibus.tipoVeiculoId, atributosVeiculo: onibus.atributos, status: "em_andamento", iniciadaEm: agora(), concluidaEm: null, respostas: [],
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
    // Ônibus DEMO: freio pneumático e sem giroflex → o item de giroflex fica fora do índice.
    const aplicaveis = aplicarRegras(modelo, contextoDaInspecao(base)).categorias.flatMap((c) => c.itens).length;
    expect(aplicaveis).toBe(itens.length - 1);
    expect(rows[0]).toEqual({ status: "concluida", indice: Math.round(((aplicaveis - 1) / aplicaveis) * 100), situacao: "apto_com_restricoes" });

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
      atividadeId: catalogo.atividades[0]!.id, veiculoId: randomUUID(), inspetorId, tipoVeiculoId: catalogo.tiposVeiculo[0]!.id, atributosVeiculo: {}, status: "em_andamento", iniciadaEm: agora(), concluidaEm: null,
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

describe("sync por operação", () => {
  const veiculoNovo = (extra: Record<string, unknown> = {}) => ({
    id: randomUUID(), placa: null, codigo: `QA-${randomUUID().slice(0, 8)}`, tipoVeiculoId: catalogo.tiposVeiculo[0]!.id, descricao: "Caminhonete QA", fabricante: "Toyota", modelo: "Hilux",
    empresa: null, unidadeId: null, status: "ativo", atributos: {}, demo: false, criadoEm: agora(), atualizadoEm: agora(), ...extra,
  });
  async function lote(operacoes: Record<string, unknown>[]) {
    const r = await app.inject({ method: "POST", url: "/api/sync", headers: auth(), payload: { dispositivoId, operacoes: operacoes.map((o) => ({ criadaEm: agora(), ...o })) } });
    expect(r.statusCode, r.body).toBe(200);
    return (r.json() as SyncSaida).resultados;
  }
  async function inspecaoBase(): Promise<Inspecao> {
    const veiculos = (await app.inject({ method: "GET", url: "/api/veiculos", headers: auth() })).json().veiculos;
    const onibus = veiculos.find((v: { placa: string }) => v.placa === "BVL2E77");
    const modelo = catalogo.modelos[0]!;
    return {
      id: randomUUID(), modeloId: modelo.id, modeloVersao: modelo.versao, unidadeId: catalogo.unidades[0]!.id, areaId: catalogo.areas[0]!.id,
      atividadeId: catalogo.atividades[0]!.id, veiculoId: onibus.id, inspetorId: usuarioId, tipoVeiculoId: onibus.tipoVeiculoId,
      atributosVeiculo: onibus.atributos, status: "em_andamento", iniciadaEm: agora(), concluidaEm: null, respostas: [],
    };
  }

  it("uma operação inválida no meio do lote é rejeitada sozinha, com item, código e detalhe; as outras gravam", async () => {
    const item = catalogo.modelos[0]!.categorias[0]!.itens[0]!;
    const boa = await inspecaoBase();
    const ruim = await inspecaoBase();
    // NC sem foto: o app de hoje não deixa, mas um app antigo ou alterado pode mandar.
    const ncSemFoto = { itemId: item.id, status: "nao_conforme", observacao: null, naoConformidade: { descricao: "Sem foto", criticidade: "alta" }, evidenciaIds: [], respondidaEm: agora() };
    const evidenciaId = randomUUID();
    const ops = [
      { opId: randomUUID(), tipo: "veiculo.salvar", veiculo: veiculoNovo() },
      { opId: randomUUID(), tipo: "inspecao.salvar", inspecao: boa },
      { opId: randomUUID(), tipo: "inspecao.salvar", inspecao: { ...ruim, respostas: [ncSemFoto] } },
      { opId: randomUUID(), tipo: "veiculo.salvar", veiculo: veiculoNovo() },
      { opId: randomUUID(), tipo: "evidencia.registrar", evidencia: { id: evidenciaId, inspecaoId: boa.id, itemId: item.id, mime: "image/jpeg", bytes: 3, capturadaEm: agora(), url: null } },
    ];
    const r = await lote(ops);
    expect(r.map((x) => x.status)).toEqual(["aplicada", "aplicada", "rejeitada", "aplicada", "aplicada"]);
    expect(r[2]).toMatchObject({
      opId: ops[2]!.opId, codigo: "dados_invalidos", entidade: "inspecao", entidadeId: ruim.id, inspecaoId: ruim.id,
      erro: `Item "${item.titulo}": Foto obrigatória para não conformidade.`,
      detalhes: [{ campo: "inspecao.respostas.0.evidenciaIds", mensagem: "Foto obrigatória para não conformidade.", itemId: item.id }],
    });
    const gravadas = await db.query<{ id: string }>(`SELECT id FROM inspecoes WHERE id = ANY($1)`, [[boa.id, ruim.id]]);
    expect(gravadas.rows.map((x) => x.id)).toEqual([boa.id]);

    // Reenvio do mesmo lote: as gravadas viram "duplicada" e a rejeitada responde igual, sem gravar de novo.
    const de_novo = await lote(ops);
    expect(de_novo.map((x) => x.status)).toEqual(["duplicada", "duplicada", "rejeitada", "duplicada", "duplicada"]);
    expect(de_novo[2]).toEqual(r[2]);
    const reg = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM sync_ops WHERE op_id = $1`, [ops[2]!.opId]);
    expect(reg.rows[0]!.n).toBe(1);
  });

  it("tipo desconhecido e dado que o banco recusa são rejeitados, não travam o lote", async () => {
    const r = await lote([
      { opId: randomUUID(), tipo: "veiculo.apagar", veiculo: { id: randomUUID() } },
      // Unidade inexistente: o banco recusa pela chave estrangeira. Antes virava 500 e o app reenviava para sempre.
      { opId: randomUUID(), tipo: "veiculo.salvar", veiculo: veiculoNovo({ unidadeId: randomUUID() }) },
      { opId: randomUUID(), tipo: "veiculo.salvar", veiculo: veiculoNovo() },
    ]);
    expect(r.map((x) => [x.status, x.codigo])).toEqual([["rejeitada", "dados_invalidos"], ["rejeitada", "recusada_pelo_banco"], ["aplicada", undefined]]);
    expect(r[0]).toMatchObject({ entidade: null, inspecaoId: null });
    expect(r[1]!.erro).toBe("O servidor não aceitou os dados deste registro.");
  });

  it("evidência faltando na conclusão lista todos os itens, não só o primeiro", async () => {
    const base = await inspecaoBase();
    const itens = aplicarRegras(catalogo.modelos[0]!, contextoDaInspecao(base)).categorias.flatMap((c) => c.itens);
    // Força dois itens com foto obrigatória direto na versão publicada (o modelo DEMO não tem).
    const alvo = [itens[0]!.id, itens[1]!.id];
    await db.query(
      `UPDATE modelos_checklist SET categorias = (
         SELECT jsonb_agg(jsonb_set(c, '{itens}', (SELECT jsonb_agg(CASE WHEN i->>'id' = ANY($3) THEN i || '{"evidencia":"foto"}' ELSE i END) FROM jsonb_array_elements(c->'itens') i)))
         FROM jsonb_array_elements(categorias) c)
       WHERE id = $1 AND versao = $2`, [base.modeloId, base.modeloVersao, alvo]);
    try {
      const respostas = itens.map((it) => ({ itemId: it.id, status: "conforme", observacao: null, naoConformidade: null, evidenciaIds: [], respondidaEm: agora() }));
      const [r] = await lote([{ opId: randomUUID(), tipo: "inspecao.salvar", inspecao: { ...base, status: "concluida", concluidaEm: agora(), respostas } }]);
      expect(r).toMatchObject({ status: "rejeitada", codigo: "evidencia_faltando", inspecaoId: base.id });
      expect(r!.detalhes!.map((d) => d.itemId)).toEqual(alvo);
      expect(r!.erro).toMatch(/e mais 1 item/);
    } finally {
      await db.query(
        `UPDATE modelos_checklist SET categorias = (
           SELECT jsonb_agg(jsonb_set(c, '{itens}', (SELECT jsonb_agg(i - 'evidencia') FROM jsonb_array_elements(c->'itens') i)))
           FROM jsonb_array_elements(categorias) c)
         WHERE id = $1 AND versao = $2`, [base.modeloId, base.modeloVersao]);
    }
  });

  it("lote sem dispositivo ou operação sem opId continua 400 (não há como devolver o resultado)", async () => {
    const r = await app.inject({ method: "POST", url: "/api/sync", headers: auth(), payload: { dispositivoId, operacoes: [{ tipo: "veiculo.salvar" }] } });
    expect(r.statusCode).toBe(400);
  });
});

describe("segurança", () => {
  it("responde com cabeçalhos de segurança", async () => {
    const r = await app.inject({ method: "GET", url: "/api/saude" });
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["content-security-policy"]).toContain("default-src 'none'");
  });
});

describe("núcleo configurável (admin)", () => {
  let tokenAdmin: string;
  const adm = () => ({ authorization: `Bearer ${tokenAdmin}` });
  const req = (method: "GET" | "POST" | "PATCH" | "PUT", url: string, payload?: unknown) => app.inject({ method, url, headers: adm(), payload: payload as object });

  beforeAll(async () => {
    const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "admin@checkvale.dev", senha: "senha-teste" } });
    tokenAdmin = r.json().token;
  });

  it("RBAC: inspetor não acessa admin; admin acessa", async () => {
    expect((await app.inject({ method: "GET", url: "/api/admin/unidades", headers: auth() })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/api/admin/modelos", headers: auth(), payload: { nome: "x" } })).statusCode).toBe(403);
    expect((await req("GET", "/api/admin/unidades")).statusCode).toBe(200);
  });

  it("dados de demonstração vêm marcados como DEMO", async () => {
    const u = (await req("GET", "/api/admin/unidades")).json();
    expect(u.every((x: { demo: boolean }) => x.demo)).toBe(true);
  });

  it("cadastra operação e desativa (sem apagar); inativa some do catálogo do app", async () => {
    const r = await req("POST", "/api/admin/unidades", { nome: "Unidade Teste", uf: "MG", ativo: true });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().demo).toBe(false);
    const id = r.json().id;
    expect((await req("PATCH", `/api/admin/unidades/${id}`, { ativo: false })).json().ativo).toBe(false);
    const cat = (await app.inject({ method: "GET", url: "/api/catalogo", headers: auth() })).json() as Catalogo;
    expect(cat.unidades.some((u) => u.id === id)).toBe(false);
  });

  it("atributo: código imutável e lista exige opções; veículo valida atributos", async () => {
    expect((await req("POST", "/api/admin/atributos", { codigo: "eixos", nome: "Eixos", tipo: "lista", opcoes: [], unidadeMedida: null, tipoVeiculoIds: [], obrigatorio: false, ordem: 9, ativo: true })).statusCode).toBe(400);
    const a = await req("POST", "/api/admin/atributos", { codigo: "eixos", nome: "Eixos", tipo: "numero", opcoes: [], unidadeMedida: null, tipoVeiculoIds: [], obrigatorio: false, ordem: 9, ativo: true });
    expect(a.statusCode, a.body).toBe(201);
    expect((await req("PATCH", `/api/admin/atributos/${a.json().id}`, { codigo: "outro" })).statusCode).toBe(400);
    const tipo = catalogo.tiposVeiculo[0]!.id;
    const base = { placa: "XYZ-9A87", codigo: null, tipoVeiculoId: tipo, fabricante: "Scania", modelo: "R450", descricao: "", empresa: "Transportes Teste", unidadeId: null, status: "ativo" };
    const ruim = await req("POST", "/api/admin/veiculos", { ...base, atributos: { eixos: "três" } });
    expect(ruim.statusCode).toBe(400);
    expect(ruim.json().erros).toContain("Eixos deve ser número.");
    const ok = await req("POST", "/api/admin/veiculos", { ...base, atributos: { eixos: 3, tipo_freio: "Pneumático" } });
    expect(ok.statusCode, ok.body).toBe(201);
    expect(ok.json()).toMatchObject({ placa: "XYZ9A87", empresa: "Transportes Teste", atributos: { eixos: 3 } });
  });

  it("modelo: rascunho não chega ao app; publicar valida; versão publicada é imutável; nova versão arquiva a anterior", async () => {
    const criado = (await req("POST", "/api/admin/modelos", { nome: "Checklist Teste" })).json() as VersaoModelo;
    expect(criado).toMatchObject({ versao: 1, status: "rascunho" });

    const vazia = await req("POST", `/api/admin/modelos/${criado.id}/versoes/1/publicar`);
    expect(vazia.statusCode).toBe(422);
    expect(vazia.json().erros).toContain("O modelo não tem categorias.");

    const item = (codigo: string, aplicavel = SEM_RESTRICAO) => ({ id: randomUUID(), codigo, titulo: codigo, descricao: "", ordem: 1, permiteNaoAplica: true, criticidadeSugerida: null, aplicavel });
    const tipoOnibus = catalogo.tiposVeiculo.find((t) => t.codigo === "onibus")!.id;
    const corpo = {
      nome: "Checklist Teste",
      aplicavel: { ...SEM_RESTRICAO, tipoVeiculoIds: [tipoOnibus] },
      categorias: [{ id: randomUUID(), codigo: "geral", nome: "Geral", icone: "", ordem: 1, aplicavel: SEM_RESTRICAO, itens: [
        item("pneu"),
        item("ar", { ...SEM_RESTRICAO, atributos: [{ atributo: "tipo_freio", operador: "igual" as const, valor: "Pneumático" }] }),
      ] }],
    };
    expect((await req("PUT", `/api/admin/modelos/${criado.id}/versoes/1`, corpo)).statusCode).toBe(200);

    let cat = (await app.inject({ method: "GET", url: "/api/catalogo", headers: auth() })).json() as Catalogo;
    expect(cat.modelos.some((m) => m.id === criado.id)).toBe(false);

    const prev = (await req("POST", `/api/admin/modelos/${criado.id}/versoes/1/previa`, { tipoVeiculoId: tipoOnibus, areaId: "", atividadeId: "", atributos: { tipo_freio: "Hidráulico" } })).json();
    expect(prev.categorias[0].itens.map((i: { codigo: string }) => i.codigo)).toEqual(["pneu"]);

    expect((await req("POST", `/api/admin/modelos/${criado.id}/versoes/1/publicar`)).json().status).toBe("publicada");
    expect((await req("PUT", `/api/admin/modelos/${criado.id}/versoes/1`, corpo)).statusCode).toBe(409);

    cat = (await app.inject({ method: "GET", url: "/api/catalogo", headers: auth() })).json() as Catalogo;
    expect(cat.modelos.find((m) => m.id === criado.id)?.versao).toBe(1);

    const v2 = (await req("POST", `/api/admin/modelos/${criado.id}/rascunho`)).json() as VersaoModelo;
    expect(v2).toMatchObject({ versao: 2, status: "rascunho" });
    expect(v2.categorias[0]!.itens.map((i) => i.id)).toEqual(corpo.categorias[0]!.itens.map((i) => i.id));
    expect((await req("POST", `/api/admin/modelos/${criado.id}/rascunho`)).json().versao).toBe(2); // idempotente
    await req("POST", `/api/admin/modelos/${criado.id}/versoes/2/publicar`);

    const lista = (await req("GET", "/api/admin/modelos")).json();
    expect(lista.find((m: { id: string }) => m.id === criado.id).versoes.map((v: { status: string }) => v.status)).toEqual(["publicada", "arquivada"]);
    cat = (await app.inject({ method: "GET", url: "/api/catalogo", headers: auth() })).json() as Catalogo;
    expect(cat.modelos.find((m) => m.id === criado.id)?.versao).toBe(2);

    // Aparelho novo com inspeção aberta na V1: o inspetor busca a versão exata, mesmo arquivada.
    const antiga = await app.inject({ method: "GET", url: `/api/catalogo/modelos/${criado.id}/versoes/1`, headers: auth() });
    expect(antiga.statusCode, antiga.body).toBe(200);
    expect(antiga.json()).toMatchObject({ id: criado.id, versao: 1 });
    expect(antiga.json().categorias[0].itens.map((i: { codigo: string }) => i.codigo)).toEqual(["pneu", "ar"]);
    await req("POST", `/api/admin/modelos/${criado.id}/rascunho`);
    expect((await app.inject({ method: "GET", url: `/api/catalogo/modelos/${criado.id}/versoes/3`, headers: auth() })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: `/api/catalogo/modelos/${criado.id}/versoes/1` })).statusCode).toBe(401);
  });

  it("evidência do item: editor grava, catálogo entrega e a conclusão cobra foto/observação", async () => {
    const criado = (await req("POST", "/api/admin/modelos", { nome: "Checklist Evidência" })).json() as VersaoModelo;
    const item = (codigo: string, evidencia?: string) => ({ id: randomUUID(), codigo, titulo: codigo, descricao: "", ordem: 1, permiteNaoAplica: true, criticidadeSugerida: null, aplicavel: SEM_RESTRICAO, ...(evidencia ? { evidencia } : {}) });
    const tipoVan = catalogo.tiposVeiculo.find((t) => t.codigo === "van")!.id;
    const [foto, obs, antigo] = [item("extintor", "foto"), item("hodometro", "observacao"), item("buzina")];
    const corpo = {
      nome: "Checklist Evidência",
      aplicavel: { ...SEM_RESTRICAO, tipoVeiculoIds: [tipoVan] },
      categorias: [{ id: randomUUID(), codigo: "geral", nome: "Geral", icone: "", ordem: 1, aplicavel: SEM_RESTRICAO, itens: [foto, obs, antigo] }],
    };
    expect((await req("PUT", `/api/admin/modelos/${criado.id}/versoes/1`, corpo)).statusCode).toBe(200);
    expect((await req("POST", `/api/admin/modelos/${criado.id}/versoes/1/publicar`)).json().status).toBe("publicada");
    const cat = (await app.inject({ method: "GET", url: "/api/catalogo", headers: auth() })).json() as Catalogo;
    const itens = cat.modelos.find((m) => m.id === criado.id)!.categorias[0]!.itens;
    expect(itens.map((i) => i.evidencia)).toEqual(["foto", "observacao", undefined]);

    const van = (await app.inject({ method: "GET", url: "/api/veiculos", headers: auth() })).json().veiculos.find((v: { placa: string }) => v.placa === "JHK8D91");
    const conforme = (itemId: string, extra: Partial<Resposta> = {}): Resposta => ({ itemId, status: "conforme", observacao: null, naoConformidade: null, evidenciaIds: [], respondidaEm: agora(), ...extra });
    const inspecao = (respostas: Resposta[]): Inspecao => ({
      id: randomUUID(), modeloId: criado.id, modeloVersao: 1, unidadeId: catalogo.unidades[0]!.id, areaId: catalogo.areas[0]!.id, atividadeId: catalogo.atividades[0]!.id,
      veiculoId: van.id, inspetorId: usuarioId, tipoVeiculoId: van.tipoVeiculoId, atributosVeiculo: van.atributos, status: "concluida", iniciadaEm: agora(), concluidaEm: agora(), respostas,
    });
    const s = await sync([
      { opId: randomUUID(), tipo: "inspecao.salvar", inspecao: inspecao([conforme(foto.id), conforme(obs.id, { observacao: "12.345 km" }), conforme(antigo.id)]) },
      { opId: randomUUID(), tipo: "inspecao.salvar", inspecao: inspecao([conforme(foto.id, { evidenciaIds: [randomUUID()] }), conforme(obs.id), conforme(antigo.id)]) },
      { opId: randomUUID(), tipo: "inspecao.salvar", inspecao: inspecao([conforme(foto.id, { evidenciaIds: [randomUUID()] }), conforme(obs.id, { observacao: "12.345 km" }), conforme(antigo.id)]) },
      // Em andamento não cobra: o inspetor ainda está preenchendo.
      { opId: randomUUID(), tipo: "inspecao.salvar", inspecao: { ...inspecao([conforme(foto.id)]), status: "em_andamento", concluidaEm: null } },
    ]);
    expect(s.resultados.map((r) => r.status)).toEqual(["rejeitada", "rejeitada", "aplicada", "aplicada"]);
    expect(s.resultados[0]!.erro).toMatch(/extintor.*foto/);
    expect(s.resultados[1]!.erro).toMatch(/hodometro.*observação/);
  });

  it("usuários: admin cria inspetor que consegue entrar; não pode se auto-desativar", async () => {
    const r = await req("POST", "/api/admin/usuarios", { nome: "Motorista Novo", email: "novo@empresa.com", papel: "inspetor", ativo: true, senha: "senha-forte-1" });
    expect(r.statusCode, r.body).toBe(201);
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "novo@empresa.com", senha: "senha-forte-1" } });
    expect(login.statusCode).toBe(200);
    const eu = (await req("GET", "/api/auth/eu")).json();
    expect((await req("PATCH", `/api/admin/usuarios/${eu.id}`, { ativo: false })).statusCode).toBe(400);
  });
});

describe("subida", () => {
  it("migrar e semear de novo não fazem nada (idempotentes)", async () => {
    const antes = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM usuarios`);
    await migrar(db);
    expect(await semearDemo(db, "outra-senha")).toBe(false);
    const depois = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM usuarios`);
    expect(depois.rows[0]!.n).toBe(antes.rows[0]!.n);
  });

  it("saúde informa a versão e não vai para cache", async () => {
    const r = await app.inject({ method: "GET", url: "/api/saude" });
    expect(r.json()).toMatchObject({ ok: true, versao: expect.any(String) });
    expect(r.headers["cache-control"]).toBe("no-store");
  });

  it("IP do cliente vem do último salto (o do proxy), não do X-Forwarded-For forjado", async () => {
    await app.inject({ method: "POST", url: "/api/auth/login", headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" }, payload: { email: "ninguem@checkvale.dev", senha: "x" } });
    const { rows } = await db.query<{ ip: string }>(`SELECT ip FROM auditoria WHERE acao = 'login_falhou' ORDER BY id DESC LIMIT 1`);
    expect(rows[0]!.ip).toBe("203.0.113.9");
  });
});
