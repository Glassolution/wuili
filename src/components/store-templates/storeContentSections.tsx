import { useState } from "react";
import { Check, ChevronDown, Clock, Flame, Heart, Leaf, Quote, ShieldCheck, Sparkles, Star, Truck, Zap } from "lucide-react";

// Seções de conteúdo "abaixo da dobra" — barra de benefícios, passo a passo,
// grade de recursos e bloco de imagem + CTA. Transformam a página de produto
// numa landing de conversão completa.
//
// Tudo é HTML editável pelo editor (textos e ícones via data-editor-*; imagens
// reusam a foto do produto como placeholder, trocáveis pelo lojista). Os textos
// são placeholders genéricos em pt-BR, não dados fabricados.

/** Converte um hex de destaque em rgba (para fundos com leve tingimento). */
const tint = (hex: string, alpha: number) => {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
};

type ContentProps = { image: string; accent: string; title?: string; mobile?: boolean };

/** Barra de benefícios em linha (ícone + label). */
export const StoreBenefitsBar = ({ accent }: { accent: string }) => {
  const items: Array<[typeof Sparkles, string, string]> = [
    [Sparkles, "Sparkles", "Qualidade premium"],
    [Truck, "Truck", "Envio para todo o Brasil"],
    [ShieldCheck, "ShieldCheck", "Compra 100% segura"],
    [Heart, "Heart", "Feito para você"],
  ];
  return (
    <div className="border-y border-black/10" style={{ backgroundColor: tint(accent, 0.05) }}>
      <div className="mx-auto grid max-w-[1180px] gap-4 px-6 py-6 sm:grid-cols-2 sm:px-10 lg:grid-cols-4">
        {items.map(([Icon, iconName, label]) => (
          <div key={label} className="flex items-center gap-3">
            <Icon data-editor-type="icon" data-editor-icon={iconName} size={22} style={{ color: accent }} className="shrink-0" />
            <span data-editor-type="text" className="text-[14px] font-semibold text-black">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** "Como funciona em 3 passos" — imagem + número + título + descrição. */
export const StoreThreeSteps = ({ image, accent, mobile = false }: ContentProps) => {
  const steps = [
    ["Receba em casa", "Seu pedido chega rápido e bem embalado, pronto para usar."],
    ["Configure em minutos", "Simples e intuitivo: em poucos passos está tudo pronto."],
    ["Aproveite todo dia", "Praticidade e qualidade que fazem diferença na sua rotina."],
  ];
  return (
    <section className="bg-white px-6 py-14 sm:px-10">
      <div className="mx-auto max-w-[1180px]">
        <h2 data-editor-type="text" className="text-center text-[28px] font-black tracking-[-0.02em] text-black md:text-[34px]">
          Como funciona em 3 passos
        </h2>
        <div className="mt-9 grid gap-6" style={{ gridTemplateColumns: mobile ? "1fr" : "repeat(3, minmax(0,1fr))" }}>
          {steps.map(([title, text], index) => (
            <div key={title} className="overflow-hidden rounded-[16px] border border-black/[0.07] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
              <div className="relative aspect-[16/11] overflow-hidden bg-[#f1f1f0]">
                {image ? <img data-editor-type="image" src={image} alt="" className="h-full w-full object-cover" /> : null}
                <span className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-black text-white" style={{ backgroundColor: accent }}>
                  {index + 1}
                </span>
              </div>
              <div className="p-5">
                <h3 data-editor-type="text" className="text-[17px] font-bold text-black">{title}</h3>
                <p data-editor-type="text" className="mt-2 text-[14px] leading-relaxed text-black/60">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/** Grade de recursos (2x2, ícones) ao lado de uma imagem grande, fundo tingido. */
export const StoreFeatureGrid = ({ image, accent, mobile = false }: ContentProps) => {
  const features: Array<[typeof Star, string, string, string]> = [
    [Star, "Star", "Design premium", "Acabamento cuidadoso em cada detalhe."],
    [Zap, "Zap", "Alta performance", "Feito para entregar o melhor resultado."],
    [Leaf, "Leaf", "Pensado para durar", "Materiais de qualidade e resistentes."],
    [Clock, "Clock", "Praticidade no dia a dia", "Fácil de usar, do primeiro ao último dia."],
  ];
  return (
    <section className="px-6 py-14 sm:px-10" style={{ backgroundColor: tint(accent, 0.06) }}>
      <div className="mx-auto grid max-w-[1180px] items-center gap-10 lg:gap-14" style={{ gridTemplateColumns: mobile ? "1fr" : "minmax(0,1fr) minmax(0,1.05fr)" }}>
        <div className="grid gap-x-8 gap-y-9 sm:grid-cols-2">
          {features.map(([Icon, iconName, title, text]) => (
            <div key={title}>
              <Icon data-editor-type="icon" data-editor-icon={iconName} size={26} style={{ color: accent }} />
              <h3 data-editor-type="text" className="mt-3 text-[19px] font-bold text-black">{title}</h3>
              <p data-editor-type="text" className="mt-1.5 text-[14px] leading-relaxed text-black/60">{text}</p>
            </div>
          ))}
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[#f1f1f0] shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
          {image ? <img data-editor-type="image" src={image} alt="" className="h-full w-full object-cover" /> : null}
        </div>
      </div>
    </section>
  );
};

/** Bloco imagem + texto + CTA grande ("faça sua compra"). */
export const StoreImageCta = ({ image, accent, title = "", mobile = false }: ContentProps) => (
  <section className="bg-white px-6 py-14 sm:px-10">
    <div className="mx-auto grid max-w-[1180px] items-center gap-10 lg:gap-14" style={{ gridTemplateColumns: mobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)" }}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[#f1f1f0] shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
        {image ? <img data-editor-type="image" src={image} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div>
        <h2 data-editor-type="text" className="text-[28px] font-black leading-[1.1] tracking-[-0.02em] text-black md:text-[34px]">
          {title ? `Leve ${title} para a sua rotina` : "Leve essa experiência para a sua rotina"}
        </h2>
        <p data-editor-type="text" className="mt-4 max-w-[480px] text-[15px] leading-[1.6] text-black/60">
          Junte-se a quem já transformou o dia a dia com mais praticidade e qualidade. Aproveite a oferta enquanto está disponível.
        </p>
        <button type="button" className="mt-7 h-14 w-full rounded-[12px] text-[16px] font-black text-white transition hover:brightness-110 sm:w-auto sm:px-10" style={{ backgroundColor: accent }}>
          Comprar agora
        </button>
        <p data-editor-type="text" className="mt-3 text-[13px] font-semibold text-black/55">Envio rápido e garantia de satisfação.</p>
      </div>
    </div>
  </section>
);
