import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Star,
  Heart,
  ArrowLeft,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Lock,
  Truck,
  RotateCcw,
  ShieldCheck,
  Volume2,
  Activity,
  Feather,
  X,
} from "lucide-react";
import { getMockRating, formatPrice, formatReviewCount } from "./CatalogoPage";
import ImportProductModal from "@/components/dashboard/ImportProductModal";
import { veloToast } from "@/components/ui/velo-toast";

// ============================================================
// MOCK helpers (descrição, reviews, FAQ) — sem dados reais ainda
// ============================================================
function getMockDescription(name: string, category: string, productId: string) {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) hash = (hash * 31 + productId.charCodeAt(i)) % 10000;
  const templates = [
    `Mergulhe na qualidade do ${name}. Produto da categoria ${category} com excelente custo-benefício, materiais selecionados e ótima saída no varejo nacional.`,
    `Apresentamos o ${name}, projetado para atender às demandas em ${category}. Uma escolha inteligente que une design moderno, durabilidade e margem atrativa para revenda.`,
    `O ${name} é destaque em ${category}: acabamento de alto padrão, versatilidade e desempenho consistente para elevar a experiência do seu cliente final.`,
  ];
  return templates[hash % templates.length];
}

function getMockReviews(productId: string) {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) hash = (hash * 31 + productId.charCodeAt(i)) % 10000;
  const reviewers = [
    { name: "Carlos M.", initials: "CM" },
    { name: "Sandra R.", initials: "SR" },
    { name: "Julio C.", initials: "JC" },
    { name: "Renata F.", initials: "RF" },
    { name: "Marcos T.", initials: "MT" },
    { name: "Aline S.", initials: "AS" },
  ];
  const comments = [
    ["Qualidade excelente!", "Melhor compra do mês!", "Vale cada centavo!"],
    ["Chegou rápido demais!", "Acabamento impecável.", "Recomendo para todos."],
    ["Produto muito bom!", "Funciona perfeitamente.", "Comprarei mais unidades."],
  ];
  const g = hash % comments.length;
  return [
    { ...reviewers[hash % reviewers.length], rating: 5, comment: comments[g][0] },
    { ...reviewers[(hash + 1) % reviewers.length], rating: 5, comment: comments[g][1] },
    { ...reviewers[(hash + 2) % reviewers.length], rating: 5, comment: comments[g][2] },
  ];
}

const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#E5E7EB]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left py-4 font-medium text-[14px] text-[#111]"
      >
        <span>{question}</span>
        <ChevronDown
          size={16}
          className={`text-[#9CA3AF] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-40 pb-4 opacity-100" : "max-h-0 opacity-0"}`}>
        <p className="text-[13.5px] leading-relaxed text-[#6B7280]">{answer}</p>
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
};

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop";

function extractImages(raw: any): string[] {
  if (!raw) return [];
  let arr: any = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [raw];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.filter((u) => typeof u === "string" && !!u);
}

function mapProduct(p: any): DetailedProduct {
  const imgs = extractImages(p.images);
  const cost = p.cost_price || 0;
  const suggested = p.suggested_price || (cost ? cost * 2 : 0);
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
    supplier_name: p.supplier_name ?? null,
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
  const [showSocialProof, setShowSocialProof] = useState(false);
  const [rawProduct, setRawProduct] = useState<any>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // MOCK: notificação decorativa de prova social, não reflete atividade real
  const socialProof = useMemo(() => {
    const cities = [
      "São Paulo",
      "Rio de Janeiro",
      "Belo Horizonte",
      "Curitiba",
      "Porto Alegre",
      "Salvador",
      "Fortaleza",
      "Brasília",
      "Goiânia",
      "Recife",
    ];
    const times = ["2 min", "5 min", "12 min", "18 min", "25 min", "45 min", "1 hora"];
    const initialsList = ["FL", "AM", "JS", "CR", "TB", "GV", "NK", "OP", "WD"];

    let hash = 0;
    if (id) {
      for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) % 10000;
      }
    }
    const city = cities[hash % cities.length];
    const time = times[(hash + 3) % times.length];
    const initials = initialsList[(hash + 5) % initialsList.length];

    return { city, time, initials };
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSocialProof(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      setActiveImg(0);
      try {
        const { data, error: e } = await supabase
          .from("catalog_products")
          .select("*")
          .eq("id", id)
          .single();
        if (e) throw e;
        if (!data) throw new Error("Produto não encontrado.");

        const mapped = mapProduct(data);
        setProduct(mapped);
        setRawProduct(data);

        const { data: rel } = await supabase
          .from("catalog_products")
          .select("*")
          .eq("is_blocked", false)
          .in("source", ["b2drop", "c7drop"])
          .neq("id", id)
          .eq("category", data.category || "")
          .limit(12);
        if (rel && rel.length > 0) {
          setRelated(rel.map(mapProduct));
        } else {
          const { data: fb } = await supabase
            .from("catalog_products")
            .select("*")
            .eq("is_blocked", false)
            .in("source", ["b2drop", "c7drop"])
            .neq("id", id)
            .limit(12);
          if (fb) setRelated(fb.map(mapProduct));
        }
      } catch (err) {
        console.error(err);
        setError("Não foi possível carregar os detalhes do produto.");
      } finally {
        setLoading(false);
        veloToast.dismiss("loading-product");
      }
    };
    fetchData();
  }, [id]);

  const { rating, reviewCount } = useMemo(
    () => (product ? getMockRating(product.id) : { rating: "0", reviewCount: 0 }),
    [product?.id],
  );

  const description = useMemo(
    () => (product ? getMockDescription(product.title, product.category, product.id) : ""),
    [product?.id],
  );

  const reviews = useMemo(() => (product ? getMockReviews(product.id) : []), [product?.id]);

  const savings = useMemo(() => {
    if (!product || !product.originalPrice) return 0;
    return Math.max(0, product.originalPrice - product.price);
  }, [product]);

  const relatedWindow = useMemo(() => {
    if (related.length === 0) return [];
    return Array.from({ length: Math.min(3, related.length) }, (_, o) => related[(relatedIndex + o) % related.length]);
  }, [related, relatedIndex]);



  if (loading) {
    return (
      <div className="pt-6 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw size={22} className="animate-spin text-[#111]" />
          <span className="text-[13px] text-[#6B7280]">Carregando produto...</span>
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

  return (
    <div
      className="min-h-full w-full bg-white py-6 rounded-2xl border border-black/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
      style={{ fontFamily: 'Inter, -apple-system, "Segoe UI", sans-serif' }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        
        {/* CABEÇALHO DA PÁGINA */}
        <div className="flex items-center justify-between pb-6 border-b border-[#F1F2F4] mb-6">
          <button
            type="button"
            onClick={() => navigate("/dashboard/catalogo")}
            className="flex items-center gap-2 text-[11px] font-medium text-[#6B7280] tracking-wider transition-colors hover:text-[#111]"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            <span className="uppercase">Voltar ao catálogo</span>
          </button>
          <div className="text-[11px] font-medium tracking-wider text-[#6B7280] uppercase">
            {product.supplier_name ?? "Fornecedor verificado"}
          </div>
        </div>

        {/* SEÇÃO PRINCIPAL (duas colunas) */}
        <div className="grid grid-cols-1 md:grid-cols-[45%_1fr] gap-12 items-start pb-10">
          {/* COLUNA ESQUERDA — GALERIA */}
          <div>
            <div className="aspect-square rounded-2xl bg-[#F4F5F7] overflow-hidden flex items-center justify-center border border-[#ECECEF]">
              <img
                src={gallery[activeImg] || gallery[0] || FALLBACK_IMG}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            </div>
            {gallery.length > 1 && (
              <>
                <div className="mt-3 flex flex-row overflow-x-auto gap-2 pb-2 scrollbar-gallery">
                  {gallery.map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveImg(i)}
                      className={`aspect-square w-16 shrink-0 rounded-lg bg-[#F4F5F7] overflow-hidden border-2 transition-all ${
                        activeImg === i ? "border-[#111]" : "border-transparent hover:border-gray-200"
                      }`}
                    >
                      <img src={src} alt="" className="h-full w-full object-cover" />
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
          <div className="flex flex-col">
            {/* Categoria */}
            <span className="inline-flex items-center rounded-full bg-[#F3F4F6] text-[#4B5563] text-[11px] font-medium px-3 py-0.5 mb-2.5 self-start">
              {product.category ? (product.category.charAt(0).toUpperCase() + product.category.slice(1).toLowerCase()) : "Produto"}
            </span>

            {/* Nome do produto */}
            <h1 className="text-[24px] sm:text-[28px] font-bold leading-[1.2] tracking-tight text-[#111] mb-2.5">
              {product.title}
            </h1>

            {/* Avaliação */}
            <div className="flex items-center gap-2 text-[12.5px] mb-3">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={13}
                    className={
                      i < Math.round(Number(rating))
                        ? "fill-[#111] text-[#111]"
                        : "text-[#E5E7EB] fill-[#E5E7EB]"
                    }
                  />
                ))}
              </div>
              <span className="font-semibold text-[#111]">{rating}</span>
              <span className="text-[#6B7280]">({formatReviewCount(reviewCount)} avaliações)</span>
            </div>

            {/* Bloco de Precificação e Simulador de Lucro */}
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Card 1: Preço de Custo */}
                <div className="flex-1 bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl p-3 flex flex-col justify-between min-h-[76px]">
                  <span className="text-[11px] font-medium text-[#6B7280]">
                    Preço de custo
                  </span>
                  <span className="text-[18px] sm:text-[20px] font-bold text-[#111] leading-none mt-1">
                    {formatPrice(product.price)}
                  </span>
                </div>

                {/* Seta indicadora */}
                <div className="text-[#9CA3AF] shrink-0 font-medium text-base">
                  →
                </div>

                {/* Card 2: Sugestão de Venda */}
                <div className="flex-1 bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl p-3 flex flex-col justify-between min-h-[76px]">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-[#6B7280]">
                      Sugestão de venda
                    </span>
                    <span className="text-[18px] sm:text-[20px] font-bold text-[#111] leading-none mt-1">
                      {formatPrice(product.suggestedPrice)}
                    </span>
                  </div>
                  <span className="text-[10.5px] font-semibold text-[#16A34A] mt-1.5 block">
                    + {formatPrice(Math.max(0, product.suggestedPrice - product.price))} de lucro estimado
                  </span>
                </div>
              </div>

              {/* Explicação pequena */}
              <p className="text-[11px] text-[#888888] leading-relaxed">
                Valor sugerido com base em margem de 100%. Você pode ajustar o preço de venda ao publicar.
              </p>
            </div>

            {/* Descrição */}
            <p className="text-[14px] leading-relaxed text-[#4B5563] mb-5">{description}</p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="w-full sm:flex-1 h-11 bg-[#111] hover:bg-[#222] text-white text-[13.5px] font-semibold tracking-wide transition-colors rounded-xl"
              >
                Importar para minha loja
              </button>
              {product.product_url && (
                <a
                  href={product.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:flex-1 h-11 border border-[#D1D5DB] hover:bg-[#F9FAFB] text-[#111] text-[13.5px] font-semibold tracking-wide flex items-center justify-center transition-colors rounded-xl"
                >
                  Ver no fornecedor
                </a>
              )}
            </div>

            {/* Texto pequeno */}
            <p className="mt-2 text-center text-[12px] text-[#6B7280]">
              Frete calculado pelo fornecedor · Envio em 2 dias
            </p>

            {/* Salvar para depois */}
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => setFavorited((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6B7280] hover:text-[#111] transition-colors"
              >
                <Heart
                  size={14}
                  className={favorited ? "fill-red-500 text-red-500" : ""}
                />
                <span>{favorited ? "Salvo" : "Salvar para depois"}</span>
              </button>
            </div>

            {/* Grid 2x2 de informações de confiança */}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-[#E5E7EB] px-4 py-3">
              {[
                { icon: Lock, label: "Importação segura" },
                { icon: Truck, label: "Envio rápido" },
                { icon: RotateCcw, label: "30 dias para troca" },
                { icon: ShieldCheck, label: "Garantia 2 anos" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-[13px] font-medium text-[#4B5563]">
                  <Icon size={14} className="text-[#9CA3AF]" strokeWidth={2} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* WHY - Por que este produto? */}
        <div className="py-8 border-t border-[#F1F2F4]">
          <h2 className="text-center text-[16px] font-bold text-[#111]">
            Por que este produto?
          </h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: Volume2,
                title: "Alta demanda",
                desc: "Categoria com alta procura e ótima taxa de conversão no varejo nacional.",
              },
              {
                icon: Activity,
                title: "Margem saudável",
                desc: "Preço de custo competitivo com espaço confortável para revenda lucrativa.",
              },
              {
                icon: Feather,
                title: "Envio ágil",
                desc: "Fornecedor verificado, com expedição rápida e logística confiável.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3">
                <div className="h-10 w-10 rounded-full bg-[#F4F5F7] flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-[#111]" strokeWidth={2} />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-[#111]">{title}</div>
                  <p className="mt-1 text-[12.5px] leading-[1.5] text-[#6B7280]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* REVIEWS */}
        <div className="py-8 border-t border-[#F1F2F4]">
          <h2 className="text-[16px] font-bold text-[#111] mb-4">
            Avaliações de clientes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {reviews.map((r, i) => (
              <div key={i} className="rounded-xl border border-[#E5E7EB] p-4 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-[#F4F5F7] flex items-center justify-center text-[11px] font-medium text-[#4B5563]">
                    {r.initials}
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star
                        key={k}
                        size={11}
                        className={
                          k < r.rating
                            ? "fill-[#111] text-[#111]"
                            : "text-[#E5E7EB] fill-[#E5E7EB]"
                        }
                      />
                    ))}
                    <span className="ml-1 text-[11px] font-bold text-[#111]">{r.rating}</span>
                  </div>
                </div>
                <p className="mt-2.5 text-[13px] font-semibold text-[#111] leading-snug">
                  {r.comment}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="py-8 border-t border-[#F1F2F4]">
          <h2 className="text-[16px] font-bold text-[#111] mb-2">
            Perguntas frequentes
          </h2>
          <div>
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
        </div>

        {/* RELACIONADOS */}
        {related.length > 0 && (
          <div className="py-8 border-t border-[#F1F2F4]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold text-[#111]">
                Produtos relacionados
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setRelatedIndex((c) => (c - 1 + related.length) % related.length)
                  }
                  className="h-8 w-8 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[#111] hover:bg-[#F4F5F7]"
                  aria-label="Anterior"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setRelatedIndex((c) => (c + 1) % related.length)}
                  className="h-8 w-8 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[#111] hover:bg-[#F4F5F7]"
                  aria-label="Próximo"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedWindow.map((p) => (
                <Link
                  key={p.id}
                  to={`/dashboard/catalogo/${p.id}`}
                  className="group"
                >
                  <div className="aspect-square rounded-xl bg-[#F4F5F7] overflow-hidden">
                    <img
                      src={p.images[0]}
                      alt={p.title}
                      className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
                    />
                  </div>
                  <div className="mt-2">
                    <div className="text-[13px] font-medium text-[#111] truncate">{p.title}</div>
                    <div className="mt-0.5 flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={10}
                          className="fill-[#111] text-[#111]"
                        />
                      ))}
                      <span className="ml-1 text-[10.5px] text-[#6B7280]">
                        ({Math.floor(20 + (p.id.charCodeAt(0) % 60))})
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[14px] font-bold text-[#111]">
                        {formatPrice(p.price)}
                      </span>
                      {p.originalPrice && (
                        <span className="text-[11.5px] text-[#9CA3AF] line-through">
                          {formatPrice(p.originalPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* FOOTER MINI */}
        <div className="py-5 border-t border-[#F1F2F4] flex items-center justify-between text-[12px] text-[#6B7280]">
          <div className="flex items-center gap-4">
            <span className="font-medium text-[#4B5563]">Categorias</span>
            <span>Ajuda</span>
            <span>Pagamentos</span>
          </div>
          <div className="flex items-center gap-3 text-[#9CA3AF]">
            <span>Suporte 24/7</span>
          </div>
        </div>

      </div>

      {/* MOCK: notificação decorativa de prova social, não reflete atividade real */}
      {showSocialProof && (
        <div className="fixed bottom-6 left-6 z-50 bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)] max-w-sm flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#4B5563] text-[13px] font-bold shrink-0">
            {socialProof.initials}
          </div>
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-[12.5px] leading-snug text-[#4B5563]">
              Lojista de <span className="font-semibold text-[#111]">{socialProof.city}</span> importou este produto há <span className="font-semibold text-[#111]">{socialProof.time}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSocialProof(false)}
            className="text-[#9CA3AF] hover:text-[#4B5563] transition-colors self-start"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <ImportProductModal
        open={isImportModalOpen}
        product={rawProduct}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
};

export default CatalogoProductDetailPage;
