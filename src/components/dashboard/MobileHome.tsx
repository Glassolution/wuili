// Home mobile da Velo (busca, categorias, banner, atalhos e grade de produtos).
//
// Este bloco vivia dentro de DashboardHomePage.tsx e foi apagado por engano no
// commit f054ec18 ("fix: ajusta camada e desce indicador para baixo da linha"),
// que removeu 3674 linhas do arquivo. Aqui ele volta como componente próprio:
// o DashboardHomePage segue cuidando só do desktop, e os 22 commits que
// mexeram naquele arquivo depois da deleção ficam preservados.
//
// O componente é autossuficiente — busca produtos, coleções e favoritos por
// conta própria — para não acoplar de novo o mobile ao estado do desktop.
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Folder, Package, Plus, Search, Star, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { listCollectionsWithSummaries, type CollectionSummary } from "@/lib/collectionsApi";
import { veloToast } from "@/components/ui/velo-toast";
import { proxyImageList } from "@/lib/imageProxy";
import {
  ProductFavoriteButton,
  formatReviewCount,
  getProductCatalogMetrics,
} from "@/components/dashboard/ProductCard";

type CatalogProductRow = Database["public"]["Tables"]["catalog_products"]["Row"];

type ProductPreview = {
  id: string;
  title: string;
  category: string;
  image: string;
  images: string[];
  price: number;
  ordersCount: number;
  rating: number | null;
  source: string | null;
};

// Rótulo amigável da loja/fornecedor de origem (mesmo padrão do catálogo desktop).
const SOURCE_LABELS: Record<string, string> = {
  c7drop: "C7Drop",
  aliexpress: "AliExpress",
  amazon: "Amazon",
  shopee: "Shopee",
  mercadolivre: "Mercado Livre",
};

const getSourceLabel = (source: string | null): string => {
  if (!source) return SOURCE_LABELS.c7drop;
  return SOURCE_LABELS[source.toLowerCase()] ?? source;
};

const HOME_PRODUCTS_LIMIT = 1000;
const HOME_PRODUCTS_PER_PAGE = 20;
const HOME_FAVORITES_STORAGE_PREFIX = "velo:home-favorite-products";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const formatInteger = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

const getProductImages = (images: Json | null): string[] => {
  if (!images) return [];
  const collect = (input: Json | null): string[] => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.flatMap((entry) => {
        if (typeof entry === "string" && entry.trim()) return [entry.trim()];
        if (entry && typeof entry === "object" && "url" in entry) {
          const url = (entry as { url?: unknown }).url;
          return typeof url === "string" && url.trim() ? [url.trim()] : [];
        }
        return [];
      });
    }
    if (typeof input === "string") {
      try {
        return collect(JSON.parse(input) as Json);
      } catch {
        return input.trim() ? [input.trim()] : [];
      }
    }
    return [];
  };
  return proxyImageList(collect(images));
};

const mapProductPreview = (product: CatalogProductRow): ProductPreview | null => {
  const image = getProductImages(product.images)[0];
  if (!image) return null;
  return {
    id: product.id,
    title: product.title ?? "Produto",
    category: product.category?.trim() || "Outros",
    image,
    price: Number(product.cost_price) || 0,
    ordersCount: Number(product.orders_count) || 0,
    rating: toCatalogMetricNumber(product.rating),
    source: product.source ?? null,
  };
};

const mobileTabs = [
  { label: "Tudo", value: "Todos os produtos" },
  { label: "Casa", value: "Casa" },
  { label: "Eletrônicos", value: "Eletrônicos" },
  { label: "Moda", value: "Moda" },
  { label: "Beleza", value: "Beleza" },
  { label: "Decoração", value: "Decoração" },
  { label: "Pet", value: "Pet" },
  { label: "Outros", value: "Outros" },
];

const mobileVeloActionItems = [
  { label: "Comunidade", image: "/assets/mobile-action-comunidade.png", to: "/docs" },
  { label: "Coleções", image: "/assets/mobile-action-colecoes.png", to: "/colecoes" },
  { label: "Publicações", image: "/assets/mobile-action-publicacoes.png", to: "/dashboard/publicacoes" },
  { label: "Relatórios", image: "/assets/mobile-action-relatorios.png", to: "/dashboard/relatorios" },
] as const;

const MOBILE_HOME_CATEGORY_OPTIONS = [
  "Todos os produtos",
  "Casa",
  "Eletrônicos",
  "Moda",
  "Bijuterias",
  "Decoração",
  "Bebê e Infantil",
  "Pet",
  "Beleza",
  "Saúde e Bem-estar",
  "Esporte e Fitness",
  "Outros",
];
const MOBILE_HOME_PRICE_OPTIONS = ["Todos os preços", "Até R$ 50", "R$ 50-150", "Acima de R$ 150"];
const MOBILE_HOME_RATING_OPTIONS = ["Todas", "4+ estrelas", "4.5+ estrelas"];

const toCatalogMetricNumber = (value: unknown) => {
  const numberValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : Number.NaN;

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
};

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const matchesMobileHomePriceFilter = (price: number, filter: string) => {
  if (filter === "Até R$ 50") return price <= 50;
  if (filter === "R$ 50-150") return price > 50 && price <= 150;
  if (filter === "Acima de R$ 150") return price > 150;
  return true;
};

const matchesMobileHomeRatingFilter = (rating: number | null, filter: string) => {
  if (filter === "4+ estrelas") return rating !== null && rating >= 4;
  if (filter === "4.5+ estrelas") return rating !== null && rating >= 4.5;
  return true;
};


const MobileHomeFilterDropdown = ({
  label,
  value,
  isOpen,
  options,
  onToggle,
  onSelect,
}: {
  label: string;
  value: string;
  isOpen: boolean;
  options: string[];
  onToggle: () => void;
  onSelect: (value: string) => void;
}) => (
  <div className="relative min-w-[148px]">
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-full border border-[#D1D5DB] bg-white px-3 text-[11px] font-semibold text-[#111111] shadow-sm transition-colors hover:border-[#9CA3AF]"
    >
      <span className="truncate">{label}: {value}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} strokeWidth={1.8} />
    </button>

    {isOpen && (
      <div className="absolute left-0 top-[calc(100%+8px)] z-40 min-w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-[0_16px_32px_rgba(17,24,39,0.10)]">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${
              value === option ? "bg-[#F3F4F6] font-semibold text-[#111111]" : "text-[#4B5563] hover:bg-[#F9FAFB]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    )}
  </div>
);

const MobileProductCard = ({
  product,
  isFavorite,
  onToggleFavorite,
}: {
  product: ProductPreview;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) => {
  const navigate = useNavigate();
  const { rating, ordersCount, hasMetrics } = getProductCatalogMetrics(product);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <article className="relative min-w-0 overflow-hidden rounded-[8px] border border-black/[0.08] bg-white text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <span className="absolute left-2 top-2 z-10 max-w-[70%] truncate rounded-[4px] bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
        {getSourceLabel(product.source)}
      </span>
      <button
        type="button"
        onClick={() => navigate(`/dashboard/catalogo/${product.id}`)}
        className="block w-full text-left"
      >
        <div className="aspect-square overflow-hidden bg-[#F3F3F3] flex items-center justify-center">
          {!imgFailed && product.image ? (
            <img
              src={product.image}
              alt={product.title}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              loading="eager"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <Package size={32} strokeWidth={1.4} className="text-black/20" />
          )}
        </div>
        <div className="p-2.5">
          <div className="mb-1.5 flex flex-wrap items-center gap-1">
            <span className="max-w-full truncate rounded-[4px] bg-[#F1F1F1] px-1.5 py-0.5 text-[9px] font-bold text-black/55">
              {product.category}
            </span>
          </div>
          <p className="line-clamp-2 min-h-[36px] text-[12px] font-bold leading-[1.45] text-[#222222]">{product.title}</p>
          {hasMetrics && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-black/45">
              {rating !== null && (
                <>
                  <Star className="h-3 w-3 fill-[#111111] text-[#111111]" strokeWidth={1.8} />
                  <span className="text-[#111111]">{rating.toFixed(1)}</span>
                </>
              )}
              {rating !== null && ordersCount !== null && <span>·</span>}
              {ordersCount !== null && <span>{formatReviewCount(ordersCount)} vendidos</span>}
            </div>
          )}
          <p className="mt-2 text-[16px] font-semibold tracking-[-0.04em] text-[#111111]">{formatCurrency(product.price)}</p>
        </div>
      </button>
      <ProductFavoriteButton
        isFavorited={isFavorite}
        onToggleFavorite={onToggleFavorite}
        className="z-10"
      />
    </article>
  );
};

const MobileAliVeloHome = ({
  products,
  collections,
  favoriteProductIds,
  onToggleFavoriteProduct,
  onCreateCollection,
}: {
  products: ProductPreview[];
  collections: CollectionSummary[];
  favoriteProductIds: string[];
  onToggleFavoriteProduct: (productId: string) => void;
  onCreateCollection: () => void;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [mobileCategoryFilter, setMobileCategoryFilter] = useState(MOBILE_HOME_CATEGORY_OPTIONS[0]);
  const [mobilePriceFilter, setMobilePriceFilter] = useState(MOBILE_HOME_PRICE_OPTIONS[0]);
  const [mobileRatingFilter, setMobileRatingFilter] = useState(MOBILE_HOME_RATING_OPTIONS[0]);
  const [openMobileFilter, setOpenMobileFilter] = useState<"category" | "price" | "rating" | null>(null);
  const mobileFilterBarRef = useRef<HTMLDivElement | null>(null);
  const mobileCategoryTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const featuredProducts = useMemo(() => {
    const query = normalizeSearchText(mobileSearchQuery.trim());

    return products.filter((product) => {
      const { rating } = getProductCatalogMetrics(product);
      const matchesSearch =
        !query ||
        normalizeSearchText(product.title).includes(query) ||
        normalizeSearchText(product.category).includes(query);
      const matchesCategory =
        mobileCategoryFilter === MOBILE_HOME_CATEGORY_OPTIONS[0] || product.category === mobileCategoryFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesMobileHomePriceFilter(product.price, mobilePriceFilter) &&
        matchesMobileHomeRatingFilter(rating, mobileRatingFilter)
      );
    });
  }, [mobileCategoryFilter, mobilePriceFilter, mobileRatingFilter, mobileSearchQuery, products]);
  const firstProduct = featuredProducts[0];
  const secondProduct = featuredProducts[1] ?? firstProduct;

  const [productsPage, setProductsPage] = useState(1);
  const totalProductPages = Math.max(1, Math.ceil(featuredProducts.length / HOME_PRODUCTS_PER_PAGE));

  // Volta para a primeira página sempre que o filtro/busca muda o conjunto.
  useEffect(() => {
    setProductsPage(1);
  }, [mobileCategoryFilter, mobilePriceFilter, mobileRatingFilter, mobileSearchQuery]);

  // Corrige a página caso o total encolha (ex.: filtro reduziu a lista).
  useEffect(() => {
    setProductsPage((current) => Math.min(current, totalProductPages));
  }, [totalProductPages]);

  const pagedProducts = useMemo(() => {
    const start = (productsPage - 1) * HOME_PRODUCTS_PER_PAGE;
    return featuredProducts.slice(start, start + HOME_PRODUCTS_PER_PAGE);
  }, [featuredProducts, productsPage]);

  const productPageNumbers = useMemo(() => {
    const maxButtons = 5;
    let start = Math.max(1, productsPage - 2);
    const end = Math.min(totalProductPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [productsPage, totalProductPages]);

  const productsSectionRef = useRef<HTMLElement | null>(null);
  const goToProductsPage = (nextPage: number) => {
    setProductsPage(nextPage);
    productsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!openMobileFilter) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!mobileFilterBarRef.current?.contains(event.target as Node)) {
        setOpenMobileFilter(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openMobileFilter]);

  useEffect(() => {
    mobileCategoryTabRefs.current[mobileCategoryFilter]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [mobileCategoryFilter]);

  if (location.pathname === "/colecoes") {
    return (
      <section className="min-h-screen bg-[#F4F4F2] px-4 pb-24 pt-5 md:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase text-black/40">Organização</p>
            <h1 className="mt-1 text-[30px] font-black tracking-[-0.06em] text-[#111111]">Coleções</h1>
            <p className="mt-1 text-[13px] font-medium text-black/50">
              {collections.length} coleção{collections.length === 1 ? "" : "ões"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateCollection}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111111] px-4 text-[12px] font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            Nova
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          {collections.length > 0 ? (
            collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                onClick={() => navigate(`/dashboard/catalogo?collectionId=${encodeURIComponent(collection.id)}&collectionName=${encodeURIComponent(collection.name)}`)}
                className="flex min-h-[112px] items-center gap-4 rounded-[18px] bg-white p-4 text-left shadow-[0_1px_0_rgba(0,0,0,0.06)]"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[#F1F1F1] text-[#111111]">
                  <Folder className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-black tracking-[-0.04em] text-[#111111]">{collection.name}</span>
                  <span className="mt-1 block text-[12px] font-semibold text-black/45">{collection.productCount} produtos</span>
                </span>
                <span className="text-[22px] text-black/35">›</span>
              </button>
            ))
          ) : (
            <button
              type="button"
              onClick={onCreateCollection}
              className="rounded-[18px] border-2 border-dashed border-black/10 bg-white px-6 py-12 text-center"
            >
              <Folder className="mx-auto h-8 w-8 text-black/30" />
              <span className="mt-3 block text-[15px] font-bold text-[#111111]">Crie sua primeira coleção</span>
              <span className="mt-1 block text-[12px] text-black/45">Organize produtos para importar depois.</span>
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="md:hidden">
      <div className="min-h-screen w-full overflow-x-hidden bg-white pb-6 text-[#111111]">
        <div className="bg-[#050505] px-4 pt-4 text-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#101010] text-white"
              aria-label="Velo"
            >
              <svg aria-hidden="true" viewBox="0 0 72 72" className="h-7 w-7" fill="none">
                <path d="M49.5 24 A18 18 0 1 0 49.5 48" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                <path d="M46 42 L52 48 L58 42" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white px-3.5 text-left text-[#1F2933] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.75),0_8px_18px_rgba(0,0,0,0.2)]">
              <Search className="h-[18px] w-[18px] shrink-0 text-[#3E454D]" strokeWidth={2.2} />
              <input
                type="search"
                value={mobileSearchQuery}
                onChange={(event) => setMobileSearchQuery(event.target.value)}
                placeholder="Buscar na Velo"
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-semibold tracking-[-0.02em] text-[#1F2933] outline-none placeholder:text-[#6B7280]"
              />
              <button
                type="button"
                onClick={() => navigate("/dashboard/catalogo")}
                className="shrink-0 text-[#111111]"
                aria-label="Buscar por imagem"
              >
                <Camera className="h-[19px] w-[19px]" strokeWidth={2.25} />
              </button>
            </div>
          </div>

          <nav className="mt-3 flex gap-7 overflow-x-auto text-[16px] font-semibold tracking-[-0.03em] text-white/65 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mobileTabs.map((tab) => {
              const isActive = mobileCategoryFilter === tab.value;

              return (
                <button
                  key={tab.value}
                  ref={(node) => {
                    mobileCategoryTabRefs.current[tab.value] = node;
                  }}
                  type="button"
                  onClick={() => {
                    setMobileCategoryFilter(tab.value);
                    setOpenMobileFilter(null);
                  }}
                  className={`relative shrink-0 pb-2 transition-colors ${isActive ? "text-white" : "text-white/62"}`}
                >
                  {tab.label}
                  {isActive && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-white" />}
                </button>
              );
            })}
          </nav>
        </div>

        <section className="bg-[#050505] px-4 pb-3 pt-2">
          <button type="button" onClick={() => navigate("/dashboard/catalogo")} className="block w-full">
            <img
              src="/assets/velo_banner_sem_botao.png"
              alt="Velo - Produtos para revender"
              className="block aspect-[2.55/1] w-full rounded-[10px] object-cover"
            />
          </button>
        </section>

        <section className="hidden">
          <div className="relative min-h-[112px] overflow-hidden">
            <div className="relative z-10 max-w-[228px]">
              <div className="flex items-center gap-3">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 72 72"
                  className="h-[72px] w-[72px] shrink-0 text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.28)]"
                  fill="none"
                >
                  <path
                    d="M49.5 24 A18 18 0 1 0 49.5 48"
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <path
                    d="M46 42 L52 48 L58 42"
                    stroke="currentColor"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="h-14 w-px bg-white/25" />
                <span className="text-[18px] font-semibold uppercase tracking-[0.45em] text-white/85">Velo</span>
              </div>
              <p className="-mt-1 max-w-[220px] text-[31px] font-black uppercase leading-[0.92] tracking-[-0.06em] text-white">
                Dê um upgrade
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/dashboard/catalogo")}
              className="absolute left-[168px] top-[58px] z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#050505] shadow-[0_10px_30px_rgba(255,255,255,0.18)]"
              aria-label="Ver promoções"
            >
              <ArrowUpRight className="h-5 w-5" strokeWidth={2.6} />
            </button>

            <div className="absolute -right-6 top-0 h-full w-[178px]">
              <div className="absolute inset-y-0 right-4 w-px bg-white/25" />
              {firstProduct && (
                <img
                  src={firstProduct.image}
                  alt=""
                  className="absolute right-8 top-1 h-[82px] w-[82px] rotate-6 rounded-[18px] object-cover shadow-[0_18px_42px_rgba(0,0,0,0.6)]"
                  referrerPolicy="no-referrer"
                />
              )}
              {secondProduct && (
                <img
                  src={secondProduct.image}
                  alt=""
                  className="absolute bottom-1 left-5 h-[58px] w-[86px] -rotate-6 rounded-[15px] object-cover shadow-[0_16px_34px_rgba(0,0,0,0.55)]"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          </div>

          <div className="hidden">
            {[
              { value: "Produtos BR", label: "estoque nacional" },
              { value: "Margem alta", label: "curadoria Velo" },
              { value: "Publicar fácil", label: "ML e Shopee" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => navigate("/dashboard/catalogo")}
                className="min-h-[62px] rounded-[14px] bg-white/10 px-2 py-2 text-center"
              >
                <p className="text-[13px] font-black leading-tight tracking-[-0.04em] text-white">{item.value}</p>
                <p className="mt-0.5 text-[9px] font-bold text-white/55">{item.label}</p>
                <span className="mt-1.5 inline-flex h-6 w-full items-center justify-center rounded-full bg-white text-[9px] font-black text-[#050505]">
                  Importar
                </span>
              </button>
            ))}
          </div>
        </section>


        <div className="hidden">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#8CDD82] text-white">
              <Check className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p className="text-[17px] font-black tracking-[-0.05em] text-[#6F806F]">Fornecedores brasileiros</p>
              <p className="text-[13px] font-semibold text-[#9CA89C]">Produtos com estoque e curadoria Velo</p>
            </div>
          </div>
        </div>

        {products.length > 0 && (
          <section ref={productsSectionRef} className="scroll-mt-4 bg-white px-4 pt-5">
            <div className="mb-5 grid grid-cols-4 gap-0.5 pb-1">
              {mobileVeloActionItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="flex min-w-0 flex-col items-center text-center"
                >
                  <span className="flex h-[58px] w-[58px] items-center justify-center overflow-hidden">
                    <img
                      src={item.image}
                      alt=""
                      className="h-full w-full object-contain object-center"
                    />
                  </span>
                  <span className="line-clamp-1 max-w-full text-[10px] font-bold leading-tight tracking-[-0.02em] text-[#4A4A4A]">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="text-[22px] font-black tracking-[-0.05em] text-[#111111]">Produtos para vender</h2>
              <span className="shrink-0 text-[11px] font-bold text-black/40">
                {formatInteger(featuredProducts.length)} itens
              </span>
            </div>

            <div
              ref={mobileFilterBarRef}
              className="hidden"
            >
              <div className="relative min-w-[220px] flex-1">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
                  strokeWidth={1.8}
                />
                <input
                  type="text"
                  value={mobileSearchQuery}
                  onChange={(event) => setMobileSearchQuery(event.target.value)}
                  placeholder="Buscar produto"
                  className="h-9 w-full rounded-full border border-[#D1D5DB] bg-white pl-10 pr-3 text-[12px] font-medium text-[#111111] shadow-sm outline-none transition-colors placeholder:text-[#9CA3AF] hover:border-[#9CA3AF]"
                />
              </div>

              <MobileHomeFilterDropdown
                label="Categoria"
                value={mobileCategoryFilter}
                isOpen={openMobileFilter === "category"}
                onToggle={() => setOpenMobileFilter((current) => (current === "category" ? null : "category"))}
                options={MOBILE_HOME_CATEGORY_OPTIONS}
                onSelect={(value) => {
                  setMobileCategoryFilter(value);
                  setOpenMobileFilter(null);
                }}
              />

              <MobileHomeFilterDropdown
                label="Faixa de preço"
                value={mobilePriceFilter}
                isOpen={openMobileFilter === "price"}
                onToggle={() => setOpenMobileFilter((current) => (current === "price" ? null : "price"))}
                options={MOBILE_HOME_PRICE_OPTIONS}
                onSelect={(value) => {
                  setMobilePriceFilter(value);
                  setOpenMobileFilter(null);
                }}
              />

              <MobileHomeFilterDropdown
                label="Avaliação"
                value={mobileRatingFilter}
                isOpen={openMobileFilter === "rating"}
                onToggle={() => setOpenMobileFilter((current) => (current === "rating" ? null : "rating"))}
                options={MOBILE_HOME_RATING_OPTIONS}
                onSelect={(value) => {
                  setMobileRatingFilter(value);
                  setOpenMobileFilter(null);
                }}
              />
            </div>

            {featuredProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 pb-2">
                  {pagedProducts.map((product) => (
                    <MobileProductCard
                      key={`home-feature-${product.id}`}
                      product={product}
                      isFavorite={favoriteProductIds.includes(product.id)}
                      onToggleFavorite={() => onToggleFavoriteProduct(product.id)}
                    />
                  ))}
                </div>

                {totalProductPages > 1 && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 pb-2">
                    <button
                      type="button"
                      onClick={() => goToProductsPage(Math.max(1, productsPage - 1))}
                      disabled={productsPage === 1}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111] transition-colors active:bg-[#F1F1F3] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft size={16} strokeWidth={2} />
                    </button>

                    {productPageNumbers.map((pageNumber) => (
                      <button
                        key={`home-page-${pageNumber}`}
                        type="button"
                        onClick={() => goToProductsPage(pageNumber)}
                        className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-2.5 text-[13px] font-bold transition-colors ${
                          productsPage === pageNumber
                            ? "border-[#111111] bg-[#111111] text-white"
                            : "border-[#E5E7EB] bg-white text-[#6B7280] active:bg-[#F1F1F3]"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => goToProductsPage(Math.min(totalProductPages, productsPage + 1))}
                      disabled={productsPage === totalProductPages}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111] transition-colors active:bg-[#F1F1F3] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Próxima página"
                    >
                      <ChevronRight size={16} strokeWidth={2} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-[16px] border border-black/[0.08] bg-[#F7F7F8] px-4 py-8 text-center">
                <p className="text-[14px] font-black tracking-[-0.03em] text-[#111111]">Nenhum produto encontrado</p>
                <p className="mt-1 text-[12px] font-semibold text-black/45">Tente mudar a busca ou os filtros.</p>
              </div>
            )}
          </section>
        )}

      </div>
    </section>
  );
};

/**
 * Casca que alimenta a home mobile. Busca o catálogo e as coleções por conta
 * própria (antes esses dados vinham do DashboardHomePage, que hoje só monta o
 * desktop) e guarda os favoritos no localStorage por usuário.
 */
const MobileHome = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductPreview[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([]);

  const favoritesStorageKey = user?.id
    ? `${HOME_FAVORITES_STORAGE_PREFIX}:${user.id}`
    : HOME_FAVORITES_STORAGE_PREFIX;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(favoritesStorageKey);
      setFavoriteProductIds(stored ? (JSON.parse(stored) as string[]) : []);
    } catch {
      setFavoriteProductIds([]);
    }
  }, [favoritesStorageKey]);

  useEffect(() => {
    let isMounted = true;

    const fetchProducts = async () => {
      const columns = "id,title,category,images,cost_price,rating,is_active,is_blocked,stock_quantity,orders_count,source";

      // Busca produtos de todas as fontes disponíveis (c7drop, aliexpress, etc.)
      const result = await supabase
        .from("catalog_products")
        .select(columns)
        .eq("is_active", true)
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        .order("orders_count", { ascending: false, nullsFirst: false })
        .range(0, HOME_PRODUCTS_LIMIT - 1);

      if (!isMounted) return;

      let rows = result.data;

      // Fallback: se não veio nada, tenta sem filtro de estoque
      if (result.error || !rows?.length) {
        const fallbackResult = await supabase
          .from("catalog_products")
          .select(columns)
          .eq("is_active", true)
          .eq("is_blocked", false)
          .order("orders_count", { ascending: false, nullsFirst: false })
          .range(0, HOME_PRODUCTS_LIMIT - 1);

        if (!isMounted || fallbackResult.error) return;
        rows = fallbackResult.data;
      }

      const previews = ((rows ?? []) as CatalogProductRow[])
        .map(mapProductPreview)
        .filter((product): product is ProductPreview => Boolean(product));

      if (isMounted) setProducts(previews);
    };

    void fetchProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    void (async () => {
      try {
        const rows = await listCollectionsWithSummaries(user.id);
        if (isMounted) setCollections(rows);
      } catch {
        if (isMounted) setCollections([]);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleToggleFavoriteProduct = (productId: string) => {
    setFavoriteProductIds((current) => {
      const isFavorite = current.includes(productId);
      const next = isFavorite ? current.filter((id) => id !== productId) : [...current, productId];

      try {
        window.localStorage.setItem(favoritesStorageKey, JSON.stringify(next));
      } catch {
        // Mantem a interação funcionando mesmo se o navegador bloquear armazenamento local.
      }

      veloToast.success(isFavorite ? "Produto removido dos favoritos." : "Produto salvo nos favoritos.");
      return next;
    });
  };

  return (
    <MobileAliVeloHome
      products={products}
      collections={collections}
      favoriteProductIds={favoriteProductIds}
      onToggleFavoriteProduct={handleToggleFavoriteProduct}
      onCreateCollection={() => veloToast.info("Crie coleções pelo computador por enquanto.")}
    />
  );
};

export default MobileHome;
