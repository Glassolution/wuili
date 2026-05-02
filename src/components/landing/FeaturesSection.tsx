import { Star, FileText, Clock, Monitor, RefreshCw, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Star,
    title: "Análise de tendências em tempo real",
    desc: "A IA monitora o Mercado Livre e a Shopee continuamente, identificando produtos com demanda crescente antes da concorrência.",
  },
  {
    icon: FileText,
    title: "Criação automática de anúncios",
    desc: "Título com SEO, descrição persuasiva, fotos do fornecedor e preço calculado. Do zero ao anúncio completo sem você digitar nada.",
  },
  {
    icon: Clock,
    title: "Monitoramento 24h de preços",
    desc: "Seus preços se ajustam automaticamente conforme os concorrentes mudam. Você nunca perde uma venda por estar mais caro.",
  },
  {
    icon: Monitor,
    title: "Publicação simultânea",
    desc: "Um produto, múltiplas plataformas. Mercado Livre e Shopee ao mesmo tempo, com formatação adequada para cada uma.",
  },
  {
    icon: RefreshCw,
    title: "Resposta automática a clientes",
    desc: "A IA responde perguntas dos compradores com respostas precisas e no tom certo. Disponível no plano Pro.",
  },
  {
    icon: TrendingUp,
    title: "Relatórios de lucro detalhados",
    desc: "Veja o desempenho por produto, por plataforma e por período. Saiba exatamente de onde vem o seu dinheiro.",
  },
];

const FeaturesSection = () => (
  <section id="funcionalidades" className="relative z-[1] bg-[#0a0f1e] py-[120px]">
    <div className="mx-auto max-w-[1100px] px-6 md:px-10">
      <div className="mb-16 text-center">
        <div className="mb-[18px] inline-flex items-center justify-center gap-[6px] text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[#8ec5ff] before:h-px before:w-5 before:bg-[#8ec5ff] before:content-['']">
          Funcionalidades
        </div>
        <h2 className="mx-auto mb-4 max-w-[580px] font-['Sora'] text-[clamp(1.9rem,3.5vw,2.8rem)] font-bold leading-[1.12] tracking-[-0.035em] text-white">
          Tudo que você precisaria aprender,{" "}
          <em className="not-italic text-[#8ec5ff]">a IA já sabe</em>
        </h2>
        <p className="mx-auto max-w-[480px] text-base font-light leading-[1.65] text-white/50">
          Cada parte do e-commerce que assusta iniciantes, automatizada.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[24px] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="group bg-[#0a0f1e] p-8 transition-colors hover:bg-[#2563eb]/[0.06] md:p-9"
          >
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.07] transition-colors group-hover:bg-[#2563eb]/20">
              <f.icon size={20} className="text-[#8ec5ff]" />
            </div>
            <div className="mb-[10px] font-['Sora'] text-base font-semibold tracking-[-0.025em] text-white">
              {f.title}
            </div>
            <div className="text-[0.875rem] font-light leading-[1.65] text-white/50">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection;
