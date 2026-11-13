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
    FF.Audio.prepararLocais();
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
  // nome de exibição / sprite excluído das listas (spritesInfo[id].nome / .oculto), mantendo escala e atlas extras
  mudarInfoSprite(id, patch) {
    const v = Object.assign({}, FF.Assets.infoSprite(id), patch);
    Object.keys(v).forEach(k => { if (v[k] == null || v[k] === '' || v[k] === false) delete v[k]; });
    FF.Edicoes.setDepois(['spritesInfo', id], Object.keys(v).length ? v : null);
  },
  renomearAnim(id, anim, nome) {
    const m = Object.assign({}, FF.Assets.infoSprite(id).nomesAnims || {});
    nome = (nome || '').trim();
    if (nome && nome !== anim) m[anim] = nome; else delete m[anim];
    this.mudarInfoSprite(id, { nomesAnims: Object.keys(m).length ? m : null });
  },
  // troca um texto por uma caixa de edição (Enter/clicar fora salva, Esc cancela)
  editarNoLugar(el, valor, salvar) {
    const inp = document.createElement('input'); inp.value = valor; inp.className = 'es-som-renomear';
    const pai = el.parentNode; el.replaceWith(inp); inp.focus(); inp.select();
    ['click', 'pointerdown', 'dblclick'].forEach(t => inp.addEventListener(t, (e) => e.stopPropagation()));
    let feito = false;
    const fim = (ok) => { if (feito) return; feito = true; if (ok) { salvar(inp.value); el.textContent = inp.value.trim() || el.textContent; } if (inp.parentNode === pai) inp.replaceWith(el); };
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') fim(true); if (e.key === 'Escape') fim(false); };
    inp.onblur = () => fim(true);
  },
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
  // acervo de sons dos outros jogos (data/acervo/sons.js): [id, nome original, duração, categoria, fonte]
  sonsAcervo() { return (window.FF_ACERVO_SONS && FF_ACERVO_SONS.sons) || []; },
  CAT_SOM: { explosao: '💥', golpe: '👊', ki: '⚡', aura: '✨', voz: '🗣', movimento: '💨', musica: '🎵', interface: '🖥', outros: '🔊' },
  // seletor de sons: Z Legends 3 (o jogo), ⭐ favoritos por categoria, acervo por jogo; filtro por categoria e busca
  escolherSom(atual, aoEscolher, vozes) {
    const FS = FF.FavSons;
    const SU = FF.SonsUsr;
    const NOMES = Object.assign({ zl3: 'Z Legends 3 (do jogo)', usr: '📥 Meus sons (importados)' }, (window.FF_ACERVO_SONS && FF_ACERVO_SONS.fontes) || {});
    let todosTudo, todos, porId, jogo, ac, meus;
    const carregarListas = () => {
      jogo = this.sons().map(n => ({ id: n, nome: n, dur: null, cat: null, fonte: 'zl3' }));
      ac = this.sonsAcervo().map(([id, nome, dur, cat, fonte]) => ({ id, nome, dur, cat, fonte }));
      meus = SU ? SU.importados().map(v => ({ id: v.id, nome: v.nome, dur: v.dur, cat: null, fonte: 'usr' })) : [];
      todosTudo = meus.concat(jogo, ac);
      porId = {}; todosTudo.forEach(x => (porId[x.id] = x));
      todos = todosTudo.filter(x => !(SU && SU.apagado(x.id)));   // excluídos só aparecem na Lixeira
    };
    carregarListas();
    const nomeDe = (x) => (SU && SU.nome(x.id)) || x.nome;
    let fonte = vozes ? 'zl3' : (this.rascunho.ler('som_fonte') || (atual && porId[atual] ? porId[atual].fonte : 'zl3'));
    let cat = '';
    const c = this.el('div', 'es-seletor es-sons');
    const lado = this.el('div', 'es-seletor-fontes');
    const dir = this.el('div', 'es-seletor-dir');
    const topo = this.el('div', 'es-barra');
    const busca = document.createElement('input');
    busca.type = 'search'; busca.placeholder = 'Filtrar (ex.: vgkn, kame, explos, soco, goku)';
    busca.value = vozes || '';
    const info = this.el('span', 'es-dica');
    // 📥 importar som do computador (vai para "Meus sons"; sobe para o GitHub com as edições)
    const arq = document.createElement('input'); arq.type = 'file'; arq.accept = 'audio/*,.ogg,.mp3,.wav,.m4a'; arq.multiple = true; arq.style.display = 'none';
    arq.onchange = async () => {
      let ult = null;
      for (const f of arq.files) { try { ult = await SU.importar(f); } catch (e) { this.aviso(f.name + ': ' + e.message, 'erro'); } }
      arq.value = '';
      if (ult) { this.aviso('📥 Som importado: ' + ult.replace(/^usr\//, '') + (FF.Edicoes.conectado() ? '' : ' (vale neste aparelho; conecte ☁ para ir para os outros)'), 'ok'); carregarListas(); fonte = 'usr'; remontarLado(); render(); }
    };
    const btImp = this.botao('📥 Importar som', () => arq.click(), 'Trazer um som do computador (.mp3, .ogg, .wav, .m4a): entra na lista "Meus sons"', 'es-bt-ouro');
    topo.append(busca, info, btImp, arq);
    const chips = this.el('div', 'es-sons-chips');
    const lista = this.el('div', 'es-sons-lista');
    dir.append(topo, chips, lista);
    c.append(lado, dir);
    const fontesBt = [];
    const bt = (chave, texto, n, pai) => {
      const b = this.el('div', 'es-item es-seletor-fonte' + (chave === fonte ? ' sel' : ''));
      const t = this.el('span'); t.textContent = texto; b.appendChild(t);
      if (n != null) { const sm = this.el('small'); sm.textContent = n; b.appendChild(sm); }
      b.onclick = () => { fonte = chave; this.rascunho.gravar('som_fonte', chave); fontesBt.forEach(([k, el]) => el.classList.toggle('sel', k === fonte)); render(); };
      fontesBt.push([chave, b]);
      (pai || lado).appendChild(b);
    };
    const favBox = this.el('div');
    const montarFav = () => {
      favBox.innerHTML = '';
      if (!FS) return;
      const l = FS.lista();
      favBox.appendChild(this.el('div', 'es-sub', '⭐ Meus favoritos (' + l.length + ')'));
      if (!l.length) favBox.appendChild(this.el('p', 'es-dica', 'Clique na ☆ de um som para favoritar e escolher a categoria.'));
      FS.TIPOS.forEach(([t, ic]) => { const n = l.filter(x => x.tipo === t).length; if (n) bt('fav:' + t, ic + ' ' + FS.plural[t], n, favBox); });
      fontesBt.forEach(([k, el]) => el.classList.toggle('sel', k === fonte));
    };
    const remontarLado = () => {
      lado.innerHTML = ''; fontesBt.length = 0;
      lado.appendChild(this.el('div', 'es-sub', 'Mostrar'));
      bt('tudo', '★ Todos os sons', todos.length);
      bt('usr', NOMES.usr, todos.filter(x => x.fonte === 'usr').length);
      lado.appendChild(favBox); montarFav();
      lado.appendChild(this.el('div', 'es-sub', 'Jogos'));
      bt('zl3', NOMES.zl3, todos.filter(x => x.fonte === 'zl3').length);
      Object.keys(NOMES).filter(k => k !== 'zl3' && k !== 'usr').forEach(k => bt(k, NOMES[k], todos.filter(x => x.fonte === k).length));
      const nLix = todosTudo.length - todos.length;
      if (nLix) { lado.appendChild(this.el('div', 'es-sub', ' ')); bt('lixeira', '🗑 Lixeira (excluídos)', nLix); }
    };
    remontarLado();
    const m = this.modal('🎧 Sons e vozes (' + todos.length + ')', c, { larga: true });
    let tocando = null;
    const ouvir = (id, b) => {
      if (tocando) { tocando.a.pause(); tocando.b.textContent = '▶'; if (tocando.id === id) { tocando = null; return; } }
      const a = FF.Audio.play(id); b.textContent = '■';
      tocando = { a, b, id };
      if (a) a.onended = () => { b.textContent = '▶'; if (tocando && tocando.a === a) tocando = null; };
    };
    const fecharOrig = m.fechar; m.fechar = function () { if (tocando) tocando.a.pause(); return fecharOrig.apply(this, arguments); };
    const render = () => {
      const f = busca.value.trim().toLowerCase();
      let l;
      const lix = fonte === 'lixeira';
      if (lix) l = todosTudo.filter(x => SU && SU.apagado(x.id));
      else if (f || fonte === 'tudo') l = todos;
      else if (/^fav:/.test(fonte)) l = FS.lista(fonte.slice(4)).map(v => porId[v.sprite] || { id: v.sprite, nome: v.sprite, fonte: '?' }).filter(x => !(SU && SU.apagado(x.id)));
      else l = todos.filter(x => x.fonte === fonte);
      if (f) l = l.filter(x => (x.id + ' ' + x.nome + ' ' + nomeDe(x)).toLowerCase().includes(f));
      // chips das categorias (automáticas pelo nome; o favorito vale mais)
      const catDe = (x) => (FS && FS.de(x.id)) || x.cat || null;
      const conta = {}; l.forEach(x => { const k = catDe(x); if (k) conta[k] = (conta[k] || 0) + 1; });
      chips.innerHTML = '';
      if (Object.keys(conta).length > 1) {
        const ch = (k, txt) => { const b = this.botao(txt, () => { cat = cat === k ? '' : k; render(); }); if (cat === k) b.classList.add('on'); chips.appendChild(b); };
        ch('', 'Todas');
        Object.keys(this.CAT_SOM).filter(k => conta[k]).forEach(k => ch(k, this.CAT_SOM[k] + ' ' + (FS ? FS.plural[k] : k) + ' (' + conta[k] + ')'));
      }
      if (cat) l = l.filter(x => catDe(x) === cat);
      lista.innerHTML = '';
      info.textContent = l.length + ' som(ns)' + (l.length > 400 ? ' · mostrando 400, use o filtro' : '');
      l.slice(0, 400).forEach(x => {
        const r = this.el('div', 'es-som' + (x.id === atual ? ' sel' : ''));
        const play = this.botao('▶', () => ouvir(x.id, play), 'Ouvir (clique de novo para parar)');
        r.appendChild(play);
        const ren = SU && SU.nome(x.id) && SU.nome(x.id) !== x.nome;
        const n = this.el('span', 'es-som-nome'); n.textContent = nomeDe(x); n.title = x.id + (ren ? ' (nome original: ' + x.nome + ')' : ''); n.dataset.id = x.id; r.appendChild(n);
        if (ren) n.classList.add('renomeado');
        const meta = this.el('small', 'es-som-meta');
        const k = catDe(x);
        meta.textContent = (k ? this.CAT_SOM[k] + ' ' : '') + (fonte === 'tudo' || f || /^fav:/.test(fonte) ? (NOMES[x.fonte] || x.fonte) + ' · ' : '') + (x.dur ? x.dur.toFixed(1).replace('.', ',') + ' s' : '');
        r.appendChild(meta);
        if (SU && !lix) {
          r.appendChild(this.botao('✏', () => {
            // renomear no lugar (Enter salva, Esc cancela; vazio = volta ao nome original)
            const inp = document.createElement('input'); inp.value = nomeDe(x); inp.className = 'es-som-renomear';
            n.replaceWith(inp); inp.focus(); inp.select();
            const fim = (salvar) => { if (salvar) SU.renomear(x.id, inp.value === x.nome ? '' : inp.value); render(); };
            inp.onkeydown = (e) => { if (e.key === 'Enter') fim(true); if (e.key === 'Escape') fim(false); };
            inp.onblur = () => fim(true);
          }, 'Renomear (só o nome que aparece aqui; o som continua o mesmo)'));
        }
        if (FS && !lix) r.appendChild(FS.botao(x.id, null, () => { montarFav(); if (/^fav:/.test(fonte) || cat) render(); }));
        if (SU) r.appendChild(lix
          ? this.botao('↺ Restaurar', () => { SU.apagar(x.id, false); carregarListas(); remontarLado(); render(); }, 'Voltar para a lista')
          : this.botao('🗑', () => { SU.apagar(x.id, true); carregarListas(); remontarLado(); render(); this.aviso('🗑 "' + nomeDe(x) + '" foi para a Lixeira (dá para restaurar lá).'); }, 'Excluir da lista (vai para a Lixeira; golpes que já usam continuam tocando)', 'es-bt-perigo'));
        if (!lix) r.appendChild(this.botao('Usar', () => { aoEscolher(x.id); m.fechar(); }, null, 'es-bt-ouro'));
        lista.appendChild(r);
      });
      if (!l.length) lista.innerHTML = '<p class="es-vazio">Nada encontrado.</p>';
    };
    busca.oninput = render;
    render();
    setTimeout(() => busca.focus(), 30);
    return m;
  },

  // todas as animações de efeitos (fx + fx_extra + sprites importados marcados como efeito)
  efeitos() {
    const l = [];
    ['fx', 'fx_extra'].forEach(id => { const s = FF.Assets.sprites[id]; if (s) Object.keys(s.def.anims).forEach(a => l.push(a)); });
    return [...new Set(l)];
  },

  // sprite que tem uma animação de efeito (mesma ordem do motor: sprite pedido, fx, fx_extra, qualquer sprite carregado)
  setDoEfeito(nome, sprite) {
    const S = FF.Assets.sprites;
    if (!nome) return null;
    if (sprite && S[sprite] && S[sprite].has(nome)) return S[sprite];
    for (const id of ['fx', 'fx_extra']) if (S[id] && S[id].has(nome)) return S[id];
    for (const s of Object.values(S)) if (s && s.has && s.has(nome)) return s;
    return null;
  },

  // miniatura ANIMADA ao lado de um campo: fonte() → {set, anim} (ou null = "?" vermelho). Um só laço para todas;
  // as que saem da tela são esquecidas sozinhas.
  _minis: [],
  miniAnim(cv, fonte) {
    cv.width = cv.width || 34; cv.height = cv.height || 34;
    this._minis.push({ cv, fonte, chave: '' });
    if (!this._miniLaco) {
      this._miniLaco = true;
      const laco = (agora) => {
        this._minis = this._minis.filter(m => m.cv.isConnected || !m.vista);
        this._minis.forEach(m => { if (m.cv.isConnected) { m.vista = true; this._desenharMini(m, agora / 1000); } });
        requestAnimationFrame(laco);
      };
      requestAnimationFrame(laco);
    }
    return cv;
  },
  _desenharMini(m, t) {
    const cv = m.cv, ctx = cv.getContext('2d');
    let f = null;
    try { f = m.fonte(); } catch (e) { f = null; }
    if (f === null) { m.chave = ''; return; }   // pausada (ex.: cartão sem o mouse em cima)
    const a = f && f.set && f.anim && f.set.anim(f.anim);
    if (!a || !a.frames.length) {
      if (m.chave === '?') return;
      m.chave = '?';
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (f && f.anim) { ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', cv.width / 2, cv.height / 2); cv.title = '"' + f.anim + '" não existe'; }
      return;
    }
    // quadro atual pelo fps e pela duração de cada quadro (pausa curta no fim das que não repetem)
    const fps = a.fps > 0 ? a.fps : 10, total = a.frames.reduce((s, q) => s + (q[7] || 1), 0);
    let b = (t * fps) % (total + (a.loop ? 0 : fps * 0.4)), k = 0;
    while (k < a.frames.length - 1 && b >= (a.frames[k][7] || 1)) { b -= (a.frames[k][7] || 1); k++; }
    const chave = f.anim + '#' + k;
    if (m.chave === chave) return;
    m.chave = chave;
    cv.title = f.anim + ' (' + a.frames.length + ' quadros)';
    this.miniatura(cv, f.set, f.anim, k, { max: 3 });
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
