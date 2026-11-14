// Estúdio — ✂ Editor livre de quadros (aba Sprites).
// Os quadros escolhidos viram camadas soltas num palco: arrastar move, as bordas recortam, dá para esticar,
// espelhar, duplicar, mudar a ordem e marcar a origem. "Criar quadro" junta tudo numa imagem só.
//
// FF.EstudioMontador.abrir({ set, quadros: [quadro], todos: [quadro], aoCriar({ img, ox, oy, pontos, dur }, substituir) })
//   quadro = [atlas, x, y, w, h, ox, oy, dur, pontos]
window.FF = window.FF || {};

FF.EstudioMontador = (function () {
  'use strict';
  const E = () => FF.Estudio;
  let estiloPronto = false;

  function estilo() {
    if (estiloPronto) return;
    estiloPronto = true;
    const s = document.createElement('style');
    s.textContent = `
.es-modal-caixa.mt-caixa { width:min(1280px, 97vw); }
.mt { display:flex; gap:10px; height:min(740px, 80vh); box-sizing:border-box; overflow:hidden !important; }
.mt-palco { flex:1; min-width:0; position:relative; background:#1b1530; border-radius:8px; overflow:hidden; display:flex; flex-direction:column; }
.mt-barra { display:flex; gap:4px; flex-wrap:wrap; padding:6px; background:#241c3d; align-items:center; }
.mt-barra button.on { background:#6b4bd8; color:#fff; border-color:#b49cff; }
.mt-cv { flex:1; width:100%; display:block; cursor:default; touch-action:none; }
.mt-info { position:absolute; left:8px; bottom:6px; font:11px monospace; color:#cfc6ff; pointer-events:none; text-shadow:0 1px 2px #000; }
.mt-lado { width:300px; flex:none; overflow:auto; display:flex; flex-direction:column; gap:6px; }
.mt-camadas { display:flex; flex-direction:column; gap:3px; }
.mt-cam { display:flex; align-items:center; gap:6px; padding:4px; border:1px solid #3d3363; border-radius:6px; cursor:pointer; background:#211a38; }
.mt-cam.sel { border-color:#ffd54a; background:#2e2552; }
.mt-cam canvas { width:56px; height:32px; image-rendering:pixelated; background:#140f26; border-radius:4px; }
.mt-cam span { flex:1; font-size:12px; }
.mt-bts { display:flex; flex-wrap:wrap; gap:4px; }
.mt-dica { font-size:11px; opacity:.8; line-height:1.35; }
`;
    document.head.appendChild(s);
  }

  function abrir(o) {
    estilo();
    const Es = E();
    const set = o.set;
    // camadas
    let n = 0;
    const camadaDe = (f) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, f[3]); c.height = Math.max(1, f[4]);
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(set.images[f[0]], f[1], f[2], f[3], f[4], 0, 0, f[3], f[4]);
      const dados = g.getImageData(0, 0, c.width, c.height);   // falha em file:// com imagem do jogo (SecurityError)
      return { id: ++n, nome: 'Camada ' + n, c, dados, cx: 0, cy: 0, cw: c.width, ch: c.height, x: 0, y: 0, esc: 1, flip: false, vis: true, ox: f[5], oy: f[6], pontos: f[8] || null, dur: f[7] || 1 };
    };
    let cams;
    try { cams = o.quadros.map(camadaDe); } catch (e) { Es.aviso('❌ Não consegui ler os pixels: ' + e.message, 'erro'); return; }
    // posição inicial: lado a lado, centralizados na altura do primeiro
    let px = 0;
    const h0 = cams[0].ch;
    cams.forEach(k => { k.x = px; k.y = Math.round((h0 - k.ch) / 2); px += k.cw; });
    let sel = cams[0];
    let origem = [cams[0].x + cams[0].ox, cams[0].y + cams[0].oy];
    let modo = 'mover';
    const hist = [];   // desfazer
    const foto = () => JSON.stringify({ cams: cams.map(k => Object.assign({}, k, { c: undefined, dados: undefined, _c: k.id })), origem, sel: sel && sel.id });
    const canvases = {};
    const guardar = () => { cams.forEach(k => { canvases[k.id] = { c: k.c, dados: k.dados }; }); hist.push(foto()); if (hist.length > 80) hist.shift(); };
    const desfazer = () => {
      if (!hist.length) return;
      const s = JSON.parse(hist.pop());
      cams = s.cams.map(k => Object.assign(k, canvases[k._c] || canvases[k.id]));
      origem = s.origem; sel = cams.find(k => k.id === s.sel) || cams[0];
      tudo();
    };

    // ---------- interface
    const raiz = Es.el('div', 'mt');
    const palco = Es.el('div', 'mt-palco');
    const barra = Es.el('div', 'mt-barra');
    const cv = document.createElement('canvas'); cv.className = 'mt-cv';
    const info = Es.el('div', 'mt-info');
    palco.append(barra, cv, info);
    const lado = Es.el('div', 'mt-lado');
    raiz.append(palco, lado);
    const MODOS = [['mover', '✥ Mover', 'Arraste uma camada para mover (setas = 1 px, Shift = 10 px)'], ['recortar', '✂ Recortar', 'Arraste as bordas da camada escolhida para cortar'], ['origem', '✚ Origem', 'Clique para marcar a origem (os pés) do quadro novo'], ['mao', '✋ Vista', 'Arraste para mover a vista (roda do mouse = zoom)']];
    const btModo = {};
    MODOS.forEach(([m, t, d]) => { btModo[m] = Es.botao(t, () => { modo = m; tudo(); }, d); barra.appendChild(btModo[m]); });
    barra.appendChild(Es.botao('⤢ Enquadrar', () => { enquadrar(); desenhar(); }, 'Mostra tudo'));
    barra.appendChild(Es.botao('↶ Desfazer', () => desfazer(), 'Ctrl+Z'));

    const m = Es.modal('✂ Editor livre de quadro', raiz, { larga: true, aoFechar: () => { window.removeEventListener('keydown', tecla, true); window.removeEventListener('resize', ajustar); } });
    raiz.parentNode.classList.add('mt-caixa');

    // ---------- vista
    let z = 2, vx = 0, vy = 0, W = 10, H = 10, dpr = 1;
    function ajustar() {
      const r = cv.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      W = Math.max(10, r.width); H = Math.max(10, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      desenhar();
    }
    const larg = (k) => k.cw * k.esc, alt = (k) => k.ch * k.esc;
    function caixa() {
      const vis = cams.filter(k => k.vis);
      if (!vis.length) return { x0: 0, y0: 0, x1: 1, y1: 1 };
      return { x0: Math.floor(Math.min(...vis.map(k => k.x))), y0: Math.floor(Math.min(...vis.map(k => k.y))), x1: Math.ceil(Math.max(...vis.map(k => k.x + larg(k)))), y1: Math.ceil(Math.max(...vis.map(k => k.y + alt(k)))) };
    }
    function enquadrar() {
      const b = caixa(), bw = b.x1 - b.x0 + 40, bh = b.y1 - b.y0 + 40;
      z = Math.max(0.25, Math.min(12, Math.min(W / bw, H / bh)));
      vx = W / 2 - ((b.x0 + b.x1) / 2) * z; vy = H / 2 - ((b.y0 + b.y1) / 2) * z;
    }
    const tela = (x, y) => [x * z + vx, y * z + vy];
    const mundo = (sx, sy) => [(sx - vx) / z, (sy - vy) / z];

    function desenhar() {
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      // xadrez
      const q = 12;
      for (let y = 0; y < H; y += q) for (let x = 0; x < W; x += q) { g.fillStyle = ((x / q + y / q) & 1) ? '#221a3c' : '#1b1530'; g.fillRect(x, y, q, q); }
      const b = caixa();
      g.save();
      g.translate(vx, vy); g.scale(z, z);
      g.imageSmoothingEnabled = false;
      cams.forEach(k => {
        if (!k.vis) return;
        g.save();
        if (k.flip) { g.translate(k.x + larg(k), k.y); g.scale(-1, 1); g.drawImage(k.c, k.cx, k.cy, k.cw, k.ch, 0, 0, larg(k), alt(k)); }
        else g.drawImage(k.c, k.cx, k.cy, k.cw, k.ch, k.x, k.y, larg(k), alt(k));
        g.restore();
      });
      g.restore();
      // caixa do quadro final
      g.setLineDash([5, 4]); g.strokeStyle = '#8f86c9'; g.lineWidth = 1;
      const [bx, by] = tela(b.x0, b.y0);
      g.strokeRect(bx + 0.5, by + 0.5, (b.x1 - b.x0) * z, (b.y1 - b.y0) * z);
      g.setLineDash([]);
      // camada escolhida
      if (sel && sel.vis) {
        const [sx, sy] = tela(sel.x, sel.y);
        g.strokeStyle = modo === 'recortar' ? '#ff7a59' : '#ffd54a'; g.lineWidth = 2;
        g.strokeRect(sx, sy, larg(sel) * z, alt(sel) * z);
        if (modo === 'recortar') {
          g.fillStyle = '#ff7a59';
          const w = larg(sel) * z, h = alt(sel) * z;
          [[sx, sy + h / 2], [sx + w, sy + h / 2], [sx + w / 2, sy], [sx + w / 2, sy + h]].forEach(([a, c]) => g.fillRect(a - 5, c - 5, 10, 10));
        }
      }
      // origem
      const [ox, oy] = tela(origem[0], origem[1]);
      g.strokeStyle = '#ff3b3b'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(ox - 9, oy); g.lineTo(ox + 9, oy); g.moveTo(ox, oy - 9); g.lineTo(ox, oy + 9); g.stroke();
      info.textContent = 'quadro final ' + (b.x1 - b.x0) + '×' + (b.y1 - b.y0) + ' px · zoom ' + Math.round(z * 100) + '%' + (sel ? ' · ' + sel.nome + ' em ' + Math.round(sel.x - b.x0) + ',' + Math.round(sel.y - b.y0) : '');
    }

    // ---------- mouse
    function acertar(wx, wy) {
      for (let i = cams.length - 1; i >= 0; i--) {
        const k = cams[i];
        if (!k.vis || wx < k.x || wy < k.y || wx >= k.x + larg(k) || wy >= k.y + alt(k)) continue;
        let u = Math.floor((wx - k.x) / k.esc); const v = Math.floor((wy - k.y) / k.esc);
        if (k.flip) u = k.cw - 1 - u;
        const sx = k.cx + u, sy = k.cy + v;
        if (k.dados.data[(sy * k.c.width + sx) * 4 + 3] > 8) return k;
      }
      // sem pixel: a escolhida, se o clique cair na caixa dela
      if (sel && sel.vis && wx >= sel.x && wy >= sel.y && wx < sel.x + larg(sel) && wy < sel.y + alt(sel)) return sel;
      return null;
    }
    function bordaEm(sx, sy) {
      if (!sel || !sel.vis) return null;
      const [x0, y0] = tela(sel.x, sel.y), x1 = x0 + larg(sel) * z, y1 = y0 + alt(sel) * z, t = 8;
      const dentroY = sy > y0 - t && sy < y1 + t, dentroX = sx > x0 - t && sx < x1 + t;
      if (dentroY && Math.abs(sx - x0) < t) return 'e';
      if (dentroY && Math.abs(sx - x1) < t) return 'd';
      if (dentroX && Math.abs(sy - y0) < t) return 'c';
      if (dentroX && Math.abs(sy - y1) < t) return 'b';
      return null;
    }
    let arr = null;
    cv.addEventListener('pointerdown', (e) => {
      const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      const [wx, wy] = mundo(sx, sy);
      cv.setPointerCapture(e.pointerId);
      if (modo === 'mao' || e.button === 1 || e.button === 2) { arr = { tipo: 'vista', sx, sy, vx, vy }; return; }
      if (modo === 'origem') { guardar(); origem = [Math.round(wx), Math.round(wy)]; desenhar(); arr = { tipo: 'origem' }; return; }
      if (modo === 'recortar') {
        const bd = bordaEm(sx, sy);
        if (bd) { guardar(); arr = { tipo: 'corte', bd, wx, wy, k: Object.assign({}, sel) }; return; }
      }
      const k = acertar(wx, wy);
      if (k) { sel = k; guardar(); arr = { tipo: 'mover', wx, wy, x: k.x, y: k.y }; renderLado(); desenhar(); }
      else arr = { tipo: 'vista', sx, sy, vx, vy };
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      const [wx, wy] = mundo(sx, sy);
      if (!arr) { cv.style.cursor = modo === 'recortar' ? ({ e: 'ew-resize', d: 'ew-resize', c: 'ns-resize', b: 'ns-resize' }[bordaEm(sx, sy)] || 'default') : modo === 'mao' ? 'grab' : modo === 'origem' ? 'crosshair' : 'move'; return; }
      if (arr.tipo === 'vista') { vx = arr.vx + sx - arr.sx; vy = arr.vy + sy - arr.sy; }
      else if (arr.tipo === 'origem') origem = [Math.round(wx), Math.round(wy)];
      else if (arr.tipo === 'mover') { sel.x = Math.round(arr.x + wx - arr.wx); sel.y = Math.round(arr.y + wy - arr.wy); }
      else if (arr.tipo === 'corte') cortar(arr, wx - arr.wx, wy - arr.wy);
      desenhar();
    });
    const soltar = () => { if (arr && arr.tipo !== 'vista') renderLado(); arr = null; };
    cv.addEventListener('pointerup', soltar);
    cv.addEventListener('pointercancel', soltar);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      const [wx, wy] = mundo(sx, sy);
      z = Math.max(0.25, Math.min(16, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      vx = sx - wx * z; vy = sy - wy * z;
      desenhar();
    }, { passive: false });

    // corta a camada pelas bordas (em pixels da imagem original)
    function cortar(a, dx, dy) {
      const k0 = a.k, k = sel, W0 = k.c.width, H0 = k.c.height;
      Object.assign(k, { cx: k0.cx, cy: k0.cy, cw: k0.cw, ch: k0.ch, x: k0.x, y: k0.y });
      if (a.bd === 'e' || a.bd === 'd') {
        let ds = Math.round(dx / k.esc);
        if (a.bd === 'e') {
          ds = Math.max(-(k.flip ? W0 - k.cx - k.cw : k.cx), Math.min(k.cw - 1, ds));
          if (!k.flip) k.cx += ds;
          k.cw -= ds; k.x += ds * k.esc;
        } else {
          ds = Math.max(-(k.cw - 1), Math.min(k.flip ? k.cx : W0 - k.cx - k.cw, ds));
          if (k.flip) k.cx -= ds;
          k.cw += ds;
        }
      } else {
        let ds = Math.round(dy / k.esc);
        if (a.bd === 'c') { ds = Math.max(-k.cy, Math.min(k.ch - 1, ds)); k.cy += ds; k.ch -= ds; k.y += ds * k.esc; }
        else { ds = Math.max(-(k.ch - 1), Math.min(H0 - k.cy - k.ch, ds)); k.ch += ds; }
      }
    }

    // tira a borda transparente da camada escolhida
    function aparar(k) {
      const d = k.dados.data, w = k.c.width;
      let x0 = k.cx + k.cw, y0 = k.cy + k.ch, x1 = -1, y1 = -1;
      for (let y = k.cy; y < k.cy + k.ch; y++) for (let x = k.cx; x < k.cx + k.cw; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return;
      guardar();
      const esqAntes = k.flip ? (k.cx + k.cw - 1 - x1) : (x0 - k.cx);
      k.x += esqAntes * k.esc; k.y += (y0 - k.cy) * k.esc;
      k.cx = x0; k.cy = y0; k.cw = x1 - x0 + 1; k.ch = y1 - y0 + 1;
    }

    // ---------- teclado
    function tecla(e) {
      if (!document.body.contains(m.el)) return;
      const alvo = e.target, digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT');
      if (e.key === 'Escape') { e.stopPropagation(); return; }
      if (digitando) { e.stopPropagation(); return; }
      const passo = e.shiftKey ? 10 : 1;
      let feito = true;
      if (e.key === 'ArrowLeft' && sel) { guardar(); sel.x -= passo; }
      else if (e.key === 'ArrowRight' && sel) { guardar(); sel.x += passo; }
      else if (e.key === 'ArrowUp' && sel) { guardar(); sel.y -= passo; }
      else if (e.key === 'ArrowDown' && sel) { guardar(); sel.y += passo; }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) apagar(sel);
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && sel) duplicar(sel);
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') desfazer();
      else feito = false;
      e.stopPropagation();
      if (feito) { e.preventDefault(); tudo(); }
    }
    window.addEventListener('keydown', tecla, true);
    window.addEventListener('resize', ajustar);

    function duplicar(k) {
      guardar();
      const c = Object.assign({}, k, { id: ++n, nome: k.nome.replace(/ \(cópia.*\)$/, '') + ' (cópia)', x: k.x + Math.round(larg(k)), pontos: null });
      cams.splice(cams.indexOf(k) + 1, 0, c);
      sel = c;
    }
    function apagar(k) {
      if (cams.length <= 1) return Es.aviso('Precisa de pelo menos uma camada.', 'erro');
      guardar();
      const i = cams.indexOf(k);
      cams.splice(i, 1);
      sel = cams[Math.min(i, cams.length - 1)];
    }
    function ordem(k, d) {
      const i = cams.indexOf(k), j = i + d;
      if (j < 0 || j >= cams.length) return;
      guardar();
      cams.splice(i, 1); cams.splice(j, 0, k);
    }

    // ---------- painel da direita
    function renderLado() {
      lado.innerHTML = '';
      lado.appendChild(Es.el('div', 'mt-dica', '<b>✥ Mover</b>: arraste as camadas · <b>✂ Recortar</b>: arraste as bordas da camada escolhida · <b>✚ Origem</b>: clique onde ficam os pés · roda do mouse = zoom · setas = 1 px (Shift 10) · Ctrl+D duplica · Delete apaga.'));
      const g1 = Es.grupo('🗂 Camadas (a de baixo fica na frente)');
      const lista = Es.el('div', 'mt-camadas');
      cams.forEach(k => {
        const it = Es.el('div', 'mt-cam' + (k === sel ? ' sel' : ''));
        const mini = document.createElement('canvas'); mini.width = 112; mini.height = 64;
        const mg = mini.getContext('2d'); mg.imageSmoothingEnabled = false;
        const s = Math.min(112 / k.cw, 64 / k.ch);
        mg.drawImage(k.c, k.cx, k.cy, k.cw, k.ch, (112 - k.cw * s) / 2, (64 - k.ch * s) / 2, k.cw * s, k.ch * s);
        const nm = Es.el('span'); nm.textContent = k.nome;
        const olho = Es.botao(k.vis ? '👁' : '🙈', (ev) => { ev.stopPropagation(); guardar(); k.vis = !k.vis; tudo(); }, 'Mostrar/esconder');
        it.append(mini, nm, olho);
        it.onclick = () => { sel = k; tudo(); };
        lista.appendChild(it);
      });
      g1.appendChild(lista);
      const bAdd = Es.el('div', 'mt-bts');
      if (o.todos && o.todos.length) {
        bAdd.appendChild(Es.campo('select', '＋ Quadro', '', (v) => {
          if (v === '') return;
          try { guardar(); const k = camadaDe(o.todos[+v]); const b = caixa(); k.x = b.x1; k.y = b.y0; k.nome = 'Quadro ' + (+v + 1); cams.push(k); sel = k; tudo(); } catch (e) { Es.aviso('❌ ' + e.message, 'erro'); }
        }, { lista: [['', 'adicionar quadro da animação…']].concat(o.todos.map((_, i) => [String(i), 'Quadro ' + (i + 1)])) }));
      }
      g1.appendChild(bAdd);
      lado.appendChild(g1);

      if (sel) {
        const k = sel;
        const g2 = Es.grupo('🖼 ' + k.nome);
        const b = caixa();
        const num = (rot, val, fn, op) => g2.appendChild(Es.campo('numero', rot, val, (v, vivo) => { if (v == null) return; if (!vivo) guardar(); fn(v); desenhar(); if (!vivo) renderLado(); }, op || { passo: 1 }));
        num('X', Math.round(k.x - b.x0), (v) => { k.x = b.x0 + Math.round(v); });
        num('Y', Math.round(k.y - b.y0), (v) => { k.y = b.y0 + Math.round(v); });
        num('Tamanho (%)', Math.round(k.esc * 100), (v) => { const c = [k.x + larg(k) / 2, k.y + alt(k) / 2]; k.esc = Math.max(0.05, v / 100); k.x = Math.round(c[0] - larg(k) / 2); k.y = Math.round(c[1] - alt(k) / 2); }, { passo: 5, min: 5 });
        g2.appendChild(Es.campo('check', 'Espelhar', k.flip, (v) => { guardar(); k.flip = !!v; tudo(); }));
        g2.appendChild(Es.el('div', 'mt-dica', 'Recorte (pixels da imagem original ' + k.c.width + '×' + k.c.height + '):'));
        num('Corte X', k.cx, (v) => { k.cx = Math.max(0, Math.min(k.c.width - 1, Math.round(v))); k.cw = Math.min(k.cw, k.c.width - k.cx); });
        num('Corte Y', k.cy, (v) => { k.cy = Math.max(0, Math.min(k.c.height - 1, Math.round(v))); k.ch = Math.min(k.ch, k.c.height - k.cy); });
        num('Largura', k.cw, (v) => { k.cw = Math.max(1, Math.min(k.c.width - k.cx, Math.round(v))); });
        num('Altura', k.ch, (v) => { k.ch = Math.max(1, Math.min(k.c.height - k.cy, Math.round(v))); });
        const bts = Es.el('div', 'mt-bts');
        bts.append(
          Es.botao('✂ Aparar', () => { aparar(k); tudo(); }, 'Tira a borda transparente da camada'),
          Es.botao('⟲ Sem corte', () => { guardar(); Object.assign(k, { cx: 0, cy: 0, cw: k.c.width, ch: k.c.height }); tudo(); }, 'Volta a imagem inteira'),
          Es.botao('⧉ Duplicar', () => { duplicar(k); tudo(); }, 'Ctrl+D — bom para repetir um pedaço do raio'),
          Es.botao('⬆ Para trás', () => { ordem(k, -1); tudo(); }, 'Desenha antes (fica atrás das outras)'),
          Es.botao('⬇ Para frente', () => { ordem(k, 1); tudo(); }, 'Desenha depois (fica na frente)'),
          Es.botao('✚ Origem aqui', () => { guardar(); origem = [Math.round(k.x + (k.flip ? k.cw - (k.ox - k.cx) : k.ox - k.cx) * k.esc), Math.round(k.y + (k.oy - k.cy) * k.esc)]; tudo(); }, 'Põe a origem do quadro novo na origem original desta camada'),
          Es.botao('🗑 Apagar', () => { apagar(k); tudo(); }, 'Delete', 'es-bt-perigo'));
        g2.appendChild(bts);
        lado.appendChild(g2);
      }

      const g3 = Es.grupo('💾 Criar o quadro');
      g3.appendChild(Es.el('div', 'mt-dica', 'O quadro novo é a caixa tracejada (só camadas visíveis). A cruz vermelha é a origem (pés).'));
      const bf = Es.el('div', 'mt-bts');
      bf.append(
        Es.botao('✔ Substituir os escolhidos', () => criar(true), 'Os quadros que você escolheu na tira viram este quadro', 'es-bt-ouro'),
        Es.botao('＋ Adicionar como quadro novo', () => criar(false), 'Entra depois dos escolhidos; os originais ficam'));
      g3.appendChild(bf);
      lado.appendChild(g3);
    }

    async function criar(substituir) {
      const b = caixa(), w = b.x1 - b.x0, h = b.y1 - b.y0;
      if (w > 2048 || h > 2048) return Es.aviso('O quadro ficaria com ' + w + '×' + h + ' px (máximo 2048).', 'erro');
      const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h);
      const g = c.getContext('2d', { willReadFrequently: true });
      g.imageSmoothingEnabled = false;
      cams.forEach(k => {
        if (!k.vis) return;
        g.save();
        const x = k.x - b.x0, y = k.y - b.y0;
        if (k.flip) { g.translate(x + larg(k), y); g.scale(-1, 1); g.drawImage(k.c, k.cx, k.cy, k.cw, k.ch, 0, 0, larg(k), alt(k)); }
        else g.drawImage(k.c, k.cx, k.cy, k.cw, k.ch, x, y, larg(k), alt(k));
        g.restore();
      });
      const ox = Math.round(origem[0] - b.x0), oy = Math.round(origem[1] - b.y0);
      // ponto de disparo: o da primeira camada que tiver, levado para a posição dela no quadro novo
      let pontos = null;
      const kp = cams.find(k => k.vis && k.pontos && k.pontos.length);
      if (kp) {
        const oxk = kp.x + (kp.flip ? kp.cw - (kp.ox - kp.cx) : kp.ox - kp.cx) * kp.esc, oyk = kp.y + (kp.oy - kp.cy) * kp.esc;
        pontos = kp.pontos.map(p => [Math.round(oxk + p[0] * (kp.flip ? -1 : 1) * kp.esc - origem[0]), Math.round(oyk + p[1] * kp.esc - origem[1])]);
      }
      try {
        await o.aoCriar({ img: FF.Imagem.deCanvas(c), ox, oy, pontos, dur: cams[0].dur }, substituir);
        m.fechar();
      } catch (e) { Es.aviso('❌ ' + e.message, 'erro'); }
    }

    function tudo() {
      Object.entries(btModo).forEach(([k, b]) => b.classList.toggle('on', k === modo));
      renderLado();
      desenhar();
    }
    requestAnimationFrame(() => { ajustar(); enquadrar(); tudo(); });
    return { fechar: m.fechar, get camadas() { return cams; }, criar, set origem(v) { origem = v; } };
  }

  return { abrir };
})();
