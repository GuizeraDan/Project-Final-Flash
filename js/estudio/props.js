// Estúdio — painel de propriedades da aba Golpes: golpe (sem clipe escolhido), trilha e clipe.
// host: { doc, clipe(), trilha(), mudou(rotulo, juntar), animsDe(quem) → [nomes], spriteDe(quem), personagens(),
//         gravarChave(), autoDuracao(), remover(), duplicar() }
window.FF = window.FF || {};

FF.EstudioProps = {
  FORCAS: [['leve', 'leve'], ['media', 'média'], ['forte', 'forte'], ['energia', 'energia']],
  EM: [['atacante', 'pés de quem solta'], ['peito', 'peito de quem solta'], ['disparo', 'ponto de disparo'], ['alvo', 'peito do alvo'], ['alvoPes', 'pés do alvo'], ['tela', 'tela (fixo)']],
  BASICAS: ['parado', 'dano1', 'dano2', 'guarda', 'lancado', 'caido', 'avancar', 'recuar', 'teleporte'],

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
        g.appendChild(this.comEscolha(E.campo('anim', 'Animação', c.anim, set(c, 'anim', 'Animação'), { sugestoes: lista }), () => this.escolherAnim(host.spriteDe(quem), c.anim, (a) => { c.anim = a; host.mudou('Animação'); })));
        g.appendChild(num(c, 'fps', 'fps', 'Velocidade da animação (vazio = a da própria animação)', { min: 0 }));
        g.appendChild(num(c, 'd', 'Duração fixa (s)', 'Vazio = o tamanho natural da animação. Com duração, a animação repete até o fim.', { min: 0, passo: 0.01 }));
        g.appendChild(chk(c, 'loop', 'Repetir', 'Fica repetindo (até o próximo clipe ou o fim)'));
        g.appendChild(num(c, 'segurar', 'Segurar 1º quadro (s)', 'Fica parado no 1º quadro antes de animar (tempo para o anel de guarda/crítico)', { min: 0, passo: 0.01 }));
        const p = E.grupo('Posição e aparência', true);
        p.appendChild(E.el('p', 'es-dica', 'Arraste o lutador no palco para mudar a posição deste clipe.'));
        p.appendChild(num(c, 'dx', 'X (px)', 'Deslocamento para a frente (+) ou para trás (−)'));
        p.appendChild(num(c, 'dy', 'Y (px)', 'Para baixo (+) ou para cima (−)'));
        p.appendChild(num(c, 'escala', 'Tamanho (×)', '1 = normal', { passo: 0.05, min: 0.05 }));
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
        g.appendChild(sel(c, 'para', 'Para onde', [['alvo', 'até o alvo'], ['casa', 'para a posição inicial'], ['frente', 'para a frente'], ['tras', 'para trás'], ['x', 'posição X da tela']], null, 'alvo'));
        g.appendChild(num(c, 'dist', 'Distância', 'Alvo: quanto para antes dele. Frente/trás: quanto anda (em px do sprite × escala)'));
        if (c.para === 'x') g.appendChild(num(c, 'x', 'X na tela', '0 a 1084'));
        g.appendChild(E.campo('anim', 'Animação', c.animMov, set(c, 'animMov', 'Animação do movimento'), { sugestoes: this.BASICAS.concat(host.animsDe(quem)), dica: c.tipo === 'mover' ? 'Vazio = avançar/recuar' : 'Vazio = teleporte' }));
        if (c.tipo === 'mover') g.appendChild(E.campo('check', 'Suave', c.suave !== false, (v) => { if (v) delete c.suave; else c.suave = false; host.mudou('Suave'); }));
        break;
      }
      case 'visivel': g.appendChild(num(c, 'alpha', 'Opacidade', '0 = some, 1 = aparece', { passo: 0.1, min: 0, max: 1 })); break;
      case 'efeito': {
        g.appendChild(this.campoEfeito(c, 'fx', 'Efeito', host));
        g.appendChild(sel(c, 'em', 'Preso em', this.EM, null, 'atacante'));
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
        g.appendChild(E.campo('check', 'Rastro', c.rastro !== false, (v) => { if (v) delete c.rastro; else c.rastro = false; host.mudou('Rastro'); }));
        g.appendChild(E.campo('check', 'Cresce ao sair', c.crescer !== false, (v) => { if (v) delete c.crescer; else c.crescer = false; host.mudou('Crescer'); }));
        g.appendChild(chk(c, 'atravessar', 'Atravessa o alvo'));
        g.appendChild(chk(c, 'deCima', 'Cai do alto'));
        g.appendChild(num(c, 'curva', 'Arco (px)', 'Altura do arco'));
        g.appendChild(num(c, 'ondular', 'Ondular (px)'));
        g.appendChild(num(c, 'girar', 'Girar (°/s)'));
        const pos = E.grupo('Saída e chegada', true);
        pos.appendChild(E.el('p', 'es-dica', 'No palco: arraste a alça verde (saída) e a vermelha (chegada).'));
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
        g.appendChild(E.campo('select', 'Sprite', c.sprite, async (v) => { c.sprite = v; await FF.Assets.loadSprite(v).catch(() => null); const s = FF.Assets.sprites[v]; if (s && !s.has(c.anim)) c.anim = Object.keys(s.def.anims)[0]; host.mudou('Sprite da camada'); }, { lista: FF.Assets.listaSprites() }));
        const s = FF.Assets.sprites[c.sprite];
        g.appendChild(this.comEscolha(E.campo('anim', 'Animação', c.anim, set(c, 'anim', 'Animação'), { sugestoes: s ? Object.keys(s.def.anims) : [] }), () => this.escolherAnim(s, c.anim, (a) => { c.anim = a; host.mudou('Animação'); })));
        g.appendChild(num(c, 'd', 'Duração (s)', null, { min: 0.02, passo: 0.05 }));
        g.appendChild(sel(c, 'ancora', 'Âncora', [['atacante', 'quem solta (pés)'], ['alvo', 'alvo (peito)'], ['tela', 'tela']], null, 'atacante'));
        g.appendChild(num(c, 'x', 'X')); g.appendChild(num(c, 'y', 'Y'));
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
      case 'voz': g.appendChild(E.campo('som', 'Voz', c.voz, set(c, 'voz', 'Voz'), { dica: 'Vários separados por vírgula = sorteia um', vozes: host.prefixoVoz() })); break;
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
        g.appendChild(E.campo('json', 'Passo', c.passo, set(c, 'passo', 'Ação'), { linhas: 6 }));
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
    const a = E.grupo('⚔ Golpe');
    a.appendChild(txt(g, 'nome', 'Nome'));
    a.appendChild(E.campo('area', 'Descrição', g.descricao, (v) => { if (v) g.descricao = v; else delete g.descricao; host.mudou('Descrição'); }, { linhas: 2 }));
    a.appendChild(sel(g, 'tipo', 'Tipo', [['', 'automático'], ['corpo', '👊 corpo a corpo'], ['energia', '🔥 energia'], ['suporte', '✨ suporte'], ['transformacao', '⚡ transformação']], 'Ícone no menu', ''));
    a.appendChild(num(g, 'custoKi', 'Custo de ki', null, { min: 0, passo: 1 }));
    a.appendChild(num(g, 'poder', 'Poder', 'Multiplicador de dano (ex.: 1.7 sequência, 3 Kamehameha)', { passo: 0.1, min: 0 }));
    a.appendChild(chk(g, 'supremo', 'Supremo (Fúria cheia)'));
    a.appendChild(E.campo('check', 'Anunciar o nome', g.anuncio !== false, (v) => { if (v) delete g.anuncio; else g.anuncio = false; host.mudou('Anúncio'); }));
    box.appendChild(a);
    const L = host.doc.linha;
    const d = E.grupo('⏱ Duração');
    const row = E.campo('numero', 'Fim da linha (s)', L.duracao, (v) => { if (v > 0) { L.duracao = v; L.duracaoManual = true; host.mudou('Duração'); } }, { passo: 0.05, min: 0.1 });
    d.appendChild(row);
    d.appendChild(E.campo('check', 'Automática', !L.duracaoManual, (v) => { if (v) { delete L.duracaoManual; host.autoDuracao(); } else L.duracaoManual = true; host.mudou('Duração automática'); }, { dica: 'Termina 0,1 s depois do último clipe' }));
    box.appendChild(d);
    const r = E.grupo('🔒 Regras', false);
    r.appendChild(E.el('p', 'es-dica', 'mostrar/esconder: {"buff": "kaioken"} ou {"forma": "ssj"}. requer: {"parceiro": {"id": "piccolo", "ki": 30}} para Sparking Combo, {"semBuff": "kaioken"}.'));
    ['mostrar', 'esconder', 'requer'].forEach(k => r.appendChild(E.campo('json', k, g[k], (v) => { if (v === undefined) delete g[k]; else g[k] = v; host.mudou('Regra ' + k); }, { linhas: 2 })));
    box.appendChild(r);
    const dicas = E.grupo('💡 Dicas', false);
    dicas.appendChild(E.el('div', 'es-dica', '<p>Espaço: tocar/pausar · ← →: quadro a quadro (Shift = 10) · Home/End · Del: apagar clipe · Ctrl+D: duplicar · Ctrl+C/V: copiar/colar · Ctrl+Z/Y: desfazer/refazer · Ctrl+S: salvar.</p><p>Escolha um clipe para ver e mudar tudo dele. Clique no palco para escolher o que está lá.</p>'));
    box.appendChild(dicas);
    return box;
  },

  comEscolha(row, fn) { row.appendChild(FF.Estudio.botao('🖼', (e) => { e.preventDefault(); fn(); }, 'Escolher vendo as miniaturas')); return row; },

  // efeito: lista dos efeitos do jogo + sprites importados (grava "sprite" junto quando é importado)
  campoEfeito(c, k, rot, host, opcional) {
    const E = FF.Estudio;
    const row = E.campo('anim', rot, c[k], (v) => { if (v === undefined) delete c[k]; else c[k] = v; if (k === 'fx' && v && E.efeitos().includes(v)) delete c.sprite; host.mudou(rot); }, { sugestoes: E.efeitos() });
    return this.comEscolha(row, () => this.escolherEfeito(c[k], (fx, sprite) => {
      c[k] = fx;
      if (k === 'fx') { if (sprite) c.sprite = sprite; else delete c.sprite; }
      host.mudou(rot);
    }, opcional && (() => { delete c[k]; host.mudou(rot); })));
  },

  escolherEfeito(atual, cb, limpar) {
    const E = FF.Estudio;
    const ids = ['fx', 'fx_extra'].concat(Object.keys(FF.Edicoes.dados().spritesNovos || {}));
    const c = E.el('div');
    const topo = E.el('div', 'es-barra');
    const busca = document.createElement('input'); busca.type = 'search'; busca.placeholder = 'Filtrar (ex.: explos, hit, kame, aura)';
    topo.appendChild(busca);
    if (limpar) topo.appendChild(E.botao('Nenhum', () => { limpar(); m.fechar(); }));
    const grade = E.el('div', 'es-grade');
    c.append(topo, grade);
    const m = E.modal('✺ Escolher efeito', c, { larga: true });
    const itens = [];
    (async () => {
      for (const id of ids) {
        const s = await FF.Assets.loadSprite(id).catch(() => null);
        if (s) Object.keys(s.def.anims).forEach(a => itens.push({ id, a, s }));
      }
      render();
    })();
    const render = () => {
      grade.innerHTML = '';
      const f = busca.value.toLowerCase();
      itens.filter(x => !f || x.a.toLowerCase().includes(f) || x.id.includes(f)).slice(0, 300).forEach(x => {
        const k = E.el('div', 'es-cartao' + (x.a === atual ? ' sel' : ''));
        const cv = document.createElement('canvas'); cv.width = 96; cv.height = 72;
        const sp = E.el('span'); sp.textContent = x.a;
        k.title = x.id + ' · ' + x.a;
        k.append(cv, sp);
        E.miniatura(cv, x.s, x.a, Math.floor(x.s.anim(x.a).frames.length / 2));
        k.onclick = () => { cb(x.a, x.id === 'fx' || x.id === 'fx_extra' ? null : x.id); m.fechar(); };
        grade.appendChild(k);
      });
    };
    busca.oninput = render;
    setTimeout(() => busca.focus(), 30);
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
        k.onclick = () => { cb(a); m.fechar(); };
        grade.appendChild(k);
      });
    };
    busca.oninput = render;
    render();
    setTimeout(() => busca.focus(), 30);
  },
};
