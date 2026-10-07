import { describe, expect, it } from "vitest";
import { copiarCategorias, ModeloBibliotecaEntrada, SELO_ORIGEM, validarModeloBiblioteca } from "./biblioteca";
import { SEM_RESTRICAO, type CategoriaChecklist } from "./dominio";

const uuid = () => globalThis.crypto.randomUUID();
const item = (codigo: string) => ({
  id: uuid(), codigo, titulo: `Item ${codigo}`, descricao: "", ordem: 1, permiteNaoAplica: true, criticidadeSugerida: null, aplicavel: SEM_RESTRICAO,
});
const categoria = (codigo: string, itens = [item(`${codigo}.1`)]): CategoriaChecklist => ({
  id: uuid(), codigo, nome: `Cat ${codigo}`, icone: "geral", ordem: 1, aplicavel: SEM_RESTRICAO, itens,
});
const base = { setorIds: [uuid()], origem: "base_checkvale" as const, fonte: null, categorias: [categoria("A")] };

describe("biblioteca", () => {
  it("não existe selo de padrão oficial", () => {
    expect(Object.values(SELO_ORIGEM)).toEqual(["Modelo Base CheckVale", "Modelo de referência"]);
    expect(ModeloBibliotecaEntrada.safeParse({ ...base, nome: "X", resumo: "", origem: "oficial" }).success).toBe(false);
  });

  it("modelo de referência sem fonte é recusado", () => {
    expect(ModeloBibliotecaEntrada.safeParse({ ...base, nome: "X", resumo: "", origem: "referencia" }).success).toBe(false);
    expect(validarModeloBiblioteca({ ...base, origem: "referencia" })).toContain("Modelo de referência precisa citar a fonte.");
    expect(validarModeloBiblioteca({ ...base, origem: "referencia", fonte: "Manual do fabricante X, rev. 3" })).toEqual([]);
  });

  it("recusa modelo vazio, códigos repetidos e regra de aplicabilidade", () => {
    expect(validarModeloBiblioteca({ ...base, categorias: [] })).toContain("O modelo não tem categorias.");
    expect(validarModeloBiblioteca({ ...base, categorias: [categoria("A"), categoria("A", [item("B.1")])] })).toContain("Código de categoria repetido: A.");
    const comRegra = categoria("A");
    comRegra.itens[0]!.aplicavel = { ...SEM_RESTRICAO, tipoVeiculoIds: [uuid()] };
    expect(validarModeloBiblioteca({ ...base, categorias: [comRegra] })[0]).toMatch(/não leva regra/);
  });

  it("a cópia da empresa tem ids novos, mesmos códigos e regras vazias", () => {
    const original = [categoria("A", [item("A.1"), item("A.2")])];
    const copia = copiarCategorias(original);
    expect(copia[0]!.id).not.toBe(original[0]!.id);
    expect(copia[0]!.itens.map((i) => i.codigo)).toEqual(["A.1", "A.2"]);
    expect(new Set([...copia[0]!.itens.map((i) => i.id), ...original[0]!.itens.map((i) => i.id)]).size).toBe(4);
    expect(copia[0]!.itens.every((i) => i.aplicavel === SEM_RESTRICAO)).toBe(true);
  });
});
