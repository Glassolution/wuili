import { Store, Package, Rocket } from "lucide-react";

const items = [
  {
    icon: Store,
    emoji: "🏪",
    title: "Loja Online",
    desc: "Templates profissionais prontos para usar. Personalize cores, logo e produtos em minutos.",
  },
  {
    icon: Package,
    emoji: "📦",
    title: "Catálogo de Fornecedores",
    desc: "+4.200 produtos verificados de fornecedores reais. Eletrônicos, moda, beleza e mais.",
  },
  {
    icon: Rocket,
    emoji: "🚀",
    title: "Publicação Automática",
    desc: "1 clique publica em todas as plataformas. Mercado Livre, Shopee e sua loja própria.",
  },
];

const ProductsSection = () => (
  <section id="produtos" className="py-24 bg-muted">
    <div className="max-w-7xl mx-auto px-6">
      <p className="label-upper mb-3">Plataforma completa</p>
      <h2 className="text-3xl lg:text-4xl font-black mb-16" style={{ letterSpacing: "-1.5px" }}>
        Soluções flexíveis para cada modelo de negócio
      </h2>

      <div className="grid md:grid-cols-3 gap-0">
        {items.map((item, i) => (
          <div
            key={item.title}
            className={`p-8 ${i < 2 ? "md:border-r border-border" : ""}`}
          >
            <span className="text-4xl mb-4 block">{item.emoji}</span>
            <h3 className="text-xl font-bold mb-2">{item.title}</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">{item.desc}</p>
            <a href="#" className="text-sm font-semibold text-primary hover:underline">
              Saiba mais →
            </a>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default ProductsSection;
