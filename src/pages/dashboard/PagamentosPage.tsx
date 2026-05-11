import { useQuery } from "@tanstack/react-query";
import { ExternalLink, TrendingUp, Clock, Package, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────
type PaymentStatus = "paid_cj" | "pending";
type CJStatus = "processing" | "shipped" | "awaiting_balance";

type OrderRow = {
  id: string;
  pedido: string;
  produto: string;
  frete: number;
  paymentStatus: PaymentStatus;
  cjStatus: CJStatus;
  date: string;
};

// ─── Map DB status → display status ──────────────────────────────────────────
function mapPaymentStatus(status: string): PaymentStatus {
  const s = status.toLowerCase();
  if (s === "paid" || s === "approved" || s === "completed") return "paid_cj";
  return "pending";
}

function mapCJStatus(status: string, fulfillmentStatus: string | null): CJStatus {
  const fs = (fulfillmentStatus ?? "").toLowerCase();
  if (fs === "shipped") return "shipped";
  const s = status.toLowerCase();
  if (s === "paid" || s === "approved" || s === "in_process") return "processing";
  return "awaiting_balance";
}

// ─── Format helpers ───────────────────────────────────────────────────────────
const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// ─── Badges ───────────────────────────────────────────────────────────────────
const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => {
  const config = {
    paid_cj: { bg: "#ECFDF5", color: "#10B981", label: "Pago na CJ" },
    pending:  { bg: "#FFF7ED", color: "#FB923C", label: "Pendente"   },
  };
  const { bg, color, label } = config[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", backgroundColor: bg, color, fontSize: "13px", fontWeight: 500, letterSpacing: "-0.01em", padding: "4px 12px", borderRadius: "999px" }}>
      {label}
    </span>
  );
};

const CJStatusBadge = ({ status }: { status: CJStatus }) => {
  const config = {
    processing:      { bg: "#EFF6FF", color: "#3B82F6", label: "Processando"      },
    shipped:         { bg: "#ECFDF5", color: "#10B981", label: "Enviado"           },
    awaiting_balance:{ bg: "#FEF2F2", color: "#EF4444", label: "Aguardando saldo" },
  };
  const { bg, color, label } = config[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", backgroundColor: bg, color, fontSize: "13px", fontWeight: 500, letterSpacing: "-0.01em", padding: "4px 12px", borderRadius: "999px" }}>
      {label}
    </span>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const PagamentosPage = () => {
  const { user } = useAuth();

  const { data: rawOrders, isLoading } = useQuery({
    queryKey: ["pagamentos-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, external_order_id, product_title, cost_price, status, fulfillment_status, ordered_at, created_at")
        .eq("user_id", user!.id)
        .order("ordered_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Map DB rows → display rows
  const orders: OrderRow[] = (rawOrders ?? []).map((row, idx) => ({
    id: row.id,
    pedido: row.external_order_id ?? `VL-${String(idx + 1).padStart(5, "0")}`,
    produto: row.product_title ?? "Produto",
    frete: Number(row.cost_price ?? 0),
    paymentStatus: mapPaymentStatus(row.status ?? "pending"),
    cjStatus: mapCJStatus(row.status ?? "pending", row.fulfillment_status ?? null),
    date: formatDate(row.ordered_at ?? row.created_at),
  }));

  // Summary metrics
  const fretesPendentes = orders.filter(o => o.paymentStatus === "pending").reduce((s, o) => s + o.frete, 0);
  const pedidosAguardando = orders.filter(o => o.cjStatus === "awaiting_balance").length;
  const totalGastoMes = orders.reduce((s, o) => s + o.frete, 0);

  const handleOpenCJ = () => {
    window.open("https://cjdropshipping.com", "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px", fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', WebkitFontSmoothing: "antialiased", textRendering: "optimizeLegibility" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: 600, letterSpacing: "-0.04em", color: "#111111", margin: 0, lineHeight: 1.2 }}>
          Saldo CJ Dropshipping
        </h1>
        <p style={{ fontSize: "14px", fontWeight: 400, letterSpacing: "-0.01em", color: "#737373", marginTop: "6px" }}>
          Gerencie pedidos e acompanhe os pagamentos realizados diretamente na CJ Dropshipping.
        </p>
      </div>

      {/* ── Summary Card ────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.04)", borderRadius: "24px", padding: "28px", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>

        {/* Saldo atual CJ — não disponível via API, exibe placeholder */}
        <div>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", backgroundColor: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
            <DollarSign size={20} strokeWidth={1.8} style={{ color: "#111111" }} />
          </div>
          <p style={{ fontSize: "13px", fontWeight: 400, letterSpacing: "-0.01em", color: "#737373", margin: 0 }}>Saldo atual CJ</p>
          <p style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "-0.03em", color: "#111111", margin: 0, marginTop: "6px" }}>
            Ver na CJ
          </p>
        </div>

        {/* Fretes pendentes */}
        <div>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", backgroundColor: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
            <Clock size={20} strokeWidth={1.8} style={{ color: "#FB923C" }} />
          </div>
          <p style={{ fontSize: "13px", fontWeight: 400, letterSpacing: "-0.01em", color: "#737373", margin: 0 }}>Fretes pendentes</p>
          {isLoading ? (
            <Skeleton className="h-8 w-24 mt-1.5" />
          ) : (
            <p style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "-0.03em", color: "#FB923C", margin: 0, marginTop: "6px" }}>
              {formatBRL(fretesPendentes)}
            </p>
          )}
        </div>

        {/* Pedidos aguardando */}
        <div>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", backgroundColor: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
            <Package size={20} strokeWidth={1.8} style={{ color: "#EF4444" }} />
          </div>
          <p style={{ fontSize: "13px", fontWeight: 400, letterSpacing: "-0.01em", color: "#737373", margin: 0 }}>Pedidos aguardando envio</p>
          {isLoading ? (
            <Skeleton className="h-8 w-16 mt-1.5" />
          ) : (
            <p style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "-0.03em", color: "#EF4444", margin: 0, marginTop: "6px" }}>
              {pedidosAguardando}
            </p>
          )}
        </div>

        {/* Total gasto */}
        <div>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", backgroundColor: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
            <TrendingUp size={20} strokeWidth={1.8} style={{ color: "#3B82F6" }} />
          </div>
          <p style={{ fontSize: "13px", fontWeight: 400, letterSpacing: "-0.01em", color: "#737373", margin: 0 }}>Total gasto este mês</p>
          {isLoading ? (
            <Skeleton className="h-8 w-24 mt-1.5" />
          ) : (
            <p style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "-0.03em", color: "#3B82F6", margin: 0, marginTop: "6px" }}>
              {formatBRL(totalGastoMes)}
            </p>
          )}
        </div>
      </div>

      {/* ── CJ Dropshipping Button ──────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "32px", backgroundColor: "#FAFAFA", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "20px" }}>
        <button
          onClick={handleOpenCJ}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", height: "48px", padding: "0 32px", fontSize: "15px", fontWeight: 600, letterSpacing: "-0.02em", color: "#FFFFFF", backgroundColor: "#111111", border: "none", borderRadius: "12px", cursor: "pointer", transition: "background-color 0.15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#000000")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#111111")}
        >
          Abrir CJ Dropshipping
          <ExternalLink size={16} strokeWidth={2} />
        </button>
        <p style={{ fontSize: "13px", fontWeight: 400, letterSpacing: "-0.01em", color: "#737373", margin: 0, textAlign: "center", maxWidth: "600px" }}>
          Os pagamentos e recargas são realizados diretamente na plataforma da CJ Dropshipping.
        </p>
      </div>

      {/* ── Orders Table ────────────────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.03em", color: "#111111", margin: 0, marginBottom: "16px" }}>
          Controle de pedidos
        </h2>

        <div style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "16px", overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : orders.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <Package size={40} strokeWidth={1.5} style={{ color: "#D1D5DB", margin: "0 auto 12px" }} />
              <p style={{ fontSize: "15px", fontWeight: 500, color: "#111111", margin: 0 }}>Nenhum pedido encontrado</p>
              <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "6px 0 0 0" }}>
                Seus pedidos aparecerão aqui após a sincronização com o Mercado Livre.
              </p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#FAFAFA", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  {["Pedido", "Produto", "Frete", "Status do pagamento", "Status CJ", "Data"].map((header) => (
                    <th key={header} style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: 600, letterSpacing: "-0.01em", color: "#737373", textTransform: "uppercase" }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => (
                  <tr
                    key={order.id}
                    style={{ borderBottom: index < orders.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none", transition: "background-color 0.12s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAFAFA")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "-0.01em", color: "#111111" }}>{order.pedido}</span>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 400, letterSpacing: "-0.01em", color: "#111111" }}>{order.produto}</span>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 500, letterSpacing: "-0.01em", color: "#111111" }}>{formatBRL(order.frete)}</span>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <CJStatusBadge status={order.cjStatus} />
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 400, letterSpacing: "-0.01em", color: "#737373" }}>{order.date}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default PagamentosPage;
