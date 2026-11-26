import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {}, withFreshSupabaseSession: vi.fn() }));
vi.mock("@/lib/briefingDaLoja", async (importar) => {
  const real = await importar<typeof import("@/lib/briefingDaLoja")>();
  return { ...real, buscarNoCatalogo: vi.fn(async () => []), produtosParaALoja: vi.fn(async () => []) };
});

import { respostaDemoDoAtlas } from "./atlasDemo";
import { corPrincipal, detectarTipoDeLoja, extrairNicho, termosDoNicho } from "./briefingDaLoja";

type Msg = Parameters<typeof respostaDemoDoAtlas>[1][number];

/** Simula a conversa: cada fala da pessoa recebe a resposta do Atlas. */
async function conversar(falas: string[]) {
  const historico: Msg[] = [];
  let ultima: Awaited<ReturnType<typeof respostaDemoDoAtlas>> | null = null;
  for (const fala of falas) {
    ultima = await respostaDemoDoAtlas(fala, historico);
    historico.push({ role: "user", content: fala });
    historico.push({ role: "assistant", content: ultima.message, product_data: { briefing: ultima.briefing } });
  }
  return ultima!;
}

describe("briefing da loja", () => {
  it("reconhece o tipo de loja", () => {
    expect(detectarTipoDeLoja("Quero vender skins de Free Fire e diamantes")).toBe("jogo");
    expect(detectarTipoDeLoja("Sou professor e quero vender meus cursos")).toBe("curso");
    expect(detectarTipoDeLoja("Sou dentista e quero um catálogo dos meus serviços")).toBe("servico");
    expect(detectarTipoDeLoja("Quero uma loja de roupas femininas")).toBe("fisico");
  });

  it("tira o nicho e os termos de busca da frase", () => {
    expect(extrairNicho("Quero criar uma loja de roupas fitness")).toBe("roupas fitness");
    expect(extrairNicho("Quero criar uma loja de produtos do agro")).toBe("agro");
    expect(termosDoNicho("roupas fitness")).toEqual(["roupa", "fitness"]);
    // Só letras e números: os termos entram num filtro do PostgREST.
    for (const termo of termosDoNicho("roupa,b),(category.eq.x%")) expect(termo).toMatch(/^[a-z0-9à-ÿ]+$/);
  });

  it("escolhe a cor principal pela primeira cor citada", () => {
    expect(corPrincipal("Verde e bege").nome).toBe("verde");
    expect(corPrincipal("Preto e dourado").nome).toBe("dourado");
    expect(corPrincipal("azul-marinho (#1e3a8a) e creme (#F5F0E6)")).toEqual({ hex: "#1E3A8A", nome: "azul-marinho" });
  });
});

describe("conversa de criar loja (demonstração)", () => {
  it("pergunta estilo, cores e produtos, e termina com o botão de criar", async () => {
    const r = await conversar([
      "Quero uma loja de produtos do agro",
      "Natural e rústico",
      "Verde e bege",
      "Usar o catálogo da Velo",
    ]);
    // O catálogo (simulado vazio) não tem o nicho: o Atlas avisa e segue com produtos próprios.
    expect(r.message).toContain("não tem produtos de");
    expect(r.briefing?.produtos).toBe("proprios");
    expect(r.actions.some((a) => a.type === "create_store")).toBe(true);
  });

  it("loja que não é de produto físico não pergunta sobre o catálogo", async () => {
    const r = await conversar(["Sou professor e quero vender meus cursos de violão", "Escolhe por mim", "Azul e branco"]);
    expect(r.briefing?.etapa).toBe("resumo");
    expect(r.message).toContain("catálogo da Velo tem só produtos físicos");
  });

  it("mudar uma resposta volta direto ao resumo", async () => {
    const r = await conversar([
      "Quero um catálogo dos serviços do meu consultório odontológico",
      "Elegante e sofisticado",
      "Preto e dourado",
      "Quero mudar algo",
      "Mudar as cores",
      "Azul e branco",
    ]);
    expect(r.briefing?.cores).toBe("Azul e branco");
    expect(r.briefing?.etapa).toBe("resumo");
  });
});

describe("nicho sem 'do quê'", () => {
  it("não vira a frase inteira", async () => {
    const { extrairNicho, NICHO_GERAL } = await import("@/lib/briefingDaLoja");
    expect(extrairNicho("Quero uma loja online")).toBe(NICHO_GERAL);
    expect(extrairNicho("quero criar um site")).toBe(NICHO_GERAL);
    expect(extrairNicho("Quero criar uma loja de roupas fitness")).toBe("roupas fitness");
    expect(extrairNicho("bijuterias artesanais")).toBe("bijuterias artesanais");
  });
});
