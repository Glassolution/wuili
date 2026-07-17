import { useState } from "react";
import { Check, ChevronDown, Clock, Flame, Heart, Leaf, PackageCheck, Quote, Settings2, ShieldCheck, Sparkles, Star, Truck, Zap } from "lucide-react";

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

type ContentProps = { image: string; accent: string; title?: string; mobile?: boolean; productImages?: string[] };

/** Gera cor determinística a partir de string (para avatares de iniciais). */
const stringToHue = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
};
const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase() || "?";

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

/** "Como funciona em 3 passos" — cards com ícone numerado (sem duplicar foto do produto). */
export const StoreThreeSteps = ({ accent, mobile = false }: ContentProps) => {
  const steps: Array<[typeof Truck, string, string, string]> = [
    [Truck, "Truck", "Receba em casa", "Seu pedido chega rápido e bem embalado, pronto para usar."],
    [Settings2, "Settings2", "Configure em minutos", "Simples e intuitivo: em poucos passos está tudo pronto."],
    [Sparkles, "Sparkles", "Aproveite todo dia", "Praticidade e qualidade que fazem diferença na sua rotina."],
  ];
  return (
    <section className="bg-white px-6 py-14 sm:px-10">
      <div className="mx-auto max-w-[1180px]">
        <h2 data-editor-type="text" className="text-center text-[28px] font-black tracking-[-0.02em] text-black md:text-[34px]">
          Como funciona em 3 passos
        </h2>
        <div className="mt-9 grid gap-6" style={{ gridTemplateColumns: mobile ? "1fr" : "repeat(3, minmax(0,1fr))" }}>
          {steps.map(([Icon, iconName, title, text], index) => (
            <div key={title} className="relative overflow-hidden rounded-[16px] border border-black/[0.07] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full text-[15px] font-black text-white" style={{ backgroundColor: accent }}>
                  {index + 1}
                </span>
                <Icon data-editor-type="icon" data-editor-icon={iconName} size={26} style={{ color: accent }} />
              </div>
              <h3 data-editor-type="text" className="mt-5 text-[18px] font-bold text-black">{title}</h3>
              <p data-editor-type="text" className="mt-2 text-[14px] leading-relaxed text-black/60">{text}</p>
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

// ---------------------------------------------------------------------------
// Novas seções ricas — todas seguem o padrão data-editor-* (text/image/icon)
// para que o editor atual (elementOverrides) as trate como qualquer outra
// seção editável do template. Nada de rota separada; render inline.
// ---------------------------------------------------------------------------

/** Carrossel de uso — adapta o nº de slots ao total de fotos reais do produto.
 *  Enquanto não houver geração de imagem por IA, evita duplicar a mesma foto. */
export const StoreUsageCarousel = ({ image, productImages, mobile = false }: ContentProps) => {
  const gallery = (productImages && productImages.length > 0 ? productImages : image ? [image] : []).filter(Boolean);
  if (gallery.length === 0) return null;
  const slideDefs: Array<[string, string]> = [
    ["No dia a dia", "Praticidade que se encaixa em qualquer rotina."],
    ["Em qualquer ambiente", "Combina com a sua casa e o seu estilo."],
    ["Pronto pra usar", "Sem complicação, do primeiro momento."],
    ["Feito pra durar", "Qualidade que acompanha o tempo."],
  ];
  // Limita legendas ao número de imagens reais (não repete a foto).
  const slides = slideDefs.slice(0, gallery.length).map(([t, txt], i) => ({ title: t, text: txt, src: gallery[i] }));
  const cols = Math.min(slides.length, mobile ? 2 : 4);
  const layout = slides.length === 1
    ? "1fr"
    : `repeat(${cols}, minmax(0,1fr))`;
  return (
    <section className="bg-white px-6 py-14 sm:px-10">
      <div className="mx-auto max-w-[1180px]">
        <h2 data-editor-type="text" className="text-center text-[28px] font-black tracking-[-0.02em] text-black md:text-[34px]">
          Veja em uso
        </h2>
        <p data-editor-type="text" className="mx-auto mt-2 max-w-[540px] text-center text-[14px] text-black/55">
          Situações reais de quem já leva praticidade pra casa.
        </p>
        <div className="mx-auto mt-8 grid gap-4" style={{ gridTemplateColumns: layout, maxWidth: slides.length === 1 ? 520 : undefined }}>
          {slides.map((s) => (
            <div key={s.title} className="overflow-hidden rounded-[14px] bg-[#f5f4f2]">
              <div className="relative aspect-[4/5] overflow-hidden bg-[#e9e7e2] flex items-center justify-center p-4">
                <img data-editor-type="image" src={s.src} alt="" className="h-full w-full object-contain" />
              </div>
              <div className="p-4">
                <h3 data-editor-type="text" className="text-[14px] font-bold text-black">{s.title}</h3>
                <p data-editor-type="text" className="mt-1 text-[12px] leading-relaxed text-black/55">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/** Banner de urgência — escassez + prazo, com fundo em accent. */
export const StoreUrgencyBanner = ({ accent }: { accent: string }) => (
  <section className="px-6 py-4 sm:px-10" style={{ backgroundColor: accent }}>
    <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-2 text-center text-white sm:flex-row sm:justify-center sm:gap-4">
      <Flame data-editor-type="icon" data-editor-icon="Flame" size={22} className="shrink-0" />
      <span data-editor-type="text" className="text-[15px] font-black uppercase tracking-wide">
        Oferta por tempo limitado
      </span>
      <span data-editor-type="text" className="text-[14px] font-medium text-white/90">
        Estoque acabando · frete grátis nas próximas horas
      </span>
    </div>
  </section>
);

/** Depoimentos de clientes (3 cards com aspas + avatar circular). */
export const StoreTestimonials = ({ image, accent, mobile = false }: ContentProps) => {
  const items = [
    ["Ana P.", "Superou minhas expectativas. Já indiquei pra amigas."],
    ["Rafael M.", "Chegou rápido e é exatamente como na descrição."],
    ["Camila S.", "Uso todo dia. Melhor compra dos últimos meses."],
  ];
  return (
    <section className="bg-[#faf9f7] px-6 py-14 sm:px-10">
      <div className="mx-auto max-w-[1180px]">
        <h2 data-editor-type="text" className="text-center text-[28px] font-black tracking-[-0.02em] text-black md:text-[34px]">
          O que dizem quem já comprou
        </h2>
        <div className="mt-9 grid gap-6" style={{ gridTemplateColumns: mobile ? "1fr" : "repeat(3, minmax(0,1fr))" }}>
          {items.map(([name, text]) => (
            <div key={name} className="rounded-[16px] border border-black/[0.07] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
              <Quote data-editor-type="icon" data-editor-icon="Quote" size={22} style={{ color: accent }} />
              <p data-editor-type="text" className="mt-3 text-[15px] leading-[1.6] text-black/75">"{text}"</p>
              <div className="mt-5 flex items-center gap-3">
                <span className="h-10 w-10 overflow-hidden rounded-full bg-[#e9e7e2]">
                  {image ? <img data-editor-type="image" src={image} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <div>
                  <div data-editor-type="text" className="text-[13px] font-bold text-black">{name}</div>
                  <div className="flex items-center gap-0.5 text-[#f5b800]">
                    {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={12} className="fill-current" />)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/** Checklist "por que vale a pena" — 5 bullets com check em accent. */
export const StoreWhyWorthIt = ({ image, accent, mobile = false }: ContentProps) => {
  const bullets = [
    "Qualidade comprovada em cada detalhe",
    "Entrega rápida para todo o Brasil",
    "Garantia de satisfação ou seu dinheiro de volta",
    "Suporte humano por WhatsApp",
    "Milhares de clientes satisfeitos",
  ];
  return (
    <section className="bg-white px-6 py-14 sm:px-10">
      <div className="mx-auto grid max-w-[1180px] items-center gap-10 lg:gap-14" style={{ gridTemplateColumns: mobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)" }}>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[#f1f1f0] shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
          {image ? <img data-editor-type="image" src={image} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div>
          <h2 data-editor-type="text" className="text-[28px] font-black leading-[1.1] tracking-[-0.02em] text-black md:text-[34px]">
            Por que vale a pena
          </h2>
          <ul className="mt-6 space-y-3">
            {bullets.map((text) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: tint(accent, 0.18) }}>
                  <Check data-editor-type="icon" data-editor-icon="Check" size={14} style={{ color: accent }} strokeWidth={3} />
                </span>
                <span data-editor-type="text" className="text-[15px] leading-[1.55] text-black/80">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

/** FAQ em acordeão — client-side toggle, textos editáveis. */
export const StoreFaqAccordion = ({ accent }: { accent: string }) => {
  const [open, setOpen] = useState<number | null>(0);
  const faqs = [
    ["Quanto tempo demora a entrega?", "Enviamos em até 2 dias úteis e o prazo varia de 3 a 10 dias conforme sua região."],
    ["Posso trocar se não gostar?", "Sim, você tem 30 dias para trocar ou devolver, sem burocracia."],
    ["A compra é segura?", "Todo o pagamento é processado por gateway certificado, com criptografia ponta a ponta."],
    ["Como falo com o suporte?", "Nosso time responde por WhatsApp e e-mail, todos os dias da semana."],
  ];
  return (
    <section className="bg-[#faf9f7] px-6 py-14 sm:px-10">
      <div className="mx-auto max-w-[820px]">
        <h2 data-editor-type="text" className="text-center text-[28px] font-black tracking-[-0.02em] text-black md:text-[34px]">
          Perguntas frequentes
        </h2>
        <div className="mt-8 space-y-3">
          {faqs.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div key={q} className="overflow-hidden rounded-[12px] border border-black/[0.08] bg-white">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span data-editor-type="text" className="text-[15px] font-bold text-black">{q}</span>
                  <ChevronDown size={18} style={{ color: accent, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                </button>
                {isOpen ? (
                  <div className="px-5 pb-5">
                    <p data-editor-type="text" className="text-[14px] leading-[1.6] text-black/65">{a}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

