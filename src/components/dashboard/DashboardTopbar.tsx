import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useProfile } from "@/lib/profileContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import NotificacoesPopover from "@/components/dashboard/NotificacoesPopover";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";
import {
  Menu, Search, ChevronRight, X, type LucideIcon,
  LayoutGrid, ShoppingCart, BookOpen, Star, Users,
  BarChart3, Settings, Wallet, ArrowLeftRight, CreditCard,
  Sparkles, Palette, User, HelpCircle, LogOut,
  Clapperboard, MessageSquare,
} from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Início",
  "/dashboard/saldos": "Saldos",
  "/dashboard/transacoes": "Transações",
  "/dashboard/clientes": "Clientes",
  "/dashboard/produtos": "Produtos",
  "/dashboard/pedidos": "Pedidos",
  "/dashboard/publicacoes": "Publicações",
  "/dashboard/pagamentos": "Pagamentos",
  "/dashboard/relatorios": "Relatórios",
  "/dashboard/comissoes": "Comissões",
  "/dashboard/configuracoes": "Configurações",
  "/dashboard/criar-video": "Criar Vídeos",
  "/dashboard/chat-fornecedores": "Chat com Fornecedores",
};

type MobileMenuItem = { icon: LucideIcon; label: string; path: string };

const mobileItems: MobileMenuItem[] = [
  { icon: LayoutGrid, label: "Dashboard", path: "/dashboard" },
  { icon: ShoppingCart, label: "Pedidos", path: "/dashboard/pedidos" },
  { icon: BookOpen, label: "Produtos", path: "/dashboard/produtos" },
  { icon: Users, label: "Clientes", path: "/dashboard/clientes" },
  { icon: Wallet, label: "Receita", path: "/dashboard/saldos" },
  { icon: BarChart3, label: "Comissões", path: "/dashboard/comissoes" },
  { icon: Settings, label: "Configurações", path: "/dashboard/configuracoes" },
];

const DashboardTopbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [plano, setPlano] = useState<string>("gratis");
  const menuRef = useRef<HTMLDivElement>(null);
  const { nome, foto } = useProfile();
  const { signOut, user } = useAuth();
  // Iniciais para o fallback do avatar quando não há foto enviada — evita
  // depender de uma imagem padrão externa que pode não resolver.
  const iniciais = (nome || user?.email || "U")
    .split(/[\s@]/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const pageTitle = pageTitles[location.pathname] || "Dashboard";
  const upgradeModal = useUpgradeModal();

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      supabase.from("profiles").select("plano").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("subscriptions")
        .select("plan,status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([profileResult, subResult]) => {
      if (!active) return;
      const sub = subResult.data as { plan?: string | null; status?: string | null } | null;
      // Prefer active subscription plan over profiles.plano (which pode ficar
      // desatualizado quando o webhook do MP falha em sincronizar o perfil).
      if (sub?.plan) {
        const p = sub.plan === "plus" ? "pro" : sub.plan;
        setPlano(String(p));
        return;
      }
      if (profileResult.data?.plano) setPlano(String(profileResult.data.plano));
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    if (avatarMenuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [avatarMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const planLabel: Record<string, string> = {
    gratis: "Grátis",
    go: "Go",
    base: "Base",
    pro: "Pro",
    business: "Business",
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-3 dark:border-transparent sm:gap-4 sm:px-4">
        <button className="md:hidden text-muted-foreground" onClick={() => setMobileOpen(true)}>
          <Menu size={20} />
        </button>

        <div className="min-w-0 flex-1 md:hidden">
          <p className="truncate text-[15px] font-semibold text-foreground">{pageTitle}</p>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
          <span className="font-semibold text-foreground dark:text-white">Velo</span>
          <ChevronRight size={13} />
          <span>{pageTitle}</span>
        </div>

        <div className="hidden flex-1 justify-center sm:flex">
          <div className="relative w-full max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-xl border border-border bg-muted/50 py-2 pl-8 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
              placeholder="Pesquisar ou pressione '/' para comandos"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <NotificacoesPopover />
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setAvatarMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#1e293b] text-[11px] font-bold text-white transition-opacity hover:opacity-90"
            >
              {foto ? <img src={foto} alt="avatar" className="h-full w-full object-cover" /> : iniciais}
            </button>

            {avatarMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
                {/* User info */}
                <Link
                  to="/dashboard/configuracoes"
                  onClick={() => setAvatarMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1e293b] text-[11px] font-bold text-white">
                    {foto ? <img src={foto} alt="avatar" className="h-full w-full object-cover" /> : iniciais}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{nome || "Usuário"}</p>
                    <p className="text-xs text-muted-foreground">{planLabel[plano] ?? plano}</p>
                  </div>
                  <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                </Link>

                <div className="border-t border-border" />

                {/* Upgrade */}
                {plano === "gratis" && (
                  <button
                    type="button"
                    onClick={() => { setAvatarMenuOpen(false); upgradeModal.open(); }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <Sparkles size={15} className="shrink-0 text-yellow-500" />
                    Upgrade de plano
                  </button>
                )}

                <Link
                  to="/dashboard/configuracoes"
                  onClick={() => setAvatarMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Palette size={15} className="shrink-0 text-muted-foreground" />
                  Personalização
                </Link>

                <Link
                  to="/dashboard/configuracoes"
                  onClick={() => setAvatarMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <User size={15} className="shrink-0 text-muted-foreground" />
                  Perfil
                </Link>

                <Link
                  to="/dashboard/configuracoes"
                  onClick={() => setAvatarMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Settings size={15} className="shrink-0 text-muted-foreground" />
                  Configurações
                </Link>

                <div className="border-t border-border" />

                <Link
                  to="/dashboard/configuracoes"
                  onClick={() => setAvatarMenuOpen(false)}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <HelpCircle size={15} className="shrink-0 text-muted-foreground" />
                    Ajuda
                  </span>
                  <ChevronRight size={13} className="text-muted-foreground" />
                </Link>

                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors"
                >
                  <LogOut size={15} className="shrink-0" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute bottom-0 left-0 top-0 w-[82vw] max-w-[320px] border-r border-border bg-background px-3 pb-4 pt-5 dark:border-transparent">
            <div className="mb-5 flex items-center justify-between px-2">
              <span className="text-lg font-black text-foreground dark:text-white">Velo</span>
              <button onClick={() => setMobileOpen(false)}><X size={20} /></button>
            </div>
            <div className="space-y-1">
              {mobileItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? "bg-[#0A0A0A] text-white dark:bg-white dark:text-black"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon size={16} className="shrink-0" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardTopbar;
