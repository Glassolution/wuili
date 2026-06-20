import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bell,
  Box,
  CalendarDays,
  ChevronRight,
  Globe2,
  MoreHorizontal,
  Package,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type ProfileRow = {
  display_name: string | null;
  loja_nome: string | null;
};

type PublicationRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  published_at: string | null;
};

type OrderRow = {
  id: string;
  product_title: string | null;
  sale_price: number | string | null;
  status: string | null;
  ordered_at: string | null;
  created_at: string | null;
};

type ActivityLogRow = {
  id: string;
  message: string | null;
  created_at: string | null;
};

type RevenuePoint = {
  label: string;
  value: number;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  });

const formatShortDate = (value?: string | null) => {
  if (!value) return "Agora";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
};

const getName = (profile?: ProfileRow | null, email?: string | null) => {
  const raw = profile?.loja_nome || profile?.display_name || email?.split("@")[0] || "Velo";
  return raw
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const buildRevenueSeries = (orders: OrderRow[]): RevenuePoint[] => {
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: labels[date.getMonth()],
      value: 0,
    };
  });

  orders.forEach((order) => {
    const date = new Date(order.ordered_at || order.created_at || "");
    if (Number.isNaN(date.getTime())) return;

    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const point = months.find((month) => month.key === key);
    if (point) point.value += toNumber(order.sale_price);
  });

  return months.map(({ label, value }) => ({ label, value }));
};

const MiniRevenueChart = ({ data }: { data: RevenuePoint[] }) => {
  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const points = data
    .map((point, index) => {
      const x = data.length <= 1 ? 0 : (index / (data.length - 1)) * 100;
      const y = point.value > 0 ? 86 - (point.value / maxValue) * 64 : 86;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="mt-5 rounded-[14px] border border-black/[0.07] bg-white px-5 py-4">
      <svg viewBox="0 0 100 46" className="h-[260px] w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
        {[12, 24, 36, 48, 60, 72, 84].map((y) => (
          <line key={y} x1="0" x2="100" y1={y / 2} y2={y / 2} stroke="rgba(0,0,0,0.055)" strokeWidth="0.35" />
        ))}
        {data.map((point, index) => {
          const x = data.length <= 1 ? 0 : (index / (data.length - 1)) * 100;
          const y = point.value > 0 ? 43 - (point.value / maxValue) * 31 : 43;
          return (
            <line
              key={`${point.label}-${index}`}
              x1={x}
              x2={x}
              y1="43"
              y2={y}
              stroke="rgba(0,0,0,0.18)"
              strokeWidth="0.45"
            />
          );
        })}
        <polyline fill="none" stroke="#1b1b1b" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" points={points
          .split(" ")
          .map((pair) => {
            const [x, y] = pair.split(",").map(Number);
            return `${x},${y / 2}`;
          })
          .join(" ")}
        />
        {data.some((point) => point.value > 0) && (
          <circle
            cx={(Math.max(0, data.findIndex((point) => point.value === maxValue)) / Math.max(data.length - 1, 1)) * 100}
            cy={(86 - (maxValue / maxValue) * 64) / 2}
            r="1.1"
            fill="#ffffff"
            stroke="#111111"
            strokeWidth="0.45"
          />
        )}
      </svg>
      <div className="mt-2 grid grid-cols-12 text-[11px] font-medium text-neutral-500">
        {data.map((point, index) => (
          <span key={`${point.label}-label-${index}`} className="text-center">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
};

const OverviewCell = ({ title, value, caption }: { title: string; value: string; caption: string }) => (
  <div className="min-h-[112px] border-black/[0.06] p-5 odd:border-r [&:nth-child(-n+2)]:border-b">
    <p className="text-[13px] font-medium text-neutral-600">{title}</p>
    <strong className="mt-2 block text-[31px] font-normal leading-none tracking-[-0.05em] text-[#101010]">{value}</strong>
    <p className="mt-3 text-[12px] leading-5 text-neutral-500">{caption}</p>
  </div>
);

const SectionTitle = ({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) => (
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-[20px] font-semibold tracking-[-0.04em] text-[#111111]">{title}</h2>
    {action ? (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#111111] transition-opacity hover:opacity-65"
      >
        {action}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </button>
    ) : null}
  </div>
);

const ActivityAvatar = ({ label }: { label: string }) => {
  const initials = label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "VL";

  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f1f1f1] text-[12px] font-semibold text-[#111111]">
      {initials}
    </span>
  );
};

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["dashboard-home-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles" as never)
        .select("display_name, loja_nome")
        .eq("id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as ProfileRow | null;
    },
  });

  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard-home-wix-data", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const [publicationsResult, ordersResult, activitiesResult] = await Promise.all([
        supabase
          .from("user_publications" as never)
          .select("id,title,status,created_at,published_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("orders" as never)
          .select("id,product_title,sale_price,status,ordered_at,created_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("ai_activity_logs" as never)
          .select("id,message,created_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (publicationsResult.error) throw publicationsResult.error;
      if (ordersResult.error) throw ordersResult.error;
      if (activitiesResult.error) throw activitiesResult.error;

      return {
        publications: (publicationsResult.data ?? []) as PublicationRow[],
        orders: (ordersResult.data ?? []) as OrderRow[],
        activities: (activitiesResult.data ?? []) as ActivityLogRow[],
      };
    },
  });

  const publications = dashboardData?.publications ?? [];
  const orders = dashboardData?.orders ?? [];
  const activities = dashboardData?.activities ?? [];

  const name = getName(profile, user?.email);
  const activeListings = publications.filter((item) => ["active", "ativo", "published", "publicado"].includes(String(item.status ?? "").toLowerCase())).length;
  const expiredListings = publications.filter((item) => ["paused", "pausado", "expired", "expirado"].includes(String(item.status ?? "").toLowerCase())).length;
  const soldOut = publications.filter((item) => ["sold_out", "esgotado"].includes(String(item.status ?? "").toLowerCase())).length;
  const totalRevenue = orders.reduce((sum, order) => sum + toNumber(order.sale_price), 0);
  const revenueSeries = useMemo(() => buildRevenueSeries(orders), [orders]);
  const conversionRate = 0;

  const latestOrder = orders[0];
  const latestOrderValue = latestOrder ? formatBRL(toNumber(latestOrder.sale_price)) : formatBRL(0);
  const latestProduct = latestOrder?.product_title || "Nenhuma venda registrada";

  return (
    <main className="min-h-full w-full bg-[#f4f4f4] text-[#111111]">
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-5 px-1 py-1 sm:px-3 lg:px-0">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-[26px] font-semibold leading-none tracking-[-0.045em] text-[#111111]">Hello, {name}!</h1>
          <button
            type="button"
            onClick={() => navigate("/dashboard/produtos")}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111111] px-5 text-[13px] font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
          >
            <Globe2 className="h-4 w-4" />
            Open Site
          </button>
        </header>

        <section className="flex items-center justify-between gap-4 rounded-[14px] border border-black/[0.06] bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[#222222]">
            <Box className="h-4 w-4" />
            <span>Upgrade your plan to unlock advanced features</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/dashboard/planos")}
              className="hidden h-8 items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-3 text-[12px] font-semibold text-[#111111] transition-colors hover:bg-[#f7f7f7] sm:inline-flex"
            >
              Select Plan
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-[#f7f7f7]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_292px]">
          <div className="space-y-5">
            <section>
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 className="text-[20px] font-semibold tracking-[-0.04em] text-[#111111]">Overview performance</h2>
                <div className="hidden items-center rounded-full bg-white p-1 text-[12px] font-medium text-neutral-500 sm:flex">
                  {["Day", "Week", "Month", "Year"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`h-8 rounded-full px-4 transition-colors ${item === "Week" ? "bg-[#f4f4f4] text-[#111111]" : "hover:text-[#111111]"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 overflow-hidden rounded-[16px] border border-black/[0.07] bg-white sm:grid-cols-2">
                <OverviewCell title="Total Views" value="0" caption="No real visit data connected yet" />
                <OverviewCell title="Visits" value="0" caption="From tracked sessions" />
                <OverviewCell title="Orders" value={String(orders.length)} caption="Real orders in your account" />
                <OverviewCell title="Conversion Rate" value={`${conversionRate}%`} caption="Requires visits and orders" />
              </div>
            </section>

            <section className="rounded-[16px] border border-black/[0.07] bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[22px] font-semibold tracking-[-0.045em] text-[#111111]">Revenue</h2>
                  <p className="mt-5 text-[13px] font-medium text-neutral-600">Total Revenue</p>
                  <strong className="mt-1 block text-[36px] font-semibold leading-none tracking-[-0.055em] text-[#111111]">
                    {formatBRL(totalRevenue)}
                  </strong>
                  <p className="mt-2 text-[12px] text-neutral-500">Real revenue from completed orders</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-black/[0.07] px-3 text-[12px] font-semibold text-neutral-700 transition-colors hover:bg-[#f7f7f7]"
                  >
                    Last Year
                    <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                  </button>
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-black/[0.07] text-neutral-500 transition-colors hover:bg-[#f7f7f7]">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <MiniRevenueChart data={revenueSeries} />
            </section>
          </div>

          <aside className="space-y-5">
            <section>
              <SectionTitle title="Shop Advisor" action="See All" onAction={() => navigate("/dashboard/produtos")} />
              <div className="rounded-[16px] border border-black/[0.07] bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f7f7f7]">
                    <Bell className="h-4 w-4 text-[#111111]" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold leading-5 text-[#111111]">Your next action is ready</p>
                    <p className="mt-1 text-[12px] leading-5 text-neutral-500">
                      Review products and keep your store moving with real catalog data.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/dashboard/produtos")}
                      className="mt-3 h-8 rounded-lg border border-black/[0.08] px-3 text-[12px] font-semibold transition-colors hover:bg-[#f7f7f7]"
                    >
                      Learn More
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle title="Products" action="See All" onAction={() => navigate("/dashboard/produtos")} />
              <div className="rounded-[16px] border border-black/[0.07] bg-white p-4">
                {[
                  ["Active listings", activeListings],
                  ["Expired", expiredListings],
                  ["Sold out", soldOut],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-black/[0.06] py-3 last:border-b-0">
                    <span className="text-[13px] font-medium text-neutral-700">{label}</span>
                    <strong className="text-[22px] font-normal tracking-[-0.04em] text-[#111111]">{value}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionTitle title="Recent Activities" action="See All" onAction={() => navigate("/dashboard/relatorios")} />
              <div className="rounded-[16px] border border-black/[0.07] bg-white p-4">
                {activities.length > 0 ? (
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-center gap-3 border-b border-black/[0.05] pb-3 last:border-b-0 last:pb-0">
                        <ActivityAvatar label={activity.message || "Velo"} />
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold text-[#111111]">{activity.message || "Atividade registrada"}</p>
                          <p className="mt-0.5 text-[11px] text-neutral-500">{formatShortDate(activity.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[164px] flex-col items-center justify-center rounded-[12px] bg-[#fafafa] px-5 text-center">
                    <ShoppingBag className="h-5 w-5 text-neutral-400" />
                    <p className="mt-3 text-[13px] font-medium text-neutral-600">No recent activity yet</p>
                    <p className="mt-1 text-[12px] leading-5 text-neutral-400">Your real actions will appear here.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[16px] border border-black/[0.07] bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-neutral-600">Latest sale</p>
                <Package className="h-4 w-4 text-neutral-400" />
              </div>
              <strong className="mt-3 block text-[28px] font-semibold leading-none tracking-[-0.05em] text-[#111111]">
                {latestOrderValue}
              </strong>
              <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-neutral-500">{latestProduct}</p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default DashboardHomePage;
