// Template "Loja completa" — estilo AERO STEP.
//
// Versão pública renderizada em PublicStorePage. Mantém paridade visual com o
// preview do editor (GeneratedStoreEditorPage). Paleta creme (#f5f2ea) +
// verde musgo (#3d4a2a) + acento dourado (#c8a24a), cantos arredondados,
// cards de lifestyle e cards de produto em pill.
import {
  ArrowRight,
  Facebook,
  Gem,
  Headphones,
  Heart,
  Instagram,
  LayoutGrid,
  Leaf,
  LockKeyhole,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Truck,
  Twitter,
  UserRound,
  Youtube,
} from "lucide-react";
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
  /** Projeto dono da loja. Alimenta as avaliações reais (store_reviews). */
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
  { title: "Troca Fácil", description: "Em até 30 dias", icon: Package },
  { title: "Pagamento Seguro", description: "100% protegido", icon: LockKeyhole },
  { title: "Suporte 7 dias", description: "Estamos aqui pra ajudar", icon: Headphones },
];

const copyPool = [
  { p: "Escolhas que", s: "Facilitam seu dia", sub: "Tecnologia, casa, bem-estar e muito mais em uma seleção feita para você.", cta1: "Ver catálogo" },
  { p: "Tudo o que", s: "Você procura", sub: "Descubra novidades úteis, ofertas especiais e produtos para todos os momentos.", cta1: "Ver novidades" },
  { p: "Novas ideias", s: "Para sua rotina", sub: "Uma curadoria diversa de produtos que combinam praticidade, qualidade e bom preço.", cta1: "Descobrir produtos" },
];

const StorefrontLojaTemplate = ({
  storeName,
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
  const categories = Array.from(new Set(displayedProducts.map((p) => p.category).filter(Boolean))).slice(0, 8) as string[];
  const browseCategories = catalogTaxonomy.map((category, index) => ({
    category,
    imageUrl: displayedProducts.find((p) => p.category === category)?.imageUrl || displayedProducts[index % displayedProducts.length]?.imageUrl || heroImage,
  }));
  const categoryHighlights = Array.from({ length: 4 }, (_, index) => {
    const category = categories[index % Math.max(categories.length, 1)] || displayedProducts[index % displayedProducts.length]?.category || "Outros";
    return {
      category,
      imageUrl: displayedProducts.find((p) => p.category === category)?.imageUrl || heroImage,
      key: `${category}-${index}`,
    };
  });
  const copy = copyPool[copyVariant % copyPool.length];
  const headlinePrimary = copy.p;
  const headlineSecondary = copy.s;
  const heroSubtitle = salesAngle ? salesAngle.slice(0, 140) : copy.sub;
  const ctaPrimary = copy.cta1;
  const heroCtaHref = heroCtaUrl.trim() || "/catalogo";
  const brandName = storeName;

  return (
    <div className="bg-[#f5f2ea] text-[#1a1a1a]">
      {/* NAVBAR */}
      <header className="relative z-30 flex items-center justify-between gap-6 px-6 py-5 md:px-10">
        <a href="/" className="flex items-center gap-2.5">
          {logoImage ? (
            <img src={logoImage} alt={brandName} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3d4a2a] text-[11px] font-semibold text-[#f5f2ea]">
              {brandName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-[15px] font-semibold uppercase tracking-[-0.01em]">{brandName}</span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {["Catálogo", "Novidades", "Ofertas", "Sobre", "Contato"].map((label) => (
            <a key={label} href="#" className="text-[13px] font-medium text-[#1a1a1a]/75 transition hover:text-[#3d4a2a]">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a href="/entrar" className="inline-flex items-center gap-2 rounded-full border border-[#1a1a1a]/12 bg-white px-4 py-2 text-[12px] font-semibold text-[#1a1a1a] transition hover:border-[#3d4a2a]/40">
            <UserRound size={14} strokeWidth={2} />
            Entrar
          </a>
          <a href="/carrinho" className="inline-flex items-center gap-2 rounded-full bg-[#3d4a2a] px-4 py-2 text-[12px] font-semibold text-[#f5f2ea] transition hover:bg-[#2c3620]">
            <ShoppingBag size={14} strokeWidth={2} />
            Carrinho
            <span className="ml-0.5 rounded-full bg-[#c8a24a] px-1.5 text-[10px] font-bold text-[#3d4a2a]">0</span>
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="px-6 pb-10 md:px-10">
        <div className="relative overflow-hidden rounded-[28px] bg-[#e9e5d8]">
          <div className={`grid items-stretch ${mobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"}`}>
            <div className="relative z-10 flex flex-col justify-between p-8 md:p-14">
              <div>
                <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#3d4a2a]">
                  Prêmium coleção
                </span>
                <h1 className="mt-6 font-semibold uppercase leading-[0.98] tracking-[-0.02em] text-[#1a1a1a]" style={{ fontSize: "clamp(34px,4.2vw,68px)" }}>
                  {headlinePrimary}
                  <br />
                  {headlineSecondary}
                </h1>
                <p className="mt-6 max-w-[380px] text-[13px] leading-relaxed text-[#1a1a1a]/60">{heroSubtitle}</p>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <a href={heroCtaHref} className="group inline-flex items-center gap-3 rounded-full bg-[#3d4a2a] py-2 pl-6 pr-2 text-[13px] font-semibold text-[#f5f2ea] transition hover:bg-[#2c3620]">
                  <span>{ctaPrimary}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c8a24a] text-[#3d4a2a] transition group-hover:translate-x-0.5">
                    <ArrowRight size={15} strokeWidth={2.4} />
                  </span>
                </a>
                <a href="#novidades" className="inline-flex items-center rounded-full border border-[#1a1a1a]/12 bg-white/60 px-6 py-3 text-[13px] font-semibold text-[#1a1a1a] transition hover:border-[#3d4a2a]/40">
                  Novidades
                </a>
              </div>
              <div className="mt-10 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {displayedProducts.slice(0, 3).map((p) => (
                    <img key={`av-${p.id}`} src={p.imageUrl || heroImage} alt="" className="h-9 w-9 rounded-full border-2 border-[#e9e5d8] object-cover" />
                  ))}
                </div>
                <div className="text-[11px] leading-tight text-[#1a1a1a]/70">
                  <strong className="block text-[13px] font-semibold text-[#1a1a1a]">10.000+ clientes</strong>
                  <span className="flex items-center gap-1">
                    <Star size={11} strokeWidth={2} className="fill-[#c8a24a] text-[#c8a24a]" /> 4.9 · avaliação média
                  </span>
                </div>
              </div>
            </div>

            <div className="relative min-h-[380px] overflow-hidden">
              <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className={`absolute inset-y-6 right-6 flex flex-col gap-3 ${mobile ? "hidden" : "hidden md:flex"} w-[210px]`}>
                {[
                  { icon: Truck, title: "Frete grátis", desc: "A partir de R$ 199" },
                  { icon: Package, title: "Prove antes de pagar", desc: "7 dias para trocar" },
                  { icon: LockKeyhole, title: "Produtos originais", desc: "Garantia de qualidade" },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-[0_10px_30px_rgba(26,26,26,0.08)] backdrop-blur">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e9e5d8] text-[#3d4a2a]">
                      <Icon size={16} strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-[11.5px] font-semibold text-[#1a1a1a]">{title}</strong>
                      <span className="block truncate text-[10px] text-[#1a1a1a]/55">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEARCH + CHIPS */}
      <section className="px-6 pb-10 md:px-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-3 rounded-full bg-white px-5 py-3 shadow-[0_6px_18px_rgba(26,26,26,0.05)]">
            <Search size={16} strokeWidth={2} className="shrink-0 text-[#1a1a1a]/50" />
            <input placeholder="Buscar por produto, categoria ou marca..." className="flex-1 border-none bg-transparent text-[13px] text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/45" />
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3d4a2a] text-[#f5f2ea]">
              <ArrowRight size={14} strokeWidth={2.2} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {browseCategories.slice(0, 5).map(({ category }) => (
              <a key={category} href="#" className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-medium text-[#1a1a1a] transition hover:bg-[#e9e5d8]">
                {category}
              </a>
            ))}
            <a href="/catalogo" className="inline-flex items-center gap-1.5 rounded-full bg-[#3d4a2a] px-4 py-2 text-[12px] font-semibold text-[#f5f2ea]">
              <LayoutGrid size={13} strokeWidth={2} />
              Todas
            </a>
          </div>
        </div>
      </section>

      {/* HITS DE VENDA */}
      <section className="px-6 pb-14 md:px-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[24px] font-semibold uppercase tracking-[-0.01em] text-[#1a1a1a]">Hits de venda</h2>
            <p className="mt-1 text-[12px] text-[#1a1a1a]/55">Os produtos mais desejados da loja neste mês.</p>
          </div>
          <a href="/catalogo" className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#3d4a2a] transition hover:gap-3">
            Ver todos <ArrowRight size={13} strokeWidth={2} />
          </a>
        </div>
        <div className={`grid gap-4 ${mobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"}`}>
          {displayedProducts.slice(0, 5).map((product, idx) => {
            const originalPrice = Math.max(product.price * 1.3, product.price + 30);
            const discountPct = Math.round((1 - product.price / originalPrice) * 100);
            const explicitRating = product.rating ?? product.averageRating;
            const rating = typeof explicitRating === "number" ? explicitRating : 4.8;
            const orders = product.ratingCount ?? product.reviewCount ?? product.reviewsCount ?? "";
            return (
              <article key={product.id} className="group flex flex-col overflow-hidden rounded-[20px] bg-white p-3 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(26,26,26,0.08)]">
                <div className="relative aspect-square overflow-hidden rounded-[14px] bg-[#e9e5d8]">
                  {idx === 0 ? (
                    <span className="absolute left-3 top-3 z-10 rounded-full bg-[#c8a24a] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#3d4a2a]">Novidade</span>
                  ) : idx === 3 ? (
                    <span className="absolute left-3 top-3 z-10 rounded-full bg-[#3d4a2a] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#f5f2ea]">-{discountPct}%</span>
                  ) : null}
                  <button type="button" aria-label="Favoritar" className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#1a1a1a]/70 shadow-sm transition hover:text-[#3d4a2a]">
                    <Heart size={14} strokeWidth={1.9} />
                  </button>
                  <img src={product.imageUrl || heroImage} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                </div>
                <div className="mt-3 flex flex-1 flex-col px-1 pb-1">
                  <h3 className="line-clamp-2 min-h-[36px] text-[13px] font-semibold leading-snug text-[#1a1a1a]">{product.title}</h3>
                  <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[#1a1a1a]/60">
                    <Star size={11} strokeWidth={2} className="fill-[#c8a24a] text-[#c8a24a]" />
                    <span>{rating.toFixed(1)}</span>
                    {orders ? <span className="text-[#1a1a1a]/35">· {orders} vendas</span> : null}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <strong className="block text-[15px] font-semibold text-[#1a1a1a]">{formatBRL(product.price)}</strong>
                      {idx === 3 ? <span className="text-[10px] text-[#1a1a1a]/40 line-through">{formatBRL(originalPrice)}</span> : null}
                    </div>
                    <button type="button" aria-label="Adicionar ao carrinho" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3d4a2a] text-[#f5f2ea] shadow-sm transition hover:bg-[#2c3620]">
                      <Plus size={14} strokeWidth={2.4} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* LIFESTYLE CARDS */}
      <section className="grid grid-cols-1 gap-4 px-6 pb-4 md:grid-cols-2 md:px-10">
        {categoryHighlights.slice(0, 2).map(({ category, imageUrl, key }) => (
          <a key={key} href={`/catalogo?categoria=${encodeURIComponent(category)}`} className="group relative flex min-h-[240px] overflow-hidden rounded-[24px] bg-[#e9e5d8]">
            <div className="relative z-10 flex flex-1 flex-col justify-between p-8">
              <div>
                <strong className="block text-[24px] font-semibold uppercase leading-[1.02] tracking-[-0.01em] text-[#1a1a1a]">{category}</strong>
                <p className="mt-2 max-w-[180px] text-[12px] text-[#1a1a1a]/60">{collectionDescriptions[category] || "Peças selecionadas para você."}</p>
              </div>
              <span className="mt-6 inline-flex w-fit items-center gap-2 text-[12px] font-semibold text-[#3d4a2a] transition group-hover:gap-3">
                Explorar <ArrowRight size={13} strokeWidth={2} />
              </span>
            </div>
            <div className="relative w-[46%] shrink-0 overflow-hidden">
              <img src={imageUrl} alt={category} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            </div>
          </a>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 px-6 pb-14 md:grid-cols-2 md:px-10">
        {categoryHighlights.slice(2, 4).map(({ category, imageUrl, key }) => (
          <a key={key} href={`/catalogo?categoria=${encodeURIComponent(category)}`} className="group relative flex min-h-[220px] overflow-hidden rounded-[24px] bg-[#e9e5d8]">
            <div className="relative z-10 flex flex-1 flex-col justify-between p-8">
              <div>
                <strong className="block text-[24px] font-semibold uppercase leading-[1.02] tracking-[-0.01em] text-[#1a1a1a]">{category}</strong>
                <p className="mt-2 max-w-[180px] text-[12px] text-[#1a1a1a]/60">{collectionDescriptions[category] || "Peças selecionadas para você."}</p>
              </div>
              <span className="mt-6 inline-flex w-fit items-center gap-2 text-[12px] font-semibold text-[#3d4a2a] transition group-hover:gap-3">
                Explorar <ArrowRight size={13} strokeWidth={2} />
              </span>
            </div>
            <div className="relative w-[46%] shrink-0 overflow-hidden">
              <img src={imageUrl} alt={category} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            </div>
          </a>
        ))}
      </section>

      {/* TECH GRID */}
      <section className="px-6 pb-14 md:px-10">
        <h2 className="mb-6 text-[18px] font-semibold uppercase tracking-[-0.01em] text-[#1a1a1a]">Diferenciais da loja</h2>
        <div className={`grid gap-3 ${mobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"}`}>
          {[
            { icon: Truck, title: "Entrega rápida", desc: "Em todo o Brasil" },
            { icon: Package, title: "Troca fácil", desc: "7 dias sem custo" },
            { icon: LockKeyhole, title: "Compra segura", desc: "Pagamento protegido" },
            { icon: Gem, title: "Produtos originais", desc: "Curadoria garantida" },
            { icon: Headphones, title: "Suporte 7 dias", desc: "Atendimento humano" },
            { icon: Leaf, title: "Consumo consciente", desc: "Embalagem sustentável" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-start gap-3 rounded-[18px] bg-white p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e9e5d8] text-[#3d4a2a]">
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <div>
                <strong className="block text-[12px] font-semibold text-[#1a1a1a]">{title}</strong>
                <span className="mt-1 block text-[11px] text-[#1a1a1a]/55">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CLUB */}
      <section className="px-6 pb-14 md:px-10">
        <div className="relative flex flex-col items-stretch gap-6 overflow-hidden rounded-[28px] bg-[#3d4a2a] p-8 text-[#f5f2ea] md:flex-row md:items-center md:p-12">
          <div className="flex h-32 w-52 shrink-0 items-end justify-start overflow-hidden rounded-[18px] bg-gradient-to-br from-[#5a6a3f] to-[#3d4a2a] p-5 shadow-inner">
            <div>
              <strong className="block text-[18px] font-bold uppercase leading-none tracking-tight">{brandName}</strong>
              <span className="mt-1 block text-[11px] uppercase tracking-[0.2em] text-[#c8a24a]">Club</span>
            </div>
          </div>
          <div className="flex-1">
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c8a24a]">
              Programa de vantagens
            </span>
            <h3 className="mt-3 text-[26px] font-semibold uppercase leading-[1.05] tracking-[-0.01em]">Entre no {brandName} Club</h3>
            <p className="mt-2 max-w-[520px] text-[12px] leading-relaxed text-[#f5f2ea]/70">
              Ofertas exclusivas, acesso antecipado a novidades, bônus personalizados e muito mais. Grátis, sem letra miúda.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 md:items-end">
            <div className="flex flex-wrap gap-2 text-[10px] text-[#f5f2ea]/70">
              <span className="rounded-full bg-white/10 px-3 py-1">5% cashback</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Acesso VIP</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Descontos</span>
            </div>
            <a href="#club" className="inline-flex items-center gap-3 rounded-full bg-[#c8a24a] py-2 pl-6 pr-2 text-[13px] font-semibold text-[#3d4a2a] transition hover:bg-[#d4b062]">
              Tornar-se membro
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3d4a2a] text-[#c8a24a]">
                <ArrowRight size={13} strokeWidth={2.4} />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* REVIEWS (real) */}
      {projectId ? (
        <section className="px-6 pb-14 md:px-10">
          <StoreReviews projectId={projectId} />
        </section>
      ) : null}

      {/* TRUST STRIP */}
      <section className="px-6 pb-10 md:px-10">
        <div className="grid grid-cols-2 gap-3 rounded-[20px] bg-white p-6 md:grid-cols-4">
          {trustBadges.map(({ title, description, icon: Icon }) => (
            <div key={title} className="flex items-start gap-3">
              <Icon size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[#3d4a2a]" />
              <div className="min-w-0">
                <strong className="block text-[12px] font-semibold text-[#1a1a1a]">{title}</strong>
                <span className="mt-0.5 block text-[10.5px] leading-tight text-[#1a1a1a]/55">{description}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#1a1a1a]/8 bg-[#f5f2ea] px-6 pb-10 pt-14 md:px-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5">
              {logoImage ? (
                <img src={logoImage} alt={brandName} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3d4a2a] text-[13px] font-semibold text-[#f5f2ea]">
                  {brandName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="text-[16px] font-semibold uppercase tracking-tight">{brandName}</span>
            </div>
            <p className="mt-4 max-w-[280px] text-[12px] leading-relaxed text-[#1a1a1a]/60">
              Produtos selecionados com curadoria, entrega rápida e a melhor experiência de compra do Brasil.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {[Instagram, Facebook, Youtube, Twitter].map((Icon, i) => (
                <a key={i} href="#" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1a1a1a]/10 bg-white text-[#1a1a1a]/70 transition hover:border-[#3d4a2a] hover:text-[#3d4a2a]">
                  <Icon size={14} strokeWidth={1.8} />
                </a>
              ))}
            </div>
          </div>
          {[
            { title: "Catálogo", links: ["Todos os produtos", "Novidades", "Ofertas", "Mais vendidos"] },
            { title: "Ajuda", links: ["Entrega", "Trocas", "Perguntas frequentes", "Contato"] },
            { title: "Empresa", links: ["Sobre nós", "Blog", "Trabalhe conosco", "Imprensa"] },
          ].map((col) => (
            <div key={col.title}>
              <strong className="mb-4 block text-[12px] font-semibold uppercase tracking-[0.15em] text-[#1a1a1a]">{col.title}</strong>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-[12px] text-[#1a1a1a]/60 transition hover:text-[#3d4a2a]">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[#1a1a1a]/8 pt-6 md:flex-row md:items-center">
          <span className="text-[11px] text-[#1a1a1a]/45">
            © {new Date().getFullYear()} {brandName} · Todos os direitos reservados
          </span>
          <span className="text-[11px] text-[#1a1a1a]/45">Feito com Velo</span>
        </div>
      </footer>
    </div>
  );
};

export default StorefrontLojaTemplate;
