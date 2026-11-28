// Retratos e banners dos personagens (arte de seleção do Z Legends 3, sprite "retratos").
// Cada forma do personagem pode ter "retrato": {"quadro": N, "banner": M}. Sem retrato, usa a
// cabeça do sprite de batalha (ex.: Saibaman).
window.FF = window.FF || {};

FF.Retrato = {
  info(def, formId) {
    const f = def.formas[formId || def.formaInicial] || Object.values(def.formas)[0];
    return { forma: f, r: f.retrato || null };
  },

  // tipo: 'retrato' (rosto 40×56) ou 'banner' (arte inclinada 134×163). Desenha cobrindo a caixa.
  desenhar(ctx, def, formId, tipo, x, y, w, h, opts = {}) {
    const set = FF.Assets.sprites.retratos;
    const { forma, r } = this.info(def, formId);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (opts.fundo !== false) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, opts.cor1 || '#2a3466'); g.addColorStop(1, opts.cor2 || '#0c0f22');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    }
    const idx = r ? (tipo === 'banner' ? r.banner : r.quadro) : null;
    const a = set && set.anim(tipo === 'banner' ? 'banner' : 'retrato');
    // elenco: o banner (caixa larga dos times) usa o corpo do sprite de batalha quando ele já está carregado
    const im = r && r.img && !(tipo === 'banner' && FF.Assets.sprites[forma.sprite]) && FF.Assets.images[r.img];
    if (im) {
      // retrato recortado (elenco do acervo): um pedaço de uma imagem com vários rostos
      const s = Math.max(w / r.w, h / r.h), dw = r.w * s, dh = r.h * s;
      const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
      ctx.imageSmoothingEnabled = false;
      if (opts.espelhar) { ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(im, r.x, r.y, r.w, r.h, 0, 0, dw, dh); }
      else ctx.drawImage(im, r.x, r.y, r.w, r.h, dx, dy, dw, dh);
    } else if (a && idx != null && a.frames[idx]) {
      const f = a.frames[idx];
      const s = Math.max(w / f[3], h / f[4]);
      const dw = f[3] * s, dh = f[4] * s;
      const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
      if (opts.espelhar) { ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(set.images[f[0]], f[1], f[2], f[3], f[4], 0, 0, dw, dh); }
      else ctx.drawImage(set.images[f[0]], f[1], f[2], f[3], f[4], dx, dy, dw, dh);
    } else {
      // sem retrato: cabeça e tronco do sprite de batalha
      const sp = FF.Assets.sprites[forma.sprite];
      const nome = (forma.anims || {}).parado || 'Parado';
      // animação "parado"; se ela for derivada (sprite incompleto, ex.: Saibaman), usa o quadro de origem
      const der = (forma.animsDerivadas || {})[nome];
      let fr = null;
      if (sp && sp.anim(nome)) fr = sp.anim(nome).frames[0];
      else if (sp && der && sp.anim(der.de)) { const src = sp.anim(der.de).frames; fr = src[Math.min((der.quadros || [0])[0], src.length - 1)]; }
      else if (sp) fr = sp.anim(Object.keys(sp.def.anims)[0]).frames[0];
      if (fr) {
        const s = Math.min((h / fr[4]) * 1.15, (w / fr[3]) * 1.1);   // tronco e cabeça, sem cortar demais
        FF.drawFrame(ctx, sp, fr, x + w / 2, y + h * 1.06, s, !!opts.espelhar);
      }
    }
    if (opts.escurecer) { ctx.fillStyle = opts.escurecer; ctx.fillRect(x, y, w, h); }
    ctx.restore();
  },

  // versão para <canvas> do DOM (menus): carrega o que faltar e desenha
  async noCanvas(canvas, def, formId, tipo, opts) {
    const { forma, r } = this.info(def, formId);
    if (r && r.img && tipo !== 'banner') await FF.Assets.loadImage(r.img).catch(() => null);   // só a imagem dos rostos (não baixa o sprite)
    else if (r && r.img) await Promise.all([FF.Assets.loadImage(r.img).catch(() => null), FF.Assets.loadSprite(forma.sprite).catch(() => null)]);
    else await Promise.all([FF.Assets.loadSprite('retratos').catch(() => null), FF.Assets.loadSprite(forma.sprite).catch(() => null)]);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.desenhar(ctx, def, formId, tipo, 0, 0, canvas.width, canvas.height, opts);
  },
};

// 🪪 CARTÃO DE ATAQUE (como no Attack of the Saiyans): em todo golpe, um cartão com a arte de quem ataca e o nome do
// golpe desliza pelo lado dele e some. Arte (recorte de uma imagem importada no Estúdio, {img, x, y, w, h}):
//   golpe.arte → edicoes.artes["<personagem>:<forma>"] → edicoes.artes["<personagem>"] → banner do sprite "retratos"
FF.Cartao = {
  W: 520, H: 170,   // tamanho do cartão (o recorte da arte tem essa proporção)
  _carregando: {},
  arte(def, formId, move) {
    if (move && move.arte && move.arte.img) return move.arte;
    const ed = (FF.Edicoes && FF.Edicoes.dados().artes) || {}, id = def && def.id;
    return (id && (ed[id + ':' + formId] || ed[id])) || null;
  },
  // imagem da arte (carrega na primeira vez: cópia do aparelho se ainda não subiu, senão do site); null = ainda não
  img(a) {
    if (!a || !a.img) return null;
    const im = FF.Assets.images[a.img];
    if (im) return im;
    if (!this._carregando[a.img]) {
      this._carregando[a.img] = (FF.ImagensUsr ? FF.ImagensUsr.url(a.img) : Promise.resolve(a.img))
        .then(u => FF.Assets.loadImage(u)).then(img => { FF.Assets.images[a.img] = img; return img; })
        .catch(() => null);
    }
    return null;
  },
  async carregar(a) { if (!a || !a.img) return null; return this.img(a) || (await this._carregando[a.img]); },
  // deixa prontas as artes de um personagem (golpes + padrão) para o cartão não aparecer sem imagem
  preparar(def) {
    if (!def) return;
    Object.values(def.golpes || {}).forEach(g => { if (g && g.arte) this.img(g.arte); });
    const ed = (FF.Edicoes && FF.Edicoes.dados().artes) || {};
    Object.keys(ed).forEach(k => { if (k === def.id || k.startsWith(def.id + ':')) this.img(ed[k]); });
  },
  // desenha o cartão em (x, y) com largura w; k = 0..1 de entrada (alpha); espelhar = vem da direita
  desenhar(ctx, def, formId, arte, texto, x, y, w, opts = {}) {
    const h = w * this.H / this.W, inc = h * 0.28, esp = !!opts.espelhar;
    // paralelogramo inclinado (refeito antes de cada recorte/contorno: o retrato padrão mexe no caminho)
    const forma = () => {
      ctx.beginPath();
      if (!esp) { ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - inc, y + h); ctx.lineTo(x, y + h); }
      else { ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x + inc, y + h); }
      ctx.closePath();
    };
    ctx.save();
    forma();
    ctx.save(); ctx.clip();
    const g0 = ctx.createLinearGradient(0, y, 0, y + h); g0.addColorStop(0, '#2a3466'); g0.addColorStop(1, '#0c0f22');
    ctx.fillStyle = g0; ctx.fillRect(x, y, w, h);
    const im = this.img(arte);
    if (im) {
      const a = arte, s = Math.max(w / a.w, h / a.h), dw = a.w * s, dh = a.h * s;
      ctx.imageSmoothingEnabled = true;
      if (esp) { ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(im, a.x, a.y, a.w, a.h, (w - dw) / 2, (h - dh) / 2, dw, dh); ctx.restore(); }
      else ctx.drawImage(im, a.x, a.y, a.w, a.h, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    } else if (def && def.formas) {
      try { FF.Retrato.desenhar(ctx, def, formId, 'banner', x + (esp ? 0 : w * 0.35), y - h * 0.6, w * 0.65, h * 2.2, { fundo: false, espelhar: esp }); } catch (e) { /* sem arte */ }
    }
    ctx.restore();
    forma();
    ctx.save(); ctx.clip();
    // faixa escura embaixo para o nome
    const g1 = ctx.createLinearGradient(0, y + h * 0.45, 0, y + h); g1.addColorStop(0, 'rgba(0,0,0,0)'); g1.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = g1; ctx.fillRect(x, y, w, h);
    ctx.restore();
    forma();
    ctx.lineWidth = Math.max(2, w / 130); ctx.strokeStyle = opts.cor || '#ffcf3a'; ctx.stroke();
    if (texto) {
      const tam = Math.round(h * 0.24);
      const g2 = ctx.createLinearGradient(0, y + h - tam * 1.6, 0, y + h - tam * 0.3); g2.addColorStop(0, '#fffbb0'); g2.addColorStop(0.5, '#ffd21a'); g2.addColorStop(1, '#ff7a00');
      const tx = esp ? x + w - h * 0.12 : x + h * 0.12;
      if (FF.HUD && FF.HUD.textoHud) FF.HUD.textoHud(ctx, texto, tx, y + h - tam * 0.75, tam, g2, esp ? 'right' : 'left', w - inc - h * 0.24);
      else { ctx.font = 'bold ' + tam + 'px sans-serif'; ctx.fillStyle = '#ffd21a'; ctx.textAlign = esp ? 'right' : 'left'; ctx.fillText(texto, tx, y + h - tam * 0.5); }
    }
    ctx.restore();
  },
};
