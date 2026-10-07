import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SELO_ORIGEM, SEM_RESTRICAO, type ModeloBiblioteca, type Papel, type ResumoModeloBiblioteca, type SetorComContagem } from '@checkvale/shared';
import { PaginaBiblioteca, PaginaModeloBiblioteca, PaginaSetorBiblioteca } from './Biblioteca';

const sessao = vi.hoisted(() => ({ papel: 'admin' as Papel }));
vi.mock('../dados/sessao', () => ({
  useSessao: () => ({ usuario: { id: 'u', nome: 'Ana', email: 'a@b.c', papel: sessao.papel }, carregada: true }),
}));

const uid = () => crypto.randomUUID();
const ESPERA = { timeout: 4000 };

// Nomes de setor são dado de teste: a tela não conhece nenhum.
const SETORES: SetorComContagem[] = [
  { id: uid(), nome: 'Setor B', descricao: '', icone: 'chave-que-nao-existe', ordem: 2, ativo: true, totalModelos: 0 },
  { id: uid(), nome: 'Setor A', descricao: 'Primeiro', icone: 'picareta', ordem: 1, ativo: true, totalModelos: 1 },
];
const MODELO: ModeloBiblioteca = {
  id: uid(), versao: 3, setorIds: [SETORES[1]!.id], nome: 'Pré-uso de caminhão', resumo: 'Antes de rodar', origem: 'base_checkvale',
  fonte: null, status: 'publicada',
  categorias: [{
    id: uid(), codigo: 'pneus', nome: 'Pneus e rodas', icone: 'tire', ordem: 1, aplicavel: SEM_RESTRICAO,
    itens: [{ id: uid(), codigo: 'calibragem', titulo: 'Calibragem visual', descricao: '', ordem: 1, permiteNaoAplica: false, criticidadeSugerida: 'alta', aplicavel: SEM_RESTRICAO }],
  }],
};
const { categorias: _c, fonte: _f, status: _s, ...base } = MODELO;
const RESUMO: ResumoModeloBiblioteca = { ...base, totalCategorias: 1, totalItens: 1 };
const NOVO = { modeloId: uid(), versao: 1 };

let adocoes: unknown[];
beforeEach(() => {
  sessao.papel = 'admin';
  adocoes = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const json = (c: unknown, status = 200) => new Response(JSON.stringify(c), { status, headers: { 'content-type': 'application/json' } });
    if (url === '/api/biblioteca/setores') return json(SETORES);
    if (url.startsWith('/api/biblioteca/modelos?')) return json(url.includes(SETORES[1]!.id) ? [RESUMO] : []);
    if (url === `/api/biblioteca/modelos/${MODELO.id}/adotar`) {
      const corpo = JSON.parse(init!.body as string);
      adocoes.push(corpo);
      return json({ ...NOVO, status: corpo.modo === 'usar' ? 'publicada' : 'rascunho' });
    }
    if (url === `/api/biblioteca/modelos/${MODELO.id}`) return json(MODELO);
    return json({ erro: 'nao_encontrado', mensagem: 'Não encontrado.' }, 404);
  }));
});
afterEach(cleanup);

function abrir(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/admin/biblioteca" element={<PaginaBiblioteca />} />
        <Route path="/admin/biblioteca/modelo/:id" element={<PaginaModeloBiblioteca />} />
        <Route path="/admin/biblioteca/:setorId" element={<PaginaSetorBiblioteca />} />
        <Route path="/admin/modelos" element={<h1>Modelos da empresa</h1>} />
        <Route path="/admin/modelos/:id/v/:v" element={<h1>Editor do modelo</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('biblioteca de checklists', () => {
  it('lista os setores que a API manda, na ordem do cadastro, e entra no setor', async () => {
    abrir('/admin/biblioteca');
    const links = await screen.findAllByRole('link', { name: /Setor [AB]/ }, ESPERA);
    expect(links.map((l) => l.textContent)).toEqual([expect.stringContaining('Setor A'), expect.stringContaining('Setor B')]);
    expect(screen.getByText('Nenhum modelo ainda')).toBeTruthy(); // ícone desconhecido não quebra a tela
    fireEvent.click(links[0]!);
    await screen.findByText('Pré-uso de caminhão', undefined, ESPERA);
    expect(screen.getByText(SELO_ORIGEM.base_checkvale)).toBeTruthy();
  });

  it('prévia mostra o selo e os itens; nunca "oficial"', async () => {
    abrir(`/admin/biblioteca/modelo/${MODELO.id}`);
    await screen.findByText('Modelo Base CheckVale', undefined, ESPERA);
    fireEvent.click(screen.getByRole('button', { name: /Pneus e rodas/ }));
    expect(screen.getByText('Calibragem visual')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/oficial/i);
  });

  it('personalizar copia como rascunho e abre o editor', async () => {
    abrir(`/admin/biblioteca/modelo/${MODELO.id}`);
    fireEvent.click(await screen.findByRole('button', { name: /Personalizar/ }, ESPERA));
    await screen.findByRole('heading', { name: 'Editor do modelo' }, ESPERA);
    expect(adocoes).toEqual([{ modo: 'personalizar' }]);
  });

  it('usar modelo pede modo "usar"', async () => {
    abrir(`/admin/biblioteca/modelo/${MODELO.id}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Usar modelo' }, ESPERA));
    await screen.findByRole('heading', { name: 'Editor do modelo' }, ESPERA);
    expect(adocoes).toEqual([{ modo: 'usar' }]);
  });

  it('perfil sem config:editar só consulta', async () => {
    sessao.papel = 'inspetor';
    abrir(`/admin/biblioteca/modelo/${MODELO.id}`);
    await screen.findByText(/não adotar modelos/, undefined, ESPERA);
    expect(screen.queryByRole('button', { name: 'Usar modelo' })).toBeNull();
  });
});
