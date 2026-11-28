// Teste: 🛡 regra da defesa — se o último acerto (ou o único) for defendido, a trilha do Alvo e os efeitos presos no
// alvo depois dele não tocam (o alvo fica na guarda e recua); "seDefender" muda por clipe; palco "🛡 Defendido".
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes&personagem=goku&golpe=combo');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.doc && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const ok = (c, m) => { console.log((c ? 'ok: ' : 'FALHOU: ') + m); if (!c) process.exitCode = 1; };
  // clipes de teste depois do último acerto
  const tUlt = await p.evaluate(() => {
    const G = FF.Estudio.Golpes, L = G.doc.linha;
    const ac = L.trilhas.find(t => t.tipo === 'acertos').clipes; const t = Math.max(...ac.map(c => c.t || 0));
    const T = (tipo, quem) => L.trilhas.find(x => x.tipo === tipo && (!quem || x.quem === quem));
    T('lutador', 'alvo').clipes.push({ id: 'dA', tipo: 'mover', t: t + 0.05, d: 0.2, para: 'x', x: 1100, animMov: 'lancado' });
    T('efeitos').clipes.push({ id: 'dE', tipo: 'efeito', t: t + 0.05, fx: 'hit3', em: 'alvo', d: 1 }, { id: 'dT', tipo: 'efeito', t: t + 0.05, fx: 'hit3', em: 'alvo', d: 1, seDefender: 'tocar' }, { id: 'dQ', tipo: 'efeito', t: t + 0.05, fx: 'hit3', em: 'atacante', d: 1 });
    L.duracao = Math.max(L.duracao, t + 1.2);
    return t;
  });
  ok(await p.evaluate(() => /Se o último golpe for defendido/.test((FF.Estudio.Golpes.sel = 'dE', FF.Estudio.Golpes.renderProps(), document.body.innerText))), 'opção "🛡 Se o último golpe for defendido" nas propriedades do clipe');
  const ver = (def) => p.evaluate(([def, t]) => {
    const G = FF.Estudio.Golpes; G.ckDefendido.checked = def; G.ckDefendido.onchange();
    G.irPara(t + 0.4); const B = G.palco._b, fx = new Set(B.fxList.map(e => e._clipe));
    return { mover: Math.round(B.alvo.x) > 1000, efAlvo: fx.has('dE'), efTocar: fx.has('dT'), efAtk: fx.has('dQ') };
  }, [def, tUlt]);
  const normal = await ver(false), defendido = await ver(true);
  ok(normal.mover && normal.efAlvo && normal.efTocar && normal.efAtk, 'sem defesa: tudo toca ' + JSON.stringify(normal));
  ok(!defendido.mover && !defendido.efAlvo && defendido.efTocar && defendido.efAtk, 'defendido: trilha do Alvo e efeito no alvo não tocam; "toca mesmo assim" e o de quem solta tocam ' + JSON.stringify(defendido));
  // na luta: a IA defende o golpe
  await p.evaluate(() => {
    const G = FF.Estudio.Golpes; G.ckDefendido.checked = false; G.ckDefendido.onchange();
    window._d = { clipes: [] }; FF.Battle.prototype.guardaDaIA = () => 'bom';
    const od = FF.Linha.disparar; FF.Linha.disparar = function (bb, viva, c) { _d.clipes.push(c.id); return od.apply(this, arguments); };
    G.naBatalha();
  });
  await p.waitForFunction(() => FF.Estudio.Golpes.palco._fimBatalha, null, { timeout: 30000 });
  const d = await p.evaluate(() => _d.clipes);
  ok(!d.includes('dA') && !d.includes('dE') && d.includes('dT'), 'na luta (IA defendeu): queda do alvo não tocou');
  ok(!erros.length, 'sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
})();
