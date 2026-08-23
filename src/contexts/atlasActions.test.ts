import { describe, expect, it } from "vitest";

import { normalizeAtlasActions } from "@/contexts/AtlasChatContext";

/**
 * O validador de ações é um filtro silencioso: o que ele não reconhece some
 * antes de chegar à tela, sem erro nem aviso. Foi assim que a ação de publicar
 * ficou invisível — o passo 5 do guia mandava `publish_ml`, o filtro descartava,
 * e o usuário só via o atalho para o catálogo. Este teste existe para que um
 * tipo novo de ação não se perca do mesmo jeito.
 */
describe("normalizeAtlasActions", () => {
  it("mantém a ação de publicar no Mercado Livre", () => {
    const acoes = normalizeAtlasActions([
      { type: "publish_ml", label: "Publicar no Mercado Livre", product_id: "prod-1", variant: "primary" },
    ]);

    expect(acoes).toHaveLength(1);
    expect(acoes[0]).toMatchObject({ type: "publish_ml", product_id: "prod-1" });
  });

  it("mantém a vitrine de produtos do guia", () => {
    const acoes = normalizeAtlasActions([
      { type: "open_showcase", label: "Escolher meu produto", niche: { id: "tech", label: "Tech", catalogTerms: ["fone"] } },
    ]);

    expect(acoes).toHaveLength(1);
  });

  it("mantém o atalho para o vídeo tutorial da conta de vendedor", () => {
    const acoes = normalizeAtlasActions([{ type: "watch_tutorial", label: "Assistir vídeo tutorial" }]);

    expect(acoes).toHaveLength(1);
    expect(acoes[0]).toMatchObject({ type: "watch_tutorial", label: "Assistir vídeo tutorial" });
  });

  it("reconhece todos os tipos que o guia envia", () => {
    const acoes = normalizeAtlasActions([
      { type: "navigation", label: "Abrir Catálogo", route: "/dashboard/catalogo" },
      { type: "quick_reply", label: "Vamos seguir", message: "Vamos seguir" },
      { type: "connect_ml", label: "Conectar Mercado Livre" },
      { type: "product_card", product_id: "prod-2" },
      { type: "publish_ml", label: "Publicar", product_id: "prod-3" },
      { type: "open_showcase", label: "Escolher produto" },
      { type: "watch_tutorial", label: "Assistir vídeo tutorial" },
    ]);

    expect(acoes.map((acao) => acao.type)).toEqual([
      "navigation",
      "quick_reply",
      "connect_ml",
      "product_card",
      "publish_ml",
      "open_showcase",
      "watch_tutorial",
    ]);
  });

  it("descarta ação malformada em vez de deixar quebrar na renderização", () => {
    expect(normalizeAtlasActions([
      { type: "publish_ml", label: "Publicar" },
      { type: "navigation", label: "Sem rota" },
      { type: "watch_tutorial" },
      { type: "inventado", label: "?" },
      null,
      "texto",
    ])).toEqual([]);
  });

  it("devolve lista vazia para o que não é lista", () => {
    expect(normalizeAtlasActions(undefined)).toEqual([]);
    expect(normalizeAtlasActions({})).toEqual([]);
  });
});
