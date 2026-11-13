#!/usr/bin/env python3
"""Leitor de FSB5 (áudio do FMOD usado pelo Unity: .fsb soltos ou dentro dos .resource).

Codecs: PCM16 (2), IMA ADPCM (7) e Vorbis (15). O Vorbis do FSB vem sem o cabeçalho "setup" (as tabelas do
codec): no lugar dele há um CRC32 que identifica qual setup o FMOD usou. Esses setups são os que o libvorbis gera
para cada qualidade/canais/frequência; tools/fsb_setups.json guarda os que já foram achados (CRC → setup em base64)
e `python3 -I tools/fsb.py --gerar-setups <origem…>` procura os que faltam codificando com o libvorbis do ffmpeg.
"""
import base64, glob, json, os, struct, subprocess, sys, tempfile, zipfile, zlib

AQUI = os.path.dirname(os.path.abspath(__file__))
SETUPS = os.path.join(AQUI, 'fsb_setups.json')
FREQ = {1: 8000, 2: 11000, 3: 11025, 4: 16000, 5: 22050, 6: 24000, 7: 32000, 8: 44100, 9: 48000}


def blocos_fsb(b):
    """posições de cada FSB5 dentro de um arquivo (um .resource junta vários)"""
    o = 0
    while True:
        i = b.find(b'FSB5', o)
        if i < 0: return
        yield i
        o = i + 4


def ler_fsb(b, i):
    """→ (modo, [amostra]) ; amostra = dict(nome, canais, freq, n, dados, crc)"""
    ver, ns, shs, nts, ds, modo = struct.unpack('<6I', b[i + 4:i + 28])
    cab = 60 if ver == 1 else 64
    p = i + cab
    amostras = []
    for _ in range(ns):
        v = struct.unpack('<Q', b[p:p + 8])[0]; p += 8
        prox, fi, st, off, n = v & 1, (v >> 1) & 0xF, (v >> 5) & 1, ((v >> 6) & 0xFFFFFFF) * 16, v >> 34
        a = dict(canais=st + 1, freq=FREQ.get(fi, 44100), n=n, off=off, crc=None)
        while prox:
            c = struct.unpack('<I', b[p:p + 4])[0]; p += 4
            prox, tam, tipo = c & 1, (c >> 1) & 0xFFFFFF, c >> 25
            dado = b[p:p + tam]; p += tam
            if tipo == 1: a['canais'] = dado[0]
            elif tipo == 2: a['freq'] = struct.unpack('<I', dado[:4])[0]
            elif tipo == 11: a['crc'] = struct.unpack('<I', dado[:4])[0]
        amostras.append(a)
    p = i + cab + shs
    nomes = []
    if nts:
        offs = [struct.unpack('<I', b[p + 4 * k:p + 4 * k + 4])[0] for k in range(ns)]
        for o in offs:
            e = b.index(b'\0', p + o); nomes.append(b[p + o:e].decode('utf-8', 'replace'))
    dados = i + cab + shs + nts
    for k, a in enumerate(amostras):
        fim = amostras[k + 1]['off'] if k + 1 < ns else ds
        a['dados'] = b[dados + a['off']:dados + fim]
        a['nome'] = nomes[k] if k < len(nomes) else None
    return modo, amostras


# ---------------------------------------------------------------- PCM / ADPCM → WAV
def wav(a, modo):
    ch, fr, d = a['canais'], a['freq'], a['dados']
    if modo == 2:
        fmt = struct.pack('<HHIIHH', 1, ch, fr, fr * ch * 2, ch * 2, 16)
    else:   # IMA ADPCM do FSB = blocos de 36 bytes por canal, 64 amostras (como o IMA do WAV)
        ba = 36 * ch
        fmt = struct.pack('<HHIIHHHH', 0x11, ch, fr, fr * ba // 64, ba, 4, 2, 64)
        d = d[:len(d) - len(d) % ba]
    corpo = b'WAVE' + b'fmt ' + struct.pack('<I', len(fmt)) + fmt + b'data' + struct.pack('<I', len(d)) + d
    return b'RIFF' + struct.pack('<I', len(corpo)) + corpo


# ---------------------------------------------------------------- Vorbis → OGG
def crc_ogg(dados):
    crc = 0
    for byte in dados:
        crc ^= byte << 24
        for _ in range(8):
            crc = ((crc << 1) ^ 0x04C11DB7) if crc & 0x80000000 else (crc << 1)
            crc &= 0xFFFFFFFF
    return crc


_TAB = None
def _crc_rapido(dados):
    global _TAB
    if _TAB is None:
        _TAB = []
        for i in range(256):
            c = i << 24
            for _ in range(8):
                c = ((c << 1) ^ 0x04C11DB7) if c & 0x80000000 else (c << 1)
            _TAB.append(c & 0xFFFFFFFF)
    crc = 0
    for byte in dados:
        crc = ((crc << 8) & 0xFFFFFFFF) ^ _TAB[((crc >> 24) ^ byte) & 0xFF]
    return crc


def pagina(pacotes, granulo, serial, seq, tipo):
    segs = b''
    for p in pacotes:
        n = len(p)
        segs += bytes([255] * (n // 255) + [n % 255])
    cab = b'OggS' + bytes([0, tipo]) + struct.pack('<qIII', granulo, serial, seq, 0) + bytes([len(segs)]) + segs
    pg = bytearray(cab + b''.join(pacotes))
    struct.pack_into('<I', pg, 22, _crc_rapido(pg))
    return bytes(pg)


def cab_id(ch, fr, bs0, bs1):
    return b'\x01vorbis' + struct.pack('<IBIiii', 0, ch, fr, 0, 0, 0) + bytes([(bs1 << 4) | bs0, 1])


def cab_comentario():
    v = b'Final Flash'
    return b'\x03vorbis' + struct.pack('<I', len(v)) + v + struct.pack('<I', 0) + b'\x01'


def modos_do_setup(setup):
    """blockflag de cada modo, lendo o fim do cabeçalho setup de trás para frente (truque conhecido:
    o último campo é a lista de modos: [blockflag:1][windowtype:16=0][transformtype:16=0][mapping:8] … + bit de framing)"""
    bits = ''.join(format(x, '08b')[::-1] for x in setup)
    fim = bits.rfind('1')   # bit de framing
    # cada modo ocupa 41 bits; tenta de 64 para baixo o maior número de modos que se encaixa
    for n in range(64, 0, -1):
        ini = fim - 41 * n
        if ini < 6: continue
        ok, flags = True, []
        for k in range(n):
            m = bits[ini + 41 * k: ini + 41 * (k + 1)]
            if m[1:33] != '0' * 32: ok = False; break
            flags.append(m[0] == '1')
        if not ok: continue
        cont = int(bits[ini - 6:ini][::-1], 2) + 1   # vorbis_mode_count - 1 em 6 bits, antes dos modos
        if cont == n:
            return flags
    return [False, True]


def ogg(a, setups):
    s = setups.get(str(a['crc']))
    if not s: return None
    setup = base64.b64decode(s['setup'])
    bs0, bs1 = s['bs0'], s['bs1']
    flags = modos_do_setup(setup)
    nbits = max(1, (len(flags) - 1).bit_length())
    serial, seq = 1234, 0
    out = [pagina([cab_id(a['canais'], a['freq'], bs0, bs1)], 0, serial, 0, 2)]
    out.append(pagina([cab_comentario(), setup], 0, serial, 1, 0))
    seq = 2
    d, p, gran, ant, pend = a['dados'], 0, 0, None, []
    while p + 2 <= len(d):
        n = struct.unpack('<H', d[p:p + 2])[0]; p += 2
        if n == 0: break
        pk = d[p:p + n]; p += n
        modo = (pk[0] >> 1) & ((1 << nbits) - 1) if pk else 0
        bs = (1 << bs1) if (modo < len(flags) and flags[modo]) else (1 << bs0)
        if ant is not None: gran += (ant + bs) // 4
        ant = bs
        out.append(pagina([pk], min(gran, a['n']) if a['n'] else gran, serial, seq, 0)); seq += 1
    if len(out) > 2:   # última página: fim do fluxo com o total certo de amostras
        ultima = bytearray(out[-1]); ultima[5] = 4
        if a['n']: struct.pack_into('<q', ultima, 6, a['n'])
        struct.pack_into('<I', ultima, 22, 0); struct.pack_into('<I', ultima, 22, _crc_rapido(ultima))
        out[-1] = bytes(ultima)
    return b''.join(out)


# ---------------------------------------------------------------- origem → sons
def arquivos(origem):
    """(nome do arquivo, bytes) de cada .fsb/.resource numa pasta ou .zip"""
    if os.path.isdir(origem):
        for f in sorted(glob.glob(os.path.join(origem, '**', '*'), recursive=True)):
            if f.endswith(('.fsb', '.resource')): yield os.path.basename(f), open(f, 'rb').read()
    else:
        zf = zipfile.ZipFile(origem)
        for i in zf.infolist():
            if i.filename.endswith(('.fsb', '.resource')): yield os.path.basename(i.filename), zf.read(i)


def nomes_unity(origem):
    """nomes dos AudioClip do Unity: {(arquivo .resource, offset): nome} lendo os SerializedFile ao lado.
    AudioClip (2017+): m_Name, 32 bytes de campos fixos, m_Resource{m_Source, m_Offset u64, m_Size u64}"""
    def todos():
        if os.path.isdir(origem):
            for f in glob.glob(os.path.join(origem, '**', '*'), recursive=True):
                if os.path.isfile(f) and not f.endswith(('.resource', '.fsb', '.png', '.js', '.so', '.dex')) and os.path.getsize(f) < 300e6:
                    yield open(f, 'rb').read()
        else:
            zf = zipfile.ZipFile(origem)
            for i in zf.infolist():
                n = i.filename
                if '/bin/Data/' in n and not n.endswith(('.resource', '.fsb', '.png')) and i.file_size < 300e6: yield zf.read(i)
    mapa = {}
    for b in todos():
        o = 0
        while True:
            i = b.find(b'.resource', o)
            if i < 0: break
            o = i + 9
            # volta até o tamanho do texto da fonte
            ini = None
            for L in range(9, 300):
                st = i + 9 - L
                if st < 4: break
                if struct.unpack('<I', b[st - 4:st])[0] == L: ini = st - 4; break
            if ini is None: continue
            L = struct.unpack('<I', b[ini:ini + 4])[0]
            fonte = b[ini + 4:ini + 4 + L].decode('utf-8', 'replace')
            q = ini + 4 + L; q += (-q) % 4
            off = struct.unpack('<Q', b[q:q + 8])[0]
            fim_nome = ini - 32
            for n in range(1, 200):
                al = n + (-n) % 4
                pn = fim_nome - al - 4
                if pn < 0: break
                if struct.unpack('<I', b[pn:pn + 4])[0] == n:
                    nome = b[pn + 4:pn + 4 + n]
                    if all(32 <= c < 127 or c >= 128 for c in nome):
                        mapa[(os.path.basename(fonte.split('/')[-1]), off)] = nome.decode('utf-8', 'replace')
                    break
    return mapa


def amostras(origem):
    nomes = nomes_unity(origem)
    for arq, b in arquivos(origem):
        for k, i in enumerate(blocos_fsb(b)):
            try: modo, l = ler_fsb(b, i)
            except Exception as e: print('  FSB ruim em', arq, e); continue
            for j, a in enumerate(l):
                if not a['nome'] and len(l) == 1 and (arq, i) in nomes: a['nome'] = nomes[(arq, i)]
                if not a['nome']:
                    base = os.path.splitext(arq)[0]
                    a['nome'] = base if arq.endswith('.fsb') and len(l) == 1 else '%s_%d_%d' % (base[:12], k, j)
                yield modo, a


def de_origem(origem):
    """para tools/extrair_sons.py: (nome, bytes, ext)"""
    setups = json.load(open(SETUPS)) if os.path.exists(SETUPS) else {}
    falta = 0
    for modo, a in amostras(origem):
        if modo in (2, 7): yield a['nome'], wav(a, modo), 'wav'
        elif modo == 15:
            o = ogg(a, setups)
            if o: yield a['nome'], o, 'ogg'
            else: falta += 1
        else: print('  codec FSB não suportado:', modo, a['nome'])
    if falta: print('  %d sons Vorbis sem setup conhecido (rode --gerar-setups)' % falta)


# ---------------------------------------------------------------- achar os setups (libvorbis via ffmpeg)
def ler_ogg_cabecalhos(dados):
    """os 3 primeiros pacotes de um OGG Vorbis"""
    pac, cur, p = [], b'', 0
    while p < len(dados) and len(pac) < 3:
        ns = dados[p + 26]; segs = dados[p + 27:p + 27 + ns]; q = p + 27 + ns
        for s in segs:
            cur += dados[q:q + s]; q += s
            if s < 255: pac.append(cur); cur = b''
        p = q
    return pac


def gerar_setups(origens):
    precisa = {}
    for o in origens:
        for modo, a in amostras(o):
            if modo == 15 and a['crc'] is not None: precisa[a['crc']] = (a['canais'], a['freq'])
    setups = json.load(open(SETUPS)) if os.path.exists(SETUPS) else {}
    falta = {c: v for c, v in precisa.items() if str(c) not in setups}
    print('setups: precisa %d, já tem %d, faltam %d' % (len(precisa), len(precisa) - len(falta), len(falta)))
    combos = sorted(set(falta.values()))
    with tempfile.TemporaryDirectory() as tmp:
        for ch, fr in combos:
            src = os.path.join(tmp, 'r.wav')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'anoisesrc=d=0.3:r=%d' % fr, '-ac', str(ch), src], check=True)
            for q10 in range(-10, 101):
                q = q10 / 10
                out = os.path.join(tmp, 'o.ogg')
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-c:a', 'libvorbis', '-q:a', str(q), out])
                if not os.path.exists(out): continue
                pk = ler_ogg_cabecalhos(open(out, 'rb').read())
                if len(pk) < 3: continue
                c = zlib.crc32(pk[2]) & 0xFFFFFFFF
                bs = pk[0][28]
                if c in falta and str(c) not in setups:
                    setups[str(c)] = dict(setup=base64.b64encode(pk[2]).decode(), bs0=bs & 15, bs1=bs >> 4, canais=ch, freq=fr, q=q)
                    print('  achou', c, ch, fr, 'q', q)
            json.dump(setups, open(SETUPS, 'w'), indent=0)
    ainda = [c for c in falta if str(c) not in setups]
    print('faltam ainda:', len(ainda))


if __name__ == '__main__':
    if sys.argv[1] == '--gerar-setups': gerar_setups(sys.argv[2:])
    elif sys.argv[1] == '--ver':
        from collections import Counter
        c = Counter()
        for modo, a in amostras(sys.argv[2]): c[(modo, a['canais'], a['freq'], a['crc'])] += 1
        for k, v in sorted(c.items(), key=lambda x: -x[1]): print(k, v)
