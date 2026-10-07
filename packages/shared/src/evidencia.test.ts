import { describe, expect, it } from "vitest";
import { faltaEvidencia, type EvidenciaItem } from "./dominio";

const r = (status: "conforme" | "nao_conforme" | "nao_aplica", extra: { obs?: string; nc?: string; fotos?: number } = {}) => ({
  status,
  observacao: extra.obs ?? null,
  naoConformidade: status === "nao_conforme" ? { descricao: extra.nc ?? "Trincado", criticidade: "alta" as const } : null,
  evidenciaIds: Array.from({ length: extra.fotos ?? 0 }, (_, i) => `00000000-0000-4000-8000-00000000000${i}`),
});
const falta = (evidencia: EvidenciaItem | undefined, resp: ReturnType<typeof r>) => faltaEvidencia({ evidencia }, resp) !== null;

describe("evidência do item", () => {
  it.each([undefined, "sem_evidencia", "observacao", "foto", "foto_se_nc"] as const)("%s: NC sem foto nunca passa", (ev) => {
    expect(falta(ev, r("nao_conforme", { obs: "x" }))).toBe(true);
  });

  it("sem_evidencia e foto_se_nc: conforme passa sem nada", () => {
    expect(falta("sem_evidencia", r("conforme"))).toBe(false);
    expect(falta("foto_se_nc", r("conforme"))).toBe(false);
    expect(falta(undefined, r("conforme"))).toBe(false);
  });

  it("foto: pede foto mesmo conforme", () => {
    expect(falta("foto", r("conforme"))).toBe(true);
    expect(falta("foto", r("conforme", { fotos: 1 }))).toBe(false);
  });

  it("observacao: pede texto; na NC a descrição conta (a foto continua)", () => {
    expect(falta("observacao", r("conforme"))).toBe(true);
    expect(falta("observacao", r("conforme", { obs: "  " }))).toBe(true);
    expect(falta("observacao", r("conforme", { obs: "Leitura 12.345 km" }))).toBe(false);
    expect(falta("observacao", r("nao_conforme", { fotos: 1 }))).toBe(false);
  });

  it("não se aplica nunca pede evidência", () => {
    for (const ev of ["sem_evidencia", "observacao", "foto", "foto_se_nc"] as const) expect(falta(ev, r("nao_aplica"))).toBe(false);
  });
});
