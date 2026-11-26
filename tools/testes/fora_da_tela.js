// Teste: coisas fora da tela no palco do Estúdio — alça presa na borda (arrastar traz de volta), ⌖ Trazer para a tela,
// e "🔍 Fora" (palco encolhe e mostra o que está fora; clique continua acertando o lugar certo).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.palco && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const ok = (c, m) => { console.log((c ? 'ok: ' : 'FALHOU: ') + m); if (!c) process.exitCode = 1; };
  // efeito longe, fora da tela
  await p.evaluate(() => { const G = FF.Estudio.Golpes; G.palco.opts.fora = false; const tr = G.doc.linha.trilhas.find(x => x.tipo === 'efeitos'); const c = { id: 'tfora', tipo: 'efeito', t: 0, fx: 'Rochas', em: 'atacante', dx: 2500, dy: 0 }; tr.clipes.push(c); G.sel = c.id; G.trSel = tr.id; G.mudou('teste'); G.irPara(0.05); G.renderProps(); });
  await p.waitForTimeout(500);
  const pr = await p.evaluate(() => { const G = FF.Estudio.Golpes, h = G.alcas().find(x => x.k === 'mover'); const q = h && G.prender(h); return h ? { hx: h.x, qx: q.x, preso: !!q.preso, w: FF.W } : null; });
  ok(pr && pr.hx > pr.w && pr.preso && pr.qx < pr.w, 'alça presa na borda (' + JSON.stringify(pr) + ')');
  // arrastar a alça presa para dentro
  const tela = (x, y) => p.evaluate(([x, y]) => { const c = FF.Estudio.Golpes.cv, r = c.getBoundingClientRect(); return { x: r.left + x * r.width / c.width, y: r.top + y * r.height / c.height }; }, [x, y]);
  const q = await p.evaluate(() => { const G = FF.Estudio.Golpes, h = G.prender(G.alcas().find(x => x.k === 'mover')); return { x: h.x, y: h.y }; });
  const a0 = await tela(q.x, q.y), a1 = await tela(q.x - 600, q.y);
  await p.mouse.move(a0.x, a0.y); await p.mouse.down(); await p.mouse.move(a1.x, a1.y, { steps: 8 }); await p.mouse.up();
  const dx1 = await p.evaluate(() => FF.Estudio.Golpes.clipe().dx);
  ok(dx1 < 2500 - 400, 'arrastar a alça da borda traz o efeito de volta (dx 2500 → ' + dx1 + ')');
  // ⌖ Trazer para a tela
  await p.evaluate(() => { FF.Estudio.Golpes.clipe().dx = 4000; FF.Estudio.Golpes.renderProps(); });
  await p.click('.es-trazer-tela');
  ok(await p.evaluate(() => FF.Estudio.Golpes.clipe().dx == null), '⌖ Trazer para a tela volta o efeito para o ponto de quem solta');
  // 🔍 Fora: palco encolhe; o canto do canvas fica fora da tela do jogo e o meio continua no meio
  const fo = await p.evaluate(() => { const P = FF.Estudio.Golpes.palco; P.opts.fora = true; FF.Estudio.Golpes.redesenhar(); const v = P.visivel(), m = P.deCanvas(FF.W / 2, FF.H / 2); P.opts.fora = false; FF.Estudio.Golpes.redesenhar(); return { v, m }; });
  ok(fo.v.x0 < -200 && fo.v.x1 > 1480 && Math.abs(fo.m.x - 640) < 1 && Math.abs(fo.m.y - 360) < 1, '🔍 Fora mostra além da tela: ' + JSON.stringify(fo));
  ok(await p.locator('label:has-text("🔍 Fora")').count() === 1, 'botão 🔍 Fora na barra do palco');
  ok(!erros.length, 'sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
})();
