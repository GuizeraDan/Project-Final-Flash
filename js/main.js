// Inicialização: tela de início, carregamento da batalha e menu de golpes.
window.FF = window.FF || {};

FF.UI = {
  menu: null,
  chooseMove(hero, battle) {
    return new Promise(resolve => {
      const box = document.getElementById('menu');
      box.innerHTML = '';
      const ids = hero.form.golpes;
      const btns = [];
      ids.forEach((id, i) => {
        const m = hero.def.golpes[id];
        const b = document.createElement('button');
        const custo = m.custoKi ? '<span class="ki">' + m.custoKi + ' KI</span>' : '';
        b.innerHTML = '<span class="n">' + (i + 1) + '</span><span class="nome">' + m.nome + '</span>' + custo +
          '<span class="desc">' + (m.descricao || '') + '</span>';
        const can = (m.custoKi || 0) <= hero.ki && !(m.requer && !this.meets(hero, m.requer)) && !(m.supremo && !hero.rageCheia);
        if (m.supremo) b.classList.add('supremo');
        if (m.requer && m.requer.parceiro) b.classList.add('sparking');
        b.disabled = !can;
        b.onclick = () => { if (!b.disabled) done(id); };
        b.onmouseenter = () => focus(i);
        box.appendChild(b);
        btns.push(b);
      });
      let sel = btns.findIndex(b => !b.disabled);
      const focus = (i) => { sel = i; btns.forEach((b, k) => b.classList.toggle('sel', k === i)); };
      focus(Math.max(0, sel));
      const key = (e) => {
        if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
          e.preventDefault();
          const d = e.code === 'ArrowDown' ? 1 : -1;
          let i = sel;
          for (let k = 0; k < btns.length; k++) { i = (i + d + btns.length) % btns.length; if (!btns[i].disabled) break; }
          focus(i);
          FF.Audio.play('tap_sound', 0.5);
        } else if (e.code === 'Enter') {
          e.preventDefault();
          if (btns[sel] && !btns[sel].disabled) done(ids[sel]);
        } else if (/^Digit[1-9]$/.test(e.code)) {
          const i = +e.code.slice(5) - 1;
          if (btns[i] && !btns[i].disabled) done(ids[i]);
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
      box.innerHTML = '<div class="titulo-alvo">Escolha o alvo</div>';
      box.classList.add('alvos');
      let sel = 0;
      const btns = foes.map((f, i) => {
        const b = document.createElement('button');
        b.innerHTML = '<span class="n">' + (i + 1) + '</span><span class="nome">' + f.nome + '</span><span class="desc">Vida ' + Math.ceil(f.hp) + ' / ' + f.hpMax + '</span>';
        b.onclick = () => done(i);
        b.onmouseenter = () => focus(i);
        box.appendChild(b);
        return b;
      });
      const focus = (i) => { sel = i; battle.alvoMarcado = foes[i]; btns.forEach((b, k) => b.classList.toggle('sel', k === i)); };
      focus(0);
      const key = (e) => {
        if (e.code === 'ArrowDown' || e.code === 'ArrowUp') { e.preventDefault(); focus((sel + (e.code === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length); FF.Audio.play('tap_sound', 0.5); }
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

FF.start = async function (escolhida) {
  const canvas = document.getElementById('tela');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  FF.Input.init(canvas);

  const params = new URLSearchParams(location.search);
  const battleId = params.get('batalha') || escolhida || 'saiyajin_01';
  const def = await FF.Assets.loadJSON('data/battles/' + battleId + '.json');
  const stage = await FF.Assets.loadJSON('data/stages/' + def.cenario + '.json');

  // personagens e todos os sprites de todas as formas (transformação sem espera)
  const heroDefs = await Promise.all(def.herois.map(id => FF.Assets.loadCharacter(id)));
  const foeDefs = await Promise.all(def.inimigos.map(id => FF.Assets.loadCharacter(id)));
  const spriteIds = new Set(['fx', 'fx_extra', 'hud_zl3', stage.sprite]);
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
};

const _showEnd = FF.UI.showEnd.bind(FF.UI);
FF.UI.showEnd = async function (win) {
  const mh = FF.modoHistoria;
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

window.addEventListener('load', () => {
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
      battle.run();
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
    intro.className = modo;
    const primeiro = intro.querySelector('.menu-titulo button:not([disabled])');
    const vis = { menu: '#titulo-menu', livre: '#escolha', opcoes: '#opcoes' }[modo];
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

  // setas para navegar entre os botões do menu visível
  window.addEventListener('keydown', (e) => {
    if (!intro.className || intro.classList.contains('hide')) return;
    if (e.code !== 'ArrowDown' && e.code !== 'ArrowUp') return;
    const vis = { menu: '#titulo-menu', livre: '#escolha', opcoes: '#opcoes' }[intro.className];
    const bts = [...intro.querySelectorAll(vis + ' button:not([disabled])')];
    const i = bts.indexOf(document.activeElement);
    const j = (i + (e.code === 'ArrowDown' ? 1 : -1) + bts.length) % bts.length;
    bts[j].focus(); e.preventDefault();
    FF.Audio.play('tap_sound', 0.4);
  });

  intro.querySelectorAll('button').forEach(bt => bt.addEventListener('click', (e) => {
    e.stopPropagation();
    FF.Audio.play('decide_charasel', 0.6);
    const ac = bt.dataset.acao;
    if (bt.dataset.batalha) return batalhaLivre(bt.dataset.batalha);
    if (ac === 'novo') { FF.Save.set({ capitulo: 1 }); return ir('?historia=1'); }
    if (ac === 'continuar') return ir('?historia=' + (FF.Save.get().capitulo || 1));
    if (ac === 'livre') return mostrar('livre');
    if (ac === 'voltar') return mostrar('menu');
    if (ac === 'apagar') {
      if (confirm('Apagar o progresso do modo história?')) { const v = FF.Save.get().volumes; FF.Save.apagar(); if (v) FF.Save.set({ volumes: v }); }
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
