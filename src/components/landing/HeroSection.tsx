import { useNavigate } from "react-router-dom";

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HeroSection = () => {
  const navigate = useNavigate();
  return (
  <section className="relative z-[1] min-h-screen flex flex-col items-center justify-center text-center px-6 pt-[140px] pb-[100px]">
    {/* Floating cards */}
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute top-[22%] left-[5%] bg-[rgba(255,255,255,0.92)] backdrop-blur-[16px] border border-[rgba(0,0,0,0.07)] rounded-[14px] px-[18px] py-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] hidden lg:block animate-[fadeUp_0.8s_0.5s_ease_both]" style={{ animation: "fadeUp 0.8s 0.5s ease both, float 6s 1.3s ease-in-out infinite" }}>
        <div className="text-[0.6875rem] text-[#6B6B6B] mb-1">Produto encontrado</div>
        <div className="font-['Sora'] text-[1rem] font-semibold text-[#0A0A0A] tracking-[-0.03em]">Suporte Celular Veicular</div>
        <div className="text-[0.6875rem] text-[#6B6B6B] mt-[2px]">Mercado Livre · 842 vendidos/mês</div>
        <div className="inline-flex items-center gap-[5px] px-2 py-[3px] rounded-full text-[0.6875rem] font-medium mt-[6px] bg-[#DCFCE7] text-[#16A34A]">
          <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="#16A34A" /></svg>
          Margem 47%
        </div>
      </div>

      <div className="absolute top-[16%] md:top-[38%] right-[2%] md:right-[4%] bg-[rgba(255,255,255,0.92)] backdrop-blur-[16px] border border-[rgba(0,0,0,0.07)] rounded-[14px] px-[18px] py-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] hidden md:block" style={{ animation: "fadeUp 0.8s 0.7s ease both, float 6s 0.8s ease-in-out infinite" }}>
        <div className="text-[0.6875rem] text-[#6B6B6B] mb-1">IA publicando agora</div>
        <div className="flex items-end gap-1 h-7 mt-2">
          {[40, 65, 85, 55, 70, 45].map((h, i) => (
            <div key={i} className={`w-2 rounded-t ${i < 4 ? "bg-[#7C3AED]" : "bg-[rgba(124,58,237,0.1)]"}`} style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="inline-flex items-center gap-[5px] px-2 py-[3px] rounded-full text-[0.6875rem] font-medium mt-2 bg-[rgba(124,58,237,0.1)] text-[#7C3AED]">
          <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="#7C3AED" /></svg>
          4 plataformas ativas
        </div>
      </div>

      <div className="absolute bottom-[20%] left-[7%] bg-[rgba(255,255,255,0.92)] backdrop-blur-[16px] border border-[rgba(0,0,0,0.07)] rounded-[14px] px-[18px] py-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] hidden lg:block" style={{ animation: "fadeUp 0.8s 0.9s ease both, float 6s 2s ease-in-out infinite" }}>
        <div className="text-[0.6875rem] text-[#6B6B6B] mb-1">Lucro esta semana</div>
        <div className="font-['Sora'] text-[1rem] font-semibold text-[#16A34A] tracking-[-0.03em]">+ R$ 1.240,00</div>
        <div className="text-[0.6875rem] text-[#6B6B6B] mt-[2px]">↑ 32% vs semana anterior</div>
      </div>
    </div>

    {/* Badge */}
    <div className="inline-flex items-center gap-2 px-[14px] py-[6px] pl-2 border border-[rgba(124,58,237,0.22)] rounded-full bg-[rgba(124,58,237,0.06)] mb-9" style={{ animation: "fadeUp 0.6s ease both" }}>
      <div className="w-[6px] h-[6px] rounded-full bg-[#7C3AED] animate-pulse" />
      <span className="text-[0.75rem] font-medium text-[#7C3AED] tracking-[0.02em]">IA gerenciando seus anúncios agora</span>
    </div>

    <h1 className="font-['Sora'] text-[clamp(2.8rem,6vw,5rem)] font-bold leading-[1.08] tracking-[-0.04em] text-[#0A0A0A] max-w-[780px] mb-6" style={{ animation: "fadeUp 0.6s 0.1s ease both" }}>
      Venda online.<br />A <em className="not-italic text-[#7C3AED]">IA</em> faz o trabalho.
    </h1>

    <p className="text-[1.0625rem] font-light text-[#6B6B6B] max-w-[460px] leading-[1.65] mb-12 tracking-[-0.01em]" style={{ animation: "fadeUp 0.6s 0.2s ease both" }}>
      A Wuilli analisa produtos, cria anúncios e publica no Mercado Livre automaticamente. Você só aprova.
    </p>

    <div className="flex items-center gap-3 mb-20" style={{ animation: "fadeUp 0.6s 0.3s ease both" }}>
      <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-[0.9375rem] font-medium text-white bg-[#0A0A0A] border-none cursor-pointer px-7 py-[14px] rounded-full tracking-[-0.02em] hover:bg-[#222] hover:-translate-y-[2px] hover:shadow-[0_12px_32px_rgba(0,0,0,0.15)] transition-all font-['DM_Sans']">
        Começar agora
        <ArrowIcon />
      </button>
      <button className="text-[0.9375rem] font-normal text-[#6B6B6B] bg-transparent border border-[rgba(0,0,0,0.1)] cursor-pointer px-7 py-[14px] rounded-full tracking-[-0.02em] hover:border-[rgba(0,0,0,0.2)] hover:text-[#0A0A0A] transition-all font-['DM_Sans']">
        Ver como funciona
      </button>
    </div>

    <div className="flex flex-col sm:flex-row items-center border border-[rgba(0,0,0,0.07)] rounded-2xl bg-[rgba(255,255,255,0.72)] backdrop-blur-[12px] overflow-hidden" style={{ animation: "fadeUp 0.6s 0.4s ease both" }}>
      {[
        { number: "40", suffix: "%+", label: "Margem mínima por produto" },
        { prefix: "R$", number: "0", label: "Para começar a testar" },
        { number: "30", suffix: "s", label: "Para seu primeiro anúncio no ar" },
      ].map((stat, i) => (
        <div key={i} className="px-11 py-5 text-center relative">
          {i < 2 && <div className="hidden sm:block absolute right-0 top-[20%] bottom-[20%] w-px bg-[rgba(0,0,0,0.07)]" />}
          <div className="font-['Sora'] text-2xl font-bold text-[#0A0A0A] tracking-[-0.04em] leading-none mb-1">
            {stat.prefix && <span className="text-[#7C3AED]">{stat.prefix}</span>}
            {stat.number}
            {stat.suffix && <span className="text-[#7C3AED]">{stat.suffix}</span>}
          </div>
          <div className="text-[0.75rem] text-[#6B6B6B]">{stat.label}</div>
        </div>
      ))}
    </div>
  </section>
  );
};

export default HeroSection;
