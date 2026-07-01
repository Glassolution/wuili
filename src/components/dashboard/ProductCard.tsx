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
}

export const formatPrice = (price: number) =>
  price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

// MOCK: avaliação simulada até termos dados reais de review
export function getMockRating(productId: string) {
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
  collectionSelection,
}: {
  product: Product;
  categoryLabel: string;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  compact?: boolean;
  collectionSelection?: {
    selected: boolean;
    loading?: boolean;
    onToggle: () => void;
  };
}) => {
  const { rating, reviewCount } = getMockRating(product.id);

  return (
    <article
      className={`overflow-hidden rounded-[22px] border border-[#ECECEF] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.05)] transition-transform duration-200 hover:-translate-y-0.5 ${
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
