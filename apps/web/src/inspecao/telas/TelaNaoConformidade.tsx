import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Criticidade, type Inspecao, type ModeloChecklist } from '@checkvale/shared';
import { useChecklistDaInspecao } from '../../dados/ganchos';
import { repositorioInspecao } from '../../dados/repositorio';
import { Evidencias } from '../componentes/Evidencias';
import { Carregando, ChecklistIndisponivel, Moldura, NaoEncontrada } from '../componentes/Moldura';
import { avisarSalvo } from '../contexto';
import { rotas } from '../rotas';
import { respostaDe, type EstadoRascunhoItem } from './TelaItem';

/** Mais grave primeiro (mesma ordem do contrato). */
export const CRITICIDADES = Criticidade.options;

export const ROTULO_CRITICIDADE: Record<Criticidade, { nome: string; ajuda: string }> = {
  critica: { nome: 'Crítica', ajuda: 'Impede a operação' },
  alta: { nome: 'Alta', ajuda: 'Requer correção imediata' },
  media: { nome: 'Média', ajuda: 'Agendar correção' },
  baixa: { nome: 'Baixa', ajuda: 'Apenas observação' },
};

/** Telas 7 e 8: descrição, criticidade e foto obrigatória. */
export function TelaNaoConformidade() {
  const { inspecaoId = '', itemId = '' } = useParams();
  const dados = useChecklistDaInspecao(inspecaoId);
  if (dados.carregando) return <Carregando />;
  const { inspecao, modelo } = dados;
  if (!inspecao) return <NaoEncontrada />;
  if (!modelo) return <ChecklistIndisponivel />;
  if (inspecao.status !== 'em_andamento') return <Navigate to={rotas.resultado(inspecaoId)} replace />;
  // key: troca de item zera o formulário (e só monta com os dados já carregados)
  return <FormularioNaoConformidade key={itemId} itemId={itemId} inspecao={inspecao} modelo={modelo} />;
}

function FormularioNaoConformidade(props: { itemId: string; inspecao: Inspecao; modelo: ModeloChecklist }) {
  const { inspecao: v, modelo, itemId } = props;
  const navegar = useNavigate();
  const rascunho = (useLocation().state ?? {}) as EstadoRascunhoItem;

  const resposta = respostaDe(v, itemId);
  const anterior = resposta?.naoConformidade;
  const sugerida = modelo.categorias.flatMap((c) => c.itens).find((i) => i.id === itemId)?.criticidadeSugerida;
  const [descricao, setDescricao] = useState(anterior?.descricao ?? '');
  const [criticidade, setCriticidade] = useState<Criticidade | undefined>(anterior?.criticidade ?? sugerida ?? undefined);
  const [fotos, setFotos] = useState<string[]>(rascunho.fotos ?? resposta?.evidenciaIds ?? []);
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
    if (fotos.length === 0) return setErro('Tire ao menos uma foto do problema.');
    setSalvando(true);
    try {
      await repositorioInspecao.salvarResposta(v.id, {
        itemId,
        status: 'nao_conforme',
        observacao: (rascunho.observacao ?? resposta?.observacao ?? '').trim() || null,
        naoConformidade: { descricao: descricao.trim(), criticidade },
        evidenciaIds: fotos,
      });
      avisarSalvo();
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
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Lanterna traseira direita com defeito."
          rows={3}
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
      <Evidencias inspecaoId={v.id} itemId={itemId} ids={fotos} onChange={setFotos} />
    </Moldura>
  );
}
