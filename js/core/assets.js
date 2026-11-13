// Carregamento de dados (JSON), imagens e sprites.
// Se data/bundle.js estiver presente (gerado por tools/build_bundle.py), os JSON
// vêm dele — isso permite abrir o index.html direto do disco (file://).
window.FF = window.FF || {};

FF.Assets = {
  json: {},
  images: {},
  sprites: {},

  async loadJSON(path) {
    if (this.json[path]) return this.json[path];
    let data;
    if (window.FF_BUNDLE && window.FF_BUNDLE[path]) {
      data = window.FF_BUNDLE[path];
    } else {
      const r = await fetch(path);
      if (!r.ok) throw new Error('Falha ao carregar ' + path);
      data = await r.json();
    }
    this.json[path] = data;
    return data;
  },

  loadImage(path) {
    if (this.images[path]) return Promise.resolve(this.images[path]);
    return new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => { this.images[path] = img; ok(img); };
      img.onerror = () => fail(new Error('Falha ao carregar ' + path));
      img.src = path;
    });
  },

  // listas para as ferramentas e a Batalha Livre (inclui o que foi criado no Estúdio e o acervo do ZL3)
  listaSprites() {
    const l = ((window.FF_BUNDLE && FF_BUNDLE._indice) || {}).sprites || [];
    const novos = FF.Edicoes ? Object.keys(FF.Edicoes.dados().spritesNovos || {}) : [];
    return [...new Set(l.concat(novos, Object.keys(this.acervo())))];
  },

  // ---- acervo do Z Legends 3 (tools/extrair_acervo.py): data/acervo/<id>.js, fora do bundle,
  // carregado só quando alguém usa o sprite. Índice (só no Estúdio): data/acervo/indice.js → window.FF_ACERVO_INDICE.acervo = {id: [categoria, nome, nº anims, tipo, fonte]}
  acervo() { return (window.FF_ACERVO_INDICE || {}).acervo || {}; },
  categoriasAcervo() { return (window.FF_ACERVO_INDICE || {}).categorias || {}; },
  doAcervo(id) { return !!this.acervo()[id]; },
  // 'personagens' | 'efeitos' | 'cenarios' | 'interface' | 'cutscenes' para o acervo; 'jogo' para os do projeto
  categoriaSprite(id) { const a = this.acervo()[id]; return a ? a[0] : 'jogo'; },
  nomeSprite(id) { const a = this.acervo()[id]; return a ? a[1] : id; },
  // tipo do conteúdo (vale para todas as fontes): 'personagens' | 'efeitos' | 'cenarios' | 'interface' | 'cutscenes'; 'jogo' fora do acervo
  tipoSprite(id) {
    const fav = FF.Favoritos && FF.Favoritos.de(id);   // o usuário disse o que é (⭐ no Estúdio)
    if (fav && this.doAcervo(id)) return fav === 'explosoes' ? 'efeitos' : fav;
    const a = this.acervo()[id]; return a ? (a[3] || a[0]) : 'jogo';
  },
  fonteSprite(id) { const a = this.acervo()[id]; return a ? (a[4] || '') : ''; },
  // nomes das animações de todo o acervo (para buscar sem baixar as imagens) — só o Estúdio usa
  animsAcervo() {
    if (window.FF_ACERVO_ANIMS) return Promise.resolve(window.FF_ACERVO_ANIMS);
    if (!this._pAnims) this._pAnims = this.script('data/acervo/indice_anims.js').then(() => window.FF_ACERVO_ANIMS || {}, () => { this._pAnims = null; return {}; });
    return this._pAnims;
  },
  // <script> em vez de fetch: funciona também abrindo o jogo direto do disco (file://)
  script(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => { s.remove(); ok(); };
      s.onerror = () => { s.remove(); fail(new Error('Falha ao carregar ' + src)); };
      document.head.appendChild(s);
    });
  },
  _acervoDefs: {},
  _acervoEsperando: {},
  defAcervo(id) {
    const path = 'data/sprites/' + id + '.json';
    if (this.json[path]) return Promise.resolve(this.json[path]);
    if (!this._acervoEsperando[id]) {
      this._acervoEsperando[id] = this.script('data/acervo/' + id + '.js').then(() => {
        const d = this._acervoDefs[id];
        if (!d) throw new Error('Sprite do acervo vazio: ' + id);
        delete this._acervoDefs[id];
        return (this.json[path] = d);
      }).catch(e => { delete this._acervoEsperando[id]; throw e; });
    }
    return this._acervoEsperando[id];
  },
  listaPersonagens() {
    const l = ((window.FF_BUNDLE && FF_BUNDLE._indice) || {}).personagens || [];
    const novos = FF.Edicoes ? FF.Edicoes.personagensNovos() : [];
    return [...new Set(l.concat(novos))];
  },

  // pedidos ao mesmo tempo do mesmo sprite recebem o mesmo carregamento (não baixa duas vezes)
  _carregando: {},
  loadSprite(id) {
    if (this.sprites[id]) return Promise.resolve(this.sprites[id]);
    if (!this._carregando[id]) {
      this._carregando[id] = this._loadSprite(id).finally(() => { delete this._carregando[id]; });
    }
    return this._carregando[id];
  },
  async _loadSprite(id) {
    const novo = FF.Edicoes && (FF.Edicoes.dados().spritesNovos || {})[id];
    // cópia: as edições do usuário são aplicadas por cima e o original do JSON fica intacto
    // fora do bundle = acervo (o jogo não carrega o índice do acervo: tenta direto data/acervo/<id>.js)
    const noBundle = !!(window.FF_BUNDLE && FF_BUNDLE['data/sprites/' + id + '.json']);
    let fonte = novo;
    if (!fonte && !noBundle && (this.doAcervo(id) || !window.FF_ACERVO_INDICE)) fonte = await this.defAcervo(id).catch(() => null);
    if (!fonte) fonte = await this.loadJSON('data/sprites/' + id + '.json');
    const def = JSON.parse(JSON.stringify(fonte));
    const info = FF.Edicoes && (FF.Edicoes.dados().spritesInfo || {})[id];
    if (info && info.escala) { def._escalaOrig = def.escala; def.escala = info.escala; }
    // imagens extras (quadros trazidos do computador para um sprite do jogo, no Estúdio)
    if (info && Array.isArray(info.atlas) && info.atlas.length) { def._atlasBase = def.atlases.length; def.atlases = def.atlases.concat(info.atlas); }
    // imagens importadas (assets/img/usr/): usa a cópia do aparelho enquanto existir
    const caminhos = await Promise.all(def.atlases.map(p => (FF.ImagensUsr && /assets\/img\/usr\//.test(p)) ? FF.ImagensUsr.url(p).catch(() => p) : p));
    const imgs = await Promise.all(caminhos.map(p => this.loadImage(p)));
    const set = new FF.SpriteSet(def, imgs);
    if (FF.Mods) FF.Mods.aplicar(id, set);          // quadros editados pelo usuário (aba Sprites do Estúdio)
    this.sprites[id] = set;
    return set;
  },
  // esquece o sprite carregado (o Estúdio recarrega depois de mudar algo)
  descarregarSprite(id) { delete this.sprites[id]; },

  async loadCharacter(id) {
    let def = null;
    const ed = FF.Edicoes && (FF.Edicoes.dados().personagens || {})[id];
    if (!(ed && ed.novo)) def = JSON.parse(JSON.stringify(await this.loadJSON('data/characters/' + id + '.json')));
    if (FF.Edicoes) def = FF.Edicoes.aplicarPersonagem(id, def);     // atributos/formas/buffs/IA do Estúdio
    return FF.Edicoes ? FF.Edicoes.aplicarGolpes(def) : def;         // golpes alterados no Estúdio
  },
};

// chamado por cada data/acervo/<id>.js ao carregar
window.FF_ACERVO_DEF = function (id, def) { FF.Assets._acervoDefs[id] = def; };
