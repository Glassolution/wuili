import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Search, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type TabKey = "compradores" | "entregas" | "devolucoes";

type OrderRow = {
  id: string;
  external_order_id: string | null;
  platform: string | null;
  product_title: string | null;
  buyer_name: string | null;
  sale_price: number | null;
  ordered_at: string | null;
  tracking_code: string | null;
  status: string | null;
  cj_order_id: string | null;
  fulfillment_status: string | null;
  fulfillment_error: string | null;
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDateTime = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getTrackingLink = (trackingCode: string | null) => {
  if (!trackingCode) return null;
  if (trackingCode.startsWith("http://") || trackingCode.startsWith("https://")) return trackingCode;
  return `https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(trackingCode)}`;
};

const getDeliveryStatus = (order: OrderRow) => {
  const fulfillment = (order.fulfillment_status ?? "").toLowerCase();
  const baseStatus = (order.status ?? "").toLowerCase();

  if (fulfillment === "error") return "error";
  if (baseStatus === "delivered") return "delivered";
  if (baseStatus === "shipped" || order.tracking_code) return "shipped";
  if (baseStatus === "processing" || fulfillment === "processing" || order.cj_order_id) return "processing";
  return "pending_cj";
};

const deliveryStatusUI: Record<string, { label: string; className: string }> = {
  pending_cj: {
    label: "Aguardando CJ",
    className: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  },
  processing: {
    label: "Em produção",
    className: "bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700",
  },
  shipped: {
    label: "Enviado",
    className: "bg-green-100 text-green-700 border border-green-200",
  },
  delivered: {
    label: "Entregue",
    className: "bg-emerald-700 text-white border border-emerald-700",
  },
  error: {
    label: "Erro",
    className: "bg-red-100 text-red-700 border border-red-200",
  },
};

const refundStatusLabel: Record<string, string> = {
  refund_requested: "Solicitada",
  refund_review: "Em análise",
  refund_approved: "Aprovada",
  refund_rejected: "Recusada",
};

const tabButtonBase =
  "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors";

const ClientesPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("compradores");
  const [buyerSearch, setBuyerSearch] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["clientes-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase.from("orders" as any) as any)
        .select(
          "id, external_order_id, platform, product_title, buyer_name, sale_price, ordered_at, tracking_code, status, cj_order_id, fulfillment_status, fulfillment_error",
        )
        .eq("user_id", user!.id)
        .order("ordered_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const buyers = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        platformCounts: Record<string, number>;
        totalOrders: number;
        totalSpent: number;
        lastOrderAt: string | null;
      }
    >();

    orders.forEach((order) => {
      const name = (order.buyer_name ?? "Comprador sem nome").trim();
      const key = name.toLowerCase();
      const current = map.get(key) ?? {
        name,
        platformCounts: {},
        totalOrders: 0,
        totalSpent: 0,
        lastOrderAt: null,
      };

      current.totalOrders += 1;
      current.totalSpent += Number(order.sale_price ?? 0);
      const platform = (order.platform ?? "mercadolivre").toLowerCase();
      current.platformCounts[platform] = (current.platformCounts[platform] ?? 0) + 1;

      if (!current.lastOrderAt || (order.ordered_at && new Date(order.ordered_at) > new Date(current.lastOrderAt))) {
        current.lastOrderAt = order.ordered_at;
      }

      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders]);

  const filteredBuyers = useMemo(() => {
    const q = buyerSearch.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter((buyer) => buyer.name.toLowerCase().includes(q));
  }, [buyers, buyerSearch]);

  const refunds = useMemo(
    () =>
      orders.filter((order) =>
        ["refund_requested", "refund_review", "refund_approved", "refund_rejected"].includes(
          (order.status ?? "").toLowerCase(),
        ),
      ),
    [orders],
  );

  const handleResendToCJ = async (orderId: string) => {
    const { data, error } = await supabase.functions.invoke("cj-fulfill-request", {
      body: { order_id: orderId },
    });

    if (error || data?.success === false) {
      toast.error(data?.error ?? error?.message ?? "Falha ao reenviar pedido para CJ.");
      return;
    }

    toast.success("Pedido reenviado para a CJ com sucesso.");
    await queryClient.invalidateQueries({ queryKey: ["clientes-orders", user?.id] });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-black tracking-tight text-[#0A0A0A] dark:text-white">Clientes</h1>
        <p className="text-sm text-[#737373] dark:text-zinc-400">
          Central de compradores, entregas e devoluções.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-[#E5E5E5] bg-[#F7F7F7] p-4 shadow-sm dark:border-zinc-700">
        <Info size={18} className="mt-0.5 shrink-0 text-[#525252]" />
        <p className="text-[13px] leading-relaxed text-[#404040] sm:text-sm">
          A entrega é feita diretamente pela CJ Dropshipping ao seu comprador. Questões sobre nota fiscal devem ser
          resolvidas pelo vendedor. Em caso de problemas com o produto, entre em contato com contato@velo.com.br
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-1 shadow-sm sm:inline-grid sm:w-fit">
        <button
          onClick={() => setActiveTab("compradores")}
          className={`${tabButtonBase} ${
            activeTab === "compradores"
              ? "border-white bg-white text-[#0A0A0A] shadow-sm"
              : "border-transparent bg-transparent text-white hover:bg-white/5"
          }`}
        >
          Compradores
        </button>
        <button
          onClick={() => setActiveTab("entregas")}
          className={`${tabButtonBase} ${
            activeTab === "entregas"
              ? "border-white bg-white text-[#0A0A0A] shadow-sm"
              : "border-transparent bg-transparent text-white hover:bg-white/5"
          }`}
        >
          Entregas
        </button>
        <button
          onClick={() => setActiveTab("devolucoes")}
          className={`${tabButtonBase} ${
            activeTab === "devolucoes"
              ? "border-white bg-white text-[#0A0A0A] shadow-sm"
              : "border-transparent bg-transparent text-white hover:bg-white/5"
          }`}
        >
          Devoluções
        </button>
      </div>

      {activeTab === "compradores" && (
        <section className="rounded-2xl border border-[#E5E5E5] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center gap-2">
            <Search size={14} className="text-[#A3A3A3]" />
            <input
              value={buyerSearch}
              onChange={(event) => setBuyerSearch(event.target.value)}
              placeholder="Buscar comprador por nome"
              className="h-9 w-full rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-3 text-sm outline-none focus:border-[#D4D4D4] dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div className="space-y-2.5 md:hidden">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-2xl bg-[#F5F5F5] dark:bg-zinc-800" />
              ))
            ) : filteredBuyers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D4D4D4] px-4 py-8 text-center text-sm text-[#737373] dark:border-zinc-700 dark:text-zinc-400">
                Nenhum comprador encontrado.
              </div>
            ) : (
              filteredBuyers.map((buyer) => (
                <article key={buyer.name} className="rounded-2xl border border-[#F0F0F0] bg-[#FAFAFA] p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[#262626] dark:text-zinc-100">{buyer.name}</p>
                      <p className="mt-1 text-[12px] text-[#737373] dark:text-zinc-400">
                        Último pedido: {formatDateTime(buyer.lastOrderAt)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#525252] dark:bg-zinc-900 dark:text-zinc-300">
                      {buyer.totalOrders} pedidos
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white px-3 py-2 dark:bg-zinc-900">
                      <p className="text-[10.5px] font-medium text-[#A3A3A3] dark:text-zinc-500">Total gasto</p>
                      <p className="mt-0.5 text-[13px] font-bold text-[#0A0A0A] dark:text-white">{formatBRL(buyer.totalSpent)}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 dark:bg-zinc-900">
                      <p className="text-[10.5px] font-medium text-[#A3A3A3] dark:text-zinc-500">Plataforma</p>
                      <p className="mt-0.5 truncate text-[13px] font-bold text-[#0A0A0A] dark:text-white">
                        {Object.keys(buyer.platformCounts).map((platform) => {
                          const label = platform === "mercadolivre" ? "ML" : platform === "shopee" ? "Shopee" : platform;
                          return `${label} (${buyer.platformCounts[platform]})`;
                        }).join(" · ")}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[#F0F0F0] text-left text-xs uppercase tracking-wider text-[#A3A3A3]">
                  <th className="px-2 py-3">Nome</th>
                  <th className="px-2 py-3">Plataforma</th>
                  <th className="px-2 py-3">Total de pedidos</th>
                  <th className="px-2 py-3">Total gasto</th>
                  <th className="px-2 py-3">Último pedido</th>
                </tr>
              </thead>
              <tbody>
                {!isLoading &&
                  filteredBuyers.map((buyer) => (
                    <tr key={buyer.name} className="border-b border-[#F5F5F5] last:border-0">
                      <td className="px-2 py-3 font-medium text-[#262626] dark:text-zinc-100">{buyer.name}</td>
                      <td className="px-2 py-3 text-[#525252] dark:text-zinc-300">
                        {Object.keys(buyer.platformCounts).map((platform) => {
                          const label = platform === "mercadolivre" ? "ML" : platform === "shopee" ? "Shopee" : platform;
                          return `${label} (${buyer.platformCounts[platform]})`;
                        }).join(" · ")}
                      </td>
                      <td className="px-2 py-3 text-[#525252] dark:text-zinc-300">{buyer.totalOrders}</td>
                      <td className="px-2 py-3 text-[#525252] dark:text-zinc-300">{formatBRL(buyer.totalSpent)}</td>
                      <td className="px-2 py-3 text-[#525252] dark:text-zinc-300">{formatDateTime(buyer.lastOrderAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "entregas" && (
        <section className="rounded-2xl border border-[#E5E5E5] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="space-y-2.5 md:hidden">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-2xl bg-[#F5F5F5] dark:bg-zinc-800" />
              ))
            ) : orders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D4D4D4] px-4 py-8 text-center text-sm text-[#737373] dark:border-zinc-700 dark:text-zinc-400">
                Nenhuma entrega encontrada.
              </div>
            ) : (
              orders.map((order) => {
                const statusKey = getDeliveryStatus(order);
                const statusInfo = deliveryStatusUI[statusKey];
                const trackingLink = getTrackingLink(order.tracking_code);

                return (
                  <article key={order.id} className="rounded-2xl border border-[#F0F0F0] bg-[#FAFAFA] p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold text-[#262626] dark:text-zinc-100">
                          Pedido #{(order.external_order_id || order.id).slice(0, 12)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[12px] text-[#737373] dark:text-zinc-400">
                          {order.product_title || "Produto sem título"}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-white px-3 py-2 dark:bg-zinc-900">
                        <p className="text-[10.5px] font-medium text-[#A3A3A3] dark:text-zinc-500">Comprador</p>
                        <p className="mt-0.5 truncate text-[13px] font-bold text-[#0A0A0A] dark:text-white">{order.buyer_name || "—"}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 dark:bg-zinc-900">
                        <p className="text-[10.5px] font-medium text-[#A3A3A3] dark:text-zinc-500">Prazo</p>
                        <p className="mt-0.5 truncate text-[13px] font-bold text-[#0A0A0A] dark:text-white">
                          {order.status === "delivered" ? "Concluída" : "7-20 dias úteis"}
                        </p>
                      </div>
                    </div>

                    {(statusKey === "error" || trackingLink || order.fulfillment_error) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {statusKey === "error" && (
                          <button
                            onClick={() => handleResendToCJ(order.id)}
                            className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-xl border border-[#E5E5E5] bg-white px-3 text-xs font-semibold text-[#262626] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          >
                            <RefreshCw size={12} />
                            Reenviar
                          </button>
                        )}
                        {trackingLink && (
                          <button
                            onClick={() => window.open(trackingLink, "_blank", "noopener,noreferrer")}
                            className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-xl border border-[#E5E5E5] bg-white px-3 text-xs font-semibold text-[#262626] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          >
                            <ExternalLink size={12} />
                            Rastreio
                          </button>
                        )}
                        {order.fulfillment_error && (
                          <p className="w-full text-xs text-red-600">{order.fulfillment_error}</p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-[#F0F0F0] text-left text-xs uppercase tracking-wider text-[#A3A3A3]">
                  <th className="px-2 py-3">Pedido</th>
                  <th className="px-2 py-3">Produto</th>
                  <th className="px-2 py-3">Comprador</th>
                  <th className="px-2 py-3">Status CJ</th>
                  <th className="px-2 py-3">Código de rastreio</th>
                  <th className="px-2 py-3">Prazo estimado</th>
                  <th className="px-2 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {!isLoading &&
                  orders.map((order) => {
                    const statusKey = getDeliveryStatus(order);
                    const statusInfo = deliveryStatusUI[statusKey];
                    const trackingLink = getTrackingLink(order.tracking_code);

                    return (
                      <tr key={order.id} className="border-b border-[#F5F5F5] last:border-0">
                        <td className="px-2 py-3 font-medium text-[#262626] dark:text-zinc-100">
                          {order.external_order_id || order.id}
                        </td>
                        <td className="px-2 py-3 text-[#525252] dark:text-zinc-300">{order.product_title || "—"}</td>
                        <td className="px-2 py-3 text-[#525252] dark:text-zinc-300">{order.buyer_name || "—"}</td>
                        <td className="px-2 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-[#525252] dark:text-zinc-300">{order.tracking_code || "—"}</td>
                        <td className="px-2 py-3 text-[#525252] dark:text-zinc-300">
                          {order.status === "delivered" ? "Concluída" : "7-20 dias úteis"}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex flex-wrap gap-2">
                            {statusKey === "error" && (
                              <button
                                onClick={() => handleResendToCJ(order.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#262626] hover:bg-[#F5F5F5]"
                              >
                                <RefreshCw size={12} />
                                Reenviar para CJ
                              </button>
                            )}
                            {trackingLink && (
                              <button
                                onClick={() => window.open(trackingLink, "_blank", "noopener,noreferrer")}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#262626] hover:bg-[#F5F5F5]"
                              >
                                <ExternalLink size={12} />
                                Ver rastreio
                              </button>
                            )}
                          </div>
                          {order.fulfillment_error && (
                            <p className="mt-1 max-w-[240px] text-xs text-red-600">{order.fulfillment_error}</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "devolucoes" && (
        <section className="space-y-3">
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 text-sm text-[#525252] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            Devoluções devem ser tratadas diretamente no Mercado Livre. A Velo exibe aqui apenas o histórico para
            acompanhamento interno.
          </div>

          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="space-y-2.5 md:hidden">
              {refunds.length === 0 && !isLoading ? (
                <div className="rounded-2xl border border-dashed border-[#D4D4D4] px-4 py-8 text-center text-sm text-[#737373] dark:border-zinc-700 dark:text-zinc-400">
                  Nenhuma solicitação de devolução encontrada.
                </div>
              ) : (
                refunds.map((order) => (
                  <article key={order.id} className="rounded-2xl border border-[#F0F0F0] bg-[#FAFAFA] p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold text-[#262626] dark:text-zinc-100">
                          Pedido #{(order.external_order_id || order.id).slice(0, 12)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[12px] text-[#737373] dark:text-zinc-400">
                          {order.product_title || "Produto sem título"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[10.5px] font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        {refundStatusLabel[(order.status ?? "").toLowerCase()] ?? "—"}
                      </span>
                    </div>
                    <p className="mt-3 rounded-xl bg-white px-3 py-2 text-[12px] font-semibold text-[#525252] dark:bg-zinc-900 dark:text-zinc-300">
                      Comprador: {order.buyer_name || "—"}
                    </p>
                  </article>
                ))
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[#F0F0F0] text-left text-xs uppercase tracking-wider text-[#A3A3A3]">
                    <th className="px-2 py-3">Pedido</th>
                    <th className="px-2 py-3">Comprador</th>
                    <th className="px-2 py-3">Produto</th>
                    <th className="px-2 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((order) => (
                    <tr key={order.id} className="border-b border-[#F5F5F5] last:border-0">
                      <td className="px-2 py-3 font-medium text-[#262626] dark:text-zinc-100">
                        {order.external_order_id || order.id}
                      </td>
                      <td className="px-2 py-3 text-[#525252] dark:text-zinc-300">{order.buyer_name || "—"}</td>
                      <td className="px-2 py-3 text-[#525252] dark:text-zinc-300">{order.product_title || "—"}</td>
                      <td className="px-2 py-3 text-[#525252] dark:text-zinc-300">
                        {refundStatusLabel[(order.status ?? "").toLowerCase()] ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {refunds.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={4} className="px-2 py-8 text-center text-sm text-[#A3A3A3]">
                        Nenhuma solicitação de devolução encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default ClientesPage;
