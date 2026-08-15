import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import { SHOPIFY_OFFER_URL, parseShopDomain } from "@/lib/shopifyConnect";
import { Button } from "@/components/ui/button";
import ShopifyBagIcon from "@/components/icons/ShopifyBagIcon";

const cardShell =
  "rounded-[16px] border border-[#EDEDED] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-zinc-800 dark:bg-zinc-900";

const steps = [
  { text: "Entre no ", strong: "admin da sua loja Shopify", rest: "." },
  { text: "Clique em ", strong: "Início (Home)", rest: " na barra lateral." },
  { text: "Clique na barra de endereço do navegador e ", strong: "selecione a URL", rest: "." },
  { text: "Escolha ", strong: "Copiar", rest: " e cole a URL no campo acima." },
];

// Prints do tutorial enviados pelo time (public/). Os nomes têm espaço, então precisam de encode.
const slides = steps.map((step, index) => ({
  src: encodeURI(`/tutorial shopify ${index + 1}.png`),
  caption: `${step.text}${step.strong}${step.rest}`,
}));

const SLIDE_INTERVAL_MS = 4000;

const AdicionarLojaShopifyPage = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  // Avança sozinho como o vídeo da referência; para no hover ou ao navegar na mão.
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => setSlide((current) => (current + 1) % slides.length), SLIDE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [slide, paused]);

  const goToSlide = (index: number) => setSlide((index + slides.length) % slides.length);
  // Forma funcional: dois cliques seguidos na seta avançam dois slides, e não um.
  const stepSlide = (delta: number) => setSlide((current) => (current + delta + slides.length) % slides.length);

  const handleConnect = async () => {
    const domain = parseShopDomain(url);
    if (!domain) {
      veloToast.error("Cole a URL do admin da sua loja, ex: https://admin.shopify.com/store/minhaloja");
      return;
    }

    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("shopify-authorize", {
        body: { shop: domain },
      });
      if (error) throw error;
      const authUrl = (data as { auth_url?: string } | null)?.auth_url;
      if (!authUrl) throw new Error("URL de autorização indisponível");
      window.location.href = authUrl;
    } catch (err) {
      console.error("[shopify-authorize] falha", err);
      veloToast.error("Não foi possível iniciar a conexão com a Shopify");
      setConnecting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[900px]">
      {/* Topo */}
      <div className="mb-4 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => navigate("/dashboard/integracoes")}
          aria-label="Voltar"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[#1C1C1E] transition hover:bg-black/[0.05] dark:text-white dark:hover:bg-white/10"
        >
          <ArrowLeft size={19} />
        </button>
        <h1 className="truncate text-[21px] font-semibold tracking-[-0.015em] text-[#1C1C1E] dark:text-white">
          Adicionar loja Shopify
        </h1>
      </div>

      {/* Faixa da oferta */}
      <div className={cardShell}>
        <div className="flex flex-col items-start gap-3 rounded-[12px] bg-gradient-to-r from-[#EEF4FF] to-[#F6FBF7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:from-zinc-950 dark:to-zinc-950">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-zinc-900 dark:text-white">
              <ShopifyBagIcon size={22} />
            </span>
            <p className="text-[16px] font-semibold italic tracking-[-0.01em] text-[#1C1C1E] dark:text-white">
              Loja Shopify por apenas R$5,00
            </p>
          </div>
          <Button asChild variant="pilot" className="shrink-0">
            <a href={SHOPIFY_OFFER_URL} target="_blank" rel="noopener noreferrer">
              Garantir por R$5,00
            </a>
          </Button>
        </div>
      </div>

      {/* Campo + guia */}
      <div className={`${cardShell} mt-3.5`}>
        <label htmlFor="shopify-store-url" className="block text-[13px] font-semibold text-[#1C1C1E] dark:text-white">
          URL da loja Shopify
        </label>
        <input
          id="shopify-store-url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConnect();
          }}
          placeholder="https://admin.shopify.com/store/..."
          disabled={connecting}
          className="mt-2.5 h-[46px] w-full rounded-[10px] border border-[#E6E6E6] bg-white px-3.5 text-[14px] text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.03)] outline-none transition placeholder:text-[#B5B5B5] focus:border-[#1C1C1E] disabled:opacity-60 dark:border-white/15 dark:bg-transparent dark:text-white"
        />

        <Button
          type="button"
          variant="pilotBlue"
          onClick={handleConnect}
          disabled={connecting}
          className="mt-3 h-12 w-full text-[14px]"
        >
          {connecting ? "Redirecionando..." : "Conectar loja"}
        </Button>

        {/* Guia */}
        <div className="mt-5 rounded-[12px] bg-[#F6F7F9] px-5 py-6 dark:bg-zinc-950">
          <h2 className="text-center text-[16px] font-semibold tracking-[-0.01em] text-[#1C1C1E] dark:text-white">
            Como pegar a URL da sua loja Shopify
          </h2>
          <ol className="mx-auto mt-4 max-w-[620px] space-y-3">
            {steps.map((step, index) => {
              const active = index === slide;
              return (
                <li key={step.strong}>
                  <button
                    type="button"
                    onClick={() => {
                      setPaused(true);
                      goToSlide(index);
                    }}
                    className={`flex w-full gap-2.5 rounded-[8px] px-2 py-1.5 text-left text-[13.5px] leading-[1.5] transition ${
                      active
                        ? "bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:bg-zinc-900 dark:text-white"
                        : "text-[#3A3A3C] hover:bg-white/60 dark:text-zinc-300 dark:hover:bg-white/5"
                    }`}
                  >
                    <span className="shrink-0 font-semibold text-[#1C1C1E] dark:text-white">{index + 1}.</span>
                    <span>
                      {step.text}
                      <strong className="font-semibold text-[#1C1C1E] dark:text-white">{step.strong}</strong>
                      {step.rest}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Slides do tutorial (no lugar do vídeo da referência) */}
          <div
            className="mx-auto mt-5 max-w-[760px]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="relative overflow-hidden rounded-[12px] border border-[#E6E6E6] bg-white dark:border-white/10 dark:bg-zinc-900">
              <div
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${slide * 100}%)` }}
              >
                {slides.map((item, index) => (
                  <img
                    key={item.src}
                    src={item.src}
                    alt={`Passo ${index + 1}: ${item.caption}`}
                    // Sem lazy: os 4 prints somam ~1,2 MB e precisam estar prontos
                    // antes do slide virar, senão a troca pisca em branco.
                    className="aspect-[16/10] w-full shrink-0 object-contain object-top"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setPaused(true);
                  stepSlide(-1);
                }}
                aria-label="Passo anterior"
                className="absolute left-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#1C1C1E] shadow-[0_2px_8px_rgba(0,0,0,0.14)] backdrop-blur transition hover:bg-white"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaused(true);
                  stepSlide(1);
                }}
                aria-label="Próximo passo"
                className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#1C1C1E] shadow-[0_2px_8px_rgba(0,0,0,0.14)] backdrop-blur transition hover:bg-white"
              >
                <ChevronRight size={17} />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-center gap-3">
              <div className="flex items-center gap-1.5">
                {slides.map((item, index) => (
                  <button
                    key={item.src}
                    type="button"
                    onClick={() => {
                      setPaused(true);
                      goToSlide(index);
                    }}
                    aria-label={`Ir para o passo ${index + 1}`}
                    aria-current={index === slide}
                    className={`h-1.5 rounded-full transition-all ${
                      index === slide ? "w-6 bg-[#1C1C1E] dark:bg-white" : "w-1.5 bg-[#C9C9C9] dark:bg-zinc-600"
                    }`}
                  />
                ))}
              </div>
              <span className="text-[12px] tabular-nums text-[#8A8A8A] dark:text-zinc-400">
                {slide + 1}/{slides.length}
              </span>
            </div>

            <p className="mx-auto mt-3 max-w-[620px] rounded-[10px] border border-[#E6E6E6] bg-white px-3.5 py-3 text-center text-[12.5px] text-[#8A8A8A] dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400">
              A URL fica assim: <span className="text-[#1C1C1E] dark:text-white">https://admin.shopify.com/store/minhaloja</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdicionarLojaShopifyPage;
