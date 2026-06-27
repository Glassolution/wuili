import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
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

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "maior-margem", label: "Maior margem" },
  { key: "mais-vendidos", label: "Mais vendidos" },
  { key: "recentes", label: "Recém adicionados" },
];

// ─── Shared fade-up variant ───────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

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
const VitrineCard = ({
  product,
  onClick,
  delay,
}: {
  product: SuggestedProduct;
  onClick: () => void;
  delay: number;
}) => {
  const imageUrl = getFirstImage(product.images);
  const [imgFailed, setImgFailed] = useState(false);

  const margin = Math.round(product.margin_percent);
  const price = product.suggested_price > 0 ? product.suggested_price : product.cost_price;

  const AvatarIcon =
    margin >= 40 ? TrendingUp : (product.orders_count ?? 0) >= 100 ? ShoppingBag : Sparkles;

  return (
    <motion.article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="group relative flex flex-col rounded-[20px] overflow-hidden cursor-pointer border border-neutral-100 bg-white shadow-[0_2px_14px_rgba(0,0,0,0.07)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.13)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
      aria-label={`Ver produto: ${product.title}`}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      custom={delay}
    >
      {/* ── ZONA 1: Imagem com respiro interno ── */}
      <div className="relative px-4 pt-4 pb-2 flex items-center justify-center bg-white" style={{ minHeight: 200 }}>
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 z-10 pointer-events-none">
          {product.category ? (
            <span className="inline-flex items-center rounded-full bg-white/80 backdrop-blur-sm px-2.5 py-[3px] text-[10px] font-normal tracking-wide text-neutral-600 border border-neutral-200 shadow-sm">
              {product.category}
            </span>
          ) : <span />}

          {margin > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 backdrop-blur-sm px-2.5 py-[3px] text-[10px] font-medium text-emerald-700 border border-neutral-200 shadow-sm">
              <TrendingUp className="h-2.5 w-2.5" />
              {margin}%
            </span>
          )}
        </div>

        {imageUrl && !imgFailed ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="relative z-0 w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
            style={{ maxHeight: 180, height: 160 }}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex items-center justify-center h-[160px] w-full">
            <Package className="h-14 w-14 text-neutral-300" strokeWidth={1.2} />
          </div>
        )}
      </div>

      {/* ── ZONA 2: Faixa de informação ── */}
      <div className="px-4 pt-2.5 pb-4 flex items-center gap-2.5 bg-white border-t border-neutral-100">
        <div className="min-w-0 flex-1">
          <h3 className="text-[12.5px] font-medium leading-snug line-clamp-1 truncate text-neutral-900">
            {product.title}
          </h3>
          <p className="text-[11px] font-semibold mt-0.5 leading-none tracking-tight text-neutral-900">
            {formatBRL(price)}
            {product.orders_count != null && product.orders_count > 0 && (
              <span className="ml-1.5 font-normal text-[10px] text-neutral-400">
                · {product.orders_count.toLocaleString("pt-BR")} pedidos
              </span>
            )}
          </p>
        </div>

        <div
          className="shrink-0 h-7 w-7 rounded-full grid place-items-center transition-transform duration-200 group-hover:scale-110 bg-neutral-100 text-neutral-600"
          title={
            margin >= 40
              ? "Alta margem"
              : (product.orders_count ?? 0) >= 100
              ? "Mais vendido"
              : "Sugestão"
          }
        >
          <AvatarIcon className="h-3.5 w-3.5" />
        </div>
      </div>
    </motion.article>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const VitrineSkeleton = ({ delay }: { delay: number }) => (
  <motion.div
    className="rounded-[20px] overflow-hidden bg-white border border-neutral-100 shadow-[0_2px_14px_rgba(0,0,0,0.05)]"
    variants={fadeUp}
    initial="hidden"
    animate="visible"
    custom={delay}
  >
    <div className="px-4 pt-4 pb-2 h-[200px] skeleton-pulse bg-neutral-100" />
    <div className="px-4 pt-2.5 pb-4 border-t border-neutral-100 flex items-center gap-2.5 bg-white">
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="h-3 w-3/5 rounded-full bg-neutral-200 skeleton-pulse" />
        <div className="h-2.5 w-1/3 rounded-full bg-neutral-200 skeleton-pulse" />
      </div>
      <div className="h-7 w-7 rounded-full bg-neutral-200 skeleton-pulse shrink-0" />
    </div>
  </motion.div>
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
// initialDelay: ponto de partida do stagger (em segundos)
// 0.3s → header+pills, cards a partir de 0.4s com 50ms entre cada um
const SuggestedProducts = ({ initialDelay = 0 }: { initialDelay?: number }) => {
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

  // Delays: header = initialDelay, pills = initialDelay + 0.05
  // cards/skeletons = initialDelay + 0.1 + (index * 0.05)
  const headerDelay = initialDelay;
  const pillsDelay = initialDelay + 0.05;
  const cardBaseDelay = initialDelay + 0.1;
  const cardStep = 0.05;

  return (
    <section className="w-full">
      {/* ── Cabeçalho ── */}
      <motion.div
        className="flex items-center justify-between gap-4 mb-4"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={headerDelay}
      >
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
      </motion.div>

      {/* ── Pills de filtro ── */}
      <motion.div
        className="flex items-center gap-1.5 mb-6 flex-wrap"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={pillsDelay}
      >
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition-all duration-100 ${
              activeFilter === f.key
                ? "bg-white text-neutral-900 shadow-sm"
                : "bg-neutral-200/70 text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </motion.div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <VitrineSkeleton key={i} delay={cardBaseDelay + i * cardStep} />
            ))
          : filtered.length === 0
          ? <EmptyState />
          : filtered.map((p, i) => (
              <VitrineCard
                key={p.id}
                product={p}
                onClick={() => handleProductClick(p)}
                delay={cardBaseDelay + i * cardStep}
              />
            ))}
      </div>
    </section>
  );
};

export default SuggestedProducts;
