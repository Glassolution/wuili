import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Send,
  Paperclip,
  Mic,
  Sparkles,
  ShoppingCart,
  BarChart3,
  Megaphone,
  ChevronDown,
  ListChecks,
  ArrowUpRight,
  ShoppingBag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ─── TYPES ─── */
interface Product {
  nome: string;
  preco: string;
  margem: string;
  vendas: string;
  score: "Alta" | "Média";
}

interface AdPreview {
  titulo: string;
  descricao: string;
  preco: string;
  plataforma: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  products?: Product[];
  adPreview?: AdPreview;
}

/* ─── CONSTS ─── */
const tasks = [
  "Analisar produtos em alta no Mercado Livre",
  "Criar anúncio otimizado para fone TWS",
  "Responder perguntas de compradores",
];

const suggestedPrompt = "Quais são os produtos com melhor margem no meu catálogo que eu deveria priorizar?";

const quickActions = [
  { icon: ShoppingCart, label: "Ver Catálogo", color: "text-[#16A34A]", bg: "bg-[#DCFCE7]", to: "/dashboard/catalogo" },
  { icon: ListChecks, label: "Meus Pedidos", color: "text-[#7C3AED]", bg: "bg-[#EDE9FE]", to: "/dashboard/pedidos" },
  { icon: Megaphone, label: "Publicações", color: "text-[#EA580C]", bg: "bg-[#FFF7ED]", to: "/dashboard/publicacoes" },
  { icon: BarChart3, label: "Relatórios", color: "text-[#0284C7]", bg: "bg-[#E0F2FE]", to: "/dashboard/relatorios" },
];

/* ─── HELPERS ─── */
const useTypewriter = (text: string, speed = 40, delay = 0) => {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (displayed.length >= text.length) { setDone(true); return; }
    const t = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 1)), speed);
    return () => clearTimeout(t);
  }, [displayed, started, text, speed]);

  return { displayed, done };
};

const Reveal = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => (
  <div className={`opacity-0 ${className}`} style={{ animation: `dashReveal 1.2s cubic-bezier(0.16,1,0.3,1) ${delay}ms both` }}>
    {children}
  </div>
);

function tryParseJSON(text: string): { products?: Product[]; adPreview?: AdPreview; cleanText: string } {
  const jsonRegex = /\{[\s\S]*?\}/g;
  let products: Product[] | undefined;
  let adPreview: AdPreview | undefined;
  let cleanText = text;

  const matches = text.match(jsonRegex);
  if (matches) {
    for (const match of matches) {
      try {
        const parsed = JSON.parse(match);
        if (parsed.tipo === "produtos" && Array.isArray(parsed.lista)) {
          products = parsed.lista;
          cleanText = cleanText.replace(match, "").trim();
        } else if (parsed.tipo === "anuncio" && parsed.titulo) {
          adPreview = parsed;
          cleanText = cleanText.replace(match, "").trim();
        }
      } catch {
        // not valid JSON, ignore
      }
    }
  }

  return { products, adPreview, cleanText };
}

/* ─── PRODUCT CARD ─── */
const ProductCard = ({ p }: { p: Product }) => (
  <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-bold tracking-wide text-foreground">
      {p.nome.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold truncate">{p.nome}</p>
      <p className="text-xs text-muted-foreground">Margem {p.margem} · {p.vendas} vendas</p>
      <p className="text-xs text-primary font-semibold mt-0.5">R$ {p.preco} · Score {p.score}</p>
    </div>
    <div className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold bg-primary text-primary-foreground">
      <ShoppingBag size={11} />
      Adicionar
    </div>
  </div>
);

/* ─── AD PREVIEW ─── */
const AdCard = ({ ad }: { ad: AdPreview }) => (
  <div className="rounded-xl border border-border bg-background p-4 space-y-2">
    <div className="flex items-center gap-2">
      <Megaphone size={14} className="text-primary" />
      <span className="text-xs font-semibold text-primary">{ad.plataforma}</span>
    </div>
    <h4 className="text-sm font-bold text-foreground">{ad.titulo}</h4>
    <p className="text-xs text-muted-foreground leading-relaxed">{ad.descricao}</p>
    <p className="text-sm font-bold text-primary">R$ {ad.preco}</p>
  </div>
);

/* ─── MAIN COMPONENT ─── */
const GitChatPage = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { displayed: title, done: titleDone } = useTypewriter("Olá, bem-vindo 👋", 65, 800);
  const { displayed: subtitle, done: subtitleDone } = useTypewriter("Diga o que você precisa, e a IA cuida do resto.", 35, 2200);

  useEffect(() => {
    if (chatStarted) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [messages, chatStarted]);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? message).trim();
    if (!msg || loading) return;
    setMessage("");
    setChatStarted(true);

    const userMsg: ChatMessage = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const history = newMessages.map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { messages: history },
      });

      if (error) throw error;

      const aiText = data?.response || "Desculpe, não consegui processar.";
      const { products, adPreview, cleanText } = tryParseJSON(aiText);

      setMessages(prev => [
        ...prev,
        { role: "assistant", content: cleanText, products, adPreview },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Ops, ocorreu um erro. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /* ─── WELCOME SCREEN ─── */
  if (!chatStarted) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        <style>{`
          @keyframes dashReveal {
            from { opacity: 0; transform: translateY(36px) scale(0.96); filter: blur(8px); }
            to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
          }
        `}</style>

        <div className="flex flex-col items-center justify-center px-4 pb-6">
          <div className="flex-1 flex flex-col items-center justify-center w-full py-8">
            <Reveal delay={300}>
              <div className="relative mb-5 w-16 h-16">
                <div className="absolute inset-0 w-16 h-16 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#a78bfa] opacity-95" />
              </div>
            </Reveal>

            <Reveal delay={600} className="text-center">
              <h1 className="font-['Sora'] text-2xl font-bold text-foreground tracking-[-0.02em] mb-1 min-h-[2rem]">
                {title}
                {!titleDone && <span className="inline-block w-[2px] h-5 bg-[#7C3AED] ml-0.5 align-middle animate-pulse" />}
              </h1>
            </Reveal>

            <Reveal delay={1000} className="text-center">
              <p className="text-sm text-muted-foreground mb-10 min-h-[1.25rem]">
                {subtitle}
                {!subtitleDone && subtitle.length > 0 && <span className="inline-block w-[2px] h-4 bg-muted-foreground/40 ml-0.5 align-middle animate-pulse" />}
              </p>
            </Reveal>

            <Reveal delay={3800} className="w-full flex justify-center">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-8 max-w-[680px]">
                <div className="bg-[#1A1A2E] text-white rounded-2xl p-4 flex flex-col justify-between min-h-[140px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-[#16A34A] flex items-center justify-center text-[9px] font-bold">S</div>
                    <span className="text-xs font-medium">Sam AI</span>
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#7C3AED] text-white ml-auto">Sales Assistant</span>
                  </div>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Projetado para ajudar a gerenciar vendas e maximizar o engajamento dos clientes.
                  </p>
                </div>

                <div className="bg-background border border-border rounded-2xl p-4 flex flex-col min-h-[140px]">
                  <ul className="space-y-2 flex-1">
                    {tasks.map((task, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground leading-snug">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                        {task}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                    <span className="text-[10px] text-muted-foreground/60">Tarefas</span>
                    <span className="text-[10px] text-[#7C3AED] font-medium cursor-pointer hover:underline">Ver Tudo</span>
                  </div>
                </div>

                <div
                  className="bg-background border border-border rounded-2xl p-4 flex flex-col justify-between min-h-[140px] cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => sendMessage(suggestedPrompt)}
                >
                  <p className="text-[12px] text-foreground leading-snug font-medium">{suggestedPrompt}</p>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                    <span className="text-[10px] text-muted-foreground/60">Sugestão</span>
                    <button className="text-muted-foreground/40 hover:text-foreground transition-colors">
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={4400} className="w-full flex justify-center">
              <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
                {quickActions.map(({ icon: Icon, label, color, bg, to }) => (
                  <Link key={label} to={to} className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-all">
                    <div className={`w-6 h-6 rounded-lg ${bg} flex items-center justify-center`}>
                      <Icon size={13} className={color} />
                    </div>
                    {label}
                  </Link>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal delay={5000} className="w-full flex justify-center">
            <div className="w-full max-w-[680px]">
              <div className="border border-border rounded-2xl bg-background p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={15} className="text-muted-foreground/50" />
                  <input
                    type="text"
                    placeholder="Pergunte qualquer coisa..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors">
                    Selecionar fonte <ChevronDown size={12} />
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg px-3 py-1.5 transition-colors">
                      <Paperclip size={14} /> Anexar
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg px-3 py-1.5 transition-colors">
                      <Mic size={14} /> Voz
                    </button>
                    <button
                      onClick={() => sendMessage()}
                      className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#7C3AED] rounded-lg px-4 py-1.5 hover:bg-[#6D28D9] transition-colors"
                    >
                      <Send size={13} /> Enviar
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-center text-[10px] text-muted-foreground/50 mt-3">
                Wuilli pode exibir informações imprecisas, por favor verifique as respostas.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    );
  }

  /* ─── CHAT VIEW ─── */
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      <style>{`
        @keyframes dashReveal {
          from { opacity: 0; transform: translateY(36px) scale(0.96); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
      `}</style>

      <div className="flex-1 overflow-y-auto py-4 space-y-4 px-4" style={{ scrollbarWidth: "none" }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted text-foreground rounded-bl-sm"
            }`}>
              {msg.content}
            </div>

            {msg.products && msg.products.length > 0 && (
              <div className="w-full max-w-lg space-y-2">
                {msg.products.map((p, j) => (
                  <ProductCard key={j} p={p} />
                ))}
              </div>
            )}

            {msg.adPreview && <AdCard ad={msg.adPreview} />}
          </div>
        ))}

        {loading && (
          <div className="flex items-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-muted-foreground animate-pulse">
              Pensando...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* input bar */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="border border-border rounded-2xl bg-background p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} className="text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Pergunte qualquer coisa..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors">
              Selecionar fonte <ChevronDown size={12} />
            </button>
            <div className="flex items-center gap-1.5">
              <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg px-3 py-1.5 transition-colors">
                <Paperclip size={14} /> Anexar
              </button>
              <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg px-3 py-1.5 transition-colors">
                <Mic size={14} /> Voz
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#7C3AED] rounded-lg px-4 py-1.5 hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
              >
                <Send size={13} /> Enviar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GitChatPage;
