import { useState, useRef, useEffect, memo } from "react";
import {
  ArrowUp, Plus, Package, ArrowUpRight, X,
  Sparkles, PanelLeft, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/profileContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SourceSelector, type ProductSource } from "@/components/chat/SourceSelector";

type Product = {
  nome: string;
  imagem?: string;
  url?: string;
  precoCusto?: number;
  precoVenda?: number;
  margem: string;
  vendas?: string;
  condicao?: string;
  vendedor?: string;
  preco?: string;
};
type Ad = { titulo: string; descricao: string; preco: string; plataforma: string };
type MsgKind = "text" | "products" | "ad" | "searching" | "source-select";
type Message = {
  role: "user" | "ai";
  text: string;
  kind: MsgKind;
  products?: Product[];
  ad?: Ad;
  nicho?: string;
};

const chatHistory = [
  { id: "1", title: "Eletronicos com margem", preview: "Encontrei 8 produtos...", date: "hoje", active: true },
  { id: "2", title: "Produtos de moda", preview: "Moda feminina tem boa...", date: "hoje", active: false },
  { id: "3", title: "Beleza e skincare", preview: "Cosmeticos importados...", date: "ontem", active: false },
  { id: "4", title: "Como diminuir CAC?", preview: "O custo de aquisicao...", date: "ontem", active: false },
  { id: "5", title: "Como aumentar LTV?", preview: "O lifetime value pode...", date: "ontem", active: false },
];

async function callAI(history: { role: string; content: string }[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke("chat", { body: { messages: history } });
  if (error) throw new Error(error.message || "Erro ao conectar com a IA");
  return data?.response || data?.choices?.[0]?.message?.content || "Erro ao processar resposta.";
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

async function fetchAliExpress(nicho: string): Promise<Product[]> {
  const { data, error } = await supabase.functions.invoke("aliexpress-products", { body: { nicho } });
  if (error) throw new Error(error.message || "Erro ao buscar produtos");
  return (data?.products ?? []) as Product[];
}

function parse(text: string): Pick<Message, "kind" | "products" | "ad"> & { _nicho?: string } {
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const p = JSON.parse(m[0]);
      if (p.tipo === "buscar_produtos" && p.nicho) return { kind: "text", _nicho: p.nicho };
      if (p.tipo === "produtos" && Array.isArray(p.lista)) return { kind: "products", products: p.lista };
      if (p.tipo === "anuncio") return { kind: "ad", ad: p };
    } catch { /**/ }
  }
  return { kind: "text" };
}

async function fetchProducts(nicho: string, source: ProductSource): Promise<Product[]> {
  return source === "mercadolivre" ? fetchMercadoLivre(nicho) : fetchAliExpress(nicho);
}

const SearchingCard = ({ nicho }: { nicho: string }) => (
  <div className="flex items-center gap-4 rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4 w-full max-w-[340px] shadow-sm">
    <div className="flex items-end gap-[3px] shrink-0 h-5">
      {[0, 1, 2, 3].map(i => (
        <span key={i} className="w-[3px] rounded-full bg-violet-400"
          style={{ animation: "searchBar 1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-gray-800 leading-snug">Buscando produtos</p>
      <p className="text-xs text-gray-400 mt-0.5 truncate">
        Nicho: <span className="font-medium text-violet-600 capitalize">{nicho}</span>
      </p>
    </div>
    <style>{`@keyframes searchBar { 0%,100%{height:6px;opacity:.4} 50%{height:20px;opacity:1} }`}</style>
  </div>
);

interface ChatInputProps {
  input: string;
  thinking: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
  onChange: (val: string) => void;
  onSend: () => void;
}

const ChatInput = memo(({ input, thinking, inputRef, onChange, onSend }: ChatInputProps) => (
  <div className="group relative flex items-center gap-3 overflow-hidden rounded-[26px] border border-white/60 bg-white/58 px-4 py-3 backdrop-blur-xl shadow-[0_24px_70px_rgba(111,118,138,0.12)] transition-all duration-300 before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(135deg,rgba(255,255,255,0.5),transparent_45%,rgba(124,58,237,0.06)_100%)] before:opacity-80 focus-within:border-[#7C3AED]/30 focus-within:bg-white/72 focus-within:shadow-[0_28px_90px_rgba(111,118,138,0.16)]">
    <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-white/80" />
    <input
      ref={inputRef}
      type="text"
      placeholder={thinking ? "Velo esta pensando..." : "Ask me anything..."}
      value={input}
      disabled={thinking}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => e.key === "Enter" && !thinking && onSend()}
      className="relative z-[1] flex-1 bg-transparent text-sm font-medium text-[#171821] outline-none placeholder:text-[#7C8195] disabled:cursor-not-allowed"
    />
    <button
      onClick={onSend}
      disabled={thinking || !input.trim()}
      className="relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#171821] text-white shadow-[0_12px_24px_rgba(23,24,33,0.22)] transition-all duration-300 hover:translate-y-[-1px] hover:bg-[#222432] disabled:opacity-40"
    >
      <ArrowUp size={15} strokeWidth={2.5} />
    </button>
  </div>
));
ChatInput.displayName = "ChatInput";

const AIChatPage = () => {
  const { nome } = useProfile();
  const { user } = useAuth();
  const [profileName, setProfileName] = useState(nome);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => localStorage.getItem("ai-chat-sidebar") !== "false"
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const apiHistory = useRef<{ role: string; content: string }[]>([]);

  useEffect(() => {
    localStorage.setItem("ai-chat-sidebar", String(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).single()
      .then(({ data }) => { if (data?.display_name) setProfileName(data.display_name); });
  }, [user]);

  useEffect(() => { if (nome) setProfileName(nome); }, [nome]);

  const scroll = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }, 60);
  };

  const hasStarted = messages.length > 0;

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
        setMessages(prev => [...prev, { role: "ai", text: "", kind: "source-select", nicho: parsed._nicho }]);
        return;
      }
      setMessages(prev => [...prev, { role: "ai", text: response, ...parsed }]);
    } catch (err) {
      console.error("[AI Chat]", err);
      setMessages(prev => [...prev, { role: "ai", text: "Erro de conexao. Tente novamente.", kind: "text" }]);
    } finally {
      setThinking(false);
      scroll();
    }
  };

  const newChat = () => {
    setMessages([]);
    setInput("");
    setThinking(false);
    apiHistory.current = [];
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleSourceConfirm = async (nicho: string, source: ProductSource) => {
    setMessages(prev => {
      const without = prev.filter(m => m.kind !== "source-select");
      return [...without, { role: "ai", text: "", kind: "searching", nicho }];
    });
    let products: Product[] = [];
    let fetchError = false;
    try { products = await fetchProducts(nicho, source); } catch { fetchError = true; }
    const sourceLabel = source === "mercadolivre" ? "Mercado Livre" : "AliExpress";
    if (fetchError || products.length === 0) {
      const errMsg = "Nao encontrei produtos para esse nicho agora. Tente outro nicho.";
      apiHistory.current = [...apiHistory.current, { role: "assistant", content: errMsg }];
      setMessages(prev => { const w = prev.filter(m => m.kind !== "searching"); return [...w, { role: "ai", text: errMsg, kind: "text" }]; });
    } else {
      const ctx = `Produtos encontrados no ${sourceLabel} para "${nicho}": ${products.map(p => p.nome).join(", ")}`;
      apiHistory.current = [...apiHistory.current, { role: "assistant", content: ctx }];
      setMessages(prev => { const w = prev.filter(m => m.kind !== "searching"); return [...w, { role: "ai", text: "", kind: "products", products }]; });
    }
    scroll();
  };

  const renderProducts = (products: Product[]) => (
    <div className="grid grid-cols-2 gap-3 w-full max-w-[560px]">
      {products.map((p, i) => (
        <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm flex flex-col">
          <div className="h-[140px] bg-gray-50 overflow-hidden">
            {p.imagem
              ? <img src={p.imagem} alt={p.nome} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              : <div className="w-full h-full flex items-center justify-center"><Package size={28} className="text-gray-300" /></div>
            }
          </div>
          <div className="p-3.5 flex flex-col flex-1 gap-1.5">
            <p className="text-[13px] font-semibold text-gray-800 line-clamp-2 leading-snug">{p.nome}</p>
            {p.margem && <span className="self-start rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-600">Margem {p.margem}</span>}
            <div className="flex-1" />
            {p.precoVenda != null
              ? <p className="text-base font-bold text-violet-600">R$ {p.precoVenda.toFixed(2).replace(".", ",")}</p>
              : p.preco ? <p className="text-base font-bold text-violet-600">{p.preco}</p> : null
            }
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-violet-600 transition-colors">
                Ver produto <ArrowUpRight size={10} />
              </a>
            )}
            <button
              onClick={() => send(`Quero publicar este produto: ${p.nome}`)}
              className="w-full h-[38px] bg-gradient-to-br from-violet-600 to-purple-700 text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity mt-1"
            >
              Publicar no ML
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderAd = (ad: Ad) => (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm w-full max-w-[400px]">
      <div className="bg-gradient-to-br from-violet-600 to-purple-700 px-4 py-3">
        <p className="text-xs font-bold text-white uppercase tracking-wide">Anuncio criado pela IA</p>
      </div>
      <div className="p-4">
        <p className="text-sm font-bold text-gray-800 mb-2">{ad.titulo}</p>
        <p className="text-xs text-gray-500 leading-relaxed mb-4">{ad.descricao}</p>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-gray-400 mb-0.5">Preco sugerido</p>
            <p className="text-xl font-bold text-violet-600">{ad.preco}</p>
          </div>
          <button
            onClick={() => send("Publicar no Mercado Livre")}
            className="h-[38px] bg-gradient-to-br from-violet-600 to-purple-700 px-4 text-xs font-semibold text-white rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5 whitespace-nowrap"
          >
            <Package size={13} /> Publicar no ML
          </button>
        </div>
      </div>
    </div>
  );

  const todayChats = chatHistory.filter(c => c.date === "hoje");
  const yesterdayChats = chatHistory.filter(c => c.date === "ontem");

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-row overflow-hidden rounded-2xl border border-gray-100 shadow-sm bg-[#F4F4F8]">

      {/* LEFT PANEL */}
      <div className={cn(
        "hidden md:flex flex-col overflow-hidden transition-all duration-300 ease-in-out bg-[#F4F4F8] shrink-0",
        sidebarOpen ? "w-[300px] min-w-[300px]" : "w-0 min-w-0"
      )}>
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-xl font-semibold text-gray-800 flex-1">Chat Results</h2>
        </div>
        <button onClick={newChat} className="mx-4 mb-4 w-[calc(100%-2rem)] flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-500 hover:bg-white transition-all">
          <Plus size={15} /> Novo Chat
        </button>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {todayChats.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 mb-2">Hoje</p>
              {todayChats.map(c => (
                <div key={c.id} className={cn("mx-3 mb-1 rounded-2xl px-4 py-3 cursor-pointer hover:bg-white/80 transition-all group flex items-center gap-3", c.active && "bg-white shadow-sm")}>
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <Sparkles size={14} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.title}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{c.preview}</p>
                  </div>
                  <ArrowUpRight size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              ))}
            </div>
          )}
          {yesterdayChats.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 mb-2">Ontem</p>
              {yesterdayChats.map(c => (
                <div key={c.id} className={cn("mx-3 mb-1 rounded-2xl px-4 py-3 cursor-pointer hover:bg-white/80 transition-all group flex items-center gap-3", c.active && "bg-white shadow-sm")}>
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <Sparkles size={14} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.title}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{c.preview}</p>
                  </div>
                  <ArrowUpRight size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-all">
                <PanelLeft size={16} />
              </button>
            )}
          </div>
          <p className="text-base font-semibold text-gray-800">Novo Chat</p>
          <button onClick={newChat} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6" style={{ scrollbarWidth: "none" }}>
          <div className="w-full max-w-[800px] mx-auto px-6 space-y-6">

            {!hasStarted && (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg">
                  <Sparkles size={24} className="text-white" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Ola! Como posso te ajudar?</h2>
                <p className="text-sm text-gray-400 max-w-xs">
                  Sou especialista em dropshipping. Posso te ajudar a encontrar produtos, criar anuncios e publicar no Mercado Livre.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start items-start")}>
                {msg.role === "ai" && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={14} className="text-white" />
                  </div>
                )}
                {msg.kind === "source-select" && msg.nicho
                  ? <SourceSelector onConfirm={src => handleSourceConfirm(msg.nicho!, src)} />
                  : msg.kind === "searching" && msg.nicho
                  ? <SearchingCard nicho={msg.nicho} />
                  : msg.kind === "products" && msg.products
                  ? renderProducts(msg.products)
                  : msg.kind === "ad" && msg.ad
                  ? renderAd(msg.ad)
                  : (
                    <div className={cn(
                      "px-4 py-3 text-sm leading-relaxed max-w-[75%]",
                      msg.role === "user"
                        ? "bg-gradient-to-br from-violet-600 to-purple-700 text-white rounded-2xl rounded-tr-sm"
                        : "bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm text-gray-700"
                    )}>
                      {msg.text}
                    </div>
                  )
                }
              </div>
            ))}

            {thinking && (
              <div className="flex gap-3 justify-start items-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  {[0, 150, 300].map(delay => (
                    <span key={delay} className="w-1.5 h-1.5 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="py-4 border-t border-gray-100">
          <div className="w-full max-w-[800px] mx-auto px-6">
            <ChatInput input={input} thinking={thinking} inputRef={inputRef} onChange={setInput} onSend={send} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatPage;
