#!/usr/bin/env python3
"""
Monta um sprite do jogo (atlas PNG + data/sprites/<id>.json) a partir de uma pasta (ou ZIP) de imagens
soltas que o usuário mandou, seguindo uma "receita" em tools/receitas/<id>.json.

Uso: python3 -I tools/importar_sprites.py tools/receitas/bills.json --origem /caminho/pasta_ou.zip
     (depois: python3 tools/build_bundle.py)

Receita:
{
  "id": "bills",                      sprite gerado (assets/img/<id>_0.png + data/sprites/<id>.json)
  "arquivo": "Bills_{n:02d}.png",     nome de cada imagem a partir do número do quadro
  "fundo": "auto",                    auto = cor da borda vira transparente (só a parte ligada à borda)
  "tol": 10,
  "anims": {
    "Parado": {"quadros": [3, 8], "fps": 3, "loop": true},
    "Rajada": {"quadros": [89, 90], "fps": 10, "disparo": "auto"},        ponto de disparo em todos os quadros
    "Bola":   {"quadros": [92, 93], "fps": 12, "loop": true, "origem": "centro"},
    ...
  }
}
- origem "pes" (padrão, lutadores): x = centro da cabeça (alinha o corpo entre quadros), y = pé (base do desenho).
- origem "centro" (efeitos): centro do desenho.
- disparo: "auto" (ponta mais à frente na altura dos braços), {"<índice>": "auto" | [dx, dy]} só em alguns quadros.
- dur: [1, 2, ...] duração de cada quadro (em batidas de 1/fps).
"""
import argparse, json, os, sys, zipfile, io
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def abrir_origem(caminho):
    """devolve função nome -> Image"""
    if os.path.isdir(caminho):
        def ler(nome):
            for raiz, _, arqs in os.walk(caminho):
                if nome in arqs:
                    return Image.open(os.path.join(raiz, nome))
            raise FileNotFoundError(nome)
        return ler
    z = zipfile.ZipFile(caminho)
    mapa = {os.path.basename(n): n for n in z.namelist()}
    return lambda nome: Image.open(io.BytesIO(z.read(mapa[nome])))


def tirar_fundo(im, tol):
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    # cor mais comum na borda
    cont = {}
    for x in range(w):
        for y in (0, h - 1):
            cont[px[x, y]] = cont.get(px[x, y], 0) + 1
    for y in range(h):
        for x in (0, w - 1):
            cont[px[x, y]] = cont.get(px[x, y], 0) + 1
    cor = max(cont, key=cont.get)
    if cor[3] == 0:
        return im
    perto = lambda c: c[3] > 0 and abs(c[0] - cor[0]) <= tol and abs(c[1] - cor[1]) <= tol and abs(c[2] - cor[2]) <= tol
    vistos = bytearray(w * h)
    pilha = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while pilha:
        x, y = pilha.pop()
        if x < 0 or y < 0 or x >= w or y >= h or vistos[y * w + x]:
            continue
        vistos[y * w + x] = 1
        if perto(px[x, y]):
            px[x, y] = (0, 0, 0, 0)
            pilha += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return im


def centro_cabeca(im):
    w, h = im.size
    a = im.split()[3].load()
    xs = [x for y in range(max(1, int(h * 0.3))) for x in range(w) if a[x, y]]
    return sum(xs) / len(xs) if xs else w / 2


def ponta(im):
    """ponto mais à frente (direita) na faixa dos braços"""
    w, h = im.size
    a = im.split()[3].load()
    melhor = (w - 1, h // 3)
    achou = -1
    for y in range(int(h * 0.15), int(h * 0.6)):
        for x in range(w - 1, -1, -1):
            if a[x, y]:
                if x > achou:
                    achou, melhor = x, (x, y)
                break
    return melhor


def empacotar(imgs, largura_max=1024, margem=1):
    """prateleiras, maiores primeiro; devolve (atlas, posições)"""
    ordem = sorted(range(len(imgs)), key=lambda i: -imgs[i].height)
    pos = [None] * len(imgs)
    x = y = alt = 0
    W = 0
    for i in ordem:
        im = imgs[i]
        if x + im.width > largura_max and x > 0:
            y += alt + margem
            x = alt = 0
        pos[i] = (x, y)
        x += im.width + margem
        alt = max(alt, im.height)
        W = max(W, x)
    H = y + alt
    atlas = Image.new('RGBA', (max(1, W), max(1, H)), (0, 0, 0, 0))
    for i, im in enumerate(imgs):
        atlas.paste(im, pos[i])
    return atlas, pos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('receita')
    ap.add_argument('--origem', required=True, help='pasta ou .zip com as imagens')
    a = ap.parse_args()
    rc = json.load(open(a.receita))
    ler = abrir_origem(a.origem)
    sid = rc['id']
    tol = rc.get('tol', 10)

    cache = {}       # número -> (img recortada, deslocamento x, y no original)

    def quadro(n):
        if n not in cache:
            im = ler(rc['arquivo'].format(n=n))
            if rc.get('fundo', 'auto') == 'auto':
                im = tirar_fundo(im, tol)
            else:
                im = im.convert('RGBA')
            bb = im.getbbox() or (0, 0, 1, 1)
            cache[n] = im.crop(bb)
        return cache[n]

    nums = []
    for nome, an in rc['anims'].items():
        for n in an['quadros']:
            quadro(n)
            if n not in nums:
                nums.append(n)
    imgs = [cache[n] for n in nums]
    atlas, pos = empacotar(imgs, rc.get('larguraAtlas', 1024))
    idx = {n: i for i, n in enumerate(nums)}
    caminho = 'assets/img/%s_0.png' % sid
    atlas.save(os.path.join(RAIZ, caminho), optimize=True)

    anims = {}
    for nome, an in rc['anims'].items():
        origem = an.get('origem', 'pes')
        disp = an.get('disparo')
        durs = an.get('dur') or []
        fr = []
        for k, n in enumerate(an['quadros']):
            im = cache[n]
            x, y = pos[idx[n]]
            if origem == 'centro':
                ox, oy = im.width // 2, im.height // 2
            else:
                ox, oy = int(round(centro_cabeca(im))), im.height
            ox += an.get('ajusteX', 0)
            oy += an.get('ajusteY', 0)
            q = [0, x, y, im.width, im.height, ox, oy, durs[k] if k < len(durs) else 1]
            d = None
            if disp == 'auto':
                d = 'auto'
            elif isinstance(disp, dict):
                d = disp.get(str(k))
            if d == 'auto':
                px, py = ponta(im)
                q.append([[px - ox + 2, py - oy]])
            elif d:
                q.append([d])
            fr.append(q)
        anims[nome] = {'fps': an.get('fps', 10), 'loop': bool(an.get('loop', False)), 'repeatTo': an.get('repeatTo', 0), 'pingpong': False, 'frames': fr}

    d = {'id': sid, 'atlases': [caminho], 'anims': anims}
    if rc.get('escala'):
        d['escala'] = rc['escala']
    json.dump(d, open(os.path.join(RAIZ, 'data/sprites/%s.json' % sid), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('%s: %d animações, %d imagens, atlas %dx%d' % (sid, len(anims), len(nums), atlas.width, atlas.height))


if __name__ == '__main__':
    main()
