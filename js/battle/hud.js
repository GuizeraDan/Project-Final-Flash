// HUD desenhado no canvas: barras de vida e ki, nomes, textos flutuantes e faixas.
// Usa as artes originais do HUD do Z Legends 3 (hud_zl3), com Rage Gauge.
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

  // ---- painel com as artes originais do HUD do Z Legends 3 (hud_zl3) ----
  S: 1.6,          // escala do painel (241x73 na arte original)
  PW: 241,

  // desenha um quadro de animação do hud_zl3 recortado (frac = parte visível, da esquerda ou da direita)
  part(ctx, set, anim, i, x, y, frac, fromRight) {
    const a = set.anim(anim); if (!a) return;
    const f = a.frames[Math.min(i, a.frames.length - 1)];
    const S = this._s || this.S;
    frac = Math.max(0, Math.min(1, frac == null ? 1 : frac));
    const w = Math.round(f[3] * frac); if (w <= 0) return;
    const sx = fromRight ? f[1] + f[3] - w : f[1];
    const dx = fromRight ? x + (f[3] - w) * S : x;
    ctx.drawImage(set.images[f[0]], sx, f[2], w, f[4], dx, y, w * S, f[4] * S);
  },

  // S: escala (1.6 com um lutador por lado; menor quando há 3 heróis empilhados), Y: topo do painel
  // largura do painel novo: 400 px com um lutador por lado; 288 px empilhado (3 por lado)
  LARG: 400, LARG3: 288,
  panel(ctx, f, rtl, S, Y) {
    if (this.img()) return this.panelModerno(ctx, f, rtl, S && S < this.S ? this.LARG3 : this.LARG, Y == null ? 4 : Y);
    const set = FF.Assets.sprites.hud_zl3;
    if (!set) return this.panelSimples(ctx, f, rtl ? FF.W - 24 : 24, rtl);
    S = S || this.S; Y = Y == null ? 4 : Y;
    this._s = S;
    const PW = this.PW;
    const X = rtl ? FF.W - 6 - PW * S : 6;
    const T = S / this.S;   // fator para o tamanho dos textos
    // converte x da arte (metade do jogador) para tela; o inimigo usa a metade espelhada
    const sxp = (xs, w) => X + (rtl ? (PW - xs - (w || 0)) : xs) * S;
    const bg = set.anim('fundo_barras').frames[0];
    ctx.drawImage(set.images[bg[0]], bg[1] + (rtl ? PW : 0), bg[2], PW, bg[4], X, Y, PW * S, bg[4] * S);

    // retrato: arte de seleção do Z Legends 3 (acompanha a forma atual; sem arte, usa o sprite)
    const bx = sxp(13, 37), by = Y + 9 * S, bw = 37 * S, bh = 53 * S;
    const trans = f.formId !== (f.def.formaInicial || 'base');
    FF.Retrato.desenhar(ctx, f.def, f.formId, 'retrato', bx, by, bw, bh, {
      espelhar: rtl, cor1: trans ? '#7a5a10' : '#24305a', escurecer: f.ko ? 'rgba(60,0,0,0.6)' : null });

    // vida (com rastro vermelho)
    if (f._hpShow == null) f._hpShow = f.hp;
    f._hpShow += (f.hp - f._hpShow) * 0.08;
    if (Math.abs(f._hpShow - f.hp) < 0.5) f._hpShow = f.hp;
    const lado = rtl ? 'inimigo' : 'jogador';
    const hx = sxp(57, 121), hy = Y + 17 * S;
    const fr = f.hp / f.hpMax;
    this.part(ctx, set, 'vida_red_' + lado, 0, hx, hy, f._hpShow / f.hpMax, rtl);
    this.part(ctx, set, 'vida_' + lado, fr > 0.5 ? 0 : fr > 0.25 ? 1 : 2, hx, hy, fr, rtl);
    this.text(ctx, Math.ceil(f.hp) + '/' + f.hpMax, rtl ? hx + 6 : hx + 121 * S - 6, hy + 5 * S, Math.round(12 * Math.max(0.75, T)), '#fff', rtl ? 'left' : 'right');

    // ki (barra segmentada)
    const kx = sxp(57, 127), ky = Y + 31 * S;
    this.part(ctx, set, 'fundo_ki_jogador', 0, kx, ky, 1, false);
    this.part(ctx, set, 'ki_' + lado, 5, kx, ky, f.ki / f.kiMax, rtl);

    // nome e ki na parte de baixo da placa
    const nomeCor = f.formId !== (f.def.formaInicial || 'base') ? '#ffe25a' : '#fff';
    this.text(ctx, f.nome, rtl ? sxp(57) : sxp(60), Y + 47 * S, Math.round(18 * Math.max(0.75, T)), nomeCor, rtl ? 'right' : 'left');
    this.text(ctx, 'KI ' + Math.floor(f.ki), rtl ? sxp(172) : sxp(172), Y + 47 * S, Math.round(13 * Math.max(0.75, T)), '#9fe2ff', rtl ? 'left' : 'right');

    // Rage Gauge: barra abaixo da placa + ícone (vazio / cheio pulsando)
    const rw = 104 * S, rh = Math.round(9 * T), rx = rtl ? sxp(60, 104) : sxp(60), ry = Y + 59 * S;
    ctx.fillStyle = 'rgba(10,8,20,0.85)'; ctx.fillRect(rx - 2, ry - 2, rw + 4, rh + 4);
    const rf = f.rage / 100, rfw = rw * rf;
    const cheia = f.rageCheia;
    const rg = ctx.createLinearGradient(0, ry, 0, ry + rh);
    const pulse = 0.5 + 0.5 * Math.sin(FF.Clock.t * 12);
    rg.addColorStop(0, cheia ? 'rgb(255,' + Math.round(230 + 25 * pulse) + ',120)' : '#ffb347'); rg.addColorStop(1, cheia ? '#ff5a00' : '#c0300a');
    ctx.fillStyle = rg; ctx.fillRect(rtl ? rx + rw - rfw : rx, ry, rfw, rh);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let k = 1; k < 10; k++) ctx.fillRect(rx + rw * k / 10, ry, 1, rh);
    const ix = rtl ? rx - 14 : rx + rw + 14, iy = ry + rh / 2;
    const ic = set.anim(cheia ? 'Full' : 'Empty');
    if (ic) {
      const fi = ic.frames[Math.floor(FF.Clock.t * 10) % ic.frames.length];
      FF.drawFrame(ctx, set, fi, ix, iy, (cheia ? 0.62 + 0.06 * pulse : 0.75) * T, false);
    }
    this.text(ctx, cheia ? 'SUPREMO PRONTO!' : 'RAGE', rtl ? rx + rw : rx, ry + rh + 10 * T, Math.round(11 * Math.max(0.75, T)), cheia ? '#ffe25a' : '#ffb39a', rtl ? 'right' : 'left');

    // buffs
    const tags = Object.values(f.buffs).map(b => (b.nome || b.id) + ' (' + b.turnos + ')');
    if (tags.length) this.text(ctx, tags.join('  '), rtl ? rx : rx + rw, ry + rh + 10 * T, Math.round(13 * Math.max(0.75, T)), '#ff9c9c', rtl ? 'left' : 'right');
  },

  // ---- HUD novo (arte do usuário: assets/img/hud_moderno.png, montado por tools/hud_moderno.py) ----
  // Posições em pixels da arte recortada (2125×545). A imagem guarda a moldura (em cima) e a camada dos
  // cantos ciano da janela do retrato (embaixo), em meia resolução.
  L: {
    W: 2125, H: 545,
    retrato: [92, 50, 526, 483],
    vida: { y0: 102, y1: 176, xe0: 602, xe1: 576, xd0: 1900, xd1: 1872 },   // topo/base; x da esquerda e da direita no topo (0) e na base (1)
    vidaTxt: [1840, 140],
    ki: { x0: 588, y0: 220, y1: 266, n: 7, passo: 177.5, larg: 166, incl: 24 },
    nome: [638, 345, 420], kiTxt: [1755, 345],
    rageTxt: [697, 470],
    rage: { x0: 822, y0: 438, y1: 502, n: 5, passo: 168, larg: 158, incl: 20 },
    icone: [1765, 465, 58],
  },
  img() { const i = FF.Assets.images['assets/img/hud_moderno.png']; return i && i.width ? i : null; },

  // texto em itálico grosso como o da arte
  textoHud(ctx, s, x, y, size, color, align, maxW) {
    ctx.save();
    ctx.font = 'italic 900 ' + size + 'px "Trebuchet MS", "Arial Black", sans-serif';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = '#05070c';
    ctx.strokeText(s, x, y, maxW); ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y, maxW);
    ctx.restore();
  },

  panelModerno(ctx, f, rtl, W, Y) {
    const img = this.img(), L = this.L;
    const k = W / L.W, H = L.H * k;
    const X = rtl ? FF.W - 6 - W : 6;
    const px = (x) => (rtl ? X + W - x * k : X + x * k);
    const py = (y) => Y + y * k;
    const poly = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y)))); ctx.closePath(); };
    const hi = img.height, hm = (hi - 1) / 2;
    const camada = (oy) => {
      ctx.save();
      if (rtl) { ctx.translate(X + W, Y); ctx.scale(-1, 1); ctx.drawImage(img, 0, oy, img.width, hm, 0, 0, W, H); }
      else ctx.drawImage(img, 0, oy, img.width, hm, X, Y, W, H);
      ctx.restore();
    };
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    camada(0);

    // retrato
    const [r0, r1, r2, r3] = L.retrato;
    const rx = Math.min(px(r0), px(r2)), rw = Math.abs(px(r2) - px(r0)), ry = py(r1), rh = (r3 - r1) * k;
    const trans = f.formId !== (f.def.formaInicial || 'base');
    ctx.save();
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, 9 * k * 2); else ctx.rect(rx, ry, rw, rh); ctx.clip();
    FF.Retrato.desenhar(ctx, f.def, f.formId, 'retrato', rx, ry, rw, rh, { espelhar: rtl, fundo: !(f.def.formas[f.formId] || {}).retrato, cor1: trans ? '#7a5a10' : '#0e4a58', cor2: '#06222a', escurecer: f.ko ? 'rgba(60,0,0,0.6)' : null });
    ctx.restore();
    camada(hm + 1);   // cantos ciano por cima do retrato

    // vida: rastro vermelho + barra (verde → amarelo → laranja)
    if (f._hpShow == null) f._hpShow = f.hp;
    f._hpShow += (f.hp - f._hpShow) * 0.08;
    if (Math.abs(f._hpShow - f.hp) < 0.5) f._hpShow = f.hp;
    const V = L.vida;
    const barra = (frac, cores, brilho) => {
      frac = Math.max(0, Math.min(1, frac)); if (frac <= 0) return;
      const d0 = V.xe0 + (V.xd0 - V.xe0) * frac, d1 = V.xe1 + (V.xd1 - V.xe1) * frac;
      poly([[V.xe0, V.y0], [d0, V.y0], [d1, V.y1], [V.xe1, V.y1]]);
      const g = ctx.createLinearGradient(0, py(V.y0), 0, py(V.y1));
      cores.forEach((c, i) => g.addColorStop(i / (cores.length - 1), c));
      ctx.fillStyle = g; ctx.fill();
      if (brilho) {
        ctx.save(); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(Math.min(px(V.xe1), px(d0)), py(V.y0), Math.abs(px(d0) - px(V.xe1)), (V.y1 - V.y0) * k * 0.32);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let x = V.xe1; x < d0; x += 46) ctx.fillRect(px(x), py(V.y0), 1, (V.y1 - V.y0) * k);
        ctx.restore();
      }
    };
    const fr = f.hp / f.hpMax;
    barra(f._hpShow / f.hpMax, ['#ff8a7a', '#c01818', '#6a0808']);
    barra(fr, fr > 0.5 ? ['#b6ff6a', '#2fd81a', '#0e7a08'] : fr > 0.25 ? ['#fff27a', '#e0b010', '#7a5a04'] : ['#ffb07a', '#e0400a', '#7a1804'], true);
    this.textoHud(ctx, Math.ceil(f.hp) + ' / ' + f.hpMax, px(L.vidaTxt[0]), py(L.vidaTxt[1]), Math.round(60 * k), '#fff', rtl ? 'left' : 'right');

    // ki: 7 gomos inclinados (o último parcial)
    const K = L.ki, porGomo = f.kiMax / K.n;
    for (let i = 0; i < K.n; i++) {
      const a = K.x0 + i * K.passo, fracG = Math.max(0, Math.min(1, (f.ki - i * porGomo) / porGomo));
      const pts = [[a + K.incl, K.y0], [a + K.incl + K.larg, K.y0], [a + K.larg, K.y1], [a, K.y1]];
      poly(pts);
      ctx.strokeStyle = 'rgba(80,220,255,0.55)'; ctx.lineWidth = Math.max(1, 3 * k); ctx.stroke();
      if (fracG > 0) {
        const w = K.larg * fracG;
        poly([[a + K.incl, K.y0], [a + K.incl + w, K.y0], [a + w, K.y1], [a, K.y1]]);
        const g = ctx.createLinearGradient(0, py(K.y0), 0, py(K.y1));
        g.addColorStop(0, '#9ff4ff'); g.addColorStop(0.5, '#1ec4ff'); g.addColorStop(1, '#0a6ad8');
        ctx.fillStyle = g; ctx.fill();
      }
    }

    // nome e KI
    this.textoHud(ctx, (f.nome || '').toUpperCase(), px(L.nome[0]), py(L.nome[1]), Math.round(70 * k), trans ? '#ffe25a' : '#fff', rtl ? 'right' : 'left', L.nome[2] * k);
    this.textoHud(ctx, 'KI ' + Math.floor(f.ki), px(L.kiTxt[0]), py(L.kiTxt[1]), Math.round(64 * k), '#fff', rtl ? 'left' : 'right');

    // RAGE: 5 gomos laranja + ícone (apagado até encher; pulsa cheio)
    const R = L.rage, cheia = f.rageCheia, pulso = 0.5 + 0.5 * Math.sin(FF.Clock.t * 12);
    this.textoHud(ctx, 'RAGE', px(L.rageTxt[0]), py(L.rageTxt[1]), Math.round(58 * k), cheia ? '#ffe25a' : '#fff', 'center');
    for (let i = 0; i < R.n; i++) {
      const a = R.x0 + i * R.passo, fracG = Math.max(0, Math.min(1, (f.rage - i * (100 / R.n)) / (100 / R.n)));
      poly([[a + R.incl, R.y0], [a + R.incl + R.larg, R.y0], [a + R.larg, R.y1], [a, R.y1]]);
      ctx.strokeStyle = 'rgba(255,120,40,0.5)'; ctx.lineWidth = Math.max(1, 3 * k); ctx.stroke();
      if (fracG > 0) {
        const w = R.larg * fracG;
        poly([[a + R.incl, R.y0], [a + R.incl + w, R.y0], [a + w, R.y1], [a, R.y1]]);
        const g = ctx.createLinearGradient(0, py(R.y0), 0, py(R.y1));
        g.addColorStop(0, cheia ? 'rgb(255,' + Math.round(235 + 20 * pulso) + ',150)' : '#ffd84a'); g.addColorStop(1, cheia ? '#ff5a00' : '#ff8a00');
        ctx.fillStyle = g; ctx.fill();
      }
    }
    const [ix, iy, ir] = L.icone;
    ctx.beginPath(); ctx.arc(px(ix), py(iy), ir * k, 0, Math.PI * 2);
    if (!cheia) { ctx.fillStyle = 'rgba(10,10,20,0.6)'; ctx.fill(); }
    else { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,200,60,' + (0.25 + 0.35 * pulso) + ')'; ctx.fill(); ctx.restore(); }

    // abaixo do painel: supremo pronto e buffs
    const by = Y + H + 9 * Math.max(0.7, W / 400);
    const ts = Math.round(12 * Math.max(0.75, W / 400));
    if (cheia) this.textoHud(ctx, 'SUPREMO PRONTO!', px(R.x0), by, ts, '#ffe25a', rtl ? 'right' : 'left');
    const tags = Object.values(f.buffs).map(b => (b.nome || b.id) + ' (' + b.turnos + ')');
    if (tags.length) this.textoHud(ctx, tags.join('  '), px(R.x0 + R.passo * R.n), by, ts, '#ff9c9c', rtl ? 'left' : 'right');
    ctx.restore();
  },

  // painel antigo (sem as artes), usado se o hud_zl3 não carregar
  panelSimples(ctx, f, x, rtl) {
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

  // destaca quem está escolhendo/agindo: moldura pulsante no painel (3 heróis) e seta sobre o lutador
  destaque(ctx, b) {
    const f = b.atual; if (!f || f.ko) return;
    const pulso = 0.55 + 0.45 * Math.sin(FF.Clock.t * 7);
    const i = b.heroes.indexOf(f);
    ctx.save();
    if (i >= 0 && b.heroes.length > 1) {
      const S = 1.05, y = 2 + i * 76;
      ctx.strokeStyle = 'rgba(255,226,90,' + pulso + ')';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffd23a'; ctx.shadowBlur = 10;
      if (this.img()) ctx.strokeRect(4, y, this.LARG3 + 4, this.L.H * this.LARG3 / this.L.W + 2);
      else ctx.strokeRect(4, y, this.PW * S + 4, 73 * S);
    }
    if (!f.busy) {
      const p = f.peito();
      const y = p.y - 62 * (f.scale || 1) + Math.sin(FF.Clock.t * 5) * 4;
      ctx.fillStyle = i >= 0 ? '#ffe25a' : '#ff6a5a';
      ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x - 10, y - 14); ctx.lineTo(p.x + 10, y - 14); ctx.lineTo(p.x, y); ctx.closePath();
      ctx.stroke(); ctx.fill();
    }
    const m = b.alvoMarcado;   // alvo sendo escolhido no menu
    if (m && !m.ko) {
      const p = m.peito();
      const y = p.y - 62 * (m.scale || 1) + Math.sin(FF.Clock.t * 8) * 5;
      ctx.fillStyle = '#ff4a3a'; ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x - 13, y - 18); ctx.lineTo(p.x + 13, y - 18); ctx.lineTo(p.x, y); ctx.closePath();
      ctx.stroke(); ctx.fill();
    }
    ctx.restore();
  },

  // faixa com os retratos na ordem dos turnos (quem age agora fica destacado em dourado)
  ordemTurno(ctx, b) {
    const lista = (b.ordem || []).filter(f => !f.ko);
    if (!lista.length || b.over) return;
    const w = 22, h = 30, gap = 4;
    const total = lista.length * (w + gap) - gap;
    let x = FF.W / 2 - total / 2;
    const y = 36;
    for (const f of lista) {
      const atual = f === b.atual;
      ctx.fillStyle = atual ? '#ffd84a' : (f.isHero ? '#3a6ad0' : '#c03030');
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      FF.Retrato.desenhar(ctx, f.def, f.formId, 'retrato', x, y, w, h, { espelhar: !f.isHero });
      x += w + gap;
    }
  },

  draw(ctx, b) {
    const n = b.heroes.length;
    b.heroes.forEach((h, i) => n > 1 ? this.panel(ctx, h, false, 1.05, 2 + i * 76) : this.panel(ctx, h, false));
    const ne = b.enemies.length;
    b.enemies.forEach((e, i) => ne > 1 ? this.panel(ctx, e, true, 1.05, 2 + i * 76) : this.panel(ctx, e, true));
    this.destaque(ctx, b);
    if (b.turnLabel) this.text(ctx, b.turnLabel, FF.W / 2, 22, 16, '#ffe9a8', 'center');
    this.ordemTurno(ctx, b);
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
