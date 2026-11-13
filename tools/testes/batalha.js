// Teste automático de batalha (headless).
// Uso: node tools/testes/batalha.js [--plano 1,2,4,5] [--erro 0.0] [--fotos pasta] [--batalha id] [--tempo 170]
// - plano: ordem das escolhas no menu (índice do botão, 1 = primeiro). Se o botão estiver desabilitado, usa o primeiro habilitado.
// - erro: probabilidade (0..1) de o "jogador automático" NÃO apertar no tempo.
// - fotos: se informado, salva capturas periódicas nessa pasta.
// - rage: valor inicial da Rage Gauge dos heróis (ex.: 100 para testar o ataque supremo).
// Sai com código 1 se houver erro de JavaScript na página ou se a luta não terminar.
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const plano = opt('plano', '1').split(',');
const erro = parseFloat(opt('erro', '0'));
const fotos = opt('fotos', null);
const batalha = opt('batalha', null);
const tempo = parseFloat(opt('tempo', '170')) * 1000;
const rage = opt('rage', null);
const historia = opt('historia', null);
const hpInimigos = opt('hpInimigos', null);
const modoTurno = opt('turno', null);   // --turno planejamento: testa o modo Planejamento
const estiloMenu = opt('menu', null);   // --menu radial|trilho|dock: testa os estilos do menu de golpes   // --hpInimigos 100: inimigos começam com essa vida (testar golpes de vida baixa)   // --historia N: joga o capítulo N do modo história (pula os diálogos)   // --rage 100: começa com a Rage cheia (testar o supremo)

(async () => {
  const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => require('fs').existsSync(p));
  const b = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1084, height: 580 } });
  const erros = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') erros.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
  const raiz = path.resolve(__dirname, '..', '..');
  if (modoTurno || estiloMenu) await p.addInitScript(([t, m]) => { const k = 'finalflash_save_v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); if (t) s.modoTurno = t; if (m) s.estiloMenu = m; localStorage.setItem(k, JSON.stringify(s)); }, [modoTurno, estiloMenu]);
  await p.goto('file://' + raiz + '/index.html' + (historia ? '?historia=' + historia : '?batalha=' + (batalha || 'saiyajin_01')));
  if (!historia) await p.click('#inicio');
  else {   // avança os diálogos até a batalha começar
    while (!(await p.evaluate(() => !!(FF.battle && FF.battle.heroes.length)))) {
      await p.evaluate(() => { const d = document.querySelector('#dialogo'); if (d.classList.contains('open')) d.click(); });
      await p.waitForTimeout(80);
    }
    console.log('diálogos de abertura ok');
  }
  if (hpInimigos) await p.waitForFunction(() => FF.battle && FF.battle.enemies.length).then(() => p.evaluate((v) => FF.battle.enemies.forEach(e => (e.hp = +v)), hpInimigos));
  if (rage) await p.waitForFunction(() => FF.battle && FF.battle.heroes.length).then(() => p.evaluate((r) => FF.battle.heroes.forEach(h => (h.rage = +r)), rage));
  await p.evaluate((erro) => {
    setInterval(() => {
      const b = FF.battle; if (!b) return;
      for (const q of b.qtes) if (q.result === undefined && !q.press && !q._auto) {
        const left = q.at - FF.Clock.t;
        if (left < 0.07 + Math.random() * 0.15 && left > 0) { q._auto = 1; if (Math.random() >= erro) b.onPress(); }
      }
    }, 10);
  }, erro);
  if (fotos) require('fs').mkdirSync(fotos, { recursive: true });
  let k = 0, n = 0, fim = false;
  const t0 = Date.now();
  while (Date.now() - t0 < tempo) {
    if (historia) await p.evaluate(() => { const d = document.querySelector('#dialogo'); if (d.classList.contains('open')) { d.click(); d.click(); } });
    fim = await p.evaluate(() => document.querySelector('#fim').classList.contains('open'));
    if (fim) break;
    const aberto = await p.evaluate(() => document.querySelector('#menu').classList.contains('open'));
    const alvos = aberto && await p.evaluate(() => document.querySelector('#menu').classList.contains('alvos'));
    if (alvos) {   // escolha de alvo: pega o primeiro (não consome o plano)
      await p.evaluate(() => document.querySelector('#menu button').click());
      console.log('  alvo escolhido');
    } else if (aberto) {
      const mv = plano[Math.min(k, plano.length - 1)]; k++;
      // menus novos (radial/trilho/dock): os golpes têm data-golpe, na ordem do menu clássico
      const ok = await p.evaluate((mv) => {
        const gs = [...document.querySelectorAll('#menu [data-golpe]')];
        const bt = gs.length ? gs[mv - 1] : document.querySelector(`#menu button:nth-child(${mv})`);
        if (!bt || bt.disabled || bt.classList.contains('bloq')) return false; bt.click(); return true;
      }, mv);
      if (!ok) await p.evaluate(() => { const bt = document.querySelector('#menu [data-golpe]:not(.bloq)') || document.querySelector('#menu button:not([disabled]):not(.bloq):not(.cmd-voltar)'); if (bt) bt.click(); });
      const st = await p.evaluate(() => FF.battle.all.map(f => `${f.id}:${f.formId} hp${Math.round(f.hp)} ki${Math.round(f.ki)} rage${Math.round(f.rage)}`).join(' | '));
      console.log(`turno ${k} escolha ${mv}${ok ? '' : '(desab.)'} -> ${st}`);
    }
    if (fotos) { await p.screenshot({ path: path.join(fotos, String(n).padStart(4, '0') + '.png') }); n++; }
    await p.waitForTimeout(fotos ? 300 : 200);
  }
  const st = await p.evaluate(() => FF.battle ? FF.battle.all.map(f => `${f.id}:${f.formId} hp${Math.round(f.hp)} ko=${f.ko}`).join(' | ') : 'sem batalha');
  console.log('RESULTADO', fim ? 'luta terminou' : 'NÃO terminou no tempo', '->', st);
  if (erros.length) console.log('ERROS:\n' + erros.slice(0, 30).join('\n'));
  await b.close();
  process.exit(erros.some(e => e.startsWith('PAGEERROR') || e.startsWith('error')) || !fim ? 1 : 0);
})();
