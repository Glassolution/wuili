import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Folder, Plus, SlidersHorizontal, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import AtlasPromptBox from "@/components/dashboard/AtlasPromptBox";
import { fetchUserProjects } from "@/lib/userProjects";
import { ENTRADA_POS_ONBOARDING, hasPlayedDashboardIntro, markDashboardIntroAsPlayed } from "@/lib/dashboardIntro";
import { ONBOARDING_COMPLETED_EVENT, shouldShowOnboarding } from "@/components/onboarding/OnboardingModal";
import cardTemasImg from "@/assets/home-card-temas.webp";
import agenteEstrela from "@/assets/agentes/estrela.png";
import agenteLua from "@/assets/agentes/lua.png";
import agenteSino from "@/assets/agentes/sino.png";
import agenteConcha from "@/assets/agentes/concha.png";
import agenteCubo from "@/assets/agentes/cubo.png";
import agenteFolha from "@/assets/agentes/folha.png";
import MobileHome from "@/components/dashboard/MobileHome";
import { useIsMobile } from "@/hooks/use-mobile";

// Curva das entradas: desaceleração suave, sem a cauda longa do ease-out exponencial.
const INTRO = {
  revealEase: [0.22, 1, 0.36, 1] as const,
  revealDuration: 0.7,
};

// Início no desenho de "primeiros passos" (boas-vindas centralizada, caixa do
// assistente e grade de cartões com ilustração). Fundo branco, Inter.
const HOME_CSS = `
.velo-inicio-card { background: #FFFFFF; border: 1px solid #E6E7EA; border-radius: 16px; box-shadow: 0 1px 2px rgba(16,24,40,0.04); transition: box-shadow 180ms ease-out, border-color 180ms ease-out; }
.velo-inicio-card:hover { border-color: #DADCE0; box-shadow: 0 6px 20px rgba(16,24,40,0.06); }
.velo-inicio-botao { background: #FFFFFF; border: 1px solid #E3E4E8; box-shadow: 0 1px 2px rgba(16,24,40,0.06); transition: background-color 150ms ease-out, border-color 150ms ease-out; }
.velo-inicio-botao:hover { background: #F6F6F7; border-color: #D5D7DC; }
.velo-inicio-icone { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-inicio-ghost { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-inicio-ghost:hover { background: #F1F1F2; color: #0B0D12; }
.velo-inicio-item { transition: background-color 150ms ease-out; }
.velo-inicio-item:hover { background: #F5F6F8; }
.velo-inicio-novo { transition: border-color 150ms ease-out, background-color 150ms ease-out; }
.velo-inicio-novo:hover { border-color: #AEB6C3; background: #FAFAFB; }
.velo-inicio-loja { text-decoration: underline dotted; text-decoration-thickness: 2px; text-underline-offset: 6px; text-decoration-color: #9AA1AE; transition: text-decoration-color 150ms ease-out; }
.velo-inicio-loja:hover { text-decoration-color: #0B0D12; }
.velo-inicio-caixa { transition: border-color 150ms ease-out, box-shadow 150ms ease-out; }
.velo-inicio-caixa:focus-within { border-color: #C9CDD4; box-shadow: 0 2px 12px rgba(16,24,40,0.08); }
.velo-inicio-botao:focus-visible, .velo-inicio-icone:focus-visible, .velo-inicio-ghost:focus-visible, .velo-inicio-item:focus-visible, .velo-inicio-novo:focus-visible, .velo-inicio-loja:focus-visible, .velo-inicio-link:focus-visible {
  outline: none; box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px rgba(47,91,234,0.45);
}
/* O painel força Hanken Grotesk com !important; a Início usa Inter sem números tabulares. */
.dashboard-inter .velo-fonte-inter.velo-inicio-root, .dashboard-inter .velo-fonte-inter.velo-inicio-root * { font-feature-settings: normal !important; }
.dashboard-inter .velo-fonte-inter h1, .dashboard-inter .velo-fonte-inter h2, .dashboard-inter .velo-fonte-inter h3 { font-family: "Inter", ui-sans-serif, system-ui, sans-serif !important; letter-spacing: -0.02em; }
`;

type CartaoId = "produto" | "visual" | "mercado-livre" | "imagens" | "projetos";

type Cartao = {
  id: CartaoId;
  titulo: string;
  descricao: string;
  botao: string;
  to: string;
};

// Cada cartão leva a uma tela que já existe; nada de número inventado.
const CARTOES: Cartao[] = [
  {
    id: "produto",
    titulo: "Adicione seu primeiro produto",
    descricao: "Escolha um produto do catálogo para vender. Dá para ajustar preço e detalhes depois.",
    botao: "Adicionar produto",
    to: "/dashboard/catalogo",
  },
  {
    id: "visual",
    titulo: "Escolha o visual da loja",
    descricao: "Escolha um tema que combine com sua marca e personalize a partir dele.",
    botao: "Escolher tema",
    to: "/dashboard/modelos",
  },
  {
    id: "mercado-livre",
    titulo: "Conecte o Mercado Livre",
    descricao: "Conecte sua conta para publicar os produtos e receber os pedidos na Velo.",
    botao: "Conectar conta",
    to: "/dashboard/configuracoes?tab=Integrações",
  },
  {
    id: "imagens",
    titulo: "Crie imagens com IA",
    descricao: "Gere fotos de produto para o site e para os anúncios em poucos minutos.",
    botao: "Criar imagem",
    to: "/dashboard/imagens-ia",
  },
  {
    id: "projetos",
    titulo: "Acompanhe seus projetos",
    descricao: "Veja os sites das suas lojas e o que os agentes estão fazendo neles.",
    botao: "Ver projetos",
    to: "/dashboard/projetos",
  },
];

// Quais cartões a pessoa escondeu: preferência deste navegador, por usuário.
const chaveCartoesOcultos = (userId: string) => `velo:inicio:cartoes-ocultos:${userId}`;
const lerCartoesOcultos = (userId: string): string[] => {
  try {
    const bruto = window.localStorage.getItem(chaveCartoesOcultos(userId));
    const lista: unknown = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};
const salvarCartoesOcultos = (userId: string, ids: string[]) => {
  try {
    window.localStorage.setItem(chaveCartoesOcultos(userId), JSON.stringify(ids));
  } catch {
    // Sem armazenamento (aba anônima, bloqueio): a escolha vale só nesta visita.
  }
};

const Agente = ({ src, className }: { src: string; className: string }) => (
  <img src={src} alt="" draggable={false} className={`pointer-events-none absolute select-none object-contain ${className}`} />
);

const Selo = ({ children }: { children: ReactNode }) => (
  <span className="absolute left-2 top-2 z-[2] flex h-7 items-center gap-1.5 rounded-[8px] bg-[#5C5F66] px-2.5 text-[12.5px] font-medium text-white">
    {children}
  </span>
);

// Ilustrações dos cartões: fundo cinza-claro com elementos da Velo (agentes,
// logos e telas), no lugar das fotos de produto da referência.
const Ilustracao = ({ id, totalProjetos }: { id: CartaoId; totalProjetos?: number }) => {
  const base = "relative block h-[140px] overflow-hidden rounded-[12px] bg-[#F3F3F4]";
  if (id === "produto") {
    return (
      <span className={base}>
        <Agente src={agenteEstrela} className="-left-1 top-1 h-[86px] w-[86px] -rotate-12" />
        <span className="absolute left-1/2 top-1/2 flex h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[10px] border border-dashed border-[#C9CCD2] bg-white text-[#2B2F36] shadow-[0_6px_18px_rgba(16,24,40,0.08)]">
          <Plus size={18} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <Agente src={agenteCubo} className="-right-1 top-3 h-[92px] w-[92px] rotate-6" />
        <Agente src={agenteLua} className="bottom-[-18px] left-[18%] h-[64px] w-[64px] rotate-12" />
      </span>
    );
  }
  if (id === "visual") {
    return (
      <span className={base}>
        <img src={cardTemasImg} alt="" draggable={false} className="absolute left-[8%] top-[10%] h-[120%] w-auto max-w-none select-none object-contain" />
        <span className="absolute right-[18%] top-[30%] flex h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-[#0B0D12] text-[19px] font-medium text-white shadow-[0_6px_18px_rgba(16,24,40,0.18)]">
          Aa
        </span>
      </span>
    );
  }
  if (id === "mercado-livre") {
    return (
      <span className={base}>
        <span className="absolute left-[26%] top-[20%] flex h-[58px] w-[120px] items-center justify-center rounded-[12px] bg-[#FFE600] shadow-[0_8px_20px_rgba(16,24,40,0.12)]">
          <img src="/brand/mercado-livre-handshake.svg" alt="" className="h-[40px] w-auto object-contain" draggable={false} />
        </span>
        <span className="absolute left-[44%] top-[50%] flex h-[40px] items-center gap-2 rounded-[10px] bg-white px-3 text-[12.5px] font-medium text-[#2B2F36] shadow-[0_6px_18px_rgba(16,24,40,0.10)]">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#9AA1AE]" />
          Sua conta
        </span>
        <Agente src={agenteFolha} className="bottom-[-6px] left-[6%] h-[72px] w-[72px] -rotate-6" />
      </span>
    );
  }
  if (id === "imagens") {
    return (
      <span className={base}>
        <Selo>
          <Sparkles size={12} strokeWidth={2} aria-hidden="true" />
          Com IA
        </Selo>
        <span className="absolute left-1/2 top-[54%] flex h-[46px] w-[76%] -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-[14px] bg-white px-4 text-[13px] shadow-[0_8px_22px_rgba(16,24,40,0.10)]">
          <span className="h-2 flex-1 rounded-full bg-[#E6E7EA]" />
          <span className="text-[#0B0D12]">.jpg</span>
        </span>
        <Agente src={agenteConcha} className="bottom-[-8px] right-[6%] h-[62px] w-[62px] rotate-6" />
      </span>
    );
  }
  return (
    <span className={base}>
      {typeof totalProjetos === "number" && (
        <Selo>
          <span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-white/70" />
          {totalProjetos} {totalProjetos === 1 ? "projeto" : "projetos"}
        </Selo>
      )}
      <span className="absolute left-[28%] top-[34%] flex h-[64px] w-[96px] -rotate-6 items-end rounded-[10px] bg-white/90 p-2 shadow-[0_6px_18px_rgba(16,24,40,0.08)]">
        <Folder size={16} strokeWidth={1.6} aria-hidden="true" className="text-[#9AA1AE]" />
      </span>
      <span className="absolute left-[42%] top-[42%] flex h-[64px] w-[96px] rotate-3 items-end rounded-[10px] bg-white p-2 shadow-[0_8px_20px_rgba(16,24,40,0.10)]">
        <Folder size={16} strokeWidth={1.6} aria-hidden="true" className="text-[#2B2F36]" />
      </span>
      <Agente src={agenteSino} className="right-[10%] top-[12%] h-[58px] w-[58px] rotate-12" />
    </span>
  );
};

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [personalizarAberto, setPersonalizarAberto] = useState(false);
  const [ocultos, setOcultos] = useState<string[]>([]);
  // Mesma leitura da página Projetos (RPC get_user_projects), sem consulta nova.
  const projetos = useQuery({
    queryKey: ["home-projetos-da-loja", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: fetchUserProjects,
  });
  const reduceMotion = useReducedMotion();
  const introDecisionMade = useRef<string | null>(null);
  // "waiting": o onboarding está na frente da home. A intro fica guardada para
  // tocar quando ele fecha — antes ela rodava escondida atrás do modal.
  const [introState, setIntroState] = useState<"pending" | "waiting" | "play" | "done">("pending");

  useLayoutEffect(() => {
    const userId = user?.id;
    if (!userId || introDecisionMade.current === userId) return;

    // Decidido uma vez por montagem/usuário: navegar dentro do app e voltar para a
    // home não repete a introdução, mas recarregar o site ou reentrar na conta sim.
    introDecisionMade.current = userId;

    if (user && shouldShowOnboarding(user)) {
      setIntroState("waiting");
      return;
    }

    const shouldPlay = !reduceMotion && !hasPlayedDashboardIntro(userId);
    if (shouldPlay) markDashboardIntroAsPlayed(userId);

    setIntroState(shouldPlay ? "play" : "done");
  }, [reduceMotion, user]);

  useEffect(() => {
    if (introState !== "waiting" || !user?.id) return;
    const userId = user.id;
    let timer: number | undefined;
    const aoConcluirOnboarding = () => {
      // Espera o modal começar a desbotar para a home entrar por baixo dele.
      timer = window.setTimeout(() => {
        markDashboardIntroAsPlayed(userId);
        setIntroState(reduceMotion ? "done" : "play");
      }, reduceMotion ? 0 : ENTRADA_POS_ONBOARDING.homeStart * 1000);
    };
    window.addEventListener(ONBOARDING_COMPLETED_EVENT, aoConcluirOnboarding);
    return () => {
      window.removeEventListener(ONBOARDING_COMPLETED_EVENT, aoConcluirOnboarding);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [introState, reduceMotion, user?.id]);

  useEffect(() => {
    if (!personalizarAberto) return;
    const fecharComEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPersonalizarAberto(false);
    };
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, [personalizarAberto]);

  useEffect(() => {
    setOcultos(user?.id ? lerCartoesOcultos(user.id) : []);
  }, [user?.id]);

  const playIntro = introState === "play";
  // O blur de saída suaviza o fade: sem ele a opacidade sozinha lê como um "liga/desliga".
  const revealProps = (delay: number, distance = 12) => playIntro
    ? {
        initial: { opacity: 0, y: distance, filter: "blur(4px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        transition: { delay, duration: INTRO.revealDuration, ease: INTRO.revealEase },
      }
    : { initial: false as const, animate: { opacity: 1, y: 0 } };

  if (introState === "pending" || introState === "waiting") {
    return (
      <main
        aria-hidden="true"
        className="shrink-0 bg-white -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]"
      />
    );
  }

  const go = (path: string) => () => navigate(path);
  const listaProjetos = projetos.data ?? [];
  const totalProjetos = projetos.data ? listaProjetos.length : undefined;
  // Nome da loja no título: o projeto mais recente; sem projeto, "sua loja".
  const lojaRecente = [...listaProjetos].sort(
    (a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime(),
  )[0];
  const nomeDaLoja = lojaRecente?.nome?.trim() || "sua loja";
  const atualizarOcultos = (ids: string[]) => {
    setOcultos(ids);
    if (user?.id) salvarCartoesOcultos(user.id, ids);
  };
  const alternarCartao = (id: string) =>
    atualizarOcultos(ocultos.includes(id) ? ocultos.filter((item) => item !== id) : [...ocultos, id]);
  const cartoes = CARTOES.filter((cartao) => !ocultos.includes(cartao.id));

  return (
    <main className="velo-fonte-inter velo-inicio-root shrink-0 overflow-auto bg-white text-[#0B0D12] -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]">
      <style>{HOME_CSS}</style>

      {/* Linha do topo: atalho de ajuda à direita, discreto. */}
      <motion.div {...revealProps(0, -6)} className="flex h-14 items-center justify-end px-6 text-[13px] text-[#4B5563]">
        Dúvidas?&nbsp;
        <button
          type="button"
          onClick={go("/dashboard/comunidade")}
          className="velo-inicio-link rounded font-medium text-[#0B0D12] underline underline-offset-2"
        >
          Comunidade e Ajuda
        </button>
      </motion.div>

      <div className="mx-auto w-full max-w-[940px] px-4 pb-16">
        {/* Boas-vindas centralizada, com o nome da loja sublinhado. */}
        <motion.div {...revealProps(0.05, 10)} className="pt-24 text-center">
          <h1 className="m-0 text-[30px] font-normal leading-[1.2] tracking-[-0.02em] text-[#0B0D12]">
            Bem-vindo à Velo
            <br />
            Vamos montar{" "}
            <button type="button" onClick={go("/dashboard/projetos")} className="velo-inicio-loja rounded-sm">
              {nomeDaLoja}
            </button>
          </h1>
        </motion.div>

        {/* Caixa do Atlas: envia a primeira mensagem; a conversa abre no painel do Atlas. */}
        <motion.div {...revealProps(0.1, 10)} className="mt-20">
          <AtlasPromptBox />
        </motion.div>

        {/* Comece a montar sua loja: grade de cartões com ilustração. */}
        <motion.div {...revealProps(0.15, 10)} className="relative mt-20 flex items-center justify-between">
          <h2 className="m-0 text-[15px] font-medium text-[#0B0D12]">Comece a montar sua loja</h2>
          <button
            type="button"
            onClick={() => setPersonalizarAberto((aberto) => !aberto)}
            aria-haspopup="dialog"
            aria-expanded={personalizarAberto}
            className="velo-inicio-ghost flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-medium text-[#4B5563]"
          >
            <SlidersHorizontal size={14} strokeWidth={1.8} aria-hidden="true" />
            Personalizar
          </button>

          {personalizarAberto && (
            <>
              <button
                type="button"
                aria-label="Fechar personalização"
                tabIndex={-1}
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setPersonalizarAberto(false)}
              />
              <div
                role="dialog"
                aria-label="Personalizar cartões"
                className="absolute right-0 top-10 z-50 w-[300px] rounded-[16px] border border-[#E6E7EA] bg-white p-3"
                style={{ boxShadow: "0 16px 40px rgba(16,24,40,0.12)" }}
              >
                <p className="m-0 px-1 text-[14px] font-medium text-[#0B0D12]">Seus cartões</p>
                <p className="m-0 mt-0.5 px-1 text-[12.5px] text-[#8A93A3]">Escolha o que aparece na sua Início.</p>
                <ul className="m-0 mt-2 list-none p-0">
                  {CARTOES.map((cartao) => {
                    const visivel = !ocultos.includes(cartao.id);
                    return (
                      <li key={cartao.id}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={visivel}
                          onClick={() => alternarCartao(cartao.id)}
                          className="velo-inicio-item flex w-full items-center justify-between gap-3 rounded-[10px] px-2 py-2 text-left text-[13.5px] text-[#0B0D12]"
                        >
                          <span className="min-w-0 truncate">{cartao.titulo}</span>
                          <span
                            aria-hidden="true"
                            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${visivel ? "bg-[#0B0D12]" : "bg-[#DCE0E7]"}`}
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${visivel ? "translate-x-[18px]" : "translate-x-0.5"}`}
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {ocultos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => atualizarOcultos([])}
                    className="velo-inicio-item mt-1 h-9 w-full rounded-[10px] text-[13px] font-medium text-[#2F5BEA]"
                  >
                    Mostrar todos
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>

        <div
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-dashboard-tour="home-primeiros-passos"
        >
          {cartoes.map((cartao, indice) => (
            <motion.article
              key={cartao.id}
              {...revealProps(0.2 + indice * 0.05, 10)}
              className="velo-inicio-card flex min-h-[340px] flex-col p-2"
            >
              <Ilustracao id={cartao.id} totalProjetos={totalProjetos} />
              <div className="flex flex-1 flex-col px-3 pb-3 pt-4">
                <h3 className="m-0 text-[15px] font-medium text-[#0B0D12]">{cartao.titulo}</h3>
                <p className="m-0 mt-2 text-[13.5px] leading-[1.45] text-[#6B7280]">{cartao.descricao}</p>
                <div className="mt-auto pt-6">
                  <button
                    type="button"
                    onClick={go(cartao.to)}
                    className="velo-inicio-botao inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium text-[#0B0D12]"
                  >
                    {cartao.botao}
                  </button>
                </div>
              </div>
            </motion.article>
          ))}

          {/* Cartões escondidos: um atalho para trazê-los de volta. */}
          {ocultos.length > 0 && (
            <motion.button
              {...revealProps(0.25 + cartoes.length * 0.05, 10)}
              type="button"
              onClick={() => setPersonalizarAberto(true)}
              className="velo-inicio-novo flex min-h-[340px] flex-col items-center justify-center gap-2 rounded-[16px] border-[1.5px] border-dashed border-[#D5D9E0] text-[14px] text-[#4B5563]"
            >
              <Plus size={18} strokeWidth={1.8} aria-hidden="true" />
              Adicionar cartão
              <span className="text-[12px] text-[#9AA1AE]">
                {ocultos.length} {ocultos.length === 1 ? "escondido" : "escondidos"}
              </span>
            </motion.button>
          )}
        </div>
      </div>
    </main>
  );
};

// No celular a home volta ao estilo marketplace (busca, categorias e grade de
// produtos), mais simples e direto do que o painel do desktop.
const DashboardHomeRoute = () => {
  const isMobile = useIsMobile();

  if (isMobile) return <MobileHome />;

  return <DashboardHomePage />;
};

export default DashboardHomeRoute;
