import {
  CRITICIDADES,
  type CategoriaChecklist,
  type Criticidade,
  type ModeloChecklist,
  type Verificacao,
} from '@/contracts/checklist';

/**
 * Cálculos da inspeção. Funções puras, sem I/O: rodam no aparelho (a tela de
 * resultado precisa funcionar offline) e podem ser reaproveitadas pela API,
 * para que o índice mostrado no app e o do PDF sejam sempre o mesmo número.
 */

export interface ProgressoCategoria {
  categoriaId: string;
  total: number;
  respondidos: number;
  conformes: number;
  naoConformes: number;
  naoSeAplica: number;
  /** conformes / aplicáveis, de 0 a 100. null quando nada se aplica. */
  percentual: number | null;
  situacao: 'pendente' | 'em_andamento' | 'ok' | 'atencao';
}

export interface ResultadoVerificacao {
  total: number;
  respondidos: number;
  conformes: number;
  naoConformes: number;
  naoSeAplica: number;
  /**
   * PROVISÓRIO: itens conformes que receberam observação. A regra exata de
   * "ponto de atenção" ainda não foi definida pelo produto.
   */
  pontosAtencao: number;
  /** Índice de prontidão: conformes / aplicáveis, de 0 a 100 (inteiro). */
  indiceProntidao: number;
  categorias: ProgressoCategoria[];
}

export interface AcaoPlano {
  itemId: string;
  categoriaId: string;
  tituloItem: string;
  descricao: string;
  criticidade: Criticidade;
  evidenciaIds: string[];
}

function pct(parte: number, todo: number): number | null {
  return todo === 0 ? null : Math.round((parte / todo) * 100);
}

export function progressoCategoria(
  categoria: CategoriaChecklist,
  verificacao: Pick<Verificacao, 'respostas'>,
): ProgressoCategoria {
  let respondidos = 0;
  let conformes = 0;
  let naoConformes = 0;
  let naoSeAplica = 0;
  for (const item of categoria.itens) {
    const r = verificacao.respostas[item.id];
    if (!r) continue;
    respondidos++;
    if (r.status === 'conforme') conformes++;
    else if (r.status === 'nao_conforme') naoConformes++;
    else naoSeAplica++;
  }
  const total = categoria.itens.length;
  const situacao: ProgressoCategoria['situacao'] =
    naoConformes > 0
      ? 'atencao'
      : respondidos === 0
        ? 'pendente'
        : respondidos < total
          ? 'em_andamento'
          : 'ok';
  return {
    categoriaId: categoria.id,
    total,
    respondidos,
    conformes,
    naoConformes,
    naoSeAplica,
    percentual: pct(conformes, total - naoSeAplica),
    situacao,
  };
}

export function calcularResultado(
  modelo: ModeloChecklist,
  verificacao: Pick<Verificacao, 'respostas'>,
): ResultadoVerificacao {
  const categorias = modelo.categorias.map((c) => progressoCategoria(c, verificacao));
  const soma = (k: 'total' | 'respondidos' | 'conformes' | 'naoConformes' | 'naoSeAplica') =>
    categorias.reduce((acc, c) => acc + c[k], 0);

  const total = soma('total');
  const conformes = soma('conformes');
  const naoSeAplica = soma('naoSeAplica');
  const pontosAtencao = Object.values(verificacao.respostas).filter(
    (r) => r.status === 'conforme' && !!r.observacao?.trim(),
  ).length;

  return {
    total,
    respondidos: soma('respondidos'),
    conformes,
    naoConformes: soma('naoConformes'),
    naoSeAplica,
    pontosAtencao,
    indiceProntidao: pct(conformes, total - naoSeAplica) ?? 100,
    categorias,
  };
}

/** Não conformidades ordenadas da mais crítica para a menos crítica. */
export function planoDeAcao(modelo: ModeloChecklist, verificacao: Verificacao): AcaoPlano[] {
  const acoes: AcaoPlano[] = [];
  for (const categoria of modelo.categorias) {
    for (const item of categoria.itens) {
      const r = verificacao.respostas[item.id];
      if (r?.status !== 'nao_conforme' || !r.naoConformidade) continue;
      acoes.push({
        itemId: item.id,
        categoriaId: categoria.id,
        tituloItem: item.titulo,
        descricao: r.naoConformidade.descricao,
        criticidade: r.naoConformidade.criticidade,
        evidenciaIds: r.evidenciaIds,
      });
    }
  }
  const peso = (c: Criticidade) => CRITICIDADES.indexOf(c);
  // sort é estável: dentro da mesma criticidade, mantém a ordem do checklist
  return acoes.sort((a, b) => peso(a.criticidade) - peso(b.criticidade));
}

/** Uma verificação só pode ser concluída com todos os itens respondidos. */
export function podeConcluir(modelo: ModeloChecklist, verificacao: Verificacao): boolean {
  return modelo.categorias.every((c) => c.itens.every((i) => !!verificacao.respostas[i.id]));
}
