import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronDown, MoreHorizontal, RefreshCw, ArrowRight, ChevronsRight, Package, ChevronLeft, ChevronRight, Flame, Clock, PackageCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import ImportProductModal, { type CatalogProduct } from "@/components/dashboard/ImportProductModal";

const CATEGORIES = [
  { key: "todos", label: "Todos", icon: null },
  { key: "best", label: "Melhores", icon: Flame },
  { key: "recent", label: "Recentes", icon: Clock },
  { key: "in_stock", label: "Em estoque", icon: PackageCheck },
  { key: "eletronicos", label: "Eletrônicos", icon: null },
  { key: "telefones", label: "Telefones", icon: null },
  { key: "beleza", label: "Beleza", icon: null },
  { key: "casa", label: "Casa", icon: null },
  { key: "esportes", label: "Esportes", icon: null },
];

function calcScore(p: any): number {
  let score = 0;

  // Stock
  if (!p.stock_quantity || p.stock_quantity === 0) {
    score -= 100;
  } else {
    score += 50;
  }

  // Recency
  if (p.created_at) {
    const days = (Date.now() - new Date(p.created_at).getTime()) / 86400000;
    if (days < 7) score += 30;
    else if (days < 30) score += 20;
  }

  // Price range (suggested_price in BRL)
  const sp = p.suggested_price || 0;
  if (sp >= 49 && sp <= 199) score += 25;
  else if (sp >= 20 && sp < 49) score += 10;
  else if (sp > 300) score -= 20;

  // Margin
  const margin = sp > 0 ? ((sp - p.cost_price) / sp) * 100 : 0;
  if (margin >= 60) score += 15;
  else if (margin >= 50) score += 10;
  else score -= 10;

  // Heavy penalty for high cost
  if (p.cost_price > 500) score -= 30;

  return score;
}

function getPriorityBadge(score: number) {
  if (score >= 60) return { label: "Alta prioridade", cls: "bg-emerald-500/10 text-emerald-600" };
  if (score >= 20) return { label: "Média", cls: "bg-amber-500/10 text-amber-600" };
  return { label: "Baixa", cls: "bg-red-500/10 text-red-600" };
}


const CatalogPage = () => {
  const [category, setCategory] = useState("todos");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const limit = 20;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const { data, isLoading } = useQuery({
    queryKey: ["catalog", category, page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const backendCategories = ["eletronicos", "telefones", "beleza", "casa", "esportes"];
      if (category !== "todos" && backendCategories.includes(category)) params.set("category", category);
      if (search) params.set("search", search);

      const url = `https://${projectId}.supabase.co/functions/v1/catalog?${params}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${anonKey}` },
      });
      if (!res.ok) throw new Error("Failed to fetch catalog");
      return res.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const url = `https://${projectId}.supabase.co/functions/v1/cj-sync-products`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
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

  // Score, filter & sort
  const products = useMemo(() => {
    let scored = rawProducts.map((p: any) => ({ ...p, _score: calcScore(p) }));

    if (category === "best") {
      scored = scored.filter((p: any) => p._score >= 40);
    } else if (category === "recent") {
      scored = scored.filter((p: any) => {
        if (!p.created_at) return false;
        return (Date.now() - new Date(p.created_at).getTime()) / 86400000 < 30;
      });
    } else if (category === "in_stock") {
      scored = scored.filter((p: any) => p.stock_quantity && p.stock_quantity > 0);
    }

    scored.sort((a: any, b: any) => b._score - a._score);
    return scored;
  }, [rawProducts, category]);

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const getImage = (images: any) => {
    try {
      const arr = typeof images === "string" ? JSON.parse(images) : images;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    } catch {
      return null;
    }
  };

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
      <div className="flex items-center justify-between gap-4">
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

          {/* Hide button */}
          <button className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Ocultar
          </button>
        </div>

        {/* Category + filter pills */}
        <div className="hidden items-center gap-1.5 lg:flex">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                onClick={() => { setCategory(c.key); setPage(1); }}
                className={`flex items-center gap-1.5 rounded-full px-4 py-[7px] text-sm font-medium transition-colors ${
                  category === c.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {Icon && <Icon size={13} />}
                {c.label}
              </button>
            );
          })}
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
            {category !== "todos"
              ? "Nenhum produto corresponde a esse filtro. Tente outro."
              : 'Clique em "Sincronizar produtos" para popular o catálogo.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p: any) => {
            const img = getImage(p.images);
            const priority = getPriorityBadge(p._score);
            const margin = p.suggested_price > 0
              ? Math.round(((p.suggested_price - p.cost_price) / p.suggested_price) * 100)
              : Math.round(p.margin_percent);
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
                  {/* Source badge */}
                  <span className="absolute left-3 top-3 rounded-full bg-foreground px-2.5 py-0.5 text-[11px] font-bold text-background">
                    CJ Dropshipping
                  </span>
                  {/* Priority badge */}
                  <span className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${priority.cls}`}>
                    {priority.label}
                  </span>
                </div>

                {/* Card body */}
                <div className="px-4 pb-4 pt-3">
                  {/* Product name */}
                  <p className="text-[14px] font-semibold leading-[1.35] text-foreground line-clamp-2">
                    {p.title}
                  </p>

                  {/* Price + Suggested price */}
                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <p className="text-[11px] leading-none text-muted-foreground">Custo</p>
                      <p className="mt-0.5 text-[14px] font-bold leading-none text-foreground">{formatPrice(p.cost_price)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] leading-none text-muted-foreground">Venda</p>
                      <p className="mt-0.5 text-[14px] font-bold leading-none text-foreground">{formatPrice(p.suggested_price)}</p>
                    </div>
                  </div>

                  {/* Margin tag + Stock */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={`rounded-md px-2 py-[3px] text-[11px] font-semibold ${
                      margin >= 60 ? "bg-emerald-500/10 text-emerald-600" :
                      margin >= 40 ? "bg-blue-500/10 text-blue-600" :
                      "bg-amber-500/10 text-amber-600"
                    }`}>
                      Margem {margin}%
                    </span>
                    <span className={`rounded-md px-2 py-[3px] text-[11px] font-medium ${
                      !p.stock_quantity || p.stock_quantity === 0
                        ? "bg-red-500/10 text-red-600"
                        : "bg-emerald-500/10 text-emerald-600"
                    }`}>
                      {!p.stock_quantity || p.stock_quantity === 0 
                        ? "Sem estoque" 
                        : p.stock_quantity >= 999 
                          ? "✓ Disponível" 
                          : `Estoque: ${p.stock_quantity} un`}
                    </span>
                  </div>

                  {/* Import button */}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => { setSelectedProduct(p); setIsImportModalOpen(true); }}
                      className="flex flex-1 items-center justify-center rounded-xl bg-foreground py-2.5 text-[13px] font-semibold text-background transition-opacity hover:opacity-80"
                    >
                      Importar produto
                    </button>
                    <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted">
                      <ChevronsRight size={16} />
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
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
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
