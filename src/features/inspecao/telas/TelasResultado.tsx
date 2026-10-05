import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { Criticidade, ModeloChecklist, Verificacao } from '@/contracts/checklist';
import { CRITICIDADES } from '@/contracts/checklist';
import { Evidencias } from '../componentes/Evidencias';
import { Icone } from '../componentes/Icone';
import { Carregando, ChecklistIndisponivel, Moldura, NaoEncontrada } from '../componentes/Moldura';
import { useEstadoFila, useInspecao, useVerificacao } from '../contexto';
import { calcularResultado, planoDeAcao } from '../dominio/resultado';
import { rotas } from '../rotas';
import { ROTULO_CRITICIDADE } from './TelaNaoConformidade';

/** Faixas de cor das barras e do anel. Um lugar só, para ajustar com o produto. */
export function faixa(percentual: number | null): 'bom' | 'medio' | 'ruim' | 'na' {
  if (percentual === null) return 'na';
  if (percentual >= 80) return 'bom';
  if (percentual >= 50) return 'medio';
  return 'ruim';
}

function useConcluida():
  | { verificacao: Verificacao; modelo: ModeloChecklist }
  | null
  | undefined
  | 'rascunho'
  | 'indisponivel' {
  const { verificacaoId = '' } = useParams();
  const dados = useVerificacao(verificacaoId);
  if (!dados) return dados;
  if (dados.verificacao.status !== 'concluida') return 'rascunho';
  if (!dados.modelo) return 'indisponivel';
  return { verificacao: dados.verificacao, modelo: dados.modelo };
}

/** Tela 10. */
export function TelaResultado() {
  const dados = useConcluida();
  const navegar = useNavigate();
  const { pendentes, online } = useEstadoFila();
  const { abrirRelatorio } = useInspecao();
  const { verificacaoId = '' } = useParams();
  if (dados === undefined) return <Carregando />;
  if (dados === null) return <NaoEncontrada />;
  if (dados === 'rascunho') return <Navigate to={rotas.categorias(verificacaoId)} replace />;
  if (dados === 'indisponivel') return <ChecklistIndisponivel />;
  const { verificacao: v, modelo } = dados;
  const r = calcularResultado(modelo, v);
  const sincronizada = online && pendentes === 0;

  return (
    <Moldura
      voltarPara="/"
      rodape={
        <>
          <button className="botao botao--secundario" onClick={() => navegar(rotas.resultadoCategorias(v.id))}>
            Ver detalhes
          </button>
          {/* O PDF é gerado pela API (fundação). Offline, ainda não existe no servidor. */}
          <button
            className="botao botao--primario"
            disabled={!sincronizada || !abrirRelatorio}
            onClick={() => abrirRelatorio?.(v.id)}
          >
            Gerar relatório (PDF)
          </button>
          {!sincronizada && <p className="dica centro">O relatório fica disponível quando a verificação for enviada.</p>}
        </>
      }
    >
      <h1 className="centro">Verificação concluída!</h1>
      <Anel percentual={r.indiceProntidao} />
      <div className="cartoes">
        {/* ponto de atenção é um conforme com observação: sai daqui para não contar duas vezes */}
        <Cartao tom="bom" icone="check" valor={r.conformes - r.pontosAtencao} rotulo="Itens conformes" />
        <Cartao tom="medio" icone="alerta" valor={r.pontosAtencao} rotulo="Pontos de atenção" />
        <Cartao tom="ruim" icone="x" valor={r.naoConformes} rotulo="Não conformes" />
        <Cartao tom="na" icone="menos" valor={r.naoSeAplica} rotulo="Não se aplicam" />
      </div>
    </Moldura>
  );
}

function Anel({ percentual }: { percentual: number }) {
  const raio = 52;
  const volta = 2 * Math.PI * raio;
  return (
    <div className={`anel anel--${faixa(percentual)}`} role="img" aria-label={`Índice de prontidão ${percentual}%`}>
      <svg viewBox="0 0 120 120" width="168" height="168">
        <circle cx="60" cy="60" r={raio} className="anel__fundo" />
        <circle
          cx="60"
          cy="60"
          r={raio}
          className="anel__valor"
          strokeDasharray={volta}
          strokeDashoffset={volta * (1 - percentual / 100)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="anel__texto">
        <strong>{percentual}%</strong>
        <small>Índice de prontidão</small>
      </div>
    </div>
  );
}

function Cartao(props: { tom: string; icone: string; valor: number; rotulo: string }) {
  return (
    <div className={`cartao cartao--${props.tom}`}>
      <span className="cartao__icone">
        <Icone nome={props.icone} tamanho={16} />
      </span>
      <strong>{props.valor}</strong>
      <small>{props.rotulo}</small>
    </div>
  );
}

/** Tela 11. */
export function TelaResultadoCategorias() {
  const dados = useConcluida();
  const navegar = useNavigate();
  const { verificacaoId = '' } = useParams();
  if (dados === undefined) return <Carregando />;
  if (dados === null) return <NaoEncontrada />;
  if (dados === 'rascunho') return <Navigate to={rotas.categorias(verificacaoId)} replace />;
  if (dados === 'indisponivel') return <ChecklistIndisponivel />;
  const { verificacao: v, modelo } = dados;
  const r = calcularResultado(modelo, v);

  return (
    <Moldura
      voltarPara={rotas.resultado(v.id)}
      rodape={
        <button className="botao botao--secundario" onClick={() => navegar(rotas.plano(v.id))}>
          Plano de ação
        </button>
      }
    >
      <h1>Resultado por categoria</h1>
      <ul className="barras">
        {modelo.categorias.map((c, i) => {
          const p = r.categorias[i];
          const f = faixa(p.percentual);
          return (
            <li key={c.id} className="barras__linha">
              <span className="barras__nome">{c.nome}</span>
              <span className="barras__trilho">
                <span className={`barras__valor barras__valor--${f}`} style={{ width: `${p.percentual ?? 0}%` }} />
              </span>
              <span className="barras__pct">{p.percentual === null ? 'N/A' : `${p.percentual}%`}</span>
            </li>
          );
        })}
      </ul>
    </Moldura>
  );
}

type Filtro = 'todos' | Criticidade;

/** Tela 12. */
export function TelaPlanoAcao() {
  const dados = useConcluida();
  const { marca } = useInspecao();
  const { verificacaoId = '' } = useParams();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [aberto, setAberto] = useState<string>();
  if (dados === undefined) return <Carregando />;
  if (dados === null) return <NaoEncontrada />;
  if (dados === 'rascunho') return <Navigate to={rotas.categorias(verificacaoId)} replace />;
  if (dados === 'indisponivel') return <ChecklistIndisponivel />;
  const { verificacao: v, modelo } = dados;
  const acoes = planoDeAcao(modelo, v);
  const visiveis = filtro === 'todos' ? acoes : acoes.filter((a) => a.criticidade === filtro);
  const filtros: Filtro[] = ['todos', ...CRITICIDADES.filter((c) => acoes.some((a) => a.criticidade === c))];
  const nomeFiltro = (f: Filtro) =>
    f === 'todos' ? `Todos (${acoes.length})` : `${ROTULO_CRITICIDADE[f].nome} (${acoes.filter((a) => a.criticidade === f).length})`;

  return (
    <Moldura
      voltarPara={rotas.resultadoCategorias(v.id)}
      rodape={
        marca.contatoEspecialista ? (
          <a className="botao botao--primario" href={marca.contatoEspecialista} target="_blank" rel="noreferrer">
            Falar com especialista
          </a>
        ) : undefined
      }
    >
      <h1>Plano de ação</h1>
      <p className="sub">Principais pontos para correção antes da mobilização.</p>

      {acoes.length === 0 ? (
        <p className="vazio">Nenhuma não conformidade. Veículo sem pendências.</p>
      ) : (
        <>
          <div className="filtros" role="tablist">
            {filtros.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filtro === f}
                className={`filtro ${filtro === f ? 'filtro--ativo' : ''}`}
                onClick={() => setFiltro(f)}
              >
                {nomeFiltro(f)}
              </button>
            ))}
          </div>
          <ul className="lista">
            {visiveis.map((a) => (
              <li key={a.itemId}>
                <button
                  className="linha"
                  aria-expanded={aberto === a.itemId}
                  onClick={() => setAberto(aberto === a.itemId ? undefined : a.itemId)}
                >
                  <span className={`chip chip--${a.criticidade}`}>{ROTULO_CRITICIDADE[a.criticidade].nome}</span>
                  <span className="linha__texto">{a.descricao}</span>
                  <Icone nome="seguir" tamanho={16} className="linha__seta" />
                </button>
                {aberto === a.itemId && (
                  <div className="detalhe">
                    <p className="sub">Item: {a.tituloItem}</p>
                    <Evidencias verificacaoId={v.id} itemId={a.itemId} somenteLeitura />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Moldura>
  );
}
