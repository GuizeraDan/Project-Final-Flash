// Cena de KO: o que acontece quando um lutador é derrotado (vida chega a zero).
// É uma linha do tempo comum (js/battle/linha.js), tocada junto com o golpe que derrubou:
//   trilha "Quem solta" = quem deu o golpe final · trilha "Alvo" = quem foi derrotado.
// De onde vem (o primeiro que existir):
//   data/edicoes.js → ko[<id do personagem derrotado>]   (cena própria, feita no Estúdio)
//   data/edicoes.js → ko.padrao                          (padrão de todos, editado no Estúdio)
//   FF.KO.PADRAO                                         (o original do jogo, abaixo)
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

  // linha salva para o personagem (ou a padrão); 'padrao' devolve só a padrão
  linhaSalva(id) {
    const ko = (FF.Edicoes && FF.Edicoes.dados().ko) || {};
    return (id && id !== 'padrao' && ko[id]) || ko.padrao || null;
  },
  temPropria(id) { const ko = (FF.Edicoes && FF.Edicoes.dados().ko) || {}; return !!(id && ko[id]); },
  linhaDe(id) { return JSON.parse(JSON.stringify(this.linhaSalva(id) || this.PADRAO)); },

  // toca a cena (não bloqueia o golpe); devolve uma promessa que termina com a cena
  tocar(b, att, def) {
    const linha = this.linhaDe(def.def && def.def.id || def.id);
    const comecar = () => {
      const viva = FF.Linha.iniciar(b, att, def, { nome: '' }, linha, { ko: true });
      return viva.fim.then(() => { def.react = null; if (def.ko) def.idle(); });
    };
    if (FF.Linha.pronta(linha)) return comecar();
    return FF.Linha.preparar(linha).then(comecar);
  },
};
