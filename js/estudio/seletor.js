// Estúdio — seletor de sprites: TODAS as animações de TODOS os sprites do jogo (efeitos, lutadores, importados),
// para qualquer personagem. À esquerda escolhe a fonte (Efeitos, Todos, ou um sprite), à direita a grade com busca.
//   FF.Estudio.escolherSprite({ titulo, atual: {sprite, anim}, inicio: 'efeitos'|'todos'|<id do sprite>,
//                               aoEscolher(anim, spriteId), limpar?() })
window.FF = window.FF || {};

(function () {
  const E = FF.Estudio;
  const UTIL = ['hud_zl3', 'retratos', 'cenarios_preview', 'stage_campo', 'hud_moderno'];   // fim da lista

  // nome amigável: personagem que usa o sprite (ex.: "Goku · gokubase")
  function nomes() {
    const m = { fx: 'Efeitos do jogo', fx_extra: 'Efeitos extras' };
    for (const pid of FF.Assets.listaPersonagens()) {
      const d = FF.Assets.json['data/characters/' + pid + '.json'] || (window.FF_BUNDLE || {})['data/characters/' + pid + '.json'] || ((FF.Edicoes.dados().personagens || {})[pid] || {}).def;
      if (!d || !d.formas) continue;
      Object.values(d.formas).forEach(f => { if (f.sprite && !m[f.sprite]) m[f.sprite] = (f.nome || d.nome || pid); });
    }
    return m;
  }

  E.escolherSprite = function (o) {
    const ids = FF.Assets.listaSprites().slice().sort((a, b) => {
      const pa = a === 'fx' ? 0 : a === 'fx_extra' ? 1 : UTIL.includes(a) ? 3 : 2;
      const pb = b === 'fx' ? 0 : b === 'fx_extra' ? 1 : UTIL.includes(b) ? 3 : 2;
      return pa - pb || a.localeCompare(b);
    });
    const NM = nomes();
    let fonte = o.inicio || (o.atual && o.atual.sprite) || E.rascunho.ler('seletor_fonte') || 'efeitos';
    if (fonte !== 'efeitos' && fonte !== 'todos' && !ids.includes(fonte)) fonte = 'efeitos';

    const c = E.el('div', 'es-seletor');
    const lado = E.el('div', 'es-seletor-fontes');
    const dir = E.el('div', 'es-seletor-dir');
    const topo = E.el('div', 'es-barra');
    const busca = document.createElement('input');
    busca.type = 'search'; busca.placeholder = 'Filtrar (ex.: explos, kame, Bills, hit, aura)';
    const info = E.el('span', 'es-dica');
    topo.append(busca, info);
    if (o.limpar) topo.appendChild(E.botao('Nenhum', () => { o.limpar(); m.fechar(); }));
    const grade = E.el('div', 'es-grade');
    dir.append(topo, grade);
    c.append(lado, dir);
    const m = E.modal(o.titulo || '🖼 Escolher sprite', c, { larga: true });

    const carregar = async (lista) => { for (const id of lista) await FF.Assets.loadSprite(id).catch(() => null); };
    const itensDe = (id) => { const s = FF.Assets.sprites[id]; return s ? Object.keys(s.def.anims).filter(a => !a.includes('#')).map(a => ({ id, a, s })) : []; };

    const bt = (chave, texto, sub) => {
      const b = E.el('div', 'es-item es-seletor-fonte' + (chave === fonte ? ' sel' : ''));
      b.dataset.fonte = chave;
      const cv = document.createElement('canvas'); cv.width = 30; cv.height = 30;
      const t = E.el('span'); t.textContent = texto;
      b.append(cv, t);
      if (sub) { const s = E.el('small'); s.textContent = sub; b.appendChild(s); }
      b.onclick = () => { fonte = chave; E.rascunho.gravar('seletor_fonte', chave); lado.querySelectorAll('.es-seletor-fonte').forEach(x => x.classList.toggle('sel', x.dataset.fonte === chave)); render(); };
      lado.appendChild(b);
      return cv;
    };
    lado.appendChild(E.el('div', 'es-sub', 'Mostrar'));
    bt('efeitos', '✺ Efeitos (todos)', null);
    bt('todos', '★ Tudo', null);
    lado.appendChild(E.el('div', 'es-sub', 'Sprites (' + ids.length + ')'));
    const minis = {};
    ids.forEach(id => { minis[id] = bt(id, NM[id] ? NM[id] + ' · ' + id : id, null); });

    let geracao = 0;
    const render = async () => {
      const g = ++geracao;
      const f = busca.value.trim().toLowerCase();
      let lista;
      if (fonte === 'todos' || f) lista = ids;                       // buscar procura em tudo
      else if (fonte === 'efeitos') lista = ids;
      else lista = [fonte];
      grade.innerHTML = '<p class="es-vazio">Carregando…</p>';
      await carregar(lista);
      if (g !== geracao) return;
      let itens = [];
      lista.forEach(id => { itens = itens.concat(itensDe(id)); });
      if (fonte === 'efeitos' && !f) itens = itens.filter(x => ehEfeito(x));
      if (f) itens = itens.filter(x => (x.a + ' ' + x.id + ' ' + (NM[x.id] || '')).toLowerCase().includes(f));
      grade.innerHTML = '';
      info.textContent = itens.length + ' animação(ões)' + (itens.length > 400 ? ' · mostrando 400, use o filtro' : '');
      itens.slice(0, 400).forEach(x => {
        const sel = o.atual && x.a === o.atual.anim && (!o.atual.sprite || o.atual.sprite === x.id);
        const k = E.el('div', 'es-cartao' + (sel ? ' sel' : ''));
        const cv = document.createElement('canvas'); cv.width = 96; cv.height = 72;
        const sp = E.el('span'); sp.textContent = x.a;
        const sb = E.el('small', 'es-cartao-fonte'); sb.textContent = NM[x.id] || x.id;
        k.title = x.id + ' · ' + x.a + ' (' + x.s.anim(x.a).frames.length + ' quadros)';
        k.append(cv, sp, sb);
        E.miniatura(cv, x.s, x.a, Math.floor(x.s.anim(x.a).frames.length / 2));
        if (FF.EstudioProps && FF.EstudioProps.animarNoMouse) FF.EstudioProps.animarNoMouse(k, cv, x.s, x.a);
        k.onclick = () => { o.aoEscolher(x.a, x.id); m.fechar(); };
        grade.appendChild(k);
      });
      if (!itens.length) grade.innerHTML = '<p class="es-vazio">Nada encontrado.</p>';
      if (sel0) { const s = grade.querySelector('.es-cartao.sel'); if (s) s.scrollIntoView({ block: 'center' }); sel0 = false; }
    };
    let sel0 = true;
    // efeito = tudo do fx/fx_extra, sprites importados marcados como efeito e animações "soltas" de lutadores
    // (as que não são poses do personagem, ex.: Bills_Esfera)
    const POSES = /^(Special|Ultimate|UltimateAttack|Attack|Dano|SendoLancado|Caido|Parado|Movimento|Pulando|Agachado|CarregandoKi|Sparking|Defesa|Teletransporte|Dash|Dragon_Rush|Troca_De|Change|Vitoria|Pose_De|Intro|Destransformation|Transformation)/;
    function ehEfeito(x) {
      if (x.id === 'fx' || x.id === 'fx_extra') return true;
      if (UTIL.includes(x.id)) return false;
      if (x.s.def.tipo === 'efeito') return true;
      return !POSES.test(x.a) && /_/.test(x.a) && !/^(parado|dano|guarda|lancado|caido|avancar|recuar|teleporte)/i.test(x.a);
    }
    busca.oninput = () => render();
    render();
    // miniaturas das fontes (sem travar a abertura)
    (async () => { for (const id of ids) { await FF.Assets.loadSprite(id).catch(() => null); const s = FF.Assets.sprites[id]; if (s && minis[id]) { const a = Object.keys(s.def.anims)[0]; E.miniatura(minis[id], s, a, 0); } } })();
    setTimeout(() => busca.focus(), 30);
    return m;
  };
})();
