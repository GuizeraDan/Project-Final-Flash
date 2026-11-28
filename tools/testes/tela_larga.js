// Teste: 📱 tela larga — na cena, o que encosta na borda no palco (1280) encosta na borda numa tela de 1600
// (Mover para x, Caminho, efeito na tela e as posições dos lutadores se espalham); botão "📱 Tela larga" no palco.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes&personagem=goku&golpe=combo');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.doc && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const ok = (c, m) => { console.log((c ? 'ok: ' : 'FALHOU: ') + m); if (!c) process.exitCode = 1; };
  const medir = (larga) => p.evaluate((larga) => {
    const G = FF.Estudio.Golpes; G.doc.golpe.categoria = 'rush';
    const tr = G.doc.linha.trilhas.find(t => t.quem === 'alvo');
    if (!tr.clipes.some(c => c.id === 'tl1')) tr.clipes.push({ id: 'tl1', tipo: 'mover', t: 0.05, d: 0.1, para: 'x', x: 1160 });
    const ef = G.doc.linha.trilhas.find(t => t.tipo === 'efeitos');
    if (!ef.clipes.some(c => c.id === 'tl2')) ef.clipes.push({ id: 'tl2', tipo: 'efeito', t: 0.05, fx: 'hit_forte', em: 'tela', dx: 1150, dy: 290, d: 1 });
    G.trocarLarga(larga); G.irPara(0.3);
    const B = G.palco._b, fx = B.fxList.find(e => e._clipe === 'tl2');
    return { W: FF.W, cv: G.cv.width, alvo: Math.round(FF.W - B.alvo.x), fx: fx ? Math.round(FF.W - fx.x) : null, atk: Math.round(B.atk.homeX) };
  }, larga);
  const n = await medir(false), l = await medir(true);
  ok(n.W === 1280 && l.W === 1600 && l.cv === 1600, 'botão 📱 Tela larga troca o palco para 1600 ' + JSON.stringify([n.W, l.W]));
  const perto = (a, c) => Math.abs(a - c) <= 3;
  ok(perto(l.alvo, n.alvo * 1.25) && perto(l.fx, n.fx * 1.25), 'na cena, a distância até a borda acompanha a largura (alvo ' + n.alvo + '→' + l.alvo + ', efeito ' + n.fx + '→' + l.fx + ')');
  ok(perto(l.atk - 800, (n.atk - 640) * 1.25), 'lutadores espalhados a partir do meio (' + n.atk + '→' + l.atk + ')');
  await p.evaluate(() => FF.Estudio.Golpes.trocarLarga(false));
  ok(await p.evaluate(() => FF.W === 1280), 'desligar volta para 1280');
  ok(!erros.length, 'sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
})();
