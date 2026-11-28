// Teste: 🪪 cartão de ataque — importar uma imagem nas propriedades do golpe, recortar, salvar no golpe; na luta o
// cartão aparece com a arte e o nome; a aba Personagens tem a arte padrão.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const png = '/tmp/arte_teste_cartao.png';
  if (!fs.existsSync(png)) {   // imagem de teste 600×400 (degradê)
    const zlib = require('zlib'), w = 600, h = 400, linhas = [];
    for (let y = 0; y < h; y++) { const l = Buffer.alloc(1 + w * 4); for (let x = 0; x < w; x++) l.set([x * 255 / w, y * 255 / h, 180, 255], 1 + x * 4); linhas.push(l); }
    const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const ch = (tp, d) => { const L = Buffer.alloc(4); L.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(tp), d]); const C = Buffer.alloc(4); C.writeUInt32BE(crc(td)); return Buffer.concat([L, td, C]); };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih.set([8, 6, 0, 0, 0], 8);
    fs.writeFileSync(png, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(Buffer.concat(linhas))), ch('IEND', Buffer.alloc(0))]));
  }
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + path.resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes&personagem=goku&golpe=combo');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.doc && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const ok = (c, m) => { console.log((c ? 'ok: ' : 'FALHOU: ') + m); if (!c) process.exitCode = 1; };
  await p.evaluate(() => { const G = FF.Estudio.Golpes; G.sel = null; G.renderProps(); });
  ok(/Cartão de ataque/.test(await p.evaluate(() => document.body.innerText)), 'propriedades do golpe com "🪪 Cartão de ataque"');
  // importar: abre a tela, escolhe o arquivo, usa
  await p.evaluate(() => { const bt = [...document.querySelectorAll('button')].find(x => /Importar imagem/.test(x.textContent) && x.closest('.es-arte-painel')); bt.click(); });
  await p.waitForSelector('.es-arte input[type=file]', { state: 'attached' });
  await (await p.$('.es-arte input[type=file]')).setInputFiles(png);
  await p.waitForFunction(() => !!FF.Assets.images.__arte_previa, null, { timeout: 10000 });
  await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/cartao_recorte.png', clip: await (await p.$('.es-modal-caixa')).boundingBox() });
  await p.evaluate(() => [...document.querySelectorAll('.es-arte button')].find(x => /Usar esta arte/.test(x.textContent)).click());
  await p.waitForTimeout(500);
  const arte = await p.evaluate(async () => { const g = FF.Estudio.Golpes.doc.golpe; const r = g.arte && await FF.ImagensUsr.ler(g.arte.img); return { arte: g.arte, blob: !!(r && r.blob), proporcao: g.arte ? +(g.arte.w / g.arte.h).toFixed(2) : 0 }; });
  ok(arte.arte && /^assets\/img\/usr\/arte_goku_combo_/.test(arte.arte.img) && arte.blob, 'imagem guardada no aparelho e presa no golpe ' + (arte.arte && arte.arte.img));
  ok(Math.abs(arte.proporcao - 520 / 170) < 0.05, 'recorte na proporção do cartão (' + arte.proporcao + ')');
  ok(await p.evaluate(() => { const g = FF.Estudio.Golpes.montarGolpe(); return !!(g.arte && g.arte.img); }), 'salvar o golpe leva a arte junto');
  // na luta: o cartão aparece com a arte
  await p.evaluate(() => { const G = FF.Estudio.Golpes; window._ca = null; G.naBatalha(); const f = () => { const B = G.palco._b; if (B && B.cartaoAtk && !_ca) _ca = { texto: B.cartaoAtk.texto, img: B.cartaoAtk.arte && B.cartaoAtk.arte.img, pronta: !!FF.Cartao.img(B.cartaoAtk.arte) }; if (!_ca) setTimeout(f, 30); }; f(); });
  await p.waitForFunction(() => window._ca, null, { timeout: 15000 });
  await p.waitForTimeout(250);
  await p.screenshot({ path: '/tmp/cartao_luta.png', clip: await (await p.$('.es-palco-wrap')).boundingBox() });
  const ca = await p.evaluate(() => _ca);
  ok(ca.texto && /arte_goku_combo_/.test(ca.img) && ca.pronta, 'na luta: cartão com a arte e o nome "' + ca.texto + '"');
  await p.waitForFunction(() => FF.Estudio.Golpes.palco._fimBatalha, null, { timeout: 30000 });
  // ⏳ gatilho: o golpe só começa depois que o cartão sai (ligado por padrão); desligado = junto
  const gap = async (esperar) => {
    await p.evaluate((esperar) => {
      const G = FF.Estudio.Golpes; if (esperar) delete G.doc.golpe.esperarCartao; else G.doc.golpe.esperarCartao = false;
      window._g = {}; if (!FF.Linha._tocarOrig) FF.Linha._tocarOrig = FF.Linha.tocar;
      FF.Linha.tocar = function (b) { if (_g.golpe == null && b.cartaoAtk) _g.golpe = FF.Clock.t - b.cartaoAtk.start; return FF.Linha._tocarOrig.apply(this, arguments); };
      G.naBatalha();
    }, esperar);
    await p.waitForFunction(() => window._g.golpe != null, null, { timeout: 20000 });
    const r = await p.evaluate(() => _g.golpe);
    await p.waitForFunction(() => FF.Estudio.Golpes.palco._fimBatalha, null, { timeout: 30000 });
    return r;
  };
  const com = await gap(true), sem = await gap(false);
  ok(com >= 1.3 + 0.25 - 0.05 && sem < 0.2, '⏳ golpe começa depois do cartão sair (' + com.toFixed(2) + ' s) e, desligado, junto (' + sem.toFixed(2) + ' s)');
  // aba Personagens
  await p.evaluate(() => FF.Estudio.abrir('personagens'));
  await p.waitForTimeout(800);
  await p.evaluate(() => { const it = [...document.querySelectorAll('.es-item')].find(e => /Goku/.test(e.textContent)); if (it) it.click(); });
  await p.waitForTimeout(1200);
  ok(/Arte de ataque \(padrão\)/.test(await p.evaluate(() => document.body.innerText)), 'Personagens: grupo "🪪 Arte de ataque (padrão)"');
  ok(!erros.length, 'sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
})();
