#!/usr/bin/env python3
"""
Extrai animações do Z Legends 3 (Construct 2) para o formato do Final Flash.

Lê o data.js original, recorta os quadros das sprite sheets e re-empacota
num atlas próprio por conjunto (ex.: gokubase), gerando:
  data/sprites/<id>.json
  assets/img/<id>_<n>.png

Uso:
  python3 -I tools/extract_sprites.py --www <pasta assets/www> --out <raiz do projeto> \
      --id gokubase --src t70
  # vários objetos num mesmo conjunto, com filtro e renomeação de animações:
  python3 -I tools/extract_sprites.py ... --id fx --src t335:Hit1,Hit2=hit2 --src t344
  # um quadro específico vira animação estática:
  python3 -I tools/extract_sprites.py ... --id stage_saiyajin --src t213:Default@5=ceu

Formato de quadro no JSON: [atlas, x, y, w, h, ox, oy, dur, pontos]
  ox/oy = ponto de origem (hotspot) em pixels; dur = multiplicador de duração;
  pontos = [[dx, dy], ...] relativos ao hotspot (pontos de disparo do Construct).
"""
import argparse, json, os
from PIL import Image

MAX_W = 2048
MAX_H = 2048
PAD = 1


def load_types(www):
    with open(os.path.join(www, 'data.js'), encoding='utf-8-sig') as fh:
        proj = json.load(fh)['project']
    types = {}
    for t in proj[3]:
        anims = []
        if len(t) > 7 and isinstance(t[7], list):
            for a in t[7]:
                if not (isinstance(a, list) and a and isinstance(a[0], str)):
                    continue
                frames = [dict(img=f[0], x=f[2], y=f[3], w=f[4], h=f[5], dur=f[6],
                               hx=f[7], hy=f[8], pts=f[9]) for f in a[7]]
                anims.append(dict(name=a[0], speed=a[1], loop=a[2], repeat=a[3],
                                  repeatTo=a[4], pingpong=a[5], frames=frames))
        types[t[0]] = anims
    return types


def parse_src(spec):
    """t70  |  t335:Hit1,Hit2=meuhit  |  t213:Default@5=ceu"""
    if ':' not in spec:
        return spec, None
    tname, rest = spec.split(':', 1)
    sel = []
    for item in rest.split(','):
        new = None
        if '=' in item:
            item, new = item.split('=', 1)
        frame = None
        if '@' in item:
            item, frame = item.split('@', 1)
            frame = int(frame)
        sel.append((item, new or item, frame))
    return tname, sel


def pack(rects):
    """Shelf packer simples. rects: lista de (key, w, h). Retorna {key: (atlas, x, y)}."""
    order = sorted(rects, key=lambda r: -r[2])
    pos, atlases = {}, []
    cur = None
    for key, w, h in order:
        if w + PAD > MAX_W or h + PAD > MAX_H:
            raise SystemExit('Quadro grande demais: %s %dx%d' % (key, w, h))
        if cur is not None and cur['x'] + w + PAD > MAX_W:   # nova prateleira
            cur['y'] += cur['shelf']
            cur['x'], cur['shelf'] = 0, 0
        if cur is None or cur['y'] + h + PAD > MAX_H:        # novo atlas
            cur = dict(x=0, y=0, shelf=0, w=0, h=0)
            atlases.append(cur)
        pos[key] = (len(atlases) - 1, cur['x'], cur['y'])
        cur['x'] += w + PAD
        cur['shelf'] = max(cur['shelf'], h + PAD)
        cur['w'] = max(cur['w'], cur['x'])
        cur['h'] = max(cur['h'], cur['y'] + cur['shelf'])
    return pos, atlases


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--www', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--id', required=True)
    ap.add_argument('--src', action='append', required=True)
    ap.add_argument('--exclude', default='', help='prefixos de animação a ignorar, separados por vírgula')
    args = ap.parse_args()

    types = load_types(args.www)
    excl = [e for e in args.exclude.split(',') if e]
    anims = []  # (nome, anim original, quadros selecionados)
    for spec in args.src:
        tname, sel = parse_src(spec)
        src = types[tname]
        if sel is None:
            for a in src:
                if any(a['name'].startswith(p) for p in excl):
                    continue
                anims.append((a['name'], a, a['frames']))
        else:
            byname = {a['name']: a for a in src}
            for old, new, frame in sel:
                a = byname[old]
                fr = a['frames'] if frame is None else [a['frames'][frame]]
                anims.append((new, a, fr))

    # quadros únicos
    uniq = {}
    for _, _, frames in anims:
        for f in frames:
            k = (f['img'], f['x'], f['y'], f['w'], f['h'])
            uniq.setdefault(k, (f['w'], f['h']))
    pos, atlases = pack([(k, w, h) for k, (w, h) in uniq.items()])

    sheets, imgs = {}, [Image.new('RGBA', (a['w'], a['h']), (0, 0, 0, 0)) for a in atlases]
    for k, (ai, x, y) in pos.items():
        if k[0] not in sheets:
            sheets[k[0]] = Image.open(os.path.join(args.www, k[0])).convert('RGBA')
        crop = sheets[k[0]].crop((k[1], k[2], k[1] + k[3], k[2] + k[4]))
        imgs[ai].paste(crop, (x, y))

    os.makedirs(os.path.join(args.out, 'assets/img'), exist_ok=True)
    os.makedirs(os.path.join(args.out, 'data/sprites'), exist_ok=True)
    atlas_files = []
    for i, im in enumerate(imgs):
        rel = 'assets/img/%s_%d.png' % (args.id, i)
        im.save(os.path.join(args.out, rel), optimize=True)
        atlas_files.append(rel)

    out = dict(id=args.id, atlases=atlas_files, anims={})
    for name, a, frames in anims:
        fl = []
        for f in frames:
            k = (f['img'], f['x'], f['y'], f['w'], f['h'])
            ai, x, y = pos[k]
            ox, oy = round(f['hx'] * f['w']), round(f['hy'] * f['h'])
            pts = [[round(p[1] * f['w']) - ox, round(p[2] * f['h']) - oy] for p in (f['pts'] or [])]
            fl.append([ai, x, y, f['w'], f['h'], ox, oy, f['dur']] + ([pts] if pts else []))
        out['anims'][name] = dict(fps=a['speed'], loop=bool(a['loop']), repeatTo=a['repeatTo'],
                                  pingpong=bool(a['pingpong']), frames=fl)
    with open(os.path.join(args.out, 'data/sprites/%s.json' % args.id), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print('%s: %d animações, %d quadros únicos, %d atlas %s' % (
        args.id, len(out['anims']), len(uniq), len(imgs), [im.size for im in imgs]))


if __name__ == '__main__':
    main()
