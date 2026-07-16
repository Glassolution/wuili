import { useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Heart,
  Instagram,
  Leaf,
  Minus,
  Phone,
  Plus,
  Search,
  Share2,
  ShoppingBag,
  Star,
  Twitter,
  UserRound,
  Youtube,
} from "lucide-react";
import type { ProductTemplateProps } from "./ProductTemplate";
import ProductVariantPicker from "@/components/store-templates/ProductVariantPicker";

const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const GREEN = "#1f5132";
const GOLD = "#c6963f";

const storeNav = ["Inicio", "Loja", "Skin Care", "Maquiagem", "Cabelo", "Sobre", "Blog"];
const tabs = ["Descricao", "Informacoes adicionais", "Avaliacoes"];
const ratingBars = [
  { label: "5", pct: 90 },
  { label: "4", pct: 62 },
  { label: "3", pct: 28 },
  { label: "2", pct: 12 },
  { label: "1", pct: 6 },
];
const reviews = [
  { name: "Camila Souza", time: "1 mes atras", title: "Amei o produto!", text: "Pele muito mais macia e hidratada logo na primeira semana. Absorve rapido e nao deixa oleoso.", rating: 5, withPhotos: true },
  { name: "Rafael Almeida", time: "2 meses atras", title: "Perfeito para a minha rotina", text: "Uso de manha e a noite. Textura leve e o cheiro e suave. Recomendo para quem esta comecando nos cuidados com a pele.", rating: 5, withPhotos: false },
  { name: "Beatriz Lima", time: "2 meses atras", title: "Valeu muito a pena", text: "Chegou bem embalado e antes do prazo. O frasco rende bastante e o resultado apareceu rapido.", rating: 4, withPhotos: false },
];
const additionalSpecs: Array<[string, string]> = [
  ["Volume", "30 ml"],
  ["Tipo de pele", "Todos os tipos"],
  ["Textura", "Serum leve"],
  ["Indicacao", "Uso diario, manha e noite"],
];
const detailBullets = ["Hidratacao profunda", "Absorcao rapida", "Livre de parabenos", "Testado dermatologicamente"];

const ProductTemplateBeauty = ({ brand, title, description, price, originalPrice, image, productId, mobile = false, variants = [] }: ProductTemplateProps) => {
  const [quantity, setQuantity] = useState(4);
  const [activeTab, setActiveTab] = useState(2);

  const thumbnails = image ? [image, image, image, image] : [];

  return (
    <div className="bg-white text-[#1d1d1d]">
      {/* Barra superior */}
      <div className="flex items-center justify-between gap-3 px-6 py-2.5 text-[12px] text-white sm:px-10" style={{ backgroundColor: GREEN }}>
        <span className="flex items-center gap-2">
          <Phone data-editor-type="icon" data-editor-icon="Phone" size={13} />
          <span data-editor-type="text">Ligue: +55 11 1234-5678</span>
        </span>
        <span data-editor-type="text" className="hidden text-center text-white/90 sm:block">Cadastre-se e ganhe <strong className="text-white">20% OFF</strong> no primeiro pedido. <span className="underline" style={{ color: GOLD }}>Cadastre-se agora</span></span>
        <span className="flex items-center gap-3 text-white/85">
          <Facebook data-editor-type="icon" data-editor-icon="Facebook" size={14} />
          <Twitter data-editor-type="icon" data-editor-icon="Twitter" size={14} />
          <Instagram data-editor-type="icon" data-editor-icon="Instagram" size={14} />
          <Youtube data-editor-type="icon" data-editor-icon="Youtube" size={14} />
        </span>
      </div>

      {/* Cabecalho */}
      <header className="flex items-center justify-between border-b border-black/10 bg-white px-6 py-4 sm:px-10">
        <div data-editor-type="other" data-editor-label="Logo da loja" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: GREEN }}>
            <Leaf data-editor-type="icon" data-editor-icon="Leaf" size={16} />
          </span>
          <span data-editor-type="text" className="text-[19px] font-bold text-[#1d1d1d]">{brand}<span style={{ color: GREEN }}>.</span></span>
        </div>
        <nav className="hidden items-center gap-6 text-[13px] font-medium text-black/70 lg:flex">
          {storeNav.map((item) => (
            <span key={item} data-editor-type="text" className="cursor-pointer transition hover:text-[#1d1d1d]">{item}</span>
          ))}
        </nav>
        <div className="flex items-center gap-4 text-black/70">
          <Search data-editor-type="icon" data-editor-icon="Search" size={18} />
          <Heart data-editor-type="icon" data-editor-icon="Heart" size={18} />
          <ShoppingBag data-editor-type="icon" data-editor-icon="ShoppingBag" size={18} />
          <UserRound data-editor-type="icon" data-editor-icon="UserRound" size={18} />
        </div>
      </header>

      {/* Banner breadcrumb */}
      <div className="bg-[#f4f4f2] px-6 py-9 text-center sm:px-10">
        <h1 data-editor-type="text" className="text-[30px] font-bold text-[#1d1d1d]">Loja</h1>
        <p data-editor-type="text" className="mt-1 text-[13px] text-black/50">Inicio <span className="mx-1">/</span> Loja <span className="mx-1">/</span> <span style={{ color: GREEN }}>Detalhes do produto</span></p>
      </div>

      {/* Produto */}
      <section className="px-6 py-10 sm:px-10">
        <div className="mx-auto grid max-w-[1160px] gap-10 lg:gap-14" style={{ gridTemplateColumns: mobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)" }}>
          {/* Galeria */}
          <div>
            <div className="relative aspect-square overflow-hidden rounded-[14px] bg-[#efeae0]">
              {image ? <img data-editor-type="image" data-editor-product="true" data-editor-product-id={productId} data-editor-label="Imagem principal do produto" src={image} alt={title} className="absolute inset-0 h-full w-full object-cover" /> : null}
              <button type="button" className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#1d1d1d] shadow-md" aria-label="Anterior"><ChevronLeft data-editor-icon="ChevronLeft" size={18} /></button>
              <button type="button" className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-md" style={{ backgroundColor: GREEN }} aria-label="Proximo"><ChevronRight data-editor-icon="ChevronRight" size={18} /></button>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {thumbnails.map((thumb, index) => (
                <span key={index} className={`aspect-square overflow-hidden rounded-[10px] bg-[#efeae0] ${index === 0 ? "ring-2 ring-offset-2" : ""}`} style={index === 0 ? { "--tw-ring-color": GREEN } as React.CSSProperties : undefined}>
                  <img data-editor-type="image" data-editor-product="true" data-editor-product-id={productId} data-editor-label={`Miniatura ${index + 1}`} src={thumb} alt="" className="h-full w-full object-cover" />
                </span>
              ))}
            </div>
          </div>

          {/* Informacoes */}
          <div className="flex flex-col">
            <span data-editor-type="text" className="text-[13px] font-medium text-black/45">Skin Care</span>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 data-editor-type="text" className="text-[28px] font-bold text-[#1d1d1d]">{title}</h2>
              <span data-editor-type="text" className="rounded-full border px-3 py-0.5 text-[11px] font-semibold" style={{ borderColor: GREEN, color: GREEN, backgroundColor: "#eaf3ec" }}>Em estoque</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[13px] text-black/60">
              <span className="flex" style={{ color: "#f5b301" }}>{Array.from({ length: 5 }).map((_, index) => <Star key={index} data-editor-type="icon" data-editor-icon="Star" size={15} fill="currentColor" strokeWidth={0} />)}</span>
              <span data-editor-type="text">4.8 (245 avaliacoes)</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span data-editor-type="text" className="text-[26px] font-bold" style={{ color: GREEN }}>{formatBRL(price)}</span>
              {originalPrice > price ? <span data-editor-type="text" className="text-[17px] text-black/35 line-through">{formatBRL(originalPrice)}</span> : null}
            </div>
            <p data-editor-type="text" className="mt-4 max-w-[520px] text-[14px] leading-[1.6] text-black/60">{description}</p>

            {/* Variações reais do fornecedor (omitido quando não há) */}
            <ProductVariantPicker options={variants} accent={GREEN} />

            {/* Quantidade + acoes */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex h-12 items-center rounded-full border border-black/15 px-2">
                <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-black/60 transition hover:bg-black/5" aria-label="Diminuir"><Minus data-editor-icon="Minus" size={16} /></button>
                <span data-editor-type="text" className="w-8 text-center text-[14px] font-semibold">{quantity}</span>
                <button type="button" onClick={() => setQuantity((q) => q + 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-black/60 transition hover:bg-black/5" aria-label="Aumentar"><Plus data-editor-icon="Plus" size={16} /></button>
              </div>
              <button type="button" className="h-12 rounded-full px-7 text-[14px] font-semibold text-white transition hover:brightness-110" style={{ backgroundColor: GREEN }}>Adicionar ao carrinho</button>
              <button type="button" className="h-12 rounded-full px-7 text-[14px] font-semibold text-white transition hover:brightness-110" style={{ backgroundColor: GOLD }}>Comprar agora</button>
              <button type="button" className="flex h-12 w-12 items-center justify-center rounded-full border border-black/15 text-black/60 transition hover:bg-black/[0.04]" aria-label="Favoritar"><Heart data-editor-icon="Heart" size={18} /></button>
            </div>

            <div className="mt-6 space-y-2 text-[13px] text-black/60">
              <p data-editor-type="text"><span className="font-semibold text-[#1d1d1d]">SKU:</span> GRFR85648HGJ</p>
              <p data-editor-type="text"><span className="font-semibold text-[#1d1d1d]">Tags:</span> Skincare, Serums, Vitamina C</p>
              <p className="flex items-center gap-3"><span data-editor-type="text" className="font-semibold text-[#1d1d1d]">Compartilhar:</span>
                <span className="flex items-center gap-2 text-white">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: GREEN }}><Facebook data-editor-type="icon" data-editor-icon="Facebook" size={12} /></span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: GREEN }}><Twitter data-editor-type="icon" data-editor-icon="Twitter" size={12} /></span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: GREEN }}><Instagram data-editor-type="icon" data-editor-icon="Instagram" size={12} /></span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: GREEN }}><Share2 data-editor-type="icon" data-editor-icon="Share2" size={12} /></span>
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Abas */}
      <section className="px-6 pb-12 sm:px-10">
        <div className="mx-auto max-w-[1160px]">
          <div className="flex flex-wrap justify-center gap-10 border-b border-black/10">
            {tabs.map((tab, index) => {
              const isActive = activeTab === index;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(index)}
                  className={`-mb-px border-b-2 pb-3 text-[16px] transition ${isActive ? "font-semibold text-[#1d1d1d]" : "border-transparent text-black/45 hover:text-black/70"}`}
                  style={isActive ? { borderColor: GREEN, color: GREEN } : undefined}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          <div className="mt-8">
            {activeTab === 0 ? (
              <div className="mx-auto max-w-[780px]">
                <p data-editor-type="text" className="text-[15px] leading-[1.7] text-black/70">{description}</p>
                <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {detailBullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-2.5 text-[14px] text-black/70">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ backgroundColor: GREEN }}><Check data-editor-type="icon" data-editor-icon="Check" size={12} /></span>
                      <span data-editor-type="text">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {activeTab === 1 ? (
              <div className="mx-auto max-w-[780px] overflow-hidden rounded-[12px] border border-black/10">
                {additionalSpecs.map(([label, value], index) => (
                  <div key={label} className={`flex items-center justify-between px-5 py-3 text-[14px] ${index % 2 === 0 ? "bg-[#f7f7f5]" : "bg-white"}`}>
                    <span data-editor-type="text" className="font-semibold text-[#1d1d1d]">{label}</span>
                    <span data-editor-type="text" className="text-black/60">{value}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {activeTab === 2 ? (
              <div>
                {/* Resumo */}
                <div className="grid gap-8 border-b border-black/10 pb-8" style={{ gridTemplateColumns: mobile ? "1fr" : "220px minmax(0,1fr)" }}>
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="flex items-end gap-1"><span data-editor-type="text" className="text-[46px] font-bold leading-none text-[#1d1d1d]">4.8</span><span data-editor-type="text" className="mb-1 text-[13px] text-black/45">de 5</span></div>
                    <span className="mt-2 flex" style={{ color: "#f5b301" }}>{Array.from({ length: 5 }).map((_, index) => <Star key={index} data-editor-type="icon" data-editor-icon="Star" size={16} fill="currentColor" strokeWidth={0} />)}</span>
                    <span data-editor-type="text" className="mt-1 text-[12px] text-black/45">(245 avaliacoes)</span>
                  </div>
                  <div className="flex flex-col justify-center gap-2">
                    {ratingBars.map((bar) => (
                      <div key={bar.label} className="flex items-center gap-3 text-[12px] text-black/55">
                        <span data-editor-type="text" className="w-12 shrink-0">{bar.label} Estrelas</span>
                        <span data-editor-type="other" data-editor-label={`Barra de ${bar.label} estrelas`} className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.08]">
                          <span className="block h-full rounded-full" style={{ width: `${bar.pct}%`, backgroundColor: "#f5b301" }} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lista */}
                <div className="mt-8 flex items-center justify-between">
                  <div>
                    <h3 data-editor-type="text" className="text-[18px] font-bold text-[#1d1d1d]">Lista de avaliacoes</h3>
                    <p data-editor-type="text" className="mt-1 text-[13px] text-black/45">Mostrando 1-3 de 24 resultados</p>
                  </div>
                  <div data-editor-type="text" className="flex items-center gap-2 text-[13px] text-black/60">
                    Ordenar por:
                    <span className="flex items-center gap-1 rounded-[8px] border border-black/15 px-3 py-1.5 font-medium text-[#1d1d1d]">Mais recentes <ChevronRight size={13} className="rotate-90" /></span>
                  </div>
                </div>

                <div className="mt-6 divide-y divide-black/10">
                  {reviews.map((review) => (
                    <article key={review.name} data-editor-type="other" data-editor-label={`Avaliação de ${review.name}`} className="py-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span data-editor-type="text" className="flex h-11 w-11 items-center justify-center rounded-full text-[14px] font-bold text-white" style={{ backgroundColor: GREEN }}>{review.name.slice(0, 1)}</span>
                          <div>
                            <p data-editor-type="text" className="text-[14px] font-semibold text-[#1d1d1d]">{review.name}</p>
                            <p data-editor-type="text" className="text-[12px]" style={{ color: GREEN }}>(Verificado)</p>
                          </div>
                        </div>
                        <span data-editor-type="text" className="text-[12px] text-black/40">{review.time}</span>
                      </div>
                      <h4 data-editor-type="text" className="mt-4 text-[15px] font-semibold text-[#1d1d1d]">{review.title}</h4>
                      <p data-editor-type="text" className="mt-2 max-w-[720px] text-[14px] leading-[1.6] text-black/60">{review.text}</p>
                      <span className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-[#1d1d1d]">
                        <span className="flex" style={{ color: "#f5b301" }}>{Array.from({ length: review.rating }).map((_, index) => <Star key={index} data-editor-type="icon" data-editor-icon="Star" size={14} fill="currentColor" strokeWidth={0} />)}</span>
                        <span data-editor-type="text">{review.rating.toFixed(1)}</span>
                      </span>
                      {review.withPhotos && image ? (
                        <div className="mt-4 flex gap-3">
                          {[0, 1, 2].map((index) => (
                            <span key={index} className="h-20 w-24 overflow-hidden rounded-[10px] bg-[#efeae0]">
                              <img data-editor-type="image" data-editor-label={`Foto da avaliação ${index + 1}`} src={image} alt="" className="h-full w-full object-cover" />
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProductTemplateBeauty;
