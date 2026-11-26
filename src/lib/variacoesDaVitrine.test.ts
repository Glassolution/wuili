import { describe, expect, it } from "vitest";

import { montarMontagem, textosDaVitrineModa } from "@/lib/montagemDaVitrine";
import type { DadosDoPalco } from "@/lib/palcoDoSite";
import {
  categoriaDoProduto,
  categoriasDosItens,
  cenaDaCapa,
  cenaDaCategoria,
  DIRECAO_DOS_DETALHES,
  cenasDosAtalhos,
  fotoDaCategoria,
  fotoDoAtalho,
  pecaDaCategoria,
  DIRECAO_DE_ARTE,
  dadosDaCapa,
  LIMITE_DA_CENA,
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

describe("cena da capa", () => {
  const nichos = ["roupas masculinas", "moda feminina", "moda infantil", "roupas", "moda fitness feminina", "roupas de academia"];
  const lados = ["direita", "esquerda", "centro"] as const;

  it("sempre cabe no limite da função e leva um look", () => {
    for (const { id } of VARIACOES_DA_CAPA)
      for (const lado of lados)
        for (const nicho of nichos)
          for (let semente = 0; semente < 60; semente++) {
            const { texto } = cenaDaCapa({ capa: id, lado, nicho, semente: semente * 7919 });
            expect(texto.length).toBeLessThanOrEqual(LIMITE_DA_CENA);
            expect(texto).toContain("Styling:");
            // A direção de arte nunca pode ser cortada pelo limite.
            expect(texto.endsWith(DIRECAO_DE_ARTE)).toBe(true);
          }
  });

  it("varia o lado, quantas pessoas e a pose entre lojas (e é igual para a mesma loja)", () => {
    const nomes = Array.from({ length: 80 }, (_, i) => `Loja ${i}`);
    const lados = new Set<string>();
    const pessoas = new Set<number>();
    const poses = new Set<string>();
    for (const nome of nomes) {
      const v = variacoesDaVitrine({ nome, etiqueta: "Roupas masculinas" });
      const cena = cenaDaCapa({ capa: v.capa, lado: v.lado, nicho: "roupas masculinas", semente: v.semente });
      lados.add(v.lado);
      pessoas.add(cena.pessoas);
      poses.add(cena.pose);
      if (v.capa === "marca") expect(v.lado).toBe("centro");
      expect(cenaDaCapa({ capa: v.capa, lado: v.lado, nicho: "roupas masculinas", semente: v.semente })).toEqual(cena);
    }
    expect([...lados].sort()).toEqual(["centro", "direita", "esquerda"]);
    expect([...pessoas].sort()).toEqual([1, 2, 3]);
    expect(poses.size).toBeGreaterThanOrEqual(8);
  });

  it("o lado pedido à IA é o da capa", () => {
    expect(cenaDaCapa({ capa: "cheia", lado: "esquerda", nicho: "roupas", semente: 3 }).texto).toContain("on the left; the same lit background continues unbroken to the right edge");
    expect(cenaDaCapa({ capa: "marca", lado: "centro", nicho: "roupas", semente: 3 }).texto).toContain("centered");
  });

  it("loja fitness ganha pose e roupa de treino; infantil, criança com adulto", () => {
    const fit = Array.from({ length: 30 }, (_, i) => cenaDaCapa({ capa: "cartao", lado: "direita", nicho: "moda fitness feminina", semente: i * 101 }).texto);
    expect(fit.some((t) => /dumbbell|stretch/.test(t))).toBe(true);
    expect(fit.every((t) => /sports bra|leggings|activewear|training|trainers/.test(t))).toBe(true);
    expect(cenaDaCapa({ capa: "estudio", lado: "esquerda", nicho: "moda infantil", semente: 9 }).texto).toMatch(/A child/);
  });

  it("não pede texto nem marca na foto", () => {
    for (const { id } of VARIACOES_DA_CAPA)
      expect(cenaDaCapa({ capa: id, lado: "direita", nicho: "roupas", semente: 1 }).texto).not.toMatch(/\b(logo|text|brand)\b/i);
  });
});

describe("o que não pode sair na capa", () => {
  it("nenhuma pose enfileira o grupo nem afasta a pessoa de corpo inteiro pequeno", () => {
    for (const { id } of VARIACOES_DA_CAPA)
      for (const nicho of ["roupas masculinas", "moda feminina", "roupas", "moda fitness"])
        for (let semente = 0; semente < 80; semente++) {
          const { texto } = cenaDaCapa({ capa: id, lado: "esquerda", nicho, semente: semente * 131 });
          expect(texto).not.toMatch(/formation|in a row|line up|, full body/i);
        }
  });

  it("cenário não traz objeto solto (objeto só quando a pose usa)", () => {
    for (const { cenarios } of VARIACOES_DA_CAPA) for (const c of cenarios) expect(c.cena).not.toMatch(/plinth|chair|props|block|stool/i);
  });
});

describe("estilo criativo e imagens dos cards", () => {
  const cena = cenaDaCapa({ capa: "cheia", lado: "direita", nicho: "roupas masculinas", semente: 42 });

  it("o estilo tem nome em português e os cards repetem o cenário e o look da capa", () => {
    expect(cena.estilo.nome).toMatch(/[a-záéíóúç]/i);
    const [produtos, contato] = cenasDosAtalhos(cena.estilo);
    for (const c of [produtos, contato]) expect(c).toContain(cena.estilo.look);
    // Card de categoria: mesmo cenário, mas a peça manda no styling (o look da capa punha blazer por cima da camisa).
    expect(cenaDaCategoria(cena.estilo, "Camisas")).not.toContain(cena.estilo.look);
    for (const c of [produtos, contato, cenaDaCategoria(cena.estilo, "Camisas")]) expect(c.startsWith(cena.estilo.cenario)).toBe(true);
  });

  it("nenhuma cena de detalhe é cortada no limite (sempre termina na direção dos detalhes)", () => {
    const categorias = ["Camisas", "Calças", "Vestidos", "Tênis", "Bolsas", "Blazers", "Bermudas", "Coisas raras"];
    for (const { id, cenarios } of VARIACOES_DA_CAPA)
      for (const nicho of ["roupas masculinas", "moda feminina", "moda infantil", "moda fitness", "roupas"])
        for (let semente = 0; semente < 40; semente++) {
          const { estilo } = cenaDaCapa({ capa: id, lado: "direita", nicho, semente });
          for (const c of [...cenasDosAtalhos(estilo), ...categorias.map((k) => cenaDaCategoria(estilo, k))]) {
            expect(c.length).toBeLessThanOrEqual(LIMITE_DA_CENA);
            expect(c.endsWith(DIRECAO_DOS_DETALHES)).toBe(true);
          }
          expect(cenarios.length).toBeGreaterThan(0);
        }
  });

  it("a categoria vira peça em inglês, sem o nome em português nem aspas (evita a IA desenhar uma página de loja)", () => {
    for (const categoria of ["Calças", "Camisas", "Camisetas", "Vestidos", "Tênis", "Bolsas", "Bermudas", "Coisas raras"]) {
      const c = cenaDaCategoria(cena.estilo, categoria);
      expect(c).not.toContain('"');
      expect(c.toLowerCase()).not.toContain(categoria.toLowerCase());
      expect(c).toMatch(/never a web page/);
      expect(c.length).toBeLessThanOrEqual(LIMITE_DA_CENA);
    }
    expect(pecaDaCategoria("Calças")).toEqual({ peca: "trousers", parte: "baixo" });
    expect(pecaDaCategoria("Calçados")).toEqual({ peca: "shoes", parte: "pes" });
    expect(pecaDaCategoria("Camisetas").peca).toBe("t-shirt");
    expect(pecaDaCategoria("Camisas").peca).toBe("shirt");
  });

  it("os detalhes mantêm o público da loja", () => {
    expect(cenaDaCategoria(cena.estilo, "Camisas")).toMatch(/one male model/);
    for (const c of cenasDosAtalhos(cena.estilo)) expect(c).toMatch(/male model/);
    const fem = cenaDaCapa({ capa: "estudio", lado: "esquerda", nicho: "moda feminina", semente: 3 });
    expect(cenaDaCategoria(fem.estilo, "Vestidos")).toMatch(/one female model/);
  });

  it("calçado e acessório ganham enquadramento próprio", () => {
    expect(cenaDaCategoria(cena.estilo, "Tênis")).toMatch(/feet/);
    expect(cenaDaCategoria(cena.estilo, "Bolsas")).toMatch(/Close detail/);
    expect(cenaDaCategoria(cena.estilo, "Calças")).toMatch(/hero piece/);
  });

  it("card de categoria: foto do produto real vem antes da gerada", () => {
    const fotos = { categorias: { Camisas: "gerada.webp", Calças: "calca.webp" } };
    const dados = { capa: "capa.webp", itens: [{ titulo: "Camisa de linho", imagem: "real.jpg" }, { titulo: "Calça chino", imagem: null }], fotos };
    expect(fotoDaCategoria(dados, "Camisas")).toEqual({ src: "real.jpg", gerada: false });
    expect(fotoDaCategoria(dados, "Calças")).toEqual({ src: "calca.webp", gerada: true });
    expect(fotoDaCategoria(dados, "Bermudas")).toEqual({ src: null, gerada: false });
  });

  it("atalhos: capa, depois as geradas; sem elas, a foto de um produto", () => {
    const base = { capa: "capa.webp", itens: [{ titulo: "Camisa", imagem: "p1.jpg" }, { titulo: "Calça", imagem: null }] };
    expect(fotoDoAtalho({ ...base, fotos: { atalhos: [null, "a1.webp", "a2.webp"] } }, 1)).toEqual({ src: "a1.webp", produto: false });
    expect(fotoDoAtalho(base, 0)).toEqual({ src: "capa.webp", produto: false });
    expect(fotoDoAtalho(base, 1)).toEqual({ src: "p1.jpg", produto: true });
    expect(fotoDoAtalho(base, 2)).toEqual({ src: null, produto: false });
  });
});
