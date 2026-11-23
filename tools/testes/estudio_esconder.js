// Teste da coluna de Propriedades escamoteável (⇥ esconde, aba fina na borda traz de volta; lembrado no aparelho)
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const RAIZ = require('path').resolve(__dirname, '..', '..');
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--allow-file-access-from-files'] });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const msgs = []; p.on('pageerror', e => msgs.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + RAIZ + '/estudio.html?aba=sprites&sprite=bills&anim=Parado');
  await p.waitForFunction(() => FF.Estudio && FF.Estudio.pronto && FF.Estudio.Sprites.st.set, null, { timeout: 20000 });
  await p.waitForTimeout(300);
  const larg = () => p.evaluate(() => document.querySelector('.ess-palco-wrap, .ess-centro').getBoundingClientRect().width);
  const w0 = await larg();
  await p.click('.ess-dir .es-lado-esc');
  await p.waitForTimeout(300);
  ok(await p.isHidden('.ess-dir') && await p.isVisible('.es-lado-aba'), '⇥ esconde as Propriedades e deixa a aba na borda');
  const w1 = await larg();
  ok(w1 > w0 + 150, 'palco ganha espaço (' + Math.round(w0) + ' → ' + Math.round(w1) + ')');
  await p.screenshot({ path: '/tmp/esc.png' });
  await p.reload();
  await p.waitForFunction(() => FF.Estudio && FF.Estudio.pronto && FF.Estudio.Sprites.st.set, null, { timeout: 20000 });
  await p.waitForTimeout(300);
  ok(await p.isHidden('.ess-dir'), 'continua escondida depois de recarregar');
  await p.click('.es-lado-aba');
  await p.waitForTimeout(300);
  ok(await p.isVisible('.ess-dir') && !(await p.locator('.es-lado-aba').count()), 'clicar na aba traz as Propriedades de volta');
  // aba Golpes também
  await p.evaluate(() => FF.Estudio.abrir('golpes'));
  await p.waitForTimeout(800);
  ok(await p.locator('.es-lado-esc').count() >= 2, 'aba Golpes também tem o ⇥');
  ok(!msgs.length, 'sem erros' + (msgs.length ? ': ' + msgs.join(' | ') : ''));
  await b.close();
})();
