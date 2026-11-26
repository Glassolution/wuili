import { describe, expect, it } from "vitest";

import { acoesDosCursores, estadoDoAgente, VIAGEM } from "@/lib/cursoresDaMontagem";
import { montarMontagem } from "@/lib/montagemDaVitrine";
import type { DadosDoPalco } from "@/lib/palcoDoSite";

const dados = (moda: boolean): DadosDoPalco => ({
  nome: "Oki",
  logo: null,
  capa: "https://exemplo/capa.png",
  destaque: "#2563EB",
  fundo: null,
  fonte: "Inter",
  etiqueta: "Roupas",
  subtitulo: "Roupas para o dia a dia",
  menu: ["Início", "Produtos", "Sobre", "Contato"],
  botao: "Ver produtos",
  tituloDaSecao: "Produtos",
  itens: [{ titulo: "Camiseta", imagem: "https://exemplo/c.png", preco: 59.9, categoria: "Camisetas" }],
  moda,
});

describe("cursores da montagem", () => {
  it("moda usa a Vitrine moda: troca as cores (de leve), não a fonte", () => {
    const m = montarMontagem(dados(true));
    expect(m.trocas.fonte).toBeUndefined();
    expect(m.trocas.cores).toBeDefined();
    expect(m.duracao).toBeLessThan(50000);
    expect(montarMontagem(dados(false)).trocas.fonte).toBeDefined();
  });

  it("cada troca vira ação de um agente, e o Atlas desenha cada seção do modelo", () => {
    expect(acoesDosCursores(montarMontagem(dados(false)), dados(false)).filter((a) => a.agente === "atlas")).toHaveLength(4);
    const d = dados(true);
    const m = montarMontagem(d);
    expect(m.modelo).toBe("vitrine-moda");
    const acoes = acoesDosCursores(m, d);
    expect(acoes.filter((a) => a.agente === "atlas")).toHaveLength(11);
    expect(acoes.find((a) => a.alvo === "chamada-titulo")).toMatchObject({ agente: "texto", tipo: "digitar" });
    expect(acoes.find((a) => a.alvo === "categoria-0")).toMatchObject({ agente: "imagens", tipo: "imagem" });
    expect(acoes.find((a) => a.alvo === "capa-foto")).toMatchObject({ agente: "imagens", tipo: "imagem", imagem: d.capa });
    expect(acoes.find((a) => a.alvo === "marca")).toMatchObject({ agente: "texto", tipo: "digitar" });
  });

  it("o cursor chega ao alvo antes da troca e some no fim", () => {
    const d = dados(true);
    const m = montarMontagem(d);
    const texto = acoesDosCursores(m, d).filter((a) => a.agente === "texto");
    const primeira = texto[0];
    expect(estadoDoAgente(texto, primeira.t0 - VIAGEM - 10)?.visivel).toBe(0);
    expect(estadoDoAgente(texto, primeira.t0)?.viagem).toBe(1);
    expect(estadoDoAgente(texto, m.duracao + 2000)?.visivel).toBe(0);
  });
});
