// Teste da aba Sprites do Estúdio (só edição: sem importar/exportar) + Bills nas abas Personagens e Golpes
// (Playwright + Chrome)
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const RAIZ = '/home/claude/project-final-flash';
const OUT = '/tmp/claude-0/spr';
fs.mkdirSync(OUT, { recursive: true });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--allow-file-access-from-files'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const msgs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) msgs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => msgs.push('pageerror: ' + e.message));
  let gh = 0;
  await p.route('https://api.github.com/**', r => { gh++; r.abort(); });
  await p.goto('file://' + RAIZ + '/estudio.html?aba=sprites&sprite=bills&anim=Parado');
  await p.waitForFunction(() => FF.Estudio && FF.Estudio.pronto && FF.Estudio.Sprites.st.set, null, { timeout: 20000 });
  const sp = 'FF.Estudio.Sprites';

  // ---- 0) sem importar/exportar
  let s = await p.evaluate(() => ({
    abas: FF.Estudio.abas.map(a => a.id).join(),
    bts: [...document.querySelectorAll('.es-aba-sprites button')].map(b => b.textContent).join(' | '),
  }));
  ok(!/importar/.test(s.abas), 'sem aba Importar (' + s.abas + ')');
  ok(!/Exportar|Importar|computador/.test(s.bts), 'aba Sprites sem botões de importar/exportar');

  // ---- 1) Bills aberto na aba Sprites
  s = await p.evaluate(() => { const st = FF.Estudio.Sprites.st; return { id: st.id, nome: st.nome, n: Object.keys(st.set.def.anims).length, q: st.anim.frames.length }; });
  ok(s.id === 'bills' && s.nome === 'Parado' && s.n === 44 && s.q === 2, 'bills / Parado aberto (' + JSON.stringify(s) + ')');
  await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/1_bills.png' });

  // editar fps e salvar → sprites.bills.Parado
  await p.fill('.ess-props .es-campo:has-text("fps") input', '4');
  await p.press('.ess-props .es-campo:has-text("fps") input', 'Enter');
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('Control+s');
  s = await p.evaluate(() => FF.Edicoes.dados().sprites.bills && FF.Edicoes.dados().sprites.bills.Parado);
  ok(s && s.fps === 4, 'editar e salvar uma animação do Bills (fps 4)');

  // redimensionar (sprite do jogo → atlas extra em spritesInfo)
  await p.evaluate(() => FF.Estudio.Sprites.abrirAnim('Apontar'));
  s = await p.evaluate(async () => { const st = FF.Estudio.Sprites.st, f0 = st.anim.frames[0].slice(); await FF.Estudio.Sprites.redimensionar(2, true); return { f0, f1: st.anim.frames[0], info: FF.Edicoes.dados().spritesInfo.bills }; });
  ok(s.f1[3] === s.f0[3] * 2 && s.f1[6] === s.f0[6] * 2 && s.info && s.info.atlas.length === 1, 'redimensionar 200% (' + s.f0.slice(3, 7) + ' → ' + s.f1.slice(3, 7) + ')');
  ok(s.f1[8] && s.f1[8][0][0] === s.f0[8][0][0] * 2, 'ponto de disparo acompanha');
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('Control+z');
  ok(await p.evaluate(() => FF.Estudio.Sprites.st.anim.frames[0][3] < 40), 'Ctrl+Z desfaz o redimensionar');

  // ---- 2) sprite importado (já existente): salvar como nova, renomear, última animação, juntar, apagar
  await p.evaluate(async () => {
    const I = FF.Imagem, a = I.criar(10, 20); a.rgba.fill(255);
    await FF.EstudioArq.gravarSprite('teste_spr', { Parado: { fps: 8, loop: true, frames: [{ img: a, ox: 5, oy: 20, dur: 1 }] } }, { tipo: 'lutador' });
    await FF.Estudio.Sprites.abrirSprite('teste_spr', 'Parado', true);
  });
  await p.click('.ess-barra button:has-text("Salvar como nova")');
  await p.fill('.es-modal input', 'Parado2');
  await p.click('.es-modal .es-bt-ouro');
  await p.waitForFunction(() => FF.Estudio.Sprites.st.nome === 'Parado2');
  s = await p.evaluate(() => { const d = FF.Edicoes.dados(); return { anims: Object.keys(d.spritesNovos.teste_spr.anims), mod: !!d.sprites.teste_spr }; });
  ok(s.anims.join() === 'Parado,Parado2' && !s.mod, '"Salvar como nova" num sprite importado entra no próprio sprite');
  await p.click('.ess-anim[data-anim="Parado2"] .ess-anim-ren');
  await p.fill('.es-modal input', 'Parado Dois');
  await p.click('.es-modal .es-bt-ouro');
  await p.waitForFunction(() => Object.keys(FF.Edicoes.dados().spritesNovos.teste_spr.anims).join() === 'Parado,Parado_Dois', null, { timeout: 5000 });
  ok(true, 'renomear (Parado,Parado_Dois)');
  s = await p.evaluate(async () => { await FF.Estudio.Sprites.redimensionar(3, true); FF.Estudio.Sprites.salvar(); return FF.Edicoes.dados().spritesNovos.teste_spr.atlases.length; });
  ok(s === 2, 'redimensionar num importado cria atlas extra');
  await p.click('.ess-props button:has-text("Juntar imagens")');
  await p.waitForFunction(() => FF.Edicoes.dados().spritesNovos.teste_spr.atlases.length === 1, null, { timeout: 10000 });
  s = await p.evaluate(() => FF.Edicoes.dados().spritesNovos.teste_spr.anims.Parado_Dois.frames[0].slice(0, 7));
  ok(s[0] === 0 && s[3] === 30 && s[4] === 60, 'juntar imagens mantém o tamanho (' + s + ')');
  await p.click('.ess-anim[data-anim="Parado"] .ess-anim-apagar:not(.ess-anim-ren)');
  await p.click('.es-modal .es-bt-perigo');
  await p.waitForFunction(() => Object.keys(FF.Edicoes.dados().spritesNovos.teste_spr.anims).join() === 'Parado_Dois');
  await p.click('.ess-anim[data-anim="Parado_Dois"] .ess-anim-apagar:not(.ess-anim-ren)');
  s = await p.evaluate(() => document.querySelector('.es-modal p') && document.querySelector('.es-modal p').textContent);
  ok(/única animação/.test(s || ''), 'última animação: pergunta se apaga o sprite');
  await p.click('.es-modal .es-bt-perigo');
  await p.waitForFunction(() => !FF.Edicoes.dados().spritesNovos.teste_spr && FF.Estudio.Sprites.st.id !== 'teste_spr', null, { timeout: 5000 });
  ok(true, 'sprite importado apagado');

  // ---- 3) Bills nas abas Personagens e Golpes
  await p.evaluate(() => FF.Estudio.abrir('personagens'));
  await p.waitForTimeout(400);
  s = await p.evaluate(() => ({ lista: FF.Assets.listaPersonagens(), txt: document.querySelector('.es-aba-personagens').textContent }));
  ok(s.lista.includes('bills') && /Bills/.test(s.txt), 'Bills aparece em Personagens');
  await p.screenshot({ path: OUT + '/2_personagens.png' });
  await p.goto('file://' + RAIZ + '/estudio.html?aba=golpes&personagem=bills&golpe=esfera_destruicao');
  await p.waitForFunction(() => FF.Estudio && FF.Estudio.pronto, null, { timeout: 20000 });
  await p.waitForTimeout(1200);
  s = await p.evaluate(() => document.querySelector('.es-aba-golpes').textContent);
  ok(/Esfera da Destruição/.test(s) && /Golpes Divinos/.test(s), 'golpes do Bills na aba Golpes e cenas');
  await p.screenshot({ path: OUT + '/3_golpes.png' });

  ok(gh === 0, 'nenhuma chamada ao GitHub (' + gh + ')');
  console.log('console:', msgs.length ? '\n  ' + msgs.join('\n  ') : 'limpo');
  ok(!msgs.length, 'console sem erros/avisos');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
