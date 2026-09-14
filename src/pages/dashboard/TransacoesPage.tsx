import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronDown, ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Menu, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";

// ─── Types ────────────────────────────────────────────────────────────────────
type CategoryType = "frete_pago" | "frete_pendente" | "processando" | "enviado";

type Transaction = {
  id: string;
  date: string;
  pedido: string;
  produto: string;
  category: CategoryType;
  method: string;
  canal: string;
  amount: number;
  isPositive: boolean;
};

// ─── Map DB status → category ─────────────────────────────────────────────────
function mapCategory(status: string, fulfillmentStatus: string | null): CategoryType {
  const s = status.toLowerCase();
  const fs = (fulfillmentStatus ?? "").toLowerCase();
  if (fs === "shipped" || s === "shipped") return "enviado";
  if (s === "paid" || s === "approved" || s === "completed") return "frete_pago";
  if (s === "pending" || s === "in_process") return "processando";
  return "frete_pendente";
}

// ─── Format helpers ───────────────────────────────────────────────────────────
const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── Category Badge ───────────────────────────────────────────────────────────
const CategoryBadge = ({ category }: { category: CategoryType }) => {
  const config = {
    frete_pago:     { bg: "#ECFDF5", color: "#10B981", label: "Frete pago",     dot: "#10B981" },
    frete_pendente: { bg: "#FFF7ED", color: "#FB923C", label: "Frete pendente", dot: "#FB923C" },
    processando:    { bg: "#EFF6FF", color: "#3B82F6", label: "Processando",    dot: "#3B82F6" },
    enviado:        { bg: "#ECFDF5", color: "#10B981", label: "Enviado",        dot: "#10B981" },
  };
  const { bg, color, label, dot } = config[category];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: bg, color, fontSize: "13px", fontWeight: 500, letterSpacing: "-0.01em", padding: "5px 12px", borderRadius: "999px" }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: dot, flexShrink: 0 }} />
      {label}
    </span>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 10;

const TransacoesPage = () => {
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<"all" | CategoryType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // ── Fetch orders from Supabase ─────────────────────────────────────────────
  const { data: rawOrders, isLoading } = useQuery({
    queryKey: ["transacoes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, external_order_id, product_title, sale_price, cost_price, status, fulfillment_status, ordered_at, created_at, platform")
        .eq("user_id", user!.id)
        .order("ordered_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Map DB rows → Transaction type ────────────────────────────────────────
  const transactions: Transaction[] = (rawOrders ?? []).map((row, idx) => {
    const salePrice = Number(row.sale_price ?? 0);
    const costPrice = Number(row.cost_price ?? 0);
    const category = mapCategory(row.status ?? "pending", row.fulfillment_status ?? null);
    const isPositive = category === "frete_pago" || category === "enviado";
    return {
      id: row.id,
      date: formatDate(row.ordered_at ?? row.created_at),
      pedido: row.external_order_id ?? `VL-${String(idx + 1).padStart(5, "0")}`,
      produto: row.product_title ?? "Produto",
      category,
      method: "C7Drop",
      canal: row.platform ?? "Mercado Livre",
      amount: isPositive ? salePrice : costPrice,
      isPositive,
    };
  });

  // ── Summary metrics ────────────────────────────────────────────────────────
  const totalRevenue = (rawOrders ?? []).reduce((s, r) => s + Number(r.sale_price ?? 0), 0);
  const totalCosts   = (rawOrders ?? []).reduce((s, r) => s + Number(r.cost_price ?? 0), 0);
  const lucroEstimado = totalRevenue - totalCosts;
  const fretesPendentes = (rawOrders ?? [])
    .filter(r => mapCategory(r.status ?? "", r.fulfillment_status ?? null) === "frete_pendente")
    .reduce((s, r) => s + Number(r.cost_price ?? 0), 0);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = transactions.filter((t) => {
    const matchesSearch =
      t.pedido.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.produto.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === "all" || t.category === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', WebkitFontSmoothing: "antialiased", textRendering: "optimizeLegibility" }}>
      <DashboardPageHeader title="Transações" className="mb-0 md:mb-0" />

      {/* ── Summary Strip ────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "32px", backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.04)", borderRadius: "28px", padding: "24px 32px", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        {/* Saldo operacional */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", backgroundColor: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Menu size={20} strokeWidth={1.8} style={{ color: "#111111" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "15px", fontWeight: 400, letterSpacing: "-0.01em", color: "#737373", margin: 0, lineHeight: 1.4 }}>Receita total</p>
            {isLoading ? (
              <Skeleton className="h-7 w-28 mt-1" />
            ) : (
              <p style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.03em", color: "#111111", margin: 0, marginTop: "4px", lineHeight: 1.2 }}>
                {formatBRL(totalRevenue)}
              </p>
            )}
          </div>
        </div>

        {/* Fretes Pendentes */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", backgroundColor: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <TrendingDown size={20} strokeWidth={1.8} style={{ color: "#111111" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "15px", fontWeight: 400, letterSpacing: "-0.01em", color: "#737373", margin: 0, lineHeight: 1.4 }}>Fretes pendentes</p>
            {isLoading ? (
              <Skeleton className="h-7 w-28 mt-1" />
            ) : (
              <p style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.03em", color: "#111111", margin: 0, marginTop: "4px", lineHeight: 1.2 }}>
                {formatBRL(fretesPendentes)}
              </p>
            )}
          </div>
        </div>

        {/* Lucro Estimado */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", backgroundColor: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <TrendingUp size={20} strokeWidth={1.8} style={{ color: "#111111" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "15px", fontWeight: 400, letterSpacing: "-0.01em", color: "#737373", margin: 0, lineHeight: 1.4 }}>Lucro estimado</p>
            {isLoading ? (
              <Skeleton className="h-7 w-28 mt-1" />
            ) : (
              <p style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.03em", color: lucroEstimado >= 0 ? "#111111" : "#EF4444", margin: 0, marginTop: "4px", lineHeight: 1.2 }}>
                {formatBRL(lucroEstimado)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Table Container ─────────────────────────────────────────────── */}
      <div style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.04)", borderRadius: "28px", padding: "28px", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button style={{ display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 16px", fontSize: "14px", fontWeight: 500, letterSpacing: "-0.01em", color: "#111111", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "10px", cursor: "pointer" }}>
              Todas transações
              <ChevronDown size={14} strokeWidth={1.8} style={{ color: "#737373" }} />
            </button>
            <button style={{ display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 16px", fontSize: "14px", fontWeight: 500, letterSpacing: "-0.01em", color: "#111111", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "10px", cursor: "pointer" }}>
              Data
              <ChevronDown size={14} strokeWidth={1.8} style={{ color: "#737373" }} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} strokeWidth={1.8} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Buscar pedido ou produto..."
                style={{ height: "38px", paddingLeft: "34px", paddingRight: "12px", fontSize: "13px", color: "#111111", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "10px", outline: "none", width: "220px" }}
              />
            </div>
            <button style={{ display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 16px", fontSize: "14px", fontWeight: 500, letterSpacing: "-0.01em", color: "#111111", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "10px", cursor: "pointer" }}>
              Exportar
              <ChevronDown size={14} strokeWidth={1.8} style={{ color: "#737373" }} />
            </button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", textAlign: "center" }}>
            <Package size={40} strokeWidth={1.5} style={{ color: "#D1D5DB", marginBottom: "12px" }} />
            <p style={{ fontSize: "15px", fontWeight: 500, color: "#111111", margin: 0 }}>
              {transactions.length === 0 ? "Nenhuma transação encontrada" : "Nenhum resultado para essa busca"}
            </p>
            <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "6px 0 0 0" }}>
              {transactions.length === 0
                ? "Suas transações aparecerão aqui após receber pedidos."
                : "Tente ajustar os filtros ou a busca."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  {["Data", "Pedido / Produto", "Categoria", "Método / Canal", "Valor"].map((header) => (
                    <th key={header} style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: 500, letterSpacing: "-0.01em", color: "#9CA3AF" }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((transaction, index) => (
                  <tr
                    key={transaction.id}
                    style={{ borderBottom: index < paginated.length - 1 ? "1px solid #F9FAFB" : "none", transition: "background-color 0.12s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAFAFA")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <td style={{ padding: "18px 16px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 400, letterSpacing: "-0.01em", color: "#737373" }}>
                        {transaction.date}
                      </span>
                    </td>
                    <td style={{ padding: "18px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600, color: "#111111", flexShrink: 0 }}>
                          {transaction.pedido.slice(-2)}
                        </div>
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: 500, letterSpacing: "-0.01em", color: "#111111", margin: 0 }}>
                            {transaction.pedido} · {transaction.produto}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "18px 16px" }}>
                      <CategoryBadge category={transaction.category} />
                    </td>
                    <td style={{ padding: "18px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#111111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 600, color: "#FFFFFF", flexShrink: 0 }}>
                          C7
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: 400, letterSpacing: "-0.01em", color: "#111111" }}>
                          {transaction.method}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "18px 16px", textAlign: "right" }}>
                      <span style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.02em", color: transaction.isPositive ? "#10B981" : "#111111" }}>
                        {transaction.isPositive ? "+" : "−"} {formatBRL(transaction.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer / Pagination */}
        {!isLoading && filtered.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #F3F4F6" }}>
            <p style={{ fontSize: "13px", fontWeight: 400, letterSpacing: "-0.01em", color: "#737373", margin: 0 }}>
              {filtered.length} transações
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <p style={{ fontSize: "13px", fontWeight: 400, letterSpacing: "-0.01em", color: "#737373", margin: 0 }}>
                Mostrando {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "8px", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={14} strokeWidth={1.8} style={{ color: "#737373" }} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "8px", cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1 }}
                >
                  <ChevronRight size={14} strokeWidth={1.8} style={{ color: "#737373" }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransacoesPage;
