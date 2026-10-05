import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { Catalogo } from "@checkvale/shared";
import { modeloDeLinha } from "../mapeamento";

export const rotasCatalogo: FastifyPluginAsync = async (app) => {
  app.get("/catalogo", async (req, rep) => {
    const [unidades, areas, atividades, tipos, modelos] = await Promise.all([
      app.db.query(`SELECT id, nome, uf, ativo FROM unidades WHERE ativo ORDER BY nome`),
      app.db.query(`SELECT id, unidade_id, nome, ativo FROM areas WHERE ativo ORDER BY nome`),
      app.db.query(`SELECT id, nome, ativo FROM atividades WHERE ativo ORDER BY nome`),
      app.db.query(`SELECT id, codigo, nome, ordem FROM tipos_veiculo ORDER BY ordem`),
      // Só a versão mais recente de cada modelo ativo.
      app.db.query(`SELECT DISTINCT ON (id) * FROM modelos_checklist WHERE ativo ORDER BY id, versao DESC`),
    ]);
    const corpo: Omit<Catalogo, "versao"> = {
      unidades: unidades.rows.map((r) => ({ id: r.id as string, nome: r.nome as string, uf: r.uf as string, ativo: r.ativo as boolean })),
      areas: areas.rows.map((r) => ({ id: r.id as string, unidadeId: (r.unidade_id as string | null) ?? null, nome: r.nome as string, ativo: r.ativo as boolean })),
      atividades: atividades.rows.map((r) => ({ id: r.id as string, nome: r.nome as string, ativo: r.ativo as boolean })),
      tiposVeiculo: tipos.rows.map((r) => ({ id: r.id as string, codigo: r.codigo as string, nome: r.nome as string, ordem: r.ordem as number })),
      modelos: modelos.rows.map(modeloDeLinha),
    };
    const versao = createHash("sha1").update(JSON.stringify(corpo)).digest("hex").slice(0, 16);
    rep.header("ETag", `"${versao}"`);
    if (req.headers["if-none-match"] === `"${versao}"`) return rep.status(304).send();
    return { versao, ...corpo } satisfies Catalogo;
  });
};
