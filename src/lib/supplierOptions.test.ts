import { describe, expect, it } from "vitest";
import {
  listarOpcoesDaFornecedora,
  precosIguais,
  tituloComOpcao,
  validarOpcoesEscolhidas,
} from "../../supabase/functions/_shared/supplierOptions";

const sandisk = [
  { sku: "S", name: "Tamanho", stock: 100, value: "128GB", cost_price: 129, stock_managed: false },
  { sku: "S", name: "Tamanho", stock: 100, value: "32GB", cost_price: 36.99, stock_managed: false },
  { sku: "S", name: "Tamanho", stock: 0, value: "8GB", cost_price: 35, stock_managed: true },
];

describe("opções da fornecedora", () => {
  it("mostra cada opção com o próprio custo", () => {
    const o = listarOpcoesDaFornecedora(sandisk, 36.99);
    expect(o.map((x) => [x.valor, x.custo])).toEqual([["128GB", 129], ["32GB", 36.99], ["8GB", 35]]);
  });
  it("aceita qualquer tipo de opção, não só tamanho/cor/capacidade", () => {
    const o = listarOpcoesDaFornecedora([{ name: "Sabor", value: "Uva" }, { name: "Sabor", value: "Menta" }], 10);
    expect(o).toHaveLength(2);
  });
  it("ignora níveis de compra da fornecedora", () => {
    expect(listarOpcoesDaFornecedora([{ name: "Compra", value: "Atacado" }, { name: "Compra", value: "Dropshipping" }], 10)).toEqual([]);
  });
  it("recusa preço abaixo do custo da opção e opção sem estoque", () => {
    const o = listarOpcoesDaFornecedora(sandisk, 36.99);
    expect(validarOpcoesEscolhidas(o, [{ chave: "Tamanho: 128GB", preco: 75 }])).toHaveLength(1);
    expect(validarOpcoesEscolhidas(o, [{ chave: "Tamanho: 8GB", preco: 70 }])).toHaveLength(1);
    expect(validarOpcoesEscolhidas(o, [{ chave: "Tamanho: 128GB", preco: 200 }])).toEqual([]);
  });
  it("põe a opção no título sem passar de 60 caracteres", () => {
    const t = tituloComOpcao("Cartão de memória SanDisk Ultra Micro SD Classe 10 Original", "128GB");
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.endsWith(" 128GB")).toBe(true);
  });
  it("só junta num anúncio quando os preços são iguais", () => {
    expect(precosIguais([{ chave: "a", preco: 10 }, { chave: "b", preco: 10 }])).toBe(true);
    expect(precosIguais([{ chave: "a", preco: 10 }, { chave: "b", preco: 20 }])).toBe(false);
  });
});
