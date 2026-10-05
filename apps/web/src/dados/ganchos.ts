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
