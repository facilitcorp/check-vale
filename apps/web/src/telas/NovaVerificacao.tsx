import { Building2, Info, MapPin, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Aviso, Botao, Cabecalho, Rotulo, Selecao, Tela } from "../componentes/ui";
import { useCatalogo } from "../dados/ganchos";

/** Tela 3 — onde o veículo será mobilizado (unidade, área, atividade). */
export function NovaVerificacao() {
  const navegar = useNavigate();
  const catalogo = useCatalogo();
  const [unidadeId, setUnidade] = useState("");
  const [areaId, setArea] = useState("");
  const [atividadeId, setAtividade] = useState("");

  const areas = catalogo?.areas.filter((a) => !a.unidadeId || a.unidadeId === unidadeId) ?? [];

  // Pré-seleciona quando só existe uma opção (caso comum no MVP).
  useEffect(() => {
    if (!catalogo) return;
    if (!unidadeId && catalogo.unidades.length === 1) setUnidade(catalogo.unidades[0]!.id);
    if (!atividadeId && catalogo.atividades.length === 1) setAtividade(catalogo.atividades[0]!.id);
  }, [catalogo, unidadeId, atividadeId]);
  useEffect(() => {
    if (areaId && !areas.some((a) => a.id === areaId)) setArea("");
  }, [areas, areaId]);

  const pronto = unidadeId && areaId && atividadeId;

  return (
    <>
      <Cabecalho voltar="/" />
      <Tela
        titulo="Nova verificação"
        subtitulo="Informe onde seu veículo será mobilizado."
        rodape={
          <Botao disabled={!pronto} onClick={() => navegar(`/nova/veiculo?${new URLSearchParams({ unidadeId, areaId, atividadeId })}`)}>
            Continuar
          </Botao>
        }
      >
        <div className="space-y-5">
          <div>
            <Rotulo htmlFor="unidade">Unidade / Complexo</Rotulo>
            <Selecao id="unidade" icone={<Building2 size={18} />} value={unidadeId} onChange={(e) => setUnidade(e.target.value)}>
              <option value="">Selecione</option>
              {catalogo?.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome} ({u.uf})</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="area">Área de atuação</Rotulo>
            <Selecao id="area" icone={<MapPin size={18} />} value={areaId} onChange={(e) => setArea(e.target.value)} disabled={!unidadeId}>
              <option value="">Selecione</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="atividade">Tipo de atividade</Rotulo>
            <Selecao id="atividade" icone={<Truck size={18} />} value={atividadeId} onChange={(e) => setAtividade(e.target.value)}>
              <option value="">Selecione</option>
              {catalogo?.atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Selecao>
          </div>
          <Aviso>
            <span className="flex gap-3"><Info size={20} className="mt-0.5 shrink-0 text-marca" /> As perguntas são ajustadas conforme o tipo de veículo e a área de operação.</span>
          </Aviso>
        </div>
      </Tela>
    </>
  );
}
