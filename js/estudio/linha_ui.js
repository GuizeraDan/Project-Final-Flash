// Estúdio — linha do tempo estilo editor de vídeo (desenhada num canvas).
// O "host" (aba Golpes) fornece os dados e recebe as mudanças:
//   host.linha() → {duracao, trilhas}; host.dur(c, tr) → duração exibida; host.quadros(c, tr) → [tempos dos quadros]
//   host.t; host.irPara(t, arrastando); host.sel (id do clipe); host.trSel (id da trilha)
//   host.selecionar(clipeId|null, trilhaId); host.mudou(rotulo, juntar); host.adicionar(trilhaId, t)
//   host.loop {a, b} | null; host.redimensionavel(c) → pode esticar
window.FF = window.FF || {};

FF.EstudioLinha = class {
  constructor(box, host) {
    this.host = host;
    this.pxs = 220;            // pixels por segundo (zoom)
    this.ima = true;           // snap
    this.RG = 26; this.LH = FF.Estudio.rascunho.ler('tl_compacto') ? 20 : 30;
    box.classList.add('es-tl');
    box.innerHTML = '';
    const redim = FF.Estudio.el('div', 'es-tl-redim');
    this.barra = FF.Estudio.el('div', 'es-barra es-tl-barra');
    const corpo = FF.Estudio.el('div', 'es-tl-corpo');
    this.nomes = FF.Estudio.el('div', 'es-tl-nomes');
    this.area = FF.Estudio.el('div', 'es-tl-area');
    this.cv = document.createElement('canvas');
    this.area.appendChild(this.cv);
    corpo.append(this.nomes, this.area);
    box.append(redim, this.barra, corpo);
    this.box = box;
    this.montarBarra();
    this.area.addEventListener('scroll', () => { this.nomes.scrollTop = this.area.scrollTop; this.desenhar(); });
    this.area.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const r = this.area.getBoundingClientRect();
        const tx = (e.clientX - r.left + this.area.scrollLeft) / this.pxs;
        this.zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, tx, e.clientX - r.left);
      } else if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX) && this.cv.height <= this.area.clientHeight + 2) {
        e.preventDefault(); this.area.scrollLeft += e.deltaY;
      }
    }, { passive: false });
    this.ligarPonteiro();
    // redimensionar a altura da linha do tempo
    redim.addEventListener('pointerdown', (e) => {
      const y0 = e.clientY, h0 = box.offsetHeight;
      const mv = (ev) => { box.style.height = Math.max(110, Math.min(window.innerHeight * 0.75, h0 - (ev.clientY - y0))) + 'px'; this.render(); };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); FF.Estudio.rascunho.gravar('tl_altura', box.offsetHeight); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    const alt = FF.Estudio.rascunho.ler('tl_altura');
    if (alt) box.style.height = alt + 'px';
    new ResizeObserver(() => this.render()).observe(this.area);
  }

  montarBarra() {
    const E = FF.Estudio, b = this.barra;
    b.innerHTML = '<b class="es-tl-tit">🎞 Linha do tempo</b>';
    b.appendChild(E.botao('−', () => this.zoom(1 / 1.4), 'Diminuir zoom (Ctrl + roda)'));
    b.appendChild(E.botao('＋', () => this.zoom(1.4), 'Aumentar zoom (Ctrl + roda)'));
    b.appendChild(E.botao('⤢', () => this.enquadrar(), 'Mostrar tudo'));
    this.btIma = E.botao('🧲 Ímã', () => { this.ima = !this.ima; this.btIma.classList.toggle('on', this.ima); }, 'Encaixar nos quadros das animações, no cursor e nos outros clipes (segure Alt para soltar)');
    this.btIma.classList.add('on');
    b.appendChild(this.btIma);
    this.btLoop = E.botao('🔁 Trecho', () => { if (this.host.loop) this.host.loop = null; else this.host.loop = { a: Math.max(0, this.host.t - 0.5), b: this.host.t + 0.5 }; this.render(); this.host.aoMudarLoop && this.host.aoMudarLoop(); }, 'Repetir um trecho (Shift + arrastar na régua para marcar)');
    b.appendChild(this.btLoop);
    this.btComp = E.botao('▤ Compacto', () => { this.LH = this.LH === 30 ? 20 : 30; FF.Estudio.rascunho.gravar('tl_compacto', this.LH === 20); this.btComp.classList.toggle('on', this.LH === 20); this.render(); }, 'Trilhas mais baixas: cabem todas (Ações, Tela…) sem rolar');
    this.btComp.classList.toggle('on', this.LH === 20);
    b.appendChild(this.btComp);
    b.appendChild(E.el('span', 'sep'));
    this.info = E.el('span', 'es-tl-info');
    b.appendChild(this.info);
    b.appendChild(E.el('span', 'es-dica', 'Duplo clique numa trilha: novo clipe · arraste para mover · borda direita: esticar · Del apaga · Ctrl+D duplica'));
  }

  zoom(f, tAncora, xTela) {
    const t = tAncora != null ? tAncora : this.host.t;
    const x = xTela != null ? xTela : (t * this.pxs - this.area.scrollLeft);
    this.pxs = Math.max(30, Math.min(3000, this.pxs * f));
    this.render();
    this.area.scrollLeft = t * this.pxs - x;
  }
  enquadrar() {
    const d = (this.host.linha().duracao || 1) + 0.3;
    this.pxs = Math.max(30, Math.min(3000, (this.area.clientWidth - 20) / d));
    this.area.scrollLeft = 0;
    this.render();
  }

  // ---------- montagem dos nomes + tamanho do canvas ----------
  render() {
    const L = this.host.linha();
    if (!L) return;
    const E = FF.Estudio;
    this.nomes.innerHTML = '';
    const rg = E.el('div', 'es-tl-regua-n', '<small>tempo (s) · quadros</small>');
    this.nomes.appendChild(rg);
    L.trilhas.forEach((tr, i) => {
      const n = E.el('div', 'es-tl-nome' + (tr.id === this.host.trSel ? ' sel' : '') + (this.LH < 30 ? ' compacto' : ''));
      n.style.height = this.LH + 'px';
      n.style.borderLeft = '4px solid ' + this.cor(tr.tipo);
      const nome = E.el('b'); nome.textContent = this.nomeTrilha(tr); nome.title = this.nomeTrilha(tr);
      n.appendChild(nome);
      n.appendChild(E.botao(tr.oculta ? '🙈' : '👁', () => { tr.oculta = !tr.oculta; this.host.mudou(tr.oculta ? 'Esconder trilha' : 'Mostrar trilha'); }, tr.oculta ? 'Trilha desligada (não toca)' : 'Desligar esta trilha'));
      n.appendChild(E.botao('＋', () => this.host.adicionar(tr.id, this.host.t), 'Novo clipe nesta trilha no tempo do cursor'));
      n.onclick = (e) => { if (e.target.tagName !== 'BUTTON') this.host.selecionar(null, tr.id); };
      this.nomes.appendChild(n);
    });
    const dur = Math.max(L.duracao || 1, ...this.todos().map(x => x.c.t + this.host.dur(x.c, x.tr)));
    const w = Math.max(this.area.clientWidth, Math.ceil((dur + 1.5) * this.pxs));
    const h = this.RG + L.trilhas.length * this.LH;
    const dpr = 1;
    if (this.cv.width !== w * dpr || this.cv.height !== h * dpr) { this.cv.width = w * dpr; this.cv.height = h * dpr; this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px'; }
    this.btLoop.classList.toggle('on', !!this.host.loop);
    this.desenhar();
  }

  todos() { const l = []; (this.host.linha().trilhas || []).forEach((tr, i) => (tr.clipes || []).forEach(c => l.push({ c, tr, i }))); return l; }

  nomeTrilha(tr) {
    if (tr.nome) return tr.nome;
    return { lutador: 'Lutador', efeitos: 'Efeitos', projeteis: 'Projéteis', camadas: 'Camadas', sons: 'Sons', acertos: 'Acertos', tela: 'Tela', acoes: 'Ações' }[tr.tipo] || tr.tipo;
  }
  cor(tipo) { return { lutador: '#5a8cff', efeitos: '#ff8a3a', projeteis: '#ffd84a', camadas: '#b06cff', sons: '#3ad08a', acertos: '#ff4a5a', tela: '#9aa8c0', acoes: '#36c8d8' }[tipo] || '#888'; }

  rotulo(c) {
    const v = (x) => Array.isArray(x) ? x[0] + (x.length > 1 ? ' +' + (x.length - 1) : '') : (x || '');
    switch (c.tipo) {
      case 'anim': return (c.anim || '?') + (c.empurrao ? ' ⇠' : '');
      case 'mover': return '→ ' + ({ alvo: 'até o alvo', casa: 'para casa', frente: 'para frente', tras: 'para trás', x: 'x=' + c.x }[c.para] || c.para);
      case 'teleporte': return '⚡ ' + ({ alvo: 'até o alvo', casa: 'para casa', frente: 'frente', tras: 'trás', x: 'x' }[c.para] || c.para);
      case 'visivel': return (c.alpha ? '👁 aparece' : '🙈 some');
      case 'efeito': return '✺ ' + (c.fx || '?');
      case 'projetil': return '➶ ' + (c.fx || 'kiblast_amarelo');
      case 'camada': return '▣ ' + (c.anim || '?');
      case 'som': return '♪ ' + v(c.som);
      case 'voz': return '🗣 ' + v(c.voz);
      case 'acerto': return '✸ ' + (c.forca || 'leve') + ' ' + (c.fracao != null ? c.fracao : 1) + (c.lanca ? ' ⇠' : '') + (c.anel ? ' ◎' : '');
      case 'tremer': return '〰 ' + (c.forca || 6);
      case 'flash': return '✦ ' + (c.forca || 0.5);
      case 'mensagem': return '💬 ' + (c.texto || '');
      case 'camera': return '🎥 ×' + (c.zoom || 1) + ' ' + (c.foco || 'centro');
      case 'acao': return '⚙ ' + Object.keys(c.passo || {}).join(', ');
    }
    return c.tipo;
  }

  // ---------- desenho ----------
  desenhar() {
    const L = this.host.linha();
    if (!L) return;
    const ctx = this.cv.getContext('2d');
    const W = this.cv.width, H = this.cv.height, pxs = this.pxs, RG = this.RG, LH = this.LH;
    const x0 = this.area.scrollLeft, x1 = x0 + this.area.clientWidth;
    ctx.clearRect(0, 0, W, H);
    // trilhas
    L.trilhas.forEach((tr, i) => {
      const y = RG + i * LH;
      ctx.fillStyle = tr.id === this.host.trSel ? '#2a1c4c' : (i % 2 ? '#1a1030' : '#1e1336');
      ctx.fillRect(0, y, W, LH);
      ctx.fillStyle = '#2a1c48'; ctx.fillRect(0, y + LH - 1, W, 1);
    });
    // além do fim
    const xf = (L.duracao || 0) * pxs;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(xf, RG, W - xf, H - RG);
    // trecho em loop
    if (this.host.loop) {
      const { a, b } = this.host.loop;
      ctx.fillStyle = 'rgba(108,200,255,0.12)'; ctx.fillRect(a * pxs, 0, (b - a) * pxs, H);
      ctx.fillStyle = 'rgba(108,200,255,0.8)'; ctx.fillRect(a * pxs, 0, (b - a) * pxs, 4);
    }
    // régua
    ctx.fillStyle = '#120a22'; ctx.fillRect(0, 0, W, RG);
    const passos = [0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5];
    const maior = passos.find(p => p * pxs >= 70) || 5;
    const menor = 1 / 60 * pxs >= 5 ? 1 / 60 : maior / 5;
    ctx.font = '10px monospace'; ctx.textBaseline = 'top';
    for (let t = Math.floor(x0 / pxs / menor) * menor; t * pxs <= x1; t += menor) {
      const x = Math.round(t * pxs) + 0.5;
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, RG - 5, 1, 5);
    }
    for (let t = Math.floor(x0 / pxs / maior) * maior; t * pxs <= x1 + 1; t += maior) {
      const x = Math.round(t * pxs) + 0.5;
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x, 8, 1, RG - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, RG, 1, H - RG);
      ctx.fillStyle = '#d8ccff';
      ctx.fillText((Math.round(t * 1000) / 1000).toString().replace('.', ',') + 's', x + 3, 2);
      ctx.fillStyle = '#8a7cb0';
      ctx.fillText('q' + Math.round(t * 60), x + 3, 13);
    }
    // fim da linha
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(Math.round(xf), 0, 2, H);
    // clipes
    for (const { c, tr, i } of this.todos()) {
      const y = RG + i * LH + 3;
      const d = this.host.dur(c, tr);
      const x = c.t * pxs;
      const w = Math.max(d * pxs, 12);
      if (x > x1 || x + w < x0) continue;
      const sel = c.id === this.host.sel;
      const cor = this.cor(tr.tipo);
      ctx.globalAlpha = tr.oculta ? 0.3 : 1;
      ctx.fillStyle = cor + (d > 0 ? 'cc' : 'ff');
      this.ret(ctx, x, y, w, LH - 7, 4);
      ctx.fill();
      if (c.segurar) {   // espera parada no 1º quadro (anel)
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x, y, c.segurar * pxs, LH - 7);
      }
      // quadros das animações
      const qs = this.host.quadros(c, tr);
      if (qs && qs.length && d * pxs > qs.length * 3) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        qs.forEach(q => { if (q > 0 && q < d) ctx.fillRect(Math.round(x + q * pxs), y + LH - 13, 1, 6); });
      }
      if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; this.ret(ctx, x, y, w, LH - 7, 4); ctx.stroke(); }
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, Math.max(w, 160), LH - 7); ctx.clip();
      ctx.font = (sel ? 'bold ' : '') + '11px sans-serif'; ctx.textBaseline = 'middle';
      ctx.fillStyle = d * pxs > 40 ? '#10081c' : '#e8e0ff';
      ctx.fillText(this.rotulo(c), x + (d * pxs > 40 ? 4 : 14), y + (LH - 7) / 2);
      ctx.restore();
      if (d > 0 && this.host.redimensionavel(c)) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x + w - 3, y + 4, 2, LH - 15); }
      ctx.globalAlpha = 1;
    }
    // explosões que fazem parte de outro clipe (projétil, acerto): marca clarinha na trilha Efeitos; clicar abre o clipe dono
    this._fantasmas = [];
    const iEf = L.trilhas.findIndex(t => t.tipo === 'efeitos');
    if (iEf >= 0) {
      const yE = RG + iEf * LH + 3, hE = LH - 7;
      for (const { c, tr } of this.todos()) {
        let tI = null, fx = null;
        if (c.tipo === 'projetil' && c.impacto) { tI = c.t + this.host.dur(c, tr); fx = c.impacto; }
        else if (c.tipo === 'acerto' && c.fx) { tI = c.t; fx = c.fx; }
        if (tI == null) continue;
        const x = tI * pxs, w = 62;
        if (x > x1 || x + w < x0) continue;
        ctx.save();
        ctx.globalAlpha = c.id === this.host.sel ? 0.85 : 0.45;
        ctx.setLineDash([3, 3]); ctx.strokeStyle = '#ff8a3a'; ctx.lineWidth = 1;
        this.ret(ctx, x, yE, w, hE, 4); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.rect(x, yE, w, hE); ctx.clip();
        ctx.fillStyle = '#ffc89a'; ctx.font = '10px sans-serif'; ctx.textBaseline = 'middle';
        ctx.fillText('↳ ' + fx, x + 3, yE + hE / 2);
        ctx.restore();
        this._fantasmas.push({ x, y: yE, w, h: hE, id: c.id });
      }
    }
    // efeitos presos ao impacto de um objeto lançado: linha até o clipe do lançamento
    for (const { c, i } of this.todos()) {
      if (!c.prende) continue;
      const a = this.host.achar(c.prende); if (!a) continue;
      const iA = L.trilhas.indexOf(a.tr);
      const xa = a.c.t * pxs + 6, ya = RG + iA * LH + LH / 2, xe = c.t * pxs + 2, ye = RG + i * LH + LH / 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(54,200,216,0.55)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xa, ye); ctx.lineTo(xe, ye); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#36c8d8'; ctx.font = '10px sans-serif'; ctx.textBaseline = 'middle';
      ctx.fillText('🔗', xe - 13, ye);
    }
    // cursor
    const xc = Math.round(this.host.t * pxs) + 0.5;
    ctx.fillStyle = '#ff4a6a'; ctx.fillRect(xc - 0.5, 0, 2, H);
    ctx.beginPath(); ctx.moveTo(xc - 6, 0); ctx.lineTo(xc + 7, 0); ctx.lineTo(xc + 0.5, 9); ctx.closePath(); ctx.fill();
    this.info.textContent = this.fmt(this.host.t) + ' / ' + this.fmt(L.duracao || 0);
  }
  fmt(t) { return (Math.round(t * 1000) / 1000).toFixed(3).replace('.', ',') + ' s (q' + Math.round(t * 60) + ')'; }
  ret(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ---------- ponteiro ----------
  pos(e) { const r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  achar(p) {
    const L = this.host.linha();
    const i = Math.floor((p.y - this.RG) / this.LH);
    const tr = L.trilhas[i];
    if (!tr) return { tr: null };
    let melhor = null;
    for (const c of tr.clipes) {
      const x = c.t * this.pxs, w = Math.max(this.host.dur(c, tr) * this.pxs, 12);
      if (p.x >= x - 2 && p.x <= x + w + 2) { if (!melhor || c.t > melhor.c.t) melhor = { c, borda: this.host.dur(c, tr) > 0 && this.host.redimensionavel(c) && p.x >= x + w - 7 }; }
    }
    return { tr, i, c: melhor && melhor.c, borda: melhor && melhor.borda };
  }

  // pontos de encaixe
  encaixar(t, ignorar, alt) {
    if (!this.ima || alt) return Math.max(0, Math.round(t * 1000) / 1000);
    const lim = 7 / this.pxs;
    const cand = [0, this.host.t, this.host.linha().duracao || 0];
    for (const { c, tr } of this.todos()) {
      if (c === ignorar) continue;
      const d = this.host.dur(c, tr);
      cand.push(c.t, c.t + d);
      (this.host.quadros(c, tr) || []).forEach(q => cand.push(c.t + q));
    }
    let best = null, bd = lim;
    cand.forEach(x => { const dd = Math.abs(x - t); if (dd < bd) { bd = dd; best = x; } });
    if (best != null) return Math.max(0, Math.round(best * 1000) / 1000);
    return Math.max(0, Math.round(Math.round(t * 60) / 60 * 1000) / 1000);
  }

  ligarPonteiro() {
    let arr = null;
    this.cv.addEventListener('pointerdown', (e) => {
      const p = this.pos(e);
      this.cv.setPointerCapture(e.pointerId);
      const t = Math.max(0, p.x / this.pxs);
      if (p.y < this.RG) {
        arr = { modo: e.shiftKey ? 'loop' : 'cursor', t0: t };
        if (arr.modo === 'cursor') this.host.irPara(this.encaixar(t, null, e.altKey), true);
        return;
      }
      const fan = (this._fantasmas || []).find(f => p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h);
      if (fan && !this.achar(p).c) { this.host.selecionar(fan.id); arr = null; return; }
      const h = this.achar(p);
      if (h.c) {
        this.host.selecionar(h.c.id, h.tr.id, true);
        arr = { modo: h.borda ? 'esticar' : 'mover', c: h.c, tr: h.tr, x0: p.x, t0: h.c.t, d0: this.host.dur(h.c, h.tr), mexeu: false };
      } else if (h.tr) {
        this.host.selecionar(null, h.tr.id);
        this.host.irPara(this.encaixar(t, null, e.altKey), true);
        arr = { modo: 'cursor' };
      }
    });
    this.cv.addEventListener('pointermove', (e) => {
      const p = this.pos(e);
      if (!arr) {
        const h = p.y >= this.RG ? this.achar(p) : {};
        this.cv.style.cursor = h.borda ? 'ew-resize' : h.c ? 'grab' : p.y < this.RG ? 'col-resize' : 'default';
        return;
      }
      const t = Math.max(0, p.x / this.pxs);
      if (arr.modo === 'cursor') { this.host.irPara(this.encaixar(t, null, e.altKey), true); return; }
      if (arr.modo === 'loop') { const a = Math.min(arr.t0, t), b = Math.max(arr.t0, t); if (b - a > 0.02) this.host.loop = { a, b }; this.render(); return; }
      if (Math.abs(p.x - arr.x0) < 3 && !arr.mexeu) return;
      arr.mexeu = true;
      const dt = (p.x - arr.x0) / this.pxs;
      if (arr.modo === 'mover') {
        const novo = this.encaixar(arr.t0 + dt, arr.c, e.altKey);
        // encaixa também pelo fim do clipe
        const fim = this.encaixar(arr.t0 + dt + arr.d0, arr.c, e.altKey) - arr.d0;
        arr.c.t = Math.max(0, Math.abs(fim - (arr.t0 + dt)) < Math.abs(novo - (arr.t0 + dt)) ? Math.round(fim * 1000) / 1000 : novo);
      } else {
        const fim = this.encaixar(arr.t0 + arr.d0 + dt, arr.c, e.altKey);
        arr.c.d = Math.max(0.02, Math.round((fim - arr.c.t) * 1000) / 1000);
      }
      this.host.mudou(arr.modo === 'mover' ? 'Mover clipe' : 'Esticar clipe', true, true);
    });
    const fim = () => {
      if (arr && arr.mexeu) this.host.mudou(arr.modo === 'mover' ? 'Mover clipe' : 'Esticar clipe', true);
      if (arr && arr.modo === 'cursor') this.host.irPara(this.host.t, false);
      if (arr && arr.modo === 'loop') this.host.aoMudarLoop && this.host.aoMudarLoop();
      arr = null;
    };
    this.cv.addEventListener('pointerup', fim);
    this.cv.addEventListener('pointercancel', fim);
    this.cv.addEventListener('dblclick', (e) => {
      const p = this.pos(e);
      const h = this.achar(p);
      if (h.tr && !h.c) this.host.adicionar(h.tr.id, this.encaixar(p.x / this.pxs, null, e.altKey));
    });
  }

  // garante que o cursor apareça na tela
  seguir() {
    const x = this.host.t * this.pxs;
    if (x < this.area.scrollLeft || x > this.area.scrollLeft + this.area.clientWidth - 30) this.area.scrollLeft = Math.max(0, x - 60);
  }
};
