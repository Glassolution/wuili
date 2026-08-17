import { describe, expect, it } from "vitest";
import { nomeDeExibicao, primeiroNome } from "./nomeDeExibicao";

describe("nomeDeExibicao", () => {
  it("corta em dois nomes quando o cadastro tem nome completo", () => {
    expect(nomeDeExibicao("Luis Felipe Ferreira Xavier", "f@gmail.com")).toBe("Luis Felipe");
  });

  it("mantém o nome quando já tem um ou dois nomes", () => {
    expect(nomeDeExibicao("Ana", "a@x.com")).toBe("Ana");
    expect(nomeDeExibicao("Ana Paula", "a@x.com")).toBe("Ana Paula");
  });

  it("ignora espaços extras", () => {
    expect(nomeDeExibicao("  Luis   Felipe   Ferreira ", "f@gmail.com")).toBe("Luis Felipe");
  });

  it("usa a parte local do e-mail quando não há nome", () => {
    expect(nomeDeExibicao("", "luisfelipe@gmail.com")).toBe("luisfelipe");
    expect(nomeDeExibicao(null, "luisfelipe@gmail.com")).toBe("luisfelipe");
    expect(nomeDeExibicao("   ", "luisfelipe@gmail.com")).toBe("luisfelipe");
  });

  it("cai no padrão quando não há nome nem e-mail", () => {
    expect(nomeDeExibicao(null, null)).toBe("Usuário");
    expect(nomeDeExibicao(undefined, undefined)).toBe("Usuário");
  });

  it("primeiroNome devolve só o primeiro", () => {
    expect(primeiroNome("Luis Felipe Ferreira Xavier")).toBe("Luis");
    expect(primeiroNome("", "luisfelipe@gmail.com")).toBe("luisfelipe");
  });
});
