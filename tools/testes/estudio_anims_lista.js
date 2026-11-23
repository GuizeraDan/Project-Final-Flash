// Teste da lista de animações da aba Sprites: renomear qualquer animação (Aa / duplo clique) e marcar várias para apagar.
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const RAIZ = require('path').resolve(__dirname, '..', '..');
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--allow-file-access-from-files'] });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const msgs = [];
  p.on('pageerror', e => msgs.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + RAIZ + '/estudio.html?aba=sprites&sprite=gokubase&anim=Idle');
  await p.waitForFunction(() => FF.Estudio && FF.Estudio.pronto && FF.Estudio.Sprites.st.set, null, { timeout: 20000 });
  const nomes = await p.evaluate(() => Object.keys(FF.Estudio.Sprites.st.set.def.anims));
  const [a1, a2, a3, a4] = nomes;

  // Aa numa animação original: nome de exibição
  const it = p.locator('.ess-anims .ess-anim[data-anim="' + a2 + '"]');
  await it.hover();
  await it.locator('.ess-anim-ren').click();
  await p.keyboard.press('Control+A'); await p.keyboard.type('Meu Nome Teste'); await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  ok(await p.evaluate((a) => FF.Assets.nomeAnim('gokubase', a) === 'Meu Nome Teste' && !!FF.Estudio.Sprites.st.set.def.anims[a], a2), 'Aa renomeia animação original só no nome exibido (' + a2 + ')');
  ok(await p.textContent('.ess-anims .ess-anim[data-anim="' + a2 + '"] .ess-anim-nome') === 'Meu Nome Teste', 'lista mostra o nome novo');
  // duplo clique no nome também renomeia
  await p.dblclick('.ess-anims .ess-anim[data-anim="' + a3 + '"] .ess-anim-nome');
  await p.keyboard.press('Control+A'); await p.keyboard.type('Duplo'); await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  ok(await p.evaluate((a) => FF.Assets.nomeAnim('gokubase', a) === 'Duplo', a3), 'duplo clique no nome renomeia');

  // marcar 3 com Shift e apagar
  ok(await p.isHidden('.ess-marc-anims'), 'barra de marcadas escondida sem marcação');
  await p.click('.ess-anims .ess-anim[data-anim="' + a2 + '"] .ess-anim-chk');
  await p.click('.ess-anims .ess-anim[data-anim="' + a4 + '"] .ess-anim-chk', { modifiers: ['Shift'] });
  const n = await p.evaluate(() => FF.Estudio.Sprites.st.marcA.size);
  ok(n === 3 && await p.isVisible('.ess-marc-anims'), 'Shift marca o intervalo (' + n + ') e mostra a barra');
  await p.click('.ess-marc-anims button:has-text("🗑 Apagar")');
  await p.click('.ess-conf button:has-text("🗑 Apagar 3")');
  await p.waitForTimeout(400);
  const r = await p.evaluate((l) => ({ ap: FF.Mods.apagadas('gokubase'), lista: [...document.querySelectorAll('.ess-anims .ess-anim:not(.ess-apagada)')].map(e => e.dataset.anim) }), [a2, a3, a4]);
  ok([a2, a3, a4].every(a => r.ap.includes(a) && !r.lista.includes(a)), 'as 3 marcadas foram apagadas (vão para "Apagadas")');
  ok(await p.isHidden('.ess-marc-anims'), 'marcação limpa depois de apagar');
  ok(!msgs.length, 'sem erros na página' + (msgs.length ? ': ' + msgs.join(' | ') : ''));
  await b.close();
})();
