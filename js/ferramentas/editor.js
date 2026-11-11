// Editor de cenas (sandbox): monta um golpe passo a passo — animações do lutador, efeitos,
// sons, vozes, acertos e projéteis presos a quadros — e testa na batalha de verdade.
// Abre com index.html?editor=1&batalha=<id>. Exporta o JSON do golpe (formato do "roteiro").
window.FF = window.FF || {};

FF.Editor = {
  b: null,
  cena: null,
  passoSel: 0,
  alinhando: null,     // evento de efeito esperando o clique de alinhamento
  ocupado: false,
  CHAVE: 'ff_editor_cenas',
  FILA: 'ff_editor_fila',

  run(b) {
    this.b = b;
    b.turnLabel = 'Editor de cenas';
    document.body.classList.add('com-editor');
    b.checkEnd = () => false;
    b.all.forEach(f => f.idle());
    this.cena = this.cenaVazia();
    this.montar();
    this.ganchos();
    this.render();
    b.banner('Editor de cenas', 1.4);
  },

  cenaVazia() {
    return { atacante: 0, alvo: this.b.all.findIndex(f => !f.isHero), golpe: { nome: 'Novo golpe', poder: 2, roteiro: [
      { anim: 'Special', eventos: [{ quadro: 'pico', acerto: { fracao: 1, forca: 'media' } }] },
    ] } };
  },

  ator() { return this.b.all[this.cena.atacante]; },
  alvo() { return this.b.all[this.cena.alvo] || this.b.all.find(f => f !== this.ator()); },

  // ---------- listas para os campos ----------
  animsDoAtor() { return Object.keys(this.ator().sprite.def.anims); },
  efeitos() {
    const n = [];
    [this.b.fx, this.b.fx2].forEach(s => s && n.push(...Object.keys(s.def.anims)));
    Object.entries(FF.Assets.sprites).forEach(([id, s]) => { if (id.startsWith('bib:')) n.push(...Object.keys(s.def.anims)); });
    return [...new Set(n)];
  },
  audios() { return (window.FF_BUNDLE && FF_BUNDLE._indice && FF_BUNDLE._indice.audios) || []; },

  // ---------- painel ----------
  montar() {
    const el = document.createElement('div');
    el.id = 'editor';
    el.innerHTML = `<div class="ed-main">
      <div class="ed-topo"><b>🎬 Editor de cenas</b><span><button data-ed="sair" title="Voltar à tela de título">🏠 Sair</button> <button data-ed="min" title="Minimizar">—</button></span></div>
      <div class="ed-linha">
        <label>Quem solta <select data-ed="atacante"></select></label>
        <label>Alvo <select data-ed="alvo"></select></label>
      </div>
      <div class="ed-linha">
        <label style="flex:2">Nome <input data-ed="nome"></label>
        <label>Poder <input data-ed="poder" type="number" step="0.1" min="0"></label>
        <label>Ki <input data-ed="custoKi" type="number" step="5" min="0"></label>
      </div>
      <div class="ed-linha">
        <button class="ed-grande" data-ed="testar">▶ Testar cena (Enter)</button>
        <select data-ed="vel" title="Velocidade"><option value="0.1">0,1×</option><option value="0.25">0,25×</option><option value="0.5">0,5×</option><option value="1" selected>1×</option></select>
      </div>
      <h4>Roteiro <small>(passos em ordem)</small></h4>
      <div class="ed-passos"></div>
      <div class="ed-linha">
        <select data-ed="novoPasso">
          <option value="cena">+ Cena livre (mover sprites na tela)</option>
          <option value="anim">+ Animação do lutador</option>
          <option value="irAte">+ Avançar até o alvo</option>
          <option value="voltar">+ Voltar (teleporte)</option>
          <option value="esperar">+ Esperar</option>
          <option value="mensagem">+ Mensagem na tela</option>
          <option value="json">+ Passo em JSON (avançado)</option>
        </select>
        <button data-ed="addPasso">Adicionar</button>
      </div>
      <div class="ed-fila"></div>
      <h4>Cena</h4>
      <div class="ed-linha">
        <select data-ed="importar"><option value="">Abrir golpe existente…</option></select>
        <select data-ed="salvas"><option value="">Cenas salvas…</option></select>
      </div>
      <div class="ed-linha">
        <button data-ed="salvarHab" class="ed-hab">⭐ Salvar como habilidade</button>
      </div>
      <div class="ed-linha">
        <button data-ed="salvar">💾 Salvar rascunho</button>
        <button data-ed="exportar">📋 Copiar JSON</button>
        <button data-ed="nova">🗋 Nova</button>
      </div>
      <textarea data-ed="json" rows="5" spellcheck="false" placeholder="O JSON do golpe aparece aqui. Mande para o Claude colocar no jogo."></textarea>
      <div class="ed-log"></div>
      <div class="ed-linha"><a href="visualizador.html" target="_blank">Abrir visualizador ↗</a></div></div>
      <div class="ed-cena" hidden></div>`;
    document.body.appendChild(el);
    this.el = el;
    const $ = (s) => el.querySelector('[data-ed="' + s + '"]');
    this.$ = $;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    $('min').onclick = () => el.classList.toggle('min');
    $('sair').onclick = () => { if (confirm('Sair do editor? Cenas não salvas serão perdidas.')) location.href = location.pathname; };
    const preencher = (sel, lado) => {
      sel.innerHTML = '';
      this.b.all.forEach((f, i) => { const o = document.createElement('option'); o.value = i; o.textContent = (f.isHero ? '🟦 ' : '🟥 ') + f.def.nome + (f.sufixo || ''); sel.appendChild(o); });
    };
    preencher($('atacante')); preencher($('alvo'));
    $('atacante').onchange = (e) => { this.cena.atacante = +e.target.value; this.render(); this.preencherImportar(); };
    $('alvo').onchange = (e) => { this.cena.alvo = +e.target.value; };
    ['nome', 'poder', 'custoKi'].forEach(k => $(k).oninput = (e) => {
      const v = e.target.type === 'number' ? (e.target.value === '' ? undefined : +e.target.value) : e.target.value;
      if (v === undefined) delete this.cena.golpe[k]; else this.cena.golpe[k] = v;
      this.atualizarJSON();
    });
    $('testar').onclick = () => this.testar();
    $('vel').onchange = (e) => { FF.Clock.scale = +e.target.value; };
    $('addPasso').onclick = () => this.addPasso($('novoPasso').value);
    $('salvar').onclick = () => this.salvar();
    $('salvarHab').onclick = () => this.salvarHabilidade();
    $('exportar').onclick = () => this.exportar();
    $('nova').onclick = () => { if (confirm('Começar uma cena nova? A atual não salva será perdida.')) { this.cena = this.cenaVazia(); this.render(); } };
    $('importar').onchange = (e) => { const v = e.target.value; if (v.startsWith('hab:')) this.abrirHabilidade(v.slice(4)); else if (v) this.importar(v); e.target.value = ''; };
    $('salvas').onchange = (e) => { if (e.target.value) this.carregar(e.target.value); e.target.value = ''; };
    $('json').onchange = (e) => { try { this.cena.golpe = JSON.parse(e.target.value); this.render(); this.log('JSON aplicado.'); } catch (err) { this.log('❌ JSON inválido: ' + err.message); } };
    window.addEventListener('keydown', (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.code === 'Enter') { e.preventDefault(); this.testar(); }
    });
    // listas para autocompletar
    const dl = (id, itens) => { const d = document.createElement('datalist'); d.id = id; itens.forEach(n => { const o = document.createElement('option'); o.value = n; d.appendChild(o); }); el.appendChild(d); };
    dl('ed-audios', this.audios());
    dl('ed-efeitos', this.efeitos());
    this.preencherImportar();
    this.preencherSalvas();
  },

  preencherImportar() {
    const s = this.$('importar');
    s.length = 1;
    const f = this.ator();
    Object.entries(f.def.golpes || {}).forEach(([id, m]) => { if (id.startsWith('hab_')) return; const o = document.createElement('option'); o.value = id; o.textContent = m.nome || id; s.appendChild(o); });
    const habs = FF.Habilidades ? FF.Habilidades.listar(f.id) : [];
    if (habs.length) {
      const og = document.createElement('optgroup'); og.label = '⭐ Suas habilidades';
      habs.forEach(h => { const o = document.createElement('option'); o.value = 'hab:' + h.id; o.textContent = '⭐ ' + h.nome + (h.equipada ? '' : ' (desligada)'); og.appendChild(o); });
      s.appendChild(og);
    }
  },

  preencherSalvas() {
    const s = this.$('salvas');
    s.length = 1;
    Object.keys(this.lerSalvas()).forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; s.appendChild(o); });
  },

  // ---------- render do roteiro ----------
  render() {
    const g = this.cena.golpe;
    this.$('atacante').value = this.cena.atacante;
    this.$('alvo').value = this.cena.alvo;
    this.$('nome').value = g.nome || '';
    this.$('poder').value = g.poder != null ? g.poder : '';
    this.$('custoKi').value = g.custoKi != null ? g.custoKi : '';
    const box = this.el.querySelector('.ed-passos');
    box.innerHTML = '';
    (g.roteiro || []).forEach((p, i) => box.appendChild(this.cardPasso(p, i)));
    this.renderFila();
    this.atualizarJSON();
  },

  tipoPasso(p) {
    if (p.cena) return 'cena';
    if (typeof p.anim === 'string') return 'anim';
    if (p.irAte) return 'irAte';
    if (p.voltar) return 'voltar';
    if (p.esperar != null && Object.keys(p).length === 1) return 'esperar';
    if (p.mensagem && Object.keys(p).filter(k => !/^mensagem/.test(k)).length === 0) return 'mensagem';
    return 'json';
  },

  campo(rotulo, input) {
    const l = document.createElement('label');
    l.append(rotulo + ' ', input);
    return l;
  },
  inp(valor, onchange, tipo, extra) {
    const i = document.createElement('input');
    if (tipo) i.type = tipo;
    Object.assign(i, extra || {});
    i.value = valor == null ? '' : valor;
    i.oninput = () => { onchange(tipo === 'number' ? (i.value === '' ? undefined : +i.value) : i.value); this.atualizarJSON(); };
    return i;
  },
  sel(opcoes, valor, onchange) {
    const s = document.createElement('select');
    opcoes.forEach(o => { const op = document.createElement('option'); op.value = Array.isArray(o) ? o[0] : o; op.textContent = Array.isArray(o) ? o[1] : o; s.appendChild(op); });
    s.value = valor == null ? '' : valor;
    s.onchange = () => { onchange(s.value); this.atualizarJSON(); };
    return s;
  },
  set(obj, k, v) { if (v === undefined || v === '' || (typeof v === 'number' && isNaN(v))) delete obj[k]; else obj[k] = v; },

  cardPasso(p, i) {
    const g = this.cena.golpe;
    const card = document.createElement('div');
    card.className = 'ed-passo' + (i === this.passoSel ? ' sel' : '');
    card.onclick = (e) => { if (e.target === card || e.target.classList.contains('ed-cab')) { this.passoSel = i; this.render(); } };
    const tipo = this.tipoPasso(p);
    const nomes = { cena: 'Cena livre', anim: 'Animação', irAte: 'Avançar até o alvo', voltar: 'Voltar (teleporte)', esperar: 'Esperar', mensagem: 'Mensagem', json: 'Passo avançado' };
    const cab = document.createElement('div');
    cab.className = 'ed-cab';
    cab.textContent = '#' + (i + 1) + ' ' + nomes[tipo];
    const acoes = document.createElement('span');
    acoes.className = 'ed-acoes';
    const bt = (t, title, fn) => { const b = document.createElement('button'); b.textContent = t; b.title = title; b.onclick = (e) => { e.stopPropagation(); fn(); }; acoes.appendChild(b); };
    bt('▶', 'Ver só esta etapa', () => { this.passoSel = i; this.testar(i); });
    bt('▲', 'Subir', () => { if (i > 0) { [g.roteiro[i - 1], g.roteiro[i]] = [g.roteiro[i], g.roteiro[i - 1]]; this.passoSel = i - 1; this.render(); } });
    bt('▼', 'Descer', () => { if (i < g.roteiro.length - 1) { [g.roteiro[i + 1], g.roteiro[i]] = [g.roteiro[i], g.roteiro[i + 1]]; this.passoSel = i + 1; this.render(); } });
    bt('⧉', 'Duplicar', () => { g.roteiro.splice(i + 1, 0, JSON.parse(JSON.stringify(p))); this.render(); });
    bt('✕', 'Apagar', () => { g.roteiro.splice(i, 1); this.passoSel = Math.max(0, i - 1); this.render(); });
    cab.appendChild(acoes);
    card.appendChild(cab);
    const corpo = document.createElement('div');
    corpo.className = 'ed-corpo';

    if (tipo === 'cena') {
      const c = p.cena;
      const info = document.createElement('small');
      info.textContent = (c.camadas || []).length + ' sprites · ' + (c.duracao || 0) + ' s · ' + (c.sons || []).length + ' sons · ' + (c.acertos || []).length + ' acertos';
      const ed = document.createElement('button');
      ed.className = 'ed-grande';
      ed.textContent = '✏ Editar na tela';
      ed.onclick = (e) => { e.stopPropagation(); this.abrirCena(i); };
      corpo.append(info, this.previaCamadas(c), ed);
    } else if (tipo === 'anim') {
      const lista = this.animsDoAtor();
      const s = this.sel(lista.includes(p.anim) ? lista : [p.anim].concat(lista), p.anim, (v) => { p.anim = v; this.render(); });
      corpo.appendChild(this.campo('Animação', this.previaAnim(s, p.anim, (v) => { p.anim = v; this.render(); this.atualizarJSON(); })));
      const a = this.ator().sprite.anim(this.ator().animName(p.anim));
      const info = document.createElement('small');
      info.textContent = a ? a.frames.length + ' quadros (0 a ' + (a.frames.length - 1) + ') · ' + (a.fps || 0) + ' fps' : '⚠ animação não existe neste lutador';
      corpo.appendChild(info);
      const l2 = document.createElement('div'); l2.className = 'ed-linha';
      l2.appendChild(this.campo('fps', this.inp(p.fps, v => this.set(p, 'fps', v), 'number', { min: 1, step: 1, placeholder: 'padrão' })));
      l2.appendChild(this.campo('repetir por (s)', this.inp(p.duracao, v => this.set(p, 'duracao', v), 'number', { min: 0, step: 0.1, placeholder: 'não' })));
      corpo.appendChild(l2);
      // eventos
      p.eventos = p.eventos || [];
      const evs = document.createElement('div');
      evs.className = 'ed-eventos';
      p.eventos.forEach((ev, k) => evs.appendChild(this.linhaEvento(p, ev, k, a)));
      corpo.appendChild(evs);
      const l3 = document.createElement('div'); l3.className = 'ed-linha';
      const tipoEv = this.sel([['efeito', '+ Efeito visual'], ['som', '+ Som'], ['voz', '+ Voz'], ['acerto', '+ Acerto (dano)'], ['projetil', '+ Projétil'], ['tremer', '+ Tremer tela'], ['flash', '+ Flash'], ['json', '+ Evento em JSON']], 'efeito', () => {});
      const add = document.createElement('button');
      add.textContent = 'Adicionar evento';
      add.onclick = () => { p.eventos.push(this.eventoNovo(tipoEv.value, a)); this.passoSel = i; this.render(); };
      l3.append(tipoEv, add);
      corpo.appendChild(l3);
    } else if (tipo === 'irAte') {
      const l = document.createElement('div'); l.className = 'ed-linha';
      l.appendChild(this.campo('distância', this.inp(p.dist, v => this.set(p, 'dist', v), 'number', { step: 1, placeholder: '22' })));
      l.appendChild(this.campo('tempo (s)', this.inp(p.tempo, v => this.set(p, 'tempo', v), 'number', { step: 0.05, placeholder: '0.22' })));
      const sm = this.sel([''].concat(this.animsDoAtor()), p.animMov || '', v => { this.set(p, 'animMov', v || undefined); this.render(); });
      corpo.appendChild(l);
      corpo.appendChild(this.campo('animação', this.previaAnim(sm, p.animMov || 'avancar', v => { p.animMov = v; this.render(); this.atualizarJSON(); })));
      corpo.appendChild(this.campo('som', this.campoAudio(p.som, v => this.set(p, 'som', v))));
    } else if (tipo === 'voltar') {
      corpo.appendChild(this.campo('som', this.campoAudio(p.som, v => this.set(p, 'som', v))));
    } else if (tipo === 'esperar') {
      corpo.appendChild(this.campo('segundos', this.inp(p.esperar, v => this.set(p, 'esperar', v || 0), 'number', { step: 0.1, min: 0 })));
    } else if (tipo === 'mensagem') {
      corpo.appendChild(this.campo('texto', this.inp(p.mensagem, v => this.set(p, 'mensagem', v))));
    } else {
      corpo.appendChild(this.areaJSON(p, (novo) => { g.roteiro[i] = novo; }));
    }
    card.appendChild(corpo);
    return card;
  },

  areaJSON(obj, aplicar) {
    const t = document.createElement('textarea');
    t.rows = 3; t.spellcheck = false;
    t.value = JSON.stringify(obj);
    t.onchange = () => { try { aplicar(JSON.parse(t.value)); this.render(); } catch (err) { this.log('❌ JSON inválido: ' + err.message); } };
    return t;
  },

  campoAudio(valor, onchange) {
    const w = document.createElement('span');
    w.className = 'ed-audio';
    const i = this.inp(Array.isArray(valor) ? valor.join(', ') : valor, v => {
      const lista = (v || '').split(',').map(x => x.trim()).filter(Boolean);
      onchange(lista.length > 1 ? lista : lista[0]);
    }, null, { placeholder: 'nome do som (vírgula = sorteia)' });
    i.setAttribute('list', 'ed-audios');
    const b = document.createElement('button');
    b.textContent = '▶'; b.title = 'Ouvir';
    b.onclick = () => { const n = i.value.split(',')[0].trim(); if (n) FF.Audio.play(n, 1); };
    w.append(i, b);
    return w;
  },

  eventoNovo(tipo, anim) {
    const pico = anim && anim.frames.some(f => f[8] && f[8].length) ? 'pico' : 0;
    switch (tipo) {
      case 'efeito': return { quadro: pico, efeito: { fx: 'impacto', em: 'alvo', escala: 1 } };
      case 'som': return { quadro: 0, som: 'hit_midle-a' };
      case 'voz': return { quadro: 0, voz: '' };
      case 'acerto': return { quadro: pico, acerto: { fracao: 0.5, forca: 'media' } };
      case 'projetil': return { quadro: pico, projetil: { fx: 'kiblast_amarelo', velocidade: 600, disparo: 'kiblast_hit', impacto: 'explosao1', impactoEscala: 0.8, som: 'kidan_fire', somImpacto: 'explosao', tremerImpacto: 5, acerto: { fracao: 0.5, forca: 'energia' } } };
      case 'tremer': return { quadro: 0, tremer: 6 };
      case 'flash': return { quadro: 0, flash: 0.4 };
      default: return { quadro: 0 };
    }
  },

  linhaEvento(p, ev, k, anim) {
    const row = document.createElement('div');
    row.className = 'ed-evento';
    const n = anim ? anim.frames.length : 1;
    const q = this.inp(ev.quadro, v => { ev.quadro = /^-?\d+$/.test(String(v)) ? +v : (v || 0); }, null, { size: 3, title: 'quadro: número (0 a ' + (n - 1) + '), "pico" ou "fim"' });
    q.setAttribute('list', 'ed-quadros-' + n);
    if (!this.el.querySelector('#ed-quadros-' + n)) {
      const d = document.createElement('datalist'); d.id = 'ed-quadros-' + n;
      ['pico', 'fim'].concat([...Array(n).keys()]).forEach(x => { const o = document.createElement('option'); o.value = x; d.appendChild(o); });
      this.el.appendChild(d);
    }
    const lab = document.createElement('span'); lab.className = 'ed-q'; lab.textContent = 'q';
    row.append(lab, q);
    const del = document.createElement('button');
    del.textContent = '✕'; del.title = 'Apagar evento';
    del.onclick = () => { p.eventos.splice(k, 1); this.render(); };

    if (ev.efeito) {
      const e = ev.efeito;
      const fx = this.inp(e.fx, v => this.set(e, 'fx', v), null, { placeholder: 'efeito' });
      fx.setAttribute('list', 'ed-efeitos');
      fx.addEventListener('change', () => this.render());
      row.append('✨', this.previaEfeito(fx, e.fx, v => { e.fx = v; this.render(); this.atualizarJSON(); }),
        this.sel([['alvo', 'no alvo'], ['disparo', 'na mão'], ['origem', 'nos pés']], e.em || 'origem', v => this.set(e, 'em', v)),
        this.mini('x', e.dx, v => this.set(e, 'dx', v)), this.mini('y', e.dy, v => this.set(e, 'dy', v)),
        this.mini('tam', e.escala, v => this.set(e, 'escala', v), 0.05));
      const al = document.createElement('button');
      al.textContent = '🎯'; al.title = 'Alinhar: clique na tela onde o efeito deve aparecer';
      al.onclick = () => { this.alinhando = { ev, e }; this.log('🎯 Clique na tela onde o efeito "' + e.fx + '" deve aparecer…'); };
      const ver = document.createElement('button');
      ver.textContent = '👁'; ver.title = 'Ver só este efeito agora';
      ver.onclick = () => this.verEfeito(e);
      row.append(al, ver);
    } else if (ev.som != null || ev.voz != null) {
      const k2 = ev.som != null ? 'som' : 'voz';
      row.append(k2 === 'som' ? '🔊' : '🗣', this.campoAudio(ev[k2], v => { ev[k2] = v || ''; }));
    } else if (ev.acerto) {
      const a = ev.acerto;
      const lanca = document.createElement('input'); lanca.type = 'checkbox'; lanca.checked = !!a.lanca; lanca.title = 'lança o alvo';
      lanca.onchange = () => { this.set(a, 'lanca', lanca.checked || undefined); this.atualizarJSON(); };
      row.append('💥', this.mini('dano', a.fracao, v => this.set(a, 'fracao', v), 0.05),
        this.sel(['leve', 'media', 'forte', 'energia'], a.forca || 'leve', v => this.set(a, 'forca', v)),
        this.campo('lança', lanca));
    } else if (ev.projetil) {
      const pr = ev.projetil;
      pr.acerto = pr.acerto || { fracao: 0.5, forca: 'energia' };
      const efx = (k, ph) => {
        const i = this.inp(pr[k], v => this.set(pr, k, v), null, { placeholder: ph });
        i.setAttribute('list', 'ed-efeitos');
        i.addEventListener('change', () => this.render());
        return this.previaEfeito(i, pr[k], v => { pr[k] = v; this.render(); this.atualizarJSON(); });
      };
      const ck = (k, rot, padrao) => {
        const c = document.createElement('input'); c.type = 'checkbox';
        c.checked = pr[k] != null ? !!pr[k] : padrao;
        c.onchange = () => { this.set(pr, k, c.checked === padrao ? undefined : c.checked); this.atualizarJSON(); };
        return this.campo(rot, c);
      };
      row.append('🔸', efx('fx', 'projétil'), this.mini('vel', pr.velocidade, v => this.set(pr, 'velocidade', v), 50),
        this.mini('tam', pr.escala, v => this.set(pr, 'escala', v), 0.1), this.mini('dano', pr.acerto.fracao, v => this.set(pr.acerto, 'fracao', v), 0.05));
      const l2 = document.createElement('div'); l2.className = 'ed-sub';
      l2.append('na mão:', efx('disparo', 'efeito ao soltar'), 'no alvo:', efx('impacto', 'explosão'),
        this.mini('tam', pr.impactoEscala, v => this.set(pr, 'impactoEscala', v), 0.1));
      const l3 = document.createElement('div'); l3.className = 'ed-sub';
      l3.append('som ao soltar', this.campoAudio(pr.som, v => this.set(pr, 'som', v)));
      const l4 = document.createElement('div'); l4.className = 'ed-sub';
      l4.append('som do impacto', this.campoAudio(pr.somImpacto, v => this.set(pr, 'somImpacto', v)), this.mini('tremer', pr.tremerImpacto, v => this.set(pr, 'tremerImpacto', v)));
      const l5 = document.createElement('div'); l5.className = 'ed-sub';
      l5.append(ck('rastro', 'rastro', true), ck('atravessar', 'atravessa a tela', false),
        this.mini('arco', pr.curva, v => this.set(pr, 'curva', v), 5), this.mini('onda', pr.ondular, v => this.set(pr, 'ondular', v), 1),
        this.mini('giro', pr.girar, v => this.set(pr, 'girar', v), 90));
      row.append(l2, l3, l4, l5);
    } else if (ev.tremer != null) {
      row.append('〰', this.mini('força', ev.tremer, v => this.set(ev, 'tremer', v)));
    } else if (ev.flash != null) {
      row.append('⚡', this.mini('força', ev.flash, v => this.set(ev, 'flash', v), 0.1));
    } else {
      const copia = Object.assign({}, ev);
      row.appendChild(this.areaJSON(copia, (novo) => { p.eventos[k] = novo; }));
    }
    row.appendChild(del);
    return row;
  },

  mini(rot, valor, onchange, passo) {
    const i = this.inp(valor, onchange, 'number', { step: passo || 1, title: rot, placeholder: rot });
    i.className = 'ed-mini';
    return i;
  },

  addPasso(tipo) {
    const g = this.cena.golpe;
    g.roteiro = g.roteiro || [];
    const novo = { cena: { cena: { duracao: 2, camadas: [], sons: [], acertos: [], esconderAtacante: false } },
      anim: { anim: this.animsDoAtor().find(n => /^Special/.test(n)) || this.animsDoAtor()[0], eventos: [] },
      irAte: { irAte: 'alvo', dist: 22, tempo: 0.22, animMov: 'Dash', som: 'jetdash' },
      voltar: { voltar: true, som: 'teletransporte' }, esperar: { esperar: 0.3 }, mensagem: { mensagem: 'Texto' }, json: {} }[tipo];
    g.roteiro.splice(this.passoSel + 1, 0, novo);
    this.passoSel = Math.min(g.roteiro.length - 1, this.passoSel + 1);
    this.render();
    if (tipo === 'cena') this.abrirCena(this.passoSel);
  },

  // ---------- itens enviados pelo visualizador ----------
  lerFila() { try { return JSON.parse(localStorage.getItem(this.FILA) || '[]'); } catch (e) { return []; } },
  renderFila() {
    const box = this.el.querySelector('.ed-fila');
    const fila = this.lerFila();
    box.innerHTML = '';
    if (!fila.length) return;
    const t = document.createElement('div');
    t.className = 'ed-fila-tit';
    t.textContent = 'Enviados do visualizador (clique para usar no passo selecionado):';
    box.appendChild(t);
    fila.forEach((it, k) => {
      const b = document.createElement('button');
      b.textContent = (it.tipo === 'som' ? '🔊 ' : '🎞 ') + (it.anim || it.som) + (it.sprite ? ' (' + it.sprite + (it.quadro != null ? ' q' + it.quadro : '') + ')' : '');
      b.onclick = () => this.usarItem(it, k);
      box.appendChild(b);
    });
    const limpar = document.createElement('button');
    limpar.textContent = 'limpar lista';
    limpar.onclick = () => { try { localStorage.removeItem(this.FILA); } catch (e) { /* nada */ } this.renderFila(); };
    box.appendChild(limpar);
  },
  usarItem(it, k) {
    const g = this.cena.golpe;
    const passo = g.roteiro[this.passoSel];
    const animPasso = passo && typeof passo.anim === 'string';
    if (it.tipo === 'som') {
      if (!animPasso) return this.log('Selecione um passo de animação para receber o som.');
      passo.eventos = passo.eventos || [];
      passo.eventos.push({ quadro: it.quadro != null ? it.quadro : 0, som: it.som });
    } else if (it.sprite === this.ator().form.sprite) {
      g.roteiro.splice(this.passoSel + 1, 0, { anim: it.anim, eventos: [] });
      this.passoSel++;
    } else if (this.b.fxSet(it.anim)) {
      if (!animPasso) return this.log('Selecione um passo de animação para receber o efeito.');
      passo.eventos = passo.eventos || [];
      passo.eventos.push({ quadro: it.quadro != null ? it.quadro : 0, efeito: { fx: it.anim, em: 'alvo', escala: 1 } });
    } else {
      return this.log('⚠ "' + it.anim + '" é de ' + it.sprite + ', que não é o lutador escolhido nem um efeito.');
    }
    this.render();
  },

  // ---------- teste ----------
  // so = índice de uma etapa: toca só ela (sem anúncio nem gasto de ki)
  async testar(so) {
    if (this.ocupado) return;
    const b = this.b, actor = this.ator(), target = this.alvo();
    if (!target || actor === target) return this.log('Escolha um alvo diferente de quem solta.');
    const soPasso = typeof so === 'number';
    if (soPasso && this.cenaIdx != null) this.fecharCena();
    this.ocupado = true;
    this.$('testar').disabled = true;
    this.el.querySelectorAll('.ed-passo').forEach((c, k) => c.classList.toggle('tocando', soPasso && k === so));
    const move = JSON.parse(JSON.stringify(this.cena.golpe));
    if (soPasso) {
      // posição em que o lutador estaria ao chegar nesta etapa (depois de um "avançar", fica perto do alvo)
      let perto = null;
      move.roteiro.slice(0, so).forEach(p => { if (p.irAte === 'alvo') perto = p; else if (p.voltar) perto = null; });
      if (perto) actor.x = target.x - actor.dir * (perto.dist || 22) * actor.scale;
      move.roteiro = [move.roteiro[so]];
      move.anuncio = false;
      delete move.custoKi;
    }
    b.all.forEach(f => { f.ki = f.kiMax; f.ko = false; f.hp = f.hpMax; if (move.supremo) f.rage = 100; });
    this.dano = 0;
    this.log('▶ ' + actor.nome + ': ' + (soPasso ? 'etapa #' + (so + 1) + ' de ' : '') + (move.nome || 'cena'));
    try {
      b.atual = actor;
      await b.execute(actor, target, move);
      this.log('   dano total: ' + Math.round(this.dano));
    } catch (err) { console.error(err); this.log('❌ erro: ' + err.message); }
    b.atual = null;
    b.all.forEach(f => { f.ko = false; f.hp = f.hpMax; f.ki = f.kiMax; if (!f.busy) f.idle(); });
    this.ocupado = false;
    this.$('testar').disabled = false;
    this.el.querySelectorAll('.ed-passo.tocando').forEach(c => c.classList.remove('tocando'));
  },

  // ponto de referência do efeito (igual ao usado pelo motor em script.js)
  ancora(e) {
    const actor = this.ator(), target = this.alvo();
    if (e.em === 'alvo' && target) return target.peito();
    if (e.em === 'disparo') return actor.pontoDisparo();
    return { x: actor.x, y: actor.groundY };
  },

  verEfeito(e) {
    const actor = this.ator(), p = this.ancora(e);
    this.b.spawnFx(e.fx, p.x + (e.dx || 0) * actor.dir, p.y + (e.dy || 0), actor.dir < 0, e.escala, e);
  },

  ganchos() {
    const b = this.b;
    const orig = b.applyHit.bind(b);
    b.applyHit = (att, def, move, spec, qte) => { const d = orig(att, def, move, spec, qte); if (typeof d === 'number') this.dano += d; if (def.hp <= 0) { def.hp = 1; def.ko = false; } return d; };
    // clique de alinhamento na tela
    const cv = document.getElementById('tela');
    cv.addEventListener('pointerdown', (ev) => {
      if (this.cenaIdx != null && this.cenaPointer) { this.cenaPointer(ev); return; }
      if (!this.alinhando) return;
      ev.stopImmediatePropagation(); ev.preventDefault();
      const r = cv.getBoundingClientRect();
      const x = (ev.clientX - r.left) * cv.width / r.width, y = (ev.clientY - r.top) * cv.height / r.height;
      const { e } = this.alinhando;
      const p = this.ancora(e), actor = this.ator();
      e.dx = Math.round((x - p.x) * actor.dir);
      e.dy = Math.round(y - p.y);
      this.alinhando = null;
      this.log('🎯 "' + e.fx + '" alinhado em x ' + e.dx + ', y ' + e.dy + '.');
      this.render();
      this.verEfeito(e);
    }, true);
    // desenha a mira do efeito que está sendo alinhado
    const draw = b.draw.bind(b);
    b.draw = (ctx) => {
      draw(ctx);
      if (this.cenaIdx != null && this.desenharEdicaoCena) this.desenharEdicaoCena(ctx);
      if (this.alinhando) {
        const p = this.ancora(this.alinhando.e);
        ctx.save(); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 7); ctx.stroke();
        ctx.fillStyle = '#ffd84a'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('referência', p.x + 12, p.y - 10);
        ctx.restore();
      }
    };
    window.addEventListener('storage', (e) => { if (e.key === this.FILA) this.renderFila(); });
    window.addEventListener('focus', () => this.renderFila());
  },

  // ---------- salvar / exportar ----------
  lerSalvas() { try { return JSON.parse(localStorage.getItem(this.CHAVE) || '{}'); } catch (e) { return {}; } },
  salvar() {
    const nome = prompt('Nome da cena:', this.cena.golpe.nome || 'cena');
    if (!nome) return;
    const s = this.lerSalvas();
    s[nome] = { atacante: this.ator().id, golpe: this.cena.golpe };
    try { localStorage.setItem(this.CHAVE, JSON.stringify(s)); this.log('💾 Cena "' + nome + '" salva neste navegador.'); } catch (e) { this.log('❌ Não deu para salvar neste navegador.'); }
    this.preencherSalvas();
  },
  // vira golpe de verdade: aparece no menu do personagem nas batalhas (liga/desliga na seleção ou na pausa)
  salvarHabilidade() {
    const g = this.cena.golpe, ator = this.ator();
    let id = g.habId;
    const ex = id && FF.Habilidades.ler()[id];
    if (ex && ex.personagem !== ator.id) id = null;          // aberta em outro lutador: vira uma nova
    if (ex && id && !confirm('Atualizar a habilidade "' + ex.nome + '"?\n(Cancelar = salvar como uma nova)')) id = null;
    const nome = prompt('Nome da habilidade (aparece no menu de golpes de ' + ator.def.nome + '):', g.nome && g.nome !== 'Novo golpe' ? g.nome : '');
    if (!nome) return;
    if (g.custoKi == null) {
      const ki = prompt('Custo de ki (0 = grátis):', '20');
      if (ki === null) return;
      if (+ki > 0) g.custoKi = +ki;
    }
    const h = FF.Habilidades.salvar({ id, nome, personagem: ator.id, forma: ator.formId, golpe: g });
    if (!h) return this.log('❌ Não deu para salvar neste navegador.');
    this.cena.golpe = JSON.parse(JSON.stringify(h.golpe));
    FF.Habilidades.atualizarBatalha(this.b);
    this.render();
    this.preencherImportar();
    this.log('⭐ Habilidade "' + nome + '" salva para ' + ator.def.nome + (h.equipada ? ' e já equipada' : '') + '. Teste em Batalha Livre (botão ⭐ Habilidades) ou no ⏸ durante a luta.');
  },
  abrirHabilidade(id) {
    const h = FF.Habilidades.ler()[id];
    if (!h) return this.log('Habilidade não encontrada.');
    const i = this.b.all.findIndex(f => f.id === h.personagem);
    if (i >= 0) this.cena.atacante = i;
    const ator = this.ator();
    if (h.forma && ator.def.formas[h.forma] && ator.formId !== h.forma) { ator.setForm(h.forma); ator.idle(); }
    this.cena.golpe = JSON.parse(JSON.stringify(h.golpe));
    this.passoSel = 0;
    this.render();
    this.preencherImportar();
    this.log('✏ Editando a habilidade "' + h.nome + '". Use ⭐ Salvar como habilidade para atualizar.');
  },
  carregar(nome) {
    const c = this.lerSalvas()[nome];
    if (!c) return;
    const i = this.b.all.findIndex(f => f.id === c.atacante);
    if (i >= 0) this.cena.atacante = i;
    else this.log('⚠ ' + c.atacante + ' não está nesta batalha; abrindo no lutador atual.');
    this.cena.golpe = JSON.parse(JSON.stringify(c.golpe));
    this.passoSel = 0;
    this.render();
  },
  importar(id) {
    const mv = this.ator().def.golpes[id];
    this.cena.golpe = JSON.parse(JSON.stringify(mv));
    this.passoSel = 0;
    this.render();
    this.log('Aberto: ' + (mv.nome || id) + '. As mudanças só valem aqui até você exportar.');
  },
  atualizarJSON() {
    const t = this.$('json');
    if (document.activeElement !== t) t.value = JSON.stringify(this.cena.golpe, null, 1);
  },
  exportar() {
    const txt = '// ' + this.ator().def.nome + ' (' + this.ator().id + ')\n' + JSON.stringify(this.cena.golpe, null, 2);
    const ok = () => this.log('📋 JSON copiado. Cole na conversa com o Claude para virar golpe do jogo.');
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok, () => { this.$('json').select(); this.log('Selecione o texto e copie.'); });
    else { this.$('json').select(); this.log('Selecione o texto e copie.'); }
  },

  log(txt) {
    const el = this.el.querySelector('.ed-log');
    el.textContent = txt;
  },
};
