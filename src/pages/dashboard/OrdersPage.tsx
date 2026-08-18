import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronRight,
  ExternalLink,
  MapPin,
  Package,
  ShoppingBag,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { veloToast } from "@/components/ui/velo-toast";
import DashboardPageShell from "@/components/dashboard/DashboardPageShell";


type MlOrderRow = Database["public"]["Views"]["ml_orders_view"]["Row"];

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
  refunded: "Cancelado",
  charged_back: "Estornado",
};

const statusStyles: Record<string, string> = {
  refunded: "border-[#FCA5A5]/60 bg-[#FEE2E2] text-[#B91C1C]",
  charged_back: "border-[#FCA5A5]/60 bg-[#FEE2E2] text-[#B91C1C]",
  cancelled: "border-[#FCA5A5]/60 bg-[#FEE2E2] text-[#B91C1C]",
  canceled: "border-[#FCA5A5]/60 bg-[#FEE2E2] text-[#B91C1C]",
  failed: "border-[#FCA5A5]/60 bg-[#FEE2E2] text-[#B91C1C]",
};

const getStatusStyle = (status: string | null | undefined) =>
  statusStyles[(status ?? "").toLowerCase()] ?? "border-black/[0.08] bg-[#F5F5F5] text-[#404040]";

const pageFont = {
  fontFamily: '"Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif',
};

const formatBRL = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const clean = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text.length > 0 ? text : "—";
};

type ShippingAddress = {
  zip?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

const jsonText = (value: Json | undefined): string | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const normalizeShippingAddress = (value: Json | null | undefined): ShippingAddress | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, Json | undefined>;
  return {
    zip: jsonText(row.zip ?? row.cep ?? row.postal_code),
    street: jsonText(row.street ?? row.address ?? row.rua),
    number: jsonText(row.number ?? row.numero),
    complement: jsonText(row.complement ?? row.complemento),
    neighborhood: jsonText(row.neighborhood ?? row.bairro),
    city: jsonText(row.city ?? row.cidade),
    state: jsonText(row.state ?? row.uf ?? row.estado),
  };
};

const addressLines = (address: ShippingAddress | null) => {
  if (!address) return [];
  const street = [address.street, address.number].filter(Boolean).join(", ");
  const cityState = [address.city, address.state].filter(Boolean).join(" - ");
  return [street, address.complement, address.neighborhood, cityState, address.zip ? `CEP ${address.zip}` : null]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));
};

const addressEntries = (address: ShippingAddress | null) => {
  if (!address) return [];
  const street = [address.street, address.number].filter(Boolean).join(", ");
  const entries = [
    { label: "Rua", value: street },
    { label: "Bairro", value: address.neighborhood },
    { label: "Cidade", value: [address.city, address.state].filter(Boolean).join(" - ") },
    { label: "CEP", value: address.zip },
    { label: "Complemento", value: address.complement },
  ];
  return entries.filter((entry) => entry.value?.trim());
};

const getStatusLabel = (status: string | null | undefined) => {
  const key = (status ?? "pending").toLowerCase();
  return statusLabels[key] ?? clean(status);
};

const getOrderCode = (order: MlOrderRow) => clean(order.ml_order_id ?? order.external_order_id ?? order.id);

const getProductName = (order: MlOrderRow) =>
  clean(order.catalog_title ?? order.product_title);

const getOrderImage = (order: MlOrderRow) => {
  if (order.product_image) return order.product_image;
  if (Array.isArray(order.catalog_images)) {
    const first = order.catalog_images.find((image) => typeof image === "string" && image.trim().length > 0);
    return typeof first === "string" ? first : null;
  }
  return null;
};

const supplierHref = (url: string | null | undefined) => {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  return `https://${trimmed}`;
};

const SupplierButton = ({ url, compact = false }: { url: string | null | undefined; compact?: boolean }) => {
  const href = supplierHref(url);
  const classes = compact
    ? "inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-[#2563EB] px-3 text-[11px] font-semibold text-white transition hover:bg-[#1D4ED8]"
    : "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#2563EB] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1D4ED8]";

  if (!href) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              disabled
              className={`${classes} cursor-not-allowed opacity-40`}
            >
              <ShoppingBag size={15} strokeWidth={1.5} />
              Comprar no Fornecedor
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent className="border-black/10 bg-[#0A0A0A] text-xs text-white">
          Fornecedor não vinculado
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={classes}
      onClick={(event) => event.stopPropagation()}
    >
      <ShoppingBag size={15} strokeWidth={1.5} />
      Comprar no Fornecedor
      <ExternalLink size={14} strokeWidth={1.5} />
    </a>
  );
};

const OrderRow = ({ order, onSelect }: { order: MlOrderRow; onSelect: () => void }) => {
  const image = getOrderImage(order);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        className="cursor-pointer rounded-2xl border border-[#E5E7EB] bg-white p-4 outline-none transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 md:hidden"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-[#EFEFEC]">
            {image ? (
              <img src={image} alt={getProductName(order)} className="h-full w-full object-contain p-1 mix-blend-multiply" />
            ) : (
              <Package size={22} strokeWidth={1.5} className="text-[#A3A3A3]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[14px] font-semibold leading-tight tracking-[-0.03em] text-[#111111]">{getProductName(order)}</p>
            <p className="mt-1 text-[12px] font-medium text-[#777771]">
              Qtd. {clean(order.quantity)} · {formatBRL(order.total_amount ?? order.sale_price)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#8E8E87]">Pedido</p>
            <p className="mt-1 truncate text-[13px] font-semibold tracking-[-0.03em] text-[#111111]">{getOrderCode(order)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#8E8E87]">Comprador</p>
            <p className="mt-1 truncate text-[13px] font-semibold tracking-[-0.03em] text-[#111111]">{clean(order.buyer_name)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#8E8E87]">Status</p>
            <span className={`mt-1 inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-semibold ${getStatusStyle(order.status)}`}>
              {getStatusLabel(order.status)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#8E8E87]">Data</p>
            <p className="mt-1 text-[13px] font-semibold leading-tight text-[#111111]">{formatDate(order.ordered_at ?? order.created_at)}</p>
          </div>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        className="group hidden cursor-pointer grid-cols-1 gap-3 border-b border-[#EFEFEB] bg-white px-4 py-4 outline-none transition hover:bg-[#F7F7F8] focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 md:grid md:grid-cols-[minmax(0,1.7fr)_minmax(130px,0.7fr)_112px_112px_118px_190px_28px] md:items-center"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-[#EFEFEC]">
            {image ? (
              <img src={image} alt={getProductName(order)} className="h-full w-full object-contain p-1 mix-blend-multiply" />
            ) : (
              <Package size={20} strokeWidth={1.5} className="text-[#A3A3A3]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="line-clamp-1 text-[14px] font-semibold tracking-[-0.03em] text-[#111111]">{getProductName(order)}</p>
            <p className="mt-1 text-[12px] text-[#777771]">Qtd. {clean(order.quantity)} · ML {getOrderCode(order)}</p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase text-[#A3A3A3] md:hidden">Comprador</p>
          <p className="truncate text-[13px] font-semibold text-[#0A0A0A]">{clean(order.buyer_name)}</p>
        </div>

        <div>
          <p className="text-[12px] font-medium uppercase text-[#A3A3A3] md:hidden">Status</p>
          <span className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-semibold ${getStatusStyle(order.status)}`}>
            {getStatusLabel(order.status)}
          </span>
        </div>

        <div>
          <p className="text-[12px] font-medium uppercase text-[#A3A3A3] md:hidden">Valor</p>
          <p className="text-[13px] font-semibold text-[#0A0A0A]">{formatBRL(order.total_amount ?? order.sale_price)}</p>
        </div>

        <div>
          <p className="text-[12px] font-medium uppercase text-[#A3A3A3] md:hidden">Data</p>
          <p className="text-[13px] font-medium text-[#525252]">{formatDate(order.ordered_at ?? order.created_at)}</p>
        </div>

        <div className="flex items-center gap-2 md:justify-end">
          <SupplierButton url={order.supplier_url} compact />
        </div>

        <ChevronRight size={18} strokeWidth={1.5} className="hidden text-[#A3A3A3] transition group-hover:translate-x-0.5 group-hover:text-[#0A0A0A] md:block" />
      </div>
    </>
  );
};

const OrderSkeleton = () => (
  <div className="rounded-2xl border border-[#E5E7EB] bg-white">
    {[1, 2, 3, 4].map((item) => (
      <div key={item} className="grid gap-3 border-b border-[#EFEFEB] px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.7fr)_minmax(130px,0.7fr)_112px_112px_118px_190px_28px] md:items-center">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
    ))}
  </div>
);

type OrderTab = "ml" | "loja";

type StoreOrderRow = {
  id: string;
  product_title: string;
  product_image_url: string | null;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  quantity: number;
  total: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  catalog_product_id: string | null;
  supplier_url: string | null;
  shipping_address: Json | null;
};

const StoreOrdersList = ({ userId }: { userId: string }) => {
  const [addressOrder, setAddressOrder] = useState<StoreOrderRow | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["store-orders", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_orders")
        .select("id,product_title,product_image_url,buyer_name,buyer_email,buyer_phone,quantity,total,payment_method,payment_status,created_at,catalog_product_id,shipping_address")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as Omit<StoreOrderRow, "supplier_url">[];
      const ids = Array.from(new Set(rows.map((r) => r.catalog_product_id).filter((v): v is string => Boolean(v))));
      let urlMap = new Map<string, string | null>();
      if (ids.length > 0) {
        const { data: prods } = await supabase
          .from("catalog_products")
          .select("id,product_url")
          .in("id", ids);
        urlMap = new Map((prods ?? []).map((p) => [p.id as string, (p.product_url as string | null) ?? null]));
      }
      return rows.map((r) => ({ ...r, supplier_url: r.catalog_product_id ? urlMap.get(r.catalog_product_id) ?? null : null })) as StoreOrderRow[];
    },
  });

  if (isLoading) return <OrderSkeleton />;
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-[#F7F7F8]/45 p-6 text-center">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#9CA3AF] shadow-[0_10px_24px_rgba(17,17,17,0.06)]">
          <ShoppingBag size={21} strokeWidth={1.7} />
        </div>
        <p className="mt-4 text-[14px] font-semibold tracking-[-0.03em] text-[#111111]">Nenhum pedido da sua loja ainda</p>
        <p className="mt-1 max-w-md text-[12px] font-medium text-[#777771]">
          Quando um cliente comprar em uma das suas páginas de vendas, o pedido aparece aqui automaticamente.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        <div className="hidden grid-cols-[minmax(0,1.45fr)_minmax(140px,0.9fr)_64px_104px_124px_112px_190px] border-b border-[#EFEFEB] bg-[#F7F7F8] px-4 py-3 text-[11px] font-semibold uppercase text-[#777771] md:grid">
          <span>Produto</span>
          <span>Comprador</span>
          <span>Qtd.</span>
          <span>Total</span>
          <span>Pagamento</span>
          <span>Data</span>
          <span className="text-right">Ações</span>
        </div>
        {data.map((order) => {
          const hasAddress = addressLines(normalizeShippingAddress(order.shipping_address)).length > 0;
          return (
            <div key={order.id} className="grid gap-3 border-b border-[#EFEFEB] px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.45fr)_minmax(140px,0.9fr)_64px_104px_124px_112px_190px] md:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[3px] bg-[#EFEFEC]">
                  {order.product_image_url ? <img src={order.product_image_url} alt="" className="h-full w-full object-contain p-1 mix-blend-multiply" /> : <Package size={20} className="text-[#A3A3A3]" />}
                </div>
                <p className="line-clamp-1 text-[14px] font-semibold tracking-[-0.03em] text-[#111111]">{order.product_title}</p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-[#0A0A0A]">{order.buyer_name}</p>
                <p className="truncate text-[11px] text-[#737373]">{order.buyer_email}</p>
                {order.buyer_phone ? <p className="truncate text-[11px] text-[#737373]">{order.buyer_phone}</p> : null}
                <button
                  type="button"
                  onClick={() => setAddressOrder(order)}
                  disabled={!hasAddress}
                  className="mt-2 inline-flex h-7 items-center justify-center gap-1.5 rounded-full border border-[#C7D7FE] bg-[#EFF6FF] px-2.5 text-[11px] font-semibold text-[#2563EB] transition hover:border-[#9DB8FD] hover:bg-[#E7F0FF] disabled:cursor-not-allowed disabled:border-[#E5E7EB] disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]"
                >
                  <MapPin size={13} strokeWidth={1.8} />
                  Endereço
                </button>
              </div>
              <p className="text-[13px] text-[#525252]">{order.quantity}</p>
              <p className="text-[13px] font-semibold text-[#0A0A0A]">{formatBRL(order.total)}</p>
              <span className={`inline-flex h-7 w-fit items-center rounded-full px-2.5 text-[12px] font-semibold ${order.payment_status === "approved" ? "bg-[#C8F7DF] text-[#137443]" : order.payment_status === "rejected" ? "bg-red-100 text-red-700" : "bg-[#F5F5F5] text-[#404040]"}`}>
                {order.payment_method === "pix" ? "Pix" : "Cartão"} · {order.payment_status === "approved" ? "Pago" : order.payment_status === "rejected" ? "Rejeitado" : "Pendente"}
              </span>
              <p className="text-[13px] text-[#525252]">{formatDate(order.created_at)}</p>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <SupplierButton url={order.supplier_url} compact />
              </div>
            </div>
          );
        })}
      </div>
      <StoreOrderAddressModal order={addressOrder} onClose={() => setAddressOrder(null)} />
    </>
  );
};

const StoreOrderAddressModal = ({ order, onClose }: { order: StoreOrderRow | null; onClose: () => void }) => {
  if (!order) return null;

  const address = normalizeShippingAddress(order.shipping_address);
  const entries = addressEntries(address);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#020817]/45 px-4 backdrop-blur-[3px]">
      <div className="w-full max-w-lg overflow-hidden rounded-[24px] border border-[#D8E3F8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
        <div className="h-1.5 bg-[#2563EB]" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#2563EB] text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)]">
                <MapPin size={17} strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[18px] font-black tracking-[-0.035em] text-[#020817]">Endereço de entrega</h2>
                <p className="mt-0.5 truncate text-[12px] font-medium text-[#64748B]">{order.product_title}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[#64748B] transition hover:bg-[#EFF6FF] hover:text-[#2563EB]" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 rounded-[18px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#64748B]">Comprador</p>
            <p className="mt-2 text-[14px] font-black tracking-[-0.02em] text-[#020817]">{order.buyer_name}</p>
            <p className="mt-1 text-[12px] font-medium text-[#64748B]">{order.buyer_email}</p>
            {order.buyer_phone ? <p className="mt-1 text-[12px] font-medium text-[#64748B]">{order.buyer_phone}</p> : null}
          </div>

          <div className="mt-4 rounded-[18px] border border-[#D8E3F8] bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#2563EB]">Entrega</p>
            <div className="mt-3 space-y-2.5">
              {entries.length > 0 ? (
                entries.map((entry) => (
                  <div key={entry.label} className="grid grid-cols-[86px_minmax(0,1fr)] gap-3 text-[13px] leading-snug">
                    <span className="font-black uppercase tracking-[0.08em] text-[#94A3B8]">{entry.label}</span>
                    <span className="font-semibold text-[#020817]">{entry.value}</span>
                  </div>
                ))
              ) : (
                <p className="text-[14px] font-semibold text-[#020817]">Endereço não informado.</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 flex h-11 w-full items-center justify-center rounded-[14px] bg-[#2563EB] text-[13px] font-black text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] transition hover:bg-[#1D4ED8]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

const OrdersPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<OrderTab>("ml");
  const syncedRef = useRef(false);

  const triggerSync = useMemo(
    () => () => {
      if (!user?.id) return;
      supabase.functions
        .invoke("ml-sync-orders")
        .then(({ error: syncErr }) => {
          if (syncErr) {
            console.warn("[OrdersPage] ml-sync-orders falhou", syncErr);
            return;
          }
          queryClient.invalidateQueries({ queryKey: ["ml-orders-view", user.id] });
          queryClient.invalidateQueries({ queryKey: ["store-orders", user.id] });
        })
        .catch((err) => console.warn("[OrdersPage] ml-sync-orders exception", err));
    },
    [user?.id, queryClient],
  );

  // Initial sync on mount
  useEffect(() => {
    if (!user?.id || syncedRef.current) return;
    syncedRef.current = true;
    triggerSync();
  }, [user?.id, triggerSync]);

  // Periodic sync every 45s while page is visible
  useEffect(() => {
    if (!user?.id) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") triggerSync();
    }, 45_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") triggerSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id, triggerSync]);

  // Realtime subscription: invalidate queries on any change
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`orders-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ml-orders-view", user.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_orders", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["store-orders", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);


  const {
    data: rawOrders,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["ml-orders-view", user?.id],
    enabled: !!user?.id,
    // Verifica continuamente se surgiram pedidos da conta de vendedor conectada
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user?.id) return [];

      // Sellers ML conectados nesta conta (pedidos podem ter sido gravados em outra conta Velo
      // que usa o mesmo seller — trazemos todos eles).
      const { data: integrations } = await supabase
        .from("user_integrations")
        .select("ml_user_id")
        .eq("user_id", user.id)
        .eq("platform", "mercadolivre");

      const sellerIds = Array.from(
        new Set(
          (integrations ?? [])
            .map((row) => (row.ml_user_id == null ? null : String(row.ml_user_id)))
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const filters = [`user_id.eq.${user.id}`];
      if (sellerIds.length > 0) {
        filters.push(`ml_user_id.in.(${sellerIds.join(",")})`);
      }

      const { data, error: queryError } = await supabase
        .from("ml_orders_view")
        .select("*")
        .or(filters.join(","))
        .order("ordered_at", { ascending: false, nullsFirst: false })
        .limit(2000);
      if (queryError) throw queryError;

      // Deduplica caso o mesmo pedido apareça por mais de um critério
      const seen = new Set<string>();
      return (data ?? []).filter((row) => {
        const key = String(row.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  });


  useEffect(() => {
    if (error) {
      veloToast.error("Não foi possível carregar seus pedidos.");
    }
  }, [error]);

  const orders = useMemo(
    () => {
      const baseOrders = [...(rawOrders ?? [])];

      return baseOrders.sort((a, b) => {
        const left = new Date(a.ordered_at ?? a.created_at ?? 0).getTime();
        const right = new Date(b.ordered_at ?? b.created_at ?? 0).getTime();
        return right - left;
      });
    },
    [rawOrders, user?.email, user?.id],
  );

  const isEmpty = !isLoading && orders.length === 0;
  const activeTabCount = tab === "ml" ? orders.length : 0;

  return (
    <TooltipProvider delayDuration={120}>
      <DashboardPageShell
        title="Pedidos"
        className="overflow-visible"
        panelClassName="overflow-visible"
        style={pageFont}
      >

        <div className="mobile-hide-scrollbar mb-5 flex gap-2 overflow-x-auto md:mb-7 md:items-center xl:overflow-visible" data-dashboard-tour="pedidos-filtros">
          <div className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 text-[12px] font-semibold text-[#111111] shadow-[0_8px_18px_rgba(17,17,17,0.035)]">
            <Calendar size={14} strokeWidth={1.8} className="text-[#8E8E87]" />
            <span>{activeTabCount}</span>
            <span className="text-[#8E8E87]">{activeTabCount === 1 ? "pedido" : "pedidos"}</span>
          </div>

          <div className="inline-flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("ml")}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[12px] font-semibold transition-all duration-200 ${
                tab === "ml"
                  ? "border-[#2563EB] bg-[#2563EB] text-white shadow-[0_6px_14px_rgba(37,99,235,0.16)]"
                  : "border-black/[0.08] bg-white text-[#111111] hover:border-black/15 hover:bg-[#F7F7F8]"
              }`}
            >
              <span className={tab === "ml" ? "text-white/65" : "text-[#8E8E87]"}>Canal</span>
              <span>Mercado Livre</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("loja")}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[12px] font-semibold transition-all duration-200 ${
                tab === "loja"
                  ? "border-[#2563EB] bg-[#2563EB] text-white shadow-[0_6px_14px_rgba(37,99,235,0.16)]"
                  : "border-black/[0.08] bg-white text-[#111111] hover:border-black/15 hover:bg-[#F7F7F8]"
              }`}
            >
              <span className={tab === "loja" ? "text-white/65" : "text-[#8E8E87]"}>Canal</span>
              <span>Minha Loja</span>
            </button>
          </div>

          <div className="hidden xl:block xl:flex-1" />
        </div>

        {tab === "loja" && user?.id ? (
          <StoreOrdersList userId={user.id} />
        ) : isLoading ? (
          <OrderSkeleton />
        ) : isEmpty ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-[#F7F7F8]/45 p-6 text-center">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#9CA3AF] shadow-[0_10px_24px_rgba(17,17,17,0.06)]">
              <ShoppingBag size={21} strokeWidth={1.7} />
            </div>
            <p className="mt-4 text-[14px] font-semibold tracking-[-0.03em] text-[#111111]">Nenhum pedido encontrado</p>
            <p className="mt-1 max-w-md text-[12px] font-medium text-[#777771]">
              Seus pedidos do Mercado Livre aparecerão aqui quando a sincronização registrar vendas na view.
            </p>
          </div>
        ) : (
          <div data-dashboard-tour="pedidos-lista" className="space-y-3 bg-transparent md:space-y-0 md:overflow-hidden md:rounded-2xl md:border md:border-[#E5E7EB] md:bg-white">
            <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(130px,0.7fr)_112px_112px_118px_190px_28px] border-b border-[#EFEFEB] bg-[#F7F7F8] px-4 py-3 text-[11px] font-semibold uppercase text-[#777771] md:grid">
              <span>Produto</span>
              <span>Comprador</span>
              <span>Status</span>
              <span>Valor</span>
              <span>Data</span>
              <span className="text-right">Fornecedor</span>
              <span />
            </div>
            {orders.map((order) => (
              <OrderRow
                key={order.id ?? `${order.ml_order_id}-${order.created_at}`}
                order={order}
                onSelect={() => {
                  const routeId = order.ml_order_id ?? order.id ?? order.external_order_id;
                  if (routeId) navigate(`/dashboard/orders/${encodeURIComponent(routeId)}`);
                  else veloToast.error("Este pedido não possui um identificador válido.");
                }}
              />
            ))}
          </div>
        )}
      </DashboardPageShell>
    </TooltipProvider>
  );
};

export default OrdersPage;
