import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Star, Heart, ArrowLeft, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import {
  ProductCard,
  getMockRating,
  formatPrice,
  formatReviewCount,
  Product,
} from "./CatalogoPage";

// MOCK: descrição genérica até termos dados reais de produto
function getMockDescription(name: string, category: string, productId: string) {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = (hash * 31 + productId.charCodeAt(i)) % 10000;
  }
  const templates = [
    `Conheça o ${name}, uma excelente opção da categoria ${category}. Este produto de alta qualidade é ideal para quem busca praticidade, durabilidade e um excelente custo-benefício para o dia a dia.`,
    `Apresentamos o ${name}, projetado especialmente para atender às suas necessidades em ${category}. Uma escolha inteligente que une inovação, eficiência e um design moderno de ótima qualidade.`,
    `O ${name} é o destaque em ${category}. Desenvolvido com materiais de alto padrão, ele oferece a versatilidade e o desempenho que você procura para elevar sua experiência diária.`
  ];
  return templates[hash % templates.length];
}

const CatalogoProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<string[]>([]);
  const [relatedIndex, setRelatedIndex] = useState(0);

  const toggleFavorite = (productId: string) => {
    setFavoritedIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const isFavorited = id ? favoritedIds.includes(id) : false;

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

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from("catalog_products")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("Produto não encontrado.");

        const mapped = mapProduct(data);
        setProduct(mapped);

        // Buscar produtos relacionados
        const { data: relatedData, error: relatedError } = await supabase
          .from("catalog_products")
          .select("*")
          .eq("is_blocked", false)
          .in("source", ["b2drop", "c7drop"])
          .neq("id", id)
          .eq("category", data.category || "")
          .limit(10);

        if (!relatedError && relatedData) {
          setRelatedProducts(relatedData.map(mapProduct));
        } else {
          // Fallback se não houver produtos da mesma categoria: busca geral
          const { data: fallbackData } = await supabase
            .from("catalog_products")
            .select("*")
            .eq("is_blocked", false)
            .in("source", ["b2drop", "c7drop"])
            .neq("id", id)
            .limit(10);
          if (fallbackData) {
            setRelatedProducts(fallbackData.map(mapProduct));
          }
        }
      } catch (err: any) {
        console.error("Erro ao buscar detalhes do produto:", err);
        setError("Não foi possível carregar os detalhes do produto.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const relatedWindow = useMemo(() => {
    if (relatedProducts.length === 0) return [];
    return Array.from({ length: Math.min(4, relatedProducts.length) }, (_, offset) => {
      const index = (relatedIndex + offset) % relatedProducts.length;
      return relatedProducts[index];
    });
  }, [relatedIndex, relatedProducts]);

  if (isLoading) {
    return (
      <div className="pt-6 min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw size={24} className="animate-spin text-[#111111]" />
          <span className="text-[14px] text-[#6B7280]">Carregando detalhes do produto...</span>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="pt-6 min-h-screen p-6">
        <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 p-6 text-center text-red-600 max-w-xl mx-auto">
          <p className="font-medium">{error || "Produto não encontrado."}</p>
          <Link
            to="/dashboard/catalogo"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <ArrowLeft size={14} />
            Voltar ao Catálogo
          </Link>
        </div>
      </div>
    );
  }

  const { rating, reviewCount } = getMockRating(product.id);
  const description = getMockDescription(product.nome, product.categoria, product.id);

  return (
    <div className="pt-4 min-h-full w-full overflow-visible pb-12" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      {/* Breadcrumb */}
      <nav className="mb-6 text-[14px] text-[#6B7280] flex items-center flex-wrap gap-1">
        <Link to="/dashboard/catalogo" className="hover:text-[#111111] transition-colors">
          Catálogo
        </Link>
        <span className="text-[#9CA3AF]">&gt;</span>
        <span className="text-[#9CA3AF]">{product.categoria}</span>
        <span className="text-[#9CA3AF]">&gt;</span>
        <span className="text-[#111111] font-semibold truncate max-w-[200px] sm:max-w-xs">
          {product.nome}
        </span>
      </nav>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start bg-white p-6 rounded-[28px] border border-[#ECECEF] shadow-[0_10px_30px_rgba(17,24,39,0.02)]">
        {/* Left Column: Image */}
        <div className="aspect-square rounded-2xl overflow-hidden bg-[#F6F6F7] border border-[#ECECEF] flex items-center justify-center">
          <img
            src={product.image_url}
            alt={product.nome}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Right Column: Info */}
        <div className="flex flex-col h-full justify-between py-2">
          <div>
            {/* Category Badge */}
            <span className="inline-flex rounded-full border border-[#E6E6E8] bg-[#F9FAFB] px-2.5 py-1 text-[10px] font-semibold tracking-[-0.01em] text-[#6B7280] mb-4">
              {product.categoria}
            </span>

            {/* Product Title */}
            <h1 className="text-[28px] sm:text-[34px] font-semibold leading-tight tracking-[-0.04em] text-[#111111] mb-3">
              {product.nome}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-1.5 text-[14px] text-[#6B7280] mb-6">
              <Star size={16} strokeWidth={1.8} className="fill-[#111111] text-[#111111]" />
              <span className="font-semibold text-[#111111]">{rating}</span>
              <span>({formatReviewCount(reviewCount)} avaliações)</span>
            </div>

            {/* Price */}
            <div className="text-[32px] font-bold tracking-[-0.05em] text-[#111111] mb-6">
              {formatPrice(product.preco)}
            </div>

            {/* Description */}
            <div className="mb-8">
              <h3 className="text-[14px] font-semibold uppercase tracking-[0.1em] text-[#9CA3AF] mb-2">
                Descrição
              </h3>
              <p className="text-[15px] leading-relaxed text-[#4B5563]">
                {description}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#ECECEF]">
            <button
              type="button"
              className="flex-1 h-12 bg-[#111111] text-[13px] font-medium text-white rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center"
            >
              Importar para minha loja
            </button>
            
            {product.product_url && (
              <a
                href={product.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-12 border border-[#E5E7EB] bg-white text-[13px] font-medium text-[#111111] rounded-xl hover:bg-[#F7F7F8] transition-colors flex items-center justify-center"
              >
                Ver no fornecedor
              </a>
            )}

            <button
              type="button"
              onClick={() => toggleFavorite(product.id)}
              className="h-12 w-12 border border-[#E5E7EB] bg-white text-[#111111] rounded-xl hover:bg-[#F7F7F8] transition-colors flex items-center justify-center shrink-0"
              aria-label="Favoritar"
            >
              <Heart
                size={18}
                strokeWidth={1.9}
                className={isFavorited ? "fill-red-500 text-red-500" : ""}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[28px] font-semibold tracking-[-0.045em] text-[#111111]">
                Produtos relacionados
              </h2>
              <p className="mt-1 text-[14px] text-[#6B7280]">
                Mais algumas opções recomendadas nesta mesma categoria.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setRelatedIndex((current) =>
                    (current - 1 + relatedProducts.length) % relatedProducts.length,
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
                  setRelatedIndex((current) => (current + 1) % relatedProducts.length)
                }
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111111] transition-colors hover:bg-[#F7F7F8]"
                aria-label="Próximas recomendações"
              >
                <ChevronRight size={16} strokeWidth={1.9} />
              </button>
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 xl:grid-cols-4 md:overflow-visible">
            {relatedWindow.map((item) => (
              <ProductCard
                key={`related-${item.id}`}
                product={item}
                categoryLabel={item.categoria}
                isFavorited={favoritedIds.includes(item.id)}
                onToggleFavorite={() => toggleFavorite(item.id)}
                compact
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default CatalogoProductDetailPage;
