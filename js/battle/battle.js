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
    // perspectiva diagonal (Opções → Perspectiva): lutadores em fileiras de profundidade, como no Attack of the Saiyans
    this.persp = def.perspectiva !== false && !def.semPerspectiva;   // diagonal é o padrão do jogo (o palco do Estúdio escolhe)
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
    // pergaminhos de técnica: golpes de nível II/III (cópia dos golpes, o personagem carregado não muda)
    if (lado === 'heroi' && FF.Treino && FF.Treino.aplicarTec) charDef = Object.assign({}, charDef, { golpes: FF.Treino.aplicarTec(charDef.id, charDef.golpes) });
    // posições do JSON são para a tela base de 1084 px; em telas mais largas, centraliza
    const offX = (FF.W - 1084) / 2;
    // cápsula Peso de Treino: −10% de velocidade (e +30% de AP no fim)
    const caps = lado === 'heroi' && FF.Capsulas ? FF.Capsulas.equipadas(charDef.id) : [];
    if (caps.includes('peso')) charDef = Object.assign({}, charDef, { atributos: Object.assign({}, charDef.atributos, { velocidade: Math.round((charDef.atributos.velocidade || 10) * 0.9) }) });
    const f = new FF.Fighter(charDef, lado, (pos[idx] != null ? pos[idx] : pos[0]) + offX, this.groundY, this.scale);
    const lista = lado === 'heroi' ? this.heroes : this.enemies;
    const iguais = lista.filter(x => x.id === f.id);
    if (iguais.length) {   // vários do mesmo (ex.: Saibamen): A, B, C...
      if (iguais.length === 1) iguais[0].sufixo = ' A';
      f.sufixo = ' ' + String.fromCharCode(65 + iguais.length);
    }
    // Pontos de Impulso: todo mundo começa com 1 (ganha 1 por turno, até 5)
    f.impulso = 1; f.boost = 0;
    // cápsulas equipadas no Treinamento (só heróis)
    f.capsulas = caps;
    if (f.capsulas.includes('kiplus')) f.ki = Math.min(f.kiMax, f.ki + 30);
    if (f.capsulas.includes('faixa')) f.impulso = 2;
    // escudos (Quebra de Guarda): só no time inimigo; fraquezas = tipos de golpe ("corpo", "energia")
    if (lado === 'inimigo') {
      const e = charDef.escudos || { n: 3, fraquezas: ['corpo'] };
      f.escudosMax = Math.max(1, e.n || 3); f.escudos = f.escudosMax;
      f.fraquezas = (e.fraquezas || ['corpo']).slice(); f.fraqVistas = new Set();
    }
    lista.push(f);
    return f;
  }

  // efeito do golpe na ordem da próxima rodada (linha do tempo, como no FFX): "velocidade" no golpe (número) ou padrão
  static velGolpe(m) {
    if (!m) return 0;
    if (typeof m.velocidade === 'number') return m.velocidade;
    if (m.velocidade === 'rapido') return 25;
    if (m.velocidade === 'lento') return -25;
    if (m.supremo) return -40;
    if (m.tipo === 'transformacao' || /"transformar"/.test(JSON.stringify(m.roteiro || []))) return -25;
    if (/carregar/i.test(m.nome || '')) return -15;
    if (m.tipo === 'corpo') return 10;
    return 0;
  }

  // ícone da intenção do inimigo: 💥 supremo · ⚡ carregar ki · 👊 corpo a corpo · 🔥 energia · ✨ suporte/forma
  static iconeIntencao(m) {
    if (m.supremo) return '💥';
    if (/carregar/i.test(m.nome || '')) return '⚡';
    const t = FF.Battle.tipoGolpe(m);
    return t === 'corpo' ? '👊' : t === 'energia' ? '🔥' : '✨';
  }

  // tipo de golpe para as fraquezas: "corpo" | "energia" | null (suporte)
  static tipoGolpe(m) {
    if (!m) return null;
    if (m.tipo === 'corpo' || m.tipo === 'energia') return m.tipo;
    if (m.tipo === 'suporte' || m.tipo === 'transformacao') return null;
    const j = JSON.stringify(m.roteiro || []);
    if (/"irAte"|"tipo":"mover"/.test(j)) return 'corpo';
    if (/"projetil"|"acerto"/.test(j)) return 'energia';
    return null;
  }

  // perdeu a vez: atordoado (Taiyoken) ou guarda quebrada; ao fim da quebra os escudos voltam
  async perderVez(actor) {
    actor.atordoado--;
    if (this.jaAgiu) this.jaAgiu.add(actor);
    if (actor.quebrado) {
      this.popup(actor, 'QUEBRADO!', '#ff9a6a');
      this.banner(actor.nome + ' está sem guarda!', 1.2);
      await FF.Clock.wait(1.2);
      if (actor.atordoado <= 0) { actor.quebrado = false; actor.escudos = actor.escudosMax; this.popup(actor, '🛡 ESCUDOS DE VOLTA', '#9fd8ff', -40); }
    } else {
      this.popup(actor, 'ATORDOADO!', '#fff27a');
      this.banner(actor.nome + ' não consegue enxergar!', 1.2);
      await FF.Clock.wait(1.2);
    }
    await this.endTurn(actor);
  }

  // ---------- fluxo ----------
  async run() {
    if (this.persp) this.montarPerspectiva();
    // estatísticas para a nota do fim da luta
    this.stats = { danoRecebido: 0, guardasPerfeitas: 0, criticos: 0, quebras: 0, contra: 0, embates: 0, supremoFinal: false, ataqueZ: false, rodadas: 0 };
    // Radar do Dragão: revela as fraquezas de todos os inimigos
    if (this.heroes.some(h => (h.capsulas || []).includes('radar'))) this.enemies.forEach(e => e.fraquezas && e.fraquezas.forEach(t => e.fraqVistas.add(t)));
    FF.Audio.music(this.def.musica);
    await this.intro();
    while (!this.over) {
      // ordem de turno pela velocidade (empate: heróis primeiro)
      // iniciativa = velocidade + efeito do golpe da rodada anterior (rápido adianta, supremo atrasa); atordoado vai para o fim
      this.all.forEach(f => { f.iniciativa = f.iniciativaProx || 0; f.iniciativaProx = 0; });
      const ini = (f) => f.stat('velocidade') + (f.iniciativa || 0) - (f.atordoado > 0 ? 1000 : 0);
      const ordem = this.all.slice().sort((a, b) => (ini(b) - ini(a)) || ((b.isHero ? 1 : 0) - (a.isHero ? 1 : 0)));
      this.ordem = ordem;   // mostrada no HUD (linha do tempo)
      this.rodada = (this.rodada || 0) + 1;
      if (this.stats) this.stats.rodadas = this.rodada;
      this.jaAgiu = new Set();
      // Opções → Modo de turno "Planejamento": escolhe as ações de todos primeiro, depois tudo acontece
      // modo Planejamento é o padrão do jogo (o clássico fica só com def.turnoClassico)
      if (!this.def.turnoClassico) { await this.rodadaPlanejada(ordem); continue; }
      for (const f of ordem) {
        if (this.over || f.ko) continue;
        await this.turn(f, f.isHero);
      }
    }
  }

  // ---------- modo Planejamento (como em Attack of the Saiyans) ----------
  // 1) o jogador escolhe golpe e alvo de cada herói vivo (Esc / ↩ volta ao anterior); os inimigos decidem escondido
  // 2) as ações acontecem na ordem de velocidade; quem cai antes perde a vez; alvo caído → outro de pé;
  //    sem ki na hora → carrega ki
  async rodadaPlanejada(ordem) {
    const plano = new Map();
    const herois = ordem.filter(f => f.isHero && !f.ko && !(f.atordoado > 0));
    // inimigos decidem ANTES dos heróis e mostram a intenção (ícone e alvo sobre cada um)
    for (const e of ordem.filter(f => !f.isHero && !f.ko)) {
      if (e.atordoado > 0) { e.intencao = { icone: '💫', alvo: null }; continue; }
      const alvo = this.alvoInimigo(e);
      if (!alvo) continue;
      const sup = e.rageCheia && e.form.golpes.find(id => (e.def.golpes[id] || {}).supremo);
      const mid = sup || FF.AI.choose(e, alvo, this);
      // inimigo também usa Impulso: guarda pontos e solta num golpe de ataque
      const mv = e.def.golpes[mid] || {};
      const ofens = FF.Battle.ofensivo(mv);
      const imp = ofens && e.impulso >= 3 ? (e.impulso >= 5 ? 2 : 1) : 0;
      plano.set(e, { moveId: mid, alvo, impulso: imp });
      e.intencao = { icone: FF.Battle.iconeIntencao(mv) + (imp ? '×' + (imp + 1) : ''), alvo: ofens ? alvo : null };
    }
    this.planejando = true;
    for (let i = 0; i < herois.length;) {
      const h = herois[i];
      const foes = this.enemies.filter(f => !f.ko);
      if (!foes.length) break;
      this.turnLabel = 'Planejando ' + (i + 1) + '/' + herois.length + ': ' + h.nome;
      this.atual = h;
      // Ataque Z: todos os inimigos de pé quebrados → o time inteiro ataca junto (só antes de planejar alguém)
      const todosQuebrados = foes.every(f => f.quebrado);
      const moveId = await this.ui.chooseMove(h, this, { voltar: i > 0, plano: true, ataqueZ: todosQuebrados && i === 0 && herois.length > 0 });
      if (moveId === '__ataquez') {
        this.planejando = false; this.turnLabel = '';
        await this.ataqueZ(herois.filter(x => !x.ko));
        // os inimigos estavam quebrados: perdem a vez (e os escudos voltam)
        for (const f of ordem) {
          if (this.over || f.ko || f.isHero) continue;
          if (f.atordoado > 0) await this.perderVez(f);
          if (this.checkEnd()) return;
        }
        herois.forEach(x => { x.impulsoReservado = 0; x.planoIcone = null; });
        if (!this.over) for (const x of herois) if (!x.ko) await this.endTurn(x);
        return;
      }
      if (moveId === '__voltar') { i--; plano.delete(herois[i]); herois[i].impulsoReservado = 0; continue; }
      const mv = h.def.golpes[moveId];
      let alvo = foes[0];
      if (foes.length > 1 && FF.Battle.ofensivo(mv)) alvo = await this.ui.chooseTarget(foes, this);
      plano.set(h, { moveId, alvo, impulso: Math.min(h.impulsoPlan || 0, h.impulso) });
      h.planoIcone = (FF.UI && FF.UI.icone ? FF.UI.icone(mv) : '✔') + (h.impulsoPlan ? ' ×' + (h.impulsoPlan + 1) : '');
      h.impulsoReservado = h.impulsoPlan || 0;
      h.impulsoPlan = 0;
      i++;
    }
    this.planejando = false;
    // embate de raios: herói e inimigo planejaram golpes de energia um no outro
    // DESLIGADO a pedido do usuário (2026-11-15) — para religar: FF.EMBATE_RAIOS = true
    if (FF.EMBATE_RAIOS) for (const [h, ph] of plano) {
      if (!h.isHero || ph.embate) continue;
      const mh = h.def.golpes[ph.moveId], e = ph.alvo, pe = e && plano.get(e);
      if (!pe || pe.alvo !== h || pe.embate) continue;
      const me = e.def.golpes[pe.moveId];
      if (FF.Battle.tipoGolpe(mh) === 'energia' && FF.Battle.tipoGolpe(me) === 'energia' && !mh.supremo && !me.supremo && FF.Battle.ofensivo(mh) && FF.Battle.ofensivo(me)) {
        ph.embate = { heroi: h, inimigo: e, mh, me }; pe.embate = ph.embate;
      }
    }
    this.turnLabel = '';
    this.banner('AÇÃO!', 0.8);
    await FF.Clock.wait(0.6);
    for (const f of ordem) {
      if (this.over || f.ko) continue;
      await this.turnoPlanejado(f, plano.get(f));
      f.planoIcone = null; f.intencao = null;
      if (this.checkEnd()) return;
    }
    this.all.forEach(f => { f.planoIcone = null; f.intencao = null; });
  }

  alvoInimigo(actor) {
    const foes = (actor.isHero ? this.enemies : this.heroes).filter(f => !f.ko);
    if (foes.length < 2) return foes[0] || null;
    const pesos = foes.map(f => 1 + 2 * (1 - f.hp / f.hpMax));
    let x = Math.random() * pesos.reduce((a, b) => a + b, 0);
    return foes.find((f, i) => (x -= pesos[i]) <= 0) || foes[0];
  }

  async turnoPlanejado(actor, p) {
    if (actor.atordoado > 0) { await this.perderVez(actor); return; }
    // embate de raios: acontece na vez do primeiro dos dois; o outro perde a ação (já foi gasta no embate)
    if (p && p.embate) {
      const em = p.embate;
      if (em.feito) { await this.endTurn(actor); return; }
      em.feito = true;
      const { heroi, inimigo, mh, me } = em;
      if (!heroi.ko && !inimigo.ko && (mh.custoKi || 0) <= heroi.ki && (me.custoKi || 0) <= inimigo.ki) {
        this.atual = actor; this.turnLabel = 'Embate de raios!';
        await this.embateRaios(heroi, inimigo, mh, me);
        if (this.jaAgiu) { this.jaAgiu.add(heroi); this.jaAgiu.add(inimigo); }
        this.atual = null;
        if (this.checkEnd()) return;
        await this.endTurn(actor);
        return;
      }
      p.embate = null;   // não deu (sem ki ou alguém caiu): segue o golpe normal
    }
    if (!p) { await this.endTurn(actor); return; }
    const foes = (actor.isHero ? this.enemies : this.heroes).filter(f => !f.ko);
    if (!foes.length) return;
    let { moveId, alvo } = p;
    let mv = actor.def.golpes[moveId];
    // o que foi escolhido pode não valer mais (gastou ki, a forma mudou, parceiro caiu...)
    const ok = (m) => m && (actor.form.golpes || []).includes(moveId) && (m.custoKi || 0) <= actor.ki && !(m.supremo && !actor.rageCheia) &&
      !(m.requer && FF.UI && FF.UI.meets && !FF.UI.meets(actor, m.requer));
    if (!ok(mv)) {
      const carregar = (actor.form.golpes || []).find(id => /carregar/i.test(id) && actor.def.golpes[id]);
      if (carregar) { this.popup(actor, 'SEM KI!', '#7fd0ff'); moveId = carregar; mv = actor.def.golpes[carregar]; }
      else { moveId = actor.isHero ? (actor.form.golpes || []).find(id => ok(actor.def.golpes[id])) : FF.AI.choose(actor, foes[0], this); mv = actor.def.golpes[moveId]; }
      if (!mv) { await this.endTurn(actor); return; }
    }
    if (!alvo || alvo.ko) alvo = actor.isHero ? foes[0] : this.alvoInimigo(actor);
    this.turnLabel = 'Vez de ' + actor.nome;
    this.atual = actor;
    await FF.Clock.wait(actor.isHero ? 0.15 : 0.35);
    // Impulso: gasta os pontos escolhidos (não ganha ponto no fim deste turno)
    const imp = Math.min(p.impulso || 0, actor.impulso || 0);
    actor.impulsoReservado = 0;
    if (imp > 0) { actor.impulso -= imp; actor.boost = imp; actor._impulsou = true; }
    await this.execute(actor, alvo, mv);
    actor.boost = 0;
    actor.iniciativaProx = FF.Battle.velGolpe(mv);
    if (this.jaAgiu) this.jaAgiu.add(actor);
    this.atual = null;
    if (this.checkEnd()) return;
    await this.endTurn(actor);
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
    if (actor.atordoado > 0) { await this.perderVez(actor); return; }
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
    this.acaoAtual = { actor, target };
    if (move.supremo) await this.dramaSupremo(actor, move);
    this._escudoMarcado = new Set();   // escudos: cada golpe tira escudo uma vez por alvo
    this._contraFeito = false;
    const n = actor.boost || 0;
    if (move.anuncio !== false) this.banner(move.nome + (n ? '  ×' + (n + 1) : ''), move.supremo ? 2.0 : 1.2);
    if (n) {   // Impulso: explosão de ki antes do golpe (mais forte a cada nível)
      const p = actor.peito();
      this.spawnFx('genkidama_efeito', p.x, p.y, false, 1.6 + 0.5 * n);
      this.popup(actor, 'IMPULSO ×' + (n + 1) + '!', '#ffcf3a', -50);
      FF.Audio.play('carregamentodeki_start', 0.8);
      this.shake(2 + 2 * n);
      this.flash(0.12 * n);
      await FF.Clock.wait(0.35);
    }
    // desafio de botão do golpe (só heróis): apertar rápido / 3 anéis / segurar e soltar → multiplica o dano
    actor.desafioMult = 1;
    if (actor.isHero && move.desafio && target && target !== actor && !this.semDesafios) actor.desafioMult = await this.desafio(actor, move.desafio);
    await FF.Script.run(this, actor, target, move);
    await Promise.all(this.paralelos);
    this.paralelos = [];
    await Promise.all(this.projectiles.map(p => p.done));
    await Promise.all(this.cenasKO || []);   // espera a cena de KO de quem caiu terminar
    this.cenasKO = [];
    // falas dos chefes (metade da vida)
    for (const f of (this.falasPendentes || []).splice(0)) {
      if (f.ko) continue;
      this.fala = { quem: f, texto: f.def.falas.metade, t0: FF.Clock.t, dur: 2.6 };
      if (f.voz) f.voz('dano');
      await FF.Clock.wait(2.6);
      this.fala = null;
    }
    await FF.Clock.wait(0.25);
    actor.busy = false;
    actor.desafioMult = 1;
    actor.idle();
    await this.resetPositions();
  }

  // ---------- desafios de botão (como no Super Mario RPG / Paper Mario) ----------
  // "apertar": aperte rápido para encher a barra (1,6 s) · "aneis": 3 anéis seguidos, aperte quando cada um fechar
  // "segurar": segure o botão, a barra sobe e desce; solte na faixa verde. Botão = Espaço/Z/J/Enter, clique ou toque.
  // Devolve o multiplicador de dano (0,85 a 1,45).
  desafio(actor, tipo) {
    return new Promise(res => {
      const d = { tipo, actor, t0: FF.Clock.t, valor: 0, acertos: 0, anel: 0, segurando: false, fim: null, txt: '' };
      this.desafioAtual = d;
      const tela = document.getElementById('tela') || window;
      const apertou = () => {
        if (d.fim) return;
        const t = FF.Clock.t - d.t0;
        if (tipo === 'apertar') { d.valor = Math.min(1, d.valor + 0.085); FF.Audio.play('tap_sound', 0.35); }
        else if (tipo === 'aneis') {
          const alvoT = 0.55 + d.anel * 0.55, dif = Math.abs(t - alvoT);
          if (dif <= 0.13 && !d['ok' + d.anel]) { d['ok' + d.anel] = true; d.acertos++; this.popup(actor, 'BOA!', '#ffd84a', -60); FF.Audio.play('hit_small-a', 0.6); }
        } else if (tipo === 'segurar' && !d.segurando) { d.segurando = true; d.tSeg = FF.Clock.t; FF.Audio.play('carregamentodeki_start', 0.5); }
      };
      const soltou = () => {
        if (d.fim || tipo !== 'segurar' || !d.segurando) return;
        terminar();
      };
      const kd = (e) => { if (e.repeat) return; if (['Space', 'KeyZ', 'KeyJ', 'Enter'].includes(e.code)) { e.preventDefault(); apertou(); } };
      const ku = (e) => { if (['Space', 'KeyZ', 'KeyJ', 'Enter'].includes(e.code)) soltou(); };
      const pd = (e) => { e.preventDefault(); apertou(); };
      const pu = () => soltou();
      window.addEventListener('keydown', kd, true); window.addEventListener('keyup', ku, true);
      tela.addEventListener('pointerdown', pd); window.addEventListener('pointerup', pu);
      const terminar = () => {
        if (d.fim) return;
        let m;
        if (tipo === 'apertar') m = 0.85 + 0.6 * d.valor;
        else if (tipo === 'aneis') m = 0.85 + 0.2 * d.acertos;
        else {
          const v = d.segurando ? this.valorSegurar(d) : 0;
          m = v >= 0.74 && v <= 0.92 ? 1.45 : v >= 0.6 && v <= 0.97 ? 1.15 : 0.85;
        }
        d.fim = FF.Clock.t; d.mult = m;
        d.txt = m >= 1.4 ? 'PERFEITO!' : m >= 1.1 ? 'BOM!' : 'FRACO...';
        this.popup(actor, d.txt + ' ×' + m.toFixed(2).replace('.', ','), m >= 1.4 ? '#ffd84a' : m >= 1.1 ? '#a0e0ff' : '#bbbbbb', -70);
        if (m >= 1.4) { this.flash(0.2); FF.Audio.play('decide_charasel', 0.6); }
        window.removeEventListener('keydown', kd, true); window.removeEventListener('keyup', ku, true);
        tela.removeEventListener('pointerdown', pd); window.removeEventListener('pointerup', pu);
        FF.Clock.wait(0.45).then(() => { this.desafioAtual = null; res(m); });
      };
      d.terminar = terminar;
      // fim por tempo (vigiado a cada quadro em atualizarDesafio)
      d.limite = tipo === 'apertar' ? 1.6 : tipo === 'aneis' ? 0.55 + 2 * 0.55 + 0.25 : 3.0;
    });
  }
  valorSegurar(d) { const t = FF.Clock.t - d.tSeg; return 1 - Math.abs(((t * 0.9) % 2) - 1); }   // sobe e desce (0 → 1 → 0)
  atualizarDesafio() {
    const d = this.desafioAtual;
    if (!d || d.fim) return;
    const t = FF.Clock.t - d.t0;
    if (d.tipo === 'apertar') d.valor = Math.max(0, d.valor - 0.0035);
    if (d.tipo === 'aneis') d.anel = Math.min(2, Math.floor(Math.max(0, t - 0.28) / 0.55));
    if (t >= d.limite) d.terminar();
  }
  desenharDesafio(ctx) {
    const d = this.desafioAtual;
    if (!d) return;
    const a = d.actor, p = a.peito(), t = FF.Clock.t - d.t0;
    const H = FF.HUD;
    ctx.save();
    if (d.tipo === 'apertar' || d.tipo === 'segurar') {
      const w = 170, h = 16, x = p.x - w / 2, y = p.y - 95;
      ctx.fillStyle = 'rgba(8,10,28,0.85)'; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
      if (d.tipo === 'segurar') { ctx.fillStyle = 'rgba(80,255,120,0.45)'; ctx.fillRect(x + w * 0.74, y, w * 0.18, h); }
      const v = d.tipo === 'apertar' ? d.valor : (d.segurando && !d.fim ? this.valorSegurar(d) : 0);
      const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#ffd84a'); g.addColorStop(1, '#ff6a00');
      ctx.fillStyle = g; ctx.fillRect(x, y, w * v, h);
      ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      if (!d.fim) H.text(ctx, d.tipo === 'apertar' ? 'APERTE RÁPIDO!' : (d.segurando ? 'SOLTE NO VERDE!' : 'SEGURE O BOTÃO!'), p.x, y - 14, 16, '#fff27a', 'center');
    } else if (d.tipo === 'aneis') {
      for (let i = 0; i < 3; i++) {
        const alvoT = 0.55 + i * 0.55, k = (alvoT - t) / 0.55;
        const cx = p.x - 40 + i * 40, cy = p.y - 85;
        ctx.lineWidth = 3; ctx.strokeStyle = d['ok' + i] ? '#7dff9a' : '#ffd84a';
        ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.stroke();
        if (!d['ok' + i] && k > -0.25 && k < 1) { ctx.globalAlpha = 0.9; ctx.strokeStyle = Math.abs(t - alvoT) <= 0.13 ? '#fff' : '#ffb24a'; ctx.beginPath(); ctx.arc(cx, cy, 13 + Math.max(0, k) * 30, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
        if (d['ok' + i]) H.text(ctx, '✓', cx, cy, 14, '#7dff9a', 'center');
      }
      if (!d.fim) H.text(ctx, 'APERTE QUANDO CADA ANEL FECHAR!', p.x, p.y - 118, 14, '#fff27a', 'center');
    }
    ctx.restore();
  }

  async endTurn(f) {
    f.addKi(f.def.atributos.kiPorTurno || 0);
    // cápsula Semente dos Deuses: uma vez por luta, com menos de 30% de vida recupera tudo
    if (!f.ko && (f.capsulas || []).includes('senzu') && !f._usouSenzu && f.hp < f.hpMax * 0.3) {
      f._usouSenzu = true; f.hp = f.hpMax; f.addKi(50);
      this.popup(f, '🌱 SEMENTE DOS DEUSES!', '#7dff9a', -60);
      this.spawnFx('genkidama_efeito', f.peito().x, f.peito().y, false, 2);
      FF.Audio.play('decide_charasel', 0.7);
      await FF.Clock.wait(0.8);
    }
    if (!f._impulsou && !f.ko) f.impulso = Math.min(5, (f.impulso || 0) + 1);
    f._impulsou = false;
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
    if (att.boost) dmg *= 1 + 0.4 * att.boost;   // Impulso: +40% por nível
    if (att.desafioMult) dmg *= att.desafioMult;   // desafio de botão do golpe
    let guard = false;
    // escudos: o golpe da fraqueza tira escudo (1 por golpe, +1 por nível de Impulso, +1 no supremo); zerou = QUEBRA
    if (def.escudosMax && att.lado !== def.lado && !def.ko) {
      const tipo = FF.Battle.tipoGolpe(move);
      if (tipo && def.fraquezas.includes(tipo)) {
        dmg *= 1.15;
        if (!this._escudoMarcado || !this._escudoMarcado.has(def)) {
          if (this._escudoMarcado) this._escudoMarcado.add(def);
          def.fraqVistas.add(tipo);
          if (!def.quebrado) {
            const tira = 1 + (att.boost || 0) + (move.supremo ? 1 : 0);
            def.escudos = Math.max(0, def.escudos - tira);
            this.popup(def, '🛡 -' + tira, '#9fd8ff', -62);
            if (def.escudos <= 0) this.quebrar(def);
          }
        }
      }
    }
    if (def.quebrado) dmg *= 1.6;   // sem guarda: leva bem mais dano
    if ((def.capsulas || []).includes('armadura')) dmg *= 0.9;   // cápsula Armadura Saiyajin

    if (mode === 'guarda' && res) {
      guard = true;
      dmg *= res === 'perfeito' ? 0 : 0.4;
      // guarda perfeita contra golpe de corpo a corpo: contra-ataque (uma vez por golpe)
      if (res === 'perfeito' && !this._contraFeito && FF.Battle.tipoGolpe(move) === 'corpo' && !att.ko) { this._contraFeito = true; this.paralelos.push(this.contraAtaque(def, att)); }
      if (!qte._shown) { this.popup(def, res === 'perfeito' ? 'GUARDA PERFEITA!' : 'GUARDA!', res === 'perfeito' ? '#7dffb0' : '#a0e0ff', -46); qte._shown = true; }
      if (res === 'perfeito') def.addKi(3);
    }
    if (mode === 'critico' && res) {
      dmg *= res === 'perfeito' ? 1.8 : 1.4;
      if (!qte._shown) { this.popup(def, res === 'perfeito' ? 'CRÍTICO!!' : 'CRÍTICO!', '#ffd84a', -46); qte._shown = true; }
    }

    dmg = guard && res === 'perfeito' ? 0 : Math.max(1, Math.round(dmg));
    const hpAntes = def.hp;
    def.hp = Math.max(0, def.hp - dmg);
    const st = this.stats;
    if (st) {
      if (def.isHero) st.danoRecebido += dmg;
      if (guard && res === 'perfeito' && !qte._contou) { st.guardasPerfeitas++; qte._contou = true; }
      if (mode === 'critico' && res && !qte._contouC) { st.criticos++; qte._contouC = true; }
      if (def.hp <= 0 && !def.isHero && move.supremo) st.supremoFinal = true;
    }
    // fala do chefe quando a vida passa da metade (mostrada no fim do golpe)
    if (!def.isHero && def.def.falas && def.def.falas.metade && !def._falouMetade && hpAntes > def.hpMax / 2 && def.hp <= def.hpMax / 2 && def.hp > 0) { def._falouMetade = true; (this.falasPendentes = this.falasPendentes || []).push(def); }
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
      if (def.hp <= 0) { def.ko = true; FF.Clock.hitstop(0.35); (this.cenasKO = this.cenasKO || []).push(FF.KO.tocar(this, att, def, move)); }
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
        (this.cenasKO = this.cenasKO || []).push(FF.KO.tocar(this, att, def, move));
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

  // ATAQUE Z (como o "All-Out Attack" de Persona): cada herói avança e golpeia, todos voltam, explosão final
  // acerta todos os inimigos de pé (que estão quebrados = +60% de dano)
  async ataqueZ(herois) {
    if (this.stats) this.stats.ataqueZ = true;
    const foes = () => this.enemies.filter(f => !f.ko);
    this.banner('ATAQUE Z!', 1.4);
    this.flash(0.6); this.shake(8);
    FF.Audio.play('sprkngbrst_expl', 0.8);
    herois.forEach(h => h.voz && h.voz('ataque'));
    await FF.Clock.wait(0.6);
    const anims = ['Attack_Light_1', 'Attack_Light_2', 'Attack_Light_3', 'Attack_Medium', 'Attack_Heavy'];
    for (let r = 0; r < 2; r++) {
      for (const h of herois) {
        const alvos = foes(); if (!alvos.length || h.ko) break;
        const alvo = alvos[Math.floor(Math.random() * alvos.length)];
        h.busy = true;
        h.x = alvo.x - h.dir * 40 * h.scale;   // aparece colado (teletransporte rápido)
        this.spawnFx('poeira', h.x, h.groundY, h.dir < 0, 0.8);
        const a = anims.filter(n => h.sprite.has(n));
        if (a.length) h.anim.play(a[(r * 2 + herois.indexOf(h)) % a.length]);
        await FF.Clock.wait(0.12);
        const p = alvo.peito();
        this.spawnFx(r ? 'hit_grande' : 'hit3', p.x, p.y, h.dir < 0, r ? 0.5 : 1);
        FF.Audio.play(['hit_small-a', 'hit_midle-a', 'hit_large-a'][r + (Math.random() < 0.5 ? 0 : 1)]);
        alvo.reagir('dano', 0.2);
        this.shake(4);
        await FF.Clock.wait(0.16);
      }
    }
    // todos de volta e a explosão final
    herois.forEach(h => { h.x = h.homeX; h.idle(); });
    await FF.Clock.wait(0.3);
    const al = foes();
    if (al.length) {
      const cx = al.reduce((s, f) => s + f.x, 0) / al.length, cy = al.reduce((s, f) => s + f.peito().y, 0) / al.length;
      this.spawnFx('Explosao15', cx, cy, false, 1.1);
      this.flash(0.7); this.shake(14);
      FF.Audio.play('goku_s_gnkdm_expl', 0.9);
      await FF.Clock.wait(0.25);
      this.cenasKO = [];
      for (const f of al) for (const h of herois) if (!h.ko && !f.ko) this.applyHit(h, f, { nome: 'Ataque Z', tipo: 'suporte', poder: 1.3 }, { fracao: 1, forca: 'forte', lanca: h === herois[herois.length - 1] }, null);
      await Promise.all(this.cenasKO || []); this.cenasKO = [];
    }
    await FF.Clock.wait(0.6);
    herois.forEach(h => { h.busy = false; if (!h.ko) h.idle(); });
    await this.resetPositions();
    this.checkEnd();
  }

  // EMBATE DE RAIOS: os dois raios se chocam no meio; aperte rápido (Espaço/Z/J/Enter, clique/toque) para empurrar o
  // choque até o inimigo. Quem vence acerta o próprio golpe com +40%; quem perde não acerta nada.
  embateRaios(h, e, mh, me) {
    return new Promise(res => {
      h.addKi(-(mh.custoKi || 0)); e.addKi(-(me.custoKi || 0));
      h.busy = e.busy = true;
      const pose = (f) => { const a = ['Special_Kamehameha_Chao_Frente', 'Special_GalickGun_Final', 'Special_Final', 'Special'].find(n => f.sprite.has(n)); if (a) f.anim.play(a, { hold: 99 }); };
      pose(h); pose(e);
      this.banner('EMBATE DE RAIOS!', 1.2);
      FF.Audio.play('kamehameha_charge', 0.8);
      const forca = (f) => f.stat('ataque') * ((f === h ? mh : me).poder || 1);
      const ritmoInimigo = 0.55 * forca(e) / Math.max(1, forca(h));   // quanto o inimigo empurra por segundo
      const em = { h, e, k: 0, t0: FF.Clock.t, dur: 3.2, fim: false };
      this.embateAtual = em;
      const tela = document.getElementById('tela') || window;
      const apertou = () => { if (em.fim) return; em.k = Math.min(1, em.k + 0.075); FF.Audio.play('tap_sound', 0.3); this.shake(2); };
      const kd = (ev) => { if (ev.repeat) return; if (['Space', 'KeyZ', 'KeyJ', 'Enter'].includes(ev.code)) { ev.preventDefault(); apertou(); } };
      const pd = (ev) => { ev.preventDefault(); apertou(); };
      window.addEventListener('keydown', kd, true); tela.addEventListener('pointerdown', pd);
      em.tick = (dt) => {
        if (em.fim) return;
        em.k = Math.max(-1, em.k - ritmoInimigo * dt);
        const t = FF.Clock.t - em.t0;
        if (em.k >= 1 || em.k <= -1 || t >= em.dur) acabar(em.k > 0);
      };
      const acabar = async (heroiVenceu) => {
        em.fim = true; em.venceu = heroiVenceu;
        if (heroiVenceu && this.stats) this.stats.embates++;
        window.removeEventListener('keydown', kd, true); tela.removeEventListener('pointerdown', pd);
        const [v, p, mv] = heroiVenceu ? [h, e, mh] : [e, h, me];
        this.banner((v.nome || '') + ' venceu o embate!', 1.2);
        this.flash(0.6); this.shake(14);
        const pp = p.peito();
        this.spawnFx('Explosao15', pp.x, pp.y, false, 0.8);
        FF.Audio.play('goku_s_gnkdm_expl', 0.8);
        await FF.Clock.wait(0.15);
        this.cenasKO = [];
        this.applyHit(v, p, Object.assign({}, mv, { poder: (mv.poder || 1) * 1.4 }), { fracao: 1, forca: 'energia', lanca: true, empurrao: 600 }, null);
        await Promise.all(this.cenasKO || []); this.cenasKO = [];
        await FF.Clock.wait(0.8);
        this.embateAtual = null;
        h.busy = e.busy = false;
        if (!h.ko) h.idle(); if (!e.ko) e.idle();
        await this.resetPositions();
        res();
      };
    });
  }
  desenharEmbate(ctx) {
    const em = this.embateAtual;
    if (!em) return;
    const a = em.h.pontoDisparo ? em.h.pontoDisparo() : em.h.peito(), b = em.e.pontoDisparo ? em.e.pontoDisparo() : em.e.peito();
    const u = 0.5 + 0.45 * em.k, cx = a.x + (b.x - a.x) * u, cy = a.y + (b.y - a.y) * u, t = FF.Clock.t;
    const raio = (p0, cor1, cor2) => {
      const larg = 16 + 3 * Math.sin(t * 30);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.strokeStyle = cor1; ctx.lineWidth = larg; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.strokeStyle = cor2; ctx.lineWidth = larg * 0.45; ctx.stroke();
      ctx.restore();
    };
    raio(a, 'rgba(60,170,255,0.8)', 'rgba(230,250,255,0.95)');
    raio(b, 'rgba(255,120,40,0.8)', 'rgba(255,240,200,0.95)');
    // choque no meio
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const r = 26 + 8 * Math.sin(t * 25);
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 1.8);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,230,120,0.9)'); g.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (!em.fim) {
      const w = 220, x = FF.W / 2 - w / 2, y = FF.H - 130;
      ctx.fillStyle = 'rgba(8,10,28,0.85)'; ctx.fillRect(x - 4, y - 4, w + 8, 22);
      ctx.fillStyle = '#ff7a2a'; ctx.fillRect(x, y, w, 14);
      ctx.fillStyle = '#3fb0ff'; ctx.fillRect(x, y, w * (0.5 + 0.5 * em.k), 14);
      ctx.fillStyle = '#fff'; ctx.fillRect(x + w / 2 - 1, y - 2, 2, 18);
      FF.HUD.text(ctx, 'APERTE RÁPIDO!', FF.W / 2, y - 16, 20, '#fff27a', 'center');
    }
  }

  // CÂMERA DRAMÁTICA DO SUPREMO: tela escurece (só quem solta fica aceso), zoom nele, nome do golpe enorme
  async dramaSupremo(actor, move) {
    this.drama = { actor, nome: (move.nome || '').toUpperCase(), t0: FF.Clock.t, dur: 1.5 };
    const pa = actor.peito();
    this.cam = this.cam || { zoom: 1, x: 0, y: 0 };
    this.camAlvo = { zoom: 1.35, x: pa.x - FF.W / 2, y: pa.y - FF.H / 2, d: 0.3, t: 0, de: Object.assign({}, this.cam) };
    FF.Audio.play('sprkngbrst_expl', 0.6);
    await FF.Clock.wait(1.5);
    this.camAlvo = { zoom: 1, x: 0, y: 0, d: 0.3, t: 0, de: Object.assign({}, this.cam) };
    this.drama = null;
    await FF.Clock.wait(0.2);
  }
  desenharDrama(ctx) {
    const d = this.drama;
    if (!d) return;
    const k = Math.min(1, (FF.Clock.t - d.t0) / 0.2), t = FF.Clock.t;
    ctx.save();
    // linhas de velocidade saindo do centro
    ctx.globalAlpha = 0.5 * k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const a = i * 0.2417 * Math.PI * 2 + t * 0.6, r0 = 260 + ((i * 37 + t * 900) % 120);
      ctx.beginPath(); ctx.moveTo(FF.W / 2 + Math.cos(a) * r0, FF.H / 2 + Math.sin(a) * r0); ctx.lineTo(FF.W / 2 + Math.cos(a) * 900, FF.H / 2 + Math.sin(a) * 900); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // faixa com o nome
    const y = FF.H * 0.72;
    ctx.fillStyle = 'rgba(0,0,0,' + 0.65 * k + ')'; ctx.fillRect(0, y - 40, FF.W, 80);
    ctx.fillStyle = 'rgba(255,180,0,' + 0.9 * k + ')'; ctx.fillRect(0, y - 42, FF.W, 3); ctx.fillRect(0, y + 39, FF.W, 3);
    const g = ctx.createLinearGradient(0, y - 30, 0, y + 30); g.addColorStop(0, '#fffbb0'); g.addColorStop(0.5, '#ffd21a'); g.addColorStop(1, '#ff7a00');
    FF.HUD.textoHud ? FF.HUD.textoHud(ctx, d.nome, FF.W / 2 + (1 - k) * 200, y, 52, g, 'center') : FF.HUD.text(ctx, d.nome, FF.W / 2, y, 48, '#ffd84a', 'center');
    ctx.restore();
  }
  desenharFala(ctx) {
    const fl = this.fala;
    if (!fl) return;
    const w = Math.min(760, FF.W - 80), x = FF.W / 2 - w / 2, y = FF.H - 150, h = 74;
    ctx.save();
    ctx.fillStyle = 'rgba(14,10,40,0.92)'; ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 3;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, 12); else ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
    FF.Retrato.desenhar(ctx, fl.quem.def, fl.quem.formId, 'retrato', x + 10, y + 8, 42, 58, { espelhar: true });
    FF.HUD.text(ctx, fl.quem.nome, x + 64, y + 18, 16, '#ffd84a', 'left');
    // quebra o texto em até 2 linhas
    ctx.font = 'bold 15px sans-serif';
    const pal = fl.texto.split(' '), linhas = ['']; for (const p of pal) { const t = (linhas[linhas.length - 1] + ' ' + p).trim(); if (ctx.measureText(t).width > w - 80 && linhas[linhas.length - 1]) linhas.push(p); else linhas[linhas.length - 1] = t; }
    const n = Math.floor(((FF.Clock.t - fl.t0) / 0.025));   // efeito de máquina de escrever
    let resto = n;
    linhas.slice(0, 2).forEach((l, i) => { const parte = l.slice(0, Math.max(0, resto)); resto -= l.length; FF.HUD.text(ctx, parte, x + 64, y + 42 + i * 20, 15, '#fff', 'left'); });
    ctx.restore();
  }

  // QUEBRA DE GUARDA (escudos zerados): perde a próxima vez e leva +60% de dano até ela passar
  quebrar(def) {
    def.quebrado = true;
    if (this.stats) this.stats.quebras++;
    def.atordoado = Math.max(def.atordoado || 0, 1);
    const p = def.peito();
    this.spawnFx('Explosao14', p.x, p.y, false, 0.9);
    this.popup(def, 'QUEBRA!', '#ff6a3a', -80);
    this.banner('QUEBRA DE GUARDA!', 1.0);
    FF.Audio.play('guard_large'); FF.Audio.play('hit_large-a', 0.7);
    this.flash(0.35); this.shake(10);
  }

  // contra-ataque depois de uma guarda perfeita: quem defendeu golpeia de volta
  async contraAtaque(quem, alvo) {
    if (this.stats) this.stats.contra++;
    this.popup(quem, 'CONTRA-ATAQUE!', '#7dffb0', -70);
    await FF.Clock.wait(0.1);
    if (quem.ko || alvo.ko) return;
    const anim = ['Attack_Heavy', 'Attack_Medium', 'Attack_Light_3', 'Attack_Light_1'].find(a => quem.sprite.has(a));
    if (anim) quem.anim.play(anim);
    await FF.Clock.wait(0.12);
    if (!alvo.ko && !quem.ko) this.applyHit(quem, alvo, { nome: 'Contra-ataque', poder: 0.9 }, { fracao: 1, forca: 'media' }, null);
    await FF.Clock.wait(0.3);
    if (!quem.ko) quem.idle();
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
    const e = { a, set, x, y, flip, scale: (scale || 1) * this.scale * (set.def.escala || 1), alpha: opts && opts.alpha, ate: dur ? FF.Clock.t + dur : null, atras: !!(opts && opts.atras) };
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
      a, set, base: (spec.escala || 1) * this.scale * (set.def.escala || 1) * (1 + 0.18 * (att.boost || 0)) * (1 + 0.12 * ((move.nivelTec || 1) - 1)), scale: (spec.escala || 1) * this.scale * (set.def.escala || 1) * (1 + 0.18 * (att.boost || 0)) * (1 + 0.12 * ((move.nivelTec || 1) - 1)),
      x0: from.x, y0: from.y, x1: to.x, y1: to.y, x: from.x, y: from.y, t: 0, travel,
      vx: (to.x - from.x) / travel, vy: (to.y - from.y) / travel,
      flip: att.dir < 0, dir: att.dir, rastroOn: spec.rastro !== false, rastro: [],
      crescer: spec.crescer !== false, curva: spec.curva || 0, ondular: spec.ondular || 0,
      girar: spec.girar || 0, ang: 0, atravessar: !!spec.atravessar, acertou: false,
      atras: !!spec.atras, centro: !!spec.centro, ajX: (spec.spriteDx || 0) * att.dir, ajY: spec.spriteDy || 0, clipe: spec.id,
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
    // perspectiva: o projétil reto aponta para o alvo (fileiras em alturas diferentes)
    if (this.persp && !p.curva && !p.girar && !p.rot && Math.abs(to.x - from.x) > 20) p.ang = Math.atan2(to.y - from.y, Math.abs(to.x - from.x)) * p.dir;
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

  // ---------- perspectiva diagonal ----------
  // Cada lado vira uma diagonal de fileiras: quem está no fundo fica mais alto, menor, mais perto do meio e
  // um pouco apagado (névoa); na frente, mais baixo e maior. Sombras em elipse no chão, como no DS.
  // Quem ataca "anda em profundidade" até a fileira do alvo e volta para a sua no retorno.
  get PERSP() { return { horizonte: 292, fundo: 388, frente: 536 }; }
  profundidades(n) { return n === 1 ? [0.45] : n === 2 ? [0.2, 0.85] : [0.5, 1, 0]; }
  montarPerspectiva() {
    const offX = (FF.W - 1084) / 2;
    const lado = (lista, heroi) => {
      const ds = this.profundidades(lista.length);
      lista.forEach((f, i) => {
        const d = ds[i] != null ? ds[i] : 0.5;
        f.prof = d;
        f.latX = f.homeX; f.latG = f.groundY;   // posição na visão lateral (os golpes foram montados nela)
        f.homeX = Math.round(offX + (heroi ? 190 + 175 * d : 1084 - 190 - 175 * d));
        f.homeG = Math.round(this.PERSP.frente - (this.PERSP.frente - this.PERSP.fundo) * d);
        f.homeS = this.scale * (1.14 - 0.36 * d);
        f.x = f.homeX; f.groundY = f.homeG; f.y = f.homeG; f.scale = f.homeS;
        f.semSombra = true;
      });
    };
    lado(this.heroes, true);
    lado(this.enemies, false);
  }
  // a cada quadro: quem é do time de quem age e saiu de casa vai para a fileira do alvo (posição, tamanho)
  atualizarPerspectiva() {
    const at = this.acaoAtual;
    for (const f of this.all) {
      if (f.homeG == null) continue;
      let g = f.homeG, s = f.homeS;
      const t = at && at.target;
      if (t && t.homeG != null && at.actor && f.lado === at.actor.lado && f !== t) {
        const longe = Math.max(40, Math.abs(t.homeX - f.homeX) - 60);
        const k = Math.max(0, Math.min(1, Math.abs(f.x - f.homeX) / longe));
        const e = k * k * (3 - 2 * k);
        g = f.homeG + (t.homeG + 4 - f.homeG) * e;
        s = f.homeS + (f.homeS * (t.homeS / this.scale) / (f.homeS / this.scale) - f.homeS) * e;
      }
      const dy = g - f.groundY;
      if (Math.abs(dy) > 0.01) { f.groundY = g; f.y += dy; }
      f.scale = s;
    }
  }
  // escudos sobre cada inimigo: número + fraquezas (👊 corpo, 🔥 energia; "?" até descobrir acertando)
  desenharEscudos(ctx) {
    for (const f of this.enemies) {
      if (!f.escudosMax || f.ko || !(f.alpha > 0.1)) continue;
      const fr = f.anim.frame(), alto = fr ? fr[6] * f.scale * (f.escExtra || 1) : 60 * f.scale;
      const x = f.x + (f.offX || 0), y = f.y + (f.offY || 0) - alto - 16;
      ctx.save();
      const s = 12;
      ctx.beginPath();
      ctx.moveTo(x - 30, y - s); ctx.lineTo(x - 30 + s * 1.6, y - s); ctx.lineTo(x - 30 + s * 1.6, y + 1); ctx.quadraticCurveTo(x - 30 + s * 1.6, y + s * 0.8, x - 30 + s * 0.8, y + s * 1.15); ctx.quadraticCurveTo(x - 30, y + s * 0.8, x - 30, y + 1); ctx.closePath();
      const q = f.quebrado;
      ctx.fillStyle = q ? (Math.sin(FF.Clock.t * 14) > 0 ? '#c0281a' : '#7a1208') : '#1f5fd0';
      ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = q ? '#ffb08a' : '#cfe8ff'; ctx.stroke();
      if (q) { ctx.strokeStyle = '#2a0400'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 24, y - s + 2); ctx.lineTo(x - 21, y - 2); ctx.lineTo(x - 25, y + 3); ctx.lineTo(x - 22, y + s); ctx.stroke(); }
      FF.HUD.text(ctx, q ? '✕' : String(f.escudos), x - 30 + s * 0.8, y + 2, 14, '#fff', 'center');
      // intenção (Planejamento): o que vai fazer e em quem
      if (f.intencao) {
        const it = f.intencao, txt = it.icone + (it.alvo ? ' → ' + it.alvo.nome + (it.alvo.sufixo || '') : '');
        ctx.font = 'bold 13px sans-serif';
        const tw = ctx.measureText(txt).width + 14, iy = y - s - 16;
        ctx.fillStyle = 'rgba(10,8,24,0.82)'; ctx.strokeStyle = it.icone.startsWith('💥') ? '#ff7a3a' : '#ffcf3a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - tw / 2, iy - 10, tw, 20, 10); else ctx.rect(x - tw / 2, iy - 10, tw, 20); ctx.fill(); ctx.stroke();
        FF.HUD.text(ctx, txt, x, iy + 1, 13, '#fff', 'center');
      }
      // fraquezas
      f.fraquezas.forEach((t, i) => {
        const cx = x - 2 + i * 22, cy = y + 1;
        ctx.beginPath(); ctx.arc(cx, cy, 9.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10,12,24,0.8)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = t === 'corpo' ? '#ffb24a' : '#6fe0ff'; ctx.stroke();
        const vista = f.fraqVistas.has(t);
        ctx.font = (vista ? '11px' : 'bold 12px') + ' sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
        ctx.fillText(vista ? (t === 'corpo' ? '👊' : '🔥') : '?', cx, cy + 1);
      });
      ctx.restore();
    }
  }

  desenharSombras(ctx) {
    for (const f of this.all) {
      if (!(f.alpha > 0.05) || f.vaporizado) continue;
      const alto = Math.max(0, f.groundY - (f.y + (f.offY || 0)));
      const k = Math.max(0.35, 1 - alto / 160);
      const rx = 21 * f.scale * k, ry = 5.5 * f.scale * k;
      const x = f.x + (f.offX || 0), y = f.groundY + 1;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
      g.addColorStop(0, 'rgba(10,20,10,' + (0.55 * f.alpha * k).toFixed(3) + ')');
      g.addColorStop(0.7, 'rgba(10,20,10,' + (0.35 * f.alpha * k).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(10,20,10,0)');
      ctx.save();
      ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
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
    if (this.persp) this.atualizarPerspectiva();
    this.atualizarDesafio();
    if (this.embateAtual && this.embateAtual.tick) this.embateAtual.tick(dt);
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
      // a câmera não sai do cenário (com zoom perto da borda sobrava um pedaço da tela sem desenho = "fantasma")
      const z = cam.zoom, mx = Math.max(0, FF.W / 2 - FF.W / (2 * z)), my = Math.max(0, FF.H / 2 - FF.H / (2 * z));
      const cx = Math.max(-mx, Math.min(mx, cam.x)), cy = Math.max(-my, Math.min(my, cam.y));
      if (z < 1) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, FF.W, FF.H); }
      ctx.translate(FF.W / 2, FF.H / 2);
      ctx.scale(z, z);
      ctx.translate(-FF.W / 2 - cx, -FF.H / 2 - cy);
    }
    this.drawStage(ctx);
    // camada de cada coisa (Estúdio: "Atrás dos lutadores"): primeiro o que fica atrás, depois os lutadores, depois a frente
    const desenharFx = (e) => {
      const o = e.alpha != null ? { alpha: e.alpha } : undefined;
      if (!e.rot) return FF.drawFrame(ctx, e.set, e.a.frame(), e.x, e.y, e.scale, e.flip, o);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.rot * Math.PI / 180);
      FF.drawFrame(ctx, e.set, e.a.frame(), 0, 0, e.scale, e.flip, o);
      ctx.restore();
    };
    const camada = (atras) => {
      (this.cenasVivas || []).forEach(v => FF.Cena.desenhar(ctx, this, v.actor, v.target, v.cena, v.t, atras));
      this.projectiles.forEach(p => { if (!!p.atras === atras) this.desenharProjetil(ctx, p); });
      this.fxList.forEach(e => { if (!!e.atras === atras) desenharFx(e); });
    };
    camada(true);
    // quem está agindo fica na frente; "naFrente"/"atras" do clipe de animação (Estúdio) mandam mais
    const prio = this.persp
      ? (f) => (f.camadaExtra || 0) * 10000 + f.groundY + (f.busy ? 0.5 : 0)   // perspectiva: o que está mais embaixo fica na frente
      : (f) => (f.camadaExtra || 0) * 10 + (f.busy ? 1 : 0);
    const order = this.all.slice().sort((a, b) => prio(a) - prio(b));
    if (this.persp) {
      this.desenharSombras(ctx);
      order.forEach(f => {
        // névoa: o fundo fica um pouco mais claro e menos saturado (some quando ele vem para a frente)
        const d = f.homeG != null ? Math.max(0, Math.min(1, (this.PERSP.frente - f.groundY) / (this.PERSP.frente - this.PERSP.fundo))) : 0;
        if (d > 0.05 && !f.busy) { ctx.save(); ctx.filter = 'saturate(' + (1 - 0.22 * d).toFixed(2) + ') brightness(' + (1 + 0.06 * d).toFixed(2) + ') contrast(' + (1 - 0.12 * d).toFixed(2) + ')'; f.draw(ctx, this.fx); ctx.restore(); }
        else f.draw(ctx, this.fx);
      });
    } else order.forEach(f => f.draw(ctx, this.fx));
    // supremo: escurece tudo e redesenha só quem solta, aceso
    if (this.drama) { ctx.fillStyle = 'rgba(0,0,10,' + 0.65 * Math.min(1, (FF.Clock.t - this.drama.t0) / 0.2) + ')'; ctx.fillRect(-FF.W, -FF.H, FF.W * 3, FF.H * 3); this.drama.actor.draw(ctx, this.fx); }
    this.desenharEmbate(ctx);
    this.desenharEscudos(ctx);
    // modo Planejamento: o que cada herói já tem marcado aparece em cima dele
    this.all.forEach(f => { if (f.planoIcone && !f.ko) FF.HUD.text(ctx, f.planoIcone + ' ✔', f.x, f.y - 70 * f.scale, 16, '#ffe25a', 'center'); });
    Object.values(this.objs).forEach(o => FF.drawFrame(ctx, o.set, o.a.frame(), o.x, o.y, o.scale || 0.01, o.flip));
    camada(false);
    ctx.restore();
    this.drawQtes(ctx);
    FF.HUD.draw(ctx, this);
    this.desenharDesafio(ctx);
    this.desenharDrama(ctx);
    this.desenharFala(ctx);
    if (this.flashAmt > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, this.flashAmt) + ')';
      ctx.fillRect(0, 0, FF.W, FF.H);
    }
  }

  // ---------- cenário da perspectiva diagonal ----------
  // "Planície em perspectiva": céu e arbustos do Campo sobem até o horizonte; o campo de grama ("chao" do ZL3)
  // vira um chão fundo, com as linhas mais apertadas lá atrás; por cima, em pixel art gerada por código:
  // trilha de terra que afina até o horizonte, tufos de grama, pedras e uma névoa clara no fundo.
  // Desenhado uma vez numa imagem guardada (só refaz se a tela mudar de tamanho).
  drawStagePersp(ctx) {
    const R = FF.RES || 1, chave = FF.W + 'x' + R;
    if (!this._palcoPersp || this._palcoPersp.chave !== chave) this._palcoPersp = { chave, c: this.gerarPalcoPersp(R) };
    ctx.drawImage(this._palcoPersp.c, 0, 0, FF.W, FF.H);
  }
  gerarPalcoPersp(R) {
    const W = FF.W, H = FF.H, P = this.PERSP, hz = P.horizonte;
    const c = document.createElement('canvas'); c.width = Math.round(W * R); c.height = Math.round(H * R);
    const g = c.getContext('2d'); g.setTransform(R, 0, 0, R, 0, 0); g.imageSmoothingEnabled = false;
    const set = this.stageSprite, st = this.stage;
    // céu: a base dos arbustos (linha 400 da imagem) no horizonte
    try {
      const ceu = set.anim(st.ceu || 'ceu').frames[0];
      const sc = Math.max(W / ceu[3], (hz + 10) / 400);
      g.drawImage(set.images[ceu[0]], ceu[1], ceu[2], ceu[3], ceu[4], (W - ceu[3] * sc) / 2, hz + 6 - 400 * sc, ceu[3] * sc, ceu[4] * sc);
    } catch (e) { g.fillStyle = '#7fa8ff'; g.fillRect(0, 0, W, hz); }
    g.fillStyle = '#4f9a2c'; g.fillRect(0, hz - 2, W, H - hz + 2);
    // campo de grama em perspectiva: cada linha da imagem vira uma faixa (as de cima bem finas)
    let chao = null;
    try { chao = set.has('chao') ? set.anim('chao').frames[0] : null; } catch (e) { chao = null; }
    const yDe = (v) => hz - 6 + (H - hz + 6) * Math.pow(v, 1.55);
    if (chao) {
      const n = chao[4];
      for (let r = 0; r < n; r++) {
        const y0 = yDe(r / n), y1 = yDe((r + 1) / n);
        g.drawImage(set.images[chao[0]], chao[1], chao[2] + r, chao[3], 1, -20, y0, W + 40, Math.max(1, y1 - y0 + 0.6));
      }
    }
    // detalhes em pixel art (desenhados em baixa resolução e ampliados sem suavizar)
    const PX = 3, w = Math.ceil(W / PX), h = Math.ceil(H / PX);
    const d = document.createElement('canvas'); d.width = w; d.height = h;
    const q = d.getContext('2d');
    let semente = 7;
    const rnd = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
    const hzP = hz / PX;
    const yP = (v) => yDe(v) / PX;
    // faixas de grama cortada (alternam claro/escuro, mais largas perto da tela)
    for (let k = 0; k < 9; k++) {
      if (k % 2) continue;
      const a = yP(k / 9), b = yP((k + 1) / 9);
      q.fillStyle = 'rgba(255,255,190,0.07)'; q.fillRect(0, a, w, b - a);
    }
    // trilha de terra: sai do horizonte (um pouco à esquerda) e abre até a frente
    const trilha = (lado) => { const pts = []; for (let i = 0; i <= 24; i++) { const v = i / 24, y = yP(v), cx = w * (0.47 + 0.06 * Math.sin(v * 2.4)), lg = (4 + 70 * Math.pow(v, 1.4)) / PX * 1.6; pts.push([cx + lado * lg, y]); } return pts; };
    const esq = trilha(-1), dir = trilha(1);
    const caminho = () => { q.beginPath(); esq.forEach(([x, y], i) => i ? q.lineTo(x, y) : q.moveTo(x, y)); dir.slice().reverse().forEach(([x, y]) => q.lineTo(x, y)); q.closePath(); };
    q.fillStyle = '#b58f52'; caminho(); q.fill();
    q.save(); caminho(); q.clip();
    q.fillStyle = '#d9bd7c'; q.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const v = Math.pow(rnd(), 0.8), y = yP(v), x = w * (0.3 + rnd() * 0.4), t = Math.max(1, Math.round(v * 2)); q.fillStyle = rnd() < 0.5 ? '#c4a364' : '#ead39a'; q.fillRect(Math.round(x), Math.round(y), t, Math.max(1, t - 1)); }
    q.restore();
    // borda da trilha (grama invadindo)
    q.fillStyle = '#3f8a24';
    [esq, dir].forEach(l => l.forEach(([x, y], i) => { if (i % 2) return; const v = i / 24, t = Math.max(1, Math.round(v * 3)); q.fillRect(Math.round(x - t / 2), Math.round(y - t), t, t); }));
    // tufos de grama: pequenos lá atrás, grandes na frente
    for (let i = 0; i < 340; i++) {
      const v = Math.pow(rnd(), 0.7), y = Math.round(yP(v)), x = Math.round(rnd() * w);
      const cx = w * (0.47 + 0.06 * Math.sin(v * 2.4)), lg = (4 + 70 * Math.pow(v, 1.4)) / PX * 1.6;
      if (Math.abs(x - cx) < lg + 1) continue;
      const t = 1 + Math.round(v * 3);
      q.fillStyle = '#2f7a1c'; q.fillRect(x, y - t, 1, t); q.fillRect(x - 1, y - Math.max(1, t - 1), 1, Math.max(1, t - 1)); q.fillRect(x + 1, y - Math.max(1, t - 1), 1, Math.max(1, t - 1));
      if (t > 2) { q.fillStyle = '#8fd651'; q.fillRect(x, y - t, 1, 1); }
    }
    // pedras (só nas laterais, para não ficar embaixo dos lutadores)
    [[0.06, 0.92, 9], [0.95, 0.85, 7], [0.18, 0.35, 3], [0.83, 0.3, 3], [0.97, 0.55, 4]].forEach(([u, v, t]) => {
      const x = Math.round(u * w), y = Math.round(yP(v));
      q.fillStyle = 'rgba(20,40,10,0.35)'; q.fillRect(x - t, y, t * 2 + 1, Math.max(1, Math.round(t / 3)));
      q.fillStyle = '#6f6a62'; q.fillRect(x - t + 1, y - t, t * 2 - 1, t);
      q.fillStyle = '#9b958a'; q.fillRect(x - t + 2, y - t, t, Math.max(1, Math.round(t / 2)));
      q.fillStyle = '#4c4842'; q.fillRect(x - t + 1, y - 1, t * 2 - 1, 1);
    });
    // névoa no horizonte
    const nv = q.createLinearGradient(0, hzP - 6, 0, hzP + 30);
    nv.addColorStop(0, 'rgba(225,245,255,0.55)'); nv.addColorStop(1, 'rgba(225,245,255,0)');
    q.fillStyle = nv; q.fillRect(0, hzP - 6, w, 36);
    // escurece um pouco a frente (dá profundidade)
    const fr = q.createLinearGradient(0, yP(0.75), 0, h);
    fr.addColorStop(0, 'rgba(0,30,0,0)'); fr.addColorStop(1, 'rgba(0,30,0,0.22)');
    q.fillStyle = fr; q.fillRect(0, yP(0.75), w, h);
    g.drawImage(d, 0, 0, w * PX, h * PX);
    return c;
  }

  drawStage(ctx) {
    if (this.persp) return this.drawStagePersp(ctx);
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
