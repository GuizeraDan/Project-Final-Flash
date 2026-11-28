// Medição de desempenho: tempo por quadro (update + draw) numa luta 3×3, parado e durante golpes, com o
// processador normal e 4× mais lento (simula um celular). Uso: node tools/testes/desempenho.js [--lento 4]
const { chromium } = require('playwright');
const path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--disable-gpu-vsync'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  const raiz = 'file://' + path.resolve(__dirname, '..', '..');
  await p.goto(raiz + '/index.html');
  await p.evaluate(() => sessionStorage.setItem('ff_livre_def', JSON.stringify({ id: 'livre', saga: 'livre', titulo: 'Teste', cenario: 'campo', musica: 'tournament_theme', escala: 2.2,
    posicoes: { herois: [250, 150, 350], inimigos: [820, 930, 1020] }, herois: ['goku', 'piccolo', 'krillin'], inimigos: ['raditz', 'nappa', 'vegeta'], ajustes: {} })));
  await p.goto(raiz + '/index.html?livre=1');
  await p.waitForFunction(() => window.FF && FF.battle && FF.battle.all && FF.battle.all.length === 6, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(p);
  const medir = async (rotulo, ms, acao) => {
    await p.evaluate(() => {
      const B = FF.battle; window._perf = { up: [], dr: [], gap: [] };
      if (!B._medido) {
        B._medido = true;
        const u = B.update.bind(B), d = B.draw.bind(B);
        B.update = function (dt) { const t = performance.now(); u(dt); _perf.up.push(performance.now() - t); };
        B.draw = function (c) { const t = performance.now(); d(c); _perf.dr.push(performance.now() - t); if (_perf.ult) _perf.gap.push(t - _perf.ult); _perf.ult = t; };
      }
    });
    if (acao) await p.evaluate(acao);
    await p.waitForTimeout(ms);
    const r = await p.evaluate(() => {
      const m = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, p95 = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length * 0.95)] || 0; };
      return { quadros: _perf.dr.length, update: m(_perf.up), draw: m(_perf.dr), drawP95: p95(_perf.dr), fps: _perf.gap.length ? 1000 / m(_perf.gap) : 0 };
    });
    console.log(rotulo.padEnd(34), 'fps ' + r.fps.toFixed(0).padStart(3), '| update ' + r.update.toFixed(2) + ' ms', '| draw ' + r.draw.toFixed(2) + ' ms (p95 ' + r.drawP95.toFixed(2) + ')', '| quadros ' + r.quadros);
    return r;
  };
  const golpe = () => { const B = FF.battle, h = B.heroes[0], e = B.enemies[0]; const id = h.form.golpes.find(g => /combo/.test(g)) || h.form.golpes[0]; B.execute(h, e, h.def.golpes[id]); };
  for (const lento of [1, +arg('lento', 4)]) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: lento });
    await medir('parado (CPU ' + lento + '×)', 3000);
    await medir('golpe (CPU ' + lento + '×)', 4000, golpe);
    await p.waitForTimeout(3000);
  }
  if (erros.length) console.log('erros:', erros.slice(0, 3));
  await b.close();
})();
