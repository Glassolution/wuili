import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink, Package, ShoppingBag, Pause, Play, AlertCircle, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────
type Publication = {
  id: string;
  ml_item_id: string | null;
  permalink: string | null;
  title: string;
  price: number | null;
  cost_price: number | null;
  thumbnail: string | null;
  status: string;
  user_id: string;
  published_at: string | null;
  created_at: string;
};

type TabFilter = "all" | "mercadolivre" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  pending: "Pendente",
  paused: "Pausado",
  error: "Erro",
};

const STATUS_STYLE: Record<string, string> = {
  active:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  pending: "bg-yellow-50  text-yellow-700  border border-yellow-200",
  paused:  "bg-gray-100   text-gray-500    border border-gray-200",
  error:   "bg-red-50     text-red-600     border border-red-200",
};

// ─── Skeleton row ─────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr className="border-b border-border">
    {[56, 160, 80, 70, 70, 90, 90].map((w, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton style={{ width: w, height: 14 }} className="rounded" />
      </td>
    ))}
  </tr>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const PublicationsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabFilter>("all");

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: publications, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["user-publications", user?.id],
    enabled: !!user,
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_publications" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select("*")
        .eq("user_id", user!.id)
        .order("published_at", { ascending: false });
      if (error) {
        console.error("[publications] fetch error", error);
        throw error;
      }
      return (data ?? []) as unknown as Publication[];
    },
  });

  // ── Realtime: atualiza a lista assim que ml-publish insere o registro ──────
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user_publications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_publications", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["user-publications", user.id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // ── Toggle status mutation ─────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "active" ? "paused" : "active";
      const { error } = await supabase
        .from("user_publications" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-publications", user?.id] }),
  });

  // Fallback de link quando o ML demora a retornar permalink
  const buildPermalink = (pub: Publication): string | null => {
    if (pub.permalink) return pub.permalink.replace(/^http:\/\//i, "https://");
    if (pub.ml_item_id) {
      // formato MLBxxxxxxx → MLB-xxxxxxx
      const slug = pub.ml_item_id.replace(/^MLB/, "MLB-");
      return `https://produto.mercadolivre.com.br/${slug}`;
    }
    return null;
  };

  const all = publications ?? [];

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = all.filter(p => {
    if (tab === "error") return p.status === "error";
    // "mercadolivre" — all current publications are from ML
    return true;
  });

  const activeCount = all.filter(p => p.status === "active").length;

  // ── Tabs config ────────────────────────────────────────────────────────────
  const tabs: { key: TabFilter; label: string; count?: number }[] = [
    { key: "all", label: "Todas", count: all.length },
    { key: "mercadolivre", label: "Mercado Livre" },
    { key: "error", label: "Com erro", count: all.filter(p => p.status === "error").length },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Publicações</h2>
        {activeCount > 0 && (
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            {activeCount} ativas
          </span>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "px-4 py-2 text-sm font-medium transition-colors relative",
              tab === t.key
                ? "text-foreground after:absolute after:bottom-0 after:inset-x-0 after:h-[2px] after:bg-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plataforma</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preço</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
              ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                      <ShoppingBag size={40} className="text-muted-foreground/30" />
                      <p className="text-sm font-medium text-foreground">Nenhuma publicação ainda</p>
                      <p className="text-xs text-muted-foreground max-w-xs">
                        Importe um produto do catálogo para começar.
                      </p>
                    </div>
                  </td>
                </tr>
              )
              : filtered.map(pub => {
                const status = pub.status || "pending";
                const isActive = status === "active";
                const isError = status === "error";
                const profit = (pub.price ?? 0) - (pub.cost_price ?? 0);

                return (
                  <tr key={pub.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    {/* Produto */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted/60 shrink-0 overflow-hidden flex items-center justify-center">
                          {pub.thumbnail
                            ? <img src={pub.thumbnail} alt={pub.title} className="w-full h-full object-cover" loading="lazy" />
                            : <Package size={16} className="text-muted-foreground/40" />
                          }
                        </div>
                        <p className="text-xs font-medium text-foreground line-clamp-2 max-w-[220px]">
                          {pub.title}
                        </p>
                      </div>
                    </td>

                    {/* Plataforma */}
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-yellow-50 border border-yellow-200 px-2 py-0.5 text-[11px] font-semibold text-yellow-700">
                        Mercado Livre
                      </span>
                    </td>

                    {/* Preço */}
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-foreground">{formatBRL(pub.price ?? 0)}</p>
                      {profit !== 0 && (
                        <p className={`text-[11px] mt-0.5 ${profit > 0 ? "text-emerald-600" : "text-red-500"}`}>
                          Lucro {formatBRL(profit)}
                        </p>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status] ?? STATUS_STYLE.pending}`}>
                        {isError && <AlertCircle size={10} />}
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    </td>

                    {/* Data */}
                    <td className="px-4 py-3">
                      <p className="text-xs text-muted-foreground">{formatDate(pub.published_at)}</p>
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const link = buildPermalink(pub);
                          const syncing = !pub.permalink && !!pub.ml_item_id;
                          if (!link) {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
                                <Loader2 size={11} className="animate-spin" />
                                Sincronizando…
                              </span>
                            );
                          }
                          return (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
                              title={syncing ? "Sincronizando com o Mercado Livre…" : "Abrir anúncio"}
                            >
                              <ExternalLink size={11} />
                              Ver anúncio
                            </a>
                          );
                        })()}
                        <button
                          onClick={() => toggleMutation.mutate({ id: pub.id, currentStatus: status })}
                          disabled={toggleMutation.isPending || isError}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isActive ? "Pausar" : "Ativar"}
                        >
                          {isActive ? <Pause size={11} /> : <Play size={11} />}
                          {isActive ? "Pausar" : "Ativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PublicationsPage;
