// Testes das partes puras de js/estudio/codecs.js (sem DOM).
// Uso: node tools/testes/codecs.js     → imprime "codecs ok" (sai com código 1 se algo falhar)
// Usa python3 (zipfile e, se houver, Pillow) para gerar arquivos de referência em /tmp/claude-0/.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Codecs, Imagem } = require('../../js/estudio/codecs.js');

const TMP = fs.mkdtempSync(path.join(fs.existsSync('/tmp/claude-0') ? '/tmp/claude-0' : require('os').tmpdir(), 'codecs-'));
let falhas = 0, ok = 0;
function checar(cond, msg) { if (cond) ok++; else { falhas++; console.error('FALHOU: ' + msg); } }
function igual(a, b, msg) { checar(a === b, msg + ' (esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a) + ')'); }
function py(codigo, ...args) { return execFileSync('python3', ['-I', '-W', 'ignore', '-c', codigo, ...args], { encoding: 'utf8' }); }
let temPIL = true;
try { py('import PIL'); } catch (e) { temPIL = false; console.log('(Pillow ausente: pulando testes cruzados com PIL)'); }

function img(w, h, f) { // f(x, y) -> [r,g,b,a]
  const im = Imagem.criar(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = f(x, y); if (!c) continue; im.rgba.set(c, (y * w + x) * 4);
  }
  return im;
}
function mesmosPixels(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

(async () => {
  // ---------------- CRC32
  igual(Codecs.crc32(new TextEncoder().encode('123456789')), 0xCBF43926, 'crc32("123456789")');
  igual(Codecs.crc32(new Uint8Array(0)), 0, 'crc32 vazio');
  igual(Codecs.crc32('The quick brown fox jumps over the lazy dog'), 0x414FA339, 'crc32 frase');

  // ---------------- ZIP store: gravar e ler
  const arquivos = [
    { nome: 'quadros/frame10.png', dados: new Uint8Array([1, 2, 3, 4, 5]) },
    { nome: 'quadros/frame2.png', dados: 'olá, mundo' },
    { nome: 'ação.json', dados: '{"a":1}' },
  ];
  const zip = Codecs.zipGravar(arquivos);
  const lidos = await Codecs.zipLer(zip);
  igual(lidos.length, 3, 'zip store: quantidade');
  igual(lidos[2].nome, 'ação.json', 'zip store: nome UTF-8');
  igual(new TextDecoder().decode(lidos[1].dados), 'olá, mundo', 'zip store: texto');
  checar(mesmosPixels(lidos[0].dados, arquivos[0].dados), 'zip store: binário');
  // o zip gravado tem que abrir no Python (CRC e cabeçalhos corretos)
  const zpath = path.join(TMP, 'store.zip'); fs.writeFileSync(zpath, zip);
  const testePy = py('import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps([z.testzip(), z.namelist()]))', zpath);
  igual(JSON.stringify(JSON.parse(testePy)), JSON.stringify([null, ['quadros/frame10.png', 'quadros/frame2.png', 'ação.json']]), 'zip store: Python valida');
  igual(['frame10.png', 'frame2.png', 'frame1.png'].sort(Codecs.ordemNatural).join(), 'frame1.png,frame2.png,frame10.png', 'ordem natural');

  // ---------------- ZIP deflate gerado pelo Python (com pasta)
  const dpath = path.join(TMP, 'deflate.zip');
  py(`import zipfile,sys
z=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED)
z.writestr('pasta/', '')
z.writestr('pasta/texto.txt', 'repete '*1000)
z.writestr('bin.dat', bytes(range(256))*20)
z.writestr('vazio.txt', '')
z.close()`, dpath);
  const ld = await Codecs.zipLer(fs.readFileSync(dpath));
  igual(ld.map(e => e.nome).join(), 'pasta/texto.txt,bin.dat,vazio.txt', 'zip deflate: ignora pasta');
  igual(new TextDecoder().decode(ld[0].dados), 'repete '.repeat(1000), 'zip deflate: texto');
  igual(ld[1].dados.length, 5120, 'zip deflate: tamanho binário');
  igual(Codecs.crc32(ld[1].dados), Number(py('import zlib; print(zlib.crc32(bytes(range(256))*20))')), 'zip deflate: crc binário');
  igual(ld[2].dados.length, 0, 'zip deflate: arquivo vazio');
  // zip do sistema (Info-ZIP), se existir
  try {
    const zdir = path.join(TMP, 'zsis'); fs.mkdirSync(zdir);
    fs.writeFileSync(path.join(zdir, 'a.txt'), 'abc'.repeat(500));
    execFileSync('zip', ['-q', '-r', path.join(TMP, 'sis.zip'), '.'], { cwd: zdir });
    const ls = await Codecs.zipLer(fs.readFileSync(path.join(TMP, 'sis.zip')));
    igual(ls.length === 1 && new TextDecoder().decode(ls[0].dados), 'abc'.repeat(500), 'zip do sistema');
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  // método não suportado: erro em português
  const bz = path.join(TMP, 'bz.zip');
  py(`import zipfile,sys
z=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_BZIP2); z.writestr('x.txt','oi'*100); z.close()`, bz);
  let msg = '';
  try { await Codecs.zipLer(fs.readFileSync(bz)); } catch (e) { msg = e.message; }
  checar(/método de compressão 12/.test(msg), 'zip bzip2: erro claro (' + msg + ')');

  // ---------------- GIF: round-trip exato (≤ 255 cores, opaco)
  const W = 37, H = 23;
  const cores = [];
  for (let i = 0; i < 200; i++) cores.push([(i * 37) & 255, (i * 91) & 255, (i * 13 + 7) & 255, 255]);
  const q1 = img(W, H, (x, y) => cores[(x * 7 + y * 3) % 200]);
  const q2 = img(W, H, (x, y) => cores[(x + y * 11) % 200]);
  let gif = Codecs.gifCodificar([{ rgba: q1.rgba, largura: W, altura: H, atraso: 0.05 }, { rgba: q2.rgba, largura: W, altura: H, atraso: 0.2 }], { loop: true });
  let dec = Codecs.gifDecodificar(gif);
  igual(dec.largura + 'x' + dec.altura, W + 'x' + H, 'gif: tamanho');
  igual(dec.quadros.length, 2, 'gif: quadros');
  igual(dec.loop, 0, 'gif: loop infinito');
  igual(dec.quadros[0].atraso, 0.05, 'gif: atraso 1');
  igual(dec.quadros[1].atraso, 0.2, 'gif: atraso 2');
  checar(mesmosPixels(dec.quadros[0].rgba, q1.rgba), 'gif: quadro 1 idêntico');
  checar(mesmosPixels(dec.quadros[1].rgba, q2.rgba), 'gif: quadro 2 idêntico');
  const gifExato = gif;

  // imagem grande com muitas cores: força o LZW a encher a tabela (clear codes) e o median cut
  const GW = 300, GH = 200;
  const grande = img(GW, GH, (x, y) => [x & 255, y & 255, (x ^ y) & 255, 255]);
  gif = Codecs.gifCodificar([{ rgba: grande.rgba, largura: GW, altura: GH }], { loop: false });
  dec = Codecs.gifDecodificar(gif);
  igual(dec.loop, null, 'gif grande: sem loop');
  let erroMax = 0, erroSoma = 0;
  for (let i = 0; i < grande.rgba.length; i += 4) for (let c = 0; c < 3; c++) {
    const e = Math.abs(dec.quadros[0].rgba[i + c] - grande.rgba[i + c]); erroSoma += e; if (e > erroMax) erroMax = e;
  }
  const erroMedio = erroSoma / (GW * GH * 3);
  checar(erroMedio < 12, 'gif grande: erro médio da quantização baixo (' + erroMedio.toFixed(2) + ')');
  checar(dec.quadros[0].rgba[3] === 255, 'gif grande: opaco');
  // ruído com 255 cores e 512x512: muitos clears, tem que voltar exato
  const NW = 512, NH = 512; let semente = 12345;
  const rnd = () => (semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pal255 = Array.from({ length: 255 }, (_, i) => [i, 255 - i, (i * 7) & 255, 255]);
  const ruido = img(NW, NH, () => pal255[Math.floor(rnd() * 255)]);
  dec = Codecs.gifDecodificar(Codecs.gifCodificar([{ rgba: ruido.rgba, largura: NW, altura: NH }]));
  checar(mesmosPixels(dec.quadros[0].rgba, ruido.rgba), 'gif ruído 255 cores 512x512: idêntico');

  // transparência (alfa < 128 vira transparente; 128+ vira opaco) e disposal 2
  const t1 = img(20, 20, (x, y) => (x < 10 ? [255, 0, 0, 255] : x < 15 ? [0, 0, 255, 200] : [0, 255, 0, 60]));
  const t2 = img(20, 20, (x, y) => (y < 5 ? [9, 9, 9, 255] : null));
  gif = Codecs.gifCodificar([{ rgba: t1.rgba, largura: 20, altura: 20, atraso: 0.1 }, { rgba: t2.rgba, largura: 20, altura: 20, atraso: 0.1 }]);
  dec = Codecs.gifDecodificar(gif);
  const px = (q, x, y) => Array.from(dec.quadros[q].rgba.subarray((y * 20 + x) * 4, (y * 20 + x) * 4 + 4)).join();
  igual(px(0, 2, 2), '255,0,0,255', 'gif transp: opaco');
  igual(px(0, 12, 2), '0,0,255,255', 'gif transp: alfa 200 vira opaco');
  igual(px(0, 17, 2), '0,0,0,0', 'gif transp: alfa 60 vira transparente');
  igual(px(1, 2, 2), '9,9,9,255', 'gif transp: quadro 2 desenhado');
  igual(px(1, 2, 10), '0,0,0,0', 'gif transp: disposal 2 limpou o quadro anterior');
  // paleta global
  dec = Codecs.gifDecodificar(Codecs.gifCodificar([{ rgba: q1.rgba, largura: W, altura: H }, { rgba: q2.rgba, largura: W, altura: H }], { paletaGlobal: true }));
  checar(mesmosPixels(dec.quadros[1].rgba, q2.rgba), 'gif paleta global: idêntico');

  // ---------------- GIF: cruzado com o Pillow
  if (temPIL) {
    const g1 = path.join(TMP, 'nosso.gif'); fs.writeFileSync(g1, gifExato);
    const r = py(`import sys
from PIL import Image
im=Image.open(sys.argv[1]); n=0; px=[]
try:
  while True:
    px.append(im.convert('RGBA').getpixel((5,7))); n+=1; im.seek(im.tell()+1)
except EOFError: pass
print(n, px[0][:3], px[1][:3])`, g1).trim();
    const c1 = q1.rgba.subarray((7 * W + 5) * 4, (7 * W + 5) * 4 + 3), c2 = q2.rgba.subarray((7 * W + 5) * 4, (7 * W + 5) * 4 + 3);
    igual(r, `2 (${c1.join(', ')}) (${c2.join(', ')})`, 'gif: Pillow lê o nosso GIF');
    // GIF entrelaçado + disposal 3 + paleta local feito pelo Pillow
    const g2 = path.join(TMP, 'pil.gif');
    const esperado = JSON.parse(py(`import sys,json
from PIL import Image
fr=[]
for i in range(3):
  im=Image.new('P',(31,17),0)
  im.putpalette([0,0,0, 200,10,10, 10,200,10, 10,10,200]+[0]*756)
  for x in range(31):
    for y in range(17):
      if (x+y+i)%3: im.putpixel((x,y),1+((x*y+i)%3))
  fr.append(im)
fr[0].save(sys.argv[1],save_all=True,append_images=fr[1:],duration=[70,120,30],loop=2,interlace=True,disposal=1)
out=[]
im=Image.open(sys.argv[1])
for i in range(3):
  im.seek(i); out.append(list(im.convert('RGB').getdata())[:200])
print(json.dumps(out))`, g2));
    dec = Codecs.gifDecodificar(fs.readFileSync(g2));
    igual(dec.quadros.length, 3, 'gif Pillow: quadros');
    igual(dec.loop, 2, 'gif Pillow: loop 2');
    igual(dec.quadros.map(q => q.atraso).join(), '0.07,0.12,0.03', 'gif Pillow: atrasos');
    let bate = true;
    for (let qi = 0; qi < 3; qi++) for (let i = 0; i < 200; i++) {
      const e = esperado[qi][i], o = dec.quadros[qi].rgba;
      if (o[i * 4] !== e[0] || o[i * 4 + 1] !== e[1] || o[i * 4 + 2] !== e[2]) bate = false;
    }
    checar(bate, 'gif Pillow (entrelaçado): pixels iguais aos do Pillow');

    // ---------------- APNG do Pillow (com transparência e quadros parciais)
    const ap = path.join(TMP, 'anim.png');
    py(`import sys
from PIL import Image
fr=[]
for i in range(4):
  im=Image.new('RGBA',(24,16),(0,0,0,0))
  for x in range(24):
    for y in range(16):
      if (x//4+i)%2: im.putpixel((x,y),(x*10,y*15,i*60,255 if y<8 else 128))
  fr.append(im)
fr[0].save(sys.argv[1],save_all=True,append_images=fr[1:],duration=[100,50,200,100],loop=0,disposal=1,blend=0)`, ap);
    const pq = await Codecs.pngQuadros(fs.readFileSync(ap));
    checar(pq && pq.quadros.length === 4, 'apng: 4 quadros');
    if (pq) {
      igual(pq.quadros.map(q => q.atraso).join(), '0.1,0.05,0.2,0.1', 'apng: atrasos');
      const ok3 = JSON.parse(py(`import sys,json
from PIL import Image
im=Image.open(sys.argv[1]); im.seek(3); print(json.dumps(list(im.convert('RGBA').getdata())))`, ap));
      let bateA = true;
      ok3.forEach((e, i) => { for (let c = 0; c < 4; c++) if (pq.quadros[3].rgba[i * 4 + c] !== e[c]) bateA = false; });
      checar(bateA, 'apng: quadro 4 igual ao do Pillow');
    }
    // PNG estático paleta 4 bits e RGB 16 bits
    const p4 = path.join(TMP, 'p4.png'), p16 = path.join(TMP, 'p16.png');
    py(`import sys
from PIL import Image
im=Image.new('P',(13,5)); im.putpalette([i*5 for i in range(48)])
for x in range(13):
  for y in range(5): im.putpixel((x,y),(x+y)%16)
im.save(sys.argv[1],bits=4)
im2=Image.new('I;16',(9,4))
for x in range(9):
  for y in range(4): im2.putpixel((x,y),x*7000+y)
im2.save(sys.argv[2])`, p4, p16);
    const s4 = await Codecs.pngQuadros(fs.readFileSync(p4));
    igual(Array.from(s4.quadros[0].rgba.subarray((2 * 13 + 3) * 4, (2 * 13 + 3) * 4 + 4)).join(), '75,80,85,255', 'png paleta 4 bits');
    const s16 = await Codecs.pngQuadros(fs.readFileSync(p16));
    igual(s16.quadros[0].rgba[(1 * 9 + 2) * 4], (2 * 7000 + 1) >> 8, 'png cinza 16 bits');
  }
  igual(await Codecs.pngQuadros(gifExato), null, 'pngQuadros de não-PNG = null');

  // ---------------- detectarTipo
  igual(Codecs.detectarTipo(gifExato), 'gif', 'tipo gif');
  igual(Codecs.detectarTipo(zip), 'zip', 'tipo zip');
  igual(Codecs.detectarTipo(new TextEncoder().encode('  <?xml version="1.0"?><svg xmlns="x">')), 'svg', 'tipo svg');
  igual(Codecs.detectarTipo(Uint8Array.from([0x1A, 0x45, 0xDF, 0xA3, 0, 0])), 'webm', 'tipo webm');
  igual(Codecs.detectarTipo(new TextEncoder().encode('\0\0\0\x1cftypisom....')), 'mp4', 'tipo mp4');
  igual(Codecs.detectarTipo(new TextEncoder().encode('\0\0\0\x1cftypavif....')), 'avif', 'tipo avif');
  igual(Codecs.detectarTipo(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'webp', 'tipo webp');
  igual(Codecs.detectarTipo(new TextEncoder().encode(' {"a":1}')), 'json', 'tipo json');
  igual(Codecs.detectarTipo(new Uint8Array([1, 2, 3, 4, 5]), 'x.MOV'), 'mov', 'tipo pela extensão');

  // ---------------- Imagem: removerFundo e aparar
  const fundo = [255, 0, 255, 255];
  const sheet = img(40, 30, (x, y) => {
    if (x >= 5 && x < 12 && y >= 4 && y < 20) return [10, 20, 30, 255];   // sprite A
    if (x >= 20 && x < 35 && y >= 10 && y < 26) return x === 27 && y === 18 ? [250, 5, 250, 255] : [200, 100, 0, 255]; // B com buraco "quase fundo"
    return fundo;
  });
  igual(Imagem.corEm(sheet, 0, 0).join(), '255,0,255,255', 'conta-gotas');
  igual(Imagem.corDeFundo(sheet).join(), '255,0,255,255', 'cor de fundo automática');
  let sem = Imagem.removerFundo(sheet, 'auto', 10);
  igual(Imagem.corEm(sem, 0, 0)[3], 0, 'removerFundo auto: fundo transparente');
  igual(Imagem.corEm(sem, 6, 5)[3], 255, 'removerFundo auto: sprite intacto');
  igual(Imagem.corEm(sem, 27, 18)[3], 0, 'removerFundo global: tira o buraco parecido com o fundo');
  sem = Imagem.removerFundo(sheet, [255, 0, 255], 10, { contiguo: true });
  igual(Imagem.corEm(sem, 27, 18)[3], 255, 'removerFundo contíguo: buraco interno fica');
  igual(Imagem.corEm(sem, 39, 29)[3], 0, 'removerFundo contíguo: borda sai');
  const ap1 = Imagem.aparar(sem);
  igual([ap1.x, ap1.y, ap1.largura, ap1.altura].join(), '5,4,30,22', 'aparar');
  igual(Imagem.aparar(Imagem.criar(5, 5)).largura, 1, 'aparar vazio = 1x1');

  // ---------------- componentes (8-vizinhos, junção de pedaços, poeira, ordem em linhas)
  const comp = img(100, 60, (x, y) => {
    const op = [1, 1, 1, 255];
    if (x >= 60 && x < 80 && y >= 5 && y < 25) return op;    // linha 1, direita
    if (x >= 10 && x < 30 && y >= 8 && y < 28) return op;    // linha 1, esquerda (um pouco mais baixo)
    if (x >= 31 && x < 33 && y >= 5 && y < 8) return op;     // "fio de cabelo" a 1px da esquerda (junta)
    if (x === 50 && y === 50) return op;                      // poeira de 1px
    if (x >= 70 && x < 90 && y >= 35 && y < 55) return op;   // linha 2, direita
    if (x >= 5 && x < 25 && y >= 36 && y < 56) return op;    // linha 2, esquerda
    if (x - 40 === y - 36 && x >= 40 && x < 50) return op;   // diagonal (8-vizinhos = 1 componente)
    return null;
  });
  const cs = Imagem.componentes(comp);
  igual(cs.map(c => [c.x, c.y, c.w, c.h].join(':')).join(' '),
    '10:5:23:23 60:5:20:20 5:36:20:20 40:36:10:10 70:35:20:20', 'componentes: caixas e ordem');
  igual(Imagem.componentes(comp, { juntarDistancia: 0 }).length, 6, 'componentes sem juntar: fio separado');
  igual(Imagem.componentes(comp, { minArea: 1 }).length, 6, 'componentes minArea 1: poeira entra');

  // ---------------- grade e detectarGrade
  const gr = img(96, 64, (x, y) => {   // 4 colunas x 2 linhas de células 24x32, célula (3,1) vazia
    const cx = Math.floor(x / 24), cy = Math.floor(y / 32), lx = x % 24, ly = y % 32;
    if (cx === 3 && cy === 1) return null;
    return lx >= 4 && lx < 20 && ly >= 2 && ly < 30 ? [cx * 50, cy * 100, 9, 255] : null;
  });
  igual(Imagem.grade(gr, 4, 2).length, 7, 'grade: ignora célula vazia');
  igual(Imagem.grade(gr, 4, 2, { ignorarVazios: false }).length, 8, 'grade: todas as células');
  igual(JSON.stringify(Imagem.grade(gr, 4, 2)[5]), '{"x":24,"y":32,"w":24,"h":32}', 'grade: caixa');
  igual(JSON.stringify(Imagem.grade(Imagem.criar(50, 50), 2, 2, { margem: 1, espaco: 2, ignorarVazios: false })[3]), '{"x":26,"y":26,"w":23,"h":23}', 'grade: margem e espaço');
  igual(JSON.stringify(Imagem.detectarGrade(gr)), '{"colunas":4,"linhas":2}', 'detectarGrade transparente');
  // com fundo opaco e sprites encostando no topo da célula
  const gr2 = img(90, 40, (x, y) => (x % 30 >= 3 && x % 30 < 25 && y < 37 ? [0, 0, 0, 255] : [0, 128, 0, 255]));
  igual(JSON.stringify(Imagem.detectarGrade(gr2)), '{"colunas":3,"linhas":1}', 'detectarGrade fundo opaco');
  igual(Imagem.detectarGrade(img(10, 10, () => [1, 2, 3, 255])), null, 'detectarGrade sem grade = null');

  // ---------------- recortar e escalar
  const rc = Imagem.recortar(gr, { x: 28, y: 2, w: 16, h: 28 });
  igual(Imagem.corEm(rc, 0, 0).join(), '50,0,9,255', 'recortar');
  const fora = Imagem.recortar(gr, { x: -2, y: -2, w: 4, h: 4 });
  igual(fora.rgba.length, 64, 'recortar fora dos limites');
  const e2 = Imagem.escalar(rc, 2);
  igual(e2.largura + 'x' + e2.altura, '32x56', 'escalar 2x');
  igual(Imagem.corEm(e2, 31, 55).join(), Imagem.corEm(rc, 15, 27).join(), 'escalar vizinho mais próximo');
  const xadrez = img(2, 1, x => (x ? [255, 255, 255, 255] : [0, 0, 0, 255]));
  const sv = Imagem.escalar(xadrez, 2, true);
  checar(Imagem.corEm(sv, 1, 0)[0] > 0 && Imagem.corEm(sv, 1, 0)[0] < 255, 'escalar suave interpola');
  igual(Imagem.escalar(rc, 0.5).largura, 8, 'escalar 0.5');

  // ---------------- empacotar
  const qs = [];
  for (let i = 0; i < 30; i++) qs.push(img(10 + (i * 7) % 40, 10 + (i * 13) % 50, () => [i, i, i, 255]));
  const at = Imagem.empacotar(qs, { margem: 1, larguraMax: 128 });
  let sobrepoe = false, dentro = true, conteudoOk = true;
  at.posicoes.forEach((p, i) => {
    const a = qs[i];
    if (p.x < 0 || p.y < 0 || p.x + a.largura > at.largura || p.y + a.altura > at.altura) dentro = false;
    at.posicoes.forEach((p2, j) => {
      if (j <= i) return; const b = qs[j];
      if (p.x < p2.x + b.largura && p2.x < p.x + a.largura && p.y < p2.y + b.altura && p2.y < p.y + a.altura) sobrepoe = true;
    });
    const o = ((p.y + a.altura - 1) * at.largura + p.x + a.largura - 1) * 4;
    if (at.rgba[o] !== i || at.rgba[o + 3] !== 255) conteudoOk = false;
  });
  checar(dentro, 'empacotar: tudo dentro'); checar(!sobrepoe, 'empacotar: sem sobreposição'); checar(conteudoOk, 'empacotar: conteúdo copiado');
  checar(at.largura <= 128, 'empacotar: respeita larguraMax');
  // muitos quadros grandes: aumenta a largura até 4096 e sempre cabe
  const muitos = Array.from({ length: 300 }, () => ({ largura: 200, altura: 200, rgba: new Uint8ClampedArray(200 * 200 * 4) }));
  const at2 = Imagem.empacotar(muitos);
  checar(at2.largura > 2048 && at2.largura <= 4096, 'empacotar: alarga até 4096 (' + at2.largura + 'x' + at2.altura + ')');
  igual(at2.posicoes.length, 300, 'empacotar: todas as posições');

  // ---------------- desempenho: sheet 2048x2048
  const t0 = Date.now();
  const big = img(2048, 2048, (x, y) => ((x % 128) > 20 && (x % 128) < 100 && (y % 128) > 10 && (y % 128) < 120 ? [x & 255, y & 255, 0, 255] : [0, 255, 0, 255]));
  const tGera = Date.now() - t0;
  const t1b = Date.now();
  const limpo = Imagem.removerFundo(big, 'auto', 0, { contiguo: true });
  const cBig = Imagem.componentes(limpo);
  const gBig = Imagem.detectarGrade(limpo);
  const tProc = Date.now() - t1b;
  igual(cBig.length, 256, 'sheet 2048: 256 componentes');
  igual(JSON.stringify(gBig), '{"colunas":16,"linhas":16}', 'sheet 2048: grade 16x16');
  checar(tProc < 8000, 'sheet 2048: rápido (' + tProc + ' ms; geração ' + tGera + ' ms)');

  fs.rmSync(TMP, { recursive: true, force: true });
  if (falhas) { console.error(falhas + ' falha(s), ' + ok + ' ok'); process.exit(1); }
  console.log(ok + ' verificações; codecs ok');
})().catch(e => { console.error(e); process.exit(1); });
