export const USER_TABS = ["ativos", "risco", "vencida", "sem_plano", "todos"] as const;
export type UserTab = typeof USER_TABS[number];

export function parsePageRequest(body: Record<string, unknown>) {
  const page = body.page ?? 1;
  const size = body.size ?? 25;
  const search = body.search ?? "";
  const tab = body.tab ?? "ativos";
  if (typeof page !== "number" || !Number.isInteger(page) || page < 1 || page > 1_000_000) throw new Error("Página inválida.");
  if (typeof size !== "number" || ![10, 25, 50].includes(size)) throw new Error("Tamanho de página inválido.");
  if (typeof search !== "string" || search.length > 200) throw new Error("Busca inválida.");
  if (typeof tab !== "string" || !USER_TABS.some((value) => value === tab)) throw new Error("Aba inválida.");
  return { p_page: page, p_size: size, p_search: search.trim(), p_tab: tab };
}