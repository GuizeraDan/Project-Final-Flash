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
      d.innerHTML = '<span>' + nome + '</span><small>' + a.frames.length + 'q · ' + (a.fps || 0) + 'fps' + (a.loop ? ' ↻' : '') + '</small>';
      d.onclick = () => abrirAnim(nome);
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

  // ---------- eventos da interface ----------
  function ligar() {
    $('#sel-sprite').onchange = (e) => abrirSprite(e.target.value);
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
    document.querySelectorAll('.aba').forEach(b => b.onclick = () => {
      document.querySelectorAll('.aba').forEach(x => x.classList.toggle('sel', x === b));
      $('#aba-anims').hidden = b.dataset.aba !== 'anims';
      $('#aba-sons').hidden = b.dataset.aba !== 'sons';
      if (b.dataset.aba === 'sons') renderSons();
    });
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'search') return;
      if (e.code === 'Space') { e.preventDefault(); $('#bt-play').click(); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); passo(-1); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); passo(1); }
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
    renderInfo();
  }

  async function iniciar() {
    st.usos = indexarUsos();
    const sel = $('#sel-sprite');
    IDX.sprites.forEach(id => { const o = document.createElement('option'); o.value = id; o.textContent = id; sel.appendChild(o); });
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
