// Áudio simples com HTMLAudioElement (funciona também em file://).
window.FF = window.FF || {};

FF.Audio = {
  base: 'assets/audio/',
  ext: '.ogg',
  volSfx: 0.8,
  volVoz: 1.0,
  volMusica: 0.35,
  musica: null,
  pool: {},

  _get(name) {
    let list = this.pool[name];
    if (!list) list = this.pool[name] = [];
    let a = list.find(x => x.paused || x.ended);
    if (!a) {
      a = new Audio(this.url(name));
      a.preload = 'auto';
      list.push(a);
    }
    return a;
  },

  // caminho do som: ids com extensão (sons importados, ex.: "usr/meu_som.mp3") e cópia local enquanto não sobe
  locais: {},
  url(name) {
    if (this.locais[name]) return this.locais[name];
    return this.base + name + (/\.(ogg|mp3|wav|m4a|aac|webm)$/i.test(name) ? '' : this.ext);
  },
  async prepararLocais() {
    if (!FF.ImagensUsr) return;
    try {
      for (const x of await FF.ImagensUsr.todas()) {
        if (x.enviada || !/^assets\/audio\//.test(x.caminho) || !x.blob) continue;
        this.locais[x.caminho.slice(this.base.length)] = URL.createObjectURL(x.blob);
      }
    } catch (e) { /* sem IndexedDB */ }
  },

  preload(names) {
    names.forEach(n => { if (!this.pool[n]) this._get(n); });
  },

  play(name, vol) {
    if (!name) return null;
    if (Array.isArray(name)) name = name[Math.floor(Math.random() * name.length)];
    const a = this._get(name);
    a.volume = Math.max(0, Math.min(1, vol == null ? this.volSfx : vol));
    a.currentTime = 0;
    a.play().catch(() => {});
    return a;
  },

  voice(name) { return this.play(name, this.volVoz); },

  // Loop contínuo (ex.: carregar ki). Retorna função para parar.
  loop(name, vol) {
    const a = new Audio(this.url(name));
    a.loop = true;
    a.volume = vol == null ? this.volSfx : vol;
    a.play().catch(() => {});
    return () => { a.pause(); };
  },

  music(name) {
    if (this.musica && this.musicaNome === name) {   // já é esta: não reinicia (se o navegador bloqueou, tenta tocar)
      if (this.musica.paused) this.musica.play().catch(() => {});
      return this.musica;
    }
    if (this.musica) { this.musica.pause(); this.musica = null; }
    this.musicaNome = name || null;
    if (!name) return null;
    const a = new Audio(this.url(name));
    a.loop = true;
    a.volume = this.volMusica;
    // o navegador só deixa tocar som depois de um toque/tecla: se bloquear, tenta de novo no 1º gesto
    a.play().catch(() => {
      const evs = ['pointerdown', 'keydown', 'touchend', 'click'];
      const tentar = () => { evs.forEach(t => window.removeEventListener(t, tentar, true)); if (this.musica === a && a.paused) a.play().catch(() => {}); };
      evs.forEach(t => window.addEventListener(t, tentar, true));
    });
    this.musica = a;
    return a;
  },

  // música dos menus (tela de título, submenus) e da seleção da Batalha Livre (arquivos enviados pelo usuário)
  MENU: 'menu_chala',
  SELECAO: 'selecao_chala',
  musicaMenu() { return this.music(this.MENU); },
  musicaSelecao() { return this.music(this.SELECAO); },
};
