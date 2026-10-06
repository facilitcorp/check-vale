// Tour visual: capturas de todas as telas em 390x844 (celular) e 1440x900 (desktop), com dados DEMO.
// Faz uma verificação de verdade (2 NCs com foto, uma crítica) e passa pelo Admin.
// Uso local: bash qa/tela/rodar-tour.sh. Contra outro ambiente: WEB=... INSPETOR_EMAIL=... INSPETOR_SENHA=... ADMIN_EMAIL=... ADMIN_SENHA=... node qa/tela/tour.mjs
// Cria 2 verificações DEMO no ambiente. O rascunho v2 do Admin (telas 15b/16) só é criado com CRIAR_RASCUNHO=1; nada é publicado.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { BASE, em } from './comum.mjs';

const local = /^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE);
// Fora do localhost, credencial só por variável de ambiente; no localhost, os usuários da semente DEMO do README.
const cred = (n, padrao) => process.env[n] || (local ? padrao : (console.error(`Defina ${n}`), process.exit(2)));
const INSPETOR = [cred('INSPETOR_EMAIL', 'inspetor@checkvale.dev'), cred('INSPETOR_SENHA', 'checkvale')];
const ADMIN = [cred('ADMIN_EMAIL', 'admin@checkvale.dev'), cred('ADMIN_SENHA', 'checkvale')];
const CRIAR_RASCUNHO = process.env.CRIAR_RASCUNHO === '1';
if (!existsSync(em('foto-grande.jpg'))) execFileSync('node', [fileURLToPath(new URL('./gerar-fotos.mjs', import.meta.url))], { stdio: 'inherit' });

const erros = [];
const browser = await chromium.launch();
const TELAS = {
  m: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  d: { viewport: { width: 1440, height: 900 } },
};

async function sessao(tela) {
  const ctx = await browser.newContext({ ...TELAS[tela], locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(`[${tela}] exceção: ${e}`));
  page.on('console', (m) => m.type() === 'error' && erros.push(`[${tela}] console: ${m.text().slice(0, 200)}`));
  const foto = async (nome, cheia = false) => {
    await page.waitForTimeout(600);
    await page.screenshot({ path: em(`tour-${nome}.png`), fullPage: cheia });
    console.log('📸', nome);
  };
  const titulo = (t) => page.getByRole('heading', { name: t }).first().waitFor({ timeout: 20000 });
  const entrar = async ([email, senha]) => {
    await page.fill('#email', email);
    await page.fill('#senha', senha);
    await page.getByRole('button', { name: /Entrar/ }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/entrar'), { timeout: 20000 });
  };
  await page.goto(BASE + '/entrar');
  await page.locator('#email').waitFor({ timeout: 20000 });
  return { ctx, page, foto, titulo, entrar };
}

const radio = (page, t) => page.getByRole('radio', { name: t, exact: true });

async function registrarNc({ page, titulo }, texto, foto, criticidade) {
  await radio(page, 'Não conforme').click();
  await page.getByRole('button', { name: 'Avançar' }).click();
  await titulo('Registrar não conformidade');
  await page.getByPlaceholder(/Lanterna traseira/).fill(texto);
  if (criticidade) await page.locator(`input[name=criticidade][value=${criticidade}]`).check({ force: true });
  await page.getByTestId('entrada-foto').setInputFiles(foto);
  await page.getByRole('button', { name: 'Remover foto' }).first().waitFor({ timeout: 20000 });
}

async function inspetor(tela) {
  const m = tela === 'm';
  const s = await sessao(tela);
  const { page, foto, titulo } = s;
  if (m) await foto('m01-login');
  await s.entrar(INSPETOR);
  await titulo('Verificações');
  if (m) await foto('m02-home-inspetor');

  await page.getByRole('button', { name: 'Nova verificação' }).and(page.locator(':enabled')).click({ timeout: 30000 });
  await titulo('Nova verificação');
  for (const id of ['unidade', 'area', 'atividade']) {
    const sel = page.locator('#' + id);
    await sel.and(page.locator(':enabled')).waitFor({ timeout: 10000 });
    const v = await sel.locator('option').evaluateAll((os) => os.map((o) => o.value).find(Boolean));
    if (v) await sel.selectOption(v);
  }
  if (m) await foto('m03-nova-verificacao');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await titulo('Selecione o veículo');
  await page.locator('main button.text-left').first().waitFor({ timeout: 15000 });
  if (m) await foto('m04-selecao-veiculo');
  // Placa da semente DEMO; em outro ambiente, o primeiro veículo da lista.
  const preferido = page.locator('main button.text-left', { hasText: m ? 'OWQ3A15' : 'JHK8D91' });
  await ((await preferido.count()) ? preferido : page.locator('main button.text-left')).first().click();
  await titulo(/^Checklist/);
  const id = new URL(page.url()).pathname.split('/')[2];
  await foto(m ? 'm05-categorias' : 'd02-checklist');

  // NC média no 1º item, NC crítica no 4º, "não se aplica" no 2º quando o item permitir; o resto conforme.
  // No celular, para no 9º item para capturar o progresso.
  for (let n = 0, progresso = false; n < 200; n++) {
    if (await page.getByRole('button', { name: 'Concluir verificação' }).isVisible().catch(() => false)) break;
    const seguir = page.getByRole('button', { name: /^(Iniciar|Continuar) verificação$/ });
    if (await seguir.first().isVisible().catch(() => false)) { await seguir.first().click(); await page.getByRole('radiogroup').waitFor({ timeout: 15000 }); }
    if (n === 0) await foto(m ? 'm06-item' : 'd02b-checklist-item');
    if (n === 0) {
      await registrarNc(s, 'Para-brisa trincado no lado do motorista, cerca de 15 cm.', em('foto-grande.jpg'));
      if (m) { await foto('m07-nao-conformidade-foto'); await foto('m07b-nao-conformidade-foto-inteira', true); }
      await page.getByRole('button', { name: 'Salvar' }).click();
    } else if (n === 3) {
      await registrarNc(s, 'Pneu dianteiro esquerdo com desgaste abaixo do TWI.', em('foto-offline.jpg'), 'critica');
      await page.getByRole('button', { name: 'Salvar' }).click();
    } else if (n === 1 && (await radio(page, 'Não se aplica').count())) {
      await radio(page, 'Não se aplica').click();
      await page.getByRole('button', { name: 'Avançar' }).click();
    } else {
      await radio(page, 'Conforme').click();
      await page.getByRole('button', { name: 'Avançar' }).click();
    }
    await page.waitForTimeout(250);
    if (m && n === 8 && !progresso) {
      progresso = true;
      await page.goto(`${BASE}/inspecao/${id}`);
      await titulo(/^Checklist/);
      await foto('m08-progresso');
    }
  }
  await page.locator('.cabecalho .situacao', { hasText: 'Tudo enviado' }).waitFor({ timeout: 45000 }).catch(() => {});
  await page.getByRole('button', { name: 'Concluir verificação' }).click();
  await titulo('Verificação concluída!');
  await page.getByText('Tudo enviado').first().waitFor({ timeout: 45000 }).catch(() => {});
  await page.getByRole('img', { name: /Índice de prontidão/ }).waitFor({ timeout: 15000 }).catch(() => {});
  await foto(m ? 'm09-resultado' : 'd03-resultado');
  if (!m) {
    await page.goto(BASE + '/');
    await titulo('Verificações');
    await foto('d01-home');
    return s.ctx.close();
  }

  await page.goto(`${BASE}/inspecao/${id}/resultado/categorias`);
  await titulo('Resultado por categoria');
  await foto('m10-resultado-categorias');
  await foto('m10b-resultado-categorias-inteira', true);

  await page.goto(`${BASE}/inspecao/${id}/plano`);
  await titulo('Plano de ação');
  await foto('m11-plano-acao');
  await page.locator('.lista .linha').first().click().catch(() => {});
  await page.locator('.detalhe .fotos__item img').first().waitFor({ timeout: 15000 }).catch(() => {});
  await foto('m11b-plano-acao-detalhe');

  await page.goto(BASE + '/historico');
  await titulo('Histórico');
  await page.locator('.linha--historico').first().waitFor({ timeout: 15000 }).catch(() => {});
  await foto('m12-historico');

  await page.goto(BASE + '/');
  await titulo('Verificações');
  await foto('m02b-home-inspetor-com-historico');
  await s.ctx.close();
}

async function admin(tela) {
  const m = tela === 'm';
  const s = await sessao(tela);
  const { page, foto } = s;
  await s.entrar(ADMIN);
  const ir = async (r) => { await page.goto(BASE + r); await page.waitForLoadState('networkidle'); };
  await ir('/admin');
  await foto(m ? 'm13-admin-inicial' : 'd04-admin');
  if (!m) return s.ctx.close();
  await ir('/admin/frota');
  await foto('m14-admin-frota');
  await foto('m14b-admin-frota-inteira', true);
  await ir('/admin/modelos');
  await page.locator('a[href*="/v/"]').last().click();
  await page.getByText(/somente leitura|Rascunho salvo/).first().waitFor({ timeout: 15000 });
  await foto('m15-admin-editor-checklist');
  if (CRIAR_RASCUNHO && (await page.getByRole('button', { name: 'Criar nova versão a partir desta' }).count())) {
    await page.getByRole('button', { name: 'Criar nova versão a partir desta' }).click();
    await page.getByText('Rascunho salvo.').waitFor({ timeout: 15000 });
    await foto('m15b-admin-editor-rascunho');
  }
  // Abre a primeira categoria para mostrar a regra de aplicabilidade; o botão de publicar só aparece em rascunho.
  page.on('dialog', (d) => d.dismiss());
  const abrir = page.locator('section button[aria-expanded]').first();
  if (await abrir.count()) await abrir.click();
  await page.waitForTimeout(500);
  await foto('m16-admin-regras-publicacao');
  await foto('m16b-admin-regras-publicacao-inteira', true);
  await s.ctx.close();
}

let falhou = false;
for (const [n, f] of [['inspetor celular', () => inspetor('m')], ['admin celular', () => admin('m')], ['inspetor desktop', () => inspetor('d')], ['admin desktop', () => admin('d')]]) {
  try { await f(); } catch (e) { falhou = true; console.log('✘', n, e.message.split('\n')[0]); }
}
await browser.close();
console.log(erros.length ? erros.join('\n') : 'sem erros de console');
process.exit(falhou || erros.length ? 1 : 0);
