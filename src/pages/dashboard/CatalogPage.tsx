import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronDown, RefreshCw, Package, ChevronLeft, ChevronRight, Check, ChevronsRight, Plug } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import ImportProductModal, { type CatalogProduct } from "@/components/dashboard/ImportProductModal";
import PlatformIntegrationModal from "@/components/dashboard/PlatformIntegrationModal";
import SupplierCompareModal from "@/components/dashboard/SupplierCompareModal";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { supabase } from "@/integrations/supabase/client";

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

const DATE_FILTERS = [
  { key: "todos", label: "Todas as datas" },
  { key: "today", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
];

const PAYMENT_STATUS_FILTERS = [
  { key: "todos", label: "Status de pagamento" },
  { key: "priced", label: "Com preço" },
  { key: "missing_price", label: "Sem preço" },
  { key: "positive_margin", label: "Margem positiva" },
  { key: "out_of_stock", label: "Sem estoque" },
];

// ── Platform badge config ─────────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  cj:           { label: "CJ Dropshipping", bg: "#FFF3E0", color: "#E65100", icon: "CJ" },
  aliexpress:   { label: "AliExpress",      bg: "#FFF0F0", color: "#E53935", icon: "AE" },
  amazon:       { label: "Amazon",          bg: "#FFF8E1", color: "#F57F17", icon: "AZ" },
  shopee:       { label: "Shopee",          bg: "#FFF3E0", color: "#EE4D2D", icon: "SP" },
  mercadolivre: { label: "Mercado Livre",   bg: "#FFFDE7", color: "#F9A825", icon: "ML" },
};

function getPlatform(source: string | null) {
  if (!source) return { label: "CJ Dropshipping", bg: "#FFF3E0", color: "#E65100", icon: "CJ" };
  return PLATFORM_CONFIG[source.toLowerCase()] ?? { label: source, bg: "#F5F5F5", color: "#555", icon: source.slice(0, 2).toUpperCase() };
}

// ── Product Card ──────────────────────────────────────────────────────────────
interface ProductCardProps {
  p: any;
  onImport: () => void;
  onCompare: () => void;
  formatPrice: (v: number) => string;
  getImage: (images: any) => string | null;
}

const ProductCard = ({ p, onImport, onCompare, formatPrice, getImage }: ProductCardProps) => {
  const img = getImage(p.images);
  const outOfStock = !p.stock_quantity || p.stock_quantity <= 0;
  const estimatedProfit = Math.max(0, Number(p.suggested_price ?? 0) - Number(p.cost_price ?? 0));

  // Keep product tags focused on the category; supplier/platform details stay hidden.
  const tags: string[] = [];
  if (p.category) {
    const cat = p.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    tags.push(cat);
  }

  return (
    <div
      className="catalog-product-card"
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#FFFFFF",
        borderRadius: "14px",
        border: "1px solid rgba(0,0,0,0.06)",
        overflow: "hidden",
        minHeight: "520px",
        transition: "box-shadow 200ms ease, border-color 200ms ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,0,0,0.10)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,0,0,0.06)";
      }}
    >
      {/* Image area */}
      <div style={{ position: "relative", backgroundColor: "#F5F5F5", height: "270px", width: "100%", overflow: "hidden", flexShrink: 0, borderTopLeftRadius: "14px", borderTopRightRadius: "14px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        {img ? (
          <img
            src={img}
            alt={p.title}
            className="catalog-product-image"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block", opacity: outOfStock ? 0.5 : 1 }}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Package size={40} style={{ color: "#D1D5DB" }} />
          </div>
        )}

        {outOfStock && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" }}>
            <span style={{ backgroundColor: "#DC2626", color: "#fff", fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Sem estoque
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "16px 16px 18px" }}>
        {/* Product title */}
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#111111", lineHeight: "1.4", letterSpacing: "-0.01em", margin: "0 0 12px 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "40px" }}>
          {p.title}
        </p>

        {/* Price + estimated profit */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 0.9fr)", gap: "12px", alignItems: "start", marginBottom: "12px" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "11px", color: "#A3A3A3", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>Preço</p>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#111111", margin: 0, letterSpacing: "-0.01em", lineHeight: "1.35" }}>
              {formatPrice(p.cost_price)} – {formatPrice(p.suggested_price)}
            </p>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "11px", color: "#A3A3A3", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>Lucro estimado</p>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#059669", margin: 0, letterSpacing: "-0.01em", lineHeight: "1.35", whiteSpace: "nowrap" }}>
              {formatPrice(estimatedProfit)}
            </p>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} style={{ display: "inline-flex", alignItems: "center", height: "24px", fontSize: "12px", fontWeight: 500, color: "#737373", backgroundColor: "#F5F5F5", padding: "0 8px", borderRadius: "8px", letterSpacing: "-0.01em" }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          <button
            onClick={onImport}
            disabled={outOfStock}
            style={{
              flex: 1,
              height: "44px",
              backgroundColor: outOfStock ? "#D1D5DB" : "#111111",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              cursor: outOfStock ? "not-allowed" : "pointer",
              transition: "background-color 150ms ease",
              fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
            onMouseEnter={(e) => { if (!outOfStock) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#000000"; }}
            onMouseLeave={(e) => { if (!outOfStock) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#111111"; }}
          >
            {outOfStock ? "Indisponível" : "Importar produto"}
          </button>
          <button
            onClick={onCompare}
            style={{
              width: "44px",
              height: "44px",
              backgroundColor: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "background-color 150ms ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F9FAFB"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FFFFFF"; }}
            title="Ver fornecedores"
          >
            <ChevronsRight size={16} strokeWidth={2} style={{ color: "#6B7280" }} />
          </button>
        </div>
      </div>
    </div>
  );
};

const CatalogPage = () => {
  const [category, setCategory] = useState("todos");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("todos");
  const [paymentStatus, setPaymentStatus] = useState("todos");
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [compareProductId, setCompareProductId] = useState<string | null>(null);
  const [compareProductTitle, setCompareProductTitle] = useState("");
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const planLimits = usePlanLimits();
  const limit = 20;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
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
      const { data, error } = await supabase.functions.invoke("cj-sync-request");
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const count = data.synced ?? 0;
      toast.success(
        count > 0
          ? `${count} produtos sincronizados com sucesso!`
          : "Sincronização concluída (nenhum produto novo encontrado)."
      );
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      queryClient.refetchQueries({ queryKey: ["catalog"] });
    },
    onError: (err: Error) => toast.error(`Erro ao sincronizar: ${err.message}`),
  });

  const rawProducts = data?.products || [];
  const totalPages = data?.totalPages || 1;

  const products = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const now = new Date();

    return rawProducts.filter((p: any) => {
      const haystack = [
        p.title,
        p.category,
        p.source,
        p.supplier_name,
        p.external_id,
      ].filter(Boolean).join(" ").toLowerCase();

      if (normalizedSearch && !haystack.includes(normalizedSearch)) return false;

      if (dateFilter !== "todos") {
        const rawDate = p.created_at || p.updated_at;
        if (!rawDate) return false;

        const productDate = new Date(rawDate);
        if (Number.isNaN(productDate.getTime())) return false;

        if (dateFilter === "today") {
          if (productDate.toDateString() !== now.toDateString()) return false;
        } else {
          const days = Number(dateFilter.replace("d", ""));
          const cutoff = new Date(now);
          cutoff.setDate(now.getDate() - days);
          if (productDate < cutoff) return false;
        }
      }

      if (paymentStatus !== "todos") {
        const hasPrice = Number(p.cost_price) > 0 && Number(p.suggested_price) > 0;
        const hasPositiveMargin = Number(p.margin_percent) > 0 || Number(p.suggested_price) > Number(p.cost_price);
        const outOfStock = !p.stock_quantity || p.stock_quantity <= 0;

        if (paymentStatus === "priced" && !hasPrice) return false;
        if (paymentStatus === "missing_price" && hasPrice) return false;
        if (paymentStatus === "positive_margin" && !hasPositiveMargin) return false;
        if (paymentStatus === "out_of_stock" && !outOfStock) return false;
      }

      if (hideUnavailable && ((!p.stock_quantity || p.stock_quantity <= 0) || p.is_active === false)) return false;

      return true;
    });
  }, [rawProducts, search, dateFilter, paymentStatus, hideUnavailable]);

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const getImage = (images: any): string | null => {
    try {
      const arr = typeof images === "string" ? JSON.parse(images) : images;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    } catch { return null; }
  };

  const activeCategoryLabel = CATEGORIES.find(c => c.key === category)?.label ?? "Todos";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        {/* Left filters */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={14} strokeWidth={1.8} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar"
              style={{
                height: "40px",
                paddingLeft: "34px",
                paddingRight: "12px",
                fontSize: "13px",
                color: "#111111",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "10px",
                outline: "none",
                width: "180px",
                letterSpacing: "-0.01em",
              }}
            />
          </div>

          {/* Date range pill */}
          <div style={{ position: "relative" }}>
            <select
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              style={{ appearance: "none", height: "40px", padding: "0 34px 0 14px", fontSize: "13px", fontWeight: 600, color: "#FFFFFF", backgroundColor: "#111111", border: "none", borderRadius: "10px", cursor: "pointer", letterSpacing: "-0.01em", whiteSpace: "nowrap", outline: "none" }}
            >
              {DATE_FILTERS.map((filter) => <option key={filter.key} value={filter.key}>{filter.label}</option>)}
            </select>
            <ChevronDown size={13} strokeWidth={2} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.7)", pointerEvents: "none" }} />
          </div>

          {/* Status de pagamento */}
          <div style={{ position: "relative" }}>
            <select
              value={paymentStatus}
              onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}
              style={{ appearance: "none", height: "40px", padding: "0 34px 0 14px", fontSize: "13px", fontWeight: 500, color: paymentStatus !== "todos" ? "#FFFFFF" : "#111111", backgroundColor: paymentStatus !== "todos" ? "#111111" : "#FFFFFF", border: `1px solid ${paymentStatus !== "todos" ? "#111111" : "#E5E7EB"}`, borderRadius: "10px", cursor: "pointer", letterSpacing: "-0.01em", whiteSpace: "nowrap", outline: "none" }}
            >
              {PAYMENT_STATUS_FILTERS.map((filter) => <option key={filter.key} value={filter.key}>{filter.label}</option>)}
            </select>
            <ChevronDown size={13} strokeWidth={1.8} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: paymentStatus !== "todos" ? "rgba(255,255,255,0.7)" : "#9CA3AF", pointerEvents: "none" }} />
          </div>

          {/* Categoria dropdown */}
          <div style={{ position: "relative" }} ref={categoryDropdownRef}>
            <button
              onClick={() => setCategoryDropdownOpen((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: "6px", height: "40px", padding: "0 14px", fontSize: "13px", fontWeight: 500, color: category !== "todos" ? "#FFFFFF" : "#111111", backgroundColor: category !== "todos" ? "#111111" : "#FFFFFF", border: `1px solid ${category !== "todos" ? "#111111" : "#E5E7EB"}`, borderRadius: "10px", cursor: "pointer", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}
            >
              <span>
                {activeCategoryLabel}
              </span>
              <ChevronDown size={13} strokeWidth={1.8} style={{ color: category !== "todos" ? "rgba(255,255,255,0.7)" : "#9CA3AF", transform: categoryDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
            </button>
            {categoryDropdownOpen && (
              <div style={{ position: "absolute", left: 0, top: "calc(100% + 6px)", zIndex: 50, minWidth: "160px", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", padding: "6px", overflow: "hidden" }}>
                {CATEGORIES.map((c) => {
                  const active = category === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => { setCategory(c.key); setPage(1); setCategoryDropdownOpen(false); }}
                      style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", fontSize: "13px", fontWeight: active ? 600 : 400, color: "#111111", backgroundColor: active ? "#F5F5F5" : "transparent", border: "none", borderRadius: "8px", cursor: "pointer", letterSpacing: "-0.01em", textAlign: "left" }}
                    >
                      {c.label}
                      {active && <Check size={12} strokeWidth={2.5} style={{ color: "#111111" }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ocultar */}
          <button
            onClick={() => { setHideUnavailable((v) => !v); setPage(1); }}
            style={{ height: "40px", padding: "0 10px", fontSize: "13px", fontWeight: 500, color: hideUnavailable ? "#FFFFFF" : "#111111", backgroundColor: hideUnavailable ? "#111111" : "transparent", border: hideUnavailable ? "1px solid #111111" : "1px solid transparent", borderRadius: "10px", cursor: "pointer", letterSpacing: "-0.01em", textDecoration: hideUnavailable ? "none" : "underline", textUnderlineOffset: "2px" }}
          >
            Ocultar
          </button>
        </div>

        {/* Right: Sincronizar + Integração */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            style={{ display: "flex", alignItems: "center", gap: "6px", height: "40px", padding: "0 14px", fontSize: "13px", fontWeight: 500, color: "#6B7280", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "10px", cursor: syncMutation.isPending ? "not-allowed" : "pointer", opacity: syncMutation.isPending ? 0.6 : 1, letterSpacing: "-0.01em" }}
          >
            <RefreshCw size={13} strokeWidth={1.8} className={syncMutation.isPending ? "animate-spin" : ""} />
            {syncMutation.isPending ? "Sincronizando..." : "Sincronizar"}
          </button>

          <button
            onClick={() => setIsIntegrationModalOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: "8px", height: "40px", padding: "0 16px", fontSize: "14px", fontWeight: 500, color: "#111111", backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "12px", cursor: "pointer", letterSpacing: "-0.01em", whiteSpace: "nowrap", transition: "background-color 150ms ease, border-color 150ms ease" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#FAFAFA";
              e.currentTarget.style.borderColor = "rgba(0,0,0,0.10)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#FFFFFF";
              e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)";
            }}
          >
            <Plug size={14} strokeWidth={1.9} style={{ color: "#6B7280" }} />
            Integrações
          </button>
        </div>
      </div>

      {/* ── Product Grid ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="catalog-products-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <Skeleton className="h-[270px] w-full rounded-none" />
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <Skeleton className="h-3.5 w-3/5 rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-3 w-4/5 rounded-md" />
                <Skeleton className="h-11 w-full rounded-[10px]" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", textAlign: "center" }}>
          <Package size={48} strokeWidth={1.5} style={{ color: "#D1D5DB", marginBottom: "16px" }} />
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#111111", margin: "0 0 6px 0" }}>Nenhum produto encontrado</p>
          <p style={{ fontSize: "13px", color: "#9CA3AF", margin: 0 }}>
            Clique em "Sincronizar" para popular o catálogo com produtos da CJ Dropshipping.
          </p>
        </div>
      ) : (
        <div className="catalog-products-grid">
          {products.map((p: any) => (
            <ProductCard
              key={p.id}
              p={p}
              onImport={() => { setSelectedProduct(p); setIsImportModalOpen(true); }}
              onCompare={() => { setCompareProductId(p.id); setCompareProductTitle(p.title); }}
              formatPrice={formatPrice}
              getImage={getImage}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", paddingTop: "8px" }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ display: "flex", alignItems: "center", gap: "4px", height: "38px", padding: "0 16px", fontSize: "13px", fontWeight: 500, color: "#111111", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "10px", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1, letterSpacing: "-0.01em" }}
          >
            <ChevronLeft size={14} /> Anterior
          </button>
          <span style={{ fontSize: "13px", color: "#9CA3AF" }}>{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ display: "flex", alignItems: "center", gap: "4px", height: "38px", padding: "0 16px", fontSize: "13px", fontWeight: 500, color: "#111111", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "10px", cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1, letterSpacing: "-0.01em" }}
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

      <SupplierCompareModal
        open={!!compareProductId}
        onClose={() => setCompareProductId(null)}
        productId={compareProductId || ""}
        productTitle={compareProductTitle}
      />

      <PlatformIntegrationModal
        open={isIntegrationModalOpen}
        onClose={() => setIsIntegrationModalOpen(false)}
      />

      <style>{`
        .catalog-products-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 20px;
          align-items: stretch;
        }

        .catalog-product-image {
          transform: scale(1);
          transition: transform 300ms ease;
        }

        .catalog-product-card:hover .catalog-product-image {
          transform: scale(1.03);
        }

        @media (max-width: 1280px) {
          .catalog-products-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .catalog-products-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .catalog-products-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default CatalogPage;
