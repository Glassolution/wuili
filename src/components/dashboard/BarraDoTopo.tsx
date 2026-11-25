import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { BellIcon, Cog6ToothIcon, QuestionMarkCircleIcon, StarIcon } from "@heroicons/react/20/solid";
import NotificacoesPopover from "@/components/dashboard/NotificacoesPopover";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";
import { useAuth } from "@/contexts/AuthContext";
import { useAtlasChat } from "@/contexts/AtlasChatContext";
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
.velo-topo-item:hover, .velo-topo-item:focus-visible { background: #F4F4F5 !important; color: #18181B !important; outline: none; }
.velo-topo-sair:hover, .velo-topo-sair:focus-visible { background: #FEF2F2 !important; color: #B91C1C !important; }
.velo-topo-cta { transition: background-color 150ms ease-out, transform 120ms ease-out; }
.velo-topo-cta:hover { background: #27272A !important; }
.velo-topo-cta:active { transform: scale(0.99); }
.velo-topo-cta:focus-visible { outline: none; box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px rgba(24,24,27,0.35) !important; }
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

const BarraDoTopo = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = !!useReducedMotion();
  const upgradeModal = useUpgradeModal();
  const { user, signOut, role } = useAuth();
  const { nome, foto } = useProfile();
  const { quota } = useAtlasChat();
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

  const itens = [
    { rotulo: "Configurações", acao: () => irPara("/dashboard/configuracoes") },
    { rotulo: "Assinatura", acao: () => irPara("/dashboard/configuracoes?tab=Plano") },
    ...(ehAdmin ? [{ rotulo: "Painel Admin", acao: () => irPara("/admin/painel") }] : []),
  ];

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
              className="absolute right-0 top-[46px] z-50 w-[320px] p-2"
              style={{
                borderRadius: 20,
                border: "1px solid #E4E4E7",
                background: "#FFFFFF",
                color: "#18181B",
                boxShadow: "0 16px 40px rgba(17,17,20,0.12), 0 2px 6px rgba(17,17,20,0.06)",
                transformOrigin: "top right",
              }}
              initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.99 }}
              transition={reduce ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Identidade */}
              <div className="flex items-center gap-3.5 px-3 pb-4 pt-3">
                {avatar(46, 23)}
                <div className="min-w-0">
                  <p className="m-0 truncate text-[17px] font-semibold leading-6 tracking-[-0.015em]">{nomeVisivel}</p>
                  <p className="m-0 mt-0.5 truncate text-[14px] leading-5 text-[#71717A]">{emailVisivel}</p>
                </div>
              </div>

              {/* Cartão da assinatura: só dados reais (plano, prazo do teste e mensagens
                  do Atlas, quando o servidor já informou a cota nesta visita). */}
              <div className="rounded-[16px] border border-[#E4E4E7] bg-white px-4 pb-2 pt-4">
                <p className="m-0 text-[15px] font-medium text-[#52525B]">Sua assinatura</p>
                <dl className="m-0 mt-3 space-y-2 text-[15px]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#71717A]">Plano</dt>
                    <dd className="m-0 font-medium text-[#18181B]">{nomeDoPlano}</dd>
                  </div>
                  {emTeste ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#71717A]">Teste termina em</dt>
                      <dd className="m-0 font-medium tabular-nums text-[#18181B]">{formatarContagem(restanteDoTeste)}</dd>
                    </div>
                  ) : null}
                  {quota && quota.limite !== null && quota.restantes !== null ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#71717A]">Mensagens do Atlas</dt>
                      <dd className="m-0 font-medium tabular-nums text-[#18181B]">
                        {quota.restantes} de {quota.limite}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <button
                  type="button"
                  className="velo-topo-cta -mx-2 mt-4 h-11 w-[calc(100%+16px)] rounded-full text-[15px] font-semibold"
                  style={{ background: "#18181B", color: "#FFFFFF", boxShadow: "0 1px 2px rgba(17,17,20,0.12)" }}
                  onClick={() => {
                    if (temTopo) {
                      irPara("/dashboard/configuracoes?tab=Plano");
                      return;
                    }
                    fecharAgora();
                    upgradeModal.open({ origin: "barra-do-topo" });
                  }}
                >
                  {temTopo ? "Gerenciar assinatura" : "Fazer upgrade"}
                </button>
              </div>

              {/* Filete de ponta a ponta, como na referência. */}
              <div className="-mx-2 my-2 h-px bg-[#EFEFF1]" />

              {itens.map(({ rotulo, acao }) => (
                <button
                  key={rotulo}
                  type="button"
                  role="menuitem"
                  onClick={acao}
                  className="velo-topo-item flex h-11 w-full items-center rounded-[12px] px-3 text-left text-[15px] text-[#52525B]"
                  style={{ background: "transparent", boxShadow: "none" }}
                >
                  {rotulo}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                onClick={() => void sair()}
                className="velo-topo-item velo-topo-sair flex h-11 w-full items-center rounded-[12px] px-3 text-left text-[15px] text-[#DC2626]"
                style={{ background: "transparent", boxShadow: "none" }}
              >
                Sair
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BarraDoTopo;
