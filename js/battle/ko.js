// Cena de KO: o que acontece quando um lutador é derrotado (vida chega a zero).
// É uma linha do tempo comum (js/battle/linha.js), tocada junto com o golpe que derrubou:
//   trilha "Quem solta" = quem deu o golpe final · trilha "Alvo" = quem foi derrotado.
// De onde vem (o primeiro que existir):
//   data/edicoes.js → ko[<id do personagem derrotado>]   (cena própria, feita no Estúdio)
//   data/edicoes.js → ko.padrao                          (padrão de todos, editado no Estúdio)
//   FF.KO.PADRAO                                         (o original do jogo, abaixo)
// Golpe final SUPREMO: data/edicoes.js → ko.supremo, senão FF.KO.SUPREMO (o derrotado é vaporizado).
// O "congelamento" do golpe final (hitstop) continua fixo no motor.
window.FF = window.FF || {};

FF.KO = {
  PADRAO: {
    duracao: 1.2,
    trilhas: [
      { id: 'atacante', tipo: 'lutador', quem: 'atacante', nome: 'Quem deu o golpe final', clipes: [] },
      { id: 'alvo', tipo: 'lutador', quem: 'alvo', nome: 'Derrotado', clipes: [
        { id: 'ko1', tipo: 'anim', t: 0, anim: 'lancado', d: 0.38, empurrao: 700 },
        { id: 'ko2', tipo: 'anim', t: 0.38, anim: 'caido' },
      ] },
      { id: 'efeitos', tipo: 'efeitos', nome: 'Efeitos', clipes: [
        { id: 'ko3', tipo: 'efeito', t: 0, fx: 'Explosao11', em: 'alvo', dy: 30, escala: 0.55 },
      ] },
      { id: 'sons', tipo: 'sons', nome: 'Sons e vozes', clipes: [
        { id: 'ko4', tipo: 'som', t: 0, som: 'blow_down' },
        { id: 'ko5', tipo: 'som', t: 0, som: 'explosao' },
        { id: 'ko6', tipo: 'voz', t: 0, quem: 'alvo', vozTipo: 'lancado' },
      ] },
      { id: 'tela', tipo: 'tela', nome: 'Tela (tremor, flash, câmera)', clipes: [
        { id: 'ko7', tipo: 'flash', t: 0, forca: 0.45 },
        { id: 'ko8', tipo: 'tremer', t: 0, forca: 16 },
      ] },
    ],
  },

  // derrotado por um SUPREMO: brilha, se desfaz em faíscas de cima para baixo e some (clipe "vaporizar")
  SUPREMO: {
    duracao: 2.6,
    trilhas: [
      { id: 'atacante', tipo: 'lutador', quem: 'atacante', nome: 'Quem deu o golpe final', clipes: [] },
      { id: 'alvo', tipo: 'lutador', quem: 'alvo', nome: 'Derrotado', clipes: [
        { id: 'kv1', tipo: 'anim', t: 0, anim: 'dano1', d: 2.6 },
        { id: 'kv2', tipo: 'vaporizar', t: 1.0, d: 1.5 },
      ] },
      { id: 'efeitos', tipo: 'efeitos', nome: 'Efeitos', clipes: [
        { id: 'kv3', tipo: 'efeito', t: 0, fx: 'Explosao15', em: 'alvo', escala: 0.55 },
        { id: 'kv4', tipo: 'efeito', t: 1.0, fx: 'genkidama_efeito', em: 'alvo', escala: 2.4 },
      ] },
      { id: 'sons', tipo: 'sons', nome: 'Sons e vozes', clipes: [
        { id: 'kv5', tipo: 'som', t: 0, som: 'goku_s_gnkdm_expl' },
        { id: 'kv6', tipo: 'voz', t: 0, quem: 'alvo', vozTipo: 'lancado' },
        { id: 'kv7', tipo: 'som', t: 1.0, som: 'laser_expl' },
      ] },
      { id: 'tela', tipo: 'tela', nome: 'Tela (tremor, flash, câmera)', clipes: [
        { id: 'kv8', tipo: 'flash', t: 0, forca: 0.7 },
        { id: 'kv9', tipo: 'tremer', t: 0, forca: 18 },
        { id: 'kv10', tipo: 'flash', t: 1.0, forca: 0.3 },
      ] },
    ],
  },

  // linha salva para o personagem (ou a padrão); 'padrao' devolve só a padrão
  linhaSalva(id) {
    const ko = (FF.Edicoes && FF.Edicoes.dados().ko) || {};
    if (id === 'supremo') return ko.supremo || null;
    return (id && id !== 'padrao' && ko[id]) || ko.padrao || null;
  },
  temPropria(id) { const ko = (FF.Edicoes && FF.Edicoes.dados().ko) || {}; return !!(id && ko[id]); },
  linhaDe(id) { return JSON.parse(JSON.stringify(this.linhaSalva(id) || (id === 'supremo' ? this.SUPREMO : this.PADRAO))); },

  // toca a cena (não bloqueia o golpe); devolve uma promessa que termina com a cena
  tocar(b, att, def, move) {
    const linha = move && move.supremo ? this.linhaDe('supremo') : this.linhaDe(def.def && def.def.id || def.id);
    const comecar = () => {
      const viva = FF.Linha.iniciar(b, att, def, { nome: '' }, linha, { ko: true });
      return viva.fim.then(() => { def.react = null; if (def.ko) def.idle(); });
    };
    if (FF.Linha.pronta(linha)) return comecar();
    return FF.Linha.preparar(linha).then(comecar);
  },
};

// ENTRADA e SAÍDA DA CENA DO GOLPE: linhas do tempo por tipo de golpe (normal | rush | supremo) e por personagem
// (quem solta). Clipe de tela {tipo:"corte"} = o instante em que a formação vira a cena (na entrada) ou volta (na
// saída); sem ele, o corte acontece no fim. Clarão = clipe "flash" (forca, d, cor).
//   data/edicoes.js → entrada[tipo][<id>] → entrada[tipo].padrao → FF.CenaGolpe.padrao(qual, tipo)   (saída igual, em "saida")
// Clipes de tela próprios: {tipo:"escurecer", d, forca} · {tipo:"linhas", d} · {tipo:"faixa", d, texto} ("{golpe}" = nome do golpe)
FF.CenaGolpe = {
  TIPOS: ['normal', 'rush', 'supremo'],
  // o que toca antes do Supremo (escurece, zoom em quem solta, linhas, faixa com o nome) — vira a entrada com o corte no fim
  ABERTURA_SUPREMO: {
    duracao: 1.7,
    trilhas: [
      { id: 'atacante', tipo: 'lutador', quem: 'atacante', nome: 'Quem solta', clipes: [] },
      { id: 'alvo', tipo: 'lutador', quem: 'alvo', nome: 'Alvo', clipes: [] },
      { id: 'efeitos', tipo: 'efeitos', nome: 'Efeitos', clipes: [] },
      { id: 'sons', tipo: 'sons', nome: 'Sons e vozes', clipes: [
        { id: 'ab1', tipo: 'som', t: 0, som: 'sprkngbrst_expl' },
      ] },
      { id: 'tela', tipo: 'tela', nome: 'Tela (escurecer, linhas, faixa, câmera)', clipes: [
        { id: 'ab2', tipo: 'escurecer', t: 0, d: 1.5, forca: 0.65 },
        { id: 'ab3', tipo: 'camera', t: 0, d: 0.3, zoom: 1.35, foco: 'atacante' },
        { id: 'ab4', tipo: 'linhas', t: 0, d: 1.5 },
        { id: 'ab5', tipo: 'faixa', t: 0, d: 1.5, texto: '{golpe}' },
      ] },
    ],
  },
  trilhas(tela, sons) {
    return [
      { id: 'atacante', tipo: 'lutador', quem: 'atacante', nome: 'Quem solta', clipes: [] },
      { id: 'alvo', tipo: 'lutador', quem: 'alvo', nome: 'Alvo', clipes: [] },
      { id: 'efeitos', tipo: 'efeitos', nome: 'Efeitos', clipes: [] },
      { id: 'sons', tipo: 'sons', nome: 'Sons e vozes', clipes: sons || [] },
      { id: 'tela', tipo: 'tela', nome: 'Tela (clarão, corte, retrato, faixa, câmera)', clipes: tela },
    ];
  },
  padrao(qual, tipo) {
    const T = this.trilhas.bind(this);
    if (qual === 'saida') return tipo === 'normal'
      ? { duracao: 0.1, trilhas: T([{ id: 'sd1', tipo: 'corte', t: 0 }]) }
      : { duracao: 0.25, trilhas: T([{ id: 'sd1', tipo: 'flash', t: 0, forca: 0.8, d: 0.3 }, { id: 'sd2', tipo: 'corte', t: 0.1 }]) };
    if (tipo === 'normal') return { duracao: 0.2, trilhas: T([{ id: 'en1', tipo: 'corte', t: 0.05 }, { id: 'en3', tipo: 'cartao', t: 0.13 }]) };
    if (tipo === 'rush') return { duracao: 0.35, trilhas: T([{ id: 'en1', tipo: 'flash', t: 0, forca: 0.9, d: 0.3 }, { id: 'en2', tipo: 'corte', t: 0.12 }, { id: 'en3', tipo: 'cartao', t: 0.3 }]) };
    return this.comCorte(this.ABERTURA_SUPREMO);
  },
  // abertura do Supremo (só a parte antes do golpe) + clarão, corte e cartão no fim
  comCorte(ab) {
    const l = JSON.parse(JSON.stringify(ab)), fim = l.duracao || 1.7;
    let tela = (l.trilhas || []).find(t => t.tipo === 'tela');
    if (!tela) { tela = { id: 'tela', tipo: 'tela', nome: 'Tela', clipes: [] }; (l.trilhas = l.trilhas || []).push(tela); }
    if (!tela.clipes.some(c => c.tipo === 'corte')) tela.clipes.push({ id: 'abf', tipo: 'flash', t: fim, forca: 0.9, d: 0.3 }, { id: 'abc', tipo: 'corte', t: fim + 0.12 });
    if (!tela.clipes.some(c => c.tipo === 'cartao') && !l.semCartao) tela.clipes.push({ id: 'abk', tipo: 'cartao', t: fim + 0.3 });
    l.duracao = Math.max(fim + 0.35, l.duracao || 0);
    return l;
  },
  salva(qual, tipo, id) {
    const ed = (FF.Edicoes && FF.Edicoes.dados()) || {}, s = (ed[qual] || {})[tipo] || {};
    if (id && id !== 'padrao' && s[id]) return s[id];
    return s.padrao || null;
  },
  temPropria(qual, tipo, id) { const ed = (FF.Edicoes && FF.Edicoes.dados()) || {}; return !!(id && ((ed[qual] || {})[tipo] || {})[id]); },
  temSalva(qual, tipo, id) { const ed = (FF.Edicoes && FF.Edicoes.dados()) || {}; return !!((ed[qual] || {})[tipo] || {})[id]; },
  linhaDe(qual, tipo, id) { return JSON.parse(JSON.stringify(this.salva(qual, tipo, id) || this.padrao(qual, tipo))); },
  // toca e espera; aoCortar roda no clipe "corte" (ou no fim, se a linha não tiver um)
  // a entrada acaba quando o último clipe que não é o 🪪 cartão acaba (o cartão segue sozinho e o "⏳ esperar o
  // cartão" do golpe decide se o golpe espera) — a linha guardada continua longa para a prévia do palco
  fimUtil(linha, b, actor, target) {
    let fim = 0, tem = false;
    for (const tr of linha.trilhas || []) for (const c of tr.clipes || []) {
      if (c.tipo === 'cartao') { tem = true; fim = Math.max(fim, (c.t || 0) + 0.05); continue; }
      let d = c.d || 0;
      if (c.d == null && (c.tipo === 'anim' || c.tipo === 'teleporte' || c.tipo === 'mover') && tr.quem) {
        const f = FF.Linha.lutadorDe(b, actor, target, tr.quem), nm = c.tipo === 'anim' ? c.anim : c.animMov;
        const a = f && nm && f.sprite && f.sprite.anim(f.animName ? f.animName(nm) : nm);
        if (a) d = FF.Linha.duracaoAnim(a, c.fps || undefined) + (c.segurar || 0);
        if (c.tipo === 'mover') d = Math.max(d, c.d || 0.22);
      }
      fim = Math.max(fim, (c.t || 0) + d);
    }
    return tem ? Math.min(linha.duracao || fim, fim + 0.05) : linha.duracao;
  },
  async tocar(b, qual, tipo, actor, target, move, aoCortar, aoLer) {
    const linha = this.linhaDe(qual, tipo, actor.def && actor.def.id || actor.id);
    linha.duracao = this.fimUtil(linha, b, actor, target);
    if (aoLer) aoLer(linha);
    let cortou = false;
    b._corte = () => { if (!cortou) { cortou = true; aoCortar && aoCortar(); } };
    try {
      if (!linha.desligada && (linha.trilhas || []).some(t => (t.clipes || []).length)) {
        if (!FF.Linha.pronta(linha)) await FF.Linha.preparar(linha);
        const viva = FF.Linha.iniciar(b, actor, target, Object.assign({}, move, { roteiro: [], _origem: move }), linha);
        await viva.fim;
      }
    } finally { b._corte(); b._corte = null; }
  },
};

// SPARKING POR PERSONAGEM: quando a Fúria enche, toca a "entrada no Sparking" (linha do tempo; trilha Quem solta =
// quem entrou) e, enquanto ela estiver cheia, a aura em loop e a pose parada escolhidas no Estúdio.
//   data/edicoes.js → sparking.entrada[<id>] → sparking.entrada.padrao → FF.Sparking.PADRAO
//                     sparking.visual[<id>] = {aura: {sprite, anim, escala, dx, dy, fps, alpha, frente}, parado: "Anim"}
FF.Sparking = {
  PADRAO: {
    duracao: 1.0,
    trilhas: [
      { id: 'atacante', tipo: 'lutador', quem: 'atacante', nome: 'Quem entra no Sparking', clipes: [] },
      { id: 'efeitos', tipo: 'efeitos', nome: 'Efeitos', clipes: [] },
      { id: 'sons', tipo: 'sons', nome: 'Sons e vozes', clipes: [{ id: 'sp1', tipo: 'som', t: 0, som: 'sprkngbrst_expl', vol: 70 }] },
      { id: 'tela', tipo: 'tela', nome: 'Tela', clipes: [
        { id: 'sp2', tipo: 'flash', t: 0, forca: 0.45, d: 0.15, cor: '#ffd21a' },
        { id: 'sp3', tipo: 'escurecer', t: 0, d: 0.9, forca: 0.4 },
        { id: 'sp4', tipo: 'camera', t: 0, d: 0.25, zoom: 1.2, foco: 'atacante' },
      ] },
    ],
  },
  ed() { return ((FF.Edicoes && FF.Edicoes.dados()) || {}).sparking || {}; },
  linhaSalva(id) { const e = this.ed().entrada || {}; return (id && id !== 'padrao' && e[id]) || e.padrao || null; },
  temPropria(id) { return !!(id && (this.ed().entrada || {})[id]); },
  temSalva(id) { return !!(this.ed().entrada || {})[id]; },
  linhaDe(id) { return JSON.parse(JSON.stringify(this.linhaSalva(id) || this.PADRAO)); },
  visual(id) { return (this.ed().visual || {})[id] || null; },
  async tocar(b, f, alvo) {
    const linha = this.linhaDe(f.def && f.def.id || f.id);
    const v = this.visual(f.def && f.def.id);
    if (v && v.aura && v.aura.sprite && FF.Assets.loadSprite) { try { await FF.Assets.loadSprite(v.aura.sprite); } catch (e) { /* sem aura */ } }
    if (linha.desligada || !(linha.trilhas || []).some(t => (t.clipes || []).length)) return;
    if (!FF.Linha.pronta(linha)) await FF.Linha.preparar(linha);
    const viva = FF.Linha.iniciar(b, f, alvo || null, { nome: 'Sparking', roteiro: [] }, linha);
    await viva.fim;
  },
};
