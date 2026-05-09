import { AlertTriangle, CheckCircle2, CreditCard } from "lucide-react";

const PagamentosPage = () => (
  <div className="space-y-6">
    <div className="card-wuili p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between dark:border-zinc-800 dark:bg-[#18181B] dark:shadow-none">
      <div>
        <h2 className="text-2xl font-black text-foreground">Pagamentos</h2>
        <p className="text-sm text-muted-foreground mt-1">Monitore métodos de pagamento, taxas de aprovação e falhas no checkout.</p>
      </div>
      <button className="rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-black dark:hover:bg-zinc-100">
        Adicionar método
      </button>
    </div>

    <div className="grid gap-4 md:grid-cols-3">
      {[
        { label: "Taxa de aprovação", value: "—", hint: "Nenhum dado ainda", icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-500" },
        { label: "Falhas", value: "0", hint: "Nenhuma falha registrada", icon: AlertTriangle, cls: "bg-destructive/10 text-destructive" },
        { label: "Chargebacks", value: "—", hint: "Nenhum dado ainda", icon: CreditCard, cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" },
      ].map((s) => (
        <div key={s.label} className="card-wuili p-5 dark:border-zinc-800 dark:bg-[#18181B] dark:shadow-none">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">{s.label}</p>
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${s.cls}`}>
              <s.icon size={15} />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground">{s.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
        </div>
      ))}
    </div>

    <div className="card-wuili p-5 space-y-2 dark:border-zinc-800 dark:bg-[#18181B] dark:shadow-none">
      {[
        { label: "Gateway principal", value: "—" },
        { label: "Tempo de liquidação", value: "—" },
        { label: "Volume mensal", value: "R$ 0,00" },
      ].map((item) => (
        <div key={item.label} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 dark:bg-zinc-900">
          <span className="text-sm text-muted-foreground">{item.label}</span>
          <span className="text-sm font-semibold text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  </div>
);

export default PagamentosPage;
