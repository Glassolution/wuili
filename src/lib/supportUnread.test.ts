import { describe, expect, it } from "vitest";
import { hasUnreadCustomerMessage } from "./supportUnread";

const msg = (sender: string, created_at: string, internal = false) => ({ sender, created_at, internal });

describe("bolinha de não lido do suporte", () => {
  it("ticket novo nunca visto tem bolinha, mesmo com a IA já tendo respondido", () => {
    expect(
      hasUnreadCustomerMessage([msg("user", "2026-11-06T20:39:13Z"), msg("ai", "2026-11-06T20:39:28Z")], null),
    ).toBe(true);
  });

  it("some depois que o admin abre o ticket", () => {
    expect(hasUnreadCustomerMessage([msg("user", "2026-10-29T10:10:00Z")], "2026-10-29T10:11:00Z")).toBe(false);
  });

  it("volta quando o cliente escreve de novo depois de visto", () => {
    expect(
      hasUnreadCustomerMessage(
        [msg("user", "2026-10-29T10:00:00Z"), msg("admin", "2026-10-29T10:05:00Z"), msg("user", "2026-10-29T10:10:00Z")],
        "2026-10-29T10:05:00Z",
      ),
    ).toBe(true);
  });

  it("resposta do admin sem ter aberto não apaga a bolinha sozinha (quem apaga é o admin_last_seen_at)", () => {
    expect(
      hasUnreadCustomerMessage([msg("user", "2026-10-29T10:00:00Z"), msg("admin", "2026-10-29T10:05:00Z")], null),
    ).toBe(true);
  });

  it("ignora mensagens internas e de IA/admin", () => {
    expect(
      hasUnreadCustomerMessage(
        [msg("user", "2026-10-29T10:20:00Z", true), msg("ai", "2026-10-29T10:21:00Z"), msg("admin", "2026-10-29T10:22:00Z")],
        "2026-10-29T10:00:00Z",
      ),
    ).toBe(false);
  });
});
