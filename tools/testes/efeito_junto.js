// Teste: "📍 Ficar junto do lutador" — na diagonal o efeito não vai pela diagonal até o alvo nem inclina; padrão = "Acompanha o lutador".
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.palco && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const r = await p.evaluate(() => {
    const bt = FF.Estudio.Golpes.palco._b, a = bt.all[0], t = bt.all.find(f => f !== a);
    const viva = { actor: a, target: t, move: {}, cena: { camadas: [] }, ativos: [], lutadores: new Set(), t: 0, foto: {} };
    const pos = (extra) => { bt.fxList.length = 0; FF.Linha.disparar(bt, viva, Object.assign({ tipo: 'efeito', fx: 'Rochas', em: 'atacante', dx: -120, dy: -40, _tr: { quem: 'efeitos' } }, extra), 0, () => {}); const e = bt.fxList[bt.fxList.length - 1]; const o = e ? { x: Math.round(e.x), y: Math.round(e.y), rot: e.rot || 0 } : null; bt.fxList.length = 0; return o; };
    const kf = bt.fov || 1, esperado = { x: Math.round(a.x - 120 * a.dir * kf), y: Math.round(a.groundY - 40 * kf) };
    return { persp: bt.persp, diagonal: pos({}), junto: pos({ junto: true }), seguir: pos({ seguir: true }), seguirSemJunto: pos({ seguir: true, junto: false }), esperado };
  });
  const igual = (u, v) => u && Math.abs(u.x - v.x) <= 1 && Math.abs(u.y - v.y) <= 1;
  const ok = r.persp && igual(r.junto, r.esperado) && r.junto.rot === 0 && igual(r.seguir, r.esperado) && !igual(r.diagonal, r.esperado) && igual(r.seguirSemJunto, r.diagonal);
  console.log((ok ? 'ok: ' : 'FALHOU: ') + 'ficar junto do lutador ' + JSON.stringify(r) + (erros.length ? ' erros: ' + erros.join(' | ') : ''));
  await b.close();
  process.exit(ok && !erros.length ? 0 : 1);
})();
