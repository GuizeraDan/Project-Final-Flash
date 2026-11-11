// Visualizador de animações e sons do Final Flash.
// Mostra todas as animações extraídas do Z Legends 3, quadro a quadro, com hotspot (pés),
// pontos de disparo e os eventos (acerto, som, voz...) dos golpes que usam cada animação.
(function () {
  const $ = (s) => document.querySelector(s);
  const B = window.FF_BUNDLE || {};
  const IDX = B._indice || { sprites: [], personagens: [], audios: [] };

  const st = {
    setId: null, set: null, anim: null, animName: null,
    i: 0, t: 0, playing: false, vel: 1, zoom: 4,
    loop: true, espelho: false, caixa: true, pontos: true, fantasma: false, fundo: 'xadrez',
    usos: {}, uso: null,
  };
  const cv = $('#tela'), ctx = cv.getContext('2d');

  // ---------- índice de uso: quais golpes usam cada animação ----------
  function chars() {
    return IDX.personagens.map(id => B['data/characters/' + id + '.json']).filter(Boolean);
  }
  function formaDoGolpe(c, moveId) {
    for (const [fid, f] of Object.entries(c.formas)) if ((f.golpes || []).includes(moveId)) return f;
    return c.formas[c.formaInicial] || Object.values(c.formas)[0];
  }
  function indexarUsos() {
    const usos = {}; // usos[sprite][anim] = [{rotulo, eventos}]
    const add = (sprite, anim, rotulo, step) => {
      ((usos[sprite] = usos[sprite] || {})[anim] = usos[sprite][anim] || []).push({ rotulo, step });
    };
    const todos = chars();
    for (const c of todos) {
      // animações de estado (parado, dano, guarda...)
      for (const [fid, f] of Object.entries(c.formas)) {
        for (const [k, nome] of Object.entries(f.anims || {})) add(f.sprite, nome, c.nome + ' · estado "' + k + '"' + (fid !== 'base' ? ' (' + fid + ')' : ''), {});
        (f.vitoria || []).forEach(s => s.anim && add(f.sprite, (f.anims || {})[s.anim] || s.anim, c.nome + ' · vitória', s));
        (f.reverter || []).forEach(s => s.anim && add(f.sprite, (f.anims || {})[s.anim] || s.anim, c.nome + ' · destransformar', s));
      }
      for (const [mid, mv] of Object.entries(c.golpes || {})) {
        const walk = (lista, quem) => (lista || []).forEach(s => {
          if (!s || typeof s !== 'object') return;
          if (s.paralelo) {
            const p = todos.find(x => x.id === s.quem) || quem;
            return walk(s.paralelo, p);
          }
          if (typeof s.anim === 'string') {
            const f = quem === c ? formaDoGolpe(c, mid) : (quem.formas[quem.formaInicial] || Object.values(quem.formas)[0]);
            const nome = (f.anims || {})[s.anim] || s.anim;
            add(f.sprite, nome, c.nome + ' · ' + (mv.nome || mid) + (quem !== c ? ' (parte do ' + quem.nome + ')' : ''), s);
          }
        });
        walk(mv.roteiro, c);
      }
    }
    return usos;
  }

  function resolverQuadro(anim, q) {
    const n = anim.frames.length;
    if (q === 'fim') return n - 1;
    if (q === 'pico') {
      const i = anim.frames.findIndex(f => f[8] && f[8].length);
      if (i >= 0) return i;
      let best = 0, bw = -1;
      anim.frames.forEach((f, k) => { const r = f[3] - f[5]; if (r > bw) { bw = r; best = k; } });
      return best;
    }
    if (typeof q === 'number') return q < 0 ? n + q : Math.min(q, n - 1);
    return 0;
  }

  function descreverEvento(e) {
    const p = [];
    if (e.acerto) p.push('💥 acerto ' + (e.acerto.forca || 'leve') + ' (' + Math.round((e.acerto.fracao || 1) * 100) + '%' + (e.acerto.lanca ? ', lança' : '') + ')');
    if (e.projetil) p.push('🔸 projétil ' + (e.projetil.fx || ''));
    if (e.som) p.push('🔊 ' + [].concat(e.som).join(' / '));
    if (e.voz) p.push('🗣 ' + [].concat(e.voz).join(' / '));
    if (e.efeito) p.push('✨ efeito ' + (e.efeito.fx || ''));
    if (e.objeto) p.push('⚪ objeto');
    if (e.lancarObjeto) p.push('☄ lançar objeto');
    if (e.tremer) p.push('〰 tremer');
    if (e.flash) p.push('⚡ flash');
    return p.join(' · ') || Object.keys(e).filter(k => k !== 'quadro').join(', ');
  }

  function eventosDoUso() {
    if (!st.uso || !st.uso.step || !st.anim) return {};
    const porQuadro = {};
    (st.uso.step.eventos || []).forEach(e => {
      const i = resolverQuadro(st.anim, e.quadro != null ? e.quadro : 0);
      (porQuadro[i] = porQuadro[i] || []).push(e);
    });
    return porQuadro;
  }

  // ---------- carregar ----------
  async function abrirSprite(id) {
    st.setId = id;
    st.set = await FF.Assets.loadSprite(id);
    const nomes = Object.keys(st.set.def.anims);
    renderLista();
    const pref = nomes.find(n => /^(Parado|Default|ceu)$/.test(n)) || nomes[0];
    abrirAnim(pref);
  }

  function abrirAnim(nome) {
    st.animName = nome;
    st.anim = st.set.anim(nome);
    st.i = 0; st.t = 0;
    st.playing = st.anim.frames.length > 1;
    document.querySelectorAll('#anims div').forEach(d => d.classList.toggle('sel', d.dataset.n === nome));
    const usos = (st.usos[st.setId] || {})[nome] || [];
    const sel = $('#sel-uso');
    sel.innerHTML = usos.length ? '' : '<option>(nenhum golpe usa esta animação)</option>';
    usos.forEach((u, k) => { const o = document.createElement('option'); o.value = k; o.textContent = u.rotulo; sel.appendChild(o); });
    const comEv = usos.findIndex(u => u.step && u.step.eventos && u.step.eventos.length);
    st.uso = usos[comEv >= 0 ? comEv : 0] || null;
    if (comEv >= 0) sel.value = comEv;
    renderLinha();
    renderInfo();
  }

  function renderLista() {
    const filtro = $('#busca').value.trim().toLowerCase();
    const usos = st.usos[st.setId] || {};
    const box = $('#anims');
    box.innerHTML = '';
    Object.entries(st.set.def.anims).forEach(([nome, a]) => {
      if (filtro && !nome.toLowerCase().includes(filtro)) return;
      const d = document.createElement('div');
      d.dataset.n = nome;
      if (usos[nome]) d.classList.add('usada');
      const alt = FF.Mods && FF.Mods.alterada(st.setId, nome);
      d.innerHTML = '<span>' + (alt ? '✏ ' : '') + nome + '</span><small>' + a.frames.length + 'q · ' + (a.fps || 0) + 'fps' + (a.loop ? ' ↻' : '') + '</small>';
      if (alt) d.title = 'Alterada por você';
      d.onclick = () => { if (sairEdicao()) abrirAnim(nome); };
      if (nome === st.animName) d.classList.add('sel');
      box.appendChild(d);
    });
  }

  function renderLinha() {
    const box = $('#linha');
    box.innerHTML = '';
    const evs = eventosDoUso();
    st.anim.frames.forEach((f, i) => {
      const q = document.createElement('div');
      q.className = 'q';
      const c = document.createElement('canvas');
      const s = Math.min(1.5, 56 / f[4]);
      c.width = Math.max(8, Math.ceil(f[3] * s)); c.height = Math.ceil(f[4] * s);
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      g.drawImage(st.set.images[f[0]], f[1], f[2], f[3], f[4], 0, 0, c.width, c.height);
      q.appendChild(c);
      q.appendChild(document.createTextNode(String(i)));
      if (evs[i]) {
        const m = document.createElement('span');
        m.className = 'm';
        m.textContent = evs[i].some(e => e.acerto || e.projetil) ? '💥' : '🔊';
        q.appendChild(m);
      }
      if (f[8] && f[8].length) q.title = 'tem ponto de disparo';
      if (st.edit) {
        if ((f[7] || 1) !== 1) { const d = document.createElement('span'); d.className = 'dur'; d.textContent = (f[7] || 1) + '×'; q.appendChild(d); }
        if (st.edit.sel.has(i)) q.classList.add('marcado');
        q.draggable = true;
        q.ondragstart = (e) => { st.edit.arrasto = i; e.dataTransfer.effectAllowed = 'move'; };
        q.ondragover = (e) => { e.preventDefault(); q.classList.add('alvo'); };
        q.ondragleave = () => q.classList.remove('alvo');
        q.ondrop = (e) => { e.preventDefault(); moverPara(st.edit.arrasto, i); };
        q.onclick = (e) => escolherQuadro(i, e);
      } else
      q.onclick = () => { st.i = i; st.t = 0; st.playing = false; renderInfo(); };
      box.appendChild(q);
    });
  }

  function duracao(i) {
    const fps = (st.anim.fps || 10) * st.vel;
    return (st.anim.frames[i][7] || 1) / fps;
  }

  function renderInfo() {
    const a = st.anim, f = a.frames[st.i];
    let t = 0; for (let k = 0; k < st.i; k++) t += (a.frames[k][7] || 1) / (a.fps || 10);
    let tot = 0; a.frames.forEach(fr => tot += (fr[7] || 1) / (a.fps || 10));
    $('#quadro-txt').textContent = 'Quadro ' + st.i + ' / ' + (a.frames.length - 1);
    $('#bt-play').textContent = st.playing ? '❚❚' : '▶︎';
    $('#info-quadro').textContent =
      'sprite:    ' + st.setId + '\n' +
      'animação:  ' + st.animName + '\n' +
      'quadro:    ' + st.i + ' de ' + (a.frames.length - 1) + '   (t = ' + t.toFixed(2) + 's de ' + tot.toFixed(2) + 's)\n' +
      'tamanho:   ' + f[3] + '×' + f[4] + '   origem (pés): ' + f[5] + ', ' + f[6] + '\n' +
      'duração:   ' + (f[7] || 1) + '×   fps: ' + (a.fps || 0) + (a.loop ? '   (loop, volta ao ' + (a.repeatTo || 0) + ')' : '') + '\n' +
      'disparo:   ' + (f[8] && f[8].length ? f[8].map(p => '(' + p.join(', ') + ')').join(' ') : '—');
    const evs = eventosDoUso();
    const box = $('#eventos');
    box.innerHTML = '';
    if (st.uso && st.uso.step) {
      const s = st.uso.step;
      const extra = [s.fps ? 'fps ' + s.fps : '', s.duracao ? 'dura ' + s.duracao + 's (loop)' : ''].filter(Boolean).join(' · ');
      if (extra) box.insertAdjacentHTML('beforeend', '<div class="ev">Neste golpe: ' + extra + '</div>');
      Object.keys(evs).sort((x, y) => x - y).forEach(i => {
        evs[i].forEach(e => box.insertAdjacentHTML('beforeend', '<div class="ev"><b>q' + i + '</b> ' + descreverEvento(e) + '</div>'));
      });
    }
    document.querySelectorAll('#linha .q').forEach((q, k) => q.classList.toggle('sel', k === st.i));
    const sel = document.querySelectorAll('#linha .q')[st.i];
    if (sel && st.playing === false) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ---------- desenho ----------
  function fundo() {
    const W = cv.width, H = cv.height;
    if (st.fundo === 'escuro') { ctx.fillStyle = '#101018'; ctx.fillRect(0, 0, W, H); return; }
    if (st.fundo === 'cenario' && FF.Assets.sprites.stage_campo) {
      const s = FF.Assets.sprites.stage_campo, f = s.anim('ceu').frames[0];
      ctx.drawImage(s.images[f[0]], f[1], f[2], f[3], f[4], 0, 0, W, H);
      return;
    }
    const q = 16;
    for (let y = 0; y < H; y += q) for (let x = 0; x < W; x += q) {
      ctx.fillStyle = ((x + y) / q) % 2 ? '#3a3a4a' : '#2c2c3a';
      ctx.fillRect(x, y, q, q);
    }
  }

  function desenhar() {
    const W = cv.width, H = cv.height;
    ctx.imageSmoothingEnabled = false;
    fundo();
    if (!st.anim) return;
    const f = st.anim.frames[st.i];
    const z = st.zoom;
    // origem: pés no centro, acima da base; quadros largos (raios) começam mais à esquerda
    const maxW = Math.max(...st.anim.frames.map(fr => fr[3]));
    const cx = maxW * z > W * 0.8 ? W * 0.12 : W / 2;
    const gy = H * 0.82;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); ctx.stroke();
    if (st.fantasma && st.i > 0) FF.drawFrame(ctx, st.set, st.anim.frames[st.i - 1], cx, gy, z, st.espelho, { alpha: 0.3 });
    FF.drawFrame(ctx, st.set, f, cx, gy, z, st.espelho);
    const [, , , w, h, ox, oy] = f;
    const dx = st.espelho ? cx - (w - ox) * z : cx - ox * z;
    const dy = gy - oy * z;
    if (st.caixa) {
      ctx.strokeStyle = 'rgba(120,200,255,0.7)'; ctx.lineWidth = 1;
      ctx.strokeRect(dx + 0.5, dy + 0.5, w * z, h * z);
    }
    // hotspot (pés)
    ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 8, gy); ctx.lineTo(cx + 8, gy); ctx.moveTo(cx, gy - 8); ctx.lineTo(cx, gy + 8); ctx.stroke();
    if (st.pontos && f[8]) {
      f[8].forEach(p => {
        const px = cx + p[0] * z * (st.espelho ? -1 : 1), py = gy + p[1] * z;
        ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(px, py, 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#000'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('disparo', px + 7, py - 6);
      });
    }
    const evs = eventosDoUso()[st.i];
    if (evs) {
      ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#ffd84a';
      evs.forEach((e, k) => ctx.fillText(descreverEvento(e), 12, 24 + k * 20));
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (st.playing && st.anim && st.anim.frames.length > 1) {
      st.t += dt;
      let mudou = false;
      while (st.t >= duracao(st.i)) {
        st.t -= duracao(st.i);
        if (st.i + 1 < st.anim.frames.length) st.i++;
        else if (st.loop) st.i = st.anim.loop ? (st.anim.repeatTo || 0) : 0;
        else { st.playing = false; break; }
        mudou = true;
      }
      if (mudou) renderInfo();
    }
    desenhar();
    requestAnimationFrame(loop);
  }

  // ---------- sons ----------
  function renderSons() {
    const f = $('#busca-som').value.trim().toLowerCase();
    const lista = IDX.audios.filter(n => !f || n.toLowerCase().includes(f));
    $('#sons-total').textContent = lista.length + ' de ' + IDX.audios.length + ' sons';
    const box = $('#sons');
    box.innerHTML = '';
    lista.slice(0, 600).forEach(n => {
      const b = document.createElement('button');
      b.textContent = '▶ ' + n;
      b.title = n + ' (clique para tocar, botão direito copia o nome)';
      b.onclick = () => FF.Audio.play(n, 1);
      b.oncontextmenu = (e) => { e.preventDefault(); copiar(n); };
      const linha = document.createElement('span');
      linha.className = 'som-linha';
      const env = document.createElement('button');
      env.textContent = '➕'; env.title = 'Enviar para o Editor de cenas';
      env.onclick = () => enviar({ tipo: 'som', som: n });
      linha.append(b, env);
      box.appendChild(linha);
    });
  }

  // fila compartilhada com o Editor de cenas (mesmo navegador)
  function enviar(item) {
    try {
      const fila = JSON.parse(localStorage.getItem('ff_editor_fila') || '[]');
      fila.push(item);
      localStorage.setItem('ff_editor_fila', JSON.stringify(fila.slice(-30)));
      $('#copiado').textContent = 'enviado para o editor!';
      setTimeout(() => ($('#copiado').textContent = ''), 1500);
    } catch (e) { alert('Não deu para enviar (armazenamento do navegador bloqueado).'); }
  }

  function copiar(txt) {
    const ok = () => { $('#copiado').textContent = 'copiado!'; setTimeout(() => ($('#copiado').textContent = ''), 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok, () => prompt('Copie:', txt));
    else prompt('Copie:', txt);
  }

  // ---------- ✂ editor de quadros (alterações ficam no navegador: FF.Mods) ----------
  function iniciarEdicao() {
    if (!st.anim) return;
    const copia = JSON.parse(JSON.stringify(st.anim));
    st.edit = { nome: st.animName, copia, hist: [], sel: new Set([st.i]), mudou: false };
    st.anim = copia;
    $('#edq').hidden = false;
    $('#bt-edq').hidden = true;
    document.body.classList.add('editando-q');
    $('#edq-fps').value = copia.fps || 10;
    $('#edq-loop').checked = !!copia.loop;
    $('#edq-rep').value = copia.repeatTo || 0;
    const so = $('#edq-outra');
    so.innerHTML = '<option value="">outra animação…</option>';
    Object.keys(st.set.def.anims).forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; so.appendChild(o); });
    $('#edq-outros').hidden = true;
    msgQ(FF.Mods.alterada(st.setId, st.animName) ? 'Esta animação já tem alterações suas.' : '');
    renderLinha(); renderInfo(); renderEdicao();
  }

  function sairEdicao(forcar) {
    if (!st.edit) return true;
    if (!forcar && st.edit.mudou && !confirm('Sair sem salvar? As mudanças nesta animação serão perdidas.')) return false;
    const nome = st.edit.nome;
    st.edit = null;
    $('#edq').hidden = true;
    $('#bt-edq').hidden = false;
    document.body.classList.remove('editando-q');
    if (st.set.has(nome)) abrirAnim(nome); else abrirAnim(Object.keys(st.set.def.anims)[0]);
    return true;
  }

  function msgQ(t) { $('#edq-msg').textContent = t; }
  function guardar() { const e = st.edit; e.hist.push(JSON.stringify({ c: e.copia, i: st.i })); if (e.hist.length > 60) e.hist.shift(); e.mudou = true; }
  function escolhidos() { return [...st.edit.sel].filter(i => i < st.anim.frames.length).sort((a, b) => a - b); }

  function escolherQuadro(i, e) {
    const sel = st.edit.sel;
    if (e && e.shiftKey && sel.size) {
      const base = Math.min(...sel) <= i ? Math.min(...sel) : Math.max(...sel);
      for (let k = Math.min(base, i); k <= Math.max(base, i); k++) sel.add(k);
    } else if (e && (e.ctrlKey || e.metaKey)) { sel.has(i) ? sel.delete(i) : sel.add(i); }
    else { sel.clear(); sel.add(i); }
    st.i = i; st.t = 0; st.playing = false;
    renderLinha(); renderInfo(); renderEdicao();
  }

  function aplicarMudanca(fn, novoI) {
    guardar();
    fn(st.anim.frames);
    const n = st.anim.frames.length;
    st.i = Math.max(0, Math.min(n - 1, novoI != null ? novoI : st.i));
    if ((st.anim.repeatTo || 0) >= n) st.anim.repeatTo = 0;
    renderLinha(); renderInfo(); renderEdicao();
  }

  function moverPara(de, para) {
    if (de == null || de === para) return;
    aplicarMudanca(fr => { const [q] = fr.splice(de, 1); fr.splice(para, 0, q); }, para);
    st.edit.sel = new Set([para]);
    renderLinha(); renderInfo();
  }

  function acaoQ(a) {
    const e = st.edit, fr = st.anim.frames, sel = escolhidos();
    if (a === 'apagar') {
      if (!sel.length) return;
      if (sel.length >= fr.length) return msgQ('A animação precisa de pelo menos 1 quadro.');
      aplicarMudanca(f => { for (let k = sel.length - 1; k >= 0; k--) f.splice(sel[k], 1); }, sel[0]);
      e.sel = new Set([Math.min(sel[0], st.anim.frames.length - 1)]);
      renderLinha(); renderInfo();
      msgQ(sel.length + ' quadro(s) apagado(s).');
    } else if (a === 'duplicar') {
      if (!sel.length) return;
      const fim = sel[sel.length - 1];
      aplicarMudanca(f => f.splice(fim + 1, 0, ...sel.map(k => JSON.parse(JSON.stringify(f[k])))), fim + 1);
      e.sel = new Set(sel.map((_, k) => fim + 1 + k));
      renderLinha(); renderInfo();
    } else if (a === 'esq' || a === 'dir') {
      const d = a === 'esq' ? -1 : 1;
      if (!sel.length || (d < 0 && sel[0] === 0) || (d > 0 && sel[sel.length - 1] === fr.length - 1)) return;
      aplicarMudanca(f => {
        const ordem = d < 0 ? sel : sel.slice().reverse();
        ordem.forEach(k => { [f[k], f[k + d]] = [f[k + d], f[k]]; });
      }, st.i + d);
      e.sel = new Set(sel.map(k => k + d));
      renderLinha(); renderInfo();
    } else if (a === 'dmais' || a === 'dmenos') {
      aplicarMudanca(f => sel.forEach(k => { f[k][7] = Math.max(1, Math.min(30, (f[k][7] || 1) + (a === 'dmais' ? 1 : -1))); }));
    } else if (/^o[xy][+-]$/.test(a)) {
      // mexer na origem desloca o desenho ao contrário (origem é o ponto dos pés)
      const idx = a[1] === 'x' ? 5 : 6, sinal = a[2] === '+' ? -1 : 1;
      aplicarMudanca(f => sel.forEach(k => { f[k][idx] += sinal; }));
    } else if (a === 'desfazer') {
      const h = e.hist.pop();
      if (!h) return msgQ('Nada para desfazer.');
      const o = JSON.parse(h);
      e.copia = st.anim = o.c; st.i = o.i;
      e.sel = new Set([o.i]);
      renderLinha(); renderInfo(); renderEdicao();
    } else if (a === 'salvar') {
      if (!FF.Mods.salvar(st.setId, e.nome, st.anim)) return msgQ('❌ Não deu para salvar neste navegador.');
      e.mudou = false;
      renderLista();
      msgQ('💾 Salvo! "' + e.nome + '" já está assim no jogo e no editor de cenas (recarregue as outras abas).');
    } else if (a === 'salvarnova') {
      const nome = prompt('Nome da nova animação:', e.nome + '_editada');
      if (!nome) return;
      if (st.set.has(nome) && !FF.Mods.alterada(st.setId, nome) && !confirm('"' + nome + '" já existe no jogo. Substituir?')) return;
      if (!FF.Mods.salvar(st.setId, nome, st.anim)) return msgQ('❌ Não deu para salvar neste navegador.');
      e.mudou = false;
      // a original fica como estava
      const orig = (st.set.def._orig && st.set.def._orig[e.nome]) || st.set.def.anims[e.nome];
      e.nome = nome;
      renderLista();
      document.querySelectorAll('#anims div').forEach(d => d.classList.toggle('sel', d.dataset.n === nome));
      st.animName = nome;
      msgQ('💾 Criada "' + nome + '". Ela aparece nas listas de animação do editor de cenas.' + (orig ? '' : ''));
    } else if (a === 'original') {
      if (!FF.Mods.alterada(st.setId, e.nome)) {
        if (!e.mudou) return msgQ('Esta animação está como no jogo original.');
        if (!confirm('Descartar as mudanças não salvas?')) return;
      } else if (!confirm(FF.Mods.criada(st.setId, e.nome) ? 'Apagar a animação "' + e.nome + '" (criada por você)?' : 'Voltar "' + e.nome + '" ao original do jogo? Suas alterações salvas nela serão apagadas.')) return;
      const nome = e.nome;
      FF.Mods.restaurar(st.setId, nome);
      st.edit.mudou = false;
      sairEdicao(true);
      renderLista();
      if (st.set.has(nome)) abrirAnim(nome);
    } else if (a === 'exportar') {
      const n = FF.Mods.total();
      if (!n) return msgQ('Você ainda não salvou nenhuma alteração.');
      copiar(FF.Mods.exportar());
      msgQ('📤 ' + n + ' animação(ões) copiada(s). Cole na conversa com o Claude para virar parte fixa do jogo.');
    } else if (a === 'sair') sairEdicao();
  }

  function renderEdicao() {
    if (!st.edit) return;
    const sel = escolhidos();
    const durs = [...new Set(sel.map(k => st.anim.frames[k][7] || 1))];
    $('#edq-dur').textContent = durs.length === 1 ? durs[0] + '×' : 'vários';
    $('#edq-rep').max = st.anim.frames.length - 1;
    document.querySelectorAll('#edq [data-q="apagar"], #edq [data-q="duplicar"]').forEach(b => (b.textContent = b.textContent.replace(/ \(\d+\)$/, '') + (sel.length > 1 ? ' (' + sel.length + ')' : '')));
  }

  function mostrarOutros(nome) {
    const box = $('#edq-outros');
    box.innerHTML = '';
    if (!nome) { box.hidden = true; return; }
    const a = (st.set.def._orig && st.set.def._orig[nome] && !FF.Mods.alterada(st.setId, nome)) ? st.set.def._orig[nome] : st.set.def.anims[nome];
    const tit = document.createElement('small');
    tit.textContent = 'Toque num quadro de "' + nome + '" para inserir depois do quadro ' + st.i + ':';
    box.appendChild(tit);
    a.frames.forEach((f, k) => {
      const q = document.createElement('div'); q.className = 'q';
      const c = document.createElement('canvas'); const s = Math.min(1.2, 48 / f[4]);
      c.width = Math.max(8, Math.ceil(f[3] * s)); c.height = Math.ceil(f[4] * s);
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      g.drawImage(st.set.images[f[0]], f[1], f[2], f[3], f[4], 0, 0, c.width, c.height);
      q.append(c, document.createTextNode(String(k)));
      q.onclick = () => {
        const pos = st.i + 1;
        aplicarMudanca(fr => fr.splice(pos, 0, JSON.parse(JSON.stringify(f))), pos);
        st.edit.sel = new Set([pos]);
        renderLinha(); renderInfo();
        msgQ('Quadro ' + k + ' de "' + nome + '" inserido na posição ' + pos + '.');
      };
      box.appendChild(q);
    });
    const todos = document.createElement('button');
    todos.textContent = '➕ inserir todos';
    todos.onclick = () => {
      const pos = st.i + 1;
      aplicarMudanca(fr => fr.splice(pos, 0, ...JSON.parse(JSON.stringify(a.frames))), pos);
      st.edit.sel = new Set(a.frames.map((_, k) => pos + k));
      renderLinha(); renderInfo();
    };
    box.appendChild(todos);
    box.hidden = false;
  }

  // ---------- eventos da interface ----------
  function ligar() {
    $('#sel-sprite').onchange = (e) => { if (!sairEdicao()) { e.target.value = st.setId; return; } abrirSprite(e.target.value); };
    $('#busca').oninput = renderLista;
    $('#bt-play').onclick = () => { st.playing = !st.playing; if (st.playing && st.i === st.anim.frames.length - 1) st.i = 0; renderInfo(); };
    $('#bt-ant').onclick = () => passo(-1);
    $('#bt-prox').onclick = () => passo(1);
    $('#sel-vel').onchange = (e) => (st.vel = +e.target.value);
    $('#zoom').oninput = (e) => (st.zoom = +e.target.value);
    $('#ck-loop').onchange = (e) => (st.loop = e.target.checked);
    $('#ck-espelho').onchange = (e) => (st.espelho = e.target.checked);
    $('#ck-caixa').onchange = (e) => (st.caixa = e.target.checked);
    $('#ck-pontos').onchange = (e) => (st.pontos = e.target.checked);
    $('#ck-fantasma').onchange = (e) => (st.fantasma = e.target.checked);
    $('#sel-fundo').onchange = (e) => (st.fundo = e.target.value);
    $('#sel-uso').onchange = (e) => { st.uso = ((st.usos[st.setId] || {})[st.animName] || [])[+e.target.value] || null; renderLinha(); renderInfo(); };
    $('#bt-enviar').onclick = () => enviar({ tipo: 'anim', sprite: st.setId, anim: st.animName, quadro: st.i });
    $('#bt-copiar').onclick = () => copiar('sprite ' + st.setId + ' · animação ' + st.animName + ' · quadro ' + st.i + ' de ' + (st.anim.frames.length - 1));
    $('#busca-som').oninput = renderSons;
    $('#bt-edq').onclick = iniciarEdicao;
    document.querySelectorAll('#edq [data-q]').forEach(b => b.onclick = () => acaoQ(b.dataset.q));
    $('#edq-fps').onchange = (e) => { if (!st.edit) return; guardar(); st.anim.fps = Math.max(1, +e.target.value || 10); renderInfo(); };
    $('#edq-loop').onchange = (e) => { if (!st.edit) return; guardar(); st.anim.loop = e.target.checked; };
    $('#edq-rep').onchange = (e) => { if (!st.edit) return; guardar(); st.anim.repeatTo = Math.max(0, Math.min(st.anim.frames.length - 1, +e.target.value || 0)); };
    $('#edq-outra').onchange = (e) => mostrarOutros(e.target.value);
    document.querySelectorAll('.aba').forEach(b => b.onclick = () => {
      document.querySelectorAll('.aba').forEach(x => x.classList.toggle('sel', x === b));
      $('#aba-anims').hidden = b.dataset.aba !== 'anims';
      $('#aba-sons').hidden = b.dataset.aba !== 'sons';
      if (b.dataset.aba === 'sons') renderSons();
    });
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'search') return;
      if (st.edit && /INPUT|SELECT/.test(e.target.tagName)) return;
      if (st.edit && (e.code === 'Delete' || e.code === 'Backspace')) { e.preventDefault(); return acaoQ('apagar'); }
      if (st.edit && (e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); return acaoQ('desfazer'); }
      if (e.code === 'Space') { e.preventDefault(); $('#bt-play').click(); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); passo(-1); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); passo(1); }
      else if (st.edit && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) { /* na edição, ↑↓ não troca de animação */ }
      else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
        const vis = [...document.querySelectorAll('#anims div')];
        const i = vis.findIndex(d => d.dataset.n === st.animName);
        const j = Math.max(0, Math.min(vis.length - 1, i + (e.code === 'ArrowDown' ? 1 : -1)));
        if (vis[j]) { abrirAnim(vis[j].dataset.n); vis[j].scrollIntoView({ block: 'nearest' }); }
      }
    });
  }

  function passo(d) {
    const n = st.anim.frames.length;
    st.playing = false;
    st.i = (st.i + d + n) % n;
    st.t = 0;
    if (st.edit) { st.edit.sel = new Set([st.i]); renderLinha(); renderEdicao(); }
    renderInfo();
  }

  // lista de sprites do jogo
  async function preencherSprites(abrirId) {
    const sel = $('#sel-sprite');
    const atual = abrirId || sel.value;
    sel.innerHTML = '';
    const g1 = document.createElement('optgroup'); g1.label = 'Do jogo';
    IDX.sprites.forEach(id => { const o = document.createElement('option'); o.value = id; o.textContent = id; g1.appendChild(o); });
    sel.appendChild(g1);
    if (atual && [...sel.options].some(o => o.value === atual)) sel.value = atual;
  }
  window.FFVis = {
    editar() { if (!st.edit) iniciarEdicao(); },
    async recarregarLista(id) {
      if (id) delete FF.Assets.sprites[id];
      await preencherSprites(id);
      if (id) await abrirSprite(id);
    },
  };

  async function iniciar() {
    st.usos = indexarUsos();
    const sel = $('#sel-sprite');
    await preencherSprites();
    ligar();
    FF.Assets.loadSprite('stage_campo').catch(() => {});
    const params = new URLSearchParams(location.search);
    const ini = params.get('sprite') && IDX.sprites.includes(params.get('sprite')) ? params.get('sprite') : (IDX.sprites.includes('gokubase') ? 'gokubase' : IDX.sprites[0]);
    sel.value = ini;
    await abrirSprite(ini);
    if (params.get('anim') && st.set.has(params.get('anim'))) abrirAnim(params.get('anim'));
    requestAnimationFrame(loop);
  }

  window.addEventListener('load', () => iniciar().catch(err => { console.error(err); document.body.insertAdjacentHTML('afterbegin', '<p style="color:#f88">Erro: ' + err.message + '</p>'); }));
})();
