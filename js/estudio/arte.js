// Estúdio — 🪪 arte do cartão de ataque: importar uma imagem do aparelho e escolher o recorte (proporção do cartão).
//   FF.EstudioArte.abrir({ titulo, atual: {img, x, y, w, h} | null, chave, def, formId, texto, aoSalvar(arte | null) })
// A imagem vai para o IndexedDB do aparelho (FF.ImagensUsr, assets/img/usr/arte_<chave>_<marca>.png) e sobe para o
// GitHub junto com as edições; quem salva o recorte (golpe, personagem) decide onde ele fica.
window.FF = window.FF || {};

FF.EstudioArte = {
  MAX: 1400,   // lado maior da imagem guardada (artes enormes são reduzidas)
  E() { return FF.Estudio; },

  // lê um arquivo de imagem e devolve {img (canvas), blob} já reduzido
  async lerArquivo(file) {
    const url = URL.createObjectURL(file);
    try {
      const im = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error('não é uma imagem')); i.src = url; });
      const k = Math.min(1, this.MAX / Math.max(im.naturalWidth, im.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
      const c = cv.getContext('2d'); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(im, 0, 0, cv.width, cv.height);
      const blob = await new Promise(ok => cv.toBlob(ok, 'image/png'));
      return { img: cv, blob };
    } finally { URL.revokeObjectURL(url); }
  },

  abrir(o) {
    const E = this.E(), C = FF.Cartao, R = C.W / C.H;
    const caixa = E.el('div', 'es-arte');
    const topo = E.el('div', 'es-arte-topo');
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none';
    topo.append(E.botao('⬆ Importar imagem…', () => inp.click(), 'PNG, JPG ou WEBP do seu aparelho'), inp);
    const dica = E.el('span', 'es-dica', 'Arraste a moldura para escolher a parte que aparece. Roda do mouse (ou o controle) = zoom.');
    topo.appendChild(dica);
    caixa.appendChild(topo);
    const cv = document.createElement('canvas'); cv.width = 720; cv.height = 420; cv.className = 'es-arte-cv';
    caixa.appendChild(cv);
    const zoom = document.createElement('input'); zoom.type = 'range'; zoom.min = '0.08'; zoom.max = '1'; zoom.step = '0.01';
    const lz = E.el('label', 'es-arte-zoom', '🔍 Tamanho do recorte '); lz.appendChild(zoom);
    caixa.appendChild(lz);
    caixa.appendChild(E.el('div', 'es-sub', 'Como fica no jogo'));
    const pv = document.createElement('canvas'); pv.width = C.W; pv.height = C.H; pv.className = 'es-arte-pv';
    caixa.appendChild(pv);
    const bts = E.el('div', 'es-escolha-bts');
    caixa.appendChild(bts);

    // estado: imagem (canvas ou <img>), recorte em pixels da imagem, arquivo novo (blob) se trocou
    const st = { im: null, blob: null, r: null };
    const larg = () => st.im ? (st.im.naturalWidth || st.im.width) : 1, alt = () => st.im ? (st.im.naturalHeight || st.im.height) : 1;
    const vista = () => { const k = Math.min(cv.width / larg(), cv.height / alt()); return { k, ox: (cv.width - larg() * k) / 2, oy: (cv.height - alt() * k) / 2 }; };
    const prender = () => {
      const r = st.r; r.w = Math.max(20, Math.min(r.w, larg(), alt() * R)); r.h = r.w / R;
      r.x = Math.max(0, Math.min(larg() - r.w, r.x)); r.y = Math.max(0, Math.min(alt() - r.h, r.y));
      zoom.value = String(r.w / Math.min(larg(), alt() * R));
    };
    const recorteInicial = () => { const w = Math.min(larg(), alt() * R) * 0.8; st.r = { x: (larg() - w) / 2, y: (alt() - w / R) * 0.25, w, h: w / R }; prender(); };
    const desenhar = () => {
      const c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      c.fillStyle = '#07040e'; c.fillRect(0, 0, cv.width, cv.height);
      if (!st.im) { c.fillStyle = '#9aa8c0'; c.font = '16px sans-serif'; c.textAlign = 'center'; c.fillText('Importe uma imagem (⬆) para começar', cv.width / 2, cv.height / 2); }
      else {
        const v = vista(), r = st.r;
        c.drawImage(st.im, v.ox, v.oy, larg() * v.k, alt() * v.k);
        c.fillStyle = 'rgba(0,0,0,0.55)';
        const rx = v.ox + r.x * v.k, ry = v.oy + r.y * v.k, rw = r.w * v.k, rh = r.h * v.k;
        c.fillRect(0, 0, cv.width, ry); c.fillRect(0, ry + rh, cv.width, cv.height - ry - rh); c.fillRect(0, ry, rx, rh); c.fillRect(rx + rw, ry, cv.width - rx - rw, rh);
        c.strokeStyle = '#ffcf3a'; c.lineWidth = 2; c.strokeRect(rx, ry, rw, rh);
      }
      const p = pv.getContext('2d'); p.clearRect(0, 0, pv.width, pv.height);
      if (st.im) FF.Assets.images['__arte_previa'] = st.im;
      C.desenhar(p, o.def, o.formId, st.im ? { img: '__arte_previa', x: st.r.x, y: st.r.y, w: st.r.w, h: st.r.h } : null, o.texto || 'Nome do golpe', 0, 0, C.W);
    };
    const usarImagem = (im, r) => { st.im = im; if (r) { st.r = Object.assign({}, r); prender(); } else recorteInicial(); desenhar(); };

    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; inp.value = '';
      if (!f) return;
      try { const { img, blob } = await this.lerArquivo(f); st.blob = blob; usarImagem(img); }
      catch (e) { E.aviso('Não deu para abrir a imagem: ' + e.message, 'erro'); }
    };
    // arrastar a moldura
    let arr = null;
    cv.addEventListener('pointerdown', (e) => {
      if (!st.im) { inp.click(); return; }
      const b = cv.getBoundingClientRect(), v = vista();
      arr = { x0: e.clientX, y0: e.clientY, r0: Object.assign({}, st.r), k: v.k * b.width / cv.width };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => { if (!arr) return; st.r.x = arr.r0.x + (e.clientX - arr.x0) / arr.k; st.r.y = arr.r0.y + (e.clientY - arr.y0) / arr.k; prender(); desenhar(); });
    cv.addEventListener('pointerup', () => { arr = null; });
    const zoomPara = (fr) => { if (!st.im) return; const r = st.r, cx = r.x + r.w / 2, cy = r.y + r.h / 2; r.w = fr * Math.min(larg(), alt() * R); r.h = r.w / R; r.x = cx - r.w / 2; r.y = cy - r.h / 2; prender(); desenhar(); };
    zoom.oninput = () => zoomPara(+zoom.value);
    cv.addEventListener('wheel', (e) => { if (!st.im) return; e.preventDefault(); zoomPara(Math.max(0.08, Math.min(1, +zoom.value * (e.deltaY > 0 ? 1.08 : 1 / 1.08)))); }, { passive: false });

    const m = E.modal(o.titulo || '🪪 Arte do cartão de ataque', caixa, { larga: true });
    bts.append(
      E.botao('✓ Usar esta arte', async () => {
        if (!st.im) return E.aviso('Importe uma imagem primeiro.', 'erro');
        let img = o.atual && o.atual.img;
        if (st.blob) {
          img = 'assets/img/usr/arte_' + String(o.chave || 'x').replace(/[^\w-]/g, '_') + '_' + Date.now().toString(36) + '.png';
          await FF.ImagensUsr.gravar(img, st.blob, false);
          FF.Assets.images[img] = st.im;
        }
        const r = st.r, arte = { img, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };
        m.fechar();
        o.aoSalvar && o.aoSalvar(arte);
      }, null, 'es-bt-ouro'),
      E.botao('Cancelar', () => m.fechar()));
    if (o.atual && o.atual.img) {
      dica.textContent = 'Carregando a arte…';
      FF.Cartao.carregar(o.atual).then(im => { dica.textContent = 'Arraste a moldura para escolher a parte que aparece. Roda do mouse (ou o controle) = zoom.'; if (im) usarImagem(im, o.atual); else desenhar(); });
    } else desenhar();
    return m;
  },

  // caixinha de prévia + botões, usada nas propriedades do golpe e na aba Personagens
  // o: { def, formId, texto, atual, chave, titulo, herdada (texto quando usa a de outro nível), aoSalvar }
  painel(o) {
    const E = this.E(), C = FF.Cartao;
    const g = E.el('div', 'es-arte-painel');
    const pv = document.createElement('canvas'); pv.width = C.W; pv.height = C.H; pv.className = 'es-arte-mini';
    const desenhar = () => { const c = pv.getContext('2d'); c.clearRect(0, 0, pv.width, pv.height); C.desenhar(c, o.def, o.formId, o.atual || o.herdadaArte || null, o.texto || 'Nome do golpe', 0, 0, C.W); };
    desenhar();
    const a = o.atual || o.herdadaArte;
    if (a && !C.img(a)) C.carregar(a).then(desenhar);
    g.appendChild(pv);
    if (!o.atual) g.appendChild(E.el('p', 'es-dica', o.herdada || 'Sem arte própria: usa a arte do Z Legends 3.'));
    const bts = E.el('div', 'es-bts-linha');
    bts.appendChild(E.botao(o.atual ? '✂ Trocar / recortar' : '⬆ Importar imagem', () => this.abrir({ titulo: o.titulo, atual: o.atual, chave: o.chave, def: o.def, formId: o.formId, texto: o.texto, aoSalvar: o.aoSalvar })));
    if (o.atual) bts.appendChild(E.botao('✕ Tirar', () => o.aoSalvar(null), 'Volta a usar a arte padrão'));
    g.appendChild(bts);
    return g;
  },
};
