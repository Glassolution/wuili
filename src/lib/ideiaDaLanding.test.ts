import { beforeEach, describe, expect, it } from "vitest";
import {
  consumirIdeiaDaLanding,
  guardarIdeiaDaLanding,
  lerIdeiaDaLanding,
  mensagemParaOAtlas,
  temIdeiaDaLanding,
} from "./ideiaDaLanding";

describe("ideia da landing → Atlas", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("guarda, lê e consome uma vez só", () => {
    expect(temIdeiaDaLanding()).toBe(false);
    guardarIdeiaDaLanding("  roupas fitness  ", "loja");
    expect(lerIdeiaDaLanding()).toEqual({ ideia: "roupas fitness", canal: "loja" });
    expect(consumirIdeiaDaLanding()).toEqual({ ideia: "roupas fitness", canal: "loja" });
    expect(temIdeiaDaLanding()).toBe(false);
  });

  it("ignora texto vazio ou JSON quebrado", () => {
    guardarIdeiaDaLanding("   ", "loja");
    expect(temIdeiaDaLanding()).toBe(false);
    window.sessionStorage.setItem("velo_ideia_landing", "{quebrado");
    expect(lerIdeiaDaLanding()).toBeNull();
  });

  it("acrescenta o canal só quando o texto ainda não fala dele", () => {
    expect(mensagemParaOAtlas({ ideia: "Quero vender no Mercado Livre fones", canal: "mercado-livre" })).toBe(
      "Quero vender no Mercado Livre fones",
    );
    expect(mensagemParaOAtlas({ ideia: "Acessórios para pet", canal: "mercado-livre" })).toBe(
      "Acessórios para pet\n\nQuero começar por: Mercado Livre.",
    );
    expect(mensagemParaOAtlas({ ideia: "Acessórios para pet" })).toBe("Acessórios para pet");
  });
});
