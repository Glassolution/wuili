import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
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
import ProductScoutAI, { type AtlasResults } from "@/components/dashboard/ProductScoutAI";
import { veloToast } from "@/components/ui/velo-toast";
import type { Database, Json } from "@/integrations/supabase/types";
import { ProductCard, ProductCardSkeleton, type Product, formatPrice } from "@/components/dashboard/ProductCard";
import {
  addProductToCollection,
  getCollectionProductIds,
  removeProductFromCollection,
} from "@/lib/collectionsApi";

type CatalogProductRow = Database["public"]["Tables"]["catalog_products"]["Row"];

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

type CategoryKey =
  | "todos"
  | "casa"
  | "eletronicos"
  | "moda"
  | "bijuterias"
  | "decoracao"
  | "bebe"
  | "pet"
  | "beleza"
  | "saude"
  | "esporte"
  | "outros";

const categories: Array<{
  key: CategoryKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "todos", label: "Todos os produtos", shortLabel: "Todos" },
  { key: "casa", label: "Casa", shortLabel: "Casa" },
  { key: "eletronicos", label: "Eletrônicos", shortLabel: "Eletrônicos" },
  { key: "moda", label: "Moda", shortLabel: "Moda" },
  { key: "bijuterias", label: "Bijuterias", shortLabel: "Bijuterias" },
  { key: "decoracao", label: "Decoração", shortLabel: "Decoração" },
  { key: "bebe", label: "Bebê e Infantil", shortLabel: "Bebê" },
  { key: "pet", label: "Pet", shortLabel: "Pet" },
  { key: "beleza", label: "Beleza", shortLabel: "Beleza" },
  { key: "saude", label: "Saúde e Bem-estar", shortLabel: "Saúde" },
  { key: "esporte", label: "Esporte e Fitness", shortLabel: "Esporte" },
  { key: "outros", label: "Outros", shortLabel: "Outros" },
];

const categoryMap: Record<CategoryKey, string | null> = {
  todos: null,
  casa: "Casa",
  eletronicos: "Eletrônicos",
  moda: "Moda",
  bijuterias: "Bijuterias",
  decoracao: "Decoração",
  bebe: "Bebê e Infantil",
  pet: "Pet",
  beleza: "Beleza",
  saude: "Saúde e Bem-estar",
  esporte: "Esporte e Fitness",
  outros: "Outros",
};

const PRICE_OPTIONS = ["Todos os preços", "Até R$ 50", "R$ 50-150", "Acima de R$ 150"];
const RATING_OPTIONS = ["Todas", "4+ estrelas", "4.5+ estrelas"];



const getProductImages = (images: Json | null): string[] => {
  if (!images) return [];
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
};



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
  <div className="relative min-w-[148px] md:min-w-[180px]">
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-full border border-[#D1D5DB] bg-white px-3 text-[11px] font-semibold text-[#111111] shadow-sm transition-all duration-200 hover:border-[#9CA3AF] hover:bg-[#FAFAFA] md:h-11 md:rounded-2xl md:px-4 md:text-[14px]"
    >
      <span className="truncate">{label}: {value}</span>
      <ChevronDown size={16} strokeWidth={1.8} className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
    </button>

    {isOpen && (
      <div className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-[0_16px_32px_rgba(17,24,39,0.08)]">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${
              value === option ? "bg-[#F3F4F6] font-semibold text-[#111111]" : "text-[#4B5563] hover:bg-[#F9FAFB]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    )}
  </div>
);

const CatalogoPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const selectionCollectionId = searchParams.get("collectionId");
  const selectionCollectionName = searchParams.get("collectionName") || "coleção";
  const isCollectionSelectionMode = Boolean(selectionCollectionId);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [recommendationIndex, setRecommendationIndex] = useState(0);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriceRange, setSelectedPriceRange] = useState("Todos os preços");
  const [selectedRating, setSelectedRating] = useState("Todas");
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

  const toggleFavorite = (productId: string) => {
    setFavoritedIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
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
    return {
      id: p.id,
      nome: p.title || "Produto sem nome",
      categoria: p.category || "Produto",
      preco: p.cost_price || 0,
      image_url: imgUrls[0],
      images: imgUrls,
      product_url: p.product_url,
      rating: p.rating,
      ordersCount: p.orders_count,
    };
  };

  // Buscar produtos principais paginados (ou resultados do Atlas)
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
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
            .map(mapProduct);
          setProducts(ordered);
          setTotalCount(ordered.length);
          return;
        }

        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE - 1;

        const fetchCatalogPage = () => {
          let query = supabase
            .from("catalog_products")
            .select("*", { count: "exact" })
            .eq("source", "c7drop")
            .eq("is_blocked", false)
            .gt("stock_quantity", 0)
            .order("created_at", { ascending: false })
            .range(start, end);

          if (activeCategory !== "todos") {
            const dbCategory = categoryMap[activeCategory];
            if (dbCategory) {
              query = query.eq("category", dbCategory);
            }
          }

          if (searchQuery.trim()) {
            query = query.ilike("title", `%${searchQuery.trim()}%`);
          }

          return query;
        };

        const { data, count, error: fetchError } = await withFreshSupabaseSession(fetchCatalogPage);

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
  }, [currentPage, searchQuery, activeCategory, atlasResults]);


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

  const handleCategoryChange = (category: CategoryKey) => {
    setActiveCategory(category);
    setCurrentPage(1);
    setOpenDropdown(null);
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
    <div className="-mt-1 min-h-full w-full overflow-visible" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
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
            <div
              ref={filterBarRef}
              data-dashboard-tour="catalogo-busca"
              className="mobile-hide-scrollbar mb-3 flex gap-2 overflow-x-auto md:mb-5 md:flex-col md:gap-3 md:overflow-visible xl:flex-row xl:items-center"
            >
              <div className="relative min-w-[220px] flex-1 md:min-w-0 xl:w-[260px] xl:flex-shrink-0">
                <Search
                  size={16}
                  strokeWidth={1.8}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Buscar produto"
                  className="h-9 w-full rounded-full border border-[#D1D5DB] bg-white pl-10 pr-3 text-[12px] font-medium text-[#111111] shadow-sm outline-none transition-all duration-200 placeholder:text-[#9CA3AF] hover:border-[#9CA3AF] md:h-11 md:rounded-2xl md:pl-11 md:pr-4 md:text-[14px]"
                />
              </div>

              <FilterDropdown
                label="Categoria"
                value={categories.find((category) => category.key === activeCategory)?.label ?? "Todos os produtos"}
                isOpen={openDropdown === "category"}
                onToggle={() => setOpenDropdown((current) => (current === "category" ? null : "category"))}
                options={categories.map((category) => category.label)}
                onSelect={(option) => {
                  const selectedCategory = categories.find((category) => category.label === option);
                  if (selectedCategory) handleCategoryChange(selectedCategory.key);
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
                  setSelectedRating(option);
                  setOpenDropdown(null);
                }}
              />

              <div className="hidden xl:block xl:flex-1" />

              <div className="shrink-0 xl:ml-auto">
                <ProductScoutAI onResults={(results) => setAtlasResults(results)} />
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
              <div className="grid h-auto grid-cols-2 gap-2 overflow-visible md:grid-cols-2 md:gap-3 lg:grid-cols-3 xl:grid-cols-4">
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
                <p className="font-medium">Nenhum produto encontrado nesta categoria.</p>
              </div>
            ) : (
              <div className="grid h-auto grid-cols-2 gap-2 overflow-visible md:grid-cols-2 md:gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product, index) => (
                  <div key={product.id} data-dashboard-tour={index === 0 ? "catalogo-produto" : undefined}>
                    <ProductCard
                      product={product}
                      categoryLabel={product.categoria}
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

                <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 xl:grid-cols-4 md:overflow-visible">
                  {recommendationWindow.map((product) => (
                    <ProductCard
                      key={`recommendation-${product.id}`}
                      product={product}
                      categoryLabel={product.categoria}
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
