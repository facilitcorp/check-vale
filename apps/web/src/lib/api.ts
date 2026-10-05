import type { ErroApi } from "@checkvale/shared";

/** Sem rede / servidor inalcançável: o app segue offline e tenta depois. */
export class ErroRede extends Error {}

/** Resposta de erro da API (4xx/5xx) com mensagem pronta para o usuário. */
export class ErroDaApi extends Error {
  constructor(public status: number, public codigo: string, mensagem: string, public erros?: string[]) {
    super(mensagem);
  }
}

let token: string | null = null;
let aoExpirar: (() => void) | null = null;

export function definirToken(t: string | null) {
  token = t;
}
export function aoSessaoExpirar(fn: () => void) {
  aoExpirar = fn;
}

/**
 * Rede de campo trava sem cair. Sem prazo, uma chamada pendurada segura a
 * sincronização inteira (as rodadas seguintes esperam por ela).
 */
export const TEMPO_LIMITE_MS = 60_000;

export async function chamarApi<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && typeof init.body === "string") headers.set("Content-Type", "application/json");
  let r: Response;
  try {
    r = await fetch(`/api${caminho}`, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(TEMPO_LIMITE_MS) });
  } catch {
    throw new ErroRede("Sem conexão com o servidor.");
  }
  if (r.status === 304) return undefined as T;
  if (!r.ok) {
    const corpo = (await r.json().catch(() => null)) as (ErroApi & { erros?: string[] }) | null;
    if (r.status === 401 && token) aoExpirar?.();
    // 502/503/504 = servidor fora / proxy sem backend: tratar como sem rede.
    if (r.status >= 502) throw new ErroRede("Servidor indisponível.");
    throw new ErroDaApi(r.status, corpo?.erro ?? "erro", corpo?.mensagem ?? `Erro ${r.status}`, corpo?.erros);
  }
  const tipo = r.headers.get("content-type") ?? "";
  return (tipo.includes("application/json") ? r.json() : r.blob()) as Promise<T>;
}
