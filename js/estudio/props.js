// Estúdio — painel de propriedades da aba Golpes: golpe (sem clipe escolhido), trilha e clipe.
// host: { doc, clipe(), trilha(), mudou(rotulo, juntar), animsDe(quem) → [nomes], spriteDe(quem), personagens(),
//         gravarChave(), autoDuracao(), remover(), duplicar() }
window.FF = window.FF || {};

FF.EstudioProps = {
  FORCAS: [['leve', 'leve'], ['media', 'média'], ['forte', 'forte'], ['energia', 'energia']],
  EM: [['atacante', 'pés de quem solta'], ['peito', 'peito de quem solta'], ['disparo', 'ponto de disparo'], ['alvo', 'peito do alvo'], ['alvoPes', 'pés do alvo'], ['tela', 'tela (fixo)']],
  BASICAS: ['parado', 'dano1', 'dano2', 'guarda', 'lancado', 'caido', 'avancar', 'recuar', 'teleporte'],

  // campos fáceis para as ações mais usadas (o JSON continua logo abaixo para o resto)
  acaoAmigavel(g, c, host) {
    const E = FF.Estudio, p = c.passo || (c.passo = {});
    const def = host.defs && host.cfg && host.defs[host.cfg.atacante];
    const n = (obj, k, rot, o = {}) => E.campo('numero', rot, obj[k], (v, j) => { if (v === undefined || isNaN(v)) delete obj[k]; else obj[k] = v; host.mudou(rot, j); }, Object.assign({ passo: 'any' }, o));
    if ('ki' in p) g.appendChild(n(p, 'ki', 'Ki (+/−)', { passo: 1, dica: 'Quanto de ki ganha (negativo = perde)' }));
    if ('aplicar' in p && def) g.appendChild(E.campo('select', 'Buff', p.aplicar, (v) => { p.aplicar = v; host.mudou('Buff'); }, { lista: Object.keys(def.buffs || {}).map(k => [k, (def.buffs[k].nome || k)]).concat(p.aplicar && !(def.buffs || {})[p.aplicar] ? [[p.aplicar, p.aplicar + ' (não existe)']] : []) }));
    if ('removerBuff' in p && def) g.appendChild(E.campo('select', 'Tirar buff', p.removerBuff, (v) => { p.removerBuff = v; host.mudou('Tirar buff'); }, { lista: Object.keys(def.buffs || {}) }));
    if ('transformar' in p && def) g.appendChild(E.campo('select', 'Forma', p.transformar, (v) => { p.transformar = v; host.mudou('Transformar'); }, { lista: Object.entries(def.formas).map(([k, f]) => [k, f.nome || k]) }));
    if ('atordoar' in p) g.appendChild(n(p, 'atordoar', 'Turnos atordoado', { passo: 1, min: 1 }));
    if (p.curar && typeof p.curar === 'object') {
      g.appendChild(n(p.curar, 'fracao', 'Cura (fração da vida)', { passo: 0.05, min: 0 }));
      g.appendChild(E.campo('check', 'Cura o time todo', !!p.curar.todos, (v) => { if (v) p.curar.todos = true; else delete p.curar.todos; host.mudou('Curar'); }));
    }
    if (p.objeto && typeof p.objeto === 'object') {
      const o = p.objeto;
      const fxs = [];
      Object.values(FF.Assets.sprites).forEach(s => { if (s && s.def && /^(fx|fx_extra)$/.test(s.def.id || '')) fxs.push(...Object.keys(s.def.anims)); });
      const sa = host.spriteDe && host.spriteDe('atacante');
      if (sa) Object.keys(sa.def.anims).filter(a => /esfera|bola|ball|efeito|fx|_/i.test(a)).forEach(a => fxs.push(a));
      g.appendChild(E.el('div', 'es-sub', '🟠 Objeto preso ao golpe (cresce e depois é lançado)'));
      g.appendChild(E.campo('texto', 'Nome (id)', o.id, (v) => { o.id = v || 'objeto'; host.mudou('Objeto'); }, { dica: 'O mesmo nome vai no "Lançar objeto"' }));
      g.appendChild(E.campo('texto', 'Desenho', o.fx, (v) => { o.fx = v; host.mudou('Objeto: desenho'); }, { sugestoes: [...new Set(fxs)], dica: 'Animação de efeito (fx, fx_extra ou do sprite do lutador)' }));
      o.escala = Array.isArray(o.escala) ? o.escala : [o.escala || 1, o.escala || 1];
      g.appendChild(E.campo('numero', 'Tamanho inicial', o.escala[0], (v, j) => { if (v >= 0) { o.escala[0] = v; host.mudou('Objeto: tamanho', j); } }, { passo: 0.05, min: 0 }));
      g.appendChild(E.campo('numero', 'Tamanho final', o.escala[1], (v, j) => { if (v >= 0) { o.escala[1] = v; host.mudou('Objeto: tamanho', j); } }, { passo: 0.05, min: 0 }));
      g.appendChild(n(o, 'tempo', 'Tempo crescendo (s)', { passo: 0.1, min: 0 }));
      g.appendChild(n(o, 'dx', 'Posição X', { passo: 1, dica: 'Para a frente de quem solta (px)' }));
      g.appendChild(n(o, 'dy', 'Posição Y', { passo: 1, dica: 'Negativo = para cima (px)' }));
    }
    if (p.lancarObjeto && typeof p.lancarObjeto === 'object') {
      const o = p.lancarObjeto;
      g.appendChild(E.el('div', 'es-sub', '🚀 Lançar o objeto no alvo'));
      g.appendChild(E.campo('texto', 'Objeto (id)', o.id, (v) => { o.id = v; host.mudou('Lançar objeto'); }));
      g.appendChild(n(o, 'tempo', 'Tempo até chegar (s)', { passo: 0.1, min: 0.05 }));
      g.appendChild(n(o, 'tremer', 'Tremor no impacto', { passo: 1, min: 0 }));
      g.appendChild(n(o, 'flash', 'Flash no impacto', { passo: 0.1, min: 0 }));
      g.appendChild(E.campo('som', 'Som ao lançar', o.som, (v) => { if (v) o.som = v; else delete o.som; host.mudou('Lançar: som'); }));
      const ac = o.acertos || [];
      g.appendChild(E.el('p', 'es-dica', ac.length + ' acerto(s) no impacto · dano total ' + ac.reduce((s, a) => s + (a.fracao || 0), 0).toFixed(2).replace('.', ',') + ' do poder (edite no JSON abaixo).'));
      // explosões do impacto: clipes na trilha Efeitos presos a este lançamento
      const presos = [];
      (host.doc && host.doc.linha.trilhas || []).forEach(tr => tr.clipes.forEach(x => { if (x.prende === c.id) presos.push(x); }));
      g.appendChild(E.el('div', 'es-sub', '💥 Explosões no impacto (trilha Efeitos)'));
      presos.forEach(x => {
        const r = E.el('div', 'es-preso-item');
        const cv = document.createElement('canvas'); cv.width = 28; cv.height = 28; cv.className = 'es-mini-anim';
        E.miniAnim(cv, () => ({ set: E.setDoEfeito(x.fx, x.sprite), anim: x.fx }));
        const n = E.el('span'); n.textContent = x.fx + (x.escala ? ' ×' + x.escala : '') + (x.extra ? ' (' + (x.extra > 0 ? '+' : '') + x.extra + ' s)' : '');
        r.append(cv, n, E.botao('Editar', () => host.selecionar(x.id), 'Abre este efeito (posição, tamanho, tempo…)'));
        g.appendChild(r);
      });
      if (!presos.length && !(o.impacto && o.impacto.length)) g.appendChild(E.el('p', 'es-dica', 'Nenhuma explosão no impacto.'));
      if (host.explosaoNoImpacto) g.appendChild(E.botao('＋ Explosão no impacto', () => host.explosaoNoImpacto(c), 'Cria um efeito na trilha Efeitos no momento em que o objeto chega (preso a este lançamento)', 'es-bt-ouro'));
    }
  },

  render(box, host) {
    const E = FF.Estudio;
    box.innerHTML = '';
    const c = host.clipe(), tr = host.trilha();
    const set = (obj, k, rot) => (v, juntar) => {
      if (v === undefined || v === '' || (typeof v === 'number' && isNaN(v))) delete obj[k]; else obj[k] = v;
      host.mudou(rot || ('Mudar ' + k), juntar);
    };
    const num = (obj, k, rot, dica, o = {}) => E.campo('numero', rot, obj[k], set(obj, k, rot), Object.assign({ dica, passo: o.passo || 'any' }, o));
    const chk = (obj, k, rot, dica) => E.campo('check', rot, obj[k], (v) => { if (v) obj[k] = true; else delete obj[k]; host.mudou(rot); }, { dica });
    const txt = (obj, k, rot, dica, o = {}) => E.campo('texto', rot, obj[k], set(obj, k, rot), Object.assign({ dica }, o));
    const sel = (obj, k, rot, lista, dica, padrao) => E.campo('select', rot, obj[k] != null ? obj[k] : padrao, (v) => { if (v === '' || v === padrao && padrao === '') delete obj[k]; else obj[k] = v; host.mudou(rot); }, { lista, dica });

    if (!c) {
      if (tr) box.appendChild(this.trilha(tr, host, txt));
      box.appendChild(this.golpe(host, num, chk, txt, sel));
      return;
    }
    const g = E.grupo(this.titulo(c));
    g.appendChild(num(c, 't', 'Início (s)', 'Quando o clipe começa na linha do tempo', { passo: 0.01, min: 0 }));
    box.appendChild(g);
    const quem = tr && tr.quem;
    switch (c.tipo) {
      case 'anim': {
        const lista = this.BASICAS.concat(host.animsDe(quem));
        g.appendChild(this.comEscolha(E.campo('anim', 'Animação', c.anim, set(c, 'anim', 'Animação'), { sugestoes: lista }), () => {
          const prop = host.spriteDe(quem), pid = prop && (prop.def.id || Object.keys(FF.Assets.sprites).find(k => FF.Assets.sprites[k] === prop));
          FF.Estudio.escolherSprite({ titulo: '🎬 Animação (de qualquer sprite)', atual: { anim: c.anim, sprite: c.sprite || pid }, inicio: c.sprite || pid,
            aoEscolher: (a, id) => { c.anim = a; if (id && id !== pid) c.sprite = id; else delete c.sprite; host.mudou('Animação'); } });
        }, this.fonteAnim(host, quem, c)));
        if (c.sprite) {
          const d = E.el('p', 'es-dica'); d.textContent = '🖼 Animação emprestada do sprite "' + c.sprite + '". ';
          d.appendChild(E.botao('Voltar às do lutador', () => { delete c.sprite; host.mudou('Animação'); }));
          g.appendChild(d);
        }
        g.appendChild(num(c, 'de', 'Do quadro', 'Trecho: primeiro quadro (0 = início; vazio = todos)', { min: 0, passo: 1 }));
        g.appendChild(num(c, 'ate', 'Até o quadro', 'Trecho: último quadro (inclusive; vazio = até o fim)', { min: 0, passo: 1 }));
        g.appendChild(num(c, 'fps', 'fps', 'Velocidade da animação (vazio = a da própria animação)', { min: 0 }));
        g.appendChild(num(c, 'd', 'Duração fixa (s)', 'Vazio = o tamanho natural da animação. Com duração, a animação repete até o fim.', { min: 0, passo: 0.01 }));
        g.appendChild(chk(c, 'loop', 'Repetir', 'Fica repetindo (até o próximo clipe ou o fim)'));
        g.appendChild(num(c, 'segurar', 'Segurar 1º quadro (s)', 'Fica parado no 1º quadro antes de animar (tempo para o anel de guarda/crítico)', { min: 0, passo: 0.01 }));
        const p = E.grupo('Posição e aparência', true);
        p.appendChild(E.el('p', 'es-dica', 'Arraste o lutador no palco para mudar a posição deste clipe.'));
        p.appendChild(num(c, 'dx', 'X (px)', 'Deslocamento para a frente (+) ou para trás (−)'));
        p.appendChild(num(c, 'dy', 'Y (px)', 'Para baixo (+) ou para cima (−)'));
        p.appendChild(num(c, 'escala', 'Tamanho (×)', '1 = normal', { passo: 0.05, min: 0.05 }));
        p.appendChild(num(c, 'rot', 'Giro (°)', 'Gira o lutador em volta do meio do corpo (no palco: alça azul)'));
        p.appendChild(num(c, 'alpha', 'Opacidade', '0 a 1 (vazio = não muda)', { passo: 0.05, min: 0, max: 1 }));
        p.appendChild(chk(c, 'flip', 'Espelhar'));
        box.appendChild(p);
        if (quem === 'alvo' || c.empurrao || c.voltarNormal) {
          const a = E.grupo('Reação do alvo', true);
          a.appendChild(num(c, 'empurrao', 'Empurrão', 'Desliza para trás com essa força (ex.: 400)', { min: 0 }));
          a.appendChild(chk(c, 'voltarNormal', 'Voltar ao normal no fim'));
          box.appendChild(a);
        }
        break;
      }
      case 'mover': case 'teleporte': {
        if (c.tipo === 'mover') g.appendChild(num(c, 'd', 'Duração (s)', 'Tempo do movimento', { min: 0.01, passo: 0.01 }));
        g.appendChild(sel(c, 'para', 'Para onde', [['alvo', 'até o alvo'], ['casa', 'para a posição inicial'], ['frente', 'para a frente'], ['tras', 'para trás'], ['x', 'qualquer lugar da tela (arraste no palco)']], null, 'alvo'));
        g.appendChild(num(c, 'dist', 'Distância', 'Alvo: quanto para antes dele. Frente/trás: quanto anda (em px do sprite × escala)'));
        if (c.para === 'x') {
          g.appendChild(E.el('p', 'es-dica', 'Arraste a bolinha verde (e a silhueta) no palco para escolher o ponto. Vale para cima também: o lutador fica no ar até o próximo movimento.'));
          g.appendChild(num(c, 'x', 'X na tela', '0 (esquerda) a 1084 (direita)'));
          g.appendChild(num(c, 'y', 'Altura (Y)', '0 = no chão; negativo = no ar (ex.: -120); positivo = desce um pouco (para encostar um desenho deitado ou girado no chão)'));
          g.appendChild(num(c, 'escala', 'Tamanho na chegada (×)', 'No palco: alça amarela da silhueta (1 = normal)', { passo: 0.05, min: 0.05 }));
          g.appendChild(num(c, 'rot', 'Giro na chegada (°)', 'No palco: alça azul da silhueta'));
        }
        // animação do movimento: campo + 🖼 escolher vendo as miniaturas (animações do próprio lutador)
        g.appendChild(this.comEscolha(
          E.campo('anim', 'Animação', c.animMov, set(c, 'animMov', 'Animação do movimento'), { sugestoes: this.BASICAS.concat(host.animsDe(quem)), dica: c.tipo === 'mover' ? 'Vazio = avançar/recuar' : 'Vazio = teleporte' }),
          () => this.escolherAnim(host.spriteDe(quem), (((host.formaDe && host.formaDe(quem)) || {}).anims || {})[c.animMov] || c.animMov, (a) => { c.animMov = a; host.mudou('Animação'); }),
          this.fonteAnim(host, quem, { anim: c.animMov || (c.tipo === 'mover' ? 'avancar' : 'teleporte') })));
        if (c.tipo === 'mover') {
          g.appendChild(E.campo('check', 'Suave', c.suave !== false, (v) => { if (v) delete c.suave; else c.suave = false; host.mudou('Suave'); }));
          g.appendChild(num(c, 'arco', 'Arco (px)', 'Curva do caminho: positivo = sobe no meio (arremesso), negativo = desce'));
          g.appendChild(num(c, 'girar', 'Girar (voltas)', 'Quantas voltas dá no caminho (ex.: 1.5); negativo = ao contrário', { passo: 0.25 }));
          g.appendChild(chk(c, 'manterGiro', 'Ficar girado no fim'));
        }
        break;
      }
      case 'visivel': g.appendChild(num(c, 'alpha', 'Opacidade', '0 = some, 1 = aparece', { passo: 0.1, min: 0, max: 1 })); break;
      case 'efeito': {
        if (c.prende) {
          const base = host.baseDoPreso ? host.baseDoPreso(c) : null;
          const av = E.el('div', 'es-preso');
          av.appendChild(E.el('span', null, '🔗 Preso ao impacto do objeto lançado' + (base != null ? ' (chega em ' + base.toFixed(2).replace('.', ',') + ' s' + (c.extra ? ', ajuste ' + (c.extra > 0 ? '+' : '') + c.extra.toFixed(2).replace('.', ',') + ' s' : '') + ')' : '') + '. Mudando o lançamento, ele acompanha; arrastar este clipe muda só o ajuste.'));
          av.appendChild(E.botao('Ir para o lançamento', () => host.selecionar(c.prende), 'Seleciona o clipe que lança o objeto'));
          av.appendChild(E.botao('Soltar', () => { delete c.prende; delete c.extra; host.mudou('Soltar do impacto'); host.renderProps(); }, 'Deixa este efeito com tempo fixo'));
          g.appendChild(av);
        }
        g.appendChild(this.campoEfeito(c, 'fx', 'Efeito', host));
        g.appendChild(sel(c, 'em', 'Preso em', this.EM, null, 'atacante'));
        g.appendChild(chk(c, 'seguir', 'Acompanha o lutador (anda junto quando ele se move)'));
        g.appendChild(E.el('p', 'es-dica', 'Arraste no palco para posicionar; alça amarela = tamanho, alça azul = giro.'));
        g.appendChild(num(c, 'dx', 'X (px)', 'Para a frente de quem solta (+)'));
        g.appendChild(num(c, 'dy', 'Y (px)'));
        g.appendChild(num(c, 'escala', 'Tamanho (×)', null, { passo: 0.05, min: 0.05 }));
        g.appendChild(num(c, 'rot', 'Giro (°)'));
        g.appendChild(num(c, 'alpha', 'Opacidade', null, { passo: 0.05, min: 0, max: 1 }));
        g.appendChild(chk(c, 'flip', 'Espelhar'));
        g.appendChild(num(c, 'fps', 'fps', 'Vazio = o do efeito'));
        g.appendChild(num(c, 'd', 'Repetir por (s)', 'Vazio = toca uma vez', { min: 0, passo: 0.05 }));
        break;
      }
      case 'projetil': {
        g.appendChild(this.campoEfeito(c, 'fx', 'Projétil', host));
        g.appendChild(num(c, 'velocidade', 'Velocidade', 'px/s (padrão 650)'));
        g.appendChild(num(c, 'escala', 'Tamanho (×)', null, { passo: 0.05 }));
        g.appendChild(num(c, 'rot', 'Giro do desenho (°)', 'Gira só a imagem (no palco: alça azul)'));
        g.appendChild(E.el('p', 'es-dica', 'No palco, com o projétil voando: alça branca = mover o desenho, amarela = tamanho, azul = giro (igual aos efeitos). Roda do mouse = tamanho.'));
        box.appendChild(this.rodaCores(c, host));
        g.appendChild(E.campo('check', 'Rastro', c.rastro !== false, (v) => { if (v) delete c.rastro; else c.rastro = false; host.mudou('Rastro'); }));
        g.appendChild(E.campo('check', 'Cresce ao sair', c.crescer !== false, (v) => { if (v) delete c.crescer; else c.crescer = false; host.mudou('Crescer'); }));
        g.appendChild(chk(c, 'atravessar', 'Atravessa o alvo'));
        g.appendChild(chk(c, 'deCima', 'Cai do alto'));
        g.appendChild(num(c, 'curva', 'Arco (px)', 'Altura do arco'));
        g.appendChild(num(c, 'ondular', 'Ondular (px)'));
        g.appendChild(num(c, 'girar', 'Girar (°/s)'));
        const pos = E.grupo('Saída e chegada', true);
        pos.appendChild(E.el('p', 'es-dica', 'No palco: arraste a alça verde (saída) e a vermelha (chegada); elas encaixam na mesma linha uma da outra e da mão/peito/pés dos lutadores (guia ciano). Shift = só para os lados ou só para cima/baixo; Alt = sem encaixe. Para mexer só no desenho, clique e arraste o próprio projétil enquanto ele voa (alça roxa).'));
        pos.appendChild(chk(c, 'centro', 'Centralizar o desenho no caminho'));
        pos.appendChild(num(c, 'spriteDx', 'Desenho X', 'Desloca só a imagem (o caminho e o acerto continuam iguais)'));
        pos.appendChild(num(c, 'spriteDy', 'Desenho Y'));
        pos.appendChild(num(c, 'deDx', 'Saída X', 'A partir do ponto de disparo'));
        pos.appendChild(num(c, 'deDy', 'Saída Y'));
        pos.appendChild(num(c, 'alvoDx', 'Chegada X', 'A partir do peito do alvo'));
        pos.appendChild(num(c, 'alvoDy', 'Chegada Y'));
        box.appendChild(pos);
        const ef = E.grupo('Efeitos e sons', false);
        ef.appendChild(E.campo('som', 'Som ao soltar', c.som, set(c, 'som', 'Som')));
        ef.appendChild(this.campoEfeito(c, 'disparo', 'Efeito na mão', host, true));
        ef.appendChild(num(c, 'disparoEscala', 'Tamanho na mão', null, { passo: 0.05 }));
        ef.appendChild(this.campoEfeito(c, 'impacto', 'Explosão', host, true));
        ef.appendChild(num(c, 'impactoEscala', 'Tamanho explosão', null, { passo: 0.05 }));
        ef.appendChild(num(c, 'impactoDx', 'Explosão X'));
        ef.appendChild(num(c, 'impactoDy', 'Explosão Y'));
        ef.appendChild(E.campo('som', 'Som do impacto', c.somImpacto, set(c, 'somImpacto', 'Som do impacto')));
        ef.appendChild(num(c, 'tremerImpacto', 'Tremor no impacto'));
        box.appendChild(ef);
        c.acerto = c.acerto || { fracao: 0.3, forca: 'energia' };
        const ac = E.grupo('Acerto ao chegar', true);
        this.camposAcerto(ac, c.acerto, num, chk, sel, host);
        box.appendChild(ac);
        break;
      }
      case 'camada': {
        g.appendChild(E.campo('select', 'Sprite', c.sprite, async (v) => { c.sprite = v; await FF.Assets.loadSprite(v).catch(() => null); const s = FF.Assets.sprites[v]; if (s && !s.has(c.anim)) c.anim = Object.keys(s.def.anims)[0]; host.mudou('Sprite da camada'); }, { lista: FF.Assets.listaSprites().map(s => [s, FF.Assets.doAcervo(s) ? FF.Assets.nomeSprite(s) + ' · ' + s : s]) }));
        const s = FF.Assets.sprites[c.sprite];
        g.appendChild(this.comEscolha(E.campo('anim', 'Animação', c.anim, set(c, 'anim', 'Animação'), { sugestoes: s ? Object.keys(s.def.anims) : [] }), () => FF.Estudio.escolherSprite({ titulo: '▣ Sprite da camada', atual: { anim: c.anim, sprite: c.sprite }, inicio: c.sprite, aoEscolher: (a, id) => { c.sprite = id; c.anim = a; host.mudou('Sprite da camada'); } }), () => ({ set: FF.Assets.sprites[c.sprite], anim: c.anim })));
        g.appendChild(num(c, 'd', 'Duração (s)', null, { min: 0.02, passo: 0.05 }));
        g.appendChild(sel(c, 'ancora', 'Âncora', [['atacante', 'quem solta (pés)'], ['alvo', 'alvo (peito)'], ['tela', 'tela']], null, 'atacante'));
        g.appendChild(num(c, 'x', 'X')); g.appendChild(num(c, 'y', 'Y'));
        g.appendChild(sel(c, 'px', 'Unidade X/Y', [['', 'pixels da tela'], ['sprite', 'pixels do sprite (segue a escala da luta)']], 'Pixels do sprite: a camada fica no mesmo lugar em lutas 1×1 e 3×3', ''));
        g.appendChild(num(c, 'escala', 'Tamanho (×)', null, { passo: 0.05 }));
        g.appendChild(num(c, 'rot', 'Giro (°)'));
        g.appendChild(num(c, 'alpha', 'Opacidade', null, { passo: 0.05, min: 0, max: 1 }));
        g.appendChild(chk(c, 'flip', 'Espelhar'));
        g.appendChild(num(c, 'fps', 'fps'));
        g.appendChild(E.campo('check', 'Repetir', c.loop !== false, (v) => { if (v) delete c.loop; else c.loop = false; host.mudou('Repetir'); }));
        const k = E.grupo('Quadros-chave (movimento)', true);
        k.appendChild(E.el('p', 'es-dica', 'Posição/tamanho/giro/opacidade mudam suavemente entre as chaves. Mova o cursor, arraste a camada no palco com "Gravar chave" ligado.'));
        k.appendChild(E.botao('🔑 Gravar chave no cursor', () => host.gravarChave(), 'Grava a posição atual da camada no tempo do cursor'));
        k.appendChild(E.campo('check', 'Arrastar grava chave', host.autoChave, (v) => { host.autoChave = v; }));
        k.appendChild(E.campo('json', 'Chaves', c.chaves, set(c, 'chaves', 'Chaves'), { linhas: 4 }));
        box.appendChild(k);
        break;
      }
      case 'som': g.appendChild(E.campo('som', 'Som', c.som, set(c, 'som', 'Som'), { dica: 'Vários separados por vírgula = sorteia um' })); break;
      case 'voz':
        g.appendChild(E.campo('select', 'Voz do personagem', c.vozTipo || '', (v) => { if (v) c.vozTipo = v; else delete c.vozTipo; host.mudou('Voz do personagem'); },
          { lista: [['', '— arquivo escolhido abaixo —'], ['dano', 'dano'], ['lancado', 'lançado']], dica: 'Usa a voz cadastrada no personagem (aba Personagens), seja ele quem for' }));
        if (c.vozTipo) g.appendChild(E.campo('select', 'De quem', c.quem || 'atacante', (v) => { c.quem = v; host.mudou('De quem'); }, { lista: [['atacante', 'quem solta'], ['alvo', 'alvo']] }));
        else g.appendChild(E.campo('som', 'Voz', c.voz, set(c, 'voz', 'Voz'), { dica: 'Vários separados por vírgula = sorteia um', vozes: host.prefixoVoz() }));
        break;
      case 'acerto': this.camposAcerto(g, c, num, chk, sel, host, true); break;
      case 'tremer': case 'flash': g.appendChild(num(c, 'forca', 'Força', c.tipo === 'tremer' ? 'Ex.: 6 (fraco) a 20 (forte)' : '0 a 1', { passo: c.tipo === 'flash' ? 0.05 : 1 })); break;
      case 'mensagem': g.appendChild(txt(c, 'texto', 'Texto')); g.appendChild(num(c, 'd', 'Duração (s)', null, { passo: 0.1 })); break;
      case 'camera': {
        g.appendChild(num(c, 'd', 'Tempo até chegar (s)', '0 = corte seco', { min: 0, passo: 0.05 }));
        g.appendChild(num(c, 'zoom', 'Zoom (×)', '1 = normal', { passo: 0.05, min: 0.5, max: 4 }));
        g.appendChild(sel(c, 'foco', 'Foco', [['centro', 'centro da tela'], ['atacante', 'quem solta'], ['alvo', 'alvo'], ['entre', 'entre os dois']], null, 'centro'));
        g.appendChild(num(c, 'dx', 'Ajuste X')); g.appendChild(num(c, 'dy', 'Ajuste Y'));
        g.appendChild(E.el('p', 'es-dica', 'A câmera volta ao normal sozinha no fim do golpe. Para voltar antes, ponha outro clipe de câmera com zoom 1.'));
        break;
      }
      case 'acao': {
        const prontos = [['', 'modelos…'], ['{"ki": 20}', 'Ganhar ki'], ['{"aplicar": "kaioken"}', 'Ativar buff'], ['{"removerBuff": "kaioken"}', 'Tirar buff'], ['{"transformar": "ssj"}', 'Transformar'], ['{"curar": {"fracao": 0.3}}', 'Curar'], ['{"atordoar": 1}', 'Atordoar alvo'], ['{"vozTipo": "dano"}', 'Voz do tipo'], ['{"objeto": {"id": "esfera", "fx": "genkidama", "escala": [0.2, 1.5], "tempo": 1, "dy": -40}}', 'Criar objeto'], ['{"lancarObjeto": {"id": "esfera", "tempo": 0.8, "acertos": [{"fracao": 1, "forca": "energia", "lanca": true}]}}', 'Lançar objeto']];
        g.appendChild(E.campo('select', 'Modelo', '', (v) => { if (v) { c.passo = JSON.parse(v); host.mudou('Ação'); } }, { lista: prontos }));
        this.acaoAmigavel(g, c, host);
        g.appendChild(E.campo('json', 'Passo (JSON)', c.passo, set(c, 'passo', 'Ação'), { linhas: 6 }));
        g.appendChild(E.el('p', 'es-dica', 'Qualquer passo de roteiro do motor: transformar, aplicar, removerBuff, ki, curar, atordoar, objeto, lancarObjeto, autoNocaute, vozTipo…'));
        break;
      }
    }
    const bts = E.el('div', 'es-props-bts');
    bts.append(E.botao('⧉ Duplicar', () => host.duplicar(), 'Ctrl+D'), E.botao('🗑 Apagar', () => host.remover(), 'Delete', 'es-bt-perigo'));
    box.appendChild(bts);
    const j = E.grupo('JSON do clipe', false);
    const limpo = Object.assign({}, c); delete limpo.id;
    j.appendChild(E.campo('json', 'Clipe', limpo, (v) => { if (v && typeof v === 'object') { Object.keys(c).forEach(k => { if (k !== 'id') delete c[k]; }); Object.assign(c, v); host.mudou('Editar JSON'); } }, { linhas: 6 }));
    box.appendChild(j);
  },

  camposAcerto(g, c, num, chk, sel, host, completo) {
    const E = FF.Estudio;
    g.appendChild(num(c, 'fracao', 'Dano (fração)', 'Parte do poder do golpe (ex.: 0.3)', { passo: 0.05, min: 0 }));
    g.appendChild(sel(c, 'forca', 'Força', this.FORCAS, 'Muda o impacto, o som e o tremor', 'leve'));
    g.appendChild(chk(c, 'lanca', 'Lança o alvo'));
    g.appendChild(num(c, 'empurrao', 'Empurrão', 'Força do empurrão (ex.: 300)'));
    g.appendChild(this.campoEfeito(c, 'fx', 'Explosão', host, true));
    g.appendChild(num(c, 'dx', 'Explosão X', 'A partir do peito do alvo; + = para longe de quem bate'));
    g.appendChild(num(c, 'dy', 'Explosão Y'));
    g.appendChild(num(c, 'fxEscala', 'Tamanho explosão', null, { passo: 0.05 }));
    if (completo) g.appendChild(E.campo('select', 'Anel', c.anel === true ? 'novo' : c.anel === false ? 'mesmo' : '', (v) => { if (v === 'novo') c.anel = true; else if (v === 'mesmo') c.anel = false; else delete c.anel; host.mudou('Anel'); },
      { lista: [['', 'automático'], ['novo', 'abre um anel novo'], ['mesmo', 'usa o anel anterior']], dica: 'Anel de guarda (inimigo atacando) ou crítico (herói atacando)' }));
  },

  titulo(c) {
    return { anim: '🎬 Animação', mover: '➡ Movimento', teleporte: '⚡ Teleporte', visivel: '👁 Aparecer/sumir', efeito: '✺ Efeito visual', projetil: '➶ Projétil', camada: '▣ Camada livre', som: '♪ Som', voz: '🗣 Voz', acerto: '✸ Acerto', tremer: '〰 Tremor', flash: '✦ Flash', mensagem: '💬 Mensagem', camera: '🎥 Câmera', acao: '⚙ Ação' }[c.tipo] || c.tipo;
  },

  trilha(tr, host, txt) {
    const E = FF.Estudio;
    const g = E.grupo('Trilha: ' + (tr.nome || tr.tipo));
    g.appendChild(txt(tr, 'nome', 'Nome'));
    if (tr.tipo === 'lutador') {
      const lista = [['atacante', 'quem solta'], ['alvo', 'alvo']].concat(host.personagens().map(p => [p, 'parceiro: ' + p]));
      g.appendChild(E.campo('select', 'Lutador', tr.quem || 'atacante', (v) => { tr.quem = v; host.mudou('Lutador da trilha'); }, { lista, dica: 'Parceiro = Sparking Combo (o parceiro precisa estar no time; escolha em "Parceiro" no painel da esquerda)' }));
    }
    g.appendChild(E.campo('check', 'Desligada', tr.oculta, (v) => { if (v) tr.oculta = true; else delete tr.oculta; host.mudou('Desligar trilha'); }));
    if (!['atacante', 'alvo'].includes(tr.id)) g.appendChild(E.botao('🗑 Apagar trilha', () => host.removerTrilha(tr.id), null, 'es-bt-perigo'));
    return g;
  },

  golpe(host, num, chk, txt, sel) {
    const E = FF.Estudio;
    const g = host.doc.golpe;
    const box = E.el('div');
    if (host.doc.origem.tipo === 'ko') {   // cena de KO: não tem nome, custo nem poder
      const k = E.grupo('💀 Cena de KO');
      k.appendChild(E.el('p', 'es-dica', 'Toca quando a vida de alguém chega a zero, junto com o golpe que derrubou. Trilha <b>Alvo</b> = quem caiu (use as animações "lancado" e "caido", empurrão, efeitos "peito/pés do alvo"); trilha <b>Quem solta</b> = quem deu o golpe final. ' +
        (host.doc.origem.id === 'padrao' ? 'Esta é a padrão: vale para todo mundo que não tem cena própria.' : 'Esta é a cena própria deste personagem; os outros continuam com a padrão.') +
        ' Acertos não valem aqui. O "congelamento" do golpe final continua automático.'));
      box.appendChild(k);
    } else {
    const a = E.grupo('⚔ Golpe');
    a.appendChild(txt(g, 'nome', 'Nome'));
    a.appendChild(E.campo('area', 'Descrição', g.descricao, (v) => { if (v) g.descricao = v; else delete g.descricao; host.mudou('Descrição'); }, { linhas: 2 }));
    a.appendChild(sel(g, 'tipo', 'Tipo', [['', 'automático'], ['corpo', '👊 corpo a corpo'], ['energia', '🔥 energia'], ['suporte', '✨ suporte'], ['transformacao', '⚡ transformação']], 'Ícone no menu', ''));
    a.appendChild(num(g, 'custoKi', 'Custo de ki', null, { min: 0, passo: 1 }));
    a.appendChild(num(g, 'poder', 'Poder', 'Multiplicador de dano (ex.: 1.7 sequência, 3 Kamehameha)', { passo: 0.1, min: 0 }));
    a.appendChild(chk(g, 'supremo', 'Supremo (Fúria cheia)'));
    a.appendChild(E.campo('check', 'Anunciar o nome', g.anuncio !== false, (v) => { if (v) delete g.anuncio; else g.anuncio = false; host.mudou('Anúncio'); }));
    box.appendChild(a);
    }
    const L = host.doc.linha;
    const d = E.grupo('⏱ Duração');
    const row = E.campo('numero', 'Fim da linha (s)', L.duracao, (v) => { if (v > 0) { L.duracao = v; L.duracaoManual = true; host.mudou('Duração'); } }, { passo: 0.05, min: 0.1 });
    d.appendChild(row);
    d.appendChild(E.campo('check', 'Automática', !L.duracaoManual, (v) => { if (v) { delete L.duracaoManual; host.autoDuracao(); } else L.duracaoManual = true; host.mudou('Duração automática'); }, { dica: 'Termina 0,1 s depois do último clipe' }));
    box.appendChild(d);
    const r = E.grupo('🔒 Regras', false);
    if (host.doc.origem.tipo === 'ko') r.style.display = 'none';
    r.appendChild(E.el('p', 'es-dica', 'mostrar/esconder: {"buff": "kaioken"} ou {"forma": "ssj"}. requer: {"parceiro": {"id": "piccolo", "ki": 30}} para Sparking Combo, {"semBuff": "kaioken"}.'));
    ['mostrar', 'esconder', 'requer'].forEach(k => r.appendChild(E.campo('json', k, g[k], (v) => { if (v === undefined) delete g[k]; else g[k] = v; host.mudou('Regra ' + k); }, { linhas: 2 })));
    box.appendChild(r);
    const dicas = E.grupo('💡 Dicas', false);
    dicas.appendChild(E.el('div', 'es-dica', '<p>Espaço: tocar/pausar · ← →: quadro a quadro (Shift = 10) · Home/End · Del: apagar clipe · Ctrl+D: duplicar · Ctrl+C/V: copiar/colar · Ctrl+Z/Y: desfazer/refazer · Ctrl+S: salvar.</p><p>Escolha um clipe para ver e mudar tudo dele. Clique no palco para escolher o que está lá.</p>'));
    box.appendChild(dicas);
    return box;
  },

  // ---------- cor: círculo cromático com o NOME de cada cor (pedido do usuário, que é daltônico) ----------
  CORES: [[0, 'Vermelho'], [15, 'Vermelho-alaranjado'], [28, 'Laranja'], [42, 'Amarelo-ouro'], [54, 'Amarelo'], [70, 'Verde-limão'], [95, 'Verde'],
    [140, 'Verde-esmeralda'], [165, 'Verde-água'], [180, 'Ciano'], [198, 'Azul-claro'], [218, 'Azul'], [240, 'Anil'], [262, 'Roxo'],
    [282, 'Violeta'], [300, 'Magenta'], [320, 'Rosa'], [342, 'Vermelho-rosado']],
  PRINCIPAIS: [[0, 'Vermelho'], [28, 'Laranja'], [54, 'Amarelo'], [110, 'Verde'], [180, 'Ciano'], [218, 'Azul'], [265, 'Roxo'], [320, 'Rosa']],
  nomeCor(h) { h = ((h % 360) + 360) % 360; let n = this.CORES[0][1]; for (const [a, nome] of this.CORES) if (h >= a) n = nome; return n; },
  rodaCores(c, host) {
    const E = FF.Estudio;
    const g = E.grupo('🎨 Cor do projétil', true);
    const cv = document.createElement('canvas'); cv.width = 260; cv.height = 260; cv.className = 'es-roda-cor';
    const info = E.el('div', 'es-roda-info');
    const R0 = 62, R1 = 92, C = 130;
    const desenhar = () => {
      const x = cv.getContext('2d');
      x.clearRect(0, 0, 260, 260);
      for (let a = 0; a < 360; a += 1) {   // anel (vermelho no topo, sentido horário)
        const r0 = (a - 90 - 0.6) * Math.PI / 180, r1 = (a - 90 + 0.6) * Math.PI / 180;
        x.beginPath(); x.arc(C, C, R1, r0, r1); x.arc(C, C, R0, r1, r0, true); x.closePath();
        x.fillStyle = 'hsl(' + a + ',90%,55%)'; x.fill();
      }
      // nomes das cores principais em volta, com um tracinho
      x.font = 'bold 11px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (const [a, nome] of this.PRINCIPAIS) {
        const r = (a - 90) * Math.PI / 180;
        x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(C + Math.cos(r) * (R1 + 1), C + Math.sin(r) * (R1 + 1)); x.lineTo(C + Math.cos(r) * (R1 + 7), C + Math.sin(r) * (R1 + 7)); x.stroke();
        x.fillStyle = '#e8e0ff'; x.fillText(nome, C + Math.cos(r) * (R1 + 22), C + Math.sin(r) * (R1 + 16));
      }
      if (c.cor != null) {
        const r = (c.cor - 90) * Math.PI / 180, mx = C + Math.cos(r) * (R0 + R1) / 2, my = C + Math.sin(r) * (R0 + R1) / 2;
        x.lineWidth = 3; x.strokeStyle = '#000'; x.beginPath(); x.arc(mx, my, 11, 0, Math.PI * 2); x.stroke();
        x.lineWidth = 2; x.strokeStyle = '#fff'; x.beginPath(); x.arc(mx, my, 8, 0, Math.PI * 2); x.stroke();
        x.fillStyle = 'hsl(' + c.cor + ',90%,55%)'; x.beginPath(); x.arc(C, C, R0 - 14, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#000'; x.font = 'bold 12px sans-serif'; x.fillText(this.nomeCor(c.cor), C, C - 6); x.font = '11px monospace'; x.fillText(Math.round(c.cor) + '°', C, C + 10);
      } else { x.fillStyle = '#e8e0ff'; x.font = '12px sans-serif'; x.fillText('cor original', C, C); }
      info.textContent = c.cor != null ? 'Cor escolhida: ' + this.nomeCor(c.cor) + ' (' + Math.round(c.cor) + '°)' : 'Sem cor: o projétil fica com as cores do sprite.';
    };
    const aplicar = (h, juntar) => { c.cor = Math.round(((h % 360) + 360) % 360); desenhar(); host.mudou('Cor do projétil', juntar); };
    const peloMouse = (e, juntar) => {
      const r = cv.getBoundingClientRect(), k = cv.width / r.width;
      const x = (e.clientX - r.left) * k - C, y = (e.clientY - r.top) * k - C;
      if (Math.hypot(x, y) < R0 - 18 || Math.hypot(x, y) > R1 + 30) return false;
      aplicar(Math.atan2(y, x) * 180 / Math.PI + 90, juntar); return true;
    };
    let arrastando = false;
    cv.addEventListener('pointerdown', (e) => { if (peloMouse(e, false)) { arrastando = true; cv.setPointerCapture(e.pointerId); } });
    cv.addEventListener('pointermove', (e) => {
      if (arrastando) return peloMouse(e, true);
      const r = cv.getBoundingClientRect(), k = cv.width / r.width, x = (e.clientX - r.left) * k - C, y = (e.clientY - r.top) * k - C, d = Math.hypot(x, y);
      cv.title = d >= R0 - 18 && d <= R1 + 30 ? this.nomeCor(Math.atan2(y, x) * 180 / Math.PI + 90) : '';
    });
    const soltar = () => { arrastando = false; };
    cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar);
    g.appendChild(cv);
    g.appendChild(info);
    // botões com o nome escrito (não depende de enxergar a cor)
    const bts = E.el('div', 'es-cores-nomes');
    this.PRINCIPAIS.forEach(([h, nome]) => {
      const b = E.botao(nome, () => aplicar(h), 'Pintar de ' + nome.toLowerCase());
      const am = document.createElement('span'); am.className = 'es-cor-amostra'; am.style.background = 'hsl(' + h + ',90%,55%)';
      b.prepend(am); bts.appendChild(b);
    });
    g.appendChild(bts);
    g.appendChild(E.campo('numero', 'Ajuste fino (°)', c.cor, (v, j) => { if (v === undefined || isNaN(v)) delete c.cor; else c.cor = ((Math.round(v) % 360) + 360) % 360; desenhar(); host.mudou('Cor do projétil', j); }, { passo: 1, min: 0, max: 359, dica: '0 vermelho · 54 amarelo · 110 verde · 180 ciano · 218 azul · 265 roxo · 320 rosa' }));
    g.appendChild(E.campo('numero', 'Intensidade', c.corForca, (v, j) => { if (v === undefined || isNaN(v)) delete c.corForca; else c.corForca = Math.max(0, v); host.mudou('Intensidade da cor', j); }, { passo: 0.1, min: 0, max: 3, dica: 'Vazio = 1 (normal). 0 = bem clarinho; 2 = forte' }));
    g.appendChild(E.botao('↺ Cor original', () => { delete c.cor; delete c.corForca; desenhar(); host.mudou('Cor do projétil'); }, 'Tira a cor e volta às cores do sprite'));
    desenhar();
    return g;
  },

  comEscolha(row, fn, fonte) {
    if (fonte) {
      const cv = document.createElement('canvas'); cv.width = 34; cv.height = 34; cv.className = 'es-mini-anim';
      cv.onclick = (e) => { e.preventDefault(); fn(); };
      FF.Estudio.miniAnim(cv, fonte);
      row.appendChild(cv);
    }
    row.appendChild(FF.Estudio.botao('🖼', (e) => { e.preventDefault(); fn(); }, 'Escolher vendo as miniaturas'));
    return row;
  },
  // animação de um lutador pelo nome (nomes básicos como "parado" passam pelo mapa da forma)
  fonteAnim(host, quem, c) {
    return () => {
      if (c.sprite && FF.Assets.sprites[c.sprite]) return { set: FF.Assets.sprites[c.sprite], anim: c.anim };
      const s = host.spriteDe(quem), f = host.formaDe && host.formaDe(quem);
      const nome = c.anim && (((f && f.anims) || {})[c.anim] || c.anim);
      return { set: s, anim: nome };
    };
  },

  // efeito: lista dos efeitos do jogo + sprites importados (grava "sprite" junto quando é importado)
  campoEfeito(c, k, rot, host, opcional) {
    const ks = k === 'fx' ? 'sprite' : k + 'Sprite';   // sprite de onde vem o efeito (fx: 'sprite'; disparo: 'disparoSprite'; impacto: 'impactoSprite')
    const E = FF.Estudio;
    const extras = this.efeitosDoLutador(host);
    const row = E.campo('anim', rot, c[k], (v) => { if (v === undefined) delete c[k]; else c[k] = v; if (v && E.efeitos().includes(v)) delete c[ks]; host.mudou(rot); }, { sugestoes: E.efeitos().concat(extras) });
    return this.comEscolha(row, () => this.escolherEfeito(c[k], (fx, sprite) => {
      c[k] = fx;
      if (sprite) c[ks] = sprite; else delete c[ks];
      host.mudou(rot);
    }, opcional && (() => { delete c[k]; delete c[ks]; host.mudou(rot); }), host, c[ks]), () => ({ set: E.setDoEfeito(c[k], c[ks]), anim: c[k] }));
  },
  // efeitos que vêm no sprite de quem solta (ex.: Bills_Esfera)
  efeitosDoLutador(host) {
    const s = host && host.spriteDe && host.spriteDe('atacante');
    const id = s && s.def.id;
    if (!s || !id) return [];
    const pre = id.charAt(0).toUpperCase() + id.slice(1) + '_';
    return Object.keys(s.def.anims).filter(a => a.startsWith(pre));
  },

  // efeito: seletor com TODOS os sprites (fx, fx_extra, lutadores, importados); devolve (anim, sprite|null)
  escolherEfeito(atual, cb, limpar, host, spriteAtual) {
    FF.Estudio.escolherSprite({ titulo: '✺ Escolher efeito', atual: { anim: atual, sprite: spriteAtual }, inicio: spriteAtual || undefined,
      aoEscolher: (a, id) => cb(a, id === 'fx' || id === 'fx_extra' ? null : id), limpar });
  },

  // cartão dos seletores: anima enquanto o mouse está em cima (todos animando ao mesmo tempo pesaria)
  animarNoMouse(k, cv, set, anim) {
    let ligado = false, registrado = false;
    k.addEventListener('mouseenter', () => { ligado = true; if (!registrado) { registrado = true; FF.Estudio.miniAnim(cv, () => (ligado ? { set, anim } : null)); } });
    k.addEventListener('mouseleave', () => { ligado = false; FF.Estudio.miniatura(cv, set, anim, Math.floor(set.anim(anim).frames.length / 2)); });
  },

  escolherAnim(set, atual, cb) {
    const E = FF.Estudio;
    if (!set) return E.aviso('Sprite não carregado.', 'erro');
    const c = E.el('div');
    const busca = document.createElement('input'); busca.type = 'search'; busca.placeholder = 'Filtrar animações';
    const grade = E.el('div', 'es-grade');
    c.append(busca, grade);
    const m = E.modal('🎬 Animações de ' + (set.def.id || ''), c, { larga: true });
    const render = () => {
      grade.innerHTML = '';
      const f = busca.value.toLowerCase();
      Object.keys(set.def.anims).filter(a => !f || a.toLowerCase().includes(f)).forEach(a => {
        const k = E.el('div', 'es-cartao' + (a === atual ? ' sel' : ''));
        const cv = document.createElement('canvas'); cv.width = 96; cv.height = 72;
        const sp = E.el('span'); sp.textContent = a + ' (' + set.anim(a).frames.length + ')';
        k.title = a; k.append(cv, sp);
        E.miniatura(cv, set, a, Math.floor(set.anim(a).frames.length / 2));
        this.animarNoMouse(k, cv, set, a);
        k.onclick = () => { cb(a); m.fechar(); };
        grade.appendChild(k);
      });
    };
    busca.oninput = render;
    render();
    setTimeout(() => busca.focus(), 30);
  },
};
