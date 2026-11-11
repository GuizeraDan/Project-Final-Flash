// Laboratório de golpes: abre uma batalha sem turnos para executar qualquer golpe de
// qualquer lutador, quantas vezes quiser, com vida/ki infinitos e câmera lenta.
// Ativado por index.html?teste=1&batalha=<id> (ou pelo menu "Laboratório" da tela de título).
window.FF = window.FF || {};

FF.Lab = {
  b: null,
  ocupado: false,
  ultimo: null,
  opts: { kiInfinito: true, vidaInfinita: true, rageCheia: false, guardaAuto: false, criticoAuto: false },

  run(b) {
    this.b = b;
    b.turnLabel = 'Laboratório de golpes';
    document.body.classList.add('com-lab');
    b.all.forEach(f => f.idle());
    this.montarPainel();
    this.ganchos();
    this.restaurar();
    setInterval(() => this.autoTempo(), 10);
    b.banner('Laboratório', 1.5);
  },

  // ---------- painel ----------
  montarPainel() {
    const el = document.createElement('div');
    el.id = 'lab';
    el.innerHTML = `
      <div class="lab-topo"><b>🧪 Laboratório</b><button id="lab-min" title="Minimizar">—</button></div>
      <label>Quem ataca <select id="lab-ator"></select></label>
      <label>Golpe <select id="lab-golpe"></select></label>
      <p class="desc" id="lab-desc"></p>
      <label>Alvo <select id="lab-alvo"></select></label>
      <button class="grande" id="lab-exec">▶ Executar golpe (Enter)</button>
      <div class="linha">
        <button id="lab-rep">↻ Repetir (R)</button>
        <button id="lab-rest">❤ Restaurar todos</button>
      </div>
      <h4>Forma</h4>
      <div class="linha"><select id="lab-forma" style="flex:1"></select><button id="lab-forma-ok">Aplicar</button></div>
      <h4>Opções</h4>
      <label><input type="checkbox" data-o="kiInfinito"> Ki infinito</label>
      <label><input type="checkbox" data-o="vidaInfinita"> Vida infinita (restaura após cada golpe)</label>
      <label><input type="checkbox" data-o="rageCheia"> Barra de Fúria sempre cheia</label>
      <label><input type="checkbox" data-o="guardaAuto"> Guarda perfeita automática</label>
      <label><input type="checkbox" data-o="criticoAuto"> Crítico perfeito automático</label>
      <label>Velocidade <select id="lab-vel">
        <option value="0.1">0,1× (bem lenta)</option><option value="0.25">0,25×</option><option value="0.5">0,5×</option><option value="1" selected>1×</option>
      </select></label>
      <h4>Registro</h4>
      <div id="lab-log"></div>
      <div class="linha"><a href="visualizador.html" target="_blank" style="color:#9fd0ff">Abrir visualizador de animações ↗</a></div>`;
    document.body.appendChild(el);
    const $ = (s) => el.querySelector(s);
    this.$ = $;
    $('#lab-min').onclick = () => el.classList.toggle('min');
    el.querySelectorAll('[data-o]').forEach(ck => {
      ck.checked = !!this.opts[ck.dataset.o];
      ck.onchange = () => { this.opts[ck.dataset.o] = ck.checked; this.aplicarOpcoes(); };
    });
    $('#lab-vel').onchange = (e) => { FF.Clock.scale = +e.target.value; };
    $('#lab-ator').onchange = () => this.preencherGolpes();
    $('#lab-golpe').onchange = () => this.descrever();
    $('#lab-exec').onclick = () => this.executar();
    $('#lab-rep').onclick = () => this.ultimo && this.executar(this.ultimo);
    $('#lab-rest').onclick = () => this.restaurar(true);
    $('#lab-forma-ok').onclick = () => {
      const f = this.ator();
      f.setForm($('#lab-forma').value);
      this.b.flash(0.4);
      this.preencherGolpes();
      this.log(f.nome + ' → forma ' + f.formId);
    };
    // impede que cliques no painel virem "apertos" de guarda/crítico
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'SELECT' && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) return;
      if (e.code === 'Enter') { e.preventDefault(); this.executar(); }
      if (e.code === 'KeyR' && this.ultimo) this.executar(this.ultimo);
    });

    const sel = $('#lab-ator');
    this.b.all.forEach((f, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = (f.isHero ? '🟦 ' : '🟥 ') + f.def.nome + (f.sufixo || '');
      sel.appendChild(o);
    });
    this.preencherGolpes();
  },

  ator() { return this.b.all[+this.$('#lab-ator').value]; },

  // golpes de todas as formas do personagem (ex.: Goku base e SSJ)
  golpesDe(f) {
    const lista = [];
    const vistos = new Set();
    for (const [fid, forma] of Object.entries(f.def.formas)) {
      (forma.golpes || []).forEach(id => {
        if (vistos.has(id) || !f.def.golpes[id]) return;
        vistos.add(id);
        lista.push({ id, forma: fid });
      });
    }
    Object.keys(f.def.golpes).forEach(id => { if (!vistos.has(id)) lista.push({ id, forma: null }); });
    return lista;
  },

  preencherGolpes() {
    const f = this.ator();
    const $ = this.$;
    const sg = $('#lab-golpe');
    sg.innerHTML = '';
    this.golpesDe(f).forEach(g => {
      const mv = f.def.golpes[g.id];
      const o = document.createElement('option');
      o.value = g.id;
      o.dataset.forma = g.forma || '';
      const tags = [mv.supremo ? 'SUPREMO' : '', mv.requer && mv.requer.parceiro ? 'SPARKING' : '', g.forma && g.forma !== f.formId ? 'forma ' + g.forma : ''].filter(Boolean);
      o.textContent = (mv.nome || g.id) + (tags.length ? '  [' + tags.join(', ') + ']' : '');
      sg.appendChild(o);
    });
    const sa = $('#lab-alvo');
    sa.innerHTML = '';
    const outros = this.b.all.filter(x => x !== f);
    outros.sort((a, b2) => (a.isHero === f.isHero) - (b2.isHero === f.isHero));
    outros.forEach(x => {
      const o = document.createElement('option');
      o.value = this.b.all.indexOf(x);
      o.textContent = (x.isHero ? '🟦 ' : '🟥 ') + x.def.nome + (x.sufixo || '');
      sa.appendChild(o);
    });
    const sf = $('#lab-forma');
    sf.innerHTML = '';
    Object.entries(f.def.formas).forEach(([fid, fo]) => {
      const o = document.createElement('option');
      o.value = fid; o.textContent = (fo.nome || fid) + (fid === f.formId ? ' (atual)' : '');
      sf.appendChild(o);
    });
    sf.value = f.formId;
    this.descrever();
  },

  descrever() {
    const f = this.ator();
    const mv = f.def.golpes[this.$('#lab-golpe').value];
    if (!mv) return;
    const custo = [mv.custoKi ? mv.custoKi + ' KI' : '', mv.poder ? 'poder ' + mv.poder : ''].filter(Boolean).join(' · ');
    this.$('#lab-desc').textContent = (mv.descricao || '') + (custo ? '  (' + custo + ')' : '');
  },

  // ---------- execução ----------
  async executar(pedido) {
    if (this.ocupado) return;
    const $ = this.$;
    const p = pedido || {
      ator: +$('#lab-ator').value, golpe: $('#lab-golpe').value,
      forma: $('#lab-golpe').selectedOptions[0] && $('#lab-golpe').selectedOptions[0].dataset.forma,
      alvo: +$('#lab-alvo').value,
    };
    const b = this.b;
    const actor = b.all[p.ator], target = b.all[p.alvo];
    const move = actor.def.golpes[p.golpe];
    if (!move || !target) return;
    this.ultimo = p;
    this.ocupado = true;
    $('#lab-exec').disabled = true;
    try {
      if (p.forma && p.forma !== actor.formId && !(move.roteiro || []).some(s => s.transformar)) actor.setForm(p.forma);
      this.aplicarOpcoes();
      const parc = move.requer && move.requer.parceiro && b.all.find(x => x.id === move.requer.parceiro.id);
      if (move.requer && move.requer.parceiro && !parc) this.log('⚠ ' + move.nome + ' precisa do ' + move.requer.parceiro.id + ' nesta batalha');
      if (move.supremo) actor.rage = 100;
      target.ko = false; target.idle();
      this.log('▶ ' + actor.nome + ': ' + (move.nome || p.golpe) + ' → ' + target.nome);
      this.danoTotal = 0;
      b.atual = actor;
      await b.execute(actor, target, move);
      b.atual = null;
      this.log('   dano total: ' + Math.round(this.danoTotal));
    } catch (err) {
      console.error(err);
      this.log('❌ erro: ' + err.message);
    }
    if (this.opts.vidaInfinita) this.restaurar();
    this.aplicarOpcoes();
    this.ocupado = false;
    $('#lab-exec').disabled = false;
    this.preencherGolpesSeMudouForma(actor);
  },

  preencherGolpesSeMudouForma(actor) {
    if (this.ator() === actor && this.$('#lab-forma').value !== actor.formId) this.preencherGolpes();
  },

  restaurar(posicoes) {
    const b = this.b;
    b.all.forEach(f => {
      f.ko = false;
      f.hp = f.hpMax;
      if (this.opts.kiInfinito) f.ki = f.kiMax;
      f.atordoado = 0;
      f.vx = 0;
      if (posicoes) { f.x = f.homeX; f.buffs = {}; }
      if (!f.busy) f.idle();
    });
    b.over = false;
  },

  aplicarOpcoes() {
    this.b.all.forEach(f => {
      if (this.opts.kiInfinito) f.ki = f.kiMax;
      if (this.opts.rageCheia) f.rage = 100;
    });
  },

  // aperta o botão de ação no tempo perfeito (para ver a guarda/crítico sem precisar acertar)
  autoTempo() {
    const b = this.b;
    if (!b || (!this.opts.guardaAuto && !this.opts.criticoAuto)) return;
    for (const q of b.qtes) {
      if (q.result !== undefined || q.press || q._lab) continue;
      if ((q.mode === 'guarda' && !this.opts.guardaAuto) || (q.mode === 'critico' && !this.opts.criticoAuto)) continue;
      const left = q.at - FF.Clock.t;
      if (left > 0 && left < 0.06) { q._lab = 1; b.onPress(); }
    }
  },

  ganchos() {
    const b = this.b;
    const orig = b.applyHit.bind(b);
    b.applyHit = (att, def, move, spec, qte) => {
      const d = orig(att, def, move, spec, qte);
      if (typeof d === 'number') this.danoTotal = (this.danoTotal || 0) + d;
      if (this.opts.vidaInfinita && def.hp <= 0) { def.hp = 1; def.ko = false; }
      return d;
    };
    // nunca encerrar a batalha no laboratório
    b.checkEnd = () => false;
  },

  log(txt) {
    const el = this.$('#lab-log');
    el.textContent += txt + '\n';
    el.scrollTop = el.scrollHeight;
  },
};
