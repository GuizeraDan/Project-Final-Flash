// Mede o travamento dos menus de sprites (coluna da esquerda) com as edições do usuário:
// uma mudança nas edições e abrir/fechar um grupo, na aba Sprites e com o seletor de sprites aberto.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route('https://api.github.com/**', r => r.abort());
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=sprites&sprite=mc_b_102&anim=Parado');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Sprites && FF.Estudio.Sprites.st.anim, null, { timeout: 30000 });
  await p.waitForTimeout(1500);
  const medir = (acao) => p.evaluate(async (acao) => {
    let lt = 0; const po = new PerformanceObserver(l => l.getEntries().forEach(e => lt += e.duration)); po.observe({ entryTypes: ['longtask'] });
    if (acao === 'mudar') FF.Edicoes.avisar(); else { const g = [...document.querySelectorAll('[data-chave="pastas"]')].pop(); g && g.click(); }
    await new Promise(r => setTimeout(r, 1200)); po.disconnect(); return Math.round(lt);
  }, acao);
  console.log('aba Sprites: mudança', await medir('mudar'), 'ms · abrir/fechar grupo', await medir('grupo'), 'ms');
  await p.evaluate(() => FF.Estudio.escolherSprite({ titulo: 't', inicio: 'pasta:Personagens/Gohan/Teen', aoEscolher: () => {} }));
  await p.waitForTimeout(2500);
  console.log('seletor aberto: mudança', await medir('mudar'), 'ms · abrir/fechar grupo', await medir('grupo'), 'ms');
  console.log('erros', erros.length ? erros : 'nenhum');
  await b.close();
})();
