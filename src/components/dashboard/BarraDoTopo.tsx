import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import {
  BellAlertIcon,
  BellIcon,
  BoltIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  LinkIcon,
  LockClosedIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
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
.velo-topo-item { transition: background-color 120ms ease-out, color 120ms ease-out; }
.velo-topo-item .velo-topo-item-icone { transition: color 120ms ease-out; }
.velo-topo-item:hover, .velo-topo-item:focus-visible { background: #F4F4F5 !important; color: #18181B !important; outline: none; }
.velo-topo-item:hover .velo-topo-item-icone, .velo-topo-item:focus-visible .velo-topo-item-icone { color: #52525B !important; }
.velo-topo-link { transition: color 120ms ease-out; }
.velo-topo-link:hover, .velo-topo-link:focus-visible { color: #18181B !important; outline: none; }
.velo-topo-sair { transition: background-color 120ms ease-out, border-color 120ms ease-out, color 120ms ease-out; }
.velo-topo-sair:hover, .velo-topo-sair:focus-visible { background: #FEF2F2 !important; border-color: #FECACA !important; color: #B91C1C !important; outline: none; }
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

// Menu da conta (25/11/2026): modelo da referência de dois cartões, em branco para
// combinar com a Velo, compacto, só com opções da conta (a navegação fica na sidebar
// e ajuda/configurações já têm botão na barra).
const ESTILO_CARTAO = {
  background: "#FFFFFF",
  border: "1px solid #E4E4E7",
  boxShadow: "0 12px 32px -8px rgba(17,17,20,0.14), 0 2px 6px rgba(17,17,20,0.05)",
} as const;

type ItemDoMenu = { rotulo: string; Icone: typeof UserCircleIcon; rota: string };
const GRUPOS_DO_MENU = (ehAdmin: boolean): ItemDoMenu[][] => [
  [
    { rotulo: "Meu perfil", Icone: UserCircleIcon, rota: "/dashboard/configuracoes?tab=Perfil" },
    { rotulo: "Assinatura", Icone: CreditCardIcon, rota: "/dashboard/configuracoes?tab=Plano" },
    { rotulo: "Integrações", Icone: LinkIcon, rota: "/dashboard/configuracoes?tab=Integrações" },
    { rotulo: "Notificações", Icone: BellAlertIcon, rota: "/dashboard/configuracoes?tab=Notificações" },
    { rotulo: "Segurança", Icone: LockClosedIcon, rota: "/dashboard/configuracoes?tab=Segurança" },
  ],
  ...(ehAdmin ? [[{ rotulo: "Painel Admin", Icone: ShieldCheckIcon, rota: "/admin/painel" }]] : []),
];

// Abertura: o menu cresce do canto do avatar e os itens entram em cascata curta.
const EASE_MENU = [0.22, 1, 0.36, 1] as const;
const VARIANTES_MENU = {
  fechado: { opacity: 0, scale: 0.96, y: -4 },
  aberto: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: EASE_MENU, staggerChildren: 0.05 } },
  saindo: { opacity: 0, scale: 0.98, y: -2, transition: { duration: 0.12, ease: "easeIn" } },
} as const;
const VARIANTES_CARTAO = {
  fechado: { opacity: 0, y: -4 },
  aberto: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_MENU, staggerChildren: 0.018, delayChildren: 0.04 } },
} as const;
const VARIANTES_ITEM = {
  fechado: { opacity: 0, x: -3 },
  aberto: { opacity: 1, x: 0, transition: { duration: 0.18, ease: EASE_MENU } },
} as const;

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
              className="absolute right-0 top-[44px] z-50 w-[288px]"
              style={{ transformOrigin: "top right" }}
              variants={reduce ? undefined : VARIANTES_MENU}
              initial={reduce ? false : "fechado"}
              animate={reduce ? { opacity: 1 } : "aberto"}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : "saindo"}
            >
              {/* Cartão da identidade: foto com o ponto de "online", nome, e-mail e o selo do plano real. */}
              <motion.div variants={reduce ? undefined : VARIANTES_CARTAO} className="flex items-center gap-2.5 rounded-[14px] px-2.5 py-2.5" style={ESTILO_CARTAO}>
                <span className="relative shrink-0">
                  {avatar(36, 18)}
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full"
                    style={{ background: "#22C55E", boxShadow: "0 0 0 2px #FFFFFF" }}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[14px] font-semibold leading-[18px] tracking-[-0.01em] text-[#18181B]">{nomeVisivel}</p>
                  <p className="m-0 mt-0.5 truncate text-[12.5px] leading-4 text-[#71717A]">{emailVisivel}</p>
                </div>
                <span
                  className="flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold uppercase tracking-[0.03em]"
                  style={
                    planoNormalizado === "gratis" && !identidadeSandbox
                      ? { background: "#F4F4F5", color: "#52525B" }
                      : { background: "#EFF6FF", color: "#1D4ED8", boxShadow: "inset 0 0 0 1px rgba(37,99,235,0.18)" }
                  }
                >
                  <BoltIcon aria-hidden="true" className="h-3 w-3" />
                  {emTeste && !identidadeSandbox ? "Teste" : nomeDoPlano}
                </span>
              </motion.div>

              {/* Cartão do menu: opções da conta com ícones cheios e rodapé com Sugestões e Sair. */}
              <motion.div variants={reduce ? undefined : VARIANTES_CARTAO} className="mt-2 overflow-hidden rounded-[14px]" style={ESTILO_CARTAO}>
                <div className="p-1.5">
                  {GRUPOS_DO_MENU(ehAdmin).map((grupo, g) => (
                    <div key={g}>
                      {g > 0 ? <div className="-mx-1.5 my-1.5 h-px bg-[#F0F0F2]" /> : null}
                      {grupo.map(({ rotulo, Icone, rota }) => {
                        const [caminho, busca] = rota.split("?");
                        const atual = location.pathname === caminho && (!busca || decodeURIComponent(location.search) === `?${busca}`);
                        const detalhe = rotulo === "Assinatura" && emTeste ? formatarContagem(restanteDoTeste) : null;
                        return (
                          <motion.button
                            key={rotulo}
                            variants={reduce ? undefined : VARIANTES_ITEM}
                            type="button"
                            role="menuitem"
                            onClick={() => irPara(rota)}
                            className="velo-topo-item flex h-9 w-full items-center gap-2.5 rounded-[9px] px-2 text-left text-[14px] text-[#27272A]"
                            style={{ background: atual ? "#F4F4F5" : "transparent", boxShadow: "none" }}
                          >
                            <Icone aria-hidden="true" className="velo-topo-item-icone h-[18px] w-[18px] shrink-0 text-[#A1A1AA]" />
                            <span className="min-w-0 flex-1 truncate">{rotulo}</span>
                            {detalhe ? <span className="shrink-0 text-[11.5px] tabular-nums text-[#71717A]">{detalhe}</span> : null}
                          </motion.button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-[#F0F0F2] bg-[#FAFAFA] py-2 pl-3.5 pr-2">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => irPara("/dashboard/sugestoes")}
                    className="velo-topo-link text-[13px] text-[#71717A]"
                    style={{ background: "transparent", boxShadow: "none", padding: 0 }}
                  >
                    Sugestões
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void sair()}
                    className="velo-topo-sair h-8 rounded-[8px] px-3 text-[13px] font-medium text-[#27272A]"
                    style={{ background: "#FFFFFF", border: "1px solid #E4E4E7", boxShadow: "0 1px 2px rgba(17,17,20,0.05)" }}
                  >
                    Sair
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BarraDoTopo;
