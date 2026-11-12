// Estúdio — aba Projeto: tudo o que foi mudado no jogo (data/edicoes.js + pendentes deste aparelho),
// voltar itens ao original, exportar/importar o projeto inteiro em JSON (com as imagens importadas).
window.FF = window.FF || {};

(function () {
  const E = FF.Estudio;
  const NOMES = { golpes: '🎬 Golpes alterados', habilidades: '⭐ Habilidades', sprites: '🖼 Animações de sprites', personagens: '🧑 Personagens', spritesNovos: '📥 Sprites importados', spritesInfo: '📏 Escala de sprites' };

  const P = {
    id: 'projeto', nome: 'Projeto', icone: '📦',
    montar(el) { this.el = el; el.classList.add('es-projeto'); },
    mostrar() { this.render(); },

    // lista plana de [caminho, valor]
    itens() {
      const d = FF.Edicoes.dados(), l = [];
      FF.Edicoes.SECOES.forEach(s => {
        const sec = d[s] || {};
        if (s === 'golpes' || s === 'sprites') Object.entries(sec).forEach(([a, m]) => Object.keys(m || {}).forEach(b => l.push([[s, a, b], m[b]])));
        else Object.keys(sec).forEach(a => l.push([[s, a], sec[a]]));
      });
      return l;
    },

    async render() {
      const el = this.el;
      el.innerHTML = '';
      const c = E.el('div', 'es-centro');
      const barra = E.el('div', 'es-barra');
      barra.append(
        E.botao('📤 Exportar projeto', () => this.exportar(), 'Baixa um JSON com todas as suas mudanças e imagens importadas', 'es-bt-ouro'),
        E.botao('📥 Importar projeto…', () => this.importar(), 'Aplica um projeto exportado (substitui os itens iguais)'),
        E.botao('☁ Sincronização', () => E.abrirSync()));
      c.appendChild(barra);
      const rol = E.el('div', 'es-rolar');
      rol.style.padding = '8px 14px';
      const pend = FF.Edicoes.pendentes().length;
      const imgs = FF.ImagensUsr ? await FF.ImagensUsr.pendentes() : [];
      rol.appendChild(E.el('p', 'es-dica', '<b>' + FF.Edicoes.resumo() + '</b>' + (pend ? ' · ' + pend + ' mudança(s) só neste aparelho' : '') + (imgs.length ? ' · ' + imgs.length + ' imagem(ns) esperando envio' : '')));
      const itens = this.itens();
      if (!itens.length) rol.appendChild(E.el('p', 'es-vazio', 'Nenhuma mudança ainda. Tudo o que você salvar no Estúdio, no Editor ou no visualizador aparece aqui.'));
      let grupo = null, box = null;
      itens.forEach(([cam, v]) => {
        if (cam[0] !== grupo) { grupo = cam[0]; box = E.grupo(NOMES[grupo] || grupo); rol.appendChild(box); }
        const r = E.el('div', 'es-item');
        const n = E.el('span');
        n.textContent = cam.slice(1).join(' › ') + (v && v.nome ? ' — ' + v.nome : '');
        r.appendChild(n);
        const sm = E.el('small'); sm.textContent = (JSON.stringify(v).length / 1024).toFixed(1) + ' KB'; r.appendChild(sm);
        if (cam[0] === 'golpes') r.appendChild(E.botao('✏', () => { location.href = 'estudio.html?aba=golpes&personagem=' + cam[1] + '&golpe=' + cam[2]; }, 'Abrir na aba Golpes'));
        if (cam[0] === 'habilidades') r.appendChild(E.botao('✏', () => { location.href = 'estudio.html?aba=golpes&hab=' + cam[1]; }, 'Abrir na aba Golpes'));
        r.appendChild(E.botao(cam[0] === 'habilidades' || cam[0] === 'spritesNovos' || (cam[0] === 'personagens' && v && v.novo) ? '🗑' : '↺', () => {
          if (!confirm('Desfazer/apagar "' + cam.slice(1).join(' › ') + '" em todos os aparelhos?')) return;
          E.salvarNoJogo(cam, null, '↺ Removido.');
          if (cam[0] === 'sprites' && FF.Mods) FF.Mods.restaurar(cam[1], cam[2]);
          this.render();
        }, 'Voltar ao original / apagar'));
        box.appendChild(r);
      });
      c.appendChild(rol);
      el.appendChild(c);
    },

    async exportar() {
      const imagens = {};
      if (FF.ImagensUsr) for (const im of await FF.ImagensUsr.todas()) {
        imagens[im.caminho] = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(im.blob); });
      }
      const proj = { final_flash_projeto: 1, data: new Date().toISOString(), edicoes: FF.Edicoes.dados(), imagens };
      const txt = JSON.stringify(proj);
      FF.Codecs.baixar(new Blob([txt], { type: 'application/json' }), 'final_flash_projeto.json');
      E.aviso('📤 Projeto exportado (' + (txt.length / 1024).toFixed(0) + ' KB).', 'ok');
    },
    importar() {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        try { await this.aplicar(JSON.parse(await f.text())); } catch (e) { E.aviso('Não deu para importar: ' + e.message, 'erro'); }
      };
      inp.click();
    },
    async aplicar(proj) {
      if (!proj || !proj.edicoes) throw new Error('arquivo não é um projeto do Estúdio');
      for (const [cam, data] of Object.entries(proj.imagens || {})) {
        const blob = await (await fetch(data)).blob();
        await FF.ImagensUsr.gravar(cam, blob, false);
      }
      const l = FF.Edicoes.pendentes();
      let n = 0;
      FF.Edicoes.SECOES.forEach(s => {
        const sec = proj.edicoes[s] || {};
        const add = (c, v) => { l.push({ c, v, t: Date.now() }); n++; };
        if (s === 'golpes' || s === 'sprites') Object.entries(sec).forEach(([a, m]) => Object.entries(m || {}).forEach(([b, v]) => add([s, a, b], v)));
        else Object.entries(sec).forEach(([a, v]) => add([s, a], v));
      });
      FF.Edicoes.gravarPendentes(l);
      FF.Edicoes._cache = null;
      FF.Edicoes.avisar();
      FF.Edicoes.enviar();
      E.aviso('📥 ' + n + ' item(ns) importado(s). Recarregue a página para ver tudo.', 'ok');
      this.render();
    },
  };
  E.registrarAba(P);
  E.Projeto = P;
})();
