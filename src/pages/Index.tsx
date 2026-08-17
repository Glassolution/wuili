import { CSSProperties, FormEvent, ImgHTMLAttributes, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const operationLogos = [
  { name: "Mercado Livre", label: "Mercado Livre", src: "/brand/mercado-livre.svg" },
  { name: "C7Drop", label: "C7Drop" },
  { name: "Mercado Pago", label: "Mercado Pago" },
  { name: "Correios", label: "Correios" },
  { name: "Shopee", label: "Shopee", src: "/brand/shopee.svg" },
];

const marqueeLogos = [...operationLogos, ...operationLogos];

/*
  Cada item aponta para uma seção que existe nesta página. Não há "Preços" aqui: a landing
  não tem seção nem rota de planos, então o item viraria uma âncora morta.

  `panel` abre o menu suspenso no hover. Os itens descrevem recursos que existem de fato no
  produto (conferidos no código do dashboard) — nada de funcionalidade anunciada antes de
  existir. Enquanto não houver página própria para cada recurso, clicar leva para a seção
  correspondente da landing.
*/
const navItems = [
  { label: "Como funciona", target: "como-funciona" },
  {
    label: "Recursos",
    target: "recursos",
    panel: [
      { title: "Catálogo Velo", text: "Produtos de fornecedores brasileiros, com custo e margem à vista." },
      { title: "Atlas", text: "A IA da Velo ajuda a avaliar produto, preço e próximo passo." },
      { title: "Produtos em alta", text: "Acompanhe o que está vendendo antes de investir no anúncio." },
      { title: "Páginas com IA", text: "Gere a página do produto a partir do item do catálogo." },
      { title: "Imagens com IA", text: "Crie variações de imagem para testar criativos." },
      { title: "Publicações e pedidos", text: "Veja o que foi publicado em cada canal e acompanhe os pedidos." },
    ],
  },
  {
    label: "Integrações",
    target: "integracoes",
    panel: [
      { title: "Mercado Livre", text: "Conecte sua conta e publique seus anúncios pela Velo." },
      { title: "Shopee", text: "Leve o mesmo catálogo para o segundo canal sem refazer tudo." },
      { title: "Mercado Pago", text: "Pagamentos do ecossistema Mercado Livre na sua operação." },
      { title: "Correios", text: "Prazo e custo de envio considerados no cálculo da sua margem." },
      { title: "C7Drop", text: "Fornecedor que alimenta o catálogo com produtos já validados." },
    ],
  },
  { label: "Perguntas frequentes", target: "perguntas-frequentes" },
];

const processCards = [
  {
    title: "Encontre produtos com potencial",
    text: "Veja oportunidades com sinais de demanda, margem e aderência aos marketplaces brasileiros.",
    visual: "product",
  },
  {
    title: "Organize sua operação",
    text: "Centralize fornecedores, custos, catálogo e publicação em uma rotina simples para começar melhor.",
    visual: "workflow",
  },
  {
    title: "Venda com mais clareza",
    text: "Acompanhe produto, preço, pedidos e canais conectados sem transformar tudo em planilhas soltas.",
    visual: "uptime",
  },
];

const statsCards = [
  {
    value: "Milhares",
    text: "de produtos analisados para encontrar oportunidades com mais contexto.",
  },
  {
    value: "5 canais",
    text: "para conectar catálogo, fornecedor, pagamento, envio e marketplace.",
  },
];

const supportItems = [
  {
    icon: "support",
    title: "Começo guiado",
    text: "Uma experiência pensada para quem está estruturando a primeira operação online.",
  },
  {
    icon: "apps",
    title: "Produtos e canais",
    text: "Organize oportunidades, fornecedores e marketplaces em um fluxo único.",
  },
  {
    icon: "tools",
    title: "Dados acionáveis",
    text: "Veja sinais úteis para decidir o que testar, publicar e acompanhar.",
  },
  {
    icon: "team",
    title: "Operação escalável",
    text: "Comece simples e evolua sua rotina conforme suas vendas ganham consistência.",
  },
];

const faqItems = [
  {
    question: "Preciso ter estoque para usar a Velo?",
    answer: "Não. A Velo foi pensada para operações de dropshipping, ajudando você a descobrir produtos e organizar a venda sem comprar estoque antes.",
  },
  {
    question: "A Velo publica produtos automaticamente?",
    answer: "A plataforma ajuda a estruturar o catálogo e conectar canais. As ações disponíveis dependem das integrações e permissões da sua conta.",
  },
  {
    question: "Consigo vender no Mercado Livre?",
    answer: "Sim. A Velo foi desenhada para apoiar operações conectadas ao Mercado Livre e outros canais relevantes no Brasil.",
  },
  {
    question: "A plataforma é para iniciantes?",
    answer: "Sim. A experiência prioriza clareza, próximos passos e decisões simples para quem está começando no ecommerce.",
  },
  {
    question: "Quais dados a Velo usa para sugerir produtos?",
    answer: "A Velo organiza sinais como categoria, preço, margem, fornecedor e contexto de mercado para ajudar você a avaliar oportunidades.",
  },
];

/*
  Carrossel de fundo do hero. Os nomes têm espaço no disco ("pessoa 01.png"), por isso
  o %20 — se os arquivos forem renomeados, é aqui que se ajusta.
*/
/*
  Bump este número sempre que as fotos forem substituídas mantendo o mesmo nome de arquivo.
  Sem isso o navegador (e qualquer CDN na frente) continua servindo a versão antiga do cache,
  porque a URL não mudou.
*/
const HERO_ASSET_VERSION = 2;

const HERO_SLIDES = [
  /*
    focus: ponto focal do recorte, no formato de object-position ("50% 50%" = centro).
    O padrão é o centro e serve para qualquer enquadramento — só vale ajustar se alguma
    foto específica tiver o sujeito muito fora do meio e ficar cortada no celular, onde
    cabe bem menos da largura original.
  */
  { src: "/pessoa%2001.png", focus: "50% 50%", headline: "sem estoque, sem risco." },
  { src: "/pessoa%2002.png", focus: "50% 50%", headline: "com o produto certo." },
  { src: "/pessoa%2003.png", focus: "50% 50%", headline: "em poucos minutos." },
];

/*
  PLACEHOLDER TEMPORÁRIO — some sozinho assim que qualquer foto de HERO_SLIDES carregar.
  É um mockup com avatar gerado por IA, não um vendedor real usando a Velo.
*/
const HERO_PLACEHOLDER = "/hero-pasted-image-2.png";

const HERO_SLIDE_INTERVAL = 6000;

const TYPE_DELETE_MS = 26;
const TYPE_WRITE_MS = 52;

/*
  Máquina de escrever: apaga a frase atual caractere a caractere e digita a nova. Não tem
  timer próprio — reage à mudança de `target`, que vem do mesmo índice do carrossel, então
  o ciclo começa exatamente quando a imagem de fundo troca.
*/
function useTypewriter(target: string) {
  const [display, setDisplay] = useState(target);
  const [mode, setMode] = useState<"idle" | "deleting" | "typing">("idle");
  const mounted = useRef(false);

  useEffect(() => {
    // Na primeira renderização a frase já aparece pronta: nada para apagar ainda.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(target);
      setMode("idle");
      return;
    }

    setMode("deleting");
  }, [target]);

  useEffect(() => {
    if (mode === "idle") return;

    const timer = window.setTimeout(
      () => {
        setDisplay((current) => (mode === "deleting" ? current.slice(0, -1) : target.slice(0, current.length + 1)));
      },
      mode === "deleting" ? TYPE_DELETE_MS : TYPE_WRITE_MS
    );

    return () => window.clearTimeout(timer);
  }, [mode, display, target]);

  useEffect(() => {
    if (mode === "deleting" && display.length === 0) setMode("typing");
    else if (mode === "typing" && display === target) setMode("idle");
  }, [mode, display, target]);

  return { display, isAnimating: mode !== "idle" };
}

/*
  Um único índice governa foto e segunda linha da headline: as duas trocam no mesmo tick e
  com o mesmo crossfade, sem timer separado.
*/
function useHeroCarousel() {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [index, setIndex] = useState(0);
  // As fotos seguintes só entram no DOM depois que a primeira pinta, para não competir com o LCP.
  const [preloadRest, setPreloadRest] = useState(false);

  const slides = HERO_SLIDES.filter((slide) => !failed[slide.src]);

  useEffect(() => {
    if (!preloadRest) return;
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => setIndex((current) => current + 1), HERO_SLIDE_INTERVAL);

    return () => window.clearInterval(timer);
  }, [preloadRest, slides.length]);

  return {
    slides,
    // Sem nenhuma foto disponível o carrossel para, mas a headline ainda precisa de uma frase.
    phrases: slides.length > 0 ? slides : HERO_SLIDES.slice(0, 1),
    visibleSlides: preloadRest ? slides : slides.slice(0, 1),
    active: slides.length > 0 ? index % slides.length : 0,
    onFirstLoad: () => setPreloadRest(true),
    onSlideError: (src: string) => setFailed((current) => ({ ...current, [src]: true })),
  };
}

type HeroCarousel = ReturnType<typeof useHeroCarousel>;

function HeroBackdrop({ slides, visibleSlides, active, onFirstLoad, onSlideError }: HeroCarousel) {
  return (
    <>
      {slides.length === 0 && (
        <img
          src={HERO_PLACEHOLDER}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[68%_center] lg:object-[75%_center]"
        />
      )}

      {visibleSlides.map((slide, slideIndex) => (
        <img
          key={slide.src}
          src={`${slide.src}?v=${HERO_ASSET_VERSION}`}
          alt=""
          aria-hidden="true"
          decoding="async"
          style={{ "--hero-focus": slide.focus } as CSSProperties}
          onLoad={slideIndex === 0 ? onFirstLoad : undefined}
          onError={() => onSlideError(slide.src)}
          className={`absolute inset-0 -z-10 h-full w-full object-cover object-[var(--hero-focus)] transition-opacity duration-1000 ease-in-out ${
            slideIndex === active ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </>
  );
}

function VeloLogo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <div className={`flex items-center gap-2.5 transition-colors duration-200 ${tone === "light" ? "text-white" : "text-[#0B1B3D]"}`}>
      <img src="/logo.png" alt="Velo" className="block h-9 w-9 shrink-0 object-contain" />
      <span className="text-[26px] font-bold leading-none tracking-[-0.06em]">Velo</span>
    </div>
  );
}

function PremiumImage({ className = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(135deg,#E8EFFD,#F8FAFF)]">
      {!failed && (
        <img
          {...props}
          className={`h-full w-full object-cover opacity-0 transition-opacity duration-500 ${className}`}
          onError={() => setFailed(true)}
          onLoad={(event) => {
            event.currentTarget.style.opacity = "1";
          }}
        />
      )}
      {failed && <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(37,99,235,0.12),transparent_38%),linear-gradient(135deg,#EDF2FD,#FBFCFF)]" />}
    </div>
  );
}

function OperationLogo({ logo }: { logo: (typeof operationLogos)[number] }) {
  return (
    <div className="flex h-full items-center justify-center">
      {"src" in logo && logo.src ? (
        <img
          src={logo.src}
          alt={logo.name}
          className="max-h-7 max-w-[140px] object-contain opacity-45 grayscale transition duration-300 hover:opacity-70 sm:max-h-8 sm:max-w-[160px]"
        />
      ) : (
        <span className="text-[20px] font-bold leading-none tracking-[-0.045em] text-[#0B1B3D]/40 sm:text-[24px]">{logo.label}</span>
      )}
    </div>
  );
}

function ProcessVisual({ type }: { type: string }) {
  const shell =
    "relative h-[236px] overflow-hidden rounded-[20px] border border-[#E6ECF9] bg-[linear-gradient(180deg,#FBFCFF,#EFF4FF)] sm:h-[268px]";

  if (type === "workflow") {
    return (
      <div className={shell}>
        <div className="absolute left-6 top-8 z-10 w-[152px] rounded-[16px] border border-[#EAEFF9] bg-white p-2.5 shadow-[0_16px_36px_rgba(15,35,95,0.08)] sm:w-[172px] sm:p-3">
          <div className="h-[96px] overflow-hidden rounded-[12px] bg-[#EDF2FD] sm:h-[112px]">
            <PremiumImage src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=520&q=85" alt="Produto encontrado" />
          </div>
          <div className="mt-3 h-2 w-20 rounded-full bg-[#0B1B3D]/10" />
          <div className="mt-2 h-2 w-28 rounded-full bg-[#0B1B3D]/[0.06]" />
        </div>

        <div className="absolute right-5 top-12 z-20 w-[150px] rounded-[16px] border border-[#E6ECF9] bg-white/95 p-3.5 shadow-[0_16px_36px_rgba(15,35,95,0.09)] backdrop-blur-sm sm:right-7 sm:w-[164px]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8A97B1]">Publicação</div>
          <div className="mt-3 space-y-2">
            {["Mercado Livre", "Shopee", "Catálogo"].map((item, index) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-full bg-[#F4F7FE] px-3 py-1.5 text-[11px] text-[#41506E] sm:text-[12px]"
              >
                <span>{item}</span>
                <span className={index === 0 ? "font-semibold text-[#2563EB]" : "text-[#9AA6BE]"}>{index === 0 ? "ativo" : "ok"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-7 left-1/2 h-2 w-44 -translate-x-1/2 rounded-full bg-[#0B1B3D]/[0.07]" />
        <div className="absolute bottom-7 left-[calc(50%-88px)] h-2 w-28 rounded-full bg-[#2563EB]" />
      </div>
    );
  }

  if (type === "uptime") {
    return (
      <div className={shell}>
        <div className="absolute inset-x-8 top-9 h-[112px] rounded-full border border-[#E1E9F8]" />

        <div className="absolute left-1/2 top-8 h-[128px] w-[128px] -translate-x-1/2 sm:h-[144px] sm:w-[144px]">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="48" fill="none" stroke="#DEE7F8" strokeWidth="9" />
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke="#2563EB"
              strokeLinecap="round"
              strokeWidth="9"
              strokeDasharray="246 302"
            />
          </svg>

          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-[30px] font-semibold leading-none tracking-[-0.045em] text-[#0B1B3D] sm:text-[34px]">99,9%</div>
              <div className="mt-2 text-[12px] tracking-[-0.01em] text-[#7B8AA6]">operação estável</div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-2">
          {["ML", "C7", "MP"].map((item) => (
            <span key={item} className="rounded-full border border-[#E6ECF9] bg-white px-3.5 py-1.5 text-[11px] font-medium text-[#5B6B8C] shadow-[0_4px_12px_rgba(15,35,95,0.04)]">
              {item}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="absolute left-1/2 top-7 w-[236px] -translate-x-1/2 rounded-[18px] border border-[#EAEFF9] bg-white p-4 shadow-[0_18px_44px_rgba(15,35,95,0.09)]">
        <div className="flex items-center gap-3.5">
          <div className="h-14 w-14 overflow-hidden rounded-[14px] bg-[#EDF2FD]">
            <PremiumImage src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=260&q=85" alt="Produto com potencial" />
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-[-0.02em] text-[#0B1B3D]">Smartwatch compacto</div>
            <div className="mt-1 text-[11px] text-[#8A97B1]">Demanda em alta</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-[12px] bg-[#F4F7FE] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#94A1B9]">Margem</div>
            <div className="mt-1 text-[17px] font-semibold tracking-[-0.035em] text-[#0B1B3D]">42%</div>
          </div>
          <div className="rounded-[12px] bg-[#F4F7FE] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#94A1B9]">Score</div>
            <div className="mt-1 text-[17px] font-semibold tracking-[-0.035em] text-[#2563EB]">87</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-6 rounded-full border border-[#E6ECF9] bg-white px-4 py-2 text-[12px] text-[#5B6B8C] shadow-[0_6px_16px_rgba(15,35,95,0.05)]">
        Produto validado
      </div>
      <div className="absolute bottom-6 right-6 rounded-full bg-[#2563EB] px-4 py-2 text-[12px] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)]">
        pronto para testar
      </div>
    </div>
  );
}

function SimpleIcon({ name }: { name: string }) {
  const common = "h-6 w-6";

  if (name === "apps") {
    return (
      <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="2.2" />
        <rect x="4" y="19" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="2.2" />
        <rect x="19" y="19" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="2.2" />
        <path d="M23.5 4v10M18.5 9h10" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
      </svg>
    );
  }

  if (name === "tools") {
    return (
      <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M12 20 5 27M21 5l6 6-5 5-6-6 5-5ZM18 13 9 4 5 8l9 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      </svg>
    );
  }

  if (name === "team") {
    return (
      <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="12" cy="11" r="4" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="22" cy="13" r="3" stroke="currentColor" strokeWidth="2.2" />
        <path d="M5 27c.7-4.6 3.2-7 7-7s6.3 2.4 7 7M18 22c1-.9 2.3-1.4 4-1.4 3.1 0 5 2 5.5 5.4" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
      </svg>
    );
  }

  return (
    <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M8 19v-3a8 8 0 0 1 16 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
      <path d="M8 18H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v-7ZM24 18h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2v-7ZM22 26c-1.2 1.4-3.1 2-6 2" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}

export default function Index() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [openFaq, setOpenFaq] = useState(0);
  const [headerSolid, setHeaderSolid] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const closeMenuTimer = useRef<number>();
  const reduceMotion = useReducedMotion();
  const activePanel = navItems.find((item) => item.label === openMenu && item.panel);
  // Com a aba aberta o header precisa virar sólido: a faixa branca embaixo dele não pode
  // nascer de uma barra transparente sobre a foto.
  const headerOpaque = headerSolid || Boolean(activePanel);
  const heroCarousel = useHeroCarousel();
  const { phrases, active } = heroCarousel;
  const currentPhrase = phrases[active]?.headline ?? "";
  const { display: typedPhrase } = useTypewriter(currentPhrase);
  // Reserva a altura da maior frase para a digitação não empurrar o conteúdo abaixo.
  const longestPhrase = phrases.reduce((longest, slide) => (slide.headline.length > longest.length ? slide.headline : longest), "");

  useEffect(() => {
    const handleScroll = () => setHeaderSolid(window.scrollY > 40);

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    elements.forEach((element, index) => {
      element.style.setProperty("--reveal-delay", `${Math.min((index % 6) * 70, 280)}ms`);
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const authTarget = !authLoading && user ? "/dashboard" : "/auth";
  const ctaLabel = !authLoading && user ? "Entrar no dashboard" : "Começar gratuitamente";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authLoading && user) {
      navigate("/dashboard");
      return;
    }

    const cleanEmail = email.trim();
    if (cleanEmail) window.localStorage.setItem("velo_auth_email", cleanEmail);
    navigate(cleanEmail ? `/auth?email=${encodeURIComponent(cleanEmail)}` : "/auth", {
      state: cleanEmail ? { email: cleanEmail } : undefined,
    });
  };

  /*
    index.css força `scroll-behavior: auto` no html, e isso anula o `behavior: "smooth"`
    passado por JS — medido: com a opção o scroll não sai do lugar; via propriedade CSS ele
    anima. Por isso a landing liga a propriedade enquanto está montada e restaura ao sair.
  */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "smooth";

    return () => {
      root.style.scrollBehavior = previous;
    };
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  /*
    Pequeno atraso ao fechar: sem ele o menu some no vão entre o item e o painel, e o
    usuário nunca consegue levar o mouse até lá.
  */
  const openPanel = (label: string) => {
    window.clearTimeout(closeMenuTimer.current);
    setOpenMenu(label);
  };

  const schedulePanelClose = () => {
    window.clearTimeout(closeMenuTimer.current);
    closeMenuTimer.current = window.setTimeout(() => setOpenMenu(null), 160);
  };

  useEffect(() => {
    if (!openMenu) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openMenu]);

  useEffect(() => () => window.clearTimeout(closeMenuTimer.current), []);

  return (
    <main className="min-h-screen overflow-hidden bg-white font-sans text-[#0B1B3D] [font-family:'Helvetica_Neue',Helvetica,-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',Arial,sans-serif] [font-kerning:normal] [font-optical-sizing:auto]">
      <header
        data-velo-flat-buttons
        onMouseLeave={schedulePanelClose}
        className={`fixed inset-x-0 top-0 z-50 [font-family:'Inter_Variable',Inter,ui-sans-serif,system-ui,sans-serif] transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200 ${
          headerOpaque
            ? "border-b border-[#EDF1F9] bg-white/95 backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        {/* Gutter lateral fixo (sem max-width centralizado) — o hero usa exatamente o mesmo. */}
        <div className="flex w-full items-center justify-between px-6 py-4 sm:px-10 lg:px-12">
          <div className="flex items-center gap-10">
            <button type="button" onClick={() => navigate("/")} aria-label="Velo">
              <VeloLogo tone={headerOpaque ? "dark" : "light"} />
            </button>

            <nav className="hidden items-center gap-8 lg:flex">
              {navItems.map((item) => {
                const isOpen = openMenu === item.label;

                return (
                  <button
                    key={item.target}
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      scrollToSection(item.target);
                    }}
                    onMouseEnter={() => (item.panel ? openPanel(item.label) : setOpenMenu(null))}
                    onFocus={() => (item.panel ? openPanel(item.label) : setOpenMenu(null))}
                    aria-haspopup={item.panel ? "true" : undefined}
                    aria-expanded={item.panel ? isOpen : undefined}
                    className={`flex items-center gap-1.5 text-[15px] font-medium transition-colors duration-200 ${
                      headerOpaque ? "text-[#0B1B3D] hover:text-[#2563EB]" : "text-white hover:text-white/70"
                    }`}
                  >
                    {item.label}
                    {item.panel && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                        className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      >
                        <path d="M4 6.5 8 10.5l4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-5 sm:gap-6">
            <button
              type="button"
              onClick={() => navigate(authTarget)}
              className={`hidden text-[15px] font-medium transition-colors duration-200 sm:block ${
                headerOpaque ? "text-[#0B1B3D] hover:text-[#2563EB]" : "text-white hover:text-white/70"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => navigate(authTarget)}
              className={`h-[42px] rounded-full px-5 text-[14px] font-semibold transition-colors sm:px-6 ${
                headerOpaque ? "bg-[#2563EB] text-white hover:bg-[#1E3A8A]" : "bg-white text-[#0B1B3D] hover:bg-white/90"
              }`}
            >
              {ctaLabel}
            </button>
          </div>
        </div>

        {/*
          Aba full-width que desce do topo: a altura anima de 0 para o conteúdo inteiro, com
          overflow escondido — é isso que dá a sensação de a faixa "descer" em vez de o painel
          simplesmente aparecer. O conteúdo entra com um leve deslocamento próprio, um pouco
          mais lento, para o movimento não parecer travado.
        */}
        <AnimatePresence initial={false}>
          {activePanel && (
            <motion.div
              key="mega-menu"
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-[#EDF1F9] bg-white"
            >
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1], delay: reduceMotion ? 0 : 0.04 }}
                className="w-full px-6 pb-10 pt-8 sm:px-10 lg:px-12"
              >
                <div className="grid gap-x-10 gap-y-7 md:grid-cols-2 lg:grid-cols-3">
                  {activePanel.panel?.map((entry) => (
                    <button
                      key={entry.title}
                      type="button"
                      onClick={() => {
                        setOpenMenu(null);
                        scrollToSection(activePanel.target);
                      }}
                      className="group -m-3 rounded-[14px] p-3 text-left transition-colors hover:bg-[#F4F7FE]"
                    >
                      <span className="block text-[16px] font-semibold text-[#0B1B3D] transition-colors group-hover:text-[#2563EB]">
                        {entry.title}
                      </span>
                      <span className="mt-1.5 block max-w-[300px] text-[14px] leading-[1.5] text-[#5B6B8C]">{entry.text}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/*
        [font-feature-settings:normal] desliga o "cv11" herdado do body (index.css): esse
        character variant troca o "a" do Inter pela versão de andar único, que é o que dava
        à headline a aparência de fonte arredondada/geométrica.
      */}
      <section
        data-velo-flat-buttons
        className="relative isolate flex min-h-[88vh] flex-col justify-end overflow-hidden bg-[#0B1B3D] [font-family:'Inter_Variable',Inter,ui-sans-serif,system-ui,sans-serif] [font-feature-settings:normal] [font-synthesis-weight:none] lg:min-h-[min(92vh,880px)]"
      >
        <HeroBackdrop {...heroCarousel} />

        {/*
          Scrim direcional: escuro só no canto inferior esquerdo, onde o texto vive, e
          praticamente ausente no resto — a foto mantém cor e detalhe. Tom quase preto
          (8,14,28) de propósito: a função é contraste, não tingir a cena de azul.
        */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[rgba(8,14,28,0.1)]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(118%_96%_at_0%_100%,rgba(8,14,28,0.92)_0%,rgba(8,14,28,0.74)_20%,rgba(8,14,28,0.42)_40%,rgba(8,14,28,0.14)_58%,transparent_74%)]" />
        {/* No celular o texto ocupa a largura toda, então o scrim do canto não basta. */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(8,14,28,0.88)_0%,rgba(8,14,28,0.6)_26%,rgba(8,14,28,0.2)_46%,transparent_62%)] sm:hidden" />
        {/* Topo: só o necessário para a navbar não sumir sobre foto clara. */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(8,14,28,0.6)_0%,rgba(8,14,28,0.28)_8%,transparent_20%)]" />
        {/* Topo escurecido: mantém logo e navbar legíveis sobre qualquer imagem. */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(11,27,61,0.97)_0%,rgba(11,27,61,0.82)_8%,rgba(11,27,61,0.4)_16%,transparent_28%)]" />

        {/* Mesmo gutter do header, em todas as resoluções. */}
        <div className="relative w-full px-6 pb-16 pt-32 sm:px-10 sm:pb-20 lg:px-12 lg:pb-24">
          {/* font-family explícito: a regra global de h1–h6 em index.css força Hanken Grotesk. */}
          {/*
            As duas linhas usam exatamente o mesmo estilo (peso 200, branco): a diferença
            entre elas é só estrutural — uma é fixa, a outra é digitada.
          */}
          <h1 className="max-w-[900px] text-[clamp(2.125rem,4.35vw,4rem)] font-extralight leading-[1.04] tracking-[-0.035em] text-white antialiased [font-family:'Inter_Variable',Inter,ui-sans-serif,system-ui,sans-serif]">
            <span className="block">Comece a vender</span>
            {/*
              minmax(0,1fr) é o que impede o texto de estourar a viewport: sem isso a coluna
              implícita do grid é dimensionada por max-content e a frase vaza em vez de quebrar.
            */}
            <span className="grid grid-cols-[minmax(0,1fr)]">
              <span aria-hidden="true" className="invisible col-start-1 row-start-1 [overflow-wrap:anywhere]">
                {longestPhrase}
              </span>
              <span className="col-start-1 row-start-1 [overflow-wrap:anywhere]">
                <span className="sr-only">{currentPhrase}</span>
                <span aria-hidden="true">{typedPhrase}</span>
                <span
                  aria-hidden="true"
                  className="ml-[0.06em] inline-block h-[0.72em] w-[0.05em] translate-y-[0.04em] animate-pulse bg-white align-baseline"
                />
              </span>
            </span>
          </h1>

          <p className="mt-6 max-w-[420px] text-[16px] leading-[1.55] tracking-[-0.01em] text-white/70 sm:text-[18px]">
            A Velo encontra oportunidades de produto, ajuda a montar o anúncio e a publicar no Mercado Livre e na Shopee.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => navigate(authTarget)}
              className="h-[54px] rounded-full bg-white px-8 text-[16px] font-semibold text-[#0B1B3D] transition-colors hover:bg-white/90"
            >
              {ctaLabel}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("como-funciona")}
              className="h-[54px] rounded-full border border-white/70 px-8 text-[16px] font-medium text-white transition hover:border-white hover:bg-white/10"
            >
              Ver como funciona
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => scrollToSection("como-funciona")}
          className="group absolute bottom-10 right-8 hidden items-center gap-3 text-[14px] text-white/55 transition hover:text-white lg:flex"
        >
          <span className="h-px w-10 bg-white/35 transition group-hover:bg-white/80" />
          Como a Velo escolhe os produtos
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2.5v11M3.5 9.5 8 14l4.5-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
          </svg>
        </button>
      </section>

      <section id="integracoes" className="scroll-mt-20 border-y border-[#EDF1F9] bg-[#FBFCFF]">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-12 sm:px-8 sm:py-14">
          <p data-reveal className="text-center text-[13px] font-medium uppercase tracking-[0.14em] text-[#8A97B1]">
            Integrado com as maiores plataformas do Brasil
          </p>

          <div className="relative mt-8 overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#FBFCFF] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#FBFCFF] to-transparent" />
            <div className="flex w-max items-center gap-14 [animation:velo-logo-marquee_22s_linear_infinite] sm:gap-20">
              {marqueeLogos.map((brand, index) => (
                <div
                  key={`${brand.name}-${index}`}
                  aria-label={brand.name}
                  className="flex h-[40px] min-w-[160px] shrink-0 items-center justify-center whitespace-nowrap sm:h-[44px] sm:min-w-[190px]"
                >
                  <OperationLogo logo={brand} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-20 bg-white px-6 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto max-w-[1200px]">
          <div data-reveal className="mx-auto max-w-[720px] text-center">
            <h2 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-[#0B1B3D] sm:text-[44px] lg:text-[50px]">
              Um processo de vendas mais inteligente começa aqui
            </h2>
            <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-[1.6] text-[#5B6B8C] sm:text-[18px]">
              Da descoberta do produto até a publicação nos marketplaces, tudo em um fluxo único e simples de seguir.
            </p>
          </div>

          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            {processCards.map((card) => (
              <article
                data-reveal
                key={card.title}
                className="group rounded-[24px] border border-[#EAEFF9] bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-[#D9E3F8] hover:shadow-[0_24px_60px_rgba(15,35,95,0.08)]"
              >
                <ProcessVisual type={card.visual} />
                <h3 className="mt-7 text-[20px] font-semibold leading-[1.25] tracking-[-0.02em] text-[#0B1B3D] sm:text-[22px]">{card.title}</h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-[#5B6B8C] sm:text-[16px]">{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#FBFCFF] px-6 py-24 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-[1200px]">
          <div data-reveal className="rounded-[28px] border border-[#E6ECF9] bg-white px-8 py-12 text-center shadow-[0_20px_50px_rgba(15,35,95,0.05)] sm:px-14 sm:py-16">
            <blockquote className="mx-auto max-w-[860px] text-[24px] font-semibold leading-[1.28] tracking-[-0.03em] text-[#0B1B3D] sm:text-[32px]">
              “A melhor operação começa quando você entende o produto, o canal e o próximo passo com clareza.”
            </blockquote>
            <div className="mt-7 text-[15px] font-semibold text-[#2563EB]">Velo</div>
            <div className="mt-1 text-[14px] text-[#8A97B1]">Plataforma para encontrar produtos e vender online</div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {statsCards.map((stat) => (
              <div data-reveal key={stat.value} className="rounded-[22px] border border-[#EAEFF9] bg-white px-8 py-9">
                <div className="text-[36px] font-semibold leading-none tracking-[-0.04em] text-[#2563EB] md:text-[42px]">{stat.value}</div>
                <p className="mt-4 max-w-[460px] text-[16px] leading-[1.6] text-[#5B6B8C]">{stat.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="recursos" className="scroll-mt-20 bg-white px-6 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto max-w-[1200px]">
          <div data-reveal className="max-w-[680px]">
            <h2 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-[#0B1B3D] sm:text-[44px] lg:text-[50px]">
              A plataforma para começar no ecommerce
            </h2>
            <p className="mt-5 max-w-[560px] text-[17px] leading-[1.6] text-[#5B6B8C] sm:text-[18px]">
              Uma rotina mais clara para descobrir produtos, organizar canais e acompanhar suas vendas.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {supportItems.map((item) => (
              <article
                data-reveal
                key={item.title}
                className="rounded-[22px] border border-[#EAEFF9] bg-[#FBFCFF] p-7 transition duration-300 hover:border-[#D9E3F8] hover:bg-white hover:shadow-[0_20px_50px_rgba(15,35,95,0.07)]"
              >
                <div className="grid h-11 w-11 place-items-center rounded-[13px] bg-[#EEF3FF] text-[#2563EB]">
                  <SimpleIcon name={item.icon} />
                </div>
                <h3 className="mt-6 text-[19px] font-semibold leading-[1.25] tracking-[-0.02em] text-[#0B1B3D]">{item.title}</h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-[#5B6B8C]">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="perguntas-frequentes" className="scroll-mt-20 bg-[#FBFCFF] px-6 py-24 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-[900px]">
          <h2 data-reveal className="text-center text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] text-[#0B1B3D] sm:text-[44px]">
            Perguntas frequentes
          </h2>

          <div className="mt-12 overflow-hidden rounded-[22px] border border-[#E6ECF9] bg-white">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;

              return (
                <div data-reveal key={item.question} className="border-b border-[#EDF1F9] px-6 py-6 last:border-b-0 sm:px-8">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between gap-6 text-left"
                  >
                    <span className="text-[17px] font-semibold leading-[1.35] tracking-[-0.02em] text-[#0B1B3D] sm:text-[19px]">
                      {item.question}
                    </span>
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[22px] font-normal leading-none transition ${
                        isOpen ? "bg-[#2563EB] text-white" : "bg-[#F1F5FE] text-[#2563EB]"
                      }`}
                    >
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  {isOpen && (
                    <p className="mt-4 max-w-[700px] text-[16px] leading-[1.65] text-[#5B6B8C]">
                      {item.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-24 sm:px-8 lg:py-28">
        <div data-reveal className="relative mx-auto max-w-[1000px] overflow-hidden rounded-[30px] border border-[#E1E9F8] bg-[linear-gradient(180deg,#F7FAFF,#EDF3FF)] px-6 py-16 text-center sm:px-14">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_50%_0%,rgba(37,99,235,0.12),transparent_60%)]" />

          <div className="relative">
            <h2 className="mx-auto max-w-[720px] text-[32px] font-semibold leading-[1.12] tracking-[-0.035em] text-[#0B1B3D] sm:text-[44px]">
              A plataforma é nossa, mas as oportunidades são suas.
            </h2>

            <form
              onSubmit={handleSubmit}
              className="mx-auto mt-9 flex h-[58px] max-w-[480px] items-center rounded-full border border-[#E1E9F8] bg-white p-[5px] shadow-[0_12px_30px_rgba(15,35,95,0.07)]"
            >
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Digite seu e-mail"
                className="min-w-0 flex-1 bg-transparent px-5 text-[15px] text-[#0B1B3D] outline-none placeholder:text-[#9AA6BE]"
              />
              <button
                type="submit"
                className="h-[48px] rounded-full bg-[#2563EB] px-6 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.24)] transition hover:bg-[#1E3A8A]"
              >
                {!authLoading && user ? "Entrar no dashboard" : "Começar agora"}
              </button>
            </form>

            <p className="mt-5 text-[14px] tracking-[-0.01em] text-[#8A97B1]">
              Você concorda em receber e-mails de marketing da Velo.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#EDF1F9] bg-white px-6 py-12 sm:px-8">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#2563EB] text-white">
              <svg width="22" height="22" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <path d="M19.3 9.4A7.4 7.4 0 1 0 19.3 18.6" stroke="currentColor" strokeLinecap="round" strokeWidth="2.8" />
                <path d="M16.8 16.2L20 19.3L23.2 16.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.45" />
              </svg>
            </div>
            <span className="text-[22px] font-bold tracking-[-0.05em] text-[#0B1B3D]">Velo</span>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-[15px] text-[#5B6B8C]">
            <a href="#top" className="transition hover:text-[#2563EB]">Produto</a>
            <a href="#top" className="transition hover:text-[#2563EB]">Integrações</a>
            <a href="#top" className="transition hover:text-[#2563EB]">Privacidade</a>
            <a href="#top" className="transition hover:text-[#2563EB]">Termos</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
