/**
 * Contratos compartilhados do CheckVale (front <-> API <-> fila offline).
 *
 * Regras que valem para todo o sistema:
 * - IDs de verificação, resposta e evidência são UUID gerados NO CLIENTE,
 *   porque a inspeção nasce offline. A API deve aceitar esses IDs e ser
 *   idempotente por ID (reenvio da fila não pode duplicar).
 * - O checklist vem de um modelo versionado. A verificação guarda
 *   modeloId + modeloVersao; respostas nunca apontam para item de outra versão.
 * - Datas trafegam em ISO-8601 UTC.
 */

export type Uuid = string;
export type IsoDate = string;

// ---------- Operação e veículo (telas 3 e 4) ----------

export interface Operacao {
  unidadeId: string;
  unidadeNome: string;
  areaId: string;
  areaNome: string;
  atividadeId: string;
  atividadeNome: string;
}

export type TipoVeiculo = 'leve' | 'van' | 'onibus' | 'caminhao' | 'maquina';

export interface Veiculo {
  id: Uuid;
  placa: string; // ou código interno, no caso de máquina
  descricao: string; // ex.: "Caminhonete Ford Ranger"
  marcaModelo?: string;
  tipo: TipoVeiculo;
  fotoUrl?: string;
}

// ---------- Modelo de checklist (configurável, fora do código) ----------

export interface ItemChecklist {
  id: string;
  categoriaId: string;
  ordem: number;
  titulo: string;
  descricao?: string;
  permiteNaoSeAplica: boolean;
}

export interface CategoriaChecklist {
  id: string;
  ordem: number;
  nome: string;
  /** chave de ícone (o front mapeia para o desenho). */
  icone?: string;
  itens: ItemChecklist[];
}

export interface ModeloChecklist {
  id: string;
  versao: number;
  nome: string;
  categorias: CategoriaChecklist[];
}

// ---------- Respostas ----------

export type StatusItem = 'conforme' | 'nao_conforme' | 'nao_se_aplica';
export type Criticidade = 'critica' | 'alta' | 'media' | 'baixa';

export const CRITICIDADES: readonly Criticidade[] = ['critica', 'alta', 'media', 'baixa'];

export interface NaoConformidade {
  descricao: string;
  criticidade: Criticidade;
}

export interface Resposta {
  itemId: string;
  status: StatusItem;
  observacao?: string;
  /** IDs das evidências (fotos) ligadas a este item. */
  evidenciaIds: Uuid[];
  /** Obrigatória quando status = 'nao_conforme'. */
  naoConformidade?: NaoConformidade;
  respondidoEm: IsoDate;
}

export type StatusVerificacao = 'rascunho' | 'concluida';

export interface Verificacao {
  id: Uuid;
  operacao: Operacao;
  veiculo: Veiculo;
  modeloId: string;
  modeloVersao: number;
  status: StatusVerificacao;
  iniciadaEm: IsoDate;
  concluidaEm?: IsoDate;
  /** chave = itemId */
  respostas: Record<string, Resposta>;
}

export interface Evidencia {
  id: Uuid;
  verificacaoId: Uuid;
  itemId: string;
  mime: string;
  tamanhoBytes: number;
  criadaEm: IsoDate;
}

// ---------- Fila de sincronização ----------

/**
 * Tudo o que a tela grava passa pela fila, nunca direto na API.
 * Cada operação é idempotente no servidor pelo par (tipo, id da entidade).
 */
export type OperacaoSync =
  | { tipo: 'verificacao.salvar'; verificacao: Verificacao }
  | { tipo: 'evidencia.enviar'; evidencia: Evidencia }
  | { tipo: 'verificacao.concluir'; verificacaoId: Uuid; concluidaEm: IsoDate };

export interface ItemFila {
  id: Uuid;
  operacao: OperacaoSync;
  criadoEm: IsoDate;
  tentativas: number;
  ultimoErro?: string;
}
