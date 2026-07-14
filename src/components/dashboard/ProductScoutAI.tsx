import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowUp,
  Boxes,
  ChevronDown,
  Eye,
  Mic,
  PackageSearch,
  Plus,
  Sparkles,
  TrendingUp,
  type LucideIcon,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, type Product } from "@/components/dashboard/ProductCard";
import AquasIcon from "@/components/dashboard/AquasIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";

export type AtlasResults = {
  ids: string[];
  label: string;
  source: "preference" | "ai" | "fallback";
};

type ProductScoutAIProps = {
  onResults: (results: AtlasResults) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialPrompt?: string;
  initialPromptKey?: number;
  showTriggerButton?: boolean;
  immersive?: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  product?: SuggestedProduct;
  products?: SuggestedProduct[];
  actions?: ChatAction[];
};

type ChatAction = {
  type: "navigate" | "diagnose" | "publish_start" | "publish_complete" | "product_search";
  label: string;
  path?: string;
  payload?: Record<string, unknown>;
  variant?: "primary" | "secondary";
};

type SuggestedProduct = Product & {
  costPrice: number | null;
  suggestedPrice: number | null;
  stockQuantity: number | null;
  catalogoUrl: string;
  fornecedorUrl: string | null;
  publishAction?: ChatAction | null;
};

type CatalogProductRecord = {
  id: string;
  title: string | null;
  images: unknown;
  cost_price: number | null;
  suggested_price: number | null;
  category: string | null;
  stock_quantity: number | null;
  product_url: string | null;
};

type PromptOption = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
};

type SearchAnalysis = {
  margem?: string;
  demanda?: string;
  potencial_viral?: string;
  facilidade_venda?: string;
  recomendacao?: "bom" | "mediano" | "ruim";
};

const INITIAL_SUGGESTIONS: PromptOption[] = [
  {
    icon: PackageSearch,
    label: "Produtos baratos para testar",
    value: "Encontre produtos baratos para testar uma primeira venda",
    hint: "Preço de entrada baixo para validar demanda sem muito risco.",
  },
  {
    icon: TrendingUp,
    label: "Itens com alta margem",
    value: "Encontre produtos com alta margem de lucro no catálogo",
    hint: "Itens com espaço para markup e venda com lucro maior.",
  },
  {
    icon: Sparkles,
    label: "Produtos virais para anúncio",
    value: "Encontre produtos com apelo viral para anúncios curtos",
    hint: "Produtos fáceis de demonstrar e bons para criativos rápidos.",
  },
  {
    icon: Boxes,
    label: "Estoque alto no catálogo",
    value: "Encontre produtos com estoque alto e boa disponibilidade",
    hint: "Opções com mais segurança para vender sem pausa.",
  },
];

const Styles = () => (
  <style dangerouslySetInnerHTML={{__html: `
    @keyframes aquas-shimmer {
      0% { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }
    .aquas-shimmer {
      background-image: linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%);
      background-size: 200% 100%;
      animation: aquas-shimmer 1.8s linear infinite;
    }
  `}} />
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseChatAction = (value: unknown): ChatAction | null => {
  if (!isRecord(value)) return null;
  const type = value.type;
  const label = value.label;
  if (
    (type !== "navigate" &&
      type !== "diagnose" &&
      type !== "publish_start" &&
      type !== "publish_complete" &&
      type !== "product_search") ||
    typeof label !== "string" ||
    label.trim().length === 0
  ) {
    return null;
  }

  const payload = isRecord(value.payload) ? value.payload : undefined;
  const variant = value.variant === "secondary" ? "secondary" : "primary";

  return {
    type,
    label: label.trim(),
    path: typeof value.path === "string" && value.path.trim().length > 0 ? value.path.trim() : undefined,
    payload,
    variant,
  };
};

const parseChatActions = (value: unknown): ChatAction[] =>
  Array.isArray(value)
    ? value.map(parseChatAction).filter((action): action is ChatAction => action !== null)
    : [];

const parseProductActions = (value: unknown): Map<string, ChatAction> => {
  const actionMap = new Map<string, ChatAction>();
  if (!isRecord(value)) return actionMap;

  Object.entries(value).forEach(([productId, actionValue]) => {
    const action = parseChatAction(actionValue);
    if (action) actionMap.set(productId, action);
  });

  return actionMap;
};

const extractSearchAnalysis = (value: unknown): SearchAnalysis => {
  if (!isRecord(value)) return {};

  const analysis: SearchAnalysis = {};
  if (typeof value.margem === "string") analysis.margem = value.margem;
  if (typeof value.demanda === "string") analysis.demanda = value.demanda;
  if (typeof value.potencial_viral === "string") analysis.potencial_viral = value.potencial_viral;
  if (typeof value.facilidade_venda === "string") analysis.facilidade_venda = value.facilidade_venda;
  if (value.recomendacao === "bom" || value.recomendacao === "mediano" || value.recomendacao === "ruim") {
    analysis.recomendacao = value.recomendacao;
  }

  return analysis;
};

const sentenceChunks = (text: string) => {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (paragraphs.length > 1 || text.length <= 220) return paragraphs.length > 0 ? paragraphs : [text.trim()];

  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((chunk) => chunk.trim()).filter(Boolean) ?? [text.trim()];
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(" "));
  }
  return chunks;
};

const cleanAssistantCopy = (content: string) =>
  content
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();

const splitAssistantHeading = (content: string) => {
  const cleanContent = cleanAssistantCopy(content);
  const questionMatch = cleanContent.match(/^([^?]{4,80}\?)\s+(.+)$/);
  if (questionMatch) {
    return { heading: questionMatch[1], body: questionMatch[2] };
  }

  const colonIndex = cleanContent.indexOf(":");
  if (colonIndex > 0 && colonIndex <= 42) {
    return {
      heading: cleanContent.slice(0, colonIndex + 1),
      body: cleanContent.slice(colonIndex + 1).trim(),
    };
  }

  return { heading: "", body: cleanContent };
};

const isNewProductSearchRequest = (text: string) => {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return [
    /\b(encontre|encontrar|achar|busca|buscar|busque|procure|procurar|descubra|descobrir|mostre|recomende|indique)\b/,
    /\b(ajuda|ajude|preciso)\b.*\b(achar|encontrar|buscar|procurar|descobrir)\b/,
    /\b(outro|outros|outra|outras|alternativa|alternativas|trocar|troque|substituir|substitua)\b.*\b(produto|produtos|opcao|opcoes)\b/,
    /\b(produto|produtos|item|itens|opcao|opcoes)\b.*\b(barato|baratos|margem|viral|virais|estoque|categoria|casa|cozinha|eletronico|eletronicos|moda|pet|bebe|automotivo|decoracao)\b/,
    /\b(item|itens|produto|produtos|algo|coisa|opcao|opcoes)\s+(de|da|do|para)\s+\w+/,
  ].some((pattern) => pattern.test(normalized));
};

const isCasualGreeting = (text: string) => {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return /\b(oi|ola|opa|e ai|tudo bem|bom dia|boa tarde|boa noite|beleza)\b/.test(normalized);
};

const buildLocalProductChatResponse = (text: string, product: SuggestedProduct, userName?: string) => {
  const greetingName = userName && userName !== "Usuario" ? `${userName}, ` : "";
  if (isCasualGreeting(text)) {
    return `${greetingName}tudo bem por aqui. Estou com o ${product.nome} aberto e posso te ajudar a decidir se ele vale teste, como vender, qual público mirar ou que tipo de criativo usar.`;
  }

  const marginText = product.costPrice && product.preco
    ? `A relação entre custo e preço sugerido parece testável, mas eu validaria com orçamento pequeno antes de escalar.`
    : `Eu validaria margem e custo final antes de escalar, porque nem todos os dados financeiros estão completos no catálogo.`;
  const stockText = product.stockQuantity && product.stockQuantity > 0
    ? `O estoque informado é de ${product.stockQuantity} unidades, o que ajuda para um primeiro teste.`
    : `O estoque precisa ser conferido antes de colocar verba maior.`;

  return `${greetingName}sobre o ${product.nome}: ele está na categoria ${product.categoria} e aparece por ${formatPrice(product.preco)}. ${marginText} ${stockText} Se quiser, eu posso analisar público ideal, criativo para TikTok/Reels ou objeções de compra.`;
};

const buildAssistantTextMessages = (content: string, baseId: number): ChatMessage[] =>
  sentenceChunks(cleanAssistantCopy(content))
    .slice(0, 4)
    .map((chunk, index) => ({
      id: `${baseId}-chat-${index}`,
      role: "assistant",
      content: cleanAssistantCopy(chunk),
    }));

const buildSearchAssistantMessages = ({
  baseId,
  products,
  analysis,
}: {
  baseId: number;
  products: SuggestedProduct[];
  analysis: SearchAnalysis;
}): ChatMessage[] => {
  const product = products[0];
  if (!product) {
    return [{
      id: `${baseId}-empty`,
      role: "assistant",
      content: "Não encontrei produtos que atendam exatamente a essa solicitação no catálogo. Que tal tentar outras palavras-chave?",
    }];
  }

  const priceText = formatPrice(product.preco);
  const stockText = product.stockQuantity && product.stockQuantity > 0
    ? `O estoque informado é de ${product.stockQuantity} unidades, então dá para testar sem começar totalmente no escuro.`
    : "O estoque precisa ser validado antes de colocar verba maior, porque esse dado não veio forte no catálogo.";
  const marginText = cleanAssistantCopy(analysis.margem ?? "A margem parece testável, mas eu ainda trataria como validação inicial até ter dados de conversão.");
  const demandText = cleanAssistantCopy(analysis.demanda ?? "A demanda ainda precisa ser provada com criativos e teste de tráfego controlado.");
  const saleText = cleanAssistantCopy(analysis.facilidade_venda ?? "É um produto entendível, com proposta fácil de explicar quando o anúncio mostra claramente o problema que ele resolve.");
  const viralText = cleanAssistantCopy(analysis.potencial_viral ?? "Para TikTok, Reels e Shorts, o potencial depende de demonstração visual: antes/depois, uso rápido e benefício aparecendo nos primeiros segundos.");
  const verdictText = analysis.recomendacao === "bom"
    ? "Meu veredito: é um bom candidato para testar. Eu começaria com orçamento pequeno, criativo demonstrativo e acompanhamento de cliques, salvamentos e custo por intenção."
    : analysis.recomendacao === "ruim"
      ? "Meu veredito: eu não colocaria muito orçamento agora. Só testaria se você tiver um ângulo muito claro ou se quiser validar esse nicho com risco baixo."
      : "Meu veredito: é vendável, mas com ressalvas. Vale testar com verba controlada e comparar contra alternativas do mesmo nicho antes de escalar.";

  return [
    {
      id: `${baseId}-intro`,
      role: "assistant",
      content: `Encontrei uma opção no catálogo que combina com o pedido. Separei a análise em partes para ficar mais fácil decidir.`,
    },
    {
      id: `${baseId}-product`,
      role: "assistant",
      content: "Produto recomendado:",
      product,
      products,
    },
    {
      id: `${baseId}-market`,
      role: "assistant",
      content: `Serve para vender? ${saleText} Com preço de ${priceText} na categoria ${product.categoria}, ele tem mais chance no mercado quando a oferta deixa o benefício claro em poucos segundos.`,
    },
    {
      id: `${baseId}-numbers`,
      role: "assistant",
      content: `Margem, demanda e operação: ${marginText} ${demandText} ${stockText}`,
    },
    {
      id: `${baseId}-viral`,
      role: "assistant",
      content: `TikTok, Reels e anúncios curtos: ${viralText} Eu testaria vídeos com demonstração direta, comparação visual e uma promessa simples de economia de tempo, praticidade ou transformação.`,
    },
    {
      id: `${baseId}-verdict`,
      role: "assistant",
      content: verdictText,
    },
  ];
};

const ProductScoutAI = ({ 
  onResults,
  open: controlledOpen,
  onOpenChange,
  initialPrompt = "",
  initialPromptKey = 0,
  showTriggerButton = true,
  immersive = false
}: ProductScoutAIProps) => {
  const { user } = useAuth();
  const { nome: profileName } = useProfile();
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : localOpen;
  
  const setOpen = (val: boolean) => {
    setLocalOpen(val);
    if (onOpenChange) onOpenChange(val);
  };

  const [busy, setBusy] = useState(false);
  const [chatMode, setChatMode] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [lastSuggestedProducts, setLastSuggestedProducts] = useState<SuggestedProduct[]>([]);
  const [footerInputFocused, setFooterInputFocused] = useState(false);
  const [panelPosition, setPanelPosition] = useState({
    top: 88,
    left: 16,
    width: 620,
    height: 660,
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const nextScrollBehaviorRef = useRef<"top" | "bottom">("bottom");
  const lastInitialPromptRef = useRef("");

  const handleInputChange = (val: string) => {
    setCustomPrompt(val);
  };

  const handleChatInputChange = (val: string) => {
    setChatInput(val);
  };

  const openPanel = () => {
    setOpen(true);
    setChatMode(false);
    setChatMessages([]);
    setChatInput("");
    setCustomPrompt("");
    setLastSuggestedProducts([]);
  };

  const close = useCallback(() => {
    setLocalOpen(false);
    onOpenChange?.(false);
    setChatMode(false);
    setChatMessages([]);
    setBusy(false);

    if (lastSuggestedProducts.length > 0) {
      onResults({
        ids: lastSuggestedProducts.map((product) => product.id),
        label: `Recomendado pelo Aquas: ${lastSuggestedProducts[0].nome}`,
        source: "ai",
      });
    }
  }, [lastSuggestedProducts, onOpenChange, onResults]);

  const executeRealSearch = useCallback(async (text: string) => {
    const cleanText = text.trim();
    if (busy || !cleanText) return;
    setBusy(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: cleanText,
    };

    // Adiciona a mensagem do usuário imediatamente para exibição no chat com o loader
    nextScrollBehaviorRef.current = "bottom";
    setChatMessages((prev) => [...prev, userMsg]);
    setChatMode(true);

    // Formata o histórico anterior (exclui a mensagem do usuário que acabou de ser criada,
    // pois ela será enviada de forma independente no corpo como query da Edge Function)
    const formattedHistory = chatMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      const startTime = Date.now();
      const currentProductId = lastSuggestedProducts[0]?.id ?? null;
      const isNewSearchRequest = isNewProductSearchRequest(cleanText);
      const shouldForceProductChat = chatMode && Boolean(currentProductId) && !isNewSearchRequest;
      const queryForAssistant = shouldForceProductChat
        ? `Continue a conversa sobre o produto atual. Mensagem do usuário: ${cleanText}`
        : cleanText;
      const userName = profileName || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || null;

      const { data, error: invokeError } = await supabase.functions.invoke("atlas-search", {
        body: {
          query: queryForAssistant,
          history: formattedHistory,
          current_product_id: currentProductId,
          exclude_ids: isNewSearchRequest && currentProductId ? [currentProductId] : [],
          force_mode: shouldForceProductChat ? "chat" : isNewSearchRequest ? "search" : undefined,
          user_context: {
            id: user?.id ?? null,
            name: userName,
            email: user?.email ?? null,
          },
        },
      });

      if (invokeError) throw invokeError;

      const responseData = isRecord(data) ? data : {};
      const responseActions = parseChatActions(responseData.actions);
      const productActions = parseProductActions(responseData.product_actions);

      const mode = typeof responseData.mode === "string" ? responseData.mode : "search";
      const aiResponseText = typeof responseData.mensagem === "string" && responseData.mensagem.length > 0
        ? responseData.mensagem
        : (typeof responseData.resposta_chat === "string" && responseData.resposta_chat.length > 0
          ? responseData.resposta_chat
          : "Ok!");

      // Garante ~750ms de "Thinking"
      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 750 - elapsed);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));

      // Modo chat: só responde textualmente, mantém produto atual em contexto
      if (mode === "chat") {
        const aiMessages = buildAssistantTextMessages(aiResponseText, Date.now() + 1);
        if (responseActions.length > 0 && aiMessages.length > 0) {
          aiMessages[aiMessages.length - 1] = {
            ...aiMessages[aiMessages.length - 1],
            actions: responseActions,
          };
        }
        nextScrollBehaviorRef.current = "bottom";
        setChatMessages((prev) => [...prev, ...aiMessages]);
        return;
      }

      if (shouldForceProductChat && lastSuggestedProducts[0]) {
        const aiMessages = buildAssistantTextMessages(
          buildLocalProductChatResponse(cleanText, lastSuggestedProducts[0], userName ?? undefined),
          Date.now() + 1,
        );
        nextScrollBehaviorRef.current = "bottom";
        setChatMessages((prev) => [...prev, ...aiMessages]);
        return;
      }

      // Modo search: busca produtos e monta card
      if ((mode === "navigate" || mode === "diagnose" || mode === "publish_start" || mode === "publish_complete") && responseActions.length > 0) {
        const aiMessages = buildAssistantTextMessages(aiResponseText, Date.now() + 1);
        if (aiMessages.length > 0) {
          aiMessages[aiMessages.length - 1] = {
            ...aiMessages[aiMessages.length - 1],
            actions: responseActions,
          };
        }
        nextScrollBehaviorRef.current = "bottom";
        setChatMessages((prev) => [...prev, ...aiMessages]);
        return;
      }

      const ids = Array.isArray(responseData.ids) ? (responseData.ids as string[]) : [];
      let fetchedProducts: SuggestedProduct[] = [];

      if (ids.length > 0) {
        const orderedIds = ids
          .filter((id): id is string => typeof id === "string")
          .filter((id) => !isNewSearchRequest || id !== currentProductId)
          .slice(0, 6);
        const { data: productsData, error: dbError } = await supabase
          .from("catalog_products")
          .select("id, title, images, cost_price, suggested_price, category, stock_quantity, product_url")
          .in("id", orderedIds);

        if (!dbError && productsData) {
          const productsById = new Map<string, CatalogProductRecord>(
            (productsData as CatalogProductRecord[]).map((product) => [product.id, product])
          );
          fetchedProducts = orderedIds
            .map((productId) => {
              const prodData = productsById.get(productId);
              if (!prodData) return null;

              let imagesArr: string[] = [];
              try {
                const parsedImages =
                  typeof prodData.images === "string" ? JSON.parse(prodData.images) : prodData.images;
                imagesArr = Array.isArray(parsedImages) ? parsedImages.filter(Boolean) : [];
              } catch {
                imagesArr = [];
              }

              return {
                id: prodData.id,
                nome: prodData.title || "Produto sem título",
                categoria: prodData.category || "Geral",
                preco: prodData.suggested_price || prodData.cost_price * 1.5 || 49.9,
                image_url: imagesArr[0] || "",
                images: imagesArr,
                costPrice: prodData.cost_price ?? null,
                suggestedPrice: prodData.suggested_price ?? null,
                stockQuantity: prodData.stock_quantity ?? null,
                catalogoUrl: `/dashboard/catalogo/${prodData.id}`,
                fornecedorUrl: prodData.product_url ?? null,
                publishAction: productActions.get(prodData.id) ?? null,
              } as SuggestedProduct;
            })
            .filter((product): product is SuggestedProduct => product !== null);
        }
      }

      setLastSuggestedProducts(fetchedProducts);
      if (fetchedProducts.length > 0) {
        onResults({
          ids: fetchedProducts.map((product) => product.id),
          label: `Recomendado pelo Aquas: ${fetchedProducts[0].nome}`,
          source: "ai",
        });
      }
      const recommendedProduct = fetchedProducts[0] ?? null;

      const aiMessages = recommendedProduct
        ? buildSearchAssistantMessages({
          baseId: Date.now() + 1,
          products: fetchedProducts,
          analysis: extractSearchAnalysis(responseData.analise),
        })
        : buildAssistantTextMessages(
          aiResponseText || "Não encontrei produtos que atendam exatamente a essa solicitação no catálogo. Que tal tentar outras palavras-chave?",
          Date.now() + 1,
        );

      nextScrollBehaviorRef.current = recommendedProduct ? "top" : "bottom";
      setChatMessages((prev) => [...prev, ...aiMessages]);
    } catch (err) {
      console.error("Erro na busca do Aquas:", err);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Desculpe, tive uma instabilidade de rede ao consultar o catálogo. Poderia tentar novamente?",
      };
      nextScrollBehaviorRef.current = "bottom";
      setChatMessages((prev) => [...prev, aiMsg]);
    } finally {
      setBusy(false);
      setChatInput("");
      setCustomPrompt("");
    }
  }, [busy, chatMessages, chatMode, lastSuggestedProducts, onResults, profileName, user]);

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt || busy) return;
    void executeRealSearch(prompt);
  };

  const handleSendInitialPrompt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = customPrompt.trim();
    if (!prompt || busy) return;
    void executeRealSearch(prompt);
  };

  const handleChipClick = (suggestion: string) => {
    if (busy) return;
    void executeRealSearch(suggestion);
  };

  // Sync initialPrompt when modal is opened programmatically
  useEffect(() => {
    if (!open) {
      lastInitialPromptRef.current = "";
      return;
    }

    const cleanPrompt = initialPrompt.trim();
    const promptSignature = `${initialPromptKey}:${cleanPrompt}`;

    if (cleanPrompt && lastInitialPromptRef.current !== promptSignature) {
      lastInitialPromptRef.current = promptSignature;
      setChatMode(false);
      setChatMessages([]);
      setChatInput("");
      setCustomPrompt(cleanPrompt);
      void executeRealSearch(cleanPrompt);
    }
  }, [executeRealSearch, initialPrompt, initialPromptKey, open]);

  useEffect(() => {
    if (!open) return;

    const updatePanelPosition = () => {
      const sidebar = document.querySelector(".velo-dashboard-sidebar");
      const sidebarRect = sidebar?.getBoundingClientRect();
      const contentLeft = sidebarRect && sidebarRect.width > 0 ? Math.max(0, sidebarRect.right) : 0;
      const availableWidth = Math.max(320, window.innerWidth - contentLeft);
      const horizontalInset = window.innerWidth < 768 ? 12 : immersive ? 48 : 32;
      const maxWidth = immersive ? 1120 : 860;
      const width = Math.max(320, Math.min(maxWidth, availableWidth - horizontalInset));
      const verticalInset = window.innerWidth < 768 ? 18 : immersive ? 42 : 36;
      const maxHeight = Math.max(420, window.innerHeight - verticalInset * 2);
      const height = Math.min(window.innerWidth < 768 ? 640 : immersive ? 820 : 720, maxHeight);
      const top = chatMode || immersive
        ? Math.max(verticalInset, Math.round((window.innerHeight - height) / 2))
        : window.innerWidth < 768 ? 24 : 44;

      setPanelPosition({
        top,
        left: contentLeft + Math.max(horizontalInset / 2, (availableWidth - width) / 2),
        width,
        height,
      });
    };

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, chatMode, immersive]);

  useEffect(() => {
    if (!open) return;
    const focusId = window.requestAnimationFrame(() => {
      footerInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(focusId);
  }, [open, chatMode]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const frameId = window.requestAnimationFrame(() => {
      if (nextScrollBehaviorRef.current === "top") {
        container.scrollTo({ top: 0, behavior: "smooth" });
        if (!busy) nextScrollBehaviorRef.current = "bottom";
        return;
      }

      container.scrollTo({ top: container.scrollHeight, behavior: busy ? "auto" : "smooth" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [chatMessages, busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, close]);

  const renderProductPanel = (products: SuggestedProduct[]) => {
    const primaryProduct = products[0];
    if (!primaryProduct) return null;

    const publishAction = primaryProduct.publishAction;
    const publishTarget = publishAction?.path ?? primaryProduct.catalogoUrl;

    return (
      <div className="mt-3 max-w-[620px] rounded-[18px] border border-white/[0.08] bg-[#202020] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.22)]">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-white/[0.04]">
            {primaryProduct.image_url ? (
              <img src={primaryProduct.image_url} alt={primaryProduct.nome} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="grid h-full w-full place-items-center text-white/30">
                <PackageSearch size={20} strokeWidth={1.5} />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/42">
              Produto recomendado
            </div>
            <div className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-white">
              {primaryProduct.nome}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[12px] text-white/48">
              <span className="truncate">{primaryProduct.categoria}</span>
              <span className="h-1 w-1 rounded-full bg-white/24" />
              <span className="shrink-0 text-white/78">{formatPrice(primaryProduct.preco)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            to={primaryProduct.catalogoUrl}
            onClick={close}
            className="inline-flex h-12 min-w-[190px] items-center justify-center gap-2 rounded-full bg-white px-6 text-[14px] font-semibold tracking-[-0.01em] text-black shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition-all hover:-translate-y-0.5 hover:bg-white/90"
          >
            <Eye size={17} strokeWidth={1.9} />
            Ver no catálogo
          </Link>
          {publishAction ? (
            <Link
              to={publishTarget}
              onClick={close}
              className="inline-flex h-12 min-w-[190px] items-center justify-center gap-2 rounded-full bg-white px-6 text-[14px] font-semibold tracking-[-0.01em] text-black shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition-all hover:-translate-y-0.5 hover:bg-white/90"
            >
              <Sparkles size={17} strokeWidth={1.9} />
              {publishAction.label}
            </Link>
          ) : null}
        </div>
      </div>
    );
  };

  const renderActionButtons = (actions?: ChatAction[]) => {
    if (!actions || actions.length === 0) return null;

    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {actions.map((action, index) => {
          const className = action.variant === "secondary"
            ? "inline-flex h-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.06] px-4 text-[13px] font-semibold text-white/82 transition-all hover:-translate-y-0.5 hover:bg-white/[0.1]"
            : "inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-[13px] font-semibold text-black shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 hover:bg-white/90";

          if (action.path) {
            return (
              <Link
                key={`${action.type}-${action.label}-${index}`}
                to={action.path}
                onClick={close}
                className={className}
              >
                {action.label}
              </Link>
            );
          }

          return (
            <button
              key={`${action.type}-${action.label}-${index}`}
              type="button"
              className={className}
            >
              {action.label}
            </button>
          );
        })}
      </div>
    );
  };

  const modalQuestion = "Que tipo de produto você quer encontrar?";
  const footerValue = chatMode ? chatInput : customPrompt;
  const footerPlaceholder = busy
    ? "Aquas está analisando..."
    : chatMode
      ? "Continue conversando com o Aquas..."
      : modalQuestion;
  const activePromptOptions = INITIAL_SUGGESTIONS;
  const isFooterDisabled = busy || !footerValue.trim();
  const handleFooterSubmit = (event?: React.FormEvent) => {
    if (chatMode) {
      handleSendChat(event);
      return;
    }

    handleSendInitialPrompt(event);
  };

  const handleFooterChange = (value: string) => {
    if (chatMode) {
      handleChatInputChange(value);
      return;
    }

    handleInputChange(value);
  };

  const renderAquasAvatar = (sizeClass = "h-11 w-11", iconSize = 30) => (
    <span
      className={`grid ${sizeClass} shrink-0 place-items-center rounded-full bg-white text-black shadow-[0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.75)]`}
    >
      <AquasIcon size={iconSize} />
    </span>
  );

  const renderQuestionBar = () => (
    <form
      onSubmit={handleFooterSubmit}
      className="flex h-[64px] items-center gap-3 rounded-full bg-[#1e1e1e] px-3.5 pr-5 shadow-[0_18px_44px_rgba(0,0,0,0.28)]"
    >
      {renderAquasAvatar("h-10 w-10", 27)}
      <input
        ref={footerInputRef}
        value={footerValue}
        onChange={(event) => handleFooterChange(event.target.value)}
        onFocus={() => setFooterInputFocused(true)}
        onBlur={() => setFooterInputFocused(false)}
        placeholder={footerPlaceholder}
        disabled={busy}
        className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-medium tracking-[-0.02em] text-white outline-none placeholder:text-white/48 disabled:cursor-wait"
      />
      <button
        type="submit"
        disabled={isFooterDisabled}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black shadow-[0_12px_28px_rgba(0,0,0,0.25)] transition-all hover:scale-[1.03] disabled:pointer-events-none disabled:scale-100 disabled:opacity-0"
        aria-label="Enviar resposta para o Aquas"
      >
        <ArrowUp size={16} strokeWidth={1.9} />
      </button>
    </form>
  );

  const renderAnswerContent = () => (
    <>
      <div className="flex items-center gap-3 px-1 pb-3">
        {renderAquasAvatar("h-10 w-10", 27)}
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-[-0.02em] text-white/86">
          {modalQuestion}
        </span>
        <button
          type="button"
          onClick={close}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/42 transition-colors hover:bg-white/[0.07] hover:text-white/72"
          aria-label="Fechar Aquas"
        >
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>

      <div
        className="flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          WebkitMaskImage: "linear-gradient(90deg, #000 0%, #000 calc(100% - 52px), transparent 100%)",
          maskImage: "linear-gradient(90deg, #000 0%, #000 calc(100% - 52px), transparent 100%)",
        }}
      >
        {busy ? (
          <span className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#3e3e3e] px-4 text-[13px] font-semibold text-white/64">
            <span className="aquas-shimmer h-1.5 w-1.5 rounded-full" />
            Buscando no catálogo...
          </span>
        ) : (
          activePromptOptions.map((option) => (
            <button
              key={`${chatMode ? "quick" : "initial"}-${option.label}`}
              type="button"
              onClick={() => handleChipClick(option.value)}
              className="inline-flex h-10 max-w-[280px] shrink-0 items-center rounded-full bg-[#3e3e3e] px-4 text-[13px] font-semibold tracking-[-0.01em] text-white/78 transition-colors hover:bg-[#484848] hover:text-white"
            >
              <span className="truncate">{option.label}</span>
            </button>
          ))
        )}
      </div>
    </>
  );

  const renderMessageText = (msg: ChatMessage) => {
    const cleanContent = cleanAssistantCopy(msg.content);
    if (!cleanContent) return null;

    if (msg.role === "user") {
      return (
        <div className="whitespace-pre-line rounded-[18px] bg-white/[0.08] px-4 py-3 text-[14px] leading-relaxed tracking-[-0.01em] text-white">
          {cleanContent}
        </div>
      );
    }

    const { heading, body } = splitAssistantHeading(cleanContent);

    return (
      <div className="whitespace-pre-line text-[14px] leading-relaxed tracking-[-0.01em] text-white/88">
        {heading ? (
          <>
            <div className="mb-1 text-[14px] font-semibold tracking-[-0.01em] text-white/92">
              {heading.replace(/:$/, "")}
            </div>
            {body ? <div className="max-w-[760px] text-white/86">{body}</div> : null}
          </>
        ) : (
          <div className="max-w-[760px] text-white/86">{body}</div>
        )}
      </div>
    );
  };

  const renderChatContent = () => (
    <>
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {renderAquasAvatar("h-9 w-9", 25)}
          <div className="min-w-0">
            <div className="text-[14px] font-semibold tracking-[-0.02em] text-white">Aquas</div>
            <div className="text-[12px] text-white/42">Conversa sobre produto</div>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/42 transition-colors hover:bg-white/[0.07] hover:text-white/72"
          aria-label="Fechar Aquas"
        >
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>

      <div
        ref={chatContainerRef}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10"
      >
        <div>
          {chatMessages.map((msg, index) => {
            const previousMessage = chatMessages[index - 1];
            const isAssistantContinuation = msg.role === "assistant" && previousMessage?.role === "assistant";
            const spacingClass = index === 0 ? "" : isAssistantContinuation ? "mt-2" : "mt-5";

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${spacingClass} ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant"
                  ? isAssistantContinuation
                    ? <span className="h-8 w-8 shrink-0" aria-hidden="true" />
                    : renderAquasAvatar("h-8 w-8", 23)
                  : null}
                <div className={`min-w-0 ${msg.role === "user" ? "max-w-[78%]" : "max-w-[86%]"}`}>
                  {renderMessageText(msg)}
                  {msg.role === "assistant" && msg.products && msg.products.length > 0
                    ? renderProductPanel(msg.products)
                    : null}
                  {msg.role === "assistant" ? renderActionButtons(msg.actions) : null}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="flex items-center gap-3">
              {renderAquasAvatar("h-8 w-8", 23)}
              <div className="inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.07] px-4 text-[13px] font-medium text-white/54">
                <span className="aquas-shimmer h-1.5 w-1.5 rounded-full" />
                Analisando o catálogo...
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/[0.06] bg-[#1b1b1b] px-4 pb-4 pt-4">
        <form
          onSubmit={handleFooterSubmit}
          className="rounded-[20px] border border-white/[0.08] bg-[#2c2c2c] px-4 pb-3 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          style={{
            boxShadow: footerInputFocused
              ? "0 0 0 1px rgba(255,255,255,0.14), inset 0 1px 0 rgba(255,255,255,0.04)"
              : "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <input
            ref={footerInputRef}
            value={footerValue}
            onChange={(event) => handleFooterChange(event.target.value)}
            onFocus={() => setFooterInputFocused(true)}
            onBlur={() => setFooterInputFocused(false)}
            placeholder={footerPlaceholder}
            disabled={busy}
            className="mb-5 h-6 w-full bg-transparent text-[15px] font-medium text-white outline-none placeholder:text-white/34 disabled:cursor-wait"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/62 transition-colors hover:bg-white/[0.08] hover:text-white"
              aria-label="Adicionar contexto"
            >
              <Plus size={20} strokeWidth={1.7} />
            </button>
            <button
              type="button"
              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full px-2.5 text-[13px] font-medium text-white/58 transition-colors hover:bg-white/[0.08] hover:text-white/76"
              aria-label="Modo de análise"
            >
              <Sparkles size={15} strokeWidth={1.7} />
              Pedir análise
              <ChevronDown size={14} strokeWidth={1.8} />
            </button>
            <div className="flex-1" />
            <button
              type="button"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/52 transition-colors hover:bg-white/[0.08] hover:text-white/78"
              aria-label="Usar voz"
            >
              <Mic size={16} strokeWidth={1.7} />
            </button>
            <button
              type="submit"
              disabled={isFooterDisabled}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-black shadow-[0_8px_18px_rgba(0,0,0,0.18)] transition-transform hover:scale-[1.03] disabled:scale-100 disabled:bg-white/24 disabled:text-white/34"
              aria-label="Enviar mensagem para o Aquas"
            >
              <ArrowUp size={17} strokeWidth={1.9} />
            </button>
          </div>
        </form>
      </div>
    </>
  );

  const renderResponseSurface = () => (
    <motion.div
      layout
      initial={false}
      animate={{
        height: chatMode ? panelPosition.height : 128,
        borderRadius: chatMode ? 28 : 26,
        backgroundColor: chatMode ? "#171717" : "#2c2c2c",
        borderColor: chatMode ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0)",
      }}
      transition={{
        height: { duration: 0.78, ease: [0.22, 1, 0.36, 1] },
        borderRadius: { duration: 0.62, ease: [0.22, 1, 0.36, 1] },
        backgroundColor: { duration: 0.34, ease: "easeOut" },
        borderColor: { duration: 0.34, ease: "easeOut" },
      }}
      className="relative overflow-hidden border shadow-[0_28px_84px_rgba(0,0,0,0.46)]"
      style={{ maxHeight: panelPosition.height }}
    >
      <AnimatePresence initial={false}>
        {!chatMode && (
          <motion.div
            key="aquas-answer-content"
            className="absolute inset-0 px-3.5 py-3.5"
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {renderAnswerContent()}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {chatMode && (
          <motion.div
            key="aquas-chat-content"
            className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 8, filter: "blur(8px)" }}
            transition={{ delay: 0.2, duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
          >
            {renderChatContent()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  return (
    <>
      <Styles />
      {showTriggerButton && (
        <button
          ref={triggerButtonRef}
          type="button"
          onClick={openPanel}
          disabled={busy}
          data-dashboard-tour="catalogo-atlas"
          className="group inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-[#050505] px-5 text-[13px] font-semibold tracking-[-0.01em] text-white shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.09)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-black disabled:cursor-wait disabled:opacity-70"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full text-white transition-transform duration-300 group-hover:-rotate-12">
            <AquasIcon size={24} inverted />
          </span>
          Aquas
        </button>
      )}

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  key="atlas-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={close}
                  className={`fixed inset-0 z-[110] pointer-events-auto ${immersive ? "bg-black/20 backdrop-blur-[2px]" : "bg-transparent"}`}
                />

                <motion.div
                  key="atlas-shell"
                  layout
                  className="fixed z-[120] text-white"
                  style={{
                    top: panelPosition.top,
                    left: panelPosition.left,
                    width: panelPosition.width,
                    transformOrigin: "top",
                  }}
                  initial={{ opacity: 0, y: -18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{
                    duration: 0.38,
                    ease: [0.16, 1, 0.3, 1],
                    layout: { duration: 0.68, ease: [0.22, 1, 0.36, 1] },
                  }}
                >
                  <div className="pointer-events-auto">
                    <div className="flex flex-col gap-3.5">
                      <AnimatePresence initial={false}>
                        {!chatMode && (
                          <motion.div
                            key="aquas-question-bar"
                            layout
                            initial={{ opacity: 0, y: -18, filter: "blur(6px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -10, filter: "blur(8px)", height: 0, marginBottom: -14 }}
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                          >
                            {renderQuestionBar()}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {renderResponseSurface()}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
};

export default ProductScoutAI;
