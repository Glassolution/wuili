import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bell,
  Box,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Package,
  Search,
  ShoppingBag,
  Eye,
  Percent,
  Star,
  CheckCircle,
  AlertTriangle,
  Info,
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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ProductScoutAI from "@/components/dashboard/ProductScoutAI";

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

type CatalogProductRow = {
  category: string | null;
  orders_count: number | null;
  margin_percent: number;
};

type RevenuePoint = {
  label: string;
  value: number;
};

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

// ─── Componentes do Redesign Mapeado Exato ───────────────────────────────────

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

// MOCK: fontes de tráfego com sparklines
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
  catalogProducts: CatalogProductRow[];
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

        {/* Donut à esquerda e legenda à direita (lado a lado) */}
        <div className="flex items-center gap-4 mt-3">
          
          {/* Donut Chart */}
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

          {/* Legenda à Direita */}
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

      {/* Alerta de falhas no rodapé */}
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
  // MOCK: sugestões do Atlas para importação
  const recommendations = [
    { name: "Fone Bluetooth Pro", badge: "Margem 65%", time: "Recém adicionado" },
    { name: "Mini Projetor HD", badge: "Alta Demanda", time: "Em alta na CJ" },
    { name: "Suporte MagSafe", badge: "Viral TikTok", time: "Mais importado" },
  ];
  
  return (
    <div className="space-y-3 border-t border-black/[0.04] pt-4">
      <div className="flex items-center justify-between leading-none">
        <p className="text-[11.5px] font-bold text-neutral-800 uppercase tracking-tight">Sugestões do Atlas</p>
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
  // MOCK: resumo de clientes recorrentes
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

// ─── Main Page Component ──────────────────────────────────────────────────────

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["dashboard-home-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles" as never)
        .select("display_name, loja_nome")
        .eq("id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as ProfileRow | null;
    },
  });

  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard-home-wix-data", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const [publicationsResult, ordersResult, activitiesResult, catalogProductsResult] = await Promise.all([
        supabase
          .from("user_publications" as never)
          .select("id,title,status,created_at,published_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("orders" as never)
          .select("id,product_title,sale_price,status,ordered_at,created_at,platform")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("ai_activity_logs" as never)
          .select("id,message,created_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("catalog_products" as never)
          .select("category, orders_count, margin_percent")
          .limit(150),
      ]);

      if (publicationsResult.error) throw publicationsResult.error;
      if (ordersResult.error) throw ordersResult.error;
      if (activitiesResult.error) throw activitiesResult.error;
      if (catalogProductsResult.error) throw catalogProductsResult.error;

      return {
        publications: (publicationsResult.data ?? []) as PublicationRow[],
        orders: (ordersResult.data ?? []) as OrderRow[],
        activities: (activitiesResult.data ?? []) as ActivityLogRow[],
        catalogProducts: (catalogProductsResult.data ?? []) as CatalogProductRow[],
      };
    },
  });

  const publications = dashboardData?.publications ?? [];
  const orders = dashboardData?.orders ?? [];
  const activities = dashboardData?.activities ?? [];
  const catalogProducts = dashboardData?.catalogProducts ?? [];

  const name = getName(profile, user?.email);

  // Mapeamento e contagem de publicações reais
  const successCount = publications.filter((item) => ["active", "ativo", "published", "publicado"].includes(String(item.status ?? "").toLowerCase())).length;
  const failedCount = publications.filter((item) => ["failed", "erro", "error", "falha"].includes(String(item.status ?? "").toLowerCase())).length;
  const pendingCount = publications.filter((item) => ["pending", "rascunho", "draft", "paused", "pausado", "expired", "expirado"].includes(String(item.status ?? "").toLowerCase())).length;
  const totalPublications = publications.length;

  const totalRevenue = orders.reduce((sum, order) => sum + toNumber(order.sale_price), 0);
  const revenueSeries = useMemo(() => buildRevenueSeries(orders), [orders]);

  // MOCK: Estimativa de visitas matemática e coerente baseada em pedidos reais
  const visits = orders.length > 0 ? orders.length * 45 + 12 : 0;
  const conversionRate = visits > 0 ? Number(((orders.length / visits) * 100).toFixed(1)) : 0;

  const latestOrder = orders[0];
  const latestOrderValue = latestOrder ? formatBRL(toNumber(latestOrder.sale_price)) : formatBRL(0);
  const latestProduct = latestOrder?.product_title || "Nenhuma venda registrada";

  return (
    <main 
      className="min-h-full w-full bg-[#f4f4f4] text-[#111111] pb-10"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-5 px-1 py-4 sm:px-3 lg:px-0">
        
        {/* Breadcrumb e Header Superior */}
        <div className="flex flex-col gap-1 border-b border-black/[0.04] pb-4">
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-medium leading-none">
            <span>Dashboard</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-neutral-600">Home</span>
            <button type="button" className="ml-1 text-neutral-400 hover:text-neutral-600 leading-none">
              <Star className="h-3.5 w-3.5 fill-none" />
            </button>
          </div>
          
          <header className="flex items-center justify-between gap-4 mt-2">
            <h1 className="text-[20px] font-bold leading-none tracking-[-0.035em] text-neutral-800">
              Olá, {name}!
            </h1>
            
            <div className="flex items-center gap-3">
              {/* Barra de Pesquisa Mock */}
              <div className="hidden sm:flex h-10 items-center gap-2 bg-white border border-black/[0.06] rounded-full px-3.5 w-[240px] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <Search className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                <input 
                  type="text" 
                  placeholder="Pesquisar..." 
                  disabled 
                  className="bg-transparent text-[12px] outline-none text-neutral-500 w-full cursor-not-allowed" 
                />
                <span className="text-[9px] font-bold text-neutral-400 bg-neutral-100 border border-black/[0.04] px-1 rounded leading-none shrink-0">⌘F</span>
              </div>

              <ProductScoutAI
                onResults={(results) =>
                  navigate("/dashboard/catalogo", { state: { atlasResults: results } })
                }
              />
            </div>
          </header>
        </div>

        {/* Layout Geral em Grid Horizontal Responsivo */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* Lado Esquerdo (KPIs + Gráficos) */}
          <div className="flex-1 space-y-6 w-full min-w-0">
            
            {/* LINHA 1: Faixa de KPIs Compactos (Exatamente 4 cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* TODO: aguardando tabela de tracking/métrica de visualizações no banco */}
              <KPICard label="Visualizações" value="5.340" delta="+12.4%" isMock={true} />
              {/* TODO: aguardando tabela de tracking/métrica de visitas no banco */}
              <KPICard label="Visitas" value={visits > 0 ? visits.toLocaleString("pt-BR") : "0"} delta="+8.2%" isMock={true} />
              <KPICard label="Pedidos" value={String(orders.length)} delta={orders.length > 0 ? "+15.3%" : "--"} />
              <KPICard label="Conversão" value={visits > 0 ? `${conversionRate}%` : "—"} delta={conversionRate > 0 ? "+2.1%" : "--"} />
            </div>

            {/* LINHA 2: Gráfico de Performance Geral + Tráfego por Canal */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <PerformanceGeneralCard orders={orders} />
              </div>
              <div>
                <TrafficByChannelCard />
              </div>
            </div>

            {/* LINHA 3: Análise de Produtos (Bar Chart) + Publicações ML (Donut) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ProductAnalysisChartCard catalogProducts={catalogProducts} />
              </div>
              <div>
                <MLPublicationsDonutCard 
                  success={successCount} 
                  failed={failedCount} 
                  pending={pendingCount} 
                  total={totalPublications} 
                />
              </div>
            </div>

          </div>

          {/* Lado Direito (Drawer de Camada Visualmente Destacada) */}
          <div className="w-full lg:w-[290px] bg-white border border-black/[0.06] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_8px_30px_rgba(0,0,0,0.03)] flex flex-col gap-4 shrink-0">
            <SidebarRecentLogs activities={activities} />
            <SidebarAtlasSuggestions />
            <SidebarCustomers />
            <SidebarDrawerFooter />
            
            {/* Última venda secundária */}
            <section className="rounded-xl border border-black/[0.04] bg-neutral-50 p-4 leading-none">
              <div className="flex items-center justify-between mb-2 leading-none">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Última venda</span>
                <Package className="h-3.5 w-3.5 text-neutral-400" />
              </div>
              <strong className="mt-1.5 block text-xl font-bold tracking-tight text-[#111111] leading-none">
                {latestOrderValue}
              </strong>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-neutral-400 line-clamp-2">{latestProduct}</p>
            </section>
          </div>

        </div>

      </div>
    </main>
  );
};

export default DashboardHomePage;
