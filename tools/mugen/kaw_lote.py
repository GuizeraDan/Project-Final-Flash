#!/usr/bin/env python3
"""Extrai os personagens do manifesto que já estão copiados para cá.

Uso: python kaw_lote.py manifest.tsv pasta_saida [nome_da_pasta ...]
Para cada personagem gera <saida>/<id>/png/*.png, sprites.json, anims.json, info.json.
"""
import csv, json, os, re, sys, time, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sff_extract, air_parse

BASE = '/mnt/user-data/uploads/KODAIKA Super Anime War 5 Mugen/chars'
DEFS = {}
if os.path.exists('defs.json'):
    DEFS = json.load(open('defs.json'))


ESPECIAIS = {'Goku (MUI)': 'kaw_goku_mui_v2'}  # evita colisão com "Goku MUI"


def slug(nome):
    if nome in ESPECIAIS: return ESPECIAIS[nome]
    s = unicodedata.normalize('NFKD', nome).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^A-Za-z0-9]+', '_', s).strip('_').lower()
    return 'kaw_' + s


def main():
    man, out = sys.argv[1], sys.argv[2]
    so = set(sys.argv[3:])
    rows = [r for r in csv.reader(open(man), delimiter='\t') if r]
    for pasta, sff, air, tam in rows:
        if so and pasta not in so: continue
        cid = slug(pasta); dest = os.path.join(out, cid)
        if os.path.exists(os.path.join(dest, 'info.json')):
            continue
        sp = os.path.join(BASE, pasta, sff); ap = os.path.join(BASE, pasta, air)
        if not os.path.exists(sp) or os.path.getsize(sp) != int(tam):
            print(f'[aguardando] {pasta}'); continue
        t0 = time.time()
        png = os.path.join(dest, 'png'); os.makedirs(png, exist_ok=True)
        b = open(sp, 'rb').read()
        ver = b[15]
        act = None
        if ver != 2 and DEFS.get(pasta, {}).get('pal1'):
            apath = os.path.join(BASE, pasta, DEFS[pasta]['pal1'].replace('\\', '/'))
            if not os.path.exists(apath):  # Windows ignora maiúsculas
                d, f = os.path.split(apath)
                for root, _, fs in os.walk(os.path.join(BASE, pasta)):
                    for x in fs:
                        if os.path.join(root, x).lower() == apath.lower(): apath = os.path.join(root, x)
            if os.path.exists(apath): act = sff_extract.load_act(apath)
        try:
            linhas, falhas = (sff_extract.extract_v2(b, png) if ver == 2
                              else sff_extract.extract_v1(b, png, act))
        except Exception as e:
            print(f'[ERRO] {pasta}: {e}', flush=True); continue
        finally:
            del b
        sprites = [dict(g=g, i=i, ex=ax, ey=ay, w=w, h=h, arq=f) for g, i, ax, ay, w, h, f in linhas]
        json.dump(sprites, open(os.path.join(dest, 'sprites.json'), 'w'))
        anims = {}
        if os.path.exists(ap):
            anims = air_parse.parse(open(ap, 'rb').read().decode('latin-1'))
        json.dump(anims, open(os.path.join(dest, 'anims.json'), 'w'), ensure_ascii=False)
        unicos = len({s['arq'] for s in sprites})
        info = dict(id=cid, pasta=pasta, sff=sff, versao_sff=ver, sprites=len(sprites),
                    pngs=unicos, falhas=falhas, animacoes=len(anims),
                    nomeadas=sum(1 for a in anims.values() if a['nome']))
        json.dump(info, open(os.path.join(dest, 'info.json'), 'w'), ensure_ascii=False, indent=1)
        print(f"[ok] {pasta}: {len(sprites)} sprites ({unicos} PNGs), {falhas} falhas, "
              f"{len(anims)} anims, {time.time()-t0:.0f}s", flush=True)


if __name__ == '__main__':
    main()
