import type { ModeloChecklist } from "./dominio";
import { avaliarRegra, especificidade, type ContextoRegras } from "./regras";

/**
 * Escolhe o modelo de checklist para o contexto da inspeção: entre os que
 * servem (regra `aplicavel` do modelo), vence o mais específico; empate → maior versão.
 */
export function escolherModelo(modelos: readonly ModeloChecklist[], ctx: ContextoRegras): ModeloChecklist | null {
  return (
    modelos
      .filter((m) => avaliarRegra(m.aplicavel, ctx))
      .sort((a, b) => especificidade(b.aplicavel) - especificidade(a.aplicavel) || b.versao - a.versao)[0] ?? null
  );
}
