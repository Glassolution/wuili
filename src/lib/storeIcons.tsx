// Renderizador de ícones compartilhado para reaplicar overrides de ícone na
// página publicada. Espelha o registry de ícones do editor
// (GeneratedStoreEditorPage: iconPickerOptions + ícones auxiliares).
import { renderToStaticMarkup } from "react-dom/server";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Facebook,
  Gift,
  Heart,
  Home,
  Instagram,
  Leaf,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Square,
  Star,
  Truck,
  Twitter,
  UserRound,
  Youtube,
  type LucideIcon,
} from "lucide-react";

const registry: Record<string, LucideIcon> = {
  Sparkles,
  ShoppingCart,
  Heart,
  Truck,
  Gift,
  Home,
  Package,
  Star,
  Circle,
  Square,
  Check,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Instagram,
  Leaf,
  Minus,
  Phone,
  Plus,
  Search,
  Share2,
  ShoppingBag,
  Twitter,
  UserRound,
  Youtube,
};

export const renderStoreIcon = (name: string, size: number, color: string): string => {
  const Icon = registry[name] ?? Sparkles;
  return renderToStaticMarkup(<Icon size={size} strokeWidth={1.85} color={color} />);
};
