// Teste: 🪪 clipe "Cartão" na entrada da cena — o cartão aparece quando o clipe manda (com sons/efeitos junto), as
// entradas padrão já trazem o clipe, entrada salva sem ele = sem cartão, "♪ Som do cartão" do golpe toca.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes&personagem=goku&golpe=combo');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.doc && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const ok = (c, m) => { console.log((c ? 'ok: ' : 'FALHOU: ') + m); if (!c) process.exitCode = 1; };
  const pad = await p.evaluate(() => ['normal', 'rush', 'supremo'].map(t => FF.CenaGolpe.padrao('entrada', t).trilhas.some(tr => tr.clipes.some(c => c.tipo === 'cartao'))));
  ok(pad.every(Boolean), 'entradas padrão já trazem o clipe 🪪 Cartão ' + JSON.stringify(pad));
  // palco: abrir a entrada Rush (todos) mostra o cartão no instante do clipe
  const pv = await p.evaluate(async () => {
    const G = FF.Estudio.Golpes;
    const orig = FF.CenaGolpe.salva.bind(FF.CenaGolpe); window._salvaOrig = orig;
    FF.CenaGolpe.salva = (q, t, id) => (q === 'entrada' && t === 'rush') ? null : orig(q, t, id);   // usa a padrão do jogo
    G.abrirCena('entrada', 'rush', 'padrao'); await new Promise(r => setTimeout(r, 300));
    const tem = G.doc.linha.trilhas.some(tr => tr.clipes.some(c => c.tipo === 'cartao'));
    G.irPara(0.2); const antes = !!G.palco._b.cartaoAtk; G.irPara(0.8); const ca = G.palco._b.cartaoAtk;
    return { tem, antes, depois: !!ca, texto: ca && ca.texto };
  });
  ok(pv.tem && !pv.antes && pv.depois && pv.texto === 'Nome do golpe', 'palco: o cartão aparece no instante do clipe ' + JSON.stringify(pv));
  // na luta: entrada própria (cartão ANTES do corte, com som) + som do golpe; o golpe espera o cartão sair
  await p.evaluate(() => {
    const G = FF.Estudio.Golpes, orig = window._salvaOrig;
    FF.CenaGolpe.salva = (q, t, id) => (q === 'entrada' && t === 'rush') ? { duracao: 0.8, trilhas: FF.CenaGolpe.trilhas([{ id: 'k', tipo: 'cartao', t: 0, d: 0.6, estilo: 'zoom' }, { id: 'c', tipo: 'corte', t: 0.7 }], [{ id: 's', tipo: 'som', t: 0, som: 'som_da_entrada' }]) } : orig(q, t, id);
    G.abrirGolpe('goku', 'combo');
  });
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const G = FF.Estudio.Golpes; G.doc.golpe.categoria = 'rush'; G.doc.golpe.somCartao = 'som_do_golpe';
    window._r = { sons: [] }; const pl = FF.Audio.play; FF.Audio.play = function (n) { _r.sons.push(n); return pl.apply(this, arguments); };
    const oc = FF.Battle.prototype.cartao; FF.Battle.prototype.cartao = function () { if (_r.cartao == null) { _r.cartao = FF.Clock.t; _r.cenaNoCartao = !!this.cena; } const x = oc.apply(this, arguments); _r.estilo = this.cartaoAtk.estilo; _r.ate = this.cartaoAtk.until; return x; };
    if (!FF.Linha._tocarOrig2) FF.Linha._tocarOrig2 = FF.Linha.tocar;
    FF.Linha.tocar = function (bb) { if (_r.golpe == null) _r.golpe = FF.Clock.t; return FF.Linha._tocarOrig2.apply(this, arguments); };
    G.naBatalha();
  });
  await p.waitForFunction(() => window._r.golpe != null, null, { timeout: 20000 });
  const r = await p.evaluate(() => _r);
  ok(r.cartao != null && !r.cenaNoCartao && r.estilo === 'zoom', 'na luta: cartão aparece pelo clipe, antes do corte (na formação), com zoom');
  ok(r.sons.includes('som_da_entrada') && r.sons.includes('som_do_golpe'), 'sons: o da entrada e o "♪ Som do cartão" do golpe');
  ok(r.golpe >= r.ate + 0.24 && r.golpe - r.cartao < 1.5, '⏳ golpe começa depois do cartão sair (' + (r.golpe - r.cartao).toFixed(2) + ' s)');
  await p.waitForFunction(() => FF.Estudio.Golpes.palco._fimBatalha, null, { timeout: 30000 });
  // entrada salva sem o clipe = sem cartão
  await p.evaluate(() => {
    const G = FF.Estudio.Golpes, orig = window._salvaOrig;
    FF.CenaGolpe.salva = (q, t, id) => (q === 'entrada' && t === 'rush') ? { semCartao: true, duracao: 0.2, trilhas: FF.CenaGolpe.trilhas([{ id: 'c', tipo: 'corte', t: 0.1 }]) } : orig(q, t, id);
    window._r = {}; G.naBatalha();
    const f = () => { const B = G.palco._b; if (B && B.cartaoAtk) _r.viu = true; if (!G.palco._fimBatalha) setTimeout(f, 30); }; setTimeout(f, 50);
  });
  await p.waitForTimeout(400);
  await p.waitForFunction(() => FF.Estudio.Golpes.palco._fimBatalha, null, { timeout: 30000 });
  ok(!(await p.evaluate(() => _r.viu)), 'entrada salva sem o clipe 🪪 = sem cartão');
  ok(!erros.length, 'sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
})();
