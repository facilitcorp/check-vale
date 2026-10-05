import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { banco } from '../dados/banco';
import { sincronizar } from '../dados/sincronizacao';
import { rotasDaInspecao } from '.';
import { concluirTudo, ITENS_LEVE, novaInspecao, prepararAparelho, responder, servidorFalso } from './teste-apoio';

const ESPERA = { timeout: 4000 };

function abrir(rota = '/') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        {rotasDaInspecao}
        <Route path="/nova" element={<h1>Seleção de operação</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

let servidor: ReturnType<typeof servidorFalso>;
beforeEach(async () => {
  servidor = servidorFalso();
  await prepararAparelho();
});
afterEach(cleanup);

describe('tela inicial do inspetor', () => {
  it('aparelho vazio: só nova verificação, sem cartão em andamento', async () => {
    abrir();
    await screen.findByText('Nenhum checklist concluído neste aparelho ainda.', undefined, ESPERA);
    expect(screen.queryByText('Em andamento')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Nova verificação' }));
    await screen.findByRole('heading', { name: 'Seleção de operação' }, ESPERA);
  });

  it('cartão em andamento: placa, fabricante+modelo, operação, progresso, DEMO, situação e continuar', async () => {
    const v = await novaInspecao('RTY4B22', true);
    await responder(v.id, ITENS_LEVE[0]!.id, 'conforme');
    abrir();
    const cartao = await screen.findByRole('article', { name: /RTY4B22/ }, ESPERA);
    const c = within(cartao);
    await c.findByText('Ford Ranger', undefined, ESPERA);
    c.getByText('DEMO');
    await c.findByText('Carajás · Operacional · Transporte', undefined, ESPERA);
    await c.findByText(new RegExp(`1 de ${ITENS_LEVE.length} itens`), undefined, ESPERA);
    await c.findByText('Aguardando envio', undefined, ESPERA);
    fireEvent.click(c.getByRole('button', { name: 'Continuar verificação' }));
    await screen.findByRole('heading', { name: 'Checklist - Veículo' }, ESPERA);
  });

  it('últimos checklists e histórico: resultado, situação e abre os detalhes', async () => {
    const v = await novaInspecao('PQO1C83');
    await concluirTudo(v.id);
    await sincronizar();
    abrir();
    const linha = await screen.findByRole('button', { name: /PQO1C83/ }, ESPERA);
    await within(linha).findByLabelText('Índice de prontidão 100%', undefined, ESPERA);
    await within(linha).findByText('Tudo enviado', undefined, ESPERA);
    fireEvent.click(screen.getByRole('link', { name: 'Ver histórico' }));
    await screen.findByRole('heading', { name: 'Histórico' }, ESPERA);
    fireEvent.click(await screen.findByRole('button', { name: /PQO1C83/ }, ESPERA));
    await screen.findByRole('heading', { name: 'Verificação concluída!' }, ESPERA);
  });

  it('erro ao sincronizar: avisa, mantém os dados e permite tentar agora', async () => {
    const v = await novaInspecao('JHK8D91');
    await concluirTudo(v.id);
    servidor.falhar = true;
    await sincronizar();
    abrir();
    expect((await screen.findAllByText('Erro ao sincronizar', undefined, ESPERA)).length).toBeGreaterThan(0);
    expect(await banco.fila.count()).toBeGreaterThan(0); // nada se perdeu
    servidor.falhar = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar agora' }));
    expect((await screen.findAllByText('Tudo enviado', undefined, ESPERA)).length).toBeGreaterThan(0);
    expect(servidor.recebidas.some((o) => o.tipo === 'inspecao.salvar' && o.inspecao.status === 'concluida')).toBe(true);
  });

  it('registro recusado pelo servidor aparece acima do cartão de sincronização', async () => {
    const v = await novaInspecao('ABC1D23');
    await banco.fila.add({ estado: 'rejeitada', op: (await banco.fila.toArray())[0]!.op, alvo: `inspecao:${v.id}`, erro: 'Placa ABC1D23 já cadastrada.' });
    abrir();
    await screen.findByText('Placa ABC1D23 já cadastrada.', undefined, ESPERA);
    screen.getByText('Procure o gestor da operação.');
  });

  it('inspeção inexistente: mostra não encontrada', async () => {
    abrir(`/inspecao/${crypto.randomUUID()}/resultado`);
    await screen.findByRole('heading', { name: 'Verificação não encontrada' }, ESPERA);
  });
});
