import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Search, ChevronDown, Grid3x3, List, Package, ExternalLink, ArrowUpRight, MoreHorizontal, Pencil, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardPageShell from "@/components/dashboard/DashboardPageShell";
import { veloToast } from "@/components/ui/velo-toast";

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
  catalog_product_id: string | null;
  cj_product_url: string | null;
  supplier_url: string | null;
};

type TabFilter = "all" | "active" | "draft" | "archived";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const normalizeExternalUrl = (value: string | null | undefined) => {
  const url = value?.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
  return `https://${url}`;
};

const openExternal = (url: string | null, missingMessage: string) => {
  if (!url) {
    veloToast.info(missingMessage);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

// ─── Page ─────────────────────────────────────────────────────────────────────
const PublicationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: publications, isLoading, refetch } = useQuery({
    queryKey: ["user-publications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_publications")
        .select("*")
        .eq("user_id", user!.id)
        .order("published_at", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as Omit<Publication, "supplier_url">[];
      const catalogIds = Array.from(new Set(rows.map((row) => row.catalog_product_id).filter((value): value is string => Boolean(value))));
      const supplierMap = new Map<string, string | null>();

      const uuidIds = catalogIds.filter(isUuid);
      if (uuidIds.length > 0) {
        const { data: products } = await supabase
          .from("catalog_products")
          .select("id,external_id,product_url")
          .in("id", uuidIds);
        (products ?? []).forEach((product) => {
          supplierMap.set(product.id, product.product_url ?? null);
          supplierMap.set(product.external_id, product.product_url ?? null);
        });
      }

      if (catalogIds.length > 0) {
        const { data: productsByExternalId } = await supabase
          .from("catalog_products")
          .select("id,external_id,product_url")
          .in("external_id", catalogIds);
        (productsByExternalId ?? []).forEach((product) => {
          supplierMap.set(product.id, product.product_url ?? null);
          supplierMap.set(product.external_id, product.product_url ?? null);
        });
      }

      return rows.map((row) => ({
        ...row,
        supplier_url: row.catalog_product_id ? supplierMap.get(row.catalog_product_id) ?? row.cj_product_url ?? null : row.cj_product_url ?? null,
      })) as Publication[];
    },
  });

  const handleDeletePublication = async (pub: Publication) => {
    if (!user?.id || deletingId) return;
    const confirmed = window.confirm(`Excluir "${pub.title}" da sua lista de publicações?`);
    if (!confirmed) return;

    setDeletingId(pub.id);
    const { error } = await supabase
      .from("user_publications")
      .delete()
      .eq("id", pub.id)
      .eq("user_id", user.id);
    setDeletingId(null);

    if (error) {
      veloToast.error("Não foi possível excluir a publicação.");
      return;
    }

    veloToast.success("Publicação excluída.");
    void refetch();
  };

  const all = publications ?? [];
  const activeCount = all.filter((p) => p.status === "active").length;
  const draftCount = all.filter((p) => p.status === "pending").length;
  const archivedCount = all.filter((p) =>
    ["paused", "closed", "inactive", "under_review", "archived_duplicate"].includes(p.status),
  ).length;

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = all.filter(p => {
    // Tab filter
    if (tab === "active" && p.status !== "active") return false;
    if (tab === "draft" && p.status !== "pending") return false;
    if (tab === "archived" &&
      !["paused", "closed", "inactive", "under_review", "archived_duplicate"].includes(p.status)) {
      return false;
    }
    
    // Search filter
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  // ── Badge presets por status real do ML ────────────────────────────────────
  const statusPresets: Record<string, { label: string; wrap: string; dot: string }> = {
    active:             { label: "Ativo",           wrap: "bg-emerald-50 text-emerald-700",   dot: "bg-emerald-500" },
    pending:            { label: "Rascunho",        wrap: "bg-gray-100 text-gray-600",        dot: "bg-gray-400" },
    paused:             { label: "Pausado",         wrap: "bg-amber-50 text-amber-700",       dot: "bg-amber-500" },
    under_review:       { label: "Em revisão",      wrap: "bg-blue-50 text-blue-700",         dot: "bg-blue-500" },
    inactive:           { label: "Inativo",         wrap: "bg-gray-100 text-gray-500",        dot: "bg-gray-400" },
    closed:             { label: "Encerrado",       wrap: "bg-rose-50 text-rose-700",         dot: "bg-rose-500" },
    archived_duplicate: { label: "Duplicado",       wrap: "bg-gray-100 text-gray-500",        dot: "bg-gray-400" },
  };

  return (
    <DashboardPageShell
      title="Publicações"
      className="overflow-visible"
      panelClassName="overflow-visible"
      style={{ fontFamily: '"Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="mobile-hide-scrollbar mb-5 flex gap-2 overflow-x-auto md:mb-7 md:items-center xl:overflow-visible" data-dashboard-tour="publicacoes-filtros">
        <div className="relative min-w-[220px] flex-1 md:flex-none xl:w-[240px] xl:flex-shrink-0">
          <Search size={16} strokeWidth={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E87]" />
          <input
            type="text"
            placeholder="Buscar publicação"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-full border border-black/[0.08] bg-white pl-9 pr-3 text-[12px] font-semibold text-[#111111] shadow-[0_8px_18px_rgba(17,17,17,0.035)] outline-none transition-all duration-200 placeholder:text-[#8E8E87] hover:border-black/15"
          />
        </div>

        {[
          { key: "all" as TabFilter, label: "Status", value: "Todos", count: all.length },
          { key: "active" as TabFilter, label: "Ativos", value: activeCount.toString(), count: activeCount },
          { key: "draft" as TabFilter, label: "Rascunhos", value: draftCount.toString(), count: draftCount },
          { key: "archived" as TabFilter, label: "Arquivados", value: archivedCount.toString(), count: archivedCount },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[12px] font-semibold transition-all duration-200 ${
              tab === item.key
                ? "border-[#2563EB] bg-[#2563EB] text-white shadow-[0_6px_14px_rgba(37,99,235,0.16)]"
                : "border-black/[0.08] bg-white text-[#111111] hover:border-black/15 hover:bg-[#F7F7F8]"
            }`}
          >
            <span className={tab === item.key ? "text-white/65" : "text-[#8E8E87]"}>{item.label}</span>
            <span>{item.key === "all" ? item.value : item.count}</span>
            <ChevronDown size={14} strokeWidth={1.8} />
          </button>
        ))}

        <div className="hidden xl:block xl:flex-1" />

        <div className="hidden shrink-0 items-center gap-1 rounded-full border border-black/[0.08] bg-white p-1 shadow-[0_8px_18px_rgba(17,17,17,0.035)] sm:flex">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
              viewMode === "grid" ? "bg-[#EFEFEB] text-[#111111]" : "text-[#8E8E87] hover:bg-[#F7F7F8]"
            }`}
            aria-label="Visualizar em grade"
          >
            <Grid3x3 size={15} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
              viewMode === "list" ? "bg-[#EFEFEB] text-[#111111]" : "text-[#8E8E87] hover:bg-[#F7F7F8]"
            }`}
            aria-label="Visualizar em lista"
          >
            <List size={15} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-7 overflow-visible md:grid-cols-3 md:gap-x-5 md:gap-y-9 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square w-full rounded-[3px] bg-[#ECECE9]" />
              <div className="mt-5 h-3 w-24 rounded-full bg-[#E4E4E1]" />
              <div className="mt-3 h-4 w-4/5 rounded-full bg-[#E4E4E1]" />
              <div className="mt-2 h-4 w-2/3 rounded-full bg-[#E4E4E1]" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-[#F7F7F8]/45 p-6 text-center">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#9CA3AF] shadow-[0_10px_24px_rgba(17,17,17,0.06)]">
            <Package size={21} strokeWidth={1.7} />
          </div>
          <p className="mt-4 text-[14px] font-semibold tracking-[-0.03em] text-[#111111]">Nenhuma publicação encontrada</p>
          <p className="mt-1 text-[12px] font-medium text-[#777771]">Ajuste os filtros ou publique um produto pelo Catálogo Velo.</p>
        </div>
      ) : viewMode === "list" ? (
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          {filtered.map((pub, index) => {
            const status = pub.status || "pending";
            const preset = statusPresets[status] ?? statusPresets.pending;
            const retailPrice = pub.price ?? 0;
            const mlHref = normalizeExternalUrl(pub.permalink);

            return (
              <button
                key={pub.id}
                type="button"
                onClick={() => openExternal(mlHref, "O anúncio do Mercado Livre ainda não possui link disponível.")}
                data-dashboard-tour={index === 0 ? "publicacoes-card" : undefined}
                className="group grid w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#EFEFEB] p-3 text-left transition-colors last:border-b-0 hover:bg-[#F7F7F8]"
              >
                <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-[3px] bg-[#EFEFEC]">
                  {pub.thumbnail ? (
                    <img src={pub.thumbnail} alt={pub.title} className="h-full w-full object-contain p-1 mix-blend-multiply" />
                  ) : (
                    <Package size={18} strokeWidth={1.8} className="text-[#9CA3AF]" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-semibold tracking-[-0.03em] text-[#111111] group-hover:text-[#2563EB]">
                    {pub.title}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[12px] font-semibold tracking-[-0.025em] text-[#111111]">{formatBRL(retailPrice)}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${preset.wrap}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${preset.dot}`} />
                      {preset.label}
                    </span>
                    <span className="rounded-full bg-[#EFEFEB] px-2 py-0.5 text-[9px] font-medium text-[#6A6A64]">Mercado Livre</span>
                  </div>
                </div>
                <ArrowUpRight size={16} strokeWidth={2} className="text-[#8E8E87] transition-colors group-hover:text-[#2563EB]" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-7 overflow-visible md:grid-cols-3 md:gap-x-5 md:gap-y-9 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {filtered.map((pub, index) => {
            const status = pub.status || "pending";
            const preset = statusPresets[status] ?? statusPresets.pending;
            const retailPrice = pub.price ?? 0;
            const wholesalePrice = pub.cost_price ?? 0;
            const mlHref = normalizeExternalUrl(pub.permalink);
            const supplierUrl = normalizeExternalUrl(pub.supplier_url ?? pub.cj_product_url);
            const deleting = deletingId === pub.id;

            return (
              <article
                key={pub.id}
                data-dashboard-tour={index === 0 ? "publicacoes-card" : undefined}
                className="group min-w-0 bg-transparent transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="relative aspect-square overflow-hidden rounded-[3px] bg-[#EFEFEC]">
                  <button
                    type="button"
                    onClick={() => navigate(`/dashboard/publicacoes/${pub.id}`)}
                    className="block h-full w-full"
                    aria-label={`Abrir publicação ${pub.title}`}
                  >
                    {pub.thumbnail ? (
                      <img
                        src={pub.thumbnail}
                        alt={pub.title}
                        className="h-full w-full object-contain p-4 mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.035] md:p-5"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-[#9CA3AF]">
                        <Package size={30} strokeWidth={1.6} />
                      </span>
                    )}
                  </button>
                  <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[9px] font-semibold backdrop-blur-sm ${preset.wrap}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${preset.dot}`} />
                    {preset.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenActionId((current) => current === pub.id ? null : pub.id)}
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-white/95 text-[#111111] shadow-[0_4px_12px_rgba(17,24,39,0.12)] backdrop-blur-sm transition-transform hover:text-[#2563EB] active:scale-90"
                    aria-label="Mais ações"
                  >
                    <MoreHorizontal size={15} strokeWidth={2} />
                  </button>
                  {openActionId === pub.id ? (
                    <div className="absolute right-2 top-11 z-20 w-32 overflow-hidden rounded-xl border border-black/10 bg-white py-1 text-[#111111] shadow-[0_12px_30px_rgba(17,24,39,0.16)]">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionId(null);
                          navigate(`/dashboard/publicacoes/${pub.id}`);
                        }}
                        className="flex h-9 w-full items-center gap-2 px-3 text-left text-[11px] font-semibold transition hover:bg-[#F7F7F8]"
                      >
                        <Pencil size={13} strokeWidth={1.9} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionId(null);
                          void handleDeletePublication(pub);
                        }}
                        disabled={deleting}
                        className="flex h-9 w-full items-center gap-2 px-3 text-left text-[11px] font-semibold text-[#B91C1C] transition hover:bg-[#FEF2F2] disabled:cursor-wait disabled:opacity-60"
                      >
                        <Trash2 size={13} strokeWidth={1.9} />
                        {deleting ? "Excluindo" : "Excluir"}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="pt-3">
                  <div className="text-[12px] font-semibold tracking-[-0.025em] text-[#111111]">
                    {formatBRL(retailPrice)}
                    {wholesalePrice > 0 ? (
                      <span className="ml-1.5 text-[10px] font-medium text-[#777771]">custo {formatBRL(wholesalePrice)}</span>
                    ) : null}
                  </div>

                  <h2 className="mt-1 line-clamp-2 min-h-[36px] text-[13px] font-semibold leading-[18px] tracking-[-0.03em] text-[#111111] transition-colors group-hover:text-[#2563EB]">
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/publicacoes/${pub.id}`)}
                      className="text-left"
                    >
                      {pub.title}
                    </button>
                  </h2>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1">
                    <span className="rounded-full bg-[#EFEFEB] px-1.5 py-0.5 text-[8.5px] font-medium text-[#6A6A64]">
                      Mercado Livre
                    </span>
                    <span className="rounded-full bg-[#EFEFEB] px-1.5 py-0.5 text-[8.5px] font-medium text-[#6A6A64]">
                      {pub.ml_item_id ? `ML ${pub.ml_item_id.slice(0, 8)}` : "Sem ID ML"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openExternal(mlHref, "O anúncio do Mercado Livre ainda não possui link disponível.")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] bg-white text-[#111111] transition-colors hover:bg-[#F4F4F1]"
                      aria-label="Abrir anúncio no Mercado Livre"
                    >
                      <ExternalLink size={13} strokeWidth={1.9} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openExternal(supplierUrl, "Este produto ainda não possui link de fornecedor.")}
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#2563EB] px-2.5 text-[10.5px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
                    >
                      Ver no fornecedor
                      <ArrowUpRight size={12} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </DashboardPageShell>
  );
};

export default PublicationsPage;
