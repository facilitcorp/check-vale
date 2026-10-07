import { describe, expect, it } from "vitest";
import { SEM_RESTRICAO, type CondicaoAtributo, type RegraAplicabilidade } from "./dominio";
import { modelosAmbiguos, regrasAmbiguas } from "./regras";

const r = (p: Partial<RegraAplicabilidade>): RegraAplicabilidade => ({ ...SEM_RESTRICAO, ...p });
const c = (atributo: string, operador: CondicaoAtributo["operador"], valor: string | null): CondicaoAtributo => ({ atributo, operador, valor });
const [T1, T2, A1] = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"];

describe("ambiguidade entre modelos", () => {
  it("dois gerais empatam", () => expect(regrasAmbiguas(SEM_RESTRICAO, SEM_RESTRICAO)).toBe(true));

  it("mais específico vence: não é ambíguo (exceção)", () => expect(regrasAmbiguas(SEM_RESTRICAO, r({ tipoVeiculoIds: [T1] }))).toBe(false));

  it("mesmo nível em listas que se cruzam empata; listas disjuntas não", () => {
    expect(regrasAmbiguas(r({ tipoVeiculoIds: [T1, T2] }), r({ tipoVeiculoIds: [T2] }))).toBe(true);
    expect(regrasAmbiguas(r({ tipoVeiculoIds: [T1] }), r({ tipoVeiculoIds: [T2] }))).toBe(false);
  });

  it("critérios diferentes no mesmo nível empatam onde os dois valem", () =>
    expect(regrasAmbiguas(r({ tipoVeiculoIds: [T1] }), r({ areaIds: [A1] }))).toBe(true));

  it("condições de atributo excludentes separam; compatíveis empatam", () => {
    expect(regrasAmbiguas(r({ atributos: [c("comb", "igual", "Diesel")] }), r({ atributos: [c("comb", "igual", "GNV")] }))).toBe(false);
    expect(regrasAmbiguas(r({ atributos: [c("comb", "igual", "Diesel")] }), r({ atributos: [c("comb", "diferente", "diesel")] }))).toBe(false);
    expect(regrasAmbiguas(r({ atributos: [c("eixos", "maior", "3")] }), r({ atributos: [c("eixos", "menor", "3")] }))).toBe(false);
    expect(regrasAmbiguas(r({ atributos: [c("eixos", "maior", "2")] }), r({ atributos: [c("eixos", "menor", "5")] }))).toBe(true);
    expect(regrasAmbiguas(r({ atributos: [c("eixos", "igual", "2")] }), r({ atributos: [c("eixos", "maior", "3")] }))).toBe(false);
    expect(regrasAmbiguas(r({ atributos: [c("comb", "igual", "Diesel")] }), r({ atributos: [c("cor", "igual", "Azul")] }))).toBe(true);
  });

  it("ignora o próprio modelo (nova versão não conflita com a anterior)", () => {
    const pub = [{ id: "a", aplicavel: SEM_RESTRICAO }, { id: "b", aplicavel: r({ tipoVeiculoIds: [T1] }) }];
    expect(modelosAmbiguos("a", SEM_RESTRICAO, pub)).toEqual([]);
    expect(modelosAmbiguos("novo", SEM_RESTRICAO, pub).map((m) => m.id)).toEqual(["a"]);
  });
});
