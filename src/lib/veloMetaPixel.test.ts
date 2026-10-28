import { beforeEach, describe, expect, it } from "vitest";
import { initMetaPixel, trackPixel } from "./metaPixel";
import { medirMetaVelo, rotaTemPixelMeta, VELO_META_PIXEL_ID } from "./veloMetaPixel";

const w = window as unknown as Record<string, unknown>;
const queue = () => (w.fbq as { queue: unknown[][] }).queue;

beforeEach(() => {
  for (const key of ["fbq", "_fbq", "__veloMetaPixels", "__veloSellerMetaPixels"]) delete w[key];
  document.head.innerHTML = "";
  window.history.replaceState({}, "", "/");
  Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: false });
});

describe("pixel dos anúncios da Velo", () => {
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

  it("não inicia nas lojas, checkout ou painel e respeita recusa do navegador", () => {
    for (const path of ["/loja/teste", "/store/teste", "/checkout", "/dashboard", "/preview/teste"]) {
      expect(rotaTemPixelMeta(path)).toBe(false);
      window.history.replaceState({}, "", path);
      medirMetaVelo("PageView");
    }
    expect(w.fbq).toBeUndefined();
    window.history.replaceState({}, "", "/cadastro");
    Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: true });
    medirMetaVelo("PageView");
    expect(w.fbq).toBeUndefined();
  });

  it("inicializa uma vez e permite medir novas visitas da navegação", () => {
    medirMetaVelo("PageView");
    window.history.replaceState({}, "", "/cadastro");
    medirMetaVelo("PageView");
    expect(queue().filter((args) => args[0] === "init")).toEqual([["init", VELO_META_PIXEL_ID]]);
    expect(queue().filter((args) => args[2] === "PageView")).toHaveLength(2);
    medirMetaVelo("landing_clique_criar_conta", { local: "hero" }, true);
    expect(queue()).toContainEqual(["trackSingleCustom", VELO_META_PIXEL_ID, "landing_clique_criar_conta", { local: "hero" }]);
  });
});
