import { Storage } from "@google-cloud/storage";
import { CHAVE_VALIDA, type Armazenamento } from "./armazenamento";

/** Fotos num bucket do Cloud Storage (credencial = conta de serviço do ambiente). */
export function armazenamentoBucket(nome: string, prefixo = ""): Armazenamento {
  const bucket = new Storage().bucket(nome);
  const arquivo = (chave: string) => {
    if (!CHAVE_VALIDA.test(chave)) throw new Error(`chave inválida: ${chave}`);
    return bucket.file(prefixo ? `${prefixo.replace(/\/+$/, "")}/${chave}` : chave);
  };
  return {
    async salvar(chave, conteudo) {
      await arquivo(chave).save(conteudo, { resumable: false });
    },
    async ler(chave) {
      try {
        const [conteudo] = await arquivo(chave).download();
        return conteudo;
      } catch (e) {
        if ((e as { code?: number }).code === 404) return null;
        throw e;
      }
    },
  };
}
