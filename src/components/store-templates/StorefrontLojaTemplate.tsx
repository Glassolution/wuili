// Template "Loja completa" (C-style) compartilhado.
//
// Reproduz fielmente a vitrine que o editor (GeneratedStoreEditorPage) renderiza
// para o template `loja-1`, para que a página publicada (PublicStorePage) fique
// idêntica ao que foi editado. As derivações (categorias, headline, coleções,
// selos) são feitas internamente a partir de props cruas, exatamente como no
// editor. A estrutura DOM é mantida igual para que os `elementOverrides`
// salvos sejam reaplicáveis pelos mesmos paths.
import {
  Baby,
  BookOpen,
  Boxes,
  Car,
  ChevronLeft,
  Dumbbell,
  Gamepad2,
  Gem,
  Gift,
  Headphones,
  Heart,
  HeartPulse,
  Home,
  Laptop,
  LockKeyhole,
  Menu,
  PawPrint,
  RefreshCcw,
  Shirt,
  ShoppingCart,
  Star,
  Truck,
} from "lucide-react";
import StorefrontNavbar from "@/components/storefront/StorefrontNavbar";
import { formatPriceBRL as formatBRL } from "@/lib/priceFormat";
import StoreReviews from "@/components/store-templates/StoreReviews";

export type LojaTemplateProduct = {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
  category?: string | null;
  rating?: number;
  averageRating?: number;
  ratingCount?: string | number;
  reviewCount?: string | number;
  reviewsCount?: string | number;
};

export type StorefrontLojaTemplateProps = {
  storeName: string;
  accent: string;
  heroImage: string;
  logoImage?: string | null;
  salesAngle?: string;
  heroCtaUrl?: string;
  copyVariant?: number;
  products: LojaTemplateProduct[];
  mobile?: boolean;
  /** Projeto dono da loja. Alimenta as avaliações reais (store_reviews).
   *  Ausente = preview do editor: o bloco aparece, mas não grava avaliação. */
  projectId?: string;
};

const catalogTaxonomy = [
  "Casa",
  "Eletrônicos",
  "Moda",
  "Bijuterias",
  "Decoração",
  "Bebê e Infantil",
  "Pet",
  "Beleza",
  "Saúde e Bem-estar",
  "Esporte e Fitness",
  "Outros",
];

const getCategoryIcon = (category: string) => {
  const normalized = category.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/moda|fashion|roupa|feminin|masculin/.test(normalized)) return Shirt;
  if (/casa|decoracao/.test(normalized)) return Home;
  if (/eletron/.test(normalized)) return Laptop;
  if (/bijuter/.test(normalized)) return Gem;
  if (/bebe|infantil/.test(normalized)) return Baby;
  if (/pet/.test(normalized)) return PawPrint;
  if (/saude|beleza/.test(normalized)) return HeartPulse;
  if (/esporte|fitness/.test(normalized)) return Dumbbell;
  if (/brinquedo|jogo|game/.test(normalized)) return Gamepad2;
  if (/auto|carro|moto/.test(normalized)) return Car;
  if (/livro|papelaria/.test(normalized)) return BookOpen;
  return Boxes;
};

const heroNavLinks = [
  { label: "Loja", href: "#", left: "27.85%", width: "4.9%" },
  { label: "Ofertas", href: "#ofertas", left: "35.82%", width: "5.4%" },
  { label: "Novidades", href: "#novidades", left: "44.18%", width: "6.8%" },
  { label: "Marcas", href: "#marcas", left: "52.58%", width: "5.4%" },
  { label: "Inspiração", href: "#inspiracao", left: "60.6%", width: "7.4%" },
];

const collectionStyles = ["bg-[#eef1de]", "bg-[#e6ecd0]", "bg-[#dae4c2]", "bg-[#f2efe1]"];

const collectionDescriptions: Record<string, string> = {
  Casa: "Peças para deixar seu espaço mais bonito.",
  "Eletrônicos": "Acessórios úteis para simplificar sua rotina.",
  Moda: "Achados versáteis para usar todos os dias.",
  Bijuterias: "Detalhes delicados para completar o look.",
  Beleza: "Essenciais para cuidar de você.",
  "Esporte e Fitness": "Itens práticos para movimento e energia.",
  Outros: "Produtos selecionados para explorar agora.",
};

const trustBadges = [
  { title: "Frete Grátis", description: "Em pedidos acima de R$ 199", icon: Truck },
  { title: "Troca Fácil", description: "Em até 30 dias", icon: RefreshCcw },
  { title: "Pagamento Seguro", description: "100% protegido", icon: LockKeyhole },
  { title: "Suporte 24/7", description: "Estamos aqui pra ajudar", icon: Headphones },
];

const copyPool = [
  { p: "Escolhas que", s: "Facilitam seu dia", sub: "Tecnologia, casa, bem-estar e muito mais em uma seleção feita para você.", cta1: "Comprar agora", cta2: "Ver categorias" },
  { p: "Tudo o que", s: "Você procura", sub: "Descubra novidades úteis, ofertas especiais e produtos para todos os momentos.", cta1: "Ver novidades", cta2: "Explorar loja" },
  { p: "Novas ideias", s: "Para sua rotina", sub: "Uma curadoria diversa de produtos que combinam praticidade, qualidade e bom preço.", cta1: "Descobrir produtos", cta2: "Ver ofertas" },
];

const StorefrontLojaTemplate = ({
  storeName,
  accent,
  heroImage,
  logoImage = null,
  salesAngle = "",
  heroCtaUrl = "/catalogo",
  copyVariant = 0,
  products,
  mobile = false,
  projectId,
}: StorefrontLojaTemplateProps) => {
  const displayedProducts = products.length
    ? products
    : [{ id: "placeholder", title: "Produto", price: 149.9, imageUrl: heroImage, category: "Outros" }];
  const categories = Array.from(new Set(displayedProducts.map((product) => product.category).filter(Boolean))).slice(0, 8) as string[];
  const browseCategories = catalogTaxonomy.map((category, index) => ({
    category,
    imageUrl:
      displayedProducts.find((product) => product.category === category)?.imageUrl ||
      displayedProducts[index % displayedProducts.length]?.imageUrl ||
      heroImage,
  }));
  const sidebarIconCategories = catalogTaxonomy.slice(0, 10);
  const sidebarExtraCategories = catalogTaxonomy.slice(10);
  const categoryHighlights = Array.from({ length: 4 }, (_, index) => {
    const category = categories[index % Math.max(categories.length, 1)] || displayedProducts[index % displayedProducts.length]?.category || "Outros";
    return {
      category,
      imageUrl: displayedProducts.find((product) => product.category === category)?.imageUrl || heroImage,
      key: `${category}-${index}`,
    };
  });
  const copy = copyPool[copyVariant % copyPool.length];
  const headlinePrimary = copy.p;
  const headlineSecondary = copy.s;
  const heroSubtitle = salesAngle ? salesAngle.slice(0, 120) : copy.sub;
  const ctaPrimary = copy.cta1;
  const heroCtaHref = heroCtaUrl.trim() || "/catalogo";
  const brandName = storeName;

  return (
    <>
      <StorefrontNavbar storeName={brandName} logoImage={logoImage} activePage="store" className="relative z-30" />

      <section className="relative overflow-hidden bg-[#1a3c2a] shadow-[0_14px_34px_rgba(20,42,26,0.22)]">
        <img src={heroImage} alt="" aria-hidden="true" className="block h-auto w-full" />
        <div className="absolute inset-0" aria-label="Conteúdo do banner principal">
          <div className="absolute z-20 overflow-hidden bg-[#f5f2ea] text-[#1f2933]" style={{ left: "3.12%", top: "0%", width: "19.45%", height: "100%" }}>
            <div className="flex h-[7.9%] w-full items-center border-b border-black/5 bg-[#f5f2ea] px-[5%]" style={{ fontSize: "clamp(7.5px,0.82vw,13px)" }}>
              <div className="flex h-[68%] w-full items-center gap-[7%] rounded-full bg-[#1a3c2a] px-[6%] text-white">
                <Menu size={15} strokeWidth={2} className="h-[1.18em] w-[1.18em] shrink-0" />
                <span className="font-medium leading-none">Categorias</span>
              </div>
            </div>
            <div className="h-[92.1%] overflow-y-auto px-[7%] py-[4.2%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sidebarIconCategories.map((category) => {
                const CategoryIcon = getCategoryIcon(category);
                return (
                  <a key={category} href="#categorias" onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = accent; event.currentTarget.style.color = "#fff"; }} onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = ""; event.currentTarget.style.color = "#1f2933"; }} className="group flex h-[9.2%] min-h-[30px] w-full items-center gap-[8%] rounded-[2px] px-[3%] font-medium leading-none text-[#1f2933] transition" style={{ fontSize: "clamp(7px,0.72vw,10.5px)" }}>
                    <CategoryIcon size={15} strokeWidth={1.65} className="h-[1.55em] w-[1.55em] shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{category}</span>
                    <ChevronLeft size={12} className="h-[1.28em] w-[1.28em] shrink-0 rotate-180 text-current opacity-70" />
                  </a>
                );
              })}
              {sidebarExtraCategories.map((category) => (
                <a key={category} href="#categorias" onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = accent; event.currentTarget.style.color = "#fff"; }} onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = ""; event.currentTarget.style.color = "#1f2933"; }} className="flex min-h-[24px] w-full items-center rounded-[2px] px-[3%] font-medium leading-none text-[#1f2933] transition" style={{ fontSize: "clamp(6.5px,0.66vw,9.5px)" }}>{category}</a>
              ))}
              <div className="my-[4%] border-t border-black/10" />
              {["Ofertas especiais", "Cartões presente"].map((item) => (
                <a key={item} href="#ofertas" onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = accent; event.currentTarget.style.color = "#fff"; }} onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = ""; event.currentTarget.style.color = "#1f2933"; }} className="flex min-h-[28px] w-full items-center gap-[8%] rounded-[2px] px-[3%] font-medium leading-none text-[#1f2933] transition" style={{ fontSize: "clamp(7px,0.72vw,10.5px)" }}>
                  <Gift size={15} strokeWidth={1.65} className="h-[1.55em] w-[1.55em] shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item}</span>
                </a>
              ))}
            </div>
          </div>
          <span aria-hidden="true" className="absolute z-10 bg-[#0f2e1c]" style={{ left: "27.1%", top: "3.55%", width: "39.2%", height: "3.8%" }} />
          <span aria-hidden="true" className="absolute z-10 bg-[#14351f]" style={{ left: "80.6%", top: "3.55%", width: "14.2%", height: "3.8%" }} />
          {heroNavLinks.map((item) => (
            <a key={item.label} href={item.href} className="absolute z-20 flex items-center whitespace-nowrap px-[0.15%] font-semibold leading-none text-white transition hover:text-white/75" style={{ left: item.left, top: "3.92%", width: item.width, height: "3.05%", fontSize: "clamp(9.5px,0.86vw,14px)" }}>{item.label}</a>
          ))}
          <a href="tel:+551234567890" className="absolute z-20 flex items-center whitespace-nowrap px-[0.15%] font-semibold leading-none text-white transition hover:text-white/75" style={{ left: "81.1%", top: "3.92%", width: "13.45%", height: "3.05%", fontSize: "clamp(9.5px,0.86vw,14px)" }}>Suporte: (123) 456-7890</a>
          <div className="absolute text-white" style={{ left: "27.35%", top: "50%", width: "28.4%", transform: "translateY(-50%)" }}>
            <span className="inline-flex items-center rounded-full bg-[#e8ecd6] px-[3.2%] py-[1.2%] font-semibold uppercase tracking-[0.08em] text-[#1a3c2a]" style={{ fontSize: "clamp(6.5px,0.68vw,10.5px)" }}>{categories[0] || "Novidades"}</span>
            <h1 className="mt-[2.8%] font-semibold leading-[1.06] tracking-[-0.012em] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.22)]" style={{ fontSize: "clamp(22px,2.55vw,44px)" }}>{headlinePrimary}<br />{headlineSecondary}</h1>
            <p className="mt-[3.4%] truncate font-normal leading-none text-white/78" style={{ fontSize: "clamp(8px,0.86vw,13.5px)" }}>{heroSubtitle}</p>
            <a href={heroCtaHref} className="mt-[5%] inline-flex items-center justify-center whitespace-nowrap rounded-full bg-[#f5f2ea] font-semibold text-[#1a3c2a] shadow-[0_7px_18px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:bg-white" style={{ minWidth: "36%", height: "clamp(26px,2.65vw,44px)", paddingInline: "5.5%", gap: "0.45rem", fontSize: "clamp(6.5px,0.68vw,10.5px)" }}>{ctaPrimary || "Comprar agora"}<ChevronLeft aria-hidden="true" size={10} strokeWidth={2} className="rotate-180" /></a>
          </div>
          <div className="absolute z-20 flex items-center gap-[1.2%]" style={{ left: "39.9%", top: "94.1%", width: "8.8%", height: "2.8%" }} aria-label="Carrossel do banner">
            {[0, 1, 2].map((dot) => (
              <button key={dot} type="button" aria-label={`Banner ${dot + 1}`} className="h-full flex-1 rounded-full bg-transparent" />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-7 pt-5">
        <div className="mb-4 text-center">
          <h2 className="text-[15px] font-semibold leading-none tracking-normal">Navegue por categorias</h2>
          <p className="mt-1 text-[9px] leading-none text-black/50">Explore coleções selecionadas para cada parte da sua rotina.</p>
        </div>
        <div className="relative">
          <div className="flex w-full items-start justify-between gap-3 overflow-x-auto pb-2 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {browseCategories.map(({ category, imageUrl }) => (
              <a key={category} href="#categorias" className="group grid w-[84px] shrink-0 grid-rows-[84px_28px] justify-items-center gap-2 text-center">
                <span className="flex h-[84px] w-[84px] items-center justify-center overflow-hidden rounded-full bg-[#eef1de] ring-1 ring-[#1a3c2a]/5 transition duration-300 group-hover:-translate-y-1 group-hover:bg-[#e6ecd0]">
                  <img src={imageUrl} alt={category} className="h-full w-full object-contain p-2" />
                </span>
                <span className="flex min-h-[24px] items-start justify-center text-[8.5px] font-medium leading-tight text-[#1a3c2a]/80">{category}</span>
              </a>
            ))}
          </div>
          <button type="button" aria-label="Ver mais categorias" className="absolute right-0 top-[28px] flex h-8 w-8 items-center justify-center rounded-full border border-[#1a3c2a]/10 bg-[#f5f2ea] text-[#1a3c2a] shadow-[0_4px_14px_rgba(26,60,42,0.14)] transition hover:-translate-y-0.5"><ChevronLeft size={14} className="rotate-180" /></button>
        </div>
      </section>

      <section className="px-6 pb-8 pt-1">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-[16px] font-semibold leading-none tracking-normal text-[#1a3c2a]">Produtos em alta <span className="ml-1 inline-flex items-center rounded-full bg-[#e8ecd6] px-2 py-0.5 text-[9px] font-semibold text-[#1a3c2a]">Best Seller</span></h2>
            <p className="mt-1 text-[10px] text-black/50">Os produtos mais recentes da sua loja.</p>
          </div>
          <a href="#produtos" className="inline-flex items-center gap-2 rounded-full bg-[#eef1de] px-3 py-1.5 text-[10px] font-medium text-[#1a3c2a] transition hover:bg-[#e6ecd0]">Ver todos <ChevronLeft size={12} className="rotate-180" /></a>
        </div>
        <div id="produtos" className={`grid gap-x-4 gap-y-6 ${mobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-6"}`}>
          {displayedProducts.slice(0, 6).map((product) => {
            // Só a nota real informada pelo fornecedor. O fallback anterior
            // (getProductCatalogMetrics) gerava nota entre 4.0 e 5.0 e uma
            // contagem de 50 a 2000 a partir do hash do id — número inventado
            // exibido ao cliente final como se fosse avaliação de verdade.
            const explicitRating = product.rating ?? product.averageRating;
            const explicitCount = product.ratingCount ?? product.reviewCount ?? product.reviewsCount;
            const ratingLabel = typeof explicitRating === "number"
              ? `${explicitRating.toFixed(1)}${explicitCount ? ` (${explicitCount})` : ""}`
              : null;
            return (
              <article key={product.id} className="group min-w-0">
                <div className="relative aspect-[1/1.04] overflow-hidden rounded-[18px] bg-[#f5f2ea]">
                  <img src={product.imageUrl || heroImage} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <button type="button" aria-label={`Favoritar ${product.title}`} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#1a3c2a]/70 shadow-sm transition hover:text-[#1a3c2a]"><Heart size={12} strokeWidth={1.5} /></button>
                </div>
                {ratingLabel ? <div className="mt-2 flex items-center gap-1 text-[8.5px] font-semibold text-[#1a3c2a]/60"><Star size={10} strokeWidth={1.8} className="fill-[#c9a84c] text-[#c9a84c]" /><span>{ratingLabel}</span></div> : null}
                <h3 className="mt-1 line-clamp-2 min-h-[28px] text-[11px] font-medium leading-snug text-[#1a3c2a]/90">{product.title}</h3>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <strong className="text-[12px] font-semibold text-[#1a3c2a]">{formatBRL(Math.max(product.price * 2.1, product.price + 20))}</strong>
                  <button type="button" aria-label={`Adicionar ${product.title} ao carrinho`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#1a3c2a]/15 bg-[#f5f2ea] text-[#1a3c2a] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#eef1de]"><ShoppingCart size={14} strokeWidth={1.75} /></button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 px-8 py-10 md:grid-cols-2">
        <div className="relative flex min-h-[220px] overflow-hidden rounded-[20px] bg-[#1a3c2a] text-white">
          <div className="relative z-10 flex flex-1 flex-col justify-between p-6">
            <div>
              <strong className="inline-flex items-center rounded-full bg-[#e8ecd6] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#1a3c2a]">Oferta especial</strong>
              <h3 className="mt-3 text-[28px] font-semibold leading-[1.04] tracking-[-0.015em]">Preços que surpreendem</h3>
              <p className="mt-2 max-w-[180px] text-[10px] text-white/60">Encontre produtos selecionados com condições especiais por tempo limitado.</p>
            </div>
            <button className="mt-4 w-fit rounded-full bg-[#f5f2ea] px-4 py-1.5 text-[9.5px] font-medium text-[#1a3c2a] shadow-[0_6px_14px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5">Ver ofertas</button>
          </div>
          <div className="relative w-[44%] shrink-0 overflow-hidden"><img src={displayedProducts[1 % displayedProducts.length]?.imageUrl || heroImage} alt="" className="absolute inset-0 h-full w-full object-cover object-center" /></div>
        </div>
        <div className="relative flex min-h-[220px] overflow-hidden rounded-[20px] bg-[#eef1de]">
          <div className="relative z-10 flex flex-1 flex-col justify-between p-6">
            <div>
              <strong className="inline-flex items-center rounded-full bg-[#1a3c2a] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#f5f2ea]">Acabou de chegar</strong>
              <h3 className="mt-3 text-[28px] font-semibold leading-[1.04] tracking-[-0.015em] text-[#1a3c2a]">Novidades para você</h3>
              <p className="mt-2 max-w-[180px] text-[10px] text-[#1a3c2a]/60">Explore os lançamentos mais recentes de todas as categorias da loja.</p>
            </div>
            <button className="mt-4 w-fit rounded-full bg-[#1a3c2a] px-4 py-1.5 text-[9.5px] font-medium text-[#f5f2ea] shadow-[0_6px_14px_rgba(0,0,0,0.15)] transition hover:-translate-y-0.5">Conhecer novidades</button>
          </div>
          <div className="relative w-[44%] shrink-0 overflow-hidden"><img src={displayedProducts[2 % displayedProducts.length]?.imageUrl || heroImage} alt="" className="absolute inset-0 h-full w-full object-cover object-center" /></div>
        </div>
      </section>

      <section className="px-8 pb-6 pt-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold leading-none tracking-normal text-black">Coleções em destaque</h2>
            <p className="mt-2 text-[10.5px] leading-none text-black/50">Explore a loja pela categoria que combina com você.</p>
          </div>
          <a href="/catalogo" className="inline-flex shrink-0 items-center gap-1.5 text-[10.5px] font-medium text-black transition hover:translate-x-0.5 hover:text-black/65">Ver todas <span aria-hidden="true">→</span></a>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {categoryHighlights.map(({ category, imageUrl, key }, index) => (
            <a key={key} href={`/catalogo?categoria=${encodeURIComponent(category)}`} className={`group relative aspect-[1.55/1] overflow-hidden rounded-[14px] ${collectionStyles[index % collectionStyles.length]} text-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.035)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_35px_rgba(16,24,40,0.12)]`}>
              <img src={imageUrl} alt={category} className="absolute bottom-0 right-0 h-[96%] w-[68%] object-contain object-right-bottom p-2 transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-x-0 bottom-0 z-10 p-4">
                <strong className="block max-w-[56%] text-[13px] font-semibold leading-[1.08] text-black">{category}</strong>
                <span className="mt-1 block max-w-[58%] text-[8.5px] font-normal leading-snug text-black/58">{collectionDescriptions[category] || "Explore produtos escolhidos para você."}</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section aria-label="Benefícios da loja" className="mx-8 mb-8 overflow-hidden rounded-[10px] bg-[#06263b] text-white shadow-[0_14px_30px_rgba(2,20,32,0.14)]">
        <div className={`grid ${mobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
          {trustBadges.map(({ title, description, icon: Icon }, index) => (
            <div key={title} className={`flex min-h-[64px] items-center gap-3 px-5 py-4 ${index > 0 ? "md:border-l md:border-white/10" : ""} ${index > 1 ? "border-t border-white/10 md:border-t-0" : ""}`}>
              <Icon size={18} strokeWidth={1.75} className="shrink-0 text-white/90" />
              <div className="min-w-0">
                <strong className="block text-[10px] font-semibold leading-tight text-white">{title}</strong>
                <span className="mt-0.5 block text-[8px] leading-tight text-white/70">{description}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Avaliações reais dos clientes + formulário */}
      <StoreReviews projectId={projectId} accent={accent} mobile={mobile} background="#ffffff" />

      <footer className="border-t border-black/10 bg-[#f5f4f2] px-8 py-7 text-center text-[10px] tracking-[0.12em] text-black/45">© {new Date().getFullYear()} {brandName} · Todos os direitos reservados</footer>
    </>
  );
};

export default StorefrontLojaTemplate;
