import { useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Copy, ExternalLink, Sparkles, Package, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import ProductImagesDownload from "@/components/dashboard/ProductImagesDownload";
import SelectProductModal from "@/components/dashboard/SelectProductModal";

type VideoState = {
  product_title: string;
  product_image: string;
  product_images?: string[];
  product_description: string;
  cost_price: number;
  sale_price: number;
  profit: number;
};

// Parse product.images (string JSON or array) → formatted URL array
function parseImages(images: unknown): string[] {
  try {
    const arr = typeof images === "string" ? JSON.parse(images) : images;
    if (!Array.isArray(arr)) return [];
    return arr.map((u: string) => {
      if (!u) return "";
      if (u.match(/\.(png|jpg|jpeg)(\?|$)/i)) return u;
      if (u.includes(".webp")) return u.replace(".webp", ".jpg");
      const sep = u.includes("?") ? "&" : "?";
      return `${u}${sep}format=jpg`;
    }).filter(Boolean);
  } catch { return []; }
}

export default function CriarVideoPage() {
  const location = useLocation();
  const routeState = location.state as VideoState | null;

  // Product selected inline (when arriving directly without route state)
  const [localState, setLocalState] = useState<VideoState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Effective state — route state takes precedence over inline selection
  const state = routeState ?? localState;

  const [loading, setLoading] = useState(false);
  const [promptGerado, setPromptGerado] = useState("");
  const [mostrarResultado, setMostrarResultado] = useState(false);
  const [copied, setCopied] = useState(false);
  const [highlightGerado, setHighlightGerado] = useState(false);
  const [buttonPressed, setButtonPressed] = useState(false);
  const resultadoRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playUiSound = (type: "click" | "confirm") => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (type === "click") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.14);
      } else {
        [740, 987].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
          gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.06 + 0.28);
          osc.start(ctx.currentTime + i * 0.06);
          osc.stop(ctx.currentTime + i * 0.06 + 0.28);
        });
      }
    } catch { /* silent */ }
  };

  const handleProductSelect = (product: {
    id: string; title: string; images: unknown;
    cost_price: number; suggested_price: number; category: string | null;
  }) => {
    const imgs = parseImages(product.images);
    const mainImage = imgs[0] ?? "";
    setLocalState({
      product_title: product.title,
      product_image: mainImage,
      product_images: imgs,
      product_description: "",
      cost_price: product.cost_price,
      sale_price: product.suggested_price,
      profit: Math.round((product.suggested_price - product.cost_price) * 100) / 100,
    });
    // Reset prompt when product changes
    setPromptGerado("");
    setMostrarResultado(false);
  };

  const handleGerarPrompt = () => {
    if (loading || !state) return;
    playUiSound("click");
    setButtonPressed(true);
    setTimeout(() => setButtonPressed(false), 180);
    setLoading(true);

    const prompt = `Crie um vídeo de anúncio para TikTok e Reels do produto: ${state.product_title}.

Descrição: ${state.product_description || "Produto de alta qualidade com ótimo custo-benefício."}

Preço de venda: R$ ${state.sale_price.toFixed(2)}. Destaque o custo-benefício e a entrega rápida.

O vídeo deve ser vertical (9:16), dinâmico, com texto aparecendo em cena, fundo limpo e chamada para ação no final. Estilo moderno e jovem.`;

    setTimeout(() => {
      setPromptGerado(prompt);
      setMostrarResultado(true);
      setLoading(false);
      setHighlightGerado(true);
      playUiSound("confirm");
      setTimeout(() => setHighlightGerado(false), 900);
      requestAnimationFrame(() => {
        resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }, 900);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(promptGerado);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  // ── No product selected — inline picker ────────────────────────────────────
  if (!state) {
    return (
      <>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F5F5]">
            <Package size={22} className="text-[#737373]" />
          </div>
          <div>
            <h2 className="font-['Manrope'] text-[17px] font-semibold text-[#0A0A0A]">
              Nenhum produto selecionado
            </h2>
            <p className="mt-1 text-[13px] text-[#737373]">
              Escolha um produto do catálogo para gerar o prompt e baixar as imagens.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="btn-primary btn-primary--md"
          >
            Escolher produto do catálogo
          </button>
        </div>

        <SelectProductModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSelect={(p) => { handleProductSelect(p); setModalOpen(false); }}
        />
      </>
    );
  }

  // ── Product selected — full page ────────────────────────────────────────────
  return (
    <>
      <div className="mx-auto max-w-[680px] px-6 py-10">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0A0A0A]">
            <span className="text-white text-[18px]">✦</span>
          </div>
          <h1 className="font-['Manrope'] text-[22px] font-bold text-[#0A0A0A]">
            Criar vídeo do produto
          </h1>
          <p className="mt-1 text-[13px] text-[#737373]">
            Gere um prompt otimizado para criar o vídeo com IA
          </p>
        </div>

        {/* Product card */}
        <div className="mb-8 rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="inline-flex rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#525252]">
              Produto selecionado
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1 rounded-lg border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#737373] transition hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
            >
              Alterar
              <ChevronDown size={11} />
            </button>
          </div>
          <div className="flex items-center gap-4">
            {state.product_image ? (
              <img
                src={state.product_image}
                alt={state.product_title}
                className="h-[72px] w-[72px] shrink-0 rounded-xl border border-[#E5E5E5] object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl bg-[#E5E5E5]">
                <Package size={20} className="text-[#A3A3A3]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-['Manrope'] text-[14px] font-semibold text-[#0A0A0A]">
                {state.product_title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12px] text-[#737373]">
                <span>Custo: <span className="font-medium text-[#0A0A0A]">R$ {state.cost_price.toFixed(2)}</span></span>
                <span className="text-[#D4D4D4]">·</span>
                <span>Venda: <span className="font-medium text-[#0A0A0A]">R$ {state.sale_price.toFixed(2)}</span></span>
                <span className="text-[#D4D4D4]">·</span>
                <span className="font-semibold text-[#16A34A]">+R$ {state.profit.toFixed(2)} lucro</span>
              </div>
            </div>
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGerarPrompt}
          disabled={loading}
          className={`btn-primary btn-primary--lg group relative mb-2 w-full overflow-hidden border border-[#1F1F1F] bg-gradient-to-b from-[#1A1A1A] to-[#0A0A0A] tracking-[0.01em] shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition-all duration-200 ease-in-out hover:brightness-110 hover:shadow-[0_14px_34px_rgba(0,0,0,0.28)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-75 ${buttonPressed ? "scale-[0.98]" : ""} ${highlightGerado ? "ring-2 ring-[#16A34A]/45 ring-offset-2 ring-offset-white" : ""}`}
        >
          <span className="pointer-events-none absolute inset-0 rounded-[100px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-200 ease-in-out group-hover:opacity-100" />
          {loading ? (
            <span className="relative z-[1] inline-flex items-center gap-2.5">
              <span style={{
                display: "inline-block", width: 14, height: 14, borderRadius: "50%",
                border: "1.5px solid rgba(255,255,255,0.34)", borderTopColor: "#fff",
                animation: "btn-spin 0.7s linear infinite", transformOrigin: "center", flexShrink: 0,
              }} />
              Gerando...
            </span>
          ) : (
            <span className="relative z-[1] inline-flex items-center gap-2 font-semibold">
              <Sparkles size={15} />
              Gerar prompt
            </span>
          )}
        </button>
        <div className="mb-8 space-y-1 text-center">
          <p className="inline-flex items-center justify-center rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-2.5 py-1 text-[10px] font-semibold text-[#C2410C]">
            Alta conversão
          </p>
          <p className="text-[11px] text-[#737373]">
            Prompt otimizado para alta conversão em anúncios
          </p>
        </div>
        <p className="mb-8 text-center text-[11px] text-[#A3A3A3]">
          Powered by Velo IA · Resultado em segundos
        </p>

        {/* Result */}
        {mostrarResultado && (
          <div
            ref={resultadoRef}
            className="space-y-3"
            style={{ animation: "slideUp 300ms ease" }}
          >
            <div className="space-y-0.5 pb-1">
              <p className="font-['Manrope'] text-[15px] font-semibold text-[#0A0A0A]">Prompt gerado</p>
              <p className="text-[12px] text-[#737373]">Copie e use na ferramenta de IA</p>
            </div>

            {/* Prompt card */}
            <div className="relative rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] p-6 shadow-[0_6px_16px_rgba(0,0,0,0.06)]">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 text-[11px] font-medium text-[#404040]">
                <Sparkles size={12} className="text-[#0A0A0A]" />
                IA pronta
              </div>
              <button
                onClick={handleCopy}
                className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-white px-3 py-1.5 text-[11px] font-medium text-[#737373] transition hover:-translate-y-0.5 hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
              >
                <Copy size={11} />
                {copied ? "Copiado ✓" : "Copiar"}
              </button>
              <p className="pr-20 font-['Manrope'] text-[15px] leading-[1.7] text-[#0A0A0A] whitespace-pre-wrap">
                {promptGerado}
              </p>
            </div>

            {/* Images */}
            <div className="pt-2">
              <ProductImagesDownload
                images={state.product_images ?? (state.product_image ? [state.product_image] : [])}
                productTitle={state.product_title}
              />
            </div>

            <p className="pt-2 font-['Manrope'] text-[13px] font-semibold text-[#0A0A0A]">Abrir ferramenta</p>

            <div
              className="flex cursor-pointer items-center gap-4 rounded-2xl border border-[#0A0A0A] bg-[#0A0A0A] p-4 shadow-sm transition hover:-translate-y-0.5 hover:bg-[#1a1a1a] hover:shadow-md"
              onClick={() => {
                navigator.clipboard.writeText(promptGerado);
                toast.success("Prompt copiado! Abrindo ferramenta...");
                window.open("https://bandy.ai/pt?utm_source=youtube&utm_medium=moon2601&utm_campaign=Nova.Riqueza", "_blank", "noopener");
              }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <ExternalLink size={18} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-['Manrope'] text-[13.5px] font-semibold text-white">Abrir ferramenta</p>
                <p className="text-[11.5px] text-white/60">Gerar vídeo com IA</p>
              </div>
              <ExternalLink size={14} className="shrink-0 text-white/40" />
            </div>
          </div>
        )}

        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(14px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>

      {/* Product picker modal — also used for "Alterar" */}
      <SelectProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={(p) => { handleProductSelect(p); setModalOpen(false); }}
      />
    </>
  );
}
