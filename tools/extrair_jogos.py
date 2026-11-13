#!/usr/bin/env python3
"""
Extrai os sprites dos outros jogos da pasta "Project Final Flash Sprites" para o acervo (veja tools/acervo_comum.py).
Cada jogo vira uma categoria do acervo no Estúdio; cada sprite ganha um tipo (personagens, efeitos, cenários,
interface, cutscenes) para os filtros.

Formatos:
  gamemaker  arquivo game.droid / data.win (GameMaker Studio): texturas PNG + tabela de recortes (TPAG) por sprite
  construct3 pasta www com data.json (Construct 3) — imagens .webp/.png em images/
  gdevelop   pasta www com data.js (GDevelop) — uma imagem por quadro
  pastas     pastas de PNGs soltos (cada pasta = um sprite; quadros em ordem numérica)
  unity      pasta Data de um jogo Unity 2017–2021 (texturas sem compressão + sprites; animações não)

Uso:
  python3 -I tools/extrair_jogos.py --formato gamemaker --origem <game.droid> --chave twiss --nome "Twiss Dragno" --out .
"""
import argparse, collections, io, json, os, re, struct, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import acervo_comum as AC


def natural(s):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', s)]


# ====================================================================== GameMaker
NOMES_TWISS = {
    'goku': 'Goku', 'goku1': 'Goku SSJ', 'goku2': 'Goku SSJ2', 'goku3': 'Goku SSJ3', 'goku4': 'Goku SSJ4', 'gokugod': 'Goku SSJ God',
    'gokuk': 'Goku Kaioken', 'bgoku': 'Goku SSJ Blue', 'bgokuk': 'Goku Blue Kaioken', 'uigoku': 'Goku Instinto Superior',
    'fuigoku': 'Goku Instinto Superior Completo', 'blackgoku': 'Goku Black', 'rosegoku': 'Goku Black Rosé', 'vegito': 'Vegetto',
    'bvegito': 'Vegetto Blue', 'bgogeta': 'Gogeta Blue', 'bvegeta': 'Vegeta Blue', 'vegetag': 'Vegeta God', 'vegeta4': 'Vegeta SSJ4',
    'uvegeta': 'Vegeta Ultra Ego', 'mbuu': 'Majin Boo', 'fbuu': 'Boo', 'kidbuu': 'Kid Boo', 'zamasu': 'Zamasu', 'fzamasu': 'Zamasu Fundido',
    'czamasu': 'Zamasu (corrompido)', 'ftrunks': 'Trunks do Futuro', 'strunks': 'Trunks Super', 'uppersj': 'Super Saiyajin (upper)',
    'ffrieza': 'Freeza Forma Final', 'gfrieza': 'Golden Freeza', 's1broly': 'Broly SSJ', 'rbroly': 'Broly (fúria)', 'brolyg': 'Broly Lendário',
    'pcell': 'Cell Perfeito', 'janem': 'Janemba', 'caulif': 'Caulifla', 'kefla': 'Kefla', 'toppo': 'Toppo', 'beerus': 'Bills', 'hit': 'Hit',
    'jiren': 'Jiren', 'arthur': 'Arthur', 'aranha': 'Aranha', 'ef': 'Efeitos gerais',
}


def ler_gamemaker(caminho):
    d = open(caminho, 'rb').read()
    U = lambda o: struct.unpack_from('<I', d, o)[0]
    H = lambda o: struct.unpack_from('<H', d, o)[0]
    I = lambda o: struct.unpack_from('<i', d, o)[0]
    ch, o = {}, 8
    while o < len(d):
        ch[d[o:o + 4].decode()] = (o + 8, U(o + 4))
        o += 8 + U(o + 4)

    def lista(nome):
        s, _ = ch[nome]
        return [U(s + 4 + 4 * i) for i in range(U(s))]

    st = lambda p: d[p:p + U(p - 4)].decode('utf-8', 'replace')
    texturas = []
    for p in lista('TXTR'):
        for k in range(0, 32, 4):
            q = U(p + k)
            if 0 < q < len(d) and d[q:q + 8] == b'\x89PNG\r\n\x1a\n':
                texturas.append(Image.open(io.BytesIO(d[q:])).convert('RGBA'))
                break
        else:
            texturas.append(None)
    tpag = {p: [H(p + 2 * i) for i in range(11)] for p in lista('TPAG')}
    sprites = []
    for p in lista('SPRT'):
        nome = st(U(p))
        ox, oy = I(p + 48), I(p + 52)
        q = p + 56
        fps = 12
        if U(q) == 0xFFFFFFFF:
            ver = U(q + 4)
            spd = struct.unpack_from('<f', d, q + 12)[0]
            stype = U(q + 16)
            fps = spd if stype == 0 else 12 * spd
            q += 20 + (4 if ver >= 2 else 0) + (4 if ver >= 3 else 0)
        n = U(q)
        frames = []
        for i in range(n):
            t = tpag.get(U(q + 4 + 4 * i))
            if not t or t[2] == 0 or t[3] == 0 or texturas[t[10]] is None:
                continue
            sx, sy, sw, sh, tx, ty = t[:6]
            frames.append(dict(img=t[10], x=sx, y=sy, w=sw, h=sh, ox=ox - tx, oy=oy - ty, dur=1))
        sprites.append((nome, round(fps, 2) or 12, frames))
    return texturas, sprites


def tipo_twiss(grupo):
    if grupo in ('hud', 'button', 'boton', 'shop', 'menu', 'face', 'main', 'online', 'player', 'title', 'mask', 'semilla', 'android', 'outros'):
        return 'interface'
    if grupo in ('bk', 'map', 'tile', 'cenarios'):
        return 'cenarios'
    if grupo in ('ef', 'effect', 'particle', 'habilidades', 'efeitos'):
        return 'efeitos'
    return 'personagens'


def fazer_gamemaker(a):
    texturas, sprites = ler_gamemaker(a.origem)
    fonte = AC.Fonte(a.out, a.chave, a.nome, lambda k: texturas[k])
    cont = collections.Counter(s[0].split('_')[1] if s[0].count('_') >= 2 else '' for s in sprites)
    grupos = collections.OrderedDict()
    for nome, fps, frames in sprites:
        if not frames:
            continue
        t = nome.split('_')
        g = t[1] if len(t) > 2 else ''
        if g and (cont[g] >= 15 or g == 'ef'):                 # personagem (ou efeitos gerais): um sprite por grupo
            chave, anim = g, '_'.join(t[2:])
        elif re.match(r'^s_?skill\d+', nome) or g.startswith('skill'):
            chave, anim = 'habilidades', nome[2:] if nome.startswith('s_') else nome
        elif g in ('effect', 'particle'):
            chave, anim = 'efeitos', nome[2:]
        elif g in ('bk', 'map', 'tile') or nome.startswith(('bk_', 'tile')):
            chave, anim = 'cenarios', nome
        else:
            chave, anim = 'outros', nome
        grupos.setdefault(chave, []).append((anim or nome, dict(fps=fps, loop=True, frames=frames), nome))
    nomes = {'habilidades': 'Habilidades (efeitos)', 'efeitos': 'Efeitos e partículas', 'cenarios': 'Cenários e fundos', 'outros': 'Interface e menus'}
    for chave, anims in grupos.items():
        nome = NOMES_TWISS.get(chave) or nomes.get(chave) or chave
        if chave in NOMES_TWISS and chave != 'ef':
            nome += ' (%s)' % chave
        fonte.gravar('%s_%s' % (a.chave, AC.slug(chave)), nome, tipo_twiss(chave), [(n, v) for n, v, _ in anims],
                     sorted(set(o for _, _, o in anims)), cat=a.chave)
    fonte.fechar({a.chave: a.nome})



# ====================================================================== classificação por nome (Construct 3 / GDevelop / pastas)
R_EFEITO = re.compile(r'(efeit|effect|^ef_|_ef$|fx|ki|blast|explos|aura|poeira|dust|raio|beam|kame|hit|impact|bola|ball|esfera|sphere|'
                      r'energ|onda|wave|fogo|fire|thunder|light|rajada|tiro|shot|laser|genki|makanko|kienzan|disco|flash|spark|smoke|fuma)', re.I)
R_INTERF = re.compile(r'(hud|bot[aã]o|botoes|button|btn|menu|seta|arrow|barra|bar$|_bar|icon|icone|face|txt|texto|text|font|logo|'
                      r'loja|shop|moeda|coin|select|sele[cç]|painel|panel|janela|window|dialog|numero|number|vida|hp|life|joystick|'
                      r'tutorial|config|pause|loading|carreg|tela|screen|cursor|placa|banner|card|carta|ranking|title|titulo)', re.I)
R_CENARIO = re.compile(r'(cenario|cen[aá]rio|fundo|background|^bg|_bg|parallax|chao|ch[aã]o|ground|floor|tile|mapa|map|ceu|sky|nuvem|cloud|'
                       r'montanha|mountain|pedra|rock|arvore|tree|agua|water|predio|building|stage)', re.I)


def classificar(nome, n_anims, maior):
    """tipo do sprite pelo nome do objeto, nº de animações e maior quadro (w, h)"""
    if R_CENARIO.search(nome) or maior[0] >= 600 or maior[1] >= 400:
        return 'cenarios'
    if n_anims >= 10 and not R_INTERF.search(nome):
        return 'personagens'
    if R_INTERF.search(nome):
        return 'interface'
    if R_EFEITO.search(nome):
        return 'efeitos'
    return 'personagens' if n_anims >= 6 else 'efeitos'


def gravar_objetos(a, fonte, objs):
    """objs: [(nome, [(anim, dict(fps, loop, frames))])] → um sprite por objeto (iguais são juntados)"""
    vistos, usados = {}, set()
    for nome, anims in objs:
        anims = [(n, v) for n, v in anims if v['frames']]
        if not anims:
            continue
        maior = (max(f['w'] for _, v in anims for f in v['frames']), max(f['h'] for _, v in anims for f in v['frames']))
        if maior[0] * maior[1] <= 64:                           # vazio/invisível
            continue
        sig = tuple((n, tuple((f['img'], f['x'], f['y'], f['w'], f['h']) for f in v['frames'])) for n, v in anims)
        if sig in vistos:
            vistos[sig].append(nome)
            continue
        vistos[sig] = [nome]
        sid = '%s_%s' % (a.chave, AC.slug(nome) or 'obj')
        while sid in usados:
            sid += '_'
        usados.add(sid)
        fonte.gravar(sid, nome, classificar(nome, len(anims), maior), anims, vistos[sig], cat=a.chave)


# ====================================================================== Construct 3 (data.json)
def fazer_construct3(a):
    www = a.origem
    proj = json.load(open(os.path.join(www, 'data.json'), encoding='utf-8-sig'))['project']
    cache = {}

    def folha(p):
        if p not in cache:
            if len(cache) > 30:
                cache.clear()
            cache[p] = Image.open(os.path.join(www, p)).convert('RGBA')
        return cache[p]

    objs = []
    for t in proj[3]:
        if not (len(t) > 7 and isinstance(t[7], list)):
            continue
        anims = []
        for an in t[7]:
            if not (isinstance(an, list) and len(an) > 7 and isinstance(an[0], str) and isinstance(an[7], list)):
                continue
            fr = []
            for f in an[7]:
                if not (isinstance(f, list) and isinstance(f[0], str)) or not os.path.exists(os.path.join(www, f[0])):
                    continue
                x, y, w, h, dur, hx, hy = f[2], f[3], f[4], f[5], f[7], f[8], f[9]
                ox, oy = round(hx * w), round(hy * h)
                pts = [[round(p[1] * w) - ox, round(p[2] * h) - oy] for p in (f[10] or []) if isinstance(p, list) and len(p) >= 3]
                fr.append(dict(img=f[0], x=x, y=y, w=w, h=h, ox=ox, oy=oy, dur=dur, pts=pts))
            anims.append((an[0], dict(fps=an[1], loop=an[2], repeatTo=an[4], pingpong=an[5], frames=fr)))
        objs.append((t[0], anims))
    fonte = AC.Fonte(a.out, a.chave, a.nome, folha)
    gravar_objetos(a, fonte, objs)
    fonte.fechar({a.chave: a.nome})


# ====================================================================== GDevelop (data.js)
def fazer_gdevelop(a):
    www = a.origem
    s = open(os.path.join(www, 'data.js'), encoding='utf-8').read()
    proj, _ = json.JSONDecoder().raw_decode(s[s.index('{'):])
    arq = {r['name']: r['file'] for r in proj['resources']['resources'] if r.get('kind') == 'image'}
    tam = {}

    def caminho(nome):
        f = arq.get(nome, nome)
        p = os.path.join(www, f)
        return p if os.path.exists(p) else None

    def tamanho(nome):
        if nome not in tam:
            p = caminho(nome)
            tam[nome] = Image.open(p).size if p else None
        return tam[nome]

    cache = {}

    def folha(nome):
        if nome not in cache:
            if len(cache) > 200:
                cache.clear()
            cache[nome] = Image.open(caminho(nome)).convert('RGBA')
        return cache[nome]

    todos = list(proj.get('objects', []))
    for l in proj.get('layouts', []):
        todos += l.get('objects', [])
    for l in proj.get('externalLayouts', []):
        todos += l.get('objects', []) if isinstance(l, dict) else []
    vistos_nome, objs = set(), []
    for o in todos:
        if o.get('type') != 'Sprite' or o['name'] in vistos_nome:
            continue
        vistos_nome.add(o['name'])
        anims = []
        for an in o.get('animations', []):
            for di, dr in enumerate(an.get('directions', [])):
                fr = []
                for sp in dr.get('sprites', []):
                    t = tamanho(sp['image'])
                    if not t:
                        continue
                    op = sp.get('originPoint') or {'x': 0, 'y': 0}
                    fr.append(dict(img=sp['image'], x=0, y=0, w=t[0], h=t[1], ox=op['x'], oy=op['y'], dur=1,
                                   pts=[[p['x'] - op['x'], p['y'] - op['y']] for p in sp.get('points', [])]))
                tb = dr.get('timeBetweenFrames') or 0.1
                nome = an.get('name') or 'anim%d' % len(anims)
                if len(an.get('directions', [])) > 1:
                    nome += '_dir%d' % di
                anims.append((nome, dict(fps=round(1 / tb, 2) if tb > 0 else 10, loop=dr.get('looping', False), frames=fr)))
        objs.append((o['name'], anims))
    fonte = AC.Fonte(a.out, a.chave, a.nome, folha)
    gravar_objetos(a, fonte, objs)
    fonte.fechar({a.chave: a.nome})


# ====================================================================== pastas de PNGs soltos
def fazer_pastas(a):
    """--origem: pasta com subpastas. Cada pasta que tem PNGs vira um sprite com uma animação "Todos" (todos os
    quadros em ordem) e, se os nomes tiverem grupos (ex.: Goku_Parado_1.png), uma animação por grupo.
    Origem: centro-baixo da área visível de cada quadro."""
    raiz = a.origem
    ign = set((a.ignorar or '').split(',')) - {''}
    cache = {}

    def folha(p):
        if p not in cache:
            if len(cache) > 300:
                cache.clear()
            cache[p] = Image.open(os.path.join(raiz, p)).convert('RGBA')
        return cache[p]

    fonte = AC.Fonte(a.out, a.chave, a.nome, folha)
    usados = set()
    for d, dirs, files in sorted(os.walk(raiz)):
        rel = os.path.relpath(d, raiz)
        if any(part in ign for part in rel.split(os.sep)):
            dirs[:] = []
            continue
        dirs.sort()
        pngs = sorted([f for f in files if f.lower().endswith('.png')], key=natural)
        if not pngs:
            continue
        fr = []
        for f in pngs:
            p = os.path.join(rel, f) if rel != '.' else f
            try:
                im = folha(p)
            except Exception:
                continue
            bb = im.getbbox()
            if not bb:
                continue
            x0, y0, x1, y1 = bb
            fr.append((f, dict(img=p, x=x0, y=y0, w=x1 - x0, h=y1 - y0, ox=(x1 - x0) / 2, oy=y1 - y0, dur=1)))
        if not fr:
            continue
        anims = [('Todos', dict(fps=10, loop=True, frames=[q for _, q in fr]))]
        grupos = collections.OrderedDict()
        for f, q in fr:
            g = re.sub(r'[\s_\-]*\d+$', '', os.path.splitext(f)[0])
            grupos.setdefault(g, []).append(q)
        if 1 < len(grupos) < len(fr):
            anims += [(g or 'grupo', dict(fps=10, loop=True, frames=qs)) for g, qs in grupos.items()]
        nome = rel.replace(os.sep, ' / ') if rel != '.' else a.nome
        sid = '%s_%s' % (a.chave, AC.slug(rel) or 'raiz')
        while sid in usados:
            sid += '_'
        usados.add(sid)
        tipo = 'cenarios' if R_CENARIO.search(rel) else 'interface' if R_INTERF.search(rel) else 'efeitos' if (R_EFEITO.search(rel) and not re.search(r'goku|vegeta|gohan|broly', rel, re.I)) else 'personagens'
        fonte.gravar(sid, nome, tipo, anims, [rel], cat=a.chave)
    fonte.fechar({a.chave: a.nome})



# ====================================================================== Unity (SerializedFile sem typetree, 2017–2021)
class _R:
    def __init__(s, d, o=0, le=True):
        s.d, s.o, s.e = d, o, '<' if le else '>'

    def u(s, f, n):
        v = struct.unpack_from(s.e + f, s.d, s.o)[0]
        s.o += n
        return v

    def i32(s): return s.u('i', 4)
    def u32(s): return s.u('I', 4)
    def i64(s): return s.u('q', 8)
    def u8(s): return s.u('B', 1)
    def f32(s): return s.u('f', 4)

    def cstr(s):
        e = s.d.index(b'\0', s.o)
        v = s.d[s.o:e].decode('utf-8', 'replace')
        s.o = e + 1
        return v

    def align(s): s.o = (s.o + 3) & ~3

    def s_(s):
        n = s.i32()
        v = s.d[s.o:s.o + n].decode('utf-8', 'replace')
        s.o += n
        s.align()
        return v


def _unity_arquivo(d):
    r = _R(d, 0, False)
    msize, fsize, ver, doff = r.u32(), r.u32(), r.u32(), r.u32()
    if ver < 9 or ver > 30 or doff > len(d):
        return None
    endian = r.u8(); r.o += 3
    if ver >= 22:
        msize = r.u32(); fsize = r.i64(); doff = r.i64(); r.o += 8
    r.e = '<' if endian == 0 else '>'
    uv = r.cstr(); r.i32()
    tt = bool(r.u8()) if ver >= 13 else True
    if tt:
        return dict(uv=uv, typetree=True, objs=[])         # com typetree: formato diferente (não usado nestes jogos)
    tipos = []
    for _ in range(r.i32()):
        cid = r.i32()
        if ver >= 16: r.u8()
        if ver >= 17: r.u('h', 2)
        if ver >= 13:
            if (ver < 16 and cid < 0) or (ver >= 16 and cid == 114): r.o += 16
            r.o += 16
        tipos.append(cid)
    objs = []
    for _ in range(r.i32()):
        if ver >= 14: r.align()
        pid = r.i64() if ver >= 14 else r.i32()
        bs = r.i64() if ver >= 22 else r.u32()
        bz = r.u32(); ti = r.i32()
        cid = tipos[ti] if ver >= 16 else ti
        if ver < 16: r.u('H', 2); r.u('h', 2)
        if 11 <= ver < 17 and ver != 16: pass
        objs.append((pid, doff + bs, bz, cid))
    return dict(uv=uv, typetree=False, objs=objs)


def _vu(uv):
    m = re.match(r'(\d+)\.(\d+)\.(\d+)', uv)
    return tuple(int(x) for x in m.groups()) if m else (2019, 4, 0)


def _unity_textura(d, o, v):
    r = _R(d, o)
    t = dict(nome=r.s_())
    if v >= (2017, 3):
        r.i32(); r.u8()
        if v >= (2020, 2): r.u8()
        r.align()
    t['w'], t['h'], t['tam'] = r.i32(), r.i32(), r.i32()
    if v >= (2020, 1): r.i32()
    t['fmt'] = r.i32()
    if v < (5, 2): r.u8()
    else: r.i32()
    r.u8()                                                  # readable
    if v >= (2020, 1): r.u8()
    if v >= (2019, 3): r.u8()
    if v >= (2022, 2):
        r.align(); r.s_()                                   # m_MipmapLimitGroupName
    if v < (5, 5): r.u8()
    if v >= (2018, 2): r.u8()
    r.align()
    if v >= (2018, 2): r.i32()
    r.i32(); r.i32()                                        # imageCount, dimension
    r.o += 4 * (6 if v >= (2017,) else 4)                   # settings
    r.i32(); r.i32()                                        # lightmap, colorspace
    if v >= (2020, 2):
        n = r.i32(); r.o += n; r.align()
    n = r.i32()
    t['dados'] = d[r.o:r.o + n]; r.o += n; r.align()
    t['stream'] = None
    if not n:
        off = r.i64() if v >= (2020, 1) else r.u32()
        sz = r.u32(); t['stream'] = (off, sz, r.s_())
    return t


def _unity_sprite(d, o, v):
    r = _R(d, o)
    s = dict(nome=r.s_())
    s['rect'] = [r.f32() for _ in range(4)]
    r.f32(); r.f32()
    if v >= (4, 5): r.o += 16
    r.f32()                                                 # pixelsToUnits
    s['pivot'] = [r.f32(), r.f32()] if v >= (5, 4, 2) else [0.5, 0.5]
    r.u32()
    if v >= (5, 3): r.u8()
    r.align()
    if v >= (2017,):
        r.o += 24
        for _ in range(r.i32()): r.s_()
        r.i32(); r.i64()
    r.i32(); s['tex'] = r.i64()
    return s


FMT_UNITY = {10: 'DXT1', 12: 'DXT5', 34: 'ETC1', 45: 'ETC2_RGB', 46: 'ETC2_RGBA1', 47: 'ETC2_RGBA8', 1: 'A8', 2: 'ARGB4444', 3: 'RGB24', 4: 'RGBA32', 5: 'ARGB32', 7: 'RGB565', 13: 'RGBA4444', 14: 'BGRA32', 63: 'R8'}


def _unity_imagem(t, dados):
    import numpy as np
    w, h, f = t['w'], t['h'], FMT_UNITY.get(t['fmt'])
    if not f:
        return None
    if f.startswith('ETC') or f.startswith('DXT'):
        import etc
        a = etc.decodificar(dados, w, h, f)
        return Image.fromarray(a, 'RGBA').transpose(Image.FLIP_TOP_BOTTOM)
    n = w * h
    if f in ('RGBA32', 'ARGB32', 'BGRA32'):
        a = np.frombuffer(dados[:n * 4], np.uint8).reshape(h, w, 4)
        if f == 'ARGB32': a = a[:, :, [1, 2, 3, 0]]
        if f == 'BGRA32': a = a[:, :, [2, 1, 0, 3]]
    elif f == 'RGB24':
        a = np.frombuffer(dados[:n * 3], np.uint8).reshape(h, w, 3)
        a = np.dstack([a, np.full((h, w), 255, np.uint8)])
    elif f in ('A8', 'R8'):
        x = np.frombuffer(dados[:n], np.uint8).reshape(h, w)
        a = np.dstack([np.full((h, w), 255, np.uint8)] * 3 + [x]) if f == 'A8' else np.dstack([x, x, x, np.full((h, w), 255, np.uint8)])
    else:
        x = np.frombuffer(dados[:n * 2], '<u2').reshape(h, w).astype(np.uint32)
        if f == 'RGB565':
            a = np.dstack([((x >> 11) & 31) * 255 // 31, ((x >> 5) & 63) * 255 // 63, (x & 31) * 255 // 31, np.full((h, w), 255)])
        else:
            c = [(x >> 12) & 15, (x >> 8) & 15, (x >> 4) & 15, x & 15]
            if f == 'ARGB4444': c = [c[1], c[2], c[3], c[0]]
            a = np.dstack([q * 17 for q in c])
        a = a.astype(np.uint8)
    return Image.fromarray(np.ascontiguousarray(a), 'RGBA').transpose(Image.FLIP_TOP_BOTTOM)



def _lz4(src, tam):
    """descompressão de bloco LZ4 (puro Python)"""
    dst = bytearray()
    i, n = 0, len(src)
    while i < n:
        tok = src[i]; i += 1
        ln = tok >> 4
        if ln == 15:
            while True:
                b = src[i]; i += 1; ln += b
                if b != 255: break
        dst += src[i:i + ln]; i += ln
        if i >= n: break
        off = src[i] | (src[i + 1] << 8); i += 2
        ml = tok & 15
        if ml == 15:
            while True:
                b = src[i]; i += 1; ml += b
                if b != 255: break
        ml += 4
        ini = len(dst) - off
        if off >= ml:
            dst += dst[ini:ini + ml]
        else:
            for k in range(ml):
                dst.append(dst[ini + k])
    return bytes(dst)


def _descomprimir(dados, modo, tam):
    if modo == 0:
        return dados
    if modo == 1:
        import lzma
        props, dsz = dados[0], struct.unpack_from('<I', dados, 1)[0]
        lc, lp, pb = props % 9, (props // 9) % 5, props // 45
        f = [{'id': lzma.FILTER_LZMA1, 'dict_size': dsz, 'lc': lc, 'lp': lp, 'pb': pb}]
        return lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=f).decompress(dados[5:], tam)
    if modo in (2, 3):
        return _lz4(dados, tam)
    raise ValueError('compressão %d' % modo)


def _unityfs(d):
    """pacote UnityFS → {nome: bytes}"""
    r = _R(d, 8, False)
    ver = r.u32(); r.cstr(); r.cstr()
    r.i64(); csz, usz, flags = r.u32(), r.u32(), r.u32()
    if ver >= 7: r.o = (r.o + 15) & ~15
    if flags & 0x80:
        info = d[len(d) - csz:]
    else:
        info = d[r.o:r.o + csz]; r.o += csz
    info = _descomprimir(info, flags & 0x3F, usz)
    q = _R(info, 16, False)
    blocos = []
    for _ in range(q.i32()):
        blocos.append((q.u32(), q.u32(), q.u('H', 2)))
    nos = []
    for _ in range(q.i32()):
        nos.append((q.i64(), q.i64(), q.u32(), q.cstr()))
    if flags & 0x200: r.o = (r.o + 15) & ~15
    dados = bytearray()
    for us, cs, fl in blocos:
        dados += _descomprimir(d[r.o:r.o + cs], fl & 0x3F, us); r.o += cs
    return {os.path.basename(n): bytes(dados[o:o + s]) for o, s, _, n in nos}


def fazer_unity(a):
    """--origem: pasta Data do jogo Unity (assets/bin/Data). Cada textura com sprites vira um sprite do acervo,
    com a animação "Todos" (quadros em ordem de nome) e uma por grupo de nome; as animações originais
    (AnimationClip) não são lidas — monte-as no Estúdio a partir desses quadros."""
    raiz = a.origem
    texturas, sprites, sem_formato = {}, [], collections.Counter()
    # arquivos soltos da pasta Data + o conteúdo dos pacotes UnityFS (data.unity3d, *.bundle)
    virtuais = {}
    for f in sorted(os.listdir(raiz)):
        p = os.path.join(raiz, f)
        if not os.path.isfile(p) or re.search(r'\.(resource|config|json|dll|txt|xml)$', f):
            continue
        with open(p, 'rb') as fh:
            ini = fh.read(8)
        if ini == b'UnityFS\0':
            print('abrindo pacote', f, flush=True)
            with open(p, 'rb') as fh:
                virtuais.update(_unityfs(fh.read()))
        else:
            virtuais[f] = p
    ler_v = lambda f: virtuais[f] if isinstance(virtuais[f], bytes) else open(virtuais[f], 'rb').read()
    arquivos = [f for f in virtuais if not f.endswith('.resS')]
    for fn in arquivos:
        d = ler_v(fn)
        try:
            m = _unity_arquivo(d)
        except Exception:
            m = None
        if not m or m['typetree']:
            continue
        v = _vu(m['uv'])
        for pid, o, sz, cid in m['objs']:
            try:
                if cid == 28:
                    t = _unity_textura(d, o, v)
                    if t['w'] * t['h'] == 0:
                        continue
                    dados = t['dados']
                    if t['stream'] and t['stream'][1]:
                        rs = os.path.basename(t['stream'][2])
                        if rs in virtuais:
                            v_ = virtuais[rs]
                            if isinstance(v_, bytes):
                                dados = v_[t['stream'][0]:t['stream'][0] + t['stream'][1]]
                            else:
                                with open(v_, 'rb') as fh:
                                    fh.seek(t['stream'][0]); dados = fh.read(t['stream'][1])
                    t['arq'], t['dados'] = fn, dados
                    texturas[(fn, pid)] = t
                elif cid == 213:
                    s = _unity_sprite(d, o, v)
                    s['arq'] = fn
                    sprites.append(s)
            except Exception:
                continue
    imgs = {}

    def folha(k):
        return imgs[k]

    por_tex = collections.OrderedDict()
    for s in sprites:
        k = (s['arq'], s['tex'])
        if k in texturas:
            por_tex.setdefault(k, []).append(s)
    for k in texturas:                                       # textura sem recortes (atlas empacotado, cenário…): folha inteira
        if k not in por_tex and texturas[k]['w'] * texturas[k]['h'] > 64 and not texturas[k]['nome'].startswith('UnitySplash'):
            t = texturas[k]
            por_tex[k] = [dict(nome=t['nome'], rect=[0, 0, t['w'], t['h']], pivot=[0.5, 0.0], inteira=True)]
    fonte = AC.Fonte(a.out, a.chave, a.nome, folha)
    usados = set()
    for k, lista in por_tex.items():
        t = texturas[k]
        if k not in imgs:
            try:
                im = _unity_imagem(t, t['dados'])
            except Exception:
                im = None
            if im is None:
                sem_formato[t['fmt']] += 1
                continue
            imgs[k] = im
        fr = []
        for s in sorted(lista, key=lambda s: natural(s['nome'])):
            x, y, w, h = [int(round(q)) for q in s['rect']]
            if w <= 0 or h <= 0:
                continue
            top = t['h'] - y - h
            if s.get('inteira'):                             # corta a área transparente em volta
                bb = imgs[k].getbbox()
                if not bb:
                    continue
                x, top, w, h = bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]
                s['pivot'] = [0.5, 0.0]
            fr.append((s['nome'], dict(img=k, x=x, y=top, w=w, h=h, ox=s['pivot'][0] * w, oy=(1 - s['pivot'][1]) * h, dur=1)))
        if not fr:
            continue
        anims = [('Todos' if len(fr) > 1 else 'folha', dict(fps=10, loop=True, frames=[q for _, q in fr]))]
        grupos = collections.OrderedDict()
        for n, q in fr:
            grupos.setdefault(re.sub(r'[\s_\-]*\d+$', '', n), []).append(q)
        if 1 < len(grupos) < len(fr):
            anims += [(g or 'grupo', dict(fps=10, loop=True, frames=qs)) for g, qs in grupos.items()]
        sid = '%s_%s' % (a.chave, AC.slug(t['nome']) or 'tex')
        while sid in usados:
            sid += '_'
        usados.add(sid)
        maior = (max(q['w'] for _, q in fr), max(q['h'] for _, q in fr))
        fonte.gravar(sid, t['nome'], classificar(t['nome'], 10 if len(fr) >= 12 else 1, maior), anims, [t['arq']], cat=a.chave)
        del imgs[k]
    if sem_formato:
        print('texturas em formato comprimido não lido:', dict(sem_formato))
    fonte.fechar({a.chave: a.nome}, dict(sem_formato={str(k): v for k, v in sem_formato.items()}))


# ====================================================================== main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--formato', required=True, choices=['gamemaker', 'construct3', 'gdevelop', 'pastas', 'unity'])
    ap.add_argument('--origem', required=True)
    ap.add_argument('--chave', required=True, help='prefixo dos ids (ex.: twiss)')
    ap.add_argument('--nome', required=True, help='nome do jogo (categoria no Estúdio)')
    ap.add_argument('--out', required=True)
    ap.add_argument('--ignorar', default='', help='pastas: nomes de subpastas a pular, separados por vírgula')
    a = ap.parse_args()
    globals()['fazer_' + a.formato](a)
    AC.recompor(a.out)


if __name__ == '__main__':
    main()
