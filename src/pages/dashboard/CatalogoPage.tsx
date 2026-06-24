import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  RefreshCw,
  Search,
  Star,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProductScoutAI, { type AtlasResults } from "@/components/dashboard/ProductScoutAI";
import { veloToast } from "@/components/ui/velo-toast";
import type { Database, Json } from "@/integrations/supabase/types";

type CatalogProductRow = Database["public"]["Tables"]["catalog_products"]["Row"];

type CategoryKey =
  | "todos"
  | "casa"
  | "eletronicos"
  | "moda"
  | "bijuterias"
  | "decoracao"
  | "bebe"
  | "pet"
  | "beleza"
  | "saude"
  | "esporte"
  | "outros";

export interface Product {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  image_url: string;
  images: string[];
  product_url?: string | null;
}

const categories: Array<{
  key: CategoryKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "todos", label: "Todos os produtos", shortLabel: "Todos" },
  { key: "casa", label: "Casa", shortLabel: "Casa" },
  { key: "eletronicos", label: "Eletrônicos", shortLabel: "Eletrônicos" },
  { key: "moda", label: "Moda", shortLabel: "Moda" },
  { key: "bijuterias", label: "Bijuterias", shortLabel: "Bijuterias" },
  { key: "decoracao", label: "Decoração", shortLabel: "Decoração" },
  { key: "bebe", label: "Bebê e Infantil", shortLabel: "Bebê" },
  { key: "pet", label: "Pet", shortLabel: "Pet" },
  { key: "beleza", label: "Beleza", shortLabel: "Beleza" },
  { key: "saude", label: "Saúde e Bem-estar", shortLabel: "Saúde" },
  { key: "esporte", label: "Esporte e Fitness", shortLabel: "Esporte" },
  { key: "outros", label: "Outros", shortLabel: "Outros" },
];

const categoryMap: Record<CategoryKey, string | null> = {
  todos: null,
  casa: "Casa",
  eletronicos: "Eletrônicos",
  moda: "Moda",
  bijuterias: "Bijuterias",
  decoracao: "Decoração",
  bebe: "Bebê e Infantil",
  pet: "Pet",
  beleza: "Beleza",
  saude: "Saúde e Bem-estar",
  esporte: "Esporte e Fitness",
  outros: "Outros",
};

const PRICE_OPTIONS = ["Todos os preços", "Até R$ 50", "R$ 50-150", "Acima de R$ 150"];
const RATING_OPTIONS = ["Todas", "4+ estrelas", "4.5+ estrelas"];

export const formatPrice = (price: number) =>
  price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const getProductImages = (images: Json | null): string[] => {
  if (!images) return [];
  if (Array.isArray(images)) {
    return images.filter((image): image is string => typeof image === "string");
  }

  if (typeof images === "string") {
    try {
      const parsed: unknown = JSON.parse(images);
      return Array.isArray(parsed)
        ? parsed.filter((image): image is string => typeof image === "string")
        : [images];
    } catch {
      return [images];
    }
  }

  return [];
};

// MOCK: avaliação simulada até termos dados reais de review
export function getMockRating(productId: string) {
  // gera um número pseudo-aleatório mas estável, baseado no id do produto
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = (hash * 31 + productId.charCodeAt(i)) % 10000;
  }
  const rating = (4.0 + (hash % 100) / 100).toFixed(1); // entre 4.0 e 5.0
  const reviewCount = 50 + (hash % 1950); // entre 50 e 2000
  return { rating, reviewCount };
}

export const formatReviewCount = (count: number) => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
};

const ProductCardSkeleton = () => (
  <div className="overflow-hidden rounded-[22px] border border-[#ECECEF] bg-white p-4 shadow-[0_10px_30px_rgba(17,24,39,0.05)] animate-pulse">
    <div className="aspect-square w-full rounded-xl bg-gray-200" />
    <div className="mt-4 h-4 w-3/4 rounded bg-gray-200" />
    <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
    <div className="mt-4 h-6 w-1/3 rounded bg-gray-200" />
    <div className="mt-4 h-10 w-full rounded-xl bg-gray-200" />
  </div>
);

export const ProductCard = ({
  product,
  categoryLabel,
  isFavorited,
  onToggleFavorite,
  compact = false,
}: {
  product: Product;
  categoryLabel: string;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  compact?: boolean;
}) => {
  const { rating, reviewCount } = getMockRating(product.id);

  return (
    <article
      className={`overflow-hidden rounded-[22px] border border-[#ECECEF] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.05)] transition-transform duration-200 hover:-translate-y-0.5 ${
        compact ? "min-w-[240px] md:min-w-0" : ""
      }`}
    >
      <div className="relative aspect-square overflow-hidden bg-[#F6F6F7]">
        <Link
          to={`/dashboard/catalogo/${product.id}`}
          className="block h-full w-full"
          onClick={() => {
            veloToast.loading("Carregando produto...", {
              id: `loading-product-${product.id}`,
              fullscreen: true,
              minDuration: 3000,
            });
          }}
        >
          <img
            src={product.image_url}
            alt={product.nome}
            className="h-full w-full object-cover cursor-pointer"
            loading="lazy"
          />
        </Link>

        <span className="absolute left-4 top-4 rounded-full border border-[#E6E6E8] bg-white/95 px-2.5 py-1 text-[10px] font-semibold tracking-[-0.01em] text-[#111111] backdrop-blur-sm">
          {categoryLabel}
        </span>

        {product.images && product.images.length < 3 && (
          <span
            title="Este produto tem menos de 3 fotos — pode ser recusado na publicação no ML"
            className="absolute right-4 top-4 rounded-full border border-[#E6E6E8] bg-white/95 px-2 py-1 text-[9px] font-medium tracking-tight text-[#6B7280] backdrop-blur-sm flex items-center gap-1 cursor-help"
          >
            <AlertCircle size={10} className="text-[#6B7280]" />
            <span>Fotos insuficientes</span>
          </span>
        )}
      </div>

      <div className={compact ? "p-3.5" : "p-4"}>
        <h2
          className={`line-clamp-2 font-semibold tracking-[-0.025em] text-[#111111] hover:text-[#2563EB] transition-colors ${
            compact ? "min-h-[40px] text-[14px]" : "min-h-[44px] text-[15px]"
          }`}
        >
          <Link
            to={`/dashboard/catalogo/${product.id}`}
            onClick={() => {
              veloToast.loading("Carregando produto...", {
                id: `loading-product-${product.id}`,
                fullscreen: true,
                minDuration: 3000,
              });
            }}
          >
            {product.nome}
          </Link>
        </h2>

        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[#6B7280]">
          <Star size={13} strokeWidth={1.8} className="fill-[#111111] text-[#111111]" />
          <span className="font-medium text-[#111111]">{rating}</span>
          <span>({formatReviewCount(reviewCount)})</span>
        </div>

        <div className={`font-semibold tracking-[-0.04em] text-[#111111] ${compact ? "mt-2.5 text-[21px]" : "mt-3 text-[22px]"}`}>
          {formatPrice(product.preco)}
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`inline-flex items-center justify-center gap-2 rounded-[14px] border border-[#E5E7EB] bg-white text-[12px] font-medium text-[#111111] transition-colors hover:bg-[#F7F7F8] ${
              compact ? "h-9 px-2.5" : "h-10 px-3"
            }`}
          >
            <Heart
              size={14}
              strokeWidth={1.9}
              className={isFavorited ? "fill-red-500 text-red-500" : ""}
            />
            <span>Favoritar</span>
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-[14px] bg-[#111111] text-[12px] font-medium text-white transition-opacity hover:opacity-90 ${
              compact ? "h-9 px-2.5" : "h-10 px-3"
            }`}
          >
            Importar
          </button>
        </div>
      </div>
    </article>
  );
};

const FilterDropdown = ({
  label,
  value,
  isOpen,
  onToggle,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  options: string[];
  onSelect: (value: string) => void;
}) => (
  <div className="relative min-w-[180px]">
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-[#D1D5DB] bg-white px-4 text-[14px] font-semibold text-[#111111] shadow-sm transition-all duration-200 hover:border-[#9CA3AF] hover:bg-[#FAFAFA]"
    >
      <span className="truncate">{label}: {value}</span>
      <ChevronDown size={16} strokeWidth={1.8} className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
    </button>

    {isOpen && (
      <div className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-[0_16px_32px_rgba(17,24,39,0.08)]">
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

const CatalogoPage = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [recommendationIndex, setRecommendationIndex] = useState(0);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriceRange, setSelectedPriceRange] = useState("Todos os preços");
  const [selectedRating, setSelectedRating] = useState("Todas");
  const [openDropdown, setOpenDropdown] = useState<"category" | "price" | "rating" | null>(null);
  const filterBarRef = useRef<HTMLDivElement | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [favoritedIds, setFavoritedIds] = useState<string[]>([]);

  const ITEMS_PER_PAGE = 12;

  const toggleFavorite = (productId: string) => {
    setFavoritedIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!filterBarRef.current?.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mapProduct = (p: CatalogProductRow): Product => {
    let imgUrls = getProductImages(p.images);
    const defaultImage = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop";
    if (imgUrls.length === 0) {
      imgUrls = [defaultImage];
    }
    return {
      id: p.id,
      nome: p.title || "Produto sem nome",
      categoria: p.category || "Produto",
      preco: p.cost_price || 0,
      image_url: imgUrls[0],
      images: imgUrls,
      product_url: p.product_url,
    };
  };

  // Buscar produtos principais paginados
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE - 1;

        let query = supabase
          .from("catalog_products")
          .select("*", { count: "exact" })
          .in("source", ["b2drop", "c7drop"])
          .eq("is_blocked", false)
          .gt("stock_quantity", 0)
          .order("created_at", { ascending: false })
          .range(start, end);

        if (activeCategory !== "todos") {
          const dbCategory = categoryMap[activeCategory];
          if (dbCategory) {
            query = query.eq("category", dbCategory);
          }
        }

        if (searchQuery.trim()) {
          query = query.ilike("title", `%${searchQuery.trim()}%`);
        }

        const { data, count, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        setProducts((data || []).map(mapProduct));
        setTotalCount(count || 0);
      } catch (err) {
        console.error("Erro ao buscar produtos do catálogo:", err);
        setError("Não foi possível carregar o catálogo agora.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [currentPage, searchQuery, activeCategory]);

  // Buscar recomendações
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("catalog_products")
          .select("*")
          .in("source", ["b2drop", "c7drop"])
          .eq("is_blocked", false)
          .gt("stock_quantity", 0)
          .limit(10);

        if (fetchError) throw fetchError;
        setRecommendations((data || []).map(mapProduct));
      } catch (err) {
        console.error("Erro ao buscar recomendações:", err);
      }
    };

    fetchRecommendations();
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const recommendationWindow = useMemo(() => {
    if (recommendations.length === 0) return [];
    return Array.from({ length: Math.min(4, recommendations.length) }, (_, offset) => {
      const index = (recommendationIndex + offset) % recommendations.length;
      return recommendations[index];
    });
  }, [recommendationIndex, recommendations]);

  const handleCategoryChange = (category: CategoryKey) => {
    setActiveCategory(category);
    setCurrentPage(1);
    setOpenDropdown(null);
  };

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxButtons = 5;
    
    let start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + maxButtons - 1);
    
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="-mt-1 min-h-full w-full overflow-visible" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      <section className="min-w-0 overflow-visible">


        <div
          ref={filterBarRef}
          className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center"
        >
          <div className="relative min-w-0 xl:w-[260px] xl:flex-shrink-0">
            <Search
              size={16}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar produto"
              className="h-11 w-full rounded-2xl border border-[#D1D5DB] bg-white pl-11 pr-4 text-[14px] font-medium text-[#111111] shadow-sm outline-none transition-all duration-200 placeholder:text-[#9CA3AF] hover:border-[#9CA3AF]"
            />
          </div>

          <FilterDropdown
            label="Categoria"
            value={categories.find((category) => category.key === activeCategory)?.label ?? "Todos os produtos"}
            isOpen={openDropdown === "category"}
            onToggle={() => setOpenDropdown((current) => (current === "category" ? null : "category"))}
            options={categories.map((category) => category.label)}
            onSelect={(option) => {
              const selectedCategory = categories.find((category) => category.label === option);
              if (selectedCategory) handleCategoryChange(selectedCategory.key);
            }}
          />

          <FilterDropdown
            label="Faixa de preço"
            value={selectedPriceRange}
            isOpen={openDropdown === "price"}
            onToggle={() => setOpenDropdown((current) => (current === "price" ? null : "price"))}
            options={PRICE_OPTIONS}
            onSelect={(option) => {
              setSelectedPriceRange(option);
              setOpenDropdown(null);
            }}
          />

          <FilterDropdown
            label="Avaliação"
            value={selectedRating}
            isOpen={openDropdown === "rating"}
            onToggle={() => setOpenDropdown((current) => (current === "rating" ? null : "rating"))}
            options={RATING_OPTIONS}
            onSelect={(option) => {
              setSelectedRating(option);
              setOpenDropdown(null);
            }}
          />

          <div className="hidden xl:block xl:flex-1" />

          <div className="xl:ml-auto">
            <ProductScoutAI onOpenProduct={(productId) => navigate(`/dashboard/catalogo/${productId}`)} />
          </div>
        </div>

        {isLoading ? (
          <div className="grid h-auto grid-cols-1 gap-3 overflow-visible md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: ITEMS_PER_PAGE }).map((_, idx) => (
              <ProductCardSkeleton key={idx} />
            ))}
          </div>
        ) : error ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 p-6 text-center text-red-600">
            <p className="font-medium">{error}</p>
            <button
              onClick={() => setCurrentPage(1)}
              className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              Tentar novamente
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-gray-200 bg-gray-50/30 p-6 text-center text-gray-500 w-full col-span-full">
            <p className="font-medium">Nenhum produto encontrado nesta categoria.</p>
          </div>
        ) : (
          <div className="grid h-auto grid-cols-1 gap-3 overflow-visible md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                categoryLabel={product.categoria}
                isFavorited={favoritedIds.includes(product.id)}
                onToggleFavorite={() => toggleFavorite(product.id)}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111] transition-colors hover:bg-[#F7F7F8] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft size={16} strokeWidth={1.9} />
            </button>

            {getPageNumbers().map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setCurrentPage(pageNumber)}
                className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-[13px] font-medium transition-colors ${
                  currentPage === pageNumber
                    ? "border-[#D8D8DC] bg-[#F1F1F3] text-[#111111]"
                    : "border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F7F7F8] hover:text-[#111111]"
                }`}
              >
                {pageNumber}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111] transition-colors hover:bg-[#F7F7F8] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Próxima página"
            >
              <ChevronRight size={16} strokeWidth={1.9} />
            </button>
          </div>
        )}

        {recommendations.length > 0 && (
          <section className="mt-12">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[28px] font-semibold tracking-[-0.045em] text-[#111111]">
                  Explore nossas recomendações
                </h2>
                <p className="mt-1 text-[14px] text-[#6B7280]">
                  Seleções de produtos em destaque para facilitar suas importações.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setRecommendationIndex((current) =>
                      (current - 1 + recommendations.length) % recommendations.length,
                    )
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111] transition-colors hover:bg-[#F7F7F8]"
                  aria-label="Recomendações anteriores"
                >
                  <ChevronLeft size={16} strokeWidth={1.9} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRecommendationIndex((current) => (current + 1) % recommendations.length)
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111] transition-colors hover:bg-[#F7F7F8]"
                  aria-label="Próximas recomendações"
                >
                  <ChevronRight size={16} strokeWidth={1.9} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 xl:grid-cols-4 md:overflow-visible">
              {recommendationWindow.map((product) => (
                <ProductCard
                  key={`recommendation-${product.id}`}
                  product={product}
                  categoryLabel={product.categoria}
                  isFavorited={favoritedIds.includes(product.id)}
                  onToggleFavorite={() => toggleFavorite(product.id)}
                  compact
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 overflow-hidden rounded-[28px] bg-[#111111] px-5 py-6 text-white shadow-[0_18px_40px_rgba(17,24,39,0.18)] sm:px-7 sm:py-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[420px]">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Newsletter
              </p>
              <h2 className="mt-3 text-[34px] font-semibold leading-[0.95] tracking-[-0.06em] text-white sm:text-[42px]">
                Quer receber
                <br />
                novidades primeiro?
              </h2>
              <p className="mt-4 max-w-[360px] text-[14px] leading-6 text-white/70">
                Receba novas seleções, produtos em destaque e atualizações do catálogo em primeira mão.
              </p>
            </div>

            <form
              className="w-full max-w-[480px]"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(event) => setNewsletterEmail(event.target.value)}
                  placeholder="Seu melhor e-mail"
                  className="h-12 flex-1 rounded-full border border-white/15 bg-white/8 px-4 text-[14px] text-white outline-none placeholder:text-white/45"
                />
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-white px-5 text-[14px] font-semibold text-[#111111] transition-opacity hover:opacity-90"
                >
                  Enviar
                </button>
              </div>
            </form>
          </div>
        </section>
      </section>
    </div>
  );
};

export default CatalogoPage;
