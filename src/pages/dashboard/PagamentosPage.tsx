import { AlertTriangle, CheckCircle2, CreditCard, QrCode, Smartphone } from "lucide-react";

const metodos: { nome: string; icon: typeof import("lucide-react").QrCode; participacao: string; aprovacao: string; status: string; detalhe: string }[] = [];
const falhas: { id: string; motivo: string; metodo: string; valor: string; data: string }[] = [];

const PagamentosPage = () => (
  <div className="space-y-6">
    <div className="card-wuili p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-2xl font-black text-foreground">Pagamentos</h2>
        <p className="text-sm text-muted-foreground mt-1">Monitore métodos de pagamento, taxas de aprovação e falhas no checkout.</p>
      </div>
      <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
        Adicionar método
      </button>
    </div>

    {/* Stats */}
    <div className="grid gap-4 md:grid-cols-3">
      {[
        { label: "Taxa de aprovação", value: "—", hint: "Nenhum dado ainda", icon: CheckCircle2, cls: "bg-success-light text-success" },
        { label: "Falhas", value: "0", hint: "Nenhuma falha registrada", icon: AlertTriangle, cls: "bg-destructive/10 text-destructive" },
        { label: "Chargebacks", value: "—", hint: "Nenhum dado ainda", icon: CreditCard, cls: "bg-primary/10 text-primary" },
      ].map((s) => (
        <div key={s.label} className="card-wuili p-5">
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

    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      {/* Métodos */}
      <div className="card-wuili overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-bold text-foreground">Métodos ativos</h3>
        </div>
        {metodos.map((m) => (
          <div key={m.nome} className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <m.icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{m.nome}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusCls[m.status]}`}>
                  {statusLabel[m.status]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{m.detalhe}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-foreground">{m.aprovacao}</p>
              <p className="text-xs text-muted-foreground">{m.participacao} do total</p>
            </div>
          </div>
        ))}
      </div>

      {/* Falhas recentes + resumo */}
      <div className="space-y-4">
        <div className="card-wuili overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-bold text-foreground">Falhas recentes</h3>
          </div>
          {falhas.map((f) => (
            <div key={f.id} className="flex items-start justify-between border-b border-border px-5 py-3 last:border-0">
              <div>
                <p className="text-xs font-semibold text-foreground">{f.id} · {f.metodo}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{f.motivo}</p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-xs font-bold text-destructive">{f.valor}</p>
                <p className="text-[11px] text-muted-foreground">{f.data}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="card-wuili p-5 space-y-2">
          {[
            { label: "Gateway principal", value: "—" },
            { label: "Tempo de liquidação", value: "—" },
            { label: "Volume mensal", value: "R$ 0,00" },
          ].map((item) => (
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

export default PagamentosPage;
