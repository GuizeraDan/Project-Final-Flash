#!/usr/bin/env python3
"""Folha de conferência: 1º quadro da animação 0 (Parado) de cada personagem extraído."""
import json, os, sys
from PIL import Image, ImageDraw

out, dest = sys.argv[1], sys.argv[2]
ids = sorted(d for d in os.listdir(out) if os.path.exists(os.path.join(out, d, 'info.json')))
if len(sys.argv) > 3: ids = [i for i in ids if i in sys.argv[3:]]
cell, lab, cols = 170, 28, 6
rows = (len(ids) + cols - 1) // cols
sheet = Image.new('RGBA', (cols * cell, rows * (cell + lab)), (52, 54, 70, 255))
dr = ImageDraw.Draw(sheet)
for k, cid in enumerate(ids):
    d = os.path.join(out, cid)
    sp = {(s['g'], s['i']): s for s in json.load(open(d + '/sprites.json'))}
    an = json.load(open(d + '/anims.json'))
    key = None
    if '0' in an: key = tuple(an['0']['quadros'][0][:2])
    if key not in sp: key = (0, 0) if (0, 0) in sp else next(iter(sp), None)
    x, y = (k % cols) * cell, (k // cols) * (cell + lab)
    if key:
        im = Image.open(d + '/png/' + sp[key]['arq']).convert('RGBA')
        im.thumbnail((cell - 8, cell - 8))
        sheet.alpha_composite(im, (x + (cell - im.width) // 2, y + cell - im.height - 4))
    info = json.load(open(d + '/info.json'))
    dr.text((x + 4, y + cell + 2), info['pasta'][:26], fill=(255, 255, 255, 255))
    dr.text((x + 4, y + cell + 14), f"{info['pngs']} png / {info['animacoes']} anim", fill=(170, 175, 200, 255))
sheet.save(dest)
print(dest, len(ids))
