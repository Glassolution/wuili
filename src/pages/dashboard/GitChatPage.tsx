import { useState, useRef, useEffect } from "react";
import { ArrowUp, Plus, Package, ArrowUpRight } from "lucide-react";
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

/* ══ Wuilli hex icon ══════════════════════════════════════════ */
const WuilliHex = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}>
    <rect width="30" height="30" rx="8" fill="#7C3AED" />
    <path d="M15 7.5L21 11.25V18.75L15 22.5L9 18.75V11.25L15 7.5Z" fill="white" />
  </svg>
);

/* ══ Searching card ═══════════════════════════════════════════ */
const SearchingCard = ({ nicho }: { nicho: string }) => (
  <div className="flex items-center gap-4 rounded-2xl border border-[#7C3AED]/15 bg-[#7C3AED]/5 px-5 py-4 w-full max-w-[340px]">
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
      <p className="text-sm font-semibold text-[#0A0A0A] leading-snug">Buscando produtos</p>
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
  const { data, error } = await supabase.functions.invoke("ml-search", {
    body: { nicho },
  });
  if (error) throw new Error(error.message || "Erro ao buscar no Mercado Livre");
  if (data?.error) throw new Error(data.error);
  // Normalize ML response shape → Product shape
  // Edge Function returns: { link, preco_custo: "R$ 89.90", preco_venda: "R$ 143.84" }
  const parsePrice = (s?: string) =>
    s ? parseFloat(s.replace("R$", "").trim().replace(",", ".")) : undefined;
  return ((data?.products ?? []) as Record<string, unknown>[]).map((p) => ({
    nome:       String(p.nome ?? ""),
    imagem:     p.imagem as string | undefined,
    url:        (p.link ?? p.url) as string | undefined,
    margem:     String(p.margem ?? ""),
    condicao:   p.condicao as string | undefined,
    vendedor:   p.vendedor as string | undefined,
    vendas:     p.vendas as string | undefined,
    precoCusto: p.precoCusto != null
      ? Number(p.precoCusto)
      : parsePrice(p.preco_custo as string),
    precoVenda: p.precoVenda != null
      ? Number(p.precoVenda)
      : parsePrice(p.preco_venda as string),
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

/* ══ Suggestion cards ═════════════════════════════════════════ */
const suggestions = [
  { emoji: "🔥", label: "Produtos em alta", msg: "Quais produtos estão em alta agora?" },
  { emoji: "💰", label: "Alta margem",       msg: "Quais produtos têm maior margem de lucro?" },
  { emoji: "🚀", label: "Fácil de vender",  msg: "Quais produtos são mais fáceis para iniciantes venderem?" },
];

/* ══ InputBar — outside parent to preserve focus ═════════════ */
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
        "flex items-center gap-3 px-4 rounded-2xl border bg-white transition-all min-h-[56px]",
        focused
          ? "border-[#7C3AED] shadow-[0_0_0_3px_rgba(124,58,237,0.08)]"
          : "border-[#E5E7EB]"
      )}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder={thinking ? "Wuilli está pensando..." : "Descreva o que você quer vender..."}
        value={input}
        disabled={thinking}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && !thinking && onSend()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="flex-1 bg-transparent text-sm text-[#0A0A0A] placeholder:text-[#9CA3AF] outline-none disabled:cursor-not-allowed"
      />
      <button
        onClick={onSend}
        disabled={thinking || !input.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ArrowUp size={17} strokeWidth={2.5} />
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
          className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden shadow-sm flex flex-col"
        >
          {/* Image */}
          <div className="h-[160px] bg-[#F9FAFB] overflow-hidden">
            {p.imagem ? (
              <img
                src={p.imagem}
                alt={p.nome}
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package size={28} className="text-[#D1D5DB]" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4 flex flex-col flex-1 gap-2">
            <p className="text-sm font-semibold text-[#0A0A0A] line-clamp-2 leading-snug">
              {p.nome}
            </p>

            <div className="flex flex-wrap gap-1">
              <span className="rounded-full bg-[#7C3AED]/10 px-2 py-0.5 text-[10px] font-bold text-[#7C3AED]">
                Margem {p.margem}
              </span>
              {p.condicao && (
                <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium text-[#6B7280]">
                  {p.condicao}
                </span>
              )}
            </div>

            <div className="flex-1" />

            {p.precoVenda != null ? (
              <p className="text-lg font-bold text-[#7C3AED]">
                R$ {p.precoVenda.toFixed(2).replace(".", ",")}
              </p>
            ) : p.precoCusto != null ? (
              <p className="text-lg font-bold text-[#7C3AED]">
                R$ {p.precoCusto.toFixed(2).replace(".", ",")}
              </p>
            ) : p.preco ? (
              <p className="text-lg font-bold text-[#7C3AED]">{p.preco}</p>
            ) : null}

            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-[#9CA3AF] hover:text-[#7C3AED] transition-colors"
              >
                Ver produto <ArrowUpRight size={10} />
              </a>
            )}

            <button
              onClick={() =>
                send(
                  `Quero publicar este produto: ${p.nome}. Preço sugerido: R$ ${
                    p.precoVenda?.toFixed(2) ?? p.preco
                  }`
                )
              }
              className="w-full h-[44px] bg-[#7C3AED] text-white text-sm font-semibold rounded-[10px] hover:bg-[#6D28D9] transition-colors mt-1"
            >
              Publicar
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  /* ── Ad card ──────────────────────────────────────────────── */
  const renderAd = (ad: Ad) => (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden shadow-sm w-full max-w-[400px]">
      <div className="bg-[#7C3AED] px-4 py-3">
        <p className="text-xs font-bold text-white uppercase tracking-wide">
          Anúncio criado pela IA
        </p>
      </div>
      <div className="p-4">
        <p className="text-sm font-bold text-[#0A0A0A] mb-2">{ad.titulo}</p>
        <p className="text-xs text-[#6B7280] leading-relaxed mb-4">{ad.descricao}</p>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-[#9CA3AF] mb-0.5">Preço sugerido</p>
            <p className="text-xl font-bold text-[#7C3AED]">{ad.preco}</p>
          </div>
          <button
            onClick={() => send("Publicar no Mercado Livre")}
            className="h-[44px] bg-[#7C3AED] px-4 text-xs font-semibold text-white rounded-[10px] hover:bg-[#6D28D9] transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Package size={13} /> Publicar no ML
          </button>
        </div>
      </div>
    </div>
  );

  /* ══ Render ════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full min-h-0 bg-white">

      {/* ── Header ──────────────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center justify-between px-6 bg-white"
        style={{ height: 56, borderBottom: "1px solid #F0F0F0" }}
      >
        <span className="text-sm font-semibold text-[#0A0A0A] truncate max-w-[400px]">
          {hasStarted ? conversationTitle : "Nova conversa"}
        </span>
        <button
          onClick={newChat}
          className="flex items-center gap-1.5 rounded-xl bg-[#0A0A0A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2D2D2D] transition-colors"
        >
          <Plus size={12} strokeWidth={2.5} /> Nova conversa
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 overflow-hidden">

        {/* WELCOME SCREEN */}
        <div
          className="absolute inset-0 overflow-y-auto"
          style={{
            transition:    "opacity 0.35s ease, transform 0.35s ease",
            opacity:       hasStarted ? 0 : 1,
            transform:     hasStarted ? "translateY(-16px) scale(0.98)" : "translateY(0) scale(1)",
            pointerEvents: hasStarted ? "none" : "auto",
          }}
        >
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-10">
            <div className="w-full max-w-[680px] flex flex-col items-center">

              <div className="mb-7">
                <WuilliHex size={52} />
              </div>

              <h1 className="text-[28px] font-bold text-[#0A0A0A] tracking-[-0.03em] mb-2 text-center">
                Olá, {primeiroNome} 👋
              </h1>
              <p className="text-base text-[#6B7280] mb-8 text-center">
                O que você quer vender hoje?
              </p>

              <div className="w-full mb-6">
                <InputBar
                  input={input}
                  thinking={thinking}
                  inputRef={inputRef}
                  onChange={setInput}
                  onSend={send}
                />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                {suggestions.map(s => (
                  <button
                    key={s.label}
                    onClick={() => send(s.msg)}
                    className="flex items-center gap-2.5 px-5 py-4 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] text-sm font-medium text-[#0A0A0A] hover:bg-[#F3F0FF] hover:border-[#7C3AED] transition-all cursor-pointer"
                  >
                    <span style={{ fontSize: 20 }}>{s.emoji}</span>
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
            transition:    "opacity 0.35s ease 0.05s, transform 0.35s ease 0.05s",
            opacity:       hasStarted ? 1 : 0,
            transform:     hasStarted ? "translateY(0)" : "translateY(16px)",
            pointerEvents: hasStarted ? "auto" : "none",
          }}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            <div className="max-w-[720px] mx-auto px-4 py-6 space-y-5">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 ${
                    msg.role === "user" ? "justify-end" : "justify-start items-start"
                  }`}
                >
                  {msg.role === "ai" && (
                    <div className="mt-0.5 shrink-0">
                      <WuilliHex size={28} />
                    </div>
                  )}

                  {msg.kind === "source-select" && msg.nicho ? (
                    <SourceSelector
                      onConfirm={src => handleSourceConfirm(msg.nicho!, src)}
                    />
                  ) : msg.kind === "searching" && msg.nicho ? (
                    <SearchingCard nicho={msg.nicho} />
                  ) : msg.kind === "products" && msg.products ? (
                    renderProducts(msg.products)
                  ) : msg.kind === "ad" && msg.ad ? (
                    renderAd(msg.ad)
                  ) : (
                    <div
                      className={cn(
                        "max-w-[70%] px-4 py-2.5 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-[#7C3AED] text-white"
                          : "bg-[#F9FAFB] text-[#0A0A0A]"
                      )}
                      style={{
                        borderRadius:
                          msg.role === "user"
                            ? "16px 16px 4px 16px"
                            : "16px 16px 16px 4px",
                      }}
                    >
                      {msg.text}
                    </div>
                  )}
                </div>
              ))}

              {/* Typing dots */}
              {thinking && (
                <div className="flex gap-2.5 justify-start items-start">
                  <div className="mt-0.5 shrink-0">
                    <WuilliHex size={28} />
                  </div>
                  <div
                    className="bg-[#F9FAFB] px-4 py-3 flex items-center gap-1.5"
                    style={{ borderRadius: "16px 16px 16px 4px" }}
                  >
                    {[0, 150, 300].map(delay => (
                      <span
                        key={delay}
                        className="w-2 h-2 rounded-full bg-[#9CA3AF] animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Pinned input */}
          <div
            className="shrink-0 px-4 py-4"
            style={{ borderTop: "1px solid #F0F0F0" }}
          >
            <div className="max-w-[720px] mx-auto">
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
  );
};

export default GitChatPage;
