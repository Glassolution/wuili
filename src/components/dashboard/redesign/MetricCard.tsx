interface MetricValue {
  label: string;
  value: number | string;
}

interface MetricCardProps {
  title: string;
  values: [MetricValue, MetricValue];
  icon?: React.ReactNode;
}

export function MetricCard({ title, values, icon }: MetricCardProps) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-3.5 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      {/* Header com ícone e título */}
      <div className="mb-2.5 flex items-center gap-2">
        {icon && (
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-slate-900">
            <span className="text-[11px] text-white">{icon}</span>
          </div>
        )}
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</h3>
      </div>

      {/* Valores */}
      <div className="grid grid-cols-2 gap-2.5">
        {values.map((metric, idx) => (
          <div key={idx}>
            <p className="mb-1 text-[11px] leading-4 text-slate-500">{metric.label}</p>
            <p className="text-[1.7rem] font-semibold leading-none text-slate-950">{metric.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
