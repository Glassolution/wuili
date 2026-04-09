import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bell,
  LayoutGrid,
  Layers,
  MessageSquare,
  Plug,
  Settings,
  Sun,
  Users,
  Zap,
} from "lucide-react";

const WuilliLogo = () => (
  <svg width="38" height="38" viewBox="0 0 30 30" fill="none">
    <rect width="30" height="30" rx="8" fill="#7C3AED" />
    <path d="M15 7.5L21 11.25V18.75L15 22.5L9 18.75V11.25L15 7.5Z" fill="white" />
  </svg>
);
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProfile } from "@/lib/profileContext";

type RailLink = {
  to: string;
  icon: typeof MessageSquare;
  label: string;
  badge?: string;
};

const railLinks: RailLink[] = [
  { to: "/dashboard/ia", icon: MessageSquare, label: "Chat IA" },
  { to: "/dashboard/notificacoes", icon: Bell, label: "Notificações" },
  { to: "/dashboard/relatorios", icon: Zap, label: "Relatórios" },
  { to: "/dashboard/integracoes", icon: Plug, label: "Integrações" },
  { to: "/dashboard/configuracoes", icon: Settings, label: "Configurações" },
  { to: "/dashboard", icon: LayoutGrid, label: "Página inicial" },
  { to: "/dashboard/publicacoes", icon: Layers, label: "Publicações" },
  { to: "/dashboard/clientes", icon: Users, label: "Clientes", badge: "live" },
];

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { nome, foto } = useProfile();
  const { signOut } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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

  return (
    <nav className="flex h-full w-[56px] shrink-0 flex-col items-center bg-[#F8FAFC] py-4">
      {/* Wuilli Logo */}
      <Link to="/" className="mb-5 shrink-0" title="Wuilli">
        <WuilliLogo />
      </Link>

      {/* Nav icons */}
      <div className="flex flex-col items-center gap-1.5">
        {railLinks.map(({ to, icon: Icon, label, badge }) => {
          const active = location.pathname === to;
          return (
            <Tooltip key={to} delayDuration={300}>
              <TooltipTrigger asChild>
                <Link
                  to={to}
                  className={cn(
                    "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                    active
                      ? "bg-[#7C3AED] text-white shadow-sm"
                      : "text-gray-400 hover:bg-gray-100 hover:text-gray-600",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  {badge && (
                    <span className="absolute -top-0.5 -right-0.5 rounded-full bg-blue-500 px-1 py-px text-[8px] font-bold leading-none text-white">
                      {badge}
                    </span>
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="text-xs">
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* Bottom */}
      <div className="flex flex-col items-center gap-2">
        {/* Sun / theme */}
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
              <Sun className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="text-xs">
            Tema
          </TooltipContent>
        </Tooltip>

        {/* User avatar */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground overflow-hidden hover:opacity-90 transition-opacity"
          >
            {foto ? (
              <img src={foto} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              iniciais
            )}
            <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#F8FAFC] bg-emerald-500" />
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-full mb-1 ml-2 w-40 rounded-xl border border-border bg-background shadow-lg overflow-hidden z-50">
              <Link
                to="/dashboard/configuracoes"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
              >
                Perfil
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default DashboardSidebar;
