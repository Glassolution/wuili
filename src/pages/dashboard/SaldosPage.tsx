import { ArrowDownLeft, ArrowUpRight, Building2, Clock, TrendingUp } from "lucide-react";

const repasses = [
  { canal: "Mercado Livre", valor: "R$ 4.200,00", status: "ok", data: "Hoje" },
  { canal: "Shopee", valor: "R$ 1.840,00", status: "ok", data: "Hoje" },
  { canal: "Minha Loja", valor: "R$ 620,00", status: "warning", data: "Ontem" },
  { canal: "Reserva chargeback", valor: "R$ 890,00", status: "neutral", data: "Em análise" },
];

const statusCls: Record<string, string> = {
  ok: "bg-success-light text-success",
  warning: "bg-warning/10 text-warning",
  neutral: "bg-muted text-muted-foreground",
};
const statusLabel: Record<string, string> = {
  ok: "Confirmado",
  warning: "Pendente",
  neutral: "Reservado",
};

const SaldosPage = () => (
  <div className="space-y-6">
    {/* Header */}
    <div className="card-wuili p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-2xl font-black text-foreground">Saldos</h2>
        <p className="text-sm text-muted-foreground mt-1">Visão do seu dinheiro disponível, a liberar e reservado em todos os canais.</p>
      </div>
      <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
        Solicitar repasse
      </button>
    </div>

    {/* Stats */}
    <div className="grid gap-4 md:grid-cols-3">
      <div className="card-wuili p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">Disponível</p>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-success-light text-success">
            <TrendingUp size={15} />
          </div>
        </div>
        <p className="text-2xl font-black text-foreground">R$ 12.480,00</p>
        <p className="mt-1 text-xs text-muted-foreground">Atualizado hoje às 14:32</p>
      </div>
      <div className="card-wuili p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">A liberar</p>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <Clock size={15} />
          </div>
        </div>
        <p className="text-2xl font-black text-foreground">R$ 3.240,00</p>
        <p className="mt-1 text-xs text-muted-foreground">Previsão para os próximos 3 dias</p>
      </div>
      <div className="card-wuili p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">Reservado</p>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Building2 size={15} />
          </div>
        </div>
        <p className="text-2xl font-black text-foreground">R$ 890,00</p>
        <p className="mt-1 text-xs text-muted-foreground">Valores em análise e estorno</p>
      </div>
    </div>

    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      {/* Repasses por canal */}
      <div className="card-wuili overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-bold text-foreground">Repasses por canal</h3>
        </div>
        {repasses.map((r) => (
          <div key={r.canal} className="flex items-center justify-between border-b border-border px-5 py-4 last:border-0">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Building2 size={15} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{r.canal}</p>
                <p className="text-xs text-muted-foreground">{r.data}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-foreground">{r.valor}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusCls[r.status]}`}>
                {statusLabel[r.status]}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Conta e próximo repasse */}
      <div className="card-wuili p-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground">Conta vinculada</h3>
        <div className="rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Banco Inter</p>
            <p className="text-xs text-muted-foreground">Ag. 0001 · CC ••••4821</p>
          </div>
        </div>

        <div className="space-y-2">
          {[
            { label: "Último repasse", value: "R$ 4.200,00" },
            { label: "Próxima previsão", value: "Amanhã" },
            { label: "Ciclo de repasse", value: "D+1 útil" },
            { label: "Total repasses (mês)", value: "R$ 18.660,00" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-sm font-semibold text-foreground">{item.value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <button className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-muted py-2.5 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors">
            <ArrowDownLeft size={13} /> Receber
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
            <ArrowUpRight size={13} /> Transferir
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default SaldosPage;
