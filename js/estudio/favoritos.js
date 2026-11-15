// Estúdio — aba ⭐ Favoritos: tudo o que o usuário favoritou, separado pelas categorias dele.
// Sprites (FF.Favoritos: explosões, efeitos, personagens, cenários, interface) e sons (FF.FavSons: explosões,
// golpes, ki, auras, vozes, movimentos, músicas, interface, outros). Dá para ouvir/ver, mudar a categoria e tirar.
window.FF = window.FF || {};

(function () {
  const E = FF.Estudio;

  const A = {
    id: 'favoritos', nome: 'Favoritos', icone: '⭐',
    modo: 'sprites',
    montar(el) { this.el = el; el.classList.add('es-favs'); },
    mostrar() { this.render(); },
    esconder() { if (this.tocando) this.tocando.pause(); },

    render() {
      const el = this.el;
      el.innerHTML = '';
      const c = E.el('div', 'es-centro es-favs-centro');
      const barra = E.el('div', 'es-barra');
      const nS = FF.Favoritos.lista().length, nA = FF.FavSons.lista().length;
      const tab = (m, txt) => { const b = E.botao(txt, () => { this.modo = m; this.render(); }); if (this.modo === m) b.classList.add('on'); return b; };
      barra.append(tab('sprites', '🖼 Sprites (' + nS + ')'), tab('sons', '🎧 Sons (' + nA + ')'));
      barra.appendChild(E.el('span', 'es-dica', 'Favorite com a ☆ no seletor de sprites, na aba Sprites e no seletor de sons (🎧). Pela ☆ também dá para pôr o item em 📁 pastas suas.'));
      const corpo = E.el('div', 'es-rolar es-favs-corpo');
      c.append(barra, corpo);
      el.appendChild(c);
      if (this.modo === 'sons') this.sons(corpo); else this.sprites(corpo);
    },

    secao(corpo, ic, titulo, n) {
      const h = E.el('div', 'es-favs-tit'); h.textContent = ic + ' ' + titulo + ' (' + n + ')';
      corpo.appendChild(h);
      const g = E.el('div', 'es-grade es-favs-grade');
      corpo.appendChild(g);
      return g;
    },

    // 📁 pastas do usuário: barra com "＋ Nova pasta" e uma seção por pasta (✏ renomear, 🗑 apagar)
    pastas(corpo, F, desenharItens) {
      const barra = E.el('div', 'es-favs-pastas-barra');
      barra.appendChild(E.botao('＋ Nova pasta', () => {
        const inp = document.createElement('input'); inp.placeholder = 'Nome da pasta (ex.: Goku, Explosões grandes)'; inp.className = 'es-som-renomear';
        barra.replaceChildren(inp); inp.focus();
        const fim = (ok) => { if (ok) F.criarPasta(inp.value); this.render(); };
        inp.onkeydown = (e) => { if (e.key === 'Enter') fim(true); if (e.key === 'Escape') fim(false); };
        inp.onblur = () => fim(true);
      }, 'Criar uma pasta com o nome que quiser; coloque itens nela pela ☆ de cada um'));
      corpo.appendChild(barra);
      F.nomesPastas().forEach(nome => {
        const l = F.itensPasta(nome);
        const h = E.el('div', 'es-favs-tit es-favs-pasta');
        const t = E.el('span'); t.textContent = '📁 ' + nome + ' (' + l.length + ')';
        h.appendChild(t);
        h.appendChild(E.botao('✏', () => {
          const inp = document.createElement('input'); inp.value = nome; inp.className = 'es-som-renomear';
          t.replaceWith(inp); inp.focus(); inp.select();
          const fim = (ok) => { if (ok && inp.value.trim() !== nome && !F.renomearPasta(nome, inp.value)) E.aviso('Já existe uma pasta com esse nome.', 'erro'); this.render(); };
          inp.onkeydown = (e) => { if (e.key === 'Enter') fim(true); if (e.key === 'Escape') fim(false); };
          inp.onblur = () => fim(true);
        }, 'Renomear a pasta'));
        h.appendChild(E.botao('🗑', async () => {
          if (!(await E.confirmar('Apagar pasta', 'Apagar a pasta "' + nome + '"? O que está dentro dela continua no Estúdio.', '🗑 Apagar', true))) return;
          F.apagarPasta(nome); this.render();
        }, 'Apagar a pasta (os itens continuam)', 'es-bt-perigo'));
        corpo.appendChild(h);
        if (!l.length) { corpo.appendChild(E.el('p', 'es-dica', 'Pasta vazia: use a ☆ de um item e marque "' + nome + '".')); return; }
        desenharItens(l);
      });
    },

    sprites(corpo) {
      const F = FF.Favoritos;
      const cartoes = (g, l) => l.forEach(v => this.cartaoSprite(g, F, v));
      this.pastas(corpo, F, (l) => { const g = E.el('div', 'es-grade es-favs-grade'); corpo.appendChild(g); cartoes(g, l); });
      if (!F.lista().length) { corpo.appendChild(E.el('p', 'es-vazio', 'Nenhum sprite favoritado ainda.')); return; }
      F.TIPOS.forEach(([t, ic]) => {
        const l = F.lista(t);
        if (!l.length) return;
        const g = this.secao(corpo, ic, F.plural[t], l.length);
        cartoes(g, l);
      });
    },

    cartaoSprite(g, F, v) {
        {
          const k = E.el('div', 'es-cartao');
          const cv = document.createElement('canvas'); cv.width = 96; cv.height = 72;
          const sp = E.el('span'); sp.textContent = v.anim ? FF.Assets.nomeAnim(v.sprite, v.anim) : '(sprite inteiro)';
          const sb = E.el('small', 'es-cartao-fonte'); sb.textContent = FF.Assets.nomeSprite ? FF.Assets.nomeSprite(v.sprite) : v.sprite;
          k.title = v.sprite + (v.anim ? ' · ' + v.anim : '') + ' — clique para abrir na aba Sprites';
          k.append(cv, sp, sb, F.botao(v.sprite, v.anim, () => this.render()));
          FF.Assets.loadSprite(v.sprite).then(s => {
            if (!s) return;
            const a = v.anim && s.has(v.anim) ? v.anim : Object.keys(s.def.anims)[0];
            E.miniatura(cv, s, a, Math.floor(s.anim(a).frames.length / 2));
            if (FF.EstudioProps && FF.EstudioProps.animarNoMouse) FF.EstudioProps.animarNoMouse(k, cv, s, a);
          }).catch(() => {});
          k.onclick = async () => { await E.abrir('sprites'); if (E.Sprites) E.Sprites.abrirSprite(v.sprite, v.anim, true); };
          g.appendChild(k);
        }
    },

    sons(corpo) {
      const F = FF.FavSons;
      const info = {};
      E.sonsAcervo().forEach(([id, nome, dur, cat, fonte]) => (info[id] = { nome, dur, fonte }));
      if (FF.SonsUsr) FF.SonsUsr.importados().forEach(v => (info[v.id] = { nome: v.nome, dur: v.dur, fonte: 'usr' }));
      const NOMES = Object.assign({ zl3: 'Z Legends 3', usr: 'Meus sons' }, (window.FF_ACERVO_SONS && FF_ACERVO_SONS.fontes) || {});
      const linhas = (l) => l.forEach(v => {
          const id = v.sprite, x = info[id] || { nome: id, fonte: 'zl3' };
          const r = E.el('div', 'es-som');
          const play = E.botao('▶', () => {
            if (this.tocando) { this.tocando.pause(); if (this.tocandoId === id) { this.tocandoId = null; play.textContent = '▶'; return; } }
            this.tocando = FF.Audio.play(id); this.tocandoId = id; play.textContent = '■';
            if (this.tocando) this.tocando.onended = () => { play.textContent = '▶'; };
          }, 'Ouvir');
          const n = E.el('span', 'es-som-nome'); n.textContent = (FF.SonsUsr && FF.SonsUsr.nome(id)) || x.nome; n.title = id;
          const meta = E.el('small', 'es-som-meta'); meta.textContent = (NOMES[x.fonte] || x.fonte) + (x.dur ? ' · ' + x.dur.toFixed(1).replace('.', ',') + ' s' : '');
          const copiar = E.botao('📋', () => { navigator.clipboard && navigator.clipboard.writeText(id).catch(() => {}); E.aviso('Copiado: ' + id); }, 'Copiar o nome do som (para colar num campo de som)');
          r.append(play, n, meta, copiar, F.botao(id, null, () => this.render()));
          corpo.appendChild(r);
      });
      this.pastas(corpo, F, linhas);
      if (!F.lista().length) { corpo.appendChild(E.el('p', 'es-vazio', 'Nenhum som favoritado ainda. Abra o seletor de sons (botão 🎧 num campo de som) e clique na ☆.')); return; }
      F.TIPOS.forEach(([t, ic]) => {
        const l = F.lista(t);
        if (!l.length) return;
        const h = E.el('div', 'es-favs-tit'); h.textContent = ic + ' ' + F.plural[t] + ' (' + l.length + ')';
        corpo.appendChild(h);
        linhas(l);
      });
    },
  };
  E.registrarAba(A);
  E.Favoritos = A;
})();
