import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ModeloChecklist, Verificacao } from '@/contracts/checklist';
import type { BancoLocal } from '@/infra/offline/banco';
import type { EstadoFila, FilaSincronizacao } from '@/infra/offline/fila';
import { MARCA_PADRAO, type Marca } from '@/infra/branding/marca';
import { RepositorioInspecao } from './dados/repositorio';

interface Dependencias {
  banco: BancoLocal;
  fila: FilaSincronizacao;
  repo: RepositorioInspecao;
  marca: Marca;
}

const Ctx = createContext<Dependencias | null>(null);

/** A fundação monta banco, fila (com o transporte HTTP real) e marca e injeta aqui. */
export function ProvedorInspecao(props: {
  banco: BancoLocal;
  fila: FilaSincronizacao;
  marca?: Marca;
  children: ReactNode;
}) {
  const [deps] = useState<Dependencias>(() => ({
    banco: props.banco,
    fila: props.fila,
    repo: new RepositorioInspecao(props.banco, props.fila),
    marca: props.marca ?? MARCA_PADRAO,
  }));
  return <Ctx.Provider value={deps}>{props.children}</Ctx.Provider>;
}

export function useInspecao(): Dependencias {
  const d = useContext(Ctx);
  if (!d) throw new Error('useInspecao fora do ProvedorInspecao');
  return d;
}

/** Verificação + modelo, atualizados sozinhos quando o banco local muda. */
export function useVerificacao(id: string | undefined) {
  const { banco } = useInspecao();
  return useLiveQuery(async () => {
    if (!id) return null;
    const verificacao = await banco.verificacoes.get(id);
    if (!verificacao) return null;
    const m = await banco.modelos.get(`${verificacao.modeloId}@${verificacao.modeloVersao}`);
    if (!m) return null;
    const { chave: _c, ...modelo } = m;
    return { verificacao, modelo } as { verificacao: Verificacao; modelo: ModeloChecklist };
  }, [id]);
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
