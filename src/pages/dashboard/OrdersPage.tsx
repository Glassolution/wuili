import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package, ShoppingCart, TrendingUp, DollarSign, BarChart2, AlertCircle, LayoutGrid, List,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderCard, type OrderRow } from "@/components/dashboard/orders/OrderCard";

type TabFilter = "all" | "pending" | "paid" | "shipped" | "delivered" | "cancelled";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const MetricCard = ({
  icon: Icon, label, value, valueClass = "text-foreground",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClass?: string;
}) => (
  <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
      <Icon size={16} />
    </div>
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-xl font-black ${valueClass}`}>{value}</p>
    </div>
  </div>
);

const OrdersPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabFilter>("all");
  const [view, setView] = useState<"cards" | "list">("cards");

  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as OrderRow[];
    },
  });

  // Realtime: novos pedidos + notificação
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const o = payload.new as OrderRow;
          toast.success("🎉 Novo pedido recebido!", {
            description: `${o.buyer_name || "Cliente"} comprou ${o.product_title}`,
            duration: 6000,
          });
          queryClient.invalidateQueries({ queryKey: ["orders", user.id] });
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["orders", user.id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const all = orders ?? [];
  const totalOrders = all.length;
  const totalRevenue = all.reduce((s, o) => s + (o.sale_price ?? 0), 0);
  const totalProfit = all.reduce((s, o) => s + (o.profit ?? 0), 0);
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const filtered = tab === "all" ? all : all.filter((o) => o.status === tab);

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "pending", label: "Pendente" },
    { key: "paid", label: "Pago" },
    { key: "shipped", label: "Enviado" },
    { key: "delivered", label: "Entregue" },
    { key: "cancelled", label: "Cancelado" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Pedidos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe e envie seus pedidos pela CJ Dropshipping.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
          <button
            onClick={() => setView("cards")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              view === "cards" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid size={13} /> Cards
          </button>
          <button
            onClick={() => setView("list")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List size={13} /> Lista
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={ShoppingCart} label="Total de pedidos" value={String(totalOrders)} />
        <MetricCard icon={DollarSign} label="Receita total" value={formatBRL(totalRevenue)} />
        <MetricCard icon={TrendingUp} label="Lucro total" value={formatBRL(totalProfit)} valueClass="text-emerald-600" />
        <MetricCard icon={BarChart2} label="Ticket médio" value={formatBRL(avgTicket)} />
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {tabs.map((t) => {
          const count = t.key === "all" ? all.length : all.filter((o) => o.status === t.key).length;
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

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center rounded-xl border border-border bg-card">
          <AlertCircle size={32} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Erro ao carregar pedidos. Tente novamente.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3 rounded-xl border border-border bg-card">
          <Package size={40} className="text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">Nenhum pedido por aqui ainda</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Suas vendas aparecerão aqui automaticamente assim que chegarem.
          </p>
        </div>
      ) : (
        <div className={view === "cards" ? "grid gap-3" : "grid gap-2"}>
          {filtered.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
