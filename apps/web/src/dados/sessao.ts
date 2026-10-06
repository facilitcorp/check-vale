import { useSyncExternalStore } from "react";
import type { LoginSaida, Usuario } from "@checkvale/shared";
import { aoSessaoExpirar, chamarApi, definirToken } from "../lib/api";
import { banco } from "./banco";

/**
 * Sessão: o login exige rede; depois disso o app abre offline enquanto o
 * token valer. Sair apaga só a sessão — dados não sincronizados ficam no aparelho.
 */
let usuario: Usuario | null = null;
/** Objeto trocado a cada mudança: o React só re-renderiza quando a referência muda. */
let estado: { usuario: Usuario | null; carregada: boolean } = { usuario: null, carregada: false };
const ouvintes = new Set<() => void>();
const avisar = () => {
  estado = { usuario, carregada: true };
  ouvintes.forEach((fn) => fn());
};

export async function carregarSessao(): Promise<Usuario | null> {
  const s = await banco.sessao.get("atual");
  if (s && new Date(s.expiraEm) > new Date()) {
    definirToken(s.token);
    usuario = s.usuario;
  } else {
    usuario = null;
  }
  avisar();
  return usuario;
}

export function entrar(email: string, senha: string): Promise<Usuario> {
  return abrirSessao("/auth/login", email, senha);
}

/** Autocadastro temporário: cria a conta de inspetor e já entra. */
export function cadastrar(email: string, senha: string): Promise<Usuario> {
  return abrirSessao("/auth/cadastro", email, senha);
}

async function abrirSessao(caminho: string, email: string, senha: string): Promise<Usuario> {
  const r = await chamarApi<LoginSaida>(caminho, { method: "POST", body: JSON.stringify({ email, senha }) });
  await banco.sessao.put({ chave: "atual", token: r.token, expiraEm: r.expiraEm, usuario: r.usuario });
  definirToken(r.token);
  usuario = r.usuario;
  avisar();
  return r.usuario;
}

export async function sair(): Promise<void> {
  await banco.sessao.delete("atual");
  definirToken(null);
  usuario = null;
  avisar();
}

aoSessaoExpirar(() => void sair());

export function useSessao(): { usuario: Usuario | null; carregada: boolean } {
  return useSyncExternalStore(
    (fn) => (ouvintes.add(fn), () => void ouvintes.delete(fn)),
    () => estado,
  );
}
