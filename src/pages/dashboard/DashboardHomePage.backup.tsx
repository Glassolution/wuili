import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Calendar,
  Check,
  Clock,
  DollarSign,
  Download,
  Package,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinancialData } from "@/hooks/useFinancialData";

// ── Types ─────────────────────────────────────────────────────────────────────

type Publication = {
  id: string;
  title: string;
  thumbnail: string | null;
  price: number | null;
  status: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function pctChange(current: number, previous: number) {
  // If there is no baseline, avoid noisy "100%" spikes.
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function clampPct(v: number) {
  if (!Number.isFinite(v)) return 0;
  // avoid ugly huge values when previous period is very small
  return Math.max(Math.min(v, 999), -999);
}

function formatShortDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function getOrderDate(order: { ordered_at?: string | null; created_at: string }) {
  const d = new Date(order.ordered_at ?? order.created_at);
  return Number.isNaN(d.getTime()) ? new Date(order.created_at) : d;
}

function sumOrdersBy(
  orders: Array<{ total?: number | null; status: string; created_at: string; ordered_at?: string | null }>,
  predicate: (o: any) => boolean
) {
  return orders.reduce((s, o) => (predicate(o) ? s + Number(o.total ?? 0) : s), 0);
}

function countOrdersBy(
  orders: Array<{ status: string; created_at: string; ordered_at?: string | null }>,
  predicate: (o: any) => boolean
) {
  return orders.reduce((s, o) => (predicate(o) ? s + 1 : s), 0);
}

const ACTIVE_STATUSES = new Set(["paid", "approved", "completed"]);

type MetricCardProps = {
  label: string;
  value: string;
  icon: ReactNode;
  deltaPct: number;
};

function MetricCard({ label, value, icon, deltaPct }: MetricCardProps) {
  const pct = clampPct(deltaPct);
  const isPositive = pct >= 0;
  const DeltaIcon = isPositive ? ArrowUpRight : ArrowDownRight;
  const deltaColor = isPositive ? "#111111" : "#EF4444";

  return (
    <div className="border border-[#F0F0F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ borderRadius: "18px", padding: "20px" }}>
      <div className="flex items-start justify-between" style={{ gap: "12px" }}>
        <p style={{ fontSize: "13px", fontWeight: 500, lineHeight: "18px", color: "#8A8FA3" }}>
          {label}
        </p>
        <span className="inline-flex items-center justify-center rounded-lg bg-[#F5F5F5]" style={{ padding: "8px" }}>
          {icon}
        </span>
      </div>

      <div 
        className="leading-tight"
        style={{ 
          marginTop: "12px",
          fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: "24px", 
          fontWeight: 500, 
          lineHeight: "30px", 
          color: "#0A0A0A",
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: '"tnum", "cv11", "ss01"'
        }}
      >
        {value}
      </div>

      <div className="flex items-center" style={{ marginTop: "10px", gap: "6px" }}>
        <DeltaIcon size={14} />
        <span 
          style={{ 
            fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: "13px", 
            fontWeight: 400, 
            color: deltaColor,
            fontVariantNumeric: "tabular-nums",
            fontFeatureSettings: '"tnum", "cv11", "ss01"'
          }}
        >
          {`${Math.abs(pct).toFixed(1)}%`}
        </span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<
    "today" | "month" | "last30" | "last90" | "all" | "custom"
  >("last30");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const { orders, pendingOrders, summary, isLoading: isLoadingFinancial } = useFinancialData();

  // ── Fetch published products ──────────────────────────────────────────────
  const { data: publications, isLoading: loadingPubs } = useQuery({
    queryKey: ["dashboard-publications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_publications" as any)
        .select("id, title, thumbnail, price, status")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data ?? []) as Publication[];
    },
  });

  // ── Fetch real stats ──────────────────────────────────────────────────────
  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [ordersRes, pubsRes, revenueRes] = await Promise.all([
        supabase
          .from("orders" as any)
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id),
        supabase
          .from("user_publications" as any)
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("status", "active"),
        supabase
          .from("orders" as any)
          .select("sale_price")
          .eq("user_id", user!.id),
      ]);
      const totalOrders = ordersRes.count ?? 0;
      const totalPubs   = pubsRes.count ?? 0;
      const revenue     = ((revenueRes.data ?? []) as { sale_price: number }[])
        .reduce((s, o) => s + (o.sale_price ?? 0), 0);
      return { totalOrders, totalPubs, revenue };
    },
  });

  const totalRevenue = statsData?.revenue ?? 0;
  const estimatedProfit = totalRevenue * 0.20; // 20% profit margin

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Usuário";
  const greeting = "Bom dia";

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      gap: "24px",
      fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif',
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
      textRendering: "optimizeLegibility",
      backgroundColor: "#F5F8F6",
      minHeight: "100vh",
      padding: "24px"
    }}>
      
      {/* ── Header Interno ────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: "14px", fontWeight: 400, color: "#6B7280", marginBottom: "4px" }}>
            {greeting},
          </p>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
            {userName}
          </h1>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Busca */}
          <div style={{ position: "relative" }}>
            <Search size={18} style={{ color: "#9CA3AF", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Buscar..."
              style={{
                height: "42px",
                width: "240px",
                paddingLeft: "40px",
                paddingRight: "12px",
                borderRadius: "12px",
                border: "1px solid #E8EEE9",
                backgroundColor: "#FFFFFF",
                fontSize: "14px",
                outline: "none"
              }}
            />
          </div>
          
          {/* Notificações */}
          <button style={{
            width: "42px",
            height: "42px",
            borderRadius: "12px",
            border: "1px solid #E8EEE9",
            backgroundColor: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative"
          }}>
            <span style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#16A34A"
            }} />
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 6.66669C15 5.34061 14.4732 4.06883 13.5355 3.13115C12.5979 2.19347 11.3261 1.66669 10 1.66669C8.67392 1.66669 7.40215 2.19347 6.46447 3.13115C5.52678 4.06883 5 5.34061 5 6.66669C5 12.5 2.5 14.1667 2.5 14.1667H17.5C17.5 14.1667 15 12.5 15 6.66669Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11.4417 17.5C11.2952 17.7526 11.0849 17.9622 10.8319 18.1079C10.5789 18.2537 10.292 18.3304 10 18.3304C9.70802 18.3304 9.42116 18.2537 9.16814 18.1079C8.91513 17.9622 8.70484 17.7526 8.55835 17.5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {/* Perfil */}
          <div style={{
            height: "42px",
            paddingLeft: "12px",
            paddingRight: "12px",
            borderRadius: "12px",
            border: "1px solid #E8EEE9",
            backgroundColor: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer"
          }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "#063B2E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: "14px",
              fontWeight: 600
            }}>
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* ── Grid Principal: Hero + Categorias ────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px" }}>
        
        {/* Hero Card */}
        <div style={{
          background: "linear-gradient(135deg, #063B2E 0%, #2F6B3F 100%)",
          borderRadius: "24px",
          padding: "40px",
          height: "280px",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}>
          {/* Decorative circles */}
          <div style={{ position: "absolute", top: "-40px", right: "100px", width: "200px", height: "200px", borderRadius: "50%", backgroundColor: "rgba(148, 201, 90, 0.1)" }} />
          <div style={{ position: "absolute", bottom: "-60px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(148, 201, 90, 0.08)" }} />
          
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontSize: "32px", fontWeight: 700, color: "#FFFFFF", lineHeight: 1.3, marginBottom: "16px" }}>
              Suas vendas estão<br />crescendo 🚀
            </h2>
            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "48px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
                {loadingStats ? "—" : fmt(estimatedProfit)}
              </span>
            </div>
            <p style={{ fontSize: "15px", fontWeight: 400, color: "rgba(255, 255, 255, 0.8)", marginBottom: "24px" }}>
              Lucro estimado do período
            </p>
            
            <button style={{
              height: "48px",
              paddingLeft: "24px",
              paddingRight: "24px",
              borderRadius: "12px",
              backgroundColor: "#FFFFFF",
              color: "#063B2E",
              fontSize: "15px",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}>
              Ver relatório
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          
          {/* Illustration placeholder */}
          <div style={{
            position: "absolute",
            right: "40px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "200px",
            height: "200px",
            opacity: 0.15
          }}>
            <TrendingUp size={200} strokeWidth={1} style={{ color: "#FFFFFF" }} />
          </div>
        </div>

        {/* Categorias Card */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "24px",
          padding: "28px",
          border: "1px solid #E8EEE9",
          height: "280px",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
            <h3 style={{ fontSize: "20px", fontWeight: 600, color: "#0F172A" }}>
              Categorias principais
            </h3>
            <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
              <SlidersHorizontal size={20} style={{ color: "#6B7280" }} />
            </button>
          </div>
          
          {/* Donut Chart Placeholder */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", marginBottom: "20px" }}>
            <div style={{ position: "relative", width: "140px", height: "140px" }}>
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="60" fill="none" stroke="#E8EEE9" strokeWidth="20"/>
                <circle cx="70" cy="70" r="60" fill="none" stroke="#94C95A" strokeWidth="20" strokeDasharray="283 377" strokeDashoffset="0" transform="rotate(-90 70 70)"/>
                <circle cx="70" cy="70" r="60" fill="none" stroke="#063B2E" strokeWidth="20" strokeDasharray="113 377" strokeDashoffset="-283" transform="rotate(-90 70 70)"/>
                <circle cx="70" cy="70" r="60" fill="none" stroke="#FFA500" strokeWidth="20" strokeDasharray="63 377" strokeDashoffset="-396" transform="rotate(-90 70 70)"/>
              </svg>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                <div style={{ fontSize: "11px", fontWeight: 500, color: "#6B7280", marginBottom: "2px" }}>TOTAL</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#0F172A" }}>24.3K</div>
              </div>
            </div>
          </div>
          
          {/* Legend */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#94C95A" }} />
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#6B7280" }}>Moda</span>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>80,02%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#063B2E" }} />
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#6B7280" }}>Eletrônicos</span>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>24,53%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#FFA500" }} />
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#6B7280" }}>Casa</span>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>16,47%</span>
            </div>
          </div>
          
          <button style={{
            height: "40px",
            borderRadius: "10px",
            backgroundColor: "#F5F8F6",
            color: "#063B2E",
            fontSize: "14px",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px"
          }}>
            Ver detalhes
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 10L8 7L5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

  // ── Fetch published products ──────────────────────────────────────────────
  const { data: publications, isLoading: loadingPubs } = useQuery({
    queryKey: ["dashboard-publications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_publications" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select("id, title, thumbnail, price, status")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data ?? []) as Publication[];
    },
  });

  // ── Fetch real stats ──────────────────────────────────────────────────────
  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [ordersRes, pubsRes, revenueRes] = await Promise.all([
        // Total orders count
        supabase
          .from("orders" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id),
        // Total active publications count
        supabase
          .from("user_publications" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("status", "active"),
        // Total revenue (sum sale_price)
        supabase
          .from("orders" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .select("sale_price")
          .eq("user_id", user!.id),
      ]);
      const totalOrders = ordersRes.count ?? 0;
      const totalPubs   = pubsRes.count ?? 0;
      const revenue     = ((revenueRes.data ?? []) as { sale_price: number }[])
        .reduce((s, o) => s + (o.sale_price ?? 0), 0);
      return { totalOrders, totalPubs, revenue };
    },
  });

  const _totalOrders = statsData?.totalOrders ?? 0;
  const totalPubs   = statsData?.totalPubs   ?? 0;
  // Use orders from the hook as single source of truth (same as Financeiro page)
  // IMPORTANT: values must filter by the selected period.

  const now = new Date();

  const periodBounds = useMemo(() => {
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

    if (period === "today") {
      const start = startOfDay(now);
      const end = endOfDay(now);
      const prevStart = startOfDay(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000));
      const prevEnd = endOfDay(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000));
      return { start, end, prevStart, prevEnd };
    }

    if (period === "month") {
      const start = startOfMonth(now);
      const end = endOfDay(now);
      const prevMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const prevMonthEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      return { start, end, prevStart: prevMonthStart, prevEnd: prevMonthEnd };
    }

    if (period === "last30" || period === "last90") {
      const days = period === "last30" ? 30 : 90;
      const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const end = now;
      const prevStart = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000);
      const prevEnd = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return { start, end, prevStart, prevEnd };
    }

    if (period === "custom") {
      const start = customStart ? startOfDay(new Date(customStart)) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const end = customEnd ? endOfDay(new Date(customEnd)) : now;
      const duration = Math.max(end.getTime() - start.getTime(), 0);
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - duration);
      return { start, end, prevStart, prevEnd };
    }

    // all time
    return { start: null as any, end: null as any, prevStart: null as any, prevEnd: null as any };
  }, [period, customStart, customEnd]);

  const ordersInPeriod = useMemo(() => {
    if (period === "all") return orders;
    const { start, end } = periodBounds;
    return orders.filter((o) => {
      const d = getOrderDate(o);
      return d >= start && d <= end;
    });
  }, [orders, period, periodBounds]);

  const pendingInPeriod = useMemo(() => {
    if (period === "all") return pendingOrders;
    const { start, end } = periodBounds;
    return pendingOrders.filter((o) => {
      const d = getOrderDate(o);
      return d >= start && d <= end;
    });
  }, [pendingOrders, period, periodBounds]);

  const activeRevenueInPeriod = useMemo(() => {
    if (period === "all") {
      // fallback to summary for performance/consistency
      return summary.revenue > 0 ? summary.revenue : (statsData?.revenue ?? 0);
    }
    const { start, end } = periodBounds;
    return sumOrdersBy(orders, (o) => {
      if (!ACTIVE_STATUSES.has(String(o.status))) return false;
      const d = getOrderDate(o);
      return d >= start && d <= end;
    });
  }, [orders, period, periodBounds, summary.revenue, statsData?.revenue]);

  const activeRevenuePrevPeriod = useMemo(() => {
    if (period === "all") return 0;
    const { prevStart, prevEnd } = periodBounds;
    return sumOrdersBy(orders, (o) => {
      if (!ACTIVE_STATUSES.has(String(o.status))) return false;
      const d = getOrderDate(o);
      return d >= prevStart && d <= prevEnd;
    });
  }, [orders, period, periodBounds]);

  const pendingCountInPeriod = pendingInPeriod.length;
  const pendingCountPrevPeriod = useMemo(() => {
    if (period === "all") return 0;
    const { prevStart, prevEnd } = periodBounds;
    return countOrdersBy(pendingOrders, (o) => {
      const d = getOrderDate(o);
      return d >= prevStart && d <= prevEnd;
    });
  }, [pendingOrders, period, periodBounds]);

  const topPublications = publications?.slice(0, 3) ?? [];
  const publicationCards = useMemo(() => {
    const cards = topPublications.map((pub) => {
      const available = sumOrdersBy(ordersInPeriod, (o) => {
        if (!ACTIVE_STATUSES.has(String(o.status))) return false;
        if (!pub.title) return false;
        return String(o.product_title ?? "") === String(pub.title);
      });
      const pending = sumOrdersBy(ordersInPeriod, (o) => {
        if (String(o.status) !== "pending") return false;
        if (!pub.title) return false;
        return String(o.product_title ?? "") === String(pub.title);
      });
      return { pub, available, pending };
    });

    // Fill empty slots (up to 3) with placeholders
    while (cards.length < 3) {
      cards.push({ pub: null as any, available: 0, pending: 0 });
    }
    return cards;
  }, [topPublications, ordersInPeriod]);

  const ordersFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = ordersInPeriod;
    if (!q) return base;
    return base.filter((o) => {
      const id = String(o.id ?? "").toLowerCase();
      const platform = String(o.platform ?? "").toLowerCase();
      const title = String(o.product_title ?? "").toLowerCase();
      return id.includes(q) || platform.includes(q) || title.includes(q);
    });
  }, [ordersInPeriod, search]);

  const recentOrders = useMemo(() => {
    return ordersFiltered.slice(0, 8);
  }, [ordersFiltered]);

  const upcomingPayouts = useMemo(() => {
    // Simple heuristic: group pending orders by platform and show top 4.
    const map = new Map<string, { platform: string; amount: number }>();
    for (const o of pendingInPeriod) {
      const platform = (o.platform ?? "Outros").toString();
      const prev = map.get(platform) ?? { platform, amount: 0 };
      prev.amount += Number(o.total ?? 0);
      map.set(platform, prev);
    }
    const items = Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4)
      .map((it, idx) => {
        const d = new Date(now);
        d.setDate(d.getDate() + idx * 2);
        return {
          platform: it.platform,
          amount: it.amount,
          date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        };
      });
    return items;
  }, [pendingInPeriod, now]);

  const deltaRevenuePct =
    period === "all" ? 0 : pctChange(activeRevenueInPeriod, activeRevenuePrevPeriod);
  const deltaPendingPct =
    period === "all" ? 0 : pctChange(pendingCountInPeriod, pendingCountPrevPeriod);

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      gap: "14px",
      fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif',
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
      textRendering: "optimizeLegibility",
      fontFeatureSettings: '"cv11", "ss01"'
    }}>
      {/* ── Barra de Filtros Superior ────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center" style={{ gap: "10px" }}>
          {[
            { value: "today", label: "Hoje" },
            { value: "month", label: "Esse mês" },
            { value: "last30", label: "Últimos 30 dias" },
            { value: "last90", label: "Últimos 90 dias" },
            { value: "all", label: "Todo o período" },
            { value: "custom", label: "Personalizado" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value as any)}
              className="transition-all duration-200"
              style={{
                height: "42px",
                paddingLeft: "18px",
                paddingRight: "18px",
                borderRadius: "14px",
                fontSize: "14px",
                fontWeight: 500,
                lineHeight: "20px",
                border: period === option.value ? "none" : "1px solid #E5E7EB",
                backgroundColor: period === option.value ? "#111111" : "#FFFFFF",
                color: period === option.value ? "#FFFFFF" : "#000000",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (period !== option.value) {
                  e.currentTarget.style.backgroundColor = "#F9FAFB";
                } else {
                  e.currentTarget.style.backgroundColor = "#1F2937";
                }
              }}
              onMouseLeave={(e) => {
                if (period !== option.value) {
                  e.currentTarget.style.backgroundColor = "#FFFFFF";
                } else {
                  e.currentTarget.style.backgroundColor = "#111111";
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 transition-colors"
          style={{
            height: "42px",
            paddingLeft: "20px",
            paddingRight: "20px",
            borderRadius: "14px",
            fontSize: "14px",
            fontWeight: 500,
            lineHeight: "20px",
            backgroundColor: "#111111",
            color: "#FFFFFF",
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1F2937"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#111111"}
        >
          <Download size={18} strokeWidth={2} />
          Exportar
        </button>
      </div>

      {/* ── Grid Principal: [Métricas 2x2] [Gráfico] ────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[36%_64%]">
        
        {/* COLUNA ESQUERDA: Cards de Métricas 2x2 */}
        <div className="grid grid-cols-2" style={{ gap: "14px", minWidth: 0 }}>
          
          {/* Card: Total Revenue */}
          <div 
            style={{ 
              position: "relative",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "18px",
              overflow: "hidden",
              height: "132px",
              padding: "16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              minWidth: 0
            }}
          >
            {/* Label */}
            <div style={{ 
              fontSize: "13px", 
              fontWeight: 500, 
              color: "#8A8FA3",
              lineHeight: "18px",
              maxWidth: "calc(100% - 50px)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>
              Receita Total
            </div>
            
            {/* Ícone */}
            <div 
              style={{ 
                position: "absolute",
                top: "14px",
                right: "14px",
                width: "36px", 
                height: "36px", 
                borderRadius: "12px", 
                backgroundColor: "#2F2F2F",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                zIndex: 2
              }}
            >
              <DollarSign size={16} strokeWidth={1.5} style={{ color: "#FFFFFF" }} />
            </div>
            
            {/* Valor */}
            <div 
              style={{ 
                position: "absolute",
                left: "16px",
                bottom: "36px",
                fontSize: "30px", 
                fontWeight: 650, 
                lineHeight: 1, 
                color: "#111111",
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
                maxWidth: "calc(100% - 32px)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {loadingStats || isLoadingFinancial ? "—" : fmt(activeRevenueInPeriod)}
            </div>
            
            {/* Rodapé */}
            <div 
              style={{ 
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: "30px",
                borderTop: "1px solid #F1F1F1",
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                fontSize: "11px",
                fontWeight: 400,
                lineHeight: "14px",
                color: "#9CA3AF",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              Última atualização: 06 Mai, 2026
            </div>
          </div>

          {/* Card: Total Orders */}
          <div 
            style={{ 
              position: "relative",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "18px",
              overflow: "hidden",
              height: "132px",
              padding: "16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              minWidth: 0
            }}
          >
            {/* Label */}
            <div style={{ 
              fontSize: "13px", 
              fontWeight: 500, 
              color: "#8A8FA3",
              lineHeight: "18px",
              maxWidth: "calc(100% - 50px)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>
              Total de Pedidos
            </div>
            
            {/* Ícone */}
            <div 
              style={{ 
                position: "absolute",
                top: "14px",
                right: "14px",
                width: "36px", 
                height: "36px", 
                borderRadius: "12px", 
                backgroundColor: "#2F2F2F",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                zIndex: 2
              }}
            >
              <ShoppingBag size={16} strokeWidth={1.5} style={{ color: "#FFFFFF" }} />
            </div>
            
            {/* Valor */}
            <div 
              style={{ 
                position: "absolute",
                left: "16px",
                bottom: "36px",
                fontSize: "30px", 
                fontWeight: 650, 
                lineHeight: 1, 
                color: "#111111",
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
                maxWidth: "calc(100% - 32px)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {loadingStats || isLoadingFinancial ? "—" : ordersInPeriod.length.toLocaleString("pt-BR")}
            </div>
            
            {/* Rodapé */}
            <div 
              style={{ 
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: "30px",
                borderTop: "1px solid #F1F1F1",
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                fontSize: "11px",
                fontWeight: 400,
                lineHeight: "14px",
                color: "#9CA3AF",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              Última atualização: 06 Mai, 2026
            </div>
          </div>

          {/* Card: Total Products */}
          <div 
            style={{ 
              position: "relative",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "18px",
              overflow: "hidden",
              height: "132px",
              padding: "16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              minWidth: 0
            }}
          >
            {/* Label */}
            <div style={{ 
              fontSize: "13px", 
              fontWeight: 500, 
              color: "#8A8FA3",
              lineHeight: "18px",
              maxWidth: "calc(100% - 50px)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>
              Total de Produtos
            </div>
            
            {/* Ícone */}
            <div 
              style={{ 
                position: "absolute",
                top: "14px",
                right: "14px",
                width: "36px", 
                height: "36px", 
                borderRadius: "12px", 
                backgroundColor: "#2F2F2F",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                zIndex: 2
              }}
            >
              <Package size={16} strokeWidth={1.5} style={{ color: "#FFFFFF" }} />
            </div>
            
            {/* Valor */}
            <div 
              style={{ 
                position: "absolute",
                left: "16px",
                bottom: "36px",
                fontSize: "30px", 
                fontWeight: 650, 
                lineHeight: 1, 
                color: "#111111",
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
                maxWidth: "calc(100% - 32px)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {loadingStats ? "—" : totalPubs.toLocaleString("pt-BR")}
            </div>
            
            {/* Rodapé */}
            <div 
              style={{ 
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: "30px",
                borderTop: "1px solid #F1F1F1",
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                fontSize: "11px",
                fontWeight: 400,
                lineHeight: "14px",
                color: "#9CA3AF",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              Última atualização: 06 Mai, 2026
            </div>
          </div>

          {/* Card: Total Customers */}
          <div 
            style={{ 
              position: "relative",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "18px",
              overflow: "hidden",
              height: "132px",
              padding: "16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              minWidth: 0
            }}
          >
            {/* Label */}
            <div style={{ 
              fontSize: "13px", 
              fontWeight: 500, 
              color: "#8A8FA3",
              lineHeight: "18px",
              maxWidth: "calc(100% - 50px)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>
              Total de Clientes
            </div>
            
            {/* Ícone */}
            <div 
              style={{ 
                position: "absolute",
                top: "14px",
                right: "14px",
                width: "36px", 
                height: "36px", 
                borderRadius: "12px", 
                backgroundColor: "#2F2F2F",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                zIndex: 2
              }}
            >
              <Users size={16} strokeWidth={1.5} style={{ color: "#FFFFFF" }} />
            </div>
            
            {/* Valor */}
            <div 
              style={{ 
                position: "absolute",
                left: "16px",
                bottom: "36px",
                fontSize: "30px", 
                fontWeight: 650, 
                lineHeight: 1, 
                color: "#111111",
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
                maxWidth: "calc(100% - 32px)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {loadingStats || isLoadingFinancial ? "—" : new Set(orders.map(o => o.customer_email || o.customer_name)).size.toLocaleString("pt-BR")}
            </div>
            
            {/* Rodapé */}
            <div 
              style={{ 
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: "30px",
                borderTop: "1px solid #F1F1F1",
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                fontSize: "11px",
                fontWeight: 400,
                lineHeight: "14px",
                color: "#9CA3AF",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              Última atualização: 06 Mai, 2026
            </div>
          </div>

        </div>

        {/* COLUNA CENTRAL: Gráfico de Receita */}
        <div 
          className="bg-white"
          style={{ 
            borderRadius: "18px", 
            padding: "20px",
            border: "1px solid #F3F4F6",
            boxShadow: "none"
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: "20px" }}>
            <h3 
              style={{ 
                fontSize: "16px", 
                fontWeight: 600, 
                color: "#111111",
                lineHeight: "22px",
              }}
            >
              Estatísticas de Receita
            </h3>
            <select
              className="border border-[#E5E7EB] bg-white"
              style={{
                height: "38px",
                paddingLeft: "10px",
                paddingRight: "26px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 400,
                color: "#9CA3AF",
                outline: "none",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
              }}
            >
              <option>Este mês</option>
              <option>Últimos 30 dias</option>
              <option>Últimos 90 dias</option>
            </select>
          </div>

          {/* Gráfico */}
          <div style={{ position: "relative", height: "220px" }}>
            {/* Eixo Y */}
            <div 
              style={{ 
                position: "absolute", 
                left: 0, 
                top: 0, 
                bottom: 28, 
                display: "flex", 
                flexDirection: "column", 
                justifyContent: "space-between",
                paddingRight: "14px"
              }}
            >
              {["$50000", "$20000", "$10000", "$5000", "$0"].map((label) => (
                <span 
                  key={label} 
                  style={{ 
                    fontSize: "11px", 
                    fontWeight: 400, 
                    color: "#9CA3AF",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Área do gráfico */}
            <div 
              style={{ 
                marginLeft: "64px", 
                height: "calc(100% - 28px)", 
                borderLeft: "1px solid #F3F4F6",
                borderBottom: "1px solid #F3F4F6",
                position: "relative"
              }}
            >
              {/* Grid horizontal */}
              {[0, 1, 2, 3, 4].map((i) => (
                <div 
                  key={`h-${i}`}
                  style={{ 
                    position: "absolute", 
                    left: 0, 
                    right: 0, 
                    top: `${i * 25}%`,
                    height: "1px", 
                    backgroundColor: "#F9FAFB" 
                  }}
                />
              ))}

              {/* Grid vertical */}
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div 
                  key={`v-${i}`}
                  style={{ 
                    position: "absolute", 
                    left: `${i * 12.5}%`,
                    top: 0,
                    bottom: 0,
                    width: "1px", 
                    backgroundColor: "#F9FAFB" 
                  }}
                />
              ))}

              {/* Linha do gráfico */}
              <svg 
                style={{ 
                  position: "absolute", 
                  top: 0, 
                  left: 0, 
                  width: "100%", 
                  height: "100%",
                  overflow: "visible"
                }}
                viewBox="0 0 700 232"
                preserveAspectRatio="none"
              >
                <path
                  d="M 0 200 Q 80 180, 160 160 T 320 120 T 480 85 Q 520 75, 560 72 T 640 78 T 700 88"
                  fill="none"
                  stroke="#111827"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                
                {/* Ponto de destaque em May */}
                <circle cx="560" cy="72" r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
                
                {/* Linha vertical do tooltip */}
                <line x1="560" y1="72" x2="560" y2="232" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              </svg>

              {/* Tooltip mockado */}
              <div 
                style={{ 
                  position: "absolute", 
                  left: "calc(80% - 50px)",
                  top: "16px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                  pointerEvents: "none"
                }}
              >
                <p style={{ fontSize: "10px", fontWeight: 400, color: "#9CA3AF", marginBottom: "2px" }}>
                  06 Mai, 2026
                </p>
                <p style={{ fontSize: "15px", fontWeight: 600, color: "#0A0A0A", marginBottom: "2px" }}>
                  16800
                </p>
                <p style={{ fontSize: "11px", fontWeight: 500, color: "#10B981" }}>
                  +10%
                </p>
              </div>
            </div>

            {/* Eixo X */}
            <div 
              style={{ 
                marginLeft: "64px",
                marginTop: "6px",
                display: "flex", 
                justifyContent: "space-between",
                paddingRight: "18px"
              }}
            >
              {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago"].map((month) => (
                <span 
                  key={month} 
                  style={{ 
                    fontSize: "10px", 
                    fontWeight: 400, 
                    color: "#9CA3AF" 
                  }}
                >
                  {month}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ── Faixa Horizontal: Produtos em Destaque ────────────────────── */}
      <style>
        {`
          @keyframes scroll-products {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }
          
          .scroll-container {
            animation: scroll-products 40s linear infinite;
          }
          
          .scroll-container:hover {
            animation-play-state: paused;
          }
          
          @keyframes float-circle {
            0%, 100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-10px);
            }
          }

          .product-card {
            transition: all 300ms cubic-bezier(0.22, 1, 0.36, 1);
            transform-origin: center bottom;
          }

          .product-card:hover {
            transform: scale(1.10) translateY(-6px);
            z-index: 10;
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
          }

          .product-card:hover + .product-card,
          .product-card:has(+ .product-card:hover) {
            transform: scale(1.04);
            z-index: 5;
          }
        `}
      </style>
      
      <div 
        className="bg-white"
        style={{ 
          borderRadius: "20px", 
          padding: "18px",
          border: "1px solid #F0F2F5",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          overflow: "hidden",
          position: "relative"
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: "18px" }}>
          <h3 
            style={{ 
              fontSize: "17px", 
              fontWeight: 600, 
              color: "#111111",
              lineHeight: "22px",
            }}
          >
            Produtos em Destaque
          </h3>
          <Link
            to="/dashboard/produtos"
            style={{ 
              fontSize: "13px", 
              fontWeight: 500, 
              color: "#3B82F6",
              textDecoration: "none"
            }}
            className="hover:underline"
          >
            Ver todos
          </Link>
        </div>

        {/* Container com overflow hidden */}
        <div style={{ position: "relative", overflow: "hidden", height: "140px", paddingTop: "8px", paddingBottom: "8px" }}>
          {/* Círculos decorativos */}
          <div style={{ position: "absolute", left: "10%", top: "20px", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#E5E7EB", opacity: 0.4, animation: "float-circle 3s ease-in-out infinite" }} />
          <div style={{ position: "absolute", left: "30%", top: "60px", width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#E5E7EB", opacity: 0.3, animation: "float-circle 4s ease-in-out infinite 0.5s" }} />
          <div style={{ position: "absolute", left: "50%", top: "15px", width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#E5E7EB", opacity: 0.5, animation: "float-circle 3.5s ease-in-out infinite 1s" }} />
          <div style={{ position: "absolute", left: "70%", top: "50px", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#E5E7EB", opacity: 0.35, animation: "float-circle 4.5s ease-in-out infinite 1.5s" }} />
          <div style={{ position: "absolute", left: "85%", top: "25px", width: "14px", height: "14px", borderRadius: "50%", backgroundColor: "#E5E7EB", opacity: 0.25, animation: "float-circle 3.8s ease-in-out infinite 2s" }} />

          {/* Lista de produtos com scroll */}
          <div 
            className="scroll-container"
            style={{ 
              display: "flex", 
              gap: "24px",
              width: "fit-content"
            }}
          >
            {/* Duplicar produtos para loop infinito */}
            {[...Array(2)].map((_, setIndex) => (
              <div key={setIndex} style={{ display: "flex", gap: "24px" }}>
                {/* Produto 1 */}
                <div 
                  className="product-card"
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "12px",
                    backgroundColor: "#FFFFFF",
                    padding: "12px 16px",
                    borderRadius: "18px",
                    minWidth: "300px",
                    border: "1px solid #F0F2F5"
                  }}
                >
                  <div 
                    style={{ 
                      width: "72px", 
                      height: "72px", 
                      borderRadius: "16px", 
                      backgroundColor: "#F6F6F6",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Package size={28} strokeWidth={1.5} style={{ color: "#D1D5DB" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ 
                      fontSize: "14px", 
                      fontWeight: 600, 
                      color: "#111111", 
                      marginBottom: "4px", 
                      whiteSpace: "nowrap", 
                      overflow: "hidden", 
                      textOverflow: "ellipsis",
                    }}>
                      Diamond Crystal Lotus Ring
                    </p>
                    <p style={{ 
                      fontSize: "13px", 
                      fontWeight: 400, 
                      color: "#6B7280", 
                      marginBottom: "2px",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      R$ 300,00
                    </p>
                    <p style={{ 
                      fontSize: "13px", 
                      fontWeight: 600, 
                      color: "#16A34A", 
                      lineHeight: "18px", 
                      marginBottom: "6px",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      Lucro estimado: R$ 60,00
                    </p>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: "#6B7280", backgroundColor: "#F3F4F6", padding: "3px 8px", borderRadius: "4px" }}>Silver</span>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: "#6B7280", backgroundColor: "#F3F4F6", padding: "3px 8px", borderRadius: "4px" }}>Gold</span>
                    </div>
                  </div>
                </div>

                {/* Produto 2 */}
                <div 
                  className="product-card"
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "12px",
                    backgroundColor: "#FFFFFF",
                    padding: "12px 16px",
                    borderRadius: "18px",
                    minWidth: "300px",
                    border: "1px solid #F0F2F5"
                  }}
                >
                  <div 
                    style={{ 
                      width: "72px", 
                      height: "72px", 
                      borderRadius: "16px", 
                      backgroundColor: "#F6F6F6",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Package size={28} strokeWidth={1.5} style={{ color: "#D1D5DB" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "#111111", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Rose Gold Diamond Earrings
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 400, color: "#6B7280", marginBottom: "2px" }}>
                      R$ 180,00
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#16A34A", lineHeight: "18px", marginBottom: "6px" }}>
                      Lucro estimado: R$ 36,00
                    </p>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: "#6B7280", backgroundColor: "#F3F4F6", padding: "3px 8px", borderRadius: "4px" }}>Gold</span>
                    </div>
                  </div>
                </div>

                {/* Produto 3 */}
                <div 
                  className="product-card"
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "12px",
                    backgroundColor: "#FFFFFF",
                    padding: "12px 16px",
                    borderRadius: "18px",
                    minWidth: "300px",
                    border: "1px solid #F0F2F5"
                  }}
                >
                  <div 
                    style={{ 
                      width: "72px", 
                      height: "72px", 
                      borderRadius: "16px", 
                      backgroundColor: "#F6F6F6",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Package size={28} strokeWidth={1.5} style={{ color: "#D1D5DB" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "#111111", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Solitaire Diamond Engagement Ring
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 400, color: "#6B7280", marginBottom: "2px" }}>
                      R$ 150,00
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#16A34A", lineHeight: "18px", marginBottom: "6px" }}>
                      Lucro estimado: R$ 30,00
                    </p>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: "#6B7280", backgroundColor: "#F3F4F6", padding: "3px 8px", borderRadius: "4px" }}>Silver</span>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: "#6B7280", backgroundColor: "#F3F4F6", padding: "3px 8px", borderRadius: "4px" }}>Gold</span>
                    </div>
                  </div>
                </div>

                {/* Produto 4 */}
                <div 
                  className="product-card"
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "12px",
                    backgroundColor: "#FFFFFF",
                    padding: "12px 16px",
                    borderRadius: "18px",
                    minWidth: "300px",
                    border: "1px solid #F0F2F5"
                  }}
                >
                  <div 
                    style={{ 
                      width: "72px", 
                      height: "72px", 
                      borderRadius: "16px", 
                      backgroundColor: "#F6F6F6",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Package size={28} strokeWidth={1.5} style={{ color: "#D1D5DB" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "#111111", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Rose Gold Lotus Necklace
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 400, color: "#6B7280", marginBottom: "2px" }}>
                      R$ 200,00
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#16A34A", lineHeight: "18px", marginBottom: "6px" }}>
                      Lucro estimado: R$ 40,00
                    </p>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: "#6B7280", backgroundColor: "#F3F4F6", padding: "3px 8px", borderRadius: "4px" }}>Silver</span>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: "#6B7280", backgroundColor: "#F3F4F6", padding: "3px 8px", borderRadius: "4px" }}>Gold</span>
                    </div>
                  </div>
                </div>

                {/* Produto 5 */}
                <div 
                  className="product-card"
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "12px",
                    backgroundColor: "#FFFFFF",
                    padding: "12px 16px",
                    borderRadius: "18px",
                    minWidth: "300px",
                    border: "1px solid #F0F2F5"
                  }}
                >
                  <div 
                    style={{ 
                      width: "72px", 
                      height: "72px", 
                      borderRadius: "16px", 
                      backgroundColor: "#F6F6F6",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Package size={28} strokeWidth={1.5} style={{ color: "#D1D5DB" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "#111111", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Gold Prestige Intertwined Earrings
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 400, color: "#6B7280", marginBottom: "2px" }}>
                      R$ 180,00
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#16A34A", lineHeight: "18px", marginBottom: "6px" }}>
                      Lucro estimado: R$ 36,00
                    </p>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: "#6B7280", backgroundColor: "#F3F4F6", padding: "3px 8px", borderRadius: "4px" }}>Gold</span>
                    </div>
                  </div>
                </div>

                {/* Produto 6 */}
                <div 
                  className="product-card"
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "12px",
                    backgroundColor: "#FFFFFF",
                    padding: "12px 16px",
                    borderRadius: "18px",
                    minWidth: "300px",
                    border: "1px solid #F0F2F5"
                  }}
                >
                  <div 
                    style={{ 
                      width: "72px", 
                      height: "72px", 
                      borderRadius: "16px", 
                      backgroundColor: "#F6F6F6",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Package size={28} strokeWidth={1.5} style={{ color: "#D1D5DB" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "#111111", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Diamond Lotus Short Necklace
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 400, color: "#6B7280", marginBottom: "2px" }}>
                      R$ 150,00
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#16A34A", lineHeight: "18px", marginBottom: "6px" }}>
                      Lucro estimado: R$ 30,00
                    </p>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: "#6B7280", backgroundColor: "#F3F4F6", padding: "3px 8px", borderRadius: "4px" }}>Silver</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabela de Pedidos (Full Width) ────────────────────────────── */}
      <div 
        className="bg-white"
        style={{ 
          borderRadius: "14px",
          border: "1px solid #F3F4F6",
          boxShadow: "none",
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <div 
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ padding: "18px 20px", borderBottom: "1px solid #F3F4F6" }}
        >
          <h3 
            style={{ 
              fontSize: "17px", 
              fontWeight: 600, 
              color: "#111111",
              lineHeight: "22px",
            }}
          >
            Pedidos
          </h3>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={15} style={{ color: "#9CA3AF" }} className="absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar"
                className="border border-[#E5E7EB] bg-white pl-9 pr-3 outline-none"
                style={{ 
                  height: "38px", 
                  width: "220px",
                  borderRadius: "8px",
                  fontSize: "13px", 
                  fontWeight: 400, 
                  color: "#0A0A0A" 
                }}
              />
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 bg-[#1F2937] text-white"
              style={{
                height: "38px",
                paddingLeft: "14px",
                paddingRight: "14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#111827"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#1F2937"}
            >
              <SlidersHorizontal size={15} strokeWidth={2} />
              Filtrar
            </button>

            <button
              type="button"
              className="inline-flex items-center justify-center border border-[#E5E7EB] bg-white"
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "8px",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="4" r="1.5" fill="#6B7280"/>
                <circle cx="8" cy="8" r="1.5" fill="#6B7280"/>
                <circle cx="8" cy="12" r="1.5" fill="#6B7280"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr style={{ backgroundColor: "#F9FAFB" }}>
                <th style={{ width: "44px", padding: "11px 20px" }}>
                  <input type="checkbox" className="rounded border-[#D1D5DB]" style={{ width: "15px", height: "15px" }} />
                </th>
                {["ID do Pedido", "Nome do Cliente", "Data", "Nome do Produto", "Preço", "Status", "Ação"].map((h) => (
                  <th 
                    key={h} 
                    className="text-left" 
                    style={{ 
                      padding: "12px 16px",
                      fontSize: "12px", 
                      fontWeight: 500, 
                      color: "#6B7280",
                      lineHeight: "16px"
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Linha 1 */}
              <tr className="transition-colors hover:bg-[#F9FAFB]" style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={{ padding: "16px 24px" }}>
                  <input type="checkbox" className="rounded border-[#D1D5DB]" style={{ width: "16px", height: "16px" }} />
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <span style={{ fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: "14px", fontWeight: 500, color: "#0A0A0A", fontVariantNumeric: "tabular-nums" }}>
                    #891029
                  </span>
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <div className="flex items-center gap-3">
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600, color: "#6B7280", flexShrink: 0 }}>
                      P
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: 400, color: "#0A0A0A" }}>
                      Perry Wilson
                    </span>
                  </div>
                </td>
                <td style={{ padding: "16px 16px", fontSize: "14px", fontWeight: 400, color: "#6B7280" }}>
                  May 06, 2026
                </td>
                <td style={{ padding: "16px 16px", fontSize: "14px", fontWeight: 400, color: "#0A0A0A" }}>
                  Gold Prestige Intertwined Earrings
                </td>
                <td style={{ padding: "16px 16px", fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: "14px", fontWeight: 500, color: "#0A0A0A", fontVariantNumeric: "tabular-nums" }}>
                  $180.00
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <span className="inline-flex items-center" style={{ padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 500, backgroundColor: "#D1FAE5", color: "#065F46" }}>
                    Entregue
                  </span>
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors" title="View">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#6B7280" strokeWidth="1.5">
                        <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/>
                        <circle cx="8" cy="8" r="2"/>
                      </svg>
                    </button>
                    <button className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors" title="Delete">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#6B7280" strokeWidth="1.5">
                        <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334z"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>

              {/* Linha 2 */}
              <tr className="transition-colors hover:bg-[#F9FAFB]" style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={{ padding: "16px 24px" }}>
                  <input type="checkbox" className="rounded border-[#D1D5DB]" style={{ width: "16px", height: "16px" }} />
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <span style={{ fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: "14px", fontWeight: 500, color: "#0A0A0A", fontVariantNumeric: "tabular-nums" }}>
                    #881726
                  </span>
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <div className="flex items-center gap-3">
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600, color: "#6B7280", flexShrink: 0 }}>
                      T
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: 400, color: "#0A0A0A" }}>
                      Theresa Webb
                    </span>
                  </div>
                </td>
                <td style={{ padding: "16px 16px", fontSize: "14px", fontWeight: 400, color: "#6B7280" }}>
                  May 06, 2026
                </td>
                <td style={{ padding: "16px 16px", fontSize: "14px", fontWeight: 400, color: "#0A0A0A" }}>
                  Solitaire Diamond Engagement Ring
                </td>
                <td style={{ padding: "16px 16px", fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: "14px", fontWeight: 500, color: "#0A0A0A", fontVariantNumeric: "tabular-nums" }}>
                  $150.00
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <span className="inline-flex items-center" style={{ padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 500, backgroundColor: "#FEF3C7", color: "#92400E" }}>
                    Em andamento
                  </span>
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors" title="View">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#6B7280" strokeWidth="1.5">
                        <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/>
                        <circle cx="8" cy="8" r="2"/>
                      </svg>
                    </button>
                    <button className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors" title="Delete">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#6B7280" strokeWidth="1.5">
                        <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334z"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>

              {/* Linha 3 */}
              <tr className="transition-colors hover:bg-[#F9FAFB]" style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={{ padding: "16px 24px" }}>
                  <input type="checkbox" className="rounded border-[#D1D5DB]" style={{ width: "16px", height: "16px" }} />
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <span style={{ fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: "14px", fontWeight: 500, color: "#0A0A0A", fontVariantNumeric: "tabular-nums" }}>
                    #861728
                  </span>
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <div className="flex items-center gap-3">
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600, color: "#6B7280", flexShrink: 0 }}>
                      A
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: 400, color: "#0A0A0A" }}>
                      Alexa Mate
                    </span>
                  </div>
                </td>
                <td style={{ padding: "16px 16px", fontSize: "14px", fontWeight: 400, color: "#6B7280" }}>
                  May 05, 2026
                </td>
                <td style={{ padding: "16px 16px", fontSize: "14px", fontWeight: 400, color: "#0A0A0A" }}>
                  Rose Gold Diamond Earrings
                </td>
                <td style={{ padding: "16px 16px", fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: "14px", fontWeight: 500, color: "#0A0A0A", fontVariantNumeric: "tabular-nums" }}>
                  $180.00
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <span className="inline-flex items-center" style={{ padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 500, backgroundColor: "#D1FAE5", color: "#065F46" }}>
                    Entregue
                  </span>
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors" title="View">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#6B7280" strokeWidth="1.5">
                        <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/>
                        <circle cx="8" cy="8" r="2"/>
                      </svg>
                    </button>
                    <button className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors" title="Delete">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#6B7280" strokeWidth="1.5">
                        <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334z"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>

              {/* Linha 4 */}
              <tr className="transition-colors hover:bg-[#F9FAFB]">
                <td style={{ padding: "16px 24px" }}>
                  <input type="checkbox" className="rounded border-[#D1D5DB]" style={{ width: "16px", height: "16px" }} />
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <span style={{ fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: "14px", fontWeight: 500, color: "#0A0A0A", fontVariantNumeric: "tabular-nums" }}>
                    #801982
                  </span>
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <div className="flex items-center gap-3">
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600, color: "#6B7280", flexShrink: 0 }}>
                      C
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: 400, color: "#0A0A0A" }}>
                      Cody Fisher
                    </span>
                  </div>
                </td>
                <td style={{ padding: "16px 16px", fontSize: "14px", fontWeight: 400, color: "#6B7280" }}>
                  May 05, 2026
                </td>
                <td style={{ padding: "16px 16px", fontSize: "14px", fontWeight: 400, color: "#0A0A0A" }}>
                  Diamond Lotus Short Necklace
                </td>
                <td style={{ padding: "16px 16px", fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: "14px", fontWeight: 500, color: "#0A0A0A", fontVariantNumeric: "tabular-nums" }}>
                  $150.00
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <span className="inline-flex items-center" style={{ padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 500, backgroundColor: "#D1FAE5", color: "#065F46" }}>
                    Entregue
                  </span>
                </td>
                <td style={{ padding: "16px 16px" }}>
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors" title="View">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#6B7280" strokeWidth="1.5">
                        <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/>
                        <circle cx="8" cy="8" r="2"/>
                      </svg>
                    </button>
                    <button className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors" title="Delete">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#6B7280" strokeWidth="1.5">
                        <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334z"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
