// Teste do importador do Estúdio, aberto dentro da aba Sprites (Playwright + Chrome)
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const RAIZ = '/home/claude/project-final-flash';
const OUT = '/tmp/claude-0/imp';
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
  ok(await p.evaluate(() => !FF.Edicoes.conectado()), 'sem chave do GitHub');
  ok(await p.evaluate(() => !FF.Estudio.abas.find(a => a.id === 'importar')), 'não existe mais a aba Importar');
  await p.click('.ess-bt-importar');
  ok(await p.evaluate(() => FF.Estudio.Sprites.st.imp && !document.querySelector('.ess-imp').hidden), '📂 Importar abre o importador dentro da aba Sprites');
  await p.screenshot({ path: OUT + '/1_vazio.png' });

  // ---- arquivos gerados na página
  const arqs = await p.evaluate(async () => {
    const C = FF.Codecs;
    const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
    const cores = ['#e33', '#3c3', '#36f', '#fc0', '#0cc', '#c3c'];
    // folha: 6 bonecos em fundo magenta (3 col × 2 lin, células 40×56)
    const cv = document.createElement('canvas'); cv.width = 120; cv.height = 112;
    const g = cv.getContext('2d');
    g.fillStyle = '#ff00ff'; g.fillRect(0, 0, 120, 112);
    cores.forEach((c, i) => {
      const x = (i % 3) * 40, y = Math.floor(i / 3) * 56;
      g.fillStyle = c; g.fillRect(x + 12, y + 10 + i, 16, 40 - i);   // corpo (altura varia)
      g.fillStyle = '#222'; g.fillRect(x + 16, y + 4 + i, 8, 6);      // cabeça (encostada)
    });
    const folha = new Uint8Array(await (await C.canvasParaPng(cv)).arrayBuffer());
    // GIF de 4 quadros 24×24 (atrasos 0,1 0,1 0,2 0,1)
    const q = [0, 1, 2, 3].map(i => {
      const im = FF.Imagem.criar(24, 24);
      for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
        const o = (y * 24 + x) * 4;
        const dentro = Math.abs(x - 12) < 4 + i * 2 && y > 6;
        im.rgba.set(dentro ? [40 + i * 50, 200, 255 - i * 50, 255] : [0, 0, 0, 0], o);
      }
      return { rgba: im.rgba, largura: 24, altura: 24, atraso: i === 2 ? 0.2 : 0.1 };
    });
    const gif = C.gifCodificar(q);
    // ZIP com 3 PNGs (nomes fora de ordem natural)
    const pngs = [];
    for (const [n, c] of [['q10.png', '#f80'], ['q2.png', '#08f'], ['q1.png', '#0f8']]) {
      const k = document.createElement('canvas'); k.width = 20; k.height = 30;
      const x = k.getContext('2d'); x.fillStyle = c; x.fillRect(4, 2, 12, 28);
      pngs.push({ nome: n, dados: new Uint8Array(await (await C.canvasParaPng(k)).arrayBuffer()) });
    }
    const zip = C.zipGravar(pngs);
    return { folha: b64(folha), gif: b64(gif), zip: b64(zip) };
  });
  fs.writeFileSync(OUT + '/folha.png', Buffer.from(arqs.folha, 'base64'));

  // ---- 1) sprite sheet
  await p.setInputFiles('.imp-input', { name: 'boneco_teste.png', mimeType: 'image/png', buffer: Buffer.from(arqs.folha, 'base64') });
  await p.waitForFunction(() => FF.EstudioImportar._st.vista === 'folha', null, { timeout: 10000 });
  let s = await p.evaluate(() => { const st = FF.EstudioImportar._st; return { n: st.folha.caixas.length, modo: st.folha.cfg.modo, fundo: st.cfg.fundo, cor: st.corAuto }; });
  ok(s.n === 6 && s.modo === 'auto', 'folha: 6 quadros automáticos (' + s.n + ', ' + s.modo + ')');
  ok(s.fundo && s.cor && s.cor.join() === '255,0,255', 'fundo magenta detectado e removido (' + JSON.stringify(s.cor) + ')');
  await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/2_folha.png' });
  // grade 3×2 pelo palpite
  await p.selectOption('.imp-folha-barra select', 'grade');
  s = await p.evaluate(() => { const f = FF.EstudioImportar._st.folha; return { n: f.caixas.length, c: f.cfg.colunas, l: f.cfg.linhas }; });
  ok(s.n === 6 && s.c === 3 && s.l === 2, 'grade 3×2 (' + JSON.stringify(s) + ')');
  // clica na 2ª caixa para tirar e depois pôr de volta
  const box = await p.$('.imp-folha-cv');
  const bb = await box.boundingBox();
  const z = await p.evaluate(() => FF.EstudioImportar._st.folha._z);
  await p.mouse.click(bb.x + 60 * z, bb.y + 28 * z);
  ok(await p.evaluate(() => FF.EstudioImportar._st.folha.caixas.filter(c => c.off).length === 1), 'clique tira uma caixa');
  await p.waitForTimeout(100);
  await p.screenshot({ path: OUT + '/3_folha_grade.png' });
  await p.mouse.click(bb.x + 60 * z, bb.y + 28 * z);
  await p.click('.imp-usar');
  s = await p.evaluate(() => { const st = FF.EstudioImportar._st; return { vista: st.vista, n: st.res.length, r: st.res.map(r => [r.img.largura, r.img.altura, r.ox, r.oy]) }; });
  ok(s.vista === 'anim' && s.n === 6, 'animação com 6 quadros');
  ok(s.r.every(r => r[0] === 16), 'bordas cortadas e fundo removido (largura 16): ' + JSON.stringify(s.r));
  // pés com alinhamento (grade): oy = altura até o chão comum
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/4_anim.png' });
  // arrastar na prévia ajusta o quadro
  const cvb = await (await p.$('.imp-palco canvas')).boundingBox();
  const geo = await p.evaluate(() => { const st = FF.EstudioImportar._st; st.tocando = false; st.sel = 0; return null; });
  await p.waitForTimeout(50);
  const alvo = await p.evaluate(() => { const st = FF.EstudioImportar._st; const cv = document.querySelector('.imp-palco canvas'); const r = st.res[0];
    // centro do quadro na tela
    return null; });
  // usa o centro do canvas onde fica a origem (o desenho fica logo acima)
  const G = await p.evaluate(() => { const cv = document.querySelector('.imp-palco canvas'); return { w: cv.width, h: cv.height }; });
  const gz = await p.evaluate(() => { const st = FF.EstudioImportar._st; return st.cfg.zoom; });
  await p.evaluate(() => { FF.EstudioImportar._st.cfg.zoom = 3; });
  await p.waitForTimeout(50);
  const pos = await p.evaluate(() => {
    const st = FF.EstudioImportar._st, cv = document.querySelector('.imp-palco canvas');
    // repete a conta de geometria(): origem fica no ponto onde o quadro 0 é desenhado
    const r = st.res[0];
    const d = cv.getContext('2d');
    return null;
  });
  // procura um pixel do quadro 0 (vermelho) no canvas
  const px = await p.evaluate(() => {
    const cv = document.querySelector('.imp-palco canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 80 && d[i + 2] < 80) { const k = i / 4; return { x: k % cv.width, y: Math.floor(k / cv.width) }; }
    return null;
  });
  ok(!!px, 'quadro 1 aparece na prévia');
  if (px) {
    await p.mouse.move(cvb.x + px.x + 2, cvb.y + px.y + 6);
    await p.mouse.down();
    await p.mouse.move(cvb.x + px.x + 2 + 9, cvb.y + px.y + 6 - 6, { steps: 4 });
    await p.mouse.up();
    s = await p.evaluate(() => FF.EstudioImportar._st.lista[0]);
    ok(s.dx === 3 && s.dy === -2, 'arrastar ajusta o quadro (dx ' + s.dx + ', dy ' + s.dy + ')');
    // desfazer
    await p.keyboard.press('Control+z');
    s = await p.evaluate(() => FF.EstudioImportar._st.lista[0]);
    ok(s.dx === 0 && s.dy === 0, 'Ctrl+Z desfaz o ajuste');
    await p.keyboard.press('Control+y');
  }
  await p.evaluate(() => { FF.EstudioImportar._st.cfg.zoom = 0; });
  // salvar como sprite novo
  await p.fill('.imp-dir .es-campo-texto input >> nth=0', 'boneco_teste');
  await p.press('.imp-dir .es-campo-texto input >> nth=0', 'Enter');
  await p.fill('.imp-dir .es-campo-texto input >> nth=1', 'Parado');
  await p.press('.imp-dir .es-campo-texto input >> nth=1', 'Enter');
  await p.click('.imp-salvar');
  await p.waitForFunction(() => FF.Estudio.Sprites.st.id === 'boneco_teste' && FF.Estudio.Sprites.st.nome === 'Parado' && !FF.Estudio.Sprites.st.imp, null, { timeout: 10000 });
  ok(true, 'salvar fecha o importador e abre boneco_teste / Parado na aba Sprites');
  await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/5_salvo.png' });
  s = await p.evaluate(async () => {
    const def = FF.Edicoes.dados().spritesNovos.boneco_teste;
    const rec = await FF.ImagensUsr.ler('assets/img/usr/boneco_teste.png');
    FF.Assets.descarregarSprite('boneco_teste');
    const set = await FF.Assets.loadSprite('boneco_teste');
    return { def, blob: rec && rec.blob && rec.blob.size, enviada: rec && rec.enviada, w: set.images[0].width, n: set.anim('Parado').frames.length };
  });
  ok(s.def && s.def.atlases[0] === 'assets/img/usr/boneco_teste.png' && s.def.anims.Parado.frames.length === 6, 'spritesNovos.boneco_teste com 6 quadros');
  ok(s.blob > 0 && s.enviada === false, 'atlas no IndexedDB (pendente, ' + s.blob + ' bytes)');
  ok(s.w > 0 && s.n === 6, 'FF.Assets.loadSprite carrega (' + s.w + ' px)');
  console.log('     def:', JSON.stringify(s.def).slice(0, 300));

  // ---- 2) GIF animado → nova animação no mesmo sprite (＋ Importar com o sprite aberto)
  await p.evaluate(() => FF.Estudio.Sprites.abrirImportador({ destino: 'existente' }));
  await p.setInputFiles('.imp-input', { name: 'aura.gif', mimeType: 'image/gif', buffer: Buffer.from(arqs.gif, 'base64') });
  await p.waitForFunction(() => FF.EstudioImportar._st.res.length === 4, null, { timeout: 10000 });
  s = await p.evaluate(() => { const st = FF.EstudioImportar._st; return { fps: st.cfg.fps, durs: st.lista.map(q => q.dur), fundo: st.cfg.fundo, destino: st.cfg.destino, alvo: st.cfg.alvo }; });
  ok(s.fps === 10 && s.durs.join() === '1,1,2,1', 'GIF: fps 10 e durações 1,1,2,1 (' + s.fps + ' / ' + s.durs + ')');
  ok(!s.fundo, 'GIF transparente: não remove fundo');
  ok(s.destino === 'existente' && s.alvo === 'boneco_teste', 'destino continua no sprite salvo');
  await p.selectOption('.imp-dir .es-campo-select select >> nth=1', 'centro');   // origem (escala é o 1º select)
  await p.fill('.imp-dir .es-campo-texto input >> nth=0', 'Aura');
  await p.press('.imp-dir .es-campo-texto input >> nth=0', 'Enter');
  await p.selectOption('.imp-barra select >> nth=1', 'cenario');
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/6_gif.png' });
  await p.click('.imp-salvar');
  await p.waitForFunction(() => FF.Estudio.Sprites.st.nome === 'Aura' && !FF.Estudio.Sprites.st.imp, null, { timeout: 10000 });
  s = await p.evaluate(async () => {
    const def = FF.Edicoes.dados().spritesNovos.boneco_teste;
    FF.Assets.descarregarSprite('boneco_teste');
    const set = await FF.Assets.loadSprite('boneco_teste');
    // confere um pixel de um quadro antigo (atlas 0) e de um novo (atlas extra)
    const px = (f, x, y) => { const c = document.createElement('canvas'); c.width = f[3]; c.height = f[4]; const g = c.getContext('2d'); g.drawImage(set.images[f[0]], f[1], f[2], f[3], f[4], 0, 0, f[3], f[4]); return Array.from(g.getImageData(x, y, 1, 1).data); };
    const f0 = set.anim('Parado').frames[0], a0 = set.anim('Aura').frames[0];
    return { anims: Object.keys(def.anims), aura: def.anims.Aura, atlases: def.atlases, px: px(f0, 8, f0[4] - 3), pxA: px(a0, Math.floor(a0[3] / 2), a0[4] - 2) };
  });
  ok(s.anims.join() === 'Parado,Aura', 'sprite agora tem Parado e Aura');
  ok(s.aura.frames.length === 4 && s.aura.fps === 10 && s.aura.frames[2][7] === 2, 'Aura: 4 quadros, dur 2 no 3º');
  ok(s.atlases.length === 2 && s.aura.frames[0][0] === 1, 'Aura num atlas extra (' + s.atlases + ')');
  ok(s.px[0] > 200 && s.px[1] < 80 && s.px[3] === 255, 'quadros antigos intactos (' + s.px + ')');
  ok(s.pxA[3] === 255 && s.pxA[1] === 200, 'quadro novo carrega do atlas extra (' + s.pxA + ')');

  // ---- 3) ZIP de PNGs
  await p.evaluate(() => FF.Estudio.Sprites.abrirImportador({ destino: 'novo' }));
  await p.selectOption('.imp-dir .es-campo-select select >> nth=2', 'novo').catch(() => {});
  await p.setInputFiles('.imp-input', { name: 'quadros.zip', mimeType: 'application/zip', buffer: Buffer.from(arqs.zip, 'base64') });
  await p.waitForFunction(() => FF.EstudioImportar._st.lista.length === 3 && FF.EstudioImportar._st.vista === 'anim', null, { timeout: 10000 });
  s = await p.evaluate(() => { const st = FF.EstudioImportar._st; return st.lista.map(q => st.fontes[q.id].nome); });
  ok(s.join() === 'q1.png,q2.png,q10.png', 'ZIP em ordem natural (' + s + ')');
  await p.evaluate(() => { const st = FF.EstudioImportar._st; st.cfg.destino = 'novo'; st.cfg.id = 'barras_zip'; st.cfg.anim = 'Andar'; });
  await p.evaluate(() => FF.EstudioImportar.salvar());
  await p.waitForFunction(() => FF.Estudio.Sprites.st.id === 'barras_zip', null, { timeout: 10000 });
  s = await p.evaluate(async () => { FF.Assets.descarregarSprite('barras_zip'); const set = await FF.Assets.loadSprite('barras_zip'); return set.anim('Andar').frames.length; });
  ok(s === 3, 'sprite barras_zip carregado com 3 quadros');

  // ---- 4) lista de sprites (aba Sprites): renomear animação e apagar sprite
  await p.waitForTimeout(200);
  const itens = await p.$$eval('.ess-sprites .es-item', l => l.map(x => x.dataset.sprite + (x.querySelector('.ess-spr-imp') ? '📥' : '')));
  ok(itens.includes('boneco_teste📥') && itens.includes('barras_zip📥') && itens.includes('gokubase'), 'lista mostra sprites do jogo e importados (📥)');
  await p.click('.ess-sprites .es-item[data-sprite="boneco_teste"]');
  await p.waitForFunction(() => FF.Estudio.Sprites.st.id === 'boneco_teste');
  await p.screenshot({ path: OUT + '/7_lista.png' });
  await p.click('.ess-anim[data-anim="Aura"] .ess-anim-ren');
  await p.fill('.es-modal input', 'Aura Azul');
  await p.click('.es-modal .es-bt-ouro');
  await p.waitForFunction(() => Object.keys(FF.Edicoes.dados().spritesNovos.boneco_teste.anims).join() === 'Parado,Aura_Azul', null, { timeout: 5000 });
  ok(true, 'renomear animação (Parado,Aura_Azul)');
  await p.click('.ess-sprites .es-item[data-sprite="barras_zip"] .ess-anim-apagar');
  await p.click('.es-modal .es-bt-perigo');
  s = await p.evaluate(() => Object.keys(FF.Edicoes.dados().spritesNovos));
  ok(!s.includes('barras_zip'), 'apagar sprite (' + s + ')');
  await p.evaluate(() => FF.Estudio.Sprites.abrirImportador({ destino: 'novo' }));

  // ---- 5) pacote antigo (.ffpacote.json)
  const pac = await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 30; c.height = 20;
    const g = c.getContext('2d'); g.fillStyle = '#f00'; g.fillRect(0, 0, 10, 20); g.fillStyle = '#0f0'; g.fillRect(12, 0, 10, 20);
    return JSON.stringify({ formato: 'finalflash-pacote-1', id: 'bib:raio_velho', nome: 'Raio velho', def: { escala: 1, anims: { Raio: { fps: 8, loop: true, repeatTo: 0, pingpong: false, frames: [[0, 0, 0, 10, 20, 5, 10, 1], [0, 12, 0, 10, 20, 5, 10, 1]] } } }, atlases: [c.toDataURL()] });
  });
  await p.setInputFiles('.imp-input', { name: 'raio_velho.ffpacote.json', mimeType: 'application/json', buffer: Buffer.from(pac) });
  await p.waitForSelector('.imp-pac', { timeout: 5000 });
  await p.click('.imp-pac button:has-text("Salvar tudo")');
  await p.click('.es-perg button.es-bt-ouro');
  await p.waitForFunction(() => FF.Estudio.Sprites.st.id === 'raio_velho', null, { timeout: 10000 });
  s = await p.evaluate(() => FF.Edicoes.dados().spritesNovos.raio_velho);
  ok(s && s.anims.Raio.frames.length === 2 && s.anims.Raio.frames[0][5] === 5, 'pacote antigo virou sprite raio_velho');
  await p.evaluate(() => FF.Estudio.Sprites.abrirImportador({ destino: 'novo' }));

  // ---- 6) JSON de sprite do jogo + PNG
  const jogo = await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 20; c.height = 20;
    const g = c.getContext('2d'); g.fillStyle = '#ff0'; g.fillRect(2, 2, 16, 16);
    const png = new Uint8Array(await (await FF.Codecs.canvasParaPng(c)).arrayBuffer());
    let s = ''; png.forEach(v => (s += String.fromCharCode(v)));
    return { json: JSON.stringify({ id: 'bolinha', atlases: ['assets/img/bolinha_0.png'], anims: { Bola: { fps: 4, loop: false, repeatTo: 0, pingpong: false, frames: [[0, 2, 2, 16, 16, 8, 8, 1]] } } }), png: btoa(s) };
  });
  await p.setInputFiles('.imp-input', [
    { name: 'bolinha.json', mimeType: 'application/json', buffer: Buffer.from(jogo.json) },
    { name: 'bolinha_0.png', mimeType: 'image/png', buffer: Buffer.from(jogo.png, 'base64') },
  ]);
  await p.waitForSelector('.imp-pac:has-text("bolinha")', { timeout: 5000 });
  // editar a animação na área de trabalho
  await p.click('.imp-pac .imp-spr-anim button');
  s = await p.evaluate(() => { const st = FF.EstudioImportar._st; return { n: st.res.length, o: st.cfg.origem, ox: st.res[0].ox, oy: st.res[0].oy }; });
  ok(s.n === 1 && s.o === 'original' && s.ox === 8 && s.oy === 8, 'sprite do jogo + PNG: animação aberta com a origem original');
  await p.screenshot({ path: OUT + '/8_pacote.png' });

  // ---- 7) atlas grande demais
  s = await p.evaluate(async () => {
    const st = FF.EstudioImportar._st;
    const big = FF.Imagem.criar(3000, 3000); big.rgba.fill(255);
    const big2 = FF.Imagem.criar(3000, 3000); big2.rgba.fill(200);
    st.fontes.x1 = { img: big, nome: 'a' }; st.fontes.x2 = { img: big2, nome: 'b' };
    st.lista = [{ id: 'x1', ativo: true, dx: 0, dy: 0, dur: 1 }, { id: 'x2', ativo: true, dx: 0, dy: 0, dur: 1 }];
    st.cfg.origem = 'pes'; st.cfg.destino = 'novo'; st.cfg.id = 'gigante'; st.cfg.anim = 'X'; st.cache = {};
    await FF.EstudioImportar.salvar();
    return !FF.Edicoes.dados().spritesNovos.gigante && [...document.querySelectorAll('.es-aviso.erro')].map(e => e.textContent).join(' | ');
  });
  ok(s && /4096/.test(s), 'atlas > 4096 é recusado com aviso (' + s + ')');

  // ---- vídeo WebM (gravado na página) e colar imagem
  await p.evaluate(() => { const st = FF.EstudioImportar._st; st.cfg.vfps = 6; st.cfg.vmax = 10; });
  const webm = await p.evaluate(async () => {
    const blob = await FF.Codecs.gravarWebm((g, i) => { g.fillStyle = '#000'; g.fillRect(0, 0, 64, 48); g.fillStyle = '#fd0'; g.fillRect(8 + i * 4, 10, 16, 30); }, 12, 12, 64, 48);
    if (!blob) return null;
    const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return btoa(s);
  });
  if (webm) {
    await p.setInputFiles('.imp-input', { name: 'clipe.webm', mimeType: 'video/webm', buffer: Buffer.from(webm, 'base64') });
    await p.waitForFunction(() => FF.EstudioImportar._st.vista === 'anim' && FF.EstudioImportar._st.lista.length >= 3 && FF.EstudioImportar._st.fontes[FF.EstudioImportar._st.lista[0].id].nome === 'clipe.webm', null, { timeout: 20000 });
    s = await p.evaluate(() => ({ n: FF.EstudioImportar._st.lista.length, fps: FF.EstudioImportar._st.cfg.fps, fundo: FF.EstudioImportar._st.cfg.fundo }));
    ok(s.n >= 3 && s.n <= 10 && s.fps === 6 && s.fundo, 'vídeo: ' + JSON.stringify(s) + ' ' + s.n + ' quadros a 6 fps, fundo preto removível');
    await p.waitForTimeout(200);
    await p.screenshot({ path: OUT + '/8b_video.png' });
  } else console.log('(sem MediaRecorder: pulando vídeo)');
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 30; c.height = 40; const g = c.getContext('2d'); g.fillStyle = '#0f0'; g.fillRect(5, 5, 20, 35);
    const blob = await FF.Codecs.canvasParaPng(c);
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'image.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  });
  await p.waitForFunction(() => { const st = FF.EstudioImportar._st; return st.lista.length === 1 && /colada/.test(st.fontes[st.lista[0].id].nome); }, null, { timeout: 5000 });
  ok(true, 'colar imagem (Ctrl+V) importa');
  // com o importador fechado, colar abre ele (uma importação só)
  await p.keyboard.press('Escape');
  ok(await p.evaluate(() => !FF.Estudio.Sprites.st.imp), 'Esc fecha o importador');
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 20; c.height = 20; const g = c.getContext('2d'); g.fillStyle = '#f0f'; g.fillRect(2, 2, 16, 16);
    const blob = await FF.Codecs.canvasParaPng(c);
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'image.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  });
  await p.waitForFunction(() => FF.Estudio.Sprites.st.imp && FF.EstudioImportar._st.lista.length === 1, null, { timeout: 5000 });
  ok(true, 'colar com o importador fechado abre ele e importa uma vez');

  // ---- celular deitado
  await p.evaluate(() => { const st = FF.EstudioImportar._st; st.lista = st.lista.slice(0, 0); });
  await p.setViewportSize({ width: 844, height: 390 });
  await p.setInputFiles('.imp-input', { name: 'aura.gif', mimeType: 'image/gif', buffer: Buffer.from(arqs.gif, 'base64') });
  await p.waitForFunction(() => FF.EstudioImportar._st.res.length === 4, null, { timeout: 10000 });
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/9_celular.png' });
  await p.setInputFiles('.imp-input', { name: 'boneco_teste.png', mimeType: 'image/png', buffer: Buffer.from(arqs.folha, 'base64') });
  await p.waitForFunction(() => FF.EstudioImportar._st.vista === 'folha', null, { timeout: 10000 });
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/10_celular_folha.png' });

  ok(gh === 0, 'nenhuma chamada ao GitHub (' + gh + ')');
  const meus = msgs.filter(m => !/Failed to load resource/.test(m) || true);
  console.log('console:', msgs.length ? '\n  ' + msgs.join('\n  ') : 'limpo');
  ok(!msgs.length, 'console sem erros/avisos');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
