// Teste: no palco com perspectiva, as alças do efeito ficam em cima do desenho e arrastar move 1 para 1.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route('https://api.github.com/**', r => r.abort());
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.palco && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'ok: ' : 'FALHOU: ') + m); };
  const casos = [['fundo', 'frente'], ['frente', 'fundo'], ['meio', 'meio']];
  for (const [fa, fb] of casos) {
    const r = await p.evaluate(([fa, fb]) => {
      const g = FF.Estudio.abas.find(a => a.id === 'golpes');
      g.cfg.filaAtk = fa; g.cfg.filaAlvo = fb;
      const tr = g.doc.linha.trilhas.find(t => t.id === 'efeitos');
      const c = { id: 'tpersp', tipo: 'efeito', t: 0.05, fx: 'Rochas', em: 'atacante', dx: 220, dy: -60, d: 2 };
      tr.clipes.push(c); g.mudou('x'); g.selecionar('tpersp', tr); g.irPara(0.3);
      const e = () => g.palco._b.fxList.find(x => x._clipe === 'tpersp'), b = g.palco._b;
      const h = g.alcas().find(x => x.k === 'mover'), e0 = e();
      const antes = { hx: h.x, hy: h.y, ex: e0.x, ey: e0.y };
      // arrastar a alça 60 px para a direita e 30 para baixo (mesma conta do ponteiro)
      const rr = g.palco.ref['tpersp'], d = rr.dir || 1;
      const v = rr.mapa ? g.desfazerMapa(rr, rr.p.x + c.dx * d, rr.p.y + c.dy, 60, 30) : { x: 60, y: 30 };
      c.dx = Math.round(c.dx + v.x * d); c.dy = Math.round(c.dy + v.y); g.mudou('x'); g.irPara(0.3);
      const e1 = e(), h1 = g.alcas().find(x => x.k === 'mover');
      tr.clipes.splice(tr.clipes.indexOf(c), 1); g.mudou('x');
      return { persp: !!b.persp, antes, depois: { ex: e1.x, ey: e1.y, hx: h1.x, hy: h1.y } };
    }, [fa, fb]);
    const a = r.antes, dd = r.depois;
    ok(Math.hypot(a.hx - a.ex, a.hy - a.ey) < 1.5, `${fa}→${fb} (persp ${r.persp}): alça em cima do efeito (${a.hx.toFixed(1)},${a.hy.toFixed(1)} × ${a.ex.toFixed(1)},${a.ey.toFixed(1)})`);
    ok(Math.abs(dd.ex - a.ex - 60) < 2.5 && Math.abs(dd.ey - a.ey - 30) < 2.5, `${fa}→${fb}: arrastar 60,30 move o efeito ${(dd.ex - a.ex).toFixed(1)},${(dd.ey - a.ey).toFixed(1)}`);
  }
  ok(!erros.length, 'console: ' + erros.join(' | '));
  await b.close();
  process.exit(falhas ? 1 : 0);
})();
