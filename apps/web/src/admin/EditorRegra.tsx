import { Plus, Trash2 } from "lucide-react";
import {
  especificidade,
  type Area,
  type Atividade,
  type CondicaoAtributo,
  type DefinicaoAtributo,
  type OperadorRegra,
  type RegraAplicabilidade,
  type TipoVeiculo,
} from "@checkvale/shared";
import { Campo, Selecao } from "../componentes/ui";
import { MultiplaEscolha } from "./Cadastro";

export interface Referencias {
  tipos: TipoVeiculo[];
  areas: Area[];
  atividades: Atividade[];
  atributos: DefinicaoAtributo[];
}

const OPERADORES: { valor: OperadorRegra; rotulo: string; tipos: DefinicaoAtributo["tipo"][] }[] = [
  { valor: "igual", rotulo: "é igual a", tipos: ["texto", "numero", "booleano", "lista"] },
  { valor: "diferente", rotulo: "é diferente de", tipos: ["texto", "numero", "booleano", "lista"] },
  { valor: "contem", rotulo: "contém", tipos: ["texto"] },
  { valor: "maior", rotulo: "é maior que", tipos: ["numero"] },
  { valor: "menor", rotulo: "é menor que", tipos: ["numero"] },
  { valor: "preenchido", rotulo: "está preenchido", tipos: ["texto", "numero", "booleano", "lista"] },
];

/** Resumo em português da regra (para mostrar fechado). */
export function descreverRegra(r: RegraAplicabilidade, refs: Referencias): string {
  if (especificidade(r) === 0) return "Sempre";
  const nomes = (ids: string[], lista: { id: string; nome: string }[]) => ids.map((id) => lista.find((x) => x.id === id)?.nome ?? "?").join(" ou ");
  const partes: string[] = [];
  if (r.tipoVeiculoIds.length) partes.push(`tipo: ${nomes(r.tipoVeiculoIds, refs.tipos)}`);
  if (r.areaIds.length) partes.push(`área: ${nomes(r.areaIds, refs.areas)}`);
  if (r.atividadeIds.length) partes.push(`atividade: ${nomes(r.atividadeIds, refs.atividades)}`);
  for (const c of r.atributos) {
    const d = refs.atributos.find((a) => a.codigo === c.atributo);
    const op = OPERADORES.find((o) => o.valor === c.operador)?.rotulo ?? c.operador;
    const valor = c.valor === true ? "sim" : c.valor === false ? "não" : c.valor;
    partes.push(`${d?.nome ?? c.atributo} ${op}${c.operador === "preenchido" ? "" : ` ${valor}`}`);
  }
  return `Só se ${partes.join(" e ")}`;
}

export function EditorRegra({ regra, onChange, refs, somenteLeitura }: { regra: RegraAplicabilidade; onChange: (r: RegraAplicabilidade) => void; refs: Referencias; somenteLeitura?: boolean }) {
  const set = (p: Partial<RegraAplicabilidade>) => onChange({ ...regra, ...p });
  const setCond = (i: number, p: Partial<CondicaoAtributo>) => set({ atributos: regra.atributos.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const ativos = refs.atributos.filter((a) => a.ativo);

  return (
    <fieldset disabled={somenteLeitura} className="space-y-3 rounded-lg border border-borda bg-fundo/60 p-3 text-sm">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-texto-suave">Quando aparece</legend>
      <div>
        <p className="mb-1 font-medium">Tipos de veículo</p>
        <MultiplaEscolha opcoes={refs.tipos.map((t) => ({ valor: t.id, rotulo: t.nome }))} valor={regra.tipoVeiculoIds} onChange={(v) => set({ tipoVeiculoIds: v })} />
      </div>
      <div>
        <p className="mb-1 font-medium">Áreas</p>
        <MultiplaEscolha opcoes={refs.areas.map((t) => ({ valor: t.id, rotulo: t.nome }))} valor={regra.areaIds} onChange={(v) => set({ areaIds: v })} vazio="Todas" />
      </div>
      <div>
        <p className="mb-1 font-medium">Atividades</p>
        <MultiplaEscolha opcoes={refs.atividades.map((t) => ({ valor: t.id, rotulo: t.nome }))} valor={regra.atividadeIds} onChange={(v) => set({ atividadeIds: v })} vazio="Todas" />
      </div>
      <div className="space-y-2">
        <p className="font-medium">Atributos do veículo (todas precisam valer)</p>
        {regra.atributos.map((c, i) => {
          const def = ativos.find((a) => a.codigo === c.atributo);
          const ops = OPERADORES.filter((o) => !def || o.tipos.includes(def.tipo));
          return (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
              <Selecao aria-label="Atributo" value={c.atributo} onChange={(e) => setCond(i, { atributo: e.target.value, valor: null })}>
                {!def && <option value={c.atributo}>{c.atributo} (inexistente)</option>}
                {ativos.map((a) => <option key={a.id} value={a.codigo}>{a.nome}</option>)}
              </Selecao>
              <Selecao aria-label="Condição" value={c.operador} onChange={(e) => setCond(i, { operador: e.target.value as OperadorRegra })}>
                {ops.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
              </Selecao>
              {c.operador === "preenchido" ? (
                <span />
              ) : def?.tipo === "lista" || def?.tipo === "booleano" ? (
                <Selecao aria-label="Valor" value={c.valor === null ? "" : String(c.valor)} onChange={(e) => setCond(i, { valor: def.tipo === "booleano" ? e.target.value === "true" : e.target.value })}>
                  <option value="">Valor…</option>
                  {def.tipo === "booleano" ? (<><option value="true">Sim</option><option value="false">Não</option></>) : def.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
                </Selecao>
              ) : (
                <Campo aria-label="Valor" value={c.valor === null ? "" : String(c.valor)} onChange={(e) => setCond(i, { valor: def?.tipo === "numero" && e.target.value !== "" ? Number(e.target.value) : e.target.value })} />
              )}
              <button type="button" aria-label="Remover condição" className="rounded p-2 text-erro hover:bg-erro/10" onClick={() => set({ atributos: regra.atributos.filter((_, j) => j !== i) })}>
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
        {ativos.length > 0 ? (
          <button type="button" className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-marca hover:bg-marca-clara" onClick={() => set({ atributos: [...regra.atributos, { atributo: ativos[0]!.codigo, operador: "igual", valor: null }] })}>
            <Plus size={16} /> Condição por atributo
          </button>
        ) : (
          <p className="text-xs text-texto-suave">Cadastre atributos técnicos em Frota para usar condições.</p>
        )}
      </div>
    </fieldset>
  );
}
