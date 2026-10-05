import type {
  Atributos,
  Inspecao,
  CondicaoAtributo,
  DefinicaoAtributo,
  ModeloChecklist,
  RegraAplicabilidade,
  ValorAtributo,
} from "./dominio";

/**
 * Motor de regras de aplicabilidade. Puro: roda no app (offline) e na API.
 * Uma regra vale quando TODOS os critérios preenchidos valem (E);
 * dentro de uma lista de ids basta um coincidir (OU).
 */

export interface ContextoRegras {
  tipoVeiculoId: string;
  areaId: string;
  atividadeId: string;
  atributos: Atributos;
}

/** Contexto das regras a partir do retrato gravado na inspeção (igual no app e na API). */
export const contextoDaInspecao = (i: Pick<Inspecao, "tipoVeiculoId" | "areaId" | "atividadeId" | "atributosVeiculo">): ContextoRegras => ({
  tipoVeiculoId: i.tipoVeiculoId,
  areaId: i.areaId,
  atividadeId: i.atividadeId,
  atributos: i.atributosVeiculo,
});

const norm = (v: ValorAtributo) => String(v).trim().toLowerCase();
const preenchido = (v: ValorAtributo | undefined): v is ValorAtributo => v !== undefined && v !== null && String(v).trim() !== "";

export function avaliarCondicao(c: CondicaoAtributo, atributos: Atributos): boolean {
  const atual = atributos[c.atributo];
  switch (c.operador) {
    case "preenchido":
      return preenchido(atual);
    case "igual":
      return preenchido(atual) && c.valor !== null && norm(atual) === norm(c.valor);
    case "diferente":
      return !preenchido(atual) || c.valor === null || norm(atual) !== norm(c.valor);
    case "contem":
      return preenchido(atual) && c.valor !== null && norm(atual).includes(norm(c.valor));
    case "maior":
    case "menor": {
      const a = Number(atual), b = Number(c.valor);
      if (!preenchido(atual) || c.valor === null || Number.isNaN(a) || Number.isNaN(b)) return false;
      return c.operador === "maior" ? a > b : a < b;
    }
  }
}

export function avaliarRegra(r: RegraAplicabilidade, ctx: ContextoRegras): boolean {
  const serve = (lista: string[], v: string) => lista.length === 0 || lista.includes(v);
  return (
    serve(r.tipoVeiculoIds, ctx.tipoVeiculoId) &&
    serve(r.areaIds, ctx.areaId) &&
    serve(r.atividadeIds, ctx.atividadeId) &&
    r.atributos.every((c) => avaliarCondicao(c, ctx.atributos))
  );
}

/** Quantos critérios a regra usa (para escolher o modelo mais específico). */
export const especificidade = (r: RegraAplicabilidade) =>
  [r.tipoVeiculoIds, r.areaIds, r.atividadeIds].filter((l) => l.length > 0).length + r.atributos.length;

/**
 * Modelo "recortado" para o contexto: só categorias e itens aplicáveis,
 * em ordem. É o que o inspetor vê e o que entra no cálculo do resultado.
 */
export function aplicarRegras(modelo: ModeloChecklist, ctx: ContextoRegras): ModeloChecklist {
  const categorias = [...modelo.categorias]
    .filter((c) => avaliarRegra(c.aplicavel, ctx))
    .sort((a, b) => a.ordem - b.ordem)
    .map((c) => ({ ...c, itens: [...c.itens].filter((i) => avaliarRegra(i.aplicavel, ctx)).sort((a, b) => a.ordem - b.ordem) }))
    .filter((c) => c.itens.length > 0);
  return { ...modelo, categorias };
}

/** Problemas que impedem publicar uma versão. Lista vazia = pode publicar. */
export function validarParaPublicar(modelo: ModeloChecklist, defs: readonly DefinicaoAtributo[]): string[] {
  const erros: string[] = [];
  const codigosAtributo = new Set(defs.map((d) => d.codigo));
  const checarRegra = (r: RegraAplicabilidade, onde: string) => {
    for (const c of r.atributos) {
      if (!codigosAtributo.has(c.atributo)) erros.push(`${onde}: atributo "${c.atributo}" não existe.`);
      if (c.operador !== "preenchido" && (c.valor === null || String(c.valor).trim() === "")) erros.push(`${onde}: condição sem valor.`);
    }
  };
  if (modelo.categorias.length === 0) erros.push("O modelo não tem categorias.");
  checarRegra(modelo.aplicavel, "Modelo");
  const codCat = new Set<string>();
  const codItem = new Set<string>();
  for (const c of modelo.categorias) {
    if (codCat.has(c.codigo)) erros.push(`Código de categoria repetido: ${c.codigo}.`);
    codCat.add(c.codigo);
    if (c.itens.length === 0) erros.push(`Categoria "${c.nome}" sem itens.`);
    checarRegra(c.aplicavel, `Categoria "${c.nome}"`);
    for (const i of c.itens) {
      if (codItem.has(i.codigo)) erros.push(`Código de item repetido: ${i.codigo}.`);
      codItem.add(i.codigo);
      checarRegra(i.aplicavel, `Item "${i.titulo}"`);
    }
  }
  return erros;
}

/** Valida os atributos de um veículo contra as definições ativas do tipo dele. */
export function validarAtributos(defs: readonly DefinicaoAtributo[], tipoVeiculoId: string, atributos: Atributos): string[] {
  const erros: string[] = [];
  const doTipo = defs.filter((d) => d.ativo && (d.tipoVeiculoIds.length === 0 || d.tipoVeiculoIds.includes(tipoVeiculoId)));
  const porCodigo = new Map(doTipo.map((d) => [d.codigo, d]));
  for (const d of doTipo) if (d.obrigatorio && !preenchido(atributos[d.codigo])) erros.push(`${d.nome} é obrigatório.`);
  for (const [codigo, valor] of Object.entries(atributos)) {
    const d = porCodigo.get(codigo);
    if (!d) {
      erros.push(`Atributo "${codigo}" não se aplica a este tipo de veículo.`);
      continue;
    }
    if (!preenchido(valor)) continue;
    if (d.tipo === "numero" && typeof valor !== "number") erros.push(`${d.nome} deve ser número.`);
    if (d.tipo === "booleano" && typeof valor !== "boolean") erros.push(`${d.nome} deve ser sim/não.`);
    if (d.tipo === "lista" && !d.opcoes.includes(String(valor))) erros.push(`${d.nome}: opção inválida.`);
  }
  return erros;
}
