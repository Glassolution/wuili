import { useState } from "react";
import { Search, Eye, FileText } from "lucide-react";
import { mockOrders } from "@/lib/mockData";

const allOrders = mockOrders;

const statusColors: Record<string, string> = {
  Entregue: "bg-success-light text-success",
  "Em trânsito": "bg-warning/10 text-warning",
  Processando: "bg-accent text-accent-foreground",
  Cancelado: "bg-destructive/10 text-destructive",
};

const statuses = ["Todos", "Processando", "Em trânsito", "Entregue", "Cancelado"];

const OrdersPage = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");

  const filtered = allOrders.filter((o) => {
    const matchSearch = o.product.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search);
    const matchStatus = status === "Todos" || o.status === status;
    return matchSearch && matchStatus;
  });

  const totalOrders = allOrders.length;
  const totalRevenue = allOrders.reduce((s, o) => s + o.value, 0);
  const totalProfit = allOrders.reduce((s, o) => s + o.profit, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total pedidos", value: totalOrders.toString() },
          { label: "Receita", value: `R$${totalRevenue.toLocaleString("pt-BR")}` },
          { label: "Lucro líquido", value: `R$${totalProfit.toLocaleString("pt-BR")}` },
        ].map((s) => (
          <div key={s.label} className="card-wuili p-5">
            <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
            <p className="text-2xl font-black mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Buscar pedidos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                status === s ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card-wuili overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["#", "Produto", "Cliente", "Plataforma", "Status", "Valor", "Lucro", "Data", "Ações"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-muted-foreground">{o.id}</td>
                  <td className="px-4 py-3 font-medium">{o.product}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.client}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.platform}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColors[o.status]}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">R${o.value}</td>
                  <td className="px-4 py-3 font-medium text-primary">R${o.profit}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{o.date}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Eye size={14} className="text-muted-foreground" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors"><FileText size={14} className="text-muted-foreground" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;
