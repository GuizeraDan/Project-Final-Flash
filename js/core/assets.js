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

  async loadSprite(id) {
    if (this.sprites[id]) return this.sprites[id];
    if (id.startsWith('bib:') && FF.Biblioteca) {     // sprite importado pelo usuário (biblioteca do navegador)
      const set = await FF.Biblioteca.carregarSprite(id);
      if (FF.Mods) FF.Mods.aplicar(id, set);
      this.sprites[id] = set;
      return set;
    }
    const def = await this.loadJSON('data/sprites/' + id + '.json');
    const imgs = await Promise.all(def.atlases.map(p => this.loadImage(p)));
    const set = new FF.SpriteSet(def, imgs);
    if (FF.Mods) FF.Mods.aplicar(id, set);          // quadros editados pelo usuário (✂ no visualizador)
    this.sprites[id] = set;
    return set;
  },

  async loadCharacter(id) {
    return this.loadJSON('data/characters/' + id + '.json');
  },
};
