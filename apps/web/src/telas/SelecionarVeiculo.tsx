import { escolherModelo } from "@checkvale/shared";
import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconeVeiculo } from "../componentes/IconeVeiculo";
import { Aviso, Botao, Cabecalho, Campo, Tela } from "../componentes/ui";
import { useCatalogo, useVeiculos } from "../dados/ganchos";
import { repositorioInspecao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";

/** Tela 4 — escolhe o veículo e abre a inspeção com o modelo de checklist adequado. */
export function SelecionarVeiculo() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const ctx = { unidadeId: params.get("unidadeId") ?? "", areaId: params.get("areaId") ?? "", atividadeId: params.get("atividadeId") ?? "" };
  const { usuario } = useSessao();
  const catalogo = useCatalogo();
  const veiculos = useVeiculos();
  const [tipo, setTipo] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const tipos = catalogo?.tiposVeiculo ?? [];
  const lista = useMemo(() => {
    const q = busca.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "");
    return (veiculos ?? [])
      .filter((v) => !tipo || v.tipoVeiculoId === tipo)
      .filter((v) => !q || [v.placa, v.codigo, v.descricao, v.marcaModelo].some((s) => s?.toUpperCase().includes(q)))
      .sort((a, b) => (a.placa ?? a.codigo ?? "").localeCompare(b.placa ?? b.codigo ?? ""));
  }, [veiculos, tipo, busca]);

  async function escolher(veiculoId: string, tipoVeiculoId: string) {
    if (!catalogo || !usuario) return;
    const modelo = escolherModelo(catalogo.modelos, { tipoVeiculoId, areaId: ctx.areaId, atividadeId: ctx.atividadeId });
    if (!modelo) return setErro("Não há checklist configurado para este tipo de veículo nesta área.");
    const i = await repositorioInspecao.criar({ ...ctx, veiculoId, modeloId: modelo.id, modeloVersao: modelo.versao, inspetorId: usuario.id });
    navegar(`/inspecao/${i.id}`, { replace: true });
  }

  return (
    <>
      <Cabecalho />
      <Tela
        titulo="Selecione o veículo"
        subtitulo="Escolha o veículo que será verificado."
        rodape={<Botao variante="secundario" onClick={() => navegar(`/veiculos/novo?${params}`)}>Cadastrar novo veículo</Botao>}
      >
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" role="tablist">
          {[{ id: "", nome: "Todos" }, ...tipos].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tipo === t.id}
              onClick={() => setTipo(t.id)}
              className={`h-9 shrink-0 rounded-lg px-4 text-sm font-medium ${tipo === t.id ? "bg-marca text-white" : "bg-fundo text-texto-suave"}`}
            >
              {t.nome}
            </button>
          ))}
        </div>
        <div className="relative mt-4">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave" />
          <Campo placeholder="Buscar por placa ou código..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10" />
        </div>
        {erro && <div className="mt-4"><Aviso tom="erro">{erro}</Aviso></div>}
        <ul className="mt-3 divide-y divide-borda">
          {lista.map((v) => (
            <li key={v.id}>
              <button onClick={() => void escolher(v.id, v.tipoVeiculoId)} className="flex w-full items-center gap-4 py-3 text-left active:bg-fundo">
                <span className="flex h-14 w-16 items-center justify-center rounded-lg bg-marca-clara text-marca">
                  <IconeVeiculo codigo={tipos.find((t) => t.id === v.tipoVeiculoId)?.codigo} />
                </span>
                <span className="flex-1">
                  <span className="block font-bold">{v.placa ?? v.codigo}</span>
                  <span className="block text-sm text-texto-suave">{v.descricao}</span>
                  <span className="block text-sm text-texto-suave">{v.marcaModelo}</span>
                </span>
                <ChevronRight size={18} className="text-texto-suave" />
              </button>
            </li>
          ))}
        </ul>
        {veiculos && lista.length === 0 && <p className="py-8 text-center text-sm text-texto-suave">Nenhum veículo encontrado.</p>}
      </Tela>
    </>
  );
}
