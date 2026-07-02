import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import {
  ArrowUp,
  Boxes,
  ChevronRight,
  Lightbulb,
  PackageSearch,
  Plus,
  Search,
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

type CatalogScoutRow = {
  id: string;
  title: string | null;
  images: unknown;
  cost_price: number | null;
  suggested_price: number | null;
  category: string | null;
  stock_quantity: number | null;
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

const parseCatalogImages = (images: unknown) => {
  try {
    const parsedImages = typeof images === "string" ? JSON.parse(images) : images;
    return Array.isArray(parsedImages) ? parsedImages.filter((image): image is string => typeof image === "string" && image.length > 0) : [];
  } catch {
    return [];
  }
};

const mapCatalogProduct = (product: CatalogScoutRow): SuggestedProduct => {
  const images = parseCatalogImages(product.images);
  const costPrice = product.cost_price ?? null;
  const suggestedPrice = product.suggested_price ?? null;
  const price = suggestedPrice ?? (costPrice ? costPrice * 1.5 : 49.9);

  return {
    id: product.id,
    nome: product.title || "Produto sem título",
    categoria: product.category || "Geral",
    preco: price,
    image_url: images[0] || "",
    images,
    costPrice,
    suggestedPrice,
    stockQuantity: product.stock_quantity ?? null,
  };
};

const withTimeout = async <T,>(promise: Promise<T>, milliseconds: number, message: string) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), milliseconds);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const SaturnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="4.8" stroke="currentColor" strokeWidth="2" />
    <path
      d="M3.2 15.2c2.5 1.8 7.5 2 12.1.5 4.6-1.5 7.2-4.1 6.5-5.9-.4-1.2-2-1.8-4.1-1.8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M20.8 8.8c-2.5-1.8-7.5-2-12.1-.5-4.6 1.5-7.2 4.1-6.5 5.9.4 1.2 2 1.8 4.1 1.8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.78"
    />
  </svg>
);

const Ring = ({
  index,
  state,
  typingAngle,
  baseRotateY,
  baseRotateX,
}: {
  index: number;
  state: 'idle' | 'typing' | 'processing';
  typingAngle: number;
  baseRotateY: number;
  baseRotateX: number;
}) => {
  let animateValue: number | number[] = 0;
  let transitionValue: Transition = {};

  if (state === 'processing') {
    animateValue = [0, 360];
    transitionValue = {
      repeat: Infinity,
      duration: 1.4 - index * 0.15,
      ease: "linear",
    };
  } else if (state === 'typing') {
    animateValue = typingAngle + (index * 15);
    transitionValue = {
      type: "spring",
      stiffness: 300,
      damping: 12,
    };
  } else {
    // idle state: slow sinoidal oscillation
    animateValue = index % 2 === 0 ? [-8, 8] : [6, -6];
    transitionValue = {
      repeat: Infinity,
      repeatType: "mirror" as const,
      duration: 3.0 + index * 0.5,
      ease: "easeInOut",
    };
  }

  return (
    <motion.div
      key={`${state}-${index}`}
      className="absolute w-7 h-7 flex items-center justify-center rounded-full pointer-events-none"
      style={{
        transformStyle: 'preserve-3d',
      }}
      // Use independent Framer Motion transform properties instead of concatenated string templates
      animate={{
        rotateY: baseRotateY,
        rotateX: baseRotateX,
        rotateZ: animateValue,
      }}
      transition={transitionValue}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id={`ring-grad-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <circle
          cx="20"
          cy="20"
          r="18"
          stroke={`url(#ring-grad-${index})`}
          strokeWidth="1.35"
          className="transition-all duration-300"
          style={{
            filter: state === 'processing' 
              ? 'drop-shadow(0 0 3px rgba(255,255,255,0.85))' 
              : state === 'typing'
                ? 'drop-shadow(0 0 2px rgba(255,255,255,0.6))'
                : 'drop-shadow(0 0 1px rgba(255,255,255,0.3))',
          }}
        />
      </svg>
    </motion.div>
  );
};

const VeloOrb = ({ 
  state = 'idle', 
  typingTrigger = 0 
}: { 
  state?: 'idle' | 'typing' | 'processing'; 
  typingTrigger?: number; 
}) => {
  const [typingAngle, setTypingAngle] = useState(0);

  useEffect(() => {
    if (typingTrigger > 0) {
      setTypingAngle((a) => a + 45);
    }
  }, [typingTrigger]);

  return (
    <div 
      className="relative w-10 h-10 shrink-0 flex items-center justify-center"
      style={{ perspective: 800, transformStyle: 'preserve-3d' }}
    >
      {/* Outer subtle glow */}
      <span 
        className={`absolute rounded-full bg-white/5 blur-[8px] h-8 w-8 transition-all duration-300 ${
          state === 'processing' ? 'scale-125 opacity-100 bg-white/12' : 'scale-100 opacity-60'
        }`} 
      />

      {/* Ring 1 (Vertical Left-Slanted) */}
      <Ring
        index={0}
        state={state}
        typingAngle={typingAngle}
        baseRotateY={45}
        baseRotateX={15}
      />

      {/* Ring 2 (Vertical Right-Slanted) */}
      <Ring
        index={1}
        state={state}
        typingAngle={typingAngle}
        baseRotateY={-45}
        baseRotateX={-15}
      />

      {/* Ring 3 (Horizontal-ish Saturn Ring) */}
      <Ring
        index={2}
        state={state}
        typingAngle={typingAngle}
        baseRotateY={10}
        baseRotateX={75}
      />
    </div>
  );
};

const Styles = () => (
  <style dangerouslySetInnerHTML={{__html: `
    @keyframes aquas-shell-glow {
      0% { box-shadow: 0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03); }
      50% { box-shadow: 0 24px 48px rgba(0,0,0,0.56), inset 0 1px 0 rgba(255,255,255,0.06); }
      100% { box-shadow: 0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03); }
    }
    @keyframes aquas-shimmer {
      0% { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }
    .aquas-shell-glow {
      animation: aquas-shell-glow 2.8s ease-in-out infinite;
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

  const [isTyping, setIsTyping] = useState(false);
  const [typingTrigger, setTypingTrigger] = useState(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = (val: string) => {
    setCustomPrompt(val);
    setIsTyping(true);
    setTypingTrigger((prev) => prev + 1);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const handleChatInputChange = (val: string) => {
    setChatInput(val);
    setIsTyping(true);
    setTypingTrigger((prev) => prev + 1);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const orbState = busy ? 'processing' : isTyping ? 'typing' : 'idle';

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

  const fetchFallbackProducts = useCallback(async (text: string) => {
    const normalized = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const terms = normalized
      .split(/\s+/)
      .map((term) => term.replace(/[^\w-]/g, ""))
      .filter((term) => term.length >= 4 && !["produto", "produtos", "quero", "para", "comecar", "vender"].includes(term));
    const searchTerm = terms[0];
    const selectFields = "id, title, images, cost_price, suggested_price, category, stock_quantity";

    let query = supabase
      .from("catalog_products")
      .select(selectFields)
      .gt("stock_quantity", 0)
      .limit(6);

    if (searchTerm) {
      query = query.ilike("title", `%${searchTerm}%`);
    } else if (normalized.includes("barato") || normalized.includes("entrada")) {
      query = query.order("cost_price", { ascending: true, nullsFirst: false });
    } else if (normalized.includes("estoque")) {
      query = query.order("stock_quantity", { ascending: false, nullsFirst: false });
    } else {
      query = query.order("suggested_price", { ascending: false, nullsFirst: false });
    }

    const { data, error } = await query;
    if (error) throw error;

    let rows = (data ?? []) as CatalogScoutRow[];

    if (rows.length === 0 && searchTerm) {
      const { data: broadData, error: broadError } = await supabase
        .from("catalog_products")
        .select(selectFields)
        .gt("stock_quantity", 0)
        .order("suggested_price", { ascending: false, nullsFirst: false })
        .limit(6);

      if (broadError) throw broadError;
      rows = (broadData ?? []) as CatalogScoutRow[];
    }

    return rows.map(mapCatalogProduct);
  }, []);

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

      // Invoca a Edge Function atlas-search com limite de tempo para o Aquas nunca ficar preso carregando.
      const { data, error: invokeError } = await withTimeout(
        supabase.functions.invoke("atlas-search", {
          body: {
            query: cleanText,
            history: formattedHistory,
          },
        }),
        12000,
        "Tempo limite ao consultar o Aquas",
      );

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

              return mapCatalogProduct(prodData as CatalogScoutRow);
            })
            .filter((product): product is SuggestedProduct => product !== null);
        }
      }

      if (fetchedProducts.length === 0) {
        fetchedProducts = await fetchFallbackProducts(cleanText);
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
          ? `${aiResponseText}\n\nAnálise rápida: este item vem do catálogo Velo/C7Drop, tem preço de ${formatPrice(recommendedProduct.preco)} e está na categoria ${recommendedProduct.categoria}. Use como ponto de partida para testar oferta, margem e demanda antes de publicar.`
          : "Não encontrei produtos que atendam exatamente a essa solicitação no catálogo. Que tal tentar outras palavras-chave?",
        product: recommendedProduct || undefined,
        products: fetchedProducts,
      };

      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("Erro na busca do Aquas:", err);
      const fallbackProducts = await fetchFallbackProducts(cleanText).catch(() => []);
      if (fallbackProducts.length > 0) {
        setLastSuggestedProducts(fallbackProducts);
        const fallbackProduct = fallbackProducts[0];
        setChatMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `A IA demorou para responder, então eu trouxe uma recomendação real direto do catálogo Velo/C7Drop.\n\nProduto sugerido: ${fallbackProduct.nome}. Ele custa ${formatPrice(fallbackProduct.preco)}, está em ${fallbackProduct.categoria} e pode ser analisado por preço, estoque e apelo de venda.`,
            product: fallbackProduct,
            products: fallbackProducts,
          },
        ]);
        return;
      }

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
  }, [busy, chatMessages, fetchFallbackProducts]);

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
      const width = Math.min(560, window.innerWidth - 32);
      setPanelPosition({
        top: window.innerWidth < 768 ? 68 : 88,
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

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const renderPromptOption = (option: PromptOption, index: number, keyPrefix: string) => {
    const Icon = option.icon;

    return (
      <div key={`${keyPrefix}-${option.label}`}>
        {index === 2 && <div className="mx-3 my-2 border-t border-white/[0.08]" />}
        <button
          type="button"
          onClick={() => handleChipClick(option.value)}
          className="flex w-full items-center gap-3 rounded-[12px] border border-transparent px-4 py-[14px] text-left transition-all duration-150 hover:border-white/[0.06] hover:bg-white/[0.08] active:scale-[0.995]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.04] text-white/60">
            <Icon size={20} strokeWidth={1.5} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-white">{option.label}</span>
            <span className="mt-0.5 block text-[12px] text-white/45">{option.hint}</span>
          </span>
          <ChevronRight size={18} strokeWidth={1.5} className="shrink-0 text-white/30" />
        </button>
      </div>
    );
  };

  const renderProductPanel = (products: SuggestedProduct[]) => {
    const primaryProduct = products[0];
    if (!primaryProduct) return null;

    const alternativeProducts = products.slice(1);

    return (
      <div className="mt-2 w-full max-w-[520px] space-y-2">
        <button
          type="button"
          onClick={() => handleChipClick(`Analise melhor ${primaryProduct.nome}`)}
          className="flex w-full items-center gap-3 rounded-[20px] bg-white/[0.075] p-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:bg-white/[0.1]"
        >
          <div className="h-[58px] w-[58px] shrink-0 overflow-hidden rounded-[16px] bg-white/[0.06]">
            {primaryProduct.image_url ? (
              <img
                src={primaryProduct.image_url}
                alt={primaryProduct.nome}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-white/30">
                <PackageSearch size={18} strokeWidth={1.5} />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 inline-flex items-center rounded-full bg-white/[0.1] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">
              Produto recomendado
            </div>
            <div className="line-clamp-2 text-[13.5px] font-semibold leading-snug tracking-[-0.02em] text-white">
              {primaryProduct.nome}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[12px] text-white/48">
              <span className="truncate">{primaryProduct.categoria}</span>
              <span className="h-1 w-1 rounded-full bg-white/20" />
              <span className="shrink-0 font-semibold text-white/82">{formatPrice(primaryProduct.preco)}</span>
            </div>
          </div>
        </button>

        <div className="flex flex-wrap gap-1.5 pl-1">
          {buildStatChips(primaryProduct).slice(0, 3).map((chip) => (
            <span
              key={`${primaryProduct.id}-${chip.label}`}
              className={`inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-medium ${
                chip.tone === "success"
                  ? "bg-emerald-400/14 text-emerald-200"
                  : "bg-white/[0.07] text-white/58"
              }`}
            >
              {chip.label}
            </span>
          ))}
        </div>

        {alternativeProducts.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
              Alternativas
            </div>
            <div className="space-y-1.5">
              {alternativeProducts.slice(0, 3).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleChipClick(`Quero analisar ${product.nome}`)}
                  className="flex w-full items-center gap-2.5 rounded-[16px] bg-white/[0.055] p-2 text-left transition-colors hover:bg-white/[0.09]"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[12px] bg-white/[0.06]">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.nome} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-white/30">
                        <PackageSearch size={15} strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-white/82">
                      {product.nome}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/42">
                      <span className="truncate">{product.categoria}</span>
                      <span className="shrink-0 text-white/70">{formatPrice(product.preco)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const footerValue = chatMode ? chatInput : customPrompt;
  const isFooterDisabled = busy || !footerValue.trim();
  const compactPromptOptions = chatMode ? QUICK_ACTIONS : INITIAL_SUGGESTIONS;
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
                  initial={{ opacity: 0, scale: 0.96, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="pointer-events-auto space-y-3">
                    {chatMode && (
                      <div className="flex h-[52px] items-center gap-3 rounded-full bg-[#2E2E2E] px-4 shadow-[0_18px_34px_rgba(0,0,0,0.18)]">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
                          <AquasIcon size={28} />
                        </span>
                        <p className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-[-0.02em] text-white/62">
                          O que você quer descobrir sobre produtos?
                        </p>
                      </div>
                    )}

                    {!chatMode ? (
                      <div className="relative h-[560px] overflow-hidden rounded-[34px] bg-[#020202] shadow-[0_28px_70px_rgba(0,0,0,0.30)]">
                        <div className="pointer-events-none absolute left-1/2 top-10 h-52 w-52 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(90,120,132,0.12)_0%,rgba(42,62,72,0.06)_34%,transparent_70%)] blur-xl" />

                        <div className="relative flex h-full flex-col justify-between px-5 pb-5 pt-16">
                          <div className="flex justify-center">
                            <span className="grid h-[78px] w-[78px] place-items-center rounded-full bg-white/[0.03] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_34px_rgba(255,255,255,0.08)]">
                              <AquasIcon size={72} inverted />
                            </span>
                          </div>

                          <div className="mb-3 space-y-2.5">
                            {INITIAL_SUGGESTIONS.slice(0, 3).map((option, index) => {
                              const Icon = option.icon;

                              return (
                                <button
                                  key={option.label}
                                  type="button"
                                  onClick={() => handleChipClick(option.value)}
                                  className="flex w-fit max-w-full items-center gap-2 rounded-full bg-[#28282a]/85 px-5 py-3.5 text-left text-[14px] font-medium tracking-[-0.01em] text-white/62 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:bg-[#34363a]/90 hover:text-white/78"
                                >
                                  {index === 0 && <Icon size={15} strokeWidth={1.7} className="shrink-0 text-white/48" />}
                                  <span className="truncate">{option.label}</span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="rounded-[28px] border border-white/[0.06] bg-[linear-gradient(135deg,rgba(48,61,68,0.68),rgba(28,31,33,0.78))] px-4 pb-4 pt-3 shadow-[0_20px_50px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl">
                            <div className="mb-3 text-[13px] font-medium text-white/52 drop-shadow-[0_0_14px_rgba(122,177,196,0.24)]">
                              Ouvindo
                            </div>
                            <form onSubmit={handleFooterSubmit} className="flex items-center gap-2">
                              <button
                                type="button"
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/90 text-[#111] shadow-[0_8px_20px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform hover:scale-[1.03]"
                                aria-label="Adicionar contexto"
                              >
                                <Plus size={18} strokeWidth={1.8} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleChipClick("Faça uma busca profunda de produtos com alto potencial")}
                                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[#1e2529]/70 px-3.5 text-[13px] font-semibold text-white/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-[#263139]"
                              >
                                <Search size={15} strokeWidth={1.8} />
                                DeepSearch
                              </button>
                              <button
                                type="button"
                                onClick={() => handleChipClick("Pense em uma recomendação estratégica de produto")}
                                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[#1e2529]/70 px-3.5 text-[13px] font-semibold text-white/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-[#263139]"
                              >
                                <Lightbulb size={15} strokeWidth={1.8} />
                                Think
                              </button>
                              <input
                                ref={footerInputRef}
                                value={footerValue}
                                onChange={(event) => handleFooterChange(event.target.value)}
                                onFocus={() => setFooterInputFocused(true)}
                                onBlur={() => setFooterInputFocused(false)}
                                placeholder=""
                                className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none"
                                aria-label="Pergunta para o Aquas"
                              />
                              <button
                                type="submit"
                                disabled={isFooterDisabled}
                                className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#0b0b0b] transition-transform hover:scale-[1.03] disabled:opacity-60"
                                aria-label="Enviar para o Aquas"
                              >
                                <span className="h-3.5 w-3.5 rounded-[4px] bg-[#0b0b0b]" />
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-[28px] bg-[#141414] shadow-[0_22px_42px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.04]">
                        <div
                          ref={chatContainerRef}
                          className="max-h-[min(60vh,520px)] overflow-y-auto px-4 pb-3 pt-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                          <div className="mb-8 flex justify-center opacity-25">
                            <span className="grid h-14 w-14 place-items-center">
                              <AquasIcon size={52} inverted />
                            </span>
                          </div>

                          <div className="space-y-3">
                            {chatMessages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                              >
                                <div
                                  className={`max-w-[86%] whitespace-pre-line rounded-[20px] px-4 py-3 text-[13px] font-medium leading-relaxed ${
                                    msg.role === "user"
                                      ? "bg-white text-[#111]"
                                      : "bg-[#303236] text-white/78"
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
                              <div className="inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.08] px-4 text-[13px] font-medium text-white/68">
                                <span className="aquas-shimmer h-1.5 w-1.5 rounded-full" />
                                Analisando produtos do catálogo...
                              </div>
                            )}
                          </div>
                        </div>

                      <form
                        onSubmit={handleFooterSubmit}
                        className="flex h-[56px] items-center gap-3 border-t border-white/[0.05] bg-[#2E2E2E] px-4"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
                          <AquasIcon size={28} />
                        </span>
                        <input
                          ref={footerInputRef}
                          value={footerValue}
                          onChange={(event) => handleFooterChange(event.target.value)}
                          onFocus={() => setFooterInputFocused(true)}
                          onBlur={() => setFooterInputFocused(false)}
                          placeholder={busy ? "Aquas está pensando..." : chatMode ? "Continue conversando com o Aquas..." : "Escreva sua resposta para o Aquas..."}
                          className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium tracking-[-0.02em] text-white outline-none placeholder:text-white/48"
                        />
                        <button
                          type="submit"
                          disabled={isFooterDisabled}
                          aria-label="Enviar resposta para o Aquas"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 transition-all hover:bg-white/16 hover:text-white disabled:pointer-events-none disabled:opacity-0"
                        >
                          <ArrowUp size={15} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={close}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/8 hover:text-white/80"
                          aria-label="Fechar Aquas"
                        >
                          <X size={16} strokeWidth={1.8} />
                        </button>
                      </form>

                      <div className="flex items-center gap-2 overflow-hidden px-3 pb-3">
                        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {busy ? (
                            <span className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-white/[0.08] px-4 text-[13px] font-medium text-white/68">
                              <span className="aquas-shimmer h-1.5 w-1.5 rounded-full" />
                              Buscando no catálogo...
                            </span>
                          ) : (
                            compactPromptOptions.map((option) => (
                              <button
                                key={option.label}
                                type="button"
                                onClick={() => handleChipClick(option.value)}
                                className="inline-flex h-8 max-w-[220px] shrink-0 items-center rounded-full bg-white/[0.08] px-4 text-[13px] font-medium tracking-[-0.01em] text-white/86 transition-colors hover:bg-white/[0.13] hover:text-white"
                              >
                                <span className="truncate">{option.label}</span>
                              </button>
                            ))
                          )}
                          {chatMode && !busy && chatMessages.length > 0 && (
                            <button
                              type="button"
                              onClick={close}
                              className="inline-flex h-8 shrink-0 items-center rounded-full bg-white px-4 text-[13px] font-semibold text-[#1E1E1E] transition-transform hover:scale-[1.02]"
                            >
                              Ver resultados
                            </button>
                          )}
                        </div>
                      </div>
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
