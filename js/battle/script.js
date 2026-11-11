// Interpretador de roteiros de golpes. Cada golpe no JSON do personagem tem um
// "roteiro": lista de passos (animação, avançar, voltar, transformar, buff...).
// Passos de animação podem ter "eventos" presos a quadros (som, voz, acerto, projétil...).
window.FF = window.FF || {};

FF.Script = {
  LEAD: 0.55,   // antecedência mínima (s) do anel de tempo antes de um acerto

  async run(b, actor, target, move, roteiro) {
    for (const step of (roteiro || move.roteiro || [])) {
      if (b.over && !step.final) break;
      await this.step(b, actor, target, move, step);
    }
  },

  async step(b, actor, target, move, s) {
    // Sparking Combo: "quem" faz um parceiro executar um sub-roteiro em paralelo (ex.: Piccolo junto com o Goku)
    if (s.quem) {
      const outro = b.all.find(f => f.id === s.quem && !f.ko);
      if (!outro) return;
      const sub = (async () => {
        outro.busy = true;
        await this.run(b, outro, target, move, s.paralelo || []);
        outro.busy = false;
        outro.idle();
      })();
      b.paralelos.push(sub);
      if (s.esperarFim) await sub;
      return;
    }
    if (s.mensagem) b.banner(s.mensagem, s.mensagemDur || 1.3);
    if (s.som && !s.anim) FF.Audio.play(s.som);
    if (s.voz && !s.anim) FF.Audio.voice(this.pick(s.voz));
    if (s.vozTipo) actor.voz(s.vozTipo);

    if (s.anim) return this.playAnim(b, actor, target, move, s);

    if (s.irAte) {
      const alvo = s.irAte === 'alvo' ? target : actor;
      const dest = alvo.x - actor.dir * (s.dist || 22) * actor.scale;
      if (s.som) FF.Audio.play(s.som);
      actor.play(s.animMov || 'avancar', { loop: true });
      await b.tween(actor, dest, s.tempo || 0.22);
      return;
    }

    if (s.voltar) {
      if (s.som) FF.Audio.play(s.som);
      const name = actor.animName(s.animMov || 'teleporte');
      const a = actor.sprite.anim(name);
      const meio = a ? Math.floor(a.frames.length / 2) : 0;
      if (!a) { await b.tween(actor, actor.homeX, 0.25); return; }
      await actor.anim.play(name, { onFrame: (i) => { if (i === meio) actor.x = actor.homeX; } });
      actor.x = actor.homeX;
      return;
    }

    if (s.esperar) return FF.Clock.wait(s.esperar);

    if (s.autoNocaute) {   // ex.: autodestruição do Saibaman — some numa explosão
      b.spawnFx('Explosao11', actor.x, actor.y - 20 * actor.scale, false, 1, {});
      FF.Audio.play(s.som || 'nappa_saibaplant_expl', 1);
      b.flash(0.4); b.shake(8);
      actor.hp = 0; actor.ko = true; actor.alpha = 0;
      return FF.Clock.wait(0.6);
    }

    if (s.transformar) {
      actor.setForm(s.transformar);
      actor.transformouAgora = true;
      b.flash(0.6);
      if (s.anuncio !== false) b.banner(actor.nome, 1.2);
      return;
    }

    if (s.aplicar) {
      const def = (actor.def.buffs || {})[s.aplicar];
      if (def) actor.buffs[s.aplicar] = Object.assign({ id: s.aplicar }, def, { turnos: def.turnos });
      return;
    }

    if (s.removerBuff) { delete actor.buffs[s.removerBuff]; return; }
    if (s.ki) { actor.addKi(s.ki); b.popup(actor, (s.ki > 0 ? '+' : '') + s.ki + ' KI', '#7fd0ff'); return; }
    if (s.atordoar) {   // o alvo perde as próximas N vezes (não acumula)
      if (target && !target.ko) { target.atordoado = Math.max(target.atordoado || 0, s.atordoar); b.popup(target, 'ATORDOADO!', '#fff27a'); }
      return;
    }
    if (s.tremer) { b.shake(s.tremer); return; }
    if (s.flash) { b.flash(s.flash); return; }
    if (s.parado) { actor.idle(); return; }
    if (s.objeto) { b.criarObjeto(actor, s.objeto); return; }
    if (s.curar) {   // { fracao, todos }: recupera vida do próprio lutador ou de todo o time
      const time = s.curar.todos ? (actor.isHero ? b.heroes : b.enemies) : [actor];
      time.filter(f => !f.ko).forEach(f => {
        const v = Math.round(f.hpMax * (s.curar.fracao || 0.3));
        f.hp = Math.min(f.hpMax, f.hp + v);
        b.popup(f, '+' + v, '#7dff8a');
      });
      return;
    }
    if (s.lancarObjeto) { b.lancarObjeto(actor, target, move, s.lancarObjeto); return; }
  },

  pick(v) { return Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v; },

  resolveFrame(anim, q) {
    const n = anim.frames.length;
    if (q === 'fim') return n - 1;
    if (q === 'pico') {
      const i = anim.frames.findIndex(f => f[8] && f[8].length);
      if (i >= 0) return i;
      let best = 0, bw = -1;
      anim.frames.forEach((f, k) => { const reach = f[3] - f[5]; if (reach > bw) { bw = reach; best = k; } });
      return best;
    }
    if (typeof q === 'number') return q < 0 ? n + q : Math.min(q, n - 1);
    return 0;
  },

  async playAnim(b, actor, target, move, s) {
    const name = actor.animName(s.anim);
    const anim = actor.sprite.anim(name);
    if (!anim) { console.warn('[FF] animação inexistente em', actor.formId, name); return; }

    const evs = (s.eventos || []).map(e => Object.assign({}, e, { _i: this.resolveFrame(anim, e.quadro != null ? e.quadro : 0) }));
    const fired = new Set();
    let qte = null;
    const mode = b.qteMode(actor, target);
    const loop = !!s.duracao || !!s.loop;

    const onFrame = (i) => {
      evs.forEach((e, k) => {
        if (e._i !== i) return;
        if (fired.has(k) && !e.repetir) return;
        fired.add(k);
        this.fireEvent(b, actor, target, move, e, qte);
      });
    };

    const ended = actor.anim.play(name, { fps: s.fps, loop, onFrame });

    // Anel de tempo: segura o 1º quadro se o primeiro acerto vier rápido demais.
    const hits = evs.filter(e => e.acerto);
    if (mode && hits.length && target && !target.ko) {
      const first = Math.min(...hits.map(e => e._i));
      const tFirst = actor.anim.timeToFrame(first);
      actor.anim.hold = Math.max(0, this.LEAD - tFirst);
      qte = b.addQte(mode, target, actor.anim.hold + tFirst);
    }

    if (s.duracao) await FF.Clock.wait(s.duracao);
    else await ended;
  },

  fireEvent(b, actor, target, move, e, qte) {
    if (e.som) FF.Audio.play(this.pick(e.som));
    if (e.voz) FF.Audio.voice(this.pick(e.voz));
    if (e.vozTipo) actor.voz(e.vozTipo);
    if (e.tremer) b.shake(e.tremer);
    if (e.flash) b.flash(e.flash);
    if (e.efeito) {
      const p = e.efeito.em === 'alvo' && target ? target.peito() : e.efeito.em === 'disparo' ? actor.pontoDisparo() : { x: actor.x, y: actor.groundY };
      b.spawnFx(e.efeito.fx, p.x + (e.efeito.dx || 0) * actor.dir, p.y + (e.efeito.dy || 0), actor.dir < 0, e.efeito.escala, e.efeito);
    }
    if (e.ki) actor.addKi(e.ki);
    if (e.acerto && target) b.applyHit(actor, target, move, e.acerto, qte);
    if (e.projetil && target) b.spawnProjectile(actor, target, move, e.projetil);
    if (e.objeto) b.criarObjeto(actor, e.objeto);
    if (e.lancarObjeto && target) b.lancarObjeto(actor, target, move, e.lancarObjeto);
  },
};
