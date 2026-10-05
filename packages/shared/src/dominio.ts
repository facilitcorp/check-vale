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
// Catálogo (configuração; vem da API e fica em cache no aparelho)
// ---------------------------------------------------------------------------

export const Unidade = z.object({
  id: Id,
  nome: z.string().min(1), // ex.: "Complexo Carajás"
  uf: z.string().length(2),
  ativo: z.boolean(),
});
export type Unidade = z.infer<typeof Unidade>;

export const Area = z.object({
  id: Id,
  unidadeId: Id.nullable(), // null = disponível em todas as unidades
  nome: z.string().min(1), // ex.: "Área operacional"
  ativo: z.boolean(),
});
export type Area = z.infer<typeof Area>;

export const Atividade = z.object({
  id: Id,
  nome: z.string().min(1), // ex.: "Transporte de pessoas"
  ativo: z.boolean(),
});
export type Atividade = z.infer<typeof Atividade>;

export const TipoVeiculo = z.object({
  id: Id,
  codigo: z.string().min(1), // "leve" | "van" | "onibus" | "maquina" | ... (aberto, é configuração)
  nome: z.string().min(1),
  ordem: z.number().int(),
});
export type TipoVeiculo = z.infer<typeof TipoVeiculo>;

export const ItemChecklist = z.object({
  id: Id,
  codigo: z.string().min(1), // estável entre versões do modelo
  titulo: z.string().min(1), // ex.: "Estado geral da carroceria"
  descricao: z.string(), // ex.: "Sem amassados, trincas ou danos estruturais."
  ordem: z.number().int(),
  /** Item pode ser marcado "Não se aplica"? */
  permiteNaoAplica: z.boolean(),
  /** Criticidade sugerida ao registrar não conformidade neste item. */
  criticidadeSugerida: Criticidade.nullable(),
});
export type ItemChecklist = z.infer<typeof ItemChecklist>;

export const CategoriaChecklist = z.object({
  id: Id,
  codigo: z.string().min(1),
  nome: z.string().min(1), // ex.: "Itens externos"
  icone: z.string(), // nome do ícone no app (ex.: "car", "engine")
  ordem: z.number().int(),
  itens: z.array(ItemChecklist),
});
export type CategoriaChecklist = z.infer<typeof CategoriaChecklist>;

/**
 * Modelo de checklist versionado. Uma inspeção grava templateId + versao;
 * mudar o modelo depois não altera inspeções já feitas (auditoria).
 * Listas vazias em tiposVeiculo/areas/atividades = vale para todos.
 */
export const ModeloChecklist = z.object({
  id: Id,
  nome: z.string().min(1),
  versao: z.number().int().positive(),
  tipoVeiculoIds: z.array(Id),
  areaIds: z.array(Id),
  atividadeIds: z.array(Id),
  categorias: z.array(CategoriaChecklist),
});
export type ModeloChecklist = z.infer<typeof ModeloChecklist>;

export const Catalogo = z.object({
  versao: z.string(), // muda quando qualquer item do catálogo muda (cache)
  unidades: z.array(Unidade),
  areas: z.array(Area),
  atividades: z.array(Atividade),
  tiposVeiculo: z.array(TipoVeiculo),
  modelos: z.array(ModeloChecklist),
});
export type Catalogo = z.infer<typeof Catalogo>;

// ---------------------------------------------------------------------------
// Veículo
// ---------------------------------------------------------------------------

export const Veiculo = z.object({
  id: Id,
  placa: z.string().min(1).nullable(), // máquinas podem não ter placa
  codigo: z.string().nullable(), // código interno / frota
  tipoVeiculoId: Id,
  descricao: z.string().min(1), // ex.: "Caminhonete"
  marcaModelo: z.string(), // ex.: "Ford Ranger"
  unidadeId: Id.nullable(),
  criadoEm: DataHora,
  atualizadoEm: DataHora,
});
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

export const Papel = z.enum(["inspetor", "gestor", "admin"]);
export type Papel = z.infer<typeof Papel>;

export const Usuario = z.object({
  id: Id,
  nome: z.string(),
  email: z.email(),
  papel: Papel,
});
export type Usuario = z.infer<typeof Usuario>;
