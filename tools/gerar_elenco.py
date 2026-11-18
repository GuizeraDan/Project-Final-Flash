#!/usr/bin/env python3
"""
Elenco da Batalha Livre: transforma os sprites de PERSONAGENS do acervo (data/acervo/<id>.js) em lutadores jogáveis.

Uso: python3 -I tools/gerar_elenco.py [pacote ...]        (sem argumento = todos)
     depois: python3 tools/build_bundle.py

Para cada pacote com animações nomeadas (Z Legends 3, Assets, Super Pixel Warriors, Super Warriors Z, Twiss Dragno,
Ultimate Heroes) gera:
  data/elenco/<pacote>.js          FF_ELENCO_DEF('<pacote>', [fichas])  (carregado só quando a aba abre / a luta começa)
  assets/img/elenco/<pacote>.png   retratos (rosto + ombros recortados do quadro parado, 80×112 cada)
  data/elenco/indice.js            FF_ELENCO_INDICE = [{id, nome, n}]
A ficha diz quais animações fazem o quê (parado, dano, guarda, combo, rajada, especiais, supremo…); o jogo monta
os golpes com o "kit" de js/core/elenco.js. Os pacotes sem nomes de animação (Drag Warriors, Dragon Legend Z,
Legend Warrior, Power Warrior, Mini Champion) ficam de fora até ganharem receitas (tools/receitas/acervo/).
"""
import json, os, re, sys
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RAIZ)

PACOTES = {
    'zl3': ('Z Legends 3', 'personagens'),
    'swz': ('Super Warriors Z', 'swz'),
    'uh': ('Ultimate Heroes', 'uh'),
    'twiss': ('Twiss Dragno', 'twiss'),
    'spw': ('Super Pixel Warriors', 'spw'),
    'ast': ('Assets (fãs)', 'ast'),
    'mc': ('Mini Champion', 'mc'),
}
ALTURA_ALVO = 52          # altura do corpo parado (px) depois da escala: o tamanho dos lutadores do ZL3
CEL_W, CEL_H = 80, 112    # retrato 40×56 em 2×
# personagens que o jogo já tem (feitos à mão, com vozes): não repete no Z Legends 3
JA_TEM = {'zl3_gokubase', 'zl3_gokussj', 'zl3_raditz', 'zl3_piccolo', 'zl3_krillin', 'zl3_nappa', 'zl3_vegetasagasaiyan', 'zl3_saibamen'}


def carregar(sid):
    s = open('data/acervo/%s.js' % sid, encoding='utf-8').read()
    return json.loads(s[s.index('{'):s.rindex('}') + 1])


def norm(n):
    return re.sub(r'[\s_]+', ' ', n.strip().lower())


class Achar:
    """procura animações pelo nome (sem diferenciar maiúsculas, espaços e _)"""
    def __init__(self, anims):
        self.anims = anims
        self.mapa = {}
        for k in anims:
            self.mapa.setdefault(norm(k), k)

    def um(self, *nomes):
        for n in nomes:
            if isinstance(n, re.Pattern):
                for k in self.anims:
                    if n.fullmatch(k.strip()):
                        return k
            elif norm(n) in self.mapa:
                return self.mapa[norm(n)]
        return None

    def todos(self, *nomes):
        return [x for x in (self.um(n) for n in nomes) if x]

    def serie(self, prefixo, n=8):
        out = []
        for i in range(1, n + 1):
            k = self.um(prefixo + str(i), prefixo + ' ' + str(i), prefixo + '_' + str(i))
            if k:
                out.append(k)
        return out


I = re.IGNORECASE

# ---------------- nomes de golpes do ZL3 (anim "Special_<Nome>…" → nome bonito) ----------------
TRAD = {
    'EnergyWave': 'Onda de Energia', 'EnergyBlast': 'Rajada de Energia', 'DeathBeam': 'Raio da Morte', 'DeathBall': 'Bola da Morte',
    'GalickGun': 'Galick Ho', 'FinalFlash': 'Final Flash', 'BigBang': 'Big Bang Attack', 'BigBangAttack': 'Big Bang Attack',
    'Kamehameha': 'Kamehameha', 'SpiritBomb': 'Genki Dama', 'DestructoDisc': 'Kienzan', 'SpecialBeamCannon': 'Makankosappo',
    'Masenko': 'Masenko', 'SolarFlare': 'Taiyoken', 'BurningAttack': 'Burning Attack', 'FinishBuster': 'Finish Buster',
    'BusterCannon': 'Buster Cannon', 'Barrier': 'Barreira', 'Teleport': 'Teletransporte', 'Rush': 'Investida', 'Combo': 'Combo',
    'PowerBlitz': 'Power Blitz', 'Kienzan': 'Kienzan', 'HellsFlash': 'Hell\'s Flash', 'GigantickMeteor': 'Gigantic Meteor',
    'EraserCannon': 'Eraser Cannon', 'Supernova': 'Supernova', 'NovaStrike': 'Nova Strike', 'TimeSkip': 'Salto no Tempo',
    'BurningSlash': 'Burning Slash', 'ShiningSlash': 'Shining Slash', 'HeatDomeAttack': 'Heat Dome', 'DragonFist': 'Punho do Dragão',
    'GodKamehameha': 'Kamehameha Divino', 'FinalShine': 'Final Shine', 'FinalExplosion': 'Explosão Final', 'Hakai': 'Hakai',
}
ENERGIA = re.compile(r'wave|beam|blast|ball|kame|cannon|flash|bomb|galick|disc|shot|gun|buster|ray|laser|nova|ki|energy|bang|masenko|sphere|esfera|meteor|explos|shine|onda|raio|bola', I)
CORPO = re.compile(r'rush|kick|punch|combo|dance|grapple|dash|slash|strike|fist|claw|impact|smash|elbow|knee|tackle|throw|grab|blitz|drive|gear|soco|chute', I)
DIRECOES = re.compile(r'^(aereo|agachado|frente|tras|cima|baixo|chao|ar|ground|air|crouch|up|down|front|back|variation\d*|tras chao|tras ar|cimafrente|cimatras|horizontal|vertical)$', I)
PARTES = re.compile(r'^(.*?)(?:_(start|charge|carga|inicio|pt\d+|loop|final|fim|end|shot|fire|hit|continued|continuad|acertou|finish))+$', I)
ORDEM_PARTE = ['start', 'inicio', 'charge', 'carga', 'pt1', 'pt2', 'pt3', 'pt4', 'pt5', 'pt6', 'loop', 'continued', 'continuad', 'shot', 'fire', 'final', 'fim', 'finish', 'end', 'hit', 'acertou']


def humano(s):
    s = re.sub(r'([a-z])([A-Z])', r'\1 \2', s)
    s = re.sub(r'([A-Z])([A-Z][a-z])', r'\1 \2', s)
    s = re.sub(r'(\d)([A-Za-z])', r'\1 \2', s)
    s = re.sub(r'([A-Za-z])(\d)', r'\1 \2', s)
    return s.replace('_', ' ').strip()


def nome_golpe(base):
    b = re.sub(r'^(UltimateAttack|Ultimate|Special|Super)_?', '', base)
    b = re.sub(r'^Attack_?', '', b)
    if re.fullmatch(r'\d*', b):
        return ''
    for k, v in TRAD.items():
        if b.lower() == k.lower():
            return v
    return humano(b) if b else ''


def agrupar(nomes, prefixo):
    """Special_X_Pt1, Special_X_Pt2, Special_X_Final → {Special_X: [na ordem]} (ignora variações de direção)"""
    grupos = {}
    for k in nomes:
        if not k.startswith(prefixo):
            continue
        m = PARTES.match(k)
        base = m.group(1) if m else k
        resto = base[len(prefixo):].strip('_')
        if not resto and prefixo == 'Special':
            continue                     # "Special" sozinho = rajada de ki
        ult = resto.split('_')[-1] if resto else ''
        if resto and (DIRECOES.match(resto.replace('_', ' ')) or DIRECOES.match(ult)) and prefixo == 'Special':
            continue
        if re.search(r'aereo|agachado|_ar$|_tras|variation|errou|_miss', k, I) and prefixo == 'Special':
            continue
        grupos.setdefault(base, []).append(k)

    def chave(k):
        m = re.search(r'_(start|inicio|charge|carga|pt\d+|loop|continued|continuad|shot|fire|final|fim|finish|end|hit|acertou)$', k, I)
        p = m.group(1).lower() if m else ''
        return ORDEM_PARTE.index(p) if p in ORDEM_PARTE else (-1 if not m else 50)
    for b in grupos:
        grupos[b].sort(key=chave)
        grupos[b] = [a for a in grupos[b] if not re.search(r'_(hit|acertou)$', a, I)] or grupos[b]
    return grupos


# ---------------- leitura das animações por pacote ----------------
def papeis(pac, sid, anims):
    A = Achar(anims)
    p = {}
    if pac == 'zl3':
        p['parado'] = A.um('Parado', 'Idle')
        p['dano1'] = A.um('Dano_Chao1', 'Dano'); p['dano2'] = A.um('Dano_Chao2') or p['dano1']
        p['guarda'] = A.um('Defesa_Chao', 'Defesa'); p['lancado'] = A.um('SendoLancado_LADO', 'SendoLancado_GIRANDO') or p['dano2']
        p['caido'] = A.um('Caido', 'CaidoNoChao') or p['lancado']
        p['avancar'] = A.um('MovimentoParaFrente', 'Dash'); p['recuar'] = A.um('MovimentoParaTras')
        p['teleporte'] = A.um('Teletransporte_Chao', 'Teletransporte_Ar'); p['dash'] = A.um('Dash')
        p['carregar'] = A.todos('CarregandoKi_Stage1', 'CarregandoKi_Stage2', 'CarregandoKi_Stage3')
        p['combo'] = A.todos('Attack_Light_1', 'Attack_Light_2', 'Attack_Medium', 'Attack_Heavy') or A.todos('Attack_Light_1', 'Attack_Light_2', 'Attack_Light_3')
        p['rajada'] = A.um('Special', 'Special_Frente')
        p['vitoria'] = A.um('Pose_De_Vitoria', 'Vitoria')
        esp = agrupar(list(anims), 'Special')
        ult = agrupar(list(anims), 'Ultimate')
        bons = sorted(esp.items(), key=lambda kv: (-len(kv[1]), list(anims).index(kv[1][0])))
        p['especiais'] = []
        for base, lista in bons[:3]:
            nm = nome_golpe(base)
            p['especiais'].append({'nome': nm or 'Especial', 'anims': lista[:5], 'tipo': 'corpo' if CORPO.search(base) and not ENERGIA.search(base) else 'energia'})
        if not ult and len(bons) > 1:      # sem animação "Ultimate": o especial maior vira o supremo
            base, lista = bons[0]
            p['especiais'] = p['especiais'][1:]
            ult = {base: lista}
        if ult:
            base, lista = sorted(ult.items(), key=lambda kv: -len(kv[1]))[0]
            nm = nome_golpe(base)
            p['supremo'] = {'nome': nm if nm and nm.lower() != 'attack' else '', 'anims': lista[:6], 'tipo': 'corpo' if CORPO.search(base) and not ENERGIA.search(base) else 'energia'}
        return p

    if pac == 'mc':
        p['parado'] = A.um('Parado'); p['dano1'] = A.um('Dano1'); p['dano2'] = A.um('Dano2') or p['dano1']
        p['guarda'] = A.um('Defendendo'); p['lancado'] = A.um('Dano3') or p['dano2']; p['caido'] = A.um('Morte') or p['lancado']
        p['avancar'] = A.um('AndandoDireita'); p['recuar'] = A.um('AndandoEsquerda') or p['avancar']
        p['teleporte'] = A.um('TeleportChão', 'Teleport'); p['dash'] = A.um('AndandoDireita')
        p['carregar'] = A.todos('CarregarKi')
        p['combo'] = A.todos('Soco1', 'Soco2', 'Chute1', 'Chute3')
        p['rajada'] = A.um('KiBlast1', 'Kiblast2')
        p['vitoria'] = A.um('Victory')
        esp = []
        for n in (1, 2):
            e = A.todos('Especial%d' % n, 'Especial%d_Continuacao' % n, 'Especial%d_Final' % n)
            if e: esp.append({'nome': '', 'anims': e, 'tipo': 'energia'})
        sup = [k for k in anims if k.startswith('Especial3') and not re.search(r'lv1', k)]
        if sup: p['supremo'] = {'nome': '', 'anims': sup[:5], 'tipo': 'energia'}
        p['especiais'] = esp
        return p

    if pac == 'ast' and A.um('Parado') and not A.um('Idle'):
        # receitas do acervo (tools/receitas/acervo/): nomes em português
        p['parado'] = A.um('Parado', 'Postura')
        p['dano1'] = A.um('Dano', 'Dano_Agachado', 'Lancado') or A.um('Caido') or p['parado']
        p['dano2'] = p['dano1']
        p['guarda'] = A.um('Defesa', 'Postura')
        p['lancado'] = A.um('Lancado', 'Caido') or p['dano1']
        p['caido'] = A.um('Caido') or p['lancado']
        p['avancar'] = A.um('Avanco', 'Voando', 'Rastro_Dash'); p['recuar'] = p['avancar']
        p['teleporte'] = A.um('Teletransporte'); p['dash'] = A.um('Avanco', 'Rastro_Dash')
        p['carregar'] = A.todos('Carregar_Ki')
        p['combo'] = A.todos('Soco', 'Chute', 'Golpe', 'Combo', 'Golpes')[:4]
        p['rajada'] = A.um('Rajada_Ki', 'Rajada', 'Disparo')
        p['vitoria'] = A.um('Pose', 'Poses', 'Postura')
        if A.um('Projetil_Ki'):
            p['projetil'] = {'fx': A.um('Projetil_Ki'), 'sprite': sid}
        esp = []
        for nm, partes, tipo in [('Kamehameha', ('Kamehameha_Carga', 'Kamehameha', 'Kamehameha_Raio'), 'energia'), ('Golpe Giratório', ('Golpe_Giratorio',), 'corpo'),
                                 ('Investida', ('Investida',), 'corpo'), ('Rajada Grande', ('Rajada_Grande',), 'energia'), ('Esfera de Energia', ('Esfera', 'Esfera_Dupla'), 'energia'),
                                 ('Raio', ('Raio', 'Raio_Roxo'), 'energia'), ('Corte', ('Corte',), 'corpo')]:
            a = A.todos(*partes)
            if a and not (nm == 'Kamehameha' and a == [A.um('Kamehameha_Carga')]):
                esp.append({'nome': nm, 'anims': a, 'tipo': tipo})
        en = [e for e in esp if e['tipo'] == 'energia']
        if en:
            sup = max(en, key=lambda e: len(e['anims']))
            esp.remove(sup); p['supremo'] = dict(sup, nome=sup['nome'] if sup['nome'] != 'Raio' else '')
        p['especiais'] = esp[:3]
        return p

    def serie_ou(*pref):
        for pr in pref:
            s = A.serie(pr)
            if s:
                return s
        return []
    R = re.compile
    p['parado'] = A.um('parado', 'idle', 'stand', R(r'stand.*', I), R(r'idle.*', I))
    p['dano1'] = A.um('dano 1', 'dano', 'damage', 'damaged', 'hurt', R(r'dano.*', I))
    p['dano2'] = A.um('dano 2', 'dano 3') or p['dano1']
    p['guarda'] = A.um('defesa', 'defend', 'def', 'block', 'guard')
    p['lancado'] = A.um('dano 3', 'paralisado', 'dano 2') or p['dano2']
    p['caido'] = A.um('derrota', 'derrota 1', 'derrota ', 'die', 'dead', 'lose', 'der2', 'caido', 'caindo') or p['lancado']
    p['avancar'] = A.um('frente', 'move', 'walk', 'dash', 'fastmove')
    p['recuar'] = A.um('tras', 'trás', 'atraz', 'back') or p['avancar']
    p['teleporte'] = A.um('tp', 'teleport', 'teleporte')
    p['dash'] = A.um('dash aura loop', 'dash', 'fastmove')
    p['carregar'] = [x for x in [A.um('pre ki', 'ante charge'), A.um('ki aura loop', 'charge')] if x]
    p['combo'] = serie_ou('combo', 'atk', 'attack', 'fight')[:5]
    p['rajada'] = A.um('ki blast', 'blast1', 'blast', 'shoot', 'blast 1')
    p['vitoria'] = A.um('vitoria', 'vitoria 1', 'vitória', 'win', 'intro', 'start')
    if pac == 'twiss' and A.um('bola'):
        p['projetil'] = {'fx': A.um('bola'), 'sprite': sid}
    esp, sup = [], None
    if pac == 'swz':
        e = A.todos('pre especial', 'segurando especial loop', 'lancando especial')
        s = A.todos('pre super especial', 'segurando super especial loop', 'lancando super especial')
        if e: esp.append({'nome': 'Especial', 'anims': e, 'tipo': 'energia'})
        if s: sup = {'nome': '', 'anims': s, 'tipo': 'energia'}
    elif pac == 'uh':
        for n in (1, 2):
            e = A.todos('Special%d' % n, 'Special%d_Continued' % n, 'Special%d_Final' % n)
            if e: esp.append({'nome': '', 'anims': e, 'tipo': 'energia'})
        r = A.um('Special_Rapido')
        if r: esp.append({'nome': 'Golpe Rápido', 'anims': [r], 'tipo': 'corpo'})
        s = A.todos('Special3', 'Special3_Continuad', 'Special3_Continued', 'Special3_Final')
        if s: sup = {'nome': '', 'anims': s, 'tipo': 'energia'}
        if A.um('Blast2'): esp.append({'nome': 'Rajada Dupla', 'anims': [A.um('Blast2')], 'tipo': 'energia'})
    elif pac == 'spw':
        if A.um('Sp1'): esp.append({'nome': '', 'anims': [A.um('Sp1')], 'tipo': 'energia'})
        if A.um('Sp2'): sup = {'nome': '', 'anims': [A.um('Sp2')], 'tipo': 'energia'}
    elif pac == 'ast':
        if A.um('Skill1'): esp.append({'nome': '', 'anims': [A.um('Skill1')], 'tipo': 'energia'})
        s2 = A.todos('Skill2', 'Skill2Attack')
        if s2: esp.append({'nome': '', 'anims': s2, 'tipo': 'energia'})
        if A.um('Skill3'): sup = {'nome': '', 'anims': [A.um('Skill3')], 'tipo': 'energia'}
        if not p['parado']:
            p['parado'] = A.um('Start', 'Move')
    elif pac == 'twiss':
        sk = serie_ou('skill')
        for k in sk[:-1] if len(sk) > 1 else []:
            esp.append({'nome': '', 'anims': [k], 'tipo': 'energia'})
        if sk: sup = {'nome': '', 'anims': [sk[-1]], 'tipo': 'energia'}
    p['especiais'] = esp
    if sup: p['supremo'] = sup
    return p


# ---------------- nomes dos personagens ----------------
TRAD_NOME = {'frieza': 'Freeza', 'frizea': 'Freeza', 'mirai': 'do Futuro', 'kid': 'Kid', 'teen': 'Jovem', 'vovo': 'Vovô', 'mestre': 'Mestre',
             'android': 'Androide', 'krilin': 'Kuririn', 'tien': 'Tenshinhan', 'saibamen': 'Saibaman', 'ozaru': 'Oozaru', 'bot': '', 'player': '', 'palyer': ''}


def nome_bonito(pac, sid, nome):
    if pac == 'zl3':
        return nome
    if pac == 'mc':
        m = re.match(r'B_(\d+)(F\d+)?$', nome.strip())
        return ('Lutador %s' % m.group(1) + (' (forma %s)' % m.group(2)[1:] if m.group(2) else '')) if m else humano(nome)
    if pac == 'twiss':
        return re.sub(r'\s*\([a-z0-9]+\)\s*$', '', nome).strip()
    n = nome.split('/')[-1].strip()
    n = re.sub(r'^\d+_', '', n)
    if pac == 'swz':
        partes = [TRAD_NOME.get(x, x.capitalize()) for x in n.split('_')]
        if 'do Futuro' in partes:
            partes.remove('do Futuro'); partes.append('do Futuro')
        num = [x for x in partes if x.isdigit()]
        partes = [x for x in partes if x and not x.isdigit()]
        return ' '.join(partes) + (' (%s)' % num[0] if num else '')
    if pac == 'spw':
        m = re.match(r'([A-Za-z_]+?)(\d*)_?(\d*)$', n)
        if m:
            base = humano(m.group(1)).strip()
            base = re.sub(r'^A(\d+)$', r'Androide \1', base)
            v = '-'.join(x for x in (m.group(2), m.group(3)) if x)
            return base + (' ' + v if v else '')
        return humano(n)
    if pac == 'uh':
        n = re.sub(r'_BOT$', '', n, flags=I)
        return humano(n)
    n = humano(n) if '_' in n or re.search(r'[a-z][A-Z]', n) else n
    return n[:1].upper() + n[1:]


# ---------------- imagem: altura, pé, quadro mais "esticado" ----------------
class Imgs:
    def __init__(self, d):
        self.d = d
        self.cache = {}

    def atlas(self, i):
        if i not in self.cache:
            self.cache[i] = Image.open(self.d['atlases'][i]).convert('RGBA')
        return self.cache[i]

    def quadro(self, f):
        return self.atlas(f[0]).crop((f[1], f[2], f[1] + f[3], f[2] + f[4]))

    def bbox(self, f):
        return self.quadro(f).getbbox()


def olha_esquerda(pac):
    return pac == 'spw'


def pico(imgs, an, esq):
    """índice do quadro em que o golpe vai mais longe para a frente (onde o acerto/projétil acontece)"""
    melhor, mv = 0, -1e9
    for i, f in enumerate(an['frames']):
        bb = imgs.bbox(f)
        if not bb:
            continue
        alc = (f[5] - bb[0]) if esq else (bb[2] - f[5])
        if alc > mv:
            mv, melhor = alc, i
    return melhor


def retrato(imgs, f, esq):
    q = imgs.quadro(f)
    bb = q.getbbox()
    if not bb:
        return None
    q = q.crop(bb)
    w, h = q.size
    a = q.split()[3].load()
    # centro da cabeça: média dos pixels opacos no alto do desenho
    xs = [x for y in range(max(1, int(h * 0.22))) for x in range(w) if a[x, y] > 40]
    cx = sum(xs) / len(xs) if xs else w / 2
    ch = max(12, int(h * 0.48))          # cabeça + ombros
    cw = ch * CEL_W / CEL_H
    x0 = int(round(cx - cw / 2))
    corte = Image.new('RGBA', (int(round(cw)), ch), (0, 0, 0, 0))
    corte.paste(q.crop((max(0, x0), 0, min(w, x0 + int(round(cw))), ch)), (max(0, -x0), 0))
    if esq:
        corte = corte.transpose(Image.FLIP_LEFT_RIGHT)
    return corte.resize((CEL_W, CEL_H), Image.NEAREST if ch < CEL_H else Image.LANCZOS)


def gerar(pac):
    nome_pac, cat = PACOTES[pac]
    idx = json.load(open('data/acervo/indice.json', encoding='utf-8'))['sprites']
    ids = sorted(k for k, v in idx.items() if v.get('tipo') == 'personagens' and v.get('cat') == cat)
    if pac == 'zl3':
        ids = [k for k in ids if k not in JA_TEM and 'assist' not in k and 'assistência' not in idx[k]['nome'].lower()]
    if pac == 'swz':
        ids = [k for k in ids if not (k.endswith('_bot') and (k[:-4] + '_player') in idx)]
    if pac == 'uh':
        ids = [k for k in ids if not (k.lower().endswith('_bot') and k[:-4] in idx)]
    fichas, rets = [], []
    esq = olha_esquerda(pac)
    for sid in ids:
        try:
            d = carregar(sid)
        except Exception as e:
            print('  pulei', sid, e); continue
        anims = d.get('anims') or {}
        p = papeis(pac, sid, anims)
        tem_ataque = p.get('combo') or p.get('rajada') or p.get('especiais')
        if not p.get('parado') or not tem_ataque or not p.get('dano1'):
            continue
        imgs = Imgs(d)
        f0 = anims[p['parado']]['frames'][0]
        bb = imgs.bbox(f0)
        if not bb:
            continue
        alt = bb[3] - bb[1]
        if alt < 14:
            continue
        # escala: corpo parado com a altura dos lutadores do ZL3; pé = base do desenho (alguns pacotes têm quadros
        # 200×200 com a origem no meio) — o jogo soma "dy" ao Y da origem de todos os quadros
        escala = round(ALTURA_ALVO / alt, 3) if pac != 'zl3' else None
        dy = (bb[3] - f0[6]) if pac in ('swz',) else 0
        # golpes: quadro do acerto/projétil
        def com_pico(lista):
            return [[a, pico(imgs, anims[a], esq)] for a in lista if a in anims]
        ficha = {'id': 'el_' + sid, 'nome': nome_bonito(pac, sid, idx[sid]['nome']), 'sprite': sid}
        if escala and abs(escala - 1) > 0.03:
            ficha['escala'] = escala
        if dy:
            ficha['dy'] = dy
        if esq:
            ficha['espelhar'] = True
        ficha['anims'] = {k: p[k] for k in ('parado', 'dano1', 'dano2', 'guarda', 'lancado', 'caido', 'avancar', 'recuar', 'teleporte', 'dash', 'vitoria') if p.get(k)}
        if p.get('carregar'): ficha['carregar'] = p['carregar']
        if p.get('combo'): ficha['combo'] = com_pico(p['combo'])
        if p.get('rajada'): ficha['rajada'] = com_pico([p['rajada']])[0]
        if p.get('projetil'): ficha['projetil'] = p['projetil']
        ficha['especiais'] = [dict(e, anims=com_pico(e['anims'])) for e in p.get('especiais', []) if any(a in anims for a in e['anims'])]
        if p.get('supremo'): ficha['supremo'] = dict(p['supremo'], anims=com_pico(p['supremo']['anims']))
        # animação de golpe sem fps (ou com fps absurdo) e vários quadros: o jogo nunca terminaria — usa 10
        usadas = [x[0] for x in ficha.get('combo', [])] + ([ficha['rajada'][0]] if ficha.get('rajada') else []) + \
            [x[0] for e in ficha['especiais'] for x in e['anims']] + [x[0] for x in (ficha.get('supremo') or {}).get('anims', [])] + ficha.get('carregar', [])
        fx = {a: 10 for a in set(usadas) if a in anims and (not anims[a].get('fps') or anims[a]['fps'] > 60) and len(anims[a]['frames']) > 1}
        if fx: ficha['fps'] = fx
        # retrato: rosto do próprio jogo (Twiss tem a animação "face"), senão recorte do quadro parado
        img = None
        face = Achar(anims).um('face', 'Retrato')
        if face:
            q = imgs.quadro(anims[face]['frames'][0]); bq = q.getbbox()
            if bq:
                q = q.crop(bq); k = min(CEL_W / q.width, CEL_H / q.height)
                img = Image.new('RGBA', (CEL_W, CEL_H), (0, 0, 0, 0))
                qq = q.resize((max(1, int(q.width * k)), max(1, int(q.height * k))), Image.LANCZOS)
                img.paste(qq, ((CEL_W - qq.width) // 2, (CEL_H - qq.height) // 2))
        if img is None:
            img = retrato(imgs, f0, esq)
        if img is not None:
            ficha['_ret'] = len(rets); rets.append(img)
        fichas.append(ficha)
    # atlas de retratos
    cols = 20
    linhas = max(1, (len(rets) + cols - 1) // cols)
    at = Image.new('RGBA', (cols * CEL_W, linhas * CEL_H), (0, 0, 0, 0))
    for i, im in enumerate(rets):
        at.paste(im, ((i % cols) * CEL_W, (i // cols) * CEL_H))
    os.makedirs('assets/img/elenco', exist_ok=True)
    caminho = 'assets/img/elenco/%s.png' % pac
    at.save(caminho, optimize=True)
    for f in fichas:
        if '_ret' in f:
            i = f.pop('_ret')
            f['retrato'] = {'img': caminho, 'x': (i % cols) * CEL_W, 'y': (i // cols) * CEL_H, 'w': CEL_W, 'h': CEL_H}
    # nomes repetidos: numera
    vistos = {}
    for f in fichas:
        vistos[f['nome']] = vistos.get(f['nome'], 0) + 1
    cont = {}
    for f in fichas:
        if vistos[f['nome']] > 1:
            cont[f['nome']] = cont.get(f['nome'], 0) + 1
            f['nome'] = '%s #%d' % (f['nome'], cont[f['nome']])
    fichas.sort(key=lambda f: f['nome'].lower())
    os.makedirs('data/elenco', exist_ok=True)
    with open('data/elenco/%s.js' % pac, 'w', encoding='utf-8') as fp:
        fp.write('// gerado por tools/gerar_elenco.py — não edite à mão (os golpes se ajustam no Estúdio)\n')
        fp.write('FF_ELENCO_DEF(%s, %s);\n' % (json.dumps(pac), json.dumps({'nome': nome_pac, 'personagens': fichas}, ensure_ascii=False, separators=(',', ':'))))
    print('%s: %d lutadores (de %d sprites), retratos %dx%d' % (pac, len(fichas), len(ids), at.width, at.height))
    return {'id': pac, 'nome': nome_pac, 'n': len(fichas)}


def main():
    alvo = sys.argv[1:] or list(PACOTES)
    caminho = 'data/elenco/indice.json'
    ind = json.load(open(caminho)) if os.path.exists(caminho) else []
    por = {x['id']: x for x in ind}
    for pac in alvo:
        por[pac] = gerar(pac)
    ind = [por[k] for k in PACOTES if k in por]
    json.dump(ind, open(caminho, 'w'), ensure_ascii=False, indent=1)
    with open('data/elenco/indice.js', 'w', encoding='utf-8') as fp:
        fp.write('// gerado por tools/gerar_elenco.py\nwindow.FF_ELENCO_INDICE = %s;\n' % json.dumps(ind, ensure_ascii=False))


if __name__ == '__main__':
    main()
