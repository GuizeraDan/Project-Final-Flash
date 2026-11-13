#!/usr/bin/env python3
"""Corrige o tipo (personagens/efeitos/cenarios/interface) dos sprites do acervo dos outros jogos pelo nome.
A extração classificava folhas grandes como "cenarios" só pelo tamanho (ex.: pacotes de efeito do Drag Warriors)
e deixava texturas internas da engine (botões do Unity, LDR_*, SearchTex…) como "efeitos".
Uso: python3 -I tools/reclassificar_acervo.py [--ver]   (--ver só mostra o que mudaria)"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import acervo_comum as AC

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R_LIXO = re.compile(r'(toggle|slider|scrollbar|checkmark|uielement|uifoldout|uimask|uisprite|warningsign|white1px|^soft$|^box$|'
                    r'searchtex|areatex|^ldr_|esctoexit|^large\d|^medium\d|control_ui|avatar|npc_pack|stages_img|_ui_|^ui_|^ui$|'
                    r'button|btn|icon|logo|font|joystick|pause)', re.I)
R_CEN = re.compile(r'(stage|planet|sky|arena|background|palace|mountain|island|house|city|forest|desert|_bg_|_bg$|^bg_|^bg$|scenario|cenario)', re.I)
R_EF = re.compile(r'(ki_|_ki_|_ki$|beam|blast|ball|aura|genki|charge|explo|_fx|fx_|^fx|thun|finger|kenzan|destruct|punch|'
                  r'dash|skill|smash|energy|bomb|wave|kame|flash|spark|fire|impact|effect|efeito)', re.I)


def novo_tipo(nome, tipo):
    n = nome.replace('-', '_').replace(' ', '_')
    if tipo == 'personagens':
        return tipo
    if R_LIXO.search(n):
        return 'interface'
    if R_CEN.search(n):
        return 'cenarios'
    if R_EF.search(n):
        return 'efeitos'
    return tipo


def main():
    ver = '--ver' in sys.argv
    pasta = os.path.join(RAIZ, 'data/acervo/fontes')
    total = 0
    for arq in sorted(os.listdir(pasta)):
        if arq == 'zl3.json':
            continue
        p = os.path.join(pasta, arq)
        ficha = json.load(open(p, encoding='utf-8'))
        mud = []
        for sid, s in ficha['sprites'].items():
            t = novo_tipo(s['nome'], s['tipo'])
            if t != s['tipo']:
                mud.append((sid, s['tipo'], t))
        for sid, a, b in mud:
            print('%-60s %-10s -> %s' % (sid, a, b))
            if ver:
                continue
            ficha['sprites'][sid]['tipo'] = b
            js = os.path.join(RAIZ, 'data/acervo', sid + '.js')
            txt = open(js, encoding='utf-8').read()
            ini, fim = txt.index(',') + 1, txt.rindex(');')
            d = json.loads(txt[ini:fim])
            d['acervo']['tipo'] = b
            if b == 'efeitos':
                d['tipo'] = 'efeito'
            else:
                d.pop('tipo', None)
            with open(js, 'w', encoding='utf-8') as fh:
                fh.write(txt[:ini]); json.dump(d, fh, ensure_ascii=False, separators=(',', ':')); fh.write(');\n')
        total += len(mud)
        if mud and not ver:
            with open(p, 'w', encoding='utf-8') as fh:
                json.dump(ficha, fh, ensure_ascii=False, indent=1)
    print('mudanças:', total)
    if total and not ver:
        AC.recompor(RAIZ)


if __name__ == '__main__':
    main()
