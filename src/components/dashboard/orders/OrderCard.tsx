import { useState } from "react";
import {
  Package, MapPin, Phone, User, Copy, Check, ExternalLink,
  Truck, Clock, CheckCircle2, XCircle, ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

export type OrderRow = {
  id: string;
  user_id: string;
  external_order_id: string | null;
  platform: string;
  product_title: string;
  product_image: string | null;
  quantity: number;
  buyer_name: string | null;
  buyer_address: string | null;
  buyer_city: string | null;
  buyer_state: string | null;
  buyer_zip: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  sale_price: number;
  cost_price: number | null;
  profit: number | null;
  status: string;
  fulfillment_status: string | null;
  tracking_code: string | null;
  cj_product_id: string | null;
  cj_order_id: string | null;
  ordered_at: string | null;
  created_at: string;
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const PLATFORM_LABEL: Record<string, string> = {
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
};

type StatusInfo = { label: string; icon: React.ElementType; className: string };

const getStatusInfo = (status: string): StatusInfo => {
  switch (status) {
    case "delivered":
      return { label: "Entregue", icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "shipped":
    case "fulfilled":
      return { label: "Enviado", icon: Truck, className: "bg-blue-50 text-blue-700 border-blue-200" };
    case "cancelled":
      return { label: "Cancelado", icon: XCircle, className: "bg-red-50 text-red-600 border-red-200" };
    case "paid":
    case "pending":
    default:
      return { label: "Aguardando envio", icon: Clock, className: "bg-amber-50 text-amber-700 border-amber-200" };
  }
};

const buildFullAddress = (o: OrderRow): string => {
  const parts = [
    o.buyer_name,
    o.buyer_address,
    o.buyer_city && o.buyer_state ? `${o.buyer_city} - ${o.buyer_state}` : (o.buyer_city || o.buyer_state),
    o.buyer_zip ? `CEP ${o.buyer_zip}` : null,
    o.buyer_phone ? `Tel: ${o.buyer_phone}` : null,
  ].filter(Boolean);
  return parts.join("\n");
};

const Field = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <div className="flex items-start gap-2.5">
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <Icon size={13} />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xs text-foreground mt-0.5 break-words">{value || "—"}</p>
    </div>
  </div>
);

export const OrderCard = ({ order }: { order: OrderRow }) => {
  const [copied, setCopied] = useState(false);
  const status = getStatusInfo(order.fulfillment_status || order.status);
  const StatusIcon = status.icon;

  const fullAddress = [
    order.buyer_address,
    order.buyer_city && order.buyer_state ? `${order.buyer_city} - ${order.buyer_state}` : (order.buyer_city || order.buyer_state),
    order.buyer_zip ? `CEP ${order.buyer_zip}` : null,
  ].filter(Boolean).join(", ") || "Endereço não informado";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildFullAddress(order));
      setCopied(true);
      toast.success("Endereço copiado!", { description: "Cole agora no formulário da CJ." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o endereço.");
    }
  };

  const handleSendCJ = () => {
    if (!order.cj_product_id) {
      toast.error("Produto sem ID da CJ", {
        description: "Não conseguimos abrir o produto automaticamente. Use o ID manualmente.",
      });
      return;
    }
    const url = `https://cjdropshipping.com/product-detail.html?productId=${order.cj_product_id}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:border-foreground/20 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono text-muted-foreground bg-background border border-border rounded px-1.5 py-0.5">
            #{order.external_order_id || order.id.slice(0, 8)}
          </span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {PLATFORM_LABEL[order.platform] ?? order.platform}
          </span>
          <span className="text-[10px] text-muted-foreground">· {formatDate(order.ordered_at)}</span>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
          <StatusIcon size={11} />
          {status.label}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* Produto */}
        <div className="flex gap-3">
          <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center">
            {order.product_image
              ? <img src={order.product_image} alt={order.product_title} className="w-full h-full object-cover" loading="lazy" />
              : <Package size={20} className="text-muted-foreground/40" />
            }
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground line-clamp-2">{order.product_title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><ShoppingBag size={11} /> {order.quantity}x</span>
              <span className="font-semibold text-foreground">{formatBRL(order.sale_price)}</span>
              {order.profit != null && (
                <span className={order.profit >= 0 ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>
                  Lucro {formatBRL(order.profit)}
                </span>
              )}
            </div>
            {order.tracking_code && (
              <p className="mt-1.5 text-[11px] font-mono bg-muted rounded px-1.5 py-0.5 inline-block text-foreground">
                Rastreio: {order.tracking_code}
              </p>
            )}
          </div>
        </div>

        {/* Comprador / Endereço */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field icon={User} label="Comprador" value={order.buyer_name || "—"} />
          <Field icon={Phone} label="Telefone" value={order.buyer_phone || "—"} />
          <div className="sm:col-span-2">
            <Field icon={MapPin} label="Endereço" value={fullAddress} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-border bg-muted/20">
        <button
          onClick={handleSendCJ}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <ExternalLink size={13} />
          Enviar pela CJ
        </button>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          {copied ? "Copiado!" : "Copiar endereço"}
        </button>
        {order.cj_order_id && (
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">
            CJ #{order.cj_order_id}
          </span>
        )}
      </div>
    </div>
  );
};
