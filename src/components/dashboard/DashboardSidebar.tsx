import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Home,
  LayoutGrid,
  MessageCircle,
  Settings,
  ShoppingCart,
  Star,
  Users,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProfile } from "@/lib/profileContext";

type RailLink = { to: string; icon: typeof MessageCircle; label: string };

const railLinks: RailLink[] = [
  { to: "/dashboard/ia", icon: MessageCircle, label: "Chat IA" },
  { to: "/dashboard", icon: LayoutGrid, label: "Página inicial" },
  { to: "/dashboard/pedidos", icon: ShoppingCart, label: "Pedidos" },
  { to: "/dashboard/catalogo", icon: BookOpen, label: "Catálogo" },
  { to: "/dashboard/publicacoes", icon: Star, label: "Publicações" },
  { to: "/dashboard/clientes", icon: Users, label: "Clientes" },
  { to: "/dashboard/relatorios", icon: BarChart3, label: "Relatórios" },
];

const DashboardSidebar = () => {
  const location = useLocation();
  const { nome, foto } = useProfile();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const iniciais = nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <nav className="flex h-full w-[56px] shrink-0 flex-col items-center border-r border-[#E2E8F0] bg-[#F8FAFC] py-4">
      <Link to="/" className="mb-5 shrink-0" title="Wuili">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-400 shadow-sm ring-1 ring-white/60 flex items-center justify-center text-white">
          <Home className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </div>
      </Link>

      <div className="flex flex-col items-center gap-1.5">
        {railLinks.map(({ to, icon: Icon, label }) => {
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
                      : "bg-white text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-gray-200/80 hover:bg-gray-50 hover:text-gray-700",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="text-xs">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-2">
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Link to="/dashboard/configuracoes" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-gray-200/80 transition-colors hover:bg-gray-50 hover:text-gray-800">
              <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="text-xs">Configurações</TooltipContent>
        </Tooltip>

        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground ring-1 ring-gray-200/80 transition-colors hover:opacity-90 overflow-hidden"
          >
            {foto ? <img src={foto} alt="avatar" className="w-full h-full object-cover" /> : iniciais}
            <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#F8FAFC] bg-emerald-500" />
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-full mb-1 ml-2 w-40 rounded-xl border border-border bg-background shadow-lg overflow-hidden z-50">
              <Link to="/dashboard/configuracoes" onClick={() => setUserMenuOpen(false)} className="flex items-center px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                Perfil
              </Link>
              <button className="w-full flex items-center px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors">
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
