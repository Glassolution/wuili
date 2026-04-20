import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, ShoppingCart, TrendingUp, DollarSign, BarChart2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────
type Order = {
  id: string;
  user_id: string;
  external_order_id: string | null;
  platform: string;
  product_title: string;
  product_image: string | null;
  buyer_name: string | null;
  sale_price: number;
  cost_price: number | null;
  profit: number | null;
  status: string;
  tracking_code: string | null;
  ordered_at: string | null;
  created_at: string;
};

type TabFilter = "all" | "pending" | "paid" | "shipped" | "delivered" | "cancelled";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const STATUS_LABEL: Record<string, string> = {
  pending:   "Pendente",
  paid:      "Pago",
  shipped:   "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-yellow-50  text-yellow-700  border border-yellow-200",
  paid:      "bg-blue-50    text-blue-700    border border-blue-200",
  shipped:   "bg-muted      text-foreground   border border-border",
  delivered: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelled: "bg-red-50     text-red-600     border border-red-200",
};

const PLATFORM_STYLE: Record<string, string> = {
  mercadolivre: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  shopee:       "bg-orange-50 text-orange-700 border border-orange-200",
};

const PLATFORM_LABEL: Record<string, string> = {
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
};

// ─── Metric card ──────────────────────────────────────────────────────────────
const MetricCard = ({
  icon: Icon, label, value, valueClass = "text-foreground",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClass?: string;
}) => (
  <div className="card-wuili p-5 flex items-start gap-4">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
      <Icon size={16} />
    </div>
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-xl font-black ${valueClass}`}>{value}</p>
    </div>
  </div>
);

// ─── Skeleton row ─────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr className="border-b border-border">
    {[56, 100, 80, 70, 70, 70, 80, 80].map((w, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton style={{ width: w, height: 14 }} className="rounded" />
      </td>
    ))}
  </tr>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const OrdersPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabFilter>("all");

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select("*")
        .eq("user_id", user!.id)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  const all = orders ?? [];

  // ── Metrics ────────────────────────────────────────────────────────────────
  const totalOrders  = all.length;
  const totalRevenue = all.reduce((s, o) => s + (o.sale_price ?? 0), 0);
  const totalProfit  = all.reduce((s, o) => s + (o.profit ?? 0), 0);
  const avgTicket    = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = tab === "all" ? all : all.filter(o => o.status === tab);

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all",       label: "Todos" },
    { key: "pending",   label: "Pendente" },
    { key: "paid",      label: "Pago" },
    { key: "shipped",   label: "Enviado" },
    { key: "delivered", label: "Entregue" },
    { key: "cancelled", label: "Cancelado" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Pedidos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe os pedidos recebidos nas plataformas conectadas.
        </p>
      </div>

      {/* ── Metric cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={ShoppingCart} label="Total de pedidos" value={String(totalOrders)} />
        <MetricCard icon={DollarSign}   label="Receita total"    value={formatBRL(totalRevenue)} />
        <MetricCard icon={TrendingUp}   label="Lucro total"      value={formatBRL(totalProfit)} valueClass="text-emerald-600" />
        <MetricCard icon={BarChart2}    label="Ticket médio"     value={formatBRL(avgTicket)} />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {tabs.map(t => {
          const count = t.key === "all" ? all.length : all.filter(o => o.status === t.key).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                "whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors relative shrink-0",
                tab === t.key
                  ? "text-foreground after:absolute after:bottom-0 after:inset-x-0 after:h-[2px] after:bg-foreground"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t.label}
              {count > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {["Produto", "Comprador", "Plataforma", "Valor", "Lucro", "Status", "Rastreio", "Data"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              : isError
              ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                      <AlertCircle size={32} className="text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Erro ao carregar pedidos. Tente novamente.</p>
                    </div>
                  </td>
                </tr>
              )
              : filtered.length === 0
              ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                      <Package size={40} className="text-muted-foreground/30" />
                      <p className="text-sm font-medium text-foreground">Nenhum pedido ainda</p>
                      <p className="text-xs text-muted-foreground max-w-xs">
                        Suas vendas aparecerão aqui automaticamente.
                      </p>
                    </div>
                  </td>
                </tr>
              )
              : filtered.map(order => {
                const status = order.status || "pending";
                const platform = order.platform || "mercadolivre";

                return (
                  <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    {/* Produto */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-muted/60 shrink-0 overflow-hidden flex items-center justify-center">
                          {order.product_image
                            ? <img src={order.product_image} alt={order.product_title} className="w-full h-full object-cover" loading="lazy" />
                            : <Package size={14} className="text-muted-foreground/40" />
                          }
                        </div>
                        <p className="text-xs font-medium text-foreground line-clamp-2 max-w-[180px]">
                          {order.product_title}
                        </p>
                      </div>
                    </td>

                    {/* Comprador */}
                    <td className="px-4 py-3">
                      <p className="text-xs text-foreground">{order.buyer_name || "—"}</p>
                    </td>

                    {/* Plataforma */}
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PLATFORM_STYLE[platform] ?? PLATFORM_STYLE.mercadolivre}`}>
                        {PLATFORM_LABEL[platform] ?? platform}
                      </span>
                    </td>

                    {/* Valor */}
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-foreground">{formatBRL(order.sale_price)}</p>
                    </td>

                    {/* Lucro */}
                    <td className="px-4 py-3">
                      {order.profit != null
                        ? <p className={`text-xs font-semibold ${order.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {formatBRL(order.profit)}
                          </p>
                        : <p className="text-xs text-muted-foreground">—</p>
                      }
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status] ?? STATUS_STYLE.pending}`}>
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    </td>

                    {/* Rastreio */}
                    <td className="px-4 py-3">
                      {order.tracking_code
                        ? <span className="font-mono text-[11px] bg-muted rounded px-1.5 py-0.5 text-foreground">
                            {order.tracking_code}
                          </span>
                        : <p className="text-xs text-muted-foreground">—</p>
                      }
                    </td>

                    {/* Data */}
                    <td className="px-4 py-3">
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(order.ordered_at)}
                      </p>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrdersPage;
