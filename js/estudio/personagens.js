// Estúdio Final Flash — aba "Personagens": atributos, formas (sprite, animações básicas, vozes, retrato,
// lista e ordem dos golpes no menu), buffs (tinta + aura), IA e criação de personagens novos a partir de
// qualquer sprite. Salva em FF.Edicoes seção personagens[id] (campos de topo que substituem os do JSON,
// ou {novo: true, def} para personagem criado aqui). Os golpes em si são editados na aba Golpes.
(function () {
  const E = () => FF.Estudio;
  const CAMPOS = ['nome', 'formaInicial', 'atributos', 'vozes', 'formas', 'buffs', 'ia'];
  const ATRIBUTOS = [['hp', 'Vida (HP)'], ['ataque', 'Ataque'], ['defesa', 'Defesa'], ['kiMax', 'Ki máximo'], ['kiInicial', 'Ki inicial'], ['kiPorTurno', 'Ki por turno'], ['velocidade', 'Velocidade']];
  const ANIMS = [['parado', 'Parado'], ['dano1', 'Dano 1'], ['dano2', 'Dano 2'], ['guarda', 'Guarda'], ['lancado', 'Lançado'], ['caido', 'Caído'], ['avancar', 'Avançar'], ['recuar', 'Recuar'], ['teleporte', 'Teleporte']];
  const MULTS = [['ataque', 'Ataque ×'], ['defesa', 'Defesa ×'], ['velocidade', 'Velocidade ×']];
  const ORDEM = ['goku', 'piccolo', 'krillin', 'raditz', 'saibaman', 'nappa', 'vegeta'];
  const NAO_LUTADOR = /^(fx|fx_extra|hud_zl3|retratos|cenarios_preview|stage_)/;
  // nomes parecidos para o mapeamento automático: [nomes exatos], regex
  const AUTO = {
    parado: [['Parado', 'Idle', 'Stand'], /parado|idle|stand/i],
    dano1: [['Dano_Chao1', 'Dano1', 'Hit1'], /dano|hit|damage/i],
    dano2: [['Dano_Chao2', 'Dano2', 'Hit2'], /dano.*2|hit.*2|damage.*2/i],
    guarda: [['Defesa_Chao', 'Guarda', 'Defesa', 'Block'], /defesa|guarda|block|guard/i],
    lancado: [['SendoLancado_LADO', 'Lancado'], /lancado|lançado|knock|thrown/i],
    caido: [['Caido', 'Down', 'KO'], /caido|caído|down|\bko\b/i],
    avancar: [['MovimentoParaFrente', 'Avancar', 'Dash', 'Walk'], /frente|avan|dash|walk|run/i],
    recuar: [['MovimentoParaTras', 'Recuar', 'Back'], /tras|trás|recu|back/i],
    teleporte: [['Teletransporte_Chao', 'Teleporte', 'Teleport'], /teletransporte|teleport/i],
  };

  const P = {
    id: 'personagens', nome: 'Personagens', icone: '🧑',
    ids: [], defs: {}, salvo: {}, hist: {}, docs: {},
    pid: null, doc: null, sub: 'atributos', formaSel: null, buffSel: null,
    animSel: 'parado', buffPrev: '', fundo: 'campo', oponente: 'raditz',
    get historico() { return this.pid ? this.hist[this.pid] : null; },

    // ---------- montagem ----------
    async montar(el) {
      this.el = el;
      el.innerHTML = '';
      const esq = E().el('div', 'es-lado ep-lista-lado');
      const tit = E().el('div', 'es-titulo', 'Personagens');
      tit.appendChild(E().botao('＋ Novo', () => this.dialogoNovo(), 'Criar personagem a partir de um sprite', 'es-mais es-bt-ouro'));
      this.lista = E().el('div', 'es-rolar es-lista ep-lista');
      esq.append(tit, this.lista);

      const centro = E().el('div', 'es-centro');
      this.barra = E().el('div', 'es-barra ep-barra');
      this.palco = E().el('div', 'es-palco-wrap ep-palco');
      this.cv = document.createElement('canvas');
      this.cv.width = 480; this.cv.height = 300;
      this.palco.appendChild(this.cv);
      this.info = E().el('div', 'es-palco-info');
      this.palco.appendChild(this.info);
      centro.append(this.barra, this.palco);

      const dir = E().el('div', 'es-lado dir ep-dir');
      this.cab = E().el('div', 'ep-cab');
      this.subAbas = E().el('div', 'ep-subabas');
      this.painel = E().el('div', 'es-rolar ep-painel');
      this.rodape = E().el('div', 'es-barra ep-rodape');
      dir.append(this.cab, this.subAbas, this.painel, this.rodape);
      el.append(esq, centro, dir);

      this.oponente = E().rascunho.ler('pers_oponente') || 'raditz';
      await this.carregarLista();
      const ult = E().rascunho.ler('pers_sel');
      await this.selecionar(this.ids.includes(ult) ? ult : this.ids[0]);
    },

    async carregarLista() {
      const ids = FF.Assets.listaPersonagens().slice();
      ids.sort((a, b) => ((ORDEM.indexOf(a) + 1) || 99) - ((ORDEM.indexOf(b) + 1) || 99));
      this.ids = [];
      for (const id of ids) {
        try { this.defs[id] = await FF.Assets.loadCharacter(id); this.ids.push(id); }
        catch (e) { console.log('[Estúdio] personagem não carregou:', id, e.message); }
      }
      this.renderLista();
    },

    edicao(id) { return (FF.Edicoes.dados().personagens || {})[id] || null; },
    ehNovo(id) { const e = this.edicao(id); return !!(e && e.novo); },

    renderLista() {
      this.lista.innerHTML = '';
      for (const id of this.ids) {
        const d = this.defs[id];
        const it = E().el('div', 'es-item ep-item' + (id === this.pid ? ' sel' : ''));
        it.dataset.id = id;
        const cv = document.createElement('canvas'); cv.width = 30; cv.height = 42;
        const n = E().el('span', 'ep-nome'); n.textContent = (id === this.pid && this.doc ? this.doc.nome : d.nome) || id;
        it.append(cv, n);
        const ed = this.edicao(id);
        if (ed && ed.novo) it.appendChild(E().el('span', 'tag', '⭐'));
        else if (ed) it.appendChild(E().el('span', 'tag alt', '✎'));
        if (this.sujo(id)) it.appendChild(E().el('span', 'tag ep-sujo', '•'));
        const s = E().el('small'); s.textContent = id; it.appendChild(s);
        it.title = ed && ed.novo ? 'Criado no Estúdio' : ed ? 'Alterado no Estúdio' : 'Original';
        it.onclick = () => this.selecionar(id);
        this.lista.appendChild(it);
        const dd = id === this.pid && this.doc ? this.doc : d;
        FF.Retrato.noCanvas(cv, dd, dd.formaInicial, 'retrato').catch(() => null);
      }
    },

    // documento editável: só os campos de topo (original) ou a definição inteira (novo)
    docDe(id) {
      if (this.ehNovo(id)) return E().copia(this.edicao(id).def);
      const d = this.defs[id], o = {};
      CAMPOS.forEach(k => { if (d[k] !== undefined) o[k] = E().copia(d[k]); });
      return o;
    },
    sujo(id) {
      const doc = id === this.pid ? this.doc : this.docs[id];
      return !!(doc && this.salvo[id] && JSON.stringify(this.limpo(doc)) !== this.salvo[id]);
    },
    // cópia sem objetos vazios e sem null (os painéis criam {} vazios ao mostrar os campos)
    limpo(o) {
      if (Array.isArray(o)) return o.map(x => this.limpo(x));
      if (!o || typeof o !== 'object') return o;
      const r = {};
      for (const [k, v] of Object.entries(o)) {
        if (v === null || v === undefined) continue;
        const c = this.limpo(v);
        if (c && typeof c === 'object' && !Array.isArray(c) && !Object.keys(c).length) continue;
        r[k] = c;
      }
      return r;
    },

    async selecionar(id) {
      if (!id) { this.painel.innerHTML = '<p class="es-vazio">Nenhum personagem.</p>'; return; }
      if (this.pid && this.doc) this.docs[this.pid] = this.doc;
      this.pid = id;
      E().rascunho.gravar('pers_sel', id);
      if (!this.docs[id]) {
        const base = this.docDe(id);
        this.salvo[id] = JSON.stringify(this.limpo(base));
        const r = E().rascunho.ler('pers_' + id);
        if (r && r.formas && JSON.stringify(this.limpo(r)) !== this.salvo[id]) { this.docs[id] = r; E().aviso('Rascunho não salvo de ' + (base.nome || id) + ' recuperado.'); }
        else this.docs[id] = base;
      }
      this.doc = this.docs[id];
      if (!this.hist[id]) {
        this.hist[id] = new (E().Historico)(() => this.doc, (s) => { this.doc = this.docs[this.pid] = s; this.depoisDeMudar(true); });
        this.hist[id].zerar('Abrir');
      }
      this.formaSel = this.doc.formas && this.doc.formas[this.formaSel] ? this.formaSel : (this.doc.formaInicial || Object.keys(this.doc.formas || {})[0]);
      this.buffSel = null; this.buffPrev = '';
      await this.carregarSprites();
      this.renderLista();
      this.renderTudo();
      E().renderHist();
    },

    async carregarSprites() {
      const ids = new Set(Object.values(this.doc.formas || {}).map(f => f.sprite).filter(Boolean));
      await Promise.all([...ids].map(s => FF.Assets.loadSprite(s).catch(() => null)));
    },

    // ---------- mudanças ----------
    mudar(rotulo, juntar) {
      this.hist[this.pid].marcar(rotulo, juntar);
      this.depoisDeMudar(false);
    },
    depoisDeMudar(reconstruir) {
      E().rascunho.gravar('pers_' + this.pid, this.sujo(this.pid) ? this.doc : null);
      if (reconstruir) this.renderTudo(); else { this.renderCab(); this.renderRodape(); this.renderBarra(); }
      this._prev = null;
      clearTimeout(this._tLista);
      this._tLista = setTimeout(() => this.renderLista(), 250);
    },

    // campo ligado a obj[chave]
    cp(obj, chave, tipo, rotulo, opts = {}) {
      return E().campo(tipo, rotulo, obj[chave], (v, juntar) => {
        if (v === undefined || (tipo === 'numero' && isNaN(v))) delete obj[chave]; else obj[chave] = v;
        this.mudar(rotulo, juntar);
        if (opts.depois) opts.depois(v);
      }, opts);
    },

    forma() { return (this.doc.formas || {})[this.formaSel]; },
    golpesDisp(comHab) {
      const g = Object.assign({}, this.ehNovo(this.pid) ? (this.doc.golpes || {}) : (this.defs[this.pid].golpes || {}));
      // ⭐ habilidades criadas no Estúdio para este personagem (no jogo viram golpes "hab_<id>")
      if (comHab && FF.Habilidades) FF.Habilidades.listar(this.pid).forEach(h => { g['hab_' + h.id] = Object.assign({}, h.golpe, { nome: '⭐ ' + (h.nome || h.golpe.nome || h.id) + (h.equipada ? '' : ' (desligada)') }); });
      return g;
    },
    animsDoSprite(spriteId, forma) {
      const s = FF.Assets.sprites[spriteId];
      const l = s ? Object.keys(s.def.anims) : [];
      Object.keys((forma && forma.animsDerivadas) || {}).forEach(n => { if (!l.includes(n)) l.push(n); });
      return l;
    },
    // sprite com as animações derivadas da forma (sem mexer no sprite carregado)
    setDaForma(f) {
      const s = f && FF.Assets.sprites[f.sprite];
      if (!s) return null;
      const der = f.animsDerivadas || {};
      if (!Object.keys(der).length) return s;
      const anims = Object.assign({}, s.def.anims);
      for (const [nome, d] of Object.entries(der)) {
        if (anims[nome] || !d || !anims[d.de]) continue;
        const src = anims[d.de];
        anims[nome] = { fps: d.fps || 0, loop: !!d.loop, repeatTo: 0, pingpong: false, frames: (d.quadros || [0]).map(i => src.frames[Math.min(i, src.frames.length - 1)]) };
      }
      return new FF.SpriteSet(Object.assign({}, s.def, { anims }), s.images);
    },
    fxSet(nome) {
      for (const id of ['fx', 'fx_extra']) { const s = FF.Assets.sprites[id]; if (s && s.has(nome)) return s; }
      return null;
    },

    // ---------- render ----------
    renderTudo() { this.renderCab(); this.renderSubAbas(); this.renderPainel(); this.renderRodape(); this.renderBarra(); this._prev = null; },

    renderCab() {
      const novo = this.ehNovo(this.pid), ed = this.edicao(this.pid);
      this.cab.innerHTML = '';
      const t = E().el('div', 'ep-cab-nome');
      t.textContent = (this.doc.nome || this.pid) + ' ';
      const s = E().el('small'); s.textContent = novo ? '⭐ criado no Estúdio' : ed ? '✎ alterado' : 'original'; t.appendChild(s);
      if (this.sujo(this.pid)) { const u = E().el('span', 'ep-naosalvo', '● não salvo'); t.appendChild(u); }
      this.cab.appendChild(t);
    },

    renderSubAbas() {
      this.subAbas.innerHTML = '';
      [['atributos', 'Atributos'], ['formas', 'Formas'], ['buffs', 'Buffs'], ['ia', 'IA']].forEach(([k, n]) => {
        const b = E().botao(n, () => { this.sub = k; this.renderSubAbas(); this.renderPainel(); }, null, this.sub === k ? 'sel' : '');
        b.dataset.sub = k;
        this.subAbas.appendChild(b);
      });
    },

    renderPainel() {
      const top = this.painel.scrollTop;
      this.painel.innerHTML = '';
      if (!this.doc) return;
      ({ atributos: () => this.pAtributos(), formas: () => this.pFormas(), buffs: () => this.pBuffs(), ia: () => this.pIA() })[this.sub]();
      this.painel.scrollTop = top;
    },

    renderRodape() {
      this.rodape.innerHTML = '';
      const sv = E().botao('💾 Salvar no jogo', () => this.salvar(), 'Vale no jogo todo (e em todos os aparelhos com o ☁)', 'es-bt-ouro');
      sv.dataset.ep = 'salvar';
      this.rodape.appendChild(sv);
      if (this.ehNovo(this.pid)) {
        this.rodape.appendChild(E().botao('🗑 Apagar', () => this.apagarNovo(), 'Apagar este personagem criado no Estúdio', 'es-bt-perigo'));
      } else {
        const o = E().botao('↺ Original', () => this.original(), 'Volta ao personagem original do jogo');
        o.disabled = !this.edicao(this.pid) && !this.sujo(this.pid);
        this.rodape.appendChild(o);
      }
      this.rodape.appendChild(E().botao('⧉', () => this.dialogoNovo(this.pid), 'Duplicar como personagem novo'));
      this.rodape.appendChild(E().botao('{ }', () => this.verJSON(), 'Ver/colar o JSON do personagem'));
    },

    renderBarra() {
      const b = this.barra;
      b.innerHTML = '';
      const f = this.forma() || {};
      const lAnim = ANIMS.map(a => [a[0], a[1]]).concat([['vitoria', 'Vitória']]);
      const sa = E().campo('select', 'Anim', this.animSel, (v) => { this.animSel = v; this._prev = null; }, { lista: lAnim });
      const fs = E().campo('select', 'Forma', this.formaSel, (v) => { this.formaSel = v; this._prev = null; if (this.sub === 'formas') this.renderPainel(); }, { lista: Object.entries(this.doc.formas || {}).map(([k, x]) => [k, x.nome || k]) });
      const bs = E().campo('select', 'Buff', this.buffPrev, (v) => { this.buffPrev = v; this._prev = null; }, { lista: [['', '(nenhum)']].concat(Object.entries(this.doc.buffs || {}).map(([k, x]) => [k, x.nome || k])) });
      const fu = E().campo('select', 'Fundo', this.fundo, (v) => { this.fundo = v; }, { lista: [['campo', 'Campo'], ['escuro', 'Escuro']] });
      [sa, fs, bs, fu].forEach(c => { c.classList.add('ep-mini'); b.appendChild(c); });
      b.appendChild(E().el('span', 'sep'));
      const op = E().campo('select', 'contra', this.oponente, (v) => { this.oponente = v; E().rascunho.gravar('pers_oponente', v); }, { lista: this.ids.map(i => [i, (this.defs[i] || {}).nome || i]) });
      op.classList.add('ep-mini');
      b.appendChild(op);
      const t = E().botao('▶ Testar na Batalha Livre', () => this.testar(), 'Abre uma Batalha Livre em outra aba (usa a versão salva)', 'es-bt-ouro');
      t.dataset.ep = 'testar';
      b.appendChild(t);
      void f;
    },

    // ---------- Atributos ----------
    pAtributos() {
      const d = this.doc;
      const g = E().grupo('Geral');
      g.appendChild(this.cp(d, 'nome', 'texto', 'Nome', { depois: () => this.renderLista() }));
      g.appendChild(E().campo('select', 'Forma inicial', d.formaInicial, (v) => { d.formaInicial = v; this.mudar('Forma inicial'); }, { lista: Object.entries(d.formas || {}).map(([k, f]) => [k, (f.nome || k) + ' (' + k + ')']) }));
      g.appendChild(E().el('p', 'es-dica', 'id: <b>' + this.pid + '</b>'));
      this.painel.appendChild(g);
      const a = E().grupo('Atributos');
      d.atributos = d.atributos || {};
      ATRIBUTOS.forEach(([k, n]) => {
        const c = this.cp(d.atributos, k, 'numero', n, { min: 0, passo: 1 });
        c._inp.dataset.atr = k;
        a.appendChild(c);
      });
      a.appendChild(E().el('p', 'es-dica', 'Velocidade decide a ordem dos turnos. Ki por turno pode ser trocado por forma.'));
      this.painel.appendChild(a);
      const v = E().grupo('Vozes (todas as formas)');
      d.vozes = d.vozes || {};
      const pre = this.prefixoVoz();
      v.appendChild(this.cp(d.vozes, 'dano', 'som', 'Dano', { vozes: pre, dica: 'Uma ou várias (separadas por vírgula): sorteia uma' }));
      v.appendChild(this.cp(d.vozes, 'lancado', 'som', 'Lançado', { vozes: pre }));
      v.appendChild(E().el('p', 'es-dica', 'Uma forma pode ter vozes próprias (aba Formas).'));
      this.painel.appendChild(v);
    },
    prefixoVoz() {
      const v = (this.doc.vozes || {}).dano;
      const s = Array.isArray(v) ? v[0] : v;
      return s ? s.replace(/\d+$/, '').replace(/_\w*$/, '') : '';
    },

    // ---------- Formas ----------
    pFormas() {
      const d = this.doc;
      d.formas = d.formas || {};
      const topo = E().el('div', 'ep-linha');
      const sel = E().campo('select', 'Forma', this.formaSel, (v) => { this.formaSel = v; this._prev = null; this.renderBarra(); this.renderPainel(); }, { lista: Object.entries(d.formas).map(([k, f]) => [k, (f.nome || k) + ' (' + k + ')']) });
      sel.classList.add('ep-cresce');
      topo.append(sel,
        E().botao('＋', () => this.novaForma(false), 'Nova forma'),
        E().botao('⧉', () => this.novaForma(true), 'Duplicar forma'),
        E().botao('🗑', () => this.apagarForma(), 'Apagar forma', 'es-bt-perigo'));
      this.painel.appendChild(topo);
      const f = this.forma();
      if (!f) return;
      const fid = this.formaSel;

      const g = E().grupo('Forma "' + fid + '"');
      g.appendChild(this.cp(f, 'nome', 'texto', 'Nome', { depois: () => this.renderBarra() }));
      const sprites = FF.Assets.listaSprites().filter(s => !NAO_LUTADOR.test(s) && ['jogo', 'personagens'].includes(FF.Assets.tipoSprite(s)));
      if (f.sprite && !sprites.includes(f.sprite)) sprites.unshift(f.sprite);
      g.appendChild(E().campo('select', 'Sprite', f.sprite, async (v) => {
        f.sprite = v;
        await FF.Assets.loadSprite(v).catch(() => null);
        this.mudar('Sprite da forma');
        this.renderPainel();
      }, { lista: sprites.map(s => [s, FF.Assets.doAcervo(s) ? FF.Assets.nomeSprite(s) + ' · ' + s : s]) }));
      g.appendChild(this.cp(f, 'kiPorTurno', 'numero', 'Ki por turno', { passo: 1, dica: 'Vazio = usa o do personagem' }));
      f.multiplicadores = f.multiplicadores || {};
      MULTS.forEach(([k, n]) => g.appendChild(this.cp(f.multiplicadores, k, 'numero', n, { passo: 0.05, min: 0, placeholder: '1', dica: 'Multiplica o atributo nesta forma. Vazio = 1' })));
      this.painel.appendChild(g);

      // animações básicas
      const ga = E().grupo('Animações básicas');
      const lista = [['', '(não tem)']].concat(this.animsDoSprite(f.sprite, f));
      const set = this.setDaForma(f);
      f.anims = f.anims || {};
      ANIMS.forEach(([k, n]) => {
        const c = E().campo('select', n, f.anims[k] || '', (v) => { if (v) f.anims[k] = v; else delete f.anims[k]; this.mudar('Animação ' + n); mini(); this.animSel = k; this._prev = null; this.renderBarra(); }, { lista });
        c._inp.dataset.anim = k;
        const cv = document.createElement('canvas'); cv.width = 34; cv.height = 34; cv.className = 'ep-minianim';
        const mini = () => E().miniatura(cv, set, f.anims[k], 0);
        mini();
        cv.title = 'Ver na prévia';
        cv.onclick = (e) => { e.preventDefault(); this.animSel = k; this._prev = null; this.renderBarra(); };
        c.appendChild(cv);
        ga.appendChild(c);
      });
      ga.appendChild(E().botao('✨ Mapear automaticamente', () => { f.anims = this.mapearAnims(f.sprite, f); this.mudar('Mapear animações'); this.renderPainel(); }, 'Escolhe pelas animações de nome parecido (parado/idle, dano/hit, defesa/block…)'));
      this.painel.appendChild(ga);

      // pose de vitória (passos em sequência; o último com duração longa fica parado no fim da luta)
      const gvit = E().grupo('Pose de vitória', false);
      const passos = Array.isArray(f.vitoria) ? f.vitoria : [];
      const V = () => (Array.isArray(f.vitoria) ? f.vitoria : (f.vitoria = []));
      passos.forEach((p, i) => {
        const box = E().el('div', 'ep-vit');
        box.appendChild(E().el('div', 'es-dica', '<b>Passo ' + (i + 1) + '</b>'));
        box.appendChild(E().campo('select', 'Animação', p.anim || '', (v) => { p.anim = v; this.mudar('Vitória: animação'); this.animSel = 'vitoria'; this._prev = null; this.renderBarra(); }, { lista }));
        box.appendChild(E().campo('numero', 'Duração (s)', p.duracao, (v, j) => { if (v > 0) p.duracao = v; else delete p.duracao; this.mudar('Vitória: duração', j); }, { passo: 0.1, min: 0, placeholder: 'uma vez', dica: 'Vazio = toca a animação uma vez. No último passo, use um tempo grande (ex.: 60) para ficar parado na pose.' }));
        const ev = (p.eventos || []).find(e => e.quadro === 0 && (e.voz || e.som)) || null;
        box.appendChild(E().campo('som', 'Voz/som', ev ? (ev.voz || ev.som) : '', (v) => {
          p.eventos = (p.eventos || []).filter(e => !(e.quadro === 0 && (e.voz || e.som)));
          if (v && (Array.isArray(v) ? v.length : String(v).trim())) p.eventos.unshift({ quadro: 0, [/^v[a-z]{3}\d|_voice|_victory/.test(Array.isArray(v) ? v[0] : v) ? 'voz' : 'som']: v });
          if (!p.eventos.length) delete p.eventos;
          this.mudar('Vitória: som');
        }, { vozes: this.prefixoVoz() }));
        const bts = E().el('div', 'ep-linha');
        if (i > 0) bts.appendChild(E().botao('↑', () => { V().splice(i - 1, 0, V().splice(i, 1)[0]); this.mudar('Vitória: ordem'); this.renderPainel(); }, 'Subir'));
        bts.appendChild(E().botao('✕ Tirar', () => { V().splice(i, 1); this.mudar('Vitória: tirar passo'); this.renderPainel(); }, null, 'es-bt-perigo'));
        box.appendChild(bts);
        gvit.appendChild(box);
      });
      const bv = E().el('div', 'ep-linha');
      bv.append(
        E().botao('＋ Passo', () => { V().push({ anim: (f.anims && f.anims.parado) || this.animsDoSprite(f.sprite, f)[0] || '', duracao: 60 }); this.mudar('Vitória: novo passo'); this.renderPainel(); }, 'Acrescenta uma animação no fim da pose'),
        E().botao('▶ Ver', () => { this.animSel = 'vitoria'; this._prev = null; this.renderBarra(); }, 'Mostra a pose de vitória na prévia'));
      gvit.appendChild(bv);
      if (!passos.length) gvit.appendChild(E().el('p', 'es-dica', 'Sem pose de vitória: fica na animação parada.'));
      this.painel.appendChild(gvit);

      // vozes da forma
      const gv = E().grupo('Vozes da forma', false);
      f.vozes = f.vozes || {};
      gv.appendChild(this.cp(f.vozes, 'dano', 'som', 'Dano', { vozes: this.prefixoVoz() }));
      gv.appendChild(this.cp(f.vozes, 'lancado', 'som', 'Lançado', { vozes: this.prefixoVoz() }));
      gv.appendChild(E().el('p', 'es-dica', 'Vazio = usa as vozes do personagem.'));
      this.painel.appendChild(gv);

      // retrato
      const gr = E().grupo('Retrato', false);
      const rr = E().el('div', 'ep-retrato');
      const c1 = document.createElement('canvas'); c1.width = 40; c1.height = 56;
      const c2 = document.createElement('canvas'); c2.width = 134; c2.height = 80;
      const tmp = { formas: { x: f }, formaInicial: 'x' };
      FF.Retrato.noCanvas(c1, tmp, 'x', 'retrato').catch(() => null);
      FF.Retrato.noCanvas(c2, tmp, 'x', 'banner').catch(() => null);
      const bts = E().el('div', 'ep-col');
      bts.append(E().botao('🖼 Escolher arte…', () => this.escolherRetrato(f)),
        E().botao('Gerado do sprite', () => { delete f.retrato; this.mudar('Retrato gerado'); this.renderPainel(); }, 'Desenha o rosto a partir do sprite de batalha'));
      const info = E().el('small', 'es-dica'); info.textContent = f.retrato ? 'rosto #' + f.retrato.quadro + ' · banner #' + f.retrato.banner : 'gerado do sprite';
      bts.appendChild(info);
      rr.append(c1, c2, bts);
      gr.appendChild(rr);
      this.painel.appendChild(gr);

      // golpes do menu
      const gg = E().grupo('Golpes no menu (ordem)');
      gg.appendChild(this.listaGolpes(f));
      this.painel.appendChild(gg);

      // avançado
      const gj = E().grupo('Avançado (JSON)', false);
      gj.appendChild(this.cp(f, 'animsDerivadas', 'json', 'Anims derivadas', { linhas: 4, dica: '{"Parado": {"de": "Ataque_1", "quadros": [0, 1], "fps": 4, "loop": true}} — para sprites sem parado/dano', depois: () => this.renderPainel() }));
      gj.appendChild(this.cp(f, 'reverter', 'json', 'Reverter', { linhas: 4, dica: 'Roteiro quando o ki acaba (formas transformadas)' }));
      gj.appendChild(this.cp(f, "vitoria", "json", "Vitória (JSON)", { linhas: 5, dica: "O mesmo da Pose de vitória, em JSON (aceita eventos extras)", depois: () => this.renderPainel() }));
      this.painel.appendChild(gj);
    },

    listaGolpes(f) {
      f.golpes = f.golpes || [];
      const disp = this.golpesDisp();
      const box = E().el('div', 'ep-golpes');
      const ul = E().el('div', 'ep-golpes-lista');
      f.golpes.forEach((gid, i) => {
        const r = E().el('div', 'ep-golpe' + (disp[gid] ? '' : ' falta'));
        r.draggable = true;
        r.dataset.golpe = gid;
        const n = E().el('span'); n.textContent = (i + 1) + '. ' + ((disp[gid] && disp[gid].nome) || gid) + (disp[gid] ? '' : ' (não existe)');
        n.title = gid;
        r.appendChild(E().el('span', 'ep-alca', '⠿'));
        r.appendChild(n);
        const mover = (j) => { if (j < 0 || j >= f.golpes.length) return; const [x] = f.golpes.splice(i, 1); f.golpes.splice(j, 0, x); this.mudar('Ordem dos golpes'); this.renderPainel(); };
        const up = E().botao('↑', () => mover(i - 1), 'Subir'); up.disabled = i === 0;
        const dn = E().botao('↓', () => mover(i + 1), 'Descer'); dn.disabled = i === f.golpes.length - 1;
        r.append(up, dn, E().botao('✕', () => { f.golpes.splice(i, 1); this.mudar('Tirar golpe do menu'); this.renderPainel(); }, 'Tirar do menu'));
        r.ondragstart = (e) => { e.dataTransfer.setData('text/plain', String(i)); r.classList.add('arrastando'); };
        r.ondragend = () => r.classList.remove('arrastando');
        r.ondragover = (e) => { e.preventDefault(); r.classList.add('alvo'); };
        r.ondragleave = () => r.classList.remove('alvo');
        r.ondrop = (e) => { e.preventDefault(); const de = +e.dataTransfer.getData('text/plain'); if (!isNaN(de) && de !== i) { const [x] = f.golpes.splice(de, 1); f.golpes.splice(i, 0, x); this.mudar('Ordem dos golpes'); this.renderPainel(); } };
        ul.appendChild(r);
      });
      if (!f.golpes.length) ul.appendChild(E().el('p', 'es-dica', 'Nenhum golpe no menu: o lutador não terá o que fazer.'));
      box.appendChild(ul);
      const fora = Object.keys(disp).filter(g => !f.golpes.includes(g));
      if (fora.length) {
        const add = E().campo('select', 'Pôr golpe', '', (v) => { if (!v) return; f.golpes.push(v); this.mudar('Pôr golpe no menu'); this.renderPainel(); }, { lista: [['', '— escolher —']].concat(fora.map(g => [g, (disp[g].nome || g) + ' (' + g + ')'])) });
        add._inp.dataset.ep = 'porgolpe';
        box.appendChild(add);
      }
      box.appendChild(E().el('p', 'es-dica', 'Arraste ou use ↑↓. O conteúdo dos golpes é editado na aba Golpes.'));
      return box;
    },

    async novaForma(duplicar) {
      const base = this.forma();
      const nome = await E().perguntar(duplicar ? 'Duplicar forma' : 'Nova forma', 'Nome da forma (ex.: Super Saiyajin):', duplicar && base ? (base.nome || '') + ' 2' : '');
      if (!nome) return;
      let id = E().idSeguro(nome);
      while (this.doc.formas[id]) id += '_2';
      const f = duplicar && base ? E().copia(base) : { nome, sprite: base ? base.sprite : 'gokubase', anims: base ? E().copia(base.anims) : {}, golpes: base ? base.golpes.slice() : [] };
      f.nome = nome;
      if (duplicar) delete f.reverter;
      this.doc.formas[id] = f;
      this.formaSel = id;
      this.mudar(duplicar ? 'Duplicar forma' : 'Nova forma');
      this.renderTudo();
      E().aviso('Forma "' + id + '" criada. Para o lutador chegar nela, um golpe precisa ter {"transformar": "' + id + '"} (aba Golpes).');
    },
    async apagarForma() {
      const ks = Object.keys(this.doc.formas);
      if (ks.length < 2) return E().aviso('O personagem precisa de pelo menos uma forma.', 'erro');
      if (!(await E().confirmar('Apagar forma', 'Apagar a forma "' + this.formaSel + '"?', '🗑 Apagar', true))) return;
      delete this.doc.formas[this.formaSel];
      if (!this.doc.formas[this.doc.formaInicial]) this.doc.formaInicial = Object.keys(this.doc.formas)[0];
      this.formaSel = this.doc.formaInicial;
      this.mudar('Apagar forma');
      this.renderTudo();
    },

    escolherRetrato(f) {
      const set = FF.Assets.sprites.retratos;
      if (!set) return E().aviso('Sprite de retratos não carregou.', 'erro');
      const c = E().el('div', 'ep-ret-escolha');
      const r = f.retrato ? E().copia(f.retrato) : { quadro: 0, banner: 0 };
      const sec = (tipo, titulo) => {
        c.appendChild(E().el('div', 'es-titulo', titulo));
        const g = E().el('div', 'es-grade ep-ret-grade' + (tipo === 'banner' ? ' banner' : ''));
        set.anim(tipo).frames.forEach((q, i) => {
          const k = E().el('div', 'es-cartao' + (r[tipo === 'banner' ? 'banner' : 'quadro'] === i && f.retrato ? ' sel' : ''));
          const cv = document.createElement('canvas'); cv.width = tipo === 'banner' ? 96 : 60; cv.height = tipo === 'banner' ? 110 : 80;
          E().miniatura(cv, set, tipo, i, { max: 3 });
          const s = E().el('span'); s.textContent = '#' + i;
          k.append(cv, s);
          k.onclick = () => { r[tipo === 'banner' ? 'banner' : 'quadro'] = i; g.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); k.classList.add('sel'); };
          g.appendChild(k);
        });
        c.appendChild(g);
      };
      sec('retrato', 'Rosto (seleção)');
      sec('banner', 'Banner (time)');
      const ok = E().botao('Usar estes', () => { f.retrato = r; this.mudar('Retrato'); m.fechar(); this.renderPainel(); this.renderLista(); }, null, 'es-bt-ouro');
      const bar = E().el('div', 'ep-linha'); bar.appendChild(ok);
      c.appendChild(bar);
      const m = E().modal('🖼 Retrato de "' + (f.nome || this.formaSel) + '"', c, { larga: true });
    },

    // ---------- Buffs ----------
    pBuffs() {
      const d = this.doc;
      d.buffs = d.buffs || {};
      const ks = Object.keys(d.buffs);
      if (!d.buffs[this.buffSel]) this.buffSel = ks[0] || null;
      const topo = E().el('div', 'ep-linha');
      const sel = E().campo('select', 'Buff', this.buffSel || '', (v) => { this.buffSel = v; this.buffPrev = v; this._prev = null; this.renderBarra(); this.renderPainel(); }, { lista: ks.length ? ks.map(k => [k, (d.buffs[k].nome || k) + ' (' + k + ')']) : [['', '(nenhum)']] });
      sel.classList.add('ep-cresce');
      const nv = E().botao('＋ Novo buff', () => this.novoBuff(), null, 'es-bt-ouro'); nv.dataset.ep = 'novobuff';
      topo.append(sel, nv, E().botao('🗑', () => this.apagarBuff(), 'Apagar buff', 'es-bt-perigo'));
      this.painel.appendChild(topo);
      this.painel.appendChild(E().el('p', 'es-dica', 'Um buff é ativado por um golpe com {"buff": "id"} no roteiro (aba Golpes). A prévia mostra tinta e aura.'));
      const b = d.buffs[this.buffSel];
      if (!b) return;
      if (this.buffPrev !== this.buffSel) { this.buffPrev = this.buffSel; this._prev = null; this.renderBarra(); }
      const g = E().grupo('Buff "' + this.buffSel + '"');
      g.appendChild(this.cp(b, 'nome', 'texto', 'Nome', { depois: () => this.renderBarra() }));
      g.appendChild(this.cp(b, 'turnos', 'numero', 'Turnos', { passo: 1, min: 1 }));
      g.appendChild(this.cp(b, 'hpPorTurno', 'numero', 'Vida/turno', { passo: 0.01, dica: 'Fração da vida perdida por turno (0.03 = 3%). Negativo cura.' }));
      b.multiplicadores = b.multiplicadores || {};
      MULTS.forEach(([k, n]) => g.appendChild(this.cp(b.multiplicadores, k, 'numero', n, { passo: 0.05, min: 0, placeholder: '1' })));
      const f = this.forma() || {};
      g.appendChild(E().campo('select', 'Pose parado', b.parado || '', (v) => { if (v) b.parado = v; else delete b.parado; this.mudar('Pose do buff'); this._prev = null; }, { lista: [['', '(a normal)']].concat(this.animsDoSprite(f.sprite, f)), dica: 'Animação parada enquanto o buff durar (se o sprite da forma tiver)' }));
      this.painel.appendChild(g);

      // tinta
      const gt = E().grupo('Tinta');
      const t = this.lerTinta(b.tint);
      const aplicarT = (rot) => { if (t.on) b.tint = this.escreverTinta(t); else delete b.tint; this.mudar(rot); this._prev = null; };
      gt.appendChild(E().campo('check', 'Usar tinta', t.on, (v) => { t.on = v; aplicarT('Tinta'); }));
      gt.appendChild(E().campo('cor', 'Cor', t.cor, (v) => { t.cor = v || '#ff0000'; t.on = true; aplicarT('Cor da tinta'); }));
      gt.appendChild(E().campo('select', 'Intensidade', t.a, (v) => { t.a = v; t.on = true; aplicarT('Intensidade da tinta'); },
        { lista: [['$a', 'Pulsando (padrão)'], ['0.1', 'Fixa 10%'], ['0.2', 'Fixa 20%'], ['0.3', 'Fixa 30%'], ['0.45', 'Fixa 45%'], ['0.6', 'Fixa 60%']] }));
      const ts = E().el('p', 'es-dica'); ts.textContent = b.tint || '(sem tinta)'; gt.appendChild(ts);
      this.painel.appendChild(gt);

      // aura
      const gu = E().grupo('Aura');
      const temAura = !!(b.aura && b.aura.fx);
      gu.appendChild(E().campo('check', 'Usar aura', temAura, (v) => { if (v) b.aura = Object.assign({ fx: 'Efeito3_Loop', escala: 1, frente: true }, b.aura || {}); else delete b.aura; this.mudar('Aura'); this._prev = null; this.renderPainel(); }));
      if (temAura) {
        const au = b.aura;
        const efs = E().efeitos();
        if (!efs.includes(au.fx)) efs.unshift(au.fx);
        const cfx = E().campo('select', 'Efeito', au.fx, (v) => { au.fx = v; this.mudar('Efeito da aura'); this._prev = null; mini(); }, { lista: efs });
        cfx._inp.dataset.ep = 'aurafx';
        const cv = document.createElement('canvas'); cv.width = 40; cv.height = 40; cv.className = 'ep-minianim';
        const mini = () => E().miniatura(cv, this.fxSet(au.fx), au.fx, 0);
        mini();
        cfx.appendChild(cv);
        gu.appendChild(cfx);
        gu.appendChild(E().botao('🎞 Escolher na grade…', () => this.escolherEfeito(au.fx, (v) => { au.fx = v; this.mudar('Efeito da aura'); this._prev = null; this.renderPainel(); })));
        const ch = (k, tipo, n, o) => gu.appendChild(this.cp(au, k, tipo, n, Object.assign({ depois: () => { this._prev = null; } }, o || {})));
        ch('escala', 'numero', 'Escala', { passo: 0.05, min: 0 });
        ch('dx', 'numero', 'Desloc. X', { passo: 1 });
        ch('dy', 'numero', 'Desloc. Y', { passo: 1 });
        gu.appendChild(E().campo('select', 'Presa em', au.em || 'pés', (v) => { if (v === 'pés') delete au.em; else au.em = v; this.mudar('Aura presa em'); this._prev = null; }, { lista: [['pés', 'Pés'], ['peito', 'Peito']] }));
        gu.appendChild(E().campo('check', 'Na frente', !!au.frente, (v) => { if (v) au.frente = true; else delete au.frente; this.mudar('Aura na frente'); this._prev = null; }));
        ch('alpha', 'numero', 'Opacidade', { passo: 0.05, min: 0, max: 1, placeholder: '1' });
        ch('fps', 'numero', 'FPS', { passo: 1, min: 0, placeholder: 'do efeito' });
      }
      this.painel.appendChild(gu);
    },
    lerTinta(s) {
      const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([^)]+))?\)/.exec(s || '');
      if (!m) return { on: false, cor: '#ff2020', a: '$a' };
      const h = (n) => (+n).toString(16).padStart(2, '0');
      const a = (m[4] || '$a').trim();
      return { on: true, cor: '#' + h(m[1]) + h(m[2]) + h(m[3]), a: a === '$a' ? '$a' : String(+a) };
    },
    escreverTinta(t) {
      const n = parseInt(t.cor.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + t.a + ')';
    },
    async novoBuff() {
      const nome = await E().perguntar('Novo buff', 'Nome do buff (ex.: Kaioken):', '');
      if (!nome) return;
      let id = E().idSeguro(nome);
      while (this.doc.buffs[id]) id += '_2';
      this.doc.buffs[id] = { nome, turnos: 3, multiplicadores: { ataque: 1.3 }, tint: 'rgba(255,220,60,$a)', aura: { fx: 'Efeito3_Loop', escala: 1, frente: true } };
      this.buffSel = id; this.buffPrev = id;
      this.mudar('Novo buff');
      this.renderTudo();
    },
    async apagarBuff() {
      if (!this.buffSel || !(await E().confirmar('Apagar buff', 'Apagar o buff "' + this.buffSel + '"?', '🗑 Apagar', true))) return;
      delete this.doc.buffs[this.buffSel];
      if (this.buffPrev === this.buffSel) this.buffPrev = '';
      this.buffSel = null;
      this.mudar('Apagar buff');
      this.renderTudo();
    },
    escolherEfeito(atual, aoEscolher) {
      const c = E().el('div');
      const busca = document.createElement('input'); busca.type = 'search'; busca.placeholder = 'Filtrar (ex.: aura, loop, efeito)'; busca.className = 'ep-busca';
      const g = E().el('div', 'es-grade');
      const render = () => {
        g.innerHTML = '';
        const f = busca.value.toLowerCase();
        E().efeitos().filter(n => !f || n.toLowerCase().includes(f)).slice(0, 300).forEach(n => {
          const k = E().el('div', 'es-cartao' + (n === atual ? ' sel' : ''));
          const cv = document.createElement('canvas'); cv.width = 80; cv.height = 72;
          const set = this.fxSet(n);
          const a = set && set.anim(n);
          E().miniatura(cv, set, n, a ? Math.floor(a.frames.length / 2) : 0, { max: 2 });
          const s = E().el('span'); s.textContent = n;
          k.append(cv, s); k.title = n;
          k.onclick = () => { aoEscolher(n); m.fechar(); };
          g.appendChild(k);
        });
      };
      busca.oninput = render;
      c.append(busca, g);
      const m = E().modal('🎞 Efeitos', c, { larga: true });
      render();
    },

    // ---------- IA ----------
    pIA() {
      const d = this.doc;
      const disp = this.golpesDisp(true);
      const auto = !Array.isArray(d.ia) || !d.ia.length;
      const g = E().grupo('Regras da IA');
      g.appendChild(E().el('p', 'es-dica', 'Quando o personagem é controlado pelo computador, sorteia um golpe pelo <b>peso</b> entre as regras válidas (custo de ki, "vida abaixo de", "ki abaixo de"). Sem regras, usa a IA automática. As ⭐ habilidades equipadas que não estiverem na lista entram sozinhas com peso automático (3 para golpes com ki, 4 sem custo); coloque uma aqui para escolher o peso ou a condição dela.'));
      g.appendChild(E().campo('check', 'IA automática', auto, (v) => {
        if (v) d.ia = null;
        else { const f = (d.formas || {})[d.formaInicial] || {}; d.ia = (f.golpes || []).filter(x => disp[x]).map(x => ({ golpe: x, peso: 3 })); }
        this.mudar('IA automática'); this.renderPainel();
      }));
      if (!auto) {
        const tb = document.createElement('table'); tb.className = 'ep-ia';
        tb.innerHTML = '<thead><tr><th>Golpe</th><th>Peso</th><th title="Só quando a vida estiver abaixo desta fração (0.3 = 30%)">Vida &lt;</th><th title="Só quando o ki estiver abaixo deste valor">Ki &lt;</th><th></th></tr></thead>';
        const corpo = document.createElement('tbody');
        const lista = Object.keys(disp).map(k => [k, disp[k].nome || k]);
        d.ia.forEach((r, i) => {
          const tr = document.createElement('tr');
          const td = (el) => { const x = document.createElement('td'); x.appendChild(el); tr.appendChild(x); };
          const s = document.createElement('select');
          (disp[r.golpe] ? lista : [[r.golpe, r.golpe + ' (não existe)']].concat(lista)).forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s.appendChild(o); });
          s.value = r.golpe; s.onchange = () => { r.golpe = s.value; this.mudar('Golpe da regra'); };
          td(s);
          const num = (k, passo) => { const n = document.createElement('input'); n.type = 'number'; n.step = passo; n.value = r[k] == null ? '' : r[k]; n.onchange = () => { if (n.value === '') delete r[k]; else r[k] = +n.value; this.mudar('Regra da IA'); }; return n; };
          td(num('peso', 1)); td(num('hpAbaixo', 0.05)); td(num('kiAbaixo', 5));
          td(E().botao('✕', () => { d.ia.splice(i, 1); if (!d.ia.length) d.ia = null; this.mudar('Apagar regra'); this.renderPainel(); }, 'Apagar regra'));
          corpo.appendChild(tr);
        });
        tb.appendChild(corpo);
        g.appendChild(tb);
        g.appendChild(E().botao('＋ Regra', () => { d.ia.push({ golpe: Object.keys(disp)[0], peso: 3 }); this.mudar('Nova regra'); this.renderPainel(); }));
        // chance de cada golpe (sem condições)
        const sup = (r) => !!(disp[r.golpe] || {}).supremo;
        const base = d.ia.filter(r => !r.hpAbaixo && !r.kiAbaixo && !sup(r));
        const tot = base.reduce((s, r) => s + (r.peso || 1), 0);
        const sups = d.ia.filter(sup);
        if (sups.length) g.appendChild(E().el('p', 'es-dica', '⚡ ' + sups.map(r => (disp[r.golpe] || {}).nome || r.golpe).join(', ') + ': supremo — o computador só usa quando a barra de Fúria (Rage) enche; o peso não vale para ele.'));
        if (tot) {
          const p = E().el('p', 'es-dica');
          p.textContent = 'Chance (sem condições, ki sobrando): ' + base.map(r => ((disp[r.golpe] || {}).nome || r.golpe) + ' ' + Math.round(100 * (r.peso || 1) / tot) + '%').join(' · ');
          g.appendChild(p);
        }
      }
      this.painel.appendChild(g);
      const gj = E().grupo('JSON da IA', false);
      gj.appendChild(E().campo('json', 'ia', d.ia || null, (v) => {
        if (v != null && !Array.isArray(v)) return E().aviso('A IA é uma lista: [{"golpe": "combo", "peso": 5}]', 'erro');
        d.ia = v && v.length ? v : null; this.mudar('JSON da IA'); this.renderPainel();
      }, { linhas: 8 }));
      this.painel.appendChild(gj);
    },

    // ---------- salvar ----------
    salvar() {
      const id = this.pid;
      if (this.ehNovo(id)) {
        const atual = this.edicao(id).def;
        const def = this.limpo(this.doc);
        def.id = id;
        def.golpes = E().copia(atual.golpes || def.golpes || {});   // golpes ficam com a aba Golpes
        E().salvarNoJogo(['personagens', id], { novo: true, def }, '💾 ' + (def.nome || id) + ' salvo.');
      } else {
        const orig = this.limpo(FF.Assets.json['data/characters/' + id + '.json'] || {});
        const L = this.limpo(this.doc);
        const o = {};
        CAMPOS.forEach(k => {
          const v = L[k] === undefined ? null : L[k];
          const ov = orig[k] === undefined ? null : orig[k];
          if (JSON.stringify(v) !== JSON.stringify(ov)) o[k] = E().copia(v);
        });
        E().salvarNoJogo(['personagens', id], Object.keys(o).length ? o : null, Object.keys(o).length ? '💾 ' + (this.doc.nome || id) + ' salvo (' + Object.keys(o).join(', ') + ').' : '💾 Igual ao original: edição removida.');
      }
      return this.recarregar(id);
    },
    async original() {
      if (!(await E().confirmar('Voltar ao original', 'Voltar "' + (this.doc.nome || this.pid) + '" ao original do jogo? (o que foi salvo e o rascunho se perdem)', '↺ Voltar ao original', true))) return;
      E().salvarNoJogo(['personagens', this.pid], null, '↺ ' + (this.doc.nome || this.pid) + ' voltou ao original.');
      await this.recarregar(this.pid, true);
    },
    async apagarNovo() {
      const id = this.pid;
      if (!(await E().confirmar('Apagar personagem', 'Apagar o personagem "' + (this.doc.nome || id) + '"? Ele sai da Batalha Livre.', '🗑 Apagar', true))) return;
      E().salvarNoJogo(['personagens', id], null, '🗑 ' + (this.doc.nome || id) + ' apagado.');
      E().rascunho.gravar('pers_' + id, null);
      delete this.docs[id]; delete this.hist[id]; delete this.defs[id]; delete this.salvo[id];
      this.pid = null; this.doc = null;
      await this.carregarLista();
      await this.selecionar(this.ids[0]);
    },
    // depois de salvar: recarrega do jogo (com as edições) e marca como salvo, mantendo o histórico
    async recarregar(id, trocarDoc) {
      this.defs[id] = await FF.Assets.loadCharacter(id);
      const base = this.docDe(id);
      this.salvo[id] = JSON.stringify(this.limpo(base));
      if (this.pid === id) { this.docs[id] = this.doc = base; this.hist[id].marcar(trocarDoc ? 'Original' : 'Salvo'); } else this.docs[id] = base;
      E().rascunho.gravar('pers_' + id, null);
      this.renderLista();
      this.renderTudo();
    },

    verJSON() {
      const c = E().el('div');
      const ta = document.createElement('textarea'); ta.className = 'ep-json'; ta.value = JSON.stringify(this.doc, null, 1);
      const ok = E().botao('Aplicar', () => {
        try {
          const v = JSON.parse(ta.value);
          if (!v || typeof v !== 'object' || !v.formas) throw new Error('precisa ter "formas"');
          this.doc = this.docs[this.pid] = v;
          if (!v.formas[this.formaSel]) this.formaSel = v.formaInicial || Object.keys(v.formas)[0];
          this.mudar('Colar JSON'); this.renderTudo(); m.fechar();
        } catch (e) { E().aviso('JSON inválido: ' + e.message, 'erro'); }
      }, null, 'es-bt-ouro');
      c.append(E().el('p', 'es-dica', this.ehNovo(this.pid) ? 'Definição completa do personagem novo.' : 'Campos editáveis do personagem (os golpes ficam na aba Golpes).'), ta, ok);
      const m = E().modal('{ } ' + (this.doc.nome || this.pid), c, { larga: true });
    },

    // ---------- testar ----------
    montarBatalha(herois, inimigos) {
      const nh = herois.length, ni = inimigos.length;
      return {
        id: 'livre', saga: 'livre', titulo: 'Batalha Livre', cenario: 'campo', musica: 'tournament_theme',
        escala: nh === 1 && ni === 1 ? 2.5 : 2.2,
        posicoes: { herois: { 1: [170], 2: [250, 150], 3: [250, 150, 350] }[nh], inimigos: { 1: [915], 2: [870, 990], 3: [820, 930, 1020] }[ni] },
        herois: herois.slice(), inimigos: inimigos.slice(), ajustes: {},
      };
    },
    async testar() {
      if (this.sujo(this.pid)) {
        const r = await E().escolha('Testar na Batalha Livre', 'A Batalha Livre usa a versão salva no jogo. Salvar as mudanças antes de testar?', [
          { txt: '💾 Salvar e testar', valor: 'salvar', cls: 'es-bt-ouro' }, { txt: 'Testar sem salvar', valor: 'nao' }, { txt: 'Cancelar', valor: null }]);
        if (!r) return;
        if (r === 'salvar') this.salvar();
      }
      const def = this.montarBatalha([this.pid], [this.oponente || 'raditz']);
      try { sessionStorage.setItem('ff_livre_def', JSON.stringify(def)); } catch (e) { /* sem sessionStorage */ }
      const w = window.open('index.html?livre=1', '_blank');
      if (!w) location.href = 'index.html?livre=1';
    },

    // ---------- criar personagem novo ----------
    mapearAnims(spriteId, forma) {
      const l = this.animsDoSprite(spriteId, forma);
      const out = {};
      const low = l.map(x => x.toLowerCase());
      for (const [k, [exatos, re]] of Object.entries(AUTO)) {
        let a = null;
        for (const e of exatos) { const i = low.indexOf(e.toLowerCase()); if (i >= 0) { a = l[i]; break; } }
        if (!a) a = l.find(x => re.test(x)) || null;
        if (a) out[k] = a;
      }
      if (!out.dano2 && out.dano1) out.dano2 = out.dano1;
      const first = out.parado || l[0];
      ANIMS.forEach(([k]) => { if (!out[k] && first) out[k] = first; });
      return out;
    },
    // anims usadas num roteiro (anim, animMov, animAlvo...)
    animsDoRoteiro(o, acc = new Set()) {
      if (Array.isArray(o)) o.forEach(x => this.animsDoRoteiro(x, acc));
      else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) {
        if ((k === 'anim' || k === 'animMov') && typeof v === 'string') acc.add(v);
        else if (typeof v === 'object') this.animsDoRoteiro(v, acc);
      }
      return acc;
    },
    tirarVozes(o) {
      if (Array.isArray(o)) { for (let i = o.length - 1; i >= 0; i--) { if (o[i] && typeof o[i] === 'object' && 'voz' in o[i] && Object.keys(o[i]).filter(k => k !== 'quadro').length === 1) o.splice(i, 1); else this.tirarVozes(o[i]); } }
      else if (o && typeof o === 'object') { delete o.voz; Object.values(o).forEach(v => this.tirarVozes(v)); }
      return o;
    },
    golpesBasicos(set, anims) {
      const tem = (n) => set && set.has(n);
      const nomes = set ? Object.keys(set.def.anims) : [];
      const g = {};
      // carregar ki
      if (tem('CarregandoKi_Stage1') && tem('CarregandoKi_Stage2') && tem('CarregandoKi_Stage3')) {
        g.carregar_ki = { nome: 'Carregar Ki', roteiro: [
          { anim: 'CarregandoKi_Stage1', eventos: [{ quadro: 0, som: 'carregamentodeki_start' }] },
          { anim: 'CarregandoKi_Stage2', duracao: 1.0, eventos: [{ quadro: 0, som: 'carregamentodeki_loop' }] },
          { anim: 'CarregandoKi_Stage3' }, { ki: 35 }] };
      } else {
        const a = nomes.find(n => /carreg|charge|ki/i.test(n)) || anims.parado;
        g.carregar_ki = { nome: 'Carregar Ki', roteiro: [{ anim: a, duracao: 1.0, eventos: [{ quadro: 0, som: 'carregamentodeki_start' }] }, { ki: 35 }] };
      }
      // sequência simples com as animações de ataque do sprite
      let atq = ['Attack_Light_1', 'Attack_Light_2', 'Attack_Medium', 'Attack_Heavy'].filter(tem);
      if (atq.length < 2) atq = nomes.filter(n => /attack|ataque|atk|soco|chute|punch|kick/i.test(n) && !/aereo|agachado/i.test(n)).slice(0, 4);
      if (!atq.length) atq = [anims.parado];
      const fr = [0.2, 0.2, 0.25, 0.35];
      const passos = [{ irAte: 'alvo', dist: 24, tempo: 0.22, animMov: tem('Dash') ? 'Dash' : 'avancar', som: 'jetdash' }];
      atq.forEach((a, i) => {
        const ult = i === atq.length - 1;
        passos.push({ anim: a, eventos: [{ quadro: 'pico', som: 'movimento_basa' }, { quadro: 'pico', acerto: Object.assign({ fracao: atq.length === 1 ? 1 : fr[i] || 0.25, forca: ult ? 'forte' : i ? 'media' : 'leve' }, ult ? { lanca: true } : {}) }] });
      });
      passos.push({ voltar: true, som: 'teletransporte' });
      g.combo = { nome: 'Sequência de Golpes', descricao: 'Avança e ataca. Aperte no tempo para crítico.', tipo: 'corpo', poder: 1.6, roteiro: passos };
      return g;
    },

    dialogoNovo(duplicarDe) {
      const c = E().el('div', 'ep-novo');
      const src = duplicarDe ? this.defs[duplicarDe] : null;
      const sprites = FF.Assets.listaSprites().filter(s => !NAO_LUTADOR.test(s) && ['jogo', 'personagens'].includes(FF.Assets.tipoSprite(s)));
      const usados = new Set(this.ids.flatMap(i => Object.values((this.defs[i] || {}).formas || {}).map(f => f.sprite)));
      const livre = sprites.find(s => !usados.has(s)) || sprites[0];
      const st = { nome: src ? (this.doc.nome || src.nome) + ' 2' : '', id: '', sprite: livre, modelo: 'goku', copiar: true };
      const iNome = E().campo('texto', 'Nome', st.nome, (v) => { st.nome = v || ''; if (!idMexido) { st.id = E().idSeguro(st.nome); iId._inp.value = st.id; } });
      let idMexido = false;
      const iId = E().campo('texto', 'id', st.id, (v) => { st.id = E().idSeguro(v || ''); iId._inp.value = st.id; idMexido = true; }, { dica: 'Letras minúsculas, números e _' });
      iNome._inp.oninput = () => iNome._inp.onchange();
      iNome._inp.dataset.ep = 'novonome'; iId._inp.dataset.ep = 'novoid';
      c.append(iNome, iId);
      const prev = document.createElement('canvas'); prev.width = 90; prev.height = 90; prev.className = 'ep-novo-prev';
      const atualizarPrev = async () => {
        const s = await FF.Assets.loadSprite(st.sprite).catch(() => null);
        const m = this.mapearAnims(st.sprite);
        E().miniatura(prev, s, m.parado, 0, { max: 3 });
      };
      if (!src) {
        const iS = E().campo('select', 'Sprite', st.sprite, (v) => { st.sprite = v; atualizarPrev(); }, { lista: sprites.map(s => [s, (FF.Assets.doAcervo(s) ? FF.Assets.nomeSprite(s) + ' · ' + s : s) + (usados.has(s) ? '' : ' (sem personagem)')]) });
        iS._inp.dataset.ep = 'novosprite';
        const iM = E().campo('select', 'Modelo', st.modelo, (v) => { st.modelo = v; }, { lista: this.ids.map(i => [i, this.defs[i].nome]), dica: 'Atributos e golpes que servirem no sprite são copiados deste personagem' });
        const iC = E().campo('check', 'Copiar golpes', st.copiar, (v) => { st.copiar = v; }, { dica: 'Copia do menu da forma inicial do modelo os golpes cujas animações existem no sprite escolhido (sem as vozes)' });
        c.append(iS, iM, iC, prev,
          E().el('p', 'es-dica', 'As animações básicas são escolhidas pelo nome (parado/idle, dano/hit, defesa/block…). Sempre ganha "Carregar Ki" e uma "Sequência de Golpes" simples; ajuste depois nas abas.'));
        atualizarPrev();
      } else {
        c.append(E().el('p', 'es-dica', 'Cria uma cópia completa de ' + (this.doc.nome || duplicarDe) + ' (formas, buffs, IA e golpes) como personagem novo.'));
      }
      const ok = E().botao('Criar', async () => {
        const id = st.id || E().idSeguro(st.nome);
        if (!id || !st.nome) return E().aviso('Dê um nome ao personagem.', 'erro');
        if (this.ids.includes(id) || FF.Assets.listaPersonagens().includes(id)) return E().aviso('Já existe um personagem com o id "' + id + '".', 'erro');
        try {
          const def = src ? await this.defDuplicada(duplicarDe, id, st.nome) : await this.defNova(id, st);
          m.fechar();
          E().salvarNoJogo(['personagens', id], { novo: true, def }, '⭐ ' + st.nome + ' criado! Já aparece na Batalha Livre.');
          this.defs[id] = await FF.Assets.loadCharacter(id);
          if (!this.ids.includes(id)) this.ids.push(id);
          await this.selecionar(id);
        } catch (e) { console.error(e); E().aviso('Não deu para criar: ' + e.message, 'erro'); }
      }, null, 'es-bt-ouro');
      ok.dataset.ep = 'criar';
      c.appendChild(ok);
      const m = E().modal(src ? '⧉ Duplicar personagem' : '＋ Novo personagem', c);
      setTimeout(() => iNome._inp.focus(), 30);
    },

    async defDuplicada(de, id, nome) {
      const doc = de === this.pid ? this.doc : this.docDe(de);
      const d = this.defs[de];
      const golpes = {};
      for (const [k, g] of Object.entries(d.golpes || {})) golpes[k] = E().copia(g);
      return Object.assign(E().copia(doc), { id, nome, golpes });
    },

    async defNova(id, st) {
      const set = await FF.Assets.loadSprite(st.sprite);
      const anims = this.mapearAnims(st.sprite);
      const modelo = this.defs[st.modelo] || this.defs.goku || Object.values(this.defs)[0];
      const golpes = this.golpesBasicos(set, anims);
      const tem = (n) => set.has(n);
      if (st.copiar && modelo) {
        const doMenu = new Set(((modelo.formas || {})[modelo.formaInicial] || {}).golpes || []);
        for (const [k, g] of Object.entries(modelo.golpes || {})) {
          if (!doMenu.has(k) || golpes[k] || g.supremo || g.mostrar || g.requer || g.parceiro) continue;
          const txt = JSON.stringify(g.roteiro || g.linha || g.cena || []);
          if (/"(transformar|buff|parceiro|sparking|linha|cena)"/.test(txt) || !g.roteiro) continue;
          const usa = [...this.animsDoRoteiro(g.roteiro)];
          if (!usa.length || !usa.every(a => tem(a) || ANIMS.some(([b]) => b === a))) continue;
          const c = this.tirarVozes(E().copia(g));
          delete c.esconder;
          golpes[k] = c;
        }
      }
      const vit = tem('Pose_De_Vitoria') ? 'Pose_De_Vitoria' : tem('Vitoria') ? 'Vitoria' : anims.parado;
      const ordem = ['combo'].concat(Object.keys(golpes).filter(k => k !== 'combo' && k !== 'carregar_ki'), ['carregar_ki']);
      const def = {
        id, nome: st.nome, formaInicial: 'base',
        atributos: E().copia((this.defs.goku || modelo).atributos),
        vozes: {},
        formas: { base: { nome: st.nome, sprite: st.sprite, anims, golpes: ordem, vitoria: [{ anim: vit, duracao: 60, eventos: [{ quadro: 0, som: 'winstart_effect' }] }] } },
        buffs: {},
        golpes,
      };
      return def;
    },

    // ---------- prévia ----------
    mostrar() { this._prev = null; },
    novaPrevia() {
      const f = this.forma();
      const set = this.setDaForma(f);
      if (!set) return null;
      const b = this.buffPrev && (this.doc.buffs || {})[this.buffPrev];
      let seq;
      if (this.animSel === 'vitoria') seq = (f.vitoria || []).map(s => s.anim).filter(a => a && set.has(a));
      else {
        let n = (f.anims || {})[this.animSel];
        if (this.animSel === 'parado' && b && b.parado && set.has(b.parado)) n = b.parado;
        seq = n && set.has(n) ? [n] : [];
      }
      const p = { set, seq, i: 0, a: new FF.Animator(set), buff: b || null, espera: 0, aura: null, t: 0 };
      if (seq.length) p.a.play(seq[0], { loop: seq.length === 1 });
      if (b && b.aura && b.aura.fx) {
        const fs = this.fxSet(b.aura.fx);
        if (fs) { const a = new FF.Animator(fs); a.play(b.aura.fx, { loop: true, fps: b.aura.fps }); p.aura = { set: fs, a }; }
      }
      return p;
    },
    quadro(dt) {
      if (!this.doc || !this.cv) return;
      if (!this._prev) this._prev = this.novaPrevia();
      const p = this._prev;
      const ctx = this.cv.getContext('2d');
      const W = this.cv.width, H = this.cv.height, chao = H - 40;
      ctx.imageSmoothingEnabled = false;
      if (this.fundo === 'campo') {
        const g = ctx.createLinearGradient(0, 0, 0, chao);
        g.addColorStop(0, '#3d7fd6'); g.addColorStop(1, '#bfe2ff');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, chao);
        ctx.fillStyle = '#6aa531'; ctx.fillRect(0, chao, W, H - chao);
        ctx.fillStyle = '#4f8424'; ctx.fillRect(0, chao, W, 4);
      } else {
        ctx.fillStyle = '#0b0716'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#2e1e52'; ctx.beginPath(); ctx.moveTo(0, chao + 0.5); ctx.lineTo(W, chao + 0.5); ctx.stroke();
      }
      if (!p) { this.info.textContent = 'sprite não carregado'; return; }
      p.t += dt;
      if (!p.seq.length) { this.info.textContent = 'sem animação "' + this.animSel + '" nesta forma'; return; }
      p.a.update(dt);
      if (p.a.done && p.seq.length > 1) {
        if (p.i < p.seq.length - 1) { p.i++; p.a.play(p.seq[p.i], { loop: false }); }
        else { p.espera += dt; if (p.espera > 1.2) { p.espera = 0; p.i = 0; p.a.play(p.seq[0]); } }
      }
      if (p.aura) p.aura.a.update(dt);
      const esc = 2.5, x = W / 2, y = chao;
      const fx = FF.Assets.sprites.fx;
      const sombra = fx && fx.anim('sombra');
      if (sombra) FF.drawFrame(ctx, fx, sombra.frames[1], x, y + 2, esc, false, { alpha: 0.45 });
      const au = p.buff && p.buff.aura;
      const aura = (frente) => {
        if (!p.aura || !!au.frente !== frente) return;
        const by = au.em === 'peito' ? y - 26 * esc : y;
        FF.drawFrame(ctx, p.aura.set, p.aura.a.frame(), x + (au.dx || 0), by + (au.dy || 0), esc * (au.escala || 1) * (p.aura.set.def.escala || 1), false, { alpha: au.alpha != null ? au.alpha : 1 });
      };
      aura(false);
      let tint = null;
      if (p.buff && p.buff.tint) tint = p.buff.tint.replace('$a', (0.18 + 0.2 * (0.5 + 0.5 * Math.sin(p.t * 10))).toFixed(3));
      FF.drawFrame(ctx, p.set, p.a.frame(), x, y, esc, false, { tint });
      aura(true);
      this.info.textContent = (this.forma().nome || this.formaSel) + ' · ' + (p.seq[p.i] || '') + ' ' + (p.a.i + 1) + '/' + (p.a.a ? p.a.a.frames.length : 0) + (p.buff ? ' · ' + (p.buff.nome || this.buffPrev) : '');
    },
  };

  FF.Estudio.registrarAba(P);
  FF.Estudio.Personagens = P;
})();
