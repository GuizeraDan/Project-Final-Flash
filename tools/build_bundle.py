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
# índice para as ferramentas (visualizador/editor de cenas): o navegador não consegue listar pastas
def nomes(pasta, ext):
    d = os.path.join(root, pasta)
    return sorted(f[:-len(ext)] for f in os.listdir(d) if f.endswith(ext)) if os.path.isdir(d) else []
out['_indice'] = {
    'sprites': nomes('data/sprites', '.json'),
    'personagens': nomes('data/characters', '.json'),
    'batalhas': nomes('data/battles', '.json'),
    'audios': nomes('assets/audio', '.ogg'),
}
with open(os.path.join(root, 'data', 'bundle.js'), 'w', encoding='utf-8') as fh:
    fh.write('// Gerado por tools/build_bundle.py — não edite à mão.\nwindow.FF_BUNDLE = ')
    json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    fh.write(';\n')
print('bundle:', len(out), 'arquivos')

# versao.json: impressão digital de todos os arquivos do jogo. O app instalado (PWA) compara
# com a versão que abriu e mostra "Nova versão disponível" quando muda.
import hashlib
h = hashlib.sha1()
for pasta in ['index.html', 'visualizador.html', 'estudio.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'data', 'assets']:
    base = os.path.join(root, pasta)
    arquivos = [base] if os.path.isfile(base) else sorted(os.path.join(d, f) for d, _, fs in os.walk(base) for f in fs)
    for a in arquivos:
        h.update(os.path.relpath(a, root).encode())
        with open(a, 'rb') as fh:
            h.update(fh.read())
with open(os.path.join(root, 'versao.json'), 'w', encoding='utf-8') as fh:
    json.dump({'versao': h.hexdigest()[:12]}, fh)
print('versao:', h.hexdigest()[:12])

