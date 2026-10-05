/**
 * Os SEIS estados de sincronização que o inspetor vê, em todo o app. Uma regra
 * só, para a mesma situação nunca aparecer com nomes diferentes em telas
 * diferentes. Nada sai da fila sem confirmação do servidor: dado nunca some.
 */
export type SituacaoSync =
  | 'salvo_local' // inspeção em andamento: gravada no aparelho, sobe sozinha
  | 'sem_conexao' // sem sinal: tudo continua salvo no aparelho
  | 'aguardando' // tem algo para subir e há sinal; vai na próxima tentativa
  | 'sincronizando'
  | 'enviado'
  | 'erro'; // o envio falhou; tenta de novo sozinho e permite tentar agora

export const ROTULO_SITUACAO: Record<SituacaoSync, { rotulo: string; ajuda: string }> = {
  salvo_local: { rotulo: 'Salvo no aparelho', ajuda: 'Suas respostas estão guardadas e sobem sozinhas.' },
  sem_conexao: { rotulo: 'Sem conexão', ajuda: 'Pode continuar: tudo fica salvo no aparelho e sobe quando o sinal voltar.' },
  aguardando: { rotulo: 'Aguardando envio', ajuda: 'Será enviado na próxima tentativa.' },
  sincronizando: { rotulo: 'Sincronizando', ajuda: 'Enviando para o servidor…' },
  enviado: { rotulo: 'Tudo enviado', ajuda: 'Nada pendente neste aparelho.' },
  erro: { rotulo: 'Erro ao sincronizar', ajuda: 'Nada foi perdido. O envio é repetido sozinho; você também pode tentar agora.' },
};

export interface EntradaSituacao {
  online: boolean;
  pendentes: number;
  sincronizando: boolean;
  /** algum item pendente falhou na última tentativa */
  comErro: boolean;
  /** inspeção ainda em andamento (rascunho) */
  emAndamento?: boolean;
}

export function situacaoSync(e: EntradaSituacao): SituacaoSync {
  if (!e.online) return 'sem_conexao';
  if (e.pendentes === 0) return 'enviado';
  if (e.sincronizando) return 'sincronizando';
  if (e.comErro) return 'erro';
  return e.emAndamento ? 'salvo_local' : 'aguardando';
}
