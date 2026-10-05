import { describe, expect, it } from "vitest";
import { SEM_RESTRICAO, type DefinicaoAtributo, type ItemChecklist, type ModeloChecklist, type RegraAplicabilidade } from "./dominio";
import { escolherModelo } from "./modelo";
import { pode } from "./permissoes";
import { aplicarRegras, avaliarRegra, validarAtributos, validarParaPublicar } from "./regras";

const regra = (r: Partial<RegraAplicabilidade>): RegraAplicabilidade => ({ ...SEM_RESTRICAO, ...r });
const m = (id: string, aplicavel: Partial<RegraAplicabilidade> = {}, versao = 1): ModeloChecklist => ({ id, nome: id, versao, aplicavel: regra(aplicavel), categorias: [] });
const ctx = { tipoVeiculoId: "onibus", areaId: "mina", atividadeId: "pessoas", atributos: { tipo_freio: "Pneumático", lugares: 44, possui_giroflex: true } };
const item = (codigo: string, aplicavel: Partial<RegraAplicabilidade> = {}, ordem = 1): ItemChecklist => ({
  id: codigo, codigo, titulo: codigo, descricao: "", ordem, permiteNaoAplica: true, criticidadeSugerida: null, aplicavel: regra(aplicavel),
});

describe("avaliarRegra", () => {
  it("sem restrição vale para tudo", () => expect(avaliarRegra(SEM_RESTRICAO, ctx)).toBe(true));
  it("ids: basta um coincidir; critérios combinam com E", () => {
    expect(avaliarRegra(regra({ tipoVeiculoIds: ["leve", "onibus"] }), ctx)).toBe(true);
    expect(avaliarRegra(regra({ tipoVeiculoIds: ["onibus"], areaIds: ["porto"] }), ctx)).toBe(false);
  });
  it("atributos: igual ignora maiúsculas, número compara, preenchido, diferente com ausente", () => {
    expect(avaliarRegra(regra({ atributos: [{ atributo: "tipo_freio", operador: "igual", valor: "pneumático" }] }), ctx)).toBe(true);
    expect(avaliarRegra(regra({ atributos: [{ atributo: "lugares", operador: "maior", valor: 30 }] }), ctx)).toBe(true);
    expect(avaliarRegra(regra({ atributos: [{ atributo: "lugares", operador: "menor", valor: 30 }] }), ctx)).toBe(false);
    expect(avaliarRegra(regra({ atributos: [{ atributo: "possui_giroflex", operador: "igual", valor: true }] }), ctx)).toBe(true);
    expect(avaliarRegra(regra({ atributos: [{ atributo: "cacamba", operador: "preenchido", valor: null }] }), ctx)).toBe(false);
    expect(avaliarRegra(regra({ atributos: [{ atributo: "cacamba", operador: "diferente", valor: "x" }] }), ctx)).toBe(true);
    expect(avaliarRegra(regra({ atributos: [{ atributo: "cacamba", operador: "igual", valor: "x" }] }), ctx)).toBe(false);
  });
});

describe("aplicarRegras", () => {
  it("remove itens e categorias fora da regra e ordena", () => {
    const modelo: ModeloChecklist = {
      ...m("x"),
      categorias: [
        { id: "c2", codigo: "c2", nome: "Freios", icone: "", ordem: 2, aplicavel: SEM_RESTRICAO, itens: [
          item("pneumatico", { atributos: [{ atributo: "tipo_freio", operador: "igual", valor: "Pneumático" }] }, 2),
          item("hidraulico", { atributos: [{ atributo: "tipo_freio", operador: "igual", valor: "Hidráulico" }] }, 1),
        ] },
        { id: "c1", codigo: "c1", nome: "Só leves", icone: "", ordem: 1, aplicavel: regra({ tipoVeiculoIds: ["leve"] }), itens: [item("a")] },
        { id: "c3", codigo: "c3", nome: "Vazia após regra", icone: "", ordem: 3, aplicavel: SEM_RESTRICAO, itens: [item("b", { areaIds: ["porto"] })] },
      ],
    };
    const r = aplicarRegras(modelo, ctx);
    expect(r.categorias.map((c) => c.codigo)).toEqual(["c2"]);
    expect(r.categorias[0]!.itens.map((i) => i.codigo)).toEqual(["pneumatico"]);
  });
});

describe("escolherModelo", () => {
  it("usa o genérico quando não há específico", () => {
    expect(escolherModelo([m("geral"), m("leve", { tipoVeiculoIds: ["leve"] })], ctx)?.id).toBe("geral");
  });
  it("prefere o mais específico (atributo conta)", () => {
    const r = escolherModelo([
      m("geral"),
      m("onibus", { tipoVeiculoIds: ["onibus"] }),
      m("onibus-grande", { tipoVeiculoIds: ["onibus"], atributos: [{ atributo: "lugares", operador: "maior", valor: 40 }] }),
    ], ctx);
    expect(r?.id).toBe("onibus-grande");
  });
  it("sem compatível devolve null", () => expect(escolherModelo([m("leve", { tipoVeiculoIds: ["leve"] })], ctx)).toBeNull());
});

const def = (codigo: string, f: Partial<DefinicaoAtributo> = {}): DefinicaoAtributo => ({
  id: codigo, codigo, nome: codigo, tipo: "texto", opcoes: [], unidadeMedida: null, tipoVeiculoIds: [], obrigatorio: false, ordem: 1, ativo: true, ...f,
});

describe("validarParaPublicar", () => {
  it("aponta modelo vazio, categoria sem item, código repetido e atributo inexistente", () => {
    const erros = validarParaPublicar({
      ...m("x"),
      categorias: [
        { id: "c1", codigo: "c", nome: "A", icone: "", ordem: 1, aplicavel: SEM_RESTRICAO, itens: [item("i1", { atributos: [{ atributo: "fantasma", operador: "igual", valor: "1" }] }), item("i1")] },
        { id: "c2", codigo: "c", nome: "B", icone: "", ordem: 2, aplicavel: SEM_RESTRICAO, itens: [] },
      ],
    }, [def("tipo_freio")]);
    expect(erros.join(" | ")).toMatch(/repetido: c\./);
    expect(erros.join(" | ")).toMatch(/item repetido: i1/);
    expect(erros.join(" | ")).toMatch(/"fantasma" não existe/);
    expect(erros.join(" | ")).toMatch(/"B" sem itens/);
    expect(validarParaPublicar(m("vazio"), [])).toEqual(["O modelo não tem categorias."]);
  });
});

describe("validarAtributos", () => {
  const defs = [
    def("tipo_freio", { tipo: "lista", opcoes: ["Pneumático", "Hidráulico"], obrigatorio: true, tipoVeiculoIds: ["onibus"] }),
    def("lugares", { tipo: "numero" }),
  ];
  it("aceita válido e acusa obrigatório, tipo errado, opção inválida e atributo de outro tipo", () => {
    expect(validarAtributos(defs, "onibus", { tipo_freio: "Pneumático", lugares: 44 })).toEqual([]);
    expect(validarAtributos(defs, "onibus", { lugares: "44" })).toEqual(["tipo_freio é obrigatório.", "lugares deve ser número."]);
    expect(validarAtributos(defs, "onibus", { tipo_freio: "ABS" })).toEqual(["tipo_freio: opção inválida."]);
    expect(validarAtributos(defs, "leve", { tipo_freio: "Pneumático" })).toEqual(['Atributo "tipo_freio" não se aplica a este tipo de veículo.']);
  });
});

describe("RBAC", () => {
  it("admin configura e publica; inspetor só executa", () => {
    expect(pode("admin", "modelo:publicar")).toBe(true);
    expect(pode("inspetor", "inspecao:executar")).toBe(true);
    expect(pode("inspetor", "config:editar")).toBe(false);
  });
});
