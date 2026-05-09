const testimonials = [
  {
    photo: "https://i.pravatar.cc/80?img=11",
    name: "João Mendes",
    title: "Seller autônomo",
    company: "Fortaleza, CE",
    quote:
      "Com a Velo eu finalmente consegui sair do zero. Publiquei meu primeiro anúncio no Mercado Livre em menos de 5 minutos e já vendi 2 unidades no mesmo dia.",
  },
  {
    photo: "https://i.pravatar.cc/80?img=47",
    name: "Camila Souza",
    title: "Lojista iniciante",
    company: "São Paulo, SP",
    quote:
      "Faturei R$ 3.200 no primeiro mês sem saber nada de e-commerce. A IA escolheu os produtos, criou os anúncios e ajustou os preços — eu só aprovei com um clique.",
  },
  {
    photo: "https://i.pravatar.cc/80?img=15",
    name: "Rafael Teixeira",
    title: "Renda extra",
    company: "Belo Horizonte, MG",
    quote:
      "Trabalho 8h por dia no emprego principal e nunca tive tempo de aprender dropshipping do zero. A Velo tocou tudo sozinha enquanto eu dormia.",
  },
  {
    photo: "https://i.pravatar.cc/80?img=32",
    name: "Beatriz Campos",
    title: "Microempreendedora",
    company: "Curitiba, PR",
    quote:
      "Em duas semanas a Velo reajustou os preços de 40 produtos com base nos concorrentes. Minha margem subiu de 28% para 41% sem eu mover um dedo.",
  },
  {
    photo: "https://i.pravatar.cc/80?img=54",
    name: "Marcos Dantas",
    title: "Vendedor multi-canal",
    company: "Recife, PE",
    quote:
      "Eu gastava 3 horas por dia respondendo perguntas na Shopee. Agora a IA responde tudo sozinha e eu uso esse tempo pra escolher novos produtos.",
  },
  {
    photo: "https://i.pravatar.cc/80?img=44",
    name: "Letícia Andrade",
    title: "Empreendedora digital",
    company: "Porto Alegre, RS",
    quote:
      "Testei três plataformas de dropshipping antes. A Velo foi a primeira em que eu não precisei assistir nenhum tutorial — escolhi um nicho e deixei a IA trabalhar.",
  },
];

const TestimonialsSection = () => (
  <section id="depoimentos" className="relative z-[1] bg-black py-[120px]">
    <div className="mx-auto max-w-[1200px] px-6 md:px-10">
      <h2 className="mb-[60px] text-center font-['Manrope'] text-[clamp(1.9rem,3.5vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.025em] text-white">
        O que nossos sellers estão dizendo
      </h2>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t) => (
          <div
            key={t.name}
            className="flex flex-col gap-5 rounded-[16px] border border-white/[0.06] bg-[#111] p-7 transition-colors hover:border-white/[0.12]"
          >
            <img
              src={t.photo}
              alt={t.name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
            <p className="flex-1 font-['Manrope'] text-[14px] leading-[1.65] text-white/80">
              “{t.quote}”
            </p>
            <div className="font-['Manrope'] text-[12.5px] leading-[1.5] text-white/40">
              <span className="text-white/70">{t.name}</span>, {t.title}, {t.company}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TestimonialsSection;
