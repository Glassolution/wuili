import { describe, it, expect, beforeEach, vi } from "vitest";
import { initMetaPixel, isValidPixelId, normalizePixelId, trackPixel } from "./metaPixel";

const w = window as unknown as Record<string, unknown>;

function resetPixel() {
  delete w.fbq;
  delete w._fbq;
  delete w.__veloMetaPixels;
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  // o script base é inserido antes do primeiro <script> existente
  document.head.appendChild(document.createElement("script"));
}

describe("metaPixel", () => {
  beforeEach(resetPixel);

  it("valida apenas IDs numéricos de 10 a 20 dígitos", () => {
    expect(isValidPixelId("1234567890")).toBe(true);
    expect(isValidPixelId("12345678901234567890")).toBe(true);
    expect(isValidPixelId("123456789")).toBe(false);
    expect(isValidPixelId("123456789012345678901")).toBe(false);
    expect(isValidPixelId("abc1234567890")).toBe(false);
    expect(isValidPixelId("")).toBe(false);
    expect(isValidPixelId(null)).toBe(false);
    expect(normalizePixelId("12ab34-56")).toBe("123456");
  });

  it("não injeta script nem quebra quando o campo está vazio ou inválido", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      initMetaPixel(null);
      initMetaPixel(undefined);
      initMetaPixel("");
      initMetaPixel("123");
      trackPixel("ViewContent", { value: 10 });
    }).not.toThrow();
    expect(document.getElementById("meta-pixel-base")).toBeNull();
    expect(w.fbq).toBeUndefined();
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("injeta o script base async e dispara PageView com ID válido", () => {
    initMetaPixel("1234567890123456");
    const script = document.getElementById("meta-pixel-base") as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script!.async).toBe(true);
    expect(script!.src).toContain("connect.facebook.net");
    const queue = (w.fbq as { queue: unknown[][] }).queue;
    expect(queue).toContainEqual(["init", "1234567890123456"]);
    expect(queue).toContainEqual(["track", "PageView"]);
  });

  it("é idempotente entre re-renders (um script, um init)", () => {
    initMetaPixel("1234567890123456");
    initMetaPixel("1234567890123456");
    initMetaPixel("1234567890123456");
    expect(document.querySelectorAll("#meta-pixel-base").length).toBe(1);
    const queue = (w.fbq as { queue: unknown[][] }).queue;
    expect(queue.filter((a) => a[0] === "init").length).toBe(1);
    expect(queue.filter((a) => a[0] === "track" && a[1] === "PageView").length).toBe(1);
  });

  it("dispara os eventos do funil com SKU, valor e BRL", () => {
    initMetaPixel("1234567890123456");
    trackPixel("ViewContent", { content_ids: ["sku-1"], content_type: "product", value: 99.9, currency: "BRL" });
    trackPixel("InitiateCheckout", { value: 199.8, currency: "BRL", content_ids: ["sku-1"], num_items: 2 });
    trackPixel("Purchase", { value: 199.8, currency: "BRL", content_ids: ["sku-1"], content_type: "product" });
    const queue = (w.fbq as { queue: unknown[][] }).queue;
    const events = queue.filter((a) => a[0] === "track").map((a) => a[1]);
    expect(events).toEqual(["PageView", "ViewContent", "InitiateCheckout", "Purchase"]);
    for (const a of queue.filter((a) => a[0] === "track" && a[1] !== "PageView")) {
      const p = a[2] as Record<string, unknown>;
      expect(p.currency).toBe("BRL");
      expect(typeof p.value).toBe("number");
      expect(p.content_ids).toEqual(["sku-1"]);
    }
  });
});
