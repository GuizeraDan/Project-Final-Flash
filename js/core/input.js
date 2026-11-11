// Entrada: o "botão de ação" (Espaço, Z, Enter ou toque/clique na tela de batalha)
// é usado na guarda cronometrada e nos golpes críticos.
window.FF = window.FF || {};

FF.Input = {
  listeners: [],
  init(canvas) {
    const fire = (e) => { this.listeners.forEach(fn => fn(e)); };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyJ') {
        e.preventDefault();
        fire(e);
      }
    });
    canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); fire(e); });
  },
  onAction(fn) { this.listeners.push(fn); },
};
