// Cena livre: composição de sprites no tempo (camadas com posição, tamanho, giro e transparência
// animados por quadros-chave), sons e acertos em instantes definidos. Vira um passo de golpe:
//   {"cena": {"duracao": 2, "camadas": [...], "sons": [...], "acertos": [...], "esconderAtacante": true}}
// Camada: {sprite, anim, ancora: "atacante"|"alvo"|"tela", x, y, escala, alpha, rot, flip,
//          inicio, fim, fps?, loop, chaves: [{t, x, y, escala, alpha, rot}]}  (t relativo ao início da camada)
// Posições com âncora "atacante" ficam espelhadas quando quem solta está do lado direito.
window.FF = window.FF || {};

FF.Cena = {
  // estado interpolado de uma camada num instante local (segundos desde o início dela)
  estado(c, tl) {
    const base = { x: c.x || 0, y: c.y || 0, escala: c.escala != null ? c.escala : 1, alpha: c.alpha != null ? c.alpha : 1, rot: c.rot || 0 };
    const ch = (c.chaves || []).slice().sort((a, b) => a.t - b.t);
    if (!ch.length) return base;
    const v = (k, o) => (o[k] != null ? o[k] : base[k]);
    if (tl <= ch[0].t) return Object.fromEntries(Object.keys(base).map(k => [k, v(k, ch[0])]));
    for (let i = 0; i < ch.length - 1; i++) {
      const a = ch[i], b = ch[i + 1];
      if (tl >= a.t && tl <= b.t) {
        const u = (tl - a.t) / Math.max(1e-6, b.t - a.t);
        const e = b.suave === false ? u : u * u * (3 - 2 * u);        // suavizado por padrão
        return Object.fromEntries(Object.keys(base).map(k => [k, v(k, a) + (v(k, b) - v(k, a)) * e]));
      }
    }
    const last = ch[ch.length - 1];
    return Object.fromEntries(Object.keys(base).map(k => [k, v(k, last)]));
  },

  ancora(b, actor, target, c) {
    if (c.ancora === 'tela') return { x: 0, y: 0, dir: 1 };
    if (c.ancora === 'alvo' && target) { const p = target.peito(); return { x: p.x, y: p.y, dir: actor ? actor.dir : 1 }; }
    if (actor) return { x: actor.homeX, y: actor.groundY, dir: actor.dir };
    return { x: FF.W / 2, y: b.groundY, dir: 1 };
  },

  // posição/escala na tela de uma camada num instante da cena (null = fora do tempo dela)
  naTela(b, actor, target, c, t) {
    const ini = c.inicio || 0, fim = c.fim != null ? c.fim : Infinity;
    if (t < ini || t > fim) return null;
    const set = FF.Assets.sprites[c.sprite];
    if (!set || !set.has(c.anim)) return null;
    const a = set.anim(c.anim);
    const tl = t - ini;
    const e = this.estado(c, tl);
    const an = this.ancora(b, actor, target, c);
    const fps = c.fps || a.fps || 10;
    let i = Math.floor(tl * fps);
    i = c.loop === false ? Math.min(i, a.frames.length - 1) : i % a.frames.length;
    const f = a.frames[Math.max(0, i)];
    const flip = !!c.flip !== (an.dir < 0);
    return { set, f, x: an.x + e.x * an.dir, y: an.y + e.y, escala: e.escala * b.scale * (set.def.escala || 1), alpha: Math.max(0, Math.min(1, e.alpha)), rot: (e.rot || 0) * an.dir, flip };
  },

  desenharCamada(ctx, p) {
    if (!p || p.alpha <= 0) return;
    if (!p.rot) return FF.drawFrame(ctx, p.set, p.f, p.x, p.y, p.escala, p.flip, { alpha: p.alpha });
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot * Math.PI / 180);
    FF.drawFrame(ctx, p.set, p.f, 0, 0, p.escala, p.flip, { alpha: p.alpha });
    ctx.restore();
  },

  // caixa na tela (para seleção no editor)
  caixa(p) {
    const [, , , w, h, ox, oy] = p.f;
    const x = p.flip ? p.x - (w - ox) * p.escala : p.x - ox * p.escala;
    return { x, y: p.y - oy * p.escala, w: w * p.escala, h: h * p.escala };
  },

  desenhar(ctx, b, actor, target, cena, t) {
    (cena.camadas || []).forEach(c => { if (!c.oculta) this.desenharCamada(ctx, this.naTela(b, actor, target, c, t)); });
  },

  // carrega os sprites usados pela cena
  async preparar(cena) {
    const ids = [...new Set((cena.camadas || []).map(c => c.sprite))];
    await Promise.all(ids.map(id => FF.Assets.loadSprite(id).catch(() => null)));
  },

  // executa a cena na batalha (passo de roteiro)
  async tocar(b, actor, target, move, cena) {
    await this.preparar(cena);
    const dur = cena.duracao || 1;
    const viva = { cena, actor, target, t: 0 };
    const pend = [
      ...(cena.sons || []).map(s => ({ t: s.t || 0, fn: () => FF.Audio.play(s.som, s.voz ? FF.Audio.volVoz : undefined) })),
      ...(cena.tremores || []).map(s => ({ t: s.t || 0, fn: () => b.shake(s.forca || 6) })),
      ...(cena.flashes || []).map(s => ({ t: s.t || 0, fn: () => b.flash(s.forca || 0.5) })),
    ];
    // acertos: o primeiro ganha o anel de guarda/crítico
    const acertos = (cena.acertos || []).slice().sort((a, c) => (a.t || 0) - (c.t || 0));
    const mode = target ? b.qteMode(actor, target) : null;
    let qte = null;
    if (mode && acertos.length && !target.ko) qte = b.addQte(mode, target, acertos[0].t || 0);
    acertos.forEach(h => pend.push({ t: h.t || 0, fn: () => target && b.applyHit(actor, target, move, h, qte) }));
    pend.sort((a, c) => a.t - c.t);
    const alphaA = actor ? actor.alpha : 1, alphaT = target ? target.alpha : 1;
    if (cena.esconderAtacante && actor) actor.alpha = 0;
    if (cena.esconderAlvo && target) target.alpha = 0;
    b.cenasVivas = b.cenasVivas || [];
    b.cenasVivas.push(viva);
    await new Promise(res => {
      viva.tick = (dt) => {
        viva.t += dt;
        while (pend.length && pend[0].t <= viva.t) pend.shift().fn();
        if (viva.t >= dur) { res(); return true; }
        return false;
      };
    });
    b.cenasVivas = b.cenasVivas.filter(v => v !== viva);
    if (actor) actor.alpha = alphaA;
    if (target) target.alpha = alphaT;
  },
};
