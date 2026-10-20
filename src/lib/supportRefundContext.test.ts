import { describe, expect, it } from "vitest";
import { classifyRefundContext } from "../../supabase/functions/_shared/supportRefundContext";

describe("refund subject", () => {
  it("recognizes supplier purchase despite the word reimbursement", () => {
    expect(classifyRefundContext("Efetuei o pagamento na C7, o comprador do mercado livre cancelou a compra após isso, gostaria de ser reembolsado como faço")).toBe("pedido");
  });
  it("recognizes subscription reimbursement and cancellation together", () => {
    expect(classifyRefundContext("reembolso E O cancelamento da assinatura")).toBe("assinatura");
  });
  it("preserves supplier context in a follow-up", () => {
    expect(classifyRefundContext("quero meu dinheiro de volta", ["Paguei a fornecedora e o comprador cancelou"])).toBe("pedido");
  });
  it("accepts an explicit change to subscription context", () => {
    expect(classifyRefundContext("agora quero cancelar minha assinatura", ["problema com a C7"])).toBe("assinatura");
  });
  it("asks for the subject when it is unknown", () => {
    expect(classifyRefundContext("quero reembolso")).toBe("ambiguo");
  });
});