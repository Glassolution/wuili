import { describe, expect, it } from "vitest";

import { etapaAtual, montarMontagem, progressoDaTroca, textoDaTroca } from "@/lib/montagemDaVitrine";
import type { DadosDoPalco } from "@/lib/palcoDoSite";

const dados: DadosDoPalco = {
  nome: "Unson",
  logo: "data:image/png;base64,xx",
  capa: "https://exemplo.test/capa.png",
  destaque: "#2563EB",
  fundo: null,
  fonte: "Georgia",
  etiqueta: "Roupas",
  subtitulo: "Tudo de roupas em um só lugar.",
  menu: ["Início", "Produtos", "Sobre", "Contato"],
  botao: "Ver produtos",
  tituloDaSecao: "Produtos",
  itens: Array.from({ length: 8 }, (_, i) => ({ titulo: `Peça ${i}`, imagem: null, preco: 50 + i, categoria: i % 2 ? "Camisetas" : "Calças" })),
};

describe("montagem da vitrine", () => {
  it("primeiro o modelo, depois a personalização", () => {
    const m = montarMontagem(dados);
    expect(m.etapas[0].fase).toBe("modelo");
    const primeiraTroca = Math.min(...Object.values(m.trocas).map((x) => x.t0));
    expect(primeiraTroca).toBeGreaterThanOrEqual(m.fimDoModelo);
    expect(m.duracao).toBeLessThan(40000);
  });

  it("no começo mostra o texto do modelo e no fim o da pessoa", () => {
    const m = montarMontagem(dados);
    expect(textoDaTroca(m, "marca.nome", 0, "Sua marca", "Unson").texto).toBe("Sua marca");
    expect(textoDaTroca(m, "marca.nome", m.duracao, "Sua marca", "Unson").texto).toBe("Unson");
    for (let i = 0; i < 8; i += 1) expect(progressoDaTroca(m, `produto.${i}`, m.duracao)).toBe(1);
    expect(etapaAtual(m, m.duracao)).toBeNull();
  });

  it("sem logo, sem produtos e sem preço também fecha", () => {
    const m = montarMontagem({ ...dados, logo: null, capa: null, itens: [] });
    expect(m.trocas["marca.logo"]).toBeUndefined();
    expect(m.trocas["produto.0"]).toBeUndefined();
    expect(m.trocas["preco.0"]).toBeUndefined();
    expect(m.trocas["destaque.3"]).toBeDefined();
  });
});
