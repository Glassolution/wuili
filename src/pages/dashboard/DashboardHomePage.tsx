import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Archive,
  CalendarDays,
  CircleHelp,
  Folder,
  Globe2,
  Grid2X2,
  MoreHorizontal,
  Pencil,
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
  listCollectionProducts,
  listCollectionsWithSummaries,
  listUserCollectionCategories,
  renameCollection,
  removeProductFromCollection,
  type CollectionProductItem,
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
  revenueValue: number;
  orders: string;
  orderCount: number;
  catalogProducts: string;
  catalogCount: number;
  activePublications: string;
  activePublicationsCount: number;
  fulfilledOrders: string;
  returningCustomerRate: string;
  averageOrderValue: string;
  monthlySales: number[];
  monthlyOrders: number[];
  salesBreakdown: Array<{
    label: string;
    value: string;
    trend: string;
  }>;
};

const emptyKpis: CollectionKpis = {
  revenue: "—",
  revenueValue: 0,
  orders: "—",
  orderCount: 0,
  catalogProducts: "—",
  catalogCount: 0,
  activePublications: "—",
  activePublicationsCount: 0,
  fulfilledOrders: "—",
  returningCustomerRate: "—",
  averageOrderValue: "—",
  monthlySales: [0, 0, 0, 0, 0, 0],
  monthlyOrders: [0, 0, 0, 0, 0, 0],
  salesBreakdown: [
    { label: "Gross sales", value: "—", trend: "—" },
    { label: "Discounts", value: "—", trend: "—" },
    { label: "Returns", value: "—", trend: "—" },
    { label: "Net sales", value: "—", trend: "—" },
    { label: "Shipping charges", value: "—", trend: "—" },
    { label: "Return fees", value: "—", trend: "—" },
    { label: "Taxes", value: "—", trend: "—" },
    { label: "Total sales", value: "—", trend: "—" },
  ],
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatInteger = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

const formatTrend = (current: number, previous: number) => {
  if (previous <= 0) return current > 0 ? "↗ 100%" : "—";

  const percentage = ((current - previous) / previous) * 100;
  const arrow = percentage >= 0 ? "↗" : "↘";
  return `${arrow} ${Math.abs(Math.round(percentage))}%`;
};

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
      .select("total_amount,sale_price,quantity,status,fulfillment_status,buyer_email,created_at,ordered_at")
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
    const returnedRevenue = rows
      .filter((order) => ["cancelled", "canceled", "refunded", "returned"].includes(String(order.status).toLowerCase()))
      .reduce((sum, order) => {
        const rowTotal = order.total_amount ?? order.sale_price * order.quantity;
        return sum + Number(rowTotal || 0);
      }, 0);
    const fulfilledOrders = rows.filter((order) =>
      ["fulfilled", "delivered", "shipped", "paid", "completed"].includes(
        String(order.fulfillment_status || order.status).toLowerCase(),
      ),
    ).length;
    const buyerCounts = rows.reduce<Record<string, number>>((acc, order) => {
      if (!order.buyer_email) return acc;
      acc[order.buyer_email] = (acc[order.buyer_email] ?? 0) + 1;
      return acc;
    }, {});
    const buyerTotal = Object.keys(buyerCounts).length;
    const returningBuyers = Object.values(buyerCounts).filter((count) => count > 1).length;
    const monthlySales = Array.from({ length: 6 }, (_, index) => {
      const month = new Date();
      month.setMonth(month.getMonth() - (5 - index));

      return rows.reduce((sum, order) => {
        const dateValue = order.ordered_at || order.created_at;
        if (!dateValue) return sum;

        const orderDate = new Date(dateValue);
        if (orderDate.getMonth() !== month.getMonth() || orderDate.getFullYear() !== month.getFullYear()) {
          return sum;
        }

        const rowTotal = order.total_amount ?? order.sale_price * order.quantity;
        return sum + Number(rowTotal || 0);
      }, 0);
    });
    const monthlyOrders = Array.from({ length: 6 }, (_, index) => {
      const month = new Date();
      month.setMonth(month.getMonth() - (5 - index));

      return rows.filter((order) => {
        const dateValue = order.ordered_at || order.created_at;
        if (!dateValue) return false;

        const orderDate = new Date(dateValue);
        return orderDate.getMonth() === month.getMonth() && orderDate.getFullYear() === month.getFullYear();
      }).length;
    });
    const salesTrend = formatTrend(monthlySales[5] ?? 0, monthlySales[4] ?? 0);

    nextKpis.revenue = formatCurrency(revenue);
    nextKpis.revenueValue = revenue;
    nextKpis.orders = formatInteger(rows.length);
    nextKpis.orderCount = rows.length;
    nextKpis.fulfilledOrders = formatInteger(fulfilledOrders);
    nextKpis.returningCustomerRate = buyerTotal > 0 ? `${((returningBuyers / buyerTotal) * 100).toFixed(2)}%` : "0%";
    nextKpis.averageOrderValue = rows.length > 0 ? formatCurrency(revenue / rows.length) : formatCurrency(0);
    nextKpis.monthlySales = monthlySales;
    nextKpis.monthlyOrders = monthlyOrders;
    nextKpis.salesBreakdown = [
      { label: "Gross sales", value: formatCurrency(revenue), trend: salesTrend },
      { label: "Discounts", value: formatCurrency(0), trend: "—" },
      { label: "Returns", value: `-${formatCurrency(returnedRevenue)}`, trend: returnedRevenue > 0 ? "↘ 39%" : "—" },
      { label: "Net sales", value: formatCurrency(Math.max(revenue - returnedRevenue, 0)), trend: salesTrend },
      { label: "Shipping charges", value: formatCurrency(0), trend: "—" },
      { label: "Return fees", value: formatCurrency(0), trend: "—" },
      { label: "Taxes", value: formatCurrency(0), trend: "—" },
      { label: "Total sales", value: formatCurrency(revenue), trend: salesTrend },
    ];
  }

  if (catalogResult.status === "fulfilled" && !catalogResult.value.error) {
    const count = catalogResult.value.count ?? 0;
    nextKpis.catalogProducts = formatInteger(count);
    nextKpis.catalogCount = count;
  }

  if (publicationsResult.status === "fulfilled" && !publicationsResult.value.error) {
    const count = publicationsResult.value.count ?? 0;
    nextKpis.activePublications = formatInteger(count);
    nextKpis.activePublicationsCount = count;
  }

  return nextKpis;
};

const chartBlue = "#2563EB";
const chartBlueSoft = "#93C5FD";

const toChartPath = (values: number[], width: number, height: number, padding = 4) => {
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = padding + index * step;
    const y = height - padding - (value / max) * (height - padding * 2);
    return [x, y] as const;
  });

  if (points.length === 0) return "";

  return points.reduce((path, point, index) => {
    if (index === 0) return `M${point[0]} ${point[1]}`;

    const previous = points[index - 1];
    const controlX = previous[0] + (point[0] - previous[0]) / 2;
    return `${path} C${controlX} ${previous[1]}, ${controlX} ${point[1]}, ${point[0]} ${point[1]}`;
  }, "");
};

const normalizeSeries = (values: number[], fallback: number) => {
  if (values.some((value) => value > 0)) return values;
  return values.map(() => fallback);
};

const Sparkline = ({ values, className = "" }: { values: number[]; className?: string }) => {
  const hasData = values.some((value) => value > 0);

  return (
  <svg viewBox="0 0 96 34" aria-hidden="true" className={className}>
    <path
      d={toChartPath(normalizeSeries(values, 0), 96, 34, 5)}
      fill="none"
      stroke={chartBlue}
      strokeLinecap="round"
      strokeWidth="2.2"
      style={{
        animation: "velo-chart-draw 900ms ease-out both",
        strokeDasharray: 150,
        strokeDashoffset: 150,
      }}
    />
    <path
      d={toChartPath(hasData ? values.map((value) => value * 0.72) : values, 96, 34, 5)}
      fill="none"
      opacity="0.24"
      stroke={chartBlueSoft}
      strokeLinecap="round"
      strokeWidth="2"
    />
  </svg>
  );
};

const OverviewMetricCard = ({ label, value, delta, values }: { label: string; value: string; delta: string; values: number[] }) => (
  <article className="grid min-h-[52px] grid-cols-[1fr_58px] items-center gap-2 rounded-[9px] border border-black/[0.04] bg-white px-3 py-2 shadow-[0_6px_14px_rgba(17,17,17,0.03)]">
    <div>
      <p className="text-[10px] font-semibold leading-none text-[#5F5F5F]">
        {label}
      </p>
      <div className="mt-1.5 flex items-baseline gap-1">
        <p className="text-[13px] font-bold leading-none text-[#171717]">
          {value}
        </p>
        <span className="text-[9px] font-semibold text-[#8C8C8C]">
          {delta}
        </span>
      </div>
    </div>
    <Sparkline values={values} className="h-[20px] w-[58px]" />
  </article>
);

const SalesOverTimeChart = ({ revenue, values }: { revenue: string; values: number[] }) => {
  const chartValues = normalizeSeries(values, 0);
  const hasData = chartValues.some((value) => value > 0);
  const compareValues = hasData ? chartValues.map((value) => value * 0.72) : chartValues;
  const trend = formatTrend(chartValues[5] ?? 0, chartValues[4] ?? 0);
  const maxValue = Math.max(...chartValues, ...compareValues, 1);
  const yLabels = hasData
    ? [maxValue, maxValue / 2, 0].map((value) =>
        value >= 1000 ? `R$ ${Math.round(value / 1000)}K` : formatCurrency(value),
      )
    : [formatCurrency(0), formatCurrency(0), formatCurrency(0)];

  return (
  <article className="rounded-[10px] border border-black/[0.045] bg-white p-3.5 shadow-[0_8px_18px_rgba(17,17,17,0.03)]">
    <p className="text-[10px] font-bold text-[#5F5F5F]">
      Total sales over time
    </p>
    <div className="mt-1 flex items-baseline gap-1.5">
      <p className="text-[17px] font-bold text-[#171717]">
        {revenue}
      </p>
      <span className="text-[9px] font-semibold text-[#8C8C8C]">{trend}</span>
    </div>
    <div className="mt-2 h-[152px]">
      <svg viewBox="0 0 720 180" aria-hidden="true" className="h-full w-full">
        {[30, 62, 94, 126, 158].map((y) => (
          <line key={y} x1="52" x2="708" y1={y} y2={y} stroke="#ECECEC" strokeWidth="1" />
        ))}
        <text x="4" y="34" fill="#B0B0B0" fontSize="9">{yLabels[0]}</text>
        <text x="4" y="98" fill="#B0B0B0" fontSize="9">{yLabels[1]}</text>
        <text x="4" y="162" fill="#B0B0B0" fontSize="9">{yLabels[2]}</text>
        <path
          d={toChartPath(compareValues, 720, 154, 52)}
          fill="none"
          opacity="0.22"
          stroke="#9CA3AF"
          strokeDasharray="3 5"
          strokeLinecap="round"
          strokeWidth="2.4"
        />
        <path
          d={toChartPath(chartValues, 720, 154, 52)}
          fill="none"
          stroke={chartBlue}
          strokeLinecap="round"
          strokeWidth="2.7"
          style={{
            animation: "velo-chart-draw 1200ms cubic-bezier(.2,.8,.2,1) both",
            strokeDasharray: 900,
            strokeDashoffset: 900,
          }}
        />
        {[
          ["Feb 2024", 62],
          ["Apr 2024", 196],
          ["Jun 2024", 328],
          ["Aug 2024", 462],
          ["Oct 2024", 596],
          ["Dec 2024", 690],
        ].map(([label, x]) => (
          <text key={label} x={Number(x)} y="176" fill="#A7A7A7" fontSize="9" textAnchor="middle">
            {label}
          </text>
        ))}
      </svg>
    </div>
  </article>
  );
};

const SalesBreakdown = ({ rows }: { rows: CollectionKpis["salesBreakdown"] }) => {
  return (
    <article className="rounded-[10px] border border-black/[0.045] bg-white p-3.5 shadow-[0_8px_18px_rgba(17,17,17,0.03)]">
      <p className="text-[10px] font-bold text-[#5F5F5F]">
        Total sales breakdown
      </p>
      <div className="mt-2 space-y-[3px]">
        {rows.map(({ label, value, trend }) => (
          <div key={label} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-[4px] bg-[#F7F7F6] px-2 py-[5px] text-[10px]">
            <span className="font-semibold text-[#6F6F6F]">{label}</span>
            <span className="font-bold text-[#4A4A4A]">{value}</span>
            <span className="text-[9px] font-semibold text-[#8A8A8A]">{trend}</span>
          </div>
        ))}
      </div>
    </article>
  );
};

const MiniDonutCard = ({ revenue, activePublicationsCount, catalogCount }: { revenue: string; activePublicationsCount: number; catalogCount: number }) => {
  const activeShare = catalogCount > 0 ? Math.min(92, Math.max(8, (activePublicationsCount / catalogCount) * 100)) : 8;

  return (
  <article className="rounded-[10px] border border-black/[0.045] bg-white p-3.5 shadow-[0_8px_18px_rgba(17,17,17,0.03)]">
    <p className="text-[10px] font-bold text-[#5F5F5F]">Total sales by sales channel</p>
    <div className="mt-2.5 flex items-center justify-center">
      <div
        className="relative grid h-[82px] w-[82px] place-items-center rounded-full"
        style={{
          background: `conic-gradient(${chartBlue} 0 ${activeShare}%, #4F46E5 ${activeShare}% ${Math.min(activeShare + 10, 100)}%, #DDE7FF ${Math.min(activeShare + 10, 100)}% 100%)`,
        }}
      >
        <div className="grid h-[58px] w-[58px] place-items-center rounded-full bg-white text-center">
          <span className="block text-[11px] font-bold text-[#171717]">{revenue === "R$ 0,00" ? "R$ 0" : revenue}</span>
          <span className="block text-[8px] font-semibold text-[#8A8A8A]">↗ 31%</span>
        </div>
      </div>
    </div>
    <div className="mt-2.5 flex justify-center gap-3 text-[9px] font-semibold text-[#777]">
      <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#2563EB]" />Online Store</span>
      <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#4F46E5]" />Shop</span>
    </div>
  </article>
  );
};

const AverageOrderCard = ({ value, monthlySales }: { value: string; monthlySales: number[] }) => (
  <article className="rounded-[10px] border border-black/[0.045] bg-white p-3.5 shadow-[0_8px_18px_rgba(17,17,17,0.03)]">
    <p className="text-[10px] font-bold text-[#5F5F5F]">Average order value over time</p>
    <div className="mt-1 flex items-baseline gap-1.5">
      <p className="text-[15px] font-bold text-[#171717]">{value}</p>
      <span className="text-[9px] font-semibold text-[#8C8C8C]">↗ 17%</span>
    </div>
    <Sparkline values={monthlySales} className="mt-4 h-[56px] w-full" />
  </article>
);

const ProductsBarCard = ({ catalogCount, activePublicationsCount, orderCount }: { catalogCount: number; activePublicationsCount: number; orderCount: number }) => {
  const max = Math.max(catalogCount, activePublicationsCount, orderCount, 1);
  const rows = [
    ["Produtos no catálogo", catalogCount],
    ["Publicações ativas", activePublicationsCount],
    ["Pedidos", orderCount],
  ];

  return (
  <article className="rounded-[10px] border border-black/[0.045] bg-white p-3.5 shadow-[0_8px_18px_rgba(17,17,17,0.03)]">
    <p className="text-[10px] font-bold text-[#5F5F5F]">Total sales by product</p>
    <div className="mt-3 space-y-2.5">
      {[
        ...rows,
      ].map(([label, value]) => (
        <div key={label}>
          <div className="mb-1 flex items-center justify-between text-[9px] font-semibold text-[#A1A1A1]">
            <span>{label}</span>
            <span>{formatInteger(Number(value))}</span>
          </div>
          <div className="h-5 overflow-hidden rounded-[4px] bg-[#E9EEF1]">
            <div
              className="h-full bg-[#2563EB] transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(8, (Number(value) / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  </article>
  );
};

const CollectionsOverview = ({ kpis }: { kpis: CollectionKpis }) => {
  const salesTrend = formatTrend(kpis.monthlySales[5] ?? 0, kpis.monthlySales[4] ?? 0);
  const salesSeries = kpis.monthlySales.some((value) => value > 0) ? kpis.monthlySales : kpis.monthlyOrders;

  return (
  <section className="rounded-[14px] bg-[#F2F2F1] p-3">
    <style>
      {`
        @keyframes velo-chart-draw {
          to { stroke-dashoffset: 0; }
        }
      `}
    </style>
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[16px] font-bold text-[#171717]">Overview</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex h-6 items-center gap-1.5 rounded-[6px] bg-white px-2.5 text-[10px] font-semibold text-[#5F5F5F] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
            <CalendarDays className="h-3 w-3" strokeWidth={1.8} />
            Last 365 days
          </span>
          <span className="inline-flex h-6 items-center rounded-[6px] bg-white px-2.5 text-[10px] font-semibold text-[#5F5F5F] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
            Compare to: Feb 14, 2023-Feb 12, 2024
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Configurar visão" className="grid h-6 w-6 place-items-center rounded-[6px] bg-white text-[#171717] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
          <SlidersHorizontal className="h-3 w-3" strokeWidth={1.8} />
        </button>
        <button type="button" aria-label="Personalizar" className="h-6 rounded-[6px] bg-[#222] px-2.5 text-[10px] font-bold text-white shadow-[0_8px_18px_rgba(0,0,0,0.12)]">
          Customize
        </button>
      </div>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-2 min-[700px]:grid-cols-4">
      <OverviewMetricCard label="Gross sales" value={kpis.revenue} delta={salesTrend} values={salesSeries} />
      <OverviewMetricCard label="Returning customer rate" value={kpis.returningCustomerRate} delta="—" values={kpis.monthlyOrders} />
      <OverviewMetricCard label="Orders fulfilled" value={kpis.fulfilledOrders} delta="—" values={kpis.monthlyOrders} />
      <OverviewMetricCard label="Orders" value={kpis.orders} delta={formatTrend(kpis.monthlyOrders[5] ?? 0, kpis.monthlyOrders[4] ?? 0)} values={kpis.monthlyOrders} />
    </div>

    <div className="mt-2 grid grid-cols-1 gap-2 min-[700px]:grid-cols-[2fr_1fr]">
      <SalesOverTimeChart revenue={kpis.revenue} values={salesSeries} />
      <SalesBreakdown rows={kpis.salesBreakdown} />
    </div>

    <div className="mt-2 grid grid-cols-1 gap-2 min-[620px]:grid-cols-3">
      <MiniDonutCard
        revenue={kpis.revenue}
        activePublicationsCount={kpis.activePublicationsCount}
        catalogCount={kpis.catalogCount}
      />
      <AverageOrderCard value={kpis.averageOrderValue} monthlySales={salesSeries} />
      <ProductsBarCard
        catalogCount={kpis.catalogCount}
        activePublicationsCount={kpis.activePublicationsCount}
        orderCount={kpis.orderCount}
      />
    </div>
  </section>
  );
};

const CreateCollectionModal = ({
  open,
  creating,
  onClose,
  onCreate,
}: {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; category: string | null }) => void;
}) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const categoryOptions = ["Outros", "Casa", "Eletrônicos", "Bebê e Infantil", "Moda", "Automotivo", "Decoração", "Pet"];

  useEffect(() => {
    if (open) {
      setName("");
      setCategory(categoryOptions[0]);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4 backdrop-blur-[8px]">
      <div className="relative w-full max-w-[420px] rounded-[24px] bg-white px-7 py-8 shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute right-5 top-5 grid h-[18px] w-[18px] place-items-center border-0 bg-transparent p-0 text-[#999] transition-colors hover:text-[#555]"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>

        <div>
          <h2 className="mb-1.5 text-[24px] font-bold leading-tight text-black">
            Criar coleção
          </h2>
          <p className="mb-7 max-w-[330px] text-[14px] font-normal leading-[1.5] text-[#999]">
            Nomeie uma vitrine para salvar produtos do catálogo Velo.
          </p>
        </div>

        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#999]">
          NOME DA COLEÇÃO
        </label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          placeholder="Ex: Eletrônicos campeões"
          className="mb-6 w-full rounded-[14px] border-0 bg-[#F7F7F6] px-4 py-3.5 text-[15px] font-normal text-black outline-none transition-shadow placeholder:text-[#C0C0C0] focus:shadow-[0_0_0_2px_#000]"
        />

        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#999]">
          CATEGORIA
        </p>
        <div className="mb-8 flex flex-wrap gap-2">
          {categoryOptions.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-full border-0 px-4 py-2 text-[13px] font-medium transition-colors ${
                category === item
                  ? "bg-black text-white"
                  : "bg-[#F3F2F0] text-[#555] hover:bg-[#EBEBEA]"
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
          className="mb-3 inline-flex h-[52px] w-full cursor-pointer items-center justify-center rounded-[14px] border-0 bg-black text-[15px] font-semibold text-white transition-colors hover:bg-[#1A1A1A] disabled:cursor-not-allowed disabled:bg-[#E0E0E0] disabled:text-[#999]"
        >
          {creating ? "Criando..." : "Criar coleção"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-full cursor-pointer items-center justify-center border-0 bg-transparent text-[14px] font-medium text-[#999] transition-colors hover:text-[#555]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};

const RenameCollectionModal = ({
  open,
  name,
  saving,
  onNameChange,
  onClose,
  onSave,
}: {
  open: boolean;
  name: string;
  saving: boolean;
  onNameChange: (name: string) => void;
  onClose: () => void;
  onSave: () => void;
}) => {
  if (!open) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[360px] rounded-[18px] bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#111]">Editar coleção</h2>
            <p className="mt-1 text-[13px] font-medium text-[#8A8A8A]">Renomeie sua coleção.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-[#777] transition-colors hover:bg-[#F5F5F4] hover:text-[#111]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <label className="mt-5 block text-[12px] font-semibold text-[#777]" htmlFor="collection-rename">
          Nome da coleção
        </label>
        <input
          id="collection-rename"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          autoFocus
          className="mt-2 h-11 w-full rounded-[12px] border border-[#E5E5E5] bg-[#FAFAF9] px-3 text-[14px] font-medium text-[#111] outline-none transition-colors placeholder:text-[#B0B0B0] focus:border-[#111] focus:bg-white"
          placeholder="Nome da coleção"
        />

        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#111111] text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
};

const CollectionDashboardCard = ({
  collection,
  deleting,
  expanded,
  menuOpen,
  onToggleExpanded,
  onToggleMenu,
  onAddProducts,
  onEdit,
  onDelete,
}: {
  collection: CollectionSummary;
  deleting: boolean;
  expanded: boolean;
  menuOpen: boolean;
  onToggleExpanded: () => void;
  onToggleMenu: () => void;
  onAddProducts: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const collectionDescription = collection.category
    ? `Organize produtos da categoria ${collection.category.toLowerCase()}.`
    : "Organize produtos, ideias e anúncios nesta coleção.";
  const previewImages = collection.thumbnails.slice(0, 3);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggleExpanded}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleExpanded();
        }
      }}
      className={`relative flex h-[224px] w-[274px] shrink-0 cursor-pointer flex-col rounded-[13px] border p-3.5 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-black/20 ${
        expanded ? "border-[#111] bg-white" : "border-[#E9E9E8] bg-[#F8F8F7] hover:bg-[#F2F2F1]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="relative h-[68px] w-[88px] shrink-0">
          <div className="absolute left-0 top-0 h-[22px] w-[46px] rounded-t-[10px] bg-[#ECECEA]" />
          <div className="absolute left-0 top-[11px] h-[57px] w-[88px] rounded-[10px] bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.035),0_8px_18px_rgba(0,0,0,0.035)]">
            <span className="absolute bottom-4 right-4 h-[2px] w-5 rounded-full bg-[#BDBDBB]" />
          </div>
        </div>

        <div className="flex min-w-0 items-start gap-1.5 pt-1.5">
          <span className="text-[12px] font-semibold leading-none text-[#969696]">{collection.productCount}+</span>
          <div className="flex -space-x-2">
            {previewImages.length > 0 ? (
              previewImages.map((image, index) => (
                <img
                  key={`${collection.id}-thumb-${index}`}
                  src={image}
                  alt=""
                  className="h-6 w-6 rounded-full border-[1.5px] border-[#F8F8F7] object-cover object-center"
                />
              ))
            ) : (
              [0, 1, 2].map((item) => (
                <span
                  key={item}
                  className="h-6 w-6 rounded-full border-[1.5px] border-[#F8F8F7] bg-[#E4E4E2]"
                />
              ))
            )}
          </div>
        </div>

        <button
          type="button"
          aria-label="Opções da coleção"
          aria-expanded={menuOpen}
          disabled={deleting}
          onClick={(event) => {
            event.stopPropagation();
            onToggleMenu();
          }}
          className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-[#9A9A9A] transition-colors hover:bg-white hover:text-[#111] disabled:cursor-wait disabled:opacity-55"
        >
          <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>

        {menuOpen ? (
          <div
            className="absolute right-3 top-9 z-30 w-[168px] overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white p-1 text-left shadow-[0_18px_46px_rgba(0,0,0,0.12)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAddProducts();
              }}
              className="flex h-10 w-full items-center rounded-[10px] px-3 text-[13px] font-medium text-[#222] transition-colors hover:bg-[#F3F2F0]"
            >
              Adicionar produtos
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={onDelete}
              className="flex h-10 w-full items-center rounded-[10px] px-3 text-[13px] font-medium text-[#222] transition-colors hover:bg-[#F3F2F0] disabled:cursor-wait disabled:opacity-55"
            >
              Excluir coleção
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 min-w-0">
        <h2 className="truncate whitespace-nowrap text-[16px] font-semibold leading-[1.12] tracking-[-0.03em] text-[#171717]">
          {collection.name}
        </h2>
        <p className="mt-1.5 line-clamp-2 min-h-[35px] max-w-[205px] text-[13px] font-medium leading-[1.35] tracking-[-0.02em] text-[#8C8C8C]">
          {collectionDescription}
        </p>
      </div>

      <div className="mt-auto flex w-full items-center gap-5 pt-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAddProducts();
          }}
          className="inline-flex h-[34px] w-[150px] items-center justify-center gap-1.5 rounded-[8px] bg-[#050608] text-[12px] font-semibold leading-none text-white transition-opacity hover:opacity-90"
        >
          <Search className="h-[13px] w-[13px]" strokeWidth={2} />
          Adicionar produtos
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="inline-flex h-[34px] items-center justify-center gap-1.5 border-0 bg-transparent text-[14px] font-medium leading-none text-[#777] transition-colors hover:text-[#111]"
        >
          <Pencil className="h-[13px] w-[13px]" strokeWidth={2} />
          Editar
        </button>
      </div>
    </article>
  );
};

const CollectionProductsPanel = ({
  collection,
  products,
  loading,
  removingProductId,
  onAddProducts,
  onRemoveProduct,
}: {
  collection: CollectionSummary;
  products: CollectionProductItem[];
  loading: boolean;
  removingProductId: string | null;
  onAddProducts: () => void;
  onRemoveProduct: (productId: string) => void;
}) => (
  <section className="mt-4 overflow-hidden rounded-[13px] border border-[#E7E7E5] bg-[#FAFAF9]">
    <header className="flex items-center justify-between gap-4 border-b border-[#ECECEA] px-4 py-3">
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[#111]">{collection.name}</h3>
        <p className="mt-0.5 text-[12px] font-medium text-[#8B8B8B]">
          {collection.productCount} produto{collection.productCount === 1 ? "" : "s"} nesta coleção
        </p>
      </div>
      <button
        type="button"
        onClick={onAddProducts}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] bg-[#050608] px-3 text-[12px] font-semibold leading-none text-white transition-opacity hover:opacity-90"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        Adicionar produtos
      </button>
    </header>

    <div className="divide-y divide-[#ECECEA]">
      {loading ? (
        [0, 1, 2].map((item) => (
          <div key={item} className="flex h-[68px] animate-pulse items-center gap-3 px-4">
            <div className="h-11 w-11 rounded-[8px] bg-[#E7E7E5]" />
            <div className="min-w-0 flex-1">
              <div className="h-3.5 w-2/3 rounded-full bg-[#E1E1DF]" />
              <div className="mt-2 h-3 w-24 rounded-full bg-[#E9E9E7]" />
            </div>
            <div className="h-7 w-7 rounded-full bg-[#E6E6E4]" />
          </div>
        ))
      ) : products.length > 0 ? (
        products.map((product) => (
          <div key={product.id} className="flex min-h-[68px] items-center gap-3 px-4 py-3">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt=""
                className="h-11 w-11 shrink-0 rounded-[8px] border border-black/[0.04] bg-white object-cover object-center"
              />
            ) : (
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] border border-black/[0.04] bg-white text-[#B0B0B0]">
                <Archive className="h-4 w-4" strokeWidth={1.8} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[#181818]">{product.title}</p>
              <p className="mt-1 text-[12px] font-medium text-[#777]">
                {product.price === null ? "Preço indisponível" : formatCurrency(product.price)}
              </p>
            </div>
            <button
              type="button"
              aria-label="Remover produto da coleção"
              disabled={removingProductId === product.id}
              onClick={() => onRemoveProduct(product.id)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#9A9A9A] transition-colors hover:bg-white hover:text-[#111] disabled:cursor-wait disabled:opacity-50"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        ))
      ) : (
        <div className="px-4 py-8 text-center">
          <p className="text-[14px] font-semibold text-[#222]">Esta coleção está vazia</p>
          <p className="mt-1 text-[13px] font-medium text-[#8B8B8B]">Clique em Adicionar produtos para começar</p>
        </div>
      )}
    </div>
  </section>
);

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductPreview[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [collectionCategories, setCollectionCategories] = useState<string[]>([]);
  const [openMenuCollectionId, setOpenMenuCollectionId] = useState<string | null>(null);
  const [collectionKpis, setCollectionKpis] = useState<CollectionKpis>(emptyKpis);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);
  const [renamingCollection, setRenamingCollection] = useState<CollectionSummary | null>(null);
  const [renameCollectionName, setRenameCollectionName] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [collectionProducts, setCollectionProducts] = useState<CollectionProductItem[]>([]);
  const [loadingCollectionProducts, setLoadingCollectionProducts] = useState(false);
  const [removingCollectionProductId, setRemovingCollectionProductId] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const carouselDragRef = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    dragged: false,
  });

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
    if (!selectedCollectionId) {
      setCollectionProducts([]);
      setLoadingCollectionProducts(false);
      return;
    }

    let isMounted = true;
    setLoadingCollectionProducts(true);

    listCollectionProducts(selectedCollectionId)
      .then((items) => {
        if (isMounted) setCollectionProducts(items);
      })
      .catch(() => {
        if (isMounted) {
          setCollectionProducts([]);
          veloToast.error("Não foi possível carregar os produtos da coleção.");
        }
      })
      .finally(() => {
        if (isMounted) setLoadingCollectionProducts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCollectionId]);

  useEffect(() => {
    if (!selectedCollectionId) return;
    if (collections.some((collection) => collection.id === selectedCollectionId)) return;

    setSelectedCollectionId(null);
  }, [collections, selectedCollectionId]);

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

  const openRenameCollectionModal = (collection: CollectionSummary) => {
    setOpenMenuCollectionId(null);
    setRenamingCollection(collection);
    setRenameCollectionName(collection.name);
  };

  const closeRenameCollectionModal = () => {
    if (savingRename) return;
    setRenamingCollection(null);
    setRenameCollectionName("");
  };

  const handleRenameCollection = async () => {
    if (!renamingCollection) return;

    const nextName = renameCollectionName.trim();
    if (!nextName) return;

    setSavingRename(true);

    try {
      await renameCollection(renamingCollection.id, nextName);
      if (user?.id) await loadCollectionData(user.id);
      setRenamingCollection(null);
      setRenameCollectionName("");
    } catch {
      veloToast.error("Não foi possível renomear a coleção.");
    } finally {
      setSavingRename(false);
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

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId],
  );

  const handleCarouselMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const carousel = carouselRef.current;
    if (!carousel) return;

    carouselDragRef.current = {
      isDown: true,
      startX: event.pageX - carousel.offsetLeft,
      scrollLeft: carousel.scrollLeft,
      dragged: false,
    };
  };

  const handleCarouselMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const carousel = carouselRef.current;
    const drag = carouselDragRef.current;
    if (!carousel || !drag.isDown) return;

    event.preventDefault();
    const x = event.pageX - carousel.offsetLeft;
    const walk = x - drag.startX;
    if (Math.abs(walk) > 4) drag.dragged = true;
    carousel.scrollLeft = drag.scrollLeft - walk;
  };

  const stopCarouselDrag = () => {
    carouselDragRef.current.isDown = false;
  };

  const handleCarouselClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!carouselDragRef.current.dragged) return;

    event.preventDefault();
    event.stopPropagation();
    carouselDragRef.current.dragged = false;
  };

  const handleAddProductsToCollection = (collection: CollectionSummary) => {
    setOpenMenuCollectionId(null);
    navigate(
      `/dashboard/catalogo?collectionId=${encodeURIComponent(collection.id)}&collectionName=${encodeURIComponent(collection.name)}`,
    );
  };

  const handleToggleCollectionPanel = (collection: CollectionSummary) => {
    setOpenMenuCollectionId(null);
    setSelectedCollectionId((current) => (current === collection.id ? null : collection.id));
  };

  const handleRemoveCollectionProduct = async (productId: string) => {
    if (!selectedCollectionId || removingCollectionProductId) return;

    setRemovingCollectionProductId(productId);

    try {
      await removeProductFromCollection(selectedCollectionId, productId);
      setCollectionProducts((current) => current.filter((product) => product.id !== productId));
      if (user?.id) await loadCollectionData(user.id);
    } catch {
      veloToast.error("Não foi possível remover o produto da coleção.");
    } finally {
      setRemovingCollectionProductId(null);
    }
  };

  return (
    <main
      className="relative -m-5 min-h-screen overflow-visible bg-white pb-24 text-[#111111] sm:-m-6 lg:-m-7"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif" }}
    >
      {collections.length > 0 ? (
        <section className="min-h-screen bg-[#F2F2F1] px-3 py-3 sm:px-5">
          <div className="mx-auto w-full max-w-[1180px]">
            <CollectionsOverview kpis={collectionKpis} />

            <div className="mt-4 overflow-visible rounded-[16px] border-[0.5px] border-[#E5E5E5] bg-white px-6 py-5 shadow-[0_10px_26px_rgba(17,17,17,0.025)]">
              <header className="flex items-center justify-between gap-6">
                <div className="flex items-baseline">
                  <h1 className="text-[18px] font-semibold leading-none tracking-[-0.02em] text-black">
                    Minhas Coleções
                  </h1>
                  <p className="ml-2 text-[13px] font-medium text-[#999]">
                    {collections.length} coleção{collections.length === 1 ? "" : "ões"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-black px-4 py-2 text-[13px] font-medium leading-none text-white transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                  Nova Coleção
                </button>
              </header>

              <section className="mt-4">
                {collections.length > 0 ? (
                  <div
                    ref={carouselRef}
                    onMouseDown={handleCarouselMouseDown}
                    onMouseMove={handleCarouselMouseMove}
                    onMouseUp={stopCarouselDrag}
                    onMouseLeave={stopCarouselDrag}
                    onClickCapture={handleCarouselClickCapture}
                    className="flex cursor-grab flex-nowrap gap-4 overflow-x-auto overflow-y-visible pb-1 active:cursor-grabbing [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {collections.map((collection) => (
                      <CollectionDashboardCard
                        key={collection.id}
                        collection={collection}
                        deleting={deletingCollectionId === collection.id}
                        expanded={selectedCollectionId === collection.id}
                        menuOpen={openMenuCollectionId === collection.id}
                        onToggleExpanded={() => handleToggleCollectionPanel(collection)}
                        onToggleMenu={() =>
                          setOpenMenuCollectionId((current) => (current === collection.id ? null : collection.id))
                        }
                        onAddProducts={() => handleAddProductsToCollection(collection)}
                        onEdit={() => openRenameCollectionModal(collection)}
                        onDelete={() => handleDeleteCollection(collection)}
                      />
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(true)}
                    className="flex h-[200px] w-[200px] shrink-0 flex-col items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-[#E0E0E0] bg-[#FAFAF9] text-[#999] transition-colors hover:border-[#CFCFCF] hover:text-[#666]"
                  >
                    <Plus className="h-6 w-6" strokeWidth={1.8} />
                    <span className="mt-2 text-[13px] font-medium">Criar primeira coleção</span>
                  </button>
                )}
                {selectedCollection ? (
                  <CollectionProductsPanel
                    collection={selectedCollection}
                    products={collectionProducts}
                    loading={loadingCollectionProducts}
                    removingProductId={removingCollectionProductId}
                    onAddProducts={() => handleAddProductsToCollection(selectedCollection)}
                    onRemoveProduct={handleRemoveCollectionProduct}
                  />
                ) : null}
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
        creating={creatingCollection}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateCollection}
      />
      <RenameCollectionModal
        open={Boolean(renamingCollection)}
        name={renameCollectionName}
        saving={savingRename}
        onNameChange={setRenameCollectionName}
        onClose={closeRenameCollectionModal}
        onSave={handleRenameCollection}
      />
    </main>
  );
};

export default DashboardHomePage;
