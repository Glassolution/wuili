import { Sparkles } from "lucide-react";

interface BannerIAProps {
  productsCount?: number;
}

export function BannerIA({ productsCount = 12 }: BannerIAProps) {
  return (
    <div className="flex items-center justify-between rounded-[26px] bg-slate-900 px-5 py-4 text-white shadow-[0_16px_32px_rgba(15,23,42,0.14)]">
      <div className="flex items-center gap-4">
        <div className="rounded-2xl bg-white/10 p-3">
          <Sparkles size={20} />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">IA Insights</p>
          <p className="mt-1 text-lg font-semibold leading-tight">
            A IA encontrou <span className="font-bold">{productsCount}</span> produtos com margem acima de 50% hoje
          </p>
        </div>
      </div>
      <button className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100">
        Ver Produtos
      </button>
    </div>
  );
}
