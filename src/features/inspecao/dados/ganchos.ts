import type { ModeloChecklist, Verificacao } from '@/contracts/checklist';
import { useVerificacao } from '../contexto';
import { calcularResultado, planoDeAcao, type AcaoPlano, type ResultadoVerificacao } from '../dominio/resultado';

/**
 * ADAPTADOR PROVISÓRIO com a mesma assinatura do `useChecklistDaInspecao` da
 * fundação (`dados/ganchos.ts` da feat/nucleo-configuravel). As telas leem
 * SOMENTE por aqui e não aplicam regra de negócio. Na integração este arquivo
 * sai e o import passa a apontar para o gancho da fundação.
 */
export interface ChecklistDaInspecao {
  carregando: boolean;
  /** null depois de carregar = inspeção não existe neste aparelho. */
  inspecao: Verificacao | null;
  /** já recortado pelas regras; null com inspeção carregada = versão ausente no aparelho. */
  modelo: ModeloChecklist | null;
  resultado: (ResultadoVerificacao & { plano: AcaoPlano[] }) | null;
}

export function useChecklistDaInspecao(id: string | undefined): ChecklistDaInspecao {
  const dados = useVerificacao(id);
  if (dados === undefined) return { carregando: true, inspecao: null, modelo: null, resultado: null };
  if (dados === null) return { carregando: false, inspecao: null, modelo: null, resultado: null };
  const { verificacao, modelo } = dados;
  if (!modelo) return { carregando: false, inspecao: verificacao, modelo: null, resultado: null };
  return {
    carregando: false,
    inspecao: verificacao,
    modelo,
    resultado: { ...calcularResultado(modelo, verificacao), plano: planoDeAcao(modelo, verificacao) },
  };
}
