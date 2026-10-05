/**
 * Reduz a foto antes de guardar: foto de celular tem 4–8 MB e o sinal na
 * mina é fraco. 1600 px no maior lado em JPEG 0,8 fica em ~300 KB e ainda
 * mostra o defeito com nitidez. Se o navegador não suportar, guarda a original.
 */
export async function comprimirImagem(arquivo: Blob, ladoMaximo = 1600, qualidade = 0.8): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return arquivo;
  try {
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) return arquivo;
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', qualidade));
    return blob && blob.size < arquivo.size ? blob : arquivo;
  } catch {
    return arquivo;
  }
}
