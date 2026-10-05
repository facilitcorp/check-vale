import { describe, expect, it } from "vitest";
import type { ModeloChecklist } from "./dominio";
import { escolherModelo } from "./modelo";

const m = (id: string, f: Partial<ModeloChecklist> = {}): ModeloChecklist => ({
  id, nome: id, versao: 1, tipoVeiculoIds: [], areaIds: [], atividadeIds: [], categorias: [], ...f,
});
const ctx = { tipoVeiculoId: "onibus", areaId: "mina", atividadeId: "pessoas" };

describe("escolherModelo", () => {
  it("usa o genérico quando não há específico", () => {
    expect(escolherModelo([m("geral"), m("leve", { tipoVeiculoIds: ["leve"] })], ctx)?.id).toBe("geral");
  });
  it("prefere o mais específico", () => {
    const r = escolherModelo([m("geral"), m("onibus", { tipoVeiculoIds: ["onibus"] }), m("onibus-mina", { tipoVeiculoIds: ["onibus"], areaIds: ["mina"] })], ctx);
    expect(r?.id).toBe("onibus-mina");
  });
  it("sem nenhum compatível devolve null", () => {
    expect(escolherModelo([m("leve", { tipoVeiculoIds: ["leve"] })], ctx)).toBeNull();
  });
});
