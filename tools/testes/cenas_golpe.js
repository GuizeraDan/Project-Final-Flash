// Teste: 🎬 cenas de golpe — 💥 rush / 🔥 supremo cortam para a cena (só quem ataca e o alvo, palco fixo, igual em
// qualquer fileira), 👊 normal fica na formação; na luta os outros somem durante a cena e tudo volta no fim.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes&personagem=goku&golpe=combo');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.doc && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const ok = (c, m) => { console.log((c ? 'ok: ' : 'FALHOU: ') + m); if (!c) process.exitCode = 1; };
  const cats = await p.evaluate(() => { const d = FF.Estudio.Golpes.defs.goku; const g = (id) => { for (const f of Object.values(d.formas)) if (f.golpes && f.golpes[id]) return f.golpes[id]; return d.golpes && d.golpes[id]; }; return { combo: FF.Battle.categoria(g('combo')), kame: FF.Battle.categoria(g('kamehameha')), sup: FF.Battle.categoria({ supremo: true, roteiro: [] }), manual: FF.Battle.categoria({ categoria: 'rush', roteiro: [] }) }; });
  ok(cats.combo === 'rush' && cats.kame === 'normal' && cats.sup === 'supremo' && cats.manual === 'rush', 'classificação automática ' + JSON.stringify(cats));
  const pos = (fa, fb, cat) => p.evaluate(([fa, fb, cat]) => { const G = FF.Estudio.Golpes; if (cat) G.doc.golpe.categoria = cat; else delete G.doc.golpe.categoria; G.cfg.filaAtk = fa; G.cfg.filaAlvo = fb; G.irPara(0.3); const B = G.palco._b; return JSON.stringify({ a: [Math.round(B.atk.homeX), B.atk.homeG], t: [Math.round(B.alvo.homeX), B.alvo.homeG], cena: !!B.cena, outros: B.all.filter(f => f !== B.atk && f !== B.alvo).every(f => !f.naCena) }); }, [fa, fb, cat]);
  const r1 = await pos('fundo', 'fundo', 'rush'), r2 = await pos('frente', 'meio', 'rush');
  ok(r1 === r2 && JSON.parse(r1).cena, 'palco: rush mostra a cena, igual em qualquer fileira ' + r1);
  const n1 = await pos('fundo', 'fundo', 'normal'), n2 = await pos('frente', 'meio', 'normal');
  ok(n1 !== n2 && !JSON.parse(n1).cena, 'palco: normal fica na formação (muda com a fileira)');
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
