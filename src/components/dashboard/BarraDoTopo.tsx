import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { CircleDotDashed, CreditCard, Inbox, Link, LogOut, Plus, Search, Settings2, ShieldCheck } from "lucide-react";
import NotificacoesPopover from "@/components/dashboard/NotificacoesPopover";
import InviteFriendModal from "@/components/dashboard/InviteFriendModal";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";
import { useAuth } from "@/contexts/AuthContext";
import { useAtlasChat } from "@/contexts/AtlasChatContext";
import { useProfile } from "@/lib/profileContext";
import { isAdminEmail } from "@/lib/adminAccess";
import { nomeDeExibicao } from "@/lib/nomeDeExibicao";
import { useSandboxMode } from "@/lib/sandboxMode";
import { ABRIR_BUSCA_EVENT } from "@/lib/abrirBusca";
import { useContaNoPainel } from "@/lib/contaNoPainel";
import { formatarContagem, useFimDoTeste } from "@/lib/prazoDoTeste";

/*
  Barra do topo do painel (desktop), na borda cinza acima da moldura branca, com
  os mesmos ícones da referência, sem moldura em volta (só um fundo leve no
  hover), e o perfil na ponta com o menu da conta. Cada ícone é uma função real:
  busca, novo projeto, Comunidade e Ajuda, notificações (caixa de entrada),
  Indique e ganhe (link) e a conta. O quadrado colorido da referência (Atlas)
  saiu a pedido do dono.
*/

const BARRA_CSS = `
.velo-topo-botao { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-topo-botao:hover { background: rgba(24,24,27,0.06) !important; color: #18181B !important; }
.velo-topo-botao:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(37,99,235,0.45) !important; }
.velo-topo-sino { position: relative; }
.velo-topo-sino > div > button:first-child {
  width: 36px; height: 36px; border-radius: 10px; background: transparent; color: #3F3F46;
  transition: background-color 150ms ease-out;
}
.velo-topo-sino > div > button:first-child:hover { background: rgba(24,24,27,0.06); }
.velo-topo-sino > div > button:first-child > svg { opacity: 0; }
.velo-topo-sino > div > button:first-child > span { right: 7px; top: 7px; width: 8px; height: 8px; --tw-ring-color: #F7F7F8; }
.velo-topo-avatar { transition: box-shadow 150ms ease-out; }
.velo-topo-avatar:hover, .velo-topo-avatar[aria-expanded="true"] { box-shadow: 0 0 0 3px rgba(24,24,27,0.08) !important; }
.velo-topo-item { transition: background-color 120ms ease-out; }
.velo-topo-item:hover, .velo-topo-item:focus-visible { background: #F4F4F5; outline: none; }
.velo-topo-cta { transition: filter 150ms ease-out; }
.velo-topo-cta:hover { filter: brightness(0.94); }
`;

// Só o ícone: sem borda nem fundo (o fundo aparece no hover). 36px de área de
// clique, ícone de 20px e 12px entre um e outro, na proporção da referência.
const ESTILO_BOTAO = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: 0,
  background: "transparent",
  color: "#3F3F46",
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
  const [convidarAberto, setConvidarAberto] = useState(false);
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
    { rotulo: "Configurações", icone: Settings2, acao: () => irPara("/dashboard/configuracoes") },
    { rotulo: "Assinatura", icone: CreditCard, acao: () => irPara("/dashboard/configuracoes?tab=Plano") },
    ...(ehAdmin ? [{ rotulo: "Painel Admin", icone: ShieldCheck, acao: () => irPara("/admin/painel") }] : []),
  ];

  return (
    <div className="velo-fonte-inter flex h-12 shrink-0 items-center justify-end gap-3 pr-3">
      <style>{BARRA_CSS}</style>

      <BotaoDoTopo rotulo="Buscar (atalho /)" onClick={() => window.dispatchEvent(new Event(ABRIR_BUSCA_EVENT))}>
        <Search size={20} strokeWidth={1.6} />
      </BotaoDoTopo>
      <BotaoDoTopo
        rotulo="Novo projeto"
        onClick={() => navigate("/dashboard/minha-loja", { state: { abrirCriacao: true } })}
      >
        <Plus size={20} strokeWidth={1.6} />
      </BotaoDoTopo>
      <BotaoDoTopo rotulo="Comunidade e Ajuda" onClick={() => navigate("/dashboard/comunidade")}>
        <CircleDotDashed size={20} strokeWidth={1.6} />
      </BotaoDoTopo>
      {/* Notificações: o popover é o de sempre; o sino dele fica invisível e a
          caixa de entrada da referência é desenhada por cima (o pontinho continua). */}
      <div className="velo-topo-sino shrink-0" title="Notificações">
        <NotificacoesPopover variante="redondo" />
        <Inbox
          aria-hidden="true"
          size={20}
          strokeWidth={1.6}
          className="pointer-events-none absolute left-[8px] top-[8px] text-[#3F3F46]"
        />
      </div>
      <BotaoDoTopo rotulo="Indique e ganhe" onClick={() => setConvidarAberto(true)}>
        <Link size={19} strokeWidth={1.6} />
      </BotaoDoTopo>

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          aria-label="Abrir menu da conta"
          aria-haspopup="menu"
          aria-expanded={aberto}
          onClick={() => setAberto((atual) => !atual)}
          className="velo-topo-avatar grid h-9 w-9 place-items-center rounded-full"
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
              className="absolute right-0 top-[44px] z-50 w-[300px] p-2"
              style={{
                borderRadius: 16,
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
              <div className="flex items-center gap-3 px-2.5 pb-3 pt-2.5">
                {avatar(44, 22)}
                <div className="min-w-0">
                  <p className="m-0 truncate text-[15px] font-semibold leading-5 tracking-[-0.01em]">{nomeVisivel}</p>
                  <p className="m-0 truncate text-[13px] leading-5 text-[#71717A]">{emailVisivel}</p>
                </div>
              </div>

              {/* Cartão da assinatura: só dados reais (plano, prazo do teste e mensagens
                  do Atlas, quando o servidor já informou a cota nesta visita). */}
              <div className="rounded-[12px] border border-[#EDEDF0] bg-[#FAFAFA] p-3.5">
                <p className="m-0 text-[13px] font-medium text-[#52525B]">Sua assinatura</p>
                <dl className="m-0 mt-2.5 space-y-1.5 text-[14px]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#71717A]">Plano</dt>
                    <dd className="m-0 font-semibold">{nomeDoPlano}</dd>
                  </div>
                  {emTeste ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#71717A]">Teste termina em</dt>
                      <dd className="m-0 font-semibold tabular-nums">{formatarContagem(restanteDoTeste)}</dd>
                    </div>
                  ) : null}
                  {quota && quota.limite !== null && quota.restantes !== null ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#71717A]">Mensagens do Atlas</dt>
                      <dd className="m-0 font-semibold tabular-nums">
                        {quota.restantes} de {quota.limite}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <button
                  type="button"
                  className="velo-topo-cta mt-3.5 h-10 w-full rounded-[10px] text-[14px] font-semibold"
                  style={{ background: "#2563EB", color: "#FFFFFF", boxShadow: "none" }}
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

              <div className="my-2 h-px bg-[#F0F0F2]" />

              {itens.map(({ rotulo, icone: Icone, acao }) => (
                <button
                  key={rotulo}
                  type="button"
                  role="menuitem"
                  onClick={acao}
                  className="velo-topo-item flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[14px] text-[#27272A]"
                  style={{ background: "transparent", boxShadow: "none" }}
                >
                  <Icone size={16} strokeWidth={1.8} className="text-[#71717A]" />
                  {rotulo}
                </button>
              ))}

              <div className="my-2 h-px bg-[#F0F0F2]" />

              <button
                type="button"
                role="menuitem"
                onClick={() => void sair()}
                className="velo-topo-item flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[14px] text-[#DC2626]"
                style={{ background: "transparent", boxShadow: "none" }}
              >
                <LogOut size={16} strokeWidth={1.8} />
                Sair
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* No body: dentro da barra (que anima com transform) o modal fixo ficaria preso. */}
      {createPortal(<InviteFriendModal open={convidarAberto} onClose={() => setConvidarAberto(false)} />, document.body)}
    </div>
  );
};

export default BarraDoTopo;
