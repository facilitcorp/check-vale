import Dexie, { type EntityTable } from 'dexie';
import type { Evidencia, ItemFila, ModeloChecklist, Verificacao } from '@/contracts/checklist';

/** Foto guardada no aparelho até subir. O blob nunca vai para a fila em si. */
export interface EvidenciaLocal extends Evidencia {
  blob: Blob;
  enviada: boolean;
  /** Já tinha subido quando o inspetor tirou do item: fica só sem vínculo. */
  removida?: boolean;
}

/** Item da fila com a ordem de inserção (só existe no aparelho). */
export interface ItemFilaLocal extends ItemFila {
  seq: number;
  /** Sobe a cada atualização no lugar; evita apagar versão nova após enviar a velha. */
  rev: number;
}

/**
 * Armazenamento local (IndexedDB). É a fonte da verdade da inspeção no
 * aparelho: a tela lê e grava aqui; a fila leva para a API quando houver rede.
 */
export class BancoLocal extends Dexie {
  verificacoes!: EntityTable<Verificacao, 'id'>;
  evidencias!: EntityTable<EvidenciaLocal, 'id'>;
  fila!: EntityTable<ItemFilaLocal, 'id'>;
  modelos!: EntityTable<ModeloChecklist & { chave: string }, 'chave'>;

  constructor(nome = 'checkvale') {
    super(nome);
    this.version(1).stores({
      verificacoes: 'id, status, iniciadaEm',
      evidencias: 'id, [verificacaoId+itemId], verificacaoId',
      fila: 'id, seq',
      modelos: 'chave, id',
    });
  }
}

export const chaveModelo = (id: string, versao: number) => `${id}@${versao}`;
