import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Boxes,
  PackageSearch,
  Sparkles,
  TrendingUp,
  type LucideIcon,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, type Product } from "@/components/dashboard/ProductCard";
import AquasIcon from "@/components/dashboard/AquasIcon";

export type AtlasResults = {
  ids: string[];
  label: string;
  source: "preference" | "ai" | "fallback";
};

type ProductScoutAIProps = {
  onResults: (results: AtlasResults) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialPrompt?: string;
  showTriggerButton?: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  product?: SuggestedProduct;
  products?: SuggestedProduct[];
};

type SuggestedProduct = Product & {
  costPrice: number | null;
  suggestedPrice: number | null;
  stockQuantity: number | null;
};

type PromptOption = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
};

const INITIAL_SUGGESTIONS: PromptOption[] = [
  {
    icon: PackageSearch,
    label: "Quero algo barato para começar",
    value: "Quero um produto barato para começar a vender",
    hint: "Sugestões com preço de entrada e menor barreira para iniciar.",
  },
  {
    icon: TrendingUp,
    label: "Busco maior margem",
    value: "Quero produtos com maior margem de lucro",
    hint: "Priorizo itens com melhor espaço para markup e venda.",
  },
  {
    icon: Sparkles,
    label: "Preciso de algo com apelo viral",
    value: "Quero um produto com apelo viral para anúncios",
    hint: "Ideias com potencial de chamar atenção em anúncio curto.",
  },
  {
    icon: Boxes,
    label: "Quero opções com bom estoque",
    value: "Quero produtos com estoque alto e boa disponibilidade",
    hint: "Produtos com mais segurança de reposição para vender sem pausa.",
  },
];

const QUICK_ACTIONS: PromptOption[] = [
  {
    icon: Sparkles,
    label: "Como vender este produto?",
    value: "Como vender este produto?",
    hint: "Posicionamento, oferta e argumentos de venda.",
  },
  {
    icon: TrendingUp,
    label: "Qual o público ideal?",
    value: "Qual o público ideal?",
    hint: "Perfil de cliente e contexto de uso mais aderente.",
  },
  {
    icon: PackageSearch,
    label: "Quais alternativas parecidas?",
    value: "Quais alternativas parecidas você recomenda?",
    hint: "Outras opções próximas para comparar no catálogo.",
  },
  {
    icon: Boxes,
    label: "Crie um ângulo de anúncio",
    value: "Crie um ângulo de anúncio para esse produto",
    hint: "Uma abordagem inicial para criativo e copy.",
  },
];

const Styles = () => (
  <style dangerouslySetInnerHTML={{__html: `
    @keyframes aquas-shimmer {
      0% { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }
    .aquas-shimmer {
      background-image: linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%);
      background-size: 200% 100%;
      animation: aquas-shimmer 1.8s linear infinite;
    }
  `}} />
);

const ProductScoutAI = ({ 
  onResults,
  open: controlledOpen,
  onOpenChange,
  initialPrompt = "",
  showTriggerButton = true
}: ProductScoutAIProps) => {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : localOpen;
  
  const setOpen = (val: boolean) => {
    setLocalOpen(val);
    if (onOpenChange) onOpenChange(val);
  };

  const [busy, setBusy] = useState(false);
  const [chatMode, setChatMode] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [lastSuggestedProducts, setLastSuggestedProducts] = useState<SuggestedProduct[]>([]);
  const [footerInputFocused, setFooterInputFocused] = useState(false);
  const [panelPosition, setPanelPosition] = useState({
    top: 88,
    left: 16,
    width: 620,
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  const handleInputChange = (val: string) => {
    setCustomPrompt(val);
  };

  const handleChatInputChange = (val: string) => {
    setChatInput(val);
  };

  const openPanel = () => {
    setOpen(true);
    setChatMode(false);
    setChatMessages([]);
    setChatInput("");
    setCustomPrompt("");
    setLastSuggestedProducts([]);
  };

  const close = useCallback(() => {
    setLocalOpen(false);
    onOpenChange?.(false);
    setChatMode(false);
    setChatMessages([]);
    setBusy(false);

    if (lastSuggestedProducts.length > 0) {
      onResults({
        ids: lastSuggestedProducts.map((product) => product.id),
        label: `Recomendado pelo Aquas: ${lastSuggestedProducts[0].nome}`,
        source: "ai",
      });
    }
  }, [lastSuggestedProducts, onOpenChange, onResults]);

  const executeRealSearch = useCallback(async (text: string) => {
    const cleanText = text.trim();
    if (busy || !cleanText) return;
    setBusy(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: cleanText,
    };

    // Adiciona a mensagem do usuário imediatamente para exibição no chat com o loader
    setChatMessages((prev) => [...prev, userMsg]);
    setChatMode(true);

    // Formata o histórico anterior (exclui a mensagem do usuário que acabou de ser criada,
    // pois ela será enviada de forma independente no corpo como query da Edge Function)
    const formattedHistory = chatMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      const startTime = Date.now();

      // 1. Invoca a Edge Function atlas-search com o contexto incremental da conversa
      const { data, error: invokeError } = await supabase.functions.invoke("atlas-search", {
        body: {
          query: cleanText,
          history: formattedHistory,
        },
      });

      if (invokeError) throw invokeError;

      const ids = Array.isArray(data?.ids) ? (data.ids as string[]) : [];
      const aiResponseText = typeof data?.resposta_chat === "string" && data.resposta_chat.length > 0
        ? data.resposta_chat
        : "Selecionei este produto no catálogo para você:";

      let fetchedProducts: SuggestedProduct[] = [];

      if (ids.length > 0) {
        const orderedIds = ids.filter((id): id is string => typeof id === "string").slice(0, 6);
        const { data: productsData, error: dbError } = await supabase
          .from("catalog_products")
          .select("id, title, images, cost_price, suggested_price, category, stock_quantity")
          .in("id", orderedIds);

        if (!dbError && productsData) {
          const productsById = new Map(productsData.map((product) => [product.id, product]));
          fetchedProducts = orderedIds
            .map((productId) => {
              const prodData = productsById.get(productId);
              if (!prodData) return null;

              let imagesArr: string[] = [];
              try {
                const parsedImages =
                  typeof prodData.images === "string" ? JSON.parse(prodData.images) : prodData.images;
                imagesArr = Array.isArray(parsedImages) ? parsedImages.filter(Boolean) : [];
              } catch {
                imagesArr = [];
              }

              return {
                id: prodData.id,
                nome: prodData.title || "Produto sem título",
                categoria: prodData.category || "Geral",
                preco: prodData.suggested_price || prodData.cost_price * 1.5 || 49.9,
                image_url: imagesArr[0] || "",
                images: imagesArr,
                costPrice: prodData.cost_price ?? null,
                suggestedPrice: prodData.suggested_price ?? null,
                stockQuantity: prodData.stock_quantity ?? null,
              };
            })
            .filter((product): product is SuggestedProduct => product !== null);
        }
      }

      // Garante uma duração visual mínima de 750ms para a animação de "Thinking"
      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 750 - elapsed);
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      setLastSuggestedProducts(fetchedProducts);
      const recommendedProduct = fetchedProducts[0] ?? null;

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: recommendedProduct 
          ? aiResponseText 
          : "Não encontrei produtos que atendam exatamente a essa solicitação no catálogo. Que tal tentar outras palavras-chave?",
        product: recommendedProduct || undefined,
        products: fetchedProducts,
      };

      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("Erro na busca do Aquas:", err);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Desculpe, tive uma instabilidade de rede ao consultar o catálogo. Poderia tentar novamente?",
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } finally {
      setBusy(false);
      setChatInput("");
      setCustomPrompt("");
    }
  }, [busy, chatMessages]);

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt || busy) return;
    void executeRealSearch(prompt);
  };

  const handleSendInitialPrompt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = customPrompt.trim();
    if (!prompt || busy) return;
    void executeRealSearch(prompt);
  };

  const handleChipClick = (suggestion: string) => {
    if (busy) return;
    void executeRealSearch(suggestion);
  };

  // Sync initialPrompt when modal is opened programmatically
  useEffect(() => {
    if (open && initialPrompt && initialPrompt.trim()) {
      setChatMode(false);
      setChatMessages([]);
      setChatInput("");
      const cleanPrompt = initialPrompt.trim();
      setCustomPrompt(cleanPrompt);
      void executeRealSearch(cleanPrompt);
    }
  }, [executeRealSearch, initialPrompt, open]);

  const buildStatChips = (product: SuggestedProduct) => {
    const chips: Array<{ label: string; tone: "neutral" | "success" }> = [];
    const effectiveSuggested = product.suggestedPrice ?? product.preco;

    if (product.costPrice && effectiveSuggested > product.costPrice) {
      const marginPercent = Math.round(((effectiveSuggested - product.costPrice) / product.costPrice) * 100);
      chips.push({ label: `+${marginPercent}% margem`, tone: "success" });
    }

    if (typeof product.stockQuantity === "number") {
      chips.push({ label: `${product.stockQuantity} em estoque`, tone: "neutral" });
    }

    chips.push({ label: product.categoria, tone: "neutral" });
    chips.push({ label: formatPrice(product.preco), tone: "neutral" });

    return chips.slice(0, 4);
  };

  useEffect(() => {
    if (!open) return;

    const updatePanelPosition = () => {
      const width = Math.min(620, window.innerWidth - 32);

      if (triggerButtonRef.current) {
        const rect = triggerButtonRef.current.getBoundingClientRect();
        const left = Math.min(window.innerWidth - width - 16, Math.max(16, rect.right - width));
        const top = Math.min(window.innerHeight - 40, rect.bottom + 12);
        setPanelPosition({ top, left, width });
        return;
      }

      setPanelPosition({
        top: 88,
        left: Math.max(16, (window.innerWidth - width) / 2),
        width,
      });
    };

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const focusId = window.requestAnimationFrame(() => {
      footerInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(focusId);
  }, [open, chatMode]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, close]);

  const renderProductPanel = (products: SuggestedProduct[]) => {
    const primaryProduct = products[0];
    if (!primaryProduct) return null;

    const alternativeProducts = products.slice(1);

    return (
      <div className="mt-3 rounded-[18px] border border-white/[0.06] bg-white/[0.03] p-3.5">
        <div className="flex flex-col gap-3 rounded-[16px] border border-white/[0.05] bg-[#131313] p-3.5 sm:flex-row">
          <div className="h-[112px] w-full overflow-hidden rounded-[16px] bg-white/[0.04] sm:h-[112px] sm:w-[112px]">
            {primaryProduct.image_url ? (
              <img
                src={primaryProduct.image_url}
                alt={primaryProduct.nome}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-white/30">
                <PackageSearch size={24} strokeWidth={1.5} />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center rounded-full border border-white/[0.15] bg-white/[0.1] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
              Produto principal
            </div>
            <div className="mt-3 text-[17px] font-semibold leading-snug tracking-[-0.02em] text-white">
              {primaryProduct.nome}
            </div>
            <div className="mt-1 text-[12px] text-white/45">{primaryProduct.categoria}</div>
            <div className="mt-3 text-[26px] font-semibold tracking-[-0.05em] text-white">
              {formatPrice(primaryProduct.preco)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {buildStatChips(primaryProduct).map((chip) => (
            <span
              key={`${primaryProduct.id}-${chip.label}`}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11.5px] font-medium ${
                chip.tone === "success"
                  ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-300"
                  : "border-white/[0.08] bg-white/[0.05] text-white/78"
              }`}
            >
              {chip.label}
            </span>
          ))}
        </div>

        {alternativeProducts.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/36">
              Alternativas do catálogo
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {alternativeProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleChipClick(`Quero analisar ${product.nome}`)}
                  className="min-w-[184px] shrink-0 rounded-[16px] border border-white/[0.06] bg-[#151515] p-2.5 text-left transition-all duration-150 hover:bg-white/[0.08]"
                >
                  <div className="h-[92px] overflow-hidden rounded-[12px] bg-white/[0.04]">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.nome} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-white/30">
                        <PackageSearch size={20} strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className="mt-2.5 line-clamp-2 text-[13px] font-medium leading-snug text-white">
                    {product.nome}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-white/42">
                    <span className="truncate">{product.categoria}</span>
                    <span className="text-white/72">{formatPrice(product.preco)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const modalQuestion = "O que você quer saber sobre este produto?";
  const footerValue = chatMode ? chatInput : customPrompt;
  const footerPlaceholder = busy
    ? "Aquas está analisando..."
    : chatMode
      ? "Continue conversando com o Aquas..."
      : "Digite uma resposta livre...";
  const activePromptOptions = chatMode ? QUICK_ACTIONS : INITIAL_SUGGESTIONS;
  const isFooterDisabled = busy || !footerValue.trim();
  const handleFooterSubmit = (event?: React.FormEvent) => {
    if (chatMode) {
      handleSendChat(event);
      return;
    }

    handleSendInitialPrompt(event);
  };

  const handleFooterChange = (value: string) => {
    if (chatMode) {
      handleChatInputChange(value);
      return;
    }

    handleInputChange(value);
  };

  const renderAquasAvatar = (sizeClass = "h-11 w-11", iconSize = 30) => (
    <span
      className={`grid ${sizeClass} shrink-0 place-items-center rounded-full bg-white text-black shadow-[0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.75)]`}
    >
      <AquasIcon size={iconSize} />
    </span>
  );

  const renderQuestionBar = () => (
    <div className="flex h-[58px] items-center gap-3 rounded-full bg-[#1e1e1e] px-3.5 pr-6 shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
      {renderAquasAvatar("h-10 w-10", 27)}
      <span className="min-w-0 truncate text-[15px] font-medium tracking-[-0.02em] text-white/72">
        {modalQuestion}
      </span>
    </div>
  );

  const renderAnswerBar = () => (
    <div className="rounded-[26px] bg-[#2c2c2c] px-3.5 py-3 shadow-[0_22px_50px_rgba(0,0,0,0.34)]">
      <div className="flex items-center gap-3 px-1 pb-3">
        {renderAquasAvatar("h-10 w-10", 27)}
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-[-0.02em] text-white/86">
          {modalQuestion}
        </span>
        <button
          type="button"
          onClick={close}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/42 transition-colors hover:bg-white/[0.07] hover:text-white/72"
          aria-label="Fechar Aquas"
        >
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>

      <form onSubmit={handleFooterSubmit} className="flex min-w-0 items-center gap-2">
        <div
          className="flex min-w-0 flex-1 gap-2 overflow-x-auto pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            WebkitMaskImage: "linear-gradient(90deg, #000 0%, #000 calc(100% - 42px), transparent 100%)",
            maskImage: "linear-gradient(90deg, #000 0%, #000 calc(100% - 42px), transparent 100%)",
          }}
        >
          {busy ? (
            <span className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#3e3e3e] px-4 text-[13px] font-semibold text-white/64">
              <span className="aquas-shimmer h-1.5 w-1.5 rounded-full" />
              Buscando no catálogo...
            </span>
          ) : (
            activePromptOptions.map((option) => (
              <button
                key={`${chatMode ? "quick" : "initial"}-${option.label}`}
                type="button"
                onClick={() => handleChipClick(option.value)}
                className="inline-flex h-11 max-w-[260px] shrink-0 items-center rounded-full bg-[#3e3e3e] px-4 text-[13px] font-semibold tracking-[-0.01em] text-white/78 transition-colors hover:bg-[#484848] hover:text-white"
              >
                <span className="truncate">{option.label}</span>
              </button>
            ))
          )}

          <label
            className="inline-flex h-11 min-w-[230px] shrink-0 items-center rounded-full bg-[#3e3e3e] px-4 transition-colors"
            style={{
              boxShadow: footerInputFocused ? "inset 0 0 0 1px rgba(255,255,255,0.18)" : "none",
            }}
          >
            <input
              ref={footerInputRef}
              value={footerValue}
              onChange={(event) => handleFooterChange(event.target.value)}
              onFocus={() => setFooterInputFocused(true)}
              onBlur={() => setFooterInputFocused(false)}
              placeholder={footerPlaceholder}
              disabled={busy}
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-medium text-white outline-none placeholder:text-white/38 disabled:cursor-wait"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={isFooterDisabled}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-black shadow-[0_12px_28px_rgba(0,0,0,0.25)] transition-transform hover:scale-[1.03] disabled:scale-100 disabled:opacity-35"
          aria-label="Enviar resposta para o Aquas"
        >
          <ArrowUp size={16} strokeWidth={1.9} />
        </button>
      </form>
    </div>
  );

  return (
    <>
      <Styles />
      {showTriggerButton && (
        <button
          ref={triggerButtonRef}
          type="button"
          onClick={openPanel}
          disabled={busy}
          className="group inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-[#050505] px-5 text-[13px] font-semibold tracking-[-0.01em] text-white shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.09)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-black disabled:cursor-wait disabled:opacity-70"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full text-white transition-transform duration-300 group-hover:-rotate-12">
            <AquasIcon size={24} inverted />
          </span>
          Aquas
        </button>
      )}

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  key="atlas-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={close}
                  className="fixed inset-0 z-[110] bg-transparent pointer-events-auto"
                />

                <motion.div
                  key="atlas-shell"
                  className="fixed z-[120] text-white"
                  style={{
                    top: panelPosition.top,
                    left: panelPosition.left,
                    width: panelPosition.width,
                    transformOrigin: "top",
                  }}
                  initial={{ opacity: 0, scaleY: 0.94, y: -8 }}
                  animate={{ opacity: 1, scaleY: 1, y: 0 }}
                  exit={{ opacity: 0, scaleY: 0.97, y: -8 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="pointer-events-auto flex flex-col gap-3.5">
                    {renderQuestionBar()}

                    {chatMode && (
                      <div className="overflow-hidden rounded-[24px] bg-[rgba(18,18,18,0.97)] p-3 shadow-[0_22px_52px_rgba(0,0,0,0.42)] backdrop-blur-xl">
                        <div
                          ref={chatContainerRef}
                          className="max-h-[min(58vh,560px)] overflow-y-auto px-1 py-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10"
                        >
                          <div className="space-y-4">
                            {chatMessages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                              >
                                <div
                                  className={`max-w-[92%] rounded-[18px] border px-4 py-3 text-[13.5px] leading-relaxed ${
                                    msg.role === "user"
                                      ? "border-white/[0.08] bg-white/[0.06] text-white"
                                      : "w-full border-white/[0.05] bg-[#131313] text-white/88"
                                  }`}
                                >
                                  {msg.content}
                                </div>

                                {msg.role === "assistant" && msg.products && msg.products.length > 0
                                  ? renderProductPanel(msg.products)
                                  : null}
                              </div>
                            ))}

                            {busy && (
                              <div className="rounded-[18px] border border-white/[0.05] bg-[#131313] px-4 py-3.5">
                                <div className="flex items-center gap-3 text-white/58">
                                  <span className="aquas-shimmer block h-2 w-2 rounded-full" />
                                  <span className="aquas-shimmer block h-2 w-2 rounded-full" />
                                  <span className="aquas-shimmer block h-2 w-2 rounded-full" />
                                  <span className="ml-1 text-[12.5px] font-medium">Aquas está formulando resposta...</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {renderAnswerBar()}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
};

export default ProductScoutAI;
