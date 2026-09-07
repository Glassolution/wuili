import { Link } from "react-router-dom";
import { AlertCircle, Heart, Star } from "lucide-react";

export interface Product {
  id: string;
  nome: string;
  categoria: string;
  /** Custo do produto — o que o lojista paga ao fornecedor. */
  preco: number;
  image_url: string;
  images: string[];
  product_url?: string | null;
  rating?: number | null;
  ordersCount?: number | null;
  reviewsCount?: number | null;
  supplierLabel?: string | null;
}

export const formatPrice = (price: number) =>
  price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export const formatReviewCount = (count: number) => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
};

export const getMockRating = (productId: string) => {
  return {
    rating: null,
    reviewCount: null,
  };
};

export const getProductCatalogMetrics = (product: Pick<Product, "id" | "rating" | "ordersCount" | "reviewsCount">) => {
  const rating = typeof product.rating === "number" && product.rating > 0 ? product.rating : null;
  const ordersCount = typeof product.ordersCount === "number" && product.ordersCount > 0 ? product.ordersCount : null;
  const reviewsCount = typeof product.reviewsCount === "number" && product.reviewsCount > 0 ? product.reviewsCount : null;

  return {
    rating,
    ordersCount,
    reviewsCount,
    hasMetrics: rating !== null || ordersCount !== null || reviewsCount !== null,
  };
};

export const ProductFavoriteButton = ({
  isFavorited,
  onToggleFavorite,
  className = "",
}: {
  isFavorited: boolean;
  onToggleFavorite: () => void;
  className?: string;
}) => (
  <button
    type="button"
    aria-label={isFavorited ? "Produto favoritado" : "Favoritar produto"}
    aria-pressed={isFavorited}
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onToggleFavorite();
    }}
    className={`absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white/95 text-[#111111] shadow-[0_4px_12px_rgba(17,24,39,0.12)] backdrop-blur-sm transition-transform active:scale-90 ${className}`}
  >
    <Heart
      size={15}
      strokeWidth={2}
      className={isFavorited ? "fill-red-500 text-red-500" : ""}
    />
  </button>
);

export const ProductCardSkeleton = () => (
  <div className="animate-pulse">
    <div className="aspect-square w-full rounded-[3px] bg-[#ECECE9]" />
    <div className="mt-5 h-3 w-28 rounded-full bg-[#E4E4E1]" />
    <div className="mt-3 h-4 w-4/5 rounded-full bg-[#E4E4E1]" />
    <div className="mt-2 h-4 w-2/3 rounded-full bg-[#E4E4E1]" />
    <div className="mt-4 h-3 w-32 rounded-full bg-[#E4E4E1]" />
  </div>
);

export const ProductCard = ({
  product,
  isFavorited,
  onToggleFavorite,
  compact = false,
  denseMobile = false,
  collectionSelection,
}: {
  product: Product;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  compact?: boolean;
  denseMobile?: boolean;
  collectionSelection?: {
    selected: boolean;
    loading?: boolean;
    onToggle: () => void;
  };
}) => {
  const { rating, ordersCount, reviewsCount, hasMetrics } = getProductCatalogMetrics(product);
  const socialProofCount = ordersCount ?? reviewsCount;

  return (
    <article
      className={`group min-w-0 bg-transparent transition-all duration-200 hover:-translate-y-0.5 ${
        compact ? "min-w-[240px] md:min-w-0 w-full" : ""
      }`}
    >
      <div className="relative aspect-square overflow-hidden rounded-[14px] bg-[#EFEFEC]">
        <Link
          to={`/dashboard/catalogo/${product.id}`}
          className="block h-full w-full"
        >
          <img
            src={product.image_url}
            alt={product.nome}
            className="h-full w-full cursor-pointer object-contain p-4 mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.035] md:p-5"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </Link>

        {product.images && product.images.length < 3 && (
          <span
            title="Este produto tem menos de 3 fotos — pode ser recusado na publicação no ML"
            className={`absolute rounded-full border border-[#E6E6E8] bg-white/95 font-medium tracking-tight text-[#6B7280] backdrop-blur-sm items-center gap-1 cursor-help ${denseMobile ? "hidden md:flex md:left-3 md:top-3 md:px-2 md:py-1 md:text-[9px]" : "left-3 top-3 flex px-2 py-1 text-[9px]"}`}
          >
            <AlertCircle size={10} className="text-[#6B7280]" />
            <span>Fotos insuficientes</span>
          </span>
        )}

        {!collectionSelection && (
          <ProductFavoriteButton
            isFavorited={isFavorited}
            onToggleFavorite={onToggleFavorite}
          />
        )}

        {collectionSelection && (
          <button
            type="button"
            aria-label={collectionSelection.selected ? "Remover da coleção" : "Adicionar à coleção"}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              collectionSelection.onToggle();
            }}
            disabled={collectionSelection.loading}
            className={`absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-sm transition-all ${
              collectionSelection.selected
                ? "border-[#111111] bg-[#111111] text-white shadow-[0_12px_26px_rgba(17,17,17,0.22)]"
                : "border-[#E6E6E8] bg-white/95 text-[#111111] hover:bg-[#F7F7F8]"
            } ${collectionSelection.loading ? "cursor-wait opacity-60" : ""}`}
          >
            <Heart
              size={17}
              strokeWidth={2}
              className={collectionSelection.selected ? "fill-current" : ""}
            />
          </button>
        )}
      </div>

      <div className={denseMobile ? "pt-2.5 md:pt-3" : compact ? "pt-3" : "pt-3"}>
        <h2
          className={`truncate font-semibold tracking-[-0.03em] text-[#111111] transition-colors hover:text-[#2563EB] ${
            denseMobile ? "text-[11.5px] leading-[16px] md:text-[13px] md:leading-[18px]" : compact ? "text-[12.5px] leading-[17px]" : "text-[13px] leading-[18px]"
          }`}
        >
          <Link
            to={`/dashboard/catalogo/${product.id}`}
            data-dashboard-tour="catalogo-produto-abrir"
          >
            {product.nome}
          </Link>
        </h2>

        {/* Uma linha só de informação: nota à esquerda, custo à direita. O preço
            de venda sugerido e a margem vivem na página do produto. */}
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className={`flex min-w-0 items-center gap-1 ${denseMobile ? "text-[9.5px] md:text-[10.5px]" : "text-[10.5px]"}`}>
            {hasMetrics && rating !== null && (
              <>
                <Star size={denseMobile ? 10 : 11} strokeWidth={0} className="shrink-0 fill-[#F5A623]" />
                <span className="font-medium text-[#111111]">{rating.toFixed(1)}</span>
              </>
            )}
            {hasMetrics && socialProofCount !== null && (
              <span className="truncate text-[#9A9A94]">({formatReviewCount(socialProofCount)} vendas)</span>
            )}
          </div>

          <span className={`shrink-0 font-semibold tracking-[-0.025em] text-[#111111] ${denseMobile ? "text-[11.5px] md:text-[13px]" : "text-[13px]"}`}>
            {formatPrice(product.preco)}
          </span>
        </div>

        <div className={`flex items-center ${denseMobile ? "mt-2.5" : "mt-2.5"}`}>
          <Link
            to={`/dashboard/catalogo/${product.id}`}
            className="inline-flex h-[30px] w-full items-center justify-center rounded-[9px] bg-[#2563EB] px-3 text-[10.5px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
          >
            Ver produto
          </Link>
        </div>
      </div>
    </article>
  );
};
