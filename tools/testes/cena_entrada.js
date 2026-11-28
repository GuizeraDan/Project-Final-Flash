// Teste: 🎬 entrada/saída da cena (por tipo e personagem, com o clipe ✂ corte), clarão com cor, 🖼 retrato,
// ⚡ Sparking por personagem (cena de entrada, aura e pose) e o painel do palco sem aliados.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('https://api.github.com/**', r => r.abort());
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..') + '/estudio.html?aba=golpes&personagem=goku&golpe=combo');
  await p.waitForFunction(() => FF.Estudio.pronto && FF.Estudio.Golpes && FF.Estudio.Golpes.doc && FF.Estudio.Golpes.palco._b, null, { timeout: 30000 });
  const ok = (c, m) => { console.log((c ? 'ok: ' : 'FALHOU: ') + m); if (!c) process.exitCode = 1; };
  const txt = await p.evaluate(() => document.body.innerText);
  ok(/Entrada da cena/.test(txt) && /Saída da cena/.test(txt) && /Entrada no Sparking/.test(txt), 'lista com entrada, saída e Sparking');
  ok(!/Aliado do alvo/.test(txt) && !/Quem é atacado/.test(txt) && /Parceiro 1/.test(txt), 'palco sem aliados nem "quem é atacado" (parceiro fica)');
  // entrada rush padrão: começa na formação, o corte (0,12 s) troca para a cena
  const ent = await p.evaluate(async () => { const G = FF.Estudio.Golpes; G.abrirCena('entrada', 'rush', 'padrao'); await new Promise(r => setTimeout(r, 300)); G.irPara(0.05); const a = !!G.palco._b.cena; G.irPara(0.25); return [a, !!G.palco._b.cena]; });
  ok(!ent[0] && ent[1], 'entrada: formação antes do ✂ corte, cena depois ' + JSON.stringify(ent));
  const sai = await p.evaluate(async () => { const G = FF.Estudio.Golpes; G.abrirCena('saida', 'rush', 'padrao'); await new Promise(r => setTimeout(r, 300)); G.irPara(0.02); const a = !!G.palco._b.cena; G.irPara(0.2); return [a, !!G.palco._b.cena]; });
  ok(sai[0] && !sai[1], 'saída: cena antes do ✂ corte, formação depois ' + JSON.stringify(sai));
  const sup = await p.evaluate(() => { const l = FF.CenaGolpe.linhaDe('entrada', 'supremo', 'padrao'); const tela = l.trilhas.find(t => t.tipo === 'tela').clipes; return [tela.some(c => c.tipo === 'faixa'), tela.some(c => c.tipo === 'corte')]; });
  ok(sup[0] && sup[1], 'entrada do Supremo = a abertura antiga + corte');
  // na luta, com uma entrada própria do Goku para rush (retrato + clarão vermelho + corte)
  await p.evaluate(() => {
    const orig = FF.CenaGolpe.salva.bind(FF.CenaGolpe);
    FF.CenaGolpe.salva = (q, t, id) => q === 'entrada' && t === 'rush' && id === 'goku' ? { duracao: 0.8, trilhas: FF.CenaGolpe.trilhas([{ id: 'r', tipo: 'retrato', t: 0, d: 0.6 }, { id: 'f', tipo: 'flash', t: 0.5, forca: 0.9, d: 0.2, cor: '#ff2020' }, { id: 'c', tipo: 'corte', t: 0.6 }]) } : orig(q, t, id);
    const G = FF.Estudio.Golpes; G.abrirGolpe('goku', 'combo');
  });
  await p.waitForTimeout(500);
  await p.evaluate(() => { window._log = []; const G = FF.Estudio.Golpes; G.doc.golpe.categoria = 'rush'; G.naBatalha(); setTimeout(function f() { const B = G.palco._b; if (B) _log.push({ cena: !!B.cena, ret: !!(B.efTela && B.efTela.retrato), cor: B.flashCor }); if (!G.palco._fimBatalha) setTimeout(f, 50); }, 20); });
  await p.waitForFunction(() => FF.Estudio.Golpes.palco._fimBatalha, null, { timeout: 30000 });
  await p.waitForTimeout(200);
  const log = await p.evaluate(() => { const B = FF.Estudio.Golpes.palco._b; _log.push({ cena: !!B.cena }); return _log; });
  const iCena = log.findIndex(x => x.cena);
  ok(log.some(x => x.ret && !x.cena) && iCena > 3 && log.some(x => x.cor === '#ff2020'), 'na luta: entrada própria (retrato na formação, clarão vermelho, depois a cena)');
  ok(!log[log.length - 1].cena, 'na luta: volta para a formação no fim');
  // ⚡ Sparking: aura e pose do personagem com a Fúria cheia; cena de entrada toca e termina
  const spk = await p.evaluate(async () => {
    const B = FF.Estudio.Golpes.palco._b, f = B.atk;
    const anims = Object.keys(f.sprite.def.anims), pose = anims.find(a => a !== f.anim.name) || anims[0];
    const fx = Object.keys(FF.Assets.sprites.fx.def.anims)[0];
    FF.Edicoes.setDepois(['sparking', 'visual', f.def.id], { parado: pose, aura: { sprite: 'fx', anim: fx, escala: 1 } }, 999999);
    f._spkPose = false; f.rage = 100; f.busy = false; f.react = null; f.update(0.01);
    const r = { pose: f.anim.name === pose, aura: (f.auraAtual() || {}).fx === fx };
    // o palco já saiu do modo batalha: o relógio anda aqui
    let fim = false, n = 0; const t0 = FF.Clock.t;
    FF.Sparking.tocar(B, f, B.alvo).then(() => { fim = true; });
    while (!fim && n++ < 200) { const g = FF.Clock.tick(0.05); B.update(g); await new Promise(res => setTimeout(res, 0)); }
    r.tempo = Math.round((FF.Clock.t - t0) * 1000);
    f.busy = false; f.idle(); f.rage = 0; f.update(0.01); r.volta = f.anim.name !== pose && !(f.auraAtual() && f.auraAtual().fx === fx); r.depois = [f.anim.name, f.auraAtual() && f.auraAtual().fx, f.busy, !!f.react];
    return r;
  });
  ok(spk.pose && spk.aura && spk.volta && spk.tempo > 300, 'Sparking: pose e aura com a Fúria cheia, cena de entrada toca e tudo volta ' + JSON.stringify(spk));
  await p.evaluate(() => FF.Estudio.Golpes.abrirSparking('padrao'));
  await p.waitForTimeout(300);
  ok(/Entrada no Sparking/.test(await p.evaluate(() => FF.Estudio.Golpes.doc.golpe.nome)), 'abre a entrada no Sparking para editar');
  // aba Personagens tem o grupo ⚡ Sparking
  await p.evaluate(() => FF.Estudio.abrir('personagens'));
  await p.waitForTimeout(800);
  await p.evaluate(() => { const P = FF.Estudio.Personagens || FF.EstudioPersonagens; const it = [...document.querySelectorAll('.es-item')].find(e => /Goku/.test(e.textContent)); if (it) it.click(); });
  await p.waitForTimeout(1500);
  ok(/Sparking \(Fúria cheia\)/.test(await p.evaluate(() => document.body.innerText)), 'Personagens: grupo ⚡ Sparking');
  ok(!erros.length, 'sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await b.close();
})();
