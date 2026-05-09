const CreditBanner = () => (
  <section className="bg-black px-6 py-10 md:px-10">
    <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-5 rounded-2xl bg-[#161616] px-8 py-6 md:flex-row">
      <p className="text-center font-['Manrope'] text-[15px] font-medium leading-[1.5] text-white/80 md:text-left">
        Junte-se aos sellers que já vendem no automático com a Velo
      </p>
      <button
        type="button"
        onClick={() => document.getElementById("depoimentos")?.scrollIntoView({ behavior: "smooth" })}
        className="inline-flex flex-shrink-0 items-center gap-2 rounded-full border border-white/[0.2] bg-transparent px-5 py-[10px] font-['Manrope'] text-[13px] font-semibold text-white transition hover:border-white/40 hover:bg-white/[0.05]"
      >
        Ver depoimentos ↓
      </button>
    </div>
  </section>
);

export default CreditBanner;
