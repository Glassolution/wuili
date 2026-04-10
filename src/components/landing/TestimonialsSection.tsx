const testimonials = [
  { initials: "JM", name: "João Mendes", location: "Fortaleza, CE", text: "Tentei dropshipping três vezes antes e desisti sempre na hora de criar os anúncios. Com a Wuilli, publiquei meu primeiro produto em menos de 5 minutos." },
  { initials: "CS", name: "Camila Souza", location: "São Paulo, SP", text: "No primeiro mês faturei R$ 3.200. Não sei nada de e-commerce. A IA escolheu os produtos, criou os anúncios e ajustou os preços. Eu só aprovei." },
  { initials: "RT", name: "Rafael Teixeira", location: "Belo Horizonte, MG", text: "Trabalho 8h por dia e não tenho tempo pra aprender dropshipping do zero. A Wuilli resolveu isso. Renda extra de verdade, sem virar meu segundo emprego." },
];

const TestimonialsSection = () => (
  <section id="depoimentos" className="relative z-[1] bg-[#0a0a0a] py-[120px]">
    <div className="mx-auto max-w-[1100px] px-6 md:px-10">
      <div className="mb-[18px] inline-flex items-center gap-[6px] text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[#8ec5ff] before:h-px before:w-5 before:bg-[#8ec5ff] before:content-['']">
        Depoimentos
      </div>
      <h2 className="mb-4 max-w-[580px] font-['Sora'] text-[clamp(1.9rem,3.5vw,2.8rem)] font-bold leading-[1.12] tracking-[-0.035em] text-white">
        Pessoas que nunca venderam online — até conhecer a Wuilli
      </h2>

      <div className="mt-[60px] grid grid-cols-1 gap-5 md:grid-cols-3">
        {testimonials.map((t) => (
          <div key={t.name} className="rounded-[18px] border border-white/[0.06] bg-white/[0.03] p-7 transition-shadow hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
            <div className="mb-4 flex gap-[3px]">
              {Array(5).fill(0).map((_, i) => (
                <span key={i} className="text-[0.875rem] text-[#8ec5ff]">★</span>
              ))}
            </div>
            <p className="mb-5 text-[0.9375rem] font-light leading-[1.65] text-white/70">"{t.text}"</p>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] font-['Sora'] text-[0.75rem] font-bold text-[#8ec5ff]">{t.initials}</div>
              <div>
                <div className="text-[0.875rem] font-medium text-white">{t.name}</div>
                <div className="text-[0.75rem] text-white/30">{t.location}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TestimonialsSection;
