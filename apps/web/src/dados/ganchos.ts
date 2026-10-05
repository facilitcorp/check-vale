import { aplicarRegras, calcularResultado, contextoDaInspecao } from "@checkvale/shared";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { banco, chaveModelo } from "./banco";

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
 */
export function useChecklistDaInspecao(id: string | undefined) {
  const inspecao = useInspecao(id);
  const chave = inspecao ? chaveModelo(inspecao.modeloId, inspecao.modeloVersao) : undefined;
  // Versão exata da inspeção, mesmo que o admin já tenha publicado outra. Enquanto a leitura
  // não chega, o useLiveQuery devolve o resultado da chave anterior: sem conferir a chave, esse
  // valor velho aparecia como "Checklist indisponível" (ou como o checklist de outra versão).
  const lido = useLiveQuery(async () => (chave ? { chave, modelo: (await banco.modelos.get(chave)) ?? null } : undefined), [chave]);
  return useMemo(() => {
    if (inspecao === undefined) return { carregando: true as const };
    if (!inspecao) return { carregando: false as const, inspecao: null, modelo: null, resultado: null };
    if (inspecao.id !== id || !lido || lido.chave !== chave) return { carregando: true as const };
    const completo = lido.modelo;
    const modelo = completo ? aplicarRegras(completo, contextoDaInspecao(inspecao)) : null;
    return { carregando: false as const, inspecao, modelo, resultado: modelo ? calcularResultado(modelo, inspecao.respostas) : null };
  }, [id, inspecao, chave, lido]);
}
