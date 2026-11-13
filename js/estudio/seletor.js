// Estúdio — seletor de sprites: TODAS as animações de TODOS os sprites (efeitos, lutadores, importados e o
// acervo completo do Z Legends 3), para qualquer personagem. À esquerda escolhe a fonte (Efeitos, Tudo, um sprite
// ou uma categoria do acervo), à direita a grade com busca.
//   FF.Estudio.escolherSprite({ titulo, atual: {sprite, anim}, inicio: 'efeitos'|'todos'|'cat:<categoria>'|<id do sprite>,
//                               aoEscolher(anim, spriteId), limpar?() })
// Os sprites do acervo só são baixados quando o cartão aparece na tela (a lista de animações vem do índice).
window.FF = window.FF || {};

(function () {
  const E = FF.Estudio;
  const UTIL = ['hud_zl3', 'retratos', 'cenarios_preview', 'stage_campo', 'hud_moderno'];   // fim da lista do jogo
  const ORDEM_CAT = ['personagens', 'efeitos', 'cenarios', 'interface', 'cutscenes'];
  const ICONE_CAT = { personagens: '🥋', efeitos: '✺', cenarios: '🏞', interface: '🖥', cutscenes: '🎞' };
  const TIPOS = ['personagens', 'efeitos', 'cenarios', 'interface', 'cutscenes'];
  const NOME_TIPO = { personagens: 'Personagens', efeitos: 'Efeitos', cenarios: 'Cenários', interface: 'Interface e outros', cutscenes: 'Cutscenes' };   // outras categorias (um jogo inteiro) usam 🎮

  // nome amigável: personagem que usa o sprite (ex.: "Goku · gokubase") ou o nome do acervo
  function nomes() {
    const m = { fx: 'Efeitos do jogo', fx_extra: 'Efeitos extras' };
    for (const pid of FF.Assets.listaPersonagens()) {
      const d = FF.Assets.json['data/characters/' + pid + '.json'] || (window.FF_BUNDLE || {})['data/characters/' + pid + '.json'] || ((FF.Edicoes.dados().personagens || {})[pid] || {}).def;
      if (!d || !d.formas) continue;
      Object.values(d.formas).forEach(f => { if (f.sprite && !m[f.sprite]) m[f.sprite] = (f.nome || d.nome || pid); });
    }
    for (const id of Object.keys(FF.Assets.acervo())) m[id] = FF.Assets.nomeSprite(id);
    return m;
  }

  E.escolherSprite = function (o) {
    const todos = FF.Assets.listaSprites();
    const jogo = todos.filter(id => !FF.Assets.doAcervo(id)).sort((a, b) => {
      const pa = a === 'fx' ? 0 : a === 'fx_extra' ? 1 : UTIL.includes(a) ? 3 : 2;
      const pb = b === 'fx' ? 0 : b === 'fx_extra' ? 1 : UTIL.includes(b) ? 3 : 2;
      return pa - pb || a.localeCompare(b);
    });
    const acervo = Object.keys(FF.Assets.acervo()).filter(id => !FF.Assets.spriteOculto(id));   // já vem em ordem de categoria/nome; sem os excluídos
    const porCat = {};
    acervo.forEach(id => { (porCat[FF.Assets.categoriaSprite(id)] = porCat[FF.Assets.categoriaSprite(id)] || []).push(id); });
    const cats = ORDEM_CAT.filter(c => porCat[c]).concat(Object.keys(porCat).filter(c => !ORDEM_CAT.includes(c)));
    const NOME_CAT = FF.Assets.categoriasAcervo();
    const ids = jogo.concat(acervo);
    const NM = nomes();

    let fonte = o.inicio || (o.atual && o.atual.sprite) || E.rascunho.ler('seletor_fonte') || 'efeitos';
    if (fonte !== 'efeitos' && fonte !== 'todos' && !/^(cat|fav)(:|$)/.test(fonte) && fonte !== 'lixeira' && !ids.includes(fonte)) fonte = 'efeitos';

    const c = E.el('div', 'es-seletor');
    const lado = E.el('div', 'es-seletor-fontes');
    const dir = E.el('div', 'es-seletor-dir');
    const topo = E.el('div', 'es-barra');
    const busca = document.createElement('input');
    busca.type = 'search'; busca.placeholder = 'Filtrar (ex.: explos, kame, Bills, hit, aura, namek)';
    const info = E.el('span', 'es-dica');
    topo.append(busca, info);
    if (o.limpar) topo.appendChild(E.botao('Nenhum', () => { o.limpar(); m.fechar(); }));
    const grade = E.el('div', 'es-grade');
    dir.append(topo, grade);
    c.append(lado, dir);
    const m = E.modal(o.titulo || '🖼 Escolher sprite', c, { larga: true });

    // ---- miniaturas preguiçosas: só desenha (e baixa o sprite) quando aparece na tela
    const pendentes = new Map();
    const desenharQuando = (el, id, fazer) => { pendentes.set(el, { id, fazer }); obs.observe(el); };
    const obs = new IntersectionObserver((ents) => {
      ents.forEach(en => {
        if (!en.isIntersecting) return;
        const p = pendentes.get(en.target);
        obs.unobserve(en.target); pendentes.delete(en.target);
        if (!p) return;
        FF.Assets.loadSprite(p.id).then(s => { if (s) p.fazer(s); }).catch(() => {});
      });
    }, { rootMargin: '150px' });
    const fecharOrig = m.fechar;
    m.fechar = function () { obs.disconnect(); return fecharOrig.apply(this, arguments); };

    const carregar = async (lista) => { for (const id of lista) await FF.Assets.loadSprite(id).catch(() => null); };
    const itensJogo = (id) => { const s = FF.Assets.sprites[id]; return s ? Object.keys(s.def.anims).filter(a => !a.includes('#')).map(a => ({ id, a, s, n: s.anim(a).frames.length })) : []; };
    const itensAcervo = (id, idx) => {
      const s = FF.Assets.sprites[id];
      if (s) return itensJogo(id);
      const apag = (FF.Mods && FF.Mods.ler()[id]) || {};
      return Object.entries(idx[id] || {}).filter(([a]) => !(apag[a] && apag[a].apagada)).map(([a, n]) => ({ id, a, s: null, n }));
    };

    // ---- coluna da esquerda
    const marcar = () => lado.querySelectorAll('.es-seletor-fonte').forEach(x => x.classList.toggle('sel', x.dataset.fonte === fonte));
    const bt = (chave, texto, sub, pai) => {
      const b = E.el('div', 'es-item es-seletor-fonte' + (chave === fonte ? ' sel' : ''));
      b.dataset.fonte = chave;
      const cv = document.createElement('canvas'); cv.width = 30; cv.height = 30;
      const t = E.el('span'); t.textContent = texto;
      b.append(cv, t);
      if (sub) { const s = E.el('small'); s.textContent = sub; b.appendChild(s); }
      if (FF.Favoritos && ids.includes(chave)) {
        const ac = E.el('span', 'es-seletor-acoes');
        ac.appendChild(E.botao('✏', (e) => {   // renomear o sprite (nome que aparece nas listas)
          e.stopPropagation();
          const inp = document.createElement('input'); inp.value = FF.Assets.nomeSprite(chave); inp.className = 'es-som-renomear';
          t.replaceWith(inp); inp.focus(); inp.select();
          inp.onclick = (ev) => ev.stopPropagation();
          const fim = (ok) => { if (ok) E.mudarInfoSprite(chave, { nome: inp.value.trim() && inp.value.trim() !== (FF.Assets.acervo()[chave] || [])[1] ? inp.value.trim() : null }); t.textContent = inp.value.trim() || texto; inp.replaceWith(t); };
          inp.onkeydown = (ev) => { if (ev.key === 'Enter') fim(true); if (ev.key === 'Escape') fim(false); };
          inp.onblur = () => fim(true);
        }, 'Renomear este sprite'));
        if (FF.Assets.doAcervo(chave)) ac.appendChild(E.botao('🗑', (e) => { e.stopPropagation(); E.mudarInfoSprite(chave, { oculto: true }); b.remove(); E.aviso('🗑 Sprite excluído das listas (Lixeira, no fim da coluna, para restaurar).'); }, 'Excluir este sprite das listas (vai para a Lixeira)', 'es-bt-perigo'));
        ac.appendChild(FF.Favoritos.botao(chave, null, () => { contarFav(); render(); }));   // ☆ sprite inteiro
        b.appendChild(ac);
      }
      b.onclick = () => { fonte = chave; E.rascunho.gravar('seletor_fonte', chave); marcar(); render(); };
      (pai || lado).appendChild(b);
      return cv;
    };
    const mini = (cv, id) => desenharQuando(cv, id, (s) => E.miniatura(cv, s, Object.keys(s.def.anims)[0], 0));

    lado.appendChild(E.el('div', 'es-sub', 'Mostrar'));
    bt('efeitos', '✺ Efeitos (todos)', null);
    // ⭐ favoritos do usuário, separados pelo tipo que ele escolheu
    const favBox = E.el('div');
    const contarFav = () => {
      if (!FF.Favoritos) return;
      favBox.innerHTML = '';
      const l = FF.Favoritos.lista();
      favBox.appendChild(E.el('div', 'es-sub', '⭐ Meus favoritos (' + l.length + ')'));
      if (!l.length) { favBox.appendChild(E.el('p', 'es-dica', 'Clique na ☆ de um cartão (animação) ou de um sprite na lista para favoritar e dizer o que ele é.')); return; }
      FF.Favoritos.TIPOS.forEach(([t, ic, nm]) => {
        const n = l.filter(x => x.tipo === t).length;
        if (n) bt('fav:' + t, ic + ' ' + FF.Favoritos.plural[t], String(n), favBox);
      });
      marcar();
    };
    bt('todos', '★ Tudo', null);
    lado.appendChild(favBox); contarFav();
    { const b = E.el('div', 'es-item es-seletor-fonte' + (fonte === 'lixeira' ? ' sel' : '')); b.dataset.fonte = 'lixeira'; b.appendChild(E.el('span', null, '🗑 Lixeira (excluídos)')); b.onclick = () => { fonte = 'lixeira'; marcar(); render(); }; lado.appendChild(b); }
    lado.appendChild(E.el('div', 'es-sub', 'Do jogo (' + jogo.length + ')'));
    jogo.forEach(id => mini(bt(id, NM[id] ? NM[id] + ' · ' + id : id, null), id));

    if (acervo.length) {
      lado.appendChild(E.el('div', 'es-sub', 'Acervo (' + acervo.length + ')'));
      const abertas = new Set(E.rascunho.ler('seletor_cats_abertas') || []);
      const catDaFonte = /^cat:/.test(fonte) ? fonte.slice(4).split(':')[0] : (FF.Assets.doAcervo(fonte) ? FF.Assets.categoriaSprite(fonte) : null);
      if (catDaFonte) abertas.add(catDaFonte);
      if (/^cat:.+:/.test(fonte)) abertas.add(fonte.slice(4));
      else if (FF.Assets.doAcervo(fonte)) abertas.add(catDaFonte + ':' + FF.Assets.tipoSprite(fonte));
      cats.forEach(cat => {
        const cab = E.el('div', 'es-seletor-cat');
        const corpo = E.el('div', 'es-seletor-cat-corpo');
        const titulo = () => (abertas.has(cat) ? '▾ ' : '▸ ') + (ICONE_CAT[cat] || '🎮') + ' ' + (NOME_CAT[cat] || cat) + ' (' + porCat[cat].length + ')';
        cab.textContent = titulo();
        let montado = false;
        const montar = () => {
          if (montado) return; montado = true;
          bt('cat:' + cat, '☰ Todas de ' + (NOME_CAT[cat] || cat).toLowerCase(), null, corpo);
          const item = (id, onde) => mini(bt(id, NM[id] || id, String((FF.Assets.acervo()[id] || [])[2] || ''), onde), id);
          // jogo inteiro (ex.: Drag Warriors): subgrupos por tipo, cada um abre/fecha e tem o seu "Todos"
          const tipos = TIPOS.filter(t => porCat[cat].some(id => FF.Assets.tipoSprite(id) === t));
          if (tipos.length < 2) { porCat[cat].forEach(id => item(id, corpo)); return; }
          tipos.forEach(t => {
            const chave = cat + ':' + t, ids = porCat[cat].filter(id => FF.Assets.tipoSprite(id) === t);
            const sc = E.el('div', 'es-seletor-cat es-seletor-subcat'), sb = E.el('div', 'es-seletor-cat-corpo');
            const tt = () => (abertas.has(chave) ? '▾ ' : '▸ ') + ICONE_CAT[t] + ' ' + NOME_TIPO[t] + ' (' + ids.length + ')';
            let feito = false;
            const ap = () => {
              sb.style.display = abertas.has(chave) ? '' : 'none'; sc.textContent = tt();
              if (abertas.has(chave) && !feito) { feito = true; bt('cat:' + chave, '☰ Todos: ' + NOME_TIPO[t].toLowerCase(), null, sb); ids.forEach(id => item(id, sb)); }
            };
            sc.onclick = () => { abertas.has(chave) ? abertas.delete(chave) : abertas.add(chave); E.rascunho.gravar('seletor_cats_abertas', [...abertas]); ap(); };
            corpo.append(sc, sb); ap();
          });
        };
        const aplicar = () => { corpo.style.display = abertas.has(cat) ? '' : 'none'; cab.textContent = titulo(); if (abertas.has(cat)) montar(); };
        cab.onclick = () => { abertas.has(cat) ? abertas.delete(cat) : abertas.add(cat); E.rascunho.gravar('seletor_cats_abertas', [...abertas]); aplicar(); };
        lado.append(cab, corpo);
        aplicar();
      });
    }

    // ---- grade
    let geracao = 0;
    const render = async () => {
      const g = ++geracao;
      const f = busca.value.trim().toLowerCase();
      let lista, favs = null;
      if (/^fav(:|$)/.test(fonte) && !f) {   // favoritos: sprites inteiros + animações marcadas
        favs = FF.Favoritos.lista(fonte.slice(4) || null).filter(x => ids.includes(x.sprite));
        lista = [...new Set(favs.map(x => x.sprite))];
      } else if (fonte === 'todos' || f) lista = ids;                       // buscar procura em tudo
      else if (fonte === 'efeitos') {
        lista = jogo.concat(acervo.filter(id => FF.Assets.tipoSprite(id) === 'efeitos'));
        // + animações do acervo que o usuário favoritou como efeito (de sprites de outro tipo)
        if (FF.Favoritos) FF.Favoritos.lista('efeitos').concat(FF.Favoritos.lista('explosoes')).forEach(v => { if (v.anim && FF.Assets.doAcervo(v.sprite) && !lista.includes(v.sprite)) lista.push(v.sprite); });
      }
      else if (/^cat:/.test(fonte)) { const [cc, tp] = fonte.slice(4).split(':'); lista = (porCat[cc] || []).filter(id => !tp || FF.Assets.tipoSprite(id) === tp); }
      else lista = [fonte];
      if (fonte === 'lixeira') return renderLixeira();
      grade.innerHTML = '<p class="es-vazio">Carregando…</p>';
      const doJogo = lista.filter(id => !FF.Assets.doAcervo(id));
      const doAcervo = lista.filter(id => FF.Assets.doAcervo(id));
      if (doAcervo.length === 1) await FF.Assets.loadSprite(doAcervo[0]).catch(() => null);   // um sprite só: abre de vez
      const [, idx] = await Promise.all([carregar(doJogo), doAcervo.length ? FF.Assets.animsAcervo() : {}]);
      if (g !== geracao) return;
      let itens = [];
      doJogo.forEach(id => { itens = itens.concat(itensJogo(id)); });
      if (fonte === 'efeitos' && !f) itens = itens.filter(x => ehEfeito(x));
      doAcervo.forEach(id => { itens = itens.concat(itensAcervo(id, idx)); });
      if (favs) itens = itens.filter(x => favs.some(v => v.sprite === x.id && (!v.anim || v.anim === x.a)));
      if (fonte === 'efeitos' && !f && FF.Favoritos) itens = itens.filter(x => !FF.Assets.doAcervo(x.id) || FF.Assets.tipoSprite(x.id) === 'efeitos' ? ['efeitos', 'explosoes'].includes(FF.Favoritos.de(x.id, x.a) || 'efeitos') : ['efeitos', 'explosoes'].includes(FF.Favoritos.de(x.id, x.a)));
      if (f) itens = itens.filter(x => (x.a + ' ' + x.id + ' ' + (NM[x.id] || '')).toLowerCase().includes(f));
      grade.innerHTML = '';
      pendentes.forEach((_, el) => obs.unobserve(el)); pendentes.clear();
      info.textContent = itens.length + ' animação(ões)' + (itens.length > 400 ? ' · mostrando 400, use o filtro' : '');
      itens.slice(0, 400).forEach(x => {
        const sel = o.atual && x.a === o.atual.anim && (!o.atual.sprite || o.atual.sprite === x.id);
        const k = E.el('div', 'es-cartao' + (sel ? ' sel' : ''));
        const cv = document.createElement('canvas'); cv.width = 96; cv.height = 72;
        const sp = E.el('span'); sp.textContent = x.a;
        const sb = E.el('small', 'es-cartao-fonte'); sb.textContent = NM[x.id] || x.id;
        k.title = x.id + ' · ' + x.a + ' (' + x.n + ' quadros)';
        k.append(cv, sp, sb);
        if (FF.Favoritos) k.appendChild(FF.Favoritos.botao(x.id, x.a, () => { contarFav(); if (favs) render(); }));
        if (FF.Mods) { const del = E.botao('🗑', (e) => { e.stopPropagation(); e.preventDefault(); FF.Mods.apagar(x.id, x.a); k.remove(); E.aviso('🗑 Animação "' + x.a + '" excluída (Lixeira, no fim da coluna, para restaurar).'); }, 'Excluir esta animação (vai para a Lixeira)', 'es-fav-bt es-cartao-del'); del.addEventListener('pointerdown', (e) => e.stopPropagation()); k.appendChild(del); }
        const desenhar = (s) => {
          if (!s.has(x.a)) return;
          E.miniatura(cv, s, x.a, Math.floor(s.anim(x.a).frames.length / 2));
          if (FF.EstudioProps && FF.EstudioProps.animarNoMouse) FF.EstudioProps.animarNoMouse(k, cv, s, x.a);
        };
        if (x.s) desenhar(x.s); else desenharQuando(k, x.id, desenhar);
        k.onclick = async () => {
          if (!x.s) await FF.Assets.loadSprite(x.id).catch(() => null);   // quem escolhe já recebe o sprite pronto
          o.aoEscolher(x.a, x.id); m.fechar();
        };
        grade.appendChild(k);
      });
      if (!itens.length) grade.innerHTML = '<p class="es-vazio">Nada encontrado.</p>';
      if (sel0) { const s = grade.querySelector('.es-cartao.sel'); if (s) s.scrollIntoView({ block: 'center' }); sel0 = false; }
    };
    let sel0 = true;
    // 🗑 Lixeira: sprites e animações excluídos, com "Restaurar"
    function renderLixeira() {
      grade.innerHTML = '';
      const spr = FF.Assets.listaSprites(true).filter(id => FF.Assets.spriteOculto(id));
      const anims = [];
      Object.entries((FF.Mods && FF.Mods.ler()) || {}).forEach(([id, m]) => Object.entries(m || {}).forEach(([a, v]) => { if (v && v.apagada) anims.push({ id, a }); }));
      info.textContent = spr.length + ' sprite(s) e ' + anims.length + ' animação(ões) excluídos';
      const cartao = (txt, sub, id, anim, restaurar) => {
        const k = E.el('div', 'es-cartao');
        const cv = document.createElement('canvas'); cv.width = 96; cv.height = 72;
        const sp = E.el('span'); sp.textContent = txt;
        const sb = E.el('small', 'es-cartao-fonte'); sb.textContent = sub;
        k.append(cv, sp, sb, E.botao('↺ Restaurar', (e) => { e.stopPropagation(); restaurar(); renderLixeira(); }, 'Voltar para as listas'));
        desenharQuando(k, id, (s) => { const a = anim && s.def._orig && s.def._orig[anim] ? null : (anim && s.has(anim) ? anim : Object.keys(s.def.anims)[0]); if (a) E.miniatura(cv, s, a, 0); });
        grade.appendChild(k);
      };
      spr.forEach(id => cartao(FF.Assets.nomeSprite(id), 'sprite inteiro · ' + id, id, null, () => E.mudarInfoSprite(id, { oculto: null })));
      anims.forEach(x => cartao(x.a, FF.Assets.nomeSprite(x.id), x.id, x.a, () => FF.Mods.restaurar(x.id, x.a)));
      if (!spr.length && !anims.length) grade.innerHTML = '<p class="es-vazio">A Lixeira está vazia.</p>';
    }
    // efeito = tudo do fx/fx_extra, sprites importados marcados como efeito e animações "soltas" de lutadores
    // (as que não são poses do personagem, ex.: Bills_Esfera). Do acervo, entra a categoria Efeitos inteira.
    const POSES = /^(Special|Ultimate|UltimateAttack|Attack|Dano|SendoLancado|Caido|Parado|Movimento|Pulando|Agachado|CarregandoKi|Sparking|Defesa|Teletransporte|Dash|Dragon_Rush|Troca_De|Change|Vitoria|Pose_De|Intro|Destransformation|Transformation)/;
    function ehEfeito(x) {
      const fv = FF.Favoritos && (FF.Favoritos.de(x.id, x.a) || FF.Favoritos.de(x.id));   // o que o usuário disse vale mais
      if (fv) return fv === 'efeitos' || fv === 'explosoes';
      if (x.id === 'fx' || x.id === 'fx_extra') return true;
      if (UTIL.includes(x.id)) return false;
      if (x.s.def.tipo === 'efeito') return true;
      return !POSES.test(x.a) && /_/.test(x.a) && !/^(parado|dano|guarda|lancado|caido|avancar|recuar|teleporte)/i.test(x.a);
    }
    busca.oninput = () => render();
    render();
    setTimeout(() => busca.focus(), 30);
    return m;
  };
})();
