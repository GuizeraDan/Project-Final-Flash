// Teste: animação de Mover/Teleporte/Caminho escolhida no seletor completo (qualquer sprite): spriteMov empresta o
// desenho durante o movimento (trilha do alvo inclusive) e devolve depois.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes&personagem=goku&golpe=combo');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.doc && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const ok = (c, m) => { console.log((c ? 'ok: ' : 'FALHOU: ') + m); if (!c) process.exitCode = 1; };
  const r = await p.evaluate(async () => {
    const G = FF.Estudio.Golpes; await G.aplicarCfg(Object.assign({}, G.cfg, { alvo: 'raditz' }), true);
    const tr = G.trAlvo();
    tr.clipes.push({ id: 'mv1', tipo: 'mover', t: 0.02, d: 0.3, para: 'x', x: 900, animMov: 'Parado', spriteMov: 'gokubase' });
    G.irPara(0.15); const B = G.palco._b;
    const durante = B.alvo.sprite === FF.Assets.sprites.gokubase && B.alvo.anim.name === 'Parado';
    G.irPara(G.doc.linha.duracao); const depois = G.palco._b.alvo.sprite !== FF.Assets.sprites.gokubase;
    const usados = FF.Linha.spritesUsados(G.doc.linha).includes('gokubase');
    return { durante, depois, usados };
  });
  ok(r.durante && r.depois, 'alvo usa a animação de outro sprite durante o Mover e volta ao dele depois ' + JSON.stringify(r));
  ok(r.usados, 'o sprite emprestado entra nos sprites que o golpe carrega');
  await p.evaluate(() => { const G = FF.Estudio.Golpes; const c = G.trAlvo().clipes.find(x => x.id === 'mv1'); FF.EstudioProps.escolherAnimMov(G, 'alvo', c); });
  await p.waitForTimeout(800);
  ok(/Animação do movimento \(de qualquer sprite\)/.test(await p.evaluate(() => document.body.innerText)), 'abre o seletor completo de sprites (pastas, favoritos, acervo)');
  ok(!erros.length, 'sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
})();
