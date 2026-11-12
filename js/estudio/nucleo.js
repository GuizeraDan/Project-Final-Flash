// Estúdio Final Flash — núcleo: abas, desfazer/refazer, rascunho automático, avisos, sincronização e
// utilidades de interface usadas por todas as abas (js/estudio/*.js).
//
// Uma aba se registra com FF.Estudio.registrarAba({ id, nome, icone, montar(el), mostrar?(), esconder?(),
//   quadro?(dt) (chamado a cada quadro de tela enquanto a aba está aberta), teclado?(e) → true se tratou,
//   historico? (FF.Estudio.Historico usado pelo Ctrl+Z/Ctrl+Y quando a aba está aberta) }).
window.FF = window.FF || {};

FF.Estudio = {
  abas: [],
  ativa: null,

  registrarAba(a) { this.abas.push(a); },

  async iniciar() {
    const nav = document.getElementById('es-abas');
    const corpo = document.getElementById('es-corpo');
    // sprites básicos (efeitos, cenário) antes de montar as abas
    await Promise.all(['fx', 'fx_extra', 'stage_campo', 'hud_zl3', 'retratos'].map(id => FF.Assets.loadSprite(id).catch(() => null)));
    for (const a of this.abas) {
      const b = document.createElement('button');
      b.className = 'es-aba-bt';
      b.dataset.aba = a.id;
      b.innerHTML = '<span>' + (a.icone ? a.icone + ' ' : '') + a.nome + '</span>';
      b.onclick = () => this.abrir(a.id);
      nav.appendChild(b);
      a.el = document.createElement('section');
      a.el.className = 'es-aba es-aba-' + a.id;
      a.el.hidden = true;
      corpo.appendChild(a.el);
      a._montada = false;
    }
    const q = new URLSearchParams(location.search);
    let ini = q.get('aba');
    if (!ini) ini = this.rascunho.ler('aba') || 'golpes';
    if (ini === 'importar') ini = 'sprites';    // a antiga aba Importar agora fica dentro de Sprites
    if (!this.abas.find(a => a.id === ini)) ini = this.abas[0] && this.abas[0].id;
    if (ini) await this.abrir(ini);
    document.getElementById('es-desfazer').onclick = () => this.desfazer();
    document.getElementById('es-refazer').onclick = () => this.refazer();
    document.getElementById('es-sync').onclick = () => this.abrirSync();
    FF.Edicoes.ouvintes.push(() => this.renderSync());
    this.renderSync();
    window.addEventListener('keydown', (e) => this.teclado(e));
    window.addEventListener('beforeunload', () => this.abas.forEach(a => a.antesDeSair && a.antesDeSair()));
    let ult = performance.now();
    const loop = (agora) => {
      const dt = Math.min(0.05, (agora - ult) / 1000);
      ult = agora;
      const a = this.ativa;
      if (a && a.quadro) { try { a.quadro(dt); } catch (e) { if (!this._erroLoop) { this._erroLoop = 1; console.error(e); } } }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // tenta mandar o que ficou pendente de outra vez
    if (FF.Edicoes.conectado()) FF.Edicoes.enviar();
    this.pronto = true;
  },

  async abrir(id) {
    const a = this.abas.find(x => x.id === id);
    if (!a) return;
    if (this.ativa && this.ativa !== a) { this.ativa.el.hidden = true; this.ativa.esconder && this.ativa.esconder(); }
    document.querySelectorAll('.es-aba-bt').forEach(b => b.classList.toggle('sel', b.dataset.aba === id));
    a.el.hidden = false;
    this.ativa = a;
    if (!a._montada) { a._montada = true; await a.montar(a.el); }
    a.mostrar && a.mostrar();
    this.rascunho.gravar('aba', id);
    this.renderHist();
  },

  // ---------- teclado ----------
  digitando(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes(t.type) || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  },
  teclado(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && !this.digitando(e) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) this.refazer(); else this.desfazer(); return; }
    if (ctrl && !this.digitando(e) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); this.refazer(); return; }
    if (e.key === 'Escape' && document.querySelector('.es-modal:not([hidden])')) { const m = [...document.querySelectorAll('.es-modal')].pop(); m._fechar && m._fechar(); return; }
    if (this.ativa && this.ativa.teclado && this.ativa.teclado(e)) e.preventDefault();
  },

  // ---------- desfazer / refazer ----------
  desfazer() { const h = this.ativa && this.ativa.historico; if (h && h.desfazer()) this.aviso('↶ ' + (h.rotuloRefazer() || 'Desfeito')); this.renderHist(); },
  refazer() { const h = this.ativa && this.ativa.historico; if (h && h.refazer()) this.aviso('↷ ' + (h.rotuloAtual() || 'Refeito')); this.renderHist(); },
  renderHist() {
    const h = this.ativa && this.ativa.historico;
    document.getElementById('es-desfazer').disabled = !(h && h.podeDesfazer());
    document.getElementById('es-refazer').disabled = !(h && h.podeRefazer());
  },

  // ---------- avisos ----------
  aviso(msg, tipo) {
    const box = document.getElementById('es-avisos');
    const d = document.createElement('div');
    d.className = 'es-aviso ' + (tipo || '');
    d.textContent = msg;
    box.appendChild(d);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => d.classList.add('sai'), tipo === 'erro' ? 6000 : 2600);
    setTimeout(() => d.remove(), tipo === 'erro' ? 6600 : 3200);
  },

  // ---------- rascunho automático (localStorage, por aparelho) ----------
  rascunho: {
    P: 'ff_estudio_',
    ler(k) { try { const v = localStorage.getItem(this.P + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    gravar(k, v) { try { if (v == null) localStorage.removeItem(this.P + k); else localStorage.setItem(this.P + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  },

  // salva no jogo (todas as telas e todos os aparelhos)
  salvarNoJogo(caminho, valor, msg) {
    FF.Edicoes.set(caminho, valor);
    this.aviso((msg || '💾 Salvo no jogo.') + (FF.Edicoes.conectado() ? ' Enviando para todos os aparelhos…' : ' (só neste aparelho até conectar o ☁)'), 'ok');
    this.renderSync();
  },

  // ---------- ☁ sincronização ----------
  renderSync() {
    const bt = document.getElementById('es-sync');
    if (!bt) return;
    const n = FF.Edicoes.pendentes().length;
    const con = FF.Edicoes.conectado();
    bt.classList.toggle('local', !con);
    bt.classList.toggle('erro', FF.Edicoes.estado === 'erro');
    bt.classList.toggle('enviando', FF.Edicoes.estado === 'enviando');
    bt.querySelector('span').textContent = !con ? (n ? n + ' só aqui' : 'Conectar') : FF.Edicoes.estado === 'enviando' ? 'Enviando…' : FF.Edicoes.estado === 'erro' ? 'Erro' : n ? n + ' pendente(s)' : 'Sincronizado';
    bt.title = FF.Edicoes.resumo();
  },
  abrirSync() {
    const c = document.createElement('div');
    c.className = 'es-sync-caixa';
    c.innerHTML = `<p class="es-sync-estado"></p>
      <div data-s="off">
        <p>O Estúdio grava tudo direto no repositório do jogo no GitHub (golpes, sprites, imagens importadas, personagens). O site se atualiza sozinho e o celular, o PC e o app instalado recebem.</p>
        <p>Cada aparelho precisa de uma <b>chave de acesso</b> do GitHub (só uma vez — a mesma do Editor serve):</p>
        <ol>
          <li>Abra <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a> (logado na sua conta).</li>
          <li>Nome: <i>Final Flash</i>. <b>Repository access</b> → <i>Only select repositories</i> → <b>Project-Final-Flash</b>.</li>
          <li><b>Permissions</b> → <b>Contents</b> → <i>Read and write</i>. Gere e copie (começa com <code>github_pat_</code>).</li>
        </ol>
        <input data-s="token" type="password" placeholder="github_pat_…" autocomplete="off">
        <button data-s="conectar" class="es-bt-ouro">Conectar</button>
        <p class="es-obs">A chave fica guardada só neste navegador e só tem acesso a este repositório.</p>
      </div>
      <div data-s="on">
        <p>✅ Este aparelho está conectado: tudo o que você salvar vai para todos os aparelhos (o site leva ~1 min para publicar).</p>
        <button data-s="enviar" class="es-bt-ouro">Enviar pendentes agora</button>
        <button data-s="sair">Desconectar este aparelho</button>
      </div>
      <p data-s="msg"></p>`;
    const m = this.modal('☁ Salvar para todos os aparelhos', c);
    const q = (k) => c.querySelector('[data-s="' + k + '"]');
    const mostrar = async () => {
      q('off').hidden = FF.Edicoes.conectado(); q('on').hidden = !FF.Edicoes.conectado();
      const imgs = FF.ImagensUsr ? (await FF.ImagensUsr.pendentes()).length : 0;
      c.querySelector('.es-sync-estado').textContent = FF.Edicoes.resumo() + (imgs ? ' · ' + imgs + ' imagem(ns) esperando envio' : '');
    };
    q('conectar').onclick = async () => {
      q('msg').textContent = 'Verificando…';
      try { await FF.Edicoes.conectar(q('token').value); q('token').value = ''; q('msg').textContent = '✅ Conectado!'; mostrar(); }
      catch (e) { q('msg').textContent = '❌ ' + e.message; }
    };
    q('enviar').onclick = async () => { q('msg').textContent = 'Enviando…'; const r = await FF.Edicoes.enviar(); q('msg').textContent = r.erro ? '❌ ' + r.erro : '✅ ' + FF.Edicoes.resumo(); mostrar(); };
    q('sair').onclick = async () => { if (await this.confirmar('Desconectar', 'Desconectar este aparelho? As próximas mudanças ficarão só nele.', 'Desconectar', true)) { FF.Edicoes.desconectar(); mostrar(); } };
    mostrar();
    return m;
  },

  // ---------- interface ----------
  el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  },
  botao(txt, fn, title, cls) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = txt;
    if (title) b.title = title;
    if (cls) b.className = cls;
    b.onclick = (e) => fn(e, b);
    return b;
  },
  // janela por cima de tudo; devolve { el, fechar }
  modal(titulo, conteudo, opts = {}) {
    const m = document.createElement('div');
    m.className = 'es-modal';
    const cx = document.createElement('div');
    cx.className = 'es-modal-caixa' + (opts.larga ? ' larga' : '');
    const topo = document.createElement('div');
    topo.className = 'es-modal-topo';
    topo.innerHTML = '<b></b>';
    topo.querySelector('b').textContent = titulo;
    const fechar = () => { m.remove(); opts.aoFechar && opts.aoFechar(); };
    m._fechar = fechar;
    topo.appendChild(this.botao('✕', fechar, 'Fechar (Esc)'));
    cx.append(topo, conteudo);
    m.appendChild(cx);
    m.addEventListener('pointerdown', (e) => { if (e.target === m) fechar(); });
    document.body.appendChild(m);
    return { el: m, fechar };
  },
  // pergunta com botões próprios (no lugar do confirm do navegador, que só tem OK/Cancelar).
  // opcoes: [{ txt, valor, cls }]. Fechar (✕/Esc/fora) devolve null.
  escolha(titulo, texto, opcoes) {
    return new Promise(res => {
      const c = this.el('div', 'es-escolha');
      const p = this.el('p'); p.textContent = texto;
      const bts = this.el('div', 'es-escolha-bts');
      let feito = false;
      const m = this.modal(titulo, c, { aoFechar: () => { if (!feito) res(null); } });
      opcoes.forEach((o, i) => {
        const b = this.botao(o.txt, () => { feito = true; m.fechar(); res(o.valor); }, null, o.cls || '');
        bts.appendChild(b);
        if (i === 0) setTimeout(() => b.focus(), 30);
      });
      c.append(p, bts);
    });
  },
  confirmar(titulo, texto, sim, perigo) {
    return this.escolha(titulo, texto, [{ txt: sim || 'Sim', valor: true, cls: perigo ? 'es-bt-perigo' : 'es-bt-ouro' }, { txt: 'Não', valor: false }]).then(v => !!v);
  },
  perguntar(titulo, texto, valor) {
    return new Promise(res => {
      const c = this.el('div', 'es-perg');
      const p = this.el('p'); p.textContent = texto;
      const i = document.createElement('input'); i.value = valor || '';
      const ok = this.botao('OK', () => { res(i.value); m.fechar(); }, null, 'es-bt-ouro');
      i.onkeydown = (e) => { if (e.key === 'Enter') ok.click(); };
      c.append(p, i, ok);
      const m = this.modal(titulo, c, { aoFechar: () => res(null) });
      setTimeout(() => i.focus(), 30);
    });
  },

  // linha de propriedade: rótulo + controle. tipo: texto, numero, check, select, cor, area, json, som, anim
  // opts: { lista (select: [[valor, texto]] ou [valor]), passo, min, max, dica, sprite (anim), vozes }
  campo(tipo, rotulo, valor, aoMudar, opts = {}) {
    const row = document.createElement('label');
    row.className = 'es-campo es-campo-' + tipo;
    const r = document.createElement('span');
    r.className = 'es-rot';
    r.textContent = rotulo;
    if (opts.dica) row.title = opts.dica;
    row.appendChild(r);
    let inp;
    if (tipo === 'check') {
      inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = !!valor;
      inp.onchange = () => aoMudar(inp.checked);
    } else if (tipo === 'select') {
      inp = document.createElement('select');
      (opts.lista || []).forEach(o => {
        const [v, t] = Array.isArray(o) ? o : [o, o];
        const op = document.createElement('option'); op.value = v; op.textContent = t; inp.appendChild(op);
      });
      inp.value = valor == null ? '' : valor;
      inp.onchange = () => aoMudar(inp.value);
    } else if (tipo === 'area' || tipo === 'json') {
      inp = document.createElement('textarea');
      inp.value = tipo === 'json' ? (valor == null ? '' : JSON.stringify(valor, null, 1)) : (valor || '');
      inp.rows = opts.linhas || 3;
      inp.onchange = () => {
        if (tipo !== 'json') return aoMudar(inp.value);
        if (!inp.value.trim()) return aoMudar(undefined);
        try { aoMudar(JSON.parse(inp.value)); inp.classList.remove('ruim'); } catch (e) { inp.classList.add('ruim'); FF.Estudio.aviso('JSON inválido: ' + e.message, 'erro'); }
      };
    } else {
      inp = document.createElement('input');
      inp.type = tipo === 'numero' ? 'number' : tipo === 'cor' ? 'color' : 'text';
      if (tipo === 'numero') { inp.step = opts.passo || 'any'; if (opts.min != null) inp.min = opts.min; if (opts.max != null) inp.max = opts.max; }
      inp.value = valor == null ? '' : (Array.isArray(valor) ? valor.join(', ') : valor);
      if (opts.placeholder) inp.placeholder = opts.placeholder;
      if (tipo === 'anim' || tipo === 'som' || opts.sugestoes) {
        const id = 'dl_' + Math.random().toString(36).slice(2);
        const dl = document.createElement('datalist'); dl.id = id;
        const sug = opts.sugestoes || (tipo === 'som' ? this.sons() : []);
        sug.slice(0, 3000).forEach(s => { const o = document.createElement('option'); o.value = s; dl.appendChild(o); });
        row.appendChild(dl);
        inp.setAttribute('list', id);
      }
      const ler = () => {
        if (tipo === 'numero') return inp.value === '' ? undefined : +inp.value;
        if (tipo === 'som' && inp.value.includes(',')) return inp.value.split(',').map(x => x.trim()).filter(Boolean);
        return inp.value === '' ? undefined : inp.value;
      };
      inp.onchange = () => aoMudar(ler());
      if (tipo === 'numero') inp.oninput = () => { if (inp.value !== '' && !isNaN(+inp.value)) aoMudar(ler(), true); };
    }
    row.appendChild(inp);
    if (tipo === 'som') {
      row.appendChild(this.botao('▶', (e) => { e.preventDefault(); const v = inp.value.split(',')[0].trim(); if (v) FF.Audio.play(v); }, 'Ouvir'));
      row.appendChild(this.botao('🎧', (e) => { e.preventDefault(); this.escolherSom(inp.value, (v) => { inp.value = v; aoMudar(v); }, opts.vozes); }, 'Escolher na lista de sons'));
    }
    row._inp = inp;
    return row;
  },
  grupo(titulo, aberto = true) {
    const d = document.createElement('details');
    d.className = 'es-grupo';
    d.open = aberto;
    const s = document.createElement('summary');
    s.textContent = titulo;
    d.appendChild(s);
    return d;
  },

  sons() { return ((window.FF_BUNDLE && FF_BUNDLE._indice) || {}).audios || []; },
  escolherSom(atual, aoEscolher, vozes) {
    const c = this.el('div', 'es-sons');
    const busca = document.createElement('input');
    busca.type = 'search'; busca.placeholder = 'Filtrar (ex.: vgkn, kame, hit, explos)';
    busca.value = vozes || '';
    const lista = this.el('div', 'es-sons-lista');
    const render = () => {
      lista.innerHTML = '';
      const f = busca.value.toLowerCase();
      this.sons().filter(s => !f || s.toLowerCase().includes(f)).slice(0, 400).forEach(s => {
        const r = this.el('div', 'es-som' + (s === atual ? ' sel' : ''));
        r.appendChild(this.botao('▶', () => FF.Audio.play(s), 'Ouvir'));
        const n = this.el('span'); n.textContent = s; r.appendChild(n);
        r.appendChild(this.botao('Usar', () => { aoEscolher(s); m.fechar(); }, null, 'es-bt-ouro'));
        lista.appendChild(r);
      });
    };
    busca.oninput = render;
    c.append(busca, lista);
    const m = this.modal('🎧 Sons e vozes (' + this.sons().length + ')', c, { larga: true });
    render();
    setTimeout(() => busca.focus(), 30);
  },

  // todas as animações de efeitos (fx + fx_extra + sprites importados marcados como efeito)
  efeitos() {
    const l = [];
    ['fx', 'fx_extra'].forEach(id => { const s = FF.Assets.sprites[id]; if (s) Object.keys(s.def.anims).forEach(a => l.push(a)); });
    return [...new Set(l)];
  },

  // desenha um quadro centralizado num canvas (miniaturas)
  miniatura(cv, set, anim, quadro, opts = {}) {
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const a = set && set.anim(anim);
    if (!a || !a.frames.length) return;
    const f = a.frames[Math.max(0, Math.min(a.frames.length - 1, quadro || 0))];
    let maxW = 1, maxH = 1;
    a.frames.forEach(q => { maxW = Math.max(maxW, q[3]); maxH = Math.max(maxH, q[4]); });
    const s = Math.min((cv.width - 4) / maxW, (cv.height - 4) / maxH, opts.max || 4);
    const [ai, sx, sy, w, h] = f;
    ctx.drawImage(set.images[ai], sx, sy, w, h, (cv.width - w * s) / 2, (cv.height - h * s) / 2, w * s, h * s);
  },

  // copia profunda
  copia(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); },
  idSeguro(txt) { return (txt || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 28) || 'item'; },
};

// Histórico de desfazer/refazer baseado em fotografias (JSON) do documento da aba.
FF.Estudio.Historico = class {
  constructor(obter, aplicar, max = 120) { this.obter = obter; this.aplicar = aplicar; this.max = max; this.pilha = []; this.i = -1; }
  zerar(rotulo) { this.pilha = [{ s: JSON.stringify(this.obter()), r: rotulo || '' }]; this.i = 0; FF.Estudio.renderHist(); }
  // chame DEPOIS de cada mudança; "juntar" agrupa mudanças seguidas iguais (ex.: arrastar)
  marcar(rotulo, juntar) {
    const s = JSON.stringify(this.obter());
    if (this.i >= 0 && this.pilha[this.i].s === s) return;
    this.pilha = this.pilha.slice(0, this.i + 1);
    if (juntar && this.i > 0 && this.pilha[this.i].r === rotulo && this.pilha[this.i].juntar && Date.now() - this.pilha[this.i].t < 1500) this.pilha[this.i] = { s, r: rotulo, juntar, t: Date.now() };
    else this.pilha.push({ s, r: rotulo || '', juntar: !!juntar, t: Date.now() });
    if (this.pilha.length > this.max) this.pilha.shift();
    this.i = this.pilha.length - 1;
    FF.Estudio.renderHist();
  }
  podeDesfazer() { return this.i > 0; }
  podeRefazer() { return this.i < this.pilha.length - 1; }
  rotuloAtual() { return this.pilha[this.i] && this.pilha[this.i].r; }
  rotuloRefazer() { return this.pilha[this.i + 1] && this.pilha[this.i + 1].r; }
  desfazer() { if (!this.podeDesfazer()) return false; this.i--; this.aplicar(JSON.parse(this.pilha[this.i].s)); return true; }
  refazer() { if (!this.podeRefazer()) return false; this.i++; this.aplicar(JSON.parse(this.pilha[this.i].s)); return true; }
};
