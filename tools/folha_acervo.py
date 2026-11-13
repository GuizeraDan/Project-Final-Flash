#!/usr/bin/env python3
"""Folha de contato numerada da animação "Todos" de um sprite do acervo (para montar a receita de animações).
Uso: python3 -I tools/folha_acervo.py <id> <saida.png> [celula=84] [colunas=14]"""
import json, sys
from PIL import Image, ImageDraw
sid, out = sys.argv[1], sys.argv[2]
cel = int(sys.argv[3]) if len(sys.argv) > 3 else 84
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 14
t = open('data/acervo/%s.js' % sid, encoding='utf-8').read()
d = json.loads(t[t.index(',') + 1:t.rindex(')')])
base = d.get('_todos') or d['anims']['Todos']['frames']
at = [Image.open(a).convert('RGBA') for a in d['atlases']]
rows = (len(base) + cols - 1) // cols
img = Image.new('RGBA', (cols * cel, rows * (cel + 10)), (28, 22, 44, 255))
dr = ImageDraw.Draw(img)
for i, f in enumerate(base):
    im = at[f[0]].crop((f[1], f[2], f[1] + f[3], f[2] + f[4]))
    sc = min(1.0, (cel - 4) / max(f[3], f[4]))
    if sc < 1: im = im.resize((max(1, int(f[3] * sc)), max(1, int(f[4] * sc))))
    x, y = (i % cols) * cel, (i // cols) * (cel + 10)
    img.alpha_composite(im, (x + (cel - im.size[0]) // 2, y + 10 + (cel - im.size[1]) - 2))
    dr.text((x + 2, y), str(i), fill=(255, 230, 80, 255))
img.save(out)
print(sid, len(base), 'quadros')
