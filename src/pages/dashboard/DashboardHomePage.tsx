import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  MoreVertical,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFinancialData } from "@/hooks/useFinancialData";
import { useIsMobile } from "@/hooks/use-mobile";

const PERIODS = ["Hoje", "Esse mês", "Últimos 30 dias", "Últimos 90 dias", "Todo o período", "Personalizado"] as const;
type Period = typeof PERIODS[number];

type PeriodRange = {
  start: Date | null;
  end: Date | null;
};

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const dateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPeriodRange = (period: Period, customStart: string, customEnd: string): PeriodRange => {
  const now = new Date();

  if (period === "Hoje") {
    return { start: startOfDay(now), end: endOfDay(now) };
  }

  if (period === "Esse mês") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
  }

  if (period === "Últimos 30 dias" || period === "Últimos 90 dias") {
    const days = period === "Últimos 30 dias" ? 30 : 90;
    const start = startOfDay(now);
    start.setDate(start.getDate() - (days - 1));
    return { start, end: endOfDay(now) };
  }

  if (period === "Personalizado") {
    return {
      start: customStart ? startOfDay(new Date(`${customStart}T00:00:00`)) : null,
      end: customEnd ? endOfDay(new Date(`${customEnd}T00:00:00`)) : null,
    };
  }

  return { start: null, end: null };
};

const isInsidePeriod = (value: string | null | undefined, range: PeriodRange) => {
  if (!range.start && !range.end) return true;
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (range.start && date < range.start) return false;
  if (range.end && date > range.end) return false;
  return true;
};

// ── Sales Calendar Component ──────────────────────────────────────────────────
const SalesCalendar = ({ userId }: { userId: string | undefined }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Fetch real orders for the current month
  const { data: monthOrders } = useQuery({
    queryKey: ["calendar-orders", userId, currentMonth.getFullYear(), currentMonth.getMonth()],
    enabled: !!userId,
    queryFn: async () => {
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
      const end   = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("ordered_at, created_at, sale_price")
        .eq("user_id", userId)
        .gte("ordered_at", start)
        .lte("ordered_at", end);
      if (error) return [];
      return (data ?? []) as { ordered_at: string | null; created_at: string; sale_price: number | null }[];
    },
  });

  // Build salesData: day → total revenue
  const salesData: Record<number, number> = {};
  (monthOrders ?? []).forEach((o) => {
    const d = new Date(o.ordered_at ?? o.created_at);
    const day = d.getDate();
    salesData[day] = (salesData[day] ?? 0) + Number(o.sale_price ?? 0);
  });

  const formatMonth = (date: Date): string => {
    try {
      return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
    } catch {
      return "Maio 2026";
    }
  };

  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const card: React.CSSProperties = {
    backgroundColor: "#FFFFFF",
    borderRadius: "20px",
    padding: "16px",
    border: "1px solid rgba(0,0,0,0.04)",
    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
    minHeight: "240px",
    overflow: "hidden",
    transition: "all 200ms",
  };

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Calendar size={17} strokeWidth={1.75} style={{ color: "#111111" }} />
          <h2 style={{ 
            fontSize: "17px", 
            lineHeight: "22px",
            fontWeight: 600, 
            letterSpacing: "-0.03em",
            color: "#111111", 
            margin: 0 
          }}>Calendário de vendas</h2>
        </div>
        <button style={{ 
          background: "none", 
          border: "none", 
          cursor: "pointer", 
          padding: "4px", 
          borderRadius: "6px", 
          display: "flex",
          transition: "background-color 0.15s"
        }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F5F5F5")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <Info size={16} style={{ color: "#9CA3AF" }} />
        </button>
      </div>

      {/* Month Navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "14px" }}>
        <button
          onClick={previousMonth}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            borderRadius: "6px",
            display: "flex",
            transition: "background-color 0.15s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F5F5F5")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <ChevronLeft size={16} style={{ color: "#111111" }} />
        </button>
        <span style={{
          fontSize: "14px",
          fontWeight: 500,
          color: "#111111",
          letterSpacing: "-0.02em",
          textTransform: "capitalize",
          minWidth: "130px",
          textAlign: "center"
        }}>
          {formatMonth(currentMonth)}
        </span>
        <button
          onClick={nextMonth}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            borderRadius: "6px",
            display: "flex",
            transition: "background-color 0.15s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F5F5F5")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <ChevronRight size={16} style={{ color: "#111111" }} />
        </button>
      </div>

      {/* Week Days */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(7, 1fr)", 
        gap: "6px",
        marginBottom: "8px"
      }}>
        {weekDays.map((day) => (
          <div key={day} style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "#9CA3AF",
            textAlign: "center",
            padding: "6px 0"
          }}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(7, 1fr)", 
        gap: "6px"
      }}>
        {/* Empty cells for days before month starts */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} style={{ height: "30px" }} />
        ))}

        {/* Days of the month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const hasSale = salesData[day] !== undefined;
          
          return (
            <div
              key={day}
              style={{
                height: "30px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                borderRadius: "6px",
                cursor: hasSale ? "pointer" : "default",
                transition: "background-color 0.15s",
                backgroundColor: "transparent"
              }}
              onMouseEnter={(e) => {
                if (hasSale) {
                  e.currentTarget.style.backgroundColor = "#F9FAFB";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <span style={{
                fontSize: "12px",
                fontWeight: 500,
                color: hasSale ? "#111111" : "#D1D5DB"
              }}>
                {day}
              </span>
              {hasSale && (
                <div style={{
                  position: "absolute",
                  bottom: "3px",
                  width: "3px",
                  height: "3px",
                  borderRadius: "50%",
                  backgroundColor: "#111111"
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Compact number formatting ────────────────────────────────────────────────
const fmtCompact = (v: number): string => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return v.toString();
};

const fmt = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
};

const fmtNum = (v: number) => fmtCompact(v);

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: "Aprovado" | "Pendente" | "Cancelado" }) => {
  const map = {
    Aprovado:  { bg: "#F0FDF4", color: "#16A34A", dot: "#16A34A" },
    Pendente:  { bg: "#FFFBEB", color: "#D97706", dot: "#D97706" },
    Cancelado: { bg: "#FEF2F2", color: "#DC2626", dot: "#DC2626" },
  };
  const s = map[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      backgroundColor: s.bg, color: s.color,
      fontSize: "12px", 
      fontWeight: 600,
      letterSpacing: "-0.01em",
      padding: "4px 10px", 
      borderRadius: "999px"
    }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: s.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
};

type RecentActivityItem = {
  id: number;
  text: string;
  sub: string;
  time: string;
};

type RecentOrderItem = {
  id: string;
  client: string;
  status: "Aprovado" | "Pendente" | "Cancelado";
  updated: string;
  sale_price: number;
};

const MobileDashboardHome = ({
  activePeriod,
  setActivePeriod,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  totalRevenue,
  totalOrders,
  totalPubs,
  loadingStats,
  recentActivity,
  recentOrders,
  loadingRecentOrders,
  userId,
}: {
  activePeriod: Period;
  setActivePeriod: (period: Period) => void;
  customStart: string;
  setCustomStart: (value: string) => void;
  customEnd: string;
  setCustomEnd: (value: string) => void;
  totalRevenue: number;
  totalOrders: number;
  totalPubs: number;
  loadingStats: boolean;
  recentActivity: RecentActivityItem[];
  recentOrders: RecentOrderItem[];
  loadingRecentOrders: boolean;
  userId: string | undefined;
}) => {
  const navigate = useNavigate();

  const metricCards = [
    {
      label: "Receita",
      value: loadingStats ? "—" : fmt(totalRevenue),
      hint: totalOrders > 0 ? "Receita acumulada" : "Sem pedidos ainda",
      icon: TrendingUp,
      dark: true,
    },
    {
      label: "Pedidos",
      value: loadingStats ? "—" : fmtNum(totalOrders),
      hint: "Recebidos no período",
      icon: ShoppingCart,
    },
    {
      label: "Publicações",
      value: loadingStats ? "—" : fmtNum(totalPubs),
      hint: "Ativas na loja",
      icon: Package,
    },
    {
      label: "Clientes",
      value: loadingStats ? "—" : fmtCompact(totalOrders),
      hint: "Base de pedidos",
      icon: Users,
    },
  ];

  const quickActions = [
    { label: "Sincronizar produtos", to: "/dashboard/produtos", icon: Package },
    { label: "Ver pedidos", to: "/dashboard/pedidos", icon: ShoppingCart },
    { label: "Adicionar saldo CJ", to: "/dashboard/saldos", icon: TrendingUp },
    { label: "Publicações", to: "/dashboard/publicacoes", icon: ArrowUpRight },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-[28px] bg-[#111111] p-5 text-white shadow-[0_18px_44px_rgba(0,0,0,0.12)]">
        <p className="text-[12px] font-medium text-white/48">Visão do período</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[34px] font-semibold leading-none tracking-[-0.06em]">{loadingStats ? "—" : fmt(totalRevenue)}</p>
            <p className="mt-2 text-[13px] font-medium text-white/60">{totalOrders} pedido(s) no período</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/12">
            <TrendingUp size={22} strokeWidth={1.8} />
          </span>
        </div>
      </section>

      <section className="overflow-x-auto pb-1 mobile-hide-scrollbar">
        <div className="flex min-w-max gap-2.5">
          {PERIODS.map((period) => {
            const active = period === activePeriod;
            return (
              <button
                key={period}
                type="button"
                onClick={() => setActivePeriod(period)}
                className="h-10 shrink-0 rounded-full border px-4 text-[13px] font-semibold transition active:scale-[0.98]"
                style={{
                  borderColor: active ? "#111111" : "rgba(0,0,0,0.06)",
                  backgroundColor: active ? "#111111" : "#FFFFFF",
                  color: active ? "#FFFFFF" : "#111111",
                }}
              >
                {period}
              </button>
            );
          })}
        </div>
      </section>

      {activePeriod === "Personalizado" && (
        <section className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-3xl border border-black/[0.05] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="h-11 min-w-0 rounded-2xl border border-black/[0.06] bg-[#F6F6F4] px-3 text-[13px] font-medium text-[#111111] outline-none"
          />
          <span className="text-[12px] font-medium text-black/34">até</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="h-11 min-w-0 rounded-2xl border border-black/[0.06] bg-[#F6F6F4] px-3 text-[13px] font-medium text-[#111111] outline-none"
          />
        </section>
      )}

      <section className="overflow-x-auto pb-1 mobile-hide-scrollbar">
        <div className="flex gap-3">
          {metricCards.map((metric) => {
            const Icon = metric.icon;
            return (
              <article
                key={metric.label}
                className="min-h-[132px] w-[168px] shrink-0 rounded-3xl border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                style={{
                  backgroundColor: metric.dark ? "#111111" : "#FFFFFF",
                  borderColor: metric.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                  color: metric.dark ? "#FFFFFF" : "#111111",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[12px] font-semibold" style={{ color: metric.dark ? "rgba(255,255,255,0.62)" : "rgba(0,0,0,0.44)" }}>
                    {metric.label}
                  </p>
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl" style={{ backgroundColor: metric.dark ? "rgba(255,255,255,0.12)" : "#F6F6F4" }}>
                    <Icon size={17} strokeWidth={1.8} />
                  </span>
                </div>
                <p className="mt-5 truncate text-[28px] font-semibold leading-none tracking-[-0.06em]">{metric.value}</p>
                <p className="mt-2 truncate text-[12px] font-medium" style={{ color: metric.dark ? "rgba(255,255,255,0.52)" : "rgba(0,0,0,0.38)" }}>
                  {metric.hint}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-black/[0.05] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold tracking-[-0.03em] text-[#111111]">Ações rápidas</h2>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => navigate(action.to)}
                className="flex min-h-[74px] items-center gap-3 rounded-3xl bg-[#F6F6F4] p-3 text-left transition active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#111111]">
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span className="text-[13px] font-semibold leading-4 text-[#111111]">{action.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-black/[0.05] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold tracking-[-0.03em] text-[#111111]">Atividade recente</h2>
          <button type="button" onClick={() => navigate("/dashboard/pedidos")} className="rounded-full bg-[#F6F6F4] px-3 py-1.5 text-[12px] font-semibold text-black/54">
            Ver tudo
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {recentActivity.length === 0 ? (
            <div className="rounded-3xl bg-[#F6F6F4] p-4 text-center text-[13px] font-medium text-black/42">
              Nenhuma atividade recente.
            </div>
          ) : (
            recentActivity.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-3xl bg-[#F6F6F4] p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#111111]">
                  <CheckCircle size={17} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#111111]">{item.text}</p>
                  <p className="mt-0.5 truncate text-[12px] font-medium text-black/38">{item.sub}</p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-black/34">{item.time}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mobile-calendar-card">
        <SalesCalendar userId={userId} />
      </section>

      <section className="rounded-3xl border border-black/[0.05] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold tracking-[-0.03em] text-[#111111]">Gerenciamento de pedidos</h2>
          <button type="button" onClick={() => navigate("/dashboard/pedidos")} className="rounded-full bg-[#111111] px-3 py-1.5 text-[12px] font-semibold text-white">
            Abrir
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {loadingRecentOrders ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-[74px] animate-pulse rounded-3xl bg-[#F6F6F4]" />
            ))
          ) : recentOrders.length === 0 ? (
            <div className="rounded-3xl bg-[#F6F6F4] p-5 text-center text-[13px] font-medium text-black/42">
              Nenhum pedido encontrado. Sincronize sua conta do Mercado Livre.
            </div>
          ) : (
            recentOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => navigate("/dashboard/pedidos")}
                className="flex items-center gap-3 rounded-3xl bg-[#F6F6F4] p-3 text-left transition active:scale-[0.99]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[13px] font-bold text-[#111111]">
                  {order.client.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[#111111]">{order.id}</span>
                  <span className="mt-0.5 block truncate text-[12px] font-medium text-black/38">{order.client} · {order.updated}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[13px] font-semibold text-[#111111]">{fmt(order.sale_price)}</span>
                  <span className="mt-1 block text-[11px] font-semibold text-black/42">{order.status}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardHomePage() {
  const { user } = useAuth();
  const { orders, summary, isLoading: isLoadingFinancial } = useFinancialData();
  const isMobile = useIsMobile();
  const [activePeriod, setActivePeriod] = useState<Period>("Esse mês");
  const [customStart, setCustomStart] = useState(() => dateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(() => dateInputValue(new Date()));

  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard-stats", user?.id, activePeriod, customStart, customEnd],
    enabled: !!user,
    queryFn: async () => {
      const [ordersRes, pubsRes, revenueRes] = await Promise.all([
        supabase
          .from("orders" as any)
          .select("id, ordered_at, created_at")
          .eq("user_id", user!.id),
        supabase
          .from("user_publications" as any)
          .select("id, created_at, published_at")
          .eq("user_id", user!.id)
          .eq("status", "active"),
        supabase
          .from("orders" as any)
          .select("sale_price, ordered_at, created_at")
          .eq("user_id", user!.id),
      ]);
      const range = getPeriodRange(activePeriod, customStart, customEnd);
      const periodOrders = ((ordersRes.data ?? []) as { ordered_at: string | null; created_at: string }[])
        .filter((o) => isInsidePeriod(o.ordered_at ?? o.created_at, range));
      const periodPubs = ((pubsRes.data ?? []) as { created_at: string | null; published_at: string | null }[])
        .filter((p) => isInsidePeriod(p.published_at ?? p.created_at, range));
      const periodRevenueRows = ((revenueRes.data ?? []) as { sale_price: number | null; ordered_at: string | null; created_at: string }[])
        .filter((o) => isInsidePeriod(o.ordered_at ?? o.created_at, range));

      const totalOrders = periodOrders.length;
      const totalPubs   = periodPubs.length;
      const revenue     = periodRevenueRows
        .reduce((s, o) => s + (o.sale_price ?? 0), 0);
      return { totalOrders, totalPubs, revenue };
    },
  });

  const totalRevenue    = statsData?.revenue     ?? 0;
  const totalOrders     = statsData?.totalOrders ?? 0;
  const totalPubs       = statsData?.totalPubs   ?? 0;

  // ── Real recent orders ────────────────────────────────────────────────────
  const { data: recentOrdersData, isLoading: loadingRecentOrders } = useQuery({
    queryKey: ["dashboard-recent-orders", user?.id, activePeriod, customStart, customEnd],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders" as any)
        .select("id, external_order_id, buyer_name, status, ordered_at, created_at, sale_price")
        .eq("user_id", user!.id)
        .order("ordered_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const range = getPeriodRange(activePeriod, customStart, customEnd);
      return ((data ?? []) as {
        id: string;
        external_order_id: string | null;
        buyer_name: string | null;
        status: string;
        ordered_at: string | null;
        created_at: string;
        sale_price: number | null;
      }[])
        .filter((o) => isInsidePeriod(o.ordered_at ?? o.created_at, range))
        .slice(0, 5);
    },
  });

  // Map real orders to table rows
  const recentOrders = (recentOrdersData ?? []).map((o) => {
    const statusMap: Record<string, "Aprovado" | "Pendente" | "Cancelado"> = {
      paid: "Aprovado", approved: "Aprovado", completed: "Aprovado", delivered: "Aprovado",
      pending: "Pendente", in_process: "Pendente", processing: "Pendente",
      cancelled: "Cancelado", canceled: "Cancelado", failed: "Cancelado", refunded: "Cancelado",
    };
    const mappedStatus = statusMap[o.status?.toLowerCase() ?? ""] ?? "Pendente";
    const date = new Date(o.ordered_at ?? o.created_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);
    const updated =
      diffMin < 1 ? "agora" :
      diffMin < 60 ? `${diffMin} min atrás` :
      diffH < 24 ? `${diffH} h atrás` :
      `${diffD} d atrás`;
    return {
      id: o.external_order_id ?? `#${o.id.slice(0, 6)}`,
      client: o.buyer_name ?? "Cliente",
      status: mappedStatus as "Aprovado" | "Pendente" | "Cancelado",
      updated,
      sale_price: Number(o.sale_price ?? 0),
    };
  });

  // Map real orders to activity feed
  const recentActivity = (recentOrdersData ?? []).slice(0, 4).map((o, i) => {
    const date = new Date(o.ordered_at ?? o.created_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);
    const time =
      diffMin < 1 ? "agora" :
      diffMin < 60 ? `${diffMin} min atrás` :
      diffH < 24 ? `${diffH} h atrás` :
      `${diffD} d atrás`;
    const price = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(o.sale_price ?? 0));
    const code = o.external_order_id ?? `#${o.id.slice(0, 6)}`;
    return {
      id: i + 1,
      text: o.status?.toLowerCase() === "paid" || o.status?.toLowerCase() === "approved" ? "Pagamento aprovado" : "Novo pedido recebido",
      sub: `Pedido ${code} — ${price}`,
      time,
    };
  });

  if (isMobile) {
    return (
      <MobileDashboardHome
        activePeriod={activePeriod}
        setActivePeriod={setActivePeriod}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        totalRevenue={totalRevenue}
        totalOrders={totalOrders}
        totalPubs={totalPubs}
        loadingStats={loadingStats}
        recentActivity={recentActivity}
        recentOrders={recentOrders}
        loadingRecentOrders={loadingRecentOrders}
        userId={user?.id}
      />
    );
  }

  // ── Shared styles ──────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    backgroundColor: "#FFFFFF",
    borderRadius: "20px",
    padding: "16px",
    border: "1px solid rgba(0,0,0,0.04)",
    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
    minHeight: "240px",
    overflow: "hidden",
    transition: "all 200ms",
  };

  return (
    <div style={{
      padding: "0",
      backgroundColor: "transparent",
      minHeight: "100vh",
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      WebkitFontSmoothing: "antialiased",
      textRendering: "optimizeLegibility",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}>

      {/* ── 1. Period filter bar ────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "6px",
        width: "100%",
        marginBottom: "2px"
      }}>
        {PERIODS.map((p) => {
          const isActive = p === activePeriod;
          return (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              style={{
                height: "38px",
                padding: "0 16px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 500,
                fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                border: `1px solid ${isActive ? "#111111" : "#E5E7EB"}`,
                backgroundColor: isActive ? "#111111" : "#FFFFFF",
                color: isActive ? "#FFFFFF" : "#111111",
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                lineHeight: 1,
                letterSpacing: "-0.02em",
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "#F9FAFB";
                  e.currentTarget.style.borderColor = "#D1D5DB";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "#FFFFFF";
                  e.currentTarget.style.borderColor = "#E5E7EB";
                }
              }}
            >
              {p}
            </button>
          );
        })}
      </div>

      {activePeriod === "Personalizado" && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          marginTop: "-4px",
          marginBottom: "2px"
        }}>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            style={{
              height: "36px",
              border: "1px solid #E5E7EB",
              borderRadius: "10px",
              padding: "0 12px",
              fontSize: "13px",
              color: "#111111",
              backgroundColor: "#FFFFFF",
              outline: "none"
            }}
          />
          <span style={{ fontSize: "13px", color: "#9CA3AF" }}>até</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            style={{
              height: "36px",
              border: "1px solid #E5E7EB",
              borderRadius: "10px",
              padding: "0 12px",
              fontSize: "13px",
              color: "#111111",
              backgroundColor: "#FFFFFF",
              outline: "none"
            }}
          />
        </div>
      )}

      {/* ── 2. Metric cards ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px", width: "100%" }}>

        {/* Card 1 — dark / Receita Total */}
        <div style={{
          background: "radial-gradient(circle at 85% 15%, rgba(255,255,255,0.14), transparent 28%), linear-gradient(135deg, #080808 0%, #141414 55%, #202020 100%)",
          borderRadius: "20px",
          padding: "16px",
          height: "136px",
          border: "1px solid rgba(255,255,255,0.08)",
          position: "relative",
          overflow: "hidden",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transition: "all 200ms"
        }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ 
              fontSize: "16px", 
              lineHeight: "20px", 
              fontWeight: 400, 
              letterSpacing: "-0.02em", 
              color: "rgba(255,255,255,0.82)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block"
            }}>
              Receita Total
            </span>
            <div style={{ 
              fontSize: "38px", 
              lineHeight: 1, 
              fontWeight: 400, 
              letterSpacing: "-0.06em", 
              color: "#FFFFFF", 
              marginTop: "18px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {loadingStats ? "—" : fmt(totalRevenue)}
            </div>
          </div>
          <div style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "5px", 
            height: "24px", 
            padding: "0 10px", 
            borderRadius: "999px", 
            backgroundColor: "rgba(255,255,255,0.12)", 
            alignSelf: "flex-start", 
            marginTop: "14px",
            maxWidth: "calc(100% - 50px)",
            minWidth: 0
          }}>
            <span style={{ backgroundColor: "#EAF8EC", color: "#168A3A", borderRadius: "5px", padding: "2px 5px", fontSize: "11px", fontWeight: 600, flexShrink: 0 }}>
              {loadingStats ? "—" : totalOrders > 0 ? "↑" : "—"}
            </span>
            <span style={{ fontSize: "12px", fontWeight: 400, color: "rgba(255,255,255,0.82)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
              {loadingStats ? "Carregando..." : totalOrders > 0 ? "Receita acumulada" : "Sem pedidos ainda"}
            </span>
          </div>
          {/* Icon */}
          <div style={{ position: "absolute", top: "16px", right: "16px", width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={18} strokeWidth={1.75} style={{ color: "#FFFFFF" }} />
          </div>
        </div>

        {/* Cards 2–4 — white */}
        {[
          { label: "Total de Pedidos", value: loadingStats ? "—" : fmtNum(totalOrders), pct: "", icon: <ShoppingCart size={18} strokeWidth={1.75} style={{ color: "#6B7280" }} />, sub: "pedidos recebidos" },
          { label: "Produtos Ativos",  value: loadingStats ? "—" : fmtNum(totalPubs),   pct: "", icon: <Package      size={18} strokeWidth={1.75} style={{ color: "#6B7280" }} />, sub: "publicações ativas" },
          { label: "Clientes",         value: loadingStats ? "—" : fmtCompact(statsData?.totalOrders ?? 0),  pct: "",   icon: <Users        size={18} strokeWidth={1.75} style={{ color: "#6B7280" }} />, sub: "pedidos únicos" },
        ].map((m) => (
          <div key={m.label} style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "20px",
            padding: "16px",
            height: "136px",
            border: "1px solid rgba(0,0,0,0.04)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            position: "relative",
            overflow: "hidden",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "all 200ms"
          }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ 
                fontSize: "16px", 
                lineHeight: "20px", 
                fontWeight: 400, 
                letterSpacing: "-0.02em", 
                color: "#111111",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block"
              }}>
                {m.label}
              </span>
              <div style={{ 
                fontSize: "38px", 
                lineHeight: 1, 
                fontWeight: 400, 
                letterSpacing: "-0.06em", 
                color: "#111827", 
                marginTop: "22px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}>
                {m.value}
              </div>
            </div>
            <div style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "5px", 
              marginTop: "14px",
              maxWidth: "calc(100% - 50px)",
              minWidth: 0
            }}>
              {m.pct && <span style={{ backgroundColor: "#EAF8EC", color: "#168A3A", borderRadius: "5px", padding: "2px 5px", fontSize: "11px", fontWeight: 600, flexShrink: 0 }}>{m.pct}</span>}
              <span style={{ 
                fontSize: "12px", 
                color: "#9CA3AF", 
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0
              }}>{m.sub}</span>
            </div>
            {/* Icon */}
            <div style={{ position: "absolute", top: "16px", right: "16px", width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {m.icon}
            </div>
          </div>
        ))}
      </div>

      {/* ── 3. Activity + Sales Calendar ───────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", alignItems: "stretch" }}>

        {/* Recent Activity */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <h2 style={{ 
              fontSize: "18px", 
              lineHeight: "24px",
              fontWeight: 500, 
              letterSpacing: "-0.04em",
              color: "#111111", 
              margin: 0 
            }}>Atividade recente</h2>
            <button style={{ 
              fontSize: "13px", 
              fontWeight: 500, 
              letterSpacing: "-0.02em",
              color: "#111111", 
              background: "#FFFFFF", 
              border: "1px solid #E5E7EB", 
              cursor: "pointer", 
              padding: "6px 12px", 
              borderRadius: "999px",
              transition: "background-color 0.15s"
            }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F9FAFB")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
            >
              Ver tudo
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {recentActivity.map((item, i) => (
              <div key={item.id} style={{
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                height: "46px",
                gap: "10px",
                borderBottom: i < recentActivity.length - 1 ? "1px solid #F0F0F0" : "none"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "999px", backgroundColor: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <CheckCircle size={14} strokeWidth={1.5} style={{ color: "#111111" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: "14px", 
                      lineHeight: "19px",
                      fontWeight: 500, 
                      letterSpacing: "-0.03em",
                      color: "#111111", 
                      marginBottom: "2px", 
                      overflow: "hidden", 
                      textOverflow: "ellipsis", 
                      whiteSpace: "nowrap" 
                    }}>{item.text}</div>
                    <div style={{ 
                      fontSize: "13px", 
                      lineHeight: "18px",
                      fontWeight: 400,
                      letterSpacing: "-0.02em",
                      color: "#9CA3AF", 
                      overflow: "hidden", 
                      textOverflow: "ellipsis", 
                      whiteSpace: "nowrap" 
                    }}>{item.sub}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  <span style={{ 
                    fontSize: "13px", 
                    lineHeight: "18px",
                    fontWeight: 400,
                    letterSpacing: "-0.02em",
                    color: "#9CA3AF", 
                    whiteSpace: "nowrap" 
                  }}>{item.time}</span>
                  <button style={{ 
                    background: "none", 
                    border: "none", 
                    cursor: "pointer", 
                    padding: "3px", 
                    borderRadius: "5px", 
                    display: "flex",
                    transition: "background-color 0.15s"
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F5F5F5")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <MoreVertical size={13} style={{ color: "#9CA3AF" }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sales Calendar */}
        <SalesCalendar userId={user?.id} />
      </div>

      {/* ── 4. Orders table ────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <h2 style={{ 
            fontSize: "18px", 
            lineHeight: "24px",
            fontWeight: 500, 
            letterSpacing: "-0.04em",
            color: "#111111", 
            margin: 0 
          }}>Gerenciamento de pedidos</h2>
          <button style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            fontSize: "13px", 
            fontWeight: 500, 
            letterSpacing: "-0.02em",
            color: "#111111",
            backgroundColor: "#FFFFFF", 
            border: "1px solid #E5E7EB", 
            cursor: "pointer",
            padding: "6px 12px", 
            borderRadius: "999px", 
            transition: "background-color 0.15s"
          }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F9FAFB")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
          >
            Ver todos os pedidos
            <ArrowUpRight size={13} />
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                {["Pedido", "Cliente", "Status", "Última atualização", "Ação"].map((h) => (
                  <th key={h} style={{
                    padding: "10px 10px", 
                    textAlign: "left",
                    fontSize: "11px", 
                    fontWeight: 600, 
                    letterSpacing: "-0.01em",
                    color: "#9CA3AF",
                    textTransform: "uppercase"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingRecentOrders ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} style={{ padding: "10px" }}>
                      <div style={{ height: "36px", backgroundColor: "#F5F5F5", borderRadius: "8px", animation: "pulse 1.5s ease-in-out infinite" }} />
                    </td>
                  </tr>
                ))
              ) : recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "24px", textAlign: "center", fontSize: "13px", color: "#9CA3AF" }}>
                    Nenhum pedido encontrado. Sincronize sua conta do Mercado Livre.
                  </td>
                </tr>
              ) : (
                recentOrders.map((o) => (
                <tr key={o.id}
                  style={{ borderBottom: "1px solid #F9FAFB", transition: "background-color 0.12s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAFAFA")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <td style={{ padding: "13px 10px" }}>
                    <span style={{ 
                      fontSize: "14px", 
                      lineHeight: "19px",
                      fontWeight: 500, 
                      letterSpacing: "-0.03em",
                      color: "#111111" 
                    }}>{o.id}</span>
                  </td>
                  <td style={{ padding: "13px 10px", maxWidth: "200px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 600, color: "#111111", flexShrink: 0 }}>
                        {o.client.charAt(0)}
                      </div>
                      <span style={{ 
                        fontSize: "14px", 
                        lineHeight: "19px",
                        fontWeight: 500, 
                        letterSpacing: "-0.03em",
                        color: "#111111", 
                        overflow: "hidden", 
                        textOverflow: "ellipsis", 
                        whiteSpace: "nowrap", 
                        flex: 1, 
                        minWidth: 0 
                      }}>{o.client}</span>
                    </div>
                  </td>
                  <td style={{ padding: "13px 10px" }}>
                    <StatusBadge status={o.status} />
                  </td>
                  <td style={{ padding: "13px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <Clock size={12} style={{ color: "#9CA3AF" }} />
                      <span style={{ 
                        fontSize: "13px", 
                        lineHeight: "18px",
                        fontWeight: 400,
                        letterSpacing: "-0.02em",
                        color: "#9CA3AF" 
                      }}>{o.updated}</span>
                    </div>
                  </td>
                  <td style={{ padding: "13px 10px" }}>
                    <button style={{
                      fontSize: "13px", 
                      fontWeight: 500, 
                      letterSpacing: "-0.02em",
                      color: "#111111",
                      backgroundColor: "#FFFFFF", 
                      border: "1px solid #E5E7EB",
                      padding: "6px 12px", 
                      borderRadius: "999px", 
                      cursor: "pointer",
                      transition: "background-color 0.15s"
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F9FAFB")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
