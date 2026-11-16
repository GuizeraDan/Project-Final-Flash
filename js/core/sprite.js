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

FF.drawFrame = (function () {
  const tmp = document.createElement('canvas');
  const tctx = tmp.getContext('2d');
  return function (ctx, set, f, x, y, scale, flip, opts = {}) {
    if (!f) return;
    const [ai, sx, sy, w, h, ox, oy] = f;
    let src = set.images[ai], srcX = sx, srcY = sy;
    if (opts.recolor) { src = FF.Recolor.quadro(set, f, opts.recolor); srcX = 0; srcY = 0; }
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
