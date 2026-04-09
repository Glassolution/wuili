import { useRef, useState, useCallback, memo } from "react";
import { Send, ShoppingBag, Star, Rocket, ExternalLink, AlertCircle, ArrowUp, Cpu, TrendingUp, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type AliProduct = {
  nome: string;
  preco_custo: string;
  preco_venda: string;
  margem: string;
  vendas: string;
  imagem: string;
  product_id: string;
  link?: string;
};

type PublishResult = {
  status: "success" | "error" | "not_connected";
  permalink?: string;
  item_id?: string;
  message?: string;
};

type Message = {
  role: "user" | "ai";
  text?: string;
  products?: AliProduct[];
  adPreview?: { titulo: string; descricao: string; preco: string; plataforma: string; sourceProduct?: AliProduct };
  publishResult?: PublishResult;
};

const suggestions = [
  {
    label: "Buscar eletrônicos",
    desc: "Gadgets, fones e acessórios com alta margem",
    icon: Cpu,
    gradient: "from-blue-600/80 to-indigo-700/80",
    message: "Quero vender eletrônicos",
  },
  {
    label: "Buscar moda",
    desc: "Roupas, tênis e acessórios em alta",
    icon: Palette,
    gradient: "from-pink-600/80 to-rose-700/80",
    message: "Produtos de moda com boa margem",
  },
  {
    label: "Buscar beleza",
    desc: "Skincare, maquiagem e cuidados",
    icon: Star,
    gradient: "from-amber-500/80 to-orange-600/80",
    message: "Melhores produtos de beleza",
  },
];

function getProductInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

const SYSTEM_PROMPT = `Você é a IA da Wuilli, plataforma de dropshipping para iniciantes brasileiros.
Quando o usuário disser um nicho, responda APENAS com JSON: {"tipo":"buscar_produtos","nicho":"<nicho>"}
Quando o usuário disser "Quero este produto" seguido de dados, crie o anúncio retornando JSON:
{"tipo":"anuncio","titulo":"","descricao":"","preco":"","plataforma":"Mercado Livre"}
Para qualquer outra mensagem, responda normalmente com dicas de dropshipping.
Seja direto e use linguagem simples.`;

const ChatInput = memo(({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) => {
  const [value, setValue] = useState("");
  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value);
    setValue("");
  };
  return (
    <div className="w-full max-w-[680px] mx-auto px-4 pb-6">
      <div className="relative">
        <input
          className="w-full rounded-2xl border border-white/10 bg-[#1a1d2e] px-5 py-4 pr-14 text-sm text-white/90 outline-none placeholder:text-white/30 focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
          placeholder="O que você quer vender?"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:opacity-90 transition-opacity disabled:opacity-30"
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
});
ChatInput.displayName = "ChatInput";

const AIChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scroll = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

  const fetchProducts = async (nicho: string): Promise<AliProduct[]> => {
    try {
      const searchUrl = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(nicho)}&limit=12`;
      const res = await fetch(searchUrl);
      if (!res.ok) throw new Error(`ML search failed: ${res.status}`);
      const data = await res.json();
      const rawResults: any[] = data.results ?? [];

      return rawResults.slice(0, 8).map((item: any) => {
        const precoCusto = Number(item.price ?? 0);
        const precoVenda = parseFloat((precoCusto * 1.6).toFixed(2));
        const margem = precoVenda > 0
          ? Math.round(((precoVenda - precoCusto) / precoVenda) * 100)
          : 38;

        return {
          product_id: String(item.id ?? ''),
          nome: String(item.title ?? 'Produto').slice(0, 60),
          imagem: (item.thumbnail ?? '')
            .replace('http://', 'https://')
            .replace('I.jpg', 'O.jpg'),
          link: item.permalink ?? '',
          preco_custo: `R$ ${precoCusto.toFixed(2)}`,
          preco_venda: `R$ ${precoVenda.toFixed(2)}`,
          margem: `${margem}%+`,
          vendas: item.sold_quantity ? String(item.sold_quantity) : '—',
        };
      });
    } catch (e) {
      console.error("Error fetching products:", e);
      return [];
    }
  };

  const createAd = async (product: AliProduct): Promise<Message> => {
    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [
            {
              role: "user",
              content: `Crie um anúncio completo para o Mercado Livre para este produto de dropshipping:
Nome: ${product.nome}
Preço de custo: ${product.preco_custo}
Preço de venda sugerido: ${product.preco_venda}
Margem: ${product.margem}

Retorne APENAS um JSON no formato:
{"tipo":"anuncio","titulo":"título chamativo","descricao":"descrição completa com emojis e benefícios para o Mercado Livre","preco":"${product.preco_venda}","plataforma":"Mercado Livre"}`,
            },
          ],
        },
      });
      if (error) throw error;

      const text = data?.response || "";
      const jsonMatch = text.match(/\{[\s\S]*"tipo"\s*:\s*"anuncio"[\s\S]*\}/);
      if (jsonMatch) {
        const ad = JSON.parse(jsonMatch[0]);
        return {
          role: "ai",
          text: `📢 Anúncio criado para "${product.nome}":`,
          adPreview: { titulo: ad.titulo, descricao: ad.descricao, preco: ad.preco || product.preco_venda, plataforma: ad.plataforma || "Mercado Livre", sourceProduct: product },
        };
      }
      return { role: "ai", text: text || "Não consegui criar o anúncio. Tente novamente." };
    } catch (e) {
      console.error("Error creating ad:", e);
      return { role: "ai", text: "Erro ao criar o anúncio. Tente novamente." };
    }
  };

  const publishToML = async (adPreview: Message["adPreview"], messageIndex: number) => {
    if (!adPreview || publishing) return;
    setPublishing(adPreview.titulo);
    scroll();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[messageIndex] = {
            ...updated[messageIndex],
            publishResult: { status: "error", message: "Você precisa estar logado para publicar." },
          };
          return updated;
        });
        setPublishing(null);
        return;
      }

      const priceNum = parseFloat(adPreview.preco.replace(/[^\d.,]/g, "").replace(",", "."));

      const { data, error } = await supabase.functions.invoke("ml-publish", {
        body: {
          user_id: session.user.id,
          product: {
            title: adPreview.titulo.substring(0, 60),
            price: priceNum || 99.9,
            description: adPreview.descricao,
            condition: "new",
            available_quantity: 10,
            images: adPreview.sourceProduct?.imagem ? [adPreview.sourceProduct.imagem] : [],
          },
        },
      });

      if (error) throw error;

      if (data?.error?.includes("não conectado") || data?.error?.includes("Mercado Livre")) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[messageIndex] = {
            ...updated[messageIndex],
            publishResult: { status: "not_connected", message: "Conecte sua conta do Mercado Livre para publicar." },
          };
          return updated;
        });
      } else if (data?.success) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[messageIndex] = {
            ...updated[messageIndex],
            publishResult: { status: "success", permalink: data.permalink, item_id: data.item_id },
          };
          return updated;
        });
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao publicar";
      setMessages((prev) => {
        const updated = [...prev];
        updated[messageIndex] = {
          ...updated[messageIndex],
          publishResult: { status: "error", message: msg },
        };
        return updated;
      });
    }
    setPublishing(null);
    scroll();
  };

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || thinking) return;
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setThinking(true);
    scroll();

    const nichoKeywords: Record<string, string> = {
      "eletrônico": "eletronicos", "eletronico": "eletronicos", "eletrônicos": "eletronicos", "eletronicos": "eletronicos", "tech": "eletronicos",
      "moda": "moda", "roupa": "moda", "tênis": "moda", "tenis": "moda", "fashion": "moda",
      "beleza": "beleza", "skincare": "beleza", "maquiagem": "beleza", "cosmético": "beleza", "cosmetico": "beleza",
      "casa": "casa", "decoração": "casa", "decoracao": "casa", "lar": "casa",
      "esporte": "esporte", "fitness": "esporte", "gym": "esporte",
      "brinquedo": "brinquedos", "brinquedos": "brinquedos", "kids": "brinquedos",
      "joia": "joias", "joias": "joias", "acessório": "joias",
      "pet": "pet", "animal": "pet", "cachorro": "pet", "gato": "pet",
      "bebê": "bebes", "bebe": "bebes", "bebês": "bebes",
      "ferramenta": "ferramentas", "ferramentas": "ferramentas",
      "automotivo": "automotivo", "carro": "automotivo", "auto": "automotivo",
    };

    const lower = msg.toLowerCase();
    let detectedNicho = "";
    for (const [kw, nicho] of Object.entries(nichoKeywords)) {
      if (lower.includes(kw)) {
        detectedNicho = nicho;
        break;
      }
    }

    if (detectedNicho) {
      const products = await fetchProducts(detectedNicho);
      if (products.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: `🔥 Encontrei ${products.length} produtos do Mercado Livre para "${detectedNicho}"! Todos com margem de 40%+.`,
            products,
          },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "ai", text: "Não encontrei produtos para esse nicho. Tente outro como: eletrônicos, moda, beleza, casa." }]);
      }
      setThinking(false);
      scroll();
      return;
    }

    try {
      const history = messages.filter(m => m.text).map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text! }));
      history.push({ role: "user", content: msg });

      const { data, error } = await supabase.functions.invoke("chat", {
        body: { messages: history },
      });

      if (error) throw error;
      setMessages((prev) => [...prev, { role: "ai", text: data?.response || "Desculpe, não consegui processar." }]);
    } catch (e) {
      console.error("Chat error:", e);
      setMessages((prev) => [...prev, { role: "ai", text: "Erro ao processar. Tente novamente." }]);
    }

    setThinking(false);
    scroll();
  }, [thinking, messages]);

  const handleProductSelect = async (product: AliProduct) => {
    if (addedProducts.has(product.product_id)) return;
    setAddedProducts((prev) => new Set(prev).add(product.product_id));
    setMessages((prev) => [...prev, { role: "user", text: `Quero este produto: ${product.nome}` }]);
    setThinking(true);
    scroll();

    const adMessage = await createAd(product);
    setMessages((prev) => [...prev, adMessage]);
    setThinking(false);
    scroll();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-screen w-full bg-[#0f1117]">
      {/* Empty state — Leonardo AI style */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          {/* Sparkle icon with glow */}
          <div className="relative mb-6">
            <div className="absolute inset-0 blur-2xl opacity-60 bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full scale-150" />
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="relative z-10">
              <path d="M24 4L27.5 18.5H42L30 28L34 44L24 34L14 44L18 28L6 18.5H20.5L24 4Z" fill="url(#sparkleGrad)" />
              <defs>
                <linearGradient id="sparkleGrad" x1="6" y1="4" x2="42" y2="44">
                  <stop stopColor="#a78bfa" />
                  <stop offset="0.5" stopColor="#7dd3fc" />
                  <stop offset="1" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Welcome text */}
          <p className="text-white/40 text-sm mb-2 tracking-wide">Bem-vindo à Wuilli AI</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white/90 mb-10 tracking-tight">
            Como posso <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-300">ajudar</span>?
          </h1>

          {/* Suggestion cards */}
          <div className="grid grid-cols-3 gap-4 max-w-[660px] mb-12">
            {suggestions.map((s) => (
              <button
                key={s.message}
                onClick={() => send(s.message)}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${s.gradient} p-5 w-[200px] text-left transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-violet-500/10`}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                <div className="relative z-10">
                  <s.icon className="h-5 w-5 text-white/80 mb-3" />
                  <p className="text-sm font-semibold text-white mb-1">{s.label}</p>
                  <p className="text-xs text-white/60 leading-relaxed">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {!isEmpty && (
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4" style={{ scrollbarWidth: "none" }}>
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {msg.text && (
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-sm"
                      : "bg-[#1a1d2e] text-white/80 rounded-bl-sm border border-white/5"
                  }`}>
                    {msg.text}
                  </div>
                )}

                {/* Product cards */}
                {msg.products && msg.products.length > 0 && (
                  <div className="w-full max-w-lg space-y-2">
                    {msg.products.map((p) => {
                      const isSelected = addedProducts.has(p.product_id);
                      return (
                        <div key={p.product_id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1a1d2e] p-3 transition-all hover:border-white/20">
                          {p.imagem ? (
                            <img src={p.imagem} alt={p.nome} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-bold tracking-wide text-white/60">
                              {getProductInitials(p.nome)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white/90 truncate">{p.nome}</p>
                            <p className="text-xs text-white/40">
                              Custo: {p.preco_custo} · Venda: <span className="text-emerald-400 font-semibold">{p.preco_venda}</span>
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-semibold text-emerald-400">Margem {p.margem}</span>
                              {p.vendas && p.vendas !== "0" && p.vendas !== "—" && (
                                <span className="text-xs text-white/30 flex items-center gap-0.5">
                                  <Star size={10} className="fill-amber-400 text-amber-400" /> {p.vendas} vendas
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleProductSelect(p)}
                            className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                              isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90"
                            }`}
                          >
                            <ShoppingBag size={12} />
                            {isSelected ? "Criando..." : "Quero este"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Ad preview */}
                {msg.adPreview && (
                  <div className="w-full max-w-lg rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold bg-violet-500/20 text-violet-300 rounded-full px-2 py-0.5">{msg.adPreview.plataforma}</span>
                      <span className="text-xs text-white/40">Anúncio pronto!</span>
                    </div>
                    <h3 className="text-sm font-bold text-white/90">{msg.adPreview.titulo}</h3>
                    <p className="text-xs text-white/50 whitespace-pre-wrap leading-relaxed">{msg.adPreview.descricao}</p>
                    <p className="text-lg font-bold text-violet-300">{msg.adPreview.preco}</p>

                    {!msg.publishResult && (
                      <button
                        onClick={() => publishToML(msg.adPreview, i)}
                        disabled={publishing !== null}
                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        <Rocket size={14} />
                        {publishing === msg.adPreview?.titulo ? "Publicando..." : "Publicar no Mercado Livre"}
                      </button>
                    )}

                    {msg.publishResult?.status === "success" && (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 text-sm">
                        <span>✅ Publicado!</span>
                        {msg.publishResult.permalink && (
                          <a href={msg.publishResult.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline font-semibold">
                            Ver no ML <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    )}

                    {msg.publishResult?.status === "not_connected" && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-2 text-sm">
                          <AlertCircle size={14} />
                          <span>{msg.publishResult.message}</span>
                        </div>
                        <button
                          onClick={() => navigate("/dashboard/configuracoes")}
                          className="flex items-center gap-2 rounded-lg border border-violet-500/30 text-violet-300 px-4 py-2 text-sm font-semibold hover:bg-violet-500/5 transition-colors"
                        >
                          Conectar Mercado Livre →
                        </button>
                      </div>
                    )}

                    {msg.publishResult?.status === "error" && (
                      <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 text-sm">
                        <AlertCircle size={14} />
                        <span>{msg.publishResult.message}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {thinking && (
              <div className="flex items-start">
                <div className="bg-[#1a1d2e] border border-white/5 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-white/40 animate-pulse">
                  Buscando produtos...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={send} disabled={thinking} />
    </div>
  );
};

export default AIChatPage;