// Teste: trocar "Preso em" de um efeito não tira ele do lugar (X/Y recalculados) e, indo para quem solta, fica "junto do lutador".
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.palco && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const r = await p.evaluate(async () => {
    const G = FF.Estudio.Golpes, tr = G.doc.linha.trilhas.find(x => x.tipo === 'efeitos');
    const c = { id: 'tanc', tipo: 'efeito', t: 0.05, fx: 'Rochas', em: 'alvo', dx: -541, dy: 83, d: 1 };
    tr.clipes.push(c); G.sel = c.id; G.trSel = tr.id; G.mudou('teste'); G.irPara(0.3);
    const ondeEsta = () => { const e = G.palco._b.fxList.find(x => x._clipe === 'tanc'); return e ? { x: Math.round(e.x), y: Math.round(e.y) } : null; };
    const antes = ondeEsta();
    G.trocarAncora(G.clipe(), 'atacante'); G.irPara(0.3);
    const depois = ondeEsta();
    return { antes, depois, c: { em: G.clipe().em, dx: G.clipe().dx, dy: G.clipe().dy, junto: G.clipe().junto } };
  });
  const ok = r.antes && r.depois && Math.abs(r.antes.x - r.depois.x) <= 2 && Math.abs(r.antes.y - r.depois.y) <= 2 && r.c.em === 'atacante' && r.c.junto === true;
  console.log((ok ? 'ok: ' : 'FALHOU: ') + 'trocar âncora sem sair do lugar ' + JSON.stringify(r) + (erros.length ? ' erros: ' + erros.join(' | ') : ''));
  await b.close();
  process.exit(ok && !erros.length ? 0 : 1);
})();
