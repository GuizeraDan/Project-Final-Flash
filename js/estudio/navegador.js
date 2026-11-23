// Estúdio — NAVEGADOR DE SPRITES: a coluna da esquerda usada no seletor de sprites (janela "Escolher efeito") e na
// aba Sprites. Mesma árvore, mesmos grupos, mesmas ações e os mesmos ajustes nos dois lugares; muda só o que um
// clique faz (no seletor escolhe a fonte da grade; na aba Sprites abre o sprite / a animação para editar).
//
//   const nav = FF.EstudioNav.criar(caixa, {
//     modo: 'seletor' | 'sprites',
//     fonte: () => chave atual ('efeitos'|'todos'|'fav'|'fav:<tipo>'|'pasta:<nome>'|'lixeira'|'jogo'|'cat:<c>'|'cat:<c>:<tipo>'|<id do sprite>),
//     animAtual: () => nome da animação aberta (aba Sprites, para marcar a linha 🎞 certa),
//     escolher: (chave, anim) => ...   (anim só nas linhas 🎞 de animação dentro de pastas/favoritos)
//     busca: () => texto (filtra sprites pelo nome do sprite ou de qualquer animação; abre os grupos),
//     decorar: (id, linha) => ...      (aba Sprites: 📥 importado, ✎ alterados…)
//     aoMudar: () => ...                (o host redesenha o resto: grade do seletor, lista de animações)
//   });
//   nav.render(); nav.destruir();
//
// Estado guardado no aparelho e compartilhado pelos dois lugares: grupos abertos (`nav_abertos`), ordem (`nav_ordem`).
// As pastas, favoritos, Lixeira e nomes vêm de FF.Favoritos / spritesInfo (edições) — mudou em um lugar, os dois
// navegadores se redesenham (E.aoMudarEdicoes).
window.FF = window.FF || {};

(function () {
  const E = FF.Estudio;
  const UTIL = ['hud_zl3', 'retratos', 'cenarios_preview', 'stage_campo', 'hud_moderno'];
  const ORDEM_CAT = ['personagens', 'efeitos', 'cenarios', 'interface', 'cutscenes'];
  const ICONE = { personagens: '🥋', efeitos: '✺', cenarios: '🏞', interface: '🖥', cutscenes: '🎞' };
  const TIPOS = ['personagens', 'efeitos', 'cenarios', 'interface', 'cutscenes'];
  const NOME_TIPO = { personagens: 'Personagens', efeitos: 'Efeitos', cenarios: 'Cenários', interface: 'Interface e outros', cutscenes: 'Cutscenes' };

  // nome amigável dos sprites do jogo (personagem que usa) e do acervo
  function nomes() {
    const m = { fx: 'Efeitos do jogo', fx_extra: 'Efeitos extras' };
    for (const pid of FF.Assets.listaPersonagens()) {
      const d = FF.Assets.json['data/characters/' + pid + '.json'] || (window.FF_BUNDLE || {})['data/characters/' + pid + '.json'] || ((FF.Edicoes.dados().personagens || {})[pid] || {}).def;
      if (!d || !d.formas) continue;
      Object.values(d.formas).forEach(f => { if (f.sprite && !m[f.sprite]) m[f.sprite] = (f.nome || d.nome || pid); });
    }
    return m;
  }

  function criar(caixa, o) {
    const seletor = o.modo === 'seletor';
    const F = FF.Favoritos;
    const raiz = E.el('div', 'es-nav' + (seletor ? ' es-nav-seletor' : ' es-nav-sprites'));
    caixa.appendChild(raiz);
    const abertos = new Set(E.rascunho.ler('nav_abertos') || ['jogo', 'pastas', 'fav']);
    const gravarAbertos = () => E.rascunho.gravar('nav_abertos', [...abertos]);
    const marcados = new Set();
    let ultimo = null, NM = null;

    // ---- miniaturas preguiçosas (só baixa o sprite quando a linha aparece)
    const pend = new Map();
    const obs = new IntersectionObserver((ents) => ents.forEach(en => {
      if (!en.isIntersecting) return;
      const p = pend.get(en.target); if (!p) return;
      pend.delete(en.target); obs.unobserve(en.target);
      FF.Assets.loadSprite(p.id).then(s => { if (s) E.miniatura(en.target, s, Object.keys(s.def.anims)[0], 0); }).catch(() => {});
    }), { root: caixa, rootMargin: '120px' });
    const mini = (id) => {
      const cv = document.createElement('canvas'); cv.width = 24; cv.height = 24; cv.className = 'es-nav-mini';
      const s = FF.Assets.sprites[id];
      if (s) requestAnimationFrame(() => E.miniatura(cv, s, Object.keys(s.def.anims)[0], 0));
      else { pend.set(cv, { id }); obs.observe(cv); }
      return cv;
    };

    // ---- barra dos sprites marcados (grudada no pé da coluna)
    const barra = E.el('div', 'es-nav-sel');
    const txt = E.el('span');
    const btMov = E.botao('📂 Mover', () => { if (marcados.size) F.menuMover(btMov, [...marcados], () => { marcados.clear(); depois(); }); }, 'Mover os sprites marcados para uma das suas pastas');
    const btFav = E.botao('⭐', () => { if (marcados.size) F.menuVarios(btFav, [...marcados].map(id => ({ sprite: id, anim: null })), () => depois()); }, 'Favoritar ou pôr numa pasta (sem tirar do lugar)');
    const btLixo = E.botao('🗑', async () => {
      const l = [...marcados].filter(id => FF.Assets.doAcervo(id) && !FF.Assets.spriteOculto(id));
      if (!l.length) { E.aviso('Só sprites do acervo vão para a Lixeira (os do jogo não).'); return; }
      if (!(await E.confirmar('🗑 Mandar para a Lixeira', 'Mandar os ' + l.length + ' sprites marcados para a Lixeira? Eles somem das listas e das pastas; dá para restaurar em "🗑 Lixeira".', '🗑 Mandar para a Lixeira', true))) return;
      l.forEach(id => E.mudarInfoSprite(id, { oculto: true }));
      E.aviso('🗑 ' + l.length + ' sprites mandados para a Lixeira.');
      marcados.clear(); depois();
    }, 'Mandar os sprites marcados para a Lixeira', 'es-bt-perigo');
    const btJuntar = E.botao('🎞 Juntar', () => {
      if (marcados.size < 2) { E.aviso('Marque pelo menos 2 sprites (um quadro cada) para juntar numa animação.'); return; }
      FF.EstudioJuntar.abrir([...marcados], { aoTerminar: (alvo, anim) => { marcados.clear(); depois(); o.escolher && o.escolher(alvo, anim); } });
    }, 'Juntar os sprites marcados numa animação só (ex.: efeito_00, efeito_01… viram os quadros de uma animação)', 'es-nav-juntar');
    barra.append(txt, btJuntar, btMov, btFav, btLixo, E.botao('✕', () => { marcados.clear(); pintarMarcas(); }, 'Desmarcar todos'));
    const pintarMarcas = () => {
      raiz.querySelectorAll('.es-nav-chk').forEach(ch => { ch.checked = marcados.has(ch.dataset.id); ch.closest('.es-item').classList.toggle('marcado', ch.checked); });
      txt.textContent = '☑ ' + marcados.size;
      barra.style.display = marcados.size ? '' : 'none';
      btJuntar.style.display = marcados.size >= 2 ? '' : 'none';
    };
    const marcar = (id, ev) => {
      const chs = [...raiz.querySelectorAll('.es-nav-chk')].map(c => c.dataset.id);
      if (ev && ev.shiftKey && ultimo && chs.includes(ultimo)) {
        const [a, z] = [chs.indexOf(ultimo), chs.indexOf(id)].sort((x, y) => x - y);
        chs.slice(a, z + 1).forEach(i => marcados.add(i));
      } else if (marcados.has(id)) marcados.delete(id); else marcados.add(id);
      ultimo = id; pintarMarcas();
    };

    const depois = () => { render(); o.aoMudar && o.aoMudar(); };

    // ---- peças
    const ehAtual = (chave) => (o.fonte && o.fonte()) === chave;
    // título de grupo que abre/fecha. clicável: no seletor, clicar no nome escolhe a fonte; a seta só abre/fecha
    function grupo(pai, chave, rotulo, n, nivel, cfg) {
      cfg = cfg || {};
      const aberto = cfg.forcarAberto || abertos.has(chave);
      const cab = E.el('div', 'es-nav-grupo es-seletor-cat ess-cat' + (cfg.fonte ? ' es-seletor-fonte' : '') + (cfg.fonte && ehAtual(cfg.fonte) ? ' sel' : '') + (nivel ? ' es-nav-sub' : ''));
      cab.style.paddingLeft = (4 + (nivel || 0) * 14) + 'px';
      cab.dataset.chave = chave;
      if (cfg.fonte) cab.dataset.fonte = cfg.fonte;
      const seta = E.el('span', 'es-nav-seta', cfg.semFilhos ? '' : (aberto ? '▾' : '▸'));
      const nome = E.el('span', 'es-nav-nome', rotulo);
      cab.append(seta, nome);
      if (n != null) cab.appendChild(E.el('small', 'es-nav-n', String(n)));
      const alternar = () => { if (abertos.has(chave)) abertos.delete(chave); else abertos.add(chave); gravarAbertos(); render(); };
      seta.onclick = (e) => { e.stopPropagation(); if (!cfg.semFilhos) alternar(); };
      cab.onclick = () => {
        if (seletor && cfg.fonte) { if (!aberto && !cfg.semFilhos) { abertos.add(chave); gravarAbertos(); } o.escolher(cfg.fonte); render(); }
        else if (!cfg.semFilhos) alternar();
      };
      pai.appendChild(cab);
      const corpo = E.el('div', 'es-nav-corpo');
      pai.appendChild(corpo);
      return { cab, corpo, aberto };
    }

    function linhaSprite(pai, id, nivel, cfg) {
      cfg = cfg || {};
      const ac = FF.Assets.doAcervo(id), naLix = !!cfg.naLixeira;
      const b = E.el('div', 'es-item es-seletor-fonte es-nav-spr' + (ehAtual(id) ? ' sel' : '') + (marcados.has(id) ? ' marcado' : '') + (naLix ? ' ess-na-lixeira' : ''));
      b.dataset.fonte = id; b.dataset.sprite = id;
      b.style.paddingLeft = (4 + (nivel || 0) * 14) + 'px';
      if (!naLix) {
        const ch = document.createElement('input'); ch.type = 'checkbox'; ch.className = 'es-nav-chk es-seletor-chk'; ch.dataset.id = id; ch.checked = marcados.has(id);
        ch.title = 'Marcar (Shift = intervalo) para mover, favoritar ou mandar para a Lixeira vários de uma vez';
        ch.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); marcar(id, e); setTimeout(pintarMarcas, 0); });
        b.appendChild(ch);
      }
      b.appendChild(mini(id));
      const nome = E.el('span', 'es-nav-nome ess-spr-nome');
      const nInfo = FF.Assets.infoSprite(id).nome;
      nome.textContent = ac || nInfo ? FF.Assets.nomeSprite(id) : (NM[id] && NM[id] !== id ? NM[id] + ' · ' + id : id);
      nome.title = id;
      b.appendChild(nome);
      o.decorar && o.decorar(id, b);
      const nAn = ac ? (FF.Assets.acervo()[id] || [])[2] : (FF.Assets.sprites[id] ? Object.keys(FF.Assets.sprites[id].def.anims).length : '');
      b.appendChild(E.el('small', 'es-nav-n', String(nAn || '')));
      const acoes = E.el('span', 'es-nav-acoes es-seletor-acoes');
      if (naLix) acoes.appendChild(E.botao('♻', (e) => { e.stopPropagation(); E.mudarInfoSprite(id, { oculto: null }); E.aviso('♻ "' + FF.Assets.nomeSprite(id) + '" restaurado.'); depois(); }, 'Tirar da Lixeira (volta para as listas)', 'es-fav-bt ess-lixo ess-restaurar'));
      else {
        acoes.appendChild(E.botao('✏', (e) => { e.stopPropagation(); E.editarNoLugar(nome, FF.Assets.nomeSprite(id), (v) => E.mudarInfoSprite(id, { nome: v.trim() && v.trim() !== (FF.Assets.acervo()[id] || [])[1] ? v.trim() : null })); }, 'Renomear este sprite (só o nome que aparece)'));
        const p = F && F.pastaDoSprite(id);
        const bm = E.botao('📂', (e) => { e.stopPropagation(); F.menuMover(bm, [id], () => depois()); }, p ? 'Está na pasta "' + p + '" — mover para outra ou voltar ao lugar original' : 'Mover para uma das suas pastas (sai daqui e fica só lá). Também dá para arrastar até a pasta.', 'es-fav-bt ess-mover' + (p ? ' on' : ''));
        acoes.appendChild(bm);
        if (F) acoes.appendChild(F.botao(id, null, () => depois()));
        if (ac) acoes.appendChild(E.botao('🗑', async (e) => {
          e.stopPropagation();
          if (!(await E.confirmar('🗑 Mandar para a Lixeira', 'Mandar "' + FF.Assets.nomeSprite(id) + '" para a Lixeira? Ele some das listas e das pastas; dá para restaurar em "🗑 Lixeira".', '🗑 Mandar para a Lixeira', true))) return;
          E.mudarInfoSprite(id, { oculto: true }); E.aviso('🗑 Sprite mandado para a Lixeira.'); depois();
        }, 'Mandar para a Lixeira (pergunta antes)', 'es-fav-bt ess-lixo es-lixo-sep es-bt-perigo'));
        b.draggable = true;
        b.addEventListener('dragstart', (e) => { e.dataTransfer.setData(FF.TIPO_ARRASTO_SPRITES, JSON.stringify(marcados.has(id) ? [...marcados] : [id])); e.dataTransfer.effectAllowed = 'move'; });
      }
      b.appendChild(acoes);
      b.onclick = () => o.escolher(id);
      pai.appendChild(b);
      return b;
    }

    // animação solta numa pasta/favorito (aba Sprites: clicar abre o sprite já nela; no seletor aparece na grade)
    function linhaAnim(pai, v, nivel) {
      const b = E.el('div', 'es-item es-nav-anim ess-anim-pasta' + (ehAtual(v.sprite) && o.animAtual && o.animAtual() === v.anim ? ' sel' : ''));
      b.dataset.sprite = v.sprite; b.dataset.anim = v.anim;
      b.style.paddingLeft = (18 + (nivel || 0) * 14) + 'px';
      const n = E.el('span', 'es-nav-nome'); n.textContent = '🎞 ' + FF.Assets.nomeAnim(v.sprite, v.anim);
      n.title = v.anim + ' · ' + FF.Assets.nomeSprite(v.sprite) + ' (' + v.sprite + ')';
      b.append(n, E.el('small', 'es-nav-n', FF.Assets.nomeSprite(v.sprite)));
      const acA = E.el('span', 'es-nav-acoes es-seletor-acoes');
      acA.appendChild(E.botao('✏', (e) => {
        e.stopPropagation();
        n.textContent = FF.Assets.nomeAnim(v.sprite, v.anim);
        E.editarNoLugar(n, n.textContent, (val) => { E.renomearAnim(v.sprite, v.anim, val); setTimeout(() => { n.textContent = '🎞 ' + FF.Assets.nomeAnim(v.sprite, v.anim); }, 0); });
      }, 'Renomear esta animação (só o nome que aparece; os golpes continuam usando "' + v.anim + '")'));
      if (FF.EstudioSeparar) acA.appendChild(E.botao('⇱', async (e) => {
        e.stopPropagation();
        const ids = await FF.EstudioSeparar.separar([{ sprite: v.sprite, anim: v.anim, pasta: v.pasta }]);
        if (ids.length) { depois(); o.escolher && o.escolher(ids[0], v.anim); }
      }, 'Separar em sprite próprio: ao abrir, aparece só esta animação (não as outras de "' + FF.Assets.nomeSprite(v.sprite) + '")', 'es-nav-separar'));
      b.appendChild(acA);
      b.draggable = true;   // arrastar para outra pasta (de dentro de uma pasta = mover; Ctrl = copiar)
      b.addEventListener('dragstart', (e) => { e.dataTransfer.setData(FF.TIPO_ARRASTO_ANIMS, JSON.stringify([[v.sprite, v.anim, v.pasta || null, false, false]])); e.dataTransfer.effectAllowed = 'copyMove'; });
      b.onclick = () => o.escolher(v.sprite, v.anim);
      pai.appendChild(b);
    }

    // ---- pastas (árvore)
    function pastas(pai, bate) {
      const arv = F.arvorePastas();
      const g = grupo(pai, 'pastas', '📁 Minhas pastas', arv.filter(p => !p.nivel).length, 0, { forcarAberto: !!buscaTxt() });
      g.cab.classList.add('es-pastas-cab');
      g.cab.title = 'Solte uma pasta aqui para ela voltar ao primeiro nível';
      FF.alvoDePasta(F, g.cab, '', () => depois());
      if (!g.aberto) return;
      const fechadas = [];
      // a pasta aberta na grade/no editor: os pais dela ficam abertos
      const atual = (o.fonte && o.fonte()) || '';
      if (/^pasta:/.test(atual)) { const n = atual.slice(6).split('/'); for (let k = 1; k < n.length; k++) abertos.add('p:' + n.slice(0, k).join('/')); }
      arv.forEach(p => {
        if (fechadas.some(f => p.nome.startsWith(f + '/'))) return;
        const itens = F.itensPasta(p.nome);
        const tudo = F.itensPasta(p.nome, true), lixo = tudo.filter(v => FF.Assets.spriteOculto(v.sprite)).length;
        const visiveis = itens.filter(v => !FF.Assets.spriteOculto(v.sprite) && (!bate || bate(v.sprite, v.anim)));
        if (bate && !visiveis.length && !tudo.some(v => bate(v.sprite, v.anim))) return;   // buscando: só pastas com o que bate
        const temConteudo = p.temFilhas || (!seletor && visiveis.length);
        const gp = grupo(g.corpo, 'p:' + p.nome, '📁 ' + p.folha, String(tudo.length - lixo) + (lixo ? ' +' + lixo + '🗑' : ''), p.nivel + 1,
          { fonte: seletor ? 'pasta:' + p.nome : null, semFilhos: !temConteudo, forcarAberto: !!bate });
        gp.cab.classList.add('es-pasta-item', 'es-seletor-fonte');
        gp.cab.title = p.nome;
        // arrastar a pasta / soltar coisas nela
        gp.cab.draggable = true;
        gp.cab.addEventListener('dragstart', (e) => { e.dataTransfer.setData(FF.TIPO_ARRASTO_PASTA, p.nome); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); });
        FF.alvoDePasta(F, gp.cab, p.nome, () => depois());
        // ＋ subpasta · ✏ renomear · 🗑 apagar (aparecem ao passar o mouse)
        const ac = E.el('span', 'es-nav-acoes es-pasta-acoes');
        ac.appendChild(E.botao('＋', (e) => { e.stopPropagation(); abertos.add('p:' + p.nome); gravarAbertos(); pedirNome(gp.cab, '', 'Nome da subpasta', (v) => { const n = v ? F.criarPasta(p.nome + '/' + v.replace(/\//g, '-')) : null; if (n && seletor) o.escolher('pasta:' + n); depois(); }, true); }, 'Criar uma subpasta dentro de "' + p.folha + '"'));
        ac.appendChild(E.botao('✏', (e) => { e.stopPropagation(); pedirNome(gp.cab, p.folha, 'Novo nome', (v) => {
          if (v && v !== p.folha) {
            if (!F.renomearFolha(p.nome, v)) E.aviso('Já existe uma pasta com esse nome aqui.', 'erro');
            else { const novo = (p.nivel ? F.paiDe(p.nome) + '/' : '') + v.replace(/\//g, '-'), cur = o.fonte && o.fonte(); if (cur && (cur === 'pasta:' + p.nome || cur.startsWith('pasta:' + p.nome + '/'))) o.escolher('pasta:' + novo + cur.slice(6 + p.nome.length)); }
          }
          depois();
        }); }, 'Renomear a pasta'));
        ac.appendChild(E.botao('🗑', async (e) => {
          e.stopPropagation();
          let tudoJunto = false;
          if (p.temFilhas) {
            const r = await E.escolha('Apagar pasta', 'A pasta "' + p.folha + '" tem subpastas. O que fazer com elas? (Os sprites e animações nunca são apagados; os movidos voltam para o lugar de origem.)',
              [{ txt: 'Apagar só esta (as subpastas sobem um nível)', valor: 'so', cls: 'es-bt-ouro' }, { txt: '🗑 Apagar com as subpastas', valor: 'tudo', cls: 'es-bt-perigo' }, { txt: 'Cancelar', valor: null }]);
            if (!r) return; tudoJunto = r === 'tudo';
          } else if (!(await E.confirmar('Apagar pasta', 'Apagar a pasta "' + p.folha + '"? O que está dentro dela continua no Estúdio.', '🗑 Apagar', true))) return;
          F.apagarPasta(p.nome, tudoJunto);
          const cur = o.fonte && o.fonte();
          if (cur === 'pasta:' + p.nome || (tudoJunto && cur && cur.startsWith('pasta:' + p.nome + '/'))) o.escolher(seletor ? 'efeitos' : null);
          depois();
        }, 'Apagar a pasta (o que está dentro continua no Estúdio)', 'es-bt-perigo es-lixo-sep'));
        gp.cab.appendChild(ac);
        if (!gp.aberto) { fechadas.push(p.nome); return; }
        // aba Sprites: o conteúdo da pasta aparece aqui (no seletor ele vai para a grade)
        if (!seletor) {
          const spr = ordenar([...new Set(visiveis.filter(v => !v.anim).map(v => v.sprite))]);
          spr.forEach(id => linhaSprite(gp.corpo, id, p.nivel + 2));
          visiveis.filter(v => v.anim).forEach(v => linhaAnim(gp.corpo, v, p.nivel + 1));
        }
      });
      const nova = E.el('div', 'es-item es-nav-nova es-pasta-nova', '＋ Nova pasta');
      nova.style.paddingLeft = '18px';
      nova.title = 'Criar uma pasta (use / para subpasta: Goku/SSJ)';
      nova.onclick = () => pedirNome(nova, '', 'Nome da pasta', (v) => { const n = v ? F.criarPasta(v) : null; if (n && seletor) o.escolher('pasta:' + n); depois(); });
      g.corpo.appendChild(nova);
    }
    // campo de texto no lugar de uma linha (criar/renomear)
    function pedirNome(linha, valor, dica, ok, abaixo) {
      const inp = document.createElement('input'); inp.value = valor; inp.placeholder = dica; inp.className = 'es-som-renomear es-nav-inp';
      if (abaixo) { linha.after(inp); } else { const t = linha.querySelector('.es-nav-nome') || linha; t.replaceWith(inp); }
      inp.focus(); inp.select();
      ['click', 'pointerdown', 'dblclick'].forEach(ev => inp.addEventListener(ev, (e) => e.stopPropagation()));
      let feito = false;
      const fim = (sim) => { if (feito) return; feito = true; ok(sim ? inp.value.trim() : null); };
      inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') fim(true); if (ev.key === 'Escape') fim(false); };
      inp.onblur = () => fim(true);
    }

    const buscaTxt = () => ((o.busca && o.busca()) || '').trim().toLowerCase();
    const ordenar = (l) => E.ordenar(l, E.rascunho.ler('nav_ordem') || 'padrao', (id) => FF.Assets.doAcervo(id) ? FF.Assets.nomeSprite(id) : (NM[id] || id), (id) => E.qtdAnimsSprite(id));

    // ---- desenha tudo
    function render() {
      const rol = caixa.scrollTop;
      raiz.innerHTML = '';
      pend.forEach((_, el) => obs.unobserve(el)); pend.clear();
      NM = NM || nomes();
      const f = buscaTxt();
      const movido = (id) => F && F.pastaDoSprite(id);
      const bateSpr = (id) => !f || id.toLowerCase().includes(f) || FF.Assets.nomeSprite(id).toLowerCase().includes(f) || (NM[id] || '').toLowerCase().includes(f)
        || E.animsDoSprite(id).some(a => a.toLowerCase().includes(f) || FF.Assets.nomeAnim(id, a).toLowerCase().includes(f));
      const bate = f ? (id, anim) => anim ? (anim.toLowerCase().includes(f) || FF.Assets.nomeAnim(id, anim).toLowerCase().includes(f) || bateSpr(id)) : bateSpr(id) : null;
      const todos = FF.Assets.listaSprites();
      const jogo = ordenar(todos.filter(id => !FF.Assets.doAcervo(id) && !movido(id) && bateSpr(id)).sort((a, b) => {
        const pa = a === 'fx' ? 0 : a === 'fx_extra' ? 1 : UTIL.includes(a) ? 3 : 2, pb = b === 'fx' ? 0 : b === 'fx_extra' ? 1 : UTIL.includes(b) ? 3 : 2;
        return pa - pb || a.localeCompare(b);
      }));
      const acervo = Object.keys(FF.Assets.acervo()).filter(id => !FF.Assets.spriteOculto(id) && !movido(id) && bateSpr(id));

      // Mostrar (só no seletor: fontes especiais da grade)
      if (seletor) {
        const m = E.el('div', 'es-nav-especiais');
        const esp = (chave, rot, n) => { const b = E.el('div', 'es-item es-seletor-fonte es-nav-esp' + (ehAtual(chave) ? ' sel' : '')); b.dataset.fonte = chave; b.append(E.el('span', 'es-nav-nome', rot)); if (n != null) b.appendChild(E.el('small', 'es-nav-n', String(n))); b.onclick = () => { o.escolher(chave); render(); }; m.appendChild(b); };
        esp('efeitos', '✺ Efeitos (todos)');
        esp('todos', '★ Tudo');
        raiz.appendChild(m);
      }
      // ⭐ favoritos (por tipo)
      if (F) {
        const l = F.lista().filter(v => !FF.Assets.spriteOculto(v.sprite) && (!bate || bate(v.sprite, v.anim)));
        if (l.length || !f) {
          const g = grupo(raiz, 'fav', '⭐ Meus favoritos', l.length, 0, { fonte: seletor ? 'fav' : null, forcarAberto: !!f, semFilhos: !l.length });
          if (g.aberto) F.TIPOS.forEach(([t, ic]) => {
            const lt = l.filter(v => v.tipo === t);
            if (!lt.length) return;
            const gt = grupo(g.corpo, 'fav:' + t, ic + ' ' + F.plural[t], lt.length, 1, { fonte: seletor ? 'fav:' + t : null, semFilhos: seletor, forcarAberto: !!f });
            if (!seletor && gt.aberto) { ordenar([...new Set(lt.filter(v => !v.anim).map(v => v.sprite))]).forEach(id => linhaSprite(gt.corpo, id, 2)); lt.filter(v => v.anim).forEach(v => linhaAnim(gt.corpo, v, 1)); }
          });
        }
        pastas(raiz, bate);
      }
      // 🎮 Do jogo
      if (jogo.length) {
        const g = grupo(raiz, 'jogo', '🎮 Do jogo', jogo.length, 0, { fonte: seletor ? 'jogo' : null, forcarAberto: !!f });
        if (g.aberto) jogo.forEach(id => linhaSprite(g.corpo, id, 1));
      }
      // 📦 Acervo: categoria → (tipo) → sprites
      if (acervo.length) {
        raiz.appendChild(E.el('div', 'es-sub es-nav-rotulo', 'Acervo (' + acervo.length + ')'));
        const NOME_CAT = FF.Assets.categoriasAcervo(), porCat = {};
        acervo.forEach(id => { (porCat[FF.Assets.categoriaSprite(id)] = porCat[FF.Assets.categoriaSprite(id)] || []).push(id); });
        const cats = ORDEM_CAT.filter(c => porCat[c]).concat(Object.keys(porCat).filter(c => !ORDEM_CAT.includes(c)));
        cats.forEach(c => {
          const ids = porCat[c];
          const g = grupo(raiz, 'cat:' + c, (ICONE[c] || '🎮') + ' ' + (NOME_CAT[c] || c), ids.length, 0, { fonte: seletor ? 'cat:' + c : null, forcarAberto: !!f });
          botaoLixoGrupo(g.cab, ids, NOME_CAT[c] || c);
          if (!g.aberto) return;
          const tipos = TIPOS.filter(t => ids.some(id => FF.Assets.tipoSprite(id) === t));
          if (tipos.length < 2) { ordenar(ids).forEach(id => linhaSprite(g.corpo, id, 1)); return; }
          tipos.forEach(t => {
            const it = ids.filter(id => FF.Assets.tipoSprite(id) === t);
            const gt = grupo(g.corpo, 'cat:' + c + ':' + t, ICONE[t] + ' ' + NOME_TIPO[t], it.length, 1, { fonte: seletor ? 'cat:' + c + ':' + t : null, forcarAberto: !!f });
            gt.cab.classList.add('es-seletor-subcat');
            if (gt.aberto) ordenar(it).forEach(id => linhaSprite(gt.corpo, id, 2));
          });
        });
      }
      // 🗑 Lixeira
      const lix = FF.Assets.listaSprites(true).filter(id => FF.Assets.spriteOculto(id) && bateSpr(id));
      if (lix.length || seletor) {
        const g = grupo(raiz, 'lixeira', '🗑 Lixeira', lix.length, 0, { fonte: seletor ? 'lixeira' : null, semFilhos: !lix.length });
        if (lix.length) g.cab.appendChild(E.botao('♻ Restaurar todos', async (e) => {
          e.stopPropagation();
          if (!(await E.confirmar('♻ Restaurar', 'Tirar os ' + lix.length + ' sprites da Lixeira?', '♻ Restaurar', false))) return;
          lix.forEach(id => E.mudarInfoSprite(id, { oculto: null })); E.aviso('♻ ' + lix.length + ' sprites restaurados.'); depois();
        }, 'Tirar todos da Lixeira', 'ess-cat-bt es-nav-bt'));
        if (g.aberto) lix.forEach(id => linhaSprite(g.corpo, id, 1, { naLixeira: true }));
      }
      raiz.appendChild(barra); pintarMarcas();
      caixa.scrollTop = rol;
    }
    function botaoLixoGrupo(cab, ids, nome) {
      if (!ids.every(id => FF.Assets.doAcervo(id))) return;
      cab.appendChild(E.botao('🗑', async (e) => {
        e.stopPropagation();
        if (!(await E.confirmar('🗑 Mandar para a Lixeira', 'Mandar os ' + ids.length + ' sprites de "' + nome + '" para a Lixeira? Eles somem das listas do Estúdio (em todos os aparelhos). Dá para restaurar na "🗑 Lixeira".', '🗑 Mandar para a Lixeira', true))) return;
        ids.forEach(id => E.mudarInfoSprite(id, { oculto: true })); E.aviso('🗑 ' + ids.length + ' sprites mandados para a Lixeira.'); depois();
      }, 'Mandar todos os sprites deste grupo para a Lixeira', 'ess-cat-bt es-nav-bt'));
    }

    FF.autoRolarArraste(caixa);
    // redesenha quando as edições mudam — mas só se estiver à vista: escondida (outra aba) ou atrás de uma janela
    // (ex.: a coluna da aba Sprites com o seletor de sprites aberto), espera aparecer de novo (desempenho)
    const escondida = () => !raiz.isConnected || raiz.offsetParent === null ||
      [...document.querySelectorAll('.es-modal')].some(m => !m.hidden && !m.contains(raiz));
    const digitando = () => { const a = document.activeElement; return !!a && raiz.contains(a) && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/checkbox|radio|button/.test(a.type))); };
    let pendente = null;
    const redesenhar = () => { NM = null; render(); o.aoMudar && o.aoMudar(); };
    const esperarAparecer = () => {
      if (pendente) return;
      pendente = setInterval(() => {
        if (!raiz.isConnected) { clearInterval(pendente); pendente = null; return; }
        if (!escondida() && !digitando()) { clearInterval(pendente); pendente = null; redesenhar(); }
      }, 400);
    };
    const parar = E.aoMudarEdicoes(() => {
      if (!raiz.isConnected) return;
      if (escondida() || digitando()) { esperarAparecer(); return; }
      redesenhar();
    }, 250);
    return {
      el: raiz, render, marcados,
      abrir(chave) { abertos.add(chave); gravarAbertos(); },
      destruir() { parar(); clearInterval(pendente); obs.disconnect(); raiz.remove(); },
    };
  }

  FF.EstudioNav = { criar, nomes };
})();
