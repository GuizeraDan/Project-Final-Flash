// 🗄 Onde ficam as imagens e os sons do acervo (assets/img/acervo, assets/audio/acervo — ~1,1 GB de material bruto).
// SEPARADO = false: no próprio site (como sempre). true: no repositório GuizeraDan/Final-Flash-Acervo (GitHub Pages),
// para o site principal ficar abaixo do limite de 1 GB do GitHub Pages. tools/separar_acervo.sh copia os arquivos para
// lá e troca para true. Os dois sites ficam em guizeradan.github.io (mesma origem: o Estúdio continua podendo ler os
// pixels das imagens para editar).
window.FF = window.FF || {};
FF.ACERVO_SEPARADO = true;
FF.ACERVO_SITE = 'https://guizeradan.github.io/Final-Flash-Acervo/';
// No site: '../Final-Flash-Acervo/…'. Aberto por file://: primeiro a cópia que estiver no computador (os arquivos
// continuam na pasta, só fora do Git); se ela não existir, FF.reservaAcervo(url) dá o endereço no site.
FF.ehAcervo = p => FF.ACERVO_SEPARADO && typeof p === 'string' && /^assets\/(img|audio)\/acervo\//.test(p);
FF.urlAcervo = function (p) {
  if (!FF.ehAcervo(p)) return p;
  return location.protocol === 'file:' ? p : '../Final-Flash-Acervo/' + p;
};
FF.reservaAcervo = function (url) {
  return (location.protocol === 'file:' && FF.ehAcervo(url)) ? FF.ACERVO_SITE + url : null;
};
// <img>/<audio> com a reserva: se a cópia local falhar, tenta o site uma vez
FF.comReservaAcervo = function (el, url) {
  const r = FF.reservaAcervo(url);
  if (r) el.addEventListener('error', function tenta() { el.removeEventListener('error', tenta); el.src = r; });
  return el;
};
