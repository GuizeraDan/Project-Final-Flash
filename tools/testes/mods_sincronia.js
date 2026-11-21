// Teste: sprites já carregados acompanham as edições (FF.Mods.sincronizar) — animação restaurada/apagada fora da página.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route('https://api.github.com/**', r => r.abort());
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto('file://' + process.cwd() + '/estudio.html');
  await p.waitForFunction(() => FF.Estudio.pronto, null, { timeout: 20000 });
  const r = await p.evaluate(async () => {
    // página aberta com 3 animações apagadas (como estava no GitHub)
    const ap = { Soco1: { apagada: true }, Soco2: { apagada: true }, Parado: { apagada: true } };
    window.FF_EDICOES.sprites.mc_b_102 = JSON.parse(JSON.stringify(ap)); FF.Edicoes._cache = null;
    const s = await FF.Assets.loadSprite('mc_b_102'); const out = [Object.keys(s.def.anims).length];
    // chega a versão do GitHub em que elas foram restauradas (ex.: depois de um envio)
    const novo = JSON.parse(JSON.stringify(window.FF_EDICOES)); delete novo.sprites.mc_b_102; novo.rev = (novo.rev || 0) + 1;
    window.FF_EDICOES = novo; FF.Edicoes._cache = null; FF.Edicoes.avisar();
    await new Promise(r => setTimeout(r, 50)); out.push(Object.keys(s.def.anims).length);
    // e o contrário: apagada em outro aparelho
    const n2 = JSON.parse(JSON.stringify(novo)); n2.sprites.mc_b_102 = { Victory: { apagada: true } }; window.FF_EDICOES = n2; FF.Edicoes._cache = null; FF.Edicoes.avisar();
    await new Promise(r => setTimeout(r, 50)); out.push(Object.keys(s.def.anims).length, s.has('Victory'));
    return out;
  });
  console.log(r, erros);
  await b.close();
})();
