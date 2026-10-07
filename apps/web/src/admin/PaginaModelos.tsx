import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  SEM_RESTRICAO,
  type Area,
  type Atividade,
  type CategoriaChecklist,
  type Criticidade,
  type DefinicaoAtributo,
  type ItemChecklist,
  type ModeloChecklist,
  type ModeloResumo,
  type ResultadoAdocao,
  type TipoVeiculo,
  type Veiculo,
  type VersaoModelo,
} from "@checkvale/shared";
import { Aviso, Botao, Campo, Rotulo, Selecao } from "../componentes/ui";
import { useSessao } from "../dados/sessao";
import { pode } from "@checkvale/shared";
import { enviar, textoErro, useRecurso } from "./api";
import { Selo } from "./Cadastro";
import { descreverRegra, EditorRegra, type Referencias } from "./EditorRegra";

const STATUS: Record<VersaoModelo["status"], { rotulo: string; tom: "aviso" | "ok" | "off" }> = {
  rascunho: { rotulo: "Rascunho", tom: "aviso" },
  publicada: { rotulo: "Publicada", tom: "ok" },
  arquivada: { rotulo: "Arquivada", tom: "off" },
};

export function PaginaModelos() {
  const navegar = useNavigate();
  const { dados, erro } = useRecurso<ModeloResumo[]>("/admin/modelos");
  const [nome, setNome] = useState("");
  const [falha, setFalha] = useState<string | null>(null);

  async function criar() {
    try {
      const v = await enviar<VersaoModelo>("POST", "/admin/modelos", { nome });
      navegar(`/admin/modelos/${v.id}/v/${v.versao}`);
    } catch (e) {
      setFalha(textoErro(e).mensagem);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-borda bg-superficie p-4">
        <h2 className="text-lg font-bold">Modelos de checklist</h2>
        <p className="text-sm text-texto-suave">O inspetor só recebe versões publicadas. Versão publicada não muda: para alterar, abra um novo rascunho.</p>
        <div className="mt-3 flex gap-2">
          <Campo placeholder="Nome do novo modelo" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Botao className="!w-auto" disabled={!nome.trim()} onClick={() => void criar()}>Criar</Botao>
        </div>
        {(erro || falha) && <div className="mt-3"><Aviso tom="erro">{erro ?? falha}</Aviso></div>}
      </section>
      {dados?.map((m) => (
        <section key={m.id} className="rounded-xl border border-borda bg-superficie p-4">
          <h3 className="font-bold">{m.nome} {m.demo && <Selo tom="demo">DEMO</Selo>}</h3>
          <ul className="mt-2 divide-y divide-borda">
            {m.versoes.map((v) => (
              <li key={v.versao}>
                <Link to={`/admin/modelos/${m.id}/v/${v.versao}`} className="flex min-h-11 items-center gap-3 py-2 hover:bg-fundo">
                  <span className="w-12 font-mono text-sm">v{v.versao}</span>
                  <Selo tom={STATUS[v.status].tom}>{STATUS[v.status].rotulo}</Selo>
                  <span className="flex-1 text-sm text-texto-suave">{v.itens} itens{v.publicadaEm ? ` · publicada em ${new Date(v.publicadaEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}</span>
                  <ChevronRight size={16} className="text-texto-suave" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const CRITICIDADES: { valor: Criticidade; rotulo: string }[] = [
  { valor: "critica", rotulo: "Crítica" }, { valor: "alta", rotulo: "Alta" }, { valor: "media", rotulo: "Média" }, { valor: "baixa", rotulo: "Baixa" },
];
const ICONES = ["id-card", "car", "engine", "brake", "tire", "light", "shield", "satellite", "hard-hat", "document"];

const slug = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

function mover<T extends { ordem: number }>(lista: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= lista.length) return lista;
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j]!, nova[i]!];
  return nova.map((x, k) => ({ ...x, ordem: k + 1 }));
}

/** Estado de navegação para o editor: quem chega da biblioteca com conflito de aplicabilidade. */
export type EstadoEditor = { conflitos?: ResultadoAdocao["conflitos"] };

export function EditorVersao() {
  const { id, v } = useParams();
  const navegar = useNavigate();
  const conflitos = (useLocation().state as EstadoEditor | null)?.conflitos ?? [];
  const { usuario } = useSessao();
  const versao = useRecurso<VersaoModelo>(`/admin/modelos/${id}/versoes/${v}`);
  const refs: Referencias = {
    tipos: useRecurso<TipoVeiculo[]>("/admin/tipos-veiculo").dados?.filter((x) => x.ativo) ?? [],
    areas: useRecurso<Area[]>("/admin/areas").dados?.filter((x) => x.ativo) ?? [],
    atividades: useRecurso<Atividade[]>("/admin/atividades").dados?.filter((x) => x.ativo) ?? [],
    atributos: useRecurso<DefinicaoAtributo[]>("/admin/atributos").dados ?? [],
  };
  const [modelo, setModelo] = useState<ModeloChecklist | null>(null);
  const [alterado, setAlterado] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tom: "info" | "erro"; texto: string; erros?: string[] } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (versao.dados) setModelo(versao.dados), setAlterado(false);
  }, [versao.dados]);

  const rascunho = versao.dados?.status === "rascunho";
  const totalItens = useMemo(() => modelo?.categorias.reduce((n, c) => n + c.itens.length, 0) ?? 0, [modelo]);
  if (!modelo || !versao.dados) return <p className="text-texto-suave">{versao.erro ?? "Carregando…"}</p>;

  const mudar = (m: ModeloChecklist) => (setModelo(m), setAlterado(true));
  const mudarCat = (cid: string, p: Partial<CategoriaChecklist>) => mudar({ ...modelo, categorias: modelo.categorias.map((c) => (c.id === cid ? { ...c, ...p } : c)) });
  const mudarItem = (cid: string, iid: string, p: Partial<ItemChecklist>) => {
    const cat = modelo.categorias.find((c) => c.id === cid)!;
    mudarCat(cid, { itens: cat.itens.map((i) => (i.id === iid ? { ...i, ...p } : i)) });
  };

  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    setAviso(null);
    try {
      await acao();
    } catch (e) {
      const t = textoErro(e);
      setAviso({ tom: "erro", texto: t.mensagem, erros: t.erros });
    } finally {
      setOcupado(false);
    }
  }
  const salvar = () =>
    executar(async () => {
      const r = await enviar<VersaoModelo>("PUT", `/admin/modelos/${id}/versoes/${v}`, { nome: modelo.nome, aplicavel: modelo.aplicavel, categorias: modelo.categorias });
      versao.setDados(r);
      setAviso({ tom: "info", texto: "Rascunho salvo." });
    });
  const publicar = () =>
    executar(async () => {
      if (alterado) await enviar("PUT", `/admin/modelos/${id}/versoes/${v}`, { nome: modelo.nome, aplicavel: modelo.aplicavel, categorias: modelo.categorias });
      const r = await enviar<VersaoModelo>("POST", `/admin/modelos/${id}/versoes/${v}/publicar`);
      versao.setDados(r);
      setAviso({ tom: "info", texto: `Versão ${r.versao} publicada. Os inspetores recebem na próxima sincronização.` });
    });
  const novoRascunho = () =>
    executar(async () => {
      const r = await enviar<VersaoModelo>("POST", `/admin/modelos/${id}/rascunho`);
      navegar(`/admin/modelos/${id}/v/${r.versao}`);
    });

  const novaCategoria = () => {
    const c: CategoriaChecklist = { id: crypto.randomUUID(), codigo: `categoria_${modelo.categorias.length + 1}`, nome: "Nova categoria", icone: "car", ordem: modelo.categorias.length + 1, aplicavel: SEM_RESTRICAO, itens: [] };
    mudar({ ...modelo, categorias: [...modelo.categorias, c] });
    setAberto(c.id);
  };
  const novoItem = (cat: CategoriaChecklist) => {
    const i: ItemChecklist = { id: crypto.randomUUID(), codigo: `${cat.codigo}.${cat.itens.length + 1}`, titulo: "Novo item", descricao: "", ordem: cat.itens.length + 1, permiteNaoAplica: true, criticidadeSugerida: null, aplicavel: SEM_RESTRICAO };
    mudarCat(cat.id, { itens: [...cat.itens, i] });
    setAberto(i.id);
  };

  const categorias = [...modelo.categorias].sort((a, b) => a.ordem - b.ordem);
  const ro = !rascunho;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/admin/modelos" className="text-sm text-marca hover:underline">← Modelos</Link>
        <h2 className="text-lg font-bold">{modelo.nome}</h2>
        <span className="font-mono text-sm">v{modelo.versao}</span>
        <Selo tom={STATUS[versao.dados.status].tom}>{STATUS[versao.dados.status].rotulo}</Selo>
        <span className="text-sm text-texto-suave">{categorias.length} categorias · {totalItens} itens</span>
      </div>

      {ro && (
        <Aviso>
          Versão {versao.dados.status}: somente leitura. Inspeções feitas nela continuam ligadas a ela.
          {pode(usuario?.papel ?? "inspetor", "config:editar") && (
            <button className="ml-2 font-semibold text-marca underline" onClick={() => void novoRascunho()}>Criar nova versão a partir desta</button>
          )}
        </Aviso>
      )}

      {rascunho && conflitos.length > 0 && (
        <Aviso>
          <strong>Já existe checklist publicado para este mesmo escopo:</strong> {conflitos.map((c) => `"${c.nome}"`).join(", ")}.
          {" "}Por isso este modelo entrou como rascunho. Defina abaixo onde ele vale (tipo de veículo, área, atividade ou atributo) para que só um checklist sirva a cada veículo.
          {" "}O checklist atual continua funcionando normalmente até este ser publicado.
        </Aviso>
      )}

      <section className="space-y-3 rounded-xl border border-borda bg-superficie p-4">
        <div>
          <Rotulo htmlFor="nome-modelo">Nome do modelo</Rotulo>
          <Campo id="nome-modelo" value={modelo.nome} disabled={ro} onChange={(e) => mudar({ ...modelo, nome: e.target.value })} />
        </div>
        <p className="text-sm text-texto-suave">Este modelo serve para: <strong>{descreverRegra(modelo.aplicavel, refs).replace("Só se", "").replace("Sempre", "qualquer veículo e operação")}</strong></p>
        <EditorRegra regra={modelo.aplicavel} onChange={(r) => mudar({ ...modelo, aplicavel: r })} refs={refs} somenteLeitura={ro} />
      </section>

      {categorias.map((cat, ci) => (
        <section key={cat.id} className="rounded-xl border border-borda bg-superficie">
          <div className="flex items-center gap-2 px-3 py-2">
            <button aria-expanded={aberto === cat.id} aria-label="Abrir categoria" className="rounded p-2 hover:bg-fundo" onClick={() => setAberto(aberto === cat.id ? null : cat.id)}>
              {aberto === cat.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            <div className="flex-1">
              <p className="font-semibold">{cat.nome} <span className="text-sm font-normal text-texto-suave">· {cat.itens.length} itens</span></p>
              <p className="text-xs text-texto-suave">{descreverRegra(cat.aplicavel, refs)}</p>
            </div>
            {!ro && (
              <>
                <button aria-label="Subir categoria" className="rounded p-2 hover:bg-fundo" onClick={() => mudar({ ...modelo, categorias: mover(categorias, ci, -1) })}><ArrowUp size={16} /></button>
                <button aria-label="Descer categoria" className="rounded p-2 hover:bg-fundo" onClick={() => mudar({ ...modelo, categorias: mover(categorias, ci, 1) })}><ArrowDown size={16} /></button>
                <button aria-label="Remover categoria" className="rounded p-2 text-erro hover:bg-erro/10" onClick={() => confirm(`Remover a categoria "${cat.nome}" e seus ${cat.itens.length} itens deste rascunho?`) && mudar({ ...modelo, categorias: categorias.filter((c) => c.id !== cat.id).map((c, k) => ({ ...c, ordem: k + 1 })) })}><Trash2 size={16} /></button>
              </>
            )}
          </div>

          {aberto === cat.id && (
            <div className="space-y-3 border-t border-borda p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Rotulo>Nome</Rotulo><Campo value={cat.nome} disabled={ro} onChange={(e) => mudarCat(cat.id, { nome: e.target.value })} /></div>
                <div><Rotulo>Código</Rotulo><Campo value={cat.codigo} disabled={ro} onChange={(e) => mudarCat(cat.id, { codigo: slug(e.target.value) })} /></div>
                <div><Rotulo>Ícone</Rotulo><Selecao value={cat.icone} disabled={ro} onChange={(e) => mudarCat(cat.id, { icone: e.target.value })}>{ICONES.map((i) => <option key={i}>{i}</option>)}</Selecao></div>
              </div>
              <EditorRegra regra={cat.aplicavel} onChange={(r) => mudarCat(cat.id, { aplicavel: r })} refs={refs} somenteLeitura={ro} />
            </div>
          )}

          <ul className="divide-y divide-borda border-t border-borda">
            {[...cat.itens].sort((a, b) => a.ordem - b.ordem).map((it, ii, itens) => (
              <li key={it.id} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <button aria-expanded={aberto === it.id} aria-label="Abrir item" className="rounded p-2 hover:bg-fundo" onClick={() => setAberto(aberto === it.id ? null : it.id)}>
                    {aberto === it.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="flex-1 text-sm">
                    <p>{it.titulo}</p>
                    <p className="text-xs text-texto-suave">
                      {it.criticidadeSugerida ? `NC sugerida: ${CRITICIDADES.find((c) => c.valor === it.criticidadeSugerida)?.rotulo}` : "Sem criticidade sugerida"}
                      {!it.permiteNaoAplica && " · N/A não permitido"} · {descreverRegra(it.aplicavel, refs)}
                    </p>
                  </div>
                  {!ro && (
                    <>
                      <button aria-label="Subir item" className="rounded p-2 hover:bg-fundo" onClick={() => mudarCat(cat.id, { itens: mover(itens, ii, -1) })}><ArrowUp size={14} /></button>
                      <button aria-label="Descer item" className="rounded p-2 hover:bg-fundo" onClick={() => mudarCat(cat.id, { itens: mover(itens, ii, 1) })}><ArrowDown size={14} /></button>
                      <button aria-label="Remover item" className="rounded p-2 text-erro hover:bg-erro/10" onClick={() => mudarCat(cat.id, { itens: itens.filter((x) => x.id !== it.id).map((x, k) => ({ ...x, ordem: k + 1 })) })}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
                {aberto === it.id && (
                  <div className="mt-2 space-y-3 pl-10">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Rotulo>Pergunta / item</Rotulo><Campo value={it.titulo} disabled={ro} onChange={(e) => mudarItem(cat.id, it.id, { titulo: e.target.value })} /></div>
                      <div><Rotulo>Código</Rotulo><Campo value={it.codigo} disabled={ro} onChange={(e) => mudarItem(cat.id, it.id, { codigo: e.target.value.trim() })} /></div>
                    </div>
                    <div><Rotulo>Orientação ao inspetor</Rotulo><Campo value={it.descricao} disabled={ro} onChange={(e) => mudarItem(cat.id, it.id, { descricao: e.target.value })} /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Rotulo>Criticidade sugerida da NC</Rotulo>
                        <Selecao value={it.criticidadeSugerida ?? ""} disabled={ro} onChange={(e) => mudarItem(cat.id, it.id, { criticidadeSugerida: (e.target.value || null) as Criticidade | null })}>
                          <option value="">Nenhuma</option>
                          {CRITICIDADES.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
                        </Selecao>
                      </div>
                      <label className="flex items-center gap-2 self-end pb-3 text-sm">
                        <input type="checkbox" disabled={ro} checked={it.permiteNaoAplica} onChange={(e) => mudarItem(cat.id, it.id, { permiteNaoAplica: e.target.checked })} /> Permite "Não se aplica"
                      </label>
                    </div>
                    <EditorRegra regra={it.aplicavel} onChange={(r) => mudarItem(cat.id, it.id, { aplicavel: r })} refs={refs} somenteLeitura={ro} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!ro && (
            <button className="m-2 inline-flex min-h-9 items-center gap-1 rounded px-2 text-sm text-marca hover:bg-marca-clara" onClick={() => novoItem(cat)}>
              <Plus size={16} /> Item
            </button>
          )}
        </section>
      ))}

      {!ro && (
        <button className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-dashed border-marca px-4 text-marca hover:bg-marca-clara" onClick={novaCategoria}>
          <Plus size={18} /> Categoria
        </button>
      )}

      <Previa modeloId={id!} versao={Number(v)} refs={refs} desatualizada={alterado} />

      {aviso && (
        <Aviso tom={aviso.tom}>
          {aviso.texto}
          {aviso.erros && aviso.erros.length > 0 && <ul className="mt-1 list-disc pl-5">{aviso.erros.map((e) => <li key={e}>{e}</li>)}</ul>}
        </Aviso>
      )}

      {!ro && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <span className="flex-1 text-sm text-texto-suave">{alterado ? "Alterações não salvas." : "Rascunho salvo."}</span>
            <Botao variante="secundario" className="!w-auto" carregando={ocupado} disabled={!alterado} onClick={() => void salvar()}>Salvar rascunho</Botao>
            {pode(usuario?.papel ?? "inspetor", "modelo:publicar") && (
              <Botao className="!w-auto" carregando={ocupado} onClick={() => confirm(`Publicar a versão ${modelo.versao}? Ela fica imutável e substitui a versão publicada atual.`) && void publicar()}>
                Publicar versão
              </Botao>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Simula o que o inspetor vê para um veículo real numa área/atividade. */
function Previa({ modeloId, versao, refs, desatualizada }: { modeloId: string; versao: number; refs: Referencias; desatualizada: boolean }) {
  const veiculos = useRecurso<Veiculo[]>("/admin/veiculos").dados?.filter((x) => x.status === "ativo") ?? [];
  const [veiculoId, setVeiculo] = useState("");
  const [areaId, setArea] = useState("");
  const [atividadeId, setAtividade] = useState("");
  const [res, setRes] = useState<ModeloChecklist | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function simular() {
    const v = veiculos.find((x) => x.id === veiculoId);
    if (!v) return;
    try {
      setRes(await enviar<ModeloChecklist>("POST", `/admin/modelos/${modeloId}/versoes/${versao}/previa`, { tipoVeiculoId: v.tipoVeiculoId, areaId, atividadeId, atributos: v.atributos }));
      setErro(null);
    } catch (e) {
      setErro(textoErro(e).mensagem);
    }
  }

  return (
    <section className="rounded-xl border border-borda bg-superficie p-4">
      <h3 className="flex items-center gap-2 font-bold"><Eye size={18} /> Prévia do inspetor</h3>
      <p className="text-sm text-texto-suave">Escolha um veículo e a operação para ver quais itens aparecem.{desatualizada && " Salve o rascunho antes: a prévia usa a versão salva."}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Selecao aria-label="Veículo" value={veiculoId} onChange={(e) => setVeiculo(e.target.value)}>
          <option value="">Veículo…</option>
          {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa ?? v.codigo} · {[v.fabricante, v.modelo].filter(Boolean).join(" ")}</option>)}
        </Selecao>
        <Selecao aria-label="Área" value={areaId} onChange={(e) => setArea(e.target.value)}>
          <option value="">Área…</option>
          {refs.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </Selecao>
        <Selecao aria-label="Atividade" value={atividadeId} onChange={(e) => setAtividade(e.target.value)}>
          <option value="">Atividade…</option>
          {refs.atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </Selecao>
        <Botao variante="secundario" disabled={!veiculoId} onClick={() => void simular()}>Simular</Botao>
      </div>
      {erro && <div className="mt-3"><Aviso tom="erro">{erro}</Aviso></div>}
      {res && (
        <div className="mt-3 text-sm">
          <p className="font-semibold">{res.categorias.reduce((n, c) => n + c.itens.length, 0)} itens em {res.categorias.length} categorias para este veículo:</p>
          <ul className="mt-1 columns-1 gap-6 sm:columns-2">
            {res.categorias.map((c) => (
              <li key={c.id} className="mb-2 break-inside-avoid">
                <span className="font-medium">{c.nome}</span>
                <span className="text-texto-suave"> — {c.itens.map((i) => i.titulo).join("; ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
