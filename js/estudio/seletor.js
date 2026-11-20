// Estúdio — seletor de sprites: TODAS as animações de TODOS os sprites (efeitos, lutadores, importados e o
// acervo completo do Z Legends 3), para qualquer personagem. À esquerda escolhe a fonte (Efeitos, Tudo, um sprite
// ou uma categoria do acervo), à direita a grade com busca.
//   FF.Estudio.escolherSprite({ titulo, atual: {sprite, anim}, inicio: 'efeitos'|'todos'|'cat:<categoria>'|<id do sprite>,
//                               aoEscolher(anim, spriteId), limpar?(), aoEscolherVarios?([[anim, spriteId], ...]) })
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
    const jogoTodos = todos.filter(id => !FF.Assets.doAcervo(id)).sort((a, b) => {
      const pa = a === 'fx' ? 0 : a === 'fx_extra' ? 1 : UTIL.includes(a) ? 3 : 2;
      const pb = b === 'fx' ? 0 : b === 'fx_extra' ? 1 : UTIL.includes(b) ? 3 : 2;
      return pa - pb || a.localeCompare(b);
    });
    const acervoTodos = Object.keys(FF.Assets.acervo()).filter(id => !FF.Assets.spriteOculto(id));   // já vem em ordem de categoria/nome; sem os excluídos
    const NOME_CAT = FF.Assets.categoriasAcervo();
    const ids = jogoTodos.concat(acervoTodos);
    const NM = nomes();
    // listas da coluna da esquerda: sprites movidos para uma pasta (📂) saem do lugar original e moram só na pasta
    let jogo, acervo, porCat, cats;
    const movido = (id) => FF.Favoritos && FF.Favoritos.pastaDoSprite(id);
    const recalcular = () => {
      jogo = jogoTodos.filter(id => !movido(id));
      acervo = acervoTodos.filter(id => !movido(id));
      porCat = {};
      acervo.forEach(id => { (porCat[FF.Assets.categoriaSprite(id)] = porCat[FF.Assets.categoriaSprite(id)] || []).push(id); });
      cats = ORDEM_CAT.filter(c => porCat[c]).concat(Object.keys(porCat).filter(c => !ORDEM_CAT.includes(c)));
    };
    recalcular();
    let ordemLado = E.rascunho.ler('nav_ordem') || 'padrao', ordemGrade = E.rascunho.ler('seletor_ordem_grade') || 'padrao';
    const ordenarIds = (l) => E.ordenar(l, ordemLado, (id) => NM[id] || id, (id) => E.qtdAnimsSprite(id));

    let fonte = o.inicio || (o.atual && o.atual.sprite) || E.rascunho.ler('seletor_fonte') || 'efeitos';
    if (fonte !== 'efeitos' && fonte !== 'todos' && !/^(cat|fav|pasta)(:|$)/.test(fonte) && fonte !== 'lixeira' && !ids.includes(fonte)) fonte = 'efeitos';

    const c = E.el('div', 'es-seletor');
    const lado = E.el('div', 'es-seletor-fontes');
    const dir = E.el('div', 'es-seletor-dir');
    const topo = E.el('div', 'es-barra');
    const busca = document.createElement('input');
    busca.type = 'search'; busca.placeholder = 'Filtrar (ex.: explos, kame, Bills, hit, aura, namek)';
    const info = E.el('span', 'es-dica');
    // tamanho dos cartões (P/M/G) e janela em tela cheia: lembrados neste aparelho
    const TAMS = { p: [96, 72], m: [150, 112], g: [220, 165] };
    let tam = E.rascunho.ler('seletor_tam') || 'p';
    if (!TAMS[tam]) tam = 'p';
    const selTam = document.createElement('select');
    selTam.title = 'Tamanho dos cartões';
    [['p', 'Cartões pequenos'], ['m', 'Cartões médios'], ['g', 'Cartões grandes']].forEach(([v, t]) => { const op = document.createElement('option'); op.value = v; op.textContent = t; selTam.appendChild(op); });
    selTam.value = tam;
    selTam.onchange = () => { tam = selTam.value; E.rascunho.gravar('seletor_tam', tam); aplicarTam(); render(); };
    let cheia = !!E.rascunho.ler('seletor_cheia');
    const btCheia = E.botao('⛶', () => { cheia = !cheia; E.rascunho.gravar('seletor_cheia', cheia || null); aplicarCheia(); }, 'Expandir / reduzir a janela', 'es-seletor-cheia');
    const selOrdem = E.seletorOrdem('seletor_ordem_grade', 'quadros', (v) => { ordemGrade = v; render(); });
    selOrdem.title = 'Ordem dos cartões';
    // 🙈 esconder o que já está em alguma pasta (vale fora das pastas/favoritos): a grade vira "o que falta organizar"
    let esconderPastas = !!E.rascunho.ler('nav_esconder');   // o mesmo da aba Sprites
    const btEsc = E.botao('', () => { esconderPastas = !esconderPastas; E.rascunho.gravar('nav_esconder', esconderPastas || null); pintarEsc(); render(); },
      'Esconder as animações que já estão em alguma das suas pastas (enquanto navega pelos sprites e pelo acervo). Bom para ver o que falta organizar.');
    const pintarEsc = () => { btEsc.textContent = esconderPastas ? '🙈 Escondendo o que está em pastas' : '👁 Mostrando tudo'; btEsc.classList.toggle('es-bt-ouro', esconderPastas); };
    pintarEsc();
    topo.append(busca, info, btEsc, selOrdem, selTam, btCheia);
    if (o.limpar) topo.appendChild(E.botao('Nenhum', () => { o.limpar(); m.fechar(); }));
    const grade = E.el('div', 'es-grade');
    // ☑ seleção de vários: caixinha no cartão, Ctrl/Shift+clique ou arrastar uma caixa no espaço vazio da grade
    const marcados = new Map();   // 'sprite|anim' → {id, a}
    const chave = (x) => x.id + '|' + x.a;
    let visiveis = [], ultimoMarcado = -1;
    const barraSel = E.el('div', 'es-sons-sel es-seletor-sel');
    const txtSel = E.el('span');
    const btTodos = E.botao('Marcar todos', () => { visiveis.forEach(x => marcados.set(chave(x), { id: x.id, a: x.a })); pintarMarcas(); }, 'Marca todas as animações mostradas agora');
    const btLimpar = E.botao('Limpar', () => { marcados.clear(); pintarMarcas(); }, 'Desmarcar todos');
    const btFavSel = E.botao('⭐📁 Favoritar / pôr na pasta', () => {
      if (!marcados.size || !FF.Favoritos) return;
      FF.Favoritos.menuVarios(btFavSel, [...marcados.values()].map(v => ({ sprite: v.id, anim: v.a })), () => { contarFav(); render(); });
    }, 'Favoritar ou pôr numa pasta todas as marcadas de uma vez');
    const btDelSel = E.botao('🗑 Excluir', async () => {
      if (!marcados.size || !FF.Mods) return;
      const l = [...marcados.values()];
      const ok = await E.escolha('🗑 Excluir animações', 'Excluir as ' + l.length + ' animações marcadas? Elas vão para a Lixeira (fim da coluna da esquerda), de onde dá para restaurar.',
        [{ txt: '🗑 Excluir ' + l.length, valor: true, cls: 'es-bt-perigo' }, { txt: 'Cancelar', valor: false }]);
      if (!ok) return;
      l.forEach(v => { FF.Edicoes.setDepois(['sprites', v.id, v.a], { apagada: true }); const set = FF.Assets.sprites[v.id]; if (set) FF.Mods.aplicar(v.id, set); });
      marcados.clear(); E.aviso('🗑 ' + l.length + ' animações excluídas (Lixeira, no fim da coluna, para restaurar).'); render();
    }, 'Excluir todas as marcadas (vão para a Lixeira)', 'es-bt-perigo');
    // clicar num cartão só MARCA (pedido do usuário); quem usa é este botão (ou duplo clique no cartão)
    const usar = async (l) => {
      if (!l.length) return;
      for (const v of l) await FF.Assets.loadSprite(v.id).catch(() => null);   // quem escolhe já recebe o sprite pronto
      if (o.aoEscolherVarios && l.length > 1) o.aoEscolherVarios(l.map(v => [v.a, v.id]));
      else o.aoEscolher(l[0].a, l[0].id);
      m.fechar();
    };
    const btUsarSel = E.botao(o.aoEscolherVarios ? '➕ Pôr na trilha' : '✔ Usar', () => usar([...marcados.values()]),
      o.aoEscolherVarios ? 'Coloca as marcadas na trilha, uma depois da outra (na ordem em que foram marcadas)' : 'Usa a animação marcada', 'es-bt-ouro');
    // ✂ atalho para a aba Sprites (editar os quadros da animação); fecha o seletor
    const editar = async (id, a) => { m.fechar(); await E.editarSprite(id, a); };
    const btMovSel = E.botao('📂 Mover para…', () => {
      if (!marcados.size || !FF.Favoritos) return;
      const l = [...marcados.values()].map(v => { const o = origemDe(v.id, v.a); return Object.assign({ sprite: v.id, anim: v.a }, o ? { origem: o.pasta, inteiro: o.inteiro, movido: o.movido } : {}); });
      const dePasta = l.some(v => v.origem);
      FF.Favoritos.menuEscolherPasta(btMovSel, (dePasta ? '📂 Mover ' : '📁 Pôr ') + l.length + ' para a pasta:', (dest) => {
        const n = FF.Favoritos.moverItens(l, dest, false);
        E.aviso('📁 ' + n + (n === 1 ? ' item ' : ' itens ') + (dePasta ? 'movido(s) para' : 'em') + ' "' + FF.Favoritos.folha(dest) + '"');
        marcados.clear(); montarLado(); render();
      });
    }, 'Mover as marcadas para uma pasta (saem da pasta aberta agora). Para copiar, use ⭐📁 ou arraste com Ctrl.');
    const btEdSel = E.botao('✂ Editar na aba Sprites', () => { const v = [...marcados.values()][0]; if (v) editar(v.id, v.a); }, 'Abre a animação marcada na aba Sprites (editar quadros, origem, velocidade…). Marque só uma.');
    barraSel.append(txtSel, btTodos, btLimpar, btMovSel, btFavSel, btEdSel, btDelSel);
    if (btUsarSel) barraSel.appendChild(btUsarSel);
    const pintarMarcas = () => {
      grade.querySelectorAll('.es-cartao[data-k]').forEach(k => { const on = marcados.has(k.dataset.k); k.classList.toggle('marcado', on); const ch = k.querySelector('.es-cartao-chk'); if (ch) ch.checked = on; });
      const n = marcados.size;
      txtSel.textContent = n ? '☑ ' + n + ' marcada(s)' : '☐ Clique para marcar (Shift = intervalo, ou arraste uma caixa no espaço vazio) · duplo clique usa na hora';
      [btLimpar, btFavSel, btDelSel, btUsarSel, btMovSel].forEach(b => { if (b) b.disabled = !n; });
      btEdSel.disabled = n !== 1;
      if (o.aoEscolherVarios) btUsarSel.textContent = n > 1 ? '➕ Pôr os ' + n + ' na trilha' : '➕ Pôr na trilha';
      else { btUsarSel.textContent = '✔ Usar'; btUsarSel.disabled = n !== 1; btUsarSel.title = n > 1 ? 'Aqui só dá para usar uma: deixe só uma marcada' : 'Usa a animação marcada'; }
      barraSel.classList.toggle('ativa', n > 0);
    };
    const alternar = (x, idx, ev) => {
      if (ev && ev.shiftKey && ultimoMarcado >= 0) {   // Shift: marca o intervalo
        const [a, b] = idx < ultimoMarcado ? [idx, ultimoMarcado] : [ultimoMarcado, idx];
        visiveis.slice(a, b + 1).forEach(y => marcados.set(chave(y), { id: y.id, a: y.a }));
      } else if (marcados.has(chave(x))) marcados.delete(chave(x));
      else marcados.set(chave(x), { id: x.id, a: x.a });
      ultimoMarcado = idx; pintarMarcas();
    };
    // caixa de seleção arrastando no espaço vazio da grade
    grade.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || ev.target.closest('.es-cartao')) return;
      const r0 = grade.getBoundingClientRect();
      const x0 = ev.clientX - r0.left + grade.scrollLeft, y0 = ev.clientY - r0.top + grade.scrollTop;
      const caixaSel = E.el('div', 'es-caixa-sel'); grade.appendChild(caixaSel);
      const base = new Map(ev.ctrlKey || ev.metaKey || ev.shiftKey ? marcados : []);
      let moveu = false;
      const mover = (e) => {
        const r = grade.getBoundingClientRect();
        const x1 = e.clientX - r.left + grade.scrollLeft, y1 = e.clientY - r.top + grade.scrollTop;
        if (!moveu && Math.abs(x1 - x0) + Math.abs(y1 - y0) < 6) return;
        moveu = true;
        const L = Math.min(x0, x1), T = Math.min(y0, y1), W = Math.abs(x1 - x0), H = Math.abs(y1 - y0);
        Object.assign(caixaSel.style, { left: L + 'px', top: T + 'px', width: W + 'px', height: H + 'px' });
        marcados.clear(); base.forEach((v, k) => marcados.set(k, v));
        grade.querySelectorAll('.es-cartao[data-k]').forEach(k => {
          const kx = k.offsetLeft, ky = k.offsetTop;
          if (kx < L + W && kx + k.offsetWidth > L && ky < T + H && ky + k.offsetHeight > T) { const [id, ...a] = k.dataset.k.split('|'); marcados.set(k.dataset.k, { id, a: a.join('|') }); }
        });
        pintarMarcas();
        if (e.clientY > r.bottom - 20) grade.scrollTop += 16; else if (e.clientY < r.top + 20) grade.scrollTop -= 16;
      };
      const soltar = () => { caixaSel.remove(); removeEventListener('pointermove', mover); removeEventListener('pointerup', soltar); };
      addEventListener('pointermove', mover); addEventListener('pointerup', soltar);
      ev.preventDefault();
    });
    dir.append(topo, grade, barraSel);
    c.append(lado, dir);
    E.ladoRedimensionavel(lado, 'seletor_esq', 'esq', 440, { irmao: true, titulo: ':scope > .es-sub' });
    FF.autoRolarArraste(lado);   // arrastar até uma pasta lá em cima/embaixo: a coluna rola sozinha   // » expande a coluna da esquerda
    const m = E.modal(o.titulo || '🖼 Escolher sprite', c, { larga: true });
    const caixa = m.el.querySelector('.es-modal-caixa');
    function aplicarTam() { const [w, h] = TAMS[tam]; c.style.setProperty('--cartao-w', w + 'px'); c.style.setProperty('--cartao-h', h + 'px'); c.dataset.tam = tam; }
    function aplicarCheia() { caixa.classList.toggle('cheia', cheia); btCheia.classList.toggle('on', cheia); btCheia.textContent = cheia ? '🗗' : '⛶'; }
    aplicarTam(); aplicarCheia();

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
    // mudou algo nas edições (aqui ou na aba Sprites): coluna e grade se atualizam sozinhas
    const pararDeOuvir = E.aoMudarEdicoes(() => { if (!c.isConnected) return; const rol = grade.scrollTop; montarLado(); render().then(() => { grade.scrollTop = rol; }); }, 250);
    m.fechar = function () { obs.disconnect(); pararDeOuvir(); return fecharOrig.apply(this, arguments); };

    // "12 quadros · 0,8 s · 120×96" (duração pelo fps e pela duração de cada quadro; tamanho = maior quadro)
    const infoAnim = (s, a) => {
      const an = s.anim(a), fr = an.frames || [];
      let w = 0, h = 0, t = 0;
      fr.forEach(f => { w = Math.max(w, f[3] || 0); h = Math.max(h, f[4] || 0); t += f[7] || 1; });
      const esc = s.def.escala || 1;
      const dur = an.fps > 0 ? (t / an.fps).toFixed(t / an.fps < 10 ? 2 : 1).replace('.', ',') + ' s' + (an.loop ? ' 🔁' : '') : 'parado';
      return fr.length + ' quadro' + (fr.length === 1 ? '' : 's') + ' · ' + dur + ' · ' + Math.round(w * esc) + '×' + Math.round(h * esc);
    };
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
    // ☑ marcar vários SPRITES na coluna da esquerda (caixinha; Shift = intervalo) → mover, favoritar, Lixeira
    const marcadosS = new Set();
    let ultimoS = null;
    const barraS = E.el('div', 'es-seletor-sel-lado');
    const txtS = E.el('span');
    const btMoverS = E.botao('📂 Mover', () => { if (marcadosS.size) FF.Favoritos.menuMover(btMoverS, [...marcadosS], () => { marcadosS.clear(); montarLado(); render(); }); }, 'Mover os sprites marcados para uma das suas pastas');
    const btFavS = E.botao('⭐', () => { if (marcadosS.size) FF.Favoritos.menuVarios(btFavS, [...marcadosS].map(id => ({ sprite: id, anim: null })), () => { contarFav(); render(); }); }, 'Favoritar ou pôr numa pasta (sem tirar do lugar) os sprites marcados');
    const btLixoS = E.botao('🗑', async () => {
      const l = [...marcadosS].filter(id => FF.Assets.doAcervo(id));
      if (!l.length) { E.aviso('Só sprites do acervo vão para a Lixeira (os do jogo não).'); return; }
      const ok = await E.escolha('🗑 Mandar para a Lixeira', 'Mandar os ' + l.length + ' sprites marcados para a Lixeira? Eles somem das listas; dá para restaurar em "🗑 Lixeira (excluídos)".' + (l.length < marcadosS.size ? ' (' + (marcadosS.size - l.length) + ' do jogo ficam onde estão.)' : ''),
        [{ txt: '🗑 Mandar ' + l.length, valor: true, cls: 'es-bt-perigo' }, { txt: 'Cancelar', valor: false }]);
      if (!ok) return;
      l.forEach(id => E.mudarInfoSprite(id, { oculto: true }));
      E.aviso('🗑 ' + l.length + ' sprites mandados para a Lixeira.');
      l.forEach(id => { marcadosS.delete(id); const i = acervoTodos.indexOf(id); if (i >= 0) acervoTodos.splice(i, 1); });
      montarLado(); render();
    }, 'Mandar os sprites marcados para a Lixeira', 'es-bt-perigo');
    const btLimparS = E.botao('✕', () => { marcadosS.clear(); pintarS(); }, 'Desmarcar todos');
    barraS.append(txtS, btMoverS, btFavS, btLixoS, btLimparS);
    const pintarS = () => {
      lado.querySelectorAll('.es-seletor-chk').forEach(ch => { ch.checked = marcadosS.has(ch.dataset.id); ch.closest('.es-item').classList.toggle('marcado', ch.checked); });
      txtS.textContent = '☑ ' + marcadosS.size;
      barraS.style.display = marcadosS.size ? '' : 'none';
    };
    const marcarS = (id, ev) => {
      const chs = [...lado.querySelectorAll('.es-seletor-chk')].map(c => c.dataset.id);
      if (ev && ev.shiftKey && ultimoS && chs.includes(ultimoS)) {
        const [a, z] = [chs.indexOf(ultimoS), chs.indexOf(id)].sort((x, y) => x - y);
        chs.slice(a, z + 1).forEach(i => marcadosS.add(i));
      } else if (marcadosS.has(id)) marcadosS.delete(id); else marcadosS.add(id);
      ultimoS = id; pintarS();
    };
    const bt = (chave, texto, sub, pai) => {
      const b = E.el('div', 'es-item es-seletor-fonte' + (chave === fonte ? ' sel' : '') + (marcadosS.has(chave) ? ' marcado' : ''));
      b.dataset.fonte = chave;
      if (FF.Favoritos && ids.includes(chave)) {
        const ch = document.createElement('input'); ch.type = 'checkbox'; ch.className = 'es-seletor-chk'; ch.dataset.id = chave; ch.checked = marcadosS.has(chave);
        ch.title = 'Marcar este sprite (Shift = marca o intervalo) para mover, favoritar ou mandar para a Lixeira vários de uma vez';
        ch.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); marcarS(chave, e); setTimeout(pintarS, 0); });   // preventDefault desfaz o ✓ depois do clique: repinta em seguida
        b.appendChild(ch);
      }
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
        { const bm = E.botao('📂', (e) => { e.stopPropagation(); FF.Favoritos.menuMover(bm, [chave], () => { montarLado(); render(); }); }, FF.Favoritos.pastaDoSprite(chave) ? 'Está na pasta "' + FF.Favoritos.pastaDoSprite(chave) + '" — mover para outra ou voltar ao lugar original' : 'Mover este sprite para uma das suas pastas (sai daqui e fica só lá). Também dá para arrastar até a pasta.'); ac.appendChild(bm); }
        ac.appendChild(FF.Favoritos.botao(chave, null, () => { contarFav(); render(); }));   // ☆ sprite inteiro
        // 🗑 por último, separado do 📂, e pergunta antes (era fácil clicar sem querer)
        if (FF.Assets.doAcervo(chave)) ac.appendChild(E.botao('🗑', async (e) => {
          e.stopPropagation();
          if (!(await E.confirmar('🗑 Mandar para a Lixeira', 'Mandar "' + FF.Assets.nomeSprite(chave) + '" para a Lixeira? Ele some das listas e das pastas; dá para restaurar em "🗑 Lixeira (excluídos)".', '🗑 Mandar para a Lixeira', true))) return;
          E.mudarInfoSprite(chave, { oculto: true }); b.remove(); E.aviso('🗑 Sprite mandado para a Lixeira (no fim da coluna, para restaurar).'); contarFav();
        }, 'Mandar este sprite para a Lixeira (pergunta antes)', 'es-bt-perigo es-lixo-sep'));
        b.draggable = true;
        b.addEventListener('dragstart', (e) => { e.dataTransfer.setData(FF.TIPO_ARRASTO_SPRITES, JSON.stringify([chave])); e.dataTransfer.effectAllowed = 'move'; });
        b.appendChild(ac);
      }
      b.onclick = () => { fonte = chave; E.rascunho.gravar('seletor_fonte', chave); marcar(); render(); };
      (pai || lado).appendChild(b);
      return cv;
    };
    const mini = (cv, id) => desenharQuando(cv, id, (s) => E.miniatura(cv, s, Object.keys(s.def.anims)[0], 0));

    let contarFav = () => {};
    function montarLado() {
    const rolagem = lado.scrollTop;
    lado.innerHTML = '';
    recalcular();
    const cabLado = E.el('div', 'es-sub es-seletor-ordem-lado');
    cabLado.append(E.el('span', null, 'Mostrar'), E.seletorOrdem('nav_ordem', 'animações', (v) => { ordemLado = v; montarLado(); }));
    lado.appendChild(cabLado);
    bt('efeitos', '✺ Efeitos (todos)', null);
    // ⭐ favoritos do usuário, separados pelo tipo que ele escolheu
    const favBox = E.el('div');
    contarFav = () => {
      if (!FF.Favoritos) return;
      favBox.innerHTML = '';
      const l = FF.Favoritos.lista();
      if (!l.length) { favBox.appendChild(E.el('div', 'es-sub', '⭐ Meus favoritos (0)')); favBox.appendChild(E.el('p', 'es-dica', 'Clique na ☆ de um cartão (animação) ou de um sprite na lista para favoritar e dizer o que ele é.')); }
      else {
        bt('fav', '⭐ Meus favoritos (todos)', String(l.length), favBox);
        FF.Favoritos.TIPOS.forEach(([t, ic, nm]) => {
          const n = l.filter(x => x.tipo === t).length;
          if (n) bt('fav:' + t, ic + ' ' + FF.Favoritos.plural[t], String(n), favBox);
        });
      }
      // 📁 pastas criadas pelo usuário (ex.: "Goku" com as animações e efeitos dele)
      FF.listaPastas(FF.Favoritos, favBox, bt, (nova) => { if (nova) { fonte = nova; E.rascunho.gravar('seletor_fonte', nova); } montarLado(); render(); }, () => fonte, () => { fonte = 'efeitos'; });
      marcar();
    };
    bt('todos', '★ Tudo', null);
    lado.appendChild(favBox); contarFav();
    { const b = E.el('div', 'es-item es-seletor-fonte' + (fonte === 'lixeira' ? ' sel' : '')); b.dataset.fonte = 'lixeira'; b.appendChild(E.el('span', null, '🗑 Lixeira (excluídos)')); b.onclick = () => { fonte = 'lixeira'; marcar(); render(); }; lado.appendChild(b); }
    {   // "Do jogo": abre/fecha como as categorias do acervo (fechado fica lembrado)
      const cab = E.el('div', 'es-seletor-cat'), corpo = E.el('div', 'es-seletor-cat-corpo');
      let fechado = !!E.rascunho.ler('seletor_jogo_fechado'), montado = false;
      const ap = () => {
        cab.textContent = (fechado ? '▸ ' : '▾ ') + '🎮 Do jogo (' + jogo.length + ')';
        corpo.style.display = fechado ? 'none' : '';
        if (!fechado && !montado) { montado = true; ordenarIds(jogo).forEach(id => mini(bt(id, NM[id] ? NM[id] + ' · ' + id : id, null, corpo), id)); marcar(); }
      };
      cab.onclick = () => { fechado = !fechado; E.rascunho.gravar('seletor_jogo_fechado', fechado || null); ap(); };
      lado.append(cab, corpo); ap();
    }

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
          if (tipos.length < 2) { ordenarIds(porCat[cat]).forEach(id => item(id, corpo)); return; }
          tipos.forEach(t => {
            const chave = cat + ':' + t, ids = porCat[cat].filter(id => FF.Assets.tipoSprite(id) === t);
            const sc = E.el('div', 'es-seletor-cat es-seletor-subcat'), sb = E.el('div', 'es-seletor-cat-corpo');
            const tt = () => (abertas.has(chave) ? '▾ ' : '▸ ') + ICONE_CAT[t] + ' ' + NOME_TIPO[t] + ' (' + ids.length + ')';
            let feito = false;
            const ap = () => {
              sb.style.display = abertas.has(chave) ? '' : 'none'; sc.textContent = tt();
              if (abertas.has(chave) && !feito) { feito = true; bt('cat:' + chave, '☰ Todos: ' + NOME_TIPO[t].toLowerCase(), null, sb); ordenarIds(ids).forEach(id => item(id, sb)); }
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
    lado.appendChild(barraS); pintarS();   // barra dos sprites marcados: grudada no pé da coluna
    lado.scrollTop = rolagem;
    }
    montarLado();

    // ---- grade
    let geracao = 0, favsAtual = null;
    // de qual pasta veio um cartão (só quando a grade mostra uma pasta): {pasta, inteiro, movido}
    const origemDe = (id, a) => {
      if (!favsAtual) return null;
      const v = favsAtual.find(v => v.sprite === id && v.anim === a) || favsAtual.find(v => v.sprite === id && !v.anim);
      return v ? { pasta: v.pasta, inteiro: !v.anim, movido: !!v.movido } : null;
    };
    const render = async () => {
      const g = ++geracao;
      const f = busca.value.trim().toLowerCase();
      let lista, favs = null;
      favsAtual = null;
      if (/^(fav|pasta)(:|$)/.test(fonte) && !f) {   // favoritos / pasta: sprites inteiros + animações marcadas
        favs = (/^pasta:/.test(fonte) ? FF.Favoritos.itensPasta(fonte.slice(6), true) : FF.Favoritos.lista(fonte.slice(4) || null)).filter(x => ids.includes(x.sprite));
        lista = [...new Set(favs.map(x => x.sprite))];
        if (/^pasta:/.test(fonte)) favsAtual = favs;
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
      if (f) itens = itens.filter(x => (x.a + ' ' + x.id + ' ' + (NM[x.id] || '') + ' ' + FF.Assets.nomeAnim(x.id, x.a) + ' ' + FF.Assets.nomeSprite(x.id)).toLowerCase().includes(f));
      let escondidas = 0;
      if (esconderPastas && !favs && FF.Favoritos) {
        const naPasta = new Set();
        FF.Favoritos.nomesPastas().forEach(n => FF.Favoritos.itensPasta(n).forEach(v => naPasta.add(v.anim ? v.sprite + '#' + v.anim : v.sprite)));
        const antes = itens.length;
        itens = itens.filter(x => !naPasta.has(x.id + '#' + x.a) && !naPasta.has(x.id));
        escondidas = antes - itens.length;
      }
      itens = E.ordenar(itens, ordemGrade, (x) => FF.Assets.nomeAnim(x.id, x.a), (x) => x.n);
      // pasta com subpastas: a grade sai separada por subpasta (na ordem da árvore); "Soltos na pasta" só se houver
      let grupos = null;
      if (favs && /^pasta:/.test(fonte) && FF.Favoritos.descendentes(fonte.slice(6)).length) {
        const raiz = fonte.slice(6), ordem = [raiz].concat(FF.Favoritos.arvorePastas().map(p => p.nome).filter(n => n.startsWith(raiz + '/')));
        const pastaDe = (x) => { const v = favs.find(v => v.sprite === x.id && v.anim === x.a) || favs.find(v => v.sprite === x.id && !v.anim); return v ? v.pasta : raiz; };
        const porPasta = new Map(ordem.map(n => [n, []]));
        itens.forEach(x => { const pn = pastaDe(x); (porPasta.get(pn) || porPasta.get(raiz)).push(x); });
        grupos = ordem.filter(n => porPasta.get(n).length).map(n => ({ nome: n, itens: porPasta.get(n) }));
        itens = [].concat(...grupos.map(g => g.itens));
      }
      grade.innerHTML = '';
      pendentes.forEach((_, el) => obs.unobserve(el)); pendentes.clear();
      info.textContent = itens.length + ' animação(ões)' + (escondidas ? ' · ' + escondidas + ' já em pastas (escondidas)' : '') + (itens.length > 400 ? ' · mostrando 400, use o filtro' : '');
      visiveis = itens.slice(0, 400); ultimoMarcado = -1;
      const inicioGrupo = new Map();
      if (grupos) { let k = 0; grupos.forEach(g => { inicioGrupo.set(k, g); k += g.itens.length; }); }
      visiveis.forEach((x, idx) => {
        if (inicioGrupo.has(idx)) {   // título da subpasta, ocupando a linha inteira da grade
          const g = inicioGrupo.get(idx), raiz = fonte.slice(6);
          const t = E.el('div', 'es-grade-grupo', '📁 ' + (g.nome === raiz ? 'Soltos na pasta' : g.nome.slice(raiz.length + 1).replace(/\//g, ' › ')) + ' (' + g.itens.length + ')');
          grade.appendChild(t);
        }
        const sel = o.atual && x.a === o.atual.anim && (!o.atual.sprite || o.atual.sprite === x.id);
        const k = E.el('div', 'es-cartao' + (sel ? ' sel' : ''));
        k.dataset.k = chave(x);
        k.draggable = true;   // arrastar até uma 📁 pasta da coluna da esquerda (leva todos os marcados, se este estiver entre eles)
        k.addEventListener('dragstart', (e) => {
          // dentro de uma pasta, leva também de onde saiu (soltar noutra pasta = mover; Ctrl = copiar)
          const l = (marcados.has(chave(x)) ? [...marcados.values()] : [{ id: x.id, a: x.a }]).map(v => { const o = origemDe(v.id, v.a); return o ? [v.id, v.a, o.pasta, o.inteiro, o.movido] : [v.id, v.a]; });
          e.dataTransfer.setData(FF.TIPO_ARRASTO_ANIMS, JSON.stringify(l)); e.dataTransfer.effectAllowed = 'copyMove';
        });
        const chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'es-cartao-chk'; chk.title = 'Marcar (para favoritar, excluir ou pôr na trilha vários de uma vez)';
        chk.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); alternar(x, idx, e); setTimeout(pintarMarcas, 0); });   // idem: o navegador desfaz o ✓ ao fim do clique
        chk.addEventListener('pointerdown', (e) => e.stopPropagation());
        const cv = document.createElement('canvas'); cv.width = TAMS[tam][0]; cv.height = TAMS[tam][1];
        const inf = E.el('small', 'es-cartao-info'); inf.textContent = x.n + ' quadro' + (x.n === 1 ? '' : 's');
        const sp = E.el('span'); sp.textContent = FF.Assets.nomeAnim(x.id, x.a);
        if (sp.textContent !== x.a) sp.classList.add('renomeado');
        const sb = E.el('small', 'es-cartao-fonte'); sb.textContent = FF.Assets.nomeSprite(x.id) !== x.id ? FF.Assets.nomeSprite(x.id) : (NM[x.id] || x.id);
        sb.title = 'Duplo clique para renomear o sprite';
        sb.addEventListener('dblclick', (e) => { e.stopPropagation(); E.editarNoLugar(sb, sb.textContent, (v) => E.mudarInfoSprite(x.id, { nome: v.trim() && v.trim() !== (FF.Assets.acervo()[x.id] || [])[1] ? v.trim() : null })); });
        k.title = x.id + ' · ' + x.a + (FF.Assets.nomeAnim(x.id, x.a) !== x.a ? ' (renomeada: ' + FF.Assets.nomeAnim(x.id, x.a) + ')' : '') + ' (' + x.n + ' quadros)';
        k.append(cv, sp, sb, inf, chk);
        if (FF.Favoritos) k.appendChild(FF.Favoritos.botao(x.id, x.a, () => { contarFav(); if (favs) render(); }));
        { const ren = E.botao('✏', (e) => { e.stopPropagation(); e.preventDefault(); E.editarNoLugar(sp, FF.Assets.nomeAnim(x.id, x.a), (v) => { E.renomearAnim(x.id, x.a, v); sp.classList.toggle('renomeado', !!v.trim() && v.trim() !== x.a); }); }, 'Renomear esta animação (só o nome que aparece; o golpe continua igual)', 'es-fav-bt es-cartao-ren'); ren.addEventListener('pointerdown', (e) => e.stopPropagation()); k.appendChild(ren); }
        { const ed = E.botao('✂', (e) => { e.stopPropagation(); e.preventDefault(); editar(x.id, x.a); }, 'Editar esta animação na aba Sprites (quadros, origem, velocidade…)', 'es-fav-bt es-cartao-ed'); ed.addEventListener('pointerdown', (e) => e.stopPropagation()); k.appendChild(ed); }
        if (FF.Mods) { const del = E.botao('🗑', (e) => { e.stopPropagation(); e.preventDefault(); FF.Mods.apagar(x.id, x.a); k.remove(); E.aviso('🗑 Animação "' + x.a + '" excluída (Lixeira, no fim da coluna, para restaurar).'); }, 'Excluir esta animação (vai para a Lixeira)', 'es-fav-bt es-cartao-del'); del.addEventListener('pointerdown', (e) => e.stopPropagation()); k.appendChild(del); }
        const desenhar = (s) => {
          if (!s.has(x.a)) return;
          E.miniatura(cv, s, x.a, Math.floor(s.anim(x.a).frames.length / 2));
          inf.textContent = infoAnim(s, x.a);
          k.title = x.id + ' · ' + x.a + ' — ' + inf.textContent + (s.def.escala && s.def.escala !== 1 ? ' · escala ' + s.def.escala + '×' : '');
          if (FF.EstudioProps && FF.EstudioProps.animarNoMouse) FF.EstudioProps.animarNoMouse(k, cv, s, x.a);
        };
        if (x.s) desenhar(x.s); else desenharQuando(k, x.id, desenhar);
        k.onclick = (ev) => alternar(x, idx, ev);   // clique marca/desmarca; Shift = intervalo
        k.addEventListener('dblclick', (ev) => { ev.preventDefault(); usar([{ id: x.id, a: x.a }]); });   // atalho: usa este na hora
        grade.appendChild(k);
      });
      // pasta com itens de sprites que estão na Lixeira: avisa e deixa restaurar dali mesmo
      if (favs && /^pasta:/.test(fonte) && FF.Favoritos) {
        const todosDaPasta = FF.Favoritos.itensPasta(fonte.slice(6), true);
        const naLix = [...new Set(todosDaPasta.filter(v => FF.Assets.spriteOculto(v.sprite)).map(v => v.sprite))];
        if (naLix.length) {
          const nItens = todosDaPasta.filter(v => naLix.includes(v.sprite)).length;
          const av = E.el('div', 'es-grade-lixo');
          av.appendChild(E.el('span', null, '🗑 ' + nItens + ' ' + (nItens === 1 ? 'item desta pasta é' : 'itens desta pasta são') + ' de ' + (naLix.length === 1 ? 'um sprite que está' : naLix.length + ' sprites que estão') + ' na Lixeira (' + naLix.map(id => FF.Assets.nomeSprite(id)).join(', ') + ').'));
          av.appendChild(E.botao('♻ Restaurar', () => {
            naLix.forEach(id => { E.mudarInfoSprite(id, { oculto: null }); if (!acervoTodos.includes(id)) acervoTodos.push(id); if (!ids.includes(id)) ids.push(id); });
            E.aviso('♻ ' + (naLix.length === 1 ? 'Sprite restaurado.' : naLix.length + ' sprites restaurados.')); montarLado(); render();
          }, 'Tirar da Lixeira (voltam para as listas e para esta pasta)', 'es-bt-ouro'));
          grade.insertBefore(av, grade.firstChild);
        }
      }
      if (!itens.length && !grade.querySelector('.es-grade-lixo')) grade.innerHTML = '<p class="es-vazio">Nada encontrado.</p>';
      pintarMarcas();
      if (sel0) { const s = grade.querySelector('.es-cartao.sel'); if (s) s.scrollIntoView({ block: 'center' }); sel0 = false; }
    };
    let sel0 = true;
    // 🗑 Lixeira: sprites e animações excluídos, com "Restaurar"
    function renderLixeira() {
      grade.innerHTML = '';
      visiveis = [];
      const spr = FF.Assets.listaSprites(true).filter(id => FF.Assets.spriteOculto(id));
      const anims = [];
      Object.entries((FF.Mods && FF.Mods.ler()) || {}).forEach(([id, m]) => Object.entries(m || {}).forEach(([a, v]) => { if (v && v.apagada) anims.push({ id, a }); }));
      info.textContent = spr.length + ' sprite(s) e ' + anims.length + ' animação(ões) excluídos';
      const cartao = (txt, sub, id, anim, restaurar) => {
        const k = E.el('div', 'es-cartao');
        const cv = document.createElement('canvas'); cv.width = TAMS[tam][0]; cv.height = TAMS[tam][1];
        const inf = E.el('small', 'es-cartao-info'); inf.textContent = x.n + ' quadro' + (x.n === 1 ? '' : 's');
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
