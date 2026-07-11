import { useEffect } from "react";
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
  UserRound,
} from "lucide-react";
import OrderTrackingTimeline from "@/components/dashboard/OrderTrackingTimeline";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { veloToast } from "@/components/ui/velo-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

const SupplierButton = ({ url }: { url: string | null | undefined }) => {
  const href = supplierHref(url);
  const classes = "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition";

  if (!href) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" tabIndex={0}>
            <button type="button" disabled className={`${classes} cursor-not-allowed bg-indigo-300 text-white`}>
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
    <a href={href} target="_blank" rel="noreferrer" className={`${classes} bg-indigo-600 text-white shadow-[0_8px_22px_rgba(79,70,229,0.20)] hover:bg-indigo-700`}>
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
      return (data ?? []) as MlOrderDetail[];
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

  return (
    <div className="-m-5 min-h-full bg-[#f7f8ff] p-5 sm:-m-6 sm:p-6 lg:-m-7 lg:p-7" style={{ fontFamily: 'Inter, "Geist Sans", ui-sans-serif, system-ui, sans-serif' }}>
      <div className="mx-auto w-full max-w-6xl">
        <button type="button" onClick={() => navigate("/dashboard/pedidos")} className="mb-4 inline-flex h-9 items-center gap-2 rounded-lg px-2 text-[13px] font-semibold text-slate-500 transition hover:bg-white hover:text-indigo-700">
          <ArrowLeft size={16} strokeWidth={1.5} />
          Voltar para pedidos
        </button>

        <article className="overflow-hidden rounded-lg border border-indigo-100/90 bg-white shadow-[0_14px_45px_rgba(79,70,229,0.08)]">
          <header className="flex flex-col gap-5 border-b border-indigo-100/80 bg-gradient-to-r from-white to-indigo-50/60 px-5 py-6 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="break-all text-[24px] font-semibold text-slate-950 sm:text-[28px]">Pedido #{getOrderCode(order)}</h1>
                <span className="inline-flex h-7 items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 text-[12px] font-semibold text-indigo-700">
                  {getStatusLabel(order.status)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-slate-500">
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

          <div className="grid gap-6 bg-[#fbfcff] px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[0.85fr_1.5fr]">
            <section aria-labelledby="customer-title" className="rounded-lg border border-indigo-100 bg-white p-5">
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

            <div className="space-y-6">
              <section aria-labelledby="items-title" className="overflow-hidden rounded-lg border border-indigo-100 bg-white">
                <div className="border-b border-indigo-100 px-5 py-4">
                  <h2 id="items-title" className="text-[16px] font-semibold text-slate-950">Itens do pedido</h2>
                </div>
                <div className="overflow-x-auto">
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

              <section aria-label="Totais do pedido" className="ml-auto w-full rounded-lg border border-indigo-100 bg-white p-5 sm:max-w-sm">
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
