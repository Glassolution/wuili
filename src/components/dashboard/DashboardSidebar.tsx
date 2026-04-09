import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageSquare, LayoutGrid, Plug, Settings } from "lucide-react";

const WuilliLogo = () => (
  <svg width="36" height="36" viewBox="0 0 30 30" fill="none">
    <rect width="30" height="30" rx="8" fill="#7C3AED" />
    <path d="M15 7.5L21 11.25V18.75L15 22.5L9 18.75V11.25L15 7.5Z" fill="white" />
  </svg>
);

const navLinks = [
  { to: "/dashboard",               icon: MessageSquare, label: "Chat IA" },
  { to: "/dashboard/produtos",      icon: LayoutGrid,    label: "Produtos" },
  { to: "/dashboard/integracoes",   icon: Plug,          label: "Integracoes" },
  { to: "/dashboard/configuracoes", icon: Settings,      label: "Configuracoes" },
] as const;

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate  = useNavigate();
  const { nome, foto } = useProfile();
  const { signOut }    = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const iniciais = nome
    .split(/[\s._\-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0])
    .join("")
    .toUpperCase();

  const isActive = (to: string) => {
    if (to === "/dashboard")
      return location.pathname === "/dashboard" || location.pathname === "/dashboard/ia";
    return location.pathname.startsWith(to);
  };

  return (
    <nav
      className="flex h-full w-16 shrink-0 flex-col items-center py-4 bg-[#FAFAFA]"
      style={{ borderRight: "1px solid #F0F0F0" }}
    >
      <Link to="/dashboard" className="mb-6 shrink-0" title="Wuilli">
        <WuilliLogo />
      </Link>

      <div className="flex flex-col items-center gap-1.5 flex-1">
        {navLinks.map(({ to, icon: Icon, label }) => {
          const active = isActive(to);
          return (
            <Tooltip key={to} delayDuration={300}>
              <TooltipTrigger asChild>
                <Link
                  to={to}
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition-all duration-150",
                    active
                      ? "bg-[#7C3AED] text-white shadow-sm"
                      : "text-[#9CA3AF] hover:bg-[#F3F0FF] hover:text-[#7C3AED]"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10} className="text-xs">
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#7C3AED] text-[12px] font-bold text-white overflow-hidden hover:opacity-90 transition-opacity"
        >
          {foto ? (
            <img src={foto} alt="avatar" className="w-full h-full object-cover" />
          ) : iniciais}
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#FAFAFA] bg-emerald-500" />
        </button>

        {menuOpen && (
          <div className="absolute bottom-full left-full mb-1 ml-2 w-40 rounded-xl border border-[#F0F0F0] bg-white shadow-lg overflow-hidden z-50">
            <Link
              to="/dashboard/configuracoes"
              onClick={() => setMenuOpen(false)}
              className="flex items-center px-4 py-2.5 text-sm text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
            >
              Perfil
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center px-4 py-2.5 text-sm text-red-500 hover:bg-[#FAFAFA] transition-colors"
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default DashboardSidebar;
