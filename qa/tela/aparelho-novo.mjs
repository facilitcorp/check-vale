// Aparelho novo (IndexedDB vazio): toda inspeção do inspetor abre na versão exata em que foi feita,
// sem nenhum "Checklist indisponível". Rodar depois da Parte 3, que deixa inspeções em V1 com o catálogo na V3.
// A rota de versões é atrasada (ATRASO_VERSOES_MS, padrão 3000) para simular sinal fraco: sem isso a janela
// entre "inspeções gravadas" e "versões baixadas" dura milissegundos e o roteiro só pegaria o problema por sorte.
import { chromium } from 'playwright';
import { BASE, em } from './comum.mjs';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const ATRASO = Number(process.env.ATRASO_VERSOES_MS ?? 3000);
await p.route(/\/api\/catalogo\/modelos\/[^/]+\/versoes\//, async (r) => { await new Promise((s) => setTimeout(s, ATRASO)); await r.continue(); });
// Registra todo texto de cartão que aparece, não só o final: o aviso falso some sozinho quando a versão chega.
await ctx.addInitScript(() => {
  window.__indisp = 0;
  new MutationObserver(() => { for (const c of document.querySelectorAll('.cartao-inspecao')) if (/indispon/i.test(c.textContent ?? '')) window.__indisp++; })
    .observe(document, { subtree: true, childList: true, characterData: true });
});
await p.goto(BASE + '/'); await p.fill('#email', 'inspetor.aceite@checkvale.dev'); await p.fill('#senha', 'aceite-2026'); await p.keyboard.press('Enter');
await p.locator('.cartao-inspecao').first().waitFor({ timeout: 20000 });
// Espera o sync baixar as versões que faltam: todo cartão com "N de M itens".
let cartoes = [];
for (const fim = Date.now() + 20000 + 4 * ATRASO; Date.now() < fim; await p.waitForTimeout(500)) {
  cartoes = await Promise.all((await p.locator('.cartao-inspecao').all()).map(async (c) => (await c.innerText()).replace(/\n/g, ' | ')));
  if (cartoes.length && cartoes.every((t) => /\d+ de \d+ itens/.test(t))) break;
}
const viuIndisp = await p.evaluate(() => window.__indisp);
const dados = await p.evaluate(() => new Promise((r) => { const q = indexedDB.open('checkvale'); q.onsuccess = () => { const t = q.result.transaction(['inspecoes', 'modelos']); const a = t.objectStore('inspecoes').getAll(); const m = t.objectStore('modelos').getAllKeys(); t.oncomplete = () => r({ insp: a.result.map((i) => [i.id.slice(0, 8), i.modeloVersao, i.status, i.respostas?.length]), modelos: m.result }); }; }));
await p.screenshot({ path: em('aparelho-novo.png'), fullPage: true });
await b.close();
for (const c of cartoes) console.log('cartão:', c);
console.log(JSON.stringify(dados));
const abertos = cartoes.filter((t) => /\d+ de \d+ itens/.test(t)).length;
const ok = cartoes.length > 0 && abertos === cartoes.length && viuIndisp === 0;
console.log(ok ? '✔' : '✘', `${abertos}/${cartoes.length} cartões abertos na versão da inspeção; "indisponível" visto ${viuIndisp} vez(es) (versões atrasadas ${ATRASO} ms)`);
process.exit(ok ? 0 : 1);
