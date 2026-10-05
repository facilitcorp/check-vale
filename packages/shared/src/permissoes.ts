import type { Papel } from "./dominio";

/**
 * RBAC. Rotas e telas checam PERMISSÃO, nunca o nome do papel — assim um
 * perfil novo (gestor, auditor...) é só uma linha nova neste mapa.
 */
export const PERMISSOES = [
  "inspecao:executar", // fazer checklist no app
  "inspecao:ver_todas", // ver/baixar inspeções de outros
  "config:ler", // ver cadastros e modelos (inclusive rascunhos)
  "config:editar", // cadastrar operação, veículos, atributos, modelos
  "modelo:publicar", // publicar versão de checklist
  "usuario:gerenciar",
] as const;
export type Permissao = (typeof PERMISSOES)[number];

export const PERMISSOES_POR_PAPEL: Record<Papel, readonly Permissao[]> = {
  admin: PERMISSOES,
  inspetor: ["inspecao:executar"],
};

export const pode = (papel: Papel, p: Permissao) => PERMISSOES_POR_PAPEL[papel]?.includes(p) ?? false;
