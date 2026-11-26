import { describe, expect, it } from "vitest";

import { etapaAtual, montarMontagem, progressoDaTroca, textoDaTroca, textosDaVitrineModa } from "@/lib/montagemDaVitrine";
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

describe("faixa da chamada (Vitrine moda)", () => {
  const OFERTA = /desconto|off\b|%|parcel|juros|pix|frete|gr[aá]tis|prazo|entrega/i;
  const lojas = ["Botui", "Nobre", "Unson", "Arco", "Lume", "Vesta", "Oca", "Brisa"];

  it("frase concreta com as categorias reais da loja e botão curto", () => {
    const t = textosDaVitrineModa({ ...dados, moda: true });
    expect(t.chamadaTexto).toMatch(/^(Calças, camisetas|Camisetas, calças|Calças e camisetas|Camisetas e calças)/);
    expect(t.chamadaTexto).toContain("em um só lugar.");
    expect(t.chamadaBotao.length).toBeLessThanOrEqual(10);
    expect(montarMontagem({ ...dados, moda: true }).trocas["chamada.botao"]).toBeDefined();
  });

  it("nunca inventa oferta, em nenhuma loja", () => {
    for (const nome of lojas)
      for (const itens of [dados.itens, []]) {
        const t = textosDaVitrineModa({ ...dados, nome, itens, moda: true });
        for (const texto of [t.chamadaTitulo, t.chamadaTexto, t.chamadaBotao]) expect(texto).not.toMatch(OFERTA);
      }
  });

  it("sem categorias, a frase continua sem lista vazia", () => {
    const t = textosDaVitrineModa({ ...dados, itens: [], moda: true });
    expect(t.chamadaTexto).not.toContain("em um só lugar");
    expect(t.chamadaTexto.length).toBeGreaterThan(10);
  });
});


describe("fonte da marca (Vitrine moda)", () => {
  it("só quem tem marca ganha a etapa da fonte", () => {
    expect(montarMontagem({ ...dados, moda: true }).trocas["fonte"]).toBeUndefined();
    const m = montarMontagem({ ...dados, moda: true, fonteDaMarca: "Montserrat" });
    expect(m.trocas["fonte"]).toBeDefined();
    expect(m.etapas.some((e) => e.rotulo.includes("Montserrat"))).toBe(true);
  });
});

describe("personalidade da marca na vitrine", () => {
  const PERS = ["ousada", "elegante", "acolhedora", "energia", "minimalista"] as const;

  it("lojas do mesmo nicho com personalidades diferentes não saem com os mesmos textos", () => {
    const vozes = PERS.map((personalidade) => {
      const t = textosDaVitrineModa({ ...dados, moda: true, personalidade });
      return [t.capaTitulo, t.botao, t.chamadaTitulo, t.chamadaBotao, t.frase].join(" | ");
    });
    expect(new Set(vozes).size).toBe(PERS.length);
  });

  it("nenhuma voz inventa oferta, e o nome entra no lugar de {nome}", () => {
    const OFERTA = /desconto|off\b|%|parcel|juros|pix|frete|gr[aá]tis|prazo|entrega|\{nome\}/i;
    for (const personalidade of PERS)
      for (const nome of ["Botui", "Nobre", "Arco", "Lume", "Vesta", "Oca"]) {
        const t = textosDaVitrineModa({ ...dados, nome, moda: true, personalidade });
        for (const texto of [t.capaTitulo, t.botao, t.chamadaTitulo, t.chamadaBotao, t.frase]) expect(texto).not.toMatch(OFERTA);
      }
  });

  it("o diferencial da pessoa vira a frase da marca", () => {
    const t = textosDaVitrineModa({ ...dados, moda: true, personalidade: "minimalista", diferencial: "Zero transparência nas leggings." });
    expect(t.frase).toBe("Zero transparência nas leggings.");
  });
});
