import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

const chartData = [
  { hour: "00", value: 2400 },
  { hour: "03", value: 3800 },
  { hour: "06", value: 9800 },
  { hour: "09", value: 5900 },
  { hour: "12", value: 7800 },
  { hour: "15", value: 6200 },
  { hour: "18", value: 8300 },
  { hour: "21", value: 4300 },
  { hour: "24", value: 3200 },
];

export function SalesChart() {
  return (
    <div>
      <div className="mb-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">Vendas</p>
        <div className="mb-1 flex items-center gap-3">
          <p className="text-[34px] font-semibold leading-none text-slate-950">4.194.592</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white">
            <TrendingUp size={10} />
            +25.02%
          </span>
        </div>
        <p className="text-xs text-slate-400">Desempenho consolidado nas últimas 24 horas</p>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis 
            dataKey="hour" 
            stroke="#6B7280" 
            style={{ fontSize: "10px" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis hide />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#3B82F6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorBlue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
