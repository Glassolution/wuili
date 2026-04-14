import { useState, useMemo, useEffect } from "react";
import { X, Package, ChevronRight, Check, Store, TrendingUp, AlertCircle, Link, Loader2, ExternalLink, Sparkles, Edit3, Hash, FileText, Play, Globe, Sliders } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  original_url?: string;
  stock_quantity?: number | null;
  external_id?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  product: CatalogProduct | null;
};

const MAX_TITLE_LENGTH = 60;

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

const STEPS = [
  { label: "Produto", num: 1 },
  { label: "Personalizar", num: 2 },
  { label: "Revisar", num: 3 },
];

const ImportProductModal = ({ open, onClose, product }: Props) => {
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [sellPrice, setSellPrice] = useState(0);
  const [visible, setVisible] = useState(false);
  const [isConnectedToML, setIsConnectedToML] = useState<boolean | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ permalink: string; item_id: string } | null>(null);

  // Pricing engine
  const [multiplier, setMultiplier] = useState(2.5);
  const [freightCost, setFreightCost] = useState(0);
  const [taxCost, setTaxCost] = useState(0);

  // AI description
  const [description, setDescription] = useState("");
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [descGenerated, setDescGenerated] = useState(false);

  // Translation
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState(false);

  // Check ML connection status
  useEffect(() => {
    if (!user || !open) return;
    (async () => {
      const { data } = await supabase
        .from("user_integrations")
        .select("access_token")
        .eq("user_id", user.id)
        .eq("platform", "mercadolivre")
        .maybeSingle();
      setIsConnectedToML(!!data?.access_token);
    })();
  }, [user, open]);

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
    const truncated = product.title.length > MAX_TITLE_LENGTH
      ? product.title.substring(0, MAX_TITLE_LENGTH)
      : product.title;
    setTitle(truncated);
    setMultiplier(2.5);
    setFreightCost(0);
    setTaxCost(0);
    const baseCost = product.cost_price + 0 + 0; // cost + freight + tax
    setSellPrice(Math.round(baseCost * 2.5 * 100) / 100);
    setStep(1);
    setPublishResult(null);
    setPublishing(false);
    setDescription("");
    setDescGenerated(false);
    setTranslated(false);
  }

  const costPrice = product?.cost_price ?? 0;
  const totalCost = costPrice + freightCost + taxCost;

  // Recalculate sell price when multiplier/freight/tax changes
  const recalcPrice = (mult: number, freight: number, tax: number) => {
    const total = costPrice + freight + tax;
    setSellPrice(Math.round(total * mult * 100) / 100);
  };

  const profit = useMemo(() => Math.round((sellPrice - totalCost) * 100) / 100, [sellPrice, totalCost]);
  const profitMargin = useMemo(
    () => (sellPrice > 0 ? Math.round(((sellPrice - totalCost) / sellPrice) * 100) : 0),
    [sellPrice, totalCost]
  );

  const img = product ? getImage(product.images) : null;
  const stockQty = product?.stock_quantity ?? 0;
  const hasStock = stockQty > 0;

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const handleConnectML = () => {
    if (!user) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    window.location.href = `${supabaseUrl}/functions/v1/ml-connect?user_id=${user.id}`;
  };

  // Translate title to PT-BR sales copy
  const handleTranslate = async () => {
    if (!product) return;
    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [
            {
              role: "user",
              content: `Você é um tradutor especialista em e-commerce brasileiro. Traduza o nome deste produto para português do Brasil, adaptando para linguagem de venda (não tradução literal). Máximo ${MAX_TITLE_LENGTH} caracteres. Produto: "${product.title}". Responda APENAS com o título traduzido, sem aspas, sem explicação.`
            }
          ]
        },
      });

      if (error) throw error;

      const text = data?.response || data?.choices?.[0]?.message?.content || "";
      if (typeof text === "string" && text.trim()) {
        const cleaned = text.trim().replace(/^["']|["']$/g, '');
        const truncated = cleaned.length > MAX_TITLE_LENGTH ? cleaned.substring(0, MAX_TITLE_LENGTH) : cleaned;
        setTitle(truncated);
        setTranslated(true);
        toast.success("Título traduzido para PT-BR!");
      } else {
        toast.error("Não foi possível traduzir. Edite manualmente.");
      }
    } catch (err: any) {
      console.error("Erro ao traduzir:", err);
      toast.error("Erro ao traduzir. Tente novamente.");
    } finally {
      setTranslating(false);
    }
  };

  // Generate AI description
  const handleGenerateDescription = async () => {
    if (!product) return;
    setGeneratingDesc(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [
            {
              role: "user",
              content: `Você é um especialista em copywriting para e-commerce brasileiro. Crie uma descrição de produto persuasiva para o Mercado Livre com no máximo 500 caracteres. O produto é: ${title}. Preço de venda: R$ ${sellPrice.toFixed(2)}. Use linguagem direta, destaque benefícios e inclua uma chamada para ação. Não use bullet points, apenas parágrafos curtos. Responda APENAS com a descrição, sem comentários adicionais.`
            }
          ]
        },
      });

      if (error) throw error;

      const text = data?.response || data?.choices?.[0]?.message?.content || "";
      if (typeof text === "string" && text.trim()) {
        setDescription(text.trim());
        setDescGenerated(true);
        toast.success("Descrição gerada com IA!");
      } else {
        toast.error("Não foi possível gerar a descrição. Digite manualmente.");
      }
    } catch (err: any) {
      console.error("Erro ao gerar descrição:", err);
      toast.error("Erro ao gerar descrição. Tente novamente.");
    } finally {
      setGeneratingDesc(false);
    }
  };

  // Validate before publish
  const validatePublish = (): boolean => {
    if (!title.trim()) {
      toast.error("Preencha o título do produto.");
      return false;
    }
    if (title.trim().length > MAX_TITLE_LENGTH) {
      toast.error(`Título muito longo. Máximo ${MAX_TITLE_LENGTH} caracteres.`);
      return false;
    }
    if (sellPrice <= 0) {
      toast.error("Defina um preço de venda válido.");
      return false;
    }
    if (sellPrice <= totalCost) {
      toast.error("O preço de venda deve ser maior que o custo total.");
      return false;
    }
    if (!isConnectedToML) {
      toast.error("Conecte sua conta do Mercado Livre para publicar.");
      return false;
    }
    if (!hasStock) {
      toast.error("Produto sem estoque disponível. Não é possível publicar.");
      return false;
    }
    return true;
  };

  const handlePublish = async () => {
    if (!validatePublish()) return;
    if (!user) return;

    setPublishing(true);

    try {
      const images = (() => {
        try {
          const arr = typeof product?.images === "string" ? JSON.parse(product.images) : product?.images;
          return Array.isArray(arr) ? arr : [];
        } catch { return []; }
      })();

      const { data, error } = await supabase.functions.invoke("ml-publish", {
        body: {
          user_id: user.id,
          product: {
            id: product?.id,
            external_id: product?.external_id,
            title: title.trim(),
            price: sellPrice,
            cost_price: totalCost,
            description: description || `${title} - Produto de alta qualidade com envio rápido.`,
            images,
            available_quantity: Math.min(stockQty, 10),
            condition: "new",
          },
        },
      });

      if (error || data?.error) {
        const msg = data?.error || error?.message || "Erro ao publicar";
        toast.error(msg);
        console.error("Erro ml-publish:", data?.details || error);
        return;
      }

      setPublishResult({ permalink: data.permalink, item_id: data.item_id });
      setStep(4);

      // Save publication to database
      const thumbnailUrl = img || undefined;
      await supabase.from("user_publications" as any).insert({
        user_id: user.id,
        ml_item_id: data.item_id,
        title: title.trim(),
        thumbnail: thumbnailUrl,
        price: sellPrice,
        cost_price: totalCost,
        status: "active",
        permalink: data.permalink,
      });

      toast.success("Produto publicado com sucesso!");
      if (data.permalink) {
        window.open(data.permalink, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro inesperado ao publicar");
    } finally {
      setPublishing(false);
    }
  };

  if (!open && !visible) return null;
  if (!product) return null;

  const titleLength = title.length;
  const titleOverLimit = titleLength > MAX_TITLE_LENGTH;

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
              <h2 className="text-lg font-bold text-[#0A0A0A]">Novo anúncio</h2>
              <p className="text-sm text-gray-500 mt-0.5">Defina preço, revise e publique</p>
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
                  <p className="text-sm text-gray-500 mt-1">Verifique os dados antes de continuar</p>
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
                        <p className="text-sm font-bold text-gray-500">{formatBRL(costPrice * 2.5)}</p>
                      </div>
                      <span className="rounded-md bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Margem {Math.round(((costPrice * 2.5 - costPrice) / (costPrice * 2.5)) * 100)}%
                      </span>
                    </div>

                    {/* Stock availability */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-sm font-semibold ${
                        stockQty > 50 ? "text-emerald-600" :
                        stockQty >= 10 ? "text-amber-600" :
                        stockQty > 0 ? "text-red-600" :
                        "text-red-600"
                      }`}>
                        {stockQty === 0
                        ? "⚠️ Sem estoque"
                        : stockQty >= 999
                          ? "Em estoque"
                          : `${stockQty} unidades disponíveis`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stock warning */}
                {!hasStock && (
                  <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
                    <AlertCircle size={18} className="text-red-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-[#0A0A0A]">Produto sem estoque</p>
                      <p className="text-xs text-gray-500 mt-0.5">Não é possível publicar produtos sem estoque disponível na CJ.</p>
                    </div>
                  </div>
                )}

                {/* Platform */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-[#0A0A0A] flex items-center gap-2">
                    <Store size={14} className="text-gray-400" />
                    Publicar em
                  </h4>
                  <div className="flex gap-3">
                    <div className="flex items-center gap-2.5 rounded-xl border-2 border-[#0A0A0A] bg-[#0A0A0A]/[0.02] px-4 py-3 text-sm font-semibold text-[#0A0A0A]">
                      <div className="h-3 w-3 rounded-sm bg-[#FFE600]"></div>
                      Mercado Livre
                      <Check size={14} className="text-[#0A0A0A]" />
                    </div>
                    <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-400 cursor-not-allowed">
                      <div className="h-3 w-3 rounded-sm bg-[#EE4D2D]"></div>
                      Shopee
                      <span className="text-[10px]">(em breve)</span>
                    </div>
                  </div>
                </div>

                {/* ML Connection Status */}
                {isConnectedToML === false && (
                  <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
                    <AlertCircle size={18} className="text-amber-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#0A0A0A]">Conta não conectada</p>
                      <p className="text-xs text-gray-500 mt-0.5">Conecte sua conta do Mercado Livre para publicar produtos</p>
                    </div>
                    <button
                      onClick={handleConnectML}
                      className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#0A0A0A] px-4 py-2 text-xs font-bold text-white hover:bg-[#1a1a1a] transition-colors"
                    >
                      <Link size={12} />
                      Conectar
                    </button>
                  </div>
                )}
                {isConnectedToML === true && (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                    <Check size={18} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-[#0A0A0A]">Conta conectada</p>
                      <p className="text-xs text-gray-500 mt-0.5">Sua conta do Mercado Livre está pronta para publicação</p>
                    </div>
                  </div>
                )}

                {/* Supplier info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-[#0A0A0A] flex items-center gap-2">
                    <Package size={14} className="text-gray-400" />
                    Fornecedor
                  </h4>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-2">
                    <p className="text-sm font-semibold text-[#0A0A0A]">CJ Dropshipping</p>
                    <a
                      href="https://app.cjdropshipping.com/contact.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A0A0A] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1a1a1a] transition-colors"
                    >
                      <ExternalLink size={11} />
                      Contato do fornecedor
                    </a>
                    <p className="text-[11px] text-gray-400">Em caso de problema com entrega ou produto, entre em contato direto com o fornecedor.</p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Customize */}
            {step === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-[#0A0A0A]">Defina seu preço</h3>
                  <p className="text-sm text-gray-500 mt-1">Ajuste o título, traduza e configure o valor de venda</p>
                </div>

                {/* Title with translate + char counter */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-[#0A0A0A]">Título do anúncio</label>
                    <button
                      onClick={handleTranslate}
                      disabled={translating}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      {translating ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Globe size={12} />
                      )}
                      {translating ? "Traduzindo..." : translated ? "Retraduzir" : "Traduzir para PT-BR"}
                    </button>
                  </div>
                  <input
                    value={title}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.length <= MAX_TITLE_LENGTH) setTitle(val);
                    }}
                    maxLength={MAX_TITLE_LENGTH}
                    className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 ${
                      titleOverLimit
                        ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                        : "border-gray-200 focus:ring-[#0A0A0A]/10 focus:border-[#0A0A0A]/30"
                    }`}
                    placeholder="Título do produto"
                  />
                  <div className="flex items-center justify-between">
                    {translated && (
                      <p className="text-xs text-blue-500 flex items-center gap-1">
                        <Globe size={10} />
                        Traduzido automaticamente — edite se necessário
                      </p>
                    )}
                    <p className={`text-xs font-medium text-right ml-auto ${
                      titleOverLimit ? "text-red-500" : titleLength > 50 ? "text-amber-500" : "text-gray-400"
                    }`}>
                      {titleLength}/{MAX_TITLE_LENGTH} caracteres
                    </p>
                  </div>
                </div>

                {/* Pricing Engine */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-5 space-y-5">
                  <h4 className="text-sm font-bold text-[#0A0A0A] flex items-center gap-2">
                    <Sliders size={14} className="text-gray-400" />
                    Motor de Precificação
                  </h4>

                  {/* Cost breakdown */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1.5">Custo do produto</p>
                      <p className="text-base font-bold text-[#0A0A0A]">{formatBRL(costPrice)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1.5">Frete estimado</p>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={freightCost || ""}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setFreightCost(v);
                            recalcPrice(multiplier, v, taxCost);
                          }}
                          className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm font-bold text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/10 transition-all"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1.5">Taxas (opcional)</p>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={taxCost || ""}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setTaxCost(v);
                            recalcPrice(multiplier, freightCost, v);
                          }}
                          className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm font-bold text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/10 transition-all"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Custo total */}
                  <div className="flex items-center justify-between rounded-lg bg-gray-100 px-4 py-2.5">
                    <span className="text-xs font-medium text-gray-500">Custo total</span>
                    <span className="text-sm font-bold text-[#0A0A0A]">{formatBRL(totalCost)}</span>
                  </div>

                  {/* Multiplier slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-gray-400">Multiplicador</p>
                      <p className="text-sm font-bold text-[#0A0A0A]">{multiplier.toFixed(1)}x</p>
                    </div>
                    <input
                      type="range"
                      min="1.5"
                      max="5.0"
                      step="0.1"
                      value={multiplier}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setMultiplier(v);
                        recalcPrice(v, freightCost, taxCost);
                      }}
                      className="w-full accent-[#0A0A0A]"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>1.5x (baixa margem)</span>
                      <span>5.0x (alta margem)</span>
                    </div>
                  </div>

                  {/* Sell price (editable) */}
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
                     <div>
                       <span className="text-sm font-medium text-[#0A0A0A]">Ganho estimado por venda</span>
                       <p className="text-[10px] text-gray-400 mt-0.5">Custo total ({formatBRL(totalCost)}) → Venda ({formatBRL(sellPrice)})</p>
                     </div>
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

                  {sellPrice > 0 && sellPrice <= totalCost && (
                    <div className="flex items-center gap-2 text-red-500">
                      <AlertCircle size={14} />
                      <span className="text-xs font-semibold">O preço de venda deve ser maior que o custo total</span>
                    </div>
                  )}

                  {profit > 0 && profitMargin >= 40 && (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <TrendingUp size={14} />
                      <span className="text-xs font-semibold">Boa relação entre custo e preço de venda</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: Review */}
            {step === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-[#0A0A0A]">Resumo do anúncio</h3>
                  <p className="text-sm text-gray-500 mt-1">Tudo certo? Confirme e publique</p>
                </div>

                {/* Publish checklist */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Checklist de publicação</p>
                  {[
                    { ok: isConnectedToML === true, label: "Mercado Livre conectado" },
                    { ok: hasStock, label: `Estoque disponível (${stockQty} un)` },
                    { ok: sellPrice > totalCost, label: "Preço de venda definido" },
                    { ok: translated || title !== product.title, label: "Produto traduzido/adaptado" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full ${item.ok ? "bg-emerald-100" : "bg-red-100"}`}>
                        {item.ok ? <Check size={11} className="text-emerald-600" /> : <X size={11} className="text-red-500" />}
                      </div>
                      <span className={`text-sm ${item.ok ? "text-[#0A0A0A]" : "text-red-500"}`}>{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  {[
                    { label: "Título", value: title },
                    { label: "Plataforma", value: "Mercado Livre" },
                    { label: "Custo total", value: formatBRL(totalCost) },
                    { label: "Preço de venda", value: formatBRL(sellPrice) },
                    { label: "Estoque publicado", value: `${Math.min(stockQty, 10)} unidades` },
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
                    <span className="text-sm font-bold text-[#0A0A0A]">Ganho estimado por venda</span>
                    <span
                      className={`text-xl font-black ${
                        profit > 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {formatBRL(profit)}
                    </span>
                  </div>
                </div>

                {/* AI Description section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-[#0A0A0A] flex items-center gap-2">
                      <Edit3 size={14} className="text-gray-400" />
                      Descrição do anúncio
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleGenerateDescription}
                        disabled={generatingDesc}
                        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:from-violet-600 hover:to-purple-700 transition-all disabled:opacity-50"
                      >
                        {generatingDesc ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Sparkles size={12} />
                        )}
                        {generatingDesc ? "Gerando..." : descGenerated ? "Regenerar com IA" : "Gerar com IA"}
                      </button>
                      <button
                        onClick={async () => {
                          if (!description.trim()) {
                            toast.error("Crie uma descrição antes de fazer o vídeo");
                            return;
                          }
                          const productImage = img || '';
                          const getImageWithFormat = (imageUrl: string): string => {
                            if (!imageUrl) return '';
                            if (imageUrl.match(/\.(png|jpg|jpeg)(\?|$)/i)) return imageUrl;
                            if (imageUrl.includes('.webp')) return imageUrl.replace('.webp', '.jpg');
                            const separator = imageUrl.includes('?') ? '&' : '?';
                            return `${imageUrl}${separator}format=jpg`;
                          };
                          const formattedImageUrl = getImageWithFormat(productImage);
                          const originalUrl = product.original_url || `https://cjdropshipping.com/product/${product.id}`;
                          const productInfo = `Título: ${title}\nDescrição: ${description}\nLink Original: ${originalUrl}\nURL Imagem: ${formattedImageUrl}`;
                          try {
                            if (formattedImageUrl) {
                              const response = await fetch(formattedImageUrl);
                              const blob = await response.blob();
                              await navigator.clipboard.write([
                                new ClipboardItem({
                                  'text/plain': new Blob([productInfo], { type: 'text/plain' }),
                                  [blob.type]: blob
                                })
                              ]);
                              toast.success("Informações e imagem copiadas! Cole no Bandy.ai");
                            } else {
                              await navigator.clipboard.writeText(productInfo);
                              toast.success("Informações copiadas! Cole no Bandy.ai");
                            }
                          } catch (err) {
                            try {
                              await navigator.clipboard.writeText(productInfo);
                              toast.success("Informações copiadas! Cole no Bandy.ai");
                            } catch {
                              toast.error("Erro ao copiar. Tente novamente.");
                            }
                          }
                          const bandyUrl = `https://bandy.ai/agent?new&product=${encodeURIComponent(formattedImageUrl)}&title=${encodeURIComponent(title)}`;
                          window.open(bandyUrl, '_blank', 'noopener,noreferrer');
                        }}
                        disabled={!description.trim()}
                        className={`flex items-center gap-1.5 rounded-lg bg-gradient-to-r px-3 py-1.5 text-xs font-bold text-white transition-all ${
                          description.trim() 
                            ? "from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700" 
                            : "from-gray-400 to-gray-500 cursor-not-allowed opacity-50"
                        }`}
                      >
                        <Play size={12} />
                        Criar vídeo
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Clique em 'Gerar com IA' para criar uma descrição persuasiva, ou escreva manualmente..."
                    rows={5}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/10 focus:border-[#0A0A0A]/30 transition-all placeholder:text-gray-400 resize-none"
                  />
                  {descGenerated && (
                    <p className="text-xs text-violet-500 flex items-center gap-1">
                      <Sparkles size={10} />
                      Descrição gerada por IA — edite se necessário
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: Success */}
            {step === 4 && publishResult && (
              <div className="space-y-6 animate-fade-in flex flex-col items-center justify-center py-10">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <Check size={32} className="text-emerald-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-[#0A0A0A]">Anúncio publicado!</h3>
                  <p className="text-sm text-gray-500 mt-1">Seu produto já está disponível no Mercado Livre</p>
                  <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg px-3 py-2">
                    💡 Se o anúncio aparecer pausado, acesse Meus Anúncios no Mercado Livre e clique em "Ativar". Isso é normal para contas novas.
                  </p>
                </div>
                <div className="w-full max-w-sm space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
                    <span className="text-sm text-gray-500">ID do anúncio</span>
                    <span className="text-sm font-bold text-[#0A0A0A]">{publishResult.item_id}</span>
                  </div>
                  <a
                    href={publishResult.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#0A0A0A] px-5 py-3 text-sm font-bold text-white hover:bg-[#1a1a1a] transition-colors"
                  >
                    <ExternalLink size={14} />
                    Ver anúncio no Mercado Livre
                  </a>
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
              {step === 4 ? "Fechar" : "Cancelar"}
            </button>
            <div className="flex items-center gap-3">
              {step > 1 && step < 4 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-[#0A0A0A] hover:bg-gray-50 transition-colors"
                >
                  Voltar
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={() => {
                    if (step === 1 && !isConnectedToML) {
                      toast.error("Conecte sua conta do Mercado Livre para continuar");
                      return;
                    }
                    if (step === 1 && !hasStock) {
                      toast.error("Produto sem estoque. Não é possível continuar.");
                      return;
                    }
                    setStep(step + 1);
                  }}
                  className={`rounded-xl px-6 py-2.5 text-sm font-bold transition-colors ${
                    (step === 1 && (!isConnectedToML || !hasStock))
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-[#0A0A0A] text-white hover:bg-[#1a1a1a]"
                  }`}
                >
                  Continuar
                </button>
              ) : step === 3 ? (
                <button
                  onClick={handlePublish}
                  disabled={publishing || !isConnectedToML || !hasStock}
                  className={`rounded-xl px-6 py-2.5 text-sm font-bold transition-colors flex items-center gap-2 ${
                    publishing || !isConnectedToML || !hasStock
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-[#0A0A0A] text-white hover:bg-[#1a1a1a]"
                  }`}
                >
                  {publishing && <Loader2 size={14} className="animate-spin" />}
                  {publishing ? "Publicando..." : "Publicar no Mercado Livre"}
                </button>
              ) : null}
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
                  +{formatBRL(profit)} de margem
                </span>
              )}
            </div>

            {/* Stock badge */}
            <div className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${
              stockQty > 50 ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50" :
              stockQty >= 10 ? "bg-amber-50 text-amber-700 border border-amber-200/50" :
              stockQty > 0 ? "bg-red-50 text-red-700 border border-red-200/50" :
              "bg-red-50 text-red-700 border border-red-200/50"
            }`}>
              {stockQty === 0 ? "Sem estoque" : `${stockQty} em estoque`}
            </div>

            {/* Description preview */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Texto do anúncio</p>
              <div className="rounded-xl bg-white border border-gray-100 p-4">
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {description || "Descrição será gerada no passo de revisão..."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportProductModal;
