#!/usr/bin/env python3
"""Junta todos os JSON de data/ em data/bundle.js, para o jogo abrir direto do disco (file://).
Rode sempre que editar um JSON:  python3 tools/build_bundle.py"""
import json, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = {}
for d, _, files in os.walk(os.path.join(root, 'data')):
    for f in sorted(files):
        if f.endswith('.json'):
            p = os.path.join(d, f)
            rel = os.path.relpath(p, root).replace(os.sep, '/')
            with open(p, encoding='utf-8') as fh:
                out[rel] = json.load(fh)
with open(os.path.join(root, 'data', 'bundle.js'), 'w', encoding='utf-8') as fh:
    fh.write('// Gerado por tools/build_bundle.py — não edite à mão.\nwindow.FF_BUNDLE = ')
    json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    fh.write(';\n')
print('bundle:', len(out), 'arquivos')
