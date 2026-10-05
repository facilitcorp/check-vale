// Arquivo próprio: o estado do sync é do módulo e precisa começar "sem nenhuma sincronização concluída".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes } from 'react-router-dom';
import { banco } from '../dados/banco';
import { sincronizar } from '../dados/sincronizacao';
import { rotasDaInspecao } from '.';
import { ITENS_LEVE, MODELO, novaInspecao, prepararAparelho, servidorFalso } from './teste-apoio';

const ESPERA = { timeout: 4000 };
const INDISPONIVEL = 'Checklist indisponível';

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>{rotasDaInspecao}</Routes>
    </MemoryRouter>,
  );
}

/** Rota de versões presa até liberar(): simula sinal fraco no aparelho novo. */
function versoesLentas(resposta: () => Response) {
  const original = globalThis.fetch;
  let liberar!: () => void;
  const aberta = new Promise<void>((r) => (liberar = r));
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/versoes/')) {
      await aberta;
      return resposta();
    }
    return original(url, init);
  }));
  return liberar;
}

beforeEach(async () => {
  servidorFalso();
  await prepararAparelho();
});
afterEach(cleanup);

describe('aparelho novo, com a versão da inspeção ainda baixando', () => {
  it('mostra "Carregando…", nunca "indisponível", até a versão chegar', async () => {
    const v = await novaInspecao('RTY4B22');
    await banco.modelos.clear();
    const liberar = versoesLentas(() => new Response(JSON.stringify(MODELO), { headers: { 'content-type': 'application/json' } }));
    let apareceu = false;
    const observador = new MutationObserver(() => {
      if (document.body.textContent?.includes(INDISPONIVEL)) apareceu = true;
    });
    observador.observe(document.body, { subtree: true, childList: true, characterData: true });

    const rodada = sincronizar();
    try {
      abrir();
      const cartao = await screen.findByRole('article', { name: /RTY4B22/ }, ESPERA);
      await within(cartao).findByText('Carregando…', undefined, ESPERA);
      await vi.waitFor(async () => expect(await banco.inspecoes.get(v.id)).toBeTruthy());
      liberar();
      await rodada;
      await within(cartao).findByText(new RegExp(`0 de ${ITENS_LEVE.length} itens`), undefined, ESPERA);
      expect(apareceu).toBe(false);
    } finally {
      observador.disconnect();
      liberar(); // se falhar no meio, não deixa o sync preso para o próximo teste
      await rodada;
    }
  });

  it('depois do 1º sync, versão que falta de verdade aparece como indisponível, sem "Carregando…"', async () => {
    await novaInspecao('OWQ3A15');
    await banco.modelos.clear();
    const liberar = versoesLentas(() => new Response(JSON.stringify({ erro: 'nao_encontrado' }), { status: 404 }));
    liberar();
    await sincronizar(); // o teste anterior já concluiu um sync: aqui não é mais a 1ª rodada
    const rodada = sincronizar();
    abrir();
    const cartao = await screen.findByRole('article', { name: /OWQ3A15/ }, ESPERA);
    await within(cartao).findByText(new RegExp(INDISPONIVEL), undefined, ESPERA);
    await rodada;
    expect(within(cartao).queryByText('Carregando…')).toBeNull();
  });
});
