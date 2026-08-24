import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  BadgeDollarSign,
  ChevronDown,
  FileSearch,
  LayoutDashboard,
  type LucideIcon,
  MessagesSquare,
  Minus,
  PackageSearch,
  Plus,
  RefreshCcw,
  Search,
  ShoppingBag,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import SearchPalette from "@/components/dashboard/SearchPalette";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to: string;
  badge?: number;
};

type NavGroup = {
  id: "overview" | "operation" | "finance" | "control";
  label: string;
  indicator: "chevron" | "plus";
  items: NavItem[];
};

const SIDEBAR_GROUPS_STORAGE_KEY = "velo:admin-sidebar-open-groups";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "velo:admin-sidebar-collapsed";
const DEFAULT_OPEN_GROUPS: NavGroup["id"][] = ["overview", "operation"];

const SidebarToggleGlyph = ({ collapsed }: { collapsed: boolean }) => (
  <svg
    viewBox="0 0 18 18"
    aria-hidden="true"
    className="h-[18px] w-[18px]"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.35"
  >
    <rect x="3" y="4" width="12" height="10" rx="2" />
    <path d={collapsed ? "M11 4.5v9" : "M7 4.5v9"} />
  </svg>
);

const getStoredCollapsed = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage?.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const getStoredOpenGroups = () => {
  if (typeof window === "undefined") return new Set(DEFAULT_OPEN_GROUPS);
  try {
    const stored = JSON.parse(window.localStorage?.getItem(SIDEBAR_GROUPS_STORAGE_KEY) ?? "null");
    if (!Array.isArray(stored)) return new Set(DEFAULT_OPEN_GROUPS);
    return new Set(stored.filter((value): value is NavGroup["id"] =>
      ["overview", "operation", "finance", "control"].includes(String(value)),
    ));
  } catch {
    return new Set(DEFAULT_OPEN_GROUPS);
  }
};

const getInitials = (name: string, email?: string | null) => {
  const raw = (name || email || "Velo").trim();
  return raw
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const SidebarNavLink = ({ item, active, collapsed = false }: { item: NavItem; active: boolean; collapsed?: boolean }) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={`group relative flex h-11 items-center rounded-[10px] text-[13px] font-medium tracking-[-0.015em] no-underline transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${
        active
          ? "bg-white text-[#171715] shadow-[0_1px_2px_rgba(25,25,20,0.07),0_7px_20px_rgba(25,25,20,0.025)]"
          : "text-[#686862] hover:bg-white/75 hover:text-[#171715]"
      }`}
    >
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-[8px] transition-colors ${
          active
            ? "bg-[#f0f1ef] text-[#262623]"
            : "text-[#8a8a84] group-hover:bg-[#f1f1ee] group-hover:text-[#353532]"
        }`}
      >
        <Icon size={16.5} strokeWidth={active ? 1.9 : 1.65} />
      </span>
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
      {item.badge && item.badge > 0 ? (
        <span className={`inline-flex items-center justify-center rounded-full bg-[#20201e] font-semibold text-white ${collapsed ? "absolute right-0.5 top-0.5 h-4 min-w-4 px-1 text-[8px]" : "h-5 min-w-5 px-1.5 text-[10px]"}`}>
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
};

export const OldAdminNewSidebar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<NavGroup["id"]>>(getStoredOpenGroups);
  const [collapsed, setCollapsed] = useState(getStoredCollapsed);
  const reduceMotion = useReducedMotion();

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

  const navGroups: NavGroup[] = [
    {
      id: "overview",
      label: "Visão geral",
      indicator: "chevron",
      items: [{ label: "Painel", icon: LayoutDashboard, to: "/admin/painel" }],
    },
    {
      id: "operation",
      label: "Operação",
      indicator: "chevron",
      items: [
        { label: "Suporte", icon: MessagesSquare, to: "/admin/suporte", badge: openTickets },
        { label: "Usuários & times", icon: UsersRound, to: "/admin/usuarios" },
        { label: "Vendas", icon: ShoppingBag, to: "/admin/vendas" },
      ],
    },
    {
      id: "finance",
      label: "Financeiro",
      indicator: "plus",
      items: [
        { label: "Afiliados", icon: BadgeDollarSign, to: "/admin/comissoes" },
        { label: "Reembolsos", icon: RefreshCcw, to: "/admin/reembolsos" },
      ],
    },
    {
      id: "control",
      label: "Controle",
      indicator: "plus",
      items: [
        { label: "Evidências", icon: FileSearch, to: "/admin/evidencias" },
        { label: "AliExpress", icon: PackageSearch, to: "/admin/aliexpress" },
      ],
    },
  ];

  const photo =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    null;
  const profileName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    (user?.email ? user.email.split("@")[0] : "Administrador");
  const profileEmail = user?.email || "admin@velo.app";
  const initials = getInitials(profileName, user?.email);

  const isActive = (item: NavItem) => {
    const target = item.to.replace(/\/$/, "");
    return pathname === target || pathname.startsWith(`${target}/`);
  };
  const activeGroupId = navGroups.find((group) => group.items.some(isActive))?.id;

  useEffect(() => {
    if (!activeGroupId) return;
    setOpenGroups((current) => {
      if (current.has(activeGroupId)) return current;
      const next = new Set(current);
      next.add(activeGroupId);
      return next;
    });
  }, [activeGroupId]);

  useEffect(() => {
    try {
      window.localStorage?.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify([...openGroups]));
    } catch {
      // Mantém a navegação funcional mesmo quando o navegador bloqueia storage.
    }
  }, [openGroups]);

  useEffect(() => {
    try {
      window.localStorage?.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
    } catch {
      // Mantém a navegação funcional mesmo quando o navegador bloqueia storage.
    }
  }, [collapsed]);

  const toggleGroup = (groupId: NavGroup["id"]) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 260 }}
      transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={`relative hidden h-full shrink-0 flex-col border-r border-[#e8e8e4] bg-[#f5f5f3] py-5 text-[#1c1c1a] md:flex ${collapsed ? "px-3" : "px-4"}`}
    >
      <div className={`flex min-h-12 ${collapsed ? "flex-col items-center gap-2" : "items-start justify-between px-1"}`}>
        <div className={collapsed ? "text-center" : "min-w-0"}>
          <Link
            to="/admin/painel"
            className={`flex items-center gap-2.5 rounded-[9px] text-[#11110f] no-underline ${collapsed ? "justify-center" : ""}`}
            aria-label="Velo Admin"
          >
            <img src="/logo.png" alt="" className="h-7 w-7 shrink-0 object-contain" />
            {!collapsed ? (
              <span className="truncate text-[15px] font-semibold tracking-[-0.025em]">Velo Admin</span>
            ) : null}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          className="grid h-9 w-9 shrink-0 place-items-center text-[#73736d] transition hover:text-[#20201e] active:scale-95"
        >
          <SidebarToggleGlyph collapsed={collapsed} />
        </button>
      </div>

      {!collapsed ? (
        <>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="mt-5 flex h-10 items-center gap-2.5 rounded-[9px] border border-[#e1e1dc] bg-white px-3 text-left text-[12px] text-[#85857f] shadow-[0_1px_2px_rgba(20,20,16,0.035)] transition hover:border-[#d4d4ce]"
          >
            <Search size={15} strokeWidth={1.7} />
            <span className="min-w-0 flex-1 truncate">Buscar</span>
          </button>
        </>
      ) : null}

      <nav aria-label="Navegação principal do admin" className={`velo-scroll-oculto min-h-0 flex-1 space-y-1 overflow-y-auto ${collapsed ? "mt-6 px-0.5" : "mt-4 pr-1"}`}>
        {collapsed ? (
          navGroups.flatMap((group) => group.items).map((item) => (
            <SidebarNavLink key={item.to} item={item} active={isActive(item)} collapsed />
          ))
        ) : navGroups.map((group) => {
          const open = openGroups.has(group.id);
          const containsActiveItem = group.items.some(isActive);
          const regionId = `admin-nav-group-${group.id}`;

          return (
            <section key={group.id} aria-label={group.label} className="rounded-[11px]">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={open}
                aria-controls={regionId}
                className={`group flex h-9 w-full items-center gap-2 rounded-[9px] px-2.5 text-left transition-colors ${
                  containsActiveItem
                    ? "text-[#292926]"
                    : "text-[#888882] hover:bg-white/55 hover:text-[#4b4b46]"
                }`}
              >
                <motion.span
                  className="grid h-4 w-4 shrink-0 place-items-center"
                  animate={{ rotate: open ? 0 : -90 }}
                  transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ChevronDown size={12} strokeWidth={1.8} />
                </motion.span>
                <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-[0.09em]">
                  {group.label}
                </span>
                {group.indicator === "plus" ? (
                  <span className="grid h-4 w-4 shrink-0 place-items-center text-[#96968f]">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={open ? "minus" : "plus"}
                        initial={reduceMotion ? false : { opacity: 0, rotate: -45, scale: 0.7 }}
                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0, rotate: 45, scale: 0.7 }}
                        transition={{ duration: reduceMotion ? 0 : 0.16 }}
                        className="grid place-items-center"
                      >
                        {open ? <Minus size={12} strokeWidth={1.8} /> : <Plus size={12} strokeWidth={1.8} />}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                ) : containsActiveItem ? (
                  <span className="h-1 w-1 rounded-full bg-[#2a2a27]" aria-hidden="true" />
                ) : null}
              </button>

              <AnimatePresence initial={false}>
                {open ? (
                  <motion.div
                    id={regionId}
                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="ml-[17px] space-y-1 border-l border-[#dfdfda] pb-2 pl-2 pt-0.5">
                      {group.items.map((item, index) => (
                        <motion.div
                          key={item.to}
                          initial={reduceMotion ? false : { opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : index * 0.035 }}
                        >
                          <SidebarNavLink item={item} active={isActive(item)} />
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </section>
          );
        })}
      </nav>

      {!collapsed ? (
        <div className="mt-3 shrink-0 border-t border-[#e2e2dd] bg-[#f5f5f3] pt-4">
          <div className="flex items-center gap-3 rounded-[10px] px-2 py-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-[#20201d] text-[11px] font-semibold text-white">
              {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-[#2c2c29]">{profileName}</p>
              <p className="mt-0.5 truncate text-[10px] text-[#92928c]">{profileEmail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mt-2 flex h-10 w-full items-center gap-3 rounded-[9px] px-3 text-[12px] font-medium text-[#686863] hover:bg-white hover:text-[#22221f]"
          >
            <ArrowLeft size={15} strokeWidth={1.7} /> Voltar à Velo
          </button>
        </div>
      ) : null}

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} isAdmin />
    </motion.aside>
  );
};

export default OldAdminNewSidebar;
