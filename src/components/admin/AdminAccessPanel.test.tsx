import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

const calls: Array<{ table: string; gte: unknown; lt: unknown }> = [];
const ROWS: Record<string, unknown[]> = {
  landing_events: [
    { visitor_id: "v1", device: "mobile", created_at: "2026-10-13T10:05:00-03:00" },
    { visitor_id: "v1", device: "mobile", created_at: "2026-10-13T11:00:00-03:00" },
    { visitor_id: "v2", device: "desktop", created_at: "2026-10-13T14:00:00-03:00" },
    { visitor_id: "v3", device: "mobile", created_at: "2026-10-12T09:00:00-03:00" },
    { visitor_id: "v4", device: "mobile", created_at: "2026-10-12T20:00:00-03:00" },
  ],
  user_sessions: [
    { user_id: "u1", started_at: "2026-10-12T23:00:00-03:00", last_seen_at: "2026-10-13T01:00:00-03:00" },
    { user_id: "u2", started_at: "2026-10-13T12:00:00-03:00", last_seen_at: "2026-10-13T12:10:00-03:00" },
  ],
  profiles: [
    { user_id: "p1", created_at: "2026-10-13T14:10:00-03:00" },
    { user_id: "p2", created_at: "2026-10-12T10:00:00-03:00" },
  ],
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const rec = { table, gte: null as unknown, lt: null as unknown };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        gte: (_c: string, v: unknown) => ((rec.gte = v), chain),
        lt: (_c: string, v: unknown) => ((rec.lt = v), chain),
        range: () => {
          calls.push(rec);
          return Promise.resolve({ data: ROWS[table], error: null });
        },
      };
      return chain;
    },
  },
}));
vi.mock("@/lib/adminWalletFetch", () => ({
  fetchAllPages: async (fn: (a: number, b: number) => Promise<{ data: unknown[] }>) => (await fn(0, 999)).data,
}));

import AdminAccessPanel from "./AdminAccessPanel";

test("conta pessoas de hoje e compara com ontem até esta hora", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T15:30:00-03:00"));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AdminAccessPanel />
    </QueryClientProvider>,
  );
  const card = (label: string) => screen.getAllByText(label).map((el) => el.closest("article")).find(Boolean) as HTMLElement;
  await waitFor(() => expect(within(card("Visitantes no site")).getByText("2")).toBeTruthy());
  expect(within(card("Usuários que entraram")).getByText("2")).toBeTruthy();
  expect(within(card("Contas criadas")).getByText("1")).toBeTruthy();
  expect(card("Visitantes no site").textContent).toContain("1 ontem até esta hora");
  expect(card("Usuários que entraram").textContent).toContain("0 ontem até esta hora");
  expect(card("Contas criadas").textContent).toContain("o mesmo que ontem até esta hora");
  expect(calls[0].gte).toBe(new Date("2026-10-12T00:00:00-03:00").toISOString());
  expect(calls[0].lt).toBe(new Date("2026-10-13T15:30:00-03:00").toISOString());
  expect(screen.getByText("Hora a hora")).toBeTruthy();
  // 16 baldes de hora (00h..15h), mais recente primeiro
  const rows = screen.getAllByRole("row").slice(1);
  expect(rows).toHaveLength(16);
  expect(rows[0].textContent).toContain("15h");
  vi.useRealTimers();
});
