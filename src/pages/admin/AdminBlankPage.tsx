import { type ElementType, type ReactNode, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Download,
  FileText,
  Headphones,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  PackageCheck,
  Percent,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  UserCircle,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type SubscriptionRow = Pick<
  Database["public"]["Tables"]["subscriptions"]["Row"],
  "amount" | "created_at" | "updated_at" | "status" | "plan" | "is_trial"
>;

type OrderRow = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "created_at" | "ordered_at" | "platform" | "profit" | "status" | "total_amount"
>;

type PublicationRow = Pick<
  Database["public"]["Tables"]["user_publications"]["Row"],
  "created_at" | "price" | "published_at" | "status" | "title"
>;

type CatalogProductRow = Pick<
  Database["public"]["Tables"]["catalog_products"]["Row"],
  "category" | "margin_percent" | "orders_count" | "suggested_price" | "title"
>;

type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "display_name" | "store_name">;

type CountResult = {
  count: number | null;
  error: { message?: string } | null;
};

type AdminPanelData = {
  counts: {
    users: number;
    products: number;
    publications: number;
    orders: number;
    activeSubscriptions: number;
    openTickets: number;
    pendingRefunds: number;
  };
  subscriptions: SubscriptionRow[];
  orders: OrderRow[];
  publications: PublicationRow[];
  products: CatalogProductRow[];
  profiles: ProfileRow[];
};

type MonthPoint = {
  key: string;
  label: string;
  receita: number;
};

type DayPoint = {
  label: string;
  usuarios: number;
};

const emptyData: AdminPanelData = {
  counts: {
    users: 0,
    products: 0,
    publications: 0,
    orders: 0,
    activeSubscriptions: 0,
    openTickets: 0,
    pendingRefunds: 0,
  },
  subscriptions: [],
  orders: [],
  publications: [],
  products: [],
  profiles: [],
};

const readCount = (result: CountResult) => (result.error ? 0 : result.count ?? 0);

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Number(value || 0));

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const buildMonthSeries = (subscriptions: SubscriptionRow[]): MonthPoint[] => {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: getMonthKey(date),
      label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", ""),
      receita: 0,
    };
  });

  const byKey = new Map(months.map((month) => [month.key, month]));

  subscriptions.forEach((subscription) => {
    const sourceDate = subscription.updated_at ?? subscription.created_at;
    if (!sourceDate) return;
    const month = byKey.get(getMonthKey(new Date(sourceDate)));
    if (!month) return;
    month.receita += Number(subscription.amount ?? 0);
  });

  return months;
};

const buildUserDaySeries = (profiles: ProfileRow[]): DayPoint[] => {
  const now = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", ""),
      usuarios: profiles.filter((profile) => (profile.created_at ?? "").slice(0, 10) === key).length,
    };
  });
};

const getActiveRevenue = (subscriptions: SubscriptionRow[]) =>
  subscriptions
    .filter((subscription) => ["active", "paid", "approved", "authorized"].includes(subscription.status.toLowerCase()))
    .reduce((sum, subscription) => sum + Number(subscription.amount ?? 0), 0);

const getGrossRevenue = (orders: OrderRow[], subscriptions: SubscriptionRow[]) => {
  const ordersRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
  const subscriptionsRevenue = subscriptions.reduce((sum, subscription) => sum + Number(subscription.amount ?? 0), 0);
  return ordersRevenue + subscriptionsRevenue;
};

const fetchAdminPanelData = async (): Promise<AdminPanelData> => {
  const [
    usersCount,
    productsCount,
    publicationsCount,
    ordersCount,
    activeSubscriptionsCount,
    openTicketsCount,
    pendingRefundsCount,
    subscriptionsResult,
    ordersResult,
    publicationsResult,
    productsResult,
    profilesResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("catalog_products").select("id", { count: "exact", head: true }).eq("is_blocked", false),
    supabase.from("user_publications").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "paid", "approved"]),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("refund_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("subscriptions")
      .select("amount,created_at,updated_at,status,plan,is_trial")
      .order("updated_at", { ascending: false })
      .limit(120),
    supabase
      .from("orders")
      .select("created_at,ordered_at,platform,profit,status,total_amount")
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("user_publications")
      .select("created_at,price,published_at,status,title")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("catalog_products")
      .select("category,margin_percent,orders_count,suggested_price,title")
      .eq("is_blocked", false)
      .order("orders_count", { ascending: false, nullsFirst: false })
      .limit(8),
    supabase
      .from("profiles")
      .select("created_at,display_name,store_name")
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  return {
    counts: {
      users: readCount(usersCount),
      products: readCount(productsCount),
      publications: readCount(publicationsCount),
      orders: readCount(ordersCount),
      activeSubscriptions: readCount(activeSubscriptionsCount),
      openTickets: readCount(openTicketsCount),
      pendingRefunds: readCount(pendingRefundsCount),
    },
    subscriptions: subscriptionsResult.error ? [] : subscriptionsResult.data ?? [],
    orders: ordersResult.error ? [] : ordersResult.data ?? [],
    publications: publicationsResult.error ? [] : publicationsResult.data ?? [],
    products: productsResult.error ? [] : productsResult.data ?? [],
    profiles: profilesResult.error ? [] : profilesResult.data ?? [],
  };
};

const AdminBlankPage = () => {
  const { user } = useAuth();
  const { data = emptyData, isLoading } = useQuery({
    queryKey: ["admin-panel-command-center"],
    queryFn: fetchAdminPanelData,
    refetchInterval: 30000,
  });

  const monthSeries = useMemo(() => buildMonthSeries(data.subscriptions), [data.subscriptions]);
  const usersByDay = useMemo(() => buildUserDaySeries(data.profiles), [data.profiles]);
  const activeRevenue = useMemo(() => getActiveRevenue(data.subscriptions), [data.subscriptions]);
  const grossRevenue = useMemo(() => getGrossRevenue(data.orders, data.subscriptions), [data.orders, data.subscriptions]);
  const openWork = data.counts.openTickets + data.counts.pendingRefunds;
  const avgMargin = data.products.length
    ? data.products.reduce((sum, product) => sum + Number(product.margin_percent ?? 0), 0) / data.products.length
    : 0;

  const platformSummary = useMemo(() => {
    const byPlatform = new Map<string, number>();
    data.orders.forEach((order) => {
      const platform = order.platform || "Sem origem";
      byPlatform.set(platform, (byPlatform.get(platform) ?? 0) + 1);
    });
    return Array.from(byPlatform, ([name, value]) => ({ name, value })).slice(0, 5);
  }, [data.orders]);

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-[280px] shrink-0 border-r border-white/[0.07] bg-[#111111] lg:flex lg:flex-col">
          <div className="flex h-[74px] items-center justify-between border-b border-white/[0.06] px-7">
            <Link to="/admin/dashboard" className="flex items-center gap-3">
              <VeloMark />
              <div>
                <p className="text-[19px] font-semibold tracking-[-0.04em]">VeloMetric</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/36">Admin</p>
              </div>
            </Link>
            <Link
              to="/dashboard"
              className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-white/10 bg-white/[0.03] text-white/70 transition hover:bg-white hover:text-black"
              aria-label="Voltar para a Velo"
            >
              <Home size={15} />
            </Link>
          </div>

          <div className="flex-1 px-5 py-6">
            <Link
              to="/admin/painel"
              className="mb-6 flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.055] text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              <Activity size={15} />
              Visão operacional
            </Link>

            <nav className="space-y-8">
              <AdminNavGroup
                title="Monitoramento"
                items={[
                  { icon: LayoutDashboard, label: "Painel", to: "/admin/painel", active: true },
                  { icon: BarChart3, label: "Product Analytics", to: "/admin/dashboard#analytics" },
                  { icon: FileText, label: "Reporting", to: "/admin/dashboard#historico" },
                  { icon: ReceiptText, label: "Order summary", to: "/dashboard/pedidos" },
                  { icon: Percent, label: "Comissões", to: "/admin/comissoes" },
                  { icon: Users, label: "Usuários", to: "/admin/usuarios" },
                ]}
              />
              <AdminNavGroup
                title="Preferences"
                items={[
                  { icon: Store, label: "Lojas", to: "/dashboard/configuracoes?tab=Minhas%20Lojas" },
                  { icon: PackageCheck, label: "Catálogo", to: "/dashboard/catalogo" },
                  { icon: Headphones, label: "Suporte", to: "/admin/suporte" },
                  { icon: Settings, label: "Settings", to: "/dashboard/configuracoes" },
                  { icon: LifeBuoy, label: "Help and support", to: "/admin/suporte" },
                ]}
              />
            </nav>
          </div>

          <div className="space-y-5 border-t border-white/[0.06] p-5">
            <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black">
                  <ShieldCheck size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] text-white/58">Admin ID</p>
                  <p className="truncate text-[14px] font-semibold tracking-[-0.02em]">
                    {(user?.id ?? "VELO").slice(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
            <Link
              to="/dashboard"
              className="flex items-center gap-2 rounded-[10px] px-2 py-2 text-[13px] font-medium text-white/54 transition hover:bg-white/[0.04] hover:text-white"
            >
              <ArrowLeft size={15} />
              Voltar à Velo
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-[#f5f5f4] text-[#111111]">
          <header className="sticky top-0 z-10 border-b border-black/[0.08] bg-white/94 px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur-xl sm:px-6 lg:px-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="lg:hidden">
                  <VeloMark />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">
                    Admin Velo
                  </p>
                  <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.05em] sm:text-[34px]">
                    Painel de controle
                  </h1>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <label className="flex h-11 min-w-0 items-center gap-3 rounded-[12px] border border-black/[0.10] bg-[#f7f7f7] px-4 text-black/42 md:w-[360px]">
                  <Search size={16} />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-black outline-none placeholder:text-black/38"
                    placeholder="Buscar usuário, pedido ou produto..."
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button className="h-11 rounded-[12px] border border-black/[0.12] bg-white px-4 text-[13px] font-semibold text-black/74 transition hover:bg-black hover:text-white">
                    Mensal
                  </button>
                  <button className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-black/[0.12] bg-white px-4 text-[13px] font-semibold text-black/62 transition hover:bg-black hover:text-white">
                    <Download size={15} />
                    Exportar
                  </button>
                  <button className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-black px-4 text-[13px] font-semibold text-white transition hover:bg-black/82">
                    <Plus size={15} />
                    Relatório
                  </button>
                  <button className="hidden h-11 w-11 items-center justify-center rounded-[12px] border border-black/[0.12] bg-white text-black/60 transition hover:bg-black hover:text-white sm:flex">
                    <Bell size={16} />
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="px-4 py-5 sm:px-6 lg:px-7">
            {isLoading ? (
              <div className="flex min-h-[540px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-black/70" />
              </div>
            ) : (
              <div className="space-y-5">
                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    icon={Users}
                    label="Usuários totais"
                    value={formatNumber(data.counts.users)}
                    hint={`${formatNumber(data.counts.activeSubscriptions)} assinaturas ativas`}
                    tone="pink"
                  />
                  <MetricCard
                    icon={CircleDollarSign}
                    label="Receita ativa"
                    value={formatBRL(activeRevenue)}
                    hint={`${formatBRL(grossRevenue)} no histórico carregado`}
                    tone="green"
                  />
                  <MetricCard
                    icon={PackageCheck}
                    label="Catálogo Velo"
                    value={formatNumber(data.counts.products)}
                    hint={`${Math.round(avgMargin)}% margem média dos destaques`}
                    tone="blue"
                  />
                  <MetricCard
                    icon={Headphones}
                    label="Pendências"
                    value={formatNumber(openWork)}
                    hint={`${data.counts.openTickets} suporte · ${data.counts.pendingRefunds} reembolsos`}
                    tone="white"
                  />
                </section>

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.8fr)]">
                  <Panel className="min-h-[472px]">
                    <PanelHeader
                      eyebrow="Revenue"
                      title="Receita recorrente"
                      right={
                        <FilterButton>
                          <CalendarDays size={14} />
                          Últimos 6 meses
                          <ChevronDown size={14} />
                        </FilterButton>
                      }
                    />
                    <div className="mt-4 flex items-end gap-3">
                      <p className="text-[34px] font-semibold tracking-[-0.06em]">{formatBRL(activeRevenue)}</p>
                      <p className="pb-2 text-[13px] text-emerald-600">assinaturas ativas</p>
                    </div>
                    <div className="mt-6 h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthSeries}>
                          <defs>
                            <linearGradient id="veloRevenue" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#111111" stopOpacity={0.16} />
                              <stop offset="70%" stopColor="#111111" stopOpacity={0.035} />
                              <stop offset="100%" stopColor="#111111" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "rgba(0,0,0,.42)", fontSize: 12 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(0,0,0,.35)", fontSize: 11 }} width={56} />
                          <Tooltip content={<ChartTooltip formatter={formatBRL} />} />
                          <Area
                            type="monotone"
                            dataKey="receita"
                            stroke="#111111"
                            strokeWidth={2.4}
                            fill="url(#veloRevenue)"
                            dot={{ r: 3, fill: "#111111", strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>

                  <div className="grid gap-5">
                    <Panel>
                      <PanelHeader eyebrow="Operação" title="Produtos em alta" />
                      <div className="mt-5 space-y-3">
                        {data.products.length ? (
                          data.products.slice(0, 5).map((product, index) => (
                            <ProductPulse key={`${product.title}-${index}`} product={product} index={index} />
                          ))
                        ) : (
                          <EmptyPanel text="Nenhum produto do catálogo disponível para ranquear." />
                        )}
                      </div>
                    </Panel>

                    <Panel>
                      <PanelHeader eyebrow="Aquisição" title="Novos usuários" />
                      <div className="mt-5 h-[154px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={usersByDay}>
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "rgba(0,0,0,.42)", fontSize: 11 }} />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar dataKey="usuarios" fill="#111111" radius={[7, 7, 2, 2]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Panel>
                  </div>
                </section>

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
                  <Panel>
                    <PanelHeader
                      eyebrow="Publicação"
                      title="Fluxo do marketplace"
                      right={<FilterButton>{data.counts.publications} anúncios</FilterButton>}
                    />
                    <div className="mt-6 grid gap-3 md:grid-cols-4">
                      <FlowStep label="Catálogo" value={data.counts.products} icon={Boxes} />
                      <FlowStep label="Publicados" value={data.counts.publications} icon={PackageCheck} />
                      <FlowStep label="Pedidos" value={data.counts.orders} icon={ShoppingCart} />
                      <FlowStep label="Assinantes" value={data.counts.activeSubscriptions} icon={Users} />
                    </div>
                    <div className="mt-6 overflow-hidden rounded-[16px] border border-black/[0.08]">
                      <table className="w-full min-w-[720px] text-left text-[13px]">
                        <thead className="bg-black/[0.035] text-black/45">
                          <tr>
                            <th className="px-4 py-3 font-medium">Publicação</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Data</th>
                            <th className="px-4 py-3 text-right font-medium">Preço</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.publications.length ? (
                            data.publications.slice(0, 6).map((publication, index) => (
                              <tr key={`${publication.title}-${index}`} className="border-t border-black/[0.06] text-black/58">
                                <td className="max-w-[360px] truncate px-4 py-3 font-medium text-black">
                                  {publication.title}
                                </td>
                                <td className="px-4 py-3">
                                  <StatusPill value={publication.status ?? "pendente"} />
                                </td>
                                <td className="px-4 py-3">
                                  {formatDate(publication.published_at ?? publication.created_at)}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-black">
                                  {formatBRL(Number(publication.price ?? 0))}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-10 text-center text-black/38">
                                Nenhuma publicação encontrada.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Panel>

                  <div className="grid gap-5">
                    <Panel>
                      <PanelHeader eyebrow="Canais" title="Pedidos por plataforma" />
                      <div className="mt-5 space-y-3">
                        {platformSummary.length ? (
                          platformSummary.map((item) => <PlatformRow key={item.name} label={item.name} value={item.value} total={data.counts.orders} />)
                        ) : (
                          <EmptyPanel text="Os pedidos aparecerão aqui quando o Mercado Livre enviar eventos." />
                        )}
                      </div>
                    </Panel>

                    <Panel>
                      <PanelHeader eyebrow="Sistema" title="Sinais rápidos" />
                      <div className="mt-5 grid gap-3">
                        <SignalRow label="Suporte aberto" value={data.counts.openTickets} tone={data.counts.openTickets ? "warning" : "ok"} />
                        <SignalRow label="Reembolsos pendentes" value={data.counts.pendingRefunds} tone={data.counts.pendingRefunds ? "warning" : "ok"} />
                        <SignalRow label="Trials ativos" value={data.subscriptions.filter((item) => item.is_trial).length} tone="neutral" />
                      </div>
                    </Panel>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const AdminNavGroup = ({
  title,
  items,
}: {
  title: string;
  items: Array<{ icon: ElementType; label: string; to: string; active?: boolean }>;
}) => (
  <div>
    <p className="mb-3 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-white/58">{title}</p>
    <div className="space-y-1.5">
      {items.map(({ icon: Icon, label, to, active }) => (
        <Link
          key={label}
          to={to}
          className={cn(
            "group flex min-h-9 items-center justify-between rounded-[8px] border px-3 text-[14px] transition duration-200",
            active
              ? "border-white/[0.10] bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
              : "border-transparent text-white/55 hover:border-white/[0.07] hover:bg-white/[0.035] hover:text-white"
          )}
        >
          <span className="flex items-center gap-2.5">
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </span>
        </Link>
      ))}
    </div>
  </div>
);

const MetricCard = ({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ElementType;
  label: string;
  value: string;
  hint: string;
  tone: "pink" | "green" | "blue" | "white";
}) => {
  const toneClass = {
    pink: "bg-rose-200 text-black",
    green: "bg-emerald-200 text-black",
    blue: "bg-sky-200 text-black",
    white: "bg-black text-white",
  }[tone];

  return (
    <article className="min-h-[146px] rounded-[18px] border border-black/[0.08] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-[9px]", toneClass)}>
          <Icon size={16} />
        </span>
        <span className="text-[11px] text-black/34">ao vivo</span>
      </div>
      <p className="mt-6 text-[13px] text-black/56">{label}</p>
      <p className="mt-2 text-[27px] font-semibold tracking-[-0.055em] text-black">{value}</p>
      <p className="mt-2 text-[12px] text-black/42">{hint}</p>
    </article>
  );
};

const Panel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <section
    className={cn(
      "rounded-[22px] border border-black/[0.08] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
      className
    )}
  >
    {children}
  </section>
);

const PanelHeader = ({ eyebrow, title, right }: { eyebrow: string; title: string; right?: ReactNode }) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/34">{eyebrow}</p>
      <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.04em] text-black">{title}</h2>
    </div>
    {right}
  </div>
);

const FilterButton = ({ children }: { children: ReactNode }) => (
  <button className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-black/[0.10] bg-white px-3 text-[12px] font-medium text-black/58">
    {children}
  </button>
);

const FlowStep = ({ label, value, icon: Icon }: { label: string; value: number; icon: ElementType }) => (
  <div className="rounded-[16px] border border-black/[0.07] bg-black/[0.025] p-4">
    <div className="flex items-center justify-between">
      <Icon size={17} className="text-black/54" />
      <span className="text-[11px] text-black/30">Velo</span>
    </div>
    <p className="mt-5 text-[12px] text-black/50">{label}</p>
    <p className="mt-1 text-[24px] font-semibold tracking-[-0.055em] text-black">{formatNumber(value)}</p>
  </div>
);

const ProductPulse = ({ product, index }: { product: CatalogProductRow; index: number }) => (
  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border border-black/[0.06] bg-black/[0.025] px-3 py-3">
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-[12px] font-semibold text-white">
      {index + 1}
    </span>
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold text-black">{product.title}</p>
      <p className="mt-0.5 truncate text-[11px] text-black/42">{product.category ?? "Sem categoria"}</p>
    </div>
    <div className="text-right">
      <p className="text-[12px] font-semibold text-emerald-700">{formatNumber(product.orders_count ?? 0)}</p>
      <p className="text-[10px] text-black/34">pedidos</p>
    </div>
  </div>
);

const PlatformRow = ({ label, value, total }: { label: string; value: number; total: number }) => {
  const percent = total ? Math.max((value / total) * 100, 3) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[12px]">
        <span className="font-medium text-black/68">{label}</span>
        <span className="text-black/40">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/[0.08]">
        <div className="h-full rounded-full bg-black" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const SignalRow = ({ label, value, tone }: { label: string; value: number; tone: "ok" | "warning" | "neutral" }) => (
  <div className="flex items-center justify-between rounded-[13px] border border-black/[0.06] bg-black/[0.025] px-3 py-3">
    <span className="text-[13px] text-black/58">{label}</span>
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone === "ok" && "bg-emerald-200 text-black",
        tone === "warning" && "bg-amber-200 text-black",
        tone === "neutral" && "bg-black/[0.08] text-black/64"
      )}
    >
      {value}
    </span>
  </div>
);

const StatusPill = ({ value }: { value: string }) => {
  const normalized = value.toLowerCase();
  const isActive = ["active", "published", "approved", "ativo", "publicado"].includes(normalized);
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
        isActive ? "bg-emerald-200 text-black" : "bg-black/[0.08] text-black/54"
      )}
    >
      {value}
    </span>
  );
};

const EmptyPanel = ({ text }: { text: string }) => (
  <div className="flex min-h-[132px] items-center justify-center rounded-[16px] border border-dashed border-black/[0.12] bg-black/[0.025] px-4 text-center text-[13px] leading-5 text-black/40">
    {text}
  </div>
);

const ChartTooltip = ({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string }>;
  label?: string;
  formatter?: (value: number) => string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[12px] border border-black/[0.10] bg-white px-3 py-2 text-[12px] text-black shadow-2xl">
      <p className="mb-1 text-black/42">{label}</p>
      {payload.map((item) => (
        <p key={item.name ?? "valor"} className="font-semibold">
          {formatter ? formatter(Number(item.value ?? 0)) : formatNumber(Number(item.value ?? 0))}
        </p>
      ))}
    </div>
  );
};

const formatDate = (value: string | null) => {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const VeloMark = () => (
  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
    <svg width="22" height="22" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M33 18A11 11 0 1 0 33 30" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M30 26L34 30L38 26" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

export default AdminBlankPage;
