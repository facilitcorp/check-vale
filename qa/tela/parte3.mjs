import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';

import { BASE, API, em, idsDoAdmin } from './comum.mjs';

const ids = idsDoAdmin();
const R = { passos: [], obs: [], axe: {}, erros: [] };
const ok = (passo, cond, ev = '') => { R.passos.push({ passo, r: cond ? 'PASSOU' : 'FALHOU', ev }); console.log(cond ? '✔' : '✘', passo, ev); };
const obs = (t) => { R.obs.push(t); console.log('ℹ', t); };

// ---- API (admin) ----
async function login(email, senha) {
  const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) });
  return (await r.json()).token;
}
const ADM = await login('admin@checkvale.dev', 'checkvale');
async function req(metodo, caminho, corpo, tok = ADM) {
  const r = await fetch(API + caminho, { method: metodo, headers: { Authorization: `Bearer ${tok}`, ...(corpo ? { 'content-type': 'application/json' } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
}
const V1 = (await req('GET', `/admin/modelos/${ids.modelo}/versoes/1`)).j;
const itemV1 = (cod) => V1.categorias.flatMap((c) => c.itens).find((i) => i.codigo === cod);

// ---- navegador ----
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
let page = await ctx.newPage();
const ligar = (p) => { p.on('pageerror', (e) => R.erros.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) R.erros.push(m.text()); }); };
ligar(page);
process.on('unhandledRejection', async (e) => { console.error('ERRO', e.message); await page.screenshot({ path: em('p3-erro.png') }).catch(() => {}); R.fatal = e.message; writeFileSync(em('parte3.json'), JSON.stringify(R, null, 1)); process.exit(1); });
async function tela(nome) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: em(`p3-${nome}.png`) });
  const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  R.axe[nome] = a.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.map((n) => n.target.join(' ') + ' ' + (n.any[0]?.message ?? '')).join(' || ')}`);
}
const idb = (loja) => page.evaluate((loja) => new Promise((res, rej) => {
  const r = indexedDB.open('checkvale');
  r.onsuccess = () => { const q = r.result.transaction(loja).objectStore(loja).getAll(); q.onsuccess = () => res(q.result.map((x) => ({ ...x, arquivo: undefined }))); q.onerror = rej; };
  r.onerror = rej;
}), loja);
const apagarIdb = (loja, chave) => page.evaluate(([loja, chave]) => new Promise((res, rej) => {
  const r = indexedDB.open('checkvale');
  r.onsuccess = () => { const t = r.result.transaction(loja, 'readwrite'); t.objectStore(loja).delete(chave); t.oncomplete = () => res(true); t.onerror = rej; };
}), [loja, chave]);
const offline = async (v) => { await ctx.setOffline(v); await page.evaluate((v) => window.dispatchEvent(new Event(v ? 'offline' : 'online')), v).catch(() => {}); };
const radio = (n) => page.getByRole('radio', { name: n, exact: true });
const titulo = (t, timeout = 15000) => page.getByRole('heading', { name: t, exact: true }).waitFor({ timeout });
const contador = () => page.locator('.contador').first().innerText();
async function home() { await page.goto(BASE + '/'); await titulo('Verificações'); }
async function esperarTudoEnviado() { await page.locator('.cartao-sync .situacao', { hasText: 'Tudo enviado' }).waitFor({ timeout: 30000 }); }
async function novaVerificacao(placa) {
  await page.getByRole('button', { name: 'Nova verificação' }).click();
  await titulo('Nova verificação');
  await page.locator('#unidade').selectOption(ids.unidade);
  await page.locator('#area').selectOption(ids.area);
  await page.locator('#atividade').selectOption(ids.atividade);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.locator('main button', { hasText: placa }).first().click();
  await titulo('Checklist - Veículo');
  return page.url().split('/inspecao/')[1];
}
async function esperarVersao(v) {
  for (let i = 0; i < 60; i++) { if ((await idb('modelos')).some((m) => m.id === ids.modelo && m.versao === v)) return; await page.waitForTimeout(1000); }
  throw new Error(`V${v} não chegou ao aparelho em 60 s`);
}
const abrirItem = async (insp, item) => { await page.goto(`${BASE}/inspecao/${insp}/item/${item}`); };

// LOGIN
await page.goto(BASE + '/entrar');
await page.fill('#email', 'inspetor.aceite@checkvale.dev');
await page.fill('#senha', 'aceite-2026');
await page.getByRole('button', { name: /Entrar/ }).click();
await titulo('Verificações');
await page.getByRole('button', { name: 'Nova verificação' }).and(page.locator(':enabled')).waitFor({ timeout: 20000 });

// 1. VERSIONAMENTO — inspeção A em V1, sem concluir
const A = await novaVerificacao('DEM1A01');
await page.getByRole('button', { name: 'Iniciar verificação' }).click();
await titulo('Cinto de segurança');
await radio('Conforme').click();
await page.getByPlaceholder('Digite aqui...').fill('Fivela com folga');
await page.getByRole('button', { name: 'Avançar' }).click();
await titulo('Ar-condicionado');
await home();
await esperarTudoEnviado();
const insA0 = (await idb('inspecoes')).find((i) => i.id === A);
ok('1 inspeção A iniciada em V1, não concluída', insA0.modeloVersao === 1 && insA0.status === 'em_andamento', `v${insA0.modeloVersao} ${insA0.status} · 1 resposta`);

// admin: V2 a partir do modelo, altera item, publica
const ras = await req('POST', `/admin/modelos/${ids.modelo}/rascunho`);
const v2 = structuredClone(ras.j);
const cab = v2.categorias.find((c) => c.codigo === 'cab');
cab.itens.push({ id: crypto.randomUUID(), codigo: 'extintor', titulo: 'Extintor (V2)', descricao: '', ordem: 5, permiteNaoAplica: false, criticidadeSugerida: 'alta', aplicavel: { tipoVeiculoIds: [], areaIds: [], atividadeIds: [], atributos: [] } });
v2.categorias.find((c) => c.codigo === 'eng').itens.find((i) => i.codigo === 'pneus').titulo = 'Pneus e estepe (V2)';
const put2 = await req('PUT', `/admin/modelos/${ids.modelo}/versoes/${ras.j.versao}`, { nome: v2.nome, aplicavel: v2.aplicavel, categorias: v2.categorias });
const pub2 = await req('POST', `/admin/modelos/${ids.modelo}/versoes/${ras.j.versao}/publicar`);
ok('1 admin: V2 criada a partir do modelo, item alterado e publicada', [200, 201].includes(ras.s) && ras.j.versao === 2 && put2.s === 200 && pub2.s === 200 && pub2.j.status === 'publicada', `rascunho ${ras.s} v${ras.j.versao} · editar ${put2.s} · publicar ${pub2.s}`);
const putV1 = await req('PUT', `/admin/modelos/${ids.modelo}/versoes/1`, { nome: V1.nome, aplicavel: V1.aplicavel, categorias: V1.categorias });
ok('1 V1 imutável depois de publicada', putV1.s === 409, `${putV1.s} ${putV1.j?.mensagem ?? ''}`);

// app recebe V2
await page.reload();
await titulo('Verificações');
await esperarVersao(2);
const versoes = (await idb('modelos')).filter((m) => m.id === ids.modelo).map((m) => m.versao).sort().join(',');
ok('1 aparelho recebeu V2 e manteve V1', versoes === '1,2', `versões no aparelho: ${versoes}`);

// inspeção antiga continua V1
await page.goto(`${BASE}/inspecao/${A}`);
await titulo('Checklist - Veículo');
ok('1 inspeção antiga continua V1 (1 de 5, sem item novo)', (await contador()) === '1 de 5', await contador());
await abrirItem(A, itemV1('pneus').id);
await titulo('Pneus');
ok('1 perguntas não mudam (título V1 "Pneus")', await page.getByRole('heading', { name: 'Pneus', exact: true }).isVisible());
await abrirItem(A, itemV1('cinto').id);
await titulo('Cinto de segurança');
ok('1 respostas permanecem (Cinto: Conforme + observação)', (await radio('Conforme').getAttribute('aria-checked')) === 'true' && (await page.getByPlaceholder('Digite aqui...').inputValue()) === 'Fivela com folga');
await tela('01-inspecao-v1-apos-v2');

// offline: fecha, reabre e responde na V1
await offline(true);
await page.close(); page = await ctx.newPage(); ligar(page);
await page.goto(`${BASE}/inspecao/${A}`);
await titulo('Checklist - Veículo');
await abrirItem(A, itemV1('pneus').id).catch(() => {});
await titulo('Pneus');
await radio('Conforme').click();
await page.getByRole('button', { name: 'Avançar' }).click();
await titulo('Checklist - Veículo');
ok('1 V1 funciona offline (reaberto sem rede, respondeu Pneus)', (await contador()) === '2 de 5', await contador());
await tela('02-v1-offline');
await offline(false);
await home();
await esperarTudoEnviado();

// nova inspeção recebe V2
const B = await novaVerificacao('DEM1A01');
const insB = (await idb('inspecoes')).find((i) => i.id === B);
ok('1 nova inspeção recebe V2 (6 itens, com "Extintor (V2)")', insB.modeloVersao === 2 && (await contador()) === '0 de 6', `v${insB.modeloVersao} · ${await contador()}`);
await tela('03-nova-v2');

// 2. SNAPSHOT — altera veículo, atributos e template depois
const vAntes = (await req('GET', '/admin/veiculos')).j.find((v) => v.id === ids.veiculo1);
const pv = await req('PATCH', `/admin/veiculos/${ids.veiculo1}`, { modelo: 'FH 460 (alterado)', atributos: { ...vAntes.atributos, possui_reboque: false, freio_demo: 'hidraulico' } });
const ras3 = await req('POST', `/admin/modelos/${ids.modelo}/rascunho`);
const v3 = structuredClone(ras3.j);
v3.categorias.find((c) => c.codigo === 'cab').itens.find((i) => i.codigo === 'cinto').titulo = 'Cinto de segurança (V3)';
await req('PUT', `/admin/modelos/${ids.modelo}/versoes/${ras3.j.versao}`, { nome: v3.nome, aplicavel: v3.aplicavel, categorias: v3.categorias });
const pub3 = await req('POST', `/admin/modelos/${ids.modelo}/versoes/${ras3.j.versao}/publicar`);
ok('2 admin alterou veículo, atributos e publicou V3', pv.s === 200 && pub3.s === 200, `veículo ${pv.s} · V3 ${pub3.s}`);
await home();
await esperarVersao(3);
const insA1 = (await idb('inspecoes')).find((i) => i.id === A);
ok('2 inspeção antiga mantém versão e retrato do veículo', insA1.modeloVersao === 1 && insA1.atributosVeiculo.possui_reboque === true && insA1.atributosVeiculo.freio_demo === 'ar', `v${insA1.modeloVersao} · reboque=${insA1.atributosVeiculo.possui_reboque} freio=${insA1.atributosVeiculo.freio_demo}`);
await page.goto(`${BASE}/inspecao/${A}`);
await titulo('Checklist - Veículo');
ok('2 inspeção antiga: mesmos 5 itens e respostas (engate continua)', (await contador()) === '2 de 5', await contador());
await abrirItem(A, itemV1('cinto').id);
await titulo('Cinto de segurança');
ok('2 inspeção antiga: pergunta não muda com V3', true, 'título "Cinto de segurança"');
const tok = await login('inspetor.aceite@checkvale.dev', 'aceite-2026');
const srvA = (await req('GET', '/inspecoes', null, tok)).j.inspecoes.find((i) => i.id === A);
ok('2 servidor: inspeção antiga sem mudança (v1, retrato, 2 respostas)', srvA.modeloVersao === 1 && srvA.atributosVeiculo.possui_reboque === true && srvA.respostas.length === 2, `v${srvA.modeloVersao} · ${srvA.respostas.length} respostas`);
await page.goto(`${BASE}/inspecao/${A}`);
await titulo('Checklist - Veículo');
const sub = await page.locator('main .sub').first().innerText();
if (/alterado/.test(sub)) obs(`2 nome do veículo na inspeção antiga vem do cadastro atual: "${sub}" (a inspeção guarda o retrato de tipo e atributos, não de fabricante e modelo)`);
await tela('04-snapshot');
await home();
const C = await novaVerificacao('DEM1A01');
ok('2 nova inspeção usa o veículo atual (sem reboque e sem freio a ar → 4 itens, V3)', (await contador()) === '0 de 4', await contador());

// 4. ERRO REAL DE SYNC — placa duplicada
await home();
await esperarTudoEnviado();
await offline(true);
const vDup = await req('POST', '/admin/veiculos', { codigo: null, tipoVeiculoId: vAntes.tipoVeiculoId, fabricante: 'Scania', modelo: 'R450', descricao: 'Admin', empresa: null, unidadeId: ids.unidade, status: 'ativo', placa: 'DEM1A09', atributos: { cor_cabine: 'azul', eixos: 2, possui_reboque: false, freio_demo: 'ar' } });
await page.getByRole('button', { name: 'Nova verificação' }).click();
await titulo('Nova verificação');
await page.locator('#unidade').selectOption(ids.unidade);
await page.locator('#area').selectOption(ids.area);
await page.locator('#atividade').selectOption(ids.atividade);
await page.getByRole('button', { name: 'Continuar' }).click();
await page.getByRole('button', { name: 'Cadastrar novo veículo' }).click();
await titulo('Cadastrar veículo');
await page.locator('#tipo').selectOption(vAntes.tipoVeiculoId);
await page.fill('#placa', 'DEM1A09');
await page.fill('#fabricante', 'Mercedes');
await page.fill('#modelo', 'Actros');
await page.getByLabel(/Número de eixos/).fill('2');
await page.getByRole('button', { name: 'Salvar veículo' }).click();
const erroForm = await page.locator('.text-erro, [role=alert]').allInnerTexts().catch(() => []);
await page.waitForTimeout(800);
const localDup = (await idb('veiculos')).find((v) => v.placa === 'DEM1A09');
ok('4 veículo DEM1A09 salvo no aparelho sem rede (admin já criou a mesma placa)', vDup.s === 201 && !!localDup, `admin ${vDup.s} · local ${!!localDup} ${erroForm.join(' ')}`);
await home();
await offline(false);
await page.locator('.cartao-sync .situacao', { hasText: 'Erro ao sincronizar' }).waitFor({ timeout: 30000 });
const motivo = await page.getByText('Placa DEM1A09 já cadastrada.').first().isVisible();
const botao = await page.getByRole('button', { name: 'Tentar agora' }).isVisible();
ok('4 status "Erro ao sincronizar", motivo e botão "Tentar agora"', motivo && botao, `motivo=${motivo} · botão=${botao}`);
await tela('05-erro-sync');
await page.getByRole('button', { name: 'Tentar agora' }).click();
await page.waitForTimeout(2500);
const filaRej = (await idb('fila')).filter((o) => o.estado === 'rejeitada');
ok('4 dado não some calado (operação recusada guardada e ainda exibida)', filaRej.length === 1 && filaRej[0].op.veiculo?.placa === 'DEM1A09' && (await page.getByText('Placa DEM1A09 já cadastrada.').first().isVisible()), `${filaRej.length} recusada(s): ${filaRej[0]?.erro}`);

// 5. INSPEÇÃO INEXISTENTE
await page.goto(`${BASE}/inspecao/${crypto.randomUUID()}`);
await titulo('Verificação não encontrada');
ok('5 ID inexistente → "Verificação não encontrada" com botão para o início', await page.getByRole('button', { name: 'Ir para o início' }).isVisible());
await tela('06-inexistente');

// 6. MODELO AUSENTE NO APARELHO
await apagarIdb('modelos', `${ids.modelo}@1`);
await page.goto(`${BASE}/inspecao/${A}`);
await titulo('Checklist indisponível neste aparelho');
const texto = await page.locator('main').innerText();
ok('6 modelo ausente: "Checklist indisponível neste aparelho. Conecte-se para sincronizar." sem quebrar', /Conecte-se para sincronizar/.test(texto) && R.erros.length === 0, texto.replace(/\n/g, ' ').slice(0, 140));
await tela('07-modelo-ausente');
await page.waitForTimeout(3000);
await page.reload();
await page.getByRole('heading', { name: /Checklist/ }).first().waitFor();
const voltou = (await idb('modelos')).some((m) => m.id === ids.modelo && m.versao === 1);
if (!voltou) obs('6 depois de sincronizar, a V1 não volta ao aparelho: o catálogo traz só a versão publicada mais recente. Aparelho que perdeu a V1 não continua uma inspeção V1');

ok('7 zero erro JS no fluxo', R.erros.length === 0, R.erros.slice(0, 3).join(' | '));
ok('7 axe sem violações nas telas', Object.values(R.axe).every((v) => v.length === 0), JSON.stringify(Object.fromEntries(Object.entries(R.axe).filter(([, v]) => v.length))));
writeFileSync(em('parte3.json'), JSON.stringify(R, null, 1));
await browser.close();
