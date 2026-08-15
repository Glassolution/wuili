import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowUpRight, Package } from "lucide-react";
import {
  TrendUp,
  ShoppingBag as PhShoppingBag,
  Sparkle as PhSparkle,
  DeviceMobile,
  Laptop,
  Television,
  Headphones,
  TShirt,
  Handbag,
  Baby,
  Heartbeat,
  Flower,
  ForkKnife,
  Barbell,
  GameController,
  Car,
  House,
  BookOpen,
  PawPrint,
  Gift,
  Cube,
} from "@phosphor-icons/react";
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

// ─── Mapeamento de categoria → ícone Duotone (Phosphor) ──────────────────────
// Phosphor Duotone: preenchimento com opacidade cria profundidade visual
// equivalente ao efeito "3D icon" sem arquivos externos

type CategoryIconEntry = {
  Icon: React.ElementType;
  color: string;       // cor primária do ícone
  bg: string;          // fundo do badge
};

const CATEGORY_ICON_MAP: Record<string, CategoryIconEntry> = {
  // Eletrônicos
  "eletrônicos":        { Icon: Laptop,         color: "#3B82F6", bg: "#EFF6FF" },
  "eletronicos":        { Icon: Laptop,         color: "#3B82F6", bg: "#EFF6FF" },
  "electronics":        { Icon: Laptop,         color: "#3B82F6", bg: "#EFF6FF" },
  "computadores":       { Icon: Laptop,         color: "#3B82F6", bg: "#EFF6FF" },
  "celulares":          { Icon: DeviceMobile,   color: "#6366F1", bg: "#EEF2FF" },
  "smartphones":        { Icon: DeviceMobile,   color: "#6366F1", bg: "#EEF2FF" },
  "telefones":          { Icon: DeviceMobile,   color: "#6366F1", bg: "#EEF2FF" },
  "tv":                 { Icon: Television,     color: "#0EA5E9", bg: "#F0F9FF" },
  "televisão":          { Icon: Television,     color: "#0EA5E9", bg: "#F0F9FF" },
  "audio":              { Icon: Headphones,     color: "#8B5CF6", bg: "#F5F3FF" },
  "áudio":              { Icon: Headphones,     color: "#8B5CF6", bg: "#F5F3FF" },
  "fones":              { Icon: Headphones,     color: "#8B5CF6", bg: "#F5F3FF" },
  // Moda
  "moda":               { Icon: TShirt,         color: "#EC4899", bg: "#FDF2F8" },
  "roupas":             { Icon: TShirt,         color: "#EC4899", bg: "#FDF2F8" },
  "vestuário":          { Icon: TShirt,         color: "#EC4899", bg: "#FDF2F8" },
  "fashion":            { Icon: TShirt,         color: "#EC4899", bg: "#FDF2F8" },
  "bolsas":             { Icon: Handbag,        color: "#F59E0B", bg: "#FFFBEB" },
  "acessórios":         { Icon: Handbag,        color: "#F59E0B", bg: "#FFFBEB" },
  // Beleza e Saúde
  "beleza":             { Icon: Flower,         color: "#F472B6", bg: "#FFF0F7" },
  "cosméticos":         { Icon: Flower,         color: "#F472B6", bg: "#FFF0F7" },
  "cuidados pessoais":  { Icon: Flower,         color: "#F472B6", bg: "#FFF0F7" },
  "saúde":              { Icon: Heartbeat,      color: "#EF4444", bg: "#FFF5F5" },
  "health":             { Icon: Heartbeat,      color: "#EF4444", bg: "#FFF5F5" },
  // Bebê
  "bebê":               { Icon: Baby,           color: "#FB923C", bg: "#FFF7ED" },
  "bebe":               { Icon: Baby,           color: "#FB923C", bg: "#FFF7ED" },
  "infantil":           { Icon: Baby,           color: "#FB923C", bg: "#FFF7ED" },
  "brinquedos":         { Icon: Baby,           color: "#FB923C", bg: "#FFF7ED" },
  // Casa
  "casa":               { Icon: House,          color: "#10B981", bg: "#ECFDF5" },
  "decoração":          { Icon: House,          color: "#10B981", bg: "#ECFDF5" },
  "cozinha":            { Icon: ForkKnife,      color: "#14B8A6", bg: "#F0FDFA" },
  "utensílios":         { Icon: ForkKnife,      color: "#14B8A6", bg: "#F0FDFA" },
  // Esporte
  "esporte":            { Icon: Barbell,        color: "#22C55E", bg: "#F0FDF4" },
  "esportes":           { Icon: Barbell,        color: "#22C55E", bg: "#F0FDF4" },
  "fitness":            { Icon: Barbell,        color: "#22C55E", bg: "#F0FDF4" },
  "academia":           { Icon: Barbell,        color: "#22C55E", bg: "#F0FDF4" },
  // Games
  "games":              { Icon: GameController, color: "#7C3AED", bg: "#F5F3FF" },
  "jogos":              { Icon: GameController, color: "#7C3AED", bg: "#F5F3FF" },
  "gamer":              { Icon: GameController, color: "#7C3AED", bg: "#F5F3FF" },
  // Automotivo
  "automotivo":         { Icon: Car,            color: "#64748B", bg: "#F8FAFC" },
  "automóveis":         { Icon: Car,            color: "#64748B", bg: "#F8FAFC" },
  "carros":             { Icon: Car,            color: "#64748B", bg: "#F8FAFC" },
  // Livros e Educação
  "livros":             { Icon: BookOpen,       color: "#D97706", bg: "#FFFBEB" },
  "educação":           { Icon: BookOpen,       color: "#D97706", bg: "#FFFBEB" },
  // Pet
  "pet":                { Icon: PawPrint,       color: "#F97316", bg: "#FFF7ED" },
  "animais":            { Icon: PawPrint,       color: "#F97316", bg: "#FFF7ED" },
  // Presentes
  "presentes":          { Icon: Gift,           color: "#A855F7", bg: "#FAF5FF" },
  "gift":               { Icon: Gift,           color: "#A855F7", bg: "#FAF5FF" },
};

// Fallback para categoria não mapeada
const FALLBACK_ICON: CategoryIconEntry = { Icon: Cube, color: "#6B7280", bg: "#F9FAFB" };

const getCategoryIcon = (category: string | null): CategoryIconEntry => {
  if (!category) return FALLBACK_ICON;
  const key = category.toLowerCase().trim();
  // Busca exata primeiro
  if (CATEGORY_ICON_MAP[key]) return CATEGORY_ICON_MAP[key];
  // Busca parcial: verifica se alguma chave está contida na categoria
  for (const [mapKey, entry] of Object.entries(CATEGORY_ICON_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return entry;
  }
  return FALLBACK_ICON;
};

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

  const catEntry = getCategoryIcon(product.category);
  const CatIcon = catEntry.Icon;

  // Avatar icon: indica o destaque do produto
  const isHighMargin = margin >= 40;
  const isBestseller = (product.orders_count ?? 0) >= 100;

  return (
    <motion.article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="group relative flex flex-col rounded-[22px] overflow-hidden cursor-pointer bg-white transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
      style={{
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)",
      }}
      aria-label={`Ver produto: ${product.title}`}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      custom={delay}
    >
      {/* ── ZONA 1: Imagem com respiro interno ── */}
      <div className="relative px-5 pt-5 pb-3 flex items-center justify-center bg-[#FAFAFA]" style={{ minHeight: 210 }}>
        {/* Badge categoria — ícone Duotone + texto */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-start justify-between gap-2 z-10 pointer-events-none">
          {product.category ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium tracking-[-0.01em]"
              style={{
                background: catEntry.bg,
                color: catEntry.color,
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <CatIcon size={13} weight="duotone" color={catEntry.color} />
              {product.category}
            </span>
          ) : <span />}

          {margin > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-medium"
              style={{
                background: "#ECFDF5",
                color: "#059669",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <TrendUp size={11} weight="duotone" color="#059669" />
              {margin}%
            </span>
          )}
        </div>

        {imageUrl && !imgFailed ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="relative z-0 w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
            style={{ maxHeight: 172, height: 160 }}
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
      <div className="px-4 pt-3 pb-4 flex items-center gap-3 bg-white border-t border-neutral-100">
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-medium leading-snug line-clamp-1 truncate text-neutral-900 tracking-[-0.01em]">
            {product.title}
          </h3>
          <p className="text-[12px] font-semibold mt-1 leading-none tracking-tight text-neutral-900">
            {formatBRL(price)}
            {product.orders_count != null && product.orders_count > 0 && (
              <span className="ml-1.5 font-normal text-[10.5px] text-neutral-400">
                · {product.orders_count.toLocaleString("pt-BR")} pedidos
              </span>
            )}
          </p>
        </div>

        <div
          className="shrink-0 h-7 w-7 rounded-full grid place-items-center transition-transform duration-200 group-hover:scale-110"
          style={{
            background: isHighMargin ? "#ECFDF5" : isBestseller ? "#EFF6FF" : "#F5F3FF",
          }}
          title={isHighMargin ? "Alta margem" : isBestseller ? "Mais vendido" : "Sugestão"}
        >
          {isHighMargin ? (
            <TrendUp size={14} weight="duotone" color="#059669" />
          ) : isBestseller ? (
            <PhShoppingBag size={14} weight="duotone" color="#3B82F6" />
          ) : (
            <PhSparkle size={14} weight="duotone" color="#7C3AED" />
          )}
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
        className="flex items-center gap-2 mb-7 flex-wrap"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={pillsDelay}
      >
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-[11.5px] transition-all duration-100 ${
              activeFilter === f.key
                ? "bg-white text-neutral-900 font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]"
                : "bg-white/60 text-neutral-500 font-normal hover:text-neutral-700"
            }`}
            style={{
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            {f.label}
          </button>
        ))}
      </motion.div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
