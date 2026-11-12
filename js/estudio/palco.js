// Estúdio — palco ao vivo da aba Golpes. Usa o motor de batalha DE VERDADE (FF.Battle + FF.Linha) e
// simula a linha do tempo de forma determinística: para mostrar o instante T, recria a batalha e roda
// o golpe em passos fixos de 1/60 s até T (sem som e com sorteios previsíveis). Tocar continua dali em
// tempo real e com som. "Na batalha" roda o golpe completo com anéis de guarda/crítico e HUD.
window.FF = window.FF || {};

FF.EstudioPalco = class {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.DT = 1 / 60;
    this._b = null;
    this.ref = {};          // clipe id → pontos de referência gravados quando o clipe disparou
    this.opts = { grade: false, refs: true, cebola: false, hud: false };
    this.modo = 'edicao';   // 'edicao' | 'batalha'
  }

  // ---------- montagem ----------
  // cfg: { atacante, forma, alvo, alvoForma, lado: 'heroi'|'inimigo', parceiros: [ids] }
  async montar(cfg) {
    this.cfg = cfg;
    const ids = [cfg.atacante, cfg.alvo, ...(cfg.parceiros || [])].filter(Boolean);
    this.defs = {};
    for (const id of new Set(ids)) {
      const d = await FF.Assets.loadCharacter(id);
      for (const f of Object.values(d.formas)) await FF.Assets.loadSprite(f.sprite).catch(() => null);
      // animações derivadas (igual ao FF.start)
      Object.values(d.formas).forEach(f => {
        const set = FF.Assets.sprites[f.sprite];
        if (!set) return;
        for (const [nome, dv] of Object.entries(f.animsDerivadas || {})) {
          if (set.has(nome) || !set.has(dv.de)) continue;
          const src = set.anim(dv.de);
          set.def.anims[nome] = { fps: dv.fps || 0, loop: !!dv.loop, repeatTo: 0, pingpong: false, frames: dv.quadros.map(i => src.frames[Math.min(i, src.frames.length - 1)]) };
        }
      });
      this.defs[id] = d;
    }
    this.stage = await FF.Assets.loadJSON('data/stages/campo.json');
    await FF.Assets.loadSprite(this.stage.sprite);
  }

  // cria uma batalha nova com os lutadores na posição inicial
  novaBatalha() {
    const cfg = this.cfg;
    const heroiAtaca = cfg.lado !== 'inimigo';
    const herois = heroiAtaca ? [cfg.atacante, ...(cfg.parceiros || [])] : [cfg.alvo];
    const inimigos = heroiAtaca ? [cfg.alvo] : [cfg.atacante, ...(cfg.parceiros || [])];
    const pos = { 1: [170], 2: [250, 150], 3: [250, 150, 350] };
    const posI = { 1: [915], 2: [870, 990], 3: [820, 930, 1020] };
    const def = { id: 'estudio', titulo: 'Estúdio', cenario: 'campo', escala: herois.length === 1 && inimigos.length === 1 ? 2.5 : 2.2,
      posicoes: { herois: pos[herois.length], inimigos: posI[inimigos.length] }, herois, inimigos };
    const ui = { chooseMove: () => new Promise(() => {}), chooseTarget: (f) => Promise.resolve(f[0]), showEnd: () => {} };
    const listeners = FF.Input.listeners.slice();
    const b = new FF.Battle(def, this.stage, ui);
    FF.Input.listeners = listeners;          // a batalha do palco não escuta o teclado sozinha
    herois.forEach((id, i) => b.addFighter(this.defs[id], 'heroi', i));
    inimigos.forEach((id, i) => b.addFighter(this.defs[id], 'inimigo', i));
    const atk = heroiAtaca ? b.heroes[0] : b.enemies[0];
    const alvo = heroiAtaca ? b.enemies[0] : b.heroes[0];
    if (cfg.forma && atk.def.formas[cfg.forma]) atk.setForm(cfg.forma);
    if (cfg.alvoForma && alvo.def.formas[cfg.alvoForma]) alvo.setForm(cfg.alvoForma);
    if (cfg.buff && atk.def.buffs && atk.def.buffs[cfg.buff]) { atk.buffs[cfg.buff] = Object.assign({ id: cfg.buff }, atk.def.buffs[cfg.buff]); atk.idle(); }
    b.atk = atk; b.alvo = alvo;
    FF.battle = b;
    return b;
  }

  // relógio limpo e sorteios previsíveis
  zerarRelogio() { Object.assign(FF.Clock, { t: 0, waits: [], freeze: 0, scale: 1, velocidade: 1, pausado: false }); this.semente = 12345; }
  comSorteio(fn) {
    const orig = Math.random;
    let s = this.semente;
    Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try { return fn(); } finally { this.semente = s; Math.random = orig; }
  }
  semSom(fn) {
    const p = FF.Audio.play, v = FF.Audio.voice;
    FF.Audio.play = () => null; FF.Audio.voice = () => null;
    try { return fn(); } finally { FF.Audio.play = p; FF.Audio.voice = v; }
  }

  // começa o golpe (linha) do zero
  comecar(golpe, linha) {
    this.zerarRelogio();
    this.ref = {};
    const b = this.novaBatalha();
    this._b = b;
    this.golpe = golpe; this.linha = linha;
    b.atk.busy = true;
    const orig = FF.Linha.disparar;
    const self = this;
    // grava as referências de cada clipe no instante em que ele dispara (para as alças no palco)
    FF.Linha.disparar = self.envolver(orig);
    try {
      this.viva = this.comSorteio(() => FF.Linha.iniciar(b, b.atk, b.alvo, Object.assign({}, golpe, { roteiro: [{ linha }] }), linha));
    } finally { FF.Linha.disparar = orig; }
    this._disp = orig;
    this.atraso = -this.viva.t;
    this.tempo = this.viva.t;
  }

  // grava referências e marca os efeitos criados com o id do clipe (para escolher clicando no palco)
  envolver(orig) {
    const self = this;
    return function (bb, viva, c) {
      try { self.gravarRef(bb, viva, c); } catch (e) { /* nada */ }
      const n = bb.fxList.length;
      const r = orig.apply(this, arguments);
      if (c.tipo === 'efeito' && bb.fxList.length > n) bb.fxList[bb.fxList.length - 1]._clipe = c.id;
      return r;
    };
  }

  gravarRef(b, viva, c) {
    const a = viva.actor, t = viva.target;
    const r = { dir: a ? a.dir : 1 };
    if (c.tipo === 'efeito') r.p = FF.Linha.ponto(b, a, t, c.em);
    if (c.tipo === 'projetil') { r.de = a.pontoDisparo(); r.ate = t ? t.peito() : null; }
    if (c.tipo === 'acerto' && t) r.p = t.peito();
    if (c.tipo === 'anim') { const f = FF.Linha.lutadorDe(b, a, t, c._tr.quem); if (f) r.f = f; }
    this.ref[c.id] = r;
  }

  // avança a simulação um passo (dt de jogo fixo)
  passo(dt) {
    const orig = FF.Linha.disparar, self = this;
    FF.Linha.disparar = self.envolver(orig);
    try {
      this.comSorteio(() => {
        const g = FF.Clock.tick(dt);
        this._b.update(g);
        this.tempo = FF.Clock.t - this.atraso;
      });
    } finally { FF.Linha.disparar = orig; }
  }

  // mostra o instante T (re-simula do começo, sem som)
  irPara(golpe, linha, T) {
    this.semSom(() => {
      this.comecar(golpe, linha);
      let guarda = 0;
      while (this.tempo < T - 1e-6 && guarda++ < 60 * 30) this.passo(this.DT);
    });
    this.tempoReal = 0;
  }

  // tempo real (tocando): avança com som
  tocar(dtReal) {
    this._acum = (this._acum || 0) + dtReal;
    let n = 0;
    while (this._acum >= this.DT && n++ < 10) { this._acum -= this.DT; this.passo(this.DT); }
  }

  // ---------- batalha real ----------
  async naBatalha(golpe, linha, aoFim) {
    this.modo = 'batalha';
    this.zerarRelogio();
    const b = this.novaBatalha();
    this._b = b;
    const mv = Object.assign({}, golpe, { roteiro: [{ linha }] });
    b.atk.ki = b.atk.kiMax; b.atk.rage = 100;
    this._fimBatalha = false;
    try { await b.execute(b.atk, b.alvo, mv); }
    catch (e) { console.error(e); FF.Estudio.aviso('Erro ao rodar o golpe: ' + e.message, 'erro'); }
    this._fimBatalha = true;
    setTimeout(() => { this.modo = 'edicao'; aoFim && aoFim(b); }, 600);
  }
  quadroBatalha(dtReal) {
    const g = FF.Clock.tick(dtReal);
    this._b.update(g);
  }
  apertar() { if (this._b) this._b.onPress(); }

  // ---------- desenho ----------
  desenhar(extra) {
    const b = this._b, ctx = this.ctx;
    if (!b) return;
    ctx.imageSmoothingEnabled = false;
    const hud = FF.HUD.draw;
    if (!(this.modo === 'batalha' || this.opts.hud)) FF.HUD.draw = () => {};
    try { b.draw(ctx); } finally { FF.HUD.draw = hud; }
    if (this.modo === 'batalha') return;
    ctx.save();
    const cam = b.cam;
    if (cam && (cam.zoom !== 1 || cam.x || cam.y)) {
      ctx.translate(FF.W / 2, FF.H / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-FF.W / 2 - cam.x, -FF.H / 2 - cam.y);
    }
    if (this.opts.cebola) this.desenharCebola(ctx, b);
    if (this.opts.grade) this.desenharGrade(ctx);
    if (this.opts.refs) this.desenharRefs(ctx, b);
    extra && extra(ctx, b);
    ctx.restore();
  }

  desenharGrade(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    for (let x = 0; x <= FF.W; x += 50) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, FF.H); ctx.stroke(); }
    for (let y = 0; y <= FF.H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(FF.W, y + 0.5); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,216,74,0.35)';
    ctx.beginPath(); ctx.moveTo(0, this._b.groundY + 0.5); ctx.lineTo(FF.W, this._b.groundY + 0.5); ctx.stroke();
    ctx.restore();
  }

  cruz(ctx, x, y, cor, r = 6) {
    ctx.strokeStyle = cor; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
  }

  desenharRefs(ctx, b) {
    ctx.save();
    for (const f of b.all) {
      const x = f.x + (f.offX || 0), y = f.y + (f.offY || 0);
      this.cruz(ctx, x, y, 'rgba(120,255,140,0.9)');            // pés
      const p = f.peito();
      this.cruz(ctx, p.x, p.y, 'rgba(255,120,200,0.8)', 4);      // peito
      if (f === b.atk) { const d = f.pontoDisparo(); this.cruz(ctx, d.x, d.y, 'rgba(255,216,74,0.95)', 5); }
    }
    ctx.restore();
  }

  desenharCebola(ctx, b) {
    for (const f of b.all) {
      const a = f.anim.a;
      if (!a || a.frames.length < 2) continue;
      [[f.anim.i - 1, 'rgba(255,60,60,0.55)'], [f.anim.i + 1, 'rgba(60,140,255,0.55)']].forEach(([i, cor]) => {
        if (i < 0 || i >= a.frames.length) return;
        FF.drawFrame(ctx, f.sprite, a.frames[i], f.x + (f.offX || 0), f.y + (f.offY || 0), f.scale * (f.escExtra || 1), (f.dir < 0) !== !!f.flipExtra, { tint: cor, alpha: 0.4 });
      });
    }
  }

  // coordenadas do canvas a partir de um evento do mouse/toque (desfaz a câmera)
  pontoTela(e) {
    const r = this.cv.getBoundingClientRect();
    let x = (e.clientX - r.left) * this.cv.width / r.width, y = (e.clientY - r.top) * this.cv.height / r.height;
    const cam = this._b && this._b.cam;
    if (cam && (cam.zoom !== 1 || cam.x || cam.y)) { x = (x - FF.W / 2) / cam.zoom + FF.W / 2 + cam.x; y = (y - FF.H / 2) / cam.zoom + FF.H / 2 + cam.y; }
    return { x, y };
  }
};
