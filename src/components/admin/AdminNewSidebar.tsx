import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  BadgeDollarSign,
  BarChart3,
  Bell,
  Bot,
  ChevronDown,
  FileSearch,
  LifeBuoy,
  LogOut,
  type LucideIcon,
  MessagesSquare,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  ShoppingBag,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AdminSidebarItem, type AdminTone } from "@/components/admin/AdminPrimitives";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to: string;
  tone?: AdminTone;
  badge?: number;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

type AdminNewSidebarProps = {
  onOpenSearch?: () => void;
};

const SIDEBAR_COLLAPSED_STORAGE_KEY = "velo:admin-sidebar-collapsed";

const getStoredCollapsed = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
};

export const AdminNewSidebar = ({ onOpenSearch }: AdminNewSidebarProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(getStoredCollapsed);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const profileName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    (user?.email ? user.email.split("@")[0] : "Administrador");

  const { data: openTickets = 0 } = useQuery({
    queryKey: ["admin-sidebar-open-support-tickets"],
    enabled: !!user?.id,
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

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  // fecha o menu da conta ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  const navGroups: NavGroup[] = [
    {
      items: [
        { label: "Painel", icon: BarChart3, to: "/admin/painel" },
        { label: "Usuários & times", icon: UsersRound, to: "/admin/usuarios" },
        { label: "Vendas", icon: ShoppingBag, to: "/admin/vendas" },
      ],
    },
    {
      label: "Ferramentas",
      items: [
        { label: "Suporte", icon: MessagesSquare, to: "/admin/suporte", tone: "rose", badge: openTickets },
        { label: "Evidências", icon: FileSearch, to: "/admin/evidencias", tone: "teal" },
        { label: "Automação BOT", icon: Bot, to: "/admin/automacao-bot", tone: "amber" },
        { label: "AliExpress", icon: PackageSearch, to: "/admin/aliexpress", tone: "violet" },
      ],
    },
    {
      label: "Financeiro",
      items: [
        { label: "Afiliados", icon: BadgeDollarSign, to: "/admin/comissoes", tone: "emerald" },
        { label: "Reembolsos", icon: RefreshCcw, to: "/admin/reembolsos", tone: "blue" },
      ],
    },
  ];

  const isActive = (item: NavItem) => {
    const target = item.to.replace(/\/$/, "");
    return pathname === target || pathname.startsWith(`${target}/`);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 56 : "clamp(216px, 15.5vw, 240px)" }}
      transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={`admin-sidebar relative hidden h-full shrink-0 flex-col pb-2.5 pt-2.5 md:flex ${collapsed ? "px-2" : "px-2.5"}`}
    >
      {/* conta / workspace */}
      <div ref={accountRef} className={`relative flex h-[34px] items-center ${collapsed ? "justify-center" : "justify-between gap-1"}`}>
        {!collapsed ? (
          <button
            type="button"
            onClick={() => setAccountOpen((open) => !open)}
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            className="admin-workspace min-w-0 flex-1"
          >
            <span className="admin-workspace-mark">
              <img src="/logo.png" alt="" />
            </span>
            <span className="truncate">Velo Admin</span>
            <ChevronDown size={13} className="shrink-0 text-[#8c8f93]" />
          </button>
        ) : (
          <Link to="/admin/painel" aria-label="Velo Admin" className="admin-workspace px-0">
            <span className="admin-workspace-mark">
              <img src="/logo.png" alt="" />
            </span>
          </Link>
        )}
        {!collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Recolher menu lateral"
            className="admin-icon-button shrink-0"
          >
            <PanelLeftClose size={15} strokeWidth={1.7} />
          </button>
        ) : null}

        {accountOpen && !collapsed ? (
          <div role="menu" className="admin-account-menu">
            <div className="admin-account-menu-head">
              <p className="truncate text-[13px] font-medium text-[#1a1a1a]">{profileName}</p>
              <p className="truncate text-[12px] text-[#8c8f93]">{user?.email ?? "Administrador"}</p>
            </div>
            <button type="button" role="menuitem" className="admin-account-menu-item" onClick={() => setAccountOpen(false)}>
              <Bell aria-hidden="true" />
              Notificações
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#d72c0d]" />
            </button>
            <button
              type="button"
              role="menuitem"
              className="admin-account-menu-item"
              onClick={() => {
                setAccountOpen(false);
                navigate("/dashboard");
              }}
            >
              <ArrowLeft aria-hidden="true" />
              Voltar à Velo
            </button>
            <button type="button" role="menuitem" className="admin-account-menu-item" onClick={() => void handleSignOut()}>
              <LogOut aria-hidden="true" />
              Sair
            </button>
          </div>
        ) : null}
      </div>

      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expandir menu lateral"
          className="admin-icon-button mx-auto mt-2"
        >
          <PanelLeftOpen size={15} strokeWidth={1.7} />
        </button>
      ) : null}

      {/* ações rápidas */}
      <button
        type="button"
        onClick={onOpenSearch}
        title={collapsed ? "Ações rápidas" : undefined}
        className={collapsed ? "admin-icon-button mx-auto mt-2" : "admin-quick-action mt-2"}
      >
        <span aria-hidden="true" className="admin-quick-action-glyph">⌘</span>
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 truncate text-left">Ações rápidas</span>
            <kbd>K</kbd>
          </>
        ) : null}
      </button>

      <nav aria-label="Navegação principal do admin" className="mt-3.5 min-h-0 flex-1 space-y-3.5 overflow-y-auto overflow-x-hidden">
        {navGroups.map((group, groupIndex) => (
          <section key={group.label ?? `grupo-${groupIndex}`} aria-label={group.label ?? "Menu principal"}>
            {group.label && !collapsed ? (
              <p className="admin-sidebar-section-label mb-1">{group.label}</p>
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <AdminSidebarItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  tone={item.tone}
                  active={isActive(item)}
                  collapsed={collapsed}
                  count={item.badge}
                />
              ))}
            </div>
          </section>
        ))}

        <section aria-label="Fixados">
          {!collapsed ? <p className="admin-sidebar-section-label mb-1">Fixados</p> : null}
          <button
            type="button"
            onClick={onOpenSearch}
            title={collapsed ? "Assistente IA" : undefined}
            className={`admin-sidebar-item admin-sidebar-ai flex w-full items-center ${collapsed ? "justify-center px-0" : "px-2"}`}
          >
            <Sparkles aria-hidden="true" />
            {!collapsed ? <span className="min-w-0 flex-1 truncate text-left">Assistente IA</span> : null}
          </button>
        </section>

      </nav>

      {/* fila de suporte */}
      {!collapsed ? (
        <button
          type="button"
          onClick={() => navigate("/admin/suporte")}
          className="admin-sidebar-card mt-2.5 shrink-0"
        >
          <span className="admin-tool-tile" data-tone="rose" aria-hidden="true">
            <LifeBuoy />
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[#1a1a1a]">Fila de suporte</span>
          <span className="shrink-0 text-[12px] text-[#8c8f93]" aria-label={`${openTickets} em aberto`}>{openTickets}</span>
        </button>
      ) : null}

      {/* rodapé */}
      <div className={`admin-sidebar-footer shrink-0 ${collapsed ? "flex-col gap-1" : ""}`}>
        <span className="admin-footer-mark" aria-hidden="true">
          <ArrowLeft />
        </span>
        {!collapsed ? (
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="min-w-0 flex-1 truncate text-left text-[12.5px] text-[#303030] transition-colors hover:text-[#1a1a1a]"
          >
            Voltar à Velo
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          title="Sair"
          className={collapsed ? "admin-icon-button" : "admin-btn-primary shrink-0"}
        >
          <LogOut aria-hidden="true" />
          {!collapsed ? "Sair" : null}
        </button>
      </div>
    </motion.aside>
  );
};

export default AdminNewSidebar;
