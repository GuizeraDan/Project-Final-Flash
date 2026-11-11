// Retratos e banners dos personagens (arte de seleção do Z Legends 3, sprite "retratos").
// Cada forma do personagem pode ter "retrato": {"quadro": N, "banner": M}. Sem retrato, usa a
// cabeça do sprite de batalha (ex.: Saibaman).
window.FF = window.FF || {};

FF.Retrato = {
  info(def, formId) {
    const f = def.formas[formId || def.formaInicial] || Object.values(def.formas)[0];
    return { forma: f, r: f.retrato || null };
  },

  // tipo: 'retrato' (rosto 40×56) ou 'banner' (arte inclinada 134×163). Desenha cobrindo a caixa.
  desenhar(ctx, def, formId, tipo, x, y, w, h, opts = {}) {
    const set = FF.Assets.sprites.retratos;
    const { forma, r } = this.info(def, formId);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (opts.fundo !== false) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, opts.cor1 || '#2a3466'); g.addColorStop(1, opts.cor2 || '#0c0f22');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    }
    const idx = r ? (tipo === 'banner' ? r.banner : r.quadro) : null;
    const a = set && set.anim(tipo === 'banner' ? 'banner' : 'retrato');
    if (a && idx != null && a.frames[idx]) {
      const f = a.frames[idx];
      const s = Math.max(w / f[3], h / f[4]);
      const dw = f[3] * s, dh = f[4] * s;
      const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
      if (opts.espelhar) { ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(set.images[f[0]], f[1], f[2], f[3], f[4], 0, 0, dw, dh); }
      else ctx.drawImage(set.images[f[0]], f[1], f[2], f[3], f[4], dx, dy, dw, dh);
    } else {
      // sem retrato: cabeça e tronco do sprite de batalha
      const sp = FF.Assets.sprites[forma.sprite];
      const nome = (forma.anims || {}).parado || 'Parado';
      // animação "parado"; se ela for derivada (sprite incompleto, ex.: Saibaman), usa o quadro de origem
      const der = (forma.animsDerivadas || {})[nome];
      let fr = null;
      if (sp && sp.anim(nome)) fr = sp.anim(nome).frames[0];
      else if (sp && der && sp.anim(der.de)) { const src = sp.anim(der.de).frames; fr = src[Math.min((der.quadros || [0])[0], src.length - 1)]; }
      else if (sp) fr = sp.anim(Object.keys(sp.def.anims)[0]).frames[0];
      if (fr) {
        const s = Math.min((h / fr[4]) * 1.15, (w / fr[3]) * 1.1);   // tronco e cabeça, sem cortar demais
        FF.drawFrame(ctx, sp, fr, x + w / 2, y + h * 1.06, s, !!opts.espelhar);
      }
    }
    if (opts.escurecer) { ctx.fillStyle = opts.escurecer; ctx.fillRect(x, y, w, h); }
    ctx.restore();
  },

  // versão para <canvas> do DOM (menus): carrega o que faltar e desenha
  async noCanvas(canvas, def, formId, tipo, opts) {
    const { forma } = this.info(def, formId);
    await Promise.all([FF.Assets.loadSprite('retratos').catch(() => null), FF.Assets.loadSprite(forma.sprite).catch(() => null)]);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.desenhar(ctx, def, formId, tipo, 0, 0, canvas.width, canvas.height, opts);
  },
};
