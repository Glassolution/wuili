import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Search, ChevronDown, Grid3x3, List, Settings, MoreHorizontal, Package, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

type TabFilter = "all" | "active" | "draft" | "archived";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ─── Page ─────────────────────────────────────────────────────────────────────
const PublicationsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // ── Query ──────────────────────────────────────────────────────────────────
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
      return (data ?? []) as Publication[];
    },
  });

  const all = publications ?? [];

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
    <div className="flex min-h-0 flex-1 flex-col" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      
      {/* ── Header with Tabs and Filters ──────────────────────────────────── */}
      <div className="flex flex-col gap-3 pb-4">
        
        {/* Top Row: Tabs + View Settings */}
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          {/* Tabs */}
          <div className="mobile-hide-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {[
              { key: "all" as TabFilter, label: "Todos", icon: Grid3x3 },
              { key: "active" as TabFilter, label: "Ativos" },
              { key: "draft" as TabFilter, label: "Rascunhos" },
              { key: "archived" as TabFilter, label: "Arquivados" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  tab === t.key
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ letterSpacing: "-0.01em" }}
              >
                {t.icon && <t.icon size={14} strokeWidth={1.8} />}
                {t.label}
              </button>
            ))}
            
            <button className="ml-2 hidden items-center gap-1 px-2 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-black/[0.02] sm:flex" style={{ letterSpacing: "-0.01em", borderRadius: "6px" }}>
              <span>+</span>
              <span>Visualização</span>
            </button>
          </div>

          {/* View Settings */}
          <button className="hidden items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-black/[0.02] md:flex" style={{ letterSpacing: "-0.01em", borderRadius: "6px" }}>
            <Settings size={14} strokeWidth={1.8} />
            <span>Configurações de visualização</span>
          </button>
        </div>

        {/* Second Row: Search + Filters + View Icons */}
        <div className="mobile-hide-scrollbar grid grid-cols-2 gap-2 pb-1 sm:flex sm:items-center sm:gap-2 sm:overflow-x-auto">
          {/* Search */}
          <div className="relative col-span-2 min-w-0 sm:min-w-[190px] sm:flex-1 sm:max-w-[240px]">
            <Search size={14} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-black/[0.08] bg-white pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-black/[0.12] focus:outline-none focus:ring-0"
              style={{ letterSpacing: "-0.01em" }}
            />
          </div>

          {/* Category Dropdown */}
          <button className="flex h-9 min-w-0 shrink-0 items-center justify-between gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-black/[0.02] sm:justify-start" style={{ letterSpacing: "-0.01em" }}>
            <span className="truncate">Categoria</span>
            <ChevronDown size={14} strokeWidth={1.8} />
          </button>

          {/* Dropshipping Dropdown */}
          <button className="flex h-9 min-w-0 shrink-0 items-center justify-between gap-1.5 rounded-lg border border-black/[0.08] bg-black px-3 text-[13px] font-medium text-white transition-colors hover:bg-black/90 sm:justify-start" style={{ letterSpacing: "-0.01em" }}>
            <span className="truncate">Dropshipping</span>
            <ChevronDown size={14} strokeWidth={1.8} />
          </button>

          {/* Advance Filter */}
          <button className="col-span-2 flex h-9 min-w-0 shrink-0 items-center justify-between gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-black/[0.02] sm:col-span-1 sm:justify-start" style={{ letterSpacing: "-0.01em" }}>
            <span className="truncate">Filtro avançado</span>
            <ChevronDown size={14} strokeWidth={1.8} />
          </button>

          {/* Spacer */}
          <div className="hidden flex-1 md:block" />

          {/* View Mode Icons */}
          <div className="hidden items-center gap-1 sm:flex">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                viewMode === "grid" ? "bg-black/[0.06]" : "hover:bg-black/[0.02]"
              }`}
            >
              <Grid3x3 size={16} strokeWidth={1.8} className="text-foreground" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                viewMode === "list" ? "bg-black/[0.06]" : "hover:bg-black/[0.02]"
              }`}
            >
              <List size={16} strokeWidth={1.8} className="text-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Products Grid ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[280px] animate-pulse rounded-2xl border border-black/[0.05] bg-white" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20">
          <Package size={48} strokeWidth={1.5} className="text-muted-foreground/30" />
          <p className="mt-4 text-[15px] font-medium text-foreground">Nenhum produto encontrado</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Tente ajustar seus filtros</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pub) => {
            const status = pub.status || "pending";
            const preset = statusPresets[status] ?? statusPresets.pending;
            const retailPrice = pub.price ?? 0;
            const wholesalePrice = pub.cost_price ?? 0;

            return (
              <div
                key={pub.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-black/[0.05] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
              >
                {/* Header: Image + Title + Menu */}
                <div className="flex items-start gap-3">
                  {/* Product Image */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                    {pub.thumbnail ? (
                      <img src={pub.thumbnail} alt={pub.title} className="h-full w-full object-cover" />
                    ) : (
                      <Package size={20} strokeWidth={1.8} className="text-muted-foreground/40" />
                    )}
                  </div>

                  {/* Title + Menu */}
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-[14px] font-medium leading-snug text-foreground" style={{ letterSpacing: "-0.01em" }}>
                      {pub.title}
                    </h3>
                    <button className="shrink-0 rounded-md p-1 transition-colors hover:bg-black/[0.04]">
                      <MoreHorizontal size={16} strokeWidth={1.8} className="text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* SKU + Status Badge */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[12px] text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                    SKU {pub.ml_item_id?.slice(0, 8) || "N/A"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${preset.wrap}`}
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${preset.dot}`} />
                    {preset.label}
                  </span>
                </div>

                {/* Tags */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700" style={{ letterSpacing: "-0.01em" }}>
                    Eletrônico
                  </span>
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700" style={{ letterSpacing: "-0.01em" }}>
                    +2
                  </span>
                  <span className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700" style={{ letterSpacing: "-0.01em" }}>
                    <Package size={10} strokeWidth={1.8} />
                    Dropship
                  </span>
                </div>

                {/* Prices */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                      Varejo
                    </p>
                    <p className="mt-0.5 text-[15px] font-semibold text-foreground" style={{ letterSpacing: "-0.02em" }}>
                      {formatBRL(retailPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                      Atacado
                    </p>
                    <p className="mt-0.5 text-[15px] font-semibold text-foreground" style={{ letterSpacing: "-0.02em" }}>
                      {formatBRL(wholesalePrice)}
                    </p>
                  </div>
                </div>

                {/* Footer: Action Button */}
                <div className="mt-4 flex items-center justify-between border-t border-black/[0.04] pt-3">
                  <span className="text-[12px] text-muted-foreground" style={{ letterSpacing: "-0.01em" }}>
                    {pub.ml_item_id ? `ML: ${pub.ml_item_id}` : "Sem ID ML"}
                  </span>
                  <button
                    onClick={() => navigate(`/dashboard/publicacoes/${pub.id}`)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-black/[0.08] bg-white transition-colors hover:bg-black/[0.02]"
                  >
                    <ExternalLink size={14} strokeWidth={1.8} className="text-foreground" />
                  </button>
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
