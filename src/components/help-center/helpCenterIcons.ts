import {
  BookOpen,
  CreditCard,
  FileText,
  HelpCircle,
  LifeBuoy,
  Megaphone,
  MessageCircleQuestion,
  Package,
  PlayCircle,
  Plug,
  Rocket,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Ícones que o admin pode escolher para uma categoria. O banco guarda só o
 * nome; um nome desconhecido cai no ícone padrão em vez de quebrar a página.
 */
export const HELP_CATEGORY_ICONS: Record<string, LucideIcon> = {
  Rocket,
  Plug,
  Send,
  CreditCard,
  Wallet,
  LifeBuoy,
  Sparkles,
  Megaphone,
  PlayCircle,
  MessageCircleQuestion,
  BookOpen,
  FileText,
  ShieldCheck,
  Package,
  Store,
  Truck,
  Settings,
  HelpCircle,
};

export const helpCategoryIcon = (name: string | null | undefined): LucideIcon =>
  (name && HELP_CATEGORY_ICONS[name]) || BookOpen;
