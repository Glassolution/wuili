import { useRef, useState } from "react";
import { Send, ShoppingBag, Sparkles } from "lucide-react";

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

const suggestions = [
  "Eletrônicos com maior lucro",
  "Produtos baratos de moda",
  "Melhores de beleza",
  "Top produtos de casa",
];

function getProductInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function searchProducts(query: string): { text: string; products: Product[] } {
  const q = query.toLowerCase();

  const catMap: Record<string, string> = {
    "eletrônico": "Eletrônicos", "eletronico": "Eletrônicos", "eletrônicos": "Eletrônicos", "eletronicos": "Eletrônicos",
    "moda": "Moda", "roupa": "Moda", "tênis": "Moda", "tenis": "Moda",
    "beleza": "Beleza", "skincare": "Beleza", "maquiagem": "Beleza", "perfume": "Beleza",
    "casa": "Casa", "luminária": "Casa", "luminaria": "Casa",
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

  const wantsHighProfit = /lucro|rentável|rentavel|margem|ganho/.test(q);
  const wantsCheap = /barato|econômico|economico|baixo preço|baixo preco/.test(q);
  const wantsExpensive = /caro|premium|alto valor/.test(q);

  const nameMatch = catalog.filter((p) => p.name.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q));
  if (nameMatch.length > 0 && !matchedCat && !wantsHighProfit && !wantsCheap && !wantsExpensive) {
    filtered = nameMatch;
  }

  if (wantsHighProfit) filtered = filtered.sort((a, b) => b.profit - a.profit);
  else if (wantsCheap) filtered = filtered.sort((a, b) => a.price - b.price);
  else if (wantsExpensive) filtered = filtered.sort((a, b) => b.price - a.price);
  else filtered = filtered.sort((a, b) => b.profit - a.profit);

  const top = filtered.slice(0, 4);

  if (top.length === 0) {
    return { text: "Não encontrei produtos para essa busca. Tente categorias como Eletrônicos, Moda, Beleza ou Casa.", products: [] };
  }

  const label = matchedCat ? `em ${matchedCat}` : "no catálogo";
  const criterion = wantsHighProfit ? "maior lucro" : wantsCheap ? "menor preço" : "melhor margem";
  return {
    text: `Encontrei ${top.length} produtos ${label} com ${criterion}. Adicione à sua loja com um clique:`,
    products: top,
  };
}

function processMessage(text: string): Message {
  const q = text.trim().toLowerCase();
  if (/^(oi|olá|ola|hey|bom dia|boa tarde|boa noite)/.test(q)) {
    return { role: "ai", text: "Olá! Me diga o que você quer vender — categoria, faixa de preço ou maior lucro — e eu filtro os melhores do catálogo pra você." };
  }
  if (/ajuda|como funciona|o que você faz|o que voce faz/.test(q)) {
    return { role: "ai", text: 'Busco produtos no catálogo por categoria (Eletrônicos, Moda, Beleza, Casa), lucro, preço ou nome. Tente: "eletrônicos com maior lucro" ou "produtos baratos de moda".' };
  }
  const result = searchProducts(text);
  return { role: "ai", text: result.text, products: result.products };
}

const AIChatPage = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setThinking(true);
    setTimeout(() => {
      const reply = processMessage(msg);
      setMessages((prev) => [...prev, reply]);
      setThinking(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }, 700);
  };

  const addToStore = (product: Product) => {
    setAddedProducts((prev) => new Set(prev).add(product.name));
    setMessages((prev) => [...prev, { role: "ai", text: `✅ "${product.name}" adicionado à sua loja!` }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
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
              Diga o que você quer vender e eu busco os melhores produtos do catálogo pra adicionar à sua loja.
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
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}>
                {msg.text}
              </div>

              {msg.products && msg.products.length > 0 && (
                <div className="w-full max-w-lg space-y-2">
                  {msg.products.map((p) => {
                    const isAdded = addedProducts.has(p.name);
                    return (
                      <div key={p.name} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-bold tracking-wide text-foreground">
                          {getProductInitials(p.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.supplier} · {p.cat}</p>
                          <p className="text-xs text-primary font-semibold mt-0.5">Lucro R${p.profit} · Preço R${p.price}</p>
                        </div>
                        <button
                          onClick={() => !isAdded && addToStore(p)}
                          className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                            isAdded ? "bg-green-100 text-green-700" : "bg-primary text-primary-foreground hover:opacity-90"
                          }`}
                        >
                          <ShoppingBag size={12} />
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
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-muted-foreground animate-pulse">
                Buscando produtos...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* input */}
      <div className="shrink-0 pt-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 focus-within:ring-2 focus-within:ring-primary/20">
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Ex: eletrônicos com maior lucro..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button
            onClick={() => send()}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChatPage;
