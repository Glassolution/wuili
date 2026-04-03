import { Star, FileText, Clock, Monitor, RefreshCw, TrendingUp } from "lucide-react";

const features = [
  { icon: Star, title: "Análise de tendências em tempo real", desc: "A IA monitora o Mercado Livre e a Shopee continuamente, identificando produtos com demanda crescente antes da concorrência." },
  { icon: FileText, title: "Criação automática de anúncios", desc: "Título com SEO, descrição persuasiva, fotos do fornecedor e preço calculado. Do zero ao anúncio completo sem você digitar nada." },
  { icon: Clock, title: "Monitoramento 24h de preços", desc: "Seus preços se ajustam automaticamente conforme os concorrentes mudam. Você nunca perde uma venda por estar mais caro." },
  { icon: Monitor, title: "Publicação simultânea", desc: "Um produto, múltiplas plataformas. Mercado Livre e Shopee ao mesmo tempo, com formatação adequada para cada uma." },
  { icon: RefreshCw, title: "Resposta automática a clientes", desc: "A IA responde perguntas dos compradores com respostas precisas e no tom certo. Disponível no plano Pro." },
  { icon: TrendingUp, title: "Relatórios de lucro detalhados", desc: "Veja o desempenho por produto, por plataforma e por período. Saiba exatamente de onde vem o seu dinheiro." },
];

const FeaturesSection = () => (
  <section id="funcionalidades" className="relative z-[1] py-[120px] bg-white">
    <div className="max-w-[1100px] mx-auto px-6 md:px-10">
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center gap-[6px] text-[0.75rem] font-medium text-[#7C3AED] tracking-[0.08em] uppercase mb-[18px] before:content-[''] before:w-5 before:h-px before:bg-[#7C3AED]">
          Funcionalidades
        </div>
        <h2 className="font-['Sora'] text-[clamp(1.9rem,3.5vw,2.8rem)] font-bold tracking-[-0.035em] leading-[1.12] text-[#0A0A0A] max-w-[580px] mx-auto mb-4">
          Tudo que você precisaria aprender, a IA já sabe
        </h2>
        <p className="text-base font-light text-[#6B6B6B] max-w-[480px] mx-auto leading-[1.65]">
          Cada parte do dropshipping que assusta iniciantes, automatizada.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[2px] bg-[rgba(0,0,0,0.07)] rounded-[20px] overflow-hidden">
        {features.map((f) => (
          <div key={f.title} className="bg-white p-8 md:p-9 hover:bg-[#FAFAFA] transition-colors">
            <div className="w-11 h-11 rounded-xl bg-[rgba(124,58,237,0.1)] flex items-center justify-center mb-5">
              <f.icon size={20} className="text-[#7C3AED]" />
            </div>
            <div className="font-['Sora'] text-base font-semibold text-[#0A0A0A] tracking-[-0.025em] mb-[10px]">{f.title}</div>
            <div className="text-[0.875rem] font-light text-[#6B6B6B] leading-[1.65]">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection;
