import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Filter, Heart, History, LayoutTemplate, Monitor, MoreHorizontal, Package, Palette, Play, Search, Settings, ShoppingCart, SlidersHorizontal, Smartphone, Trash2, Type, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import StorefrontNavbar from "@/components/storefront/StorefrontNavbar";

type StoreProduct = {
  id: string;
  title: string;
  category: string;
  collectionName: string;
  brand: string | null;
  model: string | null;
  imageUrl: string;
  price: number;
  originalPrice: number | null;
  createdAt: string | null;
  addedAt: string | null;
};

type StoreCatalogRow = {
  added_at: string | null;
  collections:
    | {
        id: string;
        name: string | null;
        category: string | null;
      }
    | Array<{
        id: string;
        name: string | null;
        category: string | null;
      }>
    | null;
  catalog_products:
    | {
        id: string;
        title: string | null;
        category: string | null;
        images: Json | null;
        brand: string | null;
        model: string | null;
        cost_price: number | null;
        suggested_price: number | null;
        original_price: number | null;
        created_at: string | null;
      }
    | Array<{
        id: string;
        title: string | null;
        category: string | null;
        images: Json | null;
        brand: string | null;
        model: string | null;
        cost_price: number | null;
        suggested_price: number | null;
        original_price: number | null;
        created_at: string | null;
      }>
    | null;
};

type SortOption = "relevance" | "price-asc" | "price-desc" | "newest";
type FilterGroupKey = "brand" | "model" | "stock" | "price";
type FilterOption = {
  value: string;
  count?: number;
  indicator?: string;
  previewChecked?: boolean;
};
type CatalogEditorShellProps = {
  storeName: string;
  children: ReactNode;
};

const PAGE_SIZE = 12;
// TODO: placeholder — substituir por dados reais quando o vendedor cadastrar marca/modelo.
const MOCK_FILTER_GROUPS = {
  brands: [
    { value: "Marca A" },
    { value: "Marca B" },
    { value: "Marca C" },
    { value: "Marca D", previewChecked: true },
    { value: "Marca E" },
  ],
  models: [
    { value: "Clássico", indicator: "CL" },
    { value: "Compacto", indicator: "CP" },
    { value: "Premium", indicator: "PR" },
    { value: "Multifunção", indicator: "MF", previewChecked: true },
    { value: "Essencial", indicator: "ES" },
  ],
  stock: [
    { value: "Disponível" },
    { value: "Últimas unidades" },
    { value: "Reposição rápida" },
  ],
} satisfies Record<string, FilterOption[]>;

const getFirstImage = (images: Json | null): string => {
  if (!images) return "";
  if (Array.isArray(images)) {
    return images.find((image): image is string => typeof image === "string" && image.trim().length > 0) ?? "";
  }
  if (typeof images === "string") {
    try {
      return getFirstImage(JSON.parse(images) as Json);
    } catch {
      return images;
    }
  }
  return "";
};

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const isRecent = (date: string | null) => {
  if (!date) return false;
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= 1000 * 60 * 60 * 24 * 30;
};

const parsePositiveNumber = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const normalizeSort = (value: string | null): SortOption => {
  if (value === "price-asc" || value === "price-desc" || value === "newest") return value;
  return "relevance";
};

const parseListParam = (value: string | null) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatFilterLabel = (values: string[], max = 2) => {
  if (values.length <= max) return values.join(", ");
  return `${values.slice(0, max).join(", ")} +${values.length - max}`;
};

const getFacetOptions = (products: StoreProduct[], key: "brand" | "model") =>
  Array.from(
    products.reduce((map, product) => {
      const value = product[key]?.trim();
      if (!value) return map;
      map.set(value, (map.get(value) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "pt-BR"))
    .slice(0, 8);

const FilterGroup = ({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => (
  <section className="border-b border-border/80 pb-3 last:border-b-0">
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between py-1 text-left text-[12px] font-semibold text-foreground">
      {title}
      <ChevronDown size={13} className={`text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
    </button>
    {open ? <div className="mt-2">{children}</div> : null}
  </section>
);

const CatalogEditorShell = ({ storeName, children }: CatalogEditorShellProps) => {
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#050505] text-white">
      <header className="flex h-[72px] shrink-0 items-center justify-between px-5">
        <div className="flex min-w-0 items-center gap-4">
          <button type="button" onClick={() => navigate("/minha-loja/editor")} className="shrink-0 text-white/55 transition hover:text-white" aria-label="Voltar para a loja">
            <ChevronLeft />
          </button>
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition ${panelOpen ? "bg-white/15 text-white" : "bg-white/[0.07] text-white/60 hover:text-white"}`}
            aria-label="Personalizar loja"
          >
            <MoreHorizontal size={18} />
          </button>
          <div className="min-w-0">
            <strong className="block truncate text-[14px]">{storeName}</strong>
            <span className="block truncate text-[10px] text-white/30">Template 01 {"\u00b7"} Velo Modern</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden rounded-[9px] bg-white/[0.06] p-1 sm:flex">
            <button type="button" onClick={() => setMobilePreview(false)} className={`flex h-9 w-12 items-center justify-center rounded-[7px] ${!mobilePreview ? "bg-white/15" : "text-white/35"}`} aria-label="Preview desktop">
              <Monitor size={17} />
            </button>
            <button type="button" onClick={() => setMobilePreview(true)} className={`flex h-9 w-12 items-center justify-center rounded-[7px] ${mobilePreview ? "bg-white/15" : "text-white/35"}`} aria-label="Preview mobile">
              <Smartphone size={17} />
            </button>
          </div>
          <button type="button" onClick={() => setPanelOpen(true)} className="p-3 text-white/45 transition hover:text-white" aria-label="Configurações da loja">
            <Settings size={18} />
          </button>
          <button type="button" className="hidden p-3 text-white/45 transition hover:text-white sm:block" aria-label="Visualizar loja">
            <Play size={18} />
          </button>
          <button type="button" className="hidden p-3 text-white/45 transition hover:text-white sm:block" aria-label="Histórico">
            <History size={18} />
          </button>
          <div className="relative ml-1 pb-2">
            <button
              type="button"
              onClick={() => navigate("/checkout")}
              className="relative min-w-[112px] overflow-hidden rounded-[9px] bg-gradient-to-r from-[#3b82f6] via-[#2563eb] to-[#1d4ed8] px-5 pb-3 pt-2 text-[13px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_6px_18px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:brightness-110"
            >
              <span className="relative z-10">Publicar</span>
              <span className="absolute inset-x-0 top-0 h-px bg-white/45" />
            </button>
            <span className="absolute -bottom-0.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-b from-[#fde047] to-[#facc15] px-3 py-1 text-[8px] font-extrabold tracking-[0.02em] text-[#5b4300] shadow-[0_2px_7px_rgba(0,0,0,0.38)]">
              DOMÍNIO GRÁTIS
            </span>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {panelOpen ? (
          <aside className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-[#0b0b0b]">
            <div className="flex items-center justify-between px-5 pb-4 pt-5">
              <div>
                <strong className="block text-[14px]">Personalizar template</strong>
                <span className="text-[10.5px] text-white/40">Ajuste a cara da sua loja</span>
              </div>
              <button type="button" onClick={() => setPanelOpen(false)} className="text-white/40 transition hover:text-white" aria-label="Fechar personalização">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 px-5 pb-6">
              <button type="button" className="group flex w-full items-center gap-3 rounded-[13px] bg-white/[0.05] p-3 text-left transition hover:bg-white/[0.09]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] shadow-[0_6px_16px_rgba(37,99,235,0.35)]">
                  <LayoutTemplate size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">Trocar template</span>
                  <span className="block text-[11px] text-white/45">Atual: Velo Modern</span>
                </span>
                <ChevronLeft size={14} className="rotate-180 text-white/35" />
              </button>

              <button type="button" onClick={() => navigate("/dashboard/catalogo")} className="group flex w-full items-center gap-3 rounded-[13px] bg-white/[0.05] p-3 text-left transition hover:bg-white/[0.09]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#f97316] to-[#c2410c] shadow-[0_6px_16px_rgba(249,115,22,0.35)]">
                  <Package size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">Adicionar produtos</span>
                  <span className="block text-[11px] text-white/45">Escolha do catálogo Velo</span>
                </span>
              </button>
            </div>

            <div className="mx-5 border-t border-white/[0.06]" />

            <div className="space-y-6 px-5 py-6">
              <div>
                <div className="flex items-center gap-2">
                  <Palette size={13} className="text-white/55" />
                  <strong className="text-[12px]">Cor de destaque</strong>
                </div>
                <p className="mt-1 text-[10.5px] text-white/40">Usada em botões, preços e tags.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {["#111111", "#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#ec4899", "#7c3aed"].map((color) => (
                    <span key={color} className="h-8 w-8 rounded-full ring-1 ring-white/15" style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <Type size={13} className="text-white/55" />
                  <strong className="text-[12px]">Tipografia</strong>
                </div>
                <p className="mt-1 text-[10.5px] text-white/40">Fonte dos títulos e textos da loja.</p>
              </div>
            </div>
          </aside>
        ) : null}

        <div className="relative min-w-0 flex-1 overflow-auto rounded-tl-[18px] bg-[#111] p-3 sm:p-5">
          <div className={`relative mx-auto min-h-full overflow-hidden bg-white text-[#111] shadow-[0_30px_100px_rgba(0,0,0,0.5)] transition-all ${mobilePreview ? "max-w-[390px]" : "max-w-[1180px]"}`}>
            {children}
          </div>
        </div>
      </div>
    </main>
  );
};

const StoreProductCard = ({ product }: { product: StoreProduct }) => {
  const showOriginalPrice = typeof product.originalPrice === "number" && product.originalPrice > product.price;

  return (
    <article className="group overflow-hidden rounded-[12px] border border-border bg-card text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[1.06/1] overflow-hidden bg-muted">
        {isRecent(product.createdAt ?? product.addedAt) ? (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-[6px] bg-[hsl(var(--store-accent-soft))] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.02em] text-[hsl(var(--store-accent-color))] shadow-sm">
            Novo
          </span>
        ) : null}
        <button
          type="button"
          aria-label={`Favoritar ${product.title}`}
          className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-card/85 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground"
        >
          <Heart size={14} strokeWidth={1.7} />
        </button>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="h-full w-full object-contain p-4 transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-5 text-center text-[11px] text-muted-foreground">
            Produto sem imagem
          </div>
        )}
      </div>
      <div className="border-t border-border p-3">
        <p className="text-[10px] font-medium text-muted-foreground">{product.category}</p>
        <h3 className="mt-1 line-clamp-2 min-h-[34px] text-[13px] font-semibold leading-snug text-foreground">
          {product.title}
        </h3>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <span className="block text-[9px] text-muted-foreground">Preço:</span>
            {showOriginalPrice ? (
              <div className="flex items-baseline gap-1.5">
                <strong className="text-[14px] font-semibold text-foreground">{formatBRL(product.price)}</strong>
                <span className="text-[10px] text-muted-foreground line-through">{formatBRL(product.originalPrice ?? 0)}</span>
              </div>
            ) : (
              <strong className="block text-[14px] font-semibold text-foreground">{formatBRL(product.price)}</strong>
            )}
          </div>
          <button
            type="button"
            aria-label={`Comprar ${product.title}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[hsl(var(--store-accent-color))] text-[hsl(var(--store-accent-foreground))] transition hover:opacity-85"
          >
            <ShoppingCart size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </article>
  );
};

const StoreCatalogPage = () => {
  const { user, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [storeName, setStoreName] = useState("Velo");
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openFilterGroups, setOpenFilterGroups] = useState<Record<FilterGroupKey, boolean>>({
    brand: true,
    model: true,
    stock: false,
    price: false,
  });
  const [draftMin, setDraftMin] = useState(searchParams.get("min") ?? "");
  const [draftMax, setDraftMax] = useState(searchParams.get("max") ?? "");

  const activeCategory = searchParams.get("categoria") ?? "";
  const searchQuery = searchParams.get("busca") ?? "";
  const activeBrands = parseListParam(searchParams.get("marca"));
  const activeModels = parseListParam(searchParams.get("modelo"));
  const activeStockFilters = parseListParam(searchParams.get("estoque"));
  const sort = normalizeSort(searchParams.get("ordenar"));
  const minPrice = parsePositiveNumber(searchParams.get("min"));
  const maxPrice = parsePositiveNumber(searchParams.get("max"));
  const page = Math.max(1, Number(searchParams.get("pagina") ?? "1") || 1);

  useEffect(() => {
    setDraftMin(searchParams.get("min") ?? "");
    setDraftMax(searchParams.get("max") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (loading) return;

    let mounted = true;
    const loadCatalog = async () => {
      if (!user?.id) {
        setIsLoading(false);
        setError("Esta loja ainda não possui um catálogo público configurado.");
        return;
      }

      setIsLoading(true);
      setError(null);

      const [{ data: profile }, { data: rows, error: rowsError }] = await Promise.all([
        supabase.from("profiles").select("store_name,loja_nome").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("collection_products")
          .select(`
            added_at,
            collections!inner(id,name,category,user_id),
            catalog_products!inner(id,title,category,brand,model,images,cost_price,suggested_price,original_price,created_at,is_active,is_blocked,stock_quantity)
          `)
          .eq("collections.user_id", user.id)
          .eq("catalog_products.is_active", true)
          .eq("catalog_products.is_blocked", false)
          .gt("catalog_products.stock_quantity", 0)
          .order("added_at", { ascending: false })
          .limit(500),
      ]);

      if (!mounted) return;

      if (rowsError) {
        setError("Não foi possível carregar os produtos da loja.");
        setProducts([]);
        setIsLoading(false);
        return;
      }

      const savedName = profile?.store_name || profile?.loja_nome || sessionStorage.getItem("velo-store-name");
      if (savedName?.trim()) setStoreName(savedName.trim());

      const seen = new Set<string>();
      const mapped = ((rows ?? []) as StoreCatalogRow[]).flatMap((row) => {
        const product = Array.isArray(row.catalog_products) ? row.catalog_products[0] : row.catalog_products;
        const collection = Array.isArray(row.collections) ? row.collections[0] : row.collections;
        if (!product?.id || seen.has(product.id)) return [];
        seen.add(product.id);

        const category = collection?.category?.trim() || product.category?.trim() || collection?.name?.trim() || "Outros";
        const price = Number(product.suggested_price ?? product.cost_price ?? 0);

        return [
          {
            id: product.id,
            title: product.title?.trim() || "Produto sem nome",
            category,
            collectionName: collection?.name?.trim() || category,
            brand: product.brand,
            model: product.model,
            imageUrl: getFirstImage(product.images),
            price,
            originalPrice: product.original_price,
            createdAt: product.created_at,
            addedAt: row.added_at,
          },
        ];
      });

      setProducts(mapped);
      setIsLoading(false);
    };

    void loadCatalog();

    return () => {
      mounted = false;
    };
  }, [loading, user?.id]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [products],
  );
  const brandOptions = useMemo(() => getFacetOptions(products, "brand"), [products]);
  const modelOptions = useMemo(() => getFacetOptions(products, "model"), [products]);
  const displayedBrandOptions = brandOptions.length > 0 ? brandOptions : MOCK_FILTER_GROUPS.brands;
  const displayedModelOptions = modelOptions.length > 0 ? modelOptions : MOCK_FILTER_GROUPS.models;
  const usingMockBrandOptions = brandOptions.length === 0;
  const usingMockModelOptions = modelOptions.length === 0;

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (activeCategory && product.category !== activeCategory) return false;
      if (activeBrands.length > 0 && (!product.brand || !activeBrands.includes(product.brand))) return false;
      if (activeModels.length > 0 && (!product.model || !activeModels.includes(product.model))) return false;
      if (activeStockFilters.length > 0) return false;
      if (minPrice !== null && product.price < minPrice) return false;
      if (maxPrice !== null && product.price > maxPrice) return false;
      if (normalizedSearch) {
        const haystack = [product.title, product.category, product.collectionName, product.brand, product.model]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "newest") {
        const aTime = new Date(a.addedAt ?? a.createdAt ?? 0).getTime();
        const bTime = new Date(b.addedAt ?? b.createdAt ?? 0).getTime();
        return bTime - aTime;
      }
      return 0;
    });
  }, [activeBrands, activeCategory, activeModels, activeStockFilters, maxPrice, minPrice, products, searchQuery, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value.trim()) next.set(key, value);
      else next.delete(key);
    });
    if (!("pagina" in updates)) next.set("pagina", "1");
    setSearchParams(next);
  };

  const toggleListFilter = (key: "marca" | "modelo" | "estoque", value: string) => {
    const current = parseListParam(searchParams.get(key));
    const nextValues = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    updateParams({ [key]: nextValues.length > 0 ? nextValues.join(",") : null });
  };

  const toggleFilterGroup = (key: FilterGroupKey) => {
    setOpenFilterGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("categoria");
    next.delete("min");
    next.delete("max");
    next.delete("busca");
    next.delete("marca");
    next.delete("modelo");
    next.delete("estoque");
    next.delete("pagina");
    setSearchParams(next);
    setFiltersOpen(false);
  };

  const applyPriceFilters = () => {
    updateParams({ min: draftMin, max: draftMax });
    setFiltersOpen(false);
  };

  const activeFilters = [
    activeCategory ? { key: "categoria", label: `Categoria: ${activeCategory}` } : null,
    searchQuery.trim() ? { key: "busca", label: `Busca: ${searchQuery.trim()}` } : null,
    activeBrands.length > 0 ? { key: "marca", label: `Marca: ${formatFilterLabel(activeBrands)}` } : null,
    activeModels.length > 0 ? { key: "modelo", label: `Modelo: ${formatFilterLabel(activeModels)}` } : null,
    activeStockFilters.length > 0 ? { key: "estoque", label: `Estoque: ${formatFilterLabel(activeStockFilters)}` } : null,
    minPrice !== null ? { key: "min", label: `Mín.: ${formatBRL(minPrice)}` } : null,
    maxPrice !== null ? { key: "max", label: `Máx.: ${formatBRL(maxPrice)}` } : null,
  ].filter((filter): filter is { key: string; label: string } => Boolean(filter));

  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1).filter((number) => {
    if (pageCount <= 5) return true;
    return number === 1 || number === pageCount || Math.abs(number - currentPage) <= 1;
  });

  const filters = (
    <div className="space-y-5">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] font-bold text-foreground">Categorias</h2>
          {activeCategory ? (
            <button type="button" onClick={() => updateParams({ categoria: null })} className="text-[10px] font-medium text-muted-foreground hover:text-foreground">
              Limpar
            </button>
          ) : null}
        </div>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => updateParams({ categoria: null })}
            className={`flex w-full items-center justify-between text-left text-[11px] transition ${!activeCategory ? "font-bold text-[hsl(var(--store-accent-color))]" : "text-muted-foreground hover:text-foreground"}`}
          >
            Todas
            <span className="text-[10px] font-medium text-muted-foreground/70">{products.length}</span>
          </button>
          {categories.map((category) => {
            const count = products.filter((product) => product.category === category).length;
            return (
              <button
                key={category}
                type="button"
                onClick={() => {
                  updateParams({ categoria: category });
                  setFiltersOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 text-left text-[11px] transition ${activeCategory === category ? "font-bold text-[hsl(var(--store-accent-color))]" : "text-muted-foreground hover:text-foreground"}`}
              >
                <span className="truncate">{category}</span>
                <span className="text-[10px] font-medium text-muted-foreground/70">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="border-t border-border" />

      <section>
        <h2 className="text-[12px] font-bold text-foreground">Filtrar por:</h2>
        <div className="mt-3 space-y-3">
          <FilterGroup title="Marca" open={openFilterGroups.brand} onToggle={() => toggleFilterGroup("brand")}>
            <div className="space-y-2">
              {displayedBrandOptions.map((option) => {
                const previewChecked = usingMockBrandOptions && activeBrands.length === 0 && option.previewChecked;
                return (
                  <label key={option.value} className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={activeBrands.includes(option.value) || Boolean(previewChecked)}
                      onChange={() => toggleListFilter("marca", option.value)}
                      className="h-3 w-3 rounded-[2px] border-border text-[hsl(var(--store-accent-color))] accent-[hsl(var(--store-accent-color))]"
                    />
                    <span className="min-w-0 flex-1 truncate">{option.value}</span>
                    {option.count ? <span className="text-[10px] text-muted-foreground/60">{option.count}</span> : null}
                  </label>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup title="Modelo" open={openFilterGroups.model} onToggle={() => toggleFilterGroup("model")}>
            <div className="space-y-2">
              {displayedModelOptions.map((option) => {
                const previewChecked = usingMockModelOptions && activeModels.length === 0 && option.previewChecked;
                return (
                  <label key={option.value} className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={activeModels.includes(option.value) || Boolean(previewChecked)}
                      onChange={() => toggleListFilter("modelo", option.value)}
                      className="h-3 w-3 rounded-[2px] border-border text-[hsl(var(--store-accent-color))] accent-[hsl(var(--store-accent-color))]"
                    />
                    <span className="min-w-0 flex-1 truncate">{option.value}</span>
                    {option.indicator ? (
                      <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[8px] font-semibold text-muted-foreground/80">
                        {option.indicator}
                      </span>
                    ) : null}
                    {option.count ? <span className="text-[10px] text-muted-foreground/60">{option.count}</span> : null}
                  </label>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup title="Estoque" open={openFilterGroups.stock} onToggle={() => toggleFilterGroup("stock")}>
            <div className="space-y-2">
              {MOCK_FILTER_GROUPS.stock.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={activeStockFilters.includes(option.value)}
                    onChange={() => toggleListFilter("estoque", option.value)}
                    className="h-3 w-3 rounded-[2px] border-border text-[hsl(var(--store-accent-color))] accent-[hsl(var(--store-accent-color))]"
                  />
                  <span className="min-w-0 flex-1 truncate">{option.value}</span>
                </label>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup title="Preço" open={openFilterGroups.price} onToggle={() => toggleFilterGroup("price")}>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="sr-only">Preço mínimo</span>
                <input
                  value={draftMin}
                  onChange={(event) => setDraftMin(event.target.value)}
                  inputMode="decimal"
                  placeholder="Mín."
                  className="h-8 w-full rounded-[8px] border border-input bg-background px-2.5 text-[11px] text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-[hsl(var(--store-accent-color))]"
                />
              </label>
              <label className="block">
                <span className="sr-only">Preço máximo</span>
                <input
                  value={draftMax}
                  onChange={(event) => setDraftMax(event.target.value)}
                  inputMode="decimal"
                  placeholder="Máx."
                  className="h-8 w-full rounded-[8px] border border-input bg-background px-2.5 text-[11px] text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-[hsl(var(--store-accent-color))]"
                />
              </label>
            </div>
          </FilterGroup>
        </div>
      </section>

      <section className="flex gap-2 pt-1">
        <button type="button" onClick={applyPriceFilters} className="h-9 flex-1 rounded-[8px] bg-[hsl(var(--store-accent-color))] px-4 text-[12px] font-semibold text-[hsl(var(--store-accent-foreground))] transition hover:opacity-85">
          Aplicar
        </button>
        <button type="button" onClick={clearFilters} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Limpar filtros">
          <Trash2 size={14} />
        </button>
      </section>
    </div>
  );

  const catalogContent = (
    <>
      <StorefrontNavbar
        storeName={storeName}
        activePage="catalog"
        searchValue={searchQuery}
        onSearchChange={(value) => updateParams({ busca: value })}
        showNavigation={false}
      />

      <div className="mx-auto grid max-w-[1120px] lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border px-5 py-7 lg:block">
          <div className="sticky top-4">{filters}</div>
        </aside>

        <div className="min-w-0 px-5 py-7">
          <div className="mb-5 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Link to="/minha-loja/editor" className="hover:text-foreground">Loja</Link>
                <ChevronRight size={12} />
                {activeCategory ? (
                  <>
                    <Link to="/catalogo" className="hover:text-foreground">Catálogo</Link>
                    <ChevronRight size={12} />
                    <span className="text-foreground">{activeCategory}</span>
                  </>
                ) : (
                  <span className="text-foreground">Catálogo</span>
                )}
              </div>
              <h1 className="mt-4 text-[30px] font-semibold leading-none tracking-[-0.045em] md:text-[32px]">
                {activeCategory || "Catálogo completo"}
              </h1>
              <p className="mt-3 text-[13px] text-muted-foreground">
                {filteredProducts.length} produto{filteredProducts.length === 1 ? "" : "s"} encontrado{filteredProducts.length === 1 ? "" : "s"}.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[9px] border border-border px-3 text-[12px] font-semibold text-foreground lg:hidden">
                <SlidersHorizontal size={15} /> Filtros
              </button>
              <label className="flex h-10 w-full items-center gap-3 rounded-[10px] border border-border bg-card px-3 text-[12px] text-muted-foreground shadow-sm sm:w-[250px]">
                <Filter size={15} />
                <span className="sr-only">Ordenar produtos</span>
                <select
                  value={sort}
                  onChange={(event) => updateParams({ ordenar: event.target.value })}
                  className="h-full flex-1 bg-transparent text-[13px] text-foreground outline-none"
                >
                  <option value="relevance">Ordenar por relevância</option>
                  <option value="price-asc">Menor preço</option>
                  <option value="price-desc">Maior preço</option>
                  <option value="newest">Mais recentes</option>
                </select>
              </label>
            </div>
          </div>

          {activeFilters.length > 0 ? (
            <div className="mb-5 flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => updateParams({ [filter.key]: null })}
                  className="inline-flex items-center gap-1.5 rounded-[7px] bg-secondary px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                >
                  {filter.label}
                  <X size={11} />
                </button>
              ))}
              <button type="button" onClick={clearFilters} className="rounded-[7px] px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground">
                Limpar tudo
              </button>
            </div>
          ) : null}

          <section>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="h-[286px] animate-pulse rounded-[12px] bg-muted" />
                ))}
              </div>
            ) : error ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[14px] border border-border bg-card p-8 text-center">
                <Search className="text-muted-foreground" size={28} />
                <h2 className="mt-4 text-base font-semibold text-foreground">Catálogo indisponível</h2>
                <p className="mt-2 max-w-md text-[13px] text-muted-foreground">{error}</p>
              </div>
            ) : paginatedProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {paginatedProducts.map((product) => (
                    <StoreProductCard key={product.id} product={product} />
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => updateParams({ pagina: String(currentPage - 1) })}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[7px] px-2.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronLeft size={13} /> Anterior
                  </button>
                  {pageNumbers.map((number, index) => {
                    const previous = pageNumbers[index - 1];
                    const showGap = previous && number - previous > 1;
                    return (
                      <span key={number} className="inline-flex items-center gap-2">
                        {showGap ? <span className="text-sm text-muted-foreground">...</span> : null}
                        <button
                          type="button"
                          onClick={() => updateParams({ pagina: String(number) })}
                          className={`h-8 min-w-8 rounded-[7px] border px-2 text-[11px] font-semibold transition ${currentPage === number ? "border-[hsl(var(--store-accent-color))] bg-[hsl(var(--store-accent-soft))] text-[hsl(var(--store-accent-color))]" : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                        >
                          {number}
                        </button>
                      </span>
                    );
                  })}
                  <button
                    type="button"
                    disabled={currentPage === pageCount}
                    onClick={() => updateParams({ pagina: String(currentPage + 1) })}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[7px] px-2.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    Próxima <ChevronRight size={13} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[14px] border border-border bg-card p-8 text-center">
                <Search className="text-muted-foreground" size={28} />
                <h2 className="mt-4 text-base font-semibold text-foreground">Nenhum produto encontrado</h2>
                <p className="mt-2 max-w-md text-[13px] text-muted-foreground">
                  Tente remover algum filtro ou explorar outra categoria da loja.
                </p>
                <button type="button" onClick={clearFilters} className="mt-5 rounded-[9px] bg-[hsl(var(--store-accent-color))] px-4 py-2 text-[12px] font-semibold text-[hsl(var(--store-accent-foreground))] transition hover:opacity-85">
                  Limpar filtros
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Fechar filtros" className="absolute inset-0 bg-foreground/35" onClick={() => setFiltersOpen(false)} />
          <aside className="absolute bottom-0 left-0 right-0 max-h-[86vh] overflow-y-auto rounded-t-[18px] border border-border bg-card p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <strong className="text-sm font-semibold text-foreground">Filtros</strong>
              <button type="button" onClick={() => setFiltersOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground">
                <X size={16} />
              </button>
            </div>
            {filters}
          </aside>
        </div>
      ) : null}
    </>
  );

  if (user) {
    return <CatalogEditorShell storeName={storeName}>{catalogContent}</CatalogEditorShell>;
  }

  return <main className="min-h-screen bg-background text-foreground">{catalogContent}</main>;
};

export default StoreCatalogPage;
