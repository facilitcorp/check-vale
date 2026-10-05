/**
 * CASCA PROVISÓRIA DE DESENVOLVIMENTO. Serve só para rodar o fluxo da
 * inspeção (telas 5–12) enquanto a fundação (login, operação, veículo, API e
 * transporte HTTP) não chega. Na integração, este arquivo é substituído.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BancoLocal } from '@/infra/offline/banco';
import { FilaSincronizacao, type TransporteSync } from '@/infra/offline/fila';
import { aplicarMarca, MARCA_PADRAO } from '@/infra/branding/marca';
import { ProvedorInspecao, rotasDaInspecao, rotasInspecao, useInspecao } from '@/features/inspecao';
import { MODELO_EXEMPLO } from '@/features/inspecao/dados/modelo-exemplo';
import { Moldura } from '@/features/inspecao/componentes/Moldura';
import './estilos.css';

/** Sem API ainda: finge que enviou, com uma pequena espera. */
const transporteDeMentira: TransporteSync = {
  enviar: () => new Promise((ok) => setTimeout(ok, 300)),
};

const banco = new BancoLocal();
const fila = new FilaSincronizacao(banco, transporteDeMentira);
fila.iniciarAutomatico();
aplicarMarca(MARCA_PADRAO);

function InicioProvisorio() {
  const { repo, banco } = useInspecao();
  const navegar = useNavigate();
  const lista = useLiveQuery(() => banco.verificacoes.orderBy('iniciadaEm').reverse().toArray(), [banco]) ?? [];

  const nova = async () => {
    await repo.guardarModelo(MODELO_EXEMPLO);
    const v = await repo.iniciar({
      operacao: {
        unidadeId: 'carajas', unidadeNome: 'Complexo Carajás (PA)', areaId: 'operacional', areaNome: 'Área operacional',
        atividadeId: 'transporte-pessoas', atividadeNome: 'Transporte de pessoas',
      },
      veiculo: {
        id: 'demo-1', placa: 'OWQ3A15', descricao: 'Caminhonete', fabricante: 'Ford', modelo: 'Ranger', tipo: 'leve', demo: true,
      },
      modeloId: MODELO_EXEMPLO.id,
      modeloVersao: MODELO_EXEMPLO.versao,
    });
    navegar(rotasInspecao.categorias(v.id));
  };

  return (
    <Moldura rodape={<button className="botao botao--primario" onClick={nova}>Nova verificação (exemplo)</button>}>
      <h1>Minhas verificações</h1>
      <p className="sub">Tela provisória: login, operação e veículo vêm da fundação.</p>
      <ul className="lista">
        {lista.map((v) => (
          <li key={v.id}>
            <button
              className="linha"
              onClick={() => navegar(v.status === 'concluida' ? rotasInspecao.resultado(v.id) : rotasInspecao.categorias(v.id))}
            >
              <span className="linha__texto">
                {v.veiculo.placa} · {v.veiculo.descricao}
                <small className="sub"> {new Date(v.iniciadaEm).toLocaleString('pt-BR')}</small>
              </span>
              <span className={`chip ${v.status === 'concluida' ? 'chip--ok' : 'chip--media'}`}>
                {v.status === 'concluida' ? 'Concluída' : 'Em andamento'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Moldura>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProvedorInspecao banco={banco} fila={fila} marca={MARCA_PADRAO}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<InicioProvisorio />} />
          {rotasDaInspecao}
        </Routes>
      </BrowserRouter>
    </ProvedorInspecao>
  </StrictMode>,
);
