import { HelpCircle, TrendingDown, TrendingUp } from "lucide-react";

interface MiniMetric {
  label: string;
  value: number | string;
  variation: number;
}

interface MiniMetricsProps {
  metrics: MiniMetric[];
}

export function MiniMetrics({ metrics }: MiniMetricsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
      {metrics.map((metric, idx) => (
        <div key={idx} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="mb-2 flex items-center gap-1">
            <p className="text-[11px] text-slate-500">{metric.label}</p>
            <HelpCircle size={12} className="text-slate-400" />
          </div>
          <p className="mb-1 text-[28px] font-semibold leading-none text-slate-950">{metric.value}</p>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">vs ontem</span>
            <span className={`flex items-center gap-0.5 font-semibold ${metric.variation > 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {metric.variation > 0 ? (
                <TrendingUp size={10} />
              ) : (
                <TrendingDown size={10} />
              )}
              ({metric.variation > 0 ? "+" : ""}{metric.variation}%)
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
