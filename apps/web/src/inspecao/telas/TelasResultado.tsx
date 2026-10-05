import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { Criticidade, Inspecao, ModeloChecklist, ResultadoInspecao } from '@checkvale/shared';
import { useSituacaoSyncInspecao } from '../../dados/estadoSync';
import { useChecklistDaInspecao } from '../../dados/ganchos';
import { abrirRelatorio } from '../../lib/relatorio';
import { MARCA } from '../../marca';
import { Evidencias } from '../componentes/Evidencias';
import { Icone } from '../componentes/Icone';
import { Carregando, ChecklistIndisponivel, Moldura, NaoEncontrada, SeloSituacao } from '../componentes/Moldura';
import { rotas } from '../rotas';
import { CRITICIDADES, ROTULO_CRITICIDADE } from './TelaNaoConformidade';
import { respostaDe } from './TelaItem';

/** Faixas de cor das barras e do anel. Um lugar só, para ajustar com o produto. */
export function faixa(percentual: number | null): 'bom' | 'medio' | 'ruim' | 'na' {
  if (percentual === null) return 'na';
  if (percentual >= 80) return 'bom';
  if (percentual >= 50) return 'medio';
  return 'ruim';
}

type Concluida = { verificacao: Inspecao; modelo: ModeloChecklist; resultado: ResultadoInspecao };

function useConcluida(): Concluida | null | undefined | 'rascunho' | 'indisponivel' {
  const { inspecaoId = '' } = useParams();
  const dados = useChecklistDaInspecao(inspecaoId);
  if (dados.carregando) return undefined;
  const { inspecao, modelo, resultado } = dados;
  if (!inspecao) return null;
  if (inspecao.status === 'em_andamento') return 'rascunho';
  if (!modelo || !resultado) return 'indisponivel';
  return { verificacao: inspecao, modelo, resultado };
}

/** Tela 10. */
export function TelaResultado() {
  const dados = useConcluida();
  const navegar = useNavigate();
  const { inspecaoId = '' } = useParams();
  const situacao = useSituacaoSyncInspecao(inspecaoId)?.situacao;
  const [erroPdf, setErroPdf] = useState<string>();
  const [gerando, setGerando] = useState(false);
  if (dados === undefined) return <Carregando />;
  if (dados === null) return <NaoEncontrada />;
  if (dados === 'rascunho') return <Navigate to={rotas.categorias(inspecaoId)} replace />;
  if (dados === 'indisponivel') return <ChecklistIndisponivel />;
  const { verificacao: v, resultado: r } = dados;
  const sincronizada = situacao === 'tudo_enviado';

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
            disabled={!sincronizada || gerando}
            onClick={() => {
              setErroPdf(undefined);
              setGerando(true);
              abrirRelatorio(v.id)
                .catch((e: unknown) => setErroPdf(e instanceof Error ? e.message : 'Não foi possível abrir o relatório.'))
                .finally(() => setGerando(false));
            }}
          >
            Gerar relatório (PDF)
          </button>
          {erroPdf && <p className="erro centro" role="alert">{erroPdf}</p>}
          {!sincronizada && <p className="dica centro">O relatório fica disponível quando a verificação for enviada.</p>}
        </>
      }
    >
      <h1 className="centro">Verificação concluída!</h1>
      <p className="centro">
        <SeloSituacao situacao={situacao} />
      </p>
      <Anel percentual={r.indice} />
      <div className="cartoes">
        {/* ponto de atenção é um conforme com observação: sai daqui para não contar duas vezes */}
        <Cartao tom="bom" icone="check" valor={r.conformes - r.pontosAtencao} rotulo="Itens conformes" />
        <Cartao tom="medio" icone="alerta" valor={r.pontosAtencao} rotulo="Pontos de atenção" />
        <Cartao tom="ruim" icone="x" valor={r.naoConformes} rotulo="Não conformes" />
        <Cartao tom="na" icone="menos" valor={r.naoAplica} rotulo="Não se aplicam" />
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
  const { inspecaoId = '' } = useParams();
  if (dados === undefined) return <Carregando />;
  if (dados === null) return <NaoEncontrada />;
  if (dados === 'rascunho') return <Navigate to={rotas.categorias(inspecaoId)} replace />;
  if (dados === 'indisponivel') return <ChecklistIndisponivel />;
  const { verificacao: v, modelo, resultado: r } = dados;

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
        {modelo.categorias.map((c) => {
          const resumo = r.porCategoria.find((x) => x.categoriaId === c.id);
          // nada aplicável na categoria (tudo "não se aplica"): N/A em vez de 0%
          const aplicaveis = resumo ? resumo.respondidos - resumo.naoAplica : 0;
          const p = { percentual: resumo && aplicaveis > 0 ? resumo.indice : null };
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
  const { inspecaoId = '' } = useParams();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [aberto, setAberto] = useState<string>();
  if (dados === undefined) return <Carregando />;
  if (dados === null) return <NaoEncontrada />;
  if (dados === 'rascunho') return <Navigate to={rotas.categorias(inspecaoId)} replace />;
  if (dados === 'indisponivel') return <ChecklistIndisponivel />;
  const { verificacao: v, resultado } = dados;
  const acoes = resultado.planoAcao;
  const visiveis = filtro === 'todos' ? acoes : acoes.filter((a) => a.criticidade === filtro);
  const filtros: Filtro[] = ['todos', ...CRITICIDADES.filter((c) => acoes.some((a) => a.criticidade === c))];
  const nomeFiltro = (f: Filtro) =>
    f === 'todos' ? `Todos (${acoes.length})` : `${ROTULO_CRITICIDADE[f].nome} (${acoes.filter((a) => a.criticidade === f).length})`;

  return (
    <Moldura
      voltarPara={rotas.resultadoCategorias(v.id)}
      rodape={
        MARCA.contatoEspecialista ? (
          <a className="botao botao--primario" href={MARCA.contatoEspecialista} target="_blank" rel="noreferrer">
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
                    <p className="sub">Item: {a.itemTitulo}</p>
                    <Evidencias inspecaoId={v.id} itemId={a.itemId} ids={respostaDe(v, a.itemId)?.evidenciaIds ?? []} />
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
