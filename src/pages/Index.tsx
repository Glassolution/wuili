import { FormEvent, ImgHTMLAttributes, useEffect, useState } from "react";
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

const productTiles = [
  {
    src: "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=560&q=85",
  },
  {
    src: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=560&q=85",
  },
  {
    src: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=560&q=85",
  },
  {
    src: "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=560&q=85",
  },
];

function VeloLogo() {
  return (
    <div className="flex items-center gap-2.5 text-black">
      <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-black text-white">
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <path
            d="M19.3 9.4A7.4 7.4 0 1 0 19.3 18.6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.8"
          />
          <path
            d="M16.8 16.2L20 19.3L23.2 16.2"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.45"
          />
        </svg>
      </div>
      <span className="text-[28px] font-bold leading-none tracking-[-0.075em]">Velo</span>
    </div>
  );
}

function PremiumImage({ className = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(135deg,#eef0ea,#faf9f5)]">
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
      {failed && <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(86,97,63,0.14),transparent_38%),linear-gradient(135deg,#f2f3ef,#fbfaf7)]" />}
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
        className="max-h-8 max-w-[150px] object-contain grayscale contrast-125 brightness-0 opacity-68 transition duration-300 hover:opacity-85 sm:max-h-9 sm:max-w-[178px]"
        />
      ) : (
        <span className="text-[22px] font-bold leading-none tracking-[-0.055em] text-black/70 sm:text-[27px]">{logo.label}</span>
      )}
    </div>
  );
}

function ProcessVisual({ type }: { type: string }) {
  if (type === "workflow") {
    return (
      <div className="relative h-[188px] overflow-hidden rounded-[20px] bg-[#101816] ring-1 ring-white/[0.04] sm:h-[236px] sm:rounded-[24px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_26%,rgba(216,240,200,0.16),transparent_34%)]" />
        <div className="absolute left-5 top-6 z-10 w-[146px] rounded-[18px] bg-white p-2.5 shadow-[0_20px_46px_rgba(0,0,0,0.24)] sm:left-8 sm:top-8 sm:w-[176px] sm:rounded-[22px] sm:p-3">
          <div className="h-[92px] overflow-hidden rounded-[14px] bg-[#f2f1ec] sm:h-[118px] sm:rounded-[16px]">
            <PremiumImage src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=520&q=85" alt="Produto encontrado" />
          </div>
          <div className="mt-3 h-2 w-20 rounded-full bg-black/12" />
          <div className="mt-2 h-2 w-28 rounded-full bg-black/7" />
        </div>
        <div className="absolute right-5 top-8 z-20 w-[138px] rounded-[18px] border border-white/10 bg-[#17201d]/88 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.18)] backdrop-blur-sm sm:right-7 sm:top-12 sm:w-[156px] sm:rounded-[20px] sm:p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/42">Publicação</div>
          <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5">
            {["Mercado Livre", "Shopee", "Catálogo"].map((item, index) => (
              <div key={item} className="flex items-center justify-between rounded-full bg-white/[0.08] px-2.5 py-1.5 text-[11px] text-white/72 sm:px-3 sm:py-2 sm:text-[12px]">
                <span>{item}</span>
                <span className={index === 0 ? "text-[#d8f0c8]" : "text-white/30"}>{index === 0 ? "ativo" : "ok"}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-5 left-1/2 h-2 w-40 -translate-x-1/2 rounded-full bg-white/8 sm:bottom-6 sm:w-48" />
        <div className="absolute bottom-5 left-[calc(50%-80px)] h-2 w-28 rounded-full bg-[#d8f0c8] sm:bottom-6 sm:left-[calc(50%-96px)] sm:w-32" />
      </div>
    );
  }

  if (type === "uptime") {
    return (
      <div className="relative h-[188px] overflow-hidden rounded-[20px] bg-[#101816] ring-1 ring-white/[0.04] sm:h-[236px] sm:rounded-[24px]">
        <div className="absolute inset-0 opacity-[0.16] [background-image:radial-gradient(circle,rgba(255,255,255,0.24)_1px,transparent_1px)] [background-size:12px_12px]" />
        <div className="absolute inset-x-6 top-7 h-[88px] rounded-full border border-white/[0.07] sm:inset-x-8 sm:top-8 sm:h-[110px]" />

        <div className="absolute left-1/2 top-7 h-[118px] w-[118px] -translate-x-1/2 sm:top-8 sm:h-[142px] sm:w-[142px]">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke="#d8f0c8"
              strokeLinecap="round"
              strokeWidth="9"
              strokeDasharray="246 302"
            />
          </svg>

          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-[31px] font-[300] leading-none tracking-[-0.055em] text-white sm:text-[36px]">99,9%</div>
              <div className="mt-2 text-[12px] tracking-[-0.01em] text-white/48">operação estável</div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2 sm:bottom-7">
          {["ML", "C7", "MP"].map((item) => (
            <span key={item} className="rounded-full border border-white/[0.08] bg-white/[0.045] px-3.5 py-1.5 text-[11px] font-medium text-white/46">
              {item}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[188px] overflow-hidden rounded-[20px] bg-[#101816] ring-1 ring-white/[0.04] sm:h-[236px] sm:rounded-[24px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_44%_28%,rgba(216,240,200,0.14),transparent_34%)]" />
      <div className="absolute left-1/2 top-5 w-[220px] -translate-x-1/2 rounded-[20px] bg-white p-3 text-black shadow-[0_22px_54px_rgba(0,0,0,0.28)] sm:top-6 sm:w-[238px] sm:rounded-[22px] sm:p-4">
        <div className="flex items-center gap-3.5">
          <div className="h-14 w-14 overflow-hidden rounded-[16px] bg-[#f3f1e9]">
            <PremiumImage src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=260&q=85" alt="Produto com potencial" />
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-[-0.02em]">Smartwatch compacto</div>
            <div className="mt-1 text-[11px] text-black/45">Demanda em alta</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-[14px] bg-black/[0.04] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.12em] text-black/35">Margem</div>
            <div className="mt-1 text-[17px] font-semibold tracking-[-0.04em]">42%</div>
          </div>
          <div className="rounded-[14px] bg-black/[0.04] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.12em] text-black/35">Score</div>
            <div className="mt-1 text-[17px] font-semibold tracking-[-0.04em]">87</div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 left-5 rounded-full border border-white/12 bg-white/[0.07] px-3 py-1.5 text-[11px] text-white/60 backdrop-blur sm:bottom-5 sm:left-7 sm:px-4 sm:py-2 sm:text-[12px]">
        Produto validado
      </div>
      <div className="absolute bottom-4 right-5 rounded-full bg-[#d8f0c8] px-3 py-1.5 text-[11px] font-semibold text-[#152012] shadow-[0_12px_28px_rgba(216,240,200,0.16)] sm:bottom-5 sm:right-7 sm:px-4 sm:py-2 sm:text-[12px]">
        pronto para testar
      </div>
    </div>
  );
}

function SimpleIcon({ name }: { name: string }) {
  const common = "h-8 w-8";

  if (name === "apps") {
    return (
      <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="4" y="19" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="19" y="19" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M23.5 4v10M18.5 9h10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  if (name === "tools") {
    return (
      <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M12 20 5 27M21 5l6 6-5 5-6-6 5-5ZM18 13 9 4 5 8l9 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    );
  }

  if (name === "team") {
    return (
      <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="12" cy="11" r="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="22" cy="13" r="3" stroke="currentColor" strokeWidth="2" />
        <path d="M5 27c.7-4.6 3.2-7 7-7s6.3 2.4 7 7M18 22c1-.9 2.3-1.4 4-1.4 3.1 0 5 2 5.5 5.4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M8 19v-3a8 8 0 0 1 16 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M8 18H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v-7ZM24 18h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2v-7ZM22 26c-1.2 1.4-3.1 2-6 2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function StoreMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[510px] lg:translate-x-1">
      <svg
        className="pointer-events-none absolute -left-12 -top-12 hidden h-[380px] w-[660px] text-black/12 lg:block"
        viewBox="0 0 880 520"
        fill="none"
        aria-hidden="true"
      >
        <path d="M60 210C218 80 534 4 792 126" stroke="currentColor" strokeWidth="1.5" />
        <path d="M38 415C250 275 573 292 836 382" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 10" />
        <path d="M104 288C282 420 581 480 812 315" stroke="currentColor" strokeWidth="1.5" />
      </svg>

      <div className="relative ml-auto w-full max-w-[490px] overflow-hidden rounded-[12px] bg-white shadow-[0_22px_58px_rgba(0,0,0,0.065)] ring-1 ring-black/[0.035]">
        <div className="flex h-7 items-center justify-between px-5">
          <div className="h-1.5 w-14 rounded-full bg-black/8" />
          <div className="text-[15px] font-semibold italic tracking-[-0.03em] text-[#56613f]">velo</div>
          <div className="flex gap-2 text-black/45">
            <span className="h-1.5 w-1.5 rounded-full bg-black/25" />
            <span className="h-1.5 w-1.5 rounded-full bg-black/25" />
            <span className="h-1.5 w-1.5 rounded-full bg-black/25" />
          </div>
        </div>

        <div className="relative h-[185px] overflow-hidden bg-[#8e7e2e] md:h-[218px]">
          <PremiumImage
            src="https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=1200&q=90"
            alt="Loja natural de sucos"
            className="saturate-[0.9] contrast-[0.96]"
          />
          <div className="absolute inset-0 bg-black/12" />
          <div className="absolute bottom-5 left-6 text-white">
            <div className="text-[31px] font-semibold leading-none tracking-[-0.06em]">Zest</div>
            <div className="mt-1.5 text-[9px] text-white/78">Sabores inspiradores, qualidade incomparável</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 bg-white px-5 pb-5 pt-4">
          {productTiles.map((tile) => (
            <div key={tile.src}>
              <div className="h-[70px] overflow-hidden rounded-[3px] bg-[#f3f1e9] md:h-[92px]">
                <PremiumImage src={tile.src} alt="Produto natural" className="saturate-[0.88] contrast-[0.96]" />
              </div>
              <div className="mt-3 h-1.5 w-14 rounded-full bg-black/7" />
              <div className="mt-2 h-1.5 w-20 rounded-full bg-black/5" />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -right-1 top-[76px] hidden w-[158px] rounded-[10px] bg-white p-3 shadow-[0_20px_46px_rgba(0,0,0,0.07)] ring-1 ring-black/[0.035] md:block xl:-right-7">
        <div className="h-[78px] overflow-hidden rounded-[8px] bg-[#f7f3ed]">
          <PremiumImage
            src="https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=520&q=85"
            alt="Produtos naturais"
          />
        </div>
        <div className="mt-2.5 flex h-8 items-center justify-between rounded-[4px] border border-black/12 px-4 text-[15px]">
          <span>−</span>
          <span className="text-[13px] text-black/60">1</span>
          <span>+</span>
        </div>
        <button className="mt-2 grid h-9 w-full place-items-center rounded-[5px] border border-black/55 text-[18px]" type="button">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 6h2l1.6 9.2a2 2 0 0 0 2 1.65h5.8a2 2 0 0 0 1.92-1.45L20 9H8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            <circle cx="11" cy="20" r="1" fill="currentColor" />
            <circle cx="17" cy="20" r="1" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div className="absolute -right-2 bottom-[54px] hidden items-center gap-2 rounded-[9px] bg-white px-3 py-2 shadow-[0_16px_34px_rgba(0,0,0,0.055)] ring-1 ring-black/[0.035] md:flex xl:-right-7">
        {["#f2b43d", "#2e361d", "#687356", "#f4f4ed", "#ffffff"].map((color) => (
          <span key={color} className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: color }} />
        ))}
      </div>
    </div>
  );
}

export default function Index() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [openFaq, setOpenFaq] = useState(0);

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

  return (
    <main className="min-h-screen overflow-hidden bg-[#F6F5F1] font-sans text-[#141411] [font-family:'Helvetica_Neue',Helvetica,-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',Arial,sans-serif] [font-kerning:normal] [font-optical-sizing:auto]">
      <header className="mx-auto flex w-full max-w-[1340px] items-center justify-between px-6 py-5 sm:px-8 lg:px-12">
        <button type="button" onClick={() => navigate("/")} aria-label="Velo">
          <VeloLogo />
        </button>

        <button
          type="button"
          onClick={() => navigate(authTarget)}
          className="h-[42px] rounded-full bg-[#060606] px-5 text-[14px] font-medium tracking-[-0.008em] text-white transition hover:-translate-y-0.5 hover:bg-black/85 sm:h-[46px] sm:px-7 sm:text-[15px]"
        >
          {ctaLabel}
        </button>
      </header>

      <section className="mx-auto grid w-full max-w-[1340px] items-center gap-7 px-6 pb-10 pt-5 sm:min-h-[470px] sm:gap-10 sm:px-8 sm:pb-3 lg:min-h-[505px] lg:grid-cols-[0.52fr_0.48fr] lg:px-12 lg:pb-2 lg:pt-6">
        <div data-reveal className="max-w-[720px]">
          <h1 className="max-w-[780px] text-[#12120f] antialiased [font-family:'Helvetica_Neue',Helvetica,-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',Arial,sans-serif] [font-synthesis-weight:none] [text-rendering:geometricPrecision]">
            <span className="block text-[34px] font-[385] leading-[1.035] tracking-[-0.041em] sm:whitespace-nowrap sm:text-[42px] md:text-[52px] lg:text-[58px] xl:text-[64px]">
              Comece sua loja
            </span>
            <span className="mt-0 block text-[34px] font-[385] leading-[1.035] tracking-[-0.041em] sm:whitespace-nowrap sm:text-[42px] md:text-[52px] lg:text-[58px] xl:text-[64px]">
              com produtos prontos
            </span>
          </h1>

          <p className="mt-5 max-w-[720px] text-[18px] font-[400] leading-[1.38] tracking-[-0.021em] text-[#64635f] antialiased sm:mt-7 sm:text-[20px] md:text-[22px] lg:text-[23px]">
            A Velo encontra oportunidades para você vender online sem estoque, sem operação complexa e sem perder tempo procurando produtos.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-7 hidden max-w-[510px] flex-col gap-2 rounded-[28px] border border-black/[0.075] bg-white p-2 shadow-[0_1px_0_rgba(0,0,0,0.014)] sm:mt-8 sm:flex sm:h-[54px] sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:p-[3px]"
          >
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Digite seu e-mail"
              className="h-12 min-w-0 flex-1 bg-transparent px-5 text-[16px] font-normal tracking-[-0.01em] text-[#141411] outline-none placeholder:text-black/56 sm:h-auto sm:px-6"
            />
            <button
              type="submit"
              className="h-[46px] w-full rounded-full bg-[#060606] px-6 text-[15px] font-medium tracking-[-0.008em] text-white transition hover:bg-black/85 sm:w-auto sm:px-7"
            >
              {ctaLabel}
            </button>
          </form>

          <p className="mt-4 hidden text-[13px] font-normal tracking-[-0.004em] text-[#77746e] sm:block md:text-[14px]">
            Você concorda em receber e-mails da Velo.
          </p>
        </div>

        <div data-reveal className="relative min-h-[250px] sm:min-h-[300px] lg:min-h-[405px]">
          <div className="flex items-center justify-center sm:absolute sm:inset-0">
            <StoreMockup />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1340px] px-6 pb-12 pt-1 sm:px-8 lg:px-12">
        <h2 data-reveal className="text-[20px] font-normal leading-tight tracking-[-0.04em] text-black sm:text-[23px]">
          Integrado com as maiores plataformas do Brasil
        </h2>

        <div className="relative mt-7 -mx-8 overflow-hidden sm:mt-8">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#F6F5F1] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[#F6F5F1] to-transparent" />
          <div className="flex w-max items-center gap-12 px-6 text-black [animation:velo-logo-marquee_22s_linear_infinite] sm:gap-16">
            {marqueeLogos.map((brand, index) => (
              <div
                key={`${brand.name}-${index}`}
                aria-label={brand.name}
                className="flex h-[46px] min-w-[190px] shrink-0 items-center justify-center whitespace-nowrap text-black sm:h-[54px] sm:min-w-[230px]"
              >
                <OperationLogo logo={brand} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mt-4 overflow-hidden rounded-t-[30px] bg-[#030b0a] px-4 py-12 text-white sm:mt-8 sm:rounded-t-[44px] sm:px-8 sm:py-20 lg:mx-auto lg:max-w-[1440px] lg:rounded-t-[56px] lg:px-20 lg:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_8%,rgba(216,240,200,0.08),transparent_32%)]" />
        <div className="relative mx-auto max-w-[1180px]">
          <h2 data-reveal className="max-w-[820px] text-[34px] font-[300] leading-[1.04] tracking-[-0.055em] sm:text-[46px] md:text-[64px] lg:text-[74px]">
            Um processo de vendas mais inteligente começa aqui
          </h2>

          <div className="mt-9 grid gap-4 sm:mt-16 sm:gap-6 lg:grid-cols-3">
            {processCards.map((card) => (
              <article
                data-reveal
                key={card.title}
                className="group rounded-[24px] bg-white/[0.055] p-5 ring-1 ring-white/[0.055] transition duration-300 hover:-translate-y-1 hover:bg-white/[0.075] sm:rounded-[30px] sm:p-6"
              >
                <ProcessVisual type={card.visual} />
                <h3 className="mt-6 max-w-[340px] text-[27px] font-[300] leading-[1.06] tracking-[-0.05em] text-white sm:mt-8 sm:text-[32px]">{card.title}</h3>
                <p className="mt-3 text-[15px] leading-[1.45] tracking-[-0.01em] text-white/60 sm:mt-5 sm:text-[17px]">{card.text}</p>
              </article>
            ))}
          </div>

          <div data-reveal className="mt-14 max-w-[980px] sm:mt-24">
            <blockquote className="text-[26px] font-[300] leading-[1.14] tracking-[-0.045em] text-white sm:text-[34px] md:text-[46px]">
              “A melhor operação começa quando você entende o produto, o canal e o próximo passo com clareza.”
            </blockquote>
            <div className="mt-8 text-[18px] font-semibold text-white">Velo</div>
            <div className="mt-1 text-[15px] text-white/55">Plataforma para encontrar produtos e vender online</div>
          </div>
        </div>
      </section>

      <section className="bg-[#F6F5F1] px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-[1340px]">
          <h2 data-reveal className="max-w-[720px] text-[48px] font-[300] leading-[1.02] tracking-[-0.055em] text-black md:text-[64px]">
            A plataforma para começar no ecommerce
          </h2>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {statsCards.map((stat) => (
              <div data-reveal key={stat.value} className="rounded-[22px] bg-black/[0.035] px-8 py-9">
                <div className="text-[42px] font-[300] leading-none tracking-[-0.055em] text-black md:text-[52px]">{stat.value}</div>
                <p className="mt-5 max-w-[520px] text-[18px] leading-[1.45] tracking-[-0.012em] text-black/58">{stat.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-24">
            <h2 data-reveal className="max-w-[780px] text-[48px] font-[300] leading-[1.02] tracking-[-0.055em] text-black md:text-[64px]">
              Faça suas vendas com a ajuda de uma operação mais clara
            </h2>

            <div className="mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
              {supportItems.map((item) => (
                <article data-reveal key={item.title}>
                  <SimpleIcon name={item.icon} />
                  <h3 className="mt-8 text-[28px] font-[300] leading-[1.08] tracking-[-0.045em] text-black">{item.title}</h3>
                  <p className="mt-5 text-[17px] leading-[1.45] tracking-[-0.01em] text-black/58">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#030b0a] px-6 py-20 text-white sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-[1340px]">
          <h2 data-reveal className="text-[48px] font-[300] leading-none tracking-[-0.055em] md:text-[70px]">Perguntas frequentes</h2>

          <div className="mt-14 divide-y divide-white/14">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;

              return (
                <div data-reveal key={item.question} className="py-8">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between gap-6 text-left"
                  >
                    <span className="max-w-[980px] text-[26px] font-[300] leading-[1.18] tracking-[-0.035em] text-white md:text-[34px]">
                      {item.question}
                    </span>
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[34px] font-[300] leading-none text-black">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  {isOpen && (
                    <p className="mt-5 max-w-[760px] text-[18px] leading-[1.55] tracking-[-0.01em] text-white/58">
                      {item.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section data-reveal className="bg-[#F6F5F1] px-6 py-20 text-center sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1040px]">
          <h2 className="text-[44px] font-[300] leading-[1.04] tracking-[-0.055em] text-black md:text-[68px]">
            A plataforma é nossa, mas as oportunidades são suas.
          </h2>

          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-10 flex h-[62px] max-w-[520px] items-center rounded-full border border-black/12 bg-white p-[5px] shadow-[0_1px_0_rgba(0,0,0,0.04)]"
          >
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Digite seu e-mail"
              className="min-w-0 flex-1 bg-transparent px-6 text-[17px] font-medium text-black outline-none placeholder:text-black"
            />
            <button
              type="submit"
              className="h-[52px] rounded-full bg-black px-7 text-[17px] font-semibold text-white transition hover:bg-black/85"
            >
              {!authLoading && user ? "Entrar no dashboard" : "Começar agora"}
            </button>
          </form>
          <p className="mt-5 text-[15px] tracking-[-0.01em] text-black/48">
            Você concorda em receber e-mails de marketing da Velo.
          </p>
        </div>
      </section>

      <footer className="bg-black px-6 py-10 text-white sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1340px] flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-white text-black">
              <svg width="22" height="22" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <path d="M19.3 9.4A7.4 7.4 0 1 0 19.3 18.6" stroke="currentColor" strokeLinecap="round" strokeWidth="2.8" />
                <path d="M16.8 16.2L20 19.3L23.2 16.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.45" />
              </svg>
            </div>
            <span className="text-[26px] font-semibold tracking-[-0.06em]">Velo</span>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-[15px] text-white/55">
            <a href="#top" className="transition hover:text-white">Produto</a>
            <a href="#top" className="transition hover:text-white">Integrações</a>
            <a href="#top" className="transition hover:text-white">Privacidade</a>
            <a href="#top" className="transition hover:text-white">Termos</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
