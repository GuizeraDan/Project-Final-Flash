// Favoritos do usuário no Estúdio: ele marca sprites (inteiros) ou animações e diz o que são
// (efeito, personagem, cenário, interface). Guardado em data/edicoes.js → favoritos (vale em todos os aparelhos):
//   favoritos["zl3_explosoes"] = "efeitos"            sprite inteiro (também muda o tipo dele: FF.Assets.tipoSprite)
//   favoritos["dw_aura#Todos"] = "efeitos"            uma animação só
window.FF = window.FF || {};

FF.Favoritos = {
  TIPOS: [['efeitos', '✺', 'Efeito'], ['personagens', '🥋', 'Personagem'], ['cenarios', '🏞', 'Cenário'], ['interface', '🖥', 'Interface']],
  icone(t) { const x = this.TIPOS.find(k => k[0] === t); return x ? x[1] : '⭐'; },
  nome(t) { const x = this.TIPOS.find(k => k[0] === t); return x ? x[2] : t; },
  todos() { return (FF.Edicoes && FF.Edicoes.dados().favoritos) || {}; },
  chave(sprite, anim) { return anim ? sprite + '#' + anim : sprite; },
  de(sprite, anim) { return this.todos()[this.chave(sprite, anim)] || null; },
  marcar(sprite, anim, tipo) { FF.Edicoes.setDepois(['favoritos', this.chave(sprite, anim)], tipo || null); },
  // [{sprite, anim|null, tipo}] (tipo opcional filtra)
  lista(tipo) {
    return Object.entries(this.todos()).filter(([, t]) => !tipo || t === tipo).map(([k, t]) => {
      const i = k.indexOf('#');
      return { sprite: i < 0 ? k : k.slice(0, i), anim: i < 0 ? null : k.slice(i + 1), tipo: t };
    });
  },
  // menu pequeno perto do botão: escolher o tipo ou tirar dos favoritos
  menu(ancora, sprite, anim, aoMudar) {
    document.querySelectorAll('.es-fav-menu').forEach(x => x.remove());
    const atual = this.de(sprite, anim);
    const m = document.createElement('div');
    m.className = 'es-fav-menu';
    const tit = document.createElement('div'); tit.className = 'es-fav-tit';
    tit.textContent = '⭐ ' + (anim ? 'Favoritar a animação "' + anim + '" como:' : 'Favoritar o sprite inteiro como:');
    m.appendChild(tit);
    this.TIPOS.forEach(([t, ic, nm]) => {
      const b = document.createElement('button');
      b.textContent = ic + ' ' + nm + (t === atual ? '  ✓' : '');
      if (t === atual) b.className = 'on';
      b.onclick = (e) => { e.stopPropagation(); this.marcar(sprite, anim, t); m.remove(); aoMudar && aoMudar(t); };
      m.appendChild(b);
    });
    if (atual) {
      const b = document.createElement('button'); b.textContent = '✕ Tirar dos favoritos'; b.className = 'tirar';
      b.onclick = (e) => { e.stopPropagation(); this.marcar(sprite, anim, null); m.remove(); aoMudar && aoMudar(null); };
      m.appendChild(b);
    }
    document.body.appendChild(m);
    const r = ancora.getBoundingClientRect();
    m.style.left = Math.max(4, Math.min(innerWidth - m.offsetWidth - 4, r.left)) + 'px';
    m.style.top = Math.max(4, Math.min(innerHeight - m.offsetHeight - 4, r.bottom + 2)) + 'px';
    const fora = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', fora, true); } };
    setTimeout(() => document.addEventListener('pointerdown', fora, true), 0);
  },
  // botão ☆/⭐ que abre o menu (para cartões e listas)
  botao(sprite, anim, aoMudar) {
    const b = document.createElement('button');
    b.className = 'es-fav-bt';
    const pintar = () => { const t = this.de(sprite, anim); b.textContent = t ? '⭐' + this.icone(t) : '☆'; b.classList.toggle('on', !!t); b.title = t ? 'Favorito: ' + this.nome(t) + ' (clique para mudar)' : (anim ? 'Favoritar esta animação' : 'Favoritar este sprite'); };
    pintar();
    b.onclick = (e) => { e.stopPropagation(); e.preventDefault(); this.menu(b, sprite, anim, (t) => { pintar(); aoMudar && aoMudar(t); }); };
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    return b;
  },
};
