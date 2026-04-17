import { useNavigate } from "react-router-dom";
import { playSatisfyingClick } from "@/lib/uiFeedback";

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative z-[1] overflow-hidden bg-black py-[120px] text-center">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <div className="relative mx-auto max-w-[720px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#111] px-8 py-[80px] sm:px-[60px]">

          <h2 className="mb-5 font-['Manrope'] text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.08] tracking-[-0.03em] text-white">
            Seu primeiro produto no ar{" "}
            <span className="text-white/50">hoje.</span>
          </h2>
          <p className="mb-10 font-['Manrope'] text-[15px] leading-[1.65] text-white/50">
            Sem cartão de crédito. Sem experiência. Sem enrolação.
            <br />
            Escolha um nicho e deixa a IA trabalhar.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => {
                playSatisfyingClick();
                navigate("/cadastro");
              }}
              className="landing-button-inverse flex cursor-pointer items-center gap-2 rounded-full border-none bg-white px-7 py-[14px] font-['Manrope'] text-[0.9375rem] font-semibold text-black"
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
                playSatisfyingClick();
                document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="landing-button-ghost cursor-pointer rounded-full border border-white/[0.15] bg-transparent px-7 py-[14px] font-['Manrope'] text-[0.9375rem] font-medium text-white/60"
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
