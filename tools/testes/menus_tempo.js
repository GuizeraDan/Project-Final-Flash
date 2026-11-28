// Mede quanto tempo os menus levam para abrir/responder (processador 4× mais lento por padrão, como num celular):
// tela título → Batalha Livre (seleção), troca de aba de pacote, busca, menu de golpes na luta.
const { chromium } = require('playwright');
const path = require('path');
const lento = +(process.argv[process.argv.indexOf('--lento') + 1] || 4) || 4;
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + path.resolve(__dirname, '..', '..') + '/index.html');
  await p.click('#inicio', { timeout: 60000 }).catch(() => {});
  await p.waitForSelector('#inicio button[data-acao="livre"]', { state: 'visible', timeout: 30000 });
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: lento });
  // tempo até o navegador conseguir pintar de novo depois da ação (inclui o trabalho síncrono do clique)
  const cronometro = (acao, pronto) => p.evaluate(async ([acao, pronto]) => {
    const t0 = performance.now(); eval(acao);
    await new Promise(r => { const f = () => (eval(pronto) ? r() : requestAnimationFrame(f)); f(); });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return Math.round(performance.now() - t0);
  }, [acao, pronto]);
  const r = {};
  r['abrir Batalha Livre'] = await cronometro("document.querySelector('#inicio button[data-acao=\"livre\"]').click()", "document.querySelectorAll('.sel-pacotes button, .sel-pacotes [data-pacote]').length > 0 || document.querySelector('.sel-busca')");
  await p.waitForTimeout(1500);
  const abas = await p.evaluate(() => [...document.querySelectorAll('.sel-pacotes button, .sel-pacotes [data-pacote]')].length);
  if (abas > 2) {
    r['trocar aba de pacote'] = await cronometro("[...document.querySelectorAll('.sel-pacotes button, .sel-pacotes [data-pacote]')][2].click()", "true");
    await p.waitForTimeout(800);
    r['voltar à 1ª aba'] = await cronometro("[...document.querySelectorAll('.sel-pacotes button, .sel-pacotes [data-pacote]')][0].click()", "true");
  }
  const busca = await p.$('.sel-busca');
  if (busca) r['digitar na busca'] = await cronometro("(() => { const i = document.querySelector('.sel-busca'); i.value = 'goku'; i.dispatchEvent(new Event('input', { bubbles: true })); })()", "true");
  console.log('CPU ' + lento + '×:'); for (const [k, v] of Object.entries(r)) console.log('  ' + k.padEnd(26) + v + ' ms');
  if (erros.length) console.log('erros:', erros.slice(0, 3));
  await b.close();
})();
