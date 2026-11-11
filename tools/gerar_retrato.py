#!/usr/bin/env python3
"""
Gera retrato (40x56) e banner (134x163) no estilo da seleção do Z Legends 3 a partir do
sprite de batalha de um personagem que não tem arte própria (ex.: Saibaman), e acrescenta
os dois ao sprite "retratos" (novo atlas assets/img/retratos_extra.png).

Uso: python3 -I tools/gerar_retrato.py --sprite saibaman --anim Ataque_1 --quadro 0 \
        --personagem saibaman [--cor 3a6a1a] [--molde 41]
  --molde: índice de um banner existente cujo formato (recorte inclinado) é copiado.
Depois rode tools/build_bundle.py.
"""
import argparse, json, os
from PIL import Image, ImageDraw, ImageFilter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def carregar_quadro(sprite, anim, idx):
    d = json.load(open(os.path.join(RAIZ, 'data/sprites/%s.json' % sprite)))
    f = d['anims'][anim]['frames'][idx]
    at = Image.open(os.path.join(RAIZ, d['atlases'][f[0]])).convert('RGBA')
    return at.crop((f[1], f[2], f[1] + f[3], f[2] + f[4]))


def contorno(img, cor=(12, 10, 20, 255)):
    """contorno escuro de 1 px em volta do desenho (como nos retratos do ZL3)"""
    a = img.split()[3].point(lambda v: 255 if v > 40 else 0)
    borda = a.filter(ImageFilter.MaxFilter(3))
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(Image.new('RGBA', img.size, cor), (0, 0), borda)
    out.alpha_composite(img)
    return out


def gradiente(w, h, c1, c2):
    g = Image.new('RGBA', (w, h))
    dr = ImageDraw.Draw(g)
    for y in range(h):
        t = y / max(1, h - 1)
        dr.line([(0, y), (w, y)], fill=tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,))
    return g


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sprite', required=True)
    ap.add_argument('--anim', required=True)
    ap.add_argument('--quadro', type=int, default=0)
    ap.add_argument('--personagem', required=True)
    ap.add_argument('--cor', default='3a6a1a', help='cor de fundo do retrato (hex)')
    ap.add_argument('--molde', type=int, default=41)
    a = ap.parse_args()

    spr = carregar_quadro(a.sprite, a.anim, a.quadro)
    bb = spr.getbbox()
    spr = spr.crop(bb)
    cor = tuple(int(a.cor[i:i + 2], 16) for i in (0, 2, 4))

    # ---- retrato 40x56: cabeça e ombros, ampliados 2x ----
    esc = 2
    corte_h = 56 // esc + 2
    cab = spr.crop((0, 0, spr.width, min(spr.height, corte_h)))
    cab = cab.resize((cab.width * esc, cab.height * esc), Image.NEAREST)
    cab = contorno(cab)
    ret = gradiente(40, 56, tuple(min(255, c + 60) for c in cor), tuple(c // 3 for c in cor))
    # leve brilho radial atrás da cabeça
    luz = Image.new('RGBA', (40, 56), (0, 0, 0, 0))
    ImageDraw.Draw(luz).ellipse((2, 4, 38, 40), fill=(255, 255, 220, 50))
    ret.alpha_composite(luz.filter(ImageFilter.GaussianBlur(4)))
    ret.alpha_composite(cab, ((40 - cab.width) // 2, 3))
    dr = ImageDraw.Draw(ret)
    dr.rectangle((0, 0, 39, 55), outline=(10, 8, 18, 255))

    # ---- banner 134x163: formato copiado de um banner existente ----
    rdef = json.load(open(os.path.join(RAIZ, 'data/sprites/retratos.json')))
    fb = rdef['anims']['banner']['frames'][a.molde]
    atb = Image.open(os.path.join(RAIZ, rdef['atlases'][fb[0]])).convert('RGBA')
    molde = atb.crop((fb[1], fb[2], fb[1] + fb[3], fb[2] + fb[4]))
    mascara = molde.split()[3]
    W, H = molde.size
    fundo = gradiente(W, H, (255, 236, 90), (240, 120, 20))
    # retícula (pontinhos) como nos banners originais
    dots = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dots)
    for y in range(0, H, 4):
        for x in range((y // 4) % 2 * 2, W, 4):
            dd.point((x, y), fill=(255, 255, 255, 70))
    fundo.alpha_composite(dots)
    corpo = spr.resize((spr.width * 4, spr.height * 4), Image.NEAREST)
    corpo = contorno(corpo)
    # rosto perto do meio (o recorte da seleção mostra a faixa central do banner)
    fundo.alpha_composite(corpo, ((W - corpo.width) // 2 + 6, int(H * 0.42) - 40))
    banner = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    banner.paste(fundo, (0, 0), mascara)

    # ---- grava no atlas extra e no retratos.json ----
    extra = os.path.join(RAIZ, 'assets/img/retratos_extra.png')
    rel = 'assets/img/retratos_extra.png'
    base = Image.open(extra).convert('RGBA') if os.path.exists(extra) else Image.new('RGBA', (1, 1), (0, 0, 0, 0))
    if rel not in rdef['atlases']:
        rdef['atlases'].append(rel)
        base = Image.new('RGBA', (1, 1), (0, 0, 0, 0))
    ai = rdef['atlases'].index(rel)
    x0 = base.width if base.width > 1 else 0
    novo = Image.new('RGBA', (x0 + 40 + 1 + W + 1, max(base.height, H)), (0, 0, 0, 0))
    novo.paste(base, (0, 0))
    novo.paste(ret, (x0, 0))
    novo.paste(banner, (x0 + 41, 0))
    novo.save(extra, optimize=True)
    rdef['anims']['retrato']['frames'].append([ai, x0, 0, 40, 56, 20, 28, 1])
    rdef['anims']['banner']['frames'].append([ai, x0 + 41, 0, W, H, W // 2, H // 2, 1])
    iq = len(rdef['anims']['retrato']['frames']) - 1
    ib = len(rdef['anims']['banner']['frames']) - 1
    json.dump(rdef, open(os.path.join(RAIZ, 'data/sprites/retratos.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

    # personagem aponta para os novos quadros
    cp = os.path.join(RAIZ, 'data/characters/%s.json' % a.personagem)
    c = json.load(open(cp))
    for f in c['formas'].values():
        f['retrato'] = {'quadro': iq, 'banner': ib}
    json.dump(c, open(cp, 'w'), ensure_ascii=False, indent=2)
    print('retrato', iq, 'banner', ib, '->', a.personagem)
    ret.resize((160, 224), Image.NEAREST).save('/tmp/retrato_previa.png')
    banner.resize((W * 2, H * 2), Image.NEAREST).save('/tmp/banner_previa.png')


if __name__ == '__main__':
    main()
