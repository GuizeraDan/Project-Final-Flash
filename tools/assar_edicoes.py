"""
Assa no acervo o que deixa o data/edicoes.js pesado (o jogo carrega esse arquivo inteiro ao abrir):

  1. sprites separados no Estúdio (spritesNovos["sep_*"])  → data/acervo/sep_*.js + ficha data/acervo/fontes/sep.json
                                                             (fonte "Separados no Estúdio"; o jogo e o Estúdio carregam
                                                             como qualquer sprite do acervo)
  2. animações apagadas porque foram separadas ({"apagada": true} em sprites[orig][anim] com um sep_* vindo de
     orig#anim)                                             → tiradas de verdade de data/acervo/<orig>.js
     (as outras apagadas continuam no edicoes.js e voltam pela Lixeira como antes)
  3. organização do acervo (spritesInfo só com nome/pasta/oculto/nomesAnims) → data/acervo/organizacao.js
     (window.FF_EDICOES_BASE, só o Estúdio carrega; FF.Edicoes.base() junta por baixo do edicoes.js;
     no edicoes.js um {} por cima "zera" a organização assada daquele sprite)

Antes de mudar, guarda cópias em tools/backup/ (edicoes.js inteiro + as animações tiradas dos arquivos).
Uso: python3 -I tools/assar_edicoes.py [--simular]
"""
import json, os, sys, time, shutil

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, 'tools'))
import acervo_comum  # noqa: E402

SIMULAR = '--simular' in sys.argv
ARQ = os.path.join(RAIZ, 'data/edicoes.js')
DAC = os.path.join(RAIZ, 'data/acervo')
FONTES = os.path.join(DAC, 'fontes')
CAB = ('// Edições feitas no Estúdio (golpes, habilidades, sprites, personagens).\n'
       '// Arquivo gravado pelo próprio Estúdio via GitHub (botão ☁). Não edite à mão sem necessidade.\n')
ORG_CAMPOS = {'nome', 'pasta', 'oculto', 'nomesAnims'}


def ler_js(caminho, prefixo):
    t = open(caminho, encoding='utf-8').read()
    i = t.index(prefixo) + len(prefixo)
    return t, json.loads(t[i:t.rindex('}') + 1])


def ler_acervo(id_):
    t = open(os.path.join(DAC, id_ + '.js'), encoding='utf-8').read()
    i = t.index(',', t.index('FF_ACERVO_DEF(')) + 1
    return json.loads(t[i:t.rindex(')')])


def gravar_acervo(id_, d):
    with open(os.path.join(DAC, id_ + '.js'), 'w', encoding='utf-8') as fh:
        fh.write('FF_ACERVO_DEF(%s,%s);\n' % (json.dumps(id_), json.dumps(d, ensure_ascii=False, separators=(',', ':'))))


def main():
    txt = open(ARQ, encoding='utf-8').read()
    E = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
    antes = len(txt.encode('utf-8'))
    indice = json.load(open(os.path.join(DAC, 'indice.json'), encoding='utf-8'))['sprites']
    novos = E.get('spritesNovos') or {}
    info = E.get('spritesInfo') or {}
    seps = {k: v for k, v in novos.items() if k.startswith('sep_')}
    print('sprites separados:', len(seps))

    marca = time.strftime('%Y-%m-%d_%H%M')
    if not SIMULAR:
        os.makedirs(os.path.join(RAIZ, 'tools/backup'), exist_ok=True)
        shutil.copy(ARQ, os.path.join(RAIZ, 'tools/backup/edicoes_antes_de_assar_%s.js' % marca))

    # ---- 1. separados → acervo ----
    ficha = {'chave': 'sep', 'nome': 'Separados no Estúdio', 'categorias': {'sep': 'Separados no Estúdio'}, 'sprites': {}}
    fp = os.path.join(FONTES, 'sep.json')
    if os.path.exists(fp):
        ficha = json.load(open(fp, encoding='utf-8'))
    for id_, d in seps.items():
        orig = (d.get('separadoDe') or '').split('#')[0]
        tipo = (indice.get(orig) or {}).get('tipo') or 'efeitos'
        nome = (info.get(id_) or {}).get('nome') or (list(d.get('anims', {}))[:1] or [id_])[0]
        d2 = dict(d)
        d2['acervo'] = {'nome': nome, 'fonte': 'Separados no Estúdio', 'tipo': tipo, 'origem': d.get('separadoDe') or ''}
        quadros = sum(len(a.get('frames', [])) for a in d.get('anims', {}).values())
        ficha['sprites'][id_] = {'nome': nome, 'cat': 'sep', 'tipo': tipo, 'quadros': quadros, 'atlas': len(d.get('atlases', [])),
                                 'objs': [d.get('separadoDe') or ''], 'anims': {a: len(v.get('frames', [])) for a, v in d.get('anims', {}).items()}}
        if not SIMULAR:
            gravar_acervo(id_, d2)
        del novos[id_]

    # ---- 2. apagadas porque foram separadas → tiradas dos arquivos do acervo ----
    movidas = {}
    for d in seps.values():
        s = d.get('separadoDe') or ''
        if '#' in s:
            o, a = s.split('#', 1)
            movidas.setdefault(o, set()).add(a)
    sprites = E.get('sprites') or {}
    tiradas, guardadas, nt = {}, 0, 0
    fichas_cache = {}
    for o, anims in movidas.items():
        marcas = sprites.get(o) or {}
        alvo = [a for a in anims if (marcas.get(a) or {}).get('apagada')]
        if not alvo:
            continue
        caminho = os.path.join(DAC, o + '.js')
        if not os.path.exists(caminho):
            guardadas += len(alvo)   # sprite do jogo (data/sprites) ou importado: a marca continua no edicoes.js
            continue
        d = ler_acervo(o)
        for a in alvo:
            if a in d.get('anims', {}):
                tiradas.setdefault(o, {})[a] = d['anims'].pop(a)
            del marcas[a]
            nt += 1
        if not marcas:
            del sprites[o]
        if not SIMULAR:
            gravar_acervo(o, d)
        # ficha da fonte: tira o nome da animação da busca
        fonte = (indice.get(o) or {}).get('fonte') or ('sep' if o.startswith('sep_') else None)
        if fonte:
            fpath = os.path.join(FONTES, fonte + '.json')
            if fonte == 'sep':
                fi = ficha
            else:
                if fonte not in fichas_cache and os.path.exists(fpath):
                    fichas_cache[fonte] = json.load(open(fpath, encoding='utf-8'))
                fi = fichas_cache.get(fonte)
            if fi and o in fi['sprites']:
                for a in alvo:
                    fi['sprites'][o].get('anims', {}).pop(a, None)
    print('apagadas tiradas dos arquivos:', nt, '| continuam como marca (sprites do jogo):', guardadas)

    # ---- 3. organização do acervo → organizacao.js (só o Estúdio) ----
    base = {}
    for id_, v in list(info.items()):
        if v and set(v) <= ORG_CAMPOS:
            base[id_] = v
            del info[id_]
    print('organização assada:', len(base), '| continuam no edicoes.js (atlas/escala):', len(info))

    E['rev'] = int(time.time() * 1000)
    novo_txt = CAB + 'window.FF_EDICOES = ' + json.dumps(E, ensure_ascii=False, separators=(',', ':')) + ';\n'
    print('edicoes.js: %.0f KB → %.0f KB' % (antes / 1024, len(novo_txt.encode('utf-8')) / 1024))
    if SIMULAR:
        return
    with open(os.path.join(RAIZ, 'tools/backup/animacoes_separadas_tiradas_%s.json' % marca), 'w', encoding='utf-8') as fh:
        json.dump(tiradas, fh, ensure_ascii=False, separators=(',', ':'))
    with open(fp, 'w', encoding='utf-8') as fh:
        json.dump(ficha, fh, ensure_ascii=False, indent=0)
    for fonte, fi in fichas_cache.items():
        with open(os.path.join(FONTES, fonte + '.json'), 'w', encoding='utf-8') as fh:
            json.dump(fi, fh, ensure_ascii=False, indent=0)
    # organização: junta com a já assada antes (se rodar de novo)
    org_p = os.path.join(DAC, 'organizacao.js')
    if os.path.exists(org_p):
        _, ant = ler_js(org_p, 'window.FF_EDICOES_BASE = ')
        ant = ant.get('spritesInfo', {})
        ant.update(base)
        base = ant
    with open(org_p, 'w', encoding='utf-8') as fh:
        fh.write('// Gerado por tools/assar_edicoes.py — organização do acervo no Estúdio (nomes, pastas, Lixeira) que saiu do\n'
                 '// data/edicoes.js. Só o Estúdio carrega. O edicoes.js manda por cima ({} = sem organização).\n')
        fh.write('window.FF_EDICOES_BASE = ' + json.dumps({'spritesInfo': base}, ensure_ascii=False, separators=(',', ':')) + ';\n')
    with open(ARQ, 'w', encoding='utf-8') as fh:
        fh.write(novo_txt)
    acervo_comum.recompor(RAIZ)
    print('pronto.')


if __name__ == '__main__':
    main()
