import { ArrowUpRight } from "lucide-react";

const CreditBanner = () => (
  <section className="bg-black px-6 py-12 md:px-10">
    <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-5 rounded-2xl border border-white/[0.06] bg-[#111] px-6 py-6 md:flex-row md:px-8">
      <p className="max-w-[640px] text-center font-['Manrope'] text-[14.5px] font-medium leading-[1.5] text-white/90 md:text-left">
        Ganhe até <span className="text-white">R$ 500 em créditos</span> para a sua loja quando começar a vender com a IA da Velo
      </p>
      <a
        href="#"
        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-[11px] font-['Manrope'] text-[13px] font-semibold text-black transition hover:bg-white/90"
      >
        Resgatar a oferta
        <ArrowUpRight size={14} strokeWidth={2.5} />
      </a>
    </div>
  </section>
);

export default CreditBanner;
