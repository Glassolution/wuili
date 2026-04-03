const testimonials = [
  { initials: "JM", name: "João Mendes", location: "Fortaleza, CE", text: "Tentei dropshipping três vezes antes e desisti sempre na hora de criar os anúncios. Com a Wuilli, publiquei meu primeiro produto em menos de 5 minutos." },
  { initials: "CS", name: "Camila Souza", location: "São Paulo, SP", text: "No primeiro mês faturei R$ 3.200. Não sei nada de e-commerce. A IA escolheu os produtos, criou os anúncios e ajustou os preços. Eu só aprovei." },
  { initials: "RT", name: "Rafael Teixeira", location: "Belo Horizonte, MG", text: "Trabalho 8h por dia e não tenho tempo pra aprender dropshipping do zero. A Wuilli resolveu isso. Renda extra de verdade, sem virar meu segundo emprego." },
];

const TestimonialsSection = () => (
  <section id="depoimentos" className="relative z-[1] py-[120px]">
    <div className="max-w-[1100px] mx-auto px-6 md:px-10">
      <div className="inline-flex items-center gap-[6px] text-[0.75rem] font-medium text-[#7C3AED] tracking-[0.08em] uppercase mb-[18px] before:content-[''] before:w-5 before:h-px before:bg-[#7C3AED]">
        Depoimentos
      </div>
      <h2 className="font-['Sora'] text-[clamp(1.9rem,3.5vw,2.8rem)] font-bold tracking-[-0.035em] leading-[1.12] text-[#0A0A0A] max-w-[580px] mb-4">
        Pessoas que nunca venderam online — até conhecer a Wuilli
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-[60px]">
        {testimonials.map((t) => (
          <div key={t.name} className="bg-white border border-[rgba(0,0,0,0.07)] rounded-[18px] p-7 hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] transition-shadow">
            <div className="flex gap-[3px] mb-4">
              {Array(5).fill(0).map((_, i) => (
                <span key={i} className="text-[#7C3AED] text-[0.875rem]">★</span>
              ))}
            </div>
            <p className="text-[0.9375rem] font-light text-[#0A0A0A] leading-[1.65] mb-5">"{t.text}"</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[rgba(124,58,237,0.1)] flex items-center justify-center font-['Sora'] text-[0.75rem] font-bold text-[#7C3AED]">{t.initials}</div>
              <div>
                <div className="text-[0.875rem] font-medium text-[#0A0A0A]">{t.name}</div>
                <div className="text-[0.75rem] text-[#999]">{t.location}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TestimonialsSection;
