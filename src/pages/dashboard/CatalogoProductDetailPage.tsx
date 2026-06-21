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
} from "lucide-react";
import { getMockRating, formatPrice, formatReviewCount } from "./CatalogoPage";

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
        className="w-full flex items-center justify-between text-left py-5 font-semibold text-[15px] text-[#111111]"
      >
        <span>{question}</span>
        <ChevronDown
          size={18}
          className={`text-[#6B7280] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-40 pb-5 opacity-100" : "max-h-0 opacity-0"}`}>
        <p className="text-[14px] leading-relaxed text-[#4B5563]">{answer}</p>
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
  price: number;
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
  return {
    id: p.id,
    title: p.title || "Produto sem nome",
    category: p.category || "Produto",
    price: p.suggested_price || p.cost_price || 0,
    originalPrice:
      p.original_price && p.original_price > (p.suggested_price || 0)
        ? Number(p.original_price)
        : p.suggested_price && p.cost_price && p.suggested_price > p.cost_price
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
  const [relatedIndex, setRelatedIndex] = useState(0);
  const [favorited, setFavorited] = useState(false);

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
      className="min-h-full w-full bg-[#F2F3F5] py-6"
      style={{ fontFamily: 'Inter, -apple-system, "Segoe UI", sans-serif' }}
    >
      <div className="max-w-[760px] mx-auto px-4">
        {/* CARD ÚNICO */}
        <div className="bg-white rounded-[20px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* HEADER COM NAV */}
          <div className="flex items-center justify-between px-8 pt-6 pb-5 border-b border-[#F1F2F4]">
            <button
              type="button"
              onClick={() => navigate("/dashboard/catalogo")}
              className="flex items-center gap-2 text-[15px] font-bold text-[#111] tracking-tight"
            >
              <ArrowLeft size={16} strokeWidth={2.4} />
              <span className="uppercase">Voltar ao catálogo</span>
            </button>
            <div className="text-[11px] font-semibold tracking-[0.18em] text-[#6B7280] uppercase">
              {product.supplier_name ?? "Fornecedor verificado"}
            </div>
          </div>

          {/* SEÇÃO 1 — IMAGEM + INFO */}
          <div className="px-8 pt-7 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* GALERIA */}
              <div>
                <div className="aspect-square rounded-[14px] bg-[#F4F5F7] overflow-hidden flex items-center justify-center border border-[#ECECEF]">
                  <img
                    src={gallery[activeImg] || gallery[0] || FALLBACK_IMG}
                    alt={product.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                {gallery.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {gallery.map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveImg(i)}
                        className="flex flex-col items-center w-[72px]"
                      >
                        <div
                          className={`aspect-square w-full rounded-[10px] bg-[#F4F5F7] overflow-hidden border-2 transition-colors ${
                            activeImg === i ? "border-[#111]" : "border-transparent"
                          }`}
                        >
                          <img src={src} alt="" className="h-full w-full object-cover" />
                        </div>
                        <span className="mt-1 text-[10px] text-[#6B7280] truncate w-full text-center">
                          {i === 0 ? "Visão principal" : `Foto ${i + 1}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* INFO */}
              <div className="flex flex-col">
                <h1 className="text-[26px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[#111] uppercase">
                  {product.title}
                </h1>
                <p className="mt-1.5 text-[13px] text-[#6B7280]">{product.category}</p>

                {/* Rating */}
                <div className="mt-3 flex items-center gap-2 text-[12.5px]">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={13}
                        className={
                          i < Math.round(Number(rating))
                            ? "fill-[#F5B400] text-[#F5B400]"
                            : "text-[#E5E7EB] fill-[#E5E7EB]"
                        }
                      />
                    ))}
                  </div>
                  <span className="font-semibold text-[#111]">{rating}</span>
                  <span className="text-[#6B7280]">{formatReviewCount(reviewCount)} avaliações</span>
                </div>

                {/* Preço */}
                <div className="mt-3 flex items-end gap-3">
                  {product.originalPrice && (
                    <span className="text-[14px] text-[#9CA3AF] line-through">
                      {formatPrice(product.originalPrice)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[34px] font-extrabold tracking-tight text-[#F97316] leading-none">
                    {formatPrice(product.price)}
                  </span>
                  {savings > 0 && (
                    <span className="text-[11px] font-semibold text-[#0F8A4F] bg-[#E6F7EE] px-2 py-1 rounded-md">
                      Economize {formatPrice(savings)}
                    </span>
                  )}
                </div>

                {/* Descrição */}
                <p className="mt-4 text-[13.5px] leading-[1.55] text-[#4B5563]">{description}</p>

                {/* CTAs */}
                <div className="mt-5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    className="w-full h-11 rounded-[10px] bg-[#F97316] hover:bg-[#EA6A0E] text-white text-[12.5px] font-bold tracking-[0.18em] uppercase transition-colors"
                  >
                    Importar para minha loja
                  </button>
                  <a
                    href={product.product_url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-11 rounded-[10px] bg-[#2A2D34] hover:bg-[#1f2127] text-white text-[12.5px] font-bold tracking-[0.18em] uppercase flex items-center justify-center transition-colors"
                  >
                    Ver no fornecedor
                  </a>
                </div>

                <p className="mt-2.5 text-center text-[12px] text-[#6B7280]">
                  Frete calculado pelo fornecedor · Envio em 2 dias
                </p>

                {/* Trust badges */}
                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 rounded-[12px] border border-[#E5E7EB] px-4 py-3.5">
                  {[
                    { icon: Lock, label: "Importação segura" },
                    { icon: Truck, label: "Envio rápido" },
                    { icon: RotateCcw, label: "30 dias para troca" },
                    { icon: ShieldCheck, label: "Garantia 2 anos" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2 text-[12px] font-medium text-[#374151]">
                      <Icon size={14} strokeWidth={2} className="text-[#6B7280]" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Favoritar discreto */}
                <button
                  type="button"
                  onClick={() => setFavorited((v) => !v)}
                  className="mt-3 self-end inline-flex items-center gap-1.5 text-[11.5px] text-[#6B7280] hover:text-[#111]"
                >
                  <Heart
                    size={13}
                    className={favorited ? "fill-red-500 text-red-500" : ""}
                  />
                  {favorited ? "Salvo" : "Salvar para depois"}
                </button>
              </div>
            </div>
          </div>

          {/* WHY */}
          <div className="px-8 py-9 border-t border-[#F1F2F4]">
            <h2 className="text-center text-[18px] font-extrabold tracking-tight text-[#111] uppercase">
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
          <div className="px-8 py-8 border-t border-[#F1F2F4]">
            <h2 className="text-[18px] font-extrabold tracking-tight text-[#111] uppercase mb-5">
              Avaliações de clientes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {reviews.map((r, i) => (
                <div key={i} className="rounded-[12px] border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-[#F4F5F7] flex items-center justify-center text-[11px] font-bold text-[#4B5563]">
                      {r.initials}
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, k) => (
                        <Star
                          key={k}
                          size={11}
                          className={
                            k < r.rating
                              ? "fill-[#F5B400] text-[#F5B400]"
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
          <div className="px-8 py-8 border-t border-[#F1F2F4]">
            <h2 className="text-[18px] font-extrabold tracking-tight text-[#111] uppercase mb-2">
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
            <div className="px-8 py-8 border-t border-[#F1F2F4]">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[18px] font-extrabold tracking-tight text-[#111] uppercase">
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
                    <div className="aspect-square rounded-[12px] bg-[#F4F5F7] overflow-hidden">
                      <img
                        src={p.images[0]}
                        alt={p.title}
                        className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
                      />
                    </div>
                    <div className="mt-2.5">
                      <div className="text-[13px] font-bold text-[#111] truncate">{p.title}</div>
                      <div className="mt-0.5 flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={10}
                            className="fill-[#F5B400] text-[#F5B400]"
                          />
                        ))}
                        <span className="ml-1 text-[10.5px] text-[#6B7280]">
                          ({Math.floor(20 + (p.id.charCodeAt(0) % 60))})
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[14px] font-extrabold text-[#111]">
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
          <div className="px-8 py-5 border-t border-[#F1F2F4] flex items-center justify-between text-[11.5px] text-[#6B7280]">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-[#111]">Categorias</span>
              <span>Ajuda</span>
              <span>Pagamentos</span>
            </div>
            <div className="flex items-center gap-3 text-[#9CA3AF]">
              <span>Suporte 24/7</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogoProductDetailPage;
