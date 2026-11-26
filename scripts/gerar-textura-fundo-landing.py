"""
Uso (na raiz do repo): python3 scripts/gerar-textura-fundo-landing.py

Gera public/landing/textura-fundo.webp: trama de tecido no padrão da base44.com.
Pontinhos escuros (~2px na tela) num fundo claro, com período de ~3,3px, fileiras
levemente onduladas (deformação suave) e intensidade aleatória por ponto.
Sem faixas por fio. O arquivo é 2x (476px) e aparece a 238px no CSS.
Tudo periódico no tamanho do bloco, para repetir sem emenda.
Também gera public/landing/textura-trama.png: a mesma trama em fundo transparente,
para pôr por cima de cores (card azul do Atlas).
"""
import math, random, sys, statistics as st
from PIL import Image

random.seed(4)
T = 476            # px do arquivo (2x)
N = 72             # pontos por lado -> período 6,61px no arquivo, 3,3px na tela
P = T / N
BASE = (242.4, 240.7, 239.6)
ESCURO = 11.0      # quanto o centro de um ponto médio escurece

# intensidade de cada ponto (periódica: índice módulo N)
forca = [[max(0.15, random.gauss(1.0, 0.22)) for _ in range(N)] for _ in range(N)]

# deformação suave e periódica: soma de senos com nº inteiro de ciclos no bloco
ondas = []
for _ in range(7):
    kx, ky = random.randint(-9, 9), random.randint(-9, 9)
    if kx == 0 and ky == 0:
        ky = 1
    ondas.append((kx, ky, random.uniform(0, 2 * math.pi), random.uniform(0.6, 1.4)))

def desloc(x, y, eixo):
    t = 0.0
    for kx, ky, fase, amp in ondas:
        f = fase + (1.3 if eixo else 0.0)
        t += amp * math.sin(2 * math.pi * (kx * x + ky * y) / T + f)
    return t * 0.18   # ~ até 2-3px no arquivo

def suave(a, b, x):
    t = min(1, max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

im = Image.new("RGB", (T, T))
px = im.load()
# Versão transparente (só a trama) para pôr por cima de fundos coloridos, como o card azul:
# pontos pretos com alfa + brilho branco fraco entre eles, mais forte que no fundo claro.
trama = Image.new("RGBA", (T, T))
tp = trama.load()
for y in range(T):
    for x in range(T):
        # grade inclinada ~8° (10 pontos de desvio por bloco: continua periódico)
        u = (x + desloc(x, y, 0)) / P + y * 10 / T
        v = (y + desloc(x, y, 1)) / P - x * 10 / T
        iu, iv = round(u), round(v)
        du, dv = abs(u - iu), abs(v - iv)
        d = (du ** 3 + dv ** 3) ** (1 / 3)          # ponto meio quadrado, meio redondo
        k = forca[iv % N][iu % N] * (1 - suave(0.20, 0.36, d))
        ruido = random.gauss(0, 0.8)
        val = -k * ESCURO + ruido
        px[x, y] = tuple(max(0, min(255, round(c + val))) for c in BASE)
        # entre os pontos, um brilho branco leve; nos pontos, preto (sem ruído: arquivo leve)
        if k > 0.02:
            tp[x, y] = (0, 0, 0, min(255, round(k * 0.16 * 255)))
        else:
            tp[x, y] = (255, 255, 255, 26)

im.save("public/landing/textura-fundo.webp", "WEBP", quality=90, method=6)
# PNG com paleta: índice 0 = brilho branco; 1..15 = preto com alfa crescente (passo de 6).
# Fica ~20-30 KB; em WebP o alfa sem perda passava de 200 KB.
NIVEIS = 15
paleta = [255, 255, 255] + [0, 0, 0] * NIVEIS
alfas = bytes([26] + [6 * (i + 1) for i in range(NIVEIS)])
ind = Image.new("P", (T, T))
ip = ind.load()
for y in range(T):
    for x in range(T):
        r, g, b, a = tp[x, y]
        ip[x, y] = 0 if r == 255 else max(1, min(NIVEIS, round(a / 6)))
ind.putpalette(paleta)
ind.save("public/landing/textura-trama.png", optimize=True, transparency=alfas)
tela = Image.open("public/landing/textura-fundo.webp").convert("L").resize((238, 238), Image.LANCZOS)
vals = list(tela.getdata())
print("tela: média", round(st.mean(vals), 1), "desvio", round(st.pstdev(vals), 2))
