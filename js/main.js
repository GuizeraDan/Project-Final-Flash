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

  chooseMove(hero, battle, opts = {}) {
    if (FF.MenuGolpes && FF.MenuGolpes.estilo() !== 'lista') return FF.MenuGolpes.escolher(hero, battle, opts);
    return new Promise(resolve => {
      const box = document.getElementById('menu');
      box.innerHTML = '';
      box.className = 'cmd-compacto';   // faixa baixa no meio da tela (entre os lutadores)
      this.cabecalho(box, hero, 'KI ' + Math.floor(hero.ki) + '/' + hero.kiMax + '  ·  Fúria ' + Math.floor(hero.rage) + '%');
      const grade = document.createElement('div');
      grade.className = 'cmd-golpes';
      box.appendChild(grade);
      const desc = document.createElement('div');
      desc.className = 'cmd-desc';
      box.querySelector('.cmd-topo').appendChild(desc);   // descrição na mesma linha do nome
      const ids = hero.form.golpes.filter(id => hero.def.golpes[id] && this.visivel(hero, hero.def.golpes[id]));
      grade.style.gridTemplateColumns = 'repeat(' + Math.max(2, Math.min(6, ids.length <= 8 ? 4 : Math.ceil(ids.length / 2))) + ', 1fr)';
      const btns = [];
      ids.forEach((id, i) => {
        const m = hero.def.golpes[id];
        const b = document.createElement('button');
        b.innerHTML = '<span class="n">' + (i + 1) + '</span><span class="ic">' + this.icone(m) + '</span><span class="nome"></span>' +
          (m.custoKi ? '<span class="ki">' + m.custoKi + '</span>' : '');
        b.querySelector('.nome').textContent = m.nome;
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
        } else if (e.code === 'Escape' && opts.voltar) {
          e.preventDefault(); done('__voltar');
        } else if (e.code === 'Enter') {
          e.preventDefault();
          if (btns[sel] && btns[sel]._can) done(ids[sel]);
        } else if (/^Digit[1-9]$/.test(e.code)) {
          const i = +e.code.slice(5) - 1;
          if (btns[i] && btns[i]._can) done(ids[i]);
        }
      };
      if (opts.voltar) {   // modo Planejamento: voltar ao herói anterior
        const bv = document.createElement('button'); bv.className = 'cmd-voltar'; bv.textContent = '↩ Voltar (herói anterior)';
        bv.onclick = () => done('__voltar');
        box.querySelector('.cmd-topo').appendChild(bv);
      }
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
  // escolha do alvo quando há vários inimigos de pé: clique (ou toque) no próprio inimigo na tela; teclado: setas/números + Enter.
  // "↩ Trocar golpe" / Esc / Backspace devolve null: quem chamou volta para o menu de golpes do mesmo lutador
  chooseTarget(foes, battle) {
    return new Promise(resolve => {
      const box = document.getElementById('menu');
      const canvas = document.getElementById('tela');
      box.innerHTML = '';
      box.classList.remove('cmd-compacto');
      box.classList.add('alvos');
      const tit = document.createElement('div');
      tit.className = 'cmd-titulo';
      tit.textContent = '🎯 Clique no inimigo que vai atacar';
      box.appendChild(tit);
      const bv = document.createElement('button');
      bv.className = 'cmd-voltar alvo-voltar';
      bv.textContent = '↩ Trocar golpe';
      bv.title = 'Voltar e escolher outro golpe (Esc)';
      bv.onclick = () => done(-1);
      box.appendChild(bv);
      let sel = -1;
      const focus = (i) => {
        if (i === sel) return;
        sel = i; battle.alvoMarcado = i >= 0 ? foes[i] : null;
        if (i >= 0) FF.Audio.play('tap_sound', 0.35);
      };
      // ponto da tela → lutador (caixa do corpo; sobrepostos: ganha o que está mais na frente)
      const naTela = (e) => {
        const r = canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width * FF.W, y = (e.clientY - r.top) / r.height * FF.H;
        let melhor = -1, frente = -Infinity;
        foes.forEach((f, i) => {
          const fr = f.anim.frame();
          const alto = (fr ? fr[6] : 60) * f.scale * (f.escExtra || 1), larg = Math.max(34 * f.scale, (fr ? fr[5] : 40) * f.scale * 0.6);
          const fx = f.x + (f.offX || 0), fy = f.y + (f.offY || 0);
          if (x >= fx - larg / 2 - 8 && x <= fx + larg / 2 + 8 && y >= fy - alto - 14 && y <= fy + 10 && f.groundY > frente) { frente = f.groundY; melhor = i; }
        });
        return melhor;
      };
      const mover = (e) => { const i = naTela(e); canvas.style.cursor = i >= 0 ? 'pointer' : ''; if (i >= 0) focus(i); };
      const clicar = (e) => { const i = naTela(e); if (i >= 0) { e.preventDefault(); e.stopPropagation(); done(i); } };
      canvas.addEventListener('pointermove', mover);
      canvas.addEventListener('pointerdown', clicar, true);
      const key = (e) => {
        if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.code)) { e.preventDefault(); focus(((sel < 0 ? 0 : sel) + (e.code === 'ArrowDown' || e.code === 'ArrowRight' ? 1 : -1) + foes.length) % foes.length); }
        else if (e.code === 'Enter') { e.preventDefault(); done(sel < 0 ? 0 : sel); }
        else if (/^Digit[1-9]$/.test(e.code)) { const i = +e.code.slice(5) - 1; if (foes[i]) done(i); }
        else if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); e.stopPropagation(); done(-1); }
      };
      const done = (i) => {
        window.removeEventListener('keydown', key, true);
        canvas.removeEventListener('pointermove', mover);
        canvas.removeEventListener('pointerdown', clicar, true);
        canvas.style.cursor = '';
        box.classList.remove('open', 'alvos');
        battle.alvoMarcado = null; battle.escolhendoAlvo = null;
        FF.Audio.play(i < 0 ? 'tap_sound' : 'decide_charasel', 0.6);
        resolve(i < 0 ? null : foes[i]);
      };
      battle.escolhendoAlvo = foes;   // o HUD marca todos os que podem ser escolhidos
      window.addEventListener('keydown', key, true);
      box.classList.add('open');
    });
  },
  // golpes que só aparecem em certa situação: "mostrar": {"buff": "kaioken"} / "esconder": {"buff": "kaioken"}
  visivel(hero, m) {
    const tem = (c) => (!c.buff || hero.buffs[c.buff]) && (!c.forma || hero.formId === c.forma);
    if (m.mostrar && !tem(m.mostrar)) return false;
    if (m.esconder && tem(m.esconder)) return false;
    // Sparking Combo só aparece se o parceiro está no mesmo time (caído ou sem ki = aparece bloqueado)
    if (m.requer && m.requer.parceiro && FF.battle && FF.battle.all) {
      const time = hero.side || hero.lado;
      if (!FF.battle.all.some(f => f !== hero && f.id === m.requer.parceiro.id && (f.side || f.lado) === time)) return false;
    }
    return true;
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
    el.classList.toggle('derrota', !win);
    el.classList.add('open');
    const b = el.querySelector('button:not([style*="none"])'); if (b) setTimeout(() => b.focus({ preventScroll: true }), 50);
  },
};

// Ajusta a largura lógica do jogo à proporção da tela (celulares compridos ganham campo mais largo
// em vez de faixas pretas). Altura fixa em 580; largura entre 1084 e 1300.
FF.ajustarTela = function () {
  const canvas = document.getElementById('tela');
  const asp = Math.max(1084 / 580, Math.min(1300 / 580, window.innerWidth / Math.max(1, window.innerHeight)));
  FF.W = Math.round(580 * asp);
  // resolução interna maior que a lógica (FF.W × 580): o jogo continua desenhando em 1084×580, mas a tela
  // tem N× mais pixels, então o HUD, os textos e a arte em alta não ficam borrados ao ampliar
  const dpr = window.devicePixelRatio || 1;
  let R = Math.ceil(Math.max(window.innerWidth * dpr / FF.W, window.innerHeight * dpr / 580));
  R = Math.max(1, Math.min(2, R));   // 3× pesava demais em telas grandes (2560×1440 = 5 milhões de pixels por quadro)
  while (R > 1 && FF.W * R * 580 * R > 9e6) R--;   // limite de pixels (aparelhos fracos)
  FF.RES = R;
  canvas.width = FF.W * R;
  canvas.height = 580 * R;
  document.getElementById('jogo').style.setProperty('--asp', (FF.W / 580).toFixed(4));
};
// girar o celular / mudar o tamanho da janela: recalcula a resolução (o tamanho lógico só muda ao abrir a luta)
window.addEventListener('resize', () => {
  const c = document.getElementById('tela'); if (!c || !FF.W) return;
  const dpr = window.devicePixelRatio || 1;
  let R = Math.max(1, Math.min(3, Math.ceil(Math.max(window.innerWidth * dpr / FF.W, window.innerHeight * dpr / 580))));
  while (R > 1 && FF.W * R * 580 * R > 9e6) R--;
  if (R !== FF.RES) { FF.RES = R; c.width = FF.W * R; c.height = 580 * R; }
});

FF.start = async function (escolhida) {
  const canvas = document.getElementById('tela');
  FF.ajustarTela();
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  FF.Input.init(canvas);

  const params = new URLSearchParams(location.search);
  FF.Audio.prepararLocais();   // sons importados no Estúdio que ainda não subiram (cópia deste aparelho)
  let def;
  if (escolhida && typeof escolhida === 'object') def = escolhida;     // Batalha Livre (montada na seleção)
  else def = await FF.Assets.loadJSON('data/battles/' + (params.get('batalha') || escolhida || 'saiyajin_01') + '.json');
  const stage = await FF.Assets.loadJSON('data/stages/' + def.cenario + '.json');

  // personagens e todos os sprites de todas as formas (transformação sem espera)
  const heroDefs = await Promise.all(def.herois.map(id => FF.Assets.loadCharacter(id)));
  const foeDefs = await Promise.all(def.inimigos.map(id => FF.Assets.loadCharacter(id)));
  const spriteIds = new Set(['fx', 'fx_extra', 'hud_zl3', 'retratos', stage.sprite]);
  heroDefs.concat(foeDefs).forEach(c => Object.values(c.formas).forEach(f => spriteIds.add(f.sprite)));
  // sprites de outros personagens usados em golpes (efeitos/animações emprestadas no Estúdio)
  heroDefs.concat(foeDefs).forEach(c => Object.values(c.golpes || {}).forEach(g => {
    (g.spritesUsados || []).forEach(id => spriteIds.add(id));
    const j = JSON.stringify(g.roteiro || []);
    (j.match(/"sprite":"[^"]+"/g) || []).forEach(m => spriteIds.add(m.slice(10, -1)));
  }));
  if (FF.Habilidades) FF.Habilidades.listar().forEach(h => (h.golpe.spritesUsados || []).forEach(id => spriteIds.add(id)));
  await Promise.all([...spriteIds].map(id => FF.Assets.loadSprite(id)).concat(FF.Assets.loadImage('assets/img/hud_moderno.png').catch(() => null)));   // HUD novo (arte do usuário)
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

  // habilidades criadas pelo usuário no Estúdio (equipadas) entram no menu de golpes
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
    ctx.setTransform(FF.RES || 1, 0, 0, FF.RES || 1, 0, 0);   // desenha em coordenadas lógicas (1084×580)
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

// ---------- Novo Jogo: escolha do capítulo (os já liberados) ----------
FF.NovoJogo = {
  // sagas do modo história (só a Saiyajin existe por enquanto; as outras aparecem como "Em produção")
  SAGAS: [{ id: 'saiyajin', nome: 'Saga Saiyajin', arquivo: 'data/historia.json' }, null, null, null],

  // 1º passo: escolher a saga
  async abrir(mostrar, ir) {
    this.saga = null;
    this._mostrar = mostrar; this._ir = ir;
    const save = FF.Save.get();
    const box = document.getElementById('capitulos');
    const dica = document.querySelector('#novojogo .sub-dica');
    box.innerHTML = '';
    dica.textContent = 'Escolha a saga';
    for (const sg of this.SAGAS) {
      const b = document.createElement('button');
      b.className = 'cap-bt' + (sg ? '' : ' em-producao');
      b.innerHTML = '<span><b></b><i></i></span>';
      if (sg) {
        const hist = await FF.Assets.loadJSON(sg.arquivo);
        const n = hist.capitulos.length, feitos = Math.min(n, save.concluidos || 0);
        b.querySelector('b').textContent = sg.nome;
        b.querySelector('i').textContent = n + ' capítulos' + (feitos ? ' · ' + feitos + ' concluído(s)' : '');
        if (feitos >= n) b.classList.add('feito');
        b.onclick = (e) => { e.stopPropagation(); FF.Audio.play('decide_charasel', 0.6); this.capitulos(sg, mostrar, ir); };
      } else {
        b.querySelector('b').textContent = '🚧 Em produção';
        b.querySelector('i').textContent = 'Nova saga em breve';
        b.disabled = true;
      }
      b.addEventListener('mouseenter', () => { if (!b.disabled) b.focus({ preventScroll: true }); });
      box.appendChild(b);
    }
    mostrar('novojogo');
  },

  // 2º passo: capítulos da saga escolhida
  async capitulos(sg, mostrar, ir) {
    const hist = await FF.Assets.loadJSON(sg.arquivo);
    const save = FF.Save.get();
    const liberado = Math.min(hist.capitulos.length, (save.concluidos || 0) + 1);
    const box = document.getElementById('capitulos');
    document.querySelector('#novojogo .sub-dica').textContent = sg.nome + ' · escolha por onde começar';
    box.innerHTML = '';
    hist.capitulos.forEach(c => {
      const b = document.createElement('button');
      b.className = 'cap-bt';
      const ok = c.id <= liberado;
      const [num, nome] = String(c.titulo || ('Capítulo ' + c.id)).split(/\s+—\s+/);
      b.innerHTML = '<span><b>' + (ok ? '' : '🔒 ') + num + '</b><i></i></span>';
      b.querySelector('i').textContent = ok ? (nome || '') : 'Vença o capítulo anterior para liberar';
      b.disabled = !ok;
      if ((save.concluidos || 0) >= c.id) b.classList.add('feito');
      b.addEventListener('mouseenter', () => { if (!b.disabled) b.focus({ preventScroll: true }); });
      b.onclick = (e) => {
        e.stopPropagation();
        FF.Audio.play('decide_charasel', 0.6);
        if (c.id === 1 && save.capitulo > 1 && !confirm('Começar do capítulo 1? Seu progresso de capítulos continua salvo (Continuar volta para o capítulo ' + save.capitulo + ').')) return;
        FF.Save.set({ capitulo: c.id });
        ir('?historia=' + c.id);
      };
      box.appendChild(b);
    });
    this.saga = sg;   // "Voltar" volta para a escolha da saga
    mostrar('novojogo');
  },
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
  // ---------- pergaminhos de técnica: golpes sobem de nível (I → II → III) ----------
  NIVEL_MAX: 3,
  custoTec(nivel) { return nivel === 1 ? 2 : 4; },   // pergaminhos para ir do nível atual ao próximo
  nivelTec(heroi, golpe) { return ((FF.Save.get().tecnicas || {})[heroi] || {})[golpe] || 1; },
  subirTec(heroi, golpe) {
    const save = FF.Save.get(), n = this.nivelTec(heroi, golpe), c = this.custoTec(n);
    if (n >= this.NIVEL_MAX || (save.pergaminhos || 0) < c) return false;
    const tec = save.tecnicas || {};
    tec[heroi] = Object.assign({}, tec[heroi], { [golpe]: n + 1 });
    FF.Save.set({ pergaminhos: save.pergaminhos - c, tecnicas: tec });
    return true;
  },
  // golpes que podem subir: os de ataque das formas do herói
  golpesTec(def) {
    const ids = new Set(); Object.values(def.formas).forEach(f => (f.golpes || []).forEach(g => ids.add(g)));
    return [...ids].filter(g => def.golpes[g] && !g.startsWith('hab_') && FF.Battle.ofensivo(def.golpes[g]) && !(def.golpes[g].requer && def.golpes[g].requer.parceiro));
  },
  // aplica os níveis nos golpes (cópia: o personagem carregado não muda). +15% de dano por nível, efeito maior
  aplicarTec(id, golpes) {
    if (!this.herois[id] || !golpes) return golpes;
    const tec = (FF.Save.get().tecnicas || {})[id] || {};
    if (!Object.keys(tec).length) return golpes;
    const g2 = Object.assign({}, golpes);
    for (const [k, n] of Object.entries(tec)) {
      if (!g2[k] || n <= 1) continue;
      g2[k] = Object.assign({}, g2[k], { poder: (g2[k].poder || 1) * (1 + 0.15 * (n - 1)), nivelTec: n, nome: g2[k].nome + (n === 2 ? ' II' : ' III') });
    }
    return g2;
  },
  premioPergaminhos(battle, historia) { return (historia ? 2 : 1) + (battle && battle.enemies.some(e => e.hpMax >= 2500) ? 1 : 0); },

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
    const pv = document.getElementById('perg-valor'); if (pv) pv.textContent = save.pergaminhos || 0;
    const lista = document.getElementById('treino-lista');
    lista.innerHTML = '';
    for (const [id, nome] of Object.entries(this.herois)) {
      const box = document.createElement('div');
      box.className = 'treino-heroi';
      box.innerHTML = '<div class="treino-cab"><canvas width="40" height="56"></canvas><h4>' + nome + '</h4></div>';
      const cv = box.querySelector('canvas');
      FF.Assets.loadCharacter(id).then(d => FF.Retrato && FF.Retrato.noCanvas(cv, d, d.formaInicial, 'retrato')).catch(() => {});
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
      // cápsulas (2 por herói)
      const capBox = document.createElement('div'); capBox.className = 'treino-tec';
      capBox.innerHTML = '<h5>🎒 Cápsulas</h5>';
      const eq = FF.Capsulas.equipadas(id);
      for (let sl = 0; sl < 2; sl++) {
        const sel = document.createElement('select'); sel.className = 'treino-cap';
        sel.innerHTML = '<option value="">— vazio —</option>' + Object.entries(FF.Capsulas.LISTA).map(([k, c]) => '<option value="' + k + '">' + c.ic + ' ' + c.nome + '</option>').join('');
        sel.value = eq[sl] || '';
        sel.title = eq[sl] ? FF.Capsulas.LISTA[eq[sl]].desc : 'Escolha uma cápsula';
        sel.onclick = (e) => e.stopPropagation();
        sel.onchange = (e) => { e.stopPropagation(); FF.Capsulas.equipar(id, sl, sel.value); FF.Audio.play('tap_sound'); this.render(); };
        capBox.appendChild(sel);
      }
      const dsc = document.createElement('small'); dsc.className = 'treino-cap-desc';
      dsc.textContent = eq.map(c => FF.Capsulas.LISTA[c].ic + ' ' + FF.Capsulas.LISTA[c].desc).join('  ') || 'Cápsulas dão vantagens na luta.';
      capBox.appendChild(dsc);
      box.appendChild(capBox);
      // técnicas (pergaminhos)
      const tecBox = document.createElement('div'); tecBox.className = 'treino-tec';
      tecBox.innerHTML = '<h5>📜 Técnicas</h5>';
      box.appendChild(tecBox);
      FF.Assets.loadCharacter(id).then(def => {
        for (const g of this.golpesTec(def)) {
          const n = this.nivelTec(id, g), c = this.custoTec(n);
          const row = document.createElement('div'); row.className = 'treino-attr';
          row.innerHTML = '<span></span>';
          row.querySelector('span').textContent = def.golpes[g].nome + ' ' + ['I', 'II', 'III'][n - 1];
          const bt = document.createElement('button');
          bt.textContent = n >= this.NIVEL_MAX ? 'Máx.' : c + ' 📜';
          bt.disabled = n >= this.NIVEL_MAX || (FF.Save.get().pergaminhos || 0) < c;
          bt.title = '+15% de dano e efeito maior por nível';
          bt.onclick = (e) => { e.stopPropagation(); if (this.subirTec(id, g)) { FF.Audio.play('decide_charasel', 0.6); this.render(); } };
          row.appendChild(bt); tecBox.appendChild(row);
        }
      }).catch(() => {});
      lista.appendChild(box);
    }
  },
};

// ---------- cápsulas: 2 por herói, equipadas no Treinamento ----------
FF.Capsulas = {
  LISTA: {
    senzu: { ic: '🌱', nome: 'Semente dos Deuses', desc: '1 vez por luta: com menos de 30% de vida, recupera tudo no fim do turno.' },
    radar: { ic: '📡', nome: 'Radar do Dragão', desc: 'Mostra as fraquezas de todos os inimigos desde o começo.' },
    peso: { ic: '🏋', nome: 'Peso de Treino', desc: '−10% de velocidade, mas +30% de AP ao vencer.' },
    armadura: { ic: '🛡', nome: 'Armadura Saiyajin', desc: 'Recebe 10% menos dano.' },
    kiplus: { ic: '🔋', nome: 'Cápsula de Ki', desc: 'Começa a luta com +30 de ki.' },
    faixa: { ic: '🎗', nome: 'Faixa do Senhor Kaio', desc: 'Começa a luta com 1 Ponto de Impulso.' },
  },
  equipadas(heroi) { return (((FF.Save.get().capsulas || {})[heroi]) || []).filter(c => this.LISTA[c]).slice(0, 2); },
  equipar(heroi, slot, cap) {
    const caps = FF.Save.get().capsulas || {};
    const l = (caps[heroi] || []).slice(0, 2); while (l.length < 2) l.push('');
    l[slot] = cap; if (cap && l[1 - slot] === cap) l[1 - slot] = '';
    caps[heroi] = l; FF.Save.set({ capsulas: caps });
  },
};

// ---------- nota do fim da luta (S a D) e bônus ----------
FF.Nota = {
  calcular(b) {
    const st = b.stats || {}, bon = [];
    let pts = 40;
    const vidaHerois = b.heroes.reduce((s, h) => s + h.hpMax, 0) || 1;
    if (!st.danoRecebido) { pts += 25; bon.push('Sem levar dano'); } else pts += Math.max(0, 25 - 50 * st.danoRecebido / vidaHerois);
    if (st.guardasPerfeitas >= 5) { pts += 10; bon.push(st.guardasPerfeitas + ' guardas perfeitas'); } else if (st.guardasPerfeitas >= 2) pts += 5;
    if (st.criticos >= 3) { pts += 5; bon.push(st.criticos + ' críticos'); }
    if (st.maiorCombo >= 8) { pts += 5; bon.push('combo de ' + st.maiorCombo + ' hits'); }
    if (st.quebras) { pts += Math.min(15, 5 * st.quebras); bon.push('Quebra de guarda ×' + st.quebras); }
    if (st.supremoFinal) { pts += 10; bon.push('Venceu com supremo'); }
    if (st.ataqueZ) { pts += 5; bon.push('Ataque Z'); }
    if (st.embates) { pts += Math.min(10, 5 * st.embates); bon.push('Venceu ' + st.embates + ' embate(s) de raios'); }
    if (st.contra) bon.push(st.contra + ' contra-ataque(s)');
    if (st.rodadas && st.rodadas <= 3) { pts += 10; bon.push('Vitória rápida'); } else if (st.rodadas && st.rodadas <= 6) pts += 5;
    const nota = pts >= 90 ? 'S' : pts >= 75 ? 'A' : pts >= 60 ? 'B' : pts >= 45 ? 'C' : 'D';
    return { nota, pts: Math.round(pts), bonus: bon, multAP: { S: 1.5, A: 1.3, B: 1.15, C: 1, D: 1 }[nota] };
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
  if (FF.battle && FF.battle.def && FF.battle.def.treino) {   // treino: sem nota nem prêmio
    apEl.textContent = 'Treino concluído (treino não dá AP)';
    const nEl = document.getElementById('nota'); if (nEl) nEl.innerHTML = '';
    return _showEnd(win);
  }
  if (win) {
    const nt = FF.Nota.calcular(FF.battle);
    const peso = FF.battle.heroes.some(h => (h.capsulas || []).includes('peso')) ? 1.3 : 1;
    const ganho = Math.round(FF.Treino.premio(FF.battle) * (mh ? 2 : 1) * nt.multAP * peso);   // modo história vale o dobro
    const perg = FF.Treino.premioPergaminhos(FF.battle, !!mh) + (nt.nota === 'S' ? 1 : 0);
    const nEl = document.getElementById('nota');
    if (nEl) {
      nEl.innerHTML = '<b class="nota-' + nt.nota + '">' + nt.nota + '</b><div></div>';
      const lst = nEl.querySelector('div');
      nt.bonus.forEach(t => { const i = document.createElement('i'); i.textContent = '★ ' + t; lst.appendChild(i); });
      if (nt.multAP > 1) { const i = document.createElement('i'); i.className = 'ap'; i.textContent = 'AP ×' + String(nt.multAP).replace('.', ','); lst.appendChild(i); }
    }
    FF.Save.set({ ap: (FF.Save.get().ap || 0) + ganho, pergaminhos: (FF.Save.get().pergaminhos || 0) + perg });
    apEl.textContent = '+' + ganho + ' AP · +' + perg + ' 📜 (gaste em Personalização)';
  } else { apEl.textContent = ''; const nEl = document.getElementById('nota'); if (nEl) nEl.innerHTML = ''; }
  if (!mh) return _showEnd(win);
  const el = document.getElementById('fim');
  const prox = mh.hist.capitulos.find(c => c.id === mh.cap.id + 1);
  if (win) {
    FF.Save.set({ capitulo: prox ? prox.id : mh.cap.id, concluidos: Math.max(FF.Save.get().concluidos || 0, mh.cap.id) });
    await FF.Dialogo.show('', mh.cap.depois || [], mh.hist);
  }
  el.classList.add('historia');
  document.getElementById('proximo').style.display = win && prox ? 'inline-block' : 'none';
  (document.querySelector('#denovo span') || document.getElementById('denovo')).textContent = win ? 'Lutar de novo' : 'Tentar de novo';
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
  document.getElementById('trocar').onclick = () => ir(FF.battle && FF.battle.def && FF.battle.def.treino ? '?treinar=1' : '?selecao=1');
  document.querySelectorAll('#fim button').forEach(bt => { if (!bt.querySelector('span')) { const sp = document.createElement('span'); sp.textContent = bt.textContent; bt.textContent = ''; bt.appendChild(sp); } });
  document.getElementById('proximo').onclick = () => ir('?historia=' + (FF.modoHistoria.cap.id + 1));

  const batalhaLivre = async (id) => {
    intro.className = '';
    msg.textContent = 'Carregando...';
    try {
      const battle = await FF.start(id);
      intro.classList.add('hide');
      battle.run(); FF.Pausa.mostrarBotao(); FF.Voltar.armar();
    } catch (err) {
      console.error(err);
      msg.textContent = 'Erro: ' + err.message;
    }
  };

  // endereços do Editor antigo (removido): vão para o Estúdio
  if (params.get('editor')) {
    location.replace('estudio.html?aba=golpes' + (params.get('hab') ? '&hab=' + encodeURIComponent(params.get('hab')) : ''));
    return;
  }
  // modo história direto pela URL (?historia=N)
  // volta direto para a escolha de lutadores da Batalha Livre (botão "Trocar lutadores" no fim da luta)
  if (params.get('selecao')) {
    history.replaceState(null, '', location.pathname);
    intro.className = 'selecao'; FF.Selecao.abrir(); FF.Voltar.armar();
    return;
  }
  if (params.get('historia')) {
    FF.jogarCapitulo(+params.get('historia')).catch(err => { console.error(err); intro.classList.remove('hide'); msg.textContent = 'Erro: ' + err.message; });
    return;
  }
  // Batalha Livre montada na seleção: guarda a definição e recarrega com ?livre=1 (assim "Lutar de novo" funciona)
  FF._iniciarLivre = (def) => ir('?livre=1');
  if (params.get('livre')) {
    let def = null;
    try { def = JSON.parse(sessionStorage.getItem('ff_livre_def') || 'null'); } catch (e) { /* nada */ }
    if (def) {
      document.getElementById('fim').classList.add('livre');
      if (def.treino) (document.querySelector('#trocar span') || document.getElementById('trocar')).textContent = 'Mudar treino';
      batalhaLivre(def); return;
    }
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
    const vis = { menu: '#titulo-menu', livre: '#escolha', opcoes: '#opcoes', treino: '#treino', ferramentas: '#ferramentas', novojogo: '#novojogo' }[modo];
    const bt = vis && (modo === 'opcoes' ? intro.querySelector('#opcoes [data-acao="voltar"]') : intro.querySelector(vis + ' button:not([disabled])'));
    if (bt) bt.focus(); else if (primeiro) primeiro.focus();
  };
  const abrir = (e) => {
    if (intro.className) return;
    if (e.type === 'keydown' && e.code !== 'Enter' && e.code !== 'Space') return;
    e.preventDefault();
    FF.Audio.play('menuopen', 0.7);
    FF.Audio.musicaMenu();
    window.removeEventListener('keydown', abrir);
    intro.removeEventListener('click', abrir);
    const save = FF.Save.get();
    const cont = intro.querySelector('[data-acao="continuar"]');
    cont.disabled = !save.capitulo;
    if (save.capitulo) (cont.querySelector('span') || cont).textContent = 'Continuar (Cap. ' + save.capitulo + ')';
    mostrar('menu');
  };
  intro.addEventListener('click', abrir);
  window.addEventListener('keydown', abrir);
  FF._mostrarTitulo = mostrar;
  // volta direto para a montagem do treino (botão "Mudar treino" no fim de um treino)
  if (params.get('treinar')) { history.replaceState(null, '', location.pathname); window.removeEventListener('keydown', abrir); intro.removeEventListener('click', abrir); intro.className = 'selecao'; FF.Selecao.abrir('treino'); FF.Voltar.armar(); }
  // música já na tela "Toque ou aperte Enter" (se o navegador bloquear o som antes de um toque,
  // ela começa no primeiro toque/tecla)
  FF.Audio.musicaMenu();

  // setas para navegar entre os botões do menu visível
  window.addEventListener('keydown', (e) => {
    if (!intro.className || intro.classList.contains('hide')) return;
    const grade = intro.className === 'menu';   // menu principal em 2 colunas: ←→ trocam de coluna, ↑↓ de linha
    if (e.code !== 'ArrowDown' && e.code !== 'ArrowUp' && !(grade && (e.code === 'ArrowLeft' || e.code === 'ArrowRight'))) return;
    const vis = { menu: '#titulo-menu', livre: '#escolha', opcoes: '#opcoes', treino: '#treino', ferramentas: '#ferramentas', novojogo: '#novojogo' }[intro.className];
    if (!vis) return;
    const todos = [...intro.querySelectorAll(vis + ' > button')].filter(b => !b.hidden);
    const bts = grade ? todos : todos.filter(b => !b.disabled);
    if (!bts.length) return;
    let i = bts.indexOf(document.activeElement), j;
    const passo = grade && (e.code === 'ArrowDown' || e.code === 'ArrowUp') ? 2 : 1;
    const dir = e.code === 'ArrowDown' || e.code === 'ArrowRight' ? 1 : -1;
    j = i < 0 ? 0 : i;
    for (let n = 0; n < bts.length; n++) { j = (j + dir * passo + bts.length) % bts.length; if (!bts[j].disabled) break; }
    bts[j].focus(); e.preventDefault();
    FF.Audio.play('tap_sound', 0.4);
  });

  // botões do menu: texto dentro de <span> (o botão é inclinado e o texto fica reto) e o mouse
  // "seleciona" como o teclado (um só destaque)
  intro.querySelectorAll('.menu-titulo > button').forEach(bt => {
    if (!bt.querySelector('span')) { const s = document.createElement('span'); s.textContent = bt.textContent; bt.textContent = ''; bt.appendChild(s); }
    bt.addEventListener('mouseenter', () => { if (!bt.disabled) bt.focus({ preventScroll: true }); });
  });
  intro.querySelectorAll('button').forEach(bt => bt.addEventListener('click', (e) => {
    e.stopPropagation();
    FF.Audio.play('decide_charasel', 0.6);
    const ac = bt.dataset.acao;
    if (bt.dataset.batalha) return batalhaLivre(bt.dataset.batalha);
    if (ac === 'instalar') { FF.PWA.instalar(); return; }
    if (ac === 'estudio') { location.href = 'estudio.html'; return; }
    if (ac === 'novo') return FF.NovoJogo.abrir(mostrar, ir);
    if (ac === 'continuar') return ir('?historia=' + (FF.Save.get().capitulo || 1));
    if (ac === 'livre') { intro.className = 'selecao'; FF.Selecao.abrir(); FF.Voltar.armar(); return; }
    if (ac === 'treino') { intro.className = 'selecao'; FF.Selecao.abrir('treino'); FF.Voltar.armar(); return; }   // Treinamento: mesma tela da Batalha Livre
    if (ac === 'personalizar') { FF._persDe = 'novojogo'; return mostrar('treino'); }   // personalização do modo história
    if (ac === 'voltar' && intro.className === 'treino' && FF._persDe === 'novojogo') { FF._persDe = null; return FF.NovoJogo.abrir(mostrar, ir); }
    if (ac === 'tutorial') { intro.className = 'tutorial-aberto'; return FF.Tutorial.abrir(); }
    if (ac === 'voltar' && intro.className === 'novojogo' && FF.NovoJogo.saga) return FF.NovoJogo.abrir(mostrar, ir);
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
