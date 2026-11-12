import { describe, expect, it } from "vitest";
import { omitRepeatedReply, shouldPauseSupport } from "../../supabase/functions/_shared/supportContinuity";

describe("support continuity", () => {
  it("continues while a human is requested but has not replied", () => {
    const ticket = { needs_human: true, ai_paused: false, status: "open" };
    expect(shouldPauseSupport(ticket.ai_paused, ticket.status, [{ sender: "ai", internal: true, message: "Encaminhado" }])).toBe(false);
  });
  it("stops when a public human reply arrives, not an internal note", () => {
    expect(shouldPauseSupport(false, "open", [{ sender: "admin", internal: true, message: "Nota" }])).toBe(false);
    expect(shouldPauseSupport(false, "open", [{ sender: "admin", internal: false, message: "Assumi" }])).toBe(true);
  });
  it("respects manual pause and closed tickets", () => {
    expect(shouldPauseSupport(true, "open", [])).toBe(true);
    expect(shouldPauseSupport(false, "closed", [])).toBe(true);
  });
  it("does not resend the same answer and retains new information", () => {
    const history = [{ sender: "ai", message: "Abra Pedidos.\n\nA equipe vai verificar." }];
    expect(omitRepeatedReply(" ABRA   PEDIDOS. ", history)).toBe("");
    expect(omitRepeatedReply("A equipe vai verificar.\n\nA etiqueta está no Mercado Livre.", history)).toBe("A etiqueta está no Mercado Livre.");
    expect(omitRepeatedReply("Uma resposta nova.", history)).toBe("Uma resposta nova.");
  });
});