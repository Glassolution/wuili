import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import {
  BellIcon,
  BoltIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  FolderIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  StarIcon,
  UserCircleIcon,
} from "@heroicons/react/20/solid";
import NotificacoesPopover from "@/components/dashboard/NotificacoesPopover";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { isAdminEmail } from "@/lib/adminAccess";
import { nomeDeExibicao } from "@/lib/nomeDeExibicao";
import { useSandboxMode } from "@/lib/sandboxMode";
import { useContaNoPainel } from "@/lib/contaNoPainel";
import { formatarContagem, useFimDoTeste } from "@/lib/prazoDoTeste";

/*
  Barra do topo do painel (desktop), na borda cinza acima da moldura branca, no
  modelo da referência (24/11/2026): ícones cheios e cinza sem moldura
  (notificações, central de ajuda, configurações), a pílula "Upgrade" com
  estrela e a foto do perfil na ponta, que abre o menu da conta. O "x" redondo
  da referência ficou de fora: não há nada para fechar ali na Velo.
*/

const BARRA_CSS = `
.velo-topo-botao { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-topo-botao:hover { background: rgba(24,24,27,0.06) !important; color: #3F3F46 !important; }
.velo-topo-botao:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(37,99,235,0.45) !important; }
.velo-topo-sino { position: relative; color: #8E8E93; }
.velo-topo-sino:hover { color: #3F3F46; }
.velo-topo-sino > div > button:first-child {
  width: 38px; height: 38px; border-radius: 10px; background: transparent;
  transition: background-color 150ms ease-out;
}
.velo-topo-sino > div > button:first-child:hover { background: rgba(24,24,27,0.06); }
.velo-topo-sino > div > button:first-child > svg { opacity: 0; }
.velo-topo-sino > div > button:first-child > span { right: 8px; top: 7px; width: 8px; height: 8px; --tw-ring-color: #F7F7F8; }
.velo-topo-upgrade { transition: background-color 150ms ease-out, box-shadow 150ms ease-out; }
.velo-topo-upgrade:hover { background: #FAFAFA !important; box-shadow: 0 1px 3px rgba(17,17,20,0.10) !important; }
.velo-topo-upgrade:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(37,99,235,0.45) !important; }
.velo-topo-avatar { transition: box-shadow 150ms ease-out; }
.velo-topo-avatar:hover, .velo-topo-avatar[aria-expanded="true"] { box-shadow: 0 0 0 3px rgba(24,24,27,0.08) !important; }
.velo-topo-item { transition: background-color 120ms ease-out; }
.velo-topo-item:hover, .velo-topo-item:focus-visible { background: #262626 !important; outline: none; }
.velo-topo-link { transition: color 120ms ease-out; }
.velo-topo-link:hover, .velo-topo-link:focus-visible { color: #F4F4F5 !important; outline: none; }
.velo-topo-sair { transition: background-color 120ms ease-out, border-color 120ms ease-out, color 120ms ease-out; }
.velo-topo-sair:hover, .velo-topo-sair:focus-visible { background: #262626 !important; border-color: #3A3A3A !important; color: #FFFFFF !important; outline: none; }
`;

// Só o ícone, cheio e cinza: sem borda nem fundo (o fundo aparece no hover).
// 38px de área de clique, ícone de 22px e 8px entre um e outro (proporção da referência).
const ESTILO_BOTAO = {
  width: 38,
  height: 38,
  borderRadius: 10,
  border: 0,
  background: "transparent",
  color: "#8E8E93",
  boxShadow: "none",
} as const;

const BotaoDoTopo = ({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    aria-label={rotulo}
    title={rotulo}
    onClick={onClick}
    className="velo-topo-botao grid shrink-0 place-items-center"
    style={ESTILO_BOTAO}
  >
    {children}
  </button>
);

const NOME_DO_PLANO: Record<string, string> = {
  business: "Business",
  pro: "Pro",
  plus: "Pro",
  base: "Base",
  go: "Go",
  gratis: "Sem plano",
};

// Menu da conta no modelo escuro da referência (25/11/2026): dois cartões, ícones cheios.
const ESTILO_CARTAO_ESCURO = {
  background: "#1A1A1A",
  border: "1px solid #2A2A2A",
  boxShadow: "0 18px 44px rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.18)",
} as const;

type ItemDoMenu = { rotulo: string; Icone: typeof HomeIcon; rota: string };
const GRUPOS_DO_MENU = (ehAdmin: boolean): ItemDoMenu[][] => [
  [
    { rotulo: "Início", Icone: HomeIcon, rota: "/dashboard" },
    { rotulo: "Projetos", Icone: FolderIcon, rota: "/dashboard/projetos" },
    { rotulo: "Catálogo", Icone: ShoppingBagIcon, rota: "/dashboard/catalogo" },
    { rotulo: "Pedidos", Icone: ClipboardDocumentListIcon, rota: "/dashboard/pedidos" },
  ],
  [
    { rotulo: "Configurações", Icone: Cog6ToothIcon, rota: "/dashboard/configuracoes" },
    { rotulo: "Meu perfil e preferências", Icone: UserCircleIcon, rota: "/dashboard/configuracoes?tab=Perfil" },
    { rotulo: "Assinatura", Icone: CreditCardIcon, rota: "/dashboard/configuracoes?tab=Plano" },
    { rotulo: "Central de ajuda", Icone: ChatBubbleOvalLeftEllipsisIcon, rota: "/dashboard/ajuda" },
    ...(ehAdmin ? [{ rotulo: "Painel Admin", Icone: ShieldCheckIcon, rota: "/admin/painel" }] : []),
  ],
];

const BarraDoTopo = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = !!useReducedMotion();
  const upgradeModal = useUpgradeModal();
  const { user, signOut, role } = useAuth();
  const { nome, foto } = useProfile();
  const { plano, ehAdmin } = useContaNoPainel();
  const fimDoTeste = useFimDoTeste();
  const [sandboxLigado] = useSandboxMode(user?.id ?? user?.email ?? null);
  const [aberto, setAberto] = useState(false);
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const menuRef = useRef<HTMLDivElement>(null);

  const papelNoCadastro =
    (user?.app_metadata?.role as string | undefined) ?? (user?.user_metadata?.role as string | undefined) ?? null;
  const identidadeSandbox =
    sandboxLigado && (role === "admin" || papelNoCadastro === "admin" || isAdminEmail(user?.email));
  const nomeVisivel = identidadeSandbox
    ? "Conta Sandbox"
    : nomeDeExibicao(nome || (user?.user_metadata?.full_name as string | undefined), user?.email);
  const emailVisivel = identidadeSandbox ? "sandbox@velo.test" : user?.email || "";
  const inicial = (nomeVisivel || "V").trim().charAt(0).toUpperCase();
  const mostrarFoto = Boolean(foto) && !fotoFalhou && !identidadeSandbox;

  const restanteDoTeste = fimDoTeste ? new Date(fimDoTeste).getTime() - agora : 0;
  const emTeste = restanteDoTeste > 0;
  const planoNormalizado = plano === "plus" ? "pro" : plano;
  const nomeDoPlano = identidadeSandbox ? "Sandbox" : NOME_DO_PLANO[planoNormalizado] ?? planoNormalizado;
  const temTopo = planoNormalizado === "business" && !emTeste;

  // Fecha ao clicar fora, com Escape e ao trocar de página.
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setAberto(false);
    };
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  useEffect(() => {
    setAberto(false);
  }, [location.pathname, location.search]);

  // Contagem do teste só anda com o menu aberto.
  useEffect(() => {
    if (!aberto || !fimDoTeste) return;
    setAgora(Date.now());
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [aberto, fimDoTeste]);

  const fecharAgora = () => flushSync(() => setAberto(false));
  const irPara = (rota: string) => {
    fecharAgora();
    navigate(rota);
  };
  const sair = async () => {
    fecharAgora();
    await signOut();
    navigate("/login", { replace: true });
  };

  const avatar = (tamanho: number, raio: number) => (
    <span
      className="grid shrink-0 place-items-center overflow-hidden"
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: raio,
        background: identidadeSandbox ? "#2563EB" : "#EEF2FF",
        color: identidadeSandbox ? "#FFFFFF" : "#2563EB",
        fontSize: Math.round(tamanho * 0.4),
        fontWeight: 600,
      }}
    >
      {mostrarFoto ? (
        <img src={foto ?? ""} alt="" onError={() => setFotoFalhou(true)} className="h-full w-full object-cover" />
      ) : identidadeSandbox ? (
        <ShieldCheck size={Math.round(tamanho * 0.45)} strokeWidth={2} />
      ) : (
        inicial
      )}
    </span>
  );

  return (
    <div className="velo-fonte-inter flex h-12 shrink-0 items-center justify-end gap-2 pr-8">
      <style>{BARRA_CSS}</style>

      {/* Notificações: o popover é o de sempre; o sino dele fica invisível e o sino
          cheio da referência é desenhado por cima (o pontinho continua). */}
      <div className="velo-topo-sino shrink-0" title="Notificações">
        <NotificacoesPopover variante="redondo" />
        <BellIcon aria-hidden="true" className="pointer-events-none absolute left-[8px] top-[8px] h-[22px] w-[22px]" />
      </div>
      <BotaoDoTopo rotulo="Central de ajuda" onClick={() => navigate("/dashboard/ajuda")}>
        <QuestionMarkCircleIcon className="h-[22px] w-[22px]" />
      </BotaoDoTopo>
      <BotaoDoTopo rotulo="Configurações" onClick={() => navigate("/dashboard/configuracoes")}>
        <Cog6ToothIcon className="h-[22px] w-[22px]" />
      </BotaoDoTopo>

      {/* Pílula "Upgrade" da referência: some só para quem já está no Business pago. */}
      {!temTopo ? (
        <button
          type="button"
          onClick={() => upgradeModal.open({ origin: "barra-do-topo" })}
          className="velo-topo-upgrade ml-2 flex h-[36px] shrink-0 items-center gap-2 rounded-full pl-3.5 pr-4 text-[14px] font-semibold text-[#18181B]"
          style={{ background: "#FFFFFF", border: "1px solid #E4E4E7", boxShadow: "0 1px 2px rgba(17,17,20,0.06)" }}
        >
          <StarIcon aria-hidden="true" className="h-4 w-4" />
          Upgrade
        </button>
      ) : null}

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          aria-label="Abrir menu da conta"
          aria-haspopup="menu"
          aria-expanded={aberto}
          onClick={() => setAberto((atual) => !atual)}
          className="velo-topo-avatar ml-1 grid h-9 w-9 place-items-center rounded-full"
          style={{ padding: 0, border: 0, background: "transparent", boxShadow: "none" }}
        >
          {avatar(36, 18)}
        </button>

        <AnimatePresence>
          {aberto ? (
            <motion.div
              key="menu-da-conta"
              role="menu"
              aria-label="Opções da conta"
              className="absolute right-0 top-[46px] z-50 w-[320px]"
              style={{ transformOrigin: "top right" }}
              initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.99 }}
              transition={reduce ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Cartão da identidade, separado (como na referência): foto com o ponto
                  verde de "online", nome, e-mail e o selo do plano real. */}
              <div className="flex items-center gap-3 rounded-[18px] px-3 py-3" style={ESTILO_CARTAO_ESCURO}>
                <span className="relative shrink-0">
                  {avatar(44, 22)}
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 right-0 h-3 w-3 rounded-full"
                    style={{ background: "#22C55E", boxShadow: "0 0 0 2.5px #1A1A1A" }}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[16px] font-medium leading-5 text-[#FAFAFA]">{nomeVisivel}</p>
                  <p className="m-0 mt-1 truncate text-[13.5px] leading-5 text-[#A1A1AA]">{emailVisivel}</p>
                </div>
                <span
                  className="flex h-[26px] shrink-0 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold uppercase tracking-[0.02em]"
                  style={
                    planoNormalizado === "gratis" && !identidadeSandbox
                      ? { background: "#27272A", color: "#D4D4D8" }
                      : { background: "#86EFAC", color: "#14532D", boxShadow: "inset 0 0 0 1px rgba(20,83,45,0.12)" }
                  }
                >
                  <BoltIcon aria-hidden="true" className="h-3 w-3" />
                  {emTeste && !identidadeSandbox ? "Teste" : nomeDoPlano}
                </span>
              </div>

              {/* Cartão do menu: lista com ícones cheios, filete de ponta a ponta e rodapé. */}
              <div className="mt-2.5 overflow-hidden rounded-[20px]" style={{ ...ESTILO_CARTAO_ESCURO, background: "#222222" }}>
                <div className="rounded-[20px] p-2" style={{ background: "#1A1A1A", boxShadow: "0 1px 0 #2A2A2A" }}>
                  {GRUPOS_DO_MENU(ehAdmin).map((grupo, g) => (
                    <div key={g}>
                      {g > 0 ? <div className="-mx-2 my-2 h-px bg-[#2A2A2A]" /> : null}
                      {grupo.map(({ rotulo, Icone, rota }) => {
                        const atual = location.pathname === rota.split("?")[0] && (!rota.includes("?") || location.search === `?${rota.split("?")[1]}`);
                        const detalhe = rotulo === "Assinatura" && emTeste ? formatarContagem(restanteDoTeste) : null;
                        return (
                          <button
                            key={rotulo}
                            type="button"
                            role="menuitem"
                            onClick={() => irPara(rota)}
                            className="velo-topo-item flex h-10 w-full items-center gap-3 rounded-[10px] px-2.5 text-left text-[15px] font-medium text-[#F4F4F5]"
                            style={{ background: atual ? "#262626" : "transparent", boxShadow: "none" }}
                          >
                            <Icone aria-hidden="true" className="h-5 w-5 shrink-0 text-[#A1A1AA]" />
                            <span className="min-w-0 flex-1 truncate">{rotulo}</span>
                            {detalhe ? <span className="shrink-0 text-[12px] font-normal tabular-nums text-[#A1A1AA]">{detalhe}</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => irPara("/dashboard/sugestoes")}
                    className="velo-topo-link text-[14px] text-[#A1A1AA]"
                    style={{ background: "transparent", boxShadow: "none", padding: 0 }}
                  >
                    Sugestões
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void sair()}
                    className="velo-topo-sair h-9 rounded-[10px] px-4 text-[14px] font-medium text-[#E4E4E7]"
                    style={{ background: "#171717", border: "1px solid #2E2E2E", boxShadow: "none" }}
                  >
                    Sair
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BarraDoTopo;
