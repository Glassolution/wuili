import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { cn } from "@/lib/utils";
import { veloToast } from "@/components/ui/velo-toast";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import {
  Home,
  Users,
  Store,
  Package,
  FileText,
  ShoppingCart,
  Wallet,
  BarChart2,
  Video,
  Megaphone,
  ShoppingBag,
  Link2,
  MessageSquare,
  ShieldCheck,
  BadgeDollarSign,
  Settings,
  ChevronDown,
  ChevronUp,
  Code2,
  MessageCircle,
  LogOut,
  Search,
  Landmark,
  ArrowLeftRight,
  CreditCard,
  Plus,
  Check,
  Plug,
  Edit2,
  Trash2,
} from "lucide-react";
import StartModeModal from "./StartModeModal";
import { useStartMode } from "@/hooks/useStartMode";
import {
  MAX_STORES_PER_USER,
  readUserStores,
  START_STORE_ONBOARDING_EVENT,
  STORES_CHANGED_EVENT,
  setActiveStore,
  updateStoreName,
  deleteStore,
  type VeloStore,
} from "@/components/dashboard/FirstStoreOnboarding";

// ── Icon helper — className="sidebar-icon" is what index.css targets for the draw-on animation ──
const sidebarDisplayFont = '"SF Pro Display", "Helvetica Neue", "Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const sidebarFont = '"SF Pro Text", "Helvetica Neue", "Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const IconSpan = ({
  icon: Icon,
  size = 17,
  strokeWidth = 1.8,
  color,
}: {
  icon: React.ElementType;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) => (
  <Icon size={size} strokeWidth={strokeWidth} className="sidebar-icon shrink-0" style={{ color }} />
);

// ── Nav row sub-components ────────────────────────────────────────────────────

const NavLinkRow = ({
  item,
  active,
  collapsed,
  animatedActive = false,
}: {
  item: Extract<NavGroup, { kind: "link" }>;
  active: boolean;
  collapsed: boolean;
  animatedActive?: boolean;
}) => (
  <Link
    to={item.to}
    className={cn(
      "sidebar-item group relative flex items-center overflow-hidden transition-all duration-300 ease-out border-0 border-transparent outline-none focus:outline-none",
      collapsed ? "group w-full h-[32px] justify-center p-0 m-0" : "px-2.5"
    )}
    title={collapsed ? item.label : undefined}
    style={{
      fontFamily: sidebarFont,
      fontSize: collapsed ? undefined : "13.5px",
      fontWeight: collapsed ? undefined : active ? 550 : 400,
      lineHeight: collapsed ? undefined : "20px",
      letterSpacing: collapsed ? undefined : "-0.018em",
      height: collapsed ? undefined : "38px",
      gap: collapsed ? undefined : "10px",
      borderRadius: collapsed ? undefined : "12px",
      flexShrink: 0,
      background: active && !collapsed ? "#F4F4F5" : "transparent",
      border: "none",
      outline: "none",
      boxShadow: "none",
    }}
  >
    {collapsed ? (
      <div 
        className="flex h-8 w-8 items-center justify-center rounded-[10px] transition-all duration-300 ease-out"
        style={{
          background: active ? "#F4F4F5" : "transparent",
          border: "none",
          outline: "none",
        }}
      >
        <span className={cn(
          "grid h-7 w-7 place-items-center rounded-[8px] transition-all duration-300",
          active ? "bg-[#0a0a0a] text-white" : "bg-transparent text-[#9CA3AF]"
        )}>
          <IconSpan icon={item.icon} size={active ? 15 : 17} strokeWidth={active ? 1.6 : 1.5} color="currentColor" />
        </span>
      </div>
    ) : (
      <div className="relative z-10 flex items-center gap-2.5 pl-0.5">
        <span className={cn(
          "grid h-7 w-7 place-items-center rounded-[8px] transition-all duration-300",
          active ? "bg-[#0a0a0a] text-white" : "bg-transparent text-[#9CA3AF] group-hover:text-[#6B7280]"
        )}>
          <IconSpan icon={item.icon} size={active ? 15 : 17} strokeWidth={active ? 1.6 : 1.5} color="currentColor" />
        </span>
        <span style={{ color: active ? "#000000" : "#4B5563" }} className="transition-colors duration-200 group-hover:text-[#111827]">
          {item.label}
        </span>
      </div>
    )}
  </Link>
);

const NavGroupRow = ({
  item,
  isOpen,
  collapsed,
  groupActiveCompact,
  onToggle,
}: {
  item: Extract<NavGroup, { kind: "group" }>;
  isOpen: boolean;
  collapsed: boolean;
  groupActiveCompact: boolean;
  onToggle: () => void;
  pathname: string;
}) => (
  <button
    type="button"
    onClick={onToggle}
    className={cn(
      "sidebar-item group w-full relative flex items-center overflow-hidden transition-all duration-300 ease-out border-0 border-transparent outline-none focus:outline-none",
      collapsed ? "group h-[32px] justify-center p-0 m-0" : "px-2.5"
    )}
    title={collapsed ? item.label : undefined}
    style={{
      fontFamily: collapsed ? undefined : sidebarFont,
      fontSize: collapsed ? undefined : "13.5px",
      fontWeight: collapsed ? undefined : groupActiveCompact ? 550 : 400,
      lineHeight: collapsed ? undefined : "20px",
      letterSpacing: collapsed ? undefined : "-0.018em",
      textTransform: collapsed ? undefined : "none",
      height: collapsed ? undefined : "38px",
      gap: collapsed ? undefined : "10px",
      borderRadius: collapsed ? undefined : "12px",
      flexShrink: 0,
      cursor: "pointer",
      background: groupActiveCompact && !collapsed ? "#F4F4F5" : "transparent",
      border: "none",
      outline: "none",
      boxShadow: "none",
    }}
  >
    {collapsed ? (
      <div 
        className="flex h-8 w-8 items-center justify-center rounded-[10px] transition-all duration-300 ease-out"
        style={{
          background: groupActiveCompact ? "#F4F4F5" : "transparent",
          border: "none",
          outline: "none",
        }}
      >
        <span className={cn(
          "grid h-7 w-7 place-items-center rounded-[8px] transition-all duration-300",
          groupActiveCompact ? "bg-[#0a0a0a] text-white" : "bg-transparent text-[#9CA3AF]"
        )}>
          <IconSpan icon={item.icon} size={groupActiveCompact ? 15 : 17} strokeWidth={groupActiveCompact ? 1.6 : 1.5} color="currentColor" />
        </span>
      </div>
    ) : (
      <>
        <span className={cn(
          "grid h-7 w-7 place-items-center rounded-[8px] transition-all duration-300",
          groupActiveCompact ? "bg-[#0a0a0a] text-white" : "bg-transparent text-[#9CA3AF] group-hover:text-[#6B7280]"
        )}>
          <IconSpan icon={item.icon} size={groupActiveCompact ? 15 : 17} strokeWidth={groupActiveCompact ? 1.6 : 1.5} color="currentColor" />
        </span>
        <span className="flex-1 text-left transition-colors duration-200 group-hover:text-[#111827]" style={{ color: groupActiveCompact ? "#000000" : "#4B5563" }}>
          {item.label}
        </span>
        {item.trailing === "plus" ? (
          <Plus size={15} strokeWidth={1.5} className="shrink-0 text-[#9CA3AF] group-hover:text-[#6B7280]" />
        ) : (
          <ChevronDown size={14} strokeWidth={1.5} className={cn("shrink-0 transition-transform duration-200 text-[#9CA3AF] group-hover:text-[#6B7280]", isOpen ? "rotate-180" : "rotate-0")} />
        )}
      </>
    )}
  </button>
);

const subIconMap: Record<string, React.ElementType> = {
  Produtos: Package,
  Publicações: FileText,
  Pedidos: ShoppingCart,
  Vídeos: Video,
  Chat: MessageSquare,
  Saldos: Landmark,
  Transações: ArrowLeftRight,
  Pagamentos: CreditCard,
  Integrações: Plug,
  "Loja online": ShoppingBag,
  "Vender por link": Link2,
};

const NavSubRow = ({ sub, subActive }: { sub: SubItem; subActive: boolean }) => {
  const SubIcon = subIconMap[sub.label];
  return (
    <Link
      to={sub.to}
      className="sidebar-item relative flex items-center transition-all duration-300 ease-out border-0 border-transparent outline-none focus:outline-none"
      style={{ 
        fontFamily: sidebarFont, 
        fontSize: "13px", 
        fontWeight: subActive ? 550 : 400, 
        lineHeight: "18px", 
        letterSpacing: "-0.014em", 
        height: "32px", 
        gap: "10px",
        paddingLeft: "42px",
        paddingRight: "10px",
        borderRadius: "10px",
        flexShrink: 0,
        background: subActive ? "#F4F4F5" : "transparent",
        border: "none",
        outline: "none",
        boxShadow: "none",
      }}
    >
      {SubIcon && <IconSpan icon={SubIcon} size={15} strokeWidth={1.5} color={subActive ? "#000000" : "#9CA3AF"} />}
      <span style={{ color: subActive ? "#000000" : "#4B5563" }} className="transition-colors duration-200 group-hover:text-[#111827]">{sub.label}</span>
    </Link>
  );
};

const FooterLinkRow = ({
  to,
  icon,
  label,
  active,
  collapsed,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  collapsed: boolean;
}) => {
  if (collapsed) {
    return (
      <Link to={to} className="sidebar-item group relative flex h-[32px] w-full items-center justify-center p-0 m-0 transition-all duration-300 ease-out border-0 border-transparent outline-none focus:outline-none" title={label}>
        <div 
          className="flex h-8 w-8 items-center justify-center rounded-[10px] transition-all duration-300 ease-out"
          style={{
            background: active ? "#F4F4F5" : "transparent",
            border: "none",
            outline: "none",
          }}
        >
          <span className={cn(
            "grid h-7 w-7 place-items-center rounded-[8px] transition-all duration-300",
            active ? "bg-[#0a0a0a] text-white" : "bg-transparent text-[#9CA3AF]"
          )}>
            <IconSpan icon={icon} size={active ? 15 : 17} strokeWidth={active ? 1.6 : 1.5} color="currentColor" />
          </span>
        </div>
      </Link>
    );
  }
  return (
    <Link
      to={to}
      className="sidebar-item relative flex items-center transition-all duration-300 ease-out border-0 border-transparent outline-none focus:outline-none"
      style={{ 
        fontFamily: sidebarFont, 
        fontSize: "13.5px", 
        fontWeight: active ? 550 : 400, 
        lineHeight: "18px", 
        letterSpacing: "-0.014em",
        height: "38px",
        gap: "10px",
        paddingLeft: "10px",
        paddingRight: "10px",
        borderRadius: "12px",
        flexShrink: 0,
        background: active ? "#F4F4F5" : "transparent",
        border: "none",
        outline: "none",
        boxShadow: "none",
      }}
    >
      <span className={cn(
        "grid h-7 w-7 place-items-center rounded-[8px] transition-all duration-300",
        active ? "bg-[#0a0a0a] text-white" : "bg-transparent text-[#9CA3AF] group-hover:text-[#6B7280]"
      )}>
        <IconSpan icon={icon} size={active ? 15 : 17} strokeWidth={active ? 1.6 : 1.5} color="currentColor" />
      </span>
      <span style={{ color: active ? "#000000" : "#4B5563" }} className="transition-colors duration-200 group-hover:text-[#111827]">{label}</span>
    </Link>
  );
};

const FooterButtonRow = ({
  icon,
  label,
  color = "#888888",
  collapsed,
  onClick,
  children,
}: {
  icon: React.ElementType;
  label: string;
  color?: string;
  collapsed: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) => {
  if (collapsed) {
    return (
      <button type="button" onClick={onClick} className="sidebar-item group flex w-full items-center justify-center p-0 m-0 transition-all duration-300 ease-out" style={{ background: "transparent", border: "none", cursor: "pointer" }} title={label}>
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] transition-all duration-300 ease-out hover:bg-white/40">
          <IconSpan icon={icon} size={17} strokeWidth={1.5} color="#9CA3AF" />
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="sidebar-item relative flex w-full items-center bg-transparent transition-all duration-300 ease-out border-0 border-transparent outline-none focus:outline-none"
      style={{ 
        fontFamily: sidebarFont, 
        fontSize: "13.5px", 
        fontWeight: 400, 
        lineHeight: "18px", 
        letterSpacing: "-0.014em",
        height: "38px",
        gap: "10px",
        paddingLeft: "10px",
        paddingRight: "10px",
        borderRadius: "12px",
        background: "transparent",
        cursor: "pointer",
        border: "none",
        outline: "none",
      }}
    >
      <span className="grid h-7 w-7 place-items-center rounded-[8px] transition-all duration-300 text-[#9CA3AF] group-hover:text-[#6B7280]">
        <IconSpan icon={icon} size={17} strokeWidth={1.5} color="currentColor" />
      </span>
      <span className="flex-1 text-left transition-colors duration-200 group-hover:text-[#111827]" style={{ color: "#4B5563" }}>{label}</span>
      {children}
    </button>
  );
};

const FooterAnchorRow = ({
  href,
  icon,
  label,
  color = "#888888",
  collapsed,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  color?: string;
  collapsed: boolean;
}) => {
  if (collapsed) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="sidebar-item group flex w-full items-center justify-center p-0 m-0 transition-all duration-300 ease-out" title={label}>
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] transition-all duration-300 ease-out hover:bg-white/40">
          <IconSpan icon={icon} size={17} strokeWidth={1.5} color="#9CA3AF" />
        </span>
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="sidebar-item relative flex items-center transition-all duration-300 ease-out border-0 border-transparent outline-none focus:outline-none"
      style={{ 
        fontFamily: sidebarFont, 
        fontSize: "13.5px", 
        fontWeight: 400, 
        lineHeight: "18px", 
        letterSpacing: "-0.014em",
        height: "38px",
        gap: "10px",
        paddingLeft: "10px",
        paddingRight: "10px",
        borderRadius: "12px",
        flexShrink: 0,
        border: "none",
        outline: "none",
      }}
    >
      <span className="grid h-7 w-7 place-items-center rounded-[8px] transition-all duration-300 text-[#9CA3AF] group-hover:text-[#6B7280]">
        <IconSpan icon={icon} size={17} strokeWidth={1.5} color="currentColor" />
      </span>
      <span className="whitespace-nowrap transition-colors duration-200 group-hover:text-[#111827]" style={{ color: "#4B5563" }}>{label}</span>
    </a>
  );
};

// ── Types ─────────────────────────────────────────────────────────────────────

type SubItem = { label: string; to: string };

type NavGroup =
  | { kind: "link";  to: string; icon: React.ElementType; label: string }
  | { kind: "group"; icon: React.ElementType; label: string; items: SubItem[]; trailing?: "chevron" | "plus"; defaultOpen?: boolean };

// ── Nav structure ─────────────────────────────────────────────────────────────

const nav: NavGroup[] = [
  { kind: "link", to: "/dashboard", icon: Home, label: "Home" },
  { kind: "link", to: "/dashboard/catalogo", icon: Package, label: "Catálogo" },
  { kind: "link", to: "/dashboard/produtos-ml", icon: ShoppingBag, label: "Produtos no ML" },
  { kind: "link", to: "/dashboard/configuracoes", icon: Settings, label: "Configurações" },
];

const otherNav: NavGroup[] = [
  { kind: "link", to: "/dashboard/documentation", icon: FileText, label: "Documentação" },
  { kind: "link", to: "/dashboard/refer", icon: Users, label: "Indicar amigo" },
  { kind: "link", to: "/dashboard/inbox", icon: MessageSquare, label: "Caixa de entrada" },
  { kind: "link", to: "/dashboard/support", icon: MessageCircle, label: "Suporte" },
];

const ADMIN_EMAILS = new Set(["xavierluisfelipe12@gmail.com"]);
const AFFILIATE_EMAILS = new Set(["engelmannmatheus64@gmail.com"]);

type SidebarRoleQueryResult = {
  data?: Record<string, string | null> | null;
};

type SidebarRoleClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<SidebarRoleQueryResult>;
      };
    };
  };
};

// ── Velo Mark (logo icon only) ────────────────────────────────────────────────

const VeloMark = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }}>
    <rect width="48" height="48" rx="10" fill="#0A0A0A" />
    <path d="M33 18 A11 11 0 1 0 33 30" stroke="#FFFFFF" strokeWidth="3.7" strokeLinecap="round" fill="none" />
    <path d="M30 26 L34 30 L38 26" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

// ── Toggle Switch ─────────────────────────────────────────────────────────────

const StoreSwitcher = ({
  collapsed,
  stores,
  userEmail,
}: {
  collapsed: boolean;
  stores: VeloStore[];
  userEmail?: string | null;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const activeStore = stores.find(store => store.isActive) || stores[0];
  const displayName = activeStore?.name ?? "Criar loja";
  const canCreateStore = stores.length < MAX_STORES_PER_USER;
  const storeOptions = stores.map((store) => ({
    id: store.id,
    name: store.name,
    label: `${store.publishedProducts ?? 0}/${store.productLimit ?? 30} produtos`,
    active: store.isActive || (!stores.some(s => s.isActive) && store === stores[0]),
  }));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const createStore = () => {
    setIsOpen(false);
    window.dispatchEvent(new Event(START_STORE_ONBOARDING_EVENT));
  };

  if (collapsed) {
    return (
      <div ref={containerRef} className="relative flex w-full justify-center px-2">
        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors duration-200 hover:bg-white"
          title="Minha Loja"
        >
          <Store size={17} strokeWidth={1.65} className="text-[#737373]" />
        </button>
        {isOpen && (
          <div className="absolute left-[60px] top-0 z-50 w-[268px] rounded-[12px] border border-[#e5e7eb] bg-white p-2 shadow-[0_18px_42px_rgba(15,23,42,0.12)]">
            <StoreDropdownContent
              stores={storeOptions}
              userEmail={userEmail}
              onCreate={canCreateStore ? createStore : undefined}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative shrink-0 px-3">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        className="flex min-h-[38px] w-full items-center justify-between rounded-[8px] border border-[#e5e7eb] bg-white px-3 py-2 text-left transition-colors duration-200 hover:bg-[#fbfbfb]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Store size={16} strokeWidth={1.65} className="shrink-0 text-[#777777]" />
          <span className="min-w-0 truncate text-[13px] font-semibold leading-[17px] text-[#111111]">
            {displayName}
          </span>
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.6}
          className={cn("shrink-0 text-[#A0A7B5] transition-transform duration-200", isOpen ? "rotate-180" : "")}
        />
      </button>
      {isOpen && (
      <div className="absolute left-3 right-3 top-[44px] z-50 rounded-[10px] border border-[#e5e7eb] bg-white p-2 shadow-[0_14px_30px_rgba(15,23,42,0.10)]">
          <StoreDropdownContent
            stores={storeOptions}
            userEmail={userEmail}
            onCreate={canCreateStore ? createStore : undefined}
          />
        </div>
      )}
    </div>
  );
};

const StoreDropdownContent = ({
  stores,
  userEmail,
  onCreate,
}: {
  stores: Array<{ id: string; name: string; label: string; active: boolean }>;
  userEmail?: string | null;
  onCreate?: () => void;
}) => {
  const [editingStore, setEditingStore] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleStoreClick = (storeId: string, isActive: boolean) => {
    if (!isActive) {
      setActiveStore(storeId);
      const storeName = stores.find((store) => store.id === storeId)?.name ?? "Loja ativa";
      veloToast.success(`${storeName} selecionada com sucesso.`);
    }
  };

  const handleEditStart = (storeId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingStore(storeId);
    setEditName(currentName);
  };

  const handleEditSave = (storeId: string) => {
    if (editName.trim()) {
      const nextName = editName.trim();
      updateStoreName(storeId, nextName);
      veloToast.success("Loja atualizada com sucesso.");
    }
    setEditingStore(null);
    setEditName("");
  };

  const handleEditCancel = () => {
    setEditingStore(null);
    setEditName("");
  };

  const handleDelete = (storeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const storeName = stores.find((store) => store.id === storeId)?.name ?? "Loja";
    veloToast.info(`Excluir ${storeName}?`, {
      action: {
        label: "Excluir",
        onClick: () => {
          deleteStore(storeId);
          veloToast.success("Loja excluída com sucesso.");
        },
      },
      duration: 5000,
    });
  };

  return (
    <div className="flex flex-col">
      <div className="px-2 pb-2 pt-1">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A8FA3]">Lojas</p>
        {userEmail && <p className="mt-0.5 truncate text-[12px] text-[#8A8FA3]">{userEmail}</p>}
      </div>

      <div className="flex flex-col gap-1">
        {stores.length > 0 ? (
          stores.map((store) => (
            <div
              key={store.id}
              className={cn(
                "flex w-full items-center gap-2 rounded-[10px] px-2 py-2.5 text-left transition-colors duration-150",
                store.active ? "bg-[#F4F4F4]" : "hover:bg-[#F9F9F9] cursor-pointer"
              )}
              onClick={() => handleStoreClick(store.id, store.active)}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white text-[#6B7280] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]">
                <Store size={16} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                {editingStore === store.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleEditSave(store.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleEditSave(store.id);
                      if (e.key === "Escape") handleEditCancel();
                    }}
                    className="block w-full truncate text-[14px] font-medium leading-[18px] text-[#111111] bg-white border border-[#888888] rounded px-1 outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="block truncate text-[14px] font-medium leading-[18px] text-[#111111]">{store.name}</span>
                )}
                <span className="block truncate text-[12px] leading-[16px] text-[#8A8FA3]">{store.label}</span>
              </div>
              <div className="flex items-center gap-1">
                {store.active && <Check size={15} strokeWidth={1.8} className="shrink-0 text-[#111111]" />}
                <button
                  onClick={(e) => handleEditStart(store.id, store.name, e)}
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#E5E5E5] transition-colors"
                  title="Editar nome"
                >
                  <Edit2 size={12} strokeWidth={1.8} className="text-[#6B7280]" />
                </button>
                {stores.length > 1 && (
                  <button
                    onClick={(e) => handleDelete(store.id, e)}
                    className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#F3F4F6] transition-colors"
                    title="Excluir loja"
                  >
                    <Trash2 size={12} strokeWidth={1.8} className="text-[#374151]" />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[10px] bg-[#F8FAFC] px-3 py-3 text-[13px] leading-[18px] text-[#697386]">
            Nenhuma loja criada ainda.
          </div>
        )}
      </div>

      <div className="my-2 h-px bg-[#E6EAF0]" />

      <button
        type="button"
        onClick={onCreate}
        disabled={!onCreate}
        className="flex h-10 w-full items-center gap-2 rounded-[10px] px-2 text-left text-[14px] font-medium text-[#111111] transition-colors duration-150 hover:bg-[#F9F9F9] disabled:cursor-not-allowed disabled:text-[#A0A7B5] disabled:hover:bg-transparent"
      >
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-white", onCreate ? "bg-[#111111]" : "bg-[#D1D5DB]")}>
          <Plus size={15} strokeWidth={2} />
        </span>
        {onCreate ? "Criar outra loja" : "Limite de 2 lojas atingido"}
      </button>
    </div>
  );
};

const SidebarSearch = ({ collapsed }: { collapsed: boolean }) => {
  if (collapsed) {
    return (
      <div className="px-2">
        <button
          type="button"
          className="flex h-8 w-full items-center justify-center rounded-[10px] bg-transparent text-[#9CA3AF] transition-all duration-300 ease-out hover:bg-white/60"
          title="Buscar"
        >
          <Search size={16} strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <div className="px-4">
      <div className="group flex h-[36px] items-center gap-2 rounded-full bg-black/[0.025] px-3.5 border border-black/[0.04] transition-all duration-300 ease-out focus-within:bg-black/[0.035] focus-within:border-black/[0.08]">
        <Search size={15} strokeWidth={1.5} className="shrink-0 text-[#9CA3AF]" />
        <span
          className="min-w-0 flex-1 truncate text-[13px] leading-[18px] text-[#8B95A5]"
          style={{ fontFamily: sidebarFont, fontWeight: 400, letterSpacing: "-0.012em" }}
        >
          Buscar...
        </span>
        <span className="rounded-[6px] bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-medium leading-none text-[#8B95A5]">
          ⌘F
        </span>
      </div>
    </div>
  );
};

const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <div
    onClick={onChange}
    className={cn(
      "relative shrink-0 cursor-pointer rounded-full transition-colors duration-200",
      checked ? "bg-[#111111]" : "bg-[#D1D5DB]"
    )}
    style={{ height: "24px", width: "42px" }}
  >
    <div
      className={cn(
        "absolute top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200",
        checked ? "translate-x-[20px]" : "translate-x-0.5"
      )}
      style={{ height: "20px", width: "20px" }}
    />
  </div>
);

// ── User Footer Dropdown ────────────────────────────────────────────────────────

interface UserFooterProps {
  nome: string;
  email?: string | null;
  foto: string | null;
  iniciais: string;
  collapsed: boolean;
  onLogout: () => void;
}

const UserAvatar = ({
  foto,
  email,
  iniciais,
  size,
  background,
}: {
  foto: string | null;
  email?: string | null;
  iniciais: string;
  size: number;
  background: string;
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [foto]);

  const src = !imgError ? foto : null;
  const fallbackInitial = (email?.trim()?.charAt(0) || iniciais?.charAt(0) || "V").toUpperCase();
  const fallbackBackground = "linear-gradient(180deg, #B7B7B9 0%, #444448 100%)";

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: src ? background : fallbackBackground,
        flexShrink: 0,
      }}
    >
      {src ? (
        <img
          src={src}
          alt="avatar"
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          style={{
            fontFamily: sidebarFont,
            fontSize: size >= 38 ? "18px" : "16px",
            fontWeight: 600,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          {fallbackInitial}
        </span>
      )}
    </span>
  );
};

const SidebarAccentStar = ({ color = "currentColor", size = 16 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M8 1.7L8.95 5.05L12.3 6L8.95 6.95L8 10.3L7.05 6.95L3.7 6L7.05 5.05L8 1.7Z" stroke={color} strokeWidth="1.35" strokeLinejoin="round" />
    <path d="M12.2 9.4L12.62 10.78L14 11.2L12.62 11.62L12.2 13L11.78 11.62L10.4 11.2L11.78 10.78L12.2 9.4Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const SidebarBoostCard = ({
  variant = "white",
  onUpgrade,
}: {
  variant?: "white" | "glass";
  onUpgrade?: () => void;
}) => {
  const button = (
    <button
      type="button"
      onClick={onUpgrade}
      className="group relative mt-4 flex h-[50px] w-full items-center justify-center overflow-hidden rounded-[22px] border border-black/80 bg-[linear-gradient(145deg,#303033_0%,#111113_48%,#050505_100%)] text-[15px] font-semibold tracking-[-0.025em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_16px_30px_rgba(0,0,0,0.20)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_20px_36px_rgba(0,0,0,0.24)]"
    >
      <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/20" />
      <span className="pointer-events-none absolute inset-0 opacity-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.015)_24%,rgba(255,255,255,0)_48%)]" />
      <span className="relative z-10">Upgrade para Pro</span>
    </button>
  );

  if (variant === "glass") {
    return (
      <div 
        className="mt-4 rounded-[20px] px-4 py-4 backdrop-blur-xl"
        style={{
          background: "rgba(24, 24, 26, 0.98)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "none",
        }}
      >
        <div className="flex items-start gap-2.5">
          <div className="pt-0.5 text-white/90">
            <SidebarAccentStar color="currentColor" size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold tracking-[-0.02em] text-white">Impulsione com IA</div>
            <div className="mt-1 text-[12.5px] leading-[18px] text-white/48">
              Insights e ferramentas que economizam horas.
            </div>
          </div>
        </div>
        {button}
      </div>
    );
  }

  return (
    <div 
      className="mt-4 overflow-hidden rounded-[20px] px-4 py-4"
      style={{
        background: "rgba(0, 0, 0, 0.015)",
        border: "1px solid rgba(0, 0, 0, 0.03)",
        boxShadow: "none",
      }}
    >
      <div className="flex items-start gap-3">
        <div 
          className="grid h-9 w-9 place-items-center rounded-[12px] bg-white text-[#111111]"
          style={{
            border: "1px solid rgba(0, 0, 0, 0.04)",
            boxShadow: "none",
          }}
        >
          <SidebarAccentStar color="currentColor" size={16} />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold tracking-[-0.03em] text-[#121826]">Impulsione com IA</div>
          <div className="mt-1 max-w-[220px] text-[12.5px] leading-[17px] text-[#70798A]">
            Insights e ferramentas que economizam horas.
          </div>
        </div>
      </div>
      {button}
    </div>
  );
};

const UserFooter = ({
  nome,
  email,
  foto,
  iniciais,
  collapsed,
  onLogout,
  variant = "white",
}: UserFooterProps & { variant?: "white" | "glass" }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isGlass = variant === "glass";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (collapsed) {
    return (
      <div className="relative shrink-0 px-0" style={{ paddingTop: "8px", paddingBottom: "14px" }}>
        <div className="flex items-center justify-center">
          <UserAvatar
            foto={foto}
            email={email}
            iniciais={iniciais}
            size={36}
            background="#111111"
          />
        </div>
        <div className="mt-2 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => navigate("/dashboard/configuracoes")}
            className="flex h-8 w-8 items-center justify-center rounded-[14px] border border-transparent transition-all duration-300 ease-out hover:border-[rgba(255,255,255,0.54)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.42)_0%,rgba(243,244,246,0.58)_100%)]"
            title="Configurações"
          >
            <Settings size={17} strokeWidth={1.65} className="text-[#888888]" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex h-8 w-8 items-center justify-center rounded-[14px] border border-transparent transition-all duration-300 ease-out hover:border-[rgba(255,255,255,0.54)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.42)_0%,rgba(243,244,246,0.58)_100%)]"
            title="Sair"
          >
            <LogOut size={17} strokeWidth={1.65} className="text-[#888888]" />
          </button>
        </div>
      </div>
    );
  }

  const closeMenu = () => setIsOpen(false);

  return (
    <div ref={containerRef} className="relative z-10 shrink-0 px-4 pb-5 pt-0">
      {isOpen && !isGlass && (
        <div className="absolute bottom-[calc(100%+12px)] left-4 right-4 z-50 rounded-[30px] border border-white/85 bg-[linear-gradient(145deg,rgba(255,255,255,0.92)_0%,rgba(244,246,250,0.86)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_26px_54px_rgba(15,23,42,0.13)] backdrop-blur-2xl">
          <div className="rounded-[20px] border border-[rgba(255,255,255,0.8)] bg-[linear-gradient(180deg,rgba(255,255,255,0.62)_0%,rgba(243,244,246,0.78)_100%)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-[13.5px] font-semibold tracking-[-0.02em] text-[#0f172a]"
                  style={{ fontFamily: sidebarFont }}
                >
                  {nome || "Usuário"}
                </div>
                {email && (
                  <div
                    className="truncate pt-0.5 text-[11.5px] text-[#6F7787]"
                    style={{ fontFamily: sidebarFont }}
                  >
                    {email}
                  </div>
                )}
              </div>
              <UserAvatar
                foto={foto}
                email={email}
                iniciais={iniciais}
                size={42}
                background="linear-gradient(180deg,#161616_0%,#050505_100%)"
              />
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <button
              type="button"
              onClick={() => {
                navigate("/dashboard/configuracoes");
                closeMenu();
              }}
              className="flex h-[44px] w-full items-center gap-3 rounded-[18px] border border-[rgba(255,255,255,0.74)] bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(243,244,246,0.92)_100%)] px-4 text-left text-[14px] font-medium text-[#0f172a] shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_10px_24px_rgba(15,23,42,0.05)]"
              style={{ fontFamily: sidebarFont, letterSpacing: "-0.018em" }}
            >
              <Settings size={16} strokeWidth={1.9} className="text-[#0f172a]" />
              <span>Perfil</span>
            </button>

            <button
              type="button"
              onClick={() => {
                navigate("/docs");
                closeMenu();
              }}
              className="flex h-[44px] w-full items-center gap-3 rounded-[18px] border border-transparent px-4 text-left text-[14px] font-medium text-[#172033] transition-all duration-300 hover:border-[rgba(255,255,255,0.62)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.5)_0%,rgba(243,244,246,0.7)_100%)]"
              style={{ fontFamily: sidebarFont, letterSpacing: "-0.018em" }}
            >
              <Users size={16} strokeWidth={1.9} className="text-[#172033]" />
              <span className="flex-1">Comunidade</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-white/75 text-[#61616A] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <Plus size={13} strokeWidth={2} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                navigate("/checkout");
                closeMenu();
              }}
              className="flex h-[44px] w-full items-center gap-3 rounded-[18px] border border-transparent px-4 text-left text-[14px] font-medium text-[#172033] transition-all duration-300 hover:border-[rgba(255,255,255,0.62)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.5)_0%,rgba(243,244,246,0.7)_100%)]"
              style={{ fontFamily: sidebarFont, letterSpacing: "-0.018em" }}
            >
              <CreditCard size={16} strokeWidth={1.9} className="text-[#172033]" />
              <span className="flex-1">Assinatura</span>
              <span className="rounded-full bg-[#89F17F] px-2.5 py-1 text-[11px] font-semibold leading-none text-[#0B4611]">
                PRO
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                navigate("/dashboard/configuracoes");
                closeMenu();
              }}
              className="flex h-[44px] w-full items-center gap-3 rounded-[18px] border border-transparent px-4 text-left text-[14px] font-medium text-[#172033] transition-all duration-300 hover:border-[rgba(255,255,255,0.62)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.5)_0%,rgba(243,244,246,0.7)_100%)]"
              style={{ fontFamily: sidebarFont, letterSpacing: "-0.018em" }}
            >
              <Settings size={16} strokeWidth={1.9} className="text-[#172033]" />
              <span>Configurações</span>
            </button>
          </div>

          <div className="my-3 h-px bg-[rgba(214,221,232,0.9)]" />

          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                navigate("/docs");
                closeMenu();
              }}
              className="flex h-[42px] w-full items-center gap-3 rounded-[18px] border border-transparent px-4 text-left text-[14px] font-medium text-[#172033] transition-all duration-300 hover:border-[rgba(255,255,255,0.62)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.5)_0%,rgba(243,244,246,0.7)_100%)]"
              style={{ fontFamily: sidebarFont, letterSpacing: "-0.018em" }}
            >
              <MessageCircle size={16} strokeWidth={1.9} className="text-[#172033]" />
              <span>Central de ajuda</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex h-[42px] w-full items-center gap-3 rounded-[18px] border border-transparent px-4 text-left text-[14px] font-medium text-[#172033] transition-all duration-300 hover:border-[rgba(255,255,255,0.62)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.5)_0%,rgba(243,244,246,0.7)_100%)]"
              style={{ fontFamily: sidebarFont, letterSpacing: "-0.018em" }}
            >
              <LogOut size={16} strokeWidth={1.9} className="text-[#172033]" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      )}

      <div
        className="overflow-hidden rounded-[20px]"
        style={{
          background: isGlass ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.01)",
          border: isGlass ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.03)",
          boxShadow: "none",
        }}
      >
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className={cn(
          "flex w-full items-center text-left transition-all duration-300",
          isGlass ? "hover:bg-[rgba(255,255,255,0.04)]" : "hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.36)_0%,rgba(243,244,246,0.52)_100%)]"
        )}
        style={{
          minHeight: "82px",
          gap: "12px",
          padding: "16px 18px",
          flexShrink: 0,
          overflow: "hidden"
        }}
      >
        <UserAvatar
          foto={foto}
          email={email}
          iniciais={iniciais}
          size={38}
          background={isGlass ? "#111111" : "linear-gradient(180deg,#161616_0%,#050505_100%)"}
        />
        <div className="min-w-0 flex-1">
          <div
            style={{
              fontFamily: sidebarFont,
              fontSize: "13.5px",
              fontWeight: 600,
              color: isGlass ? "#ffffff" : "#171717",
              lineHeight: "17px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {nome || "Velo"}
          </div>
          {email && (
            <div
              style={{
                fontFamily: sidebarFont,
                fontSize: "11.5px",
                fontWeight: 400,
                color: isGlass ? "rgba(255,255,255,0.46)" : "#6F6F78",
                lineHeight: "15px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
          >
            {email}
          </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-0.5 pr-0.5">
          <ChevronUp size={12} strokeWidth={2.1} className={cn(isGlass ? "text-[rgba(255,255,255,0.42)]" : "text-[#7D7D86]", "transition-transform duration-200", isOpen ? "" : "translate-y-[1px]")} />
          <ChevronDown size={12} strokeWidth={2.1} className={cn(isGlass ? "text-[rgba(255,255,255,0.42)]" : "text-[#7D7D86]", "transition-transform duration-200", isOpen ? "" : "-translate-y-[1px]")} />
        </div>
      </button>

      {isOpen && isGlass && (
        <>
          <div className={cn("h-px", isGlass ? "bg-[rgba(255,255,255,0.08)]" : "bg-[#ECECEF]")} />
          <div className="flex flex-col py-2">
            <button
              type="button"
              onClick={() => navigate("/dashboard/configuracoes")}
              className={cn(
                "flex h-[48px] w-full items-center gap-3 px-[16px] text-left text-[14px] font-medium transition-all duration-200",
                isGlass
                  ? "text-[rgba(255,255,255,0.9)] hover:bg-[rgba(255,255,255,0.04)]"
                  : "text-[#171717] hover:bg-[rgba(17,24,39,0.03)]"
              )}
            >
              <Settings size={18} strokeWidth={1.75} className={cn("shrink-0", isGlass ? "text-[rgba(255,255,255,0.46)]" : "text-[#7B7B84]")} />
              <span>Configurações</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className={cn(
                "flex h-[48px] w-full items-center gap-3 px-[16px] text-left text-[14px] font-medium transition-all duration-200",
                isGlass
                  ? "text-[rgba(255,255,255,0.9)] hover:bg-[rgba(255,255,255,0.04)]"
                  : "text-[#171717] hover:bg-[rgba(17,24,39,0.03)]"
              )}
            >
              <LogOut size={18} strokeWidth={1.75} className={cn("shrink-0", isGlass ? "text-[rgba(255,255,255,0.46)]" : "text-[#7B7B84]")} />
              <span>Sair</span>
            </button>
          </div>
        </>
      )}
      </div>
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { foto } = useProfile();
  const { user, signOut, role } = useAuth();
  const nome = user?.user_metadata?.full_name ?? user?.email ?? "Usuário";
  const metadataRole =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined) ??
    null;
  const emailRole = user?.email && ADMIN_EMAILS.has(user.email.toLowerCase()) ? "admin" : null;
  const emailAffiliateRole = user?.email && AFFILIATE_EMAILS.has(user.email.toLowerCase()) ? "affiliate" : null;

  const [collapsed, setCollapsed] = useState(false);
  const [resolvedRole, setResolvedRole] = useState<string | null>(emailRole ?? emailAffiliateRole ?? role ?? metadataRole);
  const [stores, setStores] = useState<VeloStore[]>(() => readUserStores());

  // Start Mode: controlado pelo plano real do usuário (não localStorage)
  const { isStartMode: startMode, hasActivePlan } = useStartMode();

  const [showStartModeModal, setShowStartModeModal] = useState(false);

  const toggleStartMode = () => {
    // Usuários gratuitos não podem desligar o Start Mode — mostrar modal explicativo
    if (!hasActivePlan) {
      setShowStartModeModal(true);
    }
    // Usuários pagos nunca chegam aqui pois startMode já é false para eles
  };

  useEffect(() => {
    setResolvedRole(emailRole ?? emailAffiliateRole ?? role ?? metadataRole);
  }, [emailAffiliateRole, emailRole, role, metadataRole]);

  useEffect(() => {
    const syncStores = () => setStores(readUserStores());
    syncStores();
    window.addEventListener(STORES_CHANGED_EVENT, syncStores);
    window.addEventListener("storage", syncStores);
    return () => {
      window.removeEventListener(STORES_CHANGED_EVENT, syncStores);
      window.removeEventListener("storage", syncStores);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || !isSupabaseEnabled) return;

    let cancelled = false;

    const resolveSidebarRole = async () => {
      const candidates = [emailRole, emailAffiliateRole, role, metadataRole].filter(Boolean) as string[];
      const roleClient = supabase as unknown as SidebarRoleClient;

      const [profileByUserId, userRole, affiliateRecord] = await Promise.allSettled([
        roleClient
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle(),
        roleClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle(),
        roleClient
          .from("affiliates")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (profileByUserId.status === "fulfilled" && profileByUserId.value?.data?.role) {
        candidates.push(profileByUserId.value.data.role);
      }

      if (userRole.status === "fulfilled" && userRole.value?.data?.role) {
        candidates.push(userRole.value.data.role);
      }
      if (affiliateRecord.status === "fulfilled" && affiliateRecord.value?.data?.user_id) {
        candidates.push("affiliate");
      }

      const nextRole =
        candidates.includes("admin") ? "admin" :
        candidates.includes("affiliate") ? "affiliate" :
        candidates.includes("influencer") ? "influencer" :
        candidates[0] ?? "user";

      if (!cancelled) setResolvedRole(nextRole);
    };

    void resolveSidebarRole();

    return () => {
      cancelled = true;
    };
  }, [user, emailAffiliateRole, emailRole, role, metadataRole]);

  const isAdmin = resolvedRole === "admin";
  const canAccessCommissions = resolvedRole === "influencer" || resolvedRole === "affiliate" || resolvedRole === "admin";

  // Track which groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    nav.forEach((g) => {
      if (g.kind === "group") {
        const activeByPath = (to: string) =>
          to === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(to);
        init[g.label] = Boolean(g.defaultOpen || g.items.some((i) => activeByPath(i.to)));
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
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const isLinkActive = (to: string) => {
    const cleanPath = location.pathname.replace(/\/$/, "");
    const cleanTo = to.replace(/\/$/, "");
    return cleanTo === "/dashboard"
      ? cleanPath === "/dashboard"
      : cleanPath.startsWith(cleanTo);
  };

  const isGroupActive = (items: SubItem[]) =>
    items.some((i) => isLinkActive(i.to));

  return (
    <nav
      className={cn(
        "relative flex shrink-0 flex-col text-foreground transition-[width] duration-300 ease-out",
        collapsed ? "w-[70px] min-w-[70px]" : "w-[292px] min-w-[292px]"
      )}
      style={{
        height: startMode ? "calc(100vh - 48px)" : "100vh",
        transition: "height 280ms ease, width 300ms ease-out",
        overflow: "hidden",
        background: "linear-gradient(180deg, rgba(250,251,253,0.94) 0%, rgba(243,245,249,0.88) 100%)",
        borderRight: "1px solid rgba(229,231,235,0.42)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        boxShadow: "18px 0 42px rgba(15,23,42,0.055)"
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-90px] top-[-80px] h-52 w-52 rounded-full bg-white/55 blur-3xl" />
        <div className="absolute bottom-28 right-[-90px] h-60 w-60 rounded-full bg-slate-200/28 blur-3xl" />
      </div>
      {/* ── Header: Logo mark + Colapsar ─────────────────────────────────── */}
      <div className={cn("relative z-10 flex shrink-0", collapsed ? "flex-col items-center gap-2 px-3 py-4" : "items-center justify-between px-5 pb-4 pt-5")}>
        {!collapsed ? (
          <>
            <Link to="/?home=1" className="flex items-center gap-2.5">
              <VeloMark size={28} />
              <span
                className="text-[25px] font-semibold leading-none tracking-[-0.065em] text-[#0b1020]"
                style={{ fontFamily: sidebarDisplayFont }}
              >
                Velo
              </span>
            </Link>
            <button
              onClick={() => setCollapsed(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-semibold leading-none text-[#657083] transition-all duration-300 ease-out hover:text-[#0F172A]"
              style={{
                background: "rgba(0, 0, 0, 0.03)",
                border: "none",
                outline: "none",
                boxShadow: "none",
              }}
              title="Colapsar"
            >
              «
            </button>
          </>
        ) : (
          <div className="flex w-full flex-col items-center gap-2">
            <Link to="/?home=1" className="flex items-center justify-center">
              <VeloMark size={28} />
            </Link>
            <button
              onClick={() => setCollapsed(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold leading-none text-[#657083] transition-all duration-300 ease-out hover:text-[#0F172A]"
              style={{
                background: "rgba(0, 0, 0, 0.03)",
                border: "none",
                outline: "none",
                boxShadow: "none",
              }}
              title="Expandir"
            >
              »
            </button>
          </div>
        )}
      </div>

      <div className="relative z-10 mt-1">
        <SidebarSearch collapsed={collapsed} />
      </div>

      {/* ── Nav items ────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative z-10 flex flex-1 flex-col overflow-y-auto",
          collapsed ? "items-center gap-2 pt-2 px-0" : "gap-2.5 px-4"
        )}
        style={!collapsed ? { paddingTop: "14px", paddingBottom: "10px", minHeight: 0 } : { paddingTop: "12px", minHeight: 0 }}
      >
        {!collapsed && (
          <div
            className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase text-[#8A8FA3]/60"
            style={{ fontFamily: sidebarFont, letterSpacing: "0.15em" }}
          >
            Menu
          </div>
        )}
        <LayoutGroup id="sidebar-menu-nav">
        {nav.map((item) => {
          if (item.kind === "link") {
            const active = isLinkActive(item.to);
            return (
              <div key={item.to} style={{ flexShrink: 0, display: "flex", flexDirection: "column" }}>
                <NavLinkRow item={item} active={active} collapsed={collapsed} animatedActive={!collapsed} />
              </div>
            );
          }

          const isOpen = openGroups[item.label] ?? false;
          const groupActiveCompact = collapsed && isGroupActive(item.items);

          return (
            <div key={item.label} style={{ flexShrink: 0, display: "flex", flexDirection: "column" }}>
              <NavGroupRow
                item={item}
                isOpen={isOpen}
                collapsed={collapsed}
                groupActiveCompact={groupActiveCompact}
                onToggle={() => toggleGroup(item.label)}
                pathname={location.pathname}
              />
              {!collapsed && isOpen && item.items.length > 0 && (
                <div style={{ marginTop: "3px", display: "flex", flexDirection: "column", gap: "2px", paddingLeft: "0", overflow: "hidden" }}>
                  {item.items.map((sub) => (
                    <NavSubRow key={sub.to} sub={sub} subActive={isLinkActive(sub.to)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {!collapsed && (
          <>
            <div
              className="px-3 pt-4 pb-0.5 text-[10px] font-semibold uppercase text-[#8A8FA3]/60"
              style={{ fontFamily: sidebarFont, letterSpacing: "0.15em" }}
            >
              Outros
            </div>
            {otherNav.map((item) => {
              if (item.kind === "link") {
                const active = isLinkActive(item.to);
                return (
                  <div key={item.to} style={{ flexShrink: 0, display: "flex", flexDirection: "column" }}>
                    <NavLinkRow item={item} active={active} collapsed={collapsed} animatedActive={!collapsed} />
                  </div>
                );
              }
              return null;
            })}
          </>
        )}
        </LayoutGroup>

      </div>
      {collapsed && (
        <div className="flex flex-col items-center gap-1.5 px-0 pb-1" style={{ flexShrink: 0 }}>
          {/* Start Mode: só aparece para usuários gratuitos */}
          {!hasActivePlan && (
          <FooterButtonRow icon={Code2} label="Modo inicial" color="#888888" collapsed={collapsed} onClick={toggleStartMode} />
          )}
        </div>
      )}

      {!collapsed && <div className="relative z-10 flex flex-col" style={{ paddingLeft: "16px", paddingRight: "16px", paddingBottom: "0", gap: "3px", flexShrink: 0 }}>
        {/* Start Mode: só aparece para usuários gratuitos */}
        {!hasActivePlan && (
          <FooterButtonRow icon={Code2} label="Modo inicial" color="#888888" collapsed={collapsed} onClick={toggleStartMode}>
            {/* Toggle sempre ligado para gratuitos — clicar abre modal explicativo */}
            <ToggleSwitch checked={true} onChange={toggleStartMode} />
          </FooterButtonRow>
        )}
      </div>}

      {!collapsed && (
        <div className="relative z-10 shrink-0 px-4 pt-1">
          <SidebarBoostCard variant="white" onUpgrade={() => navigate("/checkout")} />
        </div>
      )}

      {/* Divisória 3 - Acima da conta do usuário */}
      <div className={cn("relative z-10 shrink-0", collapsed ? "px-2" : "px-4")} style={{ margin: "10px 0 8px" }}>
        <div className="h-[1px] w-full bg-white/70 shadow-[0_1px_0_rgba(15,23,42,0.05)]" />
      </div>

      {/* ── Footer - Conta do Usuário ───────────────────────────────────────────────────────── */}
      <UserFooter
        nome={nome}
        email={user?.email}
        foto={foto}
        iniciais={iniciais}
        collapsed={collapsed}
        onLogout={handleSignOut}
        variant="white"
      />

      {/* Modal Start Mode */}
      <StartModeModal
        isOpen={showStartModeModal}
        onClose={() => setShowStartModeModal(false)}
      />
    </nav>
  );
};

export default DashboardSidebar;
