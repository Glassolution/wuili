// Página "Resultados" do mobile (Velo Analytics — "Seus resultados").
//
// Restaurada a partir do commit 50e80a6 ("mobile legal"), onde este bloco
// vivia dentro de DashboardHomePage.tsx como o componente MobileResultsOverview.
// Depois que o DashboardHomePage foi reduzido para cuidar só do desktop/home, a
// aba Resultados passou a reaproveitar a home e mostrava o catálogo. Aqui a view
// volta como página própria e autossuficiente, sem depender do DashboardHomePage.
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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
    { label: "Vendas brutas", value: "—", trend: "—" },
    { label: "Descontos", value: "—", trend: "—" },
    { label: "Devoluções", value: "—", trend: "—" },
    { label: "Vendas líquidas", value: "—", trend: "—" },
    { label: "Frete cobrado", value: "—", trend: "—" },
    { label: "Taxas de devolução", value: "—", trend: "—" },
    { label: "Impostos", value: "—", trend: "—" },
    { label: "Vendas totais", value: "—", trend: "—" },
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = ordersResult.value.data ?? [];
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
      { label: "Vendas brutas", value: formatCurrency(revenue), trend: salesTrend },
      { label: "Descontos", value: formatCurrency(0), trend: "—" },
      { label: "Devoluções", value: `-${formatCurrency(returnedRevenue)}`, trend: returnedRevenue > 0 ? "↘ 39%" : "—" },
      { label: "Vendas líquidas", value: formatCurrency(Math.max(revenue - returnedRevenue, 0)), trend: salesTrend },
      { label: "Frete cobrado", value: formatCurrency(0), trend: "—" },
      { label: "Taxas de devolução", value: formatCurrency(0), trend: "—" },
      { label: "Impostos", value: formatCurrency(0), trend: "—" },
      { label: "Vendas totais", value: formatCurrency(revenue), trend: salesTrend },
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

type SoldProductSummary = {
  key: string;
  title: string;
  image: string | null;
  quantity: number;
  revenue: number;
  lastSoldAt: string | null;
};

type OrderProductRow = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "id" | "product_title" | "product_image" | "quantity" | "sale_price" | "total_amount" | "ordered_at" | "created_at" | "status"
>;

const formatShortDate = (dateValue: string | null) => {
  if (!dateValue) return "Sem data";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
};

const loadSoldProducts = async (userId: string): Promise<SoldProductSummary[]> => {
  const { data, error } = await supabase
    .from("orders")
    .select("id,product_title,product_image,quantity,sale_price,total_amount,ordered_at,created_at,status")
    .eq("user_id", userId)
    .order("ordered_at", { ascending: false, nullsFirst: false })
    .limit(40);

  if (error) throw error;

  const rows = ((data ?? []) as OrderProductRow[]).filter((order) => {
    const status = String(order.status || "").toLowerCase();
    return !["cancelled", "canceled", "refunded", "returned"].includes(status);
  });

  const grouped = rows.reduce<Map<string, SoldProductSummary>>((map, order) => {
    const title = order.product_title || "Produto vendido";
    const key = title.trim().toLowerCase();
    const quantity = Number(order.quantity || 1);
    const revenue = Number(order.total_amount ?? order.sale_price * quantity ?? 0);
    const soldAt = order.ordered_at || order.created_at;
    const current = map.get(key);

    if (!current) {
      map.set(key, {
        key,
        title,
        image: order.product_image,
        quantity,
        revenue,
        lastSoldAt: soldAt,
      });
      return map;
    }

    current.quantity += quantity;
    current.revenue += revenue;
    if (!current.image && order.product_image) current.image = order.product_image;
    if (soldAt && (!current.lastSoldAt || new Date(soldAt) > new Date(current.lastSoldAt))) {
      current.lastSoldAt = soldAt;
    }
    return map;
  }, new Map<string, SoldProductSummary>());

  return Array.from(grouped.values())
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
    .slice(0, 5);
};

const ResultsPage = () => {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<CollectionKpis>(emptyKpis);
  const [soldProducts, setSoldProducts] = useState<SoldProductSummary[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    void loadCollectionKpis(user.id).then((nextKpis) => {
      if (isMounted) setKpis(nextKpis);
    });
    void loadSoldProducts(user.id)
      .then((products) => {
        if (isMounted) setSoldProducts(products);
      })
      .catch(() => {
        if (isMounted) setSoldProducts([]);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const chartValues = kpis.monthlySales.some((value) => value > 0) ? kpis.monthlySales : kpis.monthlyOrders;
  const metrics = [
    ["Vendas", kpis.revenue, "Receita confirmada"],
    ["Pedidos", kpis.orders, "Vendas registradas"],
    ["Entregues", kpis.fulfilledOrders, "Pedidos finalizados"],
    ["Ticket médio", kpis.averageOrderValue, "Valor por pedido"],
    ["Publicados", kpis.activePublications, "Anúncios ativos"],
    ["Recorrência", kpis.returningCustomerRate, "Clientes que voltam"],
  ];

  return (
    <section className="-mx-1 -mt-1 min-h-screen bg-[#F1F3F7] px-3 pb-5 pt-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-black/38">Velo Analytics</p>
          <h1 className="mt-0.5 text-[19px] font-black tracking-[-0.04em] text-[#111111]">Seus resultados</h1>
        </div>
      </div>

      <article className="mt-4 overflow-hidden rounded-[18px] border border-white/70 bg-white/72 p-3 shadow-[0_18px_42px_rgba(33,45,66,0.07)]">
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <h2 className="text-[15px] font-black tracking-[-0.03em] text-[#111111]">Atividade de vendas</h2>
          <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-black/55 shadow-[0_6px_14px_rgba(17,17,17,0.04)]">6 meses</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {metrics.map(([label, value, description]) => (
            <article key={label} className="relative min-h-[106px] rounded-[16px] bg-[#F8F8FB] px-4 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8)]">
              <p className="text-[22px] font-black leading-none tracking-[-0.05em] text-[#111111]">{value}</p>
              <p className="mt-4 text-[11px] font-semibold leading-tight text-black/45">{label}</p>
              <p className="mt-1 line-clamp-1 text-[9px] font-semibold text-black/28">{description}</p>
            </article>
          ))}
        </div>
      </article>

      <article className="mt-4 rounded-[18px] border border-white/70 bg-white/82 p-4 shadow-[0_18px_42px_rgba(33,45,66,0.07)]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold text-black/45">Evolução das vendas</p>
            <p className="mt-1 text-[25px] font-black tracking-[-0.05em] text-[#111111]">{kpis.revenue}</p>
          </div>
          <span className="rounded-full bg-[#F1F3F7] px-3 py-1.5 text-[11px] font-black text-black/50">6 meses</span>
        </div>
        <Sparkline values={chartValues} className="mt-5 h-[86px] w-full" />
      </article>

      <article className="mt-4 overflow-hidden rounded-[18px] border border-white/70 bg-white/86 shadow-[0_18px_42px_rgba(33,45,66,0.07)]">
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
          <h2 className="text-[15px] font-black tracking-[-0.03em] text-[#111111]">Produtos vendidos</h2>
        </div>

        {soldProducts.length > 0 ? (
          <div className="divide-y divide-black/[0.06]">
            {soldProducts.map((product) => (
              <div key={product.key} className="flex gap-3 px-4 py-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#EEF1F5]">
                  {product.image ? (
                    <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[18px]">📦</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-[13px] font-black tracking-[-0.02em] text-[#111111]">{product.title}</p>
                      <p className="mt-0.5 text-[10px] font-semibold text-black/42">{product.quantity} vendido{product.quantity === 1 ? "" : "s"}</p>
                    </div>
                    <span className="shrink-0 text-[12px] font-black text-[#111111]">{formatCurrency(product.revenue)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-semibold text-black/42">
                    <span>Última venda {formatShortDate(product.lastSoldAt)}</span>
                    <span>Mercado Livre</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 pb-5 pt-2">
            <div className="rounded-[16px] bg-[#F8F8FB] px-4 py-6 text-center">
              <p className="text-[13px] font-black tracking-[-0.02em] text-[#111111]">Nenhum produto vendido ainda</p>
              <p className="mt-1 text-[11px] font-semibold text-black/42">Quando entrarem pedidos, eles aparecem aqui.</p>
            </div>
          </div>
        )}
      </article>
    </section>
  );
};

export default ResultsPage;
