import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Filter, Search, ShoppingCart, SlidersHorizontal, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

type StoreProduct = {
  id: string;
  title: string;
  category: string;
  collectionName: string;
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
        cost_price: number | null;
        suggested_price: number | null;
        original_price: number | null;
        created_at: string | null;
      }>
    | null;
};

type SortOption = "relevance" | "price-asc" | "price-desc" | "newest";

const PAGE_SIZE = 12;

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

const StoreProductCard = ({ product }: { product: StoreProduct }) => {
  const showOriginalPrice = typeof product.originalPrice === "number" && product.originalPrice > product.price;

  return (
    <article className="group overflow-hidden rounded-[14px] border border-border bg-card text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {isRecent(product.createdAt ?? product.addedAt) ? (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground shadow-sm">
            Novo
          </span>
        ) : null}
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="h-full w-full object-contain p-4 transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
            Produto sem imagem
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-[11px] font-medium text-muted-foreground">{product.category}</p>
        <h3 className="mt-1 line-clamp-2 min-h-[40px] text-sm font-semibold leading-snug text-foreground">
          {product.title}
        </h3>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            {showOriginalPrice ? (
              <span className="block text-[11px] text-muted-foreground line-through">
                {formatBRL(product.originalPrice ?? 0)}
              </span>
            ) : null}
            <strong className="block text-base font-semibold text-foreground">{formatBRL(product.price)}</strong>
          </div>
          <button
            type="button"
            aria-label={`Comprar ${product.title}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground transition hover:opacity-85"
          >
            <ShoppingCart size={17} strokeWidth={1.8} />
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
  const [draftMin, setDraftMin] = useState(searchParams.get("min") ?? "");
  const [draftMax, setDraftMax] = useState(searchParams.get("max") ?? "");

  const activeCategory = searchParams.get("categoria") ?? "";
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
            catalog_products!inner(id,title,category,images,cost_price,suggested_price,original_price,created_at,is_active,is_blocked,stock_quantity)
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

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      if (activeCategory && product.category !== activeCategory) return false;
      if (minPrice !== null && product.price < minPrice) return false;
      if (maxPrice !== null && product.price > maxPrice) return false;
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
  }, [activeCategory, maxPrice, minPrice, products, sort]);

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

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("categoria");
    next.delete("min");
    next.delete("max");
    next.delete("pagina");
    setSearchParams(next);
    setFiltersOpen(false);
  };

  const applyPriceFilters = () => {
    updateParams({ min: draftMin, max: draftMax });
    setFiltersOpen(false);
  };

  const activeFilters = [
    activeCategory ? { key: "categoria", label: activeCategory } : null,
    minPrice !== null ? { key: "min", label: `A partir de ${formatBRL(minPrice)}` } : null,
    maxPrice !== null ? { key: "max", label: `Até ${formatBRL(maxPrice)}` } : null,
  ].filter((filter): filter is { key: string; label: string } => Boolean(filter));

  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1).filter((number) => {
    if (pageCount <= 5) return true;
    return number === 1 || number === pageCount || Math.abs(number - currentPage) <= 1;
  });

  const filters = (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Categorias</h2>
          {activeCategory ? (
            <button type="button" onClick={() => updateParams({ categoria: null })} className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Limpar
            </button>
          ) : null}
        </div>
        <div className="mt-4 space-y-1">
          <button
            type="button"
            onClick={() => updateParams({ categoria: null })}
            className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-sm transition ${!activeCategory ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
          >
            Todas
            <span className="text-xs opacity-70">{products.length}</span>
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
                className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-sm transition ${activeCategory === category ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                <span className="truncate">{category}</span>
                <span className="ml-3 text-xs opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border pt-6">
        <h2 className="text-sm font-semibold text-foreground">Filtrar por</h2>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Preço</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="sr-only">Preço mínimo</span>
              <input
                value={draftMin}
                onChange={(event) => setDraftMin(event.target.value)}
                inputMode="decimal"
                placeholder="Mín."
                className="h-10 w-full rounded-[10px] border border-input bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="sr-only">Preço máximo</span>
              <input
                value={draftMax}
                onChange={(event) => setDraftMax(event.target.value)}
                inputMode="decimal"
                placeholder="Máx."
                className="h-10 w-full rounded-[10px] border border-input bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={applyPriceFilters} className="h-10 flex-1 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-85">
            Aplicar
          </button>
          <button type="button" onClick={clearFilters} className="h-10 rounded-[10px] border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-secondary" aria-label="Limpar filtros">
            <X size={16} />
          </button>
        </div>
      </section>
    </div>
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-[1180px] items-center justify-between gap-4 px-5">
          <Link to="/minha-loja/editor" className="min-w-0">
            <strong className="block truncate text-xl font-semibold tracking-[-0.03em]">{storeName}</strong>
            <span className="block text-xs text-muted-foreground">Escolhas para você.</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <Link to="/minha-loja/editor" className="transition hover:text-foreground">Loja</Link>
            <Link to="/catalogo" className="text-foreground">Catálogo</Link>
          </nav>
          <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-border px-3 text-sm font-semibold text-foreground lg:hidden">
            <SlidersHorizontal size={16} /> Filtros
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-5 py-8">
        <div className="mb-7 flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/minha-loja/editor" className="hover:text-foreground">Loja</Link>
              <ChevronRight size={13} />
              {activeCategory ? (
                <>
                  <Link to="/catalogo" className="hover:text-foreground">Catálogo</Link>
                  <ChevronRight size={13} />
                  <span className="text-foreground">{activeCategory}</span>
                </>
              ) : (
                <span className="text-foreground">Catálogo</span>
              )}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] md:text-4xl">
              {activeCategory || "Catálogo completo"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {filteredProducts.length} produto{filteredProducts.length === 1 ? "" : "s"} encontrado{filteredProducts.length === 1 ? "" : "s"}.
            </p>
          </div>

          <label className="flex h-11 w-full items-center gap-3 rounded-[12px] border border-border bg-card px-3 text-sm text-muted-foreground lg:w-[290px]">
            <Filter size={16} />
            <span className="sr-only">Ordenar produtos</span>
            <select
              value={sort}
              onChange={(event) => updateParams({ ordenar: event.target.value })}
              className="h-full flex-1 bg-transparent text-foreground outline-none"
            >
              <option value="relevance">Ordenar por relevância</option>
              <option value="price-asc">Menor preço</option>
              <option value="price-desc">Maior preço</option>
              <option value="newest">Mais recentes</option>
            </select>
          </label>
        </div>

        {activeFilters.length > 0 ? (
          <div className="mb-6 flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => updateParams({ [filter.key]: null })}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary"
              >
                {filter.label}
                <X size={12} />
              </button>
            ))}
            <button type="button" onClick={clearFilters} className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground">
              Limpar tudo
            </button>
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-28 rounded-[16px] border border-border bg-card p-5 shadow-sm">{filters}</div>
          </aside>

          <section>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-[310px] animate-pulse rounded-[14px] bg-muted" />
                ))}
              </div>
            ) : error ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[18px] border border-border bg-card p-8 text-center">
                <Search className="text-muted-foreground" size={32} />
                <h2 className="mt-4 text-lg font-semibold text-foreground">Catálogo indisponível</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">{error}</p>
              </div>
            ) : paginatedProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {paginatedProducts.map((product) => (
                    <StoreProductCard key={product.id} product={product} />
                  ))}
                </div>

                <div className="mt-9 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => updateParams({ pagina: String(currentPage - 1) })}
                    className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-border px-3 text-sm font-medium text-foreground transition hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronLeft size={15} /> Anterior
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
                          className={`h-10 min-w-10 rounded-[10px] border px-3 text-sm font-semibold transition ${currentPage === number ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-secondary"}`}
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
                    className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-border px-3 text-sm font-medium text-foreground transition hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
                  >
                    Próxima <ChevronRight size={15} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[18px] border border-border bg-card p-8 text-center">
                <Search className="text-muted-foreground" size={32} />
                <h2 className="mt-4 text-lg font-semibold text-foreground">Nenhum produto encontrado</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Tente remover algum filtro ou explorar outra categoria da loja.
                </p>
                <button type="button" onClick={clearFilters} className="mt-5 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-85">
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
          <aside className="absolute bottom-0 left-0 right-0 max-h-[86vh] overflow-y-auto rounded-t-[22px] border border-border bg-card p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <strong className="text-base font-semibold text-foreground">Filtros</strong>
              <button type="button" onClick={() => setFiltersOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
                <X size={16} />
              </button>
            </div>
            {filters}
          </aside>
        </div>
      ) : null}
    </main>
  );
};

export default StoreCatalogPage;
