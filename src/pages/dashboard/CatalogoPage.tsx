import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type CategoryKey =
  | "todos"
  | "casa"
  | "eletronicos"
  | "moda"
  | "bijuterias"
  | "decoracao";

interface Product {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  image_url: string;
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
];

const PRICE_OPTIONS = ["Todos os preços", "Até R$ 50", "R$ 50-150", "Acima de R$ 150"];
const RATING_OPTIONS = ["Todas", "4+ estrelas", "4.5+ estrelas"];

const formatPrice = (price: number) =>
  price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const ProductCardSkeleton = () => (
  <div className="overflow-hidden rounded-[22px] border border-[#ECECEF] bg-white p-4 shadow-[0_10px_30px_rgba(17,24,39,0.05)] animate-pulse">
    <div className="aspect-square w-full rounded-xl bg-gray-200" />
    <div className="mt-4 h-4 w-3/4 rounded bg-gray-200" />
    <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
    <div className="mt-4 h-6 w-1/3 rounded bg-gray-200" />
    <div className="mt-4 h-10 w-full rounded-xl bg-gray-200" />
  </div>
);

const ProductCard = ({
  product,
  categoryLabel,
  compact = false,
}: {
  product: Product;
  categoryLabel: string;
  compact?: boolean;
}) => (
  <article
    className={`overflow-hidden rounded-[22px] border border-[#ECECEF] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.05)] transition-transform duration-200 hover:-translate-y-0.5 ${
      compact ? "min-w-[240px] md:min-w-0" : ""
    }`}
  >
    <div className="relative aspect-square overflow-hidden bg-[#F6F6F7]">
      <img
        src={product.image_url}
        alt={product.nome}
        className="h-full w-full object-cover"
        loading="lazy"
      />

      <span className="absolute left-4 top-4 rounded-full border border-[#E6E6E8] bg-white/95 px-2.5 py-1 text-[10px] font-semibold tracking-[-0.01em] text-[#111111] backdrop-blur-sm">
        {categoryLabel}
      </span>
    </div>

    <div className={compact ? "p-3.5" : "p-4"}>
      <h2
        className={`line-clamp-2 font-semibold tracking-[-0.025em] text-[#111111] ${
          compact ? "min-h-[40px] text-[14px]" : "min-h-[44px] text-[15px]"
        }`}
      >
        {product.nome}
      </h2>

      <div className={`font-semibold tracking-[-0.04em] text-[#111111] ${compact ? "mt-2.5 text-[21px]" : "mt-3 text-[22px]"}`}>
        {formatPrice(product.preco)}
      </div>

      <div className="mt-3.5">
        <button
          type="button"
          className={`inline-flex w-full items-center justify-center rounded-[14px] bg-[#111111] text-[12px] font-medium text-white transition-opacity hover:opacity-90 ${
            compact ? "h-9 px-2.5" : "h-10 px-3"
          }`}
        >
          Importar
        </button>
      </div>
    </div>
  </article>
);

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

  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!filterBarRef.current?.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mapProduct = (p: any): Product => {
    let imgUrl = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop";
    if (p.images) {
      if (Array.isArray(p.images) && p.images.length > 0) {
        imgUrl = p.images[0];
      } else if (typeof p.images === "string") {
        try {
          const parsed = JSON.parse(p.images);
          if (Array.isArray(parsed) && parsed.length > 0) {
            imgUrl = parsed[0];
          } else {
            imgUrl = p.images;
          }
        } catch {
          imgUrl = p.images;
        }
      }
    }
    return {
      id: p.id,
      nome: p.title || "Produto sem nome",
      categoria: p.category || "Produto",
      preco: p.suggested_price || p.cost_price || 0,
      image_url: imgUrl,
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
          .eq("source", "b2drop")
          .eq("is_blocked", false)
          .order("created_at", { ascending: false })
          .range(start, end);

        if (searchQuery.trim()) {
          query = query.ilike("title", `%${searchQuery.trim()}%`);
        }

        const { data, count, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        setProducts((data || []).map(mapProduct));
        setTotalCount(count || 0);
      } catch (err: any) {
        console.error("Erro ao buscar produtos do catálogo:", err);
        setError("Não foi possível carregar o catálogo agora.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [currentPage, searchQuery]);

  // Buscar recomendações
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("catalog_products")
          .select("*")
          .eq("source", "b2drop")
          .eq("is_blocked", false)
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

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="-mt-5 min-h-full w-full overflow-visible sm:-mt-6 lg:-mt-7" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      <section className="min-w-0 overflow-visible">
        <div className="mb-3 flex justify-end">
          <div className="text-[13px] text-[#6B7280]">
            {totalCount} produtos
          </div>
        </div>

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

          <button
            type="button"
            onClick={() => {
              setCurrentPage(1);
              setSearchQuery("");
            }}
            className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#D1D5DB] bg-white px-4 text-[14px] font-semibold text-[#111111] shadow-sm transition-all duration-200 hover:border-[#9CA3AF] hover:bg-[#FAFAFA] xl:ml-auto"
          >
            <RefreshCw size={16} strokeWidth={1.8} />
            <span>Atualizar</span>
          </button>
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
            <p className="font-medium">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className="grid h-auto grid-cols-1 gap-3 overflow-visible md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                categoryLabel={product.categoria}
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

            {pageNumbers.map((pageNumber) => (
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
