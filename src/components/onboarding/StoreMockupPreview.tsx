import { useEffect, useState } from "react";
import { Search, ShoppingBag, Star } from "lucide-react";

type ExampleProduct = { id: string; title: string; price: number; imageUrl: string };

export interface StorePreviewData {
  storeName?: string;
  product?: ExampleProduct | null;
  language?: string;
  persona?: string;
  angle?: string;
}

// Reads session-storage state written by the onboarding pages.
function readSession(): StorePreviewData {
  if (typeof window === "undefined") return {};
  try {
    const storedProduct = sessionStorage.getItem("velo-example-product");
    return {
      storeName: sessionStorage.getItem("velo-store-name") || undefined,
      product: storedProduct ? (JSON.parse(storedProduct) as ExampleProduct) : null,
      language: sessionStorage.getItem("velo-store-language") || undefined,
      persona: sessionStorage.getItem("velo-customer-persona") || undefined,
      angle: sessionStorage.getItem("velo-sales-angle") || undefined,
    };
  } catch {
    return {};
  }
}

interface Props {
  /** Override any field; falls back to sessionStorage otherwise */
  override?: Partial<StorePreviewData>;
  /** Custom tooltip label; defaults to `Exemplo de loja {storeName || "Velo"}` */
  tooltipLabel?: string;
  className?: string;
}

/**
 * Dark phone-frame mockup with a floating "Exemplo de loja …" tooltip.
 * Content fills in progressively as onboarding answers arrive.
 */
const StoreMockupPreview = ({ override, tooltipLabel, className }: Props) => {
  const [state, setState] = useState<StorePreviewData>(() => ({ ...readSession(), ...override }));

  useEffect(() => {
    setState({ ...readSession(), ...override });
    // React to storage changes from sibling tabs / other components
    const handler = () => setState({ ...readSession(), ...override });
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [override?.storeName, override?.product?.id, override?.language, override?.persona, override?.angle]);

  const displayName =
    (override?.storeName ?? state.storeName ?? "").trim() || "Velo";
  const label = tooltipLabel ?? `Exemplo de loja ${displayName}`;

  const product = override?.product ?? state.product ?? null;
  const persona = override?.persona ?? state.persona ?? null;
  const angle = override?.angle ?? state.angle ?? null;
  const language = override?.language ?? state.language ?? null;

  const hasProduct = Boolean(product);
  const priceLabel = product ? `R$ ${product.price.toFixed(2).replace(".", ",")}` : null;

  return (
    <div className={`relative flex flex-col items-center ${className ?? ""}`}>
      <div className="pointer-events-none absolute left-1/2 top-[585px] h-[54px] w-[245px] -translate-x-1/2 rounded-full bg-black/24 blur-[20px]" />
      {/* Tooltip */}
      <div className="relative z-20 mb-3">
        <div className="rounded-[10px] bg-[#232323] px-4 py-2 text-[16px] font-medium text-white shadow-[0_18px_34px_rgba(0,0,0,0.36),0_7px_18px_rgba(0,0,0,0.28)] ring-1 ring-white/10">
          {label}
        </div>
        <div
          className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2"
          style={{
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            borderTop: "7px solid #232323",
          }}
        />
      </div>

      {/* Phone frame */}
      <div className="relative z-10 h-[560px] w-[280px] rounded-[36px] bg-[#1a1a1a] p-[6px] shadow-[0_24px_42px_rgba(0,0,0,0.28),0_8px_18px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.06)]">
        {/* Notch */}
        <div className="pointer-events-none absolute left-1/2 top-[6px] z-10 h-[18px] w-[92px] -translate-x-1/2 rounded-b-2xl bg-[#1a1a1a]" />
        <div className="pointer-events-none absolute left-[calc(50%+26px)] top-[10px] z-20 h-[6px] w-[6px] rounded-full bg-[#333]" />

        {/* Screen */}
        <div className="relative h-full w-full overflow-hidden rounded-[30px] bg-[#1c1c20]">
          {/* iOS-like status bar */}
          <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[9px] font-semibold text-white/80">
            <span>9:41</span>
            <span />
            <span>●●●</span>
          </div>

          {/* Store header */}
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#131316]">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold leading-tight text-white">
                  {displayName.toLowerCase()}.store
                </span>
                <span className="text-[8.5px] text-white/45">
                  {language ? `Idioma · ${language}` : "sua vitrine"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <Search size={12} />
              <ShoppingBag size={12} />
            </div>
          </div>

          {/* Search */}
          <div className="mx-4 mb-3 flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2 py-1.5">
            <Search size={10} className="text-white/40" />
            <span className="text-[9.5px] text-white/40">Buscar produtos</span>
          </div>

          {/* Hero / product spotlight */}
          <div
            className="mx-4 mb-3 flex items-end justify-between overflow-hidden rounded-xl transition-all duration-500"
            style={{
              minHeight: 96,
              background: hasProduct
                ? "linear-gradient(135deg, #2a2a30 0%, #0c0c0e 140%)"
                : "#232327",
            }}
          >
            {hasProduct ? (
              <>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  {angle && (
                    <span className="w-fit rounded-full bg-white/90 px-1.5 py-[2px] text-[7.5px] font-bold uppercase tracking-wide text-[#131316]">
                      {angle.slice(0, 22)}
                    </span>
                  )}
                  <span className="line-clamp-2 text-[12px] font-bold leading-tight text-white drop-shadow-sm">
                    {product?.title}
                  </span>
                  <span className="text-[9px] font-semibold text-white/90">{priceLabel}</span>
                </div>
                <img
                  src={product?.imageUrl}
                  alt=""
                  className="h-[86px] w-[86px] shrink-0 rounded-tr-xl object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-white/25">
                aguardando produto
              </div>
            )}
          </div>

          {/* Persona chip */}
          {persona && (
            <div className="mx-4 mb-3 flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2 py-1.5 text-[8.5px] font-medium text-white/70">
              <span className="text-[10px]">🎯</span>
              <span className="truncate">Para {persona.toLowerCase()}</span>
            </div>
          )}

          {/* Section */}
          <div className="mb-2 flex items-center justify-between px-4">
            <span className="text-[10px] font-bold text-white">
              {hasProduct ? "Mais vendidos" : "Produtos em breve"}
            </span>
            <span className="text-[8.5px] font-semibold text-white/50">Ver todos</span>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-2 px-4">
            {[0, 1, 2, 3].map((i) => {
              const active = hasProduct;
              return (
                <div
                  key={i}
                  className="overflow-hidden rounded-lg bg-[#232327] ring-1 ring-white/[0.06] transition-all duration-500"
                  style={{ opacity: active ? 1 : 0.4 }}
                >
                  <div
                    className="h-[54px] w-full bg-cover bg-center"
                    style={{
                      background:
                        active && product?.imageUrl
                          ? `url(${product.imageUrl}) center/cover`
                          : "linear-gradient(135deg,#2a2a30,#17171a)",
                    }}
                  />
                  <div className="flex flex-col gap-[2px] px-1.5 py-1.5">
                    <span className="truncate text-[9px] font-semibold text-white">
                      {active ? product?.title : "————"}
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-white">
                        {active ? priceLabel : "R$ —"}
                      </span>
                      <div className="flex items-center gap-[1px] text-white/50">
                        <Star size={7} fill="currentColor" strokeWidth={0} />
                        <span className="text-[7.5px] font-medium">4.9</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Home indicator */}
          <div className="absolute inset-x-0 bottom-1 flex justify-center">
            <div className="h-[3px] w-16 rounded-full bg-white/25" />
          </div>
        </div>
      </div>

      {/* Progress dots below the phone */}
      <div className="mt-4 flex items-center gap-1.5">
        {[
          Boolean(product),
          Boolean(language),
          Boolean(persona),
          Boolean(angle),
        ].map((filled, i) => (
          <div
            key={i}
            className="h-[3px] w-6 rounded-full transition-colors duration-300"
            style={{ background: filled ? "#f5f5f7" : "rgba(255,255,255,0.12)" }}
          />
        ))}
      </div>
    </div>
  );
};

export default StoreMockupPreview;
