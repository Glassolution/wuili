import { useState, useMemo } from "react";
import { X, Package, TrendingUp, Store, Save, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type CatalogProduct = {
  id: string;
  title: string;
  description: string | null;
  images: any;
  cost_price: number;
  suggested_price: number;
  margin_percent: number;
  category: string | null;
  source: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  product: CatalogProduct | null;
};

const PLATFORMS = [
  { key: "mercadolivre", label: "Mercado Livre", enabled: true, color: "#FFE600", textColor: "#333" },
  { key: "shopee", label: "Shopee", enabled: false, color: "#EE4D2D", textColor: "#fff" },
];

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const getImage = (images: any): string | null => {
  try {
    const arr = typeof images === "string" ? JSON.parse(images) : images;
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  } catch {
    return null;
  }
};

const ImportProductModal = ({ open, onClose, product }: Props) => {
  const suggestedPrice = product
    ? product.suggested_price || product.cost_price * 2.2
    : 0;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sellPrice, setSellPrice] = useState(0);
  const [platform, setPlatform] = useState("mercadolivre");

  // Reset state when product changes
  const [lastProductId, setLastProductId] = useState<string | null>(null);
  if (product && product.id !== lastProductId) {
    setLastProductId(product.id);
    setTitle(product.title);
    setDescription(product.description || "");
    setSellPrice(Math.round(suggestedPrice * 1.2 * 100) / 100);
    setPlatform("mercadolivre");
  }

  const costPrice = product?.cost_price ?? 0;
  const profit = useMemo(() => Math.round((sellPrice - costPrice) * 100) / 100, [sellPrice, costPrice]);
  const profitMargin = useMemo(
    () => (sellPrice > 0 ? Math.round(((sellPrice - costPrice) / sellPrice) * 100) : 0),
    [sellPrice, costPrice]
  );

  const img = product ? getImage(product.images) : null;

  const handlePublish = () => {
    if (!title.trim()) {
      toast.error("Preencha o título do produto.");
      return;
    }
    if (sellPrice <= 0) {
      toast.error("Defina um preço de venda válido.");
      return;
    }

    const payload = {
      title: title.trim(),
      price: sellPrice,
      pictures: product?.images || [],
      description: description.trim(),
      category_id: "MLB1055",
      quantity: 10,
    };

    console.log("Produto pronto para publicação", payload);
    toast.success("Produto preparado para publicação no Mercado Livre!");
    onClose();
  };

  const handleSave = () => {
    if (!product) return;
    const saved = JSON.parse(localStorage.getItem("velo_saved_products") || "[]");
    const entry = {
      ...product,
      custom_title: title,
      custom_description: description,
      sell_price: sellPrice,
      saved_at: new Date().toISOString(),
    };
    const filtered = saved.filter((p: any) => p.id !== product.id);
    filtered.push(entry);
    localStorage.setItem("velo_saved_products", JSON.stringify(filtered));
    toast.success("Produto salvo com sucesso!");
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden max-h-[92vh]">
        <div className="flex flex-col max-h-[92vh]">
          {/* Header */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
            <DialogTitle className="text-lg font-bold">Importar Produto</DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">Configure e publique em sua loja</p>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6" style={{ scrollbarWidth: "thin" }}>
            {/* Product preview */}
            <div className="flex gap-4">
              <div className="h-28 w-28 shrink-0 rounded-xl overflow-hidden bg-muted/50 border border-border flex items-center justify-center">
                {img ? (
                  <img src={img} alt={title} className="h-full w-full object-cover" />
                ) : (
                  <Package size={28} className="text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-block rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 mb-2">
                  CJ Dropshipping
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="block w-full text-base font-semibold text-foreground bg-transparent border-0 border-b border-border/50 pb-1 focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
                  placeholder="Título do produto"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-2 block w-full text-sm text-muted-foreground bg-transparent border-0 border-b border-border/50 pb-1 focus:outline-none focus:border-primary transition-colors resize-none placeholder:text-muted-foreground"
                  placeholder="Descrição do produto"
                />
              </div>
            </div>

            {/* Price block */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <TrendingUp size={15} className="text-primary" />
                Precificação
              </h4>

              <div className="grid grid-cols-3 gap-3">
                {/* Cost */}
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Custo</p>
                  <p className="text-base font-bold text-foreground">{formatBRL(costPrice)}</p>
                </div>
                {/* Suggested */}
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Sugerido</p>
                  <p className="text-base font-bold text-muted-foreground">{formatBRL(suggestedPrice)}</p>
                </div>
                {/* Sell price input */}
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Preço de venda</p>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={sellPrice || ""}
                      onChange={(e) => setSellPrice(Number(e.target.value))}
                      className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              </div>

              {/* Profit highlight */}
              <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                profit > 0
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : profit < 0
                  ? "bg-red-500/10 border border-red-500/20"
                  : "bg-muted/30 border border-border"
              }`}>
                <span className="text-sm font-medium text-foreground">Lucro por venda</span>
                <div className="text-right">
                  <span className={`text-xl font-black ${
                    profit > 0 ? "text-emerald-500" : profit < 0 ? "text-red-500" : "text-muted-foreground"
                  }`}>
                    {formatBRL(profit)}
                  </span>
                  <span className={`ml-2 text-xs font-semibold ${
                    profit > 0 ? "text-emerald-500" : profit < 0 ? "text-red-500" : "text-muted-foreground"
                  }`}>
                    ({profitMargin}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Platform selection */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Store size={15} className="text-primary" />
                Publicar em
              </h4>
              <div className="flex gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => p.enabled && setPlatform(p.key)}
                    disabled={!p.enabled}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                      platform === p.key && p.enabled
                        ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20"
                        : p.enabled
                        ? "border-border text-foreground hover:border-primary/40"
                        : "border-border text-muted-foreground opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.label}
                    {!p.enabled && <span className="text-[10px] text-muted-foreground">(em breve)</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-between bg-muted/10">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Save size={14} />
              Salvar produto
            </button>
            <button
              onClick={handlePublish}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <ExternalLink size={14} />
              Publicar no Mercado Livre
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportProductModal;
