// Batalha Livre: escolha livre de até 3 heróis e até 3 inimigos (qualquer personagem, em qualquer lado).
// A batalha é montada na hora (posições, escala e ajuste de vida para equilibrar times desiguais).
window.FF = window.FF || {};

FF.Selecao = {
  times: { herois: ['goku'], inimigos: ['raditz'] },
  formas: { herois: [], inimigos: [] },   // forma escolhida de cada lutador (null = a inicial)
  lado: 'herois',
  defs: {},

  // modo: 'livre' (Batalha Livre) ou 'treino' (Treinamento: mesma tela, a batalha leva def.treino)
  async abrir(modo) {
    this.modo = modo === 'treino' ? 'treino' : 'livre';
    FF.Audio.musicaSelecao();   // música própria da escolha de lutadores
    const el = document.getElementById('selecao');
    el.querySelector('.sel-topo h2').textContent = this.modo === 'treino' ? 'Treinamento' : 'Batalha Livre';
    el.querySelector('.sel-topo span').textContent = this.modo === 'treino'
      ? 'Monte o treino como na Batalha Livre · as opções da CPU (parada, defende, vida infinita…) ficam no menu de pausa ⏸'
      : 'Toque nos lutadores para montar os times · toque num retrato do time para tirar';
    const btL = el.querySelector('[data-sel="lutar"]'); (btL.querySelector('span') || btL).textContent = this.modo === 'treino' ? 'TREINAR!' : 'LUTAR!';
    this.times = { herois: ['goku'], inimigos: ['raditz'] }; this.formas = { herois: [], inimigos: [] };
    const ids = (FF.Assets.listaPersonagens && FF.Assets.listaPersonagens().slice()) || ['goku', 'piccolo', 'krillin', 'raditz', 'saibaman', 'nappa', 'vegeta'];
    // ordem: heróis da saga primeiro, depois os vilões
    const ordem = ['goku', 'piccolo', 'krillin', 'raditz', 'saibaman', 'nappa', 'vegeta'];
    ids.sort((a, b) => ((ordem.indexOf(a) + 1) || 99) - ((ordem.indexOf(b) + 1) || 99));
    for (const id of ids) this.defs[id] = await FF.Assets.loadCharacter(id);
    try { const s = JSON.parse(sessionStorage.getItem(this.chaveTimes()) || 'null'); if (s && s.herois && s.inimigos) { this.times = { herois: s.herois, inimigos: s.inimigos }; this.formas = s.formas || { herois: [], inimigos: [] }; } } catch (e) { /* sem sessionStorage */ }
    this.ids = ids;
    // times guardados com lutadores do elenco: carrega os pacotes deles (some quem não existir mais)
    for (const lado of ['herois', 'inimigos']) {
      for (const id of this.times[lado]) if (FF.Elenco && FF.Elenco.eh(id)) await FF.Elenco.garantir(id).catch(() => null);
      this.times[lado] = this.times[lado].filter(id => this.d(id));
    }
    await this.montarAbas();
    this.montarGrade();
    this.ligar(el);
    this.render();
    el.classList.add('open');
  },

  // definição do personagem (os do elenco do acervo são montados na hora, quando o pacote já está carregado)
  d(id) {
    if (!this.defs[id] && FF.Elenco && FF.Elenco.eh(id)) this.defs[id] = FF.Elenco.def(id);
    return this.defs[id];
  },

  chaveTimes() { return this.modo === 'treino' ? 'ff_treino_times' : 'ff_livre_times'; },

  fechar() {
    const el = document.getElementById('selecao');
    if (el.classList.contains('open') && FF.Audio.musicaNome === FF.Audio.SELECAO) FF.Audio.musicaMenu();   // saindo para os menus: volta a do menu
    el.classList.remove('open');
  },

  // abas: personagens do jogo + um por pacote do elenco (acervo), com busca
  async montarAbas() {
    const box = document.querySelector('#selecao .sel-pacotes');
    if (!box) return;
    const ind = FF.Elenco ? await FF.Elenco.indice() : [];
    this.pacotes = [{ id: 'ff', nome: 'Final Flash', n: this.ids.length }].concat(ind);
    if (!this.pacote || !this.pacotes.some(p => p.id === this.pacote)) this.pacote = 'ff';
    box.innerHTML = '';
    this.pacotes.forEach(p => {
      const b = document.createElement('button');
      b.dataset.pac = p.id;
      b.textContent = p.nome + ' (' + p.n + ')';
      b.onclick = () => { this.pacote = p.id; FF.Audio.play('tap_sound', 0.5); this.montarGrade(); };
      box.appendChild(b);
    });
    const busca = document.querySelector('#selecao .sel-busca');
    if (busca && !busca._ligada) { busca._ligada = true; busca.onkeydown = (e) => e.stopPropagation(); busca.oninput = () => { clearTimeout(this._tBusca); this._tBusca = setTimeout(() => this.montarGrade(), 150); }; }
  },

  async idsDaAba() {
    if (this.pacote === 'ff' || !FF.Elenco) return this.ids;
    await FF.Elenco.carregar(this.pacote).catch(() => null);
    return FF.Elenco.lista(this.pacote).map(f => f.id);
  },

  async montarGrade() {
    const grade = document.querySelector('#selecao .sel-grade');
    const pac = this.pacote || 'ff';
    document.querySelectorAll('#selecao .sel-pacotes button').forEach(b => b.classList.toggle('sel', b.dataset.pac === pac));
    const vez = this._vezGrade = (this._vezGrade || 0) + 1;
    let ids = await this.idsDaAba();
    if (vez !== this._vezGrade) return;   // trocou de aba enquanto carregava
    const busca = document.querySelector('#selecao .sel-busca');
    const q = busca && busca.value.trim().toLowerCase();
    const nome = (id) => FF.Elenco && FF.Elenco.eh(id) ? (FF.Elenco.ficha(id) || {}).nome || id : (this.defs[id] || {}).nome || id;
    if (q) ids = ids.filter(id => nome(id).toLowerCase().includes(q));
    this.idsVisiveis = ids;
    grade.innerHTML = '';
    grade.classList.toggle('sel-grade-muitos', pac !== 'ff');
    if (!ids.length) { grade.innerHTML = '<p class="sel-vazio">Nenhum lutador com esse nome.</p>'; return; }
    for (const id of ids) {
      const b = document.createElement('button');
      b.className = 'sel-card';
      b.dataset.id = id;
      const cv = document.createElement('canvas');
      cv.width = 40; cv.height = 56;
      b.appendChild(cv);
      const n = document.createElement('span');
      n.textContent = nome(id);
      b.appendChild(n);
      b.onclick = () => this.adicionar(id);
      b.onmouseenter = () => this.info(id);
      b.onfocus = () => this.info(id);
      grade.appendChild(b);
      const d = this.d(id);
      if (d) FF.Retrato.noCanvas(cv, d, d.formaInicial, 'retrato');
    }
  },

  ligar(el) {
    if (this._ligado) return;
    this._ligado = true;
    el.querySelectorAll('.sel-abas button').forEach(b => b.onclick = () => { this.lado = b.dataset.lado; this.render(); FF.Audio.play('tap_sound', 0.5); });
    el.querySelectorAll('.sel-time').forEach(t => t.onclick = () => { this.lado = t.dataset.lado; this.render(); });
    el.querySelector('[data-sel="voltar"]').onclick = () => { FF.Audio.play('decide_charasel', 0.5); this.fechar(); FF._mostrarTitulo && FF._mostrarTitulo('menu'); };
    el.querySelector('[data-sel="limpar"]').onclick = () => { this.times = { herois: [], inimigos: [] }; this.formas = { herois: [], inimigos: [] }; this.lado = 'herois'; this.render(); };
    el.querySelector('[data-sel="aleatorio"]').onclick = () => {
      const l = this.idsVisiveis && this.idsVisiveis.length ? this.idsVisiveis : this.ids;
      const pick = () => l[Math.floor(Math.random() * l.length)];
      const nh = 1 + Math.floor(Math.random() * 3), ni = 1 + Math.floor(Math.random() * 3);
      this.times = { herois: Array.from({ length: nh }, pick), inimigos: Array.from({ length: ni }, pick) };
      this.formas = { herois: [], inimigos: [] };
      FF.Audio.play('decide_charasel', 0.6);
      this.render();
    };
    el.querySelector('[data-sel="lutar"]').onclick = () => this.lutar();
    el.querySelector('[data-sel="habilidades"]').onclick = () => this.abrirHabilidades();
    el.querySelector('[data-sel="habok"]').onclick = () => { el.querySelector('.sel-hab').hidden = true; this.render(); };
    el.querySelector('[data-sel="habnova"]').onclick = () => {
      // abre o Estúdio criando uma habilidade nova para o 1º herói escolhido (contra o 1º inimigo)
      const h = this.times.herois[0] || 'goku', i = this.times.inimigos[0] || (h === 'raditz' ? 'goku' : 'raditz');
      location.href = 'estudio.html?aba=golpes&novo=1&personagem=' + encodeURIComponent(h) + '&alvo=' + encodeURIComponent(i);
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
    (this.formas[this.lado] = this.formas[this.lado] || [])[t.length - 1] = null;
    FF.Audio.play('decide_charasel', 0.6);
    if (this.lado === 'herois' && t.length === 3 && this.times.inimigos.length < 3) this.lado = 'inimigos';
    this.info(id);
    this.render();
  },

  remover(lado, i) {
    this.times[lado].splice(i, 1);
    (this.formas[lado] = this.formas[lado] || []).splice(i, 1);
    this.lado = lado;
    FF.Audio.play('tap_sound', 0.5);
    this.render();
  },

  // forma do lutador num slot (a escolhida ou a inicial do personagem)
  formaDe(lado, i) {
    const id = this.times[lado][i], d = this.d(id);
    const f = (this.formas[lado] || [])[i];
    return f && d.formas[f] ? f : (d.formaInicial || Object.keys(d.formas)[0]);
  },
  trocarForma(lado, i) {
    const d = this.d(this.times[lado][i]), ks = Object.keys(d.formas);
    if (ks.length < 2) return;
    const atual = this.formaDe(lado, i), prox = ks[(ks.indexOf(atual) + 1) % ks.length];
    (this.formas[lado] = this.formas[lado] || [])[i] = prox;
    FF.Audio.play('carregamentodeki_start', 0.4);
    this.render();
  },

  info(id) {
    const d = this.d(id), a = d.atributos || {};
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
    el.appendChild(s);
  },

  abrirHabilidades() {
    const el = document.querySelector('#selecao .sel-hab');
    const nomes = {}; Object.entries(this.defs).forEach(([id, d]) => (nomes[id] = d.nome));
    FF.Habilidades.painel(el.querySelector('.hab-lista'), {
      nomes,
      editar: (h) => { location.href = 'estudio.html?aba=golpes&hab=' + encodeURIComponent(h.id); },
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
          const d = this.d(id), fId = this.formaDe(lado, i), fm = d.formas[fId] || {};
          n.textContent = fId !== (d.formaInicial || 'base') && fm.nome ? (fm.nome.includes(d.nome) ? fm.nome : d.nome + ' · ' + fm.nome) : d.nome;
          s.appendChild(n);
          FF.Retrato.noCanvas(cv, d, fId, 'banner', { espelhar: lado === 'inimigos', cor1: lado === 'herois' ? '#1d3a7a' : '#6a1414', cor2: '#0c0f22' });
          s.onclick = (e) => { e.stopPropagation(); this.remover(lado, i); };
          s.title = 'Tocar para tirar';
          // personagem com mais de uma forma (ex.: Goku / Super Saiyajin): botão para trocar a forma inicial
          if (Object.keys(d.formas).length > 1) {
            const bf = document.createElement('button');
            bf.className = 'slot-forma';
            bf.textContent = '⚡ ' + (fm.nome || fId);
            bf.title = 'Trocar a forma com que ele começa a luta';
            bf.onclick = (e) => { e.stopPropagation(); this.trocarForma(lado, i); };
            s.appendChild(bf);
          }
        } else {
          s.textContent = '+';
        }
        slots.appendChild(s);
      }
    });
    const ok = this.times.herois.length && this.times.inimigos.length;
    el.querySelector('[data-sel="lutar"]').disabled = !ok;
    try { sessionStorage.setItem(this.chaveTimes(), JSON.stringify(Object.assign({}, this.times, { formas: this.formas }))); } catch (e) { /* nada */ }
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
      formas: { herois: times.herois.map((_, i) => this.formaDe('herois', i)), inimigos: times.inimigos.map((_, i) => this.formaDe('inimigos', i)) },
    };
    // times desiguais: o lado menor ganha vida e um pouco de ataque (como nas lutas 3 contra 1 da história)
    if (nh > ni) {
      for (const id of new Set(times.inimigos)) {
        const a = this.d(id).atributos;
        def.ajustes[id] = { hp: Math.round(a.hp * (0.8 * nh / ni + 0.2)), ataque: Math.round(a.ataque * (1 + 0.12 * (nh - ni))) };
      }
    }
    return def;
  },

  lutar() {
    const def = this.montarBatalha(this.times);
    if (this.modo === 'treino') Object.assign(def, { id: 'treino', saga: 'treino', titulo: 'Treinamento', treino: FF.Treinar.cfg() });
    try { sessionStorage.setItem('ff_livre_def', JSON.stringify(def)); } catch (e) { /* nada */ }
    FF.Audio.play('battlecall_start01', 0.8);
    this.fechar();
    FF._iniciarLivre && FF._iniciarLivre(def);
  },
};
