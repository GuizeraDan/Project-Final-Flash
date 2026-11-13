// Teste do acervo do Z Legends 3 (data/acervo + assets/img/acervo): carregar sob demanda no jogo e no Estúdio,
// seletor de sprites com categorias/busca e aba Sprites agrupada. (Playwright + Chrome, por file://)
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const RAIZ = '/home/claude/project-final-flash';
const OUT = '/tmp/claude-0/acervo';
fs.mkdirSync(OUT, { recursive: true });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1; };

(async () => {
  const indice = JSON.parse(fs.readFileSync(RAIZ + '/data/acervo/indice.json', 'utf8'));
  const nIdx = Object.keys(indice.sprites).length;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--allow-file-access-from-files'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const msgs = [];
  const nova = async () => {
    const p = await ctx.newPage();
    p.on('console', m => { if (['error', 'warning'].includes(m.type())) msgs.push(m.type() + ': ' + m.text()); });
    p.on('pageerror', e => msgs.push('pageerror: ' + e.message));
    await p.route('https://api.github.com/**', r => r.abort());
    return p;
  };

  // ---- 1) jogo: o acervo aparece na lista e carrega sob demanda (sem estar no bundle)
  let p = await nova();
  await p.goto('file://' + RAIZ + '/index.html');
  await p.waitForFunction(() => window.FF && FF.Assets && window.FF_BUNDLE, null, { timeout: 20000 });
  let s = await p.evaluate(() => ({
    semIndice: !window.FF_ACERVO_INDICE,
    noBundle: Object.keys(FF_BUNDLE).filter(k => /zl3_|acervo/.test(k)).length + (FF_BUNDLE._indice.acervo ? 1 : 0),
  }));
  ok(s.semIndice, 'jogo abre sem carregar o índice do acervo');
  ok(s.noBundle === 0, 'nada do acervo dentro do bundle');
  s = await p.evaluate(async () => {
    const t0 = performance.now();
    const [a, b2] = await Promise.all([FF.Assets.loadSprite('zl3_explosao'), FF.Assets.loadSprite('zl3_explosao')]);
    const c = await FF.Assets.loadSprite('zl3_cut_gokussjvsfreeza');
    return { mesmo: a === b2, anims: Object.keys(a.def.anims).length, img: a.images ? a.images.length : (a.imgs || []).length, tipo: a.def.tipo, cut: Object.keys(c.def.anims).length, ms: Math.round(performance.now() - t0) };
  });
  ok(s.anims === indice.sprites.zl3_explosao.anims && s.mesmo, 'zl3_explosao carregado (' + s.anims + ' animações, ' + s.ms + ' ms) e não duplicado');
  ok(s.tipo === 'efeito', 'efeitos do acervo marcados como tipo efeito');
  ok(s.cut === indice.sprites.zl3_cut_gokussjvsfreeza.anims, 'cutscene carregada (' + s.cut + ')');
  s = await p.evaluate(async () => { try { await FF.Assets.loadSprite('zl3_nao_existe'); return 'carregou?'; } catch (e) { return 'erro'; } });
  ok(s === 'erro', 'sprite inexistente dá erro sem travar');
  await p.close();

  // ---- 2) Estúdio: seletor de sprites com o acervo
  p = await nova();
  await p.goto('file://' + RAIZ + '/estudio.html?aba=golpes');
  await p.waitForFunction(() => FF.Estudio && FF.Estudio.pronto, null, { timeout: 30000 });
  s = await p.evaluate(() => ({
    n: Object.keys(FF.Assets.acervo()).length,
    lista: FF.Assets.listaSprites().filter(i => FF.Assets.doAcervo(i)).length,
    cat: FF.Assets.categoriaSprite('zl3_explosao'), nome: FF.Assets.nomeSprite('zl3_explosao'), jogo: FF.Assets.categoriaSprite('gokubase'),
  }));
  ok(s.n === nIdx && s.lista === nIdx, 'índice do acervo no Estúdio: ' + s.n + ' sprites (indice.json tem ' + nIdx + ')');
  ok(s.cat === 'efeitos' && s.nome === 'Explosões' && s.jogo === 'jogo', 'categoria e nome (' + s.cat + ', ' + s.nome + ')');
  // todos os sprites do acervo abrem (JSON válido + imagens existentes)
  s = await p.evaluate(async () => {
    const ruins = [];
    for (const id of Object.keys(FF.Assets.acervo())) {
      try { const d = await FF.Assets.defAcervo(id); if (!d.anims || !Object.keys(d.anims).length) ruins.push(id + ':vazio'); } catch (e) { ruins.push(id + ':' + e.message); }
    }
    return ruins;
  });
  ok(!s.length, 'todos os ' + nIdx + ' arquivos do acervo abrem' + (s.length ? ' — ' + s.slice(0, 5).join(', ') : ''));
  const faltando = [];
  for (const id of Object.keys(indice.sprites)) for (let i = 0; i < indice.sprites[id].atlas; i++) if (!fs.existsSync(RAIZ + '/assets/img/acervo/' + id + '_' + i + '.png')) faltando.push(id + '_' + i);
  ok(!faltando.length, 'todas as imagens de atlas existem' + (faltando.length ? ' — ' + faltando.slice(0, 5) : ''));
  let escolhido = null;
  await p.exposeFunction('__escolheu', (a, id) => { escolhido = [a, id]; });
  await p.evaluate(() => FF.Estudio.escolherSprite({ inicio: 'cat:cenarios', aoEscolher: (a, id) => window.__escolheu(a, id) }));
  await p.waitForSelector('.es-seletor .es-cartao', { timeout: 20000 });
  s = await p.evaluate(() => ({
    cats: [...document.querySelectorAll('.es-seletor-cat')].map(c => c.textContent),
    cartoes: document.querySelectorAll('.es-seletor .es-cartao').length,
    info: document.querySelector('.es-seletor .es-dica').textContent,
  }));
  ok(s.cats.length === new Set(Object.values(indice.sprites).map(v => v.cat)).size && s.cats.some(c => /Cenários/.test(c)) && s.cats.some(c => /Cutscenes/.test(c)), 'categorias do acervo no seletor: ' + s.cats.join(' | '));
  ok(s.cartoes > 50, 'categoria Cenários mostra ' + s.cartoes + ' animações (' + s.info + ')');
  await p.waitForTimeout(1500);
  s = await p.evaluate(() => {
    const cv = document.querySelector('.es-seletor .es-cartao canvas'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return { pix: n, carregados: Object.keys(FF.Assets.sprites).filter(i => /^zl3_/.test(i)).length };
  });
  ok(s.pix > 0, 'miniatura do primeiro cartão desenhada (' + s.pix + ' px)');
  ok(s.carregados > 0 && s.carregados < 40, 'só os sprites visíveis foram baixados (' + s.carregados + ' de ' + nIdx + ')');
  await p.screenshot({ path: OUT + '/1_seletor_cenarios.png' });

  // busca em tudo (inclui animações de sprites ainda não baixados)
  await p.fill('.es-seletor input[type=search]', 'porunga');
  await p.waitForFunction(() => document.querySelectorAll('.es-seletor .es-cartao').length > 0, null, { timeout: 15000 });
  s = await p.evaluate(() => [...document.querySelectorAll('.es-seletor .es-cartao')].map(k => k.title));
  ok(s.some(t => /zl3_cenario_namek · porunga/.test(t)), 'busca "porunga" acha o cenário de Namek (' + s.length + ')');
  await p.fill('.es-seletor input[type=search]', 'Special_DeathSlash');
  await p.waitForFunction(() => [...document.querySelectorAll('.es-seletor .es-cartao')].some(k => /zl3_freeza/.test(k.title)), null, { timeout: 15000 });
  await p.click('.es-seletor .es-cartao[title^="zl3_freeza"]');
  await p.waitForTimeout(300);
  ok(escolhido && escolhido[1] === 'zl3_freeza' && escolhido[0] === 'Special_DeathSlash', 'escolher cartão do acervo devolve sprite + animação (' + escolhido + ')');
  ok(await p.evaluate(() => !!FF.Assets.sprites.zl3_freeza), 'sprite escolhido já fica carregado para o golpe');

  // jogo inteiro (Drag Warriors) separado por tipo
  await p.evaluate(() => FF.Estudio.escolherSprite({ inicio: 'cat:dw:efeitos', aoEscolher: () => {} }));
  await p.waitForFunction(() => document.querySelectorAll('.es-seletor-subcat').length >= 3 && document.querySelectorAll('.es-modal:last-of-type .es-cartao').length > 0, null, { timeout: 20000 });
  s = await p.evaluate(() => ({ subs: [...document.querySelectorAll('.es-seletor-subcat')].map(c => c.textContent), info: [...document.querySelectorAll('.es-seletor .es-dica')].pop().textContent,
    ids: [...new Set([...document.querySelectorAll('.es-modal:last-of-type .es-cartao')].map(k => k.title.split(' · ')[0]))] }));
  ok(s.subs.some(t => /Efeitos/.test(t)) && s.subs.some(t => /Personagens/.test(t)) && s.subs.some(t => /Cenários/.test(t)), 'Drag Warriors separado por tipo: ' + s.subs.join(' | '));
  ok(s.ids.length && s.ids.every(id => /^dw_/.test(id) && indice.sprites[id].tipo === "efeitos") && !s.ids.some(id => /ldr_|toggle/.test(id)), '"Todos: efeitos" do Drag Warriors só tem efeitos (' + s.ids.length + ' sprites, ' + s.info + ')');
  await p.screenshot({ path: OUT + '/2b_seletor_dw_efeitos.png' });
  await p.evaluate(() => document.querySelectorAll('.es-modal').forEach(m => m.remove()));

  // efeitos (todos) inclui a categoria Efeitos do acervo
  await p.evaluate(() => FF.Estudio.escolherSprite({ inicio: 'efeitos', aoEscolher: () => {} }));
  await p.waitForFunction(() => document.querySelectorAll('.es-modal .es-seletor').length && /animaç/.test(document.querySelectorAll('.es-seletor .es-dica')[document.querySelectorAll('.es-seletor .es-dica').length - 1].textContent), null, { timeout: 20000 });
  s = await p.evaluate(() => { const i = document.querySelectorAll('.es-seletor .es-dica'); return i[i.length - 1].textContent; });
  ok(parseInt(s) > 500, '"Efeitos (todos)" soma os efeitos do acervo (' + s + ')');
  await p.screenshot({ path: OUT + '/2_seletor_efeitos.png' });
  await p.close();

  // ---- 3) aba Sprites: lista agrupada e abrir um sprite do acervo
  p = await nova();
  await p.goto('file://' + RAIZ + '/estudio.html?aba=sprites&sprite=zl3_cell');
  await p.waitForFunction(() => FF.Estudio && FF.Estudio.pronto && FF.Estudio.Sprites.st.set, null, { timeout: 30000 });
  s = await p.evaluate(() => ({
    id: FF.Estudio.Sprites.st.id, anims: Object.keys(FF.Estudio.Sprites.st.set.def.anims).length,
    cats: [...document.querySelectorAll('.ess-cat')].map(c => c.textContent),
    itens: document.querySelectorAll('.ess-sprites .es-item').length,
  }));
  ok(s.id === 'zl3_cell' && s.anims === indice.sprites.zl3_cell.anims, 'aba Sprites abre zl3_cell (' + s.anims + ' animações)');
  ok(s.cats.length === 1 + new Set(Object.values(indice.sprites).map(v => v.cat)).size && /Do jogo/.test(s.cats[0]), 'lista agrupada: ' + s.cats.join(' | '));
  await p.screenshot({ path: OUT + '/3_aba_sprites.png' });
  await p.fill('.ess-busca', 'goku');
  s = await p.evaluate(() => [...document.querySelectorAll('.ess-sprites .es-item')].map(i => i.dataset.sprite));
  ok(s.includes('gokubase') && s.includes('zl3_gokuui') && s.includes('zl3_cut_gokussjvsfreeza'), 'busca "goku" acha do jogo e do acervo (' + s.length + ')');
  await p.close();

  await b.close();
  const erros = msgs.filter(m => !/favicon/.test(m));
  // os do teste do sprite inexistente (script do acervo + JSON)
  for (let k = 0; k < 3; k++) { const i = erros.findIndex(m => /ERR_FILE_NOT_FOUND|Failed to fetch|zl3_nao_existe/.test(m)); if (i >= 0) erros.splice(i, 1); }
  console.log(erros.length ? 'console:\n  ' + erros.join('\n  ') : 'console: limpo');
  ok(!erros.length, 'console sem erros');
})();
