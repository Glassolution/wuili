import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Archive,
  CalendarDays,
  CircleHelp,
  Folder,
  FolderOpen,
  Globe2,
  Grid2X2,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  createCollection,
  deleteCollection,
  listCollectionCategories,
  listCollectionsWithSummaries,
  listUserCollectionCategories,
  type CollectionSummary,
} from "@/lib/collectionsApi";
import { veloToast } from "@/components/ui/velo-toast";

type CatalogProductRow = Database["public"]["Tables"]["catalog_products"]["Row"];

type ProductPreview = {
  id: string;
  title: string;
  category: string;
  image: string;
};

type CollectionKpis = {
  revenue: string;
  orders: string;
  catalogProducts: string;
  activePublications: string;
};

const emptyKpis: CollectionKpis = {
  revenue: "—",
  orders: "—",
  catalogProducts: "—",
  activePublications: "—",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatInteger = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

const fadeUp = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.58, ease: [0.16, 1, 0.3, 1], delay },
  }),
};

const featureCards = [
  {
    eyebrow: "ORGANIZE SEU CATÁLOGO",
    title: "Salve e organize produtos vencedores sem esforço",
    tone: "bg-[#FAFAFA]",
  },
  {
    eyebrow: "REÚNA SUAS IDEIAS",
    title: "Crie coleções para testar nichos, ofertas e anúncios",
    tone: "bg-[#FBFBFB]",
  },
  {
    eyebrow: "CONSTRUA SUA LOJA",
    title: "Publique seus favoritos no Mercado Livre em poucos cliques",
    tone: "bg-[#FAFAFA]",
  },
];

const getProductImages = (images: Json | null): string[] => {
  if (!images) return [];

  if (Array.isArray(images)) {
    return images.filter((image): image is string => typeof image === "string" && image.trim().length > 0);
  }

  if (typeof images === "string") {
    try {
      const parsed: unknown = JSON.parse(images);
      return Array.isArray(parsed)
        ? parsed.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
        : [images];
    } catch {
      return [images];
    }
  }

  return [];
};

const mapProductPreview = (product: CatalogProductRow): ProductPreview | null => {
  const [image] = getProductImages(product.images);

  if (!image) return null;

  return {
    id: product.id,
    title: product.title,
    category: product.category || "Produto",
    image,
  };
};

const ToolbarIcon = ({ children, label }: { children: ReactNode; label: string }) => (
  <button
    type="button"
    aria-label={label}
    className="grid h-7 w-7 place-items-center rounded-full text-[#171717] transition-colors hover:bg-[#F4F4F3]"
  >
    {children}
  </button>
);

const ProductTile = ({
  product,
  className,
}: {
  product?: ProductPreview;
  className: string;
}) => (
  <div className={`box-border overflow-hidden rounded-[12px] border-[0.5px] border-[#E5E5E5] bg-white p-2 shadow-[0_4px_12px_rgba(0,0,0,0.08)] ${className}`}>
    {product ? (
      <img src={product.image} alt="" className="h-full w-full rounded-[8px] object-cover object-center" />
    ) : (
      <div className="h-full w-full rounded-[8px] bg-[linear-gradient(135deg,#F6F6F5_0%,#EFEFED_100%)]" />
    )}
  </div>
);

const HeroCollage = ({ products }: { products: ProductPreview[] }) => (
  <div className="relative h-[220px] w-[280px]">
    <ProductTile
      product={products[3]}
      className="absolute left-[0px] top-[42px] h-[160px] w-[130px] -rotate-[8deg]"
    />
    <ProductTile
      product={products[1]}
      className="absolute left-[38px] top-[28px] z-10 h-[160px] w-[130px] -rotate-[4deg]"
    />
    <ProductTile
      product={products[0]}
      className="absolute left-[75px] top-[18px] z-30 h-[160px] w-[130px] rotate-[1deg]"
    />
    <ProductTile
      product={products[2]}
      className="absolute left-[112px] top-[30px] z-20 h-[160px] w-[130px] rotate-[4deg]"
    />
    <ProductTile
      product={products[4]}
      className="absolute left-[150px] top-[44px] h-[160px] w-[130px] rotate-[8deg]"
    />
    <span className="absolute left-[28px] top-[20px] z-40 h-5 w-[2px] -rotate-[24deg] rounded-full bg-[#111]" />
    <span className="absolute left-[44px] top-[14px] z-40 h-3.5 w-[2px] -rotate-[5deg] rounded-full bg-[#111]" />
    <span className="absolute right-[2px] bottom-[46px] z-40 h-5 w-[2px] rotate-[44deg] rounded-full bg-[#111]" />
    <span className="absolute right-[24px] bottom-[34px] z-40 h-3.5 w-[2px] rotate-[68deg] rounded-full bg-[#111]" />
  </div>
);

const CardProductStack = ({ products }: { products: ProductPreview[] }) => (
  <div className="absolute bottom-5 left-5 right-5 h-[112px]">
    {products.slice(0, 3).map((product, index) => (
      <div
        key={`${product.id}-${index}`}
        className="absolute bottom-0 h-[104px] w-[42%] overflow-hidden rounded-[13px] border border-black/[0.055] bg-white shadow-[0_16px_28px_rgba(17,17,17,0.08)] transition-transform duration-300 group-hover:-translate-y-2"
        style={{
          left: `${index * 27}%`,
          transform: `rotate(${[-5, 1, 5][index]}deg)`,
          zIndex: index + 1,
        }}
      >
        <img src={product.image} alt="" className="h-full w-full object-cover object-center" />
      </div>
    ))}
  </div>
);

const loadCollectionKpis = async (userId: string): Promise<CollectionKpis> => {
  const [ordersResult, catalogResult, publicationsResult] = await Promise.allSettled([
    supabase
      .from("orders")
      .select("total_amount,sale_price,quantity")
      .eq("user_id", userId),
    supabase
      .from("catalog_products")
      .select("id", { count: "exact", head: true })
      .eq("source", "c7drop")
      .eq("is_active", true)
      .eq("is_blocked", false)
      .gt("stock_quantity", 0),
    supabase
      .from("user_publications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["active", "ativo", "published", "publicado"]),
  ]);

  const nextKpis = { ...emptyKpis };

  if (ordersResult.status === "fulfilled" && !ordersResult.value.error) {
    const rows = ordersResult.value.data ?? [];
    const revenue = rows.reduce((sum, order) => {
      const rowTotal = order.total_amount ?? order.sale_price * order.quantity;
      return sum + Number(rowTotal || 0);
    }, 0);

    nextKpis.revenue = formatCurrency(revenue);
    nextKpis.orders = formatInteger(rows.length);
  }

  if (catalogResult.status === "fulfilled" && !catalogResult.value.error) {
    nextKpis.catalogProducts = formatInteger(catalogResult.value.count ?? 0);
  }

  if (publicationsResult.status === "fulfilled" && !publicationsResult.value.error) {
    nextKpis.activePublications = formatInteger(publicationsResult.value.count ?? 0);
  }

  return nextKpis;
};

const Sparkline = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 96 34" aria-hidden="true" className={className}>
    <path
      d="M3 23 C10 14, 16 19, 22 16 S32 8, 39 15 S51 25, 58 17 S69 8, 77 15 S86 25, 93 19"
      fill="none"
      stroke="#9CB8C3"
      strokeLinecap="round"
      strokeWidth="3"
    />
    <path
      d="M3 25 C10 19, 17 24, 24 21 S34 14, 42 20 S55 29, 62 22 S73 15, 82 21 S90 28, 94 25"
      fill="none"
      opacity="0.24"
      stroke="#9CB8C3"
      strokeLinecap="round"
      strokeWidth="2"
    />
  </svg>
);

const OverviewMetricCard = ({ label, value, delta }: { label: string; value: string; delta: string }) => (
  <article className="grid min-h-[92px] grid-cols-[1fr_82px] items-center gap-4 rounded-[12px] border border-black/[0.045] bg-white px-5 py-4 shadow-[0_10px_24px_rgba(17,17,17,0.035)]">
    <div>
      <p className="text-[12px] font-semibold leading-none text-[#6D6D6D]">
        {label}
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-[18px] font-bold leading-none tracking-[-0.035em] text-[#171717]">
          {value}
        </p>
        <span className="text-[11px] font-semibold text-[#8C8C8C]">
          ↗ {delta}
        </span>
      </div>
    </div>
    <Sparkline className="h-[34px] w-[82px]" />
  </article>
);

const SalesOverTimeChart = ({ revenue }: { revenue: string }) => (
  <article className="rounded-[13px] border border-black/[0.045] bg-white p-5 shadow-[0_12px_28px_rgba(17,17,17,0.035)]">
    <p className="text-[13px] font-semibold text-[#6D6D6D]">
      Total sales over time
    </p>
    <div className="mt-3 flex items-baseline gap-2">
      <p className="text-[26px] font-bold tracking-[-0.04em] text-[#171717]">
        {revenue}
      </p>
      <span className="text-[12px] font-semibold text-[#8C8C8C]">↗ 31%</span>
    </div>
    <div className="mt-5 h-[250px]">
      <svg viewBox="0 0 720 250" aria-hidden="true" className="h-full w-full">
        {[38, 82, 126, 170, 214].map((y) => (
          <line key={y} x1="52" x2="708" y1={y} y2={y} stroke="#ECECEC" strokeWidth="1" />
        ))}
        <text x="12" y="42" fill="#B0B0B0" fontSize="12">$3K</text>
        <text x="12" y="126" fill="#B0B0B0" fontSize="12">$2K</text>
        <text x="12" y="214" fill="#B0B0B0" fontSize="12">$0</text>
        <path
          d="M54 164 C94 138, 120 118, 154 146 S198 178, 226 112 S270 40, 304 96 S348 158, 392 122 S452 148, 500 164 S568 210, 602 146 S650 96, 704 204"
          fill="none"
          stroke="#9CB8C3"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <path
          d="M54 134 C92 92, 128 84, 160 112 S208 164, 244 88 S294 18, 330 52 S388 142, 438 112 S506 120, 552 168 S604 178, 644 122 S676 120, 704 146"
          fill="none"
          opacity="0.2"
          stroke="#A7A7A7"
          strokeDasharray="4 5"
          strokeLinecap="round"
          strokeWidth="3"
        />
        {[
          ["Feb 2024", 62],
          ["Apr 2024", 196],
          ["Jun 2024", 328],
          ["Aug 2024", 462],
          ["Oct 2024", 596],
          ["Dec 2024", 690],
        ].map(([label, x]) => (
          <text key={label} x={Number(x)} y="242" fill="#A7A7A7" fontSize="12" textAnchor="middle">
            {label}
          </text>
        ))}
      </svg>
    </div>
  </article>
);

const SalesBreakdown = ({ revenue }: { revenue: string }) => {
  const rows = [
    ["Gross sales", revenue, "↗ 28%"],
    ["Discounts", "-R$ 0,00", "↗ 4%"],
    ["Returns", "-R$ 0,00", "↘ 39%"],
    ["Net sales", revenue, "↗ 31%"],
    ["Shipping charges", "R$ 0,00", "↗ 58%"],
    ["Return fees", "R$ 0,00", "—"],
    ["Taxes", "R$ 0,00", "↗ 47%"],
    ["Total sales", revenue, "↗ 31%"],
  ];

  return (
    <article className="rounded-[13px] border border-black/[0.045] bg-white p-5 shadow-[0_12px_28px_rgba(17,17,17,0.035)]">
      <p className="text-[13px] font-semibold text-[#6D6D6D]">
        Total sales breakdown
      </p>
      <div className="mt-4 divide-y divide-black/[0.045]">
        {rows.map(([label, value, trend]) => (
          <div key={label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3 text-[13px]">
            <span className="font-semibold text-[#777]">{label}</span>
            <span className="font-bold text-[#4A4A4A]">{value}</span>
            <span className="text-[11px] font-semibold text-[#8A8A8A]">{trend}</span>
          </div>
        ))}
      </div>
    </article>
  );
};

const MiniDonutCard = ({ revenue }: { revenue: string }) => (
  <article className="rounded-[13px] border border-black/[0.045] bg-white p-5 shadow-[0_12px_28px_rgba(17,17,17,0.035)]">
    <p className="text-[13px] font-semibold text-[#6D6D6D]">Total sales by sales channel</p>
    <div className="mt-5 flex items-center justify-center">
      <div className="relative grid h-[128px] w-[128px] place-items-center rounded-full bg-[conic-gradient(#4388C5_0_82%,#7C67D9_82%_92%,#D8D8D8_92%_100%)]">
        <div className="grid h-[92px] w-[92px] place-items-center rounded-full bg-white text-center">
          <span className="block text-[21px] font-bold tracking-[-0.035em] text-[#171717]">{revenue === "R$ 0,00" ? "R$ 0" : revenue}</span>
          <span className="mt-1 block text-[11px] font-semibold text-[#8A8A8A]">↗ 31%</span>
        </div>
      </div>
    </div>
    <div className="mt-4 flex justify-center gap-4 text-[12px] font-semibold text-[#777]">
      <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#4388C5]" />Online Store</span>
      <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#7C67D9]" />Shop</span>
    </div>
  </article>
);

const AverageOrderCard = () => (
  <article className="rounded-[13px] border border-black/[0.045] bg-white p-5 shadow-[0_12px_28px_rgba(17,17,17,0.035)]">
    <p className="text-[13px] font-semibold text-[#6D6D6D]">Average order value over time</p>
    <div className="mt-3 flex items-baseline gap-2">
      <p className="text-[24px] font-bold tracking-[-0.04em] text-[#171717]">R$ 0,00</p>
      <span className="text-[12px] font-semibold text-[#8C8C8C]">↗ 17%</span>
    </div>
    <Sparkline className="mt-9 h-[82px] w-full" />
  </article>
);

const ProductsBarCard = () => (
  <article className="rounded-[13px] border border-black/[0.045] bg-white p-5 shadow-[0_12px_28px_rgba(17,17,17,0.035)]">
    <p className="text-[13px] font-semibold text-[#6D6D6D]">Total sales by product</p>
    <div className="mt-7 space-y-5">
      {[
        ["Produto em destaque", "72%"],
        ["Coleção ativa", "58%"],
        ["Favoritos", "46%"],
      ].map(([label, width]) => (
        <div key={label}>
          <p className="mb-2 text-[12px] font-semibold text-[#A1A1A1]">{label}</p>
          <div className="h-8 overflow-hidden rounded-[4px] bg-[#E9EEF1]">
            <div className="h-full bg-[#4388C5]" style={{ width }} />
          </div>
        </div>
      ))}
    </div>
  </article>
);

const CollectionsOverview = ({ kpis }: { kpis: CollectionKpis }) => (
  <section className="rounded-[18px] bg-[#F2F2F1] p-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[20px] font-bold tracking-[-0.03em] text-[#171717]">Overview</h1>
        <div className="mt-7 flex flex-wrap gap-2">
          <span className="inline-flex h-8 items-center gap-2 rounded-[8px] bg-white px-3 text-[12px] font-semibold text-[#5F5F5F] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
            <CalendarDays className="h-4 w-4" strokeWidth={1.8} />
            Last 365 days
          </span>
          <span className="inline-flex h-8 items-center rounded-[8px] bg-white px-3 text-[12px] font-semibold text-[#5F5F5F] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
            Compare to: Feb 14, 2023-Feb 12, 2024
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Configurar visão" className="grid h-8 w-8 place-items-center rounded-[8px] bg-white text-[#171717] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <button type="button" aria-label="Personalizar" className="h-8 rounded-[8px] bg-[#222] px-3 text-[12px] font-bold text-white shadow-[0_8px_18px_rgba(0,0,0,0.12)]">
          Customize
        </button>
      </div>
    </div>

    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 min-[1120px]:grid-cols-4">
      <OverviewMetricCard label="Gross sales" value={kpis.revenue} delta="28%" />
      <OverviewMetricCard label="Returning customer rate" value="0%" delta="45%" />
      <OverviewMetricCard label="Orders fulfilled" value={kpis.orders} delta="31%" />
      <OverviewMetricCard label="Orders" value={kpis.orders} delta="33%" />
    </div>

    <div className="mt-5 grid grid-cols-1 gap-5 min-[1120px]:grid-cols-[2fr_1fr]">
      <SalesOverTimeChart revenue={kpis.revenue} />
      <SalesBreakdown revenue={kpis.revenue} />
    </div>

    <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 min-[1120px]:grid-cols-3">
      <MiniDonutCard revenue={kpis.revenue} />
      <AverageOrderCard />
      <ProductsBarCard />
    </div>
  </section>
);

const CreateCollectionModal = ({
  open,
  categories,
  creating,
  onClose,
  onCreate,
}: {
  open: boolean;
  categories: string[];
  creating: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; category: string | null }) => void;
}) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setCategory(categories[0] ?? null);
    }
  }, [categories, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[430px] rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-[0_24px_70px_rgba(17,17,17,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.04em] text-[#111111]">
              Criar coleção
            </h2>
            <p className="mt-1 text-[13px] font-medium leading-5 text-[#777]">
              Nomeie uma vitrine para salvar produtos do catálogo Velo.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-[#777] transition-colors hover:bg-[#F4F4F3] hover:text-[#111]"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <label className="mt-5 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#999]">
          Nome da coleção
        </label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          placeholder="Ex: Eletrônicos campeões"
          className="mt-2 h-11 w-full rounded-[12px] border border-black/[0.08] bg-[#FAFAFA] px-3 text-[14px] font-medium text-[#111] outline-none transition-colors placeholder:text-[#B8B8B8] focus:border-[#111]"
        />

        <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#999]">
          Categoria
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(categories.length > 0 ? categories : ["Geral"]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`h-9 rounded-full px-3 text-[12px] font-semibold transition-colors ${
                category === item
                  ? "bg-[#111111] text-white"
                  : "bg-[#F3F3F2] text-[#555] hover:bg-[#EBEBEA] hover:text-[#111]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!name.trim() || creating}
          onClick={() => onCreate({ name: name.trim(), category })}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#111111] text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {creating ? "Criando..." : "Criar coleção"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-full text-[13px] font-semibold text-[#777] transition-colors hover:bg-[#F6F6F5] hover:text-[#111]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};

const CollectionDashboardCard = ({
  collection,
  deleting,
  menuOpen,
  onToggleMenu,
  onAddProducts,
  onDelete,
}: {
  collection: CollectionSummary;
  deleting: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onAddProducts: () => void;
  onDelete: () => void;
}) => {
  const coverImage = collection.coverImage ?? collection.thumbnails[0];
  const productLabel = `${collection.productCount} produto${collection.productCount === 1 ? "" : "s"}`;
  const meta = collection.category ? `${productLabel} · ${collection.category}` : productLabel;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onAddProducts}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onAddProducts();
        }
      }}
      className="group relative min-h-[220px] cursor-pointer overflow-hidden rounded-[16px] bg-[#F3F2F0] outline-none transition-transform duration-200 ease-out hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-black/20"
    >
      {coverImage ? (
        <img src={coverImage} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
      ) : (
        <div className="absolute inset-0 bg-[#F3F2F0]" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_30%,rgba(0,0,0,0.75)_100%)]" />

      <button
        type="button"
        aria-label="Opções da coleção"
        aria-expanded={menuOpen}
        disabled={deleting}
        onClick={(event) => {
          event.stopPropagation();
          onToggleMenu();
        }}
        className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/35 disabled:cursor-wait disabled:opacity-55"
      >
        <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>

      {menuOpen ? (
        <div
          className="absolute right-3 top-12 z-30 w-[168px] overflow-hidden rounded-[12px] border border-white/15 bg-white p-1 text-left shadow-[0_18px_46px_rgba(0,0,0,0.22)]"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onAddProducts}
            className="flex h-9 w-full items-center rounded-[9px] px-3 text-[13px] font-medium text-[#222] transition-colors hover:bg-[#F3F2F0]"
          >
            Adicionar produtos
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onDelete}
            className="flex h-9 w-full items-center rounded-[9px] px-3 text-[13px] font-medium text-[#222] transition-colors hover:bg-[#F3F2F0] disabled:cursor-wait disabled:opacity-55"
          >
            Excluir coleção
          </button>
        </div>
      ) : null}

      <div className="absolute bottom-0 left-0 z-10 max-w-[calc(100%-142px)] p-4">
        <h2 className="text-[18px] font-semibold leading-[1.2] text-white">
          {collection.name}
        </h2>
        <p className="mt-1 text-[12px] font-medium text-white/75">
          {meta}
        </p>
      </div>

      <div className="absolute bottom-4 right-4 z-10 flex items-center">
        {collection.thumbnails.length > 0 ? (
          collection.thumbnails.slice(0, 3).map((image, index) => (
            <img
              key={`${collection.id}-${image}-${index}`}
              src={image}
              alt=""
              className="h-9 w-9 rounded-[6px] border-2 border-white bg-white object-cover object-center shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
              style={{ marginLeft: index === 0 ? 0 : -10, zIndex: 3 - index }}
            />
          ))
        ) : (
          <span className="h-9 w-9 rounded-[6px] border-2 border-white bg-[#F3F2F0]" />
        )}
      </div>
    </article>
  );
};

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductPreview[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [collectionCategories, setCollectionCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("Todas");
  const [openMenuCollectionId, setOpenMenuCollectionId] = useState<string | null>(null);
  const [collectionKpis, setCollectionKpis] = useState<CollectionKpis>(emptyKpis);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("id,title,category,images,is_active,is_blocked,stock_quantity,orders_count")
        .eq("source", "c7drop")
        .eq("is_active", true)
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        .order("orders_count", { ascending: false, nullsFirst: false })
        .limit(12);

      if (error || !isMounted) return;

      const previews = ((data ?? []) as CatalogProductRow[])
        .map(mapProductPreview)
        .filter((product): product is ProductPreview => Boolean(product));

      setProducts(previews);
    };

    fetchProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadCollectionData = async (userId: string) => {
    const [collectionRows, categoryRows, userCategoryRows] = await Promise.all([
      listCollectionsWithSummaries(userId),
      listCollectionCategories(),
      listUserCollectionCategories(userId),
    ]);

    setCollections(collectionRows);
    setCategories(categoryRows);
    setCollectionCategories(userCategoryRows);
  };

  useEffect(() => {
    if (!user?.id) return;

    loadCollectionData(user.id).catch(() => {
      veloToast.error("Não foi possível carregar suas coleções.");
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setCollectionKpis(emptyKpis);
      return;
    }

    let isMounted = true;

    loadCollectionKpis(user.id)
      .then((kpis) => {
        if (isMounted) setCollectionKpis(kpis);
      })
      .catch(() => {
        if (isMounted) setCollectionKpis(emptyKpis);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleCreateCollection = async ({ name, category }: { name: string; category: string | null }) => {
    if (!user?.id) {
      veloToast.error("Faça login para criar uma coleção.");
      return;
    }

    setCreatingCollection(true);

    try {
      const collection = await createCollection({ name, category, userId: user.id });
      setCreateModalOpen(false);
      navigate(
        `/dashboard/catalogo?collectionId=${encodeURIComponent(collection.id)}&collectionName=${encodeURIComponent(collection.name)}`,
      );
    } catch {
      veloToast.error("Não foi possível criar a coleção.");
    } finally {
      setCreatingCollection(false);
    }
  };

  const handleDeleteCollection = async (collection: CollectionSummary) => {
    const confirmed = window.confirm(`Excluir a coleção "${collection.name}"?`);
    if (!confirmed) return;

    setOpenMenuCollectionId(null);
    setDeletingCollectionId(collection.id);

    try {
      await deleteCollection(collection.id);
      if (user?.id) await loadCollectionData(user.id);
    } catch {
      veloToast.error("Não foi possível excluir a coleção.");
    } finally {
      setDeletingCollectionId(null);
    }
  };

  const productGroups = useMemo(() => {
    if (products.length === 0) return featureCards.map(() => []);

    return featureCards.map((_, index) =>
      [0, 1, 2]
        .map((offset) => products[(index * 3 + offset + 2) % products.length])
        .filter((product): product is ProductPreview => Boolean(product)),
    );
  }, [products]);

  const filteredCollections = useMemo(() => {
    if (activeCategory === "Todas") return collections;
    return collections.filter((collection) => collection.category === activeCategory);
  }, [activeCategory, collections]);

  useEffect(() => {
    if (activeCategory !== "Todas" && !collectionCategories.includes(activeCategory)) {
      setActiveCategory("Todas");
    }
  }, [activeCategory, collectionCategories]);

  const handleAddProductsToCollection = (collection: CollectionSummary) => {
    setOpenMenuCollectionId(null);
    navigate(
      `/dashboard/catalogo?collectionId=${encodeURIComponent(collection.id)}&collectionName=${encodeURIComponent(collection.name)}`,
    );
  };

  return (
    <main
      className="relative -m-5 min-h-screen overflow-visible bg-white pb-24 text-[#111111] sm:-m-6 lg:-m-7"
      style={{ fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      {collections.length > 0 ? (
        <section className="min-h-screen bg-[#F2F2F1] px-6 py-5 sm:px-10">
          <div className="mx-auto w-full max-w-[1180px]">
            <CollectionsOverview kpis={collectionKpis} />

            <div className="mt-8 rounded-[18px] bg-white p-8 shadow-[0_12px_32px_rgba(17,17,17,0.025)]">
            <header className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-[28px] font-bold leading-tight tracking-[-0.035em] text-black">
                  Minhas Coleções
                </h1>
                <p className="mt-2 text-[14px] font-medium text-[#999]">
                  {collections.length} coleção{collections.length === 1 ? "" : "ões"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-black px-5 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Nova Coleção
              </button>
            </header>

            <section className="mt-10">
              <h2 className="mb-4 text-[16px] font-semibold text-black">
                Categorias
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {["Todas", ...collectionCategories].map((category) => {
                  const active = activeCategory === category;

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-[14px] text-[13px] font-medium transition-colors ${
                        active
                          ? "bg-black text-white"
                          : "bg-[#F3F2F0] text-[#333] hover:bg-[#E9E8E6]"
                      }`}
                    >
                      <FolderOpen className="h-4 w-4" strokeWidth={1.8} />
                      {category}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-8">
              {filteredCollections.length > 0 ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 min-[1200px]:grid-cols-3">
                  {filteredCollections.map((collection) => (
                    <CollectionDashboardCard
                      key={collection.id}
                      collection={collection}
                      deleting={deletingCollectionId === collection.id}
                      menuOpen={openMenuCollectionId === collection.id}
                      onToggleMenu={() =>
                        setOpenMenuCollectionId((current) => (current === collection.id ? null : collection.id))
                      }
                      onAddProducts={() => handleAddProductsToCollection(collection)}
                      onDelete={() => handleDeleteCollection(collection)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center text-center text-[14px] font-medium text-[#999]">
                  Nenhuma coleção nessa categoria
                </div>
              )}
            </section>
            </div>
          </div>
        </section>
      ) : (
        <>
          <header className="relative z-20 flex h-12 items-center gap-3 border-b border-black/[0.03] px-4">
            <div className="flex items-center gap-2">
              <ToolbarIcon label="Ajustes">
                <Settings className="h-[15px] w-[15px]" strokeWidth={2} />
              </ToolbarIcon>
              <ToolbarIcon label="Aplicativos">
                <Grid2X2 className="h-[15px] w-[15px]" strokeWidth={2} />
              </ToolbarIcon>
              <ToolbarIcon label="Arquivos">
                <Folder className="h-[15px] w-[15px]" strokeWidth={2} />
              </ToolbarIcon>
              <ToolbarIcon label="Coleções">
                <Archive className="h-[15px] w-[15px]" strokeWidth={2} />
              </ToolbarIcon>
              <ToolbarIcon label="Mercados">
                <Globe2 className="h-[15px] w-[15px]" strokeWidth={2} />
              </ToolbarIcon>
            </div>

            <div className="mx-2 flex h-9 flex-1 items-center gap-2 rounded-full bg-[#FBFBFA] px-3 text-[#A3A3A3] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.025)]">
              <Search className="h-[14px] w-[14px]" strokeWidth={1.8} />
              <span className="text-[13px] font-medium">Buscar em todas as coleções</span>
            </div>

            <div className="flex items-center gap-2">
              <ToolbarIcon label="Configurações">
                <Settings className="h-[15px] w-[15px]" strokeWidth={2} />
              </ToolbarIcon>
              <ToolbarIcon label="Ajuda">
                <CircleHelp className="h-[15px] w-[15px]" strokeWidth={2} />
              </ToolbarIcon>
              <button
                type="button"
                aria-label="Conta"
                className="h-7 w-7 rounded-full bg-[radial-gradient(circle_at_72%_26%,#FFB84D_0%,#F97316_26%,#EC4899_58%,#7C3AED_100%)] shadow-[0_6px_18px_rgba(236,72,153,0.22)]"
              />
            </div>
          </header>

          <section className="relative mx-auto flex w-full max-w-[1180px] flex-col items-center bg-white px-6 pb-20 pt-[8.8vh]">
            <motion.div
              className="flex flex-col items-center text-center"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0}
            >
              <HeroCollage products={products} />

              <h1 className="mt-5 text-[20px] font-semibold tracking-[-0.035em] text-[#151515]">
                Crie uma coleção única
              </h1>
              <p className="mt-3 max-w-[360px] text-center text-[14px] font-medium leading-[1.5] text-[#B8B8B8]">
                Reúna produtos, ideias, anúncios e referências para acelerar sua próxima venda.
              </p>
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="mt-7 inline-flex h-9 items-center gap-2 rounded-[10px] bg-[#F5F5F4] px-4 text-[13px] font-semibold text-[#222] shadow-[0_12px_24px_rgba(17,17,17,0.05),inset_0_0_0_1px_rgba(0,0,0,0.03)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="h-[14px] w-[14px]" strokeWidth={2} />
                Criar
              </button>
            </motion.div>

            <motion.div
              className="grid w-full max-w-[1180px] grid-cols-1 gap-4 pt-24 md:grid-cols-3"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0.14}
            >
              {featureCards.map((card, index) => (
                <article
                  key={card.eyebrow}
                  className={`group relative h-[280px] overflow-hidden rounded-[16px] border border-black/[0.035] ${card.tone} p-5 shadow-[0_16px_42px_rgba(17,17,17,0.032)]`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.04em] text-[#B0B0B0]">
                    {card.eyebrow}
                  </p>
                  <h2 className="mt-4 max-w-[235px] text-[17px] font-semibold leading-[1.18] tracking-[-0.035em] text-[#1A1A1A]">
                    {card.title}
                  </h2>
                  {productGroups[index].length > 0 ? (
                    <CardProductStack products={productGroups[index]} />
                  ) : (
                    <div className="absolute bottom-5 left-6 right-6 h-[104px] rounded-[14px] border border-black/[0.045] bg-[linear-gradient(135deg,#F7F7F6_0%,#EFEFED_100%)] shadow-[0_16px_28px_rgba(17,17,17,0.06)]" />
                  )}
                </article>
              ))}
            </motion.div>
          </section>
        </>
      )}

      <CreateCollectionModal
        open={createModalOpen}
        categories={categories}
        creating={creatingCollection}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateCollection}
      />
    </main>
  );
};

export default DashboardHomePage;
