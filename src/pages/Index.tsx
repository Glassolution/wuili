import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ImagemResponsiva } from "@/components/landing/ImagemResponsiva";


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
  /*
    "Integrações" saiu junto com a faixa de logos: o item apontava para a seção
    #integracoes, que não existe mais. Sem a seção, o clique não levaria a lugar
    nenhum. O conteúdo das integrações segue descrito no FAQ.
  */
  { label: "Perguntas frequentes", target: "perguntas-frequentes" },
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
    answer: "Sim. O Mercado Livre é o canal onde a Velo publica hoje: você conecta sua conta e o anúncio sai da plataforma com título, descrição e fotos já montados.",
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

/*
  Larguras geradas por scripts/otimizar-imagens-landing.sh. A foto do topo
  ocupa a largura toda da tela, então precisa da maior; as demais aparecem em
  molduras de no máximo ~600px no desktop.
*/
const LARGURAS_FOTO = [640, 960, 1280, 1672];
const LARGURAS_BARRA = [640, 960, 1280];

const HERO_SLIDES = [
  /*
    focus: ponto focal do recorte, no formato de object-position ("50% 50%" = centro).
    O padrão é o centro e serve para qualquer enquadramento — só vale ajustar se alguma
    foto específica tiver o sujeito muito fora do meio e ficar cortada no celular, onde
    cabe bem menos da largura original.
  */
  { src: "/pessoa%2001.webp", base: "pessoa-01", focus: "50% 50%", headline: "sem estoque, sem risco." },
  { src: "/pessoa%2002.webp", base: "pessoa-02", focus: "50% 50%", headline: "com o produto certo." },
  { src: "/pessoa%2003.webp", base: "pessoa-03", focus: "50% 50%", headline: "em poucos minutos." },
];

/*
  PLACEHOLDER TEMPORÁRIO — some sozinho assim que qualquer foto de HERO_SLIDES carregar.
  É um mockup com avatar gerado por IA, não um vendedor real usando a Velo.
*/
const HERO_PLACEHOLDER = "/hero-pasted-image-2.webp";

/*
  Seção de prova visual, logo abaixo do hero.

  Os nomes dos arquivos têm espaço, então o caminho vai com %20 — sem isso o
  Vite serve o index.html de fallback no lugar do PNG e a imagem quebra.

  Como na referência, as duas imagens ocupam exatamente o mesmo tamanho e ficam
  alinhadas pelo topo. Os arquivos não têm a mesma proporção (1409x1117 = 1,261
  e 1448x1086 = 1,333), então a moldura impõe uma proporção comum e o object-cover
  acerta o resto. O valor abaixo é a média das duas: assim o corte se divide entre
  elas (~3% na altura da primeira, ~2,5% na largura da segunda) em vez de recair
  todo sobre uma. Trocar por 1/1 ou 16/9 cortaria conteúdo de verdade.
*/
const PROPORCAO_PROVA = "1.297";

/*
  Tipografia das headlines de seção, igual à referência: Inter em peso leve,
  tamanho grande e tracking negativo. Peso 300 (não 200) porque estas seções são
  sobre fundo claro — fino demais no branco fica lavado. Sobre o fundo azul do
  Atlas o mesmo 300 aparenta um pouco mais grosso, o que é o efeito esperado.

  Está num só lugar para as seções não divergirem entre si com o tempo.
*/
const HEADLINE = "font-light leading-[1.12] tracking-[-0.03em] antialiased [font-family:Inter,ui-sans-serif,system-ui,sans-serif] [font-feature-settings:normal]";
const HEADLINE_TAMANHO = "text-[clamp(1.75rem,3.2vw,3rem)]";

const PROVA_VISUAL = [
  {
    src: "/barra%2001.webp",
    base: "barra-01",
    alt: "Conversa com a IA da Velo recomendando produtos com preço e loja",
  },
  {
    src: "/barra%2002.webp",
    base: "barra-02",
    alt: "Loja da Velo com produtos selecionados e marketplaces conectados",
  },
];

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
        /*
          A foto do topo cobre a tela inteira, por isso sizes="100vw": o
          navegador pega a de 640px num celular comum e a de 1672px num monitor
          grande, em vez do PNG de ~1,9 MB que vinha antes para todo mundo.

          A primeira é prioritária — é o maior elemento da primeira tela e o
          index.html já manda buscá-la antes do JavaScript montar a página.
          As seguintes só entram no DOM depois que ela pinta (ver preloadRest).
        */
        <ImagemResponsiva
          key={slide.src}
          base={slide.base}
          larguras={LARGURAS_FOTO}
          original={`${slide.src}?v=${HERO_ASSET_VERSION}`}
          sizes="100vw"
          alt=""
          aria-hidden
          prioritaria={slideIndex === 0}
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

/*
  Mesma estrutura da referência: headline de duas linhas em dois tons, seguida de
  uma grade assimétrica de imagens sem legenda.

  A referência é sobre fundo escuro; aqui é branco. Isso não é só trocar a cor:
  peso fino sobre fundo claro parece mais fino do que sobre escuro (o fundo
  "invade" a letra no escuro e engorda o traço). Por isso o peso sobe de 200 para
  300 — no branco, 200 ficaria lavado e quebradiço no tamanho grande.
*/
function SecaoProvaVisual() {
  return (
    <section id="como-funciona" className="scroll-mt-20 bg-white px-6 py-16 sm:px-10 sm:py-28 lg:px-12 lg:py-40">
      <div className="mx-auto w-full max-w-[1200px]">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          // Logo abaixo do topo: esperar 30% do título deixava uma faixa branca sob as fotos.
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          /*
            Cada frase precisa caber em UMA linha, como na referência. Com o
            Mercado Livre sozinho, a linha 1 passou a ser a mais longa (~23x o
            tamanho da fonte): a 3rem ela pede ~1107px e o container dá 1200px.
            Mexer no tamanho sem refazer essa conta faz a frase quebrar em duas.
          */
          className={`${HEADLINE_TAMANHO} ${HEADLINE} leading-[1.18]`}
        >
          <span className="block">
            <span className="text-[#0B1B3D]">Do produto ao anúncio pronto.</span>{" "}
            <span className="text-[#0B1B3D]/40">Sem digitar uma linha.</span>
          </span>
          <span className="block">
            <span className="text-[#0B1B3D]">Publicado no Mercado Livre.</span>{" "}
            <span className="text-[#0B1B3D]/40">Em poucos minutos.</span>
          </span>
        </motion.h2>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 sm:items-start lg:mt-20 lg:gap-7">
          {PROVA_VISUAL.map((item, indice) => (
            <motion.figure
              key={item.src}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: indice * 0.1 }}
            >
              <div
                className="overflow-hidden rounded-[20px] border border-[#E9EEF8] bg-[#FBFCFF]"
                style={{ aspectRatio: PROPORCAO_PROVA }}
              >
                {/*
                  Até 640px a barra ocupa a largura da tela menos os 24px de
                  respiro de cada lado; a partir daí a grade vira duas colunas
                  e cada uma fica com metade, limitada pelos 1200px do container.
                */}
                <ImagemResponsiva
                  base={item.base}
                  larguras={LARGURAS_BARRA}
                  original={item.src}
                  sizes="(min-width: 1200px) 600px, (min-width: 640px) 50vw, calc(100vw - 48px)"
                  alt={item.alt}
                  className="block h-full w-full object-cover"
                />
              </div>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function VeloLogo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <div className={`flex items-center gap-2.5 transition-colors duration-200 ${tone === "light" ? "text-white" : "text-[#0B1B3D]"}`}>
      {/* 36x36 na tela: o PNG de 146 KB era desperdício puro. O WebP de 96px
          cobre retina com 2 KB. */}
      <ImagemResponsiva
        base="logo"
        larguras={[96]}
        original="/logo.png"
        sizes="36px"
        alt="Velo"
        prioritaria
        width={36}
        height={36}
        className="block h-9 w-9 shrink-0 object-contain"
      />
      <span className="text-[26px] font-bold leading-none tracking-[-0.06em]">Velo</span>
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showMobileStickyCta, setShowMobileStickyCta] = useState(false);
  const closeMenuTimer = useRef<number>();
  const mobileHeroCtaRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  /*
    Funil da landing (só leitura de números agregados, nada de dado pessoal): visita,
    clique no botão principal, clique em "Como funciona" e clique em "Já tenho conta".
  */
  const [assinantesAtivos, setAssinantesAtivos] = useState<number | null>(null);

  const registrarEvento = async (evento: string) => {
    try {
      let visitor = window.localStorage.getItem("velo_visitor_id");
      if (!visitor) {
        visitor = crypto.randomUUID();
        window.localStorage.setItem("velo_visitor_id", visitor);
      }
      const params = new URLSearchParams(window.location.search);
      const ua = navigator.userAgent || "";
      const interno = /Instagram|FBAN|FBAV|FB_IAB|Messenger|musical_ly|Bytedance|TikTok|Trill/i.test(ua);
      let origem = params.get("utm_source") || params.get("ref") || null;
      if (!origem && document.referrer) {
        try { origem = new URL(document.referrer).hostname.replace(/^www\./, ""); } catch { origem = null; }
      }
      if (!origem && interno) origem = "rede-social";
      await supabase.rpc("rpc_landing_track", {
        p_event: evento,
        p_visitor_id: visitor,
        p_device: window.innerWidth < 640 ? "mobile" : "desktop",
        p_referrer: document.referrer || null,
        p_origem: origem ?? "direto",
        p_utm_medium: params.get("utm_medium"),
        p_utm_campaign: params.get("utm_campaign"),
        p_browser: interno ? "interno" : "normal",
      });
    } catch {
      /* medição nunca pode quebrar a página */
    }
  };

  useEffect(() => {
    void registrarEvento("landing_view");

    supabase
      .rpc("rpc_landing_stats")
      .then(({ data }) => {
        const total = (data as { assinantes_ativos?: number } | null)?.assinantes_ativos;
        if (typeof total === "number") setAssinantesAtivos(total);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activePanel = navItems.find((item) => item.label === openMenu && item.panel);
  // Com a aba aberta o header precisa virar sólido: a faixa branca embaixo dele não pode
  // nascer de uma barra transparente sobre a foto.
  const headerOpaque = headerSolid || Boolean(activePanel) || mobileNavOpen;
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
    const button = mobileHeroCtaRef.current;
    if (!button || window.innerWidth >= 640) return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowMobileStickyCta(!entry.isIntersecting && entry.boundingClientRect.bottom < 0),
      { threshold: 0 },
    );
    observer.observe(button);
    return () => observer.disconnect();
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

  // Logado, o botão só leva ao dashboard: contar como clique de cadastro inflaria o funil.
  const registrarCliqueCadastro = (evento: string) => {
    if (!user) void registrarEvento(evento);
  };

  const authTarget = !authLoading && user ? "/dashboard" : "/login";
  // Botão principal do celular: quem ainda não tem conta cai direto no passo de cadastro.
  const signupTarget = !authLoading && user ? "/dashboard" : "/login?novo=1";
  const ctaLabel = !authLoading && user ? "Entrar no dashboard" : "Começar agora";


  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authLoading && user) {
      navigate("/dashboard");
      return;
    }

    registrarCliqueCadastro("cta_final_signup_click");
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

  /*
    Com o painel mobile aberto a página atrás não pode rolar: no iOS o toque "vaza" para o
    body e o menu desliza junto enquanto o dedo arrasta.
  */
  useEffect(() => {
    if (!mobileNavOpen) return;

    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileNavOpen]);

  const goToSectionFromMobileNav = (id: string) => {
    setMobileNavOpen(false);
    /*
      Destrava o body aqui em vez de esperar a limpeza do efeito: ela roda no flush de
      efeitos passivos, depois do paint, e qualquer scroll agendado antes disso acontece
      com overflow:hidden ainda de pé — ou seja, não acontece. Medido: sem esta linha o
      clique fechava o menu e a página não saía do topo.
    */
    document.body.style.overflow = "";
    window.setTimeout(() => scrollToSection(id), 0);
  };

  useEffect(() => () => window.clearTimeout(closeMenuTimer.current), []);

  return (
    <main className="min-h-screen overflow-hidden bg-white font-sans text-[#0B1B3D] [font-family:'Helvetica_Neue',Helvetica,-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',Arial,sans-serif] [font-kerning:normal] [font-optical-sizing:auto]">
      <header
        data-velo-flat-buttons
        onMouseLeave={schedulePanelClose}
        className={`fixed inset-x-0 top-0 z-50 [font-family:'Inter_Variable',Inter,ui-sans-serif,system-ui,sans-serif] transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200 ${
          headerOpaque
            ? /*
                Com o painel mobile aberto o branco é sólido: a 95% a foto escura do hero
                atravessava a barra e ela ficava cinza ao lado do painel, que é branco puro.
              */
              `border-b border-[#EDF1F9] backdrop-blur-md ${mobileNavOpen ? "bg-white" : "bg-white/95"}`
            : "border-b border-transparent bg-transparent"
        }`}
      >
        {/* Gutter lateral fixo (sem max-width centralizado) — o hero usa exatamente o mesmo. */}
        <div className="flex w-full items-center justify-between px-6 py-4 sm:px-10 lg:px-12">
          <div className="flex items-center gap-10">
            <button type="button" onClick={() => navigate("/")} aria-label="Velo">
              {/* No celular o topo é claro: o logo é sempre escuro. */}
              <span className="sm:hidden">
                <VeloLogo tone="dark" />
              </span>
              <span className="hidden sm:block">
                <VeloLogo tone={headerOpaque ? "dark" : "light"} />
              </span>
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
              onClick={() => {
                void registrarEvento("cta_header_login_click");
                navigate(authTarget);
              }}
              className={`hidden text-[15px] font-medium transition-colors duration-200 sm:block ${
                headerOpaque ? "text-[#0B1B3D] hover:text-[#2563EB]" : "text-white hover:text-white/70"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                registrarCliqueCadastro("cta_primary_click");
                navigate(authTarget);
              }}
              className={`hidden h-[42px] rounded-full px-5 text-[14px] font-semibold transition-colors sm:block sm:px-6 ${
                headerOpaque ? "bg-[#2563EB] text-white hover:bg-[#1E3A8A]" : "bg-white text-[#0B1B3D] hover:bg-white/90"
              }`}
            >
              {ctaLabel}
            </button>

            {/*
              Abaixo de lg a navegação inteira fica escondida (a <nav> é lg:flex), então sem
              este botão "Como funciona", "Recursos", "FAQ" e "Entrar" simplesmente não existem
              no celular. As duas barras viram X quando o painel abre. No celular o header é
              só logo e menu: "Entrar" mora dentro do painel.
            */}
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-label={mobileNavOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileNavOpen}
              aria-controls="menu-mobile"
              className={`-mr-2 flex h-11 w-11 items-center justify-center rounded-full transition-colors max-sm:text-[#141414] lg:hidden ${
                headerOpaque ? "text-[#0B1B3D] hover:bg-[#F4F7FE]" : "text-white hover:bg-white/10"
              }`}
            >
              <span className="relative block h-[14px] w-[22px]" aria-hidden="true">
                <span
                  className={`absolute left-0 block h-[2px] w-full rounded-full bg-current transition-transform duration-300 ${
                    mobileNavOpen ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"
                  }`}
                />
                <span
                  className={`absolute left-0 block h-[2px] w-full rounded-full bg-current transition-transform duration-300 ${
                    mobileNavOpen ? "top-1/2 -translate-y-1/2 -rotate-45" : "top-full -translate-y-full"
                  }`}
                />
              </span>
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

        {/*
          Painel mobile: mesma animação de altura do mega menu do desktop, para as duas
          navegações abrirem do mesmo jeito.
        */}
        <AnimatePresence initial={false}>
          {mobileNavOpen && (
            <motion.div
              key="menu-mobile"
              id="menu-mobile"
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-[#EDF1F9] bg-white lg:hidden"
            >
              <div className="flex flex-col px-6 pb-8 pt-4 sm:px-10">
                {navItems.map((item) => (
                  <button
                    key={item.target}
                    type="button"
                    onClick={() => goToSectionFromMobileNav(item.target)}
                    className="border-b border-[#EDF1F9] py-4 text-left text-[17px] font-medium text-[#0B1B3D]"
                  >
                    {item.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    void registrarEvento("cta_header_login_click");
                    setMobileNavOpen(false);
                    navigate(authTarget);
                  }}
                  className="py-4 text-left text-[17px] font-medium text-[#0B1B3D]"
                >
                  {!authLoading && user ? "Ir para o dashboard" : "Entrar"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    registrarCliqueCadastro("cta_primary_click");
                    setMobileNavOpen(false);
                    navigate(authTarget);
                  }}
                  className="mt-2 h-[52px] rounded-full bg-[#2563EB] text-[16px] font-semibold text-white transition-colors hover:bg-[#1E3A8A]"
                >
                  {ctaLabel}
                </button>
              </div>
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
        className="relative isolate flex min-h-0 flex-col justify-start overflow-hidden bg-[#0B1B3D] sm:min-h-[88vh] sm:justify-end [font-family:'Inter_Variable',Inter,ui-sans-serif,system-ui,sans-serif] [font-feature-settings:normal] [font-synthesis-weight:none] lg:min-h-[min(92vh,880px)]"
      >
        {/*
          No celular a foto de fundo cortava o rosto e disputava com o texto. Aqui ela
          sai do fundo e vira um cartão enquadrado mais abaixo; o fundo passa a ser o
          gradiente da marca. No desktop nada muda: o carrossel continua como estava.
        */}
        <div className="pointer-events-none absolute inset-0 -z-10 hidden sm:block">
          <HeroBackdrop {...heroCarousel} />
        </div>

        {/* Fundo do celular: off-white quente, liso. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[#F6F4EF] sm:hidden" />

        {/*
          Scrim direcional: escuro só no canto inferior esquerdo, onde o texto vive, e
          praticamente ausente no resto — a foto mantém cor e detalhe. Tom quase preto
          (8,14,28) de propósito: a função é contraste, não tingir a cena de azul.
        */}
        <div className="pointer-events-none absolute inset-0 -z-10 hidden bg-[rgba(8,14,28,0.1)] sm:block" />
        <div className="pointer-events-none absolute inset-0 -z-10 hidden bg-[radial-gradient(118%_96%_at_0%_100%,rgba(8,14,28,0.92)_0%,rgba(8,14,28,0.74)_20%,rgba(8,14,28,0.42)_40%,rgba(8,14,28,0.14)_58%,transparent_74%)] sm:block" />
        {/* Topo: só o necessário para a navbar não sumir sobre foto clara. */}
        <div className="pointer-events-none absolute inset-0 -z-10 hidden bg-[linear-gradient(180deg,rgba(8,14,28,0.6)_0%,rgba(8,14,28,0.28)_8%,transparent_20%)] sm:block" />
        {/* Topo escurecido: mantém logo e navbar legíveis sobre qualquer imagem. */}
        <div className="pointer-events-none absolute inset-0 -z-10 hidden bg-[linear-gradient(180deg,rgba(11,27,61,0.97)_0%,rgba(11,27,61,0.82)_8%,rgba(11,27,61,0.4)_16%,transparent_28%)] sm:block" />

        {/*
          Hero do celular: fundo claro, uma frase, um botão, fotos embaixo.
        */}
        <div className="relative flex w-full flex-col items-center px-6 pt-28 text-center sm:hidden">
          <span className="inline-flex items-center gap-2.5 text-[13.5px] font-medium text-[#6F6A62]">
            <span className="h-2 w-2 rounded-full bg-[#2563EB] ring-4 ring-[#2563EB]/15" aria-hidden="true" />
            {assinantesAtivos !== null && assinantesAtivos >= 50
              ? `+${Math.floor(assinantesAtivos / 50) * 50} assinaturas ativas`
              : "Catálogo pronto para o Mercado Livre"}
          </span>

          <h1 className="mt-6 max-w-[340px] text-[2.35rem] font-medium leading-[1.08] tracking-[-0.035em] text-[#141414] antialiased [font-family:'Inter_Variable',Inter,ui-sans-serif,system-ui,sans-serif]">
            Escolha um produto e venda no{" "}
            <span className="inline-flex items-center gap-[0.18em] whitespace-nowrap">
              <img
                src="/brand/mercado-livre.png"
                alt=""
                aria-hidden="true"
                width={200}
                height={200}
                // O PNG tem fundo branco: multiply faz o branco sumir no off-white do hero.
                className="-my-[0.1em] h-[1.3em] w-[1.3em] shrink-0 object-contain mix-blend-multiply"
              />
              <span className="text-[1.12em] font-normal italic tracking-[-0.01em] [font-family:'Instrument_Serif',Georgia,serif]">
                Mercado Livre
              </span>
            </span>
          </h1>

          <p className="mt-4 max-w-[310px] text-[15.5px] leading-[1.55] text-[#6F6A62]">
            Você define o preço e fica com a diferença para o custo do fornecedor.
          </p>

          <button
            ref={mobileHeroCtaRef}
            type="button"
            onClick={() => {
              registrarCliqueCadastro("cta_hero_signup_click");
              navigate(signupTarget);
            }}
            className="relative mt-7 h-[58px] w-full rounded-full bg-[#2563EB] px-8 text-[17px] font-bold text-white transition-transform active:scale-[0.98]"
          >
            {!authLoading && user ? "Continuar na Velo" : "Começar a vender"}

            {/*
              Cursor "tocando" o botão: o ponto de origem do span é a ponta do dedo, e a
              onda sai dali a cada toque. O SVG é deslocado para a ponta cair nesse ponto.
            */}
            <span aria-hidden="true" className="pointer-events-none absolute right-[11%] top-[34%]">
              {!reduceMotion && (
                <motion.span
                  className="absolute -left-2 -top-2 block h-4 w-4 rounded-full bg-white/70"
                  animate={{ scale: [0.4, 2.2], opacity: [0.8, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: 0.25 }}
                />
              )}
              <motion.svg
                width="32"
                height="31"
                viewBox="0 0 24 23"
                className="relative block drop-shadow-[0_2px_3px_rgba(11,27,61,0.35)]"
                style={{ x: -12, originX: 0.37, originY: 0 }}
                animate={reduceMotion ? undefined : { y: [4, 0, 0, 4], scale: [1, 0.88, 1, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", times: [0, 0.18, 0.35, 1] }}
              >
                {/* Mãozinha do macOS: luva branca gordinha, contorno preto grosso, indicador para cima. */}
                <path
                  d="M6.9 3C6.9 1.9 7.8 1.2 8.8 1.2S10.5 1.9 10.6 2.9L11.1 7.4C11.4 6.4 12.3 5.9 13.2 6.1S14.5 7 14.5 7.9C14.9 7 15.9 6.5 16.8 6.8S18 7.8 18 8.7C18.5 8 19.4 7.8 20.2 8.2S21.4 9.4 21.4 10.3V14C21.4 16.2 20.7 17.8 19.7 19V21.2H16.6L15 19.9 13.6 21.2H9.2L8.6 19C7.4 17.6 5.6 16.3 4.3 14.6 3 13 2.2 11.8 2.6 10.4S4.3 9 5.3 9.6C5.9 10 6.5 10.6 6.9 11.2Z"
                  fill="#fff"
                  stroke="#000"
                  strokeWidth="1.25"
                  strokeLinejoin="round"
                />
                <path d="M12 13.2v3.4M14.4 13.2v3.4M16.8 13.2v3.4" stroke="#000" strokeWidth="1.2" strokeLinecap="round" />
              </motion.svg>
            </span>
          </button>

          {(authLoading || !user) && (
            <p className="mt-3 max-w-[320px] text-[13.5px] font-medium leading-[1.45] text-[#4A463F] [text-wrap:balance]">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mr-1.5 inline-block -translate-y-px align-middle text-[#16A34A]">
                <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              Comece sem cartão e sem estoque.
            </p>
          )}

          <p className="mt-4 max-w-[340px] text-[11px] leading-[1.45] text-[#8A857C]">
            A Velo é uma plataforma independente e não faz parte do Mercado Livre.
          </p>

          {/*
            Duas fotos levemente inclinadas, sangrando nas laterais e no rodapé da seção.
            A seção tem overflow-hidden, então o corte embaixo é intencional.
          */}
          <div aria-hidden="true" className="relative mt-12 h-[250px] w-[calc(100%+48px)]">
            <div className="absolute -left-[4%] top-2 h-[300px] w-[56%] -rotate-[4deg] overflow-hidden rounded-[18px] shadow-[0_18px_40px_rgba(40,32,20,0.18)]">
              <ImagemResponsiva
                base="pessoa-01"
                larguras={[640, 960]}
                original="/pessoa%2001.webp"
                sizes="60vw"
                alt=""
                prioritaria
                className="h-full w-full object-cover object-[55%_50%]"
              />
            </div>
            <div className="absolute -right-[4%] top-0 h-[300px] w-[56%] rotate-[3deg] overflow-hidden rounded-[18px] shadow-[0_18px_40px_rgba(40,32,20,0.18)]">
              <ImagemResponsiva
                base="pessoa-02"
                larguras={[640, 960]}
                original="/pessoa%2002.webp"
                sizes="60vw"
                alt=""
                className="h-full w-full object-cover object-[66%_50%]"
              />
            </div>
          </div>
        </div>


        {/* Mesmo gutter do header, em todas as resoluções. */}
        <div className="relative hidden w-full px-6 pb-14 pt-32 sm:block sm:px-10 sm:pb-20 lg:px-12 lg:pb-24">
          {/* font-family explícito: a regra global de h1–h6 em index.css força Hanken Grotesk. */}
          {/*
            As duas linhas usam exatamente o mesmo estilo (peso 200, branco): a diferença
            entre elas é só estrutural — uma é fixa, a outra é digitada.
          */}
          <h1 className="max-w-[900px] text-[2.75rem] leading-[1.02] font-extralight tracking-[-0.035em] text-white antialiased sm:text-[clamp(2.125rem,4.35vw,4rem)] sm:leading-[1.04] [font-family:'Inter_Variable',Inter,ui-sans-serif,system-ui,sans-serif]">
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

          <p className="mt-5 max-w-[420px] text-[16px] leading-[1.55] tracking-[-0.01em] text-white/70 sm:mt-6 sm:text-[18px]">
            A Velo encontra oportunidades de produto, ajuda a montar o anúncio e a publicar no Mercado Livre.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:mt-9 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={() => {
                registrarCliqueCadastro("cta_hero_signup_click");
                navigate(authTarget);
              }}
              className="h-[56px] w-full rounded-full bg-white px-8 text-[17px] font-semibold text-[#0B1B3D] transition-colors hover:bg-white/90 sm:h-[54px] sm:w-auto sm:text-[16px]"
            >
              {ctaLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                void registrarEvento("cta_how_it_works_click");
                scrollToSection("como-funciona");
              }}
              className="self-center text-[16px] font-medium text-white underline decoration-white/50 underline-offset-[6px] transition hover:decoration-white max-sm:inline-flex max-sm:min-h-[44px] max-sm:items-center max-sm:justify-center sm:h-[54px] sm:self-auto sm:rounded-full sm:border sm:border-white/70 sm:px-8 sm:no-underline sm:hover:border-white sm:hover:bg-white/10"
            >
              Ver como funciona
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void registrarEvento("cta_how_it_works_click");
            scrollToSection("como-funciona");
          }}
          className="group absolute bottom-10 right-8 hidden items-center gap-3 text-[14px] text-white/55 transition hover:text-white lg:flex"
        >
          <span className="h-px w-10 bg-white/35 transition group-hover:bg-white/80" />
          Como a Velo escolhe os produtos
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2.5v11M3.5 9.5 8 14l4.5-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
          </svg>
        </button>
      </section>

      <SecaoProvaVisual />


      {/*
        Headline à esquerda e texto de apoio à direita, como na referência, com o
        print ocupando a largura inteira logo abaixo. O print é real (a tela de
        produto do catálogo), não um mockup ilustrativo.
      */}
      <section className="bg-white px-6 py-14 sm:px-10 sm:py-24 lg:px-12 lg:py-32">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-end lg:gap-16">
            <h2 data-reveal className={`${HEADLINE_TAMANHO} ${HEADLINE} text-[#0B1B3D]`}>
              Você vê o lucro antes de vender
            </h2>
            <p data-reveal className="max-w-[520px] text-[17px] leading-[1.6] text-[#5B6B8C] sm:text-[18px]">
              Cada produto do catálogo mostra quanto você paga ao fornecedor, por quanto pode vender e
              quanto sobra por venda. Você decide com o número na frente, não no chute.
            </p>
          </div>

          <div
            data-reveal
            className="mt-14 overflow-hidden rounded-[24px] border border-[#E9EEF8] bg-[#FBFCFF] shadow-[0_28px_70px_rgba(15,35,95,0.08)] lg:mt-20"
          >
            <ImagemResponsiva
              base="prova-catalogo"
              larguras={[640, 960, 1440]}
              original="/prova-catalogo.webp"
              width={2308}
              height={1440}
              sizes="(min-width: 1200px) 1200px, calc(100vw - 48px)"
              alt="Tela de produto no catálogo da Velo: preço sugerido de R$ 44,00, margem de 100%, custo de R$ 22,00 ao fornecedor e lucro de R$ 22,00 por venda"
              className="block h-auto w-full"
            />
          </div>
          <button type="button" onClick={() => { registrarCliqueCadastro("cta_profit_signup_click"); navigate(signupTarget); }} className="mt-8 h-[56px] w-full rounded-full bg-[#2563EB] text-[17px] font-semibold text-white sm:hidden">Criar minha conta</button>
        </div>
      </section>


      <section id="recursos" className="scroll-mt-20 bg-white px-6 py-14 sm:px-8 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-[1200px]">
          <div data-reveal className="max-w-[680px]">
            <h2 className={`${HEADLINE_TAMANHO} ${HEADLINE} text-[#0B1B3D]`}>
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

      {/*
        Bloco colorido da referência, no azul da marca em vez do roxo. É a única
        seção escura da página depois do hero: serve de respiro antes do FAQ e
        destaca o Atlas, que é o diferencial do produto.

        Aqui o peso 300 fica sobre fundo escuro, então a headline aparenta um
        pouco mais grossa que nas seções brancas — é o mesmo efeito óptico que
        levou o restante da página a usar 300 em vez de 200.
      */}
      <section className="bg-white px-6 py-10 sm:px-10 sm:py-16 lg:px-12 lg:py-20">
        <div className="mx-auto w-full max-w-[1200px] overflow-hidden rounded-[32px] bg-[linear-gradient(160deg,#1E3A8A,#0B1B3D)] px-6 py-20 sm:px-12 lg:px-16 lg:py-28">
          <h2 data-reveal className={`max-w-[900px] ${HEADLINE_TAMANHO} ${HEADLINE} text-white`}>
            Conheça o Atlas, seu agente de vendas
          </h2>
          <p data-reveal className="mt-6 max-w-[620px] text-[17px] leading-[1.65] text-white/60 sm:text-[18px]">
            Diga o nicho que você quer explorar. O Atlas indica um produto do catálogo, explica por que
            ele faz sentido e já abre o próximo passo para colocar o anúncio no ar.
          </p>

          <div className="mt-14 grid gap-6 lg:mt-16 lg:grid-cols-12 lg:items-start lg:gap-7">
            <div data-reveal className="lg:col-span-7">
              <div className="overflow-hidden rounded-[20px] border border-white/10 bg-white">
                <ImagemResponsiva
                  base="prova-atlas"
                  larguras={[640, 960, 1360]}
                  original="/prova-atlas.webp"
                  width={1712}
                  height={1000}
                  sizes="(min-width: 1024px) 700px, calc(100vw - 48px)"
                  alt="Conversa com o Atlas: o usuário pede um produto do nicho de beleza e o Atlas indica um kit de pincéis, explica o motivo e oferece abrir o catálogo"
                  className="block h-auto w-full"
                />
              </div>
            </div>

            <div data-reveal className="lg:col-span-5 lg:pt-4">
              <h3 className="text-[21px] font-semibold leading-[1.25] tracking-[-0.02em] text-white">
                Uma recomendação, não uma lista
              </h3>
              <p className="mt-4 text-[16px] leading-[1.65] text-white/60">
                Em vez de devolver centenas de produtos para você filtrar, o Atlas aponta um item
                específico e diz o motivo. Quem está começando trava justamente na primeira escolha.
              </p>

              <button
                type="button"
                onClick={() => {
                  registrarCliqueCadastro("cta_primary_click");
                  navigate(authTarget);
                }}
                className="mt-8 inline-flex h-[52px] items-center rounded-full bg-white px-7 text-[15px] font-semibold text-[#0B1B3D] transition hover:bg-white/90"
              >
                {ctaLabel}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="perguntas-frequentes" className="scroll-mt-20 bg-[#FBFCFF] px-6 py-14 sm:px-8 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-[900px]">
          <h2 data-reveal className={`text-center ${HEADLINE_TAMANHO} ${HEADLINE} text-[#0B1B3D]`}>
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

      <section className="bg-white px-6 py-14 sm:px-8 sm:py-24 lg:py-28">
        <div data-reveal className="relative mx-auto max-w-[1000px] overflow-hidden rounded-[30px] border border-[#E1E9F8] bg-[linear-gradient(180deg,#F7FAFF,#EDF3FF)] px-6 py-16 text-center sm:px-14">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_50%_0%,rgba(37,99,235,0.12),transparent_60%)]" />

          <div className="relative">
            <h2 className={`mx-auto max-w-[720px] ${HEADLINE_TAMANHO} ${HEADLINE} text-[#0B1B3D]`}>
              A plataforma é nossa, mas as oportunidades são suas.
            </h2>

            {/*
              Na pílula de 58px o campo e o botão dividem a largura. Isso funciona
              a partir de 640px, mas num celular de 375px sobram ~127px para o
              campo: o "Digite seu e-mail" aparecia cortado como "Digite seu" e o
              botão espremia a borda arredondada.

              Abaixo de 640px os dois passam a ocupar uma linha cada, na largura
              toda. Tudo em max-sm: — de 640px para cima a pílula continua igual.
            */}
            <form
              onSubmit={handleSubmit}
              className="mx-auto mt-9 hidden h-[58px] max-w-[480px] items-center rounded-full border border-[#E1E9F8] bg-white p-[5px] shadow-[0_12px_30px_rgba(15,35,95,0.07)] sm:flex"
            >
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Digite seu e-mail"
                className="min-w-0 flex-1 bg-transparent px-5 text-[15px] text-[#0B1B3D] outline-none placeholder:text-[#9AA6BE] max-sm:h-[48px] max-sm:w-full max-sm:flex-none max-sm:px-4 max-sm:text-center"
              />
              <button
                type="submit"
                className="h-[48px] rounded-full bg-[#2563EB] px-6 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.24)] transition hover:bg-[#1E3A8A] max-sm:w-full max-sm:shrink-0"
              >
                {!authLoading && user ? "Entrar no dashboard" : "Começar agora"}
              </button>
            </form>
            <button type="button" onClick={() => { registrarCliqueCadastro("cta_final_signup_click"); navigate(signupTarget); }} className="mt-8 h-[56px] w-full rounded-full bg-[#2563EB] text-[17px] font-semibold text-white sm:hidden">Criar minha conta</button>

            <p className="mt-5 hidden text-[14px] tracking-[-0.01em] text-[#8A97B1] sm:block">
              Você concorda em receber e-mails de marketing da Velo.
            </p>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {showMobileStickyCta && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed inset-x-0 bottom-0 z-[70] border-t border-[#DCE5F7] bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(11,27,61,0.12)] backdrop-blur sm:hidden">
            <button type="button" onClick={() => { registrarCliqueCadastro("cta_sticky_signup_click"); navigate(signupTarget); }} className="h-[54px] w-full rounded-full bg-[#2563EB] text-[17px] font-bold text-white">Criar minha conta</button>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="border-t border-[#EDF1F9] bg-white px-6 py-8 sm:px-8 sm:py-12">
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

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-[15px] text-[#5B6B8C] max-sm:gap-y-0">
            {/* max-sm:min-h-[44px]: no dedo, 23px de altura é alvo de errar.
                De 640px para cima nada muda — lá o ponteiro é preciso. */}
            {["Produto", "Integrações", "Privacidade", "Termos"].map((item) => (
              <a
                key={item}
                href="#top"
                className="transition hover:text-[#2563EB] max-sm:inline-flex max-sm:min-h-[44px] max-sm:items-center"
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
