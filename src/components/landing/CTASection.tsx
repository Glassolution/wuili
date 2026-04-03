import { useNavigate } from "react-router-dom";

const CTASection = () => {
  const navigate = useNavigate();
  return (
  <section className="relative z-[1] py-[120px] text-center">
    <div className="max-w-[1100px] mx-auto px-10">
      <div className="max-w-[700px] mx-auto bg-[#0A0A0A] rounded-[28px] px-[60px] py-[72px] relative overflow-hidden">
        <div className="absolute -top-[200px] -right-[100px] w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute -bottom-[150px] -left-[80px] w-[300px] h-[300px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(159,103,255,0.25) 0%, transparent 70%)", filter: "blur(60px)" }} />

        <h2 className="font-['Sora'] text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.04em] leading-[1.1] text-white mb-5 relative z-[1]">
          Seu primeiro anúncio<br />no ar em <em className="not-italic text-[#9F67FF]">30 segundos</em>
        </h2>
        <p className="text-base font-light text-white/50 leading-[1.65] mb-10 relative z-[1]">
          Sem experiência. Sem cartão de crédito. Sem enrolação.<br />Escolha um nicho e deixa a IA trabalhar.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative z-[1]">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-[0.9375rem] font-medium text-[#0A0A0A] bg-white border-none cursor-pointer px-7 py-[14px] rounded-full hover:bg-[#F0F0F0] hover:-translate-y-[2px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-all">
            Começar agora
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="text-[0.9375rem] font-normal text-white/50 bg-transparent border border-white/15 cursor-pointer px-7 py-[14px] rounded-full hover:border-white/35 hover:text-white transition-all">
            Ver planos
          </button>
        </div>
      </div>
    </div>
  </section>
  );
};

export default CTASection;
