import { useEffect, useState } from 'react';
import { repositorioInspecao } from '../dados/repositorio';
import { useEstadoSyncGlobal } from '../dados/estadoSync';
import { sincronizar } from '../dados/sincronizacao';
import { reenviarRejeitadas } from '../dados/fila';

/**
 * Utilidades de tela do fluxo da inspeção. Dado, regra e sync vêm da fundação
 * (dados/ganchos, dados/estadoSync, dados/repositorio, dados/sincronizacao).
 */

/** Sem rede? Usa o estado global do motor de sync (mesma fonte do cabeçalho). */
export function useOnline(): boolean {
  return useEstadoSyncGlobal()?.online ?? true;
}

/** URL temporária da foto guardada no aparelho (liberada ao desmontar). null = foto só no servidor. */
export function useUrlEvidencia(id: string): string | null | undefined {
  const [url, setUrl] = useState<string | null>();
  useEffect(() => {
    let atual: string | undefined;
    let vivo = true;
    void repositorioInspecao.arquivoEvidencia(id).then((blob) => {
      if (!vivo) return;
      if (!blob) return setUrl(null);
      atual = URL.createObjectURL(blob);
      setUrl(atual);
    });
    return () => {
      vivo = false;
      if (atual) URL.revokeObjectURL(atual);
    };
  }, [id]);
  return url;
}

/** "Tentar agora": devolve à fila o que o servidor recusou e força uma rodada de sincronização. */
export function useTentarAgora(): () => void {
  return () => void reenviarRejeitadas().then(sincronizar);
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
