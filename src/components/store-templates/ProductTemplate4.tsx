import type { CSSProperties } from "react";
import {
  BadgeCheck,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Eye,
  HeartHandshake,
  PackageOpen,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Wind,
  X,
  Zap,
} from "lucide-react";
import type { ProductTemplateProps } from "./ProductTemplate";

const formatUSD = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

const DARK = "#252525";

// Placeholder de cores comuns (PT/EN) para renderizar swatches quando a variação for "cor".
const COLOR_HEX: Record<string, string> = {
  vermelho: "#ef4444", red: "#ef4444", verde: "#22c55e", green: "#22c55e", azul: "#3b82f6", blue: "#3b82f6",
  preto: "#111827", black: "#111827", branco: "#f3f4f6", white: "#f3f4f6", cinza: "#9ca3af", gray: "#9ca3af", grey: "#9ca3af",
  amarelo: "#f59e0b", yellow: "#f59e0b", rosa: "#ec4899", pink: "#ec4899", roxo: "#8b5cf6", purple: "#8b5cf6",
  laranja: "#f97316", orange: "#f97316", marrom: "#92400e", brown: "#92400e", bege: "#e7d8c9", beige: "#e7d8c9",
  dourado: "#d4af37", gold: "#d4af37", prata: "#c0c0c0", silver: "#c0c0c0",
};
const isColorOption = (name: string) => /cor|colou?r/i.test(name);
const hexFor = (value: string) => COLOR_HEX[value.trim().toLowerCase()] || "#d4d4d4";

const benefits: Array<[typeof Zap, string]> = [
  [Zap, "Sinta um impulso de conforto sempre que precisar."],
  [CircleCheck, "Ganhe confianca com resultados que aparecem no uso."],
  [ShieldCheck, "Tenha tranquilidade com qualidade garantida."],
  [BarChart3, "Aproveite autonomia que dura o dia todo."],
];

const trustBadges: Array<[typeof Truck, string]> = [
  [Truck, "Envio rastreado para todo o Brasil"],
  [PackageOpen, "Trocas gratis"],
  [BadgeCheck, "Garantia de 30 dias"],
];

const gridFeatures: Array<[typeof Zap, string, string]> = [
  [Zap, "Treino passivo", "Cria bons habitos enquanto voce foca na rotina."],
  [Eye, "Progresso real", "Acompanhe a evolucao dia apos dia."],
  [Wind, "Conforto total", "Leve e agradavel do primeiro ao ultimo uso."],
  [HeartHandshake, "Alivio duradouro", "Resultados que continuam ao longo do tempo."],
];

const compareRows = ["Facil de usar", "Durabilidade", "Eco-friendly", "Sem incomodo", "Custo-beneficio"];
const stats = [
  { pct: "90%", text: "sentiram uma diferenca clara logo nas primeiras semanas de uso." },
  { pct: "95%", text: "mantiveram o resultado usando o produto de forma consistente." },
  { pct: "98%", text: "ganharam mais confianca no dia a dia apos o habito criado." },
];
const faqItems = [
  "Para quem e este produto?",
  "Como ele comeca a fazer efeito?",
  "Como funciona a entrega?",
  "Ele foi feito para durar?",
  "Qual e a nossa garantia?",
];

const DarkButton = ({ label }: { label: string }) => (
  <button type="button" className="mt-6 h-12 w-full rounded-[8px] text-[13px] font-bold uppercase tracking-[0.06em] text-white transition hover:opacity-90" style={{ backgroundColor: DARK }}>
    {label}
  </button>
);

const ProductTemplate4 = ({ title, description, price, originalPrice, image, productId, accent, mobile = false, variants = [] }: ProductTemplateProps) => {
  const discountPct = originalPrice && originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;
  const thumbnails = image ? [image, image, image, image, image] : [];
  const recommended = Array.from({ length: 5 }, () => ({ name: title, price, original: originalPrice ?? price * 1.25 }));
  const twoCol = mobile ? "1fr" : "1fr 1fr";

  return (
    <div className="bg-white text-[#1c1c1c]" style={{ "--velo-accent": accent } as CSSProperties}>
      <style>{`
        .velo-swatch:has(input:checked){ box-shadow:0 0 0 2px #fff, 0 0 0 4px var(--velo-accent); }
        .velo-pill{ border:1.5px solid rgba(0,0,0,0.14); }
        .velo-pill:has(input:checked){ border-color: var(--velo-accent); }
        .velo-acc > summary{ list-style:none; cursor:pointer; }
        .velo-acc > summary::-webkit-details-marker{ display:none; }
        .velo-acc .velo-chev{ transition: transform .2s; }
        .velo-acc[open] .velo-chev{ transform: rotate(180deg); }
      `}</style>

      {/* ===== HERO / PRODUTO ===== */}
      <section className="mx-auto max-w-[1200px] px-5 pb-10 pt-6 sm:px-8">
        <div className="grid items-start gap-8 lg:gap-12" style={{ gridTemplateColumns: twoCol }}>
          {/* Galeria */}
          <div>
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[10px] bg-[#eaeaea]">
              {image ? <img data-editor-type="image" data-editor-product="true" data-editor-product-id={productId} src={image} alt={title} className="h-full w-full object-cover" /> : null}
              <button type="button" aria-label="Anterior" className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[8px] bg-black/[0.06] text-black/50 transition hover:bg-black/10"><ChevronLeft size={18} /></button>
              <button type="button" aria-label="Proximo" className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[8px] bg-black/[0.06] text-black/50 transition hover:bg-black/10"><ChevronRight size={18} /></button>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2.5">
              {thumbnails.map((thumb, index) => (
                <span key={index} className="flex aspect-square items-center justify-center overflow-hidden rounded-[8px] bg-[#eaeaea]" style={{ border: index === 0 ? "1.5px solid rgba(0,0,0,0.35)" : "1.5px solid transparent" }}>
                  <img data-editor-type="image" data-editor-product="true" data-editor-product-id={productId} src={thumb} alt="" className="h-full w-full object-cover" />
                </span>
              ))}
            </div>
          </div>

          {/* Informacoes */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-[13px] text-black/70">
              <span className="flex" style={{ color: "#f5a623" }}>{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={15} fill="currentColor" strokeWidth={0} />)}</span>
              <span><span className="font-bold text-black">Avaliado 4.9/5</span> por 888+ pessoas</span>
            </div>

            <h1 data-editor-type="text" className="mt-3 text-[30px] font-black uppercase leading-[1.05] tracking-[-0.01em] text-[#171717] md:text-[38px]">{title}</h1>

            <p data-editor-type="text" className="mt-3 text-[15px] leading-[1.5] text-black/65">{description}</p>

            <div className="mt-4 flex items-center gap-2.5">
              <span data-editor-type="text" className="text-[22px] font-black text-[#171717]">{formatUSD(price)}</span>
              {discountPct > 0 ? <span className="text-[15px] text-black/40 line-through">{formatUSD(originalPrice ?? 0)}</span> : null}
              {discountPct > 0 ? <span className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase text-white" style={{ backgroundColor: DARK }}>Economize {discountPct}%</span> : null}
            </div>

            <div className="my-5 border-t border-black/10" />

            {/* Beneficios */}
            <ul className="space-y-3">
              {benefits.map(([Icon, text]) => (
                <li key={text} className="flex items-center gap-3 text-[14px] text-black/75">
                  <Icon size={19} strokeWidth={1.8} className="shrink-0 text-[#171717]" />
                  <span data-editor-type="text">{text}</span>
                </li>
              ))}
            </ul>

            <div className="my-5 border-t border-black/10" />

            {/* Variacoes reais do fornecedor (cor = swatches, resto = pills) */}
            {variants.map((option) => (
              <div key={option.name} className="mb-5">
                <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-black/70">{option.name}</p>
                <div className="flex flex-wrap gap-2.5">
                  {option.options.map((value, valueIndex) => (
                    isColorOption(option.name) ? (
                      <label key={value} className="velo-swatch relative block h-9 w-9 cursor-pointer overflow-hidden rounded-[8px] border border-black/10" title={value}>
                        <input type="radio" name={`velo-var-${option.name}`} defaultChecked={valueIndex === 0} className="sr-only" />
                        <span className="block h-full w-full" style={{ backgroundColor: hexFor(value) }} />
                      </label>
                    ) : (
                      <label key={value} className="velo-pill relative flex h-9 min-w-[40px] cursor-pointer items-center justify-center rounded-[8px] px-3 text-[13px] font-semibold text-[#171717]">
                        <input type="radio" name={`velo-var-${option.name}`} defaultChecked={valueIndex === 0} className="sr-only" />
                        <span data-editor-type="text">{value}</span>
                      </label>
                    )
                  ))}
                </div>
              </div>
            ))}

            {/* CTA */}
            <button type="button" className="flex h-14 w-full items-center justify-center gap-2.5 rounded-[10px] text-[15px] font-bold uppercase tracking-[0.04em] text-white transition hover:opacity-90" style={{ backgroundColor: DARK }}>
              <ShoppingCart size={19} /> Adicionar ao carrinho
            </button>

            {/* Selos */}
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-black/10 pt-5 text-center text-[11px] font-medium text-black/70">
              {trustBadges.map(([Icon, label]) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <Icon size={20} strokeWidth={1.7} className="text-[#171717]" />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {/* Review inline */}
            <div className="mt-5 flex items-start gap-3 border-t border-black/10 pt-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white" style={{ background: `linear-gradient(135deg, ${accent}, #a855f7)` }}><Star size={16} fill="currentColor" strokeWidth={0} /></span>
              <div className="min-w-0">
                <span className="flex" style={{ color: "#f5a623" }}>{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} fill="currentColor" strokeWidth={0} />)}</span>
                <p className="mt-1 text-[13px] leading-snug text-black/70">"Mudou a forma como eu trabalho. Facil de usar e os resultados apareceram rapido. Recomendo demais para qualquer pessoa!"</p>
                <p className="mt-1.5 flex items-center gap-1 text-[12px] font-semibold text-black"><BadgeCheck size={13} className="text-[#3b82f6]" /> Joao Silva</p>
              </div>
            </div>

            {/* Accordions */}
            <div className="mt-5 divide-y divide-black/10 border-y border-black/10">
              {[[Truck, "Informacoes de envio"], [RotateCcw, "Politica de devolucao"]].map(([Icon, label]) => (
                <details key={label as string} className="velo-acc group">
                  <summary className="flex h-14 items-center justify-between text-[14px] font-semibold text-[#171717]">
                    <span className="flex items-center gap-2.5">{(() => { const I = Icon as typeof Truck; return <I size={17} strokeWidth={1.8} />; })()}{label as string}</span>
                    <ChevronDown size={18} className="velo-chev text-black/40" />
                  </summary>
                  <p className="pb-4 text-[13px] leading-relaxed text-black/55">Detalhes sobre {(label as string).toLowerCase()} do seu pedido, com prazos, condicoes e suporte dedicado da nossa equipe.</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECAO IMAGEM + TEXTO ===== */}
      <section className="border-t border-black/[0.07] bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto grid max-w-[1120px] items-center gap-8 lg:gap-14" style={{ gridTemplateColumns: twoCol }}>
          <span className="flex aspect-square items-center justify-center overflow-hidden rounded-[10px] bg-[#ececec]">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}</span>
          <div>
            <h2 className="text-[26px] font-black leading-[1.15] text-[#171717]">Feito para o seu dia a dia</h2>
            <p className="mt-3 text-[14px] leading-[1.6] text-black/60">Leve e discreto, se adapta a sua rotina sem esforco. Cada detalhe foi pensado para entregar conforto e resultado desde o primeiro uso, do jeito que voce precisa.</p>
            <DarkButton label="Comprar agora" />
          </div>
        </div>
      </section>

      {/* ===== FEATURE GRID EM VOLTA DA IMAGEM CIRCULAR ===== */}
      <section className="border-t border-black/[0.07] bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-[1120px]">
          <h2 className="text-center text-[24px] font-black text-[#171717]">Viva sem complicacoes no dia a dia</h2>
          <p className="mx-auto mt-2 max-w-[560px] text-center text-[13px] leading-relaxed text-black/55">Em vez de forcar a sua rotina, este produto se encaixa naturalmente e faz voce sentir a diferenca.</p>
          <div className="mt-8 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div className="space-y-8 text-right">
              {gridFeatures.slice(0, 2).map(([Icon, t, d]) => (
                <div key={t}>
                  <Icon size={22} strokeWidth={1.7} className="ml-auto text-[#171717]" />
                  <h3 className="mt-2 text-[15px] font-bold text-[#171717]">{t}</h3>
                  <p className="mt-1 text-[12px] leading-snug text-black/55">{d}</p>
                </div>
              ))}
            </div>
            <span className="mx-auto flex h-[190px] w-[190px] items-center justify-center overflow-hidden rounded-full bg-[#ececec]">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}</span>
            <div className="space-y-8">
              {gridFeatures.slice(2).map(([Icon, t, d]) => (
                <div key={t}>
                  <Icon size={22} strokeWidth={1.7} className="text-[#171717]" />
                  <h3 className="mt-2 text-[15px] font-bold text-[#171717]">{t}</h3>
                  <p className="mt-1 text-[12px] leading-snug text-black/55">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== POR QUE MUDA TUDO + TABELA COMPARATIVA ===== */}
      <section className="border-t border-black/[0.07] bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto grid max-w-[1120px] items-center gap-8 lg:gap-14" style={{ gridTemplateColumns: twoCol }}>
          <div>
            <h2 className="text-[24px] font-black leading-[1.15] text-[#171717]">Por que isso muda tudo</h2>
            <p className="mt-3 text-[14px] leading-[1.6] text-black/60">Diferente das solucoes comuns, aqui o foco esta em resultado real e conforto duradouro. Voce sente a diferenca sem abrir mao da praticidade.</p>
            <DarkButton label="Comprar agora" />
          </div>
          <div className="overflow-hidden rounded-[10px] border border-black/10">
            <div className="grid grid-cols-[1fr_96px_96px] bg-[#f7f7f7] text-[12px] font-bold text-black/70">
              <span className="px-4 py-3" />
              <span className="py-3 text-center text-white" style={{ backgroundColor: DARK }}>Nosso produto</span>
              <span className="px-2 py-3 text-center">Outros</span>
            </div>
            {compareRows.map((row) => (
              <div key={row} className="grid grid-cols-[1fr_96px_96px] items-center border-t border-black/[0.06] text-[13px] text-black/70">
                <span className="px-4 py-3">{row}</span>
                <span className="flex justify-center py-3 text-white" style={{ backgroundColor: DARK }}><CircleCheck size={17} /></span>
                <span className="flex justify-center py-3 text-[#ef4444]"><X size={17} strokeWidth={2.4} /></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== STATS DA COMUNIDADE ===== */}
      <section className="border-t border-black/[0.07] bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto grid max-w-[1120px] items-center gap-8 lg:gap-14" style={{ gridTemplateColumns: twoCol }}>
          <span className="flex aspect-square items-center justify-center overflow-hidden rounded-[10px] bg-[#ececec]">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}</span>
          <div>
            <h2 className="text-[24px] font-black leading-[1.15] text-[#171717]">O que nossos clientes notaram</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-black/55">Como milhares de pessoas mudaram a rotina com mais conforto e praticidade.</p>
            <div className="mt-6 space-y-5">
              {stats.map((stat) => (
                <div key={stat.pct} className="flex items-center gap-4 border-b border-black/[0.06] pb-5">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-black text-[#171717]" style={{ borderColor: "#171717" }}>{stat.pct}</span>
                  <p className="text-[13px] leading-snug text-black/65">{stat.text}</p>
                </div>
              ))}
            </div>
            <DarkButton label="Quero o meu agora" />
          </div>
        </div>
      </section>

      {/* ===== TEXTO + IMAGEM ===== */}
      <section className="border-t border-black/[0.07] bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto grid max-w-[1120px] items-center gap-8 lg:gap-14" style={{ gridTemplateColumns: twoCol }}>
          <div>
            <h2 className="text-[24px] font-black leading-[1.15] text-[#171717]">Conforto que acompanha voce</h2>
            <p className="mt-3 text-[14px] leading-[1.6] text-black/60">Discreto e leve, ele fica ali pronto para o momento em que voce precisar. Simples de usar, sem complicacao e sem peso na sua rotina.</p>
            <DarkButton label="Comprar agora" />
          </div>
          <span className="flex aspect-square items-center justify-center overflow-hidden rounded-[10px] bg-[#ececec]">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}</span>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="border-t border-black/[0.07] bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-[820px]">
          <h2 className="text-center text-[24px] font-black text-[#171717]">Perguntas frequentes</h2>
          <div className="mt-6 divide-y divide-black/10 border-y border-black/10">
            {faqItems.map((item) => (
              <details key={item} className="velo-acc group">
                <summary className="flex h-14 items-center justify-between text-[14px] font-semibold text-[#171717]">
                  <span>{item}</span>
                  <ChevronDown size={18} className="velo-chev text-black/40" />
                </summary>
                <p className="pb-4 text-[13px] leading-relaxed text-black/55">Resposta detalhada sobre {item.toLowerCase().replace(/\?$/, "")}, com informacoes claras, prazos e o suporte da nossa equipe sempre que precisar.</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRODUTOS RECOMENDADOS ===== */}
      <section className="border-t border-black/[0.07] bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-[1120px]">
          <h2 className="text-center text-[24px] font-black text-[#171717]">Produtos recomendados</h2>
          <div className="relative mt-7">
            <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {recommended.map((item, index) => (
                <article key={index} className="w-[190px] shrink-0">
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[10px] bg-[#ececec] p-4">{image ? <img src={image} alt="" className="h-full w-full object-contain" /> : null}</div>
                  <h3 className="mt-3 line-clamp-1 text-[13px] font-semibold text-[#171717]">{item.name}</h3>
                  <div className="mt-1 flex items-center gap-2 text-[13px]">
                    <span className="font-bold text-[#171717]">{formatUSD(item.price)}</span>
                    <span className="text-black/40 line-through">{formatUSD(item.original)}</span>
                    <span className="rounded-full bg-[#f0f0f0] px-1.5 py-0.5 text-[10px] font-bold text-black/60">20% OFF</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProductTemplate4;
