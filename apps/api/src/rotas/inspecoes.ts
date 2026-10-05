import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Id } from "@checkvale/shared";
import { ErroHttp } from "../app";
import { carregarInspecoes } from "../mapeamento";
import { gerarRelatorioPdf } from "../relatorio";

const Consulta = z.object({ desde: z.iso.datetime({ offset: true }).optional() });

export const rotasInspecoes: FastifyPluginAsync = async (app) => {
  app.get("/inspecoes", async (req) => {
    const { desde } = Consulta.parse(req.query);
    const servidorEm = new Date().toISOString();
    const filtros = ["inspetor_id = $1"];
    const params: unknown[] = [req.user.sub];
    if (desde) {
      params.push(desde);
      filtros.push(`servidor_em > $${params.length}`);
    }
    return { inspecoes: await carregarInspecoes(app.db, filtros.join(" AND "), params), servidorEm };
  });

  app.get<{ Params: { id: string } }>("/inspecoes/:id/relatorio.pdf", async (req, rep) => {
    const id = Id.parse(req.params.id);
    const [insp] = await carregarInspecoes(app.db, "id = $1", [id]);
    if (!insp) throw new ErroHttp(404, "nao_encontrada", "Inspeção não encontrada (ainda não sincronizada?).");
    if (insp.inspetorId !== req.user.sub && req.user.papel === "inspetor") throw new ErroHttp(403, "proibido", "Sem acesso a esta inspeção.");
    const pdf = await gerarRelatorioPdf(app.db, insp);
    await app.auditar(req, "relatorio.gerar", "inspecao", id);
    return rep
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `inline; filename="checkvale-${id.slice(0, 8)}.pdf"`)
      .send(pdf);
  });
};
