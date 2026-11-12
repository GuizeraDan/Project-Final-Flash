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

  // listas para as ferramentas e a Batalha Livre (inclui o que foi criado no Estúdio)
  listaSprites() {
    const l = ((window.FF_BUNDLE && FF_BUNDLE._indice) || {}).sprites || [];
    const novos = FF.Edicoes ? Object.keys(FF.Edicoes.dados().spritesNovos || {}) : [];
    return [...new Set(l.concat(novos))];
  },
  listaPersonagens() {
    const l = ((window.FF_BUNDLE && FF_BUNDLE._indice) || {}).personagens || [];
    const novos = FF.Edicoes ? FF.Edicoes.personagensNovos() : [];
    return [...new Set(l.concat(novos))];
  },

  async loadSprite(id) {
    if (this.sprites[id]) return this.sprites[id];
    const novo = FF.Edicoes && (FF.Edicoes.dados().spritesNovos || {})[id];
    // cópia: as edições do usuário são aplicadas por cima e o original do JSON fica intacto
    const def = JSON.parse(JSON.stringify(novo || await this.loadJSON('data/sprites/' + id + '.json')));
    const info = FF.Edicoes && (FF.Edicoes.dados().spritesInfo || {})[id];
    if (info && info.escala) { def._escalaOrig = def.escala; def.escala = info.escala; }
    // imagens importadas (assets/img/usr/): usa a cópia do aparelho enquanto existir
    const caminhos = await Promise.all(def.atlases.map(p => (FF.ImagensUsr && /assets\/img\/usr\//.test(p)) ? FF.ImagensUsr.url(p).catch(() => p) : p));
    const imgs = await Promise.all(caminhos.map(p => this.loadImage(p)));
    const set = new FF.SpriteSet(def, imgs);
    if (FF.Mods) FF.Mods.aplicar(id, set);          // quadros editados pelo usuário (✂ no visualizador / Estúdio)
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
    return FF.Edicoes ? FF.Edicoes.aplicarGolpes(def) : def;         // golpes alterados no Editor/Estúdio
  },
};
