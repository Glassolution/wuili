import { describe, expect, it } from "vitest";
import { isSupportTicketUnread, lastVisibleHumanMessage } from "./supportUnread";

const msg = (sender: string, created_at: string, internal = false) => ({ sender, created_at, internal });

describe("bolinha de não lido do suporte", () => {
  it("aparece quando o cliente manda mensagem num ticket nunca visto", () => {
    const last = lastVisibleHumanMessage([msg("user", "2026-10-29T10:00:00Z")]);
    expect(isSupportTicketUnread(last, null)).toBe(true);
  });

  it("some depois que o admin responde", () => {
    const last = lastVisibleHumanMessage([msg("user", "2026-10-29T10:00:00Z"), msg("admin", "2026-10-29T10:05:00Z")]);
    expect(isSupportTicketUnread(last, null)).toBe(false);
  });

  it("volta quando o cliente escreve de novo depois da resposta", () => {
    const last = lastVisibleHumanMessage([
      msg("user", "2026-10-29T10:00:00Z"),
      msg("admin", "2026-10-29T10:05:00Z"),
      msg("user", "2026-10-29T10:10:00Z"),
    ]);
    expect(isSupportTicketUnread(last, "2026-10-29T10:05:00Z")).toBe(true);
  });

  it("some quando o admin abre o ticket depois da mensagem", () => {
    const last = lastVisibleHumanMessage([msg("user", "2026-10-29T10:10:00Z")]);
    expect(isSupportTicketUnread(last, "2026-10-29T10:11:00Z")).toBe(false);
  });

  it("ignora mensagens internas e da IA", () => {
    const last = lastVisibleHumanMessage([
      msg("user", "2026-10-29T10:00:00Z"),
      msg("admin", "2026-10-29T10:05:00Z", true),
      msg("ai", "2026-10-29T10:06:00Z"),
    ]);
    expect(last?.sender).toBe("user");
    expect(isSupportTicketUnread(last, null)).toBe(true);
  });
});
