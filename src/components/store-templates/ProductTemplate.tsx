import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Menu,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserCircle,
} from "lucide-react";

import ProductVariantPicker from "@/components/store-templates/ProductVariantPicker";
import { galleryImageAt, useProductGallery } from "@/components/store-templates/productGallery";
import { StoreBundleOffers, StoreGuaranteeCards, StorePaymentRow } from "@/components/store-templates/storeSections";
import { StoreBenefitsBar, StoreFaqAccordion, StoreFeatureGrid, StoreImageCta, StoreTestimonials, StoreThreeSteps, StoreUrgencyBanner, StoreUsageCarousel, StoreWhyWorthIt } from "@/components/store-templates/storeContentSections";
import type { ProductVariantOption } from "@/lib/userProjects";
import { formatPriceBRL as formatBRL } from "@/lib/priceFormat";

export type ProductTemplateProps = {
  brand: string;
  title: string;
  description: string;
  price: number;
  /** Preço "de" riscado. Só quando o fornecedor pratica desconto real; null omite. */
  originalPrice: number | null;
  image: string;
  /** Todas as fotos do produto (a primeira é `image`). Alimenta a galeria e evita
   *  repetir a mesma foto em todas as seções. */
  images?: string[];
  productId?: string;
  /** Projeto dono da vitrine. Alimenta as avaliações reais (store_reviews).
   *  Ausente = preview do editor: o bloco aparece, mas não grava avaliação. */
  projectId?: string;
  accent: string;
  mobile?: boolean;
  /** Variações reais do fornecedor. [] = produto sem variação, seletor omitido. */
  variants?: ProductVariantOption[];
};


const storeNav = ["Inicio", "Loja", "Novidades", "Colecoes", "Ofertas", "Blog"];
const trustBadges: Array<[typeof Truck, string, string]> = [
  [Truck, "Frete gratis", "Em pedidos acima de R$ 199"],
  [RefreshCcw, "Troca facil", "30 dias para devolucao"],
  [ShieldCheck, "Pagamento seguro", "100% protegido"],
];

const ProductTemplate = ({ brand, title, description, price, originalPrice, image, images, productId, projectId, accent, mobile = false, variants = [] }: ProductTemplateProps) => {
  const discountPct = originalPrice && originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;
  const { gallery, active, current, setActive, prev, next, hasMany } = useProductGallery(images, image);

  return (
    <div className="bg-white text-[#111]">
      {/* Barra de aviso */}
      <div className="relative flex items-center justify-center bg-[#f4f4f3] px-6 py-2.5 text-[12px] text-black/60">
        <span className="flex items-center gap-2"><Truck size={14} /> Frete gratis em pedidos acima de R$ 199</span>
        <span className="absolute right-6 hidden items-center gap-1 sm:flex">BRL R$ <ChevronDown size={12} /></span>
      </div>

      {/* Cabecalho da loja */}
      <header className="flex items-center justify-between border-b border-black/10 bg-white px-6 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <button type="button" className="text-black/70 lg:hidden" aria-label="Menu"><Menu size={20} /></button>
          <span className="text-[22px] font-black uppercase tracking-[0.18em] text-black">{brand}</span>
        </div>
        <nav className="hidden items-center gap-7 text-[13px] font-semibold uppercase tracking-wide text-black/70 lg:flex">
          {storeNav.map((item, index) => (
            <span key={item} className="flex cursor-pointer items-center gap-1 transition hover:text-black">
              {item}
              {index === 1 ? <ChevronDown size={13} /> : null}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-4 text-black/75">
          <Search size={19} />
          <UserCircle size={20} />
          <span className="relative">
            <ShoppingBag size={20} />
            <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">2</span>
          </span>
        </div>
      </header>

      {/* Produto */}
      <section className="px-6 py-8 sm:px-10">
        <div className="mx-auto grid max-w-[1180px] gap-8 lg:gap-12" style={{ gridTemplateColumns: mobile ? "1fr" : "minmax(0,1.05fr) minmax(0,1fr)" }}>
          {/* Galeria */}
          <div className="flex gap-4">
            <div className="flex flex-col gap-3">
              {gallery.map((thumb, index) => (
                <button
                  type="button"
                  key={thumb}
                  onClick={() => setActive(index)}
                  aria-label={`Foto ${index + 1}`}
                  className={`flex h-[86px] w-[70px] items-center justify-center overflow-hidden rounded-[10px] border bg-white p-1.5 transition ${index === active ? "border-black" : "border-black/10 hover:border-black/30"}`}
                >
                  <img data-editor-type="image" data-editor-product="true" data-editor-product-id={productId} src={thumb} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
            <div className="relative aspect-[4/5] flex-1 overflow-hidden rounded-[14px] bg-[#f6f5f3] flex items-center justify-center p-6">
              {current ? <img data-editor-type="image" data-editor-product="true" data-editor-product-id={productId} src={current} alt={title} className="max-h-full max-w-full object-contain" /> : null}
              {hasMany ? (
                <>
                  <button type="button" onClick={prev} aria-label="Foto anterior" className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow transition hover:bg-white"><ChevronLeft size={17} /></button>
                  <button type="button" onClick={next} aria-label="Proxima foto" className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow transition hover:bg-white"><ChevronRight size={17} /></button>
                </>
              ) : null}
              <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black shadow"><Search size={16} /></span>
            </div>
          </div>

          {/* Informacoes */}
          <div className="flex flex-col">
            <span className="inline-flex w-fit items-center rounded-full bg-[#f0f0ef] px-3 py-1 text-[12px] font-semibold text-black/65">Novidade</span>
            <h1 className="mt-4 max-w-[520px] text-[30px] font-black leading-[1.08] text-black md:text-[38px]">{title}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="text-[30px] font-black leading-none text-black">{formatBRL(price)}</span>
              {discountPct > 0 && originalPrice ? <span className="text-[17px] text-black/35 line-through">{formatBRL(originalPrice)}</span> : null}
              {discountPct > 0 ? <span className="rounded-[6px] px-2 py-1 text-[12px] font-bold text-white" style={{ backgroundColor: accent }}>{discountPct}% OFF</span> : null}
            </div>
            <p className="mt-5 max-w-[520px] text-[15px] leading-[1.6] text-black/65">{description}</p>

            <div className="mt-6 h-px w-full bg-black/10" />

            {/* Variações reais do fornecedor (omitido quando não há) */}
            <ProductVariantPicker options={variants} accent={accent} />

            {/* Compre mais e economize (bundles) */}
            <StoreBundleOffers price={price} accent={accent} />

            {/* Acoes */}
            <div className="mt-7 flex gap-3">
              <button type="button" className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[12px] text-[15px] font-bold text-white transition hover:brightness-110" style={{ backgroundColor: accent }}>
                <ShoppingBag size={19} /> Adicionar ao carrinho
              </button>
              <button type="button" className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-black/15 text-black transition hover:bg-black/[0.04]" aria-label="Favoritar"><Heart size={20} /></button>
            </div>

            {/* Formas de pagamento */}
            <StorePaymentRow />

            {/* Selos de confianca */}
            <div className="mt-7 grid grid-cols-3 gap-4 border-t border-black/10 pt-6">
              {trustBadges.map(([Icon, badgeTitle, subtitle]) => (
                <div key={badgeTitle} className="flex flex-col items-start gap-1">
                  <Icon size={20} className="text-black/70" />
                  <span className="text-[13px] font-semibold text-black">{badgeTitle}</span>
                  <span className="text-[11px] text-black/50">{subtitle}</span>
                </div>
              ))}
            </div>

            {/* Cards de garantia */}
            <StoreGuaranteeCards accent={accent} />
          </div>
        </div>
      </section>

      {/* Barra de benefícios */}
      <StoreBenefitsBar accent={accent} />

      {/* Banner de urgência (novo) */}
      <StoreUrgencyBanner accent={accent} />

      {/* Como funciona em 3 passos */}
      <StoreThreeSteps image={image} accent={accent} mobile={mobile} />

      {/* Carrossel de uso (novo) */}
      <StoreUsageCarousel image={image} productImages={gallery} accent={accent} mobile={mobile} />

      {/* Por que vale a pena — checklist (novo).
          A partir daqui cada bloco pega uma foto diferente da galeria (galleryImageAt
          cicla), para a página não repetir a mesma imagem de cima a baixo. */}
      <StoreWhyWorthIt image={galleryImageAt(gallery, 1)} accent={accent} mobile={mobile} />

      {/* Grade de recursos + imagem */}
      <StoreFeatureGrid image={galleryImageAt(gallery, 2)} accent={accent} mobile={mobile} />

      {/* Avaliações reais dos clientes + formulário */}
      <StoreTestimonials image={image} accent={accent} mobile={mobile} projectId={projectId} productId={productId} />

      {/* Abas + detalhes */}
      <section className="border-t border-black/10 px-6 py-10 sm:px-10">
        <div className="mx-auto max-w-[1180px]">
          <div className="flex flex-wrap gap-7 border-b border-black/10">
            <span className="-mb-px border-b-2 border-black pb-3 text-[15px] font-semibold text-black">Detalhes</span>
          </div>
          <div className="mt-8 grid gap-8 lg:gap-12" style={{ gridTemplateColumns: mobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)" }}>
            <div>
              <p className="text-[15px] leading-[1.7] text-black/70">{description}</p>
            </div>
            <div className="aspect-[4/3] overflow-hidden rounded-[14px] bg-[#161616]">
              {galleryImageAt(gallery, 3) ? <img src={galleryImageAt(gallery, 3)} alt="" className="h-full w-full object-cover" /> : null}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ em acordeão (novo) */}
      <StoreFaqAccordion accent={accent} />

      {/* Bloco imagem + CTA */}
      <StoreImageCta image={galleryImageAt(gallery, 4)} accent={accent} title={title} mobile={mobile} />
    </div>
  );
};

export default ProductTemplate;
