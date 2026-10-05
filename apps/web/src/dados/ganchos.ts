import { aplicarRegras, calcularResultado, contextoDaInspecao } from "@checkvale/shared";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { banco } from "./banco";

/** Catálogo em cache no aparelho (undefined = carregando, null = ainda não baixado). */
export function useCatalogo() {
  return useLiveQuery(async () => (await banco.catalogo.get("atual"))?.catalogo ?? null, []);
}

export function useVeiculos() {
  return useLiveQuery(() => banco.veiculos.toArray(), []);
}

export function useInspecao(id: string | undefined) {
  return useLiveQuery(() => (id ? banco.inspecoes.get(id) : undefined), [id]);
}

/**
 * Tudo que as telas 5–12 precisam, já resolvido: inspeção, modelo RECORTADO
 * pelas regras (retrato do veículo) e resultado calculado sobre ele.
 * modelo = null com inspeção carregada → versão não está no aparelho (sincronizar).
 */
export function useChecklistDaInspecao(id: string | undefined) {
  const inspecao = useInspecao(id);
  const catalogo = useCatalogo();
  return useMemo(() => {
    if (inspecao === undefined || catalogo === undefined) return { carregando: true as const };
    if (!inspecao) return { carregando: false as const, inspecao: null, modelo: null, resultado: null };
    const completo = catalogo?.modelos.find((m) => m.id === inspecao.modeloId && m.versao === inspecao.modeloVersao) ?? null;
    const modelo = completo ? aplicarRegras(completo, contextoDaInspecao(inspecao)) : null;
    return { carregando: false as const, inspecao, modelo, resultado: modelo ? calcularResultado(modelo, inspecao.respostas) : null };
  }, [inspecao, catalogo]);
}
