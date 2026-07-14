import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  Truck,
  UserRound,
} from "lucide-react";
import OrderTrackingTimeline from "@/components/dashboard/OrderTrackingTimeline";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { veloToast } from "@/components/ui/velo-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getMockLucasOrder, isMockLucasOrder, isLucasMockOrderUser } from "@/lib/mockLucasOrder";

type MlOrderRow = Database["public"]["Views"]["ml_orders_view"]["Row"];

type FutureTrackingFields = {
  shipment_status?: string | null;
  shipment_substatus?: string | null;
  date_ready_to_ship?: string | null;
  date_shipped?: string | null;
  date_delivered?: string | null;
  subtotal?: number | null;
  shipping_cost?: number | null;
};

type MlOrderDetail = MlOrderRow & FutureTrackingFields;

const statusLabels: Record<string, string> = {
  paid: "Pago",
  approved: "Aprovado",
  in_process: "Em processamento",
  processing: "Em processamento",
  completed: "Concluído",
  delivered: "Entregue",
  shipped: "Enviado",
  in_transit: "Em trânsito",
  pending: "Pendente",
  cancelled: "Cancelado",
  canceled: "Cancelado",
  failed: "Falhou",
};

const formatBRL = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

const clean = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
};

const getOrderCode = (order: MlOrderDetail) => clean(order.ml_order_id ?? order.external_order_id ?? order.id);

const getProductName = (order: MlOrderDetail) => clean(order.catalog_title ?? order.product_title);

const getProductImage = (order: MlOrderDetail) => {
  if (order.product_image) return order.product_image;
  if (!Array.isArray(order.catalog_images)) return null;
  const image = order.catalog_images.find((item) => typeof item === "string" && item.trim());
  return typeof image === "string" ? image : null;
};

const getStatusLabel = (status: string | null | undefined) => {
  const normalized = (status ?? "pending").toLowerCase();
  return statusLabels[normalized] ?? clean(status);
};

const getTrackingStage = (order: MlOrderDetail) => {
  const status = (order.status ?? "").toLowerCase();
  const shipmentStatus = (order.shipment_status ?? "").toLowerCase();

  if (order.date_delivered || ["delivered", "completed"].includes(status) || shipmentStatus === "delivered") {
    return 2;
  }

  if (
    order.date_shipped ||
    ["shipped", "in_transit"].includes(status) ||
    ["shipped", "in_transit", "ready_to_ship"].includes(shipmentStatus)
  ) {
    return 1;
  }

  return 0;
};

const getMobileTrackingSteps = (order: MlOrderDetail) => [
  {
    label: "Recebido",
    date: order.ordered_at ?? order.created_at,
  },
  {
    label: "Em trânsito",
    date: order.date_shipped ?? order.date_ready_to_ship,
  },
  {
    label: "Entregue",
    date: order.date_delivered,
  },
];

const supplierHref = (value: string | null | undefined) => {
  const url = value?.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
  return `https://${url}`;
};

const getAddress = (order: MlOrderDetail) => {
  const street = [order.buyer_address, order.buyer_number ? `nº ${order.buyer_number}` : null, order.buyer_complement]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(", ");
  const location = [order.buyer_neighborhood, order.buyer_city, order.buyer_state]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" - ");

  return [street, location, order.buyer_zip ? `CEP ${order.buyer_zip}` : null].filter(Boolean);
};

const SupplierButton = ({ url, tone = "indigo" }: { url: string | null | undefined; tone?: "indigo" | "black" }) => {
  const href = supplierHref(url);
  const baseClasses = "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition sm:w-auto";
  const activeClasses =
    tone === "black"
      ? "bg-[#050505] text-white shadow-[0_10px_22px_rgba(0,0,0,0.14)] hover:bg-black/90"
      : "bg-indigo-600 text-white shadow-[0_8px_22px_rgba(79,70,229,0.20)] hover:bg-indigo-700";
  const disabledClasses = tone === "black" ? "bg-black/30 text-white" : "bg-indigo-300 text-white";

  if (!href) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" tabIndex={0}>
            <button type="button" disabled className={`${baseClasses} ${disabledClasses} cursor-not-allowed`}>
              <ShoppingBag size={16} strokeWidth={1.5} />
              Comprar no Fornecedor
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Fornecedor não vinculado</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={`${baseClasses} ${activeClasses}`}>
      <ShoppingBag size={16} strokeWidth={1.5} />
      Comprar no Fornecedor
      <ExternalLink size={14} strokeWidth={1.5} />
    </a>
  );
};

const DetailSkeleton = () => (
  <div className="mx-auto w-full max-w-6xl space-y-5">
    <Skeleton className="h-10 w-28 rounded-lg" />
    <div className="overflow-hidden rounded-lg border border-indigo-100 bg-white">
      <div className="space-y-3 p-7">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-44 w-full rounded-none" />
      <div className="grid gap-5 p-7 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-lg" />
        <Skeleton className="h-52 rounded-lg" />
      </div>
    </div>
  </div>
);

const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["ml-orders-view", user?.id],
    enabled: Boolean(user && id),
    queryFn: async () => {
      const { data, error: queryError } = await supabase.from("ml_orders_view").select("*");
      if (queryError) throw queryError;
      const orders = (data ?? []) as MlOrderDetail[];
      if (!isLucasMockOrderUser(user?.email) || !user?.id) return orders;
      return [
        getMockLucasOrder(user.id),
        ...orders.filter((order) => !isMockLucasOrder(order)),
      ] as MlOrderDetail[];
    },
    select: (orders) => orders.find((item) => [item.ml_order_id, item.id, item.external_order_id].some((value) => value === id)) ?? null,
  });

  useEffect(() => {
    if (error) veloToast.error("Não foi possível carregar os detalhes do pedido.");
  }, [error]);

  if (isLoading) return <DetailSkeleton />;

  if (!order) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-indigo-100 bg-white px-6 text-center">
        <Package size={42} strokeWidth={1.5} className="text-indigo-300" />
        <h1 className="mt-4 text-[18px] font-semibold text-slate-950">Pedido não encontrado</h1>
        <p className="mt-1 text-[13px] text-slate-500">Este pedido não existe ou não está disponível para sua conta.</p>
        <button type="button" onClick={() => navigate("/dashboard/pedidos")} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white hover:bg-indigo-700">
          <ArrowLeft size={15} strokeWidth={1.5} />
          Voltar para pedidos
        </button>
      </div>
    );
  }

  const quantity = Math.max(Number(order.quantity ?? 1), 1);
  const total = Number(order.total_amount ?? order.sale_price ?? 0);
  const subtotal = Number(order.subtotal ?? order.total_amount ?? order.sale_price ?? 0);
  const unitPrice = order.sale_price != null ? Number(order.sale_price) : subtotal / quantity;
  const shippingCost = order.shipping_cost;
  const address = getAddress(order);
  const image = getProductImage(order);
  const trackingStage = getTrackingStage(order);
  const trackingSteps = getMobileTrackingSteps(order);

  return (
    <div className="-mx-4 -mt-3 min-h-full bg-white px-4 pb-28 pt-4 sm:-m-6 sm:bg-[#f7f8ff] sm:p-6 lg:-m-7 lg:p-7" style={{ fontFamily: 'Inter, "Geist Sans", ui-sans-serif, system-ui, sans-serif' }}>
      <div className="mx-auto w-full max-w-6xl">
        <button type="button" onClick={() => navigate("/dashboard/pedidos")} className="mb-3 hidden h-9 items-center gap-2 rounded-lg px-1 text-[13px] font-semibold text-slate-500 transition hover:bg-white hover:text-indigo-700 sm:mb-4 sm:inline-flex sm:px-2">
          <ArrowLeft size={16} strokeWidth={1.5} />
          Voltar para pedidos
        </button>

        <section className="space-y-4 sm:hidden">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => navigate("/dashboard/pedidos")} className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-[#050505]" aria-label="Voltar para pedidos">
              <ArrowLeft size={18} strokeWidth={1.8} />
            </button>
            <p className="text-[13px] font-black tracking-[-0.02em] text-[#050505]">Detalhes</p>
            <span className="h-9 w-9" />
          </div>

          <article className="rounded-[24px] bg-white">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F4F4F4]">
                <Package size={19} strokeWidth={1.8} className="text-[#050505]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-black/42">Product ID:</p>
                <p className="mt-1 break-all text-[17px] font-black leading-tight tracking-[-0.04em] text-[#050505]">{getOrderCode(order)}</p>
              </div>
              <span className="rounded-full bg-[#EAF2FF] px-3 py-1.5 text-[11px] font-black text-[#2D67FF]">
                {trackingSteps[trackingStage]?.label ?? getStatusLabel(order.status)}
              </span>
            </div>

            <div className="mt-5">
              <div className="grid grid-cols-[24px_minmax(0,1fr)_24px_minmax(0,1fr)_24px] items-center overflow-visible">
                {trackingSteps.map((step, index) => (
                  <span
                    key={step.label}
                    className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-black ${
                      index < trackingStage
                        ? "bg-[#050505] text-white"
                        : index === trackingStage
                          ? "border-[5px] border-[#050505] bg-white text-transparent"
                          : "bg-[#D8D8D8] text-transparent"
                    }`}
                  >
                    {index < trackingStage ? "✓" : ""}
                  </span>
                )).reduce<ReactNode[]>((nodes, node, index) => {
                  if (index > 0) {
                    nodes.push(
                      <span
                        key={`line-${index}`}
                        className={`relative z-0 -mx-1 ${
                          index <= trackingStage
                            ? "h-1 rounded-full bg-[#050505]"
                            : "h-0 border-t-[3px] border-dashed border-black/20"
                        }`}
                      />,
                    );
                  }
                  nodes.push(node);
                  return nodes;
                }, [])}
              </div>
              <div className="mt-2 grid grid-cols-3 text-[10px] font-black text-[#050505]">
                {trackingSteps.map((step, index) => (
                  <span key={step.label} className={`${index === 1 ? "text-center" : index === 2 ? "text-right" : ""} ${index > trackingStage ? "text-black/35" : ""}`}>
                    {step.label}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-3 text-[10px] font-semibold text-black/42">
                {trackingSteps.map((step, index) => (
                  <span key={step.label} className={index === 1 ? "text-center" : index === 2 ? "text-right" : ""}>
                    {index <= trackingStage ? formatDate(step.date) : "Pendente"}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <SupplierButton url={order.supplier_url} tone="black" />
            </div>
          </article>

          <article className="rounded-[22px] bg-white">
            <div className="rounded-[18px] bg-white p-4 shadow-[0_12px_28px_rgba(20,20,20,0.04)]">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.04em] text-black/55">
                <Truck size={16} strokeWidth={1.8} className="text-[#050505]" />
                Detalhes da entrega
              </p>
              <h2 className="mt-1 text-[18px] font-black tracking-[-0.03em] text-[#050505]">Informações do Cliente</h2>

              <dl className="mt-5 space-y-5">
                <div className="flex gap-3">
                  <UserRound size={18} strokeWidth={1.7} className="mt-1 shrink-0 text-[#050505]" />
                  <div className="min-w-0">
                    <dt className="text-[11px] font-black uppercase tracking-[0.03em] text-black/35">Nome</dt>
                    <dd className="mt-1 break-words text-[14px] font-semibold leading-snug text-[#050505]">{clean(order.buyer_name)}</dd>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Phone size={18} strokeWidth={1.7} className="mt-1 shrink-0 text-[#050505]" />
                  <div className="min-w-0">
                    <dt className="text-[11px] font-black uppercase tracking-[0.03em] text-black/35">Telefone</dt>
                    <dd className="mt-1 break-words text-[14px] font-semibold leading-snug text-[#050505]">{clean(order.buyer_phone)}</dd>
                  </div>
                </div>

                <div className="flex gap-3">
                  <MapPin size={18} strokeWidth={1.7} className="mt-1 shrink-0 text-[#050505]" />
                  <div className="min-w-0">
                    <dt className="text-[11px] font-black uppercase tracking-[0.03em] text-black/35">Endereço completo</dt>
                    <dd className="mt-1 space-y-1 text-[14px] font-semibold leading-snug text-[#050505]">
                      {address.length > 0 ? address.map((line) => <p key={line}>{line}</p>) : <p>—</p>}
                    </dd>
                  </div>
                </div>
              </dl>

              <dl className="hidden">
                <div>
                  <dt className="font-semibold text-black/42">Recebedor</dt>
                  <dd className="mt-1 font-black text-[#050505]">{clean(order.buyer_name)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-black/42">Endereço</dt>
                  <dd className="mt-1 space-y-0.5 font-black leading-snug text-[#050505]">
                    {address.length > 0 ? address.map((line) => <p key={line}>{line}</p>) : <p>—</p>}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="font-semibold text-black/42">Contato</dt>
                    <dd className="mt-1 font-black text-[#050505]">{clean(order.buyer_phone)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-black/42">Valor</dt>
                    <dd className="mt-1 font-black text-[#050505]">{formatBRL(total)}</dd>
                  </div>
                </div>
                <div>
                  <dt className="font-semibold text-black/42">Item</dt>
                  <dd className="mt-1 font-black leading-snug text-[#050505]">{getProductName(order)}</dd>
                </div>
              </dl>
            </div>
          </article>

          <article className="rounded-[22px] bg-[#F6F7FA] p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
                {image ? <img src={image} alt={getProductName(order)} className="h-full w-full object-cover" /> : <Package size={19} strokeWidth={1.7} className="text-black/35" />}
              </span>
              <div className="min-w-0">
                <p className="line-clamp-1 text-[14px] font-black text-[#050505]">{getProductName(order)}</p>
                <p className="mt-1 text-[11px] font-semibold text-black/42">Qtd. {quantity} · {formatBRL(unitPrice)}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[22px] bg-white pt-1">
            <div className="relative">
              {[
                {
                  title: "Aguardando atualização",
                  description: "A entrega será atualizada quando houver novo status.",
                  meta: "Status atual",
                  done: false,
                },
                {
                  title: "Produto pronto para compra",
                  description: "Use o botão Comprar no fornecedor para seguir com o envio.",
                  meta: formatDate(order.date_ready_to_ship ?? order.ordered_at ?? order.created_at),
                  done: true,
                },
                {
                  title: "Pedido confirmado",
                  description: "O pagamento foi confirmado e o pedido entrou na Velo.",
                  meta: formatDate(order.ordered_at ?? order.created_at),
                  done: true,
                },
              ].map((event, index) => (
                <div
                  key={event.title}
                  className="relative flex gap-3 pb-5 last:pb-0"
                >
                  {index < 2 ? (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-[9px] top-6 w-[2px] rounded-full bg-[#D7D7D7]"
                    />
                  ) : null}
                  <span
                    className={`relative z-10 mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                      event.done ? "bg-[#050505] text-white" : "bg-[#D8D8D8] text-transparent ring-4 ring-white"
                    }`}
                  >
                    {event.done ? "✓" : ""}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-black text-[#050505]">{event.title}</p>
                    <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-black/45">{event.description}</p>
                    <p className="mt-1 text-[10px] font-semibold text-black/32">{event.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="hidden">
            {[
              ["Pedido confirmado", "O pagamento foi confirmado e o pedido entrou na Velo."],
              ["Produto pronto para compra", "Use o botão Comprar no fornecedor para seguir com o envio."],
              ["Aguardando atualização", "A entrega será atualizada quando houver novo status."],
            ].map(([title, description], index) => (
              <div key={title} className="flex gap-3">
                <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${index < 2 ? "bg-[#050505] text-white" : "bg-black/10 text-black/35"} text-[11px] font-black`}>
                  {index < 2 ? "✓" : ""}
                </span>
                <div>
                  <p className="text-[12px] font-black text-[#050505]">{title}</p>
                  <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-black/45">{description}</p>
                </div>
              </div>
            ))}
          </article>
        </section>

        <article className="hidden overflow-hidden rounded-[22px] border border-indigo-100/90 bg-white shadow-[0_14px_45px_rgba(79,70,229,0.08)] sm:block sm:rounded-lg">
          <header className="flex flex-col gap-4 border-b border-indigo-100/80 bg-gradient-to-r from-white to-indigo-50/60 px-4 py-5 sm:gap-5 sm:px-7 sm:py-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="break-all text-[19px] font-semibold leading-tight text-slate-950 sm:text-[28px]">Pedido #{getOrderCode(order)}</h1>
                <span className="inline-flex h-7 items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 text-[12px] font-semibold text-indigo-700">
                  {getStatusLabel(order.status)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-slate-500 sm:gap-x-5 sm:text-[13px]">
                <span className="inline-flex items-center gap-2"><CalendarDays size={15} strokeWidth={1.5} />{formatDate(order.ordered_at ?? order.created_at)}</span>
                <span>{quantity} {quantity === 1 ? "item" : "itens"}</span>
              </div>
            </div>
            <SupplierButton url={order.supplier_url} />
          </header>

          <OrderTrackingTimeline
            shipmentStatus={order.shipment_status}
            dateCreated={order.ordered_at ?? order.created_at}
            dateReadyToShip={order.date_ready_to_ship}
            dateShipped={order.date_shipped}
            dateDelivered={order.date_delivered}
          />

          <div className="grid gap-4 bg-[#fbfcff] px-4 py-4 sm:gap-6 sm:px-7 sm:py-8 lg:grid-cols-[0.85fr_1.5fr]">
            <section aria-labelledby="customer-title" className="rounded-2xl border border-indigo-100 bg-white p-4 sm:rounded-lg sm:p-5">
              <p className="text-[11px] font-bold uppercase text-indigo-500">Entrega</p>
              <h2 id="customer-title" className="mt-1 text-[18px] font-semibold text-slate-950">Informações do Cliente</h2>

              <dl className="mt-5 space-y-4">
                <div className="flex gap-3">
                  <UserRound size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-indigo-500" />
                  <div><dt className="text-[11px] font-semibold uppercase text-slate-400">Nome</dt><dd className="mt-1 break-words text-[14px] font-medium text-slate-800">{clean(order.buyer_name)}</dd></div>
                </div>
                <div className="flex gap-3">
                  <Phone size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-indigo-500" />
                  <div><dt className="text-[11px] font-semibold uppercase text-slate-400">Telefone</dt><dd className="mt-1 break-words text-[14px] font-medium text-slate-800">{clean(order.buyer_phone)}</dd></div>
                </div>
                <div className="flex gap-3">
                  <MapPin size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-indigo-500" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-slate-400">Endereço completo</dt>
                    <dd className="mt-1 space-y-0.5 text-[14px] font-medium leading-relaxed text-slate-800">
                      {address.length > 0 ? address.map((line) => <p key={line}>{line}</p>) : <p>—</p>}
                    </dd>
                  </div>
                </div>
              </dl>
            </section>

            <div className="space-y-4 sm:space-y-6">
              <section aria-labelledby="items-title" className="overflow-hidden rounded-2xl border border-indigo-100 bg-white sm:rounded-lg">
                <div className="border-b border-indigo-100 px-4 py-4 sm:px-5">
                  <h2 id="items-title" className="text-[16px] font-semibold text-slate-950">Itens do pedido</h2>
                </div>
                <div className="p-4 sm:hidden">
                  <div className="flex gap-3">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-indigo-50">
                      {image ? <img src={image} alt={getProductName(order)} className="h-full w-full object-cover" /> : <Package size={22} strokeWidth={1.5} className="text-indigo-300" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-3 text-[14px] font-semibold leading-5 text-slate-950">{getProductName(order)}</p>
                      <span className="mt-2 inline-flex h-6 items-center rounded-full bg-indigo-50 px-2.5 text-[11px] font-semibold text-indigo-700">
                        Qtd. {quantity}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Valor unitario</p>
                      <p className="mt-1 text-[14px] font-semibold text-slate-950">{formatBRL(unitPrice)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Subtotal</p>
                      <p className="mt-1 text-[14px] font-semibold text-slate-950">{formatBRL(subtotal)}</p>
                    </div>
                  </div>
                </div>
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[560px] text-left">
                    <thead className="bg-indigo-50/60 text-[11px] font-bold uppercase text-slate-500">
                      <tr><th className="px-5 py-3">Produto</th><th className="px-4 py-3 text-center">Qtd.</th><th className="px-4 py-3 text-right">Valor unitário</th><th className="px-5 py-3 text-right">Subtotal</th></tr>
                    </thead>
                    <tbody>
                      <tr className="text-[13px] text-slate-700">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-indigo-50">
                              {image ? <img src={image} alt={getProductName(order)} className="h-full w-full object-cover" /> : <Package size={20} strokeWidth={1.5} className="text-indigo-300" />}
                            </span>
                            <div className="min-w-0"><p className="line-clamp-2 font-semibold text-slate-900">{getProductName(order)}</p>{order.catalog_product_id && <p className="mt-1 text-[11px] text-slate-400">ID {order.catalog_product_id}</p>}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center font-medium">{quantity}</td>
                        <td className="px-4 py-4 text-right font-medium">{formatBRL(unitPrice)}</td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-950">{formatBRL(subtotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section aria-label="Totais do pedido" className="ml-auto w-full rounded-2xl border border-indigo-100 bg-white p-4 sm:max-w-sm sm:rounded-lg sm:p-5">
                <dl className="space-y-3 text-[13px]">
                  <div className="flex items-center justify-between text-slate-500"><dt>Subtotal</dt><dd className="font-medium text-slate-800">{formatBRL(subtotal)}</dd></div>
                  <div className="flex items-center justify-between text-slate-500"><dt>Frete</dt><dd className="font-medium text-slate-800">{shippingCost == null ? "—" : formatBRL(shippingCost)}</dd></div>
                  <div className="h-px bg-indigo-100" />
                  <div className="flex items-end justify-between"><dt className="font-semibold text-slate-950">Total</dt><dd className="text-[21px] font-semibold text-indigo-700">{formatBRL(total)}</dd></div>
                </dl>
              </section>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
};

export default OrderDetailPage;
