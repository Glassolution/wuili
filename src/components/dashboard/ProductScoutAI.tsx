import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles, X } from "lucide-react";
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

type ProductScoutAIProps = {
  onOpenProduct: (productId: string) => void;
};

const stages = [
  { title: "Procurando produtos", detail: "Read catalog_products 200 linhas" },
  { title: "Filtrando estoque", detail: "Read stock_quantity linhas" },
  { title: "Analisando margem", detail: "Read margin_percent 80 linhas" },
  { title: "Lendo sinais", detail: "Read orders_count 42 linhas" },
  { title: "Pensando", detail: "Read recomendacao_final 1 linhas" },
];

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

const fallbackAnalysis = (product: RankedProduct): ScoutAnalysis => ({
  summary: `${product.title} reuniu o melhor equilíbrio entre margem, disponibilidade, histórico de pedidos e material visual entre os itens analisados.`,
  whyBest: `O produto tem margem de ${Math.round(product.margin_percent || 0)}%, ${product.stock_quantity || 0} unidades disponíveis e ${product.orders_count || 0} pedidos registrados no catálogo.`,
  viralPotential: `A inferência de potencial vem da combinação de ${product.imageCount} imagens, apelo demonstrável e preço sugerido de ${formatBRL(product.suggested_price)}. Isso favorece vídeos curtos de problema e solução, mas não representa dados ao vivo do TikTok.`,
  tiktokAngle: "Abra com o problema em dois segundos, mostre o produto funcionando em close e finalize comparando o antes e depois com uma chamada simples para conhecer a oferta.",
  marketReading: `Dentro do catálogo Velo, o item apresenta nota ${product.rating?.toFixed(1) ?? "não informada"} e score interno ${product.score}/100. A leitura é comparativa e considera somente os dados disponíveis agora.`,
});

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

const ScoutGlyph = ({ complete = false }: { complete?: boolean }) => (
  <span className="relative grid h-7 w-7 shrink-0 place-items-center">
    <motion.span
      className={`absolute h-6 w-6 rounded-[7px] blur-md ${complete ? "bg-white/34" : "bg-white/22"}`}
      animate={complete ? { opacity: 0.78, scale: 1 } : { opacity: [0.24, 0.76, 0.24], scale: [0.86, 1.12, 0.86] }}
      transition={{ duration: 1.35, repeat: complete ? 0 : Infinity, ease: "easeInOut" }}
    />
    <motion.span
      className="relative grid h-[18px] w-[18px] grid-cols-2 gap-[2px] rounded-[5px] bg-[#050505] p-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_18px_rgba(255,255,255,0.18)]"
      animate={complete ? { rotate: 0, scale: 1 } : { rotate: [0, 90, 180, 270, 360], scale: [0.96, 1.04, 0.96] }}
      transition={{ duration: 2.1, repeat: complete ? 0 : Infinity, ease: "linear" }}
    >
      {[0, 1, 2, 3].map((cell) => (
        <motion.span
          key={cell}
          className="rounded-[2px] bg-white"
          animate={complete ? { opacity: 0.95 } : { opacity: [0.14, 0.9, 0.14] }}
          transition={{ duration: 1.05, repeat: complete ? 0 : Infinity, delay: cell * 0.16, ease: "easeInOut" }}
        />
      ))}
    </motion.span>
  </span>
);

const ProductScoutAI = ({ onOpenProduct }: ProductScoutAIProps) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "complete" | "error">("idle");
  const [stage, setStage] = useState(0);
  const [product, setProduct] = useState<RankedProduct | null>(null);
  const [analysis, setAnalysis] = useState<ScoutAnalysis | null>(null);
  const runRef = useRef(0);

  useEffect(() => () => {
    runRef.current += 1;
  }, []);

  const runScout = async () => {
    const runId = ++runRef.current;
    playSoftChime();
    setOpen(true);
    setStatus("running");
    setStage(0);
    setProduct(null);
    setAnalysis(null);

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

      const ranked = data.map(rankProduct).sort((a, b) => b.score - a.score);
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
              content: `Você é a IA de descoberta de produtos da Velo. Analise SOMENTE os fatos reais abaixo. O primeiro item venceu um ranking de margem, estoque, pedidos, avaliação, imagens e preço. Não alegue acesso a tendências ao vivo, volume de busca ou dados externos. Explique em português brasileiro, de forma direta, por que ele é a melhor oportunidade e qual roteiro de TikTok demonstra melhor o produto. O potencial viral deve ser apresentado explicitamente como inferência. Retorne SOMENTE JSON válido com as chaves summary, whyBest, viralPotential, tiktokAngle e marketReading. Cada valor deve ter no máximo 320 caracteres.\n\nFATOS:\n${JSON.stringify(facts)}`,
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

  const eyebrow =
    status === "complete"
      ? "Read melhor_produto 1 linhas"
      : status === "error"
        ? "Read erro_analise 1 linhas"
        : stages[stage].detail;
  const title =
    status === "complete"
      ? "Produto encontrado"
      : status === "error"
        ? "Tentar novamente"
        : stages[stage].title;

  const content = (
    <>
      <button
        type="button"
        onClick={() => void runScout()}
        disabled={status === "running"}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111111] px-5 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-black disabled:cursor-wait disabled:opacity-70"
      >
        <Sparkles className="h-4 w-4" />
        IA Velo
      </button>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="velo-product-scout-shell"
              className="fixed inset-x-0 top-0 z-[120] pointer-events-none text-white"
              initial={{ opacity: 0, y: -26 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -22 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="absolute inset-x-0 top-0 h-7 bg-black shadow-[0_10px_24px_rgba(0,0,0,0.13)]" />
              <motion.aside
                aria-live="polite"
                className="pointer-events-auto relative mx-auto w-[min(calc(100vw-34px),520px)] overflow-hidden rounded-b-2xl border-x border-b border-white/10 bg-black shadow-[0_18px_46px_rgba(0,0,0,0.22)]"
                layout
              >
                <div className="relative px-6 pb-4 pt-3">
                  <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />

                  <div className="flex items-center justify-center gap-3">
                    <div className="flex min-w-0 items-center justify-center gap-3">
                      <ScoutGlyph complete={status === "complete"} />
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${status}-${stage}`}
                          initial={{ opacity: 0, y: 5, filter: "blur(4px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, y: -5, filter: "blur(4px)" }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className="min-w-0 text-left"
                        >
                          <p className="truncate text-[14px] font-normal tracking-[-0.01em] text-white/50">
                            {eyebrow}
                          </p>
                          <h2 className="mt-1 truncate text-[20px] font-semibold leading-none tracking-[-0.035em] text-white">
                            {title}
                          </h2>
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    {status !== "running" && (
                      <button
                        type="button"
                        onClick={close}
                        className="absolute right-3 top-3 grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/32 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Fechar IA Velo"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {status === "complete" && product && analysis && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -8 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="mt-3 overflow-hidden border-t border-white/10 pt-3"
                    >
                      <div className="text-center">
                        <h3 className="mx-auto max-w-[410px] truncate text-[13px] font-medium leading-5 text-white/70">
                          {product.title}
                        </h3>
                        <p className="mx-auto mt-1 max-w-[390px] line-clamp-2 text-[11px] leading-4 text-white/42">{analysis.summary}</p>
                      </div>

                      <div className="mt-3 flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => { close(); onOpenProduct(product.id); }}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-white px-3.5 text-[11px] font-semibold text-black transition-colors hover:bg-white/88"
                        >
                          Ver produto recomendado <ArrowRight size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {status === "error" && analysis && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 border-t border-white/10 pt-3 text-center">
                      <p className="text-[11px] text-white/48">{analysis.summary}</p>
                      <button type="button" onClick={() => void runScout()} className="mt-2 inline-flex h-8 items-center gap-2 rounded-full bg-white px-3.5 text-[11px] font-semibold text-black">
                        Tentar novamente
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.aside>
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
