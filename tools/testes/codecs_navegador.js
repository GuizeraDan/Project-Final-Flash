// Testes de js/estudio/codecs.js que dependem do navegador (Playwright + Chrome).
// Uso: node tools/testes/codecs_navegador.js   → imprime "codecs navegador ok" (sai com código 1 se falhar)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const raiz = path.resolve(__dirname, '..', '..');
const base = fs.existsSync('/tmp/claude-0') ? '/tmp/claude-0' : require('os').tmpdir();
const TMP = fs.mkdtempSync(path.join(base, 'codecs-nav-'));
const pagina = path.join(TMP, 'teste.html');
fs.writeFileSync(pagina, '<!doctype html><meta charset="utf-8"><body><script src="file://' +
  path.join(raiz, 'js/estudio/codecs.js') + '"></script></body>');

// APNG de referência gerado pelo Pillow (opcional)
let apng = null;
try {
  const ap = path.join(TMP, 'a.png');
  execFileSync('python3', ['-I', '-W', 'ignore', '-c', `import sys
from PIL import Image
fr=[Image.new('RGBA',(8,6),(255,0,0,255)),Image.new('RGBA',(8,6),(0,0,255,255)),Image.new('RGBA',(8,6),(0,255,0,128))]
fr[0].save(sys.argv[1],save_all=True,append_images=fr[1:],duration=[100,200,300],loop=0)`, ap]);
  apng = Array.from(fs.readFileSync(ap));
} catch (e) { console.log('(sem Pillow: pulando APNG)'); }

(async () => {
  const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
  const b = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  const errosPagina = [];
  p.on('pageerror', e => errosPagina.push(e.message));
  await p.goto('file://' + pagina);
  const r = await p.evaluate(async (apng) => {
    const C = FF.Codecs, I = FF.Imagem, res = [];
    const checar = (c, m) => res.push([!!c, m]);
    const pixel = (canvas, x, y) => Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data).join();
    const solido = (w, h, cor) => { const im = I.criar(w, h); for (let i = 0; i < w * h; i++) im.rgba.set(cor, i * 4); return im; };

    // GIF animado gerado pelo nosso codificador
    const q = [solido(16, 12, [255, 0, 0, 255]), solido(16, 12, [0, 128, 255, 255]), I.criar(16, 12)];
    q[2].rgba.set([1, 2, 3, 255], 0);
    const gif = C.gifCodificar(q.map((im, i) => ({ rgba: im.rgba, largura: 16, altura: 12, atraso: 0.1 * (i + 1) })));
    const blobGif = new File([gif], 'anim.gif');
    checar(typeof ImageDecoder !== 'undefined', 'Chrome tem ImageDecoder');
    let d = await C.decodificarArquivo(blobGif);
    checar(d.tipo === 'animacao' && d.itens[0].quadros.length === 3, 'GIF via ImageDecoder: 3 quadros (' + d.tipo + ', ' + d.itens[0].quadros.length + ')');
    checar(pixel(d.itens[0].quadros[1].canvas, 5, 5) === '0,128,255,255', 'GIF via ImageDecoder: cor do quadro 2');
    checar(Math.abs(d.itens[0].quadros[2].atraso - 0.3) < 1e-6, 'GIF via ImageDecoder: atraso 0.3 (' + d.itens[0].quadros[2].atraso + ')');
    checar(pixel(d.itens[0].quadros[2].canvas, 5, 5).endsWith(',0'), 'GIF via ImageDecoder: transparência + disposal');
    // sem ImageDecoder: cai no decodificador próprio
    const guardado = window.ImageDecoder; delete window.ImageDecoder; window.ImageDecoder = undefined;
    d = await C.decodificarArquivo(blobGif);
    checar(d.itens[0].quadros.length === 3 && pixel(d.itens[0].quadros[0].canvas, 1, 1) === '255,0,0,255', 'GIF sem ImageDecoder: decodificador próprio');
    if (apng) {
      d = await C.decodificarArquivo(new File([new Uint8Array(apng)], 'x.png'));
      checar(d.itens[0].quadros.length === 3 && pixel(d.itens[0].quadros[1].canvas, 2, 2) === '0,0,255,255', 'APNG sem ImageDecoder: pngQuadros');
    }
    window.ImageDecoder = guardado;
    if (apng) {
      d = await C.decodificarArquivo(new File([new Uint8Array(apng)], 'x.png'));
      checar(d.tipo === 'animacao' && d.itens[0].quadros.length === 3, 'APNG via ImageDecoder: 3 quadros');
      checar(Math.abs(d.itens[0].quadros[1].atraso - 0.2) < 1e-6, 'APNG via ImageDecoder: atraso');
    }

    // PNG estático via canvas
    const img = I.criar(10, 7);
    for (let i = 0; i < 70; i++) img.rgba.set([i * 3, 255 - i, 7, i % 2 ? 255 : 0], i * 4);
    const png = await C.canvasParaPng(I.paraCanvas(img));
    checar(png.type === 'image/png', 'canvasParaPng: blob PNG');
    d = await C.decodificarArquivo(new File([png], 'sem_extensao'));
    const volta = I.deCanvas(d.itens[0].quadros[0].canvas);
    let igual = volta.largura === 10 && volta.altura === 7;
    for (let i = 0; i < 70 && igual; i++) {
      if (img.rgba[i * 4 + 3] !== volta.rgba[i * 4 + 3]) igual = false;
      if (img.rgba[i * 4 + 3] && (img.rgba[i * 4] !== volta.rgba[i * 4] || img.rgba[i * 4 + 1] !== volta.rgba[i * 4 + 1])) igual = false;
    }
    checar(d.tipo === 'imagem' && igual, 'PNG estático: pixels voltam iguais');

    // SVG sem tamanho → 256x256
    d = await C.decodificarArquivo(new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#f00"/></svg>'], 'a.svg'));
    checar(d.itens[0].largura === 256 && pixel(d.itens[0].quadros[0].canvas, 128, 128) === '255,0,0,255', 'SVG sem tamanho: 256x256 (' + d.itens[0].largura + ')');

    // ZIP com imagens em ordem natural
    const png2 = await C.canvasParaPng(I.paraCanvas(solido(4, 4, [0, 255, 0, 255])));
    const png10 = await C.canvasParaPng(I.paraCanvas(solido(5, 5, [0, 0, 255, 255])));
    const zip = C.zipGravar([
      { nome: 'q/frame10.png', dados: new Uint8Array(await png10.arrayBuffer()) },
      { nome: 'q/frame2.png', dados: new Uint8Array(await png2.arrayBuffer()) },
      { nome: 'leia.txt', dados: 'oi' },
      { nome: 'q/anim.gif', dados: gif },
    ]);
    d = await C.decodificarArquivo(new File([zip], 'pacote.zip'));
    checar(d.tipo === 'zip' && d.itens.map(i => i.nome).join() === 'q/anim.gif,q/frame2.png,q/frame10.png', 'ZIP: ordem natural (' + d.itens.map(i => i.nome) + ')');
    checar(d.itens[0].quadros.length === 3 && d.itens[2].largura === 5, 'ZIP: GIF animado e PNG dentro');

    // JSON
    d = await C.decodificarArquivo(new File(['{"x": 1}'], 'dados.json'));
    checar(d.tipo === 'json' && JSON.parse(d.texto).x === 1, 'JSON: devolve o texto');

    // erro claro
    let msg = '';
    try { await C.decodificarArquivo(new File([new Uint8Array([9, 9, 9, 9, 9])], 'x.xyz')); } catch (e) { msg = e.message; }
    checar(/não reconhecido/.test(msg), 'formato desconhecido: erro claro (' + msg + ')');

    // WebM: grava 12 quadros a 12 fps e extrai de volta
    const cores = ['#ff0000', '#00ff00', '#0000ff'];
    const webm = await C.gravarWebm((ctx, i) => { ctx.fillStyle = cores[Math.floor(i / 4)]; ctx.fillRect(0, 0, 64, 48); }, 12, 12, 64, 48);
    checar(webm && webm.size > 0, 'gravarWebm: gerou vídeo (' + (webm && webm.size) + ' bytes)');
    if (webm) {
      d = await C.decodificarArquivo(new File([webm], 'v.webm', { type: 'video/webm' }), { fps: 12 });
      const n = d.itens[0].quadros.length;
      checar(d.tipo === 'video' && n >= 9 && n <= 15, 'vídeo: ' + n + ' quadros a 12 fps');
      const c0 = pixel(d.itens[0].quadros[0].canvas, 30, 20).split(',').map(Number);
      const cf = pixel(d.itens[0].quadros[n - 1].canvas, 30, 20).split(',').map(Number);
      checar(c0[0] > 180 && c0[1] < 80, 'vídeo: 1º quadro vermelho (' + c0 + ')');
      checar(cf[2] > 180 && cf[0] < 80, 'vídeo: último quadro azul (' + cf + ')');
      d = await C.decodificarArquivo(new File([webm], 'v.webm'), { fps: 12, maxQuadros: 3 });
      checar(d.itens[0].quadros.length === 3, 'vídeo: respeita maxQuadros');
    }
    return res;
  }, apng);
  await b.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  let falhas = 0;
  r.forEach(([ok, m]) => { if (!ok) { falhas++; console.error('FALHOU: ' + m); } });
  errosPagina.forEach(e => { falhas++; console.error('ERRO NA PÁGINA: ' + e); });
  if (falhas) { console.error(falhas + ' falha(s)'); process.exit(1); }
  console.log(r.length + ' verificações; codecs navegador ok');
})().catch(e => { console.error(e); process.exit(1); });
