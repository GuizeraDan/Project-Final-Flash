// Elenco da Batalha Livre: lutadores montados a partir dos sprites de personagens do acervo (tools/gerar_elenco.py).
// data/elenco/indice.js → FF_ELENCO_INDICE [{id, nome, n}] · data/elenco/<pacote>.js → FF_ELENCO_DEF(pacote, {nome, personagens: [ficha]})
// A ficha diz quais animações fazem o quê; aqui o "kit" monta o personagem (formas, golpes, vitória, retrato).
// Id do personagem: "el_" + id do sprite (ex.: el_zl3_freeza). Edições do Estúdio (golpes/personagens) valem também.
window.FF = window.FF || {};

window.FF_ELENCO_DEF = function (pac, d) { FF.Elenco._defs[pac] = d; };

FF.Elenco = {
  _defs: {},          // pacote → {nome, personagens}
  _fichas: {},        // id do personagem → ficha
  _esperando: {},
  ajustes: {},        // id do sprite → {escala, dy, espelhar} (aplicado em FF.Assets._loadSprite)
  PREFIXOS: { zl3_: 'zl3', swz_: 'swz', uh_: 'uh', twiss_: 'twiss', spw_: 'spw', ast_: 'ast', mc_: 'mc' },

  eh(id) { return typeof id === 'string' && id.startsWith('el_'); },
  pacoteDe(id) {
    const s = id.slice(3);
    for (const [p, pac] of Object.entries(this.PREFIXOS)) if (s.startsWith(p)) return pac;
    return null;
  },
  indice() {
    if (window.FF_ELENCO_INDICE) return Promise.resolve(window.FF_ELENCO_INDICE);
    if (!this._pInd) this._pInd = FF.Assets.script('data/elenco/indice.js').then(() => window.FF_ELENCO_INDICE || [], () => { this._pInd = null; return []; });
    return this._pInd;
  },
  carregar(pac) {
    if (this._defs[pac] && this._defs[pac]._pronto) return Promise.resolve(this._defs[pac]);
    if (!this._esperando[pac]) {
      this._esperando[pac] = FF.Assets.script('data/elenco/' + pac + '.js').then(() => {
        const d = this._defs[pac];
        if (!d) throw new Error('Elenco vazio: ' + pac);
        d.personagens.forEach(f => {
          this._fichas[f.id] = f;
          this.ajustes[f.sprite] = { escala: f.escala, dy: f.dy, espelhar: f.espelhar };
        });
        d._pronto = true;
        return d;
      }).catch(e => { delete this._esperando[pac]; throw e; });
    }
    return this._esperando[pac];
  },
  async garantir(id) {
    if (this._fichas[id]) return this._fichas[id];
    const pac = this.pacoteDe(id);
    if (!pac) throw new Error('Personagem desconhecido: ' + id);
    await this.carregar(pac);
    if (!this._fichas[id]) throw new Error('Personagem desconhecido: ' + id);
    return this._fichas[id];
  },
  lista(pac) { const d = this._defs[pac]; return d && d._pronto ? d.personagens : []; },
  ficha(id) { return this._fichas[id] || null; },

  // personagem pronto (síncrono; o pacote precisa estar carregado)
  def(id) {
    const f = this._fichas[id];
    if (!f) return null;
    if (!this._cache) this._cache = {};
    if (!this._cache[id]) this._cache[id] = this.montar(f);
    return JSON.parse(JSON.stringify(this._cache[id]));
  },

  // ---------------- o kit ----------------
  montar(f) {
    const A = f.anims || {};
    const parado = A.parado;
    const um = (...ks) => ks.map(k => A[k]).find(Boolean) || parado;
    const anims = {
      parado, dano1: um('dano1'), dano2: um('dano2', 'dano1'), guarda: um('guarda', 'dano1'), lancado: um('lancado', 'dano2', 'dano1'),
      caido: um('caido', 'lancado', 'dano1'), avancar: um('avancar'), recuar: um('recuar', 'avancar'), teleporte: um('teleporte', 'avancar'),
    };
    const golpes = {}, ordem = [];
    const proj = (extra) => Object.assign(f.projetil ? { fx: f.projetil.fx, sprite: f.projetil.sprite } : { fx: 'kiblast_amarelo' }, extra);
    const ir = { irAte: 'alvo', dist: 24, tempo: 0.22, animMov: A.dash || anims.avancar, som: 'jetdash' };
    const voltar = { voltar: true, som: 'teletransporte' };
    const partir = (n, total) => { const out = []; let r = total; for (let i = 0; i < n; i++) { const v = i === n - 1 ? r : Math.round(total / n * 100) / 100; out.push(v); r = Math.round((r - v) * 100) / 100; } return out; };
    // combo: avança, cada animação acerta no quadro mais "esticado", a última lança
    if (f.combo && f.combo.length) {
      const fr = f.combo.length === 1 ? [1] : partir(f.combo.length, 1);
      golpes.combo = {
        nome: 'Sequência de Golpes', tipo: 'corpo', poder: 1.7, descricao: 'Avança e ataca. Aperte no tempo para crítico.',
        roteiro: [ir].concat(f.combo.map(([a, q], i) => ({ anim: a, eventos: [{ quadro: q, acerto: { fracao: fr[i], forca: i === f.combo.length - 1 ? 'forte' : i ? 'media' : 'leve', lanca: i === f.combo.length - 1 } }] })), [voltar]),
      };
      ordem.push('combo');
    }
    if (f.rajada) {
      const [a, q] = f.rajada;
      const tiro = () => ({ anim: a, eventos: [{ quadro: q, projetil: proj({ impacto: 'kiblast_hit', velocidade: 620, som: 'kidan_fire', acerto: { fracao: 0.5, forca: 'energia' } }) }] });
      golpes.rajada = { nome: 'Rajada de Ki', tipo: 'energia', custoKi: 15, poder: 2.0, descricao: 'Dois disparos de ki.', roteiro: [tiro(), tiro()] };
      ordem.push('rajada');
    }
    (f.especiais || []).forEach((e, i) => {
      const k = 'especial' + (i + 1);
      golpes[k] = this.golpeGrande(f, e, false, proj, ir, voltar);
      golpes[k].nome = e.nome || (i ? 'Especial ' + (i + 1) : 'Especial');
      ordem.push(k);
    });
    if (f.carregar && f.carregar.length) {
      const c = f.carregar, r = [];
      if (c.length === 1) r.push({ anim: c[0], duracao: 1.1, loop: true, eventos: [{ quadro: 0, som: 'carregamentodeki_loop' }] });
      else {
        r.push({ anim: c[0], eventos: [{ quadro: 0, som: 'carregamentodeki_start' }] });
        r.push({ anim: c[1], duracao: 1.0, loop: true, eventos: [{ quadro: 0, som: 'carregamentodeki_loop' }] });
        if (c[2]) r.push({ anim: c[2] });
      }
      r.push({ ki: 35 });
      golpes.carregar_ki = { nome: 'Carregar Ki', roteiro: r };
      ordem.push('carregar_ki');
    }
    if (f.supremo && f.supremo.anims && f.supremo.anims.length) {
      golpes.supremo = this.golpeGrande(f, f.supremo, true, proj, ir, voltar);
      golpes.supremo.nome = f.supremo.nome || 'Supremo de ' + f.nome.replace(/\s*\(.*\)|\s*#\d+$/g, '');
      ordem.push('supremo');
    }
    // animações sem fps (ficha.fps): o passo leva um fps próprio
    if (f.fps) Object.values(golpes).forEach(g => g.roteiro.forEach(st => { if (st.anim && f.fps[st.anim] && !st.fps) st.fps = f.fps[st.anim]; }));
    const vit = [{ anim: A.vitoria || parado, duracao: 60 }];
    // escudos: fraqueza sorteada pelo id (fixa para cada personagem)
    let h = 0; for (const ch of f.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return {
      id: f.id, nome: f.nome, formaInicial: 'base', elenco: true,
      atributos: { hp: 1200, ataque: 100, defesa: 60, kiMax: 100, kiInicial: 30, kiPorTurno: 8, velocidade: 9 + (h % 4) },
      vozes: {},
      escudos: { n: 3, fraquezas: [h % 2 ? 'corpo' : 'energia'] },
      formas: { base: { nome: f.nome, sprite: f.sprite, anims, golpes: ordem, vitoria: vit, retrato: f.retrato || null } },
      golpes,
    };
  },

  // especial / supremo: energia = poses + disparo grande no quadro mais esticado da última; corpo = avança e acerta
  golpeGrande(f, e, supremo, proj, ir, voltar) {
    const lista = e.anims;
    const g = { tipo: e.tipo === 'corpo' ? 'corpo' : 'energia', poder: supremo ? 4.5 : 2.8, descricao: supremo ? 'SUPREMO.' : '' };
    if (supremo) g.supremo = true; else g.custoKi = e.tipo === 'corpo' ? 25 : 30;
    const ult = lista.length - 1;
    if (g.tipo === 'corpo') {
      const fr = partir(lista.length);
      g.roteiro = [ir].concat(lista.map(([a, q], i) => ({ anim: a, eventos: [{ quadro: 0, som: i ? 'jetdash' : 'kidan_chrg' }, { quadro: q, acerto: { fracao: fr[i], forca: i === ult ? 'forte' : 'media', lanca: i === ult } }].concat(i === ult && supremo ? [{ quadro: q, flash: 0.5 }, { quadro: q, tremer: 10 }, { quadro: q, efeito: { fx: 'Explosao15', em: 'alvo', escala: 0.9 } }] : []) })), [voltar]);
      return g;
    }
    g.roteiro = lista.map(([a, q], i) => {
      const ev = [];
      if (i === 0) ev.push({ quadro: 0, som: 'kidan_chrg' }, { quadro: 0, tremer: supremo ? 5 : 3 });
      if (i === ult) {
        ev.push({ quadro: q, som: supremo ? 'goku_kamehame_fire' : 'kidan_fire' }, { quadro: q, tremer: supremo ? 10 : 6 });
        if (supremo) ev.push({ quadro: q, flash: 0.45 });
        ev.push({ quadro: q, projetil: proj({ escala: supremo ? 2.8 : 1.7, velocidade: supremo ? 820 : 760, impacto: supremo ? 'Explosao15' : 'Explosao4', impactoEscala: supremo ? 0.9 : 0.7, acerto: { fracao: 1, forca: 'energia', lanca: true, empurrao: supremo ? 650 : 0 } }) });
      }
      return { anim: a, eventos: ev };
    });
    return g;

    function partir(n) { const out = []; let r = 1; for (let i = 0; i < n; i++) { const v = i === n - 1 ? Math.round(r * 100) / 100 : Math.round(100 / n) / 100; out.push(v); r -= v; } return out; }
  },
};
