import { Pencil, Plus, X } from "lucide-react";
import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import { Aviso, Botao, Campo, Rotulo, Selecao } from "../componentes/ui";
import { enviar, textoErro, useRecurso } from "./api";

/**
 * Cadastro genérico do admin: lista + formulário (criar/editar/desativar).
 * Nada é apagado — "ativo"/"status" desliga o registro.
 */

export type Opcao = { valor: string; rotulo: string };

export type CampoForm<T> =
  | { tipo: "texto" | "numero"; nome: keyof T & string; rotulo: string; obrigatorio?: boolean; ajuda?: string; somenteNaCriacao?: boolean }
  | { tipo: "booleano"; nome: keyof T & string; rotulo: string }
  | { tipo: "selecao"; nome: keyof T & string; rotulo: string; opcoes: Opcao[]; vazio?: string; somenteNaCriacao?: boolean; obrigatorio?: boolean }
  | { tipo: "multipla"; nome: keyof T & string; rotulo: string; opcoes: Opcao[]; ajuda?: string }
  | { tipo: "lista"; nome: keyof T & string; rotulo: string; ajuda?: string }
  | { tipo: "custom"; nome: string; render: (valor: T, mudar: (parcial: Partial<T>) => void) => ReactNode };

export interface Coluna<T> {
  titulo: string;
  render: (v: T) => ReactNode;
}

export function Selo({ children, tom = "neutro" }: { children: ReactNode; tom?: "neutro" | "demo" | "ok" | "off" | "aviso" }) {
  const c = { neutro: "bg-fundo text-texto-suave", demo: "bg-destaque/25 text-texto", ok: "bg-ok/15 text-ok", off: "bg-neutro/20 text-texto-suave", aviso: "bg-atencao/20 text-texto" }[tom];
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}

export function MultiplaEscolha({ opcoes, valor, onChange, vazio = "Todos" }: { opcoes: Opcao[]; valor: string[]; onChange: (v: string[]) => void; vazio?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const marcado = valor.includes(o.valor);
        return (
          <button
            type="button"
            key={o.valor}
            aria-pressed={marcado}
            onClick={() => onChange(marcado ? valor.filter((x) => x !== o.valor) : [...valor, o.valor])}
            className={`min-h-11 rounded-full border px-3 text-sm ${marcado ? "border-marca bg-marca text-white" : "border-borda bg-superficie text-texto"}`}
          >
            {o.rotulo}
          </button>
        );
      })}
      {valor.length === 0 && <span className="self-center text-xs text-texto-suave">({vazio})</span>}
    </div>
  );
}

export function Cadastro<T extends { id: string }>({
  titulo, descricao, caminho, colunas, campos, novo, preparar, filtroAtivo,
}: {
  titulo: string;
  descricao?: string;
  caminho: string;
  colunas: Coluna<T>[];
  campos: CampoForm<T>[];
  novo: () => Omit<T, "id">;
  /** Ajusta o objeto antes de enviar (ex.: remover campos só de leitura). */
  preparar?: (v: Partial<T>, criando: boolean) => Record<string, unknown>;
  filtroAtivo?: (v: T) => boolean;
}) {
  const { dados, erro, recarregar } = useRecurso<T[]>(caminho);
  const [edicao, setEdicao] = useState<{ valor: Partial<T>; id: string | null } | null>(null);
  const [falha, setFalha] = useState<{ mensagem: string; erros: string[] } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [verInativos, setVerInativos] = useState(false);

  const lista = (dados ?? []).filter((v) => verInativos || !filtroAtivo || filtroAtivo(v));
  const mudar = (p: Partial<T>) => setEdicao((e) => (e ? { ...e, valor: { ...e.valor, ...p } } : e));

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!edicao) return;
    const faltando = campos.filter((c) => "obrigatorio" in c && c.obrigatorio && !(edicao.valor as Record<string, unknown>)[c.nome]).map((c) => ("rotulo" in c ? c.rotulo.replace(" *", "") : c.nome));
    if (faltando.length) return setFalha({ mensagem: `Preencha: ${faltando.join(", ")}.`, erros: [] });
    setSalvando(true);
    setFalha(null);
    try {
      const { id: _id, demo: _d, criadoEm: _c, atualizadoEm: _a, ...resto } = edicao.valor as Record<string, unknown>;
      const corpo = preparar ? preparar(resto as Partial<T>, !edicao.id) : resto;
      if (edicao.id) await enviar("PATCH", `${caminho}/${edicao.id}`, corpo);
      else await enviar("POST", caminho, corpo);
      setEdicao(null);
      await recarregar();
    } catch (e) {
      setFalha(textoErro(e));
    } finally {
      setSalvando(false);
    }
  }

  const botaoEditar = (v: T) => (
    <button aria-label="Editar" className="inline-flex size-11 shrink-0 items-center justify-center rounded text-marca hover:bg-marca-clara" onClick={() => (setFalha(null), setEdicao({ valor: { ...v }, id: v.id }))}>
      <Pencil size={16} />
    </button>
  );

  return (
    <section className="rounded-xl border border-borda bg-superficie p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold">{titulo}</h2>
          {descricao && <p className="text-sm text-texto-suave">{descricao}</p>}
        </div>
        {filtroAtivo && (
          <label className="flex items-center gap-2 text-sm text-texto-suave">
            <input type="checkbox" checked={verInativos} onChange={(e) => setVerInativos(e.target.checked)} /> Mostrar inativos
          </label>
        )}
        <Botao className="!h-11 !w-auto" onClick={() => (setFalha(null), setEdicao({ valor: novo() as Partial<T>, id: null }))}>
          <span className="inline-flex items-center gap-1"><Plus size={18} /> Novo</span>
        </Botao>
      </div>

      {erro && <div className="mt-3"><Aviso tom="erro">{erro}</Aviso></div>}

      {/* Celular: um cartão por cadastro, com todas as colunas visíveis sem rolar para o lado. */}
      <ul className="mt-3 divide-y divide-borda md:hidden">
        {lista.map((v) => (
          <li key={v.id} className={`flex items-start gap-2 py-3 ${filtroAtivo && !filtroAtivo(v) ? "opacity-50" : ""}`}>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold">{colunas[0]?.render(v)}</div>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {colunas.slice(1).map((c) => (
                  <Fragment key={c.titulo}>
                    <dt className="text-texto-suave">{c.titulo}</dt>
                    <dd className="min-w-0 break-words">{c.render(v)}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
            {botaoEditar(v)}
          </li>
        ))}
        {dados && lista.length === 0 && <li className="py-6 text-center text-sm text-texto-suave">Nenhum cadastro.</li>}
      </ul>

      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-borda text-texto-suave">
            <tr>
              {colunas.map((c) => <th key={c.titulo} className="px-2 py-2 font-medium">{c.titulo}</th>)}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {lista.map((v) => (
              <tr key={v.id} className={filtroAtivo && !filtroAtivo(v) ? "opacity-50" : ""}>
                {colunas.map((c) => <td key={c.titulo} className="px-2 py-2 align-top">{c.render(v)}</td>)}
                <td className="px-2 py-1 text-right">{botaoEditar(v)}</td>
              </tr>
            ))}
            {dados && lista.length === 0 && (
              <tr><td colSpan={colunas.length + 1} className="px-2 py-6 text-center text-texto-suave">Nenhum cadastro.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {edicao && (
        <div className="fixed inset-0 z-30 flex justify-end bg-black/30" onClick={() => setEdicao(null)}>
          <form
            onSubmit={salvar}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-lg flex-col bg-superficie shadow-xl"
            aria-label={`${edicao.id ? "Editar" : "Novo"} — ${titulo}`}
          >
            <div className="flex items-center border-b border-borda px-5 py-3">
              <h3 className="flex-1 text-lg font-bold">{edicao.id ? "Editar" : "Novo"} — {titulo}</h3>
              <button type="button" aria-label="Fechar" onClick={() => setEdicao(null)} className="flex size-11 items-center justify-center rounded hover:bg-fundo"><X size={20} /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {campos.map((c) => <CampoEdicao key={c.nome} campo={c} valor={edicao.valor as T} mudar={mudar} criando={!edicao.id} />)}
              {falha && (
                <Aviso tom="erro">
                  {falha.mensagem}
                  {falha.erros.length > 0 && <ul className="mt-1 list-disc pl-5">{falha.erros.map((e) => <li key={e}>{e}</li>)}</ul>}
                </Aviso>
              )}
            </div>
            <div className="border-t border-borda px-5 py-3">
              <Botao type="submit" carregando={salvando}>Salvar</Botao>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function CampoEdicao<T>({ campo: c, valor, mudar, criando }: { campo: CampoForm<T>; valor: T; mudar: (p: Partial<T>) => void; criando: boolean }) {
  if (c.tipo === "custom") return <>{c.render(valor, mudar)}</>;
  const atual = (valor as Record<string, unknown>)[c.nome];
  const set = (v: unknown) => mudar({ [c.nome]: v } as Partial<T>);
  const id = `campo-${c.nome}`;
  const bloqueado = "somenteNaCriacao" in c && c.somenteNaCriacao && !criando;
  switch (c.tipo) {
    case "booleano":
      return (
        <label className="flex items-center gap-3 text-sm font-medium">
          <input type="checkbox" className="size-5 accent-[var(--color-marca)]" checked={!!atual} onChange={(e) => set(e.target.checked)} /> {c.rotulo}
        </label>
      );
    case "selecao":
      return (
        <div>
          <Rotulo htmlFor={id}>{c.rotulo}{c.obrigatorio ? " *" : ""}</Rotulo>
          <Selecao id={id} value={(atual as string | null) ?? ""} disabled={bloqueado} onChange={(e) => set(e.target.value || null)}>
            <option value="">{c.vazio ?? "Selecione"}</option>
            {c.opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </Selecao>
        </div>
      );
    case "multipla":
      return (
        <div>
          <Rotulo>{c.rotulo}</Rotulo>
          <MultiplaEscolha opcoes={c.opcoes} valor={(atual as string[]) ?? []} onChange={set} />
          {c.ajuda && <p className="mt-1 text-xs text-texto-suave">{c.ajuda}</p>}
        </div>
      );
    case "lista":
      return (
        <div>
          <Rotulo htmlFor={id}>{c.rotulo}</Rotulo>
          <Campo id={id} value={((atual as string[]) ?? []).join("; ")} onChange={(e) => set(e.target.value.split(";").map((s) => s.trim()).filter(Boolean))} />
          <p className="mt-1 text-xs text-texto-suave">{c.ajuda ?? "Separe por ponto e vírgula."}</p>
        </div>
      );
    default:
      return (
        <div>
          <Rotulo htmlFor={id}>{c.rotulo}{c.obrigatorio ? " *" : ""}</Rotulo>
          <Campo
            id={id}
            type={c.tipo === "numero" ? "number" : "text"}
            disabled={bloqueado}
            value={atual === null || atual === undefined ? "" : String(atual)}
            onChange={(e) => set(c.tipo === "numero" ? Number(e.target.value) : e.target.value)}
            required={c.obrigatorio}
          />
          {c.ajuda && <p className="mt-1 text-xs text-texto-suave">{c.ajuda}</p>}
        </div>
      );
  }
}
