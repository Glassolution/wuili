import { useMemo } from "react";
import { Search, ShoppingBag, Heart, Star } from "lucide-react";

type Step = "nome" | "email" | "senha" | "whatsapp" | "nicho" | "criando";

interface Props {
  step: Step;
  nome: string;
  email: string;
  whatsapp: string;
  nicho: string;
  currentInput: string;
}

// Nicho theme + product presets
const THEMES: Record<
  string,
  {
    accent: string;
    accentSoft: string;
    tag: string;
    products: { name: string; price: string; emoji: string; from: string; to: string }[];
  }
> = {
  moda: {
    accent: "#111111",
    accentSoft: "#F5F1EA",
    tag: "Nova coleção",
    products: [
      { name: "Jaqueta Oversize", price: "R$ 189", emoji: "🧥", from: "#EADFD1", to: "#C9B79A" },
      { name: "Tênis Chunky", price: "R$ 259", emoji: "👟", from: "#F0EAE2", to: "#B8A388" },
      { name: "Bolsa Croc", price: "R$ 149", emoji: "👜", from: "#E8DDCC", to: "#A88E6C" },
      { name: "Óculos Retrô", price: "R$ 89", emoji: "🕶️", from: "#EFE7DA", to: "#8B7355" },
    ],
  },
  eletrônicos: {
    accent: "#0A66FF",
    accentSoft: "#EAF1FF",
    tag: "Tech drop",
    products: [
      { name: "Fone TWS Pro", price: "R$ 149", emoji: "🎧", from: "#D6E4FF", to: "#0A66FF" },
      { name: "Smartwatch S9", price: "R$ 289", emoji: "⌚", from: "#E0EBFF", to: "#1E40AF" },
      { name: "Câmera Mini", price: "R$ 199", emoji: "📷", from: "#DCE7FA", to: "#1D4ED8" },
      { name: "Carregador MagSafe", price: "R$ 89", emoji: "🔌", from: "#E8EFFA", to: "#2563EB" },
    ],
  },
  beleza: {
    accent: "#D6336C",
    accentSoft: "#FDECF3",
    tag: "Rotina Glow",
    products: [
      { name: "Sérum Vitamina C", price: "R$ 79", emoji: "🧴", from: "#FBD6E3", to: "#D6336C" },
      { name: "Batom Matte", price: "R$ 39", emoji: "💄", from: "#FCDCE6", to: "#B31355" },
      { name: "Kit Skincare", price: "R$ 149", emoji: "🌸", from: "#FBE0EA", to: "#A61150" },
      { name: "Máscara Facial", price: "R$ 29", emoji: "🪞", from: "#FBE6EE", to: "#C22765" },
    ],
  },
  casa: {
    accent: "#3F6E43",
    accentSoft: "#EEF4EE",
    tag: "Home decor",
    products: [
      { name: "Luminária Aroma", price: "R$ 119", emoji: "🕯️", from: "#DDE9DE", to: "#3F6E43" },
      { name: "Vaso Cerâmica", price: "R$ 79", emoji: "🏺", from: "#E4EDE5", to: "#4B7C50" },
      { name: "Manta Boucle", price: "R$ 169", emoji: "🛋️", from: "#EAF0EA", to: "#5C8A61" },
      { name: "Difusor Bambu", price: "R$ 59", emoji: "🎋", from: "#E1ECE3", to: "#365E39" },
    ],
  },
  pets: {
    accent: "#E67E22",
    accentSoft: "#FDF1E6",
    tag: "Pet essentials",
    products: [
      { name: "Cama Fofa Pet", price: "R$ 139", emoji: "🐕", from: "#FCE4CC", to: "#E67E22" },
      { name: "Comedouro Duplo", price: "R$ 49", emoji: "🍖", from: "#FDEAD6", to: "#C15A0A" },
      { name: "Coleira LED", price: "R$ 39", emoji: "🦴", from: "#FCE8D3", to: "#D66F14" },
      { name: "Brinquedo Corda", price: "R$ 25", emoji: "🎾", from: "#FBE3C9", to: "#B25311" },
    ],
  },
  esportes: {
    accent: "#0F766E",
    accentSoft: "#E7F5F3",
    tag: "Move mais",
    products: [
      { name: "Garrafa Térmica", price: "R$ 99", emoji: "🥤", from: "#D6EDE9", to: "#0F766E" },
      { name: "Faixa Elástica", price: "R$ 39", emoji: "🏋️", from: "#DDEFEB", to: "#134E4A" },
      { name: "Tênis Runner", price: "R$ 269", emoji: "👟", from: "#E1F1EE", to: "#115E59" },
      { name: "Meia Esportiva", price: "R$ 25", emoji: "🧦", from: "#E6F3F0", to: "#0D5F58" },
    ],
  },
};

const DEFAULT_THEME = {
  accent: "#111111",
  accentSoft: "#F3F3F3",
  tag: "Sua loja",
  products: [
    { name: "Produto em destaque", price: "R$ —", emoji: "✨", from: "#EEEEEE", to: "#9CA3AF" },
    { name: "Produto novo", price: "R$ —", emoji: "🛍️", from: "#EAEAEA", to: "#6B7280" },
    { name: "Best seller", price: "R$ —", emoji: "🔥", from: "#EFEFEF", to: "#4B5563" },
    { name: "Lançamento", price: "R$ —", emoji: "⭐", from: "#ECECEC", to: "#374151" },
  ],
};

function resolveTheme(nichoRaw: string) {
  const lower = nichoRaw.toLowerCase();
  for (const key of Object.keys(THEMES)) {
    if (lower.includes(key)) return { ...THEMES[key], key };
  }
  return { ...DEFAULT_THEME, key: "" };
}

function firstName(n: string) {
  return n.trim().split(/\s+/)[0] || "";
}

export default function StorePreview({ step, nome, email, whatsapp, nicho, currentInput }: Props) {
  // Live-preview: reflect current typing on the active step
  const liveNome = step === "nome" ? currentInput || nome : nome;
  const liveNicho = step === "nicho" ? currentInput || nicho : nicho;

  const theme = useMemo(() => resolveTheme(liveNicho), [liveNicho]);
  const fname = firstName(liveNome);
  const storeName = fname ? `${fname}.store` : "sualoja.store";

  const hasName = fname.length >= 2;
  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const hasWhats = whatsapp.length > 0;
  const hasNicho = theme.key.length > 0 || (step === "nicho" && currentInput.length > 0);

  // Progressive disclosure
  const showHeader = true;
  const showHero = hasName;
  const showProducts = hasName && (hasEmail || step === "senha" || step === "whatsapp" || step === "nicho" || step === "criando");
  const showFooter = hasWhats;

  return (
    <div className="relative flex flex-col items-center">
      {/* Tooltip label */}
      <div className="relative mb-3">
        <div className="rounded-xl bg-[#1a1a1a] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.06]">
          Exemplo de loja {fname || "Velo"}
        </div>
        <div
          className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2"
          style={{
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            borderTop: "7px solid #1a1a1a",
          }}
        />
      </div>

      {/* Phone frame */}
      <div className="relative h-[560px] w-[280px] rounded-[36px] bg-[#1a1a1a] p-[6px] shadow-[0_20px_60px_rgba(0,0,0,0.6),_0_0_0_1px_rgba(255,255,255,0.05)]">
        {/* Notch */}
        <div className="pointer-events-none absolute left-1/2 top-[6px] z-10 h-[18px] w-[90px] -translate-x-1/2 rounded-b-2xl bg-[#1a1a1a]" />
        <div className="pointer-events-none absolute left-1/2 top-[10px] z-20 h-[6px] w-[6px] -translate-x-1/2 translate-x-[24px] rounded-full bg-[#333]" />

        {/* Screen */}
        <div className="relative h-full w-full overflow-hidden rounded-[30px] bg-white">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[9px] font-semibold text-black/80">
            <span>9:41</span>
            <span className="h-[6px] w-[60px]" />
            <span>●●●</span>
          </div>

          {/* Store header */}
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black text-white"
                style={{ background: theme.accent }}
              >
                {fname.charAt(0).toUpperCase() || "V"}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold leading-tight text-black">{storeName}</span>
                <span className="text-[8.5px] text-black/50">
                  {hasNicho ? `${liveNicho}` : "sua vitrine"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-black/60">
              <Search size={12} />
              <Heart size={12} />
              <ShoppingBag size={12} />
            </div>
          </div>

          {/* Search bar */}
          <div className="mx-4 mb-3 flex items-center gap-1.5 rounded-lg bg-black/[0.04] px-2 py-1.5">
            <Search size={10} className="text-black/40" />
            <span className="text-[9.5px] text-black/40">Buscar produtos</span>
          </div>

          {/* Hero banner */}
          {showHero ? (
            <div
              className="mx-4 mb-3 flex items-end justify-between overflow-hidden rounded-xl p-3 transition-all duration-500"
              style={{
                background: `linear-gradient(135deg, ${theme.accentSoft} 0%, ${theme.accent} 140%)`,
                minHeight: 78,
              }}
            >
              <div className="flex flex-col gap-1">
                <span
                  className="w-fit rounded-full bg-white/70 px-1.5 py-[2px] text-[7.5px] font-bold uppercase tracking-wide"
                  style={{ color: theme.accent }}
                >
                  {theme.tag}
                </span>
                <span className="text-[12px] font-bold leading-tight text-white drop-shadow-sm">
                  Bem-vindo{fname ? `,\n${fname}` : ""}
                </span>
                <span className="text-[8.5px] font-medium text-white/90">
                  Frete grátis acima de R$99
                </span>
              </div>
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/25 text-lg backdrop-blur-sm"
              >
                {theme.products[0].emoji}
              </div>
            </div>
          ) : (
            <div className="mx-4 mb-3 h-[78px] rounded-xl bg-black/[0.04]" />
          )}

          {/* Section title */}
          <div className="mb-2 flex items-center justify-between px-4">
            <span className="text-[10px] font-bold text-black">
              {showProducts ? "Mais vendidos" : "Produtos"}
            </span>
            <span className="text-[8.5px] font-semibold" style={{ color: theme.accent }}>
              Ver todos
            </span>
          </div>

          {/* Product grid */}
          <div className="grid grid-cols-2 gap-2 px-4">
            {theme.products.slice(0, 4).map((p, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-lg bg-white ring-1 ring-black/[0.05] transition-all duration-500"
                style={{ opacity: showProducts ? 1 : 0.35 }}
              >
                <div
                  className="flex h-[54px] items-center justify-center text-xl"
                  style={{
                    background: showProducts
                      ? `linear-gradient(135deg, ${p.from} 0%, ${p.to} 130%)`
                      : "#EEE",
                  }}
                >
                  {showProducts ? p.emoji : ""}
                </div>
                <div className="flex flex-col gap-[2px] px-1.5 py-1.5">
                  <span className="truncate text-[9px] font-semibold text-black">
                    {showProducts ? p.name : "————"}
                  </span>
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[9px] font-bold"
                      style={{ color: theme.accent }}
                    >
                      {showProducts ? p.price : "R$ —"}
                    </span>
                    <div className="flex items-center gap-[1px] text-black/50">
                      <Star size={7} fill="currentColor" strokeWidth={0} />
                      <span className="text-[7.5px] font-medium">4.9</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer / trust */}
          {showFooter && (
            <div
              className="mx-4 mt-3 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[8px] font-medium transition-all"
              style={{ background: theme.accentSoft, color: theme.accent }}
            >
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[8px]">
                ✓
              </span>
              <span>WhatsApp de suporte ativado</span>
            </div>
          )}

          {/* Home indicator */}
          <div className="absolute inset-x-0 bottom-1 flex justify-center">
            <div className="h-[3px] w-16 rounded-full bg-black/25" />
          </div>
        </div>
      </div>

      {/* Step ticker below */}
      <div className="mt-4 flex items-center gap-1.5">
        {["nome", "email", "senha", "whatsapp", "nicho"].map((s, i) => {
          const active =
            (s === "nome" && hasName) ||
            (s === "email" && hasEmail) ||
            (s === "senha" && step !== "nome" && step !== "email") ||
            (s === "whatsapp" && hasWhats) ||
            (s === "nicho" && hasNicho);
          return (
            <div
              key={s}
              className="h-[3px] w-6 rounded-full transition-colors duration-300"
              style={{ background: active ? theme.accent : "rgba(255,255,255,0.12)" }}
            />
          );
        })}
      </div>
    </div>
  );
}
