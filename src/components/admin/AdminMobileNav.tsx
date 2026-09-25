import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  BadgeDollarSign,
  Bot,
  FileSearch,
  Home,
  LayoutGrid,
  LogOut,
  type LucideIcon,
  MessagesSquare,
  PackageSearch,
  RefreshCcw,
  ShoppingBag,
  Stethoscope,
  UsersRound,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/*
  Navegação do admin no celular. A barra lateral some abaixo de md, e sem isto não
  havia como sair do Painel pelo celular. As quatro abas são o que se resolve fora de
  casa; o resto fica no "Mais".
*/

type Item = { label: string; icon: LucideIcon; to: string };

const ABAS: Item[] = [
  { label: "Início", icon: Home, to: "/admin/painel" },
  { label: "Vendas", icon: ShoppingBag, to: "/admin/vendas" },
  { label: "Suporte", icon: MessagesSquare, to: "/admin/suporte" },
  { label: "Reembolsos", icon: RefreshCcw, to: "/admin/reembolsos" },
];

const MAIS: Item[] = [
  { label: "Usuários", icon: UsersRound, to: "/admin/usuarios" },
  { label: "Afiliados", icon: BadgeDollarSign, to: "/admin/comissoes" },
  { label: "Evidências", icon: FileSearch, to: "/admin/evidencias" },
  { label: "Consulta", icon: Stethoscope, to: "/admin/consulta" },
  { label: "Rastreio", icon: Activity, to: "/admin/rastreio" },
  { label: "Automação BOT", icon: Bot, to: "/admin/automacao-bot" },
  { label: "AliExpress", icon: PackageSearch, to: "/admin/aliexpress" },
];

/** Mesma chave da barra lateral: as duas leem do mesmo cache. */
export const useOpenSupportTickets = (enabled: boolean) =>
  useQuery({
    queryKey: ["admin-sidebar-open-support-tickets"],
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

const ativo = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`);

export const AdminMobileNav = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const reduce = useReducedMotion();
  const [maisAberto, setMaisAberto] = useState(false);
  const { data: ticketsAbertos = 0 } = useOpenSupportTickets(!!user?.id);
  const maisAtivo = MAIS.some((item) => ativo(pathname, item.to));

  useEffect(() => setMaisAberto(false), [pathname]);

  useEffect(() => {
    if (!maisAberto) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [maisAberto]);

  return (
    <div data-admin-native className="contents">
      <nav
        aria-label="Navegação do admin"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#F0F1F4] bg-white/98 backdrop-blur-sm transition-colors dark:border-[#282D37] dark:bg-[#15181F]/98 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid h-[76px] grid-cols-5 px-2">
          {ABAS.map(({ label, icon: Icon, to }) => {
            const selecionado = ativo(pathname, to);
            const badge = to === "/admin/suporte" ? ticketsAbertos : 0;
            return (
              <Link
                key={to}
                to={to}
                aria-current={selecionado ? "page" : undefined}
                className={`relative flex min-w-0 flex-col items-center justify-center gap-1.5 text-[12px] font-normal tracking-[-0.01em] ${
                  selecionado ? "text-[#315FD3]" : "text-[#41454C] dark:text-[#AAB1BC]"
                }`}
              >
                <span className="relative grid h-7 w-8 place-items-center">
                  <Icon
                    size={23}
                    strokeWidth={selecionado ? 1.9 : 1.7}
                    fill={selecionado && to === "/admin/painel" ? "currentColor" : "none"}
                  />
                  {badge > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#E5484D] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white dark:ring-[#15181F]">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMaisAberto(true)}
            aria-expanded={maisAberto}
            className={`flex min-w-0 flex-col items-center justify-center gap-1.5 text-[12px] font-normal tracking-[-0.01em] ${
              maisAtivo ? "text-[#315FD3]" : "text-[#41454C] dark:text-[#AAB1BC]"
            }`}
          >
            <span className="grid h-7 w-8 place-items-center">
              <LayoutGrid size={23} strokeWidth={maisAtivo ? 1.9 : 1.7} />
            </span>
            Mais
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {maisAberto ? (
          <motion.div
            key="mais"
            className="fixed inset-0 z-50 flex items-end bg-black/35 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMaisAberto(false)}
          >
            <motion.div
              role="dialog"
              aria-label="Mais seções"
              className="w-full rounded-t-[24px] bg-white px-4 pt-3 dark:bg-[#171A21]"
              style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
              initial={reduce ? { opacity: 0 } : { y: "100%" }}
              animate={reduce ? { opacity: 1 } : { y: 0 }}
              exit={reduce ? { opacity: 0 } : { y: "100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2">
                <p className="pl-1 text-[16px] font-semibold text-[#111827] dark:text-[#F8FAFC]">Mais</p>
                <button
                  type="button"
                  aria-label="Fechar"
                  onClick={() => setMaisAberto(false)}
                  className="grid h-9 w-9 place-items-center rounded-full text-[#6B7280] active:bg-black/5 dark:text-[#A1A8B5] dark:active:bg-white/5"
                >
                  <X size={19} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {MAIS.map(({ label, icon: Icon, to }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`flex h-[84px] flex-col items-center justify-center gap-2 rounded-[16px] border text-[12.5px] font-medium ${
                      ativo(pathname, to)
                        ? "border-[#C9D8FF] bg-[#EAF0FF] text-[#2563EB] dark:border-[#38518A] dark:bg-[#1F315B]"
                        : "border-[#EEF0F3] bg-[#F8F9FB] text-[#1F2937] dark:border-[#282D37] dark:bg-[#1C2028] dark:text-[#DDE3EC]"
                    }`}
                  >
                    <Icon size={20} strokeWidth={1.9} />
                    {label}
                  </Link>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[14px] border border-[#EEF0F3] text-[14px] font-medium text-[#1F2937] dark:border-[#303642] dark:text-[#DDE3EC]"
                >
                  <ArrowLeft size={17} /> Voltar à Velo
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    navigate("/login", { replace: true });
                  }}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[14px] border border-[#FAD4D4] text-[14px] font-medium text-[#D72C0D]"
                >
                  <LogOut size={17} /> Sair
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default AdminMobileNav;
