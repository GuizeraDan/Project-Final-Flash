// Modo Treinamento: usa a mesma tela de escolha da Batalha Livre (FF.Selecao no modo "treino": até 3 de cada lado,
// formas) e as opções do treino ficam no menu de pausa (🥋 Opções do treino), mudando na hora:
// CPU ataca (normal / agressivo / só carrega ki / parado), CPU defende (dificuldade / nunca / sempre), vida infinita
// (CPU / os dois / nenhum), dificuldade, ki infinito e fúria cheia do seu time. Guardado em FF.Save "treinoCfg".
// A batalha recebe def.treino (lido em js/battle/battle.js) e não dá AP.
window.FF = window.FF || {};

FF.Treinar = {
  PADRAO: { cpuAcao: 'normal', cpuGuarda: 'dificuldade', vida: 'cpu', kiInf: false, furia: false },
  cfg() { const c = Object.assign({}, this.PADRAO, FF.Save.get().treinoCfg || {}); return { cpuAcao: c.cpuAcao, cpuGuarda: c.cpuGuarda, vida: c.vida, kiInf: !!c.kiInf, furia: !!c.furia }; },
  // título → Treinamento: abre a escolha de lutadores no modo treino
  abrir() { FF.Selecao.abrir('treino'); },
  // painel na pausa: lê e grava direto em FF.battle.def.treino (vale na hora)
  painel(el) {
    const b = FF.battle, t = b && b.def.treino;
    if (!t) return;
    const sel = (k) => el.querySelector('[data-t="' + k + '"]');
    ['cpuAcao', 'cpuGuarda', 'vida'].forEach(k => {
      sel(k).value = t[k];
      sel(k).onchange = () => { t[k] = sel(k).value; this.gravar(t); };
    });
    ['kiInf', 'furia'].forEach(k => {
      sel(k).checked = !!t[k];
      sel(k).onchange = () => { t[k] = sel(k).checked; this.gravar(t); };
    });
    sel('dificuldade').value = FF.Dificuldade.id();
    sel('dificuldade').onchange = () => FF.Dificuldade.mudar(sel('dificuldade').value);
  },
  gravar(t) {
    FF.Save.set({ treinoCfg: { cpuAcao: t.cpuAcao, cpuGuarda: t.cpuGuarda, vida: t.vida, kiInf: t.kiInf, furia: t.furia } });
    // "Lutar de novo" recarrega a definição guardada: leva as opções novas
    try { const d = JSON.parse(sessionStorage.getItem('ff_livre_def') || 'null'); if (d && d.treino) { d.treino = Object.assign({}, t); sessionStorage.setItem('ff_livre_def', JSON.stringify(d)); } } catch (e) { /* nada */ }
    // vida infinita desligada no meio do treino: quem estava "segurado" em 1 continua de pé
    const b = FF.battle;
    if (b && b.planejando) b.all.forEach(f => { if (!f.isHero && f.intencao && t.cpuAcao === 'parado') f.intencao = { icone: '💤', alvo: null }; });
  },
};
