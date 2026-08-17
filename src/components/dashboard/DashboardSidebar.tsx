import { useEffect, useMemo, useRef, useState, type CSSProperties, type ElementType } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Archive, ChevronRight, GraduationCap, Image as ImageIcon, Copy, CreditCard, Gift, Grid2X2, Home, Info, Lightbulb, LogOut, MoreVertical, NotebookText, Settings2, ShieldCheck, ShoppingCart, Sparkles, Tag, TrendingUp, Trophy, UserRound, Users } from "lucide-react";
import ShopifyBagIcon from "@/components/icons/ShopifyBagIcon";
import TikTokIcon from "@/components/dashboard/TikTokIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { isSupabaseEnabled, supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";
import { AFFILIATE_APPLICATION_EVENT } from "@/pages/dashboard/AffiliateQuizPage";
import SearchPalette from "@/components/dashboard/SearchPalette";
import InviteFriendModal from "@/components/dashboard/InviteFriendModal";
import { PremiumActionButton } from "@/components/PremiumActionButton";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";

type NavItem = {
  id: string;
  label: string;
  icon: ElementType;
  to?: string;
  end?: boolean;
  dimmed?: boolean;
  children?: NavItem[];
};

const baseNavItems: NavItem[] = [
  { id: "inicio", label: "Início", icon: Home, to: "/dashboard", end: true },
  {
    // Categoria expansível (como "Products" da referência): agrupa catálogo,
    // páginas com IA e modelos de produto.
    id: "produtos",
    label: "Produtos",
    icon: Tag,
    children: [
      { id: "catalogo", label: "Catálogo", icon: ShoppingCart, to: "/dashboard/catalogo" },
      { id: "paginas-com-ia", label: "Páginas com IA", icon: NotebookText, to: "/dashboard/paginas-com-ia" },
      { id: "modelos", label: "Templates", icon: Grid2X2, to: "/dashboard/modelos" },
    ],
  },
  {
    // Categoria "Produtos vencedores" (troféu, como "Winning Products"):
    // agrupa as ferramentas para encontrar e apresentar produtos.
    id: "produtos-vencedores",
    label: "Produtos vencedores",
    icon: Trophy,
    children: [
      { id: "produtos-em-alta", label: "Produtos em Alta", icon: TrendingUp, to: "/dashboard/produtos-em-alta" },
    ],
  },
  { id: "publicacoes", label: "Publicações", icon: Archive, to: "/dashboard/publicacoes" },
  { id: "pedidos", label: "Pedidos", icon: Copy, to: "/dashboard/pedidos" },
  { id: "imagens-ia", label: "Imagens com IA", icon: ImageIcon, to: "/dashboard/imagens-ia" },
  { id: "tiktok", label: "TikTok", icon: TikTokIcon, to: "/dashboard/tiktok" },
  { id: "cursos-ecommerce", label: "Cursos Ecommerce", icon: GraduationCap, to: "/dashboard/cursos-ecommerce" },
];

// "Lojas": conectar/gerenciar lojas (Shopify, Mercado Livre) — leva à tela de
// integrações. Fora da navegação por enquanto: só administradores veem o item.
// A ROTA continua aberta de propósito — o callback do Mercado Pago devolve o
// usuário em /dashboard/integracoes, e bloqueá-la quebraria a conexão de
// pagamento de quem não é admin.
const storesNavItem: NavItem = { id: "lojas", label: "Lojas", icon: ShopifyBagIcon, to: "/dashboard/integracoes" };

const affiliatesNavItem: NavItem = { id: "afiliados", label: "Afiliados", icon: Users, to: "/dashboard/comissoes", dimmed: true };

const normalizePath = (path: string) => path.split("?")[0].replace(/\/$/, "");

// Transição do "sliding highlight" (pill do item ativo) e do submenu.
const PILL_EASE = [0.4, 0, 0.2, 1] as const;

// Hover/foco dos itens (inline styles não fazem :hover, então injetamos CSS).
const NAV_CSS = `
.velo-nav-item, .velo-nav-sub { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-nav-item:hover:not([data-active="true"]) { background-color: rgba(10,10,10,0.05); }
.velo-nav-sub:hover:not([data-active="true"]) { background-color: rgba(10,10,10,0.045); }
.velo-nav-ico { transition: transform 150ms ease-out; }
.velo-nav-item:hover .velo-nav-ico, .velo-nav-sub:hover .velo-nav-ico { transform: scale(1.09); }
.velo-settings-row { transition: background-color 140ms ease-out; }
.velo-settings-row:hover { background-color: rgba(10,10,10,0.05); }
.velo-profile-menu-row { transition: background-color 140ms ease-out, transform 140ms ease-out; }
.velo-profile-menu-row:hover { background-color: rgba(10,10,10,0.045); }
.velo-sidebar-scroll {
  overflow-y: scroll;
  scrollbar-width: thin;
  scrollbar-color: rgba(10,10,10,0.26) transparent;
}
.velo-sidebar-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.velo-sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 999px;
}
.velo-sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(10,10,10,0.26);
  border-radius: 999px;
}
.velo-sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(10,10,10,0.32);
}
.velo-collapsible {
  display: grid;
  grid-template-rows: 0fr;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  transition: grid-template-rows 300ms ease-out;
}
.velo-collapsible[data-state="open"] { grid-template-rows: 1fr; }
.velo-collapsible-inner {
  min-height: 0;
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .velo-nav-item, .velo-nav-sub, .velo-nav-ico, .velo-collapsible-chevron { transition: none; }
  .velo-collapsible { transition: none; }
}
`;

const tourTargetByLabel: Record<string, string> = {
  Início: "inicio",
  Catálogo: "catalogo",
  "Produtos em Alta": "produtos-em-alta",
  Publicações: "publicacoes",
  Pedidos: "pedidos",
  "Imagens com IA": "imagens-ia",
  "Cursos Ecommerce": "cursos-ecommerce",
  Configurações: "configuracoes",
  "Minha loja": "minha-loja",
  "Páginas com IA": "paginas-com-ia",
  TikTok: "tiktok",
  Templates: "modelos",
};

type SidebarSubscription = {
  plan: string | null;
  status: string | null;
  is_trial: boolean | null;
  trial_ends_at: string | null;
  current_period_end?: string | null;
  next_charge_at?: string | null;
  created_at?: string | null;
};

const activeSubscriptionStatuses = new Set(["active", "paid", "approved", "trialing"]);
const TRIAL_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

const formatTrialTimeLeft = (endsAt: string | null, now: Date) => {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - now.getTime();
  if (diff <= 0) return null;

  const totalHours = Math.ceil(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days <= 0) return `${hours}h`;
  if (hours <= 0) return `${days}d`;
  return `${days}d ${hours}h`;
};

const getTrialEndsAt = (subscription: SidebarSubscription | null) => {
  if (!subscription) return null;
  const status = String(subscription.status ?? "").toLowerCase();
  const isTrial = subscription.is_trial === true || status === "trialing";
  if (!isTrial) return null;

  if (subscription.trial_ends_at) return subscription.trial_ends_at;
  if (subscription.next_charge_at) return subscription.next_charge_at;
  if (subscription.current_period_end) return subscription.current_period_end;
  if (subscription.created_at && subscription.plan === "pro") {
    return new Date(new Date(subscription.created_at).getTime() + TRIAL_DURATION_MS).toISOString();
  }

  return null;
};

const getInitials = (name: string, email?: string | null) => {
  const raw = (name || email || "Velo").trim();
  const parts = raw.split(/[\s._@-]+/).filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const styles = {
  sidebar: {
    width: 268,
    height: "100dvh",
    maxHeight: "100dvh",
    minHeight: 0,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
    boxSizing: "border-box",
    padding: "30px 16px 18px",
    borderRadius: 0,
    border: "1px solid #E5E7EB",
    background: "#F9FAFB",
    color: "#0A0A0A",
    boxShadow: "none",
  } satisfies CSSProperties,
  scrollArea: {
    // Navegação e bloco inferior ficam no mesmo fluxo rolável. Assim o card de
    // upgrade vem logo depois dos links, sem ser empurrado para o rodapé, e a
    // sidebar continua usável em telas menores.
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    paddingRight: 0,
  } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    // Mesmo recuo horizontal dos itens de nav (padding-left 11), para o logo
    // alinhar com a coluna de ícones abaixo. padding-top baixo para a nav não
    // ser empurrada para baixo.
    gap: 11,
    paddingLeft: 8,
    paddingTop: 2,
    paddingBottom: 6,
  } satisfies CSSProperties,
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    minWidth: 0,
    color: "#0A0A0A",
    textDecoration: "none",
  } satisfies CSSProperties,
  brandText: {
    fontFamily: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 22,
    lineHeight: "26px",
    fontWeight: 700,
    letterSpacing: "-0.05em",
  } satisfies CSSProperties,
  search: {
    marginTop: 22,
    height: 36,
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxSizing: "border-box",
    border: 0,
    borderRadius: 11,
    padding: "0 10px",
    background: "#F1F1F3",
    color: "#4B5563",
    textAlign: "left",
    boxShadow: "inset 0 0 0 1px rgba(10,10,10,0.06)",
  } satisfies CSSProperties,
  searchText: {
    minWidth: 0,
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 14,
    lineHeight: "18px",
    fontWeight: 600,
    letterSpacing: "-0.03em",
  } satisfies CSSProperties,
  searchBadge: {
    width: 24,
    height: 24,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    background: "#E4E4E7",
    color: "#4B5563",
    fontSize: 15,
    lineHeight: "15px",
    fontWeight: 650,
  } satisfies CSSProperties,
  nav: {
    // Respiro entre o logo e o primeiro item, calibrado para bater com a
    // referência (PagePilot): ~24px no total com o paddingBottom: 6 do header.
    marginTop: 19,
    marginBottom: 6,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    gap: 2,
  } satisfies CSSProperties,
  navLinkBase: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxSizing: "border-box",
    borderRadius: 8,
    padding: "7.5px 9px",
    textDecoration: "none",
    fontSize: 14,
    lineHeight: "19px",
    fontWeight: 500,
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,
  // Sub-itens de uma categoria: recuados, com linha vertical à esquerda, um
  // pouco menores que os itens de topo (como na referência).
  subWrap: {
    marginLeft: 17,
    paddingLeft: 12,
    borderLeft: "1.5px solid rgba(10,10,10,0.10)",
    marginTop: 3,
    marginBottom: 3,
    display: "flex",
    flexDirection: "column",
    gap: 1,
  } satisfies CSSProperties,
  navSubLinkBase: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxSizing: "border-box",
    borderRadius: 8,
    padding: "7px 10px",
    textDecoration: "none",
    fontSize: 13.5,
    lineHeight: "18px",
    fontWeight: 500,
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,
  spacer: {
    minHeight: 0,
    flex: 1,
  } satisfies CSSProperties,
  // Bloco inferior no mesmo fluxo da navegação, mas com altura flexível para
  // ancorar os cards finais mais perto do rodapé quando houver espaço.
  footer: {
    flex: "1 0 auto",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    paddingTop: 8,
  } satisfies CSSProperties,
  upgradeCard: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 15,
    padding: "13px 15px 12px",
    marginTop: 0,
    marginBottom: 16,
    background: "linear-gradient(135deg, #BFD3FF 0%, #E6EEFF 62%, #F2F6FF 100%)",
    color: "#0A0A0A",
    boxShadow: "none",
    textAlign: "center",
  } satisfies CSSProperties,
  footerBottom: {
    marginTop: 0,
    paddingTop: 16,
    display: "flex",
    flexDirection: "column",
  } satisfies CSSProperties,
  fixedBottom: {
    // Fica fora da área rolável de propósito: a rolagem termina no card de
    // upgrade, e daqui para baixo (Sugestões, Ajuda, promos e perfil) o bloco
    // é âncora. Antes o perfil descia junto com a rolagem e sumia da tela.
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    paddingTop: 8,
  } satisfies CSSProperties,
  // Ícone "herói" centralizado no topo do card (sem chip), como na referência.
  upgradeIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 6px",
    color: "#1A1A1A",
  } satisfies CSSProperties,
  upgradeTitle: {
    margin: "0",
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: "18px",
    fontWeight: 700,
    letterSpacing: "-0.03em",
  } satisfies CSSProperties,
  upgradeCopy: {
    margin: "4px 0 0",
    color: "rgba(10,10,10,0.6)",
    fontSize: 12.2,
    lineHeight: "16px",
    fontWeight: 500,
  } satisfies CSSProperties,
  upgradeButton: {
    marginTop: 11,
    width: "100%",
    height: 32,
    borderRadius: 9,
    fontSize: 12.5,
    fontWeight: 650,
  } satisfies CSSProperties,
  // Blocos promocionais adaptados à Velo (estilo dos cards da referência):
  // ícone colorido à esquerda + título/subtítulo à direita, fundo tonalizado.
  promoCard: {
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: 0,
    borderRadius: 11,
    padding: "8px 9px",
    marginBottom: 6,
    textAlign: "left",
    cursor: "pointer",
  } satisfies CSSProperties,
  promoIcon: {
    width: 32,
    height: 32,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  } satisfies CSSProperties,
  promoTitle: {
    display: "block",
    fontSize: 12.5,
    lineHeight: "16px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "#0A0A0A",
  } satisfies CSSProperties,
  promoSub: {
    display: "block",
    marginTop: 1,
    fontSize: 11,
    lineHeight: "14px",
    fontWeight: 500,
    color: "rgba(10,10,10,0.55)",
  } satisfies CSSProperties,
  profileCard: {
    width: "100%",
    minWidth: 0,
    minHeight: 52,
    display: "flex",
    alignItems: "center",
    gap: 11,
    boxSizing: "border-box",
    border: 0,
    borderRadius: 13,
    padding: "9px 11px",
    background: "transparent",
    color: "#0A0A0A",
    textAlign: "left",
    boxShadow: "inset 0 0 0 1px rgba(10,10,10,0.08)",
  } satisfies CSSProperties,
  avatar: {
    width: 34,
    height: 34,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 999,
    background: "#E4E4E7",
    color: "#4B5563",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,
  profileText: {
    minWidth: 0,
    flex: 1,
  } satisfies CSSProperties,
  profileName: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#0A0A0A",
    fontSize: 13,
    lineHeight: "17px",
    fontWeight: 600,
    letterSpacing: "-0.025em",
  } satisfies CSSProperties,
  profileEmail: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: 2,
    color: "rgba(10,10,10,0.55)",
    fontSize: 11,
    lineHeight: "14px",
    fontWeight: 500,
  } satisfies CSSProperties,
  profileChevrons: {
    width: 16,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    color: "rgba(10,10,10,0.5)",
  } satisfies CSSProperties,
  profileWrap: {
    position: "relative",
  } satisfies CSSProperties,
  profileSidePanel: {
    position: "fixed",
    left: 278,
    bottom: 22,
    width: 198,
    boxSizing: "border-box",
    borderRadius: 16,
    padding: 5,
    border: "1px solid rgba(10,10,10,0.08)",
    background: "#FFFFFF",
    color: "#0A0A0A",
    boxShadow: "0 14px 34px rgba(10,10,10,0.14), 0 1px 0 rgba(255,255,255,0.9) inset",
    zIndex: 90,
    transformOrigin: "left bottom",
  } satisfies CSSProperties,
  profileMenuRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 7,
    boxSizing: "border-box",
    border: 0,
    minHeight: 35,
    borderRadius: 11,
    padding: "7px 9px",
    background: "transparent",
    color: "#171717",
    textAlign: "left",
    cursor: "pointer",
  } satisfies CSSProperties,
  profileMenuRowLeft: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 9,
  } satisfies CSSProperties,
  profileMenuLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 12.4,
    lineHeight: "16px",
    fontWeight: 560,
    letterSpacing: "-0.015em",
  } satisfies CSSProperties,
  profileMenuIcon: {
    width: 15,
    height: 15,
    flexShrink: 0,
    color: "rgba(10,10,10,0.74)",
  } satisfies CSSProperties,
  profileMenuDivider: {
    height: 1,
    margin: "5px 6px",
    background: "rgba(10,10,10,0.07)",
  } satisfies CSSProperties,
  profilePanel: {
    position: "absolute",
    left: "calc(100% + 6px)",
    bottom: 0,
    width: 214,
    boxSizing: "border-box",
    borderRadius: 18,
    padding: 4,
    border: "1px solid rgba(10,10,10,0.08)",
    background: "#FFFFFF",
    boxShadow: "0 14px 30px rgba(10,10,10,0.14)",
    zIndex: 80,
  } satisfies CSSProperties,
  profilePanelCard: {
    overflow: "hidden",
    borderRadius: 15,
    border: "1px solid rgba(10,10,10,0.06)",
    background: "#FFFFFF",
    boxShadow: "inset 0 1px 0 rgba(10,10,10,0.02)",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif',
  } satisfies CSSProperties,
  profilePanelBody: {
    padding: "7px 6px 4px",
  } satisfies CSSProperties,
  profilePanelRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 7,
    boxSizing: "border-box",
    border: 0,
    minHeight: 40,
    borderRadius: 11,
    padding: "8px 10px",
    background: "transparent",
    color: "#1A1A1A",
    textAlign: "left",
  } satisfies CSSProperties,
  profilePanelRowActive: {
    background: "rgba(10,10,10,0.06)",
  } satisfies CSSProperties,
  profilePanelRowLeft: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,
  profilePanelRowLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 10.5,
    lineHeight: "14px",
    fontWeight: 500,
    letterSpacing: "-0.015em",
  } satisfies CSSProperties,
  profilePanelIcon: {
    width: 14,
    height: 14,
    flexShrink: 0,
    color: "rgba(10,10,10,0.8)",
  } satisfies CSSProperties,
  profilePanelDivider: {
    height: 1,
    margin: "3px 0",
    background: "rgba(10,10,10,0.08)",
  } satisfies CSSProperties,
  profilePanelFooter: {
    padding: "1px 6px 6px",
  } satisfies CSSProperties,
  profilePanelBadge: {
    height: 15,
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    padding: "0 5px",
    fontSize: 7.5,
    lineHeight: "9px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    background: "rgba(37,99,235,0.1)",
    color: "#1D4ED8",
    boxShadow: "inset 0 0 0 1px rgba(37,99,235,0.14)",
  } satisfies CSSProperties,
  profilePanelMutedBadge: {
    height: 15,
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "0 5px",
    fontSize: 7.5,
    lineHeight: "9px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    background: "rgba(10,10,10,0.06)",
    color: "rgba(10,10,10,0.6)",
  } satisfies CSSProperties,
  profilePanelCircleButton: {
    width: 16,
    height: 16,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    background: "rgba(10,10,10,0.06)",
    color: "rgba(10,10,10,0.6)",
    boxShadow: "inset 0 0 0 1px rgba(10,10,10,0.06)",
  } satisfies CSSProperties,
  // ── Modal de configurações (aberto pela área de perfil) ──────────────────
  settingsOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 120,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    background: "rgba(10,10,10,0.45)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
  } satisfies CSSProperties,
  settingsModal: {
    width: "100%",
    maxWidth: 380,
    boxSizing: "border-box",
    borderRadius: 20,
    border: "1px solid rgba(10,10,10,0.08)",
    background: "#FFFFFF",
    boxShadow: "0 24px 60px rgba(10,10,10,0.28)",
    overflow: "hidden",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
  } satisfies CSSProperties,
  settingsHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 16px 14px",
    borderBottom: "1px solid rgba(10,10,10,0.07)",
  } satisfies CSSProperties,
  settingsBody: {
    padding: 8,
  } satisfies CSSProperties,
  settingsRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    boxSizing: "border-box",
    border: 0,
    minHeight: 44,
    borderRadius: 12,
    padding: "10px 12px",
    background: "transparent",
    color: "#1A1A1A",
    textAlign: "left",
    cursor: "pointer",
  } satisfies CSSProperties,
  settingsRowLeft: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 11,
  } satisfies CSSProperties,
  settingsRowLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 13.5,
    lineHeight: "18px",
    fontWeight: 550,
    letterSpacing: "-0.01em",
  } satisfies CSSProperties,
  settingsIcon: {
    width: 17,
    height: 17,
    flexShrink: 0,
    color: "rgba(10,10,10,0.75)",
  } satisfies CSSProperties,
  settingsClose: {
    width: 30,
    height: 30,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    border: 0,
    background: "rgba(10,10,10,0.05)",
    color: "rgba(10,10,10,0.6)",
    cursor: "pointer",
  } satisfies CSSProperties,
  settingsDivider: {
    height: 1,
    margin: "6px 8px",
    background: "rgba(10,10,10,0.07)",
  } satisfies CSSProperties,
};

// Logo oficial da Velo (public/logo.png): a bolha azul com o "C", com fundo
// transparente e já recortada na borda da marca — por isso ela preenche a caixa
// inteira (object-contain) em vez de flutuar numa margem vazia.
const VeloIconOnly = () => (
  <img
    aria-hidden="true"
    src="/logo.png"
    alt=""
    // 38px mantém a presença do app badge sem deixar o topo mais pesado que a referência.
    style={{ width: 38, height: 38, objectFit: "contain", flexShrink: 0, display: "block" }}
  />
);

// Pill de fundo do item ativo. Com layoutId compartilhado, o framer desliza o
// mesmo elemento entre os itens ao trocar de página (sliding highlight).
const ActivePill = ({ sub, reduce }: { sub?: boolean; reduce: boolean }) => (
  <motion.span
    layoutId={sub ? undefined : "navActivePill"}
    aria-hidden="true"
    initial={sub ? { opacity: 0 } : false}
    animate={sub ? { opacity: 1 } : undefined}
    exit={sub ? { opacity: 0 } : undefined}
    transition={reduce ? { duration: 0 } : { duration: 0.24, ease: PILL_EASE }}
    style={{
      position: "absolute",
      inset: 0,
      zIndex: -1,
      borderRadius: sub ? 8 : 8,
      background: sub ? "rgba(37,99,235,0.10)" : "linear-gradient(90deg, #4F7FFF, #1D4ED8)",
      boxShadow: sub ? "none" : "0 1px 2px rgba(0,0,0,0.08)",
    }}
  />
);

const SidebarNavLink = ({ item, active, sub = false, reduce }: { item: NavItem; active: boolean; sub?: boolean; reduce: boolean }) => {
  const Icon = item.icon;
  const linkStyle: CSSProperties = {
    ...(sub ? styles.navSubLinkBase : styles.navLinkBase),
    position: "relative",
    isolation: "isolate",
    color: active ? (sub ? "#1D4ED8" : "#FFFFFF") : "#0A0A0A",
  };

  return (
    <Link
      to={item.to!}
      aria-current={active ? "page" : undefined}
      data-active={active ? "true" : "false"}
      data-dashboard-tour={tourTargetByLabel[item.label]}
      className={sub ? "velo-nav-sub" : "velo-nav-item"}
      style={linkStyle}
    >
      {active ? <ActivePill sub={sub} reduce={reduce} /> : null}
      <Icon className="velo-nav-ico" size={sub ? 15 : 18} strokeWidth={sub ? 1.9 : 2} aria-hidden="true" />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
    </Link>
  );
};

// Item pai expansível (categoria). Mesmo layout dos demais (ícone + label com
// gap fixo, à esquerda); o chevron vai para a direita com margin-left:auto e
// rotaciona ao abrir. Fica com o pill roxo quando algum filho é a rota ativa.
const SidebarCategory = ({
  item,
  open,
  childActive,
  onOpenChange,
  isActive,
  reduce,
}: {
  item: NavItem;
  open: boolean;
  childActive: boolean;
  onOpenChange: (open: boolean) => void;
  isActive: (i: NavItem) => boolean;
  reduce: boolean;
}) => {
  const Icon = item.icon;
  const submenuId = `sidebar-submenu-${item.id}`;
  const btnStyle: CSSProperties = {
    ...styles.navLinkBase,
    width: "100%",
    border: 0,
    cursor: "pointer",
    textAlign: "left",
    position: "relative",
    isolation: "isolate",
    color: childActive ? "#FFFFFF" : "#0A0A0A",
    justifyContent: "space-between",
  };

  return (
    // O submenu fica sempre no DOM e é colapsado por CSS Grid (0fr -> 1fr).
    // Assim ele continua no fluxo normal: quando abre, empurra naturalmente
    // todos os itens abaixo e o card de upgrade em vez de sobrepor.
    <div>
      <button
        type="button"
        data-active={childActive ? "true" : "false"}
        aria-expanded={open}
        aria-controls={submenuId}
        className="velo-nav-item"
        onClick={() => onOpenChange(!open)}
        style={btnStyle}
      >
        {childActive ? <ActivePill reduce={reduce} /> : null}
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Icon className="velo-nav-ico" size={18} strokeWidth={2} aria-hidden="true" />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
        </span>
        <ChevronRight
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          className="velo-collapsible-chevron"
          style={{
            flexShrink: 0,
            opacity: 0.75,
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: reduce ? "none" : "transform 280ms ease-out",
          }}
        />
      </button>
      <div id={submenuId} className="velo-collapsible" data-state={open ? "open" : "closed"}>
        <div className="velo-collapsible-inner">
          <div style={styles.subWrap}>
            {item.children!.map((child) => (
              <SidebarNavLink key={child.id} item={child} active={isActive(child)} sub reduce={reduce} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const upgradeModal = useUpgradeModal();
  const { user, signOut, role } = useAuth();
  const { nome, foto } = useProfile();
  const reduce = !!useReducedMotion();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  // Evita ícone quebrado/circulo vazio quando a foto do perfil não existe ou
  // falha ao carregar (ex.: URL de storage inválida). Nesses casos cai para o
  // ícone genérico de usuário em vez de depender de um asset externo.
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [plan, setPlan] = useState("gratis");
  const [subscription, setSubscription] = useState<SidebarSubscription | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [isAdmin, setIsAdmin] = useState(false);
  // "Afiliados" só aparece depois que o usuário envia a solicitação.
  const [hasAffiliateApplication, setHasAffiliateApplication] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileName = nome || user?.user_metadata?.full_name || user?.email || "Usuario";
  const profileEmail = user?.email || "conta@velo.app";
  const initials = getInitials(profileName, user?.email);
  const metadataRole =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined) ??
    null;

  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [location.pathname, location.search]);

  const visibleNavItems = useMemo(() => {
    const items = [...baseNavItems];
    if (isAdmin || hasAffiliateApplication) {
      // Ancorado pelo vizinho, e não por índice fixo: reordenar baseNavItems não
      // deve arrastar "Afiliados" para outro ponto da lista sem querer.
      const afterPedidos = items.findIndex((item) => item.id === "pedidos") + 1;
      items.splice(afterPedidos || items.length, 0, affiliatesNavItem);
    }
    if (isAdmin) {
      items.push(storesNavItem);
      // "Editar minha loja (beta)" removido da sidebar; o fluxo principal começa em /comecar.
    }
    return items;
  }, [hasAffiliateApplication, isAdmin]);

  const isActive = (item: NavItem) => {
    if (!item.to) return false;
    const currentPath = normalizePath(location.pathname);
    const itemPath = normalizePath(item.to);
    return item.end ? currentPath === itemPath : currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
  };

  const isChildActive = (item: NavItem) => !!item.children?.some(isActive);
  const setCategoryOpen = (id: string, isOpen: boolean) =>
    setOpenCategories((current) => {
      const next = new Set(current);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });

  // Abre automaticamente a categoria que contém a rota ativa.
  useEffect(() => {
    const currentPath = normalizePath(location.pathname);
    const activeCat = baseNavItems.find((i) =>
      i.children?.some((c) => {
        if (!c.to) return false;
        const p = normalizePath(c.to);
        return currentPath === p || currentPath.startsWith(`${p}/`);
      }),
    );
    if (activeCat) {
      setOpenCategories((current) => {
        if (current.has(activeCat.id)) return current;
        const next = new Set(current);
        next.add(activeCat.id);
        return next;
      });
    }
  }, [location.pathname]);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (target?.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      event.preventDefault();
      setSearchOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!user) return;

    let active = true;

    Promise.all([
      supabase.from("profiles").select("plano").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("subscriptions")
        .select("plan,status,is_trial,trial_ends_at,current_period_end,next_charge_at,updated_at,created_at")
        .eq("user_id", user.id)
         .in("status", Array.from(activeSubscriptionStatuses))
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([profileResult, subscriptionResult]) => {
        if (!active) return;

        const currentSubscription = subscriptionResult.data as SidebarSubscription | null;
        setSubscription(currentSubscription);

        if (currentSubscription?.plan && activeSubscriptionStatuses.has(String(currentSubscription.status))) {
          setPlan(String(currentSubscription.plan));
          return;
        }

        if (profileResult.data?.plano) setPlan(String(profileResult.data.plano));
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const trialEndsAt = getTrialEndsAt(subscription);
    if (!trialEndsAt) return;
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, [subscription]);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const hasAdminRole = role === "admin" || metadataRole === "admin" || isAdminEmail(user.email);
    setIsAdmin(hasAdminRole);

    if (!isSupabaseEnabled) return;

    let active = true;

    const resolveAdminRole = async () => {
      const [hasRoleResult, profileByUserId, profileById, userRole] = await Promise.allSettled([
        supabase.rpc("is_admin", { _user_id: user.id }),
        (supabase as any).from("profiles").select("role").eq("user_id", user.id).maybeSingle(),
        (supabase as any).from("profiles").select("role").eq("id", user.id).maybeSingle(),
        (supabase as any).from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);

      if (!active) return;

      const roleCandidates = [role, metadataRole, isAdminEmail(user.email) ? "admin" : null];

      if (hasRoleResult.status === "fulfilled" && hasRoleResult.value.data === true) {
        roleCandidates.push("admin");
      }
      for (const result of [profileByUserId, profileById, userRole]) {
        if (result.status === "fulfilled" && result.value?.data?.role) {
          roleCandidates.push(String(result.value.data.role));
        }
      }

      setIsAdmin(roleCandidates.includes("admin"));
    };

    void resolveAdminRole().catch((error) => {
      console.error("[DashboardSidebar] erro ao resolver permissao admin:", error);
      if (active) setIsAdmin(hasAdminRole);
    });

    return () => {
      active = false;
    };
  }, [metadataRole, role, user]);

  // Libera o item "Afiliados" assim que existe uma solicitação enviada (ou uma
  // conta de afiliado já ativa). O evento cobre o envio feito no mesmo carregamento.
  useEffect(() => {
    if (!user?.id || !isSupabaseEnabled) {
      setHasAffiliateApplication(false);
      return;
    }

    let active = true;

    const resolveAffiliateApplication = async () => {
      const [applicationResult, affiliateResult] = await Promise.allSettled([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("affiliate_applications").select("agreed_terms").eq("user_id", user.id).maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("affiliates").select("is_active").eq("user_id", user.id).maybeSingle(),
      ]);

      if (!active) return;

      const applied = applicationResult.status === "fulfilled" && applicationResult.value?.data?.agreed_terms === true;
      const isActiveAffiliate = affiliateResult.status === "fulfilled" && affiliateResult.value?.data?.is_active === true;
      setHasAffiliateApplication(applied || isActiveAffiliate);
    };

    void resolveAffiliateApplication();

    const handleApplicationSent = () => setHasAffiliateApplication(true);
    window.addEventListener(AFFILIATE_APPLICATION_EVENT, handleApplicationSent);

    return () => {
      active = false;
      window.removeEventListener(AFFILIATE_APPLICATION_EVENT, handleApplicationSent);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [location.pathname, location.search]);

  const planLabel = plan === "business" ? "BUSINESS" : plan === "pro" || plan === "plus" ? "PRO" : plan === "base" ? "BASE" : plan === "go" ? "GO" : "GRATIS";
  const normalizedPlan = plan === "plus" ? "pro" : plan;
  const trialTimeLeft = formatTrialTimeLeft(getTrialEndsAt(subscription), now);
  const showUpgradeCard = Boolean(trialTimeLeft) || !["base", "pro", "business"].includes(normalizedPlan);

  const closeProfileMenuNow = () => {
    flushSync(() => setProfileMenuOpen(false));
  };

  const handlePanelNavigate = (to: string) => {
    closeProfileMenuNow();
    navigate(to);
  };

  const handleSignOut = async () => {
    closeProfileMenuNow();
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="velo-dashboard-sidebar" style={styles.sidebar}>
      <style>{NAV_CSS}</style>
      <header style={styles.header}>
        <Link to="/dashboard" style={styles.brand}>
          <VeloIconOnly />
          <span style={styles.brandText}>Velo</span>
        </Link>
      </header>

      {/* Barra de busca removida da sidebar. A paleta de busca continua
          acessível pelo atalho de teclado "/". */}
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} isAdmin={isAdmin} />
      <InviteFriendModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <div className="velo-sidebar-scroll" style={styles.scrollArea}>
        <nav aria-label="Navegação principal" style={styles.nav}>
          {visibleNavItems.map((item) =>
            item.children ? (
              <SidebarCategory
                key={item.id}
                item={item}
                open={openCategories.has(item.id)}
                childActive={isChildActive(item)}
                onOpenChange={(nextOpen) => setCategoryOpen(item.id, nextOpen)}
                isActive={isActive}
                reduce={reduce}
              />
            ) : (
              <SidebarNavLink key={item.id} item={item} active={isActive(item)} reduce={reduce} />
            ),
          )}
        </nav>

      {/* Bloco inferior: segue a navegação no mesmo fluxo, evitando o vão
          artificial entre os links e o card de upgrade. */}
      <div style={styles.footer}>
        {showUpgradeCard && (
          <section aria-label={trialTimeLeft ? "Tempo restante do trial" : "Upgrade para Premium"} style={styles.upgradeCard}>
            <span style={styles.upgradeIcon} aria-hidden="true">
              <Trophy size={20} strokeWidth={2} />
            </span>
            <p style={styles.upgradeTitle}>{trialTimeLeft ? "Trial ativo" : "Upgrade para o Premium!"}</p>
            <p style={styles.upgradeCopy}>
              {trialTimeLeft ? (
                <>
                  Termina em
                  <br />
                  {trialTimeLeft}
                </>
              ) : (
                <>
                  Publique sem limites
                  <br />
                  Personalize sua marca
                </>
              )}
            </p>
            <PremiumActionButton type="button" onClick={() => upgradeModal.open()} style={styles.upgradeButton}>
              Fazer upgrade
            </PremiumActionButton>
          </section>
        )}
      </div>
      </div>

      {/* Daqui para baixo nada rola: é o rodapé âncora da sidebar. */}
      <div style={styles.fixedBottom}>
        {/* Linha "Feature Requests" da referência, adaptada à Velo como
            "Sugestões" (ideias e dicas da comunidade). */}
        <button
          type="button"
          onClick={() => navigate("/dashboard/sugestoes")}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", border: 0, background: "transparent", padding: "6px 9px", marginBottom: 7, cursor: "pointer", textAlign: "left", color: "#0A0A0A", borderRadius: 8 }}
        >
          <Lightbulb size={17} strokeWidth={2} aria-hidden="true" />
          <span style={{ fontSize: 14, lineHeight: "19px", fontWeight: 500, letterSpacing: "-0.02em" }}>Sugestões</span>
        </button>

        {/* "Comunidade e Ajuda" movido da lista principal para cá, logo abaixo de
            "Sugestões" e antes dos cards promocionais. Mesmo estilo de "Sugestões". */}
        <button
          type="button"
          onClick={() => navigate("/docs")}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", border: 0, background: "transparent", padding: "6px 9px", marginBottom: 7, cursor: "pointer", textAlign: "left", color: "#0A0A0A", borderRadius: 8 }}
        >
          <Info size={17} strokeWidth={2} aria-hidden="true" />
          <span style={{ fontSize: 14, lineHeight: "19px", fontWeight: 500, letterSpacing: "-0.02em" }}>Comunidade e Ajuda</span>
        </button>

        {/* Blocos finais ancorados no rodapé da sidebar, como na referência. */}
        <div style={styles.footerBottom}>
          <button type="button" onClick={() => setInviteOpen(true)} style={{ ...styles.promoCard, background: "#E8EFFF" }}>
            <span style={{ ...styles.promoIcon, background: "#D6E4FF", color: "#2563EB" }} aria-hidden="true">
              <Gift size={20} strokeWidth={2} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ ...styles.promoTitle, fontSize: 14, fontWeight: 500 }}>Indique e ganhe</span>
              <span style={styles.promoSub}>Ganhe 30% na primeira venda</span>
            </span>
          </button>

          <button type="button" onClick={() => navigate("/dashboard/paginas-com-ia")} style={{ ...styles.promoCard, background: "#E7F5EC" }}>
            <span style={{ ...styles.promoIcon, background: "#D6EEDF", color: "#16A34A" }} aria-hidden="true">
              <Sparkles size={20} strokeWidth={2} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ ...styles.promoTitle, fontSize: 14, fontWeight: 500 }}>Páginas com IA</span>
              <span style={styles.promoSub}>Crie páginas em minutos</span>
            </span>
          </button>

          <div ref={profileMenuRef} style={styles.profileWrap}>
          <button
            type="button"
            aria-label="Abrir configurações da conta"
            aria-haspopup="menu"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((current) => !current)}
            style={styles.profileCard}
          >
            <span style={styles.avatar}>
              {foto && !avatarFailed ? (
                <img
                  src={foto}
                  alt=""
                  onError={() => setAvatarFailed(true)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <UserRound size={17} strokeWidth={1.9} color="rgba(10,10,10,0.55)" />
              )}
            </span>
            <span style={styles.profileText}>
              <span style={styles.profileName}>{profileName}</span>
              <span style={styles.profileEmail}>{profileEmail}</span>
            </span>
            <span aria-hidden="true" style={styles.profileChevrons}>
              <MoreVertical size={16} strokeWidth={2} />
            </span>
          </button>

        <AnimatePresence>
          {profileMenuOpen ? (
            <motion.div
              key="profile-side-panel"
              style={styles.profileSidePanel}
              role="menu"
              aria-label="Opções da conta"
              initial={reduce ? false : { opacity: 0, x: -8, scale: 0.985 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -6, scale: 0.99 }}
              transition={reduce ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                className="velo-profile-menu-row"
                type="button"
                role="menuitem"
                onClick={() => handlePanelNavigate("/dashboard/configuracoes")}
                style={styles.profileMenuRow}
              >
                <span style={styles.profileMenuRowLeft}>
                  <Settings2 size={15} strokeWidth={2} style={styles.profileMenuIcon} />
                  <span style={styles.profileMenuLabel}>Configurações</span>
                </span>
              </button>

              <button
                className="velo-profile-menu-row"
                type="button"
                role="menuitem"
                onClick={() => handlePanelNavigate("/dashboard/configuracoes?tab=Plano")}
                style={styles.profileMenuRow}
              >
                <span style={styles.profileMenuRowLeft}>
                  <CreditCard size={15} strokeWidth={1.9} style={styles.profileMenuIcon} />
                  <span style={styles.profileMenuLabel}>Assinatura</span>
                </span>
                <span style={plan === "gratis" ? styles.profilePanelMutedBadge : styles.profilePanelBadge}>
                  {plan !== "gratis" ? <Sparkles size={10} strokeWidth={2.2} /> : null}
                  {planLabel}
                </span>
              </button>

              <button
                className="velo-profile-menu-row"
                type="button"
                role="menuitem"
                onClick={() => handlePanelNavigate("/docs")}
                style={styles.profileMenuRow}
              >
                <span style={styles.profileMenuRowLeft}>
                  <Info size={15} strokeWidth={2} style={styles.profileMenuIcon} />
                  <span style={styles.profileMenuLabel}>Central de ajuda</span>
                </span>
              </button>

              {isAdmin ? (
                <button
                  className="velo-profile-menu-row"
                  type="button"
                  role="menuitem"
                  onClick={() => handlePanelNavigate("/admin/painel")}
                  style={styles.profileMenuRow}
                >
                  <span style={styles.profileMenuRowLeft}>
                    <ShieldCheck size={15} strokeWidth={2} style={styles.profileMenuIcon} />
                    <span style={styles.profileMenuLabel}>Painel Admin</span>
                  </span>
                </button>
              ) : null}

              <div style={styles.profileMenuDivider} />

              <button
                className="velo-profile-menu-row"
                type="button"
                role="menuitem"
                onClick={() => void handleSignOut()}
                style={styles.profileMenuRow}
              >
                <span style={styles.profileMenuRowLeft}>
                  <LogOut size={15} strokeWidth={2} style={{ ...styles.profileMenuIcon, color: "#DC2626" }} />
                  <span style={{ ...styles.profileMenuLabel, color: "#DC2626" }}>Sair</span>
                </span>
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
