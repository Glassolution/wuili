import { Link } from "react-router-dom";
import { useState } from "react";
import BrandMark from "@/components/brand/BrandMark";
import LogosStrip from "@/components/landing/LogosStrip";
import CreditBanner from "@/components/landing/CreditBanner";
import MultiPlatformSection from "@/components/landing/MultiPlatformSection";
import AnywhereSection from "@/components/landing/AnywhereSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import PricingSection from "@/components/landing/PricingSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const NAV_LINKS = ["Produto", "Soluções", "FAQ", "Suporte"];

const Index = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#0a0a0a]">

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
          <div className="flex items-center gap-4">
            <Link to="/login" className="hidden font-['Manrope'] text-[14px] font-medium text-[#0a0a0a]/70 transition hover:text-[#0a0a0a] md:inline-flex">
              Preços
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
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <main>
        <section className="mx-auto flex max-w-[760px] flex-col items-center px-6 pb-10 pt-20 text-center md:pt-28">

          {/* Headline */}
          <h1 className="mb-6 font-['Manrope'] text-[clamp(2.75rem,5.5vw,4.5rem)] font-[700] leading-[1.08] tracking-[-0.035em] text-[#0a0a0a]">
            A Plataforma de<br />Vendas com IA<br />para e-commerce
          </h1>

          {/* Subtitle */}
          <p className="mb-10 max-w-[480px] font-['Manrope'] text-[1.0625rem] font-normal leading-[1.65] text-[#6b7280]">
            Publique, responda e venda no e-commerce com IA — operação automatizada ponta a ponta, sem esforço manual.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/cadastro"
              className="inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-7 py-[15px] font-['Manrope'] text-[15px] font-semibold text-white transition hover:bg-[#1a1a1a] hover:shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
            >
              Criar workspace — É grátis
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-black/20 bg-white px-7 py-[15px] font-['Manrope'] text-[15px] font-semibold text-[#0a0a0a] transition hover:border-black/40 hover:bg-black/[0.03]"
            >
              Baixar App Mobile
            </Link>
          </div>
        </section>

        {/* ── PRODUCT VISUAL ── */}
        <section className="mx-auto max-w-[1120px] px-6 pb-0 md:px-8">
          <div
            className="relative overflow-hidden rounded-[24px]"
            style={{
              background: "linear-gradient(135deg, #c8f542 0%, #48e8a8 38%, #64b8f0 65%, #b89cf8 100%)",
              minHeight: "500px",
            }}
          >
            {/* Floating card — left */}
            <div className="absolute left-8 top-1/2 -translate-y-1/2 w-[220px] rounded-2xl bg-white p-4 shadow-[0_16px_48px_rgba(0,0,0,0.15)]">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3f4f6] text-[13px] font-semibold text-[#0a0a0a]">C</div>
                  <div>
                    <div className="text-[12px] font-semibold text-[#0a0a0a]">Carlos S.</div>
                    <div className="text-[10px] text-[#9ca3af]">agora mesmo</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-[#0a0a0a] px-2 py-[2px] text-[10px] font-semibold text-white">
                  <span>✕</span>
                  <span>3 Novos</span>
                </div>
              </div>
              <div className="rounded-xl bg-[#f9fafb] px-3 py-2 text-[11px] leading-[1.5] text-[#374151]">
                Olá! O produto chegou? Quando sai meu pedido? 📦
              </div>
              <div className="mt-2 rounded-xl bg-[#0a0a0a] px-3 py-2 text-[11px] leading-[1.5] text-white">
                IA respondendo automaticamente...
              </div>
            </div>

            {/* Center decorative cloud shapes */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg width="220" height="140" viewBox="0 0 220 140" fill="none" opacity="0.18">
                <ellipse cx="110" cy="90" rx="110" ry="50" fill="white" />
                <ellipse cx="70" cy="70" rx="65" ry="40" fill="white" />
                <ellipse cx="150" cy="65" rx="70" ry="42" fill="white" />
                <ellipse cx="110" cy="55" rx="55" ry="38" fill="white" />
              </svg>
            </div>

            {/* Floating cards — right */}
            <div className="absolute right-8 top-1/2 flex -translate-y-1/2 flex-col gap-3">
              {/* Co-pilot / IA badge */}
              <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0a0a0a]">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1.5C7 1.5 10 4 10 7s-3 5.5-3 5.5M7 1.5C7 1.5 4 4 4 7s3 5.5 3 5.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="font-['DM_Sans'] text-[13px] font-semibold text-[#0a0a0a]">IA Velo</span>
                <div className="flex gap-1">
                  <span className="rounded bg-[#0a0a0a] px-1.5 py-0.5 text-[9px] font-bold text-white">ML</span>
                  <span className="rounded bg-[#f97316] px-1.5 py-0.5 text-[9px] font-bold text-white">SP</span>
                  <span className="rounded bg-[#3b82f6] px-1.5 py-0.5 text-[9px] font-bold text-white">SH</span>
                </div>
              </div>

              {/* Automate card */}
              <div className="w-[220px] rounded-2xl bg-white p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3f4f6] text-[13px] font-semibold">W</div>
                  <div className="flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-[2px]">
                    <div className="h-[6px] w-[6px] rounded-full bg-[#16a34a] animate-pulse" />
                    <span className="text-[10px] font-semibold text-[#16a34a]">Ativo</span>
                  </div>
                </div>
                <div className="text-[12px] font-semibold text-[#0a0a0a]">Automação*</div>
                <div className="mt-0.5 text-[11px] leading-[1.4] text-[#9ca3af]">Deixe a IA cuidar das suas vendas</div>
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
