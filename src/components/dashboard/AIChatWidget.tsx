import { useRef, useState } from "react";
import { MessageCircle, X, Send, ShoppingBag, Sparkles } from "lucide-react";

type Product = {
  name: string;
  supplier: string;
  profit: number;
  price: number;
  cat: string;
};

const catalog: Product[] = [
  { name: "Fone Bluetooth TWS", supplier: "TechImport BR", profit: 63, price: 89, cat: "Eletrônicos" },
  { name: "Tênis Casual Masculino", supplier: "ModaFlex SP", profit: 47, price: 127, cat: "Moda" },
  { name: "Kit Skincare Coreano", supplier: "BeautyAsia", profit: 38, price: 89, cat: "Beleza" },
  { name: "Relógio Smartwatch", supplier: "TechImport BR", profit: 82, price: 234, cat: "Eletrônicos" },
  { name: "Mochila Urbana", supplier: "UrbanBags", profit: 55, price: 156, cat: "Moda" },
  { name: "Óculos de Sol Retrô", supplier: "StyleVision", profit: 34, price: 78, cat: "Moda" },
  { name: "Mouse Sem Fio", supplier: "TechImport BR", profit: 28, price: 67, cat: "Eletrônicos" },
  { name: "Capa iPhone 15", supplier: "CaseBR", profit: 22, price: 39, cat: "Eletrônicos" },
  { name: "Perfume Importado", supplier: "BeautyAsia", profit: 71, price: 189, cat: "Beleza" },
  { name: "Tênis Feminino", supplier: "ModaFlex SP", profit: 52, price: 144, cat: "Moda" },
  { name: "Câmera de Segurança", supplier: "TechImport BR", profit: 94, price: 278, cat: "Eletrônicos" },
  { name: "Suporte Notebook", supplier: "OfficeGear", profit: 31, price: 89, cat: "Casa" },
  { name: "Kit Maquiagem", supplier: "BeautyAsia", profit: 45, price: 119, cat: "Beleza" },
  { name: "Luminária LED", supplier: "HomeDeco", profit: 38, price: 97, cat: "Casa" },
  { name: "Caixa de Som BT", supplier: "TechImport BR", profit: 57, price: 167, cat: "Eletrônicos" },
  { name: "Carteira Couro", supplier: "LeatherBR", profit: 44, price: 134, cat: "Moda" },
];

type Message = {
  role: "user" | "ai";
  text?: string;
  products?: Product[];
};

function getProductInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function searchProducts(query: string): { text: string; products: Product[] } {
  const q = query.toLowerCase();

  // detect category keywords
  const catMap: Record<string, string> = {
    eletrônico: "Eletrônicos", eletronico: "Eletrônicos", eletrônicos: "Eletrônicos", eletronicos: "Eletrônicos",
    moda: "Moda", roupa: "Moda", tênis: "Moda", tenis: "Moda",
    beleza: "Beleza", skincare: "Beleza", maquiagem: "Beleza", perfume: "Beleza",
    casa: "Casa", luminária: "Casa", luminaria: "Casa",
  };

  let filtered = [...catalog];
  let matchedCat = "";

  for (const [kw, cat] of Object.entries(catMap)) {
    if (q.includes(kw)) {
      filtered = filtered.filter((p) => p.cat === cat);
      matchedCat = cat;
      break;
    }
  }

  // detect intent: lucro, barato, caro
  const wantsHighProfit = /lucro|rentável|rentavel|margem|ganho/.test(q);
  const wantsCheap = /barato|econômico|economico|baixo preço|baixo preco/.test(q);
  const wantsExpensive = /caro|premium|alto valor/.test(q);
  const wantsBest = /melhor|top|recomend|indicar|sugerir/.test(q);

  // name search fallback
  const nameMatch = catalog.filter((p) => p.name.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q));
  if (nameMatch.length > 0 && !matchedCat && !wantsHighProfit && !wantsCheap && !wantsExpensive && !wantsBest) {
    filtered = nameMatch;
  }

  if (wantsHighProfit) {
    filtered = filtered.sort((a, b) => b.profit - a.profit);
  } else if (wantsCheap) {
    filtered = filtered.sort((a, b) => a.price - b.price);
  } else if (wantsExpensive) {
    filtered = filtered.sort((a, b) => b.price - a.price);
  } else {
    // default: sort by profit desc
    filtered = filtered.sort((a, b) => b.profit - a.profit);
  }

  const top = filtered.slice(0, 4);

  if (top.length === 0) {
    return { text: "Não encontrei produtos para essa busca. Tente categorias como Eletrônicos, Moda, Beleza ou Casa.", products: [] };
  }

  const label = matchedCat ? `em ${matchedCat}` : "no catálogo";
  const criterion = wantsHighProfit ? "maior lucro" : wantsCheap ? "menor preço" : "melhor margem";
  return {
    text: `Encontrei ${top.length} produtos ${label} com ${criterion}. Você pode adicioná-los à sua loja direto aqui:`,
    products: top,
  };
}

function processMessage(text: string): Message {
  const q = text.trim().toLowerCase();

  if (/oi|olá|ola|hey|bom dia|boa tarde|boa noite/.test(q)) {
    return { role: "ai", text: "Olá! Sou sua IA de produtos. Me diga o que você quer vender — categoria, faixa de preço, maior lucro — e eu filtro os melhores do catálogo pra você adicionar à loja." };
  }

  if (/ajuda|como funciona|o que você faz|o que voce faz/.test(q)) {
    return { role: "ai", text: 'Posso buscar produtos no catálogo por categoria (Eletrônicos, Moda, Beleza, Casa), por lucro, preço ou nome. Tente: "quero eletrônicos com maior lucro" ou "mostre produtos baratos de moda".' };
  }

  const result = searchProducts(text);
  return { role: "ai", text: result.text, products: result.products };
}

const AIChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: "Olá! Sou sua IA de produtos. Me diga o que você quer vender e eu filtro os melhores do catálogo pra você." },
  ]);
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setThinking(true);
    setTimeout(() => {
      const reply = processMessage(text);
      setMessages((prev) => [...prev, reply]);
      setThinking(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }, 800);
  };

  const addToStore = (product: Product) => {
    setAddedProducts((prev) => new Set(prev).add(product.name));
    setMessages((prev) => [
      ...prev,
      { role: "ai", text: `✅ "${product.name}" foi adicionado à sua loja com sucesso!` },
    ]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[340px] rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "520px" }}>
          {/* header */}
          <div className="flex items-center gap-2 bg-primary px-4 py-3 shrink-0">
            <Sparkles size={15} className="text-primary-foreground opacity-80" />
            <span className="text-sm font-semibold text-primary-foreground flex-1">IA de Produtos</span>
            <button onClick={() => setOpen(false)}>
              <X size={16} className="text-primary-foreground" />
            </button>
          </div>

          {/* messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}>
                  {msg.text}
                </div>

                {msg.products && msg.products.length > 0 && (
                  <div className="w-full space-y-2">
                    {msg.products.map((p) => {
                      const isAdded = addedProducts.has(p.name);
                      return (
                        <div key={p.name} className="flex items-center gap-3 rounded-xl border border-border bg-background p-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-[11px] font-bold tracking-wide text-foreground">
                            {getProductInitials(p.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground">{p.supplier}</p>
                            <p className="text-[11px] text-primary font-semibold">Lucro R${p.profit} · R${p.price}</p>
                          </div>
                          <button
                            onClick={() => !isAdded && addToStore(p)}
                            className={`shrink-0 flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all ${
                              isAdded
                                ? "bg-green-100 text-green-700"
                                : "bg-primary text-primary-foreground hover:opacity-90"
                            }`}
                          >
                            <ShoppingBag size={11} />
                            {isAdded ? "Adicionado" : "Adicionar"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {thinking && (
              <div className="flex items-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground">
                  <span className="animate-pulse">Buscando produtos...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* input */}
          <div className="flex items-center gap-2 border-t border-border px-3 py-2 shrink-0">
            <input
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Ex: eletrônicos com maior lucro..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button onClick={send} className="text-primary hover:opacity-70 transition-opacity">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
      </button>
    </>
  );
};

export default AIChatWidget;
