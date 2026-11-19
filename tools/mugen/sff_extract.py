#!/usr/bin/env python3
"""Extrai sprites de arquivos .sff do M.U.G.E.N (v1.0 e v2.x) para PNG.

Uso: python sff_extract.py arquivo.sff pasta_saida [--act paleta.act]
Gera <grupo>-<item>.png (fundo transparente) e axis.csv com os eixos.
"""
import io, os, struct, sys, csv
from PIL import Image


def u16(b, o): return struct.unpack_from('<H', b, o)[0]
def s16(b, o): return struct.unpack_from('<h', b, o)[0]
def u32(b, o): return struct.unpack_from('<I', b, o)[0]


# ---------- descompressores SFF v2 ----------
def rle8(src, size):
    out = bytearray(); i = 0
    while len(out) < size and i < len(src):
        d = src[i]; i += 1
        if d & 0xC0 == 0x40:
            n = d & 0x3F; d = src[i]; i += 1
            out += bytes([d]) * n
        else:
            out.append(d)
    return bytes(out[:size]).ljust(size, b'\0')


def rle5(src, size):
    out = bytearray(); i = 0; L = len(src)
    while len(out) < size and i < L:
        rl = src[i]; i += 1
        dl = src[i] & 0x7F; c = 0
        if src[i] >> 7:
            i += 1; c = src[i]
        i += 1
        while True:
            out.append(c); rl -= 1
            if rl < 0:
                dl -= 1
                if dl < 0: break
                c = src[i] & 0x1F; rl = src[i] >> 5; i += 1
    return bytes(out[:size]).ljust(size, b'\0')


def lz5(src, size):
    p = bytearray(size); L = len(src)
    i = j = 0
    def nxt():
        nonlocal i
        v = src[i] if i < L else 0
        if i < L - 1: i += 1
        return v
    ct = nxt(); cts = 0; rb = 0; rbc = 0
    while j < size:
        d = nxt()
        if ct & (1 << cts):
            if d & 0x3F == 0:
                d = ((d << 2) | nxt()) + 1
                n = nxt() + 2
            else:
                rb |= (d & 0xC0) >> rbc; rbc += 2
                n = d & 0x3F
                if rbc < 8:
                    d = nxt() + 1
                else:
                    d = rb + 1; rb = rbc = 0
            while True:
                if j < size:
                    p[j] = p[j - d] if j - d >= 0 else 0; j += 1
                n -= 1
                if n < 0: break
        else:
            if d & 0xE0 == 0:
                n = nxt() + 8
            else:
                n = d >> 5; d &= 0x1F
            while n > 0:
                if j < size: p[j] = d; j += 1
                n -= 1
        cts += 1
        if cts >= 8:
            ct = nxt(); cts = 0
    return bytes(p)


def load_act(path):
    raw = open(path, 'rb').read()[:768]
    cols = [tuple(raw[k*3:k*3+3]) for k in range(256)]
    return cols[::-1]  # .act do MUGEN é gravado invertido


def apply_pal(img, pal):
    flat = []
    for idx, c in enumerate(pal[:256]):
        flat += list(c[:3])
    flat += [0] * (768 - len(flat))
    img.putpalette(flat)
    img.info['transparency'] = 0
    return img


# ---------- SFF v2 ----------
def extract_v2(b, outdir, act=None):
    spr_off, nspr = u32(b, 0x24), u32(b, 0x28)
    pal_off, npal = u32(b, 0x2C), u32(b, 0x30)
    ldata, tdata = u32(b, 0x34), u32(b, 0x3C)

    pals = []
    for k in range(npal):
        o = pal_off + k * 16
        ncol, link, doff, dlen = u16(b, o+4), u16(b, o+6), u32(b, o+8), u32(b, o+12)
        if dlen == 0 and link < len(pals):
            pals.append(pals[link]); continue
        base = ldata + doff
        pals.append([tuple(b[base+c*4:base+c*4+3]) for c in range(ncol)])

    nodes = []
    for k in range(nspr):
        o = spr_off + k * 28
        nodes.append(dict(g=u16(b, o), i=u16(b, o+2), w=u16(b, o+4), h=u16(b, o+6),
                          ax=s16(b, o+8), ay=s16(b, o+10), link=u16(b, o+12),
                          fmt=b[o+14], depth=b[o+15], off=u32(b, o+16),
                          len=u32(b, o+20), pal=u16(b, o+24), flags=u16(b, o+26)))
    rows = []; fails = 0; saved = {}
    for k, n in enumerate(nodes):
        src = n; root = k
        guard = 0
        while src['len'] == 0 and guard < 50:
            root = src['link']; src = nodes[root]; guard += 1
        if root != k and root in saved:  # sprite ligado: reaproveita o PNG já salvo
            rows.append((n['g'], n['i'], n['ax'], n['ay'], src['w'], src['h'], saved[root]))
            continue
        base = (tdata if src['flags'] & 1 else ldata) + src['off']
        data = b[base:base + src['len']]
        w, h = src['w'], src['h']
        try:
            if w == 0 or h == 0:
                continue
            if src['fmt'] in (10, 11, 12):
                img = Image.open(io.BytesIO(data[4:]))
                img.load()
                if img.mode == 'P':
                    pal = act or pals[src['pal']]
                    img = apply_pal(img, pal)
            else:
                size = w * h
                if src['fmt'] == 0: px = data[:size]
                elif src['fmt'] == 2: px = rle8(data[4:], size)
                elif src['fmt'] == 3: px = rle5(data[4:], size)
                elif src['fmt'] == 4: px = lz5(data[4:], size)
                else: raise ValueError(f"formato {src['fmt']}")
                img = Image.frombytes('P', (w, h), px.ljust(size, b'\0'))
                img = apply_pal(img, act or pals[src['pal']])
            name = f"{n['g']}-{n['i']}.png"
            img.save(os.path.join(outdir, name), optimize=False, compress_level=6)
            saved[root] = name
            rows.append((n['g'], n['i'], n['ax'], n['ay'], w, h, name))
        except Exception as e:
            fails += 1
            print(f"falhou {n['g']},{n['i']}: {e}", file=sys.stderr)
    return rows, fails


# ---------- SFF v1 ----------
def decode_pcx(data, prev_pal, same):
    """PCX 8 bits tolerante: aceita dados curtos e paleta ausente."""
    x0, y0, x1, y1 = struct.unpack_from('<4H', data, 4)
    w, h = x1 - x0 + 1, y1 - y0 + 1
    bpl = u16(data, 66) or w
    planes = data[65]
    if planes != 1 or data[3] != 8:
        img = Image.open(io.BytesIO(data)); img.load(); return img, prev_pal
    pal = prev_pal
    end = len(data)
    if not same and len(data) >= 128 + 769 and data[-769] == 12:
        pal = [tuple(data[-768 + k*3:-768 + k*3 + 3]) for k in range(256)]
        end = len(data) - 769
    need = bpl * h; out = bytearray(); i = 128
    while len(out) < need and i < end:
        c = data[i]; i += 1
        if c >= 0xC0:
            n = c & 0x3F; v = data[i] if i < end else 0; i += 1
            out += bytes([v]) * n
        else:
            out.append(c)
    out = bytes(out[:need]).ljust(need, b'\0')
    if bpl != w:
        out = b''.join(out[r*bpl:r*bpl + w] for r in range(h))
    img = Image.frombytes('P', (w, h), out)
    if pal: apply_pal(img, pal)
    return img, pal


def extract_v1(b, outdir, act=None):
    nimg, first = u32(b, 20), u32(b, 24)
    rows = []; fails = 0; o = first; prev_pal = None; cache = {}
    base_pal = None; prev_base = True; saved = {}
    for k in range(nimg):
        nxt, ln = u32(b, o), u32(b, o+4)
        ax, ay, g, i, link, same = s16(b, o+8), s16(b, o+10), u16(b, o+12), u16(b, o+14), u16(b, o+16), b[o+18]
        try:
            if ln == 0:
                pcx = cache[link]
            else:
                pcx = b[o+32:o+32+ln]
            if ln == 0 and link in saved:
                cache[k] = pcx; saved[k] = saved[link]
                nm, sw, sh = saved[link]
                rows.append((g, i, ax, ay, sw, sh, nm))
                if nxt == 0: break
                o = nxt; continue
            cache[k] = pcx
            old = prev_pal
            img, prev_pal = decode_pcx(pcx, prev_pal, same)
            if base_pal is None: base_pal = prev_pal
            # paleta compartilhada: sprites "mesma paleta" e os que repetem a 1ª paleta usam o .act
            if same: usa_base = True
            else: usa_base = (prev_pal == base_pal)
            prev_base = usa_base
            if act and usa_base and img.mode == 'P':
                apply_pal(img, act)
            name = f"{g}-{i}.png"; img.save(os.path.join(outdir, name))
            saved[k] = (name, img.width, img.height)
            rows.append((g, i, ax, ay, img.width, img.height, name))
        except Exception as e:
            fails += 1; print(f"falhou {g},{i}: {e}", file=sys.stderr)
        if nxt == 0: break
        o = nxt
    return rows, fails


def main():
    a = sys.argv[1:]
    act = None
    if '--act' in a:
        k = a.index('--act'); act = load_act(a[k+1]); del a[k:k+2]
    path, outdir = a[0], a[1]
    os.makedirs(outdir, exist_ok=True)
    b = open(path, 'rb').read()
    if b[:11] != b'ElecbyteSpr': sys.exit('não é um arquivo SFF')
    ver = b[15]
    rows, fails = (extract_v2 if ver == 2 else extract_v1)(b, outdir, act)
    with open(os.path.join(outdir, 'axis.csv'), 'w', newline='') as f:
        wr = csv.writer(f); wr.writerow(['grupo', 'item', 'eixo_x', 'eixo_y', 'largura', 'altura', 'arquivo'])
        wr.writerows(rows)
    print(f"SFF v{ver}: {len(rows)} sprites extraídos, {fails} falhas -> {outdir}")


if __name__ == '__main__':
    main()
