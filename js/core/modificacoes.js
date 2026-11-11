// Alterações do usuário em animações de sprites do jogo, feitas no visualizador
// (✂ Editar quadros). Ficam no navegador e são aplicadas ao carregar o sprite, então valem no jogo
// todo. "Exportar" gera um JSON para o Claude gravar de vez em data/sprites.
window.FF = window.FF || {};

FF.Mods = {
  CHAVE: 'ff_sprite_mods',
  ler() { try { return JSON.parse(localStorage.getItem(this.CHAVE) || '{}'); } catch (e) { return {}; } },
  gravar(t) { try { localStorage.setItem(this.CHAVE, JSON.stringify(t)); return true; } catch (e) { return false; } },

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
    const t = this.ler();
    const limpo = { fps: anim.fps || 0, loop: !!anim.loop, repeatTo: anim.repeatTo || 0, pingpong: false, frames: anim.frames };
    (t[id] = t[id] || {})[nome] = limpo;
    if (!this.gravar(t)) return false;
    const set = FF.Assets.sprites[id];
    if (set) this.aplicar(id, set);
    return true;
  },

  // volta ao original do jogo (ou apaga, se a animação foi criada pelo usuário)
  restaurar(id, nome) {
    const t = this.ler();
    if (t[id]) { delete t[id][nome]; if (!Object.keys(t[id]).length) delete t[id]; this.gravar(t); }
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
