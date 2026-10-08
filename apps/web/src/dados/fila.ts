import type { OperacaoSync } from "@checkvale/shared";
import { banco } from "./banco";

type SemEnvelope<T> = T extends unknown ? Omit<T, "opId" | "criadaEm"> : never;
export type NovaOperacao = SemEnvelope<OperacaoSync>;

const alvoDe = (op: NovaOperacao) =>
  op.tipo === "veiculo.salvar" ? `veiculo:${op.veiculo.id}` : op.tipo === "inspecao.salvar" ? `inspecao:${op.inspecao.id}` : `evidencia:${op.evidencia.id}`;

/** Inspeção que a operação afeta: a própria ou a dona da foto. */
export const inspecaoDaOp = (op: NovaOperacao): string | null =>
  op.tipo === "inspecao.salvar" ? op.inspecao.id : op.tipo === "evidencia.registrar" ? op.evidencia.inspecaoId : null;

const ouvintes = new Set<() => void>();
/** Avisado a cada operação nova (o motor de sync usa para enviar logo). */
export function aoEnfileirar(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/**
 * Empilha uma operação. Snapshot da mesma entidade ainda PENDENTE é
 * substituído (ganha opId novo), para a fila não crescer a cada toque.
 * Operação "enviando" nunca é alterada: pode já ter chegado ao servidor.
 * Snapshot recusado da mesma entidade sai da fila: o novo traz o estado
 * inteiro, corrigido, e é ele que vale.
 */
export async function enfileirar(nova: NovaOperacao): Promise<void> {
  const op = { ...nova, opId: crypto.randomUUID(), criadaEm: new Date().toISOString() } as OperacaoSync;
  const alvo = alvoDe(nova);
  await banco.transaction("rw", banco.fila, async () => {
    const pendente = await banco.fila.where({ alvo }).filter((o) => o.estado === "pendente").first();
    if (nova.tipo !== "evidencia.registrar") await banco.fila.where({ alvo }).filter((o) => o.estado === "rejeitada").delete();
    if (pendente && nova.tipo !== "evidencia.registrar") await banco.fila.update(pendente.seq!, { op });
    else await banco.fila.add({ estado: "pendente", op, alvo, erro: null });
  });
  ouvintes.forEach((fn) => fn());
}

/** Devolve à fila o que o servidor recusou (o inspetor pede de novo, ex.: depois de atualizar o app). */
export async function reenviarRejeitadas(): Promise<void> {
  await banco.fila.where("estado").equals("rejeitada").modify({ estado: "pendente", erro: null });
  ouvintes.forEach((fn) => fn());
}

export async function contarPendentes(): Promise<number> {
  return banco.fila.where("estado").anyOf("pendente", "enviando").count();
}
