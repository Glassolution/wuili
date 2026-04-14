import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronDown, MoreHorizontal, RefreshCw, ChevronsRight, Package, ChevronLeft, ChevronRight, Flame, Clock, PackageCheck, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import ImportProductModal, { type CatalogProduct } from "@/components/dashboard/ImportProductModal";

const CATEGORIES = [
  { key: "todos", label: "Todos" },
  { key: "eletronicos", label: "Eletrônicos" },
  { key: "telefones", label: "Telefones" },
  { key: "beleza", label: "Beleza" },
  { key: "casa", label: "Casa" },
  { key: "esportes", label: "Esportes" },
];

type QuickFilter = "all" | "best" | "recent" | "in_stock";

const QUICK_FILTERS: { key: QuickFilter; label: string; icon: any }[] = [
  { key: "all", label: "Todos", icon: null },
  { key: "best", label: "Melhores", icon: Flame },
  { key: "recent", label: "Recentes", icon: Clock },
  { key: "in_stock", label: "Em estoque", icon: PackageCheck },
];

function calcScore(p: any): number {
  let score = 0;
  if (!p.stock_quantity || p.stock_quantity === 0) score -= 100;
  else score += 50;
  if (p.created_at) {
    const days = (Date.now() - new Date(p.created_at).getTime()) / 86400000;
    if (days < 7) score += 30;
    else if (days < 30) score += 20;
  }
  const sp = p.suggested_price || 0;
  if (sp >= 49 && sp <= 199) score += 25;
  else if (sp >= 20 && sp < 49) score += 10;
  else if (sp > 300) score -= 20;
  const margin = sp > 0 ? ((sp - p.cost_price) / sp) * 100 : 0;
  if (margin >= 60) score += 15;
  else if (margin >= 50) score += 10;
  else score -= 10;
  if (p.cost_price > 500) score -= 30;
  return score;
}

const CatalogPage = () => {
  const [category, setCategory] = useState("todos");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const limit = 20;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["catalog", category, page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (category !== "todos") params.set("category", category);
      if (search) params.set("search", search);
      const url = `https://${projectId}.supabase.co/functions/v1/catalog?${params}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${anonKey}` } });
      if (!res.ok) throw new Error("Failed to fetch catalog");
      return res.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const url = `https://${projectId}.supabase.co/functions/v1/cj-sync-products`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`${data.totalSynced || 0} produtos sincronizados!`);
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: () => toast.error("Erro ao sincronizar produtos"),
  });

  const rawProducts = data?.products || [];
  const totalPages = data?.totalPages || 1;

  const products = useMemo(() => {
    let scored = rawProducts.map((p: any) => ({ ...p, _score: calcScore(p) }));
    if (quickFilter === "best") scored = scored.filter((p: any) => p._score >= 40);
    else if (quickFilter === "recent") scored = scored.filter((p: any) => {
      if (!p.created_at) return false;
      return (Date.now() - new Date(p.created_at).getTime()) / 86400000 < 30;
    });
    else if (quickFilter === "in_stock") scored = scored.filter((p: any) => p.stock_quantity && p.stock_quantity > 0);
    scored.sort((a: any, b: any) => b._score - a._score);
    return scored;
  }, [rawProducts, quickFilter]);

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const getImage = (images: any) => {
    try {
      const arr = typeof images === "string" ? JSON.parse(images) : images;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    } catch { return null; }
  };

  // Label shown on the dropdown button
  const activeCategoryLabel = CATEGORIES.find(c => c.key === category)?.label ?? "Todos";
  const activeFilterLabel = QUICK_FILTERS.find(f => f.key === quickFilter)?.label ?? "Todos";
  const dropdownLabel = quickFilter !== "all"
    ? activeFilterLabel
    : category !== "todos"
      ? activeCategoryLabel
      : "Filtrar";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Dropshipping</h2>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <MoreHorizontal size={18} />
          </button>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncMutation.isPending ? "animate-spin" : ""} />
          {syncMutation.isPending ? "Sincronizando..." : "Sincronizar produtos"}
        </button>
      </div>

      {/* Subtitle */}
      <p className="text-sm text-muted-foreground -mt-3">Produtos reais do CJ Dropshipping prontos para importar.</p>

      {/* Filters row */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-52 rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Dropdown Filtrar */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
              dropdownOpen || quickFilter !== "all" || category !== "todos"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {dropdownLabel}
            <ChevronDown size={13} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-2 w-52 rounded-2xl border border-border bg-background shadow-lg overflow-hidden">
              {/* Filtros rápidos */}
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Ordenar por</p>
                {QUICK_FILTERS.map((f) => {
                  const Icon = f.icon;
                  const active = quickFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => { setQuickFilter(f.key); setDropdownOpen(false); }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                        active ? "bg-foreground/5 font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {Icon && <Icon size={13} />}
                        {f.label}
                      </span>
                      {active && <Check size={13} className="text-foreground" />}
                    </button>
                  );
                })}
              </div>

              <div className="mx-3 my-2 border-t border-border" />

              {/* Categorias */}
              <div className="px-3 pb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Categoria</p>
                {CATEGORIES.map((c) => {
                  const active = category === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => { setCategory(c.key); setPage(1); setDropdownOpen(false); }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                        active ? "bg-foreground/5 font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {c.label}
                      {active && <Check size={13} className="text-foreground" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-background">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package size={48} className="text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium text-foreground">Nenhum produto encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            {quickFilter !== "all"
              ? "Nenhum produto corresponde a esse filtro. Tente outro."
              : 'Clique em "Sincronizar produtos" para popular o catálogo.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p: any) => {
            const img = getImage(p.images);
            return (
              <div
                key={p.id}
                className="group overflow-hidden rounded-2xl border border-border bg-background transition-shadow hover:shadow-md"
              >
                {/* Product image */}
                <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#f5f5f5] dark:bg-muted/50">
                  {img ? (
                    <img
                      src={img}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <Package size={32} className="text-muted-foreground/30" />
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-foreground px-2.5 py-0.5 text-[11px] font-bold text-background">
                    CJ Dropshipping
                  </span>
                </div>

                {/* Card body */}
                <div className="px-4 pb-4 pt-3">
                  <p className="text-[14px] font-semibold leading-[1.35] text-foreground line-clamp-2">
                    {p.title}
                  </p>

                  {/* Price + Profit */}
                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <p className="text-[11px] leading-none text-muted-foreground">Você paga</p>
                      <p className="mt-0.5 text-[14px] font-bold leading-none text-foreground">{formatPrice(p.cost_price)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] leading-none text-muted-foreground">Você lucra</p>
                      <p className="mt-0.5 text-[14px] font-bold leading-none text-emerald-600">
                        +{formatPrice(Math.round((p.suggested_price - p.cost_price) * 100) / 100)}
                      </p>
                    </div>
                  </div>

                  {/* Import button */}
                  <div className="mt-3">
                    <button
                      onClick={() => { setSelectedProduct(p); setIsImportModalOpen(true); }}
                      className="flex w-full items-center justify-center rounded-xl bg-foreground py-2.5 text-[13px] font-semibold text-background transition-opacity hover:opacity-80"
                    >
                      Importar produto
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Anterior
          </button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
          >
            Próximo <ChevronRight size={14} />
          </button>
        </div>
      )}

      <ImportProductModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        product={selectedProduct}
      />
    </div>
  );
};

export default CatalogPage;
