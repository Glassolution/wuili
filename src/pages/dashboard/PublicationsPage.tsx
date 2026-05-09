import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink, Package, ShoppingBag, Pause, Play, AlertCircle, Calendar,
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
  active:  "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
  pending: "bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/30",
  paused:  "bg-gray-100 text-gray-500 border border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  error:   "bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30",
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

const MobileSkeletonCard = () => (
  <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
    <div className="flex gap-3">
      <Skeleton className="h-20 w-20 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-11/12 rounded" />
        <Skeleton className="h-4 w-7/12 rounded" />
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const PublicationsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabFilter>("all");

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: publications, isLoading } = useQuery({
    queryKey: ["user-publications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_publications" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select("*")
        .eq("user_id", user!.id)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Publication[];
    },
  });

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

  const all = publications ?? [];

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = all.filter(p => {
    if (tab === "error") return p.status === "error";
    // "mercadolivre" — all current publications are from ML
    return true;
  });

  const activeCount = all.filter(p => p.status === "active").length;
  const errorCount = all.filter(p => p.status === "error").length;

  // ── Tabs config ────────────────────────────────────────────────────────────
  const tabs: { key: TabFilter; label: string; count?: number }[] = [
    { key: "all", label: "Todas", count: all.length },
    { key: "mercadolivre", label: "Mercado Livre" },
    { key: "error", label: "Com erro", count: errorCount },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-foreground sm:text-2xl">Publicações</h2>
          <p className="text-[12px] text-muted-foreground sm:text-sm">
            Acompanhe seus anúncios publicados e resolva ajustes rápido.
          </p>
        </div>
        {activeCount > 0 && (
          <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {activeCount} ativas
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 md:hidden">
        {[
          { label: "Todas", value: all.length },
          { label: "Ativas", value: activeCount },
          { label: "Erros", value: errorCount },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-border bg-card px-3 py-2.5 shadow-sm">
            <p className="text-[11px] font-medium text-muted-foreground">{item.label}</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-6 w-10 rounded" />
            ) : (
              <p className="mt-0.5 text-[22px] font-semibold leading-none text-foreground">{item.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
        <div className="inline-flex min-w-full gap-1 rounded-2xl border border-border bg-card p-1 shadow-sm sm:min-w-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={[
                "flex shrink-0 items-center justify-center rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors sm:text-sm",
                tab === t.key
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={[
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  tab === t.key ? "bg-background/15 text-background" : "bg-muted text-muted-foreground",
                ].join(" ")}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3 md:hidden">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <MobileSkeletonCard key={i} />)
          : filtered.length === 0
          ? (
            <div className="rounded-2xl border border-border bg-card px-5 py-12 text-center shadow-sm">
              <ShoppingBag size={38} className="mx-auto text-muted-foreground/30" />
              <p className="mt-3 text-sm font-semibold text-foreground">Nenhuma publicação encontrada</p>
              <p className="mx-auto mt-1 max-w-[260px] text-xs leading-relaxed text-muted-foreground">
                Importe um produto do catálogo para publicar e acompanhar por aqui.
              </p>
            </div>
          )
          : filtered.map(pub => {
            const status = pub.status || "pending";
            const isActive = status === "active";
            const isError = status === "error";
            const profit = (pub.price ?? 0) - (pub.cost_price ?? 0);

            return (
              <article key={pub.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex gap-3 p-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted/70">
                    {pub.thumbnail
                      ? <img src={pub.thumbnail} alt={pub.title} className="h-full w-full object-cover" loading="lazy" />
                      : <Package size={18} className="text-muted-foreground/40" />
                    }
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
                        {pub.title}
                      </p>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_STYLE[status] ?? STATUS_STYLE.pending}`}>
                        {isError && <AlertCircle size={10} />}
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10.5px] font-semibold text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-300">
                        Mercado Livre
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                        <Calendar size={10} />
                        {formatDate(pub.published_at)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-muted/60 px-3 py-2">
                        <p className="text-[10px] font-medium text-muted-foreground">Preço</p>
                        <p className="mt-0.5 truncate text-[13px] font-bold text-foreground">{formatBRL(pub.price ?? 0)}</p>
                      </div>
                      <div className="rounded-xl bg-muted/60 px-3 py-2">
                        <p className="text-[10px] font-medium text-muted-foreground">Lucro</p>
                        <p className={`mt-0.5 truncate text-[13px] font-bold ${profit >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-red-500 dark:text-red-300"}`}>
                          {formatBRL(profit)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-border bg-muted/20 p-2">
                  {pub.permalink ? (
                    <a
                      href={pub.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      <ExternalLink size={13} />
                      Ver anúncio
                    </a>
                  ) : (
                    <span className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-muted px-3 text-[12px] font-semibold text-muted-foreground">
                      Sem link
                    </span>
                  )}
                  <button
                    onClick={() => toggleMutation.mutate({ id: pub.id, currentStatus: status })}
                    disabled={toggleMutation.isPending || isError}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isActive ? <Pause size={13} /> : <Play size={13} />}
                    {isActive ? "Pausar" : "Ativar"}
                  </button>
                </div>
              </article>
            );
          })
        }
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
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
                        {pub.permalink && (
                          <a
                            href={pub.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
                          >
                            <ExternalLink size={11} />
                            Ver anúncio
                          </a>
                        )}
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
