// Estúdio Final Flash — imagens do computador dentro dos sprites (usado pela aba Sprites e pelo importador).
//
// - adicionarImagens(id, imgs): empacota imagens novas num atlas extra (assets/img/usr/<id>__<marca>.png,
//   guardado no aparelho e enviado ao GitHub junto com as edições) e liga ao sprite:
//     · sprite importado  → spritesNovos[id].atlases
//     · sprite do jogo    → spritesInfo[id].atlas (somado aos atlas do JSON por FF.Assets.loadSprite)
//   Devolve { indice, posicoes, set } — os quadros novos usam [indice, x, y, w, h, …].
// - salvarAnim(id, nome, anim): sprite importado grava direto em spritesNovos[id].anims;
//   sprite do jogo grava em sprites[id][nome] (FF.Mods).
// - lerArquivos(arquivos, opts) / prepararQuadros(fontes, opts): arquivos do computador → quadros prontos
//   ({img, ox, oy, dur}) com fundo removido, bordas cortadas, origem nos pés/centro e escala.
(function () {
  'use strict';
  const E = FF.Estudio, I = FF.Imagem, C = FF.Codecs;
  const MAX_ATLAS = 4096;
  const copia = (o) => JSON.parse(JSON.stringify(o));

  function novos() { return FF.Edicoes.dados().spritesNovos || {}; }
  function importado(id) { return !!novos()[id]; }

  function limpaAnim(a) { return { fps: a.fps || 0, loop: !!a.loop, repeatTo: a.repeatTo || 0, pingpong: false, frames: copia(a.frames || []) }; }

  async function adicionarImagens(id, imgs) {
    if (!imgs.length) throw new Error('Nenhuma imagem para adicionar.');
    const pk = I.empacotar(imgs, { margem: 1, larguraMax: 2048 });
    if (pk.largura > MAX_ATLAS || pk.altura > MAX_ATLAS) throw new Error('As imagens ficariam com ' + pk.largura + '×' + pk.altura + ' px (máximo ' + MAX_ATLAS + '). Diminua a escala ou use menos quadros.');
    const caminho = 'assets/img/usr/' + id + '__' + Date.now().toString(36) + '.png';
    const blob = await C.canvasParaPng(I.paraCanvas(pk));
    await FF.ImagensUsr.gravar(caminho, blob, false);
    if (importado(id)) {
      const def = copia(novos()[id]);
      def.atlases = (def.atlases || []).concat(caminho);
      FF.Edicoes.set(['spritesNovos', id], def);
    } else {
      const info = (FF.Edicoes.dados().spritesInfo || {})[id] || {};
      FF.Edicoes.set(['spritesInfo', id, 'atlas'], (info.atlas || []).concat(caminho));
    }
    FF.Assets.descarregarSprite(id);
    const set = await FF.Assets.loadSprite(id);
    const indice = set.def.atlases.indexOf(caminho);
    if (indice < 0 || !set.images[indice]) throw new Error('A imagem nova não carregou.');
    if (E.renderSync) E.renderSync();
    return { indice, posicoes: pk.posicoes, set, caminho };
  }

  // grava uma animação no jogo (todas as telas e, conectado, todos os aparelhos)
  function salvarAnim(id, nome, anim) {
    const limpo = limpaAnim(anim);
    if (importado(id)) {
      const def = copia(novos()[id]);
      def.anims = def.anims || {};
      def.anims[nome] = limpo;
      FF.Edicoes.set(['spritesNovos', id], def);
      // versão antiga gravada como "alteração" (antes ia para sprites[id]): sai, para não sobrepor
      if (FF.Mods.alterada(id, nome)) FF.Edicoes.set(['sprites', id, nome], null);
      const s = FF.Assets.sprites[id];
      if (s) { s.def.anims[nome] = copia(limpo); if (s.def._orig) delete s.def._orig[nome]; }
    } else FF.Mods.salvar(id, nome, limpo);
  }

  // tira uma animação de um sprite importado (também a alteração antiga, se houver)
  function apagarAnimImportada(id, nome) {
    const def = copia(novos()[id]);
    delete def.anims[nome];
    FF.Edicoes.set(['spritesNovos', id], def);
    if (FF.Mods.alterada(id, nome)) FF.Edicoes.set(['sprites', id, nome], null);
    const s = FF.Assets.sprites[id];
    if (s) { delete s.def.anims[nome]; if (s.def._orig) delete s.def._orig[nome]; }
  }

  // pixels de um quadro de um sprite carregado (falha com SecurityError em file:// para imagens do jogo)
  function pixelsDoQuadro(set, f) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, f[3]); c.height = Math.max(1, f[4]);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(set.images[f[0]], f[1], f[2], f[3], f[4], 0, 0, f[3], f[4]);
    return I.deCanvas(c);
  }

  // ---------------------------------------------------------------- arquivos do computador
  // → { fontes: [{img, nome, atraso, tipo}], erros: [texto] }  (ignora .txt, Thumbs.db etc.)
  async function lerArquivos(arquivos, opts = {}) {
    const lista = [...arquivos].filter(Boolean).sort((a, b) => C.ordemNatural(a.name || '', b.name || ''));
    const fontes = [], erros = [];
    for (let k = 0; k < lista.length; k++) {
      const f = lista[k];
      if (opts.aoProgresso) opts.aoProgresso(k / lista.length, f.name);
      try {
        const r = await C.decodificarArquivo(f, { fps: opts.fps || 12, maxQuadros: opts.maxQuadros || 300 });
        if (r.tipo === 'json') { erros.push((f.name || 'arquivo') + ': JSON só pelo importador (📂 Importar).'); continue; }
        r.itens.forEach(it => it.quadros.forEach(q => fontes.push({ img: I.deCanvas(q.canvas), nome: it.nome || f.name, atraso: q.atraso || 0, tipo: r.tipo })));
      } catch (e) { erros.push((f.name || 'arquivo') + ': ' + e.message); }
    }
    return { fontes, erros };
  }

  function temTransparencia(img) {
    const d = img.rgba, passo = Math.max(1, Math.floor(d.length / 4 / 40000)) * 4;
    for (let i = 3; i < d.length; i += passo) if (d[i] < 250) return true;
    return false;
  }

  // opts: fundo ('auto' | true | false), tol, cortar (true), origem ('pes' | 'centro'), escala (1), separar ('auto' | false), fps
  function prepararQuadros(fontes, opts = {}) {
    if (!fontes.length) return [];
    const o = Object.assign({ fundo: 'auto', tol: 24, cortar: true, origem: 'pes', escala: 1, separar: 'auto', fps: 12 }, opts);
    let remover = o.fundo === 'auto' ? !temTransparencia(fontes[0].img) : !!o.fundo;
    const cor = remover ? I.corDeFundo(fontes[0].img) : null;
    if (cor && cor[3] === 0) remover = false;
    let base = fontes.map(fo => ({ img: remover ? I.removerFundo(fo.img, cor.slice(0, 3), o.tol, { contiguo: true }) : fo.img, atraso: fo.atraso }));
    let alinhar = true;
    // uma imagem só com vários desenhos separados: é uma sprite sheet → um quadro por desenho
    if (base.length === 1 && o.separar !== false) {
      const cx = I.componentes(base[0].img, { juntarDistancia: 2, minArea: 16 });
      if (cx.length >= 2 && cx.length <= 400) { base = cx.map(b => ({ img: I.recortar(base[0].img, b), atraso: 0 })); alinhar = false; }
    }
    // atraso mais comum (GIF/APNG) vira o fps; a duração de cada quadro é relativa a ele
    let fps = o.fps;
    const atrasos = base.map(b => b.atraso).filter(a => a > 0);
    if (atrasos.length) {
      const cont = new Map(); atrasos.forEach(a => { const k = Math.round(a * 1000); cont.set(k, (cont.get(k) || 0) + 1); });
      const comum = [...cont.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0] / 1000;
      if (comum > 0) fps = Math.max(1, Math.min(60, Math.round(1 / comum)));
    }
    const proc = base.map(b => {
      const W = b.img.largura, H = b.img.altura;
      const a = I.aparar(b.img);
      const vazio = a.largura === 1 && a.altura === 1 && b.img.rgba[3] === 0;
      const conteudo = vazio ? { x: 0, y: 0, w: W, h: H } : { x: a.x, y: a.y, w: a.largura, h: a.altura };
      const corta = o.cortar && !vazio;
      return { img: corta ? a.img : b.img, tx: corta ? a.x : 0, ty: corta ? a.y : 0, conteudo, W, H, atraso: b.atraso };
    });
    // quadros do mesmo tamanho (GIF, vídeo, sequência): mesma origem, para não "tremer"
    let comum = null;
    if (alinhar && proc.length > 1 && proc.every(p => p.W === proc[0].W && p.H === proc[0].H)) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      proc.forEach(p => { const b = p.conteudo; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); });
      comum = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    const s = o.escala > 0 ? o.escala : 1;
    const quadros = proc.map(p => {
      const b = comum || p.conteudo;
      const px = b.x + b.w / 2, py = o.origem === 'centro' ? b.y + b.h / 2 : b.y + b.h;
      const img = s === 1 ? p.img : I.escalar(p.img, s, false);
      const dur = p.atraso > 0 ? Math.max(0.1, Math.round(p.atraso * fps * 100) / 100) : 1;
      return { img, ox: Math.round((px - p.tx) * s), oy: Math.round((py - p.ty) * s), dur };
    });
    quadros.fps = fps;
    quadros.removeuFundo = remover;
    return quadros;
  }

  // quadros prontos → entram no sprite (atlas extra) → quadros no formato do jogo
  async function quadrosParaSprite(id, quadros) {
    const r = await adicionarImagens(id, quadros.map(q => q.img));
    const fr = quadros.map((q, k) => {
      const p = r.posicoes[k];
      const f = [r.indice, p.x, p.y, q.img.largura, q.img.altura, Math.round(q.ox), Math.round(q.oy), q.dur || 1];
      if (q.pontos) f.push(q.pontos);
      return f;
    });
    return { frames: fr, set: r.set };
  }

  FF.EstudioArq = { importado, adicionarImagens, salvarAnim, apagarAnimImportada, pixelsDoQuadro, lerArquivos, prepararQuadros, quadrosParaSprite, limpaAnim, MAX_ATLAS };
})();
