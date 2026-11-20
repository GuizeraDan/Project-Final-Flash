// Teste do modo ↔ Raio (aba Sprites): sugerir o trecho, prévia, raio elástico no motor e "Estender raio".
// Precisa de um servidor http (leitura de pixels): o teste sobe um na porta 8765.
const { chromium } = require('playwright');
const path = require('path'), os = require('os');
const { spawn } = require('child_process');
(async () => {
  const raiz = path.resolve(__dirname, '..', '..');
  const srv = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.route('https://api.github.com/**', r => r.abort());
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  let falhas = 0;
  const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'ok: ' : 'FALHOU: ') + m); };
  try {
    await p.goto('http://127.0.0.1:8765/estudio.html?aba=sprites&sprite=krillin&anim=Special_Kamehameha_Chao_Pt5');
    await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Sprites && FF.Estudio.Sprites.st.anim, null, { timeout: 20000 });
    await p.waitForTimeout(400);
    await p.click('.ess-modos button:has-text("↔ Raio")');
    await p.waitForTimeout(150);
    await p.click('button:has-text("🪄 Sugerir")');
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const st = FF.Estudio.Sprites.st; return { raio: st.anim.raio, f: st.anim.frames[0].slice(0, 7) }; });
    ok(r.raio && r.raio.x1 > r.raio.x0 && r.raio.x0 > 0, 'trecho sugerido: ' + JSON.stringify(r.raio) + ' quadro ' + JSON.stringify(r.f));
    // arrastar a linha do fim 10 px para a esquerda
    const tela = await p.evaluate(() => {
      const cv = document.querySelector('.ess-palco canvas'), rr = cv.getBoundingClientRect(), st = FF.Estudio.Sprites.st;
      const z = st.zoom * (st.usarEscala ? (st.set.def.escala || 1) : 1), cx = rr.width / 2 + st.panX, cy = rr.height * 0.62 + st.panY, f = st.anim.frames[0];
      const y = rr.top + cy + (f[4] / 2 - f[6]) * z;
      return { x: rr.left + cx + st.anim.raio.x1 * z, y, z };
    });
    const x1Antes = r.raio.x1;
    await p.mouse.move(tela.x, tela.y); await p.mouse.down();
    await p.mouse.move(tela.x - 10 * tela.z, tela.y, { steps: 4 }); await p.mouse.up();
    await p.waitForTimeout(150);
    const x1 = await p.evaluate(() => FF.Estudio.Sprites.st.anim.raio.x1);
    ok(Math.abs(x1 - (x1Antes - 10)) <= 1, 'arrastar a linha do fim: ' + x1Antes + ' → ' + x1);
    // prévia
    await p.fill('.es-campo:has-text("Prévia") input', '300'); await p.press('.es-campo:has-text("Prévia") input', 'Tab');
    await p.waitForTimeout(200);
    await p.screenshot({ path: os.tmpdir() + '/ff_raio_previa.png' });
    // motor: compRaio monta o comprimento pedido
    const comp = await p.evaluate(() => {
      const st = FF.Estudio.Sprites.st, f = st.anim.frames[0], fx = FF.raioDoQuadro(st.anim, 0, f);
      const out = [];
      for (const L of [f[3] - f[5] + 250, f[3] - f[5] + 7, f[3] - f[5] - 5]) { const r = FF.compRaio(st.set.images[f[0]], f[1], f[2], f, fx, L); out.push(r ? r.w - r.ox - L : 'null'); }
      return out;
    });
    ok(comp.every(v => v === 0), 'comprimento montado = pedido (diferenças ' + JSON.stringify(comp) + ')');
    // salvar e conferir que o trecho fica gravado
    await p.click('button:has-text("💾 Salvar no jogo")');
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => !!(FF.Edicoes.dados().sprites.krillin.Special_Kamehameha_Chao_Pt5.raio && FF.Assets.sprites.krillin.anim('Special_Kamehameha_Chao_Pt5').raio)), 'trecho salvo nas edições e no sprite carregado');
    // motor: efeito com ateAlvo "repetir" desenha pelo drawRaio
    const motor = await p.evaluate(() => {
      let chamou = 0; const orig = FF.drawRaio; FF.drawRaio = function () { chamou++; return orig.apply(this, arguments); };
      const set = FF.Assets.sprites.krillin, a = new FF.Animator(set); a.play('Special_Kamehameha_Chao_Pt5', { loop: true });
      const e = { a, set, x: 100, y: 300, flip: false, scale: 1, raioL: 600, corte: 600 };
      const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; const ctx = cv.getContext('2d');
      ctx.save(); ctx.translate(e.x, e.y); FF.drawRaio(ctx, e.set, e.a.a, e.a.i, e.a.frame(), 0, 0, e.scale, e.flip, e.raioL, {}); ctx.restore();
      const d = ctx.getImageData(100 + 560, 0, 1, 720).data; let opaco = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) opaco++;
      FF.drawRaio = orig; return { chamou, opaco };
    });
    ok(motor.opaco > 5, 'raio de 600 px tem desenho perto do fim (' + motor.opaco + ' px opacos na coluna 560)');
    // estender raio → animação nova
    await p.click('button:has-text("↔ Estender raio…")');
    await p.waitForTimeout(200);
    await p.fill('.es-campo:has-text("Mais (px)") input', '200'); await p.press('.es-campo:has-text("Mais (px)") input', 'Tab');
    await p.click('button:has-text("↔ Estender"):not(:has-text("raio"))');
    await p.waitForFunction(() => FF.Estudio.Sprites.st.nome === 'Special_Kamehameha_Chao_Pt5_longo', null, { timeout: 10000 });
    const novo = await p.evaluate(() => { const st = FF.Estudio.Sprites.st; return { f: st.anim.frames.map(f => f[3]), velho: FF.Assets.sprites.krillin.anim('Special_Kamehameha_Chao_Pt5').frames.map(f => f[3]), raio: !!st.anim.raio }; });
    ok(novo.f.every((w, k) => w === novo.velho[k] + 200) && novo.raio, 'animação _longo com +200 px: ' + JSON.stringify(novo));
    await p.screenshot({ path: os.tmpdir() + '/ff_raio_longo.png' });
    ok(!erros.length, 'console: ' + erros.join(' | '));
  } catch (e) { falhas++; console.log('FALHOU: ' + e.message); }
  await b.close(); srv.kill();
  console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
  process.exit(falhas ? 1 : 0);
})();
