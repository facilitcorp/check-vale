import type { OperacaoSync } from "@checkvale/shared";
import { banco, type OpFila } from "./banco";

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
 * Recusada volta para o FIM da fila como operação nova. O opId tem de mudar: o servidor
 * guarda a resposta de cada opId e devolveria a mesma recusa para sempre.
 */
async function devolverAFila(o: OpFila): Promise<void> {
  await banco.fila.delete(o.seq!);
  await banco.fila.add({ estado: "pendente", op: { ...o.op, opId: crypto.randomUUID(), criadaEm: new Date().toISOString() }, alvo: o.alvo, erro: null, rejeicao: null });
}

/**
 * Empilha uma operação. Snapshot da mesma entidade ainda PENDENTE é
 * substituído (ganha opId novo), para a fila não crescer a cada toque.
 * Operação "enviando" nunca é alterada: pode já ter chegado ao servidor.
 * Snapshot recusado da mesma entidade sai da fila: o novo traz o estado
 * inteiro, corrigido, e é ele que vale. As fotos dessa inspeção que foram
 * recusadas junto (o servidor não achou a inspeção) voltam DEPOIS dele.
 */
export async function enfileirar(nova: NovaOperacao): Promise<void> {
  const op = { ...nova, opId: crypto.randomUUID(), criadaEm: new Date().toISOString() } as OperacaoSync;
  const alvo = alvoDe(nova);
  await banco.transaction("rw", banco.fila, async () => {
    const pendente = await banco.fila.where({ alvo }).filter((o) => o.estado === "pendente").first();
    if (nova.tipo !== "evidencia.registrar") await banco.fila.where({ alvo }).filter((o) => o.estado === "rejeitada").delete();
    if (pendente && nova.tipo !== "evidencia.registrar") await banco.fila.update(pendente.seq!, { op });
    else await banco.fila.add({ estado: "pendente", op, alvo, erro: null });
    if (nova.tipo === "inspecao.salvar") {
      const fotos = await banco.fila.where("estado").equals("rejeitada").filter((o) => o.op.tipo === "evidencia.registrar" && o.op.evidencia.inspecaoId === nova.inspecao.id).sortBy("seq");
      for (const f of fotos) await devolverAFila(f);
    }
  });
  ouvintes.forEach((fn) => fn());
}

/** "Tentar agora": devolve à fila o que o servidor recusou, na ordem original (inspeção antes das fotos dela). */
export async function reenviarRejeitadas(): Promise<void> {
  await banco.transaction("rw", banco.fila, async () => {
    for (const o of await banco.fila.where("estado").equals("rejeitada").sortBy("seq")) await devolverAFila(o);
  });
  ouvintes.forEach((fn) => fn());
}

export async function contarPendentes(): Promise<number> {
  return banco.fila.where("estado").anyOf("pendente", "enviando").count();
}
