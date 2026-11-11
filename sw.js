// Service worker do Final Flash: faz o jogo abrir sem internet e atualizar sozinho.
// - Código e dados (html, js, css, json): rede primeiro → sempre a versão mais nova quando há internet;
//   sem internet, usa a cópia guardada.
// - Imagens e sons: cache primeiro (rápido) e atualiza a cópia em segundo plano.
const CACHE = 'finalflash-v1';
const ESSENCIAIS = [
  './', 'index.html', 'visualizador.html', 'manifest.webmanifest', 'versao.json',
  'css/style.css', 'css/ferramentas.css', 'data/bundle.js',
  'js/core/clock.js', 'js/core/modificacoes.js', 'js/core/assets.js', 'js/core/sprite.js', 'js/core/audio.js', 'js/core/input.js', 'js/core/retrato.js',
  'js/core/habilidades.js', 'js/ui/selecao.js', 'js/ui/pausa.js',
  'js/battle/fighter.js', 'js/battle/script.js', 'js/battle/ai.js', 'js/battle/hud.js', 'js/battle/battle.js', 'js/battle/cena.js',
  'js/ferramentas/laboratorio.js', 'js/ferramentas/editor.js', 'js/ferramentas/editor_cena.js', 'js/ferramentas/previa.js', 'js/ferramentas/visualizador.js', 'js/pwa.js', 'js/main.js',
  'assets/icones/icone-192.png', 'assets/icones/icone-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // um arquivo que falhar não impede a instalação
    await Promise.all(ESSENCIAIS.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    // imagens dos sprites (lidas do índice do bundle) para jogar offline
    try {
      const txt = await (await fetch('data/bundle.js', { cache: 'reload' })).text();
      const imgs = [...new Set(txt.match(/assets\/img\/[\w\-]+\.png/g) || [])];
      await Promise.all(imgs.map(u => c.add(u).catch(() => {})));
    } catch (err) { /* segue sem as imagens; serão guardadas ao usar */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const midia = /\.(png|ogg|mp3|jpg|webp)$/i.test(url.pathname);
  e.respondWith(midia ? cacheParaRede(req, e) : redeParaCache(req));
});

async function redeParaCache(req) {
  const c = await caches.open(CACHE);
  try {
    const r = await fetch(req, { cache: 'no-cache' });
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    return (await c.match(req, { ignoreSearch: true })) || (await c.match('index.html')) || Response.error();
  }
}

async function cacheParaRede(req, e) {
  const c = await caches.open(CACHE);
  const guardado = await c.match(req);
  const rede = fetch(req).then(r => { if (r.ok && r.status === 200) c.put(req, r.clone()); return r; }).catch(() => null);
  if (guardado) { e.waitUntil(rede); return guardado; }
  return (await rede) || Response.error();
}
