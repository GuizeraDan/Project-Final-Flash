// Menu de pausa da batalha (botão ⏸, Esc ou o "voltar" do celular): continuar, som,
// velocidade, reiniciar, salvar e sair. Também cuida do botão "voltar" do Android nas telas.
window.FF = window.FF || {};

FF.Pausa = {
  aberta: false,

  iniciar() {
    const el = document.getElementById('pausa');
    const bt = document.getElementById('bt-pausa');
    bt.onclick = (e) => { e.stopPropagation(); this.alternar(); };
    bt.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.querySelectorAll('[data-p]').forEach(b => {
      if (b.tagName === 'SELECT') return;
      b.onclick = () => this.acao(b.dataset.p);
    });
    el.querySelectorAll('[data-vol]').forEach(r => r.oninput = () => this.volume(r));
    el.querySelector('[data-p="velocidade"]').onchange = (e) => {
      FF.Clock.velocidade = +e.target.value;
      FF.Save.set({ velocidade: FF.Clock.velocidade });
    };
    el.querySelector('[data-p="janela"]').onchange = (e) => {
      FF.janela = +e.target.value;
      FF.Save.set({ janela: FF.janela });
    };
    const sv = FF.Save.get();
    if (sv.velocidade) FF.Clock.velocidade = sv.velocidade;
    if (sv.janela) FF.janela = sv.janela;
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Escape' || e.code === 'KeyP') && this.disponivel()) { e.preventDefault(); e.stopImmediatePropagation(); this.alternar(); }
    }, true);
  },

  // só existe pausa numa batalha normal em andamento (não com diálogo aberto)
  disponivel() {
    const p = new URLSearchParams(location.search);
    if (!FF.battle) return false;
    const dlg = document.getElementById('dialogo');
    if (dlg && dlg.classList.contains('open')) return false;
    return true;
  },

  mostrarBotao() {
    if (this.disponivel()) document.getElementById('bt-pausa').hidden = false;
  },

  alternar() { this.aberta ? this.fechar() : this.abrir(); },

  abrir() {
    if (this.aberta || !this.disponivel()) return;
    this.aberta = true;
    FF.Clock.pausado = true;
    if (FF.Audio.musica) FF.Audio.musica.volume = FF.Audio.volMusica * 0.35;
    const el = document.getElementById('pausa');
    this.tela('principal');
    const mh = FF.modoHistoria;
    el.querySelector('[data-p="salvar"]').hidden = !mh;
    el.querySelector('.pausa-aviso').textContent = mh ? 'Capítulo ' + mh.cap.id + ': ' + (mh.cap.titulo || '') : (FF.battle.def.titulo || '');
    el.hidden = false;
    document.getElementById('jogo').classList.add('pausado');
    FF.Audio.play('menuopen', 0.6);
    const b = el.querySelector('[data-p="continuar"]'); if (b) b.focus();
  },

  fechar() {
    if (!this.aberta) return;
    this.aberta = false;
    FF.Clock.pausado = false;
    if (FF.Audio.musica) FF.Audio.musica.volume = FF.Audio.volMusica;
    document.getElementById('pausa').hidden = true;
    document.getElementById('jogo').classList.remove('pausado');
  },

  tela(nome) {
    const el = document.getElementById('pausa');
    el.querySelectorAll('[data-tela]').forEach(t => (t.hidden = t.dataset.tela !== nome));
    if (nome === 'habilidades') {
      const b = FF.battle;
      const nomes = {}; b.all.forEach(f => (nomes[f.id] = f.def.nome + (f.isHero ? ' (seu time)' : ' (inimigo)')));
      FF.Habilidades.painel(el.querySelector('.pausa-hab .hab-lista'), {
        personagens: [...new Set(b.all.map(f => f.id))], nomes,
        aoMudar: () => FF.Habilidades.atualizarBatalha(b),
      });
    }
    if (nome === 'opcoes') {
      const v = FF.Save.get().volumes || { musica: FF.Audio.volMusica, sfx: FF.Audio.volSfx, voz: FF.Audio.volVoz };
      el.querySelectorAll('[data-vol]').forEach(r => (r.value = Math.round(v[r.dataset.vol] * 100)));
      el.querySelector('[data-p="velocidade"]').value = String(FF.Clock.velocidade);
      el.querySelector('[data-p="janela"]').value = String(FF.janela || 0.3);
    }
  },

  volume(r) {
    const el = document.getElementById('pausa');
    const v = {};
    el.querySelectorAll('[data-vol]').forEach(x => (v[x.dataset.vol] = x.value / 100));
    FF.Save.set({ volumes: v });
    FF.aplicarVolumes();
    if (FF.Audio.musica) FF.Audio.musica.volume = FF.Audio.volMusica * 0.35;   // ainda pausado
    if (r.dataset.vol === 'sfx') FF.Audio.play('tap_sound');
    if (r.dataset.vol === 'voz') FF.Audio.voice('vgkn400');
  },

  acao(a) {
    FF.Audio.play('decide_charasel', 0.5);
    const ir = (q) => { location.href = location.pathname + q; };
    if (a === 'continuar') return this.fechar();
    if (a === 'opcoes') return this.tela('opcoes');
    if (a === 'habilidades') return this.tela('habilidades');
    if (a === 'voltar') return this.tela('principal');
    if (a === 'reiniciar') { if (confirm('Reiniciar esta luta do começo?')) location.reload(); return; }
    if (a === 'salvar') {
      const mh = FF.modoHistoria;
      if (mh) FF.Save.set({ capitulo: Math.max(mh.cap.id, FF.Save.get().capitulo || 1) });
      document.querySelector('#pausa .pausa-aviso').textContent = '💾 Progresso salvo no capítulo ' + (mh ? mh.cap.id : '') + '. Use "Continuar" na tela de título.';
      setTimeout(() => ir(''), 900);
      return;
    }
    if (a === 'sair') { if (confirm('Sair para a tela de título? A luta atual será perdida.')) ir(''); }
  },
};

// Botão "voltar" do celular/navegador: abre a pausa na batalha ou volta um nível nos menus,
// em vez de fechar o app.
FF.Voltar = {
  armado: false,
  armar() {
    if (this.armado) return;
    this.armado = true;
    try { history.pushState({ ff: 1 }, ''); } catch (e) { /* nada */ }
  },
  iniciar() {
    window.addEventListener('popstate', () => {
      this.armado = false;
      const intro = document.getElementById('inicio');
      const sel = document.getElementById('selecao');
      if (FF.Pausa.disponivel() && intro.classList.contains('hide')) {
        FF.Pausa.aberta ? FF.Pausa.fechar() : FF.Pausa.abrir();
        this.armar();
      } else if (sel && sel.classList.contains('open')) {
        FF.Selecao.fechar(); FF._mostrarTitulo && FF._mostrarTitulo('menu'); this.armar();
      } else if (intro && intro.className && intro.className !== 'menu' && !intro.classList.contains('hide')) {
        FF._mostrarTitulo && FF._mostrarTitulo('menu'); this.armar();
      }
      // na tela de título principal o "voltar" segue normal (sai do app)
    });
  },
};

window.addEventListener('load', () => { FF.Pausa.iniciar(); FF.Voltar.iniciar(); });
