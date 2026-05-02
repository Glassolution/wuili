type DashboardInfoPageProps = {
  title: string;
  description: string;
  primaryAction: string;
  stats: Array<{
    label: string;
    value: string;
    hint: string;
  }>;
  items: Array<{
    title: string;
    subtitle: string;
    meta: string;
    status: string;
  }>;
  summary: Array<{
    label: string;
    value: string;
  }>;
};

const statusClassName: Record<string, string> = {
  ok: "bg-success-light text-success",
  warning: "bg-warning/10 text-warning",
  neutral: "bg-muted text-muted-foreground",
};

const statusLabel: Record<string, string> = {
  ok: "Ativo",
  warning: "Revisar",
  neutral: "Pendente",
};

const DashboardInfoPage = ({ title, description, primaryAction, stats, items, summary }: DashboardInfoPageProps) => (
  <div className="space-y-6">
    <div className="card-wuili p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-foreground">{title}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
          {primaryAction}
        </button>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="card-wuili p-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">{stat.label}</p>
          <p className="mt-2 text-2xl font-black text-foreground">{stat.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
        </div>
      ))}
    </div>

    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="card-wuili overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-bold text-foreground">Itens recentes</h3>
        </div>
        <div>
          {items.map((item) => (
            <div key={`${item.title}-${item.meta}`} className="flex items-center justify-between border-b border-border px-5 py-4 last:border-0">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{item.meta}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName[item.status]}`}>
                  {statusLabel[item.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card-wuili p-5">
        <h3 className="text-sm font-bold text-foreground">Resumo</h3>
        <div className="mt-4 space-y-3">
          {summary.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-sm font-semibold text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default DashboardInfoPage;
