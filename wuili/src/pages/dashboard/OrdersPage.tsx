import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, ChevronRight, Package } from "lucide-react";
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
  sale_price: number;
  cost_price: number | null;
  profit: number | null;
  status: string;
  tracking_code: string | null;
  ordered_at: string | null;
  created_at: string;
};

type TabFilter = "all" | "in_progress" | "delivered" | "cancelled";
type DateRangeFilter = "all" | "7d" | "30d" | "90d" | "month";

const STATUS_GROUP: Record<string, TabFilter> = {
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

const STATUS_COPY: Record<TabFilter, { label: string; dot: string; className: string }> = {
  all: {
    label: "All",
    dot: "bg-[#8F2528]",
    className: "bg-[#F8EEEE] text-[#8F2528]",
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

const getOrderDate = (order: Order) => new Date(order.ordered_at ?? order.created_at);

const getOrderId = (order: Order) =>
  order.external_order_id || order.id.slice(0, 8).toUpperCase();

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

const OrderImage = ({ order }: { order: Order }) => {
  const itemCount = getProductItems(order.product_title).length;
  const extraItems = Math.max(itemCount - 1, 0);

  return (
    <div className="relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-[8px] bg-[#F5F2EF] sm:h-[84px] sm:w-[84px]">
      {order.product_image ? (
        <img
          src={order.product_image}
          alt={order.product_title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#B9B2AB]">
          <Package size={24} strokeWidth={1.6} />
        </div>
      )}

      {extraItems > 0 && (
        <span className="absolute bottom-0 right-0 flex h-8 min-w-8 items-center justify-center rounded-tl-[8px] bg-black/72 px-2 text-[16px] font-semibold leading-none text-white">
          +{extraItems}
        </span>
      )}
    </div>
  );
};

const OrderCardSkeleton = () => (
  <div className="rounded-[22px] border border-[#E1DDDA] bg-white px-8 py-9">
    <div className="flex items-center gap-4">
      <Skeleton className="h-9 w-36 rounded-full" />
      <Skeleton className="h-4 w-28 rounded-full" />
    </div>
    <div className="mt-8 flex items-center gap-6">
      <Skeleton className="h-[84px] w-[84px] rounded-[8px]" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-6 w-56 rounded-full" />
        <Skeleton className="h-5 w-3/5 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
    </div>
  </div>
);

const OrdersPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabFilter>("all");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");

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

  const filteredOrders = useMemo(() => {
    return allOrders.filter((order) => {
      const matchesStatus = tab === "all" || getStatusGroup(order.status) === tab;
      const matchesDate = isInsideDateRange(order, dateRange);

      return matchesStatus && matchesDate;
    });
  }, [allOrders, tab, dateRange]);

  return (
    <section className="min-h-[calc(100vh-112px)] rounded-[24px] bg-white px-5 py-6 font-['Manrope'] text-[#1D1B1A] shadow-[0_1px_0_rgba(18,18,18,0.04)] dark:bg-zinc-950 dark:text-white md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-7">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-3 text-[15px] leading-none text-[#2A2928] dark:text-zinc-200">
          <Link to="/dashboard" className="transition hover:text-[#0A0A0A]">
            Home
          </Link>
          <ChevronRight size={16} strokeWidth={2.1} className="text-[#1D1B1A] dark:text-zinc-300" />
          <Link to="/dashboard/configuracoes" className="transition hover:text-[#0A0A0A]">
            My Account
          </Link>
          <ChevronRight size={16} strokeWidth={2.1} className="text-[#1D1B1A] dark:text-zinc-300" />
          <span className="text-[#494746] dark:text-zinc-400">My Orders</span>
        </nav>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {TABS.map((item) => {
              const active = tab === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={[
                    "h-10 shrink-0 rounded-full border px-5 text-[14px] font-medium transition",
                    active
                      ? "border-[#0A0A0A] bg-white text-[#0A0A0A] shadow-[0_8px_18px_rgba(10,10,10,0.05)] dark:border-white dark:bg-zinc-950 dark:text-white"
                      : "border-[#D8D3CF] bg-white text-[#494746] hover:border-[#0A0A0A] hover:text-[#0A0A0A] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-white dark:hover:text-white",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <label className="relative h-11 w-full shrink-0 lg:w-[196px]">
            <span className="pointer-events-none absolute inset-0 flex items-center justify-between rounded-full bg-[#F7F6F5] px-5 text-[14px] font-medium text-[#2A2928] dark:bg-zinc-900 dark:text-zinc-100">
              {DATE_RANGE_LABEL[dateRange]}
              <ChevronDown size={16} strokeWidth={2.1} className="text-[#0A0A0A] dark:text-white" />
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

        <div className="flex flex-col gap-6">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => <OrderCardSkeleton key={index} />)
          ) : isError ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[18px] border border-[#E1DDDA] bg-white px-8 py-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
              <AlertCircle size={28} className="text-[#0A0A0A] dark:text-white" />
              <p className="mt-4 text-[17px] font-semibold">Could not load orders</p>
              <p className="mt-2 max-w-[400px] text-[13px] leading-6 text-[#77706B] dark:text-zinc-400">
                Refresh the page or try again in a moment.
              </p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[18px] border border-[#E1DDDA] bg-white px-8 py-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
              <Package size={31} className="text-[#B9B2AB]" strokeWidth={1.6} />
              <p className="mt-4 text-[18px] font-semibold">No orders found</p>
              <p className="mt-2 max-w-[390px] text-[13px] leading-6 text-[#77706B] dark:text-zinc-400">
                Orders requested by your customers will appear here as soon as they are received.
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const statusGroup = getStatusGroup(order.status);
              const status = STATUS_COPY[statusGroup];
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
                  className="group relative rounded-[22px] border border-[#E1DDDA] bg-white px-5 py-8 transition duration-200 hover:border-[#D2CAC4] hover:shadow-[0_18px_44px_rgba(32,22,14,0.06)] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 sm:px-10"
                >
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                    <span className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-[18px] font-semibold ${status.className}`}>
                      <span className={`h-3 w-3 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                    <span className="h-7 w-px bg-[#D8D3CF] dark:bg-zinc-700" />
                    <span className="text-[18px] text-[#2A2928] dark:text-zinc-200">
                      {formatOrderDate(order)}
                    </span>
                  </div>

                  <div className="mt-8 flex items-center gap-6 pr-0 sm:pr-16">
                    <OrderImage order={order} />

                    <div className="min-w-0 flex-1">
                      <p className="text-[22px] font-bold leading-tight text-[#8F2528] sm:text-[23px]">
                        Order ID: {getOrderId(order)}
                      </p>
                      <p className="mt-2 line-clamp-2 text-[20px] leading-[1.35] text-[#151312] dark:text-zinc-100 sm:text-[22px]">
                        {productCopy[0]}
                        {productCopy[1] && <span className="font-semibold text-[#8F2528]"> {productCopy[1]}</span>}
                      </p>
                      <p className="mt-2 text-[20px] font-bold leading-none text-[#151312] dark:text-white sm:text-[22px]">
                        {formatBRL(order.sale_price)}
                      </p>
                    </div>
                  </div>

                  <span className="pointer-events-none absolute right-8 top-1/2 hidden -translate-y-1/2 text-[#8F2528] transition group-hover:translate-x-1 sm:block">
                    <ChevronRight size={42} strokeWidth={1.8} />
                  </span>
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default OrdersPage;
