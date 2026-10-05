import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { ModeloChecklist, Verificacao } from '@/contracts/checklist';
import {
  BarraProgresso,
  Carregando,
  ChecklistIndisponivel,
  Moldura,
  NaoEncontrada,
  nomeVeiculo,
  SeloDemo,
  SeloSituacao,
} from '../componentes/Moldura';
import { Icone } from '../componentes/Icone';
import { useInspecao, useSituacaoDaInspecao } from '../contexto';
import { useChecklistDaInspecao } from '../dados/ganchos';
import type { ProgressoCategoria } from '../dominio/resultado';
import { rotas } from '../rotas';

/** Primeiro item sem resposta (na ordem do checklist), opcionalmente dentro de uma categoria. */
export function proximoPendente(modelo: ModeloChecklist, v: Verificacao, categoriaId?: string) {
  for (const c of modelo.categorias) {
    if (categoriaId && c.id !== categoriaId) continue;
    const item = c.itens.find((i) => !v.respostas[i.id]);
    if (item) return item;
  }
  return undefined;
}

/** Telas 5 (categorias) e 9 (progresso): a mesma lista, antes e durante a inspeção. */
export function TelaCategorias() {
  const { verificacaoId = '' } = useParams();
  const { carregando, inspecao, modelo, resultado } = useChecklistDaInspecao(verificacaoId);
  const situacao = useSituacaoDaInspecao(inspecao);
  const { repo } = useInspecao();
  const navegar = useNavigate();
  const [erro, setErro] = useState<string>();
  const [concluindo, setConcluindo] = useState(false);

  if (carregando) return <Carregando />;
  if (!inspecao) return <NaoEncontrada />;
  if (!modelo || !resultado) return <ChecklistIndisponivel />;
  const v = inspecao;
  if (v.status === 'concluida') return <Navigate to={rotas.resultado(v.id)} replace />;

  const res = resultado;
  const iniciou = res.respondidos > 0;
  const completo = res.respondidos === res.total;

  const abrirCategoria = (categoriaId: string) => {
    const cat = modelo.categorias.find((c) => c.id === categoriaId)!;
    const alvo = proximoPendente(modelo, v, categoriaId) ?? cat.itens[0];
    navegar(rotas.item(v.id, alvo.id));
  };

  const acaoPrincipal = async () => {
    setErro(undefined);
    if (!completo) {
      const alvo = proximoPendente(modelo, v);
      if (alvo) navegar(rotas.item(v.id, alvo.id));
      return;
    }
    if (concluindo) return;
    setConcluindo(true);
    try {
      // Sem navegar() aqui: ao gravar 'concluida' esta tela se redireciona sozinha
      // (Navigate acima). Navegar também depois do await levava o inspetor de volta
      // ao resultado se ele já tivesse avançado para outra tela.
      await repo.concluir(v.id);
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
              {v.veiculo.placa} - {nomeVeiculo(v.veiculo)}
              <SeloDemo veiculo={v.veiculo} />
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
        {modelo.categorias.map((c, i) => (
          <LinhaCategoria
            key={c.id}
            nome={c.nome}
            icone={c.icone}
            progresso={res.categorias[i]}
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
  progresso: ProgressoCategoria;
  iniciou: boolean;
  onClick: () => void;
}) {
  const { progresso: p } = props;
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

function SituacaoCategoria({ situacao }: { situacao: ProgressoCategoria['situacao'] }) {
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
