// Alterações do usuário em animações de sprites do jogo, feitas no visualizador (✂ Editar quadros).
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
      set.def.anims[nome] = JSON.parse(JSON.stringify(a));
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

  alterada(id, nome) { const m = this.ler()[id]; return !!(m && m[nome]); },
  criada(id, nome) { const set = FF.Assets.sprites[id]; return !!(set && set.def._orig && nome in set.def._orig && !set.def._orig[nome]); },
  total() { return Object.values(this.ler()).reduce((s, m) => s + Object.keys(m).length, 0); },
  exportar() { return JSON.stringify({ final_flash_mods: 1, sprites: this.ler() }); },
};
