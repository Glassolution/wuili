import {
  BookOpenText,
  ChatCircleDots,
  CreditCard,
  FileText,
  GearSix,
  Headset,
  Megaphone,
  Package,
  PaperPlaneTilt,
  PlayCircle,
  PlugsConnected,
  Question,
  RocketLaunch,
  ShieldCheck,
  Sparkle,
  Storefront,
  Truck,
  Wallet,
  type Icon,
} from "@phosphor-icons/react";

/**
 * Ícones que o admin pode escolher para uma categoria (Phosphor; a Central usa
 * o peso "fill", branco no quadrado azul). O banco guarda só o nome, que vem
 * da lista antiga em Lucide — por isso as chaves continuam as mesmas. Um nome
 * desconhecido cai no ícone padrão em vez de quebrar a página.
 */
export const HELP_CATEGORY_ICONS: Record<string, Icon> = {
  Rocket: RocketLaunch,
  Plug: PlugsConnected,
  Send: PaperPlaneTilt,
  CreditCard,
  Wallet,
  LifeBuoy: Headset,
  Sparkles: Sparkle,
  Megaphone,
  PlayCircle,
  MessageCircleQuestion: ChatCircleDots,
  BookOpen: BookOpenText,
  FileText,
  ShieldCheck,
  Package,
  Store: Storefront,
  Truck,
  Settings: GearSix,
  HelpCircle: Question,
};

/** Categorias sem ícone escolhido no admin: um ícone que combina com o assunto. */
const SLUG_DEFAULT: Record<string, Icon> = {
  "pos-venda": Truck,
};

export const helpCategoryIcon = (name: string | null | undefined, slug?: string): Icon =>
  (name && HELP_CATEGORY_ICONS[name]) || (slug && SLUG_DEFAULT[slug]) || BookOpenText;
