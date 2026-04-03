import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Search } from "lucide-react";

type Tx = {
  id: string;
  descricao: string;
  canal: string;
  tipo: "entrada" | "saida";
  valor: number;
  status: "conciliado" | "pendente" | "ajuste";
  data: string;
};

const transacoes: Tx[] = [
  { id: "TX-0091", descricao: "Pagamento Shopee", canal: "Shopee", tipo: "entrada", valor: 127, status: "conciliado", data: "Hoje 14:10" },
  { id: "TX-0090", descricao: "Pagamento Mercado Livre", canal: "Mercado Livre", tipo: "entrada", valor: 234, status: "conciliado", data: "Hoje 13:55" },
  { id: "TX-0089", descricao: "Tarifa logística", canal: "Transportadora", tipo: "saida", valor: 18, status: "conciliado", data: "Hoje 13:48" },
  { id: "TX-0088", descricao: "Ajuste manual", canal: "Interno", tipo: "saida", valor: 45, status: "ajuste", data: "Ontem" },
  { id: "TX-0087", descricao: "Pagamento Minha Loja", canal: "Minha Loja", tipo: "entrada", valor: 89, status: "conciliado", data: "Ontem" },
  { id: "TX-0086", descricao: "Taxa marketplace", canal: "Shopee", tipo: "saida", valor: 12, status: "conciliado", data: "Ontem" },
  { id: "TX-0085", descricao: "Pagamento Mercado Livre", canal: "Mercado Livre", tipo: "entrada", valor: 189, status: "conciliado", data: "2 dias atrás" },
  { id: "TX-0084", descricao: "Estorno pedido #4817", canal: "Shopee", tipo: "saida", valor: 156, status: "pendente", data: "2 dias atrás" },
  { id: "TX-0083", descricao: "Pagamento Minha Loja", canal: "Minha Loja", tipo: "entrada", valor: 278, status: "conciliado", data: "3 dias atrás" },
  { id: "TX-0082", descricao: "Tarifa logística", canal: "Transportadora", tipo: "saida", valor: 22, status: "conciliado", data: "3 dias atrás" },
];

const statusCls: Record<string, string> = {
  conciliado: "bg-success-light text-success",
  pendente: "bg-warning/10 text-warning",
  ajuste: "bg-destructive/10 text-destructive",
};
const statusLabel: Record<string, string> = {
  conciliado: "Conciliado",
  pendente: "Pendente",
  ajuste: "Ajuste",
};

const filters = ["Todas", "Entradas", "Saídas", "Pendentes"];

const TransacoesPage = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todas");

  const filtered = transacoes.filter((t) => {
    const matchSearch = t.descricao.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "Todas" ||
      (filter === "Entradas" && t.tipo === "entrada") ||
      (filter === "Saídas" && t.tipo === "saida") ||
      (filter === "Pendentes" && t.status === "pendente");
    return matchSearch && matchFilter;
  });

  const totalEntradas = transacoes.filter((t) => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0);
  const totalSaidas = transacoes.filter((t) => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);

  return (
    <div className="space-y-6">
      <div className="card-wuili p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-foreground">Transações</h2>
          <p className="text-sm text-muted-foreground mt-1">Histórico completo de entradas, saídas e conciliação financeira.</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
          <Download size={15} /> Exportar extrato
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-wuili p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">Entradas</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-success-light text-success">
              <ArrowDownLeft size={15} />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground">R$ {totalEntradas.toLocaleString("pt-BR")},00</p>
          <p className="mt-1 text-xs text-muted-foreground">Últimos 30 dias</p>
        </div>
        <div className="card-wuili p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">Saídas</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <ArrowUpRight size={15} />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground">R$ {totalSaidas.toLocaleString("pt-BR")},00</p>
          <p className="mt-1 text-xs text-muted-foreground">Taxas, frete e custos operacionais</p>
        </div>
        <div className="card-wuili p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">Conciliação</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Search size={15} />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground">98,7%</p>
          <p className="mt-1 text-xs text-muted-foreground">Operações validadas automaticamente</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Buscar por descrição ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card-wuili overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["ID", "Descrição", "Canal", "Tipo", "Valor", "Status", "Data"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground font-medium">{t.id}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{t.descricao}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.canal}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 w-fit text-xs font-semibold ${t.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                      {t.tipo === "entrada" ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                      {t.tipo === "entrada" ? "Entrada" : "Saída"}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-bold ${t.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                    {t.tipo === "entrada" ? "+" : "-"}R${t.valor}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusCls[t.status]}`}>
                      {statusLabel[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{t.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransacoesPage;
