import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase, withFreshSupabaseSession } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  Star,
  Heart,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  FilePlus2,
  PackagePlus,
} from "lucide-react";
import { formatPrice, formatReviewCount, getProductCatalogMetrics } from "@/components/dashboard/ProductCard";
import ImportProductModal from "@/components/dashboard/ImportProductModal";
import { getActiveStore } from "@/components/dashboard/FirstStoreOnboarding";
import { veloToast } from "@/components/ui/velo-toast";

const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-[16px] border border-black/[0.10] bg-white transition-colors hover:border-black/20">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-[14px] font-semibold text-[#111]"
      >
        <span>{question}</span>
        <ChevronDown
          size={16}
          className={`text-[#9CA3AF] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div className={`overflow-hidden px-5 transition-all duration-300 ${open ? "max-h-40 pb-5 opacity-100" : "max-h-0 opacity-0"}`}>
        <p className="max-w-3xl text-[13px] leading-6 text-[#6B7280]">{answer}</p>
      </div>
    </div>
  );
};

// ============================================================
// Tipo local — inclui galeria de imagens
// ============================================================
type DetailedProduct = {
  id: string;
  title: string;
  category: string;
  price: number; // preco de custo
  suggestedPrice: number; // preco sugerido de venda
  originalPrice: number | null;
  images: string[];
  product_url: string | null;
  supplier_name: string | null;
  description: string | null;
  rating: number | null;
  stockQuantity: number | null;
  ordersCount: number | null;
  marginPercent: number;
  weight: number | null;
};

type CatalogProductRow = Database["public"]["Tables"]["catalog_products"]["Row"];

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop";

function extractImages(raw: unknown): string[] {
  if (!raw) return [];
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return proxyImageList([raw]);
    }
  }
  if (!Array.isArray(arr)) return [];
  const list = arr.filter((url): url is string => typeof url === "string" && url.length > 0);
  return proxyImageList(list);
}

function mapProduct(p: CatalogProductRow): DetailedProduct {
  const imgs = extractImages(p.images);
  const cost = p.cost_price || 0;
  const suggested = p.suggested_price || (cost ? cost * 2 : 0);
  const supplierLabel =
    p.source === "aliexpress"
      ? "AliExpress"
      : p.supplier_name ?? (p.source === "c7drop" ? "C7 Drop" : null);
  return {
    id: p.id,
    title: p.title || "Produto sem nome",
    category: p.category || "Produto",
    price: cost,
    suggestedPrice: suggested,
    originalPrice:
      p.original_price && p.original_price > suggested
        ? Number(p.original_price)
        : suggested && cost && suggested > cost
        ? null
        : null,
    images: imgs.length > 0 ? imgs : [FALLBACK_IMG],
    product_url: p.product_url ?? null,
    supplier_name: supplierLabel,
    description: p.description ?? null,
    rating: typeof p.rating === "number" ? p.rating : null,
    stockQuantity: typeof p.stock_quantity === "number" ? p.stock_quantity : null,
    ordersCount: typeof p.orders_count === "number" ? p.orders_count : null,
    marginPercent: typeof p.margin_percent === "number" ? p.margin_percent : 0,
    weight: typeof p.weight === "number" ? p.weight : null,
  };
}

// ============================================================
// Página
// ============================================================
const CatalogoProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<DetailedProduct | null>(null);
  const [related, setRelated] = useState<DetailedProduct[]>([]);
  const [activeImg, setActiveImg] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [relatedIndex, setRelatedIndex] = useState(0);
  const [rawProduct, setRawProduct] = useState<CatalogProductRow | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showSalesPageSoon, setShowSalesPageSoon] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!id) return;
      const toastId = veloToast.loading("Carregando produto...", {
        id: `loading-product-${id}`,
        fullscreen: true,
        minDuration: 650,
      });
      setLoading(true);
      setError(null);
      setActiveImg(0);
      try {
        const { data, error: e } = await withFreshSupabaseSession(() =>
          supabase
            .from("catalog_products")
            .select("*")
            .eq("id", id)
            .single(),
        );
        if (e) throw e;
        if (!data) throw new Error("Produto não encontrado.");

        const mapped = mapProduct(data);
        setProduct(mapped);
        setRawProduct(data);

        const { data: rel } = await withFreshSupabaseSession(() =>
          supabase
            .from("catalog_products")
            .select("*")
            .eq("is_blocked", false)
            .neq("id", id)
            .eq("category", data.category || "")
            .limit(12),
        );
        if (rel && rel.length > 0) {
          setRelated(rel.map(mapProduct));
        } else {
          const { data: fb } = await withFreshSupabaseSession(() =>
            supabase
              .from("catalog_products")
              .select("*")
              .eq("is_blocked", false)
              .neq("id", id)
              .limit(12),
          );
          if (fb) setRelated(fb.map(mapProduct));
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Não foi possível carregar os detalhes do produto.");
      } finally {
        await veloToast.waitForMinimum(toastId);
        if (!cancelled) {
          veloToast.dismiss(toastId);
          setLoading(false);
        }
      }
    };

    void fetchData();
    return () => {
      cancelled = true;
      veloToast.dismiss(`loading-product-${id}`);
    };
  }, [id]);

  const relatedWindow = useMemo(() => {
    if (related.length === 0) return [];
    return Array.from({ length: Math.min(4, related.length) }, (_, o) => related[(relatedIndex + o) % related.length]);
  }, [related, relatedIndex]);



  if (loading) {
    return (
      <div className="-m-5 min-h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)] bg-white p-6 text-[#111111] sm:-m-6 sm:min-h-[calc(100%+3rem)] sm:w-[calc(100%+3rem)] sm:p-8 lg:-m-7 lg:min-h-[calc(100%+3.5rem)] lg:w-[calc(100%+3.5rem)] lg:p-10">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="animate-pulse">
            <div className="h-[520px] rounded-[28px] bg-[#f3f4f6]" />
            <div className="mt-5 grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 rounded-2xl bg-[#f3f4f6]" />
              ))}
            </div>
          </div>
          <div className="animate-pulse rounded-[28px] border border-black/[0.08] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="h-5 w-28 rounded-full bg-[#eef0f3]" />
            <div className="mt-6 h-8 w-4/5 rounded-full bg-[#eef0f3]" />
            <div className="mt-3 h-8 w-3/5 rounded-full bg-[#eef0f3]" />
            <div className="mt-8 h-12 w-48 rounded-full bg-[#eef0f3]" />
            <div className="mt-8 space-y-3">
              <div className="h-4 w-full rounded-full bg-[#eef0f3]" />
              <div className="h-4 w-11/12 rounded-full bg-[#eef0f3]" />
              <div className="h-4 w-3/4 rounded-full bg-[#eef0f3]" />
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="h-12 rounded-full bg-[#111]" />
              <div className="h-12 rounded-full bg-[#eef0f3]" />
              <div className="h-12 rounded-full bg-[#eef0f3]" />
            </div>
          </div>
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
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white"
          >
            <ArrowLeft size={14} />
            Voltar ao Catálogo
          </Link>
        </div>
      </div>
    );
  }

  const gallery = product.images;
  const catalogMetrics = getProductCatalogMetrics(product);
  const [suggestedPriceMain, suggestedPriceCents = "00"] = formatPrice(product.suggestedPrice).split(",");
  const handleCreateSalesPage = () => {
    const activeStore = getActiveStore();
    if (activeStore) {
      setShowSalesPageSoon(true);
      return;
    }

    const flowProduct = {
      id: product.id,
      title: product.title,
      price: product.price,
      imageUrl: product.images[0] || FALLBACK_IMG,
    };

    try {
      sessionStorage.setItem("velo-example-product", JSON.stringify(flowProduct));
      sessionStorage.setItem("velo-example-products", JSON.stringify([flowProduct]));
    } catch {
      // O fluxo também recebe o produto via state; storage é apenas continuidade entre reloads.
    }

    navigate("/onboarding/idioma", { state: { product: flowProduct, products: [flowProduct] } });
  };

  return (
    <div className="-m-5 min-h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)] bg-white text-[#111111] sm:-m-6 sm:min-h-[calc(100%+3rem)] sm:w-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)] lg:w-[calc(100%+3.5rem)]">
      <div className="w-full px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        
        {/* CABEÇALHO DA PÁGINA */}
        <div className="mb-8 hidden items-center justify-between border-b border-black/[0.07] pb-5 lg:flex">
          <button
            type="button"
            onClick={() => navigate("/dashboard/catalogo")}
            className="flex items-center gap-2 text-[12px] font-semibold text-[#6B7280] transition-colors hover:text-[#111]"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            <span>Catálogo / {product.category || "Produto"}</span>
          </button>
          <div className="rounded-full bg-[#F3F3F2] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
            {product.supplier_name ?? "Fornecedor verificado"}
          </div>
        </div>

        {/* SEÇÃO PRINCIPAL (duas colunas) */}
        <div className="-mx-5 -mt-6 pb-10 lg:hidden">
          <section className="bg-white">
            <div className="relative h-[394px] overflow-hidden bg-[#F5F5F4]">
              <div className="absolute right-4 top-4 z-10 flex items-center">
                <button
                  type="button"
                  aria-label={favorited ? "Remover dos favoritos" : "Salvar para depois"}
                  aria-pressed={favorited}
                  onClick={() => setFavorited((value) => !value)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#111111] ring-1 ring-black/[0.06] backdrop-blur-sm transition-transform active:scale-95"
                >
                  <Heart size={18} strokeWidth={2} className={favorited ? "fill-red-500 text-red-500" : ""} />
                </button>
              </div>

              <img
                src={gallery[activeImg] || gallery[0] || FALLBACK_IMG}
                alt={product.title}
                className="absolute inset-0 h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />

              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Imagem anterior"
                    onClick={() => setActiveImg((current) => (current - 1 + gallery.length) % gallery.length)}
                    className="absolute inset-y-14 left-0 z-[1] w-1/2"
                  />
                  <button
                    type="button"
                    aria-label="Próxima imagem"
                    onClick={() => setActiveImg((current) => (current + 1) % gallery.length)}
                    className="absolute inset-y-14 right-0 z-[1] w-1/2"
                  />

                  <button
                    type="button"
                    aria-label="Imagem anterior"
                    onClick={() => setActiveImg((current) => (current - 1 + gallery.length) % gallery.length)}
                    className="absolute left-3 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[#111111] ring-1 ring-black/[0.06] backdrop-blur-sm transition-transform active:scale-95"
                  >
                    <ChevronLeft size={20} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    aria-label="Próxima imagem"
                    onClick={() => setActiveImg((current) => (current + 1) % gallery.length)}
                    className="absolute right-3 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[#111111] ring-1 ring-black/[0.06] backdrop-blur-sm transition-transform active:scale-95"
                  >
                    <ChevronRight size={20} strokeWidth={2} />
                  </button>
                </>
              )}

              {gallery.length > 1 && (
                <span className="absolute bottom-4 right-4 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-bold text-white">
                  {activeImg + 1}/{gallery.length}
                </span>
              )}
            </div>
          </section>

          <section className="px-5 pt-5">
            <span className="mb-3 inline-flex rounded-full bg-[#F3F3F2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#52525B]">
              {product.category ? (product.category.charAt(0).toUpperCase() + product.category.slice(1).toLowerCase()) : "Produto"}
            </span>

            <h1 className="max-w-[340px] text-[18px] font-medium leading-[1.18] tracking-[-0.015em] text-[#111111]">
              {product.title}
            </h1>

            <div className="mt-3 flex items-center gap-2 text-[12px]">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={13}
                    className={
                      i < Math.round(catalogMetrics.rating)
                        ? "fill-[#111] text-[#111]"
                        : "fill-[#E5E7EB] text-[#E5E7EB]"
                    }
                  />
                ))}
              </div>
              <span className="font-semibold text-[#111111]">{catalogMetrics.rating.toFixed(1)}</span>
              <span className="font-medium text-[#6B7280]">{formatReviewCount(catalogMetrics.ordersCount)} vendidos</span>
            </div>

            <div className="mt-5 border-t border-black/[0.08] pt-5">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">Preço sugerido de venda</p>
              <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
                <span className="text-[34px] font-semibold leading-none tracking-[-0.045em] text-[#111111]">
                  {suggestedPriceMain}
                  <sup className="ml-0.5 align-super text-[17px] font-semibold leading-none tracking-[-0.02em]">
                    {suggestedPriceCents}
                  </sup>
                </span>
                <span className="pb-0.5 text-[12px] text-[#71717A] line-through">
                  Custo {formatPrice(product.price)}
                </span>
              </div>
              <p className="mt-2 text-[11.5px] leading-5 text-[#71717A]">
                Lucro bruto estimado de {formatPrice(Math.max(0, product.suggestedPrice - product.price))}.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                data-dashboard-tour="produto-importar"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-5 text-[13px] font-semibold text-white shadow-[0_10px_25px_rgba(0,0,0,0.16)] transition-transform active:scale-[0.98]"
              >
                <PackagePlus size={17} strokeWidth={1.8} />
                Importar para minha loja
              </button>
              <button
                type="button"
                onClick={handleCreateSalesPage}
                data-dashboard-tour="produto-criar-pagina"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-[13px] font-semibold text-[#111111] transition-colors hover:bg-[#F7F7F6]"
              >
                <FilePlus2 size={16} strokeWidth={1.8} />
                Criar página de vendas
              </button>
              {product.product_url ? (
                <a
                  href={product.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-[13px] font-semibold text-[#111111]"
                >
                  Ver no fornecedor
                  <ExternalLink size={16} strokeWidth={1.8} />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => veloToast.info("O fornecedor não disponibilizou um link para este produto.")}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-[13px] font-semibold text-[#111111]"
                >
                  Ver no fornecedor
                  <ExternalLink size={16} strokeWidth={1.8} />
                </button>
              )}
            </div>
          </section>

        </div>

        <div className="hidden items-start gap-10 pb-14 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] lg:gap-14">
          {/* COLUNA ESQUERDA — GALERIA */}
          <div className="min-w-0">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[26px] border border-black/[0.06] bg-[#F1F1F0]">
              <button
                type="button"
                aria-label={favorited ? "Remover dos favoritos" : "Salvar para depois"}
                aria-pressed={favorited}
                onClick={() => setFavorited((value) => !value)}
                className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/95 text-[#111111] shadow-[0_8px_18px_rgba(17,24,39,0.14)] backdrop-blur-sm transition-transform active:scale-95"
              >
                <Heart size={18} strokeWidth={2} className={favorited ? "fill-red-500 text-red-500" : ""} />
              </button>
              <img
                src={gallery[activeImg] || gallery[0] || FALLBACK_IMG}
                alt={product.title}
                className="h-full w-full object-contain transition-opacity duration-300"
                referrerPolicy="no-referrer"
              />

              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Imagem anterior"
                    onClick={() => setActiveImg((current) => (current - 1 + gallery.length) % gallery.length)}
                    className="absolute left-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/95 text-[#111111] shadow-[0_8px_18px_rgba(17,24,39,0.14)] backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
                  >
                    <ChevronLeft size={20} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    aria-label="Próxima imagem"
                    onClick={() => setActiveImg((current) => (current + 1) % gallery.length)}
                    className="absolute right-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/95 text-[#111111] shadow-[0_8px_18px_rgba(17,24,39,0.14)] backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
                  >
                    <ChevronRight size={20} strokeWidth={2} />
                  </button>
                  <span className="absolute bottom-3 right-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-bold text-white">
                    {activeImg + 1}/{gallery.length}
                  </span>
                </>
              )}
            </div>
            {gallery.length > 1 && (
              <>
                <div className="scrollbar-gallery mt-3 flex flex-row gap-3 overflow-x-auto pb-3">
                  {gallery.map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveImg(i)}
                      className={`aspect-square w-[76px] shrink-0 overflow-hidden rounded-[16px] border bg-[#F4F4F3] transition-all ${
                        activeImg === i ? "border-[#111] shadow-[0_0_0_1px_#111]" : "border-black/[0.07] hover:border-black/25"
                      }`}
                    >
                      <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
                <style>{`
                  .scrollbar-gallery::-webkit-scrollbar {
                    height: 5px;
                  }
                  .scrollbar-gallery::-webkit-scrollbar-track {
                    background: #F3F4F6;
                    border-radius: 9999px;
                  }
                  .scrollbar-gallery::-webkit-scrollbar-thumb {
                    background: #111;
                    border-radius: 9999px;
                  }
                  .scrollbar-gallery::-webkit-scrollbar-thumb:hover {
                    background: #374151;
                  }
                `}</style>
              </>
            )}
          </div>

          {/* COLUNA DIREITA — INFO */}
          <div className="flex flex-col lg:sticky lg:top-5">
            {/* Categoria */}
            <span className="mb-4 inline-flex self-start rounded-full bg-[#F3F3F2] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#52525B]">
              {product.category ? (product.category.charAt(0).toUpperCase() + product.category.slice(1).toLowerCase()) : "Produto"}
            </span>

            {/* Nome do produto */}
            <h1 className="mb-4 max-w-[680px] text-[34px] font-semibold leading-[0.98] tracking-[-0.055em] text-[#0A0A0A] sm:text-[44px]">
              {product.title}
            </h1>

            {/* Avaliação */}
            <div className="mb-6 flex items-center gap-2 text-[13px]">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={13}
                    className={
                      i < Math.round(catalogMetrics.rating)
                        ? "fill-[#111] text-[#111]"
                        : "text-[#E5E7EB] fill-[#E5E7EB]"
                    }
                  />
                ))}
              </div>
              <span className="font-semibold text-[#111]">{catalogMetrics.rating.toFixed(1)}</span>
              <span className="text-[#6B7280]">{formatReviewCount(catalogMetrics.ordersCount)} vendidos</span>
            </div>

            {/* Bloco de Precificação e Simulador de Lucro */}
            <div className="mb-6 border-y border-black/[0.08] py-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">Preço sugerido de venda</p>
              <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
                <span className="text-[40px] font-semibold leading-none tracking-[-0.055em] text-[#0A0A0A]">
                  {formatPrice(product.suggestedPrice)}
                </span>
                <span className="pb-1 text-[14px] text-[#71717A] line-through">
                  Custo {formatPrice(product.price)}
                </span>
                <span className="mb-0.5 rounded-md bg-[#ECECEC] px-2 py-1 text-[11px] font-bold text-[#222222]">
                  Margem {product.marginPercent > 0 ? `${product.marginPercent.toFixed(0)}%` : "estimada"}
                </span>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-[#71717A]">
                Lucro bruto estimado de {formatPrice(Math.max(0, product.suggestedPrice - product.price))}. O preço pode ser ajustado antes da publicação.
              </p>
            </div>

            {/* Descrição real do fornecedor */}
            {product.description ? (
              <div
                className="mb-6 text-[14px] leading-6 text-[#3F3F46] prose prose-sm max-w-none [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-black/10 [&_td]:px-3 [&_td]:py-2 [&_td]:text-[13px] [&_th]:border [&_th]:border-black/10 [&_th]:px-3 [&_th]:py-2 [&_th]:text-[13px] [&_th]:font-semibold [&_h3]:text-[14px] [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_img]:hidden"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            ) : (
              <p className="mb-6 text-[14px] leading-6 text-[#3F3F46]">
                O fornecedor ainda não disponibilizou uma descrição detalhada para este produto.
              </p>
            )}

            {/* CTAs principais */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                data-dashboard-tour="produto-importar"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#0A0A0A] px-5 text-[13px] font-semibold text-white shadow-[0_10px_25px_rgba(0,0,0,0.16)] transition-all hover:-translate-y-0.5 hover:bg-[#202020]"
              >
                <PackagePlus size={17} strokeWidth={1.8} />
                Importar para minha loja
              </button>
              <button
                type="button"
                onClick={handleCreateSalesPage}
                data-dashboard-tour="produto-criar-pagina"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-[13px] font-semibold text-[#111111] transition-all hover:-translate-y-0.5 hover:border-black/30 hover:bg-[#F7F7F6]"
              >
                <FilePlus2 size={16} strokeWidth={1.8} />
                Criar página de vendas
              </button>
              {product.product_url ? (
                <a
                  href={product.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-[13px] font-semibold text-[#111111] transition-all hover:-translate-y-0.5 hover:border-black/30 hover:bg-[#F7F7F6]"
                >
                  Ver no fornecedor
                  <ExternalLink size={16} strokeWidth={1.8} />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => veloToast.info("O fornecedor não disponibilizou um link para este produto.")}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-[13px] font-semibold text-[#111111] transition-colors hover:bg-[#F7F7F6]"
                >
                  Ver no fornecedor
                  <ExternalLink size={16} strokeWidth={1.8} />
                </button>
              )}
            </div>

          </div>
        </div>

        {/* FAQ */}
        <section className="border-t border-black/[0.07] bg-[#F7F7F6] px-5 py-10 sm:px-8">
          <h2 className="mb-6 text-[26px] font-semibold tracking-[-0.04em] text-[#111]">
            Perguntas frequentes
          </h2>
          <div className="space-y-3">
            <FAQItem
              question="Qual o prazo de importação para minha loja?"
              answer="A importação é processada e concluída rapidamente. Assim que confirmada, o produto fica disponível na sua conta para personalização e publicação."
            />
            <FAQItem
              question="Esse produto tem garantia?"
              answer="Sim. A garantia segue a política do fornecedor de origem contra defeitos de fabricação."
            />
            <FAQItem
              question="Como funciona o frete?"
              answer="Varia conforme dimensões e origem. O valor estimado é exibido durante a etapa de publicação do anúncio."
            />
          </div>
        </section>

        {/* RELACIONADOS */}
        {related.length > 0 && (
          <section className="border-t border-black/[0.07] py-10">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[26px] font-semibold tracking-[-0.04em] text-[#111]">
                Produtos relacionados
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setRelatedIndex((c) => (c - 1 + related.length) % related.length)
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-[#111] transition-colors hover:bg-[#F1F1F0]"
                  aria-label="Anterior"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setRelatedIndex((c) => (c + 1) % related.length)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-[#111] transition-colors hover:bg-[#F1F1F0]"
                  aria-label="Próximo"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {relatedWindow.map((p) => {
                const relatedMetrics = getProductCatalogMetrics(p);

                return (
                  <Link
                    key={p.id}
                    to={`/dashboard/catalogo/${p.id}`}
                    onClick={() => {
                      veloToast.loading("Carregando produto...", {
                        id: `loading-product-${p.id}`,
                        fullscreen: true,
                        minDuration: 3000,
                      });
                    }}
                    className="group min-w-0"
                  >
                    <div className="aspect-square overflow-hidden rounded-[20px] border border-black/[0.05] bg-[#F1F1F0]">
                      <img
                        src={p.images[0]}
                        alt={p.title}
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.035]"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="mt-3">
                      <div className="line-clamp-2 text-[13px] font-semibold leading-5 text-[#111]">{p.title}</div>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-[#71717A]">
                        <Star size={11} className="fill-[#111] text-[#111]" />
                        <span>{relatedMetrics.rating.toFixed(1)}</span>
                        <span>·</span>
                        <span>{formatReviewCount(relatedMetrics.ordersCount)} vendidos</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[15px] font-bold text-[#111]">
                          {formatPrice(p.suggestedPrice)}
                        </span>
                        {p.originalPrice && (
                          <span className="text-[11.5px] text-[#9CA3AF] line-through">
                            {formatPrice(p.originalPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

      </div>

      <ImportProductModal
        open={isImportModalOpen}
        product={rawProduct}
        onClose={() => setIsImportModalOpen(false)}
      />

      {showSalesPageSoon ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4 backdrop-blur-[6px]">
          <div className="w-full max-w-[420px] rounded-[28px] border border-black/[0.08] bg-white p-6 text-center shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F4F4F3] text-[#111]">
              <FilePlus2 size={23} strokeWidth={1.7} />
            </div>
            <h2 className="mt-5 text-[22px] font-semibold tracking-[-0.04em] text-[#111]">
              Página de vendas individual em breve
            </h2>
            <p className="mx-auto mt-3 max-w-[320px] text-[14px] leading-6 text-[#6B7280]">
              Sua loja ativa foi preservada. Em breve você poderá criar uma página de vendas separada para este produto sem refazer o onboarding.
            </p>
            <button
              type="button"
              onClick={() => setShowSalesPageSoon(false)}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0A0A0A] px-5 text-[13px] font-semibold text-white transition hover:bg-[#202020]"
            >
              Entendi
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CatalogoProductDetailPage;
