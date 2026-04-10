import { useNavigate } from "react-router-dom";

const CTASection = () => {
  const navigate = useNavigate();
  return (
    <section className="relative z-[1] bg-[#0a0a0a] py-[120px] text-center">
      <div className="mx-auto max-w-[1100px] px-10">
        <div className="relative mx-auto max-w-[700px] overflow-hidden rounded-[28px] bg-[#1a1a1d] px-[60px] py-[72px]">
          <h2 className="relative z-[1] mb-5 font-['Sora'] text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.04em] text-white">
            Seu primeiro anúncio<br />no ar em <em className="not-italic text-[#8ec5ff]">30 segundos</em>
          </h2>
          <p className="relative z-[1] mb-10 text-base font-light leading-[1.65] text-white/50">
            Sem experiência. Sem cartão de crédito. Sem enrolação.<br />Escolha um nicho e deixa a IA trabalhar.
          </p>
          <div className="relative z-[1] flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={() => navigate("/cadastro")} className="flex cursor-pointer items-center gap-2 rounded-full border-none bg-white px-7 py-[14px] text-[0.9375rem] font-medium text-[#0a0a0a] transition-all hover:-translate-y-[2px] hover:bg-[#f0f0f0] hover:shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
              Começar agora
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="cursor-pointer rounded-full border border-white/15 bg-transparent px-7 py-[14px] text-[0.9375rem] font-normal text-white/50 transition-all hover:border-white/35 hover:text-white">
              Ver planos
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
