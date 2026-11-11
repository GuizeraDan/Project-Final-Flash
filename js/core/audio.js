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
      a = new Audio(this.base + name + this.ext);
      a.preload = 'auto';
      list.push(a);
    }
    return a;
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
    const a = new Audio(this.base + name + this.ext);
    a.loop = true;
    a.volume = vol == null ? this.volSfx : vol;
    a.play().catch(() => {});
    return () => { a.pause(); };
  },

  music(name) {
    if (this.musica) { this.musica.pause(); this.musica = null; }
    if (!name) return;
    const a = new Audio(this.base + name + this.ext);
    a.loop = true;
    a.volume = this.volMusica;
    a.play().catch(() => {});
    this.musica = a;
  },
};
