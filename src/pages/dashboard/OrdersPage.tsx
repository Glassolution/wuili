import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Truck,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

type Order = {
  id: string;
  user_id: string;
  external_order_id: string | null;
  platform: string;
  product_title: string;
  product_image: string | null;
  buyer_name: string | null;
  buyer_address?: string | null;
  buyer_number?: string | null;
  buyer_neighborhood?: string | null;
  buyer_city?: string | null;
  buyer_state?: string | null;
  buyer_zip?: string | null;
  buyer_phone?: string | null;
  buyer_email?: string | null;
  sale_price: number;
  cost_price: number | null;
  profit: number | null;
  status: string;
  tracking_code: string | null;
  cj_product_id?: string | null;
  cj_product_url?: string | null;
  cj_variant_id?: string | null;
  fulfillment_status?: string | null;
  fulfilled_at?: string | null;
  ordered_at: string | null;
  created_at: string;
};

type TabFilter = "all" | "in_progress" | "delivered" | "cancelled";
type DateRangeFilter = "all" | "7d" | "30d" | "90d" | "month";

const STATUS_GROUP: Record<string, TabFilter> = {
  awaiting_payment: "in_progress",
  pending: "in_progress",
  paid: "in_progress",
  approved: "in_progress",
  shipped: "in_progress",
  processing: "in_progress",
  delivered: "delivered",
  completed: "delivered",
  cancelled: "cancelled",
  canceled: "cancelled",
};

const CJ_WALLET_URL = "https://cjdropshipping.com/wallet.html";

const STATUS_COPY: Record<TabFilter, { label: string; dot: string; className: string }> = {
  all: {
    label: "All",
    dot: "bg-[#000000]",
    className: "bg-[#EFEFEF] text-[#000000]",
  },
  in_progress: {
    label: "In progress",
    dot: "bg-[#E48622]",
    className: "bg-[#FFF4E6] text-[#C86911]",
  },
  delivered: {
    label: "Delivered",
    dot: "bg-[#88A72B]",
    className: "bg-[#EEF7E6] text-[#6D9335]",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-[#B83D3F]",
    className: "bg-[#F8EEEE] text-[#A03336]",
  },
};

const TABS: { key: TabFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_progress", label: "In Progress" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const DATE_RANGE_LABEL: Record<DateRangeFilter, string> = {
  all: "Select date range",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  month: "This month",
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const formatMaybeBRL = (value?: number | null) =>
  typeof value === "number" ? formatBRL(value) : "Não informado";

const formatOrderDate = (order: Order) => {
  const value = order.ordered_at ?? order.created_at;
  if (!value) return "No date";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const getStatusGroup = (status?: string | null): TabFilter =>
  STATUS_GROUP[(status ?? "").toLowerCase()] ?? "in_progress";

const isAwaitingCjPayment = (order: Order) =>
  order.status === "awaiting_payment" || order.fulfillment_status === "awaiting_payment";

const getOrderStatusCopy = (order: Order) => {
  if (isAwaitingCjPayment(order)) {
    return {
      label: "Aguardando recarga",
      dot: "bg-amber-500",
      className: "bg-amber-50 text-amber-700",
    };
  }

  return STATUS_COPY[getStatusGroup(order.status)];
};

const getOrderDate = (order: Order) => new Date(order.ordered_at ?? order.created_at);

const getOrderId = (order: Order) =>
  order.external_order_id || order.id.slice(0, 8).toUpperCase();

const getProfit = (order: Order) =>
  typeof order.profit === "number"
    ? order.profit
    : typeof order.cost_price === "number"
      ? order.sale_price - order.cost_price
      : null;

const getProductItems = (title: string) =>
  title
    .split(/\s+\|\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

const isInsideDateRange = (order: Order, range: DateRangeFilter) => {
  if (range === "all") return true;

  const date = getOrderDate(order);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  if (range === "month") {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const start = new Date(now);
  start.setDate(now.getDate() - days);
  start.setHours(0, 0, 0, 0);

  return date >= start;
};

const getCustomerAddress = (order: Order) => {
  const street = order.buyer_address?.trim() || "Endereço não informado";
  const number = order.buyer_number?.trim();
  const lineOne = number && !street.includes(number) ? `${street}, ${number}` : street;
  const cityLine = [order.buyer_neighborhood, order.buyer_city, order.buyer_state]
    .map((item) => item?.trim())
    .filter(Boolean)
    .join(" - ");
  const zipLine = order.buyer_zip ? `CEP ${order.buyer_zip}` : "";

  return {
    lineOne,
    cityLine: cityLine || "Cidade/estado não informados",
    zipLine,
    full: [lineOne, cityLine, zipLine].filter(Boolean).join(" • "),
  };
};

const getCustomerCopyText = (order: Order) => {
  const address = getCustomerAddress(order);

  return [
    `Nome: ${order.buyer_name || "Não informado"}`,
    `Endereço: ${address.lineOne}`,
    `Bairro/Cidade: ${address.cityLine}`,
    address.zipLine,
    `Telefone: ${order.buyer_phone || "Não informado"}`,
    `Email: ${order.buyer_email || "Não informado"}`,
  ].filter(Boolean).join("\n");
};

const getCjProductUrl = (order: Order) => {
  if (order.cj_product_url) return order.cj_product_url;
  if (order.cj_product_id) {
    return `https://www.cjdropshipping.com/product-detail.html?id=${encodeURIComponent(order.cj_product_id)}`;
  }
  if (order.cj_variant_id) {
    return `https://www.cjdropshipping.com/product-detail.html?id=${encodeURIComponent(order.cj_variant_id)}`;
  }
  return null;
};

const getDeliveryStep = (order: Order) => {
  const status = order.status.toLowerCase();
  const fulfillmentStatus = (order.fulfillment_status ?? "").toLowerCase();

  if (["delivered", "completed"].includes(status)) return 4;
  if (
    status === "shipped" ||
    !!order.tracking_code ||
    ["processing", "fulfilled", "shipped"].includes(fulfillmentStatus)
  ) {
    return 3;
  }
  return 2;
};

const copyToClipboard = async (text: string, successMessage: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("Não foi possível copiar");
  }
};

const openCjWallet = () => {
  window.open(CJ_WALLET_URL, "_blank", "noopener,noreferrer");
};

const OrderImage = ({ order }: { order: Order }) => {
  const itemCount = getProductItems(order.product_title).length;
  const extraItems = Math.max(itemCount - 1, 0);

  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[8px] bg-[#EFEFEF]">
      {order.product_image ? (
        <img
          src={order.product_image}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-black">
          <Package size={18} strokeWidth={1.8} />
        </div>
      )}

      {extraItems > 0 && (
        <span className="absolute bottom-0 right-0 flex h-5 min-w-5 items-center justify-center rounded-tl-[8px] bg-black px-1.5 text-[10px] font-semibold leading-none text-white">
          +{extraItems}
        </span>
      )}
    </div>
  );
};

const OrderCardSkeleton = () => (
  <div className="rounded-[12px] border border-[#EAEAEA] bg-white px-4 py-4">
    <div className="flex items-center gap-4">
      <Skeleton className="h-12 w-12 rounded-[8px]" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-64 rounded-full" />
        <Skeleton className="h-3 w-36 rounded-full" />
      </div>
      <Skeleton className="h-5 w-24 rounded-full" />
      <Skeleton className="h-6 w-24 rounded-full" />
    </div>
  </div>
);

const OrdersPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabFilter>("all");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState("");

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

  const allOrders = orders ?? [];
  const selectedOrder = selectedOrderId
    ? allOrders.find((order) => order.id === selectedOrderId) ?? null
    : null;

  useEffect(() => {
    if (selectedOrder) setTrackingInput(selectedOrder.tracking_code ?? "");
  }, [selectedOrder?.id, selectedOrder?.tracking_code]);

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, values }: { orderId: string; values: Partial<Order> }) => {
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("orders" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .update(values)
        .eq("id", orderId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders", user?.id] });
    },
  });

  const sendToCjMutation = useMutation({
    mutationFn: async (order: Order) => {
      if (!order.cj_variant_id) {
        throw new Error("Este pedido ainda não tem variante CJ vinculada.");
      }

      const { data, error } = await supabase.functions.invoke("cj-fulfill-request", {
        body: { order_id: order.id },
      });

      if (error || data?.success === false) {
        throw new Error(data?.error || error?.message || "Erro ao enviar pedido para a CJ");
      }

      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders", user?.id] });
    },
  });

  const handleSaveTracking = async () => {
    if (!selectedOrder) return;
    const tracking = trackingInput.trim();

    try {
      await updateOrderMutation.mutateAsync({
        orderId: selectedOrder.id,
        values: { tracking_code: tracking || null } as Partial<Order>,
      });
      toast.success("Código de rastreio salvo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar rastreio");
    }
  };

  const handleMarkAsShipped = async () => {
    if (!selectedOrder) return;
    const tracking = trackingInput.trim();

    try {
      await updateOrderMutation.mutateAsync({
        orderId: selectedOrder.id,
        values: {
          status: "shipped",
          tracking_code: tracking || selectedOrder.tracking_code || null,
        } as Partial<Order>,
      });
      toast.success("Pedido marcado como enviado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao marcar como enviado");
    }
  };

  const handleSendToCj = async () => {
    if (!selectedOrder) return;

    try {
      await sendToCjMutation.mutateAsync(selectedOrder);
      toast.success("Pedido enviado para a CJ");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar pedido para a CJ");
    }
  };

  const filteredOrders = useMemo(() => {
    return allOrders.filter((order) => {
      const matchesStatus = tab === "all" || getStatusGroup(order.status) === tab;
      const matchesDate = isInsideDateRange(order, dateRange);

      return matchesStatus && matchesDate;
    });
  }, [allOrders, tab, dateRange]);

  if (selectedOrder) {
    return (
      <DeliveryDetailView
        order={selectedOrder}
        trackingInput={trackingInput}
        onTrackingInputChange={setTrackingInput}
        onBack={() => setSelectedOrderId(null)}
        onSaveTracking={handleSaveTracking}
        onMarkAsShipped={handleMarkAsShipped}
        onSendToCj={handleSendToCj}
        isSaving={updateOrderMutation.isPending}
        isSendingToCj={sendToCjMutation.isPending}
      />
    );
  }

  return (
    <section className="min-h-[calc(100vh-112px)] rounded-[24px] bg-[#F7F7F7] px-4 py-5 font-sans text-black dark:bg-zinc-950 dark:text-white md:px-6 md:py-6">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 rounded-[12px] border border-[#EAEAEA] bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 md:p-6">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[13px] leading-none text-[#6B6B6B] dark:text-zinc-300">
          <Link to="/dashboard" className="font-medium transition hover:text-black">
            Home
          </Link>
          <ChevronRight size={14} strokeWidth={2} className="text-black dark:text-white" />
          <Link to="/dashboard/configuracoes" className="font-medium transition hover:text-black">
            My Account
          </Link>
          <ChevronRight size={14} strokeWidth={2} className="text-black dark:text-white" />
          <span className="font-medium text-[#6B6B6B] dark:text-zinc-400">My Orders</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {TABS.map((item) => {
              const active = tab === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={[
                    "h-8 shrink-0 rounded-full px-4 text-[13px] font-medium transition active:scale-[0.98]",
                    active
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "bg-[#F1F1F1] text-black hover:bg-[#E9E9E9] dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <label className="relative h-9 w-full shrink-0 lg:w-[190px]">
            <span className="pointer-events-none absolute inset-0 flex items-center justify-between rounded-full bg-[#F1F1F1] px-4 text-[13px] font-medium text-black dark:bg-zinc-900 dark:text-zinc-100">
              {DATE_RANGE_LABEL[dateRange]}
              <ChevronDown size={15} strokeWidth={2} className="text-black dark:text-white" />
            </span>
            <select
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value as DateRangeFilter)}
              aria-label="Select date range"
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full opacity-0"
            >
              <option value="all">Select date range</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="month">This month</option>
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => <OrderCardSkeleton key={index} />)
          ) : isError ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[12px] border border-[#EAEAEA] bg-white px-6 py-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
              <AlertCircle size={24} className="text-black dark:text-white" />
              <p className="mt-4 text-[17px] font-semibold">Could not load orders</p>
              <p className="mt-2 max-w-[400px] text-[13px] leading-6 text-[#77706B] dark:text-zinc-400">
                Refresh the page or try again in a moment.
              </p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[12px] border border-[#EAEAEA] bg-white px-6 py-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
              <Package size={26} className="text-black" strokeWidth={1.8} />
              <p className="mt-4 text-[18px] font-semibold">No orders found</p>
              <p className="mt-2 max-w-[390px] text-[13px] leading-6 text-[#77706B] dark:text-zinc-400">
                Orders requested by your customers will appear here as soon as they are received.
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const status = getOrderStatusCopy(order);
              const awaitingPayment = isAwaitingCjPayment(order);
              const items = getProductItems(order.product_title);
              const visibleItems = items.slice(0, 3);
              const hiddenCount = Math.max(items.length - visibleItems.length, 0);
              const productCopy = [
                visibleItems.join(" | ") || "Product without title",
                hiddenCount > 0 ? `& ${hiddenCount} more items` : "",
              ].filter(Boolean);

              return (
                <article
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedOrderId(order.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedOrderId(order.id);
                    }
                  }}
                  className="group cursor-pointer rounded-[12px] border border-[#EAEAEA] bg-white px-4 py-4 transition duration-150 hover:bg-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-black/10 active:scale-[0.997] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <div className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 lg:grid-cols-[48px_minmax(0,1fr)_120px_132px_28px]">
                    <OrderImage order={order} />

                    <div className="min-w-0">
                      <p className="line-clamp-1 text-[14px] font-medium leading-tight text-black dark:text-zinc-100">
                        {productCopy[0]}
                        {productCopy[1] && <span className="font-medium text-[#6B6B6B]"> {productCopy[1]}</span>}
                      </p>
                      <p className="mt-1 text-[12px] leading-none text-[#8A8A8A]">
                        Order ID: {getOrderId(order)} • {formatOrderDate(order)}
                      </p>
                      <div className="mt-2 flex items-center gap-2 lg:hidden">
                        <p className="text-[14px] font-bold text-black dark:text-white">
                          {formatBRL(order.sale_price)}
                        </p>
                        <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium ${status.className}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      </div>
                      {awaitingPayment && (
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openCjWallet();
                            }}
                            className="inline-flex h-8 items-center justify-center rounded-full bg-black px-3 text-[12px] font-semibold text-white transition hover:bg-[#222]"
                          >
                            Recarregar CJ
                          </button>
                          <p className="text-[12px] leading-5 text-[#6B6B6B]">
                            Recarregue sua conta na CJ e o pedido será processado automaticamente em até 2 horas
                          </p>
                        </div>
                      )}
                    </div>

                    <p className="hidden text-[15px] font-bold text-black dark:text-white lg:block">
                      {formatBRL(order.sale_price)}
                    </p>

                    <span className={`hidden h-6 w-fit items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium lg:inline-flex ${status.className}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>

                    <span className="flex justify-end text-black transition group-hover:translate-x-0.5 dark:text-white">
                      <ChevronRight size={18} strokeWidth={2} />
                    </span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

type DeliveryDetailViewProps = {
  order: Order;
  trackingInput: string;
  onTrackingInputChange: (value: string) => void;
  onBack: () => void;
  onSaveTracking: () => void;
  onMarkAsShipped: () => void;
  onSendToCj: () => void;
  isSaving: boolean;
  isSendingToCj: boolean;
};

const DeliveryDetailView = ({
  order,
  trackingInput,
  onTrackingInputChange,
  onBack,
  onSaveTracking,
  onMarkAsShipped,
  onSendToCj,
  isSaving,
  isSendingToCj,
}: DeliveryDetailViewProps) => {
  const currentStep = getDeliveryStep(order);
  const address = getCustomerAddress(order);
  const profit = getProfit(order);
  const cjProductUrl = getCjProductUrl(order);
  const customerText = getCustomerCopyText(order);
  const awaitingPayment = isAwaitingCjPayment(order);

  const openCjProduct = () => {
    if (!cjProductUrl) {
      toast.error("Link da CJ não encontrado para este pedido");
      return;
    }

    window.open(cjProductUrl, "_blank", "noopener,noreferrer");
  };

  const steps = [
    {
      number: 1,
      title: "Venda confirmada",
      icon: <CheckCircle2 size={19} />,
      text: "Parabéns! Você realizou uma venda no Mercado Livre. O pagamento será liberado pelo ML em até 14 dias úteis.",
    },
    {
      number: 2,
      title: "Pague o fornecedor",
      icon: <WalletCards size={19} />,
      text: "Você precisa pagar o produto na CJ Dropshipping agora para que ele seja enviado ao seu cliente. O valor já foi descontado do seu lucro estimado.",
    },
    {
      number: 3,
      title: "Produto sendo enviado",
      icon: <Truck size={19} />,
      text: "Após finalizar o pedido na CJ, o produto será enviado diretamente para o seu cliente. A CJ leva em média 3 a 7 dias para despachar.",
    },
    {
      number: 4,
      title: "Cliente recebeu",
      icon: <CheckCircle2 size={19} />,
      text: "Seu cliente recebeu o produto e a venda foi concluída. O pagamento do ML será liberado em breve na sua conta.",
    },
  ];

  return (
    <section className="min-h-[calc(100vh-112px)] rounded-[24px] bg-white px-5 py-6 font-['Manrope'] text-[#151312] shadow-[0_1px_0_rgba(18,18,18,0.04)] dark:bg-zinc-950 dark:text-white md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-7">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-3 text-[15px] leading-none text-[#2A2928] dark:text-zinc-200">
          <Link to="/dashboard" className="transition hover:text-[#0A0A0A]">
            Home
          </Link>
          <ChevronRight size={16} strokeWidth={2.1} className="text-[#1D1B1A] dark:text-zinc-300" />
          <button type="button" onClick={onBack} className="transition hover:text-[#0A0A0A]">
            My Orders
          </button>
          <ChevronRight size={16} strokeWidth={2.1} className="text-[#1D1B1A] dark:text-zinc-300" />
          <span className="text-[#494746] dark:text-zinc-400">Entrega</span>
        </nav>

        <div className="flex flex-col gap-5 rounded-[24px] border border-[#E8E5E2] bg-[#FBFAF9] p-5 dark:border-zinc-800 dark:bg-zinc-900/60 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E1DDDA] bg-white text-[#151312] transition hover:border-[#151312] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              aria-label="Voltar para pedidos"
            >
              <ArrowLeft size={18} />
            </button>

            <OrderImage order={order} />

            <div className="min-w-0">
              <div className="mb-2 inline-flex rounded-full border border-[#D8D3CF] bg-white px-3 py-1 text-[12px] font-semibold text-[#494746] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                Entrega do pedido
              </div>
              <h1 className="line-clamp-2 text-[24px] font-bold leading-tight tracking-[-0.02em] text-[#151312] dark:text-white md:text-[30px]">
                {order.product_title}
              </h1>
              <p className="mt-2 text-[14px] font-medium text-[#77706B] dark:text-zinc-400">
                Pedido #{getOrderId(order)} • {formatOrderDate(order)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onMarkAsShipped}
            disabled={isSaving}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-100"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
            Marcar como enviado
          </button>
        </div>

        {awaitingPayment && (
          <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[15px] font-bold">Aguardando recarga na CJ</p>
                <p className="mt-1 text-[13px] leading-5">
                  Recarregue sua conta na CJ e o pedido será processado automaticamente em até 2 horas.
                </p>
              </div>
              <button
                type="button"
                onClick={openCjWallet}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-amber-500 px-5 text-[13px] font-bold text-white transition hover:bg-amber-600"
              >
                Recarregar CJ
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-[24px] border border-[#E8E5E2] bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 md:p-7">
            <div className="mb-7 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[22px] font-bold tracking-[-0.02em]">Próximos passos da entrega</h2>
                <p className="mt-1 text-[13px] leading-5 text-[#77706B] dark:text-zinc-400">
                  Siga a ordem abaixo para finalizar a venda com segurança.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute bottom-10 left-[22px] top-10 w-px bg-[#E8E5E2] dark:bg-zinc-800" />

              <div className="space-y-5">
                {steps.map((step) => {
                  const state =
                    step.number < currentStep || currentStep === 4
                      ? "done"
                      : step.number === currentStep
                        ? "current"
                        : "pending";

                  return (
                    <DeliveryStep
                      key={step.number}
                      step={step}
                      state={state}
                      order={order}
                      trackingInput={trackingInput}
                      onTrackingInputChange={onTrackingInputChange}
                      onSaveTracking={onSaveTracking}
                      onOpenCjProduct={openCjProduct}
                      onSendToCj={onSendToCj}
                      onCopyAddress={() => copyToClipboard(customerText, "Endereço do cliente copiado")}
                      isSaving={isSaving}
                      isSendingToCj={isSendingToCj}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-5">
            <div className="rounded-[24px] border border-[#E8E5E2] bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#77706B] dark:text-zinc-500">
                    Informações do cliente
                  </p>
                  <h2 className="mt-2 text-[20px] font-bold tracking-[-0.02em]">
                    {order.buyer_name || "Cliente não informado"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(customerText, "Dados do cliente copiados")}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E1DDDA] bg-white text-[#151312] transition hover:border-[#151312] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  aria-label="Copiar dados do cliente"
                >
                  <Copy size={16} />
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <CustomerInfoRow icon={<MapPin size={16} />} label="Endereço completo" value={address.full} />
                <CustomerInfoRow icon={<Phone size={16} />} label="Telefone" value={order.buyer_phone || "Não informado"} />
                <CustomerInfoRow icon={<Mail size={16} />} label="Email" value={order.buyer_email || "Não informado"} />
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard(customerText, "Todos os dados do cliente foram copiados")}
                className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#D8D3CF] bg-[#FBFAF9] text-[13px] font-semibold text-[#151312] transition hover:border-[#151312] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:border-white"
              >
                <Clipboard size={15} />
                Copiar tudo
              </button>
            </div>

            <div className="rounded-[24px] border border-[#E8E5E2] bg-[#FBFAF9] p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#77706B] dark:text-zinc-500">
                Resumo financeiro
              </p>
              <div className="mt-5 space-y-3">
                <SummaryRow label="Custo na CJ" value={formatMaybeBRL(order.cost_price)} />
                <SummaryRow label="Recebimento ML" value={formatBRL(order.sale_price)} />
                <SummaryRow label="Lucro estimado" value={formatMaybeBRL(profit)} strong />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

type DeliveryStepProps = {
  step: {
    number: number;
    title: string;
    icon: React.ReactNode;
    text: string;
  };
  state: "done" | "current" | "pending";
  order: Order;
  trackingInput: string;
  onTrackingInputChange: (value: string) => void;
  onSaveTracking: () => void;
  onOpenCjProduct: () => void;
  onSendToCj: () => void;
  onCopyAddress: () => void;
  isSaving: boolean;
  isSendingToCj: boolean;
};

const DeliveryStep = ({
  step,
  state,
  order,
  trackingInput,
  onTrackingInputChange,
  onSaveTracking,
  onOpenCjProduct,
  onSendToCj,
  onCopyAddress,
  isSaving,
  isSendingToCj,
}: DeliveryStepProps) => {
  const profit = getProfit(order);
  const awaitingPayment = isAwaitingCjPayment(order);
  const tone = {
    done: {
      icon: "border-emerald-200 bg-emerald-50 text-emerald-700",
      card: "border-emerald-100 bg-emerald-50/30",
      label: "Concluído",
      labelClass: "bg-emerald-50 text-emerald-700 border-emerald-100",
    },
    current: {
      icon: "border-blue-200 bg-blue-50 text-blue-700",
      card: "border-blue-200 bg-blue-50/35 shadow-[0_18px_44px_rgba(37,99,235,0.08)]",
      label: "Em andamento",
      labelClass: "bg-blue-50 text-blue-700 border-blue-100",
    },
    pending: {
      icon: "border-zinc-200 bg-zinc-50 text-zinc-500",
      card: "border-[#E8E5E2] bg-white",
      label: "Pendente",
      labelClass: "bg-zinc-50 text-zinc-500 border-zinc-200",
    },
  }[state];

  return (
    <article className="relative grid grid-cols-[46px_minmax(0,1fr)] gap-4">
      <div className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full border ${tone.icon}`}>
        {step.icon}
      </div>

      <div className={`rounded-[20px] border p-5 transition ${tone.card}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[18px] font-bold tracking-[-0.01em]">
            Etapa {step.number} — {step.title}
          </h3>
          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${tone.labelClass}`}>
            {tone.label}
          </span>
        </div>
        <p className="mt-3 text-[14px] leading-6 text-[#5F5A56] dark:text-zinc-400">{step.text}</p>

        {step.number === 2 && (
          <div className="mt-5 space-y-5">
            {awaitingPayment && (
              <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium leading-5 text-amber-800">
                Recarregue sua conta na CJ e o pedido será processado automaticamente em até 2 horas.
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Custo do produto na CJ" value={formatMaybeBRL(order.cost_price)} />
              <MetricCard label="Valor que você vai receber do ML" value={formatBRL(order.sale_price)} />
              <MetricCard label="Lucro estimado" value={formatMaybeBRL(profit)} />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={awaitingPayment ? openCjWallet : onOpenCjProduct}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-5 text-[13px] font-semibold text-white transition hover:bg-[#1A1A1A]"
              >
                <ExternalLink size={15} />
                {awaitingPayment ? "Recarregar CJ" : "Comprar na CJ"}
              </button>
              <button
                type="button"
                onClick={onSendToCj}
                disabled={isSendingToCj}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-[13px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingToCj ? <Loader2 size={15} className="animate-spin" /> : <Truck size={15} />}
                Enviar pela CJ
              </button>
              <button
                type="button"
                onClick={onCopyAddress}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#D8D3CF] bg-white px-5 text-[13px] font-semibold text-[#151312] transition hover:border-[#151312]"
              >
                <Copy size={15} />
                Copiar endereço do cliente
              </button>
            </div>
          </div>
        )}

        {step.number === 3 && (
          <div className="mt-5 rounded-[16px] border border-[#E8E5E2] bg-white p-4">
            <label className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#77706B]">
              Código de rastreio
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                value={trackingInput}
                onChange={(event) => onTrackingInputChange(event.target.value)}
                placeholder="Cole o código de rastreio"
                className="h-11 min-w-0 flex-1 rounded-full border border-[#D8D3CF] bg-white px-4 text-[14px] font-medium text-[#151312] outline-none transition placeholder:text-[#A8A19B] focus:border-[#151312]"
              />
              <button
                type="button"
                onClick={onSaveTracking}
                disabled={isSaving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#D8D3CF] bg-[#FBFAF9] px-5 text-[13px] font-semibold text-[#151312] transition hover:border-[#151312] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving && <Loader2 size={15} className="animate-spin" />}
                Salvar rastreio
              </button>
            </div>
            <p className="mt-3 text-[13px] leading-5 text-[#77706B]">
              A Velo sincroniza o rastreio automaticamente a cada 2h.
            </p>
          </div>
        )}
      </div>
    </article>
  );
};

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[16px] border border-[#E8E5E2] bg-white px-4 py-3">
    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#77706B]">{label}</p>
    <p className="mt-2 text-[17px] font-bold text-[#151312]">{value}</p>
  </div>
);

const SummaryRow = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => (
  <div className="flex items-center justify-between gap-4 rounded-[14px] bg-white px-4 py-3 dark:bg-zinc-950">
    <span className="text-[13px] font-medium text-[#77706B] dark:text-zinc-400">{label}</span>
    <span className={`text-[14px] ${strong ? "font-bold text-[#151312] dark:text-white" : "font-semibold text-[#2A2928] dark:text-zinc-200"}`}>
      {value}
    </span>
  </div>
);

const CustomerInfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex gap-3 rounded-[16px] border border-[#E8E5E2] bg-[#FBFAF9] p-4 dark:border-zinc-800 dark:bg-zinc-900">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#151312] dark:bg-zinc-950 dark:text-white">
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#77706B] dark:text-zinc-500">{label}</p>
      <p className="mt-1 text-[14px] font-semibold leading-5 text-[#151312] dark:text-white">{value}</p>
    </div>
  </div>
);

export default OrdersPage;
