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
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => {
                playSatisfyingClick();
                navigate("/cadastro");
              }}
              className="landing-button-inverse group inline-flex cursor-pointer items-center gap-[10px] rounded-[100px] border-none bg-white px-8 py-4 font-['Manrope'] text-[16px] font-[500] text-black shadow-[0_1px_2px_rgba(0,0,0,0.10)]"
            >
              <span className="text-[13px] leading-none">✦</span>
              Começar agora
              <span className="transition-transform duration-[150ms] group-hover:translate-x-[3px]">→</span>
            </button>
            <button
              onClick={() => {
                playSatisfyingClick();
                document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="landing-button-ghost cursor-pointer rounded-[100px] border border-white/[0.15] bg-transparent px-7 py-[14px] font-['Manrope'] text-[15px] font-[400] text-white/60 transition-all duration-[120ms] hover:border-white/30 hover:text-white/90"
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
