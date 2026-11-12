// Teste do Estúdio (aba Golpes): cria uma habilidade do zero, posiciona um efeito arrastando no palco,
// salva e usa na Batalha Livre; edita um golpe existente e confere a mudança na batalha.
// Uso: node tools/testes/estudio.js [--fotos pasta]   (a API do GitHub é interceptada: nada é gravado)
const path = require('path');
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const fotos = args.includes('--fotos') ? args[args.indexOf('--fotos') + 1] : null;
const raiz = 'file://' + path.resolve(__dirname, '..', '..');
const ok = (c, m) => { if (!c) { console.log('FALHOU:', m); process.exitCode = 1; } else console.log('ok:', m); };

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.route('https://api.github.com/**', r => r.abort());
  const p = await ctx.newPage();
  const erros = [];
  const vigiar = (pg) => { pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') erros.push(m.type() + ': ' + m.text()); }); pg.on('pageerror', e => erros.push('PAGEERROR ' + e.message)); };
  vigiar(p);
  if (fotos) require('fs').mkdirSync(fotos, { recursive: true });
  const foto = async (pg, n) => fotos && pg.screenshot({ path: path.join(fotos, n + '.png') });

  await p.goto(raiz + '/estudio.html?aba=golpes&personagem=goku&golpe=kamehameha');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes.doc, null, { timeout: 30000 });
  ok(await p.evaluate(() => FF.Estudio.Golpes.doc.linha.trilhas[0].clipes.length > 0), 'Kamehameha convertido para linha do tempo');

  // ---- 1. habilidade nova do zero ----
  await p.click('text=＋ Novo');
  await p.evaluate(() => {
    const G = FF.Estudio.Golpes;
    G.doc.golpe.nome = 'Rajada Teste';
    G.doc.golpe.custoKi = 10; G.doc.golpe.poder = 2.5;
    const atk = G.doc.linha.trilhas.find(t => t.id === 'atacante');
    atk.clipes[0].anim = 'Special_Kamehameha_Chao_Frente'; atk.clipes[0].fps = 14;
    G.mudou('teste');
    G.adicionar('efeitos', 0.3);
    const ef = G.clipe(); ef.fx = 'Explosao4'; ef.em = 'disparo'; ef.dx = 0; ef.dy = 0; G.mudou('teste');
    G.selecionar(ef.id, 'efeitos');
  });
  await p.waitForTimeout(200);
  // arrasta a alça do efeito no palco 60 px para a direita e 30 para cima
  const pos = await p.evaluate(() => {
    const G = FF.Estudio.Golpes, h = G.alcas().find(a => a.k === 'mover');
    const r = G.cv.getBoundingClientRect();
    return h && { x: r.left + h.x * r.width / G.cv.width, y: r.top + h.y * r.height / G.cv.height, k: r.width / G.cv.width };
  });
  ok(!!pos, 'alça do efeito aparece no palco');
  if (pos) {
    await p.mouse.move(pos.x, pos.y); await p.mouse.down();
    await p.mouse.move(pos.x + 30 * pos.k, pos.y - 15 * pos.k, { steps: 4 });
    await p.mouse.move(pos.x + 60 * pos.k, pos.y - 30 * pos.k, { steps: 4 });
    await p.mouse.up();
  }
  const ef = await p.evaluate(() => FF.Estudio.Golpes.clipe());
  ok(ef && Math.abs(ef.dx - 60) <= 2 && Math.abs(ef.dy + 30) <= 2, 'arrastar no palco posicionou o efeito (dx=' + (ef && ef.dx) + ', dy=' + (ef && ef.dy) + ')');
  await p.evaluate(() => {
    const G = FF.Estudio.Golpes;
    G.adicionar('projeteis', 0.5);
    const pr = G.clipe(); pr.fx = 'kiblast_amarelo'; pr.impacto = 'Explosao4'; pr.acerto = { fracao: 0.4, forca: 'energia' };
    const ac = G.doc.linha.trilhas.find(t => t.id === 'acertos').clipes[0]; ac.t = 0.75; ac.forca = 'forte'; ac.lanca = true;
    G.doc.linha.trilhas.find(t => t.id === 'alvo').clipes.push({ id: 'cx1', tipo: 'anim', t: 0.8, anim: 'lancado', d: 0.5, empurrao: 300, voltarNormal: true });
    G.doc.linha.trilhas.find(t => t.id === 'sons').clipes.push({ id: 'cx2', tipo: 'som', t: 0, som: 'goku_kamehame_chrg' }, { id: 'cx3', tipo: 'voz', t: 0.1, voz: 'vgkn206' });
    G.mudou('teste');
  });
  // desfazer/refazer
  const n1 = await p.evaluate(() => FF.Estudio.Golpes.doc.linha.trilhas.reduce((s, t) => s + t.clipes.length, 0));
  await p.keyboard.press('Control+z');
  const n2 = await p.evaluate(() => FF.Estudio.Golpes.doc.linha.trilhas.reduce((s, t) => s + t.clipes.length, 0));
  await p.keyboard.press('Control+y');
  const n3 = await p.evaluate(() => FF.Estudio.Golpes.doc.linha.trilhas.reduce((s, t) => s + t.clipes.length, 0));
  ok(n2 < n1 && n3 === n1, 'desfazer/refazer (' + n1 + ' → ' + n2 + ' → ' + n3 + ')');
  // tocar e arrastar o tempo
  await p.evaluate(() => FF.Estudio.Golpes.irPara(0.9));
  ok(await p.evaluate(() => FF.Estudio.Golpes.palco._b.alvo.hp < FF.Estudio.Golpes.palco._b.alvo.hpMax), 'palco mostra o dano no instante 0,9 s');
  await foto(p, '1_estudio_nova');
  await p.click('text=💾 Salvar no jogo');
  const hab = await p.evaluate(() => Object.values(FF.Habilidades.ler()).find(h => h.nome === 'Rajada Teste'));
  ok(hab && hab.golpe.roteiro[0].linha, 'habilidade salva com linha do tempo');

  // ---- 2. golpe existente: Kamehameha com poder 9 ----
  await p.evaluate(() => FF.Estudio.Golpes.abrirGolpe('goku', 'kamehameha'));
  await p.waitForTimeout(300);
  await p.evaluate(() => { const G = FF.Estudio.Golpes; G.doc.golpe.poder = 9; G.mudou('Poder'); G.salvar(); });
  ok(await p.evaluate(() => FF.Edicoes.dados().golpes.goku.kamehameha.poder === 9), 'golpe existente salvo em data/edicoes (pendente)');
  await foto(p, '2_estudio_kame');

  // ---- 3. Batalha Livre com a habilidade ----
  const g = await ctx.newPage(); vigiar(g);
  await g.goto(raiz + '/index.html');
  await g.evaluate(() => sessionStorage.setItem('ff_livre_def', JSON.stringify({ id: 'livre', saga: 'livre', titulo: 'Teste', cenario: 'campo', musica: 'tournament_theme', escala: 2.5, posicoes: { herois: [170], inimigos: [915] }, herois: ['goku'], inimigos: ['raditz'], ajustes: {} })));
  await g.goto(raiz + '/index.html?livre=1');
  await g.waitForFunction(() => document.querySelector('#menu').classList.contains('open'), null, { timeout: 40000 });
  ok(await g.evaluate(() => FF.battle.heroes[0].def.golpes.kamehameha.poder === 9 && !!FF.battle.heroes[0].def.golpes.kamehameha.roteiro[0].linha), 'jogo usa o Kamehameha editado');
  const nomes = await g.evaluate(() => [...document.querySelectorAll('#menu .cmd-golpes button .nome')].map(x => x.textContent));
  const i = nomes.findIndex(n => n.includes('Rajada Teste'));
  ok(i >= 0, 'habilidade ⭐ aparece no menu de golpes');
  const hp0 = await g.evaluate(() => FF.battle.enemies[0].hp);
  await g.click('#menu .cmd-golpes button >> nth=' + i);
  await g.waitForTimeout(800);
  await foto(g, '3_jogo_habilidade');
  await g.waitForFunction(() => !FF.battle.heroes[0].busy, null, { timeout: 15000 });
  const hp1 = await g.evaluate(() => FF.battle.enemies[0].hp);
  ok(hp1 < hp0, 'habilidade causou dano na batalha (' + hp0 + ' → ' + hp1 + ')');

  ok(!erros.length, 'console sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
  console.log(process.exitCode ? 'TESTE DO ESTÚDIO FALHOU' : 'teste do estúdio ok');
})();
