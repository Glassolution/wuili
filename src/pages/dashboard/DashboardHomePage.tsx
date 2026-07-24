import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  HelpCircle,
  Home,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Package,
  PlayCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";
import InviteFriendModal from "@/components/dashboard/InviteFriendModal";
import TutorialModal from "@/components/dashboard/TutorialModal";
import ProjectCreationWizard from "@/components/projects/ProjectCreationWizard";
import type { ProjectType } from "@/lib/userProjects";
import { preloadVidalytics } from "@/lib/vidalyticsPreload";
import MobileHome from "@/components/dashboard/MobileHome";
import { usePlan } from "@/hooks/usePlan";
import { canCreateStore, canCreateSalesPage } from "@/lib/planLimits";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";

const DASHBOARD_IMAGE_SRC = "/assets/dashboard-inicio-colado.png";

// Fundo cinza da página e moldura única dos cards. A imagem de fundo é coberta
// por inteiro pelas máscaras, então pintá-las com PAGE_BG deixa a página toda
// cinza sem faixas de cor diferentes.
const PAGE_BG = "bg-[#F1F1F1]";
const CARD_SHELL =
  "rounded-[0.85vw] border border-[#E6E7EB] bg-white shadow-[0_0.5vw_1.2vw_rgba(15,23,42,0.04)]";
const CARD_INNER = "rounded-[0.6vw] border border-[#E6E7EB] bg-white";

// Os dois botões do header compartilham altura, raio, respiro e tamanho de
// ícone — antes cada um tinha o seu, e eles não batiam entre si.
const HEADER_BUTTON =
  "flex h-[clamp(26px,2.15vw,41px)] items-center gap-[0.45vw] rounded-[0.45vw] px-[1.15vw] text-[clamp(8px,0.74vw,14px)] leading-none";
const HEADER_BUTTON_ICON = "h-[clamp(10px,0.9vw,17px)] w-[clamp(10px,0.9vw,17px)] shrink-0";
const WHATSAPP_SUPPORT_URL =
  "https://wa.me/5547999286334?text=Oi%2C%20preciso%20de%20ajuda%20com%20a%20minha%20conta%20Velo.";

const metricCards = [
  {
    left: "3.4%",
    icon: Package,
    key: "totalProducts",
    title: "Total de Produtos",
    description: "Produtos salvos ou publicados na sua conta Velo.",
  },
  {
    left: "27.1%",
    icon: BookOpen,
    key: "totalOrders",
    title: "Total de Pedidos",
    description: "Pedidos recebidos nos seus canais conectados.",
  },
  {
    left: "50.8%",
    icon: Briefcase,
    key: "salesPages",
    title: "Paginas criadas",
    description: "Paginas de vendas geradas para seus produtos.",
  },
  {
    left: "74.5%",
    icon: Search,
    key: "integrations",
    title: "Integracoes",
    description: "Contas conectadas para publicar e acompanhar vendas.",
  },
] as const;

type DashboardStatKey = (typeof metricCards)[number]["key"];

type DashboardStats = { [K in DashboardStatKey]: number } & {
  displayName: string;
};

const formatCount = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

// Todos os cards abrem o mesmo TutorialModal: hoje a plataforma tem um único
// vídeo (TutorialVideoEmbed é fixo). Quando houver um vídeo por tema, basta o
// modal aceitar um id e cada card passar o seu.
const tutorialCards = [
  {
    label: "Catálogo",
    title: "Catálogo Velo",
    description: "Escolha produtos reais do catálogo e importe para sua operação.",
  },
  {
    label: "Loja",
    title: "Loja completa",
    description: "Monte sua loja com produto, copy, visual e estrutura.",
  },
  {
    label: "Em alta",
    title: "Produtos em alta",
    description: "Analise demanda, margem e oportunidades de dropshipping.",
  },
  {
    label: "Integrações",
    title: "Integrações",
    description: "Conecte seus canais e prepare as publicações.",
  },
];

// Cada card aponta para algo que já existe na Velo (indicação, novidades,
// central de ajuda e suporte no WhatsApp) — nenhum link de fachada.
const infoCards = [
  {
    icon: CircleDollarSign,
    action: "invite",
    title: "Programa de indicação",
    description: "Ganhe 15% sobre as compras dos amigos que você indicar para a Velo.",
    button: "Convidar amigo",
  },
  {
    icon: Megaphone,
    action: "news",
    title: "Novidades",
    description: "Acompanhe os recursos e melhorias que a equipe Velo acabou de lançar.",
    button: "Ver novidades",
  },
  {
    icon: HelpCircle,
    action: "help",
    title: "Central de ajuda",
    description: "Encontre respostas para as dúvidas mais comuns e boas práticas.",
    button: "Abrir central de ajuda",
  },
  {
    icon: MessageCircle,
    action: "whatsapp",
    title: "Falar com o suporte",
    description: "Converse com nosso time pelo WhatsApp e tire suas dúvidas.",
    button: "Iniciar conversa",
  },
] as const;

const friendCards = [0, 1, 2, 3, 4];

const ctaSlides = [
  {
    visual: "referral",
    badge: "Sistema de indicacao",
    meta: "0 indicacoes",
    title: "Convide amigos e ganhe 15% sobre as compras deles",
    description:
      "Compartilhe seu link exclusivo e receba recompensas quando seus amigos entrarem na Velo e completarem a primeira assinatura. Quanto mais indicacoes, maior o retorno.",
    button: "Convidar amigo",
    href: "/dashboard/comissoes",
  },
  {
    visual: "page",
    badge: "Pagina de vendas",
    meta: "Criacao rapida",
    title: "Crie uma pagina de vendas para qualquer produto",
    description:
      "Escolha um produto, gere uma oferta com IA e monte uma pagina pronta para apresentar, testar e vender com mais clareza.",
    button: "Criar pagina",
    href: "/dashboard/catalogo",
  },
  {
    visual: "trending",
    badge: "Produtos em alta",
    meta: "Ranking atualizado",
    title: "Veja produtos em alta e encontre novas oportunidades",
    description:
      "Explore produtos com sinais de demanda, margem e potencial para descobrir ideias melhores para sua proxima oferta.",
    button: "Ver produtos em alta",
    href: "/dashboard/produtos-em-alta",
  },
] as const satisfies ReadonlyArray<{ visual: CtaVisualKind; badge: string; meta: string; title: string; description: string; button: string; href: string }>;

type CtaVisualKind = "referral" | "page" | "trending";
type SupportTab = "home" | "messages" | "help" | "news";

const WhatsAppIcon = ({ className = "" }: { className?: string }) => (
  <svg aria-hidden="true" className={className} viewBox="0 0 32 32" fill="currentColor">
    <path d="M16.02 3.5A12.35 12.35 0 0 0 5.34 22.05L4 28.5l6.6-1.27A12.35 12.35 0 1 0 16.02 3.5Zm0 22.35c-1.82 0-3.6-.49-5.16-1.42l-.48-.29-3.33.64.68-3.22-.32-.5A9.92 9.92 0 1 1 16.02 25.85Zm5.74-7.43c-.31-.16-1.84-.91-2.13-1.01-.29-.11-.5-.16-.71.16-.21.31-.81 1.01-.99 1.22-.18.21-.36.24-.68.08-.31-.16-1.33-.49-2.53-1.56-.94-.84-1.57-1.87-1.75-2.18-.18-.31-.02-.49.14-.64.14-.14.31-.36.47-.55.16-.18.21-.31.31-.52.1-.21.05-.39-.03-.55-.08-.16-.71-1.7-.97-2.33-.26-.61-.52-.53-.71-.54h-.61c-.21 0-.55.08-.84.39-.29.31-1.1 1.07-1.1 2.62 0 1.54 1.13 3.03 1.28 3.24.16.21 2.22 3.39 5.38 4.75.75.32 1.34.52 1.8.66.76.24 1.45.21 1.99.13.61-.09 1.84-.75 2.1-1.48.26-.73.26-1.35.18-1.48-.08-.13-.29-.21-.6-.37Z" />
  </svg>
);

const CtaVisual = ({ visual }: { visual: CtaVisualKind }) => {
  if (visual === "referral") {
    return (
      <>
        <div className="absolute inset-x-[5.5%] top-[13.5%] flex items-start justify-between">
          {friendCards.map((item) => {
            const isActive = item === 2;

            return (
              <div
                key={item}
                className={`flex w-[17%] flex-col items-center rounded-[0.55vw] bg-white py-[0.68vw] ${
                  isActive
                    ? "border border-black/[0.12] shadow-[0_0.5vw_1.2vw_rgba(0,0,0,0.08)]"
                    : "opacity-35"
                }`}
              >
                <span
                  className={`relative flex h-[clamp(16px,1.75vw,34px)] w-[clamp(16px,1.75vw,34px)] items-center justify-center rounded-full ${
                    isActive ? "bg-black" : "bg-[#eef1f7]"
                  }`}
                >
                  <span className="absolute top-[22%] h-[24%] w-[24%] rounded-full bg-white" />
                  <span className="absolute bottom-[22%] h-[29%] w-[54%] rounded-t-full bg-white" />
                </span>
                <span className={`mt-[0.35vw] text-[clamp(7px,0.72vw,14px)] font-semibold ${isActive ? "text-[#242832]" : "text-[#8e98ad]"}`}>
                  Amigo
                </span>
                <span className={`mt-[0.2vw] text-[clamp(7px,0.72vw,14px)] font-bold ${isActive ? "text-[#14a06f]" : "text-[#9fdac8]"}`}>
                  +$20.00
                </span>
              </div>
            );
          })}
        </div>

        <div className="absolute -bottom-[5%] left-[6%] right-[5%] h-[35%]">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <span
              key={item}
              className="absolute bottom-0 flex h-[64%] w-[25%] items-center justify-center rounded-[0.18vw] bg-black shadow-[0_0.4vw_0.7vw_rgba(0,0,0,0.12)]"
              style={{
                left: `${item * 14}%`,
                transform: `rotate(${[-8, 6, -4, 3, -5, 7][item]}deg)`,
              }}
            >
              <span className="absolute left-[7%] top-[10%] h-[16%] w-[12%] border-l-[0.22vw] border-t-[0.22vw] border-white/95" />
              <span className="absolute bottom-[10%] right-[7%] h-[16%] w-[12%] border-b-[0.22vw] border-r-[0.22vw] border-white/95" />
              <span className="flex h-[44%] w-[28%] items-center justify-center rounded-full bg-white text-[clamp(7px,0.95vw,18px)] font-black text-black">
                $
              </span>
            </span>
          ))}
        </div>
      </>
    );
  }

  if (visual === "page") {
    return (
      <div className="absolute inset-[7%] rounded-[0.82vw] border border-black/[0.065] bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]">
        <div className="absolute left-[9%] top-[13%] h-[16%] w-[47%] rounded-[0.35vw] bg-[#f4f5f7]" />
        <div className="absolute left-[9%] top-[36%] h-[8%] w-[70%] rounded-full bg-black" />
        <div className="absolute left-[9%] top-[49%] h-[5%] w-[54%] rounded-full bg-black/[0.62]" />
        <div className="absolute left-[9%] top-[61%] h-[13%] w-[27%] rounded-[0.42vw] bg-black shadow-[0_0.35vw_0.9vw_rgba(0,0,0,0.14)]" />
        <div className="absolute right-[8%] top-[16%] h-[58%] w-[25%] rounded-[0.65vw] border border-black/[0.08] bg-white shadow-[0_0.6vw_1.4vw_rgba(15,23,42,0.08)]">
          <div className="absolute left-[18%] right-[18%] top-[17%] h-[8%] rounded-full bg-black/[0.16]" />
          <div className="absolute left-[18%] right-[18%] top-[32%] h-[8%] rounded-full bg-black/[0.12]" />
          <div className="absolute left-[18%] right-[34%] top-[47%] h-[8%] rounded-full bg-black/[0.12]" />
          <div className="absolute bottom-[14%] left-[18%] right-[18%] h-[18%] rounded-[0.34vw] bg-black" />
        </div>
      </div>
    );
  }

  if (visual === "trending") {
    return (
      <div className="absolute inset-[7%] rounded-[0.82vw] border border-black/[0.065] bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]">
        <div className="absolute bottom-[18%] left-[10%] right-[10%] h-px bg-black/[0.08]" />
        {[18, 33, 48, 63, 78].map((left, index) => (
          <div
            key={left}
            className="absolute bottom-[18%] w-[7%] rounded-t-[0.25vw] bg-black"
            style={{ left: `${left}%`, height: `${18 + index * 8}%` }}
          />
        ))}
        <div className="absolute right-[10%] top-[17%] flex h-[28%] w-[28%] items-center justify-center rounded-full bg-black text-[clamp(10px,1.2vw,22px)] font-bold text-white shadow-[0_0.5vw_1.1vw_rgba(0,0,0,0.14)]">
          1
        </div>
        <div className="absolute left-[10%] top-[19%] h-[7%] w-[43%] rounded-full bg-black" />
        <div className="absolute left-[10%] top-[32%] h-[5%] w-[32%] rounded-full bg-black/[0.35]" />
        <div className="absolute left-[10%] top-[43%] h-[18%] w-[31%] rounded-[0.45vw] border border-black/[0.08] bg-[#f6f7f9]" />
      </div>
    );
  }

  return null;
};

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [activeCta, setActiveCta] = useState(0);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportTab, setSupportTab] = useState<SupportTab>("home");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    // Pré-carrega os scripts do Vidalytics no mount do dashboard para que o
    // modal abra com o player já pronto quando o usuário clicar em "Assistir
    // Tutorial" (o vídeo nunca abre sozinho).
    preloadVidalytics();
  }, []);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setEntered(true);
      return;
    }
    // O atraso mantém o primeiro frame invisível tempo suficiente para a
    // transição continuar perceptível mesmo após a hidratação da sessão.
    const t = window.setTimeout(() => setEntered(true), 120);
    return () => window.clearTimeout(t);
  }, []);

  const cta = ctaSlides[activeCta];
  const metadataRole =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined);
  const isAdmin = role === "admin" || metadataRole === "admin" || isAdminEmail(user?.email);
  const { plan: currentPlan } = usePlan();
  // Não temos a contagem exata aqui — usamos 0 para decidir apenas se o plano
  // permite criar cada tipo de projeto. Os limites reais são reavaliados na
  // página de projetos com base na contagem atual.
  const canCreateStorePlan = isAdmin || canCreateStore(currentPlan, 0);
  const canCreateSalesPagePlan = isAdmin || canCreateSalesPage(currentPlan, 0);
  const wizardDefaultTipo: ProjectType = canCreateStorePlan && !canCreateSalesPagePlan
    ? "loja_completa"
    : "pagina_venda";
  const wizardAllowChoice = true;
  const { open: openUpgrade } = useUpgradeModal();

  const handleProjectCreated = (projectId: string) => {
    setWizardOpen(false);
    navigate(`/minha-loja/editor/${projectId}`, { state: { projectId } });
  };

  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<DashboardStats> => {
      const userId = user!.id;
      // Tabelas criadas fora do typegen local ainda nao aparecem no tipo Database.
      const db = supabase as unknown as {
        from: (table: string) => {
          select: (columns: string, options?: { count?: "exact"; head?: boolean }) => {
            eq: (column: string, value: string) => Promise<{ data: unknown; count: number | null; error: unknown }>;
          };
        };
      };

      const [profileResult, publicationsResult, ordersResult, pagesResult, integrationsResult, savedProductsResult] =
        await Promise.allSettled([
          db.from("profiles").select("display_name,store_name,loja_nome").eq("user_id", userId),
          db.from("user_publications").select("id", { count: "exact", head: true }).eq("user_id", userId),
          db.from("orders").select("id", { count: "exact", head: true }).eq("user_id", userId),
          db.from("generated_sales_pages").select("id", { count: "exact", head: true }).eq("user_id", userId),
          db.from("user_integrations").select("id", { count: "exact", head: true }).eq("user_id", userId),
          db.from("collection_products").select("id,collections!inner(user_id)", { count: "exact", head: true }).eq("collections.user_id", userId),
        ]);

      const getCount = (result: PromiseSettledResult<{ count: number | null; error: unknown }>) =>
        result.status === "fulfilled" && !result.value.error ? result.value.count ?? 0 : 0;

      const profile =
        profileResult.status === "fulfilled" && !profileResult.value.error && Array.isArray(profileResult.value.data)
          ? (profileResult.value.data[0] as { display_name?: string | null; store_name?: string | null; loja_nome?: string | null } | undefined)
          : null;

      const nameSource =
        profile?.display_name?.trim() ||
        profile?.store_name?.trim() ||
        profile?.loja_nome?.trim() ||
        user.email?.split("@")[0] ||
        "Velo";

      const totalPubs = getCount(publicationsResult);
      const savedProducts = getCount(savedProductsResult);

      return {
        displayName: nameSource.split(/\s+/)[0] || "Velo",
        totalProducts: savedProducts + totalPubs,
        totalOrders: getCount(ordersResult),
        salesPages: getCount(pagesResult),
        integrations: getCount(integrationsResult),
      };
    },
  });

  const showPreviousCta = () => {
    setActiveCta((current) => (current === 0 ? ctaSlides.length - 1 : current - 1));
  };

  const showNextCta = () => {
    setActiveCta((current) => (current + 1) % ctaSlides.length);
  };

  const firstName = statsData?.displayName ?? "Xavier";
  const supportTabs: Array<{ id: SupportTab; label: string; icon: typeof Home; hasBadge?: boolean }> = [
    { id: "home", label: "Inicio", icon: Home },
    { id: "messages", label: "Mensagens", icon: MessageSquare },
    { id: "help", label: "Ajuda", icon: HelpCircle },
    { id: "news", label: "Novidades", icon: Megaphone, hasBadge: true },
  ];

  return (
    <>
      {/* Home mobile (busca, categorias, banner, atalhos e grade de produtos).
          Ela se esconde sozinha no desktop; o <main> abaixo é só desktop. */}
      <MobileHome />

    <main
      // O pb precisa cobrir o quanto os blocos de tutoriais/informações passam
      // do fim da imagem de fundo — ambos escalam com vw, então acompanham.
      // shrink-0: o container de rolagem do shell é flex-col, então sem isso o
      // main encolhe até a altura da viewport, o padding-bottom não vira altura
      // e a rolagem para antes do fim do conteúdo.
      className={`hidden shrink-0 md:block -m-5 min-h-[calc(100%+2.5rem)] ${PAGE_BG} pb-[clamp(260px,31vw,560px)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]`}
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0) scale(1)" : "translateY(24px) scale(0.992)",
        transition:
          "opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "opacity, transform",
      }}
    >
      <section className={`relative w-full overflow-visible ${PAGE_BG} text-[#252936]`}>
        <img
          src={DASHBOARD_IMAGE_SRC}
          alt=""
          className="block h-auto w-full select-none"
          draggable={false}
        />

        <div className="pointer-events-none absolute inset-0 font-sans">
          <div className={`absolute inset-x-0 top-0 h-[35.2%] ${PAGE_BG}`} />

          <div className="absolute left-[2.65%] right-[2.65%] top-[1.5%] h-[9.0%]">
            {/* Ícone e textos vivem na mesma linha flex: o espaçamento acompanha
                o tamanho da fonte em vez de depender de um left fixo. */}
            <div className="absolute left-[1.9%] top-1/2 flex -translate-y-1/2 items-center gap-[0.5vw]">
              <span className="flex h-[clamp(17px,1.62vw,31px)] w-[clamp(17px,1.62vw,31px)] shrink-0 items-center justify-center rounded-[0.36vw] bg-black text-white">
                <Home className="h-[52%] w-[52%]" fill="currentColor" strokeWidth={2} />
              </span>
              <span className="text-[clamp(10px,0.86vw,17px)] font-bold tracking-[-0.01em] text-[#1f2430]">Inicio</span>
              <span className="text-[clamp(10px,0.83vw,16px)] font-normal text-[#868d99]">
                {loadingStats ? "Carregando dados da sua conta" : `Ola, ${statsData?.displayName ?? "Velo"}. Visao geral da sua conta`}
              </span>
            </div>
            <div className="pointer-events-auto absolute right-[1.9%] top-1/2 flex -translate-y-1/2 items-center gap-[0.6vw]">
              <button
                type="button"
                onClick={() => setTutorialOpen(true)}
                className={`${HEADER_BUTTON} border border-black/[0.12] bg-white font-semibold text-[#252936] shadow-[0_0.3vw_0.8vw_rgba(15,23,42,0.07)] transition hover:bg-black hover:text-white`}
              >
                <PlayCircle className={HEADER_BUTTON_ICON} strokeWidth={2} />
                Assistir Tutorial
              </button>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 15%), #1D1F23",
                  // Antes o preto usava um anel externo de 1,5px, que o deixava
                  // ~3px mais alto que o branco. Uma borda de 1px entra na
                  // mesma conta de altura dos dois.
                  borderColor: "#000000",
                  borderTopColor: "rgba(255,255,255,0.22)",
                  boxShadow: "0px 4px 7px rgba(0,0,0,0.2)",
                  textShadow: "0px 4px 4px rgba(0,0,0,0.4)",
                }}
                className={`${HEADER_BUTTON} border font-medium text-white transition-opacity hover:opacity-90`}
              >
                <Sparkles className={HEADER_BUTTON_ICON} strokeWidth={2} />
                Criar Página com IA
              </button>
            </div>
          </div>

          <div className={`absolute left-[2.65%] right-[2.65%] top-[11.3%] h-[15.7%] ${CARD_SHELL}`}>
            <span className="absolute left-[25.2%] top-[16%] h-[66%] w-px bg-black/[0.07]" />
            <span className="absolute left-[49.0%] top-[16%] h-[66%] w-px bg-black/[0.07]" />
            <span className="absolute left-[72.8%] top-[16%] h-[66%] w-px bg-black/[0.07]" />
            {metricCards.map((card) => {
              const Icon = card.icon;

              return (
                <div key={card.title} className="absolute top-[20%] w-[19.0%]" style={{ left: card.left }}>
                  <div className="flex items-center gap-[0.45vw] text-[clamp(8px,0.78vw,15px)] font-semibold leading-none text-[#8f95a3]">
                    <Icon className="h-[clamp(11px,1.05vw,20px)] w-[clamp(11px,1.05vw,20px)] text-[#c3c8d4]" strokeWidth={1.9} />
                    <span>{card.title}</span>
                  </div>
                  {loadingStats
                    ? <div className="mt-[0.75vw] h-[clamp(16px,1.65vw,32px)] w-[46%] animate-pulse rounded-full bg-black/[0.08]" />
                    : <p className="mt-[0.75vw] text-[clamp(16px,1.65vw,32px)] font-semibold leading-none text-black">{formatCount(statsData?.[card.key] ?? 0)}</p>}
                  <p className="mt-[0.9vw] text-[clamp(8px,0.82vw,16px)] font-medium leading-[1.36] text-[#6f7582]">{card.description}</p>
                </div>
              );
            })}
          </div>

          <div className={`absolute inset-x-0 top-[27.5%] h-[44.9%] ${PAGE_BG}`} />
          {/* Card do carrossel. Os remendos brancos que existiam nesta faixa
              eram redundantes — a máscara acima já cobre a imagem — e saíram
              para não pintarem cinza por cima do card. */}
          <div className={`absolute left-[2.65%] right-[2.65%] top-[28.5%] h-[41.5%] ${CARD_SHELL}`} />
          <div className="absolute left-[6.55%] top-[30.9%] h-[27.2%] w-[30.6%] overflow-hidden rounded-[1.05vw] border border-[#E6E7EB] bg-white shadow-[0_0.65vw_1.5vw_rgba(15,23,42,0.045)]">
            <CtaVisual visual={cta.visual} />
          </div>

          <button
            type="button"
            onClick={showPreviousCta}
            className="pointer-events-auto absolute left-[3.5%] top-[40.6%] z-30 flex h-[clamp(26px,2.85vw,54px)] w-[clamp(26px,2.85vw,54px)] items-center justify-center rounded-[0.55vw] border border-[#E6E7EB] bg-white text-black shadow-[0_0.35vw_0.95vw_rgba(15,23,42,0.055)] transition-transform hover:-translate-x-[1px]"
            aria-label="CTA anterior"
          >
            <ChevronLeft className="h-[45%] w-[45%]" strokeWidth={2.4} />
          </button>
          <button
            type="button"
            onClick={showNextCta}
            className="pointer-events-auto absolute right-[3.5%] top-[40.6%] z-30 flex h-[clamp(26px,2.85vw,54px)] w-[clamp(26px,2.85vw,54px)] items-center justify-center rounded-[0.55vw] border border-[#E6E7EB] bg-white text-black shadow-[0_0.35vw_0.95vw_rgba(15,23,42,0.055)] transition-transform hover:translate-x-[1px]"
            aria-label="Proximo CTA"
          >
            <ChevronRight className="h-[45%] w-[45%]" strokeWidth={2.4} />
          </button>

          <div className="absolute left-[39.1%] top-[33.3%] flex items-center gap-[2.1vw]">
            <span className="rounded-[0.38vw] bg-[#f1f2f4] px-[0.58vw] py-[0.27vw] text-[clamp(7px,0.66vw,13px)] font-semibold text-black">
              {cta.badge}
            </span>
            <span className="text-[clamp(7px,0.66vw,13px)] font-semibold text-[#606876]">{cta.meta}</span>
          </div>

          <h1 className="absolute left-[39.1%] top-[37.0%] max-w-[51.5%] text-[clamp(16px,1.52vw,30px)] font-semibold leading-[1.16] tracking-[-0.022em] text-[#272b34]">
            {cta.title}
          </h1>

          <p className="absolute left-[39.1%] top-[44.2%] max-w-[44.5%] text-[clamp(8px,0.82vw,16px)] font-medium leading-[1.42] text-[#666d7a]">
            {cta.description}
          </p>

          {cta.visual === "referral" ? (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="pointer-events-auto absolute left-[39.35%] top-[53.3%] z-30 flex h-[clamp(22px,2.22vw,42px)] items-center rounded-[0.48vw] bg-black px-[0.95vw] text-[clamp(8px,0.82vw,16px)] font-semibold text-white shadow-[0_0.55vw_1.1vw_rgba(0,0,0,0.16)] transition-transform hover:-translate-y-[1px]"
            >
              {cta.button}
            </button>
          ) : (
            <a
              href={cta.href}
              className="pointer-events-auto absolute left-[39.35%] top-[53.3%] z-30 flex h-[clamp(22px,2.22vw,42px)] items-center rounded-[0.48vw] bg-black px-[0.95vw] text-[clamp(8px,0.82vw,16px)] font-semibold text-white shadow-[0_0.55vw_1.1vw_rgba(0,0,0,0.16)] transition-transform hover:-translate-y-[1px]"
            >
              {cta.button}
            </a>
          )}

          <div className="absolute left-[45.0%] top-[64.9%] z-30 flex h-[3.2%] w-[6.0%] items-center justify-center gap-[0.55vw] rounded-full bg-white shadow-[0_0.35vw_1vw_rgba(15,23,42,0.08)] ring-1 ring-black/[0.05]">
            {ctaSlides.map((slide, index) => (
              <button
                key={slide.badge}
                type="button"
                onClick={() => setActiveCta(index)}
                className={`pointer-events-auto h-[clamp(7px,0.65vw,13px)] w-[clamp(7px,0.65vw,13px)] rounded-full transition-colors ${
                  activeCta === index ? "bg-black shadow-[0_0.15vw_0.4vw_rgba(0,0,0,0.16)]" : "bg-[#dfe1e6]"
                }`}
                aria-label={`Mostrar CTA ${index + 1}`}
              />
            ))}
          </div>

          <div className={`absolute inset-x-0 top-[72.4%] h-[41.6%] ${PAGE_BG}`} />

          {/* Tutoriais + Informações: um único container em fluxo normal, para
              os blocos empilharem sem depender de porcentagens da imagem (o
              mask branco acima já cobre a área da imagem de fundo). */}
          <div className="pointer-events-auto absolute left-[2.65%] right-[2.65%] top-[71.4%] space-y-[1.15vw]">
          <div className={`${CARD_SHELL} p-[1.15vw]`}>
            <h2 className="text-[clamp(9px,0.85vw,17px)] font-bold tracking-[-0.01em] text-[#1f2430]">Tutoriais</h2>
            <button
              type="button"
              onClick={() => setTutorialOpen(true)}
              className="mt-[0.3vw] block text-[clamp(9px,0.83vw,16px)] font-normal text-[#2563EB] underline-offset-2 hover:underline"
            >
              Assista aos tutoriais e aprenda a usar a Velo
            </button>

            <div className="mt-[1vw] grid grid-cols-4 gap-[1vw]">
              {tutorialCards.map((card) => (
                <button
                  type="button"
                  key={card.title}
                  onClick={() => setTutorialOpen(true)}
                  // A regra global `button[class*="border"]` (index.css) vence a
                  // utility por especificidade; o inline garante a mesma borda
                  // dos demais cards.
                  style={{ borderColor: "#E6E7EB" }}
                  className={`group ${CARD_INNER} p-[0.6vw] text-left transition duration-150 hover:-translate-y-[2px] hover:shadow-[0_0.6vw_1.3vw_rgba(15,23,42,0.07)]`}
                >
                  <span className="relative block aspect-video w-full overflow-hidden rounded-[0.42vw] bg-[radial-gradient(115%_75%_at_50%_120%,#a78bfa_0%,#7c3aed_26%,#3b1d8f_52%,#0b0714_78%),linear-gradient(180deg,#05040a_0%,#0b0714_100%)]">
                    {/* Rastro claro que a referência traz por baixo do rótulo. */}
                    <span className="absolute inset-x-[10%] bottom-[18%] h-[5%] rounded-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.9)_50%,transparent_100%)] blur-[0.5vw]" />
                    <PlayCircle
                      className="absolute left-1/2 top-[38%] h-[clamp(14px,1.5vw,29px)] w-[clamp(14px,1.5vw,29px)] -translate-x-1/2 -translate-y-1/2 text-white/95 transition-transform duration-150 group-hover:scale-110"
                      strokeWidth={1.5}
                    />
                    <span className="absolute inset-x-[6%] bottom-[22%] text-center text-[clamp(9px,1.12vw,22px)] font-extrabold uppercase leading-none tracking-[-0.02em] text-white">
                      {card.label}
                    </span>
                  </span>

                  <span className="mt-[0.7vw] block text-[clamp(8px,0.78vw,15px)] font-bold leading-none text-[#1f2430]">{card.title}</span>
                  <span className="mt-[0.4vw] block text-[clamp(7px,0.72vw,14px)] font-normal leading-[1.4] text-[#7b8391]">
                    {card.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className={`${CARD_SHELL} p-[1.3vw]`}>
            <h2 className="text-[clamp(10px,0.95vw,19px)] font-bold tracking-[-0.015em] text-[#1f2430]">Informações</h2>
            <p className="mt-[0.35vw] text-[clamp(9px,0.85vw,17px)] font-normal text-[#7b8391]">
              Explore recursos e links úteis para aproveitar melhor a sua conta.
            </p>

            <div className="mt-[1.15vw] grid grid-cols-4 gap-[1.15vw]">
              {infoCards.map((card) => {
                const Icon = card.icon;
                const isWhatsApp = card.action === "whatsapp";

                const openAction = () => {
                  if (card.action === "invite") {
                    setInviteOpen(true);
                    return;
                  }
                  setSupportTab(card.action === "news" ? "news" : "help");
                  setSupportOpen(true);
                };

                const buttonClasses =
                  "mt-auto inline-flex w-fit items-center rounded-[0.45vw] border border-black/[0.14] bg-white px-[0.85vw] py-[0.42vw] text-[clamp(8px,0.78vw,15px)] font-semibold text-[#1f2430] no-underline transition hover:bg-[#f5f6f8]";

                return (
                  <div
                    key={card.title}
                    className={`flex flex-col ${CARD_INNER} p-[1.15vw]`}
                  >
                    <Icon
                      className="h-[clamp(15px,1.5vw,29px)] w-[clamp(15px,1.5vw,29px)] text-[#1f2430]"
                      strokeWidth={1.75}
                    />
                    <h3 className="mt-[0.85vw] text-[clamp(9px,0.95vw,19px)] font-bold leading-none tracking-[-0.015em] text-[#1f2430]">
                      {card.title}
                    </h3>
                    <p className="mb-[1.15vw] mt-[0.55vw] text-[clamp(8px,0.82vw,16px)] font-normal leading-[1.45] text-[#7b8391]">
                      {card.description}
                    </p>

                    {isWhatsApp ? (
                      <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noreferrer" className={buttonClasses}>
                        {card.button}
                      </a>
                    ) : (
                      <button type="button" onClick={openAction} className={buttonClasses}>
                        {card.button}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </div>
      </section>

      {supportOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Central de suporte Velo"
          className="fixed bottom-[78px] right-[18px] z-[90] flex h-[min(620px,calc(100vh-104px))] w-[min(380px,calc(100vw-28px))] flex-col overflow-hidden rounded-[26px] border border-black/10 bg-white shadow-[0_24px_70px_rgba(0,0,0,0.25)]"
        >
          {supportTab === "home" ? (
            <div className="relative h-[190px] shrink-0 bg-[radial-gradient(circle_at_22%_88%,rgba(255,255,255,0.14),transparent_34%),linear-gradient(135deg,#050505_0%,#151515_56%,#3a3a3a_100%)] px-7 pb-12 pt-7 text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-white/25 bg-white/10">
                <Package size={23} strokeWidth={2.2} />
              </span>
              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white"
                aria-label="Fechar suporte"
              >
                <X size={23} strokeWidth={2.1} />
              </button>
              <div className="absolute bottom-11 left-7 right-7">
                <p className="text-[20px] font-semibold leading-tight text-white/58">Oi {firstName}</p>
                <h2 className="mt-1 text-[29px] font-bold leading-[1.05] tracking-[-0.03em] text-white">Tem uma dúvida?</h2>
              </div>
            </div>
          ) : (
            <div className="relative flex h-[64px] shrink-0 items-center justify-center border-b border-black/10 bg-white">
              <h2 className="text-[20px] font-bold tracking-[-0.02em] text-[#1f232b]">
                {supportTab === "messages" ? "Mensagens" : supportTab === "help" ? "Ajuda" : "Novidades"}
              </h2>
              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="absolute right-5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#6b7280] transition hover:bg-black/5 hover:text-black"
                aria-label="Fechar suporte"
              >
                <X size={21} strokeWidth={2.1} />
              </button>
            </div>
          )}

          <div className={`flex-1 overflow-y-auto pb-4 ${supportTab === "home" ? "bg-[#f5f5f6] px-5 pt-4" : "bg-white"}`}>
            {supportTab === "home" ? (
              <div className="space-y-3.5 pb-2">
                <div className="rounded-[18px] border border-black/10 bg-white p-2.5 shadow-[0_14px_30px_rgba(0,0,0,0.11)]">
                  <label className="flex h-[44px] items-center rounded-[13px] bg-[#f2f2f3] px-4 text-[15px] font-semibold text-[#20242c]">
                    <span className="flex-1">Buscar ajuda</span>
                    <Search size={20} strokeWidth={2.3} className="text-black" />
                  </label>
                  {["Como publicar meu primeiro produto?", "Como criar uma página de vendas?", "Como importar produtos em alta?", "Como falar com o suporte pelo WhatsApp?"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[13px] font-medium leading-snug text-[#656b76] transition hover:text-black"
                    >
                      <span>{item}</span>
                      <ChevronRight size={18} strokeWidth={2.5} className="shrink-0 text-black" />
                    </button>
                  ))}
                </div>

                <a
                  href={WHATSAPP_SUPPORT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-[18px] border border-black/10 bg-white px-5 py-3.5 shadow-[0_12px_26px_rgba(0,0,0,0.09)] transition hover:-translate-y-0.5"
                >
                  <span>
                    <span className="block text-[15px] font-bold text-black">Enviar mensagem</span>
                    <span className="mt-1 block text-[13px] font-medium leading-snug text-[#6f7580]">Respondemos pelo WhatsApp em poucos minutos</span>
                  </span>
                  <WhatsAppIcon className="h-[24px] w-[24px] shrink-0 text-black" />
                </a>

                <button
                  type="button"
                  onClick={() => setSupportTab("news")}
                  className="overflow-hidden rounded-[15px] border border-black/10 bg-white text-left shadow-[0_10px_24px_rgba(0,0,0,0.09)] transition hover:-translate-y-0.5"
                >
                  <div className="relative h-[96px] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(135deg,#000,#2b2b2b)] text-white">
                    <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/15 px-2.5 py-0.5 text-[9px] font-bold">Velo</span>
                    <span className="absolute inset-x-5 top-10 text-center text-[22px] font-bold tracking-[-0.03em]">Central Velo</span>
                    <span className="absolute inset-x-6 bottom-5 text-center text-[10px] font-medium text-white/70">Novidades e suporte para vender melhor</span>
                  </div>
                  <div className="p-4">
                    <span className="rounded-full bg-[#f1f2f4] px-2.5 py-1 text-[12px] font-semibold text-black">Novo recurso</span>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <span>
                        <span className="block text-[15px] font-bold text-black">Suporte pelo WhatsApp</span>
                        <span className="mt-1.5 line-clamp-2 block text-[13px] font-medium leading-snug text-[#30343b]">
                          Tire dúvidas sobre produtos, páginas de venda e publicação.
                        </span>
                      </span>
                      <ChevronRight size={20} strokeWidth={2.6} className="shrink-0 text-black" />
                    </div>
                  </div>
                </button>
              </div>
            ) : null}

            {supportTab === "messages" ? (
              <div className="flex h-full flex-col items-center justify-center px-7 pb-8 text-center">
                <MessageSquare size={34} strokeWidth={2.1} className="text-black" />
                <h3 className="mt-5 text-[19px] font-bold tracking-[-0.02em] text-black">Nenhuma conversa recente</h3>
                <p className="mt-3 text-[14px] font-medium leading-relaxed text-[#5f6672]">Suas conversas recentes com o suporte aparecerão aqui.</p>
                <a
                  href={WHATSAPP_SUPPORT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-auto flex h-[44px] items-center gap-3 rounded-[14px] bg-black px-6 text-[14px] font-bold text-white shadow-[0_14px_30px_rgba(0,0,0,0.2)]"
                >
                  Enviar mensagem
                  <WhatsAppIcon className="h-[20px] w-[20px]" />
                </a>
              </div>
            ) : null}

            {supportTab === "help" ? (
              <div className="pb-3">
                <div className="border-b border-black/10 p-4">
                  <label className="flex h-[44px] items-center rounded-[12px] bg-[#f2f2f3] px-3 text-[15px] font-semibold text-[#20242c]">
                    <span className="flex-1">Buscar ajuda</span>
                    <Search size={20} strokeWidth={2.3} className="text-black" />
                  </label>
                </div>
                <div className="border-b border-black/10 px-5 py-4">
                  <h3 className="text-[18px] font-bold text-black">6 coleções</h3>
                </div>
                {[
                  ["Primeiros passos", "Aprenda a configurar a Velo e começar a vender.", "2 artigos"],
                  ["Ferramentas", "Entenda catálogo, páginas de venda, loja e integrações.", "12 artigos"],
                  ["Assinatura", "Gerencie plano, cobrança e limites da conta.", "6 artigos"],
                  ["Detalhes da conta", "Atualize dados, preferências e canais conectados.", "4 artigos"],
                ].map(([title, description, count], index) => (
                  <button
                    key={title}
                    type="button"
                    className={`flex w-full items-center gap-3 border-b border-black/10 px-5 py-3.5 text-left transition hover:bg-black/[0.03] ${index === 2 ? "bg-[#f3f4f8]" : "bg-white"}`}
                  >
                    <span className="flex-1">
                      <span className="block text-[15px] font-bold text-black">{title}</span>
                      <span className="mt-1.5 block text-[13px] leading-snug text-[#2f343c]">{description}</span>
                      <span className="mt-1.5 block text-[12px] font-medium text-[#6f7580]">{count}</span>
                    </span>
                    <ChevronRight size={19} strokeWidth={2.6} className="text-black" />
                  </button>
                ))}
              </div>
            ) : null}

            {supportTab === "news" ? (
              <div className="px-4 pb-3 pt-4">
                <div className="mb-4 flex items-center justify-between px-1">
                  <span>
                    <span className="block text-[18px] font-bold text-black">Últimas</span>
                    <span className="text-[14px] font-medium text-[#2f343c]">Da equipe Velo</span>
                  </span>
                  <span className="flex -space-x-2">
                    {["L", "V", "X"].map((avatar) => (
                      <span key={avatar} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-black text-[11px] font-bold text-white">
                        {avatar}
                      </span>
                    ))}
                  </span>
                </div>
                {[0, 1].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="mb-3 overflow-hidden rounded-[15px] border border-black/10 bg-white text-left shadow-[0_10px_24px_rgba(0,0,0,0.09)]"
                  >
                    <div className="h-[92px] bg-[linear-gradient(135deg,#000,#2c2c2c)]" />
                    <div className="p-4">
                      <span className="rounded-full bg-[#f1f2f4] px-2.5 py-1 text-[12px] font-semibold text-black">Novo recurso</span>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <span>
                          <span className="block text-[15px] font-bold text-black">{item === 0 ? "Suporte Velo no WhatsApp" : "Guias para vender melhor"}</span>
                          <span className="mt-1.5 line-clamp-2 block text-[13px] font-medium leading-snug text-[#30343b]">
                            {item === 0 ? "Fale com a nossa equipe para resolver dúvidas de configuração." : "Veja caminhos rápidos para criar ofertas e publicar produtos."}
                          </span>
                        </span>
                        <ChevronRight size={20} strokeWidth={2.6} className="shrink-0 text-black" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid h-[62px] shrink-0 grid-cols-4 border-t border-black/10 bg-white">
            {supportTabs.map((tab) => {
              const Icon = tab.icon;
              const active = supportTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSupportTab(tab.id)}
                  className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${active ? "text-black" : "text-[#70757d] hover:text-black"}`}
                >
                  <span className="relative">
                    <Icon size={20} strokeWidth={2.1} fill={active && tab.id === "home" ? "currentColor" : "none"} />
                    {tab.hasBadge ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#ef4444] ring-2 ring-white" /> : null}
                  </span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-[20px] right-[20px] z-[70] flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setSupportTab("home");
            setSupportOpen(true);
          }}
          className="relative flex h-[48px] w-[48px] items-center justify-center rounded-full bg-black text-white shadow-[0_12px_28px_rgba(0,0,0,0.24)] transition hover:-translate-y-0.5 hover:bg-[#171717]"
          aria-label="Abrir central de ajuda da Velo"
          title="Central de ajuda"
        >
          <svg
            aria-hidden="true"
            className="h-[25px] w-[25px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.12)]"
            viewBox="0 0 32 32"
            fill="none"
          >
            <path
              d="M10.1 5.7h11.8c1.22 0 2.22 1 2.22 2.22v17.1c0 1.22-1 2.22-2.22 2.22H10.1c-1.22 0-2.22-1-2.22-2.22V7.92c0-1.22 1-2.22 2.22-2.22Z"
              fill="white"
            />
            <path
              d="M12.9 4.2h6.2c.92 0 1.67.75 1.67 1.67v3.08c0 .92-.75 1.67-1.67 1.67h-6.2c-.92 0-1.67-.75-1.67-1.67V5.87c0-.92.75-1.67 1.67-1.67Z"
              fill="#e5e7eb"
            />
            <path
              d="M13.25 13.3h5.9M13.25 17.15h5.9"
              stroke="#111827"
              strokeWidth="2.15"
              strokeLinecap="round"
            />
            <path
              d="M12.4 22.95h7.2"
              stroke="#111827"
              strokeWidth="2.55"
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            1
          </span>
        </button>
      </div>
      <InviteFriendModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <TutorialModal open={tutorialOpen} onOpenChange={setTutorialOpen} />
      <ProjectCreationWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        defaultTipo={wizardDefaultTipo}
        allowTipoChoice={wizardAllowChoice}
        isTipoRestricted={(t) =>
          t === "loja_completa" ? !canCreateStorePlan : !canCreateSalesPagePlan
        }
        onRestrictedTipo={(t) => {
          setWizardOpen(false);
          openUpgrade({ defaultPlan: t === "loja_completa" ? "pro" : "base" });
        }}
        onCreated={handleProjectCreated}
      />
    </main>
    </>
  );
};

export default DashboardHomePage;
