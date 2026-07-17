import type { CSSProperties } from "react";
import { RefreshCcw, ShieldCheck, Truck } from "lucide-react";

// Seções de conversão compartilhadas pelos templates de produto (bundles,
// pagamento e garantias). São HTML/CSS puro — sem estado React — para que:
//  1. o editor consiga editar cada texto/ícone pelo sistema de overrides de DOM;
//  2. a seleção de bundle e afins não re-renderize (o que apagaria os overrides
//     aplicados imperativamente sobre o DOM já montado).
//
// Números são placeholders editáveis: os preços dos bundles derivam do preço
// real do produto; nenhuma avaliação/contagem específica é fabricada.

const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type BundleTier = {
  qty: string;
  note: string;
  total: number;
  off: number;
  popular?: boolean;
};

/** "Compre mais e economize" — 3 níveis com preço derivado do preço unitário.
 *  Seleção via radio nativo + CSS (`:has`), sem estado React. */
export const StoreBundleOffers = ({ price, accent }: { price: number; accent: string }) => {
  const tiers: BundleTier[] = [
    { qty: "1 unidade", note: "Preço padrão", total: price, off: 0 },
    { qty: "2 unidades", note: "Mais popular", total: price * 2 * 0.9, off: 10, popular: true },
    { qty: "3 unidades", note: "Melhor oferta", total: price * 3 * 0.85, off: 15 },
  ];

  return (
    <div className="mt-6" style={{ "--velo-accent": accent } as CSSProperties}>
      <style>
        {`
          .velo-bundle-opt { border: 1.5px solid rgba(0,0,0,0.1); transition: border-color .15s, background-color .15s; }
          .velo-bundle-opt:hover { border-color: rgba(0,0,0,0.22); }
          .velo-bundle-opt:has(input:checked) { border-color: var(--velo-accent); background: rgba(0,0,0,0.02); }
          .velo-bundle-radio::after { content:""; position:absolute; inset:3px; border-radius:9999px; background: var(--velo-accent); transform: scale(0); transition: transform .15s; }
          .velo-bundle-opt:has(input:checked) .velo-bundle-radio { border-color: var(--velo-accent); }
          .velo-bundle-opt:has(input:checked) .velo-bundle-radio::after { transform: scale(1); }
        `}
      </style>
      <p data-editor-type="text" className="text-[13px] font-bold uppercase tracking-[0.14em] text-black/50">
        Compre mais e economize
      </p>
      <div className="mt-3 space-y-2.5">
        {tiers.map((tier, index) => (
          <label key={tier.qty} className="velo-bundle-opt relative flex cursor-pointer items-center gap-3 rounded-[12px] px-4 py-3.5">
            <input type="radio" name="velo-bundle" defaultChecked={index === 1} className="sr-only" />
            <span className="velo-bundle-radio relative h-5 w-5 shrink-0 rounded-full border-2 border-black/20" />
            <span className="min-w-0 flex-1">
              <span data-editor-type="text" className="block text-[14px] font-bold text-black">{tier.qty}</span>
              <span data-editor-type="text" className="block text-[12px] text-black/50">{tier.note}</span>
            </span>
            {tier.popular ? (
              <span data-editor-type="text" className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ backgroundColor: accent }}>
                Popular
              </span>
            ) : null}
            {tier.off > 0 ? (
              <span data-editor-type="text" className="text-[12px] font-bold" style={{ color: accent }}>
                -{tier.off}%
              </span>
            ) : null}
            <span data-editor-type="text" className="text-[15px] font-black text-black">{formatBRL(tier.total)}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

/** Formas de pagamento aceitas (mercado brasileiro). Texto editável. */
export const StorePaymentRow = () => {
  const methods = ["Pix", "Visa", "Mastercard", "Elo", "Boleto"];
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <span data-editor-type="text" className="text-[12px] font-medium text-black/45">Pagamento:</span>
      {methods.map((method) => (
        <span key={method} data-editor-type="text" className="rounded-[6px] border border-black/10 bg-white px-2.5 py-1 text-[11px] font-bold text-black/70">
          {method}
        </span>
      ))}
    </div>
  );
};

/** Cards de garantia editáveis (ícone + título + descrição). */
export const StoreGuaranteeCards = ({ accent }: { accent: string }) => {
  const cards: Array<[typeof ShieldCheck, string, string, string]> = [
    [ShieldCheck, "ShieldCheck", "Compra 100% segura", "Seus dados protegidos em todo o processo."],
    [RefreshCcw, "RefreshCcw", "Devolução facilitada", "7 dias para trocar ou devolver sem burocracia."],
    [Truck, "Truck", "Envio para todo o Brasil", "Acompanhe o pedido pelo código de rastreio."],
  ];
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {cards.map(([Icon, iconName, title, text]) => (
        <div key={title} className="flex items-start gap-3 rounded-[12px] border border-black/10 bg-[#faf9f8] p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white" style={{ color: accent }}>
            <Icon data-editor-type="icon" data-editor-icon={iconName} size={17} />
          </span>
          <span className="min-w-0">
            <span data-editor-type="text" className="block text-[13px] font-bold leading-tight text-black">{title}</span>
            <span data-editor-type="text" className="mt-0.5 block text-[12px] leading-snug text-black/55">{text}</span>
          </span>
        </div>
      ))}
    </div>
  );
};
