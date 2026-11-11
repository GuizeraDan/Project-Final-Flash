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
    if (this.onFrame) this.onFrame(0);
    if (!this.loop && a.frames.length === 1 && !this.fps) { this.done = true; this._end(); }
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
FF.drawFrame = (function () {
  const tmp = document.createElement('canvas');
  const tctx = tmp.getContext('2d');
  return function (ctx, set, f, x, y, scale, flip, opts = {}) {
    if (!f) return;
    const [ai, sx, sy, w, h, ox, oy] = f;
    let src = set.images[ai], srcX = sx, srcY = sy;
    if (opts.tint) {
      if (tmp.width < w) tmp.width = w;
      if (tmp.height < h) tmp.height = h;
      tctx.globalCompositeOperation = 'source-over';
      tctx.clearRect(0, 0, w, h);
      tctx.drawImage(src, sx, sy, w, h, 0, 0, w, h);
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
