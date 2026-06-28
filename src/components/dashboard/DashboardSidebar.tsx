import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileText,
  HelpCircle,
  Home,
  Inbox,
  LayoutTemplate,
  LogOut,
  Package,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";

type NavItem = {
  label: string;
  to: string;
  icon: React.ElementType;
  end?: boolean;
};

const sidebarFont =
  '"SF Pro Text", "Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const quickNav: NavItem[] = [
  { label: "Aquas", to: "/dashboard/atlas", icon: Sparkles },
];

const primaryNav: NavItem[] = [
  { label: "Home", to: "/dashboard", icon: Home, end: true },
  { label: "Catálogo", to: "/dashboard/catalogo", icon: LayoutTemplate },
  { label: "Produtos no ML", to: "/dashboard/produtos-ml", icon: ShoppingBag },
  { label: "Configurações", to: "/dashboard/configuracoes", icon: Settings },
];

const secondaryNav: NavItem[] = [
  { label: "Documentação", to: "/docs", icon: FileText },
  { label: "Indicar amigo", to: "/dashboard/comissoes", icon: Users },
  { label: "Caixa de entrada", to: "/dashboard/chat-fornecedores", icon: Inbox },
  { label: "Suporte", to: "/docs", icon: HelpCircle },
];

const VeloMark = () => (
  <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#111111] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_24px_rgba(17,24,39,0.14)]">
    <Package className="h-4.5 w-4.5" strokeWidth={1.8} />
    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#2563EB]" />
  </span>
);

const getInitials = (name: string, email?: string | null) => {
  const raw = (name || email || "Velo").trim();
  const parts = raw.split(/[\s._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const cleanPath = (value: string) => value.split("?")[0].replace(/\/$/, "");

const SidebarItem = ({ item, active }: { item: NavItem; active: boolean }) => {
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      className={`group relative flex h-[46px] items-center gap-[12px] overflow-hidden rounded-[10px] px-4 text-[15px] transition-colors duration-200 ${
        active 
          ? "font-medium text-[#1A1A1A]" 
          : "font-normal text-[#6C6C6E] hover:text-[#1A1A1A]"
      }`}
      style={{ fontFamily: sidebarFont }}
    >
      {active ? (
        <motion.span
          layoutId="velo-sidebar-active"
          className="absolute inset-0 rounded-[10px] bg-[#EBEBEB]"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(17,24,39,0.035)",
          }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      ) : (
        <span className="absolute inset-0 rounded-[10px] bg-transparent transition-colors duration-200 group-hover:bg-[#ECEBE9]/60" />
      )}
      <span className="relative z-10 grid h-6 w-6 shrink-0 place-items-center">
        <Icon className={active ? "text-[#1A1A1A]" : "text-[#77777A] group-hover:text-[#1A1A1A]"} size={20} strokeWidth={1.75} />
      </span>
      <span className="relative z-10 truncate">{item.label}</span>
    </Link>
  );
};

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { nome, foto } = useProfile();
  const displayName = nome || user?.user_metadata?.full_name || user?.email || "Velo";
  const initials = getInitials(displayName, user?.email);

  const isActive = (item: NavItem) => {
    const current = cleanPath(location.pathname);
    const target = cleanPath(item.to);
    return item.end ? current === target : current === target || current.startsWith(`${target}/`);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <aside
      className="flex h-full min-h-0 w-[272px] shrink-0 flex-col px-5 py-5"
      style={{
        fontFamily: sidebarFont,
        background: "#F3F2F0",
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.72), 12px 0 34px rgba(17,24,39,0.04)",
        backdropFilter: "blur(26px) saturate(150%)",
        WebkitBackdropFilter: "blur(26px) saturate(150%)",
      }}
    >
      <div className="flex items-center justify-between">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
          <VeloMark />
          <span className="truncate text-[18px] font-semibold text-[#111111]">Velo</span>
        </Link>

        <button
          type="button"
          onClick={() => navigate("/dashboard/configuracoes")}
          className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#F1F2F4] text-[12px] font-bold text-[#4B5563] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_18px_rgba(17,24,39,0.08)]"
          aria-label="Abrir perfil"
        >
          {foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : initials}
        </button>
      </div>

      <div className="mt-5 h-px bg-[#E2E2E4]" />

      <button
        type="button"
        onClick={() => navigate("/dashboard/catalogo")}
        className="group relative mt-5 flex h-[46px] items-center gap-[12px] overflow-hidden rounded-[10px] px-4 text-left text-[15px] font-normal text-[#6C6C6E] transition-colors duration-200 hover:text-[#1A1A1A]"
        style={{ fontFamily: sidebarFont }}
      >
        <span className="absolute inset-0 rounded-[10px] bg-transparent transition-colors duration-200 group-hover:bg-[#ECEBE9]/60" />
        <span className="relative z-10 grid h-6 w-6 shrink-0 place-items-center">
          <Search size={20} strokeWidth={1.75} className="text-[#77777A] group-hover:text-[#1A1A1A]" />
        </span>
        <span className="relative z-10 flex-1 truncate">Buscar</span>
      </button>

      <nav className="mt-1 flex flex-col gap-1">
        {quickNav.map((item) => (
          <SidebarItem key={`${item.label}-${item.to}`} item={item} active={isActive(item)} />
        ))}
      </nav>

      <nav className="mt-5 flex flex-col gap-1">
        {primaryNav.map((item) => (
          <SidebarItem key={`${item.label}-${item.to}`} item={item} active={isActive(item)} />
        ))}
      </nav>

      <div className="my-9 h-px bg-[#E2E2E4]" />

      <nav className="flex flex-col gap-1">
        {secondaryNav.map((item) => (
          <SidebarItem key={`${item.label}-${item.to}`} item={item} active={isActive(item)} />
        ))}
      </nav>

      <div className="mt-auto pt-5">
        <div className="mb-5 h-px bg-[#E2E2E4]" />
        <button
          type="button"
          onClick={handleSignOut}
          className="group relative flex h-[46px] w-full items-center gap-[12px] overflow-hidden rounded-[10px] px-4 text-left text-[15px] font-normal text-[#6C6C6E] transition-colors duration-200 hover:text-[#1A1A1A]"
          style={{ fontFamily: sidebarFont }}
        >
          <span className="absolute inset-0 rounded-[10px] bg-transparent transition-colors duration-200 group-hover:bg-[#ECEBE9]/60" />
          <span className="relative z-10 grid h-6 w-6 shrink-0 place-items-center">
            <LogOut size={20} strokeWidth={1.75} className="text-[#77777A] group-hover:text-[#1A1A1A]" />
          </span>
          <span className="relative z-10">Sair</span>
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
