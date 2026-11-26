// Teste: "⇋ Espelhar" no movimento e no teleporte vira o lutador (flipExtra) e a próxima animação decide de novo.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route('https://api.github.com/**', r => r.abort());
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.palco && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const r = await p.evaluate(() => {
    const bt = FF.Estudio.Golpes.palco._b, a = bt.all[0], t = bt.all.find(f => f !== a);
    const viva = { actor: a, target: t, move: {}, cena: { camadas: [] }, ativos: [], lutadores: new Set(), t: 0, foto: {} };
    a.flipExtra = false;
    FF.Linha.disparar(bt, viva, { tipo: 'mover', para: 'x', x: 500, y: 0, d: 0.2, flip: true, _tr: { quem: 'atacante' } }, 0, () => {});
    const mover = !!a.flipExtra;
    FF.Linha.disparar(bt, viva, { tipo: 'anim', anim: 'parado', _tr: { quem: 'atacante' } }, 0, () => {});
    const depoisAnim = !!a.flipExtra;
    FF.Linha.disparar(bt, viva, { tipo: 'mover', para: 'x', x: 400, d: 0.2, _tr: { quem: 'atacante' } }, 0, () => {});
    const semFlip = !!a.flipExtra;
    // começar reto: a animação anterior deixou giro/tamanho/espelhar
    FF.Linha.disparar(bt, viva, { tipo: 'anim', anim: 'parado', rot: 134, escala: 0.8, flip: true, _tr: { quem: 'atacante' } }, 0, () => {});
    const herdado = a.rotExtra !== 0;
    FF.Linha.disparar(bt, viva, { tipo: 'mover', para: 'x', x: 450, d: 0.2, reto: true, _tr: { quem: 'atacante' } }, 0, () => {});
    viva.ativos.forEach(fn => fn(0, 0.0001));
    const reto = a.rotExtra === 0 && a.escExtra === 1 && !a.flipExtra;
    a.flipExtra = false; a.rotExtra = 0; a.escExtra = 1;
    return { mover, depoisAnim, semFlip, herdado, reto };
  });
  const ok = r.mover && !r.depoisAnim && !r.semFlip && r.herdado && r.reto;
  console.log((ok ? 'ok: ' : 'FALHOU: ') + 'espelhar no movimento ' + JSON.stringify(r) + (erros.length ? ' erros: ' + erros.join(' | ') : ''));
  await b.close();
  process.exit(ok && !erros.length ? 0 : 1);
})();
