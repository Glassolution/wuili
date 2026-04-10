const testimonials = [
  {
    photo: "https://i.pravatar.cc/80?img=11",
    name: "João Mendes",
    location: "Fortaleza, CE",
    text: "Tentei dropshipping três vezes antes e desisti sempre na hora de criar os anúncios. Com a Velo, publiquei meu primeiro produto em menos de 5 minutos.",
    result: "2 vendas no 1º dia",
  },
  {
    photo: "https://i.pravatar.cc/80?img=47",
    name: "Camila Souza",
    location: "São Paulo, SP",
    text: "No primeiro mês faturei R$ 3.200. Não sei nada de e-commerce. A IA escolheu os produtos, criou os anúncios e ajustou os preços. Eu só aprovei.",
    result: "R$3.200 no 1º mês",
  },
  {
    photo: "https://i.pravatar.cc/80?img=15",
    name: "Rafael Teixeira",
    location: "Belo Horizonte, MG",
    text: "Trabalho 8h por dia e não tenho tempo pra aprender dropshipping do zero. A Velo resolveu isso. Renda extra de verdade, sem virar meu segundo emprego.",
    result: "Renda extra real",
  },
];

const TestimonialsSection = () => (
  <section id="depoimentos" className="relative z-[1] bg-[#0a0f1e] py-[120px]">
    <div className="mx-auto max-w-[1100px] px-6 md:px-10">
      <div className="mb-[18px] inline-flex items-center gap-[6px] text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[#8ec5ff] before:h-px before:w-5 before:bg-[#8ec5ff] before:content-['']">
        Depoimentos
      </div>
      <h2 className="mb-4 max-w-[580px] font-['Sora'] text-[clamp(1.9rem,3.5vw,2.8rem)] font-bold leading-[1.12] tracking-[-0.035em] text-white">
        Pessoas que nunca venderam online —{" "}
        <em className="not-italic text-[#8ec5ff]">até conhecer a Velo</em>
      </h2>

      <div className="mt-[60px] grid grid-cols-1 gap-5 md:grid-cols-3">
        {testimonials.map((t) => (
          <div
            key={t.name}
            className="flex flex-col rounded-[18px] border border-white/[0.06] bg-white/[0.03] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#2563eb]/30 hover:shadow-[0_20px_50px_rgba(37,99,235,0.12)]"
          >
            {/* Stars */}
            <div className="mb-4 flex gap-[3px]">
              {Array(5).fill(0).map((_, i) => (
                <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#FBBF24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>

            {/* Result badge */}
            <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#2563eb]/10 px-3 py-1 text-[0.7rem] font-semibold text-[#8ec5ff]">
              ✓ {t.result}
            </div>

            {/* Quote */}
            <p className="mb-6 flex-1 text-[0.9375rem] font-light leading-[1.65] text-white/70">
              "{t.text}"
            </p>

            {/* Author */}
            <div className="flex items-center gap-3 border-t border-white/[0.06] pt-5">
              <img
                src={t.photo}
                alt={t.name}
                width={40}
                height={40}
                className="rounded-full object-cover ring-2 ring-[#2563eb]/30"
              />
              <div>
                <div className="text-[0.875rem] font-semibold text-white">{t.name}</div>
                <div className="text-[0.75rem] text-white/35">{t.location}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TestimonialsSection;
