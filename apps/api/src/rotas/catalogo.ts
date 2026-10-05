import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { Catalogo } from "@checkvale/shared";
import { areaDeLinha, atividadeDeLinha, atributoDeLinha, modeloDeLinha, tipoDeLinha, unidadeDeLinha } from "../mapeamento";

export const rotasCatalogo: FastifyPluginAsync = async (app) => {
  app.get("/catalogo", async (req, rep) => {
    const [unidades, areas, atividades, tipos, modelos] = await Promise.all([
      app.db.query(`SELECT * FROM unidades WHERE ativo ORDER BY nome`),
      app.db.query(`SELECT * FROM areas WHERE ativo ORDER BY nome`),
      app.db.query(`SELECT * FROM atividades WHERE ativo ORDER BY nome`),
      app.db.query(`SELECT * FROM tipos_veiculo WHERE ativo ORDER BY ordem, nome`),
      // Só a versão PUBLICADA mais recente de cada modelo.
      app.db.query(`SELECT DISTINCT ON (id) * FROM modelos_checklist WHERE status = 'publicada' ORDER BY id, versao DESC`),
    ]);
    const atributos = await app.db.query(`SELECT * FROM atributos_veiculo WHERE ativo ORDER BY ordem, nome`);
    const corpo: Omit<Catalogo, "versao"> = {
      unidades: unidades.rows.map(unidadeDeLinha),
      areas: areas.rows.map(areaDeLinha),
      atividades: atividades.rows.map(atividadeDeLinha),
      tiposVeiculo: tipos.rows.map(tipoDeLinha),
      atributos: atributos.rows.map(atributoDeLinha),
      modelos: modelos.rows.map(modeloDeLinha),
    };
    const versao = createHash("sha1").update(JSON.stringify(corpo)).digest("hex").slice(0, 16);
    rep.header("ETag", `"${versao}"`);
    if (req.headers["if-none-match"] === `"${versao}"`) return rep.status(304).send();
    return { versao, ...corpo } satisfies Catalogo;
  });
};
