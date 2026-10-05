// Gera as fotos de teste (JPEG grande, acima de 1 MB) usadas pela Parte 2 para provar a compressão no aparelho.
// Imagem com cara de foto (gradiente, formas e grão leve). Ruído puro não serve: nenhuma câmera produz isso,
// e nem com qualidade 0,5 ele cabe no limite, o que reprovaria o verificador por um motivo artificial.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { em } from './comum.mjs';

const b = await chromium.launch();
const p = await b.newPage();
for (const [nome, w, h] of [['foto-grande.jpg', 4000, 3000], ['foto-offline.jpg', 3000, 2250]]) {
  const b64 = await p.evaluate(([w, h]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, w, h); grad.addColorStop(0, '#5a6b7c'); grad.addColorStop(0.5, '#a08a6a'); grad.addColorStop(1, '#2f3a2a');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 400; k++) { g.fillStyle = `hsla(${(k * 37) % 360},35%,${30 + (k % 40)}%,0.35)`; g.beginPath(); g.arc((k * 7919) % w, (k * 104729) % h, 20 + (k % 180), 0, 7); g.fill(); }
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) { const v = (Math.random() - 0.5) * 24; img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v; }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.95).split(',')[1];
  }, [w, h]);
  writeFileSync(em(nome), Buffer.from(b64, 'base64'));
  console.log(nome, Buffer.from(b64, 'base64').length, 'B');
}
await b.close();
