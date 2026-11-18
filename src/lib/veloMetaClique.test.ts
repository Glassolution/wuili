import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAVE_CLIQUE_META, capturarCliqueMeta, lerCliqueMeta } from "./veloMetaClique";

function limparCookies() {
  for (const nome of ["_fbp", "_fbc"]) document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  limparCookies();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("clique do anúncio da Meta", () => {
  it("sem fbclid não guarda nada", () => {
    capturarCliqueMeta();
    expect(window.localStorage.getItem(CHAVE_CLIQUE_META)).toBeNull();
  });

  it("guarda fbclid, monta _fbc quando falta e completa o _fbp depois", () => {
    vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
    window.history.replaceState({}, "", "/?fbclid=TESTE");
    capturarCliqueMeta();
    expect(lerCliqueMeta()).toEqual({
      fbclid: "TESTE",
      fbp: null,
      fbc: `fb.1.${Date.parse("2026-11-18T12:00:00Z")}.TESTE`,
      captured_at: "2026-11-18T12:00:00.000Z",
    });
    document.cookie = "_fbp=fb.1.111.222; path=/";
    vi.advanceTimersByTime(3000);
    expect(lerCliqueMeta()?.fbp).toBe("fb.1.111.222");
  });

  it("usa os cookies da Meta quando existem e um fbclid novo sobrescreve", () => {
    document.cookie = "_fbp=fb.1.1.2; path=/";
    document.cookie = "_fbc=fb.1.5.ANTIGO; path=/";
    window.history.replaceState({}, "", "/cadastro?fbclid=ANTIGO");
    capturarCliqueMeta();
    expect(lerCliqueMeta()).toMatchObject({ fbclid: "ANTIGO", fbp: "fb.1.1.2", fbc: "fb.1.5.ANTIGO" });
    window.history.replaceState({}, "", "/?fbclid=NOVO");
    capturarCliqueMeta(); // cookie _fbc ainda é do clique antigo
    expect(lerCliqueMeta()?.fbclid).toBe("NOVO");
    expect(lerCliqueMeta()?.fbc).toMatch(/^fb\.1\.\d+\.NOVO$/);
  });

  it("localStorage bloqueado não quebra a página", () => {
    window.history.replaceState({}, "", "/?fbclid=X");
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => capturarCliqueMeta()).not.toThrow();
    set.mockRestore();
  });
});
