import { ArrowUpRight, Download, Store, Smartphone } from "lucide-react";

type CardDef = {
  title: string;
  cta: string;
  ctaIcon: "download" | "arrow" | "phone";
  gradient: string;
  mockup: "desktop" | "browser" | "terminal";
};

const cards: CardDef[] = [
  {
    title: "Comece no app da Velo",
    cta: "Baixar para Windows",
    ctaIcon: "download",
    gradient: "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 45%, #6d28d9 100%)",
    mockup: "desktop",
  },
  {
    title: "Integre aos seus marketplaces",
    cta: "Conectar Mercado Livre",
    ctaIcon: "arrow",
    gradient: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #1e40af 100%)",
    mockup: "browser",
  },
  {
    title: "Gerencie pelo mobile",
    cta: "Baixar na App Store",
    ctaIcon: "phone",
    gradient: "linear-gradient(135deg, #0a0a0a 0%, #1f2937 50%, #065f46 100%)",
    mockup: "terminal",
  },
];

const CtaIcon = ({ type }: { type: CardDef["ctaIcon"] }) => {
  if (type === "download") return <Download size={14} strokeWidth={2.5} />;
  if (type === "phone") return <Smartphone size={14} strokeWidth={2.5} />;
  return <ArrowUpRight size={14} strokeWidth={2.5} />;
};

const MockupDesktop = () => (
  <div className="w-[180px] rounded-xl border border-white/[0.12] bg-[#0a0a0a]/85 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
    <div className="mb-2 flex gap-1">
      <div className="h-[5px] w-[5px] rounded-full bg-white/30" />
      <div className="h-[5px] w-[5px] rounded-full bg-white/30" />
      <div className="h-[5px] w-[5px] rounded-full bg-white/30" />
    </div>
    <div className="mb-3 text-center">
      <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
        <span className="text-[11px] text-white/80">&gt;_</span>
      </div>
      <div className="text-[9px] font-semibold text-white/85">Vamos vender</div>
      <div className="text-[8px] text-white/40">Loja Velo ▾</div>
    </div>
    <div className="mb-2 rounded-md bg-white/[0.06] px-2 py-[6px] text-[8px] text-white/50">
      Criar anúncio de suporte veicular
    </div>
    <div className="flex justify-between">
      <div className="text-[9px] text-white/40">+</div>
      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] text-black">↑</div>
    </div>
  </div>
);

const MockupBrowser = () => (
  <div className="w-[200px] rounded-xl border border-white/[0.12] bg-[#0a0a0a]/85 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
    <div className="mb-2 text-[8px] text-white/60">
      Publiquei 2 anúncios novos com títulos otimizados, 5 fotos
      tratadas e preço ajustado pela concorrência.
    </div>
    <div className="mb-1 flex justify-between text-[8px]">
      <span className="text-white/50">2 anúncios publicados</span>
      <span className="text-white/40">Revisar ↗</span>
    </div>
    <div className="mb-[6px] flex items-center justify-between rounded bg-white/[0.04] px-2 py-[5px]">
      <span className="text-[8px] text-white/60">Suporte Magnético</span>
      <span className="text-[7px] font-bold text-[#4ade80]">+R$ 42</span>
    </div>
    <div className="mb-2 flex items-center justify-between rounded bg-white/[0.04] px-2 py-[5px]">
      <span className="text-[8px] text-white/60">Kit Skincare 5 itens</span>
      <span className="text-[7px] font-bold text-[#4ade80]">+R$ 89</span>
    </div>
    <div className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-[6px] text-[8px] text-white/50">
      Ficou ótimo, aprovar tudo
    </div>
    <div className="mt-2 flex justify-end">
      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] text-black">↑</div>
    </div>
  </div>
);

const MockupTerminal = () => (
  <div className="w-[220px] rounded-xl border border-white/[0.12] bg-[#0a0a0a]/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
    <div className="mb-2 flex items-center gap-1.5">
      <div className="h-[5px] w-[5px] rounded-full bg-[#ff5f57]" />
      <div className="h-[5px] w-[5px] rounded-full bg-[#febc2e]" />
      <div className="h-[5px] w-[5px] rounded-full bg-[#28c840]" />
    </div>
    <div className="mb-1 font-mono text-[8px] text-white/70">
      &gt;_ Velo CLI <span className="text-white/30">(v1.0.4)</span>
    </div>
    <div className="mb-[2px] font-mono text-[8px] text-white/50">
      store: <span className="text-[#4ade80]">loja-velo-sp</span>
    </div>
    <div className="mb-2 font-mono text-[8px] text-white/50">
      channel: mercado-livre
    </div>
    <div className="mb-2 font-mono text-[7px] text-white/40">
      Tip: use /nicho para mudar o segmento
    </div>
    <div className="mb-1 font-mono text-[8px] text-white">
      &gt; velo publicar suporte-veicular
    </div>
    <div className="font-mono text-[7px] text-white/40">97% contexto livre</div>
  </div>
);

const AnywhereSection = () => (
  <section className="bg-black px-6 py-[120px] md:px-10">
    <div className="mx-auto max-w-[1200px]">
      {/* Headline */}
      <h2 className="mx-auto max-w-[720px] text-center font-['Manrope'] text-[clamp(1.9rem,3.5vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.025em] text-white">
        A mesma IA em qualquer lugar<br className="hidden sm:block" /> que você vende
      </h2>
      <p className="mx-auto mt-5 max-w-[560px] text-center font-['Manrope'] text-[15px] leading-[1.65] text-white/50">
        Use a Velo em várias interfaces — todas conectadas à mesma conta e à mesma operação.
      </p>
      <div className="mt-8 flex justify-center">
        <a
          href="#"
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-[11px] font-['Manrope'] text-[13px] font-semibold text-black transition hover:bg-white/90"
        >
          Saiba mais na documentação
          <ArrowUpRight size={14} strokeWidth={2.5} />
        </a>
      </div>

      {/* Three cards */}
      <div className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className="flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#111]"
          >
            {/* Gradient preview */}
            <div
              className="relative flex h-[260px] items-center justify-center overflow-hidden"
              style={{ background: card.gradient }}
            >
              {card.mockup === "desktop" && <MockupDesktop />}
              {card.mockup === "browser" && <MockupBrowser />}
              {card.mockup === "terminal" && <MockupTerminal />}
            </div>

            {/* Title + CTA */}
            <div className="flex flex-col gap-5 p-7">
              <h3 className="font-['Manrope'] text-[16px] font-semibold tracking-[-0.01em] text-white">
                {card.title}
              </h3>
              <button className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-[12px] font-['Manrope'] text-[13px] font-semibold text-black transition hover:bg-white/90">
                {card.cta}
                <CtaIcon type={card.ctaIcon} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default AnywhereSection;
