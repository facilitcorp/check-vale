/**
 * CASCA PROVISÓRIA DE DESENVOLVIMENTO. Serve só para rodar o fluxo da
 * inspeção (telas 5–12) enquanto a fundação (login, operação, veículo, API e
 * transporte HTTP) não chega. Na integração, este arquivo é substituído.
 */
import { StrictMode, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { BancoLocal } from '@/infra/offline/banco';
import { FilaSincronizacao, type TransporteSync } from '@/infra/offline/fila';
import { aplicarMarca, MARCA_PADRAO } from '@/infra/branding/marca';
import { ProvedorInspecao, rotasDaInspecao, rotasInspecao, useInspecao } from '@/features/inspecao';
import { MODELO_EXEMPLO } from '@/features/inspecao/dados/modelo-exemplo';
import './estilos.css';

/** Sem API ainda: finge que enviou. `?falhar=1` na URL simula o servidor recusando (QA). */
const transporteDeMentira: TransporteSync = {
  enviar: () =>
    new Promise((ok, falha) =>
      setTimeout(() => (localStorage.getItem('qa-falhar') === '1' ? falha(new Error('HTTP 500')) : ok()), 300),
    ),
};
if (new URLSearchParams(location.search).has('falhar')) localStorage.setItem('qa-falhar', new URLSearchParams(location.search).get('falhar')!);

const banco = new BancoLocal();
const fila = new FilaSincronizacao(banco, transporteDeMentira);
fila.iniciarAutomatico();
aplicarMarca(MARCA_PADRAO);

/** Provisório: a fundação leva para operação → veículo. Aqui cria uma inspeção DEMO. */
function NovaVerificacaoProvisoria() {
  const { repo } = useInspecao();
  const navegar = useNavigate();
  const criou = useRef(false); // StrictMode roda o efeito duas vezes em dev
  useEffect(() => {
    if (criou.current) return;
    criou.current = true;
    void (async () => {
      await repo.guardarModelo(MODELO_EXEMPLO);
      const v = await repo.iniciar({
        operacao: {
          unidadeId: 'demo', unidadeNome: 'Complexo DEMO', areaId: 'operacional', areaNome: 'Área operacional',
          atividadeId: 'transporte-pessoas', atividadeNome: 'Transporte de pessoas',
        },
        veiculo: {
          id: 'demo-1', placa: 'OWQ3A15', descricao: 'Caminhonete', fabricante: 'Ford', modelo: 'Ranger', tipo: 'leve', demo: true,
        },
        modeloId: MODELO_EXEMPLO.id,
        modeloVersao: MODELO_EXEMPLO.versao,
      });
      navegar(rotasInspecao.categorias(v.id), { replace: true });
    })();
  }, [repo, navegar]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProvedorInspecao banco={banco} fila={fila} marca={MARCA_PADRAO}>
      <BrowserRouter>
        <Routes>
          <Route path="/nova-verificacao" element={<NovaVerificacaoProvisoria />} />
          {rotasDaInspecao}
        </Routes>
      </BrowserRouter>
    </ProvedorInspecao>
  </StrictMode>,
);
