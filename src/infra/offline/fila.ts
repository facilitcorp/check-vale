import type { OperacaoSync } from '@/contracts/checklist';
import type { BancoLocal, ItemFilaLocal } from './banco';

let ultimaSeq = 0;
/** Ordem estrita de inserção, mesmo com vários itens no mesmo milissegundo. */
function proximaSeq(): number {
  ultimaSeq = Math.max(ultimaSeq + 1, Date.now() * 1000);
  return ultimaSeq;
}

/**
 * Quem efetivamente fala com a API. A fundação fornece a implementação HTTP;
 * aqui só existe o contrato, para a fila não depender de rota nem de auth.
 * Deve lançar erro em falha de rede/5xx (a fila tenta de novo depois).
 */
export interface TransporteSync {
  enviar(operacao: OperacaoSync, anexo?: Blob): Promise<void>;
}

export interface EstadoFila {
  pendentes: number;
  sincronizando: boolean;
  ultimoErro?: string;
}

type Ouvinte = (estado: EstadoFila) => void;

export class FilaSincronizacao {
  private ouvintes = new Set<Ouvinte>();
  private rodando = false;
  private ultimoErro?: string;

  constructor(
    private readonly banco: BancoLocal,
    private readonly transporte: TransporteSync,
    private readonly gerarId: () => string = () => crypto.randomUUID(),
  ) {}

  async enfileirar(operacao: OperacaoSync): Promise<void> {
    // Salvar a mesma verificação várias vezes offline não precisa subir N
    // versões: atualiza o item pendente no mesmo lugar da fila, preservando
    // a ordem em relação a evidências e à conclusão.
    if (operacao.tipo === 'verificacao.salvar') {
      const id = operacao.verificacao.id;
      const pendente = await this.banco.fila
        .filter((i) => i.operacao.tipo === 'verificacao.salvar' && i.operacao.verificacao.id === id)
        .first();
      if (pendente) {
        await this.banco.fila.update(pendente.id, { operacao, rev: pendente.rev + 1 });
        await this.notificar();
        return;
      }
    }
    const item: ItemFilaLocal = {
      id: this.gerarId(),
      seq: proximaSeq(),
      rev: 0,
      operacao,
      criadoEm: new Date().toISOString(),
      tentativas: 0,
    };
    await this.banco.fila.add(item);
    await this.notificar();
  }

  /**
   * Envia em ordem de criação. Para no primeiro erro, para não mandar
   * "concluir" antes do "salvar" daquela verificação.
   */
  async processar(): Promise<void> {
    if (this.rodando) return;
    this.rodando = true;
    await this.notificar();
    try {
      const itens = await this.banco.fila.orderBy('seq').toArray();
      for (const item of itens) {
        try {
          let anexo: Blob | undefined;
          if (item.operacao.tipo === 'evidencia.enviar') {
            anexo = (await this.banco.evidencias.get(item.operacao.evidencia.id))?.blob;
          }
          await this.transporte.enviar(item.operacao, anexo);
          await this.banco.transaction('rw', this.banco.fila, this.banco.evidencias, async () => {
            // Se a tela regravou este item enquanto ele subia, mantém a versão nova na fila.
            const atual = await this.banco.fila.get(item.id);
            if (atual && atual.rev === item.rev) await this.banco.fila.delete(item.id);
            if (item.operacao.tipo === 'evidencia.enviar') {
              await this.banco.evidencias.update(item.operacao.evidencia.id, { enviada: true });
            }
          });
          this.ultimoErro = undefined;
        } catch (e) {
          this.ultimoErro = e instanceof Error ? e.message : String(e);
          await this.banco.fila.update(item.id, {
            tentativas: item.tentativas + 1,
            ultimoErro: this.ultimoErro,
          });
          break;
        }
      }
    } finally {
      this.rodando = false;
      await this.notificar();
    }
  }

  async estado(): Promise<EstadoFila> {
    return {
      pendentes: await this.banco.fila.count(),
      sincronizando: this.rodando,
      ultimoErro: this.ultimoErro,
    };
  }

  assinar(ouvinte: Ouvinte): () => void {
    this.ouvintes.add(ouvinte);
    void this.estado().then(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }

  /** Tenta subir ao voltar a rede e periodicamente. Retorna o "desligar". */
  iniciarAutomatico(intervaloMs = 30_000): () => void {
    const tentar = () => {
      if (navigator.onLine) void this.processar();
    };
    window.addEventListener('online', tentar);
    const timer = window.setInterval(tentar, intervaloMs);
    tentar();
    return () => {
      window.removeEventListener('online', tentar);
      window.clearInterval(timer);
    };
  }

  private async notificar() {
    if (this.ouvintes.size === 0) return;
    const e = await this.estado();
    this.ouvintes.forEach((o) => o(e));
  }
}
