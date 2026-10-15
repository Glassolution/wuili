import { describe, expect, it } from "vitest";
import { messageHasRefundIntent } from "./support";

describe("messageHasRefundIntent", () => {
  it.each([
    "quero reembolso",
    "Quero reemolso",
    "quero rembolso",
    "quero o reenbolso por favor",
    "quero cancelar minha assinatura",
    "quero cancelamenro",
    "cancelar",
    "quero meu dinheiro de volta",
    "me devolva o dinheiro",
    "preciso do estorno",
  ])("reconhece pedido: %s", (texto) => {
    expect(messageHasRefundIntent(texto)).toBe(true);
  });

  it.each([
    "como funciona o reembolso?",
    "qual o prazo do reembolso?",
    "posso pedir reembolso depois?",
    "meu anúncio foi cancelado pelo mercado livre?",
    "como conecto o mercado livre",
    "obrigado pela ajuda",
  ])("ignora dúvida ou outro assunto: %s", (texto) => {
    expect(messageHasRefundIntent(texto)).toBe(false);
  });
});
