import type { Atributos, DefinicaoAtributo, ValorAtributo } from "@checkvale/shared";
import { Campo, Rotulo, Selecao } from "./ui";

/** Atributos ativos que valem para o tipo de veículo. */
export const atributosDoTipo = (defs: readonly DefinicaoAtributo[], tipoVeiculoId: string) =>
  defs.filter((d) => d.ativo && (d.tipoVeiculoIds.length === 0 || d.tipoVeiculoIds.includes(tipoVeiculoId))).sort((a, b) => a.ordem - b.ordem);

/** Formulário gerado a partir das definições (nada de campo fixo por tipo de veículo). */
export function CamposAtributos({ defs, valores, onChange }: { defs: DefinicaoAtributo[]; valores: Atributos; onChange: (v: Atributos) => void }) {
  const definir = (codigo: string, v: ValorAtributo | null) => {
    const novo = { ...valores };
    if (v === null || v === "") delete novo[codigo];
    else novo[codigo] = v;
    onChange(novo);
  };
  return (
    <>
      {defs.map((d) => {
        const id = `atr-${d.codigo}`;
        const atual = valores[d.codigo];
        const rotulo = `${d.nome}${d.unidadeMedida ? ` (${d.unidadeMedida})` : ""}${d.obrigatorio ? " *" : ""}`;
        return (
          <div key={d.id}>
            <Rotulo htmlFor={id}>{rotulo}</Rotulo>
            {d.tipo === "lista" || d.tipo === "booleano" ? (
              <Selecao
                id={id}
                value={atual === undefined ? "" : String(atual)}
                onChange={(e) => definir(d.codigo, d.tipo === "booleano" ? (e.target.value === "" ? null : e.target.value === "true") : e.target.value || null)}
              >
                <option value="">Não informado</option>
                {d.tipo === "booleano" ? (
                  <>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </>
                ) : (
                  d.opcoes.map((o) => <option key={o} value={o}>{o}</option>)
                )}
              </Selecao>
            ) : (
              <Campo
                id={id}
                inputMode={d.tipo === "numero" ? "decimal" : undefined}
                value={atual === undefined ? "" : String(atual)}
                onChange={(e) => {
                  const t = e.target.value;
                  definir(d.codigo, d.tipo === "numero" ? (t.trim() === "" || Number.isNaN(Number(t.replace(",", "."))) ? (t.trim() === "" ? null : t) : Number(t.replace(",", "."))) : t);
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
