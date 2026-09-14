import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronDown, MoreHorizontal, RefreshCw, ArrowRight, ChevronsRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PlatformLogo from "@/components/dashboard/PlatformLogo";
import { veloToast } from "@/components/ui/velo-toast";

type Product = {
  id: string;
  name: string;
  image: string;
  source: string;
  sourceColor: string;
  rating: number;
  reviews: string;
  price: string;
  minOrder: string;
  tags: string[];
};

const categories = ["Todos", "Eletrônicos", "Moda", "Beleza", "Casa"];

const ProductsPage = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [showHidden, setShowHidden] = useState(false);

  // Log para debug
  console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
  console.log("User ID:", user?.id);

  // Buscar produtos do Supabase
  const { data: productsData, isLoading, error, refetch } = useQuery({
    queryKey: ["products", user?.id],
    enabled: !!user,
    queryFn: async () => {
      console.log("Buscando produtos do Supabase...");
      
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("Produtos encontrados:", data);
      console.log("Erro produtos:", error);

      if (error) {
        console.error("Erro ao buscar produtos:", error);
        throw error;
      }

      return data || [];
    },
  });

  // Mapear produtos do Supabase para o formato esperado
  const products: Product[] = (productsData || []).map((p: any) => ({
    id: p.id,
    name: p.name || p.title || "Produto sem nome",
    image: p.image_url || p.image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop",
    source: p.source || "Velo",
    sourceColor: p.source_color || "bg-[#111111]",
    rating: p.rating || 0,
    reviews: p.reviews_count?.toString() || "0",
    price: p.price ? `R$ ${p.price}` : "Consultar",
    minOrder: p.min_order ? `${p.min_order} unid.` : "1 unid.",
    tags: p.tags || [],
  }));

  const handleSync = async () => {
    const toastId = veloToast.loading("Sincronizando produtos...");
    try {
      // TODO: Implementar sincronização real com integrações
      await refetch();
      veloToast.success("Produtos sincronizados com sucesso!", { id: toastId });
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      veloToast.error("Erro ao sincronizar produtos", { id: toastId });
    }
  };

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="truncate text-[22px] font-semibold tracking-tight text-foreground sm:text-2xl">Dropshipping</h2>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <MoreHorizontal size={18} />
          </button>
          <button 
            onClick={handleSync}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Sincronizar produtos"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:w-auto">
          Integração de Plataforma
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Subtitle */}
      <p className="-mt-1 text-sm text-muted-foreground sm:-mt-3">Encontre produtos e importe para sua loja</p>

      {/* Filters row */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
          {/* Search */}
          <div className="relative shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-[210px] rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 sm:w-56"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Date range pill */}
          <button className="flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80">
            2 Fev - 14 Abr
            <ChevronDown size={13} />
          </button>

          {/* Filter buttons */}
          <button className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted">
            Status de Pagamento <ChevronDown size={13} />
          </button>
          <button className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted">
            Categoria <ChevronDown size={13} />
          </button>

          {/* Hide button */}
          <button
            onClick={() => setShowHidden(!showHidden)}
            className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Ocultar
          </button>
        </div>

        {/* Category pills */}
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-4 py-[7px] text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw size={32} className="animate-spin mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carregando produtos...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-sm text-red-500 mb-2">Erro ao carregar produtos</p>
            <p className="text-xs text-muted-foreground mb-4">{error.message}</p>
            <button 
              onClick={() => refetch()}
              className="text-sm text-foreground hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              {products.length === 0 ? "Nenhum produto sincronizado ainda" : "Nenhum produto encontrado"}
            </p>
            {products.length === 0 && (
              <button 
                onClick={handleSync}
                className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 mx-auto"
              >
                <RefreshCw size={14} />
                Sincronizar produtos
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="group overflow-hidden rounded-2xl border border-border bg-background transition-shadow hover:shadow-md"
          >
            {/* Product image */}
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#f5f5f5] p-4 dark:bg-muted/50 sm:p-6">
              <img
                src={p.image}
                alt={p.name}
                className="h-full w-full rounded-lg object-contain transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded border-2 border-border bg-background shadow-sm" />
            </div>

            {/* Card body */}
            <div className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
              {/* Source + Rating */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <PlatformLogo platform={p.source} color={p.sourceColor.replace("bg-[", "").replace("]", "")} size={22} />
                  <span className="text-[13px] font-normal text-foreground">{p.source}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[12px] text-amber-500">★</span>
                  <span className="text-[13px] font-normal text-foreground">{p.rating}</span>
                  <span className="text-[12px] text-muted-foreground">({p.reviews})</span>
                </div>
              </div>

              {/* Product name */}
              <p className="mt-2 text-[14px] font-normal leading-[1.35] text-foreground">
                {p.name}
              </p>

              {/* Price + Min Order */}
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-[11px] leading-none text-muted-foreground">Preço</p>
                  <p className="mt-0.5 text-[14px] font-semibold leading-none text-foreground">{p.price}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] leading-none text-muted-foreground">Pedido mín.</p>
                  <p className="mt-0.5 text-[14px] font-semibold leading-none text-foreground">{p.minOrder}</p>
                </div>
              </div>

              {/* Tags */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-muted px-2 py-[3px] text-[11px] font-medium text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Import button */}
              <div className="mt-3 flex items-center gap-2">
                <button className="flex flex-1 items-center justify-center rounded-xl bg-foreground py-2.5 text-[13px] font-semibold text-background transition-opacity hover:opacity-80">
                  Importar Produto
                </button>
                <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted">
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
};

export default ProductsPage;
