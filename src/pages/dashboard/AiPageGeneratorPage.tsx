import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Link2,
  Loader2,
  NotebookText,
  Search,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import {
  AI_PAGE_COOLDOWN_SECONDS,
  AiPageError,
  aiPageErrorMessage,
  createAiProductPage,
  fetchAiPageStatus,
  fetchLastGenerationAt,
  secondsUntilNextGeneration,
} from "@/lib/aiPageGeneration";

/**
 * Wizard de 3 etapas para gerar uma página de produto com IA.
 *
 * IMPORTANTE: este fluxo termina em PRÉVIA. Nada aqui publica automaticamente:
 * a página gerada fica salva na Velo para revisão.
 */

const INK = "#0A0A0A";
const SUCCESS = "#22C55E";

// Enquanto gera, perguntamos o status a cada 3s. A geração leva ~45-75s, então
// isso dá feedback rápido sem martelar o backend.
const POLL_INTERVAL_MS = 3000;

type WizardStep = 1 | 2 | 3;

type SavedProduct = {
  id: string;
  title: string;
  category: string | null;
  images: unknown;
  product_url: string | null;
};

const languages = [
  { value: "pt-BR", label: "🇧🇷 Português (Brasil)" },
  { value: "en-US", label: "🇺🇸 Inglês" },
  { value: "es", label: "🇪🇸 Espanhol" },
];

const getProductImage = (images: unknown): string | null => {
  if (Array.isArray(images) && typeof images[0] === "string") return images[0];
  return null;
};

const stepLabels: Record<WizardStep, string> = {
  1: "Produto",
  2: "Idioma e imagens",
  3: "Prévia",
};

const AiPageGeneratorPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<WizardStep>(1);

  // Etapa 1
  const [productUrl, setProductUrl] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SavedProduct | null>(null);

  // Etapa 2
  const [language, setLanguage] = useState("pt-BR");
  const [imageCount, setImageCount] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  // Etapa 3
  const [pageId, setPageId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [failure, setFailure] = useState<{ code: string; message: string } | null>(null);
  const pollTimer = useRef<number | null>(null);

  // ── Produtos salvos na Velo ────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    setLoadingProducts(true);

    void (async () => {
      // Mesma origem que o cadastro de produto já usa: o que o usuário salvou
      // nas coleções dele. Sem fallback para o catálogo inteiro — aqui a lista
      // precisa ser "meus produtos", não "todos os produtos da Velo".
      const { data, error } = await supabase
        .from("collection_products")
        .select("product_id, collections!inner(user_id), catalog_products!inner(id,title,category,images,product_url)")
        .eq("collections.user_id", user.id)
        .order("added_at", { ascending: false, nullsFirst: false })
        .limit(60);

      if (!active) return;
      setLoadingProducts(false);
      if (error) return;

      const seen = new Set<string>();
      const rows = (data ?? []) as unknown as Array<{ catalog_products: SavedProduct | SavedProduct[] | null }>;
      const next = rows.flatMap((row) => {
        const product = Array.isArray(row.catalog_products) ? row.catalog_products[0] : row.catalog_products;
        if (!product || seen.has(product.id)) return [];
        seen.add(product.id);
        return [product];
      });
      setProducts(next);
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  // ── Cooldown ───────────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      const lastAt = await fetchLastGenerationAt();
      setCooldown(secondsUntilNextGeneration(lastAt));
    })();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLocaleLowerCase("pt-BR");
    if (!term) return products.slice(0, 8);
    return products.filter((product) => product.title.toLocaleLowerCase("pt-BR").includes(term)).slice(0, 8);
  }, [productSearch, products]);

  const hasOrigin = Boolean(productUrl.trim() || selectedProduct);

  // ── Polling do status ──────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    async (id: string) => {
      try {
        const result = await fetchAiPageStatus(id);

        if (result.status === "pronto") {
          stopPolling();
          setGenerating(false);
          veloToast.success("Página gerada. Confira a prévia.");
          navigate(`/dashboard/paginas-com-ia/previa/${id}`);
          return;
        }

        if (result.status === "erro") {
          stopPolling();
          setGenerating(false);
          setFailure({
            code: result.errorCode ?? "provider_error",
            message: result.message ?? "A IA da Velo não conseguiu gerar essa página.",
          });
          return;
        }

        pollTimer.current = window.setTimeout(() => void pollStatus(id), POLL_INTERVAL_MS);
      } catch (error) {
        // Falha de rede no polling não cancela a geração — ela segue no
        // provedor e o estado está salvo no nosso banco. Tentamos de novo.
        pollTimer.current = window.setTimeout(() => void pollStatus(id), POLL_INTERVAL_MS);
      }
    },
    [navigate, stopPolling],
  );

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    if (!generating) return;
    const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [generating]);

  const handleGenerate = async () => {
    if (cooldown > 0 || generating) return;

    setFailure(null);
    setGenerating(true);
    setElapsedSeconds(0);
    setStep(3);

    try {
      const { id, createdAt } = await createAiProductPage({
        productUrl: productUrl.trim() || undefined,
        catalogProductId: selectedProduct?.id ?? null,
        language,
        imageCount,
      });

      setPageId(id);
      setCooldown(secondsUntilNextGeneration(createdAt) || AI_PAGE_COOLDOWN_SECONDS);
      void pollStatus(id);
    } catch (error) {
      setGenerating(false);
      const aiError = error instanceof AiPageError ? error : new AiPageError("unknown", "");
      setFailure({ code: aiError.code, message: aiPageErrorMessage(aiError) });

      if (aiError.code === "rate_limited" && aiError.retryAfterSeconds) {
        setCooldown(aiError.retryAfterSeconds);
      }
    }
  };

  const canGenerate = hasOrigin && cooldown === 0 && !generating;

  return (
    <div className="mx-auto w-full max-w-[900px]">
      {/* Cabeçalho + trilha das etapas */}
      <div className="mb-5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => navigate("/dashboard/paginas-com-ia")}
          aria-label="Voltar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-black/[0.08] bg-white text-[#0A0A0A] transition hover:bg-black/[0.04]"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A8A8A]">
            Etapa {step} de 3 · {stepLabels[step]}
          </p>
          <h1 className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] text-[#0A0A0A]">
            Criar página de produto com IA
          </h1>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-1.5">
        {[1, 2, 3].map((index) => (
          <span
            key={index}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: index <= step ? INK : "#E6E6E6" }}
          />
        ))}
      </div>

      {/* ── Etapa 1: produto ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="rounded-[16px] border border-[#EDEDED] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <label htmlFor="ai-url" className="mb-2 block text-[13px] font-semibold text-[#0A0A0A]">
            URL do produto (AliExpress, Amazon, TikTok Shop, Etsy)
          </label>
          <div className="flex h-[42px] items-center gap-2.5 rounded-[10px] border border-[#E6E6E6] bg-white px-3.5 focus-within:border-[#0A0A0A]">
            <Link2 size={17} className="shrink-0 text-[#8A8A8A]" />
            <input
              id="ai-url"
              type="url"
              value={productUrl}
              onChange={(event) => {
                setProductUrl(event.target.value);
                if (event.target.value.trim()) setSelectedProduct(null);
              }}
              placeholder="Cole o link do produto"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-[#0A0A0A] outline-none placeholder:text-[#B5B5B5]"
            />
          </div>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#EDEDED]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#B5B5B5]">ou</span>
            <span className="h-px flex-1 bg-[#EDEDED]" />
          </div>

          <label htmlFor="ai-search" className="mb-2 block text-[13px] font-semibold text-[#0A0A0A]">
            Escolher um produto já salvo na Velo
          </label>
          <div className="flex h-[42px] items-center gap-2.5 rounded-[10px] border border-[#E6E6E6] bg-white px-3.5 focus-within:border-[#0A0A0A]">
            <Search size={17} className="shrink-0 text-[#8A8A8A]" />
            <input
              id="ai-search"
              type="search"
              value={productSearch}
              onChange={(event) => {
                setProductSearch(event.target.value);
                setSelectedProduct(null);
                if (event.target.value.trim()) setProductUrl("");
              }}
              placeholder="Buscar nos seus produtos salvos"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-[#0A0A0A] outline-none placeholder:text-[#B5B5B5]"
            />
            {loadingProducts && <Loader2 size={15} className="shrink-0 animate-spin text-[#8A8A8A]" />}
          </div>

          <div className="mt-2.5 space-y-1.5">
            {filteredProducts.map((product) => {
              const image = getProductImage(product.images);
              const active = selectedProduct?.id === product.id;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    setSelectedProduct(product);
                    setProductUrl("");
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-[10px] border px-2.5 py-2 text-left transition ${
                    active ? "border-[#0A0A0A] bg-[#FAFAFA]" : "border-transparent hover:bg-[#F6F7F9]"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-[#F1F4F8] text-[#8B96A8]">
                    {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <NotebookText size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 block text-[13px] font-semibold text-[#0A0A0A]">{product.title}</span>
                    <span className="text-[11px] text-[#8A8A8A]">{product.category ?? "Produto Velo"}</span>
                  </span>
                  {active && <CheckCircle2 size={16} style={{ color: SUCCESS }} />}
                </button>
              );
            })}

            {!loadingProducts && products.length === 0 && (
              <p className="rounded-[10px] bg-[#F6F7F9] px-3 py-2.5 text-[12.5px] text-[#8A8A8A]">
                Você ainda não salvou produtos. Cole a URL do produto acima, ou salve um produto pelo catálogo.
              </p>
            )}
          </div>

          <Button type="button" variant="pilot" disabled={!hasOrigin} onClick={() => setStep(2)} className="mt-5">
            Próximo <ArrowRight size={15} />
          </Button>
        </div>
      )}

      {/* ── Etapa 2: idioma e imagens ─────────────────────────────────────── */}
      {step === 2 && (
        <div className="rounded-[16px] border border-[#EDEDED] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <label htmlFor="ai-language" className="mb-2 block text-[13px] font-semibold text-[#0A0A0A]">
            Idioma da página
          </label>
          <select
            id="ai-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="h-[42px] w-full rounded-[10px] border border-[#E6E6E6] bg-white px-3.5 text-[13px] text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
          >
            {languages.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <p className="mt-5 text-[13px] font-semibold text-[#0A0A0A]">Imagens geradas por IA</p>
          <p className="mt-1 text-[12px] text-[#8A8A8A]">Quantas imagens criar junto com a página?</p>
          <div className="mt-2.5 inline-grid grid-cols-7 gap-1 rounded-[10px] border border-[#E6E6E6] bg-[#F6F7F9] p-1">
            {[0, 1, 2, 3, 4, 5, 6].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setImageCount(count)}
                className={`h-8 min-w-[44px] rounded-[7px] px-2.5 text-[12px] font-semibold transition ${
                  imageCount === count ? "bg-white text-[#0A0A0A] shadow-[0_1px_3px_rgba(0,0,0,0.1)]" : "text-[#9AA2AF]"
                }`}
              >
                {count === 0 ? "Nenhuma" : count}
              </button>
            ))}
          </div>

          {cooldown > 0 && (
            <div className="mt-5 flex items-start gap-2.5 rounded-[10px] border border-[#F0E4C3] bg-[#FDF9EF] px-3.5 py-3">
              <Clock size={16} className="mt-0.5 shrink-0 text-[#9A7B1F]" />
              <p className="text-[12.5px] leading-[1.5] text-[#7A6216]">
                Você acabou de gerar uma página. A Velo libera uma geração por minuto —{" "}
                <strong className="font-semibold">faltam {cooldown}s</strong>.
              </p>
            </div>
          )}

          {failure && (
            <div className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-[#F3D0D0] bg-[#FDF5F5] px-3.5 py-3">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[#B42318]" />
              <p className="text-[12.5px] leading-[1.5] text-[#8C2C22]">{failure.message}</p>
            </div>
          )}

          <div className="mt-5 flex items-center gap-2.5">
            <Button type="button" variant="pilotLight" onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button type="button" variant="pilot" disabled={!canGenerate} onClick={handleGenerate}>
              <Sparkles size={15} />
              {cooldown > 0 ? `Aguarde ${cooldown}s` : "Gerar página"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Etapa 3: gerando / erro ───────────────────────────────────────── */}
      {step === 3 && (
        <div className="rounded-[16px] border border-[#EDEDED] bg-white p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {generating && (
            <>
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F6F7F9]">
                <Loader2 size={22} className="animate-spin text-[#0A0A0A]" />
              </span>
              <h2 className="text-[17px] font-semibold text-[#0A0A0A]">Gerando sua página...</h2>
              <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] leading-[1.5] text-[#8A8A8A]">
                A IA está lendo o produto e escrevendo a página. Costuma levar entre 45 e 75 segundos
                {imageCount > 0 ? " — com imagens, um pouco mais" : ""}.
              </p>
              <p className="mt-3 text-[12px] tabular-nums text-[#B5B5B5]">{elapsedSeconds}s decorridos</p>
              <p className="mx-auto mt-4 max-w-[420px] text-[12px] leading-[1.5] text-[#8A8A8A]">
                Pode fechar esta aba: a geração continua e a prévia fica salva em Páginas com IA.
              </p>
            </>
          )}

          {!generating && failure && (
            <>
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FDF5F5]">
                <TriangleAlert size={22} className="text-[#B42318]" />
              </span>
              <h2 className="text-[17px] font-semibold text-[#0A0A0A]">
                {failure.code === "rate_limited"
                  ? "Aguarde um instante"
                  : failure.code === "plan_required"
                    ? "Plano insuficiente para gerar páginas"
                    : "Não deu para gerar agora"}
              </h2>
              <p className="mx-auto mt-1.5 max-w-[460px] text-[13px] leading-[1.5] text-[#8A8A8A]">{failure.message}</p>
              <Button
                type="button"
                variant="pilot"
                onClick={() => {
                  setFailure(null);
                  setStep(2);
                }}
                className="mt-5"
              >
                Voltar e tentar de novo
              </Button>
            </>
          )}

          {!generating && !failure && pageId && (
            <Button type="button" variant="pilot" onClick={() => navigate(`/dashboard/paginas-com-ia/previa/${pageId}`)}>
              Ver prévia
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default AiPageGeneratorPage;
