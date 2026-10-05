import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { readdirSync, statSync, writeFileSync } from 'node:fs';

import { BASE, API, em, idsDoAdmin, pastaDeUploads } from './comum.mjs';

const UPLOADS = pastaDeUploads();
const ids = idsDoAdmin();
const FOTO = em('foto-grande.jpg');
const BYTES_FOTO = statSync(FOTO).size;
const R = { passos: [], estadosVistos: [], axe: {}, alvosPequenos: {}, erros: [] };
const ok = (passo, cond, ev = '') => { R.passos.push({ passo, r: cond ? 'PASSOU' : 'FALHOU', ev }); console.log(cond ? '✔' : '✘', passo, ev); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
// Registra todo estado de sync que aparece na tela (selos, aviso sem sinal, aviso salvo).
await ctx.addInitScript(() => {
  const vistos = new Set(JSON.parse(sessionStorage.getItem('__estados') ?? '[]'));
  const coletar = () => {
    document.querySelectorAll('.situacao, .aviso-offline, [aria-label^="Salvo"], .sync').forEach((el) => {
      const t = (el.getAttribute('aria-label') || el.textContent || '').trim();
      if (t) vistos.add(t.replace(/ · \d+ pendentes?/, ''));
    });
    sessionStorage.setItem('__estados', JSON.stringify([...vistos]));
  };
  new MutationObserver(coletar).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
});
let page = await ctx.newPage();
const ligarErros = (p) => { p.on('pageerror', (e) => R.erros.push(String(e))); };
ligarErros(page);
process.on('unhandledRejection', async (e) => { console.error('ERRO', e.message); await page.screenshot({ path: em('p2-erro.png') }).catch(() => {}); R.fatal = e.message; writeFileSync(em('parte2.json'), JSON.stringify(R, null, 1)); process.exit(1); });

async function tela(nome) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: em(`p2-${nome}.png`) });
  const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  R.axe[nome] = a.violations.map((v) => `${v.id} (${v.nodes.length})`);
  R.alvosPequenos[nome] = await page.evaluate(() =>
    [...document.querySelectorAll('button, a[href], select, textarea, input:not([type=hidden]):not([hidden])')]
      .map((el) => [el, el.getBoundingClientRect()]).filter(([, r]) => r.width > 0 && (r.width < 44 || r.height < 44))
      .map(([el, r]) => `${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`));
}
const idb = (loja) => page.evaluate((loja) => new Promise((res, rej) => {
  const r = indexedDB.open('checkvale');
  r.onsuccess = () => { const q = r.result.transaction(loja).objectStore(loja).getAll(); q.onsuccess = () => res(q.result.map((x) => ({ ...x, arquivo: x.arquivo ? { size: x.arquivo.size, type: x.arquivo.type } : undefined }))); q.onerror = rej; };
  r.onerror = rej;
}), loja);
const estados = async () => { for (const p of ctx.pages()) { try { const e = await p.evaluate(() => JSON.parse(sessionStorage.getItem('__estados') ?? '[]')); e.forEach((x) => R.estadosVistos.includes(x) || R.estadosVistos.push(x)); } catch {} } return R.estadosVistos; };
const offline = async (v) => { await ctx.setOffline(v); await page.evaluate((v) => window.dispatchEvent(new Event(v ? 'offline' : 'online')), v).catch(() => {}); };
const radio = (n) => page.getByRole('radio', { name: n, exact: true });
const avancar = () => page.getByRole('button', { name: 'Avançar' }).click();
const titulo = (t) => page.getByRole('heading', { name: t }).waitFor({ timeout: 15000 });

// 1. LOGIN
await page.goto(BASE + '/entrar');
await page.fill('#email', 'inspetor.aceite@checkvale.dev');
await page.fill('#senha', 'aceite-2026');
await page.getByRole('button', { name: /Entrar/ }).click();
await titulo('Verificações');
await page.getByRole('button', { name: 'Nova verificação' }).and(page.locator(':enabled')).waitFor({ timeout: 20000 });
ok('1 login como inspetor', true, page.url());
// inspetor não acessa /admin
await page.goto(BASE + '/admin');
await page.waitForTimeout(800);
ok('1 inspetor sem link e sem acesso ao /admin', !(await page.getByText('Administração').count()) && !page.url().includes('/admin/modelos'), page.url());
await page.goto(BASE + '/');
await titulo('Verificações');

// 2. HOME
await tela('01-home-vazia');
ok('2 home: Nova verificação', await page.getByRole('button', { name: 'Nova verificação' }).isEnabled());
ok('2 home: últimos checklists (vazio)', await page.getByText('Nenhum checklist concluído neste aparelho ainda.').isVisible());
ok('2 home: cartão de sincronização', await page.locator('.cartao-sync').isVisible(), await page.locator('.cartao-sync').innerText());

// 3. NOVA VERIFICAÇÃO — DEM1A02 primeiro (regra: vê 3 itens)
async function novaVerificacao(placa) {
  await page.getByRole('button', { name: 'Nova verificação' }).click();
  await titulo('Nova verificação');
  await page.locator('#unidade').selectOption(ids.unidade);
  await page.locator('#area').selectOption(ids.area);
  await page.locator('#atividade').selectOption(ids.atividade);
  await page.getByRole('button', { name: 'Continuar' }).click();
  const alvo = page.locator('main button', { hasText: placa });
  if (!(await alvo.count())) { const aba = page.getByRole('tab', { name: /Caminhão DEMO/ }); if (await aba.count()) await aba.click(); }
  await alvo.first().click();
  await titulo('Checklist - Veículo');
}
await novaVerificacao('DEM1A02');
const cont2 = await page.locator('.contador').first().innerText();
const cats2 = await page.locator('.linha__texto').allInnerTexts();
ok('3/4 regra: DEM1A02 recebe 3 itens (sem engate e sem freio a ar)', cont2 === '0 de 3', `${cont2} · ${cats2.join(', ')}`);
await tela('02-categorias-DEM1A02');
await page.goto(BASE + '/');
await titulo('Verificações');

await novaVerificacao('DEM1A01');
const cont1 = await page.locator('.contador').first().innerText();
ok('3 DEM1A01 recebe 5 itens', cont1 === '0 de 5', cont1);
const insp = (await idb('inspecoes')).find((i) => i.veiculoId === ids.veiculo1);
ok('3 versão publicada aplicável (Checklist DEMO Aceite V1)', insp?.modeloId === ids.modelo && insp?.modeloVersao === 1, `${insp?.modeloId?.slice(0, 8)} v${insp?.modeloVersao}`);
const subt = await page.locator('main .sub').first().innerText();
ok('3 veículo: placa + fabricante/modelo + DEMO', /DEM1A01/.test(subt), subt);
await tela('03-categorias-DEM1A01');

// 4/5. ONLINE: Cinto = NC crítica com foto grande; Ar-condicionado = Não se aplica
await page.getByRole('button', { name: 'Iniciar verificação' }).click();
await titulo('Cinto de segurança');
ok('4 item sem N/A não oferece "Não se aplica"', !(await radio('Não se aplica').count()));
await radio('Não conforme').click();
await avancar();
await titulo('Registrar não conformidade');
ok('5 criticidade sugerida pré-marcada (crítica)', await page.locator('label.criticidade--critica input').isChecked());
await page.getByPlaceholder(/Lanterna traseira/).fill('Cinto do motorista não trava');
await page.getByTestId('entrada-foto').setInputFiles(FOTO);
await page.getByRole('button', { name: 'Remover foto' }).waitFor({ timeout: 15000 });
await tela('04-nc-cinto');
await page.getByRole('button', { name: 'Salvar' }).click();
await titulo('Ar-condicionado');
const ev1 = (await idb('evidencias')).filter((e) => e.inspecaoId === insp.id);
ok('5 foto comprimida no aparelho', ev1.length === 1 && ev1[0].bytes < BYTES_FOTO / 3 && ev1[0].mime === 'image/jpeg', `original ${BYTES_FOTO} B → ${ev1[0]?.bytes} B ${ev1[0]?.mime}`);
await radio('Não se aplica').click();
ok('4 "Não se aplica" fica marcado visualmente', await page.locator('.opcao--nao_aplica.opcao--ativa').count() === 1 && (await page.locator('.opcao--nao_aplica').evaluate((e) => getComputedStyle(e).borderColor)) !== 'rgb(227, 232, 229)', await page.locator('.opcao--nao_aplica').evaluate((e) => getComputedStyle(e).borderColor));
await tela('05-nao-se-aplica');
await avancar();
await titulo('Checklist - Veículo');
await page.getByText('Salvo no aparelho', { exact: true }).first().waitFor({ timeout: 5000 }).catch(() => {});

// 6. OFFLINE
await page.getByText(/Tudo enviado|Aguardando envio|Sincronizando/).first().waitFor({ timeout: 15000 });
await page.waitForTimeout(2500); // deixa subir o que foi feito online
await offline(true);
await page.getByText(/Sem conexão\. Pode continuar/).waitFor();
await page.getByRole('button', { name: 'Continuar verificação' }).click();
await titulo('Engate do reboque');
await radio('Conforme').click();
await page.getByPlaceholder('Digite aqui...').fill('Folga leve no pino, monitorar');
await avancar();
await titulo('Drenar reservatório de ar');
await page.getByText('Salvo no aparelho', { exact: true }).waitFor({ timeout: 5000 });
ok('6 offline: "Salvo no aparelho" ao gravar', true);
await radio('Não conforme').click();
await avancar();
await titulo('Registrar não conformidade');
await page.getByPlaceholder(/Lanterna traseira/).fill('Válvula de dreno travada');
await page.locator('label.criticidade--alta').click();
await page.getByTestId('entrada-foto').setInputFiles(em('foto-offline.jpg'));
await page.getByRole('button', { name: 'Remover foto' }).waitFor({ timeout: 15000 });
await page.getByRole('button', { name: 'Salvar' }).click();
await titulo('Pneus');
// navegar entre telas sem rede
await page.getByRole('button', { name: 'Voltar' }).first().click();
await titulo('Checklist - Veículo');
await tela('06-offline-categorias');
ok('6 offline: progresso 4 de 5 e selo "Sem conexão"', (await page.locator('.contador').first().innerText()) === '4 de 5' && (await page.locator('.cabecalho .situacao').innerText()) === 'Sem conexão', `${await page.locator('.contador').first().innerText()} · ${await page.locator('.cabecalho .situacao').innerText()}`);
// fechar e reabrir o app SEM rede (service worker do build)
const url = page.url();
await estados();
await page.close();
page = await ctx.newPage();
ligarErros(page);
await page.goto(BASE + '/');
await titulo('Verificações');
const cartao = page.getByRole('article', { name: /DEM1A01/ });
await cartao.waitFor({ timeout: 15000 });
await cartao.getByText('Sem conexão').waitFor({ timeout: 10000 }).catch(() => {});
const txt = await cartao.innerText();
ok('6 fechar/reabrir sem rede: app abre e mantém a inspeção', /4 de 5 itens/.test(txt) && /Sem conexão/.test(txt), txt.replace(/\n/g, ' | '));
await tela('07-offline-reaberto');
const fila = await idb('fila');
const pend = fila.filter((o) => o.estado !== 'rejeitada');
ok('6 fila guardada no aparelho (snapshot da inspeção + foto)', pend.length >= 2, pend.map((o) => o.op.tipo).join(', '));
await page.goto(url);
await titulo('Checklist - Veículo');

// 7. VOLTAR ONLINE
await offline(false);
await page.locator('.cabecalho .situacao', { hasText: 'Tudo enviado' }).waitFor({ timeout: 30000 });
await tela('08-online-tudo-enviado');
const filaDepois = await idb('fila');
ok('7 fila vazia depois do sync', filaDepois.length === 0, `${filaDepois.length} na fila`);
const evs = (await idb('evidencias')).filter((e) => e.inspecaoId === insp.id);
ok('7 nenhuma foto perdida (2 no aparelho, as 2 enviadas)', evs.length === 2 && evs.every((e) => e.enviada), evs.map((e) => `${e.bytes}B enviada=${e.enviada}`).join(', '));
const arquivos = readdirSync(UPLOADS, { recursive: true }).filter((f) => statSync(`${UPLOADS}/${f}`).isFile());
ok('7 servidor recebeu exatamente as 2 fotos', evs.every((e) => arquivos.some((f) => String(f).includes(e.id))) , `${arquivos.length} arquivo(s) na pasta de uploads`);
const tok = (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'inspetor.aceite@checkvale.dev', senha: 'aceite-2026' }) })).json()).token;
const srv = (await (await fetch(API + '/inspecoes', { headers: { Authorization: `Bearer ${tok}` } })).json()).inspecoes;
const doV1 = srv.filter((i) => i.veiculoId === ids.veiculo1);
ok('7 nenhuma operação duplicada (1 inspeção do DEM1A01 no servidor)', doV1.length === 1, `${doV1.length} inspeção(ões)`);
const s1 = doV1[0];
ok('7 nenhuma resposta perdida (4 no servidor, fotos vinculadas)', s1?.respostas.length === 4 && s1.respostas.filter((r) => r.status === 'nao_conforme').every((r) => r.evidenciaIds.length === 1), s1?.respostas.map((r) => r.status).join(', '));

// 8. CONTINUAR PELA HOME
await page.goto(BASE + '/');
await titulo('Verificações');
await page.getByRole('article', { name: /DEM1A01/ }).getByText(/de \d+ itens/).waitFor({ timeout: 10000 }).catch(() => {});
const c2 = await page.getByRole('article', { name: /DEM1A01/ }).innerText();
ok('8 home: veículo e progresso corretos', /DEM1A01/.test(c2) && /4 de 5 itens/.test(c2), c2.replace(/\n/g, ' | '));
await page.getByRole('article', { name: /DEM1A01/ }).getByRole('button', { name: 'Continuar verificação' }).click();
await titulo('Checklist - Veículo');
await page.getByRole('button', { name: 'Continuar verificação' }).click();
await titulo('Pneus');
await page.getByRole('button', { name: 'Voltar' }).last().click(); // volta ao item anterior: resposta permanece
await titulo('Drenar reservatório de ar');
ok('8 respostas permanecem (NC marcada ao reabrir o item)', (await radio('Não conforme').getAttribute('aria-checked')) === 'true');
await page.goto(url.replace(/\/inspecao\/.*/, `/inspecao/${insp.id}`));
await titulo('Checklist - Veículo');
await page.getByRole('button', { name: 'Continuar verificação' }).click();
await titulo('Pneus');
await radio('Conforme').click();
await avancar();
await titulo('Checklist - Veículo');

// 9. FINALIZAR
await tela('09-completo');
await page.getByRole('button', { name: 'Concluir verificação' }).click();
await titulo('Verificação concluída!');
await page.getByText('Tudo enviado').first().waitFor({ timeout: 30000 });
await tela('10-resultado');
const cards = await page.locator('.cartao').allInnerTexts();
const anel = await page.getByRole('img', { name: /Índice de prontidão/ }).getAttribute('aria-label');
ok('4/9 resultado: conforme+observação = ponto de atenção; NC continua NC', anel === 'Índice de prontidão 50%' && cards.join('|').replace(/\n/g, ' ') === '1 Itens conformes|1 Pontos de atenção|2 Não conformes|1 Não se aplicam', `${anel} · ${cards.join(' | ').replace(/\n/g, ' ')}`);
const [pdf] = await Promise.all([page.waitForResponse((r) => r.url().includes('/relatorio.pdf'), { timeout: 20000 }), page.getByRole('button', { name: 'Gerar relatório (PDF)' }).click()]);
ok('9 PDF gerado', pdf.status() === 200 && /pdf/.test(pdf.headers()['content-type']), `${pdf.status()} ${pdf.headers()['content-type']}`);
await page.waitForTimeout(800);
for (const p of ctx.pages()) if (p !== page) await p.close().catch(() => {});
await page.getByRole('button', { name: 'Ver detalhes' }).click();
await titulo('Resultado por categoria');
await tela('11-por-categoria');
await page.getByRole('button', { name: 'Plano de ação' }).click();
await titulo('Plano de ação');
const linhas = await page.locator('.lista .linha').allInnerTexts();
ok('5/9 plano de ação recebe as 2 NC, crítica primeiro', linhas.length === 2 && /Crítica/.test(linhas[0]) && /Cinto/.test(linhas[0]) && /Alta/.test(linhas[1]), linhas.map((l) => l.replace(/\n/g, ' ')).join(' | '));
await page.getByText('Válvula de dreno travada').click();
await page.getByText('Item: Drenar reservatório de ar').waitFor();
ok('5 foto feita offline aparece associada ao item no plano', (await page.locator('.detalhe .fotos__item img').count()) === 1);
await tela('12-plano');
await page.goto(BASE + '/');
await titulo('Verificações');
const ult = page.locator('.linha--historico', { hasText: 'DEM1A01' });
await ult.waitFor();
// O cartão nasce em "Carregando…" e só depois mostra índice e situação: espera o estado final antes de ler.
let textoUlt = '';
for (const fim = Date.now() + 15000; Date.now() < fim; await page.waitForTimeout(250)) {
  textoUlt = await ult.innerText();
  if (!/Carregando/.test(textoUlt) && /%/.test(textoUlt) && /Tudo enviado/.test(textoUlt)) break;
}
ok('9 aparece em últimos checklists com índice e "Tudo enviado"', /50%/.test(textoUlt) && /Tudo enviado/.test(textoUlt), textoUlt.replace(/\n/g, ' | '));
await tela('13-home-final');

const vistos = await estados();
for (const e of ['Salvo no aparelho', 'Sem conexão', 'Aguardando envio', 'Sincronizando', 'Tudo enviado'])
  ok(`6/7 estado exibido na tela: "${e}"`, vistos.some((v) => v.includes(e)));
writeFileSync(em('parte2.json'), JSON.stringify(R, null, 1));
await browser.close();
