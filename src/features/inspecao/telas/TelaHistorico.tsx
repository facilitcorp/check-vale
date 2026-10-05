import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Verificacao } from '@/contracts/checklist';
import { Icone } from '../componentes/Icone';
import { Carregando, Moldura, nomeVeiculo, SeloDemo, SeloSituacao } from '../componentes/Moldura';
import { useInspecao } from '../contexto';
import { useSituacaoSyncInspecao } from '../dados/estadoSync';
import { useChecklistDaInspecao } from '../dados/ganchos';
import { rotas } from '../rotas';
import { dataHora } from './formatos';
import { faixa } from './TelasResultado';

/** Histórico: todas as verificações deste aparelho, da mais recente para a mais antiga. */
export function TelaHistorico() {
  const { banco } = useInspecao();
  const todas = useLiveQuery(() => banco.verificacoes.orderBy('iniciadaEm').reverse().toArray(), [banco]);
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
export function LinhaHistorico({ verificacao: v }: { verificacao: Verificacao }) {
  const navegar = useNavigate();
  const { resultado, modelo, carregando } = useChecklistDaInspecao(v.id);
  const situacao = useSituacaoSyncInspecao(v.id)?.situacao;
  const concluida = v.status === 'concluida';
  const indice = concluida && resultado ? resultado.indiceProntidao : null;
  const destino = concluida ? rotas.resultado(v.id) : rotas.categorias(v.id);
  const data = dataHora(v.concluidaEm ?? v.iniciadaEm);

  return (
    <button className="linha linha--historico" onClick={() => navegar(destino)}>
      <span className="linha__texto">
        <span className="linha__titulo">
          <strong className="placa">{v.veiculo.placa}</strong>
          <SeloDemo veiculo={v.veiculo} />
        </span>
        <span className="sub">{nomeVeiculo(v.veiculo)}</span>
        <span className="dica">{data}</span>
        <SeloSituacao situacao={situacao} />
      </span>
      <span className="linha__resultado">
        {!concluida ? (
          <span className="resultado resultado--andamento">Em andamento</span>
        ) : indice !== null ? (
          <span className={`resultado resultado--${faixa(indice)}`} aria-label={`Índice de prontidão ${indice}%`}>
            {indice}%
          </span>
        ) : (
          <span className="resultado resultado--na">{carregando ? '…' : modelo === null ? 'Indisponível' : '—'}</span>
        )}
      </span>
      <Icone nome="seguir" tamanho={16} className="linha__seta" />
    </button>
  );
}
