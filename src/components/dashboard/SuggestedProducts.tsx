import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, ShoppingBag, Sparkles, Package, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// ─── Types ────────────────────────────────────────────────────────────────────
type SuggestedProduct = {
  id: string;
  title: string;
  category: string | null;
  cost_price: number;
  suggested_price: number;
  margin_percent: number;
  orders_count: number | null;
  images: Json | null;
  created_at: string | null;
};

type FilterKey = "todos" | "maior-margem" | "mais-vendidos" | "recentes";

const FILTERS: Array<{ key: FilterKey; label: string; icon: React.ReactNode }> = [
  { key: "todos", label: "Todos", icon: <Sparkles className="h-3 w-3" /> },
  { key: "maior-margem", label: "Maior margem", icon: <TrendingUp className="h-3 w-3" /> },
  { key: "mais-vendidos", label: "Mais vendidos", icon: <ShoppingBag className="h-3 w-3" /> },
  { key: "recentes", label: "Recém adicionados", icon: <Package className="h-3 w-3" /> },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getFirstImage = (images: Json | null): string | null => {
  try {
    if (!images) return null;
    const parsed = typeof images === "string" ? JSON.parse(images) : images;
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
      return parsed[0];
    }
    return null;
  } catch {
    return null;
  }
};

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

// ─── Vitrine Card ─────────────────────────────────────────────────────────────
// Layout: imagem ocupa ~70% da altura do card (grande, cover), faixa de info
// compacta por baixo. Estilo flat e editorial, sem sombra pesada.
const VitrineCard = ({
  product,
  onClick,
}: {
  product: SuggestedProduct;
  onClick: () => void;
}) => {
  const imageUrl = getFirstImage(product.images);
  const [imgFailed, setImgFailed] = useState(false);
  const margin = Math.round(product.margin_percent);
  const price = product.suggested_price > 0 ? product.suggested_price : product.cost_price;

  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="group relative flex flex-col rounded-2xl overflow-hidden cursor-pointer bg-white border border-black/[0.06] transition-all duration-200 hover:shadow-[0_16px_48px_rgba(0,0,0,0.10)] hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
      aria-label={`Ver produto: ${product.title}`}
    >
      {/* ── Área da imagem com padding interno ("moldura") ── */}
      <div className="relative p-3 pb-0">
        <div className="relative h-[200px] w-full overflow-hidden rounded-xl bg-neutral-100">
          {imageUrl && !imgFailed ? (
            <img
              src={imageUrl}
              alt={product.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-100">
              <Package className="h-12 w-12 text-neutral-300" strokeWidth={1.2} />
            </div>
          )}

          {/* Overlay gradiente sutil na base da imagem */}
          <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />

          {/* Badge de categoria — canto superior esquerdo */}
          {product.category && (
            <span className="absolute top-2.5 left-2.5 inline-flex items-center rounded-full bg-white/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm border border-white/60">
              {product.category}
            </span>
          )}

          {/* Badge de margem — canto superior direito */}
          {margin > 0 && (
            <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              <TrendingUp className="h-2.5 w-2.5" />
              {margin}%
            </span>
          )}

          {/* Ícone de acesso no hover */}
          <div className="absolute bottom-2.5 right-2.5 h-7 w-7 rounded-full bg-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-md">
            <ArrowUpRight className="h-3.5 w-3.5 text-neutral-900" />
          </div>
        </div>
      </div>

      {/* ── Faixa de informações (compacta) ── */}
      <div className="px-4 py-3.5 flex items-center justify-between gap-3 min-h-0">
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-semibold text-neutral-900 leading-snug line-clamp-1 truncate">
            {product.title}
          </h3>
          {product.orders_count != null && product.orders_count > 0 && (
            <p className="text-[11px] text-neutral-400 mt-0.5 leading-none">
              {product.orders_count.toLocaleString("pt-BR")} pedidos
            </p>
          )}
        </div>
        <strong className="shrink-0 text-[15px] font-bold text-neutral-900 tracking-tight">
          {formatBRL(price)}
        </strong>
      </div>
    </article>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const VitrineSkeleton = () => (
  <div className="rounded-2xl overflow-hidden border border-black/[0.06] bg-white">
    <div className="p-3 pb-0">
      <div className="h-[200px] w-full rounded-xl bg-neutral-100 skeleton-pulse" />
    </div>
    <div className="px-4 py-3.5 flex items-center justify-between gap-3">
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-3.5 w-3/5 rounded bg-neutral-100 skeleton-pulse" />
        <div className="h-2.5 w-1/3 rounded bg-neutral-100 skeleton-pulse" />
      </div>
      <div className="h-5 w-16 rounded bg-neutral-100 skeleton-pulse shrink-0" />
    </div>
  </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = () => (
  <div className="col-span-full flex flex-col items-center justify-center py-20 px-6 text-center gap-4">
    <div className="h-14 w-14 rounded-2xl bg-neutral-100 flex items-center justify-center">
      <Package className="h-7 w-7 text-neutral-400" strokeWidth={1.4} />
    </div>
    <p className="text-[14px] font-medium text-neutral-500 max-w-[360px] leading-relaxed">
      Nenhum produto disponível no catálogo ainda.{" "}
      <span className="text-neutral-900 font-semibold">
        Pergunte ao Atlas quais produtos importar para começar.
      </span>
    </p>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const SuggestedProducts = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("todos");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["home-suggested-products"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SuggestedProduct[]> => {
      const { data, error } = await supabase
        .from("catalog_products" as never)
        .select(
          "id, title, category, cost_price, suggested_price, margin_percent, orders_count, images, created_at"
        )
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        .limit(24);

      if (error) throw error;
      return (data ?? []) as SuggestedProduct[];
    },
  });

  const filtered = (() => {
    const base = [...products];
    switch (activeFilter) {
      case "maior-margem":
        return base.sort((a, b) => b.margin_percent - a.margin_percent).slice(0, 6);
      case "mais-vendidos":
        return base.sort((a, b) => (b.orders_count ?? 0) - (a.orders_count ?? 0)).slice(0, 6);
      case "recentes":
        return base
          .sort((a, b) => {
            const da = new Date(a.created_at ?? 0).getTime();
            const db = new Date(b.created_at ?? 0).getTime();
            return db - da;
          })
          .slice(0, 6);
      default:
        // "todos": score combinado margem (60%) + pedidos (40%)
        return base
          .sort((a, b) => {
            const sA = a.margin_percent * 0.6 + (a.orders_count ?? 0) * 0.4;
            const sB = b.margin_percent * 0.6 + (b.orders_count ?? 0) * 0.4;
            return sB - sA;
          })
          .slice(0, 6);
    }
  })();

  const handleProductClick = (product: SuggestedProduct) => {
    navigate("/dashboard/catalogo", { state: { highlightId: product.id } });
  };

  return (
    <section className="w-full">
      {/* ── Cabeçalho da seção ── */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-[16px] font-bold text-neutral-800 tracking-tight">
          Produtos sugeridos
        </h2>
        <button
          onClick={() => navigate("/dashboard/catalogo")}
          className="text-[12px] font-semibold text-neutral-500 hover:text-neutral-900 transition-colors inline-flex items-center gap-1"
        >
          Ver catálogo completo
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Pills de filtro ── */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-100 border ${
              activeFilter === f.key
                ? "bg-neutral-900 text-white border-neutral-900 shadow-sm"
                : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400 hover:text-neutral-900"
            }`}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Grid vitrine — 3 colunas em desktop, 2 em tablet, 1 em mobile ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <VitrineSkeleton key={i} />)
          : filtered.length === 0
          ? <EmptyState />
          : filtered.map((p) => (
              <VitrineCard
                key={p.id}
                product={p}
                onClick={() => handleProductClick(p)}
              />
            ))}
      </div>
    </section>
  );
};

export default SuggestedProducts;
