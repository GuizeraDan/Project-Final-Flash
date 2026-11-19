#!/usr/bin/env python3
"""Lê um arquivo .air do M.U.G.E.N e devolve as animações.

Saída: {acao: {"nome": str|None, "loop": idx|None, "quadros": [[grupo,item,dx,dy,tempo,flip], ...]}}
"""
import re, json, sys

NOMES = {
    0: 'Parado', 5: 'Virar', 6: 'Virar_Agachado', 10: 'Agachar', 11: 'Agachado', 12: 'Levantar',
    20: 'Andar_Frente', 21: 'Andar_Tras', 40: 'Pulo_Preparo', 41: 'Pulo_Parado', 42: 'Pulo_Frente',
    43: 'Pulo_Tras', 44: 'Pulo_Subida', 45: 'Pulo_Descida', 47: 'Pouso',
    100: 'Dash_Frente', 105: 'Dash_Tras', 120: 'Guarda_Inicio', 130: 'Guarda', 131: 'Guarda_Agachado',
    132: 'Guarda_Ar', 140: 'Guarda_Fim', 150: 'Guarda_Impacto', 152: 'Guarda_Impacto_Agachado',
    154: 'Guarda_Impacto_Ar', 170: 'Derrota_Tempo', 175: 'Empate', 180: 'Vitoria', 181: 'Vitoria_2',
    190: 'Intro', 191: 'Intro_2', 195: 'Provocar',
    5000: 'Dano_Leve', 5001: 'Dano_Medio', 5002: 'Dano_Forte', 5005: 'Dano_Leve_Volta',
    5010: 'Dano_Baixo_Leve', 5011: 'Dano_Baixo_Medio', 5012: 'Dano_Baixo_Forte',
    5020: 'Dano_Agachado', 5030: 'Lancado', 5035: 'Lancado_Transicao', 5040: 'Lancado_Recuperar',
    5050: 'Lancado_Queda', 5060: 'Lancado_Queda_2', 5070: 'Tropeco', 5080: 'Rasteira',
    5100: 'Caido_Impacto', 5101: 'Caido_Quique', 5110: 'Caido', 5120: 'Levantar_do_Chao',
    5150: 'Caido_Derrotado', 5160: 'Quique_Alto', 5170: 'Caido_Quique_2',
    5200: 'Recuperar_Ar', 5210: 'Recuperar_Ar_2', 5300: 'Tontura',
}

HDR = re.compile(r'^\s*\[\s*begin\s+action\s+(-?\d+)\s*\]', re.I)


def parse(text):
    anims = {}; cur = None
    for raw in text.splitlines():
        line = raw.split(';', 1)[0].strip()
        if not line: continue
        m = HDR.match(line)
        if m:
            cur = int(m.group(1))
            anims[cur] = {'nome': NOMES.get(cur), 'loop': None, 'quadros': []}
            continue
        if line.startswith('['):
            cur = None; continue
        if cur is None: continue
        low = line.lower()
        if low.startswith('loopstart'):
            anims[cur]['loop'] = len(anims[cur]['quadros']); continue
        if low.startswith(('clsn', 'interpolate')):
            continue
        parts = [p.strip() for p in line.split(',')]
        if len(parts) < 5: continue
        try:
            g, i, x, y, t = (int(float(p)) for p in parts[:5])
        except ValueError:
            continue
        flip = parts[5].upper() if len(parts) > 5 and parts[5] else ''
        anims[cur]['quadros'].append([g, i, x, y, t, flip])
    return {k: v for k, v in anims.items() if v['quadros']}


if __name__ == '__main__':
    txt = open(sys.argv[1], 'rb').read().decode('latin-1')
    a = parse(txt)
    json.dump(a, open(sys.argv[2], 'w'), ensure_ascii=False)
    print(len(a), 'animações')
