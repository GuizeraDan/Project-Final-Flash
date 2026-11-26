// Teste: efeito com "📌 Fixar no começo do golpe" não muda de lugar quando quem solta / o alvo já se moveram.
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
    const a = bt.all.find(f => f.side === 'hero' || f.lado === 'heroi') || bt.all[0], t = bt.all.find(f => f !== a);
    const out = {};
    for (const em of ['atacante', 'peito', 'alvo']) {
      const viva = { actor: a, target: t, move: {}, cena: { camadas: [] }, ativos: [], lutadores: new Set(), foto: { actor: FF.Linha.foto(a), target: FF.Linha.foto(t) } };
      const x0a = a.x, x0t = t.x;
      a.x += 150; t.x -= 90;   // depois do começo do golpe: os dois se moveram
      const pos = (fixar) => { bt.fxList.length = 0; FF.Linha.disparar(bt, viva, { tipo: 'efeito', fx: 'Rochas', em, dx: 10, dy: -5, fixar, _tr: { quem: 'efeitos' } }); const e = bt.fxList[bt.fxList.length - 1]; return e ? Math.round(e.x) : null; };
      const solto = pos(false), fixo = pos(true);
      a.x = x0a; t.x = x0t;
      const ref = pos(false);   // onde estaria no começo do golpe
      out[em] = { solto, fixo, ref };
      bt.fxList.length = 0;
    }
    return out;
  });
  let ok = true;
  Object.entries(r).forEach(([em, v]) => { if (!(v.fixo === v.ref && v.solto !== v.ref)) ok = false; });
  console.log((ok ? 'ok: ' : 'FALHOU: ') + 'efeito fixado no começo do golpe ' + JSON.stringify(r) + (erros.length ? ' erros: ' + erros.join(' | ') : ''));
  await b.close();
  process.exit(ok && !erros.length ? 0 : 1);
})();
