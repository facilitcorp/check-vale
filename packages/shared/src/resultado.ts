import {
  ORDEM_CRITICIDADE,
  type CategoriaChecklist,
  type Criticidade,
  type ModeloChecklist,
  type Resposta,
} from "./dominio";

/**
 * Cálculo do resultado da inspeção. Função pura, usada no app (offline,
 * telas 9–12) e na API (relatório/PDF) — os dois mostram o MESMO número.
 *
 * Regras (MVP, a validar com o produto):
 * - Índice de prontidão = conformes / aplicáveis, onde aplicáveis = itens
 *   respondidos que não são "não se aplica". Sem aplicáveis → 0.
 * - Ponto de atenção = item CONFORME com observação preenchida (ressalva do
 *   inspetor). É subconjunto de `conformes`; os cartões do resultado mostram
 *   conformes − pontosAtencao, pontosAtencao, naoConformes e naoAplica, que somam
 *   o total respondido (como no mockup: 32 + 10 + 6 + 0 = 48).
 * - Situação: qualquer NC crítica → "nao_apto"; qualquer NC (alta/média/baixa)
 *   → "apto_com_restricoes"; sem NC → "apto". Só vale com a inspeção completa;
 *   antes disso é "incompleta".
 */

export type Situacao = "apto" | "apto_com_restricoes" | "nao_apto" | "incompleta";

export interface ResumoCategoria {
  categoriaId: string;
  nome: string;
  total: number;
  respondidos: number;
  conformes: number;
  naoConformes: number;
  naoAplica: number;
  /** 0–100, inteiro. */
  indice: number;
}

export interface AcaoPlano {
  itemId: string;
  categoriaId: string;
  categoriaNome: string;
  itemTitulo: string;
  descricao: string;
  criticidade: Criticidade;
}

export interface ResultadoInspecao {
  total: number;
  respondidos: number;
  conformes: number;
  naoConformes: number;
  naoAplica: number;
  pontosAtencao: number;
  /** 0–100, inteiro. */
  indice: number;
  completa: boolean;
  situacao: Situacao;
  porCategoria: ResumoCategoria[];
  /** Ordenado por criticidade (crítica primeiro), depois pela ordem do checklist. */
  planoAcao: AcaoPlano[];
}

const pct = (parte: number, todo: number) => (todo === 0 ? 0 : Math.round((parte / todo) * 100));

/** Mantém só a resposta mais recente de cada item. */
export function respostasVigentes(respostas: readonly Resposta[]): Map<string, Resposta> {
  const porItem = new Map<string, Resposta>();
  for (const r of respostas) {
    const atual = porItem.get(r.itemId);
    if (!atual || r.respondidaEm >= atual.respondidaEm) porItem.set(r.itemId, r);
  }
  return porItem;
}

function resumir(cat: CategoriaChecklist, vigentes: Map<string, Resposta>): ResumoCategoria {
  let respondidos = 0, conformes = 0, naoConformes = 0, naoAplica = 0;
  for (const item of cat.itens) {
    const r = vigentes.get(item.id);
    if (!r) continue;
    respondidos++;
    if (r.status === "conforme") conformes++;
    else if (r.status === "nao_conforme") naoConformes++;
    else naoAplica++;
  }
  return {
    categoriaId: cat.id,
    nome: cat.nome,
    total: cat.itens.length,
    respondidos,
    conformes,
    naoConformes,
    naoAplica,
    indice: pct(conformes, respondidos - naoAplica),
  };
}

export function calcularResultado(modelo: ModeloChecklist, respostas: readonly Resposta[]): ResultadoInspecao {
  const vigentes = respostasVigentes(respostas);
  const categorias = [...modelo.categorias].sort((a, b) => a.ordem - b.ordem);
  const porCategoria = categorias.map((c) => resumir(c, vigentes));

  const soma = (k: keyof Pick<ResumoCategoria, "total" | "respondidos" | "conformes" | "naoConformes" | "naoAplica">) =>
    porCategoria.reduce((acc, c) => acc + c[k], 0);

  const planoAcao: (AcaoPlano & { ordem: number })[] = [];
  let ordem = 0;
  let pontosAtencao = 0;
  for (const cat of categorias) {
    for (const item of [...cat.itens].sort((a, b) => a.ordem - b.ordem)) {
      ordem++;
      const r = vigentes.get(item.id);
      if (r?.status === "conforme" && r.observacao?.trim()) pontosAtencao++;
      if (r?.status !== "nao_conforme" || !r.naoConformidade) continue;
      planoAcao.push({
        itemId: item.id,
        categoriaId: cat.id,
        categoriaNome: cat.nome,
        itemTitulo: item.titulo,
        descricao: r.naoConformidade.descricao,
        criticidade: r.naoConformidade.criticidade,
        ordem,
      });
    }
  }
  planoAcao.sort((a, b) => ORDEM_CRITICIDADE[a.criticidade] - ORDEM_CRITICIDADE[b.criticidade] || a.ordem - b.ordem);

  const total = soma("total");
  const respondidos = soma("respondidos");
  const conformes = soma("conformes");
  const naoAplica = soma("naoAplica");
  const completa = total > 0 && respondidos === total;

  let situacao: Situacao = "incompleta";
  if (completa) {
    if (planoAcao.some((a) => a.criticidade === "critica")) situacao = "nao_apto";
    else if (planoAcao.length > 0) situacao = "apto_com_restricoes";
    else situacao = "apto";
  }

  return {
    total,
    respondidos,
    conformes,
    naoConformes: soma("naoConformes"),
    naoAplica,
    pontosAtencao,
    indice: pct(conformes, respondidos - naoAplica),
    completa,
    situacao,
    porCategoria,
    planoAcao: planoAcao.map(({ ordem: _o, ...a }) => a),
  };
}
