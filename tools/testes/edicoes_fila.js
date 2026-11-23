// Teste da fila de envio do FF.Edicoes: mudanças feitas DURANTE um envio não podem se perder
// (bug: renomear o sprite logo depois do 🎞 Juntar levava junto a animação nova).
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1; };
const mem = {};
const ctx = { window: {}, localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } }, console, setTimeout, clearTimeout, Date, JSON, Promise, atob, btoa, TextEncoder, TextDecoder, Uint8Array, String, escape, unescape, encodeURIComponent, decodeURIComponent };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'js/core/edicoes.js'), 'utf8'), ctx);
const E = ctx.FF.Edicoes;
let remoto = { versao: 1 }, puts = 0;
E.conectado = () => true;
E.api = async (url, o) => {
  await new Promise(r => setTimeout(r, 30));
  if (o && o.method === 'PUT') { puts++; remoto = E.ler(E.de64(JSON.parse(o.body).content)); return {}; }
  return { content: E.b64(E.escrever(remoto)), sha: 'x' + puts };
};
(async () => {
  // 1º envio começa com o atlas; durante ele: animação nova + nome no MESMO caminho do atlas
  const p1 = E.set(['spritesInfo', 'dlz_10_3'], { atlas: ['a.png'] });
  await new Promise(r => setTimeout(r, 5));
  E.set(['sprites', 'dlz_10_3', 'TESTE_4'], { fps: 1, frames: [[0], [1]] });
  E.setDepois(['spritesInfo', 'dlz_10_3'], { atlas: ['a.png'], nome: 'TESTE 4' }, 10);
  await p1;
  ok(E.pendentes().length === 2, 'depois do 1º envio sobram as 2 mudanças feitas durante ele (' + E.pendentes().length + ')');
  await new Promise(r => setTimeout(r, 200));
  await E.enviar();
  ok(remoto.sprites && remoto.sprites.dlz_10_3 && remoto.sprites.dlz_10_3.TESTE_4 && remoto.sprites.dlz_10_3.TESTE_4.frames.length === 2, 'a animação chegou ao GitHub');
  ok(remoto.spritesInfo.dlz_10_3.nome === 'TESTE 4', 'o nome chegou ao GitHub');
  ok(E.pendentes().length === 0, 'fila vazia no fim');
})();
