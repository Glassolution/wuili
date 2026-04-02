import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CTASection = () => (
  <section className="py-24 bg-dark relative overflow-hidden">
    {/* Glow */}
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] opacity-30"
      style={{
        background: "radial-gradient(ellipse, hsl(243 100% 68% / 0.5), hsl(167 100% 42% / 0.2), transparent 70%)",
      }}
    />

    <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
      <h2 className="text-3xl lg:text-4xl font-black text-primary-foreground mb-4" style={{ letterSpacing: "-1.5px" }}>
        Comece a vender ainda hoje
      </h2>
      <p className="text-primary-foreground/60 text-lg mb-8">
        Sem estoque, sem risco, sem complicação.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Button size="lg" className="bg-primary-foreground text-dark hover:bg-primary-foreground/90 text-base px-8" asChild>
          <Link to="/dashboard">Criar minha loja grátis ›</Link>
        </Button>
        <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 text-base px-8">
          Fale com a equipe ›
        </Button>
      </div>
    </div>
  </section>
);

export default CTASection;
