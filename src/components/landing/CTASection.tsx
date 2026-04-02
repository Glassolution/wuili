import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CTASection = () => (
  <div style={{ background: "#0a2540", borderTop: "1px solid #e3e8ef", position: "relative", overflow: "hidden" }}>
    {/* Glow */}
    <div
      style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: "600px", height: "400px", opacity: 0.3,
        background: "radial-gradient(ellipse, hsl(243 100% 68% / 0.5), hsl(167 100% 42% / 0.2), transparent 70%)",
      }}
    />
    <div style={{ position: "relative", maxWidth: "1280px", margin: "0 auto", padding: "88px 80px", textAlign: "center", zIndex: 1 }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "1px", background: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "1px", background: "rgba(255,255,255,0.08)" }} />
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
  </div>
);

export default CTASection;
