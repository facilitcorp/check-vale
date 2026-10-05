import { useLiveQuery } from 'dexie-react-hooks';
import type { OperacaoSync } from '@/contracts/checklist';
import { useEstadoFila, useInspecao } from '../contexto';

/**
 * ADAPTADOR PROVISÓRIO com o mesmo contrato do `dados/estadoSync.ts` da
 * fundação (commit f205d68): mesmos nomes, mesmos estados, mesma regra.
 * Na integração este arquivo sai e só o import muda.
 */
export type SituacaoSync =
  | 'salvo_no_aparelho' // confirmação rápida logo após gravar (aviso, não estado persistente)
  | 'sem_conexao'
  | 'aguardando_envio'
  | 'sincronizando'
  | 'tudo_enviado'
  | 'erro';

export const ROTULO_SYNC: Record<SituacaoSync, string> = {
  salvo_no_aparelho: 'Salvo no aparelho',
  sem_conexao: 'Sem conexão',
  aguardando_envio: 'Aguardando envio',
  sincronizando: 'Sincronizando',
  tudo_enviado: 'Tudo enviado',
  erro: 'Erro ao sincronizar',
};

export interface Pendencias {
  operacoes: number;
  fotos: number;
  /** motivos de recusa do servidor (a fundação preenche; aqui sempre vazio) */
  recusas: string[];
}

export interface EstadoSync {
  situacao: SituacaoSync;
  pendencias: Pendencias;
}

/** Regra única. Foto pendente conta como pendência; recusa/falha é sempre erro. */
export function situacaoDe(e: { online: boolean; sincronizando: boolean; falhou: boolean; pendencias: Pendencias }): SituacaoSync {
  const total = e.pendencias.operacoes + e.pendencias.fotos;
  if (e.pendencias.recusas.length > 0) return 'erro';
  if (total === 0) return 'tudo_enviado';
  if (!e.online) return 'sem_conexao';
  if (e.sincronizando) return 'sincronizando';
  if (e.falhou) return 'erro';
  return 'aguardando_envio';
}

const daInspecao = (op: OperacaoSync, id: string) =>
  op.tipo === 'verificacao.salvar'
    ? op.verificacao.id === id
    : op.tipo === 'evidencia.enviar'
      ? op.evidencia.verificacaoId === id
      : op.verificacaoId === id;

function useEstado(filtro?: (op: OperacaoSync) => boolean): EstadoSync | undefined {
  const { banco } = useInspecao();
  const fila = useEstadoFila();
  const itens = useLiveQuery(
    () => (filtro ? banco.fila.filter((i) => filtro(i.operacao)).toArray() : banco.fila.toArray()),
    [banco, filtro],
  );
  if (!itens) return undefined;
  const fotos = itens.filter((i) => i.operacao.tipo === 'evidencia.enviar').length;
  const pendencias = { operacoes: itens.length - fotos, fotos, recusas: [] };
  return {
    situacao: situacaoDe({ online: fila.online, sincronizando: fila.sincronizando, falhou: itens.some((i) => !!i.ultimoErro), pendencias }),
    pendencias,
  };
}

const semFiltro = undefined;
export function useSituacaoSyncGeral(): EstadoSync | undefined {
  return useEstado(semFiltro);
}

const nunca = () => false;
const filtros = new Map<string, (op: OperacaoSync) => boolean>();
export function useSituacaoSyncInspecao(id: string | undefined): EstadoSync | undefined {
  // filtro estável por id, para o useLiveQuery não reassinar a cada render
  let f = id ? filtros.get(id) : undefined;
  if (id && !f) filtros.set(id, (f = (op) => daInspecao(op, id)));
  return useEstado(f ?? nunca);
}
