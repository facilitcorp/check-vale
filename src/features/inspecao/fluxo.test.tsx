import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes } from 'react-router-dom';
import type { OperacaoSync, RecortarModelo } from '@/contracts/checklist';
import { BancoLocal } from '@/infra/offline/banco';
import { FilaSincronizacao } from '@/infra/offline/fila';
import { MODELO_EXEMPLO } from './dados/modelo-exemplo';
import { RepositorioInspecao } from './dados/repositorio';
import { ProvedorInspecao, rotasDaInspecao, rotasInspecao } from '.';

// jsdom não implementa URL de blob
URL.createObjectURL = () => 'blob:teste';
URL.revokeObjectURL = () => {};

let n = 0;
async function montar(recortar?: RecortarModelo) {
  const banco = new BancoLocal(`fluxo-${++n}`);
  const enviados: OperacaoSync[] = [];
  const fila = new FilaSincronizacao(banco, { enviar: async (op) => void enviados.push(op) });
  const repo = new RepositorioInspecao(banco, fila, undefined, undefined, recortar);
  await repo.guardarModelo(MODELO_EXEMPLO);
  const v = await repo.iniciar({
    operacao: {
      unidadeId: 'u', unidadeNome: 'Carajás', areaId: 'a', areaNome: 'Operacional', atividadeId: 't', atividadeNome: 'Transporte',
    },
    veiculo: { id: 'c', placa: 'OWQ3A15', descricao: 'Caminhonete', fabricante: 'Ford', modelo: 'Ranger', tipo: 'leve', demo: true },
    modeloId: MODELO_EXEMPLO.id,
    modeloVersao: MODELO_EXEMPLO.versao,
  });
  const abrir = (rota: string) =>
    render(
      <ProvedorInspecao banco={banco} fila={fila} recortar={recortar}>
        <MemoryRouter initialEntries={[rota]}>
          <Routes>{rotasDaInspecao}</Routes>
        </MemoryRouter>
      </ProvedorInspecao>,
    );
  return { banco, repo, fila, v, enviados, abrir };
}

describe('fluxo da inspeção (telas 5–12)', () => {
  it('responde conforme e registra não conformidade com foto', async () => {
    const user = userEvent.setup();
    const { repo, v, abrir } = await montar();
    abrir(rotasInspecao.categorias(v.id));

    await user.click(await screen.findByRole('button', { name: 'Iniciar verificação' }));
    expect(await screen.findByRole('heading', { name: 'Placa legível e íntegra' })).toBeInTheDocument();

    // sem escolher, não avança
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha uma opção');

    await user.click(screen.getByRole('radio', { name: 'Conforme' }));
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(await screen.findByRole('heading', { name: 'Chassi confere com documento' })).toBeInTheDocument();
    expect(await screen.findByText('Salvo no aparelho')).toBeInTheDocument();

    // não conforme -> tela de registro
    await user.click(screen.getByRole('radio', { name: 'Não conforme' }));
    await user.type(screen.getByPlaceholderText('Digite aqui...'), 'chassi raspado');
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(await screen.findByRole('heading', { name: 'Registrar não conformidade' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Descreva');
    await user.type(screen.getByPlaceholderText(/Lanterna traseira/), 'Número do chassi ilegível');
    await user.click(screen.getByRole('radio', { name: /Alta/ }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('foto');

    await user.upload(screen.getByTestId('entrada-foto'), new File(['x'], 'f.jpg', { type: 'image/jpeg' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remover foto' })).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('heading', { name: 'Adesivo de identificação da operação' })).toBeInTheDocument();

    const salvo = await repo.obter(v.id);
    expect(salvo!.respostas['identificacao-2']).toMatchObject({
      status: 'nao_conforme',
      observacao: 'chassi raspado',
      naoConformidade: { criticidade: 'alta', descricao: 'Número do chassi ilegível' },
    });
    expect(salvo!.respostas['identificacao-2'].evidenciaIds).toHaveLength(1);
  });

  it('conclui e mostra resultado, categorias e plano de ação', async () => {
    const user = userEvent.setup();
    const { repo, v, abrir } = await montar();
    const itens = MODELO_EXEMPLO.categorias.flatMap((c) => c.itens);
    await repo.adicionarEvidencia(v.id, 'iluminacao-2', new Blob(['x'], { type: 'image/jpeg' }));
    await repo.responder(v.id, 'iluminacao-2', {
      status: 'nao_conforme',
      naoConformidade: { descricao: 'Lanterna traseira direita com defeito.', criticidade: 'critica' },
    });
    await repo.responder(v.id, 'documentacao-3', { status: 'nao_se_aplica' });
    for (const i of itens) {
      if (i.id !== 'iluminacao-2' && i.id !== 'documentacao-3') await repo.responder(v.id, i.id, { status: 'conforme' });
    }

    abrir(rotasInspecao.categorias(v.id));
    await user.click(await screen.findByRole('button', { name: 'Concluir verificação' }));
    expect(await screen.findByRole('heading', { name: 'Verificação concluída!' })).toBeInTheDocument();
    const esperado = Math.round(((itens.length - 2) / (itens.length - 1)) * 100);
    expect(screen.getByRole('img', { name: `Índice de prontidão ${esperado}%` })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    expect(await screen.findByRole('heading', { name: 'Resultado por categoria' })).toBeInTheDocument();
    expect(screen.getByText('86%')).toBeInTheDocument(); // iluminação: 6 de 7

    await user.click(screen.getByRole('button', { name: 'Plano de ação' }));
    expect(await screen.findByText('Lanterna traseira direita com defeito.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Crítica (1)' })).toBeInTheDocument();
    // sem link configurado na marca, o botão não aparece
    expect(screen.queryByText('Falar com especialista')).not.toBeInTheDocument();
  });
});

describe('contrato do núcleo configurável', () => {
  // regra de exemplo: veículo leve não tem a categoria de telemetria
  const semTelemetria: RecortarModelo = (m) => ({ ...m, categorias: m.categorias.filter((c) => c.id !== 'telemetria') });
  const itensSemTelemetria = MODELO_EXEMPLO.categorias.filter((c) => c.id !== 'telemetria').flatMap((c) => c.itens);

  it('item fora da regra não aparece nem conta no progresso, e não bloqueia a conclusão', async () => {
    const user = userEvent.setup();
    const { repo, v, abrir } = await montar(semTelemetria);
    abrir(rotasInspecao.categorias(v.id));
    expect(await screen.findByText(`0 de ${itensSemTelemetria.length}`)).toBeInTheDocument();
    expect(screen.queryByText('Telemetria e tecnologia')).not.toBeInTheDocument();

    for (const i of itensSemTelemetria) await repo.responder(v.id, i.id, { status: 'conforme' });
    await user.click(await screen.findByRole('button', { name: 'Concluir verificação' }));
    expect(await screen.findByRole('img', { name: 'Índice de prontidão 100%' })).toBeInTheDocument();
  });

  it('mostra fabricante + modelo e o selo DEMO', async () => {
    const { v, abrir } = await montar();
    abrir(rotasInspecao.categorias(v.id));
    expect(await screen.findByText(/OWQ3A15 - Ford Ranger/)).toBeInTheDocument();
    expect(screen.getByText('DEMO')).toBeInTheDocument();
  });

  it('versão do checklist fora do aparelho: avisa em vez de quebrar', async () => {
    const { banco, v, abrir } = await montar();
    await banco.modelos.clear();
    abrir(rotasInspecao.item(v.id, 'pneus-1'));
    expect(await screen.findByRole('heading', { name: 'Checklist indisponível neste aparelho' })).toBeInTheDocument();
  });
});
