import { useState } from "react";
import { Search } from "lucide-react";

const products = [
  { name: "Fone Bluetooth TWS", supplier: "TechImport BR", profit: 63, price: 89, cat: "Eletrônicos" },
  { name: "Tênis Casual Masculino", supplier: "ModaFlex SP", profit: 47, price: 127, cat: "Moda" },
  { name: "Kit Skincare Coreano", supplier: "BeautyAsia", profit: 38, price: 89, cat: "Beleza" },
  { name: "Relógio Smartwatch", supplier: "TechImport BR", profit: 82, price: 234, cat: "Eletrônicos" },
  { name: "Mochila Urbana", supplier: "UrbanBags", profit: 55, price: 156, cat: "Moda" },
  { name: "Óculos de Sol Retrô", supplier: "StyleVision", profit: 34, price: 78, cat: "Moda" },
  { name: "Mouse Sem Fio", supplier: "TechImport BR", profit: 28, price: 67, cat: "Eletrônicos" },
  { name: "Capa iPhone 15", supplier: "CaseBR", profit: 22, price: 39, cat: "Eletrônicos" },
  { name: "Perfume Importado", supplier: "BeautyAsia", profit: 71, price: 189, cat: "Beleza" },
  { name: "Tênis Feminino", supplier: "ModaFlex SP", profit: 52, price: 144, cat: "Moda" },
  { name: "Câmera de Segurança", supplier: "TechImport BR", profit: 94, price: 278, cat: "Eletrônicos" },
  { name: "Suporte Notebook", supplier: "OfficeGear", profit: 31, price: 89, cat: "Casa" },
  { name: "Kit Maquiagem", supplier: "BeautyAsia", profit: 45, price: 119, cat: "Beleza" },
  { name: "Luminária LED", supplier: "HomeDeco", profit: 38, price: 97, cat: "Casa" },
  { name: "Caixa de Som BT", supplier: "TechImport BR", profit: 57, price: 167, cat: "Eletrônicos" },
  { name: "Carteira Couro", supplier: "LeatherBR", profit: 44, price: 134, cat: "Moda" },
];

const tabs = ["Todos", "Eletrônicos", "Moda", "Beleza", "Casa"];

const getProductInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const CatalogPage = () => {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("Todos");
  const [added, setAdded] = useState<number[]>([]);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchTab = tab === "Todos" || p.cat === tab;
    return matchSearch && matchTab;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all">
          Importar produtos
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-background/80"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map((p, i) => {
          const isAdded = added.includes(i);
          return (
            <div key={i} className="card-wuili overflow-hidden group">
              <div className="flex h-32 flex-col justify-between bg-muted/70 p-4 transition-colors group-hover:bg-muted">
                <span className="w-fit rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                  {p.cat}
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background text-sm font-bold tracking-[0.16em] text-foreground shadow-sm">
                  {getProductInitials(p.name)}
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm font-bold truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.supplier}</p>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <span className="text-sm font-bold text-primary">Lucro R${p.profit}</span>
                    <span className="text-xs text-muted-foreground ml-2">R${p.price}</span>
                  </div>
                </div>
                <button
                  onClick={() => setAdded((prev) => isAdded ? prev : [...prev, i])}
                  className={`w-full mt-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isAdded
                      ? "bg-success-light text-success"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {isAdded ? "Adicionado" : "Adicionar à loja"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CatalogPage;
