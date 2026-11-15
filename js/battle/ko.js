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

// ABERTURA DO SUPREMO: cena que toca antes de todo golpe Supremo (tela escurece, zoom em quem solta, linhas de
// velocidade, faixa com o nome do golpe). Também é uma linha do tempo comum, editável no Estúdio:
//   data/edicoes.js → abertura[<id de quem solta>] → abertura.padrao → FF.Abertura.PADRAO
// Clipes de tela próprios: {tipo:"escurecer", d, forca} · {tipo:"linhas", d} · {tipo:"faixa", d, texto} ("{golpe}" = nome do golpe)
FF.Abertura = {
  PADRAO: {
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
  linhaSalva(id) {
    const ab = (FF.Edicoes && FF.Edicoes.dados().abertura) || {};
    return (id && id !== 'padrao' && ab[id]) || ab.padrao || null;
  },
  temPropria(id) { const ab = (FF.Edicoes && FF.Edicoes.dados().abertura) || {}; return !!(id && ab[id]); },
  linhaDe(id) { return JSON.parse(JSON.stringify(this.linhaSalva(id) || this.PADRAO)); },
  // toca a cena e espera terminar (devolve a câmera ao normal no fim)
  async tocar(b, actor, target, move) {
    const linha = this.linhaDe(actor.def && actor.def.id || actor.id);
    if (linha.desligada || !(linha.trilhas || []).some(t => (t.clipes || []).length)) return;
    if (!FF.Linha.pronta(linha)) await FF.Linha.preparar(linha);
    const viva = FF.Linha.iniciar(b, actor, target, Object.assign({}, move, { roteiro: [] }), linha);
    await viva.fim;
  },
};
