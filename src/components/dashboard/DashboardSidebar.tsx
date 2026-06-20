import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { cn } from "@/lib/utils";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import {
  Home,
  List,
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
  Sparkles,
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
const sidebarFont = '"Inter", "Helvetica Neue", Arial, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

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
}: {
  item: Extract<NavGroup, { kind: "link" }>;
  active: boolean;
  collapsed: boolean;
}) => (
  <Link
    to={item.to}
    className={cn(
      "sidebar-item relative flex items-center transition-all duration-200",
      collapsed ? "group w-full h-[34px] justify-center p-0 m-0" : "px-3",
      active && !collapsed ? "bg-[rgba(0,0,0,0.06)] backdrop-blur-md border-[rgba(0,0,0,0.06)]" : "border-transparent",
      !active && !collapsed ? "hover:bg-[rgba(0,0,0,0.04)] hover:backdrop-blur-md" : ""
    )}
    title={collapsed ? item.label : undefined}
    style={{
      fontFamily: collapsed ? undefined : sidebarFont,
      fontSize: collapsed ? undefined : "14px",
      fontWeight: collapsed ? undefined : 500,
      lineHeight: collapsed ? undefined : "20px",
      letterSpacing: collapsed ? undefined : "0",
      height: collapsed ? undefined : "36px",
      gap: collapsed ? undefined : "10px",
      borderRadius: collapsed ? undefined : "8px",
      flexShrink: 0,
      borderWidth: collapsed ? undefined : 1,
      borderStyle: collapsed ? undefined : "solid",
    }}
  >
    {collapsed ? (
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-[8px] transition-all duration-200", active ? "bg-[rgba(0,0,0,0.06)] backdrop-blur-md" : "group-hover:bg-[rgba(0,0,0,0.04)] group-hover:backdrop-blur-md")}>
        <IconSpan icon={item.icon} size={18} strokeWidth={1.65} color={active ? "#000000" : "#6B7280"} />
      </div>
    ) : (
      <>
        <IconSpan icon={item.icon} size={18} strokeWidth={1.65} color={active ? "#000000" : "#6B7280"} />
        <span style={{ color: active ? "#111827" : "#111827" }}>{item.label}</span>
      </>
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
      "sidebar-item w-full relative flex items-center transition-all duration-200",
      collapsed ? "group h-[34px] justify-center p-0 m-0" : "px-3",
      groupActiveCompact && !collapsed ? "bg-[rgba(0,0,0,0.06)] backdrop-blur-md border-[rgba(0,0,0,0.06)]" : "border-transparent",
      !groupActiveCompact && !collapsed ? "hover:bg-[rgba(0,0,0,0.04)] hover:backdrop-blur-md" : ""
    )}
    title={collapsed ? item.label : undefined}
    style={{
      fontFamily: collapsed ? undefined : sidebarFont,
      fontSize: collapsed ? undefined : "14px",
      fontWeight: collapsed ? undefined : 500,
      lineHeight: collapsed ? undefined : "20px",
      letterSpacing: collapsed ? undefined : "0",
      textTransform: collapsed ? undefined : "none",
      height: collapsed ? undefined : "36px",
      gap: collapsed ? undefined : "10px",
      borderRadius: collapsed ? undefined : "8px",
      flexShrink: 0,
      background: (groupActiveCompact && !collapsed) ? undefined : "transparent",
      borderWidth: collapsed ? undefined : 1,
      borderStyle: collapsed ? undefined : "solid",
      cursor: "pointer",
    }}
  >
    {collapsed ? (
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-[8px] transition-all duration-200", groupActiveCompact ? "bg-[rgba(0,0,0,0.06)] backdrop-blur-md" : "group-hover:bg-[rgba(0,0,0,0.04)] group-hover:backdrop-blur-md")}>
        <IconSpan icon={item.icon} size={18} strokeWidth={1.65} color={groupActiveCompact ? "#000000" : "#6B7280"} />
      </div>
    ) : (
      <>
        <IconSpan icon={item.icon} size={18} strokeWidth={1.65} color="#6B7280" />
        <span className="flex-1 text-left" style={{ color: "#374151" }}>{item.label}</span>
        {item.trailing === "plus" ? (
          <Plus size={15} strokeWidth={1.8} className="shrink-0" style={{ color: "#6B7280" }} />
        ) : (
          <ChevronDown size={14} strokeWidth={1.8} className={cn("shrink-0 transition-transform duration-200", isOpen ? "rotate-180" : "rotate-0")} style={{ color: "#6B7280" }} />
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
      className={cn("sidebar-item relative flex items-center border transition-all duration-200", subActive ? "bg-[rgba(0,0,0,0.06)] backdrop-blur-md border-[rgba(0,0,0,0.06)]" : "border-transparent hover:bg-[rgba(0,0,0,0.04)] hover:backdrop-blur-md")}
      style={{ 
        fontFamily: sidebarFont, 
        fontSize: "13px", 
        fontWeight: 500, 
        lineHeight: "18px", 
        letterSpacing: "0", 
        height: "32px", 
        gap: "9px",
        paddingLeft: "36px",
        paddingRight: "12px",
        borderRadius: "8px",
        flexShrink: 0,
      }}
    >
      {SubIcon && <IconSpan icon={SubIcon} size={16} strokeWidth={1.65} color={subActive ? "#000000" : "#6B7280"} />}
      <span style={{ color: subActive ? "#111827" : "#111827" }}>{sub.label}</span>
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
      <Link to={to} className="sidebar-item group relative flex h-[34px] w-full items-center justify-center p-0 m-0 transition-all duration-150" title={label}>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-[8px] transition-all duration-150", active ? "bg-[rgba(0,0,0,0.06)] backdrop-blur-md" : "group-hover:bg-[rgba(0,0,0,0.04)] group-hover:backdrop-blur-md")}>
          <IconSpan icon={icon} size={17} strokeWidth={1.65} color={active ? "#000000" : "#6B7280"} />
        </div>
      </Link>
    );
  }
  return (
    <Link
      to={to}
      className={cn("sidebar-item relative flex items-center transition-all duration-150", active ? "bg-[rgba(0,0,0,0.06)] backdrop-blur-md" : "hover:bg-[rgba(0,0,0,0.04)] hover:backdrop-blur-md")}
      style={{ 
        fontFamily: sidebarFont, 
        fontSize: "13px", 
        fontWeight: 500, 
        lineHeight: "18px", 
        letterSpacing: "0",
        height: "34px",
        gap: "10px",
        paddingLeft: "12px",
        paddingRight: "12px",
        borderRadius: "8px"
      }}
    >
      <IconSpan icon={icon} size={17} strokeWidth={1.65} color={active ? "#000000" : "#6B7280"} />
      <span style={{ color: active ? "#111827" : "#111827" }}>{label}</span>
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
      <button type="button" onClick={onClick} className="sidebar-item w-full h-[34px] flex items-center justify-center p-0 m-0 rounded-[8px] transition-all hover:bg-[rgba(0,0,0,0.04)] hover:backdrop-blur-md" style={{ background: "transparent", border: "none", cursor: "pointer" }} title={label}>
        <IconSpan icon={icon} size={17} strokeWidth={1.65} color={color} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="sidebar-item relative flex w-full items-center transition-all duration-150 hover:bg-[rgba(0,0,0,0.04)] hover:backdrop-blur-md"
      style={{ 
        fontFamily: sidebarFont, 
        fontSize: "13px", 
        fontWeight: 500, 
        lineHeight: "18px", 
        letterSpacing: "0",
        height: "34px",
        gap: "10px",
        paddingLeft: "12px",
        paddingRight: "12px",
        borderRadius: "8px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
      }}
    >
      <IconSpan icon={icon} size={17} strokeWidth={1.65} color={color} />
      <span className="flex-1 text-left" style={{ color: "#111827" }}>{label}</span>
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
      <a href={href} target="_blank" rel="noopener noreferrer" className="sidebar-item w-full h-[34px] flex items-center justify-center rounded-[8px] p-0 m-0 transition-all hover:bg-[rgba(0,0,0,0.04)] hover:backdrop-blur-md" title={label}>
        <IconSpan icon={icon} size={17} strokeWidth={1.65} color={color} />
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="sidebar-item relative flex items-center transition-all duration-150 hover:bg-[rgba(0,0,0,0.04)] hover:backdrop-blur-md"
      style={{ 
        fontFamily: sidebarFont, 
        fontSize: "13px", 
        fontWeight: 500, 
        lineHeight: "18px", 
        letterSpacing: "0",
        height: "34px",
        gap: "10px",
        paddingLeft: "12px",
        paddingRight: "12px",
        borderRadius: "8px"
      }}
    >
      <IconSpan icon={icon} size={17} strokeWidth={1.65} color={color} />
      <span className="whitespace-nowrap" style={{ color: "#111827" }}>{label}</span>
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
  { kind: "link", to: "/dashboard/notifications", icon: List, label: "Notificações" },
  { kind: "link", to: "/dashboard/tasks", icon: Users, label: "Tarefas" },
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
    }
  };

  const handleEditStart = (storeId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingStore(storeId);
    setEditName(currentName);
  };

  const handleEditSave = (storeId: string) => {
    if (editName.trim()) {
      updateStoreName(storeId, editName.trim());
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
    if (confirm("Tem certeza que deseja excluir esta loja? Esta ação não pode ser desfeita.")) {
      deleteStore(storeId);
    }
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
          className="flex h-8 w-full items-center justify-center rounded-[8px] border border-[#e5e7eb] bg-white text-[#6B7280] transition-all duration-200 hover:bg-[rgba(0,0,0,0.04)] hover:backdrop-blur-md hover:border-[rgba(0,0,0,0.06)]"
          title="Buscar"
        >
          <Search size={17} strokeWidth={1.7} />
        </button>
      </div>
    );
  }

  return (
      <div className="px-3">
      <div className="group flex h-[36px] items-center gap-2 rounded-[8px] border border-[#E5E7EB] bg-white px-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:bg-[rgba(0,0,0,0.02)] hover:backdrop-blur-md hover:border-[rgba(0,0,0,0.08)] focus-within:bg-[rgba(0,0,0,0.02)] focus-within:backdrop-blur-md focus-within:border-[rgba(0,0,0,0.1)]">
        <Search size={16} strokeWidth={1.65} className="shrink-0 text-[#6B7280]" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-[17px] text-[#6B7280]">
          Buscar...
        </span>
        <div className="flex gap-1">
          <span className="rounded-[4px] bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#4B5563]">
            ⌘
          </span>
          <span className="rounded-[4px] bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#4B5563]">
            F
          </span>
        </div>
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

const UserFooter = ({ nome, email, foto, iniciais, collapsed, onLogout }: UserFooterProps) => {
  const navigate = useNavigate();

  if (collapsed) {
    return (
      <div className="relative shrink-0 px-0" style={{ paddingTop: "8px", paddingBottom: "14px" }}>
        <div className="flex items-center justify-center">
          <span 
            className="flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white"
            style={{ 
              width: "36px",
              height: "36px",
              backgroundColor: "#111111" 
            }}
          >
            {foto ? <img src={foto} alt="avatar" className="h-full w-full object-cover" /> : iniciais || "VL"}
          </span>
        </div>
        <div className="mt-2 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => navigate("/dashboard/configuracoes")}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] transition-all duration-200 hover:bg-[rgba(0,0,0,0.04)] hover:backdrop-blur-md"
            title="Configurações"
          >
            <Settings size={17} strokeWidth={1.65} className="text-[#888888]" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] transition-all duration-200 hover:bg-[rgba(0,0,0,0.04)] hover:backdrop-blur-md"
            title="Sair"
          >
            <LogOut size={17} strokeWidth={1.65} className="text-[#888888]" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative shrink-0 px-2.5 pb-2.5 pt-1">
      <div className="overflow-hidden rounded-[12px] border border-white/10 bg-gradient-to-b from-[#1c1c1c] to-[#141414] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <button
        type="button"
        onClick={() => navigate("/dashboard/perfil")}
        className="flex w-full items-center text-left transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)]"
        style={{
          minHeight: "48px",
          gap: "10px",
          padding: "8px 10px",
          flexShrink: 0,
          overflow: "hidden"
        }}
      >
        <span
          className="flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white"
          style={{
              width: "32px",
              height: "32px",
            backgroundColor: "#111111",
            flexShrink: 0
          }}
        >
          {foto ? <img src={foto} alt="avatar" className="h-full w-full object-cover" /> : iniciais || "VL"}
        </span>
        <div className="min-w-0 flex-1">
          <div
            style={{
              fontFamily: sidebarFont,
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              lineHeight: "16px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            FX {nome || "Velo"}
          </div>
          {email && (
            <div
              style={{
                fontFamily: sidebarFont,
                fontSize: "12px",
                fontWeight: 400,
                color: "rgba(255,255,255,0.5)",
                lineHeight: "14px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
          >
            {email}
          </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-0">
          <ChevronUp size={10} strokeWidth={2} className="text-[rgba(255,255,255,0.4)]" />
          <ChevronDown size={10} strokeWidth={2} className="text-[rgba(255,255,255,0.4)]" />
        </div>
      </button>

      <div className="h-px bg-[rgba(255,255,255,0.06)]" />
      <div className="flex flex-col py-1">
        <button
          type="button"
          onClick={() => navigate("/dashboard/configuracoes")}
          className="flex h-[36px] w-full items-center gap-2.5 px-3 text-left text-[14px] font-medium text-[rgba(255,255,255,0.85)] transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)]"
        >
          <Settings size={17} strokeWidth={1.65} className="shrink-0 text-[rgba(255,255,255,0.45)]" />
          <span>Configurações</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex h-[36px] w-full items-center gap-2.5 px-3 text-left text-[14px] font-medium text-[rgba(255,255,255,0.85)] transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)]"
        >
          <LogOut size={17} strokeWidth={1.65} className="shrink-0 text-[rgba(255,255,255,0.45)]" />
          <span>Sair</span>
        </button>
      </div>
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

      const [profileByUserId, userRole, affiliateRecord] = await Promise.allSettled([
        (supabase as any)
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle(),
        (supabase as any)
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle(),
        (supabase as any)
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
    items.some((i) => isLinkActive(i.to));

  return (
    <nav
      className={cn(
        "flex shrink-0 flex-col text-foreground transition-[width] duration-200 ease-out",
        collapsed ? "w-[60px] min-w-[60px]" : "w-[232px] min-w-[232px]"
      )}
      style={{
        height: startMode ? "calc(100vh - 48px)" : "100vh",
        transition: "height 280ms ease, width 200ms ease-out",
        overflow: "hidden",
        backgroundColor: "#ffffff",
        borderRight: "1px solid #E5E7EB"
      }}
    >
      {/* ── Header: Logo mark + Colapsar ─────────────────────────────────── */}
      <div className={cn("flex shrink-0", collapsed ? "flex-col items-center gap-2 px-2.5 py-3" : "items-center justify-between px-4 py-3")}>
        {!collapsed ? (
          <>
            <Link to="/?home=1" className="flex items-center gap-2.5">
              <VeloMark size={28} />
              <span className="text-[21px] font-bold leading-none tracking-[-0.045em] text-[#111827]">Velo</span>
            </Link>
            <button
              onClick={() => setCollapsed(true)}
              className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-[rgba(0,0,0,0.06)] bg-white text-[13px] font-semibold leading-none text-[#6B7280] transition-all duration-200 hover:bg-[rgba(0,0,0,0.04)] hover:backdrop-blur-md hover:text-[#111827]"
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
              className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-[rgba(0,0,0,0.06)] bg-white text-[13px] font-semibold leading-none text-[#6B7280] transition-all duration-200 hover:bg-[rgba(0,0,0,0.04)] hover:backdrop-blur-md hover:text-[#111827]"
              title="Expandir"
            >
              »
            </button>
          </div>
        )}
      </div>

      <div className="mt-2">
        <SidebarSearch collapsed={collapsed} />
      </div>

      {/* ── Nav items ────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-1 flex-col overflow-y-auto",
          collapsed ? "items-center gap-1 pt-2 px-0" : "gap-1 px-2.5"
        )}
        style={!collapsed ? { paddingTop: "12px", paddingBottom: "8px", minHeight: 0 } : { paddingTop: "12px", minHeight: 0 }}
      >
        {!collapsed && (
          <div className="px-1 pb-1 text-[11.5px] font-semibold leading-[15px] text-[#666666]">
            Menu
          </div>
        )}
        {nav.map((item) => {
          if (item.kind === "link") {
            const active = isLinkActive(item.to);
            return (
              <div key={item.to} style={{ flexShrink: 0, display: "flex", flexDirection: "column" }}>
                <NavLinkRow item={item} active={active} collapsed={collapsed} />
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
            <div className="px-1 pb-1 pt-4 text-[11.5px] font-semibold leading-[15px] text-[#666666]">
              OUTROS
            </div>
            {otherNav.map((item) => {
              if (item.kind === "link") {
                const active = isLinkActive(item.to);
                return (
                  <div key={item.to} style={{ flexShrink: 0, display: "flex", flexDirection: "column" }}>
                    <NavLinkRow item={item} active={active} collapsed={collapsed} />
                  </div>
                );
              }
              return null;
            })}
          </>
        )}

        {!collapsed && (
          <div className="mt-4 rounded-2xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] backdrop-blur-md p-3.5 transition-all duration-200 hover:bg-[rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2">
              <Sparkles size={14} strokeWidth={1.8} className="shrink-0 text-white" />
              <span className="text-[13px] font-semibold text-white">Impulsione com IA</span>
            </div>
            <div className="mt-1.5 text-[12px] leading-[16px] text-white/60">Receba insights inteligentes para crescer sua operação</div>
          </div>
        )}

      </div>
      {collapsed && (
        <div className="flex flex-col items-center gap-1.5 px-0 pb-1" style={{ flexShrink: 0 }}>
          {/* Start Mode: só aparece para usuários gratuitos */}
          {!hasActivePlan && (
          <FooterButtonRow icon={Code2} label="Modo inicial" color="#888888" collapsed={collapsed} onClick={toggleStartMode} />
          )}
        </div>
      )}

      {!collapsed && <div className="flex flex-col" style={{ paddingLeft: "10px", paddingRight: "10px", paddingBottom: "0", gap: "3px", flexShrink: 0 }}>
        {/* Start Mode: só aparece para usuários gratuitos */}
        {!hasActivePlan && (
          <FooterButtonRow icon={Code2} label="Modo inicial" color="#888888" collapsed={collapsed} onClick={toggleStartMode}>
            {/* Toggle sempre ligado para gratuitos — clicar abre modal explicativo */}
            <ToggleSwitch checked={true} onChange={toggleStartMode} />
          </FooterButtonRow>
        )}
      </div>}

      {/* Divisória 3 - Acima da conta do usuário */}
      <div className={cn("shrink-0", collapsed ? "px-2" : "px-2.5")} style={{ margin: "8px 0" }}>
        <div className="h-[1px] w-full" style={{ backgroundColor: "#E5E7EB" }} />
      </div>

      {/* ── Footer - Conta do Usuário ───────────────────────────────────────────────────────── */}
      <UserFooter
        nome={nome}
        email={user?.email}
        foto={foto}
        iniciais={iniciais}
        collapsed={collapsed}
        onLogout={handleSignOut}
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
