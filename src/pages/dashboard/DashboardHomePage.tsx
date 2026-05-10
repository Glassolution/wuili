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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFinancialData } from "@/hooks/useFinancialData";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtNum = (v: number) =>
  new Intl.NumberFormat("pt-BR").format(v);

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
      fontSize: "12px", fontWeight: 600,
      padding: "3px 10px", borderRadius: "999px"
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

  const alerts = [
    { id: 1, tag: "URGENTE", tagColor: "#DC2626", tagBg: "#FEF2F2", title: "Pedidos pendentes",       desc: "12 pedidos aguardando aprovação" },
    { id: 2, tag: "ATENÇÃO", tagColor: "#D97706", tagBg: "#FFFBEB", title: "Produtos sem estoque",    desc: "5 produtos com estoque zerado"   },
    { id: 3, tag: "ATENÇÃO", tagColor: "#D97706", tagBg: "#FFFBEB", title: "Pagamentos em análise",   desc: "3 pagamentos em revisão"         },
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
    borderRadius: "24px",
    padding: "24px",
    border: "1px solid #EBEBEB",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  };

  return (
    <div style={{
      padding: "28px",
      backgroundColor: "#FFFFFF",
      minHeight: "100vh",
      fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif',
      WebkitFontSmoothing: "antialiased",
      display: "flex",
      flexDirection: "column",
      gap: "20px",
    }}>

      {/* ── 2. Metric cards ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px", width: "100%" }}>

        {/* Card 1 — dark / Receita Total */}
        <div style={{
          background: "radial-gradient(circle at 85% 15%, rgba(255,255,255,0.14), transparent 28%), linear-gradient(135deg, #080808 0%, #141414 55%, #202020 100%)",
          borderRadius: "22px",
          padding: "22px 24px",
          height: "170px",
          border: "1px solid rgba(255,255,255,0.08)",
          position: "relative",
          overflow: "hidden",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}>
          <div>
            <span style={{ fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.02em", color: "rgba(255,255,255,0.82)" }}>
              Receita Total
            </span>
            <div style={{ fontSize: "44px", lineHeight: 1, fontWeight: 400, letterSpacing: "-0.06em", color: "#FFFFFF", marginTop: "24px" }}>
              {loadingStats ? "—" : fmt(totalRevenue)}
            </div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "28px", padding: "0 12px", borderRadius: "999px", backgroundColor: "rgba(255,255,255,0.12)", alignSelf: "flex-start", marginTop: "18px" }}>
            <span style={{ backgroundColor: "#EAF8EC", color: "#168A3A", borderRadius: "6px", padding: "2px 6px", fontSize: "12px", fontWeight: 600 }}>12%</span>
            <span style={{ fontSize: "13px", fontWeight: 400, color: "rgba(255,255,255,0.82)", whiteSpace: "nowrap" }}>Aumentou vs mês anterior</span>
          </div>
          {/* Icon */}
          <div style={{ position: "absolute", top: "20px", right: "20px", width: "44px", height: "44px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={20} strokeWidth={1.75} style={{ color: "#FFFFFF" }} />
          </div>
        </div>

        {/* Cards 2–4 — white */}
        {[
          { label: "Total de Pedidos", value: loadingStats ? "—" : fmtNum(totalOrders), pct: "+3.5%", icon: <ShoppingCart size={20} strokeWidth={1.75} style={{ color: "#6B7280" }} />, sub: "vs mês anterior" },
          { label: "Produtos Ativos",  value: loadingStats ? "—" : fmtNum(totalPubs),   pct: "+1.5%", icon: <Package      size={20} strokeWidth={1.75} style={{ color: "#6B7280" }} />, sub: "vs mês anterior" },
          { label: "Clientes",         value: "1.284",                                   pct: "+4%",   icon: <Users        size={20} strokeWidth={1.75} style={{ color: "#6B7280" }} />, sub: "vs mês anterior" },
        ].map((m) => (
          <div key={m.label} style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "22px",
            padding: "22px 24px",
            height: "170px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
            position: "relative",
            overflow: "hidden",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}>
            <div>
              <span style={{ fontSize: "18px", lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.02em", color: "#111111" }}>
                {m.label}
              </span>
              <div style={{ fontSize: "44px", lineHeight: 1, fontWeight: 400, letterSpacing: "-0.06em", color: "#111827", marginTop: "28px" }}>
                {m.value}
              </div>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "18px" }}>
              <span style={{ backgroundColor: "#EAF8EC", color: "#168A3A", borderRadius: "6px", padding: "2px 6px", fontSize: "12px", fontWeight: 600 }}>{m.pct}</span>
              <span style={{ fontSize: "13px", color: "#9CA3AF", whiteSpace: "nowrap" }}>{m.sub}</span>
            </div>
            {/* Icon */}
            <div style={{ position: "absolute", top: "20px", right: "20px", width: "44px", height: "44px", borderRadius: "50%", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {m.icon}
            </div>
          </div>
        ))}
      </div>

      {/* ── 3. Activity + Alerts ───────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* Recent Activity */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Atividade recente</h2>
            <button style={{ fontSize: "13px", fontWeight: 600, color: "#6B7280", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "8px" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F5F5F5")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              Ver tudo
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {recentActivity.map((item, i) => (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 0",
                borderBottom: i < recentActivity.length - 1 ? "1px solid #F3F4F6" : "none"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <CheckCircle size={18} strokeWidth={1.5} style={{ color: "#0A0A0A" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#0A0A0A", marginBottom: "2px" }}>{item.text}</div>
                    <div style={{ fontSize: "12px", color: "#9CA3AF" }}>{item.sub}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "12px", color: "#9CA3AF", whiteSpace: "nowrap" }}>{item.time}</span>
                  <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "6px", display: "flex" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F5F5F5")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <MoreVertical size={16} style={{ color: "#9CA3AF" }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Alerts */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Alertas</h2>
            <button style={{ fontSize: "13px", fontWeight: 600, color: "#6B7280", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "8px" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F5F5F5")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              Ver tudo
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {alerts.map((a) => (
              <div key={a.id} style={{
                backgroundColor: "#FAFAFA", borderRadius: "16px", padding: "16px",
                border: "1px solid #F0F0F0",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px"
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: a.tagColor, backgroundColor: a.tagBg, padding: "2px 8px", borderRadius: "999px", display: "inline-block", marginBottom: "6px" }}>
                    {a.tag}
                  </span>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#0A0A0A", marginBottom: "3px" }}>{a.title}</div>
                  <div style={{ fontSize: "12px", color: "#9CA3AF" }}>{a.desc}</div>
                </div>
                <button style={{
                  flexShrink: 0, backgroundColor: "#0A0A0A", color: "#FFFFFF",
                  fontSize: "12px", fontWeight: 600, padding: "8px 14px",
                  borderRadius: "10px", border: "none", cursor: "pointer", whiteSpace: "nowrap",
                  transition: "opacity 0.15s"
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  Resolver
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4. Orders table ────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Gerenciamento de pedidos</h2>
          <button style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            fontSize: "13px", fontWeight: 600, color: "#6B7280",
            backgroundColor: "#F5F5F5", border: "none", cursor: "pointer",
            padding: "8px 14px", borderRadius: "10px", transition: "background-color 0.15s"
          }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#EBEBEB")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F5F5F5")}
          >
            Ver todos os pedidos
            <ArrowUpRight size={14} />
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                {["Pedido", "Cliente", "Status", "Última atualização", "Ação"].map((h) => (
                  <th key={h} style={{
                    padding: "10px 12px", textAlign: "left",
                    fontSize: "11px", fontWeight: 600, color: "#9CA3AF",
                    textTransform: "uppercase", letterSpacing: "0.06em"
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
                  <td style={{ padding: "16px 12px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#0A0A0A" }}>{o.id}</span>
                  </td>
                  <td style={{ padding: "16px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "#0A0A0A", flexShrink: 0 }}>
                        {o.client.charAt(0)}
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: 500, color: "#0A0A0A" }}>{o.client}</span>
                    </div>
                  </td>
                  <td style={{ padding: "16px 12px" }}>
                    <StatusBadge status={o.status} />
                  </td>
                  <td style={{ padding: "16px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Clock size={13} style={{ color: "#9CA3AF" }} />
                      <span style={{ fontSize: "13px", color: "#6B7280" }}>{o.updated}</span>
                    </div>
                  </td>
                  <td style={{ padding: "16px 12px" }}>
                    <button style={{
                      fontSize: "12px", fontWeight: 600, color: "#0A0A0A",
                      backgroundColor: "#F5F5F5", border: "1px solid #EBEBEB",
                      padding: "6px 14px", borderRadius: "8px", cursor: "pointer",
                      transition: "background-color 0.12s"
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#EBEBEB")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F5F5F5")}
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
