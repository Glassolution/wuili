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
    label: "Produtos baratos para testar",
    value: "Encontre produtos baratos para testar uma primeira venda",
    hint: "Preço de entrada baixo para validar demanda sem muito risco.",
  },
  {
    icon: TrendingUp,
    label: "Itens com alta margem",
    value: "Encontre produtos com alta margem de lucro no catálogo",
    hint: "Itens com espaço para markup e venda com lucro maior.",
  },
  {
    icon: Sparkles,
    label: "Produtos virais para anúncio",
    value: "Encontre produtos com apelo viral para anúncios curtos",
    hint: "Produtos fáceis de demonstrar e bons para criativos rápidos.",
  },
  {
    icon: Boxes,
    label: "Estoque alto no catálogo",
    value: "Encontre produtos com estoque alto e boa disponibilidade",
    hint: "Opções com mais segurança para vender sem pausa.",
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

  useEffect(() => {
    if (!open) return;

    const updatePanelPosition = () => {
      const width = Math.min(chatMode ? 820 : 760, window.innerWidth - 32);

      setPanelPosition({
        top: window.innerWidth < 768 ? 48 : 64,
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
  }, [open, chatMode]);

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

    return (
      <div className="mt-3 max-w-[520px] rounded-[18px] border border-white/[0.08] bg-[#202020] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.22)]">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-white/[0.04]">
            {primaryProduct.image_url ? (
              <img src={primaryProduct.image_url} alt={primaryProduct.nome} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="grid h-full w-full place-items-center text-white/30">
                <PackageSearch size={20} strokeWidth={1.5} />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/42">
              Produto recomendado
            </div>
            <div className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-white">
              {primaryProduct.nome}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[12px] text-white/48">
              <span className="truncate">{primaryProduct.categoria}</span>
              <span className="h-1 w-1 rounded-full bg-white/24" />
              <span className="shrink-0 text-white/78">{formatPrice(primaryProduct.preco)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const modalQuestion = "Que tipo de produto você quer encontrar?";
  const footerValue = chatMode ? chatInput : customPrompt;
  const footerPlaceholder = busy
    ? "Aquas está analisando..."
    : chatMode
      ? "Continue conversando com o Aquas..."
      : modalQuestion;
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
    <form
      onSubmit={handleFooterSubmit}
      className="flex h-[64px] items-center gap-3 rounded-full bg-[#1e1e1e] px-3.5 pr-5 shadow-[0_18px_44px_rgba(0,0,0,0.28)]"
    >
      {renderAquasAvatar("h-10 w-10", 27)}
      <input
        ref={footerInputRef}
        value={footerValue}
        onChange={(event) => handleFooterChange(event.target.value)}
        onFocus={() => setFooterInputFocused(true)}
        onBlur={() => setFooterInputFocused(false)}
        placeholder={footerPlaceholder}
        disabled={busy}
        className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-medium tracking-[-0.02em] text-white outline-none placeholder:text-white/48 disabled:cursor-wait"
      />
      <button
        type="submit"
        disabled={isFooterDisabled}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black shadow-[0_12px_28px_rgba(0,0,0,0.25)] transition-all hover:scale-[1.03] disabled:pointer-events-none disabled:scale-100 disabled:opacity-0"
        aria-label="Enviar resposta para o Aquas"
      >
        <ArrowUp size={16} strokeWidth={1.9} />
      </button>
    </form>
  );

  const renderAnswerBar = () => (
    <div className="rounded-[26px] bg-[#2c2c2c] px-3.5 py-3.5 shadow-[0_22px_50px_rgba(0,0,0,0.34)]">
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

      <div
        className="flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          WebkitMaskImage: "linear-gradient(90deg, #000 0%, #000 calc(100% - 52px), transparent 100%)",
          maskImage: "linear-gradient(90deg, #000 0%, #000 calc(100% - 52px), transparent 100%)",
        }}
      >
        {busy ? (
          <span className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#3e3e3e] px-4 text-[13px] font-semibold text-white/64">
            <span className="aquas-shimmer h-1.5 w-1.5 rounded-full" />
            Buscando no catálogo...
          </span>
        ) : (
          activePromptOptions.map((option) => (
            <button
              key={`${chatMode ? "quick" : "initial"}-${option.label}`}
              type="button"
              onClick={() => handleChipClick(option.value)}
              className="inline-flex h-10 max-w-[280px] shrink-0 items-center rounded-full bg-[#3e3e3e] px-4 text-[13px] font-semibold tracking-[-0.01em] text-white/78 transition-colors hover:bg-[#484848] hover:text-white"
            >
              <span className="truncate">{option.label}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const renderChatWindow = () => (
    <div className="overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#171717] shadow-[0_24px_70px_rgba(0,0,0,0.42)]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {renderAquasAvatar("h-9 w-9", 25)}
          <div className="min-w-0">
            <div className="text-[14px] font-semibold tracking-[-0.02em] text-white">Aquas</div>
            <div className="text-[12px] text-white/42">Conversa sobre produto</div>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/42 transition-colors hover:bg-white/[0.07] hover:text-white/72"
          aria-label="Fechar Aquas"
        >
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>

      <div
        ref={chatContainerRef}
        className="max-h-[min(58vh,560px)] overflow-y-auto px-5 py-5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10"
      >
        <div className="space-y-5">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && renderAquasAvatar("h-8 w-8", 23)}
              <div className={`min-w-0 ${msg.role === "user" ? "max-w-[78%]" : "max-w-[86%]"}`}>
                <div
                  className={`whitespace-pre-line rounded-[18px] px-4 py-3 text-[14px] leading-relaxed tracking-[-0.01em] ${
                    msg.role === "user"
                      ? "bg-white text-[#111]"
                      : "bg-transparent px-0 py-0 text-white/86"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "assistant" && msg.products && msg.products.length > 0
                  ? renderProductPanel(msg.products)
                  : null}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-3">
              {renderAquasAvatar("h-8 w-8", 23)}
              <div className="inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.07] px-4 text-[13px] font-medium text-white/54">
                <span className="aquas-shimmer h-1.5 w-1.5 rounded-full" />
                Analisando o catálogo...
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/[0.06] bg-[#1d1d1d] px-4 pb-4 pt-3">
        {!busy && (
          <div
            className="mb-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              WebkitMaskImage: "linear-gradient(90deg, #000 0%, #000 calc(100% - 48px), transparent 100%)",
              maskImage: "linear-gradient(90deg, #000 0%, #000 calc(100% - 48px), transparent 100%)",
            }}
          >
            {QUICK_ACTIONS.map((option) => (
              <button
                key={`chat-${option.label}`}
                type="button"
                onClick={() => handleChipClick(option.value)}
                className="inline-flex h-9 max-w-[230px] shrink-0 items-center rounded-full bg-white/[0.08] px-4 text-[13px] font-medium text-white/78 transition-colors hover:bg-white/[0.13] hover:text-white"
              >
                <span className="truncate">{option.label}</span>
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={handleFooterSubmit}
          className="flex h-12 items-center gap-2 rounded-full border border-white/[0.07] bg-[#2a2a2a] px-4"
          style={{
            boxShadow: footerInputFocused ? "0 0 0 1px rgba(255,255,255,0.12)" : "none",
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
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-medium text-white outline-none placeholder:text-white/38 disabled:cursor-wait"
          />
          <button
            type="submit"
            disabled={isFooterDisabled}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-black transition-transform hover:scale-[1.03] disabled:scale-100 disabled:opacity-35"
            aria-label="Enviar mensagem para o Aquas"
          >
            <ArrowUp size={14} strokeWidth={2} />
          </button>
        </form>
      </div>
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
                  <div className="pointer-events-auto">
                    {chatMode ? (
                      renderChatWindow()
                    ) : (
                      <div className="flex flex-col gap-3.5">
                        {renderQuestionBar()}
                        {renderAnswerBar()}
                      </div>
                    )}
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
