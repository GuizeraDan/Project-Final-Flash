// Estúdio Final Flash — "Organizar acervo" (aba Sprites, botão 🗂 Organizar).
// Tela dividida: à esquerda os sprites de um jogo/categoria do acervo (cartões grandes, marcar vários, "só sem pasta");
// à direita as pastas do usuário (trilha, busca, nova pasta). Clicar numa pasta (ou arrastar os cartões para ela)
// MOVE os sprites marcados para lá (spritesInfo[id].pasta, FF.Favoritos.moverSprites). "Sugerir por nome" reconhece
// o personagem pelo nome do sprite (goku, vegeta, freeza…) e propõe a pasta (uma existente com esse nome, ou
// Personagens/<Nome>).
(function () {
  'use strict';
  const E = FF.Estudio;
  const LIMITE = 400;   // cartões por vez ("Mostrar mais" para o resto)

  // personagem pelo nome: [expressão, nomes de pasta aceitos (o 1º é usado se for criar)]
  const PERSONAGENS = [
    ['goku ?black|black ?goku', ['Goku Black', 'Black Goku']],
    ['gogeta|gogeto', ['Gogeta']],
    ['vegito|vegetto|vegeto', ['Vegito', 'Vegetto']],
    ['gotenks', ['Gotenks']],
    ['gohan', ['Gohan']],
    ['goten', ['Goten']],
    ['goku|kakarot', ['Goku']],
    ['vegeta', ['Vegeta']],
    ['trunks', ['Trunks']],
    ['piccolo|picollo|picolo', ['Piccolo']],
    ['krillin|kuririn|krilin', ['Kuririn', 'Krillin', 'Krilin']],
    ['tien|tenshin\\w*', ['Tien', 'Tenshinhan']],
    ['yamcha', ['Yamcha']],
    ['chaoz\\w*|chiaotzu', ['Chaozu']],
    ['freeza|frieza|frizea|freezer', ['Freeza', 'Frieza']],
    ['king cold|rei cold', ['King Cold']],
    ['cooler', ['Cooler']],
    ['cell', ['Cell']],
    ['broly|blory', ['Broly']],
    ['bardock', ['Bardock']],
    ['raditz', ['Raditz']],
    ['nappa|napa', ['Nappa']],
    ['saibaman\\w*', ['Saibaman']],
    ['ginyu|ginuy', ['Captain Ginyu', 'Ginyu']],
    ['recoome?', ['Recoome']],
    ['jeice', ['Jeice']],
    ['burter|butter', ['Butter', 'Burter']],
    ['guldo', ['Guldo']],
    ['dodoria', ['Dodoria']],
    ['zarbon', ['Zarbon']],
    ['turles', ['Turles']],
    ['janemba|jamemba', ['Janemba']],
    ['buu|boo', ['Majin Boo', 'Majin Buu', 'Buu']],
    ['jiren', ['Jiren']],
    ['toppo', ['Toppo']],
    ['hit|hitto', ['Hit']],
    ['beerus|bills|birus', ['Bills', 'Beerus']],
    ['whis', ['Whis']],
    ['zamasu', ['Zamasu']],
    ['kefla', ['Kefla']],
    ['caulifla', ['Caulifla']],
    ['kale', ['Kale']],
    ['cabba', ['Cabba']],
    ['moro', ['Moro']],
    ['granola', ['Granola']],
    ['frost', ['Frost']],
    ['baby', ['Baby']],
    ['omega|nuova|shenron', ['Shenron']],
    ['mestre kame|roshi|kame sennin', ['Mestre Kame']],
    ['videl', ['Videl']],
    ['satan|hercule', ['Mr. Satan']],
  ].map(([re, nomes]) => [new RegExp('(^| )(' + re + ')( |$)'), nomes]);

  const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  function abrir() {
    const F = FF.Favoritos;
    const st = {
      cat: E.rascunho.ler('org_cat') || 'personagens',
      tipo: E.rascunho.ler('org_tipo') ?? 'personagens',
      semPasta: E.rascunho.ler('org_sem_pasta') !== false,
      busca: '', pasta: E.rascunho.ler('org_pasta') || '', buscaPasta: '',
      limite: LIMITE, sugestoes: null,
      dentro: null,
      vista: E.rascunho.ler('org_vista') || 'capa',   // pastas: 'compacta' | 'capa' (lista com capa) | 'grade' (capas)   // sprite aberto (duplo clique): mostra as animações dele para mover uma a uma
    };
    const marcados = new Set();
    const marcA = new Set();   // animações marcadas ("sprite#anim") na visão de dentro do sprite
    let ultimo = null, lista = [];

    const c = E.el('div', 'es-org');
    const m = E.modal('🗂 Organizar acervo', c, { larga: true, aoFechar: () => { obs.disconnect(); obsCapa.disconnect(); E.aviso('🗂 Organização salva.' + (FF.Edicoes.conectado() ? '' : ' (só neste aparelho até conectar o ☁)')); } });
    m.el.querySelector('.es-modal-caixa').classList.add('es-org-caixa');

    // ---- topo
    const topo = E.el('div', 'es-org-topo');
    const txtMarc = E.el('span', 'es-org-marc');
    const btSug = E.botao('🪄 Sugerir por nome', () => { st.sugestoes = st.sugestoes ? null : calcularSugestoes(); renderSug(); renderGrade(); }, 'Reconhece o personagem pelo nome do sprite e sugere a pasta');
    const btLixo = E.botao('🗑 Lixeira', () => lixeiraMarcados(), 'Manda os marcados para a Lixeira (dá para restaurar em "🗑 Lixeira")', 'es-bt-perigo es-org-lixo');
    const btJuntar = E.botao('🎞 Juntar em animação', () => {
      if (st.dentro) {
        // animações marcadas, na ordem em que aparecem na grade
        const ks = [...grade.querySelectorAll('.es-org-anim')].map(x => x.dataset.k).filter(k => marcA.has(k));
        if (ks.length < 2) { E.aviso('Marque pelo menos 2 animações para juntar.'); return; }
        FF.EstudioJuntar.abrir(ks, { aoTerminar: () => { marcA.clear(); setTimeout(tudo, 0); } });
        return;
      }
      if (marcados.size < 2) { E.aviso('Marque pelo menos 2 sprites para juntar numa animação.'); return; }
      FF.EstudioJuntar.abrir([...marcados], { aoTerminar: () => { marcados.clear(); setTimeout(tudo, 0); } });
    }, 'Junta os marcados numa animação só: sprites soltos (efeito_00…09) ou, dentro de um sprite, as animações escolhidas', 'es-org-juntar');
    const btSeparar = E.botao('⇱ Separar', async () => {
      const ks = [...grade.querySelectorAll('.es-org-anim')].map(x => x.dataset.k).filter(k => marcA.has(k));
      if (!ks.length) return;
      const itens = ks.map(k => { const i = k.indexOf('#'); return { sprite: k.slice(0, i), anim: k.slice(i + 1) }; });
      const ids = await FF.EstudioSeparar.separar(itens, { destino: st.pasta || null });
      if (!ids.length) return;
      marcA.clear();
      const s = FF.Assets.sprites[st.dentro];
      if (s) FF.Mods.aplicar(st.dentro, s);
      setTimeout(tudo, 0);
    }, 'Cada animação marcada vira um sprite só dela e sai deste sprite (vai para a pasta aberta à direita, se houver)', 'es-org-separar');
    // 🔍 tamanho dos quadros da grade (lembrado no aparelho); Ctrl + roda do mouse na grade também muda
    const TAM_MIN = 64, TAM_MAX = 280;
    let tam = Math.max(TAM_MIN, Math.min(TAM_MAX, +E.rascunho.ler('org_tam') || 84));
    const zoom = E.el('label', 'es-org-zoom'); zoom.title = 'Tamanho dos quadros (Ctrl + roda do mouse na grade)';
    const inZoom = document.createElement('input'); inZoom.type = 'range'; inZoom.min = TAM_MIN; inZoom.max = TAM_MAX; inZoom.step = 4; inZoom.value = tam;
    zoom.append(document.createTextNode('🔍 '), inZoom);
    let tZoom = null;
    const mudarTam = (v, redesenhar) => {
      tam = Math.max(TAM_MIN, Math.min(TAM_MAX, Math.round(v)));
      inZoom.value = tam; aplicarTam();
      E.rascunho.gravar('org_tam', tam === 84 ? null : tam);
      clearTimeout(tZoom);
      if (redesenhar) tZoom = setTimeout(() => renderGrade(), 150);   // redesenha as miniaturas na resolução nova
    };
    inZoom.oninput = () => mudarTam(+inZoom.value, false);
    inZoom.onchange = () => mudarTam(+inZoom.value, true);
    zoom.addEventListener('dblclick', () => mudarTam(84, true));
    topo.append(txtMarc, btSeparar, btJuntar, btLixo, E.el('span', 'es-org-esp'), zoom, btSug);

    // ---- esquerda: acervo
    const esq = E.el('div', 'es-org-esq');
    const filtros = E.el('div', 'es-org-filtros');
    const NOME_CAT = FF.Assets.categoriasAcervo();
    const porCat = {};
    FF.Assets.listaSprites().forEach(id => { if (FF.Assets.doAcervo(id) && !FF.Assets.spriteOculto(id)) (porCat[FF.Assets.categoriaSprite(id)] = porCat[FF.Assets.categoriaSprite(id)] || []).push(id); });
    if (!porCat[st.cat]) st.cat = Object.keys(porCat)[0] || '';
    const selCat = document.createElement('select');
    Object.keys(porCat).forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = (NOME_CAT[k] || k) + ' (' + porCat[k].length + ')'; selCat.appendChild(o); });
    selCat.value = st.cat;
    selCat.onchange = () => { st.dentro = null; st.cat = selCat.value; E.rascunho.gravar('org_cat', st.cat); st.limite = LIMITE; marcados.clear(); st.sugestoes = null; tudo(); };
    const selTipo = document.createElement('select');
    [['', 'Todos os tipos'], ['personagens', 'Personagens'], ['efeitos', 'Efeitos'], ['cenarios', 'Cenários'], ['interface', 'Interface'], ['cutscenes', 'Cutscenes']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; selTipo.appendChild(o); });
    selTipo.value = st.tipo;
    selTipo.onchange = () => { st.tipo = selTipo.value; E.rascunho.gravar('org_tipo', st.tipo); st.limite = LIMITE; marcados.clear(); st.sugestoes = null; tudo(); };
    const chkSem = E.campo('check', 'Só sem pasta', st.semPasta, (v) => { st.semPasta = v; E.rascunho.gravar('org_sem_pasta', v); st.limite = LIMITE; tudo(); }, { dica: 'Esconde os sprites que você já colocou numa pasta' });
    const busca = document.createElement('input');
    busca.type = 'search'; busca.placeholder = 'Filtrar (nome do sprite)…';
    busca.oninput = () => { st.busca = busca.value; st.limite = LIMITE; renderGrade(); };
    const btTodos = E.botao('Marcar todos', () => { lista.slice(0, st.limite).forEach(id => marcados.add(id)); pintar(); }, 'Marca todos os cartões que estão aparecendo');
    const btLimpar = E.botao('Limpar', () => { marcados.clear(); pintar(); }, 'Desmarcar todos');
    filtros.append(selCat, selTipo, chkSem, busca, btTodos, btLimpar);
    const barraDentro = E.el('div', 'es-org-filtros es-org-dentro');
    const info = E.el('div', 'es-org-info');
    const grade = E.el('div', 'es-org-grade');
    const aplicarTam = () => { grade.style.setProperty('--org-tam', tam + 'px'); };
    aplicarTam();
    grade.addEventListener('wheel', (ev) => { if (!ev.ctrlKey) return; ev.preventDefault(); mudarTam(tam * (ev.deltaY < 0 ? 1.12 : 1 / 1.12), true); }, { passive: false });
    const sug = E.el('div', 'es-org-sug');
    esq.append(filtros, barraDentro, info, grade, sug);

    // ---- direita: pastas
    const dir = E.el('div', 'es-org-dir');
    const buscaP = document.createElement('input');
    buscaP.type = 'search'; buscaP.placeholder = '🔎 Buscar pasta (ex.: ssj4)…';
    buscaP.oninput = () => { st.buscaPasta = buscaP.value; renderPastas(); };
    const vistas = E.el('div', 'es-org-vistas');
    vistas.appendChild(E.el('span', 'es-org-sub', 'Ver como:'));
    const btsVista = [['compacta', '☰ Compacta', 'Linhas finas: cabe mais na tela'], ['capa', '▤ Lista com capa', 'Capa, nome e quantos itens'], ['grade', '▦ Capas', 'Capas grandes lado a lado (bom para arrastar)']].map(([v, t, d]) => {
      const b = E.botao(t, () => { st.vista = v; E.rascunho.gravar('org_vista', v); renderPastas(); }, d);
      b.dataset.vista = v; vistas.appendChild(b); return b;
    });
    vistas.appendChild(E.el('span', 'es-org-esp'));
    vistas.appendChild(E.botao('＋ Nova pasta', () => novaPasta(), 'Cria uma pasta dentro da que está aberta (com cartões marcados, eles já vão para ela)', 'es-org-novabt'));
    const trilha = E.el('div', 'es-org-trilha');
    const pastasEl = E.el('div', 'es-org-pastas');
    const letras = E.el('div', 'es-org-letras');   // A B C …: pula para a 1ª pasta com a letra
    const dicaDir = E.el('div', 'es-org-dica', 'Com cartões marcados, clique numa pasta (ou arraste os cartões até ela) para mover. Sem marcados, o clique abre a pasta. Animações movidas saem da pasta do personagem.');
    dir.append(buscaP, vistas, trilha, letras, pastasEl, dicaDir);

    const corpo = E.el('div', 'es-org-corpo');
    corpo.append(esq, dir);
    c.append(topo, corpo);

    // ---- miniaturas preguiçosas
    const pend = new Map();
    const obs = new IntersectionObserver((ents) => ents.forEach(en => {
      if (!en.isIntersecting) return;
      const id = pend.get(en.target); if (!id) return;
      pend.delete(en.target); obs.unobserve(en.target);
      FF.Assets.loadSprite(id).then(s => { if (s) E.miniatura(en.target, s, Object.keys(s.def.anims)[0], 0); }).catch(() => {});
    }), { root: grade, rootMargin: '200px' });

    // ---- capas das pastas (1º sprite/animação de dentro), só quando aparecem
    const pendCapa = new Map();
    const obsCapa = new IntersectionObserver((ents) => ents.forEach(en => {
      if (!en.isIntersecting) return;
      const v = pendCapa.get(en.target); if (!v) return;
      pendCapa.delete(en.target); obsCapa.unobserve(en.target);
      FF.Assets.loadSprite(v.sprite).then(s => { if (s) E.miniatura(en.target, s, v.anim && s.has(v.anim) ? v.anim : Object.keys(s.def.anims)[0], 0); }).catch(() => {});
    }), { root: pastasEl, rootMargin: '150px' });
    function capa(nome, tam) {
      const cv = document.createElement('canvas'); cv.width = tam; cv.height = tam; cv.className = 'es-org-capa';
      const it = F.itensPasta(nome, true).find(v => !FF.Assets.spriteOculto(v.sprite));
      if (it) { pendCapa.set(cv, it); obsCapa.observe(cv); } else cv.classList.add('vazia');
      return cv;
    }

    // ---- prévia tocando enquanto o mouse está em cima (igual ao seletor)
    function previaNoMouse(el, cv, id, anim) {
      let t = null;
      el.addEventListener('mouseenter', () => {
        const s = FF.Assets.sprites[id];
        const a = anim || (s && Object.keys(s.def.anims)[0]);
        const def = s && s.anim(a);
        if (!def || def.frames.length < 2) return;
        let i = 0;
        const passo = () => { i = (i + 1) % def.frames.length; E.miniatura(cv, s, a, i); t = setTimeout(passo, 1000 / (def.fps || 10) * (def.frames[i][7] || 1)); };
        t = setTimeout(passo, 60);
      });
      el.addEventListener('mouseleave', () => { clearTimeout(t); t = null; const s = FF.Assets.sprites[id]; if (s) E.miniatura(cv, s, anim || Object.keys(s.def.anims)[0], 0); });
    }

    // ---- dados
    const emPasta = (id) => !!F.pastaDoSprite(id) || F.pastasDe(id, null).length > 0;
    function calcularLista() {
      const f = normal(st.busca);
      lista = (porCat[st.cat] || []).filter(id => !FF.Assets.spriteOculto(id) &&
        (!st.tipo || FF.Assets.tipoSprite(id) === st.tipo) &&
        (!st.semPasta || !emPasta(id)) &&
        (!f || normal(FF.Assets.nomeSprite(id) + ' ' + id).includes(f)));
      lista.sort((a, b) => FF.compararNomes(FF.Assets.nomeSprite(a), FF.Assets.nomeSprite(b)));
    }
    function existentes() {
      const arv = F.arvorePastas();
      return arv.map(p => p.nome);
    }
    // pasta do personagem: uma existente com um dos nomes aceitos (a mais rasa), senão Personagens/<Nome>
    function pastaDoPersonagem(nomes) {
      const ex = existentes();
      const alvos = nomes.map(normal);
      const achou = ex.filter(n => alvos.includes(normal(F.folha(n)))).sort((a, b) => F.nivel(a) - F.nivel(b))[0];
      return achou || ('Personagens/' + nomes[0]);
    }
    function sugestaoDe(id) {
      const t = ' ' + normal(FF.Assets.nomeSprite(id) + ' ' + id.replace(/^[a-z]+_/, '')) + ' ';
      for (const [re, nomes] of PERSONAGENS) if (re.test(t)) return nomes;
      const a = t.match(/ andro?i?de? ?(1[3-9]|2[01]) | a(1[3-9]|2[01]) /);
      if (a) { const n = a[1] || a[2]; return ['Android ' + n, 'Androide ' + n]; }
      return null;
    }
    function calcularSugestoes() {
      const grupos = new Map();
      lista.forEach(id => {
        const nomes = sugestaoDe(id); if (!nomes) return;
        const pasta = pastaDoPersonagem(nomes);
        if (!grupos.has(pasta)) grupos.set(pasta, []);
        grupos.get(pasta).push(id);
      });
      const porId = new Map();
      grupos.forEach((ids, p) => ids.forEach(id => porId.set(id, p)));
      return { grupos: [...grupos.entries()].sort((a, b) => b[1].length - a[1].length), porId };
    }

    // ---- mover
    function garantirPasta(nome) {
      const partes = nome.split('/');
      for (let i = 1; i <= partes.length; i++) { const n = partes.slice(0, i).join('/'); if (!F.pastas()[n]) F.criarPasta(n); }
    }
    function mover(ids, nome) {
      ids = ids.filter(Boolean);
      if (!ids.length || !nome) return;
      garantirPasta(nome);
      F.moverSprites(ids, nome);
      ids.forEach(id => marcados.delete(id));
      E.aviso('📁 ' + ids.length + (ids.length === 1 ? ' sprite movido' : ' sprites movidos') + ' para "' + nome.replace(/\//g, ' › ') + '".', 'ok');
      setTimeout(() => { if (st.sugestoes) st.sugestoes = calcularSugestoes(); tudo(); }, 0);
    }

    // mover animações (opção A): entram na pasta escolhida e saem das outras pastas em que estavam soltas;
    // na pasta onde está o sprite inteiro elas deixam de aparecer (seletor.js filtra)
    function moverAnims(chaves, nome) {
      chaves = chaves.filter(Boolean);
      if (!chaves.length || !nome) return;
      garantirPasta(nome);
      chaves.forEach(k => {
        const i = k.indexOf('#'), id = k.slice(0, i), a = k.slice(i + 1);
        const ps = F.pastasDe(id, a);
        if (!ps.includes(nome)) F.alternarPasta(nome, id, a);
        ps.filter(p => p !== nome).forEach(p => F.alternarPasta(p, id, a));
        marcA.delete(k);
      });
      E.aviso('📁 ' + chaves.length + (chaves.length === 1 ? ' animação movida' : ' animações movidas') + ' para "' + nome.replace(/\//g, ' › ') + '".', 'ok');
      setTimeout(tudo, 0);
    }
    function moverMarcados(nome) { if (st.dentro) moverAnims([...marcA], nome); else mover([...marcados], nome); }
    const temMarcados = () => (st.dentro ? marcA.size : marcados.size) > 0;

    // ---- renomear e Lixeira (sprites do acervo e animações)
    function renomear(alvoEl, id, anim) {
      const atual = anim ? FF.Assets.nomeAnim(id, anim) : FF.Assets.nomeSprite(id);
      E.editarNoLugar(alvoEl, atual, (v) => {
        if (anim) E.renomearAnim(id, anim, v);
        else E.mudarInfoSprite(id, { nome: (v || '').trim() && v.trim() !== (FF.Assets.acervo()[id] || [])[1] ? v.trim() : null });
        setTimeout(() => { alvoEl.textContent = anim ? FF.Assets.nomeAnim(id, anim) : FF.Assets.nomeSprite(id); }, 0);
      });
    }
    async function lixeira(ids, anims) {
      ids = (ids || []).filter(id => FF.Assets.doAcervo(id) && !FF.Assets.spriteOculto(id));
      anims = anims || [];
      const n = ids.length + anims.length;
      if (!n) { E.aviso('Marque primeiro o que quer mandar para a Lixeira.'); return; }
      const txt = (ids.length ? ids.length + ' sprite(s)' : '') + (ids.length && anims.length ? ' e ' : '') + (anims.length ? anims.length + ' animação(ões)' : '');
      if (!(await E.confirmar('🗑 Mandar para a Lixeira', 'Mandar ' + txt + ' para a Lixeira? Somem das listas e das pastas; dá para restaurar em "🗑 Lixeira".', '🗑 Mandar para a Lixeira', true))) return;
      ids.forEach(id => { E.mudarInfoSprite(id, { oculto: true }); marcados.delete(id); });
      anims.forEach(k => { const i = k.indexOf('#'); FF.Edicoes.setDepois(['sprites', k.slice(0, i), k.slice(i + 1)], { apagada: true }); marcA.delete(k); });
      anims.forEach(k => { const id = k.slice(0, k.indexOf('#')), s = FF.Assets.sprites[id]; if (s) FF.Mods.aplicar(id, s); });
      E.aviso('🗑 ' + txt + ' na Lixeira.');
      setTimeout(tudo, 0);
    }
    function lixeiraMarcados() { if (st.dentro) lixeira([], [...marcA]); else lixeira([...marcados], []); }
    function botoesCartao(k, nm, id, anim) {
      const bx = E.el('div', 'es-org-bts');
      const ren = E.botao('✏', (ev) => { ev.stopPropagation(); renomear(nm, id, anim); }, anim ? 'Renomear esta animação (só o nome que aparece)' : 'Renomear este sprite (só o nome que aparece)');
      const del = E.botao('🗑', (ev) => { ev.stopPropagation(); if (anim) lixeira([], [id + '#' + anim]); else lixeira([id], []); }, 'Mandar para a Lixeira', 'es-bt-perigo');
      bx.append(ren, del);
      if (!anim) bx.prepend(E.botao('✂', (ev) => { ev.stopPropagation(); m.fechar(); E.editarSprite && E.editarSprite(id); }, 'Abrir na aba Sprites (editar quadros)'));
      [ren, del].forEach(b => b.addEventListener('dblclick', (ev) => ev.stopPropagation()));
      k.appendChild(bx);
    }

    // ---- desenho
    function pintar() {
      grade.querySelectorAll('.es-org-card').forEach(k => k.classList.toggle('marcado', k.dataset.k ? marcA.has(k.dataset.k) : marcados.has(k.dataset.id)));
      const n = st.dentro ? marcA.size : marcados.size;
      txtMarc.textContent = n ? '☑ ' + n + (st.dentro ? ' animação(ões)' : ' sprite(s)') + ' marcado(s) — clique numa pasta à direita' : (st.dentro ? 'Marque as animações e escolha a pasta à direita (ex.: efeitos para a pasta de efeitos)' : 'Marque os sprites e escolha a pasta à direita · duplo clique abre as animações do sprite');
      c.classList.toggle('tem-marcados', n > 0);
      btLixo.textContent = '🗑 Lixeira' + (n ? ' (' + n + ')' : '');
      btJuntar.hidden = (st.dentro ? marcA.size : marcados.size) < 2;
      btSeparar.hidden = !st.dentro || !marcA.size;
      btSeparar.textContent = '⇱ Separar' + (st.dentro && marcA.size ? ' (' + marcA.size + ')' : '') + (st.pasta ? ' → ' + F.folha(st.pasta) : '');
    }
    function marcar(id, ev) {
      if (ev.shiftKey && ultimo && lista.includes(ultimo)) {
        const [a, z] = [lista.indexOf(ultimo), lista.indexOf(id)].sort((x, y) => x - y);
        lista.slice(a, z + 1).forEach(i => marcados.add(i));
      } else if (marcados.has(id)) marcados.delete(id); else marcados.add(id);
      ultimo = id; pintar();
    }
    function cartao(id) {
      const k = E.el('div', 'es-org-card' + (marcados.has(id) ? ' marcado' : ''));
      k.dataset.id = id; k.draggable = true;
      const cv = document.createElement('canvas'); cv.width = tam; cv.height = tam;
      const s = FF.Assets.sprites[id];
      if (s) requestAnimationFrame(() => E.miniatura(cv, s, Object.keys(s.def.anims)[0], 0)); else { pend.set(cv, id); obs.observe(cv); }
      const a = FF.Assets.acervo()[id] || [];
      const nm = E.el('div', 'es-org-nome'); nm.textContent = FF.Assets.nomeSprite(id); nm.title = id;
      const sub = E.el('div', 'es-org-sub'); sub.textContent = (a[2] || 0) + ' anim.';
      k.append(cv, nm, sub);
      const p = st.sugestoes && st.sugestoes.porId.get(id);
      if (p) { const sg = E.el('div', 'es-org-sugcard'); sg.textContent = '→ ' + F.folha(p); sg.title = 'Sugestão: ' + p.replace(/\//g, ' › '); k.appendChild(sg); }
      else if (st.sugestoes) k.appendChild(E.el('div', 'es-org-sugcard nada', '?'));
      botoesCartao(k, nm, id, null);
      k.onclick = (ev) => marcar(id, ev);
      k.ondblclick = () => abrirDentro(id);
      previaNoMouse(k, cv, id, null);
      k.addEventListener('dragstart', (ev) => {
        if (!marcados.has(id)) { marcados.add(id); pintar(); }
        ev.dataTransfer.setData('application/x-ff-org', JSON.stringify({ ids: [...marcados] }));
        ev.dataTransfer.effectAllowed = 'move';
      });
      return k;
    }
    async function abrirDentro(id) {
      st.dentro = id; marcA.clear(); marcados.clear();
      await FF.Assets.loadSprite(id).catch(() => null);
      tudo();
    }
    function sairDentro() { st.dentro = null; marcA.clear(); tudo(); }
    function cartaoAnim(id, s, a) {
      const k0 = id + '#' + a, def = s.anim(a);
      const k = E.el('div', 'es-org-card es-org-anim' + (marcA.has(k0) ? ' marcado' : ''));
      k.dataset.k = k0; k.dataset.id = id; k.draggable = true;
      const cv = document.createElement('canvas'); cv.width = Math.round(tam * 1.24); cv.height = tam;
      requestAnimationFrame(() => E.miniatura(cv, s, a, 0));
      const nm = E.el('div', 'es-org-nome'); nm.textContent = FF.Assets.nomeAnim ? FF.Assets.nomeAnim(id, a) : a; nm.title = a;
      const fr = def.frames, dur = fr.reduce((t, q) => t + (q[7] || 1), 0) / (def.fps || 10);
      let w = 0, h = 0; fr.forEach(q => { w = Math.max(w, q[3]); h = Math.max(h, q[4]); });
      const sub = E.el('div', 'es-org-sub'); sub.textContent = fr.length + ' quadro' + (fr.length === 1 ? '' : 's') + ' · ' + dur.toFixed(2).replace('.', ',') + ' s · ' + w + '×' + h;
      k.append(cv, nm, sub);
      botoesCartao(k, nm, id, a);
      const ps = F.pastasDe(id, a);
      if (ps.length) { const pl = E.el('div', 'es-org-sugcard'); pl.textContent = '📁 ' + ps.map(p => F.folha(p)).join(', '); pl.title = ps.join(' | '); k.appendChild(pl); }
      k.onclick = (ev) => {
        const ks = [...grade.querySelectorAll('.es-org-anim')].map(x => x.dataset.k);
        if (ev.shiftKey && ultimo && ks.includes(ultimo)) { const [i, j] = [ks.indexOf(ultimo), ks.indexOf(k0)].sort((x, y) => x - y); ks.slice(i, j + 1).forEach(x => marcA.add(x)); }
        else if (marcA.has(k0)) marcA.delete(k0); else marcA.add(k0);
        ultimo = k0; pintar();
      };
      previaNoMouse(k, cv, id, a);
      k.addEventListener('dragstart', (ev) => {
        if (!marcA.has(k0)) { marcA.add(k0); pintar(); }
        ev.dataTransfer.setData('application/x-ff-org', JSON.stringify({ anims: [...marcA] }));
        ev.dataTransfer.effectAllowed = 'move';
      });
      return k;
    }
    function renderDentro() {
      const id = st.dentro, s = FF.Assets.sprites[id];
      filtros.style.display = 'none'; barraDentro.style.display = '';
      barraDentro.innerHTML = '';
      const volta = E.botao('← Voltar', () => sairDentro(), 'Voltar para os sprites');
      const tit = E.el('span', 'es-org-dtit'); tit.textContent = (NOME_CAT[st.cat] || st.cat) + ' › ' + FF.Assets.nomeSprite(id);
      const pSpr = F.pastaDoSprite(id);
      const onde = E.el('span', 'es-org-sub', pSpr ? ' (sprite inteiro em 📁 ' + pSpr.replace(/\//g, ' › ') + ')' : '');
      barraDentro.append(volta, tit, onde, E.el('span', 'es-org-esp'),
        E.botao('Marcar todos', () => { grade.querySelectorAll('.es-org-anim').forEach(x => marcA.add(x.dataset.k)); pintar(); }, 'Marca todas as animações que estão aparecendo'),
        E.botao('Limpar', () => { marcA.clear(); pintar(); }, 'Desmarcar todas'));
      grade.innerHTML = '';
      if (!s) { info.textContent = ''; grade.appendChild(E.el('p', 'es-vazio', 'Não deu para abrir este sprite.')); return; }
      const nomes = Object.keys(s.def.anims).sort((a, b) => FF.compararNomes(a, b));
      const soltas = nomes.filter(a => !F.pastasDe(id, a).length);
      info.textContent = nomes.length + ' animação(ões) · ' + (nomes.length - soltas.length) + ' já em outras pastas';
      nomes.forEach(a => grade.appendChild(cartaoAnim(id, s, a)));
      pintar();
    }
    function renderGrade() {
      if (st.dentro) return renderDentro();
      filtros.style.display = ''; barraDentro.style.display = 'none';
      calcularLista();
      pend.forEach((_, el) => obs.unobserve(el)); pend.clear();
      grade.innerHTML = '';
      const tot = (porCat[st.cat] || []).length;
      info.textContent = lista.length + ' sprite(s)' + (st.semPasta ? ' sem pasta' : '') + ' de ' + tot + ' em "' + (NOME_CAT[st.cat] || st.cat) + '"' + (lista.length > st.limite ? ' · mostrando ' + st.limite : '');
      if (!lista.length) grade.appendChild(E.el('p', 'es-vazio', st.semPasta ? '✔ Tudo daqui já está em pastas.' : 'Nenhum sprite.'));
      lista.slice(0, st.limite).forEach(id => grade.appendChild(cartao(id)));
      if (lista.length > st.limite) grade.appendChild(E.botao('Mostrar mais ' + Math.min(LIMITE, lista.length - st.limite), () => { st.limite += LIMITE; renderGrade(); }, null, 'es-org-mais'));
      pintar();
    }
    function renderSug() {
      sug.innerHTML = '';
      if (st.dentro) return;
      btSug.classList.toggle('es-bt-ouro', !!st.sugestoes);
      if (!st.sugestoes) return;
      const g = st.sugestoes.grupos;
      if (!g.length) { sug.appendChild(E.el('span', 'es-org-dica', '🪄 Nenhum nome de personagem reconhecido aqui (nomes de código como B_12 não dizem quem é).')); return; }
      sug.appendChild(E.el('span', 'es-org-sugtit', '🪄 Sugestões:'));
      g.forEach(([p, ids]) => {
        const b = E.botao(F.folha(p) + ' ' + ids.length, () => { ids.forEach(id => marcados.add(id)); pintar(); }, 'Marcar estes ' + ids.length + ' (pasta: ' + p.replace(/\//g, ' › ') + (F.pastas()[p] ? '' : ' — será criada') + ')', 'es-org-chip');
        sug.appendChild(b);
      });
      sug.appendChild(E.botao('Mover todas as sugestões', async () => {
        const total = g.reduce((s, x) => s + x[1].length, 0);
        const novas = g.filter(([p]) => !F.pastas()[p]).map(([p]) => F.folha(p));
        if (!(await E.confirmar('🪄 Mover sugestões', 'Mover ' + total + ' sprites para ' + g.length + ' pasta(s)?' + (novas.length ? ' Pastas novas: ' + novas.join(', ') + '.' : ''), 'Mover', false))) return;
        g.forEach(([p, ids]) => { garantirPasta(p); F.moverSprites(ids, p); ids.forEach(id => marcados.delete(id)); });
        E.aviso('🪄 ' + total + ' sprites movidos para ' + g.length + ' pasta(s).', 'ok');
        st.sugestoes = null; setTimeout(tudo, 0);
      }, 'Move cada grupo para a pasta sugerida (cria as que faltam)', 'es-bt-ouro'));
    }
    function contar(nome) { return F.itensPasta(nome, true).length; }
    function linhaPasta(nome, rotulo, temFilhas, especial) {
      const vista = especial ? 'compacta' : st.vista;
      const r = E.el('div', 'es-org-pasta v-' + vista);
      r.dataset.pasta = nome;
      const nItens = contar(nome), nSub = F.arvorePastas().filter(p => F.paiDe(p.nome) === nome).length;
      const nm = E.el('span', 'es-org-pnome'); nm.textContent = rotulo; nm.title = nome.replace(/\//g, ' › ');
      const resumo = (nSub ? nSub + (nSub === 1 ? ' subpasta · ' : ' subpastas · ') : '') + nItens + (nItens === 1 ? ' item' : ' itens');
      if (vista === 'compacta') {
        const n = E.el('small', 'es-org-pn', String(nItens));
        r.append(E.el('span', 'es-org-pic', '📁'), nm, n);
      } else if (vista === 'capa') {
        const tx = E.el('div', 'es-org-ptx');
        tx.append(nm, E.el('small', 'es-org-pn', resumo));
        r.append(capa(nome, 44), tx);
      } else {
        const sub = E.el('small', 'es-org-pn', resumo);
        r.append(capa(nome, 112), nm, sub);
      }
      if (temFilhas) { const ent = E.botao('▸', (ev) => { ev.stopPropagation(); entrar(nome); }, 'Abrir a pasta'); ent.className = 'es-org-entrar'; r.appendChild(ent); }
      r.onclick = () => { if (temMarcados()) moverMarcados(nome); else entrar(nome); };
      r.addEventListener('dragover', (ev) => { if (ev.dataTransfer.types.includes('application/x-ff-org')) { ev.preventDefault(); r.classList.add('alvo'); } });
      r.addEventListener('dragleave', () => r.classList.remove('alvo'));
      r.addEventListener('drop', (ev) => {
        ev.preventDefault(); r.classList.remove('alvo');
        try { const d = JSON.parse(ev.dataTransfer.getData('application/x-ff-org')); if (d.anims) moverAnims(d.anims, nome); else mover(d.ids || d, nome); } catch (e) { /* nada */ }
      });
      return r;
    }
    async function novaPasta() {
      const n = await E.perguntar('＋ Nova pasta', 'Nome da pasta' + (st.pasta ? ' dentro de "' + F.folha(st.pasta) + '"' : '') + ':', '');
      if (!n || !n.trim()) return;
      const nome = F.criarPasta((st.pasta ? st.pasta + '/' : '') + n.trim());
      if (!nome) return;
      setTimeout(() => { if (temMarcados()) moverMarcados(nome); else renderPastas(); }, 0);
    }
    // o que está dentro da pasta aberta (só nela, sem as subpastas): ver, abrir e tirar o que não pertence
    function renderConteudo() {
      const itens = F.itensPasta(st.pasta, false).filter(v => !FF.Assets.spriteOculto(v.sprite));
      const tit = E.el('div', 'es-org-ctit', 'Dentro de "' + F.folha(st.pasta) + '" (' + itens.length + ')');
      pastasEl.appendChild(tit);
      if (!itens.length) { pastasEl.appendChild(E.el('p', 'es-org-dica', 'Pasta vazia. Marque cartões à esquerda e clique em "⬇ Pôr aqui".')); return; }
      const caixa = E.el('div', 'es-org-conteudo');
      itens.forEach(v => {
        const k = E.el('div', 'es-org-item');
        const cv = document.createElement('canvas'); cv.width = 56; cv.height = 56; cv.className = 'es-org-capa';
        pendCapa.set(cv, v); obsCapa.observe(cv);
        const nm = E.el('div', 'es-org-nome'); nm.textContent = v.anim ? (FF.Assets.nomeAnim ? FF.Assets.nomeAnim(v.sprite, v.anim) : v.anim) : FF.Assets.nomeSprite(v.sprite);
        nm.title = v.anim ? v.sprite + ' › ' + v.anim : v.sprite;
        const sub = E.el('div', 'es-org-sub', v.anim ? '🎞 ' + FF.Assets.nomeSprite(v.sprite) : '🖼 sprite inteiro');
        const tirar = E.botao('↩', (ev) => {
          ev.stopPropagation();
          if (v.movido) F.moverSprites([v.sprite], null); else F.alternarPasta(st.pasta, v.sprite, v.anim);
          E.aviso('↩ "' + nm.textContent + '" saiu de "' + F.folha(st.pasta) + '".');
          setTimeout(tudo, 0);
        }, 'Tirar desta pasta (volta para o lugar de origem)', 'es-org-tirar');
        k.append(cv, nm, sub, tirar);
        if (v.anim && !v.movido) {
          const sep = E.botao('⇱', async (ev) => {
            ev.stopPropagation();
            const ids = await FF.EstudioSeparar.separar([{ sprite: v.sprite, anim: v.anim, pasta: st.pasta }], { destino: st.pasta });
            if (ids.length) setTimeout(tudo, 0);
          }, 'Separar: vira um sprite só desta animação, aqui nesta pasta, e sai de "' + FF.Assets.nomeSprite(v.sprite) + '"', 'es-org-separar-item');
          k.appendChild(sep);
        }
        k.title = 'Duplo clique: abrir ' + (v.anim ? 'o sprite desta animação' : 'as animações do sprite') + ' à esquerda';
        k.ondblclick = () => abrirDentro(v.sprite);
        previaNoMouse(k, cv, v.sprite, v.anim);
        caixa.appendChild(k);
      });
      pastasEl.appendChild(caixa);
    }
    function renderLetras(filhas) {
      letras.innerHTML = '';
      const ini = (n) => { const c = normal(n).charAt(0); return /[a-z]/.test(c) ? c.toUpperCase() : '#'; };
      const tem = new Set(filhas.map(p => ini(p.folha)));
      if (filhas.length < 8) return;   // poucas pastas: a barra não ajuda
      ['#'].concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')).forEach(L => {
        if (L === '#' && !tem.has('#')) return;
        const b = E.el('button', 'es-org-letra' + (tem.has(L) ? '' : ' vazia'), L);
        if (tem.has(L)) b.onclick = () => {
          const alvo = [...pastasEl.querySelectorAll('.es-org-pasta[data-pasta]')].find(r => !r.classList.contains('es-org-aqui') && ini(F.folha(r.dataset.pasta)) === L);
          if (!alvo) return;
          pastasEl.scrollTop = alvo.offsetTop - 2;
          alvo.classList.remove('piscar'); void alvo.offsetWidth; alvo.classList.add('piscar');
          letras.querySelectorAll('.es-org-letra').forEach(x => x.classList.toggle('sel', x === b));
        };
        else b.title = 'Nenhuma pasta com ' + L;
        letras.appendChild(b);
      });
    }
    function entrar(nome) { st.pasta = nome; E.rascunho.gravar('org_pasta', nome); st.buscaPasta = ''; buscaP.value = ''; renderPastas(); }
    function renderPastas() {
      const arv = F.arvorePastas();
      pendCapa.forEach((_, el) => obsCapa.unobserve(el)); pendCapa.clear();
      btsVista.forEach(b => b.classList.toggle('sel', b.dataset.vista === st.vista));
      pastasEl.dataset.vista = st.vista;
      if (st.pasta && !arv.some(p => p.nome === st.pasta)) st.pasta = '';
      trilha.innerHTML = '';
      const partes = st.pasta ? st.pasta.split('/') : [];
      const ir = (n, t) => { const a = E.el('span', 'es-org-tri'); a.textContent = t; a.onclick = () => entrar(n); return a; };
      if (partes.length) { const v = E.botao('←', () => entrar(F.paiDe(st.pasta)), 'Voltar uma pasta'); v.className = 'es-org-voltar'; trilha.appendChild(v); }
      trilha.appendChild(ir('', 'Minhas pastas'));
      partes.forEach((p, i) => { trilha.appendChild(E.el('span', 'es-org-sep', '›')); trilha.appendChild(ir(partes.slice(0, i + 1).join('/'), p)); });
      pastasEl.innerHTML = '';
      const f = normal(st.buscaPasta);
      if (f) {
        letras.innerHTML = '';
        const ach = arv.filter(p => normal(p.nome).includes(f));
        if (!ach.length) pastasEl.appendChild(E.el('p', 'es-vazio', 'Nenhuma pasta com "' + st.buscaPasta + '".'));
        ach.forEach(p => pastasEl.appendChild(linhaPasta(p.nome, p.nome.replace(/\//g, ' › '), p.temFilhas)));
        return;
      }
      if (st.pasta) {   // a própria pasta aberta também recebe
        const aqui = linhaPasta(st.pasta, '⬇ Pôr aqui: ' + F.folha(st.pasta), false, true);
        aqui.classList.add('es-org-aqui');
        pastasEl.appendChild(aqui);
      }
      const filhas = arv.filter(p => F.paiDe(p.nome) === st.pasta);
      renderLetras(filhas);
      filhas.forEach(p => pastasEl.appendChild(linhaPasta(p.nome, p.folha, p.temFilhas)));
      if (!filhas.length && !st.pasta) pastasEl.appendChild(E.el('p', 'es-vazio', 'Você ainda não tem pastas.'));
      if (st.pasta) renderConteudo();
    }
    function tudo() { renderGrade(); renderSug(); renderPastas(); }
    tudo();
    setTimeout(() => busca.focus(), 50);
    return { fechar: m.fechar, st };
  }

  FF.EstudioOrganizar = { abrir, PERSONAGENS };
})();
