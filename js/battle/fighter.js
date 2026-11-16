// Lutador em batalha. Os dados vêm do JSON do personagem; a forma atual
// (base, Super Saiyajin, ...) define sprite, multiplicadores e golpes disponíveis.
window.FF = window.FF || {};

FF.Fighter = class {
  constructor(def, lado, homeX, groundY, scale) {
    this.def = def;
    this.id = def.id;
    this.lado = lado;                 // 'heroi' | 'inimigo'
    this.isHero = lado === 'heroi';
    this.dir = this.isHero ? 1 : -1;  // para onde olha
    this.homeX = homeX;
    this.x = homeX;
    this.y = groundY;
    this.groundY = groundY;
    this.scale = scale;
    this.hpMax = def.atributos.hp;
    this.hp = this.hpMax;
    this.kiMax = def.atributos.kiMax || 100;
    this.ki = def.atributos.kiInicial || 0;
    this.buffs = {};
    this.rage = 0;         // Rage Gauge (0..100): cheia libera o ataque supremo
    this.ko = false;
    this.busy = false;     // executando um golpe (o roteiro controla a animação)
    this.react = null;     // reação temporária (dano, guarda, lançado)
    this.vx = 0;
    this.alpha = 1;
    this.setForm(def.formaInicial || Object.keys(def.formas)[0]);
  }

  get form() { return this.def.formas[this.formId]; }
  get nome() { return (this.form.nome || this.def.nome) + (this.sufixo || ''); }

  setForm(id) {
    const keep = this.anim && this.anim.name;
    this.formId = id;
    this.sprite = FF.Assets.sprites[this.form.sprite];
    this.anim = new FF.Animator(this.sprite);
    this.idle(keep && this.sprite.has(keep) ? keep : null);
  }

  stat(nome) {
    let v = this.def.atributos[nome] || 0;
    const m = this.form.multiplicadores || {};
    if (m[nome]) v *= m[nome];
    for (const b of Object.values(this.buffs)) {
      if (b.multiplicadores && b.multiplicadores[nome]) v *= b.multiplicadores[nome];
    }
    return v;
  }

  animName(key) {
    const a = this.form.anims || {};
    return a[key] || key;
  }

  play(name, opts) { return this.anim.play(this.animName(name), opts); }

  idle(name) {
    this.react = null;
    if (this.ko) { this.anim.play(this.animName('caido')); return; }
    this.anim.play(name || this.paradoBuff() || this.animName('parado'), { loop: true });
  }

  // buff com pose própria (ex.: Kaioken → "Special_Kaioken_Parado"), se o sprite da forma atual tiver
  paradoBuff() {
    for (const b of Object.values(this.buffs)) if (b.parado && this.sprite.has(b.parado)) return b.parado;
    return null;
  }

  // aura presa a um buff: efeito em loop que acompanha o lutador enquanto o buff durar (não trava o turno)
  auraAtual() {
    for (const b of Object.values(this.buffs)) if (b.aura && b.aura.fx) return b.aura;
    return null;
  }
  // AURA DO IMPULSO (como o brilho do Boost no Octopath): aparece enquanto você escolhe os pontos, fica enquanto o
  // golpe está planejado e durante o golpe. 1 ponto = azul, 2 = dourado, 3 = vermelho-alaranjado (mais forte).
  desenharImpulso(ctx, frente) {
    const n = Math.min(3, this.busy ? (this.boost || 0) : Math.max(this.impulsoMostra || 0, this.impulsoReservado || 0));
    if (!n || this.ko || !(this.alpha > 0.05)) return;
    const COR = [null, [90, 200, 255], [255, 210, 40], [255, 70, 30]][n];
    const fr = this.anim.frame(), sc = this.scale * (this.escExtra || 1);
    const h = (fr ? fr[6] : 60) * sc, w = Math.max(26 * sc, (fr ? fr[5] : 30) * sc * 0.9);
    const x = this.x + (this.offX || 0), y = this.y + (this.offY || 0), t = FF.Clock.t;
    const rgba = (a, k = 1) => 'rgba(' + Math.round(COR[0] + (255 - COR[0]) * (1 - k)) + ',' + Math.round(COR[1] + (255 - COR[1]) * (1 - k)) + ',' + Math.round(COR[2] + (255 - COR[2]) * (1 - k)) + ',' + a.toFixed(3) + ')';
    ctx.save();
    if (!frente) {
      // brilho em volta do corpo
      const cy = y - h * 0.45, r = h * (0.6 + 0.08 * n) * (1 + 0.05 * Math.sin(t * 9));
      const g = ctx.createRadialGradient(x, cy, r * 0.2, x, cy, r);
      g.addColorStop(0, rgba(0.32 + 0.08 * n, 0.5)); g.addColorStop(0.55, rgba(0.2 + 0.06 * n)); g.addColorStop(1, rgba(0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, cy, r * 0.6, r, 0, 0, Math.PI * 2); ctx.fill();
      // anel no chão
      ctx.strokeStyle = rgba(0.6 + 0.3 * Math.sin(t * 7)); ctx.lineWidth = 1.5 + n;
      ctx.beginPath(); ctx.ellipse(x, this.groundY + 1, w * (0.75 + 0.1 * n), w * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // labaredas subindo (atrás do corpo e algumas na frente)
    const qt = 8 + 5 * n;
    for (let k = frente ? 1 : 0; k < qt; k += frente ? 3 : 1) {
      const p = (t * (1.2 + 0.25 * n) + k * 0.6180339) % 1;
      const lado = Math.sin(k * 2.39 + t * 2.2);
      const px = x + lado * w * (0.62 - p * 0.25);
      const py = y - h * 0.05 - p * h * (1.0 + 0.14 * n);
      const tam = (1 - p * 0.7) * (3.2 + 1.3 * n) * sc;
      const a = (1 - p) * (frente ? 0.45 : 0.85);
      ctx.fillStyle = rgba(a, p < 0.3 ? 0.55 : 1);
      ctx.beginPath(); ctx.moveTo(px, py - tam * 2.6);
      ctx.quadraticCurveTo(px + tam, py - tam * 0.4, px, py + tam * 0.8);
      ctx.quadraticCurveTo(px - tam, py - tam * 0.4, px, py - tam * 2.6);
      ctx.fill();
    }
    ctx.restore();
  }

  desenharAura(ctx, frente) {
    const au = this.auraAtual();
    if (!au || !!au.frente !== frente || this.ko || !FF.battle) { if (!au) this._aura = null; return; }
    if (!this._aura || this._aura.fx !== au.fx) {
      const set = FF.battle.fxSet(au.fx);
      if (!set) return;
      const a = new FF.Animator(set);
      a.play(au.fx, { loop: true, fps: au.fps });
      this._aura = { fx: au.fx, set, a };
    }
    const base = au.em === 'peito' ? this.peito() : { x: this.x, y: this.y };
    FF.drawFrame(ctx, this._aura.set, this._aura.a.frame(), base.x + (au.dx || 0) * this.dir, base.y + (au.dy || 0),
      this.scale * (au.escala || 1) * (this._aura.set.def.escala || 1), this.dir < 0, { alpha: (au.alpha != null ? au.alpha : 1) * this.alpha });
  }

  voz(tipo, mult) {
    const v = (this.form.vozes || {})[tipo] || (this.def.vozes || {})[tipo];
    if (v) FF.Audio.voice(v, mult);
  }

  addKi(n) { this.ki = Math.max(0, Math.min(this.kiMax, this.ki + n)); }
  addRage(n) { this.rage = Math.max(0, Math.min(100, this.rage + n)); }
  get rageCheia() { return this.rage >= 100; }

  // buff que recolore a aura de certas animações (ex.: Kaioken deixa o carregar ki vermelho)
  recolor() {
    const nome = this.anim && this.anim.name;
    if (!nome) return null;
    for (const b of Object.values(this.buffs)) {
      const r = b.recolorir;
      if (r && (!r.anims || r.anims.includes(nome))) return r.cor || 'vermelho';
    }
    return null;
  }

  tint() {
    for (const b of Object.values(this.buffs)) if (b.tint) {
      const pulse = 0.5 + 0.5 * Math.sin(FF.Clock.t * 10);
      return b.tint.replace('$a', (0.18 + 0.2 * pulse).toFixed(3));
    }
    return null;
  }

  // Reação a golpe recebido: anima por "dur" segundos e volta ao normal.
  reagir(tipo, dur) {
    if (this.busy) return;
    const nomes = {
      dano: [this.animName('dano1'), this.animName('dano2')],
      guarda: [this.animName('guarda')],
      lancado: [this.animName('lancado')],
    }[tipo];
    const n = nomes[Math.floor(Math.random() * nomes.length)];
    this.anim.play(n, { loop: true });
    this.react = { tipo, ate: FF.Clock.t + dur };
  }

  lancar(forca) {
    this.vx = -this.dir * (forca || 520);
    this.voando = true;   // ao parar, a batalha solta poeira/rochas no chão
    this.reagir('lancado', 0.38);
  }

  update(dt) {
    this.anim.update(dt);
    if (this._aura) this._aura.a.update(dt);
    if (this.vx) {
      this.x += this.vx * dt;
      this.vx *= Math.pow(0.02, dt);
      if (Math.abs(this.vx) < 20) { this.vx = 0; if (this.voando) { this.voando = false; this.pousou = true; } }
      this.x = Math.max(40, Math.min(FF.W - 40, this.x));
      if (this.voando && (this.x <= 40 || this.x >= FF.W - 40)) { this.vx = 0; this.voando = false; this.pousou = true; }
    }
    if (this.react && FF.Clock.t >= this.react.ate) {
      if (this.ko) { this.react = null; this.anim.play(this.animName('caido')); }
      else this.idle();
    }
  }

  draw(ctx, fx) {
    if (this.vaporizado) return this.desenharVapor(ctx);
    // sombra
    const sombra = fx && fx.anim('sombra');
    if (sombra && !this.semSombra) FF.drawFrame(ctx, fx, sombra.frames[1], this.x, this.groundY + 2, this.scale, false, { alpha: 0.45 * this.alpha });
    this.desenharImpulso(ctx, false);
    this.desenharAura(ctx, false);
    // offX/offY/escExtra/flipExtra: posição e tamanho por passo (linha do tempo do Estúdio); padrão sem efeito
    const x = this.x + (this.offX || 0), y = this.y + (this.offY || 0), sc = this.scale * (this.escExtra || 1), flip = (this.dir < 0) !== !!this.flipExtra;
    if (this.rotExtra) {   // giro (graus) em volta do meio do desenho do quadro atual — linha do tempo do Estúdio
      const fr = this.anim.frame();
      const cx = fr ? (flip ? -1 : 1) * (fr[3] / 2 - fr[5]) * sc : 0, cy = fr ? (fr[4] / 2 - fr[6]) * sc : -30 * sc;
      ctx.save(); ctx.translate(x + cx, y + cy); ctx.rotate(this.rotExtra * Math.PI / 180);
      FF.drawFrame(ctx, this.sprite, fr, -cx, -cy, sc, flip, { tint: this.tint(), alpha: this.alpha, recolor: this.recolor() });
      ctx.restore();
    } else FF.drawFrame(ctx, this.sprite, this.anim.frame(), x, y, sc, flip, { tint: this.tint(), alpha: this.alpha, recolor: this.recolor() });
    this.desenharAura(ctx, true);
    this.desenharImpulso(ctx, true);
  }

  // vaporizar: o desenho brilha e é "comido" de cima para baixo por uma linha de luz que solta faíscas;
  // tudo calculado pelo tempo (determinístico, funciona no palco do Estúdio)
  desenharVapor(ctx) {
    const v = this.vapor;
    if (!v) return;
    const p = Math.min(1, (FF.Clock.t - v.t0) / v.d);
    const fr = this.anim.frame();
    const x = this.x + (this.offX || 0), y = this.y + (this.offY || 0), sc = this.scale * (this.escExtra || 1), flip = (this.dir < 0) !== !!this.flipExtra;
    const larg = fr ? fr[3] * sc : 60 * sc, alt = fr ? fr[4] * sc : 70 * sc;
    const x0 = fr ? x - (flip ? fr[3] - fr[5] : fr[5]) * sc : x - larg / 2, y0 = fr ? y - fr[6] * sc : y - alt;
    const yl = y0 + alt * p;   // linha de luz
    if (p < 1 && fr) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x0 - 20, yl, larg + 40, alt + 20); ctx.clip();
      ctx.filter = 'brightness(' + (1 + 2.2 * Math.min(1, p * 2)).toFixed(2) + ') saturate(' + (1 - 0.6 * p).toFixed(2) + ')';
      FF.drawFrame(ctx, this.sprite, fr, x, y, sc, flip, { alpha: this.alpha });
      ctx.restore();
      // a linha brilhando
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, yl - 6, 0, yl + 6); g.addColorStop(0, 'rgba(255,240,180,0)'); g.addColorStop(0.5, 'rgba(255,250,220,0.95)'); g.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = g; ctx.fillRect(x0 - 6, yl - 6, larg + 12, 12);
      ctx.restore();
    }
    // faíscas: cada uma nasce quando a linha passa pela altura dela e sobe se apagando
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    let s = v.semente * 9973;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const N = 120;
    for (let i = 0; i < N; i++) {
      const nasce = i / N, rx = rnd(), vx = (rnd() - 0.5) * 60, vy = 60 + rnd() * 110, vida = 0.4 + rnd() * 0.5, tam = 3 + rnd() * 5, cor = rnd();
      const tv = (p - nasce) * v.d;
      if (tv < 0 || tv > vida) continue;
      const k = tv / vida;
      const px = x0 + rx * larg + vx * tv, py = y0 + alt * nasce - vy * tv;
      ctx.globalAlpha = (1 - k) * 0.95;
      ctx.fillStyle = cor < 0.35 ? '#ffffff' : cor < 0.75 ? '#ffe27a' : '#ff9a2a';
      const t2 = tam * (1 - 0.5 * k);
      ctx.fillRect(px - t2 / 2, py - t2 / 2, t2, t2);
    }
    ctx.restore();
  }

  // Ponto do corpo usado para efeitos/projéteis (mais ou menos o peito).
  peito() { return { x: this.x, y: this.y - 26 * this.scale }; }

  // Ponto de disparo do quadro atual (image point do Construct), em coordenadas de tela.
  pontoDisparo() {
    const f = this.anim.frame();
    const x = this.x + (this.offX || 0), y = this.y + (this.offY || 0), sc = this.scale * (this.escExtra || 1);
    if (f && f[8] && f[8][0]) {
      return { x: x + f[8][0][0] * sc * this.dir, y: y + f[8][0][1] * sc };
    }
    return { x: x + 22 * sc * this.dir, y: y - 26 * sc };
  }
};
