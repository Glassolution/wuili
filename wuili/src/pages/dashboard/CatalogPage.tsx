import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronDown, RefreshCw, Package, ChevronLeft, ChevronRight, Flame, Clock, PackageCheck, Check, Network, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import ImportProductModal, { type CatalogProduct } from "@/components/dashboard/ImportProductModal";
import PlatformIntegrationModal from "@/components/dashboard/PlatformIntegrationModal";
import SupplierCompareModal from "@/components/dashboard/SupplierCompareModal";
import UpgradeLimitModal from "@/components/UpgradeLimitModal";
import { usePlanLimits } from "@/hooks/usePlanLimits";

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
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [compareProductId, setCompareProductId] = useState<string | null>(null);
  const [compareProductTitle, setCompareProductTitle] = useState("");
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const planLimits = usePlanLimits();
  const limit = 20;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node))
        setFilterDropdownOpen(false);
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node))
        setCategoryDropdownOpen(false);
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
      const json = await res.json();
      // Throw so onError is triggered with the real message
      if (!res.ok) {
        throw new Error(json?.error || `Erro ${res.status}`);
      }
      return json;
    },
    onSuccess: (data) => {
      const count = data.synced ?? 0;
      toast.success(
        count > 0
          ? `${count} produtos sincronizados com sucesso!`
          : "Sincronização concluída (nenhum produto novo encontrado)."
      );
      // invalidate + force immediate refetch so the grid updates right away
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      queryClient.refetchQueries({ queryKey: ["catalog"] });
    },
    onError: (err: Error) =>
      toast.error(`Erro ao sincronizar: ${err.message}`),
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

  const activeCategoryLabel = CATEGORIES.find(c => c.key === category)?.label ?? "Todos";
  const activeFilterLabel = QUICK_FILTERS.find(f => f.key === quickFilter)?.label ?? "Todos";

  const handleImportProduct = (product: CatalogProduct) => {
    if (planLimits.loading) {
      toast.info("Verificando limites do seu plano...");
      return;
    }

    if (!planLimits.canImportProduct) {
      setIsUpgradeModalOpen(true);
      return;
    }

    setSelectedProduct(product);
    setIsImportModalOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Dropshipping</h2>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={syncMutation.isPending ? "animate-spin" : ""} />
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
              className="w-48 rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Buscar produto"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Categoria dropdown */}
          <div className="relative" ref={categoryDropdownRef}>
            <button
              onClick={() => setCategoryDropdownOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                categoryDropdownOpen || category !== "todos"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {activeCategoryLabel}
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

          {/* Filtrar dropdown */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setFilterDropdownOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                filterDropdownOpen || quickFilter !== "all"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {quickFilter !== "all" ? activeFilterLabel : "Filtrar"}
              <ChevronDown size={13} className={`transition-transform ${filterDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {filterDropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-border bg-background shadow-lg overflow-hidden py-1.5">
                {QUICK_FILTERS.filter(f => f.key !== "all").map((f) => {
                  const Icon = f.icon;
                  const active = quickFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => { setQuickFilter(f.key); setFilterDropdownOpen(false); }}
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
                      onClick={() => { setQuickFilter("all"); setFilterDropdownOpen(false); }}
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
                <Skeleton className="h-3 w-1/3" />
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
            const lucro = Math.round((p.suggested_price - p.cost_price) * 100) / 100;
            const categoryLabel = p.category
              ? p.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
              : null;
            return (
              <div
                key={p.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-background card-hover"
              >
                {/* Product image */}
                <div className="relative flex aspect-[4/3] shrink-0 items-center justify-center overflow-hidden bg-[#f5f5f5] dark:bg-muted/50">
                  {img ? (
                    <img
                      src={img}
                      alt={p.title}
                      width={400}
                      height={300}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <Package size={32} className="text-muted-foreground/30" />
                  )}

                  {/* Badges row — both anchored top-3, no overlap */}
                  <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                    {isBestseller ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white">
                        <Flame size={10} /> Mais vendido
                      </span>
                    ) : (
                      <span /> /* spacer so category still aligns right */
                    )}
                    {categoryLabel && (
                      <span className="max-w-[140px] truncate rounded-full border border-black/5 bg-white/90 px-2.5 py-0.5 text-[10.5px] font-medium text-foreground/80 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-zinc-900/85 dark:text-zinc-200">
                        {categoryLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card body — flex-col so button always anchors to bottom */}
                <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
                  {/* Title — fixed 2-line height so all cards align */}
                  <p className="line-clamp-2 h-[37px] text-[13.5px] font-semibold leading-[1.35] text-foreground">
                    {p.title}
                  </p>

                  {/* Custo + Venda sugerida */}
                  <div className="mt-3 flex items-start justify-between">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Custo</p>
                      <p className="mt-0.5 text-[13.5px] font-bold text-foreground">{formatPrice(p.cost_price)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">Venda sugerida</p>
                      <p className="mt-0.5 text-[13.5px] font-bold text-foreground">{formatPrice(p.suggested_price)}</p>
                    </div>
                  </div>

                  {/* Lucro estimado */}
                  <p className="mt-1.5 text-[11.5px] font-medium text-emerald-600">
                    Lucro estimado: {formatPrice(lucro)}
                  </p>

                  {/* Action buttons — pushed to bottom */}
                  <div className="mt-auto pt-3 flex gap-2">
                    <button
                      onClick={() => handleImportProduct(p)}
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
        onClose={() => {
          setIsImportModalOpen(false);
          void planLimits.refreshUsage();
        }}
        product={selectedProduct}
      />

      <UpgradeLimitModal
        open={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title="Você atingiu o limite do plano gratuito"
        message="Você atingiu o limite do plano gratuito. Faça upgrade para continuar importando produtos."
        cta="Fazer upgrade"
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
