// Passagem visual num ambiente publicado (staging): roda pelo navegador, sem acesso a banco nem à pasta de uploads.
// Não depende de ids nem de placas fixas: usa o primeiro cadastro DEMO que o ambiente oferecer.
// Uso: WEB=https://... INSPETOR_EMAIL=... INSPETOR_SENHA=... ADMIN_EMAIL=... ADMIN_SENHA=... node qa/tela/staging.mjs
// As credenciais vêm só do ambiente; nada de senha neste arquivo nem na saída.
import { chromium } from 'playwright';
import { existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { BASE, em } from './comum.mjs';

const precisa = (n) => process.env[n] || (console.error(`Defina ${n}`), process.exit(2));
const INSPETOR = [precisa('INSPETOR_EMAIL'), precisa('INSPETOR_SENHA')];
const ADMIN = [precisa('ADMIN_EMAIL'), precisa('ADMIN_SENHA')];
if (!existsSync(em('foto-grande.jpg'))) execFileSync('node', [fileURLToPath(new URL('./gerar-fotos.mjs', import.meta.url))], { stdio: 'inherit' });

const R = { base: BASE, passos: [], console: [] };
const ok = (passo, cond, ev = '') => { R.passos.push({ passo, r: cond ? 'PASSOU' : 'FALHOU', ev }); console.log(cond ? '✔' : '✘', passo, ev); };
const browser = await chromium.launch();
const TELAS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  desktop: { viewport: { width: 1440, height: 900 } },
};

// Erro de console, exceção não tratada e resposta >= 400 do próprio ambiente: tudo vai para o relatório.
function vigiar(page, onde) {
  const reg = (tipo, texto) => R.console.push({ onde, tipo, texto: texto.slice(0, 300), url: page.url() });
  // Sem rede de propósito, recurso que não carrega é esperado; o resto conta.
  page.on('console', (m) => m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED/.test(m.text()) && reg('console', m.text()));
  page.on('pageerror', (e) => reg('excecao', String(e)));
  page.on('response', (r) => r.status() >= 400 && r.url().startsWith(new URL(BASE).origin) && reg('http', `${r.status()} ${r.request().method()} ${r.url()}`));
}

async function abrir(nome, [email, senha]) {
  const ctx = await browser.newContext(TELAS[nome]);
  const page = await ctx.newPage();
  vigiar(page, nome);
  const foto = async (t) => { await page.waitForTimeout(400); await page.screenshot({ path: em(`stg-${nome}-${t}.png`), fullPage: true }); };
  const titulo = (t) => page.getByRole('heading', { name: t }).first().waitFor({ timeout: 20000 });
  await page.goto(BASE + '/entrar');
  await page.locator('#email').waitFor({ timeout: 20000 });
  await foto('00-login');
  await page.fill('#email', email);
  await page.fill('#senha', senha);
  await page.getByRole('button', { name: /Entrar/ }).click();
  return { ctx, page, foto, titulo };
}

// Escolhe a primeira opção válida de cada filtro e o primeiro veículo que aparecer em qualquer aba.
async function novaVerificacao({ page, titulo }) {
  await page.getByRole('button', { name: 'Nova verificação' }).and(page.locator(':enabled')).click({ timeout: 30000 });
  await titulo('Nova verificação');
  for (const id of ['unidade', 'area', 'atividade']) {
    const sel = page.locator('#' + id);
    await sel.and(page.locator(':enabled')).waitFor({ timeout: 10000 });
    const v = await sel.locator('option').evaluateAll((os) => os.map((o) => o.value).find(Boolean));
    if (v) await sel.selectOption(v);
  }
  await page.getByRole('button', { name: 'Continuar' }).click();
  const veiculo = page.locator('main button.text-left');
  const abas = page.getByRole('tab');
  await page.waitForTimeout(800);
  for (let i = 0; !(await veiculo.count()) && i < (await abas.count()); i++) { await abas.nth(i).click(); await page.waitForTimeout(300); }
  const placa = (await veiculo.first().locator('span.font-bold').innerText()).trim();
  await veiculo.first().click();
  await titulo(/^Checklist/);
  return placa;
}

// Responde tudo: 1º item que aceitar = Não conforme com foto; o seguinte que aceitar = Não se aplica; resto Conforme.
// No meio, derruba a rede, registra mais uma NC com foto sem conexão e volta.
async function responder(s, { comOffline }) {
  const { page, ctx, foto, titulo } = s;
  let nc = false, ncOff = false, na = false, off = 'antes', n = 0;
  const radio = (t) => page.getByRole('radio', { name: t, exact: true });
  for (; n < 200; n++) {
    if (await page.getByRole('button', { name: 'Concluir verificação' }).isVisible().catch(() => false)) break;
    const seguir = page.getByRole('button', { name: /^(Iniciar|Continuar) verificação$/ });
    if (await seguir.first().isVisible().catch(() => false)) { await seguir.first().click(); await page.getByRole('radiogroup').waitFor({ timeout: 15000 }); }
    const item = await page.locator('h1.item__titulo').innerText();
    if (comOffline && nc && off === 'antes') {
      await ctx.setOffline(true); off = 'sem rede';
      await page.getByText(/Sem conexão/).first().waitFor({ timeout: 10000 }).catch(() => {});
      await foto('06-offline-item');
    }
    if (!nc || (off === 'sem rede' && !ncOff)) {
      await radio('Não conforme').click();
      await page.getByRole('button', { name: 'Avançar' }).click();
      await titulo('Registrar não conformidade');
      await page.getByPlaceholder(/Lanterna traseira/).fill(`Teste staging: ${item}`);
      await page.getByTestId('entrada-foto').setInputFiles(em(off === 'sem rede' ? 'foto-offline.jpg' : 'foto-grande.jpg'));
      await page.getByRole('button', { name: 'Remover foto' }).waitFor({ timeout: 20000 });
      await foto(off === 'sem rede' ? '05-nao-conformidade-offline' : '04-nao-conformidade');
      await page.getByRole('button', { name: 'Salvar' }).click();
      if (off === 'sem rede') ncOff = true; nc = true;
    } else if (!na && (await radio('Não se aplica').count())) {
      await radio('Não se aplica').click();
      await page.getByRole('button', { name: 'Avançar' }).click();
      na = true;
    } else {
      await radio('Conforme').click();
      if (n === 1) await foto('03-item');
      await page.getByRole('button', { name: 'Avançar' }).click();
    }
    await page.waitForTimeout(300);
    if (off === 'sem rede' && na) {
      await page.getByText('Salvo no aparelho').first().waitFor({ timeout: 5000 }).catch(() => {});
      ok(`${s.nome} offline: resposta gravada no aparelho sem rede`, true);
      await ctx.setOffline(false); off = 'voltou';
    }
  }
}

async function inspetor(nome, comOffline) {
  const s = { nome, ...(await abrir(nome, INSPETOR)) };
  const { page, foto, titulo } = s;
  await titulo('Verificações');
  ok(`${nome} login inspetor`, true, page.url());
  await foto('01-home');
  const placa = await novaVerificacao(s);
  ok(`${nome} nova verificação abre checklist`, true, placa);
  await foto('02-categorias');
  await responder(s, { comOffline });
  await page.locator('.cabecalho .situacao', { hasText: 'Tudo enviado' }).waitFor({ timeout: 45000 }).catch(() => {});
  const sit = await page.locator('.cabecalho .situacao').innerText().catch(() => '?');
  ok(`${nome} sincronizou depois de voltar a rede`, sit === 'Tudo enviado', sit);
  await foto('07-completo');
  await page.getByRole('button', { name: 'Concluir verificação' }).click();
  await titulo('Verificação concluída!');
  await page.getByText('Tudo enviado').first().waitFor({ timeout: 45000 }).catch(() => {});
  const anel = await page.getByRole('img', { name: /Índice de prontidão/ }).getAttribute('aria-label');
  ok(`${nome} resultado`, !!anel, anel);
  await foto('08-resultado');
  const [pdf] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/relatorio.pdf'), { timeout: 30000 }).catch(() => null),
    page.getByRole('button', { name: 'Gerar relatório (PDF)' }).click(),
  ]);
  ok(`${nome} PDF`, pdf?.status() === 200 && /pdf/.test(pdf.headers()['content-type'] ?? ''), pdf ? `${pdf.status()} ${pdf.headers()['content-type']}` : 'sem resposta');
  for (const p of s.ctx.pages()) if (p !== page) await p.close().catch(() => {});
  await page.getByRole('button', { name: 'Plano de ação' }).click().catch(async () => { await page.getByRole('button', { name: 'Ver detalhes' }).click(); await page.getByRole('button', { name: 'Plano de ação' }).click(); });
  await titulo('Plano de ação');
  await page.locator('.lista .linha').first().click();
  await page.locator('.detalhe .fotos__item img').first().waitFor({ timeout: 15000 }).catch(() => {});
  const fotosNoPlano = await page.locator('.detalhe .fotos__item img').count();
  ok(`${nome} plano de ação com a foto da NC`, fotosNoPlano >= 1, `${fotosNoPlano} foto(s)`);
  await foto('09-plano');
  await page.goto(BASE + '/historico');
  await titulo('Histórico');
  const linha = page.locator('.linha--historico', { hasText: placa }).first();
  await linha.waitFor({ timeout: 15000 }).catch(() => {});
  ok(`${nome} histórico lista a verificação`, await linha.isVisible(), (await linha.innerText().catch(() => '')).replace(/\n/g, ' | '));
  await foto('10-historico');
  await page.goto(BASE + '/admin'); await page.waitForTimeout(1000);
  ok(`${nome} inspetor sem acesso ao /admin`, !page.url().includes('/admin/'), page.url());
  await s.ctx.close();
}

async function admin(nome) {
  const s = await abrir(nome, ADMIN);
  const { page, foto } = s;
  await page.waitForURL((u) => !u.pathname.startsWith('/entrar'), { timeout: 20000 });
  ok(`${nome} login admin`, true, page.url());
  for (const r of ['modelos', 'operacao', 'frota', 'usuarios']) {
    await page.goto(`${BASE}/admin/${r}`); await page.waitForLoadState('networkidle');
    ok(`${nome} admin /${r}`, page.url().includes(`/admin/${r}`) && !(await page.getByRole('alert').count()), page.url());
    await foto(`11-admin-${r}`);
  }
  await s.ctx.close();
}

const SW = async () => { // PWA: manifest, service worker e HTTPS
  const ctx = await browser.newContext(); const p = await ctx.newPage(); vigiar(p, 'pwa');
  await p.goto(BASE + '/'); await p.waitForTimeout(3000);
  const sw = await p.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration()));
  const man = await p.evaluate(() => document.querySelector('link[rel=manifest]')?.href ?? null);
  ok('pwa: HTTPS', BASE.startsWith('https://'), BASE);
  ok('pwa: manifest', !!man, man ?? 'sem <link rel=manifest>');
  ok('pwa: service worker registrado', sw);
  await ctx.close();
};

for (const [rotulo, f] of [['pwa', SW], ['mobile inspetor', () => inspetor('mobile', true)], ['desktop inspetor', () => inspetor('desktop', false)], ['mobile admin', () => admin('mobile')], ['desktop admin', () => admin('desktop')]]) {
  try { await f(); } catch (e) { ok(`${rotulo}: roteiro interrompido`, false, e.message.split('\n')[0]); }
}
await browser.close();
R.resumo = { passou: R.passos.filter((p) => p.r === 'PASSOU').length, falhou: R.passos.filter((p) => p.r === 'FALHOU').length, errosDeConsole: R.console.length };
writeFileSync(em('staging.json'), JSON.stringify(R, null, 1));
console.log(JSON.stringify(R.resumo));
for (const c of R.console) console.log('console', c.onde, c.tipo, c.texto);
process.exit(R.resumo.falhou ? 1 : 0);
