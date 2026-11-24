// Teste: "Camada: na profundidade de quem solta / do alvo" — o efeito é desenhado entre os lutadores pela altura de chão.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route('https://api.github.com/**', r => r.abort());
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.palco && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const r = await p.evaluate(() => {
    const bt = FF.Estudio.Golpes.palco._b;
    const persp0 = bt.persp;
    if (!bt.persp) return { semPersp: true };
    // espalha os lutadores em alturas de chão diferentes
    const lut = bt.all.slice();
    lut.forEach((f, k) => { f.groundY = 460 + k * 60; f._nm = 'L' + k; });
    const ordem = (opts) => {
      bt.fxList.length = 0;
      const e = bt.spawnFx('Rochas', 400, 400, false, 1, opts); e._nm = 'FX';
      const vistos = [], origs = lut.map(f => f.draw);
      lut.forEach(f => { const o = f.draw; f.draw = function () { vistos.push(f._nm); return o.apply(this, arguments); }; });
      const od = FF.drawFrame;
      FF.drawFrame = function (c, set, fr) { if (e.a.frame() === fr && set === e.set) vistos.push('FX'); return od.apply(this, arguments); };
      const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
      try { bt.draw(cv.getContext('2d')); } finally { FF.drawFrame = od; lut.forEach((f, k) => { f.draw = origs[k]; }); }
      bt.fxList.length = 0;
      return vistos.filter((v, i) => vistos.indexOf(v) === i).join('>');
    };
    return { n: lut.length, frente: ordem({}), atras: ordem({ atras: true }), prof0: ordem({ prof: lut[0] }), prof1: ordem({ prof: lut[1] }), persp0 };
  });
  const L = (k) => 'L' + k;
  let ok = !r.semPersp && r.n >= 2;
  const fim = r.n ? Array.from({ length: r.n }, (_, k) => L(k)) : [];
  if (ok) {
    ok = r.frente === fim.join('>') + '>FX'
      && r.atras === 'FX>' + fim.join('>')
      && r.prof0 === [L(0), 'FX'].concat(fim.slice(1)).join('>')
      && r.prof1 === [L(0), L(1), 'FX'].concat(fim.slice(2)).join('>');
  }
  console.log((ok ? 'ok: ' : 'FALHOU: ') + 'profundidade ' + JSON.stringify(r) + (erros.length ? ' erros: ' + erros.join(' | ') : ''));
  await b.close();
  process.exit(ok ? 0 : 1);
})();
