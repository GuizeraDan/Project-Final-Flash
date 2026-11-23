// Estúdio Final Flash — ⇱ Separar em sprite próprio: uma animação que mora dentro de um sprite grande
// (ex.: "Acao_1551" do Androide 18, 153 animações) vira um sprite só dela.
//
// - Sem copiar imagens: o sprite novo (spritesNovos[id]) usa os mesmos atlas do original (só os que a animação usa).
// - O original não muda (golpes e personagens que usam a animação continuam funcionando).
// - Nas pastas, o atalho "sprite#anim" vira o sprite novo: na 1ª pasta ele "mora" (spritesInfo.pasta, sai de
//   "Do jogo"), nas outras fica como atalho do sprite inteiro. O ⭐ da animação passa para o sprite novo.
// - Depois de separar, as duas cópias são independentes.
//
// FF.EstudioSeparar.separar([{sprite, anim, pasta?}], { perguntar: true }) → [ids novos]  (pasta = onde o sprite novo mora)
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

  async function separarUm(sprite, anim, pastaPref) {
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
    if (pastas.length) info.pasta = pastas[0];
    FF.Edicoes.set(['spritesInfo', id], info);
    pastas.forEach((p, i) => {
      const l = (F.pastas()[p] || []).filter(k => k !== chave);
      if (i > 0 && !l.includes(id)) l.push(id);
      FF.Edicoes.set(['favoritosPastas', p], l);
    });
    const tipo = F && F.todos()[chave];
    if (tipo) { FF.Edicoes.set(['favoritos', id], tipo); FF.Edicoes.set(['favoritos', chave], null); }
    return { id, pastas };
  }

  async function separar(itens, cfg) {
    cfg = cfg || {};
    itens = (itens || []).filter(x => x && x.sprite && x.anim);
    if (!itens.length) return [];
    if (cfg.perguntar !== false) {
      const nomes = itens.slice(0, 8).map(x => '"' + FF.Assets.nomeAnim(x.sprite, x.anim) + '"').join(', ') + (itens.length > 8 ? '…' : '');
      const dono = [...new Set(itens.map(x => FF.Assets.nomeSprite(x.sprite)))].join(', ');
      const txt = 'Separar ' + nomes + ' de "' + dono + '" num sprite só ' + (itens.length > 1 ? 'para cada uma' : 'dela') + '?\n\n' +
        '• Ao abrir, aparece só essa animação (não as outras do sprite).\n' +
        '• Nas suas pastas, o atalho vira o sprite novo.\n' +
        '• O original continua igual — golpes que usam ele não quebram. Depois disso, as duas cópias são independentes.\n' +
        '• Nenhuma imagem é copiada.';
      if (!(await E.confirmar('⇱ Separar em sprite próprio', txt, '⇱ Separar', false))) return [];
    }
    const novos = [];
    try {
      for (const x of itens) novos.push((await separarUm(x.sprite, x.anim, x.pasta)).id);
    } catch (e) { E.aviso('❌ ' + e.message, 'erro'); }
    if (novos.length) {
      if (E.renderSync) E.renderSync();
      E.aviso('⇱ ' + (novos.length === 1 ? 'Animação separada: "' + FF.Assets.nomeSprite(novos[0]) + '" é um sprite só dela.' : novos.length + ' animações separadas em sprites próprios.'), 'ok');
    }
    return novos;
  }

  FF.EstudioSeparar = { separar };
})();
