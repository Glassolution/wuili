import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageSquare, LayoutGrid, Plug, Settings } from "lucide-react";
import BrandMark from "@/components/brand/BrandMark";

const navLinks = [
  { to: "/dashboard", icon: MessageSquare, label: "Chat IA" },
  { to: "/dashboard/produtos", icon: LayoutGrid, label: "Produtos" },
  { to: "/dashboard/integracoes", icon: Plug, label: "Integracoes" },
  { to: "/dashboard/configuracoes", icon: Settings, label: "Configuracoes" },
] as const;

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { nome, foto } = useProfile();
  const { signOut } = useAuth();
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
    if (to === "/dashboard") {
      return location.pathname === "/dashboard" || location.pathname === "/dashboard/ia";
    }
    return location.pathname.startsWith(to);
  };

  return (
    <nav className="flex h-full w-20 shrink-0 flex-col items-center border-r border-white/10 bg-[#090b17]/80 py-5 backdrop-blur-xl">
      <Link to="/dashboard" className="mb-8 shrink-0" title="Wuilli">
        <BrandMark size="sm" />
      </Link>

      <div className="flex flex-1 flex-col items-center gap-1.5">
        {navLinks.map(({ to, icon: Icon, label }) => {
          const active = isActive(to);
          return (
            <Tooltip key={to} delayDuration={300}>
              <TooltipTrigger asChild>
                <Link
                  to={to}
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] transition-all duration-150",
                    active
                      ? "glow-ring bg-cyan-300 text-slate-950"
                      : "text-slate-400 hover:bg-white/8 hover:text-cyan-200"
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
          className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/8 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
        >
          {foto ? (
            <img src={foto} alt="avatar" className="h-full w-full object-cover" />
          ) : iniciais}
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#090b17] bg-emerald-400" />
        </button>

        {menuOpen && (
          <div className="absolute bottom-full left-full z-50 mb-1 ml-2 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#111426] shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
            <Link
              to="/dashboard/configuracoes"
              onClick={() => setMenuOpen(false)}
              className="flex items-center px-4 py-3 text-sm text-white transition-colors hover:bg-white/8"
            >
              Perfil
            </Link>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center px-4 py-3 text-sm text-red-300 transition-colors hover:bg-white/8"
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
