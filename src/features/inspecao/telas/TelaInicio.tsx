import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Verificacao } from '@/contracts/checklist';
import { ROTULO_SITUACAO } from '@/infra/offline/situacao';
import { BarraProgresso, Moldura, nomeVeiculo, SeloDemo, SeloSituacao } from '../componentes/Moldura';
import { useInspecao, useSituacaoDaInspecao, useSituacaoGlobal } from '../contexto';
import { useChecklistDaInspecao } from '../dados/ganchos';
import { rotas } from '../rotas';
import { dataHora, textoOperacao } from './formatos';
import { LinhaHistorico } from './TelaHistorico';

const ULTIMOS = 3;

/** Tela inicial do inspetor: continuar o que está aberto, começar outra, ver as últimas. */
export function TelaInicio() {
  const { banco, rotaNovaVerificacao } = useInspecao();
  const navegar = useNavigate();
  const todas = useLiveQuery(() => banco.verificacoes.orderBy('iniciadaEm').reverse().toArray(), [banco]);
  const emAndamento = todas?.filter((v) => v.status === 'rascunho') ?? [];
  const concluidas = todas?.filter((v) => v.status === 'concluida') ?? [];

  return (
    <Moldura
      rodape={
        <button className="botao botao--primario" onClick={() => navegar(rotaNovaVerificacao)}>
          Nova verificação
        </button>
      }
    >
      <h1>Verificações</h1>
      <CartaoSincronizacao />

      {todas === undefined ? (
        <div className="carregando" aria-busy="true" aria-label="Carregando">
          <span className="carregando__bloco" />
          <span className="carregando__bloco" />
        </div>
      ) : (
        <>
          {emAndamento.length > 0 && (
            <section className="secao" aria-labelledby="titulo-andamento">
              <h2 id="titulo-andamento">Em andamento</h2>
              <ul className="lista">
                {emAndamento.map((v) => (
                  <li key={v.id}>
                    <CartaoAndamento verificacao={v} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="secao" aria-labelledby="titulo-ultimos">
            <div className="secao__topo">
              <h2 id="titulo-ultimos">Últimos checklists</h2>
              {concluidas.length > 0 && (
                <Link className="link" to={rotas.historico()}>
                  Ver histórico
                </Link>
              )}
            </div>
            {concluidas.length === 0 ? (
              <p className="vazio vazio--curto">Nenhum checklist concluído neste aparelho ainda.</p>
            ) : (
              <ul className="lista">
                {concluidas.slice(0, ULTIMOS).map((v) => (
                  <li key={v.id}>
                    <LinhaHistorico verificacao={v} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Moldura>
  );
}

function CartaoSincronizacao() {
  const { situacao, pendentes, tentarAgora } = useSituacaoGlobal();
  return (
    <div className={`cartao-sync cartao-sync--${situacao}`}>
      <div>
        <SeloSituacao situacao={situacao} />
        <p className="dica">
          {ROTULO_SITUACAO[situacao].ajuda}
          {pendentes > 0 && ` ${pendentes} envio${pendentes > 1 ? 's' : ''} pendente${pendentes > 1 ? 's' : ''}.`}
        </p>
      </div>
      {situacao === 'erro' && (
        <button className="botao botao--secundario botao--compacto" onClick={tentarAgora}>
          Tentar agora
        </button>
      )}
    </div>
  );
}

function CartaoAndamento({ verificacao: v }: { verificacao: Verificacao }) {
  const navegar = useNavigate();
  const { resultado, carregando } = useChecklistDaInspecao(v.id);
  const situacao = useSituacaoDaInspecao(v);
  return (
    <article className="cartao-inspecao" aria-label={`Verificação em andamento: ${v.veiculo.placa}`}>
      <div className="cartao-inspecao__topo">
        <div>
          <span className="linha__titulo">
            <strong className="placa">{v.veiculo.placa}</strong>
            <SeloDemo veiculo={v.veiculo} />
          </span>
          <p className="sub">{nomeVeiculo(v.veiculo)}</p>
        </div>
        <SeloSituacao situacao={situacao} />
      </div>
      <p className="dica">{textoOperacao(v)}</p>
      {resultado ? (
        <>
          <BarraProgresso valor={resultado.respondidos} total={resultado.total} />
          <p className="dica">
            {resultado.respondidos} de {resultado.total} itens · iniciada em {dataHora(v.iniciadaEm)}
          </p>
        </>
      ) : (
        <p className="dica">
          {carregando ? 'Carregando…' : 'Checklist indisponível neste aparelho. Conecte-se para sincronizar.'}
        </p>
      )}
      <button className="botao botao--primario" onClick={() => navegar(rotas.categorias(v.id))}>
        Continuar verificação
      </button>
    </article>
  );
}
