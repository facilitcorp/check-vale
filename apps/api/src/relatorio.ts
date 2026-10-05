import PDFDocument from "pdfkit";
import { calcularResultado, type Criticidade, type Inspecao, type Situacao } from "@checkvale/shared";
import type { Db } from "./db";
import { carregarModelo } from "./mapeamento";

const VERDE = "#0E5B45";
const CINZA = "#5B6670";
const ROTULO_SITUACAO: Record<Situacao, string> = {
  apto: "APTO",
  apto_com_restricoes: "APTO COM RESTRIÇÕES",
  nao_apto: "NÃO APTO",
  incompleta: "INSPEÇÃO INCOMPLETA",
};
const ROTULO_CRITICIDADE: Record<Criticidade, string> = { critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa" };

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Belem", dateStyle: "short", timeStyle: "short" }) : "—";

export async function gerarRelatorioPdf(db: Db, insp: Inspecao): Promise<Buffer> {
  const modelo = await carregarModelo(db, insp.modeloId, insp.modeloVersao);
  if (!modelo) throw new Error("modelo da inspeção não encontrado");
  const res = calcularResultado(modelo, insp.respostas);

  const { rows: ctx } = await db.query<Record<string, string | null>>(
    `SELECT v.placa, v.codigo, v.descricao, v.marca_modelo, u.nome AS unidade, a.nome AS area, at.nome AS atividade, us.nome AS inspetor
     FROM inspecoes i
     JOIN veiculos v ON v.id = i.veiculo_id JOIN unidades u ON u.id = i.unidade_id
     JOIN areas a ON a.id = i.area_id JOIN atividades at ON at.id = i.atividade_id
     JOIN usuarios us ON us.id = i.inspetor_id WHERE i.id = $1`,
    [insp.id],
  );
  const c = ctx[0] ?? {};

  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `CheckVale — ${c.placa ?? c.codigo ?? ""}` } });
  const partes: Buffer[] = [];
  doc.on("data", (b: Buffer) => partes.push(b));
  const fim = new Promise<Buffer>((ok) => doc.on("end", () => ok(Buffer.concat(partes))));

  doc.fillColor(VERDE).fontSize(20).font("Helvetica-Bold").text("CheckVale");
  doc.fillColor(CINZA).fontSize(10).font("Helvetica").text("Relatório de verificação de veículo");
  doc.moveDown();

  const linha = (rotulo: string, valor: string | null | undefined) =>
    doc.fillColor(CINZA).font("Helvetica").text(`${rotulo}: `, { continued: true }).fillColor("#111").font("Helvetica-Bold").text(valor ?? "—");
  doc.fontSize(10);
  linha("Veículo", [c.placa ?? c.codigo, c.descricao, c.marca_modelo].filter(Boolean).join(" · "));
  linha("Unidade / área", `${c.unidade ?? "—"} · ${c.area ?? "—"}`);
  linha("Atividade", c.atividade);
  linha("Inspetor", c.inspetor);
  linha("Início / conclusão", `${fmt(insp.iniciadaEm)} · ${fmt(insp.concluidaEm)}`);
  linha("Checklist", `${modelo.nome} (v${modelo.versao})`);
  linha("Identificador", insp.id);
  doc.moveDown();

  doc.fillColor(VERDE).fontSize(16).font("Helvetica-Bold").text(`${ROTULO_SITUACAO[res.situacao]} — índice de prontidão ${res.indice}%`);
  doc.fillColor("#111").fontSize(10).font("Helvetica")
    .text(`${res.conformes} conformes · ${res.naoConformes} não conformes · ${res.naoAplica} não se aplicam · ${res.respondidos}/${res.total} respondidos`);
  doc.moveDown();

  doc.fillColor(VERDE).fontSize(12).font("Helvetica-Bold").text("Resultado por categoria");
  doc.fontSize(10).font("Helvetica").fillColor("#111");
  for (const cat of res.porCategoria)
    doc.text(`${cat.nome}`, { continued: true }).text(`   ${cat.indice}%  (${cat.conformes}/${cat.respondidos - cat.naoAplica} conformes, ${cat.respondidos}/${cat.total} respondidos)`, { align: "right" });
  doc.moveDown();

  doc.fillColor(VERDE).fontSize(12).font("Helvetica-Bold").text("Plano de ação");
  doc.fontSize(10).fillColor("#111");
  if (res.planoAcao.length === 0) doc.font("Helvetica").text("Nenhuma não conformidade registrada.");
  for (const a of res.planoAcao) {
    doc.font("Helvetica-Bold").text(`[${ROTULO_CRITICIDADE[a.criticidade]}] ${a.categoriaNome} — ${a.itemTitulo}`);
    doc.font("Helvetica").text(a.descricao, { indent: 12 });
  }

  doc.moveDown(2).fontSize(8).fillColor(CINZA).text(`Gerado em ${fmt(new Date().toISOString())}. Documento gerado pelo CheckVale a partir dos registros sincronizados.`);
  doc.end();
  return fim;
}
