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

const revenueData = [
  { month: "Jan", faturamento: 4200, lucro: 1400 },
  { month: "Fev", faturamento: 5800, lucro: 2100 },
  { month: "Mar", faturamento: 4900, lucro: 1700 },
  { month: "Abr", faturamento: 7200, lucro: 2800 },
  { month: "Mai", faturamento: 6800, lucro: 2400 },
  { month: "Jun", faturamento: 9100, lucro: 3600 },
  { month: "Jul", faturamento: 8400, lucro: 3200 },
  { month: "Ago", faturamento: 11200, lucro: 4500 },
  { month: "Set", faturamento: 10800, lucro: 4200 },
  { month: "Out", faturamento: 13400, lucro: 5600 },
  { month: "Nov", faturamento: 15200, lucro: 6800 },
  { month: "Dez", faturamento: 18900, lucro: 8400 },
];

const ordersData = [
  { day: "Seg", ml: 8, shopee: 5, loja: 3 },
  { day: "Ter", ml: 12, shopee: 7, loja: 4 },
  { day: "Qua", ml: 9, shopee: 6, loja: 2 },
  { day: "Qui", ml: 14, shopee: 9, loja: 5 },
  { day: "Sex", ml: 18, shopee: 11, loja: 6 },
  { day: "Sáb", ml: 15, shopee: 8, loja: 4 },
  { day: "Dom", ml: 20, shopee: 13, loja: 7 },
];

const topProducts = [
  { name: "Fone TWS", sales: 45, max: 45 },
  { name: "Tênis Casual", sales: 38, max: 45 },
  { name: "Kit Skincare", sales: 32, max: 45 },
  { name: "Relógio Smart", sales: 28, max: 45 },
  { name: "Mochila Urbana", sales: 22, max: 45 },
];

const pieData = [
  { name: "Mercado Livre", value: 52 },
  { name: "Shopee", value: 31 },
  { name: "Minha Loja", value: 17 },
];

const pieColors = ["hsl(243, 100%, 68%)", "hsl(25, 95%, 53%)", "hsl(167, 100%, 42%)"];

const kpis = [
  { label: "Ticket médio", value: "R$179,40" },
  { label: "Cancelamentos", value: "3,2%" },
  { label: "Produtos ativos", value: "12" },
  { label: "Recorrentes", value: "34%" },
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
            <Bar dataKey="loja" name="Minha Loja" fill="hsl(167, 100%, 42%)" radius={[4, 4, 0, 0]} />
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
