import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Inspecao, OperacaoSync, SyncEntrada } from "@checkvale/shared";
import { banco } from "./banco";
import { repositorioInspecao, repositorioVeiculo } from "./repositorio";
import { reenviarRejeitadas } from "./fila";
import { sincronizar } from "./sincronizacao";

const uid = () => crypto.randomUUID();
const ctx = { modeloId: uid(), modeloVersao: 1, unidadeId: uid(), areaId: uid(), atividadeId: uid(), veiculoId: uid(), inspetorId: uid(), tipoVeiculoId: uid(), atributosVeiculo: {} };

/**
 * Servidor falso: aplica tudo, guarda o que recebeu. Com `invalida`, imita a API
 * que valida o lote inteiro: uma operação inválida dá 400 para o lote todo.
 */
function servidorFalso(invalida?: (op: OperacaoSync) => string | null, inspecoesDoServidor: Inspecao[] = []) {
  const recebidas: OperacaoSync[] = [];
  const lotes: number[] = [];
  const fotos: string[] = [];
  let online = true;
  const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
    if (!online) throw new TypeError("Failed to fetch");
    const json = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
    if (url === "/api/sync") {
      const e = JSON.parse(init!.body as string) as SyncEntrada;
      lotes.push(e.operacoes.length);
      const erros = e.operacoes.flatMap((o, n) => (invalida?.(o) ? [`operacoes.${n}.inspecao.respostas.0.evidenciaIds: ${invalida(o)}`] : []));
      if (erros.length) return new Response(JSON.stringify({ erro: "dados_invalidos", mensagem: erros.join("; ") }), { status: 400, headers: { "content-type": "application/json" } });
      recebidas.push(...e.operacoes);
      return json({ resultados: e.operacoes.map((o) => ({ opId: o.opId, status: "aplicada", erro: null })), servidorEm: new Date().toISOString() });
    }
    if (url.startsWith("/api/evidencias/")) {
      fotos.push(url);
      return json({ url: url });
    }
    if (url.startsWith("/api/catalogo")) return json({ versao: "1", unidades: [], areas: [], atividades: [], tiposVeiculo: [], modelos: [] });
    if (url.startsWith("/api/veiculos")) return json({ veiculos: [], servidorEm: new Date().toISOString() });
    if (url.startsWith("/api/inspecoes")) return json({ inspecoes: inspecoesDoServidor, servidorEm: new Date().toISOString() });
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchFalso);
  return { recebidas, lotes, fotos, fetchFalso, setOnline: (v: boolean) => (online = v) };
}

beforeEach(async () => {
  await Promise.all(banco.tables.map((t) => t.clear()));
});

describe("repositório + fila", () => {
  it("várias respostas antes de sincronizar viram UM snapshot na fila", async () => {
    const i = await repositorioInspecao.criar(ctx);
    for (let n = 0; n < 5; n++)
      await repositorioInspecao.salvarResposta(i.id, { itemId: uid(), status: "conforme", observacao: null, naoConformidade: null, evidenciaIds: [] });
    const fila = await banco.fila.toArray();
    expect(fila).toHaveLength(1);
    expect(fila[0]!.op.tipo === "inspecao.salvar" && fila[0]!.op.inspecao.respostas).toHaveLength(5);
  });

  it("não conformidade sem foto é recusada já no aparelho", async () => {
    const i = await repositorioInspecao.criar(ctx);
    await expect(
      repositorioInspecao.salvarResposta(i.id, { itemId: uid(), status: "nao_conforme", observacao: null, naoConformidade: { descricao: "x", criticidade: "alta" }, evidenciaIds: [] }),
    ).rejects.toThrow(/Foto obrigatória/);
  });

  it("placa repetida é recusada no aparelho", async () => {
    await repositorioVeiculo.salvar({ placa: "abc-1d23", codigo: null, tipoVeiculoId: uid(), descricao: "Van", fabricante: "", modelo: "", empresa: null, status: "ativo", atributos: {}, unidadeId: null });
    await expect(repositorioVeiculo.salvar({ placa: "ABC1D23", codigo: null, tipoVeiculoId: uid(), descricao: "Van", fabricante: "", modelo: "", empresa: null, status: "ativo", atributos: {}, unidadeId: null })).rejects.toThrow(/já cadastrada/);
  });
});

describe("sincronização", () => {
  it("offline guarda tudo; com rede envia na ordem e sobe a foto", async () => {
    const srv = servidorFalso();
    srv.setOnline(false);
    const i = await repositorioInspecao.criar(ctx);
    const foto = await repositorioInspecao.adicionarEvidencia(i.id, uid(), new Blob(["x"], { type: "image/jpeg" }));
    await sincronizar();
    expect(await banco.fila.count()).toBe(2);
    expect((await banco.fila.toArray()).every((o) => o.estado === "pendente")).toBe(true);

    srv.setOnline(true);
    await sincronizar();
    expect(srv.recebidas.map((o) => o.tipo)).toEqual(["inspecao.salvar", "evidencia.registrar"]);
    expect(await banco.fila.count()).toBe(0);
    expect(srv.fotos).toEqual([`/api/evidencias/${foto.id}/arquivo`]);
    expect((await banco.evidencias.get(foto.id))!.enviada).toBe(true);
  });

  it("reenvio após falha usa o mesmo opId (idempotência)", async () => {
    const srv = servidorFalso();
    await repositorioInspecao.criar(ctx);
    const opId = (await banco.fila.toArray())[0]!.op.opId;
    srv.fetchFalso.mockImplementationOnce(async () => {
      throw new TypeError("Failed to fetch");
    });
    await sincronizar();
    expect((await banco.fila.toArray())[0]!.op.opId).toBe(opId);
    await sincronizar();
    expect(srv.recebidas.map((o) => o.opId)).toEqual([opId]);
  });
});

describe("operação recusada pelo servidor", () => {
  // A 2ª de 3 inspeções é inválida para o servidor (regra mais nova que a do app).
  async function tresInspecoes() {
    const [a, b, c] = [await repositorioInspecao.criar(ctx), await repositorioInspecao.criar(ctx), await repositorioInspecao.criar(ctx)];
    const ruim = (o: OperacaoSync) => (o.tipo === "inspecao.salvar" && o.inspecao.id === b.id ? "Foto obrigatória para não conformidade." : null);
    return { a, b, c, ruim };
  }

  it("400 no lote: as válidas sobem, só a inválida fica recusada, e a fila não trava", async () => {
    const { a, b, c, ruim } = await tresInspecoes();
    const srv = servidorFalso(ruim);
    await sincronizar();
    expect(srv.recebidas.map((o) => o.tipo === "inspecao.salvar" && o.inspecao.id)).toEqual([a.id, c.id]);
    const fila = await banco.fila.toArray();
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ estado: "rejeitada", alvo: `inspecao:${b.id}`, erro: "Foto obrigatória para não conformidade." });

    // Rodadas seguintes não reenviam a recusada: nada de laço.
    const chamadas = srv.lotes.length;
    await sincronizar();
    expect(srv.lotes.length).toBe(chamadas);
  });

  it("a cópia local da inspeção recusada não é sobrescrita pela do servidor", async () => {
    const i = await repositorioInspecao.criar(ctx);
    await repositorioInspecao.salvarResposta(i.id, { itemId: uid(), status: "conforme", observacao: "só no aparelho", naoConformidade: null, evidenciaIds: [] });
    await banco.fila.toCollection().modify({ estado: "rejeitada", erro: "Recusada." });
    servidorFalso(undefined, [{ ...(await banco.inspecoes.get(i.id))!, respostas: [] }]);
    await sincronizar();
    expect((await banco.inspecoes.get(i.id))!.respostas).toHaveLength(1);
  });

  it("salvar de novo a inspeção recusada troca a recusa pelo snapshot corrigido", async () => {
    const { b, ruim } = await tresInspecoes();
    servidorFalso(ruim);
    await sincronizar();
    const srv = servidorFalso();
    await repositorioInspecao.salvarResposta(b.id, { itemId: uid(), status: "conforme", observacao: null, naoConformidade: null, evidenciaIds: [] });
    expect((await banco.fila.toArray()).map((o) => o.estado)).toEqual(["pendente"]);
    await sincronizar();
    expect(await banco.fila.count()).toBe(0);
    expect(srv.recebidas.map((o) => o.tipo === "inspecao.salvar" && o.inspecao.id)).toEqual([b.id]);
  });

  it("'Tentar agora' devolve a recusada à fila", async () => {
    const { b, ruim } = await tresInspecoes();
    servidorFalso(ruim);
    await sincronizar();
    const srv = servidorFalso(); // ex.: servidor voltou a aceitar
    await reenviarRejeitadas();
    await sincronizar();
    expect(await banco.fila.count()).toBe(0);
    expect(srv.recebidas.map((o) => o.tipo === "inspecao.salvar" && o.inspecao.id)).toEqual([b.id]);
  });
});

describe("versões de modelo no aparelho", () => {
  it("guarda versões antigas: inspeção da v1 abre depois que a v2 é publicada", async () => {
    const { banco: b } = await import("./banco");
    const modelo = (versao: number) => ({ id: "m1", nome: "M", versao, aplicavel: { tipoVeiculoIds: [], areaIds: [], atividadeIds: [], atributos: [] }, categorias: [] });
    for (const v of [1, 2]) {
      vi.stubGlobal("fetch", vi.fn(async (url: string) => {
        const corpo = url.startsWith("/api/catalogo")
          ? { versao: String(v), unidades: [], areas: [], atividades: [], tiposVeiculo: [], atributos: [], modelos: [modelo(v)] }
          : url.startsWith("/api/veiculos") ? { veiculos: [], servidorEm: new Date().toISOString() } : { inspecoes: [], servidorEm: new Date().toISOString() };
        return new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
      }));
      await sincronizar();
    }
    expect((await b.modelos.toArray()).map((m) => m.versao).sort()).toEqual([1, 2]);
  });

  it("aparelho novo baixa a versão exata da inspeção, mesmo que o catálogo já esteja na v2", async () => {
    const modelo = (versao: number) => ({ id: ctx.modeloId, nome: "M", versao, aplicavel: { tipoVeiculoIds: [], areaIds: [], atividadeIds: [], atributos: [] }, categorias: [] });
    const doServidor = { ...ctx, id: uid(), status: "em_andamento", respostas: [], iniciadaEm: new Date().toISOString() };
    const pedidos: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      pedidos.push(url);
      const json = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
      if (url === `/api/catalogo/modelos/${ctx.modeloId}/versoes/1`) return json(modelo(1));
      if (url.startsWith("/api/catalogo")) return json({ versao: "2", unidades: [], areas: [], atividades: [], tiposVeiculo: [], atributos: [], modelos: [modelo(2)] });
      if (url.startsWith("/api/veiculos")) return json({ veiculos: [], servidorEm: new Date().toISOString() });
      if (url.startsWith("/api/inspecoes")) return json({ inspecoes: [doServidor], servidorEm: new Date().toISOString() });
      return new Response("{}", { status: 404 });
    }));
    await sincronizar();
    expect((await banco.modelos.toArray()).map((m) => m.chave).sort()).toEqual([`${ctx.modeloId}@1`, `${ctx.modeloId}@2`].sort());
    // Já guardada: a próxima rodada não pede de novo.
    pedidos.length = 0;
    await sincronizar();
    expect(pedidos.filter((u) => u.includes("/versoes/"))).toEqual([]);
  });
});
