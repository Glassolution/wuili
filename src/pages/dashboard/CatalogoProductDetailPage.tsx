import { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
  BadgeDollarSign,
  Boxes,
  Factory,
  PackageCheck,
  Scale,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { formatPrice, formatReviewCount, getProductCatalogMetrics } from "@/components/dashboard/ProductCard";
import ImportProductModal from "@/components/dashboard/ImportProductModal";
import { getPremiumActionButtonStyle } from "@/components/PremiumActionButton";
import { getActiveStore } from "@/components/dashboard/FirstStoreOnboarding";
import { veloToast } from "@/components/ui/velo-toast";
import { proxyImageList } from "@/lib/imageProxy";

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
  brand: string | null;
  model: string | null;
  source: string | null;
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
    brand: p.brand ?? null,
    model: p.model ?? null,
    source: p.source ?? null,
  };
}

// ============================================================
// Página
// ============================================================
// Altura máxima da descrição do fornecedor antes de recolher com "Expandir descrição".
const DESC_COLLAPSED_MAX = 340;

const PRODUCT_IMPORT_BUTTON_STYLE = getPremiumActionButtonStyle({
  background: "linear-gradient(180deg,#4F83F8 0%,#2563EB 62%,#1D4ED8 100%)",
});

const formatCategoryLabel = (category: string | null | undefined) =>
  category ? category.charAt(0).toUpperCase() + category.slice(1).toLowerCase() : "Produto";

const formatWeight = (weight: number | null) => {
  if (typeof weight !== "number" || Number.isNaN(weight) || weight <= 0) return "Não informado";
  return weight >= 1 ? `${weight.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg` : `${Math.round(weight * 1000)} g`;
};

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
  const [descExpanded, setDescExpanded] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);

  // O Atlas manda o usuário para cá com ?publicar=1 no fim do guia de iniciante:
  // o modal de publicação abre sozinho para ele não ter que procurar o botão.
  useEffect(() => {
    if (!rawProduct) return;
    const querPublicar = new URLSearchParams(window.location.search).get("publicar");
    if (querPublicar === "1") setIsImportModalOpen(true);
  }, [rawProduct]);

  // Ao trocar de produto, volta a descrição para o estado recolhido.
  useEffect(() => {
    setDescExpanded(false);
  }, [product?.description]);


  // Decide se o botão "Expandir descrição" precisa aparecer. scrollHeight reflete a
  // altura real do conteúdo mesmo com o clamp de max-height aplicado. Medimos de forma
  // PONTUAL (imediato + rAF + timeout para fontes/layout tardio) e em resize — NUNCA
  // com ResizeObserver no próprio elemento, pois o clamp muda o tamanho dele e criaria
  // um loop infinito de medição/setState.
  // Callback ref: dispara exatamente quando o nó da descrição é anexado ao DOM
  // (garante que o elemento existe — um useEffect podia rodar antes do nó montar).
  // O nó medido NÃO é clampado (o clamp fica no wrapper pai), então scrollHeight é a
  // altura real do conteúdo e medir aqui é seguro/estável.
  const measureDescNode = useCallback((node: HTMLDivElement | null) => {
    descRef.current = node;
    if (node) setDescOverflows(node.scrollHeight > DESC_COLLAPSED_MAX + 24);
  }, []);

  // Re-mede em resize da janela (a largura muda a altura do texto).
  useEffect(() => {
    const measure = () => {
      const el = descRef.current;
      if (el) setDescOverflows(el.scrollHeight > DESC_COLLAPSED_MAX + 24);
    };
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!id) return;
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
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const relatedWindow = useMemo(() => {
    if (related.length === 0) return [];
    return Array.from({ length: Math.min(4, related.length) }, (_, o) => related[(relatedIndex + o) % related.length]);
  }, [related, relatedIndex]);



  if (loading) {
    return (
      <div className="-m-5 min-h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)] bg-white p-6 text-[#111111] sm:-m-6 sm:min-h-[calc(100%+3rem)] sm:w-[calc(100%+3rem)] sm:p-8 lg:-m-7 lg:min-h-[calc(100%+3.5rem)] lg:w-[calc(100%+3.5rem)] lg:p-10">
        <div className="mx-auto grid max-w-[1200px] gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* GALERIA (miniaturas verticais + imagem principal) */}
          <div className="flex animate-pulse gap-4">
            <div className="flex w-[48px] shrink-0 flex-col gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-[48px] w-[48px] rounded-[8px] bg-[#f3f4f6]" />
              ))}
            </div>
            <div className="aspect-square min-w-0 flex-1 rounded-[8px] bg-[#f3f4f6]" />
          </div>
          {/* INFORMAÇÕES */}
          <div className="animate-pulse">
            <div className="h-4 w-28 rounded-full bg-[#eef0f3]" />
            <div className="mt-4 h-7 w-4/5 rounded-full bg-[#eef0f3]" />
            <div className="mt-3 h-7 w-3/5 rounded-full bg-[#eef0f3]" />
            <div className="mt-6 h-10 w-44 rounded-full bg-[#eef0f3]" />
            <div className="mt-8 space-y-3 border-t border-black/[0.08] pt-6">
              <div className="h-4 w-40 rounded-full bg-[#eef0f3]" />
              <div className="h-4 w-32 rounded-full bg-[#eef0f3]" />
            </div>
            <div className="mt-6 space-y-2">
              <div className="h-11 w-full rounded-[9px] bg-[#2563EB]" />
              <div className="h-11 w-full rounded-[9px] bg-[#EEF4FF]" />
              <div className="h-10 w-full rounded-[9px] bg-[#eef0f3]" />
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
  const socialProofCount = catalogMetrics.ordersCount ?? catalogMetrics.reviewsCount;
  const [suggestedPriceMain, suggestedPriceCents = "00"] = formatPrice(product.suggestedPrice).split(",");
  // O preço grande é o de VENDA sugerido, não o que o lojista paga. Custo, lucro
  // e margem ficam explícitos logo abaixo para ninguém confundir os dois valores.
  const estimatedProfit = Math.max(0, product.suggestedPrice - product.price);
  const marginPercent = product.marginPercent > 0
    ? product.marginPercent
    : product.price > 0
      ? (estimatedProfit / product.price) * 100
      : 0;
  const marginLabel = marginPercent > 0 ? `${marginPercent.toFixed(0)}%` : "estimada";
  const categoryLabel = formatCategoryLabel(product.category);
  const supplierLabel = product.supplier_name ?? "Fornecedor verificado";
  const productCharacteristics = [
    { icon: Factory, label: "Marca", value: product.brand || supplierLabel },
    { icon: Tag, label: "Modelo", value: product.model || "Não informado" },
    { icon: Boxes, label: "Estoque", value: product.stockQuantity !== null ? `${product.stockQuantity} unidades` : "Não informado" },
    { icon: Scale, label: "Peso", value: formatWeight(product.weight) },
    { icon: BadgeDollarSign, label: "Custo Velo", value: formatPrice(product.price) },
    { icon: PackageCheck, label: "Fornecedor", value: supplierLabel },
  ];
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
    <div className="-m-5 shrink-0 min-h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)] bg-white text-[#111111] sm:-m-6 sm:min-h-[calc(100%+3rem)] sm:w-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)] lg:w-[calc(100%+3.5rem)]">
      <div key={product.id} className="mx-auto min-h-screen w-full max-w-[1200px] animate-fade-in px-5 py-6 sm:px-8 sm:py-8 lg:px-8 lg:py-10">

        {/* CABEÇALHO DA PÁGINA */}
        <div className="mb-5 hidden items-center justify-between px-2 lg:flex">
          <button
            type="button"
            onClick={() => navigate("/dashboard/catalogo")}
            className="flex items-center gap-2 text-[12px] font-semibold text-[#6B7280] transition-colors hover:text-[#111]"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            <span>Catálogo / {categoryLabel}</span>
          </button>
          <div className="rounded-full bg-[#F3F3F2] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
            {supplierLabel}
          </div>
        </div>

        {/* SEÇÃO PRINCIPAL (duas colunas) */}
        <div className="-mx-5 -mt-6 pb-10 lg:hidden">
          <section className="bg-white">
            <div className="relative h-[290px] overflow-hidden bg-white">
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
                className="absolute inset-0 h-full w-full object-contain"
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

          <section className="px-5 pt-4">
            <span className="mb-3 inline-flex rounded-full bg-[#F3F3F2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#52525B]">
              {categoryLabel}
            </span>

            <h1 className="max-w-[340px] text-[15px] font-semibold leading-[1.2] tracking-[-0.015em] text-[#111111]">
              {product.title}
            </h1>

            {catalogMetrics.hasMetrics && (
              <div className="mt-3 flex items-center gap-2 text-[12px]">
                {catalogMetrics.rating !== null && (
                  <>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          className={
                            i < Math.round(catalogMetrics.rating)
                              ? "fill-[#2563EB] text-[#2563EB]"
                              : "fill-[#E5E7EB] text-[#E5E7EB]"
                          }
                        />
                      ))}
                    </div>
                    <span className="font-semibold text-[#2563EB]">{catalogMetrics.rating.toFixed(1)}</span>
                  </>
                )}
                {socialProofCount !== null && (
                  <span className="font-medium text-[#6B7280]">{formatReviewCount(socialProofCount)} vendidos</span>
                )}
              </div>
            )}

            <div className="mt-5 border-t border-black/[0.08] pt-5">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
                Por quanto você pode vender
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
                <span className="text-[26px] font-semibold leading-none tracking-[-0.045em] text-[#111111]">
                  {suggestedPriceMain}
                  <sup className="ml-0.5 align-super text-[14px] font-semibold leading-none tracking-[-0.02em]">
                    {suggestedPriceCents}
                  </sup>
                </span>
                <span className="mb-0.5 rounded-[6px] bg-[#F1F1EF] px-2 py-0.5 text-[11px] font-semibold text-[#111111]">
                  Margem {marginLabel}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 divide-x divide-black/[0.07] rounded-[12px] border border-black/[0.07] bg-[#FAFAF9]">
                <div className="px-3.5 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">Você paga ao fornecedor</p>
                  <p className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-[#111111]">{formatPrice(product.price)}</p>
                </div>
                <div className="px-3.5 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">Seu lucro por venda</p>
                  <p className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-[#111111]">{formatPrice(estimatedProfit)}</p>
                </div>
              </div>

              <p className="mt-2 text-[11.5px] leading-5 text-[#71717A]">
                Sugestão da Velo — você define o preço final antes de publicar.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                data-dashboard-tour="produto-importar"
                style={PRODUCT_IMPORT_BUTTON_STYLE}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[9px] px-5 text-[13px] font-semibold text-white transition hover:brightness-105 active:scale-[0.98]"
              >
                <PackagePlus size={17} strokeWidth={1.8} />
                Importar para minha loja
              </button>
              <button
                type="button"
                onClick={handleCreateSalesPage}
                data-dashboard-tour="produto-criar-pagina"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-[13px] font-semibold text-[#111111] transition-colors hover:bg-[#F7F7F6]"
              >
                <FilePlus2 size={16} strokeWidth={1.8} />
                Criar página de vendas
              </button>
              {product.product_url ? (
                <a
                  href={product.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-[13px] font-semibold text-[#111111]"
                >
                  Ver no fornecedor
                  <ExternalLink size={16} strokeWidth={1.8} />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => veloToast.info("O fornecedor não disponibilizou um link para este produto.")}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-[13px] font-semibold text-[#111111]"
                >
                  Ver no fornecedor
                  <ExternalLink size={16} strokeWidth={1.8} />
                </button>
              )}
            </div>
          </section>

        </div>

        <div className="hidden lg:block">
          <section className="grid min-h-[440px] grid-cols-[minmax(0,1fr)_340px] gap-8 py-6">
            <div className="flex min-w-0 gap-4">
              {/* MINIATURAS VERTICAIS (estilo Mercado Livre) */}
              <div className="flex w-[48px] shrink-0 flex-col gap-2">
                {gallery.slice(0, 7).map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImg(i)}
                    onMouseEnter={() => setActiveImg(i)}
                    className={`grid h-[48px] w-[48px] place-items-center overflow-hidden rounded-[8px] border bg-white p-[3px] transition ${
                      activeImg === i ? "border-[#2563EB] ring-1 ring-[#2563EB]" : "border-black/[0.12] hover:border-black/30"
                    }`}
                    aria-label={`Ver imagem ${i + 1}`}
                  >
                    <img src={src} alt="" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
                  </button>
                ))}
                {gallery.length > 7 ? (
                  <button
                    type="button"
                    onClick={() => setActiveImg(7)}
                    className="grid h-[48px] w-[48px] place-items-center rounded-[8px] border border-black/[0.12] bg-white text-[11px] font-semibold text-[#555] hover:border-black/30"
                  >
                    +{gallery.length - 7}
                  </button>
                ) : null}
              </div>

              {/* IMAGEM PRINCIPAL */}
              <div className="relative flex aspect-square min-w-0 flex-1 items-center justify-center rounded-[8px] bg-white">
                <img
                  src={gallery[activeImg] || gallery[0] || FALLBACK_IMG}
                  alt={product.title}
                  className="h-full max-h-[500px] w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <aside className="self-start bg-white py-2">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[12px] leading-5 text-[#8A8A86]">
                    Novo{socialProofCount !== null ? ` | ${formatReviewCount(socialProofCount)} vendidos` : ""}
                  </p>
                  <h1 className="mt-2 text-[20px] font-semibold leading-[1.18] tracking-[-0.02em] text-[#111]">
                    {product.title}
                  </h1>
                </div>
                <button
                  type="button"
                  aria-label={favorited ? "Remover dos favoritos" : "Salvar para depois"}
                  aria-pressed={favorited}
                  onClick={() => setFavorited((value) => !value)}
                  className="mt-1 text-[#2563EB]"
                >
                  <Heart size={20} strokeWidth={1.8} className={favorited ? "fill-[#2563EB]" : ""} />
                </button>
              </div>

              {catalogMetrics.rating !== null && (
                <div className="mt-3 flex items-center gap-2 text-[13px]">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={13}
                        className={i < Math.round(catalogMetrics.rating) ? "fill-[#2563EB] text-[#2563EB]" : "fill-[#E5E7EB] text-[#E5E7EB]"}
                      />
                    ))}
                  </div>
                  <span className="font-medium text-[#111]">{catalogMetrics.rating.toFixed(1)}</span>
                </div>
              )}

              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[#8A8A86]">
                  Por quanto você pode vender
                </p>
                <div className="mt-1.5 flex flex-wrap items-end gap-x-3 gap-y-1.5">
                  <span className="text-[32px] font-semibold leading-none tracking-[-0.04em] text-[#111]">
                    {formatPrice(product.suggestedPrice)}
                  </span>
                  <span className="mb-0.5 rounded-[6px] bg-[#F1F1EF] px-2 py-0.5 text-[11px] font-semibold text-[#111]">
                    Margem {marginLabel}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 divide-x divide-black/[0.07] rounded-[12px] border border-black/[0.07] bg-[#FAFAF9]">
                  <div className="px-3.5 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A8A86]">Você paga ao fornecedor</p>
                    <p className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-[#111]">{formatPrice(product.price)}</p>
                  </div>
                  <div className="px-3.5 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A8A86]">Seu lucro por venda</p>
                    <p className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-[#111]">{formatPrice(estimatedProfit)}</p>
                  </div>
                </div>

                <p className="mt-2 text-[12px] leading-5 text-[#6B6B67]">
                  Sugestão da Velo — você define o preço final antes de publicar.
                </p>
              </div>

              <div className="mt-5 space-y-1.5 border-t border-black/[0.08] pt-5">
                <p className="text-[14px] font-semibold text-[#111]">Estoque disponível</p>
                <p className="text-[13px] text-[#333]">
                  Quantidade: <span className="font-semibold">{product.stockQuantity ?? "Não informado"}</span>
                </p>
                <p className="text-[12px] text-[#6B6B67]">Fornecedor: {supplierLabel}</p>
              </div>

              <div className="mt-5 grid gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  data-dashboard-tour="produto-importar"
                  style={PRODUCT_IMPORT_BUTTON_STYLE}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[9px] px-5 text-[14px] font-semibold text-white transition hover:brightness-105"
                >
                  <PackagePlus size={17} strokeWidth={1.9} />
                  Importar para minha loja
                </button>
                <button
                  type="button"
                  onClick={handleCreateSalesPage}
                  data-dashboard-tour="produto-criar-pagina"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[9px] bg-[#EEF4FF] px-5 text-[14px] font-semibold text-[#2563EB] transition hover:bg-[#E2ECFF]"
                >
                  <FilePlus2 size={16} strokeWidth={1.9} />
                  Criar página de vendas
                </button>
                {product.product_url ? (
                  <a
                    href={product.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[9px] text-[13px] font-semibold text-[#2563EB] transition hover:bg-[#F5F9FF]"
                  >
                    Ver no fornecedor
                    <ExternalLink size={15} strokeWidth={1.8} />
                  </a>
                ) : (
                  <button
                  type="button"
                  onClick={() => veloToast.info("O fornecedor não disponibilizou um link para este produto.")}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[9px] text-[13px] font-semibold text-[#2563EB] transition hover:bg-[#F5F9FF]"
                >
                    Ver no fornecedor
                    <ExternalLink size={15} strokeWidth={1.8} />
                  </button>
                )}
              </div>

              <div className="mt-5 space-y-2.5 border-t border-black/[0.08] pt-4 text-[12px] leading-5 text-[#6B6B67]">
                <p className="flex gap-2">
                  <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#00A650]" />
                  Catálogo Velo validado via {supplierLabel}.
                </p>
                <p className="flex gap-2">
                  <PackageCheck size={16} className="mt-0.5 shrink-0 text-[#3483FA]" />
                  Produto pronto para personalização antes da publicação.
                </p>
              </div>
            </aside>
          </section>
        </div>

        <div className="mx-auto mt-6 max-w-[820px]">
        <section className="py-10">
          <h2 className="text-[24px] font-normal tracking-[-0.02em] text-[#333]">
            Características do produto
          </h2>
          <div className="mt-7 grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {productCharacteristics.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F5F5F5] text-[#333]">
                  <Icon size={18} strokeWidth={1.7} />
                </span>
                <p className="min-w-0 text-[14px] leading-5 text-[#333]">
                  {label}: <span className="font-semibold">{value}</span>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-black/[0.10] py-10">
          <h2 className="text-[24px] font-normal tracking-[-0.02em] text-[#333]">Descrição</h2>
          {product.description ? (
            <div className="mt-7">
              <div
                className="relative"
                style={!descExpanded && descOverflows ? { maxHeight: DESC_COLLAPSED_MAX, overflow: "hidden" } : undefined}
              >
                <div
                  ref={measureDescNode}
                  className="overflow-x-auto text-[18px] font-light leading-8 text-[#666] prose prose-sm max-w-none [&_*]:max-w-full [&_p]:my-0 [&_p+p]:mt-5 [&_table]:!my-4 [&_table]:!w-full [&_table]:!table-fixed [&_table]:border-collapse [&_th]:border [&_th]:border-black/10 [&_th]:bg-[#F5F5F5] [&_th]:!w-[38%] [&_th]:px-3 [&_th]:py-2 [&_th]:text-[13px] [&_th]:font-semibold [&_th]:!text-left [&_th]:align-top [&_th]:whitespace-normal [&_th]:break-words [&_td]:border [&_td]:border-black/10 [&_td]:px-3 [&_td]:py-2 [&_td]:text-[13px] [&_td]:!text-left [&_td]:align-top [&_td]:whitespace-normal [&_td]:break-words [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_img]:hidden"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
                {!descExpanded && descOverflows ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/90 to-transparent" />
                ) : null}
              </div>
              {descOverflows ? (
                <button
                  type="button"
                  onClick={() => setDescExpanded((v) => !v)}
                  className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-[#3483FA]"
                >
                  {descExpanded ? "Recolher descrição" : "Ver descrição completa"}
                  <ChevronDown size={16} className={`transition-transform duration-200 ${descExpanded ? "rotate-180" : ""}`} />
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-7 text-[18px] font-light leading-8 text-[#666]">
              O fornecedor ainda não disponibilizou uma descrição detalhada para este produto.
            </p>
          )}
        </section>

        {/* FAQ */}
        <section className="border-t border-black/[0.10] py-10">
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
        </div>

        {/* RELACIONADOS */}
        {related.length > 0 && (
          <section className="mt-6 py-8">
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
                const relatedSocialProofCount = relatedMetrics.ordersCount ?? relatedMetrics.reviewsCount;

                return (
                  <Link
                    key={p.id}
                    to={`/dashboard/catalogo/${p.id}`}
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
                      {relatedMetrics.hasMetrics && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-[#71717A]">
                          {relatedMetrics.rating !== null && (
                            <>
                              <Star size={11} className="fill-[#2563EB] text-[#2563EB]" />
                              <span>{relatedMetrics.rating.toFixed(1)}</span>
                            </>
                          )}
                          {relatedMetrics.rating !== null && relatedSocialProofCount !== null && <span>·</span>}
                          {relatedSocialProofCount !== null && (
                            <span>{formatReviewCount(relatedSocialProofCount)} vendidos</span>
                          )}
                        </div>
                      )}
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
