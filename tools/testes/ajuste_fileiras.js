// Teste: ajustes por combinação de fileiras ({"frente>meio": {dx…}}) — o Estúdio não edita mais (tudo é cena), mas o
// motor ainda usa os que existem quando o jogador desliga as cenas; dentro da cena eles não valem.
global.window = global; global.FF = {};
require('../../js/battle/linha.js');
const L = FF.Linha;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FALHOU: ') + m); if (!c) process.exitCode = 1; };
const c = { tipo: 'efeito', dx: 10, ajustes: { 'frente>meio': { dx: 200 } } };
const b = { persp: true }, a = { prof: 0.1 }, t = { prof: 0.5 };
ok(L.chaveFileiras(b, a, t) === 'frente>meio', 'chave da combinação');
ok(L.comAjuste(c, 'frente>meio').dx === 200 && L.comAjuste(c, 'fundo>fundo').dx === 10, 'usa o ajuste só na combinação certa');
ok(L.chaveFileiras(Object.assign({ cena: {} }, b), a, t) === null, 'dentro da cena os ajustes não valem');
