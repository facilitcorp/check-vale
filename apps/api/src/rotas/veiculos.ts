import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { veiculoDeLinha } from "../mapeamento";

const Consulta = z.object({ desde: z.iso.datetime({ offset: true }).optional() });

export const rotasVeiculos: FastifyPluginAsync = async (app) => {
  // Cadastro/alteração vem pela fila de sync (funciona offline): ver rotas/sync.ts.
  app.get("/veiculos", async (req) => {
    const { desde } = Consulta.parse(req.query);
    const servidorEm = new Date().toISOString();
    const { rows } = desde
      ? await app.db.query(`SELECT * FROM veiculos WHERE servidor_em > $1 ORDER BY placa NULLS LAST`, [desde])
      : await app.db.query(`SELECT * FROM veiculos ORDER BY placa NULLS LAST`);
    return { veiculos: rows.map(veiculoDeLinha), servidorEm };
  });
};
