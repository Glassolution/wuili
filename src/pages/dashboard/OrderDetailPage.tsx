import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Mail,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { veloToast } from "@/components/ui/velo-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type MlOrderRow = Database["public"]["Views"]["ml_orders_view"]["Row"];

type ExtraFields = {
  shipment_status?: string | null;
  date_ready_to_ship?: string | null;
  date_shipped?: string | null;
  date_delivered?: string | null;
  shipping_cost?: number | null;
  subtotal?: number | null;
};

type MlOrderDetail = MlOrderRow & ExtraFields;

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
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const clean = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
};

const getOrderCode = (o: MlOrderDetail) => clean(o.ml_order_id ?? o.external_order_id ?? o.id);
const getProductName = (o: MlOrderDetail) => clean(o.catalog_title ?? o.product_title);
const getProductImage = (o: MlOrderDetail) => {
  if (o.product_image) return o.product_image;
  if (!Array.isArray(o.catalog_images)) return null;
  const first = o.catalog_images.find((v) => typeof v === "string" && v.trim());
  return typeof first === "string" ? first : null;
};

const supplierHref = (value: string | null | undefined) => {
  const url = value?.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
  return `https://${url}`;
};

const getAddress = (o: MlOrderDetail) => {
  const street = [o.buyer_address, o.buyer_number ? `nº ${o.buyer_number}` : null, o.buyer_complement]
    .filter((p): p is string => Boolean(p?.trim()))
    .join(", ");
  const location = [o.buyer_neighborhood, o.buyer_city, o.buyer_state]
    .filter((p): p is string => Boolean(p?.trim()))
    .join(" - ");
  return [street, location, o.buyer_zip ? `CEP ${o.buyer_zip}` : null].filter(Boolean) as string[];
};

const getTrackingStage = (o: MlOrderDetail): number => {
  const status = (o.status ?? "").toLowerCase();
  const ship = (o.shipment_status ?? "").toLowerCase();
  if (o.date_delivered || ["delivered", "completed"].includes(status) || ship === "delivered") return 3;
  if (o.date_shipped || ["shipped", "in_transit"].includes(status) || ["shipped", "in_transit"].includes(ship)) return 2;
  if (o.date_ready_to_ship || ship === "ready_to_ship") return 1;
  return 0;
};

const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["ml-order-detail", user?.id, id],
    enabled: Boolean(user && id),
    queryFn: async () => {
      const { data, error: qErr } = await supabase.from("ml_orders_view").select("*").eq("user_id", user!.id);
      if (qErr) throw qErr;
      const rows = (data ?? []) as MlOrderDetail[];
      return rows.find((r) => [r.ml_order_id, r.id, r.external_order_id].some((v) => v === id)) ?? null;
    },
  });

  useEffect(() => {
    if (error) veloToast.error("Não foi possível carregar os detalhes do pedido.");
  }, [error]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto flex min-h-[420px] w-full max-w-5xl flex-col items-center justify-center rounded-2xl border border-black/[0.08] bg-white px-6 text-center">
        <Package size={42} strokeWidth={1.5} className="text-[#A3A3A3]" />
        <h1 className="mt-4 text-[18px] font-semibold text-[#0A0A0A]">Pedido não encontrado</h1>
        <p className="mt-1 text-[13px] text-[#737373]">Este pedido não existe ou não está disponível para sua conta.</p>
        <button
          type="button"
          onClick={() => navigate("/dashboard/pedidos")}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#0A0A0A] px-4 text-[13px] font-semibold text-white hover:bg-black/90"
        >
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
  const shippingCost = Number(order.shipping_cost ?? 0);
  const discount = Math.max(0, subtotal + shippingCost - total);
  const address = getAddress(order);
  const image = getProductImage(order);
  const stage = getTrackingStage(order);
  const supplier = supplierHref(order.supplier_url);

  const steps = [
    { label: "Pedido recebido", date: order.ordered_at ?? order.created_at },
    { label: "Pedido preparado", date: order.date_ready_to_ship },
    { label: "Em trânsito", date: order.date_shipped },
    { label: "Entregue", date: order.date_delivered },
  ];

  const statusLabel = statusLabels[(order.status ?? "pending").toLowerCase()] ?? clean(order.status);

  return (
    <div
      className="min-h-full bg-[#FAFAFA] px-4 pb-16 pt-4 sm:px-6 sm:pt-6"
      style={{ fontFamily: 'Inter, "Geist Sans", ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="mx-auto w-full max-w-5xl">
        <button
          type="button"
          onClick={() => navigate("/dashboard/pedidos")}
          className="mb-4 inline-flex h-9 items-center gap-2 rounded-lg px-2 text-[13px] font-semibold text-[#525252] transition hover:bg-white hover:text-[#0A0A0A]"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          Voltar para pedidos
        </button>

        {/* Header */}
        <div className="text-center">
          <h1 className="text-[26px] font-semibold tracking-tight text-[#0A0A0A]">Detalhes do Pedido</h1>
          <p className="mx-auto mt-2 max-w-xl text-[13px] text-[#737373]">
            Acompanhe todas as informações do cliente e do pedido para realizar a compra com o fornecedor.
          </p>
        </div>

        {/* Order Details card */}
        <section className="mt-8 rounded-2xl border border-black/[0.08] bg-white p-6 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[16px] font-semibold text-[#0A0A0A]">Detalhes do pedido</h2>
            {supplier ? (
              <a
                href={supplier}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0A0A0A] px-4 text-[13px] font-semibold text-white transition hover:bg-black/90"
              >
                <ShoppingBag size={15} strokeWidth={1.7} />
                Ver no Fornecedor
                <ExternalLink size={13} strokeWidth={1.7} />
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-black/30 px-4 text-[13px] font-semibold text-white"
              >
                <ShoppingBag size={15} strokeWidth={1.7} />
                Fornecedor indisponível
              </button>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-y-5 sm:grid-cols-4 lg:grid-cols-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">Nº do pedido</p>
              <p className="mt-1.5 text-[14px] font-semibold text-[#0A0A0A]">#{getOrderCode(order)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">Data do pedido</p>
              <p className="mt-1.5 text-[14px] font-semibold text-[#0A0A0A]">{formatDate(order.ordered_at ?? order.created_at)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">Entrega</p>
              <p className="mt-1.5 text-[14px] font-semibold text-[#0A0A0A]">{formatDate(order.date_delivered)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">Itens</p>
              <p className="mt-1.5 text-[14px] font-semibold text-[#0A0A0A]">{quantity} {quantity === 1 ? "item" : "itens"}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">Status</p>
              <p className="mt-1.5 text-[14px] font-semibold text-[#0A0A0A]">{statusLabel}</p>
            </div>
          </div>
        </section>

        {/* Tracking */}
        <section className="mt-5 rounded-2xl border border-black/[0.08] bg-white p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[#0A0A0A]">Rastreamento</h2>
            <p className="text-[12px] text-[#737373]">ID do pedido: #{getOrderCode(order)}</p>
          </div>

          <div className="mt-8 rounded-xl border border-black/[0.06] bg-[#FAFAFA] px-4 py-8 sm:px-8">
            <div className="grid grid-cols-4 items-center gap-2">
              {steps.map((step, i) => (
                <div key={step.label} className="relative flex flex-col items-center">
                  {i > 0 && (
                    <div
                      className={`absolute right-1/2 top-4 h-[2px] w-full ${
                        i <= stage ? "bg-[#0A0A0A]" : "bg-[#E5E5E5]"
                      }`}
                    />
                  )}
                  <div
                    className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold ${
                      i < stage
                        ? "bg-[#0A0A0A] text-white"
                        : i === stage
                          ? "bg-[#0A0A0A] text-white"
                          : "bg-white text-[#A3A3A3] ring-1 ring-inset ring-[#E5E5E5]"
                    }`}
                  >
                    {i < stage ? <Check size={16} strokeWidth={2.5} /> : i + 1}
                  </div>
                  <p
                    className={`mt-3 text-center text-[12px] font-semibold ${
                      i <= stage ? "text-[#0A0A0A]" : "text-[#A3A3A3]"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="mt-1 text-center text-[11px] text-[#737373]">{formatDate(step.date)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Customer info */}
        <section className="mt-5 rounded-2xl border border-black/[0.08] bg-white p-6 sm:p-7">
          <h2 className="text-[16px] font-semibold text-[#0A0A0A]">Informações do cliente</h2>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F5]">
                <UserRound size={16} strokeWidth={1.8} className="text-[#0A0A0A]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">Nome</p>
                <p className="mt-1 break-words text-[14px] font-semibold text-[#0A0A0A]">{clean(order.buyer_name)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F5]">
                <Phone size={16} strokeWidth={1.8} className="text-[#0A0A0A]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">Telefone</p>
                <p className="mt-1 break-words text-[14px] font-semibold text-[#0A0A0A]">{clean(order.buyer_phone)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F5]">
                <Mail size={16} strokeWidth={1.8} className="text-[#0A0A0A]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">E-mail</p>
                <p className="mt-1 break-words text-[14px] font-semibold text-[#0A0A0A]">{clean(order.buyer_email)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F5]">
                <MapPin size={16} strokeWidth={1.8} className="text-[#0A0A0A]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">Endereço de entrega</p>
                <div className="mt-1 space-y-0.5 text-[14px] font-semibold leading-snug text-[#0A0A0A]">
                  {address.length > 0 ? address.map((line) => <p key={line}>{line}</p>) : <p>—</p>}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Items */}
        <section className="mt-5 rounded-2xl border border-black/[0.08] bg-white p-6 sm:p-7">
          <h2 className="text-[16px] font-semibold text-[#0A0A0A]">Itens do pedido</h2>

          <div className="mt-5 overflow-hidden rounded-xl border border-black/[0.06]">
            <div className="hidden grid-cols-[minmax(0,1fr)_100px_100px_120px] items-center gap-4 border-b border-black/[0.06] bg-[#FAFAFA] px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-[#737373] sm:grid">
              <span>Produto</span>
              <span className="text-center">Quantidade</span>
              <span className="text-right">Unitário</span>
              <span className="text-right">Total</span>
            </div>
            <div className="grid grid-cols-1 items-center gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_100px_100px_120px]">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F5F5F5]">
                  {image ? (
                    <img src={image} alt={getProductName(order)} className="h-full w-full object-cover" />
                  ) : (
                    <Package size={20} strokeWidth={1.5} className="text-[#A3A3A3]" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[14px] font-semibold text-[#0A0A0A]">{getProductName(order)}</p>
                  <p className="mt-1 text-[12px] text-[#737373]">ID do produto: {clean(order.ml_item_id)}</p>
                </div>
              </div>
              <p className="text-[13px] font-semibold text-[#0A0A0A] sm:text-center">{String(quantity).padStart(2, "0")}</p>
              <p className="text-[13px] text-[#525252] sm:text-right">{formatBRL(unitPrice)}</p>
              <p className="text-[14px] font-semibold text-[#0A0A0A] sm:text-right">{formatBRL(unitPrice * quantity)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-black/[0.06] p-5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#737373]">Desconto</span>
                <span className="font-semibold text-[#0A0A0A]">{formatBRL(discount)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[13px]">
                <span className="text-[#737373]">Entrega</span>
                <span className="font-semibold text-[#0A0A0A]">{formatBRL(shippingCost)}</span>
              </div>
            </div>
            <div className="rounded-xl border border-black/[0.06] p-5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#737373]">Subtotal</span>
                <span className="font-semibold text-[#0A0A0A]">{formatBRL(subtotal)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-3 text-[15px]">
                <span className="font-semibold text-[#0A0A0A]">Total</span>
                <span className="font-semibold text-[#0A0A0A]">{formatBRL(total)}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default OrderDetailPage;
