#!/usr/bin/env python3
"""
Retrato (rosto da seleção/HUD) e banner de um personagem a partir de uma ARTE que o usuário mandou
(ex.: ilustração do Bills). Grava no atlas extra assets/img/retratos_extra.png e aponta as formas do
personagem para os quadros novos. Se o personagem já tinha retrato/banner nesse atlas, eles são trocados
(o atlas é remontado só com o que ainda é usado).

Uso: python3 -I tools/retrato_de_imagem.py --imagem arte.png --personagem bills \
        --rosto 225,60,725,760 --banner 100,0,800,852 [--escala 2] [--molde 41]
  --rosto / --banner: caixa x0,y0,x1,y1 na imagem (o rosto é 40×56 e o banner 134×163 vezes a escala;
                      a caixa é ajustada para essa proporção mantendo o centro).
  --escala: resolução (2 = 80×112 e 268×326; o jogo desenha esticando, então fica mais nítido).
  --molde:  banner existente cujo recorte inclinado é copiado.
Depois rode tools/build_bundle.py.
"""
import argparse, json, os
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REL = 'assets/img/retratos_extra.png'


def caixa(txt, w, h, img):
    x0, y0, x1, y1 = [int(v) for v in txt.split(',')]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    bw, bh = x1 - x0, y1 - y0
    if bw / bh > w / h:
        bw = bh * w / h
    else:
        bh = bw * h / w
    return img.crop((int(cx - bw / 2), int(cy - bh / 2), int(cx + bw / 2), int(cy + bh / 2)))


def reduzir(img, w, h):
    out = img.resize((w, h), Image.LANCZOS)
    return ImageEnhance.Sharpness(out).enhance(1.4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--imagem', required=True)
    ap.add_argument('--personagem', required=True)
    ap.add_argument('--rosto', required=True)
    ap.add_argument('--banner', required=True)
    ap.add_argument('--escala', type=int, default=2)
    ap.add_argument('--molde', type=int, default=41)
    a = ap.parse_args()
    E = a.escala
    arte = Image.open(a.imagem).convert('RGBA')

    # ---- rosto
    RW, RH = 40 * E, 56 * E
    rosto = reduzir(caixa(a.rosto, RW, RH, arte), RW, RH)
    ImageDraw.Draw(rosto).rectangle((0, 0, RW - 1, RH - 1), outline=(10, 8, 18, 255), width=max(1, E // 2))

    # ---- banner (recorte inclinado de um banner existente)
    rdef = json.load(open(os.path.join(RAIZ, 'data/sprites/retratos.json')))
    fb = rdef['anims']['banner']['frames'][a.molde]
    atb = Image.open(os.path.join(RAIZ, rdef['atlases'][fb[0]])).convert('RGBA')
    molde = atb.crop((fb[1], fb[2], fb[1] + fb[3], fb[2] + fb[4]))
    BW, BH = molde.width * E, molde.height * E
    mascara = molde.split()[3].resize((BW, BH), Image.NEAREST)
    corpo = reduzir(caixa(a.banner, BW, BH, arte), BW, BH)
    banner = Image.new('RGBA', (BW, BH), (0, 0, 0, 0))
    banner.paste(corpo, (0, 0), mascara)
    # contorno escuro na borda do recorte (como nos banners originais)
    borda = mascara.filter(ImageFilter.MaxFilter(3))
    contorno = Image.new('RGBA', (BW, BH), (0, 0, 0, 0))
    contorno.paste(Image.new('RGBA', (BW, BH), (12, 8, 22, 255)), (0, 0), borda)
    contorno.alpha_composite(banner)
    banner = contorno

    # ---- quadros do atlas extra ainda usados (menos os antigos deste personagem)
    if REL not in rdef['atlases']:
        rdef['atlases'].append(REL)
    ai = rdef['atlases'].index(REL)
    cp = os.path.join(RAIZ, 'data/characters/%s.json' % a.personagem)
    c = json.load(open(cp))
    antigos = {('retrato', f['retrato']['quadro']) for f in c['formas'].values() if f.get('retrato')} | \
              {('banner', f['retrato']['banner']) for f in c['formas'].values() if f.get('retrato')}
    caminho = os.path.join(RAIZ, REL)
    velho = Image.open(caminho).convert('RGBA') if os.path.exists(caminho) else None
    pecas = []      # (anim, índice, imagem)
    for anim in ('retrato', 'banner'):
        for i, f in enumerate(rdef['anims'][anim]['frames']):
            if f[0] != ai:
                continue
            if (anim, i) in antigos:
                pecas.append((anim, i, rosto if anim == 'retrato' else banner))
            else:
                pecas.append((anim, i, velho.crop((f[1], f[2], f[1] + f[3], f[2] + f[4]))))
    novos = {}
    if not any(an == 'retrato' and (an, i) in antigos for an, i, _ in pecas):
        rdef['anims']['retrato']['frames'].append([ai, 0, 0, 1, 1, 0, 0, 1])
        i = len(rdef['anims']['retrato']['frames']) - 1
        pecas.append(('retrato', i, rosto)); novos['retrato'] = i
    if not any(an == 'banner' and (an, i) in antigos for an, i, _ in pecas):
        rdef['anims']['banner']['frames'].append([ai, 0, 0, 1, 1, 0, 0, 1])
        i = len(rdef['anims']['banner']['frames']) - 1
        pecas.append(('banner', i, banner)); novos['banner'] = i

    # ---- remonta o atlas numa fileira
    W = sum(p[2].width + 1 for p in pecas)
    H = max(p[2].height for p in pecas)
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    x = 0
    for anim, i, im in pecas:
        atlas.paste(im, (x, 0))
        rdef['anims'][anim]['frames'][i] = [ai, x, 0, im.width, im.height, im.width // 2, im.height // 2, 1]
        x += im.width + 1
    atlas.save(caminho, optimize=True)
    json.dump(rdef, open(os.path.join(RAIZ, 'data/sprites/retratos.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

    iq = next(i for an, i, im in pecas if an == 'retrato' and im is rosto)
    ib = next(i for an, i, im in pecas if an == 'banner' and im is banner)
    for f in c['formas'].values():
        f['retrato'] = {'quadro': iq, 'banner': ib}
    json.dump(c, open(cp, 'w'), ensure_ascii=False, indent=2)
    print('retrato', iq, 'banner', ib, '->', a.personagem, '| atlas', atlas.size)
    rosto.resize((RW * 2, RH * 2), Image.NEAREST).save('/tmp/retrato_previa.png')
    banner.save('/tmp/banner_previa.png')


if __name__ == '__main__':
    main()
