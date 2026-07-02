import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowUp, Waves } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { type Product } from "@/components/dashboard/ProductCard";

export type AtlasResults = {
  ids: string[];
  label: string;
  source: "preference" | "ai" | "fallback";
};

type Recomendacao = "bom" | "mediano" | "ruim";

export type AquasAnalysis = {
  produtoPrincipal: Product;
  analise: string;
  recomendacao: Recomendacao;
  alternativas: Product[];
  estatisticas: { label: string; valor: string }[];
};

type ProductScoutAIProps = {
  onResults: (results: AtlasResults) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialPrompt?: string;
  showTriggerButton?: boolean;
};

const SUGGESTION_CHIPS = [
  { label: "Produto para viralizar", value: "Produto para viralizar" },
  { label: "Maior margem", value: "Maior margem de lucro" },
  { label: "Estoque alto", value: "Estoque alto" },
  { label: "Preço baixo", value: "Preço baixo" },
];

/* ---------- estilos glass compartilhados ---------- */

const GLASS_PANEL: React.CSSProperties = {
  background: "rgba(20, 20, 20, 0.72)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
};

const GLASS_CHIP =
  "shrink-0 rounded-full px-4 py-1.5 text-[12.5px] font-medium text-white/85 " +
  "bg-white/[0.06] hover:bg-white/[0.10] active:scale-[0.98] transition-all duration-150 " +
  "border border-white/[0.06] outline-none";

/* ---------- avatar (Waves) ---------- */

const AquasAvatar = ({ size = 28 }: { size?: number }) => (
  <span
    className="inline-grid shrink-0 place-items-center rounded-full"
    style={{
      width: size,
      height: size,
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.10)",
    }}
    aria-hidden="true"
  >
    <Waves size={Math.round(size * 0.55)} strokeWidth={1.5} color="#FFFFFF" />
  </span>
);

/* ---------- helpers de parse do payload do backend ---------- */

const parseImages = (raw: unknown): string[] => {
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? (arr as string[]).filter(Boolean) : [];
  } catch {
    return [];
  }
};

type RawCatalogRow = {
  id: string;
  title: string | null;
  images: unknown;
  cost_price: number | null;
  suggested_price: number | null;
  category: string | null;
};

const rowToProduct = (row: RawCatalogRow): Product => {
  const images = parseImages(row.images);
  return {
    id: row.id,
    nome: row.title || "Produto sem título",
    categoria: row.category || "Geral",
    preco: row.suggested_price ?? (row.cost_price ? row.cost_price * 1.5 : 49.9),
    image_url: images[0] || "",
    images,
  };
};

/* ---------- componente principal ---------- */

const ProductScoutAI = ({
  onResults,
  open: controlledOpen,
  onOpenChange,
  initialPrompt = "",
  showTriggerButton = true,
}: ProductScoutAIProps) => {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : localOpen;

  const setOpen = (val: boolean) => {
    setLocalOpen(val);
    onOpenChange?.(val);
  };

  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [analysis, setAnalysis] = useState<AquasAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (open && initialPrompt?.trim()) {
      setPrompt(initialPrompt.trim());
      void runSearch(initialPrompt.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  const handleOpen = () => {
    setOpen(true);
    setAnalysis(null);
    setErrorMessage(null);
    setPrompt("");
  };

  const handleClose = () => {
    setOpen(false);
    setBusy(false);
    setErrorMessage(null);
    if (analysis) {
      const ids = [
        analysis.produtoPrincipal.id,
        ...analysis.alternativas.map((a) => a.id),
      ].filter(Boolean);
      onResults({
        ids,
        label: `Recomendado pelo Aquas: ${analysis.produtoPrincipal.nome}`,
        source: "ai",
      });
    }
  };

  const runSearch = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke("atlas-search", {
        body: { query: clean, history: [] },
      });
      if (error) throw error;

      const ids: string[] = Array.isArray(data?.ids) ? data.ids : [];
      if (ids.length === 0) {
        setAnalysis(null);
        setErrorMessage(
          "Não encontrei produtos que atendam a essa busca. Tente outras palavras-chave."
        );
        return;
      }

      const { data: rows, error: dbError } = await supabase
        .from("catalog_products")
        .select("id, title, images, cost_price, suggested_price, category")
        .in("id", ids.slice(0, 4));
      if (dbError) throw dbError;

      const products = (rows ?? []).map((r) => rowToProduct(r as RawCatalogRow));
      const ordered = ids
        .map((id) => products.find((p) => p.id === id))
        .filter(Boolean) as Product[];
      if (ordered.length === 0) {
        setAnalysis(null);
        setErrorMessage("Nenhum produto disponível para essa busca.");
        return;
      }

      const principal = ordered[0];
      const alternativas = ordered.slice(1, 4);

      // O backend pode retornar análise pronta; caso contrário, geramos um placeholder mínimo
      const backendAnalise: string =
        typeof data?.analise === "string" && data.analise.length > 0
          ? data.analise
          : typeof data?.resposta_chat === "string"
            ? data.resposta_chat
            : `Selecionei "${principal.nome}" como principal opção para essa busca.`;

      const backendRec: Recomendacao =
        data?.recomendacao === "bom" || data?.recomendacao === "ruim"
          ? data.recomendacao
          : "mediano";

      const backendStats: { label: string; valor: string }[] = Array.isArray(
        data?.estatisticas
      )
        ? data.estatisticas.filter(
            (s: unknown): s is { label: string; valor: string } =>
              typeof s === "object" &&
              s !== null &&
              typeof (s as { label?: unknown }).label === "string" &&
              typeof (s as { valor?: unknown }).valor === "string"
          )
        : [];

      setAnalysis({
        produtoPrincipal: principal,
        analise: backendAnalise,
        recomendacao: backendRec,
        alternativas,
        estatisticas: backendStats,
      });
    } catch (err) {
      console.error("Erro na busca do Aquas:", err);
      setErrorMessage(
        "Tive uma instabilidade ao consultar o catálogo. Tente novamente."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    void runSearch(prompt);
  };

  const handleChip = (value: string) => {
    setPrompt(value);
    void runSearch(value);
  };

  return (
    <>
      {showTriggerButton && (
        <button
          type="button"
          onClick={handleOpen}
          disabled={busy}
          className="group inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-[#050505] px-5 text-[13px] font-semibold tracking-[-0.01em] text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-black disabled:cursor-wait disabled:opacity-70"
        >
          <Waves size={16} strokeWidth={1.5} className="text-white" />
          Aquas
        </button>
      )}

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                {/* Backdrop */}
                <motion.div
                  key="aquas-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  onClick={handleClose}
                  className="fixed inset-0 z-[110] bg-black/50"
                />

                {/* Painel ancorado ao topo, expandindo para baixo */}
                <div
                  className="fixed inset-x-0 top-0 z-[120] flex justify-center px-4 pt-16 sm:pt-20 pointer-events-none"
                >
                  <motion.div
                    key="aquas-panel"
                    initial={{ opacity: 0, y: -8, scaleY: 0.85 }}
                    animate={{ opacity: 1, y: 0, scaleY: 1 }}
                    exit={{ opacity: 0, y: -8, scaleY: 0.9 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      ...GLASS_PANEL,
                      borderRadius: 28,
                      transformOrigin: "top center",
                    }}
                    className="pointer-events-auto w-full max-w-[640px] text-white overflow-hidden"
                  >
                    {/* Header: barra de busca (sempre visível, âncora do modal) */}
                    <div className="flex items-center gap-3 px-5 py-4">
                      <AquasAvatar size={32} />
                      <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
                        <input
                          ref={inputRef}
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="Ex: quero um fone barato para vender..."
                          disabled={busy}
                          className="flex-1 h-9 bg-transparent text-[14.5px] text-white outline-none placeholder:text-white/50 disabled:opacity-60"
                          style={{ fontFamily: "Inter, system-ui, sans-serif" }}
                        />
                        <button
                          type="submit"
                          disabled={!prompt.trim() || busy}
                          className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.10] hover:bg-white/[0.18] disabled:opacity-30 border border-white/[0.08] transition-colors"
                          aria-label="Enviar"
                        >
                          <ArrowUp size={14} strokeWidth={1.5} className="text-white" />
                        </button>
                      </form>
                      <button
                        type="button"
                        onClick={handleClose}
                        className="grid h-8 w-8 place-items-center rounded-full text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
                        aria-label="Fechar"
                      >
                        <X size={16} strokeWidth={1.5} />
                      </button>
                    </div>

                    {/* Conteúdo expansível */}
                    <motion.div
                      layout
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      className="px-5 pb-5"
                    >
                      {/* Estado 1: idle (sem análise, sem loading) */}
                      {!analysis && !busy && !errorMessage && (
                        <div className="pt-1">
                          <p className="text-[12px] uppercase tracking-[0.14em] text-white/45 mb-3">
                            Sugestões rápidas
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {SUGGESTION_CHIPS.map((c) => (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() => handleChip(c.value)}
                                className={GLASS_CHIP}
                                style={{ fontFamily: "Inter, system-ui, sans-serif" }}
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Estado 2: pensando */}
                      {busy && <LoadingState />}

                      {/* Estado 3: erro */}
                      {!busy && errorMessage && (
                        <div className="pt-2 pb-1 text-[13.5px] text-white/70">
                          {errorMessage}
                        </div>
                      )}

                      {/* Estado 4: análise pronta */}
                      {!busy && analysis && <AnalysisView data={analysis} />}
                    </motion.div>
                  </motion.div>
                </div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};

/* ---------- estado: carregando ---------- */

const LoadingState = () => (
  <div className="flex items-center gap-3 py-3">
    <div className="flex gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce" />
      <span
        className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </div>
    <span
      className="text-[13px] text-white/60"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      Aquas está analisando o catálogo…
    </span>
  </div>
);

/* ---------- estado: resultado ---------- */

const RECOMMENDATION_LABEL: Record<Recomendacao, string> = {
  bom: "Boa oportunidade",
  mediano: "Oportunidade mediana",
  ruim: "Oportunidade fraca",
};

const AnalysisView = ({ data }: { data: AquasAnalysis }) => {
  const { produtoPrincipal, analise, recomendacao, alternativas, estatisticas } = data;
  return (
    <div
      className="flex flex-col gap-5 pt-2"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Bloco principal: análise + produto */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[10.5px] uppercase tracking-[0.14em] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              {RECOMMENDATION_LABEL[recomendacao]}
            </span>
          </div>
          <h4 className="text-[15px] font-semibold text-white leading-snug tracking-[-0.01em]">
            {produtoPrincipal.nome}
          </h4>
          <p className="text-[13px] text-white/70 leading-relaxed">{analise}</p>

          {estatisticas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {estatisticas.map((s, i) => (
                <span
                  key={`${s.label}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] text-white/80"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <span className="text-white/55">{s.label}</span>
                  <span className="font-semibold text-white">{s.valor}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Card principal enxuto */}
        <div
          className="rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="aspect-square bg-white/[0.03] grid place-items-center overflow-hidden">
            {produtoPrincipal.image_url ? (
              <img
                src={produtoPrincipal.image_url}
                alt={produtoPrincipal.nome}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <Waves size={28} strokeWidth={1.5} className="text-white/30" />
            )}
          </div>
          <div className="px-3 py-2.5">
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-white/45">
              {produtoPrincipal.categoria}
            </p>
            <p className="mt-0.5 text-[13.5px] font-semibold text-white">
              R$ {produtoPrincipal.preco.toFixed(2).replace(".", ",")}
            </p>
          </div>
        </div>
      </div>

      {/* Alternativas (carrossel horizontal) */}
      {alternativas.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">
            Alternativas sugeridas
          </p>
          <div className="flex gap-3 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {alternativas.map((alt) => (
              <div
                key={alt.id}
                className="shrink-0 w-[150px] rounded-2xl overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="aspect-square bg-white/[0.03] overflow-hidden">
                  {alt.image_url ? (
                    <img
                      src={alt.image_url}
                      alt={alt.nome}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full grid place-items-center">
                      <Waves size={20} strokeWidth={1.5} className="text-white/30" />
                    </div>
                  )}
                </div>
                <div className="px-2.5 py-2">
                  <p className="text-[12px] font-medium text-white/90 line-clamp-2 leading-snug">
                    {alt.nome}
                  </p>
                  <p className="mt-1 text-[11.5px] font-semibold text-white">
                    R$ {alt.preco.toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductScoutAI;
