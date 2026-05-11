import { useState } from "react";
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type OrderStatus = "active" | "success" | "delivery" | "pending";

type Order = {
  id: string;
  code: string;
  productName: string;
  productImage: string;
  quantity: number;
  price: number;
  date: string;
  status: OrderStatus;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const mockOrders: Order[] = [
  {
    id: "1",
    code: "VL-00001",
    productName: "Suporte Veicular para Celular",
    productImage: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=100&h=100&fit=crop",
    quantity: 1,
    price: 89.90,
    date: "30 abr. 2026",
    status: "active",
  },
  {
    id: "2",
    code: "VL-00002",
    productName: "Fone de Ouvido Bluetooth",
    productImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&h=100&fit=crop",
    quantity: 2,
    price: 149.90,
    date: "29 abr. 2026",
    status: "active",
  },
  {
    id: "3",
    code: "VL-00003",
    productName: "Carregador Portátil 10000mAh",
    productImage: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=100&h=100&fit=crop",
    quantity: 1,
    price: 79.90,
    date: "28 abr. 2026",
    status: "active",
  },
  {
    id: "4",
    code: "VL-00004",
    productName: "Capa Protetora para Notebook",
    productImage: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=100&h=100&fit=crop",
    quantity: 1,
    price: 59.90,
    date: "27 abr. 2026",
    status: "success",
  },
  {
    id: "5",
    code: "VL-00005",
    productName: "Mouse Sem Fio Ergonômico",
    productImage: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=100&h=100&fit=crop",
    quantity: 1,
    price: 89.90,
    date: "26 abr. 2026",
    status: "success",
  },
  {
    id: "6",
    code: "VL-00006",
    productName: "Teclado Mecânico RGB",
    productImage: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=100&h=100&fit=crop",
    quantity: 1,
    price: 299.90,
    date: "25 abr. 2026",
    status: "success",
  },
  {
    id: "7",
    code: "VL-00007",
    productName: "Webcam Full HD 1080p",
    productImage: "https://images.unsplash.com/photo-1585792180666-f7347c490ee2?w=100&h=100&fit=crop",
    quantity: 1,
    price: 199.90,
    date: "24 abr. 2026",
    status: "delivery",
  },
  {
    id: "8",
    code: "VL-00008",
    productName: "Suporte para Monitor Ajustável",
    productImage: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=100&h=100&fit=crop",
    quantity: 1,
    price: 129.90,
    date: "23 abr. 2026",
    status: "delivery",
  },
  {
    id: "9",
    code: "VL-00009",
    productName: "Hub USB-C 7 em 1",
    productImage: "https://images.unsplash.com/photo-1625948515291-69613efd103f?w=100&h=100&fit=crop",
    quantity: 2,
    price: 159.90,
    date: "22 abr. 2026",
    status: "delivery",
  },
  {
    id: "10",
    code: "VL-00010",
    productName: "Luminária LED para Mesa",
    productImage: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=100&h=100&fit=crop",
    quantity: 1,
    price: 119.90,
    date: "21 abr. 2026",
    status: "pending",
  },
  {
    id: "11",
    code: "VL-00011",
    productName: "Organizador de Cabos",
    productImage: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop",
    quantity: 3,
    price: 39.90,
    date: "20 abr. 2026",
    status: "pending",
  },
];

// ─── Column Config ────────────────────────────────────────────────────────────
const columns = [
  {
    id: "active" as OrderStatus,
    title: "Pedido ativo",
    icon: ShoppingBag,
    color: "#FB923C", // laranja
    bgColor: "#FFF7ED",
  },
  {
    id: "success" as OrderStatus,
    title: "Sucesso",
    icon: CheckCircle,
    color: "#3B82F6", // azul
    bgColor: "#EFF6FF",
  },
  {
    id: "delivery" as OrderStatus,
    title: "Entrega",
    icon: Truck,
    color: "#10B981", // verde
    bgColor: "#ECFDF5",
  },
  {
    id: "pending" as OrderStatus,
    title: "Pendente",
    icon: Clock,
    color: "#EF4444", // vermelho
    bgColor: "#FEF2F2",
  },
];

// ─── Format Currency ──────────────────────────────────────────────────────────
const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

// ─── Order Card Component ─────────────────────────────────────────────────────
const OrderCard = ({ order }: { order: Order }) => {
  return (
    <div
      className="group relative rounded-xl border border-black/[0.05] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* Header: Code + Menu */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-semibold text-foreground" style={{ letterSpacing: "-0.01em" }}>
          {order.code}
        </span>
        <button className="rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/[0.04]">
          <MoreVertical size={14} strokeWidth={1.8} className="text-muted-foreground" />
        </button>
      </div>

      {/* Product Image + Name */}
      <div className="flex items-start gap-2.5 mb-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          <img src={order.productImage} alt={order.productName} className="h-full w-full object-cover" />
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

      {/* Price */}
      <div className="mb-3">
        <p className="text-[15px] font-semibold text-foreground" style={{ letterSpacing: "-0.02em" }}>
          {formatBRL(order.price)}
        </p>
      </div>

      {/* Footer: Date */}
      <div className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-2">
        <Calendar size={12} strokeWidth={1.8} className="text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
          {order.date}
        </span>
      </div>
    </div>
  );
};

// ─── Column Component ─────────────────────────────────────────────────────────
const OrderColumn = ({ column, orders }: { column: typeof columns[0]; orders: Order[] }) => {
  const Icon = column.icon;
  
  return (
    <div className="flex min-w-[280px] flex-col">
      {/* Column Header */}
      <div className="mb-4 flex flex-col gap-3">
        {/* Top colored line */}
        <div className="h-1 w-full rounded-full" style={{ backgroundColor: column.color }} />
        
        {/* Title + Count + Menu */}
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

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
        
        {/* Add button */}
        <button className="flex h-10 items-center justify-center rounded-xl border-2 border-dashed border-black/[0.08] bg-white transition-colors hover:border-black/[0.15] hover:bg-gray-50">
          <Plus size={16} strokeWidth={1.8} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const OrdersPage = () => {
  const [viewMode] = useState("board");

  // Group orders by status
  const ordersByStatus = columns.reduce((acc, column) => {
    acc[column.id] = mockOrders.filter((order) => order.status === column.id);
    return acc;
  }, {} as Record<OrderStatus, Order[]>);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* Header */}
      <div className="flex flex-col gap-4 pb-5">
        {/* Title + View Selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-semibold text-foreground" style={{ letterSpacing: "-0.03em" }}>
              Pedidos
            </h1>
            
            {/* View Selector */}
            <div className="flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5">
              <LayoutGrid size={14} strokeWidth={1.8} className="text-foreground" />
              <span className="text-[13px] font-medium text-foreground" style={{ letterSpacing: "-0.01em" }}>
                Visão em quadro
              </span>
              <ChevronDown size={14} strokeWidth={1.8} className="text-muted-foreground" />
            </div>
          </div>

          {/* Action Buttons */}
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
      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <OrderColumn
            key={column.id}
            column={column}
            orders={ordersByStatus[column.id]}
          />
        ))}
      </div>
    </div>
  );
};

export default OrdersPage;
