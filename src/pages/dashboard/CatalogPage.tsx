import { useState } from "react";
import { Search } from "lucide-react";

const products = [
  { emoji: "🎧", name: "Fone Bluetooth TWS", supplier: "TechImport BR", profit: 63, price: 89, cat: "Eletrônicos" },
  { emoji: "👟", name: "Tênis Casual Masculino", supplier: "ModaFlex SP", profit: 47, price: 127, cat: "Moda" },
  { emoji: "💄", name: "Kit Skincare Coreano", supplier: "BeautyAsia", profit: 38, price: 89, cat: "Beleza" },
  { emoji: "⌚", name: "Relógio Smartwatch", supplier: "TechImport BR", profit: 82, price: 234, cat: "Eletrônicos" },
  { emoji: "🎒", name: "Mochila Urbana", supplier: "UrbanBags", profit: 55, price: 156, cat: "Moda" },
  { emoji: "🕶️", name: "Óculos de Sol Retrô", supplier: "StyleVision", profit: 34, price: 78, cat: "Moda" },
  { emoji: "🖱️", name: "Mouse Sem Fio", supplier: "TechImport BR", profit: 28, price: 67, cat: "Eletrônicos" },
  { emoji: "📱", name: "Capa iPhone 15", supplier: "CaseBR", profit: 22, price: 39, cat: "Eletrônicos" },
  { emoji: "🌸", name: "Perfume Importado", supplier: "BeautyAsia", profit: 71, price: 189, cat: "Beleza" },
  { emoji: "👠", name: "Tênis Feminino", supplier: "ModaFlex SP", profit: 52, price: 144, cat: "Moda" },
  { emoji: "📷", name: "Câmera de Segurança", supplier: "TechImport BR", profit: 94, price: 278, cat: "Eletrônicos" },
  { emoji: "💻", name: "Suporte Notebook", supplier: "OfficeGear", profit: 31, price: 89, cat: "Casa" },
  { emoji: "💅", name: "Kit Maquiagem", supplier: "BeautyAsia", profit: 45, price: 119, cat: "Beleza" },
  { emoji: "💡", name: "Luminária LED", supplier: "HomeDeco", profit: 38, price: 97, cat: "Casa" },
  { emoji: "🔊", name: "Caixa de Som BT", supplier: "TechImport BR", profit: 57, price: 167, cat: "Eletrônicos" },
  { emoji: "👜", name: "Carteira Couro", supplier: "LeatherBR", profit: 44, price: 134, cat: "Moda" },
];

const tabs = ["Todos", "Eletrônicos", "Moda", "Beleza", "Casa"];

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
          Importar do AliExpress +
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
              <div className="h-32 bg-muted flex items-center justify-center text-5xl group-hover:scale-105 transition-transform">
                {p.emoji}
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
                  {isAdded ? "✓ Adicionado" : "+ Adicionar à minha loja"}
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
