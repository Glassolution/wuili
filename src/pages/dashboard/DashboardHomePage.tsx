import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ImportProductModal, { type CatalogProduct } from "@/components/dashboard/ImportProductModal";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};

type ApprovalProduct = {
  id: string;
  name: string;
  image: string;
  cost: number;
  suggestedPrice: number;
  marginPct: number;
  catalogProduct: CatalogProduct;
};

type Metric = {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
};

type PublishedItem = {
  id: string;
  name: string;
  image: string;
  status: "ativo" | "pausado";
  sales: number;
  marginPct: number;
};

type AIActivity = {
  id: string;
  time: string;
  text: string;
};

type CuratedProductPayload = {
  id?: string;
  external_id?: string;
  title?: string;
  productName?: string;
  productNameEn?: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  source?: string | null;
  cost?: number | string | null;
  stock_quantity?: number | string | null;
  stock?: number | string | null;
  variants?: unknown;
  cj_product_id?: string | null;
  images?: unknown;
  image?: string;
  image_url?: string;
  thumbnail?: string;
  cost_price?: number | string | null;
  suggested_price?: number | string | null;
  original_price?: number | string | null;
  margin_percent?: number | string | null;
  curation?: {
    score?: number;
    criteria?: {
      margin?: {
        cjPrice?: number | null;
        mlAveragePrice?: number | null;
        estimatedMarginPercent?: number | null;
      };
    };
  };
};

type PublicationRow = {
  id: string;
  user_id: string;
  title: string | null;
  thumbnail: string | null;
  price: number | string | null;
  cost_price: number | string | null;
  status: string | null;
  cj_product_id?: string | null;
  created_at: string;
  published_at: string | null;
};

type OrderRow = {
  id: string;
  product_title: string | null;
  product_image: string | null;
  sale_price: number | string | null;
  cost_price: number | string | null;
  profit: number | string | null;
  status: string | null;
  ordered_at: string | null;
  created_at: string | null;
  cj_product_id?: string | null;
};

type ActivityLogRow = {
  id: string;
  message: string | null;
  created_at: string;
};

const MOCK_APPROVAL: ApprovalProduct[] = [];

const MOCK_METRICS: Metric[] = [
  { label: "Produtos no ML", value: "128", delta: "+6", positive: true },
  { label: "Vendas hoje", value: "R$ 1.847", delta: "+12,4%", positive: true },
  { label: "Vendas do mês", value: "R$ 38.219", delta: "+8,1%", positive: true },
  { label: "Margem média", value: "41%", delta: "-1,2%", positive: false },
];

const MOCK_PUBLISHED: PublishedItem[] = [
  {
    id: "p1",
    name: "Fone Bluetooth Esportivo Pro",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=80",
    status: "ativo",
    sales: 42,
    marginPct: 44,
  },
  {
    id: "p2",
    name: "Garrafa Térmica 1L Inox",
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=200&q=80",
    status: "ativo",
    sales: 31,
    marginPct: 39,
  },
  {
    id: "p3",
    name: "Mochila Antifurto Impermeável",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=200&q=80",
    status: "ativo",
    sales: 28,
    marginPct: 47,
  },
  {
    id: "p4",
    name: "Relógio Smartwatch Série 9",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&q=80",
    status: "pausado",
    sales: 19,
    marginPct: 35,
  },
  {
    id: "p5",
    name: "Câmera de Segurança Wi-Fi",
    image: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=200&q=80",
    status: "ativo",
    sales: 14,
    marginPct: 52,
  },
];

const MOCK_ACTIVITY: AIActivity[] = [
  { id: "a1", time: "08h14", text: "47 produtos analisados no CJ Dropshipping" },
  { id: "a2", time: "08h15", text: "3 produtos selecionados com margem acima de 35%" },
  { id: "a3", time: "Ontem 18h22", text: "5 anúncios otimizados no Mercado Livre" },
  { id: "a4", time: "Ontem 09h02", text: "2 produtos publicados no Mercado Livre" },
  { id: "a5", time: "Anteontem 14h40", text: "Catálogo CJ atualizado — 312 novos itens" },
];

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseImages = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value !== "string" || !value.trim()) return [];
  if (/^https?:\/\//i.test(value.trim())) return [value.trim()];

  try {
    const parsed = JSON.parse(value);
    return parseImages(parsed);
  } catch {
    return [];
  }
};

const getCuratedProductImage = (product: CuratedProductPayload, index: number) =>
  parseImages(product.images)[0] ||
  product.image ||
  product.image_url ||
  product.thumbnail ||
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80";

const mapCuratedProduct = (product: CuratedProductPayload, index: number): ApprovalProduct => {
  const margin = product.curation?.criteria?.margin;
  const cost = toNumber(margin?.cjPrice ?? product.cost_price ?? product.cost, 0);
  const suggestedPrice = toNumber(
    margin?.mlAveragePrice ?? product.suggested_price ?? product.original_price,
    cost > 0 ? Math.round(cost * 2.2 * 100) / 100 : 0,
  );
  const calculatedMargin = cost > 0 && suggestedPrice > 0
    ? Math.round(((suggestedPrice - cost) / suggestedPrice) * 100)
    : 0;
  const image = getCuratedProductImage(product, index);
  const title = product.title || product.name || product.productName || product.productNameEn || "Produto curado pela IA";
  const id = String(product.id ?? product.external_id ?? product.cj_product_id ?? `curated-${index}`);
  const externalId = String(product.external_id ?? product.cj_product_id ?? product.id ?? id);
  const images = parseImages(product.images);
  const stockQuantity = Math.max(1, toNumber(product.stock_quantity ?? product.stock, 100));
  const marginPct = Math.round(toNumber(margin?.estimatedMarginPercent ?? product.margin_percent, calculatedMargin));

  return {
    id,
    name: title,
    image,
    cost,
    suggestedPrice,
    marginPct,
    catalogProduct: {
      id,
      title,
      description: product.description || "Produto selecionado pela IA com potencial de margem para publicação no Mercado Livre.",
      images: images.length ? images : [image],
      cost_price: cost,
      suggested_price: suggestedPrice,
      margin_percent: marginPct,
      category: product.category ?? null,
      source: product.source || "cj",
      original_url: externalId ? `https://www.cjdropshipping.com/product-detail.html?id=${encodeURIComponent(externalId)}` : undefined,
      stock_quantity: stockQuantity,
      external_id: externalId,
      variants: product.variants ?? null,
    },
  };
};

const calculateMarginPct = (price: unknown, cost: unknown, profit?: unknown) => {
  const salePrice = toNumber(price, 0);
  if (salePrice <= 0) return 0;

  const profitValue = profit != null ? toNumber(profit, NaN) : NaN;
  if (Number.isFinite(profitValue)) return Math.round((profitValue / salePrice) * 100);

  const costValue = toNumber(cost, 0);
  return Math.round(((salePrice - costValue) / salePrice) * 100);
};

const sameProduct = (publication: PublicationRow, order: OrderRow) => {
  const pubCjId = publication.cj_product_id ? String(publication.cj_product_id) : "";
  const orderCjId = order.cj_product_id ? String(order.cj_product_id) : "";
  if (pubCjId && orderCjId && pubCjId === orderCjId) return true;

  const pubTitle = String(publication.title ?? "").trim().toLowerCase();
  const orderTitle = String(order.product_title ?? "").trim().toLowerCase();
  return Boolean(pubTitle && orderTitle && pubTitle === orderTitle);
};

const formatActivityTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Agora";

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const buildDashboardFallback = () => ({
  metrics: MOCK_METRICS,
  published: MOCK_PUBLISHED,
  activity: MOCK_ACTIVITY,
});

export default function DashboardHomePage() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["dashboard-home-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, loja_nome")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) {
        console.error("[DashboardHomePage] erro ao buscar perfil:", error);
        return null;
      }

      return data as { display_name?: string | null; loja_nome?: string | null } | null;
    },
  });

  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ["dashboard-home-real-data", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

        const [publicationsResult, ordersResult, activityResult] = await Promise.all([
          supabase
            .from("user_publications" as any)
            .select("id,user_id,title,thumbnail,price,cost_price,status,cj_product_id,created_at,published_at")
            .eq("user_id", user!.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("orders" as any)
            .select("id,product_title,product_image,sale_price,cost_price,profit,status,ordered_at,created_at,cj_product_id")
            .eq("user_id", user!.id)
            .eq("platform", "mercadolivre")
            .neq("status", "cancelled")
            .order("ordered_at", { ascending: false })
            .limit(1000),
          supabase
            .from("ai_activity_logs" as any)
            .select("id,message,created_at")
            .eq("user_id", user!.id)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        if (publicationsResult.error) throw publicationsResult.error;
        if (ordersResult.error) throw ordersResult.error;
        if (activityResult.error) {
          console.warn("[DashboardHomePage] logs de atividade indisponíveis; usando fallback da atividade:", activityResult.error);
        }

        const publications = (publicationsResult.data ?? []) as PublicationRow[];
        const orders = (ordersResult.data ?? []) as OrderRow[];
        const activePublications = publications.filter((publication) => publication.status === "active");
        const monthOrders = orders.filter((order) => new Date(order.ordered_at ?? order.created_at ?? 0) >= monthStart);
        const todayOrders = orders.filter((order) => new Date(order.ordered_at ?? order.created_at ?? 0) >= todayStart);

        const salesToday = todayOrders.reduce((sum, order) => sum + toNumber(order.sale_price, 0), 0);
        const salesMonth = monthOrders.reduce((sum, order) => sum + toNumber(order.sale_price, 0), 0);
        const margins = activePublications
          .map((publication) => calculateMarginPct(publication.price, publication.cost_price))
          .filter((margin) => Number.isFinite(margin));
        const averageMargin = margins.length
          ? Math.round(margins.reduce((sum, margin) => sum + margin, 0) / margins.length)
          : 0;

        const metrics: Metric[] = [
          { label: "Produtos no ML", value: String(activePublications.length) },
          { label: "Vendas hoje", value: formatBRL(salesToday) },
          { label: "Vendas do mês", value: formatBRL(salesMonth) },
          { label: "Margem média", value: `${averageMargin}%` },
        ];

        const published: PublishedItem[] = publications.slice(0, 5).map((publication) => {
          const publicationOrders = orders.filter((order) => sameProduct(publication, order));
          return {
            id: publication.id,
            name: publication.title || "Produto publicado",
            image: publication.thumbnail || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=80",
            status: publication.status === "active" ? "ativo" : "pausado",
            sales: publicationOrders.length,
            marginPct: calculateMarginPct(publication.price, publication.cost_price),
          };
        });

        const activity: AIActivity[] = ((activityResult.data ?? []) as ActivityLogRow[]).map((log) => ({
          id: log.id,
          time: formatActivityTime(log.created_at),
          text: log.message || "Atividade registrada pela IA",
        }));

        return {
          metrics,
          published,
          activity,
        };
      } catch (error) {
        console.warn("[DashboardHomePage] usando fallback de dados do dashboard:", error);
        return buildDashboardFallback();
      }
    },
    staleTime: 1000 * 60 * 2,
  });

  const {
    data: curatedProducts,
    isLoading: isCuratedLoading,
    isError: isCuratedError,
    refetch: refetchCurated,
    isFetching: isCuratedFetching,
  } = useQuery({
    queryKey: ["dashboard-home-curated-products", user?.id],
    enabled: !!user?.id,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-curated-products", {
        body: { userId: user?.id },
      });
      if (error) throw error;
      const products = Array.isArray(data?.products) ? data.products : [];
      return products.slice(0, 3).map((p: CuratedProductPayload, index: number) => mapCuratedProduct(p, index));
    },
    staleTime: 1000 * 60 * 15,
  });


  const firstName = useMemo(() => {
    const metadataName =
      (user?.user_metadata?.name as string | undefined) ??
      (user?.user_metadata?.full_name as string | undefined);
    const source = profile?.display_name?.trim() || metadataName || "";
    return source ? source.split(" ")[0] : "";
  }, [profile?.display_name, user?.user_metadata]);

  const approvalQueue = curatedProducts ?? [];
  const metrics = dashboardData?.metrics ?? MOCK_METRICS;
  const published = dashboardData?.published ?? MOCK_PUBLISHED;
  const activity = dashboardData?.activity?.length ? dashboardData.activity : MOCK_ACTIVITY;

  const analyzedCount = approvalQueue.length;
  const pendingCount = approvalQueue.length;

  return (
    <>
    <main className="min-h-full w-full bg-[#F4F4F4] text-[#0a0a0a] antialiased [font-family:'Hanken_Grotesk',-apple-system,BlinkMacSystemFont,'Helvetica_Neue',Arial,sans-serif]">
      <div className="grid w-full grid-cols-12 gap-4">
        <header className="col-span-12 flex flex-col gap-2 rounded-[14px] bg-white/70 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-black">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}.
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#16a34a] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#16a34a]" />
            </span>
            <p className="text-sm font-medium text-[#4a4a4a]">
              {isCuratedLoading ? "IA buscando produtos reais..." : `Última varredura: ${analyzedCount} analisados, `}
              {!isCuratedLoading && (
                <span className="font-semibold text-black">{pendingCount} aguardando aprovação</span>
              )}
            </p>
          </div>
        </header>

        <section className="col-span-12 rounded-[16px] bg-[#111] p-4 text-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-5">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.01em]">
                Produtos encontrados pela IA hoje
              </h2>
              <p className="mt-1 text-sm text-white/60">
                Revise e aprove para publicar automaticamente no Mercado Livre.
              </p>
            </div>
          </div>

          {isCuratedLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-[300px] animate-pulse rounded-[14px] bg-white/10" />
              ))}
            </div>
          ) : isCuratedError ? (
            <div className="flex flex-col items-center gap-3 rounded-[12px] border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
              <p className="text-[15px] text-white/80">Erro ao buscar produtos. Tente novamente.</p>
              <button
                type="button"
                onClick={() => refetchCurated()}
                disabled={isCuratedFetching}
                className="h-9 rounded-[8px] bg-white px-4 text-[13px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
              >
                {isCuratedFetching ? "Tentando..." : "Tentar novamente"}
              </button>
            </div>
          ) : approvalQueue.length === 0 ? (
            <div className="rounded-[12px] border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-[15px] text-white/70">
              Nenhum produto com margem suficiente no momento. A IA continua varrendo.
            </div>

          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {approvalQueue.map((p) => (
                <article
                  key={p.id}
                  className="flex max-h-[340px] flex-col overflow-hidden rounded-[14px] bg-white text-[#0a0a0a]"
                >
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-36 w-full bg-[#f4f4f4] object-contain p-2"
                    loading="lazy"
                  />
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="line-clamp-2 min-h-[36px] text-[14px] font-semibold leading-snug">
                      {p.name}
                    </h3>
                    <dl className="mt-2 space-y-1 text-[12px]">
                      <div className="flex justify-between text-[#6b6b6b]">
                        <dt>Custo</dt>
                        <dd className="font-medium text-[#0a0a0a]">{formatBRL(p.cost)}</dd>
                      </div>
                      <div className="flex justify-between text-[#6b6b6b]">
                        <dt>Sugerido</dt>
                        <dd className="font-medium text-[#0a0a0a]">{formatBRL(p.suggestedPrice)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#6b6b6b]">Margem</dt>
                        <dd className="font-semibold text-[#16a34a]">{p.marginPct}%</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(p.catalogProduct)}
                        className="h-9 rounded-[8px] bg-black text-[13px] font-semibold text-white transition hover:bg-[#1f1f1f]"
                      >
                        Aprovar e Publicar
                      </button>
                      <button
                        type="button"
                        className="h-8 rounded-[8px] text-[12px] font-medium text-[#6b6b6b] transition hover:text-[#0a0a0a]"
                      >
                        Ignorar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="col-span-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {metrics.map((m) => (
            <article
              key={m.label}
              className="rounded-[16px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-semibold tracking-[-0.02em] text-black">
                  {isDashboardLoading ? "..." : m.value}
                </span>
                {!isDashboardLoading && m.delta && (
                  <span
                    className={`text-[13px] font-semibold ${
                      m.positive ? "text-[#16a34a]" : "text-[#dc2626]"
                    }`}
                  >
                    {m.delta}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[13px] text-[#6b6b6b]">{m.label}</p>
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

            {isDashboardLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded-[10px] bg-[#f4f4f4]" />
                ))}
              </div>
            ) : published.length === 0 ? (
              <div className="rounded-[12px] bg-[#f7f7f7] px-4 py-8 text-center text-[13px] text-[#6b6b6b]">
                Nenhum produto publicado ainda.
              </div>
            ) : (
              <ul className="divide-y divide-[#f1f1f1]">
                {published.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-12 w-12 flex-shrink-0 rounded-[8px] bg-[#f4f4f4] object-cover"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-black">{item.name}</p>
                      <p className="mt-0.5 text-[12px] text-[#6b6b6b]">
                        {item.sales} vendas · margem {item.marginPct}%
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        item.status === "ativo"
                          ? "bg-[#e8f5ec] text-[#16a34a]"
                          : "bg-[#f4f4f4] text-[#6b6b6b]"
                      }`}
                    >
                      {item.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-[16px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h2 className="mb-5 text-[18px] font-semibold tracking-[-0.01em] text-black">
              Atividade da IA
            </h2>
            {isDashboardLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-10 animate-pulse rounded-[10px] bg-[#f4f4f4]" />
                ))}
              </div>
            ) : (
              <ol className="relative space-y-5 border-l border-[#ececec] pl-5">
                {activity.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[23px] top-1.5 h-2 w-2 rounded-full bg-black" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                      {a.time}
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-[#0a0a0a]">{a.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </article>
        </section>
      </div>
    </main>
    <ImportProductModal
      open={!!selectedProduct}
      onClose={() => setSelectedProduct(null)}
      product={selectedProduct}
    />
    </>
  );
}
