// Teste da aba Sprites do Estúdio: imagens do computador direto na animação, animação nova do computador,
// redimensionar pixels, juntar imagens, exportar o sprite inteiro, apagar/renomear (Playwright + Chrome)
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const RAIZ = '/home/claude/project-final-flash';
const OUT = '/tmp/claude-0/spr';
fs.mkdirSync(OUT, { recursive: true });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--allow-file-access-from-files'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const msgs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) msgs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => msgs.push('pageerror: ' + e.message));
  let gh = 0;
  await p.route('https://api.github.com/**', r => { gh++; r.abort(); });
  await p.goto('file://' + RAIZ + '/estudio.html?aba=sprites');
  await p.waitForFunction(() => FF.Estudio && FF.Estudio.pronto && FF.Estudio.Sprites.st.set, null, { timeout: 20000 });

  // arquivos de teste: folha 4 bonecos em fundo branco (como os sprites do Bills) e 3 PNGs soltos 30×40
  const arqs = await p.evaluate(async () => {
    const C = FF.Codecs;
    const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 60;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 160, 60);
    ['#a3f', '#73f', '#53c', '#f80'].forEach((c, i) => { g.fillStyle = c; g.fillRect(i * 40 + 10, 8 + i, 18, 48 - i); g.fillStyle = '#ff0'; g.fillRect(i * 40 + 14, 4 + i, 8, 5); });
    const folha = b64(new Uint8Array(await (await C.canvasParaPng(cv)).arrayBuffer()));
    const soltos = [];
    for (let i = 0; i < 3; i++) {
      const k = document.createElement('canvas'); k.width = 30; k.height = 40;
      const x = k.getContext('2d'); x.fillStyle = ['#e33', '#3e3', '#33e'][i]; x.fillRect(8, 6 + i * 2, 14, 34 - i * 2);
      soltos.push(b64(new Uint8Array(await (await C.canvasParaPng(k)).arrayBuffer())));
    }
    return { folha, soltos };
  });
  const arqSolto = (i) => ({ name: 'q' + (i + 1) + '.png', mimeType: 'image/png', buffer: Buffer.from(arqs.soltos[i], 'base64') });

  // ---- 1) sprite do jogo (gokubase): animação nova "do computador" a partir de uma folha com fundo branco
  await p.evaluate(() => FF.Estudio.Sprites.abrirSprite('gokubase', 'Parado', true));
  await p.waitForFunction(() => FF.Estudio.Sprites.st.id === 'gokubase');
  await p.click('.ess-esq .es-mais:has-text("Nova")');
  await p.fill('.ess-nova input', 'Bola_Energia');
  const esperaArq = p.waitForEvent('filechooser');
  await p.click('.ess-nova button:has-text("Do computador")');
  const fc = await esperaArq;
  await fc.setFiles({ name: 'folha_branca.png', mimeType: 'image/png', buffer: Buffer.from(arqs.folha, 'base64') });
  await p.waitForSelector('.ess-arq-q', { timeout: 10000 });
  let s = await p.evaluate(() => ({ n: document.querySelectorAll('.ess-arq-q').length, info: document.querySelector('.ess-arq .es-dica').textContent }));
  ok(s.n === 4 && /fundo removido/.test(s.info), 'folha com fundo branco: 4 quadros e fundo removido (' + s.info + ')');
  await p.screenshot({ path: OUT + '/1_do_computador.png' });
  await p.click('.ess-arq-ok');
  await p.waitForFunction(() => FF.Estudio.Sprites.st.anim && FF.Estudio.Sprites.st.anim.frames.length === 4, null, { timeout: 10000 });
  s = await p.evaluate(() => { const st = FF.Estudio.Sprites.st; return { nome: st.nome, novo: st.novo, f: st.anim.frames, nAtlas: st.set.def.atlases.length, base: st.set.def._atlasBase, info: FF.Edicoes.dados().spritesInfo.gokubase }; });
  ok(s.nome === 'Bola_Energia' && s.novo, 'animação nova Bola_Energia aberta (ainda não salva)');
  ok(s.info && s.info.atlas && s.info.atlas.length === 1 && s.f.every(f => f[0] === s.base), 'imagens num atlas extra do sprite do jogo (spritesInfo.gokubase.atlas, índice ' + s.base + ')');
  ok(s.f.every(f => f[3] === 18 && f[5] === 9 && f[6] === f[4]), 'quadros cortados com origem nos pés: ' + JSON.stringify(s.f.map(f => f.slice(3, 7))));
  // o branco virou transparente
  s = await p.evaluate(() => { const st = FF.Estudio.Sprites.st, f = st.anim.frames[0]; const c = document.createElement('canvas'); c.width = f[3]; c.height = f[4]; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(st.set.images[f[0]], f[1], f[2], f[3], f[4], 0, 0, f[3], f[4]); return [Array.from(g.getImageData(0, 0, 1, 1).data), Array.from(g.getImageData(9, 20, 1, 1).data)]; });
  ok(s[0][3] === 0 && s[1][3] === 255, 'canto transparente e corpo opaco (' + JSON.stringify(s) + ')');
  await p.click('.ess-barra .es-bt-ouro:has-text("Salvar no jogo")');
  s = await p.evaluate(async () => { FF.Assets.descarregarSprite('gokubase'); const set = await FF.Assets.loadSprite('gokubase'); return { n: set.anim('Bola_Energia').frames.length, mod: !!FF.Edicoes.dados().sprites.gokubase.Bola_Energia, img: set.images[set.anim('Bola_Energia').frames[0][0]].width }; });
  ok(s.n === 4 && s.mod && s.img > 0, 'salva no jogo: gokubase recarrega com Bola_Energia (' + JSON.stringify(s) + ')');

  // ---- 2) sprite importado: inserir PNGs soltos do computador depois do quadro 1
  await p.evaluate(async () => {
    // cria um sprite importado pequeno pela mesma rotina do importador
    const I = FF.Imagem, a = I.criar(10, 20); a.rgba.fill(255);
    await FF.EstudioImportar.gravarSprite('teste_spr', { Parado: { fps: 8, loop: true, frames: [{ img: a, ox: 5, oy: 20, dur: 1 }] } }, { tipo: 'lutador' });
  });
  await p.evaluate(() => FF.Estudio.Sprites.abrirSprite('teste_spr', 'Parado', true));
  await p.waitForFunction(() => FF.Estudio.Sprites.st.id === 'teste_spr');
  const esp2 = p.waitForEvent('filechooser');
  await p.click('.ess-bt-pc');
  await (await esp2).setFiles([arqSolto(2), arqSolto(0), arqSolto(1)]);
  await p.waitForSelector('.ess-arq-q', { timeout: 10000 });
  await p.click('.ess-arq-ok');
  await p.waitForFunction(() => FF.Estudio.Sprites.st.anim.frames.length === 4, null, { timeout: 10000 });
  s = await p.evaluate(() => { const st = FF.Estudio.Sprites.st; return { f: st.anim.frames.map(f => f.slice(0, 7)), sel: [...st.sel], sujo: FF.Estudio.Sprites.sujo() }; });
  ok(s.f[0][0] === 0 && s.f.slice(1).every(f => f[0] === 1), 'quadros novos depois do 1º, num atlas extra');
  ok(s.f[1][4] === 34 && s.f[3][4] === 30, 'ordem natural dos arquivos (q1, q2, q3) e mesma origem nos pés: ' + JSON.stringify(s.f));
  ok(s.sujo && s.sel.join() === '1,2,3', 'animação fica "não salva" com os novos escolhidos');
  await p.keyboard.press('Control+z');
  ok(await p.evaluate(() => FF.Estudio.Sprites.st.anim.frames.length === 1), 'Ctrl+Z desfaz a inserção');
  await p.keyboard.press('Control+y');
  await p.keyboard.press('Control+s');
  s = await p.evaluate(() => { const d = FF.Edicoes.dados(); return { n: d.spritesNovos.teste_spr.anims.Parado.frames.length, atl: d.spritesNovos.teste_spr.atlases.length, mod: !!(d.sprites.teste_spr) }; });
  ok(s.n === 4 && s.atl === 2 && !s.mod, 'sprite importado salva direto em spritesNovos (sem sprites[...]): ' + JSON.stringify(s));
  await p.screenshot({ path: OUT + '/2_inseridos.png' });

  // ---- 3) redimensionar pixels (todos) e desfazer
  s = await p.evaluate(async () => { await FF.Estudio.Sprites.redimensionar(2, true); const st = FF.Estudio.Sprites.st; return st.anim.frames.map(f => f.slice(0, 7)); });
  ok(s[0][3] === 20 && s[0][4] === 40 && s[0][5] === 10 && s[0][6] === 40 && s[1][4] === 68, 'redimensionar 200%: tamanho e origem dobram (' + JSON.stringify(s.slice(0, 2)) + ')');
  ok(s.every(f => f[0] === 2), 'quadros redimensionados num atlas novo');
  await p.waitForTimeout(150);
  await p.screenshot({ path: OUT + '/3_redimensionado.png' });
  await p.keyboard.press('Control+s');

  // ---- 4) juntar imagens (3 atlas → 1)
  await p.click('.ess-props button:has-text("Juntar imagens")');
  await p.waitForFunction(() => FF.Edicoes.dados().spritesNovos.teste_spr.atlases.length === 1, null, { timeout: 10000 });
  s = await p.evaluate(async () => { const st = FF.Estudio.Sprites.st; await new Promise(r => setTimeout(r, 100)); const f = st.set.anim('Parado').frames; return { f: f.map(q => q.slice(0, 7)), atl: st.set.def.atlases }; });
  ok(s.f.every(q => q[0] === 0) && s.f[0][3] === 20 && s.f[1][4] === 68, 'juntar imagens: tudo no atlas 0, tamanhos mantidos (' + JSON.stringify(s.f.slice(0, 2)) + ')');

  // ---- 5) exportar o sprite inteiro
  s = await p.evaluate(async () => { FF.Assets.descarregarSprite('gokubase'); const sp = FF.Estudio.Sprites; await sp.abrirSprite('gokubase', 'Bola_Energia', true); const r = await sp.gerar('spriteTodo', { escala: 1, margem: 1 }); const d = JSON.parse(r.json); return { nome: r.nome, anims: Object.keys(d.anims).length, total: Object.keys(sp.st.set.def.anims).length, bola: d.anims.Bola_Energia.frames.length, zip: r.dados.length }; });
  ok(s.nome === 'gokubase_sprite.zip' && s.anims === s.total && s.bola === 4 && s.zip > 1000, 'exportar sprite inteiro: ' + JSON.stringify(s));

  // ---- 6) não deixa um sprite importado sem animações (o bug do "bills" vazio)
  await p.evaluate(() => FF.Estudio.Sprites.abrirSprite('teste_spr', 'Parado', true));
  await p.waitForFunction(() => FF.Estudio.Sprites.st.id === 'teste_spr');
  await p.click('.ess-barra button:has-text("Salvar como nova")');
  await p.fill('.es-modal input', 'Parado2');
  await p.click('.es-modal .es-bt-ouro');
  await p.waitForFunction(() => FF.Estudio.Sprites.st.nome === 'Parado2');
  s = await p.evaluate(() => { const d = FF.Edicoes.dados(); return { anims: Object.keys(d.spritesNovos.teste_spr.anims), mod: !!d.sprites.teste_spr }; });
  ok(s.anims.join() === 'Parado,Parado2' && !s.mod, '"Salvar como nova" num sprite importado entra no próprio sprite (' + s.anims + ')');
  await p.click('.ess-anim[data-anim="Parado"] .ess-anim-apagar:not(.ess-anim-ren)');
  await p.click('.es-modal .es-bt-perigo');
  await p.waitForFunction(() => Object.keys(FF.Edicoes.dados().spritesNovos.teste_spr.anims).join() === 'Parado2');
  await p.click('.ess-anim[data-anim="Parado2"] .ess-anim-apagar:not(.ess-anim-ren)');
  s = await p.evaluate(() => document.querySelector('.es-modal p') && document.querySelector('.es-modal p').textContent);
  ok(/única animação/.test(s || ''), 'apagar a última animação pergunta se quer apagar o sprite (' + s + ')');
  await p.click('.es-modal button:has-text("Não")');
  ok(await p.evaluate(() => Object.keys(FF.Edicoes.dados().spritesNovos.teste_spr.anims).length === 1), 'recusar mantém a animação');

  // ---- 7) sprite já vazio (como ficou o bills): mostra o que fazer
  await p.evaluate(() => { const d = JSON.parse(JSON.stringify(FF.Edicoes.dados().spritesNovos.teste_spr)); d.anims = {}; FF.Edicoes.set(['spritesNovos', 'teste_spr'], d); FF.Assets.descarregarSprite('teste_spr'); return FF.Estudio.Sprites.abrirSprite('teste_spr', null, true); });
  await p.waitForSelector('.ess-sem-anim', { timeout: 5000 });
  s = await p.evaluate(() => ({ txt: document.querySelector('.ess-sem-anim').textContent, titulo: document.querySelector('.ess-titulo').textContent }));
  ok(/não tem animações/.test(s.txt) && /Trazer do computador/.test(s.txt), 'sprite sem animações: aviso e botões (' + s.titulo + ')');
  await p.screenshot({ path: OUT + '/4_vazio.png' });
  await p.click('.ess-sem-anim button:has-text("Apagar sprite")');
  await p.click('.es-modal .es-bt-perigo');
  await p.waitForFunction(() => FF.Estudio.Sprites.st.id !== 'teste_spr', null, { timeout: 5000 }).catch(() => null);
  s = await p.evaluate(() => ({ existe: !!FF.Edicoes.dados().spritesNovos.teste_spr, id: FF.Estudio.Sprites.st.id }));
  ok(!s.existe && s.id !== 'teste_spr', 'apagar sprite vazio volta para outro sprite (' + s.id + ')');

  // ---- 8) soltar arquivo na aba abre o importador
  await p.evaluate(async (b64) => {
    const u8 = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const dt = new DataTransfer(); dt.items.add(new File([u8], 'solto.png', { type: 'image/png' }));
    const alvo = document.querySelector('.ess-palco');
    alvo.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true }));
    alvo.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, arqs.soltos[0]);
  await p.waitForFunction(() => FF.Estudio.Sprites.st.imp && FF.EstudioImportar._st.lista.length === 1, null, { timeout: 5000 });
  ok(true, 'soltar arquivo na aba Sprites abre o importador com ele');
  await p.screenshot({ path: OUT + '/5_soltar.png' });

  // ---- celular deitado
  await p.keyboard.press('Escape');
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/6_celular.png' });

  ok(gh === 0, 'nenhuma chamada ao GitHub (' + gh + ')');
  console.log('console:', msgs.length ? '\n  ' + msgs.join('\n  ') : 'limpo');
  ok(!msgs.length, 'console sem erros/avisos');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
