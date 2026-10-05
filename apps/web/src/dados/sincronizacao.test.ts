import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OperacaoSync, SyncEntrada } from "@checkvale/shared";
import { banco } from "./banco";
import { repositorioInspecao, repositorioVeiculo } from "./repositorio";
import { sincronizar } from "./sincronizacao";

const uid = () => crypto.randomUUID();
const ctx = { modeloId: uid(), modeloVersao: 1, unidadeId: uid(), areaId: uid(), atividadeId: uid(), veiculoId: uid(), inspetorId: uid() };

/** Servidor falso: aplica tudo, guarda o que recebeu. */
function servidorFalso() {
  const recebidas: OperacaoSync[] = [];
  const fotos: string[] = [];
  let online = true;
  const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
    if (!online) throw new TypeError("Failed to fetch");
    const json = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
    if (url === "/api/sync") {
      const e = JSON.parse(init!.body as string) as SyncEntrada;
      recebidas.push(...e.operacoes);
      return json({ resultados: e.operacoes.map((o) => ({ opId: o.opId, status: "aplicada", erro: null })), servidorEm: new Date().toISOString() });
    }
    if (url.startsWith("/api/evidencias/")) {
      fotos.push(url);
      return json({ url: url });
    }
    if (url.startsWith("/api/catalogo")) return json({ versao: "1", unidades: [], areas: [], atividades: [], tiposVeiculo: [], modelos: [] });
    if (url.startsWith("/api/veiculos")) return json({ veiculos: [], servidorEm: new Date().toISOString() });
    if (url.startsWith("/api/inspecoes")) return json({ inspecoes: [], servidorEm: new Date().toISOString() });
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchFalso);
  return { recebidas, fotos, fetchFalso, setOnline: (v: boolean) => (online = v) };
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
    await repositorioVeiculo.salvar({ placa: "abc-1d23", codigo: null, tipoVeiculoId: uid(), descricao: "Van", marcaModelo: "", unidadeId: null });
    await expect(repositorioVeiculo.salvar({ placa: "ABC1D23", codigo: null, tipoVeiculoId: uid(), descricao: "Van", marcaModelo: "", unidadeId: null })).rejects.toThrow(/já cadastrada/);
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
