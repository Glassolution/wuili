import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, ShoppingBag, Sparkles, Package } from "lucide-react";
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
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// ─── Product Card ─────────────────────────────────────────────────────────────
const SuggestedCard = ({
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
      className="group relative flex flex-col rounded-[18px] border border-black/[0.06] bg-white overflow-hidden cursor-pointer transition-all duration-150 hover:shadow-[0_8px_28px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
      aria-label={`Ver produto: ${product.title}`}
    >
      {/* Imagem */}
      <div className="relative h-[160px] bg-neutral-100 flex items-center justify-center overflow-hidden">
        {imageUrl && !imgFailed ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-neutral-100">
            <Package className="h-10 w-10 text-neutral-300" strokeWidth={1.2} />
          </div>
        )}

        {/* Badge de margem */}
        {margin > 0 && (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 shadow-sm border border-emerald-100">
            <TrendingUp className="h-2.5 w-2.5" />
            {margin}%
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-3.5 flex flex-col gap-1.5 flex-1">
        {product.category && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            {product.category}
          </span>
        )}
        <h3 className="text-[13px] font-semibold text-neutral-900 leading-snug line-clamp-2 flex-1">
          {product.title}
        </h3>
        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          <strong className="text-[14px] font-bold text-neutral-900 tracking-tight">
            {formatBRL(price)}
          </strong>
          {product.orders_count != null && product.orders_count > 0 && (
            <span className="text-[10px] font-medium text-neutral-400">
              {product.orders_count.toLocaleString("pt-BR")} pedidos
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SuggestedCardSkeleton = () => (
  <div className="rounded-[18px] border border-black/[0.06] bg-white overflow-hidden">
    <div className="h-[160px] bg-neutral-100 skeleton-pulse" />
    <div className="p-3.5 flex flex-col gap-2">
      <div className="h-2.5 w-16 rounded bg-neutral-100 skeleton-pulse" />
      <div className="h-4 w-4/5 rounded bg-neutral-100 skeleton-pulse" />
      <div className="h-4 w-3/5 rounded bg-neutral-100 skeleton-pulse" />
      <div className="h-5 w-24 rounded bg-neutral-100 skeleton-pulse mt-1" />
    </div>
  </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = () => (
  <div className="col-span-full flex flex-col items-center justify-center py-12 px-6 text-center gap-3">
    <div className="h-12 w-12 rounded-2xl bg-neutral-100 flex items-center justify-center">
      <Package className="h-6 w-6 text-neutral-400" strokeWidth={1.4} />
    </div>
    <p className="text-[14px] font-medium text-neutral-600 max-w-[320px] leading-relaxed">
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
        .select("id, title, category, cost_price, suggested_price, margin_percent, orders_count, images, created_at")
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
        return base
          .sort((a, b) => (b.orders_count ?? 0) - (a.orders_count ?? 0))
          .slice(0, 6);
      case "recentes":
        return base
          .sort((a, b) => {
            const da = new Date(a.created_at ?? 0).getTime();
            const db_ = new Date(b.created_at ?? 0).getTime();
            return db_ - da;
          })
          .slice(0, 6);
      default:
        // "todos": combina margem + pedidos para ranking geral
        return base
          .sort((a, b) => {
            const scoreA = a.margin_percent * 0.6 + (a.orders_count ?? 0) * 0.4;
            const scoreB = b.margin_percent * 0.6 + (b.orders_count ?? 0) * 0.4;
            return scoreB - scoreA;
          })
          .slice(0, 6);
    }
  })();

  const handleProductClick = (product: SuggestedProduct) => {
    navigate(`/dashboard/catalogo`, { state: { highlightId: product.id } });
  };

  return (
    <section className="mt-10 w-full max-w-[760px] mx-auto">
      {/* Header da seção */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-[15px] font-bold text-neutral-800 tracking-tight">
          Produtos sugeridos
        </h2>
        <button
          onClick={() => navigate("/dashboard/catalogo")}
          className="text-[12px] font-semibold text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          Ver catálogo completo →
        </button>
      </div>

      {/* Pills de filtro */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-100 border ${
              activeFilter === f.key
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400 hover:text-neutral-900"
            }`}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid de produtos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SuggestedCardSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          filtered.map((p) => (
            <SuggestedCard key={p.id} product={p} onClick={() => handleProductClick(p)} />
          ))
        )}
      </div>
    </section>
  );
};

export default SuggestedProducts;
