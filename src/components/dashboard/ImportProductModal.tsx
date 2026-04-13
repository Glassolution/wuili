import { useState, useMemo, useEffect } from "react";
import { X, Package, ChevronRight, Check, Store, TrendingUp } from "lucide-react";
import { toast } from "sonner";

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

const generateProductDescription = (product: CatalogProduct): string => {
  const title = product.title || "este produto";
  return `🚀 ${title}

✅ Qualidade premium com acabamento profissional
✅ Design moderno e funcional para o dia a dia
✅ Material resistente e durável — feito para durar
✅ Envio rápido direto do fornecedor
✅ Satisfação garantida ou seu dinheiro de volta

💡 Ideal para quem busca praticidade sem abrir mão do estilo.
📦 Estoque limitado — garanta o seu agora!`;
};

const STEPS = [
  { label: "Produto", num: 1 },
  { label: "Personalizar", num: 2 },
  { label: "Revisar", num: 3 },
];

const ImportProductModal = ({ open, onClose, product }: Props) => {
  const suggestedPrice = product
    ? product.suggested_price || product.cost_price * 2.2
    : 0;

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [sellPrice, setSellPrice] = useState(0);
  const [visible, setVisible] = useState(false);

  // Animate in/out
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  // Reset state when product changes
  const [lastProductId, setLastProductId] = useState<string | null>(null);
  if (product && product.id !== lastProductId) {
    setLastProductId(product.id);
    setTitle(product.title);
    setSellPrice(Math.round(suggestedPrice * 1.2 * 100) / 100);
    setStep(1);
  }

  const costPrice = product?.cost_price ?? 0;
  const profit = useMemo(() => Math.round((sellPrice - costPrice) * 100) / 100, [sellPrice, costPrice]);
  const profitMargin = useMemo(
    () => (sellPrice > 0 ? Math.round(((sellPrice - costPrice) / sellPrice) * 100) : 0),
    [sellPrice, costPrice]
  );

  const img = product ? getImage(product.images) : null;
  const description = product ? generateProductDescription(product) : "";

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

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
      description,
      category_id: "MLB1055",
      quantity: 10,
    };

    console.log("Produto pronto para publicação", payload);
    toast.success("Produto preparado para publicação no Mercado Livre!");
    handleClose();
  };

  if (!open && !visible) return null;
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`relative flex w-full max-w-[1100px] bg-white shadow-2xl transition-transform duration-300 ease-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* LEFT SIDE — 60% */}
        <div className="flex w-[60%] flex-col border-r border-gray-100">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-8 py-5">
            <div>
              <h2 className="text-lg font-bold text-[#0A0A0A]">Importar Produto</h2>
              <p className="text-sm text-gray-500 mt-0.5">Configure e publique em sua loja</p>
            </div>
            <button
              onClick={handleClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-0 border-b border-gray-100 px-8 py-4">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center">
                <button
                  onClick={() => setStep(s.num)}
                  className="flex items-center gap-2.5"
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      step === s.num
                        ? "bg-[#0A0A0A] text-white"
                        : step > s.num
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {step > s.num ? <Check size={13} /> : s.num}
                  </span>
                  <span
                    className={`text-sm font-medium transition-colors ${
                      step === s.num ? "text-[#0A0A0A]" : "text-gray-400"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <ChevronRight size={14} className="mx-4 text-gray-300" />
                )}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-6" style={{ scrollbarWidth: "thin" }}>
            {/* STEP 1: Product */}
            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-[#0A0A0A]">Produto selecionado</h3>
                  <p className="text-sm text-gray-500 mt-1">Confirme o produto que deseja importar</p>
                </div>

                <div className="flex gap-5 rounded-xl border border-gray-100 bg-gray-50/50 p-5">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-white border border-gray-100">
                    {img ? (
                      <img src={img} alt={title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package size={24} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="inline-block rounded-md bg-amber-50 border border-amber-200/50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 mb-2">
                      CJ Dropshipping
                    </span>
                    <p className="text-sm font-semibold text-[#0A0A0A] leading-snug line-clamp-2">{product.title}</p>
                    <div className="mt-3 flex items-center gap-4">
                      <div>
                        <p className="text-[11px] text-gray-400">Custo</p>
                        <p className="text-sm font-bold text-[#0A0A0A]">{formatBRL(costPrice)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Sugerido</p>
                        <p className="text-sm font-bold text-gray-500">{formatBRL(suggestedPrice)}</p>
                      </div>
                      <span className="rounded-md bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Margem {Math.round(product.margin_percent)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Platform */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-[#0A0A0A] flex items-center gap-2">
                    <Store size={14} className="text-gray-400" />
                    Publicar em
                  </h4>
                  <div className="flex gap-3">
                    <div className="flex items-center gap-2.5 rounded-xl border-2 border-[#0A0A0A] bg-[#0A0A0A]/[0.02] px-4 py-3 text-sm font-semibold text-[#0A0A0A]">
                      <span className="h-3 w-3 rounded-full bg-[#FFE600]" />
                      Mercado Livre
                      <Check size={14} className="text-[#0A0A0A]" />
                    </div>
                    <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-400 cursor-not-allowed">
                      <span className="h-3 w-3 rounded-full bg-[#EE4D2D] opacity-40" />
                      Shopee
                      <span className="text-[10px]">(em breve)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Customize */}
            {step === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-[#0A0A0A]">Personalização</h3>
                  <p className="text-sm text-gray-500 mt-1">Ajuste título e preço de venda</p>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#0A0A0A]">Título do anúncio</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/10 focus:border-[#0A0A0A]/30 transition-all placeholder:text-gray-400"
                    placeholder="Título do produto"
                  />
                </div>

                {/* Pricing */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-5 space-y-5">
                  <h4 className="text-sm font-bold text-[#0A0A0A] flex items-center gap-2">
                    <TrendingUp size={14} className="text-gray-400" />
                    Precificação
                  </h4>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1.5">Custo do produto</p>
                      <p className="text-base font-bold text-[#0A0A0A]">{formatBRL(costPrice)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1.5">Preço sugerido</p>
                      <p className="text-base font-bold text-gray-500">{formatBRL(suggestedPrice)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1.5">Preço de venda</p>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={sellPrice || ""}
                          onChange={(e) => setSellPrice(Number(e.target.value))}
                          className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm font-bold text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/10 focus:border-[#0A0A0A]/30 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Profit highlight */}
                  <div
                    className={`flex items-center justify-between rounded-xl px-5 py-4 ${
                      profit > 0
                        ? "bg-emerald-50 border border-emerald-200/50"
                        : profit < 0
                        ? "bg-red-50 border border-red-200/50"
                        : "bg-gray-100 border border-gray-200"
                    }`}
                  >
                    <span className="text-sm font-medium text-[#0A0A0A]">Lucro por venda</span>
                    <div className="text-right flex items-baseline gap-2">
                      <span
                        className={`text-2xl font-black ${
                          profit > 0 ? "text-emerald-600" : profit < 0 ? "text-red-600" : "text-gray-400"
                        }`}
                      >
                        {formatBRL(profit)}
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          profit > 0
                            ? "bg-emerald-100 text-emerald-700"
                            : profit < 0
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {profitMargin}%
                      </span>
                    </div>
                  </div>

                  {profit > 0 && profitMargin >= 40 && (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <TrendingUp size={14} />
                      <span className="text-xs font-semibold">Margem excelente! Produto com alto potencial de lucro.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: Review */}
            {step === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-[#0A0A0A]">Revisão final</h3>
                  <p className="text-sm text-gray-500 mt-1">Confira os dados antes de publicar</p>
                </div>

                <div className="space-y-4">
                  {/* Summary rows */}
                  {[
                    { label: "Título", value: title },
                    { label: "Plataforma", value: "Mercado Livre" },
                    { label: "Custo", value: formatBRL(costPrice) },
                    { label: "Preço de venda", value: formatBRL(sellPrice) },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between border-b border-gray-100 pb-3"
                    >
                      <span className="text-sm text-gray-500">{row.label}</span>
                      <span className="text-sm font-semibold text-[#0A0A0A] text-right max-w-[60%] truncate">
                        {row.value}
                      </span>
                    </div>
                  ))}

                  {/* Profit summary */}
                  <div
                    className={`flex items-center justify-between rounded-xl px-5 py-4 ${
                      profit > 0
                        ? "bg-emerald-50 border border-emerald-200/50"
                        : "bg-red-50 border border-red-200/50"
                    }`}
                  >
                    <span className="text-sm font-bold text-[#0A0A0A]">Seu lucro por venda</span>
                    <span
                      className={`text-xl font-black ${
                        profit > 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {formatBRL(profit)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 px-8 py-4">
            <button
              onClick={handleClose}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-[#0A0A0A] hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <div className="flex items-center gap-3">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-[#0A0A0A] hover:bg-gray-50 transition-colors"
                >
                  Voltar
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  className="rounded-xl bg-[#0A0A0A] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#1a1a1a] transition-colors"
                >
                  Continuar
                </button>
              ) : (
                <button
                  onClick={handlePublish}
                  className="rounded-xl bg-[#0A0A0A] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#1a1a1a] transition-colors flex items-center gap-2"
                >
                  Publicar no Mercado Livre
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE — 40% sticky preview */}
        <div className="w-[40%] bg-gray-50/70 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <div className="sticky top-0 p-6 space-y-5">
            {/* Product image */}
            <div className="aspect-square w-full overflow-hidden rounded-xl bg-white border border-gray-100 shadow-sm">
              {img ? (
                <img src={img} alt={title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package size={40} className="text-gray-300" />
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <p className="text-base font-bold text-[#0A0A0A] leading-snug">{title || product.title}</p>
              <span className="mt-2 inline-block rounded-md bg-amber-50 border border-amber-200/50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                CJ Dropshipping
              </span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-black text-[#0A0A0A]">{formatBRL(sellPrice)}</span>
              {profit > 0 && (
                <span className="rounded-md bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                  +{formatBRL(profit)} lucro
                </span>
              )}
            </div>

            {/* Auto-generated description */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Descrição automática</p>
              <div className="rounded-xl bg-white border border-gray-100 p-4">
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{description}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportProductModal;
