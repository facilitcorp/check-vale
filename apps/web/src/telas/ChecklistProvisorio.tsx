import { useParams } from "react-router-dom";
import { Aviso, Cabecalho, Tela } from "../componentes/ui";
import { useInspecao } from "../dados/ganchos";

/**
 * PROVISÓRIO: ponto de encaixe das telas 5–12 (fluxo da inspeção, @dev-2).
 * Rotas reservadas: /inspecao/:id (categorias/progresso), /inspecao/:id/item/:itemId,
 * /inspecao/:id/resultado, /inspecao/:id/plano. Substituir este arquivo.
 */
export function ChecklistProvisorio() {
  const { id } = useParams();
  const inspecao = useInspecao(id);
  return (
    <>
      <Cabecalho voltar="/" />
      <Tela titulo="Checklist" subtitulo={inspecao ? `Inspeção ${inspecao.id.slice(0, 8)} criada neste aparelho.` : "Carregando…"}>
        <Aviso>Telas do checklist em integração.</Aviso>
      </Tela>
    </>
  );
}
