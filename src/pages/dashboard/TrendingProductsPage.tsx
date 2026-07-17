import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FilePlus2,
  FileSliders,
  Grid2X2,
  Image as ImageIcon,
  Info,
  List,
  Loader2,
  PackageOpen,
  Search,
  SlidersHorizontal,
  Star,
  Store,
  Tag,
  ShoppingCart,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getActiveStore } from "@/components/dashboard/FirstStoreOnboarding";
import ProjectCreationWizard from "@/components/projects/ProjectCreationWizard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { isAdminEmail } from "@/lib/adminAccess";

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
const PRESETS_STORAGE_KEY = "velo-trending-products-presets";

type FilterRangeKey = "price" | "sales" | "revenue" | "shopProducts" | "productImages" | "variants";
type FilterRange = { min: string; max: string };
type FilterRanges = Record<FilterRangeKey, FilterRange>;

type ProductFilterPreset = {
  id: string;
  name: string;
  searchQuery: string;
  selectedCategories: string[];
  filterRanges: FilterRanges;
  sortBy: SortBy;
  createdAt: string;
};

const emptyFilterRanges: FilterRanges = {
  price: { min: "", max: "" },
  sales: { min: "", max: "" },
  revenue: { min: "", max: "" },
  shopProducts: { min: "", max: "" },
  productImages: { min: "", max: "" },
  variants: { min: "", max: "" },
};

const sortOptions: Array<{ label: string; value: SortBy }> = [
  { label: "Ranking Velo", value: "score" },
  { label: "Mais vendido", value: "demand" },
  { label: "Maior margem", value: "margin" },
  { label: "Melhor avaliação", value: "rating" },
  { label: "Mais recente", value: "recent" },
  { label: "Menor preço", value: "price_asc" },
  { label: "Maior preço", value: "price_desc" },
];

const filterMetricRows: Array<{ key: FilterRangeKey; label: string; icon: LucideIcon }> = [
  { key: "price", label: "Preço", icon: Tag },
  { key: "sales", label: "Vendas", icon: ShoppingCart },
  { key: "revenue", label: "Receita", icon: CircleDollarSign },
  { key: "shopProducts", label: "Produtos da loja", icon: Store },
  { key: "productImages", label: "Imagens do produto", icon: ImageIcon },
  { key: "variants", label: "Variações", icon: SlidersHorizontal },
];

const filterCategories = [
  { label: "Eletrônicos", value: "Eletrônicos" },
  { label: "Automotivo e Motos", value: "Automotivo" },
  { label: "Bebê e Maternidade", value: "Bebê" },
  { label: "Beleza e Cuidados", value: "Beleza" },
  { label: "Livros, Revistas e Áudio", value: "Livros" },
  { label: "Colecionáveis", value: "Colecionáveis" },
  { label: "Computadores e Escritório", value: "Informática" },
  { label: "Acessórios de Moda", value: "Moda" },
  { label: "Alimentos e Bebidas", value: "Alimentos" },
  { label: "Casa e Decoração", value: "Casa" },
  { label: "Saúde e Bem-estar", value: "Saúde" },
  { label: "Ferramentas", value: "Ferramentas" },
];

const formatBRL = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatNumber = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });

const formatPercent = (value: number | null | undefined) =>
  `${Number(value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "Sem data";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const getMarginPercent = (product: TrendingProduct) => {
  if (product.margin_percent !== null && product.margin_percent !== undefined) {
    return Number(product.margin_percent);
  }

  const price = Number(product.suggested_price ?? product.original_price ?? 0);
  const cost = Number(product.cost_price ?? 0);
  if (!price || !cost) return 0;

  return ((price - cost) / price) * 100;
};

const getDropshippingVerdict = (marginPercent: number, demand: number, rating: number, stock: number | null) => {
  if (marginPercent >= 35 && demand >= 25 && (rating >= 4 || rating === 0)) {
    return {
      title: "Forte candidato",
      description: "Combina margem, demanda e avaliação em uma faixa boa para validar uma oferta.",
    };
  }

  if (marginPercent >= 20 && demand >= 8) {
    return {
      title: "Bom para testar",
      description: "Tem sinais suficientes para entrar em uma validação pequena antes de escalar.",
    };
  }

  if (stock !== null && stock <= 0) {
    return {
      title: "Estoque fraco",
      description: "Antes de vender, confirme disponibilidade e reposição para evitar ruptura.",
    };
  }

  if (marginPercent < 15) {
    return {
      title: "Margem apertada",
      description: "Pode vender, mas há pouco espaço para tráfego, descontos e imprevistos.",
    };
  }

  return {
    title: "Precisa validar demanda",
    description: "Use este produto em testes de nicho, criativo e preço antes de assumir escala.",
  };
};

const cloneFilterRanges = (ranges: Partial<Record<FilterRangeKey, Partial<FilterRange>>>): FilterRanges => ({
  price: { min: ranges.price?.min ?? "", max: ranges.price?.max ?? "" },
  sales: { min: ranges.sales?.min ?? "", max: ranges.sales?.max ?? "" },
  revenue: { min: ranges.revenue?.min ?? "", max: ranges.revenue?.max ?? "" },
  shopProducts: { min: ranges.shopProducts?.min ?? "", max: ranges.shopProducts?.max ?? "" },
  productImages: { min: ranges.productImages?.min ?? "", max: ranges.productImages?.max ?? "" },
  variants: { min: ranges.variants?.min ?? "", max: ranges.variants?.max ?? "" },
});

const readSavedPresets = (): ProductFilterPreset[] => {
  if (typeof window === "undefined") return [];

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PRESETS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((preset): preset is ProductFilterPreset => {
      if (!preset || typeof preset !== "object") return false;
      const candidate = preset as Partial<ProductFilterPreset>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.name === "string" &&
        typeof candidate.searchQuery === "string" &&
        Array.isArray(candidate.selectedCategories) &&
        typeof candidate.filterRanges === "object" &&
        typeof candidate.sortBy === "string" &&
        typeof candidate.createdAt === "string"
      );
    });
  } catch {
    return [];
  }
};

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

const getImageCount = (product: TrendingProduct) => {
  if (Array.isArray(product.images)) {
    return Math.max(1, product.images.filter((item) => typeof item === "string" && item.trim().length > 0).length);
  }

  if (typeof product.images === "string" && product.images.trim()) {
    try {
      const parsed = JSON.parse(product.images);
      return Array.isArray(parsed) ? Math.max(1, parsed.length) : 1;
    } catch {
      return 1;
    }
  }

  return product.image ? 1 : 0;
};

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
  const { user, role } = useAuth();
  const [products, setProducts] = useState<TrendingProduct[]>([]);
  const [niche, setNiche] = useState<string | null>("Eletrônicos");
  const period: Period = "week";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [filterRanges, setFilterRanges] = useState<FilterRanges>(() => cloneFilterRanges(emptyFilterRanges));
  const [savedPresets, setSavedPresets] = useState<ProductFilterPreset[]>(() => readSavedPresets());
  const [presetName, setPresetName] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [selectedFilterCategories, setSelectedFilterCategories] = useState<string[]>(() =>
    filterCategories.map((category) => category.value),
  );
  const [sortBy, setSortBy] = useState<SortBy>("score");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesPageSoonProduct, setSalesPageSoonProduct] = useState<TrendingProduct | null>(null);
  const metadataRole =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined);
  const isAdmin = role === "admin" || metadataRole === "admin" || isAdminEmail(user?.email);

  const normalizedSearchQuery = appliedSearchQuery.trim().toLocaleLowerCase("pt-BR");
  const visibleProducts = useMemo(() => {
    if (!normalizedSearchQuery) return products;

    return products.filter((product) =>
      [product.title, product.category, product.brand]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedSearchQuery)),
    );
  }, [normalizedSearchQuery, products]);
  const totalCount = products[0]?.total_count ?? products.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const displayedCount = loading ? PAGE_SIZE : visibleProducts.length;
  const allFilterCategoriesSelected = selectedFilterCategories.length === filterCategories.length;

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
  }, [niche, page, sortBy]);

  const resetPage = () => setPage(1);

  const persistPresets = (nextPresets: ProductFilterPreset[]) => {
    setSavedPresets(nextPresets);

    try {
      window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(nextPresets));
    } catch {
      veloToast.error("Não foi possível salvar o preset neste navegador.");
    }
  };

  const applySearch = () => {
    setAppliedSearchQuery(searchQuery.trim());
    setPage(1);
  };

  const updateFilterRange = (key: FilterRangeKey, edge: keyof FilterRange, value: string) => {
    setFilterRanges((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [edge]: value,
      },
    }));
  };

  const toggleProductDetails = (productId: string) => {
    setExpandedProductId((current) => (current === productId ? null : productId));
  };

  const toggleFilterCategory = (value: string) => {
    setSelectedFilterCategories((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const toggleAllFilterCategories = () => {
    setSelectedFilterCategories((current) =>
      current.length === filterCategories.length ? [] : filterCategories.map((category) => category.value),
    );
  };

  const applyFilters = () => {
    const nextNiche = allFilterCategoriesSelected ? null : selectedFilterCategories[0] ?? null;
    setAppliedSearchQuery(searchQuery.trim());
    setNiche(nextNiche);
    setPage(1);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setAppliedSearchQuery("");
    setSelectedFilterCategories(filterCategories.map((category) => category.value));
    setFilterRanges(cloneFilterRanges(emptyFilterRanges));
    setNiche(null);
    setPage(1);
  };

  const saveCurrentPreset = () => {
    const trimmedName = presetName.trim();
    const nextPreset: ProductFilterPreset = {
      id: crypto.randomUUID(),
      name: trimmedName || `Preset ${savedPresets.length + 1}`,
      searchQuery: searchQuery.trim(),
      selectedCategories: [...selectedFilterCategories],
      filterRanges: cloneFilterRanges(filterRanges),
      sortBy,
      createdAt: new Date().toISOString(),
    };

    persistPresets([nextPreset, ...savedPresets].slice(0, 12));
    setPresetName("");
    veloToast.success("Preset salvo.");
  };

  const applyPreset = (preset: ProductFilterPreset) => {
    const nextCategories = preset.selectedCategories.filter((value) =>
      filterCategories.some((category) => category.value === value),
    );

    setSearchQuery(preset.searchQuery);
    setAppliedSearchQuery(preset.searchQuery);
    setSelectedFilterCategories(nextCategories.length > 0 ? nextCategories : filterCategories.map((category) => category.value));
    setFilterRanges(cloneFilterRanges(preset.filterRanges));
    setSortBy(preset.sortBy);
    setNiche(nextCategories.length === filterCategories.length ? null : nextCategories[0] ?? null);
    setPage(1);
    setPresetsOpen(false);
    veloToast.success("Preset aplicado.");
  };

  const deletePreset = (presetId: string) => {
    persistPresets(savedPresets.filter((preset) => preset.id !== presetId));
    veloToast.success("Preset removido.");
  };

  const refresh = async () => {
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

  const [creatingSalesPageId, setCreatingSalesPageId] = useState<string | null>(null);
  const [wizardProduct, setWizardProduct] = useState<TrendingProduct | null>(null);

  const handleCreateSalesPage = (product: TrendingProduct) => {
    if (creatingSalesPageId) return;
    // Abre o mesmo wizard usado em Minha Loja, travado em "página de vendas"
    // e com o produto vindo de Produtos em Alta já pré-selecionado.
    setWizardProduct(product);
  };

  const handleProjectCreated = (projectId: string) => {
    setWizardProduct(null);
    setCreatingSalesPageId(null);
    navigate("/produto/editor", { state: { projectId } });
  };

  return (
    <div className="-m-5 min-h-[calc(100%+2.5rem)] bg-white text-[#111111] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]">
      <style>
        {`
          @keyframes veloProductDetail {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes veloFilterPanel {
            from {
              opacity: 0;
              transform: translateY(-14px) scaleY(0.985);
              clip-path: inset(0 0 100% 0);
            }
            to {
              opacity: 1;
              transform: translateY(0) scaleY(1);
              clip-path: inset(0 0 0 0);
            }
          }

          @keyframes veloFilterItem {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .velo-filter-panel {
            transform-origin: top center;
            animation: veloFilterPanel 300ms cubic-bezier(.2,.82,.2,1) both;
          }

          .velo-filter-item {
            opacity: 0;
            animation: veloFilterItem 260ms cubic-bezier(.2,.82,.2,1) both;
          }
        `}
      </style>
      <div className="flex w-full flex-col bg-white">
        <section className="bg-white">
          <div className="flex min-h-12 items-center gap-3 border-b border-black/[0.06] bg-[#FFF7F7] px-7 py-2.5 text-[12px] font-medium text-[#4B5563]">
            <AlertTriangle size={16} strokeWidth={1.5} className="shrink-0 text-[#EAB308]" />
            <p className="line-clamp-2">
              Produtos em alta usam sinais de demanda, margem e atividade recente para ajudar você a encontrar oportunidades com mais rapidez.
            </p>
          </div>

          <div className="flex min-h-[62px] flex-col gap-3 border-b border-black/[0.06] px-7 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-1">
              <span className="relative flex h-8 w-9 shrink-0 items-center justify-center">
                <img
                  src="/assets/produtos-em-alta-icon.png?v=10"
                  alt=""
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[46px] w-[69px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain [filter:drop-shadow(0_5px_9px_rgba(15,23,42,0.16))_drop-shadow(0_1px_2px_rgba(15,23,42,0.10))]"
                />
              </span>
              <div className="flex h-8 min-w-0 items-center">
                <div className="flex min-w-0 items-center gap-2.5">
                  <h1 className="shrink-0 text-[14px] font-semibold leading-none text-[#1F2430]">Produtos em Alta</h1>
                  <p className="truncate text-[14px] font-medium leading-none text-[#687184]">
                    Ranking de produtos vencedores com demanda, margem e avaliação.
                  </p>
                </div>
              </div>
            </div>
            <div className="inline-flex h-10 shrink-0 overflow-hidden rounded-[9px] border border-black/[0.07] bg-white text-[12px] shadow-[0_6px_18px_rgba(15,23,42,0.045)]">
              <span className="flex items-center border-r border-black/[0.06] px-4 font-semibold text-[#667085]">Produtos listados</span>
              <span className="flex items-center px-4 font-semibold text-emerald-600">{formatNumber(totalCount)}</span>
            </div>
          </div>

          <div className="flex min-h-[56px] flex-col gap-2 border-b border-black/[0.06] px-7 py-2.5 lg:flex-row lg:items-center lg:justify-between">
            <form
              className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                applySearch();
              }}
            >
              <div className="relative min-w-[260px] flex-1 lg:max-w-[560px]">
                <Search size={15} strokeWidth={1.7} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B4]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  aria-label="Buscar produtos"
                  placeholder="Buscar produtos..."
                  className="h-9 w-full rounded-[9px] border border-black/[0.07] bg-white pl-9 pr-4 text-[12px] font-medium text-[#111111] outline-none placeholder:text-[#A0A7B4]"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-[9px] bg-[#F1F3F7] px-4 text-[12px] font-semibold text-[#2F3747] transition hover:bg-[#EAEDF3]"
              >
                Buscar
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
                aria-expanded={filtersOpen}
                className={`inline-flex h-9 items-center justify-center gap-2 rounded-[9px] border px-4 text-[12px] font-semibold shadow-[0_4px_12px_rgba(15,23,42,0.045)] transition duration-200 ${
                  filtersOpen ? "border-black bg-black text-white shadow-[0_10px_22px_rgba(0,0,0,0.14)]" : "border-black/[0.07] bg-white text-[#111111] hover:bg-[#FAFAF9]"
                }`}
              >
                <SlidersHorizontal size={14} strokeWidth={1.7} className={`transition-transform duration-300 ${filtersOpen ? "rotate-90" : ""}`} />
                Filtros
              </button>
            </form>

            <div className="relative flex shrink-0 items-center justify-end">
              <button
                type="button"
                onClick={() => setPresetsOpen((current) => !current)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[9px] border border-black/[0.07] bg-white px-4 text-[12px] font-semibold text-[#4B5563] shadow-[0_4px_12px_rgba(15,23,42,0.045)] transition hover:bg-[#FAFAF9] hover:text-[#111111]"
                aria-label="Importar ou criar presets de filtros"
                title="Importar ou criar presets de filtros"
              >
                <FileSliders size={15} strokeWidth={1.7} />
                Presets
                <ChevronDown size={13} strokeWidth={1.7} className="text-[#8A93A3]" />
              </button>

              {presetsOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[320px] rounded-[12px] border border-black/[0.08] bg-white p-3 text-[#111827] shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold">Presets de busca</p>
                    <span className="text-[11px] font-medium text-[#8A93A3]">{savedPresets.length}/12</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={presetName}
                      onChange={(event) => setPresetName(event.target.value)}
                      placeholder="Nome do preset"
                      className="h-9 min-w-0 flex-1 rounded-[9px] border border-black/[0.08] px-3 text-[12px] font-medium outline-none placeholder:text-[#A0A7B4] focus:border-black/30 focus:ring-4 focus:ring-black/[0.06]"
                    />
                    <button
                      type="button"
                      onClick={saveCurrentPreset}
                      className="h-9 rounded-[9px] bg-black px-3 text-[12px] font-semibold text-white transition hover:bg-[#222222]"
                    >
                      Salvar
                    </button>
                  </div>

                  <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                    {savedPresets.length === 0 ? (
                      <p className="rounded-[9px] bg-[#F6F7F9] px-3 py-3 text-[12px] font-medium text-[#6B7280]">
                        Salve uma busca para reutilizar nicho, filtros, categorias e ordenação.
                      </p>
                    ) : (
                      savedPresets.map((preset) => (
                        <div key={preset.id} className="rounded-[9px] border border-black/[0.06] p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold text-[#111827]">{preset.name}</p>
                              <p className="mt-0.5 truncate text-[11px] font-medium text-[#8A93A3]">
                                {preset.searchQuery || "Sem termo"} · {preset.selectedCategories.length} categorias
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => deletePreset(preset.id)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#8A93A3] transition hover:bg-[#F4F4F5] hover:text-[#111827]"
                              aria-label={`Remover preset ${preset.name}`}
                            >
                              <X size={14} strokeWidth={1.8} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => applyPreset(preset)}
                            className="mt-2 h-8 w-full rounded-[8px] bg-[#F1F3F7] text-[12px] font-semibold text-[#111827] transition hover:bg-[#E8EAF0]"
                          >
                            Aplicar preset
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {filtersOpen ? (
            <div className="velo-filter-panel overflow-hidden border-b border-black/[0.06] bg-white px-7 py-7">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.94fr)] lg:gap-10">
                <div>
                  <div className="velo-filter-item flex items-center gap-1.5 text-[15px] font-semibold text-[#2B2F3A]" style={{ animationDelay: "60ms" }}>
                    <span>Filtros</span>
                    <Info size={13} strokeWidth={1.8} className="text-[#C0C6D2]" />
                  </div>

                  <div className="mt-6 space-y-3.5">
                    {filterMetricRows.map(({ key, label, icon: Icon }, index) => (
                      <div
                        key={label}
                        className="velo-filter-item grid grid-cols-[26px_minmax(0,1fr)] gap-3 sm:grid-cols-[26px_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-4"
                        style={{ animationDelay: `${95 + index * 34}ms` }}
                      >
                        <Icon size={15} strokeWidth={1.8} className="mt-2.5 text-[#747B8B] sm:mt-0" />
                        <label className="relative block">
                          <span className="sr-only">{label} mínimo</span>
                          <input
                            value={filterRanges[key].min}
                            onChange={(event) => updateFilterRange(key, "min", event.target.value)}
                            inputMode="numeric"
                            placeholder={label}
                            className="h-9 w-full rounded-[9px] border border-black/[0.07] bg-white pl-3 pr-12 text-[12px] font-medium text-[#111827] outline-none transition placeholder:text-[#B7BEC9] focus:border-black/30 focus:ring-4 focus:ring-black/[0.06]"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase text-[#4B5563]">
                            MÍN
                          </span>
                        </label>
                        <label className="relative col-start-2 block sm:col-start-auto">
                          <span className="sr-only">{label} máximo</span>
                          <input
                            value={filterRanges[key].max}
                            onChange={(event) => updateFilterRange(key, "max", event.target.value)}
                            inputMode="numeric"
                            placeholder={label}
                            className="h-9 w-full rounded-[9px] border border-black/[0.07] bg-white pl-3 pr-12 text-[12px] font-medium text-[#111827] outline-none transition placeholder:text-[#B7BEC9] focus:border-black/30 focus:ring-4 focus:ring-black/[0.06]"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase text-[#4B5563]">
                            MÁX
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-black/[0.07] lg:border-l lg:pl-10">
                  <div className="velo-filter-item flex items-center gap-2 text-[15px] font-semibold text-[#2B2F3A]" style={{ animationDelay: "95ms" }}>
                    <span>Categorias</span>
                    <span className="rounded-[5px] bg-[#FFF4E5] px-1.5 py-0.5 text-[10px] font-bold text-[#C77923]">BETA</span>
                  </div>

                  <div className="mt-6 max-h-[282px] space-y-3 overflow-y-auto pr-3">
                    <button
                      type="button"
                      onClick={toggleAllFilterCategories}
                      className="velo-filter-item flex w-full items-center gap-3 text-left text-[12px] font-medium text-[#3C4353] transition hover:text-[#111827]"
                      style={{ animationDelay: "130ms" }}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition ${
                          allFilterCategoriesSelected ? "border-black bg-black text-white" : "border-[#C7CEDA] bg-white text-transparent"
                        }`}
                      >
                        <Check size={12} strokeWidth={2.2} />
                      </span>
                      <span>{allFilterCategoriesSelected ? "Desmarcar tudo" : "Selecionar tudo"}</span>
                    </button>

                    {filterCategories.map((category, index) => {
                      const checked = selectedFilterCategories.includes(category.value);

                      return (
                        <button
                          key={category.value}
                          type="button"
                          onClick={() => toggleFilterCategory(category.value)}
                          className="velo-filter-item flex w-full items-center gap-3 text-left text-[12px] font-medium text-[#3C4353] transition hover:text-[#111827]"
                          style={{ animationDelay: `${162 + index * 24}ms` }}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition ${
                              checked ? "border-black bg-black text-white" : "border-[#C7CEDA] bg-white text-transparent"
                            }`}
                          >
                            <Check size={12} strokeWidth={2.2} />
                          </span>
                          <span>{category.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="velo-filter-item mt-7 flex items-center gap-6" style={{ animationDelay: "270ms" }}>
                <div className="h-px flex-1 bg-black/[0.08]" />
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#7D8493] transition hover:text-[#111827]"
                >
                  Filtros avançados
                  <ChevronDown size={13} strokeWidth={1.7} />
                </button>
                <div className="h-px flex-1 bg-black/[0.08]" />
              </div>

              <div className="velo-filter-item mt-7 flex justify-end gap-3" style={{ animationDelay: "310ms" }}>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-9 rounded-[9px] border border-black/[0.07] bg-white px-4 text-[12px] font-semibold text-[#4B5563] shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition hover:bg-[#FAFAF9] hover:text-[#111827]"
                >
                  Limpar filtro
                </button>
                <button
                  type="button"
                  onClick={applyFilters}
                  className="h-9 rounded-[9px] bg-black px-5 text-[12px] font-semibold text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)] transition hover:bg-[#222222]"
                >
                  Buscar
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex min-h-[54px] flex-col gap-2 border-b border-black/[0.06] px-7 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <label className="group relative flex h-9 items-center gap-2 rounded-[9px] border border-black/[0.07] bg-white px-3 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                <span className="text-[12px] font-medium text-[#8A93A3]">Ordenar por</span>
                <select
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value as SortBy);
                    resetPage();
                  }}
                  className="h-full min-w-[130px] appearance-none bg-transparent pr-7 text-[12px] font-semibold text-[#111111] outline-none"
                >
                  {sortOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} strokeWidth={1.6} className="pointer-events-none absolute right-3 text-[#8A93A3]" />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
              <div className="flex items-center gap-1 rounded-[9px] border border-black/[0.07] bg-white p-1 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                <button type="button" className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#F1F3F7] text-[#111111]" aria-label="Visualização em lista">
                  <List size={15} strokeWidth={1.7} />
                </button>
                <button type="button" className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[#8A93A3]" aria-label="Visualização em grade">
                  <Grid2X2 size={14} strokeWidth={1.7} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex min-h-[54px] flex-col gap-2 px-7 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[12px] text-[#667085]">
              <span>Mostrando</span>
              <span className="rounded-[9px] bg-[#EEF1F7] px-3 py-1.5 font-semibold text-[#111827]">{displayedCount}</span>
              <span>de {formatNumber(totalCount)}</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] font-medium text-[#667085]">
              <span>Página</span>
              <span className="rounded-[9px] bg-[#EEF1F7] px-3 py-1.5 font-semibold text-[#111827]">{page}</span>
              <span>de {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#F2F4F7] text-[#8A93A3] transition hover:bg-white hover:text-[#111111] disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Página anterior"
              >
                <ArrowLeft size={13} strokeWidth={1.6} />
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#F2F4F7] text-[#8A93A3] transition hover:bg-white hover:text-[#111111] disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Próxima página"
              >
                <ArrowRight size={13} strokeWidth={1.6} />
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden border-t border-black/[0.06] bg-white">
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
          ) : visibleProducts.length === 0 ? (
            <div className="flex min-h-[430px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F3F1] text-[#111111]">
                <PackageOpen size={23} strokeWidth={1.5} />
              </div>
              <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.03em]">
                {appliedSearchQuery ? "Nenhum produto encontrado para a busca" : "Nenhum produto encontrado"}
              </h3>
              <p className="mt-2 max-w-[420px] text-[13px] leading-6 text-[#667085]">
                Tente trocar o termo, nicho, período ou ordenação para encontrar novas oportunidades.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col className="w-[36%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[20%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr className="h-12 border-b border-black/[0.06] bg-white text-left text-[12px] font-semibold text-[#596174]">
                    <th className="px-5 py-3">Produto</th>
                    <th className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center gap-1">Preço <ChevronDown size={13} strokeWidth={1.8} /></span>
                    </th>
                    <th className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center gap-1">Vendas mensais <ChevronDown size={13} strokeWidth={1.8} /></span>
                    </th>
                    <th className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center gap-1">Fornecedor <Info size={13} strokeWidth={1.8} className="text-[#B5BDCB]" /></span>
                    </th>
                    <th className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center gap-1">Avaliação <ChevronDown size={13} strokeWidth={1.8} /></span>
                    </th>
                    <th className="px-3 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((product) => {
                    const demand = Number(product.orders_count ?? product.demand_score ?? 0);
                    const rating = Number(product.rating ?? 0);
                    const price = Number(product.suggested_price ?? product.original_price ?? product.cost_price ?? 0);
                    const cost = Number(product.cost_price ?? 0);
                    const profit = price - cost;
                    const marginPercent = getMarginPercent(product);
                    const monthlyRevenue = price * demand;
                    const imageCount = getImageCount(product);
                    const supplierLabel = product.brand || product.category || "Fornecedor Velo";
                    const supplierMeta = product.brand && product.category ? product.category : "Produtos selecionados";
                    const stock = product.stock_quantity;
                    const verdict = getDropshippingVerdict(marginPercent, demand, rating, stock);
                    const isExpanded = expandedProductId === product.id;
                    const signalRows = [
                      { label: "Demanda", value: Number(product.demand_score ?? demand), hint: `${formatNumber(demand)} vendas` },
                      { label: "Margem", value: Number(product.margin_score ?? marginPercent), hint: formatPercent(marginPercent) },
                      { label: "Facilidade", value: Number(product.ease_score ?? 0), hint: "Operação" },
                      { label: "Viral", value: Number(product.viral_score ?? 0), hint: "Criativo" },
                    ];

                    return (
                      <Fragment key={product.id}>
                        <tr className="h-[92px] border-b border-black/[0.06] bg-white transition hover:bg-[#FBFCFE]">
                          <td className="px-5 py-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <button
                                type="button"
                                onClick={() => toggleProductDetails(product.id)}
                                aria-expanded={isExpanded}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F4F4F5] hover:text-[#111827]"
                                aria-label={isExpanded ? "Fechar detalhes do produto" : "Ver detalhes do produto"}
                              >
                                <ChevronRight size={16} strokeWidth={2.1} className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                              </button>
                              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[4px] border border-black/[0.04] bg-white">
                                <img src={getProductImage(product)} alt="" className="h-full w-full object-contain p-1" />
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleProductDetails(product.id)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="min-w-0 truncate text-[13px] font-semibold leading-5 text-[#111827]">
                                    {product.title}
                                  </span>
                                  <ChartNoAxesColumnIncreasing size={14} strokeWidth={1.8} className="shrink-0 text-[#111827]" />
                                </div>
                                <div className="mt-1 flex min-w-0 items-center gap-4 text-[12px] font-medium text-[#111827]">
                                  <span>{imageCount || 1} {imageCount === 1 ? "imagem" : "imagens"}</span>
                                  <span>1 variante</span>
                                </div>
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-4 text-center align-middle">
                            <p className="whitespace-nowrap text-[14px] font-semibold text-[#111827]">{formatBRL(price)}</p>
                          </td>
                          <td className="px-3 py-4 text-center align-middle">
                            <p className="whitespace-nowrap text-[14px] font-semibold text-[#2B2F3A]">{formatBRL(monthlyRevenue)}</p>
                            <p className="mt-1 whitespace-nowrap text-[12px] font-medium text-[#111827]">{formatNumber(demand)} vendas</p>
                          </td>
                          <td className="px-3 py-4 align-middle">
                            <div className="mx-auto flex w-full max-w-[245px] min-w-0 items-center justify-start gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F1F2F4] text-[10px] font-bold uppercase text-[#111827]">
                                {supplierLabel.slice(0, 2)}
                              </div>
                              <div className="min-w-0 text-left">
                                <p className="truncate text-[13px] font-semibold leading-5 text-[#111827]">{supplierLabel}</p>
                                <p className="truncate text-[12px] font-medium text-[#111827]">{supplierMeta}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4 text-center align-middle">
                            <span className="inline-flex max-w-full items-center justify-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-[#2B2F3A]">
                              {rating ? rating.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
                              <Star size={14} fill="#111827" stroke="none" />
                              <span className="truncate font-medium text-[#7E8798]">({formatNumber(Number(product.score ?? 0))})</span>
                            </span>
                          </td>
                          <td className="px-3 py-4 align-middle">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleCreateSalesPage(product)}
                                disabled={creatingSalesPageId === product.id}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] bg-white text-[#111827] transition hover:bg-[#F4F4F5] disabled:opacity-60"
                                aria-label="Criar página de vendas"
                                title="Criar página de vendas"
                              >
                                {creatingSalesPageId === product.id ? <Loader2 size={15} className="animate-spin" /> : <FilePlus2 size={15} strokeWidth={1.8} />}
                              </button>
                              {isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => handleCreateStore(product)}
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-white transition hover:bg-[#222222]"
                                  aria-label="Criar loja com este produto"
                                  title="Criar loja com este produto"
                                >
                                  <Store size={15} strokeWidth={1.8} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr className="border-b border-black/[0.06] bg-[#FAFAFA]">
                            <td colSpan={6} className="px-5 py-0">
                              <div className="py-5 [animation:veloProductDetail_220ms_ease-out]">
                                <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.45fr)_minmax(260px,0.8fr)]">
                                  <div className="flex gap-4">
                                    <div className="h-[118px] w-[118px] shrink-0 overflow-hidden rounded-[8px] border border-black/[0.06] bg-white">
                                      <img src={getProductImage(product)} alt="" className="h-full w-full object-contain p-3" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="line-clamp-3 text-[15px] font-semibold leading-6 text-[#111827]">{product.title}</p>
                                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-[#4B5563]">
                                        {product.category ? <span className="rounded-full bg-white px-2.5 py-1">{product.category}</span> : null}
                                        {product.brand ? <span className="rounded-full bg-white px-2.5 py-1">{product.brand}</span> : null}
                                        <span className="rounded-full bg-white px-2.5 py-1">{imageCount || 1} imagens</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    {[
                                      { label: "Preço sugerido", value: formatBRL(price), hint: "valor de venda" },
                                      { label: "Custo estimado", value: formatBRL(cost), hint: "base do fornecedor" },
                                      { label: "Lucro bruto", value: formatBRL(profit), hint: "antes de taxas e tráfego" },
                                      { label: "Margem", value: formatPercent(marginPercent), hint: "saúde da oferta" },
                                      { label: "Receita mensal", value: formatBRL(monthlyRevenue), hint: "preço x vendas" },
                                      { label: "Estoque", value: stock === null ? "Sem dado" : formatNumber(stock), hint: "risco de ruptura" },
                                      { label: "Avaliação", value: rating ? rating.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "Sem nota", hint: "prova de satisfação" },
                                      { label: "Coletado em", value: formatDateTime(product.scraped_at), hint: "recência do dado" },
                                    ].map((metric) => (
                                      <div key={metric.label} className="rounded-[8px] border border-black/[0.06] bg-white p-3">
                                        <p className="text-[11px] font-semibold text-[#7E8798]">{metric.label}</p>
                                        <p className="mt-1 truncate text-[14px] font-semibold text-[#111827]">{metric.value}</p>
                                        <p className="mt-1 truncate text-[11px] font-medium text-[#8A93A3]">{metric.hint}</p>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="rounded-[8px] border border-black/[0.06] bg-white p-4">
                                    <p className="text-[12px] font-semibold text-[#7E8798]">Diagnóstico dropshipping</p>
                                    <h3 className="mt-1 text-[18px] font-semibold text-[#111827]">{verdict.title}</h3>
                                    <p className="mt-2 text-[12px] leading-5 text-[#667085]">{verdict.description}</p>
                                    <div className="mt-4 space-y-2.5">
                                      {signalRows.map((signal) => {
                                        const signalValue = Math.max(0, Math.min(100, signal.value));

                                        return (
                                          <div key={signal.label}>
                                            <div className="flex items-center justify-between text-[11px] font-semibold text-[#4B5563]">
                                              <span>{signal.label}</span>
                                              <span>{signal.hint}</span>
                                            </div>
                                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#ECEEF2]">
                                              <div className="h-full rounded-full bg-black" style={{ width: `${signalValue}%` }} />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                                      <button
                                        type="button"
                                        onClick={() => handleCreateSalesPage(product)}
                                        className="inline-flex h-9 items-center justify-center gap-2 rounded-[9px] border border-black/[0.08] bg-white px-3 text-[12px] font-semibold text-[#111827] transition hover:bg-[#F4F4F5]"
                                      >
                                        <FilePlus2 size={14} strokeWidth={1.8} />
                                        Criar página
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleCreateStore(product)}
                                        className="inline-flex h-9 items-center justify-center gap-2 rounded-[9px] bg-black px-3 text-[12px] font-semibold text-white transition hover:bg-[#222222]"
                                      >
                                        <Store size={14} strokeWidth={1.8} />
                                        Importar para loja
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
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

      <ProjectCreationWizard
        open={!!wizardProduct}
        onClose={() => setWizardProduct(null)}
        lockedTipo="pagina_venda"
        preselectedProductIds={wizardProduct ? [wizardProduct.id] : []}
        onCreated={handleProjectCreated}
      />
    </div>
  );
};

export default TrendingProductsPage;
