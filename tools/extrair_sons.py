#!/usr/bin/env python3
"""Acervo de sons: tira o áudio dos jogos da pasta do usuário e converte para OGG.

Saída: assets/audio/acervo/<fonte>/<nome>.ogg  (o id do som no jogo é "acervo/<fonte>/<nome>", tocado por FF.Audio)
       data/acervo/sons/<fonte>.json            (ficha da fonte)  →  data/acervo/sons.js (índice, só o Estúdio carrega)

Uso: python3 -I tools/extrair_sons.py <fonte> <origem> [--nome "Nome do jogo"]
  fonte = swz | uh | mc | spw  (origem = .zip do jogo)  ·  twiss (game.droid)  ·  fsb (pasta/zip com .fsb/.resource do Unity)
        python3 -I tools/extrair_sons.py --indice   (só refaz data/acervo/sons.js)
"""
import hashlib, json, os, re, struct, subprocess, sys, tempfile, zipfile
from concurrent.futures import ThreadPoolExecutor

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUD = re.compile(r'\.(ogg|mp3|wav|webm|m4a)$', re.I)

# categoria pelo nome (para navegar; o usuário pode favoritar com a dele)
CATS = [
    ('musica', r'(bgm|music|musica|soundtrack|theme|tema|song|ost|inicial|opening|abertura|menu ?\d|stage ?music)'),
    ('voz', r'(\bvoz\b|voice|vo_|grito|scream|yell|kiai|^v[a-z]{3}n?\d)'),
    ('explosao', r'(explo|explos|bomb|boom|kiplosion|destruc|blast_?big|bigatack|nuke)'),
    ('ki', r'(\bki\b|kiblast|ki_|kame|beam|laser|leser|energ|wave|fire|tiro|shot|disc|kienza|makanko|genki|hakay|galick|final ?flash|masenko|charge|carga|death ?ball|special)'),
    ('aura', r'(aura|power ?up|transform|saiyajim|saiyan|ssj|kaioken|super ?sai|powerup)'),
    ('golpe', r'(hit|punch|soco|kick|chute|smash|impact|slash|attack|ataque|golpe|strike|struggle|wallhit|groundhit|defes|defend|guard|block|stum|jogado|cair|fall|knock)'),
    ('movimento', r'(teleport|dash|jump|pulo|fly|voo|swing|swipe|whoosh|descend|recover|step|run|vanish|avolta)'),
    ('interface', r'(click|clic|tick|select|button|botao|popup|cursor|error|erro|menu|start|ok|cancel|coin|moeda|confirm|voltar|open|close|pause)'),
]


def categoria(nome, dur):
    n = nome.lower().replace('_', ' ')
    for c, rx in CATS:
        if re.search(rx, n):
            return c
    return 'musica' if dur and dur > 30 else 'outros'


def slug(s):
    s = s.lower()
    s = re.sub(r'[áàâãä]', 'a', s); s = re.sub(r'[éèêë]', 'e', s); s = re.sub(r'[íìîï]', 'i', s)
    s = re.sub(r'[óòôõö]', 'o', s); s = re.sub(r'[úùûü]', 'u', s); s = s.replace('ç', 'c')
    s = re.sub(r'[^a-z0-9]+', '_', s).strip('_')
    return s or 'som'


def converter(dados, ext, saida):
    """bytes de áudio (qualquer formato que o ffmpeg leia) → OGG Vorbis; devolve a duração em s"""
    with tempfile.NamedTemporaryFile(suffix='.' + ext, delete=False) as fh:
        fh.write(dados); tmp = fh.name
    try:
        r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-vn', '-map_metadata', '-1', '-c:a', 'libvorbis', '-q:a', '3', saida],
                           capture_output=True, text=True)
        if r.returncode or not os.path.exists(saida) or os.path.getsize(saida) < 200:
            if os.path.exists(saida): os.remove(saida)
            return None
        p = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', saida], capture_output=True, text=True)
        try: dur = round(float(p.stdout.strip()), 2)
        except ValueError: return 0
        if dur > 30:   # músicas: qualidade menor (o repositório não pesa tanto)
            t = saida + '.tmp.ogg'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', saida, '-c:a', 'libvorbis', '-q:a', '0', t])
            if os.path.exists(t): os.replace(t, saida)
        return dur
    finally:
        os.remove(tmp)


def gravar(fonte, nome_fonte, itens):
    """itens: [(nome original, bytes, ext)] → converte em paralelo, junta repetidos, grava a ficha"""
    pasta = os.path.join(RAIZ, 'assets/audio/acervo', fonte)
    os.makedirs(pasta, exist_ok=True)
    vistos, usados, tarefas = {}, set(), []
    for nome, dados, ext in itens:
        h = hashlib.md5(dados).hexdigest()
        if h in vistos:
            continue
        base = os.path.splitext(os.path.basename(nome))[0]
        s = slug(base)
        while s in usados: s += '_'
        usados.add(s)
        vistos[h] = s
        tarefas.append((s, base, dados, ext))

    def um(t):
        s, base, dados, ext = t
        return s, base, converter(dados, ext, os.path.join(pasta, s + '.ogg'))
    sons = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        for s, base, dur in ex.map(um, tarefas):
            if dur is None:
                print('  não converteu:', base, flush=True); continue
            sons[s] = dict(nome=base, dur=dur, cat=categoria(base, dur))
    os.makedirs(os.path.join(RAIZ, 'data/acervo/sons'), exist_ok=True)
    with open(os.path.join(RAIZ, 'data/acervo/sons', fonte + '.json'), 'w', encoding='utf-8') as fh:
        json.dump(dict(chave=fonte, nome=nome_fonte, sons=sons), fh, ensure_ascii=False, indent=1)
    tam = sum(os.path.getsize(os.path.join(pasta, f)) for f in os.listdir(pasta))
    print('%s: %d sons (%.1f MB)' % (nome_fonte, len(sons), tam / 1e6), flush=True)


def indice():
    pasta = os.path.join(RAIZ, 'data/acervo/sons')
    fontes, sons = {}, []
    for arq in sorted(os.listdir(pasta)) if os.path.isdir(pasta) else []:
        if not arq.endswith('.json'): continue
        f = json.load(open(os.path.join(pasta, arq), encoding='utf-8'))
        fontes[f['chave']] = f['nome']
        for s, v in sorted(f['sons'].items()):
            sons.append(['acervo/%s/%s' % (f['chave'], s), v['nome'], v['dur'], v['cat'], f['chave']])
    with open(os.path.join(RAIZ, 'data/acervo/sons.js'), 'w', encoding='utf-8') as fh:
        fh.write('// Gerado por tools/extrair_sons.py — acervo de sons (Estúdio): [id, nome original, duração s, categoria, fonte]\n')
        fh.write('window.FF_ACERVO_SONS = ')
        json.dump(dict(fontes=fontes, sons=sons), fh, ensure_ascii=False, separators=(',', ':'))
        fh.write(';\n')
    print('índice: %d sons de %d fontes' % (len(sons), len(fontes)))


# ---------------------------------------------------------------- leitores
def do_zip(origem):
    zf = zipfile.ZipFile(origem)
    for i in zf.infolist():
        m = AUD.search(i.filename)
        if m and i.file_size > 0:
            yield i.filename, zf.read(i), m.group(1).lower()


def do_gamemaker(origem):
    """game.droid: SOND (nomes) + AUDO (arquivos embutidos, OGG/WAV)"""
    d = open(origem, 'rb').read()
    pedacos, o = {}, 8
    while o < len(d):
        n = d[o:o + 4].decode('latin1'); sz = struct.unpack('<I', d[o + 4:o + 8])[0]
        pedacos[n] = (o + 8, sz); o += 8 + sz
    def lista(nome):
        a, _ = pedacos[nome]; n = struct.unpack('<I', d[a:a + 4])[0]
        return [struct.unpack('<I', d[a + 4 + 4 * k:a + 8 + 4 * k])[0] for k in range(n)]
    def texto(p):
        return d[p:d.index(b'\0', p)].decode('utf-8', 'replace')
    audios = []
    for p in lista('AUDO'):
        tam = struct.unpack('<I', d[p:p + 4])[0]; audios.append(d[p + 4:p + 4 + tam])
    usados = set()
    for p in lista('SOND'):
        nome = texto(struct.unpack('<I', d[p:p + 4])[0])
        # SOND: nome, flags, tipo, arquivo, efeitos, volume, pitch, grupo, id do áudio
        idx = struct.unpack('<i', d[p + 32:p + 36])[0]
        if 0 <= idx < len(audios) and idx not in usados:
            usados.add(idx)
            a = audios[idx]
            yield nome, a, 'ogg' if a[:4] == b'OggS' else 'wav'
    for k, a in enumerate(audios):
        if k not in usados and len(a) > 64:
            yield 'audio_%d' % k, a, 'ogg' if a[:4] == b'OggS' else 'wav'


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == '--indice':
        indice(); sys.exit()
    fonte, origem = a[0], a[1]
    nome = a[a.index('--nome') + 1] if '--nome' in a else fonte
    if fonte == 'twiss':
        gravar(fonte, nome, list(do_gamemaker(origem)))
    elif fonte.startswith('fsb') or '--fsb' in a:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import fsb
        gravar(fonte, nome, list(fsb.de_origem(origem)))
    else:
        gravar(fonte, nome, list(do_zip(origem)))
    indice()
