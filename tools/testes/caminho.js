// Teste do clipe 〰 Caminho: curva suave por vários pontos, sem parar, girar seguindo o caminho, virar sozinho; e no Estúdio.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route('https://api.github.com/**', r => r.abort());
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.palco && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const r = await p.evaluate(() => {
    const bt = FF.Estudio.Golpes.palco._b, a = bt.all[0], t = bt.all.find(f => f !== a), lx = FF.legado().x;
    const out = {};
    // curva passa pelos pontos
    const cv = FF.Linha.curva([{ x: 0, y: 0 }, { x: 100, y: -100 }, { x: 200, y: 0 }]);
    const meio = cv.at(0.5);
    out.passaMeio = Math.abs(meio.x - 100) < 6 && Math.abs(meio.y + 100) < 6;
    out.fim = (() => { const q = cv.at(1); return Math.abs(q.x - 200) < 0.5 && Math.abs(q.y) < 0.5; })();
    // andando: sem parar no ponto do meio (velocidade constante), chega no último, vira sozinho
    a.offX = 0; a.offY = 0; a.flipExtra = false; a.rotExtra = 0;
    const x0 = a.x;
    const viva = { actor: a, target: t, move: {}, cena: { camadas: [] }, ativos: [], lutadores: new Set(), t: 0, foto: {} };
    const c = { tipo: 'caminho', d: 1, pontos: [{ x: x0 - lx + 200 * a.dir, y: -150 }, { x: x0 - lx + 420 * a.dir, y: -20 }, { x: x0 - lx + 250 * a.dir, y: 0 }], virar: true, girarCaminho: true, _tr: { quem: 'atacante' } };
    const pts = FF.Linha.pontosCaminho(bt, a, t, a, c), fimP = pts[pts.length - 1];
    FF.Linha.disparar(bt, viva, c, 0, () => {});
    const fn = viva.ativos[viva.ativos.length - 1];
    const pos = []; const vira = [];
    for (let i = 1; i <= 20; i++) { fn(0.05, i * 0.05); pos.push({ x: a.x, y: a.y }); vira.push(!!a.flipExtra); }
    const passos = pos.slice(1).map((q, i) => Math.hypot(q.x - pos[i].x, q.y - pos[i].y));
    out.semParar = Math.min(...passos.slice(0, 8)) > Math.max(...passos.slice(0, 8)) * 0.6;   // trecho sem volta: velocidade constante, sem parar no ponto 1
    out.chegou = Math.abs(a.x - fimP.x) < 2 && Math.abs(a.y - fimP.y) < 2;
    out.virou = vira[2] === false && vira[18] === true;
    out.girouNoFim = a.rotExtra === 0;
    a.x = x0; a.y = a.groundY; a.flipExtra = false; a.rotExtra = 0; a.idle && a.idle();
    return out;
  });
  // no Estúdio: criar um Caminho pelo menu da trilha e arrastar um ponto
  const est = await p.evaluate(() => {
    const G = FF.Estudio.Golpes, tr = G.doc.linha.trilhas.find(x => x.quem === 'atacante');
    const c = Object.assign(G.novoCaminho(tr), { id: 'tcam', t: 0.1 });
    tr.clipes.push(c); G.sel = c.id; G.trSel = tr.id; G.mudou('teste'); G.renderProps();
    return { props: !!document.querySelector('.es-caminho-pt'), n: document.querySelectorAll('.es-caminho-pt').length };
  });
  await p.waitForTimeout(400);
  const alc = await p.evaluate(() => FF.Estudio.Golpes.alcas().filter(h => h.k === 'ponto').map(h => ({ x: h.x, y: h.y })));
  let arrastou = false;
  if (alc.length) {
    const box = await p.locator('canvas').first().boundingBox();
    const cv = await p.evaluate(() => { const c = FF.Estudio.Golpes.cv, r = c.getBoundingClientRect(); return { l: r.left, t: r.top, kx: r.width / c.width, ky: r.height / c.height }; });
    const sx = cv.l + alc[1].x * cv.kx, sy = cv.t + alc[1].y * cv.ky;
    const antes = await p.evaluate(() => JSON.stringify(FF.Estudio.Golpes.clipe().pontos[1]));
    await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(sx - 60, sy - 40, { steps: 5 }); await p.mouse.up();
    const depois = await p.evaluate(() => JSON.stringify(FF.Estudio.Golpes.clipe().pontos[1]));
    arrastou = antes !== depois;
  }
  const ok = r.passaMeio && r.fim && r.semParar && r.chegou && r.virou && r.girouNoFim && est.props && est.n === 2 && alc.length === 2 && arrastou;
  console.log((ok ? 'ok: ' : 'FALHOU: ') + 'caminho ' + JSON.stringify(Object.assign({}, r, est, { alcas: alc.length, arrastou })) + (erros.length ? ' erros: ' + erros.join(' | ') : ''));
  await b.close();
  process.exit(ok && !erros.length ? 0 : 1);
})();
