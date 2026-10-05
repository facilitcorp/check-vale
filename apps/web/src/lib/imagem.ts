/**
 * Reduz a foto antes de guardar no aparelho: sinal em área de mina é fraco.
 * Lado maior até 1600 px, JPEG com qualidade decrescente até caber em ~300 KB.
 * Sem suporte a canvas (ou se piorar o tamanho), devolve o original.
 */
export const LIMITE_FOTO_BYTES = 300 * 1024;
const LADO_MAXIMO = 1600;

export async function comprimirFoto(arquivo: Blob): Promise<Blob> {
  if (arquivo.size <= LIMITE_FOTO_BYTES && arquivo.type === "image/jpeg") return arquivo;
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") return arquivo;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    return arquivo;
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * escala), Math.round(bitmap.height * escala));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let melhor: Blob = arquivo;
  for (const quality of [0.82, 0.7, 0.6, 0.5]) {
    const jpg = await canvas.convertToBlob({ type: "image/jpeg", quality });
    if (jpg.size < melhor.size) melhor = jpg;
    if (jpg.size <= LIMITE_FOTO_BYTES) break;
  }
  return melhor;
}
