// Página pública de produto — Template 2 (MARKETLY, azul/branco).
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, CreditCard, Heart, Loader2, Package, ShieldCheck, ShoppingCart, Star, Truck, User } from "lucide-react";
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

const PublicProductPage2 = () => {
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
      const found = await fetchPublicProject(slug);
      if (!active) return;
      setProject(found);
      if (found) {
        const list = await fetchPublicStoreProducts(getProjectProductIds(found));
        if (!active) return;
        const current = list.find((i) => i.id === productId) ?? null;
        setProduct(current);
        setRelated(list.filter((i) => i.id !== productId).slice(0, 4));
        setSelectedImage(0);
        if (current) {
          const d: Record<string, string> = {};
          current.variants.forEach((v) => { if (v.options[0]) d[v.name] = v.options[0]; });
          setSelectedVariants(d);
        }
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [slug, productId]);

  const images = useMemo(() => {
    if (!product) return [] as string[];
    const l = product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [];
    return l.filter(Boolean);
  }, [product]);

  const storeName = project ? getProjectStoreName(project) || project.nome : "Loja";
  const logoImage = project ? getProjectLogoImage(project) : null;
  const storeHref = slug ? `/loja/${slug}` : "/";
  const catalogHref = slug ? `/loja/${slug}/catalogo` : "/catalogo";
  const cartHref = slug ? `/loja/${slug}/carrinho` : "/carrinho";

  if (loading) return <div className="grid min-h-screen place-items-center bg-white"><Loader2 className="animate-spin text-[#2563EB]" /></div>;
  if (!project || !product) return (
    <div className="grid min-h-screen place-items-center bg-white p-6 text-center">
      <div>
        <h1 className="text-[20px] font-bold text-[#0F172A]">Produto não encontrado</h1>
        <Link to={catalogHref} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#2563EB] px-4 py-2 text-[12px] font-semibold text-white">Voltar ao catálogo</Link>
      </div>
    </div>
  );

  const savings = product.originalPrice && product.originalPrice > product.price ? Math.round((1 - product.price / product.originalPrice) * 100) : null;

  return (
    <div className="min-h-screen bg-white text-[#0F172A]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white">
        <div className="flex items-center gap-3 px-4 py-3 md:px-8">
          <button onClick={() => navigate(-1)} aria-label="Voltar" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[#F1F5F9]">
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
          <Link to={storeHref} className="flex min-w-0 items-center gap-2">
            {logoImage ? <img src={logoImage} alt={storeName} className="h-9 w-9 rounded-lg object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#2563EB] text-white"><ShoppingCart size={17} strokeWidth={2.4} /></span>}
            <span className="truncate text-[16px] font-bold">{storeName}</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <button aria-label="Favoritar" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#F1F5F9]"><Heart size={19} strokeWidth={1.9} /></button>
            <Link to={cartHref} aria-label="Carrinho" className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-[#F1F5F9]">
              <ShoppingCart size={19} strokeWidth={1.9} />
              <span className="absolute right-1 top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-[#F97316] px-1 text-[9px] font-bold text-white">3</span>
            </Link>
          </div>
        </div>
      </header>

      {/* BREADCRUMB */}
      <div className="flex items-center gap-1.5 px-4 pt-3 text-[11px] text-[#64748B] md:px-8">
        <Link to={storeHref} className="hover:text-[#2563EB]">Início</Link>
        <ChevronRight size={11} />
        <Link to={catalogHref} className="hover:text-[#2563EB]">Catálogo</Link>
        {product.category ? <><ChevronRight size={11} /><Link to={`${catalogHref}?categoria=${encodeURIComponent(product.category)}`} className="hover:text-[#2563EB]">{product.category}</Link></> : null}
        <ChevronRight size={11} />
        <span className="truncate font-semibold text-[#0F172A]">{product.title}</span>
      </div>

      {/* PRODUCT */}
      <section className="grid gap-6 px-4 pb-8 pt-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-10 md:px-8">
        {/* GALLERY */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]">
            {images[selectedImage] ? (
              <img src={images[selectedImage]} alt={product.title} className="h-full w-full object-cover" />
            ) : <div className="grid h-full w-full place-items-center text-[12px] uppercase text-[#94A3B8]">Sem imagem</div>}
            {images.length > 1 && (
              <>
                <button aria-label="Anterior" onClick={() => setSelectedImage((p) => (p - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/95 shadow-sm hover:bg-white"><ChevronLeft size={16} /></button>
                <button aria-label="Próximo" onClick={() => setSelectedImage((p) => (p + 1) % images.length)} className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/95 shadow-sm hover:bg-white"><ChevronRight size={16} /></button>
              </>
            )}
            {savings ? <span className="absolute left-3 top-3 rounded-md bg-[#EF4444] px-2 py-1 text-[11px] font-bold text-white">-{savings}%</span> : null}
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {images.slice(0, 5).map((img, i) => (
                <button key={img + i} onClick={() => setSelectedImage(i)} className={`overflow-hidden rounded-xl border-2 bg-[#F8FAFC] transition ${selectedImage === i ? "border-[#2563EB]" : "border-transparent hover:border-[#2563EB]/30"}`}>
                  <div className="aspect-square"><img src={img} alt="" className="h-full w-full object-cover" /></div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* INFO */}
        <div>
          {product.category ? <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2563EB]">{product.category}</span> : null}
          <h1 className="mt-1 text-[22px] font-bold leading-[1.15] tracking-tight text-[#0F172A] md:text-[28px]">{product.title}</h1>

          <div className="mt-3 flex items-center gap-2">
            <div className="flex items-center gap-0.5 text-[#F59E0B]">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} strokeWidth={0} className="fill-current" />)}
            </div>
            <span className="text-[12px] font-semibold text-[#0F172A]">4.8</span>
            <span className="text-[12px] text-[#64748B]">(1.234 avaliações)</span>
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <strong className="text-[26px] font-bold text-[#2563EB]">{formatBRL(product.price)}</strong>
            {product.originalPrice && product.originalPrice > product.price ? (
              <>
                <span className="text-[14px] text-[#94A3B8] line-through">{formatBRL(product.originalPrice)}</span>
                {savings ? <span className="rounded-md bg-[#DCFCE7] px-2 py-0.5 text-[11px] font-bold text-[#166534]">Você economiza {savings}%</span> : null}
              </>
            ) : null}
          </div>
          <p className="mt-1 text-[12px] text-[#64748B]">ou 12x de {formatBRL(product.price / 12)} sem juros no cartão</p>

          {product.variants.map((v) => (
            <div key={v.name} className="mt-5 border-t border-[#E2E8F0] pt-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">{v.name}</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {v.options.map((o) => {
                  const active = selectedVariants[v.name] === o;
                  return (
                    <button key={o} onClick={() => setSelectedVariants((p) => ({ ...p, [v.name]: o }))} className={`min-w-[60px] rounded-lg border px-4 py-2 text-[12px] font-semibold transition ${active ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]" : "border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#2563EB]"}`}>
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* QUANTITY */}
          <div className="mt-5 flex items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-[#E2E8F0] bg-white">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-10 w-10 text-[16px] font-bold text-[#2563EB] hover:bg-[#EFF6FF]">−</button>
              <span className="min-w-[32px] text-center text-[13px] font-semibold">{quantity}</span>
              <button onClick={() => setQuantity((q) => q + 1)} className="h-10 w-10 text-[16px] font-bold text-[#2563EB] hover:bg-[#EFF6FF]">+</button>
            </div>
            <span className="text-[11px] text-[#64748B]">✓ Em estoque</span>
          </div>

          <button onClick={() => navigate(cartHref)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3.5 text-[14px] font-bold text-white shadow-md transition hover:bg-[#1D4ED8]">
            <ShoppingCart size={18} strokeWidth={2.2} /> Adicionar ao carrinho
          </button>
          <button onClick={() => navigate(cartHref)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#2563EB] bg-white py-3.5 text-[14px] font-bold text-[#2563EB] transition hover:bg-[#EFF6FF]">
            Comprar agora
          </button>

          {/* PAYMENT */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {["Pix", "Visa", "Master", "Elo", "Amex", "Boleto"].map((l) => (
              <div key={l} className="rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-[9px] font-bold uppercase text-[#64748B]">{l}</div>
            ))}
          </div>

          {/* TRUST */}
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#E2E8F0] pt-4 text-center">
            {[
              { icon: Truck, t: "Frete rápido" },
              { icon: Package, t: "Troca em 30 dias" },
              { icon: ShieldCheck, t: "Compra segura" },
            ].map(({ icon: Icon, t }) => (
              <div key={t} className="flex flex-col items-center gap-1">
                <Icon size={16} className="text-[#2563EB]" />
                <span className="text-[10px] font-semibold text-[#0F172A]">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DESCRIPTION */}
      {product.description ? (
        <section className="px-4 pb-8 md:px-8">
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 md:p-6">
            <h2 className="text-[16px] font-bold text-[#0F172A]">Sobre o produto</h2>
            <div className="prose prose-sm mt-3 max-w-none text-[13px] leading-relaxed text-[#334155]" dangerouslySetInnerHTML={{ __html: product.description }} />
          </div>
        </section>
      ) : null}

      {/* RELATED */}
      {related.length > 0 && (
        <section className="px-4 pb-10 md:px-8">
          <h2 className="mb-3 text-[18px] font-bold text-[#0F172A]">Você também vai gostar</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {related.map((r) => (
              <Link key={r.id} to={`/loja/${slug}/produto/${r.id}`} className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white transition hover:border-[#2563EB]/30 hover:shadow-md">
                <div className="aspect-square bg-[#F8FAFC]">{r.imageUrl ? <img src={r.imageUrl} alt={r.title} className="h-full w-full object-cover" /> : null}</div>
                <div className="p-2.5">
                  <h3 className="line-clamp-2 min-h-[32px] text-[11px] font-semibold text-[#0F172A]">{r.title}</h3>
                  <strong className="mt-1 block text-[13px] font-bold text-[#2563EB]">{formatBRL(r.price)}</strong>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-6 text-center text-[11px] text-[#94A3B8] md:px-8">
        © {new Date().getFullYear()} {storeName} · <Link to={storeHref} className="font-semibold text-[#2563EB] hover:underline">Voltar para a loja</Link>
      </footer>
    </div>
  );
};

export default PublicProductPage2;
