import { z } from "zod";
import { CategoriaChecklist, DataHora, Id, SEM_RESTRICAO, StatusVersao, type RegraAplicabilidade } from "./dominio";

/**
 * Biblioteca de checklists por setor (docs/BIBLIOTECA.md).
 * Setor é cadastro: nenhuma regra depende do nome ou da quantidade de setores.
 * A biblioteca é catálogo; a empresa trabalha numa CÓPIA em modelos_checklist.
 */

export const Setor = z.object({
  id: Id,
  nome: z.string().trim().min(1),
  descricao: z.string(),
  /** Chave de ícone (mesmo conjunto das categorias), nunca SVG/cor solta. */
  icone: z.string(),
  ordem: z.number().int(),
  ativo: z.boolean(),
});
export type Setor = z.infer<typeof Setor>;

/**
 * De onde veio o conteúdo. Não existe "oficial": enquanto não houver fonte
 * validada, nada é apresentado como requisito de cliente, lei ou contrato.
 */
export const OrigemBiblioteca = z.enum(["base_checkvale", "referencia"]);
export type OrigemBiblioteca = z.infer<typeof OrigemBiblioteca>;

/** Texto do selo. Componentes usam este mapa, nunca o texto solto. */
export const SELO_ORIGEM: Record<OrigemBiblioteca, string> = {
  base_checkvale: "Modelo Base CheckVale",
  referencia: "Modelo de referência",
};

const CamposModeloBiblioteca = z.object({
  setorIds: z.array(Id).min(1, "Escolha ao menos um setor."),
  nome: z.string().trim().min(1),
  resumo: z.string(),
  origem: OrigemBiblioteca,
  /** Obrigatória quando origem = referencia. */
  fonte: z.string().trim().min(1).nullable(),
  /** Mesmo formato do núcleo, mas SEM regras: tipos, áreas e atributos são da empresa. */
  categorias: z.array(CategoriaChecklist),
});
const exigeFonte = (m: { origem: OrigemBiblioteca; fonte: string | null }) => m.origem !== "referencia" || !!m.fonte;
const SEM_FONTE = "Modelo de referência precisa citar a fonte.";
// Função, não objeto: o zod normaliza o objeto de parâmetros que recebe.
const ERRO_FONTE = () => ({ message: SEM_FONTE, path: ["fonte"] });

/** Entrada da curadoria (criar/editar rascunho da biblioteca). */
export const ModeloBibliotecaEntrada = CamposModeloBiblioteca.refine(exigeFonte, ERRO_FONTE());
export type ModeloBibliotecaEntrada = z.infer<typeof ModeloBibliotecaEntrada>;

export const ModeloBiblioteca = CamposModeloBiblioteca.extend({
  id: Id,
  versao: z.number().int().positive(),
  status: StatusVersao,
}).refine(exigeFonte, ERRO_FONTE());
export type ModeloBiblioteca = z.infer<typeof ModeloBiblioteca>;

/** Versão vista pela curadoria (inclui rascunhos e datas). */
export const VersaoModeloBiblioteca = CamposModeloBiblioteca.extend({
  id: Id,
  versao: z.number().int().positive(),
  status: StatusVersao,
  criadaEm: DataHora,
  publicadaEm: DataHora.nullable(),
});
export type VersaoModeloBiblioteca = z.infer<typeof VersaoModeloBiblioteca>;

/** Linha da lista de modelos de um setor (sem o conteúdo). */
export const ResumoModeloBiblioteca = z.object({
  id: Id,
  versao: z.number().int().positive(),
  setorIds: z.array(Id),
  nome: z.string(),
  resumo: z.string(),
  origem: OrigemBiblioteca,
  totalCategorias: z.number().int(),
  totalItens: z.number().int(),
});
export type ResumoModeloBiblioteca = z.infer<typeof ResumoModeloBiblioteca>;

export const SetorEntrada = Setor.omit({ id: true });
export type SetorEntrada = z.infer<typeof SetorEntrada>;

export const SetorComContagem = Setor.extend({ totalModelos: z.number().int() });
export type SetorComContagem = z.infer<typeof SetorComContagem>;

/** usar = publica direto se não houver conflito (senão, rascunho); personalizar = sempre rascunho. */
export const AdotarModelo = z.object({
  modo: z.enum(["usar", "personalizar"]),
  nome: z.string().trim().min(1).optional(),
});
export type AdotarModelo = z.infer<typeof AdotarModelo>;

export const ResultadoAdocao = z.object({
  modeloId: Id,
  versao: z.number().int().positive(),
  status: StatusVersao,
  /**
   * Checklists publicados que já valem para o mesmo escopo. Se houver algum,
   * "usar" NÃO publica: devolve rascunho para o admin definir a aplicabilidade.
   * Nada é arquivado ou substituído; o atual segue valendo.
   */
  conflitos: z.array(z.object({ id: Id, nome: z.string() })),
});
export type ResultadoAdocao = z.infer<typeof ResultadoAdocao>;

const regraVazia = (r: RegraAplicabilidade) =>
  r.tipoVeiculoIds.length === 0 && r.areaIds.length === 0 && r.atividadeIds.length === 0 && r.atributos.length === 0;

/**
 * Pode publicar na biblioteca? Mesmas exigências do núcleo (categorias com itens,
 * códigos únicos) e nenhuma regra de aplicabilidade: ids de tipo/área/atributo
 * são de cada empresa e não existem na biblioteca.
 */
export function validarModeloBiblioteca(m: Pick<ModeloBiblioteca, "categorias" | "origem" | "fonte" | "setorIds">): string[] {
  const erros: string[] = [];
  if (m.setorIds.length === 0) erros.push("Escolha ao menos um setor.");
  if (!exigeFonte(m)) erros.push(SEM_FONTE);
  if (m.categorias.length === 0) erros.push("O modelo não tem categorias.");
  const codCat = new Set<string>();
  const codItem = new Set<string>();
  for (const c of m.categorias) {
    if (codCat.has(c.codigo)) erros.push(`Código de categoria repetido: ${c.codigo}.`);
    codCat.add(c.codigo);
    if (c.itens.length === 0) erros.push(`Categoria "${c.nome}" sem itens.`);
    if (!regraVazia(c.aplicavel)) erros.push(`Categoria "${c.nome}": modelo da biblioteca não leva regra de aplicabilidade.`);
    for (const i of c.itens) {
      if (codItem.has(i.codigo)) erros.push(`Código de item repetido: ${i.codigo}.`);
      codItem.add(i.codigo);
      if (!regraVazia(i.aplicavel)) erros.push(`Item "${i.titulo}": modelo da biblioteca não leva regra de aplicabilidade.`);
    }
  }
  return erros;
}

/**
 * Conteúdo da cópia que a empresa recebe: ids novos (cada adoção é um checklist
 * independente), códigos mantidos (rastreio) e regras vazias para a empresa ajustar.
 */
export function copiarCategorias(categorias: readonly CategoriaChecklist[], novoId: () => string = () => globalThis.crypto.randomUUID()): CategoriaChecklist[] {
  return categorias.map((c) => ({
    ...c,
    id: novoId(),
    aplicavel: SEM_RESTRICAO,
    itens: c.itens.map((i) => ({ ...i, id: novoId(), aplicavel: SEM_RESTRICAO })),
  }));
}
