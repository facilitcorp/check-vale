import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ModeloChecklist, RecortarModelo, Verificacao } from '@/contracts/checklist';
import type { BancoLocal } from '@/infra/offline/banco';
import type { EstadoFila, FilaSincronizacao } from '@/infra/offline/fila';
import { MARCA_PADRAO, type Marca } from '@/infra/branding/marca';
import { RepositorioInspecao } from './dados/repositorio';

interface Dependencias {
  banco: BancoLocal;
  fila: FilaSincronizacao;
  repo: RepositorioInspecao;
  marca: Marca;
  /** Abre o PDF da verificação (API da fundação). Sem isso, o botão fica desabilitado. */
  abrirRelatorio?: (verificacaoId: string) => void;
  recortar: RecortarModelo;
  rotaNovaVerificacao: string;
}

const Ctx = createContext<Dependencias | null>(null);

/** A fundação monta banco, fila (com o transporte HTTP real) e marca e injeta aqui. */
export function ProvedorInspecao(props: {
  banco: BancoLocal;
  fila: FilaSincronizacao;
  marca?: Marca;
  abrirRelatorio?: (verificacaoId: string) => void;
  /** Regras de aplicabilidade (na integração: aplicarRegras + contextoDaInspecao). */
  recortar?: RecortarModelo;
  /** Rota do início do fluxo de nova verificação (operação → veículo), da fundação. */
  rotaNovaVerificacao?: string;
  children: ReactNode;
}) {
  const [deps] = useState<Dependencias>(() => {
    const recortar = props.recortar ?? ((m: ModeloChecklist) => m);
    return {
      banco: props.banco,
      fila: props.fila,
      repo: new RepositorioInspecao(props.banco, props.fila, undefined, undefined, recortar),
      marca: props.marca ?? MARCA_PADRAO,
      abrirRelatorio: props.abrirRelatorio,
      recortar,
      rotaNovaVerificacao: props.rotaNovaVerificacao ?? '/nova-verificacao',
    };
  });
  return <Ctx.Provider value={deps}>{props.children}</Ctx.Provider>;
}

export function useInspecao(): Dependencias {
  const d = useContext(Ctx);
  if (!d) throw new Error('useInspecao fora do ProvedorInspecao');
  return d;
}

export type DadosVerificacao =
  | undefined // carregando
  | null // verificação não existe neste aparelho
  | { verificacao: Verificacao; modelo: null } // versão do checklist não está no aparelho
  | { verificacao: Verificacao; modelo: ModeloChecklist };

/**
 * Verificação + modelo JÁ RECORTADO pelas regras, atualizados sozinhos quando o
 * banco local muda. Todas as telas leem por aqui: progresso, índice e plano
 * nunca veem item fora da regra.
 */
export function useVerificacao(id: string | undefined): DadosVerificacao {
  const { banco, recortar } = useInspecao();
  return useLiveQuery(async (): Promise<DadosVerificacao> => {
    if (!id) return null;
    const verificacao = await banco.verificacoes.get(id);
    if (!verificacao) return null;
    const m = await banco.modelos.get(`${verificacao.modeloId}@${verificacao.modeloVersao}`);
    if (!m) return { verificacao, modelo: null };
    const { chave: _c, ...modelo } = m;
    return { verificacao, modelo: recortar(modelo, verificacao) };
  }, [id, recortar]);
}

export function useEstadoFila(): EstadoFila & { online: boolean } {
  const { fila } = useInspecao();
  const [estado, setEstado] = useState<EstadoFila>({ pendentes: 0, sincronizando: false });
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => fila.assinar(setEstado), [fila]);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return { ...estado, online };
}

/** URL temporária da foto guardada no aparelho (liberada ao desmontar). */
export function useUrlEvidencia(id: string): string | undefined {
  const { repo } = useInspecao();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let atual: string | undefined;
    let vivo = true;
    void repo.evidencia(id).then((e) => {
      if (!vivo || !e) return;
      atual = URL.createObjectURL(e.blob);
      setUrl(atual);
    });
    return () => {
      vivo = false;
      if (atual) URL.revokeObjectURL(atual);
    };
  }, [id, repo]);
  return url;
}

/** "Tentar agora": força uma tentativa de envio da fila. */
export function useTentarAgora(): () => void {
  const { fila } = useInspecao();
  return () => void fila.processar();
}

const EVENTO_SALVO = 'checkvale:salvo';
let ultimoSalvoEm = 0;
/** Dispara o aviso rápido "Salvo no aparelho". Sobrevive à troca de tela: a tela nova lê o horário. */
export function avisarSalvo() {
  ultimoSalvoEm = Date.now();
  window.dispatchEvent(new Event(EVENTO_SALVO));
}
export function useAvisoSalvo(duracaoMs = 2000): boolean {
  const [visivel, setVisivel] = useState(() => Date.now() - ultimoSalvoEm < duracaoMs);
  useEffect(() => {
    let t: number | undefined;
    const agendarFim = () => {
      window.clearTimeout(t);
      const resta = duracaoMs - (Date.now() - ultimoSalvoEm);
      if (resta <= 0) return setVisivel(false);
      setVisivel(true);
      t = window.setTimeout(() => setVisivel(false), resta);
    };
    agendarFim();
    window.addEventListener(EVENTO_SALVO, agendarFim);
    return () => {
      window.removeEventListener(EVENTO_SALVO, agendarFim);
      window.clearTimeout(t);
    };
  }, [duracaoMs]);
  return visivel;
}
