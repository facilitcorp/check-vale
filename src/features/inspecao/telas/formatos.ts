import type { Verificacao } from '@/contracts/checklist';

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const textoOperacao = (v: Verificacao) =>
  [v.operacao.unidadeNome, v.operacao.areaNome, v.operacao.atividadeNome].filter(Boolean).join(' · ');
