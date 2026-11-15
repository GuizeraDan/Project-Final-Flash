// Favoritos do usuário no Estúdio: ele marca sprites (inteiros) ou animações e diz o que são
// (efeito, personagem, cenário, interface). Guardado em data/edicoes.js → favoritos (vale em todos os aparelhos):
//   favoritos["zl3_explosoes"] = "efeitos"            sprite inteiro (também muda o tipo dele: FF.Assets.tipoSprite)
//   favoritos["dw_aura#Todos"] = "efeitos"            uma animação só
//   favSons["acervo/swz/explosao_1"] = "explosao"      sons (FF.FavSons), separados por categoria
//   favoritosPastas["Goku"] = ["gokubase#Kamehameha", "fx_extra"]   pastas criadas pelo usuário (nome livre;
//   favSonsPastas["Explosões grandes"] = ["acervo/swz/explosao_1"]    um item pode estar em várias pastas)
window.FF = window.FF || {};

FF.criarFavoritos = (secao, TIPOS, plural) => ({
  secao, TIPOS, plural,
  icone(t) { const x = this.TIPOS.find(k => k[0] === t); return x ? x[1] : '⭐'; },
  nome(t) { const x = this.TIPOS.find(k => k[0] === t); return x ? x[2] : t; },
  todos() { return (FF.Edicoes && FF.Edicoes.dados()[this.secao]) || {}; },
  chave(sprite, anim) { return anim ? sprite + '#' + anim : sprite; },
  de(sprite, anim) { return this.todos()[this.chave(sprite, anim)] || null; },
  marcar(sprite, anim, tipo) { FF.Edicoes.setDepois([this.secao, this.chave(sprite, anim)], tipo || null); },
  // ---- pastas do usuário ----
  pastas() { return (FF.Edicoes && FF.Edicoes.dados()[this.secao + 'Pastas']) || {}; },
  nomesPastas() { return Object.keys(this.pastas()).sort((a, b) => a.localeCompare(b, 'pt')); },
  itensPasta(nome) {
    return (this.pastas()[nome] || []).map(k => { const i = k.indexOf('#'); return { sprite: i < 0 ? k : k.slice(0, i), anim: i < 0 ? null : k.slice(i + 1), tipo: this.todos()[k] || null }; });
  },
  naPasta(nome, sprite, anim) { return (this.pastas()[nome] || []).includes(this.chave(sprite, anim)); },
  pastasDe(sprite, anim) { const k = this.chave(sprite, anim); return this.nomesPastas().filter(n => (this.pastas()[n] || []).includes(k)); },
  alternarPasta(nome, sprite, anim) {
    const k = this.chave(sprite, anim), l = (this.pastas()[nome] || []).slice();
    const i = l.indexOf(k);
    if (i >= 0) l.splice(i, 1); else l.push(k);
    FF.Edicoes.setDepois([this.secao + 'Pastas', nome], l);
    return i < 0;
  },
  criarPasta(nome) {
    nome = String(nome || '').trim().slice(0, 40);
    if (!nome || this.pastas()[nome]) return nome && this.pastas()[nome] ? nome : null;
    FF.Edicoes.setDepois([this.secao + 'Pastas', nome], []);
    return nome;
  },
  renomearPasta(velho, novo) {
    novo = String(novo || '').trim().slice(0, 40);
    if (!novo || novo === velho || this.pastas()[novo]) return false;
    const l = (this.pastas()[velho] || []).slice();
    FF.Edicoes.setDepois([this.secao + 'Pastas', novo], l);
    FF.Edicoes.setDepois([this.secao + 'Pastas', velho], null);
    return true;
  },
  apagarPasta(nome) { FF.Edicoes.setDepois([this.secao + 'Pastas', nome], null); },
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
    tit.textContent = '⭐ ' + (this.secao === 'favSons' ? 'Favoritar este som como:' : anim ? 'Favoritar a animação "' + anim + '" como:' : 'Favoritar o sprite inteiro como:');
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
    // 📁 pastas do usuário: marca/desmarca em quais pastas este item fica (o menu continua aberto)
    const tp = document.createElement('div'); tp.className = 'es-fav-tit es-fav-tit-pastas'; tp.textContent = '📁 Colocar na pasta:';
    m.appendChild(tp);
    const caixa = document.createElement('div'); caixa.className = 'es-fav-pastas';
    m.appendChild(caixa);
    const pintarPastas = () => {
      caixa.innerHTML = '';
      this.nomesPastas().forEach(nome => {
        const b = document.createElement('button');
        const dentro = this.naPasta(nome, sprite, anim);
        b.textContent = (dentro ? '☑ ' : '☐ ') + nome;
        if (dentro) b.className = 'on';
        b.onclick = (e) => { e.stopPropagation(); this.alternarPasta(nome, sprite, anim); pintarPastas(); aoMudar && aoMudar(this.de(sprite, anim)); };
        caixa.appendChild(b);
      });
      const nova = document.createElement('button'); nova.className = 'nova'; nova.textContent = '＋ Nova pasta…';
      nova.onclick = (e) => {
        e.stopPropagation();
        const inp = document.createElement('input'); inp.placeholder = 'Nome (ex.: Goku, Explosões grandes)'; inp.className = 'es-fav-nova';
        nova.replaceWith(inp); inp.focus();
        const fim = (ok) => {
          if (ok && inp.value.trim()) { const n = this.criarPasta(inp.value); if (n && !this.naPasta(n, sprite, anim)) this.alternarPasta(n, sprite, anim); aoMudar && aoMudar(this.de(sprite, anim)); }
          pintarPastas();
        };
        inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') fim(true); if (ev.key === 'Escape') fim(false); };
        inp.onblur = () => fim(true);
        inp.onpointerdown = (ev) => ev.stopPropagation();
      };
      caixa.appendChild(nova);
    };
    pintarPastas();
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
    const pintar = () => {
      const t = this.de(sprite, anim), ps = this.pastasDe(sprite, anim);
      b.textContent = (t ? '⭐' + this.icone(t) : '☆') + (ps.length ? '📁' : '');
      b.classList.toggle('on', !!t || ps.length > 0);
      b.title = (t ? 'Favorito: ' + this.nome(t) + ' (clique para mudar)' : (this.secao === 'favSons' ? 'Favoritar este som' : anim ? 'Favoritar esta animação' : 'Favoritar este sprite') + ' ou colocar numa pasta') + (ps.length ? '\nPastas: ' + ps.join(', ') : '');
    };
    pintar();
    b.onclick = (e) => { e.stopPropagation(); e.preventDefault(); this.menu(b, sprite, anim, (t) => { pintar(); aoMudar && aoMudar(t); }); };
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    return b;
  },
});

// lista de pastas na coluna da esquerda (seletor de sons, seletor de sprites): título + "📁 nome (n)" com ✏ renomear e
// 🗑 apagar + "＋ Nova pasta". bt(chave, texto, n, pai) cria o item clicável e devolve o elemento; aoMudar() redesenha.
FF.listaPastas = (F, pai, bt, aoMudar, chaveAtual, aoApagarAtual) => {
  const nomes = F.nomesPastas();
  const sub = document.createElement('div'); sub.className = 'es-sub'; sub.textContent = '📁 Minhas pastas';
  pai.appendChild(sub);
  nomes.forEach(nome => {
    const el = bt('pasta:' + nome, '📁 ' + nome, String((F.pastas()[nome] || []).length), pai);
    const item = el && el.closest ? (el.closest('.es-item') || el) : el;
    if (!item) return;
    const ac = document.createElement('span'); ac.className = 'es-seletor-acoes es-pasta-acoes';
    const ren = document.createElement('button'); ren.textContent = '✏'; ren.title = 'Renomear a pasta';
    ren.onclick = (e) => {
      e.stopPropagation();
      const t = item.querySelector('span:not(.es-seletor-acoes)');
      const inp = document.createElement('input'); inp.value = nome; inp.className = 'es-som-renomear';
      if (t) t.replaceWith(inp); else item.appendChild(inp);
      inp.focus(); inp.select();
      inp.onclick = (ev) => ev.stopPropagation();
      const fim = (ok) => { if (ok && inp.value.trim() && inp.value.trim() !== nome) { if (!F.renomearPasta(nome, inp.value)) FF.Estudio && FF.Estudio.aviso('Já existe uma pasta com esse nome.', 'erro'); } aoMudar(ok && chaveAtual() === 'pasta:' + nome ? 'pasta:' + inp.value.trim() : null); };
      inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') fim(true); if (ev.key === 'Escape') fim(false); };
      inp.onblur = () => fim(true);
    };
    const del = document.createElement('button'); del.textContent = '🗑'; del.title = 'Apagar a pasta (os sons/sprites continuam, só a pasta some)'; del.className = 'es-bt-perigo';
    del.onclick = async (e) => {
      e.stopPropagation();
      const ok = FF.Estudio && FF.Estudio.confirmar ? await FF.Estudio.confirmar('Apagar pasta', 'Apagar a pasta "' + nome + '"? O que está dentro dela continua no Estúdio.', '🗑 Apagar', true) : true;
      if (!ok) return;
      F.apagarPasta(nome);
      if (chaveAtual() === 'pasta:' + nome) aoApagarAtual && aoApagarAtual();
      aoMudar();
    };
    ac.append(ren, del);
    item.appendChild(ac);
  });
  const nova = document.createElement('div'); nova.className = 'es-item es-seletor-fonte es-pasta-nova'; nova.textContent = '＋ Nova pasta';
  nova.title = 'Criar uma pasta (ex.: o nome de um personagem). Depois use a ☆ de um item para colocar ele dentro.';
  nova.onclick = () => {
    const inp = document.createElement('input'); inp.placeholder = 'Nome da pasta'; inp.className = 'es-som-renomear';
    nova.replaceWith(inp); inp.focus();
    const fim = (ok) => { const n = ok ? F.criarPasta(inp.value) : null; aoMudar(n ? 'pasta:' + n : null); };
    inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') fim(true); if (ev.key === 'Escape') fim(false); };
    inp.onblur = () => fim(true);
  };
  pai.appendChild(nova);
  if (!nomes.length) { const p = document.createElement('p'); p.className = 'es-dica'; p.textContent = 'Crie pastas com o nome que quiser e coloque itens nelas pela ☆.'; pai.appendChild(p); }
};

// sprites (o tipo de um sprite inteiro do acervo vira o tipo dele; "Explosão" conta como efeito)
FF.Favoritos = FF.criarFavoritos('favoritos',
  [['explosoes', '💥', 'Explosão'], ['efeitos', '✺', 'Efeito'], ['personagens', '🥋', 'Personagem'], ['cenarios', '🏞', 'Cenário'], ['interface', '🖥', 'Interface']],
  { explosoes: 'Explosões', efeitos: 'Efeitos', personagens: 'Personagens', cenarios: 'Cenários', interface: 'Interface' });
// sons (id do som = o nome que o FF.Audio toca, ex.: "acervo/swz/frz_ep_1_voz_tz" ou "goku_kamehame_fire")
FF.FavSons = FF.criarFavoritos('favSons',
  [['explosao', '💥', 'Explosão'], ['golpe', '👊', 'Golpe / impacto'], ['ki', '⚡', 'Ki / energia'], ['aura', '✨', 'Aura / transformação'],
    ['voz', '🗣', 'Voz / personagem'], ['movimento', '💨', 'Movimento'], ['musica', '🎵', 'Música'], ['interface', '🖥', 'Interface'], ['outros', '🔊', 'Outros']],
  { explosao: 'Explosões', golpe: 'Golpes e impactos', ki: 'Ki e energia', aura: 'Auras e transformações', voz: 'Vozes e personagens', movimento: 'Movimentos', musica: 'Músicas', interface: 'Interface', outros: 'Outros' });
