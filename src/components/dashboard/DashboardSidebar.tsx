import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Users,
  BarChart3, Settings, MessageCircle, Wallet, Package,
  ArrowLeftRight, CreditCard, HelpCircle, ChevronRight, Sun, Moon,
} from "lucide-react";
import BrandMark from "@/components/brand/BrandMark";
import { useTheme } from "next-themes";

type RailLink = { to: string; icon: typeof MessageCircle; label: string };

const railLinks: RailLink[] = [
  { to: "/dashboard/clientes", icon: Users, label: "Clientes" },
  { to: "/dashboard/saldos", icon: Wallet, label: "Saldos" },
  { to: "/dashboard/transacoes", icon: ArrowLeftRight, label: "Transações" },
  { to: "/dashboard/pagamentos", icon: CreditCard, label: "Pagamentos" },
  { to: "/dashboard/relatorios", icon: BarChart3, label: "Relatórios" },
];

/* These paths belong to the Dropshipping workspace */
const dropshippingPaths = [
  "/dashboard/produtos",
  "/dashboard/dropshipping",
  "/dashboard/publicacoes",
  "/dashboard/pedidos",
  "/dashboard/criar-video",
];

const workspaceItems = [
  { label: "Produtos", path: "/dashboard/produtos", hasSubmenu: false },
  { label: "Dropshipping", path: "/dashboard/dropshipping", hasSubmenu: false },
  { label: "Publicações", path: "/dashboard/publicacoes", hasSubmenu: false },
  { label: "Pedidos", path: "/dashboard/pedidos", hasSubmenu: false },
  { label: "Criar Vídeos", path: "/dashboard/criar-video", hasSubmenu: false },
];

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { nome, foto } = useProfile();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const iniciais = nome.split(/[\s._\-]+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();

  const isActive = (to: string) => {
    if (to === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(to);
  };

  const isDropshippingActive = dropshippingPaths.some(p => location.pathname.startsWith(p));

  return (
    <div className="flex h-full shrink-0">
      {/* Rail */}
      <nav className="flex h-full w-[60px] shrink-0 flex-col items-center border-r border-border bg-background py-4 gap-1">
        {/* Logo */}
        <Link to="/?home=1" className="mb-4 flex items-center justify-center h-10 w-10">
          <BrandMark size="md" tone="light" />
        </Link>

        {/* Dropshipping icon — opens workspace panel */}
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Link
              to="/dashboard/ia"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                isActive("/dashboard/ia")
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <MessageCircle className="h-[17px] w-[17px]" strokeWidth={1.75} />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="text-xs">Chat IA</TooltipContent>
        </Tooltip>

        {/* Dropshipping icon — opens workspace panel */}
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Link
              to="/dashboard/dropshipping"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                isDropshippingActive
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Package className="h-[17px] w-[17px]" strokeWidth={1.75} />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="text-xs">Dropshipping</TooltipContent>
        </Tooltip>

        {/* Other nav icons */}
        <div className="flex flex-1 flex-col items-center gap-1 mt-1">
          {railLinks.map(({ to, icon: Icon, label }) => {
            const active = isActive(to);
            return (
              <Tooltip key={to} delayDuration={200}>
                <TooltipTrigger asChild>
                  <Link
                    to={to}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                      active
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="text-xs">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Bottom */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Link to="/dashboard/configuracoes" className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                <Settings className="h-[17px] w-[17px]" strokeWidth={1.75} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8} className="text-xs">Configurações</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              >
                {theme === "dark"
                  ? <Sun className="h-[17px] w-[17px]" strokeWidth={1.75} />
                  : <Moon className="h-[17px] w-[17px]" strokeWidth={1.75} />
                }
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8} className="text-xs">
              {theme === "dark" ? "Modo claro" : "Modo escuro"}
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>

      {/* Workspace panel — only visible when on dropshipping pages */}
      {isDropshippingActive && (
        <aside className="flex h-full w-[160px] shrink-0 flex-col border-r border-border bg-background py-4">
          <div className="px-4 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Workspace</p>
          </div>

          <nav className="flex-1 px-2 space-y-0.5">
            {workspaceItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-muted font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.label}
                  {item.hasSubmenu && <ChevronRight size={13} className="text-muted-foreground" />}
                </Link>
              );
            })}
          </nav>

          <div className="px-4 mt-4 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">Need some help?</p>
            <Link to="/dashboard/configuracoes" className="text-xs text-foreground hover:underline flex items-center gap-1 mt-0.5">
              <HelpCircle size={11} /> Drop us a word
            </Link>
          </div>
        </aside>
      )}
    </div>
  );
};

export default DashboardSidebar;
