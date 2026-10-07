import {
  Building2, ChevronDown, ChevronRight, ClipboardList, Factory, Flame, LibraryBig, Pencil, Pickaxe, Plus, Recycle, Settings2, Ship, Bus, Tractor, Truck, Zap,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  pode, SELO_ORIGEM,
  type AdotarModelo, type Criticidade, type ModeloBiblioteca, type OrigemBiblioteca, type ResultadoAdocao, type ResumoModeloBiblioteca,
  type Setor, type SetorComContagem,
} from "@checkvale/shared";
import { Aviso, Botao } from "../componentes/ui";
import { useSessao } from "../dados/sessao";
import { enviar, textoErro, useRecurso } from "./api";
import { Cadastro, Selo } from "./Cadastro";
import type { EstadoEditor } from "./PaginaModelos";

/**
 * Biblioteca de checklists por setor (docs/BIBLIOTECA.md):
 * setor → modelo → prévia → usar | personalizar | criar do zero.
 * Nada aqui conhece nomes ou quantidade de setores: tudo vem da API.
 */

/**
 * Ícone do setor é uma chave (Setor.icone). Chave desconhecida vira a prancheta,
 * então setor novo nunca quebra a tela.
 */
const ICONES_SETOR = ["geral", "picareta", "raio", "caminhao", "predio", "chama", "trator", "navio", "onibus", "fabrica", "reciclagem"] as const;
type IconeSetor = (typeof ICONES_SETOR)[number];
type ModoAdocao = AdotarModelo["modo"];

const ICONE: Record<IconeSetor, LucideIcon> = {
  geral: ClipboardList, picareta: Pickaxe, raio: Zap, caminhao: Truck, predio: Building2, chama: Flame,
  trator: Tractor, navio: Ship, onibus: Bus, fabrica: Factory, reciclagem: Recycle,
};
const iconeSetor = (chave: string) => ICONE[chave as IconeSetor] ?? ICONE.geral;

/** O que o selo quer dizer (o rótulo vem de SELO_ORIGEM, compartilhado). */
const EXPLICACAO_ORIGEM: Record<OrigemBiblioteca, string> = {
  base_checkvale: "Ponto de partida genérico. Não representa exigência de empresa, contrato ou legislação.",
  referencia: "Baseado na fonte indicada. Confira com os requisitos da sua operação antes de usar.",
};

export function SeloOrigem({ origem }: { origem: OrigemBiblioteca }) {
  return <span title={EXPLICACAO_ORIGEM[origem]}><Selo tom={origem === "base_checkvale" ? "neutro" : "aviso"}>{SELO_ORIGEM[origem]}</Selo></span>;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function CriarDoZero() {
  return (
    <Link to="/admin/modelos" className="flex min-h-11 items-center gap-1.5 rounded-lg border border-marca px-3 text-sm font-semibold text-marca hover:bg-marca-clara">
      <Plus size={16} /> Criar do zero
    </Link>
  );
}

export function PaginaBiblioteca() {
  const { usuario } = useSessao();
  const { dados, erro } = useRecurso<SetorComContagem[]>("/biblioteca/setores");
  const setores = [...(dados ?? [])].sort((a, b) => a.ordem - b.ordem);
  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start gap-3 rounded-xl border border-borda bg-superficie p-4">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-bold"><LibraryBig size={20} className="text-marca" /> Biblioteca de checklists</h2>
          <p className="text-sm text-texto-suave">Escolha o setor e comece de um modelo pronto. Você pode usar como está, personalizar para a sua empresa ou criar do zero.</p>
        </div>
        <div className="flex gap-2">
          {usuario && pode(usuario.papel, "biblioteca:editar") && (
            <Link to="/admin/setores" className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-texto-suave hover:bg-fundo"><Settings2 size={16} /> Setores</Link>
          )}
          <CriarDoZero />
        </div>
      </section>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {setores.map((s) => {
          const Icone = iconeSetor(s.icone);
          return (
            <li key={s.id}>
              <Link to={`/admin/biblioteca/${s.id}`} className="flex h-full min-h-24 items-start gap-3 rounded-xl border border-borda bg-superficie p-4 hover:border-marca">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-marca-clara text-marca"><Icone size={22} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.nome}</span>
                  {s.descricao && <span className="mt-0.5 block text-sm text-texto-suave">{s.descricao}</span>}
                  <span className="mt-1 block text-xs text-texto-suave">{s.totalModelos ? plural(s.totalModelos, "modelo", "modelos") : "Nenhum modelo ainda"}</span>
                </span>
                <ChevronRight size={16} className="mt-1 text-texto-suave" />
              </Link>
            </li>
          );
        })}
      </ul>
      {dados && setores.length === 0 && <p className="py-6 text-center text-sm text-texto-suave">Nenhum setor ativo na biblioteca.</p>}
    </div>
  );
}

export function PaginaSetorBiblioteca() {
  const { setorId } = useParams();
  const setor = useRecurso<SetorComContagem[]>("/biblioteca/setores").dados?.find((s) => s.id === setorId);
  const { dados, erro } = useRecurso<ResumoModeloBiblioteca[]>(`/biblioteca/modelos?setorId=${encodeURIComponent(setorId ?? "")}`);
  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start gap-3 rounded-xl border border-borda bg-superficie p-4">
        <div className="min-w-0 flex-1">
          <Link to="/admin/biblioteca" className="text-sm text-marca">Biblioteca</Link>
          <h2 className="text-lg font-bold">{setor?.nome ?? "Setor"}</h2>
          {setor?.descricao && <p className="text-sm text-texto-suave">{setor.descricao}</p>}
        </div>
        <CriarDoZero />
      </section>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <ul className="space-y-3">
        {dados?.map((m) => (
          <li key={m.id}>
            <Link to={`/admin/biblioteca/modelo/${m.id}`} className="flex items-start gap-3 rounded-xl border border-borda bg-superficie p-4 hover:border-marca">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">{m.nome} <SeloOrigem origem={m.origem} /></span>
                {m.resumo && <span className="mt-1 block text-sm text-texto-suave">{m.resumo}</span>}
                <span className="mt-1 block text-xs text-texto-suave">{plural(m.totalCategorias, "categoria", "categorias")} · {plural(m.totalItens, "item", "itens")}</span>
              </span>
              <ChevronRight size={16} className="mt-1 text-texto-suave" />
            </Link>
          </li>
        ))}
      </ul>
      {dados && dados.length === 0 && (
        <p className="py-6 text-center text-sm text-texto-suave">Este setor ainda não tem modelos. Você pode criar o seu do zero.</p>
      )}
    </div>
  );
}

const CRITICIDADE: Record<Criticidade, string> = { critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa" };

export function PaginaModeloBiblioteca() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { usuario } = useSessao();
  const { dados: m, erro } = useRecurso<ModeloBiblioteca>(`/biblioteca/modelos/${id}`);
  const [aberta, setAberta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<ModoAdocao | null>(null);
  const [falha, setFalha] = useState<{ mensagem: string; erros: string[] } | null>(null);

  if (!m) return <p className="text-texto-suave">{erro ?? "Carregando…"}</p>;
  const podeEditar = !!usuario && pode(usuario.papel, "config:editar");
  const podePublicar = !!usuario && pode(usuario.papel, "modelo:publicar");
  const itens = m.categorias.reduce((n, c) => n + c.itens.length, 0);
  const categorias = [...m.categorias].sort((a, b) => a.ordem - b.ordem);

  async function adotar(modo: ModoAdocao) {
    setOcupado(modo);
    setFalha(null);
    try {
      const r = await enviar<ResultadoAdocao>("POST", `/biblioteca/modelos/${m!.id}/adotar`, { modo });
      // Com conflito, "usar" volta como rascunho: o editor explica e pede a aplicabilidade.
      navegar(`/admin/modelos/${r.modeloId}/v/${r.versao}`, { state: { conflitos: r.conflitos } satisfies EstadoEditor });
    } catch (e) {
      setFalha(textoErro(e));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-borda bg-superficie p-4">
        <Link to="/admin/biblioteca" className="text-sm text-marca">Biblioteca</Link>
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">{m.nome} <SeloOrigem origem={m.origem} /></h2>
        {m.resumo && <p className="mt-1 text-sm text-texto-suave">{m.resumo}</p>}
        <p className="mt-2 text-xs text-texto-suave">
          {EXPLICACAO_ORIGEM[m.origem]}
          {m.fonte && <> Fonte: {m.fonte}.</>}
        </p>
        <p className="mt-2 text-sm">{plural(categorias.length, "categoria", "categorias")} · {plural(itens, "item", "itens")} a verificar</p>
      </section>

      <section className="rounded-xl border border-borda bg-superficie p-4">
        <h3 className="font-bold">O que será verificado</h3>
        <ul className="mt-2 divide-y divide-borda">
          {categorias.map((c) => {
            const expandida = aberta === c.id;
            return (
              <li key={c.id}>
                <button aria-expanded={expandida} onClick={() => setAberta(expandida ? null : c.id)} className="flex min-h-11 w-full items-center gap-2 py-2 text-left">
                  {expandida ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="flex-1 font-medium">{c.nome}</span>
                  <span className="text-xs text-texto-suave">{plural(c.itens.length, "item", "itens")}</span>
                </button>
                {expandida && (
                  <ol className="mb-2 ml-6 space-y-1.5">
                    {[...c.itens].sort((a, b) => a.ordem - b.ordem).map((i) => (
                      <li key={i.id} className="text-sm">
                        <span>{i.titulo}</span>
                        {i.criticidadeSugerida && <span className="ml-2 text-xs text-texto-suave">({CRITICIDADE[i.criticidadeSugerida]})</span>}
                        {i.descricao && <span className="block text-xs text-texto-suave">{i.descricao}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {falha && (
        <Aviso tom="erro">
          {falha.mensagem}
          {falha.erros.length > 0 && <ul className="mt-1 list-disc pl-5">{falha.erros.map((e) => <li key={e}>{e}</li>)}</ul>}
        </Aviso>
      )}

      {podeEditar ? (
        <section className="grid gap-2 sm:grid-cols-3">
          <Botao disabled={!podePublicar || !!ocupado} carregando={ocupado === "usar"} onClick={() => void adotar("usar")}
            title={podePublicar ? "Copia para a sua empresa e publica, se nenhum checklist publicado já valer para os mesmos veículos" : "Seu perfil não publica checklists"}>
            Usar modelo
          </Botao>
          <Botao variante="secundario" disabled={!!ocupado} carregando={ocupado === "personalizar"} onClick={() => void adotar("personalizar")}>
            <span className="inline-flex items-center gap-1.5"><Pencil size={16} /> Personalizar</span>
          </Botao>
          <Link to="/admin/modelos" className="flex h-12 items-center justify-center rounded-lg px-4 font-semibold text-marca hover:bg-marca-clara">Criar do zero</Link>
        </section>
      ) : (
        <Aviso>Seu perfil pode consultar a biblioteca, mas não adotar modelos.</Aviso>
      )}
      <p className="text-xs text-texto-suave">"Usar modelo" cria uma cópia publicada na sua empresa; se outro checklist publicado já valer para os mesmos veículos, a cópia fica como rascunho para você definir onde ela vale, e o atual continua funcionando. "Personalizar" cria um rascunho para você ajustar antes de publicar. Mudanças futuras na biblioteca não alteram as suas cópias.</p>
    </div>
  );
}

const ROTULO_ICONE: Record<IconeSetor, string> = {
  geral: "Prancheta", picareta: "Picareta", raio: "Raio", caminhao: "Caminhão", predio: "Prédio", chama: "Chama",
  trator: "Trator", navio: "Navio", onibus: "Ônibus", fabrica: "Fábrica", reciclagem: "Reciclagem",
};
const OPCOES_ICONE = ICONES_SETOR.map((i) => ({ valor: i, rotulo: ROTULO_ICONE[i] }));

/** Cadastro de setores (permissão biblioteca:editar). Ícone é uma chave; a tela desenha. */
export function PaginaSetores() {
  const { usuario } = useSessao();
  if (!usuario || !pode(usuario.papel, "biblioteca:editar")) return <Aviso tom="erro">Seu perfil não pode cadastrar setores.</Aviso>;
  return (
    <div className="space-y-4">
      <Link to="/admin/biblioteca" className="text-sm text-marca">Biblioteca</Link>
      <Cadastro<Setor>
        titulo="Setores da biblioteca"
        descricao="Setor inativo some da biblioteca, mas os checklists que as empresas já adotaram continuam iguais."
        caminho="/admin/setores"
        filtroAtivo={(v) => v.ativo}
        novo={() => ({ nome: "", descricao: "", icone: "geral", ordem: 0, ativo: true })}
        colunas={[
          { titulo: "Setor", render: (v) => { const I = iconeSetor(v.icone); return <span className="inline-flex items-center gap-2"><I size={16} className="text-marca" /> {v.nome}</span>; } },
          { titulo: "Ordem", render: (v) => v.ordem },
          { titulo: "Status", render: (v) => (v.ativo ? <Selo tom="ok">Ativo</Selo> : <Selo tom="off">Inativo</Selo>) },
        ]}
        campos={[
          { tipo: "texto", nome: "nome", rotulo: "Nome", obrigatorio: true },
          { tipo: "texto", nome: "descricao", rotulo: "Descrição" },
          { tipo: "selecao", nome: "icone", rotulo: "Ícone", opcoes: OPCOES_ICONE, obrigatorio: true },
          { tipo: "numero", nome: "ordem", rotulo: "Ordem", ajuda: "Menor aparece primeiro." },
          { tipo: "booleano", nome: "ativo", rotulo: "Ativo" },
        ]}
      />
    </div>
  );
}
