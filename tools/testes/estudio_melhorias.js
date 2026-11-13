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

  // ---- explosões do impacto viram clipes presos ao lançamento
  await p.goto(R + 'estudio.html?aba=golpes&personagem=goku&golpe=genkidama');
  await pronto(); await p.waitForTimeout(800);
  s = await p.evaluate(() => {
    const g = FF.Estudio.abas.find(a => a.id === 'golpes');
    const ef = g.doc.linha.trilhas.find(t => t.tipo === 'efeitos').clipes.filter(c => c.prende);
    let lan = null; g.doc.linha.trilhas.forEach(tr => tr.clipes.forEach(c => { if (c.passo && c.passo.lancarObjeto) lan = c; }));
    return { n: ef.length, fx: ef.map(c => c.fx), t: ef.map(c => c.t), lanT: lan.t, tempo: lan.passo.lancarObjeto.tempo, imp: lan.passo.lancarObjeto.impacto.length, sujo: g.sujo };
  });
  ok(s.n === 3 && s.fx.join() === 'genkidama_chao,genkidama_explosao,Explosao15' && Math.abs(s.t[0] - (s.lanT + s.tempo)) < 0.002 && s.imp === 0 && !s.sujo, 'explosões do impacto aparecem na trilha Efeitos no tempo da chegada: ' + JSON.stringify(s));
  s = await p.evaluate(() => {
    const g = FF.Estudio.abas.find(a => a.id === 'golpes');
    let lan = null; g.doc.linha.trilhas.forEach(tr => tr.clipes.forEach(c => { if (c.passo && c.passo.lancarObjeto) lan = c; }));
    g.sel = lan.id; lan.t += 0.5; g.mudou('Mover');
    const ef = g.doc.linha.trilhas.find(t => t.tipo === 'efeitos').clipes.filter(c => c.prende);
    const r1 = ef[0].t - lan.t - lan.passo.lancarObjeto.tempo + 1;
    g.sel = ef[1].id; ef[1].t += 0.2; g.mudou('Mover');
    const r2 = ef[1].extra;
    g.sel = lan.id; lan.passo.lancarObjeto.tempo = 1.5; g.mudou('Lançar');
    return { r1, r2, t1: ef[1].t - lan.t };
  });
  ok(Math.abs(s.r1 - 1) < 0.002 && Math.abs(s.r2 - 0.2) < 0.002 && Math.abs(s.t1 - 1.7) < 0.002, 'mover o lançamento leva as explosões; arrastar uma guarda o ajuste: ' + JSON.stringify(s));
  s = await p.evaluate(() => { const g = FF.Estudio.abas.find(a => a.id === 'golpes'); let lan = null; g.doc.linha.trilhas.forEach(tr => tr.clipes.forEach(c => { if (c.passo && c.passo.lancarObjeto) lan = c; })); g.sel = lan.id; g.renderProps(); return g.props.textContent; });
  ok(/Explosões no impacto/.test(s) && /genkidama_explosao/.test(s), 'o Lançar objeto lista as explosões presas');
  s = await p.evaluate(() => {
    const g = FF.Estudio.abas.find(a => a.id === 'golpes'); g.tl.render();
    const tr = g.doc.linha.trilhas.find(t => t.tipo === 'efeitos'), ef = tr.clipes.filter(c => c.prende);
    const row = g.tl.lay.rows.find(r => r.tr === tr);
    // clique na 2ª camada acha a 2ª explosão
    const c2 = ef.find(c => g.tl.lay.lane.get(c) === 1);
    const hit = c2 && g.tl.achar({ x: c2.t * g.tl.pxs + 5, y: row.y + g.tl.LH + 8 });
    return { camadas: ef.map(c => g.tl.lay.lane.get(c)), n: row.n, h: row.h, hit: hit && hit.c === c2, nomeH: document.querySelectorAll('.es-tl-nome')[g.doc.linha.trilhas.indexOf(tr)].offsetHeight };
  });
  ok(s.camadas.slice().sort().join() === '0,1,2' && s.n >= 3 && s.hit && s.nomeH === s.h, 'efeitos ao mesmo tempo ficam um embaixo do outro (camadas ' + s.camadas + ', trilha com ' + s.n + ' linhas; clique na 2ª acha o clipe)');
  await p.evaluate(() => { const g = FF.Estudio.abas.find(a => a.id === 'golpes'); let lan = null; g.doc.linha.trilhas.forEach(tr => tr.clipes.forEach(c => { if (c.passo && c.passo.lancarObjeto) lan = c; })); g.irPara(lan.t + lan.passo.lancarObjeto.tempo + 0.15); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/0b_impacto.png' });
  // ghost da explosão do projétil (Rajada de Ki)
  await p.goto(R + 'estudio.html?aba=golpes&personagem=bills&golpe=rajada_ki');
  await pronto(); await p.waitForTimeout(800);
  s = await p.evaluate(() => FF.Estudio.abas.find(a => a.id === 'golpes').tl._fantasmas.length);
  ok(s >= 2, 'marcas das explosões dos projéteis na trilha Efeitos (' + s + ')');

  // ---- guias de alinhamento ao arrastar um clipe
  s = await p.evaluate(() => {
    const g = FF.Estudio.abas.find(a => a.id === 'golpes'); g.tl.render();
    const todos = g.tl.todos().filter(({ c, tr }) => g.tl.host.dur(c, tr) > 0.05);
    const a = todos[0], b = todos.find(x => x.tr !== a.tr);
    a.c.t = Math.round((b.c.t + 0.4) * 1000) / 1000; g.tl.render();   // longe do alvo
    const r = g.tl.cv.getBoundingClientRect();
    return { x: r.left + a.c.t * g.tl.pxs + 6, y: r.top + g.tl.yDe(a.c, a.tr) + 10, alvoX: r.left + b.c.t * g.tl.pxs + 6, idA: a.c.id, tB: b.c.t, tA: a.c.t, trA: a.tr.id, trB: b.tr.id, scroll: g.tl.area.scrollLeft, cvw: r.width, rl: r.left };
  });
  await p.mouse.move(s.x, s.y); await p.mouse.down();
  await p.mouse.move(s.x - 20, s.y, { steps: 3 }); await p.mouse.move(s.alvoX + 2, s.y, { steps: 8 });
  const guias = await p.evaluate((id) => { const g = FF.Estudio.abas.find(a => a.id === 'golpes'); const a = g.tl.host.achar(id); return { guias: (g.tl.guias || []).map(x => ({ t: x.t, n: x.linhas.length })), t: a.c.t }; }, s.idA);
  await p.screenshot({ path: OUT + '/0c_guias.png' });
  await p.mouse.up();
  const depois = await p.evaluate(() => FF.Estudio.abas.find(a => a.id === 'golpes').tl.guias);
  ok(Math.abs(guias.t - s.tB) < 0.002 && guias.guias.some(x => Math.abs(x.t - s.tB) < 0.002 && x.n >= 2) && !depois, 'arrastar um clipe até o início de outro mostra a guia de alinhamento (' + JSON.stringify(guias) + ') e some ao soltar');

  // ---- teleporte para qualquer ponto da tela (X e altura), com alça no palco
  s = await p.evaluate(() => {
    const g = FF.Estudio.abas.find(a => a.id === 'golpes');
    const tr = g.doc.linha.trilhas.find(t => t.id === 'atacante');
    const c = { id: 'tpteste', tipo: 'teleporte', t: 0.05, para: 'x', x: 600, y: -120 };
    tr.clipes.push(c); g.sel = c.id; g.mudou('teste'); g.irPara(0.6); g.renderProps();
    const f = g.palco._b.atk, al = g.alcas().find(h => h.k === 'destino');
    const r = { x: Math.round(f.x - (FF.W - 1084) / 2), y: Math.round(f.y - f.groundY), alca: !!al, props: g.props.textContent };
    tr.clipes.splice(tr.clipes.indexOf(c), 1); g.sel = null; g.mudou('teste');
    return r;
  });
  ok(s.x === 600 && s.y === -120 && s.alca && /Altura \(Y\)/.test(s.props), 'teleporte para qualquer ponto da tela: lutador em x=' + s.x + ' y=' + s.y + ', alça no palco ' + s.alca);

  // ---- cena de KO: padrão + própria do alvo, editada e salva no Estúdio
  s = await p.evaluate(async () => {
    const g = FF.Estudio.abas.find(a => a.id === 'golpes');
    const itens = [...document.querySelectorAll('.es-lista .es-item')].filter(i => /💀/.test(i.textContent)).map(i => i.textContent);
    await g.abrirKO('padrao');
    const padrao = { tipo: g.doc.origem.tipo, alvo: g.doc.linha.trilhas.find(t => t.id === 'alvo').clipes.map(c => c.anim).join(','), titulo: g.titProps.textContent, props: g.props.textContent };
    await g.abrirKO(g.cfg.alvo);
    const alvo = g.cfg.alvo;
    g.doc.linha.trilhas.find(t => t.id === 'efeitos').clipes[0].escala = 1.5; g.mudou('teste');
    g.salvar();
    const salvo = FF.Edicoes.dados().ko[alvo];
    const usa = FF.KO.linhaDe(alvo).trilhas.find(t => t.id === 'efeitos').clipes[0].escala;
    const outro = FF.KO.linhaDe('zzz').trilhas.find(t => t.id === 'efeitos').clipes[0].escala;
    FF.Edicoes.set(['ko', alvo], null);
    return { itens, padrao, salvo: !!salvo, usa, outro, depois: FF.KO.temPropria(alvo) };
  });
  ok(s.itens.length === 2 && s.padrao.tipo === 'ko' && s.padrao.alvo === 'lancado,caido' && /cena de KO/.test(s.padrao.titulo) && /Toca quando a vida/.test(s.padrao.props), 'cena de KO no Estúdio: ' + s.itens.join(' | ') + ' · padrão ' + s.padrao.alvo);
  ok(s.salvo && s.usa === 1.5 && s.outro === 0.55 && !s.depois, 'cena de KO própria salva e usada só para o personagem; os outros ficam com a padrão');

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
