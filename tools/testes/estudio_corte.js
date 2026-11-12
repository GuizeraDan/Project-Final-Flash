const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.route('https://api.github.com/**', r => r.abort());
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') erros.push(m.text()); });
  const ok = (c, m) => console.log((c ? 'ok: ' : 'FALHOU: ') + m);
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=sprites&sprite=nappa&anim=Ultimate_BreakCannon_Pt5');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Sprites && FF.Estudio.Sprites.st.anim, null, { timeout: 20000 });
  await p.waitForTimeout(500);
  await p.click('button:has-text("Todos")');
  await p.click('button:has-text("✂ Cortar")');
  await p.waitForTimeout(200);
  // arrasta no palco: do começo do raio (direita do Nappa) até o fim, na altura do raio
  const box = await p.evaluate(() => { const st = FF.Estudio.Sprites.st, f = st.anim.frames[0]; return { f: f.slice(0, 7) }; });
  console.log('quadro', JSON.stringify(box.f));
  const cv = await p.$('.ess-palco canvas');
  const r = await cv.boundingBox();
  // converte mundo → tela usando a mesma conta da aba (via teste: usa o centro do quadro)
  const pts = await p.evaluate(() => {
    const st = FF.Estudio.Sprites.st, f = st.anim.frames[0];
    // retângulo do raio: de x=+60 até o fim, altura y -70..-20 relativo aos pés
    return { a: [60, -75], b: [f[3] - f[5], -15] };
  });
  // usa uma função do palco exposta? simula com os eventos e a conversão da página
  const tela = await p.evaluate((pts) => {
    const cv = document.querySelector('.ess-palco canvas'); const rr = cv.getBoundingClientRect();
    const st = FF.Estudio.Sprites.st;
    const z = st.zoom * (st.usarEscala ? (st.set.def.escala || 1) : 1);
    const W = rr.width, H = rr.height, cx = W / 2 + st.panX, cy = H * 0.62 + st.panY;
    return [pts.a, pts.b].map(([x, y]) => [rr.left + cx + x * z, rr.top + cy + y * z]);
  }, pts);
  await p.mouse.move(tela[0][0], tela[0][1]); await p.mouse.down();
  await p.mouse.move(tela[1][0], tela[1][1], { steps: 6 }); await p.mouse.up();
  await p.waitForTimeout(200);
  const corte = await p.evaluate(() => FF.Estudio.Sprites.st.corte);
  ok(corte && corte.x1 - corte.x0 > 100, 'retângulo marcado: ' + JSON.stringify(corte));
  await p.screenshot({ path: require('os').tmpdir() + '/ff_corte1.png' });
  await p.selectOption('.es-campo:has-text("Nova origem") select', 'esquerda');
  await p.click('button:has-text("✂ Criar animação nova")');
  await p.waitForSelector('.es-perg input');
  await p.fill('.es-perg input', 'Nappa_Raio');
  await p.click('.es-perg button:has-text("OK")');
  await p.waitForTimeout(500);
  const st = await p.evaluate(() => ({ nome: FF.Estudio.Sprites.st.nome, n: FF.Estudio.Sprites.st.anim.frames.length, f: FF.Estudio.Sprites.st.anim.frames[0].slice(0, 7) }));
  ok(st.nome === 'Nappa_Raio' && st.n === 3, 'nova animação: ' + JSON.stringify(st));
  await p.click('button:has-text("💾 Salvar no jogo")');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!FF.Edicoes.dados().sprites.nappa.Nappa_Raio && !!FF.Assets.sprites.nappa.has('Ultimate_BreakCannon_Pt5') && FF.Assets.sprites.nappa.anim('Ultimate_BreakCannon_Pt5').frames[0][3] === 417), 'salva e a original continua intacta');
  await p.screenshot({ path: require('os').tmpdir() + '/ff_corte2.png' });
  ok(!erros.length, 'console: ' + erros.join(' | '));
  await b.close();
})();
