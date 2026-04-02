const steps = [
  { num: "01", emoji: "🏪", title: "Crie sua loja", desc: "Template pronto em 5 minutos. Personalize com sua marca." },
  { num: "02", emoji: "📦", title: "Escolha produtos", desc: "+4.200 produtos verificados de fornecedores reais." },
  { num: "03", emoji: "🚀", title: "Publique com 1 clique", desc: "Vai pro ML, Shopee e sua loja automaticamente." },
  { num: "04", emoji: "💰", title: "Receba o lucro", desc: "Fornecedor entrega, você embolsa a diferença." },
];

const HowItWorks = () => (
  <section id="como-funciona" className="py-24">
    <div className="max-w-7xl mx-auto px-6">
      <p className="label-upper mb-3">Como funciona</p>
      <h2 className="text-3xl lg:text-4xl font-black mb-16" style={{ letterSpacing: "-1.5px" }}>
        Do zero à primeira venda em 4 passos
      </h2>

      <div className="grid md:grid-cols-4 gap-0">
        {steps.map((s, i) => (
          <div key={s.num} className={`p-6 ${i < 3 ? "md:border-r border-border" : ""}`}>
            <span className="text-sm font-bold text-primary">{s.num}</span>
            <span className="text-3xl block my-3">{s.emoji}</span>
            <h3 className="text-lg font-bold mb-2">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
