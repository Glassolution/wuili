import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { type MouseEvent, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { VeloLogo } from "@/components/VeloLogo";
import PlanBadge from "@/components/PlanBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import LogosStrip from "@/components/landing/LogosStrip";
import CreditBanner from "@/components/landing/CreditBanner";
import MultiPlatformSection from "@/components/landing/MultiPlatformSection";
import AnywhereSection from "@/components/landing/AnywhereSection";
import FeatureSections from "@/components/landing/FeatureSections";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import PricingSection from "@/components/landing/PricingSection";
import FAQSection from "@/components/landing/FAQSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";
import { CatalogMockup } from "@/components/landing/DashboardMockups";
import { playSatisfyingClick } from "@/lib/uiFeedback";

type NavLink =
  | { label: string; href: string; to?: never; forceNavigate?: never }
  | { label: string; to: string; forceNavigate?: boolean; href?: never };

const NAV_LINKS: NavLink[] = [
  { label: "Produto", href: "#" },
  { label: "Soluções", href: "#" },
  { label: "FAQ", href: "#faq" },
  { label: "Suporte", href: "#" },
];

const Index = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [signupPreparing, setSignupPreparing] = useState(false);
  const [signupTransition, setSignupTransition] = useState(false);

  const isLogged = Boolean(user);
  const userInitial = (user?.email ?? "U").charAt(0).toUpperCase();

  useEffect(() => {
    if (searchParams.get("section") !== "faq") return;

    window.requestAnimationFrame(() => {
      document.getElementById("faq")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [searchParams]);

  const handleAnchorClick = (href?: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!href || !href.startsWith("#") || href.length <= 1) return;

    const target = document.querySelector(href);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
            <VeloLogo size="md" variant="dark" />
          </Link>

          {/* Nav links (desktop) */}
          <nav className="hidden items-center gap-8 font-['Manrope'] text-[14px] font-medium text-[#0a0a0a]/70 md:flex">
            {NAV_LINKS.map((item) => (
              item.to ? (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if (item.forceNavigate) {
                      window.location.assign(item.to);
                      return;
                    }
                    navigate(item.to);
                  }}
                  className="cursor-pointer bg-transparent p-0 text-inherit transition hover:text-[#0a0a0a]"
                >
                  {item.label}
                </button>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={handleAnchorClick(item.href)}
                  className="transition hover:text-[#0a0a0a]"
                >
                  {item.label}
                </a>
              )
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
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleStartSignup}
              style={{ minWidth: 196, pointerEvents: (signupPreparing || signupTransition) ? "none" : "auto" }}
              className="landing-button-primary btn-primary btn-primary--lg"
            >
              {(signupPreparing || signupTransition) ? (
                <>
                  <span style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    animation: "btn-spin 0.7s linear infinite",
                    transformOrigin: "center",
                    flexShrink: 0,
                  }} />
                  Preparando...
                </>
              ) : isLogged ? "Continuar no dashboard" : "Criar minha loja"}
            </button>
            <a
              href="#planos"
              onClick={playSatisfyingClick}
              className="text-[15px] font-[400] font-['Manrope'] text-[#737373] underline-offset-2 transition-all duration-[150ms] hover:text-[#0a0a0a] hover:underline"
            >
              Ver planos
            </a>
          </div>

        </section>

        {/* ── PRODUCT VISUAL — Dashboard mockup ── */}
        <section className="mx-auto max-w-[1120px] px-6 pb-0 md:px-8">
          <CatalogMockup />
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
        <FAQSection />
        <CTASection />
        <Footer />
      </main>
    </div>
  );
};

export default Index;
