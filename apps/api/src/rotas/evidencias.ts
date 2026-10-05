import type { FastifyPluginAsync } from "fastify";
import { Id } from "@checkvale/shared";
import { ErroHttp } from "../app";

interface LinhaEv { id: string; inspecao_id: string; mime: string; bytes: number; arquivo_chave: string | null; inspetor_id: string }

export const rotasEvidencias: FastifyPluginAsync = async (app) => {
  async function obter(id: string, sub: string, papel: string): Promise<LinhaEv> {
    const { rows } = await app.db.query<LinhaEv>(
      `SELECT e.id, e.inspecao_id, e.mime, e.bytes, e.arquivo_chave, i.inspetor_id
       FROM evidencias e JOIN inspecoes i ON i.id = e.inspecao_id WHERE e.id = $1`, [id]);
    const ev = rows[0];
    // Registrar os metadados (via /sync) antes de enviar o arquivo; 404 aqui = o app tenta de novo depois.
    if (!ev) throw new ErroHttp(404, "evidencia_nao_registrada", "Evidência ainda não registrada.");
    if (ev.inspetor_id !== sub && papel === "inspetor") throw new ErroHttp(403, "proibido", "Sem acesso a esta evidência.");
    return ev;
  }

  app.put<{ Params: { id: string } }>("/evidencias/:id/arquivo", async (req) => {
    const id = Id.parse(req.params.id);
    const ev = await obter(id, req.user.sub, req.user.papel);
    const corpo = req.body;
    if (!Buffer.isBuffer(corpo) || corpo.length === 0) throw new ErroHttp(400, "arquivo_vazio", "Envie a imagem no corpo.");
    if (req.headers["content-type"] !== ev.mime) throw new ErroHttp(400, "tipo_divergente", "Tipo da imagem diferente do registrado.");
    const chave = `evidencias/${ev.inspecao_id}/${ev.id}`;
    await app.armazenamento.salvar(chave, corpo);
    await app.db.query(`UPDATE evidencias SET arquivo_chave = $2, bytes = $3, enviada_em = now() WHERE id = $1`, [id, chave, corpo.length]);
    await app.auditar(req, "evidencia.enviar", "evidencia", id, { bytes: corpo.length });
    return { url: `/api/evidencias/${id}/arquivo` };
  });

  app.get<{ Params: { id: string } }>("/evidencias/:id/arquivo", async (req, rep) => {
    const id = Id.parse(req.params.id);
    const ev = await obter(id, req.user.sub, req.user.papel);
    const arq = ev.arquivo_chave ? await app.armazenamento.ler(ev.arquivo_chave) : null;
    if (!arq) throw new ErroHttp(404, "arquivo_pendente", "Foto ainda não enviada pelo aparelho.");
    return rep.header("Content-Type", ev.mime).header("Cache-Control", "private, max-age=86400").send(arq);
  });
};
