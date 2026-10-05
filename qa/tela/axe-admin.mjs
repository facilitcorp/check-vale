// axe WCAG 2.1 AA nas 7 telas do Admin, em desktop e celular (14 análises). Sai com 1 se houver violação ou erro de console.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';
import { BASE, em, idsDoAdmin } from './comum.mjs';

const ids = idsDoAdmin();
const ADMIN = process.env.ADMIN_EMAIL ?? 'admin@checkvale.dev';
const SENHA = process.env.ADMIN_SENHA ?? 'checkvale'; // senha da semente local (docs/ARQUITETURA.md)
const b = await chromium.launch(); const out = {}; const erros = [];
for (const [vp, nome] of [[{ width: 1280, height: 800 }, 'desktop'], [{ width: 390, height: 844 }, 'mobile']]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 }); const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  const axe = async (t) => {
    await p.waitForTimeout(800);
    const a = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    out[nome + ':' + t] = a.violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
    await p.screenshot({ path: em(`adm-${nome}-${t}.png`) });
  };
  await p.goto(BASE + '/'); await p.locator('#email').waitFor(); await axe('login');
  await p.fill('#email', ADMIN); await p.fill('#senha', SENHA); await p.keyboard.press('Enter'); await p.locator('#email').waitFor({ state: 'detached', timeout: 20000 }); // login cai em /, como para todos
  for (const r of ['modelos', 'operacao', 'frota', 'usuarios']) { await p.goto(BASE + '/admin/' + r); await p.waitForLoadState('networkidle'); await axe(r); }
  await p.goto(BASE + '/admin/frota'); await p.waitForLoadState('networkidle'); await p.getByRole('button', { name: 'Editar' }).first().click(); await p.getByRole('form', { name: /^Editar/ }).waitFor({ timeout: 5000 }); await axe('frota-editar');
  await p.goto(`${BASE}/admin/modelos/${ids.modelo}/v/1`); await p.waitForLoadState('networkidle'); await axe('editor-v1');
  await ctx.close();
}
await b.close();
const violacoes = Object.entries(out).filter(([, v]) => v.length);
writeFileSync(em('axe-admin.json'), JSON.stringify({ telas: out, erros }, null, 1));
console.log(`${Object.keys(out).length} telas, ${violacoes.length} com violação, ${erros.length} erro(s) de console`);
for (const [t, v] of violacoes) console.log('✘', t, v.join(' ; '));
process.exit(violacoes.length || erros.length ? 1 : 0);
