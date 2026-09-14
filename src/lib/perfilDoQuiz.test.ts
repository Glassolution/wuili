import { describe, expect, it } from "vitest";

import {
  motivoDaRecomendacao,
  pontuarProdutoParaPerfil,
  tetoDePreco,
  variacaoDoUsuario,
  type RespostasDoQuiz,
} from "@/lib/perfilDoQuiz";

/**
 * O que estes testes protegem: a vitrine do guia precisa mudar de acordo com o
 * quiz de cadastro. Se a pontuação passar a ignorar as respostas, todo mundo
 * volta a ver a mesma lista de mais vendidos e o passo 2 do guia perde o
 * sentido.
 */

const barato = { categoria: "Casa e Utensílios Domésticos", preco: 45, rating: 4.2, ordersCount: 200 };
const caro = { categoria: "Casa e Utensílios Domésticos", preco: 320, rating: 4.2, ordersCount: 200 };
const comTracao = { categoria: "Informática", preco: 90, rating: 4.6, ordersCount: 2500 };
const semTracao = { categoria: "Informática", preco: 90, rating: 4.6, ordersCount: 5 };

describe("pontuarProdutoParaPerfil", () => {
  it("põe o nicho declarado no cadastro acima de qualquer outra categoria", () => {
    const respostas: RespostasDoQuiz = { nicho: "casa" };
    const doNicho = pontuarProdutoParaPerfil(barato, respostas);
    const deFora = pontuarProdutoParaPerfil({ ...barato, categoria: "Games" }, respostas);

    expect(doNicho).toBeGreaterThan(deFora);
  });

  it("favorece ticket baixo para quem ainda não vendeu nada", () => {
    const iniciante: RespostasDoQuiz = { produtos: "nenhum", mercadoLivre: "nao" };
    expect(pontuarProdutoParaPerfil(barato, iniciante)).toBeGreaterThan(
      pontuarProdutoParaPerfil(caro, iniciante),
    );
  });

  it("favorece ticket maior para quem tem marca própria", () => {
    const marca: RespostasDoQuiz = { perfil: "marca", produtos: "50+" };
    expect(pontuarProdutoParaPerfil(caro, marca)).toBeGreaterThan(pontuarProdutoParaPerfil(barato, marca));
  });

  it("prioriza produto com histórico para quem quer testar rápido", () => {
    const testador: RespostasDoQuiz = { dificuldade: "testar" };
    expect(pontuarProdutoParaPerfil(comTracao, testador)).toBeGreaterThan(
      pontuarProdutoParaPerfil(semTracao, testador),
    );
  });

  it("dá ordens diferentes para perfis diferentes com o mesmo catálogo", () => {
    const ordenar = (respostas: RespostasDoQuiz) =>
      [barato, caro, comTracao]
        .map((produto, indice) => ({ indice, pontos: pontuarProdutoParaPerfil(produto, respostas) }))
        .sort((a, b) => b.pontos - a.pontos)
        .map((item) => item.indice);

    expect(ordenar({ nicho: "casa", produtos: "nenhum" })).not.toEqual(
      ordenar({ nicho: "tech", perfil: "marca", produtos: "50+" }),
    );
  });
});

describe("variacaoDoUsuario", () => {
  it("é estável para o mesmo par usuário/produto", () => {
    expect(variacaoDoUsuario("produto-1", "user-a")).toBe(variacaoDoUsuario("produto-1", "user-a"));
  });

  it("separa usuários que responderam o mesmo quiz", () => {
    const produtos = ["p1", "p2", "p3", "p4", "p5", "p6"];
    const paraA = produtos.map((id) => variacaoDoUsuario(id, "user-a"));
    const paraB = produtos.map((id) => variacaoDoUsuario(id, "user-b"));

    expect(paraA).not.toEqual(paraB);
  });

  it("não desempata nada quando não há usuário logado", () => {
    expect(variacaoDoUsuario("produto-1", null)).toBe(0);
  });
});

describe("tetoDePreco", () => {
  it("é mais apertado para quem não tem conta no Mercado Livre nem anúncios", () => {
    expect(tetoDePreco({ produtos: "nenhum", mercadoLivre: "nao" })).toBe(60);
    expect(tetoDePreco({ produtos: "nenhum", mercadoLivre: "sim" })).toBe(80);
  });

  it("não limita quem já tem operação rodando", () => {
    expect(tetoDePreco({ produtos: "50+" })).toBeNull();
  });
});

describe("motivoDaRecomendacao", () => {
  it("explica pelo nicho quando a categoria bate com o cadastro", () => {
    expect(motivoDaRecomendacao(barato, { nicho: "casa" })).toMatch(/nicho/i);
  });

  it("muda o texto conforme a dificuldade declarada", () => {
    const paraTeste = motivoDaRecomendacao(comTracao, { dificuldade: "testar" });
    const paraTrafego = motivoDaRecomendacao(comTracao, { dificuldade: "trafego" });

    expect(paraTeste).not.toBe(paraTrafego);
  });
});
