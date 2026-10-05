import type { OperacaoSync } from '@/contracts/checklist';
import { BancoLocal } from '@/infra/offline/banco';
import { FilaSincronizacao, type TransporteSync } from '@/infra/offline/fila';
import { MODELO_EXEMPLO } from './modelo-exemplo';
import { RepositorioInspecao } from './repositorio';

class TransporteFalso implements TransporteSync {
  enviados: { op: OperacaoSync; anexo?: Blob }[] = [];
  offline = false;
  async enviar(op: OperacaoSync, anexo?: Blob) {
    if (this.offline) throw new Error('sem rede');
    this.enviados.push({ op, anexo });
  }
}

let n = 0;
async function montar() {
  const banco = new BancoLocal(`teste-${++n}`);
  const transporte = new TransporteFalso();
  const fila = new FilaSincronizacao(banco, transporte);
  const repo = new RepositorioInspecao(banco, fila);
  await repo.guardarModelo(MODELO_EXEMPLO);
  const v = await repo.iniciar({
    operacao: {
      unidadeId: 'carajas', unidadeNome: 'Complexo Carajás (PA)', areaId: 'op', areaNome: 'Área operacional',
      atividadeId: 'tp', atividadeNome: 'Transporte de pessoas',
    },
    veiculo: { id: 'c1', placa: 'OWQ3A15', descricao: 'Caminhonete Ford Ranger', tipo: 'leve' },
    modeloId: MODELO_EXEMPLO.id,
    modeloVersao: MODELO_EXEMPLO.versao,
  });
  return { banco, transporte, fila, repo, v };
}

const foto = () => new Blob(['jpeg'], { type: 'image/jpeg' });

describe('RepositorioInspecao + fila offline', () => {
  it('não conformidade exige descrição e foto', async () => {
    const { repo, v } = await montar();
    await expect(
      repo.responder(v.id, 'iluminacao-2', { status: 'nao_conforme', naoConformidade: { descricao: ' ', criticidade: 'alta' } }),
    ).rejects.toThrow(/descrição/);
    await expect(
      repo.responder(v.id, 'iluminacao-2', { status: 'nao_conforme', naoConformidade: { descricao: 'Lanterna', criticidade: 'alta' } }),
    ).rejects.toThrow(/foto/);

    await repo.adicionarEvidencia(v.id, 'iluminacao-2', foto());
    const salvo = await repo.responder(v.id, 'iluminacao-2', {
      status: 'nao_conforme',
      naoConformidade: { descricao: 'Lanterna traseira direita com defeito', criticidade: 'alta' },
    });
    expect(salvo.respostas['iluminacao-2'].evidenciaIds).toHaveLength(1);
  });

  it('trocar para conforme apaga a não conformidade', async () => {
    const { repo, v } = await montar();
    await repo.adicionarEvidencia(v.id, 'pneus-1', foto());
    await repo.responder(v.id, 'pneus-1', { status: 'nao_conforme', naoConformidade: { descricao: 'careca', criticidade: 'critica' } });
    const s = await repo.responder(v.id, 'pneus-1', { status: 'conforme' });
    expect(s.respostas['pneus-1'].naoConformidade).toBeUndefined();
  });

  it('offline: guarda tudo na fila e sobe em ordem quando a rede volta', async () => {
    const { repo, fila, transporte, v } = await montar();
    transporte.offline = true;
    await repo.adicionarEvidencia(v.id, 'externos-1', foto());
    await repo.responder(v.id, 'externos-1', { status: 'conforme', observacao: 'riscos leves' });
    await repo.responder(v.id, 'externos-2', { status: 'conforme' });
    await fila.processar();
    expect(transporte.enviados).toHaveLength(0);
    // várias gravações da mesma verificação viram um único "salvar" pendente
    expect((await fila.estado()).pendentes).toBe(2);

    transporte.offline = false;
    await fila.processar();
    expect(transporte.enviados.map((e) => e.op.tipo)).toEqual(['verificacao.salvar', 'evidencia.enviar']);
    const salvar = transporte.enviados[0].op;
    expect(salvar.tipo === 'verificacao.salvar' && Object.keys(salvar.verificacao.respostas)).toEqual([
      'externos-1', 'externos-2',
    ]);
    // fake-indexeddb no jsdom não clona Blob fielmente; no navegador o tipo é Blob
    expect(transporte.enviados[1].anexo).toBeDefined();
    expect((await fila.estado()).pendentes).toBe(0);
  });

  it('remover foto ainda não enviada tira do aparelho e da fila', async () => {
    const { repo, fila, v } = await montar();
    const ev = await repo.adicionarEvidencia(v.id, 'cabine-1', foto());
    await repo.removerEvidencia(v.id, ev.id);
    expect(await repo.evidenciasDoItem(v.id, 'cabine-1')).toHaveLength(0);
    expect((await fila.estado()).pendentes).toBe(1); // só o salvar da verificação
  });

  it('remover foto de item respondido atualiza a resposta', async () => {
    const { repo, v } = await montar();
    const a = await repo.adicionarEvidencia(v.id, 'cabine-2', foto());
    await repo.adicionarEvidencia(v.id, 'cabine-2', foto());
    await repo.responder(v.id, 'cabine-2', { status: 'conforme' });
    await repo.removerEvidencia(v.id, a.id);
    const atual = await repo.obter(v.id);
    expect(atual!.respostas['cabine-2'].evidenciaIds).toHaveLength(1);
  });

  it('só conclui com tudo respondido, e conclusão sobe depois do salvar', async () => {
    const { repo, fila, transporte, v } = await montar();
    await expect(repo.concluir(v.id)).rejects.toThrow(/sem resposta/);
    for (const c of MODELO_EXEMPLO.categorias) for (const i of c.itens) await repo.responder(v.id, i.id, { status: 'conforme' });
    const fim = await repo.concluir(v.id);
    expect(fim.status).toBe('concluida');
    await expect(repo.responder(v.id, 'pneus-1', { status: 'conforme' })).rejects.toThrow(/concluída/);
    await fila.processar();
    expect(transporte.enviados.map((e) => e.op.tipo)).toEqual(['verificacao.salvar', 'verificacao.concluir']);
    const s = transporte.enviados[0].op;
    expect(s.tipo === 'verificacao.salvar' && s.verificacao.status).toBe('concluida');
  });
});
