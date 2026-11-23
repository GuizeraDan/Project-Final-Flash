// Estúdio Final Flash — ⇱ Separar em sprite próprio: uma animação que mora dentro de um sprite grande
// (ex.: "Acao_1551" do Androide 18, 153 animações) vira um sprite só dela.
//
// - Sem copiar imagens: o sprite novo (spritesNovos[id]) usa os mesmos atlas do original (só os que a animação usa).
// - "Tirar do original" (padrão nos sprites do acervo): a animação sai do sprite de origem (vai para "Apagadas" dele,
//   dá para trazer de volta) e passa a existir só no sprite novo. Sprites do jogo: padrão é manter (golpes usam).
// - Nas pastas, o atalho "sprite#anim" vira o sprite novo: na 1ª pasta ele "mora" (spritesInfo.pasta, sai de
//   "Do jogo"), nas outras fica como atalho do sprite inteiro. O ⭐ da animação passa para o sprite novo.
// - Depois de separar, as duas cópias são independentes.
//
// FF.EstudioSeparar.separar([{sprite, anim, pasta?}], { perguntar: true, destino }) → [ids novos]
//   pasta = onde o sprite novo mora (a de onde veio o clique); destino = pasta para todos (ex.: a aberta no Organizar)
(function () {
  'use strict';
  const E = FF.Estudio;
  const copia = (o) => JSON.parse(JSON.stringify(o));
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'anim';

  function idLivre(base) {
    const usados = new Set(FF.Assets.listaSprites(true).concat(Object.keys(FF.Edicoes.dados().spritesNovos || {})));
    let id = 'sep_' + base, n = 2;
    while (usados.has(id)) id = 'sep_' + base + '_' + n++;
    return id;
  }

  async function separarUm(sprite, anim, pastaPref, tirar, destino) {
    const set = await FF.Assets.loadSprite(sprite);
    const a = set && set.def.anims[anim];
    if (!a || !a.frames.length) throw new Error('"' + anim + '" não tem quadros.');
    // só os atlas que a animação usa, na ordem em que aparecem
    const usados = [], mapa = new Map();
    a.frames.forEach(f => { if (!mapa.has(f[0])) { mapa.set(f[0], usados.length); usados.push(set.def.atlases[f[0]]); } });
    if (usados.some(p => !p)) throw new Error('Imagem do sprite não encontrada.');
    const frames = a.frames.map(f => { const q = copia(f); q[0] = mapa.get(f[0]); if (q[7] == null) q[7] = 1; return q; });
    const nomeVis = FF.Assets.nomeAnim(sprite, anim);
    const id = idLivre(slug(nomeVis));
    const def = { id, atlases: usados, anims: { [anim]: { fps: a.fps || 0, loop: !!a.loop, repeatTo: a.repeatTo || 0, pingpong: false, frames } }, separadoDe: sprite + '#' + anim };
    if (set.def.escala) def.escala = set.def.escala;
    if (set.def.espelhar) def.espelhar = true;
    if (set.def.tipo) def.tipo = set.def.tipo;
    FF.Edicoes.set(['spritesNovos', id], def);

    // pastas: o atalho da animação vira o sprite novo
    const F = FF.Favoritos, chave = sprite + '#' + anim;
    const pastas = F ? F.pastasDe(sprite, anim) : [];
    if (pastaPref && pastas.includes(pastaPref)) { pastas.splice(pastas.indexOf(pastaPref), 1); pastas.unshift(pastaPref); }   // mora na pasta de onde veio o clique
    const info = { nome: nomeVis };
    if (destino) info.pasta = destino;
    else if (pastas.length) info.pasta = pastas[0];
    FF.Edicoes.set(['spritesInfo', id], info);
    pastas.forEach((p, i) => {
      const l = (F.pastas()[p] || []).filter(k => k !== chave);
      if (p !== info.pasta && !l.includes(id)) l.push(id);
      FF.Edicoes.set(['favoritosPastas', p], l);
    });
    const tipo = F && F.todos()[chave];
    if (tipo) { FF.Edicoes.set(['favoritos', id], tipo); FF.Edicoes.set(['favoritos', chave], null); }
    if (tirar) {
      const ns = (FF.Edicoes.dados().spritesNovos || {})[sprite];
      if (ns && ns.anims && ns.anims[anim]) FF.EstudioArq.apagarAnimImportada(sprite, anim);
      else if (FF.Mods.criada(sprite, anim)) FF.Mods.restaurar(sprite, anim);
      else FF.Mods.apagar(sprite, anim);
    }
    return { id, pastas };
  }

  async function separar(itens, cfg) {
    cfg = cfg || {};
    itens = (itens || []).filter(x => x && x.sprite && x.anim);
    if (!itens.length) return [];
    const doJogo = itens.some(x => !FF.Assets.doAcervo(x.sprite) && !(FF.Edicoes.dados().spritesNovos || {})[x.sprite]);
    let tirar = cfg.tirar != null ? cfg.tirar : !doJogo;
    if (cfg.perguntar !== false) {
      const r = await perguntar(itens, cfg.destino, tirar, doJogo);
      if (!r) return [];
      tirar = r.tirar;
    }
    const novos = [];
    try {
      for (const x of itens) novos.push((await separarUm(x.sprite, x.anim, x.pasta, tirar, cfg.destino)).id);
    } catch (e) { E.aviso('❌ ' + e.message, 'erro'); }
    if (novos.length) {
      if (E.renderSync) E.renderSync();
      E.aviso('⇱ ' + (novos.length === 1 ? 'Animação separada: "' + FF.Assets.nomeSprite(novos[0]) + '" é um sprite só dela.' : novos.length + ' animações separadas em sprites próprios.'), 'ok');
    }
    return novos;
  }

  // janela: o que vai acontecer + "tirar do original"
  function perguntar(itens, destino, tirar, doJogo) {
    return new Promise(res => {
      const c = E.el('div', 'es-escolha es-separar');
      const nomes = itens.slice(0, 8).map(x => '"' + FF.Assets.nomeAnim(x.sprite, x.anim) + '"').join(', ') + (itens.length > 8 ? '…' : '');
      const dono = [...new Set(itens.map(x => FF.Assets.nomeSprite(x.sprite)))].join(', ');
      const p = E.el('p');
      p.textContent = 'Separar ' + nomes + ' de "' + dono + '" num sprite só ' + (itens.length > 1 ? 'para cada uma' : 'dela') + '.\n\n' +
        '• Ao abrir, aparece só essa animação.\n' +
        (destino ? '• O sprite novo vai para a pasta "' + destino.replace(/\//g, ' › ') + '".\n' : '• Nas suas pastas, o atalho vira o sprite novo.\n') +
        '• Nenhuma imagem é copiada.';
      const l = E.el('label', 'es-separar-ck');
      const ck = document.createElement('input'); ck.type = 'checkbox'; ck.checked = tirar;
      l.append(ck, document.createTextNode(' Tirar do sprite original (vai para "Apagadas" dele — dá para trazer de volta)'));
      const aviso = E.el('p', 'es-obs', doJogo ? '⚠ Inclui sprite do jogo: se algum golpe usa essa animação, tirar do original pode deixar o golpe sem ela.' : '');
      const bts = E.el('div', 'es-escolha-bts');
      let r = null;
      const m = E.modal('⇱ Separar em sprite próprio', c, { aoFechar: () => res(r) });
      bts.append(E.botao('⇱ Separar', () => { r = { tirar: ck.checked }; m.fechar(); }, null, 'es-bt-ouro'), E.botao('Cancelar', () => m.fechar()));
      c.append(p, l, aviso, bts);
    });
  }

  FF.EstudioSeparar = { separar };
})();
