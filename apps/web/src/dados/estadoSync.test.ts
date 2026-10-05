import { describe, expect, it } from "vitest";
import { situacaoSync } from "./estadoSync";

const g = (p: Partial<{ online: boolean; sincronizando: boolean; erro: string | null }> = {}) => ({ online: true, sincronizando: false, erro: null, ...p });
const pend = (operacoes = 0, fotos = 0, recusas: string[] = []) => ({ operacoes, fotos, recusas });

describe("situacaoSync", () => {
  it("recusa do servidor é sempre erro (nunca some calada)", () => expect(situacaoSync(g(), pend(0, 0, ["Placa já cadastrada."]))).toBe("erro"));
  it("nada pendente: tudo enviado, mesmo offline", () => expect(situacaoSync(g({ online: false }), pend())).toBe("tudo_enviado"));
  it("pendente e offline: sem conexão", () => expect(situacaoSync(g({ online: false }), pend(1))).toBe("sem_conexao"));
  it("foto pendente conta como pendência", () => expect(situacaoSync(g(), pend(0, 2))).toBe("aguardando_envio"));
  it("pendente sincronizando", () => expect(situacaoSync(g({ sincronizando: true }), pend(1))).toBe("sincronizando"));
  it("erro transitório com pendência", () => expect(situacaoSync(g({ erro: "500" }), pend(1))).toBe("erro"));
});
