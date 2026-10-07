import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { faltaEvidencia, type Inspecao, type ModeloChecklist, type ResumoCategoria } from '@checkvale/shared';
import { useSituacaoSyncInspecao } from '../../dados/estadoSync';
import { useChecklistDaInspecao } from '../../dados/ganchos';
import { repositorioInspecao } from '../../dados/repositorio';
import {
  BarraProgresso,
  Carregando,
  ChecklistIndisponivel,
  Moldura,
  NaoEncontrada,
  SeloDemo,
  SeloSituacao,
} from '../componentes/Moldura';
import { Icone } from '../componentes/Icone';
import { rotas } from '../rotas';
import { identificacaoVeiculo, nomeVeiculo, useDescricaoInspecao } from './formatos';

/** Primeiro item sem resposta (na ordem do checklist), opcionalmente dentro de uma categoria. */
export function proximoPendente(modelo: ModeloChecklist, v: Inspecao, categoriaId?: string) {
  const respondidos = new Set(v.respostas.map((r) => r.itemId));
  for (const c of modelo.categorias) {
    if (categoriaId && c.id !== categoriaId) continue;
    const item = c.itens.find((i) => !respondidos.has(i.id));
    if (item) return item;
  }
  return undefined;
}

/**
 * Primeiro item respondido sem a evidência que ele pede. A API recusa concluir
 * nesse caso, e a recusa só chegaria na sincronização, com a inspeção já fechada
 * no aparelho: por isso o app confere antes de concluir.
 */
export function pendenteDeEvidencia(modelo: ModeloChecklist, v: Inspecao) {
  const respostas = new Map(v.respostas.map((r) => [r.itemId, r]));
  for (const item of modelo.categorias.flatMap((c) => c.itens)) {
    const r = respostas.get(item.id);
    if (r && faltaEvidencia(item, r)) return item;
  }
  return undefined;
}

type SituacaoCategoria = 'pendente' | 'em_andamento' | 'ok' | 'atencao';
const situacaoDa = (p: ResumoCategoria): SituacaoCategoria =>
  p.naoConformes > 0 ? 'atencao' : p.respondidos === 0 ? 'pendente' : p.respondidos < p.total ? 'em_andamento' : 'ok';

/** Telas 5 (categorias) e 9 (progresso): a mesma lista, antes e durante a inspeção. */
export function TelaCategorias() {
  const { inspecaoId = '' } = useParams();
  const dados = useChecklistDaInspecao(inspecaoId);
  const situacao = useSituacaoSyncInspecao(inspecaoId)?.situacao;
  const { veiculo } = useDescricaoInspecao(dados.carregando ? undefined : dados.inspecao);
  const navegar = useNavigate();
  const [erro, setErro] = useState<string>();
  const [concluindo, setConcluindo] = useState(false);

  if (dados.carregando) return <Carregando />;
  const { inspecao, modelo, resultado } = dados;
  if (!inspecao) return <NaoEncontrada />;
  if (!modelo || !resultado) return <ChecklistIndisponivel />;
  const v = inspecao;
  if (v.status !== 'em_andamento') return <Navigate to={rotas.resultado(v.id)} replace />;

  const res = resultado;
  const iniciou = res.respondidos > 0;
  const completo = res.respondidos === res.total;

  const abrirCategoria = (categoriaId: string) => {
    const cat = modelo.categorias.find((c) => c.id === categoriaId);
    const alvo = proximoPendente(modelo, v, categoriaId) ?? cat?.itens[0];
    if (alvo) navegar(rotas.item(v.id, alvo.id));
  };

  const acaoPrincipal = async () => {
    setErro(undefined);
    if (!completo) {
      const alvo = proximoPendente(modelo, v);
      if (alvo) navegar(rotas.item(v.id, alvo.id));
      return;
    }
    if (concluindo) return;
    const semEvidencia = pendenteDeEvidencia(modelo, v);
    if (semEvidencia) {
      navegar(rotas.item(v.id, semEvidencia.id));
      return;
    }
    setConcluindo(true);
    try {
      // Sem navegar() aqui: ao gravar 'concluida' esta tela se redireciona sozinha
      // (Navigate acima). Navegar também depois do await levava o inspetor de volta
      // ao resultado se ele já tivesse avançado para outra tela.
      await repositorioInspecao.concluir(v.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir.');
      setConcluindo(false);
    }
  };

  return (
    <Moldura
      voltarPara="/"
      rodape={
        <>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button className="botao botao--primario" onClick={acaoPrincipal} disabled={concluindo}>
            {completo ? 'Concluir verificação' : iniciou ? 'Continuar verificação' : 'Iniciar verificação'}
          </button>
        </>
      }
    >
      <section className="cabecalho">
        <div className="cabecalho__linha">
          <div>
            <h1>Checklist - Veículo</h1>
            <p className="sub">
              {identificacaoVeiculo(veiculo)} - {nomeVeiculo(veiculo)}
              <SeloDemo veiculo={veiculo} />
            </p>
          </div>
          <span className="cabecalho__lado">
            <span className="contador">
              {res.respondidos} de {res.total}
            </span>
            <SeloSituacao situacao={situacao} />
          </span>
        </div>
        {iniciou && <BarraProgresso valor={res.respondidos} total={res.total} />}
      </section>

      <ul className="lista">
        {modelo.categorias.map((c) => (
          <LinhaCategoria
            key={c.id}
            nome={c.nome}
            icone={c.icone}
            progresso={res.porCategoria.find((p) => p.categoriaId === c.id)!}
            iniciou={iniciou}
            onClick={() => abrirCategoria(c.id)}
          />
        ))}
      </ul>
    </Moldura>
  );
}

function LinhaCategoria(props: {
  nome: string;
  icone?: string;
  progresso: ResumoCategoria;
  iniciou: boolean;
  onClick: () => void;
}) {
  const p = { ...props.progresso, situacao: situacaoDa(props.progresso) };
  return (
    <li>
      <button className="linha" onClick={props.onClick}>
        <span className={`linha__icone linha__icone--${props.icone ?? 'padrao'}`}>
          <Icone nome={props.icone} />
        </span>
        <span className="linha__texto">{props.nome}</span>
        {props.iniciou && <SituacaoCategoria situacao={p.situacao} />}
        <span className={`linha__contagem ${p.situacao === 'ok' ? 'ok' : p.situacao === 'atencao' ? 'atencao' : ''}`}>
          {p.respondidos}/{p.total}
        </span>
        {!props.iniciou && <Icone nome="seguir" tamanho={16} className="linha__seta" />}
      </button>
    </li>
  );
}

function SituacaoCategoria({ situacao }: { situacao: SituacaoCategoria }) {
  if (situacao === 'ok')
    return (
      <span className="selo selo--ok" aria-label="Categoria completa">
        <Icone nome="check" tamanho={14} />
      </span>
    );
  if (situacao === 'atencao')
    return (
      <span className="selo selo--atencao" aria-label="Há não conformidade">
        <Icone nome="alerta" tamanho={14} />
      </span>
    );
  return null;
}
