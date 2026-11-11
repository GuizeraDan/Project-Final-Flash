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
        const can = (m.custoKi || 0) <= hero.ki && !(m.requer && !this.meets(hero, m.requer));
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
  meets(hero, req) {
    if (req.forma && hero.formId !== req.forma) return false;
    if (req.semBuff && hero.buffs[req.semBuff]) return false;
    return true;
  },
  showEnd(win) {
    const el = document.getElementById('fim');
    el.querySelector('h2').textContent = win ? 'Vitória!' : 'Derrota...';
    el.classList.add('open');
  },
};

FF.start = async function () {
  const canvas = document.getElementById('tela');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  FF.Input.init(canvas);

  const params = new URLSearchParams(location.search);
  const battleId = params.get('batalha') || 'saiyajin_01';
  const def = await FF.Assets.loadJSON('data/battles/' + battleId + '.json');
  const stage = await FF.Assets.loadJSON('data/stages/' + def.cenario + '.json');

  // personagens e todos os sprites de todas as formas (transformação sem espera)
  const heroDefs = await Promise.all(def.herois.map(id => FF.Assets.loadCharacter(id)));
  const foeDefs = await Promise.all(def.inimigos.map(id => FF.Assets.loadCharacter(id)));
  const spriteIds = new Set(['fx', stage.sprite]);
  heroDefs.concat(foeDefs).forEach(c => Object.values(c.formas).forEach(f => spriteIds.add(f.sprite)));
  await Promise.all([...spriteIds].map(id => FF.Assets.loadSprite(id)));

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
  const go = async () => {
    intro.removeEventListener('click', go);
    window.removeEventListener('keydown', goKey);
    intro.querySelector('p').textContent = 'Carregando...';
    try {
      const battle = await FF.start();
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
