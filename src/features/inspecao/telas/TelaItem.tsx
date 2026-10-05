import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { ModeloChecklist, StatusItem, Verificacao } from '@/contracts/checklist';
import { Evidencias } from '../componentes/Evidencias';
import { Icone } from '../componentes/Icone';
import { Carregando, ChecklistIndisponivel, Moldura, NaoEncontrada } from '../componentes/Moldura';
import { useInspecao } from '../contexto';
import { useChecklistDaInspecao } from '../dados/ganchos';
import { rotas } from '../rotas';

export interface EstadoRascunhoItem {
  observacao?: string;
}

const OPCOES: { status: StatusItem; rotulo: string; icone: string }[] = [
  { status: 'conforme', rotulo: 'Conforme', icone: 'check' },
  { status: 'nao_conforme', rotulo: 'Não conforme', icone: 'x' },
  { status: 'nao_se_aplica', rotulo: 'Não se aplica', icone: 'menos' },
];

/** Tela 6: um item por vez. */
export function TelaItem() {
  const { verificacaoId = '', itemId = '' } = useParams();
  const { carregando, inspecao, modelo } = useChecklistDaInspecao(verificacaoId);
  if (carregando) return <Carregando />;
  if (!inspecao) return <NaoEncontrada />;
  if (!modelo) return <ChecklistIndisponivel />;
  if (inspecao.status === 'concluida') return <Navigate to={rotas.resultado(verificacaoId)} replace />;
  // key: troca de item zera o formulário (e só monta com os dados já carregados)
  return <FormularioItem key={itemId} itemId={itemId} verificacao={inspecao} modelo={modelo} />;
}

function localizar(modelo: ModeloChecklist, itemId: string) {
  for (const categoria of modelo.categorias) {
    const indice = categoria.itens.findIndex((i) => i.id === itemId);
    if (indice >= 0) return { categoria, indice, item: categoria.itens[indice] };
  }
  return undefined;
}

function FormularioItem(props: { itemId: string; verificacao: Verificacao; modelo: ModeloChecklist }) {
  const { verificacao: v, modelo, itemId } = props;
  const { repo } = useInspecao();
  const navegar = useNavigate();
  const anterior = v.respostas[itemId];
  const [status, setStatus] = useState<StatusItem | undefined>(anterior?.status);
  const [observacao, setObservacao] = useState(anterior?.observacao ?? '');
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);

  const local = localizar(modelo, itemId);
  if (!local) return <Navigate to={rotas.categorias(v.id)} replace />;
  const { categoria, indice, item } = local;
  const opcoes = OPCOES.filter((o) => o.status !== 'nao_se_aplica' || item.permiteNaoSeAplica);

  const proximo = categoria.itens[indice + 1];
  const destinoDepois = proximo ? rotas.item(v.id, proximo.id) : rotas.categorias(v.id);
  const anteriorNaCategoria = categoria.itens[indice - 1];
  const destinoVoltar = anteriorNaCategoria ? rotas.item(v.id, anteriorNaCategoria.id) : rotas.categorias(v.id);

  const avancar = async () => {
    setErro(undefined);
    if (!status) {
      setErro('Escolha uma opção para continuar.');
      return;
    }
    if (status === 'nao_conforme') {
      const rascunho: EstadoRascunhoItem = { observacao };
      navegar(rotas.naoConformidade(v.id, itemId), { state: rascunho });
      return;
    }
    setSalvando(true);
    try {
      await repo.responder(v.id, itemId, { status, observacao });
      navegar(destinoDepois);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Moldura
      voltarPara={rotas.categorias(v.id)}
      rodape={
        <>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <div className="rodape__dupla">
            <button className="botao botao--secundario" onClick={() => navegar(destinoVoltar)}>
              Voltar
            </button>
            <button className="botao botao--primario" onClick={avancar} disabled={salvando}>
              Avançar
            </button>
          </div>
        </>
      }
    >
      <div className="item__topo">
        <span className="item__categoria">
          <Icone nome={categoria.icone} tamanho={16} /> {categoria.nome}
        </span>
        <span className="contador">
          {indice + 1} de {categoria.itens.length}
        </span>
      </div>
      <h1 className="item__titulo">{item.titulo}</h1>
      {item.descricao && <p className="sub">{item.descricao}</p>}

      <div className="opcoes" role="radiogroup" aria-label="Situação do item">
        {opcoes.map((o) => (
          <button
            key={o.status}
            role="radio"
            aria-checked={status === o.status}
            className={`opcao opcao--${o.status} ${status === o.status ? 'opcao--ativa' : ''}`}
            onClick={() => setStatus(o.status)}
          >
            <span className="opcao__icone">
              <Icone nome={o.icone} tamanho={18} />
            </span>
            {o.rotulo}
          </button>
        ))}
      </div>

      <label className="campo">
        <span className="campo__rotulo">Observações (opcional)</span>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Digite aqui..."
          rows={3}
        />
      </label>

      <span className="campo__rotulo">Adicionar evidência</span>
      <Evidencias verificacaoId={v.id} itemId={itemId} />
    </Moldura>
  );
}
