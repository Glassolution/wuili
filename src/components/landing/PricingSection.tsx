import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Grátis",
    price: "R$0",
    period: "",
    popular: false,
    features: ["1 loja", "50 produtos", "Publicação manual", "Dashboard básico"],
  },
  {
    name: "Pro",
    price: "R$59",
    period: "/mês",
    popular: true,
    features: ["Loja completa", "+4.200 produtos", "Automação 1 clique", "ML + Shopee", "Suporte prioritário"],
  },
  {
    name: "Negócio",
    price: "R$149",
    period: "/mês",
    popular: false,
    features: ["Tudo do Pro", "Múltiplas lojas", "AliExpress direto", "API completa", "Gerente dedicado"],
  },
];

const PricingSection = () => (
  <section id="precos" className="py-24">
    <div className="max-w-7xl mx-auto px-6">
      <p className="label-upper mb-3">Preços</p>
      <h2 className="text-3xl lg:text-4xl font-black mb-12" style={{ letterSpacing: "-1.5px" }}>
        Comece grátis, escale quando quiser
      </h2>

      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`card-wuili p-8 relative ${plan.popular ? "border-primary border-2 shadow-wuili-primary" : ""}`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold bg-primary text-primary-foreground px-3 py-1 rounded-full">
                MAIS POPULAR
              </span>
            )}
            <h3 className="text-lg font-bold">{plan.name}</h3>
            <div className="mt-4 mb-6">
              <span className="text-4xl font-black">{plan.price}</span>
              <span className="text-muted-foreground">{plan.period}</span>
            </div>
            <ul className="space-y-3 mb-8">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check size={16} className="text-success flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className={`w-full ${
                plan.popular
                  ? "bg-primary text-primary-foreground shadow-wuili-primary hover:opacity-90"
                  : "bg-muted text-foreground hover:bg-muted/80"
              } transition-all`}
              asChild
            >
              <Link to="/dashboard">Começar agora</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default PricingSection;
