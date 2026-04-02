import { useState } from "react";
import { Search, Eye, FileText } from "lucide-react";

const allOrders = [
  { id: "#4821", product: "Fone TWS", client: "João M.", platform: "Mercado Livre", status: "Entregue", value: 189, profit: 63, date: "hoje 14:32" },
  { id: "#4820", product: "Tênis Casual", client: "Maria S.", platform: "Shopee", status: "Em trânsito", value: 127, profit: 47, date: "hoje 11:15" },
  { id: "#4819", product: "Kit Skincare", client: "Ana L.", platform: "Minha Loja", status: "Processando", value: 89, profit: 38, date: "ontem 18:40" },
  { id: "#4818", product: "Relógio Smart", client: "Pedro R.", platform: "Mercado Livre", status: "Entregue", value: 234, profit: 82, date: "ontem 09:22" },
  { id: "#4817", product: "Mochila Urban", client: "Lucas F.", platform: "Shopee", status: "Cancelado", value: 156, profit: 0, date: "2 dias atrás" },
  { id: "#4816", product: "Óculos Retrô", client: "Carla D.", platform: "Minha Loja", status: "Entregue", value: 78, profit: 34, date: "2 dias atrás" },
  { id: "#4815", product: "Mouse Sem Fio", client: "Marcos V.", platform: "Mercado Livre", status: "Em trânsito", value: 67, profit: 28, date: "3 dias atrás" },
  { id: "#4814", product: "Capa iPhone", client: "Julia A.", platform: "Shopee", status: "Entregue", value: 39, profit: 22, date: "3 dias atrás" },
  { id: "#4813", product: "Perfume Importado", client: "Fernanda K.", platform: "Mercado Livre", status: "Processando", value: 189, profit: 71, date: "4 dias atrás" },
  { id: "#4812", product: "Tênis Feminino", client: "Camila B.", platform: "Shopee", status: "Em trânsito", value: 144, profit: 52, date: "4 dias atrás" },
  { id: "#4811", product: "Câmera Seg.", client: "Ricardo P.", platform: "Minha Loja", status: "Entregue", value: 278, profit: 94, date: "5 dias atrás" },
  { id: "#4810", product: "Suporte Notebook", client: "Amanda G.", platform: "Mercado Livre", status: "Entregue", value: 89, profit: 31, date: "5 dias atrás" },
  { id: "#4809", product: "Kit Maquiagem", client: "Beatriz N.", platform: "Shopee", status: "Cancelado", value: 119, profit: 0, date: "6 dias atrás" },
  { id: "#4808", product: "Luminária LED", client: "Diego S.", platform: "Minha Loja", status: "Entregue", value: 97, profit: 38, date: "6 dias atrás" },
  { id: "#4807", product: "Caixa de Som", client: "Thiago M.", platform: "Mercado Livre", status: "Processando", value: 167, profit: 57, date: "7 dias atrás" },
];

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
