import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import HeroCard from "./HeroCard";

const HeroSection = () => {
  const [salesCount, setSalesCount] = useState(1247);

  useEffect(() => {
    const interval = setInterval(() => {
      setSalesCount((prev) => prev + (Math.random() > 0.5 ? 2 : 1));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Animated gradient background - right half */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 right-0 w-[60%] h-full animate-gradient opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at 70% 30%, hsl(243 100% 68% / 0.4), transparent 50%), radial-gradient(ellipse at 90% 60%, hsl(180 80% 60% / 0.3), transparent 50%), radial-gradient(ellipse at 60% 80%, hsl(330 80% 60% / 0.2), transparent 50%), radial-gradient(ellipse at 80% 10%, hsl(30 90% 60% / 0.2), transparent 50%)",
            backgroundSize: "200% 200%",
          }}
        />
        <div className="absolute top-0 right-0 w-[60%] h-full bg-gradient-to-l from-transparent via-transparent to-background" />
      </div>

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center relative z-10">
        {/* Left column */}
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 bg-accent rounded-full px-4 py-1.5">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium text-accent-foreground">
              Vendas hoje na plataforma: <span className="font-bold">{salesCount.toLocaleString("pt-BR")}</span>
            </span>
          </div>

          <h1 className="text-5xl lg:text-[56px] font-black leading-[1.05]" style={{ letterSpacing: "-2.5px" }}>
            Plataforma de vendas online para{" "}
            <span className="text-primary">qualquer</span> pessoa.
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
            Crie sua loja, encontre produtos de fornecedores reais e publique automaticamente no Mercado Livre, Shopee e
            mais. Sem estoque, desde a primeira venda até a milionésima.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="bg-primary text-primary-foreground shadow-wuili-primary hover:opacity-90 transition-all text-base px-8" asChild>
              <Link to="/dashboard">Comece já ›</Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-6 gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Registre-se com o Google
            </Button>
          </div>
        </div>

        {/* Right column - floating cards */}
        <div className="relative h-[520px] hidden lg:block">
          {/* Satellite card 1 - top left */}
          <div className="absolute -left-4 top-0 z-20 animate-float-alt" style={{ transform: "rotate(2deg)" }}>
            <div className="card-wuili p-4 w-52">
              <p className="text-xs text-muted-foreground font-medium">Lucro esta semana</p>
              <p className="text-2xl font-black text-primary mt-1">R$ 284</p>
              <p className="text-xs font-bold text-success mt-1">↑ +24%</p>
              <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-progress-fill" />
              </div>
            </div>
          </div>

          {/* Satellite card 2 - top right */}
          <div className="absolute right-0 top-4 z-20 animate-float" style={{ transform: "rotate(1.5deg)" }}>
            <div className="card-wuili p-4 w-56">
              <p className="text-xs text-muted-foreground font-medium mb-2">Plataformas conectadas</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground font-medium">🛒 Mercado Livre ✓</span>
                <span className="text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground font-medium">🧡 Shopee ✓</span>
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground font-medium">📦 AliExpress</span>
                <span className="text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground font-medium">🏪 Minha loja ✓</span>
              </div>
            </div>
          </div>

          {/* Main hero card */}
          <div className="absolute left-8 top-16 z-10 animate-float" style={{ transform: "rotate(-1deg)" }}>
            <HeroCard />
          </div>

          {/* Satellite card 3 - bottom right */}
          <SaleNotification />
        </div>
      </div>
    </section>
  );
};

const SaleNotification = () => {
  const sales = [
    { emoji: "💰", title: "Venda realizada!", desc: "Fone TWS vendido no Mercado Livre", time: "agora mesmo" },
    { emoji: "🎉", title: "Nova venda!", desc: "Tênis Casual vendido na Shopee", time: "há 2 min" },
    { emoji: "🚀", title: "Pedido confirmado!", desc: "Kit Skincare na Minha Loja", time: "há 5 min" },
    { emoji: "💸", title: "Lucro recebido!", desc: "R$63 de comissão depositados", time: "há 8 min" },
  ];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setIdx((p) => (p + 1) % sales.length), 3500);
    return () => clearInterval(interval);
  }, []);

  const sale = sales[idx];

  return (
    <div className="absolute right-4 bottom-8 z-20 animate-float-alt" style={{ transform: "rotate(-2deg)" }}>
      <div className="card-wuili p-4 w-56 transition-all duration-300">
        <div className="flex items-start gap-2">
          <span className="text-2xl">{sale.emoji}</span>
          <div>
            <p className="text-sm font-bold text-foreground">{sale.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sale.desc}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{sale.time}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
