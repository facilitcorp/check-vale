import { z } from "zod";
import { CategoriaChecklist, Id, StatusVersao } from "./dominio";

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

export const ModeloBiblioteca = z
  .object({
    id: Id,
    versao: z.number().int().positive(),
    setorIds: z.array(Id).min(1),
    nome: z.string().trim().min(1),
    resumo: z.string(),
    origem: OrigemBiblioteca,
    /** Obrigatória quando origem = referencia. */
    fonte: z.string().trim().min(1).nullable(),
    status: StatusVersao,
    categorias: z.array(CategoriaChecklist),
  })
  .refine((m) => m.origem !== "referencia" || !!m.fonte, { message: "Modelo de referência precisa citar a fonte", path: ["fonte"] });
export type ModeloBiblioteca = z.infer<typeof ModeloBiblioteca>;

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

export const SetorComContagem = Setor.extend({ totalModelos: z.number().int() });
export type SetorComContagem = z.infer<typeof SetorComContagem>;

/** usar = cria modelo da empresa já publicado; personalizar = cria rascunho para o editor. */
export const AdotarModelo = z.object({
  modo: z.enum(["usar", "personalizar"]),
  nome: z.string().trim().min(1).optional(),
});
export type AdotarModelo = z.infer<typeof AdotarModelo>;

export const ResultadoAdocao = z.object({
  modeloId: Id,
  versao: z.number().int().positive(),
  status: StatusVersao,
});
export type ResultadoAdocao = z.infer<typeof ResultadoAdocao>;
