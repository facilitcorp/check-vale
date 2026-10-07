import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes } from 'react-router-dom';
import { banco } from '../dados/banco';
import { repositorioInspecao } from '../dados/repositorio';
import { rotasDaInspecao, rotasInspecao } from '.';
import { concluirTudo, item, ITENS_LEVE, novaInspecao, prepararAparelho, responder, responderNc, servidorFalso } from './teste-apoio';

const ESPERA = { timeout: 4000 };

beforeAll(() => {
  // jsdom não implementa URL de blob
  URL.createObjectURL = () => 'blob:teste';
  URL.revokeObjectURL = () => {};
});
beforeEach(async () => {
  servidorFalso();
  await prepararAparelho();
});
afterEach(cleanup);

const abrir = (rota: string) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>{rotasDaInspecao}</Routes>
    </MemoryRouter>,
  );

describe('fluxo da inspeção (telas 5–12) na base real', () => {
  it('responde conforme e registra não conformidade com foto', async () => {
    const v = await novaInspecao();
    abrir(rotasInspecao.categorias(v.id));

    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar verificação' }, ESPERA));
    await screen.findByRole('heading', { name: 'Placa legível e íntegra' }, ESPERA);

    // sem escolher, não avança
    fireEvent.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(screen.getByRole('alert').textContent).toMatch('Escolha uma opção');

    fireEvent.click(screen.getByRole('radio', { name: 'Conforme' }));
    fireEvent.click(screen.getByRole('button', { name: 'Avançar' }));
    await screen.findByRole('heading', { name: 'Chassi confere com documento' }, ESPERA);
    await screen.findByText('Salvo no aparelho', undefined, ESPERA);

    // não conforme -> tela de registro, levando a observação
    fireEvent.click(screen.getByRole('radio', { name: 'Não conforme' }));
    fireEvent.change(screen.getByPlaceholderText('Digite aqui...'), { target: { value: 'chassi raspado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Avançar' }));
    await screen.findByRole('heading', { name: 'Registrar não conformidade' }, ESPERA);

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('alert').textContent).toMatch('Descreva');
    fireEvent.change(screen.getByPlaceholderText(/Lanterna traseira/), { target: { value: 'Número do chassi ilegível' } });
    fireEvent.click(screen.getByRole('radio', { name: /Alta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect((await screen.findByRole('alert', undefined, ESPERA)).textContent).toMatch('foto');

    fireEvent.change(screen.getByTestId('entrada-foto'), { target: { files: [new File(['x'], 'f.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remover foto' })).toHaveLength(1), ESPERA);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await screen.findByRole('heading', { name: 'Adesivo de identificação da operação' }, ESPERA);

    const salvo = await repositorioInspecao.obter(v.id);
    const r = salvo!.respostas.find((x) => x.itemId === item('Chassi confere com documento').id)!;
    expect(r).toMatchObject({
      status: 'nao_conforme',
      observacao: 'chassi raspado',
      naoConformidade: { criticidade: 'alta', descricao: 'Número do chassi ilegível' },
    });
    expect(r.evidenciaIds).toHaveLength(1);
    // a foto fica no aparelho e na fila para subir
    expect(await banco.evidencias.get(r.evidenciaIds[0]!)).toBeTruthy();
  });

  it('evidência do item: "Fotografia" pede foto e "Observação" pede texto mesmo conforme', async () => {
    const v = await novaInspecao();
    abrir(rotasInspecao.item(v.id, item('CRLV em dia').id));
    await screen.findByRole('heading', { name: 'CRLV em dia' }, ESPERA);
    screen.getByText('Foto (obrigatória neste item)');
    fireEvent.click(screen.getByRole('radio', { name: 'Conforme' }));
    fireEvent.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(screen.getByRole('alert').textContent).toMatch('foto');
    fireEvent.change(screen.getByTestId('entrada-foto'), { target: { files: [new File(['x'], 'f.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remover foto' })).toHaveLength(1), ESPERA);
    fireEvent.click(screen.getByRole('button', { name: 'Avançar' }));

    await screen.findByRole('heading', { name: 'Seguro obrigatório' }, ESPERA);
    screen.getByText('Observação (obrigatória neste item)');
    fireEvent.click(screen.getByRole('radio', { name: 'Conforme' }));
    fireEvent.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(screen.getByRole('alert').textContent).toMatch('observação');
    fireEvent.change(screen.getByPlaceholderText('Digite aqui...'), { target: { value: 'Apólice vigente até 12/2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Avançar' }));
    await screen.findByRole('heading', { name: 'Autorização de tráfego interno' }, ESPERA);

    const salvo = await repositorioInspecao.obter(v.id);
    expect(salvo!.respostas.find((x) => x.itemId === item('CRLV em dia').id)!.evidenciaIds).toHaveLength(1);
    expect(salvo!.respostas.find((x) => x.itemId === item('Seguro obrigatório').id)!.observacao).toBe('Apólice vigente até 12/2026');
  });

  it('remover foto desvincula da resposta ao salvar', async () => {
    const v = await novaInspecao();
    const alvo = item('Lanternas traseiras');
    await responderNc(v.id, alvo.id, 'Lente quebrada', 'media');
    abrir(rotasInspecao.naoConformidade(v.id, alvo.id));
    await screen.findByRole('heading', { name: 'Registrar não conformidade' }, ESPERA);
    fireEvent.change(screen.getByTestId('entrada-foto'), { target: { files: [new File(['y'], 'g.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remover foto' })).toHaveLength(2), ESPERA);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover foto' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await screen.findByRole('heading', { name: 'Luz de freio' }, ESPERA);
    const r = (await repositorioInspecao.obter(v.id))!.respostas.find((x) => x.itemId === alvo.id)!;
    expect(r.evidenciaIds).toHaveLength(1);
  });

  it('conclui e mostra resultado, categorias e plano de ação (planoAcao/itemTitulo)', async () => {
    const v = await novaInspecao();
    await responderNc(v.id, item('Lanternas traseiras').id, 'Lanterna traseira direita com defeito.', 'critica');
    await responder(v.id, item('Autorização de tráfego interno').id, 'nao_aplica');
    for (const i of ITENS_LEVE) {
      if (i.titulo !== 'Lanternas traseiras' && i.titulo !== 'Autorização de tráfego interno') await responder(v.id, i.id, 'conforme');
    }

    abrir(rotasInspecao.categorias(v.id));
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir verificação' }, ESPERA));
    await screen.findByRole('heading', { name: 'Verificação concluída!' }, ESPERA);
    const esperado = Math.round(((ITENS_LEVE.length - 2) / (ITENS_LEVE.length - 1)) * 100);
    const anel = screen.getByRole('img', { name: `Índice de prontidão ${esperado}%` });
    // NC crítica: veredito "Não apto" na tela e anel vermelho, mesmo com índice alto
    screen.getByText('Não apto');
    screen.getByText('1 não conformidade crítica impede a operação.');
    expect(anel.className).toContain('anel--ruim');

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    await screen.findByRole('heading', { name: 'Resultado por categoria' }, ESPERA);
    screen.getByText('86%'); // iluminação: 6 de 7

    fireEvent.click(screen.getByRole('button', { name: 'Plano de ação' }));
    fireEvent.click(await screen.findByText('Lanterna traseira direita com defeito.', undefined, ESPERA));
    screen.getByText('Item: Lanternas traseiras');
    screen.getByRole('tab', { name: 'Crítica (1)' });
    // sem link configurado na marca, o botão não aparece
    expect(screen.queryByText('Falar com especialista')).toBeNull();
  });

  it('concluir não navega duas vezes: a tela redireciona sozinha', async () => {
    const v = await novaInspecao();
    for (const i of ITENS_LEVE) await responder(v.id, i.id, 'conforme');
    abrir(rotasInspecao.categorias(v.id));
    const botao = await screen.findByRole('button', { name: 'Concluir verificação' }, ESPERA);
    fireEvent.click(botao);
    fireEvent.click(botao);
    await screen.findByRole('heading', { name: 'Verificação concluída!' }, ESPERA);
    expect((await repositorioInspecao.obter(v.id))!.status).toBe('concluida');
  });
});

describe('núcleo configurável (regras reais da fundação)', () => {
  it('item fora da regra não aparece nem conta no progresso, e não bloqueia a conclusão', async () => {
    const v = await novaInspecao();
    abrir(rotasInspecao.categorias(v.id));
    await screen.findByText(`0 de ${ITENS_LEVE.length}`, undefined, ESPERA);
    expect(screen.queryByText('Telemetria e tecnologia')).toBeNull();
    cleanup();

    await concluirTudo(v.id);
    abrir(rotasInspecao.resultado(v.id));
    await screen.findByRole('img', { name: 'Índice de prontidão 100%' }, ESPERA);
  });

  it('mostra fabricante + modelo e o selo DEMO', async () => {
    const v = await novaInspecao('OWQ3A15', true);
    abrir(rotasInspecao.categorias(v.id));
    await screen.findByText(/OWQ3A15 - Ford Ranger/, undefined, ESPERA);
    screen.getByText('DEMO');
  });

  it('versão do checklist fora do aparelho: avisa em vez de quebrar', async () => {
    const v = await novaInspecao();
    await banco.modelos.clear();
    abrir(rotasInspecao.item(v.id, ITENS_LEVE[0]!.id));
    await screen.findByRole('heading', { name: 'Checklist indisponível neste aparelho' }, ESPERA);
  });
});
