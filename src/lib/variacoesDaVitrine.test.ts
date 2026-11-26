import { describe, expect, it } from "vitest";

import { montarMontagem, textosDaVitrineModa } from "@/lib/montagemDaVitrine";
import type { DadosDoPalco } from "@/lib/palcoDoSite";
import {
  categoriaDoProduto,
  categoriasDosItens,
  dadosDaCapa,
  menuDaLojaDeModa,
  modelosDaFoto,
  VARIACOES_DA_CAPA,
  VARIACOES_DO_TOPO,
  variacoesDaVitrine,
} from "@/lib/variacoesDaVitrine";

describe("variações da Vitrine moda", () => {
  it("a mesma loja sempre sai igual", () => {
    const a = variacoesDaVitrine({ nome: "Colt", etiqueta: "Roupas masculinas" });
    expect(variacoesDaVitrine({ nome: "Colt", etiqueta: "Roupas masculinas" })).toEqual(a);
  });

  it("lojas diferentes passam por todos os topos", () => {
    const nomes = ["Colt", "Oki", "Unson", "Maré", "Atelier Sol", "Brisa", "Nara", "Lumi", "Vento", "Kora", "Tiê", "Aurora"];
    const vistos = new Set(nomes.map((nome) => variacoesDaVitrine({ nome, etiqueta: "Roupas" }).topo));
    expect(vistos.size).toBe(VARIACOES_DO_TOPO.length);
  });
});

describe("categorias e menu da loja de moda", () => {
  it("tira a categoria do produto da pessoa, no plural", () => {
    expect(categoriaDoProduto("Camisa de linho")).toBe("Camisas");
    expect(categoriaDoProduto("Blazer azul")).toBe("Blazers");
    expect(categoriaDoProduto("Calça chino")).toBe("Calças");
    expect(categoriaDoProduto("Calção de banho")).toBe("Calções");
    expect(categoriaDoProduto("Tênis branco")).toBe("Tênis");
    expect(categoriaDoProduto("Moletom")).toBe("Moletons");
    expect(categoriaDoProduto("Kit")).toBe("Kits");
  });

  it("usa a categoria do catálogo quando existe e não repete", () => {
    const itens = [
      { titulo: "Camisa de linho", categoria: null },
      { titulo: "Camisa xadrez", categoria: null },
      { titulo: "Fone bluetooth", categoria: "Fones de Ouvido" },
    ];
    expect(categoriasDosItens(itens)).toEqual(["Camisas", "Fones de Ouvido"]);
  });

  it("menu: todos os produtos + categorias, ou o padrão sem categoria", () => {
    expect(menuDaLojaDeModa(["Camisas", "Calças"], ["Início"])).toEqual(["Todos os produtos", "Camisas", "Calças"]);
    expect(menuDaLojaDeModa([], ["Início", "Produtos"])).toEqual(["Início", "Produtos"]);
  });
});

const NOMES = ["Colt", "Oki", "Unson", "Maré", "Atelier Sol", "Brisa", "Nara", "Lumi", "Vento", "Kora", "Tiê", "Aurora", "Sena", "Lis", "Bento"];
const loja = (nome: string): DadosDoPalco => ({
  nome,
  logo: null,
  capa: null,
  destaque: "#2563EB",
  fundo: null,
  fonte: "Inter",
  etiqueta: "Roupas",
  subtitulo: "Tudo de roupas em um só lugar.",
  menu: ["Todos os produtos", "Camisas"],
  botao: "Ver produtos",
  tituloDaSecao: "Produtos",
  itens: [{ titulo: "Camisa de linho", imagem: null, preco: 89.9, categoria: "Camisas" }],
  moda: true,
});

describe("capas e textos variados", () => {
  it("lojas diferentes passam pelas 4 capas", () => {
    expect(new Set(NOMES.map((nome) => variacoesDaVitrine({ nome, etiqueta: "Roupas" }).capa)).size).toBe(VARIACOES_DA_CAPA.length);
  });

  it("os textos mudam de loja para loja, sem prometer frete, desconto ou prazo", () => {
    const titulos = new Set(NOMES.map((nome) => textosDaVitrineModa(loja(nome)).capaTitulo));
    expect(titulos.size).toBeGreaterThan(2);
    for (const nome of NOMES) {
      const tudo = JSON.stringify(textosDaVitrineModa(loja(nome)));
      expect(tudo).not.toMatch(/fr[eê]te|gr[aá]tis|desconto|% ?off|entrega em|\bdias\b/i);
    }
  });

  it("a montagem escreve o texto e o 2º botão só nas capas que têm", () => {
    for (const nome of NOMES) {
      const d = loja(nome);
      const capa = dadosDaCapa(variacoesDaVitrine(d).capa);
      const m = montarMontagem(d);
      expect(!!m.trocas["capa.texto"]).toBe(capa.comTexto);
      expect(!!m.trocas["capa.botao2"]).toBe(capa.doisBotoes);
    }
  });

  it("quem aparece na foto segue o nicho", () => {
    expect(modelosDaFoto("roupas masculinas")).toBe("male models");
    expect(modelosDaFoto("moda feminina")).toBe("female models");
    expect(modelosDaFoto("roupas")).toBe("models (men and women)");
  });
});
