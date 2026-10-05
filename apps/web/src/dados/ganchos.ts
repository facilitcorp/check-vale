import { aplicarRegras, calcularResultado, contextoDaInspecao } from "@checkvale/shared";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { banco, chaveModelo } from "./banco";
import { useEstadoSyncGlobal } from "./estadoSync";

/** Catálogo em cache no aparelho (undefined = carregando, null = ainda não baixado). */
export function useCatalogo() {
  return useLiveQuery(async () => (await banco.catalogo.get("atual"))?.catalogo ?? null, []);
}

export function useVeiculos() {
  return useLiveQuery(() => banco.veiculos.toArray(), []);
}

/** undefined = carregando; null = não existe neste aparelho. */
export function useInspecao(id: string | undefined) {
  // get() devolve undefined quando não acha, o mesmo valor de "carregando": converte para null.
  return useLiveQuery(async () => (id ? ((await banco.inspecoes.get(id)) ?? null) : null), [id]);
}

/**
 * Tudo que as telas 5–12 precisam, já resolvido: inspeção, modelo RECORTADO
 * pelas regras (retrato do veículo) e resultado calculado sobre ele.
 * modelo = null com inspeção carregada → versão não está no aparelho (sincronizar).
 * Durante a 1ª sincronização da sessão (com rede), versão ausente conta como "carregando": num
 * aparelho novo o sync grava as inspeções antes de baixar as versões antigas, e com sinal fraco
 * essa janela aparecia como "Checklist indisponível… Conecte-se" com o aparelho online. Só a 1ª:
 * nas seguintes, uma versão que falta de verdade não alterna com "Carregando…" a cada rodada.
 */
export function useChecklistDaInspecao(id: string | undefined) {
  const inspecao = useInspecao(id);
  const chave = inspecao ? chaveModelo(inspecao.modeloId, inspecao.modeloVersao) : undefined;
  // Versão exata da inspeção, mesmo que o admin já tenha publicado outra. Enquanto a leitura
  // não chega, o useLiveQuery devolve o resultado da chave anterior: sem conferir a chave, esse
  // valor velho aparecia como "Checklist indisponível" (ou como o checklist de outra versão).
  const sync = useEstadoSyncGlobal();
  // Muda poucas vezes por sessão (não a cada rodada de 30 s), para não reler à toa.
  const fase = sync === null || (sync.ultimaEm === null && sync.sincronizando && sync.online) ? "baixando" : sync.ultimaEm === null ? "sem-sync" : "sincronizado";
  const lido = useLiveQuery(
    async () => (chave ? { chave, fase, modelo: (await banco.modelos.get(chave)) ?? null } : undefined),
    [chave, fase],
  );
  return useMemo(() => {
    if (inspecao === undefined) return { carregando: true as const };
    if (!inspecao) return { carregando: false as const, inspecao: null, modelo: null, resultado: null };
    if (inspecao.id !== id || !lido || lido.chave !== chave) return { carregando: true as const };
    const completo = lido.modelo;
    // Sem a versão: espera o fim da 1ª sincronização E uma leitura feita depois dele. O aviso de
    // fim do sync chega antes do liveQuery com a última versão baixada; sem conferir a fase da
    // leitura, esse instante aparecia como "indisponível".
    if (!completo && (fase === "baixando" || lido.fase !== fase)) return { carregando: true as const };
    const modelo = completo ? aplicarRegras(completo, contextoDaInspecao(inspecao)) : null;
    return { carregando: false as const, inspecao, modelo, resultado: modelo ? calcularResultado(modelo, inspecao.respostas) : null };
  }, [id, inspecao, chave, lido, fase]);
}
