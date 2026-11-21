// Alterações do usuário em animações de sprites do jogo, feitas na aba Sprites do Estúdio.
// Ficam em FF.Edicoes (data/edicoes.js, sincronizado pelo GitHub entre aparelhos) e são aplicadas
// ao carregar o sprite, então valem no jogo todo.
window.FF = window.FF || {};

FF.Mods = {
  ler() { return FF.Edicoes.dados().sprites || {}; },

  // aplica no conjunto já carregado (guarda o original para poder restaurar)
  aplicar(id, set) {
    const m = this.ler()[id];
    if (!m || !set) return;
    set.def._orig = set.def._orig || {};
    for (const [nome, a] of Object.entries(m)) {
      if (!(nome in set.def._orig)) set.def._orig[nome] = set.def.anims[nome] || null;
      if (a && a.apagada) delete set.def.anims[nome];          // apagada pelo usuário (Estúdio)
      else set.def.anims[nome] = JSON.parse(JSON.stringify(a));
    }
  },

  salvar(id, nome, anim) {
    const limpo = { fps: anim.fps || 0, loop: !!anim.loop, repeatTo: anim.repeatTo || 0, pingpong: false, frames: anim.frames };
    FF.Edicoes.set(['sprites', id, nome], limpo);
    const set = FF.Assets.sprites[id];
    if (set) this.aplicar(id, set);
    return true;
  },

  // volta ao original do jogo (ou apaga, se a animação foi criada pelo usuário)
  restaurar(id, nome) {
    FF.Edicoes.set(['sprites', id, nome], null);
    const set = FF.Assets.sprites[id];
    if (set && set.def._orig && nome in set.def._orig) {
      if (set.def._orig[nome]) set.def.anims[nome] = set.def._orig[nome]; else delete set.def.anims[nome];
      delete set.def._orig[nome];
    }
  },

  // apaga uma animação do jogo (fica marcada {"apagada": true}; "restaurar" traz de volta)
  apagar(id, nome) {
    FF.Edicoes.set(['sprites', id, nome], { apagada: true });
    const set = FF.Assets.sprites[id];
    if (set) this.aplicar(id, set);
  },
  apagadas(id) { const m = this.ler()[id] || {}; return Object.keys(m).filter(n => m[n] && m[n].apagada); },

  alterada(id, nome) { const m = this.ler()[id]; return !!(m && m[nome]); },
  criada(id, nome) { const set = FF.Assets.sprites[id]; return !!(set && set.def._orig && nome in set.def._orig && !set.def._orig[nome]); },
  // os sprites já carregados acompanham as edições atuais: o que deixou de estar apagado/alterado (restaurado em
  // outra tela, em outro aparelho, ou a versão do GitHub que chega depois de um envio) volta ao original, e o que
  // passou a estar é aplicado. Sem isso a página aberta ficava com animações "sumidas" até recarregar.
  sincronizar() {
    if (!FF.Assets || !FF.Assets.sprites) return;
    const todas = this.ler();
    for (const [id, set] of Object.entries(FF.Assets.sprites)) {
      if (!set || !set.def) continue;
      const m = todas[id] || {}, orig = set.def._orig;
      if (orig) for (const nome of Object.keys(orig)) {
        if (m[nome]) continue;
        if (orig[nome]) set.def.anims[nome] = orig[nome]; else delete set.def.anims[nome];
        delete orig[nome];
      }
      if (Object.keys(m).length) this.aplicar(id, set);
    }
  },
  total() { return Object.values(this.ler()).reduce((s, m) => s + Object.keys(m).length, 0); },
  exportar() { return JSON.stringify({ final_flash_mods: 1, sprites: this.ler() }); },
};
// liga a sincronia quando as edições mudam (FF.Edicoes avisa os ouvintes)
(function ligar() {
  if (!FF.Edicoes || !FF.Edicoes.ouvintes) return setTimeout(ligar, 50);
  let t = null;
  FF.Edicoes.ouvintes.push(() => { clearTimeout(t); t = setTimeout(() => FF.Mods.sincronizar(), 0); });
})();
