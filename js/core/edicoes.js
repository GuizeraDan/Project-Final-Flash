// Edições do usuário que valem no jogo todo e em todos os aparelhos.
// - Fonte: data/edicoes.js (window.FF_EDICOES), publicado com o site.
// - O Estúdio grava nesse arquivo direto no repositório do GitHub (precisa de uma chave de acesso,
//   configurada uma vez por aparelho em "☁ Sincronizar"). O GitHub Pages republica e os outros
//   aparelhos recebem ao recarregar.
// - Sem chave (ou sem internet), a edição fica "pendente" neste aparelho e já vale aqui;
//   é enviada quando conectar.
// Seções: golpes[personagem][golpe] (substitui o golpe original; null = voltar ao original),
//         habilidades[id], sprites[sprite][animação],
//         personagens[id]   (Estúdio: campos que substituem os do JSON — nome, atributos, formas, buffs, ia,
//                            vozes, formaInicial; ou {"novo": true, "def": {...}} para um personagem criado),
//         favoritos["sprite" | "sprite#animação"] = "efeitos"|"personagens"|"cenarios"|"interface"  (Estúdio: ⭐ do usuário),
//         ko[id|"padrao"]   (Estúdio: cena de KO — linha do tempo tocada quando o personagem é derrotado; js/battle/ko.js),
//         spritesNovos[id]  (Estúdio: definição de sprite importado; atlas em assets/img/usr/<id>.png),
//         spritesInfo[id]   (Estúdio: {"escala": N} escala geral de um sprite/efeito;
//                            "atlas": [caminhos] imagens extras somadas aos atlas do sprite do jogo —
//                            quadros trazidos do computador ou redimensionados; os quadros apontam o índice).
// Imagens importadas: enviadas pela API (contents) para assets/img/usr/; enquanto não vão, ficam no
// IndexedDB do aparelho (FF.ImagensUsr) e são usadas de lá.
window.FF = window.FF || {};

FF.Edicoes = {
  REPO: 'GuizeraDan/Project-Final-Flash',
  ARQ: 'data/edicoes.js',
  PEND: 'ff_edicoes_pendentes',
  TOKEN: 'ff_github_token',

  ULT: 'ff_edicoes_ultimo',
  SECOES: ['golpes', 'habilidades', 'sprites', 'personagens', 'spritesNovos', 'spritesInfo', 'ko', 'favoritos'],
  // publicado no site, ou a versão que este aparelho acabou de enviar (o site leva ~1 min para publicar):
  // vale a de "rev" mais nova
  base() {
    let e = window.FF_EDICOES || {};
    try {
      const u = JSON.parse(localStorage.getItem(this.ULT) || 'null');
      if (u && (u.rev || 0) > (e.rev || 0)) e = u;
      else if (u) localStorage.removeItem(this.ULT);     // o site já tem esta (ou uma mais nova)
    } catch (x) { /* sem armazenamento */ }
    const o = {};
    this.SECOES.forEach(k => { o[k] = e[k] || {}; });
    return o;
  },
  pendentes() { try { return JSON.parse(localStorage.getItem(this.PEND) || '[]'); } catch (e) { return []; } },
  gravarPendentes(l) { try { localStorage.setItem(this.PEND, JSON.stringify(l)); } catch (e) { /* sem armazenamento */ } },

  // aplica uma lista de mudanças [{c: [seção, a, b], v}] sobre um objeto de edições
  aplicarLista(obj, lista) {
    for (const m of lista) {
      let o = obj;
      for (let k = 0; k < m.c.length - 1; k++) o = (o[m.c[k]] = o[m.c[k]] || {});
      const ult = m.c[m.c.length - 1];
      if (m.v === null || m.v === undefined) delete o[ult]; else o[ult] = JSON.parse(JSON.stringify(m.v));
    }
    // limpa grupos vazios
    for (const s of ['golpes', 'sprites']) for (const k of Object.keys(obj[s] || {})) if (obj[s][k] && typeof obj[s][k] === 'object' && !Object.keys(obj[s][k]).length) delete obj[s][k];
    return obj;
  },

  // estado atual = publicado + pendentes deste aparelho
  dados() {
    if (!this._cache) this._cache = this.aplicarLista(JSON.parse(JSON.stringify(this.base())), this.pendentes());
    return this._cache;
  },

  // registra uma mudança (vale na hora aqui) e tenta enviar ao GitHub
  set(caminho, valor) {
    const chave = JSON.stringify(caminho);
    const l = this.pendentes().filter(m => JSON.stringify(m.c) !== chave);   // mesma coisa salva de novo: fica só a última
    l.push({ c: caminho, v: valor === undefined ? null : valor, t: Date.now() });
    this.gravarPendentes(l);
    this._cache = null;
    this.avisar();
    return this.enviar();
  },

  // como set, mas espera um pouco antes de enviar (cliques seguidos, ex.: favoritar vários sprites, viram um commit só)
  setDepois(caminho, valor, ms = 4000) {
    const chave = JSON.stringify(caminho);
    const l = this.pendentes().filter(m => JSON.stringify(m.c) !== chave);
    l.push({ c: caminho, v: valor === undefined ? null : valor, t: Date.now() });
    this.gravarPendentes(l);
    this._cache = null;
    this.avisar();
    clearTimeout(this._depois);
    this._depois = setTimeout(() => this.enviar(), ms);
  },

  // ---------- GitHub ----------
  token() { try { return localStorage.getItem(this.TOKEN) || ''; } catch (e) { return ''; } },
  conectado() { return !!this.token(); },
  async api(caminho, opts = {}) {
    const r = await fetch('https://api.github.com/repos/' + this.REPO + caminho, Object.assign({}, opts, {
      headers: Object.assign({ Authorization: 'Bearer ' + this.token(), Accept: 'application/vnd.github+json' }, opts.headers || {}),
      cache: 'no-store',
    }));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.message || ('GitHub respondeu ' + r.status)); e.status = r.status; throw e; }
    return j;
  },
  async conectar(token) {
    const ant = this.token();
    try { localStorage.setItem(this.TOKEN, token.trim()); } catch (e) { throw new Error('Este navegador não deixa guardar a chave.'); }
    try {
      const r = await this.api('');
      if (!r.permissions || !r.permissions.push) throw new Error('A chave não tem permissão de escrita (Contents: Read and write) neste repositório.');
    } catch (e) {
      try { if (ant) localStorage.setItem(this.TOKEN, ant); else localStorage.removeItem(this.TOKEN); } catch (x) { /* nada */ }
      throw e.status === 401 ? new Error('Chave inválida ou expirada.') : e.status === 404 ? new Error('A chave não tem acesso ao repositório ' + this.REPO + '.') : e;
    }
    await this.enviar();
  },
  desconectar() { try { localStorage.removeItem(this.TOKEN); } catch (e) { /* nada */ } this.avisar(); },

  b64(txt) { return btoa(unescape(encodeURIComponent(txt))); },
  de64(b) { return decodeURIComponent(escape(atob(b.replace(/\s/g, '')))); },
  ler(txt) { const i = txt.indexOf('{'), f = txt.lastIndexOf('}'); return JSON.parse(txt.slice(i, f + 1)); },
  escrever(obj) {
    return '// Edições feitas no Estúdio (golpes, habilidades, sprites, personagens).\n' +
      '// Arquivo gravado pelo próprio Estúdio via GitHub (botão ☁). Não edite à mão sem necessidade.\n' +
      'window.FF_EDICOES = ' + JSON.stringify(obj) + ';\n';
  },

  // lê a versão mais nova do arquivo no GitHub, junta as pendentes e grava (um commit)
  async enviar() {
    const l = this.pendentes();
    if (!this.conectado() || this._enviando) return { pendentes: l.length };
    if (!l.length) {   // só imagens pendentes
      if (FF.ImagensUsr && (await FF.ImagensUsr.pendentes()).length) {
        try { await FF.ImagensUsr.enviarPendentes(); this.estado = 'ok'; } catch (e) { this.estado = 'erro'; this.erro = e.message; }
        this.avisar();
      }
      return { pendentes: 0 };
    }
    this._enviando = true;
    this.estado = 'enviando'; this.avisar();
    try {
      // imagens importadas primeiro (o arquivo de edições aponta para elas)
      if (FF.ImagensUsr) await FF.ImagensUsr.enviarPendentes();
      for (let tent = 0; tent < 3; tent++) {
        const atual = await this.api('/contents/' + this.ARQ + '?ref=main').catch(e => { if (e.status === 404) return null; throw e; });
        const obj = atual ? this.ler(this.de64(atual.content)) : { versao: 1 };
        this.SECOES.forEach(k => { obj[k] = obj[k] || {}; });
        this.aplicarLista(obj, l);
        obj.rev = Math.max(Date.now(), (obj.rev || 0) + 1);
        const corpo = {
          message: 'Estúdio: ' + l.length + ' alteração(ões) feitas no jogo',
          content: this.b64(this.escrever(obj)), branch: 'main',
          committer: { name: 'GuizeraDan', email: 'GuizeraDan@users.noreply.github.com' },
          author: { name: 'GuizeraDan', email: 'GuizeraDan@users.noreply.github.com' },
        };
        if (atual) corpo.sha = atual.sha;
        try {
          await this.api('/contents/' + this.ARQ, { method: 'PUT', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } });
        } catch (e) { if (e.status === 409 && tent < 2) continue; throw e; }   // outro aparelho gravou junto: tenta de novo
        // sucesso: o publicado passa a ser o novo; tira só as pendentes enviadas
        window.FF_EDICOES = obj;
        try { localStorage.setItem(this.ULT, JSON.stringify(obj)); } catch (x) { /* sem armazenamento */ }
        const resto = this.pendentes().slice(l.length);
        this.gravarPendentes(resto);
        this._cache = null;
        this.estado = 'ok'; this.erro = null; this.ultimoEnvio = Date.now();
        return { enviado: l.length, pendentes: resto.length };
      }
    } catch (e) {
      this.estado = 'erro'; this.erro = e.message;
      return { erro: e.message, pendentes: l.length };
    } finally {
      this._enviando = false;
      this.avisar();
    }
  },

  // texto curto para a interface
  resumo() {
    const n = this.pendentes().length;
    if (!this.conectado()) return n ? '📱 ' + n + ' alteração(ões) só neste aparelho · conecte o GitHub para valer em todos' : '📱 Salvando só neste aparelho · conecte o GitHub para valer em todos';
    if (this.estado === 'enviando') return '☁ Enviando para o GitHub…';
    if (this.estado === 'erro') return '⚠ Não enviou (' + this.erro + ')' + (n ? ' · ' + n + ' pendente(s), tento de novo ao salvar' : '');
    if (n) return '☁ ' + n + ' alteração(ões) esperando envio';
    return this.ultimoEnvio ? '☁ Enviado! Em ~1 min vale em todos os aparelhos (recarregar)' : '☁ Conectado ao GitHub · salva para todos os aparelhos';
  },
  ouvintes: [],
  avisar() { this.ouvintes.forEach(f => { try { f(); } catch (e) { /* nada */ } }); },

  // grava um arquivo binário (base64) no repositório pela API de contents
  async gravarArquivo(caminho, base64, mensagem) {
    const atual = await this.api('/contents/' + caminho + '?ref=main').catch(e => { if (e.status === 404) return null; throw e; });
    const corpo = { message: mensagem || ('Estúdio: ' + caminho), content: base64, branch: 'main',
      committer: { name: 'GuizeraDan', email: 'GuizeraDan@users.noreply.github.com' },
      author: { name: 'GuizeraDan', email: 'GuizeraDan@users.noreply.github.com' } };
    if (atual && atual.sha) corpo.sha = atual.sha;
    return this.api('/contents/' + caminho, { method: 'PUT', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } });
  },

  // ---------- personagens (Estúdio) ----------
  // aplica as mudanças do Estúdio num personagem do JSON (cópia) ou devolve o personagem novo
  aplicarPersonagem(id, def) {
    const ed = (this.dados().personagens || {})[id];
    if (!ed) return def;
    if (ed.novo) return JSON.parse(JSON.stringify(ed.def));
    const d = Object.assign({}, def);
    for (const [k, v] of Object.entries(ed)) if (k !== 'golpes' && k !== 'id') d[k] = JSON.parse(JSON.stringify(v));
    return d;
  },
  personagensNovos() { return Object.entries(this.dados().personagens || {}).filter(([, v]) => v && v.novo).map(([k]) => k); },

  // ---------- golpes alterados ----------
  aplicarGolpes(def) {
    if (!def || !def.golpes || !def.id) return def;
    const ed = this.dados().golpes[def.id] || {};
    def._golpesOrig = def._golpesOrig || {};
    // volta ao original o que deixou de estar alterado
    for (const k of Object.keys(def._golpesOrig)) if (!ed[k]) { def.golpes[k] = def._golpesOrig[k]; delete def._golpesOrig[k]; }
    for (const [k, g] of Object.entries(ed)) {
      if (!(k in def._golpesOrig)) def._golpesOrig[k] = def.golpes[k];
      const novo = JSON.parse(JSON.stringify(g));
      // regras que o Estúdio não mostra (quando o golpe aparece/precisa de algo): vêm do original
      const orig = def._golpesOrig[k] || {};
      for (const meta of ['mostrar', 'esconder', 'requer', 'supremo']) if (orig[meta] !== undefined && novo[meta] === undefined) novo[meta] = orig[meta];
      def.golpes[k] = novo;
    }
    return def;
  },
  golpeAlterado(personagem, id) { return !!(this.dados().golpes[personagem] || {})[id]; },

  // traz para cá o que ficou salvo só no navegador nas versões anteriores (uma vez)
  migrar() {
    try {
      if (localStorage.getItem('ff_edicoes_migrado')) return;
      const habs = JSON.parse(localStorage.getItem('ff_habilidades') || '{}');
      const mods = JSON.parse(localStorage.getItem('ff_sprite_mods') || '{}');
      const l = this.pendentes();
      Object.entries(habs).forEach(([id, h]) => l.push({ c: ['habilidades', id], v: h, t: Date.now() }));
      Object.entries(mods).forEach(([s, m]) => Object.entries(m).forEach(([a, v]) => l.push({ c: ['sprites', s, a], v, t: Date.now() })));
      this.gravarPendentes(l);
      localStorage.setItem('ff_edicoes_migrado', '1');
      this._cache = null;
    } catch (e) { /* sem armazenamento */ }
  },
};
FF.Edicoes.migrar();
