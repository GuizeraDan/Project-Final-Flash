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
    if (f.rageCheia) {   // Sparking: aura dourada pulsando no retrato
      ctx.globalCompositeOperation = 'lighter';
      const pu = 0.5 + 0.5 * Math.sin(FF.Clock.t * 6);
      const ga = ctx.createRadialGradient(rx + rw / 2, ry + rh * 0.45, rw * 0.15, rx + rw / 2, ry + rh * 0.45, rw * 0.75);
      ga.addColorStop(0, 'rgba(255,200,60,0)'); ga.addColorStop(0.5, 'rgba(255,190,40,' + (0.2 + 0.15 * pu) + ')'); ga.addColorStop(1, 'rgba(255,150,0,' + (0.6 + 0.25 * pu) + ')');
      ctx.fillStyle = ga; ctx.fillRect(rx, ry, rw, rh);
      ctx.globalCompositeOperation = 'source-over';
    }
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
    if (cheia) {   // "SPARKING!" no lugar de RAGE, amarelo → laranja
      const g = ctx.createLinearGradient(0, py(L.rageTxt[1] - 30), 0, py(L.rageTxt[1] + 30));
      g.addColorStop(0, '#fffbb0'); g.addColorStop(0.5, '#ffd21a'); g.addColorStop(1, '#ff8a00');
      this.textoHud(ctx, 'SPARKING!', px(L.rageTxt[0]), py(L.rageTxt[1]), Math.round(56 * k), g, 'center', 250 * k);
    } else this.textoHud(ctx, 'RAGE', px(L.rageTxt[0]), py(L.rageTxt[1]), Math.round(58 * k), '#fff', 'center');
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

    // Pontos de Impulso: 5 bolinhas entre o nome e o KI (douradas = tem; piscando = reservadas no plano)
    const reserv = f.impulsoReservado || 0;
    for (let i = 0; i < 5; i++) {
      const cx = px(1120 + i * 78), cy = py(L.nome[1]), r = 23 * k;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      const tem = i < (f.impulso || 0), res = tem && i >= (f.impulso || 0) - reserv;
      if (tem) {
        const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
        g.addColorStop(0, '#fffbe0'); g.addColorStop(0.35, res ? '#ffffff' : '#ffd257'); g.addColorStop(1, res ? '#ff9a1e' : '#d85a00');
        ctx.fillStyle = g; ctx.globalAlpha = res ? 0.55 + 0.45 * pulso : 1; ctx.fill(); ctx.globalAlpha = 1;
      } else { ctx.fillStyle = 'rgba(5,10,20,0.75)'; ctx.fill(); }
      ctx.lineWidth = Math.max(1, 3 * k); ctx.strokeStyle = tem ? '#5a2400' : 'rgba(255,170,60,0.45)'; ctx.stroke();
    }

    // SPARKING (Fúria cheia), como a arte do usuário: contorno da moldura em dourado brilhante com raios curtos
    // estalando nas bordas (dourados e ciano), gomos da Fúria cheios de eletricidade, ícone em explosão
    if (cheia) {
      const t = FF.Clock.t;
      let sem = Math.floor(t * 14) * 7919 + (rtl ? 101 : 0);
      const rnd = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
      const raio = (x0, y0, x1, y1, passos, amp, cor, lw) => {   // linha em zigue-zague (coordenadas da arte)
        ctx.beginPath(); ctx.moveTo(px(x0), py(y0));
        for (let n = 1; n <= passos; n++) {
          const f2 = n / passos, j2 = n === passos ? 0 : (rnd() - 0.5) * amp;
          const dx = x1 - x0, dy = y1 - y0, L2 = Math.hypot(dx, dy) || 1;
          ctx.lineTo(px(x0 + dx * f2 - dy / L2 * j2), py(y0 + dy * f2 + dx / L2 * j2));
        }
        ctx.save(); ctx.shadowColor = cor; ctx.shadowBlur = 8 * k * 3;
        ctx.strokeStyle = cor; ctx.lineWidth = Math.max(1.5, lw * k * 1.8); ctx.stroke();
        ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,245,0.95)'; ctx.lineWidth = Math.max(1, lw * k * 0.7); ctx.stroke();
        ctx.restore();
      };
      ctx.save();
      // contorno da moldura (traçado da imagem do HUD)
      const BORDA = [[25, 140], [50, 60], [100, 12], [525, 11], [650, 19], [700, 56], [1500, 48], [1650, 56], [1675, 48], [1700, 18], [2050, 8], [2100, 62], [2100, 112], [1975, 328], [1950, 334], [1925, 326], [1900, 331], [1850, 400], [1800, 520], [1750, 532], [1700, 531], [525, 522], [75, 532], [25, 485]];
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#ff9a00'; ctx.shadowBlur = 22 * Math.max(0.6, W / 400) * (0.7 + 0.3 * pulso);
      poly(BORDA); ctx.strokeStyle = 'rgb(255,' + Math.round(150 + 50 * pulso) + ',20)'; ctx.lineWidth = Math.max(2.5, 16 * k); ctx.stroke();
      ctx.stroke();
      ctx.shadowBlur = 0;
      poly(BORDA); ctx.strokeStyle = 'rgb(255,' + Math.round(225 + 25 * pulso) + ',120)'; ctx.lineWidth = Math.max(1.5, 7 * k); ctx.stroke();
      poly(BORDA); ctx.strokeStyle = 'rgba(255,255,235,0.95)'; ctx.lineWidth = Math.max(1, 2.5 * k); ctx.stroke();
      // raios curtos estalando para fora da borda (uns 5 por vez, trocam várias vezes por segundo)
      for (let n = 0; n < 9; n++) {
        const e = Math.floor(rnd() * BORDA.length), a = BORDA[e], b = BORDA[(e + 1) % BORDA.length], u = rnd();
        const x0 = a[0] + (b[0] - a[0]) * u, y0 = a[1] + (b[1] - a[1]) * u;
        // para fora: afasta do centro do painel
        const cx = 1060, cy = 270, dx = x0 - cx, dy = y0 - cy, L2 = Math.hypot(dx, dy) || 1, comp = 50 + rnd() * 70;
        const x1 = x0 + dx / L2 * comp + (rnd() - 0.5) * 60, y1 = y0 + dy / L2 * comp;
        raio(x0, y0, x1, y1, 4, 34, n % 3 ? '#ffb000' : '#3fd0ff', 4);
      }
      // gomos da Fúria: brilho branco por dentro + eletricidade em cada gomo
      for (let n = 0; n < R.n; n++) {
        const a = R.x0 + n * R.passo, ym = (R.y0 + R.y1) / 2;
        poly([[a + R.incl, R.y0], [a + R.incl + R.larg, R.y0], [a + R.larg, R.y1], [a, R.y1]]);
        const gg = ctx.createLinearGradient(0, py(R.y0), 0, py(R.y1));
        gg.addColorStop(0, '#fff3a0'); gg.addColorStop(0.45, '#ffb800'); gg.addColorStop(1, '#ff6a00');
        ctx.fillStyle = gg; ctx.fill();
        ctx.save(); poly([[a + R.incl, R.y0], [a + R.incl + R.larg, R.y0], [a + R.larg, R.y1], [a, R.y1]]); ctx.clip();
        raio(a + 6, ym, a + R.larg + R.incl - 6, ym, 6, (R.y1 - R.y0) * 0.9, '#ff7a00', 3.5);
        raio(a + 6, ym - 6, a + R.larg + R.incl - 6, ym + 6, 5, (R.y1 - R.y0) * 0.7, '#ffd000', 2.5);
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'lighter';
      // ícone: halo e raios em estrela girando
      const ic = px(L.icone[0]), jc = py(L.icone[1]), ri = L.icone[2] * k;
      const gh = ctx.createRadialGradient(ic, jc, ri * 0.3, ic, jc, ri * 2.4);
      gh.addColorStop(0, 'rgba(255,230,120,' + (0.55 + 0.3 * pulso) + ')'); gh.addColorStop(1, 'rgba(255,140,0,0)');
      ctx.fillStyle = gh; ctx.beginPath(); ctx.arc(ic, jc, ri * 2.4, 0, Math.PI * 2); ctx.fill();
      for (let n = 0; n < 12; n++) {
        const a = t * 1.8 + n * Math.PI / 6, l = ri * (1.45 + 0.45 * Math.sin(t * 11 + n * 1.7));
        ctx.beginPath(); ctx.moveTo(ic + Math.cos(a) * ri, jc + Math.sin(a) * ri); ctx.lineTo(ic + Math.cos(a) * l, jc + Math.sin(a) * l);
        ctx.strokeStyle = 'rgba(255,225,110,0.9)'; ctx.lineWidth = Math.max(1, 5 * k); ctx.stroke();
      }
      // faíscas douradas soltas em volta
      for (let n = 0; n < 10; n++) {
        const fase = (t * 0.7 + n * 0.173) % 1, e = BORDA[(n * 5) % BORDA.length];
        const x = e[0] + Math.sin(n * 3.1 + t) * 40, y = e[1] - fase * 90 * (e[1] < 270 ? 1 : -1);
        ctx.globalAlpha = (1 - fase) * 0.9; ctx.fillStyle = n % 2 ? '#ffe27a' : '#fff';
        const sz = (6 + (n % 3) * 4) * k; ctx.fillRect(px(x) - sz / 2, py(y) - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // abaixo do painel: sparking e buffs
    const by = Y + H + 9 * Math.max(0.7, W / 400);
    const ts = Math.round(12 * Math.max(0.75, W / 400));
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
    // escolha do alvo: círculo no chão de quem pode ser escolhido; o que está sob o mouse ganha anel forte + nome e vida
    for (const f of (b.escolhendoAlvo || [])) {
      if (f.ko) continue;
      const on = f === b.alvoMarcado, pul = 0.5 + 0.5 * Math.sin(FF.Clock.t * 6);
      const rx = 30 * f.scale * (on ? 1.15 : 1), ry = rx * 0.32;
      ctx.save();
      ctx.lineWidth = on ? 3.5 : 2;
      ctx.strokeStyle = on ? 'rgba(255,74,58,' + (0.75 + 0.25 * pul) + ')' : 'rgba(255,226,90,' + (0.35 + 0.3 * pul) + ')';
      ctx.fillStyle = on ? 'rgba(255,60,40,0.18)' : 'rgba(255,226,90,0.06)';
      ctx.beginPath(); ctx.ellipse(f.x, f.groundY + 2, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      if (on) {
        const p = f.peito(), yt = p.y - 62 * (f.scale || 1) - 50;
        this.text(ctx, f.nome, f.x, yt, 15, '#fff', 'center');
        this.text(ctx, 'Vida ' + Math.ceil(f.hp) + '/' + f.hpMax, f.x, yt + 15, 11, '#ffb0b0', 'center');
      }
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

  // linha do tempo da rodada (FFX): retratos na ordem; quem já agiu fica apagado com ✓, quem age agora em dourado,
  // atordoado/quebrado com 💫 (vai para o fim); ▲/▼ = vai jogar antes/depois na próxima rodada (velocidade do golpe)
  ordemTurno(ctx, b) {
    const lista = (b.ordem || []).filter(f => !f.ko);
    if (!lista.length || b.over) return;
    const w = 22, h = 30, gap = 5;
    const total = lista.length * (w + gap) - gap;
    let x = FF.W / 2 - total / 2;
    const y = 36;
    if (b.rodada) this.text(ctx, 'R' + b.rodada, x - 18, y + h / 2, 12, '#ffe9a8', 'center');
    for (const f of lista) {
      const atual = f === b.atual, foi = b.jaAgiu && b.jaAgiu.has(f) && !atual;
      ctx.save();
      if (foi) ctx.globalAlpha = 0.4;
      ctx.fillStyle = atual ? '#ffd84a' : (f.isHero ? '#3a6ad0' : '#c03030');
      const yy = atual ? y - 3 : y;
      ctx.fillRect(x - 2, yy - 2, w + 4, h + 4);
      FF.Retrato.desenhar(ctx, f.def, f.formId, 'retrato', x, yy, w, h, { espelhar: !f.isHero });
      ctx.restore();
      if (foi) this.text(ctx, '✓', x + w / 2, y + h / 2, 16, '#9dff9d', 'center');
      if (f.atordoado > 0) this.text(ctx, '💫', x + w / 2, y - 6, 11, '#fff', 'center');
      const prox = f.iniciativaProx || 0;
      if (prox) this.text(ctx, prox > 0 ? '▲' : '▼', x + w / 2, y + h + 8, 11, prox > 0 ? '#7dff9a' : '#ff8a7a', 'center');
      x += w + gap;
    }
  },

  // aviso de pré-alpha no canto da batalha
  versao(ctx) {
    if (!FF.VERSAO) return;
    ctx.save(); ctx.globalAlpha = 0.55;
    // canto inferior direito, ao lado do botão de pausa (que ocupa ~6% da largura)
    this.text(ctx, FF.VERSAO.fase + ' · build ' + FF.VERSAO.build, FF.W * 0.935, FF.H - 8, 10, '#ffffff', 'right');
    ctx.restore();
  },
  draw(ctx, b) {
    this.versao(ctx);
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
      const yb = 248;   // abaixo dos painéis do HUD (3 por lado ocupam até ~235 na tela de 720)
      ctx.fillRect(0, yb, FF.W, 54);
      ctx.restore();
      this.text(ctx, bn.text, FF.W / 2, yb + 27, 34 * (0.7 + 0.3 * k), '#ffe25a', 'center');
    }
    if (FF.Tutorial && b.def && b.def.tutorial) FF.Tutorial.desenharDica(ctx, b);   // luta de treino: dicas
  },
};
