import { beforeEach, describe, expect, it } from "vitest";
import { initMetaPixel, trackPixel } from "./metaPixel";
import {
  medirMetaVelo,
  metaVeloCadastroConcluido,
  metaVeloCliqueCadastro,
  metaVeloCompraConcluida,
  metaVeloInicioCheckout,
  rotaTemPixelMeta,
  VELO_META_PIXEL_ID,
} from "./veloMetaPixel";

const w = window as unknown as Record<string, unknown>;
const queue = () => (w.fbq as { queue: unknown[][] }).queue;
const eventosVelo = () =>
  queue().filter((a) => String(a[0]).startsWith("trackSingle") && a[1] === VELO_META_PIXEL_ID).map((a) => a[2]);

beforeEach(() => {
  for (const key of ["fbq", "_fbq", "__veloMetaPixels", "__veloSellerMetaPixels"]) delete w[key];
  document.head.innerHTML = "";
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: false });
});

describe("pixel dos anúncios da Velo", () => {
  it("usa o ID 2170225700534826", () => {
    expect(VELO_META_PIXEL_ID).toBe("2170225700534826");
  });

  it("mede visitas e cadastro somente no pixel da Velo, mesmo com um seller inicializado", () => {
    const seller = "1234567890123456";
    initMetaPixel(seller);
    medirMetaVelo("PageView");
    medirMetaVelo("CompleteRegistration", { status: true });
    trackPixel("Purchase", { currency: "BRL", value: 10 });
    expect(queue()).toContainEqual(["trackSingle", VELO_META_PIXEL_ID, "CompleteRegistration", { status: true }]);
    expect(queue()).toContainEqual(["trackSingle", seller, "Purchase", { currency: "BRL", value: 10 }]);
    expect(queue().filter((args) => args[0] === "track")).toHaveLength(0);
    expect(queue().filter((args) => args[1] === VELO_META_PIXEL_ID && args[2] === "Purchase")).toHaveLength(0);
    expect(document.querySelectorAll("#meta-pixel-base")).toHaveLength(1);
  });

  it("roda na landing, cadastro e checkout de assinatura; não nas lojas nem no painel", () => {
    for (const path of ["/", "/login", "/cadastro", "/checkout", "/assinatura/confirmada"]) {
      expect(rotaTemPixelMeta(path)).toBe(true);
    }
    for (const path of ["/loja/teste", "/store/teste", "/dashboard", "/preview/teste"]) {
      expect(rotaTemPixelMeta(path)).toBe(false);
      window.history.replaceState({}, "", path);
      medirMetaVelo("PageView");
    }
    expect(w.fbq).toBeUndefined();
  });

  it("respeita a recusa do navegador (Global Privacy Control), até nos eventos forçados", () => {
    window.history.replaceState({}, "", "/cadastro");
    Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: true });
    medirMetaVelo("PageView");
    metaVeloInicioCheckout({ plano: "pro", ciclo: "monthly", valor: 79.8 });
    expect(w.fbq).toBeUndefined();
  });

  it("inicializa uma vez, desliga o PageView automático e mede eventos personalizados", () => {
    medirMetaVelo("PageView");
    window.history.replaceState({}, "", "/cadastro");
    medirMetaVelo("PageView");
    expect(queue().filter((args) => args[0] === "init")).toEqual([["init", VELO_META_PIXEL_ID]]);
    expect((w.fbq as { disablePushState?: boolean }).disablePushState).toBe(true);
    expect(queue().filter((args) => args[2] === "PageView")).toHaveLength(2);
    medirMetaVelo("landing_clique_criar_conta", { local: "hero" }, true);
    expect(queue()).toContainEqual(["trackSingleCustom", VELO_META_PIXEL_ID, "landing_clique_criar_conta", { local: "hero" }]);
  });

  it("Lead, cadastro com eventID, checkout no painel e compra uma vez só", () => {
    metaVeloCliqueCadastro("cta_hero_signup_click");
    metaVeloCadastroConcluido("user-1");
    window.history.replaceState({}, "", "/dashboard"); // modal de planos do painel
    metaVeloInicioCheckout({ plano: "pro", ciclo: "monthly", valor: 79.8 });
    window.history.replaceState({}, "", "/assinatura/confirmada");
    metaVeloCompraConcluida();
    metaVeloCompraConcluida(); // F5
    expect(eventosVelo()).toEqual(["Lead", "CompleteRegistration", "InitiateCheckout", "Purchase", "Subscribe"]);
    const cadastro = queue().find((a) => a[2] === "CompleteRegistration")!;
    expect(cadastro[4]).toEqual({ eventID: "cadastro_user-1" });
    const compra = queue().find((a) => a[2] === "Purchase")!;
    expect(compra[3]).toMatchObject({ value: 79.8, currency: "BRL", content_ids: ["velo_pro_monthly"] });
  });

  it("vitalício conta Purchase sem Subscribe", () => {
    metaVeloInicioCheckout({ plano: "base", ciclo: "lifetime", valor: 89.9 });
    metaVeloCompraConcluida();
    expect(eventosVelo()).toEqual(["InitiateCheckout", "Purchase"]);
  });

  it("sem checkout iniciado não conta compra", () => {
    window.history.replaceState({}, "", "/assinatura/confirmada");
    medirMetaVelo("PageView");
    metaVeloCompraConcluida();
    expect(eventosVelo()).toEqual(["PageView"]);
  });

  it("cadastro pelo Google mede mesmo fora das rotas do pixel", () => {
    window.history.replaceState({}, "", "/dashboard");
    metaVeloCadastroConcluido("user-2", { forcar: true });
    expect(eventosVelo()).toEqual(["CompleteRegistration"]);
  });
});
