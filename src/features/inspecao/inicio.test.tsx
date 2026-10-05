import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { OperacaoSync } from '@/contracts/checklist';
import { BancoLocal } from '@/infra/offline/banco';
import { FilaSincronizacao } from '@/infra/offline/fila';
import { MODELO_EXEMPLO } from './dados/modelo-exemplo';
import { RepositorioInspecao } from './dados/repositorio';
import { ProvedorInspecao, rotasDaInspecao } from '.';

let n = 0;
async function montar() {
  const banco = new BancoLocal(`inicio-${++n}`);
  const transporte = { falhar: false, enviados: [] as OperacaoSync[] };
  const fila = new FilaSincronizacao(banco, {
    enviar: async (op) => {
      if (transporte.falhar) throw new Error('500');
      transporte.enviados.push(op);
    },
  });
  const repo = new RepositorioInspecao(banco, fila);
  await repo.guardarModelo(MODELO_EXEMPLO);
  const nova = (placa: string, demo = false) =>
    repo.iniciar({
      operacao: { unidadeId: 'u', unidadeNome: 'Complexo X', areaId: 'a', areaNome: 'Mina', atividadeId: 't', atividadeNome: 'Transporte' },
      veiculo: { id: placa, placa, descricao: 'Van', fabricante: 'Mercedes-Benz', modelo: 'Sprinter', tipo: 'van', demo },
      modeloId: MODELO_EXEMPLO.id,
      modeloVersao: MODELO_EXEMPLO.versao,
    });
  const concluirTudo = async (id: string) => {
    for (const c of MODELO_EXEMPLO.categorias) for (const i of c.itens) await repo.responder(id, i.id, { status: 'conforme' });
    await repo.concluir(id);
  };
  const abrir = (rota = '/') =>
    render(
      <ProvedorInspecao banco={banco} fila={fila} rotaNovaVerificacao="/nova">
        <MemoryRouter initialEntries={[rota]}>
          <Routes>
            {rotasDaInspecao}
            <Route path="/nova" element={<h1>Seleção de operação</h1>} />
          </Routes>
        </MemoryRouter>
      </ProvedorInspecao>,
    );
  return { banco, fila, repo, transporte, nova, concluirTudo, abrir };
}

describe('tela inicial do inspetor', () => {
  it('aparelho vazio: só nova verificação, sem cartão em andamento', async () => {
    const user = userEvent.setup();
    const { abrir } = await montar();
    abrir();
    expect(await screen.findByText('Nenhum checklist concluído neste aparelho ainda.')).toBeInTheDocument();
    expect(screen.queryByText('Em andamento')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nova verificação' }));
    expect(await screen.findByRole('heading', { name: 'Seleção de operação' })).toBeInTheDocument();
  });

  it('cartão em andamento: placa, fabricante+modelo, operação, progresso, DEMO, situação e continuar', async () => {
    const user = userEvent.setup();
    const { repo, nova, abrir } = await montar();
    const v = await nova('RTY4B22', true);
    await repo.responder(v.id, 'identificacao-1', { status: 'conforme' });
    abrir();
    const cartao = await screen.findByRole('article', { name: /RTY4B22/ });
    const c = within(cartao);
    expect(c.getByText('Mercedes-Benz Sprinter')).toBeInTheDocument();
    expect(c.getByText('DEMO')).toBeInTheDocument();
    expect(c.getByText('Complexo X · Mina · Transporte')).toBeInTheDocument();
    expect(await c.findByText(new RegExp(`1 de ${MODELO_EXEMPLO.categorias.flatMap((x) => x.itens).length} itens`))).toBeInTheDocument();
    expect(await c.findByText('Aguardando envio')).toBeInTheDocument();
    await user.click(c.getByRole('button', { name: 'Continuar verificação' }));
    expect(await screen.findByRole('heading', { name: 'Checklist - Veículo' })).toBeInTheDocument();
  });

  it('últimos checklists e histórico: resultado, situação e abre os detalhes', async () => {
    const user = userEvent.setup();
    const { fila, nova, concluirTudo, abrir } = await montar();
    const v = await nova('PQO1C83');
    await concluirTudo(v.id);
    await fila.processar();
    abrir();
    const linha = await screen.findByRole('button', { name: /PQO1C83/ });
    expect(await within(linha).findByLabelText('Índice de prontidão 100%')).toBeInTheDocument();
    expect(await within(linha).findByText('Tudo enviado')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Ver histórico' }));
    expect(await screen.findByRole('heading', { name: 'Histórico' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /PQO1C83/ }));
    expect(await screen.findByRole('heading', { name: 'Verificação concluída!' })).toBeInTheDocument();
  });

  it('erro ao sincronizar: avisa, mantém os dados e permite tentar agora', async () => {
    const user = userEvent.setup();
    const { fila, transporte, nova, concluirTudo, abrir } = await montar();
    const v = await nova('JHK8D91');
    await concluirTudo(v.id);
    transporte.falhar = true;
    await fila.processar();
    abrir();
    expect((await screen.findAllByText('Erro ao sincronizar')).length).toBeGreaterThan(0);
    transporte.falhar = false;
    await user.click(screen.getByRole('button', { name: 'Tentar agora' }));
    expect((await screen.findAllByText('Tudo enviado')).length).toBeGreaterThan(0);
    expect(transporte.enviados.map((o) => o.tipo)).toContain('verificacao.concluir');
  });

  it('histórico de inspeção inexistente: mostra não encontrada', async () => {
    const { abrir } = await montar();
    abrir('/inspecao/nao-existe/resultado');
    expect(await screen.findByRole('heading', { name: 'Verificação não encontrada' })).toBeInTheDocument();
  });
});
