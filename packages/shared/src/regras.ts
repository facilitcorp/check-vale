import type {
  Atributos,
  Inspecao,
  CondicaoAtributo,
  OperadorRegra,
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

// ---------------------------------------------------------------------------
// Ambiguidade entre modelos: o inspetor nunca escolhe o checklist, então dois
// modelos publicados não podem empatar para o mesmo veículo/área/atividade.
// ---------------------------------------------------------------------------

const num = (v: ValorAtributo | null) => (v === null || String(v).trim() === "" ? NaN : Number(v));

/** As duas condições (mesmo atributo) nunca valem juntas? Na dúvida, responde false (podem valer). */
function condicoesExcludentes(a: CondicaoAtributo, b: CondicaoAtributo): boolean {
  if (a.valor === null || b.valor === null) return false;
  const [va, vb] = [norm(a.valor), norm(b.valor)];
  const par = (x: OperadorRegra, y: OperadorRegra) => (a.operador === x && b.operador === y) || (a.operador === y && b.operador === x);
  if (a.operador === "igual" && b.operador === "igual") return va !== vb;
  if (par("igual", "diferente")) return va === vb;
  const igual = a.operador === "igual" ? a : b.operador === "igual" ? b : null;
  const outra = igual === a ? b : a;
  if (igual && (outra.operador === "maior" || outra.operador === "menor")) {
    const [x, lim] = [num(igual.valor), num(outra.valor)];
    if (Number.isNaN(lim)) return false;
    if (Number.isNaN(x)) return true; // "maior/menor" só vale para número
    return outra.operador === "maior" ? x <= lim : x >= lim;
  }
  if (par("maior", "menor")) {
    const maior = a.operador === "maior" ? num(a.valor) : num(b.valor);
    const menor = a.operador === "menor" ? num(a.valor) : num(b.valor);
    return !Number.isNaN(maior) && !Number.isNaN(menor) && menor <= maior + Number.EPSILON;
  }
  return false;
}

/**
 * Existe veículo/área/atividade em que as duas regras valem COM a mesma
 * especificidade? Nesse caso escolherModelo empataria e o checklist do
 * inspetor dependeria da sorte. Regra mais específica que a outra não é
 * ambígua: ela vence onde vale (é assim que se faz exceção).
 */
export function regrasAmbiguas(a: RegraAplicabilidade, b: RegraAplicabilidade): boolean {
  if (especificidade(a) !== especificidade(b)) return false;
  const cruzam = (x: string[], y: string[]) => x.length === 0 || y.length === 0 || x.some((v) => y.includes(v));
  if (!cruzam(a.tipoVeiculoIds, b.tipoVeiculoIds) || !cruzam(a.areaIds, b.areaIds) || !cruzam(a.atividadeIds, b.atividadeIds)) return false;
  return !a.atributos.some((ca) => b.atributos.some((cb) => ca.atributo === cb.atributo && condicoesExcludentes(ca, cb)));
}

/** Modelos publicados (de OUTRO id) que ficariam ambíguos com esta regra. */
export const modelosAmbiguos = <M extends Pick<ModeloChecklist, "id" | "aplicavel">>(id: string, regra: RegraAplicabilidade, publicados: readonly M[]): M[] =>
  publicados.filter((m) => m.id !== id && regrasAmbiguas(regra, m.aplicavel));
