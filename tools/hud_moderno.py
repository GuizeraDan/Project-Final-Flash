#!/usr/bin/env python3
"""
Monta o HUD novo (arte do usuário em tools/receitas/arte/hud.png) para o jogo:
  assets/img/hud_moderno.png  = moldura (com as partes que mudam apagadas: retrato, vida, ki, nome, KI, rage)
                                 + camada de cima (cantos ciano e barrinhas de sinal da janela do retrato)
As posições usadas pelo jogo (js/battle/hud.js, FF.HUD.L) estão em pixels da arte recortada (2125×545).
Uso: python3 -I tools/hud_moderno.py
"""
import os
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CROP = (30, 80, 2155, 625)
ESC = 0.5   # resolução guardada (metade da arte; o jogo mostra ~400 px de largura)


# contorno de dentro da moldura (na arte original); fora dele, o fundo escuro some e o brilho fica translúcido
CONTORNO = [(80, 140), (130, 92), (560, 92), (580, 108), (700, 108), (722, 138), (1700, 138), (1722, 98), (2080, 98),
            (2128, 160), (2050, 295), (1985, 400), (1900, 400), (1870, 478), (1740, 480), (1730, 600), (560, 600),
            (540, 612), (100, 612), (55, 565), (55, 410), (80, 380)]


def tirar_fundo(img):
    from PIL import ImageFilter
    w, h = img.size
    dentro = Image.new('L', (w, h), 0)
    ImageDraw.Draw(dentro).polygon([(x - CROP[0], y - CROP[1]) for x, y in CONTORNO], fill=255)
    dentro = dentro.filter(ImageFilter.GaussianBlur(1.5))
    px, md = img.load(), dentro.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = max(r, g, b)
            fora = max(0, min(255, int((m - 48) * 255 / 72)))   # quanto mais perto do fundo (~12,30,38), mais transparente
            px[x, y] = (r, g, b, max(md[x, y], fora))


def main():
    orig = Image.open(os.path.join(RAIZ, 'tools/receitas/arte/hud.png')).convert('RGBA')
    im = orig.copy()
    d = ImageDraw.Draw(im)
    # janela do retrato: fundo escuro com grade
    d.rounded_rectangle((122, 130, 556, 563), radius=18, fill=(8, 38, 48, 255))
    for x in range(140, 556, 28):
        d.line((x, 132, x, 561), fill=(14, 66, 78, 255), width=2)
    for y in range(148, 563, 28):
        d.line((124, y, 554, y), fill=(14, 66, 78, 255), width=2)
    # vida, ki (faixa inteira), nome, KI, rage
    d.polygon([(628, 176), (1940, 176), (1898, 262), (600, 262)], fill=(6, 20, 14, 255))
    d.polygon([(640, 296), (1882, 296), (1857, 350), (612, 350)], fill=(8, 20, 34, 255))
    d.polygon([(648, 380), (1100, 380), (1080, 470), (624, 470)], fill=(10, 26, 52, 255))
    d.polygon([(1525, 382), (1815, 382), (1795, 468), (1505, 468)], fill=(10, 26, 52, 255))
    d.polygon([(612, 508), (865, 508), (840, 592), (590, 592)], fill=(70, 14, 6, 255))
    d.polygon([(865, 512), (1715, 512), (1695, 588), (845, 588)], fill=(24, 8, 6, 255))
    moldura = im.crop(CROP)
    tirar_fundo(moldura)
    # camada de cima: só os traços ciano da janela do retrato (cantos e barrinhas), tirados da arte
    cima = Image.new('RGBA', orig.size, (0, 0, 0, 0))
    po, pc = orig.load(), cima.load()
    for y in range(125, 570):
        for x in range(118, 562):
            r, g, b, a = po[x, y]
            perto_borda = x < 240 or x > 440 or y < 200 or y > 440
            if perto_borda and g > 170 and b > 190 and r < 110:
                pc[x, y] = (r, g, b, 255)
    cima = cima.crop(CROP)
    W, H = moldura.size
    w, h = int(W * ESC), int(H * ESC)
    folha = Image.new('RGBA', (w, h * 2 + 1), (0, 0, 0, 0))
    folha.paste(moldura.resize((w, h), Image.LANCZOS), (0, 0))
    folha.paste(cima.resize((w, h), Image.LANCZOS), (0, h + 1))
    folha.save(os.path.join(RAIZ, 'assets/img/hud_moderno.png'), optimize=True)
    print('hud_moderno.png', folha.size, '(moldura e camada de cima', w, 'x', h, ')')


if __name__ == '__main__':
    main()
