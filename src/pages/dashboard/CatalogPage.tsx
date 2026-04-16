import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronDown, MoreHorizontal, RefreshCw, Package, ChevronLeft, ChevronRight, Flame, Clock, PackageCheck, Check, ArrowUpRight, Network, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import ImportProductModal, { type CatalogProduct } from "@/components/dashboard/ImportProductModal";
import PlatformIntegrationModal from "@/components/dashboard/PlatformIntegrationModal";
import SupplierCompareModal from "@/components/dashboard/SupplierCompareModal";

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

type QuickFilter = "all" | "best" | "recent" | "in_stock";

const QUICK_FILTERS: { key: QuickFilter; label: string; icon: any }[] = [
  { key: "all", label: "Todos", icon: null },
  { key: "best", label: "Melhores", icon: Flame },
  { key: "recent", label: "Recentes", icon: Clock },
  { key: "in_stock", label: "Em estoque", icon: PackageCheck },
];

const CatalogPage = () => {
  const [category, setCategory] = useState("todos");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [compareProductId, setCompareProductId] = useState<string | null>(null);
  const [compareProductTitle, setCompareProductTitle] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const limit = 20;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
      const url = `https://${projectId}.supabase.co/functions/v1/cj-sync`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`${data.synced || 0} produtos sincronizados!`);
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: () => toast.error("Erro ao sincronizar produtos"),
  });

  const rawProducts = data?.products || [];
  const totalPages = data?.totalPages || 1;

  const products = useMemo(() => {
    let list = [...rawProducts];
    if (quickFilter === "best") list = list.filter((p: any) => (p.orders_count || 0) > 50);
    else if (quickFilter === "recent") list = list.filter((p: any) => {
      if (!p.created_at) return false;
      return (Date.now() - new Date(p.created_at).getTime()) / 86400000 < 30;
    });
    else if (quickFilter === "in_stock") list = list.filter((p: any) => p.stock_quantity && p.stock_quantity > 0);
    // Already sorted by orders_count DESC from backend
    return list;
  }, [rawProducts, quickFilter]);

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const getImage = (images: any) => {
    try {
      const arr = typeof images === "string" ? JSON.parse(images) : images;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    } catch { return null; }
  };

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Dropshipping</h2>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="ml-2 flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          title="Sincronizar catálogo CJ"
        >
          <RefreshCw size={12} className={syncMutation.isPending ? "animate-spin" : ""} />
          {syncMutation.isPending ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>

      {/* Filters row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-44 rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Buscar produto"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Category dropdown */}
          <div className="relative" ref={categoryDropdownRef}>
            <button
              onClick={() => setCategoryDropdownOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              {CATEGORIES.find(c => c.key === category)?.label || "Categorias"}
              <ChevronDown size={13} className={`transition-transform ${categoryDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {categoryDropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-border bg-background shadow-lg overflow-hidden py-1.5">
                {CATEGORIES.map((c) => {
                  const active = category === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => { setCategory(c.key); setPage(1); setCategoryDropdownOpen(false); }}
                      className={`flex w-full items-center justify-between px-3.5 py-2 text-sm transition-colors ${
                        active ? "font-semibold text-foreground bg-foreground/5" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {c.label}
                      {active && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick filter dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                dropdownOpen || quickFilter !== "all"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {quickFilter !== "all" ? QUICK_FILTERS.find(f => f.key === quickFilter)?.label : "Filtrar"}
              <ChevronDown size={13} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-border bg-background shadow-lg overflow-hidden py-1.5">
                {QUICK_FILTERS.filter(f => f.key !== "all").map((f) => {
                  const Icon = f.icon;
                  const active = quickFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => { setQuickFilter(f.key); setDropdownOpen(false); }}
                      className={`flex w-full items-center justify-between px-3.5 py-2 text-sm transition-colors ${
                        active ? "font-semibold text-foreground bg-foreground/5" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {Icon && <Icon size={13} />}
                        {f.label}
                      </span>
                      {active && <Check size={12} />}
                    </button>
                  );
                })}
                {quickFilter !== "all" && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={() => { setQuickFilter("all"); setDropdownOpen(false); }}
                      className="flex w-full items-center px-3.5 py-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Limpar filtro
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Integrações */}
        <button
          onClick={() => setIsIntegrationModalOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Network size={13} />
          Integrações
        </button>
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
              : 'Clique em "Sincronizar" para popular o catálogo.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p: any) => {
            const img = getImage(p.images);
            const isBestseller = (p.orders_count || 0) > 100;
            const suggestedSale = Math.round(p.cost_price * 2.5 * 100) / 100;
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
                  <div className="absolute left-3 top-3 flex items-center gap-1.5">
                    <span className="rounded-full bg-foreground px-2.5 py-0.5 text-[11px] font-bold text-background">
                      CJ
                    </span>
                    {isBestseller && (
                      <span className="flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white">
                        <Flame size={10} /> Mais vendido
                      </span>
                    )}
                  </div>
                  {p.category && (
                    <span className="absolute right-3 top-3 rounded-full bg-background/80 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-foreground">
                      {p.category}
                    </span>
                  )}
                </div>

                {/* Card body */}
                <div className="px-4 pb-4 pt-3">
                  <p className="text-[14px] font-semibold leading-[1.35] text-foreground line-clamp-2">
                    {p.title}
                  </p>

                  {/* Price rows */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="text-[11px] leading-none text-muted-foreground">Custo</p>
                        <p className="mt-0.5 text-[14px] font-bold leading-none text-foreground">{formatPrice(p.cost_price)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] leading-none text-muted-foreground">Venda sugerida</p>
                        <p className="mt-0.5 text-[14px] font-bold leading-none text-emerald-600">{formatPrice(suggestedSale)}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-600 font-medium">
                      Lucro estimado: {formatPrice(suggestedSale - p.cost_price)}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => { setSelectedProduct(p); setIsImportModalOpen(true); }}
                      className="flex flex-1 items-center justify-center rounded-xl bg-foreground py-2.5 text-[13px] font-semibold text-background transition-opacity hover:opacity-80"
                    >
                      Importar produto
                    </button>
                    <button
                      onClick={() => { setCompareProductId(p.id); setCompareProductTitle(p.title); }}
                      className="flex items-center justify-center rounded-xl border border-border bg-background p-2.5 text-foreground transition-colors hover:bg-muted"
                      title="Ver fornecedores"
                    >
                      <Users size={14} />
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

      <PlatformIntegrationModal
        open={isIntegrationModalOpen}
        onClose={() => setIsIntegrationModalOpen(false)}
      />

      <SupplierCompareModal
        open={!!compareProductId}
        onClose={() => setCompareProductId(null)}
        productId={compareProductId || ""}
        productTitle={compareProductTitle}
      />
    </div>
  );
};

export default CatalogPage;
