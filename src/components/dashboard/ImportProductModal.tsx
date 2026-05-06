import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { X, Check, Loader2, Sparkles, Globe, ExternalLink, Play, ArrowRight, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UpgradeLimitModal from "@/components/UpgradeLimitModal";
import { usePlanLimits } from "@/hooks/usePlanLimits";

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
  variants?: any;
};

type Props = {
  open: boolean;
  onClose: () => void;
  product: CatalogProduct | null;
};

const MAX_TITLE_LENGTH = 60;
const ACCENT = "#0A0A0A"; // black

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

const getFirstCjVariantId = (variants: any): string | null => {
  try {
    const parsed = typeof variants === "string" ? JSON.parse(variants) : variants;
    const first = Array.isArray(parsed) ? parsed[0] : parsed?.[0] ?? parsed;

    return (
      first?.vid ??
      first?.variantId ??
      first?.variant_id ??
      first?.id ??
      first?.skuId ??
      first?.sku_id ??
      null
    );
  } catch {
    return null;
  }
};

const getCjProductUrl = (externalId?: string | null) =>
  externalId ? `https://www.cjdropshipping.com/product-detail.html?id=${encodeURIComponent(externalId)}` : null;

const STEPS = [
  { num: 1, label: "Detalhes" },
  { num: 2, label: "Revisão" },
];

const ImportProductModal = ({ open, onClose, product }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const planLimits = usePlanLimits();

  const [step, setStep] = useState(1); // Start at step 1 (details)
  const [title, setTitle] = useState("");
  const [sellPrice, setSellPrice] = useState(0);
  const [visible, setVisible] = useState(false);
  const [isConnectedToML, setIsConnectedToML] = useState<boolean | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ permalink: string; item_id: string } | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Pricing engine
  const [multiplier, setMultiplier] = useState(2.5);

  // AI description
  const [description, setDescription] = useState("");
  const [generatingDesc, setGeneratingDesc] = useState(false);

  // Translation
  const [translating, setTranslating] = useState(false);
  const [translatingDescription, setTranslatingDescription] = useState(false);
  const [translated, setTranslated] = useState(false);

  // Platforms (step 3)
  const [platforms, setPlatforms] = useState<{ ml: boolean; shopee: boolean; tiktok: boolean }>({
    ml: true,
    shopee: false,
    tiktok: false,
  });

  // Check ML connection
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

  // Animate
  useEffect(() => {
    if (open) requestAnimationFrame(() => setVisible(true));
    else setVisible(false);
  }, [open]);

  // Reset on product change
  const [lastProductId, setLastProductId] = useState<string | null>(null);
  if (product && product.id !== lastProductId) {
    setLastProductId(product.id);
    const truncated = product.title.length > MAX_TITLE_LENGTH
      ? product.title.substring(0, MAX_TITLE_LENGTH)
      : product.title;
    setTitle(truncated);
    setMultiplier(2.5);
    setSellPrice(Math.round(product.cost_price * 2.5 * 100) / 100);
    setStep(1);
    setPublishResult(null);
    setPublishing(false);
    setDescription("");
    setTranslated(false);
  }

  const costPrice = product?.cost_price ?? 0;
  const totalCost = costPrice;

  const recalcPrice = (mult: number) => {
    setSellPrice(Math.round(costPrice * mult * 100) / 100);
  };

  const profit = useMemo(() => Math.round((sellPrice - totalCost) * 100) / 100, [sellPrice, totalCost]);
  const profitMargin = useMemo(
    () => (sellPrice > 0 ? Math.round(((sellPrice - totalCost) / sellPrice) * 100) : 0),
    [sellPrice, totalCost]
  );

  const img = product ? getImage(product.images) : null;
  const stockQty = product?.stock_quantity ?? 0;
  const hasStock = stockQty > 0;

  useEffect(() => {
    if (!open || !product?.description) return;

    let cancelled = false;

    const translateDescription = async () => {
      setTranslatingDescription(true);
      try {
        const { data, error } = await supabase.functions.invoke("chat", {
          body: {
            messages: [{
              role: "user",
              content: `Você é um tradutor especialista em e-commerce brasileiro. Traduza a descrição deste produto para português do Brasil, mantendo o sentido original e adaptando termos naturais de venda. Não invente características novas. Responda APENAS com a descrição traduzida, sem introdução, sem comentários.\n\nDescrição original:\n${product.description}`
            }]
          },
        });

        if (error) throw error;
        const text = data?.response || data?.choices?.[0]?.message?.content || "";

        if (!cancelled && typeof text === "string" && text.trim()) {
          setDescription(text.trim());
        }
      } catch {
        if (!cancelled) setDescription(product.description ?? "");
      } finally {
        if (!cancelled) setTranslatingDescription(false);
      }
    };

    void translateDescription();

    return () => {
      cancelled = true;
    };
  }, [open, product?.id, product?.description]);

  const handleClose = () => {
    if (publishing) return;
    setVisible(false);
    setTimeout(onClose, 160);
  };

  const handleConnectML = async () => {
    if (!user) return;
    const { data, error } = await supabase.functions.invoke("ml-connect");
    const authUrl = data?.authUrl ?? data?.auth_url;
    if (error || !authUrl) {
      toast.error("Não foi possível iniciar a conexão com o Mercado Livre");
      return;
    }
    window.location.href = authUrl;
  };

  const handleTranslate = async () => {
    if (!product) return;
    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [{
            role: "user",
            content: `Você é um tradutor especialista em e-commerce brasileiro. Traduza o nome deste produto para português do Brasil, adaptando para linguagem de venda. Máximo ${MAX_TITLE_LENGTH} caracteres. Produto: "${product.title}". Responda APENAS com o título traduzido, sem aspas, sem explicação.`
          }]
        },
      });
      if (error) throw error;
      const text = data?.response || data?.choices?.[0]?.message?.content || "";
      if (typeof text === "string" && text.trim()) {
        const cleaned = text.trim().replace(/^["']|["']$/g, '');
        const truncated = cleaned.length > MAX_TITLE_LENGTH ? cleaned.substring(0, MAX_TITLE_LENGTH) : cleaned;
        setTitle(truncated);
        setTranslated(true);
        toast.success("Título traduzido");
      } else {
        toast.error("Não foi possível traduzir");
      }
    } catch {
      toast.error("Erro ao traduzir");
    } finally {
      setTranslating(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!product) return;
    setGeneratingDesc(true);
    try {
      const price = sellPrice.toFixed(2).replace(".", ",");
      const category = product.category || "Não informada";
      const productDescriptionPrompt = `Crie uma legenda de produto natural, persuasiva e humana para marketplace de dropshipping, com base nestas informações:

Nome: ${title}
Categoria: ${category}
Preço: R$ ${price}

Regras obrigatórias:
- Escreva como uma marca que entende o problema do cliente e apresenta o produto como solução prática.
- Não use emojis em hipótese alguma.
- Não use frases genéricas como "produto incrível", "alta qualidade", "perfeito para você", "imperdível" ou clichês similares.
- Evite tom artificial, exagerado, robótico ou de IA.
- Foque em benefício real, uso no dia a dia, praticidade e motivo de compra.
- Linguagem simples, direta e convincente, como um vendedor experiente falando.
- Português brasileiro.
- Entre 3 e 6 linhas no total (parágrafos curtos, sem bullet points).
- Finalize com uma chamada sutil para ação (não agressiva).

Retorne APENAS a legenda, sem títulos, introduções ou comentários.`;

      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          mode: "product_description",
          messages: [{
            role: "user",
            content: productDescriptionPrompt
          }]
        },
      });
      if (error) throw error;
      const text = data?.response || data?.choices?.[0]?.message?.content || "";
      if (typeof text === "string" && text.trim()) {
        setDescription(text.trim());
        toast.success("Descrição gerada");
      } else {
        toast.error("Não foi possível gerar a descrição");
      }
    } catch {
      toast.error("Erro ao gerar descrição");
    } finally {
      setGeneratingDesc(false);
    }
  };

  const validatePublish = (): boolean => {
    if (!title.trim()) return toast.error("Preencha o título"), false;
    if (title.length > MAX_TITLE_LENGTH) return toast.error(`Máximo ${MAX_TITLE_LENGTH} caracteres`), false;
    if (sellPrice <= 0) return toast.error("Defina um preço válido"), false;
    if (sellPrice <= totalCost) return toast.error("Preço deve ser maior que o custo"), false;
    if (!platforms.ml && !platforms.shopee && !platforms.tiktok) return toast.error("Selecione ao menos uma plataforma"), false;
    if (platforms.ml && !isConnectedToML) return toast.error("Conecte sua conta do Mercado Livre"), false;
    if (!hasStock) return toast.error("Produto sem estoque"), false;
    return true;
  };

  const handlePublish = async () => {
    if (!validatePublish() || !user) return;

    if (planLimits.loading) {
      toast.info("Verificando seu plano...");
      return;
    }

    if (!planLimits.canPublishToMarketplace) {
      setUpgradeModalOpen(true);
      return;
    }

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
          product: {
            id: product?.id,
            external_id: product?.external_id,
            cj_product_id: product?.external_id ?? null,
            cj_product_url: getCjProductUrl(product?.external_id),
            cj_variant_id: getFirstCjVariantId(product?.variants),
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
        toast.error(data?.error || error?.message || "Erro ao publicar");
        setPublishing(false);
        return;
      }

      setPublishResult({ permalink: data.permalink, item_id: data.item_id });
      setStep(3);

      toast.success("Produto publicado com sucesso");
      if (data.permalink) window.open(data.permalink, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err?.message || "Erro inesperado");
    } finally {
      setPublishing(false);
    }
  };

  if (!open && !visible) return null;
  if (!product) return null;

  const titleLength = title.length;
  const canAdvance = step === 1 ? (hasStock && isConnectedToML && !!title.trim() && sellPrice > totalCost) : true;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-150 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`relative flex w-full max-w-[1040px] h-full overflow-hidden bg-white shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.2)] transition-transform duration-150 ease-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ============== LEFT — MAIN ============== */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between px-8 pt-7 pb-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[#0A0A0A] leading-tight">Importar Produto</h2>
                <p className="text-[12.5px] text-gray-500 mt-0.5">Publique facilmente no Mercado Livre.</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Stepper */}
          <div className="px-8 pb-6">
            <div className="flex items-center">
              {STEPS.map((s, i) => {
                const active = step === s.num;
                const done = step > s.num;
                return (
                  <div key={s.num} className="flex items-center flex-1 last:flex-initial">
                    <button
                      onClick={() => { if (done) setStep(s.num); }}
                      className="flex items-center gap-2.5 group"
                      disabled={!done && !active}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-300 ${
                          active
                            ? "text-white shadow-[0_0_0_4px_rgba(249,115,22,0.15)]"
                            : done
                            ? "bg-[#0A0A0A] text-white"
                            : "bg-gray-100 text-gray-400"
                        }`}
                        style={active ? { background: ACCENT } : undefined}
                      >
                        {done ? <Check size={12} strokeWidth={3} /> : s.num}
                      </span>
                      <span
                        className={`text-[13px] font-medium transition-colors ${
                          active ? "text-[#0A0A0A]" : done ? "text-[#0A0A0A]" : "text-gray-400"
                        }`}
                      >
                        {s.label}
                      </span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <div className="flex-1 mx-3 h-px bg-gray-200 relative overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-[#0A0A0A] transition-all duration-500 ease-out"
                          style={{ width: step > s.num ? "100%" : "0%" }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content — animated per step */}
          <div className="flex-1 overflow-y-auto px-8" style={{ scrollbarWidth: "thin", minHeight: 320 }}>
            {/* STEP 1 — Detalhes */}
            {step === 1 && (
              <div key="s2" className="step-fade space-y-6 pb-6">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0A0A0A]">Título e precificação</h3>
                  <p className="text-[12.5px] text-gray-500 mt-1">Edite o título e defina seu preço de venda.</p>
                </div>

                {/* Connection status */}
                {isConnectedToML === false && (
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
                    <div>
                      <p className="text-[13px] font-medium text-[#0A0A0A]">Conecte sua conta</p>
                      <p className="text-[11.5px] text-gray-500 mt-0.5">É necessário para publicar anúncios</p>
                    </div>
                    <button
                      onClick={handleConnectML}
                      className="rounded-lg bg-[#0A0A0A] px-3.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#1a1a1a] transition-colors"
                    >
                      Conectar
                    </button>
                  </div>
                )}

                {/* Stock warning */}
                {!hasStock && (
                  <div className="rounded-xl border border-red-100 bg-red-50/40 px-4 py-3">
                    <p className="text-[13px] font-medium text-red-600">Produto sem estoque disponível</p>
                    <p className="text-[11.5px] text-red-500/80 mt-0.5">Não é possível continuar com este produto.</p>
                  </div>
                )}

                {/* Title */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-medium text-gray-600">Título do anúncio</label>
                    <button
                      onClick={handleTranslate}
                      disabled={translating}
                      className="flex items-center gap-1.5 text-[11.5px] font-medium text-gray-500 hover:text-[#0A0A0A] transition-colors disabled:opacity-50"
                    >
                      {translating ? <Loader2 size={11} className="animate-spin" /> : <Globe size={11} />}
                      {translating ? "Traduzindo" : translated ? "Retraduzir" : "Traduzir p/ PT-BR"}
                    </button>
                  </div>
                  <input
                    value={title}
                    onChange={(e) => { if (e.target.value.length <= MAX_TITLE_LENGTH) setTitle(e.target.value); }}
                    maxLength={MAX_TITLE_LENGTH}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] text-[#0A0A0A] focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-400"
                    placeholder="Digite o título"
                  />
                  <p className="text-[10.5px] text-gray-400 text-right mt-1.5">{titleLength}/{MAX_TITLE_LENGTH}</p>
                </div>

                {/* Pricing — minimal rows */}
                <div className="space-y-3">
                  <p className="text-[12px] font-medium text-gray-600">Precificação</p>

                  <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                    <Row label="Custo do produto" value={formatBRL(costPrice)} />
                  </div>

                  {/* Multiplier */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[12px] font-medium text-gray-600">Multiplicador</span>
                      <span className="text-[13px] font-semibold text-[#0A0A0A]">{multiplier.toFixed(1)}x</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min="1.5"
                        max="5.0"
                        step="0.1"
                        value={multiplier}
                        onChange={(e) => { const v = Number(e.target.value); setMultiplier(v); recalcPrice(v); }}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 slider"
                        style={{
                          background: `linear-gradient(to right, ${ACCENT} 0%, ${ACCENT} ${((multiplier - 1.5) / (5.0 - 1.5)) * 100}%, #e5e7eb ${((multiplier - 1.5) / (5.0 - 1.5)) * 100}%, #e5e7eb 100%)`
                        }}
                      />
                      <style jsx>{`
                        .slider::-webkit-slider-thumb {
                          appearance: none;
                          height: 18px;
                          width: 18px;
                          border-radius: 50%;
                          background: ${ACCENT};
                          cursor: pointer;
                          border: 2px solid white;
                          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                        }
                        .slider::-moz-range-thumb {
                          height: 18px;
                          width: 18px;
                          border-radius: 50%;
                          background: ${ACCENT};
                          cursor: pointer;
                          border: 2px solid white;
                          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                        }
                      `}</style>
                    </div>
                  </div>

                  {/* Sell price */}
                  <div>
                    <label className="text-[12px] font-medium text-gray-600 mb-2 block">Preço de venda</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] text-gray-400">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={sellPrice || ""}
                        readOnly
                        className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Profit single line */}
                  <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                    <span className="text-[12px] text-gray-500">Lucro por venda</span>
                    <span className={`text-[13.5px] font-semibold ${profit > 0 ? "text-[#0A0A0A]" : "text-red-500"}`}>
                      {formatBRL(profit)} <span className="text-[11px] font-medium text-gray-400 ml-1">· {profitMargin}%</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 — Revisão */}
            {step === 2 && (
              <div key="s3" className="step-fade space-y-6 pb-6">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0A0A0A]">Revisar anúncio</h3>
                  <p className="text-[12.5px] text-gray-500 mt-1">Escolha onde publicar e finalize a descrição.</p>
                </div>

                {/* Platforms — pick where to publish */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Store size={12} className="text-gray-500" />
                    <p className="text-[12px] font-medium text-gray-600">Publicar em</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <PlatformCard
                      name="Mercado Livre"
                      status={isConnectedToML ? "Conectado" : "Desconectado"}
                      disabled={!isConnectedToML}
                      selected={platforms.ml && !!isConnectedToML}
                      onToggle={() => { if (isConnectedToML) setPlatforms(p => ({ ...p, ml: !p.ml })); }}
                    />
                    <PlatformCard
                      name="Shopee"
                      status="Em breve"
                      disabled
                      selected={false}
                      onToggle={() => {}}
                    />
                    <PlatformCard
                      name="TikTok Shop"
                      status="Em breve"
                      disabled
                      selected={false}
                      onToggle={() => {}}
                    />
                  </div>
                  {!isConnectedToML && (
                    <button
                      onClick={handleConnectML}
                      className="mt-2.5 text-[11.5px] font-medium text-[#0A0A0A] underline hover:no-underline"
                    >
                      Conectar Mercado Livre
                    </button>
                  )}
                </div>

                {/* Summary */}
                <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                  <Row label="Título" value={title} />
                  <Row label="Plataforma" value="Mercado Livre" />
                  <Row label="Preço" value={formatBRL(sellPrice)} />
                  <Row label="Estoque publicado" value={`${Math.min(stockQty, 10)} un`} />
                  <Row label="Lucro" value={formatBRL(profit)} strong />
                </div>

                {/* Description */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-medium text-gray-600">Descrição do anúncio</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleGenerateDescription}
                        disabled={generatingDesc}
                        className="flex items-center gap-1.5 text-[11.5px] font-medium text-gray-500 hover:text-[#0A0A0A] transition-colors disabled:opacity-50"
                      >
                        {generatingDesc ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                        {generatingDesc ? "Gerando" : "Gerar com IA"}
                      </button>
                      <button
                        onClick={() => {
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
                          // Build full images array for the download section
                          const allImages: string[] = (() => {
                            try {
                              const arr = typeof product.images === "string"
                                ? JSON.parse(product.images)
                                : product.images;
                              return Array.isArray(arr)
                                ? arr.map((u: string) => getImageWithFormat(u)).filter(Boolean)
                                : [formattedImageUrl].filter(Boolean);
                            } catch { return [formattedImageUrl].filter(Boolean); }
                          })();
                          onClose();
                          navigate('/dashboard/criar-video', {
                            state: {
                              product_title: product.title,
                              product_image: formattedImageUrl,
                              product_images: allImages,
                              product_description: description,
                              cost_price: product.cost_price,
                              sale_price: product.suggested_price,
                              profit: Math.round((product.suggested_price - product.cost_price) * 100) / 100,
                            }
                          });
                        }}
                        disabled={!description.trim()}
                        className="flex items-center gap-1.5 text-[11.5px] font-medium text-gray-500 hover:text-[#0A0A0A] transition-colors disabled:opacity-30"
                      >
                        <Play size={11} />
                        Criar vídeo
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Clique em 'Gerar com IA' ou escreva manualmente…"
                    rows={5}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[13px] text-[#0A0A0A] focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-400 resize-none"
                  />
                </div>
              </div>
            )}

            {/* STEP 3 — Success */}
            {step === 3 && publishResult && (
              <div key="s4" className="step-fade flex flex-col items-center justify-center py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full mb-5" style={{ background: ACCENT }}>
                  <Check size={26} strokeWidth={3} className="text-white" />
                </div>
                <h3 className="text-[16px] font-semibold text-[#0A0A0A]">Anúncio publicado</h3>
                <p className="text-[12.5px] text-gray-500 mt-1.5 max-w-[320px]">Seu produto já está no Mercado Livre. ID: <span className="font-medium text-[#0A0A0A]">{publishResult.item_id}</span></p>
                <a
                  href={publishResult.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary btn-primary--md mt-6"
                >
                  <ExternalLink size={13} />
                  Abrir no Mercado Livre
                </a>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 px-8 py-4 bg-white">
            <p className="text-[11.5px] text-gray-400">
              Saiba mais sobre <span className="text-[#0A0A0A] underline cursor-pointer">Importar Produto</span>
            </p>
            <div className="flex items-center gap-2">
              {step < 4 && (
                <button
                  onClick={handleClose}
                  className="rounded-[100px] px-4 py-2 text-[12.5px] font-[400] text-[#737373] transition-all duration-[120ms] hover:text-[#0A0A0A]"
                >
                  Cancelar
                </button>
              )}
              {step > 1 && step < 4 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="rounded-[100px] border-[1.5px] border-[#E5E5E5] px-4 py-2 text-[12.5px] font-[400] text-[#0A0A0A] transition-all duration-[120ms] hover:border-[#0A0A0A] hover:bg-[#F5F5F5]"
                >
                  Voltar
                </button>
              )}
              {step < 2 && (
                <button
                  onClick={() => { if (canAdvance) setStep(step + 1); else toast.error("Conecte a conta, confira o estoque, título e preço"); }}
                  disabled={!canAdvance}
                  className="btn-primary btn-primary--md"
                >
                  Próximo
                  <ArrowRight size={13} />
                </button>
              )}
              {step === 2 && (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="btn-primary btn-primary--md"
                >
                  {publishing && <Loader2 size={13} className="animate-spin" />}
                  {publishing ? "Publicando" : "Publicar"}
                </button>
              )}
              {step === 3 && (
                <button
                  onClick={handleClose}
                  className="btn-primary btn-primary--md"
                >
                  Concluir
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ============== RIGHT — PRODUCT DETAIL ============== */}
        <div className="w-[300px] shrink-0 border-l border-gray-100 bg-gray-50/40 flex flex-col">
          <div className="flex items-center justify-between px-6 pt-7 pb-4">
            <h3 className="text-[13px] font-semibold text-[#0A0A0A]">Detalhes do produto</h3>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5" style={{ scrollbarWidth: "thin" }}>
            {/* Image + title */}
            <div className="flex gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white border border-gray-100">
                {img ? <img src={img} alt={title} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-[#0A0A0A] leading-snug line-clamp-2">{title || product.title}</p>
                <p className="text-[10.5px] text-gray-400 mt-1 truncate">SKU: {product.external_id || product.id.substring(0, 10)}</p>
              </div>
            </div>

            {/* Categories */}
            {product.category && (
              <div className="flex gap-1.5 flex-wrap">
                <span className="rounded-md bg-white border border-gray-200 px-2 py-0.5 text-[10.5px] font-medium text-gray-600 capitalize">
                  {product.category}
                </span>
              </div>
            )}

            {/* Divider */}
            <div className="h-px bg-gray-200" />

            {/* Info rows */}
            <div className="space-y-3">
              <DetailRow label="Plataforma" value={
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-yellow-400" />
                  Mercado Livre
                </span>
              } />
              <DetailRow label="Preço" value={<span className="font-semibold text-[#0A0A0A]">{formatBRL(sellPrice || costPrice * 2.5)}</span>} />
              <DetailRow label="Estoque" value={`${stockQty} un`} />
              <DetailRow label="Custo" value={formatBRL(costPrice)} />
              {step >= 2 && <DetailRow label="Lucro" value={<span className={profit > 0 ? "text-[#0A0A0A] font-medium" : "text-red-500"}>{formatBRL(profit)}</span>} />}
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-200" />

            {/* Description preview */}
            <div>
              <p className="text-[10.5px] font-medium text-gray-400 uppercase tracking-wide mb-2">Descrição</p>
              <p className="text-[12px] text-gray-600 leading-relaxed line-clamp-6">
                {translatingDescription
                  ? "Traduzindo descrição para PT-BR..."
                  : description || "A descrição aparecerá aqui quando for gerada ou escrita."}
              </p>
            </div>
          </div>
        </div>

        {/* Publishing overlay */}
        {publishing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-[3px] animate-in fade-in duration-200">
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white border border-gray-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] px-10 py-8">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 rounded-full border-2 border-gray-100" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: ACCENT }} />
              </div>
              <div className="text-center">
                <p className="text-[13.5px] font-semibold text-[#0A0A0A]">Aguarde um momento</p>
                <p className="text-[11.5px] text-gray-500 mt-0.5">Publicando seu anúncio…</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <UpgradeLimitModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Publicação disponível no plano Pro"
        message="Para publicar produtos no Mercado Livre, você precisa de um plano pago. Comece agora por R$99,90/mês."
        cta="Fazer upgrade"
      />

      {/* Animations */}
      <style>{`
        .step-fade {
          animation: stepIn 150ms ease both;
        }
        @keyframes stepIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  , document.body);
};

/* ---------- Small presentational helpers ---------- */

const Row = ({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) => (
  <div className="flex items-center justify-between px-4 py-2.5">
    <span className="text-[12px] text-gray-500">{label}</span>
    <span className={`text-[12.5px] text-right truncate max-w-[60%] ${strong ? "font-semibold text-[#0A0A0A]" : "text-[#0A0A0A]"}`}>
      {value}
    </span>
  </div>
);

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between">
    <span className="text-[11.5px] text-gray-500">{label}</span>
    <span className="text-[12px] text-[#0A0A0A]">{value}</span>
  </div>
);

const PlatformCard = ({
  name, status, selected, disabled, onToggle,
}: {
  name: string; status: string; selected: boolean; disabled?: boolean; onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    disabled={disabled}
    className={`relative rounded-xl border p-3 text-center transition-all ${
      selected
        ? "border-[#0A0A0A] bg-[#0A0A0A]/[0.02]"
        : disabled
        ? "border-gray-200 opacity-50 cursor-not-allowed"
        : "border-gray-200 hover:border-gray-400"
    }`}
  >
    {selected && (
      <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#0A0A0A]">
        <Check size={9} strokeWidth={3} className="text-white" />
      </span>
    )}
    <p className={`text-[12.5px] font-semibold ${selected ? "text-[#0A0A0A]" : disabled ? "text-gray-500" : "text-[#0A0A0A]"}`}>
      {name}
    </p>
    <p className="text-[10.5px] text-gray-400 mt-0.5">{status}</p>
  </button>
);

export default ImportProductModal;
