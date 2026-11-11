// Batalha Livre: escolha livre de até 3 heróis e até 3 inimigos (qualquer personagem, em qualquer lado).
// A batalha é montada na hora (posições, escala e ajuste de vida para equilibrar times desiguais).
window.FF = window.FF || {};

FF.Selecao = {
  times: { herois: ['goku'], inimigos: ['raditz'] },
  lado: 'herois',
  defs: {},

  async abrir() {
    const el = document.getElementById('selecao');
    const ids = (window.FF_BUNDLE && FF_BUNDLE._indice && FF_BUNDLE._indice.personagens) || ['goku', 'piccolo', 'krillin', 'raditz', 'saibaman', 'nappa', 'vegeta'];
    // ordem: heróis da saga primeiro, depois os vilões
    const ordem = ['goku', 'piccolo', 'krillin', 'raditz', 'saibaman', 'nappa', 'vegeta'];
    ids.sort((a, b) => ((ordem.indexOf(a) + 1) || 99) - ((ordem.indexOf(b) + 1) || 99));
    for (const id of ids) this.defs[id] = await FF.Assets.loadCharacter(id);
    try { const s = JSON.parse(sessionStorage.getItem('ff_livre_times') || 'null'); if (s && s.herois && s.inimigos) this.times = s; } catch (e) { /* sem sessionStorage */ }
    this.ids = ids;
    this.montarGrade();
    this.ligar(el);
    this.render();
    el.classList.add('open');
  },

  fechar() { document.getElementById('selecao').classList.remove('open'); },

  montarGrade() {
    const grade = document.querySelector('#selecao .sel-grade');
    grade.innerHTML = '';
    for (const id of this.ids) {
      const d = this.defs[id];
      const b = document.createElement('button');
      b.className = 'sel-card';
      b.dataset.id = id;
      const cv = document.createElement('canvas');
      cv.width = 40; cv.height = 56;
      b.appendChild(cv);
      const n = document.createElement('span');
      n.textContent = d.nome;
      b.appendChild(n);
      FF.Retrato.noCanvas(cv, d, d.formaInicial, 'retrato');
      b.onclick = () => this.adicionar(id);
      b.onmouseenter = () => this.info(id);
      b.onfocus = () => this.info(id);
      grade.appendChild(b);
    }
  },

  ligar(el) {
    if (this._ligado) return;
    this._ligado = true;
    el.querySelectorAll('.sel-abas button').forEach(b => b.onclick = () => { this.lado = b.dataset.lado; this.render(); FF.Audio.play('tap_sound', 0.5); });
    el.querySelectorAll('.sel-time').forEach(t => t.onclick = () => { this.lado = t.dataset.lado; this.render(); });
    el.querySelector('[data-sel="voltar"]').onclick = () => { FF.Audio.play('decide_charasel', 0.5); this.fechar(); FF._mostrarTitulo && FF._mostrarTitulo('menu'); };
    el.querySelector('[data-sel="limpar"]').onclick = () => { this.times = { herois: [], inimigos: [] }; this.lado = 'herois'; this.render(); };
    el.querySelector('[data-sel="aleatorio"]').onclick = () => {
      const pick = () => this.ids[Math.floor(Math.random() * this.ids.length)];
      const nh = 1 + Math.floor(Math.random() * 3), ni = 1 + Math.floor(Math.random() * 3);
      this.times = { herois: Array.from({ length: nh }, pick), inimigos: Array.from({ length: ni }, pick) };
      FF.Audio.play('decide_charasel', 0.6);
      this.render();
    };
    el.querySelector('[data-sel="lutar"]').onclick = () => this.lutar();
    el.querySelector('[data-sel="habilidades"]').onclick = () => this.abrirHabilidades();
    el.querySelector('[data-sel="habok"]').onclick = () => { el.querySelector('.sel-hab').hidden = true; this.render(); };
    el.querySelector('[data-sel="habnova"]').onclick = () => {
      // abre o editor com os times escolhidos (ou Goku x Raditz)
      const t = this.times.herois.length && this.times.inimigos.length ? this.times : { herois: ['goku'], inimigos: ['raditz'] };
      try { sessionStorage.setItem('ff_livre_def', JSON.stringify(this.montarBatalha(t))); } catch (e) { /* nada */ }
      location.href = location.pathname + '?livre=1&editor=1';
    };
  },

  adicionar(id) {
    const t = this.times[this.lado];
    if (t.length >= 3) {
      // lado cheio: troca para o outro lado se ele tiver vaga
      const outro = this.lado === 'herois' ? 'inimigos' : 'herois';
      if (this.times[outro].length < 3) { this.lado = outro; return this.adicionar(id); }
      this.aviso('Os dois times já estão completos. Toque num retrato do time para tirar.');
      return;
    }
    t.push(id);
    FF.Audio.play('decide_charasel', 0.6);
    if (this.lado === 'herois' && t.length === 3 && this.times.inimigos.length < 3) this.lado = 'inimigos';
    this.info(id);
    this.render();
  },

  remover(lado, i) {
    this.times[lado].splice(i, 1);
    this.lado = lado;
    FF.Audio.play('tap_sound', 0.5);
    this.render();
  },

  info(id) {
    const d = this.defs[id], a = d.atributos || {};
    const golpes = Object.values(d.golpes || {});
    const sup = golpes.find(g => g.supremo);
    const formas = Object.values(d.formas).map(f => f.nome).filter(Boolean);
    const el = document.querySelector('#selecao .sel-info');
    el.innerHTML = '';
    const b = document.createElement('b'); b.textContent = d.nome; el.appendChild(b);
    const s = document.createElement('span');
    s.textContent = ' · Vida ' + a.hp + ' · Ataque ' + a.ataque + ' · Defesa ' + a.defesa +
      (sup ? ' · Supremo: ' + sup.nome : '') + (formas.length > 1 ? ' · Formas: ' + formas.join(', ') : '');
    const habs = FF.Habilidades ? FF.Habilidades.listar(id).filter(h => h.equipada) : [];
    if (habs.length) s.textContent += ' · ⭐ ' + habs.map(h => h.nome).join(', ');
    el.appendChild(s);
  },

  abrirHabilidades() {
    const el = document.querySelector('#selecao .sel-hab');
    const nomes = {}; Object.entries(this.defs).forEach(([id, d]) => (nomes[id] = d.nome));
    FF.Habilidades.painel(el.querySelector('.hab-lista'), {
      nomes,
      editar: (h) => { location.href = location.pathname + '?editor=1&hab=' + encodeURIComponent(h.id); },
      apagar: true,
    });
    el.hidden = false;
    FF.Audio.play('menuopen', 0.5);
  },

  aviso(txt) {
    const el = document.querySelector('#selecao .sel-info');
    el.textContent = txt;
  },

  render() {
    const el = document.getElementById('selecao');
    el.querySelectorAll('.sel-abas button').forEach(b => b.classList.toggle('sel', b.dataset.lado === this.lado));
    el.querySelectorAll('.sel-time').forEach(box => {
      const lado = box.dataset.lado;
      box.classList.toggle('ativo', lado === this.lado);
      const slots = box.querySelector('.slots');
      slots.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const id = this.times[lado][i];
        const s = document.createElement('div');
        s.className = 'slot' + (id ? ' cheio' : '');
        if (id) {
          const cv = document.createElement('canvas');
          cv.width = 134; cv.height = 70;
          s.appendChild(cv);
          const n = document.createElement('span');
          n.textContent = this.defs[id].nome;
          s.appendChild(n);
          FF.Retrato.noCanvas(cv, this.defs[id], this.defs[id].formaInicial, 'banner', { espelhar: lado === 'inimigos', cor1: lado === 'herois' ? '#1d3a7a' : '#6a1414', cor2: '#0c0f22' });
          s.onclick = (e) => { e.stopPropagation(); this.remover(lado, i); };
          s.title = 'Tocar para tirar';
        } else {
          s.textContent = '+';
        }
        slots.appendChild(s);
      }
    });
    const ok = this.times.herois.length && this.times.inimigos.length;
    el.querySelector('[data-sel="lutar"]').disabled = !ok;
    try { sessionStorage.setItem('ff_livre_times', JSON.stringify(this.times)); } catch (e) { /* nada */ }
  },

  // monta a definição da batalha a partir dos times escolhidos
  montarBatalha(times) {
    const nh = times.herois.length, ni = times.inimigos.length;
    const posH = { 1: [170], 2: [250, 150], 3: [250, 150, 350] }[nh];
    const posI = { 1: [915], 2: [870, 990], 3: [820, 930, 1020] }[ni];
    const def = {
      id: 'livre', saga: 'livre', titulo: 'Batalha Livre', cenario: 'campo', musica: 'tournament_theme',
      escala: nh === 1 && ni === 1 ? 2.5 : 2.2,
      posicoes: { herois: posH, inimigos: posI },
      herois: times.herois.slice(), inimigos: times.inimigos.slice(), ajustes: {},
    };
    // times desiguais: o lado menor ganha vida e um pouco de ataque (como nas lutas 3 contra 1 da história)
    if (nh > ni) {
      for (const id of new Set(times.inimigos)) {
        const a = this.defs[id].atributos;
        def.ajustes[id] = { hp: Math.round(a.hp * (0.8 * nh / ni + 0.2)), ataque: Math.round(a.ataque * (1 + 0.12 * (nh - ni))) };
      }
    }
    return def;
  },

  lutar() {
    const def = this.montarBatalha(this.times);
    try { sessionStorage.setItem('ff_livre_def', JSON.stringify(def)); } catch (e) { /* nada */ }
    FF.Audio.play('battlecall_start01', 0.8);
    this.fechar();
    FF._iniciarLivre && FF._iniciarLivre(def);
  },
};
