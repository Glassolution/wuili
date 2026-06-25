import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type AtlasResults = {
  ids: string[];
  label: string;
  source: "preference" | "ai" | "fallback";
};

type ProductScoutAIProps = {
  onResults: (results: AtlasResults) => void;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ProductPreview = {
  id: string;
  title: string;
  image_url: string;
  cost_price: number;
  suggested_price: number;
};

const ALLOWED_SOURCES = ["cj", "b2drop", "c7drop"];
const RESULT_LIMIT = 24;

const SaturnIcon = () => (
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

const VeloOrb = ({ active = false }: { active?: boolean }) => (
  <span className="relative grid h-12 w-12 shrink-0 place-items-center">
    <motion.span
      className="absolute h-12 w-12 rounded-full bg-emerald-400/30 blur-md"
      animate={active ? { opacity: [0.3, 0.8, 0.3], scale: [0.9, 1.15, 0.9] } : { opacity: 0.6, scale: 1 }}
      transition={{ duration: 1.55, repeat: active ? Infinity : 0, ease: "easeInOut" }}
    />
    <motion.span
      className="relative h-9 w-9 rounded-full bg-[radial-gradient(circle_at_32%_24%,#eaffde_0%,#7cff74_30%,#04c83b_58%,#01831f_100%)] shadow-[inset_-5px_-7px_12px_rgba(0,0,0,0.24),inset_4px_4px_10px_rgba(255,255,255,0.48),0_0_20px_rgba(27,255,86,0.34)]"
      animate={active ? { rotate: [0, 8, -6, 0], scale: [1, 1.04, 1] } : { rotate: 0, scale: 1 }}
      transition={{ duration: 1.9, repeat: active ? Infinity : 0, ease: "easeInOut" }}
    />
  </span>
);

async function runFreeTextSearch(text: string): Promise<{ ids: string[]; source: "ai" | "fallback" }> {
  try {
    const { data, error } = await supabase.functions.invoke("atlas-search", {
      body: { query: text },
    });
    if (error) throw error;
    const ids = Array.isArray(data?.ids) ? (data.ids as string[]) : [];
    if (ids.length > 0) {
      return { ids, source: data?.used_fallback ? "fallback" : "ai" };
    }
  } catch (err) {
    console.error("atlas-search invoke failed", err);
  }

  const safe = text.replace(/[%,]/g, " ").trim();
  const { data } = await supabase
    .from("catalog_products")
    .select("id")
    .in("source", ALLOWED_SOURCES)
    .eq("is_blocked", false)
    .gt("stock_quantity", 0)
    .or(`title.ilike.%${safe}%,category.ilike.%${safe}%`)
    .order("orders_count", { ascending: false, nullsFirst: false })
    .limit(RESULT_LIMIT);

  return { ids: (data ?? []).map((r) => r.id as string), source: "fallback" };
}

async function fetchProductPreviews(ids: string[]): Promise<ProductPreview[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("catalog_products")
    .select("id, title, images, cost_price, suggested_price")
    .in("id", ids)
    .in("source", ALLOWED_SOURCES);

  if (error) throw error;

  return (data ?? []).map((p) => {
    let imageUrl = "";
    try {
      const images = typeof p.images === "string" ? JSON.parse(p.images) : p.images;
      imageUrl = Array.isArray(images) && images.length > 0 ? images[0] : "";
    } catch {
      imageUrl = "";
    }

    return {
      id: p.id,
      title: p.title || "Produto sem nome",
      image_url: imageUrl,
      cost_price: p.cost_price || 0,
      suggested_price: p.suggested_price || 0,
    };
  });
}

const ProductScoutAI = ({ onResults }: ProductScoutAIProps) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const runRef = useRef(0);

  // Expansion state
  const [expanded, setExpanded] = useState(false);

  // Search/Results state
  const [searchResults, setSearchResults] = useState<ProductPreview[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  // Chat state
  const [chatMode, setChatMode] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const openPanel = () => {
    setOpen(true);
    setError(null);
    setExpanded(false);
    setChatMode(false);
    setChatMessages([]);
    setSearchResults([]);
  };

  const close = () => {
    runRef.current += 1;
    setOpen(false);
    setExpanded(false);
    setBusy(false);
    setChatMode(false);
    setChatMessages([]);
    setSearchResults([]);
    setCustomPrompt("");
  };

  const handleSubmitText = async (text?: string) => {
    const clean = (text ?? customPrompt).trim();
    if (!clean) return;
    const runId = ++runRef.current;
    setBusy(true);
    setError(null);
    setExpanded(true);
    setChatMode(false);
    setLoadingResults(true);
    try {
      const { ids, source } = await runFreeTextSearch(clean);
      if (runId !== runRef.current) return;

      const products = await fetchProductPreviews(ids);
      if (runId !== runRef.current) return;

      setSearchResults(products);
      setCustomPrompt("");

      // Notifica o pai
      onResults({ ids, label: clean, source });
    } catch (err) {
      console.error("Free text search failed", err);
      if (runId !== runRef.current) return;
      setError("Não consegui buscar agora. Tente novamente.");
    } finally {
      if (runId === runRef.current) {
        setBusy(false);
        setLoadingResults(false);
      }
    }
  };

  const handleSendChatWith = async (message: string) => {
    if (!message.trim() || isTyping) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: message,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [
            { role: "user", content: message },
          ],
        },
      });

      if (error) throw error;

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data?.response || "Desculpe, não consegui processar sua mensagem.",
      };

      setChatMessages((prev) => [...prev, aiResponse]);
    } catch (err) {
      console.error("Chat error:", err);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Ops, tive um problema ao processar sua mensagem. Tente novamente!",
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      setChatInput("");
    }
  };

  const handleSendChat = async () => {
    const message = chatInput.trim();
    if (!message || isTyping) return;
    await handleSendChatWith(message);
  };

  const handleBackToResults = () => {
    setChatMode(false);
  };

  // Scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Auto-close em ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && !isTyping) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, isTyping]);

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        disabled={busy}
        className="group inline-flex h-12 items-center gap-3 rounded-full border border-white/10 bg-[#050505] px-6 text-[14px] font-semibold tracking-[-0.01em] text-white shadow-[0_14px_30px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.09)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-black disabled:cursor-wait disabled:opacity-70"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full text-white transition-transform duration-300 group-hover:-rotate-12">
          <SaturnIcon />
        </span>
        Atlas
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="atlas-shell"
                className="fixed inset-x-0 top-0 z-[120] pointer-events-none px-4 pt-8 text-white flex flex-col items-center gap-3"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
              >
                {/* Search Input Bar (Floating Pill) */}
                <motion.div
                  layout
                  className="pointer-events-auto w-[min(100%,580px)] overflow-hidden rounded-full bg-[#1c1c1e] px-4 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.5)] text-white backdrop-blur-xl"
                >
                  <div className="flex h-11 items-center gap-3">
                    <VeloOrb active={busy || loadingResults || isTyping} />
                    <input
                      value={chatMode ? (searchResults.length > 0 ? "Explorando recomendações do Atlas" : "Conversando com Atlas") : customPrompt}
                      readOnly={chatMode}
                      onChange={(e) => {
                        if (!chatMode) setCustomPrompt(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !chatMode) {
                          e.preventDefault();
                          void handleSubmitText();
                        }
                      }}
                      disabled={busy || loadingResults}
                      placeholder="O que você quer saber sobre produtos para vender?"
                      className={`h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-white outline-none placeholder:text-white/40 ${
                        chatMode ? "cursor-default select-none text-white/70" : "disabled:cursor-wait"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={close}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label="Fechar Atlas"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </motion.div>

                {/* Suggestions Bar (Separate Floating Pill - Image 2 Style) */}
                {!chatMode && searchResults.length === 0 && !loadingResults && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="pointer-events-auto w-[min(100%,580px)] overflow-hidden rounded-full bg-[#1c1c1e] px-3.5 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.4)] text-white"
                  >
                    <div className="flex gap-2 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {[
                        "Produtos para viralizar",
                        "Maior margem de lucro",
                        "Estoque alto",
                        "Preço baixo",
                        "Ideias de nichos",
                      ].map((question, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setCustomPrompt(question);
                            void handleSubmitText(question);
                          }}
                          className="shrink-0 rounded-full bg-[#2a2a2c] hover:bg-[#323235] active:bg-[#3d3d40] px-4.5 py-2.5 text-[13px] font-normal text-white/85 transition-all hover:scale-[1.01] active:scale-[0.99]"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Loading State (Separate Floating Pill) */}
                {loadingResults && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pointer-events-auto w-[min(100%,580px)] overflow-hidden rounded-full bg-[#1c1c1e] py-3.5 px-6 shadow-[0_12px_30px_rgba(0,0,0,0.4)] text-white flex items-center justify-center"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "0ms" }} />
                      <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "150ms" }} />
                      <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "300ms" }} />
                      <span className="ml-2 text-[13px] font-medium text-white/60">Buscando no catálogo...</span>
                    </div>
                  </motion.div>
                )}

                {/* Error State (Separate Floating Pill) */}
                {error && !loadingResults && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pointer-events-auto w-[min(100%,580px)] overflow-hidden rounded-[20px] bg-red-500/10 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.4)] text-white text-center"
                  >
                    <div className="text-[13px] text-red-400">
                      {error}
                    </div>
                  </motion.div>
                )}

                {/* Search Results Grid (Separate Floating Card below) */}
                {!chatMode && !loadingResults && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pointer-events-auto w-[min(100%,580px)] overflow-hidden rounded-[24px] bg-[#1c1c1e] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-white"
                  >
                    <div className="space-y-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30 px-1">
                        Produtos Recomendados
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10">
                        {searchResults.slice(0, 12).map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => {
                              setChatMode(true);
                              setChatMessages([
                                {
                                  id: "1",
                                  role: "assistant",
                                  content: `Encontrei este produto para você!\n\n**${product.title}**\n\n💰 Preço sugerido: R$ ${product.suggested_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\nPosso te ajudar com:\n• Gerar uma descrição otimizada\n• Encontrar produtos similares\n• Ajustar preço e estratégia\n\nO que você quer saber?`,
                                },
                              ]);
                            }}
                            className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 text-left transition-all hover:bg-white/[0.08] hover:scale-[1.01]"
                          >
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5">
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-white/30 text-xs">
                                  📦
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-[11px] font-medium text-white leading-tight">
                                {product.title}
                              </p>
                              <p className="mt-1 text-[12px] font-semibold text-emerald-400">
                                R$ {product.suggested_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Quick Actions Bar after results */}
                      <div className="flex gap-2 items-center overflow-x-auto rounded-full bg-black/25 px-2.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setChatMode(true);
                            setChatMessages([
                              {
                                id: Date.now().toString(),
                                role: "assistant",
                                content: `Sobre os ${searchResults.length} produtos encontrados, qual deles possui a melhor margem de lucro no catálogo?`,
                              },
                            ]);
                          }}
                          className="shrink-0 rounded-full bg-[#2a2a2c] hover:bg-[#323235] active:bg-[#3d3d40] px-4 py-2 text-[12px] font-medium text-white/80 transition-all"
                        >
                          Qual tem melhor margem?
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setChatMode(true);
                            setChatMessages([
                              {
                                id: Date.now().toString(),
                                role: "assistant",
                                content: `Gostaria de ver produtos similares a estes que encontrei? Me diga que características você procura!`,
                              },
                            ]);
                          }}
                          className="shrink-0 rounded-full bg-[#2a2a2c] hover:bg-[#323235] active:bg-[#3d3d40] px-4 py-2 text-[12px] font-medium text-white/80 transition-all"
                        >
                          Ver similares
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchResults([]);
                            setCustomPrompt("");
                          }}
                          className="shrink-0 rounded-full bg-[#2a2a2c] hover:bg-[#323235] active:bg-[#3d3d40] px-4 py-2 text-[12px] font-medium text-white/80 transition-all"
                        >
                          Nova busca
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Chat Mode Panel (Separate Floating Card below) */}
                {chatMode && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pointer-events-auto w-[min(100%,580px)] overflow-hidden rounded-[24px] bg-[#1c1c1e] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-white"
                  >
                    <div className="flex flex-col space-y-3 pt-1">
                      {/* Chat Header with back button */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleBackToResults}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/[0.1] hover:text-white"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12 19-7-7 7-7" />
                            <path d="M19 12H5" />
                          </svg>
                          Ver Resultados
                        </button>
                        <span className="text-[12px] text-white/40">Conversando com Atlas</span>
                      </div>

                      {/* Messages Area */}
                      <div
                        ref={chatContainerRef}
                        className="flex-1 overflow-y-auto px-1 py-1 space-y-3 max-h-[260px] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10"
                      >
                        {chatMessages.length === 0 && (
                          <div className="flex justify-start">
                            <div className="max-w-[85%] rounded-2xl bg-white/[0.06] px-4 py-2.5 text-[13px] leading-relaxed text-white/90">
                              Olá! Me conta o que você quer saber sobre produtos para vender. 💡
                            </div>
                          </div>
                        )}
                        {chatMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                                msg.role === "user"
                                  ? "bg-emerald-500 text-white"
                                  : "bg-white/[0.06] text-white/90"
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>
                        ))}
                        {isTyping && (
                          <div className="flex justify-start">
                            <div className="rounded-2xl bg-white/[0.06] px-4 py-3">
                              <div className="flex gap-1">
                                <span className="h-2 w-2 animate-bounce rounded-full bg-white/50" style={{ animationDelay: "0ms" }} />
                                <span className="h-2 w-2 animate-bounce rounded-full bg-white/50" style={{ animationDelay: "150ms" }} />
                                <span className="h-2 w-2 animate-bounce rounded-full bg-white/50" style={{ animationDelay: "300ms" }} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* AI Suggestion Bar at the bottom of the chat */}
                      <div className="flex gap-2 items-center overflow-x-auto rounded-full bg-black/25 px-2.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {[
                          "Como vender este produto?",
                          "Gerar descrição para o ML",
                          "Qual o público-alvo ideal?",
                          "Ideias de anúncios no TikTok",
                        ].map((question, index) => (
                          <button
                            key={index}
                            type="button"
                            disabled={isTyping}
                            onClick={() => {
                              void handleSendChatWith(question);
                            }}
                            className="shrink-0 rounded-full bg-[#2a2a2c] hover:bg-[#323235] active:bg-[#3d3d40] px-4 py-2 text-[12px] font-normal text-white/85 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                          >
                            {question}
                          </button>
                        ))}
                      </div>

                      {/* Chat Input */}
                      <form
                        className="flex items-center gap-2 rounded-full bg-white/[0.04] px-4 py-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleSendChat();
                        }}
                      >
                        <input
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          disabled={isTyping}
                          placeholder="Pergunte algo sobre o produto..."
                          className="h-8 flex-1 bg-transparent text-[13px] font-medium text-white outline-none placeholder:text-white/30 disabled:cursor-wait"
                        />
                        <button
                          type="submit"
                          disabled={!chatInput.trim() || isTyping}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white transition-all hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m22 2-7 20-4-9-9-4Z" />
                            <path d="M22 2 11 13" />
                          </svg>
                        </button>
                      </form>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
};

export default ProductScoutAI;
