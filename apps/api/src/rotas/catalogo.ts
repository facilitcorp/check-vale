import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Id, type Catalogo, type ModeloChecklist } from "@checkvale/shared";
import { ErroHttp } from "../app";
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

  // Versão exata de um modelo, para o aparelho que recebeu uma inspeção aberta numa versão
  // que o catálogo já não traz (o catálogo só tem a publicada mais recente). Rascunho não sai daqui.
  app.get("/modelos/:id/versoes/:v", async (req): Promise<ModeloChecklist> => {
    const { id, v } = VersaoParam.parse(req.params);
    const { rows } = await app.db.query(`SELECT * FROM modelos_checklist WHERE id = $1 AND versao = $2 AND status <> 'rascunho'`, [id, v]);
    if (!rows[0]) throw new ErroHttp(404, "nao_encontrado", "Versão de modelo não encontrada.");
    return modeloDeLinha(rows[0]);
  });
};

const VersaoParam = z.object({ id: Id, v: z.coerce.number().int().positive() });
