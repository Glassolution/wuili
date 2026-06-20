import { useEffect, useMemo, useRef, useState } from "react";
import {
  Armchair,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gem,
  Heart,
  Home,
  MonitorSmartphone,
  Package,
  RefreshCw,
  Search,
  Shirt,
  Star,
} from "lucide-react";

type CategoryKey =
  | "todos"
  | "casa"
  | "eletronicos"
  | "moda"
  | "bijuterias"
  | "decoracao";

interface Product {
  id: number;
  nome: string;
  categoria: Exclude<CategoryKey, "todos">;
  preco: number;
  avaliacao: number;
  avaliacoes: number;
}

const buildPlaceholderUrl = (id: number) => `https://picsum.photos/seed/${id}/400/400`;

const categories: Array<{
  key: CategoryKey;
  label: string;
  shortLabel: string;
  icon: typeof Home;
}> = [
  { key: "todos", label: "Todos os produtos", shortLabel: "Todos", icon: Package },
  { key: "casa", label: "Casa", shortLabel: "Casa", icon: Home },
  { key: "eletronicos", label: "Eletrônicos", shortLabel: "Eletrônicos", icon: MonitorSmartphone },
  { key: "moda", label: "Moda", shortLabel: "Moda", icon: Shirt },
  { key: "bijuterias", label: "Bijuterias", shortLabel: "Bijuterias", icon: Gem },
  { key: "decoracao", label: "Decoração", shortLabel: "Decoração", icon: Armchair },
];

const mockProducts: Product[] = [
  {
    id: 1,
    nome: "Luminária de mesa touch minimalista",
    categoria: "decoracao",
    preco: 89.9,
    avaliacao: 4.8,
    avaliacoes: 1200,
  },
  {
    id: 2,
    nome: "Organizador multiuso para pia e cozinha",
    categoria: "casa",
    preco: 39.9,
    avaliacao: 4.7,
    avaliacoes: 860,
  },
  {
    id: 3,
    nome: "Fone bluetooth esportivo com estojo",
    categoria: "eletronicos",
    preco: 129.9,
    avaliacao: 4.9,
    avaliacoes: 2100,
  },
  {
    id: 4,
    nome: "Bolsa feminina estruturada premium",
    categoria: "moda",
    preco: 119.9,
    avaliacao: 4.8,
    avaliacoes: 940,
  },
  {
    id: 5,
    nome: "Kit colares folheados em camadas",
    categoria: "bijuterias",
    preco: 34.9,
    avaliacao: 4.6,
    avaliacoes: 540,
  },
  {
    id: 6,
    nome: "Suporte articulado para notebook",
    categoria: "eletronicos",
    preco: 69.9,
    avaliacao: 4.7,
    avaliacoes: 1300,
  },
  {
    id: 7,
    nome: "Vaso decorativo orgânico fosco",
    categoria: "decoracao",
    preco: 54.9,
    avaliacao: 4.8,
    avaliacoes: 470,
  },
  {
    id: 8,
    nome: "Conjunto de potes herméticos empilháveis",
    categoria: "casa",
    preco: 49.9,
    avaliacao: 4.7,
    avaliacoes: 780,
  },
  {
    id: 9,
    nome: "Óculos fashion com armação retrô",
    categoria: "moda",
    preco: 59.9,
    avaliacao: 4.5,
    avaliacoes: 620,
  },
  {
    id: 10,
    nome: "Bandeja decorativa em metal fosco",
    categoria: "decoracao",
    preco: 79.9,
    avaliacao: 4.7,
    avaliacoes: 512,
  },
  {
    id: 11,
    nome: "Caixa organizadora dobrável premium",
    categoria: "casa",
    preco: 44.9,
    avaliacao: 4.6,
    avaliacoes: 388,
  },
  {
    id: 12,
    nome: "Relógio minimalista com pulseira em aço",
    categoria: "bijuterias",
    preco: 149.9,
    avaliacao: 4.9,
    avaliacoes: 830,
  },
  {
    id: 13,
    nome: "Mochila urbana impermeável",
    categoria: "moda",
    preco: 99.9,
    avaliacao: 4.8,
    avaliacoes: 1180,
  },
  {
    id: 14,
    nome: "Caixa de som portátil compacta",
    categoria: "eletronicos",
    preco: 159.9,
    avaliacao: 4.7,
    avaliacoes: 965,
  },
];

const ITEMS_PER_PAGE = 6;
const RECOMMENDATION_WINDOW = 4;
const PRICE_OPTIONS = ["Todos os preços", "Até R$ 50", "R$ 50-150", "Acima de R$ 150"];
const RATING_OPTIONS = ["Todas", "4+ estrelas", "4.5+ estrelas"];

const formatPrice = (price: number) =>
  price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatReviewCount = (count: number) => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }

  return String(count);
};

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
        src={buildPlaceholderUrl(product.id)}
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

      <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[#6B7280]">
        <Star size={13} strokeWidth={1.8} className="fill-[#111111] text-[#111111]" />
        <span className="font-medium text-[#111111]">{product.avaliacao.toFixed(1)}</span>
        <span>({formatReviewCount(product.avaliacoes)})</span>
      </div>

      <div className={`font-semibold tracking-[-0.04em] text-[#111111] ${compact ? "mt-2.5 text-[21px]" : "mt-3 text-[22px]"}`}>
        {formatPrice(product.preco)}
      </div>

      <div className={`grid grid-cols-2 ${compact ? "mt-3 gap-2" : "mt-3.5 gap-2"}`}>
        <button
          type="button"
          className={`inline-flex items-center justify-center gap-2 rounded-[14px] border border-[#E5E7EB] bg-white text-[12px] font-medium text-[#111111] transition-colors hover:bg-[#F7F7F8] ${
            compact ? "h-9 px-2.5" : "h-10 px-3"
          }`}
        >
          <Heart size={14} strokeWidth={1.9} />
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!filterBarRef.current?.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = useMemo(() => {
    return mockProducts.filter((product) => {
      const matchesCategory = activeCategory === "todos" || product.categoria === activeCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        product.nome.toLowerCase().includes(searchQuery.trim().toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, filteredProducts]);

  const recommendationProducts = useMemo(() => mockProducts.slice(4), []);

  const recommendationWindow = useMemo(
    () =>
      Array.from({ length: Math.min(RECOMMENDATION_WINDOW, recommendationProducts.length) }, (_, offset) => {
        const index = (recommendationIndex + offset) % recommendationProducts.length;
        return recommendationProducts[index];
      }),
    [recommendationIndex, recommendationProducts],
  );

  const handleCategoryChange = (category: CategoryKey) => {
    setActiveCategory(category);
    setCurrentPage(1);
    setOpenDropdown(null);
  };

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="-mt-1 min-h-full w-full overflow-visible" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      <section className="min-w-0 overflow-visible">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[14px] text-[#6B7280]">
              Produtos mockados para explorar categorias e layout de importação.
            </p>
          </div>

          <div className="text-[13px] text-[#6B7280]">
            {filteredProducts.length} produtos
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
            className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#D1D5DB] bg-white px-4 text-[14px] font-semibold text-[#111111] shadow-sm transition-all duration-200 hover:border-[#9CA3AF] hover:bg-[#FAFAFA] xl:ml-auto"
          >
            <RefreshCw size={16} strokeWidth={1.8} />
            <span>Atualizar</span>
          </button>
        </div>

        <div className="grid h-auto grid-cols-1 gap-3 overflow-visible md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedProducts.map((product) => {
              const category = categories.find((item) => item.key === product.categoria);

              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  categoryLabel={category?.shortLabel ?? "Produto"}
                />
              );
            })}
        </div>

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

        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[28px] font-semibold tracking-[-0.045em] text-[#111111]">
                Explore nossas recomendações
              </h2>
              <p className="mt-1 text-[14px] text-[#6B7280]">
                Mais alguns produtos mockados para testar a navegação horizontal da página.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setRecommendationIndex((current) =>
                    (current - 1 + recommendationProducts.length) % recommendationProducts.length,
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
                  setRecommendationIndex((current) => (current + 1) % recommendationProducts.length)
                }
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111] transition-colors hover:bg-[#F7F7F8]"
                aria-label="Próximas recomendações"
              >
                <ChevronRight size={16} strokeWidth={1.9} />
              </button>
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 xl:grid-cols-4 md:overflow-visible">
            {recommendationWindow.map((product) => {
              const category = categories.find((item) => item.key === product.categoria);

              return (
                <ProductCard
                  key={`recommendation-${product.id}`}
                  product={product}
                  categoryLabel={category?.shortLabel ?? "Produto"}
                  compact
                />
              );
            })}
          </div>
        </section>

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
