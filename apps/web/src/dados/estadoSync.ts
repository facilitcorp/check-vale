import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { banco } from "./banco";
import { observarSync, type EstadoSync } from "./sincronizacao";

/**
 * Estados de sincronização padronizados (mesmo texto em todo o app).
 * Regra: dado nunca some calado — se não subiu, a tela mostra por quê.
 */
export type SituacaoSync = "salvo_no_aparelho" | "sem_conexao" | "aguardando_envio" | "sincronizando" | "tudo_enviado" | "erro";

export const ROTULO_SYNC: Record<SituacaoSync, string> = {
  salvo_no_aparelho: "Salvo no aparelho",
  sem_conexao: "Sem conexão",
  aguardando_envio: "Aguardando envio",
  sincronizando: "Sincronizando",
  tudo_enviado: "Tudo enviado",
  erro: "Erro ao sincronizar",
};

export interface PendenciasInspecao {
  /** Snapshots da inspeção + metadados de foto ainda na fila. */
  operacoes: number;
  /** Fotos guardadas no aparelho que ainda não subiram. */
  fotos: number;
  /** Mensagens do servidor para o que foi recusado (não será reenviado). */
  recusas: string[];
}

/** Situação a partir do estado global + pendências (função pura, testável). */
export function situacaoSync(g: Pick<EstadoSync, "online" | "sincronizando" | "erro">, p: PendenciasInspecao | null): SituacaoSync {
  if (p && p.recusas.length) return "erro";
  const pendente = p ? p.operacoes + p.fotos > 0 : false;
  if (!pendente && p) return "tudo_enviado";
  if (!g.online) return "sem_conexao";
  if (g.erro) return "erro";
  if (g.sincronizando) return "sincronizando";
  return pendente ? "aguardando_envio" : "tudo_enviado";
}

export function useEstadoSyncGlobal(): EstadoSync | null {
  const [e, setE] = useState<EstadoSync | null>(null);
  useEffect(() => observarSync(setE), []);
  return e;
}

/** Pendências de UMA inspeção no aparelho (reativo). */
export function usePendenciasInspecao(inspecaoId: string | undefined): PendenciasInspecao | undefined {
  return useLiveQuery(async () => {
    if (!inspecaoId) return { operacoes: 0, fotos: 0, recusas: [] };
    const ops = await banco.fila
      .filter((o) =>
        o.alvo === `inspecao:${inspecaoId}` || (o.op.tipo === "evidencia.registrar" && o.op.evidencia.inspecaoId === inspecaoId),
      )
      .toArray();
    const fotos = await banco.evidencias.where("inspecaoId").equals(inspecaoId).filter((e) => !e.enviada).count();
    return {
      operacoes: ops.filter((o) => o.estado !== "rejeitada").length,
      fotos,
      recusas: ops.filter((o) => o.estado === "rejeitada").map((o) => o.erro ?? "Recusado pelo servidor."),
    };
  }, [inspecaoId]);
}

/** Situação de sincronização de uma inspeção, pronta para exibir (ROTULO_SYNC[situacao]). */
export function useSituacaoSyncInspecao(inspecaoId: string | undefined) {
  const global = useEstadoSyncGlobal();
  const pend = usePendenciasInspecao(inspecaoId);
  if (!global || !pend) return null;
  return { situacao: situacaoSync(global, pend), pendencias: pend };
}

/** Situação geral do aparelho (cabeçalho / home). */
export function useSituacaoSyncGeral() {
  const global = useEstadoSyncGlobal();
  const recusas = useLiveQuery(async () => (await banco.fila.where("estado").equals("rejeitada").toArray()).map((o) => o.erro ?? "Recusado pelo servidor."), []);
  const fotos = useLiveQuery(() => banco.evidencias.filter((e) => !e.enviada).count(), []);
  if (!global || recusas === undefined || fotos === undefined) return null;
  const pend: PendenciasInspecao = { operacoes: global.pendentes, fotos, recusas };
  return { situacao: situacaoSync(global, pend), pendencias: pend, ultimaEm: global.ultimaEm };
}
