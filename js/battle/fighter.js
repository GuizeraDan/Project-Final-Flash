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

  voz(tipo) {
    const v = (this.form.vozes || {})[tipo] || (this.def.vozes || {})[tipo];
    if (v) FF.Audio.voice(v);
  }

  addKi(n) { this.ki = Math.max(0, Math.min(this.kiMax, this.ki + n)); }
  addRage(n) { this.rage = Math.max(0, Math.min(100, this.rage + n)); }
  get rageCheia() { return this.rage >= 100; }

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
    // sombra
    const sombra = fx && fx.anim('sombra');
    if (sombra && !this.semSombra) FF.drawFrame(ctx, fx, sombra.frames[1], this.x, this.groundY + 2, this.scale, false, { alpha: 0.45 * this.alpha });
    this.desenharAura(ctx, false);
    // offX/offY/escExtra/flipExtra: posição e tamanho por passo (linha do tempo do Estúdio); padrão sem efeito
    const x = this.x + (this.offX || 0), y = this.y + (this.offY || 0), sc = this.scale * (this.escExtra || 1), flip = (this.dir < 0) !== !!this.flipExtra;
    if (this.rotExtra) {   // giro (graus) em volta do meio do desenho do quadro atual — linha do tempo do Estúdio
      const fr = this.anim.frame();
      const cx = fr ? (flip ? -1 : 1) * (fr[3] / 2 - fr[5]) * sc : 0, cy = fr ? (fr[4] / 2 - fr[6]) * sc : -30 * sc;
      ctx.save(); ctx.translate(x + cx, y + cy); ctx.rotate(this.rotExtra * Math.PI / 180);
      FF.drawFrame(ctx, this.sprite, fr, -cx, -cy, sc, flip, { tint: this.tint(), alpha: this.alpha });
      ctx.restore();
    } else FF.drawFrame(ctx, this.sprite, this.anim.frame(), x, y, sc, flip, { tint: this.tint(), alpha: this.alpha });
    this.desenharAura(ctx, true);
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
