import { describe, expect, it } from "vitest";

import { montarRoteiro, textoNoTempo, type DadosDoPalco } from "@/lib/palcoDoSite";

const base: DadosDoPalco = {
  nome: "Raiz do Campo",
  logo: null,
  capa: null,
  destaque: "#2F7D46",
  fundo: "#F5F0E6",
  fonte: "Helvetica Neue",
  etiqueta: "Agro",
  subtitulo: "Tudo de agro em um só lugar.",
  menu: ["Início", "Produtos", "Sobre", "Contato"],
  botao: "Ver produtos",
  tituloDaSecao: "Produtos",
  itens: [
    { titulo: "Chapéu de palha", imagem: null, preco: 59.9 },
    { titulo: "Bota de couro", imagem: null, preco: 189 },
  ],
};

describe("roteiro do palco", () => {
  it("dura o bastante para ver e pouco para cansar", () => {
    const r = montarRoteiro(base);
    expect(r.duracao).toBeGreaterThan(9000);
    expect(r.duracao).toBeLessThan(20000);
  });

  it("no fim, todo texto está escrito por inteiro", () => {
    const r = montarRoteiro({ ...base, subtitulo: "x".repeat(160), itens: [...base.itens, ...base.itens] });
    const fim = r.duracao;
    for (const d of r.digitacoes) expect(textoNoTempo(r, d.campo, fim).texto).toBe(d.texto);
    expect(textoNoTempo(r, "titulo", fim).digitando).toBe(false);
    for (const marco of ["esqueleto.topo", "esqueleto.hero", "esqueleto.secao", "img.capa", "cor.fundo", "cor.botao", "cor.preco", "img.item.3"])
      expect(r.marcos[marco]).toBeLessThan(r.marcos.pronto);
  });

  it("sem itens e sem logo continua de pé", () => {
    const r = montarRoteiro({ ...base, itens: [] });
    expect(r.marcos["cor.logo"]).toBeDefined();
    expect(r.marcos["cor.preco"]).toBeUndefined();
    expect(Number.isFinite(r.duracao)).toBe(true);
  });
});
