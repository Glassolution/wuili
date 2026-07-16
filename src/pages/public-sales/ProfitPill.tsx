import { TrendingUp } from "lucide-react";
import { computeProfit, formatBRL } from "./salesPageData";

/**
 * Pill flutuante que mostra ao dono da loja o lucro estimado para o preço atual.
 * Só é renderizada quando `visible` (preview + dono).
 */
export const ProfitPill = ({
  price,
  cost,
  visible,
  variant = "inline",
}: {
  price: number;
  cost: number | null | undefined;
  visible: boolean;
  variant?: "inline" | "floating";
}) => {
  if (!visible) return null;
  const info = computeProfit(price, cost);
  if (!info) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-dashed border-black/15 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-black/50 ${variant === "floating" ? "shadow-sm" : ""}`}
        title="Cadastre o custo do produto no catálogo para visualizar seu lucro."
      >
        <TrendingUp size={12} /> Lucro indisponível
      </div>
    );
  }
  const positive = info.profit > 0;
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${positive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"} ${variant === "floating" ? "shadow-sm" : ""}`}
      title="Visível apenas para você (dono da loja)."
    >
      <TrendingUp size={12} strokeWidth={2.2} />
      Lucro {formatBRL(info.profit)} · {info.margin.toFixed(0)}%
    </div>
  );
};
