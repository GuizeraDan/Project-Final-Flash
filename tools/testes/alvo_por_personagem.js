// Teste: 🎭 trilha do Alvo por personagem — cria a trilha própria do alvo do palco, ela vale só para ele (no palco,
// ao salvar e no motor), os outros usam a padrão; "Usar a padrão" apaga.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes&personagem=goku&golpe=combo');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.doc && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const ok = (c, m) => { console.log((c ? 'ok: ' : 'FALHOU: ') + m); if (!c) process.exitCode = 1; };
  await p.evaluate(async () => { const G = FF.Estudio.Golpes; await G.aplicarCfg(Object.assign({}, G.cfg, { alvo: 'raditz' }), true); });
  ok(/Trilha só para Raditz/.test(await p.evaluate(() => document.body.innerText)), 'botão "Trilha só para Raditz" no palco');
  const r1 = await p.evaluate(() => {
    const G = FF.Estudio.Golpes; G.criarAlvoProprio();
    const tr = G.trAlvo(); const n0 = tr._base.length;
    tr.clipes.push({ id: 'tstA', tipo: 'anim', t: 0.1, anim: 'ANIM_SO_RADITZ' }); G.mudou('teste');
    const g = G.montarGolpe(), trS = g.roteiro[0].linha.trilhas.find(t => t.quem === 'alvo');
    return { ver: tr._ver, nome: G.tl.nomeTrilha(tr), base: trS.clipes.some(c => c.id === 'tstA'), proprio: (trS.porAlvo.raditz || []).some(c => c.id === 'tstA'), n0, nBase: trS.clipes.length, limpo: !trS._ver && !trS._base, linha: g.roteiro[0].linha };
  });
  ok(r1.ver === 'raditz' && /🎭/.test(r1.nome), 'editando a trilha própria (marcada 🎭 na linha do tempo)');
  ok(!r1.base && r1.proprio && r1.nBase === r1.n0 && r1.limpo, 'salvar: o clipe novo fica só na trilha do Raditz, a padrão não muda');
  const motor = await p.evaluate((L) => { const pega = (id) => FF.Linha.clipes(L, id ? { def: { id } } : null).some(x => x.c.id === 'tstA'); return [pega('raditz'), pega('krillin'), pega(null)]; }, r1.linha);
  ok(motor[0] && !motor[1] && !motor[2], 'motor: usa a trilha própria só contra o Raditz ' + JSON.stringify(motor));
  const r2 = await p.evaluate(async () => { const G = FF.Estudio.Golpes; await G.aplicarCfg(Object.assign({}, G.cfg, { alvo: 'krillin' }), true); const tr = G.trAlvo(); const a = [tr._ver || null, tr.clipes.some(c => c.id === 'tstA')];
    await G.aplicarCfg(Object.assign({}, G.cfg, { alvo: 'raditz' }), true); const t2 = G.trAlvo(); return a.concat([t2._ver, t2.clipes.some(c => c.id === 'tstA')]); });
  ok(r2[0] === null && !r2[1] && r2[2] === 'raditz' && r2[3], 'trocar o alvo do palco: Kuririn vê a padrão, Raditz volta com a dele ' + JSON.stringify(r2));
  const r3 = await p.evaluate(async () => { const G = FF.Estudio.Golpes; E0 = FF.Estudio.confirmar; FF.Estudio.confirmar = async () => true; await G.usarBaseAlvo(); FF.Estudio.confirmar = E0; const tr = G.trAlvo(); const g = G.montarGolpe(); const trS = g.roteiro[0].linha.trilhas.find(t => t.quem === 'alvo'); return [tr._ver || null, !!(trS.porAlvo && trS.porAlvo.raditz)]; });
  ok(r3[0] === null && !r3[1], '"Usar a padrão" apaga a trilha própria');
  ok(!erros.length, 'sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
})();
