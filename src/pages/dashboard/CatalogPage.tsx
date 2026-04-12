import { useState } from "react";
import { Search, Star, ChevronDown, ArrowRight } from "lucide-react";
import PlatformIntegrationModal from "@/components/dashboard/PlatformIntegrationModal";
import ImportProductModal from "@/components/dashboard/ImportProductModal";
import PlatformLogo from "@/components/dashboard/PlatformLogo";

type Product = {
  name: string;
  platform: string;
  platformColor: string;
  rating: number;
  reviews: number;
  priceMin: number;
  priceMax: number;
  minOrder: number;
  tags: string[];
  image: string;
  cat: string;
};

const products: Product[] = [
  { name: "Fone Bluetooth TWS Pro", platform: "AliExpress", platformColor: "#FF6A00", rating: 4.8, reviews: 1345, priceMin: 45, priceMax: 89, minOrder: 10, tags: ["Eletrônicos", "Audio"], image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=280&fit=crop", cat: "Eletrônicos" },
  { name: "Relógio Smartwatch Series X", platform: "Shopee", platformColor: "#EE4D2D", rating: 4.6, reviews: 976, priceMin: 120, priceMax: 200, minOrder: 5, tags: ["Eletrônicos", "Wearable"], image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=280&fit=crop", cat: "Eletrônicos" },
  { name: "Tênis Casual Masculino Urban", platform: "Amazon", platformColor: "#FF9900", rating: 4.7, reviews: 1654, priceMin: 60, priceMax: 110, minOrder: 8, tags: ["Moda", "Calçados"], image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=280&fit=crop", cat: "Moda" },
  { name: "Kit Skincare Coreano 5 Passos", platform: "AliExpress", platformColor: "#FF6A00", rating: 4.8, reviews: 886, priceMin: 35, priceMax: 75, minOrder: 12, tags: ["Beleza", "Skincare"], image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&h=280&fit=crop", cat: "Beleza" },
  { name: "Mochila Urbana Impermeável", platform: "Shopee", platformColor: "#EE4D2D", rating: 4.5, reviews: 1256, priceMin: 55, priceMax: 95, minOrder: 6, tags: ["Moda", "Acessórios"], image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=280&fit=crop", cat: "Moda" },
  { name: "Mouse Sem Fio Ergonômico", platform: "Amazon", platformColor: "#FF9900", rating: 4.6, reviews: 1276, priceMin: 25, priceMax: 55, minOrder: 15, tags: ["Eletrônicos", "Periférico"], image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=280&fit=crop", cat: "Eletrônicos" },
  { name: "Perfume Importado Masculino", platform: "AliExpress", platformColor: "#FF6A00", rating: 4.8, reviews: 1334, priceMin: 80, priceMax: 150, minOrder: 4, tags: ["Beleza", "Perfume"], image: "https://images.unsplash.com/photo-1541643600914-78b084683702?w=400&h=280&fit=crop", cat: "Beleza" },
  { name: "Luminária LED de Mesa", platform: "Shopee", platformColor: "#EE4D2D", rating: 4.7, reviews: 1967, priceMin: 30, priceMax: 65, minOrder: 10, tags: ["Casa", "Iluminação"], image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&h=280&fit=crop", cat: "Casa" },
];

const categories = ["Todos", "Eletrônicos", "Moda", "Beleza", "Casa"];

const platformLogos: Record<string, { bg: string; text: string; abbr: string }> = {
  AliExpress: { bg: "#FF6A00", text: "white", abbr: "AE" },
  Shopee:     { bg: "#EE4D2D", text: "white", abbr: "SH" },
  Amazon:     { bg: "#FF9900", text: "white", abbr: "AM" },
};

const PlatformBadge = ({ platform, color }: { platform: string; color: string }) => {
  const meta = platformLogos[platform];
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <span
        className="flex h-[18px] w-[18px] items-center justify-center rounded text-[8px] font-black text-white shrink-0"
        style={{ backgroundColor: meta?.bg ?? color }}
      >
        {meta?.abbr ?? platform.slice(0, 2).toUpperCase()}
      </span>
      {platform}
    </span>
  );
};

const CatalogPage = () => {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("Todos");
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [integrationOpen, setIntegrationOpen] = useState(false);
  const [importProduct, setImportProduct] = useState<typeof products[0] | null>(null);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = cat === "Todos" || p.cat === cat;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-5">
      <PlatformIntegrationModal open={integrationOpen} onClose={() => setIntegrationOpen(false)} />
      <ImportProductModal open={!!importProduct} onClose={() => setImportProduct(null)} product={importProduct} />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Dropshipping</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Encontre produtos e importe para sua loja</p>
        </div>
        <button onClick={() => setIntegrationOpen(true)} className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
          Integração de Plataforma <ArrowRight size={14} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-52 pl-8 pr-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {["Status de Pagamento", "Categoria"].map((f) => (
          <button key={f} className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
            {f} <ChevronDown size={13} />
          </button>
        ))}

        <div className="flex gap-1.5 ml-auto">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                cat === c ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {filtered.map((p, i) => {
          const isAdded = added.has(i);
          return (
            <div key={i} className="rounded-2xl border border-border bg-background overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
              {/* Image */}
              <div className="relative h-44 overflow-hidden bg-muted">
                <input type="checkbox" className="absolute top-3 left-3 z-10 h-4 w-4 rounded accent-foreground cursor-pointer" />
                <img
                  src={p.image}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Content */}
              <div className="p-4 flex flex-col flex-1 gap-3">
                {/* Platform + Rating */}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <PlatformLogo platform={p.platform} color={p.platformColor} size={22} />
                    <span className="text-sm font-semibold text-foreground">{p.platform}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-amber-500 font-semibold">
                    <Star size={11} fill="currentColor" /> {p.rating} <span className="text-muted-foreground font-normal">({p.reviews.toLocaleString()})</span>
                  </span>
                </div>

                {/* Name */}
                <p className="text-sm font-bold text-foreground leading-snug line-clamp-2">{p.name}</p>

                {/* Price + Min Order */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Preço</p>
                    <p className="text-sm font-bold text-foreground">${p.priceMin}–${p.priceMax}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Pedido mín.</p>
                    <p className="text-sm font-bold text-foreground">{p.minOrder} unid.</p>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {p.tags.map((tag) => (
                    <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{tag}</span>
                  ))}
                </div>

                {/* Button */}
                <div className="flex gap-2 mt-auto pt-1">
                  <button
                    onClick={() => setImportProduct(p)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      isAdded ? "bg-green-600 text-white" : "bg-foreground text-background hover:opacity-90"
                    }`}
                  >
                    {isAdded ? "Importado ✓" : "Importar Produto"}
                  </button>
                  <button className="flex h-8 w-8 items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors">
                    <ArrowRight size={14} className="text-foreground" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CatalogPage;
