import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type Product } from "@/components/dashboard/ProductCard";
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
  product?: Product;
};

const ALLOWED_SOURCES = ["c7drop"];

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
  let animateValue: any = 0;
  let transitionValue: any = {};

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
    @keyframes think-glow {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .animate-think-glow {
      background: linear-gradient(90deg, #2563EB, #10B981, #7C3AED, #EF4444, #2563EB);
      background-size: 200% 200%;
      animation: think-glow 3s linear infinite;
    }
  `}} />
);

const FALLBACK_PRODUCTS: Product[] = [
  {
    id: "fb-viral",
    nome: "Mini Processador de Alimentos Portátil USB",
    categoria: "Casa",
    preco: 49.90,
    image_url: "https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=500&auto=format&fit=crop&q=60",
    images: ["https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=500&auto=format&fit=crop&q=60"],
  },
  {
    id: "fb-margin",
    nome: "Garrafa Térmica Inteligente com Sensor LED",
    categoria: "Esporte",
    preco: 79.90,
    image_url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60",
    images: ["https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60"],
  },
  {
    id: "fb-stock",
    nome: "Fone de Ouvido Bluetooth Sem Fio PRO",
    categoria: "Eletrônicos",
    preco: 89.90,
    image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60",
    images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60"],
  },
  {
    id: "fb-lowprice",
    nome: "Ring Light de Mesa Compacta LED USB",
    categoria: "Eletrônicos",
    preco: 39.90,
    image_url: "https://images.unsplash.com/photo-1612444530582-fc66183b16f7?w=500&auto=format&fit=crop&q=60",
    images: ["https://images.unsplash.com/photo-1612444530582-fc66183b16f7?w=500&auto=format&fit=crop&q=60"],
  }
];

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
  const [lastSuggestedProduct, setLastSuggestedProduct] = useState<Product | null>(null);

  const [inputFocused, setInputFocused] = useState(false);
  const [chatInputFocused, setChatInputFocused] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isTyping, setIsTyping] = useState(false);
  const [typingTrigger, setTypingTrigger] = useState(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  }, [open, initialPrompt]);

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
    setLastSuggestedProduct(null);
  };

  const close = () => {
    setOpen(false);
    setChatMode(false);
    setChatMessages([]);
    setBusy(false);

    if (lastSuggestedProduct) {
      onResults({
        ids: [lastSuggestedProduct.id],
        label: `Recomendado pelo Aquas: ${lastSuggestedProduct.nome}`,
        source: "ai",
      });
    }
  };

  const executeRealSearch = async (text: string) => {
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

      let recommendedProduct: Product | null = null;

      // 2. Se a Edge Function retornou IDs válidos, busca os detalhes do produto em destaque
      if (ids.length > 0) {
        const firstId = ids[0];
        const { data: prodData, error: dbError } = await supabase
          .from("catalog_products")
          .select("id, title, images, cost_price, suggested_price, category")
          .eq("id", firstId)
          .single();

        if (!dbError && prodData) {
          let imageUrl = "";
          let imagesArr: string[] = [];
          try {
            imagesArr = typeof prodData.images === "string" ? JSON.parse(prodData.images) : prodData.images;
            if (!Array.isArray(imagesArr)) imagesArr = [];
            imageUrl = imagesArr.length > 0 ? imagesArr[0] : "";
          } catch {
            imageUrl = "";
          }

          recommendedProduct = {
            id: prodData.id,
            nome: prodData.title || "Produto sem título",
            categoria: prodData.category || "Geral",
            preco: prodData.suggested_price || prodData.cost_price * 1.5 || 49.9,
            image_url: imageUrl,
            images: imagesArr,
          };
        }
      }

      // Garante uma duração visual mínima de 750ms para a animação de "Thinking"
      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 750 - elapsed);
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      if (recommendedProduct) {
        setLastSuggestedProduct(recommendedProduct);
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: recommendedProduct 
          ? aiResponseText 
          : "Não encontrei produtos que atendam exatamente a essa solicitação no catálogo. Que tal tentar outras palavras-chave?",
        product: recommendedProduct || undefined,
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
  };

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
  }, [open, busy, lastSuggestedProduct]);

  return (
    <>
      <Styles />
      {showTriggerButton && (
        <button
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
                {/* Backdrop escurecido */}
                <motion.div
                  key="atlas-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={close}
                  className="fixed inset-0 z-[110] bg-black/65 backdrop-blur-xs pointer-events-auto"
                />

                {/* Container principal flutuante */}
                <motion.div
                  key="atlas-shell"
                  className="fixed inset-x-0 top-0 z-[120] pointer-events-none px-4 pt-8 text-white flex flex-col items-center gap-4"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  {!chatMode ? (
                    /* ESTADO INICIAL (Duas Pills Empilhadas) */
                    <>
                      {/* 1. PILL SUPERIOR (com input de texto / pensando) */}
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className="pointer-events-auto w-full max-w-[620px] rounded-full bg-[#1E1E1E] border border-white/[0.04] py-2 px-4.5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_1px_rgba(255,255,255,0.06)] text-white flex items-center gap-4"
                      >
                        <div className="pl-0.5 flex items-center shrink-0">
                          <VeloOrb state={orbState} typingTrigger={typingTrigger} />
                        </div>

                        <div className="flex-1 min-w-0">
                          {busy ? (
                            /* Estado Pensando / Listening */
                            <div className="relative overflow-hidden rounded-full p-[1.5px] animate-think-glow shadow-[0_0_20px_rgba(59,130,246,0.12)]">
                              <div className="flex h-9 w-full items-center justify-between rounded-full bg-[#1E1E1E] px-4 text-white/80">
                                <div className="flex items-center gap-2">
                                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#3b82f6]" style={{ animationDelay: "0ms" }} />
                                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#10b981]" style={{ animationDelay: "150ms" }} />
                                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8b5cf6]" style={{ animationDelay: "300ms" }} />
                                  <span className="text-[12px] font-medium text-white/70 tracking-[0.015em] select-none">
                                    Ouvindo & Buscando...
                                  </span>
                                </div>
                                <span className="text-[9px] uppercase font-bold tracking-widest text-[#3b82f6] select-none animate-pulse">
                                  Thinking
                                </span>
                              </div>
                            </div>
                          ) : (
                            /* Campo de Input Normal */
                            <form 
                              onSubmit={handleSendInitialPrompt} 
                              className="flex h-9 items-center w-full bg-transparent"
                            >
                              <input
                                ref={inputRef}
                                value={customPrompt}
                                onChange={(e) => handleInputChange(e.target.value)}
                                onFocus={() => setInputFocused(true)}
                                onBlur={() => setInputFocused(false)}
                                placeholder="Ex: quero um fone barato para vender..."
                                className="h-full w-full bg-transparent text-[14.5px] text-white outline-none placeholder:text-white/35"
                              />
                            </form>
                          )}
                        </div>
                      </motion.div>

                      {/* 2. PILL INFERIOR (contém pergunta + chips) */}
                      <motion.div
                        layout
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className="pointer-events-auto w-full max-w-[620px] overflow-hidden rounded-[28px] bg-[#1E1E1E] border border-white/[0.04] py-5 px-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_1px_rgba(255,255,255,0.06)] text-white flex flex-col gap-4.5"
                      >
                        {/* Linha 1: Orb + Título + X */}
                        <div className="flex items-center justify-between gap-5">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <VeloOrb state={orbState} typingTrigger={typingTrigger} />
                            <h3 className="m-0 p-0 text-[17px] font-normal text-white/90 tracking-[-0.01em] leading-none relative -top-[0.5px]">
                              Que tipo de produto você quer encontrar hoje?
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={close}
                            className="text-white/40 hover:text-white transition-colors p-1 shrink-0 mr-0.5"
                            aria-label="Fechar Aquas"
                          >
                            <X size={15} strokeWidth={2.5} />
                          </button>
                        </div>

                        {/* Linha 2: Chips de Sugestão com scroll horizontal */}
                        {!busy && (
                          <div className="flex gap-1.5 overflow-x-auto pb-0.5 pt-0.5 -mx-1 px-1 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-nowrap mt-4">
                            {[
                              { label: "Produto para viralizar", value: "Produto para viralizar" },
                              { label: "Maior margem", value: "Maior margem de lucro" },
                              { label: "Estoque alto", value: "Estoque alto" },
                              { label: "Preço baixo", value: "Preço baixo" },
                            ].map((chip) => (
                              <button
                                key={chip.label}
                                type="button"
                                onClick={() => handleChipClick(chip.value)}
                                className="shrink-0 rounded-2xl bg-[#2E2E2E] hover:bg-[#3A3A3A] active:scale-[0.98] transition-all duration-150 px-6 py-2 text-[12.5px] font-medium text-white/85 border-none outline-none"
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    </>
                  ) : (
                    /* ESTADO EXPANDIDO (Chat Panel - Alinhado à estética de tons de cinza sólido) */
                    <motion.div
                      layout
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className="pointer-events-auto w-full max-w-[620px] overflow-hidden rounded-[28px] bg-[#1E1E1E] border border-white/[0.04] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_1px_rgba(255,255,255,0.06)] text-white flex flex-col max-h-[620px]"
                    >
                      {/* Chat Header */}
                      <div className="p-4.5 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-4">
                          <VeloOrb state={orbState} typingTrigger={typingTrigger} />
                          <div className="flex flex-col justify-center">
                            <h3 className="text-[14.5px] font-semibold text-white/95 tracking-tight leading-tight">
                              Aquas
                            </h3>
                            <span className="text-[11px] text-white/40 mt-0.5 tracking-[0.015em] select-none">
                              Seu agente de vendas
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={close}
                          className="text-white/40 hover:text-white transition-colors p-1 shrink-0 mr-0.5"
                          aria-label="Fechar Aquas"
                        >
                          <X size={15} strokeWidth={2.5} />
                        </button>
                      </div>

                      {/* Chat Messages scroll area */}
                      <div
                        ref={chatContainerRef}
                        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[220px] max-h-[380px] scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full"
                      >
                        {chatMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${
                              msg.role === "user" ? "items-end" : "items-start"
                            }`}
                          >
                            <div
                              className={`rounded-[20px] px-4 py-2.5 text-[13.5px] leading-relaxed max-w-[85%] border-none ${
                                msg.role === "user"
                                  ? "bg-[#2563EB]/90 text-white rounded-tr-xs"
                                  : "bg-[#2A2A2A] text-white/90 rounded-tl-xs"
                              }`}
                              style={{ boxShadow: msg.role === "assistant" ? "inset 0 1px 0 rgba(255,255,255,0.04)" : undefined }}
                            >
                              {msg.content}
                            </div>

                            {/* Card de produto inline */}
                            {msg.role === "assistant" && msg.product && (
                              <div className="mt-3.5 w-full max-w-[310px] rounded-[22px] shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden border-none">
                                <ProductCard
                                  product={msg.product}
                                  categoryLabel={msg.product.categoria}
                                  isFavorited={false}
                                  onToggleFavorite={() => {}}
                                  compact={true}
                                />
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Estado Pensando no Chat */}
                        {busy && (
                          <div className="flex flex-col items-start">
                            <div 
                              className="flex items-center gap-1.5 rounded-[20px] bg-[#2A2A2A] px-4 py-3 border-none"
                              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
                            >
                              <span className="h-2 w-2 animate-bounce rounded-full bg-white/40" style={{ animationDelay: "0ms" }} />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-white/40" style={{ animationDelay: "150ms" }} />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-white/40" style={{ animationDelay: "300ms" }} />
                              <span className="text-[12.5px] text-white/40 font-medium ml-1.5 select-none tracking-[0.01em]">Digitando...</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Quick action chips no Chat */}
                      {!busy && (
                        <div className="flex gap-2 items-center overflow-x-auto px-4 py-2.5 border-t border-white/5 bg-[#121216]/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {[
                            "Como vender este produto?",
                            "Gerar descrição no ML",
                            "Qual o público ideal?",
                            "Ideias de Reels/TikTok",
                          ].map((actionText) => (
                            <button
                              key={actionText}
                              type="button"
                              onClick={() => executeRealSearch(actionText)}
                              className="shrink-0 rounded-full bg-[#2A2A2A] hover:bg-[#323232] px-3.5 py-1.5 text-[11.5px] font-medium text-white/80 transition-all duration-150 active:scale-[0.98] border-none outline-none"
                              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
                            >
                              {actionText}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Input Footer no Chat */}
                      <div className="p-4 border-t border-white/5 bg-[#1A1A1A]">
                        {busy ? (
                          /* Loader animado no rodapé */
                          <div className="relative overflow-hidden rounded-full p-[1.5px] animate-think-glow animate-pulse">
                            <div className="flex h-11 w-full items-center justify-between rounded-full bg-[#121216] px-5 text-white/80">
                              <span className="text-[12.5px] text-white/50 font-medium animate-pulse select-none tracking-[0.015em]">
                                Aquas está formulando resposta...
                              </span>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                            </div>
                          </div>
                        ) : (
                          <form 
                            onSubmit={handleSendChat} 
                            className="flex h-11 items-center gap-2 rounded-[20px] bg-[#262626] px-4 transition-all focus-within:bg-[#2c2c2c]"
                            style={{
                              boxShadow: chatInputFocused
                                ? "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 2px rgba(52, 211, 153, 0.18)" 
                                : "inset 0 1px 0 rgba(255,255,255,0.04)"
                            }}
                          >
                            <input
                              value={chatInput}
                              onChange={(e) => handleChatInputChange(e.target.value)}
                              onFocus={() => setChatInputFocused(true)}
                              onBlur={() => setChatInputFocused(false)}
                              placeholder="Pergunte algo sobre o produto ou faça outra busca..."
                              className="h-full flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/20"
                            />
                            <button
                              type="submit"
                              disabled={!chatInput.trim()}
                              className="grid h-7 w-7 place-items-center rounded-full bg-white text-black transition-all hover:scale-105 disabled:opacity-20 border-none outline-none"
                            >
                              <Send size={12} strokeWidth={2.5} />
                            </button>
                          </form>
                        )}
                      </div>
                    </motion.div>
                  )}
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
