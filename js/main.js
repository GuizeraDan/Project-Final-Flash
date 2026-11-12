// Inicialização: tela de início, carregamento da batalha e menu de golpes.
window.FF = window.FF || {};

FF.UI = {
  menu: null,
  // ícone por tipo de golpe
  icone(m) {
    if (m.supremo) return '💥';
    if (m.requer && m.requer.parceiro) return '🤝';
    const t = m.tipo || (JSON.stringify(m.roteiro || []).includes('"irAte"') ? 'corpo' : /"(acerto|projetil|lancarObjeto)"/.test(JSON.stringify(m.roteiro || [])) ? 'energia' : 'suporte');
    return { corpo: '👊', energia: '🔥', suporte: '✨', transformacao: '⚡' }[t] || '•';
  },

  // motivo de um golpe estar bloqueado (mostrado na linha de descrição)
  motivo(hero, m) {
    if (m.supremo && !hero.rageCheia) return 'A Barra de Fúria precisa estar cheia.';
    if ((m.custoKi || 0) > hero.ki) return 'Precisa de ' + m.custoKi + ' de ki (você tem ' + Math.floor(hero.ki) + ').';
    if (m.requer && m.requer.parceiro) {
      const pf = FF.battle && FF.battle.all.find(f => f.id === m.requer.parceiro.id && !f.ko);
      if (!pf) return 'Precisa do parceiro de pé na batalha.';
      if (pf.ki < (m.requer.parceiro.ki || 0)) return pf.nome + ' precisa de ' + m.requer.parceiro.ki + ' de ki.';
    }
    if (m.requer && m.requer.semBuff && hero.buffs[m.requer.semBuff]) return 'Já está ativo.';
    return '';
  },

  // cabeçalho do painel: retrato + nome + ki/fúria do herói da vez
  cabecalho(box, f, sub) {
    const topo = document.createElement('div');
    topo.className = 'cmd-topo';
    const cv = document.createElement('canvas');
    cv.width = 40; cv.height = 56; cv.className = 'cmd-face';
    topo.appendChild(cv);
    const t = document.createElement('div');
    t.innerHTML = '<b class="cmd-nome"></b><span class="cmd-sub"></span>';
    t.querySelector('.cmd-nome').textContent = f.nome;
    t.querySelector('.cmd-sub').textContent = sub;
    topo.appendChild(t);
    box.appendChild(topo);
    FF.Retrato.noCanvas(cv, f.def, f.formId, 'retrato', { espelhar: !f.isHero });
  },

  chooseMove(hero, battle) {
    return new Promise(resolve => {
      const box = document.getElementById('menu');
      box.innerHTML = '';
      box.classList.remove('alvos');
      this.cabecalho(box, hero, 'KI ' + Math.floor(hero.ki) + '/' + hero.kiMax + '  ·  Fúria ' + Math.floor(hero.rage) + '%');
      const grade = document.createElement('div');
      grade.className = 'cmd-golpes';
      box.appendChild(grade);
      const desc = document.createElement('div');
      desc.className = 'cmd-desc';
      box.appendChild(desc);
      const ids = hero.form.golpes;
      const btns = [];
      ids.forEach((id, i) => {
        const m = hero.def.golpes[id];
        const b = document.createElement('button');
        b.innerHTML = '<span class="n">' + (i + 1) + '</span><span class="ic">' + this.icone(m) + '</span><span class="nome"></span>' +
          (m.custoKi ? '<span class="ki">' + m.custoKi + '</span>' : '');
        b.querySelector('.nome').textContent = (m.habId ? '⭐ ' : '') + m.nome;
        const can = !this.motivo(hero, m) && !(m.requer && !this.meets(hero, m.requer));
        if (m.supremo) b.classList.add('supremo');
        if (m.requer && m.requer.parceiro) b.classList.add('sparking');
        b.classList.toggle('bloq', !can);
        b.onclick = () => { focus(i); if (can) done(id); else FF.Audio.play('tap_sound', 0.3); };
        b.onmouseenter = () => focus(i);
        b._can = can;
        grade.appendChild(b);
        btns.push(b);
      });
      let sel = btns.findIndex(b => b._can);
      const focus = (i) => {
        sel = i;
        btns.forEach((b, k) => b.classList.toggle('sel', k === i));
        const m = hero.def.golpes[ids[i]];
        const mot = this.motivo(hero, m);
        desc.innerHTML = '';
        const d1 = document.createElement('span'); d1.textContent = m.descricao || m.nome; desc.appendChild(d1);
        if (mot) { const d2 = document.createElement('em'); d2.textContent = ' ' + mot; desc.appendChild(d2); }
      };
      focus(Math.max(0, sel));
      const key = (e) => {
        const cols = getComputedStyle(grade).gridTemplateColumns.split(' ').length || 2;
        const mv = { ArrowDown: cols, ArrowUp: -cols, ArrowRight: 1, ArrowLeft: -1 }[e.code];
        if (mv) {
          e.preventDefault();
          focus((sel + mv + btns.length) % btns.length);
          FF.Audio.play('tap_sound', 0.5);
        } else if (e.code === 'Enter') {
          e.preventDefault();
          if (btns[sel] && btns[sel]._can) done(ids[sel]);
        } else if (/^Digit[1-9]$/.test(e.code)) {
          const i = +e.code.slice(5) - 1;
          if (btns[i] && btns[i]._can) done(ids[i]);
        }
      };
      const done = (id) => {
        window.removeEventListener('keydown', key, true);
        box.classList.remove('open');
        FF.Audio.play('decide_charasel', 0.6);
        resolve(id);
      };
      window.addEventListener('keydown', key, true);
      box.classList.add('open');
    });
  },
  // escolha do alvo quando há vários inimigos de pé (setas/números/clique)
  chooseTarget(foes, battle) {
    return new Promise(resolve => {
      const box = document.getElementById('menu');
      box.innerHTML = '';
      box.classList.add('alvos');
      const tit = document.createElement('div');
      tit.className = 'cmd-titulo';
      tit.textContent = '🎯 Escolha o alvo';
      box.appendChild(tit);
      const grade = document.createElement('div');
      grade.className = 'cmd-golpes';
      box.appendChild(grade);
      let sel = 0;
      const btns = foes.map((f, i) => {
        const b = document.createElement('button');
        b.className = 'alvo';
        const cv = document.createElement('canvas');
        cv.width = 40; cv.height = 56;
        b.appendChild(cv);
        const t = document.createElement('span');
        t.className = 'nome';
        t.innerHTML = '';
        t.textContent = f.nome;
        const v = document.createElement('small');
        v.textContent = 'Vida ' + Math.ceil(f.hp) + '/' + f.hpMax;
        t.appendChild(document.createElement('br'));
        t.appendChild(v);
        b.appendChild(t);
        FF.Retrato.noCanvas(cv, f.def, f.formId, 'retrato', { espelhar: true });
        b.onclick = () => done(i);
        b.onmouseenter = () => focus(i);
        grade.appendChild(b);
        return b;
      });
      const focus = (i) => { sel = i; battle.alvoMarcado = foes[i]; btns.forEach((b, k) => b.classList.toggle('sel', k === i)); };
      focus(0);
      const key = (e) => {
        if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.code)) { e.preventDefault(); focus((sel + (e.code === 'ArrowDown' || e.code === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length); FF.Audio.play('tap_sound', 0.5); }
        else if (e.code === 'Enter') { e.preventDefault(); done(sel); }
        else if (/^Digit[1-9]$/.test(e.code)) { const i = +e.code.slice(5) - 1; if (btns[i]) done(i); }
      };
      const done = (i) => {
        window.removeEventListener('keydown', key, true);
        box.classList.remove('open', 'alvos');
        battle.alvoMarcado = null;
        FF.Audio.play('decide_charasel', 0.6);
        resolve(foes[i]);
      };
      window.addEventListener('keydown', key, true);
      box.classList.add('open');
    });
  },
  meets(hero, req) {
    if (req.forma && hero.formId !== req.forma) return false;
    if (req.semBuff && hero.buffs[req.semBuff]) return false;
    if (req.parceiro) {   // Sparking Combo: parceiro de pé e com ki suficiente
      const pf = FF.battle && FF.battle.all.find(f => f.id === req.parceiro.id && !f.ko);
      if (!pf || pf.ki < (req.parceiro.ki || 0)) return false;
    }
    return true;
  },
  showEnd(win) {
    const el = document.getElementById('fim');
    el.querySelector('h2').textContent = win ? 'Vitória!' : 'Derrota...';
    el.classList.add('open');
  },
};

// Ajusta a largura lógica do jogo à proporção da tela (celulares compridos ganham campo mais largo
// em vez de faixas pretas). Altura fixa em 580; largura entre 1084 e 1300.
FF.ajustarTela = function () {
  const canvas = document.getElementById('tela');
  const asp = Math.max(1084 / 580, Math.min(1300 / 580, window.innerWidth / Math.max(1, window.innerHeight)));
  FF.W = Math.round(580 * asp);
  canvas.width = FF.W;
  document.getElementById('jogo').style.setProperty('--asp', (FF.W / 580).toFixed(4));
};

FF.start = async function (escolhida) {
  const canvas = document.getElementById('tela');
  FF.ajustarTela();
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  FF.Input.init(canvas);

  const params = new URLSearchParams(location.search);
  let def;
  if (escolhida && typeof escolhida === 'object') def = escolhida;     // Batalha Livre (montada na seleção)
  else def = await FF.Assets.loadJSON('data/battles/' + (params.get('batalha') || escolhida || 'saiyajin_01') + '.json');
  const stage = await FF.Assets.loadJSON('data/stages/' + def.cenario + '.json');

  // personagens e todos os sprites de todas as formas (transformação sem espera)
  const heroDefs = await Promise.all(def.herois.map(id => FF.Assets.loadCharacter(id)));
  const foeDefs = await Promise.all(def.inimigos.map(id => FF.Assets.loadCharacter(id)));
  const spriteIds = new Set(['fx', 'fx_extra', 'hud_zl3', 'retratos', stage.sprite]);
  heroDefs.concat(foeDefs).forEach(c => Object.values(c.formas).forEach(f => spriteIds.add(f.sprite)));
  await Promise.all([...spriteIds].map(id => FF.Assets.loadSprite(id)));
  // animações derivadas: sprites incompletos (ex.: Saibaman só tem ataques) ganham parado/dano/caído
  // montados a partir de quadros de outras animações ({"Parado": {"de": "Ataque_1", "quadros": [0, 1], "fps": 4, "loop": true}})
  heroDefs.concat(foeDefs).forEach(c => Object.values(c.formas).forEach(f => {
    const set = FF.Assets.sprites[f.sprite];
    for (const [nome, d] of Object.entries(f.animsDerivadas || {})) {
      if (set.has(nome) || !set.has(d.de)) continue;
      const src = set.anim(d.de);
      set.def.anims[nome] = { fps: d.fps || 0, loop: !!d.loop, repeatTo: 0, pingpong: false,
        frames: d.quadros.map(i => src.frames[Math.min(i, src.frames.length - 1)]) };
    }
  }));

  // habilidades criadas pelo usuário no editor (equipadas) entram no menu de golpes
  if (FF.Habilidades) {
    new Set(heroDefs.concat(foeDefs)).forEach(c => FF.Habilidades.sincronizar(c));
    await FF.Habilidades.preparar(heroDefs.concat(foeDefs)).catch(() => null);
  }

  const battle = new FF.Battle(def, stage, FF.UI);
  heroDefs.forEach((c, i) => battle.addFighter(c, 'heroi', i));
  foeDefs.forEach((c, i) => battle.addFighter(c, 'inimigo', i));
  FF.battle = battle;

  let last = performance.now();
  function frame(now) {
    const real = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dt = FF.Clock.tick(real);
    battle.update(dt);
    ctx.imageSmoothingEnabled = false;
    battle.draw(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return battle;
};

// ---------- progresso salvo (localStorage pode não existir: aba anônima, file:// bloqueado...) ----------
FF.Save = {
  KEY: 'finalflash_save_v1',
  get() { try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch (e) { return {}; } },
  set(dados) { try { localStorage.setItem(this.KEY, JSON.stringify(Object.assign(this.get(), dados))); } catch (e) { /* sem salvamento */ } },
  apagar() { try { localStorage.removeItem(this.KEY); } catch (e) { /* nada */ } },
};

// ---------- AP e treinamento: vitórias dão AP, que compra níveis de atributo por herói ----------
FF.Treino = {
  herois: { goku: 'Goku', piccolo: 'Piccolo', krillin: 'Kuririn' },
  // passo por nível (multiplicativo, exceto kiPorTurno que soma)
  attrs: {
    hp: { nome: 'Vida', passo: 0.08 },
    ataque: { nome: 'Ataque', passo: 0.06 },
    defesa: { nome: 'Defesa', passo: 0.10 },
    kiPorTurno: { nome: 'Ki/turno', soma: 1 },
  },
  max: 5,
  custo(nivel) { return 40 * (nivel + 1); },
  nivel(heroi, attr) { return ((FF.Save.get().treino || {})[heroi] || {})[attr] || 0; },
  comprar(heroi, attr) {
    const save = FF.Save.get(), n = this.nivel(heroi, attr), c = this.custo(n);
    if (n >= this.max || (save.ap || 0) < c) return false;
    const treino = save.treino || {};
    treino[heroi] = Object.assign({}, treino[heroi], { [attr]: n + 1 });
    FF.Save.set({ ap: save.ap - c, treino });
    return true;
  },
  // atributos com as melhorias aplicadas (usado em Battle.addFighter para heróis)
  aplicar(id, atributos) {
    if (!this.herois[id]) return atributos;
    const a = Object.assign({}, atributos);
    for (const [k, d] of Object.entries(this.attrs)) {
      const n = this.nivel(id, k);
      if (!n || a[k] == null) continue;
      a[k] = d.soma ? a[k] + d.soma * n : Math.round(a[k] * (1 + d.passo * n));
    }
    return a;
  },
  // AP por vitória: batalha pode definir "ap"; senão 30 + 10 por 1000 de vida inimiga
  premio(battle) {
    if (battle && battle.def && battle.def.ap) return battle.def.ap;
    const vida = battle ? battle.enemies.reduce((s, e) => s + e.hpMax, 0) : 0;
    return 30 + Math.round(vida / 100);
  },
  render() {
    const save = FF.Save.get();
    document.getElementById('ap-valor').textContent = save.ap || 0;
    const lista = document.getElementById('treino-lista');
    lista.innerHTML = '';
    for (const [id, nome] of Object.entries(this.herois)) {
      const box = document.createElement('div');
      box.className = 'treino-heroi';
      box.innerHTML = '<h4>' + nome + '</h4>';
      for (const [k, d] of Object.entries(this.attrs)) {
        const n = this.nivel(id, k), c = this.custo(n);
        const row = document.createElement('div');
        row.className = 'treino-attr';
        row.innerHTML = '<span>' + d.nome + ' <span class="niv">' + '★'.repeat(n) + '<i>' + '★'.repeat(this.max - n) + '</i></span></span>';
        const bt = document.createElement('button');
        bt.textContent = n >= this.max ? 'Máx.' : c + ' AP';
        bt.disabled = n >= this.max || (save.ap || 0) < c;
        bt.onclick = (e) => {
          e.stopPropagation();
          if (this.comprar(id, k)) { FF.Audio.play('decide_charasel', 0.6); this.render(); }
        };
        row.appendChild(bt);
        box.appendChild(row);
      }
      lista.appendChild(box);
    }
  },
};

FF.aplicarVolumes = function () {
  const v = FF.Save.get().volumes;
  if (!v) return;
  FF.Audio.volMusica = v.musica; FF.Audio.volSfx = v.sfx; FF.Audio.volVoz = v.voz;
  if (FF.Audio.musica) FF.Audio.musica.volume = v.musica;
};

// ---------- diálogos do modo história ----------
FF.Dialogo = {
  async show(cap, falas, historia) {
    const el = document.getElementById('dialogo');
    const cv = el.querySelector('.retrato'), cx = cv.getContext('2d');
    const ids = [...new Set(falas.map(f => historia.retratos[f.quem]).filter(Boolean))];
    await Promise.all(ids.map(id => FF.Assets.loadSprite(id).catch(() => null)));
    el.querySelector('.cap').textContent = cap || '';
    el.classList.add('open');
    for (let i = 0; i < falas.length; i++) {
      const f = falas[i];
      const spr = historia.retratos[f.quem] && FF.Assets.sprites[historia.retratos[f.quem]];
      el.classList.toggle('sem-retrato', !spr);
      el.querySelector('.nome').textContent = historia.nomes[f.quem] || '';
      if (spr) {
        const a = spr.anim('Parado') || spr.anim(Object.keys(spr.def.anims)[0]);
        cx.clearRect(0, 0, 120, 120);
        cx.imageSmoothingEnabled = false;
        FF.drawFrame(cx, spr, a.frames[0], 60, 168, 3.2, !['goku', 'piccolo', 'krillin'].includes(f.quem), {});
      }
      const pular = await this.escrever(el.querySelector('.texto'), f.texto);
      if (pular) break;
      if (i === 0) el.querySelector('.cap').textContent = '';
    }
    el.classList.remove('open');
  },
  // efeito de máquina de escrever; 1º toque completa o texto, 2º avança. Esc pula a cena.
  escrever(box, texto) {
    return new Promise(resolve => {
      let n = 0, cheio = false;
      const tick = setInterval(() => { n += 2; box.textContent = texto.slice(0, n); if (n >= texto.length) { cheio = true; clearInterval(tick); } }, 30);
      const el = document.getElementById('dialogo');
      const avancar = () => {
        if (!cheio) { cheio = true; clearInterval(tick); box.textContent = texto; return; }
        fim(false);
      };
      const key = (e) => {
        if (e.code === 'Escape') { e.preventDefault(); fim(true); }
        else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); avancar(); }
      };
      const fim = (pular) => {
        clearInterval(tick);
        el.removeEventListener('click', avancar);
        window.removeEventListener('keydown', key, true);
        FF.Audio.play('tap_sound', 0.5);
        resolve(pular);
      };
      el.addEventListener('click', avancar);
      window.addEventListener('keydown', key, true);
    });
  },
};

// ---------- modo história: diálogo → batalha → diálogo → salva o próximo capítulo ----------
FF.jogarCapitulo = async function (n) {
  const hist = await FF.Assets.loadJSON('data/historia.json');
  const cap = hist.capitulos.find(c => c.id === n) || hist.capitulos[0];
  const intro = document.getElementById('inicio');
  intro.classList.add('hide');
  await FF.Dialogo.show(cap.titulo, cap.antes || [], hist);
  FF.modoHistoria = { hist, cap };
  const battle = await FF.start(cap.batalha);
  battle.run();
  FF.Pausa.mostrarBotao();
  FF.Voltar.armar();
};

const _showEnd = FF.UI.showEnd.bind(FF.UI);
FF.UI.showEnd = async function (win) {
  document.getElementById('bt-pausa').hidden = true;
  const mh = FF.modoHistoria;
  const apEl = document.getElementById('ap-ganho');
  if (win) {
    const ganho = FF.Treino.premio(FF.battle) * (mh ? 2 : 1);   // modo história vale o dobro
    FF.Save.set({ ap: (FF.Save.get().ap || 0) + ganho });
    apEl.textContent = '+' + ganho + ' AP (gaste em Treinamento)';
  } else apEl.textContent = '';
  if (!mh) return _showEnd(win);
  const el = document.getElementById('fim');
  const prox = mh.hist.capitulos.find(c => c.id === mh.cap.id + 1);
  if (win) {
    FF.Save.set({ capitulo: prox ? prox.id : mh.cap.id, concluidos: Math.max(FF.Save.get().concluidos || 0, mh.cap.id) });
    await FF.Dialogo.show('', mh.cap.depois || [], mh.hist);
  }
  el.classList.add('historia');
  document.getElementById('proximo').style.display = win && prox ? 'inline-block' : 'none';
  document.getElementById('denovo').textContent = win ? 'Lutar de novo' : 'Tentar de novo';
  _showEnd(win);
  if (win && !prox) el.querySelector('h2').textContent = 'Fim da Saga Saiyajin!';
};

// arte estática da tela de título: banners do Z Legends 3 (Goku de um lado, Vegeta do outro)
FF.bannersTitulo = async function () {
  try {
    const [g, v] = await Promise.all([FF.Assets.loadCharacter('goku'), FF.Assets.loadCharacter('vegeta')]);
    const e = document.querySelector('.titulo-banner.esq'), d = document.querySelector('.titulo-banner.dir');
    if (e) FF.Retrato.noCanvas(e, g, 'base', 'banner', { fundo: false });
    if (d) FF.Retrato.noCanvas(d, v, 'base', 'banner', { fundo: false, espelhar: true });
  } catch (err) { /* sem banners */ }
};

window.addEventListener('load', () => {
  FF.ajustarTela();
  FF.bannersTitulo();
  FF.aplicarVolumes();
  const intro = document.getElementById('inicio');
  const msg = document.getElementById('carregando');
  const params = new URLSearchParams(location.search);
  const ir = (q) => { location.href = location.pathname + q; };
  document.getElementById('denovo').onclick = () => location.reload();
  document.getElementById('titulo').onclick = () => ir('');
  document.getElementById('proximo').onclick = () => ir('?historia=' + (FF.modoHistoria.cap.id + 1));

  const batalhaLivre = async (id) => {
    intro.className = '';
    msg.textContent = 'Carregando...';
    try {
      const battle = await FF.start(id);
      intro.classList.add('hide');
      if (params.get('editor')) { FF.Editor.run(battle); if (params.get('hab')) FF.Editor.abrirHabilidade(params.get('hab')); }   // Editor
      else { battle.run(); FF.Pausa.mostrarBotao(); FF.Voltar.armar(); }
    } catch (err) {
      console.error(err);
      msg.textContent = 'Erro: ' + err.message;
    }
  };

  // modo história direto pela URL (?historia=N)
  if (params.get('historia')) {
    FF.jogarCapitulo(+params.get('historia')).catch(err => { console.error(err); intro.classList.remove('hide'); msg.textContent = 'Erro: ' + err.message; });
    return;
  }
  // Batalha Livre montada na seleção: guarda a definição e recarrega com ?livre=1 (assim "Lutar de novo" funciona)
  FF._iniciarLivre = (def) => ir('?livre=1');
  if (params.get('livre')) {
    let def = null;
    try { def = JSON.parse(sessionStorage.getItem('ff_livre_def') || 'null'); } catch (e) { /* nada */ }
    if (def) { batalhaLivre(def); return; }
  }
  // editar uma habilidade salva (?editor=1&hab=<id>): batalha 1x1 com o dono dela
  if (params.get('editor') && params.get('hab') && !params.get('batalha')) {
    const h = FF.Habilidades.ler()[params.get('hab')];
    if (h) {
      const rival = h.personagem === 'raditz' ? 'goku' : 'raditz';
      batalhaLivre(FF.Selecao.montarBatalha({ herois: [h.personagem], inimigos: [rival] }));
      return;
    }
  }
  // Editor direto (?editor=1&batalha=id): carrega sem precisar tocar
  if (params.get('editor')) {
    batalhaLivre(params.get('batalha') || 'saiyajin_02');
    return;
  }
  // batalha pela URL (?batalha=id): toque para começar, como antes (usado pelo teste automático)
  if (params.get('batalha')) {
    const go = () => { intro.removeEventListener('click', go); window.removeEventListener('keydown', goKey); batalhaLivre(params.get('batalha')); };
    const goKey = (e) => { if (e.code === 'Enter' || e.code === 'Space') go(); };
    intro.addEventListener('click', go);
    window.addEventListener('keydown', goKey);
    return;
  }

  // tela de título: toque → menu principal
  const mostrar = (modo) => {
    FF.Selecao && FF.Selecao.fechar();
    if (modo !== 'menu') FF.Voltar.armar();
    intro.className = modo;
    const primeiro = intro.querySelector('.menu-titulo button:not([disabled])');
    if (modo === 'treino') FF.Treino.render();
    const vis = { menu: '#titulo-menu', livre: '#escolha', opcoes: '#opcoes', treino: '#treino' }[modo];
    const bt = vis && intro.querySelector(vis + ' button:not([disabled])');
    if (bt) bt.focus(); else if (primeiro) primeiro.focus();
  };
  const abrir = (e) => {
    if (intro.className) return;
    if (e.type === 'keydown' && e.code !== 'Enter' && e.code !== 'Space') return;
    e.preventDefault();
    FF.Audio.play('menuopen', 0.7);
    window.removeEventListener('keydown', abrir);
    intro.removeEventListener('click', abrir);
    const save = FF.Save.get();
    const cont = intro.querySelector('[data-acao="continuar"]');
    cont.disabled = !save.capitulo;
    if (save.capitulo) cont.textContent = 'Continuar (Capítulo ' + save.capitulo + ')';
    mostrar('menu');
  };
  intro.addEventListener('click', abrir);
  window.addEventListener('keydown', abrir);
  FF._mostrarTitulo = mostrar;

  // setas para navegar entre os botões do menu visível
  window.addEventListener('keydown', (e) => {
    if (!intro.className || intro.classList.contains('hide')) return;
    if (e.code !== 'ArrowDown' && e.code !== 'ArrowUp') return;
    const vis = { menu: '#titulo-menu', livre: '#escolha', opcoes: '#opcoes', treino: '#treino' }[intro.className];
    if (!vis) return;
    const bts = [...intro.querySelectorAll(vis + ' button:not([disabled])')];
    if (!bts.length) return;
    const i = bts.indexOf(document.activeElement);
    const j = (i + (e.code === 'ArrowDown' ? 1 : -1) + bts.length) % bts.length;
    bts[j].focus(); e.preventDefault();
    FF.Audio.play('tap_sound', 0.4);
  });

  intro.querySelectorAll('button').forEach(bt => bt.addEventListener('click', (e) => {
    e.stopPropagation();
    FF.Audio.play('decide_charasel', 0.6);
    const ac = bt.dataset.acao;
    if (bt.dataset.batalha) return FF._modoLab ? ir('?editor=1&batalha=' + bt.dataset.batalha) : batalhaLivre(bt.dataset.batalha);
    if (ac === 'editor') { FF._modoLab = 'editor'; return mostrar('livre'); }
    if (ac === 'instalar') { FF.PWA.instalar(); return; }
    if (ac === 'visualizador') { location.href = 'visualizador.html'; return; }
    if (ac === 'novo') { FF.Save.set({ capitulo: 1 }); return ir('?historia=1'); }
    if (ac === 'continuar') return ir('?historia=' + (FF.Save.get().capitulo || 1));
    if (ac === 'livre') { FF._modoLab = false; intro.className = 'selecao'; FF.Selecao.abrir(); FF.Voltar.armar(); return; }
    if (ac === 'treino') return mostrar('treino');
    if (ac === 'voltar') return mostrar('menu');
    if (ac === 'apagar') {
      if (confirm('Apagar o progresso (capítulos, AP e treinamento)?')) { const v = FF.Save.get().volumes; FF.Save.apagar(); if (v) FF.Save.set({ volumes: v }); }
      return;
    }
    if (ac === 'opcoes') {
      const v = FF.Save.get().volumes || { musica: FF.Audio.volMusica, sfx: FF.Audio.volSfx, voz: FF.Audio.volVoz };
      document.getElementById('vol-musica').value = Math.round(v.musica * 100);
      document.getElementById('vol-sfx').value = Math.round(v.sfx * 100);
      document.getElementById('vol-voz').value = Math.round(v.voz * 100);
      return mostrar('opcoes');
    }
  }));
  ['vol-musica', 'vol-sfx', 'vol-voz'].forEach(id => document.getElementById(id).addEventListener('input', () => {
    FF.Save.set({ volumes: {
      musica: document.getElementById('vol-musica').value / 100,
      sfx: document.getElementById('vol-sfx').value / 100,
      voz: document.getElementById('vol-voz').value / 100 } });
    FF.aplicarVolumes();
    if (id === 'vol-sfx') FF.Audio.play('tap_sound');
    if (id === 'vol-voz') FF.Audio.voice('vgkn400');
  }));
});
