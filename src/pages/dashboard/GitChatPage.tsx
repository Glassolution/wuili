import { useState, useRef, useEffect } from "react";
import {
  Send, Paperclip, Mic, Sparkles, ShoppingCart, BarChart3,
  Megaphone, ChevronDown, ListChecks, ArrowUpRight, Search,
  MoreHorizontal, Plus, Settings, Package,
} from "lucide-react";
import { useProfile } from "@/lib/profileContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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
  preco?: string; /* legacy */
};
type Ad      = { titulo: string; descricao: string; preco: string; plataforma: string };
type MsgKind = "text" | "products" | "ad";
type Message = { role: "user" | "ai"; text: string; kind: MsgKind; products?: Product[]; ad?: Ad };

/* ══ Wuilli Logo ══════════════════════════════════════════════ */
const WuilliHex = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
    <rect width="30" height="30" rx="8" fill="#7C3AED" />
    <path d="M15 7.5L21 11.25V18.75L15 22.5L9 18.75V11.25L15 7.5Z" fill="white" />
  </svg>
);

/* ══ Edge Function call ═══════════════════════════════════════ */
async function callAI(history: { role: string; content: string }[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke("chat", {
    body: { messages: history },
  });
  if (error) throw new Error(error.message || "Erro ao conectar com a IA");
  return data?.response || data?.choices?.[0]?.message?.content || "Erro ao processar resposta.";
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

/* ══ Fetch real products from AliExpress edge function ════════ */
async function fetchProducts(nicho: string): Promise<Product[]> {
  const { data, error } = await supabase.functions.invoke("aliexpress-products", {
    body: { nicho },
  });
  if (error) throw new Error(error.message || "Erro ao buscar produtos");
  return (data?.products ?? []) as Product[];
}

/* ══ Static data ══════════════════════════════════════════════ */
const savedChats = [
  { id: 1, label: "Análise de Vendas", cls: "bg-sky-500",    l: "A" },
  { id: 2, label: "Catálogo IA",       cls: "bg-orange-500", l: "C" },
  { id: 3, label: "Gestão de Pedidos", cls: "bg-violet-500", l: "G" },
];
const todayChats     = ["Como aumentar minhas vendas no Mercado...", "Qual a melhor estratégia para a Shopee...", "Como otimizar anúncios de eletrônicos..."];
const yesterdayChats = ["Quais produtos têm maior margem de luc...", "Como configurar envio grátis na minha l..."];
const tasks          = ["Analisar produtos em alta no Mercado Livre", "Criar anúncio otimizado para fone TWS", "Responder perguntas de compradores"];
const suggestedPrompt = "Quais são os produtos com melhor margem no meu catálogo que eu deveria priorizar?";
const quickActions = [
  { icon: ShoppingCart, label: "Ver Catálogo", color: "text-[#16A34A]", bg: "bg-[#DCFCE7]", msg: "Mostre meu catálogo de produtos ativos" },
  { icon: ListChecks,   label: "Meus Pedidos", color: "text-[#7C3AED]", bg: "bg-[#EDE9FE]", msg: "Quais são meus pedidos recentes?" },
  { icon: Megaphone,    label: "Publicações",  color: "text-[#EA580C]", bg: "bg-[#FFF7ED]", msg: "Como estão minhas publicações no Mercado Livre?" },
  { icon: BarChart3,    label: "Relatórios",   color: "text-[#0284C7]", bg: "bg-[#E0F2FE]", msg: "Me dê um resumo do meu desempenho de vendas" },
];

/* ══ Component ════════════════════════════════════════════════ */
const GitChatPage = () => {
  const { nome, foto } = useProfile();
  const { user } = useAuth();
  const [profileName, setProfileName] = useState(nome);
  const iniciais    = profileName.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  const primeiroNome = profileName.split(" ")[0] || profileName;
  const hora        = new Date().getHours();
  const saudacao    = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState("");
  const [thinking, setThinking] = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const apiHistory = useRef<{ role: string; content: string }[]>([]);

  // Load profile name from DB
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data?.display_name) setProfileName(data.display_name);
      });
  }, [user]);

  /* Derived */
  const hasStarted = messages.length > 0;

  /* ── Send ────────────────────────────────────────────── */
  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || thinking) return;
    setInput("");

    const userMsg: Message = { role: "user", text: msg, kind: "text" };
    setMessages(prev => [...prev, userMsg]);

    const nextHistory = [...apiHistory.current, { role: "user", content: msg }];
    setThinking(true);

    try {
      const response = await callAI(nextHistory);
      apiHistory.current = [...nextHistory, { role: "assistant", content: response }];
      const parsed = parse(response);

      /* ── Intercept buscar_produtos: fetch real AliExpress data ─ */
      if (parsed._nicho) {
        setMessages(prev => [...prev, {
          role: "ai", text: `🔍 Buscando produtos reais de **${parsed._nicho}** no AliExpress...`, kind: "text",
        }]);
        const products = await fetchProducts(parsed._nicho);
        const context = `Produtos encontrados no AliExpress para "${parsed._nicho}": ${products.map(p => p.nome).join(", ")}`;
        apiHistory.current = [...apiHistory.current, { role: "assistant", content: context }];
        setMessages(prev => [...prev, { role: "ai", text: "", kind: "products", products }]);
        return;
      }

      setMessages(prev => [...prev, { role: "ai", text: response, ...parsed }]);
    } catch (err) {
      console.error("[Wuilli IA] Error:", err);
      setMessages(prev => [...prev, { role: "ai", text: "Erro de conexão. Tente novamente.", kind: "text" }]);
    } finally {
      setThinking(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    }
  };

  /* ── New chat ────────────────────────────────────────── */
  const newChat = () => {
    setMessages([]);
    setInput("");
    setThinking(false);
    apiHistory.current = [];
  };

  /* ── Product cards ───────────────────────────────────── */
  const renderProducts = (products: Product[]) => (
    <div className="flex flex-col gap-3 w-full max-w-[560px]">
      {products.map((p, i) => (
        <div key={i} className="rounded-2xl border border-border bg-background overflow-hidden shadow-sm">
          <div className="flex gap-3 p-3">
            {/* Imagem */}
            {p.imagem ? (
              <img
                src={p.imagem}
                alt={p.nome}
                className="w-20 h-20 shrink-0 rounded-xl object-cover bg-muted"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-20 h-20 shrink-0 rounded-xl bg-muted flex items-center justify-center">
                <Package size={24} className="text-muted-foreground/40" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-1.5">
                {p.nome}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="rounded-full bg-[#7C3AED]/10 px-2 py-0.5 text-[10px] font-bold text-[#7C3AED]">
                  Margem {p.margem}
                </span>
                {p.vendas && p.vendas !== "—" && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    {p.vendas} vendas/mês
                  </span>
                )}
              </div>

              {/* Preços */}
              {p.precoCusto != null && p.precoVenda != null ? (
                <div className="flex items-end gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Custo</p>
                    <p className="text-sm font-bold text-foreground">
                      R$ {p.precoCusto.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Venda sugerida</p>
                    <p className="text-sm font-bold text-[#7C3AED]">
                      R$ {p.precoVenda.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>
              ) : p.preco ? (
                <p className="text-sm font-bold text-foreground">{p.preco}</p>
              ) : null}
            </div>
          </div>

          {/* Action row */}
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            {p.url ? (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Ver no AliExpress <ArrowUpRight size={11} />
              </a>
            ) : <span />}
            <button
              onClick={() => send(`Quero este produto: ${p.nome}. Preço de venda sugerido: R$ ${p.precoVenda?.toFixed(2) ?? p.preco}`)}
              className="rounded-xl bg-[#7C3AED] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6D28D9] transition-colors whitespace-nowrap"
            >
              Quero este produto
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  /* ── Ad card ─────────────────────────────────────────── */
  const renderAd = (ad: Ad) => (
    <div className="rounded-2xl border border-border bg-background overflow-hidden shadow-sm w-full max-w-[560px]">
      <div className="bg-[#7C3AED] px-4 py-3">
        <p className="text-xs font-bold text-white uppercase tracking-wide">✨ Anúncio criado pela IA</p>
      </div>
      <div className="p-4">
        <p className="text-sm font-bold text-foreground mb-2">{ad.titulo}</p>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{ad.descricao}</p>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Preço sugerido</p>
            <p className="text-xl font-bold text-[#7C3AED]">{ad.preco}</p>
          </div>
          <button onClick={() => send("Publicar no Mercado Livre")} className="rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6D28D9] transition-colors flex items-center gap-1.5 whitespace-nowrap">
            <Package size={13} /> Publicar no ML
          </button>
        </div>
      </div>
    </div>
  );

  /* ── Input bar ───────────────────────────────────────── */
  const InputBar = () => (
    <div className="border border-border rounded-2xl bg-background p-4 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={15} className="text-muted-foreground/40 shrink-0" />
        <input
          type="text"
          placeholder={thinking ? "Wuilli está pensando..." : "Como posso ajudar você hoje?"}
          value={input}
          disabled={thinking}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !thinking && send()}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none disabled:cursor-not-allowed"
        />
      </div>
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors">
          Selecionar fonte <ChevronDown size={12} />
        </button>
        <div className="flex items-center gap-1.5">
          <button className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg px-3 py-1.5 transition-colors">
            <Paperclip size={14} /> Anexar
          </button>
          <button className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg px-3 py-1.5 transition-colors">
            <Mic size={14} /> Voz
          </button>
          <button onClick={() => send()} disabled={thinking || !input.trim()} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#7C3AED] rounded-lg px-4 py-1.5 hover:bg-[#6D28D9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Send size={13} /> Enviar
          </button>
        </div>
      </div>
    </div>
  );

  /* ══ Render ══════════════════════════════════════════════ */
  return (
    <div className="flex overflow-hidden" style={{ height: "100vh" }}>

      {/* ── Sidebar 260px ──────────────────────────────── */}
      <aside className="hidden md:flex w-[260px] shrink-0 border-r border-border bg-[#F8FAFC] flex-col">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <span className="flex-1 text-sm font-semibold text-foreground">Chat</span>
          <button className="text-muted-foreground hover:text-foreground transition-colors"><Search size={15} /></button>
        </div>
        <div className="px-4 mb-4">
          <button onClick={newChat} className="flex w-full items-center gap-2 rounded-xl bg-foreground px-3 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-opacity">
            <Plus size={14} /><span className="flex-1 text-left">New Chat</span><Sparkles size={13} className="opacity-60" />
          </button>
        </div>
        <div className="px-4 mb-3">
          <p className="px-1 pb-2 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Saved</p>
          <div className="space-y-0.5">
            {savedChats.map(c => (
              <div key={c.id} className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted cursor-pointer transition-colors">
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${c.cls} text-white text-[9px] font-bold`}>{c.l}</div>
                <span className="flex-1 text-xs text-foreground truncate">{c.label}</span>
                <MoreHorizontal size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 mb-3">
          <div className="flex items-center justify-between px-1 pb-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Today</p>
            <ChevronDown size={12} className="text-muted-foreground/40" />
          </div>
          <div className="space-y-0.5">
            {todayChats.map((c, i) => <div key={i} className="rounded-lg px-2 py-1.5 hover:bg-muted cursor-pointer transition-colors"><p className="text-xs text-muted-foreground truncate">{c}</p></div>)}
          </div>
        </div>
        <div className="px-4 mb-3">
          <div className="flex items-center justify-between px-1 pb-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Yesterday</p>
            <ChevronDown size={12} className="text-muted-foreground/40" />
          </div>
          <div className="space-y-0.5">
            {yesterdayChats.map((c, i) => <div key={i} className="rounded-lg px-2 py-1.5 hover:bg-muted cursor-pointer transition-colors"><p className="text-xs text-muted-foreground truncate">{c}</p></div>)}
          </div>
        </div>
        <div className="flex-1" />
        <div className="border-t border-border px-4 py-3">
          <button className="flex w-full items-center justify-center rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
            Upgrade to Pro
          </button>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 bg-background">

        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Wuilli IA</span>
            <span className="rounded-full bg-[#7C3AED]/10 px-2 py-0.5 text-[10px] font-bold text-[#7C3AED] uppercase tracking-wide">Pro</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
              <Settings size={12} /> Configuração
            </button>
            <button className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
              Compartilhar
            </button>
            <button onClick={newChat} className="flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 transition-opacity">
              <Plus size={12} /> Novo Chat <Sparkles size={11} className="opacity-60" />
            </button>
          </div>
        </div>

        {/* ── Content area ───────────────────────────── */}
        <div className="relative flex-1 min-h-0 overflow-hidden">

          {/* ══ WELCOME SCREEN (messages.length === 0) ══ */}
          <div
            className="absolute inset-0 overflow-y-auto"
            style={{
              transition: "opacity 0.4s ease, transform 0.4s ease",
              opacity:    hasStarted ? 0 : 1,
              transform:  hasStarted ? "translateY(-20px) scale(0.98)" : "translateY(0) scale(1)",
              pointerEvents: hasStarted ? "none" : "auto",
            }}
          >
            <div className="flex flex-col items-center justify-center min-h-full px-6 py-10">
              <div className="w-full max-w-[720px] flex flex-col items-center">

                {/* Logo */}
                <div className="mb-6">
                  <WuilliHex size={52} />
                </div>

                {/* Greeting */}
                <h1 className="font-['Sora'] text-3xl font-bold text-foreground tracking-[-0.03em] mb-2 text-center">
                  {saudacao}, {primeiroNome} 👋
                </h1>
                <p className="text-sm text-muted-foreground mb-8 text-center">
                  Diga o que você precisa, e a IA cuida do resto.
                </p>

                {/* Big input */}
                <div className="w-full mb-4">
                  <InputBar />
                </div>

                {/* Quick action chips */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
                  {quickActions.map(({ icon: Icon, label, color, bg, msg }) => (
                    <button key={label} onClick={() => send(msg)} className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-all">
                      <div className={`w-6 h-6 rounded-lg ${bg} flex items-center justify-center`}><Icon size={13} className={color} /></div>
                      {label}
                    </button>
                  ))}
                </div>


              </div>
            </div>
          </div>

          {/* ══ CHAT SCREEN (messages.length > 0) ══ */}
          <div
            className="absolute inset-0 flex flex-col"
            style={{
              transition: "opacity 0.4s ease 0.1s, transform 0.4s ease 0.1s",
              opacity:    hasStarted ? 1 : 0,
              transform:  hasStarted ? "translateY(0)" : "translateY(20px)",
              pointerEvents: hasStarted ? "auto" : "none",
            }}
          >
            {/* Messages — scrollable, centered at 720px */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              <div className="max-w-[720px] mx-auto px-4 py-6 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "ai" && (
                      <div className="shrink-0 mr-2 mt-0.5">
                        <WuilliHex size={26} />
                      </div>
                    )}
                    {msg.kind === "products" && msg.products
                      ? renderProducts(msg.products)
                      : msg.kind === "ad" && msg.ad
                      ? renderAd(msg.ad)
                      : (
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}>
                          {msg.text}
                        </div>
                      )
                    }
                  </div>
                ))}

                {/* 3 dots typing indicator */}
                {thinking && (
                  <div className="flex justify-start items-start gap-2">
                    <div className="shrink-0 mt-0.5">
                      <WuilliHex size={26} />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input — fixed at bottom, centered at 720px */}
            <div className="shrink-0 pb-4 px-4">
              <div className="max-w-[720px] mx-auto">
                <InputBar />
                <p className="text-center text-[10px] text-muted-foreground/40 mt-2">
                  Wuilli pode exibir informações imprecisas, por favor verifique as respostas.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default GitChatPage;
