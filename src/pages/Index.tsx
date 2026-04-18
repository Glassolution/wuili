import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import BrandMark from "@/components/brand/BrandMark";
import PlanBadge from "@/components/PlanBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import LogosStrip from "@/components/landing/LogosStrip";
import CreditBanner from "@/components/landing/CreditBanner";
import MultiPlatformSection from "@/components/landing/MultiPlatformSection";
import AnywhereSection from "@/components/landing/AnywhereSection";
import FeatureSections from "@/components/landing/FeatureSections";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import PricingSection from "@/components/landing/PricingSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";
import { playSatisfyingClick } from "@/lib/uiFeedback";

const NAV_LINKS = ["Produto", "Soluções", "FAQ", "Suporte"];

const Index = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  useSearchParams();
  const [signupPreparing, setSignupPreparing] = useState(false);
  const [signupTransition, setSignupTransition] = useState(false);

  const isLogged = Boolean(user);
  const userInitial = (user?.email ?? "U").charAt(0).toUpperCase();

  const handleStartSignup = () => {
    if (signupPreparing || signupTransition) return;

    if (isLogged) {
      playSatisfyingClick();
      navigate("/dashboard");
      return;
    }

    playSatisfyingClick();
    setSignupPreparing(true);

    window.setTimeout(() => {
      setSignupTransition(true);
    }, 3000);

    window.setTimeout(() => {
      navigate("/cadastro", { state: { fromLandingInk: true, fromLandingSlide: true } });
    }, 3440);
  };

  return (
    <div className={`landing-shell min-h-screen overflow-x-hidden bg-white text-[#0a0a0a] ${signupTransition ? "is-transitioning" : ""}`}>
      {signupTransition && (
        <div aria-hidden="true" className="landing-signup-transition" />
      )}

      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/90 backdrop-blur-[12px]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-[14px] md:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <BrandMark size="xs" showWordmark tone="light" />
          </Link>

          {/* Nav links (desktop) */}
          <nav className="hidden items-center gap-8 font-['Manrope'] text-[14px] font-medium text-[#0a0a0a]/70 md:flex">
            {NAV_LINKS.map((item) => (
              <a key={item} href="#" className="transition hover:text-[#0a0a0a]">{item}</a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {isLogged ? (
              <>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0a0a0a] px-5 py-[10px] font-['Manrope'] text-[13.5px] font-semibold text-white transition hover:bg-[#1a1a1a]"
                >
                  Ir para o dashboard
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Ver meu perfil"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0a0a0a] font-['Manrope'] text-[13px] font-bold text-white ring-2 ring-white transition hover:bg-[#1a1a1a]"
                      title={user?.email ?? ""}
                    >
                      {userInitial}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0a0a0a] font-['Manrope'] text-[14px] font-bold text-white">
                        {userInitial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-['Manrope'] text-[13px] font-semibold text-[#0a0a0a]">
                          {user?.email}
                        </div>
                        <div className="font-['Manrope'] text-[11px] text-black/50">Conta Velo</div>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-black/[0.06] pt-3">
                      <div className="mb-2 font-['Manrope'] text-[10px] font-semibold uppercase tracking-wider text-black/40">
                        Plano atual
                      </div>
                      <PlanBadge size="md" />
                    </div>
                    <div className="mt-3 flex flex-col gap-1">
                      <Link
                        to="/dashboard"
                        className="rounded-md px-2 py-1.5 font-['Manrope'] text-[12px] font-medium text-[#0a0a0a] transition hover:bg-black/[0.04]"
                      >
                        Ir para o dashboard
                      </Link>
                      <Link
                        to="/dashboard/plans"
                        className="rounded-md px-2 py-1.5 font-['Manrope'] text-[12px] font-medium text-[#0a0a0a] transition hover:bg-black/[0.04]"
                      >
                        Gerenciar plano
                      </Link>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            ) : (
              <>
                <Link to="/login" className="hidden font-['Manrope'] text-[14px] font-medium text-[#0a0a0a]/70 transition hover:text-[#0a0a0a] md:inline-flex">
                  Entrar
                </Link>
                <Link
                  to="/cadastro"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0a0a0a] px-5 py-[10px] font-['Manrope'] text-[13.5px] font-semibold text-white transition hover:bg-[#1a1a1a]"
                >
                  Criar workspace
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M5 11 11 5M6 5h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <main>
        <section className="mx-auto flex max-w-[760px] flex-col items-center px-6 pb-10 pt-20 text-center md:pt-28">

          {/* Headline */}
          <h1 className="mb-6 font-['Manrope'] text-[clamp(2.75rem,5.5vw,4.5rem)] font-[700] leading-[1.08] tracking-[-0.035em] text-[#0a0a0a]">
            Produtos prontos.<br />Anúncios criados<br />por IA. Só vender.
          </h1>

          {/* Subtitle */}
          <p className="mb-10 max-w-[520px] font-['Manrope'] text-[1.0625rem] font-normal leading-[1.65] text-[#6b7280]">
            A Velo te dá produtos para dropshipping com alta margem e usa IA para criar anúncios otimizados no Mercado Livre e Shopee — título, fotos, preço e descrição prontos em segundos.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleStartSignup}
              disabled={signupPreparing || signupTransition}
              className="landing-button-primary inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-7 py-[15px] font-['Manrope'] text-[15px] font-semibold text-white"
            >
              {isLogged ? "Continuar no dashboard" : "Começar grátis"}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <a
              href="#planos"
              onClick={playSatisfyingClick}
              className="landing-button-secondary inline-flex items-center gap-2 rounded-full border border-black/20 bg-white px-7 py-[15px] font-['Manrope'] text-[15px] font-semibold text-[#0a0a0a]"
            >
              Ver planos
            </a>
          </div>

          {isLogged && (
            <div className="mt-5">
              <PlanBadge size="md" />
            </div>
          )}
        </section>

        {/* ── PRODUCT VISUAL — Dashboard mockup ── */}
        <section className="mx-auto max-w-[1120px] px-6 pb-0 md:px-8">
          <div className="overflow-hidden rounded-[20px] border border-black/[0.08] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.08)]">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-black/[0.06] bg-[#fafafa] px-4 py-[10px]">
              <div className="flex gap-[6px]">
                <div className="h-[10px] w-[10px] rounded-full bg-[#ff5f57]" />
                <div className="h-[10px] w-[10px] rounded-full bg-[#febc2e]" />
                <div className="h-[10px] w-[10px] rounded-full bg-[#28c840]" />
              </div>
              <div className="ml-3 flex-1 rounded-md bg-black/[0.04] px-3 py-[5px] text-center font-['Manrope'] text-[11px] text-black/40">
                app.velo.com.br/dashboard/dropshipping
              </div>
            </div>

            {/* Dashboard content */}
            <div className="flex">
              {/* Sidebar */}
              <div className="hidden w-[180px] flex-shrink-0 border-r border-black/[0.06] bg-[#fafafa] md:block">
                {/* Store selector */}
                <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0a0a0a]">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 6l6-4 6 4v7a1 1 0 01-1 1H3a1 1 0 01-1-1V6z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div>
                    <div className="font-['Manrope'] text-[11px] font-bold text-[#0a0a0a]">Minha Loja</div>
                    <div className="text-[9px] text-black/40">Workspace</div>
                  </div>
                </div>

                {/* Nav items */}
                <div className="px-3 py-3">
                  <div className="mb-3 px-2 font-['Manrope'] text-[9px] font-semibold uppercase tracking-wider text-black/30">Workspace</div>
                  {[
                    { icon: "📦", label: "Produtos", active: false },
                    { icon: "🏷", label: "Catálogo", active: false },
                    { icon: "📋", label: "Pedidos", active: false },
                    { icon: "🚚", label: "Dropshipping", active: true },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`mb-[2px] flex items-center gap-2.5 rounded-lg px-2 py-[7px] font-['Manrope'] text-[11px] transition ${
                        item.active
                          ? "bg-[#0a0a0a] font-semibold text-white"
                          : "font-medium text-black/60 hover:bg-black/[0.04]"
                      }`}
                    >
                      <span className="text-[12px]">{item.icon}</span>
                      {item.label}
                    </div>
                  ))}

                  <div className="my-3 h-px bg-black/[0.06]" />
                  <div className="mb-3 px-2 font-['Manrope'] text-[9px] font-semibold uppercase tracking-wider text-black/30">Ferramentas</div>
                  {[
                    { icon: "🤖", label: "IA Anúncios", active: false },
                    { icon: "📊", label: "Analytics", active: false },
                    { icon: "💬", label: "Mensagens", active: false },
                    { icon: "⚙", label: "Configurações", active: false },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="mb-[2px] flex items-center gap-2.5 rounded-lg px-2 py-[7px] font-['Manrope'] text-[11px] font-medium text-black/60 hover:bg-black/[0.04]"
                    >
                      <span className="text-[12px]">{item.icon}</span>
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Main content */}
              <div className="flex-1">
                {/* Top bar */}
                <div className="hidden items-center justify-between border-b border-black/[0.06] px-5 py-[10px] md:flex">
                  <div className="flex items-center gap-2 font-['Manrope'] text-[11px] text-black/40">
                    <span className="font-semibold text-[#0a0a0a]">Minha Loja</span>
                    <span>/</span>
                    <span>Dropshipping</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-lg bg-black/[0.04] px-3 py-[6px]">
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" className="text-black/30"/><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-black/30"/></svg>
                      <span className="font-['Manrope'] text-[10px] text-black/30">Buscar produtos...</span>
                    </div>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/[0.04]">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 2v4M8 10v4M2 8h4M10 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-black/40"/></svg>
                    </div>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0a0a0a] font-['Manrope'] text-[9px] font-bold text-white">V</div>
                  </div>
                </div>

                <div className="p-5">
                  {/* Page header */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="font-['Manrope'] text-[16px] font-bold text-[#0a0a0a]">Dropshipping</h3>
                      <span className="rounded-full bg-[#0a0a0a] px-2 py-[2px] text-[8px] font-bold text-white">248 produtos</span>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex">
                      <div className="rounded-lg border border-black/[0.08] bg-white px-3 py-[5px] font-['Manrope'] text-[10px] font-medium text-black/50">
                        Plataforma
                        <span className="ml-1 text-black/25">▾</span>
                      </div>
                    </div>
                  </div>

                  {/* Filter bar */}
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-2.5 py-[5px]">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" className="text-black/30"/><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-black/30"/></svg>
                      <span className="font-['Manrope'] text-[10px] text-black/30">Buscar...</span>
                    </div>
                    {["Todos", "Eletrônicos", "Moda", "Casa", "Beleza"].map((cat, i) => (
                      <span
                        key={cat}
                        className={`rounded-lg px-2.5 py-[5px] font-['Manrope'] text-[10px] font-semibold transition ${
                          i === 0
                            ? "bg-[#0a0a0a] text-white"
                            : "border border-black/[0.08] bg-white text-black/50 hover:bg-black/[0.02]"
                        }`}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>

                  {/* Product grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {[
                      { name: "Fone Bluetooth TWS Pro Max", price: "R$45–R$89", minOrder: "10 un.", source: "AliExpress", sourceColor: "bg-[#e74c3c]", rating: "4.8", reviews: "1.345", img: "🎧", color: "bg-gradient-to-br from-[#f8f9fa] to-[#e9ecef]", tags: ["Eletrônico", "Bluetooth"] },
                      { name: "Smartwatch Series X Ultra", price: "R$120–R$200", minOrder: "5 un.", source: "Shopee", sourceColor: "bg-[#ee4d2d]", rating: "4.9", reviews: "976", img: "⌚", color: "bg-gradient-to-br from-[#e0f2fe] to-[#dbeafe]", tags: ["Eletrônico", "Wearable"] },
                      { name: "Tênis Casual Urban Style", price: "R$60–R$110", minOrder: "8 un.", source: "Amazon", sourceColor: "bg-[#ff9900]", rating: "4.7", reviews: "1.654", img: "👟", color: "bg-gradient-to-br from-[#fef3c7] to-[#fde68a]", tags: ["Moda", "Calçado"] },
                      { name: "Kit Skincare 5 Passos", price: "R$35–R$75", minOrder: "12 un.", source: "AliExpress", sourceColor: "bg-[#e74c3c]", rating: "4.8", reviews: "886", img: "🧴", color: "bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7]", tags: ["Beleza", "Skincare"] },
                      { name: "Mochila Urbana Impermeável", price: "R$55–R$95", minOrder: "6 un.", source: "Shopee", sourceColor: "bg-[#ee4d2d]", rating: "4.5", reviews: "1.256", img: "🎒", color: "bg-gradient-to-br from-[#eff6ff] to-[#dbeafe]", tags: ["Acessório", "Urban"] },
                      { name: "Mouse Ergonômico Sem Fio", price: "R$25–R$55", minOrder: "15 un.", source: "Amazon", sourceColor: "bg-[#ff9900]", rating: "4.6", reviews: "1.276", img: "🖱", color: "bg-gradient-to-br from-[#f5f5f5] to-[#e5e5e5]", tags: ["Eletrônico", "Periférico"] },
                      { name: "Perfume Importado Premium", price: "R$80–R$150", minOrder: "4 un.", source: "AliExpress", sourceColor: "bg-[#e74c3c]", rating: "4.8", reviews: "1.334", img: "🧪", color: "bg-gradient-to-br from-[#fdf2f8] to-[#fce7f3]", tags: ["Beleza", "Perfumaria"] },
                      { name: "Luminária LED Moderna", price: "R$30–R$65", minOrder: "10 un.", source: "Shopee", sourceColor: "bg-[#ee4d2d]", rating: "4.7", reviews: "1.967", img: "💡", color: "bg-gradient-to-br from-[#fefce8] to-[#fef08a]", tags: ["Casa", "Decoração"] },
                    ].map((p) => (
                      <div key={p.name} className="group overflow-hidden rounded-xl border border-black/[0.06] bg-white transition hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                        {/* Product image area */}
                        <div className={`relative flex h-[80px] items-center justify-center text-[28px] sm:h-[100px] ${p.color}`}>
                          <div className="text-[32px] drop-shadow-sm">{p.img}</div>
                          {/* Checkbox */}
                          <div className="absolute left-2 top-2 h-[14px] w-[14px] rounded border border-black/[0.15] bg-white" />
                        </div>

                        <div className="p-[10px]">
                          {/* Source + Rating */}
                          <div className="mb-1.5 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className={`rounded px-1.5 py-[1px] text-[7px] font-bold text-white ${p.sourceColor}`}>{p.source}</span>
                            </div>
                            <div className="flex items-center gap-[3px]">
                              <span className="text-[8px] text-[#f59e0b]">★</span>
                              <span className="font-['Manrope'] text-[8px] font-semibold text-black/60">{p.rating}</span>
                              <span className="text-[7px] text-black/30">({p.reviews})</span>
                            </div>
                          </div>

                          {/* Product name */}
                          <div className="mb-1.5 truncate font-['Manrope'] text-[10px] font-bold text-[#0a0a0a]">
                            {p.name}
                          </div>

                          {/* Price + Min order */}
                          <div className="mb-2 flex items-center justify-between">
                            <div>
                              <div className="font-['Manrope'] text-[7px] text-black/35">Preço</div>
                              <div className="font-['Manrope'] text-[10px] font-bold text-[#0a0a0a]">{p.price}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-['Manrope'] text-[7px] text-black/35">Min. Pedido</div>
                              <div className="font-['Manrope'] text-[10px] font-bold text-[#0a0a0a]">{p.minOrder}</div>
                            </div>
                          </div>

                          {/* Tags */}
                          <div className="mb-2.5 flex gap-1">
                            {p.tags.map((tag) => (
                              <span key={tag} className="rounded bg-black/[0.04] px-1.5 py-[2px] font-['Manrope'] text-[7px] font-medium text-black/45">{tag}</span>
                            ))}
                          </div>

                          {/* Import button */}
                          <div className="flex items-center gap-1">
                            <div className="flex-1 rounded-lg bg-[#0a0a0a] py-[6px] text-center font-['Manrope'] text-[9px] font-semibold text-white transition group-hover:bg-[#1a1a1a]">
                              Importar Produto
                            </div>
                            <div className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-black/[0.08] bg-white text-[10px] text-black/40">
                              »
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── LOGOS ── */}
        <LogosStrip />

        {/* ── CREDIT BANNER ── */}
        <CreditBanner />

        {/* ── MULTIPLATAFORMA ── */}
        <MultiPlatformSection />

        {/* ── FEATURE DEEP-DIVES ── */}
        <FeatureSections />

        {/* ── ANYWHERE (3 cards) ── */}
        <AnywhereSection />

        {/* ── TESTIMONIALS (grid) ── */}
        <TestimonialsSection />

        <PricingSection />
        <CTASection />
        <Footer />
      </main>
    </div>
  );
};

export default Index;
