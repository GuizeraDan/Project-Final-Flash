// Modo Treinamento: monta uma luta de treino (1 contra 1) com o lutador, o oponente, as formas, a dificuldade e o
// comportamento da CPU (ataca / só carrega ki / parado; defende conforme a dificuldade / nunca / sempre),
// vida infinita, ki infinito e fúria cheia. Escolhas guardadas em FF.Save "treinoCfg". A batalha recebe def.treino
// (lido em js/battle/battle.js) e não dá AP. A antiga tela de Treinamento (AP, cápsulas, pergaminhos) virou a
// Personalização do modo história (botão na tela Novo Jogo).
window.FF = window.FF || {};

FF.Treinar = {
  PADRAO: { heroi: 'goku', cpu: 'raditz', heroiForma: '', cpuForma: '', cpuAcao: 'normal', cpuGuarda: 'dificuldade', vida: 'cpu', kiInf: false, furia: false },
  defs: {},

  cfg() { return Object.assign({}, this.PADRAO, FF.Save.get().treinoCfg || {}); },
  async abrir(mostrar) {
    const box = document.getElementById('treinar');
    const ids = (FF.Assets.listaPersonagens && FF.Assets.listaPersonagens().slice()) || ['goku', 'piccolo', 'krillin', 'raditz', 'saibaman', 'nappa', 'vegeta'];
    for (const id of ids) if (!this.defs[id]) { try { this.defs[id] = await FF.Assets.loadCharacter(id); } catch (e) { /* personagem com erro: fica de fora */ } }
    const c = this.cfg();
    const sel = (k) => box.querySelector('[data-t="' + k + '"]');
    const lista = ids.filter(id => this.defs[id]);
    ['heroi', 'cpu'].forEach(k => {
      const s = sel(k);
      s.innerHTML = '';
      lista.forEach(id => { const o = document.createElement('option'); o.value = id; o.textContent = this.defs[id].nome || id; s.appendChild(o); });
      s.value = lista.includes(c[k]) ? c[k] : lista[k === 'heroi' ? 0 : Math.min(1, lista.length - 1)];
      s.onchange = () => { this.formas(sel, k); this.salvar(); };
      this.formas(sel, k, c[k + 'Forma']);
      sel(k + 'Forma').onchange = () => this.salvar();
    });
    sel('dificuldade').value = FF.Dificuldade.id();
    sel('dificuldade').onchange = () => { FF.Dificuldade.mudar(sel('dificuldade').value); };
    ['cpuAcao', 'cpuGuarda', 'vida'].forEach(k => { sel(k).value = c[k]; sel(k).onchange = () => this.salvar(); });
    ['kiInf', 'furia'].forEach(k => { sel(k).checked = !!c[k]; sel(k).onchange = () => this.salvar(); });
    // cliques nos controles não podem chegar à tela de título
    box.querySelectorAll('select, input').forEach(x => x.addEventListener('click', (e) => e.stopPropagation()));
    this._sel = sel;
    mostrar('treinar');
  },
  // opções de forma do personagem escolhido (só aparece a escolha se ele tiver mais de uma)
  formas(sel, k, atual) {
    const d = this.defs[sel(k).value], s = sel(k + 'Forma');
    s.innerHTML = '';
    const fs = Object.entries((d && d.formas) || {});
    fs.forEach(([fid, f]) => { const o = document.createElement('option'); o.value = fid; o.textContent = f.nome || fid; s.appendChild(o); });
    s.value = atual && d.formas[atual] ? atual : (d.formaInicial || (fs[0] || [])[0] || '');
    s.disabled = fs.length < 2;
  },
  salvar() {
    const sel = this._sel; if (!sel) return;
    FF.Save.set({ treinoCfg: {
      heroi: sel('heroi').value, cpu: sel('cpu').value, heroiForma: sel('heroiForma').value, cpuForma: sel('cpuForma').value,
      cpuAcao: sel('cpuAcao').value, cpuGuarda: sel('cpuGuarda').value, vida: sel('vida').value, kiInf: sel('kiInf').checked, furia: sel('furia').checked,
    } });
  },
  comecar() {
    this.salvar();
    const c = this.cfg();
    const def = {
      id: 'treino', saga: 'treino', titulo: 'Treinamento', cenario: 'campo', musica: 'tournament_theme', escala: 2.5,
      posicoes: { herois: [170], inimigos: [915] }, herois: [c.heroi], inimigos: [c.cpu],
      formas: { herois: [c.heroiForma || null], inimigos: [c.cpuForma || null] },
      treino: { cpuAcao: c.cpuAcao, cpuGuarda: c.cpuGuarda, vida: c.vida, kiInf: c.kiInf, furia: c.furia },
    };
    try { sessionStorage.setItem('ff_livre_def', JSON.stringify(def)); } catch (e) { /* nada */ }
    FF.Audio.play('battlecall_start01', 0.8);
    FF._iniciarLivre && FF._iniciarLivre(def);
  },
};
