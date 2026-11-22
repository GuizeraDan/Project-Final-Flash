// Teste: "Ordem" dos clipes (por baixo / normal / por cima) decide quem é desenhado por cima entre efeitos e projéteis.
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
    const ordemDesenho = (specs) => {
      bt.fxList.length = 0;
      const marcas = specs.map(([nome, ordem], k) => { const e = bt.spawnFx(k ? 'Rochas2' : 'Rochas', 400, 400, false, 1, { ordem }); e._nome = nome; return e; });
      const vistos = []; const orig = FF.drawFrame;
      FF.drawFrame = function (c, set, f) { const e = marcas.find(m => m.a.frame() === f); if (e) vistos.push(e._nome); return orig.apply(this, arguments); };
      const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
      try { bt.draw(cv.getContext('2d')); } finally { FF.drawFrame = orig; }
      bt.fxList.length = 0;
      return vistos.join('>');
    };
    return [
      ordemDesenho([['azul', ''], ['pedra', '']]),          // normal: o último fica por cima
      ordemDesenho([['azul', ''], ['pedra', 'baixo']]),     // pedra por baixo
      ordemDesenho([['azul', 'cima'], ['pedra', '']]),      // azul por cima
    ];
  });
  const ok = r[0] === 'azul>pedra' && r[1] === 'pedra>azul' && r[2] === 'pedra>azul';
  console.log((ok ? 'ok: ' : 'FALHOU: ') + 'ordem de desenho ' + JSON.stringify(r) + (erros.length ? ' erros: ' + erros.join(' | ') : ''));
  await b.close();
  process.exit(ok ? 0 : 1);
})();
