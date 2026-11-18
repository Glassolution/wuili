import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { update, filtros, resposta } = vi.hoisted(() => ({
  update: vi.fn(),
  filtros: vi.fn(),
  resposta: { error: null as { message: string } | null },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabela: string) => ({
      update: (campos: unknown) => {
        update(tabela, campos);
        return {
          eq: (...eqArgs: unknown[]) => ({
            is: (...isArgs: unknown[]) => {
              filtros(eqArgs, isArgs);
              return Promise.resolve(resposta);
            },
          }),
        };
      },
    }),
  },
}));

import { CHAVE_CLIQUE_META, capturarCliqueMeta, lerCliqueMeta, salvarCliqueMetaNoPerfil } from "./veloMetaClique";

function limparCookies() {
  for (const nome of ["_fbp", "_fbc"]) document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  limparCookies();
  window.history.replaceState({}, "", "/");
  update.mockClear();
  filtros.mockClear();
  resposta.error = null;
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

  it("grava o clique no perfil só se o perfil ainda não tiver um", async () => {
    vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
    document.cookie = "_fbp=fb.1.1.2; path=/";
    window.history.replaceState({}, "", "/?fbclid=TESTE");
    capturarCliqueMeta();
    await salvarCliqueMetaNoPerfil("user-1");
    expect(update).toHaveBeenCalledWith("profiles", {
      meta_fbclid: "TESTE",
      meta_fbc: `fb.1.${Date.parse("2026-11-18T12:00:00Z")}.TESTE`,
      meta_fbp: "fb.1.1.2",
      meta_click_captured_at: "2026-11-18T12:00:00.000Z",
    });
    expect(filtros).toHaveBeenCalledWith(["user_id", "user-1"], ["meta_fbclid", null]);
  });

  it("sem clique guardado não grava nada", async () => {
    await salvarCliqueMetaNoPerfil("user-1");
    expect(update).not.toHaveBeenCalled();
  });

  it("erro do banco (ex.: RLS) vira aviso e não quebra o cadastro", async () => {
    window.history.replaceState({}, "", "/?fbclid=TESTE");
    capturarCliqueMeta();
    resposta.error = { message: "new row violates row-level security policy" };
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(salvarCliqueMetaNoPerfil("user-1")).resolves.toBeUndefined();
    expect(aviso).toHaveBeenCalledWith("[medição] clique da Meta não gravado no perfil:", "new row violates row-level security policy");
    aviso.mockRestore();
  });
});
