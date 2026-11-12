// Imagens importadas pelo usuário no Estúdio (atlas de sprites novos).
// - Guardadas no IndexedDB do aparelho (banco "finalflash_usr", loja "imagens", chave = caminho no repositório,
//   ex.: "assets/img/usr/meu_sprite.png"), com a marca "enviada".
// - Com a chave do GitHub conectada, FF.Edicoes.enviar() grava cada imagem pendente no repositório
//   (API de contents) antes do data/edicoes.js. Os outros aparelhos carregam do site.
// - Enquanto existir a cópia local, o jogo usa ela (o site leva ~1 min para publicar).
window.FF = window.FF || {};

FF.ImagensUsr = {
  _db: null,
  urls: {},
  abrir() {
    if (this._db) return this._db;
    this._db = new Promise((ok, falha) => {
      if (!window.indexedDB) return falha(new Error('sem IndexedDB'));
      let r;
      try { r = indexedDB.open('finalflash_usr', 1); } catch (e) { return falha(e); }
      r.onupgradeneeded = () => r.result.createObjectStore('imagens');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => falha(r.error);
    }).catch(e => { this._db = null; throw e; });
    return this._db;
  },
  async _op(modo, fn) {
    const db = await this.abrir();
    return new Promise((ok, falha) => {
      const tx = db.transaction('imagens', modo);
      const st = tx.objectStore('imagens');
      const r = fn(st);
      tx.oncomplete = () => ok(r && r.result);
      tx.onerror = () => falha(tx.error);
    });
  },
  async gravar(caminho, blob, enviada) {
    if (this.urls[caminho]) { URL.revokeObjectURL(this.urls[caminho]); delete this.urls[caminho]; }
    await this._op('readwrite', st => st.put({ blob, enviada: !!enviada, t: Date.now() }, caminho));
    if (FF.Assets) delete FF.Assets.images[caminho];
  },
  async ler(caminho) { try { return await this._op('readonly', st => st.get(caminho)); } catch (e) { return null; } },
  async todas() {
    try {
      const db = await this.abrir();
      return await new Promise((ok) => {
        const l = [];
        const c = db.transaction('imagens').objectStore('imagens').openCursor();
        c.onsuccess = () => { const k = c.result; if (!k) return ok(l); l.push(Object.assign({ caminho: k.key }, k.value)); k.continue(); };
        c.onerror = () => ok(l);
      });
    } catch (e) { return []; }
  },
  async pendentes() { return (await this.todas()).filter(x => !x.enviada); },
  // URL para usar no <img>: cópia local (se houver) ou o próprio caminho do site
  async url(caminho) {
    if (this.urls[caminho]) return this.urls[caminho];
    const r = await this.ler(caminho);
    if (r && r.blob) return (this.urls[caminho] = URL.createObjectURL(r.blob));
    return caminho;
  },
  async enviarPendentes() {
    for (const p of await this.pendentes()) {
      const b64 = await new Promise((ok, falha) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result).split(',')[1]);
        fr.onerror = () => falha(fr.error);
        fr.readAsDataURL(p.blob);
      });
      await FF.Edicoes.gravarArquivo(p.caminho, b64, 'Estúdio: imagem ' + p.caminho.split('/').pop());
      await this._op('readwrite', st => st.put(Object.assign({}, p, { enviada: true, caminho: undefined }), p.caminho));
    }
  },
};
