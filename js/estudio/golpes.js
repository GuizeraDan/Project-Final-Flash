// Estúdio — aba Golpes / habilidades (cenas): lista de golpes, palco ao vivo, linha do tempo e propriedades.
// Documento em edição: { origem: {tipo: 'golpe'|'habilidade'|'novo', personagem, forma, id}, golpe: {meta}, linha }
// Salvar: golpe do jogo → data/edicoes.js golpes[personagem][id]; novo/habilidade → habilidades[id] (⭐ no menu).
window.FF = window.FF || {};

(function () {
  const E = FF.Estudio;
  const TIPOS_TRILHA = [['lutador', '🧍 Lutador (parceiro / alvo)'], ['efeitos', '✺ Efeitos'], ['projeteis', '➶ Projéteis'], ['camadas', '▣ Camadas livres'], ['sons', '♪ Sons e vozes'], ['acertos', '✸ Acertos'], ['tela', '🎥 Tela (tremor, flash, câmera, mensagem)'], ['acoes', '⚙ Ações (ki, buff, transformar…)']];
  const RERENDER = new Set(['Para onde', 'Sprite da camada', 'Ação', 'Editar JSON', 'Desligar trilha', 'Lutador da trilha', 'Animação', 'Efeito', 'Projétil', 'Explosão', 'Efeito na mão', 'Duração automática', 'Chaves', 'Anel', 'Lança o alvo', 'Voz do personagem']);
  const novoId = () => 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

  const G = {
    id: 'golpes', nome: 'Golpes e cenas', icone: '🎬',
    t: 0, tocando: false, vel: 1, loop: null, sel: null, trSel: null, autoChave: false, copiado: null,
    cfg: null, doc: null, defs: {},

    async montar(el) {
      el.innerHTML = '';
      // esquerda
      this.lado = E.el('div', 'es-lado');
      el.appendChild(this.lado);
      E.ladoRedimensionavel(this.lado, 'golpes_esq', 'esq', 400);
      // centro
      const centro = E.el('div', 'es-centro');
      this.barra = E.el('div', 'es-barra');
      const wrap = E.el('div', 'es-palco-wrap');
      this.cv = document.createElement('canvas');
      this.cv.width = FF.BW; this.cv.height = FF.H;
      this.infoPalco = E.el('div', 'es-palco-info');
      wrap.append(this.cv, this.infoPalco);
      const tl = E.el('div');
      centro.append(this.barra, wrap, tl);
      el.appendChild(centro);
      // direita
      const dir = E.el('div', 'es-lado dir');
      this.titProps = E.el('div', 'es-titulo', 'Propriedades');
      this.props = E.el('div', 'es-rolar');
      this.rodape = E.el('div', 'es-barra es-rodape');
      dir.append(this.titProps, this.props, this.rodape);
      el.appendChild(dir);
      E.ladoRedimensionavel(dir, 'golpes_dir', 'dir', 460, { esconder: '⚙ Propriedades' });

      FF.W = FF.BW;
      this.palco = new FF.EstudioPalco(this.cv);
      this.tl = new FF.EstudioLinha(tl, this);
      this.historico = new E.Historico(() => this.doc, (d) => { this.doc = d; if (!this.achar(this.sel)) this.sel = null; this.tudo(); this.salvarRascunho(); });
      this.montarBarra();
      this.ligarPalco();
      this.montarRodape();
      this.cfg = Object.assign({ atacante: 'goku', forma: 'base', alvo: 'raditz', lado: 'heroi', parceiros: [], aliadosAlvo: [] }, E.rascunho.ler('golpe_cfg') || {});
      delete this.cfg.filaAtk; delete this.cfg.filaAlvo; this.cfg.aliadosAlvo = []; delete this.cfg.alvoIdx;   // fileiras saíram do Estúdio (tudo é cena)
      if (!FF.Assets.listaPersonagens().includes(this.cfg.atacante)) this.cfg.atacante = 'goku';
      await this.carregarDefs();
      this.montarLado();
      this.renderFilas();
      // abrir pela URL (?aba=golpes&personagem=goku&golpe=kamehameha | &hab=<id>) ou recuperar o rascunho
      const q = new URLSearchParams(location.search);
      const rasc = E.rascunho.ler('golpe_doc');
      const pq = q.get('personagem');
      if (pq && FF.Assets.listaPersonagens().includes(pq) && (pq !== this.cfg.atacante || q.get('alvo'))) {
        const alvo = q.get('alvo') && FF.Assets.listaPersonagens().includes(q.get('alvo')) ? q.get('alvo') : (pq === this.cfg.alvo ? (pq === 'raditz' ? 'goku' : 'raditz') : this.cfg.alvo);
        await this.aplicarCfg(Object.assign({}, this.cfg, { atacante: pq, forma: null, alvo, alvoForma: null }));
      }
      if (q.get('hab')) await this.abrirHabilidade(q.get('hab'));
      else if (q.get('golpe')) await this.abrirGolpe(q.get('personagem') || this.cfg.atacante, q.get('golpe'));
      else if (q.get('novo')) { await this.abrirPrimeiro(); this.novo(); }   // ＋ Criar no Estúdio (Batalha Livre → Habilidades)
      else if (pq) await this.abrirPrimeiro();
      else if (rasc && rasc.doc) {
        await this.aplicarCfg(Object.assign({}, this.cfg, { atacante: rasc.doc.origem.personagem, forma: rasc.doc.origem.forma }));
        this.abrirDoc(rasc.doc, 'Rascunho recuperado');
        E.aviso('📝 Rascunho recuperado: "' + (rasc.doc.golpe.nome || '') + '". Ctrl+Z não desfaz isso; use ↺ Recarregar se não quiser.');
      } else await this.abrirPrimeiro();
    },
    // primeiro golpe da forma atual do personagem (nem todo mundo tem Kamehameha)
    async abrirPrimeiro() {
      const def = this.defs[this.cfg.atacante];
      const f = def.formas[this.cfg.forma] || {};
      const gid = (f.golpes || []).find(g => def.golpes[g]) || Object.keys(def.golpes).find(g => !g.startsWith('hab_'));
      if (gid) return this.abrirGolpe(this.cfg.atacante, gid);
      this.novo();
    },

    mostrar() { FF.W = FF.BW; if (this.doc) this.redesenharTudo(); },
    esconder() { this.pausar(); },

    async carregarDefs() {
      await this.palco.montar(this.cfg);
      this.defs = this.palco.defs;
    },
    async aplicarCfg(cfg, manter) {
      this.cfg = cfg;
      E.rascunho.gravar('golpe_cfg', cfg);
      await this.carregarDefs();
      if (!this.defs[cfg.atacante].formas[cfg.forma]) this.cfg.forma = this.defs[cfg.atacante].formaInicial || Object.keys(this.defs[cfg.atacante].formas)[0];
      this.montarLado();
      if (manter && this.doc) { this.doc.origem.forma = this.cfg.forma; this.irPara(this.t); this.tl.render(); }
    },

    // ---------- painel da esquerda ----------
    montarLado() {
      const L = this.lado, cfg = this.cfg;
      L.innerHTML = '';
      const def = this.defs[cfg.atacante];
      const t1 = E.el('div', 'es-titulo', 'Quem solta');
      L.appendChild(t1);
      const box = E.el('div', 'es-rolar es-golpes-cfg');
      box.style.flex = 'none';
      const nomes = FF.Assets.listaPersonagens().map(id => [id, (FF.Assets.json['data/characters/' + id + '.json'] || {}).nome || id]);
      box.appendChild(E.campo('select', 'Personagem', cfg.atacante, async (v) => { await this.aplicarCfg(Object.assign({}, cfg, { atacante: v, forma: null })); this.montarLado(); }, { lista: nomes }));
      box.appendChild(E.campo('select', 'Forma', cfg.forma, (v) => this.aplicarCfg(Object.assign({}, cfg, { forma: v }), true), { lista: Object.entries(def.formas).map(([k, f]) => [k, f.nome || k]) }));
      const buffs = [['', 'nenhum']].concat(Object.keys(def.buffs || {}).map(k => [k, def.buffs[k].nome || k]));
      if (buffs.length > 1) box.appendChild(E.campo('select', 'Buff ativo', cfg.buff || '', (v) => this.aplicarCfg(Object.assign({}, cfg, { buff: v || null }), true), { lista: buffs, dica: 'Para golpes que só aparecem com um buff (ex.: Kaioken)' }));
      L.appendChild(box);
      const t2 = E.el('div', 'es-titulo', 'Golpes');
      t2.appendChild(E.botao('＋ Novo', () => this.novo(), 'Criar uma habilidade nova do zero', 'es-bt-ouro es-mais'));
      L.appendChild(t2);
      const lista = E.el('div', 'es-rolar es-lista');
      const formaDe = (gid) => (Object.entries(def.formas).find(([, f]) => (f.golpes || []).includes(gid)) || [])[0];
      const golpes = Object.keys(def.golpes).filter(k => !k.startsWith('hab_'));
      golpes.sort((a, b) => (formaDe(a) === cfg.forma ? 0 : 1) - (formaDe(b) === cfg.forma ? 0 : 1));
      let grupo = null;
      golpes.forEach(gid => {
        const fm = formaDe(gid) || '—';
        if (fm !== grupo) { grupo = fm; lista.appendChild(E.el('div', 'es-sub', 'Forma: ' + ((def.formas[fm] || {}).nome || fm))); }
        const g = def.golpes[gid];
        const it = E.el('div', 'es-item' + (this.doc && this.doc.origem.tipo === 'golpe' && this.doc.origem.id === gid && this.doc.origem.personagem === cfg.atacante ? ' sel' : ''));
        const n = E.el('span'); n.textContent = FF.UI && FF.UI.icone ? g.nome : g.nome;
        it.appendChild(n);
        if (FF.Edicoes.golpeAlterado(cfg.atacante, gid)) it.appendChild(E.el('span', 'tag alt', '✎'));
        if (g.supremo) it.appendChild(E.el('span', 'tag', 'supremo'));
        const sm = E.el('small'); sm.textContent = g.supremo ? 'fúria' : g.custoKi ? g.custoKi + ' ki' : g.tipo === 'suporte' || /carregar/i.test(gid) ? '' : 'grátis'; it.appendChild(sm);
        it.onclick = () => this.confirmarTroca(() => this.abrirGolpe(cfg.atacante, gid));
        lista.appendChild(it);
      });
      const habs = FF.Habilidades.listar(cfg.atacante);
      lista.appendChild(E.el('div', 'es-sub', '⭐ Habilidades (' + habs.length + ')'));
      habs.forEach(h => {
        const it = E.el('div', 'es-item' + (this.doc && this.doc.origem.tipo === 'habilidade' && this.doc.origem.id === h.id ? ' sel' : ''));
        const n = E.el('span'); n.textContent = '⭐ ' + h.nome; it.appendChild(n);
        if (!h.equipada) it.appendChild(E.el('span', 'tag', 'desligada'));
        const sm = E.el('small'); sm.textContent = (h.golpe.custoKi || 0) + ' ki'; it.appendChild(sm);
        it.onclick = () => this.confirmarTroca(() => this.abrirHabilidade(h.id));
        lista.appendChild(it);
      });
      // cena de KO: o que acontece quando alguém é derrotado (padrão de todos + própria do alvo do palco)
      lista.appendChild(E.el('div', 'es-sub', '💀 Cena de KO'));
      const itemKO = (id, nome, tag, dica) => {
        const it = E.el('div', 'es-item' + (this.doc && this.doc.origem.tipo === 'ko' && this.doc.origem.id === id ? ' sel' : ''));
        const n = E.el('span'); n.textContent = nome; it.appendChild(n);
        if (tag) it.appendChild(E.el('span', 'tag' + (tag === '✎' ? ' alt' : ''), tag));
        it.title = dica;
        it.onclick = () => this.confirmarTroca(() => this.abrirKO(id));
        lista.appendChild(it);
      };
      const koSalvo = FF.Edicoes.dados().ko || {};
      itemKO('padrao', '💀 Padrão (todos)', koSalvo.padrao ? '✎' : '', 'Vale para todo personagem que não tem cena de KO própria');
      itemKO('supremo', '💥 Vaporizado (golpe supremo)', koSalvo.supremo ? '✎' : '', 'Toca quando o golpe final é um Supremo (vale para todos): o derrotado se desfaz em faíscas');
      const nAlvo = (this.defs[cfg.alvo] || {}).nome || cfg.alvo;
      itemKO(cfg.alvo, '💀 Quando ' + nAlvo + ' cai', koSalvo[cfg.alvo] ? '✎' : 'usa a padrão', 'Cena própria do ' + nAlvo + ' (troque o Alvo do palco para editar a de outro personagem)');
      // 🎬 entrada / saída da cena do golpe (por tipo; padrão + própria de quem solta) e ⚡ entrada no Sparking
      const nAtk = (this.defs[cfg.atacante] || {}).nome || cfg.atacante;
      const TIPOS = [['normal', '👊', 'Normal'], ['rush', '💥', 'Rush'], ['supremo', '🔥', 'Supremo']];
      const ehDoc = (o) => this.doc && Object.keys(o).every(k => this.doc.origem[k] === o[k]);
      const secaoCena = (qual, titulo) => {
        lista.appendChild(E.el('div', 'es-sub', titulo));
        TIPOS.forEach(([tipo, ic, nm]) => {
          const it = E.el('div', 'es-item' + (ehDoc({ tipo: 'cena', qual, tipoCena: tipo, id: 'padrao' }) ? ' sel' : ''));
          const n = E.el('span'); n.textContent = ic + ' ' + nm + ' (todos)'; it.appendChild(n);
          if (FF.CenaGolpe.temSalva(qual, tipo, 'padrao')) it.appendChild(E.el('span', 'tag alt', '✎'));
          it.title = (qual === 'saida' ? 'Saída' : 'Entrada') + ' padrão da cena dos golpes ' + nm;
          it.onclick = () => this.confirmarTroca(() => this.abrirCena(qual, tipo, 'padrao'));
          lista.appendChild(it);
        });
        const it = E.el('div', 'es-item es-item-cenas');
        const n = E.el('span'); n.textContent = 'Quando ' + nAtk + ' solta:'; it.appendChild(n);
        TIPOS.forEach(([tipo, ic, nm]) => {
          const prop = FF.CenaGolpe.temPropria(qual, tipo, cfg.atacante);
          const bt = E.botao(ic + (prop ? '✎' : ''), (ev) => { ev.stopPropagation(); this.confirmarTroca(() => this.abrirCena(qual, tipo, cfg.atacante)); },
            nm + ' do ' + nAtk + (prop ? ' (própria)' : ' (usa a padrão)') + ' — troque "Quem solta" para editar a de outro');
          if (ehDoc({ tipo: 'cena', qual, tipoCena: tipo, id: cfg.atacante })) bt.classList.add('es-bt-ouro');
          it.appendChild(bt);
        });
        lista.appendChild(it);
      };
      secaoCena('entrada', '🎬 Entrada da cena');
      secaoCena('saida', '🎬 Saída da cena');
      lista.appendChild(E.el('div', 'es-sub', '⚡ Entrada no Sparking'));
      const itemSp = (id, nome, tag, dica) => {
        const it = E.el('div', 'es-item' + (ehDoc({ tipo: 'sparking', id }) ? ' sel' : ''));
        const n = E.el('span'); n.textContent = nome; it.appendChild(n);
        if (tag) it.appendChild(E.el('span', 'tag' + (tag === '✎' ? ' alt' : ''), tag));
        it.title = dica;
        it.onclick = () => this.confirmarTroca(() => this.abrirSparking(id));
        lista.appendChild(it);
      };
      itemSp('padrao', '⚡ Padrão (todos)', FF.Sparking.temSalva('padrao') ? '✎' : '', 'Toca quando a Fúria de quem não tem cena própria enche');
      itemSp(cfg.atacante, '⚡ Quando ' + nAtk + ' entra', FF.Sparking.temPropria(cfg.atacante) ? '✎' : 'usa a padrão', 'Cena própria do ' + nAtk + ' (troque "Quem solta" para editar a de outro)');
      L.appendChild(lista);
      // alvo e parceiro
      const t3 = E.el('div', 'es-titulo', 'Palco');
      L.appendChild(t3);
      const pb = E.el('div', 'es-rolar'); pb.style.flex = 'none';
      pb.appendChild(E.campo('select', 'Alvo', cfg.alvo, (v) => this.aplicarCfg(Object.assign({}, cfg, { alvo: v, alvoForma: null }), true), { lista: nomes }));
      const dA = this.defs[cfg.alvo];
      if (dA && Object.keys(dA.formas).length > 1) pb.appendChild(E.campo('select', 'Forma do alvo', cfg.alvoForma || dA.formaInicial, (v) => this.aplicarCfg(Object.assign({}, cfg, { alvoForma: v }), true), { lista: Object.entries(dA.formas).map(([k, f]) => [k, f.nome || k]) }));
      pb.appendChild(E.campo('select', 'Quem solta é', cfg.lado, (v) => this.aplicarCfg(Object.assign({}, cfg, { lado: v }), true), { lista: [['heroi', 'herói (esquerda)'], ['inimigo', 'inimigo (direita)']] }));
      const lista1 = (excluir) => [['', 'nenhum']].concat(nomes.filter(n => n[0] !== excluir));
      const mudarLista = (campo, i, v) => {
        const arr = (cfg[campo] || []).slice(); arr[i] = v;
        this.aplicarCfg(Object.assign({}, cfg, { [campo]: arr.filter(Boolean) }), true);
      };
      const par = cfg.parceiros || [], ali = cfg.aliadosAlvo || [];
      const ladoAtk = cfg.lado === 'inimigo' ? 'direita' : 'esquerda', ladoAlvo = cfg.lado === 'inimigo' ? 'esquerda' : 'direita';
      // fileira de quem solta e do alvo (visão Diagonal): testar o golpe nos 3 lugares onde os lutadores aparecem
      const FILAS = [['', 'a do jogo'], ['frente', '1 · frente (embaixo)'], ['meio', '2 · meio'], ['fundo', '3 · fundo (perto do horizonte)']];
      const mudarFila = (k, v) => { const aj = this.ajuste; if (aj) this.desligarAjuste(true); cfg[k] = v || null; if (!v) delete cfg[k]; E.rascunho.gravar('golpe_cfg', cfg); this.irPara(this.t); if (this.renderFilas) this.renderFilas(); if (aj) this.ligarAjuste(); };
      pb.appendChild(E.el('div', 'es-dica', 'Na cena do golpe só aparecem quem solta, o alvo e os parceiros com trilha.'));
      pb.appendChild(E.campo('select', 'Parceiro 1 (' + ladoAtk + ')', par[0] || '', (v) => mudarLista('parceiros', 0, v), { lista: lista1(cfg.atacante), dica: 'Entra no time de quem solta (Sparking Combo: o parceiro ganha uma trilha própria)' }));
      if (par[0]) pb.appendChild(E.campo('select', 'Parceiro 2 (' + ladoAtk + ')', par[1] || '', (v) => mudarLista('parceiros', 1, v), { lista: lista1(cfg.atacante), dica: 'Terceiro lutador do time de quem solta' }));
      L.appendChild(pb);
    },

    async confirmarTroca(fn) {
      if (this.sujo) {
        const r = await E.escolha('Mudanças não salvas', 'O golpe "' + (this.doc.golpe.nome || '') + '" tem mudanças que ainda não foram salvas no jogo. O que fazer?', [
          { txt: '💾 Salvar e trocar', valor: 'salvar', cls: 'es-bt-ouro' },
          { txt: 'Trocar sem salvar', valor: 'descartar', cls: 'es-bt-perigo' },
          { txt: 'Ficar neste golpe', valor: null },
        ]);
        if (!r) return;
        if (r === 'salvar') this.salvar();
        this.sujo = false;
      }
      fn();
    },

    // ---------- abrir / criar ----------
    ctxConversao() {
      return { spriteDe: (q) => this.spriteDe(q), animsDe: (q) => (this.formaDe(q) || {}).anims || {} };
    },
    async abrirGolpe(pid, gid) {
      if (pid !== this.cfg.atacante) await this.aplicarCfg(Object.assign({}, this.cfg, { atacante: pid, forma: null }));
      const def = this.defs[pid];
      const g = def.golpes[gid];
      if (!g) return E.aviso('Golpe não encontrado: ' + gid, 'erro');
      const fm = (Object.entries(def.formas).find(([, f]) => (f.golpes || []).includes(gid)) || [])[0];
      if (fm && fm !== this.cfg.forma) await this.aplicarCfg(Object.assign({}, this.cfg, { forma: fm }));
      if (g.mostrar && g.mostrar.buff && this.cfg.buff !== g.mostrar.buff) await this.aplicarCfg(Object.assign({}, this.cfg, { buff: g.mostrar.buff }));
      this.abrirDoc({ origem: { tipo: 'golpe', personagem: pid, forma: this.cfg.forma, id: gid }, golpe: this.meta(g), linha: this.linhaDe(g) });
    },
    async abrirHabilidade(id) {
      const h = FF.Habilidades.ler()[id];
      if (!h) return E.aviso('Habilidade não encontrada.', 'erro');
      if (h.personagem !== this.cfg.atacante || (h.forma && h.forma !== this.cfg.forma)) await this.aplicarCfg(Object.assign({}, this.cfg, { atacante: h.personagem, forma: h.forma || null }));
      this.abrirDoc({ origem: { tipo: 'habilidade', personagem: h.personagem, forma: h.forma || this.cfg.forma, id }, golpe: this.meta(h.golpe), linha: this.linhaDe(h.golpe) });
    },
    // cena de KO (js/battle/ko.js): id = 'padrao' ou o personagem derrotado (fica como Alvo no palco)
    async abrirKO(id) {
      if (id !== 'padrao' && id !== 'supremo' && id !== this.cfg.alvo) await this.aplicarCfg(Object.assign({}, this.cfg, { alvo: id, alvoForma: null }));
      const nome = id === 'padrao' ? 'Cena de KO (padrão)' : id === 'supremo' ? 'KO por Supremo (vaporizado)' : 'KO de ' + ((this.defs[id] || {}).nome || id);
      this.abrirDoc({ origem: { tipo: 'ko', id, personagem: this.cfg.atacante, forma: this.cfg.forma }, golpe: { nome }, linha: FF.KO.linhaDe(id) });
      if (id !== 'padrao' && id !== 'supremo' && !FF.KO.temPropria(id)) E.aviso('💀 ' + nome + ': começa pela cena padrão. Ao salvar, vira a cena própria dele.');
    },
    abrirAbertura(id) {
      const d = this.defs[this.cfg.atacante] || {};
      const sup = Object.values(d.golpes || {}).find(g => g.supremo);
      const nome = id === 'padrao' ? 'Abertura do Supremo (padrão)' : 'Abertura do Supremo de ' + (d.nome || id);
      this.abrirDoc({ origem: { tipo: 'abertura', id, personagem: this.cfg.atacante, forma: this.cfg.forma }, golpe: { nome, nomeFaixa: sup ? sup.nome : 'Golpe Supremo' }, linha: FF.Abertura.linhaDe(id) });
      if (id !== 'padrao' && !FF.Abertura.temPropria(id)) E.aviso('⚡ ' + nome + ': começa pela padrão. Ao salvar, vira a abertura própria dele.');
    },
    nomeSupremo() { const d = this.defs[this.cfg.atacante] || {}; const sup = Object.values(d.golpes || {}).find(g => g.supremo); return sup ? sup.nome : 'Golpe Supremo'; },
    abrirCena(qual, tipo, id) {
      const d = this.defs[this.cfg.atacante] || {};
      const nomesT = { normal: 'Normal', rush: 'Rush', supremo: 'Supremo' };
      const nome = (qual === 'saida' ? 'Saída' : 'Entrada') + ' da cena · ' + nomesT[tipo] + (id === 'padrao' ? ' (padrão)' : ' · ' + (d.nome || id));
      this.abrirDoc({ origem: { tipo: 'cena', qual, tipoCena: tipo, id, personagem: this.cfg.atacante, forma: this.cfg.forma }, golpe: { nome, nomeFaixa: tipo === 'supremo' ? this.nomeSupremo() : 'Nome do golpe', _cenaDoc: qual }, linha: FF.CenaGolpe.linhaDe(qual, tipo, id) });
      if (id !== 'padrao' && !FF.CenaGolpe.temPropria(qual, tipo, id)) E.aviso('🎬 ' + nome + ': começa pela padrão. Ao salvar, vira a própria dele.');
    },
    abrirSparking(id) {
      const d = this.defs[this.cfg.atacante] || {};
      const nome = 'Entrada no Sparking' + (id === 'padrao' ? ' (padrão)' : ' · ' + (d.nome || id));
      this.abrirDoc({ origem: { tipo: 'sparking', id, personagem: this.cfg.atacante, forma: this.cfg.forma }, golpe: { nome, nomeFaixa: 'SPARKING!' }, linha: FF.Sparking.linhaDe(id) });
      if (id !== 'padrao' && !FF.Sparking.temPropria(id)) E.aviso('⚡ ' + nome + ': começa pela padrão. Ao salvar, vira a própria dele.');
    },
    meta(g) { const m = E.copia(g); delete m.roteiro; delete m.habId; return m; },
    linhaDe(g) {
      const r = g.roteiro || [];
      if (r.length === 1 && r[0].linha) return E.copia(r[0].linha);
      const l = FF.Linha.converter(r, this.ctxConversao());
      return l;
    },
    novo() {
      this.confirmarTroca(() => {
        const s = this.spriteDe('atacante');
        const anims = s ? Object.keys(s.def.anims) : [];
        const at = anims.find(a => /attack|ataque|special/i.test(a)) || 'parado';
        const linha = { duracao: 1.2, trilhas: this.trilhasPadrao() };
        linha.trilhas[0].clipes.push({ id: novoId(), tipo: 'anim', t: 0, anim: at });
        linha.trilhas.find(t => t.id === 'acertos').clipes.push({ id: novoId(), tipo: 'acerto', t: 0.6, fracao: 1, forca: 'media' });
        this.abrirDoc({ origem: { tipo: 'novo', personagem: this.cfg.atacante, forma: this.cfg.forma }, golpe: { nome: 'Golpe novo', descricao: '', tipo: 'energia', custoKi: 20, poder: 2 }, linha });
        this.sujo = true;
      });
    },
    trilhasPadrao() {
      return [
        { id: 'atacante', tipo: 'lutador', quem: 'atacante', nome: 'Quem solta', clipes: [] },
        { id: 'alvo', tipo: 'lutador', quem: 'alvo', nome: 'Alvo', clipes: [] },
        { id: 'efeitos', tipo: 'efeitos', nome: 'Efeitos', clipes: [] },
        { id: 'projeteis', tipo: 'projeteis', nome: 'Projéteis', clipes: [] },
        { id: 'camadas', tipo: 'camadas', nome: 'Camadas livres', clipes: [] },
        { id: 'sons', tipo: 'sons', nome: 'Sons e vozes', clipes: [] },
        { id: 'acertos', tipo: 'acertos', nome: 'Acertos', clipes: [] },
        { id: 'tela', tipo: 'tela', nome: 'Tela (tremor, flash, câmera)', clipes: [] },
        { id: 'acoes', tipo: 'acoes', nome: 'Ações (ki, buff, transformar…)', clipes: [] },
      ];
    },
    abrirDoc(doc, rot) {
      this.pausar();
      // garante ids e trilhas
      doc.linha.trilhas = doc.linha.trilhas || [];
      doc.linha.trilhas.forEach(tr => (tr.clipes = tr.clipes || []).forEach(c => { if (!c.id) c.id = novoId(); this.restaurarBase(c); }));
      this.ajuste = null;
      this.extrairImpactos(doc.linha);
      this.doc = doc;
      this.sel = null; this.trSel = null; this.t = 0; this.loop = null;
      if (this.multi) this.multi.clear();
      this.sujo = false;
      this.historico.zerar(rot || 'Abrir');
      this.montarLado();
      this.tudo();
      this.tl.enquadrar();
      this.salvarRascunho();
      // sprites de outros personagens usados no golpe (efeitos/animações emprestadas)
      const extras = (doc.golpe.spritesUsados || []).filter(id => !FF.Assets.sprites[id]);
      if (!FF.Linha.pronta(doc.linha) || extras.length) Promise.all([FF.Linha.preparar(doc.linha), ...extras.map(id => FF.Assets.loadSprite(id).catch(() => null))]).then(() => { if (this.doc === doc) this.tudo(); });
    },

    // ---------- consultas usadas pela linha do tempo e pelas propriedades ----------
    linha() { return this.doc && this.doc.linha; },
    achar(id) { if (!id || !this.doc) return null; for (const tr of this.doc.linha.trilhas) for (const c of tr.clipes) if (c.id === id) return { c, tr }; return null; },
    clipe() { const a = this.achar(this.sel); return a && a.c; },
    trilha() { const a = this.achar(this.sel); if (a) return a.tr; return this.doc && this.doc.linha.trilhas.find(t => t.id === this.trSel); },
    formaDe(quem) {
      const cfg = this.cfg;
      if (!quem || quem === 'atacante') { const d = this.defs[cfg.atacante]; return d && d.formas[cfg.forma]; }
      if (quem === 'alvo') { const d = this.defs[cfg.alvo]; return d && d.formas[cfg.alvoForma || d.formaInicial || Object.keys(d.formas)[0]]; }
      const d = this.defs[quem]; return d && d.formas[d.formaInicial || Object.keys(d.formas)[0]];
    },
    spriteDe(quem) { const f = this.formaDe(quem); return f && FF.Assets.sprites[f.sprite]; },
    animsDe(quem) { const s = this.spriteDe(quem); return s ? Object.keys(s.def.anims) : []; },
    personagens() { return [...new Set([...(this.cfg.parceiros || []), ...(this.cfg.aliadosAlvo || [])])].filter(id => id !== this.cfg.atacante && id !== this.cfg.alvo); },
    prefixoVoz() { const d = this.defs[this.cfg.atacante]; const v = (d && d.vozes && d.vozes.dano) || []; const s = Array.isArray(v) ? v[0] : v; return s ? String(s).replace(/\d+$/, '').slice(0, 4) : ''; },
    animDoClipe(c, tr) {
      if (c.tipo === 'anim' && c.sprite && FF.Assets.sprites[c.sprite]) { const so = FF.Assets.sprites[c.sprite]; return so.anim(FF.Linha.trecho(so, c.anim, c.de, c.ate)); }
      const s = this.spriteDe(tr.quem), f = this.formaDe(tr.quem);
      if (!s) return null;
      const nome = c.tipo === 'teleporte' ? (c.animMov || 'teleporte') : c.anim;
      const real = ((f && f.anims) || {})[nome] || nome;
      return s.anim(c.tipo === 'anim' ? FF.Linha.trecho(s, real, c.de, c.ate) : real);
    },
    // 〰 Caminho novo: dois pontos à frente do lutador (um no ar e outro no chão), para arrastar no palco
    novoCaminho(tr) {
      const b = this.palco && this.palco._b, f = b && FF.Linha.lutadorDe(b, b.atk, b.alvo, tr.quem);
      const lx = FF.legado().x, x0 = f ? f.x - lx : 300, dir = f ? f.dir : 1;
      return { tipo: 'caminho', d: 0.6, ritmo: 'suave', animMov: 'avancar', pontos: [{ x: Math.round(x0 + 180 * dir), y: -120 }, { x: Math.round(x0 + 360 * dir), y: 0 }] };
    },
    redimensionavel(c) { return ['anim', 'mover', 'caminho', 'efeito', 'projetil', 'camada', 'mensagem', 'camera', 'vaporizar', 'escurecer', 'linhas', 'faixa', 'tremer', 'flash', 'retrato'].includes(c.tipo); },
    dur(c, tr) {
      switch (c.tipo) {
        case 'anim': { if (c.d != null) return c.d + (c.segurar || 0); const a = this.animDoClipe(c, tr); return (c.segurar || 0) + (a ? FF.Linha.duracaoAnim(a, c.fps || undefined) : 0.3); }
        case 'teleporte': { const a = this.animDoClipe(c, tr); return a ? FF.Linha.duracaoAnim(a) : 0.25; }
        case 'mover': return c.d || 0.22;
        case 'caminho': return c.d || 0.6;
        case 'vaporizar': return c.d || 1.2;
        case 'escurecer': case 'linhas': case 'faixa': return c.d || 1.5;
        case 'retrato': return c.d || 1.2;
        case 'corte': return 0.05;
        case 'efeito': { if (c.d) return c.d; const s = c.sprite ? FF.Assets.sprites[c.sprite] : (FF.Assets.sprites.fx.has(c.fx) ? FF.Assets.sprites.fx : FF.Assets.sprites.fx_extra); const a = s && s.anim(c.fx); return a ? FF.Linha.duracaoAnim(a, c.fps || undefined) : 0.3; }
        case 'camada': return c.d != null ? c.d : 1;
        case 'projetil': {   // d = tempo total (espera no ar + voo); sem d, a velocidade decide o voo
          const esp = Math.max(0, +c.espera || 0);
          if (c.d > 0) return Math.max(c.d, esp + 0.05);
          const b = this.palco._b; const dist = b ? Math.abs(b.alvo.x - b.atk.x) * 0.9 : 600; return esp + Math.max(0.05, dist / (c.velocidade || 650));
        }
        case 'mensagem': return c.d || 1.3;
        case 'camera': return c.d || 0;
        // sem duração: o tempo que o impacto leva para sumir sozinho (tremor cai até ~0,3; flash perde 2,5 por segundo)
        case 'tremer': return c.d || Math.max(0.1, Math.log(0.3 / (c.forca || 6)) / Math.log(0.001));
        case 'flash': return c.d || Math.max(0.05, (c.forca || 0.5) / 2.5);
      }
      return 0;
    },
    quadros(c, tr) {
      if (c.tipo !== 'anim' && c.tipo !== 'teleporte') return null;
      const a = this.animDoClipe(c, tr);
      if (!a) return null;
      const out = [];
      let t = c.segurar || 0;
      const total = this.dur(c, tr);
      let f = c.fps || a.fps; if (!f && a.frames.length > 1) f = 10; if (!f) return null;
      for (let i = 0, k = 0; t < total - 1e-6 && k < 400; k++) {
        out.push(t);
        t += (a.frames[i][7] || 1) / f;
        i++;
        if (i >= a.frames.length) { if (c.d != null || c.loop) i = a.repeatTo || 0; else break; }
      }
      return out;
    },

    // ---------- mudanças ----------
    autoDuracao() {
      const L = this.doc.linha;
      if (L.duracaoManual) return;
      let fim = 0.3;
      L.trilhas.forEach(tr => tr.clipes.forEach(c => { fim = Math.max(fim, c.t + this.dur(c, tr)); }));
      L.duracao = Math.round((fim + 0.1) * 1000) / 1000;
    },
    // rotulo: texto para o desfazer; juntar: agrupa mudanças seguidas; arrastando: ainda no meio de um arraste
    mudou(rot, juntar, arrastando) {
      if (this.ajuste) this.guardarAjuste();
      this.sincronizarPresos();
      this.autoDuracao();
      this.sujo = true;
      if (!arrastando) { this.historico.marcar(rot, juntar); this.salvarRascunho(); }
      this.irPara(this.t, arrastando);
      this.tl.render();
      if (RERENDER.has(rot) || (!juntar && !arrastando && this._deCanvas)) this.renderProps();
      this.renderRodape();
    },
    // ---------- explosões do impacto de um objeto lançado (Genki Dama, Esfera da Destruição…) ----------
    // Viram clipes de efeito de verdade na trilha Efeitos, "presos" ao clipe que lança o objeto: o tempo deles
    // acompanha o lançamento (início + tempo até chegar + ajuste). No jogo é um efeito comum (prende/extra são ignorados).
    trilhaEfeitos(L) {
      L = L || this.doc.linha;
      let tr = L.trilhas.find(t => t.tipo === 'efeitos');
      if (!tr) { tr = { id: 'efeitos', tipo: 'efeitos', nome: 'Efeitos', clipes: [] }; L.trilhas.splice(2, 0, tr); }
      return tr;
    },
    clipeEfeitoDoImpacto(acao, ef) {
      const lo = acao.passo.lancarObjeto;
      const c = { id: novoId(), tipo: 'efeito', t: Math.round((acao.t + (lo.tempo || 1)) * 1000) / 1000, fx: ef.fx, em: ef.chao ? 'alvoPes' : 'alvo', prende: acao.id, extra: 0 };
      ['dx', 'dy', 'escala', 'fps', 'alpha', 'sprite'].forEach(k => { if (ef[k] != null) c[k] = ef[k]; });
      if (ef.duracao) c.d = ef.duracao;
      return c;
    },
    extrairImpactos(L) {
      const tr = this.trilhaEfeitos(L);
      L.trilhas.forEach(t => t.clipes.forEach(c => {
        const lo = c.tipo === 'acao' && c.passo && c.passo.lancarObjeto;
        if (!lo || !Array.isArray(lo.impacto) || !lo.impacto.length) return;
        lo.impacto.forEach(ef => { if (ef && ef.fx) tr.clipes.push(this.clipeEfeitoDoImpacto(c, ef)); });
        lo.impacto = [];
      }));
    },
    baseDoPreso(c) {
      const a = this.achar(c.prende);
      const lo = a && a.c.tipo === 'acao' && a.c.passo && a.c.passo.lancarObjeto;
      return lo ? a.c.t + (lo.tempo || 1) : null;
    },
    sincronizarPresos() {
      if (!this.doc) return;
      this.doc.linha.trilhas.forEach(tr => tr.clipes.forEach(c => {
        if (!c.prende) return;
        const base = this.baseDoPreso(c);
        if (base == null) { delete c.prende; delete c.extra; return; }          // o lançamento foi apagado: fica solto
        if (c.id === this.sel) c.extra = Math.round((c.t - base) * 1000) / 1000; // arrastou o próprio efeito: guarda o ajuste
        else c.t = Math.max(0, Math.round((base + (c.extra || 0)) * 1000) / 1000);
      }));
    },
    explosaoNoImpacto(acao) {
      const tr = this.trilhaEfeitos();
      const c = this.clipeEfeitoDoImpacto(acao, { fx: 'Explosao15', escala: 0.8 });
      tr.clipes.push(c);
      this.sel = c.id;
      this.mudou('Explosão no impacto');
      this.renderProps();
    },

    salvarRascunho() {
      clearTimeout(this._rt);
      this._rt = setTimeout(() => E.rascunho.gravar('golpe_doc', this.doc ? { doc: this.doc, t: Date.now() } : null), 300);
    },
    antesDeSair() { if (this.doc) E.rascunho.gravar('golpe_doc', { doc: this.doc, t: Date.now() }); },

    selecionar(id, trId, doCanvas) {
      this.sel = id;
      if (trId) this.trSel = trId;
      const a = this.achar(id);
      if (a) {
        // leva o cursor para dentro do clipe (para ver e posicionar no palco)
        const d = this.dur(a.c, a.tr);
        if (this.t < a.c.t || this.t > a.c.t + Math.max(d, 0.02)) this.irPara(a.c.t + Math.min(d * 0.35, 0.12) + (a.c.tipo === 'acerto' || a.c.tipo === 'projetil' ? 0.001 : 0));
      }
      this.renderProps();
      this.tl.render();
    },
    adicionar(trId, t) {
      const tr = this.doc.linha.trilhas.find(x => x.id === trId);
      if (!tr) return;
      const criar = (c) => {
        c.id = novoId(); c.t = Math.max(0, Math.round(t * 1000) / 1000);
        tr.clipes.push(c);
        this.sel = c.id; this.trSel = tr.id;
        this.mudou('Novo clipe');
        this.renderProps();
      };
      const s = this.spriteDe(tr.quem);
      const opcoes = {
        lutador: [['🎬 Animação', () => criar({ tipo: 'anim', anim: (s && Object.keys(s.def.anims)[0]) || 'parado' })], ['➡ Mover', () => criar({ tipo: 'mover', d: 0.22, para: 'alvo', dist: 24, animMov: 'avancar' })], ['⚡ Teleporte', () => criar({ tipo: 'teleporte', para: 'casa' })], ['〰 Caminho', () => criar(this.novoCaminho(tr))], ['🙈 Sumir', () => criar({ tipo: 'visivel', alpha: 0 })], ['👁 Aparecer', () => criar({ tipo: 'visivel', alpha: 1 })], ['💨 Vaporizar', () => criar({ tipo: 'vaporizar', d: 1.2 })]],
        sons: [['♪ Som', () => criar({ tipo: 'som', som: 'hit_small-a' })], ['🗣 Voz', () => criar({ tipo: 'voz', voz: ((this.defs[this.cfg.atacante].vozes || {}).dano || ['vgkn100'])[0] })]],
        tela: [['🌑 Escurecer', () => criar({ tipo: 'escurecer', d: 1.5, forca: 0.65 })], ['💨 Linhas de velocidade', () => criar({ tipo: 'linhas', d: 1.5 })], ['🎌 Faixa com o nome', () => criar({ tipo: 'faixa', d: 1.5, texto: '{golpe}' })], ['〰 Tremor', () => criar({ tipo: 'tremer', forca: 8 })], ['✦ Flash / clarão', () => criar({ tipo: 'flash', forca: 0.5 })], ['✂ Corte para a cena', () => criar({ tipo: 'corte' })], ['🖼 Retrato', () => criar({ tipo: 'retrato', d: 1.2 })], ['🎥 Câmera', () => criar({ tipo: 'camera', d: 0.3, zoom: 1.4, foco: 'alvo' })], ['💬 Mensagem', () => criar({ tipo: 'mensagem', texto: 'Texto', d: 1.3 })]],
      }[tr.tipo];
      if (opcoes) {
        const c = E.el('div', 'es-menu-clipes');
        const m = E.modal('Novo clipe em "' + (tr.nome || tr.tipo) + '"', c);
        opcoes.forEach(([n, fn]) => c.appendChild(E.botao(n, () => { m.fechar(); fn(); })));
        return;
      }
      const fx2 = FF.Assets.sprites.fx_extra;
      criar({
        efeitos: { tipo: 'efeito', fx: 'hit3', em: 'alvo', escala: 1 },
        projeteis: { tipo: 'projetil', fx: 'kiblast_amarelo', velocidade: 650, acerto: { fracao: 0.3, forca: 'energia' } },
        camadas: { tipo: 'camada', sprite: 'fx_extra', anim: fx2 ? Object.keys(fx2.def.anims)[0] : '', d: 1, ancora: 'atacante', x: 60, y: -60, escala: 1 },
        acertos: { tipo: 'acerto', fracao: 0.3, forca: 'leve' },
        acoes: { tipo: 'acao', passo: { ki: 10 } },
      }[tr.tipo] || { tipo: 'som', som: 'hit_small-a' });
    },
    // duplo clique num clipe da linha do tempo: abre o seletor do que ele toca/mostra
    trocarConteudo(c, tr) {
      const P = FF.EstudioProps, quem = tr.quem || 'atacante';
      const pronto = (rot) => { this.mudou(rot); this.renderProps(); };
      // vários marcados: o 1º entra no lugar deste clipe e os outros vêm em seguida na mesma trilha, um depois do outro
      const emSeguida = (k, ks, rot) => (l) => {
        let t = c.t;
        l.forEach(([fx, spr], i) => {
          const n = i ? Object.assign(JSON.parse(JSON.stringify(c)), { id: novoId() }) : c;
          n[k] = fx; if (spr) n[ks] = spr; else delete n[ks];
          n.t = Math.round(t * 1000) / 1000;
          if (i) tr.clipes.push(n);
          t += Math.max(this.dur(n, tr), 0.05);
        });
        pronto(l.length > 1 ? rot + ' (' + l.length + ' em seguida)' : rot);
      };
      const efeito = (k, ks, rot, varios) => P.escolherEfeito(c[k], (fx, spr) => { c[k] = fx; if (spr) c[ks] = spr; else delete c[ks]; pronto(rot); }, null, this, c[ks], varios ? emSeguida(k, ks, rot) : null);
      switch (c.tipo) {
        case 'som': return E.escolherSom(c.som, (v) => { c.som = v; pronto('Som'); });
        case 'voz':
          if (c.vozTipo) { delete c.vozTipo; delete c.quem; }   // escolher um arquivo troca a "voz do personagem" por um som fixo
          return E.escolherSom(c.voz, (v) => { c.voz = v; pronto('Voz'); }, this.prefixoVoz());
        case 'efeito': return efeito('fx', 'sprite', 'Efeito', true);
        case 'projetil': return efeito('fx', 'sprite', 'Projétil', true);
        case 'acerto':   // acerto: troca a explosão ou o som do impacto
          return E.escolha('✸ Acerto', 'O que você quer trocar neste acerto?', [
            { txt: '✺ Efeito (explosão)', valor: 'fx', cls: 'es-bt-ouro' }, { txt: '♪ Som do acerto', valor: 'som', cls: 'es-bt-ouro' }, { txt: 'Cancelar', valor: null }])
            .then(v => {
              if (v === 'fx') efeito('fx', 'sprite', 'Explosão');
              else if (v === 'som') E.escolherSom(c.som || '', (s) => { c.som = s; pronto('Som do acerto'); });
            });
        case 'anim': {
          const prop = this.spriteDe(quem), pid = prop && (prop.def.id || Object.keys(FF.Assets.sprites).find(k => FF.Assets.sprites[k] === prop));
          return E.escolherSprite({ titulo: '🎬 Animação (de qualquer sprite)', atual: { anim: c.anim, sprite: c.sprite || pid }, inicio: c.sprite || pid,
            aoEscolher: (a, id) => { c.anim = a; if (id && id !== pid) c.sprite = id; else delete c.sprite; pronto('Animação'); } });
        }
        case 'mover': case 'teleporte': case 'caminho':
          return P.escolherAnim(this.spriteDe(quem), c.animMov, (a) => { c.animMov = a; pronto('Animação'); });
        case 'camada':
          return E.escolherSprite({ titulo: '▣ Sprite da camada', atual: { anim: c.anim, sprite: c.sprite }, inicio: c.sprite, aoEscolher: (a, id) => { c.sprite = id; c.anim = a; pronto('Sprite da camada'); } });
        default: return null;   // os outros (tremor, câmera, ação…) se mudam pelas propriedades
      }
    },
    remover() {
      if (this.multi && this.multi.size > 1) {   // vários selecionados (Shift+clique): apaga todos
        const ids = new Set(this.multi);
        this.doc.linha.trilhas.forEach(tr => { tr.clipes = tr.clipes.filter(c => !ids.has(c.id)); });
        this.multi.clear(); this.sel = null;
        this.mudou('Apagar clipes'); this.renderProps();
        return;
      }
      const a = this.achar(this.sel); if (!a) return;
      a.tr.clipes = a.tr.clipes.filter(c => c !== a.c);
      this.sel = null;
      this.mudou('Apagar clipe');
      this.renderProps();
    },
    duplicar() {
      const a = this.achar(this.sel); if (!a) return;
      const c = E.copia(a.c); c.id = novoId(); c.t = Math.round((a.c.t + Math.max(this.dur(a.c, a.tr), 0.1)) * 1000) / 1000;
      a.tr.clipes.push(c); this.sel = c.id;
      this.mudou('Duplicar clipe'); this.renderProps();
    },
    copiar() { const a = this.achar(this.sel); if (a) { this.copiado = { c: E.copia(a.c), tipo: a.tr.tipo }; E.aviso('📋 Clipe copiado'); } },
    colar() {
      if (!this.copiado) return;
      const tr = this.trilha() && this.trilha().tipo === this.copiado.tipo ? this.trilha() : this.doc.linha.trilhas.find(t => t.tipo === this.copiado.tipo);
      if (!tr) return;
      const c = E.copia(this.copiado.c); c.id = novoId(); c.t = Math.round(this.t * 1000) / 1000;
      tr.clipes.push(c); this.sel = c.id; this.trSel = tr.id;
      this.mudou('Colar clipe'); this.renderProps();
    },
    novaTrilha() {
      const c = E.el('div', 'es-menu-clipes');
      const m = E.modal('＋ Nova trilha', c);
      TIPOS_TRILHA.forEach(([tipo, nome]) => c.appendChild(E.botao(nome, () => {
        m.fechar();
        const tr = { id: 't' + novoId(), tipo, nome: nome.replace(/^\S+\s/, ''), clipes: [] };
        if (tipo === 'lutador') { tr.quem = (this.cfg.parceiros || [])[0] || 'alvo'; tr.nome = tr.quem === 'alvo' ? 'Alvo (2)' : 'Parceiro: ' + tr.quem; if (!this.cfg.parceiros.length) E.aviso('Dica: escolha um Parceiro no painel da esquerda (Sparking Combo) e mude o lutador da trilha.'); }
        this.doc.linha.trilhas.push(tr);
        this.trSel = tr.id; this.sel = null;
        this.mudou('Nova trilha'); this.renderProps();
      })));
    },
    async removerTrilha(id) {
      const tr = this.doc.linha.trilhas.find(t => t.id === id);
      if (!tr) return;
      if (tr.clipes.length && !(await E.confirmar('Apagar trilha', 'Apagar a trilha "' + (tr.nome || tr.tipo) + '" e seus ' + tr.clipes.length + ' clipe(s)?', '🗑 Apagar', true))) return;
      this.doc.linha.trilhas = this.doc.linha.trilhas.filter(t => t !== tr);
      this.trSel = null; this.sel = null;
      this.mudou('Apagar trilha'); this.renderProps();
    },
    gravarChave() {
      const c = this.clipe(); if (!c || c.tipo !== 'camada') return;
      const tl = Math.round((this.t - c.t) * 1000) / 1000;
      const est = FF.Cena.estado(c, tl);
      c.chaves = (c.chaves || []).filter(k => Math.abs(k.t - tl) > 0.005);
      c.chaves.push({ t: tl, x: Math.round(est.x), y: Math.round(est.y), escala: +est.escala.toFixed(3), alpha: +est.alpha.toFixed(3), rot: Math.round(est.rot) });
      c.chaves.sort((a, b) => a.t - b.t);
      this.mudou('Gravar chave'); this.renderProps();
    },

    // ---------- tempo ----------
    irPara(t, arrastando) {
      if (!this.doc) return;
      this.t = Math.max(0, t);
      if (this.palco.modo === 'batalha') return;
      this.palco.irPara(this.golpeAtual(), this.doc.linha, this.t);
      // no meio de um arraste o laço de quadros (quadro()) já redesenha o palco a cada quadro: não desenha duas vezes
      if (!arrastando) this.redesenhar();
      if (!arrastando) this.tl.seguir();
      this.tl.desenhar();
    },
    golpeAtual() { return Object.assign({}, this.doc.golpe); },
    tocar() {
      if (this.palco.modo === 'batalha') return;
      const L = this.doc.linha;
      if (this.t >= L.duracao - 0.01) this.t = this.loop ? this.loop.a : 0;
      if (this.loop && (this.t < this.loop.a || this.t >= this.loop.b)) this.t = this.loop.a;
      this.palco.irPara(this.golpeAtual(), L, this.t);
      this.palco._acum = 0;
      this.tocando = true;
      this.btPlay.textContent = '⏸';
    },
    pausar() { this.tocando = false; if (this.btPlay) this.btPlay.textContent = '▶'; },
    alternar() { if (this.tocando) this.pausar(); else this.tocar(); },
    passoQuadro(dir, grande) {
      this.pausar();
      // próximo/anterior limite de quadro de qualquer animação; sem animação, 1/60 s
      const L = this.doc.linha;
      const marcas = new Set();
      L.trilhas.forEach(tr => tr.clipes.forEach(c => (this.quadros(c, tr) || []).forEach(q => marcas.add(Math.round((c.t + q) * 1000) / 1000))));
      const l = [...marcas].sort((a, b) => a - b);
      let alvo;
      if (grande) alvo = this.t + dir * 10 / 60;
      else if (dir > 0) alvo = l.find(x => x > this.t + 0.0005);
      else alvo = [...l].reverse().find(x => x < this.t - 0.0005);
      if (alvo == null || Math.abs(alvo - this.t) > 0.25) alvo = this.t + dir / 60;
      this.irPara(Math.max(0, alvo) + 0.0005);
    },
    quadro(dt) {
      if (!this.doc) return;
      const p = this.palco;
      if (p.modo === 'batalha') { p.quadroBatalha(dt); p.desenhar(); return; }
      if (this.tocando) {
        p.tocar(dt * this.vel);
        this.t = p.tempo;
        const fim = this.loop ? this.loop.b : this.doc.linha.duracao + 0.25;
        if (this.t >= fim) {
          if (this.loop || this.ckRepetir.checked) { this.t = this.loop ? this.loop.a : 0; p.irPara(this.golpeAtual(), this.doc.linha, this.t); p._acum = 0; }
          else { this.pausar(); this.t = Math.min(this.t, this.doc.linha.duracao); }
        }
        this.tl.seguir();
        this.tl.desenhar();
      }
      this.redesenhar();
    },

    // ---------- barra de controles ----------
    montarBarra() {
      const b = this.barra;
      b.innerHTML = '';
      b.appendChild(E.botao('⏮', () => this.irPara(this.loop ? this.loop.a : 0), 'Início (Home)'));
      b.appendChild(E.botao('◀', () => this.passoQuadro(-1), 'Quadro anterior (←)'));
      this.btPlay = E.botao('▶', () => this.alternar(), 'Tocar / pausar (Espaço)', 'es-bt-ouro es-bt-play');
      b.appendChild(this.btPlay);
      b.appendChild(E.botao('▶|', () => this.passoQuadro(1), 'Próximo quadro (→)'));
      b.appendChild(E.botao('⏭', () => this.irPara(this.doc.linha.duracao), 'Fim (End)'));
      const vel = E.campo('select', '', '1', (v) => { this.vel = +v; }, { lista: [['0.25', '0,25×'], ['0.5', '0,5×'], ['1', '1×'], ['1.5', '1,5×'], ['2', '2×']] });
      vel.title = 'Velocidade';
      b.appendChild(vel);
      const rep = E.el('label', '', '<input type="checkbox"> 🔁');
      rep.title = 'Repetir ao chegar no fim';
      this.ckRepetir = rep.querySelector('input');
      b.appendChild(rep);
      b.appendChild(E.el('span', 'sep'));
      const op = (k, txt, dica) => { const l = E.el('label', '', '<input type="checkbox"> ' + txt); l.title = dica; const i = l.querySelector('input'); i.checked = !!this.palco.opts[k]; i.onchange = () => { this.palco.opts[k] = i.checked; E.rascunho.gravar('palco_opts', this.palco.opts); this.redesenhar(); }; return l; };
      Object.assign(this.palco.opts, E.rascunho.ler('palco_opts') || {});
      b.appendChild(op('cebola', '🧅', 'Casca de cebola: quadro anterior (vermelho) e próximo (azul) translúcidos'));
      b.appendChild(op('grade', '▦', 'Grade de 50 px e linha do chão'));
      b.appendChild(op('refs', '✚', 'Pontos de referência: pés (verde), peito (rosa), disparo (amarelo)'));
      b.appendChild(op('hud', 'HUD', 'Mostrar as barras de vida/ki'));
      b.appendChild(op('fora', '🔍 Fora', 'Ver fora da tela: o palco encolhe e mostra uma faixa em volta da tela do jogo, para pegar e posicionar o que está fora dela'));
      this.palco.opts.persp = true;   // sempre diagonal (a visão lateral foi tirada)
      // fileiras rápidas (Diagonal): 🧍 quem solta e 🎯 alvo nos lugares 1 (frente), 2 (meio), 3 (fundo)
      // fileiras e ajustes por combinação saíram: todo golpe que acerta alguém vira cena (palco fixo)
      this.renderFilas = () => {};
      b.appendChild(E.el('span', 'sep'));
      b.appendChild(E.botao('⚔ Na batalha', () => this.naBatalha(), 'Roda o golpe completo na batalha real (dano, anéis de guarda/crítico). Espaço/clique = apertar no anel.'));
      b.appendChild(E.botao('＋ Trilha', () => this.novaTrilha(), 'Nova trilha (efeitos, sons, parceiro…)'));
    },

    async naBatalha() {
      this.pausar();
      const golpe = this.golpeAtual();
      E.aviso('⚔ Rodando na batalha real… aperte Espaço (ou toque no palco) quando o anel fechar.');
      this.palco.naBatalha(golpe, this.doc.linha, (b) => {
        const dano = b.alvo.hpMax - b.alvo.hp;
        E.aviso('Fim: ' + dano + ' de dano em ' + b.alvo.nome + (b.alvo.ko ? ' (nocaute!)' : '') + '.', 'ok');
        this.irPara(this.t);
      });
    },

    // ---------- rodapé (salvar) ----------
    montarRodape() { this.renderRodape(); },
    renderRodape() {
      const r = this.rodape;
      if (!r || !this.doc) return;
      r.innerHTML = '';
      const o = this.doc.origem;
      const salvar = E.botao('💾 Salvar no jogo' + (this.sujo ? ' ●' : ''), () => this.salvar(), 'Vale no jogo inteiro e em todos os aparelhos (Ctrl+S)', 'es-bt-ouro');
      salvar.style.flex = '1';
      r.appendChild(salvar);
      if (o.tipo === 'golpe' && FF.Edicoes.golpeAlterado(o.personagem, o.id)) r.appendChild(E.botao('↺ Original', () => this.original(), 'Volta este golpe ao original do jogo'));
      if (o.tipo === 'ko' && (FF.Edicoes.dados().ko || {})[o.id]) r.appendChild(E.botao('↺ Original', () => this.original(), o.id === 'padrao' ? 'Volta a cena de KO padrão à do jogo' : 'Apaga a cena própria (volta a usar a padrão)'));
      if (o.tipo === 'abertura' && (FF.Edicoes.dados().abertura || {})[o.id]) r.appendChild(E.botao('↺ Original', () => this.original(), o.id === 'padrao' ? 'Volta a abertura padrão à do jogo' : 'Apaga a abertura própria (volta a usar a padrão)'));
      if (o.tipo === 'cena' && FF.CenaGolpe.temSalva(o.qual, o.tipoCena, o.id)) r.appendChild(E.botao('↺ Original', () => this.original(), 'Volta à original (padrão) / apaga a própria'));
      if (o.tipo === 'sparking' && FF.Sparking.temSalva(o.id)) r.appendChild(E.botao('↺ Original', () => this.original(), 'Volta à original (padrão) / apaga a própria'));
      if (!['ko', 'abertura', 'cena', 'sparking'].includes(o.tipo)) r.appendChild(E.botao('⧉', () => this.duplicarGolpe(), 'Duplicar como habilidade nova'));
      if (o.tipo === 'habilidade') r.appendChild(E.botao('🗑', () => this.apagarHab(), 'Apagar esta habilidade', 'es-bt-perigo'));
      r.appendChild(E.botao('🎮', () => this.testarNoJogo(), 'Abrir uma Batalha Livre com este personagem para testar (salve antes)'));
      r.appendChild(E.botao('{ }', () => this.verJson(), 'Ver/colar o JSON do golpe'));
      const tipo = { golpe: 'golpe do jogo', habilidade: '⭐ habilidade', novo: 'novo (vira ⭐ habilidade ao salvar)', ko: '💀 cena de KO', abertura: '⚡ abertura do Supremo', cena: '🎬 cena do golpe', sparking: '⚡ Sparking' }[o.tipo];
      this.titProps.innerHTML = '';
      const t = E.el('span'); t.textContent = (this.doc.golpe.nome || '') + ' · ' + tipo; this.titProps.appendChild(t);
    },
    montarGolpe() {
      const g = E.copia(this.doc.golpe);
      const linha = this.linhaBase();
      g.roteiro = [{ linha }];
      // sprites de que o golpe precisa além dos do lutador (o jogo carrega antes da luta)
      const usados = new Set(FF.Linha.spritesUsados(linha));
      // nomes de efeitos usados em qualquer campo de efeito (fx, impacto, disparo) que não são do fx/fx_extra
      const nomesFx = new Set();
      const varrer = (o) => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && ['fx', 'impacto', 'disparo'].includes(k)) nomesFx.add(v); else varrer(v); } };
      varrer(linha);
      const UTIL = ['fx', 'fx_extra', 'hud_zl3', 'retratos', 'cenarios_preview', 'stage_campo', 'hud_moderno'];
      for (const nome of nomesFx) {
        if (FF.Assets.sprites.fx.has(nome) || (FF.Assets.sprites.fx_extra && FF.Assets.sprites.fx_extra.has(nome))) continue;
        const id = Object.keys(FF.Assets.sprites).find(k => !UTIL.includes(k) && FF.Assets.sprites[k] && FF.Assets.sprites[k].has && FF.Assets.sprites[k].has(nome));
        if (id && FF.Assets.sprites[id] !== this.spriteDe('atacante')) usados.add(id);
      }
      if (usados.size) g.spritesUsados = [...usados]; else delete g.spritesUsados;
      return g;
    },
    salvar() {
      const o = this.doc.origem;
      const g = this.montarGolpe();
      if (!g.nome) g.nome = 'Sem nome';
      if (o.tipo === 'cena' || o.tipo === 'sparking') {
        const linha = this.linhaBase();
        if (g.spritesUsados) linha.spritesUsados = g.spritesUsados;
        if (o.tipo === 'cena') E.salvarNoJogo([o.qual, o.tipoCena, o.id], linha, '🎬 ' + g.nome + ' salva no jogo.');
        else E.salvarNoJogo(['sparking', 'entrada', o.id], linha, '⚡ ' + g.nome + ' salva no jogo.');
      } else if (o.tipo === 'abertura') {
        const linha = this.linhaBase();
        if (g.spritesUsados) linha.spritesUsados = g.spritesUsados;
        E.salvarNoJogo(['abertura', o.id], linha, '⚡ ' + g.nome + ' salva no jogo.');
      } else if (o.tipo === 'ko') {
        const linha = this.linhaBase();
        if (g.spritesUsados) linha.spritesUsados = g.spritesUsados;
        E.salvarNoJogo(['ko', o.id], linha, '💀 ' + g.nome + ' salva no jogo.');
      } else if (o.tipo === 'golpe') {
        E.salvarNoJogo(['golpes', o.personagem, o.id], g, '💾 "' + g.nome + '" salvo no jogo.');
        // o personagem carregado no palco passa a usar o golpe novo
        const d = this.defs[o.personagem]; if (d) FF.Edicoes.aplicarGolpes(d);
      } else {
        const h = FF.Habilidades.salvar({ id: o.tipo === 'habilidade' ? o.id : null, nome: g.nome, personagem: o.personagem, forma: o.forma, golpe: g });
        this.doc.origem = { tipo: 'habilidade', personagem: o.personagem, forma: o.forma, id: h.id };
        E.aviso('⭐ Habilidade "' + g.nome + '" salva' + (h.equipada ? ' e equipada: aparece no menu de golpes do ' + (this.defs[o.personagem].nome || o.personagem) : '') + '.', 'ok');
        E.renderSync();
      }
      this.sujo = false;
      this.historico.marcar('Salvar');
      this.montarLado();
      this.renderRodape();
    },
    async original() {
      const o = this.doc.origem;
      if (o.tipo === 'cena' || o.tipo === 'sparking') {
        const txt = o.id === 'padrao' ? 'Voltar a padrão à original do jogo?' : 'Apagar a versão própria? Ele volta a usar a padrão.';
        if (!(await E.confirmar('Voltar ao original', txt + ' (em todos os aparelhos)', '↺ Voltar', true))) return;
        E.salvarNoJogo(o.tipo === 'cena' ? [o.qual, o.tipoCena, o.id] : ['sparking', 'entrada', o.id], null, '↺ Voltou ao original.');
        this.sujo = false;
        return o.tipo === 'cena' ? this.abrirCena(o.qual, o.tipoCena, o.id) : this.abrirSparking(o.id);
      }
      if (o.tipo === 'abertura') {
        const txt = o.id === 'padrao' ? 'Voltar a abertura padrão à original do jogo?' : 'Apagar a abertura própria? Ele volta a usar a padrão.';
        if (!(await E.confirmar('Voltar ao original', txt + ' (em todos os aparelhos)', '↺ Voltar', true))) return;
        E.salvarNoJogo(['abertura', o.id], null, '↺ Abertura voltou ao original.');
        this.sujo = false;
        return this.abrirAbertura(o.id);
      }
      if (o.tipo === 'ko') {
        const txt = o.id === 'padrao' ? 'Voltar a cena de KO padrão à original do jogo?' : 'Apagar a cena de KO própria? Ele volta a usar a padrão.';
        if (!(await E.confirmar('Voltar ao original', txt + ' (em todos os aparelhos)', '↺ Voltar', true))) return;
        E.salvarNoJogo(['ko', o.id], null, '↺ Cena de KO voltou ao original.');
        this.sujo = false;
        return this.abrirKO(o.id);
      }
      if (!(await E.confirmar('Voltar ao original', 'Voltar "' + this.doc.golpe.nome + '" ao original do jogo? Sua versão será apagada (em todos os aparelhos).', '↺ Voltar ao original', true))) return;
      E.salvarNoJogo(['golpes', o.personagem, o.id], null, '↺ Golpe voltou ao original.');
      this.carregarDefs().then(() => this.abrirGolpe(o.personagem, o.id));
    },
    duplicarGolpe() {
      const d = E.copia(this.doc);
      d.origem = { tipo: 'novo', personagem: d.origem.personagem, forma: d.origem.forma };
      d.golpe.nome = (d.golpe.nome || 'Golpe') + ' (cópia)';
      this.abrirDoc(d, 'Duplicar');
      this.sujo = true; this.renderRodape();
      E.aviso('⧉ Cópia criada: ajuste e salve (vira uma ⭐ habilidade nova).');
    },
    async apagarHab() {
      if (!(await E.confirmar('Apagar habilidade', 'Apagar a habilidade "' + this.doc.golpe.nome + '"? (em todos os aparelhos)', '🗑 Apagar', true))) return;
      FF.Habilidades.apagar(this.doc.origem.id);
      E.aviso('🗑 Habilidade apagada.');
      E.rascunho.gravar('golpe_doc', null);
      this.sujo = false;
      this.abrirGolpe(this.cfg.atacante, Object.keys(this.defs[this.cfg.atacante].golpes)[0]);
    },
    async testarNoJogo() {
      if (this.sujo) {
        const r = await E.escolha('Testar no jogo', 'O jogo usa a versão salva. Salvar as mudanças antes de testar?', [
          { txt: '💾 Salvar e testar', valor: 'salvar', cls: 'es-bt-ouro' }, { txt: 'Testar sem salvar', valor: 'nao' }, { txt: 'Cancelar', valor: null }]);
        if (!r) return;
        if (r === 'salvar') this.salvar();
      }
      const h = [this.cfg.atacante, ...(this.cfg.parceiros || [])].slice(0, 3), i = [this.cfg.alvo, ...(this.cfg.aliadosAlvo || [])].slice(0, 3);
      const herois = this.cfg.lado === 'inimigo' ? i : h, inimigos = this.cfg.lado === 'inimigo' ? h : i;
      const posH = { 1: [170], 2: [250, 150], 3: [250, 150, 350] }[herois.length], posI = { 1: [915], 2: [870, 990], 3: [820, 930, 1020] }[inimigos.length];
      const def = { id: 'livre', saga: 'livre', titulo: 'Teste do Estúdio', cenario: 'campo', musica: 'tournament_theme', escala: herois.length === 1 && inimigos.length === 1 ? 2.5 : 2.2, posicoes: { herois: posH, inimigos: posI }, herois, inimigos, ajustes: {}, perspectiva: this.palco.opts.persp ? true : undefined };
      try { sessionStorage.setItem('ff_livre_def', JSON.stringify(def)); } catch (e) { /* nada */ }
      const w = window.open('index.html?livre=1', '_blank');
      if (!w) location.href = 'index.html?livre=1';
    },
    verJson() {
      const c = E.el('div');
      const ta = document.createElement('textarea');
      ta.style.cssText = 'width:100%;height:50vh;font:11px monospace';
      ta.value = JSON.stringify(this.montarGolpe(), null, 1);
      c.appendChild(ta);
      c.appendChild(E.botao('📋 Copiar', () => { ta.select(); navigator.clipboard && navigator.clipboard.writeText(ta.value).catch(() => {}); E.aviso('Copiado'); }));
      c.appendChild(E.botao('Usar este JSON', () => {
        try {
          const g = JSON.parse(ta.value);
          const linha = this.linhaDe(g);
          const meta = this.meta(g);
          this.doc.golpe = meta; this.doc.linha = linha;
          linha.trilhas.forEach(tr => tr.clipes.forEach(cc => { if (!cc.id) cc.id = novoId(); }));
          this.sel = null; m.fechar(); this.mudou('Colar JSON'); this.tudo();
        } catch (e) { E.aviso('JSON inválido: ' + e.message, 'erro'); }
      }, 'Aceita golpes antigos (roteiro em passos) — são convertidos para linha do tempo', 'es-bt-ouro'));
      const m = E.modal('{ } JSON do golpe', c, { larga: true });
    },

    // ---------- desenho ----------
    tudo() { this.autoDuracao(); this.irPara(Math.min(this.t, this.doc.linha.duracao)); this.tl.render(); this.renderProps(); this.renderRodape(); },
    redesenharTudo() { this.irPara(this.t); this.tl.render(); },
    renderProps() { if (this.doc) FF.EstudioProps.render(this.props, this); this._deCanvas = false; },
    redesenhar() {
      this.palco.desenhar((ctx, b) => this.desenharSelecao(ctx, b));
      const b = this.palco._b;
      if (b) this.infoPalco.textContent = (this.palco.modo === 'batalha' ? '⚔ BATALHA REAL · ' : '') + 't = ' + this.t.toFixed(3).replace('.', ',') + ' s · ' + (b.atk.anim.name || '') + ' q' + (b.atk.anim.i || 0) + (b.alvo ? ' · alvo: ' + Math.ceil(b.alvo.hp) + '/' + b.alvo.hpMax : '');
    },

    // ponto (x, y) antes da perspectiva → onde o motor desenha o efeito
    pontoEfeito(r, x, y) { return r && r.mapa ? r.mapa(x, y) : { x, y }; },
    // movimento na tela (dx, dy) → movimento antes da perspectiva, em volta de (x, y) (a conta é linear por partes)
    desfazerMapa(r, x, y, dx, dy) {
      const h = 10, m0 = r.mapa(x, y), mx = r.mapa(x + h, y), my = r.mapa(x, y + h);
      const a = (mx.x - m0.x) / h, b = (my.x - m0.x) / h, c = (mx.y - m0.y) / h, d = (my.y - m0.y) / h;
      const det = a * d - b * c;
      if (!isFinite(det) || Math.abs(det) < 1e-4) return { x: dx, y: dy };
      return { x: (d * dx - b * dy) / det, y: (-c * dx + a * dy) / det };
    },
    // alças do clipe escolhido; devolve a lista para o ponteiro
    alcas() {
      const a = this.achar(this.sel), b = this.palco._b;
      if (!a || !b) return [];
      const c = a.c, r = this.palco.ref[c.id] || {};
      const dir = r.dir || b.atk.dir;
      const L = [];
      if (c.tipo === 'efeito' && r.p) {
        const d = c.em === 'tela' ? 1 : dir;
        // onde o efeito é desenhado de verdade (perspectiva: palco.js r.mapa) e no tamanho da fileira (r.kp)
        const q = this.pontoEfeito(r, r.p.x + (c.dx || 0) * d, r.p.y + (c.dy || 0)), x = q.x, y = q.y;
        const raio = 30 * (c.escala || 1) * (r.kp || 1);
        L.push({ k: 'mover', x, y, cor: '#fff', raio }, { k: 'escala', x: x + raio, y: y + raio, cor: '#ffd84a', cx: x, cy: y, r0: raio }, { k: 'giro', x, y: y - raio - 16, cor: '#6cc8ff', cx: x, cy: y });
      }
      if (c.tipo === 'projetil' && r.de) {
        L.push({ k: 'de', x: r.de.x + (c.deDx || 0) * dir, y: r.de.y + (c.deDy || 0), cor: '#5fe08a' });
        if (r.ate) L.push({ k: 'ate', x: r.ate.x + (c.alvoDx || 0) * dir, y: r.ate.y + (c.alvoDy || 0), cor: '#ff5a5a' });
      }
      if (c.tipo === 'projetil') {   // o projétil voando agora: alça roxa no meio do desenho
        const pj = b.projectiles.find(x => x.clipe === c.id && !x.dead), cx = pj && b.caixaProjetil(pj);
        if (cx) {   // como nos efeitos: mover (branca), tamanho (amarela) e giro (azul)
          const raio = Math.max(18, Math.max(cx.w, cx.h) / 2);
          // carregando no ar (espera): arrastar o desenho muda o ponto onde ele carrega (= a saída, alça verde)
          const carregando = pj.espera && pj.tEsp < pj.espera;
          L.push({ k: carregando ? 'de' : 'sprite', x: cx.cx, y: cx.cy, cor: '#fff', caixa: cx, raio },
            { k: 'escala', x: cx.cx + raio * 0.75, y: cx.cy + raio * 0.75, cor: '#ffd84a', cx: cx.cx, cy: cx.cy },
            { k: 'giro', x: cx.cx, y: cx.cy - raio - 16, cor: '#6cc8ff', cx: cx.cx, cy: cx.cy });
        }
      }
      if (c.tipo === 'acerto' && r.p) L.push({ k: 'acerto', x: r.p.x + (c.dx || 0) * dir, y: r.p.y + (c.dy || 0), cor: '#ff5a5a' });
      // teleporte/movimento para um ponto da tela: alça no destino (com silhueta do lutador)
      if ((c.tipo === 'teleporte' || c.tipo === 'mover') && c.para === 'x') {
        const f = FF.Linha.lutadorDe(b, b.atk, b.alvo, a.tr.quem);
        if (f) {
          const dx = c.x != null ? c.x + FF.legado().x : f.homeX, dy = f.groundY + (c.y || 0);
          const sc = f.scale * (c.escala || 1), raio = 34 * sc, cy = dy - 30 * sc;
          L.push({ k: 'destino', x: dx, y: cy, px: dx, py: dy, cor: '#5fe08a', f, arco: c.tipo === 'mover' ? c.arco || 0 : 0, mover: c.tipo === 'mover', animMov: c.animMov, esc: c.escala || 1, rot: (c.rot || 0) * f.dir, flip: !!c.flip, raio },
            { k: 'escala', x: dx + raio * 0.75, y: cy + raio * 0.75, cor: '#ffd84a', cx: dx, cy },
            { k: 'giro', x: dx, y: cy - raio - 16, cor: '#6cc8ff', cx: dx, cy });
        }
      }
      // 〰 caminho: em cada ponto, a silhueta na pose dele (giro/tamanho) + alças: verde = mover, azul = giro, amarela = tamanho
      if (c.tipo === 'caminho') {
        const f = FF.Linha.lutadorDe(b, b.atk, b.alvo, a.tr.quem);
        if (f) {
          const pts = FF.Linha.pontosCaminho(b, b.atk, b.alvo, f, c);
          const ini = r.p0 || { x: f.x + (f.offX || 0), y: f.y + (f.offY || 0) };
          const P = FF.Linha.posesCaminho(f, c, r.r0 != null ? r.r0 : (c.reto ? 0 : f.rotExtra || 0), r.e0 != null ? r.e0 : (c.reto ? 1 : f.escExtra || 1));
          const cvc = FF.Linha.curva([ini].concat(pts));
          const flip0 = r.fl0 != null ? r.fl0 : !!f.flipExtra;
          // saída: alças de giro e tamanho em cima do próprio lutador (pose com que ele sai)
          {
            const esc = P.escs[0], sc = f.scale * esc, raio = 34 * sc, cy = ini.y - 30 * sc;
            const tg0 = cvc.at(0), fl0 = c.virar && Math.abs(tg0.tx) > 0.3 ? (tg0.tx < 0) !== (f.dir < 0) : flip0, vira0 = (f.dir < 0) !== fl0;
            let rot = P.rots[0];
            if (c.girarCaminho) { let ang = Math.atan2(tg0.ty, tg0.tx) * 180 / Math.PI; if (vira0) ang -= 180; rot = ang + rot * (vira0 ? -1 : 1); }
            L.push({ k: 'saida', x: ini.x, y: cy, px: ini.x, py: ini.y, cor: '#ffffff', f, esc, rot, vira: vira0, rr: raio, raio: 10 },
              { k: 'pgiro', i: -1, x: ini.x, y: cy - raio - 16, cor: '#6cc8ff', cx: ini.x, cy, dir: f.dir },
              { k: 'pesc', i: -1, x: ini.x + raio * 0.75, y: cy + raio * 0.75, cor: '#ffd84a', cx: ini.x, cy, esc0: esc });
          }
          pts.forEach((q, i) => {
            const esc = P.escs[i + 1], sc = f.scale * esc, raio = 34 * sc, cy = q.y - 30 * sc;
            let rot = P.rots[i + 1];
            let fl = flip0;
            const tg = cvc.at(cvc.nos ? cvc.nos[i + 1] : 1);
            if (c.virar && Math.abs(tg.tx) > 0.3) fl = (tg.tx < 0) !== (f.dir < 0);
            const vira = (f.dir < 0) !== fl;
            if (c.girarCaminho) { let ang = Math.atan2(tg.ty, tg.tx) * 180 / Math.PI; if (vira) ang -= 180; rot = ang + rot * (vira ? -1 : 1); }
            const ult = i === pts.length - 1;
            L.push({ k: 'ponto', i, x: q.x, y: cy, px: q.x, py: q.y, cor: ult ? '#5fe08a' : '#9fffc2', f, caminho: { ini, pts, amostras: cvc.amostras }, ult, animMov: c.animMov, esc, rot, vira, raio: 12, rr: raio },
              { k: 'pgiro', i, x: q.x, y: cy - raio - 16, cor: '#6cc8ff', cx: q.x, cy, dir: f.dir },
              { k: 'pesc', i, x: q.x + raio * 0.75, y: cy + raio * 0.75, cor: '#ffd84a', cx: q.x, cy, esc0: esc });
          });
        }
      }
      if (c.tipo === 'anim' && r.f) {   // lutador: mover (branca), tamanho (amarela) e giro (azul), como os efeitos
        const f = r.f, sc = f.scale * (f.escExtra || 1), x = f.x + (f.offX || 0), y = f.y + (f.offY || 0) - 30 * sc, raio = 34 * sc;
        L.push({ k: 'lutador', x, y, cor: '#fff', f, raio },
          { k: 'escala', x: x + raio * 0.75, y: y + raio * 0.75, cor: '#ffd84a', cx: x, cy: y },
          { k: 'giro', x, y: y - raio - 16, cor: '#6cc8ff', cx: x, cy: y });
      }
      if (c.tipo === 'camada') {
        const v = (b.cenasVivas || []).find(x => x.linha);
        const cam = v && v.cena.camadas.find(k => k.id === c.id);
        const p = cam && FF.Cena.naTela(b, v.actor, v.target, cam, v.t);
        if (p) { const cx = FF.Cena.caixa(p); L.push({ k: 'camada', x: p.x, y: p.y, cor: '#b06cff', caixa: cx, dir: v.actor ? v.actor.dir : 1 }); }
      }
      return L;
    },
    desenharSelecao(ctx) {
      const L = this.alcas();
      ctx.save();
      const proj = L.filter(h => (h.k === 'de' || h.k === 'ate') && !h.caixa);
      if (proj.length === 2) { ctx.strokeStyle = 'rgba(255,216,74,0.8)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(proj[0].x, proj[0].y); ctx.lineTo(proj[1].x, proj[1].y); ctx.stroke(); ctx.setLineDash([]); }
      // guias de alinhamento ao arrastar (ciano) e trava de eixo com Shift (amarelo)
      for (const g of (this.guiasPalco || [])) {
        ctx.save();
        ctx.strokeStyle = g.trava ? 'rgba(255,216,74,0.9)' : '#3cf0ff'; ctx.lineWidth = 2; ctx.setLineDash(g.trava ? [8, 4] : [5, 3]);
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 4;
        ctx.beginPath();
        if (g.eixo === 'x') { ctx.moveTo(g.v + 0.5, 0); ctx.lineTo(g.v + 0.5, this.cv.height); } else { ctx.moveTo(0, g.v + 0.5); ctx.lineTo(this.cv.width, g.v + 0.5); }
        ctx.stroke();
        if (g.de) { ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.fillStyle = '#3cf0ff'; ctx.beginPath(); ctx.arc(g.de.x, g.de.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.font = 'bold 11px sans-serif'; ctx.fillText(g.de.nome, g.de.x + 6, g.de.y - 6); }
        ctx.restore();
      }
      // 〰 caminho: a curva (do lugar atual passando pelos pontos), a silhueta na pose de cada ponto e os números
      const pc = L.filter(h => h.k === 'ponto');
      const sd = L.find(h => h.k === 'saida');
      if (pc.length) {
        const f = pc[0].f, ofs = 30 * f.scale;
        ctx.save();
        ctx.strokeStyle = 'rgba(95,224,138,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath();
        (pc[0].caminho.amostras || []).forEach((q, i) => { if (i) ctx.lineTo(q.x, q.y - ofs); else ctx.moveTo(q.x, q.y - ofs); });
        ctx.stroke(); ctx.setLineDash([]);
        const an = (pc[0].animMov && f.sprite.anim(f.animName(pc[0].animMov))) || f.sprite.anim(f.animName('parado'));
        const qa = an && an.frames ? an.frames[0] : null;
        pc.forEach(h => {
          if (!qa) return;
          const sc = f.scale * h.esc, fl = h.vira, alpha = h.ult ? 0.45 : 0.28;
          if (h.rot) {
            const cx = (fl ? -1 : 1) * (qa[3] / 2 - qa[5]) * sc, cy = (qa[4] / 2 - qa[6]) * sc;
            ctx.save(); ctx.translate(h.px + cx, h.py + cy); ctx.rotate(h.rot * Math.PI / 180); FF.drawFrame(ctx, f.sprite, qa, -cx, -cy, sc, fl, { alpha }); ctx.restore();
          } else FF.drawFrame(ctx, f.sprite, qa, h.px, h.py, sc, fl, { alpha });
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(h.x, h.y, h.rr, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        });
        if (sd && qa) {   // saída: pose com que ele sai (o próprio lutador fica por baixo)
          const sc = f.scale * sd.esc;
          if (sd.rot) { const cx = (sd.vira ? -1 : 1) * (qa[3] / 2 - qa[5]) * sc, cy = (qa[4] / 2 - qa[6]) * sc; ctx.save(); ctx.translate(sd.px + cx, sd.py + cy); ctx.rotate(sd.rot * Math.PI / 180); FF.drawFrame(ctx, f.sprite, qa, -cx, -cy, sc, sd.vira, { alpha: 0.3 }); ctx.restore(); }
          else FF.drawFrame(ctx, f.sprite, qa, sd.px, sd.py, sc, sd.vira, { alpha: 0.3 });
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(sd.x, sd.y, sd.rr, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#eaffef';
        pc.forEach(h => ctx.fillText(String(h.i + 1), h.x + 9, h.y - 8));
        if (sd) ctx.fillText('saída', sd.x + 9, sd.y - 8);
        ctx.restore();
      }
      for (const h of L) {
        if (h.k === 'destino' && h.f) {   // silhueta do lutador no ponto de chegada
          // com a animação do movimento (ex.: deitado sendo lançado), para a prévia bater com o que acontece
          const f = h.f, an = (h.animMov && f.sprite.anim(f.animName(h.animMov))) || f.sprite.anim(f.animName('parado')) || f.anim.cur;
          const qa = an && an.frames ? an.frames[an.frames.length - 1] : null;
          if (qa) {
            const sc = f.scale * h.esc;
            const fl = (f.dir < 0) !== !!h.flip;   // ⇋ Espelhar do movimento
            if (h.rot) {
              const fr = qa, cx = (fl ? -1 : 1) * (fr[3] / 2 - fr[5]) * sc, cy = (fr[4] / 2 - fr[6]) * sc;
              ctx.save(); ctx.translate(h.px + cx, h.py + cy); ctx.rotate(h.rot * Math.PI / 180); FF.drawFrame(ctx, f.sprite, fr, -cx, -cy, sc, fl, { alpha: 0.45 }); ctx.restore();
            }
            else FF.drawFrame(ctx, f.sprite, qa, h.px, h.py, sc, fl, { alpha: 0.45 });
          }
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(h.x, h.y, h.raio, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(95,224,138,0.8)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(h.px - 22, f.groundY); ctx.lineTo(h.px + 22, f.groundY); ctx.moveTo(h.px, f.groundY); ctx.lineTo(h.px, h.py); ctx.stroke(); ctx.setLineDash([]);
          if (h.mover) {   // caminho do movimento (com o arco), a partir de onde o lutador está agora
            const x0 = f.x, y0 = f.y - 30 * f.scale, x1 = h.px, y1 = h.py - 30 * f.scale;
            ctx.strokeStyle = 'rgba(95,224,138,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath();
            for (let i = 0; i <= 24; i++) { const e = i / 24, x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e - h.arco * Math.sin(Math.PI * e); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
            ctx.stroke(); ctx.setLineDash([]);
          }
        }
        if (h.caixa && h.k !== 'sprite') { ctx.strokeStyle = '#b06cff'; ctx.lineWidth = 2; ctx.strokeRect(h.caixa.x, h.caixa.y, h.caixa.w, h.caixa.h); }
        if (h.k === 'escala' || h.k === 'giro') { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(h.cx, h.cy); ctx.lineTo(h.x, h.y); ctx.stroke(); }
        if (h.k === 'lutador' && h.raio) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(h.x, h.y, h.raio, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        if (h.k === 'sprite') { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(h.x, h.y, h.raio, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        if (h.k === 'mover') { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(h.x, h.y, h.raio || 30 * ((this.clipe() || {}).escala || 1), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        // fora da tela: a alça fica presa na borda, com uma seta para onde a coisa está (arraste para trazer de volta)
        const q = this.prender(h);
        if (q.preso) {
          const ang = Math.atan2(h.y - q.y, h.x - q.x);
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ang);
          ctx.fillStyle = h.cor; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(6, -8); ctx.lineTo(6, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
          ctx.setLineDash([3, 3]); ctx.strokeStyle = h.cor; ctx.beginPath(); ctx.arc(q.x, q.y, 11, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.fillStyle = h.cor; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    },

    // trocar "Preso em" de um efeito sem ele sair do lugar na tela: recalcula X/Y a partir do ponto novo
    // (pontos de quando o efeito começou, gravados pelo palco). Passando para quem solta, já fica "junto do lutador".
    trocarAncora(c, novo) {
      const velho = c.em || 'atacante';
      if (novo === velho) return;
      const r = (this.palco.ref || {})[c.id] || {}, P = r.pontos;
      if (P && P[velho] && P[novo]) {
        const dir = r.dir || 1, d0 = velho === 'tela' ? 1 : dir, d1 = novo === 'tela' ? 1 : dir;
        const k0 = velho === 'tela' ? 1 : (r.kf || 1), k1 = novo === 'tela' ? 1 : (r.kf || 1);
        const x = P[velho].x + (c.dx || 0) * d0 * k0, y = P[velho].y + (c.dy || 0) * k0;
        c.dx = Math.round((x - P[novo].x) / (d1 * k1)); c.dy = Math.round((y - P[novo].y) / k1);
        if (!c.dx) delete c.dx; if (!c.dy) delete c.dy;
      }
      c.em = novo;
      if (['atacante', 'peito', 'disparo'].includes(novo) && c.junto == null && !c.seguir && ['alvo', 'alvoPes', 'tela'].includes(velho)) c.junto = true;
      this.mudou('Preso em');
      this.renderProps();
    },
    // ---------- ✏ ajustes por combinação de fileiras (luta em diagonal) ----------
    // Ligado: os clipes mostram os campos da combinação atual (🧍 × 🎯) e o que mudar de posição fica só nela
    // (c.ajustes["fundo>meio"]); o motor usa o ajuste quando quem solta e o alvo estão nessas fileiras.
    // Enquanto ligado, cada clipe guarda a versão base em c._base (nunca vai para o jogo: linhaBase/restaurarBase).
    CAMPOS_AJUSTE: ['dx', 'dy', 'x', 'y', 'rot', 'escala', 'pontos', 'rot0', 'esc0', 'deDx', 'deDy', 'alvoDx', 'alvoDy', 'spriteDx', 'spriteDy', 'chaves', 'arco', 'dist', 'flip', 'alpha'],
    cadaClipe(fn) { if (this.doc) this.doc.linha.trilhas.forEach(tr => tr.clipes.forEach(c => fn(c, tr))); },
    chaveAtual() { const b = this.palco && this.palco._b; return b ? FF.Linha.chaveFileiras(b, b.atk, b.alvo) : null; },
    nomeChave(k) { const n = { frente: '1', meio: '2', fundo: '3' }; const [a, t] = (k || '').split('>'); return '🧍' + (n[a] || '?') + ' → 🎯' + (n[t] || '?'); },
    restaurarBase(c) {
      if (!c._base) return;
      this.CAMPOS_AJUSTE.forEach(f => { if (f in c._base) c[f] = E.copia(c._base[f]); else delete c[f]; });
      delete c._base;
    },
    linhaBase() { const L = E.copia(this.doc.linha); L.trilhas.forEach(tr => tr.clipes.forEach(c => this.restaurarBase(c))); return L; },
    guardarAjuste() {
      const k = this.ajuste; if (!k) return;
      this.cadaClipe(c => {
        if (!c._base) return;
        const d = {};
        this.CAMPOS_AJUSTE.forEach(f => { const v0 = c._base[f], v1 = c[f]; if (JSON.stringify(v0) !== JSON.stringify(v1)) d[f] = v1 === undefined ? null : E.copia(v1); });
        if (Object.keys(d).length) { c.ajustes = c.ajustes || {}; c.ajustes[k] = d; }
        else if (c.ajustes) { delete c.ajustes[k]; if (!Object.keys(c.ajustes).length) delete c.ajustes; }
      });
    },
    ligarAjuste() {
      if (!this.doc) return;
      const k = this.chaveAtual();
      if (!k) { E.aviso('Os ajustes por combinação são para a visão Diagonal (botão ◢ na barra do palco).', 'erro'); return; }
      this.ajuste = k;
      this.cadaClipe(c => {
        const b = {}; this.CAMPOS_AJUSTE.forEach(f => { if (c[f] !== undefined) b[f] = E.copia(c[f]); }); c._base = b;
        const a = c.ajustes && c.ajustes[k];
        if (a) Object.keys(a).forEach(f => { if (a[f] === null) delete c[f]; else c[f] = E.copia(a[f]); });
      });
      this.irPara(this.t); this.tl.render(); this.renderProps(); this.renderAjuste();
      E.aviso('✏ Ajustando só ' + this.nomeChave(k) + ': o que você mover agora vale só nessa combinação.', 'ok');
    },
    desligarAjuste(semAviso) {
      if (!this.ajuste) return;
      this.guardarAjuste();
      this.cadaClipe(c => this.restaurarBase(c));
      this.ajuste = null;
      this.irPara(this.t); this.tl.render(); this.renderProps(); this.renderAjuste();
      if (!semAviso) E.aviso('✏ Ajustes guardados. Voltou a editar a versão base (vale para todas as combinações).', 'ok');
    },
    // tira o ajuste do clipe selecionado (ou de todos) nesta combinação: volta a usar o base
    tirarAjuste(todos) {
      const k = this.ajuste; if (!k) return;
      const alvo = todos ? null : this.clipe();
      this.cadaClipe(c => {
        if (alvo && c !== alvo) return;
        if (c._base) { this.CAMPOS_AJUSTE.forEach(f => { if (f in c._base) c[f] = E.copia(c._base[f]); else delete c[f]; }); }
        if (c.ajustes) { delete c.ajustes[k]; if (!Object.keys(c.ajustes).length) delete c.ajustes; }
      });
      this.mudou('Tirar ajuste'); this.renderProps();
    },
    // ⤴ Usar como base: o que está ajustado nesta combinação vira a versão base (vale para todas as combinações sem
    // ajuste próprio). Só os clipes com ajuste aqui (ou só o selecionado).
    usarComoBase(soClipe) {
      const k = this.ajuste; if (!k) return;
      this.guardarAjuste();
      let n = 0;
      const alvo = soClipe ? this.clipe() : null;
      this.cadaClipe(c => {
        if (alvo && c !== alvo) return;
        if (!(c.ajustes && c.ajustes[k])) return;
        const b = {}; this.CAMPOS_AJUSTE.forEach(f => { if (c[f] !== undefined) b[f] = E.copia(c[f]); }); c._base = b;
        delete c.ajustes[k]; if (!Object.keys(c.ajustes).length) delete c.ajustes;
        n++;
      });
      if (!n) { E.aviso('Nenhum clipe com ajuste nesta combinação.'); return; }
      this.mudou('Usar como base'); this.renderProps();
      E.aviso('⤴ ' + n + ' clipe(s): o ajuste de ' + this.nomeChave(k) + ' virou a versão base.', 'ok');
    },
    // ⧉ Copiar para…: copia os ajustes desta combinação para outras
    copiarAjustePara() {
      const k = this.ajuste; if (!k) return;
      this.guardarAjuste();
      const com = []; this.cadaClipe(c => { if (c.ajustes && c.ajustes[k]) com.push(c); });
      if (!com.length) { E.aviso('Nenhum clipe com ajuste nesta combinação para copiar.'); return; }
      const filas = ['frente', 'meio', 'fundo'], n = { frente: '1', meio: '2', fundo: '3' };
      const c0 = E.el('div', 'es-copiar-aj');
      c0.appendChild(E.el('p', null, 'Copiar os ajustes de ' + this.nomeChave(k) + ' (' + com.length + ' clipe(s)) para:'));
      const grade = E.el('div', 'es-copiar-grade');
      grade.appendChild(E.el('span', 'es-copiar-cab', '🧍 \ 🎯'));
      filas.forEach(t => grade.appendChild(E.el('span', 'es-copiar-cab', '🎯' + n[t])));
      const cks = [];
      filas.forEach(a => {
        grade.appendChild(E.el('span', 'es-copiar-cab', '🧍' + n[a]));
        filas.forEach(t => {
          const key = a + '>' + t, l = E.el('label', 'es-copiar-cel');
          const i = document.createElement('input'); i.type = 'checkbox'; i.disabled = key === k; i.checked = key === k;
          l.appendChild(i); if (com.some(c => c.ajustes[key]) && key !== k) l.title = 'Já tem ajuste aqui (será substituído)';
          if (key !== k && com.some(c => c.ajustes[key])) l.classList.add('tem');
          cks.push([key, i]); l.appendChild(document.createTextNode(key === k ? ' (esta)' : ''));
          grade.appendChild(l);
        });
      });
      c0.appendChild(grade);
      const bts = E.el('div', 'es-escolha-bts');
      const m = E.modal('⧉ Copiar ajuste para outras combinações', c0);
      bts.append(E.botao('Todas', () => cks.forEach(([key, i]) => { if (key !== k) i.checked = true; })),
        E.botao('⧉ Copiar', () => {
          const dest = cks.filter(([key, i]) => key !== k && i.checked).map(([key]) => key);
          if (!dest.length) { E.aviso('Marque pelo menos uma combinação.'); return; }
          com.forEach(c => dest.forEach(key => { c.ajustes[key] = E.copia(c.ajustes[k]); }));
          m.fechar(); this.mudou('Copiar ajuste'); this.renderProps();
          E.aviso('⧉ Ajustes copiados para ' + dest.map(x => this.nomeChave(x)).join(', ') + '.', 'ok');
        }, null, 'es-bt-ouro'));
      c0.appendChild(bts);
    },
    // trocou a fileira com o modo ligado: guarda, volta ao base e liga de novo na combinação nova
    trocouFileira() { if (this.ajuste) { this.desligarAjuste(true); this.ligarAjuste(); } },
    renderAjuste() {
      if (!this.btAjuste) return;
      this.btAjuste.classList.toggle('es-bt-ouro', !!this.ajuste);
      this.btAjuste.textContent = this.ajuste ? '✏ Só ' + this.nomeChave(this.ajuste) : '✏ Só nesta combinação';
      if (this.btsAjuste) this.btsAjuste.style.display = this.ajuste ? '' : 'none';
    },
    // ⌖ Trazer para a tela: põe o clipe selecionado de volta num lugar visível (pelo tipo)
    podeTrazer(c) { return !!c && ['efeito', 'anim', 'camada', 'projetil', 'caminho'].includes(c.tipo) || (!!c && (c.tipo === 'mover' || c.tipo === 'teleporte') && c.para === 'x'); },
    trazerParaTela() {
      const c = this.clipe(); if (!this.podeTrazer(c)) return;
      const cx = 542, cy = 290;   // meio da tela (na tela antiga de 1084×580, centralizada)
      const limX = (x) => Math.max(-38, Math.min(1122, x)), limY = (y) => Math.max(-450, Math.min(100, y || 0));
      switch (c.tipo) {
        case 'efeito': if (c.em === 'tela') { c.dx = cx; c.dy = cy; } else { delete c.dx; delete c.dy; } break;
        case 'anim': delete c.dx; delete c.dy; break;
        case 'camada': {
          const x0 = c.ancora === 'tela' ? cx : 0, y0 = c.ancora === 'tela' ? cy : 0;
          if (c.chaves && c.chaves.length) { const k0 = c.chaves[0], ddx = x0 - (k0.x != null ? k0.x : c.x || 0), ddy = y0 - (k0.y != null ? k0.y : c.y || 0); c.chaves.forEach(k => { k.x = (k.x != null ? k.x : c.x || 0) + ddx; k.y = (k.y != null ? k.y : c.y || 0) + ddy; }); }
          c.x = x0; c.y = y0; break;
        }
        case 'projetil': ['deDx', 'deDy', 'alvoDx', 'alvoDy', 'spriteDx', 'spriteDy'].forEach(k => delete c[k]); break;
        case 'mover': case 'teleporte': c.x = limX(c.x != null ? c.x : cx); c.y = limY(c.y); if (!c.y) delete c.y; break;
        case 'caminho': (c.pontos || []).forEach(q => { q.x = limX(q.x != null ? q.x : cx); q.y = limY(q.y); if (!q.y) delete q.y; }); break;
      }
      this.mudou('Trazer para a tela');
      this.renderProps();
      E.aviso('⌖ De volta para a tela.', 'ok');
    },
    // alça fora do que o palco mostra: posição presa na borda (para desenhar e clicar); a alça de verdade não muda
    prender(h) {
      const v = this.palco.visivel ? this.palco.visivel() : null;
      if (!v) return h;
      const m = 16 / (this.palco.escalaFora ? this.palco.escalaFora() : 1);
      const x = Math.max(v.x0 + m, Math.min(v.x1 - m, h.x)), y = Math.max(v.y0 + m, Math.min(v.y1 - m, h.y));
      return x === h.x && y === h.y ? h : Object.assign({}, h, { x, y, preso: true });
    },
    // pontos para alinhar no palco: as outras alças do clipe + pés, peito e mão dos lutadores
    pontosRef(h) {
      const L = this.alcas().filter(x => x !== h && x.k !== h.k && !['escala', 'giro', 'pgiro', 'pesc', 'saida'].includes(x.k)).map(x => ({ x: x.x, y: x.y, nome: 'alça' }));
      const b = this.palco._b;
      if (b) for (const f of b.all) {
        const pe = f.peito();
        L.push({ x: f.x, y: f.groundY, nome: 'pés' }, { x: pe.x, y: pe.y, nome: 'peito' });
        try { const d = f.pontoDisparo(); if (d) L.push({ x: d.x, y: d.y, nome: 'mão' }); } catch (e) { /* sem ponto */ }
      }
      return L;
    },
    alinharPalco(h, x, y, refs) {
      const lim = 6;
      let sx = null, sy = null, bx = lim, by = lim, dxp = null, dyp = null;
      // as outras alças do clipe (ex.: saída × chegada do projétil) têm prioridade sobre os lutadores
      const pen = (r) => (r.nome === 'alça' ? 0 : 3);
      for (const r of refs || []) {
        const ax = Math.abs(r.x - x) + pen(r), ay = Math.abs(r.y - y) + pen(r);
        if (ax < bx + (dxp ? pen(dxp) : 0) && Math.abs(r.x - x) < lim) { bx = ax - pen(r); sx = r.x; dxp = r; }
        if (ay < by + (dyp ? pen(dyp) : 0) && Math.abs(r.y - y) < lim) { by = ay - pen(r); sy = r.y; dyp = r; }
      }
      return { sx, sy, dx: dxp, dy: dyp };
    },

    // ---------- palco: clicar e arrastar ----------
    ligarPalco() {
      let arr = null;
      const cv = this.cv;
      cv.addEventListener('pointerdown', (e) => {
        if (this.palco.modo === 'batalha') { this.palco.apertar(); return; }
        if (!this.doc) return;
        const p = this.palco.pontoTela(e);
        const k = this.palco.escalaFora ? this.palco.escalaFora() : 1;
        const perto = (h) => { const q = this.prender(h); return Math.hypot(q.x - p.x, q.y - p.y) < 14 / k; };
        let h = this.alcas().find(perto);
        if (!h) {
          // escolher pelo que está no palco: efeitos, camadas, lutadores
          const achou = this.acharNoPalco(p);
          if (achou) { this.selecionar(achou.id, achou.tr); const hs = this.alcas(); h = hs.find(x => x.k === 'sprite' && x.caixa && p.x >= x.caixa.x && p.x <= x.caixa.x + x.caixa.w && p.y >= x.caixa.y && p.y <= x.caixa.y + x.caixa.h) || hs.find(x => x.k !== 'escala' && x.k !== 'giro' && x.k !== 'sprite') || null; }
        }
        if (!h) return;
        const c = this.clipe();
        cv.setPointerCapture(e.pointerId);
        arr = { h, c: E.copia(c), p0: p, refs: this.pontosRef(h) };
        this.pausar();
      });
      cv.addEventListener('pointermove', (e) => {
        if (!arr) return;
        const p = this.palco.pontoTela(e);
        const c = this.clipe(); if (!c) return;
        const o = arr.c, h = arr.h;
        let dx = p.x - arr.p0.x, dy = p.y - arr.p0.y;
        // Shift: trava num eixo (só para os lados ou só para cima/baixo)
        if (e.shiftKey && !['escala', 'giro', 'pgiro', 'pesc'].includes(h.k)) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
        // guias: encaixa na mesma linha (X ou Y) de outras alças e dos lutadores — Alt solta
        this.guiasPalco = [];
        if (!e.altKey && !['escala', 'giro', 'pgiro', 'pesc'].includes(h.k)) {
          const g = this.alinharPalco(h, h.x + dx, h.y + dy, arr.refs);
          if (g.sx != null && !(e.shiftKey && dx === 0)) { dx += g.sx - (h.x + dx); this.guiasPalco.push({ eixo: 'x', v: g.sx, de: g.dx }); }
          if (g.sy != null && !(e.shiftKey && dy === 0)) { dy += g.sy - (h.y + dy); this.guiasPalco.push({ eixo: 'y', v: g.sy, de: g.dy }); }
          if (e.shiftKey) this.guiasPalco.push({ eixo: dy === 0 ? 'y' : 'x', v: dy === 0 ? h.y : h.x, trava: true });
        }
        const r = this.palco.ref[c.id] || {}, dir = r.dir || 1;
        const R = (v) => Math.round(v);
        switch (h.k) {
          case 'mover': case 'acerto': {
            const d = c.em === 'tela' ? 1 : dir;
            let mx = dx, my = dy;
            // efeito com perspectiva: desfaz a conta da diagonal para o desenho seguir o mouse 1 para 1
            if (c.tipo === 'efeito' && r.mapa && r.p) { const v = this.desfazerMapa(r, r.p.x + (o.dx || 0) * d, r.p.y + (o.dy || 0), dx, dy); mx = v.x; my = v.y; }
            c.dx = R((o.dx || 0) + mx * d); c.dy = R((o.dy || 0) + my); break;
          }
          case 'lutador': { const dd = r.f ? r.f.dir : dir; c.dx = R((o.dx || 0) + dx * dd); c.dy = R((o.dy || 0) + dy); break; }
          case 'destino': {
            const lx = FF.legado().x, x0 = o.x != null ? o.x : h.f.homeX - lx;
            c.x = Math.max(-lx, Math.min(1084 + lx, R(x0 + dx)));   // x na tela antiga (1084), que fica no miolo da de 1280
            c.y = Math.min(200, R((o.y || 0) + dy));   // pode descer um pouco abaixo do chão (desenhos deitados/girados)
            if (!c.y) delete c.y;
            break;
          }
          case 'ponto': {   // 〰 caminho: arrastar um ponto (x na tela antiga, y = altura a partir do chão)
            const lx = FF.legado().x, q0 = (o.pontos || [])[h.i] || { x: 542, y: 0 };
            c.pontos = (o.pontos || []).map(q => Object.assign({}, q));
            c.pontos[h.i] = { x: Math.max(-lx, Math.min(1084 + lx, R((q0.x != null ? q0.x : 542) + dx))), y: Math.min(200, R((q0.y || 0) + dy)) };
            break;
          }
          case 'pgiro': {   // 〰 giro de um ponto do caminho
            let ang = Math.atan2(p.y - h.cy, p.x - h.cx) * 180 / Math.PI + 90;
            if (ang > 180) ang -= 360;
            c.pontos = (o.pontos || []).map(q => Object.assign({}, q));
            // i = -1: a saída (giro com que ele sai) fica no próprio clipe (rot0)
            const q = h.i < 0 ? { rot: o.rot0 } : c.pontos[h.i]; if (!q) break;
            const hp = this.alcas().find(x => h.i < 0 ? x.k === 'saida' : (x.k === 'ponto' && x.i === h.i));
            if (c.girarCaminho) {   // ajuste em cima da inclinação do caminho: o que falta para chegar no ângulo do mouse
              const base = hp ? hp.rot - ((q.rot || 0) * (hp.vira ? -1 : 1)) : 0;
              q.rot = R((ang - base) * (hp && hp.vira ? -1 : 1));
            } else q.rot = R(ang * (h.dir || 1));
            if (Math.abs(q.rot) <= 2) q.rot = 0;
            if (h.i < 0) c.rot0 = q.rot;
            break;
          }
          case 'pesc': {   // 〰 tamanho de um ponto do caminho
            const d0 = Math.hypot(arr.p0.x - h.cx, arr.p0.y - h.cy), d1 = Math.hypot(p.x - h.cx, p.y - h.cy);
            c.pontos = (o.pontos || []).map(q => Object.assign({}, q));
            const ne = Math.max(0.05, Math.round((h.esc0 || 1) * d1 / Math.max(1, d0) * 100) / 100);
            if (h.i < 0) c.esc0 = ne; else if (c.pontos[h.i]) c.pontos[h.i].esc = ne;
            break;
          }
          case 'de': c.deDx = R((o.deDx || 0) + dx * dir); c.deDy = R((o.deDy || 0) + dy); break;
          case 'ate': c.alvoDx = R((o.alvoDx || 0) + dx * dir); c.alvoDy = R((o.alvoDy || 0) + dy); break;
          case 'sprite': c.spriteDx = R((o.spriteDx || 0) + dx * dir); c.spriteDy = R((o.spriteDy || 0) + dy); if (!c.spriteDx) delete c.spriteDx; if (!c.spriteDy) delete c.spriteDy; break;
          case 'escala': { const d0 = Math.hypot(arr.p0.x - h.cx, arr.p0.y - h.cy), d1 = Math.hypot(p.x - h.cx, p.y - h.cy); c.escala = Math.max(0.05, Math.round((o.escala || 1) * d1 / Math.max(1, d0) * 100) / 100); break; }
          case 'giro': {
            let ang = Math.atan2(p.y - h.cy, p.x - h.cx) * 180 / Math.PI + 90;
            if (ang > 180) ang -= 360;
            const destino = (c.tipo === 'mover' || c.tipo === 'teleporte') && this.alcas().find(x => x.k === 'destino');
            const dd = c.tipo === 'anim' && r.f ? r.f.dir : destino && destino.f ? destino.f.dir : dir;
            c.rot = R(ang * (c.em === 'tela' ? 1 : dd));
            if (Math.abs(c.rot) <= 2) delete c.rot;   // perto do zero = reto
            break;
          }
          case 'camada': {
            const tl = this.t - c.t;
            if (this.autoChave) {
              const est = FF.Cena.estado(o, tl);
              c.chaves = (o.chaves || []).filter(k => Math.abs(k.t - tl) > 0.005).map(k => Object.assign({}, k));
              c.chaves.push({ t: Math.round(tl * 1000) / 1000, x: R(est.x + dx * h.dir), y: R(est.y + dy), escala: est.escala, alpha: est.alpha, rot: est.rot });
              c.chaves.sort((a, b) => a.t - b.t);
            } else if (c.chaves && c.chaves.length) {
              c.chaves = o.chaves.map(k => Object.assign({}, k, { x: (k.x != null ? k.x : o.x || 0) + dx * h.dir, y: (k.y != null ? k.y : o.y || 0) + dy }));
              c.x = R((o.x || 0) + dx * h.dir); c.y = R((o.y || 0) + dy);
            } else { c.x = R((o.x || 0) + dx * h.dir); c.y = R((o.y || 0) + dy); }
            break;
          }
        }
        this.mudou('Posicionar no palco', true, true);
      });
      const fim = () => { this.guiasPalco = null; if (arr) { this._deCanvas = true; this.mudou('Posicionar no palco', false); this.renderProps(); } arr = null; };
      cv.addEventListener('pointerup', fim);
      cv.addEventListener('pointercancel', fim);
      cv.addEventListener('wheel', (e) => {
        const c = this.clipe();
        if (!c || !['efeito', 'camada', 'anim', 'projetil', 'mover', 'teleporte'].includes(c.tipo)) return;
        if ((c.tipo === 'mover' || c.tipo === 'teleporte') && c.para !== 'x') return;
        e.preventDefault();
        c.escala = Math.max(0.05, Math.round((c.escala || 1) * (e.deltaY < 0 ? 1.08 : 1 / 1.08) * 100) / 100);
        this._deCanvas = true;
        this.mudou('Tamanho (roda)', true);
        this.renderProps();
      }, { passive: false });
    },
    acharNoPalco(p) {
      const b = this.palco._b; if (!b) return null;
      // efeitos vivos (de trás para frente)
      for (let i = b.fxList.length - 1; i >= 0; i--) {
        const e = b.fxList[i];
        if (!e._clipe) continue;
        const f = e.a.frame(); if (!f) continue;
        const w = f[3] * e.scale, h = f[4] * e.scale;
        const x = e.flip ? e.x - (f[3] - f[5]) * e.scale : e.x - f[5] * e.scale, y = e.y - f[6] * e.scale;
        if (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h) { const a = this.achar(e._clipe); if (a) return { id: e._clipe, tr: a.tr.id }; }
      }
      // projéteis voando
      for (const pj of b.projectiles.slice().reverse()) {
        if (pj.dead || !pj.clipe) continue;
        const cx = b.caixaProjetil(pj);
        if (cx && p.x >= cx.x && p.x <= cx.x + cx.w && p.y >= cx.y && p.y <= cx.y + cx.h) { const a = this.achar(pj.clipe); if (a) return { id: pj.clipe, tr: a.tr.id }; }
      }
      const v = (b.cenasVivas || []).find(x => x.linha);
      if (v) for (const cam of v.cena.camadas.slice().reverse()) {
        const q = FF.Cena.naTela(b, v.actor, v.target, cam, v.t);
        if (!q) continue;
        const cx = FF.Cena.caixa(q);
        if (p.x >= cx.x && p.x <= cx.x + cx.w && p.y >= cx.y && p.y <= cx.y + cx.h) { const a = this.achar(cam.id); if (a) return { id: cam.id, tr: a.tr.id }; }
      }
      // lutadores: o clipe de animação ativo na trilha dele
      for (const f of b.all) {
        const fr = f.anim.frame(); if (!fr) continue;
        const sc = f.scale * (f.escExtra || 1);
        const x = f.x + (f.offX || 0), y = f.y + (f.offY || 0);
        if (Math.abs(p.x - x) < fr[3] * sc / 2 + 4 && p.y <= y + 4 && p.y >= y - fr[4] * sc) {
          const quem = f === b.atk ? 'atacante' : f === b.alvo ? 'alvo' : f.id;
          const tr = this.doc.linha.trilhas.find(t => t.tipo === 'lutador' && (t.quem || 'atacante') === quem);
          if (!tr) continue;
          const c = tr.clipes.filter(k => k.tipo === 'anim' && k.t <= this.t + 1e-6).sort((a, b2) => b2.t - a.t)[0];
          if (c) return { id: c.id, tr: tr.id };
        }
      }
      return null;
    },

    teclado(e) {
      if (E.digitando(e) || document.querySelector('.es-modal')) return false;
      const ctrl = e.ctrlKey || e.metaKey;
      if (this.palco.modo === 'batalha') { if (e.code === 'Space' || e.code === 'KeyZ' && !ctrl) { this.palco.apertar(); return true; } return false; }
      if (e.code === 'Space') { this.alternar(); return true; }
      if (e.key === 'ArrowRight') { this.passoQuadro(1, e.shiftKey); return true; }
      if (e.key === 'ArrowLeft') { this.passoQuadro(-1, e.shiftKey); return true; }
      if (e.key === 'Home') { this.irPara(0); return true; }
      if (e.key === 'End') { this.irPara(this.doc.linha.duracao); return true; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel) { this.remover(); return true; }
      if (ctrl && (e.key === 'd' || e.key === 'D')) { this.duplicar(); return true; }
      if (ctrl && (e.key === 'c' || e.key === 'C')) { this.copiar(); return true; }
      if (ctrl && (e.key === 'v' || e.key === 'V')) { this.colar(); return true; }
      if (ctrl && (e.key === 's' || e.key === 'S')) { this.salvar(); return true; }
      if (e.key === 'Escape' && this.sel) { this.selecionar(null); return true; }
      return false;
    },
  };

  E.registrarAba(G);
  E.Golpes = G;
})();
