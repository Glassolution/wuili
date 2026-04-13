import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

import { mockRevenueData, mockOrdersData, mockResumoLoja, mockResumoCategoria, mockOrders, mockStats } from "@/lib/mockData";

const revenueData = mockRevenueData;
const ordersData = mockResumoLoja.map(l => ({ day: l.loja, ml: l.pedidos, shopee: 0 }));

const topProducts = (() => {
  const counts: Record<string, number> = {};
  mockOrders.forEach(o => { counts[o.product] = (counts[o.product] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = sorted[0]?.[1] ?? 1;
  return sorted.map(([name, sales]) => ({ name, sales, max }));
})();

const pieData = mockResumoLoja.map(l => ({ name: l.loja, value: Math.round(l.receita / mockStats.totalRevenue * 100) }));
const pieColors = ["hsl(243, 100%, 68%)", "hsl(25, 95%, 53%)", "hsl(167, 100%, 42%)", "hsl(200, 80%, 50%)", "hsl(340, 80%, 55%)", "hsl(60, 80%, 45%)", "hsl(280, 70%, 55%)"];

const ticketMedio = mockStats.totalOrders > 0 ? (mockStats.totalRevenue / mockStats.totalOrders).toFixed(2) : "0,00";
const kpis = [
  { label: "Ticket médio", value: `R$${Number(ticketMedio).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
  { label: "Total pedidos", value: mockStats.totalOrders.toString() },
  { label: "Receita total", value: `R$${mockStats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
  { label: "Lucro total", value: `R$${mockStats.totalProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
];

const tooltipStyle = {
  background: "white",
  border: "1px solid hsl(216, 30%, 91%)",
  borderRadius: "12px",
  boxShadow: "0 8px 24px rgba(10,37,64,0.1)",
};

const ReportsPage = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((k) => (
        <div key={k.label} className="card-wuili p-5">
          <p className="text-xs text-muted-foreground font-medium">{k.label}</p>
          <p className="text-2xl font-black mt-1">{k.value}</p>
        </div>
      ))}
    </div>

    <div className="grid lg:grid-cols-2 gap-6">
      {/* Revenue vs Profit */}
      <div className="card-wuili p-6">
        <h3 className="text-sm font-bold mb-4">Faturamento vs Lucro</h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={revenueData}>
            <defs>
              <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(243, 100%, 68%)" stopOpacity={0.1} />
                <stop offset="95%" stopColor="hsl(243, 100%, 68%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gLuc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(167, 100%, 42%)" stopOpacity={0.1} />
                <stop offset="95%" stopColor="hsl(167, 100%, 42%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(216, 30%, 91%)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Area type="monotone" dataKey="faturamento" stroke="hsl(243, 100%, 68%)" fill="url(#gFat)" strokeWidth={2} />
            <Area type="monotone" dataKey="lucro" stroke="hsl(167, 100%, 42%)" fill="url(#gLuc)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Orders by platform */}
      <div className="card-wuili p-6">
        <h3 className="text-sm font-bold mb-4">Pedidos por plataforma</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={ordersData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(216, 30%, 91%)" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey="ml" name="Mercado Livre" fill="hsl(243, 100%, 68%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="shopee" name="Shopee" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top products */}
      <div className="card-wuili p-6">
        <h3 className="text-sm font-bold mb-4">Top 5 produtos mais vendidos</h3>
        <div className="space-y-4">
          {topProducts.map((p, i) => (
            <div key={p.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{i + 1}. {p.name}</span>
                <span className="text-sm font-bold text-primary">{p.sales} vendas</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(p.sales / p.max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Distribution pie */}
      <div className="card-wuili p-6">
        <h3 className="text-sm font-bold mb-4">Distribuição por plataforma</h3>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name} ${value}%`}>
              {pieData.map((_, i) => (
                <Cell key={i} fill={pieColors[i]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

export default ReportsPage;
