import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Heart,
  Menu,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  UserCircle,
} from "lucide-react";

export type ProductTemplateProps = {
  brand: string;
  title: string;
  description: string;
  price: number;
  originalPrice: number;
  image: string;
  accent: string;
  mobile?: boolean;
};

const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const storeNav = ["Inicio", "Loja", "Novidades", "Colecoes", "Ofertas", "Blog"];
const sizeOptions = ["PP", "P", "M", "G", "GG"];
const colorSwatches = [
  { name: "Grafite", value: "#4b4b4b" },
  { name: "Cinza", value: "#b9b9b7" },
  { name: "Areia", value: "#e6dcc8" },
  { name: "Preto", value: "#161616" },
];
const productTabs = ["Detalhes", "Materiais", "Tamanho e caimento", "Envio e trocas"];
const detailBullets = [
  "Modelagem oversized",
  "Tecido macio e encorpado",
  "Capuz com cordao ajustavel",
  "Punhos e barra canelados",
  "Estilo unissex",
];
const trustBadges: Array<[typeof Truck, string, string]> = [
  [Truck, "Frete gratis", "Em pedidos acima de R$ 199"],
  [RefreshCcw, "Troca facil", "30 dias para devolucao"],
  [ShieldCheck, "Pagamento seguro", "100% protegido"],
];

const ProductTemplate = ({ brand, title, description, price, originalPrice, image, accent, mobile = false }: ProductTemplateProps) => {
  const [selectedSize, setSelectedSize] = useState("M");
  const [selectedColor, setSelectedColor] = useState(0);
  const [activeTab, setActiveTab] = useState(0);

  const discountPct = originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;
  const thumbnails = image ? [image, image, image, image] : [];
  const relatedProducts = Array.from({ length: 4 }, () => ({ name: title, price }));

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
              {thumbnails.map((thumb, index) => (
                <span key={index} className={`h-[86px] w-[70px] overflow-hidden rounded-[10px] border ${index === 0 ? "border-black" : "border-black/10"}`}>
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                </span>
              ))}
            </div>
            <div className="relative aspect-[4/5] flex-1 overflow-hidden rounded-[14px] bg-[#f1f1f0]">
              {image ? <img src={image} alt={title} className="absolute inset-0 h-full w-full object-cover" /> : null}
              <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black shadow"><Search size={16} /></span>
            </div>
          </div>

          {/* Informacoes */}
          <div className="flex flex-col">
            <span className="inline-flex w-fit items-center rounded-full bg-[#f0f0ef] px-3 py-1 text-[12px] font-semibold text-black/65">Novidade</span>
            <h1 className="mt-4 max-w-[520px] text-[30px] font-black leading-[1.08] text-black md:text-[38px]">{title}</h1>
            <div className="mt-3 flex items-center gap-2 text-[14px] text-black/55">
              <span className="flex text-black">{Array.from({ length: 5 }).map((_, index) => <Star key={index} size={16} fill="currentColor" strokeWidth={0} />)}</span>
              <span>4.8 (128 avaliacoes)</span>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="text-[30px] font-black leading-none text-black">{formatBRL(price)}</span>
              {discountPct > 0 ? <span className="text-[17px] text-black/35 line-through">{formatBRL(originalPrice)}</span> : null}
              {discountPct > 0 ? <span className="rounded-[6px] px-2 py-1 text-[12px] font-bold text-white" style={{ backgroundColor: accent }}>{discountPct}% OFF</span> : null}
            </div>
            <p className="mt-5 max-w-[520px] text-[15px] leading-[1.6] text-black/65">{description}</p>

            <div className="mt-6 h-px w-full bg-black/10" />

            {/* Cor */}
            <div className="mt-6">
              <p className="text-[14px] font-semibold text-black">Cor: <span className="font-medium text-black/55">{colorSwatches[selectedColor].name}</span></p>
              <div className="mt-3 flex items-center gap-3">
                {colorSwatches.map((color, index) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setSelectedColor(index)}
                    aria-label={color.name}
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ outline: selectedColor === index ? `2px solid ${accent}` : "none", outlineOffset: "2px" }}
                  >
                    <span className="h-8 w-8 rounded-full border border-black/10" style={{ backgroundColor: color.value }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Tamanho */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-semibold text-black">Tamanho: <span className="font-medium text-black/55">{selectedSize}</span></p>
                <button type="button" className="text-[13px] font-medium text-black/55 underline underline-offset-4 transition hover:text-black">Guia de tamanhos</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {sizeOptions.map((size) => {
                  const isActive = selectedSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`h-11 min-w-[54px] rounded-[10px] border px-3 text-[14px] font-semibold transition ${isActive ? "border-transparent text-white" : "border-black/15 text-black hover:border-black/50"}`}
                      style={isActive ? { backgroundColor: accent } : undefined}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Acoes */}
            <div className="mt-7 flex gap-3">
              <button type="button" className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[12px] text-[15px] font-bold text-white transition hover:brightness-110" style={{ backgroundColor: accent }}>
                <ShoppingBag size={19} /> Adicionar ao carrinho
              </button>
              <button type="button" className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-black/15 text-black transition hover:bg-black/[0.04]" aria-label="Favoritar"><Heart size={20} /></button>
            </div>

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
          </div>
        </div>
      </section>

      {/* Abas + detalhes */}
      <section className="border-t border-black/10 px-6 py-10 sm:px-10">
        <div className="mx-auto max-w-[1180px]">
          <div className="flex flex-wrap gap-7 border-b border-black/10">
            {productTabs.map((tab, index) => {
              const isActive = activeTab === index;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(index)}
                  className={`-mb-px border-b-2 pb-3 text-[15px] transition ${isActive ? "border-black font-semibold text-black" : "border-transparent text-black/45 hover:text-black/70"}`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
          <div className="mt-8 grid gap-8 lg:gap-12" style={{ gridTemplateColumns: mobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)" }}>
            <div>
              <p className="text-[15px] leading-[1.7] text-black/70">{description}</p>
              <ul className="mt-6 space-y-3">
                {detailBullets.map((bullet) => (
                  <li key={bullet} className="flex items-center gap-3 text-[14px] font-medium text-black/75">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: accent }}><Check size={12} className="text-white" /></span>
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
            <div className="aspect-[4/3] overflow-hidden rounded-[14px] bg-[#161616]">
              {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}
            </div>
          </div>
        </div>
      </section>

      {/* Voce tambem pode gostar */}
      <section className="bg-[#faf9f8] px-6 py-12 sm:px-10">
        <div className="mx-auto max-w-[1180px]">
          <div className="flex items-center justify-between">
            <h2 className="text-[24px] font-black text-black">Voce tambem pode gostar</h2>
            <button type="button" className="flex items-center gap-1.5 text-[14px] font-semibold text-black/70 transition hover:text-black">Ver todos <ArrowRight size={16} /></button>
          </div>
          <div className="mt-7 grid gap-5" style={{ gridTemplateColumns: mobile ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))" }}>
            {relatedProducts.map((item, index) => (
              <article key={index} className="group">
                <div className="relative aspect-square overflow-hidden rounded-[14px] bg-[#f1f1f0]">
                  {image ? <img src={image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : null}
                  <button type="button" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black shadow transition hover:bg-white" aria-label="Favoritar"><Heart size={15} /></button>
                </div>
                <h3 className="mt-3 line-clamp-1 text-[14px] font-semibold text-black">{item.name}</h3>
                <p className="mt-0.5 text-[14px] text-black/60">{formatBRL(item.price)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProductTemplate;
