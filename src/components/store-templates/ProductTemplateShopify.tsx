import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Truck,
} from "lucide-react";
import type { ProductTemplateProps } from "./ProductTemplate";
import { StoreBundleOffers, StorePaymentRow } from "@/components/store-templates/storeSections";
import { StoreBenefitsBar, StoreFeatureGrid, StoreImageCta, StoreThreeSteps } from "@/components/store-templates/storeContentSections";
import { galleryImageAt, useProductGallery } from "@/components/store-templates/productGallery";

const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const NAVY = "#1e3a8a";

const storeNav = ["Inicio", "Produtos", "Marcas", "Precos", "Contato"];
const reviews = [
  { name: "Lucas", text: "Qualidade de som incrivel e o cancelamento de ruido funciona muito bem!" },
  { name: "Marina", text: "O fone mais confortavel que ja tive. Uso o dia todo sem incomodo." },
  { name: "Eduardo", text: "Bateria dura muito e a conexao e estavel. Recomendo demais." },
  { name: "Bianca", text: "Chegou antes do prazo e superou minhas expectativas. Vale cada centavo." },
];
const faqItems = ["Envio e devolucoes", "Especificacoes do produto", "Informacoes de garantia"];
const trustBadges: Array<[typeof LockKeyhole, string, string]> = [
  [LockKeyhole, "Checkout seguro", "Pagamento protegido"],
  [Truck, "Frete rapido e gratis", "Para todo o Brasil"],
  [ShieldCheck, "Garantia de 30 dias", "Devolucao do dinheiro"],
];

const ProductTemplateShopify = ({ brand, title, description, price, originalPrice, image, images, productId, mobile = false }: ProductTemplateProps) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const discountPct = originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;
  const savings = Math.max(0, Math.round(originalPrice - price));
  const { gallery, active, current, setActive, prev, next, hasMany } = useProductGallery(images, image);

  return (
    <div className="bg-white text-[#111]">
      {/* Cabecalho */}
      <header className="flex items-center justify-between border-b border-black/10 bg-white px-6 py-4 sm:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-black text-white"><ShoppingBag size={15} /></span>
          <span className="text-[18px] font-black text-black">{brand}</span>
        </div>
        <nav className="hidden items-center rounded-full bg-[#f1f1f0] p-1 text-[13px] font-semibold text-black/65 md:flex">
          {storeNav.map((item, index) => (
            <span key={item} className={`flex cursor-pointer items-center gap-1 rounded-full px-4 py-2 transition ${index === 0 ? "bg-white text-black shadow-sm" : "hover:text-black"}`}>
              {item}
              {index === 1 ? <ChevronDown size={13} /> : null}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-4 text-black/75">
          <Search size={19} /><ShoppingBag size={19} /><ShoppingCart size={20} />
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="px-6 py-4 text-[12px] text-black/45 sm:px-10">Inicio <span className="mx-1">/</span> <span className="text-black/70">{title}</span></div>

      {/* Produto */}
      <section className="bg-[#f7f7f5] px-6 pb-12 pt-6 sm:px-10">
        <div className="mx-auto grid max-w-[1080px] items-start gap-10" style={{ gridTemplateColumns: mobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)" }}>
          {/* Galeria */}
          <div>
            <div className="relative aspect-square overflow-hidden rounded-[14px] bg-[#eaeaea]">
              {current ? <img data-editor-type="image" data-editor-product="true" data-editor-product-id={productId} src={current} alt={title} className="absolute inset-0 h-full w-full object-cover" /> : null}
              {hasMany ? (
                <>
                  <button type="button" onClick={prev} aria-label="Foto anterior" className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-md transition hover:bg-white"><ChevronLeft size={18} /></button>
                  <button type="button" onClick={next} aria-label="Proxima foto" className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-md transition hover:bg-white"><ChevronRight size={18} /></button>
                </>
              ) : null}
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {gallery.slice(0, 8).map((thumb, index) => (
                <button
                  type="button"
                  key={thumb}
                  onClick={() => setActive(index)}
                  aria-label={`Foto ${index + 1}`}
                  className={`aspect-square overflow-hidden rounded-[10px] bg-[#eaeaea] ${index === active ? "ring-2 ring-black ring-offset-2" : ""}`}
                >
                  <img data-editor-type="image" data-editor-product="true" data-editor-product-id={productId} src={thumb} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Informacoes */}
          <div className="flex flex-col">
            <h1 className="text-[30px] font-black leading-[1.08] text-black md:text-[38px]">{title}</h1>
            <div className="mt-4 flex items-center gap-2 text-[14px] font-semibold text-black">
              <span className="flex" style={{ color: "#f5b301" }}>{Array.from({ length: 5 }).map((_, index) => <Star key={index} size={17} fill="currentColor" strokeWidth={0} />)}</span>
              <span className="font-bold">4.9</span>
              <span className="font-medium text-black/55">baseado em <span className="underline">1.250 avaliacoes</span></span>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              {discountPct > 0 ? <span className="text-[17px] text-black/35 line-through">{formatBRL(originalPrice)}</span> : null}
              <span className="text-[36px] font-black leading-none text-black">{formatBRL(price)}</span>
              {discountPct > 0 ? <span className="mb-1 rounded-[6px] px-3 py-1 text-[12px] font-black" style={{ backgroundColor: "#e8efff", color: NAVY }}>ECONOMIZE {formatBRL(savings)} | {discountPct}% OFF</span> : null}
            </div>
            <p className="mt-5 max-w-[480px] text-[15px] leading-[1.55] text-black/70">{description}</p>

            <div className="mt-6 grid grid-cols-3 gap-3 text-[11px] font-semibold text-black/80">
              {trustBadges.map(([Icon, label, sub]) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon size={20} className="shrink-0" />
                  <span>{label}<span className="mt-0.5 block font-medium text-black/45">{sub}</span></span>
                </div>
              ))}
            </div>

            {/* Compre mais e economize (bundles) */}
            <StoreBundleOffers price={price} accent={NAVY} />

            <button type="button" className="mt-7 h-14 w-full rounded-full text-[15px] font-black text-white shadow-[0_14px_34px_rgba(30,58,138,0.24)] transition hover:-translate-y-0.5" style={{ background: `linear-gradient(90deg, ${NAVY}, #2563eb)` }}>
              Adicionar ao carrinho
            </button>
            <button type="button" className="mt-3 h-14 w-full rounded-full bg-black text-[15px] font-black text-white transition hover:-translate-y-0.5">
              Comprar agora
            </button>

            {/* Formas de pagamento */}
            <StorePaymentRow />
          </div>
        </div>
      </section>

      {/* Barra de benefícios */}
      <StoreBenefitsBar accent={NAVY} />

      {/* Como funciona em 3 passos */}
      <StoreThreeSteps image={image} accent={NAVY} mobile={mobile} />

      {/* Grade de recursos + imagem (foto diferente da do topo) */}
      <StoreFeatureGrid image={galleryImageAt(gallery, 1)} accent={NAVY} mobile={mobile} />

      {/* Avaliacoes */}
      <section className="bg-[#eeeeee] px-6 py-10 sm:px-10">
        <div className="mx-auto max-w-[1080px]">
          <h2 className="text-[28px] font-black text-black">Avaliacoes de clientes</h2>
          <div className="mt-5 flex gap-5 overflow-x-auto pb-2">
            {reviews.map((review) => (
              <article key={review.name} className="w-[280px] shrink-0 rounded-[12px] bg-white p-5 shadow-[0_16px_34px_rgba(0,0,0,0.08)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-[13px] font-black text-white">{review.name.slice(0, 1)}</span>
                  <span className="flex" style={{ color: "#f5b301" }}>{Array.from({ length: 5 }).map((_, index) => <Star key={index} size={14} fill="currentColor" strokeWidth={0} />)}</span>
                </div>
                <p className="mt-4 text-[14px] leading-snug text-black/80">{review.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#eeeeee] px-6 pb-12 sm:px-10">
        <div className="mx-auto max-w-[1080px]">
          <h2 className="text-[28px] font-black text-black">Perguntas frequentes</h2>
          <div className="mt-5 space-y-3">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={item} className="overflow-hidden rounded-[12px] border border-black/10 bg-white">
                  <button type="button" onClick={() => setOpenFaq(isOpen ? null : index)} className="flex h-14 w-full items-center justify-between px-5 text-left text-[15px] font-semibold text-black">
                    <span>{item}</span>
                    <ChevronDown size={19} className={`transition ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen ? <p className="px-5 pb-4 text-[14px] leading-relaxed text-black/60">Informacoes sobre {item.toLowerCase()} do seu pedido, com prazos, condicoes e suporte dedicado da nossa equipe.</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bloco imagem + CTA */}
      <StoreImageCta image={galleryImageAt(gallery, 2)} accent={NAVY} title={title} mobile={mobile} />

      {/* Barra fixa de compra */}
      <div className="flex items-center justify-between gap-4 border-t border-black/10 bg-white px-6 py-3 sm:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-[10px] bg-[#eaeaea]">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}</span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-black">{title}</p>
            <p className="text-[13px] font-semibold text-black/60">{formatBRL(price)}</p>
          </div>
        </div>
        <button type="button" className="h-11 shrink-0 rounded-full px-6 text-[13px] font-black text-white" style={{ background: `linear-gradient(90deg, ${NAVY}, #2563eb)` }}>Adicionar ao carrinho</button>
      </div>
    </div>
  );
};

export default ProductTemplateShopify;
