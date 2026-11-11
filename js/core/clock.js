// Relógio do jogo: tempo escalável (hitstop, câmera lenta) e esperas por tempo de jogo.
window.FF = window.FF || {};

FF.Clock = {
  t: 0,          // tempo de jogo (s)
  scale: 1,
  freeze: 0,     // hitstop restante (tempo real)
  waits: [],

  pausado: false,      // menu de pausa aberto: o tempo de jogo para
  velocidade: 1,       // velocidade da batalha escolhida nas opções (1×, 1,5×, 2×)

  tick(realDt) {
    if (this.pausado) return 0;
    realDt *= this.velocidade;
    if (this.freeze > 0) {
      this.freeze -= realDt;
      return 0;
    }
    const dt = realDt * this.scale;
    this.t += dt;
    if (this.waits.length) {
      const now = this.t;
      const due = this.waits.filter(w => w.at <= now);
      if (due.length) {
        this.waits = this.waits.filter(w => w.at > now);
        due.forEach(w => w.res());
      }
    }
    return dt;
  },

  wait(sec) {
    return new Promise(res => this.waits.push({ at: this.t + Math.max(0, sec), res }));
  },

  hitstop(sec) { this.freeze = Math.max(this.freeze, sec); },
};
