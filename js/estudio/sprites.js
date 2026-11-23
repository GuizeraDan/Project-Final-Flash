// Estúdio Final Flash — aba "Sprites": edita as animações de qualquer sprite do jogo (lutadores, efeitos,
// HUD...) quadro a quadro e exporta (sprite sheet + JSON, sequência de PNGs, GIF, WebM, JSON).
//
// O que se edita é uma CÓPIA da animação (st.anim). "💾 Salvar no jogo" grava em data/edicoes.js
// (sprite do jogo: seção sprites[sprite][anim], via FF.Mods.salvar; sprite importado: direto em
// spritesNovos[sprite].anims, via FF.EstudioArq.salvarAnim) — vale no jogo inteiro e em todos os aparelhos.
// Quadro: [atlas, x, y, w, h, ox, oy, dur, pontos?]  (pontos[0] = ponto de disparo [dx, dy] relativo à origem)
//
// Sprites novos são montados pelo Claude a partir das imagens que o usuário manda na conversa
// (tools/importar_sprites.py + tools/receitas/<id>.json); esta aba é para EDITAR o que está no jogo.
// Não há importar/exportar aqui (pedido do usuário). Redimensionar cria imagens num atlas extra (js/estudio/sprites_arq.js).
(function () {
  const E = FF.Estudio;
  const RASC = 'sprites_rascunho', ULT = 'sprites_ultimo';
  const VELS = [0.25, 0.5, 0.75, 1, 1.5, 2];
  const FUNDOS = [['xadrez', 'Xadrez'], ['escuro', 'Escuro'], ['claro', 'Claro'], ['cenario', 'Cenário']];

  const st = {
    id: null, set: null, nome: null, anim: null, novo: false,
    i: 0, sel: new Set([0]), ancora: 0,
    tocando: false, t: 0, espera: 0, vel: 1, repetir: true, espelho: false,
    zoom: 3, panX: 0, panY: 0, fundo: 'xadrez', grade: false, cebola: false, caixa: true, pontos: true, usarEscala: false,
    modo: 'mover', multi: false, buscaSprite: '', buscaAnim: '',
  };
  const A = () => FF.EstudioArq;
  const importado = (id) => A().importado(id || st.id);
  const ui = {};
  const hist = new E.Historico(
    () => ({ id: st.id, nome: st.nome, anim: st.anim }),
    (s) => { st.anim = s.anim; corrigirSel(); pausar(); tudo(); gravarRascunho(); }, 150);

  // ------------------------------------------------------------------ utilidades
  const el = (tag, cls, html) => E.el(tag, cls, html);
  const copia = (o) => E.copia(o);
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  const frames = () => (st.anim ? st.anim.frames : []);
  const fpsDe = (a) => (a && a.fps > 0 ? a.fps : 10);
  const escolhidos = () => {
    const n = frames().length;
    const l = [...st.sel].filter(k => k >= 0 && k < n).sort((a, b) => a - b);
    return l.length ? l : (n ? [st.i] : []);
  };
  function corrigirSel() {
    const n = frames().length;
    st.i = n ? limitar(st.i, 0, n - 1) : 0;
    st.sel = new Set([...st.sel].filter(k => k < n));
    if (!st.sel.size && n) st.sel.add(st.i);
    if (st.anim && st.anim.repeatTo >= n) st.anim.repeatTo = Math.max(0, n - 1);
  }
  function limpa(a) { return { fps: a.fps || 0, loop: !!a.loop, repeatTo: a.repeatTo || 0, pingpong: false, frames: copia(a.frames || []) }; }
  // versão salva (a que o jogo usa agora) da animação aberta
  function salva() {
    if (st.novo || !st.set) return null;
    const a = st.set.def.anims[st.nome];
    return a ? limpa(a) : null;
  }
  function sujo() { if (!st.anim) return false; const s = salva(); return !s || JSON.stringify(s) !== JSON.stringify(limpa(st.anim)); }
  function escalaSprite() { return (st.set && st.set.def.escala) || 1; }

  // desenha um quadro centralizado e ajustado (miniaturas); maxW/maxH: maior quadro da animação
  function mini(cv, set, f, maxW, maxH) {
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!f || !set) return;
    const s = Math.min((cv.width - 4) / (maxW || f[3]), (cv.height - 4) / (maxH || f[4]), 3);
    ctx.drawImage(set.images[f[0]], f[1], f[2], f[3], f[4], Math.round((cv.width - f[3] * s) / 2), Math.round((cv.height - f[4] * s) / 2), f[3] * s, f[4] * s);
  }
  function maiores(lista) { let w = 1, h = 1; lista.forEach(q => { w = Math.max(w, q[3]); h = Math.max(h, q[4]); }); return [w, h]; }

  function confirmar(titulo, texto, sim, perigo) {
    return new Promise(res => {
      const c = el('div', 'ess-conf');
      const p = el('p'); p.textContent = texto;
      const bts = el('div', 'ess-conf-bts');
      let r = false;
      bts.append(E.botao(sim || 'OK', () => { r = true; m.fechar(); }, null, perigo ? 'es-bt-perigo' : 'es-bt-ouro'), E.botao('Não', () => m.fechar()));
      c.append(p, bts);
      const m = E.modal(titulo, c, { aoFechar: () => res(r) });
    });
  }

  // ------------------------------------------------------------------ montagem
  function montar(raiz) {
    raiz.innerHTML = '';
    raiz.classList.add('ess');
    // esquerda: sprites e animações
    const esq = el('aside', 'es-lado ess-esq');
    const tS = el('div', 'es-titulo', '🖼 Sprites');
    tS.appendChild(E.botao('🗂 Organizar', () => FF.EstudioOrganizar.abrir(), 'Tela dividida para separar os sprites do acervo nas suas pastas (marcar vários, mover, sugestões por nome)', 'es-mais ess-organizar'));
    esq.appendChild(tS);
    ui.buscaSprite = document.createElement('input');
    ui.buscaSprite.type = 'search'; ui.buscaSprite.placeholder = 'Buscar sprite…'; ui.buscaSprite.className = 'ess-busca';
    ui.buscaSprite.oninput = () => { st.buscaSprite = ui.buscaSprite.value; renderSprites(); };
    ui.sprites = el('div', 'es-lista ess-sprites');
    FF.autoRolarArraste(ui.sprites);
    // ↕ ordenar a lista de sprites e a de animações (lembrado no aparelho)
    ui.ordemSprites = E.seletorOrdem('nav_ordem', 'animações', () => renderSprites());   // a mesma ordem do seletor de sprites
    ui.ordemAnims = E.seletorOrdem('sprites_ordem_anims', 'quadros', () => renderAnims());
    const tA = el('div', 'es-titulo', '🎞 Animações <span class="ess-n"></span>');
    ui.nAnims = tA.querySelector('.ess-n');
    tA.appendChild(E.botao('＋ Nova', () => novaAnimacao(), 'Nova animação (vazia ou com os quadros escolhidos)', 'es-mais'));
    // 🙈 o mesmo filtro do seletor de sprites: esconder as animações que já estão em alguma pasta
    ui.btEsc = E.botao('', () => { E.rascunho.gravar('nav_esconder', E.rascunho.ler('nav_esconder') ? null : true); pintarEscA(); renderAnims(); }, 'Esconder as animações que já estão em alguma das suas pastas (o mesmo botão do seletor de sprites)', 'ess-esc');
    tA.insertBefore(ui.btEsc, tA.lastChild);
    ui.buscaAnim = document.createElement('input');
    ui.buscaAnim.type = 'search'; ui.buscaAnim.placeholder = 'Buscar animação…'; ui.buscaAnim.className = 'ess-busca';
    ui.buscaAnim.oninput = () => { st.buscaAnim = ui.buscaAnim.value; renderAnims(); };
    ui.anims = el('div', 'es-lista ess-anims es-rolar');
    const linhaS = el('div', 'ess-busca-linha'), linhaA = el('div', 'ess-busca-linha');
    linhaS.append(ui.buscaSprite, ui.ordemSprites); linhaA.append(ui.buscaAnim, ui.ordemAnims);
    // ↕ divisória entre Sprites e Animações: arraste para dividir o espaço; ︾ dá mais espaço aos sprites, ︽ às animações
    // (duplo clique volta ao normal; lembrado no aparelho: 'sprites_div' = altura da lista de sprites em px)
    const div = el('div', 'ess-div');
    div.title = 'Arraste para dividir o espaço entre Sprites e Animações · duplo clique volta ao normal';
    const alturaMax = () => Math.max(80, esq.clientHeight - 240);
    const aplicarDiv = (h) => {
      if (!h) { ui.sprites.style.height = ''; ui.sprites.style.maxHeight = ''; E.rascunho.gravar('sprites_div', null); return; }
      h = Math.round(Math.max(48, Math.min(alturaMax(), h)));
      ui.sprites.style.height = h + 'px'; ui.sprites.style.maxHeight = 'none';
      E.rascunho.gravar('sprites_div', h);
    };
    const btMaisS = E.botao('︾', (ev) => { ev.stopPropagation(); aplicarDiv(ui.sprites.offsetHeight >= alturaMax() - 4 ? null : alturaMax()); }, 'Mais espaço para os sprites (clique de novo volta ao normal)', 'ess-div-bt');
    const btMaisA = E.botao('︽', (ev) => { ev.stopPropagation(); aplicarDiv(ui.sprites.offsetHeight <= 52 ? null : 48); }, 'Mais espaço para as animações (clique de novo volta ao normal)', 'ess-div-bt');
    div.append(btMaisA, el('span', 'ess-div-alca'), btMaisS);
    div.addEventListener('dblclick', () => aplicarDiv(null));
    div.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      const y0 = e.clientY, h0 = ui.sprites.offsetHeight;
      div.setPointerCapture(e.pointerId); div.classList.add('arrastando');
      const mv = (ev) => aplicarDiv(h0 + ev.clientY - y0);
      const up = () => { div.classList.remove('arrastando'); div.removeEventListener('pointermove', mv); div.removeEventListener('pointerup', up); div.removeEventListener('pointercancel', up); };
      div.addEventListener('pointermove', mv); div.addEventListener('pointerup', up); div.addEventListener('pointercancel', up);
    });
    esq.append(linhaS, ui.sprites, div, tA, linhaA, ui.anims);
    requestAnimationFrame(() => { const h = E.rascunho.ler('sprites_div'); if (h) aplicarDiv(h); });

    // centro: barra de ações, palco, controles, tira de quadros
    const cen = el('div', 'es-centro ess-centro');
    const barra = el('div', 'es-barra ess-barra');
    ui.titulo = el('span', 'ess-titulo');
    ui.btSalvar = E.botao('💾 Salvar no jogo', () => salvar(), 'Grava esta animação no jogo (Ctrl+S) — vale em todas as telas e, conectado, em todos os aparelhos', 'es-bt-ouro');
    ui.btComo = E.botao('💾 Salvar como nova…', () => salvarComo(), 'Grava uma cópia com outro nome');
    ui.btOrig = E.botao('↺ Original', () => original(), 'Volta ao original do jogo / descarta as mudanças não salvas');
    ui.btApagar = E.botao('🗑 Apagar', () => apagarAnim(st.nome), 'Apaga esta animação do jogo (dá para trazer de volta em "Apagadas", no fim da lista)', 'es-bt-perigo');
    ui.btBaixar = E.botao('⬇ Baixar', () => FF.EstudioIO.baixar(ctxIO()), 'Baixa esta animação (folha PNG, ZIP de quadros, GIF ou PNG animado) para editar em outro programa', 'ess-baixar');
    ui.btTrazer = E.botao('⬆ Trazer de volta', () => FF.EstudioIO.trazer(ctxIO()), 'Traz a animação editada fora: substitui os quadros desta ou vira uma animação nova', 'ess-trazer');
    barra.append(ui.titulo, el('span', 'ess-esp'), ui.btBaixar, ui.btTrazer, ui.btSalvar, ui.btComo, ui.btOrig, ui.btApagar);

    const opcoes = el('div', 'es-barra ess-opcoes');
    const selFundo = E.campo('select', 'Fundo', st.fundo, (v) => { st.fundo = v; }, { lista: FUNDOS });
    selFundo.classList.add('ess-mini');
    const ck = (txt, chave, dica) => {
      const l = el('label', 'ess-ck'); l.title = dica || '';
      const i = document.createElement('input'); i.type = 'checkbox'; i.checked = st[chave];
      i.onchange = () => { st[chave] = i.checked; };
      l.append(i, document.createTextNode(txt));
      ui['ck_' + chave] = i;
      return l;
    };
    opcoes.append(selFundo, ck('Grade', 'grade', 'Grade de pixels'), ck('Cebola', 'cebola', 'Mostra o quadro anterior (vermelho) e o próximo (azul) por baixo'),
      ck('Caixa', 'caixa', 'Mostra a caixa do quadro'), ck('Disparo', 'pontos', 'Mostra o ponto de disparo'),
      ck('Escala do jogo', 'usarEscala', 'Mostra o sprite com a escala geral dele (spritesInfo)'));

    ui.palcoWrap = el('div', 'es-palco-wrap ess-palco');
    ui.cv = document.createElement('canvas');
    ui.info = el('div', 'es-palco-info');
    const modos = el('div', 'es-palco-modo ess-modos');
    ui.modos = {};
    [['mover', '✥ Origem', 'Arraste o desenho para mudar a origem (pés) dos quadros escolhidos · setas = 1 px, Shift = 10'],
      ['caixa', '▭ Recorte', 'Ajuste a caixa do quadro no atlas (alças nos cantos e lados; arraste dentro para mover)'],
      ['disparo', '🎯 Disparo', 'Clique no palco para gravar o ponto de disparo do quadro'],
      ['cortar', '✂ Cortar', 'Desenhe um retângulo no palco para aproveitar só um pedaço dos quadros (ex.: só o raio de um golpe) e crie uma animação nova com ele'],
      ['mao', '✋ Mover vista', 'Arraste para mover a vista (também: botão do meio ou arrastar fora do desenho)']].forEach(([m, t, d]) => {
      const b = E.botao(t, () => { st.modo = m; renderModos(); }, d);
      ui.modos[m] = b; modos.appendChild(b);
    });
    const zooms = el('div', 'ess-zoom');
    zooms.append(E.botao('−', () => zoomEm(1 / 1.25), 'Diminuir zoom'), E.botao('＋', () => zoomEm(1.25), 'Aumentar zoom'), E.botao('⤢', () => enquadrar(), 'Enquadrar a animação'));
    ui.palcoWrap.append(ui.cv, ui.info, modos, zooms);

    const ctr = el('div', 'es-barra ess-ctr');
    ui.btIni = E.botao('⏮', () => irPara(0), 'Primeiro quadro (Home)');
    ui.btAnt = E.botao('◀', () => passo(-1), 'Quadro anterior (vírgula)');
    ui.btPlay = E.botao('▶', () => alternar(), 'Tocar / pausar (espaço)', 'ess-play');
    ui.btProx = E.botao('▶|', () => passo(1), 'Próximo quadro (ponto)');
    ui.btFim = E.botao('⏭', () => irPara(frames().length - 1), 'Último quadro (End)');
    const vel = E.campo('select', 'Vel.', '1', (v) => { st.vel = +v; }, { lista: VELS.map(v => [String(v), String(v).replace('.', ',') + '×']) });
    vel.classList.add('ess-mini');
    ui.btRep = E.botao('🔁', () => { st.repetir = !st.repetir; renderCtr(); }, 'Repetir ao chegar no fim (na prévia)');
    ui.btEsp = E.botao('⇋', () => { st.espelho = !st.espelho; renderCtr(); }, 'Espelhar (virado para a esquerda)');
    ui.tempo = el('span', 'ess-tempo');
    ctr.append(ui.btIni, ui.btAnt, ui.btPlay, ui.btProx, ui.btFim, el('span', 'sep'), vel, ui.btRep, ui.btEsp, ui.tempo);

    const tiraBarra = el('div', 'es-barra ess-tira-barra');
    tiraBarra.append(
      E.botao('🗑 Apagar', () => apagar(), 'Apagar os quadros escolhidos (Delete)', 'es-bt-perigo'),
      E.botao('⧉ Duplicar', () => duplicar(), 'Duplicar os quadros escolhidos (Ctrl+D)'),
      E.botao('◀ Mover', () => mover(-1), 'Mover os escolhidos para a esquerda'),
      E.botao('Mover ▶', () => mover(1), 'Mover os escolhidos para a direita'),
      E.botao('⇄ Inverter', () => inverter(), 'Inverte a ordem dos escolhidos (ou de todos, se só um estiver escolhido)'),
      E.botao('＋ Inserir quadros…', () => inserirDeOutra(), 'Inserir quadros de qualquer animação deste sprite depois do quadro escolhido'),
      E.botao('▦ Separar sheet', () => separarSheet(), 'O quadro é uma folha com vários desenhos? Separa em quadros (automático ou em grade), sem mexer nas imagens', 'es-bt-ouro'),
      el('span', 'sep'));
    ui.btMulti = E.botao('☑ Vários', () => { st.multi = !st.multi; renderCtr(); }, 'Toque para escolher vários quadros (ou use Ctrl/Shift)');
    tiraBarra.append(ui.btMulti, E.botao('Todos', () => { st.sel = new Set(frames().map((_, k) => k)); renderTira(); renderProps(); }, 'Escolher todos os quadros (Ctrl+A)'));
    ui.tira = el('div', 'ess-tira');
    ui.marca = el('div', 'ess-tira-marca'); ui.marca.hidden = true;
    cen.append(barra, opcoes, ui.palcoWrap, ctr, tiraBarra, ui.tira);

    // direita: propriedades
    const dir = el('aside', 'es-lado dir ess-dir');
    dir.innerHTML = '<div class="es-titulo">⚙ Propriedades</div>';
    ui.props = el('div', 'es-rolar ess-props');
    dir.appendChild(ui.props);
    montarPainelMontagem(dir);   // 🧩 montar animação nova com quadros escolhidos da tira
    // mudou algo nas edições (no seletor de sprites, por exemplo): a lista de sprites e a de animações acompanham
    E.aoMudarEdicoes(() => { if (raiz.hidden || !raiz.isConnected || E.digitando({ target: document.activeElement })) return; renderAnims(); }, 300);   // a lista de sprites (navegador) se atualiza sozinha
    FF.Assets.animsAcervo().then(() => { if (st.buscaSprite) renderSprites(); });   // nomes das animações para a busca

    raiz.append(esq, cen, dir);
    E.ladoRedimensionavel(esq, 'sprites_esq', 'esq', 460);   // » expande a coluna para ler os nomes inteiros
    E.ladoRedimensionavel(dir, 'sprites_dir', 'dir', 460);
    ligarPalco();
    ligarTira();
    new ResizeObserver(() => ajustarCanvas()).observe(ui.palcoWrap);
    renderModos(); renderCtr();
    renderSprites();
    return iniciar();
  }

  async function iniciar() {
    const q = new URLSearchParams(location.search);
    const rasc = E.rascunho.ler(RASC);
    const ult = E.rascunho.ler(ULT) || {};
    let id = q.get('sprite') || ult.id || 'gokubase';
    if (!FF.Assets.listaSprites().includes(id)) id = FF.Assets.listaSprites()[0];
    await abrirSprite(id, q.get('anim') || (id === ult.id ? ult.nome : null), true);
    if (rasc && rasc.id && rasc.anim) {
      const set = await FF.Assets.loadSprite(rasc.id).catch(() => null);
      const orig = set && set.def.anims[rasc.nome];
      if (set && (!orig || JSON.stringify(limpa(orig)) !== JSON.stringify(limpa(rasc.anim)))) {
        const quando = rasc.t ? new Date(rasc.t).toLocaleString('pt-BR') : '';
        if (await confirmar('📝 Rascunho encontrado', 'Há mudanças não salvas em "' + rasc.id + ' / ' + rasc.nome + '"' + (quando ? ' (' + quando + ')' : '') + '. Recuperar?', 'Recuperar')) {
          await abrirSprite(rasc.id, null, true);
          abrirAnim(rasc.nome, { forcar: true, novo: !orig, anim: rasc.anim });
          return;
        }
      }
      E.rascunho.gravar(RASC, null);
    }
  }

  // ------------------------------------------------------------------ sprites e animações
  // lista de sprites = navegador de sprites (o mesmo do seletor; js/estudio/navegador.js)
  function renderSprites() {
    if (!ui.nav) {
      ui.nav = FF.EstudioNav.criar(ui.sprites, {
        modo: 'sprites',
        fonte: () => st.id,
        animAtual: () => st.nome,
        busca: () => st.buscaSprite,
        escolher: (id, anim) => { if (id) abrirSprite(id, anim || null); },
        aoMudar: () => renderAnims(),
        decorar: (id, linha) => {
          const nome = linha.querySelector('.es-nav-nome');
          if (importado(id)) { const t = el('span', 'ess-spr-imp', '📥'); t.title = 'Sprite importado por você'; linha.insertBefore(t, nome); }
          const mods = (FF.Mods.ler()[id] && Object.keys(FF.Mods.ler()[id]).length) || 0;
          if (mods) { const t = el('small', 'ess-mods', '✎ ' + mods); t.title = mods + ' animação(ões) alterada(s)'; nome.after(t); }
        },
      });
    }
    // abre a categoria do sprite aberto uma vez (ao abrir o sprite), sem impedir de fechar depois
    if (st.id && st.catAbertaDe !== st.id && FF.Assets.doAcervo(st.id)) {
      st.catAbertaDe = st.id;
      const c = FF.Assets.categoriaSprite(st.id);
      ui.nav.abrir('cat:' + c); ui.nav.abrir('cat:' + c + ':' + FF.Assets.tipoSprite(st.id));
    }
    ui.nav.render();
  }

  // Lixeira: sprites do acervo que o usuário não quer usar somem das listas (spritesInfo[id].oculto; um commit só
  // para vários cliques). Os arquivos continuam no repositório e golpes que já usam o sprite seguem funcionando.
  function lixeiraSprites(ids) {
    ids.forEach(id => E.mudarInfoSprite(id, { oculto: true }));
    E.aviso('🗑 ' + (ids.length === 1 ? 'Sprite "' + FF.Assets.nomeSprite(ids[0]) + '" mandado' : ids.length + ' sprites mandados') + ' para a Lixeira (no fim da lista, para restaurar).');
    renderSprites();
  }
  function restaurarSprites(ids) {
    ids.forEach(id => E.mudarInfoSprite(id, { oculto: null }));
    E.aviso('♻ ' + (ids.length === 1 ? 'Sprite "' + FF.Assets.nomeSprite(ids[0]) + '" restaurado.' : ids.length + ' sprites restaurados.'));
    renderSprites();
  }

  // ao trocar com mudanças não salvas: salvar, descartar ou ficar
  async function podeTrocar() {
    if (!sujo()) return true;
    const r = await E.escolha('Mudanças não salvas', 'A animação "' + st.nome + '" tem mudanças que ainda não foram salvas no jogo. O que fazer?', [
      { txt: '💾 Salvar e trocar', valor: 'salvar', cls: 'es-bt-ouro' }, { txt: 'Trocar sem salvar', valor: 'descartar', cls: 'es-bt-perigo' }, { txt: 'Ficar aqui', valor: null }]);
    if (!r) return false;
    if (r === 'salvar') salvar();
    return true;
  }

  async function abrirSprite(id, nome, semPerguntar) {
    if (!semPerguntar && !(await podeTrocar())) return;
    let set;
    try { set = await FF.Assets.loadSprite(id); } catch (e) { E.aviso('❌ Não deu para abrir o sprite ' + id + ': ' + e.message, 'erro'); return; }
    st.id = id; st.set = set;
    renderSprites();
    if (ui.mont) { ui.mont.k = 0; ui.mont.t = 0; renderMontagem(); }   // cada sprite tem a sua montagem
    const nomes = Object.keys(set.def.anims);
    if (!nomes.length) {   // sprite sem nenhuma animação (ex.: todas apagadas)
      st.nome = null; st.anim = null; st.novo = false; st.i = 0; st.sel = new Set();
      pausar(); hist.zerar('Abrir ' + id); E.rascunho.gravar(ULT, { id, nome: null });
      tudo();
      return;
    }
    abrirAnim(nome && set.def.anims[nome] ? nome : nomes[0], { forcar: true });
  }

  function pintarEscA() { if (ui.btEsc) { const on = !!E.rascunho.ler('nav_esconder'); ui.btEsc.textContent = on ? '🙈' : '👁'; ui.btEsc.classList.toggle('es-bt-ouro', on); } }
  function renderAnims() {
    ui.anims.innerHTML = '';
    pintarEscA();
    if (!st.set) return;
    const f = st.buscaAnim.toLowerCase();
    const nomes = Object.keys(st.set.def.anims);
    ui.nAnims.textContent = '(' + nomes.length + ')';
    const lista = st.novo ? [st.nome].concat(nomes) : nomes;
    if (!lista.length) {
      const v = el('div', 'es-vazio ess-sem-anim');
      v.appendChild(el('p', null, 'Este sprite não tem animações.'));
      v.appendChild(E.botao('＋ Nova vazia', () => novaAnimacao(), 'Criar uma animação e depois inserir quadros'));
      if (importado()) v.appendChild(E.botao('🗑 Apagar sprite', () => apagarSprite(st.id), 'Apagar este sprite importado', 'es-bt-perigo'));
      ui.anims.appendChild(v);
    }
    const ordA = ui.ordemAnims ? ui.ordemAnims.value : 'padrao';
    const escP = !!E.rascunho.ler('nav_esconder') && FF.Favoritos ? new Set(FF.Favoritos.nomesPastas().flatMap(n => FF.Favoritos.itensPasta(n).filter(v => v.sprite === st.id).map(v => v.anim || '*'))) : null;
    if (escP && escP.has('*')) escP.clear();   // o sprite inteiro está numa pasta: não esconde as animações dele aqui
    const listaVer = E.ordenar(lista.filter(n => (!escP || n === st.nome || !escP.has(n)) && (!f || n.toLowerCase().includes(f) || FF.Assets.nomeAnim(st.id, n).toLowerCase().includes(f))), ordA,
      (n) => FF.Assets.nomeAnim(st.id, n), (n) => { const a = st.set.def.anims[n]; return a ? a.frames.length : 0; });
    listaVer.forEach(n => {
      const novoAqui = st.novo && n === st.nome && !st.set.def.anims[n];
      const a = novoAqui ? st.anim : st.set.def.anims[n];
      const it = el('div', 'es-item ess-anim' + (n === st.nome ? ' sel' : ''));
      it.dataset.anim = n;
      const cv = document.createElement('canvas'); cv.width = 40; cv.height = 40;
      const [mw, mh] = maiores(a.frames);
      mini(cv, st.set, a.frames[0], mw, mh);
      const nm = el('span', 'ess-anim-nome'); nm.textContent = FF.Assets.nomeAnim(st.id, n); nm.title = n + (nm.textContent !== n ? ' (nome dado por você: ' + nm.textContent + ')' : '');
      it.append(cv, nm);
      if (novoAqui) it.appendChild(el('span', 'tag alt', 'nova'));
      else if (FF.Mods.criada(st.id, n)) it.appendChild(el('span', 'tag', '★'));
      if (!novoAqui && FF.Mods.alterada(st.id, n)) { const t = el('span', 'tag alt', '✎'); t.title = 'Alterada por você'; it.appendChild(t); }
      it.appendChild(el('small', null, String(a.frames.length)));
      if (!novoAqui && podeRenomear(n)) it.appendChild(E.botao('Aa', (e) => { e.stopPropagation(); renomearAnim(n); }, 'Renomear esta animação', 'ess-anim-apagar ess-anim-ren'));
      const x = E.botao('🗑', (e) => { e.stopPropagation(); apagarAnim(n); }, 'Apagar esta animação do jogo', 'ess-anim-apagar');
      it.appendChild(x);
      // ☆ favoritar a animação (o mesmo menu do seletor: tipo + pastas) → aparece em "⭐ Meus favoritos" no editor de cenas
      if (!novoAqui && FF.Favoritos) it.appendChild(FF.Favoritos.botao(st.id, n));
      it.onclick = () => abrirAnim(n);
      ui.anims.appendChild(it);
    });
    // animações do jogo que você apagou: dá para trazer de volta
    const ap = FF.Mods.apagadas(st.id);
    if (ap.length) {
      ui.anims.appendChild(el('div', 'es-sub', '🗑 Apagadas (' + ap.length + ')'));
      ap.forEach(n => {
        const it = el('div', 'es-item ess-anim ess-apagada');
        const nm = el('span', 'ess-anim-nome'); nm.textContent = n; nm.title = n;
        it.appendChild(nm);
        it.appendChild(E.botao('↺ Trazer de volta', (e) => { e.stopPropagation(); restaurarApagada(n); }, 'Volta a animação original do jogo'));
        ui.anims.appendChild(it);
      });
    }
  }

  // golpes (do jogo e seus) que usam uma animação deste sprite
  async function usosDaAnim(nome) {
    const usos = [];
    for (const pid of FF.Assets.listaPersonagens()) {
      let d; try { d = await FF.Assets.loadCharacter(pid); } catch (e) { continue; }
      Object.values(d.formas || {}).forEach(f => {
        if (f.sprite !== st.id) return;
        const mapa = f.anims || {};
        if (Object.values(mapa).includes(nome)) usos.push((d.nome || pid) + ': animação básica');
        (f.golpes || []).forEach(gid => {
          const g = d.golpes[gid]; if (!g) return;
          const j = JSON.stringify(g.roteiro || []);
          if (j.includes('"' + nome + '"')) usos.push((d.nome || pid) + ': ' + (g.nome || gid));
        });
      });
    }
    return [...new Set(usos)];
  }

  async function apagarAnim(nome) {
    if (!nome) return;
    const def = st.set.def;
    // animação nova ainda não salva: só descarta
    if (st.novo && nome === st.nome && !def.anims[nome]) {
      if (!(await confirmar('Apagar animação', 'Descartar a animação nova "' + nome + '" (ainda não salva)?', '🗑 Apagar', true))) return;
      E.rascunho.gravar(RASC, null); st.novo = false; st.anim = null;
      return abrirAnim(Object.keys(def.anims)[0], { forcar: true });
    }
    const novoSprite = (FF.Edicoes.dados().spritesNovos || {})[st.id];
    const doImportado = novoSprite && novoSprite.anims && novoSprite.anims[nome];
    const criada = FF.Mods.criada(st.id, nome);
    if (novoSprite && Object.keys(def.anims).length <= 1) {
      // não deixa um sprite importado sem nenhuma animação: oferece apagar o sprite
      if (await confirmar('Última animação', '"' + nome + '" é a única animação de "' + st.id + '". Apagar o sprite inteiro?', '🗑 Apagar sprite', true)) apagarSprite(st.id, true);
      return;
    }
    const usos = await usosDaAnim(nome);
    const txt = 'Apagar a animação "' + nome + '" de "' + st.id + '" no jogo (em todos os aparelhos)?' +
      (usos.length ? '\n\n⚠ Ela é usada em: ' + usos.slice(0, 6).join(' · ') + (usos.length > 6 ? '…' : '') + '. Esses golpes vão ficar sem essa animação.' : '') +
      (!criada && !doImportado ? '\n\nÉ uma animação do jogo original: ela fica em "Apagadas" e dá para trazer de volta.' : '');
    if (!(await confirmar('🗑 Apagar animação', txt, '🗑 Apagar', true))) return;
    if (doImportado) { A().apagarAnimImportada(st.id, nome); E.aviso('🗑 Animação "' + nome + '" apagada.' + (FF.Edicoes.conectado() ? ' Enviando para todos os aparelhos…' : ' (só neste aparelho até conectar o ☁)'), 'ok'); }
    else if (criada) FF.Mods.restaurar(st.id, nome);
    else FF.Mods.apagar(st.id, nome);
    if (!doImportado) E.aviso('🗑 Animação "' + nome + '" apagada.' + (FF.Edicoes.conectado() ? ' Enviando para todos os aparelhos…' : ' (só neste aparelho até conectar o ☁)'), 'ok');
    E.renderSync();
    if (nome === st.nome) { E.rascunho.gravar(RASC, null); st.anim = null; st.novo = false; renderSprites(); return abrirAnim(Object.keys(def.anims)[0], { forcar: true }); }
    renderSprites(); renderAnims();
  }

  // dá para renomear o que é seu (sprite importado ou animação criada por você); as originais do jogo, não
  function podeRenomear(nome) {
    const ns = (FF.Edicoes.dados().spritesNovos || {})[st.id];
    return !!((ns && ns.anims && ns.anims[nome]) || FF.Mods.criada(st.id, nome));
  }
  async function renomearAnim(nome) {
    if (!podeRenomear(nome)) return E.aviso('Animações originais do jogo não podem ser renomeadas (os golpes usam o nome). Use “Salvar como nova…”.', 'erro');
    if (sujo() && !(await podeTrocar())) return;
    let n = await E.perguntar('Aa Renomear animação', 'Novo nome para "' + nome + '" (golpes que usam o nome antigo precisam ser ajustados):', nome);
    if (n == null) return;
    n = n.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!n || n === nome) return;
    if (st.set.def.anims[n]) return E.aviso('Já existe uma animação "' + n + '" neste sprite.', 'erro');
    const ns = (FF.Edicoes.dados().spritesNovos || {})[st.id];
    if (ns && ns.anims && ns.anims[nome]) {
      const def = copia(ns), novo = {};
      Object.keys(def.anims).forEach(k => { novo[k === nome ? n : k] = def.anims[k]; });   // mantém a ordem
      def.anims = novo;
      if (FF.Mods.alterada(st.id, nome)) FF.Edicoes.set(['sprites', st.id, nome], null);
      E.salvarNoJogo(['spritesNovos', st.id], def, 'Aa "' + nome + '" agora é "' + n + '".');
    } else {
      FF.Mods.salvar(st.id, n, limpa(st.set.def.anims[nome]));
      FF.Mods.restaurar(st.id, nome);
      E.aviso('Aa "' + nome + '" agora é "' + n + '".', 'ok');
      E.renderSync();
    }
    E.rascunho.gravar(RASC, null);
    FF.Assets.descarregarSprite(st.id);
    await abrirSprite(st.id, nome === st.nome ? n : st.nome, true);
  }

  function restaurarApagada(nome) {
    FF.Mods.restaurar(st.id, nome);
    E.aviso('↺ "' + nome + '" voltou.' + (FF.Edicoes.conectado() ? ' Enviando…' : ''), 'ok');
    E.renderSync();
    renderSprites(); renderAnims();
  }

  async function abrirAnim(nome, opts = {}) {
    if (!opts.forcar && nome === st.nome && !opts.anim) return;
    if (!opts.forcar && !(await podeTrocar())) return;
    const base = opts.anim || (st.set.def.anims[nome] ? limpa(st.set.def.anims[nome]) : limpa({ frames: [] }));
    st.nome = nome;
    st.novo = !!opts.novo || !st.set.def.anims[nome];
    st.i = 0; st.sel = new Set([0]); st.ancora = 0; st.t = 0;
    pausar();
    if (opts.anim && st.set.def.anims[nome] && !opts.novo) {
      // rascunho recuperado: o histórico começa na versão salva para dar para desfazer
      st.anim = limpa(st.set.def.anims[nome]); hist.zerar('Abrir'); st.anim = limpa(base); hist.marcar('Rascunho recuperado');
    } else { st.anim = limpa(base); hist.zerar('Abrir ' + nome); }
    if (opts.novo && opts.anim) hist.marcar('Nova animação');
    corrigirSel();
    E.rascunho.gravar(ULT, { id: st.id, nome });
    gravarRascunho();
    enquadrar();
    tudo();
    const s = ui.anims.querySelector('.es-item.sel');
    if (s) { const L = ui.anims; if (s.offsetTop < L.scrollTop || s.offsetTop + s.offsetHeight > L.scrollTop + L.clientHeight) L.scrollTop = s.offsetTop - L.clientHeight / 3; }
  }

  // ------------------------------------------------------------------ renderização da interface
  function tudo() { renderAnims(); renderTira(); renderProps(); renderCtr(); renderTitulo(); }
  function renderTitulo() {
    if (!ui.titulo) return;
    const d = sujo();
    ui.titulo.innerHTML = '';
    const b = el('b'); b.textContent = st.id + ' / ' + (st.nome || '—');
    ui.titulo.append(b);
    if (st.novo) ui.titulo.append(el('span', 'ess-tag', 'nova'));
    else if (FF.Mods.alterada(st.id, st.nome)) ui.titulo.append(el('span', 'ess-tag alt', '✎ alterada'));
    if (d) ui.titulo.append(el('span', 'ess-sujo', '● não salvo'));
    ui.btSalvar.disabled = !d || !frames().length;
    ui.btBaixar.disabled = !frames().length;
    ui.btTrazer.disabled = !st.anim;
    ui.btOrig.disabled = !d && !FF.Mods.alterada(st.id, st.nome);
    if (ui.btApagar) ui.btApagar.disabled = !st.nome;
  }
  function renderModos() { for (const [m, b] of Object.entries(ui.modos)) b.classList.toggle('sel', m === st.modo); ui.palcoWrap.dataset.modo = st.modo; renderProps(); }
  function renderCtr() {
    ui.btPlay.textContent = st.tocando ? '⏸' : '▶';
    ui.btRep.classList.toggle('on', st.repetir);
    ui.btEsp.classList.toggle('on', st.espelho);
    ui.btMulti.classList.toggle('on', st.multi);
  }

  function renderTira() {
    const fr = frames();
    ui.tira.innerHTML = '';
    if (!fr.length) { ui.tira.appendChild(el('div', 'es-vazio', 'Animação sem quadros — use “＋ Inserir quadros…”.')); return; }
    const [mw, mh] = maiores(fr);
    fr.forEach((f, k) => {
      const c = el('div', 'ess-q' + (st.sel.has(k) ? ' sel' : '') + (k === st.i ? ' atual' : ''));
      c.dataset.k = k;
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
      mini(cv, st.set, f, mw, mh);
      const r = el('span', 'ess-q-rot');
      r.textContent = (k + 1) + ((f[7] || 1) !== 1 ? ' ×' + f[7] : '');
      c.append(cv, r);
      if (f[8] && f[8][0]) c.appendChild(el('span', 'ess-q-alvo', '🎯'));
      if (st.anim.loop && (st.anim.repeatTo || 0) === k && k > 0) { const t = el('span', 'ess-q-rep', '↩'); t.title = 'Repete a partir daqui'; c.appendChild(t); }
      ui.tira.appendChild(c);
    });
    ui.tira.appendChild(ui.marca);
  }
  function marcarAtualNaTira() {
    ui.tira.querySelectorAll('.ess-q').forEach(c => { const k = +c.dataset.k; c.classList.toggle('atual', k === st.i); c.classList.toggle('sel', st.sel.has(k)); });
    const a = ui.tira.querySelector('.ess-q.atual');
    if (a && st.tocando) { const t = ui.tira; if (a.offsetLeft < t.scrollLeft || a.offsetLeft + a.offsetWidth > t.scrollLeft + t.clientWidth) t.scrollLeft = a.offsetLeft - 20; }
  }

  function renderProps() {
    const p = ui.props;
    if (!p || !st.set) return;
    if (p.contains(document.activeElement) && document.activeElement.tagName === 'INPUT' && document.activeElement.type !== 'checkbox') return;
    p.innerHTML = '';
    if (!st.anim) { p.appendChild(grupoSprite()); return; }
    const a = st.anim, fr = frames(), esc = escolhidos(), f = fr[st.i];
    if (st.modo === 'cortar') p.appendChild(grupoCorte());
    // animação
    const gA = E.grupo('🎞 Animação');
    const tot = fr.reduce((s, q) => s + (q[7] || 1), 0) / fpsDe(a);
    gA.appendChild(el('div', 'es-dica', fr.length + ' quadro(s) · ' + tot.toFixed(2).replace('.', ',') + ' s' + (a.fps ? '' : ' (fps 0 = manual; a prévia usa 10)')));
    gA.appendChild(E.campo('numero', 'fps', a.fps, (v, vivo) => { a.fps = Math.max(0, Math.min(120, v || 0)); mudou('Mudar fps', true, vivo); }, { passo: 1, min: 0, max: 120, dica: 'Quadros por segundo' }));
    gA.appendChild(E.campo('check', 'Repetir (loop)', a.loop, (v) => { a.loop = v; mudou(v ? 'Ligar loop' : 'Desligar loop'); renderProps(); }, { dica: 'No jogo, a animação recomeça ao terminar' }));
    if (a.loop) gA.appendChild(E.campo('numero', 'Repetir do quadro', (a.repeatTo || 0) + 1, (v, vivo) => { a.repeatTo = limitar(Math.round(v || 1) - 1, 0, Math.max(0, fr.length - 1)); mudou('Repetir a partir do quadro', true, vivo); }, { passo: 1, min: 1, max: fr.length, dica: 'Ao repetir, volta para este quadro (1 = começo)' }));
    p.appendChild(gA);

    // quadro(s)
    if (f) {
      const multi = esc.length > 1;
      const gQ = E.grupo(multi ? '🖼 ' + esc.length + ' quadros escolhidos' : '🖼 Quadro ' + (st.i + 1) + ' de ' + fr.length);
      gQ.appendChild(E.campo('numero', 'Duração', f[7] || 1, (v, vivo) => { esc.forEach(k => { fr[k][7] = Math.max(0.1, Math.min(99, v || 1)); }); mudou('Duração do quadro', true, vivo); }, { passo: 1, min: 0.1, dica: 'Em "batidas" de 1/fps (2 = fica o dobro do tempo)' + (multi ? ' — vale para todos os escolhidos' : '') }));
      const ref = [f[5], f[6]];
      gQ.appendChild(E.campo('numero', 'Origem X', f[5], (v, vivo) => { const d = Math.round(v || 0) - ref[0]; ref[0] += d; esc.forEach(k => { fr[k][5] += d; }); mudou('Mover origem', true, vivo); }, { passo: 1, dica: 'Origem (pés) dentro do quadro' + (multi ? ' — a diferença vale para todos os escolhidos' : '') }));
      gQ.appendChild(E.campo('numero', 'Origem Y', f[6], (v, vivo) => { const d = Math.round(v || 0) - ref[1]; ref[1] += d; esc.forEach(k => { fr[k][6] += d; }); mudou('Mover origem', true, vivo); }, { passo: 1 }));
      const sub = el('div', 'es-dica', 'Recorte no atlas' + (multi ? ' (quadro ' + (st.i + 1) + ')' : '') + ':');
      gQ.appendChild(sub);
      const img = st.set.images[f[0]];
      [['X', 1], ['Y', 2], ['Largura', 3], ['Altura', 4]].forEach(([r, k]) => {
        gQ.appendChild(E.campo('numero', r, f[k], (v, vivo) => {
          v = Math.round(v || 0);
          if (k >= 3) v = Math.max(1, v);
          const lim = k === 1 || k === 3 ? img.naturalWidth || img.width : img.naturalHeight || img.height;
          if (k <= 2) v = limitar(v, 0, lim - 1); else v = Math.min(v, lim - f[k - 2]);
          f[k] = v; mudou('Recortar quadro', true, vivo);
        }, { passo: 1, min: k >= 3 ? 1 : 0 }));
      });
      if (st.set.images.length > 1) gQ.appendChild(E.campo('select', 'Atlas', String(f[0]), (v) => { f[0] = +v; mudou('Trocar atlas'); }, { lista: st.set.images.map((_, k) => [String(k), 'Atlas ' + k + ' (' + (st.set.def.atlases[k] || '').split('/').pop() + ')']) }));
      const bl = el('div', 'ess-bts');
      bl.append(E.botao('▦ Separar sheet', () => separarSheet(), 'Este quadro tem vários desenhos (uma folha)? Separa em quadros'));
      bl.append(E.botao('✂ Editor livre', () => editorLivre(), 'Abre os quadros escolhidos como camadas soltas: mover, recortar, esticar, espelhar, duplicar e juntar num quadro só', 'es-bt-ouro'));
      gQ.appendChild(bl);
      if (multi) {
        // mesclar: junta os quadros escolhidos numa imagem só (ex.: dois pedaços de raio = um Kamehameha maior)
        gQ.appendChild(el('div', 'es-dica', '<b>🧩 Mesclar</b> os ' + esc.length + ' escolhidos num quadro só, na ordem da tira:'));
        const mz = st.mesclar || (st.mesclar = { como: 'lado', alinhar: 'centro', igualar: true, espaco: 0, manter: false });
        gQ.appendChild(E.campo('select', 'Como', mz.como, (v) => { mz.como = v; }, { lista: [['lado', '➡ Lado a lado'], ['baixo', '⬇ Um embaixo do outro'], ['sobrepor', '◎ Um em cima do outro']] }));
        gQ.appendChild(E.campo('select', 'Alinhar', mz.alinhar || 'centro', (v) => { mz.alinhar = v; }, { lista: [['centro', 'pelo centro do desenho'], ['topo', 'pelo topo'], ['base', 'pela base'], ['origem', 'pela origem (pés)']], dica: 'Para raios use "pelo centro"' }));
        gQ.appendChild(E.campo('check', 'Mesma grossura', mz.igualar !== false, (v) => { mz.igualar = !!v; }, { dica: 'Estica cada pedaço para ficar da altura do primeiro (lado a lado) ou da largura dele (um embaixo do outro)' }));
        gQ.appendChild(E.campo('numero', 'Espaço (px)', mz.espaco, (v) => { mz.espaco = Math.round(v || 0); }, { passo: 1, dica: 'Distância entre os pedaços. Negativo = encaixa um por cima do outro (esconde a emenda)' }));
        gQ.appendChild(E.campo('check', 'Manter os originais', mz.manter, (v) => { mz.manter = !!v; }, { dica: 'Desligado: os escolhidos viram o quadro mesclado. Ligado: o mesclado entra depois deles.' }));
        const bm = el('div', 'ess-bts');
        bm.append(E.botao('🧩 Mesclar quadros', (ev, b) => mesclar(mz, b), 'Cria o quadro novo (dá para desfazer; salve para valer no jogo)', 'es-bt-ouro'));
        gQ.appendChild(bm);
      }
      p.appendChild(gQ);

      // disparo
      const gD = E.grupo('🎯 Ponto de disparo', !!(f[8] && f[8][0]) || st.modo === 'disparo');
      const pt = f[8] && f[8][0];
      gD.appendChild(el('div', 'es-dica', pt ? 'De onde saem os raios/projéteis neste quadro (relativo à origem).' : 'Este quadro não tem ponto de disparo. Use o modo 🎯 e clique no palco.'));
      if (pt) {
        gD.appendChild(E.campo('numero', 'dx', pt[0], (v, vivo) => { pt[0] = Math.round(v || 0); mudou('Ponto de disparo', true, vivo); }, { passo: 1 }));
        gD.appendChild(E.campo('numero', 'dy', pt[1], (v, vivo) => { pt[1] = Math.round(v || 0); mudou('Ponto de disparo', true, vivo); }, { passo: 1 }));
      }
      const bd = el('div', 'ess-bts');
      bd.append(E.botao('🎯 Marcar no palco', () => { st.modo = 'disparo'; renderModos(); }, 'Ativa o modo disparo'),
        E.botao('🗑 Apagar ponto', () => apagarDisparo(), 'Apaga o ponto de disparo dos quadros escolhidos'));
      if (pt && fr.length > 1) bd.append(E.botao('Copiar p/ escolhidos', () => { esc.forEach(k => { if (k !== st.i) { fr[k][8] = fr[k][8] || []; fr[k][8][0] = pt.slice(); } }); mudou('Copiar ponto de disparo'); renderTira(); }, 'Usa este ponto em todos os quadros escolhidos'));
      gD.appendChild(bd);
      p.appendChild(gD);
    }

    p.appendChild(grupoSprite());

    const gH = E.grupo('⌨ Atalhos', false);
    gH.appendChild(el('div', 'es-dica ess-atalhos', 'Espaço tocar/pausar · vírgula/ponto quadro anterior/próximo · setas movem a origem (Shift = 10 px) · Delete apaga · Ctrl+D duplica · Ctrl+A escolhe todos · Ctrl+S salva · Ctrl+Z/Ctrl+Y desfaz/refaz · roda do mouse = zoom · arrastar quadros na tira reordena.'));
    p.appendChild(gH);
  }

  // depois de cada mudança no documento
  function mudou(rotulo, juntar, vivo) {
    pausar(true);
    hist.marcar(rotulo, juntar);
    gravarRascunho();
    if (vivo) { atualizarTiraLeve(); renderTitulo(); return; }
    renderTira(); renderTitulo();
    if (!juntar) renderProps();
  }
  function atualizarTiraLeve() {
    const fr = frames(); const [mw, mh] = maiores(fr);
    ui.tira.querySelectorAll('.ess-q').forEach(c => { const k = +c.dataset.k; const cv = c.querySelector('canvas'); if (cv && fr[k]) mini(cv, st.set, fr[k], mw, mh); });
  }
  function gravarRascunho() {
    if (!st.anim) return;
    if (sujo()) E.rascunho.gravar(RASC, { id: st.id, nome: st.nome, anim: limpa(st.anim), novo: st.novo, t: Date.now() });
    else E.rascunho.gravar(RASC, null);
  }

  // ------------------------------------------------------------------ reprodução
  function pausar(semRender) { if (st.tocando) { st.tocando = false; if (!semRender && ui.btPlay) renderCtr(); else if (ui.btPlay) ui.btPlay.textContent = '▶'; } }
  function alternar() {
    if (!frames().length) return;
    st.tocando = !st.tocando;
    if (st.tocando && !st.anim.loop && st.i >= frames().length - 1) st.i = 0;
    st.t = 0; st.espera = 0;
    renderCtr();
    if (!st.tocando) { st.sel = new Set([st.i]); marcarAtualNaTira(); renderProps(); }
  }
  function irPara(k) {
    const n = frames().length;
    if (!n) return;
    pausar();
    st.i = limitar(k, 0, n - 1); st.sel = new Set([st.i]); st.ancora = st.i; st.t = 0;
    marcarAtualNaTira(); renderProps();
  }
  function passo(d) { const n = frames().length; if (n) irPara((st.i + d + n) % n); }
  function avancar(dt) {
    const fr = frames();
    if (!st.tocando || !fr.length) return;
    if (st.espera > 0) { st.espera -= dt; if (st.espera <= 0) { st.i = 0; st.t = 0; trocouQuadro(); } return; }
    st.t += dt * st.vel;
    const fps = fpsDe(st.anim);
    let g = 0;
    while (st.t >= (fr[st.i][7] || 1) / fps && g++ < 200) {
      st.t -= (fr[st.i][7] || 1) / fps;
      if (st.i + 1 < fr.length) st.i++;
      else if (st.anim.loop) st.i = limitar(st.anim.repeatTo || 0, 0, fr.length - 1);
      else if (st.repetir) { st.espera = 0.5; break; }
      else { st.tocando = false; renderCtr(); break; }
      trocouQuadro();
    }
  }
  function trocouQuadro() {
    if (st.sel.size <= 1) st.sel = new Set([st.i]);
    marcarAtualNaTira();
    if (!ui.props.contains(document.activeElement)) renderProps();
  }

  // ------------------------------------------------------------------ edição dos quadros
  function apagar() {
    const esc = escolhidos(), fr = frames();
    if (!esc.length) return;
    const tira = new Set(esc);
    st.anim.frames = fr.filter((_, k) => !tira.has(k));
    st.i = Math.min(esc[0], st.anim.frames.length - 1);
    st.sel = new Set(st.anim.frames.length ? [st.i] : []);
    corrigirSel();
    mudou(esc.length > 1 ? 'Apagar ' + esc.length + ' quadros' : 'Apagar quadro');
  }
  function duplicar() {
    const esc = escolhidos(), fr = frames();
    if (!esc.length) return;
    const ult = esc[esc.length - 1];
    const copias = esc.map(k => copia(fr[k]));
    fr.splice(ult + 1, 0, ...copias);
    st.sel = new Set(copias.map((_, j) => ult + 1 + j));
    st.i = ult + 1;
    mudou(esc.length > 1 ? 'Duplicar ' + esc.length + ' quadros' : 'Duplicar quadro');
  }
  function mover(d) {
    const fr = frames(), esc = escolhidos();
    if (!esc.length) return;
    if ((d < 0 && esc[0] === 0) || (d > 0 && esc[esc.length - 1] === fr.length - 1)) return;
    const ordem = d < 0 ? esc : esc.slice().reverse();
    ordem.forEach(k => { const t = fr[k]; fr[k] = fr[k + d]; fr[k + d] = t; });
    st.sel = new Set(esc.map(k => k + d));
    st.i += d;
    mudou('Mover quadro');
  }
  // move os escolhidos para antes do índice "dest" (0..n)
  function moverPara(dest) {
    const fr = frames(), esc = escolhidos();
    const bloco = esc.map(k => fr[k]);
    const antes = esc.filter(k => k < dest).length;
    const resto = fr.filter((_, k) => !esc.includes(k));
    const pos = limitar(dest - antes, 0, resto.length);
    resto.splice(pos, 0, ...bloco);
    if (JSON.stringify(resto) === JSON.stringify(fr)) return;
    st.anim.frames = resto;
    st.sel = new Set(bloco.map((_, j) => pos + j));
    st.i = pos;
    mudou(bloco.length > 1 ? 'Reordenar ' + bloco.length + ' quadros' : 'Reordenar quadro');
  }
  function inverter() {
    const fr = frames(), esc = escolhidos();
    if (fr.length < 2) return;
    if (esc.length > 1) { const inv = esc.map(k => fr[k]).reverse(); esc.forEach((k, j) => { fr[k] = inv[j]; }); mudou('Inverter escolhidos'); }
    else { fr.reverse(); st.i = fr.length - 1 - st.i; st.sel = new Set([st.i]); mudou('Inverter ordem'); }
  }
  function apagarDisparo() {
    const fr = frames();
    let n = 0;
    escolhidos().forEach(k => { const f = fr[k]; if (f[8] && f[8].length) { f[8].splice(0, 1); n++; if (!f[8].length) f.length = 8; } });
    if (n) mudou('Apagar ponto de disparo'); else E.aviso('Nenhum dos quadros escolhidos tem ponto de disparo.');
  }
  function inserirQuadros(lista) {
    if (!lista.length) return;
    const fr = frames();
    const pos = fr.length ? st.i + 1 : 0;
    fr.splice(pos, 0, ...lista.map(copia));
    st.i = pos + lista.length - 1;
    st.sel = new Set(lista.map((_, j) => pos + j));
    mudou(lista.length > 1 ? 'Inserir ' + lista.length + ' quadros' : 'Inserir quadro');
  }

  function inserirDeOutra() {
    if (!st.anim) return E.aviso('Crie ou escolha uma animação primeiro (＋ Nova).', 'erro');
    const c = el('div', 'ess-ins');
    const topo = el('div', 'ess-ins-topo');
    const busca = document.createElement('input'); busca.type = 'search'; busca.placeholder = 'Buscar animação de ' + st.id + '…';
    const volta = E.botao('← Animações', () => { origem = null; render(); });
    const todos = E.botao('Inserir todos', () => { const a = fonte(origem); inserirQuadros(a.frames); info.textContent = '✅ ' + a.frames.length + ' quadro(s) inseridos.'; }, 'Insere todos os quadros desta animação', 'es-bt-ouro');
    const info = el('span', 'es-dica');
    topo.append(volta, busca, todos, info);
    const grade = el('div', 'es-grade ess-ins-grade');
    c.append(topo, grade);
    let origem = null;
    const fonte = (n) => (n === st.nome ? st.anim : st.set.def.anims[n]);
    function render() {
      grade.innerHTML = '';
      volta.hidden = todos.hidden = !origem; busca.hidden = !!origem;
      if (!origem) {
        const f = busca.value.toLowerCase();
        info.textContent = 'Escolha a animação de onde tirar os quadros.';
        const nomes = Object.keys(st.set.def.anims);
        if (st.novo) nomes.unshift(st.nome);
        nomes.filter(n => !f || n.toLowerCase().includes(f)).forEach(n => {
          const a = fonte(n);
          if (!a || !a.frames.length) return;
          const cd = el('div', 'es-cartao');
          cd.dataset.anim = n;
          const cv = document.createElement('canvas'); cv.width = 96; cv.height = 72;
          const [mw, mh] = maiores(a.frames); mini(cv, st.set, a.frames[0], mw, mh);
          const s = el('span'); s.textContent = n + ' (' + a.frames.length + ')'; s.title = n;
          cd.append(cv, s);
          cd.onclick = () => { origem = n; render(); };
          grade.appendChild(cd);
        });
      } else {
        const a = fonte(origem);
        info.textContent = origem + ': clique num quadro para inseri-lo depois do quadro ' + (frames().length ? st.i + 1 : '—') + '.';
        const [mw, mh] = maiores(a.frames);
        a.frames.forEach((q, k) => {
          const cd = el('div', 'es-cartao');
          cd.dataset.k = k;
          const cv = document.createElement('canvas'); cv.width = 96; cv.height = 72;
          mini(cv, st.set, q, mw, mh);
          const s = el('span'); s.textContent = 'Quadro ' + (k + 1);
          cd.append(cv, s);
          cd.onclick = () => { inserirQuadros([q]); cd.classList.add('sel'); info.textContent = '✅ Quadro ' + (k + 1) + ' inserido (agora depois do quadro ' + (st.i + 1) + ').'; };
          grade.appendChild(cd);
        });
      }
    }
    busca.oninput = render;
    E.modal('＋ Inserir quadros de outra animação', c, { larga: true });
    render();
  }

  async function novaAnimacao() {
    const esc = escolhidos();
    const c = el('div', 'ess-nova');
    const nome = document.createElement('input'); nome.placeholder = 'Nome (ex.: Especial_Novo)';
    const temSel = esc.length && frames().length;
    c.innerHTML = '<p>Nome da nova animação do sprite <b></b>:</p>';
    c.querySelector('b').textContent = st.id;
    c.appendChild(nome);
    const bts = el('div', 'ess-conf-bts');
    const criar = (comQuadros) => {
      const n = nome.value.trim().replace(/\s+/g, '_');
      if (!n) { E.aviso('Dê um nome para a animação.', 'erro'); return; }
      if (st.set.def.anims[n]) { E.aviso('Já existe "' + n + '" neste sprite. Escolha outro nome.', 'erro'); return; }
      const fr = comQuadros ? esc.map(k => copia(frames()[k])) : [];
      const a = { fps: st.anim ? st.anim.fps || 12 : 12, loop: false, repeatTo: 0, pingpong: false, frames: fr };
      m.fechar();
      abrirAnim(n, { forcar: true, novo: true, anim: a });
      E.aviso('Animação "' + n + '" criada — salve para ela valer no jogo.');
    };
    bts.append(E.botao('Vazia', () => criar(false), 'Começa sem quadros (insira de outras animações)'));
    if (temSel) bts.append(E.botao('Com os ' + esc.length + ' quadro(s) escolhido(s)', () => criar(true), null, 'es-bt-ouro'));
    c.appendChild(bts);
    if (sujo() && !st.novo) c.appendChild(el('p', 'es-obs', '⚠ As mudanças não salvas em "' + st.nome + '" ficam só no rascunho se você criar outra agora.'));
    nome.onkeydown = (e) => { if (e.key === 'Enter') criar(!!temSel); };
    const m = E.modal('＋ Nova animação', c);
    setTimeout(() => nome.focus(), 30);
  }

  // ⬇ Baixar / ⬆ Trazer de volta (js/estudio/sprites_io.js)
  function ctxIO() {
    return {
      id: st.id, set: st.set, nome: st.nome, anim: st.anim,
      substituir(a, set) {
        pausar();
        if (set) st.set = set;
        st.anim.frames = a.frames; st.anim.fps = a.fps; st.anim.loop = a.loop; st.anim.repeatTo = a.repeatTo;
        corrigirSel();
        mudou('Trazer de volta (' + a.frames.length + ' quadros)');
        enquadrar(); tudo();
        E.aviso('📥 ' + a.frames.length + ' quadro(s) no lugar dos antigos. Salve para valer no jogo (Ctrl+Z desfaz).', 'ok');
      },
      criar(nome, a, set) {
        if (set) st.set = set;
        A().salvarAnim(st.id, nome, a);
        E.renderSync();
        renderSprites();
        abrirAnim(nome, { forcar: true });
        E.aviso('📥 Animação "' + nome + '" criada e salva no jogo.', 'ok');
      },
    };
  }

  // ------------------------------------------------------------------ salvar
  function salvar() {
    if (!frames().length) { E.aviso('A animação não tem quadros.', 'erro'); return; }
    A().salvarAnim(st.id, st.nome, limpa(st.anim));
    st.novo = false;
    E.rascunho.gravar(RASC, null);
    E.aviso('💾 "' + st.nome + '" salva no jogo.' + (FF.Edicoes.conectado() ? ' Enviando para todos os aparelhos…' : ' (só neste aparelho até conectar o ☁)'), 'ok');
    E.renderSync();
    renderSprites(); tudo();
  }
  async function salvarComo() {
    if (!frames().length) { E.aviso('A animação não tem quadros.', 'erro'); return; }
    let n = await E.perguntar('💾 Salvar como nova', 'Nome da nova animação em "' + st.id + '":', st.nome + '_2');
    if (!n) return;
    n = n.trim().replace(/\s+/g, '_');
    if (st.set.def.anims[n] && !(await confirmar('Já existe', '"' + n + '" já existe neste sprite. Substituir?', 'Substituir', true))) return;
    const a = limpa(st.anim);
    A().salvarAnim(st.id, n, a);
    E.rascunho.gravar(RASC, null);
    st.anim = limpa(st.set.def.anims[st.nome] || a);   // a original fica como estava salva
    E.aviso('💾 Salva como "' + n + '".' + (FF.Edicoes.conectado() ? ' Enviando…' : ' (só neste aparelho até conectar o ☁)'), 'ok');
    E.renderSync();
    renderSprites();
    abrirAnim(n, { forcar: true });
  }
  async function original() {
    const alt = FF.Mods.alterada(st.id, st.nome);
    if (!alt) {
      if (!sujo()) return;
      if (!(await confirmar('Descartar mudanças', st.novo ? 'Descartar a animação nova "' + st.nome + '" (não salva)?' : 'Descartar as mudanças não salvas em "' + st.nome + '"?', 'Descartar', true))) return;
      E.rascunho.gravar(RASC, null);
      if (st.novo) { st.anim = null; st.novo = false; abrirAnim(Object.keys(st.set.def.anims)[0], { forcar: true }); }
      else abrirAnim(st.nome, { forcar: true });
      return;
    }
    const criada = FF.Mods.criada(st.id, st.nome);
    if (!(await confirmar('↺ Original', criada ? 'Apagar a animação "' + st.nome + '" (criada por você) do jogo?' : 'Voltar "' + st.nome + '" ao original do jogo? Suas alterações salvas nela serão apagadas.', criada ? 'Apagar' : 'Voltar ao original', true))) return;
    FF.Mods.restaurar(st.id, st.nome);
    E.rascunho.gravar(RASC, null);
    E.aviso(criada ? '🗑 Animação apagada.' : '↺ Voltou ao original.', 'ok');
    E.renderSync();
    renderSprites();
    st.anim = null;
    abrirAnim(st.set.def.anims[st.nome] ? st.nome : Object.keys(st.set.def.anims)[0], { forcar: true });
  }
  function salvarEscala(v) {
    const def = st.set.def;
    if (v != null && !(v > 0)) { E.aviso('Escala inválida.', 'erro'); return; }
    if (!('_escalaOrig' in def)) def._escalaOrig = def.escala;
    if (v == null) { def.escala = def._escalaOrig; if (def.escala === undefined) delete def.escala; delete def._escalaOrig; }
    else def.escala = v;
    // só o campo "escala" (spritesInfo também guarda as imagens extras do sprite)
    E.salvarNoJogo(['spritesInfo', st.id, 'escala'], v == null ? null : v, v == null ? '↺ Escala original de ' + st.id + '.' : '💾 Escala de ' + st.id + ': ' + String(v).replace('.', ',') + '×.');
    renderProps();
  }

  // ------------------------------------------------------------------ tamanho, imagens e o sprite inteiro
  function grupoSprite() {
    const def = st.set.def;
    const orig = ('_escalaOrig' in def) ? def._escalaOrig : def.escala;
    const info = (FF.Edicoes.dados().spritesInfo || {})[st.id] || {};
    const imp = importado();
    const gS = E.grupo('📐 Tamanho e sprite “' + st.id + '”', true);
    gS.appendChild(el('div', 'es-dica', '<b>Escala no jogo</b> (não mexe nos pixels): <b>' + String(escalaSprite()).replace('.', ',') + '×</b>' + (info.escala ? ' (sua; original ' + String(orig || 1).replace('.', ',') + '×)' : ' (original)') + '. Vale para todas as animações deste sprite.'));
    let novaEsc = escalaSprite();
    gS.appendChild(E.campo('numero', 'Escala', novaEsc, (v) => { novaEsc = v; }, { passo: 0.05, min: 0.1, max: 10 }));
    const bs = el('div', 'ess-bts');
    bs.append(E.botao('💾 Salvar escala', () => salvarEscala(novaEsc), 'Grava a escala geral do sprite no jogo', 'es-bt-ouro'));
    if (info.escala) bs.append(E.botao('↺ Escala original', () => salvarEscala(null), 'Volta à escala original'));
    gS.appendChild(bs);
    if (st.anim && frames().length) {
      const n = escolhidos().length, tot = frames().length;
      gS.appendChild(el('div', 'es-dica', '<b>Redimensionar os pixels</b> dos quadros (vizinho mais próximo; origem e disparo acompanham):'));
      let fator = 2, alvo = n > 1 ? 'sel' : 'todos';
      gS.appendChild(E.campo('select', 'Quais', alvo, (v) => { alvo = v; }, { lista: [['todos', 'Todos (' + tot + ')'], ['sel', 'Escolhidos (' + n + ')']] }));
      gS.appendChild(E.campo('select', 'Tamanho', '2', (v) => { fator = +v; }, { lista: [['0.25', '25%'], ['0.5', '50%'], ['0.75', '75%'], ['1.5', '150%'], ['2', '200%'], ['3', '300%'], ['4', '400%']] }));
      const br = el('div', 'ess-bts');
      br.append(E.botao('📐 Redimensionar', (ev, b) => redimensionar(fator, alvo === 'todos', b), 'Cria os quadros no tamanho novo (dá para desfazer; salve para valer no jogo)'));
      gS.appendChild(br);
    }
    const nAtlas = def.atlases.length, extras = imp ? nAtlas - 1 : (info.atlas || []).length;
    gS.appendChild(el('div', 'es-dica', nAtlas + ' imagem(ns) de atlas' + (extras > 0 ? ' (' + extras + ' trazida(s) do computador)' : '') + ' · ' + Object.keys(def.anims).length + ' animações' + (imp ? ' · 📥 sprite importado' : '')));
    const bx = el('div', 'ess-bts');
    if (imp && nAtlas > 1) bx.append(E.botao('🧹 Juntar imagens', (ev, b) => compactar(b), 'Junta todas as imagens do sprite num atlas só (menor e mais rápido de carregar)'));
    if (imp) bx.append(E.botao('🗑 Apagar sprite', () => apagarSprite(st.id), 'Apaga este sprite importado com todas as animações', 'es-bt-perigo'));
    gS.appendChild(bx);
    return gS;
  }

  async function redimensionar(fator, todos, bt) {
    const fr = frames();
    const ks = todos ? fr.map((_, k) => k) : escolhidos();
    if (!ks.length || !(fator > 0) || fator === 1) return;
    pausar();
    // quadros iguais (mesmo recorte) viram uma imagem só
    const chave = (f) => f.slice(0, 5).join(','), unicos = [], idx = new Map();
    let imgs;
    try {
      ks.forEach(k => { const c = chave(fr[k]); if (!idx.has(c)) { idx.set(c, unicos.length); unicos.push(fr[k]); } });
      imgs = unicos.map(f => FF.Imagem.escalar(A().pixelsDoQuadro(st.set, f), fator, false));
    } catch (e) { E.aviso('❌ ' + erroLeitura(e), 'erro'); return; }
    if (bt) bt.disabled = true;
    try {
      const r = await A().adicionarImagens(st.id, imgs);
      st.set = r.set;
      const novos = ks.map(k => fr[k]).map(f => {
        const j = idx.get(chave(f)), p = r.posicoes[j], im = imgs[j];
        const q = [r.indice, p.x, p.y, im.largura, im.altura, Math.round(f[5] * fator), Math.round(f[6] * fator), f[7] || 1];
        if (f[8] && f[8].length) q.push(f[8].map(pt => [Math.round(pt[0] * fator), Math.round(pt[1] * fator)]));
        return q;
      });
      ks.forEach((k, j) => { fr[k] = novos[j]; });
      mudou('Redimensionar ' + Math.round(fator * 100) + '%');
      enquadrar();
      renderProps();
      E.aviso('📐 ' + ks.length + ' quadro(s) em ' + Math.round(fator * 100) + '%. Salve para valer no jogo.', 'ok');
    } catch (e) { E.aviso('❌ ' + e.message, 'erro'); }
    if (bt) bt.disabled = false;
  }

  // ✂ Editor livre (js/estudio/montador.js): monta um quadro novo a partir dos escolhidos
  // ------------------------------------------------------------------ ▦ separar sheet
  // O quadro atual é uma folha (sheet) com vários desenhos: acha cada um (figuras soltas ou grade) e vira quadros
  // novos que apontam para pedaços do MESMO atlas (não grava imagem nenhuma). Resultado: substituir este quadro,
  // criar uma animação nova ou uma animação por linha da folha.
  function separarSheet() {
    if (!st.anim || !frames().length) { E.aviso('Abra uma animação com pelo menos um quadro.', 'erro'); return; }
    pausar();
    const I = FF.Imagem, k0 = st.i, f0 = frames()[k0];
    let img;
    try { img = A().pixelsDoQuadro(st.set, f0); } catch (e) { E.aviso('Não deu para ler os pixels deste quadro (' + e.message + ').', 'erro'); return; }
    const opacoFundo = I.corDeFundo(img)[3] === 255;
    const cfg = Object.assign({ modo: 'auto', juntar: 3, minArea: 16, cols: 0, linhas: 0, margem: 0, espaco: 0, aparar: true, origem: 'linha', fundo: opacoFundo },
      E.rascunho.ler('separar_cfg') || {}, { fundo: opacoFundo });
    const g0 = I.detectarGrade(img);
    if (!cfg.cols || !cfg.linhas) { cfg.cols = g0 ? g0.colunas : 4; cfg.linhas = g0 ? g0.linhas : 1; }
    let caixas = [], fora = new Set();
    const c = el('div', 'ess-sep');
    const lado = el('div', 'ess-sep-lado'), vista = el('div', 'ess-sep-vista');
    const cv = document.createElement('canvas'), info = el('p', 'es-dica');
    vista.append(cv);
    const linhaCampo = (rot, input, dica) => { const d = el('label', 'ess-sep-campo'); d.append(el('span', null, rot), input); if (dica) d.title = dica; return d; };
    const num = (k, min, max, dica) => { const i = document.createElement('input'); i.type = 'number'; i.min = min; i.max = max; i.value = cfg[k]; i.oninput = () => { cfg[k] = Math.max(min, Math.min(max, +i.value || 0)); calcular(); }; return i; };
    const selModo = document.createElement('select');
    [['auto', 'Automático (cada desenho solto)'], ['grade', 'Grade (colunas × linhas)']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; selModo.appendChild(o); });
    selModo.value = cfg.modo;
    const boxAuto = el('div'), boxGrade = el('div');
    boxAuto.append(linhaCampo('Juntar pedaços a até (px)', num('juntar', 0, 40), 'Partes do mesmo desenho separadas por até esta distância viram um quadro só (ex.: faíscas em volta)'),
      linhaCampo('Ignorar menores que (px²)', num('minArea', 1, 5000), 'Sujeirinhas menores que isto não viram quadro'));
    boxGrade.append(linhaCampo('Colunas', num('cols', 1, 200)), linhaCampo('Linhas', num('linhas', 1, 200)),
      linhaCampo('Margem (px)', num('margem', 0, 200), 'Borda em volta da folha'), linhaCampo('Espaço entre células (px)', num('espaco', 0, 200)));
    const ckAparar = document.createElement('input'); ckAparar.type = 'checkbox'; ckAparar.checked = cfg.aparar; ckAparar.onchange = () => { cfg.aparar = ckAparar.checked; calcular(); };
    boxGrade.append(linhaCampo('Recortar a sobra vazia de cada célula', ckAparar));
    if (g0) boxGrade.append(el('p', 'es-dica', 'Grade achada: ' + g0.colunas + ' × ' + g0.linhas + '.'));
    const ckFundo = document.createElement('input'); ckFundo.type = 'checkbox'; ckFundo.checked = cfg.fundo; ckFundo.onchange = () => { cfg.fundo = ckFundo.checked; calcular(); };
    const selOrig = document.createElement('select');
    [['linha', 'Pés alinhados na linha (personagens)'], ['pes', 'Pés de cada quadro (embaixo, no meio)'], ['centro', 'Centro de cada quadro (efeitos)']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; selOrig.appendChild(o); });
    selOrig.value = cfg.origem; selOrig.onchange = () => { cfg.origem = selOrig.value; };
    selModo.onchange = () => { cfg.modo = selModo.value; calcular(); };
    const selZoom = document.createElement('select');
    [['0', 'Ajustar à janela'], ['1', '1×'], ['2', '2×'], ['3', '3×'], ['4', '4×']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; selZoom.appendChild(o); });
    selZoom.value = String(E.rascunho.ler('separar_zoom') || 0);
    selZoom.onchange = () => { E.rascunho.gravar('separar_zoom', +selZoom.value || null); desenhar(); };
    lado.append(linhaCampo('Zoom da prévia', selZoom), linhaCampo('Como separar', selModo), boxAuto, boxGrade,
      linhaCampo('Fundo de cor sólida', ckFundo, 'Liga quando a folha tem fundo pintado (não transparente): a cor da borda é ignorada para achar os desenhos. O fundo continua aparecendo nos quadros.'),
      linhaCampo('Origem dos quadros', selOrig), info);
    // resultado
    const nomeNova = document.createElement('input'); nomeNova.placeholder = 'Nome da animação nova'; nomeNova.value = st.nome + '_sep';
    const bts = el('div', 'ess-sep-bts');
    bts.append(
      E.botao('Substituir este quadro', () => aplicar('substituir'), 'O quadro ' + (k0 + 1) + ' vira os quadros separados, nesta animação (depois é só salvar)', 'es-bt-ouro'),
      E.botao('＋ Nova animação', () => aplicar('nova'), 'Cria uma animação com os quadros separados (com o nome ao lado)'),
      nomeNova,
      E.botao('Uma animação por linha', () => aplicar('linhas'), 'Cada linha da folha vira uma animação (nome_1, nome_2…), já salvas no jogo'));
    lado.append(bts);
    c.append(vista, lado);
    const m = E.modal('▦ Separar sheet — ' + st.id + ' / ' + st.nome + ' (quadro ' + (k0 + 1) + ')', c, { larga: true });

    // linhas da folha: agrupa as caixas pela altura (o centro de cada uma cai dentro da faixa da linha)
    function emLinhas(l) {
      const ord = l.map((b, i) => Object.assign({ i }, b)).sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
      const rows = [];
      ord.forEach(b => {
        const cy = b.y + b.h / 2, r = rows.find(r => cy >= r.y0 && cy <= r.y1);
        if (r) { r.itens.push(b); r.y0 = Math.min(r.y0, b.y); r.y1 = Math.max(r.y1, b.y + b.h); } else rows.push({ y0: b.y, y1: b.y + b.h, itens: [b] });
      });
      rows.sort((a, b) => a.y0 - b.y0);
      rows.forEach(r => r.itens.sort((a, b) => a.x - b.x));
      return rows;
    }
    function calcular() {
      boxAuto.style.display = cfg.modo === 'auto' ? '' : 'none';
      boxGrade.style.display = cfg.modo === 'grade' ? '' : 'none';
      E.rascunho.gravar('separar_cfg', { modo: cfg.modo, juntar: cfg.juntar, minArea: cfg.minArea, margem: cfg.margem, espaco: cfg.espaco, aparar: cfg.aparar, origem: cfg.origem });
      const base = cfg.fundo ? I.removerFundo(img, 'auto', 12) : img;
      let l;
      if (cfg.modo === 'auto') l = I.componentes(base, { juntarDistancia: cfg.juntar, minArea: cfg.minArea });
      else {
        l = I.grade(base, cfg.cols, cfg.linhas, { margem: cfg.margem, espaco: cfg.espaco, ignorarVazios: true });
        if (cfg.aparar) l = l.map(b => { const a = I.aparar(I.recortar(base, b)); return a.largura ? { x: b.x + a.x, y: b.y + a.y, w: a.largura, h: a.altura } : null; }).filter(Boolean);
      }
      // ordem de leitura: linha por linha, da esquerda para a direita
      caixas = [].concat(...emLinhas(l).map(r => r.itens.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }))));
      fora = new Set();
      desenhar();
    }
    let esc = 1;
    function desenhar() {
      const maxW = Math.max(300, Math.min(innerWidth * 0.62, 1000)), maxH = Math.max(240, innerHeight * 0.66);
      esc = +selZoom.value || Math.max(0.1, Math.min(8, maxW / img.largura, maxH / img.altura));
      cv.width = Math.round(img.largura * esc); cv.height = Math.round(img.altura * esc);
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(I.paraCanvas(img), 0, 0, cv.width, cv.height);
      g.lineWidth = 1; g.font = 'bold 11px sans-serif';
      caixas.forEach((b, i) => {
        const x = b.x * esc + 0.5, y = b.y * esc + 0.5, w = b.w * esc - 1, h = b.h * esc - 1, off = fora.has(i);
        g.strokeStyle = off ? 'rgba(160,160,160,0.6)' : '#3cf0ff'; g.setLineDash(off ? [4, 3] : []);
        g.strokeRect(x, y, w, h);
        if (off) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x, y, w, h); }
        g.setLineDash([]); g.fillStyle = off ? '#999' : '#ffd84a';
        g.fillText(String(i + 1), x + 2, y + 11);
      });
      const n = caixas.length - fora.size, rows = emLinhas(caixas.filter((_, i) => !fora.has(i))).length;
      info.textContent = n + ' quadro(s) em ' + rows + ' linha(s)' + (fora.size ? ' · ' + fora.size + ' fora' : '') + '. Clique numa caixa para tirar/pôr de volta.';
    }
    cv.addEventListener('click', (e) => {
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / esc, y = (e.clientY - r.top) / esc;
      let melhor = -1, area = Infinity;
      caixas.forEach((b, i) => { if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h && b.w * b.h < area) { melhor = i; area = b.w * b.h; } });
      if (melhor < 0) return;
      fora.has(melhor) ? fora.delete(melhor) : fora.add(melhor); desenhar();
    });
    // caixa (na folha) → quadro: pedaço do mesmo atlas; origem conforme a escolha
    function quadros(lista) {
      const rows = emLinhas(lista);
      return rows.map(r => r.itens.map(b => {
        const ox = Math.round(b.w / 2);
        const oy = cfg.origem === 'centro' ? Math.round(b.h / 2) : cfg.origem === 'pes' ? b.h : r.y1 - b.y;
        return [f0[0], f0[1] + b.x, f0[2] + b.y, b.w, b.h, ox, oy, 1];
      }));
    }
    function aplicar(como) {
      const lista = caixas.filter((_, i) => !fora.has(i));
      if (lista.length < 1) { E.aviso('Nenhum quadro separado.', 'erro'); return; }
      const porLinha = quadros(lista), todos = [].concat(...porLinha);
      if (como === 'substituir') {
        frames().splice(k0, 1, ...todos);
        st.sel = new Set(todos.map((_, j) => k0 + j)); st.i = k0;
        m.fechar(); mudou('Separar sheet'); tudo();
        E.aviso('▦ Quadro ' + (k0 + 1) + ' separado em ' + todos.length + ' quadros. Salve para valer no jogo.');
        return;
      }
      const baseNome = (nomeNova.value.trim() || st.nome + '_sep').replace(/\s+/g, '_');
      const fps = st.anim.fps || 12;
      if (como === 'nova') {
        if (st.set.def.anims[baseNome]) { E.aviso('Já existe "' + baseNome + '" neste sprite. Escolha outro nome.', 'erro'); return; }
        m.fechar();
        abrirAnim(baseNome, { forcar: true, novo: true, anim: { fps, loop: true, repeatTo: 0, pingpong: false, frames: todos } });
        E.aviso('▦ Animação "' + baseNome + '" com ' + todos.length + ' quadros — salve para ela valer no jogo.');
        return;
      }
      const nomes = porLinha.map((_, j) => baseNome + '_' + (j + 1));
      const repetidos = nomes.filter(n => st.set.def.anims[n]);
      if (repetidos.length) { E.aviso('Já existe(m): ' + repetidos.join(', ') + '. Mude o nome base.', 'erro'); return; }
      porLinha.forEach((fr, j) => A().salvarAnim(st.id, nomes[j], { fps, loop: true, repeatTo: 0, pingpong: false, frames: fr }));
      m.fechar();
      E.renderSync && E.renderSync();
      renderSprites();
      abrirAnim(nomes[0], { forcar: true });
      E.aviso('▦ ' + nomes.length + ' animações criadas e salvas (' + nomes[0] + ' … ' + nomes[nomes.length - 1] + ').', 'ok');
    }
    calcular();
  }

  function editorLivre() {
    if (!st.anim || !frames().length) return;
    pausar();
    const fr = frames(), ks = escolhidos();
    return FF.EstudioMontador.abrir({
      set: st.set, quadros: ks.map(k => fr[k]), todos: fr.slice(),
      aoCriar: async (r, substituir) => {
        const ad = await A().adicionarImagens(st.id, [r.img]);
        st.set = ad.set;
        const p0 = ad.posicoes[0];
        const novo = [ad.indice, p0.x, p0.y, r.img.largura, r.img.altura, r.ox, r.oy, r.dur || 1];
        if (r.pontos && r.pontos.length) novo.push(r.pontos);
        const f2 = frames(), ult = ks[ks.length - 1];
        if (!substituir) { f2.splice(ult + 1, 0, novo); st.i = ult + 1; }
        else { for (let j = ks.length - 1; j >= 1; j--) f2.splice(ks[j], 1); f2[ks[0]] = novo; st.i = ks[0]; }
        st.sel = new Set([st.i]); st.ancora = st.i;
        mudou('Editor livre');
        enquadrar(); renderTira(); renderProps();
        E.aviso('✂ Quadro novo de ' + r.img.largura + '×' + r.img.altura + ' px. Salve para valer no jogo.', 'ok');
      },
    });
  }

  // junta os quadros escolhidos numa imagem nova (lado a lado, empilhados ou sobrepostos).
  // Usa só a parte desenhada de cada quadro (sem a borda transparente) e alinha pelo centro, topo, base ou origem;
  // "mesma grossura" estica cada pedaço para a altura (ou largura) do primeiro.
  async function mesclar(mz, bt) {
    const fr = frames(), ks = escolhidos();
    if (ks.length < 2) return E.aviso('Escolha 2 ou mais quadros (Ctrl + clique na tira).', 'erro');
    pausar();
    const q = ks.map(k => fr[k]), gap = mz.espaco || 0, alin = mz.alinhar || 'centro', como = mz.como || 'lado';
    let ps;
    try {
      ps = q.map(f => {
        const c = document.createElement('canvas'); c.width = Math.max(1, f[3]); c.height = Math.max(1, f[4]);
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(st.set.images[f[0]], f[1], f[2], f[3], f[4], 0, 0, f[3], f[4]);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 < 0) { x0 = 0; y0 = 0; x1 = c.width - 1; y1 = c.height - 1; }
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        return { c, sx: x0, sy: y0, sw: w, sh: h, w, h, ox: f[5] - x0, oy: f[6] - y0, f };
      });
    } catch (e) { E.aviso('❌ ' + erroLeitura(e), 'erro'); return; }
    // mesma grossura
    if (mz.igualar && como !== 'sobrepor') ps.forEach((p, j) => {
      if (!j) return;
      const k = como === 'lado' ? ps[0].h / p.h : ps[0].w / p.w;
      p.w = Math.max(1, Math.round(p.w * k)); p.h = Math.max(1, Math.round(p.h * k)); p.ox *= k; p.oy *= k; p.k = k;
    });
    // ponto de alinhamento de cada pedaço no eixo cruzado
    const ancora = (p, eixo) => { const t = eixo === 'y' ? p.h : p.w, o = eixo === 'y' ? p.oy : p.ox; return alin === 'topo' ? 0 : alin === 'base' ? t : alin === 'origem' ? o : t / 2; };
    let pos;
    if (como === 'lado') {
      const A = Math.max(...ps.map(p => ancora(p, 'y'))); let x = 0;
      pos = ps.map(p => { const r = [x, Math.round(A - ancora(p, 'y'))]; x += p.w + gap; return r; });
    } else if (como === 'baixo') {
      const A = Math.max(...ps.map(p => ancora(p, 'x'))); let y = 0;
      pos = ps.map(p => { const r = [Math.round(A - ancora(p, 'x')), y]; y += p.h + gap; return r; });
    } else {
      const Ax = Math.max(...ps.map(p => alin === 'origem' ? p.ox : p.w / 2)), Ay = Math.max(...ps.map(p => ancora(p, 'y')));
      pos = ps.map(p => [Math.round(Ax - (alin === 'origem' ? p.ox : p.w / 2)), Math.round(Ay - ancora(p, 'y'))]);
    }
    const minX = Math.min(...pos.map(p => p[0])), minY = Math.min(...pos.map(p => p[1]));
    pos = pos.map(p => [p[0] - minX, p[1] - minY]);
    const W = Math.max(...ps.map((p, j) => pos[j][0] + p.w)), H = Math.max(...ps.map((p, j) => pos[j][1] + p.h));
    if (W > 2048 || H > 2048) return E.aviso('O quadro mesclado ficaria com ' + W + '×' + H + ' px (máximo 2048).', 'erro');
    const ox = Math.round(pos[0][0] + ps[0].ox), oy = Math.round(pos[0][1] + ps[0].oy);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = false;
    ps.forEach((p, j) => g.drawImage(p.c, p.sx, p.sy, p.sw, p.sh, pos[j][0], pos[j][1], p.w, p.h));
    const img = FF.Imagem.deCanvas(c);
    if (bt) bt.disabled = true;
    try {
      const r = await A().adicionarImagens(st.id, [img]);
      st.set = r.set;
      const p0 = r.posicoes[0];
      const novo = [r.indice, p0.x, p0.y, W, H, ox, oy, q[0][7] || 1];
      // ponto de disparo: o do primeiro quadro que tiver (relativo à origem, então acompanha)
      const jp = ps.findIndex(p => p.f[8] && p.f[8].length);
      if (jp >= 0) {
        const p = ps[jp], k = p.k || 1, oxj = pos[jp][0] + p.ox, oyj = pos[jp][1] + p.oy;
        novo.push(p.f[8].map(pt => [Math.round(oxj + pt[0] * k - ox), Math.round(oyj + pt[1] * k - oy)]));
      }
      const ult = ks[ks.length - 1];
      if (mz.manter) { fr.splice(ult + 1, 0, novo); st.i = ult + 1; }
      else { for (let j = ks.length - 1; j >= 1; j--) fr.splice(ks[j], 1); fr[ks[0]] = novo; st.i = ks[0]; }
      st.sel = new Set([st.i]); st.ancora = st.i;
      mudou('Mesclar ' + ks.length + ' quadros');
      enquadrar();
      renderTira();
      renderProps();
      E.aviso('🧩 Quadro mesclado de ' + W + '×' + H + ' px. Salve para valer no jogo.', 'ok');
    } catch (e) { E.aviso('❌ ' + e.message, 'erro'); }
    if (bt) bt.disabled = false;
  }

  // sprite importado: junta todas as imagens (atlas extras) num atlas só
  async function compactar(bt) {
    if (!importado()) return;
    if (sujo() && !(await podeTrocar())) return;
    const I = FF.Imagem, imp = A();
    if (bt) bt.disabled = true;
    try {
      const imgs = st.set.images.map(im => { const c = document.createElement('canvas'); c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height; c.getContext('2d', { willReadFrequently: true }).drawImage(im, 0, 0); return I.deCanvas(c); });
      const anims = imp.quadrosDoSprite({ anims: st.set.def.anims }, imgs);
      const atual = (FF.Edicoes.dados().spritesNovos || {})[st.id], extra = {};
      ['escala', 'tipo', 'nome'].forEach(k => { if (atual[k] !== undefined) extra[k] = atual[k]; });
      Object.keys(FF.Mods.ler()[st.id] || {}).forEach(n => FF.Edicoes.set(['sprites', st.id, n], null));   // já entram no atlas novo
      const r = await imp.gravarSprite(st.id, anims, extra);
      E.aviso('🧹 Imagens juntadas: atlas de ' + r.pk.largura + '×' + r.pk.altura + ' px.', 'ok');
      await abrirSprite(st.id, st.nome, true);
    } catch (e) { E.aviso('❌ ' + erroLeitura(e), 'erro'); }
    if (bt) bt.disabled = false;
  }

  async function apagarSprite(id, semPerguntar) {
    if (!importado(id)) return E.aviso('Só dá para apagar sprites importados (os do jogo original ficam).', 'erro');
    if (!semPerguntar && !(await confirmar('🗑 Apagar sprite', 'Apagar o sprite importado "' + id + '" com todas as animações, em todos os aparelhos? Personagens e golpes que usam ele vão ficar sem imagem.', '🗑 Apagar sprite', true))) return;
    if (id === st.id) { E.rascunho.gravar(RASC, null); st.anim = null; st.novo = false; }
    Object.keys(FF.Mods.ler()[id] || {}).forEach(n => FF.Edicoes.set(['sprites', id, n], null));
    if ((FF.Edicoes.dados().spritesInfo || {})[id]) FF.Edicoes.set(['spritesInfo', id], null);
    E.salvarNoJogo(['spritesNovos', id], null, '🗑 Sprite "' + id + '" apagado.');
    FF.Assets.descarregarSprite(id);
    if (id === st.id) return abrirSprite(FF.Assets.listaSprites()[0], null, true);
    renderSprites();
  }

  // ------------------------------------------------------------------ palco
  function ajustarCanvas() {
    const r = ui.palcoWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(10, Math.floor(r.width)), h = Math.max(10, Math.floor(r.height));
    ui.cv.style.width = w + 'px'; ui.cv.style.height = h + 'px';
    ui.cv.width = Math.round(w * dpr); ui.cv.height = Math.round(h * dpr);
    ui.W = w; ui.H = h; ui.dpr = dpr;
  }
  function ez() { return st.zoom * (st.usarEscala ? escalaSprite() : 1); }
  function sinal() { return st.espelho && st.modo !== 'caixa' ? -1 : 1; }
  function centro() { return [ui.W / 2 + st.panX, ui.H * 0.62 + st.panY]; }
  function telaParaMundo(sx, sy) { const [cx, cy] = centro(), z = ez(); return [(sx - cx) / (z * sinal()), (sy - cy) / z]; }
  function mundoParaTela(wx, wy) { const [cx, cy] = centro(), z = ez(); return [cx + wx * z * sinal(), cy + wy * z]; }
  function zoomEm(fator, sx, sy) {
    const novo = limitar(st.zoom * fator, 0.25, 24);
    if (sx != null) { const [cx, cy] = centro(); const k = novo / st.zoom; st.panX += (sx - cx) * (1 - k); st.panY += (sy - cy) * (1 - k); }
    st.zoom = novo;
  }
  function enquadrar() {
    if (!ui.W) ajustarCanvas();
    const fr = frames();
    if (!fr.length) { st.zoom = 3; st.panX = st.panY = 0; return; }
    let l = 0, r = 0, t = 0, b = 0;
    fr.forEach(f => { l = Math.max(l, f[5]); r = Math.max(r, f[3] - f[5]); t = Math.max(t, f[6]); b = Math.max(b, f[4] - f[6]); });
    const e = st.usarEscala ? escalaSprite() : 1;
    const z = Math.min((ui.W - 40) / ((l + r) * e), (ui.H - 40) / ((t + b) * e));
    st.zoom = limitar(Math.floor(z * 4) / 4 || 0.25, 0.25, 12);
    // centraliza a caixa que cobre todos os quadros
    st.panX = -((r - l) / 2) * st.zoom * e;
    st.panY = (ui.H / 2 - ui.H * 0.62) - ((b - t) / 2) * st.zoom * e;
  }

  let xadrez = null;
  function desenharFundo(ctx) {
    const W = ui.W, H = ui.H;
    if (st.fundo === 'xadrez') {
      if (!xadrez) {
        const c = document.createElement('canvas'); c.width = c.height = 16;
        const x = c.getContext('2d'); x.fillStyle = '#2b2442'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#1e1931'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8);
        xadrez = ctx.createPattern(c, 'repeat');
      }
      ctx.fillStyle = xadrez; ctx.fillRect(0, 0, W, H);
    } else if (st.fundo === 'claro') { ctx.fillStyle = '#d9d4e6'; ctx.fillRect(0, 0, W, H); }
    else if (st.fundo === 'cenario' && FF.Assets.sprites.stage_campo) {
      const cen = FF.Assets.sprites.stage_campo, ceu = cen.anim('ceu').frames[0], chao = cen.anim('chao').frames[0];
      const s = Math.max(W / ceu[3], H / ceu[4]);
      ctx.drawImage(cen.images[ceu[0]], ceu[1], ceu[2], ceu[3], ceu[4], (W - ceu[3] * s) / 2, (H - ceu[4] * s) / 2, ceu[3] * s, ceu[4] * s);
      const [cx, cy] = centro(), z = st.zoom;
      const w = chao[3] * z, h = chao[4] * z;
      for (let x = cx - chao[5] * z - Math.ceil((cx) / w + 1) * w; x < W; x += w) ctx.drawImage(cen.images[chao[0]], chao[1], chao[2], chao[3], chao[4], x, cy - 4 * z, w, h);
    } else { ctx.fillStyle = '#07040e'; ctx.fillRect(0, 0, W, H); }
  }

  function desenharPalco() {
    if (!ui.cv || !ui.W) return;
    const ctx = ui.cv.getContext('2d');
    ctx.setTransform(ui.dpr, 0, 0, ui.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    desenharFundo(ctx);
    const fr = frames(), f = fr[st.i], z = ez(), s = sinal(), flip = s < 0;
    const [cx, cy] = centro();
    const claro = st.fundo === 'claro';
    // grade
    if (st.grade) {
      const passoG = z >= 6 ? 1 : z >= 3 ? 4 : z >= 1.5 ? 8 : 16;
      ctx.strokeStyle = claro ? 'rgba(40,20,80,0.15)' : 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
      ctx.beginPath();
      const p = passoG * z;
      for (let x = ((cx % p) + p) % p; x < ui.W; x += p) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, ui.H); }
      for (let y = ((cy % p) + p) % p; y < ui.H; y += p) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(ui.W, Math.round(y) + 0.5); }
      ctx.stroke();
    }
    // linha do chão
    ctx.strokeStyle = claro ? 'rgba(120,40,40,0.35)' : 'rgba(255,90,90,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, Math.round(cy) + 0.5); ctx.lineTo(ui.W, Math.round(cy) + 0.5); ctx.stroke();
    if (f) {
      // modo recorte: atlas inteiro em volta (apagado)
      if (st.modo === 'caixa') {
        const img = st.set.images[f[0]];
        ctx.globalAlpha = 0.35;
        ctx.drawImage(img, cx + (-f[1] - f[5]) * z, cy + (-f[2] - f[6]) * z, (img.naturalWidth || img.width) * z, (img.naturalHeight || img.height) * z);
        ctx.globalAlpha = 1;
      }
      if (st.cebola && fr.length > 1) {
        const ant = st.i > 0 ? fr[st.i - 1] : (st.anim.loop ? fr[fr.length - 1] : null);
        const prox = st.i < fr.length - 1 ? fr[st.i + 1] : (st.anim.loop ? fr[st.anim.repeatTo || 0] : null);
        if (ant) FF.drawFrame(ctx, st.set, ant, cx, cy, z, flip, { tint: 'rgba(255,70,90,0.55)', alpha: 0.4 });
        if (prox) FF.drawFrame(ctx, st.set, prox, cx, cy, z, flip, { tint: 'rgba(80,150,255,0.55)', alpha: 0.4 });
      }
      FF.drawFrame(ctx, st.set, f, cx, cy, z, flip);
      // caixa do quadro
      const [x0, y0] = mundoParaTela(flip ? f[3] - f[5] : -f[5], -f[6]);
      const bw = f[3] * z, bh = f[4] * z;
      if (st.caixa || st.modo === 'caixa') {
        ctx.strokeStyle = st.modo === 'caixa' ? '#6cc8ff' : 'rgba(108,200,255,0.6)'; ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(bw), Math.round(bh));
      }
      if (st.modo === 'caixa') {
        ctx.fillStyle = '#6cc8ff';
        alcas(f).forEach(([, hx, hy]) => ctx.fillRect(hx - 4, hy - 4, 8, 8));
      }
      // escolhidos (vários): contorno dos outros
      // ponto de disparo
      const pt = f[8] && f[8][0];
      if (pt && (st.pontos || st.modo === 'disparo')) {
        const [px, py] = mundoParaTela(pt[0], pt[1]);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.stroke();
        ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(px, py, 5, 0, 7); ctx.fill();
        ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px - 12, py); ctx.lineTo(px + 12, py); ctx.moveTo(px, py - 12); ctx.lineTo(px, py + 12); ctx.stroke();
        ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#000'; ctx.fillText('disparo', px + 9, py - 7); ctx.fillStyle = '#ffd84a'; ctx.fillText('disparo', px + 8, py - 8);
      }
    }
    if (st.modo === 'cortar') desenharCorte(ctx, flip, z);
    // origem (pés)
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx - 9, cy); ctx.lineTo(cx + 9, cy); ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy + 9); ctx.stroke();
    ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.stroke();
    // texto
    if (f) {
      const pt = f[8] && f[8][0];
      ui.info.textContent = 'quadro ' + (st.i + 1) + '/' + fr.length + ' · dur ' + (f[7] || 1) + ' · origem ' + f[5] + ',' + f[6] + ' · recorte ' + f[1] + ',' + f[2] + ' ' + f[3] + '×' + f[4] +
        (pt ? ' · disparo ' + pt[0] + ',' + pt[1] : '') + ' · zoom ' + String(+st.zoom.toFixed(2)).replace('.', ',') + '×' + (st.usarEscala && escalaSprite() !== 1 ? ' (escala ' + escalaSprite() + ')' : '');
    } else ui.info.textContent = 'sem quadros';
    if (ui.tempo) {
      let t = 0; for (let k = 0; k < st.i; k++) t += (fr[k][7] || 1); t = t / fpsDe(st.anim) + (st.tocando ? st.t : 0);
      const tot = fr.reduce((s2, q) => s2 + (q[7] || 1), 0) / fpsDe(st.anim);
      ui.tempo.textContent = t.toFixed(2).replace('.', ',') + ' / ' + tot.toFixed(2).replace('.', ',') + ' s';
    }
  }
  // modo ✂ Cortar: os quadros escolhidos sobrepostos (para ver o pedaço em todos) e o retângulo do corte
  function desenharCorte(ctx, flip, z) {
    const [cx, cy] = centro();
    const fr = frames();
    escolhidos().forEach(k => { if (k !== st.i && fr[k]) FF.drawFrame(ctx, st.set, fr[k], cx, cy, z, flip, { alpha: 0.25 }); });
    const c = st.corte;
    if (!c) {
      ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#ffd84a';
      ctx.fillText('✂ Arraste no palco para marcar o pedaço que você quer aproveitar', 12, ui.H - 14);
      return;
    }
    const [ax, ay] = mundoParaTela(c.x0, c.y0), [bx, by] = mundoParaTela(c.x1, c.y1);
    const x = Math.min(ax, bx), y = Math.min(ay, by), w = Math.abs(bx - ax), h = Math.abs(by - ay);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, ui.W, y); ctx.fillRect(0, y + h, ui.W, ui.H - y - h); ctx.fillRect(0, y, x, h); ctx.fillRect(x + w, y, ui.W - x - w, h);
    ctx.setLineDash([6, 4]); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
    ctx.setLineDash([]);
    ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#ffd84a';
    ctx.fillText((c.x1 - c.x0) + '×' + (c.y1 - c.y0) + ' px', x + 4, y - 6);
  }

  // recorta um quadro pelo retângulo (coordenadas relativas à origem). origem: 'manter' | 'centro' | 'esquerda'
  function cortarQuadro(f, c, origem) {
    const ix0 = Math.max(-f[5], c.x0), ix1 = Math.min(f[3] - f[5], c.x1);
    const iy0 = Math.max(-f[6], c.y0), iy1 = Math.min(f[4] - f[6], c.y1);
    if (ix1 - ix0 < 1 || iy1 - iy0 < 1) return null;    // o pedaço não aparece neste quadro
    const ow = origem === 'centro' ? [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2] : origem === 'esquerda' ? [c.x0, (c.y0 + c.y1) / 2] : [0, 0];
    const n = [f[0], f[1] + (ix0 + f[5]), f[2] + (iy0 + f[6]), ix1 - ix0, iy1 - iy0, Math.round(ow[0] - ix0), Math.round(ow[1] - iy0), f[7] || 1];
    if (f[8] && f[8].length) n.push(f[8].map(p => [Math.round(p[0] - ow[0]), Math.round(p[1] - ow[1])]));
    return n;
  }

  async function aplicarCorte(comoNova, origem) {
    const c = st.corte;
    if (!c) return E.aviso('Marque o pedaço no palco primeiro (arraste um retângulo).', 'erro');
    const ks = escolhidos(), fr = frames();
    const novos = [];
    ks.forEach(k => { const q = cortarQuadro(fr[k], c, origem); if (q) novos.push({ k, q }); });
    if (!novos.length) return E.aviso('O retângulo não pega nenhum desenho dos quadros escolhidos.', 'erro');
    if (comoNova) {
      let n = await E.perguntar('✂ Nova animação com o recorte', 'Nome da animação nova em "' + st.id + '" (' + novos.length + ' quadro(s)):', (st.nome || 'Recorte') + '_Recorte');
      if (!n) return;
      n = n.trim().replace(/\s+/g, '_');
      if (st.set.def.anims[n]) return E.aviso('Já existe "' + n + '" neste sprite. Escolha outro nome.', 'erro');
      const a = { fps: st.anim.fps || 12, loop: !!st.anim.loop, repeatTo: 0, pingpong: false, frames: novos.map(x => x.q) };
      st.corte = null; st.modo = 'mover'; renderModos();
      await abrirAnim(n, { forcar: true, novo: true, anim: a });
      E.aviso('✂ "' + n + '" criada com ' + novos.length + ' quadro(s). Confira e use 💾 Salvar no jogo. Ela aparece no seletor de sprites para qualquer golpe.', 'ok');
    } else {
      novos.forEach(x => { fr[x.k] = x.q; });
      st.corte = null;
      mudou('Cortar quadros');
      E.aviso('✂ ' + novos.length + ' quadro(s) cortado(s). Ctrl+Z desfaz.', 'ok');
    }
  }

  function grupoCorte() {
    const g = E.grupo('✂ Cortar um pedaço', true);
    const esc = escolhidos();
    g.appendChild(el('div', 'es-dica', 'Arraste um retângulo no palco em volta do pedaço que quer aproveitar (ex.: só o raio). Ele vale para os ' + esc.length + ' quadro(s) escolhidos na tira (use "Todos" para pegar a animação inteira); os outros escolhidos aparecem apagados por baixo para você conferir.'));
    const c = st.corte;
    if (c) {
      const campo = (k, rot) => E.campo('numero', rot, c[k], (v) => { if (v != null) { c[k] = Math.round(v); if (c.x1 < c.x0) [c.x0, c.x1] = [c.x1, c.x0]; if (c.y1 < c.y0) [c.y0, c.y1] = [c.y1, c.y0]; } }, { passo: 1, dica: 'Pixels a partir da origem (pés) do sprite' });
      g.append(campo('x0', 'Esquerda'), campo('x1', 'Direita'), campo('y0', 'Topo'), campo('y1', 'Base'));
      const og = E.campo('select', 'Nova origem', st.corteOrigem || 'centro', (v) => { st.corteOrigem = v; }, { lista: [['centro', 'centro do recorte (efeito, projétil)'], ['esquerda', 'meio da borda esquerda (raio que sai da mão)'], ['manter', 'manter a do sprite (mesmo lugar)']] });
      g.appendChild(og);
      const bts = el('div', 'ess-conf-bts');
      bts.append(E.botao('✂ Criar animação nova', () => aplicarCorte(true, st.corteOrigem || 'centro'), 'Cria uma animação só com o pedaço (a original fica intacta)', 'es-bt-ouro'),
        E.botao('Cortar aqui mesmo', () => aplicarCorte(false, st.corteOrigem || 'manter'), 'Corta os quadros desta animação (Ctrl+Z desfaz; só vale no jogo ao salvar)'),
        E.botao('Limpar', () => { st.corte = null; renderProps(); }));
      g.appendChild(bts);
    }
    return g;
  }

  // alças do recorte em coordenadas de tela: [nome, x, y]
  function alcas(f) {
    const [x0, y0] = mundoParaTela(-f[5], -f[6]), z = ez();
    const x1 = x0 + f[3] * z, y1 = y0 + f[4] * z, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
    return [['nw', x0, y0], ['n', xm, y0], ['ne', x1, y0], ['e', x1, ym], ['se', x1, y1], ['s', xm, y1], ['sw', x0, y1], ['w', x0, ym]];
  }
  function dentroDoQuadro(f, wx, wy) { return wx >= -f[5] && wx <= f[3] - f[5] && wy >= -f[6] && wy <= f[4] - f[6]; }

  function ligarPalco() {
    const cv = ui.cv;
    const toques = new Map();
    let arr = null;   // arrasto atual
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const [sx, sy] = pos(e); zoomEm(e.deltaY < 0 ? 1.15 : 1 / 1.15, sx, sy); }, { passive: false });
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      const [sx, sy] = pos(e);
      toques.set(e.pointerId, [sx, sy]);
      if (toques.size === 2) {   // pinça: zoom + mover vista
        const [a, b] = [...toques.values()];
        arr = { tipo: 'pinca', d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z0: st.zoom, m0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], p0: [st.panX, st.panY], desfazerPrimeiro: arr };
        if (arr.desfazerPrimeiro && arr.desfazerPrimeiro.tipo !== 'pan') desfazerArrasto(arr.desfazerPrimeiro);
        return;
      }
      const f = frames()[st.i];
      const [wx, wy] = telaParaMundo(sx, sy);
      if (e.button === 1 || e.button === 2 || st.modo === 'mao' || !f) { arr = { tipo: 'pan', s0: [sx, sy], p0: [st.panX, st.panY] }; return; }
      pausar();
      if (st.modo === 'disparo') {
        arr = { tipo: 'disparo', f, antes: copia(f) };
        f[8] = f[8] || []; f[8][0] = [Math.round(wx), Math.round(wy)];
        renderProps();
        return;
      }
      if (st.modo === 'cortar') {
        st.corte = { x0: Math.round(wx), y0: Math.round(wy), x1: Math.round(wx), y1: Math.round(wy) };
        arr = { tipo: 'corte', w0: [Math.round(wx), Math.round(wy)] };
        return;
      }
      if (st.modo === 'caixa') {
        const h = alcas(f).find(([, hx, hy]) => Math.abs(hx - sx) <= 9 && Math.abs(hy - sy) <= 9);
        if (h || dentroDoQuadro(f, wx, wy)) { arr = { tipo: 'caixa', alca: h ? h[0] : 'dentro', w0: [wx, wy], f, antes: copia(f) }; return; }
        arr = { tipo: 'pan', s0: [sx, sy], p0: [st.panX, st.panY] }; return;
      }
      // mover origem: dentro do desenho (ou de qualquer escolhido)
      if (dentroDoQuadro(f, wx, wy)) {
        const ks = escolhidos();
        arr = { tipo: 'origem', w0: [wx, wy], ks, antes: ks.map(k => [frames()[k][5], frames()[k][6]]) };
        return;
      }
      arr = { tipo: 'pan', s0: [sx, sy], p0: [st.panX, st.panY] };
    });
    cv.addEventListener('pointermove', (e) => {
      const [sx, sy] = pos(e);
      if (toques.has(e.pointerId)) toques.set(e.pointerId, [sx, sy]);
      atualizarCursor(sx, sy);
      if (!arr) return;
      if (arr.tipo === 'pinca') {
        if (toques.size < 2) return;
        const [a, b] = [...toques.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        st.zoom = limitar(arr.z0 * d / arr.d0, 0.25, 24);
        st.panX = arr.p0[0] + (m[0] - arr.m0[0]); st.panY = arr.p0[1] + (m[1] - arr.m0[1]);
        return;
      }
      if (arr.tipo === 'pan') { st.panX = arr.p0[0] + sx - arr.s0[0]; st.panY = arr.p0[1] + sy - arr.s0[1]; return; }
      const [wx, wy] = telaParaMundo(sx, sy);
      if (arr.tipo === 'disparo') { arr.f[8][0] = [Math.round(wx), Math.round(wy)]; arr.mexeu = true; return; }
      if (arr.tipo === 'corte') { st.corte = { x0: Math.min(arr.w0[0], Math.round(wx)), y0: Math.min(arr.w0[1], Math.round(wy)), x1: Math.max(arr.w0[0], Math.round(wx)), y1: Math.max(arr.w0[1], Math.round(wy)) }; return; }
      const dx = Math.round(wx - arr.w0[0]), dy = Math.round(wy - arr.w0[1]);
      if (arr.tipo === 'origem') {
        arr.ks.forEach((k, j) => { const q = frames()[k]; q[5] = arr.antes[j][0] - dx; q[6] = arr.antes[j][1] - dy; });
        arr.mexeu = arr.mexeu || dx || dy;
      } else if (arr.tipo === 'caixa') {
        const f = arr.f, a = arr.antes, img = st.set.images[f[0]];
        const IW = img.naturalWidth || img.width, IH = img.naturalHeight || img.height;
        const al = arr.alca;
        let x = a[1], y = a[2], w = a[3], h = a[4];
        if (al === 'dentro') { x = limitar(a[1] + dx, 0, IW - w); y = limitar(a[2] + dy, 0, IH - h); }
        if (al.includes('w')) { x = limitar(a[1] + dx, 0, a[1] + a[3] - 1); w = a[3] + (a[1] - x); }
        if (al.includes('e')) w = limitar(a[3] + dx, 1, IW - a[1]);
        if (al.includes('n')) { y = limitar(a[2] + dy, 0, a[2] + a[4] - 1); h = a[4] + (a[2] - y); }
        if (al.includes('s') && al !== 'dentro') h = limitar(a[4] + dy, 1, IH - a[2]);
        f[1] = x; f[2] = y; f[3] = w; f[4] = h;
        f[5] = a[5] - (x - a[1]); f[6] = a[6] - (y - a[2]);   // o atlas fica parado na tela
        arr.mexeu = true;
      }
    });
    const soltar = (e) => {
      toques.delete(e.pointerId);
      if (!arr) return;
      const a = arr;
      if (a.tipo === 'pinca') { if (toques.size === 0) arr = null; return; }
      arr = null;
      if (a.tipo === 'corte') { if (st.corte && (st.corte.x1 - st.corte.x0 < 2 || st.corte.y1 - st.corte.y0 < 2)) st.corte = null; renderProps(); return; }
      if (a.tipo === 'disparo') mudou('Ponto de disparo');
      else if (a.tipo === 'origem' && a.mexeu) mudou('Mover origem');
      else if (a.tipo === 'caixa' && a.mexeu) mudou('Recortar quadro');
    };
    cv.addEventListener('pointerup', soltar);
    cv.addEventListener('pointercancel', soltar);
    function desfazerArrasto(a) {
      if (a.tipo === 'origem') a.ks.forEach((k, j) => { const q = frames()[k]; if (q) { q[5] = a.antes[j][0]; q[6] = a.antes[j][1]; } });
      else if ((a.tipo === 'caixa' || a.tipo === 'disparo') && a.f) { a.f.length = 0; a.antes.forEach(v => a.f.push(v)); }
    }
    function atualizarCursor(sx, sy) {
      const f = frames()[st.i];
      let c = 'default';
      if (st.modo === 'mao') c = 'grab';
      else if (st.modo === 'disparo' || st.modo === 'cortar') c = 'crosshair';
      else if (f) {
        const [wx, wy] = telaParaMundo(sx, sy);
        if (st.modo === 'caixa') {
          const h = alcas(f).find(([, hx, hy]) => Math.abs(hx - sx) <= 9 && Math.abs(hy - sy) <= 9);
          c = h ? ({ n: 'ns', s: 'ns', e: 'ew', w: 'ew', ne: 'nesw', sw: 'nesw', nw: 'nwse', se: 'nwse' })[h[0]] + '-resize' : dentroDoQuadro(f, wx, wy) ? 'move' : 'grab';
        } else c = dentroDoQuadro(f, wx, wy) ? 'move' : 'grab';
      }
      cv.style.cursor = c;
    }
  }

  // ------------------------------------------------------------------ tira: escolher e arrastar
  function ligarTira() {
    const t = ui.tira;
    let ini = null;
    t.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.ess-q');
      if (!c || e.button !== 0) return;
      ini = { k: +c.dataset.k, x: e.clientX, y: e.clientY, id: e.pointerId, arrastando: false, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, toque: e.pointerType === 'touch' };
    });
    t.addEventListener('pointermove', (e) => {
      if (!ini || e.pointerId !== ini.id || ini.toque) return;
      if (!ini.arrastando && Math.abs(e.clientX - ini.x) + Math.abs(e.clientY - ini.y) > 6) {
        ini.arrastando = true;
        try { t.setPointerCapture(e.pointerId); } catch (x) { /* nada */ }
        if (!st.sel.has(ini.k)) { st.sel = new Set([ini.k]); st.i = ini.k; marcarAtualNaTira(); }
        t.classList.add('arrastando');
      }
      if (ini.arrastando) {
        if (ui.mont) ui.mont.caixa.classList.toggle('alvo', dentro(ui.mont.caixa, e));
        ini.dest = destinoTira(e.clientX);
        const cs = t.querySelectorAll('.ess-q');
        const ref = cs[Math.min(ini.dest, cs.length - 1)];
        if (ref) {
          ui.marca.hidden = false;
          ui.marca.style.left = (ini.dest >= cs.length ? ref.offsetLeft + ref.offsetWidth + 1 : ref.offsetLeft - 3) + 'px';
        }
        // rola a tira perto das bordas
        const r = t.getBoundingClientRect();
        if (e.clientX < r.left + 30) t.scrollLeft -= 12; else if (e.clientX > r.right - 30) t.scrollLeft += 12;
      }
    });
    const fim = (e) => {
      if (!ini || e.pointerId !== ini.id) return;
      const a = ini; ini = null;
      ui.marca.hidden = true; t.classList.remove('arrastando');
      if (a.arrastando) {
        if (ui.mont) ui.mont.caixa.classList.remove('alvo');
        // soltou em cima do painel 🧩 Montar animação: os quadros escolhidos entram na montagem (a tira não muda)
        if (e.type === 'pointerup' && ui.mont && dentro(ui.mont.caixa, e)) { montAdicionar(escolhidos()); return; }
        if (e.type === 'pointerup' && a.dest != null) moverPara(a.dest);
        return;
      }
      if (e.type !== 'pointerup') return;
      clicarQuadro(a.k, a.ctrl || st.multi, a.shift);
    };
    t.addEventListener('pointerup', fim);
    t.addEventListener('pointercancel', fim);
  }
  const dentro = (el, e) => { const r = el.getBoundingClientRect(); return r.width > 0 && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };

  // ------------------------------------------------------------------ 🧩 montar animação (coluna da direita)
  // Monte uma animação nova pegando quadros de qualquer animação do sprite aberto: arraste da tira para o painel
  // (ou escolha na tira e use "＋ Escolhidos"), reordene arrastando, tire com ✕, veja a prévia e salve com um nome.
  // Os quadros apontam para os mesmos pedaços do atlas (nada é recortado nem gravado em imagem). Uma montagem por
  // sprite (st.montagens[id]); fica na memória enquanto o Estúdio estiver aberto.
  function montAtual() { st.montagens = st.montagens || {}; return (st.montagens[st.id] = st.montagens[st.id] || { frames: [], fps: 10, loop: true, sel: -1 }); }
  function montAdicionar(ks) {
    const fr = frames(), m = montAtual();
    const novos = ks.filter(k => fr[k]).map(k => copia(fr[k]));
    if (!novos.length) { E.aviso('Escolha quadros na tira de baixo (clique; Ctrl/Shift para vários).'); return; }
    if (!m.frames.length && st.anim) m.fps = st.anim.fps || m.fps;
    m.frames.push(...novos); m.sel = m.frames.length - 1;
    if (ui.mont && ui.mont.fechado) { ui.mont.fechado = false; E.rascunho.gravar('mont_fechado', null); }
    renderMontagem();
  }
  function montarPainelMontagem(dir) {
    const caixa = el('div', 'ess-mont');
    const cab = el('div', 'es-titulo ess-mont-cab');
    const corpo = el('div', 'ess-mont-corpo');
    caixa.append(cab, corpo);
    dir.appendChild(caixa);
    ui.mont = { caixa, cab, corpo, fechado: !!E.rascunho.ler('mont_fechado'), t: 0, k: 0 };
    cab.onclick = (e) => { if (e.target.closest('button')) return; ui.mont.fechado = !ui.mont.fechado; E.rascunho.gravar('mont_fechado', ui.mont.fechado || null); renderMontagem(); };
    renderMontagem();
  }
  function renderMontagem() {
    const M = ui.mont; if (!M) return;
    const m = st.id ? montAtual() : { frames: [] };
    M.cab.innerHTML = '';
    M.cab.append((M.fechado ? '▸ ' : '▾ ') + '🧩 Montar animação' + (m.frames.length ? ' (' + m.frames.length + ')' : ''));
    M.caixa.classList.toggle('fechado', M.fechado);
    M.corpo.innerHTML = '';
    if (M.fechado || !st.set) return;
    // quadros da montagem
    const lista = el('div', 'ess-mont-lista');
    if (!m.frames.length) lista.appendChild(el('p', 'es-dica', 'Arraste quadros da tira de baixo para cá (um ou vários escolhidos), ou escolha na tira e clique em "＋ Escolhidos". Vale qualquer animação deste sprite.'));
    const [mw, mh] = maiores(m.frames.length ? m.frames : [[0, 0, 0, 1, 1]]);
    let arr = null;
    m.frames.forEach((f, i) => {
      const q = el('div', 'ess-mont-q' + (i === m.sel ? ' sel' : ''));
      const cv = document.createElement('canvas'); cv.width = 52; cv.height = 52;
      mini(cv, st.set, f, mw, mh);
      q.append(cv, el('span', 'ess-mont-n', String(i + 1)));
      const x = E.botao('✕', (e) => { e.stopPropagation(); m.frames.splice(i, 1); m.sel = Math.min(m.sel, m.frames.length - 1); renderMontagem(); }, 'Tirar este quadro da montagem', 'ess-mont-x');
      x.addEventListener('pointerdown', (e) => e.stopPropagation());
      q.appendChild(x);
      q.title = 'Quadro ' + (i + 1) + ' · arraste para mudar a ordem · duplo clique duplica';
      q.addEventListener('dblclick', () => { m.frames.splice(i + 1, 0, copia(f)); m.sel = i + 1; renderMontagem(); });
      // reordenar arrastando dentro do painel
      q.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        arr = { i, x: e.clientX, y: e.clientY, mexeu: false };
        q.setPointerCapture(e.pointerId);
      });
      q.addEventListener('pointermove', (e) => {
        if (!arr) return;
        if (!arr.mexeu && Math.abs(e.clientX - arr.x) + Math.abs(e.clientY - arr.y) > 5) { arr.mexeu = true; q.classList.add('arrastando'); }
        if (!arr.mexeu) return;
        const qs = [...lista.querySelectorAll('.ess-mont-q')];
        let dest = qs.length;
        for (let k = 0; k < qs.length; k++) { const r = qs[k].getBoundingClientRect(); if (e.clientY < r.bottom && e.clientX < r.left + r.width / 2 && e.clientY > r.top - 4) { dest = k; break; } if (e.clientY < r.top) { dest = k; break; } }
        arr.dest = dest;
        qs.forEach((c, k) => c.classList.toggle('antes', k === dest));
      });
      q.addEventListener('pointerup', () => {
        const a = arr; arr = null; q.classList.remove('arrastando');
        if (!a) return;
        if (!a.mexeu) { m.sel = i; M.k = i; M.t = 0; renderMontagem(); return; }
        if (a.dest == null) { renderMontagem(); return; }
        const [it] = m.frames.splice(a.i, 1);
        const d = a.dest > a.i ? a.dest - 1 : a.dest;
        m.frames.splice(d, 0, it); m.sel = d; renderMontagem();
      });
      lista.appendChild(q);
    });
    M.corpo.appendChild(lista);
    // botões
    const bts = el('div', 'ess-mont-bts');
    bts.append(
      E.botao('＋ Escolhidos', () => montAdicionar(escolhidos()), 'Adiciona os quadros escolhidos na tira de baixo (na ordem da tira)', 'es-bt-ouro'),
      E.botao('＋ Todos', () => montAdicionar(frames().map((_, k) => k)), 'Adiciona todos os quadros da animação aberta'),
      E.botao('⇄', () => { m.frames.reverse(); renderMontagem(); }, 'Inverter a ordem'),
      E.botao('Limpar', async () => { if (!m.frames.length || await confirmar('Limpar a montagem', 'Tirar os ' + m.frames.length + ' quadros da montagem?', 'Limpar', true)) { m.frames = []; m.sel = -1; renderMontagem(); } }, 'Esvaziar a montagem'));
    M.corpo.appendChild(bts);
    if (!m.frames.length) return;
    // prévia + fps/loop
    const pre = el('div', 'ess-mont-previa');
    const cv = document.createElement('canvas'); cv.width = 150; cv.height = 150;
    M.cv = cv;
    const opc = el('div', 'ess-mont-opc');
    opc.append(E.campo('numero', 'fps', m.fps, (v) => { m.fps = Math.max(1, Math.min(60, v || 10)); }, { passo: 1, min: 1, max: 60 }),
      E.campo('check', 'Repetir (loop)', m.loop, (v) => { m.loop = v; }));
    pre.append(cv, opc);
    M.corpo.appendChild(pre);
    // salvar
    const sv = el('div', 'ess-mont-salvar');
    const nome = document.createElement('input'); nome.placeholder = 'Nome da animação nova'; nome.value = m.nome || '';
    nome.oninput = () => { m.nome = nome.value; };
    nome.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') salvarM(); };
    const salvarM = async () => {
      const n = (nome.value || '').trim().replace(/\s+/g, '_');
      if (!n) { E.aviso('Dê um nome para a animação.', 'erro'); nome.focus(); return; }
      if (st.set.def.anims[n] && !(await confirmar('Já existe', '"' + n + '" já existe neste sprite. Substituir?', 'Substituir', true))) return;
      A().salvarAnim(st.id, n, { fps: m.fps, loop: !!m.loop, repeatTo: 0, pingpong: false, frames: m.frames.map(f => copia(f)) });
      E.aviso('💾 Animação "' + n + '" criada com ' + m.frames.length + ' quadros.' + (FF.Edicoes.conectado() ? ' Enviando…' : ' (só neste aparelho até conectar o ☁)'), 'ok');
      E.renderSync && E.renderSync();
      m.nome = '';
      renderSprites(); renderAnims(); renderMontagem();
    };
    sv.append(nome, E.botao('💾 Salvar como animação nova', salvarM, 'Grava a montagem como uma animação nova deste sprite (vale no jogo)', 'es-bt-ouro'));
    M.corpo.appendChild(sv);
    desenharPreviaMont(0);
  }
  // prévia da montagem: os quadros alinhados pela origem (como no jogo), animando no fps escolhido
  function desenharPreviaMont(dt) {
    const M = ui.mont; if (!M || M.fechado || !M.cv || !M.cv.isConnected || !st.id) return;
    const m = montAtual(), fr = m.frames; if (!fr.length) return;
    M.t += dt;
    const passo = 1 / (m.fps || 10);
    while (M.t >= passo * ((fr[M.k] && fr[M.k][7]) || 1)) { M.t -= passo * ((fr[M.k] && fr[M.k][7]) || 1); M.k++; if (M.k >= fr.length) M.k = m.loop ? 0 : fr.length - 1; if (!m.loop && M.k === fr.length - 1) { M.t = 0; break; } }
    if (M.k >= fr.length) M.k = 0;
    let x0 = 0, x1 = 1, y0 = 0, y1 = 1;
    fr.forEach(f => { x0 = Math.min(x0, -f[5]); x1 = Math.max(x1, f[3] - f[5]); y0 = Math.min(y0, -f[6]); y1 = Math.max(y1, f[4] - f[6]); });
    const cv = M.cv, g = cv.getContext('2d'), s = Math.min((cv.width - 8) / (x1 - x0), (cv.height - 8) / (y1 - y0), 4);
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, cv.width, cv.height);
    const f = fr[M.k], ox = (cv.width - (x1 - x0) * s) / 2 - x0 * s, oy = (cv.height - (y1 - y0) * s) / 2 - y0 * s;
    g.drawImage(st.set.images[f[0]], f[1], f[2], f[3], f[4], Math.round(ox - f[5] * s), Math.round(oy - f[6] * s), f[3] * s, f[4] * s);
    g.fillStyle = 'rgba(255,216,74,0.8)'; g.fillRect(Math.round(ox) - 3, Math.round(oy), 7, 1); g.fillRect(Math.round(ox), Math.round(oy) - 3, 1, 7);
    M.corpo.querySelectorAll('.ess-mont-q').forEach((q, i) => q.classList.toggle('tocando', i === M.k));
  }

  function destinoTira(clientX) {
    const cs = [...ui.tira.querySelectorAll('.ess-q')];
    for (let k = 0; k < cs.length; k++) { const r = cs[k].getBoundingClientRect(); if (clientX < r.left + r.width / 2) return k; }
    return cs.length;
  }
  function clicarQuadro(k, alternarSel, faixa) {
    pausar();
    if (faixa) { const a = Math.min(st.ancora, k), b = Math.max(st.ancora, k); st.sel = new Set(); for (let j = a; j <= b; j++) st.sel.add(j); }
    else if (alternarSel) { if (st.sel.has(k) && st.sel.size > 1) st.sel.delete(k); else st.sel.add(k); st.ancora = k; }
    else { st.sel = new Set([k]); st.ancora = k; }
    st.i = k; st.t = 0;
    marcarAtualNaTira(); renderProps();
  }

  function erroLeitura(e) {
    if (e && e.name === 'SecurityError') return 'O navegador bloqueou a leitura das imagens porque a página foi aberta direto do disco (file://). Abra o Estúdio pelo site (GitHub Pages).';
    return (e && e.message) || String(e);
  }

  // ------------------------------------------------------------------ teclado
  function teclado(e) {
    if (E.digitando(e) || document.querySelector('.es-modal') || !st.anim) return false;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (e.key === 's' || e.key === 'S')) { if (sujo()) salvar(); return true; }
    if (ctrl && (e.key === 'd' || e.key === 'D')) { duplicar(); return true; }
    if (ctrl && (e.key === 'a' || e.key === 'A')) { st.sel = new Set(frames().map((_, k) => k)); marcarAtualNaTira(); renderProps(); return true; }
    if (ctrl) return false;
    if (e.key === ' ') { alternar(); return true; }
    if (e.key === ',' || e.key === '<') { passo(-1); return true; }
    if (e.key === '.' || e.key === '>') { passo(1); return true; }
    if (e.key === 'Home') { irPara(0); return true; }
    if (e.key === 'End') { irPara(frames().length - 1); return true; }
    if (e.key === 'Delete' || e.key === 'Backspace') { apagar(); return true; }
    const set = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (set && frames().length) {
      const p = e.shiftKey ? 10 : 1;
      const dx = set[0] * p * sinal(), dy = set[1] * p;
      pausar();
      escolhidos().forEach(k => { frames()[k][5] -= dx; frames()[k][6] -= dy; });
      hist.marcar('Mover origem', true); gravarRascunho(); renderTitulo(); renderProps(); atualizarTiraLeve();
      return true;
    }
    return false;
  }

  const aba = {
    id: 'sprites', nome: 'Sprites', icone: '🖼',
    historico: hist,
    montar,
    mostrar() { ajustarCanvas(); if (st.set) { renderSprites(); renderAnims(); renderTitulo(); } },
    esconder() { pausar(); },
    quadro(dt) { avancar(dt); desenharPalco(); desenharPreviaMont(dt); },
    teclado,
    antesDeSair() { gravarRascunho(); },
  };
  E.registrarAba(aba);
  // para os testes e outras abas
  E.Sprites = { st, ctxIO, aplicarCorte, cortarQuadro, abrirSprite, abrirAnim: (n) => abrirAnim(n, { forcar: true }), salvar, sujo, clicarQuadro, moverPara, apagar, duplicar, inverter,
    redimensionar, mesclar, editorLivre, compactar, apagarSprite, novaAnimacao, renomearAnim };
})();
