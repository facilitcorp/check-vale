import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { evidenciaDoItem, faltaEvidencia, type Inspecao, type ModeloChecklist, type StatusResposta } from '@checkvale/shared';
import { useChecklistDaInspecao } from '../../dados/ganchos';
import { repositorioInspecao } from '../../dados/repositorio';
import { Evidencias } from '../componentes/Evidencias';
import { Icone } from '../componentes/Icone';
import { Carregando, ChecklistIndisponivel, Moldura, NaoEncontrada } from '../componentes/Moldura';
import { avisarSalvo } from '../contexto';
import { rotas } from '../rotas';

/** O que a tela 6 passa para a 7/8 antes de gravar (a resposta NC só é salva lá). */
export interface EstadoRascunhoItem {
  observacao?: string;
  fotos?: string[];
}

export const respostaDe = (i: Inspecao, itemId: string) => i.respostas.find((r) => r.itemId === itemId);

const OPCOES: { status: StatusResposta; rotulo: string; icone: string }[] = [
  { status: 'conforme', rotulo: 'Conforme', icone: 'check' },
  { status: 'nao_conforme', rotulo: 'Não conforme', icone: 'x' },
  { status: 'nao_aplica', rotulo: 'Não se aplica', icone: 'menos' },
];

/** Tela 6: um item por vez. */
export function TelaItem() {
  const { inspecaoId = '', itemId = '' } = useParams();
  const dados = useChecklistDaInspecao(inspecaoId);
  if (dados.carregando) return <Carregando />;
  const { inspecao, modelo } = dados;
  if (!inspecao) return <NaoEncontrada />;
  if (!modelo) return <ChecklistIndisponivel />;
  if (inspecao.status !== 'em_andamento') return <Navigate to={rotas.resultado(inspecaoId)} replace />;
  // key: troca de item zera o formulário (e só monta com os dados já carregados)
  return <FormularioItem key={itemId} itemId={itemId} inspecao={inspecao} modelo={modelo} />;
}

function localizar(modelo: ModeloChecklist, itemId: string) {
  for (const categoria of modelo.categorias) {
    const indice = categoria.itens.findIndex((i) => i.id === itemId);
    const item = categoria.itens[indice];
    if (item) return { categoria, indice, item };
  }
  return undefined;
}

function FormularioItem(props: { itemId: string; inspecao: Inspecao; modelo: ModeloChecklist }) {
  const { inspecao: v, modelo, itemId } = props;
  const navegar = useNavigate();
  const anterior = respostaDe(v, itemId);
  const [status, setStatus] = useState<StatusResposta | undefined>(anterior?.status);
  const [observacao, setObservacao] = useState(anterior?.observacao ?? '');
  const [fotos, setFotos] = useState<string[]>(anterior?.evidenciaIds ?? []);
  // Resposta já gravada sem a evidência pedida (ex.: vinda de "Concluir"): avisa ao abrir.
  const [erro, setErro] = useState<string | undefined>(() => {
    const item = localizar(modelo, itemId)?.item;
    return item && anterior ? (faltaEvidencia(item, anterior) ?? undefined) : undefined;
  });
  const [salvando, setSalvando] = useState(false);

  const local = localizar(modelo, itemId);
  if (!local) return <Navigate to={rotas.categorias(v.id)} replace />;
  const { categoria, indice, item } = local;
  // NC já segue para a tela que exige foto; "não se aplica" nunca pede evidência.
  const evidencia = evidenciaDoItem(item);
  const pede = status === 'conforme' || status === undefined;
  const pedeObservacao = pede && evidencia === 'observacao';
  const pedeFoto = pede && evidencia === 'foto';
  const opcoes = OPCOES.filter((o) => o.status !== 'nao_aplica' || item.permiteNaoAplica);

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
      const rascunho: EstadoRascunhoItem = { observacao, fotos };
      navegar(rotas.naoConformidade(v.id, itemId), { state: rascunho });
      return;
    }
    const resposta = { itemId, status, observacao: observacao.trim() || null, naoConformidade: null, evidenciaIds: fotos };
    const falta = faltaEvidencia(item, resposta);
    if (falta) {
      setErro(falta);
      return;
    }
    setSalvando(true);
    try {
      await repositorioInspecao.salvarResposta(v.id, resposta);
      avisarSalvo();
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
        <span className="campo__rotulo">{pedeObservacao ? 'Observação (obrigatória neste item)' : 'Observações (opcional)'}</span>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Digite aqui..."
          rows={3}
        />
      </label>

      <span className="campo__rotulo">{pedeFoto ? 'Foto (obrigatória neste item)' : 'Adicionar evidência'}</span>
      <Evidencias inspecaoId={v.id} itemId={itemId} ids={fotos} onChange={setFotos} />
    </Moldura>
  );
}
