import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Ana Paula S.",
    city: "São Paulo",
    color: "bg-primary",
    text: "Em 3 dias já tinha minha loja no ar e vendendo. Nunca pensei que dropshipping pudesse ser tão simples.",
  },
  {
    name: "Marcos R.",
    city: "Rio de Janeiro",
    color: "bg-success",
    text: "Trabalho com dropshipping há 2 anos e a Wuili reduziu meu tempo de publicação de 2h para 5 minutos.",
  },
  {
    name: "Camila F.",
    city: "Fortaleza",
    color: "bg-warning",
    text: "Não entendia nada de e-commerce. Com a Wuili consegui criar minha loja e faturar R$3.000 no primeiro mês.",
  },
];

const TestimonialsSection = () => (
  <section className="py-24 bg-muted">
    <div className="max-w-7xl mx-auto px-6">
      <p className="label-upper mb-3">Depoimentos</p>
      <h2 className="text-3xl lg:text-4xl font-black mb-12" style={{ letterSpacing: "-1.5px" }}>
        Quem já usa a Wuili
      </h2>

      <div className="grid md:grid-cols-3 gap-6">
        {testimonials.map((t) => (
          <div key={t.name} className="card-wuili p-8">
            <div className="flex gap-0.5 mb-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={16} className="fill-warning text-warning" />
              ))}
            </div>
            <p className="text-muted-foreground italic leading-relaxed mb-6">"{t.text}"</p>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-sm font-bold text-primary-foreground`}>
                {t.name[0]}
              </div>
              <div>
                <p className="text-sm font-bold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.city}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TestimonialsSection;
