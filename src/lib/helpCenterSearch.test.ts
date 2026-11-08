import { describe, expect, it } from "vitest";
import type { HelpArticle, HelpCategory } from "@/lib/helpCenter";
import { helpSearchTerms, searchHelpArticles } from "@/lib/helpCenterSearch";

const category: HelpCategory = {
  id: "c1", slug: "pagamentos-e-planos", title: "Assinatura e cobrança", description: null, icon: null,
  section: "Central de ajuda", featured: true, position: 1,
};

const article = (id: string, title: string, content = "", keywords: string[] = []): HelpArticle => ({
  id, category_id: "c1", slug: id, title, summary: null, content, keywords, status: "published",
  position: 0, published_at: null, updated_at: "2026-11-07T00:00:00Z",
});

const entries = [
  article("reembolso", "Como solicito um reembolso da minha assinatura da Velo?", "Direito de arrependimento", ["estorno"]),
  article("cancelar", "Cancelar minha assinatura ou conta", "Cancelar a renovação"),
  article("senha", "Esqueci minha senha"),
].map((a) => ({ article: a, category }));

describe("busca da central de ajuda", () => {
  it("ignora acentos, palavras comuns e casa pelo radical", () => {
    expect(helpSearchTerms("Como SOLICITAR o reembolso?")).toEqual(["solic", "reemb"]);
  });

  it("acha o artigo de reembolso por sinônimo e por variação da palavra", () => {
    expect(searchHelpArticles(entries, "quero estorno")[0].article.id).toBe("reembolso");
    expect(searchHelpArticles(entries, "solicitar reembolso")[0].article.id).toBe("reembolso");
  });

  it("prioriza título e não devolve nada sem termo útil", () => {
    expect(searchHelpArticles(entries, "cancelar")[0].article.id).toBe("cancelar");
    expect(searchHelpArticles(entries, "como")).toEqual([]);
  });
});

describe("busca tolerante", () => {
  const semPalavrasChave = [
    article("reemb", "Pedir reembolso de uma cobrança", "Você tem 7 dias para pedir o dinheiro de volta."),
    article("planos", "Planos da Velo", "Cada plano tem limites."),
    article("vitalicio", "Plano vitalício", "Pagamento único, sem renovar o plano."),
    article("pagar", "Preciso pagar para publicar?", "Sim, é preciso ter um plano ativo."),
  ].map((a) => ({ article: a, category }));

  it("acha reembolso por estorno mesmo sem palavra-chave no artigo", () => {
    expect(searchHelpArticles(semPalavrasChave, "quero estorno do plano")[0].article.id).toBe("reemb");
  });
});
