import { useState } from "react";
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

// ── Sales Calendar Component ──────────────────────────────────────────────────
const SalesCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Mock sales data
  const salesData: Record<number, number> = {
    6: 89.90,
    12: 189.90,
    21: 342.00,
  };

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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardHomePage() {
  const { user } = useAuth();
  const { orders, summary, isLoading: isLoadingFinancial } = useFinancialData();

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
      const totalPubs   = pubsRes.count   ?? 0;
      const revenue     = ((revenueRes.data ?? []) as { sale_price: number }[])
        .reduce((s, o) => s + (o.sale_price ?? 0), 0);
      return { totalOrders, totalPubs, revenue };
    },
  });

  const totalRevenue    = statsData?.revenue     ?? 0;
  const totalOrders     = statsData?.totalOrders ?? 0;
  const totalPubs       = statsData?.totalPubs   ?? 0;

  // ── Mock data ──────────────────────────────────────────────────────────────
  const recentActivity = [
    { id: 1, text: "Novo pedido recebido",    sub: "Pedido #4821 — R$ 189,90",  time: "2 min atrás"  },
    { id: 2, text: "Produto publicado",        sub: "Camiseta Uniqlo Airism",    time: "18 min atrás" },
    { id: 3, text: "Pagamento aprovado",       sub: "Pedido #4819 — R$ 342,00",  time: "1 h atrás"    },
    { id: 4, text: "Cliente atualizado",       sub: "Dados de entrega alterados", time: "3 h atrás"   },
  ];

  const mockOrders = [
    { id: "#4821", client: "Ana Souza",      status: "Aprovado"  as const, updated: "2 min atrás"  },
    { id: "#4820", client: "Carlos Lima",    status: "Pendente"  as const, updated: "15 min atrás" },
    { id: "#4819", client: "Beatriz Costa",  status: "Aprovado"  as const, updated: "1 h atrás"    },
    { id: "#4818", client: "Diego Martins",  status: "Cancelado" as const, updated: "2 h atrás"    },
    { id: "#4817", client: "Fernanda Alves", status: "Pendente"  as const, updated: "4 h atrás"    },
  ];

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

  const PERIODS = ["Hoje", "Esse mês", "Últimos 30 dias", "Últimos 90 dias", "Todo o período", "Personalizado"] as const;
  type Period = typeof PERIODS[number];
  const [activePeriod, setActivePeriod] = useState<Period>("Esse mês");

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
            <span style={{ backgroundColor: "#EAF8EC", color: "#168A3A", borderRadius: "5px", padding: "2px 5px", fontSize: "11px", fontWeight: 600, flexShrink: 0 }}>12%</span>
            <span style={{ 
              fontSize: "12px", 
              fontWeight: 400, 
              color: "rgba(255,255,255,0.82)", 
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0
            }}>Aumentou vs mês anterior</span>
          </div>
          {/* Icon */}
          <div style={{ position: "absolute", top: "16px", right: "16px", width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={18} strokeWidth={1.75} style={{ color: "#FFFFFF" }} />
          </div>
        </div>

        {/* Cards 2–4 — white */}
        {[
          { label: "Total de Pedidos", value: loadingStats ? "—" : fmtNum(totalOrders), pct: "+3.5%", icon: <ShoppingCart size={18} strokeWidth={1.75} style={{ color: "#6B7280" }} />, sub: "vs mês anterior" },
          { label: "Produtos Ativos",  value: loadingStats ? "—" : fmtNum(totalPubs),   pct: "+1.5%", icon: <Package      size={18} strokeWidth={1.75} style={{ color: "#6B7280" }} />, sub: "vs mês anterior" },
          { label: "Clientes",         value: fmtCompact(1284),                          pct: "+4%",   icon: <Users        size={18} strokeWidth={1.75} style={{ color: "#6B7280" }} />, sub: "vs mês anterior" },
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
              <span style={{ backgroundColor: "#EAF8EC", color: "#168A3A", borderRadius: "5px", padding: "2px 5px", fontSize: "11px", fontWeight: 600, flexShrink: 0 }}>{m.pct}</span>
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
        <SalesCalendar />
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
              {mockOrders.map((o) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
