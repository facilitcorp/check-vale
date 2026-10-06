import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Inspecao } from '@checkvale/shared';
import { useSituacaoSyncInspecao } from '../../dados/estadoSync';
import { useChecklistDaInspecao } from '../../dados/ganchos';
import { repositorioInspecao } from '../../dados/repositorio';
import { Icone } from '../componentes/Icone';
import { Carregando, Moldura, SeloDemo, SeloSituacao } from '../componentes/Moldura';
import { rotas } from '../rotas';
import { dataHora, identificacaoVeiculo, nomeVeiculo, useDescricaoInspecao } from './formatos';
import { SeloVeredito, tomDoResultado } from './TelasResultado';

/** Histórico: todas as verificações deste aparelho, da mais recente para a mais antiga. */
export function TelaHistorico() {
  const todas = useLiveQuery(() => repositorioInspecao.listar(), []);
  if (todas === undefined) return <Carregando />;
  return (
    <Moldura voltarPara="/">
      <h1>Histórico</h1>
      <p className="sub">Verificações feitas neste aparelho.</p>
      {todas.length === 0 ? (
        <p className="vazio">Nenhuma verificação ainda.</p>
      ) : (
        <ul className="lista lista--espacada">
          {todas.map((v) => (
            <li key={v.id}>
              <LinhaHistorico verificacao={v} />
            </li>
          ))}
        </ul>
      )}
    </Moldura>
  );
}

/** Uma linha: veículo, placa, data, resultado e situação de envio. Toque abre os detalhes. */
export function LinhaHistorico({ verificacao: v }: { verificacao: Inspecao }) {
  const navegar = useNavigate();
  const dados = useChecklistDaInspecao(v.id);
  const resultado = dados.carregando ? null : dados.resultado;
  const situacao = useSituacaoSyncInspecao(v.id)?.situacao;
  const { veiculo } = useDescricaoInspecao(v);
  const concluida = v.status === 'concluida';
  const final = concluida && resultado ? resultado : null;
  const destino = concluida ? rotas.resultado(v.id) : rotas.categorias(v.id);
  const data = dataHora(v.concluidaEm ?? v.iniciadaEm);

  return (
    <button className="linha linha--historico" onClick={() => navegar(destino)}>
      <span className="linha__texto">
        <span className="linha__titulo">
          <strong className="placa">{identificacaoVeiculo(veiculo)}</strong>
          <SeloDemo veiculo={veiculo} />
        </span>
        <span className="sub">{nomeVeiculo(veiculo)}</span>
        <span className="dica">{data}</span>
        <span className="linha__selos">
          {final && <SeloVeredito resultado={final} compacto />}
          <SeloSituacao situacao={situacao} />
        </span>
      </span>
      <span className="linha__resultado">
        {!concluida ? (
          <span className="resultado resultado--andamento">Em andamento</span>
        ) : final ? (
          <span className={`resultado resultado--${tomDoResultado(final)}`} aria-label={`Índice de prontidão ${final.indice}%`}>
            {final.indice}%
          </span>
        ) : (
          <span className="resultado resultado--na">{dados.carregando ? '…' : dados.modelo === null ? 'Indisponível' : '—'}</span>
        )}
      </span>
      <Icone nome="seguir" tamanho={16} className="linha__seta" />
    </button>
  );
}
