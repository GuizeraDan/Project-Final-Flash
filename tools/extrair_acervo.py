#!/usr/bin/env python3
"""
Extrai TODO o Z Legends 3 (data.js do Construct 2) para o acervo de sprites do Final Flash.

Diferente de tools/extract_sprites.py (que monta um sprite escolhido à mão), este pega todos os
objetos com animação do jogo original e organiza assim:
  · personagens: as versões "inimigo" e "jogador" do mesmo lutador (quase os mesmos quadros) viram
    um sprite só, com a união das animações;
  · cenários: as camadas de cada cenário (parallax, objetos) viram um sprite por cenário;
  · cutscenes e guia de comandos: um sprite por luta/personagem (são enormes);
  · efeitos e interface: um sprite por objeto (objetos repetidos são juntados);
  · objetos vazios de 1 pixel (caixas de colisão, câmera…) ficam de fora.

Saída: veja tools/acervo_comum.py (nada disso entra no data/bundle.js — o jogo carrega cada sprite
só quando precisa). A ficha desta fonte fica em data/acervo/fontes/zl3.json.

Uso:
  python3 -I tools/extrair_acervo.py --www <pasta assets/www do ZL3> --out <raiz do projeto>
"""
import argparse, collections, json, os, re
from PIL import Image


# ---------------------------------------------------------------- nomes amigáveis
NOMES_PERSONAGENS = {
    'gokubase': 'Goku', 'gokussj': 'Goku SSJ', 'gokublue': 'Goku SSJ Blue', 'gokuui': 'Goku Instinto Superior',
    'gokugt': 'Goku GT', 'gokublackrose': 'Goku Black Rosé', 'raditz': 'Raditz', 'nappa': 'Nappa',
    'vegetasagasaiyan': 'Vegeta (Saga Saiyajin)', 'vegetabase': 'Vegeta', 'vegetassj': 'Vegeta SSJ',
    'vegetaegosuperior': 'Vegeta Ego Superior', 'piccolo': 'Piccolo', 'krillin': 'Kuririn',
    'tienshihan': 'Tenshinhan', 'gohanssj2': 'Gohan SSJ2', 'gohanultimate': 'Gohan Místico',
    'gohanbeast': 'Gohan Besta', 'miraigohan': 'Gohan do Futuro', 'miraitrunks': 'Trunks do Futuro',
    'supertrunks': 'Trunks Super', 'bardock': 'Bardock', 'bardockssj': 'Bardock SSJ', 'freeza': 'Freeza',
    'cooler': 'Cooler', 'ginyu': 'Ginyu', 'cell': 'Cell', 'android17': 'Androide 17', 'android18': 'Androide 18',
    'android21': 'Androide 21', 'majinbuu': 'Majin Boo', 'kidbuu': 'Kid Boo', 'janemba': 'Janemba',
    'brolyz': 'Broly (Z)', 'brolyikari': 'Broly (Super)', 'gogetassj4': 'Gogeta SSJ4',
    'gogetassjblue': 'Gogeta SSJ Blue', 'vegettossjblue': 'Vegetto SSJ Blue', 'superbaby2': 'Super Baby 2',
    'bills': 'Bills', 'hitto': 'Hit', 'jiren': 'Jiren', 'kefla': 'Kefla', 'zamasufusion': 'Zamasu Fundido',
    'moro73': 'Moro', 'z_assist': 'Assistências Z', 'chaos': 'Chaos', 'zamasu_attack': 'Zamasu (assistência)',
    'mai': 'Mai (assistência)', 'saibamen': 'Saibaman (assistência)', 'android17_assist': 'Androide 17 (assistência)',
    'vegetassjblue': 'Vegeta SSJ Blue (assistência)', 'ginyu_troop': 'Forças Especiais Ginyu',
}
NOMES_EFEITOS = {
    'explosao': 'Explosões', 'hit': 'Impactos de golpe', 'hit_forte': 'Impacto forte', 'hit_extremamente_forte': 'Impacto extremamente forte',
    'efeitodeimpacto': 'Efeitos de impacto', 'kiblast_jogador': 'Rajadas de ki', 'efeito_de_kiblast': 'Efeitos das rajadas de ki',
    'kamehameha_pt1': 'Kamehameha (parte 1)', 'kamehameha_pt2': 'Kamehameha (parte 2)', 'kamehameha_pt3': 'Kamehameha (parte 3)',
    'esferadekigigante': 'Esferas de ki gigantes', 'genkidamaefeito': 'Genki Dama (brilho)', 'aura_e_efeito_durante_especiais': 'Auras e efeitos dos especiais',
    'poeira1': 'Poeira 1', 'poeira2': 'Poeira 2', 'poeira3': 'Poeira 3', 'poeira4': 'Poeira 4', 'poeira5': 'Poeira 5', 'poeira7': 'Poeira 7',
    'poeira_especial': 'Poeira especial', 'poeira_de_colisao_com_o_solo': 'Poeira de colisão com o chão', 'poeiradesaltoequeda': 'Poeira de salto e queda',
    'impactoderochas': 'Impacto de rochas', 'chaodestruido': 'Chão destruído', 'explosaodeki_effect': 'Explosão de ki', 'efeito_quebravento': 'Quebra-vento (deslocamento)',
    'efeitodederrota': 'Efeito de derrota', 'efeitobranconatela': 'Clarão branco na tela', 'defesa_effect': 'Defesa', 'starteffectdust': 'Poeira do início da luta',
    'rajadarapida': 'Rajada rápida', 'makankosappo': 'Makankosappo', 'kiensan': 'Kienzan', 'sombra_dos_personagens': 'Sombra dos personagens',
    'mafuba_background': 'Mafuba (fundo)', 'thunder_effect': 'Raio', 'sparking_ativo_effect_jogador': 'Sparking ativo', 'explosion_specialball_effect': 'Explosão da esfera especial',
}
CATS = ['personagens', 'efeitos', 'cenarios', 'interface', 'cutscenes']
NOME_CAT = {'personagens': 'Personagens', 'efeitos': 'Efeitos', 'cenarios': 'Cenários',
            'interface': 'Interface', 'cutscenes': 'Cutscenes'}

INTERFACE = re.compile(r'^(hud|3vs3|gameload|loading_bar|personagem|personagens|bordas_da_tela|retornoaolayout|efeitodetransicao|efeitodetrocadeinimigo|controlguide|controlscommands|zlegends_logo|'
                       r'minhas_config|pause_btn|ko_txt|textosdebatalha|victoryandlose|survival_count|torneio|'
                       r'legendas_background|narradorbattle|bocas_de_falas|backgroundtransparente|energiexplosion_hud|'
                       r'sparking_icon|moro73_poderabsorvido|contadordehits|dragonball|objetosdasintro|cenarioselected)'
                       r'|_button$')
PERSONAGEM = re.compile(r'(_inimigo$|^gokugt_jogador$|^z_assist|^chaos_jogador$|_assists?$)')


def slug(s):
    s = re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')
    return s


def bonito(base):
    t = base.replace('_sprite', '').replace('_', ' ').strip()
    return t[:1].upper() + t[1:]


# ---------------------------------------------------------------- leitura do data.js
def ler(www):
    with open(os.path.join(www, 'data.js'), encoding='utf-8-sig') as fh:
        proj = json.load(fh)['project']
    objs = []
    for t in proj[3]:
        if not (len(t) > 7 and isinstance(t[7], list)):
            continue
        anims = []
        for a in t[7]:
            if not (isinstance(a, list) and a and isinstance(a[0], str) and a[7]):
                continue
            frames = [dict(img=f[0], x=f[2], y=f[3], w=f[4], h=f[5], dur=f[6], hx=f[7], hy=f[8], pts=f[9]) for f in a[7]]
            anims.append(dict(name=a[0], speed=a[1], loop=a[2], repeatTo=a[4], pingpong=a[5], frames=frames))
        if not anims:
            continue
        cnt = collections.Counter(re.sub(r'(_sprite)?-sheet\d+\.png$', '', f['img'].split('/')[-1])
                                  for a in anims for f in a['frames'])
        objs.append(dict(tid=t[0], num=int(t[0][1:]), anims=anims, base=cnt.most_common(1)[0][0]))
    return objs


def chave(f):
    return (f['img'], f['x'], f['y'], f['w'], f['h'])


def assinatura(a):
    return tuple(chave(f) + (f['hx'], f['hy']) for f in a['frames'])


INVISIVEIS = {'jogador_box', 'inimigo_box', 'camera', 'solidos'}


def vazio(o):
    """caixas de colisão, câmera, sólidos (invisíveis no jogo) e objetos de quadros minúsculos"""
    return o['base'] in INVISIVEIS or all(f['w'] * f['h'] <= 64 for a in o['anims'] for f in a['frames'])


# ---------------------------------------------------------------- agrupamento
def agrupar(objs):
    """→ lista de sprites: dict(id, nome, cat, anims=[(nome, anim, tid)], objs=[tids])"""
    pulados = [o['tid'] for o in objs if vazio(o)]
    objs = [o for o in objs if not vazio(o)]

    porbase = collections.OrderedDict()
    for o in sorted(objs, key=lambda o: -o['num']):        # versão "jogador" (número maior) primeiro
        porbase.setdefault(o['base'], []).append(o)

    sprites = collections.OrderedDict()

    def sprite(sid, nome, cat):
        if sid not in sprites:
            sprites[sid] = dict(id=sid, nome=nome, cat=cat, anims=[], objs=[], _sig={})
        return sprites[sid]

    def add(sp, nome, a, tid):
        sig = assinatura(a)
        if nome in sp['_sig']:
            if sp['_sig'][nome] == sig:
                return
            i = 2
            while '%s_%d' % (nome, i) in sp['_sig']:
                i += 1
            nome = '%s_%d' % (nome, i)
        sp['_sig'][nome] = sig
        sp['anims'].append((nome, a, tid))

    for base, lista in porbase.items():
        if base == 'cutscenes' or base == 'controlscommands_guia':
            pref = 'cut' if base == 'cutscenes' else 'guia'
            cat = 'cutscenes' if base == 'cutscenes' else 'interface'
            for o in lista:
                for a in o['anims']:
                    tok = re.split(r'[_ ]', a['name'])[0]
                    sp = sprite('zl3_%s_%s' % (pref, slug(tok)),
                                ('Cutscene · ' if pref == 'cut' else 'Guia de comandos · ') + tok, cat)
                    if o['tid'] not in sp['objs']:
                        sp['objs'].append(o['tid'])
                    add(sp, a['name'], a, o['tid'])
            continue

        m = re.match(r'^cenarios_([a-z]+)_(.+)$', base)
        if m and m.group(1) not in ('fundo', 'chao'):
            sp = sprite('zl3_cenario_' + m.group(1), 'Cenário · ' + m.group(1).capitalize(), 'cenarios')
            parte = m.group(2)
            for o in lista:
                sp['objs'].append(o['tid'])
                for a in o['anims']:
                    n = parte if (len(o['anims']) == 1 or a['name'] in ('Default', 'Animation 1')) else parte + '_' + a['name']
                    add(sp, n, a, o['tid'])
            continue

        if PERSONAGEM.search(base) and not INTERFACE.search(base):
            chave_nome = re.sub(r'(_inimigo|_jogador|_assists?)$', '', base)
            if base.endswith('_assist') or base.endswith('_assists'):
                chave_nome = {'android17': 'android17_assist', 'vegetassjblue': 'vegetassjblue', 'ginyu_troop': 'ginyu_troop'}.get(chave_nome, chave_nome)
            nome = NOMES_PERSONAGENS.get(chave_nome, bonito(chave_nome))
            cat = 'personagens'
        elif base.startswith('cenarios_'):
            nome, cat = ('Cenários · fundos' if base == 'cenarios_fundo' else 'Cenários · chãos'), 'cenarios'
            chave_nome = base
        elif INTERFACE.search(base):
            nome, cat, chave_nome = bonito(base), 'interface', base
        else:
            nome, cat, chave_nome = NOMES_EFEITOS.get(base) or bonito(base), 'efeitos', base
        if base.startswith('cenarioselected'):
            nome, cat = 'Prévias dos cenários', 'cenarios'
        sp = sprite('zl3_' + slug(chave_nome), nome, cat)
        for o in lista:
            sp['objs'].append(o['tid'])
            for a in o['anims']:
                add(sp, a['name'], a, o['tid'])

    out = list(sprites.values())
    for s in out:
        del s['_sig']
    return out, pulados


# ---------------------------------------------------------------- gravação (tools/acervo_comum.py)
def main():
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import acervo_comum as AC
    ap = argparse.ArgumentParser()
    ap.add_argument('--www', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--so', default='', help='só estes ids (separados por vírgula), para testar')
    args = ap.parse_args()

    objs = ler(args.www)
    sprites, pulados = agrupar(objs)
    if args.so:
        sprites = [s for s in sprites if s['id'] in args.so.split(',')]
    cache = {}

    def folha(p):
        if p not in cache:
            if len(cache) > 40:
                cache.clear()
            cache[p] = Image.open(os.path.join(args.www, p)).convert('RGBA')
        return cache[p]

    fonte = AC.Fonte(args.out, 'zl3', 'Z Legends 3', folha)
    for s in sprites:
        anims = []
        for nome, a, _ in s['anims']:
            fr = []
            for f in a['frames']:
                ox, oy = round(f['hx'] * f['w']), round(f['hy'] * f['h'])
                fr.append(dict(img=f['img'], x=f['x'], y=f['y'], w=f['w'], h=f['h'], ox=ox, oy=oy, dur=f['dur'],
                               pts=[[round(p[1] * f['w']) - ox, round(p[2] * f['h']) - oy] for p in (f['pts'] or [])]))
            anims.append((nome, dict(fps=a['speed'], loop=a['loop'], repeatTo=a['repeatTo'], pingpong=a['pingpong'], frames=fr)))
        fonte.gravar(s['id'], s['nome'], s['cat'], anims, s['objs'])
    if args.so:
        return
    fonte.fechar({c: NOME_CAT[c] for c in CATS}, dict(pulados=pulados))
    AC.recompor(args.out)


if __name__ == '__main__':
    main()
