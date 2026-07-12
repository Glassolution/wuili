import { Link } from "react-router-dom";
import { AlertCircle, Heart, Star } from "lucide-react";
import { veloToast } from "@/components/ui/velo-toast";

export interface Product {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  image_url: string;
  images: string[];
  product_url?: string | null;
  rating?: number | null;
  ordersCount?: number | null;
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

export const getProductCatalogMetrics = (product: Pick<Product, "rating" | "ordersCount">) => {
  const rating = typeof product.rating === "number" && product.rating >= 0 ? product.rating : null;
  const ordersCount = typeof product.ordersCount === "number" && product.ordersCount >= 0 ? product.ordersCount : null;

  return {
    rating,
    ordersCount,
    hasMetrics: rating !== null || ordersCount !== null,
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
    aria-label={isFavorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
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
  denseMobile = false,
  collectionSelection,
}: {
  product: Product;
  categoryLabel: string;
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
  const { rating, ordersCount, hasMetrics } = getProductCatalogMetrics(product);

  return (
    <article
      className={`overflow-hidden border border-[#ECECEF] bg-white transition-transform duration-200 hover:-translate-y-0.5 ${
        denseMobile ? "rounded-xl shadow-none md:rounded-[22px] md:shadow-[0_10px_30px_rgba(17,24,39,0.05)]" : "rounded-[22px] shadow-[0_10px_30px_rgba(17,24,39,0.05)]"
      } ${
        compact ? "min-w-[240px] md:min-w-0 w-full" : ""
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

        <span className={`absolute rounded-full border border-[#E6E6E8] bg-white/95 font-semibold tracking-[-0.01em] text-[#111111] backdrop-blur-sm ${denseMobile ? "left-2 top-2 max-w-[calc(100%-16px)] truncate px-2 py-0.5 text-[8px] md:left-4 md:top-4 md:px-2.5 md:py-1 md:text-[10px]" : "left-4 top-4 px-2.5 py-1 text-[10px]"}`}>
          {categoryLabel}
        </span>

        {product.images && product.images.length < 3 && (
          <span
            title="Este produto tem menos de 3 fotos — pode ser recusado na publicação no ML"
            className={`absolute rounded-full border border-[#E6E6E8] bg-white/95 font-medium tracking-tight text-[#6B7280] backdrop-blur-sm items-center gap-1 cursor-help ${denseMobile ? "hidden md:flex md:right-4 md:top-4 md:px-2 md:py-1 md:text-[9px]" : "right-4 top-4 flex px-2 py-1 text-[9px]"}`}
          >
            <AlertCircle size={10} className="text-[#6B7280]" />
            <span>Fotos insuficientes</span>
          </span>
        )}

        {denseMobile && !collectionSelection && (
          <ProductFavoriteButton
            isFavorited={isFavorited}
            onToggleFavorite={onToggleFavorite}
            className="md:hidden"
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
            className={`absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-sm transition-all ${
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

      <div className={denseMobile ? "p-2.5 md:p-4" : compact ? "p-3.5" : "p-4"}>
        <h2
          className={`line-clamp-2 font-semibold tracking-[-0.025em] text-[#111111] hover:text-[#2563EB] transition-colors ${
            denseMobile ? "min-h-[36px] text-[12px] leading-[18px] md:min-h-[44px] md:text-[15px] md:leading-normal" : compact ? "min-h-[40px] text-[14px]" : "min-h-[44px] text-[15px]"
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

        {hasMetrics && (
          <div className={`flex items-center text-[#6B7280] ${denseMobile ? "mt-1 gap-1 text-[10px] md:mt-2 md:gap-1.5 md:text-[12px]" : "mt-2 gap-1.5 text-[12px]"}`}>
            {rating !== null && (
              <>
                <Star size={13} strokeWidth={1.8} className="fill-[#111111] text-[#111111]" />
                <span className="font-medium text-[#111111]">{rating.toFixed(1)}</span>
              </>
            )}
            {rating !== null && ordersCount !== null && <span>·</span>}
            {ordersCount !== null && <span>{formatReviewCount(ordersCount)} vendidos</span>}
          </div>
        )}

        <div className={`font-semibold tracking-[-0.04em] text-[#111111] ${denseMobile ? "mt-1.5 text-[16px] md:mt-3 md:text-[22px]" : compact ? "mt-2.5 text-[21px]" : "mt-3 text-[22px]"}`}>
          {formatPrice(product.preco)}
        </div>

        <div className={`grid gap-2 ${denseMobile ? "mt-2 grid-cols-1 md:mt-3.5 md:grid-cols-2" : "mt-3.5 grid-cols-2"}`}>
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`items-center justify-center gap-2 rounded-[14px] border border-[#E5E7EB] bg-white text-[12px] font-medium text-[#111111] transition-colors hover:bg-[#F7F7F8] ${
              denseMobile ? "hidden md:inline-flex" : "inline-flex"
            } ${
              compact ? "h-9 px-2.5" : "h-10 px-3"
            }`}
          >
            <Heart
              size={14}
              strokeWidth={1.9}
              className={isFavorited ? "fill-red-500 text-red-500" : ""}
            />
            <span className={denseMobile ? "hidden md:inline" : ""}>Favoritar</span>
          </button>
          <Link
            to={`/dashboard/catalogo/${product.id}`}
            onClick={() => {
              veloToast.loading("Carregando produto...", {
                id: `loading-product-${product.id}`,
                fullscreen: true,
                minDuration: 3000,
              });
            }}
            className={`inline-flex items-center justify-center rounded-[14px] bg-[#111111] text-[12px] font-medium text-white transition-opacity hover:opacity-90 ${
              denseMobile ? "h-8 px-2 text-[10px] md:h-10 md:px-3 md:text-[12px]" : compact ? "h-9 px-2.5" : "h-10 px-3"
            }`}
          >
            Importar
          </Link>
        </div>
      </div>
    </article>
  );
};
