import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validarModeloBiblioteca } from "@checkvale/shared";
import { abrirDb, migrar, type Db } from "../db";
import { carregarBiblioteca, idModeloBiblioteca, montarCategorias } from "./biblioteca";
import { MODELOS_BIBLIOTECA } from "./biblioteca-conteudo";

let db: Db;
beforeAll(async () => {
  db = await abrirDb({ databaseUrl: null, dataDir: null });
  await migrar(db);
});
afterAll(async () => db.fechar());

// Origem honesta: modelo base não se apresenta como exigência de ninguém.
// "vale" barra também o verbo ("vale a pena"): num modelo base, melhor evitar a palavra.
const PROIBIDO = /oficial|homologad|exig|requisito|\bnormas?\b|regulament|legisla|certificad|obrigat[óo]ri[oa] por|\bvale\b|mineradora|contrato|\bNR[- ]?\d/i;

describe("conteúdo da biblioteca", () => {
  it.each(MODELOS_BIBLIOTECA.map((m) => [m.nome, m] as const))("%s é válido e não se apresenta como exigência", (_, m) => {
    const categorias = montarCategorias(m);
    expect(validarModeloBiblioteca({ categorias, origem: m.origem, fonte: m.fonte, setorIds: m.setores })).toEqual([]);
    const textos = [m.nome, m.resumo, ...categorias.flatMap((c) => [c.nome, ...c.itens.flatMap((i) => [i.titulo, i.descricao])])];
    if (m.origem === "base_checkvale") expect(textos.filter((t) => PROIBIDO.test(t))).toEqual([]);
    // Evidência sempre explícita: a empresa vê no editor o que o modelo sugere.
    expect(categorias.flatMap((c) => c.itens).filter((i) => !i.evidencia)).toEqual([]);
    // Sem exagero: foto mesmo conforme só onde agrega (cada uma é um passo a mais no campo) e o padrão segue maioria.
    const itens = categorias.flatMap((c) => c.itens);
    expect(itens.filter((i) => i.evidencia === "foto").length).toBeLessThanOrEqual(3);
    expect(itens.filter((i) => i.evidencia === "foto_se_nc").length).toBeGreaterThan(itens.length / 2);
  });

  it("a trava pega afirmações equivalentes e deixa passar texto comum", () => {
    for (const t of ["Padrão oficial", "Homologado", "Exigido pela Vale", "Exigência do cliente", "Requisito do cliente", "conforme norma regulamentadora", "Atende à legislação", "Certificado", "NR-12", "Previsto em contrato"])
      expect(PROIBIDO.test(t), t).toBe(true);
    for (const t of ["Funcionamento normal", "Sem trincas no campo de visão do condutor."]) expect(PROIBIDO.test(t), t).toBe(false);
  });

  it("chaves únicas", () => {
    const chaves = MODELOS_BIBLIOTECA.map((m) => m.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("publica na primeira carga e não duplica nem altera na segunda", async () => {
    expect(await carregarBiblioteca(db, MODELOS_BIBLIOTECA)).toEqual({ inseridos: MODELOS_BIBLIOTECA.length, pulados: [] });
    expect(await carregarBiblioteca(db, MODELOS_BIBLIOTECA)).toEqual({ inseridos: 0, pulados: [] });
    const { rows } = await db.query<{ status: string; versao: number }>(`SELECT status, versao FROM biblioteca_modelos WHERE id = $1`, [
      idModeloBiblioteca(MODELOS_BIBLIOTECA[0]!.chave),
    ]);
    expect(rows).toEqual([{ status: "publicada", versao: 1 }]);
  });

  it("setor renomeado: pula o modelo em vez de falhar a subida", async () => {
    const m = { ...MODELOS_BIBLIOTECA[0]!, chave: "teste:setor-sumiu", setores: ["Setor que não existe"] };
    expect(await carregarBiblioteca(db, [m])).toEqual({ inseridos: 0, pulados: [m.nome] });
  });
});
