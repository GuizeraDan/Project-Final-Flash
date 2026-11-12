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
  ok(!s.ed && s.est && !s.FFed, 'menu Ferramentas sem Editor (com Estúdio) e sem o código do Editor');
  ok(/Estúdio/.test(s.hab), 'botão das habilidades: ' + s.hab);
  await p.goto(R + 'index.html?editor=1&hab=xyz');
  await p.waitForURL(/estudio\.html\?aba=golpes&hab=xyz/, { timeout: 10000 });
  ok(true, 'endereço antigo ?editor=1&hab=… vai para o Estúdio');
  await p.goto(R + 'visualizador.html');
  await p.waitForTimeout(800);
  s = await p.evaluate(() => ({ est: !!document.querySelector('#bt-estudio'), env: !!document.querySelector('#bt-enviar'), links: [...document.querySelectorAll('a')].map(a => a.textContent).join('|') }));
  ok(s.est && !s.env && !/^Editor$|\|Editor\|/.test(s.links), 'visualizador: "Editar no Estúdio" no lugar de "Enviar para o editor" (' + s.links + ')');

  // ---- Estúdio: personagem sem Kamehameha abre o primeiro golpe
  await p.goto(R + 'visualizador.html');
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
