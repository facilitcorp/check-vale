import { z } from "zod";

/**
 * Contratos de domínio do CheckVale, compartilhados entre app (web) e API.
 * Ids são UUID gerados no CLIENTE, para que a inspeção exista offline
 * e a sincronização seja idempotente (reenviar não duplica).
 */

export const Id = z.uuid();
export type Id = z.infer<typeof Id>;

/** Data/hora em ISO-8601 (UTC). */
export const DataHora = z.iso.datetime({ offset: true });

export const StatusResposta = z.enum(["conforme", "nao_conforme", "nao_aplica"]);
export type StatusResposta = z.infer<typeof StatusResposta>;

export const Criticidade = z.enum(["critica", "alta", "media", "baixa"]);
export type Criticidade = z.infer<typeof Criticidade>;

export const ORDEM_CRITICIDADE: Record<Criticidade, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

// ---------------------------------------------------------------------------
// Operação (configurada pelo ADMIN). `demo` marca dado de demonstração.
// ---------------------------------------------------------------------------

export const Unidade = z.object({
  id: Id,
  nome: z.string().trim().min(1), // site / complexo
  uf: z.string().length(2).nullable(),
  ativo: z.boolean(),
  demo: z.boolean(),
});
export type Unidade = z.infer<typeof Unidade>;

export const Area = z.object({
  id: Id,
  unidadeId: Id.nullable(), // null = disponível em todas as unidades
  nome: z.string().trim().min(1),
  ativo: z.boolean(),
  demo: z.boolean(),
});
export type Area = z.infer<typeof Area>;

export const Atividade = z.object({
  id: Id,
  nome: z.string().trim().min(1),
  ativo: z.boolean(),
  demo: z.boolean(),
});
export type Atividade = z.infer<typeof Atividade>;

export const TipoVeiculo = z.object({
  id: Id,
  codigo: z.string().trim().min(1), // aberto, é configuração
  nome: z.string().trim().min(1),
  ordem: z.number().int(),
  ativo: z.boolean(),
});
export type TipoVeiculo = z.infer<typeof TipoVeiculo>;

// ---------------------------------------------------------------------------
// Atributos técnicos de veículo: definidos pelo ADMIN, sem campo fixo por tipo.
// ---------------------------------------------------------------------------

export const TipoAtributo = z.enum(["texto", "numero", "booleano", "lista"]);
export type TipoAtributo = z.infer<typeof TipoAtributo>;

export const CODIGO = z.string().trim().regex(/^[a-z][a-z0-9_]*$/, "Use letras minúsculas, números e _ (ex.: tipo_freio).");

export const DefinicaoAtributo = z.object({
  id: Id,
  codigo: CODIGO, // chave em Veiculo.atributos e nas regras
  nome: z.string().trim().min(1), // ex.: "Tipo de freio"
  tipo: TipoAtributo,
  /** Só para tipo "lista". */
  opcoes: z.array(z.string().trim().min(1)),
  unidadeMedida: z.string().nullable(), // ex.: "lugares", "kg"
  /** Vazio = vale para todos os tipos de veículo. */
  tipoVeiculoIds: z.array(Id),
  obrigatorio: z.boolean(),
  ordem: z.number().int(),
  ativo: z.boolean(),
});
export type DefinicaoAtributo = z.infer<typeof DefinicaoAtributo>;

export const ValorAtributo = z.union([z.string(), z.number(), z.boolean()]);
export type ValorAtributo = z.infer<typeof ValorAtributo>;
export const Atributos = z.record(z.string(), ValorAtributo);
export type Atributos = z.infer<typeof Atributos>;

// ---------------------------------------------------------------------------
// Regras de aplicabilidade (motor em regras.ts). Todas as condições preenchidas
// precisam valer (E). Lista vazia = sem restrição naquele critério.
// ---------------------------------------------------------------------------

export const OperadorRegra = z.enum(["igual", "diferente", "contem", "maior", "menor", "preenchido"]);
export type OperadorRegra = z.infer<typeof OperadorRegra>;

export const CondicaoAtributo = z.object({
  atributo: CODIGO,
  operador: OperadorRegra,
  valor: ValorAtributo.nullable(),
});
export type CondicaoAtributo = z.infer<typeof CondicaoAtributo>;

export const RegraAplicabilidade = z.object({
  tipoVeiculoIds: z.array(Id),
  areaIds: z.array(Id),
  atividadeIds: z.array(Id),
  atributos: z.array(CondicaoAtributo),
});
export type RegraAplicabilidade = z.infer<typeof RegraAplicabilidade>;

export const SEM_RESTRICAO: RegraAplicabilidade = { tipoVeiculoIds: [], areaIds: [], atividadeIds: [], atributos: [] };

// ---------------------------------------------------------------------------
// Modelo de checklist
// ---------------------------------------------------------------------------

/**
 * Evidência pedida no item. Estende a regra de sempre (foto em toda não
 * conformidade), nunca a afrouxa:
 * - sem_evidencia: nada além da regra de sempre;
 * - observacao: texto obrigatório ao responder (na NC, a descrição conta);
 * - foto: foto obrigatória ao responder, conforme ou não;
 * - foto_se_nc: a regra de sempre, explícita (padrão de item sem o campo).
 * "Não se aplica" nunca pede evidência.
 */
export const EvidenciaItem = z.enum(["sem_evidencia", "observacao", "foto", "foto_se_nc"]);
export type EvidenciaItem = z.infer<typeof EvidenciaItem>;
export const EVIDENCIA_PADRAO: EvidenciaItem = "foto_se_nc";

/** Rótulos da tela. Componentes usam este mapa, nunca o texto solto. */
export const ROTULO_EVIDENCIA: Record<EvidenciaItem, string> = {
  sem_evidencia: "Sem evidência obrigatória",
  observacao: "Observação",
  foto: "Fotografia",
  foto_se_nc: "Fotografia quando houver não conformidade",
};

export const ItemChecklist = z.object({
  id: Id,
  codigo: z.string().trim().min(1), // estável entre versões do modelo
  titulo: z.string().trim().min(1),
  descricao: z.string(),
  ordem: z.number().int(),
  /** Item pode ser marcado "Não se aplica"? */
  permiteNaoAplica: z.boolean(),
  /** Criticidade sugerida ao registrar não conformidade neste item. */
  criticidadeSugerida: Criticidade.nullable(),
  /** Quando o item aparece. Item fora da regra não é perguntado nem conta no índice. */
  aplicavel: RegraAplicabilidade,
  /** Evidência pedida. Ausente = EVIDENCIA_PADRAO (itens gravados antes do campo existir). */
  evidencia: EvidenciaItem.optional(),
});
export type ItemChecklist = z.infer<typeof ItemChecklist>;

export const CategoriaChecklist = z.object({
  id: Id,
  codigo: z.string().trim().min(1),
  nome: z.string().trim().min(1),
  icone: z.string(),
  ordem: z.number().int(),
  aplicavel: RegraAplicabilidade,
  itens: z.array(ItemChecklist),
});
export type CategoriaChecklist = z.infer<typeof CategoriaChecklist>;

export const StatusVersao = z.enum(["rascunho", "publicada", "arquivada"]);
export type StatusVersao = z.infer<typeof StatusVersao>;

/**
 * Modelo de checklist versionado. Só versão PUBLICADA chega ao inspetor.
 * Versão publicada é imutável; para mudar, cria-se novo rascunho (versao+1).
 * A inspeção grava modeloId + modeloVersao: o passado nunca muda.
 * `aplicavel` diz para que contexto o modelo serve (escolherModelo).
 */
export const ModeloChecklist = z.object({
  id: Id,
  nome: z.string().trim().min(1),
  versao: z.number().int().positive(),
  aplicavel: RegraAplicabilidade,
  categorias: z.array(CategoriaChecklist),
});
export type ModeloChecklist = z.infer<typeof ModeloChecklist>;

export const Catalogo = z.object({
  versao: z.string(), // muda quando qualquer item do catálogo muda (cache)
  unidades: z.array(Unidade),
  areas: z.array(Area),
  atividades: z.array(Atividade),
  tiposVeiculo: z.array(TipoVeiculo),
  atributos: z.array(DefinicaoAtributo),
  /** Só versões publicadas, a mais recente de cada modelo. */
  modelos: z.array(ModeloChecklist),
});
export type Catalogo = z.infer<typeof Catalogo>;

// ---------------------------------------------------------------------------
// Veículo
// ---------------------------------------------------------------------------

export const StatusVeiculo = z.enum(["ativo", "inativo"]);
export type StatusVeiculo = z.infer<typeof StatusVeiculo>;

export const VeiculoBase = z.object({
    id: Id,
    placa: z.string().trim().min(1).nullable(), // máquinas podem não ter placa
    codigo: z.string().trim().min(1).nullable(), // código interno / frota
    tipoVeiculoId: Id,
    fabricante: z.string().trim(),
    modelo: z.string().trim(),
    descricao: z.string().trim(), // apelido livre, ex.: "Caminhonete"
    empresa: z.string().trim().nullable(),
    unidadeId: Id.nullable(),
    status: StatusVeiculo,
    atributos: Atributos,
    demo: z.boolean(),
    criadoEm: DataHora,
    atualizadoEm: DataHora,
});
const exigePlacaOuCodigo = (v: { placa: string | null; codigo: string | null }) => !!(v.placa || v.codigo);
export const Veiculo = VeiculoBase.refine(exigePlacaOuCodigo, { message: "Informe a placa ou o código interno.", path: ["placa"] });
export type Veiculo = z.infer<typeof Veiculo>;

// ---------------------------------------------------------------------------
// Inspeção
// ---------------------------------------------------------------------------

export const NaoConformidade = z.object({
  descricao: z.string().trim().min(1),
  criticidade: Criticidade,
});
export type NaoConformidade = z.infer<typeof NaoConformidade>;

export const Resposta = z
  .object({
    itemId: Id,
    status: StatusResposta,
    observacao: z.string().max(2000).nullable(),
    /** Obrigatória quando status = nao_conforme. */
    naoConformidade: NaoConformidade.nullable(),
    evidenciaIds: z.array(Id),
    respondidaEm: DataHora,
  })
  .superRefine((r, ctx) => {
    if (r.status === "nao_conforme") {
      if (!r.naoConformidade)
        ctx.addIssue({ code: "custom", path: ["naoConformidade"], message: "Descreva a não conformidade." });
      if (r.evidenciaIds.length === 0)
        ctx.addIssue({ code: "custom", path: ["evidenciaIds"], message: "Foto obrigatória para não conformidade." });
    } else if (r.naoConformidade) {
      ctx.addIssue({ code: "custom", path: ["naoConformidade"], message: "Só existe em item não conforme." });
    }
  });
export type Resposta = z.infer<typeof Resposta>;

export const evidenciaDoItem = (item: Pick<ItemChecklist, "evidencia">): EvidenciaItem => item.evidencia ?? EVIDENCIA_PADRAO;

/**
 * O que falta de evidência nesta resposta, pela configuração do item. A foto da
 * não conformidade continua garantida pelo próprio schema de Resposta.
 */
export function faltaEvidencia(item: Pick<ItemChecklist, "evidencia">, r: Pick<Resposta, "status" | "observacao" | "naoConformidade" | "evidenciaIds">): string | null {
  if (r.status === "nao_aplica") return null;
  const ev = evidenciaDoItem(item);
  if (r.evidenciaIds.length === 0 && (ev === "foto" || r.status === "nao_conforme")) return "Tire ao menos uma foto deste item.";
  if (ev === "observacao" && !r.observacao?.trim() && !r.naoConformidade?.descricao.trim()) return "Escreva uma observação sobre este item.";
  return null;
}

export const StatusInspecao = z.enum(["em_andamento", "concluida", "cancelada"]);
export type StatusInspecao = z.infer<typeof StatusInspecao>;

export const Inspecao = z.object({
  id: Id,
  modeloId: Id,
  modeloVersao: z.number().int().positive(),
  unidadeId: Id,
  areaId: Id,
  atividadeId: Id,
  veiculoId: Id,
  inspetorId: Id,
  /** Retrato do veículo no momento da inspeção: as regras usam ESTE, não o cadastro atual. */
  tipoVeiculoId: Id,
  atributosVeiculo: Atributos,
  status: StatusInspecao,
  iniciadaEm: DataHora,
  concluidaEm: DataHora.nullable(),
  /** Uma resposta por item; a mais recente vale. */
  respostas: z.array(Resposta),
});
export type Inspecao = z.infer<typeof Inspecao>;

/** Metadados da foto. O binário sobe separado (multipart) por evidenciaId. */
export const Evidencia = z.object({
  id: Id,
  inspecaoId: Id,
  itemId: Id,
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  bytes: z.number().int().positive().max(15 * 1024 * 1024),
  capturadaEm: DataHora,
  /** Preenchido pela API depois do upload. */
  url: z.string().nullable(),
});
export type Evidencia = z.infer<typeof Evidencia>;

// ---------------------------------------------------------------------------
// Usuário / sessão
// ---------------------------------------------------------------------------

export const Papel = z.enum(["admin", "inspetor"]);
export type Papel = z.infer<typeof Papel>;

export const Usuario = z.object({
  id: Id,
  nome: z.string(),
  email: z.email(),
  papel: Papel,
});
export type Usuario = z.infer<typeof Usuario>;
