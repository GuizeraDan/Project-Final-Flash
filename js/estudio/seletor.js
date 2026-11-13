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
    const acervo = Object.keys(FF.Assets.acervo());                      // já vem em ordem de categoria/nome
    const porCat = {};
    acervo.forEach(id => { (porCat[FF.Assets.categoriaSprite(id)] = porCat[FF.Assets.categoriaSprite(id)] || []).push(id); });
    const cats = ORDEM_CAT.filter(c => porCat[c]).concat(Object.keys(porCat).filter(c => !ORDEM_CAT.includes(c)));
    const NOME_CAT = FF.Assets.categoriasAcervo();
    const ids = jogo.concat(acervo);
    const NM = nomes();

    let fonte = o.inicio || (o.atual && o.atual.sprite) || E.rascunho.ler('seletor_fonte') || 'efeitos';
    if (fonte !== 'efeitos' && fonte !== 'todos' && !/^cat:/.test(fonte) && !ids.includes(fonte)) fonte = 'efeitos';

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
      return Object.entries(idx[id] || {}).map(([a, n]) => ({ id, a, s: null, n }));
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
      b.onclick = () => { fonte = chave; E.rascunho.gravar('seletor_fonte', chave); marcar(); render(); };
      (pai || lado).appendChild(b);
      return cv;
    };
    const mini = (cv, id) => desenharQuando(cv, id, (s) => E.miniatura(cv, s, Object.keys(s.def.anims)[0], 0));

    lado.appendChild(E.el('div', 'es-sub', 'Mostrar'));
    bt('efeitos', '✺ Efeitos (todos)', null);
    bt('todos', '★ Tudo', null);
    lado.appendChild(E.el('div', 'es-sub', 'Do jogo (' + jogo.length + ')'));
    jogo.forEach(id => mini(bt(id, NM[id] ? NM[id] + ' · ' + id : id, null), id));

    if (acervo.length) {
      lado.appendChild(E.el('div', 'es-sub', 'Acervo Z Legends 3 (' + acervo.length + ')'));
      const abertas = new Set(E.rascunho.ler('seletor_cats_abertas') || []);
      const catDaFonte = /^cat:/.test(fonte) ? fonte.slice(4) : (FF.Assets.doAcervo(fonte) ? FF.Assets.categoriaSprite(fonte) : null);
      if (catDaFonte) abertas.add(catDaFonte);
      cats.forEach(cat => {
        const cab = E.el('div', 'es-seletor-cat');
        const corpo = E.el('div', 'es-seletor-cat-corpo');
        const titulo = () => (abertas.has(cat) ? '▾ ' : '▸ ') + (ICONE_CAT[cat] || '📦') + ' ' + (NOME_CAT[cat] || cat) + ' (' + porCat[cat].length + ')';
        cab.textContent = titulo();
        let montado = false;
        const montar = () => {
          if (montado) return; montado = true;
          bt('cat:' + cat, '☰ Todas de ' + (NOME_CAT[cat] || cat).toLowerCase(), null, corpo);
          porCat[cat].forEach(id => mini(bt(id, NM[id] || id, String((FF.Assets.acervo()[id] || [])[2] || ''), corpo), id));
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
      let lista;
      if (fonte === 'todos' || f) lista = ids;                       // buscar procura em tudo
      else if (fonte === 'efeitos') lista = jogo.concat(porCat.efeitos || []);
      else if (/^cat:/.test(fonte)) lista = porCat[fonte.slice(4)] || [];
      else lista = [fonte];
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
    // efeito = tudo do fx/fx_extra, sprites importados marcados como efeito e animações "soltas" de lutadores
    // (as que não são poses do personagem, ex.: Bills_Esfera). Do acervo, entra a categoria Efeitos inteira.
    const POSES = /^(Special|Ultimate|UltimateAttack|Attack|Dano|SendoLancado|Caido|Parado|Movimento|Pulando|Agachado|CarregandoKi|Sparking|Defesa|Teletransporte|Dash|Dragon_Rush|Troca_De|Change|Vitoria|Pose_De|Intro|Destransformation|Transformation)/;
    function ehEfeito(x) {
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
