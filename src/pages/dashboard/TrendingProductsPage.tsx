import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  FilePlus2,
  Loader2,
  PackageOpen,
  RefreshCcw,
  Star,
  Store,
  TrendingUp,
  X,
} from "lucide-react";
import { getActiveStore } from "@/components/dashboard/FirstStoreOnboarding";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import type { ExampleProduct } from "@/pages/StartChoicePage";

type Period = "today" | "week" | "month";
type SortBy = "score" | "demand" | "margin" | "rating" | "recent" | "price_asc" | "price_desc";

type TrendingProductsRpcArgs = {
  niche: string | null;
  period: Period;
  sort_by: SortBy;
  page: number;
  page_size: number;
};

type TrendingProduct = {
  id: string;
  title: string;
  image: string | null;
  images: unknown;
  category: string | null;
  brand: string | null;
  suggested_price: number | null;
  cost_price: number | null;
  original_price: number | null;
  margin_percent: number | null;
  rating: number | null;
  orders_count: number | null;
  stock_quantity: number | null;
  scraped_at: string | null;
  demand_score: number | null;
  margin_score: number | null;
  ease_score: number | null;
  viral_score: number | null;
  score: number | null;
  total_count: number | null;
};

type TrendingProductsRpcClient = {
  rpc: (
    fn: "get_trending_products",
    args: TrendingProductsRpcArgs,
  ) => Promise<{ data: TrendingProduct[] | null; error: { message?: string } | null }>;
};

const PAGE_SIZE = 20;
const FALLBACK_IMG = "/placeholder.svg";

const niches = [
  { label: "Todos os nichos", value: null },
  { label: "Eletrônicos", value: "Eletrônicos" },
  { label: "Casa", value: "Casa" },
  { label: "Moda", value: "Moda" },
  { label: "Beleza", value: "Beleza" },
  { label: "Saúde", value: "Saúde" },
  { label: "Decoração", value: "Decoração" },
  { label: "Automotivo", value: "Automotivo" },
  { label: "Outros", value: "Outros" },
];

const periodOptions: Array<{ label: string; value: Period }> = [
  { label: "Hoje", value: "today" },
  { label: "Semana", value: "week" },
  { label: "Mês", value: "month" },
];

const sortOptions: Array<{ label: string; value: SortBy }> = [
  { label: "Ranking Velo", value: "score" },
  { label: "Mais vendido", value: "demand" },
  { label: "Maior margem", value: "margin" },
  { label: "Melhor avaliação", value: "rating" },
  { label: "Mais recente", value: "recent" },
  { label: "Menor preço", value: "price_asc" },
  { label: "Maior preço", value: "price_desc" },
];

const formatBRL = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatNumber = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });

const getImageFromPayload = (images: unknown): string | null => {
  if (Array.isArray(images)) {
    const first = images.find((item): item is string => typeof item === "string" && item.trim().length > 0);
    return first ?? null;
  }

  if (typeof images === "string") {
    const trimmed = images.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);
      return getImageFromPayload(parsed);
    } catch {
      return trimmed;
    }
  }

  return null;
};

const getProductImage = (product: TrendingProduct) =>
  product.image || getImageFromPayload(product.images) || FALLBACK_IMG;

const toOnboardingProduct = (product: TrendingProduct): ExampleProduct => ({
  id: product.id,
  title: product.title,
  price: Number(product.cost_price ?? product.suggested_price ?? product.original_price ?? 0),
  imageUrl: getProductImage(product),
});

const primeFirstStoreOnboarding = (product: TrendingProduct) => {
  const flowProduct = toOnboardingProduct(product);

  try {
    sessionStorage.setItem("velo-example-product", JSON.stringify(flowProduct));
    sessionStorage.setItem("velo-example-products", JSON.stringify([flowProduct]));
    sessionStorage.setItem("velo-store-language", "Português (Brasil)");
    sessionStorage.setItem("velo-customer-persona", "Comprador Prático");
    sessionStorage.setItem("velo-sales-angle", "Uma Escolha Inteligente");
  } catch {
    // O fluxo também recebe o produto por state; storage é continuidade entre reloads.
  }

  return flowProduct;
};

const SalesPageSoonModal = ({ product, onClose }: { product: TrendingProduct; onClose: () => void }) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
    <section className="w-full max-w-[460px] overflow-hidden rounded-[26px] bg-white text-[#111827] shadow-[0_30px_100px_rgba(15,23,42,0.28)]">
      <div className="flex items-center justify-between border-b border-black/[0.06] bg-[#F4F5F7] px-6 py-5">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8A93A3]">Em breve</p>
          <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.045em]">Página de vendas individual</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#7B8494] transition hover:bg-black/[0.05] hover:text-[#111827]"
          aria-label="Fechar"
        >
          <X size={19} strokeWidth={1.7} />
        </button>
      </div>
      <div className="p-6">
        <div className="flex gap-4 rounded-[18px] border border-black/[0.08] bg-[#FAFAFA] p-3">
          <img src={getProductImage(product)} alt="" className="h-16 w-16 rounded-[14px] bg-white object-contain" />
          <div className="min-w-0">
            <p className="line-clamp-2 text-[14px] font-semibold leading-5 text-[#111827]">{product.title}</p>
            <p className="mt-1 text-[12px] text-[#7B8494]">A loja atual será preservada.</p>
          </div>
        </div>
        <p className="mt-5 text-[14px] leading-6 text-[#667085]">
          A criação de páginas individuais por produto ainda será escopada. Por enquanto, continue usando a sua loja ativa e o editor principal.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-11 w-full rounded-[14px] bg-black text-[14px] font-semibold text-white transition hover:bg-[#1E1E1E]"
        >
          Entendi
        </button>
      </div>
    </section>
  </div>
);

const TrendingProductsPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<TrendingProduct[]>([]);
  const [niche, setNiche] = useState<string | null>("Eletrônicos");
  const [period, setPeriod] = useState<Period>("week");
  const [sortBy, setSortBy] = useState<SortBy>("score");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salesPageSoonProduct, setSalesPageSoonProduct] = useState<TrendingProduct | null>(null);

  const totalCount = products[0]?.total_count ?? products.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startItem = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, totalCount);

  const selectedNicheLabel = useMemo(
    () => niches.find((item) => item.value === niche)?.label ?? "Todos os nichos",
    [niche],
  );

  useEffect(() => {
    let mounted = true;
    const fetchTrendingProducts = async () => {
      setError(null);
      setLoading(true);

      const { data, error: rpcError } = await (supabase as unknown as TrendingProductsRpcClient).rpc("get_trending_products", {
        niche,
        period,
        sort_by: sortBy,
        page,
        page_size: PAGE_SIZE,
      });

      if (!mounted) return;

      if (rpcError) {
        setProducts([]);
        setError(rpcError.message || "Não foi possível carregar os produtos em alta.");
        setLoading(false);
        return;
      }

      setProducts(data ?? []);
      setLoading(false);
    };

    fetchTrendingProducts();

    return () => {
      mounted = false;
    };
  }, [niche, page, period, sortBy]);

  const resetPage = () => setPage(1);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);

    const { data, error: rpcError } = await (supabase as unknown as TrendingProductsRpcClient).rpc("get_trending_products", {
      niche,
      period,
      sort_by: sortBy,
      page,
      page_size: PAGE_SIZE,
    });

    if (rpcError) {
      setError(rpcError.message || "Não foi possível atualizar o ranking.");
      veloToast.error("Não foi possível atualizar Produtos em Alta.");
    } else {
      setProducts(data ?? []);
      veloToast.success("Ranking atualizado.");
    }

    setRefreshing(false);
  };

  const goToOnboardingWithProduct = (product: TrendingProduct) => {
    const flowProduct = primeFirstStoreOnboarding(product);
    navigate("/onboarding/preparando-produto", { state: { product: flowProduct, products: [flowProduct] } });
  };

  const handleCreateStore = (product: TrendingProduct) => {
    const activeStore = getActiveStore();
    if (activeStore) {
      navigate("/minha-loja/editor");
      return;
    }

    goToOnboardingWithProduct(product);
  };

  const handleCreateSalesPage = (product: TrendingProduct) => {
    const activeStore = getActiveStore();
    if (activeStore) {
      setSalesPageSoonProduct(product);
      return;
    }

    goToOnboardingWithProduct(product);
  };

  return (
    <div className="-m-5 min-h-[calc(100%+2.5rem)] bg-[#F3F3F1] px-4 py-4 text-[#111111] sm:-m-6 sm:min-h-[calc(100%+3rem)] sm:px-5 sm:py-5 lg:-m-7 lg:min-h-[calc(100%+3.5rem)] lg:px-6 lg:py-5">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-3">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-black text-white shadow-[0_10px_22px_rgba(0,0,0,0.14)]">
              <TrendingUp size={16} strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.04em] text-[#111111]">Produtos em Alta</h1>
              <p className="mt-0.5 max-w-[720px] text-[13px] leading-5 text-[#667085]">
                Ranking compacto de demanda, margem e avaliação para escolher produtos vencedores.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-black/[0.08] bg-white px-3 text-[12px] font-semibold text-[#111111] shadow-sm transition hover:bg-[#FAFAF9] disabled:opacity-60"
          >
            <RefreshCcw size={13} strokeWidth={1.6} className={refreshing ? "animate-spin" : ""} />
            Atualizar
          </button>
        </header>

        <section className="rounded-[18px] border border-black/[0.06] bg-white px-3 py-2 shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
          <div className="flex flex-wrap items-center gap-2">
            <label className="group relative flex min-w-[190px] items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A93A3]">Nicho</span>
              <select
                value={niche ?? "all"}
                onChange={(event) => {
                  setNiche(event.target.value === "all" ? null : event.target.value);
                  resetPage();
                }}
                className="h-9 min-w-[150px] appearance-none rounded-[11px] border border-black/[0.08] bg-[#F7F7F5] px-3 pr-8 text-[12px] font-semibold outline-none transition focus:border-black/25"
              >
                {niches.map((item) => (
                  <option key={item.value ?? "all"} value={item.value ?? "all"}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} strokeWidth={1.5} className="pointer-events-none absolute right-3 text-[#8A93A3]" />
            </label>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A93A3]">Período</span>
              <div className="inline-flex rounded-[12px] border border-black/[0.07] bg-[#F7F7F5] p-0.5">
                {periodOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setPeriod(item.value);
                      resetPage();
                    }}
                    className={`h-8 rounded-[9px] px-3 text-[12px] font-semibold transition ${
                      period === item.value ? "bg-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.16)]" : "text-[#667085] hover:text-[#111111]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <span className="hidden text-[11px] text-[#98A2B3] sm:inline">baseado em atividade recente</span>
            </div>

            <label className="group relative ml-auto flex min-w-[220px] items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A93A3]">Ordenar</span>
              <select
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value as SortBy);
                  resetPage();
                }}
                className="h-9 min-w-[160px] appearance-none rounded-[11px] border border-black/[0.08] bg-[#F7F7F5] px-3 pr-8 text-[12px] font-semibold outline-none transition focus:border-black/25"
              >
                {sortOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} strokeWidth={1.5} className="pointer-events-none absolute right-3 text-[#8A93A3]" />
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-[18px] border border-black/[0.06] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.055)]">
          <div className="flex flex-col gap-2 border-b border-black/[0.06] bg-[#FAFAF9] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.025em]">Top produtos · {selectedNicheLabel}</h2>
              <p className="mt-0.5 text-[11px] text-[#8A93A3]">
                {loading ? "Carregando ranking..." : `${formatNumber(totalCount)} produtos encontrados`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-medium text-[#8A93A3]">
                {startItem}-{endItem} de {formatNumber(totalCount)}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || loading}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-black/[0.08] bg-white text-[#111111] transition hover:bg-[#F7F7F5] disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Página anterior"
                >
                  <ArrowLeft size={13} strokeWidth={1.6} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages || loading}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-black text-white transition hover:bg-[#1F1F1F] disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Próxima página"
                >
                  <ArrowRight size={13} strokeWidth={1.6} />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[430px] flex-col items-center justify-center gap-3 text-[#667085]">
              <Loader2 size={26} strokeWidth={1.5} className="animate-spin" />
              <span className="text-[13px] font-medium">Buscando produtos em alta...</span>
            </div>
          ) : error ? (
            <div className="flex min-h-[430px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                <X size={22} strokeWidth={1.6} />
              </div>
              <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.03em]">Não foi possível carregar</h3>
              <p className="mt-2 max-w-[420px] text-[13px] leading-6 text-[#667085]">{error}</p>
              <button
                type="button"
                onClick={refresh}
                className="mt-5 inline-flex h-10 items-center justify-center rounded-[13px] bg-black px-4 text-[13px] font-semibold text-white"
              >
                Tentar novamente
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="flex min-h-[430px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F3F1] text-[#111111]">
                <PackageOpen size={23} strokeWidth={1.5} />
              </div>
              <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.03em]">Nenhum produto encontrado</h3>
              <p className="mt-2 max-w-[420px] text-[13px] leading-6 text-[#667085]">
                Tente trocar o nicho, período ou ordenação para encontrar novas oportunidades.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1080px] w-full border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.06] bg-white text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A93A3]">
                    <th className="px-4 py-2.5">Produto</th>
                    <th className="px-3 py-2.5">Preço</th>
                    <th className="px-3 py-2.5">Demanda</th>
                    <th className="px-3 py-2.5">Margem</th>
                    <th className="px-3 py-2.5">Avaliação</th>
                    <th className="px-4 py-2.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => {
                    const demand = Number(product.orders_count ?? product.demand_score ?? 0);
                    const margin = Number(product.margin_percent ?? 0);
                    const rating = Number(product.rating ?? 0);

                    return (
                      <tr key={product.id} className="h-16 border-b border-black/[0.06] transition hover:bg-[#FAFAF9]">
                        <td className="px-4 py-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[10px] border border-black/[0.06] bg-[#F7F7F5]">
                              <img src={getProductImage(product)} alt="" className="h-full w-full object-contain p-1" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 rounded-full bg-black px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                                  #{(page - 1) * PAGE_SIZE + index + 1}
                                </span>
                                <p className="truncate text-[13px] font-semibold leading-5 tracking-[-0.015em] text-[#111111]">
                                  {product.title}
                                </p>
                              </div>
                              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                                {product.category ? (
                                  <span className="max-w-[120px] truncate rounded-full bg-[#F3F3F1] px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-[#667085]">
                                    {product.category}
                                  </span>
                                ) : null}
                                {product.brand ? (
                                  <span className="truncate text-[10px] font-medium text-[#98A2B3]">{product.brand}</span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <p className="whitespace-nowrap text-[13px] font-semibold text-[#111111]">{formatBRL(product.suggested_price ?? product.original_price)}</p>
                          <p className="mt-0.5 whitespace-nowrap text-[10px] text-[#98A2B3]">custo {formatBRL(product.cost_price)}</p>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF4FF] px-2 py-1 text-[12px] font-semibold text-[#2563EB]">
                            <TrendingUp size={12} strokeWidth={1.6} />
                            {formatNumber(demand)}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[12px] font-bold leading-4 text-emerald-600">
                            {margin.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                          </span>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#111111]">
                            <Star size={13} fill="currentColor" strokeWidth={1.5} />
                            {rating ? rating.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
                          </span>
                          <span className="ml-2 text-[10px] text-[#98A2B3]">score {Number(product.score ?? 0).toFixed(0)}</span>
                        </td>
                        <td className="px-4 py-2 align-middle">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCreateStore(product)}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] bg-black px-2.5 text-[11px] font-semibold text-white transition hover:bg-[#1F1F1F]"
                            >
                              <Store size={12} strokeWidth={1.6} />
                              Criar Loja
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCreateSalesPage(product)}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] border border-black/[0.08] bg-white px-2.5 text-[11px] font-semibold text-[#111111] transition hover:bg-[#F7F7F5]"
                              title="Criar Página de Venda"
                              aria-label="Criar Página de Venda"
                            >
                              <FilePlus2 size={12} strokeWidth={1.6} />
                              Página
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </section>
      </div>

      {salesPageSoonProduct ? (
        <SalesPageSoonModal product={salesPageSoonProduct} onClose={() => setSalesPageSoonProduct(null)} />
      ) : null}
    </div>
  );
};

export default TrendingProductsPage;
