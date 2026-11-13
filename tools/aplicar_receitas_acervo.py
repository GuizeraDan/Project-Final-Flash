#!/usr/bin/env python3
"""Aplica tools/receitas/acervo/<id>.json aos sprites do acervo: cria animações com nome a partir dos quadros
(índices da animação "Todos", vistos em tools/folha_acervo.py). Mantém "Todos". Depois recompõe o índice.
Receita: {"anims": {"Parado": {"q": [0, 1, 2], "fps": 6, "loop": true}, "Soco": {"q": "10-13"}, …}}
Uso: python3 -I tools/aplicar_receitas_acervo.py [id …]   (sem ids: todas as receitas)"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import acervo_comum as AC
R = 'tools/receitas/acervo'


def indices(q):
    if isinstance(q, str):
        out = []
        for parte in q.split(','):
            if '-' in parte:
                a, b = parte.split('-'); out += list(range(int(a), int(b) + 1))
            elif parte.strip():
                out.append(int(parte))
        return out
    return list(q)


ids = sys.argv[1:] or sorted(f[:-5] for f in os.listdir(R) if f.endswith('.json'))
fichas = {}
for sid in ids:
    rec = json.load(open(os.path.join(R, sid + '.json'), encoding='utf-8'))
    p = 'data/acervo/%s.js' % sid
    t = open(p, encoding='utf-8').read()
    d = json.loads(t[t.index(',') + 1:t.rindex(')')])
    todos = d.get('_todos') or d['anims']['Todos']['frames']
    d['_todos'] = todos                                   # guarda a lista original (índices da receita)
    novas = {}
    for nome, a in rec['anims'].items():
        fr = [todos[i] for i in indices(a['q']) if 0 <= i < len(todos)]
        if fr:
            novas[nome] = dict(fps=a.get('fps', 10), loop=bool(a.get('loop', False)), repeatTo=0, pingpong=False, frames=fr)
    usados = set(i for a in rec['anims'].values() for i in indices(a['q']))
    sobra = [todos[i] for i in range(len(todos)) if i not in usados]
    if sobra:
        novas['Outros'] = dict(fps=10, loop=False, repeatTo=0, pingpong=False, frames=sobra)
    novas['Todos'] = dict(fps=10, loop=True, repeatTo=0, pingpong=False, frames=todos)
    d['anims'] = novas
    if rec.get('nome'):
        d['acervo']['nome'] = rec['nome']
    open(p, 'w', encoding='utf-8').write('FF_ACERVO_DEF(%s,' % json.dumps(sid) + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ');\n')
    fonte = sid.split('_')[0]
    fp = 'data/acervo/fontes/%s.json' % fonte
    fichas.setdefault(fp, json.load(open(fp, encoding='utf-8')))
    s = fichas[fp]['sprites'][sid]
    s['anims'] = {n: len(v['frames']) for n, v in novas.items()}
    if rec.get('nome'): s['nome'] = rec['nome']
    print('%-50s %d animações (%d quadros fora: Outros)' % (sid, len(novas), len(sobra)))
for fp, f in fichas.items():
    json.dump(f, open(fp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
AC.recompor('.')
