import { useCallback, useEffect, useState } from "react";
import { chamarApi, ErroDaApi } from "../lib/api";

/** Admin trabalha online, direto na API (não passa pela fila offline do inspetor). */
export function useRecurso<T>(caminho: string | null) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const recarregar = useCallback(async () => {
    if (!caminho) return;
    setCarregando(true);
    try {
      setDados(await chamarApi<T>(caminho));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [caminho]);
  useEffect(() => void recarregar(), [recarregar]);
  return { dados, erro, carregando, recarregar, setDados };
}

export const enviar = <T,>(metodo: "POST" | "PATCH" | "PUT", caminho: string, corpo?: unknown) =>
  chamarApi<T>(caminho, { method: metodo, body: corpo === undefined ? undefined : JSON.stringify(corpo) });

/** Mensagem + lista de erros (422 de publicação, 400 de atributos). */
export function textoErro(e: unknown): { mensagem: string; erros: string[] } {
  if (e instanceof ErroDaApi) return { mensagem: e.message, erros: e.erros ?? [] };
  return { mensagem: (e as Error).message, erros: [] };
}
