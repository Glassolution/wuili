import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpDown, Check, CheckCircle2, ChevronLeft, Heart, Plus, Search, SlidersHorizontal, Star } from "lucide-react";
import { formatPrice, formatReviewCount, getProductCatalogMetrics, type Product } from "@/components/dashboard/ProductCard";
import type { RatingOption } from "@/lib/catalogFilters";

type CategoriaOpcao = { valor: string; rotulo: string };

const PRICE_OPTIONS = ["Todos os preços", "Até R$ 50", "R$ 50-150", "Acima de R$ 150"];
const RATING_OPTIONS: RatingOption[] = ["Todas", "4+ estrelas", "4.5+ estrelas"];

type SortKey = "popular" | "price-asc" | "price-desc";

const SORT_LABEL: Record<SortKey, string> = {
  popular: "Mais vendidos",
  "price-asc": "Menor preço",
  "price-desc": "Maior preço",
};

const nextSort = (current: SortKey): SortKey =>
  current === "popular" ? "price-asc" : current === "price-asc" ? "price-desc" : "popular";

const MobileCatalogProductCard = ({
  product,
  isFavorited,
  onToggleFavorite,
  collectionSelection,
}: {
  product: Product;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  collectionSelection?: {
    selected: boolean;
    loading?: boolean;
    onToggle: () => void;
  };
}) => {
  const { rating, ordersCount, reviewsCount, hasMetrics } = getProductCatalogMetrics(product);
  const socialProof = ordersCount ?? reviewsCount;
  const sellPrice = typeof product.suggestedPrice === "number" && product.suggestedPrice > product.preco
    ? product.suggestedPrice
    : null;
  const heartActive = collectionSelection ? collectionSelection.selected : isFavorited;
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [plusAtivo, setPlusAtivo] = useState(false);
  const abrirTimer = useRef<number | null>(null);
  const destino = `/dashboard/catalogo/${product.id}`;

  useEffect(() => () => {
    if (abrirTimer.current) window.clearTimeout(abrirTimer.current);
  }, []);

  const abrirProduto = (event?: { preventDefault: () => void; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean }) => {
    if (event?.metaKey || event?.ctrlKey || event?.shiftKey || event?.altKey) return;
    event?.preventDefault();
    if (plusAtivo) return;
    setPlusAtivo(true);
    const espera = reduceMotion ? 0 : 420;
    abrirTimer.current = window.setTimeout(() => {
      navigate(destino);
    }, espera);
  };

  return (
    <article className="min-w-0">
      <div className="relative">
        <Link to={destino} onClick={abrirProduto} className="block aspect-square">
          <img
            src={product.image_url}
            alt={product.nome}
            className="h-full w-full object-contain mix-blend-multiply"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </Link>

        <button
          type="button"
          aria-label={heartActive ? "Remover dos favoritos" : "Favoritar produto"}
          aria-pressed={heartActive}
          disabled={collectionSelection?.loading}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (collectionSelection) collectionSelection.onToggle();
            else onToggleFavorite();
          }}
          className="absolute right-0 top-0 inline-flex h-7 w-7 items-center justify-center text-[#C7C7CC] active:scale-90"
        >
          <Heart size={17} strokeWidth={1.6} className={heartActive ? "fill-red-500 text-red-500" : ""} />
        </button>
      </div>

      <div className="px-0.5 pt-1.5">
        {hasMetrics && rating !== null && (
          <p className="flex items-center gap-0.5 text-[11px] text-[#111111]">
            <Star size={11} strokeWidth={0} className="fill-[#F5A623]" />
            <span className="font-medium">{rating.toFixed(1)}</span>
            {socialProof !== null && (
              <span className="text-[#8E8E93]">({formatReviewCount(socialProof)})</span>
            )}
          </p>
        )}

        <p className="mt-0.5 line-clamp-2 min-h-[34px] text-[13px] font-medium leading-[17px] tracking-[-0.01em] text-[#111111]">
          <Link to={destino} onClick={abrirProduto} data-dashboard-tour="catalogo-produto-abrir">
            {product.nome}
          </Link>
        </p>

        <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-[#8E8E93]">
          <CheckCircle2 size={12} className="shrink-0 fill-[#2B7BFF] stroke-white" strokeWidth={1.6} aria-hidden="true" />
          <span className="truncate">
            Velo
            {product.stockQuantity ? ` · ${product.stockQuantity} em estoque` : ""}
          </span>
        </p>

        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="velo-catalogo-preco text-[15px] font-medium leading-none tracking-[-0.01em] text-[#111111]">
              {formatPrice(product.preco)}
            </p>
            {sellPrice !== null && (
              <p className="velo-catalogo-preco mt-0.5 text-[11px] font-normal text-[#8E8E93]">
                Venda: {formatPrice(sellPrice)}
              </p>
            )}
          </div>
          <motion.button
            type="button"
            aria-label={`Abrir ${product.nome}`}
            onClick={() => abrirProduto()}
            initial={false}
            animate={plusAtivo ? "on" : "off"}
            variants={{
              off: { backgroundColor: "#FFFFFF", borderColor: "rgba(0,0,0,0.08)", scale: 1 },
              on: { backgroundColor: "#2563EB", borderColor: "#2563EB", scale: 1 },
            }}
            whileTap={{ scale: 0.86 }}
            transition={{ type: "spring", stiffness: 520, damping: 32 }}
            className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[#111111]"
          >
            <motion.span
              className="absolute inset-0 grid place-items-center"
              animate={plusAtivo ? { opacity: 0, rotate: 90, scale: 0.45 } : { opacity: 1, rotate: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <Plus size={14} strokeWidth={2} />
            </motion.span>
            <motion.span
              className="absolute inset-0 grid place-items-center text-white"
              initial={false}
              animate={plusAtivo ? { opacity: 1, rotate: 0, scale: 1 } : { opacity: 0, rotate: -80, scale: 0.45 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: plusAtivo ? 0.06 : 0 }}
            >
              <Check size={14} strokeWidth={2.4} />
            </motion.span>
          </motion.button>
        </div>
      </div>
    </article>
  );
};

const MobileCatalogSkeleton = () => (
  <div className="animate-pulse">
    <div className="aspect-square rounded-none bg-[#F2F2F7]/50" />
    <div className="mt-3 h-3 w-16 rounded-full bg-[#EFEFF4]" />
    <div className="mt-2 h-4 w-4/5 rounded-full bg-[#EFEFF4]" />
    <div className="mt-2 h-3 w-2/3 rounded-full bg-[#EFEFF4]" />
    <div className="mt-3 h-5 w-20 rounded-full bg-[#EFEFF4]" />
  </div>
);

export const MobileCatalogView = ({
  products,
  isLoading,
  error,
  searchQuery,
  onSearchQuery,
  activeCategory,
  onCategoryChange,
  categories,
  selectedPriceRange,
  onPriceRange,
  selectedRating,
  onRating,
  favoritedIds,
  onToggleFavorite,
  collectionSelectionFor,
  currentPage,
  totalPages,
  onPageChange,
  onRetry,
  isCollectionSelectionMode,
  selectionCollectionName,
  onFinishCollection,
  onExitCollection,
}: {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchQuery: (value: string) => void;
  activeCategory: string;
  onCategoryChange: (value: string) => void;
  categories: CategoriaOpcao[];
  selectedPriceRange: string;
  onPriceRange: (value: string) => void;
  selectedRating: RatingOption;
  onRating: (value: RatingOption) => void;
  favoritedIds: string[];
  onToggleFavorite: (id: string) => void;
  collectionSelectionFor?: (productId: string) => {
    selected: boolean;
    loading?: boolean;
    onToggle: () => void;
  } | undefined;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  isCollectionSelectionMode: boolean;
  selectionCollectionName: string;
  onFinishCollection: () => void;
  onExitCollection: () => void;
}) => {
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("popular");

  const sortedProducts = useMemo(() => {
    const list = [...products];
    if (sort === "price-asc") list.sort((left, right) => left.preco - right.preco);
    if (sort === "price-desc") list.sort((left, right) => right.preco - left.preco);
    return list;
  }, [products, sort]);

  const filtersActive = selectedPriceRange !== "Todos os preços" || selectedRating !== "Todas";

  return (
    <div className="velo-fonte-inter min-h-full bg-white pb-4 text-[#111111]">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md">
        <div className="relative flex h-11 items-center px-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-0.5 px-2 text-[15px] text-[#111111] active:opacity-60"
            aria-label="Voltar"
          >
            <ChevronLeft size={22} strokeWidth={2.2} />
            <span>Voltar</span>
          </button>
          <p className="pointer-events-none absolute inset-x-0 text-center text-[15px] font-semibold tracking-[-0.02em]">
            Velo
          </p>
        </div>

        <div className="flex items-center justify-between px-5 pb-1 pt-1">
          <p className="text-[22px] font-semibold tracking-[-0.04em]" role="heading" aria-level={1}>Catálogo</p>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-label="Filtros"
            aria-pressed={filtersOpen}
            className={`relative inline-flex h-9 w-9 items-center justify-center rounded-[12px] border bg-white active:scale-95 ${
              filtersActive || filtersOpen ? "border-[#111111]" : "border-black/[0.08]"
            }`}
          >
            <SlidersHorizontal size={16} strokeWidth={1.9} />
            {filtersActive && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#111111]" />}
          </button>
        </div>

        <div className="mobile-hide-scrollbar relative flex gap-5 overflow-x-auto border-b border-black/[0.06] px-5">
          {categories.map((category) => {
            const active = activeCategory === category.valor;
            return (
              <button
                key={category.valor}
                type="button"
                onClick={() => onCategoryChange(category.valor)}
                className={`relative shrink-0 pb-2 pt-1.5 text-[13px] tracking-[-0.01em] transition-colors ${
                  active ? "font-semibold text-[#111111]" : "font-normal text-[#8E8E93]"
                }`}
              >
                {category.rotulo}
                {active && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#111111]" />}
              </button>
            );
          })}
        </div>

        {filtersOpen && (
          <div className="border-b border-black/[0.06] bg-white px-5 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93]">Preço</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRICE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onPriceRange(option)}
                  className={`rounded-full px-3 py-1.5 text-[13px] ${
                    selectedPriceRange === option
                      ? "bg-[#111111] text-white"
                      : "bg-[#F2F2F7] text-[#3A3A3C]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93]">Avaliação</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {RATING_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onRating(option)}
                  className={`rounded-full px-3 py-1.5 text-[13px] ${
                    selectedRating === option
                      ? "bg-[#111111] text-white"
                      : "bg-[#F2F2F7] text-[#3A3A3C]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {isCollectionSelectionMode && (
        <div className="mx-5 mt-3 flex items-center justify-between rounded-2xl bg-[#111111] px-4 py-3 text-white">
          <p className="min-w-0 truncate text-[13px] font-medium">
            Adicionando à {selectionCollectionName}
          </p>
          <div className="ml-3 flex shrink-0 gap-2">
            <button type="button" onClick={onFinishCollection} className="text-[13px] font-semibold">
              Concluir
            </button>
            <button type="button" onClick={onExitCollection} aria-label="Sair da seleção" className="text-white/60">
              ×
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-5 pt-3" data-dashboard-tour="catalogo-busca">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar produto</span>
          <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQuery(event.target.value)}
            placeholder="Buscar"
            className="h-10 w-full rounded-full bg-[#F2F2F7] pl-9 pr-4 text-[15px] text-[#111111] outline-none placeholder:text-[#8E8E93]"
          />
        </label>
        <button
          type="button"
          onClick={() => setSort(nextSort)}
          aria-label={`Ordenar: ${SORT_LABEL[sort]}`}
          title={SORT_LABEL[sort]}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2F2F7] text-[#111111] active:scale-95"
        >
          <ArrowUpDown size={16} strokeWidth={1.9} />
        </button>
      </div>

      <div className="px-5 pt-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-x-3.5 gap-y-5">
            {Array.from({ length: 8 }).map((_, index) => (
              <MobileCatalogSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-[15px] font-medium">{error}</p>
            <button type="button" onClick={onRetry} className="mt-3 text-[15px] font-semibold text-[#2563EB]">
              Tentar novamente
            </button>
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center text-[#8E8E93]">
            {activeCategory === "favoritos" ? (
              <>
                <p className="font-medium text-[#111111]">Nenhum favorito ainda</p>
                <p className="mt-1 text-[14px]">Toque no coração para salvar um produto aqui.</p>
              </>
            ) : (
              <p className="font-medium text-[#111111]">Nenhum produto nesta categoria</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3.5 gap-y-5">
            {sortedProducts.map((product, index) => (
              <div key={product.id} data-dashboard-tour={index === 0 ? "catalogo-produto" : undefined}>
                <MobileCatalogProductCard
                  product={product}
                  isFavorited={favoritedIds.includes(product.id)}
                  onToggleFavorite={() => onToggleFavorite(product.id)}
                  collectionSelection={collectionSelectionFor?.(product.id)}
                />
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && !isLoading && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="h-9 rounded-full px-3 text-[14px] text-[#111111] disabled:opacity-30"
            >
              Anterior
            </button>
            <span className="text-[13px] text-[#8E8E93]">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="h-9 rounded-full px-3 text-[14px] text-[#111111] disabled:opacity-30"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
