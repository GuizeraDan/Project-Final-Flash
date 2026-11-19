#!/usr/bin/env python3
"""
Acervo: personagens de M.U.G.E.N (fonte KODAIKA Super Anime War 5, ids kaw_*).

Entrada: uma pasta com um subdiretório por personagem, já extraído por tools/mugen/sff_extract.py +
air_parse.py (via tools/mugen/kaw_lote.py): png/<grupo>-<item>.png, sprites.json, anims.json, info.json.
Saída (formato do acervo, veja tools/acervo_comum.py):
  assets/img/acervo/kaw_<id>_<n>.png        atlas próprios do personagem
  assets/img/acervo/kaw_comum_<k>_<n>.png   atlas de quadros repetidos entre personagens (ex.: edições do mesmo Goku)
  data/acervo/kaw_<id>.js, data/acervo/fontes/kaw.json

Para caber no repositório: bordas transparentes cortadas, personagens muito grandes reduzidos ao tamanho dos
lutadores do ZL3 (parado com ~47 px, como o Goku do ZL3; o Oozaru fica gigante) e atlas em paleta de 256 cores.

Cada personagem vira dois sprites: kaw_<id> (corpo) e kaw_<id>_efeitos (animações com quadros > 256 px —
explosões, raios, telas de especial — em meia resolução, com "escala": 2 na definição).

Quadros com muito preto opaco (efeitos feitos para mistura aditiva no M.U.G.E.N) viram transparência pelo
brilho (alfa = canal mais forte), senão apareceriam como quadrados pretos.

Animações: as do .air (nome padrão do M.U.G.E.N quando é uma ação conhecida — Parado, Andar_Frente, Dano_Leve…,
senão Acao_<número>), "Retrato" (grupo 9000) e "Outros" (sprites que nenhuma animação usa).
Tempo: o .air conta em ticks de 1/60 s → fps = 60/mdc dos ticks, dur = ticks/mdc. Espelhamento por quadro
(H/V no .air) não é representado.

Uso: python3 -I tools/extrair_mugen.py <pasta_extraida> [--defs defs.json] [--so id1,id2]
"""
import hashlib, io, json, math, os, sys
from multiprocessing import Pool
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import acervo_comum as A

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTE = 'kaw'
NOME_FONTE = 'KODAIKA Super Anime War 5'
ALVO_PARADO = 47
ESCALA_FIXA = {'kaw_goku_oozaru_brm': 0.5}   # gigante de verdade: não encolhe até o tamanho de um lutador
NOMES_PT = {   # nome em português de cada pasta (os displayname dos .def são inconsistentes)
    "Android_17": "Androide 17",
    "Android_18": "Androide 18",
    "Baby Vegeta": "Baby Vegeta",
    "BabyVegeta": "Baby Vegeta (versão 2)",
    "Bardock UI": "Bardock Instinto Superior",
    "Beerus": "Bills",
    "Black": "Goku Black Rosé (InSeph)",
    "Black Frieza": "Black Freeza",
    "Black Frieza V2": "Black Freeza (versão 2)",
    "Black Gohan": "Gohan Black",
    "Black Gokhan": "Gokhan Black (fusão Goku+Gohan)",
    "BlackSSR": "Goku Black Rosé (SSR)",
    "Broly": "Broly (Z)",
    "Broly (DBS)": "Broly (Super)",
    "Broly 2019": "Broly (filme 2018)",
    "Cellbuuzer": "Cell-Boo-Freeza (fusão)",
    "Dripstinct Goku": "Goku Instinto Superior (roupa casual)",
    "Frieza": "Freeza",
    "Frost Golden": "Frost Dourado",
    "Future_Gohan": "Gohan do Futuro",
    "Gas Heata By Charmarher": "Gas (Heeters)",
    "Ginyu": "Ginyu (corpo do Goku)",
    "Gogeta_Migatte": "Gogeta Instinto Superior",
    "Gogeto": "Gogeta",
    "Gohan": "Gohan",
    "Gohan Beast": "Gohan Besta",
    "Gohan SSJBlue": "Gohan SSJ Blue",
    "Gohan Teen SSJ2": "Gohan SSJ2 (adolescente)",
    "Golden Cooler": "Cooler Dourado",
    "Goku": "Goku (todas as formas)",
    "Goku (Monkey King)": "Goku (Rei Macaco)",
    "Goku (MUI)": "Goku Instinto Superior (versão 2)",
    "Goku (SSJ)": "Goku SSJ",
    "Goku 1000_TP V1": "Goku (1000 TP)",
    "Goku Beyond SSB": "Goku Além do SSJ Blue",
    "Goku Black (SSR)": "Goku Black Rosé",
    "Goku DR": "Goku (DR)",
    "Goku MUI": "Goku Instinto Superior",
    "Goku Oozaru BRM": "Goku Oozaru",
    "Goku SSGSS (Team Shonen)": "Goku SSJ Blue (Team Shonen)",
    "Goku_JUS3X": "Goku (JUS 3)",
    "Goku_JUS4": "Goku (JUS 4)",
    "Goku_Perfect SSB": "Goku SSJ Blue Perfeito",
    "Goku10": "Goku (versão 10)",
    "GokuSS6": "Goku SSJ6 (fã)",
    "GokuSSGSS": "Goku SSJ Blue",
    "GokuTerror": "Goku Terror (fã)",
    "Granola": "Granola",
    "Granola by charmarher": "Granola (versão 2)",
    "Janemba": "Janemba",
    "Jiren": "Jiren",
    "mecha_frieza": "Mecha Freeza",
    "Metal Cooler": "Metal Cooler",
    "Nappa": "Nappa",
    "Nuova Shenron": "Nuova Shenron",
    "Omega Shenron": "Omega Shenron",
    "Orange Piccolo": "Piccolo Laranja",
    "saiyanwarlordxjus": "Saiyan Warlord X (personagem de fã)",
    "Semi Perfect Cell": "Cell Semiperfeito",
    "Son Goku": "Son Goku (todas as formas)",
    "SSJ3_GokuZ2i": "Goku SSJ3",
    "SSJ4Blory_KN.edit": "Broly SSJ4",
    "Super Baby Vegeta 2": "Super Baby 2",
    "Super Vegetto": "Vegetto SSJ",
    "tien": "Tenshinhan",
    "TND-Vegeta_Ultra_ego": "Vegeta Ego Superior",
    "TTA'Goku JUS_V2": "Goku (JUS, pequeno)",
    "Turles": "Turles",
    "TXR-Broly_SS4": "Broly SSJ4 (TXR)",
    "VEGETA Omni God": "Vegeta Deus Supremo (fã)",
    "Vegeta SS6": "Vegeta SSJ4 Xeno",
    "Vegeta ssj7": "Vegeta SSJ3",
    "Vegetto JUS3": "Vegetto SSJ Blue (JUS)",
    "Vegito (SSB)": "Vegetto SSJ Blue",
    "VegitoBlue": "Vegetto SSJ Blue (versão 2)",
    "ZamasuFused": "Zamasu Fundido",
}


def aditivo(im):
    """quadro com muito preto opaco (efeito feito para mistura aditiva no M.U.G.E.N) → alfa pelo brilho.
    Critério: mais de 35% dos pixels visíveis são preto puro (contornos de personagem ficam bem abaixo disso)."""
    c = np.asarray(im, dtype=np.float32)
    a = c[:, :, 3]
    vis = a > 250
    nv = vis.sum()
    if nv < 64: return None
    mx = c[:, :, :3].max(axis=2)
    if (vis & (mx <= 12)).sum() < 0.35 * nv: return None
    al = np.minimum(mx, a)
    rgb = np.clip(c[:, :, :3] * 255.0 / np.maximum(mx, 1)[:, :, None], 0, 255)
    return Image.fromarray(np.dstack([rgb, al]).astype(np.uint8), 'RGBA')


def abrir(p):
    im = Image.open(p).convert('RGBA')
    ad = aditivo(im)
    return (ad, True) if ad is not None else (im, False)


def prep(args):
    """(caminho, escala) → md5, recorte, tamanho final, escala"""
    p, esc = args
    raw = open(p, 'rb').read()
    im, _ = abrir(p)
    bb = im.getchannel('A').getbbox() or (0, 0, 1, 1)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    return p, hashlib.md5(raw).hexdigest(), bb, (max(1, round(w * esc)), max(1, round(h * esc))), esc


def carregar(p, bb, esc, tam):
    im = abrir(p)[0].crop(bb)
    if esc != 1:
        im = im.resize(tam, Image.LANCZOS)
    return im


def gravar_atlas(args):
    rel, tam, itens = args   # itens: [(caminho, bb, esc, tam_q, x, y)]
    at = Image.new('RGBA', tam, (0, 0, 0, 0))
    for p, bb, esc, tq, x, y in itens:
        at.paste(carregar(p, bb, esc, tq), (x, y))
    q = at.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(os.path.join(RAIZ, rel), optimize=True)
    return rel


def ritmo(ticks):
    """ticks do .air → (fps, [dur]) com durações inteiras"""
    t = [max(1, x) if x >= 0 else -1 for x in ticks]
    pos = [x for x in t if x > 0] or [1]
    g = 0
    for x in pos: g = math.gcd(g, x)
    g = min(g, 60)
    return 60.0 / g, [(x // g if x > 0 else max(1, round(60 / g))) for x in t]


LIMITE = 256      # quadro maior que isso (já na escala do personagem) → animação vai para o sprite de efeitos
RES_EFEITOS = 0.5 # efeitos guardados em meia resolução e desenhados com escala 2


def main():
    args = sys.argv[1:]
    src = args[0]
    defs = {}
    if '--defs' in args: defs = json.load(open(args[args.index('--defs') + 1]))
    so = set(args[args.index('--so') + 1].split(',')) if '--so' in args else None
    ids = sorted(d for d in os.listdir(src) if os.path.exists(os.path.join(src, d, 'info.json')))
    if so: ids = [i for i in ids if i in so]

    # 1) cada personagem vira até 2 sprites: corpo (resolução normal) e efeitos grandes (meia resolução)
    saidas = []   # dict(sid, cid, res, escala, tipo, anims=[(nome, [(chave, dx, dy, ticks)], loop, rep, fps_fixo)])
    chars = {}
    for cid in ids:
        d = os.path.join(src, cid)
        info = json.load(open(d + '/info.json'))
        m = {(s['g'], s['i']): s for s in json.load(open(d + '/sprites.json'))}
        an = json.load(open(d + '/anims.json'))
        alt = None
        if '0' in an and an['0']['quadros']:
            s0 = m.get(tuple(an['0']['quadros'][0][:2]))
            if s0: alt = s0['h']
        esc = round(ESCALA_FIXA.get(cid, min(1.0, ALVO_PARADO / alt) if alt else 1.0), 3)
        chars[cid] = dict(info=info, d=d, esc=esc, m=m)
        grande = lambda k: max(m[k]['w'], m[k]['h']) * esc > LIMITE
        corpo, efe, usados = [], [], set()
        for acao in sorted(an, key=lambda a: int(a)):
            a = an[acao]
            qs = [(tuple(q[:2]), q[2], q[3], q[4]) for q in a['quadros'] if tuple(q[:2]) in m]
            if not qs: continue
            usados.update(q[0] for q in qs)
            nome = a['nome'] or 'Acao_%s' % acao
            loop = all(q[3] >= 0 for q in qs)
            rep = a['loop'] if a['loop'] is not None and a['loop'] < len(qs) else 0
            (efe if any(grande(q[0]) for q in qs) else corpo).append((nome, acao, qs, loop, rep, None))
        r = [k for k in sorted(m) if k[0] == 9000]
        rp = [(k, 0, 0, 1) for k in r if not grande(k)]
        rg = [(k, 0, 0, 1) for k in r if grande(k)]
        if rp: corpo.append(('Retrato', None, rp, False, 0, 0))
        if rg: efe.append(('Retrato_Grande', None, rg, False, 0, 0))
        resto = [k for k in sorted(m) if k not in usados and k[0] != 9000]
        op = [(k, 0, 0, 6) for k in resto if not grande(k)]
        og = [(k, 0, 0, 6) for k in resto if grande(k)]
        if op: corpo.append(('Outros', None, op, False, 0, None))
        if og: efe.append(('Outros', None, og, False, 0, None))
        if corpo: saidas.append(dict(sid=cid, cid=cid, res=esc, escala=None, tipo='personagens', anims=corpo))
        if efe: saidas.append(dict(sid=cid + '_efeitos', cid=cid, res=round(esc * RES_EFEITOS, 4),
                                   escala=round(1 / RES_EFEITOS, 3), tipo='efeitos', anims=efe))

    tarefas = set()
    for o in saidas:
        c = chars[o['cid']]
        for a in o['anims']:
            for q in a[2]:
                tarefas.add((os.path.join(c['d'], 'png', c['m'][q[0]]['arq']), o['res']))
    tarefas = sorted(tarefas)
    with Pool(2) as pool:
        prep_res = {}
        for p, md5, bb, tam, res in pool.imap_unordered(prep, tarefas, chunksize=64):
            prep_res[(p, res)] = (md5, bb, tam)
    print('preparados %d quadros' % len(prep_res), flush=True)

    # 2) quadros únicos (md5 + resolução) e quais sprites usam cada um
    usa = {}
    for o in saidas:
        c = chars[o['cid']]
        for a in o['anims']:
            for q in a[2]:
                p = os.path.join(c['d'], 'png', c['m'][q[0]]['arq'])
                md5, bb, tam = prep_res[(p, o['res'])]
                e = usa.setdefault((md5, o['res']), dict(p=p, bb=bb, tam=tam, esc=o['res'], sids=set()))
                e['sids'].add(o['sid'])
    grupos = {}
    for k, e in usa.items():
        g = frozenset(e['sids']) if len(e['sids']) > 1 else next(iter(e['sids']))
        grupos.setdefault(g, []).append(k)
    comuns = sorted((g for g in grupos if isinstance(g, frozenset)), key=lambda g: sorted(g))
    print('quadros únicos %d; grupos compartilhados %d (%d quadros)' % (
        len(usa), len(comuns), sum(len(grupos[g]) for g in comuns)), flush=True)

    # 3) empacotar: atlas por sprite + atlas por grupo compartilhado
    os.makedirs(os.path.join(RAIZ, 'assets/img/acervo'), exist_ok=True)
    onde, jobs = {}, []

    def empacota(prefixo, chaves):
        pos, tam = A.empacotar([(k, usa[k]['tam'][0], usa[k]['tam'][1]) for k in chaves])
        por = {}
        for k, (ai, x, y) in pos.items():
            onde[k] = ('assets/img/acervo/%s_%d.png' % (prefixo, ai), x, y)
            e = usa[k]
            por.setdefault(ai, []).append((e['p'], e['bb'], e['esc'], e['tam'], x, y))
        for ai, it in por.items():
            jobs.append(('assets/img/acervo/%s_%d.png' % (prefixo, ai), tam[ai], it))

    for o in saidas:
        if o['sid'] in grupos: empacota(o['sid'], grupos[o['sid']])
    for n, g in enumerate(comuns):
        empacota('kaw_comum_%d' % n, grupos[g])
    print('gravando %d atlas…' % len(jobs), flush=True)
    with Pool(2) as pool:
        for i, _ in enumerate(pool.imap_unordered(gravar_atlas, jobs, chunksize=4)):
            if i % 200 == 0: print('  %d/%d' % (i, len(jobs)), flush=True)

    # 4) nomes legíveis
    usados_n = {}
    for cid in ids:
        pasta = chars[cid]['info']['pasta']
        nome = NOMES_PT.get(pasta) or (defs.get(pasta, {}).get('nome') or pasta).strip()
        chars[cid]['nome'] = nome
        usados_n.setdefault(nome.lower(), []).append(cid)
    for cid in ids:
        if len(usados_n[chars[cid]['nome'].lower()]) > 1:
            chars[cid]['nome'] = '%s (%s)' % (chars[cid]['nome'], chars[cid]['info']['pasta'])

    # 5) definições
    fonte = A.Fonte(RAIZ, FONTE, NOME_FONTE, folha=None)
    for o in saidas:
        c = chars[o['cid']]; res = o['res']; atl = []
        nome_spr = c['nome'] + (' · efeitos' if o['tipo'] == 'efeitos' else '')

        def quadro(k, dx, dy, dur):
            s = c['m'][k]
            md5, bb, tam = prep_res[(os.path.join(c['d'], 'png', s['arq']), res)]
            rel, x, y = onde[(md5, res)]
            if rel not in atl: atl.append(rel)
            return [atl.index(rel), x, y, tam[0], tam[1],
                    round((s['ex'] - dx - bb[0]) * res), round((s['ey'] - dy - bb[1]) * res), dur]

        anims = {}
        for nome, acao, qs, loop, rep, fps_fixo in o['anims']:
            if fps_fixo is None:
                fps, durs = ritmo([q[3] for q in qs])
            else:
                fps, durs = fps_fixo, [1] * len(qs)
            if nome in anims: nome = '%s_%s' % (nome, acao)
            fr, vistos = [], set()
            for q, du in zip(qs, durs):
                f = quadro(q[0], q[1], q[2], du)
                if acao is None and nome == 'Outros':   # sprites soltos: sem repetir o mesmo desenho
                    if tuple(f[:3]) in vistos: continue
                    vistos.add(tuple(f[:3]))
                fr.append(f)
            anims[nome] = dict(fps=round(fps, 3), loop=loop, repeatTo=rep, pingpong=False, frames=fr)

        d = dict(id=o['sid'], atlases=atl, acervo=dict(nome=nome_spr, fonte=NOME_FONTE, tipo=o['tipo'],
                                                         origem=c['info']['pasta']), anims=anims)
        if o['tipo'] == 'efeitos': d['tipo'] = 'efeito'
        if o['escala']: d['escala'] = o['escala']
        with open(os.path.join(RAIZ, 'data/acervo', o['sid'] + '.js'), 'w', encoding='utf-8') as fh:
            fh.write('FF_ACERVO_DEF(%s,' % json.dumps(o['sid']))
            json.dump(d, fh, ensure_ascii=False, separators=(',', ':'))
            fh.write(');\n')
        nq = len({(f[0], f[1], f[2]) for a in anims.values() for f in a['frames']})
        fonte.sprites[o['sid']] = dict(nome=nome_spr, cat=FONTE, tipo=o['tipo'], quadros=nq, atlas=len(atl),
                                       objs=[c['info']['pasta']], anims={n: len(v['frames']) for n, v in anims.items()})
        print('%-40s res %.2f %4d anims %5d quadros %3d atlas  %s' % (o['sid'], res, len(anims), nq, len(atl), nome_spr), flush=True)

    fonte.fechar({FONTE: NOME_FONTE}, extra=dict(pulados=[
        'blacksperm (personagem-piada)', 'Goku_Xeno_SS4 e Jiren (ToP) (sprites criptografados)']))
    A.recompor(RAIZ)


if __name__ == '__main__':
    main()
