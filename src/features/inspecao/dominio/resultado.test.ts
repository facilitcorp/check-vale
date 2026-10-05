import type { Resposta, Verificacao } from '@/contracts/checklist';
import { MODELO_EXEMPLO } from '../dados/modelo-exemplo';
import { calcularResultado, planoDeAcao, podeConcluir, progressoCategoria } from './resultado';

const r = (itemId: string, status: Resposta['status'], extra: Partial<Resposta> = {}): Resposta => ({
  itemId,
  status,
  evidenciaIds: [],
  respondidoEm: '2026-10-05T10:00:00Z',
  ...extra,
});

const nc = (itemId: string, criticidade: 'critica' | 'alta' | 'media' | 'baixa', descricao = 'defeito') =>
  r(itemId, 'nao_conforme', { naoConformidade: { criticidade, descricao }, evidenciaIds: ['f1'] });

function verificacao(respostas: Resposta[]): Verificacao {
  return {
    id: 'v1',
    operacao: {
      unidadeId: 'u', unidadeNome: 'U', areaId: 'a', areaNome: 'A', atividadeId: 't', atividadeNome: 'T',
    },
    veiculo: { id: 'c', placa: 'OWQ3A15', descricao: 'Caminhonete', tipo: 'leve' },
    modeloId: MODELO_EXEMPLO.id,
    modeloVersao: MODELO_EXEMPLO.versao,
    status: 'rascunho',
    iniciadaEm: '2026-10-05T10:00:00Z',
    respostas: Object.fromEntries(respostas.map((x) => [x.itemId, x])),
  };
}

const todosItens = MODELO_EXEMPLO.categorias.flatMap((c) => c.itens);

describe('progressoCategoria', () => {
  const freios = MODELO_EXEMPLO.categorias.find((c) => c.id === 'freios')!;

  it('pendente quando nada foi respondido', () => {
    expect(progressoCategoria(freios, verificacao([])).situacao).toBe('pendente');
  });

  it('atenção assim que há uma não conformidade, mesmo incompleta', () => {
    const p = progressoCategoria(freios, verificacao([nc('freios-1', 'alta')]));
    expect(p.situacao).toBe('atencao');
    expect(p.respondidos).toBe(1);
  });

  it('percentual ignora itens que não se aplicam', () => {
    const p = progressoCategoria(
      freios,
      verificacao([
        r('freios-1', 'conforme'), r('freios-2', 'conforme'), r('freios-3', 'conforme'),
        r('freios-4', 'nao_se_aplica'), nc('freios-5', 'media'),
      ]),
    );
    expect(p.percentual).toBe(75); // 3 de 4 aplicáveis
  });

  it('percentual nulo quando nada se aplica', () => {
    const doc = MODELO_EXEMPLO.categorias.find((c) => c.id === 'documentacao')!;
    const p = progressoCategoria(doc, verificacao(doc.itens.map((i) => r(i.id, 'nao_se_aplica'))));
    expect(p.percentual).toBeNull();
    expect(p.situacao).toBe('ok');
  });
});

describe('calcularResultado', () => {
  it('índice = conformes / aplicáveis, arredondado', () => {
    const respostas = todosItens.map((i, idx) =>
      idx < 2 ? nc(i.id, 'baixa') : idx < 4 ? r(i.id, 'nao_se_aplica') : r(i.id, 'conforme'),
    );
    const res = calcularResultado(MODELO_EXEMPLO, verificacao(respostas));
    expect(res.total).toBe(todosItens.length);
    expect(res.naoConformes).toBe(2);
    expect(res.naoSeAplica).toBe(2);
    expect(res.conformes).toBe(todosItens.length - 4);
    expect(res.indiceProntidao).toBe(
      Math.round(((todosItens.length - 4) / (todosItens.length - 2)) * 100),
    );
  });

  it('conta como ponto de atenção o conforme com observação', () => {
    const res = calcularResultado(
      MODELO_EXEMPLO,
      verificacao([r('pneus-1', 'conforme', { observacao: 'perto do limite' }), r('pneus-2', 'conforme', { observacao: '  ' })]),
    );
    expect(res.pontosAtencao).toBe(1);
  });
});

describe('planoDeAcao', () => {
  it('ordena por criticidade e mantém a ordem do checklist no empate', () => {
    const v = verificacao([
      nc('externos-1', 'media', 'amassado'),
      nc('iluminacao-2', 'critica', 'lanterna'),
      nc('telemetria-2', 'critica', 'fadiga'),
      nc('identificacao-3', 'alta', 'adesivo'),
      r('motor-1', 'conforme'),
    ]);
    expect(planoDeAcao(MODELO_EXEMPLO, v).map((a) => a.descricao)).toEqual([
      'lanterna', 'fadiga', 'adesivo', 'amassado',
    ]);
  });
});

describe('podeConcluir', () => {
  it('exige todos os itens respondidos', () => {
    const quase = todosItens.slice(1).map((i) => r(i.id, 'conforme'));
    expect(podeConcluir(MODELO_EXEMPLO, verificacao(quase))).toBe(false);
    expect(podeConcluir(MODELO_EXEMPLO, verificacao(todosItens.map((i) => r(i.id, 'conforme'))))).toBe(true);
  });
});
