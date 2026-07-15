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
  Sparkles,
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
    <div className="-m-5 min-h-[calc(100%+2.5rem)] bg-[#F3F3F1] px-5 py-6 text-[#111111] sm:-m-6 sm:min-h-[calc(100%+3rem)] sm:px-7 sm:py-7 lg:-m-7 lg:min-h-[calc(100%+3.5rem)] lg:px-8 lg:py-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <header className="overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_20px_70px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[760px]">
              <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                <TrendingUp size={14} strokeWidth={1.5} />
                Produtos em Alta
              </div>
              <h1 className="mt-4 text-[30px] font-semibold tracking-[-0.055em] text-[#111111] sm:text-[38px]">
                Ranking de produtos vencedores
              </h1>
              <p className="mt-3 max-w-[680px] text-[15px] leading-7 text-[#667085]">
                Veja demanda, margem e avaliação em um só lugar para escolher produtos com mais chance de virar venda na sua operação.
              </p>
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-black/[0.08] bg-[#F7F7F5] px-4 text-[13px] font-semibold text-[#111111] transition hover:bg-white disabled:opacity-60"
            >
              <RefreshCcw size={15} strokeWidth={1.6} className={refreshing ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </header>

        <section className="rounded-[24px] border border-black/[0.06] bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.045)]">
          <div className="grid gap-3 lg:grid-cols-[minmax(180px,260px)_minmax(280px,1fr)_minmax(220px,280px)] lg:items-start">
            <label className="group relative block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A93A3]">Nicho</span>
              <select
                value={niche ?? "all"}
                onChange={(event) => {
                  setNiche(event.target.value === "all" ? null : event.target.value);
                  resetPage();
                }}
                className="h-11 w-full appearance-none rounded-[14px] border border-black/[0.08] bg-[#F7F7F5] px-4 pr-10 text-[13px] font-semibold outline-none transition focus:border-black/25"
              >
                {niches.map((item) => (
                  <option key={item.value ?? "all"} value={item.value ?? "all"}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} strokeWidth={1.5} className="pointer-events-none absolute bottom-3.5 right-4 text-[#8A93A3]" />
            </label>

            <div>
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A93A3]">Período</span>
              <div className="inline-flex rounded-[15px] border border-black/[0.07] bg-[#F7F7F5] p-1">
                {periodOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setPeriod(item.value);
                      resetPage();
                    }}
                    className={`h-9 rounded-[11px] px-4 text-[13px] font-semibold transition ${
                      period === item.value ? "bg-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.16)]" : "text-[#667085] hover:text-[#111111]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[#98A2B3]">baseado em atividade recente</p>
            </div>

            <label className="group relative block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A93A3]">Ordenar por</span>
              <select
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value as SortBy);
                  resetPage();
                }}
                className="h-11 w-full appearance-none rounded-[14px] border border-black/[0.08] bg-[#F7F7F5] px-4 pr-10 text-[13px] font-semibold outline-none transition focus:border-black/25"
              >
                {sortOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} strokeWidth={1.5} className="pointer-events-none absolute bottom-3.5 right-4 text-[#8A93A3]" />
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_22px_80px_rgba(15,23,42,0.07)]">
          <div className="flex flex-col gap-2 border-b border-black/[0.06] bg-[#FAFAF9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[18px] font-semibold tracking-[-0.035em]">Top produtos · {selectedNicheLabel}</h2>
              <p className="mt-1 text-[12px] text-[#8A93A3]">
                {loading ? "Carregando ranking..." : `${formatNumber(totalCount)} produtos encontrados`}
              </p>
            </div>
            <p className="text-[12px] font-medium text-[#8A93A3]">
              {startItem}-{endItem} de {formatNumber(totalCount)}
            </p>
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
              <table className="min-w-[1040px] w-full border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.06] bg-white text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A93A3]">
                    <th className="px-5 py-4">Produto</th>
                    <th className="px-4 py-4">Preço</th>
                    <th className="px-4 py-4">Demanda</th>
                    <th className="px-4 py-4">Margem</th>
                    <th className="px-4 py-4">Avaliação</th>
                    <th className="px-5 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => {
                    const demand = Number(product.orders_count ?? product.demand_score ?? 0);
                    const margin = Number(product.margin_percent ?? 0);
                    const rating = Number(product.rating ?? 0);

                    return (
                      <tr key={product.id} className="border-b border-black/[0.06] transition hover:bg-[#FAFAF9]">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[16px] border border-black/[0.06] bg-[#F7F7F5]">
                              <img src={getProductImage(product)} alt="" className="h-full w-full object-contain p-1.5" />
                              <span className="absolute left-1.5 top-1.5 rounded-full bg-black px-1.5 py-0.5 text-[9px] font-bold text-white">
                                #{(page - 1) * PAGE_SIZE + index + 1}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="line-clamp-2 max-w-[390px] text-[14px] font-semibold leading-5 tracking-[-0.02em] text-[#111111]">
                                {product.title}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {product.category ? (
                                  <span className="rounded-full bg-[#F3F3F1] px-2 py-1 text-[11px] font-semibold text-[#667085]">
                                    {product.category}
                                  </span>
                                ) : null}
                                {product.brand ? (
                                  <span className="text-[11px] font-medium text-[#98A2B3]">{product.brand}</span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <p className="text-[14px] font-semibold text-[#111111]">{formatBRL(product.suggested_price ?? product.original_price)}</p>
                          <p className="mt-1 text-[11px] text-[#98A2B3]">custo {formatBRL(product.cost_price)}</p>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <span className="inline-flex items-center gap-2 rounded-full bg-[#EEF4FF] px-3 py-1.5 text-[12px] font-semibold text-[#2563EB]">
                            <TrendingUp size={13} strokeWidth={1.6} />
                            {formatNumber(demand)}
                          </span>
                          <p className="mt-1.5 text-[11px] text-[#98A2B3]">sinal de demanda</p>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-bold text-emerald-600">
                            {margin.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                          </span>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#111111]">
                            <Star size={14} fill="currentColor" strokeWidth={1.5} />
                            {rating ? rating.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
                          </span>
                          <p className="mt-1 text-[11px] text-[#98A2B3]">score {Number(product.score ?? 0).toFixed(0)}</p>
                        </td>
                        <td className="px-5 py-4 align-middle">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleCreateStore(product)}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-[13px] bg-black px-3.5 text-[12px] font-semibold text-white transition hover:bg-[#1F1F1F]"
                            >
                              <Store size={14} strokeWidth={1.6} />
                              Criar Loja
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCreateSalesPage(product)}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-[13px] border border-black/[0.08] bg-white px-3.5 text-[12px] font-semibold text-[#111111] transition hover:bg-[#F7F7F5]"
                            >
                              <FilePlus2 size={14} strokeWidth={1.6} />
                              Criar Página de Venda
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

          <div className="flex flex-col gap-3 border-t border-black/[0.06] bg-[#FAFAF9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-[#8A93A3]">
              Página <span className="font-semibold text-[#111111]">{page}</span> de{" "}
              <span className="font-semibold text-[#111111]">{totalPages}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[13px] border border-black/[0.08] bg-white px-4 text-[12px] font-semibold text-[#111111] transition hover:bg-[#F7F7F5] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ArrowLeft size={14} strokeWidth={1.5} />
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[13px] bg-black px-4 text-[12px] font-semibold text-white transition hover:bg-[#1F1F1F] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Próxima
                <ArrowRight size={14} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </section>
      </div>

      {salesPageSoonProduct ? (
        <SalesPageSoonModal product={salesPageSoonProduct} onClose={() => setSalesPageSoonProduct(null)} />
      ) : null}
    </div>
  );
};

export default TrendingProductsPage;
