import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CRITICIDADES, type Criticidade, type ModeloChecklist, type Verificacao } from '@/contracts/checklist';
import { Evidencias } from '../componentes/Evidencias';
import { Carregando, ChecklistIndisponivel, Moldura, NaoEncontrada } from '../componentes/Moldura';
import { useInspecao, useVerificacao } from '../contexto';
import { rotas } from '../rotas';
import type { EstadoRascunhoItem } from './TelaItem';

export const ROTULO_CRITICIDADE: Record<Criticidade, { nome: string; ajuda: string }> = {
  critica: { nome: 'Crítica', ajuda: 'Impede a operação' },
  alta: { nome: 'Alta', ajuda: 'Requer correção imediata' },
  media: { nome: 'Média', ajuda: 'Agendar correção' },
  baixa: { nome: 'Baixa', ajuda: 'Apenas observação' },
};

/** Telas 7 e 8: descrição, criticidade e foto obrigatória. */
export function TelaNaoConformidade() {
  const { verificacaoId = '', itemId = '' } = useParams();
  const dados = useVerificacao(verificacaoId);
  if (dados === undefined) return <Carregando />;
  if (dados === null) return <NaoEncontrada />;
  if (!dados.modelo) return <ChecklistIndisponivel />;
  if (dados.verificacao.status === 'concluida') return <Navigate to={rotas.resultado(verificacaoId)} replace />;
  // só monta o formulário com os dados já carregados, para preencher a edição
  return (
    <FormularioNaoConformidade key={itemId} itemId={itemId} verificacao={dados.verificacao} modelo={dados.modelo} />
  );
}

function FormularioNaoConformidade(props: { itemId: string; verificacao: Verificacao; modelo: ModeloChecklist }) {
  const { verificacao: v, modelo, itemId } = props;
  const { repo } = useInspecao();
  const navegar = useNavigate();
  const rascunho = (useLocation().state ?? {}) as EstadoRascunhoItem;

  const anterior = v.respostas[itemId]?.naoConformidade;
  const [descricao, setDescricao] = useState(anterior?.descricao ?? '');
  const [criticidade, setCriticidade] = useState<Criticidade | undefined>(anterior?.criticidade);
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);

  const categoria = modelo.categorias.find((c) => c.itens.some((i) => i.id === itemId));
  if (!categoria) return <Navigate to={rotas.categorias(v.id)} replace />;
  const indice = categoria.itens.findIndex((i) => i.id === itemId);
  const proximo = categoria.itens[indice + 1];

  const salvar = async () => {
    setErro(undefined);
    if (!descricao.trim()) return setErro('Descreva o problema encontrado.');
    if (!criticidade) return setErro('Escolha o tipo de criticidade.');
    setSalvando(true);
    try {
      await repo.responder(v.id, itemId, {
        status: 'nao_conforme',
        observacao: rascunho.observacao ?? v.respostas[itemId]?.observacao,
        naoConformidade: { descricao: descricao.trim(), criticidade },
      });
      navegar(proximo ? rotas.item(v.id, proximo.id) : rotas.categorias(v.id), { replace: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Moldura
      rodape={
        <>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <div className="rodape__dupla">
            <button className="botao botao--secundario" onClick={() => navegar(rotas.item(v.id, itemId))}>
              Cancelar
            </button>
            <button className="botao botao--primario" onClick={salvar} disabled={salvando}>
              Salvar
            </button>
          </div>
        </>
      }
    >
      <h1>Registrar não conformidade</h1>
      <p className="sub">Descreva o problema encontrado.</p>

      <label className="campo">
        <span className="campo__rotulo">Descrição da não conformidade *</span>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Lanterna traseira direita com defeito."
        />
      </label>

      <fieldset className="criticidades">
        <legend className="campo__rotulo">Tipo de criticidade</legend>
        {CRITICIDADES.map((c) => (
          <label key={c} className={`criticidade criticidade--${c} ${criticidade === c ? 'criticidade--ativa' : ''}`}>
            <input type="radio" name="criticidade" value={c} checked={criticidade === c} onChange={() => setCriticidade(c)} />
            <span className="criticidade__marca" />
            <span>
              <strong>{ROTULO_CRITICIDADE[c].nome}</strong>
              <small>{ROTULO_CRITICIDADE[c].ajuda}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <span className="campo__rotulo">Fotos (obrigatório)</span>
      <p className="dica">Fotografe o defeito ou a condição encontrada no veículo.</p>
      <Evidencias verificacaoId={v.id} itemId={itemId} />
    </Moldura>
  );
}
