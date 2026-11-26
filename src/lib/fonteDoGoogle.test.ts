import { describe, expect, it } from "vitest";

import { pilhaDaFonte, urlDaFonteDoGoogle } from "./fonteDoGoogle";

describe("fonte da marca no Google Fonts", () => {
  it("monta a URL com o nome da família", () => {
    expect(urlDaFonteDoGoogle("Playfair Display")).toBe(
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap",
    );
  });

  it("não deixa o nome sair da URL nem do CSS", () => {
    expect(urlDaFonteDoGoogle('Inter&family=x"><script>')).toBe(
      "https://fonts.googleapis.com/css2?family=Interfamilyxscript:wght@400;500;600;700&display=swap",
    );
    expect(pilhaDaFonte('Mont"serrat', "Arial")).toBe('"Montserrat", Arial');
    expect(urlDaFonteDoGoogle("&&&")).toBeNull();
    expect(pilhaDaFonte("", "Arial")).toBe("Arial");
  });
});
