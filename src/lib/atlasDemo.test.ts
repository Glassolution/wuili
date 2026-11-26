import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {}, withFreshSupabaseSession: vi.fn() }));
vi.mock("@/lib/briefingDaLoja", async (importar) => {
  const real = await importar<typeof import("@/lib/briefingDaLoja")>();
  return { ...real, buscarNoCatalogo: vi.fn(async () => []), produtosParaALoja: vi.fn(async () => []) };
});

import { respostaDemoDoAtlas } from "./atlasDemo";
import { corPrincipal, detectarTipoDeLoja, extrairNicho, fonteDaLoja, nomeDaFonte, temMarca, termosDoNicho } from "./briefingDaLoja";

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
  it("sem marca: pergunta estilo, cores e produtos, e termina com o botão de criar", async () => {
    const r = await conversar([
      "Quero uma loja de produtos do agro",
      "Ainda não tenho",
      "Produtores rurais que compram pelo celular",
      "Natural e rústico",
      "Verde e bege",
      "Pular",
      "Usar o catálogo da Velo",
    ]);
    // O catálogo (simulado vazio) não tem o nicho: o Atlas avisa e segue com produtos próprios.
    expect(r.message).toContain("não tem produtos de");
    expect(r.briefing?.produtos).toBe("proprios");
    expect(r.actions.some((a) => a.type === "create_store")).toBe(true);
  });

  it("loja que não é de produto físico não pergunta sobre o catálogo", async () => {
    const r = await conversar(["Sou professor e quero vender meus cursos de violão", "Ainda não tenho", "Ainda não sei", "Escolhe por mim", "Azul e branco", "Pular"]);
    expect(r.briefing?.etapa).toBe("resumo");
    expect(r.message).toContain("catálogo da Velo tem só produtos físicos");
  });

  it("mudar uma resposta volta direto ao resumo", async () => {
    const r = await conversar([
      "Quero um catálogo dos serviços do meu consultório odontológico",
      "Ainda não tenho",
      "Ainda não sei",
      "Elegante",
      "Preto e dourado",
      "Pular",
      "Quero mudar algo",
      "Mudar as cores",
      "Azul e branco",
    ]);
    expect(r.briefing?.cores).toBe("Azul e branco");
    expect(r.briefing?.etapa).toBe("resumo");
  });
});

describe("quem já tem marca", () => {
  it("a primeira resposta pergunta se já tem marca, antes de qualquer estilo", async () => {
    const r = await conversar(["Quero uma loja de roupas masculinas"]);
    expect(r.briefing?.etapa).toBe("marca");
    expect(r.message).toMatch(/já tem uma marca/);
    expect(r.actions.map((a) => ("label" in a ? a.label : ""))).toEqual(["Já tenho uma marca", "Ainda não tenho"]);
  });

  it("com marca: cores da marca → fonte → estilo, sem paleta pronta, e o resumo diz que é a marca dela", async () => {
    const cores = await conversar(["Quero uma loja de roupas masculinas", "Já tenho uma marca"]);
    expect(cores.briefing?.etapa).toBe("cores");
    expect(cores.message).toMatch(/cores da sua marca/);
    expect(cores.actions.map((a) => ("label" in a ? a.label : ""))).not.toContain("Azul e branco");

    const fonte = await conversar(["Quero uma loja de roupas masculinas", "Já tenho uma marca", "Minhas cores: azul-marinho (#1E3A8A) e creme (#F5F0E6)"]);
    expect(fonte.briefing?.etapa).toBe("fonte");

    const r = await conversar([
      "Quero uma loja de roupas masculinas",
      "Já tenho uma marca",
      "Minhas cores: azul-marinho (#1E3A8A) e creme (#F5F0E6)",
      "montserrat",
      "Homens de 30 a 45 que trabalham de social e querem conforto",
      "Elegante",
      "modelagem pensada para o corpo brasileiro",
      "Meus próprios produtos",
    ]);
    expect(r.message).toMatch(/\*\*Pra quem:\*\* Homens de 30 a 45/);
    expect(r.message).toMatch(/\*\*Personalidade:\*\* Elegante \(discreta, sofisticada/);
    expect(r.message).toMatch(/\*\*Diferencial:\*\* Modelagem pensada para o corpo brasileiro\./);
    expect(r.briefing?.marca).toEqual({ tem: true, fonte: "Montserrat" });
    expect(r.briefing?.cores).toBe("azul-marinho (#1E3A8A) e creme (#F5F0E6)");
    expect(r.message).toMatch(/\*\*Marca:\*\* a sua \(logo, cores e fonte Montserrat\)/);
    expect(r.message).toMatch(/logo da sua marca/);
    expect(fonteDaLoja(r.briefing!)).toBe("Montserrat");
  });

  it("sem saber a fonte, a loja usa a do estilo", async () => {
    const r = await conversar(["Quero uma loja de bolsas", "Sim, já tenho", "preto e dourado", "Não sei a fonte", "Ainda não sei", "Elegante", "Pular", "Meus próprios produtos"]);
    expect(r.briefing?.marca).toEqual({ tem: true, fonte: null });
    expect(fonteDaLoja(r.briefing!)).toBe("Georgia");
  });

  it("entende as respostas e limpa o nome da fonte", () => {
    expect(temMarca("Já tenho uma marca")).toBe(true);
    expect(temMarca("sim, a Botui")).toBe(true);
    expect(temMarca("Ainda não tenho")).toBe(false);
    expect(temMarca("vamos criar")).toBe(false);
    expect(temMarca("hmm")).toBeNull();
    expect(nomeDaFonte("a fonte é playfair display")).toBe("Playfair Display");
    expect(nomeDaFonte("Poppins")).toBe("Poppins");
    expect(nomeDaFonte("Não sei a fonte")).toBeNull();
    // Só letras, números e espaço: o nome vai na URL do Google Fonts.
    expect(nomeDaFonte("Inter&family=x<script>")).toMatch(/^[A-Za-zÀ-ÿ0-9 ]+$/);
  });
});

describe("personalidade da marca", () => {
  it("sem marca: pra quem → personalidade → cores → diferencial, e a pergunta da personalidade explica cada uma", async () => {
    const publico = await conversar(["Quero uma loja de roupas fitness", "Ainda não tenho"]);
    expect(publico.briefing?.etapa).toBe("publico");
    const pers = await conversar(["Quero uma loja de roupas fitness", "Ainda não tenho", "Mulheres que treinam cedo"]);
    expect(pers.briefing?.etapa).toBe("estilo");
    expect(pers.message).toMatch(/se a sua marca fosse uma pessoa/);
    expect(pers.message).toMatch(/\*\*Ousada:\*\*/);
    const cores = await conversar(["Quero uma loja de roupas fitness", "Ainda não tenho", "Mulheres que treinam cedo", "Cheia de energia"]);
    expect(cores.briefing?.etapa).toBe("cores");
    expect(cores.message).toMatch(/marca cheia de energia/);
    const dif = await conversar(["Quero uma loja de roupas fitness", "Ainda não tenho", "Mulheres que treinam cedo", "Cheia de energia", "Rosa e lilás"]);
    expect(dif.briefing?.etapa).toBe("diferencial");
  });

  it("texto livre vira a personalidade mais próxima; sem pista, pergunta de novo", async () => {
    const livre = await conversar(["Quero uma loja de roupas fitness", "Ainda não tenho", "Ainda não sei", "bem sofisticada e discreta"]);
    expect(livre.briefing?.estilo).toBe("Elegante (bem sofisticada e discreta)");
    const semPista = await conversar(["Quero uma loja de roupas fitness", "Ainda não tenho", "Ainda não sei", "hmm não sei explicar"]);
    expect(semPista.briefing?.etapa).toBe("estilo");
    expect(semPista.message).toMatch(/qual dessas chega mais perto/);
  });

  it("lê a personalidade e limpa o diferencial", async () => {
    const { personalidadeDe, fraseDoDiferencial } = await import("@/lib/personalidadeDaMarca");
    expect(personalidadeDe("Ousada")).toBe("ousada");
    expect(personalidadeDe("Elegante (fala alto)")).toBe("elegante");
    expect(personalidadeDe("Moderno e minimalista")).toBe("minimalista");
    expect(personalidadeDe("Colorido e divertido")).toBe("energia");
    expect(personalidadeDe("xyz")).toBeNull();
    expect(fraseDoDiferencial("o diferencial é zero transparência nas leggings")).toBe("Zero transparência nas leggings.");
    expect(fraseDoDiferencial("ok")).toBeNull();
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
