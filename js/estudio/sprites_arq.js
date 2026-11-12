// Estúdio Final Flash — imagens e gravação de sprites para a aba Sprites.
//
// - adicionarImagens(id, imgs): empacota imagens novas (ex.: quadros redimensionados) num atlas extra (assets/img/usr/<id>__<marca>.png,
//   guardado no aparelho e enviado ao GitHub junto com as edições) e liga ao sprite:
//     · sprite importado  → spritesNovos[id].atlases
//     · sprite do jogo    → spritesInfo[id].atlas (somado aos atlas do JSON por FF.Assets.loadSprite)
//   Devolve { indice, posicoes, set } — os quadros novos usam [indice, x, y, w, h, …].
// - salvarAnim(id, nome, anim): sprite importado grava direto em spritesNovos[id].anims;
//   sprite do jogo grava em sprites[id][nome] (FF.Mods).
// - quadrosDoSprite / gravarSprite: "🧹 Juntar imagens" de um sprite importado num atlas só.
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

  // ---------------------------------------------------------------- juntar imagens (sprite importado)
  // quadros de um sprite (def + imagens já lidas) → {nome: {fps, loop, repeatTo, frames: [{img, ox, oy, dur, pontos}]}}
  function quadrosDoSprite(def, imgs) {
    const cache = new Map(), anims = {};
    Object.entries(def.anims || {}).forEach(([nome, a]) => {
      anims[nome] = {
        fps: a.fps, loop: a.loop, repeatTo: a.repeatTo || 0,
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

  // empacota todas as animações num atlas só (assets/img/usr/<id>.png) e grava o sprite importado
  async function gravarSprite(id, anims, extra) {
    const imgs = [], idx = new Map();
    Object.values(anims).forEach(a => a.frames.forEach(f => { if (!idx.has(f.img)) { idx.set(f.img, imgs.length); imgs.push(f.img); } }));
    if (!imgs.length) throw new Error('Nenhum quadro para salvar.');
    const pk = I.empacotar(imgs, { margem: 1, larguraMax: 2048 });
    if (pk.largura > MAX_ATLAS || pk.altura > MAX_ATLAS) throw new Error('O atlas ficaria com ' + pk.largura + '×' + pk.altura + ' px (máximo ' + MAX_ATLAS + ').');
    const caminho = 'assets/img/usr/' + id + '.png';
    const def = Object.assign({ id, atlases: [caminho] }, extra || {}, { anims: {} });
    Object.entries(anims).forEach(([nome, a]) => {
      def.anims[nome] = {
        fps: a.fps || 0, loop: !!a.loop, repeatTo: a.repeatTo || 0, pingpong: false,
        frames: a.frames.map(f => {
          const p = pk.posicoes[idx.get(f.img)];
          const q = [0, p.x, p.y, f.img.largura, f.img.altura, Math.round(f.ox), Math.round(f.oy), Math.round((f.dur || 1) * 1000) / 1000];
          if (f.pontos) q.push(f.pontos);
          return q;
        }),
      };
    });
    await FF.ImagensUsr.gravar(caminho, await C.canvasParaPng(I.paraCanvas(pk)), false);
    E.salvarNoJogo(['spritesNovos', id], def, '💾 Sprite "' + id + '" gravado.');
    FF.Assets.descarregarSprite(id);
    const set = await FF.Assets.loadSprite(id);
    return { def, set, pk };
  }

  FF.EstudioArq = { importado, adicionarImagens, salvarAnim, apagarAnimImportada, pixelsDoQuadro, quadrosDoSprite, gravarSprite, limpaAnim, MAX_ATLAS };
})();
