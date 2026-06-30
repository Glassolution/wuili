import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ChevronDown,
  RefreshCw,
  Package,
  ChevronLeft,
  ChevronRight,
  Check,
  Plug,
  SlidersHorizontal,
  Heart,
  ShoppingBag,
  RotateCcw,
  Star,
  ArrowRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { veloToast } from "@/components/ui/velo-toast";
import ImportProductModal, { type CatalogProduct } from "@/components/dashboard/ImportProductModal";
import PlatformIntegrationModal from "@/components/dashboard/PlatformIntegrationModal";
import SupplierCompareModal from "@/components/dashboard/SupplierCompareModal";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { supabase, supabaseUrl } from "@/integrations/supabase/client";
import { createTimeoutSignal } from "@/lib/requestTimeout";

const CATEGORIES = [
  { key: "todos", label: "Todos" },
  { key: "beleza", label: "Beleza" },
  { key: "casa", label: "Casa" },
  { key: "eletronicos", label: "Eletrônicos" },
  { key: "moda", label: "Moda" },
  { key: "esporte", label: "Esporte" },
  { key: "pet", label: "Pet" },
  { key: "bebes", label: "Bebês" },
  { key: "organizacao", label: "Organização" },
];

const DATE_FILTERS = [
  { key: "todos", label: "Todas as datas" },
  { key: "today", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
];

const PAYMENT_STATUS_FILTERS = [
  { key: "todos", label: "Status de preço" },
  { key: "priced", label: "Com preço" },
  { key: "missing_price", label: "Sem preço" },
  { key: "positive_margin", label: "Margem positiva" },
];

const PLATFORM_CONFIG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  c7drop: { label: "C7Drop", bg: "#f0fdf4", color: "#15803d", icon: "C7" },
  aliexpress: { label: "AliExpress", bg: "#fff0f0", color: "#d82f2f", icon: "AE" },
  amazon: { label: "Amazon", bg: "#fff8de", color: "#a76f00", icon: "AZ" },
  shopee: { label: "Shopee", bg: "#fff1e8", color: "#d84b23", icon: "SP" },
  mercadolivre: { label: "Mercado Livre", bg: "#fffbd8", color: "#977000", icon: "ML" },
};

type CatalogProductWithMeta = CatalogProduct & {
  created_at?: string | null;
  updated_at?: string | null;
  supplier_name?: string | null;
  is_active?: boolean | null;
};

type CatalogResponse = {
  products?: CatalogProductWithMeta[];
  totalPages?: number;
  total?: number;
};

function getPlatform(source: string | null | undefined) {
  if (!source) return PLATFORM_CONFIG.c7drop;
  return PLATFORM_CONFIG[source.toLowerCase()] ?? {
    label: source,
    bg: "#f4f4f5",
    color: "#52525b",
    icon: source.slice(0, 2).toUpperCase(),
  };
}

const formatCategoryLabel = (category: string | null | undefined) =>
  category
    ? category.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "Catálogo";

const getProductImage = (images: CatalogProduct["images"]): string | null => {
  try {
    const parsed = typeof images === "string" ? JSON.parse(images) : images;
    return Array.isArray(parsed) && parsed.length > 0 ? String(parsed[0]) : null;
  } catch {
    return null;
  }
};

interface ProductCardProps {
  product: CatalogProductWithMeta;
  index: number;
  onImport: () => void;
  onCompare: () => void;
  formatPrice: (value: number) => string;
}

const ProductCard = ({ product, index, onImport, onCompare, formatPrice }: ProductCardProps) => {
  const image = getProductImage(product.images);
  const [favorited, setFavorited] = useState(index === 1);
  const [imageFailed, setImageFailed] = useState(false);
  const platform = getPlatform(product.source);
  const estimatedProfit = Math.max(0, Number(product.suggested_price ?? 0) - Number(product.cost_price ?? 0));
  const marginPercent =
    Number(product.margin_percent ?? 0) ||
    (Number(product.cost_price) > 0 ? (estimatedProfit / Number(product.cost_price)) * 100 : 0);
  const primaryPrice =
    Number(product.suggested_price ?? 0) > 0
      ? Number(product.suggested_price)
      : Number(product.cost_price ?? 0);
  const categoryLabel = formatCategoryLabel(product.category);

  useEffect(() => {
    setImageFailed(false);
  }, [image]);

  return (
    <article className="catalog-product-card">
      <div className="catalog-product-media">
        <span className="catalog-product-pill">{categoryLabel}</span>
        <button
          type="button"
          className={`catalog-heart-button ${favorited ? "is-active" : ""}`}
          onClick={() => setFavorited((value) => !value)}
          aria-label={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart size={16} strokeWidth={1.9} fill={favorited ? "currentColor" : "none"} />
        </button>

        {image && !imageFailed ? (
          <img
            src={image}
            alt={product.title}
            className="catalog-product-image"
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="catalog-image-fallback">
            <Package size={40} strokeWidth={1.35} />
          </div>
        )}
      </div>

      <div className="catalog-product-body">
        <div className="catalog-product-source" style={{ color: platform.color, background: platform.bg }}>
          <span>{platform.icon}</span>
          {platform.label}
        </div>
        <h3>{product.title}</h3>

        <div className="catalog-product-meta">
          <span>
            <Star size={13} strokeWidth={1.8} fill="currentColor" />
            {marginPercent > 0 ? `${Math.round(marginPercent)}% margem` : "Novo"}
          </span>
          <strong>{formatPrice(primaryPrice)}</strong>
        </div>

        <div className="catalog-card-actions">
          <button type="button" onClick={onCompare} className="catalog-secondary-button">
            Fornecedores
          </button>
          <button type="button" onClick={onImport} className="catalog-primary-button">
            Importar
          </button>
        </div>
      </div>
    </article>
  );
};

const CatalogPage = () => {
  const [category, setCategory] = useState("todos");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("todos");
  const [paymentStatus, setPaymentStatus] = useState("todos");
  const [hideUnavailable, setHideUnavailable] = useState(true);
  const [sortOrder, setSortOrder] = useState("popular");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [compareProductId, setCompareProductId] = useState<string | null>(null);
  const [compareProductTitle, setCompareProductTitle] = useState("");
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const paymentDropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const planLimits = usePlanLimits();
  const limit = 12;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target as Node)) {
        setDateDropdownOpen(false);
      }
      if (paymentDropdownRef.current && !paymentDropdownRef.current.contains(event.target as Node)) {
        setPaymentDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data, isLoading, isError, refetch } = useQuery<CatalogResponse>({
    queryKey: ["catalog", category, page, search],
    staleTime: 60 * 1000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (category !== "todos") params.set("category", category);
      if (search) params.set("search", search);
      const baseUrl = supabaseUrl || `https://${projectId}.supabase.co`;
      const url = `${baseUrl}/functions/v1/catalog?${params}`;
      const timeout = createTimeoutSignal(8000, signal);

      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${anonKey}` },
          signal: timeout.signal,
        });
        if (!response.ok) throw new Error("Failed to fetch catalog");
        return response.json() as Promise<CatalogResponse>;
      } finally {
        timeout.clear();
      }
    },
  });

  // Sincronização manual desativada — catálogo agora vem do cron C7Drop.
  const syncMutation = useMutation({
    mutationFn: async () => {
      throw new Error("Sincronização manual desativada. O catálogo agora é alimentado pelo cron C7Drop.");
    },
    onError: (err: Error) => veloToast.error(err.message),
  });


  const rawProducts = data?.products || [];
  const totalPages = data?.totalPages || 1;

  const products = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const now = new Date();
    const parsedMin = priceMin.trim() === "" ? Number.NEGATIVE_INFINITY : Number(priceMin.replace(",", "."));
    const parsedMax = priceMax.trim() === "" ? Number.POSITIVE_INFINITY : Number(priceMax.replace(",", "."));
    const minPrice = Number.isFinite(parsedMin) ? parsedMin : Number.NEGATIVE_INFINITY;
    const maxPrice = Number.isFinite(parsedMax) ? parsedMax : Number.POSITIVE_INFINITY;

    const filtered = rawProducts.filter((product) => {
      const stockQuantity = product.stock_quantity;
      if (stockQuantity !== null && stockQuantity !== undefined && Number(stockQuantity) <= 0) return false;

      const haystack = [
        product.title,
        product.category,
        product.source,
        product.supplier_name,
        product.external_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (normalizedSearch && !haystack.includes(normalizedSearch)) return false;

      const productPrice = Number(product.suggested_price ?? product.cost_price ?? 0);
      if (productPrice < minPrice || productPrice > maxPrice) return false;

      if (dateFilter !== "todos") {
        const rawDate = product.created_at || product.updated_at;
        if (!rawDate) return false;

        const productDate = new Date(rawDate);
        if (Number.isNaN(productDate.getTime())) return false;

        if (dateFilter === "today") {
          if (productDate.toDateString() !== now.toDateString()) return false;
        } else {
          const days = Number(dateFilter.replace("d", ""));
          const cutoff = new Date(now);
          cutoff.setDate(now.getDate() - days);
          if (productDate < cutoff) return false;
        }
      }

      if (paymentStatus !== "todos") {
        const hasPrice = Number(product.cost_price) > 0 && Number(product.suggested_price) > 0;
        const hasPositiveMargin =
          Number(product.margin_percent) > 0 || Number(product.suggested_price) > Number(product.cost_price);

        if (paymentStatus === "priced" && !hasPrice) return false;
        if (paymentStatus === "missing_price" && hasPrice) return false;
        if (paymentStatus === "positive_margin" && !hasPositiveMargin) return false;
      }

      if (hideUnavailable && product.is_active === false) return false;

      return true;
    });

    return [...filtered].sort((a, b) => {
      const priceA = Number(a.suggested_price ?? a.cost_price ?? 0);
      const priceB = Number(b.suggested_price ?? b.cost_price ?? 0);
      const profitA = Math.max(0, Number(a.suggested_price ?? 0) - Number(a.cost_price ?? 0));
      const profitB = Math.max(0, Number(b.suggested_price ?? 0) - Number(b.cost_price ?? 0));

      if (sortOrder === "price_asc") return priceA - priceB;
      if (sortOrder === "price_desc") return priceB - priceA;
      if (sortOrder === "profit_desc") return profitB - profitA;
      if (sortOrder === "newest") {
        return (
          new Date(b.created_at || b.updated_at || 0).getTime() -
          new Date(a.created_at || a.updated_at || 0).getTime()
        );
      }

      const marginA =
        Number(a.margin_percent ?? 0) || (Number(a.cost_price) > 0 ? (profitA / Number(a.cost_price)) * 100 : 0);
      const marginB =
        Number(b.margin_percent ?? 0) || (Number(b.cost_price) > 0 ? (profitB / Number(b.cost_price)) * 100 : 0);
      return marginB - marginA || profitB - profitA;
    });
  }, [rawProducts, search, dateFilter, paymentStatus, hideUnavailable, priceMin, priceMax, sortOrder]);

  const categoryCounts = useMemo(() => {
    return rawProducts.reduce<Record<string, number>>((acc, product) => {
      acc.todos = (acc.todos || 0) + 1;
      if (product.category) acc[product.category] = (acc[product.category] || 0) + 1;
      return acc;
    }, {});
  }, [rawProducts]);

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const activeCategoryLabel = CATEGORIES.find((item) => item.key === category)?.label ?? "Todos";
  const activeDateLabel = DATE_FILTERS.find((filter) => filter.key === dateFilter)?.label ?? "Todas as datas";
  const activePaymentLabel =
    PAYMENT_STATUS_FILTERS.find((filter) => filter.key === paymentStatus)?.label ?? "Status de preço";
  const activeFilterCount = [
    category !== "todos",
    dateFilter !== "todos",
    paymentStatus !== "todos",
    hideUnavailable,
    Boolean(priceMin || priceMax),
  ].filter(Boolean).length;

  const heroProduct = products[0] || rawProducts[0];
  const heroImage = heroProduct ? getProductImage(heroProduct.images) : null;
  const recommendationProducts = products.slice(0, 4);

  const clearFilters = () => {
    setSearch("");
    setCategory("todos");
    setDateFilter("todos");
    setPaymentStatus("todos");
    setHideUnavailable(true);
    setPriceMin("");
    setPriceMax("");
    setPage(1);
  };

  const openImportModal = (product: CatalogProductWithMeta) => {
    setSelectedProduct(product);
    setIsImportModalOpen(true);
  };

  const openCompareModal = (product: CatalogProductWithMeta) => {
    setCompareProductId(product.id);
    setCompareProductTitle(product.title);
  };

  return (
    <div className="catalog-page-shell">
      <div className="catalog-apple-board">
        <header className="catalog-topbar">
          <a href="/dashboard" className="catalog-brand" aria-label="Velo">
            <span>V</span>
            Velo
          </a>
          <nav aria-label="Seções do catálogo">
            <a href="#produtos">Produtos</a>
            <a href="#recomendacoes">Recomendações</a>
            <button type="button" onClick={() => setIsIntegrationModalOpen(true)}>
              Integrações
            </button>
          </nav>
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="catalog-sync-icon"
            aria-label="Sincronizar catálogo"
          >
            <RefreshCw size={17} strokeWidth={1.8} className={syncMutation.isPending ? "animate-spin" : ""} />
          </button>
        </header>

        <section className="catalog-hero" style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}>
          <div className="catalog-hero-overlay" />
          <div className="catalog-hero-content">
            <span>Catálogo Velo</span>
            <h1>Shop</h1>
            <p>Produtos reais para importar, precificar com margem e publicar em poucos cliques.</p>
          </div>
          <div className="catalog-hero-stats">
            <span>{products.length} produtos</span>
            <span>{activeCategoryLabel}</span>
          </div>
        </section>

        <section className="catalog-shop-panel" id="produtos">
          <div className="catalog-shop-head">
            <div>
              <span className="catalog-eyebrow">Give all you need</span>
              <h2>Escolha o próximo produto vencedor</h2>
            </div>
            <div className="catalog-searchbar">
              <Search size={16} strokeWidth={1.8} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar no catálogo"
              />
              <button type="button" onClick={() => void refetch()}>
                Buscar
              </button>
            </div>
          </div>

          <div className="catalog-shop-layout">
            <aside className="catalog-filter-rail">
              <div className="catalog-filter-title">
                <span>Categoria</span>
                <small>{activeFilterCount} filtros</small>
              </div>

              <div className="catalog-category-list">
                {CATEGORIES.map((item) => {
                  const active = category === item.key;
                  const count = categoryCounts[item.key] ?? 0;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={active ? "is-active" : ""}
                      onClick={() => {
                        setCategory(item.key);
                        setPage(1);
                      }}
                    >
                      <span className="catalog-category-icon">
                        {active ? <Check size={13} strokeWidth={2.5} /> : <ShoppingBag size={13} strokeWidth={1.8} />}
                      </span>
                      <span>{item.label}</span>
                      <strong>{count}</strong>
                    </button>
                  );
                })}
              </div>

              <div className="catalog-filter-block">
                <button
                  type="button"
                  className="catalog-filter-row"
                  onClick={() => setDateDropdownOpen((value) => !value)}
                >
                  <span>Data</span>
                  <small>{activeDateLabel}</small>
                  <ChevronDown size={14} className={dateDropdownOpen ? "is-open" : ""} />
                </button>
                {dateDropdownOpen && (
                  <div className="catalog-dropdown-list" ref={dateDropdownRef}>
                    {DATE_FILTERS.map((filter) => (
                      <button
                        key={filter.key}
                        type="button"
                        className={dateFilter === filter.key ? "is-active" : ""}
                        onClick={() => {
                          setDateFilter(filter.key);
                          setDateDropdownOpen(false);
                          setPage(1);
                        }}
                      >
                        {filter.label}
                        {dateFilter === filter.key && <Check size={13} strokeWidth={2.4} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="catalog-filter-block">
                <button
                  type="button"
                  className="catalog-filter-row"
                  onClick={() => setPaymentDropdownOpen((value) => !value)}
                >
                  <span>Preço</span>
                  <small>{activePaymentLabel}</small>
                  <ChevronDown size={14} className={paymentDropdownOpen ? "is-open" : ""} />
                </button>
                {paymentDropdownOpen && (
                  <div className="catalog-dropdown-list" ref={paymentDropdownRef}>
                    {PAYMENT_STATUS_FILTERS.map((filter) => (
                      <button
                        key={filter.key}
                        type="button"
                        className={paymentStatus === filter.key ? "is-active" : ""}
                        onClick={() => {
                          setPaymentStatus(filter.key);
                          setPaymentDropdownOpen(false);
                          setPage(1);
                        }}
                      >
                        {filter.label}
                        {paymentStatus === filter.key && <Check size={13} strokeWidth={2.4} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="catalog-price-filter">
                <span>Faixa de preço</span>
                <div>
                  <input
                    value={priceMin}
                    onChange={(event) => {
                      setPriceMin(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Mín."
                    inputMode="decimal"
                  />
                  <input
                    value={priceMax}
                    onChange={(event) => {
                      setPriceMax(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Máx."
                    inputMode="decimal"
                  />
                </div>
              </div>

              <label className="catalog-toggle-line">
                <button
                  type="button"
                  className={hideUnavailable ? "is-active" : ""}
                  onClick={() => {
                    setHideUnavailable((value) => !value);
                    setPage(1);
                  }}
                  aria-pressed={hideUnavailable}
                >
                  <span />
                </button>
                Somente ativos
              </label>

              <label className="catalog-sort-select">
                <select
                  value={sortOrder}
                  onChange={(event) => {
                    setSortOrder(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="popular">Mais promissores</option>
                  <option value="price_asc">Menor preço</option>
                  <option value="price_desc">Maior preço</option>
                  <option value="profit_desc">Maior lucro</option>
                  <option value="newest">Mais recentes</option>
                </select>
                <ChevronDown size={14} />
              </label>

              <button type="button" className="catalog-clear-filters" onClick={clearFilters}>
                <RotateCcw size={14} strokeWidth={1.8} />
                Limpar filtros
              </button>
            </aside>

            <main className="catalog-results-area">
              {isLoading ? (
                <div className="catalog-products-grid">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <div key={index} className="catalog-skeleton-card">
                      <Skeleton className="h-[190px] w-full rounded-[18px]" />
                      <Skeleton className="h-5 w-4/5 rounded-md" />
                      <Skeleton className="h-4 w-2/5 rounded-md" />
                      <Skeleton className="h-10 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              ) : isError ? (
                <div className="catalog-empty-state">
                  <Package size={46} strokeWidth={1.5} />
                  <strong>Não foi possível carregar o catálogo</strong>
                  <span>Verifique a conexão com o Supabase e tente novamente.</span>
                  <button type="button" onClick={() => void refetch()}>
                    Tentar novamente
                  </button>
                </div>
              ) : products.length === 0 ? (
                <div className="catalog-empty-state">
                  <Package size={46} strokeWidth={1.5} />
                  <strong>Nenhum produto encontrado</strong>
                  <span>Sincronize ou ajuste os filtros para encontrar produtos disponíveis.</span>
                  <button type="button" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                    Sincronizar catálogo
                  </button>
                </div>
              ) : (
                <>
                  <div className="catalog-products-grid">
                    {products.map((product, index) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        index={index}
                        onImport={() => openImportModal(product)}
                        onCompare={() => openCompareModal(product)}
                        formatPrice={formatPrice}
                      />
                    ))}
                  </div>

                  <div className="catalog-pagination">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft size={14} />
                      Anterior
                    </button>
                    <span>{page}</span>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page >= totalPages}
                    >
                      Próxima
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </>
              )}
            </main>
          </div>
        </section>

        {recommendationProducts.length > 0 && (
          <section className="catalog-recommendations" id="recomendacoes">
            <div className="catalog-section-heading">
              <h2>Explore recomendações</h2>
              <div>
                <button type="button" aria-label="Voltar recomendações">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" aria-label="Avançar recomendações">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="catalog-recommendation-row">
              {recommendationProducts.map((product, index) => (
                <ProductCard
                  key={`recommendation-${product.id}`}
                  product={product}
                  index={index}
                  onImport={() => openImportModal(product)}
                  onCompare={() => openCompareModal(product)}
                  formatPrice={formatPrice}
                />
              ))}
            </div>
          </section>
        )}

        <section className="catalog-cta">
          <div>
            <h2>Pronto para vender sem travar?</h2>
            <form onSubmit={(event) => event.preventDefault()}>
              <input placeholder="Seu melhor e-mail" type="email" />
              <button type="submit">Enviar</button>
            </form>
          </div>
          <p>
            A Velo ajuda você a escolher, importar e publicar produtos com margem. Menos planilha,
            mais operação.
          </p>
          <ArrowRight size={28} strokeWidth={1.5} />
        </section>
      </div>

      <ImportProductModal
        open={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          void planLimits.refreshUsage();
        }}
        product={selectedProduct}
      />

      <SupplierCompareModal
        open={!!compareProductId}
        onClose={() => setCompareProductId(null)}
        productId={compareProductId || ""}
        productTitle={compareProductTitle}
      />

      <PlatformIntegrationModal
        open={isIntegrationModalOpen}
        onClose={() => setIsIntegrationModalOpen(false)}
      />

      <style>{`
        .catalog-page-shell {
          min-height: 100%;
          padding: 0;
          color: #09090b;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
        }

        .catalog-apple-board {
          width: min(100%, 1180px);
          margin: 0 auto 48px;
          background: #ffffff;
          border-radius: 0 0 28px 28px;
          overflow: hidden;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
        }

        .catalog-topbar {
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 0 30px;
          border-bottom: 1px solid rgba(9, 9, 11, 0.06);
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(18px);
        }

        .catalog-brand {
          color: #09090b;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .catalog-brand span {
          width: 26px;
          height: 26px;
          border-radius: 9px;
          background: #09090b;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }

        .catalog-topbar nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 34px;
          font-size: 13px;
          font-weight: 650;
        }

        .catalog-topbar nav a,
        .catalog-topbar nav button {
          border: 0;
          background: transparent;
          color: #2f3033;
          text-decoration: none;
          cursor: pointer;
          padding: 0;
          font: inherit;
        }

        .catalog-sync-icon {
          width: 36px;
          height: 36px;
          border: 1px solid #e8e8ea;
          border-radius: 999px;
          background: #ffffff;
          color: #09090b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 180ms ease, background 180ms ease;
        }

        .catalog-sync-icon:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #f5f5f7;
        }

        .catalog-sync-icon:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .catalog-hero {
          position: relative;
          min-height: 330px;
          background: #d9d9d9;
          background-size: cover;
          background-position: center;
          overflow: hidden;
        }

        .catalog-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.18) 48%, rgba(255, 255, 255, 0.65)),
            radial-gradient(circle at 18% 20%, rgba(255, 255, 255, 0.92), transparent 34%);
          z-index: 1;
        }

        .catalog-hero:not([style]) {
          background:
            linear-gradient(135deg, #f5f5f7 0%, #dadde3 50%, #ffffff 100%);
        }

        .catalog-hero-overlay {
          position: absolute;
          inset: auto 0 0;
          height: 42%;
          background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.68));
          z-index: 2;
        }

        .catalog-hero-content {
          position: relative;
          z-index: 3;
          padding: 58px 56px 42px;
        }

        .catalog-hero-content span {
          display: inline-flex;
          height: 28px;
          align-items: center;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.78);
          color: #09090b;
          padding: 0 13px;
          font-size: 12px;
          font-weight: 750;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        }

        .catalog-hero-content h1 {
          margin: -2px 0 0;
          color: rgba(255, 255, 255, 0.92);
          font-size: clamp(112px, 20vw, 260px);
          line-height: 0.78;
          font-weight: 900;
          letter-spacing: -0.09em;
          text-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);
        }

        .catalog-hero-content p {
          max-width: 450px;
          margin: 20px 0 0;
          color: #1f2937;
          font-size: 17px;
          line-height: 1.45;
          font-weight: 560;
        }

        .catalog-hero-stats {
          position: absolute;
          right: 34px;
          bottom: 28px;
          z-index: 4;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .catalog-hero-stats span {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.8);
          color: #09090b;
          padding: 0 14px;
          font-size: 12px;
          font-weight: 760;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08);
        }

        .catalog-shop-panel {
          position: relative;
          z-index: 5;
          width: calc(100% - 64px);
          margin: -42px auto 0;
          border-radius: 22px;
          background: #ffffff;
          padding: 26px 28px 34px;
          box-shadow: 0 -10px 44px rgba(15, 23, 42, 0.09);
        }

        .catalog-shop-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 28px;
          margin-bottom: 30px;
        }

        .catalog-eyebrow {
          color: #09090b;
          font-size: 13px;
          font-weight: 850;
        }

        .catalog-shop-head h2,
        .catalog-section-heading h2,
        .catalog-cta h2 {
          margin: 8px 0 0;
          color: #050505;
          font-size: clamp(28px, 3vw, 42px);
          line-height: 0.98;
          letter-spacing: -0.055em;
          font-weight: 850;
        }

        .catalog-searchbar {
          width: min(420px, 100%);
          height: 42px;
          border: 1px solid #e7e7ea;
          border-radius: 999px;
          background: #ffffff;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) auto;
          align-items: center;
          padding: 4px 5px 4px 13px;
          color: #7a7f87;
        }

        .catalog-searchbar input {
          width: 100%;
          border: 0;
          outline: 0;
          color: #09090b;
          background: transparent;
          font-size: 13px;
          min-width: 0;
        }

        .catalog-searchbar button {
          height: 32px;
          border: 0;
          border-radius: 999px;
          background: #09090b;
          color: #ffffff;
          padding: 0 18px;
          font-size: 12px;
          font-weight: 760;
        }

        .catalog-shop-layout {
          display: grid;
          grid-template-columns: 210px minmax(0, 1fr);
          gap: 28px;
          align-items: start;
        }

        .catalog-filter-rail {
          position: sticky;
          top: 14px;
          min-width: 0;
          color: #09090b;
        }

        .catalog-filter-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 18px;
          font-weight: 840;
          letter-spacing: -0.03em;
        }

        .catalog-filter-title small {
          border-radius: 999px;
          background: #f1f1f3;
          padding: 4px 8px;
          color: #696f77;
          font-size: 11px;
          letter-spacing: 0;
        }

        .catalog-category-list,
        .catalog-dropdown-list {
          display: flex;
          flex-direction: column;
        }

        .catalog-category-list button,
        .catalog-dropdown-list button {
          width: 100%;
          min-height: 38px;
          border: 0;
          background: transparent;
          color: #41464d;
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr) auto;
          align-items: center;
          gap: 9px;
          border-radius: 12px;
          padding: 0 10px;
          text-align: left;
          font-size: 13px;
          font-weight: 620;
          cursor: pointer;
        }

        .catalog-category-list button:hover,
        .catalog-category-list button.is-active,
        .catalog-dropdown-list button:hover,
        .catalog-dropdown-list button.is-active {
          background: #f5f5f7;
          color: #09090b;
        }

        .catalog-category-list strong {
          min-width: 24px;
          height: 20px;
          border-radius: 999px;
          background: #ff465d;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 6px;
          font-size: 10px;
          font-weight: 850;
        }

        .catalog-category-icon {
          width: 22px;
          height: 22px;
          border-radius: 8px;
          background: #ffffff;
          color: #737880;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 0 1px #e8e8eb;
        }

        .catalog-category-list button.is-active .catalog-category-icon {
          background: #09090b;
          color: #ffffff;
        }

        .catalog-filter-block,
        .catalog-price-filter,
        .catalog-toggle-line,
        .catalog-sort-select,
        .catalog-clear-filters {
          margin-top: 16px;
        }

        .catalog-filter-row {
          width: 100%;
          min-height: 40px;
          border: 0;
          border-radius: 12px;
          background: transparent;
          color: #09090b;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          text-align: left;
          font-size: 13px;
          font-weight: 780;
        }

        .catalog-filter-row small {
          max-width: 86px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #757b84;
          font-size: 11px;
          font-weight: 620;
        }

        .catalog-filter-row svg,
        .catalog-sort-select svg {
          transition: transform 160ms ease;
        }

        .catalog-filter-row svg.is-open {
          transform: rotate(180deg);
        }

        .catalog-dropdown-list {
          gap: 4px;
          margin-top: 5px;
          padding: 6px;
          border-radius: 14px;
          background: #fafafa;
          box-shadow: inset 0 0 0 1px #ececef;
        }

        .catalog-dropdown-list button {
          grid-template-columns: minmax(0, 1fr) auto;
          min-height: 32px;
          font-size: 12px;
        }

        .catalog-price-filter > span {
          display: block;
          margin-bottom: 8px;
          color: #09090b;
          font-size: 13px;
          font-weight: 780;
        }

        .catalog-price-filter > div {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .catalog-price-filter input {
          min-width: 0;
          height: 38px;
          border: 1px solid #e6e6e9;
          border-radius: 999px;
          background: #ffffff;
          color: #09090b;
          padding: 0 12px;
          outline: 0;
          font-size: 12px;
          font-weight: 620;
        }

        .catalog-toggle-line {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #41464d;
          font-size: 13px;
          font-weight: 650;
        }

        .catalog-toggle-line button {
          width: 39px;
          height: 22px;
          border: 0;
          border-radius: 999px;
          background: #dedee3;
          position: relative;
          transition: background 160ms ease;
        }

        .catalog-toggle-line button span {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.16);
          transition: transform 160ms ease;
        }

        .catalog-toggle-line button.is-active {
          background: #09090b;
        }

        .catalog-toggle-line button.is-active span {
          transform: translateX(17px);
        }

        .catalog-sort-select {
          width: 100%;
          height: 40px;
          border: 1px solid #e6e6e9;
          border-radius: 999px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 0 12px;
          color: #09090b;
        }

        .catalog-sort-select select {
          appearance: none;
          border: 0;
          outline: 0;
          background: transparent;
          color: inherit;
          width: 100%;
          min-width: 0;
          font-size: 12px;
          font-weight: 700;
        }

        .catalog-clear-filters {
          width: 100%;
          height: 40px;
          border: 1px solid #e6e6e9;
          border-radius: 999px;
          background: #ffffff;
          color: #09090b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 760;
        }

        .catalog-results-area {
          min-width: 0;
        }

        .catalog-products-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 26px 28px;
        }

        .catalog-skeleton-card,
        .catalog-product-card {
          min-width: 0;
          border-radius: 0;
        }

        .catalog-skeleton-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .catalog-product-card {
          position: relative;
          overflow: visible;
          background: transparent;
        }

        .catalog-product-media {
          position: relative;
          min-height: 214px;
          border-radius: 18px;
          background: #f2f2f3;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px;
          overflow: hidden;
          transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .catalog-product-card:hover .catalog-product-media {
          transform: translateY(-2px);
          box-shadow: 0 18px 32px rgba(15, 23, 42, 0.08);
        }

        .catalog-product-pill {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 2;
          min-height: 24px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.86);
          color: #09090b;
          display: inline-flex;
          align-items: center;
          padding: 0 11px;
          font-size: 11px;
          font-weight: 780;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
        }

        .catalog-heart-button {
          position: absolute;
          left: 10px;
          top: 10px;
          z-index: 2;
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.84);
          color: #6e747c;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: color 160ms ease, transform 160ms ease;
        }

        .catalog-heart-button:hover,
        .catalog-heart-button.is-active {
          color: #ff3658;
          transform: scale(1.04);
        }

        .catalog-product-image {
          max-width: 92%;
          max-height: 164px;
          width: auto;
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 20px 24px rgba(15, 23, 42, 0.12));
          transition: transform 220ms ease;
        }

        .catalog-product-card:hover .catalog-product-image {
          transform: scale(1.04);
        }

        .catalog-image-fallback {
          width: 120px;
          height: 120px;
          border-radius: 26px;
          background: #ffffff;
          color: #a1a1aa;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 0 1px #e7e7ea;
        }

        .catalog-product-body {
          padding: 14px 2px 0;
        }

        .catalog-product-source {
          width: fit-content;
          min-height: 22px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0 8px;
          font-size: 10px;
          font-weight: 780;
        }

        .catalog-product-source span {
          font-size: 9px;
          font-weight: 900;
        }

        .catalog-product-body h3 {
          min-height: 42px;
          margin: 10px 0 8px;
          color: #09090b;
          font-size: 17px;
          line-height: 1.22;
          letter-spacing: -0.035em;
          font-weight: 780;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .catalog-product-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .catalog-product-meta span {
          color: #6f757d;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 650;
        }

        .catalog-product-meta span svg {
          color: #f2a33a;
        }

        .catalog-product-meta strong {
          color: #09090b;
          font-size: 18px;
          line-height: 1;
          letter-spacing: -0.03em;
          white-space: nowrap;
        }

        .catalog-card-actions {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 8px;
        }

        .catalog-primary-button,
        .catalog-secondary-button {
          height: 36px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 780;
          transition: transform 160ms ease, background 160ms ease;
        }

        .catalog-primary-button {
          border: 0;
          background: #09090b;
          color: #ffffff;
        }

        .catalog-secondary-button {
          border: 1px solid #dedee3;
          background: #ffffff;
          color: #09090b;
        }

        .catalog-primary-button:hover,
        .catalog-secondary-button:hover {
          transform: translateY(-1px);
        }

        .catalog-empty-state {
          min-height: 420px;
          border-radius: 24px;
          background: #f5f5f7;
          color: #6f757d;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          text-align: center;
          padding: 36px;
        }

        .catalog-empty-state strong {
          color: #09090b;
          font-size: 24px;
          letter-spacing: -0.04em;
        }

        .catalog-empty-state button {
          height: 40px;
          border: 0;
          border-radius: 999px;
          background: #09090b;
          color: #ffffff;
          padding: 0 18px;
          font-size: 12px;
          font-weight: 760;
        }

        .catalog-pagination {
          margin-top: 36px;
          padding-top: 22px;
          border-top: 1px solid #ececef;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .catalog-pagination button {
          min-width: 120px;
          height: 38px;
          border: 0;
          background: transparent;
          color: #09090b;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 760;
        }

        .catalog-pagination button:disabled {
          color: #a1a1aa;
          cursor: not-allowed;
        }

        .catalog-pagination span {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: #f5f5f7;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
        }

        .catalog-recommendations {
          padding: 68px 32px 36px;
        }

        .catalog-section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 26px;
        }

        .catalog-section-heading div {
          display: flex;
          gap: 8px;
        }

        .catalog-section-heading button {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 999px;
          background: #f5f5f7;
          color: #09090b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .catalog-recommendation-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(220px, 1fr));
          gap: 26px;
          overflow: hidden;
        }

        .catalog-cta {
          margin: 38px 32px 42px;
          min-height: 210px;
          border-radius: 18px;
          background: linear-gradient(135deg, #111113, #262628);
          color: #ffffff;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 0.75fr) auto;
          align-items: end;
          gap: 34px;
          padding: 28px;
        }

        .catalog-cta h2 {
          color: #ffffff;
          max-width: 440px;
        }

        .catalog-cta form {
          width: min(250px, 100%);
          height: 42px;
          margin-top: 26px;
          border-radius: 999px;
          background: #ffffff;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          padding: 4px;
        }

        .catalog-cta input {
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          padding: 0 12px;
          font-size: 12px;
        }

        .catalog-cta button {
          height: 34px;
          border: 0;
          border-radius: 999px;
          background: #09090b;
          color: #ffffff;
          padding: 0 16px;
          font-size: 12px;
          font-weight: 760;
        }

        .catalog-cta p {
          margin: 0;
          color: rgba(255, 255, 255, 0.78);
          font-size: 13px;
          line-height: 1.65;
        }

        @media (max-width: 1220px) {
          .catalog-apple-board {
            width: 100%;
            border-radius: 0;
          }

          .catalog-shop-panel {
            width: calc(100% - 36px);
          }

          .catalog-shop-layout {
            grid-template-columns: 1fr;
          }

          .catalog-filter-rail {
            position: static;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }

          .catalog-filter-title,
          .catalog-category-list {
            grid-column: 1 / -1;
          }

          .catalog-category-list {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }
        }

        @media (max-width: 900px) {
          .catalog-topbar {
            padding: 0 18px;
          }

          .catalog-topbar nav {
            display: none;
          }

          .catalog-hero {
            min-height: 280px;
          }

          .catalog-hero-content {
            padding: 42px 28px;
          }

          .catalog-hero-content p {
            font-size: 14px;
          }

          .catalog-shop-head {
            flex-direction: column;
          }

          .catalog-searchbar {
            width: 100%;
          }

          .catalog-products-grid,
          .catalog-recommendation-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .catalog-cta {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 620px) {
          .catalog-shop-panel {
            width: calc(100% - 20px);
            padding: 22px 16px 28px;
          }

          .catalog-filter-rail,
          .catalog-category-list,
          .catalog-products-grid,
          .catalog-recommendation-row {
            grid-template-columns: 1fr;
          }

          .catalog-product-media {
            min-height: 230px;
          }

          .catalog-hero-stats {
            left: 24px;
            right: 24px;
            justify-content: flex-start;
          }

          .catalog-recommendations {
            padding: 48px 18px 28px;
          }

          .catalog-cta {
            margin: 26px 18px 34px;
            padding: 22px;
          }
        }
      `}</style>
    </div>
  );
};

export default CatalogPage;
