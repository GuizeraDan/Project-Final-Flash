"""
Decodificador ETC1 / ETC2 (RGB, RGBA8 com alfa EAC) em numpy — texturas de jogos Unity para Android.
decodificar(dados, w, h, formato) → numpy uint8 (h, w, 4), linhas na ordem do arquivo (o Unity guarda de baixo para cima).
formato: 'ETC1' | 'ETC2_RGB' | 'ETC2_RGBA8'
"""
import numpy as np

TAB = np.array([[2, 8], [5, 17], [9, 29], [13, 42], [18, 60], [24, 80], [33, 106], [47, 183]], np.int32)
DIST = np.array([3, 6, 11, 16, 23, 32, 41, 64], np.int32)
EAC = np.array([
    [-3, -6, -9, -15, 2, 5, 8, 14], [-3, -7, -10, -13, 2, 6, 9, 12], [-2, -5, -8, -13, 1, 4, 7, 12],
    [-2, -4, -6, -13, 1, 3, 5, 12], [-3, -6, -8, -12, 2, 5, 7, 11], [-3, -7, -9, -11, 2, 6, 8, 10],
    [-4, -7, -8, -11, 3, 6, 7, 10], [-3, -5, -8, -11, 2, 4, 7, 10], [-2, -6, -8, -10, 1, 5, 7, 9],
    [-2, -5, -8, -10, 1, 4, 7, 9], [-2, -4, -8, -10, 1, 3, 7, 9], [-2, -5, -7, -10, 1, 4, 6, 9],
    [-3, -4, -7, -10, 2, 3, 6, 9], [-1, -2, -3, -10, 0, 1, 2, 9], [-4, -6, -8, -9, 3, 5, 7, 8],
    [-3, -5, -7, -9, 2, 4, 6, 8]], np.int32)
# pixel i do bloco: x = i // 4, y = i % 4 (ordem por coluna, como no formato)
PX = np.arange(16) // 4
PY = np.arange(16) % 4


def _cor(b, etc2, pt=False):
    """b: (N, 8) int32 → (N, 16, 3) int32 (pt=True: ETC2 RGBA1; devolve também o alfa (N,16))"""
    N = len(b)
    b0, b1, b2, b3, b4, b5, b6, b7 = [b[:, i] for i in range(8)]
    diff = (b3 >> 1) & 1
    flip = b3 & 1
    opaco = diff.copy()
    if pt:
        diff = np.ones_like(diff)                            # RGBA1: sempre diferencial; o bit vira "opaco"
    # índices dos pixels (2 bits): msb em b4b5, lsb em b6b7
    msb = (b4 << 8) | b5
    lsb = (b6 << 8) | b7
    i16 = np.arange(16)
    idx = (((msb[:, None] >> i16) & 1) << 1) | ((lsb[:, None] >> i16) & 1)          # (N,16)

    # individual
    ind1 = np.stack([b0 >> 4, b1 >> 4, b2 >> 4], 1) * 17
    ind2 = np.stack([b0 & 15, b1 & 15, b2 & 15], 1) * 17
    # diferencial
    c5 = np.stack([b0 >> 3, b1 >> 3, b2 >> 3], 1)
    d3 = np.stack([b0 & 7, b1 & 7, b2 & 7], 1)
    d3 = np.where(d3 >= 4, d3 - 8, d3)
    c5b = c5 + d3
    ex5 = lambda v: (v << 3) | (v >> 2)
    dif1, dif2 = ex5(c5), ex5(np.clip(c5b, 0, 31))
    base1 = np.where(diff[:, None] == 1, dif1, ind1)
    base2 = np.where(diff[:, None] == 1, dif2, ind2)
    t1, t2 = (b3 >> 5) & 7, (b3 >> 2) & 7
    sub = np.where(flip[:, None] == 0, PX[None, :] >= 2, PY[None, :] >= 2)           # (N,16) bool
    base = np.where(sub[:, :, None], base2[:, None, :], base1[:, None, :])
    tab = np.where(sub, t2[:, None], t1[:, None])
    mag = TAB[tab, idx & 1]
    if pt:
        mag = np.where((opaco[:, None] == 0) & ((idx & 1) == 0), 0, mag)
    mod = np.where(idx >= 2, -mag, mag)
    out = np.clip(base + mod[:, :, None], 0, 255)
    if not etc2:
        return out

    modo_t = (diff == 1) & ((c5b[:, 0] < 0) | (c5b[:, 0] > 31))
    modo_h = (diff == 1) & ~modo_t & ((c5b[:, 1] < 0) | (c5b[:, 1] > 31))
    modo_p = (diff == 1) & ~modo_t & ~modo_h & ((c5b[:, 2] < 0) | (c5b[:, 2] > 31))

    if modo_t.any() or modo_h.any():
        # T
        tc1 = np.stack([(((b0 >> 3) & 3) << 2) | (b0 & 3), b1 >> 4, b1 & 15], 1) * 17
        tc2 = np.stack([b2 >> 4, b2 & 15, b3 >> 4], 1) * 17
        td = DIST[(((b3 >> 2) & 3) << 1) | (b3 & 1)][:, None]
        palT = np.stack([tc1, np.clip(tc2 + td, 0, 255), tc2, np.clip(tc2 - td, 0, 255)], 1)
        # H
        r1 = (b0 >> 3) & 15
        g1 = ((b0 & 7) << 1) | ((b1 >> 4) & 1)
        bb1 = (b1 & 8) | ((b1 & 3) << 1) | (b2 >> 7)
        r2 = (b2 >> 3) & 15
        g2 = ((b2 & 7) << 1) | (b3 >> 7)
        bb2 = (b3 >> 3) & 15
        hd = (b3 & 4) | ((b3 & 1) << 1)
        hd = hd | (((r1 << 8) | (g1 << 4) | bb1) >= ((r2 << 8) | (g2 << 4) | bb2)).astype(np.int32)
        hd = DIST[hd][:, None]
        hc1 = np.stack([r1, g1, bb1], 1) * 17
        hc2 = np.stack([r2, g2, bb2], 1) * 17
        palH = np.stack([np.clip(hc1 + hd, 0, 255), np.clip(hc1 - hd, 0, 255), np.clip(hc2 + hd, 0, 255), np.clip(hc2 - hd, 0, 255)], 1)
        ar = np.arange(N)[:, None]
        cT = palT[ar, idx]
        cH = palH[ar, idx]
        out = np.where(modo_t[:, None, None], cT, out)
        out = np.where(modo_h[:, None, None], cH, out)
    if modo_p.any():
        e6 = lambda v: (v << 2) | (v >> 4)
        e7 = lambda v: (v << 1) | (v >> 6)
        O = np.stack([e6((b0 >> 1) & 63), e7(((b0 & 1) << 6) | ((b1 >> 1) & 63)),
                      e6(((b1 & 1) << 5) | (b2 & 0x18) | ((b2 & 3) << 1) | (b3 >> 7))], 1)
        Hc = np.stack([e6((((b3 >> 2) & 31) << 1) | (b3 & 1)), e7(b4 >> 1), e6(((b4 & 1) << 5) | (b5 >> 3))], 1)
        V = np.stack([e6(((b5 & 7) << 3) | (b6 >> 5)), e7(((b6 & 31) << 2) | (b7 >> 6)), e6(b7 & 63)], 1)
        cP = (PX[None, :, None] * (Hc - O)[:, None, :] + PY[None, :, None] * (V - O)[:, None, :] + 4 * O[:, None, :] + 2) >> 2
        out = np.where(modo_p[:, None, None], np.clip(cP, 0, 255), out)
    if pt:
        transp = (opaco[:, None] == 0) & (idx == 2) & ~modo_p[:, None]
        alfa = np.where(transp, 0, 255)
        out = np.where(transp[:, :, None], 0, out)
        return out, alfa
    return out


def _alfa(b):
    """bloco EAC (N, 8) → (N, 16)"""
    base, mult, tab = b[:, 0], b[:, 1] >> 4, b[:, 1] & 15
    bits = np.zeros(len(b), np.uint64)
    for i in range(2, 8):
        bits = (bits << np.uint64(8)) | b[:, i].astype(np.uint64)
    i16 = np.arange(16, dtype=np.uint64)
    idx = ((bits[:, None] >> (np.uint64(45) - np.uint64(3) * i16)) & np.uint64(7)).astype(np.int32)
    return np.clip(base[:, None] + EAC[tab[:, None], idx] * mult[:, None], 0, 255)


def decodificar(dados, w, h, formato):
    bw, bh = (w + 3) // 4, (h + 3) // 4
    n = bw * bh
    if formato in ('DXT1', 'DXT5'):
        return _dxt(dados, w, h, formato)
    tam = 16 if formato == 'ETC2_RGBA8' else 8
    raw = np.frombuffer(dados[:n * tam], np.uint8).reshape(n, tam).astype(np.int32)
    if formato == 'ETC2_RGBA8':
        a = _alfa(raw[:, :8])
        c = _cor(raw[:, 8:], True)
    elif formato == 'ETC2_RGBA1':
        c, a = _cor(raw, True, True)
    else:
        c = _cor(raw, formato != 'ETC1')
        a = np.full((n, 16), 255, np.int32)
    px = np.concatenate([c, a[:, :, None]], 2).astype(np.uint8)                     # (n,16,4)
    # (n,16) com i = x*4+y → (bh, bw, y, x)
    px = px.reshape(bh, bw, 4, 4, 4).transpose(0, 1, 3, 2, 4)                         # (bh,bw,y,x,c)
    img = px.transpose(0, 2, 1, 3, 4).reshape(bh * 4, bw * 4, 4)
    return np.ascontiguousarray(img[:h, :w])


def _montar(px, w, h):
    """(n, 16, 4) com pixels em ordem de linha (i = y*4 + x) → imagem"""
    bw, bh = (w + 3) // 4, (h + 3) // 4
    img = px.reshape(bh, bw, 4, 4, 4).transpose(0, 2, 1, 3, 4).reshape(bh * 4, bw * 4, 4)
    return np.ascontiguousarray(img[:h, :w])


def _dxt(dados, w, h, formato):
    """BC1 (DXT1) / BC3 (DXT5). Pixels do bloco em ordem de linha."""
    bw, bh = (w + 3) // 4, (h + 3) // 4
    n = bw * bh
    tam = 16 if formato == 'DXT5' else 8
    raw = np.frombuffer(dados[:n * tam], np.uint8).reshape(n, tam)
    cb = raw[:, tam - 8:].astype(np.int32)
    c0 = cb[:, 0] | (cb[:, 1] << 8)
    c1 = cb[:, 2] | (cb[:, 3] << 8)
    rgb = lambda c: np.stack([((c >> 11) & 31) * 255 // 31, ((c >> 5) & 63) * 255 // 63, (c & 31) * 255 // 31], 1)
    p0, p1 = rgb(c0), rgb(c1)
    quatro = (c0 > c1) | (formato == 'DXT5')
    p2 = np.where(quatro[:, None], (2 * p0 + p1) // 3, (p0 + p1) // 2)
    p3 = np.where(quatro[:, None], (p0 + 2 * p1) // 3, 0)
    pal = np.stack([p0, p1, p2, p3], 1)                                          # (n,4,3)
    bits = cb[:, 4] | (cb[:, 5] << 8) | (cb[:, 6] << 16) | (cb[:, 7] << 24)
    idx = (bits[:, None] >> (2 * np.arange(16))) & 3
    cor = pal[np.arange(n)[:, None], idx]
    if formato == 'DXT5':
        ab = raw[:, :8].astype(np.int64)
        a0, a1 = ab[:, 0], ab[:, 1]
        ap = [a0, a1]
        for k in range(1, 7):
            ap.append(np.where(a0 > a1, ((7 - k) * a0 + k * a1) // 7, ((5 - k) * a0 + k * a1) // 5 if k <= 4 else (0 if k == 5 else 255)))
        ap = np.stack([np.broadcast_to(x, a0.shape) for x in ap[:2]] + [np.where(a0 > a1, ((7 - k) * a0 + k * a1) // 7,
              (((5 - k) * a0 + k * a1) // 5) if k <= 4 else np.full_like(a0, 0 if k == 5 else 255)) for k in range(1, 7)], 1)
        abits = np.zeros(n, np.int64)
        for i in range(6):
            abits |= ab[:, 2 + i] << (8 * i)
        aidx = (abits[:, None] >> (3 * np.arange(16))) & 7
        alfa = ap[np.arange(n)[:, None], aidx]
    else:
        alfa = np.where((~quatro[:, None]) & (idx == 3), 0, 255)
    px = np.concatenate([cor, alfa[:, :, None]], 2).astype(np.uint8)
    return _montar(px, w, h)
