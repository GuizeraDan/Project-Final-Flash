// Teste do "🗂 Organizar acervo" (aba Sprites): tela dividida, marcar, mover para pasta, nova pasta, sugestões por nome.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 900 } });
  await ctx.route('https://api.github.com/**', r => r.abort());
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'ok: ' : 'FALHOU: ') + m); };
  try {
    await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=sprites');
    await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Sprites, null, { timeout: 30000 });
    await p.click('button.ess-organizar');
    await p.waitForSelector('.es-org-grade', { timeout: 10000 }); console.log('abriu: ' + await p.textContent('.es-org-info'));
    // ZL3 · Personagens, só sem pasta desligado para ter cartões conhecidos
    await p.evaluate(() => { localStorage.clear(); });
    await p.selectOption('.es-org-filtros select >> nth=0', 'personagens');
    await p.selectOption('.es-org-filtros select >> nth=1', '');
    const semPasta = p.locator('.es-org-filtros input[type="checkbox"]');
    if (await semPasta.isChecked()) await semPasta.click();
    await p.waitForTimeout(300);
    const n = await p.locator('.es-org-card').count();
    ok(n > 20, 'cartões do ZL3 · Personagens: ' + n);
    await p.waitForTimeout(800);
    await p.screenshot({ path: require('os').tmpdir() + '/ff_org1.png' });
    // sugestões por nome
    await p.click('button:has-text("Sugerir por nome")');
    await p.waitForTimeout(200);
    const chips = await p.locator('.es-org-chip').allTextContents();
    ok(chips.some(t => /^Goku \d+/.test(t)) && chips.some(t => /^Vegeta \d+/.test(t)), 'sugestões: ' + chips.slice(0, 8).join(' | '));
    const sugGoku = await p.evaluate(() => [...document.querySelectorAll('.es-org-card')].filter(k => /Goku$/.test((k.querySelector('.es-org-sugcard') || {}).textContent || '')).map(k => k.dataset.id));
    ok(sugGoku.includes('zl3_gokubase') && !sugGoku.includes('zl3_gokublackrose') && !sugGoku.includes('zl3_gohanbeast'), 'Goku Black e Gohan não caem em Goku: ' + sugGoku.slice(0, 6).join(','));
    await p.screenshot({ path: require('os').tmpdir() + '/ff_org2.png' });
    // nova pasta de teste e mover 2 marcados para ela
    await p.click('.es-org-card[data-id="zl3_cell"]');
    await p.click('.es-org-card[data-id="zl3_cooler"]', { modifiers: [] });
    await p.click('.es-org-nova');
    await p.waitForSelector('.es-perg input');
    await p.fill('.es-perg input', 'ZZ Teste Org');
    await p.click('.es-perg button:has-text("OK")');
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => ({ cell: FF.Assets.infoSprite('zl3_cell').pasta, cooler: FF.Assets.infoSprite('zl3_cooler').pasta, existe: !!FF.Favoritos.pastas()['ZZ Teste Org'] }));
    ok(r.cell === 'ZZ Teste Org' && r.cooler === 'ZZ Teste Org' && r.existe, 'nova pasta já recebe os marcados: ' + JSON.stringify(r));
    // "só sem pasta" esconde os dois
    await semPasta.click();
    await p.waitForTimeout(300);
    ok(!(await p.locator('.es-org-card[data-id="zl3_cell"]').count()), '"Só sem pasta" esconde o que foi movido');
    // clicar na pasta com marcado move; sem marcado entra
    await semPasta.click(); await p.waitForTimeout(300);
    await p.click('.es-org-card[data-id="zl3_freeza"]');
    await p.click('.es-org-pasta[data-pasta="ZZ Teste Org"]');
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => FF.Assets.infoSprite('zl3_freeza').pasta === 'ZZ Teste Org'), 'clicar na pasta com um marcado move');
    await p.click('.es-org-pasta[data-pasta="ZZ Teste Org"]');
    await p.waitForTimeout(200);
    ok((await p.locator('.es-org-tri').allTextContents()).join('>') === 'Minhas pastas>ZZ Teste Org', 'clicar sem marcados abre a pasta (trilha)');
    // arrastar um cartão para "Pôr aqui"
    await p.dragAndDrop('.es-org-card[data-id="zl3_bills"]', '.es-org-aqui');
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => FF.Favoritos.movidos('ZZ Teste Org').length === 4), 'arrastar o cartão até a pasta move');
    await p.screenshot({ path: require('os').tmpdir() + '/ff_org3.png' });
    ok(!erros.length, 'console: ' + erros.join(' | '));
  } catch (e) { falhas++; console.log('FALHOU: ' + e.message); }
  await b.close();
  process.exit(falhas ? 1 : 0);
})();
