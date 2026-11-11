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
    this.ko = false;
    this.busy = false;     // executando um golpe (o roteiro controla a animação)
    this.react = null;     // reação temporária (dano, guarda, lançado)
    this.vx = 0;
    this.alpha = 1;
    this.setForm(def.formaInicial || Object.keys(def.formas)[0]);
  }

  get form() { return this.def.formas[this.formId]; }
  get nome() { return this.form.nome || this.def.nome; }

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
    this.anim.play(name || this.animName('parado'), { loop: true });
  }

  voz(tipo) {
    const v = (this.form.vozes || {})[tipo] || (this.def.vozes || {})[tipo];
    if (v) FF.Audio.voice(v);
  }

  addKi(n) { this.ki = Math.max(0, Math.min(this.kiMax, this.ki + n)); }

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
    this.reagir('lancado', 0.38);
  }

  update(dt) {
    this.anim.update(dt);
    if (this.vx) {
      this.x += this.vx * dt;
      this.vx *= Math.pow(0.02, dt);
      if (Math.abs(this.vx) < 20) this.vx = 0;
      this.x = Math.max(40, Math.min(1044, this.x));
    }
    if (this.react && FF.Clock.t >= this.react.ate) {
      if (this.ko) { this.react = null; this.anim.play(this.animName('caido')); }
      else this.idle();
    }
  }

  draw(ctx, fx) {
    // sombra
    const sombra = fx && fx.anim('sombra');
    if (sombra) FF.drawFrame(ctx, fx, sombra.frames[1], this.x, this.groundY + 2, this.scale, false, { alpha: 0.45 * this.alpha });
    FF.drawFrame(ctx, this.sprite, this.anim.frame(), this.x, this.y, this.scale, this.dir < 0,
      { tint: this.tint(), alpha: this.alpha });
  }

  // Ponto do corpo usado para efeitos/projéteis (mais ou menos o peito).
  peito() { return { x: this.x, y: this.y - 26 * this.scale }; }

  // Ponto de disparo do quadro atual (image point do Construct), em coordenadas de tela.
  pontoDisparo() {
    const f = this.anim.frame();
    if (f && f[8] && f[8][0]) {
      return { x: this.x + f[8][0][0] * this.scale * this.dir, y: this.y + f[8][0][1] * this.scale };
    }
    return { x: this.x + 22 * this.scale * this.dir, y: this.y - 26 * this.scale };
  }
};
