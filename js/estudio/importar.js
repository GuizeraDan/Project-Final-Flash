// Estúdio Final Flash — importador (abre por cima da aba Sprites: "📂 Importar" ou soltar arquivos nela):
// transforma imagens, sprite sheets, GIF/APNG/WebP animados, vídeos, ZIPs e pacotes antigos em sprites do
// jogo (seção spritesNovos de data/edicoes.js) ou em animações novas de qualquer sprite.
//
// Fluxo: arquivos → (separar quadros de uma folha) → tratamento (fundo, corte, escala, origem, tempo)
//        → prévia animada → salvar como sprite novo ou como animação de um sprite (do jogo ou importado).
// O atlas gerado vai para o IndexedDB (FF.ImagensUsr, caminho assets/img/usr/<id>.png) e é enviado
// ao GitHub junto com o data/edicoes.js quando o aparelho estiver conectado (☁). Animação num sprite que já
// existe: as imagens entram num atlas extra (FF.EstudioArq.quadrosParaSprite).
// Quem usa: FF.EstudioImportar.montar(el) uma vez, .abrir({destino, alvo, anim, arquivos}), .quadro(dt),
// .teclado(e), .historico; avisa com .aoSalvar(id, anim) e .aoFechar().
(function () {
  'use strict';
  const E = FF.Estudio;
  const I = FF.Imagem;
  const C = FF.Codecs;
  const MAX_ATLAS = 4096;
  const ESCALAS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
  const NOMES_ANIM = ['Parado', 'Andar', 'Correr', 'Pulo', 'Defesa', 'Soco', 'Chute', 'Dano', 'Lancado', 'Caido', 'Especial', 'Carregar_Ki', 'Vitoria', 'Intro', 'Efeito', 'Explosao', 'Raio', 'Esfera'];

  let seq = 0;
  const novoId = () => 'q' + (++seq);

  // ---------------------------------------------------------------- estado
  const PADRAO = {
    fundo: false, corFundo: null, tol: 24, contiguo: true,
    cortar: true, escala: 1, origem: 'pes', alinhar: true, fps: 12, loop: true,
    destino: 'novo', id: '', anim: 'Parado', alvo: '', animFixa: false,
    vfps: 12, vmax: 120, juntar: false,
    previaFundo: 'xadrez', zoom: 0, goku: true,
  };
  const PADRAO_FOLHA = { modo: 'auto', juntarDist: 2, minArea: 16, colunas: 1, linhas: 1, margem: 0, espaco: 0, zoom: 0 };
  const st = {
    cfg: Object.assign({}, PADRAO),
    fontes: {},          // id → {img, nome, orig?: [ox, oy], pontos?}
    lista: [],           // [{id, ativo, dx, dy, dur}] na ordem da animação
    folha: null,         // {nome, img, caixas: [{x, y, w, h, off}], cfg}
    vista: 'vazio',      // vazio | folha | anim
    sel: 0, tocando: true, t: 0,
    cache: {},           // id → {chave, img, tx, ty, conteudo, W, H, canvas}
    res: [],             // quadros prontos (só os ativos): {id, img, ox, oy, dur, canvas, tx, ty, s}
    corAuto: undefined,
    pacote: null,        // pacote antigo / sprite do jogo aguardando: {nome, id, def, imgs}
    jsonEspera: null,    // JSON de sprite do jogo esperando o PNG
    contaGotas: false,
  };
  const ui = {};
  let aba = null;

  // ---------------------------------------------------------------- utilidades
  function el(tag, cls, html) { return E.el(tag, cls, html); }
  function texto(tag, cls, t) { const e = el(tag, cls); e.textContent = t; return e; }
  function hex(c) { return '#' + c.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join(''); }
  function deHex(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
  function nomeAnim(t) { return (t || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40); }
  function semExt(n) { return (n || '').split('/').pop().replace(/\.[^.]+$/, '').replace(/\.ffpacote$/, ''); }
  function spritesNovos() { return FF.Edicoes.dados().spritesNovos || {}; }
  function todosSprites() { return FF.Assets.listaSprites(); }
  function spritesDoJogo() { return ((window.FF_BUNDLE && FF_BUNDLE._indice) || {}).sprites || []; }
  function caminhoAtlas(id) { return 'assets/img/usr/' + id + '.png'; }
  function arred(v, n) { const k = Math.pow(10, n || 2); return Math.round(v * k) / k; }
  function temTransparencia(img) {
    const d = img.rgba;
    const passo = Math.max(1, Math.floor(d.length / 4 / 40000)) * 4;
    for (let i = 3; i < d.length; i += passo) if (d[i] < 250) return true;
    return false;
  }
  function carregarImagem(url) {
    return new Promise((ok, falha) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => falha(new Error('Não foi possível abrir a imagem ' + (url.length > 80 ? '' : url)));
      im.src = url;
    });
  }
  function imgDeElemento(im) {
    const c = document.createElement('canvas');
    c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height;
    c.getContext('2d', { willReadFrequently: true }).drawImage(im, 0, 0);
    try { return I.deCanvas(c); } catch (e) { throw new Error('O navegador bloqueou a leitura da imagem (abra o Estúdio pelo site ou importe de novo neste aparelho).'); }
  }
  function confirmar(titulo, msg, ok) {
    return new Promise(res => {
      const c = el('div', 'es-perg');
      c.appendChild(texto('p', '', msg));
      const linha = el('div', 'imp-linha');
      let feito = false;
      const fim = (v) => { if (feito) return; feito = true; res(v); m.fechar(); };
      linha.append(E.botao(ok || 'Sim', () => fim(true), null, 'es-bt-ouro'), E.botao('Cancelar', () => fim(false)));
      c.appendChild(linha);
      const m = E.modal(titulo, c, { aoFechar: () => { if (!feito) { feito = true; res(false); } } });
    });
  }
  // campo numérico compacto para as barras
  function mini(rotulo, valor, aoMudar, opts = {}) {
    const l = el('label', 'imp-mini');
    l.appendChild(texto('span', '', rotulo));
    const i = document.createElement('input');
    i.type = 'number'; i.value = valor;
    if (opts.min != null) i.min = opts.min;
    if (opts.max != null) i.max = opts.max;
    i.step = opts.passo || 1;
    if (opts.dica) l.title = opts.dica;
    i.onchange = () => { if (i.value !== '' && !isNaN(+i.value)) aoMudar(+i.value); };
    l.appendChild(i);
    return l;
  }
  function seletor(lista, valor, aoMudar, dica) {
    const s = document.createElement('select');
    lista.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s.appendChild(o); });
    s.value = String(valor);
    if (dica) s.title = dica;
    s.onchange = () => aoMudar(s.value);
    return s;
  }

  // ---------------------------------------------------------------- importação
  function progresso(frac, msg) {
    if (frac == null) { ui.prog.hidden = true; return; }
    ui.prog.hidden = false;
    ui.progBarra.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
    if (msg) ui.progTxt.textContent = msg;
  }

  async function importar(arquivos) {
    arquivos = [...arquivos].filter(Boolean);
    if (!arquivos.length) return;
    arquivos.sort((a, b) => C.ordemNatural(a.name || '', b.name || ''));
    const imagens = [], jsons = [];
    const erros = [];
    for (let k = 0; k < arquivos.length; k++) {
      const f = arquivos[k];
      progresso(k / arquivos.length, 'Lendo ' + (f.name || 'imagem colada') + '…');
      try {
        const r = await C.decodificarArquivo(f, {
          fps: st.cfg.vfps, maxQuadros: Math.max(1, st.cfg.vmax),
          aoProgresso: (p) => progresso((k + p) / arquivos.length),
        });
        if (r.tipo === 'json') jsons.push({ nome: f.name || 'arquivo.json', texto: r.texto });
        else r.itens.forEach(it => imagens.push(Object.assign({ tipo: r.tipo, arquivo: f.name || 'colada.png' }, it)));
      } catch (e) {
        erros.push((f.name || 'arquivo') + ': ' + e.message);
      }
    }
    progresso(1, 'Montando…');
    try {
      // JSON: pacote antigo ou sprite do jogo (+ PNG)
      for (const j of jsons) await tratarJson(j, imagens);
      if (!jsons.length && st.jsonEspera && imagens.length) await tratarJson(st.jsonEspera, imagens);
      if (imagens.length) carregarImagens(imagens);
    } catch (e) { erros.push(e.message); }
    progresso(null);
    erros.forEach(m => E.aviso('❌ ' + m, 'erro'));
    renderTudo();
  }

  // JSON de sprite do jogo / pacote .ffpacote.json; consome de "imagens" os PNG usados
  async function tratarJson(j, imagens) {
    let d;
    try { d = JSON.parse(j.texto); } catch (e) { throw new Error(j.nome + ': JSON inválido (' + e.message + ').'); }
    if (d && d.formato === 'finalflash-pacote-1') {
      const imgs = [];
      for (const u of d.atlases || []) imgs.push(imgDeElemento(await carregarImagem(u)));
      const def = Object.assign({ anims: {} }, d.def);
      st.pacote = { nome: d.nome || semExt(j.nome), id: E.idSeguro(String(d.id || d.nome || semExt(j.nome)).replace(/^bib:/, '')), def, imgs, origem: 'Pacote do importador antigo' };
      st.jsonEspera = null;
      E.aviso('📦 Pacote "' + st.pacote.nome + '" lido (' + Object.keys(def.anims).length + ' animações).', 'ok');
      return;
    }
    if (d && d.anims && Array.isArray(d.atlases)) {
      const base = (p) => String(p).split('/').pop().toLowerCase();
      const usados = [];
      const imgs = d.atlases.map((p, i) => {
        let k = imagens.findIndex(it => base(it.nome) === base(p) || base(it.arquivo) === base(p));
        if (k < 0 && d.atlases.length === imagens.length) k = i;
        if (k < 0) return null;
        usados.push(imagens[k]);
        return I.deCanvas(imagens[k].quadros[0].canvas);
      });
      if (imgs.some(x => !x)) {
        st.jsonEspera = j;
        E.aviso('🧩 Sprite "' + (d.id || semExt(j.nome)) + '" lido. Agora mande também a(s) imagem(ns): ' + d.atlases.map(base).join(', '), 'erro');
        return;
      }
      usados.forEach(u => imagens.splice(imagens.indexOf(u), 1));
      st.pacote = { nome: d.id || semExt(j.nome), id: E.idSeguro((d.id || semExt(j.nome)) + '_imp'), def: d, imgs, origem: 'Sprite no formato do jogo' };
      st.jsonEspera = null;
      E.aviso('🧩 Sprite "' + st.pacote.nome + '" lido (' + Object.keys(d.anims).length + ' animações).', 'ok');
      return;
    }
    throw new Error(j.nome + ': JSON não reconhecido (esperava um .ffpacote.json ou um sprite do jogo com "atlases" e "anims").');
  }

  function carregarImagens(itens) {
    const juntar = st.cfg.juntar && st.lista.length;
    const total = itens.reduce((n, it) => n + it.quadros.length, 0);
    if (!juntar) limparTrabalho();
    const nome = semExt(itens[0].arquivo || itens[0].nome);
    if (!juntar) {
      st.cfg.id = E.idSeguro(nome);
      if (st.cfg.destino === 'existente') {
        if (!st.cfg.animFixa) {
          const s = FF.Assets.sprites[st.cfg.alvo];
          st.cfg.anim = s && s.def.anims.Parado ? (nomeAnim(nome) || 'Nova') : 'Parado';
        }
      } else st.cfg.anim = 'Parado';
    }
    // uma única imagem parada: talvez seja uma sprite sheet → separar quadros
    if (total === 1 && !juntar) {
      const img = I.deCanvas(itens[0].quadros[0].canvas);
      st.cfg.fundo = !temTransparencia(img);
      abrirFolha(img, itens[0].nome);
      return;
    }
    // várias imagens / animação / vídeo: cada uma vira um quadro
    const atrasos = [];
    itens.forEach(it => it.quadros.forEach(q => atrasos.push(q.atraso || 0)));
    const animado = itens.some(it => it.tipo === 'animacao');
    const video = itens.some(it => it.tipo === 'video');
    let fps = st.cfg.fps;
    if (video) fps = st.cfg.vfps;
    else if (animado) {
      // fps base = atraso mais comum; a duração de cada quadro fica relativa a ele
      const cont = new Map();
      atrasos.forEach(a => { const k = Math.round(a * 1000); cont.set(k, (cont.get(k) || 0) + 1); });
      const comum = [...cont.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0] / 1000 || 0.1;
      fps = Math.max(1, Math.min(60, Math.round(1 / comum)));
    }
    if (!juntar) st.cfg.fps = fps;
    let primeiro = null;
    itens.forEach(it => it.quadros.forEach(q => {
      const id = novoId();
      const img = I.deCanvas(q.canvas);
      if (!primeiro) primeiro = img;
      st.fontes[id] = { img, nome: it.nome };
      const dur = animado && q.atraso ? Math.max(0.1, arred(q.atraso * st.cfg.fps, 2)) : 1;
      st.lista.push({ id, ativo: true, dx: 0, dy: 0, dur });
    }));
    if (!juntar) {
      st.cfg.fundo = !temTransparencia(primeiro);
      st.cfg.alinhar = true;
      st.sel = 0;
    }
    st.vista = 'anim';
    st.tocando = true;
    E.aviso('🎞 ' + total + ' quadro(s) importado(s).', 'ok');
    reprocessar(true);
    aba.historico.zerar('Importar');
  }

  function limparTrabalho() {
    st.fontes = {}; st.lista = []; st.cache = {}; st.res = []; st.folha = null; st.corAuto = undefined;
    st.sel = 0; st.t = 0; st.contaGotas = false;
    st.cfg.corFundo = null; st.cfg.origem = 'pes'; st.cfg.escala = 1; st.cfg.cortar = true; st.cfg.loop = true;
    if (st.cfg.destino === 'existente' && !todosSprites().includes(st.cfg.alvo)) st.cfg.destino = 'novo';
  }

  // ---------------------------------------------------------------- separar quadros (folha)
  function abrirFolha(img, nome) {
    st.folha = { nome, img, caixas: [], cfg: Object.assign({}, PADRAO_FOLHA), proc: null, procChave: '' };
    st.vista = 'folha';
    const proc = folhaProcessada();
    const comp = I.componentes(proc, { juntarDistancia: 2, minArea: 16 });
    const palpite = I.detectarGrade(proc);
    if (palpite) { st.folha.cfg.colunas = palpite.colunas; st.folha.cfg.linhas = palpite.linhas; }
    if (comp.length >= 2 && comp.length <= 400) st.folha.cfg.modo = 'auto';
    else if (palpite) st.folha.cfg.modo = 'grade';
    else st.folha.cfg.modo = 'inteira';
    detectarCaixas();
    if (st.folha.cfg.modo === 'inteira') {
      // uma imagem só (sem quadros para separar): vai direto para a animação
      usarFolha(true);
      return;
    }
    E.aviso('✂ ' + st.folha.caixas.length + ' quadros encontrados. Toque numa caixa para tirar/pôr.', 'ok');
    aba.historico.zerar('Importar');
  }
  function folhaProcessada() {
    const f = st.folha;
    const cor = corEfetiva();
    const chave = JSON.stringify([cor, st.cfg.tol, st.cfg.contiguo]);
    if (f.procChave !== chave) {
      f.proc = cor ? I.removerFundo(f.img, cor, st.cfg.tol, { contiguo: st.cfg.contiguo }) : f.img;
      f.procChave = chave;
      f.canvas = null;
    }
    return f.proc;
  }
  function detectarCaixas() {
    const f = st.folha;
    if (!f) return;
    const proc = folhaProcessada();
    const c = f.cfg;
    let cx;
    if (c.modo === 'auto') cx = I.componentes(proc, { juntarDistancia: c.juntarDist, minArea: c.minArea });
    else if (c.modo === 'grade') cx = I.grade(proc, Math.max(1, c.colunas), Math.max(1, c.linhas), { margem: c.margem, espaco: c.espaco });
    else cx = [{ x: 0, y: 0, w: f.img.largura, h: f.img.altura }];
    f.caixas = cx.map(b => Object.assign({ off: false }, b));
    f.sujo = true;
    renderFolhaInfo();
  }
  function usarFolha(silencioso) {
    const f = st.folha;
    const caixas = f.caixas.filter(b => !b.off);
    if (!caixas.length) return E.aviso('Nenhum quadro escolhido.', 'erro');
    // guarda a cor automática da folha inteira (os recortes podem não ter borda suficiente)
    if (st.corAuto === undefined) corEfetiva();
    st.fontes = {}; st.lista = []; st.cache = {};
    caixas.forEach((b, i) => {
      const id = novoId();
      st.fontes[id] = { img: I.recortar(f.img, b), nome: f.nome + ' #' + (i + 1) };
      st.lista.push({ id, ativo: true, dx: 0, dy: 0, dur: 1 });
    });
    // grade (células do mesmo tamanho) → mantém o alinhamento; automático → cada quadro pelos pés
    st.cfg.alinhar = f.cfg.modo !== 'auto';
    st.sel = 0; st.t = 0; st.tocando = true;
    st.vista = 'anim';
    if (!silencioso) E.aviso('🎞 ' + caixas.length + ' quadro(s) prontos para a animação.', 'ok');
    reprocessar(true);
    aba.historico.zerar('Separar quadros');
    renderTudo();
  }

  // ---------------------------------------------------------------- tratamento
  function corEfetiva() {
    if (!st.cfg.fundo) return null;
    if (st.cfg.corFundo) return st.cfg.corFundo;
    if (st.corAuto === undefined) {
      const base = st.folha ? st.folha.img : (st.lista[0] && st.fontes[st.lista[0].id] && st.fontes[st.lista[0].id].img);
      if (!base) return null;
      const c = I.corDeFundo(base);
      st.corAuto = c[3] === 0 ? null : c.slice(0, 3);
    }
    return st.corAuto;
  }

  let tmReproc = 0;
  function reprocessar(agora) {
    clearTimeout(tmReproc);
    if (agora) return processar();
    tmReproc = setTimeout(() => { processar(); renderDir(); renderTira(); }, 80);
  }
  function processar() {
    const cfg = st.cfg;
    const cor = corEfetiva();
    const chave = JSON.stringify([cor, cfg.tol, cfg.contiguo, cfg.cortar]);
    const ativos = st.lista.filter(q => q.ativo && st.fontes[q.id]);
    ativos.forEach(q => {
      let c = st.cache[q.id];
      if (c && c.chave === chave) return;
      const fo = st.fontes[q.id];
      let img = cor ? I.removerFundo(fo.img, cor, cfg.tol, { contiguo: cfg.contiguo }) : fo.img;
      const a = I.aparar(img);
      const vazio = a.largura === 1 && a.altura === 1 && a.x === 0 && a.y === 0 && img.rgba[3] === 0;
      const conteudo = vazio ? { x: 0, y: 0, w: img.largura, h: img.altura } : { x: a.x, y: a.y, w: a.largura, h: a.altura };
      let tx = 0, ty = 0;
      if (cfg.cortar && !vazio) { img = a.img; tx = a.x; ty = a.y; }
      c = st.cache[q.id] = { chave, base: img, tx, ty, conteudo, W: fo.img.largura, H: fo.img.altura, escalas: {} };
    });
    const s = cfg.escala;
    // ponto de referência comum (alinhamento entre quadros do mesmo tamanho de célula)
    let comum = null;
    if (cfg.alinhar && cfg.origem !== 'original' && ativos.length) {
      const c0 = st.cache[ativos[0].id];
      if (ativos.every(q => st.cache[q.id].W === c0.W && st.cache[q.id].H === c0.H)) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        ativos.forEach(q => { const b = st.cache[q.id].conteudo; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); });
        comum = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
    }
    st.res = ativos.map(q => {
      const c = st.cache[q.id];
      const fo = st.fontes[q.id];
      if (!c.escalas[s]) {
        const img = s === 1 ? c.base : I.escalar(c.base, s, false);
        c.escalas[s] = { img, canvas: null };
      }
      const e = c.escalas[s];
      let px, py;
      if (cfg.origem === 'original' && fo.orig) { px = fo.orig[0]; py = fo.orig[1]; }
      else {
        const b = comum || c.conteudo;
        px = b.x + b.w / 2;
        py = cfg.origem === 'centro' ? b.y + b.h / 2 : b.y + b.h;
      }
      const ox = Math.round((px - c.tx) * s) - q.dx;
      const oy = Math.round((py - c.ty) * s) - q.dy;
      const pontos = fo.pontos && s === 1 && !c.tx && !c.ty ? fo.pontos : undefined;
      return { id: q.id, img: e.img, ox, oy, dur: q.dur || 1, cv: e, tx: c.tx, ty: c.ty, s, pontos };
    });
    if (st.sel >= st.lista.length) st.sel = Math.max(0, st.lista.length - 1);
  }
  function canvasDe(r) {
    if (!r.cv.canvas) r.cv.canvas = I.paraCanvas(r.img);
    return r.cv.canvas;
  }
  // resultado (índice em st.res) do quadro selecionado na lista
  function resSel() {
    const q = st.lista[st.sel];
    return q ? st.res.findIndex(r => r.id === q.id) : -1;
  }
  function tamanhoAtlas() {
    if (!st.res.length) return null;
    const vistos = new Set(), imgs = [];
    st.res.forEach(r => { if (!vistos.has(r.img)) { vistos.add(r.img); imgs.push(r.img); } });
    let area = 0, maiorW = 0, maiorH = 0;
    imgs.forEach(im => { area += (im.largura + 1) * (im.altura + 1); maiorW = Math.max(maiorW, im.largura); maiorH = Math.max(maiorH, im.altura); });
    return { area, maiorW, maiorH, lado: Math.ceil(Math.sqrt(area * 1.15)) };
  }

  // ---------------------------------------------------------------- mudar config (com desfazer)
  function mudar(k, v, opts = {}) {
    st.cfg[k] = v;
    const proc = ['fundo', 'corFundo', 'tol', 'contiguo', 'cortar', 'escala', 'origem', 'alinhar'].includes(k);
    if (proc) {
      if (st.vista === 'folha' && st.folha && ['fundo', 'corFundo', 'tol', 'contiguo'].includes(k)) { detectarCaixas(); }
      reprocessar(!opts.depois);
    }
    if (!opts.semHist) aba.historico.marcar(opts.rotulo || 'Alterar ' + k, opts.juntar);
    if (!opts.semRender) { renderDir(); renderTira(); renderBarra(); }
  }
  function mudarQuadro(campo, v, rotulo, juntar) {
    const q = st.lista[st.sel];
    if (!q) return;
    q[campo] = v;
    reprocessar(true);
    aba.historico.marcar(rotulo || 'Quadro', juntar);
  }

  // ---------------------------------------------------------------- salvar
  // carrega os quadros de um sprite (def + imagens já lidas) → {nome: {fps, loop, repeatTo, frames: [{img, ox, oy, dur, pontos}]}}
  function quadrosDoSprite(def, imgs) {
    const cache = new Map(), anims = {};
    Object.entries(def.anims || {}).forEach(([nome, a]) => {
      anims[nome] = {
        fps: a.fps, loop: a.loop, repeatTo: a.repeatTo || 0, pingpong: !!a.pingpong,
        frames: (a.frames || []).map(f => {
          const k = f.slice(0, 5).join(',');
          if (!cache.has(k)) {
            const src = imgs[f[0]];
            cache.set(k, src ? I.recortar(src, { x: f[1], y: f[2], w: Math.max(1, f[3]), h: Math.max(1, Math.abs(f[4])) }) : I.criar(1, 1));
          }
          return { img: cache.get(k), ox: f[5], oy: f[6], dur: f[7] || 1, pontos: f[8] };
        }),
      };
    });
    return anims;
  }


  // empacota, grava a imagem no aparelho e a definição no jogo; devolve {def, set, pk}
  async function gravarSprite(id, anims, extra) {
    const imgs = [], idx = new Map();
    Object.values(anims).forEach(a => a.frames.forEach(f => { if (!idx.has(f.img)) { idx.set(f.img, imgs.length); imgs.push(f.img); } }));
    if (!imgs.length) throw new Error('Nenhum quadro para salvar.');
    const pk = I.empacotar(imgs, { margem: 1, larguraMax: 2048 });
    if (pk.largura > MAX_ATLAS || pk.altura > MAX_ATLAS) {
      throw new Error('O atlas ficaria com ' + pk.largura + '×' + pk.altura + ' px (máximo ' + MAX_ATLAS + '). Diminua a escala (ex.: 0,5×), corte as bordas ou use menos quadros.');
    }
    const caminho = caminhoAtlas(id);
    const def = Object.assign({ id, atlases: [caminho] }, extra || {}, { anims: {} });
    Object.entries(anims).forEach(([nome, a]) => {
      def.anims[nome] = {
        fps: a.fps || 0, loop: !!a.loop, repeatTo: a.repeatTo || 0, pingpong: false,
        frames: a.frames.map(f => {
          const p = pk.posicoes[idx.get(f.img)];
          const q = [0, p.x, p.y, f.img.largura, f.img.altura, Math.round(f.ox), Math.round(f.oy), arred(f.dur || 1, 3)];
          if (f.pontos) q.push(f.pontos);
          return q;
        }),
      };
    });
    const blob = await C.canvasParaPng(I.paraCanvas(pk));
    await FF.ImagensUsr.gravar(caminho, blob, false);
    E.salvarNoJogo(['spritesNovos', id], def, '📥 Sprite importado.');
    FF.Assets.descarregarSprite(id);
    const set = await FF.Assets.loadSprite(id);
    if (!set || !set.images[0] || !set.images[0].width) throw new Error('O sprite foi salvo, mas não carregou de volta.');
    return { def, set, pk };
  }

  async function checarIdNovo(id) {
    if (!id) { E.aviso('Dê um nome (id) ao sprite.', 'erro'); return false; }
    if (spritesDoJogo().includes(id)) { E.aviso('Já existe um sprite do jogo chamado "' + id + '". Escolha outro nome.', 'erro'); return false; }
    if (spritesNovos()[id]) return confirmar('Substituir sprite?', 'Já existe um sprite importado "' + id + '". Substituir por este (todas as animações dele serão trocadas)?', 'Substituir');
    return true;
  }

  async function salvar() {
    if (st.vista === 'folha') usarFolha(true);
    processar();
    if (!st.res.length) return E.aviso('Nenhum quadro para salvar.', 'erro');
    const anim = nomeAnim(st.cfg.anim);
    if (!anim) return E.aviso('Dê um nome à animação.', 'erro');
    const nova = { fps: st.cfg.fps, loop: st.cfg.loop, repeatTo: 0, frames: st.res.map(r => ({ img: r.img, ox: r.ox, oy: r.oy, dur: r.dur, pontos: r.pontos })) };
    const tipo = st.cfg.origem === 'centro' ? 'efeito' : 'lutador';
    let id, anims, extra = { tipo };
    ui.salvar.disabled = true;
    try {
      if (st.cfg.destino === 'existente') {
        // animação num sprite que já existe (do jogo ou importado): imagens num atlas extra
        id = st.cfg.alvo;
        if (!todosSprites().includes(id)) throw new Error('Escolha o sprite que vai receber a animação.');
        const set = await FF.Assets.loadSprite(id);
        if (set.def.anims[anim] && !(await confirmar('Substituir animação?', 'O sprite "' + id + '" já tem a animação "' + anim + '". Substituir?', 'Substituir'))) return;
        const r = await FF.EstudioArq.quadrosParaSprite(id, nova.frames);
        FF.EstudioArq.salvarAnim(id, anim, { fps: nova.fps, loop: nova.loop, repeatTo: 0, frames: r.frames });
        E.aviso('📥 Animação "' + anim + '" salva em "' + id + '".' + (FF.Edicoes.conectado() ? ' Enviando para todos os aparelhos…' : ' (só neste aparelho até conectar o ☁)'), 'ok');
        E.renderSync();
        terminou(id, anim);
        return;
      }
      id = E.idSeguro(st.cfg.id);
      if (!(await checarIdNovo(id))) return;
      anims = { [anim]: nova };
      await gravarSprite(id, anims, extra);
      st.cfg.destino = 'existente'; st.cfg.alvo = id;
      terminou(id, anim);
    } catch (e) {
      E.aviso('❌ ' + e.message, 'erro');
    } finally {
      ui.salvar.disabled = false;
    }
  }

  // salvo: limpa a área de trabalho e volta para a aba Sprites com a animação aberta
  function terminou(id, anim) {
    limparTrabalho();
    st.vista = 'vazio';
    st.pacote = null;
    st.cfg.animFixa = false;
    aba.historico.zerar('');
    renderTudo();
    if (aba.aoSalvar) aba.aoSalvar(id, anim);
  }

  // pacote antigo / sprite do jogo inteiro → sprite novo
  async function salvarPacote() {
    const p = st.pacote;
    if (!p) return;
    const id = await E.perguntar('Salvar como sprite novo', 'Nome (id) do sprite novo:', p.id);
    if (id == null) return;
    const sid = E.idSeguro(id);
    if (!(await checarIdNovo(sid))) return;
    try {
      const anims = quadrosDoSprite(p.def, p.imgs);
      const extra = {};
      if (p.def.escala) extra.escala = p.def.escala;
      const r = await gravarSprite(sid, anims, extra);
      const primeira = Object.keys(r.def.anims)[0];
      st.pacote = null;
      renderPacote();
      terminou(sid, primeira);
    } catch (e) { E.aviso('❌ ' + e.message, 'erro'); }
  }

  // leva uma animação (de um pacote ou de um sprite importado) para a área de trabalho
  function editarAnimacao(anims, nome, destino) {
    const a = anims[nome];
    if (!a) return;
    limparTrabalho();
    a.frames.forEach(f => {
      const id = novoId();
      st.fontes[id] = { img: f.img, nome: nome, orig: [f.ox, f.oy], pontos: f.pontos };
      st.lista.push({ id, ativo: true, dx: 0, dy: 0, dur: f.dur || 1 });
    });
    st.cfg.origem = 'original'; st.cfg.fundo = false; st.cfg.cortar = false; st.cfg.escala = 1;
    st.cfg.fps = a.fps || 10; st.cfg.loop = !!a.loop; st.cfg.anim = nome;
    if (destino) { st.cfg.destino = 'existente'; st.cfg.alvo = destino; }
    else { st.cfg.destino = 'novo'; }
    st.vista = 'anim'; st.tocando = true;
    reprocessar(true);
    aba.historico.zerar('Editar ' + nome);
    renderTudo();
  }

  // ---------------------------------------------------------------- interface: montagem
  function montar(raiz) {
    raiz.classList.add('imp');
    // ----- esquerda
    const esq = el('div', 'es-lado imp-esq');
    const voltar = E.botao('← Voltar aos sprites', () => { if (aba.aoFechar) aba.aoFechar(); }, 'Fecha o importador (Esc). O que está sendo importado fica guardado até você voltar.', 'imp-voltar');
    esq.appendChild(voltar);
    esq.appendChild(texto('div', 'es-titulo', '📥 Importar do computador'));
    const rolE = el('div', 'es-rolar');
    ui.input = document.createElement('input');
    ui.input.type = 'file'; ui.input.multiple = true; ui.input.hidden = true;
    ui.input.className = 'imp-input';
    ui.input.onchange = () => { const l = [...ui.input.files]; ui.input.value = ''; importar(l); };
    rolE.appendChild(ui.input);
    rolE.appendChild(E.botao('📂 Escolher arquivos', () => ui.input.click(), 'Qualquer imagem, GIF, vídeo, ZIP ou pacote', 'es-bt-ouro imp-escolher'));
    rolE.appendChild(texto('p', 'es-dica', 'Ou arraste para cá, ou cole uma imagem (Ctrl+V).'));
    const gv = E.grupo('Opções de leitura', false);
    gv.appendChild(E.campo('numero', 'Vídeo: fps', st.cfg.vfps, v => { if (v > 0) st.cfg.vfps = Math.min(60, v); }, { min: 1, max: 60, passo: 1, dica: 'Quantos quadros por segundo tirar de um vídeo' }));
    gv.appendChild(E.campo('numero', 'Máx. quadros', st.cfg.vmax, v => { if (v > 0) st.cfg.vmax = Math.min(600, Math.round(v)); }, { min: 1, max: 600, passo: 1, dica: 'Limite de quadros por vídeo/animação' }));
    gv.appendChild(E.campo('check', 'Juntar aos atuais', st.cfg.juntar, v => { st.cfg.juntar = v; }, { dica: 'Os quadros novos entram no fim da animação atual em vez de substituí-la' }));
    rolE.appendChild(gv);
    ui.pacote = el('div', 'imp-pacote');
    rolE.appendChild(ui.pacote);
    rolE.appendChild(texto('p', 'es-dica', 'Depois de salvar, o sprite abre na aba Sprites: lá dá para editar os quadros, criar mais animações, mudar o tamanho, exportar e apagar.'));
    esq.appendChild(rolE);

    // ----- centro
    const cen = el('div', 'es-centro imp-centro');
    ui.barra = el('div', 'es-barra imp-barra');
    cen.appendChild(ui.barra);
    // vazio
    ui.vazio = el('div', 'imp-solte');
    ui.vazio.innerHTML = '<div class="imp-solte-caixa"><b>Solte os arquivos aqui</b><span>PNG · JPG · GIF/WebP/APNG animados · BMP · SVG · AVIF · sprite sheet · várias imagens (um quadro cada) · vídeo MP4/WebM · ZIP de imagens · .ffpacote.json · JSON de sprite do jogo + PNG</span></div>';
    ui.vazio.querySelector('.imp-solte-caixa').appendChild(E.botao('📂 Escolher arquivos', () => ui.input.click(), null, 'es-bt-ouro'));
    ui.vazio.querySelector('.imp-solte-caixa').appendChild(texto('small', '', 'Dica: cole uma imagem com Ctrl+V.'));
    cen.appendChild(ui.vazio);
    // folha
    ui.folha = el('div', 'imp-folha');
    ui.folhaBarra = el('div', 'es-barra imp-folha-barra');
    ui.folhaRolar = el('div', 'imp-folha-rolar');
    ui.folhaCv = document.createElement('canvas');
    ui.folhaCv.className = 'imp-folha-cv';
    ui.folhaRolar.appendChild(ui.folhaCv);
    ui.folha.append(ui.folhaBarra, ui.folhaRolar);
    ui.folhaCv.addEventListener('click', cliqueFolha);
    cen.appendChild(ui.folha);
    // animação
    ui.anim = el('div', 'imp-anim');
    ui.palco = el('div', 'es-palco-wrap imp-palco');
    ui.cv = document.createElement('canvas');
    ui.cv.width = 600; ui.cv.height = 360;
    ui.info = el('div', 'es-palco-info');
    ui.palco.append(ui.cv, ui.info);
    ui.tira = el('div', 'imp-tira');
    ui.anim.append(ui.palco, ui.tira);
    cen.appendChild(ui.anim);
    // progresso
    ui.prog = el('div', 'imp-prog');
    ui.prog.innerHTML = '<div class="imp-prog-caixa"><span></span><div class="imp-prog-trilho"><div></div></div></div>';
    ui.progTxt = ui.prog.querySelector('span');
    ui.progBarra = ui.prog.querySelector('.imp-prog-trilho > div');
    ui.prog.hidden = true;
    cen.appendChild(ui.prog);
    // arrastando
    ui.arrasto = el('div', 'imp-arrasto', '<b>📥 Solte para importar</b>');
    ui.arrasto.hidden = true;
    cen.appendChild(ui.arrasto);

    // ----- direita
    const dir = el('div', 'es-lado dir imp-dir');
    ui.dir = el('div', 'es-rolar');
    dir.appendChild(ui.dir);
    ui.salvar = E.botao('📥 Salvar no jogo', () => salvar(), 'Empacota os quadros num atlas e salva o sprite', 'es-bt-ouro imp-salvar');
    const rodape = el('div', 'imp-rodape');
    rodape.appendChild(ui.salvar);
    dir.appendChild(rodape);

    raiz.append(esq, cen, dir);

    // eventos de arquivos
    let cont = 0;
    raiz.addEventListener('dragenter', (e) => { if (!temArquivos(e)) return; e.preventDefault(); cont++; ui.arrasto.hidden = false; });
    raiz.addEventListener('dragover', (e) => { if (!temArquivos(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    raiz.addEventListener('dragleave', () => { cont = Math.max(0, cont - 1); if (!cont) ui.arrasto.hidden = true; });
    raiz.addEventListener('drop', (e) => {
      if (!temArquivos(e)) return;
      e.preventDefault(); cont = 0; ui.arrasto.hidden = true;
      importar([...e.dataTransfer.files]);
    });
    document.addEventListener('paste', (e) => {
      if (!aba.aberto || e.defaultPrevented || E.digitando(e) || document.querySelector('.es-modal')) return;
      const fs = [...((e.clipboardData && e.clipboardData.files) || [])];
      if (!fs.length && e.clipboardData) [...e.clipboardData.items].forEach(it => { if (it.kind === 'file') { const f = it.getAsFile(); if (f) fs.push(f); } });
      if (!fs.length) return;
      e.preventDefault();
      importar(fs.map((f, i) => f.name && f.name !== 'image.png' ? f : new File([f], 'colada' + (fs.length > 1 ? '_' + (i + 1) : '') + '.' + ((f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')), { type: f.type })));
    });
    // prévia: arrastar ajusta a origem do quadro; conta-gotas
    instalarArrastoPrevia();
    renderTudo();
  }
  function temArquivos(e) { return e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files'); }

  // ---------------------------------------------------------------- interface: render
  function renderTudo() {
    ui.vazio.hidden = st.vista !== 'vazio';
    ui.folha.hidden = st.vista !== 'folha';
    ui.anim.hidden = st.vista !== 'anim';
    renderBarra(); renderFolhaBarra(); renderTira(); renderDir(); renderPacote();
    if (st.folha) st.folha.sujo = true;
  }

  function renderBarra() {
    const b = ui.barra;
    b.innerHTML = '';
    const temFolha = !!st.folha;
    const bF = E.botao('✂ Separar quadros', () => { if (!st.folha) return; st.vista = 'folha'; st.folha.sujo = true; renderTudo(); }, temFolha ? 'Voltar para a folha e escolher os quadros' : 'Importe uma sprite sheet (imagem única) para separar');
    bF.disabled = !temFolha; bF.classList.toggle('sel', st.vista === 'folha');
    const bA = E.botao('🎞 Animação', () => { if (st.vista === 'folha') usarFolha(); else if (st.lista.length) { st.vista = 'anim'; renderTudo(); } }, 'Tratamento e prévia');
    bA.disabled = !st.lista.length && !temFolha; bA.classList.toggle('sel', st.vista === 'anim');
    b.append(bF, bA);
    if (st.vista === 'anim' && st.lista.length) {
      b.appendChild(el('span', 'sep'));
      b.appendChild(E.botao(st.tocando ? '⏸' : '▶', () => { st.tocando = !st.tocando; renderBarra(); }, 'Tocar/pausar (espaço)', 'imp-play'));
      b.appendChild(E.botao('⏮', () => selQuadro(st.sel - 1), 'Quadro anterior (←)'));
      b.appendChild(E.botao('⏭', () => selQuadro(st.sel + 1), 'Próximo quadro (→)'));
      b.appendChild(el('span', 'sep'));
      b.appendChild(seletor([['0', 'Zoom auto'], ['1', '1×'], ['2', '2×'], ['3', '3×'], ['4', '4×'], ['6', '6×']], st.cfg.zoom, v => { st.cfg.zoom = +v; }, 'Zoom da prévia'));
      b.appendChild(seletor([['xadrez', '▦ Xadrez'], ['escuro', '■ Escuro'], ['cenario', '⛰ Cenário']], st.cfg.previaFundo, v => { st.cfg.previaFundo = v; }, 'Fundo da prévia'));
      const g = el('label', '', '');
      const ch = document.createElement('input'); ch.type = 'checkbox'; ch.checked = st.cfg.goku;
      ch.onchange = () => { st.cfg.goku = ch.checked; };
      g.append(ch, texto('span', '', 'Goku p/ comparar'));
      g.title = 'Mostra o Goku do jogo (parado) no mesmo tamanho, para comparar';
      b.appendChild(g);
    }
    const cg = E.botao('💧', () => { st.contaGotas = !st.contaGotas; if (st.contaGotas && !st.cfg.fundo) mudar('fundo', true, { semRender: true }); renderBarra(); renderDir(); E.aviso(st.contaGotas ? '💧 Toque na cor de fundo (na folha ou na prévia).' : 'Conta-gotas desligado.'); }, 'Conta-gotas: escolher a cor de fundo tocando na imagem', st.contaGotas ? 'on' : '');
    cg.disabled = !st.lista.length && !st.folha;
    b.appendChild(el('span', 'sep'));
    b.appendChild(cg);
    if (st.lista.length || st.folha) b.appendChild(E.botao('🗑', async () => { if (await confirmar('Limpar', 'Descartar os quadros que estão sendo importados?', 'Descartar')) { limparTrabalho(); st.vista = 'vazio'; aba.historico.zerar(''); renderTudo(); } }, 'Descartar a importação atual'));
  }

  function renderFolhaBarra() {
    const b = ui.folhaBarra;
    b.innerHTML = '';
    const f = st.folha;
    if (!f) return;
    const c = f.cfg;
    const re = (k) => (v) => { c[k] = v; detectarCaixas(); renderFolhaBarra(); };
    b.appendChild(seletor([['auto', 'Automático (pedaços)'], ['grade', 'Grade'], ['inteira', 'Imagem inteira']], c.modo, re('modo'), 'Como separar os quadros'));
    if (c.modo === 'auto') {
      b.appendChild(mini('Juntar até', c.juntarDist, re('juntarDist'), { min: 0, max: 64, dica: 'Pedaços a esta distância (px) viram um quadro só (cabelo, faíscas soltas…)' }));
      b.appendChild(mini('Área mín.', c.minArea, re('minArea'), { min: 1, dica: 'Ignora sujeiras menores que isto (px²)' }));
    } else if (c.modo === 'grade') {
      b.appendChild(mini('Col.', c.colunas, re('colunas'), { min: 1, max: 256 }));
      b.appendChild(mini('Lin.', c.linhas, re('linhas'), { min: 1, max: 256 }));
      b.appendChild(mini('Margem', c.margem, re('margem'), { min: 0 }));
      b.appendChild(mini('Espaço', c.espaco, re('espaco'), { min: 0 }));
      b.appendChild(E.botao('🔍 Palpite', () => {
        const g = I.detectarGrade(folhaProcessada());
        if (!g) return E.aviso('Não achei uma grade regular nesta imagem.', 'erro');
        c.colunas = g.colunas; c.linhas = g.linhas; c.margem = 0; c.espaco = 0; detectarCaixas(); renderFolhaBarra();
        E.aviso('Grade sugerida: ' + g.colunas + ' × ' + g.linhas, 'ok');
      }, 'Adivinhar colunas e linhas'));
    }
    b.appendChild(el('span', 'sep'));
    b.appendChild(E.botao('Todos', () => { f.caixas.forEach(x => (x.off = false)); f.sujo = true; renderFolhaInfo(); }, 'Usar todas as caixas'));
    b.appendChild(E.botao('Nenhum', () => { f.caixas.forEach(x => (x.off = true)); f.sujo = true; renderFolhaInfo(); }, 'Tirar todas (depois toque nas que quer)'));
    b.appendChild(seletor([['0', 'Ajustar'], ['1', '1×'], ['2', '2×'], ['3', '3×'], ['4', '4×']], c.zoom, (v) => { c.zoom = +v; f.sujo = true; }, 'Zoom da folha'));
    ui.folhaInfo = texto('span', 'imp-folha-info', '');
    b.appendChild(ui.folhaInfo);
    const usar = E.botao('Usar quadros ▶', () => usarFolha(), 'Levar os quadros escolhidos para a animação', 'es-bt-ouro imp-usar');
    b.appendChild(usar);
    renderFolhaInfo();
  }
  function renderFolhaInfo() {
    if (!ui.folhaInfo || !st.folha) return;
    const n = st.folha.caixas.filter(x => !x.off).length;
    ui.folhaInfo.textContent = st.folha.img.largura + '×' + st.folha.img.altura + ' px · ' + n + ' de ' + st.folha.caixas.length + ' quadros';
    const u = ui.folhaBarra.querySelector('.imp-usar');
    if (u) u.textContent = 'Usar ' + n + ' quadro' + (n === 1 ? '' : 's') + ' ▶';
  }

  function zoomFolha() {
    const f = st.folha;
    if (f.cfg.zoom) return f.cfg.zoom;
    const w = ui.folhaRolar.clientWidth - 16, h = ui.folhaRolar.clientHeight - 16;
    const z = Math.min(w / f.img.largura, h / f.img.altura);
    return z >= 3 ? Math.min(6, Math.floor(z)) : Math.max(0.1, z);
  }
  function desenharFolha() {
    const f = st.folha;
    if (!f || st.vista !== 'folha') return;
    const z = zoomFolha();
    if (!f.sujo && f._z === z) return;
    f.sujo = false; f._z = z;
    const proc = folhaProcessada();
    if (!f.canvas) f.canvas = I.paraCanvas(proc);
    const cv = ui.folhaCv;
    const W = Math.max(1, Math.round(f.img.largura * z)), H = Math.max(1, Math.round(f.img.altura * z));
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    xadrez(g, W, H, 8);
    g.drawImage(f.canvas, 0, 0, W, H);
    let k = 0;
    g.font = 'bold 11px sans-serif';
    f.caixas.forEach((c) => {
      const x = c.x * z, y = c.y * z, w = c.w * z, h = c.h * z;
      if (c.off) {
        g.fillStyle = 'rgba(10,5,20,0.55)'; g.fillRect(x, y, w, h);
        g.strokeStyle = 'rgba(255,90,90,0.8)'; g.setLineDash([4, 3]); g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); g.setLineDash([]);
        return;
      }
      k++;
      g.strokeStyle = '#ffd84a'; g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2));
      const t = String(k), tw = g.measureText(t).width + 6;
      g.fillStyle = '#ffd84a'; g.fillRect(x, y, tw, 14);
      g.fillStyle = '#2a1300'; g.fillText(t, x + 3, y + 11);
    });
  }
  function posNaFolha(e) {
    const cv = ui.folhaCv, r = cv.getBoundingClientRect(), z = zoomFolha();
    return { x: (e.clientX - r.left) * (cv.width / r.width) / z, y: (e.clientY - r.top) * (cv.height / r.height) / z };
  }
  function cliqueFolha(e) {
    const f = st.folha;
    if (!f) return;
    const p = posNaFolha(e);
    if (st.contaGotas) {
      const c = I.corEm(f.img, p.x, p.y);
      escolherCor(c);
      return;
    }
    const i = f.caixas.findIndex(c => p.x >= c.x && p.x < c.x + c.w && p.y >= c.y && p.y < c.y + c.h);
    if (i < 0) return;
    f.caixas[i].off = !f.caixas[i].off;
    f.sujo = true;
    renderFolhaInfo();
  }
  function escolherCor(c) {
    st.contaGotas = false;
    if (c[3] === 0) { E.aviso('Esse ponto já é transparente.', 'erro'); renderBarra(); return; }
    st.cfg.fundo = true;
    mudar('corFundo', c.slice(0, 3), { rotulo: 'Cor de fundo' });
    E.aviso('💧 Cor de fundo: ' + hex(c), 'ok');
  }

  function renderDir() {
    const d = ui.dir;
    if (!d) return;
    const rol = d.scrollTop;
    d.innerHTML = '';
    const cfg = st.cfg;
    const tem = st.lista.length || st.folha;
    // ---- fundo
    const gF = E.grupo('🎨 Fundo');
    gF.appendChild(E.campo('check', 'Remover cor', cfg.fundo, v => mudar('fundo', v, { rotulo: 'Remover fundo' }), { dica: 'Deixa transparente a cor de fundo da imagem' }));
    if (cfg.fundo) {
      const linha = el('div', 'imp-linha imp-cor');
      const cor = corEfetiva();
      const am = el('span', 'imp-amostra');
      am.style.background = cor ? hex(cor) : 'transparent';
      am.title = cor ? hex(cor) : 'sem cor (a borda já é transparente)';
      linha.appendChild(am);
      linha.appendChild(texto('span', '', cfg.corFundo ? hex(cfg.corFundo) : 'Automática' + (cor ? ' (' + hex(cor) + ')' : '')));
      const inp = document.createElement('input'); inp.type = 'color'; inp.value = cor ? hex(cor) : '#ff00ff';
      inp.title = 'Escolher a cor';
      inp.onchange = () => mudar('corFundo', deHex(inp.value), { rotulo: 'Cor de fundo' });
      linha.appendChild(inp);
      linha.appendChild(E.botao('💧', () => { st.contaGotas = !st.contaGotas; renderBarra(); renderDir(); if (st.contaGotas) E.aviso('💧 Toque na cor de fundo (na folha ou na prévia).'); }, 'Conta-gotas', st.contaGotas ? 'on' : ''));
      if (cfg.corFundo) linha.appendChild(E.botao('Auto', () => mudar('corFundo', null, { rotulo: 'Cor automática' }), 'Voltar à cor automática (a mais comum na borda)'));
      gF.appendChild(linha);
      const lt = el('label', 'es-campo');
      lt.appendChild(texto('span', 'es-rot', 'Tolerância'));
      const r = document.createElement('input'); r.type = 'range'; r.min = 0; r.max = 160; r.value = cfg.tol;
      const n = texto('b', 'imp-val', String(cfg.tol));
      r.oninput = () => { n.textContent = r.value; st.cfg.tol = +r.value; reprocessar(); if (st.folha) { detectarCaixasDepois(); } };
      r.onchange = () => { mudar('tol', +r.value, { rotulo: 'Tolerância', juntar: true }); };
      lt.append(r, n);
      gF.appendChild(lt);
      gF.appendChild(E.campo('check', 'Só o ligado à borda', cfg.contiguo, v => mudar('contiguo', v, { rotulo: 'Fundo contíguo' }), { dica: 'Remove só o fundo que encosta na borda (não apaga a mesma cor dentro do desenho, ex.: olhos)' }));
    }
    d.appendChild(gF);
    // ---- quadros
    const gQ = E.grupo('🎞 Quadros');
    gQ.appendChild(E.campo('check', 'Cortar bordas', cfg.cortar, v => mudar('cortar', v, { rotulo: 'Cortar bordas' }), { dica: 'Corta o espaço vazio em volta de cada quadro (atlas menor)' }));
    gQ.appendChild(E.campo('select', 'Escala', String(cfg.escala), v => mudar('escala', +v, { rotulo: 'Escala' }), { lista: ESCALAS.map(s => [String(s), String(s).replace('.', ',') + '×']), dica: 'Redimensiona os pixels (vizinho mais próximo)' }));
    const temOrig = st.lista.some(q => st.fontes[q.id] && st.fontes[q.id].orig);
    const orgs = [['pes', 'Pés (lutador)'], ['centro', 'Centro (efeito)']];
    if (temOrig) orgs.push(['original', 'Original do sprite']);
    gQ.appendChild(E.campo('select', 'Origem', cfg.origem, v => mudar('origem', v, { rotulo: 'Origem' }), { lista: orgs, dica: 'Ponto que fica no chão/na posição do personagem: pés (centro-baixo) ou centro' }));
    if (cfg.origem !== 'original') gQ.appendChild(E.campo('check', 'Manter alinhamento', cfg.alinhar, v => mudar('alinhar', v, { rotulo: 'Alinhamento' }), { dica: 'Quadros do mesmo tamanho (GIF, vídeo, grade) usam o mesmo ponto de origem e não "tremem"' }));
    gQ.appendChild(E.campo('numero', 'FPS', cfg.fps, (v, dig) => { if (!(v > 0)) return; st.cfg.fps = Math.min(60, v); if (!dig) mudar('fps', st.cfg.fps, { rotulo: 'FPS' }); }, { min: 1, max: 60, passo: 1 }));
    gQ.appendChild(E.campo('check', 'Repetir (loop)', cfg.loop, v => mudar('loop', v, { rotulo: 'Loop' })));
    if (st.res.length) {
      const t = tamanhoAtlas();
      const dur = st.res.reduce((s, r) => s + r.dur, 0) / cfg.fps;
      const info = texto('p', 'es-dica', st.res.length + ' quadros · ' + arred(dur, 2) + ' s · maior quadro ' + t.maiorW + '×' + t.maiorH + ' px · atlas ≈ ' + t.lado + ' px');
      if (t.lado > MAX_ATLAS * 0.95 || t.maiorW > MAX_ATLAS || t.maiorH > MAX_ATLAS) { info.classList.add('imp-alerta'); info.textContent += ' — grande demais! Diminua a escala.'; }
      gQ.appendChild(info);
    }
    d.appendChild(gQ);
    // ---- quadro selecionado
    const q = st.lista[st.sel];
    if (q && st.vista === 'anim') {
      const gS = E.grupo('🖼 Quadro ' + (st.sel + 1) + ' de ' + st.lista.length);
      gS.appendChild(E.campo('numero', 'Duração', q.dur, (v, dig) => { if (!(v > 0)) return; mudarQuadro('dur', v, 'Duração', true); if (!dig) renderDir(); }, { min: 0.1, passo: 0.25, dica: 'Em quadros do fps (1 = normal, 2 = fica o dobro do tempo)' }));
      gS.appendChild(E.campo('numero', 'Ajuste X', q.dx, (v, dig) => { mudarQuadro('dx', Math.round(v || 0), 'Ajuste X', true); if (!dig) renderDir(); }, { passo: 1, dica: 'Desloca o desenho em relação à origem (ou arraste na prévia)' }));
      gS.appendChild(E.campo('numero', 'Ajuste Y', q.dy, (v, dig) => { mudarQuadro('dy', Math.round(v || 0), 'Ajuste Y', true); if (!dig) renderDir(); }, { passo: 1 }));
      const l1 = el('div', 'imp-linha');
      l1.appendChild(E.botao('◀ Mover', () => moverQuadro(-1), 'Trocar com o anterior'));
      l1.appendChild(E.botao('Mover ▶', () => moverQuadro(1), 'Trocar com o próximo'));
      l1.appendChild(E.botao(q.ativo ? '🚫 Tirar' : '✅ Pôr', () => alternarQuadro(st.sel), q.ativo ? 'Não usar este quadro' : 'Usar este quadro'));
      gS.appendChild(l1);
      const l2 = el('div', 'imp-linha');
      l2.appendChild(E.botao('⧉ Duplicar', () => duplicarQuadro(), 'Repete este quadro logo depois'));
      l2.appendChild(E.botao('↺ Zerar ajuste', () => { q.dx = 0; q.dy = 0; reprocessar(true); aba.historico.marcar('Zerar ajuste'); renderDir(); }));
      l2.appendChild(E.botao('⇄ Inverter ordem', () => { st.lista.reverse(); st.sel = st.lista.length - 1 - st.sel; reprocessar(true); aba.historico.marcar('Inverter ordem'); renderTira(); renderDir(); }));
      gS.appendChild(l2);
      gS.appendChild(texto('p', 'es-dica', 'Arraste o desenho na prévia para ajustar a posição deste quadro.'));
      d.appendChild(gS);
    }
    // ---- destino
    const gD = E.grupo('💾 Salvar');
    const todos = todosSprites();
    gD.appendChild(E.campo('select', 'Destino', cfg.destino, v => { st.cfg.destino = v; if (v === 'existente' && !todos.includes(cfg.alvo)) st.cfg.alvo = Object.keys(spritesNovos())[0] || todos[0] || ''; if (v === 'existente') carregarAlvo(); renderDir(); }, { lista: [['novo', 'Novo sprite'], ['existente', 'Animação num sprite']] }));
    const alvoSet = cfg.destino === 'existente' ? FF.Assets.sprites[cfg.alvo] : null;
    if (cfg.destino === 'existente') {
      const lista = todos.map(k => [k, (spritesNovos()[k] ? '📥 ' : '') + k]);
      gD.appendChild(E.campo('select', 'Sprite', cfg.alvo, v => { st.cfg.alvo = v; carregarAlvo(); renderDir(); }, { lista }));
    } else {
      gD.appendChild(E.campo('texto', 'Id do sprite', cfg.id, v => { st.cfg.id = E.idSeguro(v || ''); renderDir(); }, { placeholder: 'ex.: goku_gt', dica: 'Letras minúsculas, números e _' }));
    }
    const sug = NOMES_ANIM.slice();
    if (alvoSet) Object.keys(alvoSet.def.anims).forEach(a => sug.unshift(a));
    gD.appendChild(E.campo('texto', 'Animação', cfg.anim, v => { st.cfg.anim = nomeAnim(v || ''); st.cfg.animFixa = true; renderDir(); }, { placeholder: 'ex.: Parado', sugestoes: [...new Set(sug)] }));
    if (alvoSet && alvoSet.def.anims[cfg.anim]) gD.appendChild(texto('p', 'es-dica imp-alerta', 'Já existe "' + cfg.anim + '" neste sprite: será substituída.'));
    d.appendChild(gD);
    ui.salvar.disabled = !tem;
    d.scrollTop = rol;
  }
  // carrega o sprite de destino (para listar as animações dele) e redesenha o painel
  function carregarAlvo() {
    const id = st.cfg.alvo;
    if (!id || FF.Assets.sprites[id]) return;
    FF.Assets.loadSprite(id).then(() => { if (st.cfg.alvo === id) renderDir(); }).catch(() => null);
  }
  let tmCaixas = 0;
  function detectarCaixasDepois() { clearTimeout(tmCaixas); tmCaixas = setTimeout(() => { detectarCaixas(); }, 120); }

  // ---------------------------------------------------------------- tira de quadros
  function renderTira() {
    const t = ui.tira;
    if (!t) return;
    t.innerHTML = '';
    if (st.vista !== 'anim') return;
    st.lista.forEach((q, i) => {
      const it = el('div', 'imp-q' + (i === st.sel ? ' sel' : '') + (q.ativo ? '' : ' off'));
      it.draggable = true;
      it.title = 'Quadro ' + (i + 1) + (q.ativo ? '' : ' (fora da animação)') + ' — toque para ver, arraste para reordenar';
      const cv = document.createElement('canvas'); cv.width = 56; cv.height = 56;
      const r = st.res.find(x => x.id === q.id);
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      const src = r ? canvasDe(r) : (st.fontes[q.id] && (st.fontes[q.id]._cv || (st.fontes[q.id]._cv = I.paraCanvas(st.fontes[q.id].img))));
      if (src) {
        const s = Math.min(52 / src.width, 52 / src.height, 4);
        g.drawImage(src, (56 - src.width * s) / 2, (56 - src.height * s) / 2, src.width * s, src.height * s);
      }
      it.appendChild(cv);
      it.appendChild(texto('span', 'imp-q-n', String(i + 1) + (q.dur !== 1 ? ' ·' + String(q.dur).replace('.', ',') : '')));
      const x = E.botao(q.ativo ? '✓' : '✕', (e) => { e.stopPropagation(); alternarQuadro(i); }, q.ativo ? 'Tirar da animação' : 'Pôr de volta', 'imp-q-bt');
      it.appendChild(x);
      it.onclick = () => { selQuadro(i); };
      it.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-imp-quadro', String(i)); e.dataTransfer.effectAllowed = 'move'; });
      it.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('text/x-imp-quadro')) { e.preventDefault(); it.classList.add('alvo'); } });
      it.addEventListener('dragleave', () => it.classList.remove('alvo'));
      it.addEventListener('drop', (e) => {
        const de = e.dataTransfer.getData('text/x-imp-quadro');
        if (de === '') return;
        e.preventDefault(); e.stopPropagation();
        const a = +de;
        if (a === i) return;
        const [m] = st.lista.splice(a, 1);
        st.lista.splice(i, 0, m);
        st.sel = i;
        reprocessar(true); aba.historico.marcar('Reordenar'); renderTira(); renderDir();
      });
      t.appendChild(it);
    });
    const sel = t.children[st.sel];
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function selQuadro(i) {
    if (!st.lista.length) return;
    st.sel = (i + st.lista.length) % st.lista.length;
    st.tocando = false;
    renderBarra(); renderTira(); renderDir();
  }
  function moverQuadro(d) {
    const i = st.sel, j = i + d;
    if (j < 0 || j >= st.lista.length) return;
    const t = st.lista[i]; st.lista[i] = st.lista[j]; st.lista[j] = t;
    st.sel = j;
    reprocessar(true); aba.historico.marcar('Mover quadro'); renderTira(); renderDir();
  }
  function alternarQuadro(i) {
    const q = st.lista[i];
    if (!q) return;
    if (q.ativo && st.lista.filter(x => x.ativo).length === 1) return E.aviso('A animação precisa de pelo menos um quadro.', 'erro');
    q.ativo = !q.ativo;
    reprocessar(true); aba.historico.marcar(q.ativo ? 'Pôr quadro' : 'Tirar quadro'); renderTira(); renderDir();
  }
  function duplicarQuadro() {
    const q = st.lista[st.sel];
    if (!q) return;
    st.lista.splice(st.sel + 1, 0, Object.assign({}, q));
    st.sel++;
    reprocessar(true); aba.historico.marcar('Duplicar quadro'); renderTira(); renderDir();
  }

  // ---------------------------------------------------------------- prévia
  let fundoXadrez = null;
  function xadrez(g, W, H, t) {
    if (!fundoXadrez) {
      const c = document.createElement('canvas'); c.width = c.height = 16;
      const x = c.getContext('2d');
      x.fillStyle = '#2c2840'; x.fillRect(0, 0, 16, 16);
      x.fillStyle = '#3a3552'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8);
      fundoXadrez = g.createPattern(c, 'repeat');
    }
    g.fillStyle = fundoXadrez;
    g.fillRect(0, 0, W, H);
  }
  function geometria() {
    const cv = ui.cv;
    const W = cv.width, H = cv.height;
    const res = st.res;
    const centro = st.cfg.origem === 'centro';
    let cima = 48, baixo = 0, esq = 30, dir = 30;     // inclui o Goku (≈48 px de altura)
    res.forEach(r => { cima = Math.max(cima, r.oy); baixo = Math.max(baixo, r.img.altura - r.oy); esq = Math.max(esq, r.ox); dir = Math.max(dir, r.img.largura - r.ox); });
    const larg = esq + dir + (st.cfg.goku ? 80 : 0), alt = cima + baixo;
    let z = st.cfg.zoom;
    if (!z) {
      const zf = Math.min((W - 30) / larg, (H - 40) / alt);
      z = zf >= 3 ? Math.min(6, Math.floor(zf)) : Math.max(0.1, zf);
    }
    const ox = Math.round(W / 2 + (st.cfg.goku ? 40 * z : 0) + (esq - dir) * z / 2);
    let chao = Math.round(H / 2 + (cima - baixo) * z / 2);
    if (centro) chao = Math.round(H / 2 + (cima - baixo) * z / 2);
    return { W, H, z, x: ox, y: chao };
  }
  function quadroAtual() {
    if (!st.res.length) return -1;
    if (!st.tocando) return Math.max(0, resSel());
    const total = st.res.reduce((s, r) => s + r.dur, 0);
    let t = (st.t * st.cfg.fps);
    if (st.cfg.loop) t %= total;
    else if (t >= total + st.cfg.fps * 0.6) { st.t = 0; t = 0; }    // sem loop: pausa no fim e recomeça
    let acc = 0;
    for (let i = 0; i < st.res.length; i++) { acc += st.res[i].dur; if (t < acc) return i; }
    return st.res.length - 1;
  }
  function desenharPrevia() {
    const wrap = ui.palco;
    const cw = Math.max(50, wrap.clientWidth), ch = Math.max(50, wrap.clientHeight);
    const cv = ui.cv;
    if (cv.width !== cw) cv.width = cw;
    if (cv.height !== ch) cv.height = ch;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const G = geometria();
    // fundo
    if (st.cfg.previaFundo === 'xadrez') xadrez(g, G.W, G.H, 8);
    else if (st.cfg.previaFundo === 'escuro') { g.fillStyle = '#07040e'; g.fillRect(0, 0, G.W, G.H); }
    else desenharCenario(g, G);
    // linha do chão / cruz da origem
    const centro = st.cfg.origem === 'centro';
    g.fillStyle = 'rgba(255,216,74,0.35)';
    if (!centro) g.fillRect(0, G.y, G.W, 1);
    // Goku de referência
    if (st.cfg.goku) {
      const set = FF.Assets.sprites.gokubase;
      const a = set && set.anim('Parado');
      if (a) {
        const f = a.frames[Math.floor(st.t * (a.fps || 2)) % a.frames.length];
        const gy = centro ? G.y + 24 * G.z : G.y;
        g.save(); g.globalAlpha = 0.85;
        FF.drawFrame(g, set, f, G.x - (geometriaEsq() + 34) * G.z, gy, G.z, false);
        g.restore();
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.font = '10px sans-serif';
        g.fillText('Goku', G.x - (geometriaEsq() + 34) * G.z - 12, gy + 12);
      }
    }
    const i = quadroAtual();
    const r = st.res[i];
    if (r) {
      const c = canvasDe(r);
      g.drawImage(c, Math.round(G.x - r.ox * G.z), Math.round(G.y - r.oy * G.z), r.img.largura * G.z, r.img.altura * G.z);
      if (!st.tocando) {
        g.strokeStyle = 'rgba(108,200,255,0.6)'; g.lineWidth = 1;
        g.strokeRect(Math.round(G.x - r.ox * G.z) + 0.5, Math.round(G.y - r.oy * G.z) + 0.5, r.img.largura * G.z - 1, r.img.altura * G.z - 1);
      }
    }
    // cruz da origem
    g.strokeStyle = '#ff5a5a'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(G.x - 6, G.y + 0.5); g.lineTo(G.x + 7, G.y + 0.5); g.moveTo(G.x + 0.5, G.y - 6); g.lineTo(G.x + 0.5, G.y + 7); g.stroke();
    const k = r ? st.lista.findIndex(q => q.id === r.id) : -1;
    ui.info.textContent = (r ? 'quadro ' + (k + 1) + '/' + st.lista.length + ' · ' + r.img.largura + '×' + r.img.altura + ' · origem ' + r.ox + ',' + r.oy : '') + ' · zoom ' + arred(G.z, 2) + '×' + (st.contaGotas ? ' · 💧 toque na cor de fundo' : '');
  }
  function geometriaEsq() {
    let esq = 30;
    st.res.forEach(r => { esq = Math.max(esq, r.ox); });
    return esq;
  }
  function desenharCenario(g, G) {
    const set = FF.Assets.sprites.stage_campo;
    g.fillStyle = '#5a8ad8'; g.fillRect(0, 0, G.W, G.H);
    if (!set) return;
    const ceu = set.anim('ceu') && set.anim('ceu').frames[0];
    const chao = set.anim('chao2') && set.anim('chao2').frames[0];
    // mesmas proporções da batalha (data/stages/campo.json: lutadores em escala 2,5; chão 1,5)
    const k = G.z / 2.5;
    if (ceu) {
      const base = G.y + 40 * k;
      const s = Math.max(G.W / ceu[3], base / ceu[4]);
      g.drawImage(set.images[ceu[0]], ceu[1], ceu[2], ceu[3], ceu[4], (G.W - ceu[3] * s) / 2, base - ceu[4] * s, ceu[3] * s, ceu[4] * s);
    }
    let fim = G.y;
    if (chao) {
      const s = Math.max(1.5 * k, G.W / chao[3]);
      const topo = G.y - 120 * s;
      g.drawImage(set.images[chao[0]], chao[1], chao[2], chao[3], chao[4], (G.W - chao[3] * s) / 2, topo, chao[3] * s, chao[4] * s);
      fim = topo + chao[4] * s;
    }
    if (fim < G.H) { g.fillStyle = '#6aa531'; g.fillRect(0, fim, G.W, G.H - fim); }
  }
  function instalarArrastoPrevia() {
    const cv = ui.cv;
    let arr = null;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; };
    cv.addEventListener('pointerdown', (e) => {
      if (!st.res.length) return;
      const p = pos(e), G = geometria();
      const i = quadroAtual();
      const r = st.res[i];
      if (!r) return;
      if (st.contaGotas) {
        const lx = (p.x - (G.x - r.ox * G.z)) / G.z, ly = (p.y - (G.y - r.oy * G.z)) / G.z;
        if (lx < 0 || ly < 0 || lx >= r.img.largura || ly >= r.img.altura) return E.aviso('Toque dentro do quadro.', 'erro');
        const fo = st.fontes[r.id];
        escolherCor(I.corEm(fo.img, r.tx + lx / r.s, r.ty + ly / r.s));
        return;
      }
      // seleciona o quadro que está na tela e começa a arrastar
      const k = st.lista.findIndex(q => q.id === r.id);
      if (k >= 0) st.sel = k;
      st.tocando = false;
      const q = st.lista[st.sel];
      arr = { x: p.x, y: p.y, dx: q.dx, dy: q.dy, z: G.z, id: e.pointerId, mexeu: false };
      cv.setPointerCapture(e.pointerId);
      renderBarra(); renderTira();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!arr || e.pointerId !== arr.id) return;
      const p = pos(e);
      const q = st.lista[st.sel];
      const nx = arr.dx + Math.round((p.x - arr.x) / arr.z), ny = arr.dy + Math.round((p.y - arr.y) / arr.z);
      if (nx !== q.dx || ny !== q.dy) { q.dx = nx; q.dy = ny; arr.mexeu = true; processar(); }
    });
    const fim = (e) => {
      if (!arr || e.pointerId !== arr.id) return;
      if (arr.mexeu) { aba.historico.marcar('Ajustar posição'); }
      arr = null;
      renderDir();
    };
    cv.addEventListener('pointerup', fim);
    cv.addEventListener('pointercancel', fim);
  }

  function renderPacote() {
    const box = ui.pacote;
    if (!box) return;
    box.innerHTML = '';
    const p = st.pacote;
    if (!p) return;
    const g = E.grupo('📦 ' + p.nome);
    g.classList.add('imp-pac');
    g.appendChild(texto('p', 'es-dica', p.origem + ' · ' + Object.keys(p.def.anims).length + ' animações'));
    const anims = quadrosDoSprite(p.def, p.imgs);
    Object.keys(anims).forEach(a => {
      const l = el('div', 'imp-spr-anim');
      l.appendChild(texto('span', '', a + ' (' + anims[a].frames.length + ')'));
      l.appendChild(E.botao('✏', () => editarAnimacao(anims, a, null), 'Levar esta animação para a área de trabalho'));
      g.appendChild(l);
    });
    const l = el('div', 'imp-linha');
    l.appendChild(E.botao('💾 Salvar tudo como sprite', () => salvarPacote(), 'Cria um sprite importado com todas as animações', 'es-bt-ouro'));
    l.appendChild(E.botao('✕', () => { st.pacote = null; renderPacote(); }, 'Descartar'));
    g.appendChild(l);
    box.appendChild(g);
  }

  // ---------------------------------------------------------------- painel (aberto pela aba Sprites)
  aba = {
    aberto: false,
    aoSalvar: null, aoFechar: null,
    montar(raiz) {
      montar(raiz);
      // Goku para comparação de tamanho (não bloqueia a abertura)
      FF.Assets.loadSprite('gokubase').catch(() => null);
    },
    // opts: destino ('novo' | 'existente'), alvo (sprite), anim (nome), arquivos (File[] para importar já)
    abrir(opts = {}) {
      aba.aberto = true;
      if (opts.alvo && todosSprites().includes(opts.alvo)) st.cfg.alvo = opts.alvo;
      if (opts.destino) st.cfg.destino = opts.destino === 'existente' && st.cfg.alvo ? 'existente' : 'novo';
      if (opts.anim) { st.cfg.anim = nomeAnim(opts.anim); st.cfg.animFixa = opts.destino === 'existente'; }
      if (st.cfg.destino === 'existente') carregarAlvo();
      renderTudo();
      if (opts.arquivos && opts.arquivos.length) importar(opts.arquivos);
    },
    fechou() { aba.aberto = false; },
    mostrar() { renderDir(); if (st.folha) st.folha.sujo = true; },
    quadro(dt) {
      if (st.vista === 'anim') {
        if (st.tocando) st.t += dt; else st.t += dt * 0.0001;
        desenharPrevia();
      } else if (st.vista === 'folha') desenharFolha();
    },
    teclado(e) {
      if (E.digitando(e) || e.ctrlKey || e.metaKey || e.altKey) return false;
      if (st.vista !== 'anim' || !st.lista.length) return false;
      if (e.key === ' ') { st.tocando = !st.tocando; renderBarra(); return true; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const d = e.key === 'ArrowLeft' ? -1 : 1;
        if (e.shiftKey) { mudarQuadro('dx', (st.lista[st.sel].dx || 0) + d, 'Ajuste X', true); renderDir(); }
        else selQuadro(st.sel + d);
        return true;
      }
      if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { mudarQuadro('dy', (st.lista[st.sel].dy || 0) + (e.key === 'ArrowUp' ? -1 : 1), 'Ajuste Y', true); renderDir(); return true; }
      return false;
    },
    historico: null,
    // para a aba Sprites e os testes
    _st: st, importar, salvar, quadrosDoSprite, gravarSprite,
  };
  aba.historico = new E.Historico(
    () => ({ cfg: st.cfg, lista: st.lista, sel: st.sel }),
    (s) => {
      // só aplica se os quadros ainda existem (o histórico é zerado a cada importação)
      st.cfg = Object.assign({}, PADRAO, s.cfg);
      st.lista = s.lista.filter(q => st.fontes[q.id]);
      st.sel = Math.min(s.sel || 0, Math.max(0, st.lista.length - 1));
      st.corAuto = undefined;
      if (st.folha) { st.folha.procChave = ''; if (st.vista === 'folha') detectarCaixas(); }
      reprocessar(true);
      renderTudo();
    });
  FF.EstudioImportar = aba;
})();
