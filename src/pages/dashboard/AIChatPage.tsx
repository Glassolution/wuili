import { useState, useRef, useEffect } from "react";
import {
  Package, ArrowUpRight, Copy, Check, RefreshCw, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/profileContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SourceSelector, type ProductSource } from "@/components/chat/SourceSelector";
import SelectProductModal from "@/components/dashboard/SelectProductModal";
import { VeloLogo } from "@/components/VeloLogo";

// ─── Types (unchanged) ────────────────────────────────────────────────────────
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

// Catalog product from SelectProductModal
type CatalogProduct = {
  id: string;
  title: string;
  images: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  cost_price: number;
  suggested_price: number;
  category: string | null;
};

// ─── Quick suggestion chips ───────────────────────────────────────────────────
const QUICK_CHIPS = [
  {
    label: "📦 Destacar benefícios",
    text: "Destaque os principais benefícios e diferenciais do produto, o que ele resolve para o comprador.",
  },
  {
    label: "🔥 Foco no preço",
    text: "Foque no custo-benefício e no melhor preço do mercado, criando senso de urgência na compra.",
  },
  {
    label: "⭐ Prova social",
    text: "Use prova social, popularidade e avaliações positivas do produto para convencer o comprador.",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getProductImage = (images: any): string | null => { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const arr = typeof images === "string" ? JSON.parse(images) : images;
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  } catch { return null; }
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ─── AI & product fetch logic (unchanged) ────────────────────────────────────
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
  return (mlData.results ?? []).map((item: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
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

// ─── Searching indicator (reused in intermediate messages) ───────────────────
const SearchingCard = ({ nicho }: { nicho: string }) => (
  <div className="flex items-center gap-4 rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4 w-full shadow-sm">
    <div className="flex items-end gap-[3px] shrink-0 h-5">
      {[0, 1, 2, 3].map(i => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-black/70"
          style={{ animation: "searchBar 1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-gray-800 leading-snug">Buscando produtos</p>
      <p className="text-xs text-gray-400 mt-0.5 truncate">
        Nicho: <span className="font-medium text-black capitalize">{nicho}</span>
      </p>
    </div>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const AIChatPage = () => {
  const { nome } = useProfile();
  const { user } = useAuth();

  // state – profile (unchanged)
  const [profileName, setProfileName] = useState(nome);

  // state – chat logic (unchanged)
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const apiHistory = useRef<{ role: string; content: string }[]>([]);

  // state – new UI
  const [adInput, setAdInput] = useState("");
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastGenerateMsg, setLastGenerateMsg] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Effects (unchanged) ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).single()
      .then(({ data }) => { if (data?.display_name) setProfileName(data.display_name); });
  }, [user]);

  useEffect(() => { if (nome) setProfileName(nome); }, [nome]);

  // ── Scroll helper ─────────────────────────────────────────────────────────
  const scroll = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  // ── send() — logic unchanged ──────────────────────────────────────────────
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
      if (parsed._nicho) {
        setMessages(prev => [...prev, { role: "ai", text: "", kind: "source-select", nicho: parsed._nicho }]);
        return;
      }
      setMessages(prev => [...prev, { role: "ai", text: response, ...parsed }]);
    } catch (err) {
      console.error("[AI Chat]", err);
      setMessages(prev => [...prev, { role: "ai", text: "Erro de conexão. Tente novamente.", kind: "text" }]);
    } finally {
      setThinking(false);
      scroll();
    }
  };

  // ── newChat() — logic unchanged ───────────────────────────────────────────
  const newChat = () => {
    setMessages([]);
    setInput("");
    setThinking(false);
    setAdInput("");
    setSelectedProduct(null);
    setLastGenerateMsg("");
    apiHistory.current = [];
  };

  // ── handleSourceConfirm() — logic unchanged ───────────────────────────────
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
      const errMsg = "Não encontrei produtos para esse nicho agora. Tente outro nicho.";
      apiHistory.current = [...apiHistory.current, { role: "assistant", content: errMsg }];
      setMessages(prev => {
        const w = prev.filter(m => m.kind !== "searching");
        return [...w, { role: "ai", text: errMsg, kind: "text" }];
      });
    } else {
      const ctx = `Produtos encontrados no ${sourceLabel} para "${nicho}": ${products.map(p => p.nome).join(", ")}`;
      apiHistory.current = [...apiHistory.current, { role: "assistant", content: ctx }];
      setMessages(prev => {
        const w = prev.filter(m => m.kind !== "searching");
        return [...w, { role: "ai", text: "", kind: "products", products }];
      });
    }
    scroll();
  };

  // ── handleGenerate — builds message and calls send() ─────────────────────
  const handleGenerate = () => {
    let msg = "";
    if (selectedProduct) {
      msg = `Crie um anúncio para o produto: "${selectedProduct.title}". Custo: ${formatBRL(selectedProduct.cost_price)}. Preço sugerido: ${formatBRL(selectedProduct.suggested_price)}.`;
      if (adInput.trim()) msg += ` ${adInput.trim()}`;
    } else {
      msg = adInput.trim() || "Crie um anúncio para um produto de dropshipping.";
    }
    setLastGenerateMsg(msg);
    send(msg);
  };

  // ── copyAd ────────────────────────────────────────────────────────────────
  const copyAd = (ad: Ad) => {
    const text = `${ad.titulo}\n\n${ad.descricao}\n\nPreço: ${ad.preco}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  // Latest generated ad → shown in result card
  const latestAd = [...messages].reverse().find(m => m.kind === "ad")?.ad ?? null;
  // All messages except ads (ads are shown in the card, not inline)
  const intermediateMessages = messages.filter(m => m.kind !== "ad");

  // ── Products grid (kept from original logic) ──────────────────────────────
  const renderProducts = (products: Product[]) => (
    <div className="grid grid-cols-2 gap-3 w-full">
      {products.map((p, i) => (
        <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm flex flex-col">
          <div className="h-[120px] bg-gray-50 overflow-hidden">
            {p.imagem
              ? <img src={p.imagem} alt={p.nome} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              : <div className="w-full h-full flex items-center justify-center"><Package size={24} className="text-gray-300" /></div>
            }
          </div>
          <div className="p-3 flex flex-col flex-1 gap-1.5">
            <p className="text-[13px] font-semibold text-gray-800 line-clamp-2 leading-snug">{p.nome}</p>
            {p.margem && (
              <span className="self-start rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold text-black">
                Margem {p.margem}
              </span>
            )}
            <div className="flex-1" />
            {p.precoVenda != null
              ? <p className="text-sm font-bold text-black">R$ {p.precoVenda.toFixed(2).replace(".", ",")}</p>
              : p.preco ? <p className="text-sm font-bold text-black">{p.preco}</p> : null
            }
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-black transition-colors">
                Ver produto <ArrowUpRight size={10} />
              </a>
            )}
            <button
              onClick={() => send(`Quero publicar este produto: ${p.nome}`)}
              className="w-full h-8 bg-black text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity mt-1"
            >
              Publicar no ML
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-white overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      <style>{`
        @keyframes searchBar   { 0%,100%{height:6px;opacity:.4} 50%{height:20px;opacity:1} }
        @keyframes slideUp     { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseDot    { 0%,100%{opacity:1} 50%{opacity:0.25} }
        .ad-card-enter         { animation: slideUp 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .ia-pulse              { animation: pulseDot 1.6s ease-in-out infinite; }
      `}</style>

      <div className="max-w-[680px] mx-auto px-4 py-10 pb-16">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center mb-10">
          <div style={{ marginBottom: 16 }}><VeloLogo size="md" variant="dark" /></div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#0A0A0A", lineHeight: 1.3, margin: 0 }}>
            Criar anúncio com IA
          </h1>
          <p style={{ fontSize: 14, color: "#737373", marginTop: 6, marginBottom: 0 }}>
            Selecione um produto e descreva o que você quer destacar
          </p>
          {messages.length > 0 && (
            <button
              onClick={newChat}
              style={{ fontSize: 12, color: "#A3A3A3", marginTop: 10, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              Nova consulta
            </button>
          )}
        </div>

        {/* ── PRODUCT SELECTOR ────────────────────────────────────────────── */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowProductModal(true)}
          onKeyDown={e => e.key === "Enter" && setShowProductModal(true)}
          className="product-selector"
          style={{
            border: "1.5px dashed #D4D4D4",
            borderRadius: 16,
            padding: 20,
            background: "#FAFAFA",
            cursor: "pointer",
            transition: "border-color 150ms, background 150ms",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "#000";
            (e.currentTarget as HTMLDivElement).style.background = "#F5F5F5";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "#D4D4D4";
            (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA";
          }}
        >
          {selectedProduct ? (
            /* ── Selected state ── */
            <div className="flex items-center gap-3">
              <div style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", background: "#F0F0F0", flexShrink: 0 }}>
                {getProductImage(selectedProduct.images) ? (
                  <img
                    src={getProductImage(selectedProduct.images)!}
                    alt={selectedProduct.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Package size={22} color="#A3A3A3" />
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedProduct.title}
                </p>
                <p style={{ fontSize: 12, color: "#737373", margin: "3px 0 0" }}>
                  Custo {formatBRL(selectedProduct.cost_price)} · Venda sugerida {formatBRL(selectedProduct.suggested_price)}
                </p>
                <span style={{
                  display: "inline-block", marginTop: 5,
                  background: "#DCFCE7", color: "#16A34A",
                  fontSize: 11, fontWeight: 600,
                  borderRadius: 100, padding: "2px 8px",
                }}>
                  Lucro {formatBRL(selectedProduct.suggested_price - selectedProduct.cost_price)}
                </span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setShowProductModal(true); }}
                style={{ fontSize: 12, color: "#737373", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
              >
                Trocar
              </button>
            </div>
          ) : (
            /* ── Empty state ── */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 0" }}>
              <Package size={28} color="#A3A3A3" />
              <p style={{ fontSize: 14, color: "#737373", fontWeight: 500, margin: 0 }}>
                Selecionar produto do catálogo
              </p>
              <p style={{ fontSize: 12, color: "#A3A3A3", margin: 0 }}>
                Escolha um produto da Velo para gerar o anúncio
              </p>
            </div>
          )}
        </div>

        {/* ── QUICK CHIPS ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          {QUICK_CHIPS.map(chip => (
            <button
              key={chip.label}
              onClick={() => setAdInput(chip.text)}
              style={{
                border: "1px solid #E5E5E5",
                borderRadius: 100,
                padding: "8px 16px",
                fontSize: 13,
                background: "#FFFFFF",
                cursor: "pointer",
                color: "#0A0A0A",
                transition: "border-color 120ms, background 120ms",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#000";
                (e.currentTarget as HTMLButtonElement).style.background = "#F5F5F5";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#E5E5E5";
                (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF";
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* ── TEXTAREA ────────────────────────────────────────────────────── */}
        <div
          style={{
            border: `1.5px solid ${textareaFocused ? "#000" : "#E5E5E5"}`,
            boxShadow: textareaFocused ? "0 0 0 3px rgba(0,0,0,0.06)" : "none",
            borderRadius: 16,
            background: "#FFFFFF",
            padding: "16px 20px",
            marginTop: 16,
            transition: "border-color 150ms, box-shadow 150ms",
          }}
        >
          <textarea
            value={adInput}
            onChange={e => { if (e.target.value.length <= 500) setAdInput(e.target.value); }}
            onFocus={() => setTextareaFocused(true)}
            onBlur={() => setTextareaFocused(false)}
            placeholder="Descreva o que você quer destacar no anúncio... Ex: foco no conforto, ideal para treinos, entrega rápida"
            rows={4}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: 15,
              lineHeight: 1.6,
              color: "#0A0A0A",
              fontFamily: "inherit",
            }}
          />
          <div style={{
            borderTop: "1px solid #F0F0F0",
            paddingTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 12, color: "#A3A3A3" }}>{adInput.length} / 500</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                className="ia-pulse"
                style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", display: "inline-block" }}
              />
              <span style={{ fontSize: 12, color: "#737373", fontWeight: 500 }}>IA Pronta</span>
            </div>
          </div>
        </div>

        {/* ── GENERATE BUTTON ─────────────────────────────────────────────── */}
        <button
          onClick={handleGenerate}
          disabled={thinking}
          style={{
            width: "100%",
            marginTop: 16,
            background: "#000",
            color: "#FFF",
            borderRadius: 100,
            padding: "14px 32px",
            fontSize: 15,
            fontWeight: 500,
            border: "none",
            cursor: thinking ? "not-allowed" : "pointer",
            opacity: thinking ? 0.6 : 1,
            transition: "opacity 150ms, transform 150ms",
          }}
          onMouseEnter={e => {
            if (!thinking) {
              (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.opacity = thinking ? "0.6" : "1";
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          {thinking ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <span style={{ display: "flex", gap: 4 }}>
                {[0, 150, 300].map(delay => (
                  <span
                    key={delay}
                    className="animate-bounce"
                    style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: "rgba(255,255,255,0.7)",
                      display: "inline-block",
                      animationDelay: `${delay}ms`,
                    }}
                  />
                ))}
              </span>
              Gerando anúncio...
            </span>
          ) : "✦ Gerar anúncio com IA"}
        </button>
        <p style={{ fontSize: 12, color: "#A3A3A3", textAlign: "center", marginTop: 8 }}>
          Powered by Velo IA · Resultado em segundos
        </p>

        {/* ── INTERMEDIATE MESSAGES (text, products, searching, source-select) */}
        {intermediateMessages.length > 0 && (
          <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
            {intermediateMessages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start items-start"
                )}
              >
                {msg.role === "ai" && (
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "#000",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, marginTop: 2,
                  }}>
                    <Sparkles size={14} color="#fff" />
                  </div>
                )}
                {msg.kind === "source-select" && msg.nicho
                  ? <SourceSelector onConfirm={src => handleSourceConfirm(msg.nicho!, src)} />
                  : msg.kind === "searching" && msg.nicho
                  ? <SearchingCard nicho={msg.nicho} />
                  : msg.kind === "products" && msg.products
                  ? renderProducts(msg.products)
                  : (
                    <div
                      className={cn(
                        "px-4 py-3 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-black text-white rounded-2xl rounded-tr-sm max-w-[80%]"
                          : "bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm text-gray-700 max-w-[80%]"
                      )}
                    >
                      {msg.text}
                    </div>
                  )
                }
              </div>
            ))}

            {/* Thinking dots */}
            {thinking && (
              <div className="flex gap-3 justify-start items-start">
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: "#000",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
                }}>
                  <Sparkles size={14} color="#fff" />
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  {[0, 150, 300].map(delay => (
                    <span
                      key={delay}
                      className="w-1.5 h-1.5 rounded-full bg-black/40 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RESULT CARD ─────────────────────────────────────────────────── */}
        {latestAd && (
          <div
            className="ad-card-enter"
            style={{
              marginTop: 32,
              border: "1.5px solid #000",
              borderRadius: 16,
              padding: 24,
            }}
          >
            {/* Card header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A" }}>Anúncio gerado</span>
                {["Mercado Livre", "Shopee"].map(platform => (
                  <span
                    key={platform}
                    style={{
                      fontSize: 11, fontWeight: 600, color: "#EA580C",
                      background: "#FFF7ED", border: "1px solid #FED7AA",
                      borderRadius: 100, padding: "2px 8px",
                    }}
                  >
                    {platform}
                  </span>
                ))}
              </div>
              <button
                onClick={() => copyAd(latestAd)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  border: "1px solid #E5E5E5", borderRadius: 8,
                  padding: "6px 12px", background: "#FFFFFF",
                  cursor: "pointer", fontSize: 12, color: "#737373",
                  flexShrink: 0, transition: "border-color 120ms",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = "#000"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = "#E5E5E5"}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>

            {/* Card body */}
            <div style={{ marginTop: 18 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: "0 0 8px" }}>
                {latestAd.titulo}
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "#404040", margin: 0 }}>
                {latestAd.descricao}
              </p>
              {latestAd.preco && (
                <p style={{ marginTop: 12, fontSize: 13, color: "#737373" }}>
                  Preço sugerido:{" "}
                  <span style={{ fontWeight: 700, color: "#0A0A0A" }}>{latestAd.preco}</span>
                </p>
              )}
            </div>

            {/* Card footer */}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => send("Publicar no Mercado Livre")}
                style={{
                  flex: 1, background: "#000", color: "#FFF",
                  borderRadius: 10, padding: "11px 20px",
                  fontSize: 13, fontWeight: 600,
                  border: "none", cursor: "pointer",
                  transition: "opacity 150ms",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}
              >
                Publicar agora →
              </button>
              <button
                onClick={() => send(lastGenerateMsg || "Regenere o anúncio com variações diferentes.")}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  background: "#FFF", color: "#0A0A0A",
                  border: "1.5px solid #000", borderRadius: 10,
                  padding: "11px 20px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", transition: "background 150ms",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "#F5F5F5"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "#FFF"}
              >
                <RefreshCw size={13} />
                Regenerar
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── PRODUCT SELECTOR MODAL ────────────────────────────────────────── */}
      <SelectProductModal
        open={showProductModal}
        onClose={() => setShowProductModal(false)}
        onSelect={p => {
          setSelectedProduct(p);
          setShowProductModal(false);
        }}
      />
    </div>
  );
};

export default AIChatPage;
