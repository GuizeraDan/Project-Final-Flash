// Teste: ✏ ajuste por combinação de fileiras — o que muda com o modo ligado fica só naquela combinação (c.ajustes),
// o base continua igual, o motor usa o ajuste certo e o salvo no jogo não leva o estado de edição (_base).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes&personagem=goku&golpe=kamehameha');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.doc && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const ok = (c, m) => { console.log((c ? 'ok: ' : 'FALHOU: ') + m); if (!c) process.exitCode = 1; };
  const r = await p.evaluate(() => {
    const G = FF.Estudio.Golpes;
    G.palco.opts.persp = true; G.cfg.filaAtk = 'fundo'; G.cfg.filaAlvo = 'meio'; G.irPara(0.2);
    const tr = G.doc.linha.trilhas.find(x => x.tipo === 'efeitos');
    const c = { id: 'taj', tipo: 'efeito', t: 0.05, fx: 'Rochas', em: 'atacante', dx: 10, dy: 0, d: 1 };
    tr.clipes.push(c); G.sel = c.id; G.trSel = tr.id; G.mudou('teste');
    G.ligarAjuste();
    const chave = G.ajuste;
    G.clipe().dx = 200; G.mudou('Mover no ajuste');
    const noModo = { dx: G.clipe().dx, aj: JSON.stringify(G.clipe().ajustes) };
    const salvo = G.montarGolpe();
    const cs = salvo.roteiro[0].linha.trilhas.find(x => x.tipo === 'efeitos').clipes.find(x => x.id === 'taj');
    G.desligarAjuste(true);
    const base = G.clipe().dx;
    // motor: com a combinação do ajuste usa dx 200; em outra combinação, o base (10)
    const cBase = Object.assign({}, G.clipe(), { _tr: tr });
    const usa = FF.Linha.comAjuste(cBase, chave).dx, outra = FF.Linha.comAjuste(cBase, 'frente>frente').dx;
    // a batalha de verdade (sem semAjustes) acha a chave pelas fileiras
    const B = G.palco._b, k2 = FF.Linha.chaveFileiras(B, B.atk, B.alvo);
    return { chave, noModo, base, usa, outra, k2, salvoBase: cs.dx, salvoSemBase: !('_base' in cs), salvoAj: JSON.stringify(cs.ajustes), rotulo: G.tl.rotulo(G.clipe()) };
  });
  ok(r.chave === 'fundo>meio' && r.k2 === 'fundo>meio', 'combinação atual: ' + r.chave);
  ok(r.noModo.dx === 200 && /"fundo>meio":\{"dx":200\}/.test(r.noModo.aj), 'no modo: mudança guardada só na combinação ' + r.noModo.aj);
  ok(r.base === 10, 'desligado: o base continua 10');
  ok(r.usa === 200 && r.outra === 10, 'motor: usa o ajuste na combinação certa (200) e o base nas outras (10)');
  ok(r.salvoBase === 10 && r.salvoSemBase && /200/.test(r.salvoAj), 'salvar no jogo leva o base + os ajustes, sem o estado de edição');
  ok(/◆1/.test(r.rotulo), 'clipe com ajuste marcado na linha do tempo: ' + r.rotulo);
  ok(await p.locator('.es-bt-ajuste').count() === 1, 'botão ✏ na barra do palco');
  ok(!erros.length, 'sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
})();
