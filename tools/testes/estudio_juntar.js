// Teste do 🎞 Juntar em animação (js/estudio/juntar.js): ground_smash_fx_00…09 (Drag Warriors) viram uma animação.
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
  await p.goto('file://' + RAIZ + '/estudio.html?aba=sprites&sprite=bills&anim=Parado');
  await p.waitForFunction(() => FF.Estudio && FF.Estudio.pronto && FF.Estudio.Sprites.st.set, null, { timeout: 20000 });
  ok(await p.evaluate(() => FF.EstudioJuntar.prefixo(['ground_smash_fx_00', 'ground_smash_fx_09']) === 'ground_smash_fx' && FF.EstudioJuntar.prefixo(['e_6 (1)', 'e_6 (12)']) === 'e_6'), 'nome da série sai do prefixo comum');
  await p.fill('.ess-busca >> nth=0', 'ground_smash_fx');
  await p.waitForSelector('.es-nav-chk[data-id="dw_ground_smash_fx_00"]', { timeout: 15000 });
  await p.click('.es-nav-chk[data-id="dw_ground_smash_fx_00"]');
  ok(await p.isHidden('.es-nav-juntar'), '🎞 Juntar escondido com 1 marcado');
  await p.click('.es-nav-chk[data-id="dw_ground_smash_fx_09"]', { modifiers: ['Shift'] });
  const marc = +((await p.textContent('.es-nav-sel span')).replace(/\D/g, ''));
  ok(marc === 10 && await p.isVisible('.es-nav-juntar'), 'Shift marca a série (' + marc + ') e mostra 🎞 Juntar');
  await p.click('.es-nav-juntar');
  await p.waitForSelector('.es-juntar-item');
  ok(await p.locator('.es-juntar-item').count() === 10, 'janela lista os 10 em ordem');
  ok(await p.inputValue('.es-juntar-lin input >> nth=0') === 'ground_smash_fx', 'nome sugerido: ground_smash_fx');
  await p.click('.es-juntar-ok');
  await p.waitForFunction(() => FF.Estudio.Sprites.st.id === 'dw_ground_smash_fx_00' && FF.Estudio.Sprites.st.nome === 'ground_smash_fx', null, { timeout: 15000 });
  const r = await p.evaluate(async () => {
    const st = FF.Estudio.Sprites.st, a = st.set.def.anims.ground_smash_fx;
    const ids = Array.from({ length: 10 }, (_, k) => 'dw_ground_smash_fx_0' + k);
    // cada quadro desenha igual ao sprite solto de origem
    const px = (set, f) => { const c = document.createElement('canvas'); c.width = 200; c.height = 100; FF.drawFrame(c.getContext('2d'), set, f, 100, 50, 1, false); return Array.from(c.getContext('2d').getImageData(0, 0, 200, 100).data); };
    let iguais = 0;
    for (let k = 0; k < 10; k++) { const s = await FF.Assets.loadSprite(ids[k]); if (JSON.stringify(px(st.set, a.frames[k])) === JSON.stringify(px(s, s.def.anims.folha.frames[0]))) iguais++; }
    return {
      n: a.frames.length, iguais, extras: (FF.Assets.infoSprite(ids[0]).atlas || []).length,
      ocultos: ids.slice(1).filter(id => FF.Assets.spriteOculto(id)).length, nome: FF.Assets.nomeSprite(ids[0]),
      salvo: !!(FF.Edicoes.dados().sprites[ids[0]] || {}).ground_smash_fx,
    };
  });
  ok(r.n === 10 && r.salvo, 'animação com 10 quadros salva no jogo');
  ok(r.iguais === 10, 'cada quadro igual ao sprite de origem (' + r.iguais + '/10)');
  ok(r.extras === 9, 'imagens dos outros 9 entram como atlas extras (sem copiar)');
  ok(r.ocultos === 9, 'os 9 soltos foram para a Lixeira');
  ok(r.nome === 'ground_smash_fx', 'primeiro sprite passa a se chamar ground_smash_fx');
  // recarregar a página: continua valendo
  await p.reload();
  await p.waitForFunction(() => FF.Estudio && FF.Estudio.pronto && FF.Estudio.Sprites.st.set, null, { timeout: 20000 });
  ok(await p.evaluate(async () => { FF.Assets.descarregarSprite('dw_ground_smash_fx_00'); const s = await FF.Assets.loadSprite('dw_ground_smash_fx_00'); const a = s.def.anims.ground_smash_fx; return a && a.frames.length === 10 && a.frames.every(f => s.images[f[0]] && s.images[f[0]].width > 0); }), 'depois de recarregar a animação continua com as imagens');
  ok(!msgs.length, 'sem erros na página' + (msgs.length ? ': ' + msgs.join(' | ') : ''));
  await b.close();
})();
