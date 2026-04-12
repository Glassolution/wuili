import { useState } from "react";
import { Search, ChevronDown, MoreHorizontal, ArrowRight, Plus, LayoutGrid, Table } from "lucide-react";

type StockLevel = "High" | "Low" | "Out of Stock";
type ProductStatus = "Active" | "Draft" | "Archived";
type ProductType = "Dropship" | "Inventory";

type Product = {
  id: string;
  name: string;
  sku: string;
  image: string;
  status: ProductStatus;
  type: ProductType;
  tags: string[];
  retail: string;
  wholesale: string;
  stock: number | null;
  stockLevel: StockLevel;
  variants?: number;
};

const products: Product[] = [
  { id: "1", name: "Macbook Pro 14 Inch 512GB...", sku: "Mac-5006", image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=80&h=80&fit=crop", status: "Active", type: "Dropship", tags: ["Apple", "Electronic", "+2"], retail: "$180.00–$220.00", wholesale: "$80.00–$50.00", stock: 210, stockLevel: "High", variants: 6 },
  { id: "2", name: "Logitech MX Mechanical Mini...", sku: "Logitect-9920", image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=80&h=80&fit=crop", status: "Active", type: "Inventory", tags: ["Mechanical", "Keyboard"], retail: "$120.00", wholesale: "$40.00", stock: 12, stockLevel: "Low" },
  { id: "3", name: "JBL Go 2 Portable Speaker Bl...", sku: "JBL-9928", image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=80&h=80&fit=crop", status: "Draft", type: "Dropship", tags: ["Speaker", "Electronic", "+2"], retail: "$180.00", wholesale: "$80.00", stock: 341, stockLevel: "High" },
  { id: "4", name: "Gopro hero 7", sku: "Gopro-9912", image: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=80&h=80&fit=crop", status: "Draft", type: "Dropship", tags: ["Camera", "Gopro", "+2"], retail: "$45.00", wholesale: "$5.00", stock: null, stockLevel: "Out of Stock" },
  { id: "5", name: "DJI Air 3 Fly More Combo (DJ...", sku: "DJI-5006", image: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=80&h=80&fit=crop", status: "Active", type: "Dropship", tags: ["DJI", "Electronic"], retail: "$85.00–$120.00", wholesale: "$5.00–$10.00", stock: 32, stockLevel: "Low", variants: 8 },
  { id: "6", name: "Logitech C920 Webcam PRO...", sku: "Logitech-5006", image: "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=80&h=80&fit=crop", status: "Draft", type: "Dropship", tags: ["Camera", "Accessories"], retail: "$60.00–$70.00", wholesale: "$10.00–$20.00", stock: null, stockLevel: "Out of Stock" },
  { id: "7", name: "Thinkplus LP1 Headset Earph...", sku: "LP1-8821", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=80&h=80&fit=crop", status: "Active", type: "Dropship", tags: ["Headset", "Electronic", "+2"], retail: "$100.00–$140.00", wholesale: "$20.00–$30.00", stock: 55, stockLevel: "High" },
  { id: "8", name: "JBL Charge 5 - Portable Blue...", sku: "JBL-1019", image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=80&h=80&fit=crop", status: "Active", type: "Dropship", tags: ["JBL", "Electronic", "+2"], retail: "$100.00", wholesale: "$30.00", stock: 88, stockLevel: "High" },
  { id: "9", name: "Acer Aspire 5 Spin 14\" A5SP1...", sku: "Acer-9829", image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=80&h=80&fit=crop", status: "Active", type: "Dropship", tags: ["Laptop", "Electronic", "+2"], retail: "$400.00–$500.00", wholesale: "$100.00–$150.00", stock: 15, stockLevel: "Low" },
];

const statusCls: Record<ProductStatus, string> = {
  Active: "bg-green-100 text-green-700",
  Draft: "bg-gray-100 text-gray-500",
  Archived: "bg-orange-100 text-orange-600",
};

const statusLabel: Record<ProductStatus, string> = {
  Active: "Ativo",
  Draft: "Não publicado",
  Archived: "Arquivado",
};

const stockBarCls: Record<StockLevel, string> = {
  High: "bg-green-500",
  Low: "bg-red-500",
  "Out of Stock": "bg-red-500",
};

const tabs: Array<{ label: string; value: string }> = [
  { label: "Todos", value: "all" },
  { label: "Ativo", value: "Active" },
  { label: "Não publicado", value: "Draft" },
  { label: "Arquivado", value: "Archived" },
];

const ProductsPage = () => {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = products.filter((p) => {
    const matchTab = tab === "all" || p.status === tab;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-foreground">Produtos</h2>
          <button className="text-muted-foreground hover:text-foreground"><MoreHorizontal size={16} /></button>
          <button className="text-muted-foreground hover:text-foreground"><ArrowRight size={16} /></button>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors">
          <Plus size={15} /> Adicionar Produto
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.value
                ? "border-orange-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button className="flex items-center gap-1 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground border-b-2 border-transparent -mb-px">
          <Plus size={13} /> Visualização
        </button>
        <div className="ml-auto flex items-center gap-2 pb-1">
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            Configurar Visualização
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <button className="rounded p-1 bg-muted"><LayoutGrid size={13} /></button>
            <button className="rounded p-1 text-muted-foreground hover:bg-muted"><Table size={13} /></button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-44 pl-8 pr-3 py-1.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Buscar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {["Categoria", "Tipo", "Filtro Avançado"].map((f) => (
          <button key={f} className="flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
            {f} <ChevronDown size={12} />
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-background p-4 space-y-3 hover:shadow-sm transition-shadow">
            {/* Top row */}
            <div className="flex items-start gap-3">
              <img src={p.image} alt={p.name} className="h-12 w-12 rounded-xl object-cover shrink-0 border border-border" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <button className="text-muted-foreground shrink-0"><MoreHorizontal size={14} /></button>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">SKU {p.sku}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusCls[p.status]}`}>
                    {p.status === "Active" && <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 mr-1" />}
                    {statusLabel[p.status]}
                  </span>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              {p.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{tag}</span>
              ))}
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground flex items-center gap-1">
                {p.type === "Dropship" ? "⬡" : "▦"} {p.type}
              </span>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground">Preço de Venda</p>
                <p className="text-sm font-semibold text-foreground">{p.retail}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Lucro</p>
                <p className="text-sm font-semibold text-foreground">{p.wholesale}</p>
              </div>
            </div>

            {/* Stock + actions */}
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <div className="flex items-center gap-2">
                {p.stockLevel === "Out of Stock" ? (
                  <span className="text-xs font-semibold text-red-500">Sem estoque</span>
                ) : (
                  <>
                    <div className={`h-1.5 w-12 rounded-full ${stockBarCls[p.stockLevel]}`} />
                    <span className="text-xs text-muted-foreground">{p.stock} em estoque · {p.stockLevel === "High" ? "Alto" : "Baixo"}</span>
                  </>
                )}
                {p.variants && (
                  <span className="text-xs text-muted-foreground ml-1">Variantes ({p.variants})</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {p.stockLevel === "Out of Stock" && (
                  <button className="rounded-xl bg-foreground px-3 py-1.5 text-xs font-bold text-background hover:opacity-90 transition-opacity">
                    Repor estoque
                  </button>
                )}
                <button className="flex h-7 w-7 items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors">
                  <ArrowRight size={12} className="text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductsPage;
