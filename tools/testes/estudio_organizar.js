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
    await p.click('.es-org-novabt');
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
    await p.waitForTimeout(300);
    const nItens = await p.locator('.es-org-item').count();
    ok(nItens === 4, 'a pasta aberta mostra o que tem dentro: ' + nItens);
    await p.screenshot({ path: require('os').tmpdir() + '/ff_org3.png' });
    const itemCell = p.locator('.es-org-item').filter({ has: p.locator('.es-org-nome[title="zl3_cell"]') });
    await itemCell.hover();
    await itemCell.locator('.es-org-tirar').click();
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => FF.Favoritos.movidos('ZZ Teste Org').length === 3) && (await p.locator('.es-org-item').count()) === 3, '↩ tira o sprite da pasta');
    // duplo clique no sprite: animações dele; mover 2 para outra pasta (opção A: saem da pasta do sprite inteiro)
    await p.click('.es-org-voltar').catch(() => {});
    await p.evaluate(() => FF.Favoritos.criarPasta('ZZ Efeitos'));
    await p.waitForTimeout(200);
    await p.dblclick('.es-org-card[data-id="zl3_bills"]');
    await p.waitForSelector('.es-org-anim');
    const nA = await p.locator('.es-org-anim').count();
    ok(nA > 10, 'duplo clique abre as animações do sprite: ' + nA);
    const ks = await p.evaluate(() => [...document.querySelectorAll('.es-org-anim')].slice(0, 2).map(x => x.dataset.k));
    await p.click('.es-org-anim[data-k="' + ks[0] + '"]');
    await p.click('.es-org-anim[data-k="' + ks[1] + '"]');
    await p.fill('.es-org-dir input[type="search"]', 'zz efeitos');
    await p.click('.es-org-pasta[data-pasta="ZZ Efeitos"]');
    await p.waitForTimeout(400);
    const mv = await p.evaluate((ks) => ks.map(k => FF.Favoritos.pastasDe(k.split('#')[0], k.split('#')[1])), ks);
    ok(mv.every(l => l.length === 1 && l[0] === 'ZZ Efeitos'), 'animações movidas para a pasta: ' + JSON.stringify(mv));
    await p.screenshot({ path: require('os').tmpdir() + '/ff_org4.png' });
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    const grade = await p.evaluate(async (ks) => {
      FF.Estudio.escolherSprite({ titulo: 't', inicio: 'pasta:ZZ Teste Org', aoEscolher: () => {} });
      await new Promise(r => setTimeout(r, 2500));
      const cards = [...document.querySelectorAll('.es-seletor .es-cartao[data-k]')].map(k => k.dataset.k);
      const bills = cards.filter(k => k.startsWith('zl3_bills'));
      return { total: cards.length, bills: bills.length, temMovidas: ks.filter(k => cards.some(c => c === k || c === k.replace('#', '|'))) };
    }, ks);
    ok(grade.bills > 10 && !grade.temMovidas.length, 'seletor: na pasta do sprite inteiro as animações movidas não aparecem (' + JSON.stringify(grade) + ')');
    // vistas das pastas: compacta / lista com capa / capas
    await p.evaluate(() => { FF.Estudio.EstOrgTeste = FF.EstudioOrganizar.abrir(); });
    await p.waitForSelector('.es-org-vistas button');
    for (const v of ['compacta', 'capa', 'grade']) {
      await p.click('.es-org-vistas button[data-vista="' + v + '"]');
      await p.waitForTimeout(700);
      const r2 = await p.evaluate((v) => ({ n: document.querySelectorAll('.es-org-pasta.v-' + v).length, capas: [...document.querySelectorAll('.es-org-capa')].length, vista: document.querySelector('.es-org-pastas').dataset.vista }), v);
      ok(r2.vista === v && r2.n > 0 && (v === 'compacta' ? r2.capas === 0 : r2.capas > 0), 'vista "' + v + '": ' + JSON.stringify(r2));
      await p.screenshot({ path: require('os').tmpdir() + '/ff_org_vista_' + v + '.png' });
    }
    // letras: entra em Personagens (se houver) e pula para uma letra
    const letr = await p.evaluate(async () => {
      const r = document.querySelector('.es-org-pasta[data-pasta="Personagens"]');
      if (r) r.click();
      await new Promise(x => setTimeout(x, 300));
      const bts = [...document.querySelectorAll('.es-org-letra:not(.vazia)')];
      if (bts.length < 3) return { pulou: 'sem letras suficientes', n: bts.length };
      const b = bts[bts.length - 1]; b.click();
      await new Promise(x => setTimeout(x, 100));
      const caixa = document.querySelector('.es-org-pastas'), cb = caixa.getBoundingClientRect();
      const alvo = [...caixa.querySelectorAll('.es-org-pasta.piscar')][0];
      const r2 = alvo && alvo.getBoundingClientRect();
      return { letra: b.textContent, primeiraVisivel: alvo && FF.Favoritos.folha(alvo.dataset.pasta), visivel: !!r2 && r2.top >= cb.top - 1 && r2.bottom <= cb.bottom + 1 };
    });
    ok(letr.pulou || (letr.visivel && letr.primeiraVisivel.toUpperCase().startsWith(letr.letra)), 'letras pulam para a pasta: ' + JSON.stringify(letr));
    ok(!erros.length, 'console: ' + erros.join(' | '));
  } catch (e) { falhas++; console.log('FALHOU: ' + e.message); }
  await b.close();
  process.exit(falhas ? 1 : 0);
})();
