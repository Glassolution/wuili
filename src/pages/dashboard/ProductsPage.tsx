import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  MoreHorizontal,
  Package,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import ImportProductModal, { type CatalogProduct } from "@/components/dashboard/ImportProductModal";
import PlatformIntegrationModal from "@/components/dashboard/PlatformIntegrationModal";
import SupplierCompareModal from "@/components/dashboard/SupplierCompareModal";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuth } from "@/contexts/AuthContext";
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

type StockFilter = "all" | "in_stock" | "out_of_stock";
type DatePreset = "all" | "7d" | "30d" | "90d" | "custom";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const normalizeKey = (v: string) => v.toLowerCase().replace(/[\s_-]+/g, "");

const PLATFORM_PRESETS: Array<{ key: string; label: string }> = [
  { key: "cj", label: "CJ Dropshipping" },
  { key: "aliexpress", label: "AliExpress" },
  { key: "amazon", label: "Amazon" },
  { key: "shopee", label: "Shopee" },
  { key: "mercadolivre", label: "Mercado Livre" },
  { key: "tiktok", label: "TikTok Shop" },
  { key: "temu", label: "Temu" },
  { key: "ebay", label: "eBay" },
  { key: "lazada", label: "Lazada" },
];

const toISODateInput = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatRangeLabel = (from: Date | null, to: Date | null, preset: DatePreset) => {
  if (preset === "all") return "Data";
  if (preset === "7d") return "Últimos 7 dias";
  if (preset === "30d") return "Últimos 30 dias";
  if (preset === "90d") return "Últimos 90 dias";
  if (!from || !to) return "Data";
  return `${from.toLocaleDateString("pt-BR")} - ${to.toLocaleDateString("pt-BR")}`;
};

const ProductsPage = () => {
  const { user } = useAuth();
  const planLimits = usePlanLimits();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todos");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [platform, setPlatform] = useState<string>("all");

  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [compareProductId, setCompareProductId] = useState<string | null>(null);
  const [compareProductTitle, setCompareProductTitle] = useState("");

  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);

  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const platformDropdownRef = useRef<HTMLDivElement>(null);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(target)) setDateDropdownOpen(false);
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(target)) setStatusDropdownOpen(false);
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(target)) setCategoryDropdownOpen(false);
      if (platformDropdownRef.current && !platformDropdownRef.current.contains(target)) setPlatformDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["catalog", category, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "80" }); // limite maior para filtros client-side
      if (category !== "todos") params.set("category", category);
      if (search) params.set("search", search);
      const url = `https://${projectId}.supabase.co/functions/v1/catalog?${params}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${anonKey}` } });
      if (!res.ok) throw new Error("Falha ao buscar catálogo");
      return res.json();
    },
  });

  const importedIdsQuery = useQuery({
    queryKey: ["imported-product-ids", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_publications")
        .select("cj_product_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      const ids = (data || [])
        .map((r) => r.cj_product_id)
        .filter((v): v is string => typeof v === "string" && !!v);
      return new Set(ids);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("cj-sync-request");
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (res) => {
      const count = res?.synced ?? 0;
      toast.success(count > 0 ? `${count} produtos sincronizados!` : "Sincronização concluída.");
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      queryClient.refetchQueries({ queryKey: ["catalog"] });
    },
    onError: (err: Error) => toast.error(`Erro ao sincronizar: ${err.message}`),
  });

  const rawProducts: CatalogProduct[] = data?.products || [];
  const importedIds = importedIdsQuery.data ?? new Set<string>();

  const availablePlatforms = useMemo(() => {
    const keys = new Set<string>();
    for (const p of rawProducts as any[]) {
      if (!p?.source) continue;
      keys.add(normalizeKey(String(p.source)));
    }

    const presetMap = new Map(PLATFORM_PRESETS.map((p) => [p.key, p.label]));
    const merged: Array<{ key: string; label: string }> = [
      ...PLATFORM_PRESETS.filter((p) => keys.has(p.key)),
      ...Array.from(keys)
        .filter((k) => !presetMap.has(k))
        .map((k) => ({ key: k, label: k })),
    ];

    // Se não houver dados, ainda assim exibe a lista “completa”.
    if (merged.length === 0) return PLATFORM_PRESETS;

    // Mantém ordem premium: presets primeiro, depois o resto.
    return merged;
  }, [rawProducts]);

  const filtered = useMemo(() => {
    let list = [...rawProducts] as any[];

    if (platform !== "all") list = list.filter((p) => normalizeKey(String(p.source || "")) === platform);

    if (stockFilter === "in_stock") list = list.filter((p) => (p.stock_quantity || 0) > 0);
    if (stockFilter === "out_of_stock") list = list.filter((p) => (p.stock_quantity || 0) <= 0);

    if (dateFrom && dateTo) {
      const fromTs = startOfDay(dateFrom).getTime();
      const toTs = startOfDay(dateTo).getTime() + 86400000 - 1;
      list = list.filter((p) => {
        if (!p.created_at) return false;
        const ts = new Date(p.created_at).getTime();
        return ts >= fromTs && ts <= toTs;
      });
    }

    return list;
  }, [rawProducts, platform, stockFilter, importedIds, dateFrom, dateTo]);

  const getImage = (images: any): string | null => {
    try {
      const arr = typeof images === "string" ? JSON.parse(images) : images;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    } catch {
      return null;
    }
  };

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const activeCategoryLabel = CATEGORIES.find((c) => c.key === category)?.label ?? "Todos";

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="truncate text-[22px] font-bold tracking-tight text-foreground sm:text-2xl">Dropshipping</h2>
          <button
            onClick={() => toast.info("Atalhos em breve")}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Mais ações"
            type="button"
          >
            <MoreHorizontal size={18} />
          </button>
          <button
            onClick={() => syncMutation.mutate()}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            disabled={syncMutation.isPending}
            title="Sincronizar catálogo"
            type="button"
          >
            <RefreshCw size={15} className={syncMutation.isPending ? "animate-spin" : ""} />
          </button>
        </div>
        <button
          onClick={() => setIsIntegrationModalOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:w-auto"
          type="button"
        >
          Integração de Plataforma
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Subtitle */}
      <p className="-mt-1 text-sm text-muted-foreground sm:-mt-3">Encontre produtos e importe para sua loja</p>

      {/* Filtros do topo (mantém) */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        {/* Evita overflow para não cortar dropdowns */}
        <div className="-mx-3 relative z-30 flex flex-wrap gap-2 px-3 pb-1 sm:mx-0 sm:px-0">
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
          <div className="relative shrink-0" ref={dateDropdownRef}>
            <button
              onClick={() => setDateDropdownOpen((v) => !v)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
              type="button"
            >
              <Calendar size={13} />
              {formatRangeLabel(dateFrom, dateTo, datePreset)}
              <ChevronDown size={13} className={`transition-transform ${dateDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dateDropdownOpen && (
              <div className="absolute left-0 top-full z-[100] mt-2 w-64 rounded-2xl border border-border bg-background p-2 shadow-lg">
                <div className="space-y-1">
                  {[
                    { key: "all" as const, label: "Tudo" },
                    { key: "7d" as const, label: "Últimos 7 dias" },
                    { key: "30d" as const, label: "Últimos 30 dias" },
                    { key: "90d" as const, label: "Últimos 90 dias" },
                    { key: "custom" as const, label: "Personalizado" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setDatePreset(opt.key);
                        if (opt.key === "all") {
                          setDateFrom(null);
                          setDateTo(null);
                          setDateDropdownOpen(false);
                          return;
                        }
                        if (opt.key === "custom") return; // mantém aberto para inputs

                        const now = new Date();
                        const days = opt.key === "7d" ? 7 : opt.key === "30d" ? 30 : 90;
                        const from = new Date(now);
                        from.setDate(now.getDate() - (days - 1));
                        setDateFrom(from);
                        setDateTo(now);
                        setDateDropdownOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                        datePreset === opt.key
                          ? "bg-foreground/5 font-semibold text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      type="button"
                    >
                      {opt.label}
                      {datePreset === opt.key && <Check size={14} />}
                    </button>
                  ))}
                </div>

                {datePreset === "custom" && (
                  <div className="mt-2 rounded-xl border border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Intervalo</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                        value={dateFrom ? toISODateInput(dateFrom) : ""}
                        onChange={(e) => setDateFrom(e.target.value ? new Date(e.target.value) : null)}
                      />
                      <input
                        type="date"
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                        value={dateTo ? toISODateInput(dateTo) : ""}
                        onChange={(e) => setDateTo(e.target.value ? new Date(e.target.value) : null)}
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (!dateFrom || !dateTo) {
                          toast.error("Selecione data inicial e final");
                          return;
                        }
                        setDateDropdownOpen(false);
                      }}
                      className="mt-2 w-full rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background hover:opacity-90"
                      type="button"
                    >
                      Aplicar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="relative shrink-0" ref={statusDropdownRef}>
            <button
              onClick={() => setStatusDropdownOpen((v) => !v)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
              type="button"
            >
              Status <ChevronDown size={13} className={`transition-transform ${statusDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {statusDropdownOpen && (
              <div className="absolute left-0 top-full z-[100] mt-2 w-56 rounded-2xl border border-border bg-background p-2 shadow-lg">
                {[
                  { key: "all" as const, label: "Todos" },
                  { key: "in_stock" as const, label: "Em estoque" },
                  { key: "out_of_stock" as const, label: "Sem estoque" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setStockFilter(opt.key);
                      setStatusDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                      stockFilter === opt.key
                        ? "bg-foreground/5 font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    type="button"
                  >
                    {opt.label}
                    {stockFilter === opt.key && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Categoria */}
          <div className="relative shrink-0" ref={categoryDropdownRef}>
            <button
              onClick={() => setCategoryDropdownOpen((v) => !v)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                categoryDropdownOpen || category !== "todos"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
              type="button"
            >
              {activeCategoryLabel}
              <ChevronDown size={13} className={`transition-transform ${categoryDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {categoryDropdownOpen && (
              <div className="absolute left-0 top-full z-[100] mt-2 w-60 rounded-2xl border border-border bg-background p-2 shadow-lg">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => {
                      setCategory(c.key);
                      setCategoryDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                      category === c.key
                        ? "bg-foreground/5 font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    type="button"
                  >
                    {c.label}
                    {category === c.key && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Plataforma */}
          <div className="relative shrink-0" ref={platformDropdownRef}>
            <button
              onClick={() => setPlatformDropdownOpen((v) => !v)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
              type="button"
            >
              Plataforma <ChevronDown size={13} className={`transition-transform ${platformDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {platformDropdownOpen && (
              <div className="absolute left-0 top-full z-[100] mt-2 w-56 rounded-2xl border border-border bg-background p-2 shadow-lg">
                <button
                  onClick={() => {
                    setPlatform("all");
                    setPlatformDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                    platform === "all"
                      ? "bg-foreground/5 font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  type="button"
                >
                  Todas
                  {platform === "all" && <Check size={14} />}
                </button>
                {availablePlatforms.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => {
                      setPlatform(p.key);
                      setPlatformDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                      platform === p.key
                        ? "bg-foreground/5 font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    type="button"
                  >
                    {p.label}
                    {platform === p.key && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[360px] animate-pulse rounded-2xl border border-border bg-muted/20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package size={48} className="text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium text-foreground">Nenhum produto encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ajuste os filtros ou clique em sincronizar para atualizar o catálogo.
          </p>
        </div>
      ) : (
        <div className="relative z-0 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 [grid-auto-rows:1fr]">
          {filtered.map((p: any) => {
            const img = getImage(p.images);
            const outOfStock = !p.stock_quantity || p.stock_quantity <= 0;
            const categoryLabel = p.category
              ? String(p.category).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
              : null;
            const imported = importedIds.has(String(p.external_id));
            return (
              <div
                key={p.id}
                className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-background transition-shadow hover:shadow-md ${
                  outOfStock ? "opacity-80" : ""
                }`}
              >
                {/* Product image (maior, centralizada e object-contain) */}
                <div className="relative flex aspect-[4/5] shrink-0 items-center justify-center overflow-hidden bg-[#f5f5f5] p-4 dark:bg-muted/50">
                  {img ? (
                    <img
                      src={img}
                      alt={p.title}
                      className={`h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03] ${
                        outOfStock ? "grayscale" : ""
                      }`}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <Package size={34} className="text-muted-foreground/30" />
                  )}

                  {/* Badges */}
                  <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                    {imported ? (
                      <span className="rounded-full bg-foreground px-2.5 py-0.5 text-[11px] font-bold text-background shadow-sm">
                        Importado
                      </span>
                    ) : (
                      <span />
                    )}
                    {categoryLabel && (
                      <span className="max-w-[150px] truncate rounded-full border border-black/5 bg-white/90 px-2.5 py-0.5 text-[10.5px] font-medium text-foreground/80 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-zinc-900/85 dark:text-zinc-200">
                        {categoryLabel}
                      </span>
                    )}
                  </div>

                  {outOfStock && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                      <span className="rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-lg">
                        Sem estoque
                      </span>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">{p.source || "Fornecedor"}</span>
                    {typeof p.rating === "number" && (
                      <span className="text-[11px] font-semibold text-foreground">
                        ★ {Number(p.rating).toFixed(1)}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-[1.35] text-foreground">
                    {p.title}
                  </p>

                  <div className="mt-3 flex items-start justify-between">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Custo</p>
                      <p className="mt-0.5 text-[13.5px] font-bold text-foreground">{formatPrice(p.cost_price)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">Venda sugerida</p>
                      <p className="mt-0.5 text-[13.5px] font-bold text-foreground">
                        {formatPrice(p.suggested_price)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto pt-3 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedProduct(p);
                        setIsImportModalOpen(true);
                      }}
                      disabled={outOfStock}
                      className="flex flex-1 items-center justify-center rounded-xl bg-foreground py-2.5 text-[13px] font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                      type="button"
                    >
                      {outOfStock ? "Indisponível" : "Importar produto"}
                    </button>
                    <button
                      onClick={() => {
                        setCompareProductId(p.id);
                        setCompareProductTitle(p.title);
                      }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted"
                      title="Ver fornecedores"
                      type="button"
                    >
                      <Users size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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

      <PlatformIntegrationModal open={isIntegrationModalOpen} onClose={() => setIsIntegrationModalOpen(false)} />

      <SupplierCompareModal
        open={!!compareProductId}
        onClose={() => setCompareProductId(null)}
        productId={compareProductId || ""}
        productTitle={compareProductTitle}
      />
    </div>
  );
};

export default ProductsPage;
