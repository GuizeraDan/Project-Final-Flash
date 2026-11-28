// Teste: 🎬 cenas de golpe — todo golpe que acerta alguém corta para a cena (só quem ataca e o alvo, palco fixo, igual
// em qualquer fileira; normal = corte seco, rush/supremo = flash); na luta os outros somem durante a cena e tudo volta no fim.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes&personagem=goku&golpe=combo');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.doc && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const ok = (c, m) => { console.log((c ? 'ok: ' : 'FALHOU: ') + m); if (!c) process.exitCode = 1; };
  const cats = await p.evaluate(() => { const d = FF.Estudio.Golpes.defs.goku; const g = (id) => { for (const f of Object.values(d.formas)) if (f.golpes && f.golpes[id]) return f.golpes[id]; return d.golpes && d.golpes[id]; }; return { combo: FF.Battle.categoria(Object.assign({}, g('combo'), { categoria: undefined })), kame: FF.Battle.categoria(Object.assign({}, g('kamehameha'), { categoria: undefined })), sup: FF.Battle.categoria({ supremo: true, roteiro: [] }), manual: FF.Battle.categoria({ categoria: 'rush', roteiro: [] }) }; });
  ok(cats.combo === 'rush' && cats.kame === 'normal' && cats.sup === 'supremo' && cats.manual === 'rush', 'classificação automática ' + JSON.stringify(cats));
  const pos = (fa, fb, cat) => p.evaluate(([fa, fb, cat]) => { const G = FF.Estudio.Golpes; if (cat) G.doc.golpe.categoria = cat; else delete G.doc.golpe.categoria; G.cfg.filaAtk = fa; G.cfg.filaAlvo = fb; G.irPara(0.3); const B = G.palco._b; return JSON.stringify({ a: [Math.round(B.atk.homeX), B.atk.homeG], t: [Math.round(B.alvo.homeX), B.alvo.homeG], cena: !!B.cena, outros: B.all.filter(f => f !== B.atk && f !== B.alvo).every(f => !f.naCena) }); }, [fa, fb, cat]);
  const r1 = await pos('fundo', 'fundo', 'rush'), r2 = await pos('frente', 'meio', 'rush');
  ok(r1 === r2 && JSON.parse(r1).cena, 'palco: rush mostra a cena, igual em qualquer fileira ' + r1);
  const n1 = await pos('fundo', 'fundo', 'normal'), n2 = await pos('frente', 'meio', 'normal');
  ok(n1 === r1 && n2 === r1, 'palco: normal também vira cena (mesmo palco)');
  const corte = await p.evaluate(async () => { const B = FF.Estudio.Golpes.palco._b; const mv = { categoria: 'normal', roteiro: [{ linha: { duracao: 1, trilhas: [{ tipo: 'acertos', clipes: [{ tipo: 'acerto', t: 0.1 }] }] } }] }; return [B.querCena(B.atk, B.alvo, mv), FF.Battle.categoria(mv)]; });
  ok(corte[0] === true, 'golpe normal pede cena no jogo (cenas ligadas)');
  // pontos de tela (Mover para x) caem no mesmo lugar com qualquer tamanho de time
  const ponto = async (ali) => {
    await p.evaluate(async (ali) => { const G = FF.Estudio.Golpes; await G.aplicarCfg(Object.assign({}, G.cfg, { aliadosAlvo: ali, filaAtk: null, filaAlvo: null }), true); }, ali);
    await p.waitForFunction((n) => { const G = FF.Estudio.Golpes; return G.palco._b && G.palco._b.all.length === n; }, 2 + ali.length, { timeout: 30000 });
    return p.evaluate(() => { const G = FF.Estudio.Golpes; G.doc.golpe.categoria = 'rush'; const tr = G.doc.linha.trilhas.find(t => t.quem === 'alvo'); if (!tr.clipes.some(c => c.id === 'tst')) tr.clipes.push({ id: 'tst', tipo: 'mover', t: 0.05, d: 0.1, para: 'x', x: 100, y: -50 }); G.irPara(0.3); const B = G.palco._b; return [Math.round(B.alvo.x), Math.round(B.alvo.y)].join(','); });
  };
  const p1 = await ponto([]), p3 = await ponto(['nappa', 'vegeta']);
  ok(p1 === p3, 'cena: ponto da tela igual em 1×1 e 1×3 (' + p1 + ' / ' + p3 + ')');
  await p.evaluate(() => { const G = FF.Estudio.Golpes; G.doc.linha.trilhas.forEach(t => (t.clipes = t.clipes.filter(c => c.id !== 'tst'))); });
  // na luta (⚔ Na batalha): durante a cena só os dois aparecem; no fim volta tudo
  await p.evaluate(async () => { const G = FF.Estudio.Golpes; await G.aplicarCfg(Object.assign({}, G.cfg, { aliadosAlvo: ['nappa'], filaAtk: null, filaAlvo: null }), true); });
  await p.waitForFunction(() => { const G = FF.Estudio.Golpes; return G.defs.nappa && G.palco._b && G.palco._b.all.length === 3; }, null, { timeout: 30000 });
  await p.evaluate(() => { const G = FF.Estudio.Golpes; G.doc.golpe.categoria = 'rush'; G.naBatalha(); });
  await p.waitForFunction(() => FF.Estudio.Golpes.palco._b && FF.Estudio.Golpes.palco._b.cena, null, { timeout: 15000 });
  const dur = await p.evaluate(() => { const B = FF.Estudio.Golpes.palco._b; return { atores: B.all.filter(f => f.naCena).length, todos: B.all.length, escala: B.scale }; });
  ok(dur.atores === 2 && dur.todos >= 3 && dur.escala === 2.5, 'na luta: só quem ataca e o alvo na cena ' + JSON.stringify(dur));
  await p.waitForFunction(() => { const B = FF.Estudio.Golpes.palco._b; return B && !B.cena && FF.Estudio.Golpes.palco._fimBatalha; }, null, { timeout: 30000 });
  const fim = await p.evaluate(() => { const B = FF.Estudio.Golpes.palco._b; return { naCena: B.all.filter(f => f.naCena).length, homes: B.all.map(f => Math.round(f.x) === Math.round(f.homeX)) }; });
  ok(fim.naCena === 0, 'no fim: volta para a formação ' + JSON.stringify(fim));
  ok(!erros.length, 'sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
})();
