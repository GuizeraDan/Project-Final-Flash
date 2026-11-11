// Importador de sprites: abre imagens (PNG, JPG, GIF/WebP animados, BMP, AVIF, SVG… o que o
// navegador souber ler), detecta os quadros de uma sprite sheet (automático ou por grade),
// remove a cor de fundo, monta animações e salva um pacote na Biblioteca (FF.Biblioteca).
(function () {
  const $ = (s) => document.querySelector(s);
  const st = {
    arquivos: [],      // {nome, sheet: canvas}
    atual: -1,
    caixas: [],        // {x, y, w, h}
    sel: [],           // índices das caixas na ordem em que foram escolhidas
    zoom: 2,
    anims: [],         // {nome, fps, loop, origem, quadros: [canvas]}
    previa: null,
  };

  // ---------- leitura de arquivos ----------
  async function lerArquivo(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    // GIF/WebP/APNG animados: um quadro por imagem, lado a lado numa folha
    if (window.ImageDecoder && /^(gif|webp|png|apng|avif)$/.test(ext)) {
      try {
        const tipo = file.type || ('image/' + (ext === 'apng' ? 'png' : ext));
        if (await ImageDecoder.isTypeSupported(tipo)) {
          const dec = new ImageDecoder({ data: await file.arrayBuffer(), type: tipo });
          await dec.tracks.ready;
          const n = dec.tracks.selectedTrack ? dec.tracks.selectedTrack.frameCount : 1;
          if (n > 1) {
            const quadros = [];
            for (let i = 0; i < n; i++) quadros.push((await dec.decode({ frameIndex: i })).image);
            const w = quadros[0].displayWidth, h = quadros[0].displayHeight;
            const cv = document.createElement('canvas');
            cv.width = w * n; cv.height = h;
            const g = cv.getContext('2d');
            quadros.forEach((q, i) => { g.drawImage(q, i * w, 0); q.close(); });
            return { nome: file.name + ' (' + n + ' quadros)', sheet: cv, animado: { n, w, h } };
          }
        }
      } catch (e) { /* cai para a leitura comum */ }
    }
    let bmp;
    try { bmp = await createImageBitmap(file); }
    catch (e) {
      bmp = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error('O navegador não consegue abrir "' + file.name + '". Exporte como PNG (no Photoshop/Aseprite: Exportar → PNG).')); i.src = URL.createObjectURL(file); });
    }
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    return { nome: file.name, sheet: cv };
  }

  async function adicionarArquivos(files) {
    for (const f of files) {
      try { st.arquivos.push(await lerArquivo(f)); }
      catch (e) { aviso('❌ ' + e.message); }
    }
    renderArquivos();
    if (st.arquivos.length) escolherArquivo(st.arquivos.length - 1);
  }

  function escolherArquivo(i) {
    st.atual = i;
    const a = st.arquivos[i];
    // fundo: se a imagem não tem transparência, sugere remover a cor do canto
    const g = a.sheet.getContext('2d');
    const d = g.getImageData(0, 0, a.sheet.width, a.sheet.height).data;
    let temAlfa = false;
    for (let k = 3; k < d.length; k += 4 * 7) if (d[k] < 250) { temAlfa = true; break; }
    const c = g.getImageData(0, 0, 1, 1).data;
    $('#imp-cor').value = '#' + [c[0], c[1], c[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    $('#imp-fundo').checked = !temAlfa;
    if (a.animado) { $('#imp-modo').value = 'grade'; $('#imp-gw').value = a.animado.w; $('#imp-gh').value = a.animado.h; $('#imp-gc').value = ''; $('#imp-gl').value = ''; }
    else if (a.modo) { $('#imp-modo').value = a.modo; }
    else { $('#imp-modo').value = 'auto'; $('#imp-gw').value = ''; $('#imp-gh').value = ''; }
    mostrarModo();
    renderArquivos();
    detectar();
  }

  // ---------- detecção ----------
  function mascara(sheet) {
    const w = sheet.width, h = sheet.height;
    const d = sheet.getContext('2d').getImageData(0, 0, w, h).data;
    const m = new Uint8Array(w * h);
    const usaCor = $('#imp-fundo').checked;
    const [kr, kg, kb] = hex($('#imp-cor').value);
    const tol = +$('#imp-tol').value;
    for (let i = 0, p = 0; i < m.length; i++, p += 4) {
      if (d[p + 3] < 16) continue;
      if (usaCor && Math.abs(d[p] - kr) + Math.abs(d[p + 1] - kg) + Math.abs(d[p + 2] - kb) <= tol * 3) continue;
      m[i] = 1;
    }
    return { m, w, h };
  }

  function detectarAuto(sheet) {
    const { m, w, h } = mascara(sheet);
    const vis = new Uint8Array(w * h);
    const caixas = [];
    const pilha = [];
    for (let i = 0; i < m.length; i++) {
      if (!m[i] || vis[i]) continue;
      let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
      pilha.push(i); vis[i] = 1;
      while (pilha.length) {
        const k = pilha.pop(), x = k % w, y = (k / w) | 0;
        n++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (m[j] && !vis[j]) { vis[j] = 1; pilha.push(j); }
        }
      }
      caixas.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n });
    }
    // junta pedaços próximos (cabelo, faíscas soltas…)
    const jun = +$('#imp-juncao').value;
    let mudou = true;
    while (mudou) {
      mudou = false;
      for (let a = 0; a < caixas.length && !mudou; a++) for (let b = a + 1; b < caixas.length; b++) {
        const A = caixas[a], B = caixas[b];
        if (A.x - jun <= B.x + B.w && B.x - jun <= A.x + A.w && A.y - jun <= B.y + B.h && B.y - jun <= A.y + A.h) {
          const x = Math.min(A.x, B.x), y = Math.min(A.y, B.y);
          caixas[a] = { x, y, w: Math.max(A.x + A.w, B.x + B.w) - x, h: Math.max(A.y + A.h, B.y + B.h) - y, n: A.n + B.n };
          caixas.splice(b, 1); mudou = true; break;
        }
      }
    }
    const min = +$('#imp-min').value;
    return ordenar(caixas.filter(c => c.n >= min && c.w * c.h >= min));
  }

  // ordem de leitura: linhas de cima para baixo, esquerda para a direita
  function ordenar(cx) {
    cx.sort((a, b) => a.y - b.y);
    const linhas = [];
    for (const c of cx) {
      const meio = c.y + c.h / 2;
      const l = linhas.find(r => meio >= r.y0 && meio <= r.y1);
      if (l) { l.itens.push(c); l.y0 = Math.min(l.y0, c.y); l.y1 = Math.max(l.y1, c.y + c.h); }
      else linhas.push({ y0: c.y, y1: c.y + c.h, itens: [c] });
    }
    return linhas.flatMap(l => l.itens.sort((a, b) => a.x - b.x));
  }

  function detectarGrade(sheet) {
    const W = sheet.width, H = sheet.height;
    const mg = +$('#imp-gm').value || 0, sp = +$('#imp-gs').value || 0;
    let cw = +$('#imp-gw').value, ch = +$('#imp-gh').value;
    const cols = +$('#imp-gc').value, rows = +$('#imp-gl').value;
    if (cols && !cw) cw = Math.floor((W - 2 * mg - sp * (cols - 1)) / cols);
    if (rows && !ch) ch = Math.floor((H - 2 * mg - sp * (rows - 1)) / rows);
    if (!cw || !ch) { aviso('Informe colunas/linhas ou largura/altura do quadro.'); return []; }
    const { m, w } = mascara(sheet);
    const cx = [];
    for (let y = mg; y + ch <= H - mg + 0.5; y += ch + sp) for (let x = mg; x + cw <= W - mg + 0.5; x += cw + sp) {
      let vazio = true;
      for (let yy = y; yy < y + ch && vazio; yy += 2) for (let xx = x; xx < x + cw; xx += 2) if (m[yy * w + xx]) { vazio = false; break; }
      if (!vazio || !$('#imp-pular').checked) cx.push({ x, y, w: cw, h: ch });
    }
    return cx;
  }

  function detectar() {
    const a = st.arquivos[st.atual];
    if (!a) return;
    const modo = $('#imp-modo').value;
    a.modo = modo;
    st.caixas = modo === 'auto' ? detectarAuto(a.sheet) : modo === 'grade' ? detectarGrade(a.sheet) : [{ x: 0, y: 0, w: a.sheet.width, h: a.sheet.height }];
    st.sel = [];
    aviso(st.caixas.length + ' quadros encontrados. Toque neles na ordem da animação (ou use "todos").');
    desenhar();
  }

  // recorta um quadro (já sem a cor de fundo)
  function recortar(c) {
    const a = st.arquivos[st.atual];
    const cv = document.createElement('canvas');
    cv.width = c.w; cv.height = c.h;
    const g = cv.getContext('2d');
    g.drawImage(a.sheet, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
    if ($('#imp-fundo').checked) {
      const img = g.getImageData(0, 0, c.w, c.h), d = img.data;
      const [kr, kg, kb] = hex($('#imp-cor').value), tol = +$('#imp-tol').value * 3;
      for (let p = 0; p < d.length; p += 4) if (Math.abs(d[p] - kr) + Math.abs(d[p + 1] - kg) + Math.abs(d[p + 2] - kb) <= tol) d[p + 3] = 0;
      g.putImageData(img, 0, 0);
    }
    return cv;
  }

  // ---------- desenho da folha ----------
  function desenhar() {
    const a = st.arquivos[st.atual];
    const cv = $('#imp-tela');
    if (!a) { cv.width = 1; cv.height = 1; return; }
    const z = st.zoom;
    cv.width = a.sheet.width * z; cv.height = a.sheet.height * z;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (let y = 0; y < cv.height; y += 16) for (let x = 0; x < cv.width; x += 16) { g.fillStyle = ((x + y) / 16) % 2 ? '#3a3a4a' : '#2c2c3a'; g.fillRect(x, y, 16, 16); }
    g.drawImage(a.sheet, 0, 0, cv.width, cv.height);
    st.caixas.forEach((c, i) => {
      const k = st.sel.indexOf(i);
      g.lineWidth = k >= 0 ? 3 : 1.5;
      g.strokeStyle = k >= 0 ? '#ffd84a' : 'rgba(120,200,255,0.9)';
      g.strokeRect(c.x * z + 0.5, c.y * z + 0.5, c.w * z, c.h * z);
      g.font = 'bold ' + Math.max(10, 6 * z) + 'px sans-serif';
      g.fillStyle = k >= 0 ? '#ffd84a' : '#9fd0ff';
      g.fillText(k >= 0 ? String(k + 1) : '·', c.x * z + 3, c.y * z + Math.max(11, 7 * z));
    });
    $('#imp-cont').textContent = st.caixas.length + ' quadros · ' + st.sel.length + ' escolhidos';
  }

  function cliqueTela(ev) {
    const cv = $('#imp-tela'), r = cv.getBoundingClientRect();
    const x = (ev.clientX - r.left) * cv.width / r.width / st.zoom, y = (ev.clientY - r.top) * cv.height / r.height / st.zoom;
    const i = st.caixas.findIndex(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (i < 0) return;
    const k = st.sel.indexOf(i);
    if (k >= 0) st.sel.splice(k, 1); else st.sel.push(i);
    desenhar();
  }

  // ---------- animações e pacote ----------
  function criarAnimacao() {
    if (!st.caixas.length) return aviso('Detecte os quadros primeiro.');
    const idx = st.sel.length ? st.sel : st.caixas.map((c, i) => i);
    const nome = ($('#imp-anome').value || 'Animacao').trim().replace(/\s+/g, '_');
    if (st.anims.some(a => a.nome === nome)) return aviso('Já existe uma animação "' + nome + '" no pacote.');
    const quadros = idx.map(i => recortar(st.caixas[i]));
    st.anims.push({ nome, fps: +$('#imp-fps').value || 12, loop: $('#imp-loop').checked, origem: $('#imp-origem').value, quadros });
    $('#imp-anome').value = '';
    st.sel = [];
    desenhar();
    renderAnims();
    aviso('Animação "' + nome + '" criada com ' + quadros.length + ' quadros.');
  }

  function origem(a, c) {
    return a.origem === 'centro' ? [Math.round(c.width / 2), Math.round(c.height / 2)] : [Math.round(c.width / 2), c.height];
  }

  async function salvarPacote() {
    if (!st.anims.length) return aviso('Crie pelo menos uma animação.');
    const nome = ($('#imp-pnome').value || '').trim();
    if (!nome) return aviso('Dê um nome ao pacote.');
    const id = 'bib:' + nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const existentes = await FF.Biblioteca.listar();
    if (existentes.some(p => p.id === id) && !confirm('Já existe o pacote "' + nome + '". Substituir?')) return;
    const todos = st.anims.flatMap(a => a.quadros);
    const { atlases, posicoes } = await FF.Biblioteca.empacotar(todos);
    const anims = {};
    let k = 0;
    st.anims.forEach(a => {
      anims[a.nome] = { fps: a.fps, loop: a.loop, repeatTo: 0, pingpong: false, frames: a.quadros.map(c => {
        const [ai, x, y] = posicoes[k++];
        const [ox, oy] = origem(a, c);
        return [ai, x, y, c.width, c.height, ox, oy, 1];
      }) };
    });
    const escala = +$('#imp-escala').value || 1;
    await FF.Biblioteca.salvar({ id, nome, def: { escala, anims }, atlases, criado: Date.now() });
    delete FF.Assets.sprites[id];
    aviso('💾 Pacote "' + nome + '" salvo na biblioteca (' + Object.keys(anims).length + ' animações).');
    await renderBiblioteca();
    if (window.FFVis) window.FFVis.recarregarLista(id);
  }

  async function renderBiblioteca() {
    const box = $('#imp-bib');
    const lista = await FF.Biblioteca.listar();
    box.innerHTML = lista.length ? '' : '<small>Nenhum pacote ainda.</small>';
    lista.forEach(p => {
      const l = document.createElement('div');
      l.className = 'imp-pac';
      const n = document.createElement('span');
      n.textContent = '📦 ' + p.nome + ' (' + Object.keys(p.def.anims).length + ')';
      l.appendChild(n);
      const bt = (t, title, fn) => { const b = document.createElement('button'); b.textContent = t; b.title = title; b.onclick = fn; l.appendChild(b); };
      bt('👁', 'Abrir no visualizador', () => { fechar(); window.FFVis && window.FFVis.recarregarLista(p.id); });
      bt('⬇', 'Exportar (.json) para guardar ou mandar ao Claude', async () => {
        const txt = await FF.Biblioteca.exportar(p.id);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
        a.download = p.id.replace('bib:', '') + '.ffpacote.json';
        a.click();
      });
      bt('✕', 'Apagar', async () => { if (confirm('Apagar o pacote "' + p.nome + '"?')) { await FF.Biblioteca.apagar(p.id); renderBiblioteca(); window.FFVis && window.FFVis.recarregarLista(); } });
      box.appendChild(l);
    });
  }

  function renderArquivos() {
    const box = $('#imp-arqs');
    box.innerHTML = '';
    st.arquivos.forEach((a, i) => {
      const b = document.createElement('button');
      b.textContent = a.nome + ' (' + a.sheet.width + '×' + a.sheet.height + ')';
      b.className = i === st.atual ? 'sel' : '';
      b.onclick = () => escolherArquivo(i);
      box.appendChild(b);
    });
  }

  function renderAnims() {
    const box = $('#imp-anims');
    box.innerHTML = st.anims.length ? '' : '<small>Nenhuma animação ainda.</small>';
    st.anims.forEach((a, i) => {
      const l = document.createElement('div');
      l.className = 'imp-pac';
      const n = document.createElement('span');
      n.textContent = a.nome + ' · ' + a.quadros.length + 'q · ' + a.fps + 'fps' + (a.loop ? ' ↻' : '');
      n.onclick = () => (st.previa = a);
      l.appendChild(n);
      const x = document.createElement('button');
      x.textContent = '✕';
      x.onclick = () => { st.anims.splice(i, 1); if (st.previa === a) st.previa = null; renderAnims(); };
      l.appendChild(x);
      box.appendChild(l);
    });
    st.previa = st.anims[st.anims.length - 1] || null;
  }

  // prévia animada da última animação criada
  let tPrev = 0, last = performance.now();
  function loopPrevia(now) {
    const dt = (now - last) / 1000; last = now;
    const cv = $('#imp-previa');
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#1b1630'; g.fillRect(0, 0, cv.width, cv.height);
    const a = st.previa;
    if (a && a.quadros.length && !$('#imp').hidden) {
      tPrev += dt;
      const i = Math.floor(tPrev * a.fps) % a.quadros.length;
      const c = a.quadros[i];
      const maxH = Math.max(...a.quadros.map(q => q.height)), maxW = Math.max(...a.quadros.map(q => q.width));
      const s = Math.min((cv.height - 16) / maxH, (cv.width - 16) / maxW);
      const [ox, oy] = origem(a, c);
      g.imageSmoothingEnabled = false;
      const bx = cv.width / 2, by = a.origem === 'centro' ? cv.height / 2 : cv.height - 8;
      g.drawImage(c, bx - ox * s, by - oy * s, c.width * s, c.height * s);
    }
    requestAnimationFrame(loopPrevia);
  }

  // ---------- utilidades / interface ----------
  function hex(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
  function aviso(t) { $('#imp-aviso').textContent = t; }
  function mostrarModo() {
    const m = $('#imp-modo').value;
    document.querySelectorAll('[data-modo]').forEach(e => (e.hidden = e.dataset.modo !== m));
  }
  function abrir() { $('#imp').hidden = false; renderBiblioteca(); }
  function fechar() { $('#imp').hidden = true; }

  window.addEventListener('load', () => {
    if (!$('#imp')) return;
    $('#bt-importar').onclick = abrir;
    $('#imp-fechar').onclick = fechar;
    $('#imp-file').onchange = (e) => { adicionarArquivos([...e.target.files]); e.target.value = ''; };
    const zona = $('#imp-meio');
    zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('arrastando'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('arrastando'));
    zona.addEventListener('drop', (e) => { e.preventDefault(); zona.classList.remove('arrastando'); adicionarArquivos([...e.dataTransfer.files]); });
    $('#imp-modo').onchange = () => { mostrarModo(); detectar(); };
    $('#imp-detectar').onclick = detectar;
    $('#imp-zoom').oninput = (e) => { st.zoom = +e.target.value; desenhar(); };
    $('#imp-tela').addEventListener('click', cliqueTela);
    $('#imp-todos').onclick = () => { st.sel = st.caixas.map((c, i) => i); desenhar(); };
    $('#imp-limpar').onclick = () => { st.sel = []; desenhar(); };
    $('#imp-criar').onclick = criarAnimacao;
    $('#imp-salvar').onclick = () => salvarPacote().catch(e => aviso('❌ ' + e.message));
    $('#imp-pacfile').onchange = async (e) => {
      for (const f of e.target.files) {
        try { const id = await FF.Biblioteca.importarArquivo(await f.text()); aviso('📦 Pacote importado: ' + id); }
        catch (err) { aviso('❌ ' + err.message); }
      }
      e.target.value = '';
      renderBiblioteca();
      window.FFVis && window.FFVis.recarregarLista();
    };
    ['#imp-fundo', '#imp-cor', '#imp-tol'].forEach(s => $(s).addEventListener('change', detectar));
    mostrarModo();
    requestAnimationFrame(loopPrevia);
  });
})();
