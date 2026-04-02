import { useState, useEffect, useCallback } from "react";

const HeroCard = () => {
  const [step, setStep] = useState(0);
  const [addedProducts, setAddedProducts] = useState<number[]>([]);
  const [publishStates, setPublishStates] = useState([0, 0, 0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((p) => (p + 1) % 4);
      setAddedProducts([]);
      setPublishStates([0, 0, 0]);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Animate publishing states when on step 2
  useEffect(() => {
    if (step !== 2) return;
    const timers = [
      setTimeout(() => setPublishStates([1, 0, 0]), 500),
      setTimeout(() => setPublishStates([2, 1, 0]), 1200),
      setTimeout(() => setPublishStates([2, 2, 1]), 1900),
      setTimeout(() => setPublishStates([2, 2, 2]), 2600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [step]);

  const toggleProduct = useCallback((id: number) => {
    setAddedProducts((p) => (p.includes(id) ? p : [...p, id]));
  }, []);

  return (
    <div className="w-80 card-wuili-elevated overflow-hidden">
      {/* macOS bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-destructive/80" />
          <div className="w-3 h-3 rounded-full bg-warning/80" />
          <div className="w-3 h-3 rounded-full bg-success/80" />
        </div>
        <div className="flex-1 text-center">
          <span className="text-xs text-muted-foreground bg-background rounded px-3 py-0.5">app.wuili.com.br</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 min-h-[260px]">
        {step === 0 && <Step1 />}
        {step === 1 && <Step2 addedProducts={addedProducts} onAdd={toggleProduct} />}
        {step === 2 && <Step3 publishStates={publishStates} />}
        {step === 3 && <Step4 />}
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 pb-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === step ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

const Step1 = () => (
  <div>
    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Passo 1</p>
    <p className="text-sm font-bold text-foreground mt-1 mb-4">Escolha seu template</p>
    <div className="space-y-2">
      {["Minimalista", "Moderno", "Dark Bold"].map((t, i) => (
        <div
          key={t}
          className={`p-3 rounded-xl border cursor-pointer transition-all hover:border-primary ${
            i === 1 ? "border-primary bg-accent" : "border-border"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg ${i === 0 ? "bg-muted" : i === 1 ? "bg-primary/20" : "bg-foreground/90"}`} />
            <span className="text-sm font-medium">{t}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Step2 = ({ addedProducts, onAdd }: { addedProducts: number[]; onAdd: (id: number) => void }) => {
  const products = [
    { id: 0, emoji: "🎧", name: "Fone TWS", profit: "R$63" },
    { id: 1, emoji: "👟", name: "Tênis Casual", profit: "R$47" },
    { id: 2, emoji: "💄", name: "Kit Skincare", profit: "R$38" },
  ];

  return (
    <div>
      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Passo 2</p>
      <p className="text-sm font-bold text-foreground mt-1 mb-4">Adicione produtos</p>
      <div className="space-y-2">
        {products.map((p) => {
          const added = addedProducts.includes(p.id);
          return (
            <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl border border-border">
              <div className="flex items-center gap-2">
                <span className="text-lg">{p.emoji}</span>
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-primary font-semibold">Lucro {p.profit}</p>
                </div>
              </div>
              <button
                onClick={() => onAdd(p.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                  added
                    ? "bg-success-light text-success"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                {added ? "✓ Adicionado" : "Adicionar"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Step3 = ({ publishStates }: { publishStates: number[] }) => {
  const platforms = ["Mercado Livre", "Shopee", "Minha Loja"];
  const statusLabels = ["Aguardando", "Publicando...", "✓ Publicado"];
  const statusColors = [
    "bg-muted text-muted-foreground",
    "bg-warning/10 text-warning animate-pulse",
    "bg-success-light text-success",
  ];

  return (
    <div>
      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Passo 3</p>
      <p className="text-sm font-bold text-foreground mt-1 mb-2">Publicar com 1 clique</p>
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 mb-3">
        <span className="text-lg">🎧</span>
        <span className="text-sm font-medium">Fone TWS</span>
      </div>
      <div className="space-y-2">
        {platforms.map((p, i) => (
          <div key={p} className="flex items-center justify-between p-2.5 rounded-xl border border-border">
            <span className="text-sm font-medium">{p}</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-all ${statusColors[publishStates[i]]}`}>
              {statusLabels[publishStates[i]]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Step4 = () => {
  const bars = [40, 55, 35, 65, 80, 70, 95];
  const days = ["S", "T", "Q", "Q", "S", "S", "D"];

  return (
    <div>
      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Passo 4</p>
      <p className="text-sm font-bold text-foreground mt-1 mb-4">Sua renda crescendo</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-3 rounded-xl bg-accent">
          <p className="text-xs text-muted-foreground">Lucro hoje</p>
          <p className="text-lg font-black text-primary">R$284</p>
          <p className="text-xs text-success font-bold">+24%</p>
        </div>
        <div className="p-3 rounded-xl bg-accent">
          <p className="text-xs text-muted-foreground">Pedidos</p>
          <p className="text-lg font-black text-foreground">12</p>
          <p className="text-xs text-success font-bold">+3 hoje</p>
        </div>
      </div>
      <div className="flex items-end gap-1 h-16">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-sm transition-all ${i === 6 ? "bg-primary" : "bg-primary/20"}`}
              style={{ height: `${h}%` }}
            />
            <span className="text-[9px] text-muted-foreground">{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeroCard;
