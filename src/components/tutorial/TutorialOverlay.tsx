import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isSupabaseEnabled, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AquasIcon from "@/components/dashboard/AquasIcon";
import {
  Archive,
  BarChart3,
  Bot,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Home,
  MousePointerClick,
  PackageSearch,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";

type TourStep = {
  icon: LucideIcon;
  title: string;
  body: string;
  selector: string;
  route: string;
  cta: string;
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const STORE_TOUR_KEY = "velo-dashboard-store-tour";
const ACTIVE_MODAL_ATTR = "data-velo-active-modal";
const ACTIVE_MODAL_EVENT = "velo:active-modal-change";
const TOUR_MODAL_ID = "atlas-tour";
const FIRST_CATALOG_PRODUCT_ROUTE = "__first_catalog_product__";
const ANNOUNCEMENT_WAIT_DASHBOARD_RETURN_KEY = "velo:announcement-wait-dashboard-return";

const STEPS: TourStep[] = [
  {
    icon: Home,
    title: "Este é o seu Início",
    body: "Aqui você acompanha a saúde da operação: vendas, pedidos, gráficos e atalhos importantes. É o painel principal para saber se tudo está andando.",
    selector: '[data-dashboard-tour="dashboard-main"]',
    route: "/dashboard",
    cta: "Mostrar catálogo",
  },
  {
    icon: PackageSearch,
    title: "Abra o Catálogo",
    body: "Esse menu leva você para os produtos da Velo. É por aqui que você escolhe oportunidades novas para testar, importar e transformar em páginas de venda.",
    selector: '[data-dashboard-tour="catalogo"]',
    route: "/dashboard/catalogo",
    cta: "Ver Atlas",
  },
  {
    icon: Bot,
    title: "Use o Atlas para encontrar produtos",
    body: "Clique no Aquas/Atlas quando quiser usar a inteligência artificial da Velo. Você pode pedir ideias de produto, nichos, oportunidades e filtros sem procurar tudo manualmente.",
    selector: '[data-dashboard-tour="catalogo-atlas"]',
    route: "/dashboard/catalogo",
    cta: "Ver filtros",
  },
  {
    icon: SlidersHorizontal,
    title: "Filtre o catálogo",
    body: "Aqui você pesquisa por nome, categoria, preço e avaliação. Use esses filtros para chegar rápido nos produtos que combinam com o seu público.",
    selector: '[data-dashboard-tour="catalogo-busca"]',
    route: "/dashboard/catalogo",
    cta: "Ver produto",
  },
  {
    icon: MousePointerClick,
    title: "Entre no produto",
    body: "Clique em Importar ou no card para abrir o detalhe do produto. É dentro dele que ficam as ações importantes para colocar o item na sua loja.",
    selector: '[data-dashboard-tour="catalogo-produto"]',
    route: "/dashboard/catalogo",
    cta: "Abrir detalhe",
  },
  {
    icon: ShoppingBag,
    title: "Importar para minha loja",
    body: "Este botão adiciona o produto à sua operação. Depois de importar, você pode personalizar e publicar com mais controle.",
    selector: '[data-dashboard-tour="produto-importar"]',
    route: FIRST_CATALOG_PRODUCT_ROUTE,
    cta: "Ver página de vendas",
  },
  {
    icon: FilePlus2,
    title: "Criar página de vendas",
    body: "Esse botão inicia o fluxo para criar uma página de vendas com o produto selecionado. A Velo já leva o item para o onboarding e começa a montar a estrutura.",
    selector: '[data-dashboard-tour="produto-criar-pagina"]',
    route: FIRST_CATALOG_PRODUCT_ROUTE,
    cta: "Ver publicações",
  },
  {
    icon: Archive,
    title: "Controle suas publicações",
    body: "Nesta página você filtra anúncios ativos, rascunhos e arquivados. É onde você revisa o que já está pronto para vender e encontra rapidamente cada publicação.",
    selector: '[data-dashboard-tour="publicacoes-filtros"]',
    route: "/dashboard/publicacoes",
    cta: "Ver pedidos",
  },
  {
    icon: ShoppingCart,
    title: "Acompanhe pedidos",
    body: "Este contador e a lista mostram as vendas que chegaram. Quando houver pedido novo, você acompanha status, comprador, valor e fornecedor por aqui.",
    selector: '[data-dashboard-tour="pedidos-resumo"]',
    route: "/dashboard/pedidos",
    cta: "Ver relatórios",
  },
  {
    icon: BarChart3,
    title: "Gere relatórios inteligentes",
    body: "Clique em Criar relatório para a Velo transformar dados da sua loja em uma análise prática: o que vendeu, onde melhorar e quais próximos passos seguir.",
    selector: '[data-dashboard-tour="relatorios-criar"]',
    route: "/dashboard/relatorios",
    cta: "Abrir configurações",
  },
  {
    icon: Settings2,
    title: "Configure sua conta",
    body: "Aqui você edita perfil, lojas, integrações, plano, segurança e suporte. É a central para deixar sua conta redonda antes de vender mais.",
    selector: '[data-dashboard-tour="configuracoes-perfil"]',
    route: "/dashboard/configuracoes",
    cta: "Mostrar minha loja",
  },
  {
    icon: ShoppingBag,
    title: "Sua loja está pronta",
    body: "Esse é o caminho final: Minha loja. Clique aqui para ver como ficou sua loja e editar detalhes quando quiser.",
    selector: '[data-dashboard-tour="minha-loja"]',
    route: "/dashboard",
    cta: "Abrir minha loja",
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getActiveModal = () => {
  if (typeof document === "undefined") return null;
  return document.body.getAttribute(ACTIVE_MODAL_ATTR);
};

const setActiveModal = (modalId: string | null) => {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const currentModal = document.body.getAttribute(ACTIVE_MODAL_ATTR);
  if (currentModal === modalId) return;
  if (!modalId && !currentModal) return;
  if (modalId) {
    document.body.setAttribute(ACTIVE_MODAL_ATTR, modalId);
  } else {
    document.body.removeAttribute(ACTIVE_MODAL_ATTR);
  }
  window.dispatchEvent(new CustomEvent(ACTIVE_MODAL_EVENT));
};

export default function TutorialOverlay() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [modalSlotReady, setModalSlotReady] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [productDetailRoute, setProductDetailRoute] = useState<string | null>(null);
  const [isStepReady, setIsStepReady] = useState(false);

  const current = STEPS[step];
  const Icon = current.icon;
  const isLastStep = step === STEPS.length - 1;

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(location.search);
    const shouldOpenStoreTour =
      params.get("tour") === "loja" ||
      (typeof window !== "undefined" && sessionStorage.getItem(STORE_TOUR_KEY) === "1");

    if (shouldOpenStoreTour) {
      setStep(0);
      setVisible(true);
      try {
        sessionStorage.removeItem(STORE_TOUR_KEY);
      } catch {
        // ignore storage errors
      }
      if (params.get("tour")) navigate(location.pathname, { replace: true });
      return;
    }

    (async () => {
      if (!isSupabaseEnabled) return;
      const { data } = await (supabase as never as { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data?: { tutorial_completed?: boolean } | null }> } } } }).from("profiles").select("tutorial_completed").eq("user_id", user.id).maybeSingle();
      if (data && data.tutorial_completed === false) setVisible(true);
    })();
  }, [location.pathname, location.search, navigate, user]);

  useEffect(() => {
    if (!visible) return;

    const claimModalSlot = () => {
      const activeModal = getActiveModal();
      if (!activeModal || activeModal === TOUR_MODAL_ID) {
        setActiveModal(TOUR_MODAL_ID);
        setModalSlotReady(true);
        return;
      }

      setModalSlotReady(false);
    };

    claimModalSlot();
    window.addEventListener(ACTIVE_MODAL_EVENT, claimModalSlot);

    return () => {
      window.removeEventListener(ACTIVE_MODAL_EVENT, claimModalSlot);
      if (getActiveModal() === TOUR_MODAL_ID) setActiveModal(null);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !modalSlotReady) return;

    let desiredRoute = current.route;
    if (current.route === FIRST_CATALOG_PRODUCT_ROUTE) {
      if (location.pathname.startsWith("/dashboard/catalogo/")) {
        desiredRoute = location.pathname;
        if (!productDetailRoute) setProductDetailRoute(location.pathname);
      } else {
        const firstProductLink = document.querySelector<HTMLAnchorElement>('[data-dashboard-tour="catalogo-produto-abrir"]');
        const firstProductPath = firstProductLink?.getAttribute("href") ?? productDetailRoute;
        desiredRoute = firstProductPath || "/dashboard/catalogo";
        if (firstProductPath && !productDetailRoute) setProductDetailRoute(firstProductPath);
      }
    }

    if (desiredRoute && location.pathname !== desiredRoute) {
      navigate(desiredRoute, { replace: true });
    }
  }, [current.route, location.pathname, modalSlotReady, navigate, productDetailRoute, visible]);

  useEffect(() => {
    if (!visible || !modalSlotReady) return;

    let frame = 0;
    let poll: number | undefined;
    let hasScrolledToTarget = false;
    setIsStepReady(false);
    setTargetRect(null);

    const updateTarget = () => {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(current.selector));
      const element = elements.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!element) {
        setTargetRect(null);
        setIsStepReady(false);
        return;
      }
      if (poll) {
        window.clearInterval(poll);
        poll = undefined;
      }
      setIsStepReady(true);
      if (!hasScrolledToTarget) {
        element.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
        hasScrolledToTarget = true;
      }
      const rect = element.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateTarget);
    };

    schedule();
    const timeout = window.setTimeout(schedule, 260);
    poll = window.setInterval(schedule, 220);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);

    return () => {
      window.clearTimeout(timeout);
      if (poll) window.clearInterval(poll);
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [current.selector, location.pathname, modalSlotReady, visible]);

  const finish = async ({ waitForDashboardReturn = false }: { waitForDashboardReturn?: boolean } = {}) => {
    if (waitForDashboardReturn) {
      try {
        sessionStorage.setItem(ANNOUNCEMENT_WAIT_DASHBOARD_RETURN_KEY, Date.now().toString());
      } catch {
        // ignore storage errors
      }
    }
    if (getActiveModal() === TOUR_MODAL_ID) setActiveModal(null);
    setModalSlotReady(false);
    setVisible(false);
    if (user && isSupabaseEnabled) {
      await (supabase as never as { from: (table: string) => { update: (payload: { tutorial_completed: boolean }) => { eq: (column: string, value: string) => Promise<unknown> } } }).from("profiles").update({ tutorial_completed: true }).eq("user_id", user.id);
    }
  };

  const openStore = () => {
    void finish({ waitForDashboardReturn: true });
    navigate("/minha-loja/editor");
  };

  const goToStep = (nextStep: number) => {
    setStep(clamp(nextStep, 0, STEPS.length - 1));
  };

  const bubbleStyle = useMemo(() => {
    if (typeof window === "undefined") return {};
    const width = 360;
    const margin = 22;
    if (!targetRect) {
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const preferRight = targetRect.left + targetRect.width + width + margin < window.innerWidth;
    const left = preferRight
      ? targetRect.left + targetRect.width + margin
      : Math.max(margin, targetRect.left - width - margin);
    const top = clamp(targetRect.top + targetRect.height / 2 - 150, margin, window.innerHeight - 330);

    return { left, top, width };
  }, [targetRect]);

  if (!visible || !modalSlotReady) return null;

  const isWaitingForStep = !isStepReady;

  const spotlight = targetRect
    ? {
        top: targetRect.top - 8,
        left: targetRect.left - 8,
        width: targetRect.width + 16,
        height: targetRect.height + 16,
      }
    : null;

  const pulse = targetRect
    ? {
        top: targetRect.top + targetRect.height / 2 - 13,
        left: targetRect.left + targetRect.width / 2 - 13,
      }
    : null;

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
  const blurPanels = spotlight
    ? [
        { top: 0, left: 0, width: viewportWidth, height: Math.max(0, spotlight.top) },
        { top: spotlight.top, left: 0, width: Math.max(0, spotlight.left), height: spotlight.height },
        {
          top: spotlight.top,
          left: spotlight.left + spotlight.width,
          width: Math.max(0, viewportWidth - (spotlight.left + spotlight.width)),
          height: spotlight.height,
        },
        {
          top: spotlight.top + spotlight.height,
          left: 0,
          width: viewportWidth,
          height: Math.max(0, viewportHeight - (spotlight.top + spotlight.height)),
        },
      ]
    : null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {blurPanels ? (
        blurPanels.map((panel, index) => (
          <div
            key={index}
            className="pointer-events-auto absolute bg-black/34 backdrop-blur-[3px] transition-all duration-300"
            style={panel}
          />
        ))
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-black/34 backdrop-blur-[3px]" />
      )}

      {spotlight ? (
        <div
          className="absolute rounded-[18px] border-2 border-white bg-transparent shadow-[0_0_0_8px_rgba(255,255,255,0.22),0_22px_70px_rgba(0,0,0,0.28)] transition-all duration-300"
          style={spotlight}
        />
      ) : null}

      {pulse ? (
        <div className="absolute transition-all duration-300" style={pulse}>
          <span className="absolute inline-flex h-[26px] w-[26px] animate-ping rounded-full bg-black/60" />
          <span className="relative inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-white bg-black shadow-[0_12px_34px_rgba(0,0,0,0.28)]">
            <span className="h-2 w-2 rounded-full bg-white" />
          </span>
        </div>
      ) : null}

      <section
        className="pointer-events-auto absolute rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_30px_90px_rgba(0,0,0,0.28)] transition-all duration-300"
        style={bubbleStyle}
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <AquasIcon size={44} inverted className="shadow-[0_12px_32px_rgba(0,0,0,0.2)]" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-[#111827]">Atlas</p>
                <p className="text-[11px] font-medium text-[#8b94a6]">Guia rápido da Velo</p>
              </div>
              <button onClick={() => { void finish(); }} className="rounded-full p-1.5 text-[#8b94a6] transition hover:bg-[#f1f3f7] hover:text-[#111827]" aria-label="Fechar tour">
                <X size={17} />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#f5f6f8] text-[#111827]">
                <Icon size={20} />
              </span>
              <h3 className="text-[22px] font-bold leading-tight tracking-[-0.04em] text-[#111827]">{current.title}</h3>
            </div>

            <p className="mt-3 text-[14px] leading-relaxed text-[#687086]">{current.body}</p>

            {isWaitingForStep ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#f5f6f8] px-3 py-2 text-[12px] font-semibold text-[#697083]">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#cbd3df] border-t-black" />
                Preparando próxima tela...
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="shrink-0 text-[12px] font-medium text-[#8b94a6]">Passo {step + 1} de {STEPS.length}</span>
              <div className="flex min-w-0 flex-1 justify-end gap-1 overflow-hidden">
                {STEPS.map((_, index) => (
                  <span key={index} className={`h-1.5 shrink-0 rounded-full transition-all ${index <= step ? "w-4 bg-black" : "w-2.5 bg-[#d8dde8]"}`} />
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button onClick={() => { void finish(); }} className="text-[13px] font-semibold text-[#697083] transition hover:text-[#111827]">Pular tour</button>
              <div className="flex gap-2">
                {step > 0 ? (
                  <button onClick={() => goToStep(step - 1)} className="inline-flex h-10 items-center justify-center rounded-full border border-[#dfe4ef] px-3 text-[#111827] transition hover:bg-[#f5f6f8]" aria-label="Voltar passo">
                    <ChevronLeft size={17} />
                  </button>
                ) : null}
                <button
                  onClick={() => (isLastStep ? openStore() : goToStep(step + 1))}
                  disabled={isWaitingForStep}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-black px-5 text-[13px] font-bold text-white transition hover:bg-[#202020] disabled:cursor-not-allowed disabled:bg-[#d7dce6] disabled:text-[#8791a3]"
                >
                  {isWaitingForStep ? "Carregando..." : isLastStep ? "Abrir minha loja" : current.cta}
                  {!isWaitingForStep ? (!isLastStep ? <ChevronRight size={16} /> : <Sparkles size={15} />) : null}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
