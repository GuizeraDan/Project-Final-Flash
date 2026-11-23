// Teste do ⬇ Baixar / ⬆ Trazer de volta da aba Sprites (js/estudio/sprites_io.js)
// Ida e volta pela folha PNG, ZIP e APNG: mesmos quadros, mesma origem, mesmos pixels.
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const RAIZ = require('path').resolve(__dirname, '..', '..');
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--allow-file-access-from-files'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const msgs = [];
  p.on('pageerror', e => msgs.push('pageerror: ' + e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + RAIZ + '/estudio.html?aba=sprites&sprite=bills&anim=Parado');
  await p.waitForFunction(() => FF.Estudio && FF.Estudio.pronto && FF.Estudio.Sprites.st.set, null, { timeout: 20000 });

  // botões e menu
  ok(await p.isVisible('.ess-baixar') && await p.isVisible('.ess-trazer'), 'botões ⬇ Baixar e ⬆ Trazer de volta na barra');
  await p.click('.ess-baixar');
  await p.waitForSelector('.es-io button[data-formato="folha"]');
  ok(await p.locator('.es-io button[data-formato]').count() === 4, 'menu com folha, ZIP, APNG e GIF');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.es-io button[data-formato="folha"]')]);
  ok(/bills__Parado\.png$/.test(dl.suggestedFilename()), 'baixa a folha: ' + dl.suggestedFilename());
  await p.evaluate(() => document.querySelectorAll('.es-modal').forEach(m => m._fechar && m._fechar()));

  // ida e volta: compara cada quadro desenhado na mesma posição (pés em 200,300)
  const r = await p.evaluate(async () => {
    const S = FF.Estudio.Sprites, IO = FF.EstudioIO;
    const desenhar = (set, a) => a.frames.map(f => {
      const c = document.createElement('canvas'); c.width = 400; c.height = 400;
      FF.drawFrame(c.getContext('2d'), set, f, 200, 300, 1, false);
      return c.getContext('2d').getImageData(0, 0, 400, 400).data;
    });
    const igual = (A, B) => { if (A.length !== B.length) return false; for (let k = 0; k < A.length; k++) { const x = A[k], y = B[k]; for (let i = 3; i < x.length; i += 4) if ((x[i] > 0) !== (y[i] > 0) || (x[i] && (x[i - 1] !== y[i - 1] || x[i - 2] !== y[i - 2] || x[i - 3] !== y[i - 3]))) return false; } return true; };
    const ctx0 = S.ctxIO(), antes = desenhar(ctx0.set, ctx0.anim), n0 = ctx0.anim.frames.length, durs = ctx0.anim.frames.map(f => f[7] || 1);
    const out = { n0 };
    for (const fmt of ['folha', 'zip', 'apng']) {
      const ctx = S.ctxIO();
      const e = await IO.exportar(ctx, fmt);
      const arq = new File([e.dados], e.nome, { type: e.mime });
      const lido = await IO.lerArquivo(arq, ctx);
      const m = await IO.montar(ctx, lido);
      out[fmt] = { n: m.anim.frames.length, meta: !!lido.meta, igual: igual(antes, desenhar(m.set, m.anim)), durs: JSON.stringify(m.anim.frames.map(f => f[7])) === JSON.stringify(durs) };
    }
    const g = await IO.exportar(S.ctxIO(), 'gif');
    out.gif = g.dados.length > 100 && String.fromCharCode(g.dados[0], g.dados[1], g.dados[2]) === 'GIF';
    // folha sem os dados do Estúdio (editor apagou o tEXt): geometria vem da animação aberta
    const e2 = await IO.exportar(S.ctxIO(), 'folha');
    const c = document.createElement('canvas'); const img = await createImageBitmap(new Blob([e2.dados]));
    c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
    const limpo = await new Promise(res => c.toBlob(res, 'image/png'));
    const l2 = await IO.lerArquivo(new File([limpo], 'editada.png', { type: 'image/png' }), S.ctxIO());
    const m2 = await IO.montar(S.ctxIO(), l2);
    out.semMeta = { meta: !!l2.meta, n: m2.anim.frames.length, igual: igual(antes, desenhar(m2.set, m2.anim)) };
    // substituir (fica no editor, Ctrl+Z desfaz) e nova animação (salva no jogo)
    S.ctxIO().substituir(m2.anim, m2.set);
    out.sujo = S.sujo();
    S.ctxIO().criar('Parado_editada', m2.anim, m2.set);
    out.nova = S.st.nome === 'Parado_editada' && !!(FF.Edicoes.dados().sprites.bills || {}).Parado_editada;
    return out;
  });
  ['folha', 'zip', 'apng'].forEach(f => ok(r[f].n === r.n0 && r[f].meta && r[f].igual && r[f].durs, f + ': ' + r[f].n + '/' + r.n0 + ' quadros, dados ' + r[f].meta + ', pixels e origem iguais ' + r[f].igual + ', durações ' + r[f].durs));
  ok(r.gif, 'GIF gerado');
  ok(!r.semMeta.meta && r.semMeta.n === r.n0 && r.semMeta.igual, 'folha sem os dados do Estúdio volta igual (geometria da animação aberta)');
  ok(r.sujo, 'substituir deixa a animação "não salva" no editor');
  ok(r.nova, 'importar como nova cria e salva "Parado_editada"');
  ok(!msgs.length, 'sem erros na página' + (msgs.length ? ': ' + msgs.join(' | ') : ''));
  await b.close();
})();
