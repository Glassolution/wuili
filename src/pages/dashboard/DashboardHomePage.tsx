import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const ACTIVE_ORDER_STATUSES = new Set(["paid", "approved", "processing", "shipped", "delivered", "completed"]);

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};

type Publication = {
  id: string;
  title: string;
  thumbnail: string | null;
  price: number | null;
  cost_price: number | null;
  status: string | null;
  published_at: string | null;
  created_at: string | null;
};

type OrderRow = {
  id: string;
  product_title: string | null;
  product_image: string | null;
  quantity: number | null;
  sale_price: number | null;
  total_amount: number | null;
  cost_price: number | null;
  profit: number | null;
  status: string | null;
  ordered_at: string | null;
  created_at: string | null;
};

type BestSeller = {
  key: string;
  name: string;
  image: string | null;
  quantity: number;
  revenue: number;
  profit: number;
  marginPct: number | null;
};

type ActivityItem = {
  id: string;
  time: string;
  text: string;
};

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatNumber = (value: number) => value.toLocaleString("pt-BR");

const getOrderDate = (order: OrderRow) => order.ordered_at ?? order.created_at ?? "";

const isSameDay = (dateValue: string | null | undefined, compare = new Date()) => {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return (
    date.getFullYear() === compare.getFullYear() &&
    date.getMonth() === compare.getMonth() &&
    date.getDate() === compare.getDate()
  );
};

const isSameMonth = (dateValue: string | null | undefined, compare = new Date()) => {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return date.getFullYear() === compare.getFullYear() && date.getMonth() === compare.getMonth();
};

const formatActivityTime = (dateValue: string | null | undefined) => {
  if (!dateValue) return "Sem data";
  const date = new Date(dateValue);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  if (isSameDay(dateValue, now)) return time;
  if (isSameDay(dateValue, yesterday)) return `Ontem ${time}`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const getPublicationMargin = (publication: Publication) => {
  const price = Number(publication.price ?? 0);
  const cost = Number(publication.cost_price ?? 0);
  if (price <= 0 || cost <= 0) return null;
  return Math.round(((price - cost) / price) * 100);
};

const productFallback = (name: string) => name.trim().slice(0, 2).toUpperCase() || "VL";

export default function DashboardHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["dashboard-home-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, store_name, loja_nome")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) {
        console.error("[DashboardHomePage] erro ao buscar perfil:", error);
        return null;
      }

      return data as { display_name?: string | null; store_name?: string | null; loja_nome?: string | null } | null;
    },
  });

  const { data: publications = [], isLoading: publicationsLoading } = useQuery({
    queryKey: ["dashboard-home-publications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_publications" as any)
        .select("id, title, thumbnail, price, cost_price, status, published_at, created_at")
        .eq("user_id", user!.id)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as Publication[];
    },
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["dashboard-home-orders", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders" as any)
        .select("id, product_title, product_image, quantity, sale_price, total_amount, cost_price, profit, status, ordered_at, created_at")
        .eq("user_id", user!.id)
        .order("ordered_at", { ascending: false, nullsFirst: false })
        .limit(300);

      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const firstName = useMemo(() => {
    const metadataName =
      (user?.user_metadata?.name as string | undefined) ??
      (user?.user_metadata?.full_name as string | undefined);
    const source = profile?.display_name?.trim() || metadataName || "";
    return source ? source.split(" ")[0] : "";
  }, [profile?.display_name, user?.user_metadata]);

  const activeOrders = useMemo(
    () => orders.filter((order) => ACTIVE_ORDER_STATUSES.has(String(order.status ?? "").toLowerCase())),
    [orders]
  );

  const bestSellers = useMemo(() => {
    const map = new Map<string, BestSeller>();

    activeOrders.forEach((order) => {
      const name = order.product_title?.trim() || "Produto sem nome";
      const key = name.toLowerCase();
      const quantity = Math.max(1, Number(order.quantity ?? 1));
      const salePrice = Number(order.sale_price ?? 0);
      const total = Number(order.total_amount ?? salePrice * quantity);
      const profit = Number(order.profit ?? 0);
      const current = map.get(key);

      if (current) {
        current.quantity += quantity;
        current.revenue += total;
        current.profit += profit;
        if (!current.image && order.product_image) current.image = order.product_image;
        current.marginPct = current.revenue > 0 ? Math.round((current.profit / current.revenue) * 100) : null;
      } else {
        map.set(key, {
          key,
          name,
          image: order.product_image,
          quantity,
          revenue: total,
          profit,
          marginPct: total > 0 && profit > 0 ? Math.round((profit / total) * 100) : null,
        });
      }
    });

    return [...map.values()]
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 3);
  }, [activeOrders]);

  const metrics = useMemo(() => {
    const todayRevenue = activeOrders
      .filter((order) => isSameDay(getOrderDate(order)))
      .reduce((sum, order) => sum + Number(order.total_amount ?? Number(order.sale_price ?? 0) * Number(order.quantity ?? 1)), 0);

    const monthOrders = activeOrders.filter((order) => isSameMonth(getOrderDate(order)));
    const monthRevenue = monthOrders.reduce(
      (sum, order) => sum + Number(order.total_amount ?? Number(order.sale_price ?? 0) * Number(order.quantity ?? 1)),
      0
    );

    const marginSources = publications
      .map(getPublicationMargin)
      .filter((margin): margin is number => margin !== null);
    const averageMargin = marginSources.length
      ? Math.round(marginSources.reduce((sum, margin) => sum + margin, 0) / marginSources.length)
      : null;

    return [
      { label: "Produtos no ML", value: formatNumber(publications.length) },
      { label: "Vendas hoje", value: formatBRL(todayRevenue) },
      { label: "Vendas do mes", value: formatBRL(monthRevenue) },
      { label: "Margem media", value: averageMargin === null ? "Sem dados" : `${averageMargin}%` },
    ];
  }, [activeOrders, publications]);

  const recentlyPublished = useMemo(
    () =>
      publications
        .slice()
        .sort((a, b) => new Date(b.published_at ?? b.created_at ?? 0).getTime() - new Date(a.published_at ?? a.created_at ?? 0).getTime())
        .slice(0, 5),
    [publications]
  );

  const aiActivity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    publications.slice(0, 5).forEach((publication) => {
      const date = publication.published_at ?? publication.created_at;
      if (!date) return;
      items.push({
        id: `publication-${publication.id}`,
        time: formatActivityTime(date),
        text: `Produto publicado no Mercado Livre: ${publication.title}`,
      });
    });

    return items.slice(0, 5);
  }, [publications]);

  const isLoading = publicationsLoading || ordersLoading;
  const lastUpdate = useMemo(() => {
    const dates = [
      ...publications.map((item) => item.published_at ?? item.created_at),
      ...orders.map((item) => item.ordered_at ?? item.created_at),
    ]
      .filter(Boolean)
      .map((date) => new Date(date as string))
      .sort((a, b) => b.getTime() - a.getTime());

    if (!dates[0]) return "sem registros ainda";
    return dates[0].toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }, [orders, publications]);

  return (
    <main className="-m-3 min-h-[calc(100vh-96px)] bg-[#F4F4F4] px-4 py-8 text-[#0a0a0a] antialiased [font-family:'Hanken_Grotesk',-apple-system,BlinkMacSystemFont,'Helvetica_Neue',Arial,sans-serif] sm:-m-4 sm:px-8 lg:-m-6 lg:px-12 lg:py-10">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-12 gap-6">
        <header className="col-span-12">
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-black sm:text-[48px]">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}.
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#16a34a] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#16a34a]" />
            </span>
            <p className="text-[15px] font-medium text-[#4a4a4a]">
              Ultima atualizacao: {lastUpdate}
            </p>
          </div>
        </header>

        <section className="col-span-12 rounded-[16px] bg-[#111] p-7 text-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-9">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[24px] font-semibold tracking-[-0.01em] sm:text-[28px]">
                Produtos mais vendidos
              </h2>
              <p className="mt-1.5 text-[14px] text-white/60">
                Ranking calculado com os pedidos reais da sua conta.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-[360px] animate-pulse rounded-[14px] bg-white/10" />
              ))}
            </div>
          ) : bestSellers.length === 0 ? (
            <div className="rounded-[12px] border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-[15px] text-white/70">
              Nenhum produto vendido ainda. Quando os pedidos entrarem, os mais vendidos aparecem aqui.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {bestSellers.map((product, index) => (
                <article key={product.key} className="flex flex-col overflow-hidden rounded-[14px] bg-white text-[#0a0a0a]">
                  {product.image ? (
                    <div className="aspect-[4/3] w-full bg-[#f4f4f4] bg-cover bg-center" style={{ backgroundImage: `url(${product.image})` }} />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-[#f4f4f4] text-[34px] font-semibold text-[#8a8a8a]">
                      {productFallback(product.name)}
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white">
                        #{index + 1}
                      </span>
                      <span className="text-[12px] font-medium text-[#6b6b6b]">{product.quantity} vendas</span>
                    </div>
                    <h3 className="line-clamp-2 min-h-[44px] text-[15px] font-semibold leading-snug">{product.name}</h3>
                    <dl className="mt-4 space-y-1.5 text-[13px]">
                      <div className="flex justify-between text-[#6b6b6b]">
                        <dt>Receita</dt>
                        <dd className="font-medium text-[#0a0a0a]">{formatBRL(product.revenue)}</dd>
                      </div>
                      <div className="flex justify-between text-[#6b6b6b]">
                        <dt>Lucro</dt>
                        <dd className="font-medium text-[#0a0a0a]">{formatBRL(product.profit)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#6b6b6b]">Margem</dt>
                        <dd className="font-semibold text-[#16a34a]">{product.marginPct === null ? "Sem dados" : `${product.marginPct}%`}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="col-span-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.label} className="rounded-[16px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <span className="text-[28px] font-semibold tracking-[-0.02em] text-black">{metric.value}</span>
              <p className="mt-1 text-[13px] text-[#6b6b6b]">{metric.label}</p>
            </article>
          ))}
        </section>

        <section className="col-span-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <article className="rounded-[16px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:col-span-2">
            <header className="mb-5 flex items-center justify-between">
              <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-black">
                Publicados recentemente
              </h2>
              <button
                type="button"
                onClick={() => navigate("/dashboard/publicacoes")}
                className="text-[13px] font-medium text-[#6b6b6b] transition hover:text-black"
              >
                Ver tudo
              </button>
            </header>

            {publicationsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-14 animate-pulse rounded-[10px] bg-[#f4f4f4]" />
                ))}
              </div>
            ) : recentlyPublished.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-[#e5e5e5] px-6 py-10 text-center text-[14px] text-[#6b6b6b]">
                Nenhum produto publicado ainda.
              </div>
            ) : (
              <ul className="divide-y divide-[#f1f1f1]">
                {recentlyPublished.map((item) => {
                  const margin = getPublicationMargin(item);
                  return (
                    <li key={item.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                      {item.thumbnail ? (
                        <div className="h-12 w-12 flex-shrink-0 rounded-[8px] bg-[#f4f4f4] bg-cover bg-center" style={{ backgroundImage: `url(${item.thumbnail})` }} />
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#f4f4f4] text-[13px] font-semibold text-[#8a8a8a]">
                          {productFallback(item.title)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-black">{item.title}</p>
                        <p className="mt-0.5 text-[12px] text-[#6b6b6b]">
                          {item.price ? formatBRL(Number(item.price)) : "Preco sem registro"}
                          {margin !== null ? ` · margem ${margin}%` : ""}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          item.status === "active" || item.status === "published"
                            ? "bg-[#e8f5ec] text-[#16a34a]"
                            : "bg-[#f4f4f4] text-[#6b6b6b]"
                        }`}
                      >
                        {item.status ?? "sem status"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>

          <article className="rounded-[16px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h2 className="mb-5 text-[18px] font-semibold tracking-[-0.01em] text-black">
              Atividade da IA
            </h2>
            {publicationsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-12 animate-pulse rounded-[10px] bg-[#f4f4f4]" />
                ))}
              </div>
            ) : aiActivity.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-[#e5e5e5] px-5 py-10 text-center text-[14px] text-[#6b6b6b]">
                Nenhuma atividade da IA registrada ainda.
              </div>
            ) : (
              <ol className="relative space-y-5 border-l border-[#ececec] pl-5">
                {aiActivity.map((activity) => (
                  <li key={activity.id} className="relative">
                    <span className="absolute -left-[23px] top-1.5 h-2 w-2 rounded-full bg-black" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                      {activity.time}
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-[#0a0a0a]">{activity.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
