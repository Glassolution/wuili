// Template "Loja 2" — estilo MARKETLY (mobile-first, azul elétrico).
// Paleta: primary #2563EB, deep #1E40AF, sky #EFF6FF, orange #F97316,
// ink #0F172A, mute #64748B, border #E2E8F0. Rounded 16-24, cards limpos.
import { useEffect, useMemo, useState } from "react";
import bannerLoja2_1 from "@/assets/banner-loja2-1.jpg";
import bannerLoja2_2 from "@/assets/banner-loja2-2.jpg";
import bannerLoja2_3 from "@/assets/banner-loja2-3.jpg";
import { ChevronLeft } from "lucide-react";
import {
  ArrowRight,
  ChevronRight,
  CreditCard,
  Facebook,
  Heart,
  Instagram,
  Layers,
  Mail,
  Menu,
  MoreHorizontal,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Truck,
  User,
  Youtube,
  Zap,
} from "lucide-react";
import { formatPriceBRL as formatBRL } from "@/lib/priceFormat";
import StoreReviews from "@/components/store-templates/StoreReviews";

export type Loja2Product = {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
  category?: string | null;
  originalPrice?: number | null;
};

export type StorefrontLojaTemplate2Props = {
  storeName: string;
  heroImage: string;
  logoImage?: string | null;
  salesAngle?: string;
  heroCtaUrl?: string;
  products: Loja2Product[];
  mobile?: boolean;
  projectId?: string;
};

const CATEGORY_ICONS: Record<string, string> = {
  Moda: "👗",
  "Eletrônicos": "🎧",
  Beleza: "💄",
  Casa: "🛋️",
  "Bebê e Infantil": "🧸",
  "Esporte e Fitness": "🏋️",
  Pet: "🐾",
  Bijuterias: "💍",
  "Saúde e Bem-estar": "🌿",
  "Decoração": "🕯️",
  Outros: "🛍️",
};

const CountdownCell = ({ value, label }: { value: string; label: string }) => (
  <div className="flex min-w-[56px] flex-col items-center rounded-xl bg-white/15 px-2 py-2 backdrop-blur-sm">
    <span className="text-[18px] font-bold leading-none text-white">{value}</span>
    <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-white/80">{label}</span>
  </div>
);

const useCountdown = (targetHours = 60) => {
  const [t, setT] = useState({ d: "02", h: "12", m: "45", s: "30" });
  useEffect(() => {
    const end = Date.now() + targetHours * 60 * 60 * 1000;
    const tick = () => {
      const diff = Math.max(0, end - Date.now());
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setT({
        d: String(d).padStart(2, "0"),
        h: String(h).padStart(2, "0"),
        m: String(m).padStart(2, "0"),
        s: String(s).padStart(2, "0"),
      });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [targetHours]);
  return t;
};

const StorefrontLojaTemplate2 = ({
  storeName,
  heroImage,
  logoImage = null,
  salesAngle = "",
  heroCtaUrl = "/catalogo",
  products,
  mobile = false,
  projectId,
}: StorefrontLojaTemplate2Props) => {
  const list = products.length
    ? products
    : [{ id: "p", title: "Produto", price: 149.9, imageUrl: heroImage, category: "Outros" }];
  const brandName = storeName;
  const hero = list[0];
  const cats = Array.from(new Set(list.map((p) => p.category).filter(Boolean))).slice(0, 6) as string[];
  const displayCats = cats.length ? cats : ["Moda", "Eletrônicos", "Beleza", "Casa", "Pet", "Esporte e Fitness"];
  const catImages = useMemo(() => {
    const map: Record<string, string> = {};
    displayCats.forEach((c) => {
      const p = list.find((x) => x.category === c && x.imageUrl);
      if (p?.imageUrl) map[c] = p.imageUrl;
    });
    return map;
  }, [displayCats, list]);
  const countdown = useCountdown();
  const featured = list.slice(0, 4);
  const bestSellers = list.slice(0, 6);
  const ctaHref = heroCtaUrl.trim() || "/catalogo";

  return (
    <div className="bg-white text-[#0F172A]" style={{ fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif" }}>

      {/* ANNOUNCEMENT BAR */}
      <div className="flex items-center justify-center gap-2 bg-[#2563EB] px-4 py-2 text-center text-[12px] font-semibold text-white">
        <span>🎉 Mega Promoção no ar! Até 60% OFF</span>
        <ChevronRight size={13} strokeWidth={2.5} />
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-white">
        <div className="flex items-center gap-3 px-4 py-3 md:px-8">
          <button type="button" aria-label="Menu" className="grid h-9 w-9 place-items-center rounded-lg text-[#0F172A] hover:bg-[#F1F5F9]">
            <Menu size={22} strokeWidth={2.2} />
          </button>
          <a href="/" className="flex items-center gap-2.5">
            {logoImage ? (
              <img src={logoImage} alt={brandName} className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#2563EB] text-white shadow-sm">
                <ShoppingBag size={20} strokeWidth={2.2} />
              </span>
            )}
            <div className="leading-tight">
              <span className="block text-[19px] font-extrabold tracking-tight text-[#0F172A]">{brandName}</span>
              <span className="block text-[10px] font-medium text-[#64748B]">Shop Smart, Live Better</span>
            </div>
          </a>
          <div className="ml-auto flex items-center gap-1.5">
            <button aria-label="Conta" className="grid h-10 w-10 place-items-center rounded-full text-[#0F172A] hover:bg-[#F1F5F9]">
              <User size={20} strokeWidth={1.9} />
            </button>
            <button aria-label="Favoritos" className="relative grid h-10 w-10 place-items-center rounded-full text-[#0F172A] hover:bg-[#F1F5F9]">
              <Heart size={20} strokeWidth={1.9} />
              <span className="absolute right-0.5 top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-[#2563EB] px-1 text-[9px] font-bold text-white">2</span>
            </button>
            <a href="/carrinho" aria-label="Carrinho" className="relative grid h-10 w-10 place-items-center rounded-full text-[#0F172A] hover:bg-[#F1F5F9]">
              <ShoppingCart size={20} strokeWidth={1.9} />
              <span className="absolute right-0.5 top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-[#F97316] px-1 text-[9px] font-bold text-white">3</span>
            </a>
          </div>
        </div>

        {/* SEARCH */}
        <div className="px-4 pb-4 md:px-8">
          <div className="flex items-stretch gap-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm focus-within:border-[#2563EB]">
            <div className="flex flex-1 items-center gap-2 bg-[#F8FAFC] px-4">
              <Search size={16} strokeWidth={2.2} className="text-[#94A3B8]" />
              <input
                placeholder="Buscar produtos, marcas e mais..."
                className="w-full border-none bg-transparent py-3 text-[13px] text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
              />
            </div>
            <button type="button" aria-label="Buscar" className="grid w-14 place-items-center bg-[#2563EB] text-white transition hover:bg-[#1D4ED8]">
              <Search size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </header>

      {/* CATEGORY ROW — real product photos in circles */}
      <section className="px-4 pt-1 md:px-8">
        <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-3">
          {displayCats.map((c) => {
            const img = catImages[c];
            return (
              <a key={c} href={`/catalogo?categoria=${encodeURIComponent(c)}`} className="flex shrink-0 flex-col items-center gap-1.5">
                <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-[#F1F5F9] ring-1 ring-[#E2E8F0]">
                  {img ? (
                    <img src={img} alt={c} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[22px]">{CATEGORY_ICONS[c] || "🛍️"}</span>
                  )}
                </span>
                <span className="max-w-[68px] truncate text-[11px] font-medium text-[#0F172A]">{c}</span>
              </a>
            );
          })}
          <a href="/catalogo" className="flex shrink-0 flex-col items-center gap-1.5">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-[#F1F5F9] ring-1 ring-[#E2E8F0] text-[#0F172A]">
              <MoreHorizontal size={22} strokeWidth={2.2} />
            </span>
            <span className="text-[11px] font-medium text-[#0F172A]">Todos</span>
          </a>
        </div>
      </section>

      {/* HERO BANNER — cream, product-cluster style */}
      <section className="px-4 pt-2 md:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FEF3E2] via-[#FEF7ED] to-[#FDF6E3] p-6 md:p-10">
          <span className="absolute right-4 top-4 z-10 grid h-16 w-16 place-items-center rounded-full bg-[#F97316] text-center text-[10px] font-extrabold leading-tight text-white shadow-lg md:right-8 md:top-8 md:h-20 md:w-20 md:text-[12px]">
            <span>ATÉ<br />60%<br />OFF</span>
          </span>
          <div className={`grid items-center gap-6 ${mobile ? "grid-cols-1" : "md:grid-cols-2"}`}>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#F97316]">Qualidade Premium · Você Premium</span>
              <h1 className="mt-3 text-[30px] font-extrabold leading-[1.02] tracking-tight text-[#0F172A] md:text-[44px]">
                Tudo o que você precisa,<br />
                <span className="text-[#2563EB]">em um só lugar</span>
              </h1>
              <p className="mt-3 max-w-[420px] text-[13px] leading-relaxed text-[#64748B]">
                {salesAngle
                  ? salesAngle.slice(0, 140)
                  : "Descubra milhares de produtos de marcas confiáveis. Melhor preço, qualidade premium e entrega rápida."}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a href={ctaHref} className="inline-flex items-center gap-2 rounded-full bg-[#2563EB] px-5 py-3 text-[13px] font-semibold text-white shadow-md transition hover:bg-[#1D4ED8]">
                  Comprar agora
                  <ArrowRight size={14} strokeWidth={2.4} />
                </a>
                <a href="/catalogo" className="inline-flex items-center rounded-full border border-[#0F172A]/15 bg-white px-5 py-3 text-[13px] font-semibold text-[#0F172A] transition hover:bg-[#F8FAFC]">
                  Ver ofertas
                </a>
              </div>
            </div>
            <div className="relative flex items-center justify-center">
              <div className="relative aspect-square w-full max-w-[320px]">
                <div className="absolute inset-x-6 bottom-4 h-10 rounded-[50%] bg-black/10 blur-xl" />
                <div className="absolute inset-6 rounded-full bg-white/80 shadow-inner" />
                <img src={hero.imageUrl || heroImage} alt={hero.title} className="relative h-full w-full object-contain mix-blend-multiply drop-shadow-xl" />
              </div>
            </div>
          </div>

          {/* TRUST STRIP inside hero */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/60 px-4 py-3 backdrop-blur-sm">
            {[
              { icon: Truck, t: "Frete Grátis", s: "Acima de R$199" },
              { icon: Package, t: "Troca Fácil", s: "30 dias" },
              { icon: ShieldCheck, t: "Pagto Seguro", s: "100% protegido" },
            ].map(({ icon: Icon, t, s }) => (
              <div key={t} className="flex flex-1 items-center gap-2 min-w-[130px]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#FFF7ED] text-[#F97316]">
                  <Icon size={15} strokeWidth={2.2} />
                </span>
                <div className="leading-tight">
                  <strong className="block text-[11px] font-bold text-[#0F172A]">{t}</strong>
                  <span className="block text-[10px] text-[#64748B]">{s}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* FLASH DEAL */}
      <section className="px-4 pt-6 md:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E40AF] to-[#2563EB] p-5 md:p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white/95 p-2">
              <img src={hero.imageUrl || heroImage} alt="" className="h-full w-full object-contain" />
            </div>
            <div className="flex-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FDE68A]">
                <Zap size={12} strokeWidth={2.5} className="fill-[#FDE68A]" />
                OFERTA RELÂMPAGO
              </span>
              <p className="mt-1 text-[13px] font-medium text-white/80">Preço especial</p>
              <div className="mt-1 flex items-baseline gap-2">
                <strong className="text-[22px] font-bold text-white">{formatBRL(hero.price)}</strong>
                <span className="text-[13px] text-white/50 line-through">{formatBRL(hero.price * 1.6)}</span>
              </div>
              <a href={ctaHref} className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#F97316] px-4 py-1.5 text-[11px] font-semibold text-white">
                Comprar oferta
                <ArrowRight size={11} strokeWidth={2.5} />
              </a>
            </div>
            <div className="hidden gap-1.5 md:flex">
              <CountdownCell value={countdown.d} label="Dias" />
              <CountdownCell value={countdown.h} label="Hrs" />
              <CountdownCell value={countdown.m} label="Min" />
              <CountdownCell value={countdown.s} label="Seg" />
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-1.5 md:hidden">
            <CountdownCell value={countdown.d} label="Dias" />
            <CountdownCell value={countdown.h} label="Hrs" />
            <CountdownCell value={countdown.m} label="Min" />
            <CountdownCell value={countdown.s} label="Seg" />
          </div>
        </div>
      </section>

      {/* POPULAR CATEGORIES */}
      <section className="px-4 pt-8 md:px-8">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-[18px] font-bold text-[#0F172A]">Categorias populares</h2>
          <a href="/catalogo" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563EB]">
            Ver todos <ChevronRight size={13} strokeWidth={2.5} />
          </a>
        </div>
        <div className={`grid gap-3 ${mobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
          {displayCats.slice(0, 4).map((c) => {
            const p = list.find((x) => x.category === c) || list[0];
            return (
              <a key={c} href={`/catalogo?categoria=${encodeURIComponent(c)}`} className="group flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 transition hover:border-[#2563EB]/40 hover:bg-white hover:shadow-md">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
                  {p.imageUrl ? <img src={p.imageUrl} alt={c} className="h-full w-full object-cover" /> : <span className="text-[22px]">{CATEGORY_ICONS[c] || "🛍️"}</span>}
                </div>
                <div className="min-w-0">
                  <strong className="block truncate text-[13px] font-semibold text-[#0F172A]">{c}</strong>
                  <span className="block text-[11px] text-[#64748B]">Ver produtos</span>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="px-4 pt-8 md:px-8">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-[18px] font-bold text-[#0F172A]">Produtos em destaque</h2>
          <a href="/catalogo" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563EB]">
            Ver todos <ChevronRight size={13} strokeWidth={2.5} />
          </a>
        </div>
        <div className={`grid gap-3 ${mobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
          {featured.map((p, idx) => {
            const oldPrice = p.originalPrice ?? Math.max(p.price * 1.3, p.price + 30);
            const disc = Math.round((1 - p.price / oldPrice) * 100);
            return (
              <article key={p.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white transition hover:border-[#2563EB]/30 hover:shadow-lg">
                <div className="relative aspect-square overflow-hidden bg-[#F8FAFC]">
                  {disc > 0 ? (
                    <span className="absolute left-2 top-2 z-10 rounded-md bg-[#EF4444] px-1.5 py-0.5 text-[10px] font-bold text-white">-{disc}%</span>
                  ) : null}
                  <button aria-label="Favoritar" className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[#0F172A] shadow-sm hover:text-[#EF4444]">
                    <Heart size={13} strokeWidth={1.9} />
                  </button>
                  {p.imageUrl ? <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : null}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <h3 className="line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-snug text-[#0F172A]">{p.title}</h3>
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-[#64748B]">
                    <Star size={10} strokeWidth={2} className="fill-[#F59E0B] text-[#F59E0B]" />
                    <span>{(4.2 + (idx % 5) * 0.15).toFixed(1)}</span>
                    <span className="text-[#94A3B8]">({(1200 + idx * 431).toLocaleString("pt-BR")})</span>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-1">
                    <div>
                      <strong className="block text-[14px] font-bold text-[#2563EB]">{formatBRL(p.price)}</strong>
                      <span className="text-[10px] text-[#94A3B8] line-through">{formatBRL(oldPrice)}</span>
                    </div>
                    <button aria-label="Adicionar" className="grid h-8 w-8 place-items-center rounded-lg bg-[#2563EB] text-white shadow-sm transition hover:bg-[#1D4ED8]">
                      <ShoppingCart size={13} strokeWidth={2.4} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* BRAND BANNERS */}
      <section className="grid grid-cols-1 gap-3 px-4 pt-8 md:grid-cols-2 md:px-8">
        <a href="/catalogo" className="relative flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#FDBA74] to-[#F97316] p-5 text-white">
          <div className="min-w-0 flex-1">
            <strong className="block text-[18px] font-bold">Coleção Verão</strong>
            <p className="mt-1 text-[11px] text-white/85">Até 50% off · Moda e acessórios</p>
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/25 px-3 py-1 text-[11px] font-semibold backdrop-blur-sm">
              Comprar agora <ArrowRight size={11} strokeWidth={2.5} />
            </span>
          </div>
          {list[1]?.imageUrl ? <img src={list[1].imageUrl} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" /> : null}
        </a>
        <a href="/catalogo" className="relative flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#93C5FD] to-[#2563EB] p-5 text-white">
          <div className="min-w-0 flex-1">
            <strong className="block text-[18px] font-bold">Essenciais para Casa</strong>
            <p className="mt-1 text-[11px] text-white/85">Até 40% off · Casa e cozinha</p>
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/25 px-3 py-1 text-[11px] font-semibold backdrop-blur-sm">
              Comprar agora <ArrowRight size={11} strokeWidth={2.5} />
            </span>
          </div>
          {list[2]?.imageUrl ? <img src={list[2].imageUrl} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" /> : null}
        </a>
      </section>

      {/* BEST SELLERS */}
      <section className="px-4 pt-8 md:px-8">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-[18px] font-bold text-[#0F172A]">Mais vendidos</h2>
          <a href="/catalogo" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563EB]">
            Ver todos <ChevronRight size={13} strokeWidth={2.5} />
          </a>
        </div>
        <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2">
          {bestSellers.map((p, idx) => {
            const oldPrice = Math.max(p.price * 1.25, p.price + 20);
            const disc = Math.round((1 - p.price / oldPrice) * 100);
            return (
              <article key={p.id} className="w-[160px] shrink-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
                <div className="relative aspect-square bg-[#F8FAFC]">
                  <span className="absolute left-2 top-2 z-10 rounded bg-[#EF4444] px-1.5 py-0.5 text-[9px] font-bold text-white">-{disc}%</span>
                  {p.imageUrl ? <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="p-2.5">
                  <h3 className="line-clamp-2 min-h-[32px] text-[11px] font-semibold text-[#0F172A]">{p.title}</h3>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-[#64748B]">
                    <Star size={9} strokeWidth={2} className="fill-[#F59E0B] text-[#F59E0B]" />
                    <span>{(4.3 + (idx % 4) * 0.1).toFixed(1)}</span>
                    <span className="text-[#94A3B8]">({(500 + idx * 220).toLocaleString("pt-BR")})</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <strong className="text-[13px] font-bold text-[#2563EB]">{formatBRL(p.price)}</strong>
                    <span className="text-[9px] text-[#94A3B8] line-through">{formatBRL(oldPrice)}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* REVIEWS */}
      {projectId ? (
        <section className="px-4 pt-8 md:px-8">
          <StoreReviews projectId={projectId} accent="#2563EB" />
        </section>
      ) : (
        <section className="px-4 pt-8 md:px-8">
          <div className="rounded-2xl bg-[#EFF6FF] p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#2563EB]">
                <User size={18} />
              </span>
              <div>
                <div className="flex items-center gap-1 text-[#F59E0B]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={11} strokeWidth={0} className="fill-current" />
                  ))}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-[#0F172A]">
                  "Ótimos produtos, entrega rápida e atendimento excelente. {brandName} virou meu destino de compras!"
                </p>
                <span className="mt-2 block text-[11px] font-semibold text-[#64748B]">— Emily Johnson · Compradora verificada</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* NEWSLETTER */}
      <section className="px-4 pt-8 md:px-8">
        <div className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#2563EB] text-white">
            <Mail size={17} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block text-[13px] font-bold text-[#0F172A]">Ofertas exclusivas</strong>
            <p className="text-[11px] text-[#64748B]">Cadastre-se e receba descontos.</p>
          </div>
          <div className="flex items-center gap-2">
            <input placeholder="Seu email" className="hidden w-[180px] rounded-full border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#2563EB] md:block" />
            <button className="rounded-full bg-[#2563EB] px-4 py-2 text-[12px] font-semibold text-white">Inscrever</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-10 border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 pb-24 pt-8 md:px-8 md:pb-10">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              {logoImage ? (
                <img src={logoImage} alt={brandName} className="h-9 w-9 rounded-lg object-cover" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#2563EB] text-white">
                  <ShoppingCart size={17} strokeWidth={2.4} />
                </span>
              )}
              <strong className="text-[16px] font-bold text-[#0F172A]">{brandName}</strong>
            </div>
            <p className="mt-3 max-w-[280px] text-[12px] leading-relaxed text-[#64748B]">
              Sua loja online completa. Produtos de qualidade com preços justos e entrega rápida.
            </p>
            <div className="mt-3 flex items-center gap-2">
              {[Instagram, Facebook, Youtube].map((Icon, i) => (
                <a key={i} href="#" className="grid h-8 w-8 place-items-center rounded-full border border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB]">
                  <Icon size={13} strokeWidth={1.9} />
                </a>
              ))}
            </div>
          </div>
          {[
            { t: "Loja", l: ["Todos os produtos", "Ofertas", "Novidades", "Mais vendidos"] },
            { t: "Ajuda", l: ["Entrega", "Trocas", "FAQ", "Contato"] },
          ].map((col) => (
            <div key={col.t}>
              <strong className="mb-2 block text-[12px] font-bold uppercase tracking-wider text-[#0F172A]">{col.t}</strong>
              <ul className="space-y-1.5">
                {col.l.map((li) => (
                  <li key={li}>
                    <a href="#" className="text-[12px] text-[#64748B] hover:text-[#2563EB]">{li}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col items-start justify-between gap-2 border-t border-[#E2E8F0] pt-4 text-[11px] text-[#94A3B8] md:flex-row md:items-center">
          <span>© {new Date().getFullYear()} {brandName} · Todos os direitos reservados</span>
          <div className="flex items-center gap-2">
            <CreditCard size={12} />
            <span>Pagamento seguro · Pix, Cartão, Boleto</span>
          </div>
        </div>
      </footer>

      {/* BOTTOM NAV (MOBILE) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-[#E2E8F0] bg-white/95 px-2 py-2 backdrop-blur-md md:hidden">
        {[
          { i: ShoppingCart, l: "Início", href: "/", active: true },
          { i: Layers, l: "Categorias", href: "/catalogo" },
          { i: Zap, l: "Ofertas", href: "/catalogo" },
          { i: Heart, l: "Favoritos", href: "#" },
          { i: User, l: "Conta", href: "/conta" },
        ].map(({ i: Icon, l, href, active }) => (
          <a key={l} href={href} className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-medium ${active ? "text-[#2563EB]" : "text-[#64748B]"}`}>
            <Icon size={18} strokeWidth={2} />
            {l}
          </a>
        ))}
      </nav>
    </div>
  );
};

export default StorefrontLojaTemplate2;
