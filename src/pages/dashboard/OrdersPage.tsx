import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronRight,
  ExternalLink,
  Package,
  ShoppingBag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { veloToast } from "@/components/ui/velo-toast";

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
};

const pageFont = {
  fontFamily: 'Inter, "Geist Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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

const getStatusLabel = (status: string | null | undefined) => {
  const key = (status ?? "pending").toLowerCase();
  return statusLabels[key] ?? clean(status);
};

const mockOrderEmail = "lucassrby@gmail.com";

const getMockLucasOrder = (userId: string): MlOrderRow => ({
  id: "mock-lucassrby-order-001",
  user_id: userId,
  ml_order_id: "ML-MOCK-20260712-001",
  ml_user_id: "lucas-demo-ml",
  external_order_id: "VELO-MOCK-001",
  shipment_id: "SHIP-MOCK-001",
  status: "paid",
  fulfillment_status: "pending",
  sale_price: 189.9,
  total_amount: 189.9,
  cost_price: 82.4,
  profit: 107.5,
  quantity: 1,
  ordered_at: "2026-07-12T14:20:00.000Z",
  created_at: "2026-07-12T14:20:00.000Z",
  product_title: "Fone de ouvido Bluetooth TWS E10 Pro",
  product_image: "/placeholder.svg",
  buyer_name: "Cliente Mercado Livre",
  buyer_email: "cliente.demo@mercadolivre.com",
  buyer_phone: "(11) 99999-0000",
  buyer_address: "Rua das Palmeiras",
  buyer_number: "120",
  buyer_complement: "Apto 42",
  buyer_neighborhood: "Centro",
  buyer_city: "Sao Paulo",
  buyer_state: "SP",
  buyer_zip: "01000-000",
  tracking_code: "BR123456789MOCK",
  catalog_product_id: null,
  supplier_url: null,
  supplier_name: "Fornecedor Velo",
  catalog_title: null,
  catalog_images: null,
});

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
    ? "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3 text-[12px] font-semibold text-[#0A0A0A] transition hover:border-black/[0.18] hover:bg-black/[0.02]"
    : "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0A0A0A] px-4 text-[13px] font-semibold text-white transition hover:bg-black/90";

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
      className="group grid cursor-pointer grid-cols-1 gap-3 border-b border-black/[0.06] bg-white px-4 py-4 outline-none transition hover:bg-[#FAFAFA] focus-visible:ring-2 focus-visible:ring-black/20 md:grid-cols-[minmax(0,1.7fr)_minmax(130px,0.7fr)_112px_112px_118px_190px_28px] md:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F5F5F5]">
          {image ? (
            <img src={image} alt={getProductName(order)} className="h-full w-full object-cover" />
          ) : (
            <Package size={20} strokeWidth={1.5} className="text-[#A3A3A3]" />
          )}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-1 text-[14px] font-semibold text-[#0A0A0A]">{getProductName(order)}</p>
          <p className="mt-1 text-[12px] text-[#737373]">Qtd. {clean(order.quantity)} · ML {getOrderCode(order)}</p>
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-[12px] font-medium uppercase text-[#A3A3A3] md:hidden">Comprador</p>
        <p className="truncate text-[13px] font-semibold text-[#0A0A0A]">{clean(order.buyer_name)}</p>
      </div>

      <div>
        <p className="text-[12px] font-medium uppercase text-[#A3A3A3] md:hidden">Status</p>
        <span className="inline-flex h-7 items-center rounded-full border border-black/[0.08] bg-[#F5F5F5] px-2.5 text-[12px] font-semibold text-[#404040]">
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
  );
};

const OrderSkeleton = () => (
  <div className="rounded-xl border border-black/[0.08] bg-white">
    {[1, 2, 3, 4].map((item) => (
      <div key={item} className="grid gap-3 border-b border-black/[0.06] px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.7fr)_minmax(130px,0.7fr)_112px_112px_118px_190px_28px] md:items-center">
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

const OrdersPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    data: rawOrders,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["ml-orders-view", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error: queryError } = await supabase
        .from("ml_orders_view")
        .select("*")
        .eq("user_id", user.id)
        .order("ordered_at", { ascending: false, nullsFirst: false })
        .limit(2000);
      if (queryError) throw queryError;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (error) {
      veloToast.error("Não foi possível carregar seus pedidos.");
    }
  }, [error]);

  const orders = useMemo(
    () => {
      const email = user?.email?.trim().toLowerCase();
      const baseOrders =
        email === mockOrderEmail && user?.id
          ? [
              getMockLucasOrder(user.id),
              ...(rawOrders ?? []).filter((order) => order.id !== "mock-lucassrby-order-001"),
            ]
          : [...(rawOrders ?? [])];

      return baseOrders.sort((a, b) => {
        const left = new Date(a.ordered_at ?? a.created_at ?? 0).getTime();
        const right = new Date(b.ordered_at ?? b.created_at ?? 0).getTime();
        return right - left;
      });
    },
    [rawOrders, user?.email, user?.id],
  );

  const isEmpty = !isLoading && orders.length === 0;

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex min-h-0 flex-1 flex-col" style={pageFont}>
        <div className="flex flex-col gap-4 pb-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-[24px] font-semibold tracking-normal text-[#0A0A0A]">Pedidos</h1>
              <p className="mt-1 text-[13px] text-[#737373]">
                Vendas do Mercado Livre com comprador, entrega e fornecedor vinculados.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[13px] font-semibold text-[#404040]">
              <Calendar size={15} strokeWidth={1.5} />
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
            </div>
          </div>
        </div>

        {isLoading ? (
          <OrderSkeleton />
        ) : isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-black/[0.12] bg-white py-20 text-center">
            <ShoppingBag size={48} strokeWidth={1.5} className="mb-4 text-[#D4D4D4]" />
            <p className="text-[15px] font-semibold text-[#0A0A0A]">Nenhum pedido encontrado</p>
            <p className="mt-1 max-w-md text-[13px] text-[#737373]">
              Seus pedidos do Mercado Livre aparecerão aqui quando a sincronização registrar vendas na view.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-black/[0.08] bg-white">
            <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(130px,0.7fr)_112px_112px_118px_190px_28px] border-b border-black/[0.08] bg-[#FAFAFA] px-4 py-3 text-[11px] font-semibold uppercase text-[#737373] md:grid">
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
      </div>
    </TooltipProvider>
  );
};

export default OrdersPage;
