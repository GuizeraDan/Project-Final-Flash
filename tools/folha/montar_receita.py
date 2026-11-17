# Recorta os quadros achados (anims.json), tira o fundo e escreve a receita do importar_sprites.py.
# Uso: python3 -I tools/folha/montar_receita.py folha.png pasta_saida tools/receitas/<id>.json
#      python3 -I tools/importar_sprites.py tools/receitas/<id>.json --origem pasta_saida/q  (depois: atlas em paleta de 256 cores)
import sys, json, os, numpy as np
from PIL import Image
F, D, REC = sys.argv[1], sys.argv[2], sys.argv[3]
A = json.load(open(D + '/anims.json'))
img = np.array(Image.open(F).convert('RGB'))
bg = np.array([226, 100, 200])
fundo = (np.abs(img.astype(int) - bg) <= 14).all(-1)
rgba = np.dstack([img, np.where(fundo, 0, 255).astype(np.uint8)])
os.makedirs(D + '/q', exist_ok=True)
nomes = {0: 'Base_Parado', 1: 'Transformacao_1', 2: 'Transformacao_2', 3: 'Transformacao_3', 4: 'Parado',
 5: 'Linha3_A', 6: 'Linha3_B', 7: 'Linha3_C', 8: 'Linha3_D', 9: 'Linha3_E', 10: 'Linha3_F',
 11: 'Caido_Levantar', 12: 'Socos', 13: 'Combo_Chutes', 14: 'Combo_Longo', 15: 'Lancado', 16: 'CarregarKi',
 17: 'CarregarKi_Loop', 18: 'Esfera_Energia', 19: 'Esfera_Raios', 20: 'Investida_Inicio', 21: 'Investida',
 22: 'Rajada_Dourada', 23: 'Transformacao_SSJ_Inicio', 24: 'Transformacao_SSJ', 25: 'Aura_Parado',
 26: 'Aura_Combo_1', 27: 'Aura_Combo_2', 28: 'Aura_Combo_3', 29: 'Aura_Combo_4', 30: 'Aura_Combo_5', 31: 'Aura_Combo_6',
 32: 'Especial', 33: 'Aura_Rajada_1', 34: 'Aura_Rajada_2', 35: 'Golpe_Final', 36: 'Aneis_1', 37: 'Aneis_2', 38: 'Aneis_3',
 39: 'Vitoria', 40: 'Esfera_Pequena', 41: 'Cores'}
centro = {18, 19, 36, 37, 38, 40}
loops = {0, 4, 16, 17, 25, 39}
anims, n = {}, 0
for i, a in enumerate(A):
    qs = a['q']
    hm = sorted(b[3] - b[1] for b in qs)[len(qs) // 2]
    qs = sorted(qs, key=lambda b: (round(b[1] / (hm * 0.8)), b[0]))
    ids = []
    for b in qs:
        x0, y0, x1, y1 = b
        im_ = Image.fromarray(rgba[y0:y1, x0:x1]); im_ = im_.resize((max(1, round(im_.width * 0.7)), max(1, round(im_.height * 0.7))), Image.LANCZOS); im_.save('%s/q/q%03d.png' % (D, n)); ids.append(n); n += 1
    nome = nomes.get(i, 'Linha%d_%d' % (a['linha'], i))
    if i == 0:
        anims['Retrato'] = {'quadros': ids[:1], 'fps': 1, 'origem': 'centro'}; ids = ids[1:]
    an = {'quadros': ids, 'fps': 10 if i not in (41,) else 1, 'loop': i in loops}
    if i in centro: an['origem'] = 'centro'
    anims[nome] = an
rc = {'id': 'sheet1_goku_ssj', 'arquivo': 'q{n:03d}.png', 'fundo': 'nenhum', 'escala': 0.63, 'larguraAtlas': 3072, 'anims': anims}
json.dump(rc, open(REC, 'w'), ensure_ascii=False, indent=1)
print(n, 'quadros', len(anims), 'animações')
