import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid,
  ChevronDown,
  Filter,
  Download,
  Plus,
  MoreVertical,
  ShoppingBag,
  CheckCircle,
  Truck,
  Clock,
  Calendar,
  Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────
type OrderStatus = "active" | "success" | "delivery" | "pending";

type Order = {
  id: string;
  code: string;
  productName: string;
  productImage: string | null;
  quantity: number;
  price: number;
  date: string;
  status: OrderStatus;
};

// ─── Map DB status → kanban column ───────────────────────────────────────────
function mapStatus(dbStatus: string): OrderStatus {
  switch (dbStatus.toLowerCase()) {
    case "paid":
    case "approved":
    case "in_process":
    case "processing":
      return "active";
    case "completed":
    case "delivered":
      return "success";
    case "shipped":
    case "in_transit":
      return "delivery";
    case "pending":
    case "cancelled":
    case "canceled":
    case "failed":
    default:
      return "pending";
  }
}

// ─── Column Config ────────────────────────────────────────────────────────────
const columns = [
  {
    id: "active" as OrderStatus,
    title: "Pedido ativo",
    icon: ShoppingBag,
    color: "#FB923C",
    bgColor: "#FFF7ED",
  },
  {
    id: "success" as OrderStatus,
    title: "Sucesso",
    icon: CheckCircle,
    color: "#3B82F6",
    bgColor: "#EFF6FF",
  },
  {
    id: "delivery" as OrderStatus,
    title: "Entrega",
    icon: Truck,
    color: "#10B981",
    bgColor: "#ECFDF5",
  },
  {
    id: "pending" as OrderStatus,
    title: "Pendente",
    icon: Clock,
    color: "#EF4444",
    bgColor: "#FEF2F2",
  },
];

// ─── Format helpers ───────────────────────────────────────────────────────────
const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── Order Card ───────────────────────────────────────────────────────────────
const OrderCard = ({ order }: { order: Order }) => (
  <div
    className="group relative rounded-xl border border-black/[0.05] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
    style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
  >
    <div className="flex items-center justify-between mb-3">
      <span className="text-[13px] font-semibold text-foreground" style={{ letterSpacing: "-0.01em" }}>
        {order.code}
      </span>
      <button className="rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/[0.04]">
        <MoreVertical size={14} strokeWidth={1.8} className="text-muted-foreground" />
      </button>
    </div>

    <div className="flex items-start gap-2.5 mb-3">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
        {order.productImage ? (
          <img src={order.productImage} alt={order.productName} className="h-full w-full object-cover" />
        ) : (
          <Package size={20} strokeWidth={1.5} className="text-muted-foreground/40" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground" style={{ letterSpacing: "-0.01em" }}>
          {order.productName}
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
          x{order.quantity}
        </p>
      </div>
    </div>

    <div className="mb-3">
      <p className="text-[15px] font-semibold text-foreground" style={{ letterSpacing: "-0.02em" }}>
        {formatBRL(order.price)}
      </p>
    </div>

    <div className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-2">
      <Calendar size={12} strokeWidth={1.8} className="text-muted-foreground" />
      <span className="text-[11px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
        {order.date}
      </span>
    </div>
  </div>
);

// ─── Column ───────────────────────────────────────────────────────────────────
const OrderColumn = ({ column, orders }: { column: typeof columns[0]; orders: Order[] }) => {
  const Icon = column.icon;
  return (
    <div className="flex min-w-[280px] flex-col">
      <div className="mb-4 flex flex-col gap-3">
        <div className="h-1 w-full rounded-full" style={{ backgroundColor: column.color }} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={16} strokeWidth={1.8} style={{ color: column.color }} />
            <h3 className="text-[14px] font-semibold text-foreground" style={{ letterSpacing: "-0.01em" }}>
              {column.title}
            </h3>
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
              style={{ backgroundColor: column.bgColor, color: column.color }}
            >
              {orders.length}
            </span>
          </div>
          <button className="rounded-md p-1 transition-colors hover:bg-black/[0.04]">
            <MoreVertical size={14} strokeWidth={1.8} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
        <button className="flex h-10 items-center justify-center rounded-xl border-2 border-dashed border-black/[0.08] bg-white transition-colors hover:border-black/[0.15] hover:bg-gray-50">
          <Plus size={16} strokeWidth={1.8} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

// ─── Skeleton Column ──────────────────────────────────────────────────────────
const SkeletonColumn = ({ color }: { color: string }) => (
  <div className="flex min-w-[280px] flex-col gap-3">
    <div className="h-1 w-full rounded-full" style={{ backgroundColor: color }} />
    <Skeleton className="h-5 w-32" />
    {[1, 2].map((i) => (
      <Skeleton key={i} className="h-[140px] w-full rounded-xl" />
    ))}
  </div>
);

// ─── Empty Column ─────────────────────────────────────────────────────────────
const EmptyColumn = ({ column }: { column: typeof columns[0] }) => {
  const Icon = column.icon;
  return (
    <div className="flex min-w-[280px] flex-col">
      <div className="mb-4 flex flex-col gap-3">
        <div className="h-1 w-full rounded-full" style={{ backgroundColor: column.color }} />
        <div className="flex items-center gap-2">
          <Icon size={16} strokeWidth={1.8} style={{ color: column.color }} />
          <h3 className="text-[14px] font-semibold text-foreground" style={{ letterSpacing: "-0.01em" }}>
            {column.title}
          </h3>
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
            style={{ backgroundColor: column.bgColor, color: column.color }}
          >
            0
          </span>
        </div>
      </div>
      <button className="flex h-10 items-center justify-center rounded-xl border-2 border-dashed border-black/[0.08] bg-white transition-colors hover:border-black/[0.15] hover:bg-gray-50">
        <Plus size={16} strokeWidth={1.8} className="text-muted-foreground" />
      </button>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const OrdersPage = () => {
  const { user } = useAuth();

  const { data: rawOrders, isLoading } = useQuery({
    queryKey: ["orders-kanban", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, external_order_id, product_title, product_image, quantity, sale_price, ordered_at, created_at, status")
        .eq("user_id", user!.id)
        .order("ordered_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Map DB rows → Order type
  const orders: Order[] = (rawOrders ?? []).map((row, idx) => ({
    id: row.id,
    code: row.external_order_id ?? `VL-${String(idx + 1).padStart(5, "0")}`,
    productName: row.product_title ?? "Produto sem nome",
    productImage: row.product_image ?? null,
    quantity: row.quantity ?? 1,
    price: Number(row.sale_price ?? 0),
    date: formatDate(row.ordered_at ?? row.created_at),
    status: mapStatus(row.status ?? "pending"),
  }));

  const ordersByStatus = columns.reduce((acc, column) => {
    acc[column.id] = orders.filter((o) => o.status === column.id);
    return acc;
  }, {} as Record<OrderStatus, Order[]>);

  const isEmpty = !isLoading && orders.length === 0;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* Header */}
      <div className="flex flex-col gap-4 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-semibold text-foreground" style={{ letterSpacing: "-0.03em" }}>
              Pedidos
            </h1>
            <div className="flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5">
              <LayoutGrid size={14} strokeWidth={1.8} className="text-foreground" />
              <span className="text-[13px] font-medium text-foreground" style={{ letterSpacing: "-0.01em" }}>
                Visão em quadro
              </span>
              <ChevronDown size={14} strokeWidth={1.8} className="text-muted-foreground" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex h-9 items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-black/[0.02]" style={{ letterSpacing: "-0.01em" }}>
              <Filter size={14} strokeWidth={1.8} />
              <span>Filtrar</span>
            </button>
            <button className="flex h-9 items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-black/[0.02]" style={{ letterSpacing: "-0.01em" }}>
              <Download size={14} strokeWidth={1.8} />
              <span>Exportar</span>
            </button>
            <button className="flex h-9 items-center gap-1.5 rounded-lg bg-[#111111] px-3 text-[13px] font-medium text-white transition-colors hover:bg-black/90" style={{ letterSpacing: "-0.01em" }}>
              <Plus size={14} strokeWidth={1.8} />
              <span>Adicionar pedido</span>
            </button>
          </div>
        </div>
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <SkeletonColumn key={col.id} color={col.color} />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
          <ShoppingBag size={48} strokeWidth={1.5} className="text-muted-foreground/30 mb-4" />
          <p className="text-[15px] font-medium text-foreground">Nenhum pedido encontrado</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Seus pedidos do Mercado Livre aparecerão aqui após a sincronização.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
          {columns.map((column) => {
            const colOrders = ordersByStatus[column.id];
            return colOrders.length === 0 ? (
              <EmptyColumn key={column.id} column={column} />
            ) : (
              <OrderColumn key={column.id} column={column} orders={colOrders} />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
