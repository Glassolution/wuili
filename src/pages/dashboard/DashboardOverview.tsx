import { useState } from "react";
import { ArrowUpRight, Boxes, Package, ShoppingCart, Users, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const chartData = [
  { day: "Seg", value: 820 },
  { day: "Ter", value: 1240 },
  { day: "Qua", value: 980 },
  { day: "Qui", value: 1680 },
  { day: "Sex", value: 2100 },
  { day: "Sáb", value: 1890 },
  { day: "Dom", value: 2961 },
];

const orders = [
  { id: "#4821", product: "Fone TWS", platform: "Mercado Livre", status: "Entregue", value: "R$189,00", date: "hoje 14:32" },
  { id: "#4820", product: "Tênis Casual", platform: "Shopee", status: "Em trânsito", value: "R$127,00", date: "hoje 11:15" },
  { id: "#4819", product: "Kit Skincare", platform: "Minha Loja", status: "Processando", value: "R$89,00", date: "ontem 18:40" },
  { id: "#4818", product: "Relógio Smart", platform: "Mercado Livre", status: "Entregue", value: "R$234,00", date: "ontem 09:22" },
  { id: "#4817", product: "Mochila Urban", platform: "Shopee", status: "Cancelado", value: "R$156,00", date: "2 dias atrás" },
];

const statusColors: Record<string, string> = {
  Entregue: "bg-success-light text-success",
  "Em trânsito": "bg-warning/10 text-warning",
  Processando: "bg-accent text-accent-foreground",
  Cancelado: "bg-destructive/10 text-destructive",
};

const platforms = [
  { name: "Mercado Livre", connected: true },
  { name: "Shopee", connected: true },
  { name: "AliExpress", connected: false },
  { name: "Minha Loja", connected: true },
];

const DashboardOverview = () => {
  const [period, setPeriod] = useState("Semanal");
  const periods = ["Últimas 24h", "Semanal", "Mensal", "Anual"];

  const stats = [
    { icon: Wallet, label: "Lucro", value: "R$ 6.961,19", change: "+24%" },
    { icon: ShoppingCart, label: "Pedidos", value: "47", change: "+18%" },
    { icon: Package, label: "Produtos vendidos", value: "12", change: "+12%" },
    { icon: Users, label: "Clientes", value: "8", change: "+11%" },
  ];

  return (
    <div className="space-y-6">
      {/* Period tabs */}
      <div className="flex gap-2">
        {periods.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              period === p ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-background/80"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card-wuili p-5">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <s.icon size={18} />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-1 text-[11px] font-semibold text-success">
                <ArrowUpRight size={12} />
                {s.change}
              </span>
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">{s.label}</p>
            <p className="mt-2 text-2xl font-black">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chart + Platforms */}
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 card-wuili p-6">
          <h3 className="text-sm font-bold mb-4">Faturamento semanal</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(243, 100%, 68%)" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="hsl(243, 100%, 68%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(216, 30%, 91%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(215, 17%, 47%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(215, 17%, 47%)" />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid hsl(216, 30%, 91%)",
                  borderRadius: "12px",
                  boxShadow: "0 8px 24px rgba(10,37,64,0.1)",
                }}
              />
              <Area type="monotone" dataKey="value" stroke="hsl(243, 100%, 68%)" fill="url(#colorValue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 card-wuili p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Boxes size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold">Plataformas conectadas</h3>
              <p className="text-xs text-muted-foreground">Integrações ativas e prontas para sincronizar</p>
            </div>
          </div>
          <div className="space-y-3">
            {platforms.map((p) => (
              <div key={p.name} className="flex items-center justify-between p-3 rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${p.connected ? "bg-success" : "bg-muted-foreground/40"}`} />
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
                {p.connected ? (
                  <span className="rounded-full bg-success-light px-2.5 py-1 text-xs font-semibold text-success">Conectado</span>
                ) : (
                  <button className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground">
                    Conectar
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="text-center p-2 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground">Lucro</p>
              <p className="text-sm font-bold">R$6.961</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground">Pedidos</p>
              <p className="text-sm font-bold">47</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground">Produtos</p>
              <p className="text-sm font-bold">12</p>
            </div>
          </div>
        </div>
      </div>

      {/* Orders table */}
      <div className="card-wuili overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-bold">Pedidos Recentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["#", "Produto", "Plataforma", "Status", "Valor", "Data"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-muted-foreground">{o.id}</td>
                  <td className="px-5 py-3.5 font-medium">{o.product}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{o.platform}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColors[o.status]}`}>{o.status}</span>
                  </td>
                  <td className="px-5 py-3.5 font-medium">{o.value}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{o.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
