import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnimatePresence, motion } from "framer-motion";
import { AlignCenter, AlignLeft, AlignRight, ArrowRight, Baby, BookOpen, Boxes, Car, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Command, Copy, Download, Dumbbell, ExternalLink, Facebook, FileUp, FolderPlus, Gamepad2, Gem, Gift, Hand, Headphones, Heart, HeartPulse, HelpCircle, Home, ImageIcon, Instagram, Laptop, Layers3, LayoutGrid, Leaf, Link2, List, Loader2, LockKeyhole, Menu, MessageSquare, Minus, Monitor, MousePointer2, Package, Palette, PawPrint, Pencil, Phone, Play, Plus, Quote, RectangleHorizontal, Redo2, RefreshCcw, Search, Settings, Share2, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Square, Star, Trash2, Truck, Twitter, Type, Undo2, UserRound, X, Youtube, type LucideIcon } from "lucide-react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ExampleProduct } from "@/types/onboarding";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/usePlan";
import { useProfile } from "@/lib/profileContext";
import { claimProjectInvites, createUserProject, getProjectProductIds, parseVariantOptions, publishProject, saveProjectDraft, type ProductVariantOption, type UserProject } from "@/lib/userProjects";
import ProjectSettingsOverlay, { type SettingsSection } from "@/components/editor/ProjectSettingsOverlay";
import { getSavedStoreFlow, markStoreFlowCompleted } from "@/lib/storeFlowCompletion";
import { normalizePriceText } from "@/lib/priceFormat";
import { addProductToCollection, createCollection, ensureExampleCollectionProducts, getCollectionProductIds, listCollections } from "@/lib/collectionsApi";
import { formatReviewCount, getProductCatalogMetrics } from "@/components/dashboard/ProductCard";
import StorefrontNavbar from "@/components/storefront/StorefrontNavbar";
import ProductTemplate from "@/components/store-templates/ProductTemplate";
import ProductTemplateBeauty from "@/components/store-templates/ProductTemplateBeauty";
import ProductTemplateShopify from "@/components/store-templates/ProductTemplateShopify";
import ProductTemplate4 from "@/components/store-templates/ProductTemplate4";

type FlowState = { product: ExampleProduct; language: string; persona: string; salesAngle: string };
type CatalogItem = ExampleProduct & { category: string; imageUrls?: string[]; variants?: ProductVariantOption[]; originalPrice?: number | null; rating?: number; averageRating?: number; ratingCount?: string | number; reviewCount?: string | number; reviewsCount?: string | number };
type EditorPanelTab = "detalhes" | "personalizar";
type EditorPanelSection = "template" | "produtos" | "imagem" | "aparencia";
type ContextDrawerMode = "template" | "products";

type TemplateRef = { kind: "loja" | "produto"; id: string };

const LOJA_TEMPLATE: TemplateRef = { kind: "loja", id: "loja-1" };
const PRODUTO_TEMPLATE: TemplateRef = { kind: "produto", id: "produto-1" };

// Quem escolheu "página de vendas" no /comecar precisa abrir num template de
// produto. Sem isso o editor abria sempre em loja-1, independente da escolha.
// Projeto salvo continua mandando: a hidratação sobrescreve isso depois.
const getInitialTemplate = (): TemplateRef => {
  try {
    return sessionStorage.getItem("velo-onboarding-choice") === "sales-page" ? PRODUTO_TEMPLATE : LOJA_TEMPLATE;
  } catch {
    return LOJA_TEMPLATE;
  }
};

// O scraper grava tanto ["url", ...] quanto [{ url }, ...]; normaliza os dois.
const getAllImages = (images: unknown): string[] => {
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
const getFirstImage = (images: unknown) => getAllImages(images)[0] || "";
const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Usa a origem atual (ex: wuili.lovable.app ou velods.com.br) para que o link
// publicado sempre aponte para o domínio onde o app está realmente rodando.
const PUBLIC_APP_URL = (
  (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ??
  (typeof window !== "undefined" ? window.location.origin : "https://velods.com.br")
).replace(/\/+$/, "");

const fetchEditorCollectionProducts = (userId: string) =>
  supabase
    .from("collection_products")
    .select("added_at,collections!inner(user_id),catalog_products!inner(id,title,cost_price,images,category,is_active,is_blocked,stock_quantity)")
    .eq("collections.user_id", userId)
    .eq("catalog_products.is_active", true)
    .eq("catalog_products.is_blocked", false)
    .gt("catalog_products.stock_quantity", 0)
    .order("added_at", { ascending: false })
    .limit(12);

const catalogTaxonomy = [
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

const getCategoryIcon = (category: string) => {
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

type EditMode = "select" | "edit" | "fill" | "eraser" | null;
type ToolbarTool = Exclude<EditMode, null>;
type CanvasToolbarMode = "select" | "edit" | "pan" | "media" | "appearance" | "favorites";
type EditorElementType = "image" | "icon" | "text" | "other";
type EditableDomElement = HTMLElement | SVGElement;
type ImageShape = "auto" | "wide" | "square" | "circle";
type TextWeight = "400" | "500" | "600" | "700";
type ButtonToolbarPanel = "style" | "size" | "radius" | "text" | "icon" | null;
type ButtonStylePreset = "primary" | "secondary" | "accent" | "outline" | "black";
type ButtonSizePreset = "xs" | "sm" | "md" | "lg" | "xl";
type CustomStoreSection = {
  id: string;
  after: string;
};
type ElementOverride = {
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
type SelectedEditorElement = {
  path: string;
  type: EditorElementType;
  label: string;
  rect: { top: number; left: number; width: number; height: number };
};
type ContextControls = {
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

const defaultContextControls: ContextControls = {
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

const iconPickerOptions: Array<{ name: string; label: string; icon: LucideIcon }> = [
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

const editorIconRegistry: Record<string, LucideIcon> = {
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

const getIconComponent = (name: string) => editorIconRegistry[name] ?? Sparkles;

const renderIconMarkup = (name: string, size: number, color: string) => {
  const Icon = getIconComponent(name);
  return renderToStaticMarkup(<Icon size={size} strokeWidth={1.85} color={color} />);
};

const hslToHex = (hue: number, saturation: number, lightness: number) => {
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

const colorToHex = (value: string, fallback = "#111111") => {
  const normalized = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized;
  if (/^#[0-9a-f]{3}$/.test(normalized)) {
    return `#${normalized.slice(1).split("").map((character) => character.repeat(2)).join("")}`;
  }
  const rgb = normalized.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!rgb) return fallback;
  return `#${rgb.slice(1, 4).map((channel) => Math.max(0, Math.min(255, Number(channel))).toString(16).padStart(2, "0")).join("")}`;
};

const textWeightOptions: Array<{ value: TextWeight; label: string }> = [
  { value: "400", label: "Regular" },
  { value: "500", label: "Médio" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Negrito" },
];

const buttonStylePresets: Array<{ value: ButtonStylePreset; label: string }> = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "accent", label: "Accent" },
  { value: "outline", label: "Outline" },
  { value: "black", label: "Black" },
];

const buttonSizePresets: Array<{ value: ButtonSizePreset; label: string }> = [
  { value: "xs", label: "Extra Small" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra Large" },
];

const GeneratedStoreEditorPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const upgradeModal = useUpgradeModal();
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { nome: profileName, foto: profilePhoto } = useProfile();
  const imageInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const creationFileInput = useRef<HTMLInputElement>(null);
  const contextMediaInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const canvasDragRef = useRef<{ pointerX: number; pointerY: number; offsetX: number; offsetY: number; startedOnPreview: boolean } | null>(null);
  const selectionDragRef = useRef<{ startX: number; startY: number; currentX: number; currentY: number; moved: boolean } | null>(null);
  const suppressCanvasClickRef = useRef(false);
  const suppressPreviewClickRef = useRef(false);
  const selectedElementRef = useRef<EditableDomElement | null>(null);
  const nativePinchZoomRef = useRef<(event: WheelEvent) => void>(() => undefined);
  const wheelPanDeltaRef = useRef({ x: 0, y: 0 });
  const wheelPanFrameRef = useRef<number | null>(null);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasZoom, setCanvasZoom] = useState(0.52);
  const [productPreviewHeight, setProductPreviewHeight] = useState<number>(0);
  useEffect(() => {
    const node = previewRef.current;
    if (!node) return;
    const update = () => setProductPreviewHeight(node.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [mobilePreview]);
  const canvasZoomRef = useRef(0.52);
  const [isCanvasDragging, setIsCanvasDragging] = useState(false);
  const [selectionMarquee, setSelectionMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [pageSelected, setPageSelected] = useState(false);
  const [accent, setAccent] = useState("#111111");
  const [font, setFont] = useState("Geist");
  const [columns, setColumns] = useState(3);
  const [heroImage, setHeroImage] = useState("/hero-pasted-image-2.png");
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [heroCtaUrl, setHeroCtaUrl] = useState("/catalogo");
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogItem[]>([]);
  const [sidebarImportingId, setSidebarImportingId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("Velo");
  const [showPlans, setShowPlans] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<UserProject | null>(null);
  // Produtos escolhidos no wizard de criação (metadata.productIds do projeto).
  // Têm prioridade sobre as coleções do usuário: são o que o usuário selecionou
  // para ESTE projeto, na ordem em que escolheu.
  const [projectProducts, setProjectProducts] = useState<CatalogItem[]>([]);
  const [menuBusy, setMenuBusy] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("geral");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishCopied, setPublishCopied] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const { plan: currentPlan } = usePlan();
  const isFreePlan = currentPlan === "gratis" || currentPlan === "go";
  const [editorPanelTab, setEditorPanelTab] = useState<EditorPanelTab>("personalizar");
  const [openPanelSections, setOpenPanelSections] = useState<Record<EditorPanelSection, boolean>>({
    template: true,
    produtos: true,
    imagem: true,
    aparencia: true,
  });
  const [contextDrawer, setContextDrawer] = useState<ContextDrawerMode | null>(null);
  const initialTemplate = useMemo(getInitialTemplate, []);
  const [templateCategory, setTemplateCategory] = useState<"loja" | "produto">(initialTemplate.kind);
  const [currentTemplate, setCurrentTemplate] = useState("Template 1");
  // Id do projeto cujo template já foi hidratado. Enquanto for diferente do
  // projeto aberto, o canvas não renderiza — senão o default apareceria
  // por um instante antes do template realmente escolhido.
  const [hydratedProjectId, setHydratedProjectId] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<{ kind: "loja" | "produto"; id: string }>(initialTemplate);
  const [draftTemplate, setDraftTemplate] = useState<{ kind: "loja" | "produto"; id: string }>(initialTemplate);
  const [draftProductIds, setDraftProductIds] = useState<string[]>([]);
  const [replacingProductPath, setReplacingProductPath] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>("select");
  const [canvasToolbarMode, setCanvasToolbarMode] = useState<CanvasToolbarMode>("select");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [elementOverrides, setElementOverrides] = useState<Record<string, ElementOverride>>({});
  // Preço editado no canvas. Vai para metadata.price e é o valor que carrinho e
  // checkout consomem — sem depender de reler o texto do override.
  const [editedPrice, setEditedPrice] = useState<number | null>(null);
  const [rewritingText, setRewritingText] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedEditorElement | null>(null);
  const [contextControls, setContextControls] = useState<ContextControls>(defaultContextControls);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [weightMenuOpen, setWeightMenuOpen] = useState(false);
  const [buttonToolbarPanel, setButtonToolbarPanel] = useState<ButtonToolbarPanel>(null);
  const [buttonStylePreset, setButtonStylePreset] = useState<ButtonStylePreset>("primary");
  const [buttonSizePreset, setButtonSizePreset] = useState<ButtonSizePreset>("md");
  const [buttonColorHue, setButtonColorHue] = useState(218);
  const [buttonColorSaturation, setButtonColorSaturation] = useState(82);
  const [buttonColorLightness, setButtonColorLightness] = useState(55);
  const [customSections, setCustomSections] = useState<CustomStoreSection[]>([]);
  const [contextNotice, setContextNotice] = useState<string | null>(null);
  const [fillColor, setFillColor] = useState("#111111");
  const [fillPickerOpen, setFillPickerOpen] = useState(false);
  const [generatingBanner, setGeneratingBanner] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [copyVariant, setCopyVariant] = useState(0);
  const [taglineVariant, setTaglineVariant] = useState(0);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlBackground: html.style.background,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyBackground: body.style.background,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
    };

    html.style.background = "#18191b";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.background = "#18191b";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.background = previous.htmlBackground;
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      body.style.background = previous.bodyBackground;
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
    };
  }, []);

  const generateBanner = async () => {
    if (generatingBanner) return;
    setGeneratingBanner(true);
    setBannerError(null);
    // Rotaciona textos, CTAs e tagline da logo para combinar com o novo banner
    setCopyVariant((v) => v + 1 + Math.floor(Math.random() * 2));
    setTaglineVariant((v) => v + 1 + Math.floor(Math.random() * 2));
    try {
      const { data, error } = await supabase.functions.invoke("generate-store-banner", {
        body: {
          brandName,
          persona: flow?.persona,
          salesAngle: flow?.salesAngle,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.imageUrl) setHeroImage(data.imageUrl);
    } catch (err) {
      setBannerError((err as Error).message || "Falha ao gerar banner");
    } finally {
      setGeneratingBanner(false);
    }
  };

  const getElementPath = (element: EditableDomElement, root: HTMLElement): string => {
    const parts: string[] = [];
    let current: Element | null = element;
    while (current && current !== root) {
      const parent = current.parentElement;
      if (!parent) break;
      const index = Array.from(parent.children).indexOf(current);
      parts.unshift(`${current.tagName.toLowerCase()}:${index}`);
      current = parent;
    }
    return parts.join(">");
  };

  const getElementByPath = (path: string): EditableDomElement | null => {
    const root = previewRef.current;
    if (!root || !path) return null;
    let current: Element = root;
    for (const part of path.split(">")) {
      const [, indexValue] = part.split(":");
      const index = Number(indexValue);
      if (!Number.isInteger(index)) return null;
      const child = current.children.item(index);
      if (!(child instanceof HTMLElement) && !(child instanceof SVGElement)) return null;
      current = child;
    }
    return (current instanceof HTMLElement || current instanceof SVGElement) && current !== root ? current : null;
  };

  const getEditableTarget = (target: Element): EditableDomElement | null => {
    const svg = target.closest("svg");
    if (svg instanceof SVGElement) return svg;
    const interactive = target.closest('button,[data-editor-role="button"]');
    if (interactive instanceof HTMLElement) return interactive;
    const explicit = target.closest("[data-editor-type]");
    if (explicit instanceof HTMLElement || explicit instanceof SVGElement) return explicit;
    if (target instanceof HTMLImageElement) return target;
    const textTarget = target.closest("h1,h2,h3,p,span,strong,a,button,li");
    if (textTarget instanceof HTMLElement) return textTarget;
    const section = target.closest("[data-editor-section]");
    if (section instanceof HTMLElement) return section;
    return target === previewRef.current || (!(target instanceof HTMLElement) && !(target instanceof SVGElement)) ? null : target;
  };

  const getEditorElementType = (element: EditableDomElement): EditorElementType => {
    const explicit = element.dataset.editorType as EditorElementType | undefined;
    if (explicit === "image" || explicit === "icon" || explicit === "text" || explicit === "other") return explicit;
    if (element instanceof HTMLImageElement) return "image";
    if (element.tagName.toLowerCase() === "svg") return "icon";
    if (element.textContent?.trim() && !element.querySelector("img,svg")) return "text";
    return "other";
  };

  const getEditorElementLabel = (element: EditableDomElement, type: EditorElementType) => {
    const explicitLabel = element.getAttribute("data-editor-label") || element.getAttribute("aria-label");
    if (explicitLabel) return explicitLabel;
    if (element.hasAttribute("data-editor-section")) return "Seção da página";
    if (element.tagName.toLowerCase() === "button") return "Botão";
    if (type === "image") return "Imagem";
    if (type === "icon") return "Ícone";
    if (type === "text") return "Texto";
    return "Elemento";
  };

  const getElementRect = (element: EditableDomElement) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  };

  const detectTextAlign = (value: string): "left" | "center" | "right" => {
    if (value === "left" || value === "right" || value === "center") return value;
    return "center";
  };

  const detectFontWeight = (value: string): TextWeight => {
    const numeric = Number(value);
    if (numeric >= 700) return "700";
    if (numeric >= 600) return "600";
    if (numeric >= 500) return "500";
    return "400";
  };

  const readControlsFromElement = (element: EditableDomElement, type: EditorElementType): ContextControls => {
    const computed = window.getComputedStyle(element);
    const override = selectedPath ? elementOverrides[selectedPath] : undefined;
    const color = override?.color || computed.color || accent;
    const fontSize = Number.parseFloat(computed.fontSize || "16") || 16;
    const iconSize =
      Number.parseFloat(element.getAttribute("width") || "") ||
      Number.parseFloat(element.style.width || "") ||
      Math.round(element.getBoundingClientRect().width) ||
      42;

    return {
      color,
      hoverBackgroundColor: override?.hoverBackgroundColor ?? "#303337",
      fontSize: Math.round(override?.fontSize ?? fontSize),
      fontWeight: override?.fontWeight ?? detectFontWeight(computed.fontWeight),
      textAlign: override?.textAlign ?? detectTextAlign(computed.textAlign),
      borderRadius: Math.max(0, Math.round(override?.borderRadius ?? (Number.parseFloat(computed.borderRadius || "0") || 0))),
      imageShape: override?.imageShape ?? "auto",
      iconName: override?.iconName ?? element.dataset.editorIcon ?? (type === "icon" ? "Sparkles" : "Sparkles"),
      iconSize: Math.max(12, Math.round(override?.iconSize ?? iconSize)),
    };
  };

  const clearSelection = () => {
    selectedElementRef.current?.removeAttribute("data-editor-selected");
    selectedElementRef.current = null;
    setSelectedPath(null);
    setSelectedElement(null);
    setPageSelected(false);
    setContextNotice(null);
    setMediaModalOpen(false);
    setIconPickerOpen(false);
    setWeightMenuOpen(false);
    setButtonToolbarPanel(null);
    setFillPickerOpen(false);
  };

  const selectElement = (element: EditableDomElement, options?: { openMedia?: boolean }) => {
    const root = previewRef.current;
    if (!root) return;
    const path = getElementPath(element, root);
    const type = getEditorElementType(element);
    setPageSelected(false);
    setSelectedPath(path);
    setSelectedElement({ path, type, label: getEditorElementLabel(element, type), rect: getElementRect(element) });
    setContextControls(readControlsFromElement(element, type));
    const computedBackground = window.getComputedStyle(element).backgroundColor;
    setFillColor(colorToHex(elementOverrides[path]?.backgroundColor ?? computedBackground, "#111111"));
    if (type !== "icon") setIconPickerOpen(false);
    if (type !== "text") setWeightMenuOpen(false);
    setButtonToolbarPanel(null);
    setFillPickerOpen(false);
    setMediaModalOpen(type === "image" && Boolean(options?.openMedia));
  };

  const applyOverrideToElement = (element: EditableDomElement, override: ElementOverride) => {
    if (element.dataset.editorOriginalBackgroundColor === undefined) {
      element.dataset.editorOriginalBackgroundColor = element.style.backgroundColor;
    }
    if (override.backgroundColor) {
      element.style.backgroundColor = override.backgroundColor;
      element.dataset.editorFillOverride = "true";
    }
    if (override.hoverBackgroundColor) {
      element.style.setProperty("--editor-hover-bg", override.hoverBackgroundColor);
      element.dataset.editorHoverBg = "true";
    }
    if (override.color) {
      if (element.dataset.editorOriginalColor === undefined) element.dataset.editorOriginalColor = element.style.color;
      element.style.color = override.color;
      if (element.tagName.toLowerCase() === "svg") {
        element.setAttribute("color", override.color);
        element.style.color = override.color;
      }
    }
    if (override.textContent !== undefined && !element.querySelector("svg")) {
      element.textContent = override.textContent;
    }
    if (override.buttonTextContent !== undefined) {
      const inlineText = element.querySelector("[data-editor-inline-text]");
      if (inlineText instanceof HTMLElement) {
        inlineText.textContent = override.buttonTextContent;
      } else {
        const textNode = Array.from(element.childNodes).find(
          (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
        );
        if (textNode) textNode.textContent = ` ${override.buttonTextContent} `;
      }
    }
    if (override.fontSize) {
      if (element.dataset.editorOriginalFontSize === undefined) element.dataset.editorOriginalFontSize = element.style.fontSize;
      element.style.fontSize = `${override.fontSize}px`;
    }
    if (override.fontWeight) {
      if (element.dataset.editorOriginalFontWeight === undefined) element.dataset.editorOriginalFontWeight = element.style.fontWeight;
      element.style.fontWeight = override.fontWeight;
    }
    if (override.textAlign) {
      if (element.dataset.editorOriginalTextAlign === undefined) element.dataset.editorOriginalTextAlign = element.style.textAlign;
      element.style.textAlign = override.textAlign;
    }
    if (override.borderRadius !== undefined) {
      if (element.dataset.editorOriginalBorderRadius === undefined) element.dataset.editorOriginalBorderRadius = element.style.borderRadius;
      element.style.borderRadius = `${override.borderRadius}px`;
    }
    if (override.borderColor !== undefined) {
      if (element.dataset.editorOriginalBorderColor === undefined) element.dataset.editorOriginalBorderColor = element.style.borderColor;
      element.style.borderColor = override.borderColor;
      element.style.borderStyle = "solid";
    }
    if (override.borderWidth !== undefined) {
      if (element.dataset.editorOriginalBorderWidth === undefined) element.dataset.editorOriginalBorderWidth = element.style.borderWidth;
      element.style.borderWidth = `${override.borderWidth}px`;
      element.style.borderStyle = "solid";
    }
    if (override.paddingInline !== undefined) {
      if (element.dataset.editorOriginalPaddingInline === undefined) element.dataset.editorOriginalPaddingInline = element.style.paddingInline;
      element.style.paddingInline = `${override.paddingInline}px`;
    }
    if (override.minHeight !== undefined) {
      if (element.dataset.editorOriginalMinHeight === undefined) element.dataset.editorOriginalMinHeight = element.style.minHeight;
      element.style.minHeight = `${override.minHeight}px`;
      element.style.height = "auto";
    }
    if (override.imageSrc && element instanceof HTMLImageElement) {
      element.src = override.imageSrc;
    }
    if (override.imageShape && element instanceof HTMLImageElement) {
      if (element.dataset.editorOriginalBorderRadius === undefined) element.dataset.editorOriginalBorderRadius = element.style.borderRadius;
      if (element.dataset.editorOriginalAspectRatio === undefined) element.dataset.editorOriginalAspectRatio = element.style.aspectRatio;
      if (element.dataset.editorOriginalObjectFit === undefined) element.dataset.editorOriginalObjectFit = element.style.objectFit;
      if (override.imageShape === "auto") {
        element.style.borderRadius = element.dataset.editorOriginalBorderRadius || "";
        element.style.aspectRatio = element.dataset.editorOriginalAspectRatio || "";
        element.style.objectFit = element.dataset.editorOriginalObjectFit || "";
      } else {
        element.style.aspectRatio = override.imageShape === "wide" ? "16 / 9" : "1 / 1";
        element.style.objectFit = "cover";
        element.style.borderRadius = override.imageShape === "circle" ? "9999px" : "12px";
      }
    }
    if (element.tagName.toLowerCase() === "svg" && (override.iconName || override.iconSize || override.color)) {
      const iconName = override.iconName ?? element.dataset.editorIcon ?? "Sparkles";
      const iconSize = override.iconSize ?? (Number(element.getAttribute("width")) || 24);
      const iconColor = override.color ?? (element.style.color || "currentColor");
      const template = document.createElement("template");
      template.innerHTML = renderIconMarkup(iconName, iconSize, iconColor);
      const svg = template.content.firstElementChild;
      if (svg instanceof SVGElement) {
        element.innerHTML = svg.innerHTML;
        element.setAttribute("viewBox", svg.getAttribute("viewBox") || "0 0 24 24");
        element.setAttribute("width", String(iconSize));
        element.setAttribute("height", String(iconSize));
        element.style.width = `${iconSize}px`;
        element.style.height = `${iconSize}px`;
        element.style.color = iconColor;
        element.dataset.editorIcon = iconName;
      }
    }
    if (
      (element.tagName.toLowerCase() === "button" || element.getAttribute("data-editor-role") === "button") &&
      (override.buttonIconName || override.buttonIconSize || override.buttonIconColor || override.buttonIconHidden !== undefined)
    ) {
      let icon = element.querySelector("svg");
      if (!icon && override.buttonIconName && !override.buttonIconHidden) {
        const template = document.createElement("template");
        template.innerHTML = renderIconMarkup(
          override.buttonIconName,
          override.buttonIconSize ?? 16,
          override.buttonIconColor ?? "currentColor",
        );
        const createdIcon = template.content.firstElementChild;
        if (createdIcon instanceof SVGSVGElement) {
          element.append(createdIcon);
          icon = createdIcon;
        }
      }
      if (icon instanceof SVGElement) {
        if (override.buttonIconName) {
          const template = document.createElement("template");
          template.innerHTML = renderIconMarkup(
            override.buttonIconName,
            override.buttonIconSize ?? (Number(icon.getAttribute("width")) || 16),
            override.buttonIconColor ?? "currentColor",
          );
          const replacement = template.content.firstElementChild;
          if (replacement instanceof SVGSVGElement) {
            icon.replaceWith(replacement);
            icon = replacement;
          }
        }
        if (override.buttonIconSize) {
          icon.setAttribute("width", String(override.buttonIconSize));
          icon.setAttribute("height", String(override.buttonIconSize));
          icon.style.width = `${override.buttonIconSize}px`;
          icon.style.height = `${override.buttonIconSize}px`;
        }
        if (override.buttonIconColor) {
          icon.setAttribute("color", override.buttonIconColor);
          icon.style.color = override.buttonIconColor;
        }
        icon.style.display = override.buttonIconHidden ? "none" : "";
      }
    }
  };

  const resetElementOverride = (element: EditableDomElement) => {
    const originalBackground = element.dataset.editorOriginalBackgroundColor;
    if (originalBackground) element.style.backgroundColor = originalBackground;
    else element.style.removeProperty("background-color");
    delete element.dataset.editorOriginalBackgroundColor;
    delete element.dataset.editorFillOverride;
    delete element.dataset.editorHoverBg;
    element.style.removeProperty("--editor-hover-bg");
    element.style.color = element.dataset.editorOriginalColor || "";
    element.style.fontSize = element.dataset.editorOriginalFontSize || "";
    element.style.fontWeight = element.dataset.editorOriginalFontWeight || "";
    element.style.textAlign = element.dataset.editorOriginalTextAlign || "";
    element.style.borderRadius = element.dataset.editorOriginalBorderRadius || "";
    element.style.borderColor = element.dataset.editorOriginalBorderColor || "";
    element.style.borderWidth = element.dataset.editorOriginalBorderWidth || "";
    element.style.paddingInline = element.dataset.editorOriginalPaddingInline || "";
    element.style.minHeight = element.dataset.editorOriginalMinHeight || "";
    element.style.height = "";
    element.style.aspectRatio = element.dataset.editorOriginalAspectRatio || "";
    element.style.objectFit = element.dataset.editorOriginalObjectFit || "";
    delete element.dataset.editorOriginalColor;
    delete element.dataset.editorOriginalFontSize;
    delete element.dataset.editorOriginalFontWeight;
    delete element.dataset.editorOriginalTextAlign;
    delete element.dataset.editorOriginalBorderRadius;
    delete element.dataset.editorOriginalBorderColor;
    delete element.dataset.editorOriginalBorderWidth;
    delete element.dataset.editorOriginalPaddingInline;
    delete element.dataset.editorOriginalMinHeight;
    delete element.dataset.editorOriginalAspectRatio;
    delete element.dataset.editorOriginalObjectFit;
  };

  const updateSelectedOverride = (override: ElementOverride) => {
    if (!selectedElement?.path) return;
    const path = selectedElement.path;
    const nextOverride = { ...(elementOverrides[path] ?? {}), ...override };
    setElementOverrides((prev) => ({ ...prev, [path]: nextOverride }));
    const element = getElementByPath(path);
    if (element) applyOverrideToElement(element, nextOverride);
  };

  const applyFillToPath = (path: string, color: string) => {
    setElementOverrides((prev) => ({ ...prev, [path]: { backgroundColor: color } }));
    const element = getElementByPath(path);
    if (element) applyOverrideToElement(element, { backgroundColor: color });
  };

  const resetPathOverride = (path: string) => {
    setElementOverrides((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    const element = getElementByPath(path);
    if (element) resetElementOverride(element);
  };

  const startInlineEditing = (target: HTMLElement) => {
    if (!target.textContent?.trim()) return;
    const root = previewRef.current;
    if (!root) return;
    const selectedTarget =
      target.matches('button,[data-editor-role="button"]')
        ? target
        : getEditableTarget(target) ?? target;
    const isButton =
      selectedTarget instanceof HTMLElement &&
      (selectedTarget.matches("button") || selectedTarget.getAttribute("data-editor-role") === "button");
    const path = getElementPath(selectedTarget, root);
    let editingTarget = target;

    if (isButton && selectedTarget instanceof HTMLElement) {
      const existingText = selectedTarget.querySelector("[data-editor-inline-text]");
      if (existingText instanceof HTMLElement) {
        editingTarget = existingText;
      } else {
        const textNode = Array.from(selectedTarget.childNodes).find(
          (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
        );
        if (textNode) {
          const span = document.createElement("span");
          span.dataset.editorInlineText = "true";
          span.textContent = textNode.textContent?.trim() ?? "";
          textNode.replaceWith(span);
          editingTarget = span;
        }
      }
    }

    // Detecta se o texto original é um preço (começa com "R$"). Nesse caso
    // protegemos o prefixo "R$ " contra apagamento durante a edição inline.
    const originalText = editingTarget.textContent ?? "";
    const isPrice = /^\s*R\$/i.test(originalText);
    const PRICE_PREFIX = "R$ ";

    editingTarget.dataset.editorType = editingTarget.dataset.editorType || "text";
    editingTarget.setAttribute("contenteditable", "true");
    editingTarget.style.outline = "2px solid #7b8188";
    editingTarget.style.outlineOffset = "3px";
    editingTarget.style.cursor = "text";
    editingTarget.focus();

    requestAnimationFrame(() => {
      const selection = window.getSelection();
      const range = document.createRange();
      if (isPrice) {
        // Coloca o cursor no final para editar o número, mantendo o "R$".
        range.selectNodeContents(editingTarget);
        range.collapse(false);
      } else {
        range.selectNodeContents(editingTarget);
      }
      selection?.removeAllRanges();
      selection?.addRange(range);
    });

    const enforcePricePrefix = () => {
      const current = editingTarget.textContent ?? "";
      if (!/^R\$\s?/i.test(current)) {
        // Restaura o prefixo se o usuário conseguir apagá-lo.
        const rest = current.replace(/^R?\$?\s*/i, "");
        editingTarget.textContent = PRICE_PREFIX + rest;
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editingTarget);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    };

    const handleBeforeInput = (event: Event) => {
      if (!isPrice) return;
      const inputEvent = event as InputEvent;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const text = editingTarget.textContent ?? "";
      // Calcula o offset dentro do editingTarget
      const preRange = range.cloneRange();
      preRange.selectNodeContents(editingTarget);
      preRange.setEnd(range.startContainer, range.startOffset);
      const startOffset = preRange.toString().length;
      const endOffset = startOffset + range.toString().length;
      const prefixLen = /^R\$\s/.test(text) ? 3 : 2;

      if (inputEvent.inputType?.startsWith("delete")) {
        // Bloqueia deleção que atinja o prefixo "R$ ".
        if (inputEvent.inputType === "deleteContentBackward") {
          if (startOffset <= prefixLen && endOffset <= prefixLen) {
            event.preventDefault();
            return;
          }
        } else if (inputEvent.inputType === "deleteContentForward") {
          if (startOffset < prefixLen) {
            event.preventDefault();
            return;
          }
        } else if (startOffset < prefixLen) {
          event.preventDefault();
          return;
        }
      } else if (inputEvent.inputType?.startsWith("insert")) {
        // Impede inserção antes do prefixo.
        if (startOffset < prefixLen) {
          event.preventDefault();
          const selectionRange = document.createRange();
          selectionRange.selectNodeContents(editingTarget);
          selectionRange.collapse(false);
          selection.removeAllRanges();
          selection.addRange(selectionRange);
        }
      }
    };

    const handleInput = () => {
      if (isPrice) enforcePricePrefix();
    };

    if (isPrice) {
      editingTarget.addEventListener("beforeinput", handleBeforeInput);
      editingTarget.addEventListener("input", handleInput);
    }

    const cleanup = () => {
      let editedText = editingTarget.innerText.trim();
      let priceValue: number | null = null;
      if (isPrice && editedText) {
        if (!/^R\$/i.test(editedText)) {
          editedText = PRICE_PREFIX + editedText.replace(/^R?\$?\s*/i, "");
        }
        // Centavos são obrigatórios: "R$ 30" vira "R$ 30,00" no canvas e o valor
        // numérico segue para metadata.price (carrinho/checkout).
        const normalized = normalizePriceText(editedText);
        if (normalized) {
          editedText = normalized.text;
          priceValue = normalized.value;
        }
        editingTarget.textContent = editedText;
      }
      editingTarget.removeAttribute("contenteditable");
      editingTarget.style.outline = "";
      editingTarget.style.outlineOffset = "";
      editingTarget.style.cursor = "";
      editingTarget.removeEventListener("blur", cleanup);
      editingTarget.removeEventListener("beforeinput", handleBeforeInput);
      editingTarget.removeEventListener("input", handleInput);
      if (!editedText) return;
      if (priceValue !== null) setEditedPrice(priceValue);
      setElementOverrides((previous) => ({
        ...previous,
        [path]: {
          ...(previous[path] ?? {}),
          ...(isButton ? { buttonTextContent: editedText } : { textContent: editedText }),
        },
      }));
    };
    editingTarget.addEventListener("blur", cleanup);
  };

  const handleFillColorChange = (color: string) => {
    setFillColor(color);
    setAccent(color);
    if (selectedPath) applyFillToPath(selectedPath, color);
  };

  const handleToolbarToolClick = (tool: ToolbarTool) => {
    setEditMode((current) => (current === tool && tool === "select" ? null : tool));
    if (tool !== "fill") setFillPickerOpen(false);

    if (tool === "edit" && selectedPath) {
      const element = getElementByPath(selectedPath);
      if (element instanceof HTMLElement) startInlineEditing(element);
    }
    if (tool === "fill") setFillPickerOpen(Boolean(selectedPath));
    if (tool === "eraser" && selectedPath) resetPathOverride(selectedPath);
  };

  const handleCanvasToolbarClick = (tool: CanvasToolbarMode) => {
    setCanvasToolbarMode(tool);
    if (tool === "select") {
      setEditMode("select");
      setFillPickerOpen(false);
      return;
    }
    if (tool === "edit") {
      handleToolbarToolClick("edit");
      return;
    }
    if (tool === "pan") {
      setEditMode(null);
      setFillPickerOpen(false);
      return;
    }
    if (tool === "media") {
      if (selectedElement?.type === "image") contextMediaInput.current?.click();
      else imageInput.current?.click();
      return;
    }
    if (tool === "appearance") {
      handleToolbarToolClick("fill");
      if (!selectedPath) setContextNotice("Selecione um elemento para ajustar sua aparência.");
      return;
    }
    setEditorPanelTab("detalhes");
    setSidebarCollapsed(false);
  };

  const focusCreationElement = (selector: string, label: string) => {
    const element = previewRef.current?.querySelector(selector);
    if (!(element instanceof HTMLElement)) {
      setContextNotice(`${label} ainda não está disponível nesta página.`);
      return;
    }
    setCanvasToolbarMode("select");
    selectElement(element, { openMedia: element instanceof HTMLImageElement });
  };

  const handleCreationLibraryAction = (action: string) => {
    if (action === "image") {
      setCanvasToolbarMode("media");
      imageInput.current?.click();
      return;
    }
    if (action === "logo") {
      logoInput.current?.click();
      return;
    }
    if (action === "file") {
      creationFileInput.current?.click();
      return;
    }
    const targetByAction: Record<string, { selector: string; label: string }> = {
      button: { selector: "button:not([data-editor-ignore]), a", label: "Botão" },
      title: { selector: "h1, h2, h3", label: "Título" },
      text: { selector: "p", label: "Bloco de texto" },
      list: { selector: "li", label: "Lista" },
      quote: { selector: "blockquote, p", label: "Citação" },
      link: { selector: "a", label: "Link" },
    };
    const target = targetByAction[action];
    if (target) focusCreationElement(target.selector, target.label);
  };

  const handleCreationFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setContextNotice(`Arquivo “${file.name}” selecionado para a página.`);
    event.target.value = "";
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoImage(URL.createObjectURL(file));
    setContextNotice("Logo atualizado na página.");
    event.target.value = "";
  };

  useEffect(() => {
    selectedElementRef.current?.removeAttribute("data-editor-selected");
    const element = selectedPath ? getElementByPath(selectedPath) : null;
    if (element) element.setAttribute("data-editor-selected", "true");
    selectedElementRef.current = element;
  }, [selectedPath]);

  useEffect(() => {
    if (!selectedElement?.path) return;
    const update = () => {
      const element = getElementByPath(selectedElement.path);
      if (!element) {
        clearSelection();
        return;
      }
      setSelectedElement((current) => (current ? { ...current, rect: getElementRect(element) } : current));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [selectedElement?.path, canvasOffset.x, canvasOffset.y, canvasZoom]);

  useEffect(() => {
    Object.entries(elementOverrides).forEach(([path, override]) => {
      const element = getElementByPath(path);
      if (element) applyOverrideToElement(element, override);
    });
  }, [elementOverrides]);

  const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!previewRef.current) return;
    if (suppressPreviewClickRef.current) {
      suppressPreviewClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (canvasToolbarMode === "pan") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    setSidebarCollapsed(false);
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-editor-ignore]")) return;
    const editableTarget = getEditableTarget(target);
    if (!editableTarget) {
      clearSelection();
      setPageSelected(true);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const type = getEditorElementType(editableTarget);
    selectElement(editableTarget, {
      openMedia: type === "image" && canvasToolbarMode === "media",
    });

    if (canvasToolbarMode === "edit") {
      if (type === "text" && editableTarget instanceof HTMLElement) startInlineEditing(editableTarget);
      else if (type === "image" && editableTarget instanceof HTMLImageElement && editableTarget.dataset.editorProduct === "true") {
        setReplacingProductPath(getElementPath(editableTarget, previewRef.current));
        setDraftProductIds([]);
        setContextDrawer("products");
      } else if (type === "image") setMediaModalOpen(true);
      return;
    }
    if (canvasToolbarMode === "media" && type === "image") {
      if (editableTarget instanceof HTMLImageElement && editableTarget.dataset.editorProduct === "true") {
        setReplacingProductPath(getElementPath(editableTarget, previewRef.current));
        setDraftProductIds([]);
        setContextDrawer("products");
      } else {
        setMediaModalOpen(true);
      }
      return;
    }
    if (canvasToolbarMode === "appearance") {
      setFillPickerOpen(true);
      return;
    }
    if (editMode === "eraser") {
      resetPathOverride(getElementPath(editableTarget, previewRef.current));
    }
  };

  const handlePreviewDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (canvasToolbarMode === "pan") return;
    const target = event.target;
    if (!(target instanceof Element) || target.closest("[data-editor-ignore]")) return;
    const editableTarget = getEditableTarget(target);
    if (!(editableTarget instanceof HTMLElement)) return;
    const type = getEditorElementType(editableTarget);
    const isButton =
      editableTarget.matches("button") ||
      editableTarget.getAttribute("data-editor-role") === "button";
    if (type !== "text" && !isButton) return;

    event.preventDefault();
    event.stopPropagation();
    selectElement(editableTarget);
    startInlineEditing(editableTarget);
  };

  const getSelectedDomElement = () =>
    selectedElement?.path ? getElementByPath(selectedElement.path) : null;

  const handleContextImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || selectedElement?.type !== "image") return;
    const objectUrl = URL.createObjectURL(file);
    const element = getSelectedDomElement();
    if (element?.dataset.editorId === "hero-image") setHeroImage(objectUrl);
    updateSelectedOverride({ imageSrc: objectUrl });
    setContextNotice("Imagem atualizada no preview.");
    event.target.value = "";
  };

  const handleImageShapeChange = (shape: ImageShape) => {
    setContextControls((current) => ({ ...current, imageShape: shape }));
    updateSelectedOverride({ imageShape: shape });
  };

  const handleAiPlaceholder = (label: string) => {
    setContextNotice(`${label} ainda não está disponível.`);
  };

  // Reescreve o texto selecionado com a Edge Function `chat` (Gemini via gateway).
  // Passa mode "product_description" para o prompt do fluxo de onboarding não
  // entrar na conversa — aqui queremos só o texto reescrito de volta.
  const handleRewriteText = async () => {
    const path = selectedElement?.path;
    if (!path || rewritingText) return;
    const element = getElementByPath(path);
    const original = element instanceof HTMLElement ? element.innerText.trim() : "";
    if (!original) {
      setContextNotice("Selecione um texto para reescrever.");
      return;
    }

    setRewritingText(true);
    setContextNotice("Reescrevendo com IA...");
    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          mode: "product_description",
          messages: [{
            role: "user",
            content: `Você é copywriter de e-commerce brasileiro. Reescreva o texto abaixo em português do Brasil, mais persuasivo e claro, mantendo o mesmo assunto e um comprimento parecido. Não invente características, garantias, prazos nem números que não estejam no original — preserve preços e valores exatamente como estão. Responda APENAS com o texto reescrito, sem aspas, sem markdown e sem comentários.\n\nTexto original:\n${original}`,
          }],
        },
      });

      if (error) throw error;
      const raw = data?.response || data?.choices?.[0]?.message?.content || "";
      // O modelo às vezes devolve o texto entre aspas mesmo sendo instruído.
      const rewritten = typeof raw === "string" ? raw.trim().replace(/^["“”']|["“”']$/g, "").trim() : "";
      if (!rewritten) throw new Error("resposta vazia");

      updateSelectedOverride({ textContent: rewritten });
      setContextNotice("Texto reescrito com IA.");
    } catch (error) {
      console.error("Erro ao reescrever texto com IA:", error);
      setContextNotice("Não foi possível reescrever o texto agora.");
    } finally {
      setRewritingText(false);
    }
  };

  const duplicateSelectedElement = () => {
    const element = getSelectedDomElement();
    if (!element || !previewRef.current) return;
    const clone = element.cloneNode(true) as EditableDomElement;
    clone.removeAttribute("data-editor-selected");
    clone.style.transform = `${clone.style.transform || ""} translate(10px, 10px)`.trim();
    element.insertAdjacentElement("afterend", clone);
    selectElement(clone);
  };

  const deleteSelectedElement = () => {
    const element = getSelectedDomElement();
    if (!element) return;
    element.remove();
    clearSelection();
  };

  const applyTextAlign = (textAlign: ContextControls["textAlign"]) => {
    setContextControls((current) => ({ ...current, textAlign }));
    updateSelectedOverride({ textAlign });
  };

  const applyTextSize = (delta: number) => {
    const next = Math.max(8, Math.min(96, contextControls.fontSize + delta));
    setContextControls((current) => ({ ...current, fontSize: next }));
    updateSelectedOverride({ fontSize: next });
  };

  const applyTextWeight = (fontWeight: TextWeight) => {
    setWeightMenuOpen(false);
    setContextControls((current) => ({ ...current, fontWeight }));
    updateSelectedOverride({ fontWeight });
  };

  const applyElementColor = (color: string) => {
    setContextControls((current) => ({ ...current, color }));
    setAccent(color);
    updateSelectedOverride({ color });
  };

  const applyElementBackground = (color: string) => {
    setFillColor(color);
    updateSelectedOverride({ backgroundColor: color });
  };

  const applyElementHoverBackground = (color: string) => {
    setContextControls((current) => ({ ...current, hoverBackgroundColor: color }));
    updateSelectedOverride({ hoverBackgroundColor: color });
  };

  const applyButtonRadius = (delta: number) => {
    const next = Math.max(0, Math.min(999, contextControls.borderRadius + delta));
    setContextControls((current) => ({ ...current, borderRadius: next }));
    updateSelectedOverride({ borderRadius: next });
  };

  const applyButtonRadiusValue = (value: number) => {
    const next = Math.max(0, Math.min(999, Math.round(value)));
    setContextControls((current) => ({ ...current, borderRadius: next }));
    updateSelectedOverride({ borderRadius: next });
  };

  const toggleButtonToolbarPanel = (panel: Exclude<ButtonToolbarPanel, null>) => {
    setButtonToolbarPanel(panel);
    setEditorPanelTab("personalizar");
    setSidebarCollapsed(false);
    if (panel !== "icon") setIconPickerOpen(false);
  };

  const getButtonStylePreset = (preset: ButtonStylePreset): ElementOverride => {
    const primary = hslToHex(buttonColorHue, buttonColorSaturation, buttonColorLightness);
    const primaryHover = hslToHex(
      buttonColorHue,
      Math.min(100, buttonColorSaturation + 4),
      Math.max(5, buttonColorLightness - 9),
    );
    const secondary = hslToHex(
      buttonColorHue,
      Math.max(10, Math.round(buttonColorSaturation * 0.28)),
      Math.max(18, buttonColorLightness - 13),
    );
    const secondaryHover = hslToHex(
      buttonColorHue,
      Math.max(12, Math.round(buttonColorSaturation * 0.34)),
      Math.max(23, buttonColorLightness - 6),
    );
    const accentHue = (buttonColorHue + 42) % 360;
    const accent = hslToHex(
      accentHue,
      Math.min(100, buttonColorSaturation + 10),
      Math.min(70, buttonColorLightness + 8),
    );
    const accentHover = hslToHex(
      accentHue,
      Math.min(100, buttonColorSaturation + 14),
      Math.max(28, Math.min(61, buttonColorLightness)),
    );
    const darkest = hslToHex(buttonColorHue, Math.min(28, buttonColorSaturation), 7);

    return {
      primary: {
        backgroundColor: primary,
        hoverBackgroundColor: primaryHover,
        color: buttonColorLightness > 64 ? "#101214" : "#ffffff",
        borderColor: primary,
        borderWidth: 0,
      },
      secondary: {
        backgroundColor: secondary,
        hoverBackgroundColor: secondaryHover,
        color: "#ffffff",
        borderColor: secondary,
        borderWidth: 0,
      },
      accent: {
        backgroundColor: accent,
        hoverBackgroundColor: accentHover,
        color: buttonColorLightness > 54 ? "#17130a" : "#ffffff",
        borderColor: accent,
        borderWidth: 0,
      },
      outline: {
        backgroundColor: "transparent",
        hoverBackgroundColor: hslToHex(buttonColorHue, Math.max(16, buttonColorSaturation * 0.25), 92),
        color: primary,
        borderColor: primary,
        borderWidth: 1,
      },
      black: {
        backgroundColor: darkest,
        hoverBackgroundColor: hslToHex(buttonColorHue, Math.min(32, buttonColorSaturation), 15),
        color: "#ffffff",
        borderColor: darkest,
        borderWidth: 0,
      },
    }[preset];
  };

  const applyButtonStylePreset = (preset: ButtonStylePreset) => {
    const next = getButtonStylePreset(preset);
    setButtonStylePreset(preset);
    setFillColor(next.backgroundColor ?? "#111111");
    setContextControls((current) => ({
      ...current,
      color: next.color ?? current.color,
      hoverBackgroundColor: next.hoverBackgroundColor ?? current.hoverBackgroundColor,
    }));
    updateSelectedOverride(next);
  };

  const applyButtonCustomColor = (hue: number, saturation: number, lightness: number) => {
    const color = hslToHex(hue, saturation, lightness);
    const hoverColor = hslToHex(hue, Math.min(100, saturation + 4), Math.max(5, lightness - 9));
    setButtonColorHue(hue);
    setButtonColorSaturation(saturation);
    setButtonColorLightness(lightness);
    setFillColor(color);
    setButtonStylePreset("primary");
    setContextControls((current) => ({
      ...current,
      color: lightness > 62 ? "#101214" : "#ffffff",
      hoverBackgroundColor: hoverColor,
    }));
    updateSelectedOverride({
      backgroundColor: color,
      hoverBackgroundColor: hoverColor,
      color: lightness > 62 ? "#101214" : "#ffffff",
      borderColor: color,
      borderWidth: 0,
    });
  };

  const applyButtonSizePreset = (preset: ButtonSizePreset) => {
    const sizes: Record<ButtonSizePreset, Pick<ElementOverride, "fontSize" | "paddingInline" | "minHeight">> = {
      xs: { fontSize: 10, paddingInline: 14, minHeight: 30 },
      sm: { fontSize: 12, paddingInline: 18, minHeight: 36 },
      md: { fontSize: 14, paddingInline: 24, minHeight: 44 },
      lg: { fontSize: 16, paddingInline: 30, minHeight: 52 },
      xl: { fontSize: 18, paddingInline: 38, minHeight: 60 },
    };
    const next = sizes[preset];
    setButtonSizePreset(preset);
    setContextControls((current) => ({ ...current, fontSize: next.fontSize ?? current.fontSize }));
    updateSelectedOverride(next);
  };

  const startButtonTextEditing = () => {
    const button = getSelectedDomElement();
    if (button instanceof HTMLElement) startInlineEditing(button);
  };

  const selectButtonIcon = () => {
    toggleButtonToolbarPanel("icon");
  };

  const applyButtonIconName = (iconName: string) => {
    const button = getSelectedDomElement();
    const icon = button?.querySelector("svg");
    const size = icon instanceof SVGElement ? Number(icon.getAttribute("width")) || 16 : 16;
    updateSelectedOverride({ buttonIconName: iconName, buttonIconSize: size, buttonIconHidden: false });
    setIconPickerOpen(false);
  };

  const applyButtonIconSize = (delta: number) => {
    const button = getSelectedDomElement();
    const icon = button?.querySelector("svg");
    const current = icon instanceof SVGElement ? Number(icon.getAttribute("width")) || 16 : 16;
    updateSelectedOverride({ buttonIconSize: Math.max(10, Math.min(72, current + delta)), buttonIconHidden: false });
  };

  const applyButtonIconColor = (color: string) => {
    updateSelectedOverride({ buttonIconColor: color, buttonIconHidden: false });
  };

  const removeButtonIcon = () => {
    updateSelectedOverride({ buttonIconHidden: true });
    setIconPickerOpen(false);
  };

  const applyIconSize = (delta: number) => {
    const next = Math.max(12, Math.min(96, contextControls.iconSize + delta));
    setContextControls((current) => ({ ...current, iconSize: next }));
    updateSelectedOverride({ iconSize: next });
  };

  const applyIconName = (iconName: string) => {
    setIconPickerOpen(false);
    setContextControls((current) => ({ ...current, iconName }));
    updateSelectedOverride({ iconName });
  };
  const flow = useMemo<FlowState | null>(() => {
    const state = location.state as (Partial<FlowState> & { projectId?: string }) | null;
    let product = state?.product; let language = state?.language; let persona = state?.persona; let salesAngle = state?.salesAngle;
    try {
      if (!product) { const value = sessionStorage.getItem("velo-example-product"); product = value ? JSON.parse(value) as ExampleProduct : undefined; }
      language ||= sessionStorage.getItem("velo-store-language") || undefined;
      persona ||= sessionStorage.getItem("velo-customer-persona") || undefined;
      salesAngle ||= sessionStorage.getItem("velo-sales-angle") || undefined;
    } catch { /* fallback below */ }
    if (product && language && persona && salesAngle) return { product, language, persona, salesAngle };
    // Fallback: fluxo ja concluido anteriormente por este usuario
    const saved = getSavedStoreFlow<FlowState>(user?.id);
    if (saved && saved.product && saved.language && saved.persona && saved.salesAngle) return saved;
    // Editando um projeto salvo (veio de "Editar" na Minha Loja): abrir o editor
    // diretamente, sem exigir o fluxo de onboarding. Os produtos reais são
    // carregados a partir do projeto; aqui só garantimos um flow mínimo válido.
    if (state?.projectId || routeProjectId) {
      return {
        product: product ?? { id: "", title: "", price: 0, imageUrl: "" },
        language: language ?? "pt-BR",
        persona: persona ?? "",
        salesAngle: salesAngle ?? "",
      };
    }
    return null;
  }, [location.state, routeProjectId, user?.id]);

  useEffect(() => {
    // Só persistimos um fluxo genuinamente completo (vindo do onboarding). O flow
    // mínimo sintetizado ao editar um projeto salvo não deve sobrescrever o real.
    if (user?.id && flow?.product?.id && flow.language && flow.persona && flow.salesAngle) {
      markStoreFlowCompleted(user.id, flow);
    }
  }, [flow, user?.id]);

  const projectId = useMemo(() => {
    const state = location.state as { projectId?: string } | null;
    return routeProjectId ?? state?.projectId ?? null;
  }, [location.state, routeProjectId]);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    void (async () => {
      const { data } = await supabase.from("user_projects").select("*").eq("id", projectId).maybeSingle();
      if (active && data) setCurrentProject(data as UserProject);
    })();
    return () => { active = false; };
  }, [projectId]);

  // Onboarding "página de vendas": quando o editor abre SEM projectId mas com um
  // fluxo genuíno vindo do onboarding, cria e persiste o projeto na hora. Assim
  // ele já nasce com slug (createUserProject gera um), e as telas de Carrinho e
  // Checkout aparecem no preview do editor já no onboarding — antes o projeto só
  // era criado ao publicar, e sem slug essas telas ficavam ocultas.
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (projectId || autoCreatedRef.current || !user?.id) return;
    if (sessionStorage.getItem("velo-onboarding-choice") !== "sales-page") return;
    // Só um fluxo fresco do onboarding (não a reabertura de um projeto salvo).
    if (!flow?.product || !sessionStorage.getItem("velo-example-product")) return;
    autoCreatedRef.current = true;
    void (async () => {
      try {
        const nome =
          sessionStorage.getItem("velo-store-name")?.trim() ||
          flow.product.title?.trim() ||
          "Minha loja";
        const project = await createUserProject({
          nome,
          descricao: flow.salesAngle ?? "",
          tipo: "pagina_venda",
          productIds: flow.product.id ? [flow.product.id] : [],
          template: activeTemplate.id,
        });
        // Assume a rota com id: o efeito acima carrega o projeto (com slug) e as
        // telas de Carrinho/Checkout passam a renderizar.
        navigate(`/minha-loja/editor/${project.id}`, { replace: true, state: flow });
      } catch (error) {
        autoCreatedRef.current = false;
        console.error("Falha ao criar o projeto no onboarding:", error);
      }
    })();
  }, [projectId, user?.id, flow, activeTemplate.id, navigate]);

  // Carrega os produtos que o usuário escolheu para este projeto. Sem isso o
  // editor caía nas coleções do usuário (fetchEditorCollectionProducts), e o
  // produto em destaque acabava sendo o mais recente de qualquer coleção — não
  // o que foi selecionado no wizard.
  useEffect(() => {
    const ids = getProjectProductIds(currentProject);
    if (ids.length === 0) { setProjectProducts([]); return; }
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("id,title,suggested_price,cost_price,original_price,images,category,variants")
        .in("id", ids)
        .eq("is_active", true)
        .eq("is_blocked", false);
      if (!active || error) return;
      // Preserva a ordem em que o usuário selecionou: productIds[0] é o destaque.
      const order = new Map(ids.map((id, index) => [id, index]));
      const mapped = (data ?? [])
        .map((item) => ({
          id: item.id,
          title: item.title,
          // Mesmo preço que a página publicada mostra (suggested_price), para o
          // preview do editor não divergir da loja no ar.
          price: Number(item.suggested_price ?? 0) || Number(item.cost_price) * 5 || 0,
          // Só existe quando o fornecedor pratica desconto real (a coluna tem
          // DEFAULT 0); 0 vira null para não renderizar "de R$ 0,00".
          originalPrice: Number(item.original_price) || null,
          variants: parseVariantOptions(item.variants),
          imageUrl: getFirstImage(item.images),
          // Galeria completa do fornecedor: o template mostra todas nas miniaturas.
          imageUrls: getAllImages(item.images),
          category: item.category?.trim() || "Outros",
        }))
        .filter((item) => item.imageUrl)
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      setProjectProducts(mapped);
    })();
    return () => { active = false; };
  }, [currentProject]);

  // Hidrata template e nome a partir do projeto salvo (uma vez por projeto),
  // para renderizar exatamente o template que o usuário escolheu na criação/edição.
  const hydratedProjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentProject?.id || hydratedProjectRef.current === currentProject.id) return;
    hydratedProjectRef.current = currentProject.id;

    const metadata = currentProject.metadata;
    const meta = metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

    const templateValue = typeof meta.template === "string" ? meta.template : "";
    if (templateValue) {
      const kind: "loja" | "produto" = templateValue.startsWith("loja") ? "loja" : "produto";
      setActiveTemplate({ kind, id: templateValue });
      setDraftTemplate({ kind, id: templateValue });
      setTemplateCategory(kind);
    }

    const savedName = typeof meta.storeName === "string" && meta.storeName.trim()
      ? meta.storeName.trim()
      : currentProject.nome?.trim();
    if (savedName) setStoreName(savedName);

    // Restaura as customizações salvas para que o editor reabra idêntico ao que
    // foi publicado (as mesmas chaves são reaplicadas na página pública).
    if (typeof meta.accent === "string") setAccent(meta.accent);
    if (typeof meta.font === "string") setFont(meta.font);
    if (typeof meta.columns === "number") setColumns(meta.columns);
    if (typeof meta.heroImage === "string") setHeroImage(meta.heroImage);
    if (typeof meta.logoImage === "string") setLogoImage(meta.logoImage);
    if (typeof meta.heroCtaUrl === "string") setHeroCtaUrl(meta.heroCtaUrl);
    if (typeof meta.copyVariant === "number") setCopyVariant(meta.copyVariant);
    if (typeof meta.price === "number" && meta.price > 0) setEditedPrice(meta.price);
    if (meta.elementOverrides && typeof meta.elementOverrides === "object" && !Array.isArray(meta.elementOverrides)) {
      setElementOverrides(meta.elementOverrides as Record<string, ElementOverride>);
    }

    // Libera o canvas só depois de aplicar o template salvo.
    setHydratedProjectId(currentProject.id);
  }, [currentProject]);

  useEffect(() => {
    if (!user?.id) return;
    void claimProjectInvites().catch(() => { /* usuário sem convites ou sem plano pago */ });
  }, [user?.id]);

  const autosaveReadyRef = useRef(false);
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!autosaveReadyRef.current) {
      autosaveReadyRef.current = true;
      return;
    }
    const timeout = window.setTimeout(() => {
      void saveProjectDraft(currentProject.id, {
        storeName,
        template: activeTemplate.id,
        accent,
        font,
        columns,
        heroImage,
        logoImage,
        heroCtaUrl,
        copyVariant,
        elementOverrides,
        ...(editedPrice !== null ? { price: editedPrice } : {}),
      }).catch(() => { /* autosave silencioso */ });
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [currentProject?.id, storeName, activeTemplate, accent, font, columns, heroImage, logoImage, heroCtaUrl, copyVariant, elementOverrides, editedPrice]);

  // Broadcast em tempo real (sem esperar o autosave): assim que o dono edita
  // preço, nome ou accent no editor, o carrinho/checkout abertos em outra aba
  // ou preview refletem imediatamente via BroadcastChannel local.
  useEffect(() => {
    const metadata = currentProject?.metadata as Record<string, unknown> | null | undefined;
    const slug = typeof metadata?.slug === "string" ? metadata.slug : null;
    if (!slug || typeof BroadcastChannel === "undefined") return;
    try {
      const ch = new BroadcastChannel(`sales-page:${slug}`);
      ch.postMessage({ type: "overrides", storeName, accent, elementOverrides, price: editedPrice });
      ch.close();
    } catch { /* ignora ambientes sem suporte */ }
  }, [currentProject?.metadata, storeName, accent, elementOverrides, editedPrice]);



  const projectTitle = currentProject?.nome || storeName || "Velo";

  const closeProjectMenu = () => setProjectMenuOpen(false);

  const handleOpenAllProjects = () => { closeProjectMenu(); navigate("/dashboard/minha-loja"); };

  const handleShareProject = () => {
    if (!currentProject) {
      setContextNotice("Abra um projeto salvo para poder compartilhá-lo.");
      closeProjectMenu();
      return;
    }
    closeProjectMenu();
    setSettingsSection("equipe");
    setSettingsOpen(true);
  };

  const handleDownloadProject = () => {
    const payload = {
      id: currentProject?.id ?? projectId,
      nome: projectTitle,
      tipo_projeto: currentProject?.tipo_projeto ?? null,
      status: currentProject?.status ?? null,
      metadata: currentProject?.metadata ?? {},
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(projectTitle || "projeto").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setContextNotice("Projeto exportado como arquivo JSON.");
    closeProjectMenu();
  };

  const handleDuplicateProject = async () => {
    if (!currentProject || !user?.id) {
      setContextNotice("Abra um projeto salvo para poder duplicá-lo.");
      closeProjectMenu();
      return;
    }
    setMenuBusy(true);
    const { error } = await supabase.from("user_projects").insert({
      user_id: user.id,
      tipo_projeto: currentProject.tipo_projeto,
      status: "rascunho",
      nome: `${currentProject.nome} (cópia)`,
      preview_url: currentProject.preview_url,
      preview_storage_path: currentProject.preview_storage_path,
      source_kind: null,
      source_id: null,
      metadata: currentProject.metadata,
    });
    setMenuBusy(false);
    closeProjectMenu();
    if (error) { setContextNotice("Não foi possível duplicar o projeto agora."); return; }
    setContextNotice("Projeto duplicado com sucesso.");
    navigate("/dashboard/minha-loja");
  };

  const handleStartRename = () => { setRenameValue(projectTitle); setRenameOpen(true); closeProjectMenu(); };

  const handleConfirmRename = async () => {
    const name = renameValue.trim();
    if (!name) return;
    if (currentProject) {
      setMenuBusy(true);
      const { error } = await supabase.from("user_projects").update({ nome: name }).eq("id", currentProject.id);
      setMenuBusy(false);
      if (error) { setContextNotice("Não foi possível renomear o projeto."); return; }
      setCurrentProject({ ...currentProject, nome: name });
    }
    setStoreName(name);
    setRenameOpen(false);
    setContextNotice("Projeto renomeado.");
  };

  const handleDeleteProject = async () => {
    if (!currentProject) { setConfirmDeleteOpen(false); return; }
    setMenuBusy(true);
    const { error } = await supabase.from("user_projects").delete().eq("id", currentProject.id);
    setMenuBusy(false);
    setConfirmDeleteOpen(false);
    if (error) { setContextNotice("Não foi possível excluir o projeto."); return; }
    navigate("/dashboard/minha-loja");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setProjectMenuOpen((open) => !open);
      } else if (event.key === "Escape") {
        setProjectMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleOpenHelp = () => { closeProjectMenu(); navigate("/docs"); };
  const handleOpenSettings = () => {
    if (!currentProject) {
      setContextNotice("Abra um projeto salvo para acessar as configurações.");
      closeProjectMenu();
      return;
    }
    closeProjectMenu();
    setSettingsSection("geral");
    setSettingsOpen(true);
  };
  const handleSendFeedback = () => {
    closeProjectMenu();
    const subject = encodeURIComponent(`Feedback — ${projectTitle}`);
    window.location.href = `mailto:contato@velods.com.br?subject=${subject}`;
  };

  const projectSlug = useMemo(() => {
    const metadata = currentProject?.metadata;
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      const value = (metadata as Record<string, unknown>).slug;
      if (typeof value === "string") return value;
    }
    return "";
  }, [currentProject]);

  const publicUrl = projectSlug ? `${PUBLIC_APP_URL}/loja/${projectSlug}` : "";

  const handleOpenPublish = () => {
    if (isFreePlan) {
      setUpgradeModalOpen(true);
      return;
    }
    if (!currentProject) {
      setContextNotice("Crie ou abra um projeto salvo para poder publicá-lo.");
      return;
    }
    setPublishCopied(false);
    setPublishOpen(true);
  };

  const handleConfirmPublish = async () => {
    if (!currentProject || publishing) return;
    if (isFreePlan) {
      setPublishOpen(false);
      setUpgradeModalOpen(true);
      return;
    }
    setPublishing(true);
    try {
      const updated = await publishProject(currentProject);
      setCurrentProject(updated);
    } catch {
      setContextNotice("Não foi possível publicar agora. Tente novamente.");
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyPublicUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setPublishCopied(true);
      window.setTimeout(() => setPublishCopied(false), 1800);
    } catch {
      /* clipboard indisponível */
    }
  };

  useEffect(() => {
    if (!flow) return;
    setHeroImage("/hero-pasted-image-2.png");
    let mounted = true;
    const loadStore = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) return;

      const [profileResult, initialCollectionProductsResult, catalogSuggestionsResult] = await Promise.all([
        supabase.from("profiles").select("store_name,loja_nome").eq("user_id", userId).maybeSingle(),
        fetchEditorCollectionProducts(userId),
        supabase
          .from("catalog_products")
          .select("id,title,cost_price,images,category")
          .eq("source", "c7drop")
          .eq("is_active", true)
          .eq("is_blocked", false)
          .gt("stock_quantity", 0)
          .order("orders_count", { ascending: false, nullsFirst: false })
          .limit(24),
      ]);

      if (!mounted) return;
      let collectionProducts = initialCollectionProductsResult.data;

      if ((collectionProducts ?? []).length === 0) {
        try {
          const seedResult = await ensureExampleCollectionProducts({
            userId,
            preferredProductId: flow.product.id,
          });

          if (seedResult.inserted) {
            const retryCollectionProductsResult = await fetchEditorCollectionProducts(userId);
            collectionProducts = retryCollectionProductsResult.data;
          }
        } catch (seedError) {
          console.error("Erro ao adicionar produtos de exemplo:", seedError);
        }
      }

      const profile = profileResult.data;
      const savedName = profile?.store_name || profile?.loja_nome || sessionStorage.getItem("velo-store-name");
      if (savedName?.trim()) setStoreName(savedName.trim());

      const seen = new Set<string>();
      const mapped = (collectionProducts ?? []).flatMap((row) => {
        const joined = row.catalog_products;
        const item = Array.isArray(joined) ? joined[0] : joined;
        if (!item || seen.has(item.id)) return [];
        seen.add(item.id);
        return [{
          id: item.id,
          title: item.title,
          price: Number(item.cost_price) || 0,
          imageUrl: getFirstImage(item.images),
          imageUrls: getAllImages(item.images),
          category: item.category?.trim() || "Outros",
        }];
      }).filter((item) => item.imageUrl);
      setProducts(mapped);

      const suggestions = (catalogSuggestionsResult.data ?? []).flatMap((item) => {
        const imageUrls = getAllImages(item.images);
        const imageUrl = imageUrls[0] || "";
        if (!imageUrl) return [];
        return [{
          id: item.id,
          title: item.title,
          price: Number(item.cost_price) || 0,
          imageUrl,
          imageUrls,
          category: item.category?.trim() || "Outros",
        }];
      });
      setCatalogSuggestions(suggestions);
    };
    void loadStore();
    return () => { mounted = false; };
  }, [flow]);

  useEffect(() => {
    if (!flow) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const handleNativeCanvasWheel = (event: WheelEvent) => nativePinchZoomRef.current(event);
    workspace.addEventListener("wheel", handleNativeCanvasWheel, { passive: false, capture: true });
    return () => {
      workspace.removeEventListener("wheel", handleNativeCanvasWheel, { capture: true });
      if (wheelPanFrameRef.current !== null) cancelAnimationFrame(wheelPanFrameRef.current);
      wheelPanFrameRef.current = null;
      wheelPanDeltaRef.current = { x: 0, y: 0 };
    };
  }, [flow]);

  if (!flow) return <Navigate to="/comecar" replace />;
  // Ao abrir um projeto salvo, espera a hidratação do template antes de pintar o
  // canvas. Sem projectId (fluxo de onboarding) não há o que hidratar.
  const templateReady = !projectId || hydratedProjectId === projectId;
  // Prioridade: produtos escolhidos para este projeto > coleções do usuário >
  // produto do onboarding. Garante que o template mostre o produto selecionado.
  const baseProducts = projectProducts.length
    ? projectProducts
    : products.length
      ? products
      : [{ ...flow.product, category: "Outros" }];
  const displayedProducts = baseProducts;
  const featuredProduct = displayedProducts[0];
  // O preço editado no canvas manda na página toda: os bundles ("2 unidades"),
  // o desconto e a barra de compra derivam deste valor. Sem isso, editar o preço
  // trocava só o número do topo e as unidades seguiam no preço do catálogo.
  const featuredPrice = editedPrice ?? featuredProduct?.price ?? 149.9;
  const categories = Array.from(new Set(displayedProducts.map((product) => product.category).filter(Boolean))).slice(0, 8);
  const browseCategories = catalogTaxonomy.map((category, index) => ({
    category,
    imageUrl: displayedProducts.find((product) => product.category === category)?.imageUrl || displayedProducts[index % displayedProducts.length]?.imageUrl || heroImage,
  }));
  const menuCategories = catalogTaxonomy;
  const sidebarIconCategories = catalogTaxonomy.slice(0, 10);
  const sidebarExtraCategories = catalogTaxonomy.slice(10);
  const heroNavLinks = [
    { label: "Loja", href: "#", left: "27.85%", width: "4.9%" },
    { label: "Ofertas", href: "#ofertas", left: "35.82%", width: "5.4%" },
    { label: "Novidades", href: "#novidades", left: "44.18%", width: "6.8%" },
    { label: "Marcas", href: "#marcas", left: "52.58%", width: "5.4%" },
    { label: "Inspira\u00e7\u00e3o", href: "#inspiracao", left: "60.6%", width: "7.4%" },
  ];
  const categoryHighlights = Array.from({ length: 4 }, (_, index) => {
    const category = categories[index % categories.length] || displayedProducts[index % displayedProducts.length]?.category || "Outros";
    return {
      category,
      imageUrl: displayedProducts.find((product) => product.category === category)?.imageUrl || heroImage,
      key: `${category}-${index}`,
    };
  });
  const collectionStyles = [
    "bg-[#f4ded6]",
    "bg-[#eee8dc]",
    "bg-[#a8c9df]",
    "bg-[#f1eee5]",
  ];
  const collectionDescriptions: Record<string, string> = {
    Casa: "Peças para deixar seu espaço mais bonito.",
    "Eletr\u00f4nicos": "Acessórios úteis para simplificar sua rotina.",
    Moda: "Achados versáteis para usar todos os dias.",
    Bijuterias: "Detalhes delicados para completar o look.",
    Beleza: "Essenciais para cuidar de você.",
    "Esporte e Fitness": "Itens práticos para movimento e energia.",
    Outros: "Produtos selecionados para explorar agora.",
  };
  const trustBadges = [
    { title: "Frete Grátis", description: "Em pedidos acima de R$ 199", icon: Truck },
    { title: "Troca Fácil", description: "Em até 30 dias", icon: RefreshCcw },
    { title: "Pagamento Seguro", description: "100% protegido", icon: LockKeyhole },
    { title: "Suporte 24/7", description: "Estamos aqui pra ajudar", icon: Headphones },
  ];
  const brandName = storeName;
  const copyPool = [
    { p: "Escolhas que", s: "Facilitam seu dia", sub: "Tecnologia, casa, bem-estar e muito mais em uma sele\u00e7\u00e3o feita para voc\u00ea.", cta1: "Comprar agora", cta2: "Ver categorias" },
    { p: "Tudo o que", s: "Voc\u00ea procura", sub: "Descubra novidades \u00fateis, ofertas especiais e produtos para todos os momentos.", cta1: "Ver novidades", cta2: "Explorar loja" },
    { p: "Novas ideias", s: "Para sua rotina", sub: "Uma curadoria diversa de produtos que combinam praticidade, qualidade e bom pre\u00e7o.", cta1: "Descobrir produtos", cta2: "Ver ofertas" },
  ];
  const copy = copyPool[copyVariant % copyPool.length];
  const headlinePrimary = copy.p;
  const headlineSecondary = copy.s;
  const heroSubtitle = flow.salesAngle ? flow.salesAngle.slice(0, 120) : copy.sub;
  const ctaPrimary = copy.cta1;
  const ctaSecondary = copy.cta2;
  const heroCtaHref = heroCtaUrl.trim() || "/catalogo";
  const taglinePool = ["Escolhas para voc\u00ea", "Qualidade todo dia", "Descubra o novo", "Tudo em um s\u00f3 lugar"];
  const brandTagline = taglinePool[taglineVariant % taglinePool.length];
  const fontOptions = [
    { name: "Geist", stack: '"Geist", "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif', mood: "Refinada e delicada" },
    { name: "Plus Jakarta Sans", stack: '"Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif', mood: "Sofisticada e moderna" },
    { name: "Inter", stack: 'Inter, ui-sans-serif, system-ui, sans-serif', mood: "Marketplace limpo" },
    { name: "Helvetica Neue", stack: '"Helvetica Neue", Helvetica, sans-serif', mood: "Moderna e limpa" },
    { name: "Georgia", stack: 'Georgia, serif', mood: "Cl\u00e1ssica e elegante" },
  ];
  const templateOptions = {
    loja: [
      { id: "loja-1", name: "Template 1", desc: "Loja completa com vitrine e categorias.", image: "/template-01-loja-preview.png" },
    ],
    produto: [
      { id: "produto-1", name: "Template 1", desc: "Página de produto Velora.", image: "/template-produto-preview.png" },
      { id: "produto-2", name: "Template 2", desc: "Página de produto Beauty.", image: "/template-produto-2-preview.png" },
      { id: "produto-3", name: "Template 3", desc: "Página de produto Shopify.", image: "/template-produto-3-preview.png" },
      { id: "produto-4", name: "Template 4", desc: "Página de produto minimalista.", image: "/template-produto-4-preview.png" },
    ],
  };
  const selectedFontStack = fontOptions.find((option) => option.name === font)?.stack || fontOptions[0].stack;
  const activeTemplateOption =
    templateOptions[activeTemplate.kind].find((template) => template.id === activeTemplate.id) ?? templateOptions.loja[0];
  const drawerTemplates = templateOptions[templateCategory];
  const sidebarProducts = displayedProducts;
  const selectedStoreProductIds = new Set(sidebarProducts.map((product) => product.id));
  const replacementProducts = [...catalogSuggestions, ...displayedProducts].filter(
    (product, index, collection) => collection.findIndex((item) => item.id === product.id) === index,
  );
  const drawerProducts = replacingProductPath
    ? replacementProducts
    : catalogSuggestions.filter((product) => !selectedStoreProductIds.has(product.id));
  const togglePanelSection = (section: EditorPanelSection) => {
    setOpenPanelSections((current) => ({ ...current, [section]: !current[section] }));
  };
  const openTemplateDrawer = () => {
    setTemplateCategory(activeTemplate.kind);
    setDraftTemplate(activeTemplate);
    setContextDrawer("template");
  };
  const openProductsDrawer = () => {
    setReplacingProductPath(null);
    setDraftProductIds([]);
    setContextDrawer("products");
  };
  const openProductReplacementDrawer = () => {
    if (!selectedElement?.path) return;
    setReplacingProductPath(selectedElement.path);
    setDraftProductIds([]);
    setContextDrawer("products");
  };
  const applyTemplateDraft = () => {
    const selected = templateOptions[draftTemplate.kind].find((template) => template.id === draftTemplate.id);
    if (!selected) return;
    setCurrentTemplate(selected.name);
    setActiveTemplate(draftTemplate);
    setContextDrawer(null);
  };
  const importStoreProducts = async (selectedProducts: CatalogItem[]) => {
    if (!user?.id || sidebarImportingId || !selectedProducts.length) return;
    setSidebarImportingId(selectedProducts[0].id);

    try {
      const [latestCollection] = await listCollections(user.id, 1);
      const collection = latestCollection ?? await createCollection({
        name: "Produtos da loja",
        category: null,
        userId: user.id,
      });
      const existingProductIds = new Set(await getCollectionProductIds(collection.id));
      const productsToAdd = selectedProducts.filter((product) => !existingProductIds.has(product.id));

      for (const product of productsToAdd) {
        await addProductToCollection(collection.id, product.id);
      }

      setProducts((current) => {
        const currentIds = new Set(current.map((item) => item.id));
        return [...selectedProducts.filter((item) => !currentIds.has(item.id)), ...current];
      });
      setContextNotice(
        productsToAdd.length
          ? `${productsToAdd.length} ${productsToAdd.length === 1 ? "produto adicionado" : "produtos adicionados"} à loja.`
          : "Os produtos selecionados já estão na sua loja.",
      );
    } catch (error) {
      console.error("Erro ao adicionar produtos pelo editor:", error);
      setContextNotice("Não foi possível adicionar os produtos agora.");
    } finally {
      setSidebarImportingId(null);
    }
  };
  // metadata.productIds é a fonte da verdade do produto em destaque: o efeito que
  // carrega projectProducts reage a currentProject e tem prioridade sobre as
  // coleções (`products`). Sem atualizar aqui, adicionar ou substituir um produto
  // no editor mexia só em `products` e o template continuava no produto antigo.
  const persistProjectProductIds = async (nextIdsFrom: (current: string[]) => string[]) => {
    if (!currentProject?.id) return;
    const currentIds = getProjectProductIds(currentProject);
    const nextIds = nextIdsFrom(currentIds);
    if (nextIds.length === currentIds.length && nextIds.every((id, index) => id === currentIds[index])) return;

    const baseMetadata =
      currentProject.metadata && typeof currentProject.metadata === "object" && !Array.isArray(currentProject.metadata)
        ? (currentProject.metadata as Record<string, unknown>)
        : {};
    // Atualiza o estado local para o preview trocar na hora; o autosave abaixo
    // só persiste no banco.
    setCurrentProject({ ...currentProject, metadata: { ...baseMetadata, productIds: nextIds } as Json });

    try {
      await saveProjectDraft(currentProject.id, { productIds: nextIds });
    } catch (error) {
      console.error("Falha ao salvar os produtos do projeto:", error);
    }
  };
  const applyProductDraft = async () => {
    const selectedProducts = drawerProducts.filter((product) => draftProductIds.includes(product.id));
    if (!selectedProducts.length) return;
    if (replacingProductPath) {
      const replacement = selectedProducts[0];
      const selectedImage = getElementByPath(replacingProductPath);
      const currentProductId =
        selectedImage instanceof HTMLImageElement ? selectedImage.dataset.editorProductId : undefined;
      if (currentProductId) {
        setProducts((current) =>
          current.length
            ? current.map((product) => product.id === currentProductId ? replacement : product)
            : [replacement],
        );
        // Troca na mesma posição para não mudar qual produto está em destaque.
        await persistProjectProductIds((current) =>
          current.includes(currentProductId)
            ? current.map((id) => (id === currentProductId ? replacement.id : id))
            : current,
        );
      } else {
        const nextOverride = {
          ...(elementOverrides[replacingProductPath] ?? {}),
          imageSrc: replacement.imageUrl,
        };
        setElementOverrides((current) => ({
          ...current,
          [replacingProductPath]: nextOverride,
        }));
        if (selectedImage) applyOverrideToElement(selectedImage, nextOverride);
      }
      setDraftProductIds([]);
      setReplacingProductPath(null);
      setContextDrawer(null);
      clearSelection();
      setContextNotice(`Produto substituído por “${replacement.title}”.`);
      return;
    }
    await importStoreProducts(selectedProducts);
    // Produto recém-adicionado vira o destaque (primeiro da lista), que é o que
    // o template de produto renderiza.
    const addedIds = selectedProducts.map((product) => product.id);
    await persistProjectProductIds((current) => [
      ...addedIds,
      ...current.filter((id) => !addedIds.includes(id)),
    ]);
    setDraftProductIds([]);
    setContextDrawer(null);
  };
  const applyInlineTemplate = (kind: "loja" | "produto", template: (typeof templateOptions.loja)[number]) => {
    setCurrentTemplate(template.name);
    setActiveTemplate({ kind, id: template.id });
    setDraftTemplate({ kind, id: template.id });
    setContextNotice(`${template.name} aplicado à loja.`);
  };
  const panelSections: Array<{ id: EditorPanelSection; label: string }> = [
    { id: "template", label: "Template" },
    { id: "produtos", label: "Produtos" },
    { id: "imagem", label: "Imagem" },
    { id: "aparencia", label: "Aparência" },
  ];
  const canvasToolbarItems: Array<{ id: CanvasToolbarMode; label: string; icon: LucideIcon; dividerBefore?: boolean }> = [
    { id: "select", label: "Selecionar", icon: MousePointer2 },
    { id: "edit", label: "Editar", icon: Pencil },
    { id: "pan", label: "Mover canvas", icon: Hand },
    { id: "media", label: "Adicionar imagem", icon: ImageIcon },
    { id: "appearance", label: "Aparência", icon: Palette, dividerBefore: true },
    { id: "favorites", label: "Favoritos", icon: Star },
  ];
  const fillSwatches = ["#111111", "#2563eb", "#dc2626", "#f59e0b", "#ec4899", "#7c3aed"];
  const selectedDomElement = getSelectedDomElement();
  const selectedTagName = selectedDomElement?.tagName.toLowerCase();
  const isSelectedProductImage =
    selectedElement?.type === "image" &&
    selectedDomElement instanceof HTMLImageElement &&
    selectedDomElement.dataset.editorProduct === "true";
  const selectedMediaKind =
    selectedDomElement instanceof HTMLImageElement
      ? selectedDomElement.dataset.editorMediaKind
      : undefined;
  const selectedSectionElement =
    selectedDomElement instanceof HTMLElement
      ? selectedDomElement.matches("[data-editor-section]")
        ? selectedDomElement
        : selectedDomElement.closest<HTMLElement>("[data-editor-section]")
      : null;
  const selectedSectionAnchor = selectedSectionElement?.dataset.editorSection;
  const isSelectedButton =
    selectedTagName === "button" ||
    (selectedTagName === "a" && selectedDomElement?.getAttribute("data-editor-role") === "button");
  const selectedButtonIcon = isSelectedButton ? selectedDomElement?.querySelector("svg") : null;
  const selectedButtonIconSize =
    (selectedPath ? elementOverrides[selectedPath]?.buttonIconSize : undefined) ??
    (selectedButtonIcon instanceof SVGElement ? Number(selectedButtonIcon.getAttribute("width")) || 16 : 16);
  const selectedButtonIconColor =
    selectedPath && elementOverrides[selectedPath]?.buttonIconColor
      ? elementOverrides[selectedPath].buttonIconColor ?? "#ffffff"
      : "#ffffff";
  const selectedMediaSrc =
    selectedElement?.type === "image" && selectedDomElement instanceof HTMLImageElement
      ? selectedDomElement.currentSrc || selectedDomElement.src
      : "";
  const selectedToolbarWidth =
    isSelectedButton ? 570 : selectedElement?.type === "text" ? 720 : selectedElement?.type === "icon" ? 610 : 500;
  const selectedToolbarLeftBoundary = sidebarCollapsed ? 102 : 316;
  const selectedToolbarZoomScale = Math.max(0.4, Math.min(1, Math.sqrt(canvasZoom) * 0.78));
  const selectedToolbarAvailableWidth = Math.max(220, window.innerWidth - selectedToolbarLeftBoundary - 16);
  const selectedToolbarScale = Math.min(selectedToolbarZoomScale, selectedToolbarAvailableWidth / selectedToolbarWidth);
  const selectedToolbarHeight = selectedElement?.type === "image" ? 136 : isSelectedButton ? 52 : 62;
  const selectedToolbarVisualWidth = selectedToolbarWidth * selectedToolbarScale;
  const selectedToolbarVisualHeight = selectedToolbarHeight * selectedToolbarScale;
  const selectedToolbarTop = selectedElement
    ? selectedElement.type === "image"
      ? Math.min(
          window.innerHeight - selectedToolbarVisualHeight - 16,
          Math.max(16, selectedElement.rect.top + selectedElement.rect.height / 2 - selectedToolbarVisualHeight / 2),
        )
      : selectedElement.rect.top >= selectedToolbarVisualHeight + 18
        ? selectedElement.rect.top - selectedToolbarVisualHeight - 12
        : selectedElement.rect.top + selectedElement.rect.height + 12
    : 0;
  const selectedToolbarLeft = selectedElement
    ? selectedElement.type === "image"
      ? selectedElement.rect.left + selectedElement.rect.width + selectedToolbarVisualWidth + 28 <= window.innerWidth
        ? Math.max(selectedToolbarLeftBoundary, selectedElement.rect.left + selectedElement.rect.width + 12)
        : Math.max(selectedToolbarLeftBoundary, selectedElement.rect.left - selectedToolbarVisualWidth - 12)
      : Math.min(
          window.innerWidth - Math.min(selectedToolbarVisualWidth, window.innerWidth - 32) - 16,
          Math.max(
            selectedToolbarLeftBoundary,
            selectedElement.rect.left + selectedElement.rect.width / 2 - selectedToolbarVisualWidth / 2,
          ),
        )
    : 0;
  const selectedToolbarStyle = {
    top: selectedToolbarTop,
    left: selectedToolbarLeft,
    transform: `scale(${selectedToolbarScale})`,
    transformOrigin: "top left",
    transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), top 180ms cubic-bezier(0.22, 1, 0.36, 1), left 180ms cubic-bezier(0.22, 1, 0.36, 1)",
  } satisfies React.CSSProperties;
  const selectedImagePanelWidth = Math.min(390, window.innerWidth - 32);
  const selectedImagePanelVisualWidth = selectedImagePanelWidth * selectedToolbarScale;
  const selectedImagePanelVisualHeight = 470 * selectedToolbarScale;
  const selectedImagePanelLeft = selectedElement
    ? Math.min(
        window.innerWidth - selectedImagePanelVisualWidth - 16,
        Math.max(16, selectedElement.rect.left + selectedElement.rect.width / 2 - selectedImagePanelVisualWidth / 2),
      )
    : 16;
  const selectedImagePanelTop = selectedElement
    ? Math.min(
        window.innerHeight - selectedImagePanelVisualHeight - 16,
        Math.max(16, selectedElement.rect.top + selectedElement.rect.height / 2 - selectedImagePanelVisualHeight / 2),
      )
    : 16;
  const addSectionButtonLeft = selectedElement
    ? Math.min(
        window.innerWidth - 120,
        Math.max(selectedToolbarLeftBoundary + 90, selectedElement.rect.left + selectedElement.rect.width / 2),
      )
    : 0;
  const addSectionButtonTop = selectedElement
    ? Math.min(window.innerHeight - 34, Math.max(92, selectedElement.rect.top + selectedElement.rect.height))
    : 0;
  const resetCanvasView = () => {
    if (workspaceRef.current) {
      workspaceRef.current.scrollLeft = 0;
      workspaceRef.current.scrollTop = 0;
    }
    setCanvasOffset({ x: 0, y: 0 });
    const resetZoom = mobilePreview ? 0.88 : 0.52;
    canvasZoomRef.current = resetZoom;
    setCanvasZoom(resetZoom);
  };
  const changeCanvasZoom = (delta: number, anchor?: { clientX: number; clientY: number }) => {
    const currentZoom = canvasZoomRef.current;
    const nextZoom = Math.max(0.28, Math.min(1.2, Number((currentZoom + delta).toFixed(2))));
    if (nextZoom === currentZoom) return;
    const workspace = workspaceRef.current;
    if (workspace) {
      workspace.scrollLeft = 0;
      workspace.scrollTop = 0;
    }
    const workspaceRect = workspace?.getBoundingClientRect();
    if (!workspaceRect) {
      canvasZoomRef.current = nextZoom;
      setCanvasZoom(nextZoom);
      return;
    }
    const previewRect = previewRef.current?.getBoundingClientRect();
    const clientX = anchor?.clientX ?? (previewRect ? previewRect.left + previewRect.width / 2 : workspaceRect.left + workspaceRect.width / 2);
    const clientY = anchor?.clientY ?? (previewRect ? previewRect.top + previewRect.height / 2 : workspaceRect.top + workspaceRect.height / 2);
    const anchorX = clientX - workspaceRect.left - 330;
    const anchorY = clientY - workspaceRect.top - 130;
    setCanvasOffset((current) => ({
      x: anchorX - ((anchorX - current.x) / currentZoom) * nextZoom,
      y: anchorY - ((anchorY - current.y) / currentZoom) * nextZoom,
    }));
    canvasZoomRef.current = nextZoom;
    setCanvasZoom(nextZoom);
  };
  nativePinchZoomRef.current = (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest("[data-canvas-ui]")) return;

    event.preventDefault();
    event.stopPropagation();

    if (!event.ctrlKey && !event.metaKey) {
      wheelPanDeltaRef.current.x += event.deltaX;
      wheelPanDeltaRef.current.y += event.deltaY;
      if (wheelPanFrameRef.current === null) {
        wheelPanFrameRef.current = requestAnimationFrame(() => {
          const delta = wheelPanDeltaRef.current;
          wheelPanDeltaRef.current = { x: 0, y: 0 };
          wheelPanFrameRef.current = null;
          setCanvasOffset((current) => ({
            x: current.x - delta.x,
            y: current.y - delta.y,
          }));
        });
      }
      return;
    }

    changeCanvasZoom(event.deltaY > 0 ? -0.04 : 0.04, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };
  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target;
    // Toolbars flutuantes (data-editor-ignore) e a UI do canvas (data-canvas-ui)
    // não fazem parte da área editável: um clique nelas não deve iniciar
    // marquee/seleção nem, no clique, limpar a seleção e recolher a sidebar.
    if (target instanceof Element && target.closest("[data-canvas-ui], [data-editor-ignore]")) return;
    suppressCanvasClickRef.current = false;
    suppressPreviewClickRef.current = false;

    if (canvasToolbarMode === "pan") {
      canvasDragRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        offsetX: canvasOffset.x,
        offsetY: canvasOffset.y,
        startedOnPreview: target instanceof Element && Boolean(target.closest(".store-editor-preview")),
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsCanvasDragging(true);
      return;
    }

    if (canvasToolbarMode === "select") {
      if (target instanceof Element && target.closest(".store-editor-preview")) return;
      const workspaceRect = event.currentTarget.getBoundingClientRect();
      const startX = event.clientX - workspaceRect.left;
      const startY = event.clientY - workspaceRect.top;
      selectionDragRef.current = { startX, startY, currentX: startX, currentY: startY, moved: false };
      setSelectionMarquee({ x: startX, y: startY, width: 0, height: 0 });
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const selection = selectionDragRef.current;
    if (selection) {
      const workspaceRect = event.currentTarget.getBoundingClientRect();
      const currentX = event.clientX - workspaceRect.left;
      const currentY = event.clientY - workspaceRect.top;
      const moved = selection.moved || Math.abs(currentX - selection.startX) > 4 || Math.abs(currentY - selection.startY) > 4;
      selectionDragRef.current = { ...selection, currentX, currentY, moved };
      setSelectionMarquee({
        x: Math.min(selection.startX, currentX),
        y: Math.min(selection.startY, currentY),
        width: Math.abs(currentX - selection.startX),
        height: Math.abs(currentY - selection.startY),
      });
      return;
    }

    const drag = canvasDragRef.current;
    if (!drag) return;
    setCanvasOffset({
      x: drag.offsetX + event.clientX - drag.pointerX,
      y: drag.offsetY + event.clientY - drag.pointerY,
    });
  };
  const finishCanvasDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const selection = selectionDragRef.current;
    if (selection) {
      selectionDragRef.current = null;
      setSelectionMarquee(null);
      suppressCanvasClickRef.current = selection.moved;
      suppressPreviewClickRef.current = selection.moved;

      if (selection.moved && event.type === "pointerup") {
        const workspaceRect = event.currentTarget.getBoundingClientRect();
        const marqueeRect = {
          left: workspaceRect.left + Math.min(selection.startX, selection.currentX),
          top: workspaceRect.top + Math.min(selection.startY, selection.currentY),
          right: workspaceRect.left + Math.max(selection.startX, selection.currentX),
          bottom: workspaceRect.top + Math.max(selection.startY, selection.currentY),
        };
        const previewRect = previewRef.current?.getBoundingClientRect();
        const intersectsPreview = Boolean(
          previewRect &&
          marqueeRect.right >= previewRect.left &&
          marqueeRect.left <= previewRect.right &&
          marqueeRect.bottom >= previewRect.top &&
          marqueeRect.top <= previewRect.bottom,
        );
        clearSelection();
        if (intersectsPreview) {
          setPageSelected(true);
          setContextNotice("Página selecionada. Escolha uma ferramenta para editá-la.");
        }
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }

    const drag = canvasDragRef.current;
    if (!drag) return;
    const wasEmptyAreaClick =
      event.type === "pointerup" &&
      !drag.startedOnPreview &&
      Math.abs(event.clientX - drag.pointerX) <= 4 &&
      Math.abs(event.clientY - drag.pointerY) <= 4;
    suppressCanvasClickRef.current = !wasEmptyAreaClick;
    canvasDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setIsCanvasDragging(false);
    if (wasEmptyAreaClick) setSidebarCollapsed(true);
  };
  const handleWorkspaceClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element) || target.closest("[data-canvas-ui], [data-editor-ignore], .store-editor-preview")) return;
    if (suppressCanvasClickRef.current) {
      suppressCanvasClickRef.current = false;
      return;
    }
    clearSelection();
    setSidebarCollapsed(true);
  };
  const imageShapeOptions: Array<{ value: ImageShape; label: string; icon: LucideIcon }> = [
    { value: "auto", label: "Automático", icon: ImageIcon },
    { value: "wide", label: "Retangular", icon: LayoutGrid },
    { value: "square", label: "Quadrado", icon: Square },
    { value: "circle", label: "Circular", icon: Circle },
  ];
  const addSectionAfterSelected = () => {
    if (!selectedSectionAnchor) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setCustomSections((current) => [...current, { id, after: selectedSectionAnchor }]);
    setContextNotice("Nova seção adicionada à página.");
  };
  const renderCustomSectionsAfter = (anchor: string): React.ReactNode =>
    customSections
      .filter((section) => section.after === anchor)
      .map((section, index) => {
        const sectionAnchor = `custom-${section.id}`;
        return (
          <Fragment key={section.id}>
            <section
              data-editor-type="other"
              data-editor-section={sectionAnchor}
              data-editor-label="Seção personalizada"
              className="relative isolate overflow-hidden border-y border-black/10 bg-[#f4f2ed] px-10 py-16 text-[#151719]"
            >
              <span
                aria-hidden="true"
                className="absolute -right-16 -top-24 h-72 w-72 rounded-full opacity-10 blur-2xl"
                style={{ backgroundColor: accent }}
              />
              <div className="relative mx-auto grid max-w-[1040px] items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <span data-editor-type="text" className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>
                    Nova seção {index + 1}
                  </span>
                  <h2 data-editor-type="text" className="mt-3 max-w-[620px] text-[34px] font-semibold leading-[1.05] tracking-[-0.035em]">
                    Conte uma nova parte da história da sua loja
                  </h2>
                  <p data-editor-type="text" className="mt-4 max-w-[590px] text-[14px] leading-relaxed text-black/55">
                    Clique duas vezes nos textos para editar. Use esta área para benefícios, depoimentos, coleções ou qualquer conteúdo adicional.
                  </p>
                  <button data-editor-role="button" type="button" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-[13px] font-semibold text-white shadow-sm" style={{ backgroundColor: accent }}>
                    Explorar conteúdo
                    <ChevronRight size={15} />
                  </button>
                </div>
                <div className="grid min-h-[210px] place-items-center rounded-[24px] border border-black/10 bg-white/75 shadow-[0_22px_55px_rgba(20,24,28,0.08)]">
                  <div className="text-center">
                    <LayoutGrid size={34} strokeWidth={1.35} className="mx-auto text-black/35" />
                    <strong data-editor-type="text" className="mt-3 block text-[14px] font-semibold">Área de conteúdo</strong>
                    <span data-editor-type="text" className="mt-1 block text-[11px] text-black/42">Adicione imagens e elementos pela sidebar.</span>
                  </div>
                </div>
              </div>
            </section>
            {renderCustomSectionsAfter(sectionAnchor)}
          </Fragment>
        );
      });

  const menuItem = (
    Icon: LucideIcon,
    label: string,
    onClick: () => void,
    opts: { danger?: boolean; shortcut?: string } = {},
  ) => (
    <button
      type="button"
      role="menuitem"
      disabled={menuBusy}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[11px] px-3 py-[9px] text-left text-[13px] font-medium transition duration-150 disabled:pointer-events-none disabled:opacity-45 ${opts.danger ? "text-[#ff6a6a] hover:bg-[#ff6a6a]/[0.12]" : "text-white/82 hover:bg-white/[0.07] hover:text-white"}`}
    >
      <Icon size={17} strokeWidth={1.85} className="shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {opts.shortcut ? <span className="text-[11px] font-medium tracking-wide text-white/35">{opts.shortcut}</span> : null}
    </button>
  );

  const renderProjectMenu = () => (
    <AnimatePresence>
      {projectMenuOpen ? (
        <>
          <div className="fixed inset-0 z-[80]" aria-hidden onClick={closeProjectMenu} />
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.17, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-[52px] z-[90] w-[300px] origin-top-left overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#1c1d1f]/95 p-1.5 text-white shadow-[0_28px_74px_rgba(0,0,0,0.52)] backdrop-blur-2xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleOpenAllProjects}
              className="flex w-full items-center gap-3 rounded-[11px] px-3 py-[9px] text-left text-[13px] font-semibold text-white/88 transition duration-150 hover:bg-white/[0.07] hover:text-white"
            >
              <ChevronLeft size={17} strokeWidth={2} className="shrink-0" />
              <span className="flex-1 truncate">Acessar todos os projetos</span>
            </button>

            <div className="my-1.5 h-px bg-white/[0.07]" />

            {menuItem(Share2, "Compartilhar", handleShareProject)}
            {menuItem(Download, "Baixar projeto", handleDownloadProject)}
            {menuItem(Copy, "Duplicar projeto", handleDuplicateProject)}

            <div className="my-1.5 h-px bg-white/[0.07]" />

            {menuItem(Pencil, "Editar", handleStartRename)}
            {menuItem(HelpCircle, "Ajuda", handleOpenHelp)}
            {menuItem(Settings, "Configurações", handleOpenSettings)}

            <div className="my-1.5 h-px bg-white/[0.07]" />

            {menuItem(Trash2, "Excluir projeto", () => { closeProjectMenu(); setConfirmDeleteOpen(true); }, { danger: true })}
            {menuItem(Command, "Menu de comandos", () => setProjectMenuOpen(false), { shortcut: "⌘K" })}
            {menuItem(MessageSquare, "Enviar feedback", handleSendFeedback)}

            <div className="mt-1.5 rounded-[12px] border border-dashed border-white/[0.12] bg-white/[0.02] px-3 py-3 text-[11px] leading-relaxed text-white/40">
              Área reservada — me diga o que colocar aqui.
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-[#18191b] text-white" style={{ fontFamily: selectedFontStack }}>
      <style>
        {`
          /* Entrada do editor: revela o canvas em vez de trocar de tela seco. */
          @keyframes veloEditorEnter {
            0% { opacity: 1; }
            100% { opacity: 0; visibility: hidden; }
          }

          @media (prefers-reduced-motion: reduce) {
            .velo-editor-enter { animation-duration: 1ms !important; }
          }
        `}
      </style>
      <div
        aria-hidden="true"
        className="velo-editor-enter pointer-events-none fixed inset-0 z-[999] bg-[#18191b] [animation:veloEditorEnter_620ms_ease-out_forwards]"
      />
      <style>{`.store-editor-preview [data-editor-selected="true"]{outline:2px solid #686d72;outline-offset:4px}.store-editor-preview [data-editor-hover-bg="true"]:hover{background-color:var(--editor-hover-bg)!important}.editor-mode-active [data-editor-type]:hover,.editor-mode-active button:hover,.editor-mode-active [data-editor-role="button"]:hover{outline:1.5px dashed #686d72;outline-offset:2px;cursor:pointer}.editor-mode-active [data-editor-ignore],.editor-mode-active [data-editor-ignore] *{outline:none!important;cursor:default}.editor-sidebar-scroll{scrollbar-width:thin;scrollbar-color:#4a4f55 transparent}.editor-sidebar-scroll::-webkit-scrollbar{width:5px}.editor-sidebar-scroll::-webkit-scrollbar-track{background:transparent}.editor-sidebar-scroll::-webkit-scrollbar-thumb{border-radius:999px;background:#4a4f55}.editor-sidebar-scroll::-webkit-scrollbar-thumb:hover{background:#636970}.editor-context-drawer{animation:editorDrawerIn 200ms ease both}@keyframes editorDrawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
      <header data-canvas-ui className="pointer-events-none absolute inset-x-0 top-0 z-[70] grid h-[72px] grid-cols-[1fr_auto_1fr] items-center px-5 text-[#f4f4f5]">
        <div className="pointer-events-auto relative flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setProjectMenuOpen((open) => !open)} className={`flex h-10 w-12 shrink-0 items-center justify-center rounded-full text-white/82 shadow-[0_12px_38px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-200 hover:bg-black/52 hover:text-white ${projectMenuOpen ? "bg-black/60 text-white" : "bg-black/32"}`} aria-label="Menu do projeto" aria-haspopup="menu" aria-expanded={projectMenuOpen}>
            <Menu size={18} strokeWidth={1.75} />
          </button>
          <strong className="block min-w-0 truncate text-[13px] font-semibold tracking-[-0.015em] text-white/92">{projectTitle}</strong>
          {renderProjectMenu()}
        </div>

        <div className="pointer-events-auto hidden min-w-0 items-center justify-center rounded-full border border-white/[0.10] bg-black/38 p-1 shadow-[0_12px_38px_rgba(0,0,0,0.20)] backdrop-blur-xl lg:flex">
          <button type="button" onClick={() => { setMobilePreview(false); canvasZoomRef.current = 0.52; setCanvasZoom(0.52); }} className={`flex h-7 items-center gap-1.5 rounded-full px-3 text-[9px] font-semibold transition ${!mobilePreview ? "bg-white text-black" : "text-white/45 hover:text-white"}`} aria-label="Preview desktop">
            <Monitor size={14} strokeWidth={1.8} /> Desktop
          </button>
          <button type="button" onClick={() => { setMobilePreview(true); canvasZoomRef.current = 0.88; setCanvasZoom(0.88); }} className={`flex h-7 items-center gap-1.5 rounded-full px-3 text-[9px] font-semibold transition ${mobilePreview ? "bg-white text-black" : "text-white/45 hover:text-white"}`} aria-label="Preview mobile">
            <Smartphone size={13} strokeWidth={1.8} /> Mobile
          </button>
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center justify-end gap-2">
          <button type="button" className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/[0.13] bg-black/30 text-white/78 shadow-[0_12px_34px_rgba(0,0,0,0.20)] backdrop-blur-xl transition hover:border-white/25 hover:bg-black/48 hover:text-white sm:flex" aria-label="Visualizar loja">
            <Play size={15} strokeWidth={1.8} />
          </button>
          <div className="relative hidden md:block">
            <button type="button" onClick={handleOpenPublish} className="flex h-9 items-center justify-center rounded-[10px] bg-[#3567e9] px-5 text-[10px] font-semibold text-white shadow-[0_10px_28px_rgba(37,86,220,0.34)] transition duration-200 hover:bg-[#4272ee] hover:shadow-[0_13px_34px_rgba(37,86,220,0.42)] active:scale-[0.98]">
              Publicar
            </button>
            <span className="pointer-events-none absolute left-1/2 top-full mt-1 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-[#c98a08] bg-gradient-to-b from-[#ffe27a] to-[#f5b400] px-2 py-[3px] text-[8.5px] font-extrabold uppercase tracking-wide text-[#5c3a00] shadow-[0_4px_10px_rgba(0,0,0,0.35)]">
              🎁 Domínio grátis
            </span>
          </div>
          {/* Abre as configurações do projeto já na aba Equipe, onde fica o
              convite por e-mail. Mesmo destino do "Compartilhar" do menu. */}
          <button type="button" onClick={handleShareProject} className="hidden h-9 items-center justify-center rounded-[10px] bg-[#f1f2f4] px-5 text-[10px] font-semibold text-[#525660] shadow-[0_10px_28px_rgba(0,0,0,0.20)] transition duration-200 hover:bg-white hover:text-[#272a30] active:scale-[0.98] md:flex">
            Convidar
          </button>
          <button type="button" className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#d8b287] text-[#4c2414] ring-1 ring-white/15" aria-label={`Perfil de ${profileName || user?.email || "usuário"}`}>
            {profilePhoto ? (
              <img src={profilePhoto} alt={`Foto de ${profileName || user?.email || "perfil"}`} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_50%_28%,#f6d2a7_0_20%,transparent_21%),linear-gradient(135deg,#b66a3e,#7c341b)] text-[10px] font-bold text-white">
                {(profileName || user?.email || "V").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-[#0e0f10] bg-[#7ac943]" />
          </button>
        </div>
      </header>

      <div
        ref={workspaceRef}
        className={`relative min-h-0 flex-1 overflow-clip overscroll-none bg-[#222325] text-white touch-none ${canvasToolbarMode === "pan" ? (isCanvasDragging ? "cursor-grabbing" : "cursor-grab") : selectionMarquee ? "cursor-crosshair" : "cursor-default"}`}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={finishCanvasDrag}
        onPointerCancel={finishCanvasDrag}
        onScroll={(event) => {
          event.currentTarget.scrollLeft = 0;
          event.currentTarget.scrollTop = 0;
        }}
        onClick={handleWorkspaceClick}
        onDoubleClick={(event) => {
          const target = event.target;
          if (!(target instanceof Element) || !target.closest("[data-canvas-ui], .store-editor-preview")) resetCanvasView();
        }}
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.20) 1px, transparent 1.25px), radial-gradient(circle at 50% -20%, rgba(255,255,255,0.035), transparent 48%)",
          backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`,
          backgroundSize: "22px 22px, 100% 100%",
        }}
        aria-label="Área de trabalho arrastável"
      >
        <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(event)=>{const file=event.target.files?.[0];if(file)setHeroImage(URL.createObjectURL(file));}}/>
        <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload}/>
        <input ref={creationFileInput} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" className="hidden" onChange={handleCreationFileUpload}/>
        <input ref={contextMediaInput} type="file" accept="image/*" className="hidden" onChange={handleContextImageUpload}/>
        {selectionMarquee && selectionMarquee.width > 2 && selectionMarquee.height > 2 ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-[48] border border-white bg-white/[0.10] shadow-[0_0_0_1px_rgba(0,0,0,0.18),0_8px_28px_rgba(0,0,0,0.16)]"
            style={{ left: selectionMarquee.x, top: selectionMarquee.y, width: selectionMarquee.width, height: selectionMarquee.height }}
          />
        ) : null}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[72px] z-10 flex h-7 items-start justify-around px-[340px] pt-1 text-[8px] font-medium text-white/25">
          {[-3200, -2800, -2400, -2000, -1600, -1200, -800, -400, 0, 400].map((mark) => <span key={mark}>{mark}</span>)}
        </div>

        <aside data-canvas-ui data-sidebar-state={sidebarCollapsed ? "recolhido" : "aberto"} className="absolute bottom-5 left-5 top-[106px] z-40 w-[280px] origin-top-left">
          <div className="flex h-full min-h-0 flex-col text-white">
            <motion.section
              aria-label="Painel de personalização da loja"
              className={`relative min-w-0 origin-top-left overflow-hidden border backdrop-blur-xl will-change-[width,height] transition-[width,height,min-height,max-height,border-radius,background-color,box-shadow] duration-700 ${sidebarCollapsed ? "h-[66px] min-h-[66px] max-h-[66px] w-[66px] rounded-[22px] border-[#292d31]/75 bg-[rgba(5,7,9,0.82)] shadow-[0_20px_54px_rgba(0,0,0,0.46)]" : "h-[76%] min-h-[390px] max-h-[540px] w-full rounded-[24px] border-[#292d31]/95 bg-[linear-gradient(180deg,rgba(7,9,11,0.88)_0%,rgba(5,7,9,0.93)_46%,rgba(3,5,7,0.96)_100%)] shadow-[0_28px_90px_rgba(0,0,0,0.58)]"}`}
              style={{ transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}
            >
              <AnimatePresence initial={false} mode="wait">
                {sidebarCollapsed ? (
                  <motion.div
                    key="editor-sidebar-collapsed-content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
                    className="flex h-full w-full items-center justify-center"
                  >
                    <button type="button" onClick={() => setSidebarCollapsed(false)} className="group flex h-7 w-10 items-center justify-center gap-1 rounded-full bg-[#f7f7f5] text-black shadow-[0_6px_18px_rgba(0,0,0,0.24)] transition duration-200 hover:scale-[1.03]" aria-label="Expandir painel">
                      <span className="h-1.5 w-1.5 rounded-full bg-black" />
                      <span className="h-1.5 w-1.5 rounded-full bg-black" />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="editor-sidebar-expanded-content"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                    className="flex h-full min-h-0 flex-col"
                  >

                  <div className="relative shrink-0 px-3 pb-2.5 pt-3">
                    <button type="button" onClick={() => setSidebarCollapsed(true)} className="group flex h-6 w-10 items-center justify-center gap-1 rounded-full bg-[#f4f4f2] text-black shadow-[0_6px_18px_rgba(0,0,0,0.28)] transition hover:scale-105" aria-label="Recolher painel">
                      <span className="h-1 w-1 rounded-full bg-black transition group-hover:-translate-x-0.5" />
                      <span className="h-1 w-1 rounded-full bg-black transition group-hover:translate-x-0.5" />
                    </button>

                    <div className="relative mt-4 grid h-[44px] grid-cols-2 rounded-[16px] border border-[#292d31] bg-black/55 p-1 shadow-[0_10px_26px_rgba(0,0,0,0.34)] backdrop-blur-xl">
                      {[
                        { id: "personalizar" as const, label: "Criação", icon: FolderPlus },
                        { id: "detalhes" as const, label: "Templates", icon: Layers3 },
                      ].map((tab) => {
                        const TabIcon = tab.icon;
                        const active = editorPanelTab === tab.id;
                        return (
                          <button key={tab.id} type="button" onClick={() => setEditorPanelTab(tab.id)} className={`relative z-10 flex items-center justify-center gap-1.5 rounded-[12px] text-[10px] font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#666b70] ${active ? "text-white" : "text-white/58 hover:text-white"}`}>
                            {active ? <motion.span layoutId="editor-sidebar-active-tab" className="absolute inset-0 -z-10 rounded-[12px] bg-[#303337] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_22px_rgba(0,0,0,0.34)]" transition={{ type: "spring", stiffness: 430, damping: 36 }} /> : null}
                            <TabIcon size={14} strokeWidth={1.9} />
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mx-3 h-px shrink-0 bg-[#303438]/75" />

                  <div className="editor-sidebar-scroll min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 py-3 pr-2">
                    <AnimatePresence mode="wait" initial={false}>
                      {editorPanelTab === "personalizar" ? (
                        <motion.div key="creation-panel" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                          {selectedElement ? (
                            <div className="mb-3 space-y-2">
                              {!isSelectedButton && selectedElement.type !== "image" ? <section className="rounded-[15px] border border-[#292d31] bg-[#151719]/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                                <div className="mb-2 flex items-center justify-between">
                                  <strong className="text-[9px] font-semibold text-white/86">Cor</strong>
                                  <ChevronRight size={12} className="text-white/35" />
                                </div>
                                <label className="flex h-8 items-center gap-2 text-[8px] text-white/48">
                                  <span className="w-12">Texto</span>
                                  <span className="relative flex h-7 flex-1 items-center gap-2 rounded-full bg-black/28 px-2.5 text-[8px] font-medium text-white/66">
                                    <span className="h-4 w-4 rounded-full ring-1 ring-white/15" style={{ backgroundColor: contextControls.color }} />
                                    {contextControls.color}
                                    <input type="color" value={colorToHex(contextControls.color)} onChange={(event)=>applyElementColor(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                                  </span>
                                </label>
                                <label className="mt-1 flex h-8 items-center gap-2 text-[8px] text-white/48">
                                  <span className="w-12">Fundo</span>
                                  <span className="relative flex h-7 flex-1 items-center gap-2 rounded-full bg-black/28 px-2.5 text-[8px] font-medium text-white/66">
                                    <span className="h-4 w-4 rounded-full ring-1 ring-white/15" style={{ backgroundColor: fillColor }} />
                                    {fillColor}
                                    <input type="color" value={fillColor} onChange={(event)=>applyElementBackground(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                                  </span>
                                </label>
                              </section> : null}

                              {isSelectedButton && buttonToolbarPanel ? (
                                <section className="rounded-[15px] border border-[#292d31] bg-[#151719]/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                                  <div className="mb-3 flex items-center justify-between">
                                    <div>
                                      <strong className="block text-[10px] font-semibold text-white/90">
                                        {buttonToolbarPanel === "style"
                                          ? "Estilo do botão"
                                          : buttonToolbarPanel === "size"
                                            ? "Tamanho do botão"
                                            : buttonToolbarPanel === "radius"
                                              ? "Raio do botão"
                                              : buttonToolbarPanel === "text"
                                                ? "Texto do botão"
                                                : buttonToolbarPanel === "icon"
                                                  ? "Ícone do botão"
                                                  : "Opções do botão"}
                                      </strong>
                                      <span className="mt-0.5 block text-[7.5px] text-white/42">As alterações são aplicadas imediatamente.</span>
                                    </div>
                                    <button type="button" onClick={()=>setButtonToolbarPanel(null)} className="grid h-7 w-7 place-items-center rounded-full bg-black/25 text-white/50 transition hover:bg-black/40 hover:text-white" aria-label="Sair da configuração">
                                      <X size={12}/>
                                    </button>
                                  </div>

                                  {buttonToolbarPanel === "style" ? (
                                    <div className="space-y-2">
                                      {buttonStylePresets.map((preset) => (
                                        <button key={preset.value} type="button" onClick={()=>applyButtonStylePreset(preset.value)} className={`flex h-10 w-full items-center justify-between rounded-[11px] border px-3 text-[9px] font-semibold transition ${buttonStylePreset===preset.value?"border-[#68717b] bg-[#343a40] text-white shadow-[0_8px_22px_rgba(0,0,0,0.24)]":"border-[#282c30] bg-[#202327] text-white/78 hover:border-[#444a50] hover:bg-[#292d31] hover:text-white"}`}>
                                          {preset.label}
                                          <span
                                            className={`h-5 w-5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.18)] ${preset.value==="outline"?"border bg-transparent":""}`}
                                            style={{
                                              backgroundColor: preset.value === "outline" ? "transparent" : getButtonStylePreset(preset.value).backgroundColor,
                                              borderColor: preset.value === "outline" ? getButtonStylePreset(preset.value).borderColor : undefined,
                                            }}
                                          />
                                        </button>
                                      ))}

                                      <div className="my-2 h-px bg-[#30353a]" />
                                      <div className="rounded-[13px] border border-[#2b3035] bg-[#0e1012] p-3">
                                        <div className="mb-3 flex items-center justify-between">
                                          <div>
                                            <strong className="block text-[9px] font-semibold text-white">Cor personalizada</strong>
                                            <span className="text-[7px] text-white/42">Arraste para criar a cor do botão.</span>
                                          </div>
                                          <span className="h-8 w-8 rounded-full shadow-[0_0_0_2px_#2d3237,0_6px_18px_rgba(0,0,0,0.35)]" style={{ backgroundColor: hslToHex(buttonColorHue, buttonColorSaturation, buttonColorLightness) }} />
                                        </div>

                                        <label className="mb-3 block">
                                          <span className="mb-1.5 flex justify-between text-[7px] text-white/48"><span>Matiz</span><span>{buttonColorHue}°</span></span>
                                          <input
                                            type="range"
                                            min="0"
                                            max="360"
                                            value={buttonColorHue}
                                            onChange={(event)=>applyButtonCustomColor(Number(event.target.value), buttonColorSaturation, buttonColorLightness)}
                                            className="h-2 w-full cursor-pointer appearance-none rounded-full accent-white"
                                            style={{ background: "linear-gradient(90deg,#ff3b30,#ffcc00,#34c759,#00c7be,#0a84ff,#5856d6,#bf5af2,#ff2d55,#ff3b30)" }}
                                          />
                                        </label>

                                        <label className="mb-3 block">
                                          <span className="mb-1.5 flex justify-between text-[7px] text-white/48"><span>Intensidade</span><span>{buttonColorSaturation}%</span></span>
                                          <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={buttonColorSaturation}
                                            onChange={(event)=>applyButtonCustomColor(buttonColorHue, Number(event.target.value), buttonColorLightness)}
                                            className="h-2 w-full cursor-pointer appearance-none rounded-full accent-white"
                                            style={{ background: `linear-gradient(90deg,${hslToHex(buttonColorHue,0,buttonColorLightness)},${hslToHex(buttonColorHue,100,buttonColorLightness)})` }}
                                          />
                                        </label>

                                        <label className="block">
                                          <span className="mb-1.5 flex justify-between text-[7px] text-white/48"><span>Luminosidade</span><span>{buttonColorLightness}%</span></span>
                                          <input
                                            type="range"
                                            min="12"
                                            max="88"
                                            value={buttonColorLightness}
                                            onChange={(event)=>applyButtonCustomColor(buttonColorHue, buttonColorSaturation, Number(event.target.value))}
                                            className="h-2 w-full cursor-pointer appearance-none rounded-full accent-white"
                                            style={{ background: `linear-gradient(90deg,#050505,${hslToHex(buttonColorHue,buttonColorSaturation,50)},#f7f7f7)` }}
                                          />
                                        </label>
                                      </div>
                                    </div>
                                  ) : buttonToolbarPanel === "size" ? (
                                    <div className="space-y-1.5">
                                      {buttonSizePresets.map((preset) => (
                                        <button key={preset.value} type="button" onClick={()=>applyButtonSizePreset(preset.value)} className={`flex h-9 w-full items-center rounded-[10px] px-3 text-left text-[9px] font-semibold transition ${buttonSizePreset===preset.value?"bg-[#34373b] text-white":"bg-black/20 text-white/62 hover:bg-black/32 hover:text-white"}`}>
                                          {preset.label}
                                        </button>
                                      ))}
                                    </div>
                                  ) : buttonToolbarPanel === "radius" ? (
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between rounded-[11px] bg-black/24 px-3 py-2">
                                        <span className="text-[8px] text-white/48">Arredondamento</span>
                                        <label className="flex h-7 w-[72px] items-center rounded-[8px] bg-white/[0.07] px-2">
                                          <input type="number" min="0" max="999" value={contextControls.borderRadius} onChange={(event)=>applyButtonRadiusValue(Number(event.target.value))} className="w-full bg-transparent text-right text-[9px] font-semibold text-white outline-none"/>
                                          <span className="ml-1 text-[7px] text-white/38">px</span>
                                        </label>
                                      </div>
                                      <input type="range" min="0" max="80" value={Math.min(80, contextControls.borderRadius)} onChange={(event)=>applyButtonRadiusValue(Number(event.target.value))} className="h-1 w-full cursor-pointer accent-white"/>
                                      <div className="grid grid-cols-4 gap-1.5">
                                        {[0,8,20,999].map((radius)=>(
                                          <button key={radius} type="button" onClick={()=>applyButtonRadiusValue(radius)} className={`h-8 rounded-[9px] bg-black/24 text-[8px] font-semibold transition hover:bg-black/38 ${contextControls.borderRadius===radius?"ring-1 ring-white/50":""}`}>{radius===999?"Pílula":radius}</button>
                                        ))}
                                      </div>
                                    </div>
                                  ) : buttonToolbarPanel === "text" ? (
                                    <div className="space-y-2">
                                      <button type="button" onClick={startButtonTextEditing} className="flex h-9 w-full items-center justify-center gap-2 rounded-[10px] bg-[#34373b] text-[9px] font-semibold text-white transition hover:bg-[#3d4146]"><Pencil size={12}/>Editar texto diretamente</button>
                                      <div className="flex items-center gap-2 text-[8px] text-white/48">
                                        <span className="w-12">Tamanho</span>
                                        <div className="flex h-8 flex-1 items-center justify-between rounded-full bg-black/28 px-1">
                                          <button type="button" onClick={()=>applyTextSize(-1)} className="grid h-6 w-6 place-items-center rounded-full bg-white/[0.08]"><Minus size={11}/></button>
                                          <span className="text-[8px] font-semibold text-white/72">{contextControls.fontSize}px</span>
                                          <button type="button" onClick={()=>applyTextSize(1)} className="grid h-6 w-6 place-items-center rounded-full bg-white/[0.08]"><Plus size={11}/></button>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-4 gap-1">
                                        {textWeightOptions.map((option)=><button key={option.value} type="button" onClick={()=>applyTextWeight(option.value)} className={`h-8 rounded-[8px] text-[7px] transition ${contextControls.fontWeight===option.value?"bg-[#34373b] text-white":"bg-black/24 text-white/48"}`}>{option.value}</button>)}
                                      </div>
                                      <label className="relative flex h-9 cursor-pointer items-center gap-2 rounded-[10px] bg-black/24 px-3 text-[8px] text-white/55">
                                        <span className="h-5 w-5 rounded-full ring-1 ring-white/20" style={{ backgroundColor: contextControls.color }}/>
                                        Cor do texto
                                        <span className="ml-auto text-white/70">{contextControls.color}</span>
                                        <input type="color" value={colorToHex(contextControls.color)} onChange={(event)=>applyElementColor(event.target.value)} className="absolute opacity-0"/>
                                      </label>
                                    </div>
                                  ) : buttonToolbarPanel === "icon" ? (
                                    <div className="space-y-2">
                                      <div className="grid grid-cols-5 gap-1.5">
                                        {iconPickerOptions.map(({name,label,icon:PickerIcon})=>(
                                          <button key={name} type="button" title={label} onClick={()=>applyButtonIconName(name)} className="grid h-9 place-items-center rounded-[9px] bg-black/24 text-white/65 transition hover:bg-white hover:text-black"><PickerIcon size={15}/></button>
                                        ))}
                                      </div>
                                      <div className="flex items-center gap-2 text-[8px] text-white/48">
                                        <span className="w-12">Tamanho</span>
                                        <div className="flex h-8 flex-1 items-center justify-between rounded-full bg-black/28 px-1">
                                          <button type="button" onClick={()=>applyButtonIconSize(-2)} className="grid h-6 w-6 place-items-center rounded-full bg-white/[0.08]"><Minus size={11}/></button>
                                          <span className="text-[8px] font-semibold text-white/72">{selectedButtonIconSize}px</span>
                                          <button type="button" onClick={()=>applyButtonIconSize(2)} className="grid h-6 w-6 place-items-center rounded-full bg-white/[0.08]"><Plus size={11}/></button>
                                        </div>
                                      </div>
                                      <label className="relative flex h-9 cursor-pointer items-center gap-2 rounded-[10px] bg-black/24 px-3 text-[8px] text-white/55">
                                        <span className="h-5 w-5 rounded-full ring-1 ring-white/20" style={{ backgroundColor: selectedButtonIconColor }}/>
                                        Cor do ícone
                                        <input type="color" value={colorToHex(selectedButtonIconColor, "#ffffff")} onChange={(event)=>applyButtonIconColor(event.target.value)} className="absolute opacity-0"/>
                                      </label>
                                      <button type="button" onClick={removeButtonIcon} className="flex h-9 w-full items-center justify-center gap-2 rounded-[10px] bg-red-500/10 text-[8px] font-semibold text-red-300 transition hover:bg-red-500/18"><Trash2 size={12}/>Remover ícone</button>
                                    </div>
                                  ) : null}
                                </section>
                              ) : null}

                              {!isSelectedButton ? <section className="rounded-[15px] border border-[#292d31] bg-[#151719]/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                                <div className="mb-2 flex items-center justify-between">
                                  <strong className="text-[9px] font-semibold text-white/86">
                                    {isSelectedButton ? "Opções do botão" : selectedElement.type === "text" ? "Opções de texto" : isSelectedProductImage ? "Opções do produto" : selectedMediaKind === "logo" ? "Opções da logo" : selectedElement.type === "image" ? "Opções da imagem" : selectedElement.type === "icon" ? "Opções do ícone" : `Opções: ${selectedElement.label}`}
                                  </strong>
                                  <ChevronRight size={12} className="text-white/35" />
                                </div>
                                {isSelectedButton ? (
                                  <div className="space-y-1.5">
                                    {[
                                      { label: "Texto", color: contextControls.color, onChange: applyElementColor },
                                      { label: "Fundo", color: fillColor, onChange: applyElementBackground },
                                      { label: "Hover", color: contextControls.hoverBackgroundColor, onChange: applyElementHoverBackground },
                                    ].map((option) => (
                                      <label key={option.label} className="flex h-8 items-center gap-2 text-[8px] text-white/48">
                                        <span className="w-12">{option.label}</span>
                                        <span className="relative flex h-7 flex-1 items-center gap-2 rounded-full bg-black/28 px-2.5 text-[8px] font-medium text-white/66">
                                          <span className="h-4 w-4 rounded-full ring-1 ring-white/15" style={{ backgroundColor: option.color }} />
                                          {option.color}
                                          <input type="color" value={colorToHex(option.color, fillColor)} onChange={(event)=>option.onChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                                        </span>
                                      </label>
                                    ))}
                                    <div className="flex items-center gap-2 text-[8px] text-white/48">
                                      <span className="w-12">Peso</span>
                                      <button type="button" onClick={()=>setWeightMenuOpen(true)} className="h-7 flex-1 rounded-full bg-black/28 px-3 text-left text-white/70">{textWeightOptions.find((item)=>item.value===contextControls.fontWeight)?.label}</button>
                                    </div>
                                    <div className="flex items-center gap-2 text-[8px] text-white/48">
                                      <span className="w-12">Tamanho</span>
                                      <div className="flex h-7 flex-1 items-center justify-between rounded-full bg-black/28 px-1">
                                        <button type="button" onClick={()=>applyTextSize(-1)} className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.08]"><Minus size={10}/></button>
                                        <span className="text-[8px] font-semibold text-white/72">{contextControls.fontSize}px</span>
                                        <button type="button" onClick={()=>applyTextSize(1)} className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.08]"><Plus size={10}/></button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[8px] text-white/48">
                                      <span className="w-12">Raio</span>
                                      <div className="flex h-7 flex-1 items-center justify-between rounded-full bg-black/28 px-1">
                                        <button type="button" onClick={()=>applyButtonRadius(-2)} className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.08]"><Minus size={10}/></button>
                                        <span className="text-[8px] font-semibold text-white/72">{contextControls.borderRadius}px</span>
                                        <button type="button" onClick={()=>applyButtonRadius(2)} className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.08]"><Plus size={10}/></button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[8px] text-white/48">
                                      <span className="w-12">Alinhar</span>
                                      <div className="grid h-7 flex-1 grid-cols-3 rounded-full bg-black/28 p-0.5">
                                        {([{value:"left" as const,icon:AlignLeft},{value:"center" as const,icon:AlignCenter},{value:"right" as const,icon:AlignRight}]).map(({value,icon:AlignIcon})=><button key={value} type="button" onClick={()=>applyTextAlign(value)} className={`grid place-items-center rounded-full ${contextControls.textAlign===value?"bg-[#34373b] text-white":"text-white/40"}`}><AlignIcon size={11}/></button>)}
                                      </div>
                                    </div>
                                  </div>
                                ) : selectedElement.type === "text" ? (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-[8px] text-white/48"><span className="w-12">Fonte</span><span className="flex h-7 flex-1 items-center justify-between rounded-full bg-black/28 px-3 text-white/70">{font}<ChevronDown size={10}/></span></div>
                                    <div className="flex items-center gap-2 text-[8px] text-white/48"><span className="w-12">Peso</span><button type="button" onClick={()=>setWeightMenuOpen(true)} className="h-7 flex-1 rounded-full bg-black/28 px-3 text-left text-white/70">{textWeightOptions.find((item)=>item.value===contextControls.fontWeight)?.label}</button></div>
                                    <div className="flex items-center gap-2 text-[8px] text-white/48">
                                      <span className="w-12">Tamanho</span>
                                      <div className="flex h-7 flex-1 items-center justify-between rounded-full bg-black/28 px-1">
                                        <button type="button" onClick={()=>applyTextSize(-1)} className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.08]"><Minus size={10}/></button>
                                        <span className="text-[8px] font-semibold text-white/72">{contextControls.fontSize}px</span>
                                        <button type="button" onClick={()=>applyTextSize(1)} className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.08]"><Plus size={10}/></button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[8px] text-white/48">
                                      <span className="w-12">Alinhar</span>
                                      <div className="grid h-7 flex-1 grid-cols-3 rounded-full bg-black/28 p-0.5">
                                        {([{value:"left" as const,icon:AlignLeft},{value:"center" as const,icon:AlignCenter},{value:"right" as const,icon:AlignRight}]).map(({value,icon:AlignIcon})=><button key={value} type="button" onClick={()=>applyTextAlign(value)} className={`grid place-items-center rounded-full ${contextControls.textAlign===value?"bg-[#34373b] text-white":"text-white/40"}`}><AlignIcon size={11}/></button>)}
                                      </div>
                                    </div>
                                  </div>
                                ) : selectedElement.type === "image" ? (
                                  <div className="space-y-2.5">
                                    <div className="relative h-[92px] overflow-hidden rounded-[11px] border border-[#30353a] bg-[#090a0b]">
                                      {selectedMediaSrc ? <img src={selectedMediaSrc} alt="" className="h-full w-full object-cover opacity-85" /> : null}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
                                      <span className="absolute bottom-2 left-2 text-[8px] font-semibold text-white/88">{isSelectedProductImage ? "Produto selecionado" : selectedMediaKind === "logo" ? "Logo selecionada" : selectedMediaKind === "banner" ? "Banner selecionado" : "Imagem selecionada"}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={isSelectedProductImage ? openProductReplacementDrawer : selectedMediaKind === "logo" ? ()=>logoInput.current?.click() : ()=>contextMediaInput.current?.click()}
                                      className="flex h-9 w-full items-center justify-center gap-2 rounded-[10px] bg-[#343a40] text-[8.5px] font-semibold text-white transition hover:bg-[#424950]"
                                    >
                                      {isSelectedProductImage ? <Package size={13}/> : selectedMediaKind === "logo" ? <Leaf size={13}/> : <ImageIcon size={13}/>}
                                      {isSelectedProductImage ? "Substituir produto" : selectedMediaKind === "logo" ? "Substituir logo" : selectedMediaKind === "banner" ? "Substituir banner" : "Substituir imagem"}
                                    </button>
                                    {!isSelectedProductImage ? (
                                      <>
                                        <div className="grid grid-cols-4 gap-1">
                                          {imageShapeOptions.map(({value,label,icon:ShapeIcon})=>(
                                            <button key={value} type="button" onClick={()=>handleImageShapeChange(value)} title={label} className={`grid h-9 place-items-center rounded-[9px] border transition ${contextControls.imageShape===value?"border-[#656d75] bg-[#343a40] text-white":"border-[#292d31] bg-[#202327] text-white/52 hover:bg-[#292d31] hover:text-white"}`}><ShapeIcon size={13}/></button>
                                          ))}
                                        </div>
                                        <button type="button" onClick={()=>setMediaModalOpen(true)} className="flex h-8 w-full items-center justify-center gap-2 rounded-[9px] border border-[#30353a] bg-[#111315] text-[8px] font-semibold text-white/72 transition hover:bg-[#202327] hover:text-white"><Settings size={12}/>Abrir ajustes avançados</button>
                                      </>
                                    ) : null}
                                  </div>
                                ) : selectedElement.type === "icon" ? (
                                  <div className="flex h-8 items-center gap-2">
                                    <button type="button" onClick={()=>setIconPickerOpen(true)} className="h-8 flex-1 rounded-full bg-black/28 text-[8px] font-semibold text-white/70">Trocar ícone</button>
                                    <button type="button" onClick={()=>applyIconSize(-2)} className="grid h-8 w-8 place-items-center rounded-full bg-black/28"><Minus size={11}/></button>
                                    <span className="text-[8px] font-semibold text-white/66">{contextControls.iconSize}px</span>
                                    <button type="button" onClick={()=>applyIconSize(2)} className="grid h-8 w-8 place-items-center rounded-full bg-black/28"><Plus size={11}/></button>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <button type="button" onClick={duplicateSelectedElement} className="h-8 flex-1 rounded-full bg-black/28 text-[8px] font-semibold text-white/66">Duplicar</button>
                                    <button type="button" onClick={deleteSelectedElement} className="grid h-8 w-8 place-items-center rounded-full bg-black/28 text-white/55"><Trash2 size={12}/></button>
                                  </div>
                                )}
                              </section> : null}
                            </div>
                          ) : null}

                          {!(isSelectedButton && buttonToolbarPanel) ? <section>
                            <div className="mb-2 flex items-center justify-between">
                              <strong className="text-[9px] font-semibold text-white/82">Básico</strong>
                              <ChevronDown size={12} className="text-white/42" />
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { id: "image", label: "Imagem", icon: ImageIcon },
                                { id: "logo", label: "Logo", icon: Leaf },
                                { id: "button", label: "Botão", icon: RectangleHorizontal },
                                { id: "file", label: "Arquivo", icon: FileUp },
                              ].map(({ id, label, icon: ItemIcon }) => (
                                <button key={id} type="button" onClick={()=>handleCreationLibraryAction(id)} className="group flex h-[58px] flex-col items-center justify-center gap-1 rounded-[11px] text-[7.5px] font-medium text-white/48 transition hover:bg-white/[0.07] hover:text-white">
                                  <ItemIcon size={18} strokeWidth={1.65} className="text-white/70 transition group-hover:scale-105 group-hover:text-white" />
                                  {label}
                                </button>
                              ))}
                            </div>
                          </section> : null}

                          {!(isSelectedButton && buttonToolbarPanel) ? <div className="my-3 h-px bg-white/[0.08]" /> : null}

                          {!(isSelectedButton && buttonToolbarPanel) ? <section>
                            <div className="mb-2 flex items-center justify-between">
                              <strong className="text-[9px] font-semibold text-white/82">Tipografia</strong>
                              <ChevronDown size={12} className="text-white/42" />
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { id: "title", label: "Título", icon: Type },
                                { id: "text", label: "Texto", icon: AlignLeft },
                                { id: "list", label: "Lista", icon: List },
                                { id: "quote", label: "Citação", icon: Quote },
                                { id: "link", label: "Link", icon: Link2 },
                              ].map(({ id, label, icon: ItemIcon }) => (
                                <button key={id} type="button" onClick={()=>handleCreationLibraryAction(id)} className="group flex h-[58px] flex-col items-center justify-center gap-1 rounded-[11px] text-[7.5px] font-medium text-white/48 transition hover:bg-white/[0.07] hover:text-white">
                                  <ItemIcon size={18} strokeWidth={1.65} className="text-white/70 transition group-hover:scale-105 group-hover:text-white" />
                                  {label}
                                </button>
                              ))}
                            </div>
                          </section> : null}

                          {!(isSelectedButton && buttonToolbarPanel) ? <div className="mt-3 space-y-1">
                            <button type="button" onClick={openProductsDrawer} className="flex h-9 w-full items-center px-1 text-[9px] font-semibold text-white/74 transition hover:text-white"><span className="flex-1 text-left">Estrutura</span><ChevronRight size={13}/></button>
                            <div className="h-px bg-white/[0.07]" />
                            <button type="button" onClick={()=>handleCanvasToolbarClick("media")} className="flex h-9 w-full items-center px-1 text-[9px] font-semibold text-white/74 transition hover:text-white"><span className="flex-1 text-left">Mídia</span><ChevronRight size={13}/></button>
                          </div> : null}
                        </motion.div>
                      ) : (
                        <motion.div key="templates-panel" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}>
                          <div>
                            <span className="text-[7px] font-semibold uppercase tracking-[0.18em] text-white/46">Biblioteca visual</span>
                            <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.02em]">Escolha seu template</h2>
                            <p className="mt-0.5 text-[8.5px] text-white/52">Troque a estrutura em um toque.</p>
                          </div>

                          <div className="mt-3 grid grid-cols-2 rounded-[12px] border border-[#292d31] bg-black/40 p-1 backdrop-blur-lg">
                            {(["loja", "produto"] as const).map((category) => (
                              <button key={category} type="button" onClick={() => setTemplateCategory(category)} className={`h-7 rounded-[8px] text-[8px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[#5f6469] ${templateCategory === category ? "bg-[#2b2e31] text-white shadow-sm" : "text-white/42 hover:text-white/74"}`}>
                                {category === "loja" ? "Loja" : "Produto"}
                              </button>
                            ))}
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            {templateOptions[templateCategory].map((template, index) => {
                              const selected = activeTemplate.kind === templateCategory && activeTemplate.id === template.id;
                              return (
                                <motion.button
                                  key={template.id}
                                  type="button"
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.035, duration: 0.18 }}
                                  onClick={() => applyInlineTemplate(templateCategory, template)}
                                  title={`Aplicar ${template.name}`}
                                  className={`group relative aspect-[1/1.04] overflow-hidden rounded-[12px] bg-black/20 text-left shadow-[0_9px_22px_rgba(0,0,0,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_13px_28px_rgba(0,0,0,0.38)] ${selected ? "ring-2 ring-white" : "ring-1 ring-white/[0.14]"}`}
                                >
                                  <img src={template.image} alt="" className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105" />
                                  <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/95 to-transparent" />
                                  <span className="absolute inset-x-2 bottom-1.5 text-[8px] font-semibold text-white">{template.name}</span>
                                  {selected ? <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black shadow"><Check size={10} /></span> : null}
                                </motion.button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>

          <div className="mt-auto shrink-0 rounded-[20px] border border-[#292d31]/80 bg-[rgba(4,6,8,0.62)] p-3.5 shadow-[0_22px_65px_rgba(0,0,0,0.48)] backdrop-blur-xl">
            {editorPanelTab === "personalizar" ? (
              <>
                <button type="button" onClick={openProductsDrawer} className="group flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white/[0.055] text-[9.5px] font-semibold text-white outline-none transition hover:bg-white/[0.10] focus-visible:ring-2 focus-visible:ring-[#666b70]">
                  <Plus size={13} strokeWidth={2} />
                  Adicionar produtos
                </button>
                <div className="my-3 h-px bg-[#292d31]" />
                {/* "Adicionar produtos" (acima) abre o drawer de seleção dentro do
                    editor. Este abre o catálogo completo do Velo numa nova aba,
                    para navegação mais ampla sem tirar o usuário do editor. */}
                <button type="button" onClick={() => window.open("/dashboard/catalogo", "_blank", "noopener,noreferrer")} className="group flex h-8 w-full items-center gap-2 rounded-[9px] px-2 text-left text-[9px] font-medium text-white/66 outline-none transition hover:bg-white/[0.06] hover:text-white">
                  <LayoutGrid size={13} strokeWidth={1.8} />
                  <span className="flex-1">Abrir catálogo completo</span>
                  <ExternalLink size={12} className="transition group-hover:translate-x-0.5" />
                </button>
              </>
            ) : (
              <button type="button" onClick={openTemplateDrawer} className="group flex h-10 w-full items-center justify-center gap-1.5 rounded-full border-2 bg-[rgba(20,22,24,0.58)] text-[9.5px] font-semibold text-white outline-none transition hover:bg-[rgba(28,30,32,0.68)] focus-visible:ring-2 focus-visible:ring-[#666b70]" style={{ borderColor: "#60656a" }}>
                Ver todos os templates
                <ChevronRight size={12} className="transition group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
          </div>
        </aside>

        <div
          className="absolute left-[330px] top-[130px] z-20 origin-top-left will-change-transform"
          style={{
            transform: `translate3d(${canvasOffset.x}px, ${canvasOffset.y}px, 0) scale(${canvasZoom})`,
          }}
        >
          <div data-canvas-ui className="mb-4 flex h-10 items-center gap-2.5 text-[18px] font-semibold tracking-[-0.015em] text-white/78">
            <Monitor size={20} strokeWidth={1.8} />
            Página principal · {mobilePreview ? "Mobile" : "Desktop"}
            <span className="rounded-full border border-white/[0.10] bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold tracking-normal text-white/55">Ao vivo</span>
          </div>
          <div ref={previewRef} onClickCapture={handlePreviewClick} onDoubleClickCapture={handlePreviewDoubleClick} className={`store-editor-preview relative overflow-hidden bg-white text-[#111] shadow-[0_30px_100px_rgba(0,0,0,0.46)] transition-[width] duration-300 ${pageSelected ? "ring-2 ring-white ring-offset-4 ring-offset-[#222325]" : "ring-1 ring-white/[0.10]"} ${mobilePreview?"w-[390px]":"w-[1440px]"} ${editMode && canvasToolbarMode !== "pan"?"editor-mode-active":""}`} style={{ fontFamily: selectedFontStack, cursor: canvasToolbarMode === "pan" ? (isCanvasDragging ? "grabbing" : "grab") : canvasToolbarMode === "appearance" ? "copy" : canvasToolbarMode === "edit" ? "text" : "default" }}>
            {!templateReady ? (
              <div className="grid h-[720px] w-full place-items-center bg-white">
                <Loader2 size={22} className="animate-spin text-black/25" />
              </div>
            ) : activeTemplate.kind === "produto" ? (
              activeTemplate.id === "produto-2" ? (
                <ProductTemplateBeauty
                  brand={brandName}
                  title={featuredProduct?.title || storeName}
                  description={(flow.salesAngle || "Serum leve de rapida absorcao que hidrata profundamente e deixa a pele macia e saudavel no uso diario.").slice(0, 240)}
                  price={featuredPrice}
                  originalPrice={featuredProduct?.originalPrice ?? null}
                  variants={featuredProduct?.variants ?? []}
                  image={featuredProduct?.imageUrl || heroImage}
                  images={featuredProduct?.imageUrls}
                  productId={featuredProduct?.id}
                  accent={accent}
                  mobile={mobilePreview}
                />
              ) : activeTemplate.id === "produto-3" ? (
                <ProductTemplateShopify
                  brand={brandName}
                  title={featuredProduct?.title || storeName}
                  description={(flow.salesAngle || "Fuja do ruido e aumente seu foco. Conforto duradouro com ANC avancado, chamadas nitidas e 30 horas de bateria.").slice(0, 240)}
                  price={featuredPrice}
                  originalPrice={featuredProduct?.originalPrice ?? null}
                  variants={featuredProduct?.variants ?? []}
                  image={featuredProduct?.imageUrl || heroImage}
                  images={featuredProduct?.imageUrls}
                  productId={featuredProduct?.id}
                  accent={accent}
                  mobile={mobilePreview}
                />
              ) : activeTemplate.id === "produto-4" ? (
                <ProductTemplate4
                  brand={brandName}
                  title={featuredProduct?.title || storeName}
                  description={(flow.salesAngle || "Design premium e alta performance para o seu dia a dia. Materiais duraveis, acabamento cuidadoso e praticidade em cada detalhe.").slice(0, 240)}
                  price={featuredPrice}
                  originalPrice={featuredProduct?.originalPrice ?? null}
                  variants={featuredProduct?.variants ?? []}
                  image={featuredProduct?.imageUrl || heroImage}
                  images={featuredProduct?.imageUrls}
                  productId={featuredProduct?.id}
                  accent={accent}
                  mobile={mobilePreview}
                />
              ) : (
                <ProductTemplate
                  brand={brandName}
                  title={featuredProduct?.title || storeName}
                  description={(flow.salesAngle || "Confeccionado em algodao premium de alta gramatura, entrega conforto e durabilidade. A modelagem oversized e o design minimalista tornam a peca um coringa para qualquer guarda-roupa.").slice(0, 240)}
                  price={featuredPrice}
                  originalPrice={featuredProduct?.originalPrice ?? null}
                  variants={featuredProduct?.variants ?? []}
                  image={featuredProduct?.imageUrl || heroImage}
                  images={featuredProduct?.imageUrls}
                  productId={featuredProduct?.id}
                  accent={accent}
                  mobile={mobilePreview}
                />
              )
            ) : (
            <>
            {/* === TEMPLATE 01 - C-STYLE INSPIRED === */}
            {/* Main header */}
            <StorefrontNavbar storeName={brandName} logoImage={logoImage} activePage="store" className="relative z-30" />

            {/* HERO - imagem literal com overlays percentuais */}
            <section data-editor-type="other" data-editor-section="hero" data-editor-label="Seção hero" className="relative overflow-hidden bg-[#1a3c2a] shadow-[0_14px_34px_rgba(26,60,42,0.25)]" style={{fontFamily:selectedFontStack}}>
              <img data-editor-type="image" data-editor-media-kind="banner" data-editor-id="hero-image" src={heroImage} alt="" aria-hidden="true" className="block h-auto w-full"/>

              <div className="absolute inset-0" aria-label={"Conte\u00fado do banner principal"}>
                <div className="absolute z-20 overflow-hidden bg-white text-[#1f2933]" style={{ left: "3.12%", top: "0%", width: "19.45%", height: "100%" }}>
                  <div className="flex h-[7.9%] w-full items-center border-b border-black/5 bg-white px-[5%]" style={{ fontSize: "clamp(7.5px,0.82vw,13px)" }}>
                    <div className="flex h-[68%] w-full items-center gap-[7%] rounded-[3px] bg-[#12301f] px-[6%] text-white">
                      <Menu size={15} strokeWidth={2} className="h-[1.18em] w-[1.18em] shrink-0"/>
                      <span className="font-medium leading-none">Categorias</span>
                    </div>
                  </div>
                  <div className="h-[92.1%] overflow-y-auto px-[7%] py-[4.2%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {sidebarIconCategories.map((category)=>{
                      const CategoryIcon = getCategoryIcon(category);
                      return <a key={category} href="#categorias" onMouseEnter={(event)=>{event.currentTarget.style.backgroundColor=accent;event.currentTarget.style.color="#fff";}} onMouseLeave={(event)=>{event.currentTarget.style.backgroundColor="";event.currentTarget.style.color="#1f2933";}} className="group flex h-[9.2%] min-h-[30px] w-full items-center gap-[8%] rounded-[2px] px-[3%] font-medium leading-none text-[#1f2933] transition" style={{ fontSize: "clamp(7px,0.72vw,10.5px)" }}>
                        <CategoryIcon data-editor-type="icon" data-editor-icon="Sparkles" size={15} strokeWidth={1.65} className="h-[1.55em] w-[1.55em] shrink-0"/>
                        <span data-editor-type="text" className="min-w-0 flex-1 truncate">{category}</span>
                        <ChevronLeft size={12} className="h-[1.28em] w-[1.28em] shrink-0 rotate-180 text-current opacity-70"/>
                      </a>;
                    })}
                    {sidebarExtraCategories.map((category)=>{
                      return <a key={category} href="#categorias" onMouseEnter={(event)=>{event.currentTarget.style.backgroundColor=accent;event.currentTarget.style.color="#fff";}} onMouseLeave={(event)=>{event.currentTarget.style.backgroundColor="";event.currentTarget.style.color="#1f2933";}} className="flex min-h-[24px] w-full items-center rounded-[2px] px-[3%] font-medium leading-none text-[#1f2933] transition" style={{ fontSize: "clamp(6.5px,0.66vw,9.5px)" }}>{category}</a>;
                    })}
                    <div className="my-[4%] border-t border-black/10" />
                    {["Ofertas especiais","Cart\u00f5es presente"].map((item)=>(
                      <a key={item} href="#ofertas" onMouseEnter={(event)=>{event.currentTarget.style.backgroundColor=accent;event.currentTarget.style.color="#fff";}} onMouseLeave={(event)=>{event.currentTarget.style.backgroundColor="";event.currentTarget.style.color="#1f2933";}} className="flex min-h-[28px] w-full items-center gap-[8%] rounded-[2px] px-[3%] font-medium leading-none text-[#1f2933] transition" style={{ fontSize: "clamp(7px,0.72vw,10.5px)" }}>
                        <Gift data-editor-type="icon" data-editor-icon="Gift" size={15} strokeWidth={1.65} className="h-[1.55em] w-[1.55em] shrink-0"/>
                        <span data-editor-type="text" className="min-w-0 flex-1 truncate">{item}</span>
                      </a>
                    ))}
                  </div>
                </div>                <span aria-hidden="true" className="absolute z-10 bg-[#12301f]" style={{ left: "27.1%", top: "3.55%", width: "39.2%", height: "3.8%" }} />
                <span aria-hidden="true" className="absolute z-10 bg-[#1a3c2a]" style={{ left: "80.6%", top: "3.55%", width: "14.2%", height: "3.8%" }} />
                {heroNavLinks.map((item)=>(
                  <a key={item.label} href={item.href} className="absolute z-20 flex items-center whitespace-nowrap px-[0.15%] font-semibold leading-none text-white transition hover:text-white/75" style={{ left: item.left, top: "3.92%", width: item.width, height: "3.05%", fontSize: "clamp(9.5px,0.86vw,14px)" }}>{item.label}</a>
                ))}
                <a href="tel:+551234567890" className="absolute z-20 flex items-center whitespace-nowrap px-[0.15%] font-semibold leading-none text-white transition hover:text-white/75" style={{ left: "81.1%", top: "3.92%", width: "13.45%", height: "3.05%", fontSize: "clamp(9.5px,0.86vw,14px)" }}>Suporte: (123) 456-7890</a>

                <div className="absolute text-white" style={{ left: "27.35%", top: "50%", width: "28.4%", transform: "translateY(-50%)" }}>
                  <span data-editor-type="text" className="block font-semibold uppercase tracking-[0.08em] text-[#eef1de]" style={{ fontSize: "clamp(6.5px,0.68vw,10.5px)" }}>{categories[0] || "Novidades"}</span>
                  <h1 data-editor-type="text" className="mt-[2.8%] font-semibold leading-[1.06] tracking-[-0.012em] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.22)]" style={{ fontSize: "clamp(22px,2.55vw,44px)" }}>{headlinePrimary}<br/>{headlineSecondary}</h1>
                  <p data-editor-type="text" className="mt-[3.4%] truncate font-normal leading-none text-white/72" style={{ fontSize: "clamp(8px,0.86vw,13.5px)" }}>{heroSubtitle}</p>
                  <a data-editor-role="button" href={heroCtaHref} className="mt-[5%] inline-flex items-center justify-center whitespace-nowrap rounded-full bg-[#eef1de] font-semibold text-[#1a3c2a] shadow-[0_7px_18px_rgba(0,0,0,0.15)] transition hover:-translate-y-0.5 hover:bg-white" style={{ minWidth: "36%", height: "clamp(26px,2.65vw,44px)", paddingInline: "5.5%", gap: "0.45rem", fontSize: "clamp(6.5px,0.68vw,10.5px)" }}>{ctaPrimary || "Comprar agora"}<ChevronLeft aria-hidden="true" size={10} strokeWidth={2} className="rotate-180"/></a>
                </div>

                <div className="absolute z-20 flex items-center gap-[1.2%]" style={{ left: "39.9%", top: "94.1%", width: "8.8%", height: "2.8%" }} aria-label="Carrossel do banner">
                  {[0,1,2].map((dot)=>(
                    <button key={dot} type="button" aria-label={`Banner ${dot+1}`} className="h-full flex-1 rounded-full bg-transparent" />
                  ))}
                </div>
              </div>
            </section>
            {renderCustomSectionsAfter("hero")}
            {/* BROWSE BY CATEGORY */}
            <section data-editor-type="other" data-editor-section="categories" data-editor-label="Seção de categorias" className="px-6 pb-7 pt-5">
              <div className="mb-4 text-center">
                <h2 className="text-[15px] font-semibold leading-none tracking-normal">Navegue por categorias</h2>
                <p className="mt-1 text-[9px] leading-none text-black/50">{"Explore cole\u00e7\u00f5es selecionadas para cada parte da sua rotina."}</p>
              </div>
              <div className="relative">
                <div className="flex w-full items-start justify-between gap-3 overflow-x-auto pb-2 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {browseCategories.map(({category,imageUrl})=>(
                    <a key={category} href="#categorias" className="group grid w-[84px] shrink-0 grid-rows-[84px_28px] justify-items-center gap-2 text-center">
                      <span className="flex h-[84px] w-[84px] items-center justify-center overflow-hidden rounded-full bg-[#e8ecd6] transition duration-300 group-hover:-translate-y-1">
                        <img data-editor-type="image" src={imageUrl} alt={category} className="h-full w-full object-contain p-2"/>
                      </span>
                      <span className="flex min-h-[24px] items-start justify-center text-[8.5px] font-medium leading-tight text-black/80">{category}</span>
                    </a>
                  ))}
                </div>
                <button type="button" aria-label="Ver mais categorias" className="absolute right-0 top-[28px] flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-[0_4px_14px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5"><ChevronLeft size={14} className="rotate-180"/></button>
              </div>
            </section>
            {renderCustomSectionsAfter("categories")}

            {/* TRENDING PRODUCTS */}
            <section data-editor-type="other" data-editor-section="body" data-editor-label="Seção de produtos" className="px-6 pb-8 pt-1">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="text-[16px] font-semibold leading-none tracking-normal">Produtos em alta <span className="text-[#f5b800]">{"\u26a1"}</span></h2>
                  <p className="mt-1 text-[10px] text-black/50">Os produtos mais recentes da sua loja.</p>
                </div>
                <a href="#produtos" className="flex items-center gap-2 text-[10px] font-medium text-black/70 transition hover:text-black">Ver todos <ChevronLeft size={12} className="rotate-180"/></a>
              </div>
              <div id="produtos" className={`grid gap-x-4 gap-y-6 ${mobilePreview?"grid-cols-2":"grid-cols-2 md:grid-cols-6"}` }>
                {displayedProducts.slice(0,6).map((product)=>{
                  const explicitRating = product.rating ?? product.averageRating;
                  const explicitCount = product.ratingCount ?? product.reviewCount ?? product.reviewsCount;
                  const mockMetrics = getProductCatalogMetrics({ id: product.id, rating: explicitRating ?? null, ordersCount: null });
                  const ratingLabel = typeof explicitRating === "number" ? `${explicitRating.toFixed(1)}${explicitCount ? ` (${explicitCount})` : ""}` : `${mockMetrics.rating.toFixed(1)} (${formatReviewCount(mockMetrics.ordersCount)})`;
                  return (
                    <article key={product.id} className="group min-w-0">
                      <div className="relative aspect-[1/1.04] overflow-hidden rounded-[16px] bg-white">
                        <img data-editor-type="image" data-editor-product="true" data-editor-product-id={product.id} src={product.imageUrl||heroImage} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>
                        <button type="button" aria-label={`Favoritar ${product.title}`} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-black/70 shadow-sm transition hover:text-black"><Heart data-editor-type="icon" data-editor-icon="Heart" size={12} strokeWidth={1.5}/></button>
                      </div>
                      {ratingLabel ? <div className="mt-2 flex items-center gap-1 text-[8.5px] font-semibold text-black/45"><Star data-editor-type="icon" data-editor-icon="Star" size={10} strokeWidth={1.8} className="fill-[#f5b800] text-[#f5b800]"/><span data-editor-type="text">{ratingLabel}</span></div> : null}
                      <h3 data-editor-type="text" className="mt-1 line-clamp-2 min-h-[28px] text-[11px] font-medium leading-snug text-black/85">{product.title}</h3>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <strong className="text-[12px] font-semibold text-black">{formatBRL(Math.max(product.price*2.1,product.price+20))}</strong>
                        <button type="button" aria-label={`Adicionar ${product.title} ao carrinho`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border border-black/20 bg-white text-black shadow-sm transition hover:-translate-y-0.5 hover:text-black"><ShoppingCart data-editor-type="icon" data-editor-icon="ShoppingCart" size={14} strokeWidth={1.75}/></button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
            {renderCustomSectionsAfter("body")}
            {/* PROMO BANDS */}
            <section data-editor-type="other" data-editor-section="promotions" data-editor-label="Seção promocional" className="grid grid-cols-1 gap-4 px-8 py-10 md:grid-cols-2">
              <div className="relative flex min-h-[220px] overflow-hidden rounded-[18px] bg-[#1a3c2a] text-white">
                <div className="relative z-10 flex flex-1 flex-col justify-between p-6">
                  <div>
                    <strong className="text-[10px] font-semibold tracking-[0.18em] text-white/70">OFERTA ESPECIAL</strong>
                    <h3 className="mt-1 text-[28px] font-semibold leading-[1.04] tracking-[-0.015em]">{"Pre\u00e7os que surpreendem"}</h3>
                    <p className="mt-2 max-w-[180px] text-[10px] text-white/55">{"Encontre produtos selecionados com condi\u00e7\u00f5es especiais por tempo limitado."}</p>
                  </div>
                  <button className="mt-4 w-fit rounded-full bg-white px-4 py-1.5 text-[9.5px] font-medium text-black">Ver ofertas</button>
                </div>
                <div className="relative w-[44%] shrink-0 overflow-hidden"><img data-editor-type="image" data-editor-product="true" data-editor-product-id={displayedProducts[1%displayedProducts.length]?.id} src={displayedProducts[1%displayedProducts.length]?.imageUrl||heroImage} alt="" className="absolute inset-0 h-full w-full object-cover object-center"/></div>
              </div>
              <div className="relative flex min-h-[220px] overflow-hidden rounded-[18px] bg-[#eef1de]">
                <div className="relative z-10 flex flex-1 flex-col justify-between p-6">
                  <div>
                    <strong className="text-[10px] font-semibold tracking-[0.18em] text-black/50">ACABOU DE CHEGAR</strong>
                    <h3 className="mt-1 text-[28px] font-semibold leading-[1.04] tracking-[-0.015em]">{"Novidades para voc\u00ea"}</h3>
                    <p className="mt-2 max-w-[180px] text-[10px] text-black/55">{"Explore os lan\u00e7amentos mais recentes de todas as categorias da loja."}</p>
                  </div>
                  <button className="mt-4 w-fit rounded-full bg-[#1a3c2a] px-4 py-1.5 text-[9.5px] font-medium text-white">Conhecer novidades</button>
                </div>
                <div className="relative w-[44%] shrink-0 overflow-hidden"><img data-editor-type="image" data-editor-product="true" data-editor-product-id={displayedProducts[2%displayedProducts.length]?.id} src={displayedProducts[2%displayedProducts.length]?.imageUrl||heroImage} alt="" className="absolute inset-0 h-full w-full object-cover object-center"/></div>
              </div>
            </section>
            {renderCustomSectionsAfter("promotions")}

            {/* FEATURED COLLECTIONS */}
            <section data-editor-type="other" data-editor-section="collections" data-editor-label="Seção de coleções" className="px-8 pb-6 pt-10">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-[15px] font-semibold leading-none tracking-normal text-black">{"Cole\u00e7\u00f5es em destaque"}</h2>
                  <p className="mt-2 text-[10.5px] leading-none text-black/50">{"Explore a loja pela categoria que combina com voc\u00ea."}</p>
                </div>
                <a href="/catalogo" className="inline-flex shrink-0 items-center gap-1.5 text-[10.5px] font-medium text-black transition hover:translate-x-0.5 hover:text-black/65">
                  Ver todas <span aria-hidden="true">{"\u2192"}</span>
                </a>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {categoryHighlights.map(({category,imageUrl,key},index)=>(
                  <a key={key} href={`/catalogo?categoria=${encodeURIComponent(category)}`} className={`group relative aspect-[1.55/1] overflow-hidden rounded-[14px] ${collectionStyles[index % collectionStyles.length]} text-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.035)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_35px_rgba(16,24,40,0.12)]`}>
                    <img data-editor-type="image" src={imageUrl} alt={category} className="absolute bottom-0 right-0 h-[96%] w-[68%] object-contain object-right-bottom p-2 transition duration-500 group-hover:scale-105"/>
                    <div className="absolute inset-x-0 bottom-0 z-10 p-4">
                      <strong className="block max-w-[56%] text-[13px] font-semibold leading-[1.08] text-black">{category}</strong>
                      <span className="mt-1 block max-w-[58%] text-[8.5px] font-normal leading-snug text-black/58">
                        {collectionDescriptions[category] || "Explore produtos escolhidos para voc\u00ea."}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
            {renderCustomSectionsAfter("collections")}

            <section data-editor-type="other" data-editor-section="end" data-editor-label="Seção final" aria-label="Benef\u00edcios da loja" className="mx-8 mb-8 overflow-hidden rounded-[10px] bg-[#06263b] text-white shadow-[0_14px_30px_rgba(2,20,32,0.14)]">
              <div className={`grid ${mobilePreview ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
                {trustBadges.map(({title,description,icon: Icon},index)=>(
                  <div key={title} className={`flex min-h-[64px] items-center gap-3 px-5 py-4 ${index > 0 ? "md:border-l md:border-white/10" : ""} ${index > 1 ? "border-t border-white/10 md:border-t-0" : ""}`}>
                    <Icon data-editor-type="icon" size={18} strokeWidth={1.75} className="shrink-0 text-white/90"/>
                    <div className="min-w-0">
                      <strong className="block text-[10px] font-semibold leading-tight text-white">{title}</strong>
                      <span className="mt-0.5 block text-[8px] leading-tight text-white/70">{description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            {renderCustomSectionsAfter("end")}

            <footer className="border-t border-black/10 bg-[#f5f4f2] px-8 py-7 text-center text-[10px] tracking-[0.12em] text-black/45">{"\u00a9"} {new Date().getFullYear()} {brandName} {"\u00b7"} Todos os direitos reservados</footer>
            </>
            )}

          </div>

          {activeTemplate.kind === "produto" && projectSlug ? (
            <>
              {[
                { key: "carrinho", label: "Tela 2 · Carrinho", path: `/loja/${projectSlug}/carrinho?preview=1` },
                { key: "checkout", label: "Tela 3 · Checkout", path: `/loja/${projectSlug}/checkout?preview=1` },
              ].map((screen, idx) => {
                const baseWidth = mobilePreview ? 390 : 1440;
                const gap = 120;
                const leftOffset = (baseWidth + gap) * (idx + 1);
                const panelHeight = mobilePreview
                  ? (screen.key === "carrinho" ? 1080 : 1480)
                  : (screen.key === "carrinho" ? 940 : 1120);
                return (
                  <div
                    key={screen.key}
                    className="pointer-events-none absolute top-0"
                    style={{ left: leftOffset, width: baseWidth }}
                  >
                    <div className="mb-4 flex h-10 items-center gap-2.5 text-[18px] font-semibold tracking-[-0.015em] text-white/78">
                      <Monitor size={20} strokeWidth={1.8} />
                      {screen.label}
                      <span className="rounded-full border border-white/[0.10] bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold tracking-normal text-white/55">Preview</span>
                    </div>
                    <div
                      className="relative overflow-hidden bg-white shadow-[0_30px_100px_rgba(0,0,0,0.46)] ring-1 ring-white/[0.10]"
                      style={{ width: baseWidth, height: panelHeight }}
                    >
                      <iframe
                        src={screen.path}
                        title={screen.label}
                        style={{ width: "100%", height: "100%", border: 0, pointerEvents: "none" }}
                      />
                    </div>
                  </div>
                );
              })}
              {[1, 2].map((idx) => {
                const baseWidth = mobilePreview ? 390 : 1440;
                const gap = 120;
                const leftOffset = (baseWidth + gap) * idx - gap + 20;
                const panelHeight = mobilePreview ? 920 : 760;
                return (
                  <div
                    key={`arrow-${idx}`}
                    className="pointer-events-none absolute flex items-center text-white/30"
                    style={{ left: leftOffset, top: 56 + panelHeight / 2 - 14, width: gap - 40 }}
                  >
                    <div className="h-px flex-1 bg-white/20" />
                    <ArrowRight size={28} strokeWidth={1.8} />
                  </div>
                );
              })}

            </>
          ) : null}
        </div>


          {selectedSectionAnchor && activeTemplate.kind === "loja" ? (
            <button
              data-editor-ignore
              data-canvas-ui
              type="button"
              onPointerDown={(event)=>event.stopPropagation()}
              onClick={addSectionAfterSelected}
              className="fixed z-[58] flex h-11 items-center gap-2 rounded-full border border-[#5b6167] bg-[#111315] px-5 text-[13px] font-semibold text-white shadow-[0_18px_50px_rgba(0,0,0,0.38)] transition hover:-translate-y-0.5 hover:border-[#858c93] hover:bg-[#1b1e21]"
              style={{
                left: addSectionButtonLeft,
                top: addSectionButtonTop,
                transform: `translate(-50%, -50%) scale(${Math.max(0.72, selectedToolbarScale)})`,
                transformOrigin: "center",
              }}
            >
              <Plus size={16} strokeWidth={2.1}/>
              Adicionar uma seção
            </button>
          ) : null}

          {selectedElement?.type === "image" && !mediaModalOpen ? (
            <div
              data-editor-ignore
              className="fixed z-50 flex flex-col items-center gap-2 rounded-full bg-[#090909] p-2 text-white shadow-[0_22px_55px_rgba(0,0,0,0.38)] ring-1 ring-white/12"
              style={selectedToolbarStyle}
            >
              <button type="button" onClick={isSelectedProductImage ? openProductReplacementDrawer : ()=>setMediaModalOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/12" aria-label={isSelectedProductImage ? "Substituir produto" : "Editar imagem"}>
                {isSelectedProductImage ? <Package size={22} strokeWidth={2.1}/> : <Pencil size={22} strokeWidth={2.1} />}
              </button>
              <button type="button" onClick={duplicateSelectedElement} className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/12" aria-label="Duplicar imagem">
                <Copy size={22} strokeWidth={2.1} />
              </button>
              <button type="button" onClick={()=>handleAiPlaceholder("Editar imagem com IA")} className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/12" aria-label="Editar com IA">
                <Sparkles size={22} strokeWidth={2.1} />
              </button>
            </div>
          ) : null}

          {selectedElement?.type === "icon" ? (
            <div
              data-editor-ignore
              className="fixed z-50 flex min-h-[62px] items-center gap-3 rounded-[18px] bg-[#101010] px-4 py-2.5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.38)] ring-1 ring-white/12"
              style={selectedToolbarStyle}
            >
              <div className="relative">
                <button type="button" onClick={()=>setIconPickerOpen((open)=>!open)} className="inline-flex h-11 items-center gap-2 rounded-full px-2.5 text-[18px] font-semibold transition hover:bg-white/10">
                  <Sparkles size={20} />
                  Ícone
                </button>
                {iconPickerOpen ? (
                  <div className="absolute left-0 top-[calc(100%+10px)] grid w-[250px] grid-cols-5 gap-2 rounded-[18px] bg-[#101010] p-3 shadow-[0_18px_55px_rgba(0,0,0,0.42)] ring-1 ring-white/12">
                    {iconPickerOptions.map(({ name, label, icon: PickerIcon }) => (
                      <button key={name} type="button" title={label} onClick={()=>applyIconName(name)} className={`flex h-10 items-center justify-center rounded-[12px] transition ${contextControls.iconName===name?"bg-white text-black":"bg-white/[0.06] text-white hover:bg-white/12"}`}>
                        <PickerIcon size={20} strokeWidth={1.8} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <span className="h-8 w-px bg-white/12" />
              <div className="flex h-11 items-center gap-2 rounded-[12px] bg-white/[0.055] px-2">
                <button type="button" onClick={()=>applyIconSize(-2)} className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/12 transition hover:bg-white/20" aria-label="Diminuir ícone"><Minus size={18}/></button>
                <span className="w-14 text-center text-[18px] font-semibold">{contextControls.iconSize}px</span>
                <button type="button" onClick={()=>applyIconSize(2)} className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/12 transition hover:bg-white/20" aria-label="Aumentar ícone"><Plus size={20}/></button>
              </div>
              <span className="h-8 w-px bg-white/12" />
              <label className="relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-2.5 text-[18px] font-semibold transition hover:bg-white/10">
                <span className="h-8 w-8 rounded-full ring-1 ring-white/25" style={{ backgroundColor: contextControls.color }} />
                Cor
                <input type="color" value={colorToHex(contextControls.color)} onChange={(event)=>applyElementColor(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <span className="h-8 w-px bg-white/12" />
              <button type="button" onClick={deleteSelectedElement} className="flex h-11 w-11 items-center justify-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-white" aria-label="Excluir ícone"><Trash2 size={22}/></button>
              <button type="button" onClick={clearSelection} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/75 transition hover:bg-white/18 hover:text-white" aria-label="Fechar toolbar"><X size={23}/></button>
            </div>
          ) : null}

          {isSelectedButton ? (
            <div
              data-editor-ignore
              data-canvas-ui
              className="fixed z-50 flex h-[52px] items-center rounded-[14px] bg-[#101010] px-2 text-white shadow-[0_24px_70px_rgba(0,0,0,0.42)] ring-1 ring-white/12"
              style={selectedToolbarStyle}
            >
              <button type="button" onClick={()=>toggleButtonToolbarPanel("style")} className={`inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold transition ${buttonToolbarPanel==="style"?"bg-white/[0.10]":"hover:bg-white/[0.08]"}`}>
                <Palette size={18} strokeWidth={2} />
                Estilo
              </button>
              <span className="mx-1 h-8 w-px bg-white/12" />
              <button type="button" onClick={()=>toggleButtonToolbarPanel("size")} className={`inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold transition ${buttonToolbarPanel==="size"?"bg-white/[0.10]":"hover:bg-white/[0.08]"}`}>
                <Plus size={18} strokeWidth={2} />
                Tamanho
              </button>
              <span className="mx-1 h-8 w-px bg-white/12" />
              <button type="button" onClick={()=>toggleButtonToolbarPanel("radius")} className={`inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold transition ${buttonToolbarPanel==="radius"?"bg-white/[0.10]":"hover:bg-white/[0.08]"}`}>
                <span aria-hidden="true" className="h-[18px] w-[18px] rounded-bl-[15px] border-b-2 border-l-2 border-white" />
                Raio
              </button>
              <span className="mx-1 h-8 w-px bg-white/12" />
              <button type="button" onClick={()=>toggleButtonToolbarPanel("text")} className={`inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold transition ${buttonToolbarPanel==="text"?"bg-white/[0.10]":"hover:bg-white/[0.08]"}`}>
                <Type size={18} strokeWidth={2} />
                Texto
              </button>
              <span className="mx-1 h-8 w-px bg-white/12" />
              <button type="button" onClick={selectButtonIcon} className={`inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold transition ${buttonToolbarPanel==="icon"?"bg-white/[0.10]":"hover:bg-white/[0.08]"}`}>
                <Sparkles size={18} strokeWidth={2} />
                Ícone
              </button>
              <span className="mx-1 h-8 w-px bg-white/12" />
              <button type="button" onClick={clearSelection} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white/62 transition hover:bg-white/[0.14] hover:text-white" aria-label="Fechar toolbar"><X size={19}/></button>
            </div>
          ) : null}

          {selectedElement?.type === "text" && !isSelectedButton ? (
            <div
              data-editor-ignore
              className="fixed z-50 flex min-h-[62px] items-center gap-3 rounded-[18px] bg-[#101010] px-4 py-2.5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.38)] ring-1 ring-white/12"
              style={selectedToolbarStyle}
            >
              <button type="button" onClick={() => void handleRewriteText()} disabled={rewritingText} className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-[18px] font-semibold transition hover:bg-white/16 disabled:opacity-60">
                {rewritingText ? <Loader2 size={22} className="animate-spin" /> : <Sparkles size={22} />}
                {rewritingText ? "Reescrevendo" : "Reescrever"}
              </button>
              <span className="h-8 w-px bg-white/12" />
              <div className="flex items-center gap-1">
                {[
                  { value: "left" as const, icon: AlignLeft, label: "Alinhar à esquerda" },
                  { value: "center" as const, icon: AlignCenter, label: "Centralizar" },
                  { value: "right" as const, icon: AlignRight, label: "Alinhar à direita" },
                ].map(({ value, icon: AlignIcon, label }) => (
                  <button key={value} type="button" onClick={()=>applyTextAlign(value)} aria-label={label} className={`flex h-10 w-10 items-center justify-center rounded-[10px] transition ${contextControls.textAlign===value?"bg-white/18":"hover:bg-white/10"}`}>
                    <AlignIcon size={22} />
                  </button>
                ))}
              </div>
              <span className="h-8 w-px bg-white/12" />
              <div className="flex h-11 items-center gap-2 rounded-[12px] bg-white/[0.055] px-2">
                <button type="button" onClick={()=>applyTextSize(-1)} className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/12 transition hover:bg-white/20" aria-label="Diminuir texto"><Minus size={18}/></button>
                <span className="w-8 text-center text-[18px] font-semibold">{contextControls.fontSize}</span>
                <button type="button" onClick={()=>applyTextSize(1)} className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/12 transition hover:bg-white/20" aria-label="Aumentar texto"><Plus size={20}/></button>
              </div>
              <div className="relative">
                <button type="button" onClick={()=>setWeightMenuOpen((open)=>!open)} className="inline-flex h-11 min-w-[112px] items-center justify-center gap-2 rounded-full px-3 text-[18px] font-semibold transition hover:bg-white/10">
                  {textWeightOptions.find((item)=>item.value===contextControls.fontWeight)?.label ?? "Médio"}
                  <ChevronDown size={18} />
                </button>
                {weightMenuOpen ? (
                  <div className="absolute left-0 top-[calc(100%+10px)] w-[150px] overflow-hidden rounded-[14px] bg-[#101010] p-1 shadow-[0_18px_55px_rgba(0,0,0,0.42)] ring-1 ring-white/12">
                    {textWeightOptions.map((item)=>(
                      <button key={item.value} type="button" onClick={()=>applyTextWeight(item.value)} className={`block h-9 w-full rounded-[10px] px-3 text-left text-[13px] transition ${contextControls.fontWeight===item.value?"bg-white text-black":"text-white hover:bg-white/10"}`}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <label className="relative h-11 w-11 cursor-pointer overflow-hidden rounded-full ring-1 ring-white/20">
                <span className="absolute inset-2 rounded-full" style={{ backgroundColor: contextControls.color }} />
                <input type="color" value={colorToHex(contextControls.color)} onChange={(event)=>applyElementColor(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <button type="button" onClick={clearSelection} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/75 transition hover:bg-white/18 hover:text-white" aria-label="Fechar toolbar"><X size={23}/></button>
            </div>
          ) : null}

          {selectedElement?.type === "other" && !isSelectedButton ? (
            <div
              data-editor-ignore
              className="fixed z-50 flex min-h-[62px] items-center gap-3 rounded-[18px] bg-[#101010] px-4 py-2.5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.38)] ring-1 ring-white/12"
              style={selectedToolbarStyle}
            >
              <div className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-[18px] font-semibold">
                <LayoutGrid size={21} strokeWidth={1.8} />
                {selectedElement.label}
              </div>
              <span className="h-8 w-px bg-white/12" />
              <label className="relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-[17px] font-semibold transition hover:bg-white/10">
                <span className="h-8 w-8 rounded-full ring-1 ring-white/25" style={{ backgroundColor: fillColor }} />
                Fundo
                <input type="color" value={fillColor} onChange={(event)=>applyElementBackground(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <span className="h-8 w-px bg-white/12" />
              <button type="button" onClick={duplicateSelectedElement} className="flex h-11 items-center gap-2 rounded-full px-3 text-[16px] font-semibold text-white/78 transition hover:bg-white/10 hover:text-white" aria-label="Duplicar elemento">
                <Copy size={20} />
                Duplicar
              </button>
              <button type="button" onClick={deleteSelectedElement} className="flex h-11 w-11 items-center justify-center rounded-full text-white/62 transition hover:bg-white/10 hover:text-white" aria-label="Excluir elemento"><Trash2 size={21}/></button>
              <button type="button" onClick={clearSelection} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/75 transition hover:bg-white/18 hover:text-white" aria-label="Fechar toolbar"><X size={23}/></button>
            </div>
          ) : null}

          {contextNotice ? (
            <div data-editor-ignore className="fixed bottom-6 left-1/2 z-[60] max-w-[440px] -translate-x-1/2 rounded-full bg-[#101010] px-5 py-3 text-center text-[12px] font-medium text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
              {contextNotice}
              <button type="button" onClick={()=>setContextNotice(null)} className="ml-3 text-white/55 hover:text-white">Fechar</button>
            </div>
          ) : null}

          <div data-canvas-ui className="absolute bottom-5 right-5 z-40 flex items-center gap-1 rounded-full border border-white/[0.10] bg-[#17181a]/92 p-1 text-white/62 shadow-[0_18px_54px_rgba(0,0,0,0.34)] backdrop-blur-xl">
            <button type="button" onClick={() => changeCanvasZoom(-0.08)} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/[0.09] hover:text-white" aria-label="Diminuir zoom"><Minus size={14} /></button>
            <button type="button" onClick={resetCanvasView} className="h-8 min-w-[54px] rounded-full px-2 text-[9px] font-semibold tabular-nums transition hover:bg-white/[0.09] hover:text-white" aria-label="Restaurar visualização">{Math.round(canvasZoom * 100)}%</button>
            <button type="button" onClick={() => changeCanvasZoom(0.08)} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/[0.09] hover:text-white" aria-label="Aumentar zoom"><Plus size={14} /></button>
            <span className="mx-1 h-4 w-px bg-white/[0.10]" />
            <button type="button" onClick={resetCanvasView} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/[0.09] hover:text-white" aria-label="Centralizar página"><RefreshCcw size={13} /></button>
          </div>

          <div data-editor-ignore data-canvas-ui className="pointer-events-none fixed right-5 top-1/2 z-50 flex -translate-y-1/2 flex-row items-center gap-3">
            {editMode === "fill" && selectedPath && fillPickerOpen ? (
              <div className="pointer-events-auto mr-1 rounded-[16px] border border-white/[0.10] bg-[#17181a]/95 p-3 text-white shadow-[0_20px_60px_rgba(0,0,0,0.40)] backdrop-blur-xl">
                <div className="mb-2 flex items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  <span>Cor de destaque</span>
                  <span className="h-4 w-4 rounded-full ring-1 ring-white/30" style={{ backgroundColor: fillColor }} />
                </div>
                <div className="flex items-center gap-2">
                  {fillSwatches.map((color)=>(
                    <button key={color} type="button" onClick={()=>handleFillColorChange(color)} aria-label={`Aplicar ${color}`} className={`h-7 w-7 rounded-full transition ${fillColor===color?"ring-2 ring-white ring-offset-2 ring-offset-[#101010]":"ring-1 ring-white/20 hover:scale-105"}`} style={{ backgroundColor: color }} />
                  ))}
                  <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full ring-1 ring-white/25" title="Cor personalizada">
                    <span className="absolute inset-0 bg-[conic-gradient(from_0deg,#ff0080,#ff8c00,#ffee00,#00ff85,#00b8ff,#8a2be2,#ff0080)]" />
                    <input type="color" value={fillColor} onChange={(event)=>handleFillColorChange(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                  </label>
                </div>
              </div>
            ) : null}
            <div className="pointer-events-auto flex flex-col items-center gap-1 rounded-full border border-[#34383c]/90 bg-[rgba(7,9,11,0.80)] p-1.5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.46)] backdrop-blur-xl">
              {canvasToolbarItems.map((tool)=>{
                const Icon = tool.icon;
                const isActive = canvasToolbarMode === tool.id;
                return (
                  <div key={tool.id} className="contents">
                    {tool.dividerBefore ? <span className="my-1 h-px w-7 bg-[#3a3e42]" /> : null}
                    <button type="button" onClick={()=>handleCanvasToolbarClick(tool.id)} aria-label={tool.label} title={tool.label} className={`relative flex h-10 w-10 items-center justify-center rounded-full transition duration-200 ${isActive?"bg-[#f5f5f3] text-[#111214] shadow-[0_6px_20px_rgba(255,255,255,0.16)]":"text-white/88 hover:bg-white/[0.08] hover:text-white"}`}>
                      <Icon size={20} strokeWidth={1.9} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>


        </div>

      <AnimatePresence>
        {mediaModalOpen && selectedElement?.type === "image" && !isSelectedProductImage ? (
          <motion.section
            data-editor-ignore
            role="dialog"
            aria-label="Ferramentas da imagem"
            initial={{ opacity: 0, scale: selectedToolbarScale * 0.96, y: 10 }}
            animate={{ opacity: 1, scale: selectedToolbarScale, y: 0 }}
            exit={{ opacity: 0, scale: selectedToolbarScale * 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="fixed z-[70] max-h-[calc(100vh-32px)] overflow-y-auto rounded-[20px] border border-[#34383d] p-4 text-white shadow-[0_30px_100px_rgba(0,0,0,0.68)] backdrop-blur-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ top: selectedImagePanelTop, left: selectedImagePanelLeft, width: selectedImagePanelWidth, transformOrigin: "top left", background: "rgba(8,10,12,0.97)", color: "#ffffff" }}
          >
            <div className="relative overflow-hidden rounded-[14px] bg-black">
              {selectedMediaSrc ? (
                <img
                  src={selectedMediaSrc}
                  alt=""
                  className="h-[210px] w-full object-cover opacity-90"
                  style={{
                    aspectRatio: contextControls.imageShape === "wide" ? "16 / 9" : contextControls.imageShape === "auto" ? undefined : "1 / 1",
                    borderRadius: contextControls.imageShape === "circle" ? 999 : undefined,
                  }}
                />
              ) : (
                <div className="grid h-[210px] place-items-center text-[13px] text-white/45">Nenhuma imagem selecionada</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
              <button type="button" onClick={()=>contextMediaInput.current?.click()} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[12px] bg-black/78 px-5 py-3 text-[15px] font-semibold text-white shadow-[0_12px_32px_rgba(0,0,0,0.34)] transition hover:bg-black/92">
                Escolher mídia
              </button>
              <button type="button" onClick={()=>setMediaModalOpen(false)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white/72 backdrop-blur-md transition hover:bg-black/85 hover:text-white" aria-label="Fechar mídia">
                <X size={18} />
              </button>
            </div>

            <button type="button" onClick={()=>handleAiPlaceholder("Editar imagem com IA")} className="mt-3 flex h-14 w-full items-center justify-center gap-3 rounded-[12px] border border-[#34383d] bg-[#24282c] text-[18px] font-semibold text-white transition hover:bg-[#30353a]">
              <Sparkles size={22} />
              Editar com IA
            </button>

            <div className="mt-3 grid grid-cols-4 rounded-[13px] border border-[#292d31] bg-[#111315] p-1.5">
              {imageShapeOptions.map(({ value, label, icon: ShapeIcon }) => (
                <button key={value} type="button" onClick={()=>handleImageShapeChange(value)} title={label} className={`flex h-12 flex-col items-center justify-center gap-1 rounded-[10px] text-[9px] font-semibold transition ${contextControls.imageShape===value?"bg-[#3a4046] text-white shadow-sm":"text-white/52 hover:bg-[#272b2f] hover:text-white"}`}>
                  <ShapeIcon size={18} />
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
              <span className="flex-1 text-[15px] font-semibold text-white/72">Avançado</span>
              <button type="button" onClick={duplicateSelectedElement} className="flex h-10 w-10 items-center justify-center rounded-full text-white/58 transition hover:bg-white/10 hover:text-white" aria-label="Duplicar imagem"><Copy size={19}/></button>
              <button type="button" onClick={deleteSelectedElement} className="flex h-10 w-10 items-center justify-center rounded-full text-white/58 transition hover:bg-white/10 hover:text-white" aria-label="Excluir imagem"><Trash2 size={19}/></button>
              <ChevronDown size={19} className="text-white/48" />
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>


      <AnimatePresence>
        {renameOpen ? (
          <motion.div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onMouseDown={(event) => { if (event.target === event.currentTarget) setRenameOpen(false); }}
          >
            <motion.section
              role="dialog" aria-modal="true"
              initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.19, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[380px] rounded-[20px] border border-white/[0.08] bg-[#1c1d1f] p-6 text-white shadow-[0_28px_80px_rgba(0,0,0,0.6)]"
            >
              <h2 className="text-[16px] font-semibold tracking-[-0.02em]">Renomear projeto</h2>
              <p className="mt-1 text-[12px] text-white/45">Escolha um novo nome para este projeto.</p>
              <input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void handleConfirmRename(); }}
                className="mt-4 h-11 w-full rounded-[12px] border border-white/[0.1] bg-black/30 px-4 text-[14px] text-white outline-none transition focus:border-[#3567e9]"
                placeholder="Nome do projeto"
              />
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setRenameOpen(false)} className="h-10 rounded-[11px] px-4 text-[13px] font-medium text-white/60 transition hover:bg-white/[0.07] hover:text-white">Cancelar</button>
                <button type="button" disabled={menuBusy || !renameValue.trim()} onClick={() => void handleConfirmRename()} className="h-10 rounded-[11px] bg-[#3567e9] px-5 text-[13px] font-semibold text-white transition hover:bg-[#4272ee] disabled:opacity-45">Salvar</button>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDeleteOpen ? (
          <motion.div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmDeleteOpen(false); }}
          >
            <motion.section
              role="dialog" aria-modal="true"
              initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.19, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[380px] rounded-[20px] border border-white/[0.08] bg-[#1c1d1f] p-6 text-white shadow-[0_28px_80px_rgba(0,0,0,0.6)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ff6a6a]/[0.14] text-[#ff6a6a]"><Trash2 size={19} /></div>
              <h2 className="mt-4 text-[16px] font-semibold tracking-[-0.02em]">Excluir projeto</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-white/45">Tem certeza que deseja excluir <strong className="text-white/75">{projectTitle}</strong>? Essa ação não pode ser desfeita.</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmDeleteOpen(false)} className="h-10 rounded-[11px] px-4 text-[13px] font-medium text-white/60 transition hover:bg-white/[0.07] hover:text-white">Cancelar</button>
                <button type="button" disabled={menuBusy} onClick={() => void handleDeleteProject()} className="h-10 rounded-[11px] bg-[#ff6a6a] px-5 text-[13px] font-semibold text-white transition hover:bg-[#ff7d7d] disabled:opacity-45">Excluir</button>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ProjectSettingsOverlay
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        project={currentProject}
        initialSection={settingsSection}
        onProjectChange={setCurrentProject}
        onNameChange={setStoreName}
      />

      {showPlans ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget)setShowPlans(false)}}>
          <section role="dialog" aria-modal="true" aria-labelledby="plans-title" className="relative w-full max-w-[1020px] overflow-hidden rounded-[28px] bg-[#111] p-7 text-white shadow-[0_30px_120px_rgba(0,0,0,0.8)] sm:p-10">
            <button type="button" onClick={()=>setShowPlans(false)} className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-white/55 transition hover:bg-white/10 hover:text-white"><X size={17}/></button>
            <div className="grid gap-8 md:grid-cols-[1.02fr_0.98fr]">
              <div className="flex flex-col">
                <div className="flex items-center gap-3 text-[12px] text-white/55"><span className="flex -space-x-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563eb] text-[9px] font-bold ring-2 ring-[#111]">LV</span><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7c3aed] text-[9px] font-bold ring-2 ring-[#111]">AI</span><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0891b2] text-[9px] font-bold ring-2 ring-[#111]">BR</span></span><span className="underline underline-offset-2">Feito para quem quer vender mais</span></div>
                <h2 id="plans-title" className="mt-7 max-w-[440px] text-[42px] font-semibold leading-[1.12] tracking-[-0.05em]">Crie lojas ilimitadas com a Velo Pro.</h2>
                <p className="mt-10 text-[14px] font-medium text-white/42">Acesse todo o poder da Velo</p>
                <ul className="mt-4 space-y-2">
                  {["Publique lojas sem limite","Redator de IA ilimitado","Se\u00e7\u00f5es focadas em convers\u00e3o","Cr\u00e9ditos mensais para imagens IA","Novos recursos todos os meses","Editor completo inclu\u00eddo"].map((feature,index)=><li key={feature} className="flex min-h-[44px] items-center gap-3 rounded-[9px] bg-white/[0.055] px-4 text-[13px] font-medium"><span className="text-[18px]">{["\u2713","\u2713","\u2713","\u2713","\u2713","\u2713"][index]}</span>{feature}</li>)}
                </ul>
              </div>

              <div className="flex flex-col">
                <div className="overflow-hidden rounded-[17px] border-[3px] border-[#1597f4] bg-[#303030] shadow-[0_5px_0_#1597f4]">
                  <div className="flex flex-wrap items-center gap-3 p-5"><span className="h-4 w-4 rounded-full bg-[#1597f4] ring-4 ring-[#1597f4]/15"/><strong className="text-[18px]">Velo <em>BASE</em></strong><del className="ml-auto text-[20px] text-white/25">R$ 39,90</del><span className="rounded-[9px] bg-white/[0.08] px-3 py-2 text-[26px] font-semibold tracking-[-0.04em]">R$ 29,90 <small className="text-[11px] font-normal text-white/45">{"/m\u00eas"}</small></span></div>
                </div>
                <div className="mt-5 flex items-start gap-3 rounded-[15px] bg-[#332e16] p-5"><Gift className="shrink-0 text-[#facc15]" size={22}/><div><strong className="text-[14px] text-[#f7d978]">{"Subdom\u00ednio gr\u00e1tis com seu plano Base!"}</strong><p className="mt-1 text-[11px] leading-relaxed text-white/45">{"Lance sua marca com um subdom\u00ednio inclu\u00eddo no plano Velo Base."}</p></div></div>
                <div className="mt-auto pt-8"><div className="rounded-[13px] bg-white/[0.055] p-5"><div className="text-[18px] tracking-[0.08em] text-[#facc15]">{"\u2605\u2605\u2605\u2605\u2605"}</div><p className="mt-3 text-[12px] leading-relaxed text-white/55">{"Editor completo, gera\u00e7\u00e3o com IA e suporte para publicar sua primeira loja."}</p></div><button type="button" onClick={()=>upgradeModal.open({ defaultPlan: "base" })} className="mt-4 h-[58px] w-full rounded-[13px] bg-gradient-to-r from-[#0ea5e9] to-[#2563eb] text-[17px] font-semibold shadow-[0_12px_30px_rgba(14,165,233,0.26)] transition hover:brightness-110">Continuar com Base&nbsp; {"\u2192"}</button><p className="mt-3 text-center text-[11px] text-white/40">Cancele a qualquer momento {"\u00b7"} Suporte 24/7</p></div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {contextDrawer ? (
        <div
          className="fixed inset-0 z-[55] bg-black/35 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setContextDrawer(null);
              setReplacingProductPath(null);
            }
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-drawer-title"
            className="editor-context-drawer absolute inset-y-0 right-0 flex w-[360px] flex-col border-l border-[#27272A] bg-[#0A0A0A] text-white shadow-[-24px_0_80px_rgba(0,0,0,0.42)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex min-h-[68px] items-center justify-between border-b border-[#27272A] px-5">
              <div className="min-w-0">
                <h2 id="editor-drawer-title" className="truncate text-[16px] font-semibold">
                  {contextDrawer === "template" ? "Trocar template" : replacingProductPath ? "Substituir produto" : "Adicionar produtos"}
                </h2>
                <p className="mt-1 truncate text-[11px] text-white/40">
                  {contextDrawer === "template" ? "Escolha uma base visual para a loja." : replacingProductPath ? "Escolha o novo produto para este espaço." : "Selecione produtos do catálogo Velo."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setContextDrawer(null);
                  setReplacingProductPath(null);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-white/55 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Fechar painel"
              >
                <X size={20} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {contextDrawer === "template" ? (
                <>
                  <div className="mb-4 flex items-center gap-5 border-b border-[#27272A]">
                    {[
                      { id: "loja" as const, label: "Loja" },
                      { id: "produto" as const, label: "Produto" },
                    ].map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setTemplateCategory(category.id);
                          setDraftTemplate((current) =>
                            current.kind === category.id
                              ? current
                              : { kind: category.id, id: templateOptions[category.id][0].id },
                          );
                        }}
                        className={`relative h-10 text-[13px] font-semibold transition ${
                          templateCategory === category.id ? "text-white" : "text-[#71717A] hover:text-white/75"
                        }`}
                      >
                        {category.label}
                        {templateCategory === category.id ? <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-white" /> : null}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {drawerTemplates.map((template) => {
                      const selected = draftTemplate.kind === templateCategory && draftTemplate.id === template.id;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setDraftTemplate({ kind: templateCategory, id: template.id })}
                          className={`group overflow-hidden rounded-[12px] bg-[#18181B] text-left transition hover:border-[#3F3F46] ${
                            selected ? "border-2 border-white" : "border border-[#27272A]"
                          }`}
                        >
                          <div className="relative aspect-[4/3] overflow-hidden bg-white">
                            <img src={template.image} alt="" className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]" />
                            {selected ? <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-black shadow-lg"><Check size={13} /></span> : null}
                          </div>
                          <div className="p-3">
                            <strong className="block text-[12px] font-semibold text-white">{template.name}</strong>
                            <span className="mt-1 block text-[11px] leading-snug text-white/42">{template.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {contextDrawer === "products" ? (
                <>
                  <div className="mb-4 flex items-center justify-between rounded-[12px] border border-[#27272A] bg-[#121214] px-4 py-3">
                    <div>
                      <strong className="block text-[12px] font-semibold">{replacingProductPath ? "Escolha o produto" : "Produtos disponíveis"}</strong>
                      <span className="mt-0.5 block text-[10px] text-white/42">{replacingProductPath ? "A escolha substituirá o produto atual." : "Marque um ou mais itens para sua vitrine."}</span>
                    </div>
                    <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-semibold text-white/65">{draftProductIds.length} selecionados</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {drawerProducts.map((product) => {
                      const selected = draftProductIds.includes(product.id);
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => setDraftProductIds((current) => replacingProductPath ? (selected ? [] : [product.id]) : selected ? current.filter((id) => id !== product.id) : [...current, product.id])}
                          className={`overflow-hidden rounded-[12px] bg-[#18181B] text-left transition hover:border-[#3F3F46] ${
                            selected ? "border-2 border-white" : "border border-[#27272A]"
                          }`}
                        >
                          <div className="relative aspect-[4/3] bg-white">
                            {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-contain p-3" /> : <div className="grid h-full place-items-center text-black/30"><Package size={24} /></div>}
                            <span className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full shadow-lg transition ${selected ? "bg-white text-black" : "bg-black/65 text-white"}`}>
                              {selected ? <Check size={13} /> : <Plus size={13} />}
                            </span>
                          </div>
                          <div className="p-3">
                            <strong className="line-clamp-2 text-[12px] font-semibold leading-snug text-white">{product.title}</strong>
                            <span className="mt-1 block text-[11px] text-white/42">{formatBRL(product.price)}</span>
                          </div>
                        </button>
                      );
                    })}
                    {!drawerProducts.length ? (
                      <div className="col-span-2 rounded-[12px] border border-dashed border-[#27272A] p-6 text-center text-[12px] text-white/45">
                        Todos os produtos disponíveis já estão na sua loja.
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>

            <footer className="border-t border-[#27272A] p-4">
              <button
                type="button"
                onClick={contextDrawer === "template" ? applyTemplateDraft : () => void applyProductDraft()}
                disabled={contextDrawer === "products" && (!draftProductIds.length || Boolean(sidebarImportingId))}
                className="h-11 w-full rounded-[8px] bg-[#2f6df6] text-[13px] font-semibold text-white shadow-[0_12px_28px_rgba(47,109,246,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-[#27272A] disabled:text-white/35 disabled:shadow-none"
              >
                {contextDrawer === "template"
                  ? "Aplicar"
                  : sidebarImportingId
                    ? "Adicionando..."
                    : replacingProductPath && draftProductIds.length
                      ? "Substituir produto"
                    : draftProductIds.length
                      ? `Adicionar ${draftProductIds.length} ${draftProductIds.length === 1 ? "produto" : "produtos"}`
                      : "Selecione os produtos"}
              </button>
            </footer>
          </aside>
        </div>
      ) : null}

      <AnimatePresence>
        {publishOpen ? (
          <motion.div
            key="publish-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            onMouseDown={(event) => { if (event.target === event.currentTarget) setPublishOpen(false); }}
          >
            <motion.section
              key="publish-panel"
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="w-full max-w-[440px] overflow-hidden rounded-[18px] bg-white text-[#18191c] shadow-[0_40px_120px_rgba(0,0,0,0.4)]"
            >
              <div className="flex items-center justify-between border-b border-[#ececea] px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e9f7ee] text-[#1f9d55]">
                    <Check size={16} />
                  </span>
                  <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
                    {currentProject?.status === "publicado" ? "Site publicado" : "Publicar site"}
                  </h2>
                </div>
                <button type="button" onClick={() => setPublishOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#5f6368] transition hover:bg-[#f3f3f1]" aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a9a96]">
                    Endereço do site
                  </label>
                  {currentProject?.status === "publicado" && publicUrl ? (
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 min-w-0 flex-1 items-center rounded-[10px] border border-[#e0e0dc] px-3 text-[13px] font-medium text-[#33363b]">
                        <span className="truncate">{publicUrl.replace(/^https?:\/\//, "")}</span>
                      </div>
                      <button type="button" onClick={() => void handleCopyPublicUrl()} className="flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-[#f2f2f0] px-3 text-[12.5px] font-semibold text-[#33363b] transition hover:bg-[#e8e8e4]">
                        {publishCopied ? <Check size={15} /> : <Copy size={15} />}
                        {publishCopied ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  ) : (
                    <p className="rounded-[10px] border border-dashed border-[#e0e0dc] bg-[#fafafa] px-3 py-2.5 text-[12.5px] font-medium text-[#6b7079]">
                      Publique para gerar o link público do seu projeto.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-[10px] bg-[#f7f7f5] px-3.5 py-3">
                  <div>
                    <p className="text-[12.5px] font-semibold text-[#33363b]">Quem pode ver este site</p>
                    <p className="text-[11.5px] text-[#6b7079]">Qualquer pessoa com o link</p>
                  </div>
                  <span className="rounded-full bg-[#e9f7ee] px-2.5 py-1 text-[11px] font-bold text-[#1f9d55]">
                    Público
                  </span>
                </div>

                {currentProject?.status === "publicado" && publicUrl ? (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 items-center justify-center gap-2 rounded-[11px] border border-[#e0e0dc] text-[13px] font-semibold text-[#33363b] transition hover:bg-[#f7f7f5]"
                  >
                    <Link2 size={16} />
                    Abrir site publicado
                  </a>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#ececea] px-5 py-4">
                <button type="button" onClick={() => setPublishOpen(false)} className="h-10 rounded-[10px] px-4 text-[13px] font-semibold text-[#5f6368] transition hover:bg-[#f3f3f1]">
                  Fechar
                </button>
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => void handleConfirmPublish()}
                  className="flex h-10 items-center gap-2 rounded-[10px] bg-[#3567e9] px-5 text-[13px] font-semibold text-white transition hover:bg-[#4272ee] disabled:opacity-55"
                >
                  {publishing ? <RefreshCcw size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {currentProject?.status === "publicado" ? "Atualizar" : "Publicar agora"}
                </button>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {upgradeModalOpen ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setUpgradeModalOpen(false); }}
        >
          <section className="relative w-full max-w-[960px] overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0e0f11] text-white shadow-[0_60px_160px_rgba(0,0,0,0.6)]">
            <button type="button" onClick={() => setUpgradeModalOpen(false)} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12] hover:text-white" aria-label="Fechar">
              <X size={16} />
            </button>
            <div className="grid gap-8 p-8 md:grid-cols-2 md:gap-10 md:p-10">
              {/* LEFT */}
              <div className="flex flex-col">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <span className="h-8 w-8 rounded-full bg-gradient-to-br from-[#f6c48b] to-[#c26a3a] ring-2 ring-[#0e0f11]" />
                    <span className="h-8 w-8 rounded-full bg-gradient-to-br from-[#d6a5c9] to-[#7d4a70] ring-2 ring-[#0e0f11]" />
                    <span className="h-8 w-8 rounded-full bg-gradient-to-br from-[#8bb7f6] to-[#3a5fc2] ring-2 ring-[#0e0f11]" />
                  </div>
                  <span className="text-[13px] text-white/60 underline decoration-white/30 underline-offset-2">Confiado por 1420+ clientes</span>
                </div>
                <h2 className="text-[32px] font-bold leading-[1.1] tracking-[-0.03em]">
                  Publique sua página<br />de vendas, agora!
                </h2>

                <p className="mt-8 text-[13px] text-white/50">Acesse o verdadeiro poder da Velo</p>
                <ul className="mt-3 space-y-2">
                  {[
                    { icon: "📦", text: "Importação automática de até 50 produtos por mês pro Mercado Livre" },
                    { icon: "🤖", text: "1 página de vendas gerada por IA por mês" },
                    { icon: "🛍️", text: "Acesso completo ao catálogo validado da Velo" },
                    { icon: "🌐", text: "Subdomínio grátis (seunome.velo.store)" },
                    { icon: "🚀", text: "Comece a vender sem travar no operacional" },
                  ].map((f) => (
                    <li key={f.text} className="flex items-center gap-3 rounded-[12px] bg-white/[0.05] px-4 py-2.5 text-[13px] font-medium text-white/90">
                      <span className="text-[15px]">{f.icon}</span>
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* RIGHT */}
              <div className="flex flex-col">
                <div className="rounded-[16px] border-2 border-[#3567e9] bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#3567e9]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#3567e9]" />
                      </span>
                      <span className="text-[18px] font-bold">Velo <span className="italic font-semibold">Base</span></span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <div className="rounded-[10px] bg-white/[0.06] px-3 py-1.5">
                        <span className="text-[24px] font-bold">R$ 39,90</span>
                        <span className="ml-1 text-[12px] text-white/60">/mês</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[16px] border border-[#f5b40033] bg-gradient-to-br from-[#3a2a05] to-[#1a1204] p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-[18px]">🎁</span>
                    <div>
                      <p className="text-[14px] font-bold">Subdomínio GRÁTIS com o plano Base!</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-white/60">Lance sua marca hoje com um subdomínio seunome.velo.store — incluído com Velo Base!</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex-1 rounded-[16px] bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-0.5 text-[#ffb92b]">
                      {"★★★★★".split("").map((s, i) => <span key={i}>{s}</span>)}
                    </div>
                    <span className="text-[11px] text-white/40">3 dias atrás</span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/80">
                    "Honestamente, fiquei chocado. Colei o link de um produto no AliExpress e em minutos, construiu uma loja inteira. Todas as páginas, toda a cópia!"
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => { setUpgradeModalOpen(false); upgradeModal.open({ defaultPlan: "base" }); }}
                  className="mt-4 flex h-14 items-center justify-center gap-2 rounded-[14px] bg-[#3567e9] text-[16px] font-bold text-white shadow-[0_16px_40px_rgba(53,103,233,0.45)] transition hover:bg-[#4272ee] active:scale-[0.99]"
                >
                  Continuar com Base <ArrowRight size={18} />
                </button>
                <p className="mt-2 text-center text-[11px] text-white/40">Cancele a qualquer momento • Suporte 24/7</p>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
};

export default GeneratedStoreEditorPage;
