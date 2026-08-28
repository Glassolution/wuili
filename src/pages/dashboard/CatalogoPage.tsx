import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ArrowUpRight,
  Bell,
  Box,
  ShoppingBag,
  Eye,
  Percent,
  Star,
  Heart,
  CheckCircle,
  AlertTriangle,
  Info,
  Package,
  MoreHorizontal,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { supabase, withFreshSupabaseSession } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import { proxyImageList } from "@/lib/imageProxy";
import type { Database, Json } from "@/integrations/supabase/types";
import { ProductCard, ProductCardSkeleton, type Product, formatPrice } from "@/components/dashboard/ProductCard";
import {
  displayOrdersCountFor,
  displayRatingFor,
  isRatingFilterNoop,
  matchesDisplayRating,
  type RatingOption,
} from "@/lib/catalogFilters";
import {
  addProductToCollection,
  getCollectionProductIds,
  removeProductFromCollection,
} from "@/lib/collectionsApi";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";
import { useAtlasChat } from "@/contexts/AtlasChatContext";

type CatalogProductRow = Database["public"]["Tables"]["catalog_products"]["Row"];

type AtlasResults = {
  ids: string[];
  label: string;
  source: "preference" | "ai" | "fallback";
};

// ─── Dashboard Metrics Types ──────────────────────────────────────────────────
type ProfileRow = {
  display_name: string | null;
  loja_nome: string | null;
};

type PublicationRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  published_at: string | null;
};

type OrderRow = {
  id: string;
  product_title: string | null;
  sale_price: number | string | null;
  status: string | null;
  ordered_at: string | null;
  created_at: string | null;
  platform?: string | null;
};

type ActivityLogRow = {
  id: string;
  message: string | null;
  created_at: string | null;
};

type MetricsCatalogProductRow = {
  category: string | null;
  orders_count: number | null;
  margin_percent: number;
};

type RevenuePoint = {
  label: string;
  value: number;
};

// ─── Dashboard Metrics Helpers ────────────────────────────────────────────────
const toNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  });

const formatShortDate = (value?: string | null) => {
  if (!value) return "Agora";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
};

const getName = (profile?: ProfileRow | null, email?: string | null) => {
  const raw = profile?.loja_nome || profile?.display_name || email?.split("@")[0] || "Velo";
  return raw
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const buildRevenueSeries = (orders: OrderRow[]): RevenuePoint[] => {
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: labels[date.getMonth()],
      value: 0,
    };
  });

  orders.forEach((order) => {
    const date = new Date(order.ordered_at || order.created_at || "");
    if (Number.isNaN(date.getTime())) return;

    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const point = months.find((month) => month.key === key);
    if (point) point.value += toNumber(order.sale_price);
  });

  return months.map(({ label, value }) => ({ label, value }));
};

// MOCK: dados históricos fictícios de visualizações
const viewsChartData = [
  { date: "Jan", views: 120 },
  { date: "Feb", views: 150 },
  { date: "Mar", views: 220 },
  { date: "Apr", views: 180 },
  { date: "May", views: 240 },
  { date: "Jun", views: 310 },
  { date: "Jul", views: 280 },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      label: string;
      value: number;
    };
  }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-black/[0.08] bg-white p-3 shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
        <p className="text-[12px] font-bold text-neutral-800">{formatBRL(data.value)}</p>
        <p className="text-[10px] font-medium text-neutral-400">{data.label}</p>
      </div>
    );
  }
  return null;
};

// ─── Dashboard Metrics Components ─────────────────────────────────────────────
interface KPICardProps {
  label: string;
  value: string;
  delta?: string;
  isPositive?: boolean;
  isMock?: boolean;
}

const KPICard = ({ label, value, delta, isPositive = true, isMock = false }: KPICardProps) => {
  const hasGrowth = delta && delta !== "0%" && delta !== "--";
  return (
    <div className="bg-white border border-black/[0.06] rounded-xl p-4 flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] relative min-w-0">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9.5px] font-bold text-neutral-400 uppercase tracking-wider truncate block leading-none">
          {label}
        </span>
        {isMock && (
          <span className="text-[7.5px] font-bold text-neutral-400 bg-neutral-100 px-1 py-0.5 rounded leading-none shrink-0 scale-90 origin-right">
            MOCK
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2 leading-none flex-wrap">
        <strong className="text-2xl font-bold tracking-tight text-neutral-800 leading-none truncate">
          {value}
        </strong>
        {hasGrowth && (
          <span className={`text-[10.5px] font-bold inline-flex items-center gap-0.5 shrink-0 ${
            isPositive ? "text-emerald-600" : "text-red-600"
          }`}>
            <span>{delta}</span>
            <span className="text-[9px]">{isPositive ? "↗" : "↘"}</span>
          </span>
        )}
      </div>
    </div>
  );
};

const PerformanceGeneralCard = ({ orders }: { orders: OrderRow[] }) => {
  const [activeTab, setActiveTab] = useState("visao");

  // Visão Geral Series: Total revenue monthly
  const visaoSeries = useMemo(() => buildRevenueSeries(orders), [orders]);

  // Por Canal Series: Mercado Livre (platform === "mercadolivre") revenue monthly
  const canalSeries = useMemo(() => {
    const mlOrders = orders.filter((o) => String(o.platform || "").toLowerCase() === "mercadolivre");
    return buildRevenueSeries(mlOrders);
  }, [orders]);

  // Por Produto Series: Revenue monthly of the top-selling product
  const topProductData = useMemo(() => {
    const productRevenueMap = new Map<string, number>();
    orders.forEach((o) => {
      if (o.product_title) {
        productRevenueMap.set(o.product_title, (productRevenueMap.get(o.product_title) ?? 0) + toNumber(o.sale_price));
      }
    });

    let topProduct = "";
    let maxRevenue = -1;
    productRevenueMap.forEach((revenue, title) => {
      if (revenue > maxRevenue) {
        maxRevenue = revenue;
        topProduct = title;
      }
    });

    const topProductOrders = orders.filter((o) => o.product_title === topProduct);
    const series = buildRevenueSeries(topProductOrders);

    return { title: topProduct || "Nenhum produto", series, total: maxRevenue > 0 ? maxRevenue : 0 };
  }, [orders]);

  const activeSeries = useMemo(() => {
    if (activeTab === "canal") return canalSeries;
    if (activeTab === "produto") return topProductData.series;
    return visaoSeries;
  }, [activeTab, visaoSeries, canalSeries, topProductData]);

  const totalPeriod = useMemo(() => {
    return activeSeries.reduce((sum, item) => sum + item.value, 0);
  }, [activeSeries]);

  const footerText = useMemo(() => {
    if (activeTab === "canal") return `Total ML: ${formatBRL(totalPeriod)}`;
    if (activeTab === "produto") return `${topProductData.title.slice(0, 15)}... (${formatBRL(topProductData.total)})`;
    return `Faturamento Real: ${formatBRL(totalPeriod)}`;
  }, [activeTab, totalPeriod, topProductData]);

  return (
    <div className="h-full flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      <div>
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center bg-neutral-50 p-1 rounded-lg border border-black/[0.04] text-[11px] font-bold text-neutral-500">
            <button
              onClick={() => setActiveTab("visao")}
              className={`px-3 py-1 rounded-md transition-colors ${activeTab === "visao" ? "bg-white text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-black/[0.03]" : "hover:text-neutral-800"}`}
            >
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab("canal")}
              className={`px-3 py-1 rounded-md transition-colors ${activeTab === "canal" ? "bg-white text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-black/[0.03]" : "hover:text-neutral-800"}`}
            >
              Por Canal
            </button>
            <button
              onClick={() => setActiveTab("produto")}
              className={`px-3 py-1 rounded-md transition-colors ${activeTab === "produto" ? "bg-white text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-black/[0.03]" : "hover:text-neutral-800"}`}
            >
              Por Produto
            </button>
          </div>
          
          <div className="flex items-center gap-1.5 rounded-lg border border-black/[0.06] px-2.5 py-1 text-[11px] font-medium text-neutral-600 bg-neutral-50/50 self-end sm:self-auto">
            <span>Este Mês</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activeSeries} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                stroke="#A3A3A3"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis hide domain={['auto', 'auto']} />
              <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#E5E5E5', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10B981"
                strokeWidth={1.8}
                fillOpacity={1}
                fill="url(#colorViews)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-5 flex items-baseline gap-2 leading-none border-t border-black/[0.03] pt-4 flex-wrap">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total do Período:</span>
        <strong className="text-sm font-bold text-neutral-800">{footerText}</strong>
        <span className="text-[10px] text-neutral-400 ml-auto italic">
          // Receita real. Visualizações em mock (TODO: aguardando métricas)
        </span>
      </div>
    </div>
  );
};

const Sparkline = ({ points, color = "#18181B" }: { points: number[]; color?: string }) => {
  const width = 60;
  const height = 16;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min;
  const svgPoints = points
    .map((p, i) => {
      const x = points.length <= 1 ? 0 : (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
  
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={svgPoints}
      />
    </svg>
  );
};

const channelsData = [
  { name: "Mercado Livre Orgânico", points: [10, 15, 8, 22, 14, 25, 18], color: "#18181B" },
  { name: "Redes Sociais", points: [5, 12, 10, 8, 14, 11, 16], color: "#525252" },
  { name: "Tráfego Direto", points: [8, 6, 9, 11, 8, 12, 10], color: "#737373" },
  { name: "Google Ads", points: [15, 20, 12, 28, 22, 30, 26], color: "#a3a3a3" },
  { name: "Indicação", points: [3, 5, 2, 7, 4, 8, 6], color: "#e5e5e5" },
];

const TrafficByChannelCard = () => {
  // TODO: aguardando campos ml_channel e ml_flows da tabela orders (Parte A)
  // Renomear para "Canal de Venda" após Parte A ser aplicada
  return (
    <div className="h-full flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Tráfego por Canal</p>
          <span className="text-[8px] font-bold text-neutral-400 uppercase bg-neutral-100 px-1.5 py-0.5 rounded leading-none">MOCK</span>
        </div>
        
        <div className="space-y-4 mt-4">
          {channelsData.map((chan) => (
            <div key={chan.name} className="flex items-center justify-between gap-4 py-0.5 border-b border-black/[0.02] last:border-0 pb-2.5 last:pb-0">
              <span className="text-[12px] font-semibold text-neutral-600 truncate">{chan.name}</span>
              <div className="shrink-0 flex items-center">
                <Sparkline points={chan.points} color={chan.color} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ProductAnalysisChartCardProps {
  catalogProducts: MetricsCatalogProductRow[];
}

const ProductAnalysisChartCard = ({ catalogProducts }: ProductAnalysisChartCardProps) => {
  const categoryChartData = useMemo(() => {
    const categoryMap = new Map<string, { category: string; sales: number; totalMargin: number; count: number }>();
    
    catalogProducts.forEach((prod) => {
      const cat = (prod.category || "Outros").trim();
      const current = categoryMap.get(cat) ?? { category: cat, sales: 0, totalMargin: 0, count: 0 };
      current.sales += prod.orders_count ?? 0;
      current.totalMargin += prod.margin_percent ?? 0;
      current.count += 1;
      categoryMap.set(cat, current);
    });

    const list = Array.from(categoryMap.values()).map((item, index) => {
      const colors = ["#18181B", "#3F3F46", "#71717A", "#A1A1AA", "#D4D4D8", "#E4E4E7"];
      const color = colors[index % colors.length];
      return {
        category: item.category,
        sales: item.sales,
        avgMargin: item.count > 0 ? Math.round(item.totalMargin / item.count) : 0,
        color,
      };
    });

    list.sort((a, b) => b.sales - a.sales);

    const totalSales = list.reduce((sum, item) => sum + item.sales, 0);
    if (totalSales === 0) {
      return [
        { category: "Eletrônicos", sales: 120, avgMargin: 15, color: "#18181B" },
        { category: "Casa", sales: 240, avgMargin: 20, color: "#3F3F46" },
        { category: "Moda", sales: 180, avgMargin: 25, color: "#71717A" },
        { category: "Beleza", sales: 300, avgMargin: 18, color: "#A1A1AA" },
        { category: "Acessórios", sales: 100, avgMargin: 30, color: "#D4D4D8" },
        { category: "Outros", sales: 210, avgMargin: 12, color: "#E4E4E7" },
      ].sort((a, b) => b.sales - a.sales);
    }

    return list.slice(0, 6);
  }, [catalogProducts]);

  const isMock = useMemo(() => {
    const totalSales = catalogProducts.reduce((sum, item) => sum + (item.orders_count ?? 0), 0);
    return totalSales === 0;
  }, [catalogProducts]);

  return (
    <div className="h-full flex flex-col justify-between rounded-[16px] border border-black/[0.07] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Análise de Produtos</p>
          {isMock && (
            <span className="text-[8px] font-bold text-neutral-400 uppercase bg-neutral-100 px-1.5 py-0.5 rounded leading-none">
              MOCK
            </span>
          )}
        </div>
        
        <div className="h-[180px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryChartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
              <XAxis 
                dataKey="category" 
                fontSize={9} 
                tickLine={false} 
                axisLine={false} 
                stroke="#888888" 
              />
              <YAxis 
                fontSize={9} 
                tickLine={false} 
                axisLine={false} 
                stroke="#888888" 
              />
              <Bar dataKey="sales" radius={[4, 4, 0, 0]} barSize={24}>
                {categoryChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

interface MLPublicationsDonutCardProps {
  success: number;
  failed: number;
  pending: number;
  total: number;
}

const MLPublicationsDonutCard = ({ success, failed, pending, total }: MLPublicationsDonutCardProps) => {
  const navigate = useNavigate();
  const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
  const hasData = success > 0 || failed > 0 || pending > 0;
  
  const chartData = hasData 
    ? [
        { name: "Sucesso", value: success, color: "#18181B" },
        { name: "Falha", value: failed, color: "#71717A" },
        { name: "Pendente", value: pending, color: "#E4E4E7" },
      ]
    : [
        { name: "Sucesso (Mock)", value: 75, color: "#18181B" },
        { name: "Falha (Mock)", value: 15, color: "#71717A" },
        { name: "Pendente (Mock)", value: 10, color: "#E4E4E7" },
      ];

  const displayRate = hasData ? successRate : 75;
  const displayFailed = hasData ? failed : 3;

  return (
    <div className="h-full flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Publicações ML</p>
          <span className="text-[8px] font-bold text-neutral-400 bg-neutral-50 border border-black/[0.04] px-1.5 py-0.5 rounded leading-none">
            Status
          </span>
        </div>

        <div className="flex items-center gap-4 mt-3">
          <div className="relative flex h-[110px] w-[110px] shrink-0 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={48}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={0}
                  dataKey="value"
                  cornerRadius={0}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold tracking-tight text-neutral-800 leading-none">{displayRate}%</span>
              <span className="text-[7.5px] font-bold text-neutral-400 uppercase tracking-wider leading-none mt-1">SUCESSO</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-1.5 text-[10.5px] font-medium text-neutral-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#18181B]" />
                <span>Sucesso</span>
              </div>
              <strong className="text-neutral-800">{hasData ? success : 75}</strong>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#71717A]" />
                <span>Falhas</span>
              </div>
              <strong className="text-neutral-800">{hasData ? failed : 15}</strong>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#E4E4E7]" />
                <span>Pendentes</span>
              </div>
              <strong className="text-neutral-800">{hasData ? pending : 10}</strong>
            </div>
          </div>
        </div>
      </div>

      {displayFailed > 0 && (
        <div className="mt-4 border-t border-black/[0.04] pt-3 text-center flex justify-center">
          <button
            type="button"
            onClick={() => navigate("/dashboard/produtos")}
            className="inline-flex items-center gap-1 text-[9.5px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-0.5 rounded-full transition-all border border-red-100/50 leading-none"
          >
            <span>{displayFailed} falhas — Resolver</span>
            <ArrowUpRight className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
    </div>
  );
};

const getStatusIcon = (message: string) => {
  const msg = message.toLowerCase();
  if (msg.includes("sucesso") || msg.includes("importado") || msg.includes("sincronizado")) {
    return (
      <span className="grid h-6.5 w-6.5 place-items-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
        <CheckCircle className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (msg.includes("erro") || msg.includes("falha") || msg.includes("falhou") || msg.includes("limit")) {
    return (
      <span className="grid h-6.5 w-6.5 place-items-center rounded-full bg-red-50 text-red-600 border border-red-100 shrink-0">
        <AlertTriangle className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span className="grid h-6.5 w-6.5 place-items-center rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200 shrink-0">
      <Info className="h-3.5 w-3.5" />
    </span>
  );
};

const SidebarRecentLogs = ({ activities }: { activities: ActivityLogRow[] }) => {
  const mockActivities: ActivityLogRow[] = [
    { id: "mock-1", message: "Produto importado com sucesso", created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
    { id: "mock-2", message: "Erro ao publicar no Mercado Livre", created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
    { id: "mock-3", message: "Estoque sincronizado automaticamente", created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString() },
  ];
  
  const displayActivities = activities.length > 0 ? activities : mockActivities;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between leading-none">
        <p className="text-[11.5px] font-bold text-neutral-800 uppercase tracking-tight">Atividade Recente</p>
        {activities.length === 0 && <span className="text-[7.5px] font-bold text-neutral-400 uppercase bg-neutral-100 px-1 py-0.5 rounded leading-none">MOCK</span>}
      </div>
      <div className="space-y-3">
        {displayActivities.slice(0, 3).map((act) => (
          <div key={act.id} className="flex items-start gap-2.5">
            {getStatusIcon(act.message || "")}
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-semibold text-neutral-700 leading-snug">{act.message}</p>
              <span className="text-[9px] text-neutral-400 leading-none mt-0.5 block">{formatShortDate(act.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SidebarAtlasSuggestions = () => {
  const navigate = useNavigate();
  const recommendations = [
    { name: "Fone Bluetooth Pro", badge: "Margem 65%", time: "Recém adicionado" },
    { name: "Mini Projetor HD", badge: "Alta Demanda", time: "Em alta na C7Drop" },
    { name: "Suporte MagSafe", badge: "Viral TikTok", time: "Mais importado" },
  ];
  
  return (
    <div className="space-y-3 border-t border-black/[0.04] pt-4">
      <div className="flex items-center justify-between leading-none">
        <p className="text-[11.5px] font-bold text-neutral-800 uppercase tracking-tight">Sugestões do Aquas</p>
        <span className="text-[7.5px] font-bold text-neutral-400 uppercase bg-neutral-100 px-1 py-0.5 rounded leading-none">MOCK</span>
      </div>
      <div className="space-y-2.5">
        {recommendations.map((prod, i) => (
          <div key={i} className="flex items-center gap-2.5 border-b border-black/[0.02] pb-2.5 last:border-0 last:pb-0">
            <span className="grid h-7.5 w-7.5 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500 border border-black/[0.04]">
              <Package className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-bold text-neutral-800 truncate leading-tight">{prod.name}</p>
              <div className="flex items-center gap-1.5 mt-1 leading-none">
                <span className="text-[9px] font-semibold text-neutral-500 bg-neutral-50 px-1.5 py-0.5 rounded inline-block">{prod.badge}</span>
                <span className="text-[8.5px] text-neutral-400 truncate">{prod.time}</span>
              </div>
            </div>
            <button
              onClick={() => navigate("/dashboard/catalogo")}
              className="h-6 px-2 text-[10px] font-bold bg-[#18181B] text-white rounded transition-colors hover:bg-neutral-800 shrink-0"
            >
              Importar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const SidebarCustomers = () => {
  // TODO: aguardando tabela customers (Parte A)
  const customers = [
    { name: "Luis Silva", total: 254.0, avatar: "LS" },
    { name: "Ana Santos", total: 180.0, avatar: "AS" },
    { name: "Pedro Gomez", total: 90.0, avatar: "PG" },
  ];
  return (
    <div className="space-y-3 border-t border-black/[0.04] pt-4">
      <div className="flex items-center justify-between leading-none">
        <p className="text-[11.5px] font-bold text-neutral-800 uppercase tracking-tight">Clientes Recentes</p>
        <span className="text-[7.5px] font-bold text-neutral-400 uppercase bg-neutral-100 px-1 py-0.5 rounded leading-none">MOCK</span>
      </div>
      <div className="space-y-2.5">
        {customers.map((cust, i) => (
          <div key={i} className="flex items-center gap-2.5 leading-none">
            <span className="grid h-7.5 w-7.5 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-600 border border-black/[0.04] text-[9.5px] font-bold">
              {cust.avatar}
            </span>
            <div className="min-w-0">
              <span className="text-[11.5px] font-semibold text-neutral-800 truncate block leading-none">{cust.name}</span>
              <span className="text-[9.5px] text-neutral-400 block mt-1 leading-none">Total gasto: {formatBRL(cust.total)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SidebarDrawerFooter = () => {
  const navigate = useNavigate();
  return (
    <div className="mt-2 space-y-3 pt-4 border-t border-black/[0.04]">
      <div className="rounded-xl bg-neutral-50 border border-black/[0.04] p-3 text-[11px]">
        <p className="font-bold text-neutral-800 leading-none flex items-center gap-1">
          <Box className="h-3 w-3 shrink-0" />
          Impulsione com IA
        </p>
        <p className="text-neutral-400 mt-1 leading-snug">
          Faça upgrade para o Pro e desbloqueie ferramentas de IA.
        </p>
        <button
          onClick={() => navigate("/dashboard/planos")}
          className="mt-2 text-neutral-800 hover:text-neutral-600 font-bold inline-flex items-center gap-0.5"
        >
          Ver Planos <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      
      <button
        onClick={() => navigate("/dashboard/catalogo")}
        className="text-center font-bold text-[11px] text-[#18181B] hover:opacity-75 transition-opacity w-full block py-1"
      >
        Explorar catálogo completo →
      </button>
    </div>
  );
};

/**
 * Categoria ativa do catálogo.
 *
 * "todos" e "favoritos" são pseudo-categorias da interface; qualquer outro valor
 * é EXATAMENTE o que está gravado em catalog_products.category.
 *
 * Antes existia uma lista de 13 chaves fixas mapeadas à mão para valores do
 * banco. A taxonomia vem do scraping do fornecedor e mudou num sync: 11 das 13
 * opções passaram a retornar zero produto, e o filtro inteiro do catálogo parou
 * de funcionar sem ninguém perceber. Agora a lista vem do próprio banco, então
 * um novo sync se resolve sozinho.
 */
type CategoryKey = "todos" | "favoritos" | (string & {});

const CATEGORIA_TODOS = "todos";
const CATEGORIA_FAVORITOS = "favoritos";

const rotuloDaCategoria = (valor: CategoryKey) => {
  if (valor === CATEGORIA_TODOS) return "Todos os produtos";
  if (valor === CATEGORIA_FAVORITOS) return "Favoritos";
  return valor;
};

type CategoriaDoBanco = { valor: string; total: number };

const PRICE_OPTIONS = ["Todos os preços", "Até R$ 50", "R$ 50-150", "Acima de R$ 150"];
const RATING_OPTIONS: RatingOption[] = ["Todas", "4+ estrelas", "4.5+ estrelas"];

const getPriceRangeBounds = (range: string): { min?: number; max?: number } => {
  if (range === "Até R$ 50") return { max: 50 };
  if (range === "R$ 50-150") return { min: 50, max: 150 };
  if (range === "Acima de R$ 150") return { min: 150 };
  return {};
};

const getRatingMinimum = (rating: string) => {
  if (rating === "4+ estrelas") return 4;
  if (rating === "4.5+ estrelas") return 4.5;
  return null;
};

const productMatchesSelectedFilters = (
  product: Product,
  priceRange: string,
  ratingRange: string,
) => {
  const priceBounds = getPriceRangeBounds(priceRange);
  const ratingMinimum = getRatingMinimum(ratingRange);
  if (typeof priceBounds.min === "number" && product.preco < priceBounds.min) return false;
  if (typeof priceBounds.max === "number" && product.preco > priceBounds.max) return false;
  if (ratingMinimum !== null && !matchesDisplayRating(product.id, ratingRange as RatingOption)) return false;
  return true;
};

const getProductImages = (images: Json | null): string[] => {
  if (!images) return [];
  const raw: string[] = (() => {
    if (Array.isArray(images)) {
      return images.filter((image): image is string => typeof image === "string");
    }
    if (typeof images === "string") {
      try {
        const parsed: unknown = JSON.parse(images);
        return Array.isArray(parsed)
          ? parsed.filter((image): image is string => typeof image === "string")
          : [images];
      } catch {
        return [images];
      }
    }
    return [];
  })();
  return proxyImageList(raw);
};



const getCompactFilterValue = (value: string) =>
  value
    .replace("Todos os produtos", "Todos")
    .replace("Todos os preços", "Todos");

const getCompactFilterLabel = (label: string) => (label === "Faixa de preço" ? "Preço" : label);

const FilterDropdown = ({
  label,
  value,
  isOpen,
  onToggle,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  options: string[];
  onSelect: (value: string) => void;
}) => (
  <div className="relative min-w-[138px] md:min-w-[150px]">
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-full border border-black/[0.08] bg-white px-3 text-[10.5px] font-semibold text-[#151515] shadow-[0_8px_18px_rgba(17,17,17,0.035)] backdrop-blur-sm transition-all duration-200 hover:border-black/15 md:h-9 md:px-3.5 md:text-[12px]"
    >
      <span className="truncate">
        <span className="text-[#777771]">{getCompactFilterLabel(label)}</span>
        <span className="mx-1.5 text-[#C7C7C0]">/</span>
        {getCompactFilterValue(value)}
      </span>
      <ChevronDown size={14} strokeWidth={1.8} className={`shrink-0 text-[#777771] transition-transform ${isOpen ? "rotate-180" : ""}`} />
    </button>

    {isOpen && (
      <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-[240px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[16px] border border-black/[0.08] bg-white p-1.5 shadow-[0_18px_44px_rgba(17,17,17,0.10)]">
        <div className="max-h-[278px] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            title={option}
            className={`flex h-9 w-full items-center rounded-[12px] px-3 text-left text-[12px] leading-none transition-colors ${
              value === option ? "bg-[#F0F0EC] font-semibold text-[#111111]" : "text-[#4B5563] hover:bg-[#F7F7F4]"
            }`}
          >
            <span className="block min-w-0 truncate">{option}</span>
          </button>
        ))}
        </div>
      </div>
    )}
  </div>
);

const CatalogoPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { abrirLateral, aberto: atlasAberto } = useAtlasChat();
  const selectionCollectionId = searchParams.get("collectionId");
  const selectionCollectionName = searchParams.get("collectionName") || "coleção";
  const isCollectionSelectionMode = Boolean(selectionCollectionId);
  // `?categoria=<key>` permite chegar aqui já filtrado — é o que os atalhos de
  // categoria do guia do Atlas usam. Chave desconhecida cai em "todos" em vez de
  // deixar a tela num estado que o dropdown não sabe representar.
  const categoriaDaUrl = searchParams.get("categoria");
  // Aceita o valor da URL como veio: ele é o próprio valor do banco, então não
  // há lista para validar contra. Categoria inexistente simplesmente não traz
  // produto, o que é honesto — e é o mesmo que aconteceria digitando na mão.
  const [activeCategory, setActiveCategory] = useState<CategoryKey>(
    categoriaDaUrl && categoriaDaUrl.trim() ? categoriaDaUrl : CATEGORIA_TODOS,
  );
  const [categoriasDoBanco, setCategoriasDoBanco] = useState<CategoriaDoBanco[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [recommendationIndex, setRecommendationIndex] = useState(0);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriceRange, setSelectedPriceRange] = useState("Todos os preços");
  const [selectedRating, setSelectedRating] = useState<RatingOption>("Todas");
  const [openDropdown, setOpenDropdown] = useState<"category" | "price" | "rating" | null>(null);
  const filterBarRef = useRef<HTMLDivElement | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [favoritedIds, setFavoritedIds] = useState<string[]>([]);
  const [collectionProductIds, setCollectionProductIds] = useState<string[]>([]);
  const [collectionToggleLoadingId, setCollectionToggleLoadingId] = useState<string | null>(null);
  const [atlasResults, setAtlasResults] = useState<AtlasResults | null>(null);
  // Recebe resultados Atlas vindos de outra página (ex: DashboardHomePage)
  useEffect(() => {
    const incoming = (location.state as { atlasResults?: AtlasResults } | null)?.atlasResults;
    if (incoming && incoming.ids.length > 0) {
      setAtlasResults(incoming);
      // Limpa o state da rota para não reaplicar em navegações futuras
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ITEMS_PER_PAGE = 12;

  // Quando o Atlas lateral está aberto o espaço do catálogo reduz; diminuímos
  // o número de colunas para os cards ficarem maiores e visualmente confortáveis.
  const catalogGridClasses = atlasAberto
    ? "grid h-auto grid-cols-2 gap-x-3 gap-y-7 overflow-visible md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4"
    : "grid h-auto grid-cols-2 gap-x-3 gap-y-7 overflow-visible md:grid-cols-3 md:gap-x-5 md:gap-y-9 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";
  const recommendationGridClasses = atlasAberto
    ? "flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 xl:grid-cols-3 md:overflow-visible"
    : "flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 xl:grid-cols-4 md:overflow-visible";

  // Persistência dos favoritos por usuário (localStorage). Chave inclui o id do
  // usuário para não misturar favoritos entre contas no mesmo dispositivo.
  const favoritesStorageKey = useMemo(
    () => `velo-favorites${user?.id ? `-${user.id}` : ""}`,
    [user?.id],
  );
  const favoritesHydrated = useRef(false);

  // Hidrata os favoritos salvos ao montar / trocar de usuário.
  useEffect(() => {
    favoritesHydrated.current = false;
    try {
      const raw = localStorage.getItem(favoritesStorageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      setFavoritedIds(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
    } catch {
      setFavoritedIds([]);
    }
    favoritesHydrated.current = true;
  }, [favoritesStorageKey]);

  // Persiste sempre que a lista muda (após a hidratação, para não sobrescrever o
  // valor salvo com o estado inicial vazio).
  useEffect(() => {
    if (!favoritesHydrated.current) return;
    try {
      localStorage.setItem(favoritesStorageKey, JSON.stringify(favoritedIds));
    } catch {
      // Armazenamento indisponível (modo privado/quota) — favoritos seguem em memória.
    }
  }, [favoritedIds, favoritesStorageKey]);

  const toggleFavorite = (productId: string) => {
    const willFavorite = !favoritedIds.includes(productId);
    setFavoritedIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
    if (willFavorite) {
      veloToast.success("Adicionado aos favoritos");
    } else {
      veloToast.info("Removido dos favoritos");
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchCollectionSelection = async () => {
      if (!selectionCollectionId) {
        setCollectionProductIds([]);
        return;
      }

      try {
        const ids = await getCollectionProductIds(selectionCollectionId);
        if (isMounted) setCollectionProductIds(ids);
      } catch {
        if (isMounted) {
          veloToast.error("Não foi possível carregar os produtos da coleção.");
        }
      }
    };

    fetchCollectionSelection();

    return () => {
      isMounted = false;
    };
  }, [selectionCollectionId]);

  const toggleCollectionProduct = async (productId: string) => {
    if (!selectionCollectionId || collectionToggleLoadingId) return;

    const isSelected = collectionProductIds.includes(productId);
    setCollectionToggleLoadingId(productId);
    setCollectionProductIds((current) =>
      isSelected ? current.filter((id) => id !== productId) : [...current, productId],
    );

    try {
      if (isSelected) {
        await removeProductFromCollection(selectionCollectionId, productId);
      } else {
        await addProductToCollection(selectionCollectionId, productId);
      }
    } catch {
      setCollectionProductIds((current) =>
        isSelected ? [...current, productId] : current.filter((id) => id !== productId),
      );
      veloToast.error("Não foi possível atualizar a coleção.");
    } finally {
      setCollectionToggleLoadingId(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!filterBarRef.current?.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mapProduct = (p: CatalogProductRow): Product => {
    let imgUrls = getProductImages(p.images);
    const defaultImage = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop";
    if (imgUrls.length === 0) {
      imgUrls = [defaultImage];
    }
    const supplierLabel =
      p.source === "aliexpress"
        ? "AliExpress"
        : p.supplier_name ?? (p.source === "c7drop" ? "C7 Drop" : null);
    const displayRating = displayRatingFor(p.id);
    const displayOrdersCount = Math.max(toNumber(p.orders_count), displayOrdersCountFor(p.id));

    return {
      id: p.id,
      nome: p.title || "Produto sem nome",
      categoria: p.category || "Produto",
      preco: p.cost_price || 0,
      image_url: imgUrls[0],
      images: imgUrls,
      product_url: p.product_url,
      rating: displayRating,
      ordersCount: displayOrdersCount,
      reviewsCount: p.reviews_count,
      supplierLabel,
    };
  };

  // Buscar produtos principais paginados (ou resultados do Atlas)
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Categoria "Favoritos": mostra apenas os produtos favoritados, buscando-os
        // pelos IDs salvos e preservando a ordem em que foram favoritados.
        if (activeCategory === "favoritos") {
          if (favoritedIds.length === 0) {
            setProducts([]);
            setTotalCount(0);
            return;
          }
          const { data, error: favError } = await withFreshSupabaseSession(() =>
            supabase
              .from("catalog_products")
              .select("*")
              .in("id", favoritedIds)
              .eq("is_active", true)
              .eq("is_blocked", false)
              .gt("stock_quantity", 0),
          );
          if (favError) throw favError;
          const byId = new Map((data || []).map((p) => [p.id, p]));
          let ordered = favoritedIds
            .map((id) => byId.get(id))
            .filter((p): p is CatalogProductRow => Boolean(p))
            .map(mapProduct);
          if (searchQuery.trim()) {
            const term = searchQuery.trim().toLowerCase();
            ordered = ordered.filter((p) => p.nome.toLowerCase().includes(term));
          }
          ordered = ordered.filter((p) => productMatchesSelectedFilters(p, selectedPriceRange, selectedRating));
          setProducts(ordered);
          setTotalCount(ordered.length);
          return;
        }

        // Modo Atlas: substitui o grid pelos IDs retornados, preservando a ordem
        if (atlasResults) {
          if (atlasResults.ids.length === 0) {
            setProducts([]);
            setTotalCount(0);
            return;
          }
          const { data, error: fetchError } = await withFreshSupabaseSession(() =>
            supabase
              .from("catalog_products")
              .select("*")
              .in("id", atlasResults.ids),
          );
          if (fetchError) throw fetchError;
          const byId = new Map((data || []).map((p) => [p.id, p]));
          const ordered = atlasResults.ids
            .map((id) => byId.get(id))
            .filter((p): p is CatalogProductRow => Boolean(p))
            .map(mapProduct)
            .filter((p) => productMatchesSelectedFilters(p, selectedPriceRange, selectedRating));
          setProducts(ordered);
          setTotalCount(ordered.length);
          return;
        }

        // Filtros comuns (categoria/busca/disponibilidade) aplicados a qualquer
        // consulta do catálogo. `any`: o tipo encadeado do PostgREST filter builder
        // não é exportado de forma prática; a query final é tipada pelo Supabase.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const applyCommonFilters = (query: any) => {
          let q = query.eq("is_blocked", false).gt("stock_quantity", 0);
          const priceBounds = getPriceRangeBounds(selectedPriceRange);
          if (activeCategory !== CATEGORIA_TODOS && activeCategory !== CATEGORIA_FAVORITOS) {
            // O valor já é o do banco; ilike só para não depender de caixa.
            q = q.ilike("category", activeCategory);
          }
          if (searchQuery.trim()) {
            q = q.ilike("title", `%${searchQuery.trim()}%`);
          }
          if (typeof priceBounds.min === "number") {
            q = q.gte("cost_price", priceBounds.min);
          }
          if (typeof priceBounds.max === "number") {
            q = q.lte("cost_price", priceBounds.max);
          }
          return q;
        };

        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE - 1;
        if (!isRatingFilterNoop(selectedRating)) {
          const { data, error: fetchError } = await withFreshSupabaseSession(() =>
            applyCommonFilters(supabase.from("catalog_products").select("*"))
              .eq("source", "c7drop")
              .order("orders_count", { ascending: false, nullsFirst: false })
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
              .limit(1200),
          );
          if (fetchError) throw fetchError;

          const filtered = (data || [])
            .map(mapProduct)
            .filter((p) => productMatchesSelectedFilters(p, selectedPriceRange, selectedRating));
          setProducts(filtered.slice(start, end + 1));
          setTotalCount(filtered.length);
          return;
        }

        const { data, count, error: fetchError } = await withFreshSupabaseSession(() =>
          applyCommonFilters(supabase.from("catalog_products").select("*", { count: "exact" }))
            .eq("source", "c7drop")
            .order("orders_count", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(start, end),
        );
        if (fetchError) throw fetchError;
        setProducts((data || []).map(mapProduct));
        setTotalCount(count || 0);
      } catch (err: any) {
        console.error("Erro ao buscar produtos do catálogo:", err);
        setError(`Não foi possível carregar o catálogo agora. Detalhes: ${err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err))}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
    // `favoritedIds` só entra como dependência quando a categoria Favoritos está
    // ativa (via a string derivada), evitando refetch ao favoritar em outras abas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPage,
    searchQuery,
    activeCategory,
    atlasResults,
    selectedPriceRange,
    selectedRating,
    activeCategory === "favoritos" ? favoritedIds.join(",") : "",
  ]);


  // Buscar recomendações
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const { data, error: fetchError } = await withFreshSupabaseSession(() =>
          supabase
            .from("catalog_products")
            .select("*")
            .eq("source", "c7drop")
            .eq("is_blocked", false)
            .gt("stock_quantity", 0)
            .limit(10),
        );


        if (fetchError) throw fetchError;
        setRecommendations((data || []).map(mapProduct));
      } catch (err) {
        console.error("Erro ao buscar recomendações:", err);
      }
    };

    fetchRecommendations();
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const recommendationWindow = useMemo(() => {
    if (recommendations.length === 0) return [];
    return Array.from({ length: Math.min(4, recommendations.length) }, (_, offset) => {
      const index = (recommendationIndex + offset) % recommendations.length;
      return recommendations[index];
    });
  }, [recommendationIndex, recommendations]);

  /**
   * Categorias reais do catálogo, com contagem.
   *
   * PostgREST não faz GROUP BY sem RPC, então trazemos só a coluna `category` e
   * agrupamos aqui — uma coluna de ~1.2k linhas é payload pequeno e evita ter de
   * criar e manter uma view só para isso.
   */
  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("category")
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        .limit(5000);
      if (!ativo || error) return;

      const contagem = new Map<string, number>();
      (data ?? []).forEach((linha) => {
        const valor = typeof linha.category === "string" ? linha.category.trim() : "";
        if (!valor) return;
        contagem.set(valor, (contagem.get(valor) ?? 0) + 1);
      });

      setCategoriasDoBanco(
        [...contagem.entries()]
          .map(([valor, total]) => ({ valor, total }))
          .sort((a, b) => b.total - a.total || a.valor.localeCompare(b.valor, "pt-BR")),
      );
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const opcoesDeCategoria = useMemo(
    () => [
      { valor: CATEGORIA_TODOS, rotulo: rotuloDaCategoria(CATEGORIA_TODOS) },
      { valor: CATEGORIA_FAVORITOS, rotulo: rotuloDaCategoria(CATEGORIA_FAVORITOS) },
      ...categoriasDoBanco.map((item) => ({ valor: item.valor, rotulo: `${item.valor} (${item.total})` })),
    ],
    [categoriasDoBanco],
  );

  const handleCategoryChange = (category: CategoryKey) => {
    setActiveCategory(category);
    setCurrentPage(1);
    setOpenDropdown(null);
    setAtlasResults(null);
  };

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxButtons = 5;
    
    let start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + maxButtons - 1);
    
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="-m-5 min-h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)] overflow-visible bg-white p-5 sm:-m-6 sm:min-h-[calc(100%+3rem)] sm:w-[calc(100%+3rem)] sm:p-6 lg:-m-7 lg:min-h-[calc(100%+3.5rem)] lg:w-[calc(100%+3.5rem)] lg:p-7" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      {isCollectionSelectionMode && selectionCollectionId && (
        <div className="sticky top-0 z-40 mb-4 rounded-2xl border border-black/[0.08] bg-[#111111] px-4 py-3 text-white shadow-[0_18px_44px_rgba(17,17,17,0.22)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                Modo de seleção
              </p>
              <p className="mt-0.5 truncate text-[14px] font-semibold">
                Adicionando à coleção: {selectionCollectionName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/colecoes")}
                className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-[12px] font-semibold text-[#111111] transition-opacity hover:opacity-90"
              >
                Concluir
              </button>
              <button
                type="button"
                aria-label="Sair do modo de seleção"
                onClick={() => navigate("/dashboard/catalogo", { replace: true })}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
      <section className="min-w-0 overflow-visible">
        <>
            <header className="mb-5 flex items-center gap-3 md:mb-6">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#101114] transition hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35"
                aria-label="Voltar"
              >
                <ArrowLeft size={20} strokeWidth={2.1} aria-hidden="true" />
              </button>
              <h1 className="truncate text-[22px] font-semibold tracking-[-0.04em] text-[#101114] sm:text-[24px]">
                Catálogo Velo
              </h1>
            </header>

            <div
              ref={filterBarRef}
              data-dashboard-tour="catalogo-busca"
              className="mobile-hide-scrollbar mb-6 flex gap-2 overflow-x-auto md:mb-7 md:flex-row md:items-center md:overflow-x-auto xl:overflow-visible"
            >
              <div className="relative min-w-[190px] flex-1 md:flex-none xl:w-[220px] xl:flex-shrink-0">
                <Search
                  size={16}
                  strokeWidth={1.8}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E87]"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Buscar produto"
                  className="h-9 w-full rounded-full border border-black/[0.08] bg-white pl-9 pr-3 text-[12px] font-semibold text-[#111111] shadow-[0_8px_18px_rgba(17,17,17,0.035)] outline-none backdrop-blur-sm transition-all duration-200 placeholder:text-[#8E8E87] hover:border-black/15 md:h-9 md:text-[12px]"
                />
              </div>

              <FilterDropdown
                label="Categoria"
                value={rotuloDaCategoria(activeCategory)}
                isOpen={openDropdown === "category"}
                onToggle={() => setOpenDropdown((current) => (current === "category" ? null : "category"))}
                options={opcoesDeCategoria.map((item) => item.rotulo)}
                onSelect={(option) => {
                  const escolhida = opcoesDeCategoria.find((item) => item.rotulo === option);
                  if (escolhida) handleCategoryChange(escolhida.valor);
                }}
              />

              <FilterDropdown
                label="Faixa de preço"
                value={selectedPriceRange}
                isOpen={openDropdown === "price"}
                onToggle={() => setOpenDropdown((current) => (current === "price" ? null : "price"))}
                options={PRICE_OPTIONS}
                onSelect={(option) => {
                  setSelectedPriceRange(option);
                  setCurrentPage(1);
                  setOpenDropdown(null);
                }}
              />

              <FilterDropdown
                label="Avaliação"
                value={selectedRating}
                isOpen={openDropdown === "rating"}
                onToggle={() => setOpenDropdown((current) => (current === "rating" ? null : "rating"))}
                options={RATING_OPTIONS}
                onSelect={(option) => {
                  setSelectedRating(option as RatingOption);
                  setCurrentPage(1);
                  setOpenDropdown(null);
                }}
              />

              <button
                type="button"
                onClick={() =>
                  handleCategoryChange(activeCategory === CATEGORIA_FAVORITOS ? CATEGORIA_TODOS : CATEGORIA_FAVORITOS)
                }
                aria-pressed={activeCategory === CATEGORIA_FAVORITOS}
                className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border px-3.5 text-[12px] font-semibold shadow-[0_8px_18px_rgba(17,17,17,0.035)] transition-all duration-200 ${
                  activeCategory === CATEGORIA_FAVORITOS
                    ? "border-[#2563EB] bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                    : "border-black/[0.08] bg-white text-[#151515] hover:border-black/15 hover:bg-[#F7F7F4]"
                }`}
              >
                <Heart
                  size={14}
                  strokeWidth={2}
                  className={activeCategory === CATEGORIA_FAVORITOS ? "fill-current" : ""}
                />
                Favoritos
                {favoritedIds.length > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                      activeCategory === CATEGORIA_FAVORITOS ? "bg-white/20 text-white" : "bg-[#EFF6FF] text-[#2563EB]"
                    }`}
                  >
                    {favoritedIds.length}
                  </span>
                )}
              </button>

              <div className="hidden xl:block xl:flex-1" />

              <div className="shrink-0 xl:ml-auto">
                <button
                  type="button"
                  onClick={abrirLateral}
                  data-dashboard-tour="catalogo-atlas"
                  className="group grid h-10 w-10 place-items-center rounded-full bg-transparent text-[#2563EB] transition-transform duration-200 hover:-translate-y-0.5"
                  aria-label="Abrir conversa com o Atlas"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-105">
                    <AtlasAvatarIcon size={28} />
                  </span>
                </button>
              </div>
            </div>

            {atlasResults && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-black/[0.07] bg-[#F7F7F8] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
                    Resultados do Aquas
                  </p>
                  <p className="mt-0.5 truncate text-[14px] font-semibold text-[#111111]">
                    {atlasResults.label}
                    <span className="ml-2 text-[12px] font-normal text-[#6B7280]">
                      ({atlasResults.ids.length} produto{atlasResults.ids.length === 1 ? "" : "s"})
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAtlasResults(null);
                    setCurrentPage(1);
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 text-[12px] font-semibold text-[#111111] transition-colors hover:bg-[#F1F1F3]"
                >
                  <RefreshCw size={13} strokeWidth={2} />
                  Limpar busca
                </button>
              </div>
            )}

            {isLoading ? (
              <div className={catalogGridClasses}>
                {Array.from({ length: ITEMS_PER_PAGE }).map((_, idx) => (
                  <ProductCardSkeleton key={idx} />
                ))}
              </div>
            ) : error ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 p-6 text-center text-red-600">
                <p className="font-medium">{error}</p>
                <button
                  onClick={() => setCurrentPage(1)}
                  className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Tentar novamente
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-gray-200 bg-gray-50/30 p-6 text-center text-gray-500 w-full col-span-full">
                {activeCategory === "favoritos" ? (
                  <>
                    <p className="font-medium text-[#111111]">Você ainda não favoritou nenhum produto.</p>
                    <p className="mt-1 text-[13px] text-gray-500">
                      Toque no coração dos produtos para salvá-los aqui.
                    </p>
                  </>
                ) : (
                  <p className="font-medium">Nenhum produto encontrado nesta categoria.</p>
                )}
              </div>
            ) : (
              <div className={catalogGridClasses}>
                {products.map((product, index) => (
                  <div key={product.id} data-dashboard-tour={index === 0 ? "catalogo-produto" : undefined}>
                    <ProductCard
                      product={product}
                      isFavorited={favoritedIds.includes(product.id)}
                      onToggleFavorite={() => toggleFavorite(product.id)}
                      denseMobile
                      collectionSelection={
                        isCollectionSelectionMode
                          ? {
                              selected: collectionProductIds.includes(product.id),
                              loading: collectionToggleLoadingId === product.id,
                              onToggle: () => toggleCollectionProduct(product.id),
                            }
                          : undefined
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111] transition-colors hover:bg-[#F7F7F8] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} strokeWidth={1.9} />
                </button>

                {getPageNumbers().map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-[13px] font-medium transition-colors ${
                      currentPage === pageNumber
                        ? "border-[#D8D8DC] bg-[#F1F1F3] text-[#111111]"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F7F7F8] hover:text-[#111111]"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111] transition-colors hover:bg-[#F7F7F8] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Próxima página"
                >
                  <ChevronRight size={16} strokeWidth={1.9} />
                </button>
              </div>
            )}

            {recommendations.length > 0 && (
              <section className="mt-12">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-[28px] font-semibold tracking-[-0.045em] text-[#111111]">
                      Explore nossas recomendações
                    </h2>
                    <p className="mt-1 text-[14px] text-[#6B7280]">
                      Seleções de produtos em destaque para facilitar suas importações.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setRecommendationIndex((current) =>
                          (current - 1 + recommendations.length) % recommendations.length,
                        )
                      }
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111] transition-colors hover:bg-[#F7F7F8]"
                      aria-label="Recomendações anteriores"
                    >
                      <ChevronLeft size={16} strokeWidth={1.9} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRecommendationIndex((current) => (current + 1) % recommendations.length)
                      }
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111] transition-colors hover:bg-[#F7F7F8]"
                      aria-label="Próximas recomendações"
                    >
                      <ChevronRight size={16} strokeWidth={1.9} />
                    </button>
                  </div>
                </div>

                <div className={recommendationGridClasses}>
                  {recommendationWindow.map((product) => (
                    <ProductCard
                      key={`recommendation-${product.id}`}
                      product={product}
                      isFavorited={favoritedIds.includes(product.id)}
                      onToggleFavorite={() => toggleFavorite(product.id)}
                      collectionSelection={
                        isCollectionSelectionMode
                          ? {
                              selected: collectionProductIds.includes(product.id),
                              loading: collectionToggleLoadingId === product.id,
                              onToggle: () => toggleCollectionProduct(product.id),
                            }
                          : undefined
                      }
                      compact
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="mt-12 overflow-hidden rounded-[28px] bg-[#111111] px-5 py-6 text-white shadow-[0_18px_40px_rgba(17,24,39,0.18)] sm:px-7 sm:py-8">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-[420px]">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/55">
                    Newsletter
                  </p>
                  <h2 className="mt-3 text-[34px] font-semibold leading-[0.95] tracking-[-0.06em] text-white sm:text-[42px]">
                    Quer receber
                    <br />
                    novidades primeiro?
                  </h2>
                  <p className="mt-4 max-w-[360px] text-[14px] leading-6 text-white/70">
                    Receba novas seleções, produtos em destaque e atualizações do catálogo em primeira mão.
                  </p>
                </div>

                <form
                  className="w-full max-w-[480px]"
                  onSubmit={(event) => event.preventDefault()}
                >
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="email"
                      value={newsletterEmail}
                      onChange={(event) => setNewsletterEmail(event.target.value)}
                      placeholder="Seu melhor e-mail"
                      className="h-12 flex-1 rounded-full border border-white/15 bg-white/8 px-4 text-[14px] text-white outline-none placeholder:text-white/45"
                    />
                    <button
                      type="submit"
                      className="inline-flex h-12 items-center justify-center rounded-full bg-white px-5 text-[14px] font-semibold text-[#111111] transition-opacity hover:opacity-90"
                    >
                      Enviar
                    </button>
                  </div>
                </form>
              </div>
            </section>
        </>
      </section>
    </div>
  );
};

export default CatalogoPage;
