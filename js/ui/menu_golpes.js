// Menu de golpes novo (Opções → Menu de golpes): categorias em círculos (Ataques / Formas / Buffs) e os golpes
// da categoria escolhida em três estilos — "radial" (leque em arco), "trilho" (painel ao lado) e "dock"
// (barra embaixo). O menu clássico continua em FF.UI.chooseMove (estilo "lista").
// Teclado: ↑↓ golpes · ←→ categorias (no dock é ao contrário) · Enter escolhe · 1-9 atalho · Esc volta (Planejamento).
window.FF = window.FF || {};

FF.MenuGolpes = {
  CATS: [
    { id: 'ataques', nome: 'Ataques', ic: '👊' },
    { id: 'formas', nome: 'Formas', ic: '⚡' },
    { id: 'buffs', nome: 'Buffs', ic: '🔥' },
  ],
  estilo() { return (FF.Save && FF.Save.get().estiloMenu) || 'lista'; },

  // categoria de um golpe: transformação → Formas; ofensivo → Ataques; o resto (ki, buff, cura…) → Buffs
  categoria(m) {
    const txt = JSON.stringify(m.roteiro || []);
    if (m.tipo === 'transformacao' || /"transformar"/.test(txt)) return 'formas';
    if (m.tipo === 'suporte') return 'buffs';
    if (m.tipo === 'corpo' || m.tipo === 'energia' || m.supremo || (m.requer && m.requer.parceiro)) return 'ataques';
    return FF.Battle.ofensivo(m) ? 'ataques' : 'buffs';
  },

  escolher(hero, battle, opts = {}) {
    const UI = FF.UI, estilo = this.estilo();
    return new Promise(resolve => {
      const box = document.getElementById('menu');
      box.innerHTML = '';
      box.className = 'mg mg-' + estilo;
      const ids = hero.form.golpes.filter(id => hero.def.golpes[id] && UI.visivel(hero, hero.def.golpes[id]));
      const info = ids.map((id, i) => {
        const m = hero.def.golpes[id];
        return { id, i, m, cat: this.categoria(m), pode: !UI.motivo(hero, m) && !(m.requer && !UI.meets(hero, m.requer)) };
      });
      let cat = (info.find(x => x.pode && x.cat === 'ataques') || info.find(x => x.pode) || info[0] || {}).cat || 'ataques';
      let sel = 0;

      // cabeçalho: herói, ki e fúria
      const topo = document.createElement('div'); topo.className = 'mg-topo';
      topo.innerHTML = '<b></b><span></span>';
      topo.querySelector('b').textContent = hero.nome;
      topo.querySelector('span').textContent = 'KI ' + Math.floor(hero.ki) + '/' + hero.kiMax + ' · Fúria ' + Math.floor(hero.rage) + '%';
      const cats = document.createElement('div'); cats.className = 'mg-cats';
      const lista = document.createElement('div'); lista.className = 'mg-golpes';
      const desc = document.createElement('div'); desc.className = 'mg-desc';
      // botões de todos os golpes na ordem clássica (escondidos): atalhos 1-9 e testes automáticos
      const todos = document.createElement('div'); todos.className = 'mg-todos'; todos.hidden = true;
      info.forEach(x => { const b = document.createElement('button'); b.dataset.golpe = x.id; if (!x.pode) b.classList.add('bloq'); b.onclick = () => (x.pode ? done(x.id) : null); todos.appendChild(b); });
      box.append(topo, cats, lista, desc, todos);
      if (opts.voltar) {
        const bv = document.createElement('button'); bv.className = 'cmd-voltar mg-voltar'; bv.textContent = '↩ Voltar (herói anterior)';
        bv.onclick = () => done('__voltar');
        box.appendChild(bv);
      }

      const doCat = () => info.filter(x => x.cat === cat);
      const botoesCat = this.CATS.map(c => {
        const b = document.createElement('button');
        b.className = 'mg-cat mg-cat-' + c.id;
        b.innerHTML = '<span class="mg-cat-ic">' + c.ic + '</span><span class="mg-cat-nome">' + c.nome + '</span>';
        const n = info.filter(x => x.cat === c.id).length;
        if (!n) b.classList.add('vazio');
        b.onclick = () => { if (!n) return; cat = c.id; sel = 0; FF.Audio.play('tap_sound', 0.5); render(); };
        cats.appendChild(b);
        return { c, b };
      });

      const mostrarDesc = (x) => {
        desc.innerHTML = '';
        if (!x) return;
        const t = document.createElement('b'); t.textContent = x.m.nome + (x.m.custoKi ? ' · ' + x.m.custoKi + ' KI' : '');
        const d = document.createElement('span'); d.textContent = ' ' + (x.m.descricao || '');
        desc.append(t, d);
        const mot = UI.motivo(hero, x.m);
        if (mot) { const e = document.createElement('em'); e.textContent = ' ' + mot; desc.appendChild(e); }
      };

      const render = () => {
        botoesCat.forEach(({ c, b }) => b.classList.toggle('sel', c.id === cat));
        lista.innerHTML = '';
        const l = doCat();
        sel = Math.max(0, Math.min(sel, l.length - 1));
        l.forEach((x, k) => {
          const b = document.createElement('button');
          b.className = 'mg-golpe' + (x.pode ? '' : ' bloq') + (x.m.supremo ? ' supremo' : '') + (x.m.requer && x.m.requer.parceiro ? ' sparking' : '') + (k === sel ? ' sel' : '');
          b.innerHTML = '<span class="mg-ic">' + UI.icone(x.m) + '</span><span class="mg-nome"></span>' + (x.m.custoKi ? '<span class="mg-ki">' + x.m.custoKi + '</span>' : '');
          b.querySelector('.mg-nome').textContent = (x.m.habId ? '⭐ ' : '') + x.m.nome;
          b.onmouseenter = () => { sel = k; marcar(); };
          b.onclick = () => { sel = k; marcar(); if (x.pode) done(x.id); else FF.Audio.play('tap_sound', 0.3); };
          lista.appendChild(b);
        });
        if (estilo === 'radial') this.posicionarLeque(lista, cats, botoesCat.find(o => o.c.id === cat).b);
        marcar();
      };
      const marcar = () => {
        [...lista.children].forEach((b, k) => b.classList.toggle('sel', k === sel));
        mostrarDesc(doCat()[sel]);
      };

      const trocarCat = (d) => {
        const comGolpes = this.CATS.filter(c => info.some(x => x.cat === c.id));
        if (comGolpes.length < 2) return;
        const i = comGolpes.findIndex(c => c.id === cat);
        cat = comGolpes[(i + d + comGolpes.length) % comGolpes.length].id; sel = 0;
        FF.Audio.play('tap_sound', 0.5); render();
      };
      const key = (e) => {
        const l = doCat();
        const vert = estilo !== 'dock';
        const mvG = { [vert ? 'ArrowDown' : 'ArrowRight']: 1, [vert ? 'ArrowUp' : 'ArrowLeft']: -1 }[e.code];
        const mvC = { [vert ? 'ArrowRight' : 'ArrowDown']: 1, [vert ? 'ArrowLeft' : 'ArrowUp']: -1 }[e.code];
        if (mvG && l.length) { e.preventDefault(); sel = (sel + mvG + l.length) % l.length; marcar(); FF.Audio.play('tap_sound', 0.5); }
        else if (mvC) { e.preventDefault(); trocarCat(mvC); }
        else if (e.code === 'Enter') { e.preventDefault(); const x = l[sel]; if (x && x.pode) done(x.id); }
        else if (e.code === 'Escape' && opts.voltar) { e.preventDefault(); done('__voltar'); }
        else if (/^Digit[1-9]$/.test(e.code)) { const x = info[+e.code.slice(5) - 1]; if (x && x.pode) done(x.id); }
      };
      const done = (id) => {
        window.removeEventListener('keydown', key, true);
        box.classList.remove('open');
        FF.Audio.play('decide_charasel', 0.6);
        resolve(id);
      };
      window.addEventListener('keydown', key, true);
      render();
      box.classList.add('open');
    });
  },

  // estilo "radial": os golpes saem da categoria escolhida num arco (com os fios ligando)
  posicionarLeque(lista, cats, botao) {
    const n = lista.querySelectorAll('.mg-golpe').length;
    if (!n) return;
    requestAnimationFrame(() => {
      const lb = lista.getBoundingClientRect(), r = botao.getBoundingClientRect();
      // centro da categoria escolhida, em coordenadas da lista
      const cx = r.left + r.width / 2 - lb.left, cy = r.top + r.height / 2 - lb.top;
      const bs = [...lista.querySelectorAll('.mg-golpe')];
      const h = bs[0].offsetHeight, gap = h * 0.22, total = n * h + (n - 1) * gap;
      const R = Math.max(r.width * 1.25, total * 0.62);
      // arco centrado na categoria, sem sair do topo da lista
      let y0 = cy - total / 2 + h / 2;
      y0 = Math.max(h / 2, y0);
      lista.querySelectorAll('svg').forEach(x => x.remove());
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'mg-fios');
      bs.forEach((b, k) => {
        const y = y0 + k * (h + gap), dy = Math.max(-R * 0.95, Math.min(R * 0.95, y - cy));
        const x = cx + Math.sqrt(R * R - dy * dy) - r.width * 0.15;
        b.style.left = x + 'px'; b.style.top = (y - h / 2) + 'px';
        const pth = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pth.setAttribute('d', 'M' + (cx + r.width / 2) + ' ' + cy + ' C' + (cx + r.width) + ' ' + cy + ' ' + (x - 20) + ' ' + y + ' ' + x + ' ' + y);
        svg.appendChild(pth);
      });
      lista.style.minHeight = Math.max(total + h / 2, cy + h) + 'px';
      lista.prepend(svg);
    });
  },
};
