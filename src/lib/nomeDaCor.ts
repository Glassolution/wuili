/*
  Nome em português da cor mais parecida com um código (#RRGGBB).
  Usado quando a pessoa escolhe a própria cor no chat do Atlas: a mensagem sai
  legível ("azul-marinho (#1E3A8A)") e o resumo da loja também.
*/

export const CORES_COM_NOME: { nome: string; hex: string }[] = [
  { nome: "preto", hex: "#111111" },
  { nome: "grafite", hex: "#3A3A3A" },
  { nome: "cinza", hex: "#8A8A8A" },
  { nome: "branco", hex: "#FFFFFF" },
  { nome: "creme", hex: "#F5F0E6" },
  { nome: "bege", hex: "#D9C6A5" },
  { nome: "marrom", hex: "#7A4E2D" },
  { nome: "terracota", hex: "#C0643C" },
  { nome: "vinho", hex: "#7F1D1D" },
  { nome: "vermelho", hex: "#DC2626" },
  { nome: "laranja", hex: "#EA580C" },
  { nome: "dourado", hex: "#B08D57" },
  { nome: "amarelo", hex: "#EAB308" },
  { nome: "verde-oliva", hex: "#6B7A3A" },
  { nome: "verde", hex: "#2F7D46" },
  { nome: "verde-escuro", hex: "#1F4D2B" },
  { nome: "verde-claro", hex: "#86C27A" },
  { nome: "turquesa", hex: "#14B8A6" },
  { nome: "azul-claro", hex: "#7DB3F0" },
  { nome: "azul", hex: "#2563EB" },
  { nome: "azul-marinho", hex: "#1E3A8A" },
  { nome: "lilás", hex: "#B79CEB" },
  { nome: "roxo", hex: "#7C3AED" },
  { nome: "rosa-claro", hex: "#F5B5CF" },
  { nome: "rosa", hex: "#DB2777" },
];

const rgb = (hex: string): [number, number, number] | null => {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const hexValido = (hex: string) => rgb(hex) !== null;

export const normalizarHex = (hex: string) => {
  const limpo = hex.trim().replace(/^#?/, "#").toUpperCase();
  return hexValido(limpo) ? limpo : null;
};

/** Distância "à moda do olho" (pesos do redmean), boa o bastante para dar nome. */
export function nomeDaCor(hex: string): string {
  const alvo = rgb(hex);
  if (!alvo) return "cor personalizada";
  let melhor = { nome: "cor personalizada", d: Infinity };
  for (const c of CORES_COM_NOME) {
    const [r, g, b] = rgb(c.hex)!;
    const rm = (alvo[0] + r) / 2;
    const d =
      (2 + rm / 256) * (alvo[0] - r) ** 2 + 4 * (alvo[1] - g) ** 2 + (2 + (255 - rm) / 256) * (alvo[2] - b) ** 2;
    if (d < melhor.d) melhor = { nome: c.nome, d };
  }
  return melhor.nome;
}
