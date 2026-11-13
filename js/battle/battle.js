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
    this.fx2 = FF.Assets.sprites.fx_extra || null;   // explosões, rochas, Genki Dama...
    this.objs = {};
    this.paralelos = [];                             // sub-roteiros de parceiros (Sparking Combo)                                  // objetos persistentes de golpes (ex.: Genki Dama crescendo)
    this.stageSprite = FF.Assets.sprites[stage.sprite];
    FF.Input.onAction(() => this.onPress());
  }

  get all() { return this.heroes.concat(this.enemies); }

  static ofensivo(mv) {
    const j = JSON.stringify(mv.roteiro || []);
    return /"(acerto|projetil|lancarObjeto|atordoar)"/.test(j);
  }

  addFighter(charDef, lado, idx) {
    const pos = lado === 'heroi' ? this.def.posicoes.herois : this.def.posicoes.inimigos;
    // ajustes por batalha (ex.: Raditz com mais vida contra 3 heróis)
    // ajustes valem para o lado inimigo (na Batalha Livre o mesmo personagem pode estar nos dois lados)
    const aj = lado === 'inimigo' ? (this.def.ajustes || {})[charDef.id] : (this.def.ajustesHerois || {})[charDef.id];
    if (aj) charDef = Object.assign({}, charDef, { atributos: Object.assign({}, charDef.atributos, aj) });
    // melhorias compradas com AP (só heróis)
    if (lado === 'heroi' && FF.Treino) charDef = Object.assign({}, charDef, { atributos: FF.Treino.aplicar(charDef.id, charDef.atributos) });
    // posições do JSON são para a tela base de 1084 px; em telas mais largas, centraliza
    const offX = (FF.W - 1084) / 2;
    const f = new FF.Fighter(charDef, lado, (pos[idx] != null ? pos[idx] : pos[0]) + offX, this.groundY, this.scale);
    const lista = lado === 'heroi' ? this.heroes : this.enemies;
    const iguais = lista.filter(x => x.id === f.id);
    if (iguais.length) {   // vários do mesmo (ex.: Saibamen): A, B, C...
      if (iguais.length === 1) iguais[0].sufixo = ' A';
      f.sufixo = ' ' + String.fromCharCode(65 + iguais.length);
    }
    lista.push(f);
    return f;
  }

  // ---------- fluxo ----------
  async run() {
    FF.Audio.music(this.def.musica);
    await this.intro();
    while (!this.over) {
      // ordem de turno pela velocidade (empate: heróis primeiro)
      const ordem = this.all.slice().sort((a, b) => (b.stat('velocidade') - a.stat('velocidade')) || ((b.isHero ? 1 : 0) - (a.isHero ? 1 : 0)));
      this.ordem = ordem;   // mostrada no HUD
      for (const f of ordem) {
        if (this.over || f.ko) continue;
        await this.turn(f, f.isHero);
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
    const foes = (isHero ? this.enemies : this.heroes).filter(f => !f.ko);
    if (!foes.length) return;
    // herói ataca o primeiro inimigo de pé; inimigo escolhe um herói (prefere quem está mais fraco)
    let target = foes[0];
    if (!isHero && foes.length > 1) {
      const pesos = foes.map(f => 1 + 2 * (1 - f.hp / f.hpMax));
      let x = Math.random() * pesos.reduce((a, b) => a + b, 0);
      target = foes.find((f, i) => (x -= pesos[i]) <= 0) || foes[0];
    }
    // atordoado (ex.: Taiyoken do Kuririn): perde a vez
    if (actor.atordoado > 0) {
      actor.atordoado--;
      this.popup(actor, 'ATORDOADO!', '#fff27a');
      this.banner(actor.nome + ' não consegue enxergar!', 1.2);
      await FF.Clock.wait(1.2);
      await this.endTurn(actor);
      return;
    }
    this.turnLabel = 'Vez de ' + actor.nome;
    this.atual = actor;               // destacado no HUD (moldura no painel + seta sobre o lutador)
    let moveId;
    if (isHero) {
      moveId = await this.ui.chooseMove(actor, this);
      // vários inimigos de pé: o jogador escolhe o alvo (golpes que acertam alguém)
      const mv = actor.def.golpes[moveId];
      if (foes.length > 1 && FF.Battle.ofensivo(mv)) target = await this.ui.chooseTarget(foes, this);
    }
    else {
      await FF.Clock.wait(0.6);
      const sup = actor.rageCheia && actor.form.golpes.find(id => (actor.def.golpes[id] || {}).supremo);
      moveId = sup || FF.AI.choose(actor, target, this);
    }
    const move = actor.def.golpes[moveId];
    await this.execute(actor, target, move);
    this.atual = null;
    if (this.checkEnd()) return;
    await this.endTurn(actor);
    this.checkEnd();
  }

  async execute(actor, target, move) {
    actor.addKi(-(move.custoKi || 0));
    if (move.custoKi) this.popup(actor, '-' + move.custoKi + ' KI', '#7fd0ff');
    const parc = move.requer && move.requer.parceiro;
    if (parc) {
      const pf = this.all.find(f => f.id === parc.id);
      if (pf && parc.ki) { pf.addKi(-parc.ki); this.popup(pf, '-' + parc.ki + ' KI', '#7fd0ff'); }
    }
    if (move.supremo) {
      actor.rage = 0;
      this.flash(0.5);
      FF.Audio.play('sprkngbrst_expl', 0.8);
    }
    actor.busy = true;
    if (move.anuncio !== false) this.banner(move.nome, move.supremo ? 2.0 : 1.2);
    await FF.Script.run(this, actor, target, move);
    await Promise.all(this.paralelos);
    this.paralelos = [];
    await Promise.all(this.projectiles.map(p => p.done));
    await Promise.all(this.cenasKO || []);   // espera a cena de KO de quem caiu terminar
    this.cenasKO = [];
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
      if (bf.turnos <= 0) {
        delete f.buffs[id];
        if (!f.busy && !f.react) f.idle();       // tira a pose do buff (ex.: postura do Kaioken)
        this.banner((bf.nome || id) + ' acabou', 1.0); await FF.Clock.wait(0.5);
      }
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
    if (this.over || FF.Clock.pausado) return;
    const now = FF.Clock.t;
    if (now < this.lockUntil) return;
    const pend = this.qtes.filter(q => q.result === undefined && !q.press).sort((a, b) => a.at - b.at)[0];
    if (!pend) return;
    const left = pend.at - now;
    if (left <= (FF.janela || 0.30) && left >= -0.02) {
      pend.press = now;
    } else if (left > (FF.janela || 0.30)) {
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
    // Rage Gauge: enche ao causar e (mais) ao receber dano; guarda perfeita também enche
    const fr = dmg / def.hpMax;
    if (!move.supremo) att.addRage(fr * (FF.RAGE_CAUSAR || 90));
    def.addRage(fr * (FF.RAGE_RECEBER || 120) * (move.supremo ? 0.4 : 1) + (guard && res === 'perfeito' ? 8 : 0));
    this.popup(def, String(dmg), guard ? '#cfe8ff' : '#ffffff');

    const p = def.peito();
    if (guard) {
      this.spawnFx('guarda', p.x + def.dir * 10, p.y, def.dir < 0, 0.3);
      FF.Audio.play(forca === 'forte' || forca === 'energia' ? 'guard_large' : ['guard_small-a', 'guard_small-b']);
      def.reagir('guarda', 0.25);
      // a defesa não salva quem já está sem vida: cai mesmo defendendo
      if (def.hp <= 0) { def.ko = true; FF.Clock.hitstop(0.35); (this.cenasKO = this.cenasKO || []).push(FF.KO.tocar(this, att, def)); }
    } else {
      const fxName = spec.fx || { leve: 'hit1', media: 'hit3', forte: 'hit_grande', energia: 'kiblast_hit' }[forca] || 'hit1';
      // posição da explosão do acerto: dx/dy a partir do peito do alvo (dx positivo = para longe de quem bateu)
      const ex = p.x + (spec.dx || 0) * att.dir, ey = p.y + (spec.dy || 0);
      this.spawnFx(fxName, ex, ey, att.dir < 0, spec.fxEscala || (forca === 'forte' ? 0.5 : 1), spec.sprite ? { sprite: spec.sprite } : undefined);
      FF.Audio.play({ leve: ['hit_small-a', 'hit_small-b'], media: 'hit_midle-a', forte: 'hit_large-a', energia: 'hit_kidan' }[forca]);
      if (spec.lanca || def.hp <= 0) {
        // golpe final: impacto extra (corpo a corpo) ou explosão no alvo (energia)
        if (forca === 'forte') this.spawnFx('Extreme', ex, ey, att.dir < 0, 0.7);
        if (forca === 'energia') this.spawnFx('Explosao4', ex, ey, att.dir < 0, 0.8);
      }
      if (def.hp <= 0) {
        def.ko = true;
        FF.Clock.hitstop(0.35);
        // cena de KO (js/battle/ko.js; editável no Estúdio): animação, efeitos, sons, tela
        (this.cenasKO = this.cenasKO || []).push(FF.KO.tocar(this, att, def));
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

  // sprite: id de um sprite qualquer (ex.: importado no Estúdio) que tenha a animação "name"
  fxSet(name, sprite) {
    if (sprite && FF.Assets.sprites[sprite] && FF.Assets.sprites[sprite].has(name)) return FF.Assets.sprites[sprite];
    if (this.fx.has(name)) return this.fx;
    if (this.fx2 && this.fx2.has(name)) return this.fx2;
    // efeitos que vêm no sprite do próprio lutador (ex.: Bills_Esfera no sprite "bills")
    for (const s of Object.values(FF.Assets.sprites)) if (s && s.has && s.has(name)) return s;
    return null;
  }

  spawnFx(name, x, y, flip, scale, opts) {
    const set = this.fxSet(name, opts && opts.sprite);
    if (!set) { console.log('[FF] efeito inexistente:', name); return null; }
    const a = new FF.Animator(set);
    const dur = opts && opts.duracao;   // anima em loop por "duracao" s (efeitos curtos que repetem)
    a.play(name, { loop: !!dur, fps: opts && opts.fps });
    const e = { a, set, x, y, flip, scale: (scale || 1) * this.scale * (set.def.escala || 1), alpha: opts && opts.alpha, ate: dur ? FF.Clock.t + dur : null };
    this.fxList.push(e);
    return e;
  }

  // Objeto persistente preso ao golpe (ex.: Genki Dama): cresce de escala[0] a escala[1] em "tempo" s.
  criarObjeto(actor, o) {
    const set = this.fxSet(o.fx);
    if (!set) return;
    const a = new FF.Animator(set);
    a.play(o.fx, { loop: true });
    const esc = o.escala || [1, 1];
    const base = { x: actor.x, y: actor.y - 60 * actor.scale };
    this.objs[o.id] = { a, set, x: base.x + (o.dx || 0) * actor.dir, y: base.y + (o.dy || 0), s0: esc[0], s1: esc[1],
      t: 0, dur: o.tempo || 1, flip: actor.dir < 0, particulas: o.particulas, pt: 0 };
  }

  // Arremessa o objeto no alvo; ao chegar, solta efeitos e uma série de acertos.
  lancarObjeto(att, def, move, o) {
    const ob = this.objs[o.id];
    if (!ob || !def) return;
    delete this.objs[o.id];
    const to = def.peito();
    const travel = o.tempo || 1;
    const qteMode = this.qteMode(att, def);
    const qte = qteMode && !def.ko ? this.addQte(qteMode, def, travel) : null;
    if (o.som) FF.Audio.play(o.som);
    let res;
    const sc = ob.s1 * this.scale;
    const p = { a: ob.a, set: ob.set, scale: sc, x: ob.x, y: ob.y, vx: (to.x - ob.x) / travel, vy: (to.y + (o.alvoDy || 0) - ob.y) / travel,
      flip: ob.flip, left: travel, done: new Promise(r => (res = r)) };
    p.hit = async () => {
      for (const ef of (o.impacto || [])) this.spawnFx(ef.fx, to.x + (ef.dx || 0), (ef.chao ? def.groundY : to.y) + (ef.dy || 0), false, ef.escala || 1, ef);
      for (const s of [].concat(o.somImpacto || [])) FF.Audio.play(s);
      this.flash(o.flash || 0.8);
      this.shake(o.tremer || 16);
      const hits = o.acertos || [{ fracao: 1, forca: 'energia', lanca: true }];
      for (let i = 0; i < hits.length; i++) {
        this.applyHit(att, def, move, hits[i], qte);
        if (i < hits.length - 1) { this.shake(o.tremer || 16); await FF.Clock.wait(o.intervalo || 0.18); }
      }
      res();
    };
    this.projectiles.push(p);
  }

  // Projétil que atravessa a tela até o alvo. Campos opcionais do "projetil" no JSON:
  //  velocidade, escala, som, impacto, impactoEscala, somImpacto, tremerImpacto,
  //  disparo (efeito na mão ao soltar), rastro (padrão: sim), crescer (padrão: sim),
  //  curva (altura do arco em px), ondular (amplitude em px), girar (graus/s),
  //  atravessar (depois de acertar, segue até sair da tela), deCima (cai do alto).
  spawnProjectile(att, def, move, spec) {
    const peito = def.peito();
    const to = { x: peito.x, y: peito.y };
    // alvoDx/alvoDy e deDx/deDy: ajuste da chegada e da saída (Estúdio); dx positivo = para a frente de quem solta
    if (spec.alvoDx || spec.alvoDy) { to.x += (spec.alvoDx || 0) * att.dir; to.y += spec.alvoDy || 0; }
    // deAlvo: a saída (deDx/deDy) conta a partir do peito do alvo, não da mão (ex.: chuva que nasce no céu acima dele)
    const from = spec.deCima
      ? { x: to.x - att.dir * (20 + Math.random() * 110) * this.scale, y: to.y - (230 + Math.random() * 60) * this.scale }
      : spec.deAlvo ? { x: peito.x, y: peito.y } : att.pontoDisparo();
    if (spec.deDx || spec.deDy) { from.x += (spec.deDx || 0) * att.dir; from.y += spec.deDy || 0; }
    const vel = spec.velocidade || 650;
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const travel = Math.max(0.05, dist / vel);
    const qteMode = this.qteMode(att, def);
    // semAcerto: só visual (vai até o ponto, solta o impacto e some, sem dano nem anel)
    const qte = qteMode && !def.ko && !spec.semAcerto ? this.addQte(qteMode, def, travel) : null;
    const fxName = spec.fx || 'kiblast_amarelo';
    const set = this.fxSet(fxName, spec.sprite) || this.fx;
    const a = new FF.Animator(set);
    a.play(fxName, { loop: true });
    if (spec.som) FF.Audio.play(spec.som);
    if (spec.disparo) this.spawnFx(spec.disparo, from.x, from.y, att.dir < 0, spec.disparoEscala || 0.6, spec.disparoSprite ? { sprite: spec.disparoSprite } : undefined);
    let res;
    const p = {
      a, set, base: (spec.escala || 1) * this.scale * (set.def.escala || 1), scale: (spec.escala || 1) * this.scale * (set.def.escala || 1),
      x0: from.x, y0: from.y, x1: to.x, y1: to.y, x: from.x, y: from.y, t: 0, travel,
      vx: (to.x - from.x) / travel, vy: (to.y - from.y) / travel,
      flip: att.dir < 0, dir: att.dir, rastroOn: spec.rastro !== false, rastro: [],
      crescer: spec.crescer !== false, curva: spec.curva || 0, ondular: spec.ondular || 0,
      girar: spec.girar || 0, ang: 0, atravessar: !!spec.atravessar, acertou: false,
      centro: !!spec.centro, ajX: (spec.spriteDx || 0) * att.dir, ajY: spec.spriteDy || 0, clipe: spec.id,
      rot: spec.rot ? spec.rot * att.dir * Math.PI / 180 : 0, filtro: FF.Battle.filtroCor(spec.cor, spec.corForca),
      done: new Promise(r => (res = r)),
    };
    p.hit = () => {
      if (spec.impacto) this.spawnFx(spec.impacto, to.x + (spec.impactoDx || 0) * att.dir, to.y + (spec.impactoDy || 0), att.dir < 0, spec.impactoEscala || 1, spec.impactoSprite ? { sprite: spec.impactoSprite } : undefined);
      if (spec.somImpacto) FF.Audio.play(spec.somImpacto);
      if (spec.tremerImpacto) this.shake(spec.tremerImpacto);
      if (!spec.semAcerto) this.applyHit(att, def, move, spec.acerto || { fracao: 0.3, forca: 'energia' }, qte);
      res();
    };
    this.projectiles.push(p);
  }

  atualizarProjetil(p, dt) {
    if (p.left != null) {   // objeto arremessado (ex.: Genki Dama): movimento reto simples
      p.a.update(dt);
      p.x += p.vx * dt; p.y += p.vy * dt; p.left -= dt;
      if (p.left <= 0) { p.dead = true; p.hit(); }
      return;
    }
    p.a.update(dt);
    p.t += dt;
    const k = p.t / p.travel;                       // 0 → 1 até o alvo; > 1 se atravessar
    let x = p.x0 + p.vx * p.t, y = p.y0 + p.vy * p.t;
    if (p.curva && k <= 1) y -= Math.sin(Math.PI * k) * p.curva;
    if (p.ondular) y += Math.sin(p.t * 18) * p.ondular * (k <= 1 ? 1 - k * 0.5 : 0.5);
    if (p.rastroOn) { p.rastro.unshift({ x: p.x, y: p.y, f: p.a.frame(), ang: p.ang }); if (p.rastro.length > 7) p.rastro.pop(); }
    // em arco (sem giro), o projétil aponta para onde está indo
    if (p.curva && !p.girar && (x !== p.x || y !== p.y)) p.ang = Math.atan2(y - p.y, Math.abs(x - p.x)) * p.dir;
    p.x = x; p.y = y;
    p.ang += (p.girar * Math.PI / 180) * dt;
    p.scale = p.base * (p.crescer ? Math.min(1, 0.55 + p.t * 4) : 1);
    if (k >= 1 && !p.acertou) {
      p.acertou = true;
      p.hit();
      if (!p.atravessar) p.dead = true;
    }
    if (p.acertou && p.atravessar && (p.x < -150 || p.x > FF.W + 150)) p.dead = true;
  }

  // deslocamento do desenho em relação ao caminho: "centro" (meio do quadro no caminho) + ajuste livre (Estúdio)
  // cor (círculo cromático do Estúdio): pinta o sprite com o matiz "cor" (0–359°) mantendo o claro/escuro
  static filtroCor(cor, forca) {
    if (cor == null || cor === '') return null;
    const f = forca != null ? forca : 1;
    return 'grayscale(1) sepia(1) saturate(' + (1 + 4 * f).toFixed(2) + ') hue-rotate(' + Math.round(cor - 38) + 'deg)';
  }
  desvioProjetil(p, f, sc) {
    let x = p.ajX || 0, y = p.ajY || 0;
    if (p.centro && f) { x += (p.flip ? -1 : 1) * (f[5] - f[3] / 2) * sc; y += (f[6] - f[4] / 2) * sc; }
    return { x, y };
  }
  // caixa do desenho atual na tela (Estúdio: clicar e arrastar o projétil)
  caixaProjetil(p) {
    const f = p.a.frame(); if (!f) return null;
    const sc = p.scale || this.scale, d = this.desvioProjetil(p, f, sc);
    const x = p.x + d.x, y = p.y + d.y;
    const x0 = p.flip ? x - (f[3] - f[5]) * sc : x - f[5] * sc, y0 = y - f[6] * sc;
    return { x: x0, y: y0, w: f[3] * sc, h: f[4] * sc, cx: x0 + f[3] * sc / 2, cy: y0 + f[4] * sc / 2 };
  }

  desenharProjetil(ctx, p) {
    const draw = (f, x, y, sc, ang, alpha) => {
      if (!f) return;
      const d = this.desvioProjetil(p, f, sc), o = alpha != null ? { alpha } : undefined;
      ctx.save();
      if (p.filtro) ctx.filter = p.filtro;            // cor escolhida no Estúdio (círculo cromático)
      ctx.translate(x, y);
      if (ang) ctx.rotate(ang);
      if (p.rot) {   // giro fixo do desenho (Estúdio), em volta do meio do quadro
        const cxo = (p.flip ? -1 : 1) * (f[3] / 2 - f[5]) * sc, cyo = (f[4] / 2 - f[6]) * sc;
        ctx.translate(d.x + cxo, d.y + cyo); ctx.rotate(p.rot);
        FF.drawFrame(ctx, p.set || this.fx, f, -cxo, -cyo, sc, p.flip, o);
      } else FF.drawFrame(ctx, p.set || this.fx, f, d.x, d.y, sc, p.flip, o);
      ctx.restore();
    };
    if (!p.rastro) return draw(p.a.frame(), p.x, p.y, p.scale || this.scale, 0);
    p.rastro.forEach((r, i) => draw(r.f, r.x, r.y, p.scale * (1 - i * 0.08), r.ang, 0.35 * (1 - i / p.rastro.length)));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    draw(p.a.frame(), p.x, p.y, p.scale * 1.08, p.ang, 0.25);  // brilho
    ctx.restore();
    draw(p.a.frame(), p.x, p.y, p.scale, p.ang);
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
    this.fxList.forEach(e => {
      e.a.update(dt);
      if (e.segue) { const s = e.segue; e.x = s.ex + (s.f.x - s.x0); e.y = s.ey + (s.f.y - s.y0); }
    });
    this.fxList = this.fxList.filter(e => !e.a.done && !(e.ate && FF.Clock.t > e.ate));
    for (const ob of Object.values(this.objs)) {
      ob.a.update(dt);
      ob.t += dt;
      const k = Math.min(1, ob.t / ob.dur);
      ob.scale = (ob.s0 + (ob.s1 - ob.s0) * (1 - Math.pow(1 - k, 2))) * this.scale;
      if (ob.particulas && k < 1) {
        ob.pt -= dt;
        if (ob.pt <= 0) {
          ob.pt = 0.12;
          const ang = Math.random() * Math.PI * 2, r = 120 + Math.random() * 160;
          this.spawnFx(ob.particulas, ob.x + Math.cos(ang) * r, ob.y + Math.sin(ang) * r * 0.6, false, 0.5);
        }
      }
    }
    // quem foi lançado e parou: poeira e rochas no chão
    for (const f of this.all) if (f.pousou) {
      f.pousou = false;
      this.spawnFx('Poeira_De_Colisao_Com_O_Solo_Frente', f.x, f.groundY + 4, f.dir > 0, 0.55);
      this.spawnFx('Rochas', f.x + f.dir * 10, f.groundY, f.dir > 0, 0.9);
      this.shake(5);
    }
    for (const tw of this.tweens) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.f.x = tw.x0 + (tw.x1 - tw.x0) * (1 - Math.pow(1 - k, 2));
      if (k >= 1) tw.res();
    }
    this.tweens = this.tweens.filter(tw => tw.t < tw.dur);
    for (const p of this.projectiles) if (!p.dead) this.atualizarProjetil(p, dt);
    (this.cenasVivas || []).slice().forEach(v => v.tick && v.tick(dt));   // cenas livres em andamento
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.texts.forEach(t => { t.t += dt; t.y -= 40 * dt; });
    this.texts = this.texts.filter(t => t.t < t.life);
    // QTEs vencidos sem acerto (ex.: alvo nocauteado antes)
    this.qtes = this.qtes.filter(q => !(q.result !== undefined && FF.Clock.t - q.doneAt > 0.4) && FF.Clock.t - q.at < 1.5);
    // câmera (linha do tempo do Estúdio): vai suavemente até o alvo
    if (this.camAlvo) {
      const c = this.camAlvo, de = c.de;
      c.t += dt;
      const k = c.d > 0 ? Math.min(1, c.t / c.d) : 1, e = k * k * (3 - 2 * k);
      this.cam = { zoom: de.zoom + (c.zoom - de.zoom) * e, x: de.x + (c.x - de.x) * e, y: de.y + (c.y - de.y) * e };
      if (k >= 1) this.camAlvo = null;
    }
    this.shakeAmt *= Math.pow(0.001, dt);
    this.flashAmt = Math.max(0, this.flashAmt - dt * 2.5);
  }

  draw(ctx) {
    ctx.save();
    if (this.shakeAmt > 0.3) ctx.translate((Math.random() - 0.5) * this.shakeAmt * 2, (Math.random() - 0.5) * this.shakeAmt * 2);
    const cam = this.cam;
    if (cam && (cam.zoom !== 1 || cam.x || cam.y)) {   // zoom/foco da câmera (padrão: sem efeito)
      ctx.translate(FF.W / 2, FF.H / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-FF.W / 2 - cam.x, -FF.H / 2 - cam.y);
    }
    this.drawStage(ctx);
    // quem está agindo fica na frente
    const order = this.all.slice().sort((a, b) => (a.busy ? 1 : 0) - (b.busy ? 1 : 0));
    order.forEach(f => f.draw(ctx, this.fx));
    Object.values(this.objs).forEach(o => FF.drawFrame(ctx, o.set, o.a.frame(), o.x, o.y, o.scale || 0.01, o.flip));
    (this.cenasVivas || []).forEach(v => FF.Cena.desenhar(ctx, this, v.actor, v.target, v.cena, v.t));
    this.projectiles.forEach(p => this.desenharProjetil(ctx, p));
    this.fxList.forEach(e => {
      const o = e.alpha != null ? { alpha: e.alpha } : undefined;
      if (!e.rot) return FF.drawFrame(ctx, e.set, e.a.frame(), e.x, e.y, e.scale, e.flip, o);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.rot * Math.PI / 180);
      FF.drawFrame(ctx, e.set, e.a.frame(), 0, 0, e.scale, e.flip, o);
      ctx.restore();
    });
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
    // o chão tem árvores nas pontas: em vez de repetir (fica emendado), amplia até cobrir a largura toda
    const cs = Math.max(st.chaoEscala || 2, FF.W / chao[3]);
    const ch = chao[4] * cs;
    ctx.drawImage(set.images[chao[0]], chao[1], chao[2], chao[3], chao[4], (FF.W - chao[3] * cs) / 2, this.groundY - (st.chaoTopo || 18) * cs, chao[3] * cs, ch);
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
      const inWin = q.at - now <= (FF.janela || 0.30);
      const col = q.mode === 'guarda' ? '120,220,255' : '255,210,70';
      ctx.save();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(' + col + ',0.9)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = inWin ? 6 : 3;
      ctx.strokeStyle = inWin ? 'rgba(255,255,255,0.95)' : 'rgba(' + col + ',0.7)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 26 + 90 * k, 0, Math.PI * 2); ctx.stroke();
      if (q.press) { ctx.fillStyle = 'rgba(' + col + ',0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.fill(); }
      // o anel do crítico não tem texto: "CRÍTICO!" só aparece quando o jogador acerta (popup em applyHit)
      if (q.mode === 'guarda') FF.HUD.text(ctx, 'GUARDA', p.x, p.y - 38 - 90 * k * 0.3, 14, '#fff', 'center');
      ctx.restore();
    }
  }
};
