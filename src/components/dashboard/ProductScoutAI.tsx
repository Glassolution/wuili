import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Lightbulb, Plus, Search, Square, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type CatalogProduct = Database["public"]["Tables"]["catalog_products"]["Row"];

type RankedProduct = CatalogProduct & {
  image: string | null;
  imageCount: number;
  score: number;
};

type ScoutAnalysis = {
  summary: string;
  whyBest: string;
  viralPotential: string;
  tiktokAngle: string;
  marketReading: string;
};

type ScoutChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ProductScoutAIProps = {
  onOpenProduct: (productId: string) => void;
};

const stages = [
  { title: "Encontrando produto", detail: "Analisando catálogo" },
  { title: "Filtrando estoque", detail: "Checando disponibilidade" },
  { title: "Calculando margem", detail: "Comparando preço e lucro" },
  { title: "Lendo sinais", detail: "Observando pedidos e imagens" },
  { title: "Preparando resultado", detail: "Escolhendo a melhor oportunidade" },
];

const scoutPreferences = [
  {
    id: "viral",
    label: "Produto para viralizar",
    hint: "produto com apelo visual, demonstração rápida e bom potencial para vídeos curtos",
  },
  {
    id: "margin",
    label: "Maior margem",
    hint: "produto com melhor relação entre custo, preço sugerido e lucro estimado",
  },
  {
    id: "stock",
    label: "Estoque alto",
    hint: "produto com disponibilidade mais segura para testar sem ruptura",
  },
  {
    id: "entry",
    label: "Preço baixo",
    hint: "produto barato, simples de comprar por impulso e fácil de anunciar",
  },
] as const;

const followUpPrompts = [
  "Como vender esse produto no TikTok?",
  "Qual preço eu deveria testar?",
  "Quais são os riscos desse produto?",
  "Crie um roteiro curto de anúncio",
] as const;

type ScoutPreferenceId = (typeof scoutPreferences)[number]["id"];
type ScoutPreference = (typeof scoutPreferences)[number];
type ScoutRequest = {
  id: ScoutPreferenceId | "custom";
  label: string;
  hint: string;
};

const wait = (duration: number) => new Promise<void>((resolve) => window.setTimeout(resolve, duration));

const getImages = (images: Json | null): string[] => {
  if (!images) return [];
  if (Array.isArray(images)) return images.filter((value): value is string => typeof value === "string");

  if (typeof images === "string") {
    try {
      const parsed: unknown = JSON.parse(images);
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [images];
    } catch {
      return [images];
    }
  }

  return [];
};

const normalize = (value: number, max: number) => Math.min(Math.max(value / max, 0), 1);

const rankProduct = (product: CatalogProduct): RankedProduct => {
  const images = getImages(product.images);
  const marginScore = normalize(product.margin_percent || 0, 100) * 28;
  const orderScore = normalize(Math.log10((product.orders_count || 0) + 1), 3) * 24;
  const ratingScore = normalize(product.rating || 0, 5) * 16;
  const stockScore = normalize(Math.log10((product.stock_quantity || 0) + 1), 3) * 14;
  const visualScore = normalize(images.length, 6) * 12;
  const priceScore = product.suggested_price >= 35 && product.suggested_price <= 250 ? 6 : 2;

  return {
    ...product,
    image: images[0] ?? null,
    imageCount: images.length,
    score: Math.round((marginScore + orderScore + ratingScore + stockScore + visualScore + priceScore) * 10) / 10,
  };
};

const preferenceBoost = (product: RankedProduct, preferenceId?: ScoutPreferenceId) => {
  if (!preferenceId) return 0;

  if (preferenceId === "margin") return normalize(product.margin_percent || 0, 100) * 18;
  if (preferenceId === "stock") return normalize(Math.log10((product.stock_quantity || 0) + 1), 3) * 18;
  if (preferenceId === "entry") return product.suggested_price <= 80 ? 18 : product.suggested_price <= 150 ? 10 : 0;
  if (preferenceId === "viral") return normalize(product.imageCount, 6) * 10 + normalize(product.rating || 0, 5) * 8;

  return 0;
};

const fallbackAnalysis = (product: RankedProduct): ScoutAnalysis => ({
  summary: `${product.title} reuniu o melhor equilíbrio entre margem, disponibilidade, histórico de pedidos e material visual entre os itens analisados.`,
  whyBest: `O produto tem margem de ${Math.round(product.margin_percent || 0)}%, ${product.stock_quantity || 0} unidades disponíveis e ${product.orders_count || 0} pedidos registrados no catálogo.`,
  viralPotential: `A inferência de potencial vem da combinação de ${product.imageCount} imagens, apelo demonstrável e preço sugerido de ${formatBRL(product.suggested_price)}. Isso favorece vídeos curtos de problema e solução, mas não representa dados ao vivo do TikTok.`,
  tiktokAngle: "Abra com o problema em dois segundos, mostre o produto funcionando em close e finalize comparando o antes e depois com uma chamada simples para conhecer a oferta.",
  marketReading: `Dentro do catálogo Velo, o item apresenta nota ${product.rating?.toFixed(1) ?? "não informada"} e score interno ${product.score}/100. A leitura é comparativa e considera somente os dados disponíveis agora.`,
});

const buildInitialChat = (product: RankedProduct, analysis: ScoutAnalysis, preference: ScoutRequest | null): ScoutChatMessage[] => [
  {
    id: "initial-user",
    role: "user",
    content: preference ? `Quero encontrar: ${preference.label}` : "Quero encontrar um bom produto para vender.",
  },
  {
    id: "initial-assistant-summary",
    role: "assistant",
    content: `Encontrei ${product.title}. ${analysis.summary}`,
  },
  {
    id: "initial-assistant-reading",
    role: "assistant",
    content: `${analysis.whyBest}\n\nPotencial de vídeo: ${analysis.tiktokAngle}`,
  },
];

const followUpFallback = (question: string, product: RankedProduct, analysis: ScoutAnalysis) => {
  const lowerQuestion = question.toLowerCase();

  if (lowerQuestion.includes("preço") || lowerQuestion.includes("margem")) {
    return `Eu testaria a partir de ${formatBRL(product.suggested_price)} e observaria resposta antes de subir preço. O custo está em ${formatBRL(product.cost_price)}, com margem informada de ${Math.round(product.margin_percent || 0)}%, então ainda existe espaço para ajustar sem perder competitividade.`;
  }

  if (lowerQuestion.includes("tiktok") || lowerQuestion.includes("vídeo") || lowerQuestion.includes("video") || lowerQuestion.includes("anúncio")) {
    return analysis.tiktokAngle;
  }

  if (lowerQuestion.includes("risco") || lowerQuestion.includes("problema")) {
    return `O principal cuidado é validar entrega e estoque antes de escalar. Hoje o catálogo mostra ${product.stock_quantity || 0} unidades e ${product.orders_count || 0} pedidos, então eu começaria com teste pequeno e criativo simples antes de investir pesado.`;
  }

  return `${analysis.marketReading} Para continuar, eu olharia primeiro preço, estoque e qualidade das imagens, porque esses três pontos dizem se vale testar o produto rápido ou guardar para depois.`;
};

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parseAnalysis = (raw: string, fallback: ScoutAnalysis): ScoutAnalysis => {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<ScoutAnalysis>;
    return {
      summary: parsed.summary?.trim() || fallback.summary,
      whyBest: parsed.whyBest?.trim() || fallback.whyBest,
      viralPotential: parsed.viralPotential?.trim() || fallback.viralPotential,
      tiktokAngle: parsed.tiktokAngle?.trim() || fallback.tiktokAngle,
      marketReading: parsed.marketReading?.trim() || fallback.marketReading,
    };
  } catch {
    return fallback;
  }
};

const playSoftChime = () => {
  try {
    const AudioContextClass = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.75);

    [392, 523.25].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.detune.setValueAtTime(index * 3, context.currentTime);
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.07);
      oscillator.stop(context.currentTime + 0.78);
    });

    window.setTimeout(() => void context.close(), 900);
  } catch {
    // Audio feedback is an enhancement; the discovery flow must never depend on it.
  }
};

const VeloOrb = ({ active = false }: { active?: boolean }) => (
  <span className="relative grid h-11 w-11 shrink-0 place-items-center">
    <motion.span
      className="absolute h-10 w-10 rounded-full bg-emerald-400/40 blur-md"
      animate={active ? { opacity: [0.35, 0.9, 0.35], scale: [0.9, 1.12, 0.9] } : { opacity: 0.7, scale: 1 }}
      transition={{ duration: 1.55, repeat: active ? Infinity : 0, ease: "easeInOut" }}
    />
    <motion.span
      className="relative h-8 w-8 rounded-full bg-[radial-gradient(circle_at_32%_24%,#eaffde_0%,#7cff74_30%,#04c83b_58%,#01831f_100%)] shadow-[inset_-5px_-7px_12px_rgba(0,0,0,0.24),inset_4px_4px_10px_rgba(255,255,255,0.48),0_0_18px_rgba(27,255,86,0.34)]"
      animate={active ? { rotate: [0, 8, -6, 0], scale: [1, 1.04, 1] } : { rotate: 0, scale: 1 }}
      transition={{ duration: 1.9, repeat: active ? Infinity : 0, ease: "easeInOut" }}
    />
  </span>
);

const SaturnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-[18px] w-[18px]">
    <circle cx="12" cy="12" r="4.8" stroke="currentColor" strokeWidth="2" />
    <path
      d="M3.2 15.2c2.5 1.8 7.5 2 12.1.5 4.6-1.5 7.2-4.1 6.5-5.9-.4-1.2-2-1.8-4.1-1.8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M20.8 8.8c-2.5-1.8-7.5-2-12.1-.5-4.6 1.5-7.2 4.1-6.5 5.9.4 1.2 2 1.8 4.1 1.8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.78"
    />
  </svg>
);

const resultReveal = {
  hidden: { opacity: 0, y: 24, scale: 0.985, filter: "blur(14px)" },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { delay, duration: 0.82, ease: [0.16, 1, 0.3, 1] },
  }),
};

const ProductScoutAI = ({ onOpenProduct }: ProductScoutAIProps) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "complete" | "error">("idle");
  const [stage, setStage] = useState(0);
  const [product, setProduct] = useState<RankedProduct | null>(null);
  const [analysis, setAnalysis] = useState<ScoutAnalysis | null>(null);
  const [selectedPreference, setSelectedPreference] = useState<ScoutRequest | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [chatMessages, setChatMessages] = useState<ScoutChatMessage[]>([]);
  const [chatSending, setChatSending] = useState(false);
  const runRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    runRef.current += 1;
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages.length, chatSending]);

  const openPreferences = () => {
    playSoftChime();
    setOpen(true);
    setStatus("idle");
    setStage(0);
    setProduct(null);
    setAnalysis(null);
    setSelectedPreference(null);
    setCustomPrompt("");
    setChatMessages([]);
    setChatSending(false);
  };

  const runScout = async (preference: ScoutRequest) => {
    const runId = ++runRef.current;
    playSoftChime();
    setOpen(true);
    setStatus("running");
    setStage(0);
    setProduct(null);
    setAnalysis(null);
    setSelectedPreference(preference);
    setChatMessages([
      {
        id: `user-${runId}`,
        role: "user",
        content: `Quero encontrar: ${preference.label}`,
      },
    ]);
    setChatSending(false);
    setCustomPrompt("");

    try {
      const catalogPromise = supabase
        .from("catalog_products")
        .select("*")
        .eq("is_blocked", false)
        .eq("is_active", true)
        .gt("stock_quantity", 0)
        .limit(200);

      for (let current = 0; current < 4; current += 1) {
        if (runId !== runRef.current) return;
        setStage(current);
        await wait(620);
      }

      const { data, error } = await catalogPromise;
      if (error) throw error;
      if (!data?.length) throw new Error("Nenhum produto disponível foi encontrado agora.");

      const ranked = data
        .map(rankProduct)
        .sort((a, b) => {
          const boostA = preference.id === "custom" ? 0 : preferenceBoost(a, preference.id);
          const boostB = preference.id === "custom" ? 0 : preferenceBoost(b, preference.id);
          return (b.score + boostB) - (a.score + boostA);
        });
      const winner = ranked[0];
      const finalists = ranked.slice(0, 5);
      const fallback = fallbackAnalysis(winner);

      setProduct(winner);
      setStage(4);

      const facts = finalists.map((item, index) => ({
        position: index + 1,
        id: item.id,
        title: item.title,
        category: item.category,
        cost_price: item.cost_price,
        suggested_price: item.suggested_price,
        margin_percent: item.margin_percent,
        stock_quantity: item.stock_quantity,
        orders_count: item.orders_count,
        rating: item.rating,
        image_count: item.imageCount,
        internal_score: item.score,
        description: item.description?.slice(0, 500) || null,
      }));

      let resolvedAnalysis = fallback;
      try {
        const { data: aiData, error: aiError } = await supabase.functions.invoke("chat", {
          body: {
            mode: "product_description",
            messages: [{
              role: "user",
              content: `Você é a IA de descoberta de produtos da Velo. Analise SOMENTE os fatos reais abaixo. O usuário pediu: ${preference.hint}. O primeiro item venceu um ranking de margem, estoque, pedidos, avaliação, imagens, preço e preferência escolhida. Não alegue acesso a tendências ao vivo, volume de busca ou dados externos. Explique em português brasileiro, de forma direta, por que ele é a melhor oportunidade e qual roteiro de TikTok demonstra melhor o produto. O potencial viral deve ser apresentado explicitamente como inferência. Retorne SOMENTE JSON válido com as chaves summary, whyBest, viralPotential, tiktokAngle e marketReading. Cada valor deve ter no máximo 320 caracteres.\n\nFATOS:\n${JSON.stringify(facts)}`,
            }],
          },
        });

        if (!aiError && typeof aiData?.response === "string") {
          resolvedAnalysis = parseAnalysis(aiData.response, fallback);
        }
      } catch {
        resolvedAnalysis = fallback;
      }

      await wait(700);
      if (runId !== runRef.current) return;
      setAnalysis(resolvedAnalysis);
      setChatMessages(buildInitialChat(winner, resolvedAnalysis, preference));
      setStatus("complete");
      playSoftChime();
    } catch (error) {
      if (runId !== runRef.current) return;
      setStatus("error");
      setAnalysis({
        summary: error instanceof Error ? error.message : "Não foi possível concluir a análise agora.",
        whyBest: "Tente novamente em alguns instantes.",
        viralPotential: "",
        tiktokAngle: "",
        marketReading: "",
      });
    }
  };

  const close = () => {
    runRef.current += 1;
    setOpen(false);
    window.setTimeout(() => setStatus("idle"), 260);
  };

  const submitCustomPrompt = () => {
    const cleanPrompt = customPrompt.trim();
    if (!cleanPrompt) return;

    if (status === "complete" && product && analysis) {
      void answerFollowUp(cleanPrompt);
      return;
    }

    void runScout({
      id: "custom",
      label: cleanPrompt,
      hint: `pedido livre do usuário: "${cleanPrompt}"`,
    });
  };

  const answerFollowUp = async (questionText: string) => {
    if (!product || !analysis || chatSending) return;

    const cleanQuestion = questionText.trim();
    if (!cleanQuestion) return;

    const userMessage: ScoutChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: cleanQuestion,
    };

    setChatMessages((currentMessages) => [...currentMessages, userMessage]);
    setCustomPrompt("");
    setChatSending(true);

    const fallback = followUpFallback(cleanQuestion, product, analysis);

    try {
      const facts = {
        title: product.title,
        category: product.category,
        cost_price: product.cost_price,
        suggested_price: product.suggested_price,
        margin_percent: product.margin_percent,
        stock_quantity: product.stock_quantity,
        orders_count: product.orders_count,
        rating: product.rating,
        internal_score: product.score,
        analysis,
      };

      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          mode: "product_description",
          messages: [{
            role: "user",
            content: `Você é o Atlas, IA de produto da Velo. Responda em português brasileiro, com tom direto e útil. Use SOMENTE os fatos reais abaixo e a análise já feita. Não alegue dados externos, tendências ao vivo ou volume de busca. Responda à pergunta do usuário em até 520 caracteres.\n\nPERGUNTA DO USUÁRIO:\n${cleanQuestion}\n\nFATOS DO PRODUTO:\n${JSON.stringify(facts)}`,
          }],
        },
      });

      const response = !error && typeof data?.response === "string" && data.response.trim()
        ? data.response.trim()
        : fallback;

      setChatMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response,
        },
      ]);
    } catch {
      setChatMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: fallback,
        },
      ]);
    } finally {
      setChatSending(false);
    }
  };

  const question = "Que tipo de produto você quer encontrar hoje?";
  const title =
    status === "complete"
      ? `Resultado para ${selectedPreference?.label.toLowerCase() ?? "sua busca"}`
      : status === "error"
        ? "Não consegui concluir"
        : status === "running"
          ? stages[stage].title
          : question;

  const content = (
    <>
      <button
        type="button"
        onClick={openPreferences}
        disabled={status === "running"}
        className="group inline-flex h-12 items-center gap-3 rounded-full border border-white/10 bg-[#050505] px-6 text-[14px] font-semibold tracking-[-0.01em] text-white shadow-[0_14px_30px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.09)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_18px_38px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.12)] disabled:cursor-wait disabled:opacity-70"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full text-white transition-transform duration-300 group-hover:-rotate-12">
          <SaturnIcon />
        </span>
        Atlas
      </button>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="velo-product-scout-shell"
              className="fixed inset-x-0 top-5 z-[120] pointer-events-none px-4 text-white"
              initial={{ opacity: 0, y: -18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mx-auto w-[min(100%,680px)] space-y-3">
                <motion.form
                  aria-label="Chat do Atlas"
                  className="pointer-events-auto flex h-[74px] items-center gap-3 rounded-full border border-white/10 bg-[#242424] px-3 shadow-[0_18px_48px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.08)]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitCustomPrompt();
                  }}
                  layout
                >
                  <VeloOrb active={status === "running" || chatSending} />
                  <input
                    value={customPrompt}
                    onChange={(event) => setCustomPrompt(event.target.value)}
                    disabled={status === "running" || chatSending}
                    placeholder={status === "complete" ? "Pergunte sobre margem, TikTok, riscos ou anúncio..." : "Digite o produto, nicho ou estilo que você quer vender..."}
                    className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-white outline-none placeholder:text-white/38 disabled:cursor-wait"
                  />
                  <button
                    type="submit"
                    disabled={!customPrompt.trim() || status === "running" || chatSending}
                    className="hidden h-10 rounded-full bg-white px-4 text-[12px] font-semibold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-35 sm:inline-flex sm:items-center"
                  >
                    {status === "complete" ? "Enviar" : "Buscar"}
                  </button>
                </motion.form>

                <motion.aside
                  aria-live="polite"
                  className={`pointer-events-auto relative overflow-hidden border border-white/10 shadow-[0_22px_60px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.08)] ${
                    status === "complete"
                      ? "rounded-[34px] bg-[radial-gradient(circle_at_50%_0%,#191b1f_0%,#0d0f12_38%,#050505_100%)]"
                      : "rounded-[22px] bg-[#242424]"
                  }`}
                  layout
                  transition={{ layout: { duration: 0.96, ease: [0.16, 1, 0.3, 1] } }}
                >
                  <div className={`${status === "complete" ? "relative px-4 pb-4 pt-3 sm:px-5" : "relative px-3 py-3"}`}>
                    {status === "complete" && (
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="absolute inset-x-0 bottom-0 h-52 bg-[radial-gradient(circle_at_50%_100%,rgba(64,95,145,0.28)_0%,rgba(64,95,145,0.10)_42%,transparent_76%)]" />
                        <div className="absolute left-1/2 top-[74px] -translate-x-1/2 text-white/[0.055]">
                          <svg width="92" height="92" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="12" cy="12" r="4.8" stroke="currentColor" strokeWidth="1.8" />
                            <path
                              d="M3.2 15.2c2.5 1.8 7.5 2 12.1.5 4.6-1.5 7.2-4.1 6.5-5.9-.4-1.2-2-1.8-4.1-1.8"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                            <path
                              d="M20.8 8.8c-2.5-1.8-7.5-2-12.1-.5-4.6 1.5-7.2 4.1-6.5 5.9.4 1.2 2 1.8 4.1 1.8"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              opacity="0.78"
                            />
                          </svg>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <VeloOrb active={status === "running"} />
                      <div className="min-w-0 flex-1">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={`${status}-${stage}`}
                            initial={{ opacity: 0, y: 5, filter: "blur(3px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -5, filter: "blur(3px)" }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            className="min-w-0"
                          >
                            <h2 className={`truncate text-[14px] font-medium tracking-[-0.01em] ${status === "idle" ? "text-white/84" : "text-white"}`}>
                              {title}
                            </h2>
                            {status === "running" && (
                              <p className="mt-1 truncate text-[12px] text-white/38">
                                Preferência: {selectedPreference?.label ?? "produto ideal"}
                              </p>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {status !== "running" && (
                        <button
                          type="button"
                          onClick={close}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/32 transition-colors hover:bg-white/10 hover:text-white"
                          aria-label="Fechar Atlas"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    {status === "idle" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {scoutPreferences.map((preference) => (
                          <button
                            key={preference.id}
                            type="button"
                            onClick={() => void runScout(preference)}
                            className="shrink-0 rounded-full bg-white/[0.075] px-3.5 py-2 text-[12px] font-medium text-white/84 transition-colors hover:bg-white/[0.13] hover:text-white"
                          >
                            {preference.label}
                          </button>
                        ))}
                      </motion.div>
                    )}

                    {status === "complete" && product && analysis && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -8 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        transition={{
                          height: { duration: 1.05, ease: [0.16, 1, 0.3, 1] },
                          opacity: { duration: 0.42 },
                          y: { duration: 0.74, ease: [0.16, 1, 0.3, 1] },
                        }}
                        className="relative mt-3 min-h-[540px] overflow-hidden border-t border-white/10 pt-4"
                      >
                        <motion.div
                          variants={resultReveal}
                          initial="hidden"
                          animate="show"
                          custom={0.36}
                          className="rounded-[28px] border border-white/10 bg-white/[0.06] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
                        >
                          <div className="flex items-center gap-3">
                            {product.image && (
                              <motion.div
                                variants={resultReveal}
                                initial="hidden"
                                animate="show"
                                custom={0.54}
                                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[24px] bg-white"
                              >
                                <img
                                  src={product.image}
                                  alt={product.title}
                                  className="h-full w-full object-cover"
                                />
                              </motion.div>
                            )}
                            <motion.div
                              variants={resultReveal}
                              initial="hidden"
                              animate="show"
                              custom={0.72}
                              className="min-w-0 flex-1"
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/34">
                                Produto encontrado
                              </p>
                              <h3 className="mt-1 line-clamp-2 text-[13px] font-semibold leading-4 text-white">
                                {product.title}
                              </h3>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/48">
                                <span>{formatBRL(product.suggested_price)}</span>
                                <span className="h-1 w-1 rounded-full bg-white/24" />
                                <span>{Math.round(product.margin_percent || 0)}% margem</span>
                                <span className="h-1 w-1 rounded-full bg-white/24" />
                                <span>{product.stock_quantity || 0} em estoque</span>
                              </div>
                            </motion.div>
                            <motion.button
                              type="button"
                              onClick={() => { close(); onOpenProduct(product.id); }}
                              variants={resultReveal}
                              initial="hidden"
                              animate="show"
                              custom={0.94}
                              className="hidden h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-3.5 text-[11px] font-semibold text-black transition-colors hover:bg-white/88 sm:inline-flex"
                            >
                              Abrir <ArrowRight size={14} />
                            </motion.button>
                          </div>
                        </motion.div>

                        <div className="mt-3 max-h-[310px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {chatMessages.map((message, index) => (
                            <motion.div
                              key={message.id}
                              variants={resultReveal}
                              initial="hidden"
                              animate="show"
                              custom={1.18 + index * 0.24}
                              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[84%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[12px] leading-5 ${
                                  message.role === "user"
                                    ? "bg-white text-black shadow-[0_10px_24px_rgba(255,255,255,0.08)]"
                                    : "bg-white/[0.085] text-white/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                                }`}
                              >
                                {message.content}
                              </div>
                            </motion.div>
                          ))}

                          {chatSending && (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex justify-start"
                            >
                              <div className="flex items-center gap-2 rounded-2xl bg-white/[0.075] px-3.5 py-2.5 text-[12px] text-white/52">
                                <span className="flex gap-1">
                                  {[0, 1, 2].map((dot) => (
                                    <motion.span
                                      key={dot}
                                      className="h-1.5 w-1.5 rounded-full bg-white/54"
                                      animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                                      transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.12 }}
                                    />
                                  ))}
                                </span>
                                Atlas pensando
                              </div>
                            </motion.div>
                          )}
                          <div ref={chatEndRef} />
                        </div>

                        <motion.div
                          variants={resultReveal}
                          initial="hidden"
                          animate="show"
                          custom={2.1}
                          className="mt-3 border-t border-white/10 pt-3"
                        >
                          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                            Continue perguntando
                          </p>
                          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {followUpPrompts.map((prompt) => (
                              <button
                                key={prompt}
                                type="button"
                                disabled={chatSending}
                                onClick={() => void answerFollowUp(prompt)}
                              className="shrink-0 rounded-full bg-white/[0.075] px-3.5 py-2 text-[12px] font-medium text-white/78 transition-colors hover:bg-white/[0.13] hover:text-white disabled:cursor-wait disabled:opacity-45"
                            >
                              {prompt}
                              </button>
                            ))}
                          </div>

                          <form
                            aria-label="Perguntar ao Atlas sobre o produto"
                            className="mt-3 overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(72,92,151,0.30),rgba(35,43,55,0.68)_48%,rgba(18,86,79,0.32))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_18px_44px_rgba(0,0,0,0.22)] backdrop-blur-2xl"
                            onSubmit={(event) => {
                              event.preventDefault();
                              submitCustomPrompt();
                            }}
                          >
                            <div className="px-2 pb-2 pt-1">
                              <input
                                value={customPrompt}
                                onChange={(event) => setCustomPrompt(event.target.value)}
                                disabled={chatSending}
                                placeholder={chatSending ? "Atlas pensando..." : "Pergunte qualquer coisa sobre este produto"}
                                className="h-8 w-full bg-transparent text-[13px] font-medium text-white outline-none placeholder:text-white/38 disabled:cursor-wait"
                              />
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.075] text-white/74 transition-colors hover:bg-white/[0.13] hover:text-white"
                                aria-label="Adicionar contexto"
                              >
                                <Plus size={17} />
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.065] px-3 text-[12px] font-semibold text-white/76 transition-colors hover:bg-white/[0.12] hover:text-white"
                              >
                                <Search size={15} />
                                DeepSearch
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.065] px-3 text-[12px] font-semibold text-white/76 transition-colors hover:bg-white/[0.12] hover:text-white"
                              >
                                <Lightbulb size={15} />
                                Think
                              </button>
                              <button
                                type="submit"
                                disabled={!customPrompt.trim() || chatSending}
                                className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black shadow-[0_8px_20px_rgba(255,255,255,0.16)] transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
                                aria-label={chatSending ? "Atlas pensando" : "Enviar pergunta"}
                              >
                                {chatSending ? <Square size={14} fill="currentColor" /> : <ArrowRight size={18} />}
                              </button>
                            </div>
                          </form>

                          <button
                            type="button"
                            onClick={() => { close(); onOpenProduct(product.id); }}
                            className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-white px-3.5 text-[12px] font-semibold text-black transition-colors hover:bg-white/88 sm:hidden"
                          >
                            Abrir produto recomendado <ArrowRight size={14} />
                          </button>
                        </motion.div>
                      </motion.div>
                    )}

                    {status === "error" && analysis && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 border-t border-white/10 pt-3 text-center">
                        <p className="text-[11px] text-white/48">{analysis.summary}</p>
                        <button
                          type="button"
                          onClick={() => selectedPreference ? void runScout(selectedPreference) : openPreferences()}
                          className="mt-2 inline-flex h-8 items-center gap-2 rounded-full bg-white px-3.5 text-[11px] font-semibold text-black"
                        >
                          Tentar novamente
                        </button>
                      </motion.div>
                    )}
                  </div>
                </motion.aside>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );

  return content;
};

export default ProductScoutAI;
