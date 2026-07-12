import { useState } from "react";
import { ChevronDown, LayoutDashboard, Package, ShoppingBag, ShoppingCart, Video, MessageSquare, DollarSign, CreditCard, HelpCircle, Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { VeloLogo } from "@/components/VeloLogo";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminEmail } from "@/lib/adminAccess";

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  submenu?: { id: string; label: string; path: string }[];
}

const sidebarItems: SidebarItem[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} />, path: "/dashboard" },
  { 
    id: "store", 
    label: "Sua Loja", 
    icon: <ShoppingBag size={20} />, 
    submenu: [
      { id: "produtos", label: "Produtos", path: "/dashboard/produtos" },
      { id: "publicacoes", label: "Publicações", path: "/dashboard/publicacoes" },
      { id: "pedidos", label: "Pedidos", path: "/dashboard/pedidos" },
      { id: "videos", label: "Vídeos", path: "/dashboard/criar-video" },
      { id: "chat", label: "Chat", path: "/dashboard/chat-fornecedores" },
    ]
  },
  { 
    id: "finance", 
    label: "Financeiro", 
    icon: <DollarSign size={20} />, 
    submenu: [
      { id: "saldos", label: "Saldos", path: "/dashboard/saldos" },
      { id: "transacoes", label: "Transações", path: "/dashboard/transacoes" },
    ]
  },
];

export function Sidebar() {
  const location = useLocation();
  const { user, role } = useAuth();
  const metadataRole =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined) ??
    null;
  const isAdmin = role === "admin" || metadataRole === "admin" || isAdminEmail(user?.email);
  const [expandedItems, setExpandedItems] = useState<string[]>(["store", "finance"]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path;
  };

  const isParentActive = (submenu?: { path: string }[]) => {
    if (!submenu) return false;
    return submenu.some(item => location.pathname === item.path);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col overflow-y-auto border-r border-slate-200 bg-white">
      <div className="flex-1 p-5">
        {/* Logo */}
        <div className="mb-7">
          <VeloLogo size="md" variant="dark" />
        </div>

        {/* Store Info */}
        <div className="mb-6 border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-slate-900">Minha Loja</p>
          <p className="mt-1 text-xs text-slate-500">Vendedor</p>
        </div>

        {/* Menu Items */}
        <nav className="space-y-1.5">
          {sidebarItems.map((item) => (
            <div key={item.id}>
              {item.path ? (
                <Link
                  to={item.path}
                  className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 transition-colors ${
                    isActive(item.path)
                      ? "bg-slate-900 text-white shadow-[0_10px_18px_rgba(15,23,42,0.16)]"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span>{item.icon}</span>
                    <span className="text-[13px] font-medium">{item.label}</span>
                  </div>
                </Link>
              ) : (
                <button
                  onClick={() => item.submenu && toggleExpand(item.id)}
                  className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 transition-colors ${
                    isParentActive(item.submenu)
                      ? "bg-slate-900 text-white shadow-[0_10px_18px_rgba(15,23,42,0.16)]"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span>{item.icon}</span>
                    <span className="text-[13px] font-medium">{item.label}</span>
                  </div>
                  {item.submenu && (
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${
                        expandedItems.includes(item.id) ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>
              )}

              {/* Submenu */}
              {item.submenu && expandedItems.includes(item.id) && (
                <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-4">
                  {item.submenu.map((subitem) => (
                    <Link
                      key={subitem.id}
                      to={subitem.path}
                      className={`block rounded-xl px-3 py-2 text-[13px] transition-colors ${
                        isActive(subitem.path)
                          ? "bg-slate-100 font-medium text-slate-900"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {subitem.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="space-y-3 border-t border-slate-200 p-5">
        {isAdmin && (
          <Link
            to="/comecar"
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100"
            title="Acesso temporário — visível apenas para admins"
          >
            <Sparkles size={18} />
            <span>Editar minha loja (beta)</span>
          </Link>
        )}
        <button className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100">
          <span>Start Mode</span>
          <div className="h-5 w-10 rounded-full bg-slate-300"></div>
        </button>
        <button className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100">
          <HelpCircle size={18} />
          <span>Suporte</span>
        </button>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-slate-300"></div>
          <div>
            <p className="text-sm font-medium text-slate-900">Usuário</p>
            <p className="text-xs text-slate-500">Vendedor</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
