import { describe, expect, it } from "vitest";
import { SEM_RESTRICAO, type ModeloChecklist, type Resposta } from "./dominio";
import { Resposta as RespostaSchema } from "./dominio";
import { calcularResultado, ROTULO_SITUACAO, tomDaSituacao } from "./resultado";

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T0 = "2026-10-05T10:00:00.000Z";
const T1 = "2026-10-05T10:05:00.000Z";

const modelo: ModeloChecklist = {
  id: uid(1),
  nome: "Teste",
  versao: 1,
  aplicavel: SEM_RESTRICAO,
  categorias: [
    {
      id: uid(10), codigo: "ext", nome: "Itens externos", icone: "car", ordem: 2, aplicavel: SEM_RESTRICAO,
      itens: [
        { id: uid(11), codigo: "ext.1", titulo: "Carroceria", descricao: "", ordem: 1, permiteNaoAplica: true, criticidadeSugerida: null, aplicavel: SEM_RESTRICAO },
        { id: uid(12), codigo: "ext.2", titulo: "Lanterna", descricao: "", ordem: 2, permiteNaoAplica: true, criticidadeSugerida: "alta", aplicavel: SEM_RESTRICAO },
      ],
    },
    {
      id: uid(20), codigo: "id", nome: "Identificação", icone: "id", ordem: 1, aplicavel: SEM_RESTRICAO,
      itens: [
        { id: uid(21), codigo: "id.1", titulo: "Placa", descricao: "", ordem: 1, permiteNaoAplica: false, criticidadeSugerida: null, aplicavel: SEM_RESTRICAO },
        { id: uid(22), codigo: "id.2", titulo: "Adesivo", descricao: "", ordem: 2, permiteNaoAplica: true, criticidadeSugerida: null, aplicavel: SEM_RESTRICAO },
      ],
    },
  ],
};

const ok = (itemId: string, em = T0): Resposta => ({ itemId, status: "conforme", observacao: null, naoConformidade: null, evidenciaIds: [], respondidaEm: em });
const na = (itemId: string): Resposta => ({ ...ok(itemId), status: "nao_aplica" });
const nc = (itemId: string, criticidade: "critica" | "alta" | "media" | "baixa", em = T0): Resposta => ({
  itemId, status: "nao_conforme", observacao: null, naoConformidade: { descricao: "defeito", criticidade }, evidenciaIds: [uid(99)], respondidaEm: em,
});

describe("calcularResultado", () => {
  it("inspeção vazia: 0%, incompleta", () => {
    const r = calcularResultado(modelo, []);
    expect(r).toMatchObject({ total: 4, respondidos: 0, indice: 0, completa: false, situacao: "incompleta" });
    expect(r.porCategoria.map((c) => c.nome)).toEqual(["Identificação", "Itens externos"]);
  });

  it("não se aplica sai do denominador", () => {
    const r = calcularResultado(modelo, [ok(uid(11)), ok(uid(12)), ok(uid(21)), na(uid(22))]);
    expect(r.indice).toBe(100);
    expect(r.situacao).toBe("apto");
  });

  it("NC crítica torna não apto e vai primeiro no plano de ação", () => {
    const r = calcularResultado(modelo, [nc(uid(11), "media"), nc(uid(12), "critica"), ok(uid(21)), ok(uid(22))]);
    expect(r.indice).toBe(50);
    expect(r.naoConformes).toBe(2);
    expect(r.pontosAtencao).toBe(0);
    expect(r.situacao).toBe("nao_apto");
    expect(r.planoAcao.map((a) => a.criticidade)).toEqual(["critica", "media"]);
  });

  it("NC não crítica: apto com restrições", () => {
    const r = calcularResultado(modelo, [nc(uid(11), "alta"), ok(uid(12)), ok(uid(21)), ok(uid(22))]);
    expect(r.situacao).toBe("apto_com_restricoes");
  });

  it("veredito: rótulo e tom (NC crítica nunca é verde)", () => {
    expect(ROTULO_SITUACAO.nao_apto).toBe("Não apto");
    expect(tomDaSituacao("nao_apto")).toBe("ruim");
    expect(tomDaSituacao("apto_com_restricoes")).toBe("medio");
    expect(tomDaSituacao("apto")).toBe("bom");
    expect(tomDaSituacao("incompleta")).toBe("na");
  });

  it("resposta mais recente do item é a que vale", () => {
    const r = calcularResultado(modelo, [nc(uid(11), "critica", T0), ok(uid(11), T1)]);
    expect(r.respondidos).toBe(1);
    expect(r.conformes).toBe(1);
    expect(r.planoAcao).toHaveLength(0);
  });
});

describe("pontos de atenção", () => {
  it("conta item conforme com observação; observação em branco não conta", () => {
    const r = calcularResultado(modelo, [{ ...ok(uid(11)), observacao: "Pequeno risco na pintura" }, { ...ok(uid(12)), observacao: "  " }, ok(uid(21))]);
    expect(r.pontosAtencao).toBe(1);
    expect(r.conformes).toBe(3);
  });
});

describe("Resposta (validação)", () => {
  it("NC sem foto ou sem descrição é rejeitada", () => {
    expect(RespostaSchema.safeParse({ ...nc(uid(11), "alta"), evidenciaIds: [] }).success).toBe(false);
    expect(RespostaSchema.safeParse({ ...nc(uid(11), "alta"), naoConformidade: null }).success).toBe(false);
    expect(RespostaSchema.safeParse(nc(uid(11), "alta")).success).toBe(true);
  });
});
