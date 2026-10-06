import { describe, expect, it } from "vitest";
import { lerConfig } from "./config";

const PROD = {
  NODE_ENV: "production",
  JWT_SECRET: "x".repeat(32),
  DATABASE_URL: "postgres://u@/db?host=/cloudsql/p:r:i",
  UPLOADS_BUCKET: "fotos-staging",
  SEMEAR_DEMO: "1",
  SENHA_DEMO: "senha-longa-de-staging",
};
const sem = (chave: keyof typeof PROD) => Object.fromEntries(Object.entries(PROD).filter(([k]) => k !== chave));

describe("lerConfig em produção: sobe completo ou não sobe", () => {
  it("configuração completa passa e usa a SENHA_DEMO dada", () => {
    const c = lerConfig(PROD);
    expect(c.senhaDemo).toBe("senha-longa-de-staging");
    expect(c.uploadsBucket).toBe("fotos-staging");
  });

  it.each([
    ["JWT_SECRET", /JWT_SECRET/],
    ["DATABASE_URL", /DATABASE_URL/],
    ["UPLOADS_BUCKET", /UPLOADS_BUCKET/],
    ["SENHA_DEMO", /SENHA_DEMO/],
  ] as const)("sem %s, recusa subir", (chave, erro) => {
    expect(() => lerConfig(sem(chave))).toThrow(erro);
  });

  it("recusa a senha pública do README e senha curta", () => {
    expect(() => lerConfig({ ...PROD, SENHA_DEMO: "checkvale" })).toThrow(/SENHA_DEMO/);
    expect(() => lerConfig({ ...PROD, SENHA_DEMO: "curta" })).toThrow(/SENHA_DEMO/);
  });

  it("sem semear DEMO, não exige SENHA_DEMO", () => {
    expect(() => lerConfig({ ...sem("SENHA_DEMO"), SEMEAR_DEMO: "0" })).not.toThrow();
  });

  it("fora de produção mantém o padrão do README", () => {
    expect(lerConfig({ NODE_ENV: "test" }).senhaDemo).toBe("checkvale");
  });
});

describe("autocadastro (temporário, para teste)", () => {
  it("em produção fica desligado, a não ser com AUTOCADASTRO=1", () => {
    expect(lerConfig(PROD).autocadastro).toBe(false);
    expect(lerConfig({ ...PROD, AUTOCADASTRO: "1" }).autocadastro).toBe(true);
  });

  it("fora de produção fica ligado, a não ser com AUTOCADASTRO=0", () => {
    expect(lerConfig({ NODE_ENV: "test" }).autocadastro).toBe(true);
    expect(lerConfig({ NODE_ENV: "test", AUTOCADASTRO: "0" }).autocadastro).toBe(false);
  });
});
