// HUD desenhado no canvas: barras de vida e ki, nomes, textos flutuantes e faixas.
// (Provisório: depois trocamos pelas artes do HUD do Z Legends 3.)
window.FF = window.FF || {};

FF.HUD = {
  text(ctx, s, x, y, size, color, align) {
    ctx.save();
    ctx.font = '900 ' + size + 'px "Trebuchet MS", "Arial Black", sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size / 4);
    ctx.strokeStyle = '#1a1020';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color || '#fff';
    ctx.fillText(s, x, y);
    ctx.restore();
  },

  bar(ctx, x, y, w, h, frac, colA, colB, rtl) {
    frac = Math.max(0, Math.min(1, frac));
    ctx.fillStyle = 'rgba(10,10,20,0.75)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, colA); g.addColorStop(1, colB);
    ctx.fillStyle = g;
    const fw = w * frac;
    ctx.fillRect(rtl ? x + w - fw : x, y, fw, h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(rtl ? x + w - fw : x, y, fw, Math.max(2, h * 0.3));
  },

  panel(ctx, f, x, rtl) {
    const w = 330;
    const bx = rtl ? x - w : x;
    if (f._hpShow == null) f._hpShow = f.hp;
    f._hpShow += (f.hp - f._hpShow) * 0.08;
    this.text(ctx, f.nome, rtl ? x : x, 26, 22, f.formId !== (f.def.formaInicial || 'base') ? '#ffe25a' : '#fff', rtl ? 'right' : 'left');
    // vida (com rastro vermelho)
    this.bar(ctx, bx, 44, w, 18, f._hpShow / f.hpMax, '#ff6a6a', '#a01818', rtl);
    const fr = f.hp / f.hpMax;
    const hpA = fr > 0.5 ? '#9cff5a' : fr > 0.25 ? '#ffe15a' : '#ff8a3a';
    const hpB = fr > 0.5 ? '#2f9a1a' : fr > 0.25 ? '#b08a10' : '#b0400a';
    ctx.save(); ctx.globalAlpha = 1;
    const fw = w * Math.max(0, fr);
    const g = ctx.createLinearGradient(0, 44, 0, 62); g.addColorStop(0, hpA); g.addColorStop(1, hpB);
    ctx.fillStyle = g; ctx.fillRect(rtl ? bx + w - fw : bx, 44, fw, 18);
    ctx.restore();
    this.text(ctx, Math.ceil(f.hp) + ' / ' + f.hpMax, rtl ? bx + 8 : bx + w - 8, 53, 12, '#fff', rtl ? 'left' : 'right');
    // ki
    this.bar(ctx, bx + (rtl ? w - 230 : 0), 70, 230, 10, f.ki / f.kiMax, '#8fe0ff', '#1f6fd0', rtl);
    this.text(ctx, 'KI ' + Math.floor(f.ki), rtl ? bx + w - 236 : bx + 236, 75, 12, '#bfe9ff', rtl ? 'right' : 'left');
    // buffs
    const tags = Object.values(f.buffs).map(b => (b.nome || b.id) + ' (' + b.turnos + ')');
    if (tags.length) this.text(ctx, tags.join('  '), rtl ? x : x, 96, 13, '#ff9c9c', rtl ? 'right' : 'left');
  },

  draw(ctx, b) {
    b.heroes.forEach((h, i) => this.panel(ctx, h, 24 + i * 0, false));
    b.enemies.forEach((e, i) => this.panel(ctx, e, FF.W - 24, true));
    if (b.turnLabel) this.text(ctx, b.turnLabel, FF.W / 2, 26, 16, '#ffe9a8', 'center');
    for (const t of b.texts) {
      const a = 1 - Math.max(0, (t.t - t.life * 0.6) / (t.life * 0.4));
      ctx.save(); ctx.globalAlpha = a;
      this.text(ctx, t.text, t.x, t.y, t.text.length > 6 ? 18 : 24, t.color, 'center');
      ctx.restore();
    }
    const bn = b.bannerTxt;
    if (bn && FF.Clock.t < bn.until) {
      const k = Math.min(1, (FF.Clock.t - bn.start) / 0.15);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,' + 0.45 * k + ')';
      ctx.fillRect(0, 128, FF.W, 54);
      ctx.restore();
      this.text(ctx, bn.text, FF.W / 2, 155, 34 * (0.7 + 0.3 * k), '#ffe25a', 'center');
    }
  },
};
