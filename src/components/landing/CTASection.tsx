import { useNavigate } from "react-router-dom";

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative z-[1] overflow-hidden bg-[#0a0f1e] py-[120px] text-center">
      {/* Blue gradient card */}
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <div className="relative mx-auto max-w-[720px] overflow-hidden rounded-[28px] px-[60px] py-[80px]">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a8a] via-[#2563eb] to-[#1d4ed8]" />
          {/* Glow top */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.12),transparent_65%)]" />
          {/* Grid overlay */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(rgba(255,255,255,0.9)_0.7px,transparent_0.7px)] [background-size:20px_20px]" />

          <h2 className="relative z-[1] mb-5 font-['Sora'] text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.08] tracking-[-0.04em] text-white">
            Seu primeiro produto no ar{" "}
            <em className="not-italic text-white/80">hoje.</em>
          </h2>
          <p className="relative z-[1] mb-10 text-base font-light leading-[1.65] text-white/65">
            Sem cartão de crédito. Sem experiência. Sem enrolação.
            <br />
            Escolha um nicho e deixa a IA trabalhar.
          </p>
          <div className="relative z-[1] flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => navigate("/cadastro")}
              className="flex cursor-pointer items-center gap-2 rounded-full border-none bg-white px-7 py-[14px] font-['Sora'] text-[0.9375rem] font-semibold text-[#1e3a8a] transition-all hover:-translate-y-[2px] hover:bg-white/90 hover:shadow-[0_12px_32px_rgba(0,0,0,0.2)]"
            >
              Começar agora
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              onClick={() => {
                document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="cursor-pointer rounded-full border border-white/25 bg-transparent px-7 py-[14px] font-['Sora'] text-[0.9375rem] font-normal text-white/70 transition-all hover:border-white/50 hover:text-white"
            >
              Ver planos
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
