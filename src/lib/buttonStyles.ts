// Estilo do botão primário escuro da Velo (fonte única).
//
// Vem do spec de design: base #1D1F23 com gradiente branco 15%→0% de cima pra
// baixo, stroke branco 15% só no topo, sombra externa preta 20% e um anel preto
// de 1.5px contornando tudo.
//
// O raio NÃO fica aqui de propósito — cada uso define o seu pela className
// (pílula no onboarding, retângulo arredondado nos cards de plano).

import type { CSSProperties } from "react";

export const PRIMARY_BUTTON_STYLE: CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%), #1D1F23",
  boxShadow: [
    // Borda de topo feita com inset: uma `border-top` de verdade cortaria feio
    // nas quinas arredondadas.
    "inset 0 1.5px 0 rgba(255,255,255,0.15)",
    "0 4px 7px rgba(0,0,0,0.20)",
    "0 0 0 1.5px #000000",
  ].join(", "),
  textShadow: "0 4px 4px rgba(0,0,0,0.40)",
};
