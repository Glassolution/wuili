import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Order {
  id: string;
  user_id: string;
  external_order_id: string | null;
  platform: string | null;
  product_title: string | null;
  buyer_name: string | null;
  sale_price: number;
  cost_price: number | null;
  profit: number | null;
  status: string;
  ordered_at: string | null;
  created_at: string;
  supplier: string | null;
}

interface Transacao {
  id: string;
  descricao: string;
  canal: string;
  tipo: "entrada" | "saida";
  valor: string;
  status: "conciliado" | "pendente" | "ajuste";
  data: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PLATFORM_LABELS: Record<string, string> = {
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
  magalu: "Magalu",
  aliexpress: "AliExpress",
};

const statusCls: Record<string, string> = {
  conciliado: "bg-success-light text-success",
  pendente: "bg-warning/10 text-warning",
  ajuste: "bg-destructive/10 text-destructive",
};
const statusLabel: Record<string, string> = {
  conciliado: "Conciliado",
  pendente: "Pendente",
  ajuste: "Ajuste",
};

const filters = ["Todas", "Entradas", "Saídas", "Pendentes"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr: string | null): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function deriveTransactions(orders: Order[]): Transacao[] {
  const txs: Transacao[] = [];
  let idx = 0;

  for (const order of orders) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped orders table
    const platformLabel = PLATFORM_LABELS[(order.platform ?? "").toLowerCase()] ?? order.platform ?? "Plataforma";
    const ref = order.external_order_id ?? order.id.slice(0, 8).toUpperCase();
    const txStatus: "conciliado" | "pendente" =
      order.status === "delivered" || order.status === "paid" ? "conciliado" : "pendente";
    const dateStr = formatDate(order.ordered_at ?? order.created_at);

    // Entrada
    idx += 1;
    txs.push({
      id: `TX-${String(idx).padStart(4, "0")}`,
      descricao: `Pagamento ${platformLabel} - ${ref}`,
      canal: platformLabel,
      tipo: "entrada",
      valor: order.sale_price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      status: txStatus,
      data: dateStr,
    });

    // Saída (only when cost_price > 0)
    if (order.cost_price != null && order.cost_price > 0) {
      idx += 1;
      txs.push({
        id: `TX-${String(idx).padStart(4, "0")}`,
        descricao: `Custo fornecedor - ${ref}`,
        canal: order.supplier ?? "Fornecedor",
        tipo: "saida",
        valor: order.cost_price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        status: txStatus,
        data: dateStr,
      });
    }
  }

  return txs;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const TransacoesPage = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todas");

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["orders-transacoes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from("orders" as any) as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  const transacoes = useMemo(() => deriveTransactions(orders), [orders]);

  const totalEntradas = useMemo(
    () => orders.reduce((sum, o) => sum + (o.sale_price ?? 0), 0),
    [orders]
  );

  const totalSaidas = useMemo(
    () => orders.reduce((sum, o) => sum + (o.cost_price ?? 0), 0),
    [orders]
  );

  const conciliacao = useMemo(() => {
    if (transacoes.length === 0) return 0;
    return Math.round(
      (transacoes.filter((t) => t.status === "conciliado").length / transacoes.length) * 100
    );
  }, [transacoes]);

  const filtered = useMemo(
    () =>
      transacoes.filter((t) => {
        const matchSearch =
          t.descricao.toLowerCase().includes(search.toLowerCase()) ||
          t.id.toLowerCase().includes(search.toLowerCase());
        const matchFilter =
          filter === "Todas" ||
          (filter === "Entradas" && t.tipo === "entrada") ||
          (filter === "Saídas" && t.tipo === "saida") ||
          (filter === "Pendentes" && t.status === "pendente");
        return matchSearch && matchFilter;
      }),
    [transacoes, search, filter]
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="card-wuili flex flex-col gap-4 p-4 dark:border-zinc-800 dark:bg-[#18181B] dark:shadow-none sm:p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <h2 className="text-[22px] font-black text-foreground md:text-2xl">Transações</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
            Histórico completo de entradas, saídas e conciliação financeira.
          </p>
        </div>
        <button className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-black dark:hover:bg-zinc-100">
          <Download size={15} /> Exportar extrato
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-3 md:gap-4">
        <div className="card-wuili p-4 dark:border-zinc-800 dark:bg-[#18181B] dark:shadow-none sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 sm:text-xs sm:tracking-[0.16em]">
              Entradas
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-success-light text-success">
              <ArrowDownLeft size={15} />
            </div>
          </div>
          {isLoading ? (
            <div className="animate-pulse h-6 w-24 bg-muted rounded" />
          ) : (
            <p className="text-[22px] font-black leading-none text-foreground sm:text-2xl">
              R${" "}
              {totalEntradas.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Últimos 30 dias</p>
        </div>

        <div className="card-wuili p-4 dark:border-zinc-800 dark:bg-[#18181B] dark:shadow-none sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 sm:text-xs sm:tracking-[0.16em]">
              Saídas
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <ArrowUpRight size={15} />
            </div>
          </div>
          {isLoading ? (
            <div className="animate-pulse h-6 w-24 bg-muted rounded" />
          ) : (
            <p className="text-[22px] font-black leading-none text-foreground sm:text-2xl">
              R${" "}
              {totalSaidas.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Taxas, frete e custos operacionais
          </p>
        </div>

        <div className="card-wuili p-4 dark:border-zinc-800 dark:bg-[#18181B] dark:shadow-none sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 sm:text-xs sm:tracking-[0.16em]">
              Conciliação
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <Search size={15} />
            </div>
          </div>
          {isLoading ? (
            <div className="animate-pulse h-6 w-24 bg-muted rounded" />
          ) : (
            <p className="text-[22px] font-black leading-none text-foreground sm:text-2xl">{conciliacao}%</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Operações validadas automaticamente
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="min-h-11 w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/10 dark:focus:ring-white/10"
            placeholder="Buscar por descrição ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-1 shadow-sm sm:inline-flex sm:w-fit">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`min-h-10 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-all whitespace-nowrap sm:min-h-9 sm:px-3 sm:text-xs ${
                filter === f
                  ? "bg-white text-[#0A0A0A] shadow-sm"
                  : "bg-transparent text-white hover:bg-white/5"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2.5 md:hidden">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card dark:border-zinc-800 dark:bg-[#18181B]" />
            ))
          : filtered.length === 0
          ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground dark:border-zinc-800 dark:bg-[#18181B]">
              Nenhuma transação encontrada.
            </div>
          )
          : filtered.map((t) => {
            const isEntrada = t.tipo === "entrada";

            return (
              <article key={t.id} className="rounded-2xl border border-border bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-[#18181B]">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isEntrada ? "bg-success-light text-success" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {isEntrada ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-foreground">
                          {t.descricao}
                        </p>
                        <p className="mt-1 text-[11.5px] font-medium text-muted-foreground">
                          {t.id} · {t.canal}
                        </p>
                      </div>
                      <p className={`shrink-0 text-right text-[14px] font-black ${isEntrada ? "text-success" : "text-destructive"}`}>
                        {isEntrada ? "+" : "-"}R${t.valor}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusCls[t.status]}`}>
                        {statusLabel[t.status]}
                      </span>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                        {isEntrada ? "Entrada" : "Saída"}
                      </span>
                      <span className="ml-auto text-[11.5px] font-medium text-muted-foreground">
                        {t.data}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        }
      </div>

      {/* Table */}
      <div className="card-wuili hidden overflow-hidden dark:border-zinc-800 dark:bg-[#18181B] dark:shadow-none md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["ID", "Descrição", "Canal", "Tipo", "Valor", "Status", "Data"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="animate-pulse h-4 bg-muted rounded w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                : filtered.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground font-medium">
                        {t.id}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{t.descricao}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.canal}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`flex items-center gap-1 w-fit text-xs font-semibold ${
                            t.tipo === "entrada" ? "text-success" : "text-destructive"
                          }`}
                        >
                          {t.tipo === "entrada" ? (
                            <ArrowDownLeft size={12} />
                          ) : (
                            <ArrowUpRight size={12} />
                          )}
                          {t.tipo === "entrada" ? "Entrada" : "Saída"}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 font-bold ${
                          t.tipo === "entrada" ? "text-success" : "text-destructive"
                        }`}
                      >
                        {t.tipo === "entrada" ? "+" : "-"}R${t.valor}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusCls[t.status]}`}
                        >
                          {statusLabel[t.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {t.data}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransacoesPage;
