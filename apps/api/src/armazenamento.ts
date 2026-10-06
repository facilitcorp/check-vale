import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Onde as fotos ficam. MVP: disco local. Em nuvem, implementar a mesma interface sobre bucket. */
export interface Armazenamento {
  salvar(chave: string, conteudo: Buffer): Promise<void>;
  ler(chave: string): Promise<Buffer | null>;
}

export const CHAVE_VALIDA = /^[a-z0-9-]+(\/[a-z0-9.-]+)*$/;

export function armazenamentoLocal(dir: string): Armazenamento {
  const raiz = path.resolve(dir);
  const caminho = (chave: string) => {
    if (!CHAVE_VALIDA.test(chave)) throw new Error(`chave inválida: ${chave}`);
    return path.join(raiz, chave);
  };
  return {
    async salvar(chave, conteudo) {
      const p = caminho(chave);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, conteudo);
    },
    async ler(chave) {
      try {
        return await readFile(caminho(chave));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
  };
}

export function armazenamentoMemoria(): Armazenamento {
  const m = new Map<string, Buffer>();
  return { salvar: async (k, c) => void m.set(k, c), ler: async (k) => m.get(k) ?? null };
}
