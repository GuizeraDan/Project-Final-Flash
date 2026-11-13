// Sons no Estúdio: renomear e excluir qualquer som (do jogo ou do acervo) e importar sons do computador.
// Guardado em data/edicoes.js → sons[id] = {nome?, apagado?, usr?, dur?}. Os importados ficam em
// assets/audio/usr/<nome>.<ext> (sobem para o GitHub junto com as imagens importadas, FF.ImagensUsr) e o id
// deles é "usr/<nome>.<ext>" (o FF.Audio toca direto; enquanto não sobe, usa a cópia do aparelho).
window.FF = window.FF || {};

FF.SonsUsr = {
  todos() { return (FF.Edicoes && FF.Edicoes.dados().sons) || {}; },
  de(id) { return this.todos()[id] || {}; },
  nome(id) { return this.de(id).nome || null; },
  apagado(id) { return !!this.de(id).apagado; },
  importados() { return Object.entries(this.todos()).filter(([, v]) => v && v.usr).map(([id, v]) => Object.assign({ id }, v)); },
  mudar(id, patch) {
    const v = Object.assign({}, this.de(id), patch);
    Object.keys(v).forEach(k => { if (v[k] == null || v[k] === '' || v[k] === false) delete v[k]; });
    FF.Edicoes.setDepois(['sons', id], Object.keys(v).length ? v : null);
  },
  renomear(id, nome) { this.mudar(id, { nome: (nome || '').trim() || null }); },
  apagar(id, sim) { this.mudar(id, { apagado: sim !== false ? true : null }); },

  slug(s) {
    return (s || 'som').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'som';
  },
  duracao(blob) {
    return new Promise(ok => {
      const a = new Audio(); const u = URL.createObjectURL(blob);
      a.preload = 'metadata';
      a.onloadedmetadata = () => { ok(isFinite(a.duration) ? Math.round(a.duration * 100) / 100 : 0); URL.revokeObjectURL(u); };
      a.onerror = () => { ok(null); URL.revokeObjectURL(u); };
      a.src = u;
    });
  },
  // arquivo do computador → som novo na lista; devolve o id
  async importar(arq) {
    const m = /\.(ogg|mp3|wav|m4a|aac|webm)$/i.exec(arq.name);
    if (!m) throw new Error('Formato não aceito (use .mp3, .ogg, .wav ou .m4a).');
    if (arq.size > 15e6) throw new Error('Arquivo grande demais (máximo 15 MB).');
    const dur = await this.duracao(arq);
    if (dur === null) throw new Error('Este navegador não conseguiu abrir o arquivo de áudio.');
    const base = this.slug(arq.name.replace(/\.[^.]+$/, '')), ext = m[1].toLowerCase();
    let nome = base, k = 2;
    while (this.todos()['usr/' + nome + '.' + ext]) nome = base + '_' + (k++);
    const id = 'usr/' + nome + '.' + ext, caminho = FF.Audio.base + id;
    await FF.ImagensUsr.gravar(caminho, arq, false);
    FF.Audio.locais[id] = URL.createObjectURL(arq);
    FF.Edicoes.set(['sons', id], { usr: true, nome: arq.name.replace(/\.[^.]+$/, ''), dur });
    return id;
  },
};
