import { useState, useRef, useEffect } from "react";
import { ArrowUp, Plus, Package, ArrowUpRight, X, MessageSquare, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/profileContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SourceSelector, type ProductSource } from "@/components/chat/SourceSelector";

/* ══ Types ═══════════════════════════════════════════════════ */
type Product = {
  nome: string;
  imagem?: string;
  url?: string;
  precoCusto?: number;
  precoVenda?: number;
  margem: string;
  vendas?: string;
  score?: string;
  condicao?: string;
  vendedor?: string;
  preco?: string;
};
type Ad      = { titulo: string; descricao: string; preco: string; plataforma: string };
type MsgKind = "text" | "products" | "ad" | "searching" | "source-select";
type Message = {
  role: "user" | "ai";
  text: string;
  kind: MsgKind;
  products?: Product[];
  ad?: Ad;
  nicho?: string;
};

type Conversation = {
  id: string;
  title: string;
  preview: string;
  date: string;
};

/* ══ Wuilli hex icon ══════════════════════════════════════════ */
const WuilliHex = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}>
    <rect width="30" height="30" rx="8" fill="#7C3AED" />
    <path d="M15 7.5L21 11.25V18.75L15 22.5L9 18.75V11.25L15 7.5Z" fill="white" />
  </svg>
);

/* ══ Searching card ═══════════════════════════════════════════ */
const SearchingCard = ({ nicho }: { nicho: string }) => (
  <div className="flex items-center gap-4 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/40 px-5 py-4 w-full max-w-[340px] shadow-sm">
    <div className="flex items-end gap-[3px] shrink-0 h-5">
      {[0, 1, 2, 3].map(i => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-[#7C3AED]/60"
          style={{ animation: "searchBar 1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-[#1a1a2e] leading-snug">Buscando produtos</p>
      <p className="text-xs text-[#6B7280] mt-0.5 truncate">
        Nicho: <span className="font-medium text-[#7C3AED] capitalize">{nicho}</span>
      </p>
    </div>
    <style>{`
      @keyframes searchBar {
        0%, 100% { height: 6px; opacity: 0.4; }
        50%       { height: 20px; opacity: 1; }
      }
    `}</style>
  </div>
);

/* ══ Edge Function calls ══════════════════════════════════════ */
async function callAI(history: { role: string; content: string }[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke("chat", {
    body: { messages: history },
  });
  if (error) throw new Error(error.message || "Erro ao conectar com a IA");
  return data?.response || data?.choices?.[0]?.message?.content || "Erro ao processar resposta.";
}

async function fetchAliExpress(nicho: string): Promise<Product[]> {
  const { data, error } = await supabase.functions.invoke("aliexpress-products", {
    body: { nicho },
  });
  if (error) throw new Error(error.message || "Erro ao buscar produtos");
  return (data?.products ?? []) as Product[];
}

async function fetchMercadoLivre(nicho: string): Promise<Product[]> {
  const query = encodeURIComponent(nicho);
  const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${query}&limit=12`);
  if (!res.ok) throw new Error("Erro ao buscar no Mercado Livre");
  const mlData = await res.json();
  return (mlData.results ?? []).map((item: any) => ({
    nome: item.title,
    imagem: item.thumbnail?.replace("http://", "https://"),
    url: item.permalink,
    precoVenda: item.price,
    margem: "",
    condicao: item.condition === "new" ? "Novo" : "Usado",
    vendedor: item.seller?.nickname || "",
  }));
}

/* ══ Parse AI response ════════════════════════════════════════ */
function parse(text: string): Pick<Message, "kind" | "products" | "ad"> & { _nicho?: string } {
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const p = JSON.parse(m[0]);
      if (p.tipo === "buscar_produtos" && p.nicho) return { kind: "text", _nicho: p.nicho };
      if (p.tipo === "produtos" && Array.isArray(p.lista)) return { kind: "products", products: p.lista };
      if (p.tipo === "anuncio")                            return { kind: "ad", ad: p };
    } catch { /**/ }
  }
  return { kind: "text" };
}

/* ══ Suggestion chips ═════════════════════════════════════════ */
const suggestions = [
  { emoji: "🔥", label: "Produtos em alta", msg: "Quais produtos estão em alta agora?" },
  { emoji: "💰", label: "Alta margem",       msg: "Quais produtos têm maior margem de lucro?" },
  { emoji: "🚀", label: "Fácil de vender",  msg: "Quais produtos são mais fáceis para iniciantes venderem?" },
];

/* ══ InputBar ═════════════════════════════════════════════════ */
interface InputBarProps {
  input:    string;
  thinking: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
  onChange: (val: string) => void;
  onSend:   () => void;
}

const InputBar = ({ input, thinking, inputRef, onChange, onSend }: InputBarProps) => {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 rounded-2xl border bg-white/70 backdrop-blur-sm transition-all min-h-[52px]",
        focused
          ? "border-[#7C3AED]/40 shadow-[0_0_0_3px_rgba(124,58,237,0.06)]"
          : "border-white/50"
      )}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder={thinking ? "Wuilli está pensando..." : "Ask me anything ..."}
        value={input}
        disabled={thinking}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && !thinking && onSend()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="flex-1 bg-transparent text-sm text-[#1a1a2e] placeholder:text-[#9CA3AF] outline-none disabled:cursor-not-allowed"
      />
      <button
        onClick={onSend}
        disabled={thinking || !input.trim()}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ArrowUp size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
};

/* ══ Main Component ═══════════════════════════════════════════ */
const GitChatPage = () => {
  const { nome }   = useProfile();
  const { user }   = useAuth();

  const [profileName, setProfileName] = useState(nome);
  const primeiroNome = profileName.split(/[\s._\-]+/)[0] || profileName;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState("");
  const [thinking, setThinking] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const apiHistory = useRef<{ role: string; content: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => { if (data?.display_name) setProfileName(data.display_name); });
  }, [user]);

  useEffect(() => { if (nome) setProfileName(nome); }, [nome]);

  // Load conversations
  useEffect(() => {
    if (!user) return;
    supabase
      .from("conversations")
      .select("id, title, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setConversations(data.map(c => ({
            id: c.id,
            title: c.title || "Nova conversa",
            preview: "",
            date: new Date(c.created_at).toLocaleDateString("pt-BR"),
          })));
        }
      });
  }, [user]);

  const hasStarted        = messages.length > 0;
  const conversationTitle = messages.find(m => m.role === "user")?.text?.slice(0, 48) ?? "Nova conversa";

  /* ── Send ──────────────────────────────────────────────────── */
  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || thinking) return;
    setInput("");
    inputRef.current?.focus();

    const userMsg: Message = { role: "user", text: msg, kind: "text" };
    setMessages(prev => [...prev, userMsg]);
    const nextHistory = [...apiHistory.current, { role: "user", content: msg }];
    setThinking(true);

    try {
      const response = await callAI(nextHistory);
      apiHistory.current = [...nextHistory, { role: "assistant", content: response }];
      const parsed = parse(response);

      if (parsed._nicho) {
        setMessages(prev => [
          ...prev,
          { role: "ai", text: "", kind: "source-select", nicho: parsed._nicho },
        ]);
        return;
      }
      setMessages(prev => [...prev, { role: "ai", text: response, ...parsed }]);
    } catch (err) {
      console.error("[Wuilli IA]", err);
      setMessages(prev => [
        ...prev,
        { role: "ai", text: "Erro de conexão. Tente novamente.", kind: "text" },
      ]);
    } finally {
      setThinking(false);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 60);
    }
  };

  /* ── New chat ──────────────────────────────────────────────── */
  const newChat = () => {
    setMessages([]);
    setInput("");
    setThinking(false);
    apiHistory.current = [];
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  /* ── Source confirmed → fetch products ────────────────────── */
  const handleSourceConfirm = async (nicho: string, source: ProductSource) => {
    setMessages(prev => {
      const without = prev.filter(m => m.kind !== "source-select");
      return [...without, { role: "ai", text: "", kind: "searching", nicho }];
    });

    let products: Product[] = [];
    let fetchError = false;
    try {
      products =
        source === "mercadolivre"
          ? await fetchMercadoLivre(nicho)
          : await fetchAliExpress(nicho);
    } catch {
      fetchError = true;
    }

    const sourceLabel = source === "mercadolivre" ? "Mercado Livre" : "AliExpress";

    if (fetchError || products.length === 0) {
      const noResultMsg =
        "Ainda não encontrei produtos disponíveis para esse nicho agora. " +
        "Isso pode acontecer porque a integração com o fornecedor está sendo ativada. " +
        "Tente novamente em alguns instantes ou escolha outro nicho.";
      apiHistory.current = [...apiHistory.current, { role: "assistant", content: noResultMsg }];
      setMessages(prev => {
        const without = prev.filter(m => m.kind !== "searching");
        return [...without, { role: "ai", text: noResultMsg, kind: "text" }];
      });
    } else {
      const context = `Produtos encontrados no ${sourceLabel} para "${nicho}": ${products.map(p => p.nome).join(", ")}`;
      apiHistory.current = [...apiHistory.current, { role: "assistant", content: context }];
      setMessages(prev => {
        const without = prev.filter(m => m.kind !== "searching");
        return [...without, { role: "ai", text: "", kind: "products", products }];
      });
    }

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }, 60);
  };

  /* ── Product cards — 2-column grid ───────────────────────── */
  const renderProducts = (products: Product[]) => (
    <div className="grid grid-cols-2 gap-3 w-full max-w-[560px]">
      {products.map((p, i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-sm overflow-hidden shadow-sm flex flex-col"
        >
          <div className="h-[140px] bg-white/30 overflow-hidden">
            {p.imagem ? (
              <img
                src={p.imagem}
                alt={p.nome}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package size={28} className="text-[#D1D5DB]" />
              </div>
            )}
          </div>
          <div className="p-3.5 flex flex-col flex-1 gap-1.5">
            <p className="text-[13px] font-semibold text-[#1a1a2e] line-clamp-2 leading-snug">
              {p.nome}
            </p>
            {p.margem && (
              <span className="self-start rounded-full bg-[#7C3AED]/10 px-2 py-0.5 text-[10px] font-bold text-[#7C3AED]">
                Margem {p.margem}
              </span>
            )}
            <div className="flex-1" />
            {p.precoVenda != null ? (
              <p className="text-base font-bold text-[#7C3AED]">
                R$ {p.precoVenda.toFixed(2).replace(".", ",")}
              </p>
            ) : p.precoCusto != null ? (
              <p className="text-base font-bold text-[#7C3AED]">
                R$ {p.precoCusto.toFixed(2).replace(".", ",")}
              </p>
            ) : p.preco ? (
              <p className="text-base font-bold text-[#7C3AED]">{p.preco}</p>
            ) : null}
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-[#9CA3AF] hover:text-[#7C3AED] transition-colors">
                Ver produto <ArrowUpRight size={10} />
              </a>
            )}
            <button
              onClick={() => send(`Quero publicar este produto: ${p.nome}. Preço sugerido: R$ ${p.precoVenda?.toFixed(2) ?? p.preco}`)}
              className="w-full h-[38px] bg-[#7C3AED] text-white text-xs font-semibold rounded-xl hover:bg-[#6D28D9] transition-colors mt-1"
            >
              Publicar no ML
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  /* ── Ad card ──────────────────────────────────────────────── */
  const renderAd = (ad: Ad) => (
    <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-sm overflow-hidden shadow-sm w-full max-w-[400px]">
      <div className="bg-[#7C3AED] px-4 py-3">
        <p className="text-xs font-bold text-white uppercase tracking-wide">Anúncio criado pela IA</p>
      </div>
      <div className="p-4">
        <p className="text-sm font-bold text-[#1a1a2e] mb-2">{ad.titulo}</p>
        <p className="text-xs text-[#6B7280] leading-relaxed mb-4">{ad.descricao}</p>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-[#9CA3AF] mb-0.5">Preço sugerido</p>
            <p className="text-xl font-bold text-[#7C3AED]">{ad.preco}</p>
          </div>
          <button
            onClick={() => send("Publicar no Mercado Livre")}
            className="h-[38px] bg-[#7C3AED] px-4 text-xs font-semibold text-white rounded-xl hover:bg-[#6D28D9] transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Package size={13} /> Publicar no ML
          </button>
        </div>
      </div>
    </div>
  );

  /* ══ Render ════════════════════════════════════════════════ */
  return (
    <div className="flex h-full min-h-0 overflow-hidden" style={{
      background: "linear-gradient(135deg, #f5f0ff 0%, #fce4ec 30%, #f3e5f5 60%, #ede7f6 100%)",
    }}>

      {/* ── Left Panel: Chat History ─────────────────────────── */}
      {showHistory && (
        <div className="hidden md:flex w-[300px] shrink-0 flex-col p-4 overflow-hidden"
          style={{ animation: "fadeSlideIn 0.4s ease both" }}
        >
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setShowHistory(false)} className="text-[#6B7280] hover:text-[#1a1a2e] transition-colors">
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold text-[#1a1a2e] tracking-tight">Chat Results</h2>
            <button onClick={newChat} className="text-[#6B7280] hover:text-[#7C3AED] transition-colors">
              <Plus size={18} />
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/50 backdrop-blur-sm border border-white/40 mb-4">
            <Search size={14} className="text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              className="flex-1 bg-transparent text-xs text-[#1a1a2e] placeholder:text-[#9CA3AF] outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2" style={{ scrollbarWidth: "none" }}>
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">Hoje</p>
            {conversations.length === 0 && (
              <div className="rounded-2xl bg-white/50 backdrop-blur-sm border border-white/30 p-4 text-center">
                <MessageSquare size={20} className="mx-auto text-[#c4b5fd] mb-2" />
                <p className="text-xs text-[#9CA3AF]">Nenhuma conversa ainda</p>
              </div>
            )}
            {conversations.map(c => (
              <button
                key={c.id}
                className="w-full text-left rounded-2xl bg-white/50 backdrop-blur-sm border border-white/30 p-3.5 hover:bg-white/70 transition-all group"
              >
                <p className="text-[13px] font-semibold text-[#1a1a2e] truncate group-hover:text-[#7C3AED] transition-colors">
                  {c.title}
                </p>
                <p className="text-[11px] text-[#9CA3AF] mt-1">{c.date}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Right Panel: Active Chat ─────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 p-3 md:p-4">
        <div className="flex-1 flex flex-col min-h-0 rounded-3xl bg-white/60 backdrop-blur-md border border-white/50 shadow-lg overflow-hidden">

          {/* Header */}
          <div className="flex shrink-0 items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.5)" }}>
            <div className="flex items-center gap-3">
              {!showHistory && (
                <button onClick={() => setShowHistory(true)} className="text-[#9CA3AF] hover:text-[#7C3AED] transition-colors mr-1">
                  <MessageSquare size={18} />
                </button>
              )}
              <span className="text-sm font-bold text-[#1a1a2e] truncate max-w-[300px]">
                {hasStarted ? conversationTitle : "New Chat"}
              </span>
            </div>
            <button onClick={newChat} className="text-[#9CA3AF] hover:text-[#1a1a2e] transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="relative flex-1 min-h-0 overflow-hidden">

            {/* WELCOME SCREEN */}
            <div
              className="absolute inset-0 overflow-y-auto"
              style={{
                transition: "opacity 0.35s ease, transform 0.35s ease",
                opacity: hasStarted ? 0 : 1,
                transform: hasStarted ? "translateY(-16px) scale(0.98)" : "translateY(0) scale(1)",
                pointerEvents: hasStarted ? "none" : "auto",
              }}
            >
              <div className="flex flex-col items-center justify-center min-h-full px-6 py-10">
                <div className="w-full max-w-[520px] flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/80 backdrop-blur-sm border border-white/50 shadow-sm flex items-center justify-center mb-5">
                    <WuilliHex size={32} />
                  </div>

                  <p className="text-[15px] text-[#6B7280] mb-1">Hi, {primeiroNome}!</p>
                  <h1 className="text-[26px] font-bold text-[#1a1a2e] tracking-tight mb-8 text-center">
                    How can I help you?
                  </h1>

                  <div className="w-full mb-5">
                    <InputBar
                      input={input}
                      thinking={thinking}
                      inputRef={inputRef}
                      onChange={setInput}
                      onSend={send}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {suggestions.map(s => (
                      <button
                        key={s.label}
                        onClick={() => send(s.msg)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/50 backdrop-blur-sm border border-white/40 text-[13px] font-medium text-[#1a1a2e] hover:bg-white/80 hover:border-[#c4b5fd] transition-all cursor-pointer shadow-sm"
                      >
                        <span style={{ fontSize: 16 }}>{s.emoji}</span>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* CHAT SCREEN */}
            <div
              className="absolute inset-0 flex flex-col"
              style={{
                transition: "opacity 0.35s ease 0.05s, transform 0.35s ease 0.05s",
                opacity: hasStarted ? 1 : 0,
                transform: hasStarted ? "translateY(0)" : "translateY(16px)",
                pointerEvents: hasStarted ? "auto" : "none",
              }}
            >
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                <div className="max-w-[680px] mx-auto px-4 py-6 space-y-4">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start items-start"}`}
                    >
                      {msg.role === "ai" && (
                        <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-white/80 border border-white/40 flex items-center justify-center shadow-sm">
                          <WuilliHex size={18} />
                        </div>
                      )}

                      {msg.kind === "source-select" && msg.nicho ? (
                        <SourceSelector onConfirm={src => handleSourceConfirm(msg.nicho!, src)} />
                      ) : msg.kind === "searching" && msg.nicho ? (
                        <SearchingCard nicho={msg.nicho} />
                      ) : msg.kind === "products" && msg.products ? (
                        renderProducts(msg.products)
                      ) : msg.kind === "ad" && msg.ad ? (
                        renderAd(msg.ad)
                      ) : (
                        <div
                          className={cn(
                            "max-w-[70%] px-4 py-2.5 text-[13px] leading-relaxed shadow-sm",
                            msg.role === "user"
                              ? "bg-[#7C3AED] text-white"
                              : "bg-white/70 backdrop-blur-sm border border-white/40 text-[#1a1a2e]"
                          )}
                          style={{
                            borderRadius:
                              msg.role === "user"
                                ? "18px 18px 4px 18px"
                                : "18px 18px 18px 4px",
                          }}
                        >
                          {msg.text}
                        </div>
                      )}
                    </div>
                  ))}

                  {thinking && (
                    <div className="flex gap-2.5 justify-start items-start">
                      <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-white/80 border border-white/40 flex items-center justify-center shadow-sm">
                        <WuilliHex size={18} />
                      </div>
                      <div
                        className="bg-white/70 backdrop-blur-sm border border-white/40 px-4 py-3 flex items-center gap-1.5 shadow-sm"
                        style={{ borderRadius: "18px 18px 18px 4px" }}
                      >
                        {[0, 150, 300].map(delay => (
                          <span key={delay} className="w-1.5 h-1.5 rounded-full bg-[#c4b5fd] animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              </div>

              {/* Pinned input */}
              <div className="shrink-0 px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.5)" }}>
                <div className="max-w-[680px] mx-auto">
                  <InputBar
                    input={input}
                    thinking={thinking}
                    inputRef={inputRef}
                    onChange={setInput}
                    onSend={send}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default GitChatPage;
