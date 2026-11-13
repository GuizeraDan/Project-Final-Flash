#!/usr/bin/env python3
"""
Extrator mínimo de .7z em Python puro (sem 7-Zip instalado): LZMA, LZMA2, cópia, BCJ x86/ARM e Delta
(o que o 7-Zip usa por padrão). Uso: python3 -I tools/sete_zip.py arquivo.7z pasta_destino
"""
import lzma, os, struct, sys

K_END, K_HEADER, K_ARCHIVE_PROPS, K_ADD_STREAMS, K_MAIN_STREAMS, K_FILES_INFO = 0, 1, 2, 3, 4, 5
K_PACK_INFO, K_UNPACK_INFO, K_SUBSTREAMS, K_SIZE, K_CRC, K_FOLDER, K_CODERS_UNPACK_SIZE = 6, 7, 8, 9, 10, 11, 12
K_NUM_UNPACK, K_EMPTY_STREAM, K_EMPTY_FILE, K_NAME, K_ATTR, K_ENCODED_HEADER, K_DUMMY = 13, 14, 15, 17, 21, 23, 25


class B:
    def __init__(s, d): s.d, s.o = d, 0
    def byte(s): v = s.d[s.o]; s.o += 1; return v
    def num(s):
        f = s.byte(); m = 0x80
        for i in range(8):
            if not f & m:
                hi = f & (m - 1)
                v = int.from_bytes(s.d[s.o:s.o + i], 'little') if i else 0
                s.o += i
                return v | (hi << (8 * i))
            m >>= 1
        v = int.from_bytes(s.d[s.o:s.o + 8], 'little'); s.o += 8; return v
    def bits(s, n):
        out, b, m = [], 0, 0
        for _ in range(n):
            if m == 0: b, m = s.byte(), 0x80
            out.append(bool(b & m)); m >>= 1
        return out
    def defbits(s, n):
        return [True] * n if s.byte() else s.bits(n)


def ler_crcs(b, n):
    defs = b.defbits(n)
    for d in defs:
        if d: b.o += 4


def pack_info(b):
    pos = b.num(); n = b.num(); sizes = []
    while True:
        t = b.byte()
        if t == K_END: break
        if t == K_SIZE: sizes = [b.num() for _ in range(n)]
        elif t == K_CRC: ler_crcs(b, n)
    return pos, sizes


def folder(b):
    coders = []
    nin = nout = 0
    for _ in range(b.num()):
        f = b.byte()
        cid = b.d[b.o:b.o + (f & 15)]; b.o += f & 15
        ni = no = 1
        if f & 0x10: ni, no = b.num(), b.num()
        props = b''
        if f & 0x20:
            n = b.num(); props = b.d[b.o:b.o + n]; b.o += n
        coders.append(dict(id=cid, props=props, ni=ni, no=no))
        nin += ni; nout += no
    binds = [(b.num(), b.num()) for _ in range(nout - 1)]
    npacked = nin - len(binds)
    packed = [b.num() for _ in range(npacked)] if npacked > 1 else [next(i for i in range(nin) if i not in [x[0] for x in binds])]
    return dict(coders=coders, binds=binds, packed=packed, nout=nout)


def unpack_info(b):
    assert b.byte() == K_FOLDER
    n = b.num(); assert b.byte() == 0
    fs = [folder(b) for _ in range(n)]
    assert b.byte() == K_CODERS_UNPACK_SIZE
    for f in fs: f['sizes'] = [b.num() for _ in range(f['nout'])]
    while True:
        t = b.byte()
        if t == K_END: break
        if t == K_CRC: ler_crcs(b, n)
    return fs


def substreams(b, fs):
    nums = [1] * len(fs); sizes = None
    t = b.byte()
    if t == K_NUM_UNPACK:
        nums = [b.num() for _ in fs]; t = b.byte()
    sizes = []
    for f, n in zip(fs, nums):
        if n == 0: sizes.append([]); continue
        tot = tamanho(f); lst = []
        if t == K_SIZE:
            for _ in range(n - 1): lst.append(b.num())
        lst.append(tot - sum(lst)); sizes.append(lst)
    if t == K_SIZE: t = b.byte()
    while t != K_END:
        if t == K_CRC:
            nc = sum(n for f, n in zip(fs, nums) if not (n == 1 and f.get('crc')))
            ler_crcs(b, nc)
        t = b.byte()
    return nums, sizes


def tamanho(f):
    """tamanho de saída do folder = saída que não está ligada a nenhuma entrada"""
    ligadas = {o for _, o in f['binds']}
    for i in range(f['nout']):
        if i not in ligadas: return f['sizes'][i]


def streams_info(b):
    r = dict(pos=0, packs=[], folders=[], nums=None, sizes=None)
    while True:
        t = b.byte()
        if t == K_END: break
        if t == K_PACK_INFO: r['pos'], r['packs'] = pack_info(b)
        elif t == K_UNPACK_INFO: r['folders'] = unpack_info(b)
        elif t == K_SUBSTREAMS: r['nums'], r['sizes'] = substreams(b, r['folders'])
    if r['nums'] is None:
        r['nums'] = [1] * len(r['folders']); r['sizes'] = [[tamanho(f)] for f in r['folders']]
    return r


def decodificar(f, dados_pack, total):
    """só cadeias simples (cada coder com 1 entrada/1 saída)"""
    coders = f['coders']
    if any(c['ni'] != 1 or c['no'] != 1 for c in coders):
        raise ValueError('coder com várias entradas (BCJ2?)')
    # a ordem de aplicação: do coder que lê o stream empacotado até o que produz a saída final
    ordem = list(range(len(coders)))
    # bind (in_index, out_index): saída out_index alimenta entrada in_index → decodifica primeiro o coder de entrada empacotada
    entrada_pack = f['packed'][0]
    cadeia = [entrada_pack]
    ligado = dict(f['binds'])                     # in -> out
    por_out = {o: i for i, o in f['binds']}       # out -> in
    # coder i lê entrada i e escreve saída i. Seguimos: coder c, sua saída c alimenta a entrada por_out[c]
    c = entrada_pack
    seq = [c]
    while c in por_out:
        c = por_out[c]; seq.append(c)
    dados = dados_pack
    for c in seq:
        cd = coders[c]; cid = cd['id']; p = cd['props']
        if cid == b'\x00':
            pass
        elif cid == b'\x21':
            dsz = p[0]
            dsz = (2 | (dsz & 1)) << (dsz // 2 + 11) if dsz < 40 else 0xFFFFFFFF
            dados = lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=[{'id': lzma.FILTER_LZMA2, 'dict_size': dsz}]).decompress(dados)
        elif cid == b'\x03\x01\x01':
            lc, lp, pb = p[0] % 9, (p[0] // 9) % 5, p[0] // 45
            dsz = struct.unpack('<I', p[1:5])[0]
            dados = lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=[{'id': lzma.FILTER_LZMA1, 'dict_size': dsz, 'lc': lc, 'lp': lp, 'pb': pb}]).decompress(dados)
        elif cid in (b'\x03\x03\x01\x03', b'\x04'):
            dados = lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=[{'id': lzma.FILTER_X86}]).decompress(dados)
        elif cid in (b'\x03\x03\x05\x01', b'\x07'):
            dados = lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=[{'id': lzma.FILTER_ARM}]).decompress(dados)
        elif cid == b'\x03':
            dados = lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=[{'id': lzma.FILTER_DELTA, 'dist': p[0] + 1}]).decompress(dados)
        else:
            raise ValueError('método não suportado %s' % cid.hex())
    return dados[:total]


def main(arq, dest):
    d = open(arq, 'rb').read()
    assert d[:6] == b"7z\xbc\xaf\x27\x1c", 'não é 7z'
    noff, nsz = struct.unpack_from('<QQ', d, 12)
    base = 32
    hb = B(d[base + noff:base + noff + nsz])
    t = hb.byte()
    while t == K_ENCODED_HEADER:
        si = streams_info(hb)
        pos = base + si['pos']
        f = si['folders'][0]
        hd = decodificar(f, d[pos:pos + si['packs'][0]], tamanho(f))
        hb = B(hd); t = hb.byte()
    assert t == K_HEADER
    t = hb.byte()
    if t == K_ARCHIVE_PROPS:
        while hb.byte() != 0: hb.o += hb.num()
        t = hb.byte()
    si = None
    if t == K_MAIN_STREAMS:
        si = streams_info(hb); t = hb.byte()
    nomes, vazio, vazio_arq, n = [], [], [], 0
    if t == K_FILES_INFO:
        n = hb.num()
        vazio = [False] * n
        while True:
            pt = hb.byte()
            if pt == K_END: break
            sz = hb.num(); ini = hb.o
            if pt == K_EMPTY_STREAM: vazio = hb.bits(n)
            elif pt == K_EMPTY_FILE: vazio_arq = hb.bits(sum(vazio))
            elif pt == K_NAME:
                hb.byte()
                raw = hb.d[hb.o:ini + sz].decode('utf-16-le')
                nomes = raw.split('\0')[:n]
            hb.o = ini + sz
    # streams
    pos = base + si['pos'] if si else 0
    saidas = []
    pk = 0
    for fi, f in enumerate(si['folders'] if si else []):
        npk = len(f['packed'])
        tam_pack = sum(si['packs'][pk:pk + npk])
        try:
            dados = decodificar(f, d[pos:pos + tam_pack], tamanho(f))
        except Exception as e:
            print('pulando bloco', fi, e); dados = None
        pos += tam_pack; pk += npk
        o = 0
        for s in si['sizes'][fi]:
            saidas.append(dados[o:o + s] if dados is not None else None); o += s
    k, ok, ruins = 0, 0, 0
    vi = 0
    for i, nome in enumerate(nomes):
        p = os.path.join(dest, nome.replace('\\', '/'))
        if vazio[i]:
            eh_arq = vazio_arq[vi] if vi < len(vazio_arq) else False
            vi += 1
            if eh_arq:
                os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'wb').close()
            else:
                os.makedirs(p, exist_ok=True)
            continue
        dados = saidas[k]; k += 1
        if dados is None:
            ruins += 1; continue
        os.makedirs(os.path.dirname(p) or '.', exist_ok=True)
        with open(p, 'wb') as fh: fh.write(dados)
        ok += 1
    print('%s: %d arquivos extraídos, %d pulados' % (os.path.basename(arq), ok, ruins))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
