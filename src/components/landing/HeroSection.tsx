import { useState } from "react";
import { useNavigate } from "react-router-dom";
import HeroCard from "./HeroCard";
const heroDashboard = "/principal.png";

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 mt-[1px]">
    <circle cx="9" cy="9" r="9" fill="rgba(124,58,237,0.12)" />
    <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="#7C3AED" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BULLETS = [
  "Publique produtos no Mercado Livre automaticamente",
  "IA cria anúncios com fotos, título e preço otimizados",
  "Responda perguntas de compradores sem esforço",
  "Análise de margem e oportunidades em tempo real",
  "Gestão de pedidos e rastreamento integrado",
];

const HeroSection = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  return (
    <section className="relative z-[1] min-h-screen flex items-center px-6 pt-[100px] pb-[80px]">
      {/* Floating ambient cards */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute top-[18%] left-[2%] bg-[rgba(255,255,255,0.92)] backdrop-blur-[16px] border border-[rgba(0,0,0,0.07)] rounded-[14px] px-[18px] py-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] hidden xl:block"
          style={{ animation: "fadeUp 0.8s 0.5s ease both, float 6s 1.3s ease-in-out infinite" }}
        >
          <div className="text-[0.6875rem] text-[#6B6B6B] mb-1">Produto encontrado</div>
          <div className="font-['Sora'] text-[1rem] font-semibold text-[#0A0A0A] tracking-[-0.03em]">Suporte Celular Veicular</div>
          <div className="text-[0.6875rem] text-[#6B6B6B] mt-[2px]">Mercado Livre · 842 vendidos/mês</div>
          <div className="inline-flex items-center gap-[5px] px-2 py-[3px] rounded-full text-[0.6875rem] font-medium mt-[6px] bg-[#DCFCE7] text-[#16A34A]">
            <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="#16A34A" /></svg>
            Margem 47%
          </div>
        </div>

        <div
          className="absolute bottom-[18%] right-[2%] bg-[rgba(255,255,255,0.92)] backdrop-blur-[16px] border border-[rgba(0,0,0,0.07)] rounded-[14px] px-[18px] py-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] hidden xl:block"
          style={{ animation: "fadeUp 0.8s 0.7s ease both, float 6s 0.8s ease-in-out infinite" }}
        >
          <div className="text-[0.6875rem] text-[#6B6B6B] mb-1">Lucro esta semana</div>
          <div className="font-['Sora'] text-[1rem] font-semibold text-[#16A34A] tracking-[-0.03em]">+ R$ 1.240,00</div>
          <div className="text-[0.6875rem] text-[#6B6B6B] mt-[2px]">↑ 32% vs semana anterior</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="relative z-10 w-full max-w-[1160px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

        {/* LEFT: Copy */}
        <div className="flex flex-col items-start" style={{ animation: "fadeUp 0.6s ease both" }}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-[14px] py-[6px] pl-2 border border-[rgba(124,58,237,0.22)] rounded-full bg-[rgba(124,58,237,0.06)] mb-7">
            <div className="w-[6px] h-[6px] rounded-full bg-[#7C3AED] animate-pulse" />
            <span className="text-[0.75rem] font-medium text-[#7C3AED] tracking-[0.02em]">IA gerenciando seus anúncios agora</span>
          </div>

          {/* Headline */}
          <h1 className="font-['Sora'] text-[clamp(2.4rem,4.5vw,3.75rem)] font-bold leading-[1.08] tracking-[-0.04em] text-[#0A0A0A] max-w-[560px] mb-5">
            Venda online.<br />A <em className="not-italic text-[#7C3AED]">IA</em> faz o trabalho.
          </h1>

          <p className="text-[1.0625rem] font-light text-[#6B6B6B] max-w-[440px] leading-[1.65] mb-8 tracking-[-0.01em]">
            Junte-se a quem já automatizou suas vendas e aprenda com quem faz isso todos os dias.
          </p>

          {/* Bullets */}
          <ul className="flex flex-col gap-3 mb-10">
            {BULLETS.map((item, i) => (
              <li key={i} className="flex items-start gap-3" style={{ animation: `fadeUp 0.5s ${0.1 + i * 0.07}s ease both` }}>
                <CheckIcon />
                <span className="text-[0.9375rem] text-[#3A3A3A] leading-[1.5] font-['DM_Sans']">{item}</span>
              </li>
            ))}
          </ul>

          {/* Email + CTA */}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[480px] mb-4" style={{ animation: "fadeUp 0.6s 0.45s ease both" }}>
            <input
              type="email"
              placeholder="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-5 py-[14px] rounded-full border border-[rgba(0,0,0,0.12)] bg-white text-[0.9375rem] text-[#0A0A0A] placeholder-[#9B9B9B] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[rgba(124,58,237,0.12)] transition-all font-['DM_Sans']"
            />
            <button
              onClick={() => navigate("/cadastro")}
              className="flex items-center justify-center gap-2 text-[0.9375rem] font-medium text-white bg-[#0A0A0A] border-none cursor-pointer px-7 py-[14px] rounded-full tracking-[-0.02em] hover:bg-[#222] hover:-translate-y-[2px] hover:shadow-[0_12px_32px_rgba(0,0,0,0.15)] transition-all font-['DM_Sans'] whitespace-nowrap"
            >
              Criar workspace
              <ArrowIcon />
            </button>
          </div>

          {/* Social proof */}
          <p className="text-[0.8125rem] text-[#9B9B9B] font-['DM_Sans']" style={{ animation: "fadeUp 0.6s 0.5s ease both" }}>
            Grátis para começar&nbsp;•&nbsp;Sem cartão de crédito&nbsp;•&nbsp;Cancele quando quiser
          </p>
        </div>

        {/* RIGHT: Product screenshot */}
        <div
          className="flex items-center justify-center lg:justify-end"
          style={{ animation: "fadeUp 0.7s 0.25s ease both" }}
        >
          <div className="relative w-full max-w-[580px] rounded-[20px] shadow-[0_32px_80px_rgba(0,0,0,0.12)] overflow-hidden border border-[rgba(0,0,0,0.08)]">
            <img
              src={heroDashboard}
              alt="Painel de produtos Velo — catálogo dropshipping com importação automática"
              className="w-full h-auto object-contain"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>

      </div>
    </section>
  );
};

export default HeroSection;
