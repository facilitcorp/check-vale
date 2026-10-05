import type {
  ModeloChecklist,
  RecortarModelo,
  NaoConformidade,
  Resposta,
  StatusItem,
  Verificacao,
} from '@/contracts/checklist';
import { chaveModelo, type BancoLocal, type EvidenciaLocal } from '@/infra/offline/banco';
import type { FilaSincronizacao } from '@/infra/offline/fila';
import { podeConcluir } from '../dominio/resultado';

export interface DadosResposta {
  status: StatusItem;
  observacao?: string;
  naoConformidade?: NaoConformidade;
}

/**
 * Único ponto de escrita das telas da inspeção. Grava no aparelho primeiro e
 * enfileira para a API; a tela nunca chama HTTP direto.
 */
export class RepositorioInspecao {
  constructor(
    private readonly banco: BancoLocal,
    private readonly fila: FilaSincronizacao,
    private readonly agora: () => Date = () => new Date(),
    private readonly gerarId: () => string = () => crypto.randomUUID(),
    private readonly recortar: RecortarModelo = (m) => m,
  ) {}

  async obter(id: string): Promise<Verificacao | undefined> {
    return this.banco.verificacoes.get(id);
  }

  async modeloDe(v: Verificacao): Promise<ModeloChecklist | undefined> {
    const m = await this.banco.modelos.get(chaveModelo(v.modeloId, v.modeloVersao));
    if (!m) return undefined;
    const { chave: _chave, ...modelo } = m;
    return modelo;
  }

  /** O modelo precisa estar no aparelho antes de sair do sinal. */
  async guardarModelo(modelo: ModeloChecklist): Promise<void> {
    await this.banco.modelos.put({ ...modelo, chave: chaveModelo(modelo.id, modelo.versao) });
  }

  async iniciar(dados: Omit<Verificacao, 'id' | 'status' | 'iniciadaEm' | 'respostas'>): Promise<Verificacao> {
    const v: Verificacao = {
      ...dados,
      id: this.gerarId(),
      status: 'rascunho',
      iniciadaEm: this.agora().toISOString(),
      respostas: {},
    };
    await this.salvar(v);
    return v;
  }

  async responder(verificacaoId: string, itemId: string, dados: DadosResposta): Promise<Verificacao> {
    const v = await this.exigirRascunho(verificacaoId);
    if (dados.status === 'nao_conforme' && !dados.naoConformidade?.descricao.trim()) {
      throw new Error('Não conformidade exige descrição.');
    }
    const fotos = await this.evidenciasDoItem(verificacaoId, itemId);
    const resposta: Resposta = {
      itemId,
      status: dados.status,
      observacao: dados.observacao?.trim() || undefined,
      evidenciaIds: fotos.map((f) => f.id),
      naoConformidade: dados.status === 'nao_conforme' ? dados.naoConformidade : undefined,
      respondidoEm: this.agora().toISOString(),
    };
    if (resposta.status === 'nao_conforme' && resposta.evidenciaIds.length === 0) {
      throw new Error('Não conformidade exige ao menos uma foto.');
    }
    const nova = { ...v, respostas: { ...v.respostas, [itemId]: resposta } };
    await this.salvar(nova);
    return nova;
  }

  /**
   * Guarda a foto no aparelho e enfileira o envio. O vínculo com a resposta
   * acontece em responder(): a foto pode ser tirada antes do status.
   */
  async adicionarEvidencia(verificacaoId: string, itemId: string, blob: Blob): Promise<EvidenciaLocal> {
    await this.exigirRascunho(verificacaoId);
    const evidencia: EvidenciaLocal = {
      id: this.gerarId(),
      verificacaoId,
      itemId,
      mime: blob.type || 'image/jpeg',
      tamanhoBytes: blob.size,
      criadaEm: this.agora().toISOString(),
      blob,
      enviada: false,
    };
    await this.banco.evidencias.add(evidencia);
    const { blob: _b, enviada: _e, removida: _r, ...meta } = evidencia;
    await this.fila.enfileirar({ tipo: 'evidencia.enviar', evidencia: meta });
    await this.atualizarFotosDaResposta(verificacaoId, itemId);
    return evidencia;
  }

  /**
   * Tira a foto do item. Se ainda não subiu, some do aparelho e da fila; se já
   * subiu, fica no servidor sem vínculo (trilha de auditoria).
   */
  async removerEvidencia(verificacaoId: string, evidenciaId: string): Promise<void> {
    await this.exigirRascunho(verificacaoId);
    const ev = await this.banco.evidencias.get(evidenciaId);
    if (!ev) return;
    if (ev.enviada) {
      await this.banco.evidencias.update(evidenciaId, { removida: true });
    } else {
      const naFila = await this.banco.fila
        .filter((i) => i.operacao.tipo === 'evidencia.enviar' && i.operacao.evidencia.id === evidenciaId)
        .primaryKeys();
      await this.banco.transaction('rw', this.banco.fila, this.banco.evidencias, async () => {
        await this.banco.fila.bulkDelete(naFila);
        await this.banco.evidencias.delete(evidenciaId);
      });
    }
    await this.atualizarFotosDaResposta(verificacaoId, ev.itemId);
  }

  async evidenciasDoItem(verificacaoId: string, itemId: string): Promise<EvidenciaLocal[]> {
    const todas = await this.banco.evidencias.where({ verificacaoId, itemId }).sortBy('criadaEm');
    return todas.filter((e) => !e.removida);
  }

  async evidencia(id: string): Promise<EvidenciaLocal | undefined> {
    return this.banco.evidencias.get(id);
  }

  async concluir(verificacaoId: string): Promise<Verificacao> {
    const v = await this.exigirRascunho(verificacaoId);
    const modelo = await this.modeloDe(v);
    if (!modelo || !podeConcluir(this.recortar(modelo, v), v)) {
      throw new Error('Ainda há itens sem resposta.');
    }
    const concluidaEm = this.agora().toISOString();
    const final: Verificacao = { ...v, status: 'concluida', concluidaEm };
    await this.salvar(final);
    await this.fila.enfileirar({ tipo: 'verificacao.concluir', verificacaoId, concluidaEm });
    return final;
  }

  /** Item já respondido: mantém a lista de fotos da resposta igual à do aparelho. */
  private async atualizarFotosDaResposta(verificacaoId: string, itemId: string) {
    const v = await this.exigirRascunho(verificacaoId);
    const r = v.respostas[itemId];
    if (!r) return;
    const evidenciaIds = (await this.evidenciasDoItem(verificacaoId, itemId)).map((f) => f.id);
    await this.salvar({ ...v, respostas: { ...v.respostas, [itemId]: { ...r, evidenciaIds } } });
  }

  private async exigirRascunho(id: string): Promise<Verificacao> {
    const v = await this.obter(id);
    if (!v) throw new Error('Verificação não encontrada.');
    if (v.status !== 'rascunho') throw new Error('Verificação já concluída.');
    return v;
  }

  private async salvar(v: Verificacao): Promise<void> {
    await this.banco.verificacoes.put(v);
    await this.fila.enfileirar({ tipo: 'verificacao.salvar', verificacao: v });
  }
}
