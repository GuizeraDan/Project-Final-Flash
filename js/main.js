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

window.addEventListener('load', () => {
  const intro = document.getElementById('inicio');
  let escolhida = null;
  intro.querySelectorAll('#escolha button').forEach(bt => bt.addEventListener('click', () => { escolhida = bt.dataset.batalha; }, true));
  const go = async () => {
    intro.removeEventListener('click', go);
    window.removeEventListener('keydown', goKey);
    intro.querySelector('p').textContent = 'Carregando...';
    try {
      const battle = await FF.start(escolhida);
      intro.classList.add('hide');
      battle.run();
    } catch (err) {
      console.error(err);
      intro.querySelector('p').textContent = 'Erro: ' + err.message;
    }
  };
  const goKey = (e) => { if (e.code === 'Enter' || e.code === 'Space') go(); };
  intro.addEventListener('click', go);
  window.addEventListener('keydown', goKey);
  document.getElementById('denovo').onclick = () => location.reload();
});
