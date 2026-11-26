import { describe, expect, it } from "vitest";

import { faixasParaCortar, medidaDaCapaLeve, type LinhaDaImagem } from "@/lib/imagemDaCapa";

const liso = (cor: [number, number, number], desvio = 3): LinhaDaImagem => ({ media: cor, desvio });
const foto = (i: number): LinhaDaImagem => ({ media: [170 - (i % 7), 150, 134 + (i % 5)], desvio: 40 + (i % 9) });

describe("limpeza da capa", () => {
  it("corta a tarja de cima e de baixo (foto 16:9 dentro de um quadrado)", () => {
    const linhas = [
      ...Array.from({ length: 220 }, () => liso([209, 200, 187])),
      ...Array.from({ length: 560 }, (_, i) => foto(i)),
      ...Array.from({ length: 220 }, () => liso([205, 198, 185])),
    ];
    expect(faixasParaCortar(linhas)).toEqual({ topo: 220, base: 220 });
  });

  it("corta uma faixa só quando ela é praticamente de uma cor", () => {
    const linhas = [...Array.from({ length: 200 }, () => liso([209, 200, 187], 2)), ...Array.from({ length: 800 }, (_, i) => foto(i))];
    expect(faixasParaCortar(linhas)).toEqual({ topo: 200, base: 0 });
  });

  it("não corta céu que vai mudando aos poucos", () => {
    const ceu = Array.from({ length: 400 }, (_, i) => liso([120 + i * 0.2, 160 + i * 0.1, 220], 5));
    const linhas = [...ceu, ...Array.from({ length: 600 }, (_, i) => foto(i))];
    expect(faixasParaCortar(linhas)).toEqual({ topo: 0, base: 0 });
  });

  it("não corta foto sem faixa", () => {
    expect(faixasParaCortar(Array.from({ length: 900 }, (_, i) => foto(i)))).toEqual({ topo: 0, base: 0 });
  });
});

describe("capa leve", () => {
  it("reduz a capa em 4K para 2560px mantendo a proporção", () => {
    expect(medidaDaCapaLeve(5504, 3072)).toEqual({ largura: 2560, altura: 1429 });
  });

  it("não amplia capa menor que o máximo", () => {
    expect(medidaDaCapaLeve(1344, 768)).toEqual({ largura: 1344, altura: 768 });
  });
});
