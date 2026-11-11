// Prévias de sprites no editor de cenas: miniatura animada ao lado de cada campo que escolhe uma
// animação/efeito, e um seletor em grade (🖼) com todas as animações para escolher vendo.
window.FF = window.FF || {};

FF.Previa = {
  vivos: [],
  rodando: false,

  // desenha o quadro k da animação centralizado no canvas
  quadro(cv, set, a, k) {
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, cv.width, cv.height);
    if (!set || !a || !a.frames.length) {
      g.fillStyle = '#ff6b6b'; g.font = 'bold ' + Math.round(cv.height * 0.5) + 'px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', cv.width / 2, cv.height / 2);
      return;
    }
    const f = a.frames[k % a.frames.length] || a.frames.find(Boolean);
    if (!f || !set.images[f[0]]) return;
    const m = 2, s = Math.min((cv.width - m * 2) / f[3], (cv.height - m * 2) / f[4], 4);
    g.drawImage(set.images[f[0]], f[1], f[2], f[3], f[4], (cv.width - f[3] * s) / 2, (cv.height - f[4] * s) / 2, f[3] * s, f[4] * s);
  },

  // canvas que fica animando sozinho enquanto estiver na página
  animado(set, nome, w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h || w;
    cv.className = 'pv-mini';
    const a = set && set.def.anims[nome];
    cv.title = a ? nome + ' · ' + a.frames.length + ' quadros' : (nome ? nome + ' (não encontrado)' : '');
    this.quadro(cv, set, a, 0);
    if (a && a.frames.length > 1) {
      this.vivos.push({ cv, set, a, t: 0 });
      this.iniciar();
    }
    return cv;
  },

  iniciar() {
    if (this.rodando) return;
    this.rodando = true;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      // canvas recém-criado ainda pode não estar no documento: tolera ~1 s antes de largar
      this.vivos = this.vivos.filter(v => v.cv.isConnected || (v.fora = (v.fora || 0) + 1) < 60);
      for (const v of this.vivos) {
        if (!v.cv.isConnected) continue;
        const k0 = Math.floor(v.t * (v.a.fps || 10));
        v.t += dt;
        const total = v.a.frames.length / (v.a.fps || 10) + 0.35;   // pausa curta antes de repetir
        if (v.t > total) v.t = 0;
        const k = Math.min(v.a.frames.length - 1, Math.floor(v.t * (v.a.fps || 10)));
        if (k !== k0) this.quadro(v.cv, v.set, v.a, k);
      }
      if (this.vivos.length) requestAnimationFrame(loop); else this.rodando = false;
    };
    requestAnimationFrame(loop);
  },

  // ---------- seletor em grade ----------
  // conjuntos: [{rotulo, set}] ; aoEscolher(nome, set)
  abrir({ titulo, conjuntos, atual, aoEscolher }) {
    let el = document.getElementById('pv-seletor');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pv-seletor';
      el.innerHTML = `<div class="pv-caixa">
        <div class="pv-topo"><b></b><button data-pv="fechar">✕</button></div>
        <div class="pv-linha"><select data-pv="set"></select><input data-pv="filtro" placeholder="filtrar pelo nome…"></div>
        <div class="pv-corpo">
          <div class="pv-grade"></div>
          <div class="pv-zoom"><canvas width="220" height="220"></canvas><div class="pv-nome"></div><button data-pv="usar">✔ Usar esta</button></div>
        </div></div>`;
      document.body.appendChild(el);
      ['pointerdown', 'keydown', 'wheel'].forEach(t => el.addEventListener(t, e => e.stopPropagation()));
      el.onclick = (e) => { if (e.target === el) this.fechar(); };
      el.querySelector('[data-pv="fechar"]').onclick = () => this.fechar();
    }
    this.op = { conjuntos, aoEscolher, sel: null };
    el.querySelector('.pv-topo b').textContent = titulo || 'Escolher animação';
    const sSet = el.querySelector('[data-pv="set"]');
    sSet.innerHTML = '';
    conjuntos.forEach((c, i) => { const o = document.createElement('option'); o.value = i; o.textContent = c.rotulo + ' (' + Object.keys(c.set.def.anims).length + ')'; sSet.appendChild(o); });
    sSet.hidden = conjuntos.length < 2;
    let ini = conjuntos.findIndex(c => atual && c.set.def.anims[atual]);
    sSet.value = Math.max(0, ini);
    const filtro = el.querySelector('[data-pv="filtro"]');
    filtro.value = '';
    sSet.onchange = () => this.grade();
    filtro.oninput = () => this.grade();
    el.querySelector('[data-pv="usar"]').onclick = () => { const s = this.op.sel; if (s) { this.fechar(); aoEscolher(s.nome, s.set); } };
    el.hidden = false;
    this.grade(atual);
  },

  fechar() { const el = document.getElementById('pv-seletor'); if (el) { el.hidden = true; el.querySelector('.pv-grade').innerHTML = ''; } },

  grade(atual) {
    const el = document.getElementById('pv-seletor');
    const c = this.op.conjuntos[+el.querySelector('[data-pv="set"]').value];
    const filtro = el.querySelector('[data-pv="filtro"]').value.toLowerCase();
    const box = el.querySelector('.pv-grade');
    box.innerHTML = '';
    let primeiro = null;
    Object.entries(c.set.def.anims).forEach(([nome, a]) => {
      if (filtro && !nome.toLowerCase().includes(filtro)) return;
      const b = document.createElement('button');
      b.className = 'pv-item' + (nome === atual ? ' atual' : '');
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
      this.quadro(cv, c.set, a, Math.floor(a.frames.length / 2));
      const n = document.createElement('span'); n.textContent = nome;
      b.append(cv, n);
      let tm = null, k = 0;
      const anima = () => { clearInterval(tm); k = 0; tm = setInterval(() => this.quadro(cv, c.set, a, k++), 1000 / Math.max(4, a.fps || 10)); };
      const para = () => { clearInterval(tm); this.quadro(cv, c.set, a, Math.floor(a.frames.length / 2)); };
      b.onmouseenter = () => { anima(); this.zoom(c.set, nome); };
      b.onmouseleave = para;
      b.onfocus = () => this.zoom(c.set, nome);
      // toque: 1º mostra grande, 2º (ou duplo clique) escolhe
      b.onclick = () => {
        if (this.op.sel && this.op.sel.nome === nome && this.op.sel.set === c.set) { this.fechar(); this.op.aoEscolher(nome, c.set); return; }
        box.querySelectorAll('.pv-item.sel').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        this.zoom(c.set, nome, true);
      };
      box.appendChild(b);
      if (nome === atual || !primeiro) primeiro = primeiro && nome !== atual ? primeiro : { nome, b };
    });
    if (!box.children.length) box.textContent = 'Nada encontrado.';
    if (primeiro) { primeiro.b.classList.add('sel'); this.zoom(c.set, primeiro.nome, true); if (primeiro.nome === atual) primeiro.b.scrollIntoView({ block: 'center' }); }
  },

  // prévia grande, animada, do item escolhido
  zoom(set, nome, fixar) {
    const el = document.getElementById('pv-seletor');
    if (fixar) this.op.sel = { set, nome };
    const s = this.op.sel || { set, nome };
    const mostrar = fixar ? s : { set, nome };
    const a = mostrar.set.def.anims[mostrar.nome];
    el.querySelector('.pv-nome').textContent = mostrar.nome + ' · ' + a.frames.length + ' quadros · ' + (a.fps || 0) + ' fps' + (a.loop ? ' · repete' : '');
    const cv = el.querySelector('.pv-zoom canvas');
    clearInterval(this._zt);
    let k = 0;
    this.quadro(cv, mostrar.set, a, 0);
    this._zt = setInterval(() => { if (el.hidden) return clearInterval(this._zt); this.quadro(cv, mostrar.set, a, k++ % (a.frames.length + 3)); }, 1000 / Math.max(4, a.fps || 10));
  },
};

// ---------- integração com o editor de cenas ----------
Object.assign(FF.Editor, {
  conjuntosEfeitos() {
    const c = [];
    if (this.b.fx2) c.push({ rotulo: 'Efeitos extras (explosões, auras…)', set: this.b.fx2 });
    if (this.b.fx) c.push({ rotulo: 'Efeitos básicos', set: this.b.fx });
    Object.entries(FF.Assets.sprites).forEach(([id, s]) => { if (id.startsWith('bib:')) c.push({ rotulo: '📦 ' + id.slice(4), set: s }); });
    return c;
  },

  // campo de animação do lutador (select) com prévia + 🖼
  previaAnim(select, nome, aoEscolher) {
    const actor = this.ator();
    const set = actor.sprite;
    const real = nome ? actor.animName(nome) : null;
    return this.embrulhoPrevia(select, set, real, () => FF.Previa.abrir({
      titulo: 'Animações de ' + actor.def.nome, conjuntos: [{ rotulo: actor.def.nome, set }], atual: real,
      aoEscolher: (n) => aoEscolher(n),
    }));
  },

  // campo de efeito (input com nome) com prévia + 🖼
  previaEfeito(input, nome, aoEscolher) {
    const set = nome ? this.b.fxSet(nome) : null;
    return this.embrulhoPrevia(input, set, nome, () => FF.Previa.abrir({
      titulo: 'Escolher efeito', conjuntos: this.conjuntosEfeitos(), atual: nome,
      aoEscolher: (n) => aoEscolher(n),
    }));
  },

  embrulhoPrevia(campo, set, nome, abrir) {
    const w = document.createElement('span');
    w.className = 'pv-campo';
    const cv = nome ? FF.Previa.animado(set, nome, 34) : null;
    if (cv) { cv.onclick = (e) => { e.stopPropagation(); abrir(); }; w.appendChild(cv); }
    w.appendChild(campo);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pv-bt'; b.textContent = '🖼'; b.title = 'Ver todas e escolher pela prévia';
    b.onclick = (e) => { e.stopPropagation(); abrir(); };
    w.appendChild(b);
    return w;
  },

  // tira de miniaturas das camadas de uma cena livre (no cartão do roteiro)
  previaCamadas(c) {
    const d = document.createElement('div');
    d.className = 'pv-tira';
    (c.camadas || []).forEach(cm => {
      const set = FF.Assets.sprites[cm.sprite];
      d.appendChild(FF.Previa.animado(set, cm.anim, 40));
    });
    return d;
  },
});
