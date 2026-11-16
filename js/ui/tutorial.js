// Tutorial do jogo (menu inicial → 📖 Tutorial): páginas com texto e desenhos feitos com as peças reais do jogo
// (painel do HUD, retratos, sprites) + "Luta de treino" guiada (data/battles/tutorial.json, dicas na hora certa).
// Teclado: ← → páginas, Esc fecha. Toque/clique nos botões.
window.FF = window.FF || {};

FF.Tutorial = {
  pagina: 0,

  PAGINAS: [
    { t: 'Bem-vindo, guerreiro!', ic: '🐉', ilu: 'time', h: `
      <p>No <b>Project Final Flash</b> você comanda um time de até <b>3 heróis</b> em lutas por turnos, no estilo de <i>Dragon Ball Z: Attack of the Saiyans</i>.</p>
      <p>O objetivo é simples: <b>derrubar todos os inimigos</b> antes que eles derrubem o seu time. Mas cada turno tem truques: tempo certo nos botões, escudos para quebrar, energia para guardar e golpes finais espetaculares.</p>
      <p class="tut-dica">Use as setas ← → (ou os botões) para passar as páginas. No fim dá para fazer uma <b>luta de treino</b> guiada.</p>` },

    { t: 'A rodada: planeje e depois AÇÃO!', ic: '🗺️', ilu: 'linha', h: `
      <p>Cada rodada tem duas partes:</p>
      <ol><li><b>Planejamento</b> — você escolhe o golpe (e o alvo) de <b>cada herói</b>, um de cada vez. O topo mostra "Planejando 1/3". Errou? <b>↩ Voltar</b> (ou Esc) volta para o herói anterior.</li>
      <li><b>AÇÃO!</b> — todo mundo age na ordem da <b>velocidade</b>, heróis e inimigos misturados.</li></ol>
      <p>A <b>linha do tempo</b> no topo mostra essa ordem: quem já agiu fica apagado com ✓, quem age agora brilha em dourado, 💫 = atordoado (vai para o fim). As setas <b style="color:#7dff9a">▲</b>/<b style="color:#ff8a7a">▼</b> avisam quem vai jogar antes ou depois na próxima rodada: golpes rápidos adiantam, supremos e transformações atrasam.</p>` },

    { t: 'O painel (HUD)', ic: '📟', ilu: 'hud', h: `
      <ol class="tut-leg"><li><b>Retrato</b> do lutador.</li>
      <li><b>Vida</b> — chegou a zero, caiu.</li>
      <li><b>Ki</b> — energia para os golpes especiais (o custo aparece no golpe: "· 30 KI"). Ganha carregando ki, um pouco a cada turno e <b>apanhando</b> (levar golpe dá mais ki, defender dá menos).</li>
      <li><b>Nome</b> e o <b>KI</b> em número.</li>
      <li><b>Pontos de Impulso</b> — as bolinhas douradas (veja a página do Impulso).</li>
      <li><b>Fúria (RAGE)</b> — enche ao bater e ao apanhar. Cheia, o painel pega fogo: <b>SPARKING!</b> e o Supremo fica liberado.</li></ol>
      <p class="tut-dica">Os inimigos têm o mesmo painel, espelhado, do lado direito.</p>` },

    { t: 'Escolhendo golpes: as Esferas', ic: '🟠', ilu: 'menu', h: `
      <p>Na sua vez aparecem quatro esferas embaixo da tela:</p>
      <ul><li><b style="color:#4fe3ff">ATAQUES</b> — socos, raios, Supremo e Sparking Combo.</li>
      <li><b style="color:#ffe14a">FORMAS</b> — transformações (ex.: Super Saiyajin).</li>
      <li><b style="color:#ff6a5a">BUFFS</b> — reforços (ex.: Kaioken) e cura.</li>
      <li><b style="color:#b07aff">KI</b> — <b>um clique carrega o ki</b>.</li></ul>
      <p><b>Passe o mouse</b> numa esfera: os golpes aparecem em cima dela. Suba o mouse e <b>clique no golpe</b>. Tirou o mouse, o menu minimiza. Golpe apagado = falta ki ou condição (o motivo aparece ao lado).</p>
      <p class="tut-dica">Teclado: ← → esferas · ↑ ↓ golpes · Enter escolhe · 1–9 atalhos. Celular: toque na esfera e depois no golpe.</p>` },

    { t: 'Pontos de Impulso', ic: '✦', ilu: 'impulso', h: `
      <p>Todo lutador começa com <b>0 pontos</b> e ganha <b>1 a cada turno em que não usar</b> (até 5). Enquanto você escolhe, aparece uma <b>aura</b> nele: azul, dourada e vermelha.</p>
      <p>Antes de escolher o golpe, aperte <b>E</b> (ou <b>+</b>) para concentrar até <b>3 níveis</b> — <b>Q</b> (ou <b>−</b>) tira. O golpe ganha um "<b>×2</b>", "<b>×3</b>" ou "<b>×4</b>":</p>
      <ul><li><b>+25% de dano</b> por nível e raios maiores;</li><li>buffs duram <b>+1 turno</b> por nível (Kaioken mais longo!);</li><li>Carregar Ki rende mais;</li><li>tira <b>1 escudo a mais</b> por nível.</li></ul>
      <p class="tut-dica">Guardar pontos para um golpe forte na hora certa costuma vencer lutas difíceis. Os inimigos também fazem isso!</p>` },

    { t: 'Os anéis: crítico e guarda', ic: '⭕', ilu: 'aneis', h: `
      <p>O botão de ação é <b>Espaço</b> (ou Z, J, clique/toque na tela).</p>
      <ul><li><b style="color:#ffd84a">Anel dourado</b> — no <b>seu</b> golpe: aperte quando ele fechar para um <b>CRÍTICO</b> (até +80% de dano).</li>
      <li><b style="color:#78dcff">Anel azul</b> — no golpe do <b>inimigo</b>: aperte quando fechar para <b>defender</b> (leva bem menos dano).</li></ul>
      <p><b>Guarda perfeita</b> (bem no último instante): <b>dano zero</b> — e se o golpe era de corpo a corpo, seu herói dá um <b>CONTRA-ATAQUE</b>!</p>
      <p class="tut-dica">Apertar cedo demais trava o botão por um instante ("Cedo demais!").</p>` },

    { t: 'Desafios dos golpes especiais', ic: '🎮', ilu: 'desafios', h: `
      <p>Alguns golpes têm um mini-desafio antes de sair. Quanto melhor, mais forte (de ×0,85 a <b>×1,45</b>):</p>
      <ul><li><b>Aperte rápido!</b> — Kamehameha, Galick Ho: aperte várias vezes para encher a barra.</li>
      <li><b>Três anéis</b> — Sequência de Golpes: aperte quando cada anel fechar, um por soco.</li>
      <li><b>Segure e solte</b> — Makankosappo, Kienzan: segure o botão, a barra sobe e desce; solte na <b style="color:#7dff9a">faixa verde</b>.</li></ul>` },

    { t: 'Escudos e Quebra de Guarda', ic: '🛡️', ilu: 'escudos', h: `
      <p>Sobre cada inimigo há um <b>escudo azul com um número</b> e as <b>fraquezas</b> dele: <b>👊</b> corpo a corpo ou <b>🔥</b> energia. Fraqueza desconhecida aparece como <b>?</b> até você acertar.</p>
      <p>Cada golpe da fraqueza tira <b>1 escudo</b> (+15% de dano). Zerou: <b style="color:#ff7a3a">QUEBRA DE GUARDA!</b> O inimigo <b>perde a próxima vez</b> e leva <b>+60% de dano</b> até ela passar. Depois os escudos voltam.</p>
      <p><b>Todos os inimigos quebrados?</b> Aparece o botão <b style="color:#ffb800">⚡ ATAQUE Z</b> (tecla Z): o time inteiro ataca junto, com uma explosão final em todos.</p>` },

    { t: 'Leia o inimigo: a intenção', ic: '👁️', ilu: 'intencao', h: `
      <p>No planejamento, cada inimigo mostra o que <b>vai fazer</b> e <b>em quem</b>: 👊 corpo a corpo · 🔥 energia · ✨ suporte · ⚡ carregar ki · 💥 supremo. Use isso: prepare a guarda de quem vai apanhar, carregue ki quando ele só vai se preparar…</p>
      <p class="tut-dica">A intenção some quando o inimigo age. Se o alvo dele cair antes, ele escolhe outro.</p>` },

    { t: 'Fúria, Sparking e Supremo', ic: '💥', ilu: 'sparking', h: `
      <p>A barra de <b>Fúria</b> enche ao causar e receber dano (e nas guardas perfeitas). Cheia: <b>SPARKING!</b> — o painel brilha em dourado e o <b>Supremo</b> (💥) aparece liberado em Ataques: Genki Dama, Double Sunday, Granada de Luz…</p>
      <p>No Supremo a tela escurece, a câmera aproxima e o nome do golpe aparece enorme. Ele gasta toda a Fúria.</p>
      <p><b>🤝 Sparking Combo</b>: ataque em dupla (ex.: Kamehameha + Makankosappo). Só aparece se o parceiro estiver no seu time, e precisa dele de pé e com ki.</p>` },

    { t: 'Formas e reforços', ic: '⚡', ilu: 'formas', h: `
      <ul><li><b>Kaioken</b> (Buffs) — mais força por alguns turnos, mas gasta um pouco de vida a cada turno.</li>
      <li><b>Super Saiyajin</b> (Formas) — transforma no meio da luta: golpes novos e atributos maiores. "Destransformar" volta.</li>
      <li><b>Semente dos Deuses</b> e curas — recuperam vida.</li>
      <li><b>Golpes novos</b> — os golpes criados no <b>Estúdio</b> entram no menu do personagem como qualquer outro golpe.</li></ul>
      <p class="tut-dica">Os chefes falam quando a vida deles passa da metade — e costumam ficar mais perigosos!</p>` },

    { t: 'Ficando mais forte', ic: '📜', ilu: 'progresso', h: `
      <ul><li><b>AP</b> — ganho a cada vitória. Na <b>Personalização</b> (tela Novo Jogo) compra níveis de Vida, Ataque, Defesa e Ki por turno.</li>
      <li><b>📜 Pergaminhos</b> — também vêm das vitórias. No Treinamento sobem os golpes de nível <b>I → II → III</b> (+15% de dano e efeito maior por nível).</li>
      <li><b>🎒 Cápsulas</b> — 2 por herói, escolhidas na Personalização: 🌱 Semente dos Deuses, 📡 Radar do Dragão, 🏋 Peso de Treino, 🛡 Armadura, 🔋 Ki extra, 🎗 Faixa do Senhor Kaio.</li>
      <li><b>Nota S a D</b> no fim da luta — sem dano, guardas perfeitas, quebras, Supremo final, vitória rápida… Nota alta dá mais AP (S: ×1,5 e um pergaminho extra).</li></ul>` },

    { t: 'Pronto para lutar!', ic: '🔥', ilu: 'fim', h: `
      <p>Que tal praticar? A <b>luta de treino</b> coloca o Goku contra um Saibaman e mostra dicas na hora certa.</p>
      <p>Depois é com você: <b>Novo Jogo</b> para a história da Saga Saiyajin, ou <b>Batalha Livre</b> para montar os times que quiser.</p>
      <div class="tut-bts-fim"><button data-tut="treino">▶ Luta de treino</button><button data-tut="fechar">Voltar ao menu</button></div>` },
  ],

  abrir() {
    let el = document.getElementById('tutorial');
    if (!el) {
      el = document.createElement('div'); el.id = 'tutorial';
      el.innerHTML = '<div class="tut-caixa"><div class="tut-topo"><span class="tut-ic"></span><h2></h2><button class="tut-x" title="Fechar (Esc)">✕</button></div>' +
        '<div class="tut-corpo"><div class="tut-ilu"></div><div class="tut-txt"></div></div>' +
        '<div class="tut-nav"><button data-tut="ant">◀ Anterior</button><div class="tut-pontos"></div><button data-tut="prox">Próximo ▶</button></div></div>';
      (document.getElementById('jogo') || document.body).appendChild(el);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const a = e.target.closest('[data-tut]'), x = e.target.closest('.tut-x');
        if (x) return this.fechar();
        if (!a) return;
        const t = a.dataset.tut;
        if (t === 'ant') this.ir(this.pagina - 1);
        else if (t === 'prox') this.ir(this.pagina + 1);
        else if (t === 'fechar') this.fechar();
        else if (t === 'treino') { location.href = location.pathname + '?batalha=tutorial'; }
        else if (t.startsWith('p')) this.ir(+t.slice(1));
      });
    }
    this._tecla = (e) => {
      if (!el.classList.contains('open')) return;
      if (e.code === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); this.ir(this.pagina + 1); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); this.ir(this.pagina - 1); }
      else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); this.fechar(); }
      else if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'Enter' || e.code === 'Space') { e.stopPropagation(); }
    };
    window.addEventListener('keydown', this._tecla, true);
    el.classList.add('open');
    this.ir(0);
    FF.Audio.play('menuopen', 0.6);
  },
  fechar() {
    const el = document.getElementById('tutorial');
    if (el) el.classList.remove('open');
    window.removeEventListener('keydown', this._tecla, true);
    cancelAnimationFrame(this._raf);
    if (FF._mostrarTitulo) FF._mostrarTitulo('menu');
  },
  ir(n) {
    const P = this.PAGINAS;
    n = Math.max(0, Math.min(P.length - 1, n));
    if (n !== this.pagina) FF.Audio.play('tap_sound', 0.5);
    this.pagina = n;
    const el = document.getElementById('tutorial'), p = P[n];
    el.querySelector('h2').textContent = p.t;
    el.querySelector('.tut-ic').textContent = p.ic;
    el.querySelector('.tut-txt').innerHTML = p.h;
    el.querySelector('[data-tut="ant"]').disabled = n === 0;
    el.querySelector('[data-tut="prox"]').disabled = n === P.length - 1;
    el.querySelector('.tut-pontos').innerHTML = P.map((_, i) => '<i data-tut="p' + i + '" class="' + (i === n ? 'sel' : '') + '"></i>').join('');
    const ilu = el.querySelector('.tut-ilu');
    ilu.innerHTML = '';
    cancelAnimationFrame(this._raf);
    this.ilustrar(p.ilu, ilu);
  },

  // ---------- desenhos ----------
  async prep() {
    if (this._prep) return this._prep;
    this._prep = (async () => {
      const ids = ['goku', 'piccolo', 'krillin', 'saibaman', 'raditz'];
      const defs = {};
      for (const id of ids) defs[id] = await FF.Assets.loadCharacter(id).catch(() => null);
      await Promise.all(['retratos', 'fx', 'fx_extra'].concat(ids.map(i => defs[i] && defs[i].formas[defs[i].formaInicial || 'base'].sprite).filter(Boolean)).map(s => FF.Assets.loadSprite(s).catch(() => null)));
      await FF.Assets.loadImage('assets/img/hud_moderno.png').catch(() => null);
      // animações derivadas (ex.: Saibaman parado), como no começo da luta
      Object.values(defs).forEach(d => d && Object.values(d.formas).forEach(f => {
        const set = FF.Assets.sprites[f.sprite]; if (!set) return;
        for (const [nome, dv] of Object.entries(f.animsDerivadas || {})) {
          if (set.has(nome) || !set.has(dv.de)) continue;
          const src = set.anim(dv.de);
          set.def.anims[nome] = { fps: dv.fps || 0, loop: !!dv.loop, repeatTo: 0, pingpong: false, frames: dv.quadros.map(i => src.frames[Math.min(i, src.frames.length - 1)]) };
        }
      }));
      return defs;
    })();
    return this._prep;
  },
  canvas(box, w, h) {
    const c = document.createElement('canvas');
    const R = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * R; c.height = h * R; c.style.aspectRatio = w + ' / ' + h;
    box.appendChild(c);
    const g = c.getContext('2d'); g.setTransform(R, 0, 0, R, 0, 0); g.imageSmoothingEnabled = false;
    return g;
  },
  // desenha um lutador (primeiro quadro da animação parada)
  lutador(g, def, x, y, esc, flip) {
    if (!def) return;
    const f = def.formas[def.formaInicial || 'base'], set = FF.Assets.sprites[f.sprite];
    if (!set) return;
    const nome = (f.anims && f.anims.parado) || 'Parado';
    const a = set.has(nome) ? set.anim(nome) : set.anim(Object.keys(set.def.anims)[0]);
    const fr = a.frames[Math.floor(performance.now() / 1000 * (a.fps || 6)) % a.frames.length];
    FF.drawFrame(g, set, fr, x, y, esc * (set.def.escala || 1), flip);
  },
  fundo(g, w, h) {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8fc8ff'); gr.addColorStop(0.55, '#cfe9ff'); gr.addColorStop(0.56, '#6fbf3a'); gr.addColorStop(1, '#3f8a24');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  },
  loop(fn) { const f = () => { FF.Clock.t = performance.now() / 1000; fn(); this._raf = requestAnimationFrame(f); }; f(); },

  async ilustrar(tipo, box) {
    const defs = await this.prep();
    if (this.PAGINAS[this.pagina].ilu !== tipo) return;   // trocou de página enquanto carregava
    const W = 520, H = 230;
    if (tipo === 'menu') return this.iluMenu(box);
    if (tipo === 'impulso') return this.iluImpulso(box);
    const g = this.canvas(box, W, H);
    const textoN = (n, x, y) => { g.fillStyle = '#ffd84a'; g.strokeStyle = '#2a0e00'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.fill(); g.stroke(); FF.HUD.text(g, String(n), x, y + 1, 12, '#2a0e00', 'center'); };
    if (tipo === 'hud') {
      const f = { def: defs.goku, formId: 'base', form: defs.goku.formas.base, nome: 'Goku', hp: 900, hpMax: 1200, ki: 60, kiMax: 100, rage: 100, rageCheia: true, buffs: {}, impulso: 3, ko: false };
      this.loop(() => {
        g.clearRect(0, 0, W, H); g.fillStyle = '#10142a'; g.fillRect(0, 0, W, H);
        if (FF.HUD.img()) {
          FF.HUD.panelModerno(g, f, false, 480, 40);
          const k = 480 / 2125, X = (x) => 6 + x * k, Y = (y) => 40 + y * k;
          [[300, 470], [1250, 120], [800, 300], [700, 410], [1280, 290], [1150, 560]].forEach(([x, y], i) => textoN(i + 1, X(x), Y(y)));
        } else FF.HUD.text(g, '(o painel aparece aqui)', W / 2, H / 2, 16, '#fff', 'center');
      });
      return;
    }
    if (tipo === 'time' || tipo === 'fim') {
      this.loop(() => {
        this.fundo(g, W, H);
        this.lutador(g, defs.piccolo, 90, 175, 2, false); this.lutador(g, defs.goku, 150, 200, 2.3, false); this.lutador(g, defs.krillin, 60, 215, 2.1, false);
        this.lutador(g, defs.raditz, 400, 195, 2.3, true); this.lutador(g, defs.saibaman, 470, 175, 2, true);
        FF.HUD.text(g, 'VS', W / 2, 120, 34, '#ffd84a', 'center');
      });
      return;
    }
    if (tipo === 'linha') {
      const ordem = [['krillin', true, '✓'], ['saibaman', false, '✓'], ['goku', true, 'atual'], ['raditz', false, ''], ['piccolo', true, '💫']];
      this.loop(() => {
        g.fillStyle = '#10142a'; g.fillRect(0, 0, W, H);
        FF.HUD.text(g, 'Planejando 1/3: Goku', W / 2, 30, 18, '#ffe9a8', 'center');
        const w = 54, h = 72, gap = 12, x0 = W / 2 - (ordem.length * (w + gap) - gap) / 2;
        FF.HUD.text(g, 'R2', x0 - 26, 100, 16, '#ffe9a8', 'center');
        ordem.forEach(([id, heroi, st], i) => {
          const x = x0 + i * (w + gap), y = st === 'atual' ? 58 : 64;
          g.save(); if (st === '✓') g.globalAlpha = 0.4;
          g.fillStyle = st === 'atual' ? '#ffd84a' : heroi ? '#3a6ad0' : '#c03030'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
          FF.Retrato.desenhar(g, defs[id], defs[id].formaInicial || 'base', 'retrato', x, y, w, h, { espelhar: !heroi });
          g.restore();
          if (st === '✓') FF.HUD.text(g, '✓', x + w / 2, y + h / 2, 28, '#9dff9d', 'center');
          if (st === '💫') FF.HUD.text(g, '💫', x + w / 2, y - 10, 18, '#fff', 'center');
        });
        FF.HUD.text(g, '▲', x0 + 2 * (w + gap) + w / 2, 160, 16, '#7dff9a', 'center');
        FF.HUD.text(g, '▼', x0 + 3 * (w + gap) + w / 2, 160, 16, '#ff8a7a', 'center');
        FF.HUD.text(g, 'apagado ✓ = já agiu · dourado = agora · ▲▼ = muda na próxima rodada', W / 2, 205, 13, '#d8d0ff', 'center');
      });
      return;
    }
    if (tipo === 'aneis') {
      this.loop(() => {
        this.fundo(g, W, H);
        this.lutador(g, defs.goku, 130, 200, 2.5, false); this.lutador(g, defs.raditz, 390, 200, 2.5, true);
        const t = (performance.now() / 1000) % 1.4, k = Math.max(0, 1 - t / 1.1);
        const anel = (x, y, cor, txt) => {
          g.lineWidth = 4; g.strokeStyle = cor; g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.stroke();
          g.lineWidth = k < 0.25 ? 6 : 3; g.strokeStyle = k < 0.25 ? '#fff' : cor; g.beginPath(); g.arc(x, y, 22 + 70 * k, 0, Math.PI * 2); g.stroke();
          FF.HUD.text(g, txt, x, y - 40 - 20 * k, 14, '#fff', 'center');
        };
        anel(390, 135, 'rgba(255,210,70,0.9)', 'CRÍTICO');
        anel(130, 135, 'rgba(120,220,255,0.9)', 'GUARDA');
        if (k < 0.25) FF.HUD.text(g, 'AGORA!', W / 2, 40, 24, '#fff27a', 'center');
      });
      return;
    }
    if (tipo === 'desafios') {
      this.loop(() => {
        g.fillStyle = '#10142a'; g.fillRect(0, 0, W, H);
        const t = performance.now() / 1000;
        const barra = (y, v, verde, txt) => { const x = 60, w = 400; g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, y, w, 18); if (verde) { g.fillStyle = 'rgba(80,255,120,0.45)'; g.fillRect(x + w * 0.74, y, w * 0.18, 18); } const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#ffd84a'); gr.addColorStop(1, '#ff6a00'); g.fillStyle = gr; g.fillRect(x, y, w * v, 18); g.strokeStyle = '#fff3a0'; g.lineWidth = 2; g.strokeRect(x, y, w, 18); FF.HUD.text(g, txt, W / 2, y - 12, 14, '#fff27a', 'center'); };
        barra(40, (t * 0.7) % 1, false, 'APERTE RÁPIDO!');
        barra(190, 1 - Math.abs(((t * 0.9) % 2) - 1), true, 'SEGURE… E SOLTE NO VERDE!');
        const ta = t % 2.2;
        for (let i = 0; i < 3; i++) { const alvo = 0.55 + i * 0.55, k = (alvo - ta) / 0.55, cx = W / 2 - 60 + i * 60, cy = 115; g.lineWidth = 3; g.strokeStyle = ta > alvo ? '#7dff9a' : '#ffd84a'; g.beginPath(); g.arc(cx, cy, 16, 0, Math.PI * 2); g.stroke(); if (k > 0 && k < 1) { g.strokeStyle = '#ffb24a'; g.beginPath(); g.arc(cx, cy, 16 + k * 30, 0, Math.PI * 2); g.stroke(); } if (ta > alvo) FF.HUD.text(g, '✓', cx, cy, 16, '#7dff9a', 'center'); }
        FF.HUD.text(g, 'TRÊS ANÉIS', W / 2, 78, 14, '#fff27a', 'center');
      });
      return;
    }
    if (tipo === 'escudos' || tipo === 'intencao') {
      this.loop(() => {
        this.fundo(g, W, H);
        const t = performance.now() / 1000;
        this.lutador(g, defs.goku, 110, 205, 2.4, false);
        const sx = [300, 400, 470], sy = [190, 175, 205], quebrado = [false, true, false];
        sx.forEach((x, i) => {
          this.lutador(g, defs.saibaman, x, sy[i], 2.1, true);
          const y = sy[i] - 110, s = 12, q = quebrado[i] && tipo === 'escudos';
          g.beginPath(); g.moveTo(x - 30, y - s); g.lineTo(x - 30 + s * 1.6, y - s); g.lineTo(x - 30 + s * 1.6, y + 1); g.quadraticCurveTo(x - 30 + s * 1.6, y + s * 0.8, x - 30 + s * 0.8, y + s * 1.15); g.quadraticCurveTo(x - 30, y + s * 0.8, x - 30, y + 1); g.closePath();
          g.fillStyle = q ? (Math.sin(t * 14) > 0 ? '#c0281a' : '#7a1208') : '#1f5fd0'; g.fill(); g.lineWidth = 2; g.strokeStyle = q ? '#ffb08a' : '#cfe8ff'; g.stroke();
          FF.HUD.text(g, q ? '✕' : String(2 - (i === 2 ? 1 : 0)), x - 30 + s * 0.8, y + 2, 14, '#fff', 'center');
          ['corpo', 'energia'].forEach((tp, j) => { const cx = x - 2 + j * 22; g.beginPath(); g.arc(cx, y + 1, 9.5, 0, Math.PI * 2); g.fillStyle = 'rgba(10,12,24,0.8)'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = tp === 'corpo' ? '#ffb24a' : '#6fe0ff'; g.stroke(); g.font = '11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(i === 0 && j === 1 ? '?' : tp === 'corpo' ? '👊' : '🔥', cx, y + 2); });
          if (tipo === 'intencao') { const txt = ['👊 → Goku', '🔥 → Goku', '⚡'][i]; g.font = 'bold 12px sans-serif'; const tw = g.measureText(txt).width + 12; g.fillStyle = 'rgba(10,8,24,0.85)'; g.strokeStyle = '#ffcf3a'; g.beginPath(); if (g.roundRect) g.roundRect(x - tw / 2, y - 38, tw, 18, 9); else g.rect(x - tw / 2, y - 38, tw, 18); g.fill(); g.stroke(); FF.HUD.text(g, txt, x, y - 28, 12, '#fff', 'center'); }
        });
        if (tipo === 'escudos') FF.HUD.text(g, 'QUEBRA!', 400, 40, 22, '#ff6a3a', 'center');
      });
      return;
    }
    if (tipo === 'sparking') {
      const f = { def: defs.goku, formId: 'base', form: defs.goku.formas.base, nome: 'Goku', hp: 1200, hpMax: 1200, ki: 80, kiMax: 100, rage: 100, rageCheia: true, buffs: {}, impulso: 5, ko: false };
      this.loop(() => {
        g.fillStyle = '#10142a'; g.fillRect(0, 0, W, H);
        if (FF.HUD.img()) FF.HUD.panelModerno(g, f, false, 420, 20);
        const y = 190; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, y - 24, W, 48); g.fillStyle = '#ffb800'; g.fillRect(0, y - 25, W, 2); g.fillRect(0, y + 23, W, 2);
        FF.HUD.text(g, 'GENKI DAMA', W / 2, y, 30, '#ffd84a', 'center');
      });
      return;
    }
    if (tipo === 'formas') {
      this.loop(() => {
        this.fundo(g, W, H);
        const ssj = defs.goku.formas.ssj, set = ssj && FF.Assets.sprites[ssj.sprite];
        this.lutador(g, defs.goku, 150, 200, 2.6, false);
        if (set) { const a = set.anim((ssj.anims && ssj.anims.parado) || 'Parado'); if (a) FF.drawFrame(g, set, a.frames[Math.floor(performance.now() / 160) % a.frames.length], 370, 200, 2.6 * (set.def.escala || 1), true); }
        FF.HUD.text(g, '→', W / 2, 140, 40, '#ffd84a', 'center');
        FF.HUD.text(g, 'Goku', 150, 220, 14, '#fff', 'center'); FF.HUD.text(g, 'Super Saiyajin', 370, 220, 14, '#ffe14a', 'center');
      });
      return;
    }
    if (tipo === 'progresso') {
      this.loop(() => {
        g.fillStyle = '#10142a'; g.fillRect(0, 0, W, H);
        FF.HUD.text(g, 'S', 90, 115, 90, '#ffe14a', 'center');
        ['★ Sem levar dano', '★ 5 guardas perfeitas', '★ Venceu com supremo', 'AP ×1,5 · +1 📜'].forEach((t, i) => FF.HUD.text(g, t, 170, 60 + i * 30, 16, i === 3 ? '#7fe0ff' : '#fff3c0', 'left'));
        FF.HUD.text(g, 'Kamehameha I → II → III', W / 2, 200, 16, '#ffd84a', 'center');
      });
      return;
    }
  },
  // menu de esferas (HTML com as mesmas cores do jogo), abrindo e fechando sozinho
  iluMenu(box) {
    const d = document.createElement('div'); d.className = 'tut-menu';
    d.innerHTML = '<div class="tut-pills"><i class="sel">👊 SEQUÊNCIA DE GOLPES ✓</i><i>🔥 KAMEHAMEHA · 30 KI</i><i class="bloq">💥 GENKI DAMA</i></div>' +
      '<div class="tut-esferas"><span class="e1 sel">👊<b>ATAQUES</b></span><span class="e2">⚡<b>FORMAS</b></span><span class="e3">🔥<b>BUFFS</b></span><span class="e4">✦<b>KI</b></span></div>';
    box.appendChild(d);
    let n = 0; this._raf = 0;
    const tick = () => { n++; d.classList.toggle('aberto', (n % 6) < 4); };
    this._iv && clearInterval(this._iv); this._iv = setInterval(() => { if (!document.body.contains(d)) return clearInterval(this._iv); tick(); }, 600);
    tick();
  },
  iluImpulso(box) {
    const d = document.createElement('div'); d.className = 'tut-menu';
    d.innerHTML = '<div class="tut-imp"><span>IMPULSO ×3</span><b>−</b><i class="u"></i><i class="u"></i><i class="t"></i><i></i><i></i><b>+</b></div><div class="tut-pills"><i class="sel">🔥 KAMEHAMEHA ×3 · 30 KI ✓</i></div>' +
      '<p class="tut-legenda">Bolinhas: douradas = pontos que você tem · brilhando = os que vai usar.<br>Teclas <b>Q</b> e <b>E</b> (ou os botões − e +).</p>';
    box.appendChild(d);
  },

  // ---------- luta de treino: dicas na hora certa ----------
  dica(b) {
    if (!b || !b.def || !b.def.tutorial || b.over) return null;
    const h = b.heroes[0], e = b.enemies[0];
    if (b.desafioAtual) return { apertar: 'Desafio: aperte o botão várias vezes para encher a barra!', aneis: 'Desafio: aperte quando cada anel fechar!', segurar: 'Desafio: segure o botão e solte na faixa verde!' }[b.desafioAtual.tipo];
    const q = b.qtes.find(x => x.result === undefined);
    if (q) return q.mode === 'guarda' ? 'O inimigo vai atacar! Aperte ESPAÇO (ou clique) quando o anel AZUL fechar.' : 'Aperte ESPAÇO (ou clique) quando o anel DOURADO fechar: CRÍTICO!';
    if (e && e.quebrado) return 'QUEBRA DE GUARDA! O Saibaman perde a vez e leva +60% de dano. Aproveite!';
    const menu = document.querySelector('#menu.open');
    if (menu) {
      if (h && h.rageCheia) return 'SPARKING! A Fúria encheu: o Supremo (💥 Genki Dama) está em ATAQUES.';
      if (h && h.impulso >= 2 && !b._dicaImp) return 'Você tem ' + h.impulso + ' Pontos de Impulso: aperte E (ou +) antes de escolher para um golpe ×2, ×3…';
      if ((b.rodada || 1) >= 2 && e && e.escudos > 0) return 'O escudo azul sobre o inimigo conta quantos golpes da fraqueza faltam para a QUEBRA (👊 = corpo a corpo).';
      return 'Passe o mouse na esfera ATAQUES e clique num golpe (ou use as setas e Enter). O ícone sobre o inimigo mostra o que ele vai fazer.';
    }
    return null;
  },
  desenharDica(ctx, b) {
    const t = this.dica(b);
    if (!t) return;
    ctx.save();
    ctx.font = 'bold 15px sans-serif';
    const w = Math.min(FF.W - 60, ctx.measureText(t).width + 40), x = FF.W / 2 - w / 2, y = 84;
    ctx.fillStyle = 'rgba(14,10,40,0.9)'; ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, 30, 15); else ctx.rect(x, y, w, 30); ctx.fill(); ctx.stroke();
    FF.HUD.text(ctx, '💡 ' + t, FF.W / 2, y + 16, 15, '#fff3c0', 'center');
    ctx.restore();
  },
};
