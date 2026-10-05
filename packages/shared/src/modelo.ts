import type { ModeloChecklist } from "./dominio";

/**
 * Escolhe o modelo de checklist para o contexto da inspeção.
 * Um modelo serve se cada filtro dele estiver vazio (= todos) ou contiver o valor.
 * Entre os que servem, vence o mais específico (mais filtros preenchidos);
 * empate → maior versão.
 */
export function escolherModelo(
  modelos: readonly ModeloChecklist[],
  ctx: { tipoVeiculoId: string; areaId: string; atividadeId: string },
): ModeloChecklist | null {
  const serve = (lista: string[], v: string) => lista.length === 0 || lista.includes(v);
  const peso = (m: ModeloChecklist) => [m.tipoVeiculoIds, m.areaIds, m.atividadeIds].filter((l) => l.length > 0).length;
  return (
    modelos
      .filter((m) => serve(m.tipoVeiculoIds, ctx.tipoVeiculoId) && serve(m.areaIds, ctx.areaId) && serve(m.atividadeIds, ctx.atividadeId))
      .sort((a, b) => peso(b) - peso(a) || b.versao - a.versao)[0] ?? null
  );
}
