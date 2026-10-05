import type { Evidencia, Inspecao, ModeloChecklist, Resposta, Veiculo } from "@checkvale/shared";
import type { Db } from "./db";

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const isoOuNull = (v: unknown) => (v == null ? null : iso(v));

export const veiculoDeLinha = (r: Record<string, unknown>): Veiculo => ({
  id: r.id as string,
  placa: (r.placa as string | null) ?? null,
  codigo: (r.codigo as string | null) ?? null,
  tipoVeiculoId: r.tipo_veiculo_id as string,
  descricao: r.descricao as string,
  marcaModelo: r.marca_modelo as string,
  unidadeId: (r.unidade_id as string | null) ?? null,
  criadoEm: iso(r.criado_em),
  atualizadoEm: iso(r.atualizado_em),
});

export const modeloDeLinha = (r: Record<string, unknown>): ModeloChecklist => ({
  id: r.id as string,
  nome: r.nome as string,
  versao: r.versao as number,
  tipoVeiculoIds: r.tipo_veiculo_ids as string[],
  areaIds: r.area_ids as string[],
  atividadeIds: r.atividade_ids as string[],
  categorias: (typeof r.categorias === "string" ? JSON.parse(r.categorias) : r.categorias) as ModeloChecklist["categorias"],
});

export const respostaDeLinha = (r: Record<string, unknown>): Resposta => ({
  itemId: r.item_id as string,
  status: r.status as Resposta["status"],
  observacao: (r.observacao as string | null) ?? null,
  naoConformidade: r.nc_descricao
    ? { descricao: r.nc_descricao as string, criticidade: r.nc_criticidade as NonNullable<Resposta["naoConformidade"]>["criticidade"] }
    : null,
  evidenciaIds: r.evidencia_ids as string[],
  respondidaEm: iso(r.respondida_em),
});

export const evidenciaDeLinha = (r: Record<string, unknown>): Evidencia => ({
  id: r.id as string,
  inspecaoId: r.inspecao_id as string,
  itemId: r.item_id as string,
  mime: r.mime as Evidencia["mime"],
  bytes: r.bytes as number,
  capturadaEm: iso(r.capturada_em),
  url: r.arquivo_chave ? `/api/evidencias/${r.id as string}/arquivo` : null,
});

export async function carregarInspecoes(db: Db, where: string, params: unknown[]): Promise<Inspecao[]> {
  const { rows } = await db.query(`SELECT * FROM inspecoes WHERE ${where} ORDER BY iniciada_em DESC`, params);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id as string);
  const { rows: resp } = await db.query(`SELECT * FROM respostas WHERE inspecao_id = ANY($1::uuid[])`, [ids]);
  return rows.map((r) => ({
    id: r.id as string,
    modeloId: r.modelo_id as string,
    modeloVersao: r.modelo_versao as number,
    unidadeId: r.unidade_id as string,
    areaId: r.area_id as string,
    atividadeId: r.atividade_id as string,
    veiculoId: r.veiculo_id as string,
    inspetorId: r.inspetor_id as string,
    status: r.status as Inspecao["status"],
    iniciadaEm: iso(r.iniciada_em),
    concluidaEm: isoOuNull(r.concluida_em),
    respostas: resp.filter((x) => x.inspecao_id === r.id).map(respostaDeLinha),
  }));
}

export async function carregarModelo(db: Db, id: string, versao: number): Promise<ModeloChecklist | null> {
  const { rows } = await db.query(`SELECT * FROM modelos_checklist WHERE id = $1 AND versao = $2`, [id, versao]);
  return rows[0] ? modeloDeLinha(rows[0]) : null;
}
