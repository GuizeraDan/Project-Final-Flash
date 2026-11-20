// Conjuntos de sprites (atlas + animações) e o animador por quadros.
// Quadro: [atlas, x, y, w, h, ox, oy, dur, pontos?]
window.FF = window.FF || {};

FF.SpriteSet = class {
  constructor(def, images) {
    this.def = def;
    this.images = images;
  }
  anim(name) { return this.def.anims[name]; }
  has(name) { return !!this.def.anims[name]; }
};

FF.Animator = class {
  constructor(set) {
    this.set = set;
    this.a = null;
    this.name = null;
  }

  // opts: fps, loop, hold (segura o 1º quadro N segundos), onFrame(i)
  play(name, opts = {}) {
    const a = this.set.anim(name);
    if (!a) {
      console.warn('[FF] animação inexistente:', name);
      return Promise.resolve();
    }
    this.a = a;
    this.name = name;
    this.i = 0;
    this.t = 0;
    this.fps = opts.fps != null ? opts.fps : a.fps;
    if (!this.fps && a.frames.length > 1) this.fps = 10; // anims "manuais" do Construct
    this.loop = opts.loop != null ? opts.loop : a.loop;
    this.hold = opts.hold || 0;
    this.onFrame = opts.onFrame || null;
    this.done = false;
    this.ended = new Promise(r => (this._end = r));
    // com "hold", o 1º quadro só "acontece" (eventos do quadro 0) quando a espera acabar
    if (this.onFrame && !(this.hold > 0)) this.onFrame(0);
    if (!this.loop && a.frames.length === 1 && !this.fps) { if (this.onFrame && this.hold > 0) this.onFrame(0); this.done = true; this._end(); }
    return this.ended;
  }

  frameDur(i) {
    const f = this.a.frames[i];
    return this.fps > 0 ? (f[7] || 1) / this.fps : Infinity;
  }

  // Tempo (s) desde o início até o quadro k começar (inclui "hold").
  timeToFrame(k) {
    let t = this.hold;
    for (let i = 0; i < k; i++) t += this.frameDur(i);
    return t;
  }

  totalTime() { return this.timeToFrame(this.a.frames.length); }

  update(dt) {
    if (!this.a || this.done) return;
    if (this.hold > 0) {
      this.hold -= dt;
      if (this.hold > 0) return;
      dt = -this.hold;
      this.hold = 0;
      if (this.onFrame && this.i === 0) this.onFrame(0);
    }
    this.t += dt;
    let guard = 0;
    while (this.t >= this.frameDur(this.i) && guard++ < 100) {
      this.t -= this.frameDur(this.i);
      if (this.i + 1 < this.a.frames.length) {
        this.i++;
        if (this.onFrame) this.onFrame(this.i);
      } else if (this.loop) {
        this.i = this.a.repeatTo || 0;
        if (this.onFrame) this.onFrame(this.i);
      } else {
        this.done = true;
        this._end();
        break;
      }
    }
  }

  frame() { return this.a ? this.a.frames[this.i] : null; }
};

// Desenho de um quadro com origem (hotspot), espelhamento e tinta opcional.
// RECOLORIR (buff com "recolorir": {"anims": [...], "cor": "vermelho"}): troca a cor da aura desenhada nos quadros
// (pixels claros e pouco coloridos: branco/lilás) — ex.: carregar ki do Goku com Kaioken fica vermelho. Cache por quadro.
FF.Recolor = {
  cache: new Map(),
  CORES: {
    // claro → (r,g,b) da parte mais clara e da mais forte da aura
    vermelho: [[255, 214, 220], [255, 36, 60]],
    dourado: [[255, 250, 200], [255, 190, 20]],
    azul: [[220, 245, 255], [40, 150, 255]],
    roxo: [[240, 215, 255], [160, 60, 255]],
    verde: [[220, 255, 220], [40, 220, 80]],
  },
  quadro(set, f, cor) {
    const chave = (set.def && set.def.id) + '|' + f.slice(0, 5).join(',') + '|' + cor;
    let c = this.cache.get(chave);
    if (c) return c;
    const [ai, sx, sy, w, h] = f;
    c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.drawImage(set.images[ai], sx, sy, w, h, 0, 0, w, h);
    const pal = this.CORES[cor] || this.CORES.vermelho;
    try {
      const d = x.getImageData(0, 0, w, h), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        if (!p[i + 3]) continue;
        const r = p[i], g = p[i + 1], b = p[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const v = mx / 255, sat = mx ? (mx - mn) / mx : 0;
        if (v < 0.68 || sat > 0.38 || b < r - 12) continue;   // só a aura (branca/lilás); pele, roupa e cabelo ficam
        const k = Math.max(0, Math.min(1, (1 - v) / 0.32 + sat * 1.4));   // 0 = parte mais clara, 1 = mais forte
        p[i] = Math.round(pal[0][0] + (pal[1][0] - pal[0][0]) * k);
        p[i + 1] = Math.round(pal[0][1] + (pal[1][1] - pal[0][1]) * k);
        p[i + 2] = Math.round(pal[0][2] + (pal[1][2] - pal[0][2]) * k);
      }
      x.putImageData(d, 0, 0);
    } catch (e) { /* imagem sem permissão de leitura (file://): fica a original */ }
    this.cache.set(chave, c);
    return c;
  },
};

// quadros prontos guardados (filtro de cor, silhueta borrada da aura...): ctx.filter direto na tela é muito caro
// (o navegador processa uma camada do tamanho da tela inteira); aqui o filtro roda uma vez num canvas pequeno
FF.CacheQuadros = {
  mapa: new Map(), max: 1500,
  obter(chave, criar) {
    let c = this.mapa.get(chave);
    if (c) return c;
    if (this.mapa.size > this.max) this.mapa.delete(this.mapa.keys().next().value);
    c = criar();
    this.mapa.set(chave, c);
    return c;
  },
  // quadro com filtro CSS (hue-rotate etc.)
  filtrado(set, f, filtro) {
    return this.obter('F|' + (set.def && set.def.id) + '|' + f.slice(0, 5).join(',') + '|' + filtro, () => {
      const [ai, sx, sy, w, h] = f;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      if ('filter' in x) x.filter = filtro;
      x.drawImage(set.images[ai], sx, sy, w, h, 0, 0, w, h);
      return c;
    });
  },
  // silhueta da cor pedida, borrada e engordada (aura do Impulso); devolve {c, pad}
  aura(set, f, cor, raio, borrao) {
    return this.obter('A|' + (set.def && set.def.id) + '|' + f.slice(0, 5).join(',') + '|' + cor + '|' + raio + '|' + borrao, () => {
      const [ai, sx, sy, w, h] = f, pad = Math.ceil(raio + borrao * 2 + 2);
      const sil = document.createElement('canvas'); sil.width = w; sil.height = h;
      const sx2 = sil.getContext('2d');
      sx2.drawImage(set.images[ai], sx, sy, w, h, 0, 0, w, h);
      sx2.globalCompositeOperation = 'source-in'; sx2.fillStyle = cor; sx2.fillRect(0, 0, w, h);
      const c = document.createElement('canvas'); c.width = w + pad * 2; c.height = h + pad * 2;
      const x = c.getContext('2d');
      if (borrao && 'filter' in x) x.filter = 'blur(' + borrao + 'px)';
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; x.drawImage(sil, pad + Math.cos(a) * raio, pad + Math.sin(a) * raio); }
      if (!borrao) x.drawImage(sil, pad, pad);
      return { c, pad };
    });
  },
};

FF.drawFrame = (function () {
  const tmp = document.createElement('canvas');
  const tctx = tmp.getContext('2d');
  return function (ctx, set, f, x, y, scale, flip, opts = {}) {
    if (!f) return;
    if (set.def && set.def.espelhar) flip = !flip;   // sprite desenhado olhando para a esquerda (alguns pacotes do acervo)
    const [ai, sx, sy, w, h, ox, oy] = f;
    let src = set.images[ai], srcX = sx, srcY = sy;
    if (opts.recolor) { src = FF.Recolor.quadro(set, f, opts.recolor); srcX = 0; srcY = 0; }
    else if (opts.filtro) { src = FF.CacheQuadros.filtrado(set, f, opts.filtro); srcX = 0; srcY = 0; }
    if (opts.tint) {
      if (tmp.width < w) tmp.width = w;
      if (tmp.height < h) tmp.height = h;
      tctx.globalCompositeOperation = 'source-over';
      tctx.clearRect(0, 0, w, h);
      tctx.drawImage(src, srcX, srcY, w, h, 0, 0, w, h);
      tctx.globalCompositeOperation = 'source-atop';
      tctx.fillStyle = opts.tint;
      tctx.fillRect(0, 0, w, h);
      src = tmp; srcX = 0; srcY = 0;
    }
    const dw = w * scale, dh = h * scale;
    const dx = flip ? x - (w - ox) * scale : x - ox * scale;
    const dy = y - oy * scale;
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    if (flip) {
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(src, srcX, srcY, w, h, 0, 0, dw, dh);
    } else {
      ctx.drawImage(src, srcX, srcY, w, h, dx, dy, dw, dh);
    }
    ctx.restore();
  };
})();

// ---------------------------------------------------------------- raio elástico
// Raios/rajadas têm cabeça (onde nascem), corpo (faixa que se repete) e ponta. A animação guarda o trecho do
// corpo em anim.raio = {x0, x1, q?: {"<quadro>": [x0, x1]}} — colunas do desenho relativas à origem (ox), no
// desenho como está no atlas; q = ajuste de um quadro só. O lado do corpo (direita/esquerda da origem) diz para
// onde o raio vai. FF.raioDoQuadro devolve [x0, x1] ou null; FF.compRaio monta o quadro com o comprimento pedido.
FF.raioDoQuadro = function (anim, i, f) {
  const r = anim && anim.raio;
  if (!r || !f) return null;
  const q = r.q && r.q[i];
  const x0 = Math.round(q ? q[0] : r.x0), x1 = Math.round(q ? q[1] : r.x1);
  if (!(x1 - x0 >= 1)) return null;
  const ox = f[5], w = f[3];
  if (ox + x0 < 0 || ox + x1 > w) return null;   // o trecho não cabe neste quadro (ex.: raio ainda crescendo)
  if (x0 < 0 && x1 > 0) return null;              // a origem não pode ficar dentro do corpo
  return [x0, x1];
};

// Monta numa tela o quadro com o corpo repetido para o raio ter "comp" pixels (do desenho) da origem até o fim
// da ponta. Devolve {canvas, w, h, ox, oy} ou null (não dá: comprimento menor que cabeça + ponta).
// fonte = imagem/canvas e posição do quadro nela (permite recolor/filtro); destino opcional (reaproveita a tela).
FF.compRaio = function (fonte, sx, sy, f, faixa, comp, destino) {
  const w = f[3], h = f[4], ox = f[5], oy = f[6];
  const [x0, x1] = faixa, bw = x1 - x0, frente = x0 > 0;
  const natural = frente ? w - ox : ox;
  const extra = Math.round(comp) - natural, B = bw + extra;
  if (B < 0) return null;
  const W = w + extra;
  if (W < 1 || W > 8192) return null;
  const c = destino || document.createElement('canvas');
  if (c.width < W) c.width = W;
  if (c.height < h) c.height = h;
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W + 2, h + 2);
  g.imageSmoothingEnabled = false;
  const u0 = ox + x0, u1 = ox + x1;   // corpo no desenho original
  const blit = (a, b, x) => { if (b > a) g.drawImage(fonte, sx + a, sy, b - a, h, x, 0, b - a, h); };
  const corpo = (x) => { let pos = 0; while (pos < B) { const n = Math.min(bw, B - pos); blit(u0, u0 + n, x + pos); pos += n; } };
  if (frente) { blit(0, u0, 0); corpo(u0); blit(u1, w, u0 + B); }
  else {
    // raio para a esquerda: ponta | corpo | cabeça (com a origem)
    blit(0, u0, 0);
    // o corpo cresce para a esquerda: os pedaços parciais ficam do lado da ponta
    let pos = B; while (pos > 0) { const n = Math.min(bw, pos); blit(u1 - n, u1, u0 + pos - n); pos -= n; }
    blit(u1, w, u0 + B);
  }
  return { canvas: c, w: W, h, ox: frente ? ox : ox + extra, oy };
};

// desenha o quadro atual de uma Anim como raio elástico com "L" pixels de tela (da origem até o fim da ponta).
// Sem trecho marcado (ou quando não cabe), desenha o quadro normal.
FF.drawRaio = (function () {
  const tela = document.createElement('canvas');
  return function (ctx, set, anim, i, f, x, y, scale, flip, L, opts = {}) {
    const faixa = FF.raioDoQuadro(anim, i, f);
    if (!faixa || !(L > 0)) return FF.drawFrame(ctx, set, f, x, y, scale, flip, opts);
    let src = set.images[f[0]], sx = f[1], sy = f[2];
    if (opts.recolor) { src = FF.Recolor.quadro(set, f, opts.recolor); sx = 0; sy = 0; }
    else if (opts.filtro) { src = FF.CacheQuadros.filtrado(set, f, opts.filtro); sx = 0; sy = 0; }
    const r = FF.compRaio(src, sx, sy, f, faixa, L / scale, tela);
    if (!r) return FF.drawFrame(ctx, set, f, x, y, scale, flip, opts);
    const falso = { images: [r.canvas], def: { espelhar: set.def && set.def.espelhar } };
    FF.drawFrame(ctx, falso, [0, 0, 0, r.w, r.h, r.ox, r.oy], x, y, scale, flip, { alpha: opts.alpha, tint: opts.tint });
  };
})();
