// Estúdio Final Flash — 🎞 Juntar em animação: vários sprites soltos (um quadro cada, ex.: ground_smash_fx_00…09)
// viram uma animação só, no primeiro sprite da série.
//
// Nenhuma imagem é copiada: as imagens dos outros sprites entram como atlas extras do primeiro
// (spritesInfo[alvo].atlas, somadas por FF.Assets.loadSprite) e a animação nova (FF.Mods, sprites[alvo][nome])
// aponta para elas. Por isso os sprites juntados podem ir para a Lixeira (oculto), mas não ser apagados de vez.
//
// FF.EstudioJuntar.abrir(ids, { aoTerminar(alvo, nomeAnim) })
//   ids: sprites inteiros ("dlz_9") e/ou animações ("zl3_esferas#DeathBall"). Só sprites: ordem pelo nome;
//   com animações: a ordem em que vieram (a da tela). Animações do mesmo sprite do alvo não precisam de atlas extra.
(function () {
  'use strict';
  const E = FF.Estudio;
  const cmp = FF.compararNomes || ((a, b) => a.localeCompare(b, 'pt', { numeric: true }));
  const copia = (o) => JSON.parse(JSON.stringify(o));

  // nome comum da série: "ground_smash_fx_00" + "ground_smash_fx_09" → "ground_smash_fx"
  function prefixo(nomes) {
    if (!nomes.length) return 'animacao';
    let p = nomes[0];
    nomes.forEach(n => { let i = 0; while (i < p.length && i < n.length && p[i] === n[i]) i++; p = p.slice(0, i); });
    p = p.replace(/[\s_\-.(]*\d*$/, '').replace(/[\s_\-.(]+$/, '');
    return p || nomes[0].replace(/[\s_\-.]*\d+$/, '') || 'animacao';
  }
  const limpaNome = (n) => String(n || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

  // quadros que cada sprite entrega: a animação única; com várias, "folha"/"Todos" ou a primeira
  function animDe(set) {
    const nomes = Object.keys(set.def.anims || {});
    const n = nomes.length === 1 ? nomes[0] : (nomes.find(x => /^(folha|todos)$/i.test(x)) || nomes[0]);
    return n ? set.def.anims[n] : null;
  }

  async function abrir(ids, cfg) {
    cfg = cfg || {};
    ids = [...new Set(ids)];
    if (ids.length < 2) { E.aviso('Marque pelo menos 2 para juntar.', 'erro'); return; }
    const deAnims = ids.some(x => x.includes('#'));
    // item = { spr, anim (null = a animação única do sprite), rot }
    const itens = ids.map(x => { const i = x.indexOf('#'); return i < 0 ? { spr: x, anim: null } : { spr: x.slice(0, i), anim: x.slice(i + 1) }; });
    if (!deAnims) itens.sort((a, b) => cmp(FF.Assets.nomeSprite(a.spr), FF.Assets.nomeSprite(b.spr)) || cmp(a.spr, b.spr));
    const ordem = itens;
    let sets;
    try { sets = await Promise.all(itens.map(it => FF.Assets.loadSprite(it.spr))); }
    catch (e) { E.aviso('❌ Não deu para abrir os sprites: ' + e.message, 'erro'); return; }
    const animIt = (it, s) => (it.anim ? s.def.anims[it.anim] : animDe(s));
    const rotulo = (it) => it.anim ? FF.Assets.nomeAnim(it.spr, it.anim) + (itens.some(o => o.spr !== it.spr) ? ' · ' + FF.Assets.nomeSprite(it.spr) : '') : FF.Assets.nomeSprite(it.spr);
    const vazios = itens.filter((it, k) => !sets[k] || !animIt(it, sets[k]) || !animIt(it, sets[k]).frames.length);
    if (vazios.length) { E.aviso('Sem quadros: ' + vazios.map(rotulo).join(', '), 'erro'); return; }

    // ---- janela
    const c = E.el('div', 'es-juntar');
    const nQ = ordem.reduce((s, it, k) => s + animIt(it, sets[k]).frames.length, 0);
    const intro = E.el('p'); intro.textContent = ordem.length + (deAnims ? ' animações' : ' sprites') + ' → 1 animação com ' + nQ + ' quadro(s), ' + (deAnims ? 'na ordem da tela' : 'na ordem do nome') + ' (▲▼ muda). Ela fica no sprite do primeiro da lista.';
    c.appendChild(intro);
    const lista = E.el('div', 'es-juntar-lista');
    const pintarLista = () => {
      lista.innerHTML = '';
      ordem.forEach((o, k) => {
        const it = E.el('div', 'es-juntar-item' + (k === 0 ? ' alvo' : ''));
        const cv = document.createElement('canvas'); cv.width = 40; cv.height = 40;
        E.miniatura(cv, sets[k], o.anim || Object.keys(sets[k].def.anims).find(n => sets[k].def.anims[n] === animDe(sets[k])), 0);
        const nm = E.el('span'); nm.textContent = (k + 1) + '. ' + rotulo(o) + ' (' + animIt(o, sets[k]).frames.length + ')';
        it.append(cv, nm);
        const sobe = E.botao('▲', () => { if (k) { [ordem[k - 1], ordem[k]] = [ordem[k], ordem[k - 1]]; [sets[k - 1], sets[k]] = [sets[k], sets[k - 1]]; pintarLista(); } }, 'Subir');
        const desce = E.botao('▼', () => { if (k < ordem.length - 1) { [ordem[k + 1], ordem[k]] = [ordem[k], ordem[k + 1]]; [sets[k + 1], sets[k]] = [sets[k], sets[k + 1]]; pintarLista(); } }, 'Descer');
        sobe.disabled = !k; desce.disabled = k === ordem.length - 1;
        it.append(sobe, desce);
        if (k === 0) it.appendChild(E.el('small', 'es-juntar-tag', 'recebe a animação'));
        lista.appendChild(it);
      });
    };
    pintarLista();
    c.appendChild(lista);

    // prévia animada
    const prev = document.createElement('canvas'); prev.width = 160; prev.height = 120; prev.className = 'es-juntar-prev';
    const quadros = () => ordem.flatMap((it, k) => animIt(it, sets[k]).frames.map(f => ({ set: sets[k], f })));
    const campos = E.el('div', 'es-juntar-campos');
    const inNome = document.createElement('input'); inNome.value = limpaNome(prefixo(ordem.map(it => it.anim || FF.Assets.nomeSprite(it.spr)))) || 'animacao';
    if (deAnims && sets[0].def.anims[inNome.value]) inNome.value += '_junta';
    const inFps = document.createElement('input'); inFps.type = 'number'; inFps.min = 1; inFps.max = 60; inFps.value = 12;
    const ck = (txt, on, dica) => { const l = E.el('label', 'es-juntar-ck'); l.title = dica || ''; const i = document.createElement('input'); i.type = 'checkbox'; i.checked = on; l.append(i, document.createTextNode(' ' + txt)); return { l, i }; };
    const cLoop = ck('Repetir (loop)', false, 'A animação recomeça sozinha ao terminar');
    const cLixo = deAnims ? ck('Apagar as animações juntadas (do sprite do alvo)', false, 'As animações usadas que são do mesmo sprite do alvo vão para "Apagadas" (dá para trazer de volta). As de outros sprites ficam como estão.')
      : ck('Mandar os sprites soltos para a Lixeira', true, 'Os ' + (ordem.length - 1) + ' sprites que viraram quadros saem das listas (dá para restaurar em "🗑 Lixeira")');
    const cRen = ck('Dar ao primeiro sprite o nome da animação', !deAnims, 'Ex.: "ground_smash_fx_00" passa a aparecer como "ground_smash_fx"');
    const lin = (rot, inp) => { const d = E.el('label', 'es-juntar-lin'); d.append(document.createTextNode(rot + ' '), inp); return d; };
    campos.append(lin('Nome da animação', inNome), lin('Quadros por segundo', inFps), cLoop.l, cLixo.l);
    if (!deAnims) campos.appendChild(cRen.l);
    // fps sugerido: o da primeira animação
    const fps0 = (animIt(ordem[0], sets[0]) || {}).fps;
    if (deAnims && fps0 > 0) inFps.value = fps0;
    const meio = E.el('div', 'es-juntar-meio'); meio.append(prev, campos);
    c.appendChild(meio);
    const info = E.el('div', 'es-dica');
    const bts = E.el('div', 'ess-conf-bts');
    const btOk = E.botao('🎞 Juntar em animação', () => fazer(), 'Cria a animação (já fica salva no jogo)', 'es-bt-ouro');
    btOk.classList.add('es-juntar-ok');
    bts.appendChild(btOk);
    c.append(bts, info);
    let tm = null, i = 0, vivo = true;
    const tocar = () => {
      if (!vivo) return;
      const l = quadros(), g = prev.getContext('2d');
      g.clearRect(0, 0, prev.width, prev.height);
      if (l.length) {
        const q = l[i % l.length];
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        l.forEach(({ f }) => { x0 = Math.min(x0, -f[5]); y0 = Math.min(y0, -f[6]); x1 = Math.max(x1, f[3] - f[5]); y1 = Math.max(y1, f[4] - f[6]); });
        const s = Math.min((prev.width - 8) / (x1 - x0), (prev.height - 8) / (y1 - y0), 4);
        g.imageSmoothingEnabled = false;
        FF.drawFrame(g, q.set, q.f, prev.width / 2 - (x0 + x1) / 2 * s, prev.height / 2 - (y0 + y1) / 2 * s, s, false);
        i++;
      }
      tm = setTimeout(tocar, 1000 / Math.max(1, +inFps.value || 12));
    };
    const m = E.modal('🎞 Juntar em animação', c, { aoFechar: () => { vivo = false; clearTimeout(tm); } });
    tocar();

    async function fazer() {
      const nome = limpaNome(inNome.value);
      if (!nome) { E.aviso('Dê um nome para a animação.', 'erro'); return; }
      const alvo = ordem[0].spr;
      btOk.disabled = true; info.textContent = '⏳ Juntando…';
      try {
        let setA = FF.Assets.sprites[alvo] || await FF.Assets.loadSprite(alvo);
        if (setA.def.anims[nome] && !(await E.confirmar('Já existe', '"' + nome + '" já existe em "' + FF.Assets.nomeSprite(alvo) + '". Substituir?', 'Substituir', true))) { btOk.disabled = false; info.textContent = ''; return; }
        // imagens dos outros sprites viram atlas extras do primeiro
        const extras = (FF.Assets.infoSprite(alvo).atlas || []).slice();
        ordem.forEach((it, k) => { if (it.spr !== alvo) (sets[k].def.atlases || []).forEach(p => { if (!setA.def.atlases.includes(p) && !extras.includes(p)) extras.push(p); }); });
        const infoAntes = FF.Assets.infoSprite(alvo);
        const infoNova = Object.assign({}, infoAntes, { atlas: extras });
        if (!extras.length) delete infoNova.atlas;
        if (cRen.i.checked && !deAnims) infoNova.nome = inNome.value.trim() || nome;
        if (JSON.stringify(infoNova) !== JSON.stringify(infoAntes)) {
          FF.Edicoes.set(['spritesInfo', alvo], FF.Edicoes.infoGravar(alvo, infoNova));   // atlas e nome numa mudança só
          FF.Assets.descarregarSprite(alvo);
          setA = await FF.Assets.loadSprite(alvo);
        }
        const frames = [];
        ordem.forEach((it, k) => {
          const s = it.spr === alvo ? setA : sets[k];
          animIt(it, s).frames.forEach(f => {
            const q = copia(f);
            const ai = setA.def.atlases.indexOf(s.def.atlases[f[0]]);
            if (ai < 0) throw new Error('A imagem de "' + rotulo(it) + '" não entrou no sprite.');
            q[0] = ai;
            if (q[7] == null) q[7] = 1;
            frames.push(q);
          });
        });
        const fps = Math.max(1, Math.min(60, +inFps.value || 12));
        FF.Mods.salvar(alvo, nome, { fps, loop: cLoop.i.checked, repeatTo: 0, pingpong: false, frames });
        if (cLixo.i.checked && !deAnims) ordem.slice(1).forEach(it => { if (FF.Assets.doAcervo(it.spr)) E.mudarInfoSprite(it.spr, { oculto: true }); });
        if (cLixo.i.checked && deAnims) ordem.forEach(it => { if (it.spr === alvo && it.anim && it.anim !== nome) { if (FF.Mods.criada(alvo, it.anim)) FF.Mods.restaurar(alvo, it.anim); else FF.Mods.apagar(alvo, it.anim); } });
        if (E.renderSync) E.renderSync();
        m.fechar();
        E.aviso('🎞 "' + nome + '" criada em "' + FF.Assets.nomeSprite(alvo) + '" com ' + frames.length + ' quadros.' + (cLixo.i.checked ? (deAnims ? ' As originais foram apagadas.' : ' Os soltos foram para a Lixeira.') : ''), 'ok');
        if (cfg.aoTerminar) cfg.aoTerminar(alvo, nome);
      } catch (e) { btOk.disabled = false; info.textContent = '❌ ' + e.message; }
    }
    return m;
  }

  FF.EstudioJuntar = { abrir, prefixo };
})();
