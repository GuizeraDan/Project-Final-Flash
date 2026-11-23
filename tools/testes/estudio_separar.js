// Teste do ⇱ Separar em sprite próprio (js/estudio/separar.js): Acao_1551 do Androide 18 numa pasta vira um sprite só dela.
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const RAIZ = require('path').resolve(__dirname, '..', '..');
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--allow-file-access-from-files'] });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const msgs = [];
  p.on('pageerror', e => msgs.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + RAIZ + '/estudio.html?aba=sprites&sprite=bills&anim=Parado');
  await p.waitForFunction(() => FF.Estudio && FF.Estudio.pronto && FF.Estudio.Sprites.st.set, null, { timeout: 20000 });
  // pasta de teste com a animação do Androide 18 (e ⭐)
  const A = 'zl3_android18', N = await p.evaluate(async (A) => { const s = await FF.Assets.loadSprite(A); return Object.keys(s.def.anims).find(n => s.def.anims[n].frames.length > 3); }, A);
  await p.evaluate(([A, N]) => { FF.Edicoes.set(['favoritosPastas', 'ZZ Rajadas'], [A + '#' + N]); FF.Edicoes.set(['favoritosPastas', 'ZZ Outra'], [A + '#' + N]); FF.Edicoes.set(['favoritos', A + '#' + N], 'efeitos'); }, [A, N]);
  await p.fill('.ess-busca >> nth=0', N);
  const linha = p.locator('.es-nav-anim[data-sprite="' + A + '"][data-anim="' + N + '"]').first();
  await linha.waitFor({ timeout: 15000 });
  await linha.hover();
  await linha.locator('.es-nav-separar').click();
  await p.uncheck('.es-separar-ck input');   // este caso: manter no original
  await p.click('.es-separar .es-escolha-bts button:has-text("⇱ Separar")');
  await p.waitForFunction((A) => FF.Estudio.Sprites.st.id.startsWith('sep_'), A, { timeout: 15000 });
  const r = await p.evaluate(async ([A, N]) => {
    const st = FF.Estudio.Sprites.st, id = st.id, nov = FF.Edicoes.dados().spritesNovos[id], info = FF.Assets.infoSprite(id), P = FF.Edicoes.dados().favoritosPastas;
    const orig = await FF.Assets.loadSprite(A);
    const px = (set, f) => { const c = document.createElement('canvas'); c.width = 300; c.height = 300; FF.drawFrame(c.getContext('2d'), set, f, 150, 200, 1, false); return Array.from(c.getContext('2d').getImageData(0, 0, 300, 300).data).join(); };
    const a = st.set.def.anims[N], o = orig.def.anims[N];
    return {
      id, nAnims: Object.keys(st.set.def.anims).length, lista: document.querySelectorAll('.ess-anims .ess-anim:not(.ess-apagada)').length,
      iguais: a.frames.length === o.frames.length && a.frames.every((f, k) => px(st.set, f) === px(orig, o.frames[k])),
      semCopia: nov.atlases.every(x => orig.def.atlases.includes(x)) && !nov.atlases.some(x => /usr\//.test(x)),
      pasta: info.pasta, nome: info.nome, r1: P['ZZ Rajadas'], r2: P['ZZ Outra'],
      fav: FF.Edicoes.dados().favoritos[id], favVelho: FF.Edicoes.dados().favoritos[A + '#' + N] || null,
      origOk: !!orig.def.anims[N] && Object.keys(orig.def.anims).length > 50,
    };
  }, [A, N]);
  ok(r.nAnims === 1 && r.lista === 1, 'sprite novo ' + r.id + ' só com a animação (lista: ' + r.lista + ')');
  ok(r.iguais, 'quadros iguais aos do original');
  ok(r.semCopia, 'usa as mesmas imagens do original (sem copiar)');
  ok(['ZZ Rajadas', 'ZZ Outra'].includes(r.pasta) && r.nome === N, 'mora na pasta de onde veio o clique (' + r.pasta + ') com o nome da animação');
  const [mora, outra] = r.pasta === 'ZZ Rajadas' ? [r.r1, r.r2] : [r.r2, r.r1];
  ok(Array.isArray(mora) && !mora.length && JSON.stringify(outra) === JSON.stringify([r.id]), 'atalhos trocados nas pastas (onde mora: sai o atalho; na outra: atalho do sprite novo)');
  ok(r.fav === 'efeitos' && !r.favVelho, '⭐ passa para o sprite novo');
  ok(r.origOk, 'Androide 18 continua com todas as animações');
  await p.reload();
  await p.waitForFunction(() => FF.Estudio && FF.Estudio.pronto && FF.Estudio.Sprites.st.set, null, { timeout: 20000 });
  ok(await p.evaluate(async (id) => { FF.Assets.descarregarSprite(id); const s = await FF.Assets.loadSprite(id); return Object.keys(s.def.anims).length === 1 && s.images.every(i => i && i.width > 0); }, r.id), 'depois de recarregar continua valendo');
  // separar pela barra de marcadas da lista de animações
  await p.evaluate(() => FF.Estudio.Sprites.abrirSprite('bills', 'Parado', true));
  await p.waitForFunction(() => FF.Estudio.Sprites.st.id === 'bills');
  const n2 = await p.evaluate(() => Object.keys(FF.Estudio.Sprites.st.set.def.anims)[1]);
  await p.click('.ess-anims .ess-anim[data-anim="' + n2 + '"] .ess-anim-chk');
  await p.click('.ess-separar-anims');
  ok(!(await p.isChecked('.es-separar-ck input')), 'sprite do jogo: "tirar do original" vem desmarcado');
  await p.click('.es-separar .es-escolha-bts button:has-text("⇱ Separar")');
  await p.waitForFunction(() => FF.Estudio.Sprites.st.id.startsWith('sep_') && FF.Estudio.Sprites.st.id !== 'x', null, { timeout: 10000 });
  ok(await p.evaluate((n2) => FF.Estudio.Sprites.st.nome === n2 && Object.keys(FF.Estudio.Sprites.st.set.def.anims).length === 1, n2), 'separar pela barra das animações marcadas abre o sprite novo');
  // Organizar: dentro do Bills (Twiss), marcar "bola" e separar para a pasta aberta à direita (sai do Bills)
  await p.evaluate(() => { FF.Edicoes.set(['favoritosPastas', 'ZZ Assets'], []); FF.Estudio.rascunho.gravar('org_pasta', 'ZZ Assets'); FF.Estudio.rascunho.gravar('org_cat', 'twiss'); FF.EstudioOrganizar.abrir(); });
  await p.waitForSelector('.es-org-grade');
  const semP2 = p.locator('.es-org-filtros input[type="checkbox"]'); if (await semP2.isChecked()) await semP2.click();
  await p.dblclick('.es-org-card[data-id="twiss_beerus"]');
  await p.waitForSelector('.es-org-anim[data-k="twiss_beerus#bola"]');
  ok(await p.isHidden('.es-org-separar'), '⇱ Separar escondido sem animação marcada');
  await p.click('.es-org-anim[data-k="twiss_beerus#bola"]');
  ok(/ZZ Assets/.test(await p.textContent('.es-org-separar')), 'botão mostra a pasta de destino: ' + await p.textContent('.es-org-separar'));
  await p.click('.es-org-separar');
  ok(await p.isChecked('.es-separar-ck input'), '"Tirar do sprite original" vem marcado (sprite do acervo)');
  await p.click('.es-separar .es-escolha-bts button:has-text("⇱ Separar")');
  await p.waitForFunction(() => Object.values(FF.Edicoes.dados().spritesNovos || {}).some(d => d.separadoDe === 'twiss_beerus#bola'), null, { timeout: 10000 });
  await p.waitForTimeout(400);
  const ro = await p.evaluate(() => {
    const id = Object.keys(FF.Edicoes.dados().spritesNovos).find(k => FF.Edicoes.dados().spritesNovos[k].separadoDe === 'twiss_beerus#bola');
    return { id, pasta: FF.Assets.infoSprite(id).pasta, apagada: FF.Mods.apagadas('twiss_beerus').includes('bola'), naGrade: !!document.querySelector('.es-org-anim[data-k="twiss_beerus#bola"]'),
      noPainel: [...document.querySelectorAll('.es-org-item .es-org-nome')].some(e => e.textContent === 'bola') };
  });
  ok(ro.pasta === 'ZZ Assets', 'sprite novo ' + ro.id + ' mora em "ZZ Assets"');
  ok(ro.apagada && !ro.naGrade, '"bola" saiu do Bills (está em Apagadas dele)');
  ok(ro.noPainel, 'aparece no painel "Dentro de ZZ Assets"');
  ok(!msgs.length, 'sem erros na página' + (msgs.length ? ': ' + msgs.join(' | ') : ''));
  await b.close();
})();
