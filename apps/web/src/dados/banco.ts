import Dexie, { type EntityTable } from "dexie";
import type { Catalogo, Evidencia, Inspecao, OperacaoSync, Usuario, Veiculo } from "@checkvale/shared";

/** Sessão salva no aparelho: permite reabrir o app sem rede enquanto o token valer. */
export interface SessaoLocal {
  chave: "atual";
  token: string;
  expiraEm: string;
  usuario: Usuario;
}

export interface CatalogoLocal {
  chave: "atual";
  catalogo: Catalogo;
}

/** Foto guardada no aparelho até subir. */
export interface EvidenciaLocal extends Evidencia {
  arquivo: Blob;
  /** true depois do PUT do binário com sucesso. */
  enviada: boolean;
}

export type EstadoOp = "pendente" | "enviando" | "rejeitada";

export interface OpFila {
  seq?: number;
  estado: EstadoOp;
  op: OperacaoSync;
  /** Chave da entidade, para juntar snapshots repetidos ainda não enviados. */
  alvo: string;
  erro: string | null;
}

export interface Meta {
  chave: string;
  valor: string;
}

export class BancoCheckVale extends Dexie {
  sessao!: EntityTable<SessaoLocal, "chave">;
  catalogo!: EntityTable<CatalogoLocal, "chave">;
  veiculos!: EntityTable<Veiculo, "id">;
  inspecoes!: EntityTable<Inspecao, "id">;
  evidencias!: EntityTable<EvidenciaLocal, "id">;
  fila!: EntityTable<OpFila, "seq">;
  meta!: EntityTable<Meta, "chave">;

  constructor(nome = "checkvale") {
    super(nome);
    this.version(1).stores({
      sessao: "chave",
      catalogo: "chave",
      veiculos: "id, placa, tipoVeiculoId",
      inspecoes: "id, status, veiculoId, iniciadaEm",
      evidencias: "id, inspecaoId, [inspecaoId+itemId], enviada",
      fila: "++seq, estado, alvo",
      meta: "chave",
    });
  }
}

export const banco = new BancoCheckVale();

export async function lerMeta(chave: string): Promise<string | null> {
  return (await banco.meta.get(chave))?.valor ?? null;
}
export async function gravarMeta(chave: string, valor: string): Promise<void> {
  await banco.meta.put({ chave, valor });
}

/** Id estável deste aparelho (para auditoria do sync). */
export async function idDispositivo(): Promise<string> {
  let id = await lerMeta("dispositivoId");
  if (!id) {
    id = crypto.randomUUID();
    await gravarMeta("dispositivoId", id);
  }
  return id;
}
