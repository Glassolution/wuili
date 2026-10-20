import { describe, expect, it } from "vitest";
import { supportNavigationReply } from "../../supabase/functions/_shared/supportNavigation";

describe("support navigation", () => {
  it("routes influencer creation to the current avatar page", () => {
    expect(supportNavigationReply("onde eu crio um influencer de IA?")).toContain("(/dashboard/avatares)");
  });
  it("routes support to its real settings tab", () => {
    expect(supportNavigationReply("onde fica o suporte?")).toContain("(/dashboard/configuracoes?tab=Suporte)");
  });
  it("routes ML connection to customer settings, not the admin-only sidebar entry", () => {
    expect(supportNavigationReply("onde conectar mercado livre?")).toContain("(/dashboard/configuracoes?tab=Integra%C3%A7%C3%B5es)");
  });
  it("does not swallow a refund transaction", () => {
    expect(supportNavigationReply("onde peço reembolso da Velo?")).toBeNull();
  });
  it("does not mistake supplier refunds for navigation", () => {
    expect(supportNavigationReply("onde peço reembolso da C7?")).toBeNull();
  });
  it("does not hide publication failures", () => {
    expect(supportNavigationReply("onde vejo o erro? não consigo publicar anúncios")).toBeNull();
  });
  it("does not invent unsupported pages", () => {
    expect(supportNavigationReply("onde acesso hologramas?")).toBeNull();
  });
});