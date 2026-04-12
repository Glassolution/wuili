import { useState } from "react";
import { Search, ChevronDown, MoreHorizontal, RefreshCw, ArrowRight, ChevronsRight, Eye, EyeOff } from "lucide-react";

type Product = {
  id: string;
  name: string;
  image: string;
  source: string;
  sourceIcon: string;
  sourceColor: string;
  rating: number;
  reviews: string;
  price: string;
  minOrder: string;
  tags: string[];
};

const products: Product[] = [
  {
    id: "1",
    name: "Macbook Pro M1 Pro 14\" 512GB",
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop",
    source: "Ali Express",
    sourceIcon: "🔴",
    sourceColor: "bg-[#e74c3c]",
    rating: 4.8,
    reviews: "1,345",
    price: "$180–$220",
    minOrder: "12 unit",
    tags: ["Apple", "Electronic"],
  },
  {
    id: "2",
    name: "Monitor MSI 27\" Modern MD271UL 4K",
    image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=300&fit=crop",
    source: "Amazon",
    sourceIcon: "📦",
    sourceColor: "bg-[#ff9900]",
    rating: 4.9,
    reviews: "976",
    price: "$175–$200",
    minOrder: "11 unit",
    tags: ["MSI", "Electronic", "Display"],
  },
  {
    id: "3",
    name: "Macbook Pro M1 2020 13\" 512GB",
    image: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=400&h=300&fit=crop",
    source: "Tokopedia",
    sourceIcon: "🟢",
    sourceColor: "bg-[#42b549]",
    rating: 4.7,
    reviews: "1,654",
    price: "$180–$250",
    minOrder: "10 unit",
    tags: ["Apple", "Electronic"],
  },
  {
    id: "4",
    name: "Monitor MSI 27\" Modern MD271UL 4K",
    image: "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=400&h=300&fit=crop",
    source: "Shopee",
    sourceIcon: "🟠",
    sourceColor: "bg-[#ee4d2d]",
    rating: 4.8,
    reviews: "886",
    price: "$197–$224",
    minOrder: "8 unit",
    tags: ["MSI", "Electronic", "Display"],
  },
  {
    id: "5",
    name: "Macbook Pro M1 Pro 14\" 512GB",
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=300&fit=crop",
    source: "eBay",
    sourceIcon: "🏷",
    sourceColor: "bg-[#86b817]",
    rating: 4.5,
    reviews: "1,256",
    price: "$180–$220",
    minOrder: "12 unit",
    tags: ["Apple", "Electronic"],
  },
  {
    id: "6",
    name: "Macbook Pro M1 Pro 14\" 512GB",
    image: "https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=400&h=300&fit=crop",
    source: "Shopee",
    sourceIcon: "🟠",
    sourceColor: "bg-[#ee4d2d]",
    rating: 4.6,
    reviews: "1,276",
    price: "$180–$220",
    minOrder: "15 unit",
    tags: ["Apple", "Electronic"],
  },
  {
    id: "7",
    name: "Macbook Air M1 2020 13\" 256GB",
    image: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400&h=300&fit=crop",
    source: "Lazada",
    sourceIcon: "❤️",
    sourceColor: "bg-[#0f146d]",
    rating: 4.8,
    reviews: "1,334",
    price: "$180–$220",
    minOrder: "5 unit",
    tags: ["Apple", "Electronic"],
  },
  {
    id: "8",
    name: "Apple 32\" Pro Display XDR Retina 6K",
    image: "https://images.unsplash.com/photo-1527443195645-1133f7f28990?w=400&h=300&fit=crop",
    source: "BigCommerce",
    sourceIcon: "🔷",
    sourceColor: "bg-[#34313f]",
    rating: 4.7,
    reviews: "1,967",
    price: "$180–$220",
    minOrder: "20 unit",
    tags: ["Apple", "Electronic", "Display"],
  },
];

const categories = ["Todos", "Eletrônicos", "Moda", "Beleza", "Casa"];

const ProductsPage = () => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [showHidden, setShowHidden] = useState(false);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Dropshipping</h2>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <MoreHorizontal size={18} />
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={15} />
          </button>
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
          Platform Integration
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Subtitle */}
      <p className="text-sm text-muted-foreground -mt-3">Encontre produtos e importe para sua loja</p>

      {/* Filters row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-44 rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Date range pill */}
          <button className="flex items-center gap-1.5 rounded-full bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-80 transition-opacity">
            2 Feb - 14 apr
            <ChevronDown size={13} />
          </button>

          {/* Filter buttons */}
          <button className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
            Payment Status <ChevronDown size={13} />
          </button>
          <button className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
            Category <ChevronDown size={13} />
          </button>

          {/* Hide button */}
          <button
            onClick={() => setShowHidden(!showHidden)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Hide
          </button>
        </div>

        {/* Category pills */}
        <div className="hidden items-center gap-1.5 lg:flex">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-4 py-[7px] text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="group overflow-hidden rounded-2xl border border-border bg-background transition-shadow hover:shadow-md"
          >
            {/* Product image — contained in white/light bg */}
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#f5f5f5] dark:bg-muted/50 p-6">
              <img
                src={p.image}
                alt={p.name}
                className="h-full w-full rounded-lg object-contain transition-transform duration-300 group-hover:scale-105"
              />
              {/* Checkbox */}
              <div className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded border-2 border-border bg-background shadow-sm" />
            </div>

            {/* Card body — consistent left-aligned padding */}
            <div className="px-4 pb-4 pt-3">
              {/* Source + Rating */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded text-[9px] font-bold text-white ${p.sourceColor}`}>
                    {p.source.charAt(0)}
                  </span>
                  <span className="text-[13px] font-medium text-foreground">{p.source}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[12px] text-amber-500">★</span>
                  <span className="text-[13px] font-semibold text-foreground">{p.rating}</span>
                  <span className="text-[12px] text-muted-foreground">({p.reviews})</span>
                </div>
              </div>

              {/* Product name — wraps to next line if too long */}
              <p className="mt-2 text-[14px] font-semibold leading-[1.35] text-foreground">
                {p.name}
              </p>

              {/* Price + Min Order — same row, aligned */}
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <p className="text-[11px] leading-none text-muted-foreground">Price</p>
                  <p className="mt-0.5 text-[14px] font-bold leading-none text-foreground">{p.price}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] leading-none text-muted-foreground">Min. Order</p>
                  <p className="mt-0.5 text-[14px] font-bold leading-none text-foreground">{p.minOrder}</p>
                </div>
              </div>

              {/* Tags */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-muted px-2 py-[3px] text-[11px] font-medium text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Import button */}
              <div className="mt-3 flex items-center gap-2">
                <button className="flex flex-1 items-center justify-center rounded-xl bg-foreground py-2.5 text-[13px] font-semibold text-background transition-opacity hover:opacity-80">
                  Import Product
                </button>
                <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted">
                  <ChevronsRight size={16} />
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
