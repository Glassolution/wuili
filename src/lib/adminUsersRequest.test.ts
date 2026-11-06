import { describe, expect, it } from "vitest";
import { parsePageRequest } from "../../supabase/functions/admin-users/request";

describe("admin users server pagination", () => {
  it("defaults to active users and 25 rows", () => {
    expect(parsePageRequest({})).toEqual({ p_page: 1, p_size: 25, p_search: "", p_tab: "ativos" });
  });
  it("keeps All accessible and passes page and literal search", () => {
    expect(parsePageRequest({ page: 2, size: 25, search: " nome_% ", tab: "todos" })).toEqual({ p_page: 2, p_size: 25, p_search: "nome_%", p_tab: "todos" });
  });
  it("allows only bounded page sizes", () => {
    expect(() => parsePageRequest({ size: 1000 })).toThrow();
    expect(() => parsePageRequest({ page: 0 })).toThrow();
  });
  it("rejects unknown tabs and malformed searches", () => {
    expect(() => parsePageRequest({ tab: "admin" })).toThrow();
    expect(() => parsePageRequest({ search: {} })).toThrow();
  });
});