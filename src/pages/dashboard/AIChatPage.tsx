import { useRef, useState, useEffect, useCallback, memo } from "react";
import { Send, ShoppingBag, Sparkles, Star, Rocket, ExternalLink, AlertCircle } from "lucide-react";
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
  "Quero vender eletrônicos",
  "Produtos de moda com boa margem",
  "Melhores produtos de beleza",
  "Produtos para casa e decoração",
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
      const { data, error } = await supabase.functions.invoke("aliexpress-products", {
        body: { nicho },
      });
      if (error) throw error;
      return data?.products || [];
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

    // Detect niche mentions
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
            text: `🔥 Encontrei ${products.length} produtos reais do AliExpress para ${detectedNicho}! Todos com margem de 40%+. Clique em "Quero este" para criar o anúncio:`,
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

    // Fallback to AI chat
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
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-2xl mx-auto">
      {/* empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center px-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Sparkles size={26} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">IA de Produtos</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Diga o nicho que você quer vender e eu busco produtos reais do AliExpress com margem de 40%+.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* messages */}
      {!isEmpty && (
        <div className="flex-1 overflow-y-auto scrollbar-none py-4 space-y-4" style={{ scrollbarWidth: "none" }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              {msg.text && (
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
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
                      <div key={p.product_id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                        {p.imagem ? (
                          <img src={p.imagem} alt={p.nome} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-bold tracking-wide text-foreground">
                            {getProductInitials(p.nome)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{p.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            Custo: {p.preco_custo} · Venda: <span className="text-primary font-semibold">{p.preco_venda}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-semibold text-green-600">Margem {p.margem}</span>
                            {p.vendas && p.vendas !== "0" && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Star size={10} className="fill-yellow-400 text-yellow-400" /> {p.vendas} vendas
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleProductSelect(p)}
                          className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                            isSelected ? "bg-green-100 text-green-700" : "bg-primary text-primary-foreground hover:opacity-90"
                          }`}
                        >
                          <ShoppingBag size={12} />
                          {isSelected ? "Criando anúncio..." : "Quero este"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ad preview */}
              {msg.adPreview && (
                <div className="w-full max-w-lg rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">{msg.adPreview.plataforma}</span>
                    <span className="text-xs text-muted-foreground">Anúncio pronto!</span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{msg.adPreview.titulo}</h3>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{msg.adPreview.descricao}</p>
                  <p className="text-lg font-bold text-primary">{msg.adPreview.preco}</p>

                  {/* Publish button / result */}
                  {!msg.publishResult && (
                    <button
                      onClick={() => publishToML(msg.adPreview, i)}
                      disabled={publishing !== null}
                      className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      <Rocket size={14} />
                      {publishing === msg.adPreview?.titulo ? "Publicando..." : "Publicar no Mercado Livre"}
                    </button>
                  )}

                  {msg.publishResult?.status === "success" && (
                    <div className="flex items-center gap-2 rounded-lg bg-green-100 text-green-800 px-4 py-2 text-sm">
                      <span>✅ Anúncio publicado!</span>
                      {msg.publishResult.permalink && (
                        <a href={msg.publishResult.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline font-semibold">
                          Ver no ML <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  )}

                  {msg.publishResult?.status === "not_connected" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-lg bg-yellow-100 text-yellow-800 px-4 py-2 text-sm">
                        <AlertCircle size={14} />
                        <span>{msg.publishResult.message}</span>
                      </div>
                      <button
                        onClick={() => navigate("/dashboard/configuracoes")}
                        className="flex items-center gap-2 rounded-lg border border-primary text-primary px-4 py-2 text-sm font-semibold hover:bg-primary/5 transition-colors"
                      >
                        Conectar Mercado Livre →
                      </button>
                    </div>
                  )}

                  {msg.publishResult?.status === "error" && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive px-4 py-2 text-sm">
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
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-muted-foreground animate-pulse">
                Buscando produtos...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <ChatInput onSend={send} disabled={thinking} />
    </div>
  );
};

export default AIChatPage;
