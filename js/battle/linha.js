// Linha do tempo (Estúdio Final Flash): um passo de roteiro em que tudo acontece em tempos absolutos,
// organizado em trilhas, como num editor de vídeo.
//   {"linha": {"duracao": 2.4, "trilhas": [ {id, tipo, nome, quem?, oculta?, clipes: [...]}, ... ]}}
//
// Tipos de trilha → clipes aceitos (todo clipe tem "t" = início em segundos; "d" = duração quando faz sentido):
//  lutador  (quem: "atacante" | "alvo" | id de um parceiro, ex.: "piccolo")
//     {tipo:"anim", anim, sprite? (animação de outro sprite), de?, ate? (trecho de quadros), fps?, d?, loop?, segurar? (s parado no 1º quadro), dx?, dy?, escala?, rot? (°), alpha?, flip?,
//      empurrao? (desliza para trás), voltarNormal? (fica parado no fim)}
//     {tipo:"mover", d, para: "alvo"|"casa"|"frente"|"x", dist?, x?, animMov?, suave?}
//     {tipo:"teleporte", para: "alvo"|"casa"|"frente"|"x", dist?, x?, y?, animMov?}
//     para "x" = qualquer ponto da tela: x em pixels da tela (0 a 1084), y = altura em relação ao chão (negativo = no ar)
//     {tipo:"visivel", alpha}
//  efeitos  {tipo:"efeito", fx, sprite?, em: "atacante"|"peito"|"disparo"|"alvo"|"alvoPes"|"tela", dx, dy, escala, rot?, alpha?, flip?, fps?, d?,
//            seguir? (anda junto com o lutador em que está preso)}
//  projeteis {tipo:"projetil", fx, sprite?, ...todos os campos do projétil do motor, deDx?, deDy?, alvoDx?, alvoDy?,
//            centro? (meio do desenho no caminho, em vez da origem do sprite), spriteDx?, spriteDy? (desenho deslocado do caminho),
//            rot? (giro fixo do desenho, °), cor? (matiz 0–359: pinta o projétil), corForca? (0–2, padrão 1)}
//  camadas  {tipo:"camada", d, sprite, anim, ancora, x, y, escala, alpha, rot, flip, fps, loop, chaves:[{t,x,y,escala,alpha,rot}]}
//  sons     {tipo:"som", som} | {tipo:"voz", voz}   (texto ou lista para sortear)
//           {tipo:"voz", vozTipo: "dano"|"lancado"|..., quem: "atacante"|"alvo"}  (a voz do próprio personagem)
//  acertos  {tipo:"acerto", fracao, forca, lanca?, empurrao?, fx?, dx?, dy?, fxEscala?, anel?}
//           anel: true = abre um anel de guarda/crítico novo; false = usa o anel do acerto anterior;
//           sem o campo: anel novo quando o acerto anterior foi há mais de 0,6 s.
//  tela     {tipo:"tremer", forca} | {tipo:"flash", forca} | {tipo:"mensagem", texto, d?}
//           {tipo:"camera", d, zoom, foco: "centro"|"atacante"|"alvo"|"entre", dx?, dy?}
//  acoes    {tipo:"acao", passo: {qualquer passo de roteiro: transformar, aplicar, ki, curar, atordoar, objeto,
//           lancarObjeto, autoNocaute, removerBuff, vozTipo...}}
// Posições dx/dy em pixels da tela (dx positivo = para a frente de quem solta).
window.FF = window.FF || {};

FF.Linha = {
  LEAD: 0.55,

  // ---------- utilidades ----------
  clipes(linha) { const l = []; (linha.trilhas || []).forEach(tr => { if (!tr.oculta) (tr.clipes || []).forEach(c => l.push({ tr, c })); }); return l; },

  // tempo total de uma animação (s) com um fps
  duracaoAnim(a, fps) {
    if (!a) return 0;
    let f = fps != null ? fps : a.fps;
    if (!f && a.frames.length > 1) f = 10;
    if (!f) return 0.1;
    return a.frames.reduce((s, q) => s + (q[7] || 1) / f, 0);
  },
  tempoQuadro(a, fps, k) {
    let f = fps != null ? fps : a.fps;
    if (!f && a.frames.length > 1) f = 10;
    let t = 0;
    for (let i = 0; i < k && i < a.frames.length; i++) t += f > 0 ? (a.frames[i][7] || 1) / f : 0;
    return t;
  },

  // trecho de uma animação (de/ate, índices inclusive), igual ao passo "anim" do roteiro
  trecho(set, name, de, ate) {
    const a = set && set.anim(name);
    if (!a || (de == null && ate == null)) return name;
    const n = a.frames.length, d = Math.max(0, Math.min(n - 1, de || 0)), t = Math.max(d, Math.min(n - 1, ate != null ? ate : n - 1));
    const sub = name + '#' + d + '-' + t;
    if (!set.has(sub)) set.def.anims[sub] = Object.assign({}, a, { frames: a.frames.slice(d, t + 1), repeatTo: 0 });
    return sub;
  },

  // sprites que a linha usa (camadas, efeitos e projéteis de sprites importados)
  spritesUsados(linha) {
    const s = new Set();
    const add = (o) => { if (!o) return; ['sprite', 'disparoSprite', 'impactoSprite'].forEach(k => { if (o[k]) s.add(o[k]); }); };
    this.clipes(linha).forEach(({ c }) => {
      add(c); add(c.acerto);
      [].concat(c.acertos || [], c.impacto && typeof c.impacto === 'object' ? c.impacto : []).forEach(add);
    });
    return [...s];
  },
  pronta(linha) { return this.spritesUsados(linha).every(id => FF.Assets.sprites[id]); },
  async preparar(linha) {
    await Promise.all(this.spritesUsados(linha).map(id => FF.Assets.loadSprite(id).catch(() => null)));
  },

  // quem é o lutador de uma trilha
  lutadorDe(b, actor, target, quem) {
    if (!quem || quem === 'atacante') return actor;
    if (quem === 'alvo') return target;
    return b.all.find(f => f.id === quem && f !== actor && !f.ko) || null;
  },

  // ---------- execução (passo de roteiro) ----------
  async tocar(b, actor, target, move, linha) {
    if (!this.pronta(linha)) await this.preparar(linha);
    const viva = this.iniciar(b, actor, target, move, linha);
    await viva.fim;
  },

  // começa a tocar e devolve o objeto "vivo" (tick a cada quadro pela batalha). Síncrono: o Estúdio usa
  // para simular até um instante qualquer (arrastar o cursor do tempo).
  // opts.ko: cena de KO (js/battle/ko.js) — o alvo já está nocauteado e anima mesmo assim; ao terminar só mexe nele
  iniciar(b, actor, target, move, linha, opts) {
    const ehKO = !!(opts && opts.ko);
    const dur = linha.duracao || 1;
    const lista = this.clipes(linha).map(x => Object.assign({ t: 0 }, x.c, { _tr: x.tr })).filter(c => !(ehKO && c.tipo === 'acerto')).sort((a, c) => (a.t || 0) - (c.t || 0));
    // anéis de guarda/crítico: agrupa os acertos e abre cada anel LEAD s antes do 1º acerto do grupo
    const mode = target ? b.qteMode(actor, target) : null;
    const acertos = lista.filter(c => c.tipo === 'acerto');
    const grupos = [];
    let ult = null;
    for (const h of acertos) {
      const novo = !grupos.length || h.anel === true || (h.anel !== false && h.t - ult > 0.6);
      if (novo) grupos.push({ t: h.t, hits: [] });
      grupos[grupos.length - 1].hits.push(h);
      h._g = grupos[grupos.length - 1];
      ult = h.t;
    }
    // se o primeiro acerto vier cedo demais, a linha toda espera (o lutador fica no 1º quadro)
    const atraso = mode && grupos.length && target && !target.ko ? Math.max(0, this.LEAD - grupos[0].t) : 0;
    const eventos = [];
    grupos.forEach((g, i) => {
      const prev = i ? grupos[i - 1].hits[grupos[i - 1].hits.length - 1].t : -atraso;
      const ini = Math.max(prev, g.t - this.LEAD, -atraso);
      if (mode) eventos.push({ t: ini, ordem: -1, fn: () => { if (!target.ko) g.qte = b.addQte(mode, target, g.t - viva.t); } });
    });
    const viva = { linha, actor, target, move, t: -atraso, cena: { camadas: [] }, dur, ativos: [], lutadores: new Set(), ko: ehKO };
    let fimRes;
    viva.fim = new Promise(r => (fimRes = r));
    const estado = new Map();     // alpha original de quem a linha mexe
    const guardar = (f) => { if (f && !estado.has(f)) estado.set(f, { alpha: f.alpha }); };

    lista.forEach(c => {
      if (c.tipo === 'camada') {   // desenhada pela batalha junto com as cenas livres
        viva.cena.camadas.push(Object.assign({}, c, { inicio: c.t, fim: c.t + (c.d != null ? c.d : 1) }));
        return;
      }
      // animações que começam no 0 seguram o 1º quadro durante o atraso do anel
      const t0 = c.t <= 0 && c.tipo === 'anim' ? -atraso : c.t;
      eventos.push({ t: t0, ordem: 0, fn: () => this.disparar(b, viva, c, c.t <= 0 && c.tipo === 'anim' ? atraso : 0, guardar) });
    });
    eventos.sort((a, c) => a.t - c.t || a.ordem - c.ordem);
    viva.eventos = eventos;

    // lutadores com animação na linha ficam "ocupados" (na frente, sem reação automática), menos o alvo
    lista.filter(c => c._tr.tipo === 'lutador' && c._tr.quem !== 'alvo' && !ehKO).forEach(c => {
      const f = this.lutadorDe(b, actor, target, c._tr.quem);
      if (f) { f.busy = true; viva.lutadores.add(f); }
    });

    viva.tick = (dt) => {
      if (viva.acabou) return true;
      viva.t += dt;
      while (eventos.length && eventos[0].t <= viva.t) eventos.shift().fn();
      viva.ativos = viva.ativos.filter(a => a(dt, viva.t) !== false);
      if (viva.t >= dur) {
        while (eventos.length) eventos.shift().fn();
        viva.acabou = true;
        this.encerrar(b, viva, estado);
        viva.parar();
        fimRes();
        return true;
      }
      return false;
    };
    b.cenasVivas = b.cenasVivas || [];
    b.cenasVivas.push(viva);
    viva.parar = () => { b.cenasVivas = b.cenasVivas.filter(v => v !== viva); };
    return viva;
  },

  devolverSprite(f) {
    if (!f || !f._spriteOrig) return;
    f.sprite = f._spriteOrig.sprite; f.anim = f._spriteOrig.anim; delete f._spriteOrig;
  },

  encerrar(b, viva, estado) {
    if (viva.ko) {   // cena de KO: tocou junto com o golpe; devolve só o derrotado
      const f = viva.target;
      if (f) { this.devolverSprite(f); f.offX = 0; f.offY = 0; f.escExtra = 1; f.flipExtra = false; f.rotExtra = 0; f.y = f.groundY; }
      for (const [g, e] of estado) g.alpha = e.alpha;
      if (b.cam && this.clipes(viva.linha).some(({ c }) => c.tipo === 'camera')) b.camAlvo = { zoom: 1, x: 0, y: 0, d: 0.3, t: 0, de: Object.assign({}, b.cam) };
      return;
    }
    for (const f of b.all) this.devolverSprite(f);
    for (const [f, e] of estado) f.alpha = e.alpha;
    for (const f of b.all) { f.offX = 0; f.offY = 0; f.escExtra = 1; f.flipExtra = false; f.rotExtra = 0; f.y = f.groundY; }
    viva.lutadores.forEach(f => { if (f !== viva.actor) { f.busy = false; if (!f.ko) f.idle(); } });
    if (b.cam && (b.cam.zoom !== 1 || b.cam.x || b.cam.y)) b.camAlvo = { zoom: 1, x: 0, y: 0, d: 0.3, t: 0, de: Object.assign({}, b.cam) };
  },

  destino(b, f, outro, c) {
    const dist = (c.dist != null ? c.dist : 22) * f.scale;
    if (c.para === 'casa') return f.homeX;
    if (c.para === 'x') return c.x != null ? c.x + (FF.W - 1084) / 2 : f.x;
    if (c.para === 'frente') return f.x + f.dir * dist;
    if (c.para === 'tras') return f.x - f.dir * dist;
    return outro ? outro.x - f.dir * dist : f.x;
  },

  disparar(b, viva, c, segurar, guardar) {
    const { actor, target } = viva;
    const move = viva.move || {};
    const tr = c._tr;
    switch (c.tipo) {
      case 'anim': case 'mover': case 'teleporte': case 'visivel': {
        const f = this.lutadorDe(b, actor, target, tr.quem);
        if (!f || (f.ko && tr.quem !== 'atacante' && !(viva.ko && f === target))) return;
        const outro = f === actor ? target : actor;
        if (c.tipo === 'visivel') { guardar(f); f.alpha = c.alpha != null ? c.alpha : 1; return; }
        if (c.tipo === 'anim') {
          f.react = null;
          // animação emprestada de outro sprite (ex.: Kuririn com uma pose do Bills): troca o desenho até o próximo clipe
          const emprestado = c.sprite && FF.Assets.sprites[c.sprite];
          if (emprestado && emprestado !== f.sprite) { if (!f._spriteOrig) f._spriteOrig = { sprite: f.sprite, anim: f.anim }; f.sprite = emprestado; f.anim = new FF.Animator(emprestado); }
          else if (!emprestado) this.devolverSprite(f);
          f.offX = (c.dx || 0) * f.dir; f.offY = c.dy || 0; f.escExtra = c.escala || 1; f.flipExtra = !!c.flip; f.rotExtra = (c.rot || 0) * f.dir;
          if (c.alpha != null) { guardar(f); f.alpha = c.alpha; }
          const loop = c.loop != null ? !!c.loop : !!c.d;
          f.anim.play(this.trecho(f.sprite, emprestado ? c.anim : f.animName(c.anim), c.de, c.ate), { fps: c.fps || undefined, loop, hold: (c.segurar || 0) + (segurar || 0) });
          if (c.empurrao) { f.vx = -f.dir * c.empurrao; f.voando = true; }
          if (c.voltarNormal) {
            const nm = this.trecho(f.sprite, f.animName(c.anim), c.de, c.ate);
            const fimT = c.t + (c.d != null ? c.d : this.duracaoAnim(f.sprite.anim(nm), c.fps || undefined) + (c.segurar || 0));
            viva.ativos.push((dt, t) => { if (t >= fimT) { if (!f.ko && f.anim.name === nm) f.idle(); return false; } });
          }
          return;
        }
        this.devolverSprite(f);
        const dest = this.destino(b, f, outro, c);
        // ponto da tela: também muda a altura (sem "y" = volta ao chão)
        const destY = c.para === 'x' ? f.groundY + (c.y || 0) : f.y;
        if (c.tipo === 'mover') {
          const x0 = f.x, y0 = f.y, d = Math.max(0.01, c.d || 0.22), t0 = viva.t;
          if (c.animMov !== '') f.play(c.animMov || (dest * f.dir >= x0 * f.dir ? 'avancar' : 'recuar'), { loop: true });
          viva.ativos.push((dt, t) => {
            const k = Math.min(1, (t - t0) / d);
            const e = c.suave === false ? k : 1 - Math.pow(1 - k, 2);
            f.x = x0 + (dest - x0) * e;
            f.y = y0 + (destY - y0) * e;
            if (k >= 1) return false;
          });
          return;
        }
        // teleporte: some no meio da animação e aparece no destino
        const nome = f.animName(c.animMov || 'teleporte');
        const a = f.sprite.anim(nome);
        if (!a) { f.x = dest; f.y = destY; return; }
        const meio = Math.floor(a.frames.length / 2);
        f.anim.play(nome, { onFrame: (i) => { if (i === meio) { f.x = dest; f.y = destY; } } });
        return;
      }
      case 'efeito': {
        const p = this.ponto(b, actor, target, c.em);
        const dir = actor ? actor.dir : 1;
        const e = b.spawnFx(c.fx, p.x + (c.dx || 0) * (c.em === 'tela' ? 1 : dir), p.y + (c.dy || 0), (dir < 0) !== !!c.flip, c.escala || 1,
          { duracao: c.d, fps: c.fps, alpha: c.alpha, sprite: c.sprite });
        if (e && c.rot) e.rot = c.rot * dir;
        // seguir: o efeito anda junto com o lutador em que está preso (aura, rastro durante um avanço…)
        const f = c.em === 'alvo' || c.em === 'alvoPes' ? target : c.em === 'tela' ? null : actor;
        if (e && c.seguir && f) e.segue = { f, x0: f.x, y0: f.y, ex: e.x, ey: e.y };
        return;
      }
      case 'projetil': if (target && actor) b.spawnProjectile(actor, target, move, c); return;
      case 'som': FF.Audio.play(FF.Script.pick(c.som)); return;
      case 'voz': {
        // vozTipo: a voz do próprio personagem (dano, lancado, ...) de quem está na trilha "quem"
        if (c.vozTipo) { const f = this.lutadorDe(b, actor, target, c.quem); if (f) f.voz(c.vozTipo); return; }
        FF.Audio.voice(FF.Script.pick(c.voz)); return;
      }
      case 'acerto': if (target && actor) b.applyHit(actor, target, move, c, c._g && c._g.qte); return;
      case 'tremer': b.shake(c.forca || 6); return;
      case 'flash': b.flash(c.forca || 0.5); return;
      case 'mensagem': b.banner(c.texto || '', c.d || 1.3); return;
      case 'camera': {
        b.cam = b.cam || { zoom: 1, x: 0, y: 0 };
        const foco = this.foco(b, actor, target, c);
        b.camAlvo = { zoom: c.zoom || 1, x: foco.x, y: foco.y, d: c.d || 0, t: 0, de: Object.assign({}, b.cam) };
        return;
      }
      case 'acao': {
        if (!c.passo) return;
        const p = FF.Script.step(b, actor, target, move, c.passo);
        if (p && p.then) b.paralelos.push(p);
        return;
      }
    }
  },

  // deslocamento da câmera (a partir do centro da tela) para um foco
  foco(b, actor, target, c) {
    const cx = FF.W / 2, cy = FF.H / 2;
    let x = cx, y = cy;
    const pa = actor && actor.peito(), pt = target && target.peito();
    if (c.foco === 'atacante' && pa) { x = pa.x; y = pa.y; }
    else if (c.foco === 'alvo' && pt) { x = pt.x; y = pt.y; }
    else if (c.foco === 'entre' && pa && pt) { x = (pa.x + pt.x) / 2; y = (pa.y + pt.y) / 2; }
    return { x: x - cx + (c.dx || 0) * (actor ? actor.dir : 1), y: y - cy + (c.dy || 0) };
  },

  // pontos de referência usados por efeitos (e pelo Estúdio para posicionar)
  ponto(b, actor, target, em) {
    if (em === 'tela') return { x: (FF.W - 1084) / 2, y: 0 };
    if (em === 'alvo' && target) return target.peito();
    if (em === 'alvoPes' && target) return { x: target.x, y: target.groundY };
    if (em === 'disparo' && actor) return actor.pontoDisparo();
    if (em === 'peito' && actor) return actor.peito();
    if (actor) return { x: actor.x, y: actor.groundY };
    return { x: FF.W / 2, y: b.groundY };
  },

  // ---------- conversão de um roteiro antigo (lista de passos) para linha do tempo ----------
  // ctx: { sprite (SpriteSet da forma), anims (mapa da forma), spriteDe(quem) → SpriteSet, animsDe(quem) }
  converter(roteiro, ctx) {
    const tr = {
      atacante: { id: 'atacante', tipo: 'lutador', quem: 'atacante', nome: 'Quem solta', clipes: [] },
      alvo: { id: 'alvo', tipo: 'lutador', quem: 'alvo', nome: 'Alvo', clipes: [] },
      efeitos: { id: 'efeitos', tipo: 'efeitos', nome: 'Efeitos', clipes: [] },
      projeteis: { id: 'projeteis', tipo: 'projeteis', nome: 'Projéteis', clipes: [] },
      camadas: { id: 'camadas', tipo: 'camadas', nome: 'Camadas livres', clipes: [] },
      sons: { id: 'sons', tipo: 'sons', nome: 'Sons e vozes', clipes: [] },
      acertos: { id: 'acertos', tipo: 'acertos', nome: 'Acertos', clipes: [] },
      tela: { id: 'tela', tipo: 'tela', nome: 'Tela (tremor, flash, câmera)', clipes: [] },
      acoes: { id: 'acoes', tipo: 'acoes', nome: 'Ações (ki, buff, transformar…)', clipes: [] },
    };
    const parceiros = {};
    const trilhaLut = (quem) => {
      if (quem === 'atacante' || quem === 'alvo') return tr[quem];
      if (!parceiros[quem]) parceiros[quem] = { id: 'p_' + quem, tipo: 'lutador', quem, nome: 'Parceiro: ' + quem, clipes: [] };
      return parceiros[quem];
    };
    const r3 = (x) => Math.round(x * 1000) / 1000;
    const add = (t, c) => { c.t = r3(c.t); t.clipes.push(c); return c; };
    const evento = (e, t, quem) => {
      const T = r3(t);
      if (e.som) add(tr.sons, { tipo: 'som', t: T, som: e.som });
      if (e.voz) add(tr.sons, { tipo: 'voz', t: T, voz: e.voz });
      if (e.tremer) add(tr.tela, { tipo: 'tremer', t: T, forca: e.tremer });
      if (e.flash) add(tr.tela, { tipo: 'flash', t: T, forca: e.flash });
      if (e.efeito) add(tr.efeitos, Object.assign({ tipo: 'efeito', t: T, em: e.efeito.em || 'atacante' }, e.efeito, quem === 'alvo' ? { _doAlvo: 1 } : {}));
      if (e.acerto) add(tr.acertos, Object.assign({ tipo: 'acerto', t: T }, e.acerto));
      if (e.projetil) add(tr.projeteis, Object.assign({ tipo: 'projetil', t: T }, e.projetil));
      const acao = {};
      ['ki', 'vozTipo', 'objeto', 'lancarObjeto'].forEach(k => { if (e[k] != null) acao[k] = e[k]; });
      if (Object.keys(acao).length) add(tr.acoes, { tipo: 'acao', t: T, passo: acao });
    };

    const rodar = (passos, t, quem) => {
      for (const s of passos || []) t = passo(s, t, quem);
      return t;
    };
    const passo = (s, t, quem) => {
      const L = trilhaLut(quem);
      const set = ctx.spriteDe(quem), mapa = ctx.animsDe(quem) || {};
      const nomeAnim = (k) => mapa[k] || k;
      if (s.quem) {
        const fim = rodar(s.paralelo || [], t, s.quem);
        return s.esperarFim ? fim : t;
      }
      if (s.mensagem) add(tr.tela, { tipo: 'mensagem', t, texto: s.mensagem, d: s.mensagemDur || 1.3 });
      if (s.som && !s.anim && !s.animAlvo) add(tr.sons, { tipo: 'som', t, som: s.som });
      if (s.voz && !s.anim && !s.animAlvo) add(tr.sons, { tipo: 'voz', t, voz: s.voz });
      if (s.vozTipo) add(tr.acoes, { tipo: 'acao', t, passo: { vozTipo: s.vozTipo } });

      if (s.animAlvo) {
        const sa = ctx.spriteDe('alvo'), ma = ctx.animsDe('alvo') || {};
        const a = sa && sa.anim(ma[s.animAlvo] || s.animAlvo);
        const loop = !!s.duracao || !!s.loop;
        const d = s.duracao || this.duracaoAnim(a, s.fps);
        const c = { tipo: 'anim', t, anim: s.animAlvo };
        if (s.fps) c.fps = s.fps;
        if (s.duracao) c.d = s.duracao; else if (loop) c.loop = true;
        if (s.empurrao) c.empurrao = s.empurrao;
        if (s.voltarNormal) c.voltarNormal = true;
        add(tr.alvo, c);
        (s.eventos || []).filter(e => !e.acerto && !e.projetil && !e.lancarObjeto).forEach(e => {
          evento(e, t + (a ? this.tempoQuadro(a, s.fps, FF.Script.resolveFrame(a, e.quadro != null ? e.quadro : 0)) : 0), 'alvo');
        });
        if (s.semEsperar) return t;
        return t + (s.empurrao && !s.duracao ? Math.max(d, 0.6) : d);
      }
      if (s.anim) {
        const a = set && set.anim(this.trecho(set, nomeAnim(s.anim), s.de, s.ate));
        const loop = !!s.duracao || !!s.loop;
        const evs = (s.eventos || []).map(e => Object.assign({}, e, { _i: a ? FF.Script.resolveFrame(a, e.quadro != null ? e.quadro : 0) : 0 }));
        // espera do anel (o motor antigo segura o 1º quadro quando o 1º acerto vem cedo)
        const hits = evs.filter(e => e.acerto);
        let hold = 0;
        if (hits.length && a && quem === 'atacante') hold = Math.max(0, this.LEAD - this.tempoQuadro(a, s.fps, Math.min(...hits.map(e => e._i))));
        const c = { tipo: 'anim', t, anim: s.anim };
        if (s.de != null) c.de = s.de;
        if (s.ate != null) c.ate = s.ate;
        if (s.fps) c.fps = s.fps;
        if (s.duracao) c.d = s.duracao; else if (s.loop) c.loop = true;
        if (hold) c.segurar = r3(hold);
        add(L, c);
        const t0 = t + hold;
        const durA = this.duracaoAnim(a, s.fps);
        let primeiro = true;
        const repetir = loop && s.duracao ? Math.max(1, Math.ceil(s.duracao / Math.max(0.01, durA))) : 1;
        evs.forEach(e => {
          const vezes = e.repetir ? repetir : 1;
          for (let v = 0; v < vezes; v++) {
            const te = t0 + v * durA + (a ? this.tempoQuadro(a, s.fps, e._i) : 0);
            if (s.duracao && te > t0 + s.duracao) break;
            const ev = Object.assign({}, e);
            delete ev._i; delete ev.quadro; delete ev.repetir;
            if (ev.acerto) { ev.acerto = Object.assign({}, ev.acerto); if (primeiro) ev.acerto.anel = true; else ev.acerto.anel = false; primeiro = false; }
            evento(ev, te, quem);
          }
        });
        return t0 + (s.duracao || durA);
      }
      if (s.cena) {
        const cn = s.cena;
        (cn.camadas || []).forEach(k => {
          const c = Object.assign({ tipo: 'camada' }, k, { t: t + (k.inicio || 0), d: (k.fim != null ? k.fim : cn.duracao || 1) - (k.inicio || 0) });
          delete c.inicio; delete c.fim;
          add(tr.camadas, c);
        });
        (cn.sons || []).forEach(x => add(tr.sons, x.voz ? { tipo: 'voz', t: t + (x.t || 0), voz: x.som } : { tipo: 'som', t: t + (x.t || 0), som: x.som }));
        (cn.tremores || []).forEach(x => add(tr.tela, { tipo: 'tremer', t: t + (x.t || 0), forca: x.forca || 6 }));
        (cn.flashes || []).forEach(x => add(tr.tela, { tipo: 'flash', t: t + (x.t || 0), forca: x.forca || 0.5 }));
        (cn.acertos || []).slice().sort((a, b) => (a.t || 0) - (b.t || 0)).forEach((x, i) => {
          const c = Object.assign({ tipo: 'acerto' }, x, { t: t + (x.t || 0), anel: i === 0 });
          add(tr.acertos, c);
        });
        const d = cn.duracao || 1;
        if (cn.esconderAtacante) { add(L, { tipo: 'visivel', t, alpha: 0 }); add(L, { tipo: 'visivel', t: t + d, alpha: 1 }); }
        if (cn.esconderAlvo) { add(tr.alvo, { tipo: 'visivel', t, alpha: 0 }); add(tr.alvo, { tipo: 'visivel', t: t + d, alpha: 1 }); }
        return t + d;
      }
      if (s.irAte) {
        add(L, { tipo: 'mover', t, d: s.tempo || 0.22, para: s.irAte === 'alvo' ? 'alvo' : 'casa', dist: s.dist || 22, animMov: s.animMov || 'avancar' });
        return t + (s.tempo || 0.22);
      }
      if (s.voltar) {
        const a = set && set.anim(nomeAnim(s.animMov || 'teleporte'));
        add(L, { tipo: 'teleporte', t, para: 'casa', animMov: s.animMov || 'teleporte' });
        return t + (a ? this.duracaoAnim(a) : 0.25);
      }
      if (s.esperar) return t + s.esperar;
      if (s.tremer) { add(tr.tela, { tipo: 'tremer', t, forca: s.tremer }); return t; }
      if (s.flash) { add(tr.tela, { tipo: 'flash', t, forca: s.flash }); return t; }
      // o resto vira uma "ação" com o passo original
      const p = Object.assign({}, s);
      ['mensagem', 'mensagemDur', 'som', 'voz', 'vozTipo', 'final'].forEach(k => delete p[k]);
      if (Object.keys(p).length) add(tr.acoes, { tipo: 'acao', t, passo: p });
      return t + (s.autoNocaute ? 0.6 : 0);
    };
    const fim = rodar(roteiro, 0, 'atacante');
    const trilhas = [tr.atacante, ...Object.values(parceiros), tr.alvo, tr.efeitos, tr.projeteis, tr.camadas, tr.sons, tr.acertos, tr.tela, tr.acoes];
    // efeitos vindos de animações do alvo: o motor antigo usava o alvo como "quem solta"
    tr.efeitos.clipes.forEach(c => { if (c._doAlvo) { delete c._doAlvo; if (!c.em || c.em === 'atacante') c.em = 'alvoPes'; else if (c.em === 'alvo') c.em = 'peito'; } });
    let id = 1;
    trilhas.forEach(t => t.clipes.forEach(c => { c.id = 'c' + (id++); }));
    return { duracao: r3(Math.max(0.3, fim + 0.1)), trilhas };
  },
};
