import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutGrid, Users, BarChart3, Settings, Wallet, Package,
  ArrowLeftRight, CreditCard, Clapperboard, MessageSquare,
  ShoppingCart, Star, ChevronDown, Sun, Moon, Store,
  Banknote, LogOut, ShieldCheck,
} from "lucide-react";
import { useTheme } from "next-themes";
import { VeloLogo } from "@/components/VeloLogo";

// ── Types ─────────────────────────────────────────────────────────────────────

type SubItem = { label: string; to: string };

type NavGroup =
  | { kind: "link";  to: string; icon: React.ElementType; label: string }
  | { kind: "group"; icon: React.ElementType; label: string; items: SubItem[] };

// ── Nav structure ─────────────────────────────────────────────────────────────

const nav: NavGroup[] = [
  { kind: "link",  to: "/dashboard",  icon: LayoutGrid, label: "Início" },
  { kind: "link",  to: "/dashboard/clientes",  icon: Users,         label: "Clientes"   },
  {
    kind: "group", icon: Store, label: "Loja",
    items: [
      { label: "Produtos",    to: "/dashboard/produtos"    },
      { label: "Publicações", to: "/dashboard/publicacoes" },
      { label: "Pedidos",     to: "/dashboard/pedidos"     },
    ],
  },
  {
    kind: "group", icon: Banknote, label: "Financeiro",
    items: [
      { label: "Saldos",      to: "/dashboard/saldos"      },
      { label: "Transações",  to: "/dashboard/transacoes"  },
      { label: "Pagamentos",  to: "/dashboard/pagamentos"  },
    ],
  },
  { kind: "link",  to: "/dashboard/relatorios",        icon: BarChart3,    label: "Relatórios"  },
  { kind: "link",  to: "/dashboard/criar-video",       icon: Clapperboard, label: "Vídeos"      },
  { kind: "link",  to: "/dashboard/chat-fornecedores", icon: MessageSquare,label: "Chat"        },
];

const adminRoleChecks = (userId: string) => [
  { _role: "admin" },
  { role: "admin" },
  { _user_id: userId, _role: "admin" },
  { user_id: userId, role: "admin" },
];

async function checkAdminAccess(userId: string) {
  for (const params of adminRoleChecks(userId)) {
    const { data, error } = await (supabase as any).rpc("has_role", params);
    if (!error && data === true) return true;
  }

  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("role")
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();

  if (error) return false;
  return data?.role === "admin";
}

// ── Component ─────────────────────────────────────────────────────────────────

const DashboardSidebar = () => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { nome, foto } = useProfile();
  const { user, signOut } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();

  const { data: isAdmin = false } = useQuery({
    queryKey: ["sidebar-admin-access", user?.id],
    enabled: !!user?.id,
    queryFn: () => checkAdminAccess(user!.id),
    staleTime: 5 * 60 * 1000,
  });

  // Track which groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    // Auto-open the group that matches current path
    const init: Record<string, boolean> = {};
    nav.forEach((g) => {
      if (g.kind === "group") {
        if (g.items.some((i) => location.pathname.startsWith(i.to))) {
          init[g.label] = true;
        }
      }
    });
    return init;
  });

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const iniciais = nome
    .split(/[\s._\-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const isLinkActive = (to: string) =>
    to === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(to);

  const isGroupActive = (items: SubItem[]) =>
    items.some((i) => location.pathname.startsWith(i.to));

  return (
    <nav className="flex h-full w-[220px] shrink-0 flex-col border-r border-border bg-background">

      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div className="flex h-14 shrink-0 items-center px-5 border-b border-border">
        <Link to="/?home=1">
          <VeloLogo size="sm" variant={resolvedTheme === "dark" ? "light" : "dark"} />
        </Link>
      </div>

      {/* ── Nav items ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        {nav.map((item) => {

          /* ── Standalone link ── */
          if (item.kind === "link") {
            const active = isLinkActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all",
                  active
                    ? "bg-[#0A0A0A] text-white dark:bg-white dark:text-black"
                    : "text-[#737373] hover:bg-[#F5F5F5] hover:text-[#0A0A0A] dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                )}
              >
                <item.icon
                  size={16}
                  strokeWidth={active ? 2.2 : 1.75}
                  className="shrink-0"
                />
                {item.label}
              </Link>
            );
          }

          /* ── Expandable group ── */
          const groupActive = isGroupActive(item.items);
          const isOpen = openGroups[item.label] ?? false;

          return (
            <div key={item.label}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(item.label)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all",
                  groupActive && !isOpen
                    ? "bg-[#0A0A0A] text-white dark:bg-white dark:text-black"
                    : groupActive && isOpen
                    ? "text-[#0A0A0A] dark:text-white"
                    : "text-[#737373] hover:bg-[#F5F5F5] hover:text-[#0A0A0A] dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                )}
              >
                <item.icon
                  size={16}
                  strokeWidth={groupActive ? 2.2 : 1.75}
                  className="shrink-0"
                />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown
                  size={14}
                  className={cn(
                    "shrink-0 transition-transform duration-200",
                    isOpen ? "rotate-180" : "rotate-0",
                    groupActive && !isOpen ? "text-white/60 dark:text-black/60" : "text-[#C0C0C0] dark:text-zinc-500"
                  )}
                />
              </button>

              {/* Sub-items */}
              {isOpen && (
                <div className="mt-0.5 mb-1 ml-3 space-y-0.5 border-l border-[#F0F0F0] pl-4 dark:border-zinc-700">
                  {item.items.map((sub) => {
                    const subActive = location.pathname.startsWith(sub.to);
                    return (
                      <Link
                        key={sub.to}
                        to={sub.to}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] transition-all",
                          subActive
                            ? "font-semibold text-[#0A0A0A] dark:text-white"
                            : "font-medium text-[#A3A3A3] hover:text-[#0A0A0A] dark:text-zinc-400 dark:hover:text-zinc-200"
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            subActive ? "bg-[#0A0A0A] dark:bg-white" : "bg-[#D4D4D4] dark:bg-zinc-600"
                          )}
                        />
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {isAdmin && (
          <Link
            to="/admin/dashboard"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all",
              location.pathname.startsWith("/admin")
                ? "bg-[#0A0A0A] text-white dark:bg-white dark:text-black"
                : "text-[#737373] hover:bg-[#F5F5F5] hover:text-[#0A0A0A] dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            )}
          >
            <ShieldCheck size={16} strokeWidth={1.9} className="shrink-0" />
            Admin
          </Link>
        )}
      </div>

      {/* ── Bottom ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border px-3 py-3 space-y-0.5">

        {/* Settings */}
        <Link
          to="/dashboard/configuracoes"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all",
            isLinkActive("/dashboard/configuracoes")
              ? "bg-[#0A0A0A] text-white dark:bg-white dark:text-black"
              : "text-[#737373] hover:bg-[#F5F5F5] hover:text-[#0A0A0A] dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
          )}
        >
          <Settings size={16} strokeWidth={1.75} className="shrink-0" />
          Configurações
        </Link>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-[#737373] transition-all hover:bg-[#F5F5F5] hover:text-[#0A0A0A] dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          {theme === "dark"
            ? <Sun size={16} strokeWidth={1.75} className="shrink-0" />
            : <Moon size={16} strokeWidth={1.75} className="shrink-0" />}
          {theme === "dark" ? "Modo claro" : "Modo escuro"}
        </button>

        {/* User row */}
        <button
          onClick={handleSignOut}
          title="Sair"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-[#737373] transition-all hover:bg-[#F5F5F5] hover:text-[#0A0A0A] dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1e293b] text-[9px] font-bold text-white">
            {foto
              ? <img src={foto} alt="avatar" className="h-full w-full object-cover" />
              : iniciais || "VL"}
          </span>
          <span className="flex-1 truncate text-left">{nome || "Minha conta"}</span>
          <LogOut size={13} className="shrink-0 text-[#C0C0C0] dark:text-zinc-500" />
        </button>

      </div>
    </nav>
  );
};

export default DashboardSidebar;
