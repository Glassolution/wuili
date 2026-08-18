// Página pública de produto — estilo AERO STEP + referência PagePilot Greens.
// Rota /loja/:slug/produto/:productId. Paleta creme (#f5f2ea) + verde musgo
// escuro (#1a3c2a/#3d4a2a) + badge sálvia (#e8ecd6) + dourado (#c8a24a).
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Apple,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Heart,
  Leaf,
  Loader2,
  LockKeyhole,
  Package,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  UserRound,
} from "lucide-react";
import {
  fetchPublicProject,
  fetchPublicStoreProducts,
  getProjectLogoImage,
  getProjectProductIds,
  getProjectStoreName,
  type PublicStoreProduct,
  type UserProject,
} from "@/lib/userProjects";
import { formatPriceBRL as formatBRL } from "@/lib/priceFormat";
import { initMetaPixel, trackPixel } from "@/lib/metaPixel";

const BENEFITS = [
  { icon: Leaf, label: "Ingredientes selecionados na sua forma natural" },
  { icon: Apple, label: "Materiais premium com procedência confiável" },
  { icon: Droplet, label: "Formulação leve, prática e fácil de usar" },
  { icon: Sparkles, label: "Curadoria feita para uso diário sem esforço" },
];

const PaymentBadge = ({ label }: { label: string }) => (
  <div className="flex h-8 min-w-[52px] items-center justify-center rounded-md bg-white px-2 text-[9px] font-bold uppercase tracking-wider text-[#1a1a1a]/70 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
    {label}
  </div>
);

const PublicProductPage = () => {
  const { slug, productId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<UserProject | null>(null);
  const [product, setProduct] = useState<PublicStoreProduct | null>(null);
  const [related, setRelated] = useState<PublicStoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!slug || !productId) return;
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const found = await fetchPublicProject(slug);
        if (!active) return;
        setProject(found);
        if (found) {
          const list = await fetchPublicStoreProducts(getProjectProductIds(found));
          if (!active) return;
          const current = list.find((item) => item.id === productId) ?? null;
          setProduct(current);
          setRelated(list.filter((item) => item.id !== productId).slice(0, 4));
          setSelectedImage(0);
          if (current) {
            const defaults: Record<string, string> = {};
            current.variants.forEach((v) => {
              if (v.options[0]) defaults[v.name] = v.options[0];
            });
            setSelectedVariants(defaults);
          }
        }
      } catch {
        setProduct(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, productId]);

  // Meta Pixel do seller: base + ViewContent do produto aberto.
  useEffect(() => {
    if (!project?.meta_pixel_id || !product) return;
    initMetaPixel(project.meta_pixel_id);
    trackPixel("ViewContent", {
      content_ids: [product.id],
      content_type: "product",
      value: product.price,
      currency: "BRL",
    });
  }, [project, product]);

  const images = useMemo(() => {
    if (!product) return [] as string[];
    const list = product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [];
    return list.filter(Boolean);
  }, [product]);

  const storeName = project ? getProjectStoreName(project) || project.nome : "Loja";
  const logoImage = project ? getProjectLogoImage(project) : null;
  const storeHref = slug ? `/loja/${slug}` : "/";
  const catalogHref = slug ? `/loja/${slug}/catalogo` : "/catalogo";
  const cartHref = slug ? `/loja/${slug}/carrinho` : "/carrinho";

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f2ea]">
        <Loader2 className="animate-spin text-[#3d4a2a]" />
      </div>
    );
  }

  if (!project || !product) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f2ea] p-6 text-center">
        <div>
          <h1 className="text-[22px] font-semibold text-[#1a1a1a]">Produto não encontrado</h1>
          <p className="mt-2 text-[13px] text-[#1a1a1a]/60">Este item pode não estar mais disponível.</p>
          <Link
            to={catalogHref}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1a3c2a] px-5 py-2.5 text-[12px] font-semibold text-[#f5f2ea]"
          >
            Voltar ao catálogo
          </Link>
        </div>
      </div>
    );
  }

  const savings = product.originalPrice && product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  const handleAddToCart = () => {
    navigate(cartHref);
  };

  return (
    <div className="min-h-screen bg-[#f5f2ea] text-[#1a1a1a]">
      {/* NAVBAR */}
      <header className="relative z-30 flex items-center justify-between gap-6 px-6 py-5 md:px-10">
        <Link to={storeHref} className="flex items-center gap-2.5">
          {logoImage ? (
            <img src={logoImage} alt={storeName} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a3c2a] text-[11px] font-semibold text-[#f5f2ea]">
              {storeName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-[15px] font-semibold uppercase tracking-[-0.01em]">{storeName}</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <Link to={storeHref} className="text-[13px] font-medium text-[#1a1a1a]/75 transition hover:text-[#1a3c2a]">
            Início
          </Link>
          <Link to={catalogHref} className="text-[13px] font-medium text-[#1a1a1a]/75 transition hover:text-[#1a3c2a]">
            Catálogo
          </Link>
          <Link to={catalogHref} className="text-[13px] font-medium text-[#1a1a1a]/75 transition hover:text-[#1a3c2a]">
            Novidades
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="hidden items-center gap-2 rounded-full border border-[#1a1a1a]/12 bg-white px-4 py-2 text-[12px] font-semibold text-[#1a1a1a] transition hover:border-[#1a3c2a]/40 md:inline-flex"
          >
            <UserRound size={14} strokeWidth={2} />
            Entrar
          </button>
          <Link
            to={cartHref}
            className="inline-flex items-center gap-2 rounded-full bg-[#1a3c2a] px-4 py-2 text-[12px] font-semibold text-[#f5f2ea] transition hover:bg-[#122a1e]"
          >
            <ShoppingCart size={14} strokeWidth={2} />
            Carrinho
            <span className="ml-0.5 rounded-full bg-[#c8a24a] px-1.5 text-[10px] font-bold text-[#1a3c2a]">0</span>
          </Link>
        </div>
      </header>

      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 px-6 pb-4 text-[11px] text-[#1a1a1a]/55 md:px-10">
        <Link to={storeHref} className="hover:text-[#1a3c2a]">
          Início
        </Link>
        <ArrowRight size={11} strokeWidth={2} />
        <Link to={catalogHref} className="hover:text-[#1a3c2a]">
          Catálogo
        </Link>
        {product.category ? (
          <>
            <ArrowRight size={11} strokeWidth={2} />
            <Link to={`${catalogHref}?categoria=${encodeURIComponent(product.category)}`} className="hover:text-[#1a3c2a]">
              {product.category}
            </Link>
          </>
        ) : null}
        <ArrowRight size={11} strokeWidth={2} />
        <span className="truncate font-medium text-[#1a1a1a]">{product.title}</span>
      </div>

      {/* PRODUCT LAYOUT */}
      <section className="grid gap-8 px-6 pb-16 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-12 md:px-10">
        {/* GALERIA */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-[24px] bg-[#e9e5d8]">
            {images[selectedImage] ? (
              <img
                src={images[selectedImage]}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-[12px] uppercase text-[#1a1a1a]/40">
                Sem imagem
              </div>
            )}
            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Imagem anterior"
                  onClick={() => setSelectedImage((prev) => (prev - 1 + images.length) % images.length)}
                  className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#1a3c2a] shadow-sm transition hover:bg-white"
                >
                  <ChevronLeft size={16} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  aria-label="Próxima imagem"
                  onClick={() => setSelectedImage((prev) => (prev + 1) % images.length)}
                  className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#1a3c2a] shadow-sm transition hover:bg-white"
                >
                  <ChevronRight size={16} strokeWidth={2} />
                </button>
              </>
            ) : null}
            <button
              type="button"
              aria-label="Favoritar"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#1a1a1a]/70 shadow-sm transition hover:text-[#1a3c2a]"
            >
              <Heart size={16} strokeWidth={1.9} />
            </button>
          </div>
          {images.length > 1 ? (
            <div className="mt-4 grid grid-cols-5 gap-3">
              {images.slice(0, 5).map((image, idx) => (
                <button
                  key={image + idx}
                  type="button"
                  onClick={() => setSelectedImage(idx)}
                  className={`overflow-hidden rounded-[14px] border-2 bg-[#e9e5d8] transition ${
                    selectedImage === idx ? "border-[#1a3c2a]" : "border-transparent hover:border-[#1a3c2a]/30"
                  }`}
                >
                  <div className="aspect-square">
                    <img src={image} alt={`${product.title} ${idx + 1}`} className="h-full w-full object-cover" />
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* INFO */}
        <div>
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1a1a1a]">
            <div className="flex items-center">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Star key={idx} size={14} strokeWidth={0} className="fill-[#1a3c2a] text-[#1a3c2a]" />
              ))}
            </div>
            <span>4.9/5</span>
            <span className="text-[#1a1a1a]/55">
              baseado em <strong className="font-bold">1.031</strong> clientes felizes
            </span>
          </div>

          <h1
            className="mt-4 font-semibold leading-[1.05] tracking-[-0.015em] text-[#1a1a1a]"
            style={{ fontSize: "clamp(28px,3vw,44px)" }}
          >
            {product.title}
          </h1>

          <span className="mt-4 inline-flex items-center rounded-md bg-[#e8ecd6] px-3 py-1 text-[12px] font-semibold text-[#1a3c2a]">
            Best Seller
          </span>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <strong className="text-[24px] font-bold text-[#1a1a1a]">{formatBRL(product.price)}</strong>
            {product.originalPrice && product.originalPrice > product.price ? (
              <>
                <span className="text-[16px] text-[#1a1a1a]/45 line-through">{formatBRL(product.originalPrice)}</span>
                {savings ? (
                  <span className="inline-flex items-center rounded-md bg-[#e8ecd6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1a3c2a]">
                    Economize {savings}%
                  </span>
                ) : null}
              </>
            ) : null}
          </div>

          <p className="mt-5 max-w-[520px] text-[14px] leading-relaxed text-[#1a1a1a]/75">
            Uma seleção completa para{" "}
            <strong className="underline decoration-[#1a3c2a] decoration-2 underline-offset-4">simplificar sua rotina</strong>. Qualidade premium,
            entrega rápida e a consistência que{" "}
            <strong className="underline decoration-[#1a3c2a] decoration-2 underline-offset-4">você pode confiar</strong>.
          </p>

          {/* BENEFÍCIOS */}
          <div className="mt-6 space-y-3 border-t border-[#1a1a1a]/8 pt-6">
            {BENEFITS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8ecd6] text-[#1a3c2a]">
                  <Icon size={16} strokeWidth={1.9} />
                </span>
                <span className="text-[13.5px] font-medium text-[#1a1a1a]">{label}</span>
              </div>
            ))}
          </div>

          {/* VARIAÇÕES */}
          {product.variants.map((variant) => (
            <div key={variant.name} className="mt-6 border-t border-[#1a1a1a]/8 pt-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/60">
                {variant.name}
              </span>
              <div className="mt-3 flex flex-wrap gap-2">
                {variant.options.map((option) => {
                  const active = selectedVariants[variant.name] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedVariants((prev) => ({ ...prev, [variant.name]: option }))}
                      className={`min-w-[64px] rounded-md border px-4 py-2 text-[12px] font-semibold transition ${
                        active
                          ? "border-[#1a3c2a] bg-white text-[#1a1a1a]"
                          : "border-[#1a1a1a]/15 bg-white/60 text-[#1a1a1a]/70 hover:border-[#1a3c2a]/50"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* QUANTIDADE */}
          <div className="mt-6 flex items-center gap-4">
            <div className="inline-flex items-center rounded-full border border-[#1a1a1a]/15 bg-white">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-11 w-11 text-[16px] font-semibold text-[#1a3c2a] hover:bg-[#e8ecd6]/60"
              >
                −
              </button>
              <span className="min-w-[36px] text-center text-[14px] font-semibold text-[#1a1a1a]">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="h-11 w-11 text-[16px] font-semibold text-[#1a3c2a] hover:bg-[#e8ecd6]/60"
              >
                +
              </button>
            </div>
            <span className="text-[12px] text-[#1a1a1a]/55">Estoque limitado</span>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={handleAddToCart}
            className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#1a3c2a] py-4 text-[15px] font-bold text-[#f5f2ea] shadow-[0_8px_20px_rgba(26,60,42,0.25)] transition hover:bg-[#122a1e]"
          >
            <ShoppingCart size={18} strokeWidth={2.2} />
            Adicionar ao carrinho
          </button>

          {/* MÉTODOS DE PAGAMENTO */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {["Pix", "Visa", "Master", "Elo", "Amex", "Boleto"].map((label) => (
              <PaymentBadge key={label} label={label} />
            ))}
          </div>

          {/* TRUST STRIP */}
          <div className="mt-8 grid grid-cols-2 gap-3 border-t border-[#1a1a1a]/8 pt-6 text-[12px] md:grid-cols-3">
            <div className="flex items-center gap-2 text-[#1a1a1a]/70">
              <Truck size={14} strokeWidth={2} className="text-[#1a3c2a]" /> Frete rápido nacional
            </div>
            <div className="flex items-center gap-2 text-[#1a1a1a]/70">
              <Package size={14} strokeWidth={2} className="text-[#1a3c2a]" /> Troca fácil em 30 dias
            </div>
            <div className="flex items-center gap-2 text-[#1a1a1a]/70">
              <LockKeyhole size={14} strokeWidth={2} className="text-[#1a3c2a]" /> Pagamento 100% seguro
            </div>
          </div>
        </div>
      </section>

      {/* DESCRIÇÃO DETALHADA */}
      {product.description ? (
        <section className="px-6 pb-16 md:px-10">
          <div className="rounded-[24px] bg-white/70 p-8 md:p-12">
            <h2 className="text-[20px] font-semibold uppercase tracking-[-0.01em] text-[#1a1a1a]">
              Sobre o produto
            </h2>
            <div
              className="prose prose-sm mt-4 max-w-none text-[13.5px] leading-relaxed text-[#1a1a1a]/75"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>
        </section>
      ) : null}

      {/* REVIEWS — dados reais da tabela store_reviews */}
      <StoreReviews projectId={project.id} productId={product.id} accent="#1a3c2a" background="#f5f2ea" />


      {/* RELACIONADOS */}
      {related.length > 0 ? (
        <section className="px-6 py-16 md:px-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[22px] font-semibold uppercase tracking-[-0.01em] text-[#1a1a1a]">
                Você também vai gostar
              </h2>
              <p className="mt-1 text-[12px] text-[#1a1a1a]/55">Seleção feita para combinar com este item.</p>
            </div>
            <Link to={catalogHref} className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#1a3c2a] transition hover:gap-3">
              Ver todos <ArrowRight size={13} strokeWidth={2} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((item) => (
              <Link
                key={item.id}
                to={`/loja/${slug}/produto/${item.id}`}
                className="group flex flex-col overflow-hidden rounded-[20px] bg-white p-3 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(26,26,26,0.08)]"
              >
                <div className="relative aspect-square overflow-hidden rounded-[14px] bg-[#e9e5d8]">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="mt-3 px-1 pb-1">
                  <h3 className="line-clamp-2 min-h-[36px] text-[13px] font-semibold leading-snug text-[#1a1a1a]">
                    {item.title}
                  </h3>
                  <strong className="mt-2 block text-[15px] font-semibold text-[#1a1a1a]">{formatBRL(item.price)}</strong>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="border-t border-[#1a1a1a]/8 bg-[#eef0e0] px-6 py-10 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4 text-[12px] text-[#1a1a1a]/55">
          <span>© {new Date().getFullYear()} {storeName}. Todos os direitos reservados.</span>
          <Link to={storeHref} className="font-semibold text-[#1a3c2a] hover:underline">
            Voltar para a loja
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default PublicProductPage;
