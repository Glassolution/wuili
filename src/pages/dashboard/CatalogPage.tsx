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
  Grid2X2,
  List,
  Heart,
  ShoppingBag,
  RotateCcw,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
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
  { key: "todos", label: "Status de pagamento" },
  { key: "priced", label: "Com preço" },
  { key: "missing_price", label: "Sem preço" },
  { key: "positive_margin", label: "Margem positiva" },
  { key: "out_of_stock", label: "Sem estoque" },
];

// ── Platform badge config ─────────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  cj:           { label: "CJ Dropshipping", bg: "#FFF3E0", color: "#E65100", icon: "CJ" },
  aliexpress:   { label: "AliExpress",      bg: "#FFF0F0", color: "#E53935", icon: "AE" },
  amazon:       { label: "Amazon",          bg: "#FFF8E1", color: "#F57F17", icon: "AZ" },
  shopee:       { label: "Shopee",          bg: "#FFF3E0", color: "#EE4D2D", icon: "SP" },
  mercadolivre: { label: "Mercado Livre",   bg: "#FFFDE7", color: "#F9A825", icon: "ML" },
};

function getPlatform(source: string | null) {
  if (!source) return { label: "CJ Dropshipping", bg: "#FFF3E0", color: "#E65100", icon: "CJ" };
  return PLATFORM_CONFIG[source.toLowerCase()] ?? { label: source, bg: "#F5F5F5", color: "#555", icon: source.slice(0, 2).toUpperCase() };
}

// ── Product Card ──────────────────────────────────────────────────────────────
interface ProductCardProps {
  p: any;
  index: number;
  onImport: () => void;
  onCompare: () => void;
  formatPrice: (v: number) => string;
  getImage: (images: any) => string | null;
}

const ProductCard = ({ p, index, onImport, onCompare, formatPrice, getImage }: ProductCardProps) => {
  const img = getImage(p.images);
  const [favorited, setFavorited] = useState(index === 2);
  const [imageFailed, setImageFailed] = useState(false);
  const outOfStock = !p.stock_quantity || p.stock_quantity <= 0;
  const estimatedProfit = Math.max(0, Number(p.suggested_price ?? 0) - Number(p.cost_price ?? 0));
  const marginPercent = Number(p.margin_percent ?? 0) || (Number(p.cost_price) > 0 ? (estimatedProfit / Number(p.cost_price)) * 100 : 0);
  const categoryLabel = p.category
    ? p.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : "Catálogo";
  const primaryPrice = Number(p.suggested_price ?? 0) > 0 ? Number(p.suggested_price) : Number(p.cost_price ?? 0);
  const badge = outOfStock ? "Sem estoque" : marginPercent >= 35 ? "Especial" : marginPercent >= 20 ? "Alta margem" : null;

  useEffect(() => {
    setImageFailed(false);
  }, [img]);

  return (
    <article className="catalog-product-card group">
      <div className="catalog-product-media">
        {badge && (
          <span className={`catalog-product-badge ${outOfStock ? "is-danger" : ""}`}>
            {badge}
          </span>
        )}

        <button
          type="button"
          className={`catalog-heart-button ${favorited ? "is-active" : ""}`}
          onClick={() => setFavorited((value) => !value)}
          aria-label={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart size={22} strokeWidth={1.9} fill={favorited ? "currentColor" : "none"} />
        </button>

        {img && !imageFailed ? (
          <img
            src={img}
            alt={p.title}
            className="catalog-product-image"
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="catalog-image-fallback">
            <Package size={44} strokeWidth={1.35} />
          </div>
        )}
      </div>

      <div className="catalog-product-body">
        <h3 className="catalog-product-title">
          {p.title}
        </h3>
        <p className="catalog-product-category">{categoryLabel}</p>

        <div className="catalog-product-footer">
          <div className="catalog-price-block">
            <strong>{formatPrice(primaryPrice)}</strong>
            {Number(p.cost_price ?? 0) > 0 && Number(p.cost_price) < primaryPrice && (
              <span>{formatPrice(Number(p.cost_price))}</span>
            )}
          </div>
          <div className="catalog-profit-chip">
            Lucro {formatPrice(estimatedProfit)}
          </div>
        </div>

        <div className={`catalog-product-actions ${index === 2 ? "is-visible" : ""}`}>
          <button
            onClick={onImport}
            disabled={outOfStock}
            className="catalog-buy-button"
          >
            {outOfStock ? "Indisponível" : `Importar ${formatPrice(primaryPrice)}`}
          </button>
          <button
            onClick={onCompare}
            className="catalog-cart-button"
            title="Ver fornecedores"
          >
            <ShoppingBag size={18} strokeWidth={1.9} />
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
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [sortOrder, setSortOrder] = useState("popular");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [compareProductId, setCompareProductId] = useState<string | null>(null);
  const [compareProductTitle, setCompareProductTitle] = useState("");
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const paymentDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const planLimits = usePlanLimits();
  const limit = 12;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node))
        setDateDropdownOpen(false);
      if (paymentDropdownRef.current && !paymentDropdownRef.current.contains(e.target as Node))
        setPaymentDropdownOpen(false);
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node))
        setCategoryDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
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
        const res = await fetch(url, { headers: { Authorization: `Bearer ${anonKey}` }, signal: timeout.signal });
        if (!res.ok) throw new Error("Failed to fetch catalog");
        return res.json();
      } finally {
        timeout.clear();
      }
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("cj-sync-request");
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const count = data.synced ?? 0;
      toast.success(
        count > 0
          ? `${count} produtos sincronizados com sucesso!`
          : "Sincronização concluída (nenhum produto novo encontrado)."
      );
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      queryClient.refetchQueries({ queryKey: ["catalog"] });
    },
    onError: (err: Error) => toast.error(`Erro ao sincronizar: ${err.message}`),
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

    const filtered = rawProducts.filter((p: any) => {
      const haystack = [
        p.title,
        p.category,
        p.source,
        p.supplier_name,
        p.external_id,
      ].filter(Boolean).join(" ").toLowerCase();

      if (normalizedSearch && !haystack.includes(normalizedSearch)) return false;

      const productPrice = Number(p.suggested_price ?? p.cost_price ?? 0);
      if (productPrice < minPrice || productPrice > maxPrice) return false;

      if (dateFilter !== "todos") {
        const rawDate = p.created_at || p.updated_at;
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
        const hasPrice = Number(p.cost_price) > 0 && Number(p.suggested_price) > 0;
        const hasPositiveMargin = Number(p.margin_percent) > 0 || Number(p.suggested_price) > Number(p.cost_price);
        const outOfStock = !p.stock_quantity || p.stock_quantity <= 0;

        if (paymentStatus === "priced" && !hasPrice) return false;
        if (paymentStatus === "missing_price" && hasPrice) return false;
        if (paymentStatus === "positive_margin" && !hasPositiveMargin) return false;
        if (paymentStatus === "out_of_stock" && !outOfStock) return false;
      }

      if (hideUnavailable && ((!p.stock_quantity || p.stock_quantity <= 0) || p.is_active === false)) return false;

      return true;
    });

    return [...filtered].sort((a: any, b: any) => {
      const priceA = Number(a.suggested_price ?? a.cost_price ?? 0);
      const priceB = Number(b.suggested_price ?? b.cost_price ?? 0);
      const profitA = Math.max(0, Number(a.suggested_price ?? 0) - Number(a.cost_price ?? 0));
      const profitB = Math.max(0, Number(b.suggested_price ?? 0) - Number(b.cost_price ?? 0));

      if (sortOrder === "price_asc") return priceA - priceB;
      if (sortOrder === "price_desc") return priceB - priceA;
      if (sortOrder === "profit_desc") return profitB - profitA;
      if (sortOrder === "newest") {
        return new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime();
      }

      const stockA = Number(a.stock_quantity ?? 0) > 0 ? 1 : 0;
      const stockB = Number(b.stock_quantity ?? 0) > 0 ? 1 : 0;
      const marginA = Number(a.margin_percent ?? 0) || (Number(a.cost_price) > 0 ? (profitA / Number(a.cost_price)) * 100 : 0);
      const marginB = Number(b.margin_percent ?? 0) || (Number(b.cost_price) > 0 ? (profitB / Number(b.cost_price)) * 100 : 0);
      return (stockB - stockA) || (marginB - marginA) || (profitB - profitA);
    });
  }, [rawProducts, search, dateFilter, paymentStatus, hideUnavailable, priceMin, priceMax, sortOrder]);

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const getImage = (images: any): string | null => {
    try {
      const arr = typeof images === "string" ? JSON.parse(images) : images;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    } catch { return null; }
  };

  const activeCategoryLabel = CATEGORIES.find(c => c.key === category)?.label ?? "Todos";
  const activeDateLabel = DATE_FILTERS.find((filter) => filter.key === dateFilter)?.label ?? "Todas as datas";
  const activePaymentLabel = PAYMENT_STATUS_FILTERS.find((filter) => filter.key === paymentStatus)?.label ?? "Status de pagamento";

  return (
    <div className="catalog-page-shell">
      <div className="catalog-board">
        <header className="catalog-board-header">
          <div>
            <div className="catalog-breadcrumb">
              <span>Main</span>
              <span>/</span>
              <strong>Catálogo</strong>
            </div>
            <div className="catalog-title-row">
              <h1>Catálogo</h1>
              <button
                type="button"
                className="catalog-filter-count"
                onClick={() => setCategoryDropdownOpen((value) => !value)}
                aria-label="Filtros ativos"
              >
                <SlidersHorizontal size={19} strokeWidth={1.8} />
                <span>
                  {[
                    category !== "todos",
                    dateFilter !== "todos",
                    paymentStatus !== "todos",
                    hideUnavailable,
                    Boolean(priceMin || priceMax),
                  ].filter(Boolean).length || 0}
                </span>
              </button>
            </div>
          </div>

          <div className="catalog-header-actions">
            <button type="button" className="catalog-view-button" aria-label="Lista">
              <List size={20} strokeWidth={1.8} />
            </button>
            <button type="button" className="catalog-view-button is-active" aria-label="Grade">
              <Grid2X2 size={20} strokeWidth={1.8} />
            </button>
            <label className="catalog-sort-select">
              <select
                value={sortOrder}
                onChange={(event) => {
                  setSortOrder(event.target.value);
                  setPage(1);
                }}
              >
                <option value="popular">Popular First</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
                <option value="newest">Mais recentes</option>
              </select>
              <ChevronDown size={17} strokeWidth={1.8} />
            </label>
            <button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="catalog-utility-button"
            >
              <RefreshCw size={16} strokeWidth={1.8} className={syncMutation.isPending ? "animate-spin" : ""} />
              {syncMutation.isPending ? "Sincronizando" : "Sincronizar"}
            </button>
            <button
              type="button"
              onClick={() => setIsIntegrationModalOpen(true)}
              className="catalog-utility-button"
            >
              <Plug size={16} strokeWidth={1.8} />
              Integrações
            </button>
          </div>
        </header>

        <div className="catalog-content-layout">
          <aside className="catalog-filter-panel">
            <div className="catalog-filter-search">
              <Search size={18} strokeWidth={1.8} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar produto"
              />
            </div>

            <section className="catalog-filter-section" ref={categoryDropdownRef}>
              <button
                type="button"
                className="catalog-section-title"
                onClick={() => setCategoryDropdownOpen((value) => !value)}
              >
                <span>Category</span>
                <ChevronDown size={16} strokeWidth={1.9} className={categoryDropdownOpen ? "is-open" : ""} />
              </button>
              <div className="catalog-checkbox-list">
                {CATEGORIES.map((item) => {
                  const active = category === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className="catalog-checkbox-row"
                      onClick={() => {
                        setCategory(item.key);
                        setPage(1);
                      }}
                    >
                      <span className={`catalog-checkbox-box ${active ? "is-active" : ""}`}>
                        {active && <Check size={13} strokeWidth={2.8} />}
                      </span>
                      <span>{item.key === "todos" ? "All" : item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="catalog-filter-section">
              <div className="catalog-section-title">
                <span>Price Range</span>
                <ChevronDown size={16} strokeWidth={1.9} />
              </div>
              <div className="catalog-price-inputs">
                <input
                  value={priceMin}
                  onChange={(event) => {
                    setPriceMin(event.target.value);
                    setPage(1);
                  }}
                  placeholder="R$ 5"
                  inputMode="decimal"
                />
                <span>-</span>
                <input
                  value={priceMax}
                  onChange={(event) => {
                    setPriceMax(event.target.value);
                    setPage(1);
                  }}
                  placeholder="R$ 1 000"
                  inputMode="decimal"
                />
              </div>
              <div className="catalog-range-line">
                <span />
                <span />
              </div>
            </section>

            <section className="catalog-filter-section" ref={dateDropdownRef}>
              <button
                type="button"
                className="catalog-section-title"
                onClick={() => setDateDropdownOpen((value) => !value)}
              >
                <span>Data</span>
                <small>{activeDateLabel}</small>
                <ChevronDown size={16} strokeWidth={1.9} className={dateDropdownOpen ? "is-open" : ""} />
              </button>
              {dateDropdownOpen && (
                <div className="catalog-option-stack">
                  {DATE_FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      className={dateFilter === filter.key ? "is-active" : ""}
                      onClick={() => {
                        setDateFilter(filter.key);
                        setPage(1);
                        setDateDropdownOpen(false);
                      }}
                    >
                      {filter.label}
                      {dateFilter === filter.key && <Check size={13} strokeWidth={2.6} />}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="catalog-filter-section" ref={paymentDropdownRef}>
              <button
                type="button"
                className="catalog-section-title"
                onClick={() => setPaymentDropdownOpen((value) => !value)}
              >
                <span>Status</span>
                <small>{activePaymentLabel}</small>
                <ChevronDown size={16} strokeWidth={1.9} className={paymentDropdownOpen ? "is-open" : ""} />
              </button>
              {paymentDropdownOpen && (
                <div className="catalog-option-stack">
                  {PAYMENT_STATUS_FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      className={paymentStatus === filter.key ? "is-active" : ""}
                      onClick={() => {
                        setPaymentStatus(filter.key);
                        setPage(1);
                        setPaymentDropdownOpen(false);
                      }}
                    >
                      {filter.label}
                      {paymentStatus === filter.key && <Check size={13} strokeWidth={2.6} />}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="catalog-filter-section">
              <div className="catalog-section-title">
                <span>Brand</span>
                <ChevronRight size={16} strokeWidth={1.9} />
              </div>
            </section>

            <section className="catalog-filter-section">
              <div className="catalog-section-title">
                <span>Color</span>
                <ChevronDown size={16} strokeWidth={1.9} />
              </div>
              <div className="catalog-checkbox-list">
                {["All", "White", "Blue", "Black", "Silver"].map((color) => {
                  const active = color === "Blue";
                  return (
                    <button key={color} type="button" className="catalog-checkbox-row">
                      <span className={`catalog-checkbox-box ${active ? "is-active" : ""}`}>
                        {active && <Check size={13} strokeWidth={2.8} />}
                      </span>
                      <span>{color}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="catalog-stock-row">
              <button
                type="button"
                className={`catalog-stock-toggle ${hideUnavailable ? "is-active" : ""}`}
                onClick={() => {
                  setHideUnavailable((value) => !value);
                  setPage(1);
                }}
                aria-pressed={hideUnavailable}
              >
                <span />
              </button>
              <span>Only in Stock</span>
            </div>

            <div className="catalog-filter-footer">
              <button type="button" className="catalog-count-button">
                {products.length} items
              </button>
              <button
                type="button"
                className="catalog-clear-button"
                onClick={() => {
                  setSearch("");
                  setCategory("todos");
                  setDateFilter("todos");
                  setPaymentStatus("todos");
                  setHideUnavailable(false);
                  setPriceMin("");
                  setPriceMax("");
                  setPage(1);
                }}
              >
                Clear
              </button>
            </div>
          </aside>

          <main className="catalog-results-area">
            {isLoading ? (
              <div className="catalog-products-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="catalog-skeleton-card">
                    <Skeleton className="h-[220px] w-full rounded-[18px]" />
                    <Skeleton className="h-5 w-4/5 rounded-md" />
                    <Skeleton className="h-4 w-2/5 rounded-md" />
                    <Skeleton className="h-5 w-1/3 rounded-md" />
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="catalog-empty-state">
                <Package size={46} strokeWidth={1.5} />
                <strong>Nao foi possivel carregar o catalogo</strong>
                <span>Verifique a conexao com o Supabase e tente novamente.</span>
                <button type="button" onClick={() => void refetch()}>
                  Tentar novamente
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="catalog-empty-state">
                <Package size={46} strokeWidth={1.5} />
                <strong>Nenhum produto encontrado</strong>
                <span>Clique em "Sincronizar" para popular o catálogo com produtos da CJ Dropshipping.</span>
              </div>
            ) : (
              <>
                <div className="catalog-products-grid">
                  {products.map((p: any, index: number) => (
                    <ProductCard
                      key={p.id}
                      p={p}
                      index={index}
                      onImport={() => { setSelectedProduct(p); setIsImportModalOpen(true); }}
                      onCompare={() => { setCompareProductId(p.id); setCompareProductTitle(p.title); }}
                      formatPrice={formatPrice}
                      getImage={getImage}
                    />
                  ))}
                </div>

                <div className="catalog-show-more-row">
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  >
                    {page >= totalPages ? "Fim do catálogo" : "Show More"}
                  </button>
                  {totalPages > 1 && (
                    <div className="catalog-page-stepper">
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page <= 1}
                        aria-label="Página anterior"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <span>{page} / {totalPages}</span>
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={page >= totalPages}
                        aria-label="Próxima página"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
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
          min-height: 100vh;
          background: #eaf0ff;
          padding: 56px 28px 80px;
          color: #0f172a;
          font-family: "Inter", "Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .catalog-board {
          width: min(100%, 1450px);
          margin: 0 auto;
          background: #ffffff;
          padding: 54px 64px 62px;
          border: 1px solid rgba(219, 228, 245, 0.72);
          box-shadow: 0 24px 70px rgba(90, 111, 155, 0.08);
        }

        .catalog-board-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 32px;
          margin-bottom: 36px;
        }

        .catalog-breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 18px;
          color: #73819a;
          font-size: 14px;
          line-height: 1;
        }

        .catalog-breadcrumb strong {
          color: #111827;
          font-weight: 500;
        }

        .catalog-title-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .catalog-title-row h1 {
          margin: 0;
          color: #050505;
          font-size: 32px;
          line-height: 1;
          letter-spacing: -0.035em;
          font-weight: 700;
        }

        .catalog-filter-count {
          position: relative;
          width: 34px;
          height: 34px;
          border: 0;
          background: transparent;
          color: #63748f;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .catalog-filter-count span {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 20px;
          height: 20px;
          border-radius: 999px;
          background: #0b6fe8;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 8px rgba(11, 111, 232, 0.3);
        }

        .catalog-header-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 26px;
          flex-wrap: wrap;
        }

        .catalog-view-button {
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #6d7f98;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: 0.18s ease;
        }

        .catalog-view-button.is-active,
        .catalog-view-button:hover {
          color: #0b6fe8;
          background: #f3f7ff;
        }

        .catalog-sort-select {
          height: 48px;
          min-width: 150px;
          border: 1px solid #d9e5f4;
          border-radius: 8px;
          background: #ffffff;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px 0 16px;
          font-size: 15px;
          font-weight: 500;
          box-shadow: 0 8px 24px rgba(90, 111, 155, 0.04);
        }

        .catalog-sort-select select {
          appearance: none;
          border: 0;
          outline: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          min-width: 0;
          cursor: pointer;
        }

        .catalog-utility-button {
          height: 44px;
          border: 1px solid #d9e5f4;
          border-radius: 8px;
          background: #ffffff;
          color: #3f4c61;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 14px;
          font-size: 14px;
          font-weight: 600;
          transition: 0.18s ease;
        }

        .catalog-utility-button:hover:not(:disabled) {
          border-color: #0b6fe8;
          color: #0b6fe8;
        }

        .catalog-utility-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .catalog-content-layout {
          display: grid;
          grid-template-columns: 270px minmax(0, 1fr);
          gap: 38px;
          align-items: start;
        }

        .catalog-filter-panel {
          background: #ffffff;
          color: #050505;
        }

        .catalog-filter-search {
          position: relative;
          margin-bottom: 28px;
        }

        .catalog-filter-search svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #90a0b7;
        }

        .catalog-filter-search input {
          width: 100%;
          height: 46px;
          border: 1px solid #dce7f5;
          border-radius: 7px;
          background: #ffffff;
          color: #0f172a;
          outline: 0;
          padding: 0 14px 0 42px;
          font-size: 14px;
        }

        .catalog-filter-search input::placeholder {
          color: #8b9ab0;
        }

        .catalog-filter-section {
          padding: 0 0 26px;
          margin-bottom: 26px;
          border-bottom: 1px solid #dce7f5;
        }

        .catalog-filter-section:last-of-type {
          margin-bottom: 20px;
        }

        .catalog-section-title {
          width: 100%;
          border: 0;
          background: transparent;
          padding: 0;
          margin: 0 0 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #050505;
          font-size: 17px;
          font-weight: 700;
          line-height: 1.2;
          text-align: left;
        }

        .catalog-section-title small {
          margin-left: auto;
          max-width: 108px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #738197;
          font-size: 12px;
          font-weight: 500;
        }

        .catalog-section-title svg {
          color: #60708a;
          flex: 0 0 auto;
          transition: transform 0.16s ease;
        }

        .catalog-section-title svg.is-open {
          transform: rotate(180deg);
        }

        .catalog-checkbox-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .catalog-checkbox-row {
          min-height: 25px;
          width: 100%;
          border: 0;
          background: transparent;
          color: #050505;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 0;
          font-size: 15px;
          line-height: 1.2;
          text-align: left;
          cursor: pointer;
        }

        .catalog-checkbox-box {
          width: 18px;
          height: 18px;
          border: 1px solid #cfe0f2;
          border-radius: 4px;
          background: #ffffff;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          transition: 0.16s ease;
        }

        .catalog-checkbox-box.is-active {
          background: #0b6fe8;
          border-color: #0b6fe8;
          box-shadow: 0 3px 8px rgba(11, 111, 232, 0.22);
        }

        .catalog-price-inputs {
          display: grid;
          grid-template-columns: 1fr 20px 1fr;
          align-items: center;
          gap: 12px;
          margin-bottom: 22px;
          color: #a1aec0;
        }

        .catalog-price-inputs input {
          height: 50px;
          width: 100%;
          border: 1px solid #d9e5f4;
          border-radius: 7px;
          background: #ffffff;
          color: #60708a;
          outline: 0;
          padding: 0 14px;
          font-size: 15px;
        }

        .catalog-price-inputs input::placeholder {
          color: #60708a;
        }

        .catalog-range-line {
          height: 2px;
          background: #cfe0f2;
          position: relative;
          margin: 14px 3px 0;
        }

        .catalog-range-line::before {
          content: "";
          position: absolute;
          left: 3%;
          right: 48%;
          top: 0;
          height: 2px;
          background: #0b6fe8;
        }

        .catalog-range-line span {
          position: absolute;
          top: 50%;
          width: 18px;
          height: 18px;
          border: 2px solid #0b6fe8;
          border-radius: 999px;
          background: #ffffff;
          transform: translate(-50%, -50%);
          box-shadow: 0 2px 6px rgba(11, 111, 232, 0.2);
        }

        .catalog-range-line span:first-child {
          left: 3%;
        }

        .catalog-range-line span:last-child {
          left: 50%;
        }

        .catalog-option-stack {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: -6px;
        }

        .catalog-option-stack button {
          width: 100%;
          border: 0;
          border-radius: 8px;
          background: #f8faff;
          color: #3f4c61;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 9px 10px;
          font-size: 13px;
          font-weight: 500;
          text-align: left;
        }

        .catalog-option-stack button.is-active {
          color: #0b6fe8;
          background: #edf5ff;
        }

        .catalog-stock-row {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          margin-top: 2px;
          color: #050505;
          font-size: 15px;
        }

        .catalog-stock-toggle {
          width: 38px;
          height: 20px;
          border: 0;
          border-radius: 999px;
          background: #d8e3f3;
          position: relative;
          transition: 0.16s ease;
        }

        .catalog-stock-toggle span {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.16);
          transition: 0.16s ease;
        }

        .catalog-stock-toggle.is-active {
          background: #0b6fe8;
        }

        .catalog-stock-toggle.is-active span {
          transform: translateX(18px);
        }

        .catalog-filter-footer {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 112px;
          gap: 12px;
          margin-top: 20px;
        }

        .catalog-filter-footer button {
          height: 50px;
          border-radius: 7px;
          font-size: 15px;
          font-weight: 600;
        }

        .catalog-count-button {
          border: 0;
          background: #0b6fe8;
          color: #ffffff;
          box-shadow: 0 12px 24px rgba(11, 111, 232, 0.18);
        }

        .catalog-clear-button {
          border: 1px solid #d9e5f4;
          background: #ffffff;
          color: #111827;
        }

        .catalog-results-area {
          min-width: 0;
        }

        .catalog-products-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px;
          align-items: stretch;
        }

        .catalog-skeleton-card {
          min-height: 394px;
          border: 1px solid rgba(232, 238, 249, 0.8);
          border-radius: 4px;
          background: #f8faff;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .catalog-empty-state {
          min-height: 320px;
          border: 1px dashed #cfe0f2;
          border-radius: 8px;
          background: #fbfdff;
          color: #66758c;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          text-align: center;
          padding: 28px;
        }

        .catalog-empty-state strong {
          color: #111827;
          font-size: 20px;
        }

        .catalog-empty-state button {
          height: 42px;
          border: 1px solid #0b6fe8;
          background: #ffffff;
          color: #0b6fe8;
          border-radius: 6px;
          padding: 0 16px;
          font-weight: 600;
        }

        .catalog-product-card {
          min-height: 394px;
          background: #f8faff;
          border: 1px solid rgba(232, 238, 249, 0.8);
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          content-visibility: auto;
          contain-intrinsic-size: 430px;
        }

        .catalog-product-card:hover {
          transform: translateY(-2px);
          border-color: #dbe8f8;
          box-shadow: 0 18px 35px rgba(83, 105, 145, 0.09);
        }

        .catalog-product-media {
          position: relative;
          height: 240px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px 28px 12px;
        }

        .catalog-product-badge {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 2;
          min-height: 26px;
          padding: 3px 10px;
          border-radius: 6px;
          background: #df2f72;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          font-size: 16px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .catalog-product-badge.is-danger {
          background: #64748b;
        }

        .catalog-heart-button {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 2;
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: #637891;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: 0.16s ease;
        }

        .catalog-heart-button:hover,
        .catalog-heart-button.is-active {
          color: #df2f72;
        }

        .catalog-product-image {
          max-width: 88%;
          max-height: 190px;
          width: auto;
          height: auto;
          object-fit: contain;
          transition: transform 0.28s ease;
          filter: drop-shadow(0 18px 18px rgba(52, 78, 112, 0.08));
        }

        .catalog-product-card:hover .catalog-product-image {
          transform: scale(1.035);
        }

        .catalog-image-fallback {
          width: 160px;
          height: 160px;
          border-radius: 18px;
          background: #eef4fb;
          color: #96a7be;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .catalog-product-body {
          display: flex;
          flex-direction: column;
          flex: 1;
          padding: 18px 34px 28px;
        }

        .catalog-product-title {
          margin: 0;
          color: #050505;
          font-size: 17px;
          font-weight: 600;
          line-height: 1.25;
          letter-spacing: -0.02em;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .catalog-product-category {
          margin: 10px 0 0;
          color: #6e7d93;
          font-size: 15px;
          line-height: 1.2;
        }

        .catalog-product-footer {
          margin-top: 14px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 10px;
          min-height: 25px;
        }

        .catalog-price-block {
          display: flex;
          align-items: baseline;
          gap: 10px;
          min-width: 0;
        }

        .catalog-price-block strong {
          color: #050505;
          font-size: 18px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.01em;
          white-space: nowrap;
        }

        .catalog-price-block span {
          color: #738197;
          font-size: 16px;
          text-decoration: line-through;
          white-space: nowrap;
        }

        .catalog-profit-chip {
          display: none;
        }

        .catalog-product-actions {
          margin-top: 16px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 46px;
          gap: 12px;
          opacity: 0;
          transform: translateY(8px);
          pointer-events: none;
          transition: opacity 0.18s ease, transform 0.18s ease;
        }

        .catalog-product-card:hover .catalog-product-actions,
        .catalog-product-actions.is-visible {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }

        .catalog-buy-button {
          height: 46px;
          border: 0;
          border-radius: 6px;
          background: #0b6fe8;
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          transition: 0.16s ease;
        }

        .catalog-buy-button:hover:not(:disabled) {
          background: #075dcc;
        }

        .catalog-buy-button:disabled {
          background: #cbd5e1;
          cursor: not-allowed;
        }

        .catalog-cart-button {
          height: 46px;
          border: 1px solid #0b6fe8;
          border-radius: 6px;
          background: #ffffff;
          color: #0b6fe8;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: 0.16s ease;
        }

        .catalog-cart-button:hover {
          background: #eff6ff;
        }

        .catalog-show-more-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          margin-top: 38px;
          flex-wrap: wrap;
        }

        .catalog-show-more-row > button {
          min-width: 178px;
          height: 48px;
          border: 1px solid #0b6fe8;
          background: #ffffff;
          color: #0b6fe8;
          border-radius: 6px;
          font-size: 15px;
          font-weight: 600;
          transition: 0.16s ease;
        }

        .catalog-show-more-row > button:hover:not(:disabled) {
          background: #0b6fe8;
          color: #ffffff;
        }

        .catalog-show-more-row > button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .catalog-page-stepper {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #60708a;
          font-size: 13px;
        }

        .catalog-page-stepper button {
          width: 34px;
          height: 34px;
          border: 1px solid #d9e5f4;
          background: #ffffff;
          color: #0b6fe8;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .catalog-page-stepper button:disabled {
          opacity: 0.45;
          color: #94a3b8;
        }

        @media (max-width: 1400px) {
          .catalog-board {
            padding: 44px 42px;
          }

          .catalog-content-layout {
            grid-template-columns: 250px minmax(0, 1fr);
            gap: 30px;
          }

          .catalog-product-body {
            padding-left: 26px;
            padding-right: 26px;
          }
        }

        @media (max-width: 1180px) {
          .catalog-board-header {
            flex-direction: column;
          }

          .catalog-header-actions {
            padding-top: 0;
            justify-content: flex-start;
          }

          .catalog-content-layout {
            grid-template-columns: 1fr;
          }

          .catalog-filter-panel {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px 24px;
          }

          .catalog-filter-section {
            margin-bottom: 0;
          }

          .catalog-filter-search,
          .catalog-filter-footer,
          .catalog-stock-row {
            grid-column: 1 / -1;
          }

          .catalog-products-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .catalog-page-shell {
            padding: 18px 12px 44px;
          }

          .catalog-board {
            padding: 28px 18px;
          }

          .catalog-title-row h1 {
            font-size: 28px;
          }

          .catalog-filter-panel {
            display: block;
          }

          .catalog-products-grid {
            grid-template-columns: 1fr;
          }

          .catalog-header-actions {
            gap: 8px;
          }

          .catalog-utility-button span {
            display: none;
          }

          .catalog-sort-select {
            min-width: 142px;
          }
        }
      `}</style>
    </div>
  );
};

export default CatalogPage;
