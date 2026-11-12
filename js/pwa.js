// App instalável (PWA): registra o service worker, oferece "Instalar" e avisa quando há versão nova.
window.FF = window.FF || {};

FF.PWA = {
  versao: null,
  pedidoInstalar: null,

  iniciar() {
    if (!/^https?:/.test(location.protocol)) return;          // abrindo pelo arquivo (file://): sem PWA
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.pedidoInstalar = e;
      // (o botão "Instalar no celular" saiu do menu; o navegador oferece a instalação pelo próprio menu dele)
    });
    window.addEventListener('appinstalled', () => {
      const bt = document.querySelector('[data-acao="instalar"]');
      if (bt) bt.hidden = true;
    });
    this.checarVersao();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.checarVersao(); });
    setInterval(() => this.checarVersao(), 60 * 1000);
  },

  async instalar() {
    if (!this.pedidoInstalar) {
      alert('No Chrome: toque em ⋮ e depois em "Instalar app" ou "Adicionar à tela inicial".\nNo iPhone (Safari): Compartilhar → "Adicionar à Tela de Início".');
      return;
    }
    this.pedidoInstalar.prompt();
    await this.pedidoInstalar.userChoice.catch(() => {});
    this.pedidoInstalar = null;
  },

  // 1ª checagem (ao abrir) passa pelo service worker: online pega a versão do servidor, offline a guardada
  // junto com o código. As seguintes vão sempre ao servidor e comparam com essa.
  async checarVersao() {
    try {
      const r = this.versao ? await fetch('versao.json?t=' + Date.now(), { cache: 'no-store' }) : await fetch('versao.json');
      if (!r.ok) return;
      const v = (await r.json()).versao;
      if (!this.versao) this.versao = v;
      else if (v !== this.versao) this.avisar();
      // edições gravadas pelo Editor (outro aparelho) também contam como versão nova
      const ed = await fetch('data/edicoes.js?t=' + Date.now(), { cache: 'no-store' });
      if (ed.ok) {
        const txt = await ed.text();
        if (this.edicoes == null) this.edicoes = txt;
        else if (txt !== this.edicoes) { this.edicoes = txt; this.avisar(); }
      }
    } catch (e) { /* sem internet */ }
  },

  avisar() {
    if (document.getElementById('nova-versao')) return;
    const el = document.createElement('button');
    el.id = 'nova-versao';
    el.textContent = '✨ Nova versão disponível — toque para atualizar';
    el.onclick = () => location.reload();
    document.body.appendChild(el);
  },
};

FF.PWA.iniciar();
