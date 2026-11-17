# Acha os quadros de uma folha de sprites com fundo de cor única (usado na Sheet 1).
# Uso: python3 -I tools/folha/achar_quadros.py folha.png pasta_saida  -> pasta_saida/anims.json + anims.png (caixas numeradas)
import sys, json, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
F, OUT = sys.argv[1], sys.argv[2]
img = Image.open(F).convert('RGB'); a = np.array(img).astype(np.float32)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
bg = np.array([226, 100, 200.])
t = np.clip((G - bg[1]) / (255 - bg[1]), 0, 1)
dist = np.sqrt((R - (bg[0] + t * 29)) ** 2 + (B - (bg[2] + t * 55)) ** 2)
cont = ~((dist < 30) & (t < 0.93))
cont[:4] = False; cont[-4:] = False      # cabeçalho e rodapé (créditos)
cont[:, :14] = False; cont[:, -14:] = False  # moldura laranja
cont = nd.binary_opening(cont, iterations=1)
lab, n = nd.label(nd.binary_dilation(cont, iterations=3))
cx = []
for s in nd.find_objects(lab):
    y0, y1, x0, x1 = s[0].start, s[0].stop, s[1].start, s[1].stop
    w, h = x1 - x0, y1 - y0
    if h > 900 or w > 1600 or w * h < 120: continue
    sub = a[y0:y1, x0:x1].reshape(-1, 3); m = cont[y0:y1, x0:x1].reshape(-1)
    px = sub[m] if m.any() else sub
    lar = ((px[:, 0] > 180) & (px[:, 1] > 80) & (px[:, 1] < 150) & (px[:, 2] < 90)).mean()  # laranja da moldura/ícones
    tipo = 'barra' if (w < 22 and h > 40) else ('icone' if lar > 0.2 and w * h < 9000 and h < 90 else 'q')
    cx.append(dict(b=[int(x0), int(y0), int(x1), int(y1)], tipo=tipo, area=w * h))
# junta pedaços pequenos (faíscas, raios soltos) ao quadro grande mais perto
grandes = [c for c in cx if c['tipo'] == 'q' and c['area'] >= 3500]
for c in cx:
    if c['tipo'] != 'q' or c['area'] >= 3500: continue
    x0, y0, x1, y1 = c['b']; best, bd = None, 1e9
    for g in grandes:
        X0, Y0, X1, Y1 = g['b']
        dx = max(X0 - x1, x0 - X1, 0); dy = max(Y0 - y1, y0 - Y1, 0); d = max(dx, dy)
        if d < bd: best, bd = g, d
    if best and bd < 40:
        b = best['b']; best['b'] = [min(b[0], x0), min(b[1], y0), max(b[2], x1), max(b[3], y1)]
    c['tipo'] = 'junto' if best and bd < 40 else 'solto'
# quadros cujas caixas se sobrepõem bastante (um dentro do outro, aura em pedaços) viram um só
def sobre(p, q):
    x0, y0 = max(p[0], q[0]), max(p[1], q[1]); x1, y1 = min(p[2], q[2]), min(p[3], q[3])
    if x1 <= x0 or y1 <= y0: return 0
    return (x1 - x0) * (y1 - y0) / min((p[2] - p[0]) * (p[3] - p[1]), (q[2] - q[0]) * (q[3] - q[1]))
mud = True
while mud:
    mud = False
    gs = [c for c in cx if c['tipo'] == 'q' and c['area'] >= 3500]
    for i in range(len(gs)):
        for j in range(i + 1, len(gs)):
            p, q = gs[i]['b'], gs[j]['b']
            if sobre(p, q) > 0.3:
                gs[i]['b'] = [min(p[0], q[0]), min(p[1], q[1]), max(p[2], q[2]), max(p[3], q[3])]
                gs[i]['area'] = (gs[i]['b'][2] - gs[i]['b'][0]) * (gs[i]['b'][3] - gs[i]['b'][1]); gs[j]['tipo'] = 'fundido'; mud = True; break
        if mud: break
qs = [c for c in cx if c['tipo'] in ('q', 'barra') and (c['tipo'] == 'barra' or c['area'] >= 3500)]
# linhas: agrupa por sobreposição vertical
qs.sort(key=lambda c: (c['b'][1] + c['b'][3]) / 2)
linhas = []
for c in qs:
    cy0, cy1 = c['b'][1], c['b'][3]
    for L in linhas:
        if min(cy1, L['y1']) - max(cy0, L['y0']) > 0.35 * min(cy1 - cy0, L['y1'] - L['y0']):
            L['it'].append(c); L['y0'] = min(L['y0'], cy0); L['y1'] = max(L['y1'], cy1); break
    else: linhas.append(dict(y0=cy0, y1=cy1, it=[c]))
linhas.sort(key=lambda L: L['y0'])
anims = []
for r, L in enumerate(linhas):
    it = sorted(L['it'], key=lambda c: c['b'][0]); cur = []
    for c in it:
        if c['tipo'] == 'barra':
            if cur: anims.append(dict(linha=r, q=cur)); cur = []
        else: cur.append(c['b'])
    if cur: anims.append(dict(linha=r, q=cur))
json.dump(anims, open(OUT + '/anims.json', 'w'))
d = ImageDraw.Draw(img)
cores = [(0, 255, 0), (0, 160, 255), (255, 255, 0), (255, 0, 0), (0, 0, 0), (255, 255, 255)]
for k, an in enumerate(anims):
    for j, b in enumerate(an['q']):
        d.rectangle(b, outline=cores[k % 6], width=3)
        d.text((b[0] + 3, b[1] + 2), '%d.%d' % (k, j), fill=(0, 0, 0))
img.save(OUT + '/anims.png')
print(len(linhas), 'linhas', len(anims), 'anims', sum(len(x['q']) for x in anims), 'quadros')
