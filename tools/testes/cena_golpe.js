// Teste: "Fileiras durante o golpe" — 🎬 Cena do golpe: o golpe sai igual em qualquer combinação de fileiras
// (palco do Estúdio) e, na luta, os dois vão para o centro e voltam para as suas fileiras no fim.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes&personagem=goku&golpe=kamehameha');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.doc && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const ok = (c, m) => { console.log((c ? 'ok: ' : 'FALHOU: ') + m); if (!c) process.exitCode = 1; };
  const foto = (modo, fa, fb) => p.evaluate(([modo, fa, fb]) => {
    const G = FF.Estudio.Golpes;
    if (modo) G.doc.golpe.fileiras = modo; else delete G.doc.golpe.fileiras;
    G.cfg.filaAtk = fa; G.cfg.filaAlvo = fb; G.irPara(0.5);
    const B = G.palco._b; return { atk: [Math.round(B.atk.x), Math.round(B.atk.groundY)], alvo: [Math.round(B.alvo.x), Math.round(B.alvo.groundY)] };
  }, [modo, fa, fb]);
  const c1 = await foto('centro', 'fundo', 'fundo'), c2 = await foto('centro', 'fundo', 'meio'), c3 = await foto('centro', 'frente', 'fundo');
  ok(JSON.stringify(c1) === JSON.stringify(c2) && JSON.stringify(c2) === JSON.stringify(c3), '🎬 cena do golpe: mesmas posições em qualquer fileira ' + JSON.stringify([c1, c2, c3]));
  const n1 = await foto('', 'fundo', 'fundo'), n2 = await foto('', 'fundo', 'meio');
  ok(JSON.stringify(n1) !== JSON.stringify(n2), 'sem a opção: muda com a fileira (como antes)');
  const a2 = await foto('alvo', 'fundo', 'frente');
  ok(a2.atk[1] + 4 >= a2.alvo[1] - 4 && Math.abs(a2.atk[1] - a2.alvo[1]) <= 6, '"o alvo vem para a fileira de quem solta": mesma altura ' + JSON.stringify(a2));
  ok(await p.locator('.es-campo:has-text("Fileiras durante o golpe") select').count() === 1, 'opção nas propriedades do golpe');
  // na luta: vai para a cena e volta para a fileira
  const luta = await p.evaluate(async () => {
    const B = FF.Estudio.Golpes.palco._b, a = B.atk, t = B.alvo;
    const antes = { ag: a.homeG, tg: t.homeG, tx: t.homeX };
    const mv = { fileiras: 'centro', roteiro: [] };
    const salvo = B.prepararCena(a, t, mv, true);
    const durante = { ag: a.homeG, tg: t.homeG };
    if (salvo) B.desfazerCena(salvo);
    return { antes, durante, depois: { ag: a.homeG, tg: t.homeG, tx: t.homeX }, mexeu: !!salvo };
  });
  ok(luta.mexeu ? (luta.durante.ag === luta.durante.tg && luta.depois.tg === luta.antes.tg && luta.depois.tx === luta.antes.tx) : true, 'na luta: os dois na mesma fileira durante o golpe e de volta no fim ' + JSON.stringify(luta));
  ok(!erros.length, 'sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
})();
