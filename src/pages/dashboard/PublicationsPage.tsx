import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Package, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const PublicationsPage = () => {
  const { user } = useAuth();

  const { data: publications, isLoading } = useQuery({
    queryKey: ["user-publications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_publications" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const items = publications || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Publicações</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Produtos que você já publicou no Mercado Livre.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-wuili p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/80">Total publicados</p>
          <p className="mt-2 text-2xl font-black text-foreground">{items.length}</p>
        </div>
        <div className="card-wuili p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/80">Ativos</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">
            {items.filter((p: any) => p.status === "active").length}
          </p>
        </div>
        <div className="card-wuili p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/80">Lucro potencial total</p>
          <p className="mt-2 text-2xl font-black text-foreground">
            {formatBRL(items.reduce((sum: number, p: any) => sum + ((p.price || 0) - (p.cost_price || 0)), 0))}
          </p>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-wuili overflow-hidden">
              <Skeleton className="aspect-video w-full" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShoppingBag size={48} className="text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium text-foreground">Nenhuma publicação ainda</p>
          <p className="text-xs text-muted-foreground mt-1">
            Importe um produto do catálogo e publique no Mercado Livre.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((pub: any) => {
            const profit = (pub.price || 0) - (pub.cost_price || 0);
            const isActive = pub.status === "active";
            return (
              <div key={pub.id} className="card-wuili overflow-hidden group">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-muted/50 flex items-center justify-center overflow-hidden">
                  {pub.thumbnail ? (
                    <img src={pub.thumbnail} alt={pub.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <Package size={32} className="text-muted-foreground/30" />
                  )}
                  <span className={`absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    isActive ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                  }`}>
                    {isActive ? "Ativo" : "Pausado"}
                  </span>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground line-clamp-2">{pub.title}</p>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Venda</p>
                      <p className="text-sm font-bold text-foreground">{formatBRL(pub.price || 0)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">Lucro estimado</p>
                      <p className={`text-sm font-bold ${profit > 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {formatBRL(profit)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {pub.permalink && (
                      <a
                        href={pub.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-foreground py-2.5 text-[13px] font-semibold text-background transition-opacity hover:opacity-80"
                      >
                        <ExternalLink size={13} />
                        Ver no ML
                      </a>
                    )}
                    <button
                      disabled
                      className="flex flex-1 items-center justify-center rounded-xl border border-border py-2.5 text-[13px] font-medium text-muted-foreground cursor-not-allowed opacity-50"
                    >
                      Ver pedidos
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PublicationsPage;
