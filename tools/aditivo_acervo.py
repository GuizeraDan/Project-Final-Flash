#!/usr/bin/env python3
"""
Efeitos do acervo feitos para mistura aditiva (fundo preto opaco) → transparência pelo brilho, direto nos atlas.

Mesmo critério do tools/extrair_mugen.py: um quadro é convertido quando mais de 35% dos pixels visíveis são preto
puro; alfa = canal mais forte e a cor perde a escuridão (c' = c * 255 / alfa). Contornos de personagem ficam bem
abaixo disso. Só mexe em sprites do tipo "efeitos" (cenários de espaço são pretos de verdade).

Uso: python3 -I tools/aditivo_acervo.py <prefixo ou id> [...]   (ex.: dw_)
"""
import json, os, sys
import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extrair_mugen import aditivo


def ler(sid):
    s = open(os.path.join(RAIZ, 'data/acervo', sid + '.js'), encoding='utf-8').read()
    return json.loads(s[s.index(',') + 1:s.rindex(')')])


def main():
    alvos = sys.argv[1:]
    indice = json.load(open(os.path.join(RAIZ, 'data/acervo/indice.json'), encoding='utf-8'))['sprites']
    ids = sorted(i for i in indice if indice[i]['tipo'] == 'efeitos' and any(i == a or i.startswith(a) for a in alvos))
    por_atlas = {}                                          # atlas → retângulos (um atlas pode ser de mais de um sprite)
    for sid in ids:
        d = ler(sid)
        for a in d['anims'].values():
            for f in a['frames']:
                por_atlas.setdefault(d['atlases'][f[0]], set()).add(tuple(f[1:5]))
    total = conv = 0
    for rel, rects in sorted(por_atlas.items()):
        p = os.path.join(RAIZ, rel)
        im = Image.open(p).convert('RGBA')
        mudou = False
        for x, y, w, h in rects:
            total += 1
            q = aditivo(im.crop((x, y, x + w, y + h)))
            if q is not None:
                im.paste(q, (x, y)); mudou = True; conv += 1
        if mudou:
            im.save(p, optimize=True)
    print('%d sprites de efeitos, %d atlas, %d de %d quadros convertidos' % (len(ids), len(por_atlas), conv, total))


if __name__ == '__main__':
    main()
