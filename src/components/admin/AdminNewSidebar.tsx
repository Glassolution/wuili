import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowCircleLeft,
  Bank,
  CaretRight,
  ChartLine,
  FileMagnifyingGlass,
  House,
  type Icon as PhosphorIcon,
  Lifebuoy,
  Receipt,
  Robot,
  Sparkle,
  Stethoscope,
  Storefront,
  Tray,
  User,
} from "@phosphor-icons/react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useOpenSupportTickets } from "@/hooks/useOpenSupportTickets";
import { preloadAdminPage } from "@/pages/admin/adminPages";

type NavChild = { label: string; to: string };

type NavItem = {
  label: string;
  icon: PhosphorIcon;
  to: string;
  badge?: number;
  /** Subpáginas: aparecem recuadas logo abaixo quando o item está ativo. */
  children?: NavChild[];
};

type NavSection = {
  id: string;
  label?: string;
  items: NavItem[];
};

const matchesPath = (pathname: string, to: string) => {
  const target = to.replace(/\/$/, "");
  return pathname === target || pathname.startsWith(`${target}/`);
};

/**
 * Sidebar do admin no desenho do admin da Shopify: fundo cinza, ícones
 * sólidos, item ativo numa pílula branca e subpáginas recuadas abaixo dele.
 * Marca, busca e conta ficam na barra superior (AdminTopBar).
 */
export const AdminNewSidebar = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: openTickets = 0 } = useOpenSupportTickets();

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("admin-sidebar-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["admin-sidebar-open-support-tickets"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-support-tickets-crm"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  const sections: NavSection[] = [
    {
      id: "principal",
      items: [
        { label: "Início", icon: House, to: "/admin/painel" },
        { label: "Vendas", icon: Receipt, to: "/admin/vendas" },
        { label: "Usuários", icon: User, to: "/admin/usuarios" },
        {
          label: "Financeiro",
          icon: Bank,
          to: "/admin/comissoes",
          children: [
            { label: "Afiliados", to: "/admin/comissoes" },
            { label: "Reembolsos", to: "/admin/reembolsos" },
          ],
        },
        { label: "Suporte", icon: Tray, to: "/admin/suporte", badge: openTickets },
        { label: "Assistente IA", icon: Sparkle, to: "/admin/assistente-ia" },
        { label: "Rastreio", icon: ChartLine, to: "/admin/rastreio" },
      ],
    },
    {
      id: "operacao",
      label: "Operação",
      items: [
        { label: "Evidências", icon: FileMagnifyingGlass, to: "/admin/evidencias" },
        { label: "Consulta", icon: Stethoscope, to: "/admin/consulta" },
        { label: "Automação BOT", icon: Robot, to: "/admin/automacao-bot" },
        { label: "AliExpress", icon: Storefront, to: "/admin/aliexpress" },
      ],
    },
    {
      id: "conteudo",
      label: "Conteúdo",
      items: [{ label: "Central de ajuda", icon: Lifebuoy, to: "/admin/central-de-ajuda" }],
    },
  ];

  const isItemActive = (item: NavItem) =>
    item.children ? item.children.some((child) => matchesPath(pathname, child.to)) : matchesPath(pathname, item.to);

  const renderItem = (item: NavItem) => {
    const active = isItemActive(item);
    const Icon = item.icon;
    return (
      <li key={item.to + item.label}>
        <Link
          to={item.to}
          aria-current={active && !item.children ? "page" : undefined}
          data-active={active || undefined}
          className="admin-nav-item"
          onMouseEnter={() => preloadAdminPage(item.to, queryClient)}
          onFocus={() => preloadAdminPage(item.to, queryClient)}
        >
          {/* a pílula do item ativo desliza de um item para o outro */}
          {active ? (
            <motion.span
              layoutId="admin-nav-pill"
              aria-hidden="true"
              className="admin-nav-pill"
              transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.9 }}
            />
          ) : null}
          <Icon aria-hidden="true" weight="fill" />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badge && item.badge > 0 ? (
            <span className="admin-nav-badge" aria-label={`${item.badge} em aberto`}>
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          ) : null}
        </Link>
        <AnimatePresence initial={false}>
          {active && item.children ? (
            <motion.ul
              key="subitens"
              className="overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {item.children.map((child) => (
                <li key={child.to}>
                  <Link
                    to={child.to}
                    aria-current={matchesPath(pathname, child.to) ? "page" : undefined}
                    className="admin-nav-subitem"
                    onMouseEnter={() => preloadAdminPage(child.to, queryClient)}
                    onFocus={() => preloadAdminPage(child.to, queryClient)}
                  >
                    {child.label}
                  </Link>
                </li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </li>
    );
  };

  return (
    <aside className="admin-nav relative hidden h-full w-[252px] shrink-0 flex-col md:flex" data-admin-native>
      <nav aria-label="Navegação principal do admin" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-4 pl-[18px] pr-[23px] pt-5">
        {sections.map((section) => (
          <section key={section.id} aria-label={section.label ?? "Menu principal"} className={section.label ? "mt-6" : ""}>
            {section.label ? (
              <p className="admin-nav-section">
                <span>{section.label}</span>
                <CaretRight aria-hidden="true" weight="bold" />
              </p>
            ) : null}
            <ul>{section.items.map(renderItem)}</ul>
          </section>
        ))}

        <ul className="mt-6">
          <li>
            <Link to="/dashboard" className="admin-nav-item">
              <ArrowCircleLeft aria-hidden="true" weight="fill" />
              <span className="min-w-0 flex-1 truncate">Voltar à Velo</span>
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  );
};

export default AdminNewSidebar;
