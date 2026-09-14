import { renderToStaticMarkup } from "react-dom/server";
import {
  Baby,
  BookOpen,
  Boxes,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Dumbbell,
  Facebook,
  Gamepad2,
  Gem,
  Gift,
  Heart,
  HeartPulse,
  Home,
  Instagram,
  Laptop,
  Leaf,
  Minus,
  Package,
  PawPrint,
  Phone,
  Plus,
  Search,
  Share2,
  Shirt,
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
import { supabase } from "@/integrations/supabase/client";
import type { ExampleProduct } from "@/types/onboarding";
import type { ProductVariantOption } from "@/lib/userProjects";
import { CURRENT_PRODUCT_TEMPLATE_ID } from "@/components/store-templates/productTemplateRegistry";

export type FlowState = { product: ExampleProduct; language: string; persona: string; salesAngle: string };
export type CatalogItem = ExampleProduct & { category: string; imageUrls?: string[]; variants?: ProductVariantOption[]; originalPrice?: number | null; rating?: number; averageRating?: number; ratingCount?: string | number; reviewCount?: string | number; reviewsCount?: string | number };
export type EditorPanelTab = "detalhes" | "personalizar";
export type EditorPanelSection = "template" | "produtos" | "imagem" | "aparencia";
export type ContextDrawerMode = "template" | "products";

export type TemplateRef = { kind: "loja" | "produto"; id: string };

export const LOJA_TEMPLATE: TemplateRef = { kind: "loja", id: "loja-1" };
export const PRODUTO_TEMPLATE: TemplateRef = { kind: "produto", id: CURRENT_PRODUCT_TEMPLATE_ID };

// Quem escolheu "página de vendas" no /comecar precisa abrir num template de
// produto. Sem isso o editor abria sempre em loja-1, independente da escolha.
// Projeto salvo continua mandando: a hidratação sobrescreve isso depois.
export const getInitialTemplate = (): TemplateRef => {
  try {
    return sessionStorage.getItem("velo-onboarding-choice") === "sales-page" ? PRODUTO_TEMPLATE : LOJA_TEMPLATE;
  } catch {
    return LOJA_TEMPLATE;
  }
};

// O scraper grava tanto ["url", ...] quanto [{ url }, ...]; normaliza os dois.
export const getAllImages = (images: unknown): string[] => {
  if (Array.isArray(images)) {
    return images.flatMap((entry) => {
      if (typeof entry === "string" && entry.trim()) return [entry.trim()];
      if (entry && typeof entry === "object" && "url" in entry) {
        const url = (entry as { url?: unknown }).url;
        return typeof url === "string" && url.trim() ? [url.trim()] : [];
      }
      return [];
    });
  }
  if (typeof images === "string") {
    try { return getAllImages(JSON.parse(images)); } catch { return images.trim() ? [images.trim()] : []; }
  }
  return [];
};
export const getFirstImage = (images: unknown) => getAllImages(images)[0] || "";

export const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Usa a origem atual (ex: wuili.lovable.app ou velods.com.br) para que o link
// publicado sempre aponte para o domínio onde o app está realmente rodando.
export const PUBLIC_APP_URL = (
  (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ??
  (typeof window !== "undefined" ? window.location.origin : "https://velods.com.br")
).replace(/\/+$/, "");

export const fetchEditorCollectionProducts = (userId: string) =>
  supabase
    .from("collection_products")
    .select("added_at,collections!inner(user_id),catalog_products!inner(id,title,cost_price,images,category,is_active,is_blocked,stock_quantity)")
    .eq("collections.user_id", userId)
    .eq("catalog_products.is_active", true)
    .eq("catalog_products.is_blocked", false)
    .gt("catalog_products.stock_quantity", 0)
    .order("added_at", { ascending: false })
    .limit(12);

export const catalogTaxonomy = [
  "Casa",
  "Eletr\u00f4nicos",
  "Moda",
  "Bijuterias",
  "Decora\u00e7\u00e3o",
  "Beb\u00ea e Infantil",
  "Pet",
  "Beleza",
  "Sa\u00fade e Bem-estar",
  "Esporte e Fitness",
  "Outros",
];

export const getCategoryIcon = (category: string) => {
  const normalized = category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/moda|fashion|roupa|feminin|masculin/.test(normalized)) return Shirt;
  if (/casa|decoracao/.test(normalized)) return Home;
  if (/eletron/.test(normalized)) return Laptop;
  if (/bijuter/.test(normalized)) return Gem;
  if (/bebe|infantil/.test(normalized)) return Baby;
  if (/pet/.test(normalized)) return PawPrint;
  if (/saude|beleza/.test(normalized)) return HeartPulse;
  if (/esporte|fitness/.test(normalized)) return Dumbbell;
  if (/brinquedo|jogo|game/.test(normalized)) return Gamepad2;
  if (/auto|carro|moto/.test(normalized)) return Car;
  if (/livro|papelaria/.test(normalized)) return BookOpen;
  return Boxes;
};

export type EditMode = "select" | "edit" | "fill" | "eraser" | null;
export type ToolbarTool = Exclude<EditMode, null>;
export type CanvasToolbarMode = "select" | "edit" | "pan" | "media" | "appearance" | "favorites";
export type EditorElementType = "image" | "icon" | "text" | "other";
export type EditableDomElement = HTMLElement | SVGElement;
export type ImageShape = "auto" | "wide" | "square" | "circle";
export type TextWeight = "400" | "500" | "600" | "700";
export type ButtonToolbarPanel = "style" | "size" | "radius" | "text" | "icon" | null;
export type ButtonStylePreset = "primary" | "secondary" | "accent" | "outline" | "black";
export type ButtonSizePreset = "xs" | "sm" | "md" | "lg" | "xl";
export type CustomStoreSection = {
  id: string;
  after: string;
};
export type ElementOverride = {
  backgroundColor?: string;
  hoverBackgroundColor?: string;
  color?: string;
  textContent?: string;
  buttonTextContent?: string;
  fontSize?: number;
  fontWeight?: TextWeight;
  textAlign?: "left" | "center" | "right";
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  paddingInline?: number;
  minHeight?: number;
  imageSrc?: string;
  imageShape?: ImageShape;
  iconName?: string;
  iconSize?: number;
  buttonIconName?: string;
  buttonIconSize?: number;
  buttonIconColor?: string;
  buttonIconHidden?: boolean;
};
export type SelectedEditorElement = {
  path: string;
  type: EditorElementType;
  label: string;
  rect: { top: number; left: number; width: number; height: number };
};
export type ContextControls = {
  color: string;
  hoverBackgroundColor: string;
  fontSize: number;
  fontWeight: TextWeight;
  textAlign: "left" | "center" | "right";
  borderRadius: number;
  imageShape: ImageShape;
  iconName: string;
  iconSize: number;
};

export const defaultContextControls: ContextControls = {
  color: "#111111",
  hoverBackgroundColor: "#303337",
  fontSize: 16,
  fontWeight: "500",
  textAlign: "center",
  borderRadius: 12,
  imageShape: "auto",
  iconName: "Sparkles",
  iconSize: 42,
};

export const iconPickerOptions: Array<{ name: string; label: string; icon: LucideIcon }> = [
  { name: "Sparkles", label: "Brilho", icon: Sparkles },
  { name: "ShoppingCart", label: "Carrinho", icon: ShoppingCart },
  { name: "Heart", label: "Favorito", icon: Heart },
  { name: "Truck", label: "Entrega", icon: Truck },
  { name: "Gift", label: "Presente", icon: Gift },
  { name: "Home", label: "Casa", icon: Home },
  { name: "Package", label: "Pacote", icon: Package },
  { name: "Star", label: "Estrela", icon: Star },
  { name: "Circle", label: "Círculo", icon: Circle },
  { name: "Square", label: "Quadrado", icon: Square },
];

export const editorIconRegistry: Record<string, LucideIcon> = {
  ...Object.fromEntries(iconPickerOptions.map((option) => [option.name, option.icon])),
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

export const getIconComponent = (name: string) => editorIconRegistry[name] ?? Sparkles;

export const renderIconMarkup = (name: string, size: number, color: string) => {
  const Icon = getIconComponent(name);
  return renderToStaticMarkup(<Icon size={size} strokeWidth={1.85} color={color} />);
};

export const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const saturationRatio = saturation / 100;
  const lightnessRatio = lightness / 100;
  const chroma = (1 - Math.abs(2 * lightnessRatio - 1)) * saturationRatio;
  const section = ((hue % 360) + 360) % 360 / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const match = lightnessRatio - chroma / 2;
  const [red, green, blue] =
    section < 1 ? [chroma, secondary, 0]
      : section < 2 ? [secondary, chroma, 0]
        : section < 3 ? [0, chroma, secondary]
          : section < 4 ? [0, secondary, chroma]
            : section < 5 ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
};

export const colorToHex = (value: string, fallback = "#111111") => {
  const normalized = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized;
  if (/^#[0-9a-f]{3}$/.test(normalized)) {
    return `#${normalized.slice(1).split("").map((character) => character.repeat(2)).join("")}`;
  }
  const rgb = normalized.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!rgb) return fallback;
  return `#${rgb.slice(1, 4).map((channel) => Math.max(0, Math.min(255, Number(channel))).toString(16).padStart(2, "0")).join("")}`;
};

export const textWeightOptions: Array<{ value: TextWeight; label: string }> = [
  { value: "400", label: "Regular" },
  { value: "500", label: "Médio" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Negrito" },
];

export const buttonStylePresets: Array<{ value: ButtonStylePreset; label: string }> = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "accent", label: "Accent" },
  { value: "outline", label: "Outline" },
  { value: "black", label: "Black" },
];

export const buttonSizePresets: Array<{ value: ButtonSizePreset; label: string }> = [
  { value: "xs", label: "Extra Small" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra Large" },
];
