import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const CATEGORIES = [
  { key: "todos", label: "Todos" },
  { key: "eletronicos", label: "Eletrônicos" },
  { key: "telefones", label: "Telefones" },
  { key: "beleza", label: "Beleza" },
  { key: "casa", label: "Casa" },
  { key: "esportes", label: "Esportes" },
];

const CatalogPage = () => {
  const [category, setCategory] = useState("todos");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
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
      if (category !== "todos") params.set("category", category);
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

  const products = data?.products || [];
  const totalPages = data?.totalPages || 1;

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-foreground">Catálogo de Produtos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Produtos reais do CJ Dropshipping prontos para importar.
          </p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCcw size={15} className={syncMutation.isPending ? "animate-spin" : ""} />
          {syncMutation.isPending ? "Sincronizando..." : "Sincronizar produtos"}
        </button>
      </div>

      {/* Search */}
      <input
        className="w-full max-w-md rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        placeholder="Buscar produto..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
      />

      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => { setCategory(c.key); setPage(1); }}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              category === c.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package size={48} className="text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium text-foreground">Nenhum produto encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Clique em "Sincronizar produtos" para popular o catálogo.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p: any) => {
            const img = getImage(p.images);
            return (
              <div
                key={p.id}
                className="group rounded-2xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                  {img ? (
                    <img
                      src={img}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package size={32} className="text-muted-foreground/30" />
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-orange-500 px-2.5 py-0.5 text-[11px] font-bold text-white">
                    CJ Dropshipping
                  </span>
                </div>

                <div className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                    {p.title}
                  </h3>

                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">
                      Custo: {formatPrice(p.cost_price)}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      Venda: {formatPrice(p.suggested_price)}
                    </span>
                  </div>

                  <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-500">
                    Margem {Math.round(p.margin_percent)}%
                  </span>

                  <button className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
                    Importar produto
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-xl bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Anterior
          </button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-xl bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:opacity-40"
          >
            Próximo <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default CatalogPage;
