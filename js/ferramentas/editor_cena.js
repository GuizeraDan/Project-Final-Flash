// Editor de cenas — modo "Cena livre": palco onde se coloca qualquer sprite (personagens, efeitos e os
// da biblioteca), arrastando, mudando tamanho/giro/transparência e animando com quadros-chave no tempo.
// Também sons, acertos, tremores e flashes em instantes. Extende FF.Editor (js/ferramentas/editor.js).
window.FF = window.FF || {};

Object.assign(FF.Editor, {
  cenaIdx: null,
  cenaSel: -1,
  cenaT: 0,
  cenaPlay: false,
  arrasto: null,

  cenaAtual() { return this.cena.golpe.roteiro[this.cenaIdx].cena; },

  // ---------- abrir / fechar ----------
  abrirCena(i) {
    this.cenaIdx = i;
    this.cenaSel = -1;
    this.cenaT = 0;
    this.cenaPlay = false;
    this.el.querySelector('.ed-main').hidden = true;
    const box = this.el.querySelector('.ed-cena');
    box.hidden = false;
    if (!box.dataset.montado) this.montarCena(box);
    FF.Cena.preparar(this.cenaAtual()).then(() => this.renderCena());
    this.aplicarOcultos();
    this.renderCena();
    this.paleta();
  },

  fecharCena() {
    this.cenaPlay = false;
    this.restaurarOcultos();
    this.cenaIdx = null;
    this.el.querySelector('.ed-cena').hidden = true;
    this.el.querySelector('.ed-main').hidden = false;
    this.render();
  },

  aplicarOcultos() {
    const c = this.cenaAtual();
    this.ator().alpha = c.esconderAtacante ? 0.15 : 1;
    const al = this.alvo(); if (al) al.alpha = c.esconderAlvo ? 0.15 : 1;
  },
  restaurarOcultos() { this.b.all.forEach(f => (f.alpha = 1)); },

  // ---------- painel ----------
  montarCena(box) {
    box.dataset.montado = 1;
    box.innerHTML = `
      <div class="ed-topo"><b>🎞 Cena livre</b><span><button data-c="voltar">← Voltar ao roteiro</button></span></div>
      <div class="ed-linha">
        <button data-c="play">▶</button>
        <input type="range" data-c="tempo" min="0" max="2" step="0.01" value="0" style="flex:1">
        <span data-c="tlabel" class="ed-t">0,00 s</span>
      </div>
      <div class="ed-linha">
        <label>duração (s) <input type="number" data-c="duracao" step="0.1" min="0.1"></label>
        <label><input type="checkbox" data-c="escA"> esconder quem solta</label>
        <label><input type="checkbox" data-c="escB"> esconder alvo</label>
      </div>
      <h4>Sprites na cena <small>(toque num deles na tela para escolher e arrastar)</small></h4>
      <div class="ed-camadas"></div>
      <div class="ed-props"></div>
      <h4>Eventos no tempo</h4>
      <div class="ed-evcena"></div>
      <div class="ed-linha">
        <button data-c="addSom">+ 🔊 Som agora</button>
        <button data-c="addVoz">+ 🗣 Voz agora</button>
        <button data-c="addHit">+ 💥 Acerto agora</button>
        <button data-c="addTremor">+ 〰 Tremor</button>
        <button data-c="addFlash">+ ⚡ Flash</button>
      </div>
      <h4>Paleta de sprites <small>(toque para colocar na cena)</small></h4>
      <div class="ed-linha">
        <select data-c="pset" style="flex:1"></select>
        <input data-c="pfiltro" placeholder="filtrar…" style="flex:1">
      </div>
      <div class="ed-paleta"></div>
      <div class="ed-log ed-cenalog"></div>`;
    const q = (k) => box.querySelector('[data-c="' + k + '"]');
    this.q = q;
    q('voltar').onclick = () => this.fecharCena();
    q('play').onclick = () => this.alternarPlay();
    q('tempo').oninput = (e) => { this.cenaPlay = false; this.cenaT = +e.target.value; this.renderTempo(); this.renderProps(); };
    q('duracao').oninput = (e) => { const v = +e.target.value; if (v > 0) { this.cenaAtual().duracao = v; this.renderTempo(); this.atualizarJSON(); } };
    q('escA').onchange = (e) => { this.cenaAtual().esconderAtacante = e.target.checked || undefined; this.aplicarOcultos(); this.atualizarJSON(); };
    q('escB').onchange = (e) => { this.cenaAtual().esconderAlvo = e.target.checked || undefined; this.aplicarOcultos(); this.atualizarJSON(); };
    const addEv = (lista, obj) => { const c = this.cenaAtual(); (c[lista] = c[lista] || []).push(Object.assign({ t: +this.cenaT.toFixed(2) }, obj)); this.renderEventos(); this.atualizarJSON(); };
    q('addSom').onclick = () => addEv('sons', { som: 'hit_midle-a' });
    q('addVoz').onclick = () => addEv('sons', { som: '', voz: true });
    q('addHit').onclick = () => addEv('acertos', { fracao: 0.5, forca: 'energia' });
    q('addTremor').onclick = () => addEv('tremores', { forca: 6 });
    q('addFlash').onclick = () => addEv('flashes', { forca: 0.5 });
    q('pset').onchange = () => this.paleta();
    q('pfiltro').oninput = () => this.paleta(true);
    // teclado: mover/apagar o sprite escolhido
    window.addEventListener('keydown', (e) => {
      if (this.cenaIdx == null || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const c = this.camadaSel(); if (!c) { if (e.code === 'Space') { e.preventDefault(); this.alternarPlay(); } return; }
      const passo = e.shiftKey ? 10 : 1;
      const mv = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[e.code];
      if (mv) { e.preventDefault(); const st = this.valores(c); this.definir(c, { x: st.x + mv[0], y: st.y + mv[1] }); }
      else if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); this.apagarCamada(this.cenaSel); }
      else if (e.key === '+' || e.key === '=') this.definir(c, { escala: this.valores(c).escala * 1.1 });
      else if (e.key === '-') this.definir(c, { escala: this.valores(c).escala / 1.1 });
      else if (e.code === 'Space') { e.preventDefault(); this.alternarPlay(); }
    });
    // conjuntos de sprites para a paleta
    this.preencherSets();
    // laço de reprodução da prévia (não aplica dano; para testar com dano use "Testar cena")
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (this.cenaIdx != null && this.cenaPlay) {
        const c = this.cenaAtual(), t0 = this.cenaT;
        this.cenaT += dt;
        (c.sons || []).forEach(s => { if (s.t > t0 && s.t <= this.cenaT && s.som) FF.Audio.play(s.som, 1); });
        if (this.cenaT >= (c.duracao || 1)) { this.cenaT = 0; this.cenaPlay = false; }
        this.renderTempo();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  async preencherSets() {
    const sel = this.q('pset');
    const IDX = (window.FF_BUNDLE && FF_BUNDLE._indice) || { sprites: [] };
    const nomes = { fx: 'Efeitos básicos', fx_extra: 'Efeitos extras (explosões, auras, Genki Dama…)', hud_zl3: 'HUD', retratos: 'Retratos/banners', cenarios_preview: 'Prévias de cenário', stage_campo: 'Cenário campo' };
    const ordem = ['fx_extra', 'fx'].concat(IDX.sprites.filter(s => !['fx_extra', 'fx'].includes(s)));
    sel.innerHTML = '';
    ordem.forEach(id => { const o = document.createElement('option'); o.value = id; o.textContent = nomes[id] || ('Lutador: ' + id); sel.appendChild(o); });
    const bib = FF.Biblioteca ? await FF.Biblioteca.listar() : [];
    bib.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = '📦 ' + p.nome; sel.appendChild(o); });
  },

  // miniaturas de todas as animações do conjunto escolhido
  async paleta(soFiltro) {
    const box = this.el.querySelector('.ed-paleta');
    const id = this.q('pset').value;
    if (!id) return;
    let set;
    try { set = await FF.Assets.loadSprite(id); } catch (e) { box.textContent = 'Não deu para carregar ' + id; return; }
    const filtro = (this.q('pfiltro').value || '').toLowerCase();
    box.innerHTML = '';
    Object.entries(set.def.anims).forEach(([nome, a]) => {
      if (filtro && !nome.toLowerCase().includes(filtro)) return;
      const b = document.createElement('button');
      b.className = 'ed-thumb';
      b.title = nome + ' · ' + a.frames.length + ' quadros';
      const cv = document.createElement('canvas');
      cv.width = 56; cv.height = 56;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      const desenhar = (k) => {
        const f = a.frames[k % a.frames.length];
        g.clearRect(0, 0, 56, 56);
        const s = Math.min(52 / f[3], 52 / f[4], 3);
        g.drawImage(set.images[f[0]], f[1], f[2], f[3], f[4], (56 - f[3] * s) / 2, (56 - f[4] * s) / 2, f[3] * s, f[4] * s);
      };
      desenhar(Math.floor(a.frames.length / 2));
      // passa o mouse/segura: anima a miniatura
      let tm = null, k = 0;
      b.onmouseenter = () => { tm = setInterval(() => desenhar(k++), 1000 / Math.max(4, a.fps || 10)); };
      b.onmouseleave = () => { clearInterval(tm); desenhar(Math.floor(a.frames.length / 2)); };
      const n = document.createElement('span');
      n.textContent = nome;
      b.append(cv, n);
      b.onclick = () => this.adicionarCamada(id, nome);
      box.appendChild(b);
    });
    if (!box.children.length) box.textContent = 'Nada encontrado.';
  },

  // ---------- camadas ----------
  camadaSel() { const c = this.cenaAtual(); return (c.camadas || [])[this.cenaSel] || null; },

  adicionarCamada(setId, anim) {
    const c = this.cenaAtual();
    const set = FF.Assets.sprites[setId];
    const a = set.anim(anim);
    const dur = a.frames.reduce((s, f) => s + (f[7] || 1), 0) / (a.fps || 10);
    const lutador = !/^(fx|fx_extra|bib:)/.test(setId) && !['hud_zl3', 'retratos', 'cenarios_preview', 'stage_campo'].includes(setId);
    const nova = {
      sprite: setId, anim, ancora: lutador ? 'atacante' : 'alvo', x: lutador ? 60 : 0, y: 0, escala: 1,
      inicio: +this.cenaT.toFixed(2), loop: !!a.loop,
    };
    nova.fim = +(nova.inicio + (a.loop ? Math.max(1, (c.duracao || 2) - nova.inicio) : dur)).toFixed(2);
    if (nova.fim > (c.duracao || 0)) c.duracao = +nova.fim.toFixed(2);
    (c.camadas = c.camadas || []).push(nova);
    this.cenaSel = c.camadas.length - 1;
    this.renderCena();
    this.logCena('Colocado: ' + anim + '. Arraste na tela para posicionar.');
  },

  apagarCamada(i) {
    const c = this.cenaAtual();
    c.camadas.splice(i, 1);
    this.cenaSel = -1;
    this.renderCena();
  },

  // valores atuais (no tempo atual) de uma camada
  valores(c) { return FF.Cena.estado(c, Math.max(0, this.cenaT - (c.inicio || 0))); },

  // muda propriedades: se a camada já tem quadros-chave, grava/atualiza a chave no tempo atual
  definir(c, mud) {
    if (c.chaves && c.chaves.length) {
      const tl = +Math.max(0, this.cenaT - (c.inicio || 0)).toFixed(2);
      let k = c.chaves.find(x => Math.abs(x.t - tl) < 0.03);
      if (!k) { k = Object.assign({ t: tl }, this.valores(c)); c.chaves.push(k); c.chaves.sort((a, b) => a.t - b.t); }
      Object.assign(k, this.arred(mud));
    } else {
      Object.assign(c, this.arred(mud));
    }
    this.renderProps();
    this.atualizarJSON();
  },

  arred(o) {
    const r = {};
    for (const [k, v] of Object.entries(o)) r[k] = k === 'escala' || k === 'alpha' ? Math.round(v * 100) / 100 : Math.round(v);
    return r;
  },

  gravarChave() {
    const c = this.camadaSel(); if (!c) return;
    const tl = +Math.max(0, this.cenaT - (c.inicio || 0)).toFixed(2);
    const v = this.arred(this.valores(c));
    c.chaves = c.chaves || [];
    const ex = c.chaves.find(x => Math.abs(x.t - tl) < 0.03);
    if (ex) Object.assign(ex, v); else c.chaves.push(Object.assign({ t: tl }, v));
    c.chaves.sort((a, b) => a.t - b.t);
    this.renderProps();
    this.atualizarJSON();
    this.logCena('📍 Posição gravada em ' + this.cenaT.toFixed(2) + ' s. Mude o tempo, mova o sprite e grave de novo para ele se mexer.');
  },

  // ---------- render ----------
  renderCena() {
    if (this.cenaIdx == null) return;
    const c = this.cenaAtual();
    this.q('duracao').value = c.duracao || 1;
    this.q('escA').checked = !!c.esconderAtacante;
    this.q('escB').checked = !!c.esconderAlvo;
    this.renderTempo();
    const box = this.el.querySelector('.ed-camadas');
    box.innerHTML = (c.camadas || []).length ? '' : '<small>Nenhum sprite ainda. Escolha na paleta abaixo.</small>';
    (c.camadas || []).forEach((cm, i) => {
      const row = document.createElement('div');
      row.className = 'ed-camada' + (i === this.cenaSel ? ' sel' : '');
      const olho = document.createElement('button');
      olho.textContent = cm.oculta ? '🙈' : '👁'; olho.title = 'Mostrar/esconder no editor';
      olho.onclick = (e) => { e.stopPropagation(); cm.oculta = !cm.oculta || undefined; this.renderCena(); };
      const nome = document.createElement('span');
      nome.textContent = cm.anim + ' (' + cm.sprite.replace('bib:', '📦') + ')';
      const ini = this.inp(cm.inicio, v => { cm.inicio = v || 0; this.renderTempo(); }, 'number', { step: 0.05, title: 'começa (s)' });
      const fim = this.inp(cm.fim, v => { cm.fim = v; }, 'number', { step: 0.05, title: 'termina (s)' });
      ini.className = fim.className = 'ed-mini';
      const bt = (t, ti, fn) => { const b = document.createElement('button'); b.textContent = t; b.title = ti; b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
      row.append(olho, nome, ini, fim,
        bt('▲', 'Para trás (desenha antes)', () => { if (i > 0) { [c.camadas[i - 1], c.camadas[i]] = [c.camadas[i], c.camadas[i - 1]]; this.cenaSel = i - 1; this.renderCena(); } }),
        bt('▼', 'Para frente', () => { if (i < c.camadas.length - 1) { [c.camadas[i + 1], c.camadas[i]] = [c.camadas[i], c.camadas[i + 1]]; this.cenaSel = i + 1; this.renderCena(); } }),
        bt('⧉', 'Duplicar', () => { c.camadas.splice(i + 1, 0, JSON.parse(JSON.stringify(cm))); this.cenaSel = i + 1; this.renderCena(); }),
        bt('✕', 'Apagar', () => this.apagarCamada(i)));
      row.onclick = () => { this.cenaSel = i; this.renderCena(); };
      box.appendChild(row);
    });
    this.renderProps();
    this.renderEventos();
    this.atualizarJSON();
  },

  renderTempo() {
    const c = this.cenaAtual();
    const r = this.q('tempo');
    r.max = c.duracao || 1;
    r.value = this.cenaT;
    this.q('tlabel').textContent = this.cenaT.toFixed(2).replace('.', ',') + ' / ' + (c.duracao || 1).toFixed(2).replace('.', ',') + ' s';
    this.q('play').textContent = this.cenaPlay ? '⏸' : '▶';
    if (!this.cenaPlay) this.renderPropsValores();
  },

  renderProps() {
    const box = this.el.querySelector('.ed-props');
    const c = this.camadaSel();
    box.innerHTML = '';
    if (!c) return;
    const v = this.valores(c);
    const lin = () => { const d = document.createElement('div'); d.className = 'ed-linha'; box.appendChild(d); return d; };
    const t = document.createElement('div'); t.className = 'ed-subtit'; t.textContent = '✏ ' + c.anim;
    box.appendChild(t);
    const l1 = lin();
    l1.append(this.campo('preso a', this.sel([['atacante', 'quem solta'], ['alvo', 'alvo'], ['tela', 'tela (fixo)']], c.ancora || 'atacante', (val) => {
      // troca a âncora sem o sprite pular de lugar
      const antes = FF.Cena.naTela(this.b, this.ator(), this.alvo(), c, this.cenaT);
      c.ancora = val;
      if (antes) {
        const an = FF.Cena.ancora(this.b, this.ator(), this.alvo(), c);
        this.definir(c, { x: (antes.x - an.x) * an.dir, y: antes.y - an.y });
      }
      this.renderProps();
    })));
    const flip = document.createElement('input'); flip.type = 'checkbox'; flip.checked = !!c.flip;
    flip.onchange = () => { c.flip = flip.checked || undefined; this.atualizarJSON(); };
    const loop = document.createElement('input'); loop.type = 'checkbox'; loop.checked = c.loop !== false;
    loop.onchange = () => { c.loop = loop.checked; this.atualizarJSON(); };
    l1.append(this.campo('espelhar', flip), this.campo('repetir', loop));
    const l2 = lin();
    const num = (rot, k, passo) => { const i = this.inp(Math.round(v[k] * 100) / 100, val => { if (val != null) this.definir(c, { [k]: val }); }, 'number', { step: passo }); i.className = 'ed-mini'; i.dataset.prop = k; return this.campo(rot, i); };
    l2.append(num('x', 'x', 1), num('y', 'y', 1), num('tamanho', 'escala', 0.05), num('giro°', 'rot', 5), num('opac.', 'alpha', 0.05));
    const l3 = lin();
    l3.append(this.campo('fps', this.inp(c.fps, val => this.set(c, 'fps', val), 'number', { step: 1, placeholder: 'padrão' })));
    const grav = document.createElement('button'); grav.textContent = '📍 Gravar posição neste tempo'; grav.onclick = () => this.gravarChave();
    l3.appendChild(grav);
    const chs = (c.chaves || []);
    if (chs.length) {
      const l4 = lin();
      l4.append('chaves:');
      chs.forEach((k, j) => {
        const b = document.createElement('button');
        b.textContent = (k.t + (c.inicio || 0)).toFixed(2) + 's';
        b.title = 'Ir para este tempo (clique) · apagar (botão direito)';
        b.onclick = () => { this.cenaT = k.t + (c.inicio || 0); this.renderTempo(); this.renderProps(); };
        b.oncontextmenu = (e) => { e.preventDefault(); chs.splice(j, 1); this.renderProps(); this.atualizarJSON(); };
        l4.appendChild(b);
      });
      const lim = document.createElement('button'); lim.textContent = 'apagar chaves';
      lim.onclick = () => { Object.assign(c, this.arred(this.valores(c))); delete c.chaves; this.renderProps(); this.atualizarJSON(); };
      l4.appendChild(lim);
    }
  },

  // atualiza só os números (durante arrasto/reprodução) sem refazer o painel
  renderPropsValores() {
    const c = this.camadaSel(); if (!c) return;
    const v = this.valores(c);
    this.el.querySelectorAll('.ed-props [data-prop]').forEach(i => { if (document.activeElement !== i) i.value = Math.round(v[i.dataset.prop] * 100) / 100; });
  },

  renderEventos() {
    const c = this.cenaAtual();
    const box = this.el.querySelector('.ed-evcena');
    box.innerHTML = '';
    const linha = (lista, ev, k, campos) => {
      const r = document.createElement('div'); r.className = 'ed-evento';
      const t = this.inp(ev.t, v => { ev.t = v || 0; }, 'number', { step: 0.05, title: 'tempo (s)' }); t.className = 'ed-mini';
      const ir = document.createElement('button'); ir.textContent = '⏱'; ir.title = 'Ir para este tempo';
      ir.onclick = () => { this.cenaT = ev.t || 0; this.renderTempo(); };
      const x = document.createElement('button'); x.textContent = '✕';
      x.onclick = () => { c[lista].splice(k, 1); this.renderEventos(); this.atualizarJSON(); };
      r.append(t, ir, ...campos, x);
      box.appendChild(r);
    };
    (c.sons || []).forEach((s, k) => linha('sons', s, k, [s.voz ? '🗣' : '🔊', this.campoAudio(s.som, v => { s.som = v || ''; })]));
    (c.acertos || []).forEach((h, k) => {
      const lanca = document.createElement('input'); lanca.type = 'checkbox'; lanca.checked = !!h.lanca;
      lanca.onchange = () => { this.set(h, 'lanca', lanca.checked || undefined); this.atualizarJSON(); };
      linha('acertos', h, k, ['💥', this.mini('dano', h.fracao, v => this.set(h, 'fracao', v), 0.05), this.sel(['leve', 'media', 'forte', 'energia'], h.forca || 'leve', v => this.set(h, 'forca', v)), this.campo('lança', lanca)]);
    });
    (c.tremores || []).forEach((h, k) => linha('tremores', h, k, ['〰', this.mini('força', h.forca, v => this.set(h, 'forca', v))]));
    (c.flashes || []).forEach((h, k) => linha('flashes', h, k, ['⚡', this.mini('força', h.forca, v => this.set(h, 'forca', v), 0.1)]));
    if (!box.children.length) box.innerHTML = '<small>Sem eventos. Use os botões abaixo no tempo desejado.</small>';
  },

  alternarPlay() {
    const c = this.cenaAtual();
    if (!this.cenaPlay && this.cenaT >= (c.duracao || 1) - 0.01) this.cenaT = 0;
    this.cenaPlay = !this.cenaPlay;
    this.renderTempo();
  },

  logCena(t) { const el = this.el.querySelector('.ed-cenalog'); if (el) el.textContent = t; },

  // ---------- desenho e interação na tela ----------
  desenharEdicaoCena(ctx) {
    const c = this.cenaAtual();
    const actor = this.ator(), target = this.alvo();
    FF.Cena.desenhar(ctx, this.b, actor, target, c, this.cenaT);
    const sel = this.camadaSel();
    if (sel && !this.cenaPlay) {
      const p = FF.Cena.naTela(this.b, actor, target, sel, this.cenaT);
      if (p) {
        const r = FF.Cena.caixa(p);
        ctx.save();
        ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffd84a';
        ctx.fillRect(r.x + r.w - 7, r.y + r.h - 7, 14, 14);   // alça de tamanho
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill();
        ctx.font = 'bold 12px sans-serif'; ctx.fillText(sel.anim, r.x, r.y - 6);
        ctx.restore();
      }
    }
  },

  pontoNaTela(ev) {
    const cv = document.getElementById('tela'), r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * cv.width / r.width, y: (ev.clientY - r.top) * cv.height / r.height };
  },

  cenaPointer(ev) {
    ev.stopImmediatePropagation(); ev.preventDefault();
    if (this.cenaPlay) { this.cenaPlay = false; this.renderTempo(); }
    const c = this.cenaAtual(), pt = this.pontoNaTela(ev);
    const actor = this.ator(), target = this.alvo();
    // alça de tamanho do escolhido?
    const sel = this.camadaSel();
    if (sel) {
      const p = FF.Cena.naTela(this.b, actor, target, sel, this.cenaT);
      if (p) {
        const r = FF.Cena.caixa(p);
        if (Math.abs(pt.x - (r.x + r.w)) < 14 && Math.abs(pt.y - (r.y + r.h)) < 14) return this.iniciarArrasto(ev, sel, 'escala', pt, p);
      }
    }
    // escolhe o sprite de cima que estiver sob o dedo
    for (let i = (c.camadas || []).length - 1; i >= 0; i--) {
      const cm = c.camadas[i]; if (cm.oculta) continue;
      const p = FF.Cena.naTela(this.b, actor, target, cm, this.cenaT);
      if (!p) continue;
      const r = FF.Cena.caixa(p);
      if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
        if (this.cenaSel !== i) { this.cenaSel = i; this.renderCena(); }
        return this.iniciarArrasto(ev, cm, 'mover', pt, p);
      }
    }
    if (this.cenaSel !== -1) { this.cenaSel = -1; this.renderCena(); }
  },

  iniciarArrasto(ev, cm, modo, pt0, p0) {
    const v0 = this.valores(cm);
    const an = FF.Cena.ancora(this.b, this.ator(), this.alvo(), cm);
    const d0 = Math.max(8, Math.hypot(pt0.x - p0.x, pt0.y - p0.y));
    const mover = (e) => {
      const pt = this.pontoNaTela(e);
      if (modo === 'mover') this.definirLeve(cm, { x: v0.x + (pt.x - pt0.x) * an.dir, y: v0.y + (pt.y - pt0.y) });
      else this.definirLeve(cm, { escala: Math.max(0.05, v0.escala * Math.hypot(pt.x - p0.x, pt.y - p0.y) / d0) });
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      this.renderProps();
      this.atualizarJSON();
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  },

  // como definir(), mas sem refazer o painel a cada movimento do dedo
  definirLeve(c, mud) {
    if (c.chaves && c.chaves.length) {
      const tl = +Math.max(0, this.cenaT - (c.inicio || 0)).toFixed(2);
      let k = c.chaves.find(x => Math.abs(x.t - tl) < 0.03);
      if (!k) { k = Object.assign({ t: tl }, this.valores(c)); c.chaves.push(k); c.chaves.sort((a, b) => a.t - b.t); }
      Object.assign(k, this.arred(mud));
    } else Object.assign(c, this.arred(mud));
    this.renderPropsValores();
  },
});

// rodinha do mouse sobre a tela: muda o tamanho do sprite escolhido
window.addEventListener('wheel', (e) => {
  const E = FF.Editor;
  if (E.cenaIdx == null || e.target.id !== 'tela') return;
  const c = E.camadaSel(); if (!c) return;
  e.preventDefault();
  E.definir(c, { escala: Math.max(0.05, E.valores(c).escala * (e.deltaY < 0 ? 1.08 : 1 / 1.08)) });
}, { passive: false });
