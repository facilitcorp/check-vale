import { calcularResultado } from "@checkvale/shared";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, ClipboardCheck, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Aviso, Botao, Cabecalho, Tela } from "../componentes/ui";
import { banco } from "../dados/banco";
import { useCatalogo, useVeiculos } from "../dados/ganchos";
import { sair, useSessao } from "../dados/sessao";

/** Início: nova verificação e histórico deste aparelho. */
export function Inicio() {
  const navegar = useNavigate();
  const { usuario } = useSessao();
  const catalogo = useCatalogo();
  const veiculos = useVeiculos();
  // Operações que o servidor recusou de vez (ex.: placa já cadastrada por outro aparelho): o inspetor precisa ver.
  const rejeitadas = useLiveQuery(() => banco.fila.where("estado").equals("rejeitada").toArray(), []);
  const inspecoes = useLiveQuery(() => banco.inspecoes.orderBy("iniciadaEm").reverse().limit(30).toArray(), []);

  const veiculo = (id: string) => veiculos?.find((v) => v.id === id);
  const modelo = (id: string, versao: number) => catalogo?.modelos.find((m) => m.id === id && m.versao === versao);

  return (
    <>
      <Cabecalho
        voltar={false}
        direita={
          <button aria-label="Sair" onClick={() => void sair()} className="rounded-full p-2 active:bg-white/10">
            <LogOut size={20} />
          </button>
        }
      />
      <Tela titulo={`Olá, ${usuario?.nome.split(" ")[0] ?? ""}`} subtitulo="Prepare seu veículo para a mobilização.">
        <Botao onClick={() => navegar("/nova")} disabled={!catalogo}>
          <span className="inline-flex items-center gap-2"><ClipboardCheck size={20} /> Nova verificação</span>
        </Botao>
        {catalogo === null && <p className="mt-3 text-center text-sm text-texto-suave">Baixando dados para uso offline… conecte-se à internet.</p>}

        {!!rejeitadas?.length && (
          <div className="mt-4">
            <Aviso tom="erro">
              <p className="font-semibold">{rejeitadas.length} registro(s) não aceito(s) pelo servidor:</p>
              <ul className="mt-1 list-disc pl-5">{rejeitadas.slice(0, 5).map((o) => <li key={o.seq}>{o.erro}</li>)}</ul>
              <p className="mt-1">Procure o gestor da operação.</p>
            </Aviso>
          </div>
        )}

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-texto-suave">Verificações</h2>
        {inspecoes?.length === 0 && <p className="mt-3 text-sm text-texto-suave">Nenhuma verificação ainda.</p>}
        <ul className="mt-2 divide-y divide-borda">
          {inspecoes?.map((i) => {
            const v = veiculo(i.veiculoId);
            const m = modelo(i.modeloId, i.modeloVersao);
            const r = m ? calcularResultado(m, i.respostas) : null;
            const concluida = i.status === "concluida";
            return (
              <li key={i.id}>
                <Link to={concluida ? `/inspecao/${i.id}/resultado` : `/inspecao/${i.id}`} className="flex items-center gap-3 py-3">
                  <div className="flex-1">
                    <p className="font-semibold">{v?.placa ?? v?.codigo ?? "Veículo"} <span className="font-normal text-texto-suave">· {v?.descricao}</span></p>
                    <p className="text-xs text-texto-suave">
                      {new Date(i.iniciadaEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                      {concluida ? `Concluída · ${r?.indice ?? 0}%` : `Em andamento · ${r?.respondidos ?? 0} de ${r?.total ?? 0}`}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-texto-suave" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Tela>
    </>
  );
}
