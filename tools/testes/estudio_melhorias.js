// Teste: Editor antigo removido (redireciona para o Estúdio) e melhorias do Estúdio
// (golpe inicial de qualquer personagem, criar habilidade pela Batalha Livre, ações fáceis, pose de vitória).
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const fs = require('fs');
const R = 'file:///home/claude/project-final-flash/';
const OUT = '/tmp/claude-0/melh';
fs.mkdirSync(OUT, { recursive: true });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  const msgs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) msgs.push(m.text()); });
  p.on('pageerror', e => msgs.push('pageerror: ' + e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  const pronto = () => p.waitForFunction(() => FF.Estudio && FF.Estudio.pronto, null, { timeout: 20000 });
  const golpes = () => p.evaluate(() => { const g = FF.Estudio.abas.find(a => a.id === 'golpes'); return { nome: g.doc && g.doc.golpe.nome, tipo: g.doc && g.doc.origem.tipo, at: g.cfg.atacante, alvo: g.cfg.alvo }; });

  let s;
  // ---- jogo: sem Editor
  await p.goto(R + 'index.html');
  s = await p.evaluate(() => ({ ed: !!document.querySelector('[data-acao="editor"]'), est: !!document.querySelector('[data-acao="estudio"]'), FFed: !!window.FF.Editor, hab: document.querySelector('[data-sel="habnova"]').textContent }));
  ok(!s.ed && s.est && !s.FFed, 'jogo sem Editor (com Estúdio) e sem o código do Editor');
  ok(/Estúdio/.test(s.hab), 'botão das habilidades: ' + s.hab);
  await p.goto(R + 'index.html?editor=1&hab=xyz');
  await p.waitForURL(/estudio\.html\?aba=golpes&hab=xyz/, { timeout: 10000 });
  ok(true, 'endereço antigo ?editor=1&hab=… vai para o Estúdio');
  await p.goto(R + 'visualizador.html?sprite=bills&anim=Apontar');
  await p.waitForURL(/estudio\.html\?aba=sprites&sprite=bills&anim=Apontar/, { timeout: 10000 });
  ok(true, 'visualizador.html redireciona para a aba Sprites (mantendo sprite/animação)');
  await p.goto(R + 'index.html');
  s = await p.evaluate(() => ({ vis: !!document.querySelector('[data-acao="visualizador"]'), sub: !!document.querySelector('#ferramentas'), bt: document.querySelector('.titulo-ferramentas').textContent, est: document.querySelector('.titulo-ferramentas').dataset.acao }));
  ok(!s.vis && !s.sub && s.est === 'estudio', 'menu: sem Visualizador; o botão do canto abre o Estúdio (' + s.bt + ')');

  // ---- Estúdio: personagem sem Kamehameha abre o primeiro golpe
  await p.goto(R + 'index.html');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('ff_estudio_golpe_cfg', JSON.stringify({ atacante: 'bills', forma: 'base', alvo: 'raditz', lado: 'heroi', parceiros: [] })); localStorage.setItem('ff_estudio_aba', '"golpes"'); });
  await p.goto(R + 'estudio.html?aba=golpes');
  await pronto(); await p.waitForTimeout(800);
  s = await golpes();
  ok(s.nome === 'Golpes Divinos', 'Bills (sem Kamehameha) abre o primeiro golpe: ' + s.nome);

  // ---- criar habilidade pela Batalha Livre
  await p.goto(R + 'estudio.html?aba=golpes&novo=1&personagem=piccolo&alvo=bills');
  await pronto(); await p.waitForTimeout(800);
  s = await golpes();
  ok(s.tipo === 'novo' && s.at === 'piccolo' && s.alvo === 'bills', 'novo=1&personagem=piccolo&alvo=bills: ' + JSON.stringify(s));

  // ---- ação "objeto" com campos fáceis (supremo do Bills)
  await p.goto(R + 'estudio.html?aba=golpes&personagem=bills&golpe=esfera_destruicao');
  await pronto(); await p.waitForTimeout(800);
  s = await p.evaluate(() => {
    const g = FF.Estudio.abas.find(a => a.id === 'golpes');
    let alvo = null;
    g.doc.linha.trilhas.forEach(tr => tr.clipes.forEach(c => { if (c.tipo === 'acao' && c.passo && c.passo.objeto) alvo = c.id; }));
    g.sel = alvo; g.renderProps();
    return { achou: !!alvo, txt: g.props.textContent };
  });
  ok(s.achou && /Tamanho final/.test(s.txt) && /Tempo crescendo/.test(s.txt), 'ação "Criar objeto" com campos (tamanho, tempo, posição)');
  await p.fill('.es-campo:has-text("Tamanho final") input', '0.9');
  await p.press('.es-campo:has-text("Tamanho final") input', 'Enter');
  s = await p.evaluate(() => { const g = FF.Estudio.abas.find(a => a.id === 'golpes'); return g.clipe().passo.objeto.escala; });
  ok(s[1] === 0.9, 'mudar o tamanho final pelo campo (' + s + ')');
  await p.screenshot({ path: OUT + '/1_objeto.png' });
  s = await p.evaluate(() => {
    const g = FF.Estudio.abas.find(a => a.id === 'golpes');
    let alvo = null;
    g.doc.linha.trilhas.forEach(tr => tr.clipes.forEach(c => { if (c.tipo === 'acao' && c.passo && c.passo.lancarObjeto) alvo = c.id; }));
    g.sel = alvo; g.renderProps();
    return g.props.textContent;
  });
  ok(/Tempo até chegar/.test(s) && /4 acerto/.test(s), 'ação "Lançar objeto" com campos e resumo dos acertos');

  // ---- miniaturas animadas nos campos de efeito (projétil da Rajada de Ki do Bills)
  await p.goto(R + 'estudio.html?aba=golpes&personagem=bills&golpe=rajada_ki');
  await pronto(); await p.waitForTimeout(800);
  await p.evaluate(() => {
    const g = FF.Estudio.abas.find(a => a.id === 'golpes');
    let id = null; g.doc.linha.trilhas.forEach(tr => tr.clipes.forEach(c => { if (c.tipo === 'projetil' && !id) id = c.id; }));
    g.sel = id; g.renderProps();
  });
  await p.waitForTimeout(500);
  s = await p.evaluate(() => [...document.querySelectorAll('.es-aba-golpes .es-mini-anim')].map(cv => {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return { campo: cv.closest('.es-campo').querySelector('.es-rot').textContent, px: n, t: cv.title };
  }));
  const proj = s.find(x => /Projétil/.test(x.campo)), exp = s.find(x => /Explosão/.test(x.campo));
  ok(proj && proj.px > 20 && exp && exp.px > 20, 'miniaturas animadas no projétil e na explosão: ' + JSON.stringify(s.map(x => x.campo + ' ' + x.px)));
  const q1 = await p.evaluate(() => document.querySelector('.es-aba-golpes .es-mini-anim').title);
  await p.screenshot({ path: OUT + '/0_miniaturas.png' });
  // efeitos do próprio Bills aparecem primeiro no seletor
  await p.evaluate(() => [...document.querySelectorAll('.es-aba-golpes .es-campo')].find(c => /Projétil/.test(c.textContent)).querySelector('button').click());
  await p.waitForTimeout(400);
  s = await p.evaluate(() => [...document.querySelectorAll('.es-modal .es-cartao span')].slice(0, 3).map(x => x.textContent));
  ok(/^Bills_/.test(s[0] || ''), 'seletor de efeito mostra os do Bills primeiro (' + s + ')');
  await p.keyboard.press('Escape');
  void q1;

  // ---- Personagens: pose de vitória
  await p.goto(R + 'estudio.html?aba=personagens');
  await pronto(); await p.waitForTimeout(600);
  await p.evaluate(async () => { const P = FF.Estudio.Personagens; await P.selecionar('bills'); P.sub = 'formas'; P.renderSubAbas(); P.renderPainel(); });
  await p.waitForTimeout(300);
  s = await p.evaluate(() => document.querySelectorAll('.ep-vit').length);
  ok(s === 2, 'Pose de vitória do Bills com 2 passos (' + s + ')');
  await p.evaluate(() => { const g = [...document.querySelectorAll('.es-grupo')].find(x => /Pose de vitória/.test(x.textContent)); const t = g.querySelector('.es-grupo-titulo, summary, .es-titulo-grupo'); if (g.classList.contains('fechado') && t) t.click(); });
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === '＋ Passo').click());
  s = await p.evaluate(() => ({ n: document.querySelectorAll('.ep-vit').length, v: FF.Estudio.Personagens.forma().vitoria.length }));
  ok(s.n === 3 && s.v === 3, '＋ Passo acrescenta na pose (' + JSON.stringify(s) + ')');
  await p.screenshot({ path: OUT + '/2_vitoria.png' });
  // personagem sem vitória: abrir não deixa "não salvo"
  await p.evaluate(async () => { const P = FF.Estudio.Personagens; await P.selecionar('saibaman'); P.sub = 'formas'; P.renderPainel(); });
  s = await p.evaluate(() => document.querySelector('.es-aba-personagens').textContent);
  ok(!/não salv/i.test(s.split('Pose')[0] || ''), 'abrir a aba Formas não marca mudança');

  console.log('console:', msgs.length ? '\n  ' + msgs.join('\n  ') : 'limpo');
  ok(!msgs.filter(m => !/Failed to load resource/.test(m)).length, 'console sem erros');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
