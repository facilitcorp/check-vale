import type { Catalogo, Inspecao, Veiculo } from '@checkvale/shared';
import { useCatalogo, useVeiculos } from '../../dados/ganchos';

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Placa; máquina sem placa usa o código interno. */
export const identificacaoVeiculo = (v: Veiculo | undefined) => v?.placa ?? v?.codigo ?? 'Veículo';

/** "Ford Ranger" a partir do cadastro; cai na descrição se faltar fabricante/modelo. */
export function nomeVeiculo(v: Veiculo | undefined): string {
  if (!v) return '';
  const fm = [v.fabricante, v.modelo].filter(Boolean).join(' ');
  return fm || v.descricao;
}

export function textoOperacao(i: Inspecao, catalogo: Catalogo | null | undefined): string {
  if (!catalogo) return '';
  const nome = (lista: { id: string; nome: string }[], id: string) => lista.find((x) => x.id === id)?.nome;
  return [nome(catalogo.unidades, i.unidadeId), nome(catalogo.areas, i.areaId), nome(catalogo.atividades, i.atividadeId)]
    .filter(Boolean)
    .join(' · ');
}

/** Veículo e operação da inspeção, resolvidos no cache do aparelho. */
export function useDescricaoInspecao(i: Inspecao | null | undefined) {
  const veiculos = useVeiculos();
  const catalogo = useCatalogo();
  const veiculo = i ? veiculos?.find((v) => v.id === i.veiculoId) : undefined;
  return { veiculo, operacao: i ? textoOperacao(i, catalogo) : '' };
}
