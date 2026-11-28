// 🗄 Onde ficam as imagens e os sons do acervo (assets/img/acervo, assets/audio/acervo — ~1,1 GB de material bruto).
// SEPARADO = false: no próprio site (como sempre). true: no repositório GuizeraDan/Final-Flash-Acervo (GitHub Pages),
// para o site principal ficar abaixo do limite de 1 GB do GitHub Pages. tools/separar_acervo.sh copia os arquivos para
// lá e troca para true. Os dois sites ficam em guizeradan.github.io (mesma origem: o Estúdio continua podendo ler os
// pixels das imagens para editar).
window.FF = window.FF || {};
FF.ACERVO_SEPARADO = false;
FF.ACERVO_SITE = 'https://guizeradan.github.io/Final-Flash-Acervo/';
FF.urlAcervo = function (p) {
  if (!FF.ACERVO_SEPARADO || typeof p !== 'string' || !/^assets\/(img|audio)\/acervo\//.test(p)) return p;
  const base = location.protocol === 'file:' ? FF.ACERVO_SITE : '../Final-Flash-Acervo/';
  return base + p;
};
