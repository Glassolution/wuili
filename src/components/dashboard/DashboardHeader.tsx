import { useLocation } from "react-router-dom";
import NotificacoesPopover from "@/components/dashboard/NotificacoesPopover";
import {
  ArrowLeftRight,
  BarChart2,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Package,
  Percent,
  ShoppingCart,
  Video,
  Wallet,
  type LucideIcon,
} from "lucide-react";

type RouteMeta = {
  test: (pathname: string) => boolean;
  title: string;
  icon: LucideIcon;
};

const routes: RouteMeta[] = [
  { test: (p) => p === "/dashboard", title: "Dashboard", icon: BarChart2 },
  { test: (p) => p.startsWith("/dashboard/catalogo"), title: "Catálogo", icon: Package },
  { test: (p) => p.startsWith("/dashboard/saldos"), title: "Saldos", icon: Wallet },
  { test: (p) => p.startsWith("/dashboard/transacoes"), title: "Transações", icon: ArrowLeftRight },
  { test: (p) => p.startsWith("/dashboard/pagamentos"), title: "Pagamentos", icon: CreditCard },
  { test: (p) => p.startsWith("/dashboard/produtos"), title: "Produtos", icon: Package },
  { test: (p) => p.startsWith("/dashboard/publicacoes"), title: "Publicações", icon: FileText },
  { test: (p) => p.startsWith("/dashboard/pedidos"), title: "Pedidos", icon: ShoppingCart },
  { test: (p) => p.startsWith("/dashboard/criar-video"), title: "Criar Vídeos", icon: Video },
  { test: (p) => p.startsWith("/dashboard/chat-fornecedores"), title: "Chat", icon: MessageSquare },
  { test: (p) => p.startsWith("/dashboard/comissoes"), title: "Comissões", icon: Percent },
  { test: (p) => p.startsWith("/dashboard/relatorios"), title: "Relatórios", icon: BarChart2 },
];

const DashboardHeader = () => {
  const location = useLocation();
  const meta = routes.find((r) => r.test(location.pathname)) ?? routes[0];
  const Icon = meta.icon;
  const isDashboard = meta.title === "Dashboard";
  const shouldHideHeader =
    location.pathname === "/dashboard" ||
    location.pathname === "/colecoes" ||
    location.pathname.startsWith("/dashboard/catalogo");

  if (shouldHideHeader) {
    return null;
  }

  return (
    <header 
      className="sticky top-0 z-30 flex justify-between" 
      style={{ 
        backgroundColor: "#F4F4F5",
        height: "64px",
        paddingLeft: "24px",
        paddingRight: "48px",
        paddingTop: "20px",
        alignItems: "flex-start",
        boxSizing: "border-box"
      }}
    >
      <div className="flex min-w-0 items-center" style={{ gap: "8px" }}>
        <Icon
          size={isDashboard ? 20 : 16}
          strokeWidth={isDashboard ? 1.5 : 1.8}
          className="shrink-0"
          style={{ color: "#8A8FA3" }}
        />
        <span 
          className="truncate" 
          style={{ 
            fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: "16px", 
            fontWeight: 500, 
            lineHeight: "20px", 
            color: "#111111",
            letterSpacing: "-0.02em"
          }}
        >
          {meta.title}
        </span>
      </div>

      <div className="shrink-0 [&_svg]:!h-[18px] [&_svg]:!w-[18px]">
        <NotificacoesPopover />
      </div>
    </header>
  );
};

export default DashboardHeader;
