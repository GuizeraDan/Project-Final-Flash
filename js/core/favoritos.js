// Favoritos do usuário no Estúdio: ele marca sprites (inteiros) ou animações e diz o que são
// (efeito, personagem, cenário, interface). Guardado em data/edicoes.js → favoritos (vale em todos os aparelhos):
//   favoritos["zl3_explosoes"] = "efeitos"            sprite inteiro (também muda o tipo dele: FF.Assets.tipoSprite)
//   favoritos["dw_aura#Todos"] = "efeitos"            uma animação só
//   favSons["acervo/swz/explosao_1"] = "explosao"      sons (FF.FavSons), separados por categoria
//   favoritosPastas["Goku"] = ["gokubase#Kamehameha", "fx_extra"]   pastas criadas pelo usuário (nome livre;
//   favSonsPastas["Explosões grandes"] = ["acervo/swz/explosao_1"]    um item pode estar em várias pastas)
//   SUBPASTAS: o nome da pasta é o caminho, separado por "/" ("Android 18/Golpes"); a árvore é montada pelos nomes
//   (arvorePastas), e abrir uma pasta mostra os itens dela e das subpastas (itensPasta(nome, true)).
//   spritesInfo[id].pasta = "Goku"   sprite inteiro MOVIDO para a pasta: sai do lugar dele nas listas (acervo/do jogo)
//                                    e passa a morar só ali (seletor de sprites e aba Sprites). Só sprites (seção favoritos).
window.FF = window.FF || {};

// menu flutuante sempre dentro da tela (com muitas pastas ele rola sozinho, CSS max-height)
FF.menuNaTela = (m) => {
  const h = Math.min(m.offsetHeight, innerHeight - 12), w = m.offsetWidth;
  const top = parseFloat(m.style.top) || 0, left = parseFloat(m.style.left) || 0;
  m.style.top = Math.max(6, Math.min(innerHeight - h - 6, top)) + 'px';
  m.style.left = Math.max(4, Math.min(innerWidth - w - 4, left)) + 'px';
};
// comparar nomes em português (acentos, números em ordem natural) — Collator é bem mais rápido que localeCompare
FF.compararNomes = (function () { try { return new Intl.Collator('pt', { numeric: true }).compare; } catch (e) { return (a, b) => a.localeCompare(b); } })();
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
  // nomes ordenados, árvore e índice "item → pastas" calculados uma vez por versão das edições (desempenho:
  // cada linha das listas pergunta em quais pastas o item está; ordenar com acentos a cada pergunta travava os menus)
  _cacheP() {
    const p = this.pastas();
    if (this._pc && this._pc.p === p) return this._pc;
    const nomes = Object.keys(p).sort(FF.compararNomes), idx = new Map();
    nomes.forEach(n => (p[n] || []).forEach(k => { let a = idx.get(k); if (!a) idx.set(k, a = []); if (!a.includes(n)) a.push(n); }));
    return (this._pc = { p, nomes, idx, arvore: null });
  },
  nomesPastas() { return this._cacheP().nomes.slice(); },
  // ---- subpastas (o nome é o caminho "Pai/Filha") ----
  folha(nome) { const i = nome.lastIndexOf('/'); return i < 0 ? nome : nome.slice(i + 1); },
  paiDe(nome) { const i = nome.lastIndexOf('/'); return i < 0 ? '' : nome.slice(0, i); },
  nivel(nome) { return nome.split('/').length - 1; },
  descendentes(nome) { return this.nomesPastas().filter(n => n.startsWith(nome + '/')); },
  // árvore em ordem de exibição: [{nome, folha, nivel, temFilhas}] (pais que só existem pelo caminho também entram)
  arvorePastas() {
    const c = this._cacheP();
    if (!c.arvore) c.arvore = this._arvore();
    return c.arvore.map(x => Object.assign({}, x));
  },
  _arvore() {
    const todos = new Set();
    this.nomesPastas().forEach(n => { const p = n.split('/'); for (let i = 1; i <= p.length; i++) todos.add(p.slice(0, i).join('/')); });
    const filhas = (pai) => [...todos].filter(n => this.paiDe(n) === pai).sort((a, b) => FF.compararNomes(this.folha(a), this.folha(b)));
    const out = [];
    const andar = (pai) => filhas(pai).forEach(n => { const f = filhas(n); out.push({ nome: n, folha: this.folha(n), nivel: this.nivel(n), temFilhas: f.length > 0 }); andar(n); });
    andar('');
    return out;
  },
  itensPasta(nome, comSub) {
    const nomes = comSub ? [nome].concat(this.descendentes(nome)) : [nome];
    const l = [];
    nomes.forEach(pn => {
      (this.pastas()[pn] || []).forEach(k => { const i = k.indexOf('#'); const v = { sprite: i < 0 ? k : k.slice(0, i), anim: i < 0 ? null : k.slice(i + 1), tipo: this.todos()[k] || null, pasta: pn }; if (!l.some(x => x.sprite === v.sprite && x.anim === v.anim)) l.push(v); });
      this.movidos(pn).forEach(id => { if (!l.some(v => v.sprite === id && !v.anim)) l.push({ sprite: id, anim: null, tipo: this.todos()[id] || null, movido: true, pasta: pn }); });
    });
    return l;
  },
  // ---- sprites movidos para pastas (organizar o acervo) ----
  movidos(nome) {
    if (this.secao !== 'favoritos') return [];
    const info = (FF.Edicoes && FF.Edicoes.dados().spritesInfo) || {};
    return Object.keys(info).filter(id => info[id] && info[id].pasta === nome && !info[id].oculto);
  },
  // pasta onde o sprite mora (só se a pasta ainda existe); null = no lugar original
  pastaDoSprite(id) {
    if (this.secao !== 'favoritos') return null;
    const p = FF.Assets && FF.Assets.infoSprite(id).pasta;
    return p && this.pastas()[p] ? p : null;
  },
  moverSprites(ids, nome) {   // nome null = volta para o lugar original
    ids.forEach(id => {
      const v = Object.assign({}, FF.Assets.infoSprite(id));
      if (nome) v.pasta = nome; else delete v.pasta;
      FF.Edicoes.setDepois(['spritesInfo', id], FF.Edicoes.infoGravar(id, v));
    });
  },
  naPasta(nome, sprite, anim) { return (this.pastas()[nome] || []).includes(this.chave(sprite, anim)); },
  pastasDe(sprite, anim) { return (this._cacheP().idx.get(this.chave(sprite, anim)) || []).slice(); },
  alternarPasta(nome, sprite, anim) {
    const k = this.chave(sprite, anim), l = (this.pastas()[nome] || []).slice();
    const i = l.indexOf(k);
    if (i >= 0) l.splice(i, 1); else l.push(k);
    FF.Edicoes.setDepois([this.secao + 'Pastas', nome], l);
    return i < 0;
  },
  criarPasta(nome) {
    nome = String(nome || '').split('/').map(x => x.trim().slice(0, 40)).filter(Boolean).join('/').slice(0, 160);
    if (!nome || this.pastas()[nome]) return nome && this.pastas()[nome] ? nome : null;
    FF.Edicoes.setDepois([this.secao + 'Pastas', nome], []);
    return nome;
  },
  // renomeia/move uma pasta (novo = caminho completo); as subpastas e os sprites movidos vão junto
  renomearPasta(velho, novo) {
    novo = String(novo || '').split('/').map(x => x.trim().slice(0, 40)).filter(Boolean).join('/');
    if (!novo || novo === velho || novo.startsWith(velho + '/')) return false;
    const P = this.pastas(), troca = [velho].concat(this.descendentes(velho)).map(n => [n, novo + n.slice(velho.length)]);
    if (troca.some(([, b]) => P[b])) return false;   // já existe uma pasta com esse nome
    troca.forEach(([a, b]) => {
      FF.Edicoes.setDepois([this.secao + 'Pastas', b], (P[a] || []).slice());
      FF.Edicoes.setDepois([this.secao + 'Pastas', a], null);
      const mv = this.movidos(a); if (mv.length) this.moverSprites(mv, b);
    });
    return true;
  },
  renomearFolha(nome, folha) { const pai = this.paiDe(nome); return this.renomearPasta(nome, (pai ? pai + '/' : '') + String(folha || '').replace(/\//g, '-')); },
  // pôr a pasta dentro de outra ('' = no primeiro nível)
  moverPasta(nome, novoPai) {
    if (novoPai === nome || (novoPai && novoPai.startsWith(nome + '/'))) return false;
    if (this.paiDe(nome) === (novoPai || '')) return false;
    return this.renomearPasta(nome, (novoPai ? novoPai + '/' : '') + this.folha(nome));
  },
  // tudo = apaga também as subpastas; senão as subpastas sobem um nível. Os itens nunca são apagados.
  apagarPasta(nome, tudo) {
    const desc = this.descendentes(nome);
    if (tudo) desc.forEach(n => { const mv = this.movidos(n); if (mv.length) this.moverSprites(mv, null); FF.Edicoes.setDepois([this.secao + 'Pastas', n], null); });
    else {
      const pai = this.paiDe(nome);
      desc.filter(n => this.paiDe(n) === nome).forEach(n => this.renomearPasta(n, (pai ? pai + '/' : '') + this.folha(n)));
    }
    const mv = this.movidos(nome); if (mv.length) this.moverSprites(mv, null);
    FF.Edicoes.setDepois([this.secao + 'Pastas', nome], null);
  },
  // mover/copiar itens entre pastas. itens = [{sprite, anim, origem?, inteiro?, movido?}] (origem = pasta de onde saiu)
  // copiar (ou sem origem) = só põe na pasta de destino; mover = tira da origem. Sprite movido (📂) muda de pasta inteiro.
  moverItens(itens, dest, copiar) {
    let n = 0;
    const feitos = new Set();
    itens.forEach(v => {
      const mover = !copiar && v.origem && v.origem !== dest;
      if (v.movido && (mover || !v.origem)) { if (!feitos.has(v.sprite)) { feitos.add(v.sprite); this.moverSprites([v.sprite], dest); n++; } return; }
      const anim = v.inteiro ? null : v.anim, k = v.sprite + '#' + anim;
      if (feitos.has(k)) return; feitos.add(k);
      if (!this.naPasta(dest, v.sprite, anim)) this.alternarPasta(dest, v.sprite, anim);
      if (mover && this.naPasta(v.origem, v.sprite, anim)) this.alternarPasta(v.origem, v.sprite, anim);
      n++;
    });
    return n;
  },
  // menu pequeno: escolher uma pasta (árvore) ou criar uma nova; cb(nome)
  menuEscolherPasta(ancora, titulo, cb) {
    document.querySelectorAll('.es-fav-menu').forEach(x => x.remove());
    const m = document.createElement('div'); m.className = 'es-fav-menu';
    const tit = document.createElement('div'); tit.className = 'es-fav-tit'; tit.textContent = titulo; m.appendChild(tit);
    const fim = (nome) => { m.remove(); cb(nome); };
    this.botoesArvore(m, (nome) => ({ texto: '📁 ' + this.folha(nome) }), fim);
    const nova = document.createElement('button'); nova.className = 'nova'; nova.textContent = '＋ Nova pasta…';
    nova.onclick = (e) => {
      e.stopPropagation();
      const inp = document.createElement('input'); inp.placeholder = 'Nome (use / para subpasta: Goku/SSJ)'; inp.className = 'es-fav-nova';
      nova.replaceWith(inp); inp.focus();
      let feito = false;
      const ok = (sim) => { if (feito) return; feito = true; const n = sim && inp.value.trim() ? this.criarPasta(inp.value) : null; if (n) fim(n); else m.remove(); };
      inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') ok(true); if (ev.key === 'Escape') ok(false); };
      inp.onblur = () => ok(true);
      inp.onpointerdown = (ev) => ev.stopPropagation();
    };
    m.appendChild(nova);
    document.body.appendChild(m);
    const r = ancora.getBoundingClientRect();
    m.style.left = Math.max(4, Math.min(innerWidth - m.offsetWidth - 4, r.left)) + 'px';
    m.style.top = Math.max(4, r.bottom + 2 + m.offsetHeight < innerHeight ? r.bottom + 2 : r.top - m.offsetHeight - 4) + 'px';
    FF.menuNaTela(m);   // sempre inteiro dentro da tela (a âncora pode estar fora, numa lista rolada)
    const fora = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', fora, true); } };
    setTimeout(() => document.addEventListener('pointerdown', fora, true), 0);
  },
  // lista de pastas com recuo (menus ⭐ e 📂)
  botoesArvore(caixa, rotulo, onclick) {
    this.arvorePastas().forEach(p => {
      const b = document.createElement('button');
      const r = rotulo(p.nome);
      b.textContent = r.texto; if (r.on) b.className = 'on';
      b.style.paddingLeft = (6 + p.nivel * 14) + 'px';
      if (r.title) b.title = r.title;
      b.onclick = (e) => { e.stopPropagation(); onclick(p.nome); };
      caixa.appendChild(b);
    });
  },
  // menu "📂 Mover para a pasta": sprites inteiros (ids) mudam de lugar nas listas; null = voltar ao lugar original
  menuMover(ancora, ids, aoMudar) {
    document.querySelectorAll('.es-fav-menu').forEach(x => x.remove());
    const m = document.createElement('div'); m.className = 'es-fav-menu';
    const tit = document.createElement('div'); tit.className = 'es-fav-tit';
    tit.textContent = '📂 Mover ' + (ids.length === 1 ? '"' + FF.Assets.nomeSprite(ids[0]) + '"' : ids.length + ' sprites') + ' para a pasta:';
    m.appendChild(tit);
    const fim = (nome) => { this.moverSprites(ids, nome); m.remove(); aoMudar && aoMudar(nome); };
    const atual = ids.length === 1 ? this.pastaDoSprite(ids[0]) : null;
    this.botoesArvore(m, (nome) => ({ texto: '📁 ' + this.folha(nome) + (nome === atual ? '  ✓' : ''), on: nome === atual }), (nome) => fim(nome));
    const nova = document.createElement('button'); nova.className = 'nova'; nova.textContent = '＋ Nova pasta…';
    nova.onclick = (e) => {
      e.stopPropagation();
      const inp = document.createElement('input'); inp.placeholder = 'Nome da pasta (ex.: Majin Buu)'; inp.className = 'es-fav-nova';
      nova.replaceWith(inp); inp.focus();
      let feito = false;
      const ok = (sim) => { if (feito) return; feito = true; const n = sim && inp.value.trim() ? this.criarPasta(inp.value) : null; if (n) fim(n); else m.remove(); };
      inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') ok(true); if (ev.key === 'Escape') ok(false); };
      inp.onblur = () => ok(true);
      inp.onpointerdown = (ev) => ev.stopPropagation();
    };
    m.appendChild(nova);
    if (ids.some(id => this.pastaDoSprite(id))) {
      const b = document.createElement('button'); b.className = 'tirar'; b.textContent = '↩ Voltar para o lugar original';
      b.onclick = (e) => { e.stopPropagation(); fim(null); };
      m.appendChild(b);
    }
    document.body.appendChild(m);
    const r = ancora.getBoundingClientRect();
    m.style.left = Math.max(4, Math.min(innerWidth - m.offsetWidth - 4, r.left)) + 'px';
    const embaixo = r.bottom + 2 + m.offsetHeight < innerHeight;
    m.style.top = Math.max(4, embaixo ? r.bottom + 2 : r.top - m.offsetHeight - 4) + 'px';
    FF.menuNaTela(m);   // sempre inteiro dentro da tela (a âncora pode estar fora, numa lista rolada)
    const fora = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', fora, true); } };
    setTimeout(() => document.addEventListener('pointerdown', fora, true), 0);
  },
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
      this.botoesArvore(caixa, (nome) => { const dentro = this.naPasta(nome, sprite, anim); return { texto: (dentro ? '☑ ' : '☐ ') + this.folha(nome), on: dentro }; },
        (nome) => { this.alternarPasta(nome, sprite, anim); pintarPastas(); aoMudar && aoMudar(this.de(sprite, anim)); });
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
    FF.menuNaTela(m);   // sempre inteiro dentro da tela (a âncora pode estar fora, numa lista rolada)
    const fora = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', fora, true); } };
    setTimeout(() => document.addEventListener('pointerdown', fora, true), 0);
  },
  // menu para VÁRIOS itens de uma vez (seleção múltipla): categoria, pasta (colocar todos) ou tirar dos favoritos
  // itens = [{sprite, anim}]
  menuVarios(ancora, itens, aoMudar) {
    document.querySelectorAll('.es-fav-menu').forEach(x => x.remove());
    const m = document.createElement('div');
    m.className = 'es-fav-menu';
    const tit = document.createElement('div'); tit.className = 'es-fav-tit';
    tit.textContent = '⭐ Favoritar os ' + itens.length + ' selecionados como:';
    m.appendChild(tit);
    const fim = () => { m.remove(); aoMudar && aoMudar(); };
    this.TIPOS.forEach(([t, ic, nm]) => {
      const b = document.createElement('button');
      const ja = itens.every(v => this.de(v.sprite, v.anim) === t);
      b.textContent = ic + ' ' + nm + (ja ? '  ✓' : '');
      if (ja) b.className = 'on';
      b.onclick = (e) => { e.stopPropagation(); itens.forEach(v => this.marcar(v.sprite, v.anim, t)); fim(); };
      m.appendChild(b);
    });
    if (itens.some(v => this.de(v.sprite, v.anim))) {
      const b = document.createElement('button'); b.textContent = '✕ Tirar todos dos favoritos'; b.className = 'tirar';
      b.onclick = (e) => { e.stopPropagation(); itens.forEach(v => this.marcar(v.sprite, v.anim, null)); fim(); };
      m.appendChild(b);
    }
    const tp = document.createElement('div'); tp.className = 'es-fav-tit es-fav-tit-pastas'; tp.textContent = '📁 Colocar todos na pasta:';
    m.appendChild(tp);
    const caixa = document.createElement('div'); caixa.className = 'es-fav-pastas';
    m.appendChild(caixa);
    const colocar = (nome) => { itens.forEach(v => { if (!this.naPasta(nome, v.sprite, v.anim)) this.alternarPasta(nome, v.sprite, v.anim); }); };
    const tirar = (nome) => { itens.forEach(v => { if (this.naPasta(nome, v.sprite, v.anim)) this.alternarPasta(nome, v.sprite, v.anim); }); };
    const pintar = () => {
      caixa.innerHTML = '';
      this.botoesArvore(caixa, (nome) => { const todos = itens.every(v => this.naPasta(nome, v.sprite, v.anim)); return { texto: (todos ? '☑ ' : '☐ ') + this.folha(nome), on: todos, title: todos ? 'Tirar todos desta pasta' : 'Colocar todos nesta pasta' }; },
        (nome) => { if (itens.every(v => this.naPasta(nome, v.sprite, v.anim))) tirar(nome); else colocar(nome); pintar(); aoMudar && aoMudar(); });
      const nova = document.createElement('button'); nova.className = 'nova'; nova.textContent = '＋ Nova pasta…';
      nova.onclick = (e) => {
        e.stopPropagation();
        const inp = document.createElement('input'); inp.placeholder = 'Nome da pasta'; inp.className = 'es-fav-nova';
        nova.replaceWith(inp); inp.focus();
        const ok = (sim) => { if (sim && inp.value.trim()) { const n = this.criarPasta(inp.value); if (n) colocar(n); aoMudar && aoMudar(); } pintar(); };
        inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') ok(true); if (ev.key === 'Escape') ok(false); };
        inp.onblur = () => ok(true);
        inp.onpointerdown = (ev) => ev.stopPropagation();
      };
      caixa.appendChild(nova);
    };
    pintar();
    document.body.appendChild(m);
    const r = ancora.getBoundingClientRect();
    m.style.left = Math.max(4, Math.min(innerWidth - m.offsetWidth - 4, r.left)) + 'px';
    m.style.top = Math.max(4, Math.min(innerHeight - m.offsetHeight - 4, r.top - m.offsetHeight - 4)) + 'px';
    FF.menuNaTela(m);   // sempre inteiro dentro da tela (a âncora pode estar fora, numa lista rolada)
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
  const arvore = F.arvorePastas(), raizes = arvore.filter(p => !p.nivel).length;
  // título que abre/fecha (como as categorias do acervo); fechado fica lembrado no aparelho, por seção (sprites/sons)
  const CH = 'ff_estudio_pastas_fechadas', CA = 'ff_estudio_pastas_abertas';
  const ler = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } };
  const fechadas = ler(CH), abertasTodas = ler(CA);
  const abertas = new Set(abertasTodas[F.secao] || []);
  // a pasta aberta na grade: os pais dela ficam abertos
  const atual = (chaveAtual && chaveAtual()) || '';
  const fechouAtual = abertasTodas[F.secao + ':fechou'] === atual;   // fechou a pasta aberta na grade de propósito
  if (/^pasta:/.test(atual)) { const n = atual.slice(6).split('/'); for (let k = 1; k <= n.length; k++) if (k < n.length || !fechouAtual) abertas.add(n.slice(0, k).join('/')); }   // e ela mesma (mostra as subpastas)
  const sub = document.createElement('div'); sub.className = 'es-seletor-cat es-pastas-cab';
  const corpo = document.createElement('div'); corpo.className = 'es-seletor-cat-corpo es-pastas-corpo';
  const pintarCab = () => { const f = !!fechadas[F.secao]; sub.textContent = (f ? '▸ ' : '▾ ') + '📁 Minhas pastas (' + raizes + ')'; corpo.style.display = f ? 'none' : ''; };
  sub.onclick = () => { fechadas[F.secao] = !fechadas[F.secao]; if (!fechadas[F.secao]) delete fechadas[F.secao]; gravar(CH, fechadas); pintarCab(); };
  sub.title = 'Solte uma pasta aqui para ela voltar ao primeiro nível';
  FF.alvoDePasta(F, sub, '', () => aoMudar(null));   // soltar uma pasta no título = primeiro nível
  pai.append(sub, corpo);
  pintarCab();
  pai = corpo;   // itens, "Nova pasta" e a dica vão dentro do corpo que abre/fecha
  const visivel = (nome) => { const p = nome.split('/'); for (let k = 1; k < p.length; k++) if (!abertas.has(p.slice(0, k).join('/'))) return false; return true; };
  const pedirNome = (item, valor, ok) => {
    const t = item.querySelector('span:not(.es-seletor-acoes):not(.es-pasta-seta)');
    const inp = document.createElement('input'); inp.value = valor; inp.className = 'es-som-renomear';
    if (t) t.replaceWith(inp); else item.appendChild(inp);
    inp.focus(); inp.select();
    ['click', 'pointerdown', 'dblclick'].forEach(ev => inp.addEventListener(ev, (e) => e.stopPropagation()));
    let feito = false;
    const fim = (sim) => { if (feito) return; feito = true; ok(sim ? inp.value.trim() : null); };
    inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') fim(true); if (ev.key === 'Escape') fim(false); };
    inp.onblur = () => fim(true);
  };
  arvore.forEach(p => {
    const nome = p.nome;
    if (!visivel(nome)) return;
    // contador: só o que dá para ver; itens de sprites na Lixeira aparecem à parte ("0 +38🗑")
    const tudoP = F.itensPasta(nome, true), lixo = FF.Assets && FF.Assets.spriteOculto ? tudoP.filter(v => FF.Assets.spriteOculto(v.sprite)).length : 0;
    const el = bt('pasta:' + nome, '📁 ' + p.folha, String(tudoP.length - lixo) + (lixo ? ' +' + lixo + '🗑' : ''), pai);
    const item = el && el.closest ? (el.closest('.es-item') || el) : el;
    if (!item) return;
    item.classList.add('es-pasta-item');
    item.style.paddingLeft = (4 + p.nivel * 16) + 'px';
    item.title = nome;
    // ▸/▾ das pastas que têm subpastas
    const seta = document.createElement('span'); seta.className = 'es-pasta-seta';
    seta.textContent = p.temFilhas ? (abertas.has(nome) ? '▾' : '▸') : '';
    if (p.temFilhas) seta.onclick = (e) => {
      e.stopPropagation();
      if (abertas.has(nome)) { abertas.delete(nome); if (atual === 'pasta:' + nome) abertasTodas[F.secao + ':fechou'] = atual; }
      else { abertas.add(nome); delete abertasTodas[F.secao + ':fechou']; }
      abertasTodas[F.secao] = [...abertas]; gravar(CA, abertasTodas); aoMudar(null);
    };
    item.insertBefore(seta, item.firstChild);
    // arrastar a pasta para dentro de outra (ou para o título "Minhas pastas")
    item.draggable = true;
    item.addEventListener('dragstart', (e) => { e.dataTransfer.setData(FF.TIPO_ARRASTO_PASTA, nome); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); });
    FF.alvoDePasta(F, item, nome, () => aoMudar(null));
    const ac = document.createElement('span'); ac.className = 'es-seletor-acoes es-pasta-acoes';
    const subp = document.createElement('button'); subp.textContent = '＋'; subp.title = 'Criar uma subpasta dentro de "' + p.folha + '"';
    subp.onclick = (e) => {
      e.stopPropagation();
      abertas.add(nome); abertasTodas[F.secao] = [...abertas]; gravar(CA, abertasTodas);
      const linha = document.createElement('div'); linha.className = 'es-item es-seletor-fonte es-pasta-item'; linha.style.paddingLeft = (4 + (p.nivel + 1) * 16) + 'px';
      item.after(linha);
      pedirNome(linha, '', (v) => { const n = v ? F.criarPasta(nome + '/' + v.replace(/\//g, '-')) : null; aoMudar(n ? 'pasta:' + n : null); });
    };
    const ren = document.createElement('button'); ren.textContent = '✏'; ren.title = 'Renomear a pasta';
    ren.onclick = (e) => {
      e.stopPropagation();
      pedirNome(item, p.folha, (v) => {
        let novo = null;
        if (v && v !== p.folha) { if (F.renomearFolha(nome, v)) novo = (p.nivel ? F.paiDe(nome) + '/' : '') + v.replace(/\//g, '-'); else FF.Estudio && FF.Estudio.aviso('Já existe uma pasta com esse nome aqui.', 'erro'); }
        const cur = chaveAtual && chaveAtual();
        aoMudar(novo && cur && (cur === 'pasta:' + nome || cur.startsWith('pasta:' + nome + '/')) ? 'pasta:' + novo + cur.slice(6 + nome.length) : null);
      });
    };
    const del = document.createElement('button'); del.textContent = '🗑'; del.title = 'Apagar a pasta (o que está dentro continua no Estúdio)'; del.className = 'es-bt-perigo';
    del.onclick = async (e) => {
      e.stopPropagation();
      const E = FF.Estudio;
      let tudo = false;
      if (p.temFilhas && E && E.escolha) {
        const r = await E.escolha('Apagar pasta', 'A pasta "' + p.folha + '" tem subpastas. O que fazer com elas? (Os sprites e animações nunca são apagados; os movidos voltam para o lugar de origem.)',
          [{ txt: 'Apagar só esta (as subpastas sobem um nível)', valor: 'so', cls: 'es-bt-ouro' }, { txt: '🗑 Apagar com as subpastas', valor: 'tudo', cls: 'es-bt-perigo' }, { txt: 'Cancelar', valor: null }]);
        if (!r) return;
        tudo = r === 'tudo';
      } else {
        const ok = E && E.confirmar ? await E.confirmar('Apagar pasta', 'Apagar a pasta "' + p.folha + '"? O que está dentro dela continua no Estúdio.', '🗑 Apagar', true) : true;
        if (!ok) return;
      }
      F.apagarPasta(nome, tudo);
      const cur = chaveAtual && chaveAtual();
      if (cur === 'pasta:' + nome || (tudo && cur && cur.startsWith('pasta:' + nome + '/'))) aoApagarAtual && aoApagarAtual();
      aoMudar();
    };
    ac.append(subp, ren, del);
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
  if (!arvore.length) { const p = document.createElement('p'); p.className = 'es-dica'; p.textContent = 'Crie pastas com o nome que quiser e coloque itens nelas pela ☆.'; pai.appendChild(p); }
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

// arrastar e soltar numa pasta (seletor de sprites e aba Sprites):
//   'application/x-ff-sprites' = ["id", ...]          sprites inteiros: MOVE para a pasta
//   'application/x-ff-anims'   = [["id", "anim"], ...] animações: coloca na pasta (continuam no sprite delas)
FF.TIPO_ARRASTO_SPRITES = 'application/x-ff-sprites';
FF.TIPO_ARRASTO_ANIMS = 'application/x-ff-anims';
FF.TIPO_ARRASTO_PASTA = 'application/x-ff-pasta';
FF.alvoDePasta = (F, el, nome, aoMudar) => {
  const tipos = (e) => [...(e.dataTransfer && e.dataTransfer.types || [])];
  // sons só aceitam pastas (sprites e animações são da seção de sprites); '' = título "Minhas pastas" (só pastas)
  const aceita = (e) => tipos(e).some(t => t === FF.TIPO_ARRASTO_PASTA || (nome && F.secao === 'favoritos' && (t === FF.TIPO_ARRASTO_SPRITES || t === FF.TIPO_ARRASTO_ANIMS)));
  el.addEventListener('dragover', (e) => { if (!aceita(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = e.ctrlKey || e.metaKey ? 'copy' : 'move'; el.classList.add('es-pasta-alvo'); });
  el.addEventListener('dragleave', () => el.classList.remove('es-pasta-alvo'));
  el.addEventListener('drop', (e) => {
    el.classList.remove('es-pasta-alvo');
    if (!aceita(e)) return;
    e.preventDefault(); e.stopPropagation();
    let n = 0, copiou = true;
    const pasta = e.dataTransfer.getData(FF.TIPO_ARRASTO_PASTA);
    if (pasta) {   // pasta solta dentro de outra (ou no título = primeiro nível)
      if (F.moverPasta(pasta, nome)) { FF.Estudio && FF.Estudio.aviso('📁 "' + F.folha(pasta) + '" ' + (nome ? 'agora está dentro de "' + F.folha(nome) + '"' : 'voltou para o primeiro nível')); aoMudar && aoMudar(); }
      else if (pasta !== nome && F.paiDe(pasta) !== (nome || '')) FF.Estudio && FF.Estudio.aviso('Não dá para pôr a pasta aí (dentro dela mesma ou já existe uma com esse nome).', 'erro');
      return;
    }
    if (!nome) return;
    try {
      const spr = e.dataTransfer.getData(FF.TIPO_ARRASTO_SPRITES), an = e.dataTransfer.getData(FF.TIPO_ARRASTO_ANIMS);
      if (spr) { const ids = JSON.parse(spr); F.moverSprites(ids, nome); n = ids.length; }
      else if (an) {
        // [id, anim, origem?, inteiro?, movido?] — vindo de dentro de uma pasta = MOVE (Ctrl = copia)
        const l = JSON.parse(an).map(([sprite, anim, origem, inteiro, movido]) => ({ sprite, anim, origem, inteiro, movido }));
        copiou = e.ctrlKey || e.metaKey || !l.some(v => v.origem);
        n = F.moverItens(l, nome, e.ctrlKey || e.metaKey);
      }
    } catch (err) { return; }
    if (n && FF.Estudio && FF.Estudio.aviso) FF.Estudio.aviso('📁 ' + n + (n === 1 ? ' item ' : ' itens ') + (copiou ? 'em' : 'movido(s) para') + ' "' + F.folha(nome) + '"');
    aoMudar && aoMudar();
  });
};

// rolagem automática enquanto arrasta perto da borda de cima/de baixo de uma lista que rola (coluna de pastas)
FF.autoRolarArraste = (el) => {
  if (!el || el._autoRolar) return;
  el._autoRolar = true;
  el.addEventListener('dragover', (e) => {
    const r = el.getBoundingClientRect(), zona = Math.min(60, r.height / 4);
    const v = e.clientY < r.top + zona ? -(1 - (e.clientY - r.top) / zona) : e.clientY > r.bottom - zona ? 1 - (r.bottom - e.clientY) / zona : 0;
    if (v) el.scrollTop += Math.round(v * 28);
  });
};
