// Motor de batalha por turnos: fluxo de turnos, dano, guarda cronometrada,
// golpes críticos, efeitos, projéteis e desenho da cena.
window.FF = window.FF || {};

FF.W = 1084;
FF.H = 580;

FF.Battle = class {
  constructor(def, stage, ui) {
    this.def = def;
    this.stage = stage;
    this.ui = ui;
    this.scale = def.escala || 2.5;
    this.groundY = stage.chaoY || 470;
    this.heroes = [];
    this.enemies = [];
    this.fxList = [];
    this.projectiles = [];
    this.texts = [];
    this.qtes = [];
    this.tweens = [];
    this.shakeAmt = 0;
    this.flashAmt = 0;
    this.bannerTxt = null;
    this.over = false;
    this.lockUntil = 0;
    this.turnLabel = '';
    this.fx = FF.Assets.sprites.fx;
    this.stageSprite = FF.Assets.sprites[stage.sprite];
    FF.Input.onAction(() => this.onPress());
  }

  get all() { return this.heroes.concat(this.enemies); }

  addFighter(charDef, lado, idx) {
    const pos = lado === 'heroi' ? this.def.posicoes.herois : this.def.posicoes.inimigos;
    const f = new FF.Fighter(charDef, lado, pos[idx] || pos[0], this.groundY, this.scale);
    (lado === 'heroi' ? this.heroes : this.enemies).push(f);
    return f;
  }

  // ---------- fluxo ----------
  async run() {
    FF.Audio.music(this.def.musica);
    await this.intro();
    while (!this.over) {
      for (const h of this.heroes) {
        if (this.over || h.ko) continue;
        await this.turn(h, true);
      }
      for (const e of this.enemies) {
        if (this.over || e.ko) continue;
        await this.turn(e, false);
      }
    }
  }

  async intro() {
    this.turnLabel = '';
    this.banner(this.def.titulo, 2.2);
    for (const fala of (this.def.intro || [])) {
      const f = this.all.find(x => x.id === fala.quem);
      if (fala.voz) FF.Audio.voice(fala.voz);
      if (f && fala.anim) f.play(fala.anim, { loop: true });
      await FF.Clock.wait(fala.esperar || 1.5);
      if (f) f.idle();
    }
    FF.Audio.play('battlecall_fight01', 1);
    this.banner('LUTE!', 1.0);
    await FF.Clock.wait(1.0);
  }

  async turn(actor, isHero) {
    const foes = isHero ? this.enemies : this.heroes;
    const target = foes.find(f => !f.ko);
    if (!target) return;
    this.turnLabel = 'Vez de ' + actor.nome;
    let moveId;
    if (isHero) moveId = await this.ui.chooseMove(actor, this);
    else { await FF.Clock.wait(0.6); moveId = FF.AI.choose(actor, target, this); }
    const move = actor.def.golpes[moveId];
    await this.execute(actor, target, move);
    if (this.checkEnd()) return;
    await this.endTurn(actor);
    this.checkEnd();
  }

  async execute(actor, target, move) {
    actor.addKi(-(move.custoKi || 0));
    if (move.custoKi) this.popup(actor, '-' + move.custoKi + ' KI', '#7fd0ff');
    actor.busy = true;
    if (move.anuncio !== false) this.banner(move.nome, 1.2);
    await FF.Script.run(this, actor, target, move);
    await Promise.all(this.projectiles.map(p => p.done));
    await FF.Clock.wait(0.25);
    actor.busy = false;
    actor.idle();
    await this.resetPositions();
  }

  async endTurn(f) {
    f.addKi(f.def.atributos.kiPorTurno || 0);
    // buffs (ex.: Kaioken)
    for (const [id, bf] of Object.entries(f.buffs)) {
      if (bf.hpPorTurno) {
        const d = Math.round(f.hpMax * bf.hpPorTurno);
        f.hp = Math.max(1, f.hp - d);
        this.popup(f, '-' + d, '#ff8080');
      }
      bf.turnos -= 1;
      if (bf.turnos <= 0) { delete f.buffs[id]; this.banner((bf.nome || id) + ' acabou', 1.0); await FF.Clock.wait(0.5); }
    }
    // formas que gastam ki por turno (ex.: Super Saiyajin)
    const form = f.form;
    if (f.transformouAgora) { f.transformouAgora = false; }
    else if (form.kiPorTurno) {
      f.addKi(-form.kiPorTurno);
      this.popup(f, '-' + form.kiPorTurno + ' KI', '#7fd0ff');
      if (f.ki <= 0 && form.reverter) {
        f.busy = true;
        await FF.Script.run(this, f, null, {}, form.reverter);
        f.busy = false;
        f.idle();
      }
    }
  }

  checkEnd() {
    if (this.over) return true;
    const heroesDown = this.heroes.every(h => h.ko);
    const enemiesDown = this.enemies.every(e => e.ko);
    if (!heroesDown && !enemiesDown) return false;
    this.over = true;
    this.finish(enemiesDown);
    return true;
  }

  async finish(win) {
    this.turnLabel = '';
    await FF.Clock.wait(1.2);
    const winners = win ? this.heroes : this.enemies;
    FF.Audio.play('battlefinish', 1);
    this.banner(win ? 'VITÓRIA!' : 'DERROTA...', 3);
    if (win) FF.Audio.music('results_victory_theme');
    else FF.Audio.music(null);
    for (const w of winners.filter(x => !x.ko)) {
      w.busy = true;
      w.x = w.homeX;
      const seq = w.form.vitoria || w.def.vitoria;
      if (seq) FF.Script.run(this, w, null, { nome: '' }, seq.map(s => Object.assign({ final: true }, s)));
    }
    await FF.Clock.wait(2.5);
    this.ui.showEnd(win);
  }

  // ---------- combate ----------
  qteMode(actor, target) {
    if (!target) return null;
    if (target.isHero && !actor.isHero) return 'guarda';
    if (actor.isHero && !target.isHero) return 'critico';
    return null;
  }

  addQte(mode, alvo, inSec) {
    const q = { mode, alvo, start: FF.Clock.t, at: FF.Clock.t + inSec, press: null, result: undefined };
    this.qtes.push(q);
    return q;
  }

  resolveQte(q) {
    if (!q) return null;
    if (q.result === undefined) {
      q.result = !q.press ? null : (q.at - q.press <= 0.10 ? 'perfeito' : 'bom');
      q.doneAt = FF.Clock.t;
      if (!q.result && q.mode === 'guarda') this.popup(q.alvo, 'Sem guarda', '#bbbbbb', -40);
    }
    return q.result;
  }

  onPress() {
    if (this.over) return;
    const now = FF.Clock.t;
    if (now < this.lockUntil) return;
    const pend = this.qtes.filter(q => q.result === undefined && !q.press).sort((a, b) => a.at - b.at)[0];
    if (!pend) return;
    const left = pend.at - now;
    if (left <= 0.30 && left >= -0.02) {
      pend.press = now;
    } else if (left > 0.30) {
      this.lockUntil = now + 0.35;
      this.popup(pend.alvo, 'Cedo demais!', '#ffcf6b', -40);
    }
  }

  applyHit(att, def, move, spec, qte) {
    if (def.ko) return 0;
    const res = this.resolveQte(qte);
    const mode = qte ? qte.mode : null;
    const forca = spec.forca || 'leve';
    let dmg = (move.poder || 1) * (spec.fracao || 1) * att.stat('ataque') * 100 / (100 + def.stat('defesa'));
    dmg *= 0.9 + Math.random() * 0.2;
    let guard = false;

    if (mode === 'guarda' && res) {
      guard = true;
      dmg *= res === 'perfeito' ? 0.1 : 0.4;
      if (!qte._shown) { this.popup(def, res === 'perfeito' ? 'GUARDA PERFEITA!' : 'GUARDA!', res === 'perfeito' ? '#7dffb0' : '#a0e0ff', -46); qte._shown = true; }
      if (res === 'perfeito') def.addKi(3);
    }
    if (mode === 'critico' && res) {
      dmg *= res === 'perfeito' ? 1.8 : 1.4;
      if (!qte._shown) { this.popup(def, res === 'perfeito' ? 'CRÍTICO!!' : 'CRÍTICO!', '#ffd84a', -46); qte._shown = true; }
    }

    dmg = Math.max(1, Math.round(dmg));
    def.hp = Math.max(0, def.hp - dmg);
    this.popup(def, String(dmg), guard ? '#cfe8ff' : '#ffffff');

    const p = def.peito();
    if (guard) {
      this.spawnFx('guarda', p.x + def.dir * 10, p.y, def.dir < 0, 0.3);
      FF.Audio.play(forca === 'forte' || forca === 'energia' ? 'guard_large' : ['guard_small-a', 'guard_small-b']);
      def.reagir('guarda', 0.25);
    } else {
      const fxName = spec.fx || { leve: 'hit1', media: 'hit3', forte: 'hit_grande', energia: 'kiblast_hit' }[forca] || 'hit1';
      this.spawnFx(fxName, p.x + (spec.dx || 0), p.y + (spec.dy || 0), att.dir < 0, spec.fxEscala || (forca === 'forte' ? 0.5 : 1));
      FF.Audio.play({ leve: ['hit_small-a', 'hit_small-b'], media: 'hit_midle-a', forte: 'hit_large-a', energia: 'hit_kidan' }[forca]);
      if (def.hp <= 0) {
        def.ko = true;
        def.voz('lancado');
        def.lancar(700);
        FF.Audio.play('blow_down');
        FF.Clock.hitstop(0.25);
      } else if (spec.lanca) {
        def.lancar(spec.empurrao || 520);
        def.voz('lancado');
      } else {
        def.reagir('dano', 0.24);
        if (Math.random() < 0.4 || forca === 'forte') def.voz('dano');
        if (spec.empurrao) def.vx = -def.dir * spec.empurrao;
      }
    }
    FF.Clock.hitstop(forca === 'forte' || forca === 'energia' ? 0.08 : 0.045);
    this.shake({ leve: 3, media: 5, forte: 9, energia: 7 }[forca] || 3);
    return dmg;
  }

  spawnFx(name, x, y, flip, scale) {
    const set = this.fx.has(name) ? this.fx : null;
    if (!set) return;
    const a = new FF.Animator(set);
    a.play(name, { loop: false });
    this.fxList.push({ a, set, x, y, flip, scale: (scale || 1) * this.scale });
  }

  spawnProjectile(att, def, move, spec) {
    const from = att.pontoDisparo();
    const to = def.peito();
    const vel = spec.velocidade || 800;
    const dist = Math.abs(to.x - from.x);
    const travel = dist / vel;
    const qteMode = this.qteMode(att, def);
    const qte = qteMode && !def.ko ? this.addQte(qteMode, def, travel) : null;
    const a = new FF.Animator(this.fx);
    a.play(spec.fx || 'kiblast_amarelo', { loop: true });
    if (spec.som) FF.Audio.play(spec.som);
    let res;
    const p = { a, x: from.x, y: from.y, vx: (to.x > from.x ? 1 : -1) * vel, vy: (to.y - from.y) / travel,
      flip: att.dir < 0, left: travel, done: new Promise(r => (res = r)) };
    p.hit = () => {
      if (spec.impacto) this.spawnFx(spec.impacto, to.x, to.y, att.dir < 0, spec.impactoEscala || 1);
      this.applyHit(att, def, move, spec.acerto || { fracao: 0.3, forca: 'energia' }, qte);
      res();
    };
    this.projectiles.push(p);
  }

  tween(f, toX, dur) {
    return new Promise(res => this.tweens.push({ f, x0: f.x, x1: toX, t: 0, dur, res }));
  }

  async resetPositions() {
    const moving = this.all.filter(f => Math.abs(f.x - f.homeX) > 2);
    await Promise.all(moving.map(f => {
      if (!f.ko) f.play(f.x * f.dir > f.homeX * f.dir ? 'recuar' : 'avancar', { loop: true });
      return this.tween(f, f.homeX, 0.3).then(() => { f.idle(); });
    }));
  }

  // ---------- feedback ----------
  popup(f, text, color, dy) {
    const p = f.peito();
    this.texts.push({ text, color: color || '#fff', x: p.x + (Math.random() * 16 - 8), y: p.y - 40 + (dy || 0), t: 0, life: 1.0 });
  }
  banner(text, dur) { this.bannerTxt = { text, until: FF.Clock.t + (dur || 1.2), start: FF.Clock.t }; }
  shake(n) { this.shakeAmt = Math.max(this.shakeAmt, n); }
  flash(n) { this.flashAmt = Math.max(this.flashAmt, n); }

  // ---------- loop ----------
  update(dt) {
    this.all.forEach(f => f.update(dt));
    this.fxList.forEach(e => e.a.update(dt));
    this.fxList = this.fxList.filter(e => !e.a.done);
    for (const tw of this.tweens) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.f.x = tw.x0 + (tw.x1 - tw.x0) * (1 - Math.pow(1 - k, 2));
      if (k >= 1) tw.res();
    }
    this.tweens = this.tweens.filter(tw => tw.t < tw.dur);
    for (const p of this.projectiles) {
      p.a.update(dt);
      p.x += p.vx * dt; p.y += p.vy * dt; p.left -= dt;
      if (p.left <= 0 && !p.dead) { p.dead = true; p.hit(); }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.texts.forEach(t => { t.t += dt; t.y -= 40 * dt; });
    this.texts = this.texts.filter(t => t.t < t.life);
    // QTEs vencidos sem acerto (ex.: alvo nocauteado antes)
    this.qtes = this.qtes.filter(q => !(q.result !== undefined && FF.Clock.t - q.doneAt > 0.4) && FF.Clock.t - q.at < 1.5);
    this.shakeAmt *= Math.pow(0.001, dt);
    this.flashAmt = Math.max(0, this.flashAmt - dt * 2.5);
  }

  draw(ctx) {
    ctx.save();
    if (this.shakeAmt > 0.3) ctx.translate((Math.random() - 0.5) * this.shakeAmt * 2, (Math.random() - 0.5) * this.shakeAmt * 2);
    this.drawStage(ctx);
    // quem está agindo fica na frente
    const order = this.all.slice().sort((a, b) => (a.busy ? 1 : 0) - (b.busy ? 1 : 0));
    order.forEach(f => f.draw(ctx, this.fx));
    this.projectiles.forEach(p => FF.drawFrame(ctx, this.fx, p.a.frame(), p.x, p.y, this.scale, p.flip));
    this.fxList.forEach(e => FF.drawFrame(ctx, e.set, e.a.frame(), e.x, e.y, e.scale, e.flip));
    ctx.restore();
    this.drawQtes(ctx);
    FF.HUD.draw(ctx, this);
    if (this.flashAmt > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, this.flashAmt) + ')';
      ctx.fillRect(0, 0, FF.W, FF.H);
    }
  }

  drawStage(ctx) {
    const set = this.stageSprite;
    const st = this.stage;
    const ceu = set.anim(st.ceu).frames[0];
    // céu cobre a tela inteira, alinhado pela base no chão
    const sc = Math.max(FF.W / ceu[3], (this.groundY + (st.ceuDesce || 40)) / ceu[4]);
    ctx.drawImage(set.images[ceu[0]], ceu[1], ceu[2], ceu[3], ceu[4],
      (FF.W - ceu[3] * sc) / 2, this.groundY + (st.ceuDesce || 40) - ceu[4] * sc, ceu[3] * sc, ceu[4] * sc);
    const chao = set.anim(st.chao).frames[0];
    const cs = st.chaoEscala || 2;
    const ch = chao[4] * cs;
    for (let x = -((chao[3] * cs - FF.W) / 2); x < FF.W; x += chao[3] * cs) {
      ctx.drawImage(set.images[chao[0]], chao[1], chao[2], chao[3], chao[4], x, this.groundY - (st.chaoTopo || 18) * cs, chao[3] * cs, ch);
    }
    const base = this.groundY - (st.chaoTopo || 18) * cs + ch;
    if (base < FF.H) { ctx.fillStyle = st.corTerra || '#5a8f2a'; ctx.fillRect(0, base, FF.W, FF.H - base); }
  }

  drawQtes(ctx) {
    const now = FF.Clock.t;
    for (const q of this.qtes) {
      if (q.result !== undefined) continue;
      const p = q.alvo.peito();
      const span = Math.max(0.05, q.at - q.start);
      const k = Math.max(0, (q.at - now) / span);
      const inWin = q.at - now <= 0.30;
      const col = q.mode === 'guarda' ? '120,220,255' : '255,210,70';
      ctx.save();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(' + col + ',0.9)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = inWin ? 6 : 3;
      ctx.strokeStyle = inWin ? 'rgba(255,255,255,0.95)' : 'rgba(' + col + ',0.7)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 26 + 90 * k, 0, Math.PI * 2); ctx.stroke();
      if (q.press) { ctx.fillStyle = 'rgba(' + col + ',0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.fill(); }
      FF.HUD.text(ctx, q.mode === 'guarda' ? 'GUARDA' : 'CRÍTICO', p.x, p.y - 38 - 90 * k * 0.3, 14, '#fff', 'center');
      ctx.restore();
    }
  }
};
