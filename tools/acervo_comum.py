"""
Partes comuns dos extratores do acervo (tools/extrair_acervo.py = Z Legends 3, tools/extrair_jogos.py = outros jogos).

Cada sprite do acervo vira:
  assets/img/acervo/<id>_<n>.png    atlas (prateleiras, até 2048×2048)
  data/acervo/<id>.js               FF_ACERVO_DEF("<id>", {...})  — mesmo formato de data/sprites/*.json
e entra na ficha da fonte data/acervo/fontes/<fonte>.json. recompor() junta todas as fontes em:
  data/acervo/indice.json           categorias + lista (vai para o bundle via tools/build_bundle.py)
  data/acervo/indice_anims.js       nomes das animações de cada sprite (busca do Estúdio)
  docs/ACERVO.md                    lista legível

Quadro de entrada (dict): img (chave da imagem de origem), x, y, w, h (recorte), ox, oy (origem em pixels do
recorte), dur (multiplicador), pts ([[dx, dy], …] relativos à origem, opcional).
"""
import json, os, re
from PIL import Image

MAX = 2048
PAD = 1
TIPOS = ['personagens', 'efeitos', 'cenarios', 'interface', 'cutscenes']
NOME_TIPO = {'personagens': 'Personagens', 'efeitos': 'Efeitos', 'cenarios': 'Cenários',
             'interface': 'Interface', 'cutscenes': 'Cutscenes'}


def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')


def empacotar(rects):
    """prateleiras por altura. rects: [(key, w, h)] → {key: (atlas, x, y)}, [(w, h)]"""
    order = sorted(rects, key=lambda r: (-r[2], -r[1]))
    pos, atlases, cur = {}, [], None
    grandes = []
    for key, w, h in order:
        if w + PAD > MAX or h + PAD > MAX:            # quadro enorme (fundo, aura gigante): atlas só dele
            if w > 8192 or h > 8192:
                raise SystemExit('Quadro grande demais: %s %dx%d' % (key, w, h))
            grandes.append((key, w, h))
            continue
        if cur is not None and cur['x'] + w + PAD > MAX:
            cur['y'] += cur['shelf'] + PAD
            cur['x'], cur['shelf'] = 0, 0
        if cur is None or cur['y'] + h + PAD > MAX:
            cur = dict(x=0, y=0, shelf=0, w=0, h=0)
            atlases.append(cur)
        pos[key] = (len(atlases) - 1, cur['x'], cur['y'])
        cur['x'] += w + PAD
        cur['shelf'] = max(cur['shelf'], h)
        cur['w'] = max(cur['w'], cur['x'])
        cur['h'] = max(cur['h'], cur['y'] + h)
    tam = [(a['w'], a['h']) for a in atlases]
    for key, w, h in grandes:
        pos[key] = (len(tam), 0, 0)
        tam.append((w, h))
    return pos, tam


class Fonte:
    """Uma origem de sprites (um jogo). folha(chave) → PIL.Image RGBA da imagem de origem."""

    def __init__(self, out, chave, nome, folha):
        self.out, self.chave, self.nome, self.folha = out, chave, nome, folha
        self.sprites = {}
        os.makedirs(os.path.join(out, 'assets/img/acervo'), exist_ok=True)
        os.makedirs(os.path.join(out, 'data/acervo/fontes'), exist_ok=True)

    def gravar(self, sid, nome, tipo, anims, objs=(), cat=None):
        """anims: [(nome, dict(fps, loop, repeatTo, pingpong, frames=[quadro…]))]"""
        assert tipo in TIPOS, tipo
        uniq = {}
        for _, a in anims:
            for f in a['frames']:
                uniq.setdefault((f['img'], f['x'], f['y'], f['w'], f['h']), (f['w'], f['h']))
        if not uniq:
            return None
        pos, tam = empacotar([(k, w, h) for k, (w, h) in uniq.items()])
        imgs = [Image.new('RGBA', t, (0, 0, 0, 0)) for t in tam]
        for k, (ai, x, y) in sorted(pos.items(), key=lambda kv: str(kv[0][0])):
            imgs[ai].paste(self.folha(k[0]).crop((k[1], k[2], k[1] + k[3], k[2] + k[4])), (x, y))
        atlas = []
        for i, im in enumerate(imgs):
            rel = 'assets/img/acervo/%s_%d.png' % (sid, i)
            im.save(os.path.join(self.out, rel), optimize=True)
            atlas.append(rel)
        d = dict(id=sid, atlases=atlas, acervo=dict(nome=nome, fonte=self.nome, tipo=tipo, origem=' '.join(map(str, objs))), anims={})
        if tipo == 'efeitos':
            d['tipo'] = 'efeito'
        for an, a in anims:
            fl = []
            for f in a['frames']:
                ai, x, y = pos[(f['img'], f['x'], f['y'], f['w'], f['h'])]
                q = [ai, x, y, f['w'], f['h'], int(round(f['ox'])), int(round(f['oy'])), f.get('dur', 1)]
                if f.get('pts'):
                    q.append([[int(round(p[0])), int(round(p[1]))] for p in f['pts']])
                fl.append(q)
            d['anims'][an] = dict(fps=a.get('fps', 10), loop=bool(a.get('loop')), repeatTo=a.get('repeatTo', 0),
                                  pingpong=bool(a.get('pingpong')), frames=fl)
        with open(os.path.join(self.out, 'data/acervo', sid + '.js'), 'w', encoding='utf-8') as fh:
            fh.write('FF_ACERVO_DEF(%s,' % json.dumps(sid))
            json.dump(d, fh, ensure_ascii=False, separators=(',', ':'))
            fh.write(');\n')
        self.sprites[sid] = dict(nome=nome, cat=cat or tipo, tipo=tipo, quadros=len(uniq), atlas=len(atlas),
                                 objs=list(map(str, objs)), anims={n: len(v['frames']) for n, v in d['anims'].items()})
        print('%-34s %-11s %4d anims %5d quadros %d atlas' % (sid, tipo, len(d['anims']), len(uniq), len(atlas)), flush=True)
        return d

    def fechar(self, categorias, extra=None):
        """grava data/acervo/fontes/<chave>.json. categorias: {cat: nome legível}"""
        ficha = dict(chave=self.chave, nome=self.nome, categorias=categorias, sprites=self.sprites)
        if extra:
            ficha.update(extra)
        with open(os.path.join(self.out, 'data/acervo/fontes', self.chave + '.json'), 'w', encoding='utf-8') as fh:
            json.dump(ficha, fh, ensure_ascii=False, indent=0)


ORDEM_FONTES = ['zl3']


def recompor(out):
    """junta data/acervo/fontes/*.json → indice.json, indice_anims.js, docs/ACERVO.md"""
    dfon = os.path.join(out, 'data/acervo/fontes')
    fontes = []
    for f in os.listdir(dfon):
        if f.endswith('.json'):
            with open(os.path.join(dfon, f), encoding='utf-8') as fh:
                fontes.append(json.load(fh))
    fontes.sort(key=lambda x: (ORDEM_FONTES.index(x['chave']) if x['chave'] in ORDEM_FONTES else 99, x['nome'].lower()))
    cats, sprites, anims = {}, {}, {}
    for fo in fontes:
        ordem_cat = list(fo['categorias'])
        for c, n in fo['categorias'].items():
            cats[c] = n
        ids = sorted(fo['sprites'], key=lambda i: (ordem_cat.index(fo['sprites'][i]['cat']) if fo['sprites'][i]['cat'] in ordem_cat else 99,
                                                   TIPOS.index(fo['sprites'][i]['tipo']), fo['sprites'][i]['nome'].lower()))
        for i in ids:
            v = fo['sprites'][i]
            sprites[i] = dict(nome=v['nome'], cat=v['cat'], tipo=v['tipo'], fonte=fo['chave'], anims=len(v['anims']),
                              quadros=v['quadros'], atlas=v['atlas'], objs=v['objs'])
            anims[i] = v['anims']
    with open(os.path.join(out, 'data/acervo/indice.json'), 'w', encoding='utf-8') as fh:
        json.dump(dict(categorias=cats, fontes={f['chave']: f['nome'] for f in fontes}, sprites=sprites), fh, ensure_ascii=False, indent=0)
    with open(os.path.join(out, 'data/acervo/indice_anims.js'), 'w', encoding='utf-8') as fh:
        fh.write('// Gerado por tools/acervo_comum.py — nomes das animações de cada sprite do acervo (busca do Estúdio).\n')
        fh.write('window.FF_ACERVO_ANIMS = ')
        json.dump(anims, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write(';\n')

    L = ['# Acervo de sprites', '',
         'Sprites extraídos dos jogos da pasta `Project Final Flash Sprites` (`tools/extrair_acervo.py` para o Z Legends 3, '
         '`tools/extrair_jogos.py` para os outros). Cada sprite fica em `data/acervo/<id>.js` + `assets/img/acervo/<id>_<n>.png` '
         'e aparece no Estúdio (aba Sprites e seletor de sprites). Nomes de animação são os do jogo de origem.', '',
         '**%d sprites · %d animações · %d quadros.**' % (len(sprites), sum(v['anims'] for v in sprites.values()),
                                                         sum(v['quadros'] for v in sprites.values())), '']
    for fo in fontes:
        ids = [i for i in sprites if sprites[i]['fonte'] == fo['chave']]
        L += ['## %s (%d sprites)' % (fo['nome'], len(ids)), '']
        for c in fo['categorias']:
            cids = [i for i in ids if sprites[i]['cat'] == c]
            if not cids:
                continue
            L += ['### %s (%d)' % (fo['categorias'][c], len(cids)), '', '| Sprite | Nome | Tipo | Animações | Quadros | Origem |', '|---|---|---|---|---|---|']
            for i in cids:
                v = sprites[i]
                o = ' '.join(v['objs'])
                L.append('| `%s` | %s | %s | %d | %d | %s |' % (i, v['nome'], NOME_TIPO[v['tipo']], v['anims'], v['quadros'], o[:80] + ('…' if len(o) > 80 else '')))
            L.append('')
        if fo.get('pulados'):
            L += ['Deixados de fora (invisíveis/vazios): %s' % ', '.join(fo['pulados']), '']
    with open(os.path.join(out, 'docs/ACERVO.md'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L))
    print('acervo: %d sprites em %d fontes' % (len(sprites), len(fontes)))
