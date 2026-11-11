// Biblioteca de sprites importados pelo usuário (fica no navegador, em IndexedDB).
// Cada pacote vira um sprite igual aos do jogo: atlas (imagens) + animações no mesmo formato
// de quadro [atlas, x, y, w, h, ox, oy, dur, pontos?], com "escala" própria (tamanho na tela).
// Os ids começam com "bib:" e são carregados por FF.Assets.loadSprite como qualquer outro sprite.
window.FF = window.FF || {};

FF.Biblioteca = {
  DB: 'finalflash', STORE: 'pacotes',
  _db: null,

  abrir() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((ok, fail) => {
      if (!window.indexedDB) return fail(new Error('Este navegador não guarda arquivos (IndexedDB indisponível).'));
      const r = indexedDB.open(this.DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(this.STORE, { keyPath: 'id' });
      r.onsuccess = () => { this._db = r.result; ok(this._db); };
      r.onerror = () => fail(r.error);
    });
  },

  async _tx(modo, fn) {
    const db = await this.abrir();
    return new Promise((ok, fail) => {
      const t = db.transaction(this.STORE, modo);
      const st = t.objectStore(this.STORE);
      const req = fn(st);
      t.oncomplete = () => ok(req && req.result);
      t.onerror = () => fail(t.error);
    });
  },

  listar() { return this._tx('readonly', st => st.getAll()).then(l => l || []).catch(() => []); },
  obter(id) { return this._tx('readonly', st => st.get(id)); },
  salvar(pacote) { return this._tx('readwrite', st => st.put(pacote)); },
  apagar(id) { delete FF.Assets.sprites[id]; return this._tx('readwrite', st => st.delete(id)); },

  // carrega um pacote como SpriteSet (usado por FF.Assets.loadSprite para ids "bib:")
  async carregarSprite(id) {
    const p = await this.obter(id);
    if (!p) throw new Error('Pacote não encontrado na biblioteca: ' + id);
    const imgs = await Promise.all(p.atlases.map(blob => new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => fail(new Error('Imagem do pacote corrompida: ' + id));
      img.src = URL.createObjectURL(blob);
    })));
    const def = Object.assign({ id, atlases: [] }, p.def);
    return new FF.SpriteSet(def, imgs);
  },

  // carrega todos os pacotes (para usar como efeitos nas batalhas/editor)
  async carregarTodos() {
    const lista = await this.listar();
    await Promise.all(lista.map(p => FF.Assets.loadSprite(p.id).catch(() => null)));
    return lista.map(p => p.id);
  },

  // empacota quadros (canvas) num atlas e devolve {atlases: [Blob], posicoes: [[ai,x,y]]}
  async empacotar(canvases) {
    const MAX = 2048, PAD = 1;
    const ordem = canvases.map((c, i) => i).sort((a, b) => canvases[b].height - canvases[a].height);
    const pos = [], atlases = [];
    let cur = null;
    for (const i of ordem) {
      const c = canvases[i];
      if (c.width + PAD > MAX || c.height + PAD > MAX) throw new Error('Quadro maior que 2048 px: reduza a imagem.');
      if (cur && cur.x + c.width + PAD > MAX) { cur.y += cur.shelf; cur.x = 0; cur.shelf = 0; }
      if (!cur || cur.y + c.height + PAD > MAX) { cur = { x: 0, y: 0, shelf: 0, w: 0, h: 0, itens: [] }; atlases.push(cur); }
      pos[i] = [atlases.length - 1, cur.x, cur.y];
      cur.itens.push([c, cur.x, cur.y]);
      cur.x += c.width + PAD;
      cur.shelf = Math.max(cur.shelf, c.height + PAD);
      cur.w = Math.max(cur.w, cur.x); cur.h = Math.max(cur.h, cur.y + cur.shelf);
    }
    const blobs = await Promise.all(atlases.map(a => {
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, a.w); cv.height = Math.max(1, a.h);
      const g = cv.getContext('2d');
      a.itens.forEach(([c, x, y]) => g.drawImage(c, x, y));
      return new Promise(ok => cv.toBlob(ok, 'image/png'));
    }));
    return { atlases: blobs, posicoes: pos };
  },

  // exporta um pacote como arquivo .json (com as imagens embutidas) para compartilhar ou mandar ao Claude
  async exportar(id) {
    const p = await this.obter(id);
    const urls = await Promise.all(p.atlases.map(b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); })));
    return JSON.stringify({ formato: 'finalflash-pacote-1', id: p.id, nome: p.nome, def: p.def, atlases: urls });
  },

  async importarArquivo(texto) {
    const j = JSON.parse(texto);
    if (j.formato !== 'finalflash-pacote-1') throw new Error('Arquivo não é um pacote do Final Flash.');
    const blobs = await Promise.all(j.atlases.map(u => fetch(u).then(r => r.blob())));
    const pacote = { id: j.id.startsWith('bib:') ? j.id : 'bib:' + j.id, nome: j.nome, def: j.def, atlases: blobs, criado: Date.now() };
    await this.salvar(pacote);
    delete FF.Assets.sprites[pacote.id];
    return pacote.id;
  },
};
