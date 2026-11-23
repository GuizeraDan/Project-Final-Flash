// Estúdio Final Flash — baixar uma animação para editar fora (Aseprite, Photoshop, Piskel…) e trazer de volta.
//
// Todos os quadros vão para "células" do mesmo tamanho, com a origem (pés) sempre no mesmo ponto da célula
// (ancora). Assim, ao voltar, cada célula é aparada e a origem é recalculada: o alinhamento continua igual.
//   A · Folha de sprites  <sprite>__<anim>.png        quadros lado a lado (grade se ficar larga demais)
//   B · ZIP de quadros    <sprite>__<anim>_quadros.zip  quadro_01.png … + anim.json
//   C · GIF / APNG        só para ver (GIF perde cores); o APNG também pode voltar
// Os dados (fps, célula, âncora, durações, pontos de disparo) vão no anim.json do ZIP e num bloco tEXt
// "FinalFlash" dos PNG. Se o editor apagar esses dados, a geometria é recalculada a partir da animação aberta.
//
// FF.EstudioIO.baixar(ctx) / FF.EstudioIO.trazer(ctx)
//   ctx = { id, set, nome, anim, substituir(anim, rotulo), criar(nome, anim) }
(function () {
  'use strict';
  const E = FF.Estudio, C = FF.Codecs, I = FF.Imagem;
  const MARGEM = 8;               // espaço livre em volta, para dar para desenhar um pouco além do quadro
  const LARG_MAX = 4096;
  const CHAVE = 'FinalFlash';

  const fpsDe = (a) => (a && a.fps > 0 ? a.fps : 10);
  const nomeArq = (s) => String(s).replace(/[^\w\-]+/g, '_');

  // ------------------------------------------------------------ geometria comum a todos os quadros
  function geometria(anim) {
    let x0 = 0, y0 = 0, x1 = 1, y1 = 1, primeiro = true;
    (anim.frames || []).forEach(f => {
      const w = Math.abs(f[3]), h = Math.abs(f[4]);
      const a = -f[5], b = -f[6], c = w - f[5], d = h - f[6];
      if (primeiro) { x0 = a; y0 = b; x1 = c; y1 = d; primeiro = false; }
      else { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); }
    });
    const W = Math.max(1, Math.ceil(x1 - x0) + MARGEM * 2), H = Math.max(1, Math.ceil(y1 - y0) + MARGEM * 2);
    return { W, H, ax: Math.round(MARGEM - x0), ay: Math.round(MARGEM - y0) };
  }
  function colunasPara(n, W) { return Math.max(1, Math.min(n, Math.floor(LARG_MAX / W) || 1)); }

  function meta(ctx, g, extra) {
    const a = ctx.anim;
    return Object.assign({
      final_flash_anim: 1, sprite: ctx.id, anim: ctx.nome, fps: fpsDe(a), loop: !!a.loop, repeatTo: a.repeatTo || 0,
      celula: [g.W, g.H], ancora: [g.ax, g.ay], n: a.frames.length,
      quadros: a.frames.map(f => { const q = { dur: f[7] || 1 }; if (f[8] && f[8].length) q.pontos = f[8]; return q; }),
    }, extra || {});
  }

  // cada quadro numa célula (canvas) — lança SecurityError se a página veio de file://
  function celulas(ctx, g) {
    return ctx.anim.frames.map(f => {
      const c = document.createElement('canvas'); c.width = g.W; c.height = g.H;
      const x = c.getContext('2d', { willReadFrequently: true });
      const img = ctx.set.images[f[0]];
      if (img && f[3] && f[4]) x.drawImage(img, f[1], f[2], Math.abs(f[3]), Math.abs(f[4]), g.ax - f[5], g.ay - f[6], Math.abs(f[3]), Math.abs(f[4]));
      x.getImageData(0, 0, 1, 1);   // testa se dá para ler (file://)
      return c;
    });
  }

  // ------------------------------------------------------------ PNG: bloco tEXt e APNG
  const u32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  function bloco(tipo, dados) {
    const t = new TextEncoder().encode(tipo);
    const corpo = new Uint8Array(4 + dados.length); corpo.set(t, 0); corpo.set(dados, 4);
    const out = new Uint8Array(12 + dados.length);
    out.set(u32(dados.length), 0); out.set(corpo, 4); out.set(u32(C.crc32(corpo)), 8 + dados.length);
    return out;
  }
  function textoPng(obj) {
    const k = new TextEncoder().encode(CHAVE), v = new TextEncoder().encode(JSON.stringify(obj));
    const d = new Uint8Array(k.length + 1 + v.length); d.set(k, 0); d.set(v, k.length + 1);   // latin-1 na teoria; o JSON vai em ASCII/UTF-8
    return bloco('tEXt', d);
  }
  const juntar = (partes) => { const n = partes.reduce((s, p) => s + p.length, 0), o = new Uint8Array(n); let i = 0; partes.forEach(p => { o.set(p, i); i += p.length; }); return o; };
  // põe um bloco logo depois do IHDR
  function comBloco(png, b) { const fim = 8 + 25; return juntar([png.subarray(0, fim), b, png.subarray(fim)]); }
  function lerTexto(u8) {
    if (!(u8[0] === 137 && u8[1] === 80 && u8[2] === 78 && u8[3] === 71)) return null;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let p = 8;
    while (p + 8 <= u8.length) {
      const len = dv.getUint32(p), tipo = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
      if (tipo === 'tEXt' || tipo === 'iTXt') {
        const d = u8.subarray(p + 8, p + 8 + len), z = d.indexOf(0);
        if (z > 0 && new TextDecoder().decode(d.subarray(0, z)) === CHAVE) {
          let resto = d.subarray(z + 1);
          if (tipo === 'iTXt') { let k = 2, nul = 0; while (k < resto.length && nul < 2) { if (resto[k] === 0) nul++; k++; } resto = resto.subarray(k); }
          try { return JSON.parse(new TextDecoder().decode(resto)); } catch (e) { return null; }
        }
      }
      if (tipo === 'IEND') break;
      p += 12 + len;
    }
    return null;
  }
  async function deflate(u8) {
    const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  function linhasCruas(rgba, w, h) {
    const out = new Uint8Array(h * (w * 4 + 1));
    for (let y = 0; y < h; y++) { out[y * (w * 4 + 1)] = 0; out.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1); }
    return out;
  }
  async function apngCodificar(quadros, W, H, loop, extra) {
    const partes = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])];
    partes.push(bloco('IHDR', Uint8Array.from([...u32(W), ...u32(H), 8, 6, 0, 0, 0])));
    partes.push(bloco('acTL', Uint8Array.from([...u32(quadros.length), ...u32(loop ? 0 : 1)])));
    if (extra) partes.push(extra);
    let seq = 0;
    for (let i = 0; i < quadros.length; i++) {
      const q = quadros[i], ms = Math.max(1, Math.round(q.atraso * 1000));
      const num = Math.min(65535, ms), den = 1000;
      partes.push(bloco('fcTL', Uint8Array.from([...u32(seq++), ...u32(W), ...u32(H), 0, 0, 0, 0, 0, 0, 0, 0, num >> 8, num & 255, den >> 8, den & 255, 1, 0])));
      const z = await deflate(linhasCruas(q.rgba, W, H));
      if (i === 0) partes.push(bloco('IDAT', z));
      else { const d = new Uint8Array(4 + z.length); d.set(u32(seq++), 0); d.set(z, 4); partes.push(bloco('fdAT', d)); }
    }
    partes.push(bloco('IEND', new Uint8Array(0)));
    return juntar(partes);
  }
  const pngDe = async (canvas) => new Uint8Array(await (await C.canvasParaPng(canvas)).arrayBuffer());

  // ------------------------------------------------------------ exportar
  async function exportar(ctx, formato) {
    const a = ctx.anim;
    if (!a || !a.frames.length) throw new Error('A animação não tem quadros.');
    const g = geometria(a), cels = celulas(ctx, g), base = nomeArq(ctx.id) + '__' + nomeArq(ctx.nome);
    const fps = fpsDe(a), atraso = (f) => (f[7] || 1) / fps;
    if (formato === 'folha') {
      const cols = colunasPara(cels.length, g.W), lin = Math.ceil(cels.length / cols);
      const c = document.createElement('canvas'); c.width = g.W * cols; c.height = g.H * lin;
      const x = c.getContext('2d');
      cels.forEach((cel, k) => x.drawImage(cel, (k % cols) * g.W, Math.floor(k / cols) * g.H));
      const png = comBloco(await pngDe(c), textoPng(meta(ctx, g, { formato: 'folha', colunas: cols })));
      return { nome: base + '.png', dados: png, mime: 'image/png', info: cels.length + ' quadros de ' + g.W + '×' + g.H + ' px (' + cols + ' por linha)' };
    }
    if (formato === 'zip') {
      const arqs = [];
      for (let k = 0; k < cels.length; k++) arqs.push({ nome: 'quadro_' + String(k + 1).padStart(2, '0') + '.png', dados: await pngDe(cels[k]) });
      arqs.push({ nome: 'anim.json', dados: JSON.stringify(meta(ctx, g, { formato: 'zip' }), null, 1) });
      return { nome: base + '_quadros.zip', dados: C.zipGravar(arqs), mime: 'application/zip', info: cels.length + ' PNG de ' + g.W + '×' + g.H + ' px' };
    }
    const rgba = cels.map(c => c.getContext('2d').getImageData(0, 0, g.W, g.H).data);
    if (formato === 'gif') {
      const q = rgba.map((d, k) => ({ largura: g.W, altura: g.H, rgba: d, atraso: atraso(a.frames[k]) }));
      return { nome: base + '.gif', dados: C.gifCodificar(q, { loop: !!a.loop }), mime: 'image/gif', info: 'GIF (cores reduzidas: só para ver)' };
    }
    if (formato === 'apng') {
      if (typeof CompressionStream === 'undefined') throw new Error('Este navegador não sabe gravar APNG.');
      const q = rgba.map((d, k) => ({ rgba: d, atraso: atraso(a.frames[k]) }));
      const png = await apngCodificar(q, g.W, g.H, !!a.loop, textoPng(meta(ctx, g, { formato: 'apng' })));
      return { nome: base + '_animado.png', dados: png, mime: 'image/png', info: 'PNG animado sem perda' };
    }
    throw new Error('Formato desconhecido: ' + formato);
  }

  function erroTxt(e) {
    if (e && e.name === 'SecurityError') return 'O navegador bloqueou a leitura das imagens porque a página foi aberta direto do disco (file://). Abra o Estúdio pelo site (GitHub Pages).';
    return (e && e.message) || String(e);
  }

  function baixar(ctx) {
    if (!ctx.anim || !ctx.anim.frames.length) { E.aviso('Abra uma animação com quadros.', 'erro'); return; }
    const c = E.el('div', 'es-io');
    c.appendChild(E.el('p', null, 'Baixar <b></b> para editar fora do Estúdio. Todos os quadros saem do mesmo tamanho, com os pés no mesmo ponto — não mude o tamanho da célula para o alinhamento continuar certo ao trazer de volta.'));
    c.querySelector('b').textContent = ctx.id + ' / ' + ctx.nome;
    const ops = [
      ['folha', '🧩 Folha de sprites (PNG)', 'Quadros lado a lado. Abre direto no Aseprite (Importar sprite sheet, com o tamanho da célula), Photoshop, Piskel…'],
      ['zip', '🗜 ZIP com um PNG por quadro', 'quadro_01.png, quadro_02.png… Bom para editar quadro a quadro em qualquer programa.'],
      ['apng', '🎞 PNG animado (APNG)', 'Animação sem perda de cor. Dá para ver no navegador e também trazer de volta.'],
      ['gif', '🎞 GIF animado', 'Para ver ou mandar para alguém. Perde cores: não use para editar e trazer de volta.'],
    ];
    const info = E.el('div', 'es-dica');
    ops.forEach(([f, t, d]) => {
      const l = E.el('div', 'es-io-op');
      const b = E.botao(t, async () => {
        b.disabled = true; info.textContent = '⏳ Gerando…';
        try { const r = await exportar(ctx, f); C.baixar(r.dados, r.nome, r.mime); info.textContent = '⬇ ' + r.nome + ' — ' + r.info + '.'; }
        catch (e) { info.textContent = '❌ ' + erroTxt(e); }
        b.disabled = false;
      }, d, f === 'folha' || f === 'zip' ? 'es-bt-ouro' : '');
      b.dataset.formato = f;
      l.append(b, E.el('span', 'es-obs', d));
      c.appendChild(l);
    });
    c.appendChild(info);
    E.modal('⬇ Baixar animação', c);
  }

  // ------------------------------------------------------------ importar (trazer de volta)
  async function lerArquivo(arq, ctx) {
    const buf = new Uint8Array(await arq.arrayBuffer());
    const tipo = C.detectarTipo(buf, arq.name, arq.type);
    let m = null;
    if (tipo === 'zip') {
      const lista = await C.zipLer(buf);
      const j = lista.find(e => /(^|\/)anim\.json$/i.test(e.nome));
      if (j) try { m = JSON.parse(new TextDecoder().decode(j.dados)); } catch (e) { m = null; }
    } else if (tipo === 'png' || tipo === 'apng') m = lerTexto(buf);
    if (m && !m.final_flash_anim) m = null;
    const dec = await C.decodificarArquivo(arq, { maxQuadros: 500 });
    if (dec.tipo === 'json' || dec.tipo === 'video') throw new Error('Mande uma folha PNG, um ZIP de quadros, um GIF ou um PNG animado.');
    const g0 = geometria(ctx.anim);
    const g = m && m.celula ? { W: m.celula[0], H: m.celula[1], ax: m.ancora[0], ay: m.ancora[1] } : g0;
    const lidos = [];   // {img (FF.Imagem do tamanho da célula), atraso?}
    if (dec.tipo === 'imagem') {
      // folha: corta em células
      const it = dec.itens[0], img = I.deCanvas(it.quadros[0].canvas);
      const cols = Math.round(img.largura / g.W), lin = Math.round(img.altura / g.H);
      if (!cols || !lin || Math.abs(cols * g.W - img.largura) > 1 || Math.abs(lin * g.H - img.altura) > 1) {
        // uma imagem só, do tamanho de uma célula (ou outro tamanho): vira um quadro
        if (img.largura === g.W && img.altura === g.H) lidos.push({ img });
        else throw new Error('A folha tem ' + img.largura + '×' + img.altura + ' px, mas as células são de ' + g.W + '×' + g.H + ' px. Mantenha o tamanho das células (pode acrescentar ou tirar quadros, colunas e linhas).');
      } else {
        for (let k = 0; k < cols * lin; k++) lidos.push({ img: I.recortar(img, { x: (k % cols) * g.W, y: Math.floor(k / cols) * g.H, w: g.W, h: g.H }) });
        // células vazias no fim (folha com espaço sobrando) saem
        while (lidos.length > 1 && vazia(lidos[lidos.length - 1].img)) lidos.pop();
      }
    } else {
      dec.itens.forEach(it => it.quadros.forEach(q => lidos.push({ img: I.deCanvas(q.canvas), atraso: dec.tipo === 'animacao' ? q.atraso : undefined })));
    }
    if (!lidos.length) throw new Error('Nenhum quadro encontrado no arquivo.');
    return { meta: m, g, lidos, tipo: dec.tipo, arquivo: arq.name };
  }
  function vazia(img) { const d = img.rgba; for (let i = 3; i < d.length; i += 4) if (d[i]) return false; return true; }

  // células → imagens aparadas + quadros [atlas, x, y, w, h, ox, oy, dur, pontos]
  async function montar(ctx, r) {
    const base = ctx.anim, m = r.meta, fps = (m && m.fps) || fpsDe(base);
    const unicos = [], porChave = new Map(), itens = [];
    r.lidos.forEach((l, k) => {
      // quadro de outro tamanho (GIF/ZIP redimensionado): âncora proporcional
      const sx = l.img.largura / r.g.W, sy = l.img.altura / r.g.H;
      const ax = Math.round(r.g.ax * sx), ay = Math.round(r.g.ay * sy);
      const ap = I.aparar(l.img);
      const ch = ap.largura + 'x' + ap.altura + ':' + C.crc32(new Uint8Array(ap.img.rgba.buffer, ap.img.rgba.byteOffset, ap.img.rgba.byteLength));
      if (!porChave.has(ch)) { porChave.set(ch, unicos.length); unicos.push(ap.img); }
      let dur = (m && m.quadros && m.quadros[k] && m.quadros[k].dur) || (base.frames[k] && base.frames[k][7]) || 1;
      if (l.atraso != null && !(m && m.quadros && m.quadros[k])) {
        const d2 = Math.max(0.05, Math.round(l.atraso * fps * 1000) / 1000);
        if (Math.abs(d2 - dur) > 0.15) dur = d2;
      }
      const pontos = (m && m.quadros && m.quadros[k] && m.quadros[k].pontos) || (base.frames[k] && base.frames[k][8]);
      itens.push({ j: porChave.get(ch), ox: ax - ap.x, oy: ay - ap.y, dur, pontos });
    });
    const res = await FF.EstudioArq.adicionarImagens(ctx.id, unicos);
    const frames = itens.map(it => {
      const p = res.posicoes[it.j], im = unicos[it.j];
      const q = [res.indice, p.x, p.y, im.largura, im.altura, Math.round(it.ox), Math.round(it.oy), it.dur];
      if (it.pontos && it.pontos.length) q.push(JSON.parse(JSON.stringify(it.pontos)));
      return q;
    });
    const anim = { fps, loop: m ? !!m.loop : !!base.loop, repeatTo: Math.min((m ? m.repeatTo : base.repeatTo) || 0, Math.max(0, frames.length - 1)), pingpong: false, frames };
    return { anim, set: res.set };
  }

  function trazer(ctx) {
    if (!ctx.anim) { E.aviso('Abra primeiro a animação que vai receber os quadros (ou servir de base).', 'erro'); return; }
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.png,.apng,.gif,.zip,.webp,image/*,application/zip';
    inp.onchange = async () => {
      const arq = inp.files && inp.files[0];
      if (!arq) return;
      let r;
      try { r = await lerArquivo(arq, ctx); } catch (e) { E.aviso('❌ ' + erroTxt(e), 'erro'); return; }
      escolherDestino(ctx, r);
    };
    inp.click();
  }

  function escolherDestino(ctx, r) {
    const c = E.el('div', 'es-io');
    const p = E.el('p'); c.appendChild(p);
    p.textContent = '📥 "' + r.arquivo + '": ' + r.lidos.length + ' quadro(s)' + (r.meta ? '' : ' (sem os dados do Estúdio: usei o tamanho e a origem de "' + ctx.nome + '")') + '.';
    if (r.meta && (r.meta.sprite !== ctx.id || r.meta.anim !== ctx.nome)) c.appendChild(E.el('p', 'es-obs', '⚠ Este arquivo foi baixado de "' + r.meta.sprite + ' / ' + r.meta.anim + '"; você está em "' + ctx.id + ' / ' + ctx.nome + '".'));
    const prev = document.createElement('canvas'); prev.className = 'es-io-prev';
    const n = Math.min(r.lidos.length, 12), lado = 64;
    prev.width = n * lado; prev.height = lado;
    const px = prev.getContext('2d'); px.imageSmoothingEnabled = false;
    r.lidos.slice(0, n).forEach((l, k) => { const s = Math.min(lado / l.img.largura, lado / l.img.altura); const w = l.img.largura * s, h = l.img.altura * s; px.drawImage(I.paraCanvas(l.img), k * lado + (lado - w) / 2, (lado - h) / 2, w, h); });
    c.appendChild(prev);
    const nome = document.createElement('input'); nome.className = 'es-io-nome';
    nome.value = (r.meta && r.meta.anim && r.meta.sprite === ctx.id ? r.meta.anim : ctx.nome) + '_editada';
    const bts = E.el('div', 'ess-conf-bts');
    const info = E.el('div', 'es-dica');
    let m;
    const fazer = async (b, nova) => {
      let nm = null;
      if (nova) {
        nm = nome.value.trim().replace(/\s+/g, '_');
        if (!nm) { E.aviso('Dê um nome para a animação nova.', 'erro'); return; }
        if (ctx.set.def.anims[nm] && !(await E.confirmar('Já existe', '"' + nm + '" já existe neste sprite. Substituir?', 'Substituir', true))) return;
      }
      [...bts.querySelectorAll('button')].forEach(x => { x.disabled = true; });
      info.textContent = '⏳ Montando os quadros…';
      try {
        const res = await montar(ctx, r);
        m.fechar();
        if (nova) ctx.criar(nm, res.anim, res.set); else ctx.substituir(res.anim, res.set);
      } catch (e) { info.textContent = '❌ ' + erroTxt(e); [...bts.querySelectorAll('button')].forEach(x => { x.disabled = false; }); }
    };
    const bSub = E.botao('↻ Substituir os quadros de "' + ctx.nome + '"', (ev, b) => fazer(b, false), 'Os quadros desta animação viram os do arquivo (Ctrl+Z desfaz; salve para valer no jogo; ↺ Original volta ao do jogo)', 'es-bt-ouro');
    const bNova = E.botao('＋ Importar como nova animação', (ev, b) => fazer(b, true), 'Cria outra animação neste sprite e mantém a original intacta (já fica salva no jogo)');
    bSub.dataset.acao = 'substituir'; bNova.dataset.acao = 'nova';
    const ln = E.el('div', 'es-io-linha'); ln.append(document.createTextNode('Nome da nova: '), nome);
    bts.append(bSub, bNova);
    c.append(bts, ln, info);
    m = E.modal('⬆ Trazer de volta', c);
  }

  FF.EstudioIO = { baixar, trazer, exportar, lerArquivo, montar, geometria, lerTexto, apngCodificar };
})();
