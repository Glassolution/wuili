#!/usr/bin/env bash
#
# Gera as versões WebP responsivas das imagens da landing.
#
# Por que existe: os PNGs originais somam ~9,5 MB. No 4G de um celular simples
# isso é a diferença entre a página aparecer e a pessoa desistir. Os originais
# ficam onde estão (são a fonte); as versões servidas vão para public/landing/.
#
# Requer cwebp (brew install webp). Rode de novo sempre que trocar um original.
#
set -euo pipefail

cd "$(dirname "$0")/.."
ORIG="public"
SAIDA="public/landing"
mkdir -p "$SAIDA"

# Fotos: perda maior é imperceptível e economiza muito.
QUALIDADE_FOTO=68
# Prints de tela têm texto fino — perda alta borra número e letra.
QUALIDADE_PRINT=82

gerar() {
  local arquivo="$1" nome="$2" qualidade="$3"; shift 3
  for largura in "$@"; do
    local destino="$SAIDA/$nome-$largura.webp"
    cwebp -quiet -q "$qualidade" -sharp_yuv -resize "$largura" 0 "$ORIG/$arquivo" -o "$destino"
    printf '%-40s %6s KB\n' "$(basename "$destino")" "$(( $(stat -f%z "$destino") / 1024 ))"
  done
}

echo "→ fotos do topo"
gerar "pessoa 01.png" pessoa-01 "$QUALIDADE_FOTO" 640 960 1280 1672
gerar "pessoa 02.png" pessoa-02 "$QUALIDADE_FOTO" 640 960 1280 1672
gerar "pessoa 03.png" pessoa-03 "$QUALIDADE_FOTO" 640 960 1280 1672

echo "→ prints do produto"
gerar "prova-catalogo.png" prova-catalogo "$QUALIDADE_PRINT" 640 960 1440
gerar "prova-atlas.png" prova-atlas "$QUALIDADE_PRINT" 640 960 1360

# As duas barras da seção "Do produto ao anúncio pronto". São prints de tela
# (texto fino), por isso a qualidade alta. No desktop cada uma ocupa metade de
# 1200px; no celular, a largura toda. 1280 cobre os dois casos com folga.
echo "→ barras da prova visual"
gerar "barra 01.png" barra-01 "$QUALIDADE_PRINT" 640 960 1280
gerar "barra 02.png" barra-02 "$QUALIDADE_PRINT" 640 960 1280

# O logo aparece a 36x36 no cabeçalho e no rodapé. O PNG original tem 146 KB
# para ser desenhado num quadrado de 36px — 96 é o dobro do necessário e cobre
# tela retina.
echo "→ logo"
gerar "logo.png" logo "$QUALIDADE_PRINT" 96

echo
echo "total: $(du -sh "$SAIDA" | cut -f1)"
