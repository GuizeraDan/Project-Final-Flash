#!/usr/bin/env bash
# Leva as imagens e os sons do acervo (assets/img/acervo, assets/audio/acervo — ~1,1 GB) para o repositório
# GuizeraDan/Final-Flash-Acervo, para o site principal ficar abaixo do limite de 1 GB do GitHub Pages.
#
# Antes (uma vez, no GitHub): criar o repositório público vazio "Final-Flash-Acervo" e ligar o GitHub Pages
# (Settings → Pages → Branch: main / root). O Claude também consegue rodar isto se o repositório for ligado à sessão.
#
# Uso: tools/separar_acervo.sh <pasta do clone de Final-Flash-Acervo>
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:?informe a pasta do clone de Final-Flash-Acervo}"
cd "$RAIZ"
mkdir -p "$DEST/assets/img" "$DEST/assets/audio"
echo "Copiando imagens…"; cp -a assets/img/acervo "$DEST/assets/img/"
echo "Copiando sons…";    cp -a assets/audio/acervo "$DEST/assets/audio/"
touch "$DEST/.nojekyll"
cat > "$DEST/README.md" <<'TXT'
# Final Flash — acervo

Imagens e sons do acervo de sprites do [Final Flash](https://github.com/GuizeraDan/Project-Final-Flash), servidos pelo
GitHub Pages para o jogo e o Estúdio (`js/core/acervo_url.js` do projeto principal). Não edite à mão: os arquivos
vêm das ferramentas `tools/extrair_*.py` do projeto principal.
TXT
cd "$DEST"
git add -A
git -c user.name=GuizeraDan -c user.email=GuizeraDan@users.noreply.github.com commit -qm "Acervo de imagens e sons do Final Flash"
git push origin HEAD:main
cd "$RAIZ"
# no projeto principal: o acervo sai do site e os caminhos passam a apontar para o outro repositório
git rm -r -q --cached assets/img/acervo assets/audio/acervo
printf 'assets/img/acervo/\nassets/audio/acervo/\n' >> .gitignore
sed -i 's/^FF.ACERVO_SEPARADO = false;/FF.ACERVO_SEPARADO = true;/' js/core/acervo_url.js
echo "Pronto: confira, rode os testes e faça o commit do projeto principal."
