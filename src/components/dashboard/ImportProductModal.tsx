import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { X, Check, Loader2, Sparkles, Globe, ExternalLink, Play, ArrowRight, Store, ShieldCheck } from "lucide-react";
import { veloToast } from "@/components/ui/velo-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UpgradeLimitModal from "@/components/UpgradeLimitModal";
import MLAccountVerificationModal from "@/components/dashboard/MLAccountVerificationModal";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useStartMode } from "@/hooks/useStartMode";
import {
  getActiveStore,
  getStorePublishedCount,
  incrementStorePublishedCount,
} from "@/components/dashboard/FirstStoreOnboarding";

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
  brand?: string | null;
  model?: string | null;
  supplier_name?: string | null;
  weight?: number | null;
  product_url?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  product: CatalogProduct | null;
  /**
   * Se true, ao clicar em "Publicar produto" na etapa Revisão exibimos o
   * tutorial de verificação da conta do Mercado Livre em vez de publicar.
   * Deixe indefinido/false enquanto não houver um sinal real do backend
   * indicando conta não verificada / fora do modo vendedor.
   */
  mlAccountNeedsVerification?: boolean;
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

const STEPS = [
  { num: 1, label: "Detalhes" },
  { num: 2, label: "Revisão" },
  { num: 3, label: "Trial" },
];

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const KNOWN_BRANDS: Array<{ label: string; patterns: string[] }> = [
  { label: "Panini", patterns: ["panini"] },
  { label: "X-Cell", patterns: ["x-cell", "x cell", "xcell"] },
  { label: "Laikou", patterns: ["laikou"] },
  { label: "Hegai", patterns: ["hegai"] },
  { label: "Vortita", patterns: ["vortita"] },
  { label: "Queen Oil", patterns: ["queen oil", "queenoil"] },
  { label: "OleAura", patterns: ["oleaura", "ole aura"] },
  { label: "Samsung", patterns: ["samsung"] },
  { label: "Apple", patterns: ["apple", "iphone", "ipad", "macbook"] },
  { label: "Xiaomi", patterns: ["xiaomi", "redmi", "poco"] },
  { label: "Motorola", patterns: ["motorola", "moto g", "moto e"] },
  { label: "LG", patterns: ["lg"] },
  { label: "Philips", patterns: ["philips"] },
  { label: "Mondial", patterns: ["mondial"] },
  { label: "Britânia", patterns: ["britania"] },
  { label: "Philco", patterns: ["philco"] },
  { label: "Cadence", patterns: ["cadence"] },
  { label: "Oster", patterns: ["oster"] },
  { label: "Arno", patterns: ["arno"] },
  { label: "Tramontina", patterns: ["tramontina"] },
  { label: "Stanley", patterns: ["stanley"] },
  { label: "JBL", patterns: ["jbl"] },
  { label: "Sony", patterns: ["sony"] },
  { label: "Intelbras", patterns: ["intelbras"] },
  { label: "Multilaser", patterns: ["multilaser"] },
  { label: "Positivo", patterns: ["positivo"] },
  { label: "Logitech", patterns: ["logitech"] },
  { label: "Baseus", patterns: ["baseus"] },
  { label: "Ugreen", patterns: ["ugreen"] },
  { label: "Anker", patterns: ["anker"] },
  { label: "Lenovo", patterns: ["lenovo"] },
  { label: "Dell", patterns: ["dell"] },
  { label: "HP", patterns: ["hp"] },
  { label: "Canon", patterns: ["canon"] },
  { label: "Epson", patterns: ["epson"] },
  { label: "Elgin", patterns: ["elgin"] },
  { label: "WAP", patterns: ["wap"] },
  { label: "Karcher", patterns: ["karcher", "kärcher"] },
  { label: "Black+Decker", patterns: ["black+decker", "black decker", "black-decker"] },
  { label: "Fisher-Price", patterns: ["fisher-price", "fisher price"] },
  { label: "Hot Wheels", patterns: ["hot wheels"] },
  { label: "Barbie", patterns: ["barbie"] },
  { label: "Lego", patterns: ["lego"] },
  { label: "Hasbro", patterns: ["hasbro"] },
  { label: "Mattel", patterns: ["mattel"] },
  { label: "Nike", patterns: ["nike"] },
  { label: "Adidas", patterns: ["adidas"] },
  { label: "Puma", patterns: ["puma"] },
  { label: "Olympikus", patterns: ["olympikus"] },
  { label: "Mizuno", patterns: ["mizuno"] },
  { label: "Asics", patterns: ["asics"] },
  { label: "Havaianas", patterns: ["havaianas"] },
  { label: "Crocs", patterns: ["crocs"] },
  { label: "Nivea", patterns: ["nivea", "nívea"] },
  { label: "L'Oréal", patterns: ["loreal", "l'oreal", "l'oréal"] },
  { label: "Garnier", patterns: ["garnier"] },
  { label: "Maybelline", patterns: ["maybelline"] },
  { label: "Ruby Rose", patterns: ["ruby rose"] },
  { label: "Macrilan", patterns: ["macrilan"] },
  { label: "Vult", patterns: ["vult"] },
  { label: "Eudora", patterns: ["eudora"] },
  { label: "Natura", patterns: ["natura"] },
  { label: "O Boticário", patterns: ["o boticario", "boticario"] },
  { label: "Avon", patterns: ["avon"] },
  { label: "Pantene", patterns: ["pantene"] },
  { label: "Dove", patterns: ["dove"] },
  { label: "Oral-B", patterns: ["oral-b", "oral b"] },
  { label: "Colgate", patterns: ["colgate"] },
  { label: "Gillette", patterns: ["gillette"] },
];

const GENERIC_BRAND = "Genérica";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasBrandPattern = (haystack: string, pattern: string) => {
  const normalizedPattern = normalizeText(pattern);
  if (/^[a-z0-9]{1,3}$/.test(normalizedPattern)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedPattern)}([^a-z0-9]|$)`).test(haystack);
  }
  return haystack.includes(normalizedPattern);
};

const cleanBrandCandidate = (value: string | null | undefined) => {
  const cleaned = (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^[:"'`´\-–—\s]+|[:"'`´\-–—\s]+$/g, "")
    .replace(/\b(modelo|model|produto|product)\b.*$/i, "")
    .trim();

  const normalized = normalizeText(cleaned);
  const invalid = [
    "c7drop",
    "c7 drop",
    "fornecedor",
    "fornecedor verificado",
    "sem marca",
    "nao informado",
    "não informado",
    "generico",
    "genérico",
  ];

  if (!cleaned || cleaned.length > 36 || invalid.includes(normalized)) return "";
  if (/^(maquina|descascador|caixa|kit|suporte|envelope|produto|album|figurinha)\b/i.test(cleaned)) return "";
  return cleaned;
};

const extractExplicitBrand = (value: string) => {
  const match = value.match(/\b(?:marca|brand)\s*[:\-–—]\s*([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9&+.'’\-\s]{1,34})/i);
  return cleanBrandCandidate(match?.[1]);
};

const isStickerAlbumProduct = (product: CatalogProduct | null, title: string) => {
  const haystack = normalizeText(`${title} ${product?.title ?? ""} ${product?.category ?? ""}`);
  return (
    haystack.includes("figurinha") ||
    haystack.includes("album") ||
    haystack.includes("copa do mundo") ||
    haystack.includes("fifa")
  );
};

const inferProductBrand = (product: CatalogProduct | null, title: string) => {
  const savedBrand = cleanBrandCandidate(product?.brand);
  if (savedBrand) return savedBrand;

  const sourceText = [
    title,
    product?.title,
    product?.description,
    product?.category,
    product?.supplier_name,
  ].filter(Boolean).join(" ");

  if (isStickerAlbumProduct(product, title)) return "Panini";

  const explicitBrand = extractExplicitBrand(sourceText);
  if (explicitBrand) return explicitBrand;

  const normalizedSource = normalizeText(sourceText);
  const knownBrand = KNOWN_BRANDS.find((entry) =>
    entry.patterns.some((pattern) => hasBrandPattern(normalizedSource, pattern))
  );
  if (knownBrand) return knownBrand.label;

  const supplierBrand = cleanBrandCandidate(product?.supplier_name);
  if (supplierBrand) return supplierBrand;

  return GENERIC_BRAND;
};

const inferStickerAlbumName = (product: CatalogProduct | null, title: string) => {
  const haystack = normalizeText(`${title} ${product?.title ?? ""}`);
  if (haystack.includes("fifa") || haystack.includes("copa do mundo")) return "Copa do Mundo FIFA 2026";
  return "Álbum colecionável";
};

const ImportProductModal = ({ open, onClose, product, mlAccountNeedsVerification }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const planLimits = usePlanLimits();
  const isStartMode = false;

  const [step, setStep] = useState(1); // Start at step 1 (details)
  const [title, setTitle] = useState("");
  const [sellPrice, setSellPrice] = useState(0);
  const [visible, setVisible] = useState(false);
  const [isConnectedToML, setIsConnectedToML] = useState<boolean | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ permalink: string; item_id: string } | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [mlVerifyModalOpen, setMlVerifyModalOpen] = useState(false);

  // Pricing engine
  const [multiplier, setMultiplier] = useState(2.5);

  // AI description
  const [description, setDescription] = useState("");
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [albumName, setAlbumName] = useState("");
  const [saleFormat, setSaleFormat] = useState<"unit" | "kit">("unit");

  // Translation
  const [translating, setTranslating] = useState(false);
  const [translatingDescription, setTranslatingDescription] = useState(false);
  const [translated, setTranslated] = useState(false);

  // Platforms (review step)
  const [platforms, setPlatforms] = useState<{ ml: boolean; shopee: boolean; tiktok: boolean }>({
    ml: true,
    shopee: false,
    tiktok: false,
  });

  // Marca/Modelo — obrigatórios para publicar em várias categorias do ML.
  // São pré-preenchidos com o que veio do scraper (quando existir) e podem
  // ser editados pelo usuário na etapa de Revisão. Sem marca, o backend usa
  // "Genérica" como fallback; sem modelo, cai para uma versão curta do título.
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
    setBrand(inferProductBrand(product, truncated));
    setModel((product.model ?? "").trim());
    setAlbumName(inferStickerAlbumName(product, truncated));
    setSaleFormat(product.title.toLowerCase().includes("kit") ? "kit" : "unit");
  }

  const costPrice = product?.cost_price ?? 0;
  const totalCost = costPrice;

  const recalcPrice = (mult: number) => {
    setSellPrice(Math.round(costPrice * mult * 100) / 100);
  };

  const handlePriceChange = (val: string) => {
    if (val === "") {
      setSellPrice(0);
      return;
    }
    const numericVal = Number(val);
    if (!isNaN(numericVal)) {
      setSellPrice(numericVal);
      if (costPrice > 0) {
        const calculatedMult = numericVal / costPrice;
        const clampedMult = Math.min(Math.max(calculatedMult, 1.5), 5.0);
        setMultiplier(clampedMult);
      }
    }
  };

  const profit = useMemo(() => Math.round((sellPrice - totalCost) * 100) / 100, [sellPrice, totalCost]);
  const profitMargin = useMemo(
    () => (sellPrice > 0 ? Math.round(((sellPrice - totalCost) / sellPrice) * 100) : 0),
    [sellPrice, totalCost]
  );

  const img = product ? getImage(product.images) : null;
  const stockQty = product?.stock_quantity ?? 0;
  const hasStock = stockQty > 0;
  const requiresStickerAttrs = isStickerAlbumProduct(product, title);
  const saleFormatAttribute = saleFormat === "kit"
    ? { id: "SALE_FORMAT", value_id: "1359392", value_name: "Kit" }
    : { id: "SALE_FORMAT", value_id: "1359391", value_name: "Unidade" };
  const mlAttributes = [
    ...(brand.trim() ? [{ id: "BRAND", value_name: brand.trim() }] : []),
    ...(model.trim() ? [{ id: "MODEL", value_name: model.trim() }] : []),
    ...(requiresStickerAttrs && albumName.trim() ? [{ id: "ALBUM_NAME", value_name: albumName.trim() }] : []),
    ...(requiresStickerAttrs ? [saleFormatAttribute] : []),
  ];

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
      veloToast.error("Não foi possível iniciar a conexão com o Mercado Livre");
      return;
    }
    window.location.href = authUrl;
  };

  const handleTranslate = async () => {
    if (!product) return;
    setTranslating(true);
    const toastId = veloToast.loading("Traduzindo título...");
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
        veloToast.success("Título traduzido", { id: toastId });
      } else {
        veloToast.error("Não foi possível traduzir", { id: toastId });
      }
    } catch {
      veloToast.error("Erro ao traduzir", { id: toastId });
    } finally {
      setTranslating(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!product) return;
    setGeneratingDesc(true);
    const toastId = veloToast.loading("Gerando descrição com IA...");
    try {
      const price = sellPrice.toFixed(2).replace(".", ",");
      const category = product.category || "Não informada";
      const productDescriptionPrompt = `Você é um especialista em copywriting para e-commerce brasileiro.
Gere uma descrição de produto persuasiva e completa para o Mercado Livre
com base nestas informações:

Nome: ${title}
Categoria: ${category}
Preço: R$ ${price}

A descrição deve ter:
- 4 a 6 parágrafos
- Parágrafo 1: apresentação do produto e principal benefício
- Parágrafo 2: características técnicas e diferenciais
- Parágrafo 3: para quem é indicado e situações de uso
- Parágrafo 4: garantia de qualidade e satisfação
- Parágrafo 5: call-to-action persuasivo
- Tom: confiante, vendedor e acessível
- Idioma: português brasileiro
- Não use bullet points, escreva em parágrafos corridos
- Mínimo 300 palavras

Retorne APENAS a descrição, sem introdução, sem comentários.`;

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
        veloToast.success("Descrição gerada", { id: toastId });
      } else {
        veloToast.error("Não foi possível gerar a descrição", { id: toastId });
      }
    } catch {
      veloToast.error("Erro ao gerar descrição", { id: toastId });
    } finally {
      setGeneratingDesc(false);
    }
  };

  const validatePublish = (): boolean => {
    if (!title.trim()) return veloToast.error("Preencha o título"), false;
    if (title.length > MAX_TITLE_LENGTH) return veloToast.error(`Máximo ${MAX_TITLE_LENGTH} caracteres`), false;
    if (sellPrice <= 0) return veloToast.error("Defina um preço válido"), false;
    if (sellPrice <= totalCost) return veloToast.error("Preço deve ser maior que o custo"), false;
    if (!platforms.ml && !platforms.shopee && !platforms.tiktok) return veloToast.error("Selecione ao menos uma plataforma"), false;
    if (platforms.ml && !isConnectedToML) return veloToast.error("Conecte sua conta do Mercado Livre"), false;
    if (!hasStock) return veloToast.error("Produto sem estoque"), false;
    if (platforms.ml && !brand.trim()) return veloToast.error("Informe a marca do produto"), false;
    if (platforms.ml && requiresStickerAttrs && !albumName.trim()) return veloToast.error("Informe o nome do álbum"), false;
    return true;
  };

  const handlePublish = async () => {
    if (!validatePublish() || !user) return;

    const activeStore = getActiveStore();
    if (!activeStore) {
      veloToast.error("Crie uma loja antes de publicar produtos");
      return;
    }

    const publishedCount = getStorePublishedCount(activeStore.id);
    const productLimit = activeStore.productLimit ?? 30;
    if (publishedCount >= productLimit) {
      veloToast.error(`Limite de ${productLimit} produtos atingido nesta loja`);
      return;
    }

    if (planLimits.loading) {
      veloToast.info("Verificando seu plano...");
      return;
    }

    if (!planLimits.canPublishProducts) {
      setUpgradeModalOpen(true);
      return;
    }

    setPublishing(true);
    const toastId = veloToast.loading("Publicando produto...");
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
            cj_product_id: null,
            cj_product_url: product?.original_url ?? null,
            cj_variant_id: null,
            title: title.trim(),
            price: sellPrice,
            cost_price: totalCost,
            description: description || `${title} - Produto de alta qualidade com envio rápido.`,
            images,
            available_quantity: Math.min(stockQty, 10),
            condition: "new",
            brand: brand.trim() || null,
            model: model.trim() || null,
            ml_attributes: mlAttributes,
            weight: typeof product?.weight === "number" ? product.weight : null,
            product_url: product?.product_url ?? null,
          },
        },
      });

      if (error || data?.error) {
        // supabase.functions.invoke esconde o body quando status != 2xx.
        // Tentamos extrair a mensagem amigável do corpo real da resposta.
        let friendly = data?.error as string | undefined;
        const ctxRes = (error as any)?.context;
        if (!friendly && ctxRes && typeof ctxRes.json === "function") {
          try {
            const body = await ctxRes.json();
            friendly = body?.error || body?.message;
          } catch { /* ignore */ }
        }
        veloToast.error(friendly || error?.message || "Erro ao publicar", { id: toastId });
        setPublishing(false);
        return;
      }

      setPublishResult({ permalink: data.permalink, item_id: data.item_id });
      setStep(4);
      incrementStorePublishedCount(activeStore.id);

      veloToast.success("Produto publicado com sucesso", {
        id: toastId,
        action: data.permalink ? { label: "Ver", onClick: () => window.open(data.permalink, "_blank", "noopener,noreferrer") } : undefined,
      });
      void planLimits.refreshUsage();
      if (data.permalink) window.open(data.permalink, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      veloToast.error(err?.message || "Erro inesperado", { id: toastId });
    } finally {
      setPublishing(false);
    }
  };

  const handleContinueFromReview = () => {
    if (planLimits.loading) {
      veloToast.info("Verificando seu plano...");
      return;
    }

    if (!brand.trim()) {
      veloToast.error("Informe a marca do produto (use 'Genérica' se não houver).");
      return;
    }

    // Se o backend sinalizar que a conta ML precisa ser verificada / posta em
    // modo vendedor, abrimos o tutorial em vez de tentar publicar.
    if (mlAccountNeedsVerification) {
      setMlVerifyModalOpen(true);
      return;
    }

    if (planLimits.canPublishProducts) {
      void handlePublish();
      return;
    }

    setStep(3);
  };

  if (!open && !visible) return null;
  if (!product) return null;

  const titleLength = title.length;
  const canAdvance = step === 1 ? (hasStock && isConnectedToML && !!title.trim() && sellPrice > totalCost) : true;
  const startModeOffset = isStartMode ? 48 : 0;
  const reachedProProductLimit = planLimits.plan === "pro" && planLimits.productLimitReached;
  const publishUpgradeTitle = reachedProProductLimit
    ? "Limite do Pro atingido"
    : "Desbloqueie a operação completa";
  const publishUpgradeMessage = reachedProProductLimit
    ? "Você atingiu o limite de 30 produtos do plano Pro."
    : "O plano grátis é modo teste: você pode explorar o catálogo e conectar 1 marketplace, mas publicações reais exigem um plano operacional.";
  const publishUpgradeCta = reachedProProductLimit
    ? "Upgrade Business"
    : "Desbloquear operação completa";
  const publishUpgradeTargetPlan = reachedProProductLimit ? "business" : "pro";
  const publishUpgradeBenefits = reachedProProductLimit
    ? ["Produtos ilimitados", "Marketplaces ilimitados", "Agentes IA ilimitados", "Operação sem limites"]
    : ["Publicação automática", "Até 30 produtos publicados", "Monitoramento básico 24h", "Relatórios financeiros"];

  return createPortal(
    <div
      className="fixed left-0 right-0 bottom-0 z-[60] flex justify-end"
      style={{ top: startModeOffset, height: `calc(100vh - ${startModeOffset}px)` }}
    >
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-150 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`relative flex h-full w-full max-w-[1040px] overflow-hidden bg-white shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.2)] transition-transform duration-150 ease-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ============== LEFT — MAIN ============== */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between px-4 pb-4 pt-4 sm:px-6 md:px-8 md:pb-5 md:pt-7">
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
          <div className="mobile-hide-scrollbar overflow-x-auto px-4 pb-4 sm:px-6 md:overflow-visible md:px-8 md:pb-6">
            <div className="flex min-w-max items-center md:min-w-0">
              {STEPS.map((s, i) => {
                const active = step === s.num;
                const done = step > s.num;
                return (
                  <div key={s.num} className="flex items-center md:flex-1 md:last:flex-initial">
                    <button
                      onClick={() => { if (done) setStep(s.num); }}
                      className="group flex items-center gap-2"
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
                      <div className="relative mx-2 h-px w-8 overflow-hidden bg-gray-200 md:mx-3 md:w-auto md:flex-1">
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
          <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 md:px-8" style={{ scrollbarWidth: "thin", minHeight: 0 }}>
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
                      <style>{`
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
                        onChange={(e) => handlePriceChange(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-[13px] font-semibold text-[#0A0A0A] outline-none transition-colors hover:border-gray-300 focus:border-gray-400 focus:bg-white"
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

                {/* Mercado Livre attributes */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="text-[12px] font-medium text-gray-600">Marca e atributos</label>
                    <span className="text-[11px] font-medium text-gray-400">Exigido pelo Mercado Livre</span>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <input
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="Marca"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] text-[#0A0A0A] outline-none transition-colors hover:border-gray-300 focus:border-gray-400 placeholder:text-gray-400"
                    />
                    <input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="Modelo (opcional)"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] text-[#0A0A0A] outline-none transition-colors hover:border-gray-300 focus:border-gray-400 placeholder:text-gray-400"
                    />
                  </div>
                  {requiresStickerAttrs && (
                    <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[1fr_150px]">
                      <input
                        value={albumName}
                        onChange={(e) => setAlbumName(e.target.value)}
                        placeholder="Nome do álbum"
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] text-[#0A0A0A] outline-none transition-colors hover:border-gray-300 focus:border-gray-400 placeholder:text-gray-400"
                      />
                      <select
                        value={saleFormat}
                        onChange={(e) => setSaleFormat(e.target.value === "kit" ? "kit" : "unit")}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] text-[#0A0A0A] outline-none transition-colors hover:border-gray-300 focus:border-gray-400"
                      >
                        <option value="unit">Unidade</option>
                        <option value="kit">Kit</option>
                      </select>
                    </div>
                  )}
                  {!brand.trim() && (
                    <p className="mt-1.5 text-[11.5px] text-red-600">
                      Informe a marca antes de publicar. Se o produto não tem marca formal, use "Genérica".
                    </p>
                  )}
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
                            veloToast.error("Crie uma descrição antes de fazer o vídeo");
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

            {/* STEP 3 — Trial */}
            {step === 3 && (
              <div key="s3-trial" className="step-fade pb-6">
                <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.45)]">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0A0A0A] text-white">
                      <ShieldCheck size={22} strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Trial Velo</p>
                      <h3 className="mt-1 text-[22px] font-semibold leading-tight text-[#0A0A0A]">
                        Ative seu trial para publicar este produto
                      </h3>
                      <p className="mt-2 max-w-[520px] text-[13.5px] leading-relaxed text-gray-500">
                        Seu anúncio já está pronto. Revise o produto abaixo e inicie o trial antes da publicação final.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-3xl bg-gray-50 p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100">
                        {img ? <img src={img} alt={title} className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-gray-500">Produto customizado</p>
                        <p className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-[#0A0A0A]">
                          {title || product.title}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-gray-500">
                          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-gray-100">
                            Preço definido: <strong className="font-semibold text-[#0A0A0A]">{formatBRL(sellPrice)}</strong>
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-gray-100">
                            Lucro estimado: <strong className="font-semibold text-[#0A0A0A]">{formatBRL(profit)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/checkout?trial=1&plan=pro&product=${product.id}`)}
                    className="mt-6 flex h-[52px] w-full items-center justify-center rounded-full bg-[#0A0A0A] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#1A1A1A]"
                  >
                    Iniciar trial — R$29,90 por 5 dias
                  </button>
                  <p className="mt-3 text-center text-[12.5px] leading-relaxed text-gray-500">
                    Publique agora mesmo. Após 5 dias, sua assinatura continua automaticamente no plano Pro (R$99,90/mês). Cancele quando quiser.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/checkout?plan=business&businessCard=1")}
                    className="mx-auto mt-4 block max-w-[520px] text-center text-[12.5px] font-medium leading-relaxed text-gray-500 underline underline-offset-4 transition-colors hover:text-[#0A0A0A]"
                  >
                    Prefere começar direto no Business (R$149,90/mês, promoção) com automações ilimitadas?
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4 — Success */}
            {step === 4 && publishResult && (
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
          <div className="flex shrink-0 items-center justify-end border-t border-gray-100 bg-white px-4 py-3 sm:px-6 md:justify-between md:px-8 md:py-4">
            <p className="hidden text-[11.5px] text-gray-400 md:block">
              Saiba mais sobre <span className="text-[#0A0A0A] underline cursor-pointer">Importar Produto</span>
            </p>
            <div className="flex w-full items-center justify-end gap-2 md:w-auto">
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
                  onClick={() => { if (canAdvance) setStep(step + 1); else veloToast.error("Conecte a conta, confira o estoque, título e preço"); }}
                  disabled={!canAdvance}
                  className="btn-primary btn-primary--md"
                >
                  Próximo
                  <ArrowRight size={13} />
                </button>
              )}
              {step === 2 && (
                <button
                  onClick={handleContinueFromReview}
                  className="btn-primary btn-primary--md"
                >
                  {planLimits.canPublishProducts ? "Publicar produto" : "Continuar"}
                  <ArrowRight size={13} />
                </button>
              )}
              {step === 4 && (
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
        <div className="hidden w-[300px] shrink-0 flex-col border-l border-gray-100 bg-gray-50/40 md:flex">
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

      </div>

      <UpgradeLimitModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title={publishUpgradeTitle}
        message={publishUpgradeMessage}
        cta={publishUpgradeCta}
        targetPlan={publishUpgradeTargetPlan}
        benefits={publishUpgradeBenefits}
      />

      <MLAccountVerificationModal
        open={mlVerifyModalOpen}
        onClose={() => setMlVerifyModalOpen(false)}
        onFinish={() => setMlVerifyModalOpen(false)}
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
