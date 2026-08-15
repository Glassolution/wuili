import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnimatePresence, motion } from "framer-motion";
import { AlignCenter, AlignLeft, AlignRight, ArrowRight, Baby, BookOpen, Boxes, Car, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Command, Copy, Download, Dumbbell, Eye, ExternalLink, Facebook, FileUp, FolderPlus, Gamepad2, Gem, Gift, Globe, Hand, Headphones, Heart, HeartPulse, HelpCircle, Home, ImageIcon, Instagram, Laptop, Layers3, LayoutGrid, Leaf, Link2, List, Loader2, LockKeyhole, Menu, MessageSquare, Minus, Monitor, MousePointer2, Package, Palette, PawPrint, Pencil, Phone, Plus, Quote, RectangleHorizontal, Redo2, RefreshCcw, Save, Search, Settings, Share2, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Square, Star, Tag, Trash2, Truck, Twitter, Type, Undo2, UserRound, X, Youtube, type LucideIcon } from "lucide-react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ExampleProduct } from "@/types/onboarding";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/usePlan";
import { aiDescriptionForProduct } from "@/lib/aiPageGeneration";
import { claimProjectInvites, createUserProject, getProjectProductIds, parseVariantOptions, publishProject, saveProjectDraft, type ProductVariantOption, type UserProject } from "@/lib/userProjects";
import ProjectSettingsOverlay, { type SettingsSection } from "@/components/editor/ProjectSettingsOverlay";
import {
  PanelActionButton,
  PanelColorControl,
  PanelControlRow,
  PanelEmptyState,
  PanelGroupLabel,
  PanelIconButton,
  PanelNotice,
  PanelOptionGrid,
  PanelRowButton,
  PanelSegmented,
  PanelSelectionHeader,
  PanelStepper,
} from "@/components/editor/EditorPanel";
import StoreAdminModal from "@/components/editor/StoreAdminModal";
import { getSavedStoreFlow, markStoreFlowCompleted } from "@/lib/storeFlowCompletion";
import { normalizePriceText } from "@/lib/priceFormat";
import { addProductToCollection, createCollection, ensureExampleCollectionProducts, getCollectionProductIds, listCollections } from "@/lib/collectionsApi";
import { formatReviewCount, getProductCatalogMetrics } from "@/components/dashboard/ProductCard";
import StorefrontNavbar from "@/components/storefront/StorefrontNavbar";
import { AI_DESCRIPTION_PLACEHOLDER, CURRENT_PRODUCT_TEMPLATE_ID, resolveProductTemplate } from "@/components/store-templates/productTemplateRegistry";
import { salesPageTemplates } from "@/lib/salesPageTemplates";
import { VeloLogo } from "@/components/VeloLogo";
import StorefrontLojaTemplate2 from "@/components/store-templates/StorefrontLojaTemplate2";

type FlowState = { product: ExampleProduct; language: string; persona: string; salesAngle: string };
type CatalogItem = ExampleProduct & { category: string; imageUrls?: string[]; variants?: ProductVariantOption[]; originalPrice?: number | null; rating?: number; averageRating?: number; ratingCount?: string | number; reviewCount?: string | number; reviewsCount?: string | number };
type EditorPanelTab = "detalhes" | "personalizar";
type EditorPanelSection = "template" | "produtos" | "imagem" | "aparencia";
type ContextDrawerMode = "template" | "products";

type TemplateRef = { kind: "loja" | "produto"; id: string };

const LOJA_TEMPLATE: TemplateRef = { kind: "loja", id: "loja-1" };
const PRODUTO_TEMPLATE: TemplateRef = { kind: "produto", id: CURRENT_PRODUCT_TEMPLATE_ID };

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
  const [mobilePreview, setMobilePreview] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
  const [selectionMarquee, setSelectionMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [pageSelected, setPageSelected] = useState(false);
  const [accent, setAccent] = useState("#111111");
  const [font, setFont] = useState("Geist");
  const [columns, setColumns] = useState(3);
  const [heroImage, setHeroImage] = useState("");
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [heroCtaUrl, setHeroCtaUrl] = useState("/catalogo");
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogItem[]>([]);
  // Catálogo inteiro, carregado só quando a gaveta de produtos abre. As
  // sugestões acima são as 24 mais vendidas (chegam junto com o editor); aqui
  // vem tudo, porque na hora de trocar um produto o lojista precisa enxergar o
  // catálogo completo, não uma amostra.
  const [catalogAll, setCatalogAll] = useState<CatalogItem[]>([]);
  const [catalogAllLoading, setCatalogAllLoading] = useState(false);
  const catalogAllLoadedRef = useRef(false);
  const [sidebarImportingId, setSidebarImportingId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("Velo");
  const [showPlans, setShowPlans] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<UserProject | null>(null);
  // Produtos escolhidos no wizard de criação (metadata.productIds do projeto).
  // Têm prioridade sobre as coleções do usuário: são o que o usuário selecionou
  // para ESTE projeto, na ordem em que escolheu.
  const [projectProducts, setProjectProducts] = useState<CatalogItem[]>([]);
  // Texto curto gerado pela IA para o produto em destaque. Vazio = ainda não
  // gerado (ou geração em andamento): o template mostra o placeholder curto.
  const [aiDescription, setAiDescription] = useState("");
  const [menuBusy, setMenuBusy] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("geral");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishCopied, setPublishCopied] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
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

    html.style.background = "#eef5ff";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.background = "#eef5ff";
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
    const id = window.setInterval(() => setHeroSlideIndex((i) => i + 1), 4200);
    return () => window.clearInterval(id);
  }, []);

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
  }, [selectedElement?.path, canvasZoom]);

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

  useEffect(() => {
    const productId = projectProducts[0]?.id;
    if (!productId) { setAiDescription(""); return; }
    let active = true;
    void aiDescriptionForProduct(productId)
      .then((text) => { if (active) setAiDescription(text); })
      .catch(() => { if (active) setAiDescription(""); });
    return () => { active = false; };
  }, [projectProducts]);

  // Mesmo critério da tela de Catálogo (is_blocked = false e estoque > 0), para
  // a gaveta mostrar exatamente o que o lojista vê lá. O PostgREST devolve no
  // máximo 1000 linhas por requisição, então paginamos até acabar.
  useEffect(() => {
    if (contextDrawer !== "products" || catalogAllLoadedRef.current) return;
    catalogAllLoadedRef.current = true;
    let active = true;
    setCatalogAllLoading(true);

    void (async () => {
      const LOTE = 1000;
      const TETO = 4000;
      const acumulado: CatalogItem[] = [];
      try {
        for (let inicio = 0; inicio < TETO; inicio += LOTE) {
          const { data, error } = await supabase
            .from("catalog_products")
            .select("id,title,suggested_price,cost_price,images,category")
            .eq("is_blocked", false)
            .gt("stock_quantity", 0)
            .order("orders_count", { ascending: false, nullsFirst: false })
            .range(inicio, inicio + LOTE - 1);
          if (error) throw error;
          const pagina = data ?? [];
          acumulado.push(
            ...pagina.flatMap((item) => {
              const imageUrls = getAllImages(item.images);
              const imageUrl = imageUrls[0] || "";
              if (!imageUrl) return [];
              return [{
                id: item.id,
                title: item.title,
                price: Number(item.suggested_price ?? 0) || Number(item.cost_price) * 5 || 0,
                imageUrl,
                imageUrls,
                category: item.category?.trim() || "Outros",
              }];
            }),
          );
          if (pagina.length < LOTE) break;
        }
        if (active) setCatalogAll(acumulado);
      } catch (error) {
        console.error("Falha ao carregar o catálogo completo:", error);
        // Deixa reabrir a gaveta e tentar de novo.
        catalogAllLoadedRef.current = false;
      } finally {
        if (active) setCatalogAllLoading(false);
      }
    })();

    return () => { active = false; };
  }, [contextDrawer]);

  // Aplica o metadata salvo do projeto no estado do editor. Usado tanto na
  // hidratação inicial quanto na sincronização em tempo real (quando um
  // colaborador edita, reaplicamos o metadata recebido para refletir no canvas).
  const applyProjectMetadata = useCallback((project: UserProject) => {
    const metadata = project.metadata;
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
      : project.nome?.trim();
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
  }, []);

  // Hidrata template e nome a partir do projeto salvo (uma vez por projeto),
  // para renderizar exatamente o template que o usuário escolheu na criação/edição.
  const hydratedProjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentProject?.id || hydratedProjectRef.current === currentProject.id) return;
    hydratedProjectRef.current = currentProject.id;

    applyProjectMetadata(currentProject);

    // Libera o canvas só depois de aplicar o template salvo.
    setHydratedProjectId(currentProject.id);
  }, [currentProject, applyProjectMetadata]);

  useEffect(() => {
    if (!user?.id) return;
    void claimProjectInvites().catch(() => { /* usuário sem convites ou sem plano pago */ });
  }, [user?.id]);

  const autosaveReadyRef = useRef(false);
  // Quando reaplicamos uma edição recebida de um colaborador, os setters mudam o
  // estado e disparariam este autosave — o que reenviaria a mesma alteração e
  // criaria um eco infinito entre as duas telas. Este flag pula exatamente o
  // autosave provocado por essa reaplicação remota.
  const skipNextAutosaveRef = useRef(false);
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!autosaveReadyRef.current) {
      autosaveReadyRef.current = true;
      return;
    }
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    const timeout = window.setTimeout(() => {
      void saveProjectDraft(currentProject.id, {
        storeName,
        template: activeTemplate.id,
        // A loja publicada não consegue ler ai_product_pages (RLS é do dono),
        // então a descrição gerada viaja junto do projeto.
        ...(aiDescription ? { aiDescription } : {}),
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
  }, [currentProject?.id, storeName, activeTemplate, accent, font, columns, heroImage, logoImage, heroCtaUrl, copyVariant, elementOverrides, editedPrice, aiDescription]);

  // Sincronização em tempo real dentro do editor: reflete no canvas as edições
  // feitas por um colaborador (ou pelo dono em outra aba) no mesmo projeto.
  // Ecos das próprias gravações são ignorados via metadata.lastEditedBy.
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-editor:${projectId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_projects", filter: `id=eq.${projectId}` },
        (payload) => {
          const incoming = payload.new as UserProject;
          const meta = incoming.metadata && typeof incoming.metadata === "object" && !Array.isArray(incoming.metadata)
            ? (incoming.metadata as Record<string, unknown>)
            : {};
          // Ignora o eco da própria gravação — só aplica edições de outra pessoa.
          if (meta.lastEditedBy && meta.lastEditedBy === user?.id) return;

          skipNextAutosaveRef.current = true;
          applyProjectMetadata(incoming);
          setCurrentProject((prev) => (prev && prev.id === incoming.id ? incoming : prev));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, user?.id, applyProjectMetadata]);

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

  // URL pública fica no domínio Velo com o slug da loja no caminho:
  // Ex.: https://velods.com.br/loja/pedra
  const publicUrl = projectSlug
    ? `https://velods.com.br/loja/${projectSlug}`
    : "";


  // Ordem das telas definida pelo dono da loja em Administração > Fluxo do cliente.
  // O canvas principal é sempre a Home; as demais telas do fluxo aparecem lado a lado
  // seguindo essa sequência (ex.: se o usuário mover "Login" antes do "Carrinho",
  // o iframe de login vai aparecer antes do carrinho).
  const customerFlow = useMemo<string[]>(() => {
    const m = currentProject?.metadata;
    if (m && typeof m === "object" && !Array.isArray(m)) {
      const flow = (m as Record<string, unknown>).customerFlow;
      if (Array.isArray(flow)) return flow.filter((v): v is string => typeof v === "string");
    }
    return ["home", "catalogo", "produto", "carrinho", "checkout", "obrigado"];
  }, [currentProject]);

  const handleOpenPublish = () => {
    if (isFreePlan) {
      upgradeModal.open({ defaultPlan: "base" });
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
      upgradeModal.open({ defaultPlan: "base" });
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
    setHeroImage("");
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
  const heroSlides = (() => {
    const productImgs = displayedProducts.map((p) => p.imageUrl).filter((u): u is string => !!u);
    const custom = heroImage && !heroImage.startsWith("/hero-pasted-image") ? [heroImage] : [];
    const combined = [...custom, ...productImgs];
    return combined.length ? combined.slice(0, 4) : [""];
  })();
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
      { id: "loja-1", name: "Template 1", desc: "Loja completa AERO-STEP (creme e verde musgo).", image: "/template-01-loja-preview.png" },
      { id: "loja-2", name: "Template 2", desc: "Marketly · e-commerce azul mobile-first.", image: "/template-01-loja-preview.png" },
    ],
    // Um template de produto só. Ele vem da galeria (salesPageTemplates), que
    // por sua vez lê o registro — assim editor, galeria e página publicada nunca
    // divergem sobre quais templates existem.
    produto: salesPageTemplates.map((template) => ({
      id: template.editorTemplateId,
      name: template.name,
      desc: template.description,
      image: template.preview,
    })),
  };
  // Template de produto vem do registro compartilhado com a página publicada:
  // registrar em um lugar só evita o editor mostrar um template e a loja
  // publicada renderizar outro.
  const { Component: ActiveProductTemplate, descFallback: activeProductDescFallback } =
    resolveProductTemplate(activeTemplate.id);
  // Descrição que vai para o bloco de compra: só o texto curto escrito pela IA.
  //
  // Duas coisas que NÃO entram aqui, por já terem quebrado a página antes:
  // `flow.salesAngle` é o ângulo de copy do wizard ("Benefício principal") —
  // rótulo de configuração, não texto de venda; e catalog_products.description é
  // a ficha técnica raspada do fornecedor, que vira um parágrafo corrido enorme
  // e empurra o CTA para fora da altura da imagem.
  const productDescriptionForTemplate = aiDescription || AI_DESCRIPTION_PLACEHOLDER;

  // "Você também pode gostar": os outros produtos do próprio projeto, nunca o
  // que já está em destaque. Sem outros produtos, o template esconde a seção.
  const relatedProductsForTemplate = displayedProducts
    .filter((product) => product.id !== featuredProduct?.id)
    .map((product) => ({
      id: product.id,
      title: product.title,
      price: product.price,
      originalPrice: product.originalPrice ?? null,
      imageUrl: product.imageUrl,
    }));
  const selectedFontStack = fontOptions.find((option) => option.name === font)?.stack || fontOptions[0].stack;
  // Projeto salvo num template que não existe mais abre no atual — o rótulo da
  // barra lateral tem que acompanhar, em vez de cair no primeiro da lista de loja.
  const activeTemplateOption =
    templateOptions[activeTemplate.kind].find((template) => template.id === activeTemplate.id) ??
    templateOptions[activeTemplate.kind][0] ??
    templateOptions.loja[0];
  const drawerTemplates = templateOptions[templateCategory];
  const sidebarProducts = displayedProducts;
  const selectedStoreProductIds = new Set(sidebarProducts.map((product) => product.id));
  // Enquanto o catálogo completo não chega, a gaveta já mostra as sugestões —
  // assim ela nunca abre vazia.
  const catalogForDrawer = catalogAll.length > 0 ? catalogAll : catalogSuggestions;
  const replacementProducts = [...catalogForDrawer, ...displayedProducts].filter(
    (product, index, collection) => collection.findIndex((item) => item.id === product.id) === index,
  );
  const drawerProducts = replacingProductPath
    ? replacementProducts
    : catalogForDrawer.filter((product) => !selectedStoreProductIds.has(product.id));
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
  const editorMainCanvasWidth = mobilePreview ? 390 : "calc(100vw - 282px)";
  const editorCartPreviewWidth = mobilePreview ? 390 : 720;
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

  // Rótulo e ícone do bloco selecionado, para o cabeçalho do painel dizer o que
  // está sendo editado (o `label` do elemento já vem da varredura do canvas).
  const selectedBlockTitle = !selectedElement
    ? ""
    : isSelectedButton
      ? "Botão"
      : selectedElement.type === "text"
        ? "Texto"
        : selectedElement.type === "image"
          ? isSelectedProductImage
            ? "Imagem do produto"
            : selectedMediaKind === "logo"
              ? "Logo"
              : "Imagem"
          : selectedElement.type === "icon"
            ? "Ícone"
            : selectedElement.label || "Seção";
  const selectedBlockIcon: LucideIcon = !selectedElement
    ? LayoutGrid
    : isSelectedButton
      ? RectangleHorizontal
      : selectedElement.type === "text"
        ? Type
        : selectedElement.type === "image"
          ? ImageIcon
          : selectedElement.type === "icon"
            ? Sparkles
            : LayoutGrid;
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
    const resetZoom = mobilePreview ? 0.88 : 0.52;
    canvasZoomRef.current = resetZoom;
    setCanvasZoom(resetZoom);
  };
  const changeCanvasZoom = (delta: number) => {
    const currentZoom = canvasZoomRef.current;
    const nextZoom = Math.max(0.28, Math.min(1.2, Number((currentZoom + delta).toFixed(2))));
    if (nextZoom === currentZoom) return;
    const workspace = workspaceRef.current;
    if (workspace) {
      workspace.scrollLeft = 0;
      workspace.scrollTop = 0;
    }
    canvasZoomRef.current = nextZoom;
    setCanvasZoom(nextZoom);
  };
  nativePinchZoomRef.current = (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest("[data-canvas-ui]")) return;
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
    <main className="relative flex h-screen flex-col overflow-hidden bg-[#eef5ff] text-[#111827]" style={{ fontFamily: selectedFontStack }}>
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
        className="velo-editor-enter pointer-events-none fixed inset-0 z-[999] bg-[#eef5ff] [animation:veloEditorEnter_620ms_ease-out_forwards]"
      />
      <style>{`.store-editor-preview [data-editor-selected="true"]{outline:2px solid #2563eb;outline-offset:3px}.store-editor-preview [data-editor-hover-bg="true"]:hover{background-color:var(--editor-hover-bg)!important}.editor-mode-active [data-editor-type]:hover,.editor-mode-active button:hover,.editor-mode-active [data-editor-role="button"]:hover{outline:1.5px dashed #2563eb;outline-offset:2px;cursor:pointer}.editor-mode-active [data-editor-ignore],.editor-mode-active [data-editor-ignore] *{outline:none!important;cursor:default}.editor-sidebar-scroll{scrollbar-width:thin;scrollbar-color:#cbd5e1 transparent}.editor-sidebar-scroll::-webkit-scrollbar{width:5px}.editor-sidebar-scroll::-webkit-scrollbar-track{background:transparent}.editor-sidebar-scroll::-webkit-scrollbar-thumb{border-radius:999px;background:#cbd5e1}.editor-sidebar-scroll::-webkit-scrollbar-thumb:hover{background:#94a3b8}.editor-context-drawer{animation:editorDrawerIn 200ms ease both}@keyframes editorDrawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
      <header data-canvas-ui className="pointer-events-none absolute inset-x-0 top-0 z-[70] grid h-[72px] grid-cols-[1fr_auto_1fr] items-center border-b border-[#cfe0f5] bg-[#eef6ff] px-5 text-[#111827] shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="pointer-events-auto relative flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => navigate("/dashboard/paginas-com-ia")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-[#d8e2f0] bg-white text-[#1f2937] shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition hover:border-[#c6d3e4] hover:bg-[#f8fbff]" aria-label="Voltar para páginas com IA">
            <ChevronLeft size={17} strokeWidth={2} />
          </button>
          <div className="flex shrink-0 items-center">
            <VeloLogo size="md" variant="dark" />
          </div>
          {renderProjectMenu()}
        </div>

        <div className="pointer-events-auto hidden min-w-0 items-center justify-center gap-1 rounded-[12px] bg-white p-1 shadow-[0_5px_16px_rgba(15,23,42,0.10)] ring-1 ring-[#d9e4f5] lg:flex">
          <button type="button" onClick={() => setEditMode("edit")} className="flex h-7 items-center gap-1.5 rounded-[9px] border border-[#b9d2ff] bg-white px-2.5 text-[12px] font-bold tracking-[-0.02em] text-[#2457d6] shadow-[0_1px_5px_rgba(37,99,235,0.12)] transition hover:bg-[#f7faff]" aria-label="Editar produto">
            <Tag size={15} strokeWidth={2} /> Edit Product
          </button>
          <button type="button" onClick={() => { setMobilePreview(false); canvasZoomRef.current = 0.52; setCanvasZoom(0.52); }} className={`grid h-8 w-10 place-items-center rounded-[9px] transition ${!mobilePreview ? "bg-white text-[#111827] shadow-[0_3px_9px_rgba(15,23,42,0.14)] ring-1 ring-[#e6ebf3]" : "text-[#717b8d] hover:text-[#334155]"}`} aria-label="Preview desktop">
            <Monitor size={17} strokeWidth={2} />
          </button>
          <button type="button" onClick={() => { setMobilePreview(true); canvasZoomRef.current = 0.88; setCanvasZoom(0.88); }} className={`grid h-8 w-9 place-items-center rounded-[9px] transition ${mobilePreview ? "bg-white text-[#111827] shadow-[0_3px_9px_rgba(15,23,42,0.14)] ring-1 ring-[#e6ebf3]" : "text-[#717b8d] hover:text-[#334155]"}`} aria-label="Preview mobile">
            <Smartphone size={15} strokeWidth={2} />
          </button>
          <button type="button" onClick={resetCanvasView} className="grid h-8 w-9 place-items-center rounded-[9px] text-[#717b8d] transition hover:bg-white hover:text-[#334155] hover:shadow-[0_3px_9px_rgba(15,23,42,0.12)]" aria-label="Ajustar tela">
            <RectangleHorizontal size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center justify-end">
          <div className="flex items-center gap-2 rounded-[12px] bg-white p-1 shadow-[0_5px_16px_rgba(15,23,42,0.10)] ring-1 ring-[#d9e4f5]">
          <button type="button" className="hidden h-8 items-center gap-1.5 rounded-[8px] border border-[#c8ccd4] bg-[#969ba5] px-3 text-[12px] font-bold tracking-[-0.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_2px_7px_rgba(15,23,42,0.18)] transition hover:bg-[#8a909b] sm:flex" aria-label="Salvar projeto">
            <Save size={15} strokeWidth={2.05} /> Save
          </button>
          <button type="button" onClick={handleOpenPublish} className="hidden h-8 items-center justify-center gap-1.5 rounded-[8px] border border-[#087c45] bg-gradient-to-b from-[#17b86d] to-[#049452] px-3.5 text-[12px] font-bold tracking-[-0.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_11px_rgba(4,148,82,0.24)] transition duration-200 hover:from-[#19c476] hover:to-[#058949] active:scale-[0.98] md:flex">
            <ShoppingBag size={15} strokeWidth={2.05} />
            Publish
          </button>
          <button type="button" onClick={() => setProjectMenuOpen((open) => !open)} className="flex h-8 items-center gap-2 rounded-[8px] border border-[#dfe5ef] bg-white px-3.5 text-[12px] font-bold tracking-[-0.01em] text-[#111827] shadow-[0_2px_8px_rgba(15,23,42,0.08)] transition hover:bg-[#f8fbff]" aria-label="Menu do projeto" aria-haspopup="menu" aria-expanded={projectMenuOpen}>
            <Menu size={16} strokeWidth={2.1} />
            Menu
          </button>
          </div>
        </div>
      </header>

      <div
        ref={workspaceRef}
        className={`relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-white text-[#111827] touch-pan-y ${selectionMarquee ? "cursor-crosshair" : "cursor-default"}`}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={finishCanvasDrag}
        onPointerCancel={finishCanvasDrag}
        onScroll={(event) => {
          event.currentTarget.scrollLeft = 0;
        }}
        onClick={handleWorkspaceClick}
        onDoubleClick={(event) => {
          const target = event.target;
          if (!(target instanceof Element) || !target.closest("[data-canvas-ui], .store-editor-preview")) resetCanvasView();
        }}
        style={{
          backgroundImage: "none",
          backgroundPosition: "0px 0px",
          backgroundSize: "100% 100%",
        }}
        aria-label="Área de trabalho do editor"
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
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[72px] z-10 hidden h-7 items-start justify-around px-[340px] pt-1 text-[8px] font-medium text-[#94a3b8]/70">
          {[-3200, -2800, -2400, -2000, -1600, -1200, -800, -400, 0, 400].map((mark) => <span key={mark}>{mark}</span>)}
        </div>

        <aside data-canvas-ui data-sidebar-state={sidebarCollapsed ? "recolhido" : "aberto"} className="hidden">
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
                {/* Administração da loja: clientes, produtos próprios e reordenação
                    do fluxo (login antes/depois do checkout etc.). */}
                <button type="button" onClick={() => setAdminOpen(true)} className="group flex h-8 w-full items-center gap-2 rounded-[9px] px-2 text-left text-[9px] font-medium text-white/66 outline-none transition hover:bg-white/[0.06] hover:text-white">
                  <LockKeyhole size={13} strokeWidth={1.8} />
                  <span className="flex-1">Administração</span>
                  <ChevronRight size={12} className="transition group-hover:translate-x-0.5" />
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
          className="relative z-20 min-h-full pt-[72px]"
          style={{ width: mobilePreview ? "calc(100vw - 282px)" : editorMainCanvasWidth }}
        >
          {/* `overflow-clip` (e não `hidden`): recorta igual, mas não vira
              contexto de rolagem — com `hidden`, o sticky da galeria dentro do
              template nunca gruda no canvas do editor. */}
          <div ref={previewRef} onClickCapture={handlePreviewClick} onDoubleClickCapture={handlePreviewDoubleClick} className={`store-editor-preview relative min-h-[calc(100vh-72px)] overflow-clip bg-white text-[#111] transition-[width] duration-300 ${pageSelected ? "ring-2 ring-[#2563eb] ring-inset" : ""} ${editMode && canvasToolbarMode !== "pan"?"editor-mode-active":""}`} style={{ width: mobilePreview ? editorMainCanvasWidth : "100%", margin: mobilePreview ? "0 auto" : 0, fontFamily: selectedFontStack, cursor: canvasToolbarMode === "appearance" ? "copy" : canvasToolbarMode === "edit" ? "text" : "default" }}>
            {!templateReady ? (
              <div className="grid h-[720px] w-full place-items-center bg-white">
                <Loader2 size={22} className="animate-spin text-black/25" />
              </div>
            ) : activeTemplate.kind === "produto" ? (
              <ActiveProductTemplate
                brand={brandName}
                title={featuredProduct?.title || storeName}
                description={productDescriptionForTemplate}
                price={featuredPrice}
                originalPrice={featuredProduct?.originalPrice ?? null}
                variants={featuredProduct?.variants ?? []}
                image={featuredProduct?.imageUrl || heroImage}
                images={featuredProduct?.imageUrls}
                productId={featuredProduct?.id}
                accent={accent}
                mobile={mobilePreview}
                relatedProducts={relatedProductsForTemplate}
              />
            ) : activeTemplate.id === "loja-2" ? (
              <StorefrontLojaTemplate2
                storeName={brandName}
                heroImage={heroImage}
                logoImage={logoImage}
                salesAngle={flow.salesAngle}
                heroCtaUrl={heroCtaUrl}
                products={displayedProducts.map((p) => ({
                  id: p.id,
                  title: p.title,
                  price: p.price,
                  imageUrl: p.imageUrl,
                  category: p.category,
                  originalPrice: p.originalPrice ?? null,
                }))}
                mobile={mobilePreview}
                projectId={currentProject?.id}
              />
            ) : (
            <>
            {/* === TEMPLATE 01 - C-STYLE INSPIRED === */}
            {/* Main header */}
            {/* ============ TEMPLATE 01 · AERO-STEP STYLE ============ */}
            <div className="bg-[#f5f2ea] text-[#1a1a1a]" style={{fontFamily:selectedFontStack}}>

            {/* NAVBAR */}
            <header data-editor-type="other" data-editor-section="navbar" data-editor-label="Barra de navegação" className="relative z-30 flex items-center justify-between gap-6 px-10 py-5">
              <a href="#" className="flex items-center gap-2.5">
                {logoImage ? <img data-editor-type="image" data-editor-media-kind="logo" src={logoImage} alt={brandName} className="h-8 w-8 rounded-full object-cover"/> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3d4a2a] text-[11px] font-semibold text-[#f5f2ea]">{brandName.slice(0,1).toUpperCase()}</span>}
                <span data-editor-type="text" className="text-[15px] font-semibold tracking-[-0.01em] uppercase">{brandName}</span>
              </a>
              <nav className="hidden items-center gap-8 md:flex">
                {["Catálogo","Novidades","Ofertas","Sobre","Contato"].map((label)=>(
                  <a key={label} data-editor-type="text" href="#" className="text-[13px] font-medium text-[#1a1a1a]/75 transition hover:text-[#3d4a2a]">{label}</a>
                ))}
              </nav>
              <div className="flex items-center gap-3">
                <a href="#entrar" className="inline-flex items-center gap-2 rounded-full border border-[#1a1a1a]/12 bg-white px-4 py-2 text-[12px] font-semibold text-[#1a1a1a] transition hover:border-[#3d4a2a]/40"><UserRound size={14} strokeWidth={2}/>Entrar</a>
                <a href="#carrinho" className="inline-flex items-center gap-2 rounded-full bg-[#3d4a2a] px-4 py-2 text-[12px] font-semibold text-[#f5f2ea] transition hover:bg-[#2c3620]"><ShoppingBag size={14} strokeWidth={2}/>Carrinho<span className="ml-0.5 rounded-full bg-[#c8a24a] px-1.5 text-[10px] font-bold text-[#3d4a2a]">0</span></a>
              </div>
            </header>

            {/* HERO */}
            <section data-editor-type="other" data-editor-section="hero" data-editor-label="Seção hero" className="px-10 pb-10">
              <div className="relative overflow-hidden rounded-[28px] bg-[#e9e5d8]">
                <div className={`grid ${mobilePreview?"grid-cols-1":"grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"} items-stretch`}>
                  <div className="relative z-10 flex flex-col justify-between p-10 md:p-14">
                    <div>
                      <span data-editor-type="text" className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#3d4a2a]">Prêmium coleção</span>
                      <h1 data-editor-type="text" className="mt-6 font-semibold uppercase leading-[0.98] tracking-[-0.02em] text-[#1a1a1a]" style={{fontSize:"clamp(34px,4.2vw,68px)"}}>
                        {headlinePrimary}<br/>{headlineSecondary}
                      </h1>
                      <p data-editor-type="text" className="mt-6 max-w-[380px] text-[13px] leading-relaxed text-[#1a1a1a]/60">{heroSubtitle}</p>
                    </div>
                    <div className="mt-10 flex flex-wrap items-center gap-3">
                      <a data-editor-role="button" href={heroCtaHref} className="group inline-flex items-center gap-3 rounded-full bg-[#3d4a2a] py-2 pl-6 pr-2 text-[13px] font-semibold text-[#f5f2ea] transition hover:bg-[#2c3620]">
                        <span data-editor-type="text">{ctaPrimary || "Ver catálogo"}</span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c8a24a] text-[#3d4a2a] transition group-hover:translate-x-0.5"><ArrowRight size={15} strokeWidth={2.4}/></span>
                      </a>
                      <a href="#novidades" className="inline-flex items-center rounded-full border border-[#1a1a1a]/12 bg-white/60 px-6 py-3 text-[13px] font-semibold text-[#1a1a1a] transition hover:border-[#3d4a2a]/40">Novidades</a>
                    </div>
                    <div className="mt-10 flex items-center gap-4">
                      <div className="flex -space-x-2">
                        {displayedProducts.slice(0,3).map((p)=>(
                          <img key={`av-${p.id}`} src={p.imageUrl||heroImage} alt="" className="h-9 w-9 rounded-full border-2 border-[#e9e5d8] object-cover"/>
                        ))}
                      </div>
                      <div className="text-[11px] leading-tight text-[#1a1a1a]/70">
                        <strong className="block text-[13px] font-semibold text-[#1a1a1a]">10.000+ clientes</strong>
                        <span className="flex items-center gap-1"><Star size={11} strokeWidth={2} className="fill-[#c8a24a] text-[#c8a24a]"/> 4.9 · avaliação média</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative min-h-[420px] overflow-hidden bg-[#e9e5d8]">
                    {/* decorative backdrop shapes */}
                    <div className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-white/60 via-[#d9d3c1]/50 to-transparent blur-2xl" />
                    <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-[#c8a24a]/15 blur-3xl" />
                    <div className="pointer-events-none absolute inset-x-10 bottom-10 h-40 rounded-[50%] bg-[#1a1a1a]/10 blur-2xl" />
                    {heroSlides.map((src, idx) => {
                      const active = idx === heroSlideIndex % heroSlides.length;
                      return (
                        <img
                          key={`${src}-${idx}`}
                          data-editor-type={idx === 0 ? "image" : undefined}
                          data-editor-media-kind={idx === 0 ? "banner" : undefined}
                          data-editor-id={idx === 0 ? "hero-image" : undefined}
                          src={src || undefined}
                          alt=""
                          style={{ mixBlendMode: "multiply" }}
                          className={`absolute inset-0 h-full w-full object-contain p-10 transition-opacity duration-700 ${active ? "opacity-100" : "opacity-0"}`}
                        />
                      );
                    })}
                    <div className="absolute inset-y-6 right-6 flex w-[210px] flex-col gap-3">
                      {[{icon:Truck,title:"Frete grátis",desc:"A partir de R$ 199"},{icon:Package,title:"Prove antes de pagar",desc:"7 dias para trocar"},{icon:LockKeyhole,title:"Produtos originais",desc:"Garantia de qualidade"}].map(({icon:Icon,title,desc})=>(
                        <div key={title} className="flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-[0_10px_30px_rgba(26,26,26,0.08)] backdrop-blur">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e9e5d8] text-[#3d4a2a]"><Icon data-editor-type="icon" size={16} strokeWidth={1.9}/></span>
                          <div className="min-w-0">
                            <strong data-editor-type="text" className="block text-[11.5px] font-semibold text-[#1a1a1a]">{title}</strong>
                            <span data-editor-type="text" className="block truncate text-[10px] text-[#1a1a1a]/55">{desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {heroSlides.length > 1 && (
                      <div className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-2">
                        {heroSlides.map((_, idx) => {
                          const active = idx === heroSlideIndex % heroSlides.length;
                          return (
                            <button
                              key={`hero-dot-${idx}`}
                              type="button"
                              onClick={(e) => { e.preventDefault(); setHeroSlideIndex(idx); }}
                              aria-label={`Slide ${idx + 1}`}
                              className={`h-1.5 rounded-full transition-all ${active ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
            {renderCustomSectionsAfter("hero")}

            {/* SEARCH + CATEGORY CHIPS */}
            <section data-editor-type="other" data-editor-section="categories" data-editor-label="Busca e categorias" className="px-10 pb-10">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex flex-1 items-center gap-3 rounded-full bg-white px-5 py-3 shadow-[0_6px_18px_rgba(26,26,26,0.05)]">
                  <Search size={16} strokeWidth={2} className="shrink-0 text-[#1a1a1a]/50"/>
                  <input placeholder="Buscar por produto, categoria ou marca..." className="flex-1 border-none bg-transparent text-[13px] text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/45"/>
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3d4a2a] text-[#f5f2ea]"><ArrowRight size={14} strokeWidth={2.2}/></button>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {browseCategories.slice(0,5).map(({category})=>(
                    <a key={category} href="#" className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-medium text-[#1a1a1a] transition hover:bg-[#e9e5d8]">
                      <span data-editor-type="text">{category}</span>
                    </a>
                  ))}
                  <a href="#" className="inline-flex items-center gap-1.5 rounded-full bg-[#3d4a2a] px-4 py-2 text-[12px] font-semibold text-[#f5f2ea]"><LayoutGrid size={13} strokeWidth={2}/>Todas</a>
                </div>
              </div>
            </section>
            {renderCustomSectionsAfter("categories")}

            {/* HITS DE VENDA */}
            <section data-editor-type="other" data-editor-section="body" data-editor-label="Produtos em destaque" className="px-10 pb-14">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <h2 data-editor-type="text" className="text-[24px] font-semibold uppercase tracking-[-0.01em] text-[#1a1a1a]">Hits de venda</h2>
                  <p data-editor-type="text" className="mt-1 text-[12px] text-[#1a1a1a]/55">Os produtos mais desejados da loja neste mês.</p>
                </div>
                <a href="#produtos" className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#3d4a2a] transition hover:gap-3">Ver todos <ArrowRight size={13} strokeWidth={2}/></a>
              </div>
              <div id="produtos" className={`grid gap-4 ${mobilePreview?"grid-cols-2":"grid-cols-2 md:grid-cols-3 lg:grid-cols-5"}`}>
                {displayedProducts.slice(0,5).map((product,idx)=>{
                  const originalPrice = Math.max(product.price*1.3, product.price+30);
                  const discountPct = Math.round((1 - product.price/originalPrice)*100);
                  const explicitRating = product.rating ?? product.averageRating;
                  const mockMetrics = getProductCatalogMetrics({ id: product.id, rating: explicitRating ?? null, ordersCount: null, reviewsCount: null });
                  const rating = typeof explicitRating === "number" ? explicitRating : mockMetrics.rating;
                  const orders = product.ratingCount ?? product.reviewCount ?? mockMetrics.ordersCount;
                  return (
                    <article key={product.id} className="group flex flex-col overflow-hidden rounded-[20px] bg-white p-3 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(26,26,26,0.08)]">
                      <div className="relative aspect-square overflow-hidden rounded-[14px] bg-[#e9e5d8]">
                        {idx===0 ? <span className="absolute left-3 top-3 z-10 rounded-full bg-[#c8a24a] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#3d4a2a]">Novidade</span> : idx===3 ? <span className="absolute left-3 top-3 z-10 rounded-full bg-[#3d4a2a] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#f5f2ea]">-{discountPct}%</span> : null}
                        <button type="button" aria-label="Favoritar" className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#1a1a1a]/70 shadow-sm transition hover:text-[#3d4a2a]"><Heart data-editor-type="icon" size={14} strokeWidth={1.9}/></button>
                        <img data-editor-type="image" data-editor-product="true" data-editor-product-id={product.id} src={product.imageUrl||heroImage} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>
                      </div>
                      <div className="mt-3 flex flex-1 flex-col px-1 pb-1">
                        <h3 data-editor-type="text" className="line-clamp-2 min-h-[36px] text-[13px] font-semibold leading-snug text-[#1a1a1a]">{product.title}</h3>
                        {(rating !== null || orders) && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[#1a1a1a]/60">
                            {rating !== null && (
                              <>
                                <Star size={11} strokeWidth={2} className="fill-[#c8a24a] text-[#c8a24a]"/>
                                <span data-editor-type="text">{rating.toFixed(1)}</span>
                              </>
                            )}
                            {rating !== null && orders ? <span className="text-[#1a1a1a]/35">·</span> : null}
                            {orders ? (
                              <span className="text-[#1a1a1a]/35">{formatReviewCount(Number(orders) || 0)} vendas</span>
                            ) : null}
                          </div>
                        )}
                        <div className="mt-3 flex items-end justify-between gap-2">
                          <div>
                            <strong className="block text-[15px] font-semibold text-[#1a1a1a]">{formatBRL(product.price)}</strong>
                            {idx===3 ? <span className="text-[10px] text-[#1a1a1a]/40 line-through">{formatBRL(originalPrice)}</span> : null}
                          </div>
                          <button type="button" aria-label="Adicionar ao carrinho" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3d4a2a] text-[#f5f2ea] shadow-sm transition hover:bg-[#2c3620]"><Plus data-editor-type="icon" size={14} strokeWidth={2.4}/></button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
            {renderCustomSectionsAfter("body")}

            {/* LIFESTYLE CARDS 2x1 */}
            <section data-editor-type="other" data-editor-section="promotions" data-editor-label="Cards de coleção" className="grid grid-cols-1 gap-4 px-10 pb-4 md:grid-cols-2">
              {categoryHighlights.slice(0,2).map(({category,imageUrl,key})=>(
                <a key={key} href={`/catalogo?categoria=${encodeURIComponent(category)}`} className="group relative flex min-h-[240px] overflow-hidden rounded-[24px] bg-[#e9e5d8]">
                  <div className="relative z-10 flex flex-1 flex-col justify-between p-8">
                    <div>
                      <strong data-editor-type="text" className="block text-[24px] font-semibold uppercase leading-[1.02] tracking-[-0.01em] text-[#1a1a1a]">{category}</strong>
                      <p data-editor-type="text" className="mt-2 max-w-[180px] text-[12px] text-[#1a1a1a]/60">{collectionDescriptions[category]||"Peças selecionadas para você."}</p>
                    </div>
                    <span className="mt-6 inline-flex w-fit items-center gap-2 text-[12px] font-semibold text-[#3d4a2a] transition group-hover:gap-3">Explorar <ArrowRight size={13} strokeWidth={2}/></span>
                  </div>
                  <div className="relative w-[46%] shrink-0 overflow-hidden">
                    <img data-editor-type="image" src={imageUrl} alt={category} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"/>
                  </div>
                </a>
              ))}
            </section>

            <section data-editor-type="other" data-editor-section="collections" data-editor-label="Coleções secundárias" className="grid grid-cols-1 gap-4 px-10 pb-14 md:grid-cols-2">
              {categoryHighlights.slice(2,4).map(({category,imageUrl,key})=>(
                <a key={key} href={`/catalogo?categoria=${encodeURIComponent(category)}`} className="group relative flex min-h-[220px] overflow-hidden rounded-[24px] bg-[#e9e5d8]">
                  <div className="relative z-10 flex flex-1 flex-col justify-between p-8">
                    <div>
                      <strong data-editor-type="text" className="block text-[24px] font-semibold uppercase leading-[1.02] tracking-[-0.01em] text-[#1a1a1a]">{category}</strong>
                      <p data-editor-type="text" className="mt-2 max-w-[180px] text-[12px] text-[#1a1a1a]/60">{collectionDescriptions[category]||"Peças selecionadas para você."}</p>
                    </div>
                    <span className="mt-6 inline-flex w-fit items-center gap-2 text-[12px] font-semibold text-[#3d4a2a] transition group-hover:gap-3">Explorar <ArrowRight size={13} strokeWidth={2}/></span>
                  </div>
                  <div className="relative w-[46%] shrink-0 overflow-hidden">
                    <img data-editor-type="image" src={imageUrl} alt={category} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"/>
                  </div>
                </a>
              ))}
            </section>
            {renderCustomSectionsAfter("collections")}

            {/* TECH GRID */}
            <section data-editor-type="other" data-editor-section="tech" data-editor-label="Tecnologias / diferenciais" className="px-10 pb-14">
              <h2 data-editor-type="text" className="mb-6 text-[18px] font-semibold uppercase tracking-[-0.01em] text-[#1a1a1a]">Diferenciais da loja</h2>
              <div className={`grid gap-3 ${mobilePreview?"grid-cols-2":"grid-cols-2 md:grid-cols-3 lg:grid-cols-6"}`}>
                {[
                  {icon:Truck,title:"Entrega rápida",desc:"Em todo o Brasil"},
                  {icon:Package,title:"Troca fácil",desc:"7 dias sem custo"},
                  {icon:LockKeyhole,title:"Compra segura",desc:"Pagamento protegido"},
                  {icon:Gem,title:"Produtos originais",desc:"Curadoria garantida"},
                  {icon:Headphones,title:"Suporte 7 dias",desc:"Atendimento humano"},
                  {icon:Leaf,title:"Consumo consciente",desc:"Embalagem sustentável"},
                ].map(({icon:Icon,title,desc})=>(
                  <div key={title} className="flex flex-col items-start gap-3 rounded-[18px] bg-white p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e9e5d8] text-[#3d4a2a]"><Icon data-editor-type="icon" size={20} strokeWidth={1.8}/></span>
                    <div>
                      <strong data-editor-type="text" className="block text-[12px] font-semibold text-[#1a1a1a]">{title}</strong>
                      <span data-editor-type="text" className="mt-1 block text-[11px] text-[#1a1a1a]/55">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* CLUB CARD */}
            <section data-editor-type="other" data-editor-section="club" data-editor-label="Clube da loja" className="px-10 pb-14">
              <div className="relative flex flex-col items-stretch gap-6 overflow-hidden rounded-[28px] bg-[#3d4a2a] p-8 text-[#f5f2ea] md:flex-row md:items-center md:p-12">
                <div className="flex h-32 w-52 shrink-0 items-end justify-start overflow-hidden rounded-[18px] bg-gradient-to-br from-[#5a6a3f] to-[#3d4a2a] p-5 shadow-inner">
                  <div>
                    <strong data-editor-type="text" className="block text-[18px] font-bold uppercase leading-none tracking-tight">{brandName}</strong>
                    <span className="mt-1 block text-[11px] uppercase tracking-[0.2em] text-[#c8a24a]">Club</span>
                  </div>
                </div>
                <div className="flex-1">
                  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c8a24a]">Programa de vantagens</span>
                  <h3 data-editor-type="text" className="mt-3 text-[26px] font-semibold uppercase leading-[1.05] tracking-[-0.01em]">Entre no {brandName} Club</h3>
                  <p data-editor-type="text" className="mt-2 max-w-[520px] text-[12px] leading-relaxed text-[#f5f2ea]/70">Ofertas exclusivas, acesso antecipado a novidades, bônus personalizados e muito mais. Grátis, sem letra miúda.</p>
                </div>
                <div className="flex flex-col items-stretch gap-3 md:items-end">
                  <div className="flex flex-wrap gap-2 text-[10px] text-[#f5f2ea]/70">
                    <span className="rounded-full bg-white/8 px-3 py-1">5% cashback</span>
                    <span className="rounded-full bg-white/8 px-3 py-1">Acesso VIP</span>
                    <span className="rounded-full bg-white/8 px-3 py-1">Descontos</span>
                  </div>
                  <a href="#club" className="inline-flex items-center gap-3 rounded-full bg-[#c8a24a] py-2 pl-6 pr-2 text-[13px] font-semibold text-[#3d4a2a] transition hover:bg-[#d4b062]">Tornar-se membro <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3d4a2a] text-[#c8a24a]"><ArrowRight size={13} strokeWidth={2.4}/></span></a>
                </div>
              </div>
            </section>

            {/* TRUST STRIP */}
            <section data-editor-type="other" data-editor-section="end" data-editor-label="Garantias" className="px-10 pb-10">
              <div className="grid grid-cols-2 gap-3 rounded-[20px] bg-white p-6 md:grid-cols-4">
                {trustBadges.map(({title,description,icon: Icon})=>(
                  <div key={title} className="flex items-start gap-3">
                    <Icon data-editor-type="icon" size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[#3d4a2a]"/>
                    <div className="min-w-0">
                      <strong data-editor-type="text" className="block text-[12px] font-semibold text-[#1a1a1a]">{title}</strong>
                      <span data-editor-type="text" className="mt-0.5 block text-[10.5px] leading-tight text-[#1a1a1a]/55">{description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            {renderCustomSectionsAfter("end")}

            {/* FOOTER */}
            <footer data-editor-type="other" data-editor-section="footer" data-editor-label="Rodapé" className="border-t border-[#1a1a1a]/8 bg-[#f5f2ea] px-10 pb-10 pt-14">
              <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
                <div className="col-span-2">
                  <div className="flex items-center gap-2.5">
                    {logoImage ? <img src={logoImage} alt={brandName} className="h-9 w-9 rounded-full object-cover"/> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3d4a2a] text-[13px] font-semibold text-[#f5f2ea]">{brandName.slice(0,1).toUpperCase()}</span>}
                    <span data-editor-type="text" className="text-[16px] font-semibold uppercase tracking-tight">{brandName}</span>
                  </div>
                  <p data-editor-type="text" className="mt-4 max-w-[280px] text-[12px] leading-relaxed text-[#1a1a1a]/60">Produtos selecionados com curadoria, entrega rápida e a melhor experiência de compra do Brasil.</p>
                  <div className="mt-5 flex items-center gap-2">
                    {[Instagram,Facebook,Youtube,Twitter].map((Icon,i)=>(
                      <a key={i} href="#" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1a1a1a]/10 bg-white text-[#1a1a1a]/70 transition hover:border-[#3d4a2a] hover:text-[#3d4a2a]"><Icon size={14} strokeWidth={1.8}/></a>
                    ))}
                  </div>
                </div>
                {[
                  {title:"Catálogo",links:["Todos os produtos","Novidades","Ofertas","Mais vendidos"]},
                  {title:"Ajuda",links:["Entrega","Trocas","Perguntas frequentes","Contato"]},
                  {title:"Empresa",links:["Sobre nós","Blog","Trabalhe conosco","Imprensa"]},
                ].map((col)=>(
                  <div key={col.title}>
                    <strong data-editor-type="text" className="mb-4 block text-[12px] font-semibold uppercase tracking-[0.15em] text-[#1a1a1a]">{col.title}</strong>
                    <ul className="space-y-2.5">
                      {col.links.map((l)=>(<li key={l}><a href="#" data-editor-type="text" className="text-[12px] text-[#1a1a1a]/60 transition hover:text-[#3d4a2a]">{l}</a></li>))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[#1a1a1a]/8 pt-6 md:flex-row md:items-center">
                <span className="text-[11px] text-[#1a1a1a]/45">© {new Date().getFullYear()} {brandName} · Todos os direitos reservados</span>
                <span className="text-[11px] text-[#1a1a1a]/45">Feito com Velo</span>
              </div>
            </footer>
            {renderCustomSectionsAfter("footer")}

            </div>
            </>
            )}

          </div>

          {false && activeTemplate.kind === "produto" ? (
            <>
              <div
                className="pointer-events-none absolute flex items-center text-white/30"
                style={{ left: editorMainCanvasWidth + 26, top: 430, width: 74 }}
              >
                <div className="h-px flex-1 bg-white/20" />
                <ArrowRight size={28} strokeWidth={1.8} />
              </div>

              <div
                className="pointer-events-none absolute top-0"
                style={{ left: editorMainCanvasWidth + 120, width: editorCartPreviewWidth }}
              >
                <div className="mb-4 flex h-10 items-center gap-2.5 text-[18px] font-semibold tracking-[-0.015em] text-white/78">
                  <Monitor size={20} strokeWidth={1.8} />
                  Tela 2 · Carrinho
                  <span className="rounded-full border border-white/[0.10] bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold tracking-normal text-white/55">Preview</span>
                </div>
                <div
                  className="relative overflow-hidden bg-white text-[#0f172a] shadow-[0_30px_100px_rgba(0,0,0,0.46)] ring-1 ring-white/[0.10]"
                  style={{ width: editorCartPreviewWidth, height: mobilePreview ? 920 : 940, fontFamily: selectedFontStack }}
                >
                  <header className="flex h-[72px] items-center border-b border-black/[0.07] px-10">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0f172a] text-[13px] font-bold uppercase text-white">
                      {brandName.slice(0, 1)}
                    </span>
                    <strong className="ml-3 max-w-[360px] truncate text-[14px] font-semibold tracking-[-0.015em]">
                      {brandName}
                    </strong>
                  </header>

                  <section className="px-16 pt-16 text-center">
                    <div className="text-[11px] font-medium text-[#8b94a6]">
                      Início <span className="mx-2 text-[#c5cad4]">/</span> Loja
                    </div>
                    <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.52em] text-[#0f172a]">Carrinho</p>
                    <h2 className="mt-8 text-[48px] font-semibold leading-none tracking-[-0.045em] text-[#0f172a]">
                      Meu carrinho
                    </h2>

                    <div className="mt-12 rounded-[24px] border border-black/[0.08] bg-white p-8 text-left shadow-[0_28px_80px_rgba(15,23,42,0.06)]">
                      <h3 className="text-[19px] font-semibold tracking-[-0.025em] text-[#111827]">Meu carrinho (1)</h3>
                      <div className="mt-8 grid grid-cols-[92px_1fr] gap-5 border-b border-black/[0.06] pb-8">
                        <div className="h-[92px] overflow-hidden rounded-[18px] bg-[#f4f6f8]">
                          {featuredProduct?.imageUrl || heroImage ? (
                            <img src={featuredProduct?.imageUrl || heroImage} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full place-items-center text-[#a7afbd]"><Package size={26} /></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <strong className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#111827]">
                            {featuredProduct?.title || projectTitle}
                          </strong>
                          <p className="mt-1 truncate text-[12px] text-[#8b94a6]">Cor: Padrão · Tamanho: Único</p>
                          <div className="mt-4 flex items-end gap-2">
                            <span className="text-[11px] text-[#9aa3b2] line-through">{formatBRL(featuredPrice * 1.25)}</span>
                            <strong className="text-[18px] font-semibold tracking-[-0.02em] text-[#0f172a]">{formatBRL(featuredPrice)}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="mt-7 space-y-4">
                        {[
                          ["Subtotal", formatBRL(featuredPrice)],
                          ["Frete", "Calculado no checkout"],
                          ["Total", formatBRL(featuredPrice)],
                        ].map(([label, value], index) => (
                          <div key={label} className={`flex items-center justify-between gap-4 ${index === 2 ? "pt-4 text-[18px] font-semibold text-[#0f172a]" : "text-[13px] text-[#6b7280]"}`}>
                            <span>{label}</span>
                            <span>{value}</span>
                          </div>
                        ))}
                      </div>

                      <button type="button" className="mt-8 flex h-14 w-full items-center justify-center rounded-full bg-[#2563eb] text-[14px] font-semibold text-white shadow-[0_16px_35px_rgba(37,99,235,0.22)]">
                        Continuar compra
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </>
          ) : null}

          {activeTemplate.kind === "loja" && projectSlug ? (
            <>
              {(() => {
                const productPathId = featuredProduct?.id ? `/${featuredProduct.id}` : "";
                const SCREEN_MAP: Record<string, { label: string; path: string } | undefined> = {
                  catalogo: { label: "Catálogo", path: `/loja/${projectSlug}/catalogo?preview=1` },
                  produto: { label: "Produto", path: `/loja/${projectSlug}/produto${productPathId}?preview=1` },
                  login: { label: "Login / Cadastro", path: `/loja/${projectSlug}/login?preview=1` },
                  carrinho: { label: "Carrinho", path: `/loja/${projectSlug}/carrinho?preview=1` },
                  checkout: { label: "Checkout", path: `/loja/${projectSlug}/checkout?preview=1` },
                  obrigado: { label: "Confirmação", path: `/loja/${projectSlug}/obrigado?preview=1` },
                  conta: { label: "Conta do cliente", path: `/loja/${projectSlug}/conta?preview=1` },
                };
                // A Home é sempre o canvas principal (à esquerda). As demais telas
                // aparecem na ordem definida pelo dono da loja (customerFlow).
                // Login e Conta (cadastro) andam sempre juntos, lado a lado.
                const rawOrder = customerFlow.filter((k) => k !== "home" && k !== "conta" && SCREEN_MAP[k]);
                const orderedKeys: string[] = [];
                for (const k of rawOrder) {
                  orderedKeys.push(k);
                  if (k === "login") orderedKeys.push("conta");
                }
                if (!orderedKeys.includes("conta")) {
                  if (!orderedKeys.includes("login")) orderedKeys.push("login");
                  orderedKeys.push("conta");
                }
                const screens = orderedKeys.map((key, idx) => ({
                  key,
                  label: `Tela ${idx + 2} · ${SCREEN_MAP[key]!.label}`,
                  path: SCREEN_MAP[key]!.path,
                }));
                const baseWidth = mobilePreview ? 390 : 1440;
                const gap = 120;
                const defaultHeight = mobilePreview ? 1400 : 1600;
                const HEIGHT_BY_KEY: Record<string, number> = mobilePreview
                  ? { checkout: 980, obrigado: 720 }
                  : { checkout: 780, obrigado: 560 };
                return (
                  <>
                    {screens.map((screen, idx) => {
                      const leftOffset = (baseWidth + gap) * (idx + 1);
                      const panelHeight = HEIGHT_BY_KEY[screen.key] ?? defaultHeight;
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

                    {screens.map((_, idx) => {
                      const leftOffset = (baseWidth + gap) * (idx + 1) - gap + 20;
                      return (
                        <div
                          key={`loja-arrow-${idx}`}
                          className="pointer-events-none absolute flex items-center text-white/30"
                          style={{ left: leftOffset, top: 56 + defaultHeight / 2 - 14, width: gap - 40 }}

                        >
                          <div className="h-px flex-1 bg-white/20" />
                          <ArrowRight size={28} strokeWidth={1.8} />
                        </div>
                      );
                    })}
                  </>
                );
              })()}
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
              className="fixed z-50 flex min-h-[62px] items-center gap-2.5 rounded-[20px] bg-[#0A0A0A] px-3 py-2.5 text-white shadow-[0_26px_70px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.10]"
              style={selectedToolbarStyle}
            >
              <div className="relative">
                <button type="button" onClick={()=>setIconPickerOpen((open)=>!open)} className="inline-flex h-11 items-center gap-2 rounded-[13px] px-3 text-[17px] font-semibold transition hover:bg-white/[0.08]">
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
              <span className="mx-0.5 h-7 w-px bg-white/[0.10]" />
              <div className="flex h-11 items-center gap-1 rounded-[13px] bg-white/[0.06] p-1">
                <button type="button" onClick={()=>applyIconSize(-2)} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white/70 transition hover:bg-white/[0.12] hover:text-white" aria-label="Diminuir ícone"><Minus size={18}/></button>
                <span className="w-14 text-center text-[17px] font-semibold tabular-nums">{contextControls.iconSize}px</span>
                <button type="button" onClick={()=>applyIconSize(2)} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white/70 transition hover:bg-white/[0.12] hover:text-white" aria-label="Aumentar ícone"><Plus size={18}/></button>
              </div>
              <span className="mx-0.5 h-7 w-px bg-white/[0.10]" />
              <label className="relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-[13px] px-3 text-[17px] font-semibold transition hover:bg-white/[0.08]">
                <span className="h-6 w-6 rounded-full ring-1 ring-white/25" style={{ backgroundColor: contextControls.color }} />
                Cor
                <input type="color" value={colorToHex(contextControls.color)} onChange={(event)=>applyElementColor(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <span className="mx-0.5 h-7 w-px bg-white/[0.10]" />
              <button type="button" onClick={deleteSelectedElement} className="flex h-11 w-11 items-center justify-center rounded-[13px] text-white/60 transition hover:bg-white/[0.10] hover:text-white" aria-label="Excluir ícone"><Trash2 size={20}/></button>
              <button type="button" onClick={clearSelection} className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12] hover:text-white" aria-label="Fechar toolbar"><X size={20}/></button>
            </div>
          ) : null}

          {isSelectedButton ? (
            <div
              data-editor-ignore
              data-canvas-ui
              className="fixed z-50 flex h-[52px] items-center rounded-[16px] bg-[#0A0A0A] px-2 text-white shadow-[0_26px_70px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.10]"
              style={selectedToolbarStyle}
            >
              <button type="button" onClick={()=>toggleButtonToolbarPanel("style")} className={`inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold transition ${buttonToolbarPanel==="style"?"bg-white/[0.10]":"hover:bg-white/[0.08]"}`}>
                <Palette size={18} strokeWidth={2} />
                Estilo
              </button>
              <span className="mx-1 h-7 w-px bg-white/[0.10]" />
              <button type="button" onClick={()=>toggleButtonToolbarPanel("size")} className={`inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold transition ${buttonToolbarPanel==="size"?"bg-white/[0.10]":"hover:bg-white/[0.08]"}`}>
                <Plus size={18} strokeWidth={2} />
                Tamanho
              </button>
              <span className="mx-1 h-7 w-px bg-white/[0.10]" />
              <button type="button" onClick={()=>toggleButtonToolbarPanel("radius")} className={`inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold transition ${buttonToolbarPanel==="radius"?"bg-white/[0.10]":"hover:bg-white/[0.08]"}`}>
                <span aria-hidden="true" className="h-[18px] w-[18px] rounded-bl-[15px] border-b-2 border-l-2 border-white" />
                Raio
              </button>
              <span className="mx-1 h-7 w-px bg-white/[0.10]" />
              <button type="button" onClick={()=>toggleButtonToolbarPanel("text")} className={`inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold transition ${buttonToolbarPanel==="text"?"bg-white/[0.10]":"hover:bg-white/[0.08]"}`}>
                <Type size={18} strokeWidth={2} />
                Texto
              </button>
              <span className="mx-1 h-7 w-px bg-white/[0.10]" />
              <button type="button" onClick={selectButtonIcon} className={`inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold transition ${buttonToolbarPanel==="icon"?"bg-white/[0.10]":"hover:bg-white/[0.08]"}`}>
                <Sparkles size={18} strokeWidth={2} />
                Ícone
              </button>
              <span className="mx-1 h-7 w-px bg-white/[0.10]" />
              <button type="button" onClick={clearSelection} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white/62 transition hover:bg-white/[0.14] hover:text-white" aria-label="Fechar toolbar"><X size={19}/></button>
            </div>
          ) : null}

          {selectedElement?.type === "text" && !isSelectedButton ? (
            <div
              data-editor-ignore
              className="fixed z-50 flex min-h-[62px] items-center gap-2.5 rounded-[20px] bg-[#0A0A0A] px-3 py-2.5 text-white shadow-[0_26px_70px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.10]"
              style={selectedToolbarStyle}
            >
              {/* Ação de IA: é a única peça invertida da barra. Destaca sem inventar
                  uma cor nova — verde aqui brigaria com o indicador de lucro. */}
              <button type="button" onClick={() => void handleRewriteText()} disabled={rewritingText} className="inline-flex h-11 items-center gap-2 rounded-[13px] bg-white px-4 text-[17px] font-semibold text-[#0A0A0A] shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition hover:bg-white/90 disabled:opacity-60">
                {rewritingText ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                {rewritingText ? "Reescrevendo" : "Reescrever"}
              </button>
              <span className="mx-0.5 h-7 w-px bg-white/[0.10]" />
              <div className="flex h-11 items-center gap-1 rounded-[13px] bg-white/[0.06] p-1">
                {[
                  { value: "left" as const, icon: AlignLeft, label: "Alinhar à esquerda" },
                  { value: "center" as const, icon: AlignCenter, label: "Centralizar" },
                  { value: "right" as const, icon: AlignRight, label: "Alinhar à direita" },
                ].map(({ value, icon: AlignIcon, label }) => (
                  <button key={value} type="button" onClick={()=>applyTextAlign(value)} aria-label={label} className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition ${contextControls.textAlign===value?"bg-white text-[#0A0A0A] shadow-[0_2px_6px_rgba(0,0,0,0.35)]":"text-white/60 hover:bg-white/[0.10] hover:text-white"}`}>
                    <AlignIcon size={20} />
                  </button>
                ))}
              </div>
              <span className="mx-0.5 h-7 w-px bg-white/[0.10]" />
              <div className="flex h-11 items-center gap-1 rounded-[13px] bg-white/[0.06] p-1">
                <button type="button" onClick={()=>applyTextSize(-1)} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white/70 transition hover:bg-white/[0.12] hover:text-white" aria-label="Diminuir texto"><Minus size={18}/></button>
                <span className="w-10 text-center text-[17px] font-semibold tabular-nums">{contextControls.fontSize}</span>
                <button type="button" onClick={()=>applyTextSize(1)} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white/70 transition hover:bg-white/[0.12] hover:text-white" aria-label="Aumentar texto"><Plus size={18}/></button>
              </div>
              <div className="relative">
                <button type="button" onClick={()=>setWeightMenuOpen((open)=>!open)} className="inline-flex h-11 min-w-[112px] items-center justify-center gap-2 rounded-[13px] bg-white/[0.06] px-3 text-[17px] font-semibold transition hover:bg-white/[0.10]">
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
              <label className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-[13px] bg-white/[0.06] transition hover:bg-white/[0.10]">
                <span className="h-6 w-6 rounded-full ring-1 ring-white/25" style={{ backgroundColor: contextControls.color }} />
                <input type="color" value={colorToHex(contextControls.color)} onChange={(event)=>applyElementColor(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <button type="button" onClick={clearSelection} className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12] hover:text-white" aria-label="Fechar toolbar"><X size={20}/></button>
            </div>
          ) : null}

          {selectedElement?.type === "other" && !isSelectedButton ? (
            <div
              data-editor-ignore
              className="fixed z-50 flex min-h-[62px] items-center gap-2.5 rounded-[20px] bg-[#0A0A0A] px-3 py-2.5 text-white shadow-[0_26px_70px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.10]"
              style={selectedToolbarStyle}
            >
              <div className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-[18px] font-semibold">
                <LayoutGrid size={21} strokeWidth={1.8} />
                {selectedElement.label}
              </div>
              <span className="mx-0.5 h-7 w-px bg-white/[0.10]" />
              <label className="relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-[13px] px-3 text-[17px] font-semibold transition hover:bg-white/[0.08]">
                <span className="h-6 w-6 rounded-full ring-1 ring-white/25" style={{ backgroundColor: fillColor }} />
                Fundo
                <input type="color" value={fillColor} onChange={(event)=>applyElementBackground(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <span className="mx-0.5 h-7 w-px bg-white/[0.10]" />
              <button type="button" onClick={duplicateSelectedElement} className="flex h-11 items-center gap-2 rounded-[13px] px-3 text-[17px] font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white" aria-label="Duplicar elemento">
                <Copy size={20} />
                Duplicar
              </button>
              <button type="button" onClick={deleteSelectedElement} className="flex h-11 w-11 items-center justify-center rounded-[13px] text-white/60 transition hover:bg-white/[0.10] hover:text-white" aria-label="Excluir elemento"><Trash2 size={20}/></button>
              <button type="button" onClick={clearSelection} className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12] hover:text-white" aria-label="Fechar toolbar"><X size={20}/></button>
            </div>
          ) : null}

          {contextNotice ? (
            <div data-editor-ignore className="fixed bottom-6 left-1/2 z-[60] max-w-[440px] -translate-x-1/2 rounded-full bg-[#101010] px-5 py-3 text-center text-[12px] font-medium text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
              {contextNotice}
              <button type="button" onClick={()=>setContextNotice(null)} className="ml-3 text-white/55 hover:text-white">Fechar</button>
            </div>
          ) : null}

          <div data-canvas-ui className="hidden absolute bottom-5 right-5 z-40 items-center gap-1 rounded-full border border-white/[0.10] bg-[#17181a]/92 p-1 text-white/62 shadow-[0_18px_54px_rgba(0,0,0,0.34)] backdrop-blur-xl">
            <button type="button" onClick={() => changeCanvasZoom(-0.08)} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/[0.09] hover:text-white" aria-label="Diminuir zoom"><Minus size={14} /></button>
            <button type="button" onClick={resetCanvasView} className="h-8 min-w-[54px] rounded-full px-2 text-[9px] font-semibold tabular-nums transition hover:bg-white/[0.09] hover:text-white" aria-label="Restaurar visualização">{Math.round(canvasZoom * 100)}%</button>
            <button type="button" onClick={() => changeCanvasZoom(0.08)} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/[0.09] hover:text-white" aria-label="Aumentar zoom"><Plus size={14} /></button>
            <span className="mx-1 h-4 w-px bg-white/[0.10]" />
            <button type="button" onClick={resetCanvasView} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/[0.09] hover:text-white" aria-label="Centralizar página"><RefreshCcw size={13} /></button>
          </div>

          <div data-editor-ignore data-canvas-ui className="pointer-events-none fixed right-5 top-1/2 z-50 hidden -translate-y-1/2 flex-row items-center gap-3">
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

        <aside
          data-canvas-ui
          aria-label="Painel de customização do template"
          className="fixed bottom-0 right-0 top-[72px] z-40 hidden w-[292px] overflow-y-auto border-l border-black/[0.07] bg-white px-4 py-4 text-[#0A0A0A] shadow-[-10px_0_28px_rgba(10,10,10,0.04)] xl:block"
        >
          {/* Cabeçalho: identifica o painel e guarda a ação de enquadrar o canvas
              (antes era um ícone solto, sem rótulo nem contexto). */}
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/38">Painel</p>
              <h2 className="mt-0.5 text-[15px] font-semibold tracking-[-0.025em]">Personalizar</h2>
            </div>
            <PanelIconButton icon={RectangleHorizontal} label="Centralizar elemento" onClick={resetCanvasView} />
          </header>

          <div className="mt-3.5">
            <PanelNotice icon={HelpCircle}>
              Modo simples ativado — algumas opções ficam ocultas. Mude para o avançado para ter controle total.
            </PanelNotice>
          </div>

          {/* Bloco selecionado no canvas. O mesmo `selectedElement` e os mesmos
              handlers que alimentam a barra flutuante alimentam este painel —
              não existe segundo estado de seleção para sair de sincronia. */}
          <div className="mt-3.5">
            {selectedElement ? (
              <div className="space-y-4">
                <PanelSelectionHeader
                  icon={selectedBlockIcon}
                  title={selectedBlockTitle}
                  onClear={clearSelection}
                />

                {selectedElement.type === "text" ? (
                  <>
                    <div className="space-y-2">
                      <PanelGroupLabel>Tipografia</PanelGroupLabel>
                      <PanelControlRow label="Tamanho">
                        <PanelStepper
                          value={contextControls.fontSize}
                          onDecrease={() => applyTextSize(-1)}
                          onIncrease={() => applyTextSize(1)}
                          decreaseLabel="Diminuir texto"
                          increaseLabel="Aumentar texto"
                        />
                      </PanelControlRow>
                      <PanelControlRow label="Cor">
                        <PanelColorControl
                          label="Cor do texto"
                          value={colorToHex(contextControls.color)}
                          onChange={applyElementColor}
                        />
                      </PanelControlRow>
                      <PanelOptionGrid
                        columns={2}
                        options={textWeightOptions}
                        value={contextControls.fontWeight}
                        onChange={applyTextWeight}
                      />
                    </div>

                    <div className="space-y-2">
                      <PanelGroupLabel>Layout</PanelGroupLabel>
                      <PanelControlRow label="Alinhar">
                        <PanelSegmented
                          value={contextControls.textAlign}
                          onChange={applyTextAlign}
                          options={[
                            { value: "left" as const, label: "Alinhar à esquerda", icon: AlignLeft },
                            { value: "center" as const, label: "Centralizar", icon: AlignCenter },
                            { value: "right" as const, label: "Alinhar à direita", icon: AlignRight },
                          ]}
                        />
                      </PanelControlRow>
                    </div>

                    <div className="space-y-2">
                      <PanelGroupLabel>Conteúdo</PanelGroupLabel>
                      <PanelActionButton
                        icon={Sparkles}
                        tone="primary"
                        label={rewritingText ? "Reescrevendo..." : "Reescrever com IA"}
                        disabled={rewritingText}
                        onClick={() => void handleRewriteText()}
                      />
                    </div>
                  </>
                ) : null}

                {isSelectedButton ? (
                  <>
                    <div className="space-y-2">
                      <PanelGroupLabel>Tipografia</PanelGroupLabel>
                      <PanelControlRow label="Tamanho">
                        <PanelStepper
                          value={contextControls.fontSize}
                          onDecrease={() => applyTextSize(-1)}
                          onIncrease={() => applyTextSize(1)}
                          decreaseLabel="Diminuir texto do botão"
                          increaseLabel="Aumentar texto do botão"
                        />
                      </PanelControlRow>
                      <PanelOptionGrid
                        columns={2}
                        options={textWeightOptions}
                        value={contextControls.fontWeight}
                        onChange={applyTextWeight}
                      />
                    </div>

                    <div className="space-y-2">
                      <PanelGroupLabel>Estilo</PanelGroupLabel>
                      <PanelControlRow label="Texto">
                        <PanelColorControl label="Cor do texto" value={colorToHex(contextControls.color)} onChange={applyElementColor} />
                      </PanelControlRow>
                      <PanelControlRow label="Fundo">
                        <PanelColorControl label="Cor de fundo" value={colorToHex(fillColor)} onChange={applyElementBackground} />
                      </PanelControlRow>
                      <PanelControlRow label="Raio">
                        <PanelStepper
                          value={contextControls.borderRadius}
                          onDecrease={() => applyButtonRadius(-2)}
                          onIncrease={() => applyButtonRadius(2)}
                          decreaseLabel="Diminuir arredondamento"
                          increaseLabel="Aumentar arredondamento"
                        />
                      </PanelControlRow>
                    </div>

                    <div className="space-y-2">
                      <PanelGroupLabel>Tamanho</PanelGroupLabel>
                      <PanelOptionGrid
                        columns={5}
                        options={buttonSizePresets.map((preset) => ({ value: preset.value, label: preset.value.toUpperCase() }))}
                        value={buttonSizePreset}
                        onChange={applyButtonSizePreset}
                      />
                    </div>

                    <PanelActionButton icon={Pencil} label="Editar texto no canvas" onClick={startButtonTextEditing} />
                  </>
                ) : null}

                {selectedElement.type === "image" ? (
                  <>
                    <div className="space-y-2">
                      <PanelGroupLabel>Imagem</PanelGroupLabel>
                      <PanelActionButton
                        icon={isSelectedProductImage ? Package : ImageIcon}
                        tone="primary"
                        label={isSelectedProductImage ? "Substituir produto" : selectedMediaKind === "logo" ? "Substituir logo" : "Substituir imagem"}
                        onClick={
                          isSelectedProductImage
                            ? openProductReplacementDrawer
                            : selectedMediaKind === "logo"
                              ? () => logoInput.current?.click()
                              : () => contextMediaInput.current?.click()
                        }
                      />
                      {!isSelectedProductImage ? (
                        <>
                          <PanelControlRow label="Formato">
                            <PanelSegmented
                              value={contextControls.imageShape}
                              onChange={handleImageShapeChange}
                              options={imageShapeOptions.map((shape) => ({ value: shape.value, label: shape.label, icon: shape.icon }))}
                            />
                          </PanelControlRow>
                          <PanelActionButton icon={Settings} label="Ajustes avançados" onClick={() => setMediaModalOpen(true)} />
                        </>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {selectedElement.type === "icon" ? (
                  <div className="space-y-2">
                    <PanelGroupLabel>Ícone</PanelGroupLabel>
                    <PanelControlRow label="Tamanho">
                      <PanelStepper
                        value={contextControls.iconSize}
                        onDecrease={() => applyIconSize(-2)}
                        onIncrease={() => applyIconSize(2)}
                        decreaseLabel="Diminuir ícone"
                        increaseLabel="Aumentar ícone"
                      />
                    </PanelControlRow>
                    <PanelControlRow label="Cor">
                      <PanelColorControl label="Cor do ícone" value={colorToHex(contextControls.color)} onChange={applyElementColor} />
                    </PanelControlRow>
                    <div className="grid grid-cols-5 gap-1.5">
                      {iconPickerOptions.map(({ name, label, icon: PickerIcon }) => (
                        <button
                          key={name}
                          type="button"
                          title={label}
                          onClick={() => applyIconName(name)}
                          aria-pressed={contextControls.iconName === name}
                          className={`flex h-9 items-center justify-center rounded-[10px] border transition ${
                            contextControls.iconName === name
                              ? "border-[#0A0A0A] bg-[#0A0A0A] text-white"
                              : "border-black/[0.07] bg-white text-black/55 hover:border-black/[0.16] hover:text-[#0A0A0A]"
                          }`}
                        >
                          <PickerIcon size={15} strokeWidth={1.9} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedElement.type === "other" && !isSelectedButton ? (
                  <div className="space-y-2">
                    <PanelGroupLabel>Seção</PanelGroupLabel>
                    <PanelControlRow label="Fundo">
                      <PanelColorControl label="Cor de fundo" value={colorToHex(fillColor)} onChange={applyElementBackground} />
                    </PanelControlRow>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <PanelGroupLabel>Ações</PanelGroupLabel>
                  <PanelActionButton icon={Copy} label="Duplicar bloco" onClick={duplicateSelectedElement} />
                  <PanelActionButton icon={Trash2} tone="danger" label="Excluir bloco" onClick={deleteSelectedElement} />
                </div>
              </div>
            ) : (
              <PanelEmptyState
                icon={MousePointer2}
                title="Nenhum bloco selecionado"
                description="Clique em uma seção ou bloco da página para editar."
              />
            )}
          </div>

          <div className="mt-6 space-y-2">
            <PanelGroupLabel>Estrutura</PanelGroupLabel>
            <PanelRowButton icon={Layers3} label="Templates" hint="Trocar o modelo da página" onClick={openTemplateDrawer} />
            <PanelRowButton icon={Package} label="Produtos" hint="Escolher o que aparece na vitrine" onClick={openProductsDrawer} />
          </div>

          <div className="mt-6 space-y-2">
            <PanelGroupLabel>Loja</PanelGroupLabel>
            <PanelRowButton icon={LockKeyhole} label="Administração" hint="Clientes, pedidos e fluxo" onClick={() => setAdminOpen(true)} />
          </div>
        </aside>

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

      <StoreAdminModal
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        project={currentProject}
        onProjectUpdated={setCurrentProject}
        storeProducts={products.map((p) => ({
          id: p.id,
          title: p.title,
          price: p.price,
          imageUrl: p.imageUrl || p.imageUrls?.[0] || "",
          category: p.category,
        }))}
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
                  <div className="flex flex-wrap items-center gap-3 p-5"><span className="h-4 w-4 rounded-full bg-[#1597f4] ring-4 ring-[#1597f4]/15"/><strong className="text-[18px]">Velo <em>BASE</em></strong><span className="ml-auto rounded-[9px] bg-white/[0.08] px-3 py-2 text-[26px] font-semibold tracking-[-0.04em]">R$ 39,90 <small className="text-[11px] font-normal text-white/45">{"/m\u00eas"}</small></span></div>
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
            className="editor-context-drawer absolute inset-y-0 right-0 flex w-[360px] flex-col border-l border-black/[0.08] bg-white text-[#0A0A0A] shadow-[-24px_0_80px_rgba(10,10,10,0.18)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex min-h-[68px] items-center justify-between border-b border-black/[0.07] px-5">
              <div className="min-w-0">
                <h2 id="editor-drawer-title" className="truncate text-[16px] font-semibold">
                  {contextDrawer === "template" ? "Trocar template" : replacingProductPath ? "Substituir produto" : "Adicionar produtos"}
                </h2>
                <p className="mt-1 truncate text-[11px] text-black/45">
                  {contextDrawer === "template" ? "Escolha uma base visual para a loja." : replacingProductPath ? "Escolha o novo produto para este espaço." : "Selecione produtos do catálogo Velo."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setContextDrawer(null);
                  setReplacingProductPath(null);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-black/45 transition hover:bg-black/[0.05] hover:text-[#0A0A0A]"
                aria-label="Fechar painel"
              >
                <X size={20} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {contextDrawer === "template" ? (
                <>
                  <div className="mb-4 flex items-center gap-5 border-b border-black/[0.07]">
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
                          templateCategory === category.id ? "text-[#0A0A0A]" : "text-black/40 hover:text-black/70"
                        }`}
                      >
                        {category.label}
                        {templateCategory === category.id ? <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#0A0A0A]" /> : null}
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
                          className={`group overflow-hidden rounded-[12px] bg-white text-left transition hover:border-black/25 ${
                            selected ? "border-2 border-[#0A0A0A]" : "border border-black/[0.09]"
                          }`}
                        >
                          <div className="relative aspect-[4/3] overflow-hidden bg-white">
                            <img src={template.image} alt="" className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]" />
                            {selected ? <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#0A0A0A] text-white shadow-lg"><Check size={13} /></span> : null}
                          </div>
                          <div className="p-3">
                            <strong className="block text-[12px] font-semibold text-[#0A0A0A]">{template.name}</strong>
                            <span className="mt-1 block text-[11px] leading-snug text-black/45">{template.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {contextDrawer === "products" ? (
                <>
                  <div className="mb-4 flex items-center justify-between rounded-[12px] border border-black/[0.07] bg-[#FAFAF9] px-4 py-3">
                    <div>
                      <strong className="block text-[12px] font-semibold">{replacingProductPath ? "Escolha o produto" : "Produtos disponíveis"}</strong>
                      <span className="mt-0.5 block text-[10px] text-black/45">{replacingProductPath ? "A escolha substituirá o produto atual." : "Marque um ou mais itens para sua vitrine."}</span>
                    </div>
                    <span className="rounded-full bg-black/[0.06] px-2.5 py-1 text-[10px] font-semibold text-black/60">{draftProductIds.length} selecionados</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {drawerProducts.map((product) => {
                      const selected = draftProductIds.includes(product.id);
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => setDraftProductIds((current) => replacingProductPath ? (selected ? [] : [product.id]) : selected ? current.filter((id) => id !== product.id) : [...current, product.id])}
                          className={`overflow-hidden rounded-[12px] bg-white text-left transition hover:border-black/25 ${
                            selected ? "border-2 border-[#0A0A0A]" : "border border-black/[0.09]"
                          }`}
                        >
                          <div className="relative aspect-[4/3] bg-[#F6F6F4]">
                            {product.imageUrl ? <img loading="lazy" src={product.imageUrl} alt="" className="h-full w-full object-contain p-3" /> : <div className="grid h-full place-items-center text-black/30"><Package size={24} /></div>}
                            <span className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full shadow-lg transition ${selected ? "bg-[#0A0A0A] text-white" : "bg-white/90 text-[#0A0A0A] ring-1 ring-black/10"}`}>
                              {selected ? <Check size={13} /> : <Plus size={13} />}
                            </span>
                          </div>
                          <div className="p-3">
                            <strong className="line-clamp-2 text-[12px] font-semibold leading-snug text-[#0A0A0A]">{product.title}</strong>
                            <span className="mt-1 block text-[11px] text-black/45">{formatBRL(product.price)}</span>
                          </div>
                        </button>
                      );
                    })}
                    {!drawerProducts.length ? (
                      <div className="col-span-2 rounded-[12px] border border-dashed border-black/15 p-6 text-center text-[12px] text-black/45">
                        {catalogAllLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            Carregando o catálogo...
                          </span>
                        ) : (
                          "Todos os produtos disponíveis já estão na sua loja."
                        )}
                      </div>
                    ) : null}
                    {drawerProducts.length > 0 && catalogAllLoading ? (
                      <div className="col-span-2 flex items-center justify-center gap-2 py-2 text-[11px] text-black/40">
                        <Loader2 size={13} className="animate-spin" />
                        Carregando o restante do catálogo...
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>

            <footer className="border-t border-black/[0.07] p-4">
              <button
                type="button"
                onClick={contextDrawer === "template" ? applyTemplateDraft : () => void applyProductDraft()}
                disabled={contextDrawer === "products" && (!draftProductIds.length || Boolean(sidebarImportingId))}
                className="h-11 w-full rounded-[8px] bg-[#2f6df6] text-[13px] font-semibold text-white shadow-[0_12px_28px_rgba(47,109,246,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-black/[0.06] disabled:text-black/30 disabled:shadow-none"
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
          <>
            <motion.div
              key="publish-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[125]"
              onMouseDown={() => setPublishOpen(false)}
            />
            <motion.section
              key="publish-popover"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 360, damping: 30 }}
              className="fixed right-6 top-[72px] z-[130] w-[380px] overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#0e0f11] text-white shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pt-5">
                <h2 className="text-[17px] font-semibold tracking-[-0.01em]">
                  {currentProject?.status === "publicado" ? "Publicado" : "Publicar"}
                </h2>
                {currentProject?.status === "publicado" ? (
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-white/50">
                    <Eye size={13} /> 0
                  </span>
                ) : null}
              </div>

              <div className="px-5 pt-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-white">Endereço do site</span>
                  <button type="button" className="flex items-center gap-1.5 text-[12px] font-medium text-white/55 transition hover:text-white">
                    <Link2 size={12} /> Domínio personalizado
                  </button>
                </div>
                {publicUrl ? (
                  <div className="flex items-center justify-between rounded-[12px] border border-white/[0.08] bg-[#17181a] px-3.5 py-3">
                    <span className="truncate text-[13px] font-medium text-white/85">
                      {publicUrl.replace(/^https?:\/\//, "")}
                    </span>
                    <button type="button" onClick={() => void handleCopyPublicUrl()} className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-white/60 transition hover:bg-white/[0.06] hover:text-white" aria-label="Copiar link">
                      {publishCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-[12px] border border-dashed border-white/[0.10] bg-[#17181a] px-3.5 py-3 text-[12.5px] text-white/50">
                    Publique para gerar o subdomínio do seu projeto.
                  </div>
                )}
              </div>

              <div className="mt-5 border-t border-white/[0.06] px-5 py-4">
                <p className="mb-2.5 text-[13px] font-semibold text-white">Quem pode ver este site</p>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/80">
                    <Globe size={16} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-white">Público</p>
                    <p className="text-[11.5px] text-white/50">Qualquer pessoa com o link</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] px-5 py-4">
                <button type="button" onClick={() => setPublishOpen(false)} className="h-10 rounded-[10px] bg-white/[0.05] text-[12.5px] font-semibold text-white/80 transition hover:bg-white/[0.09]">
                  Revisar segurança
                </button>
                <button type="button" onClick={() => setPublishOpen(false)} className="h-10 rounded-[10px] bg-white/[0.05] text-[12.5px] font-semibold text-white/80 transition hover:bg-white/[0.09]">
                  Configurações
                </button>
              </div>

              <div className="px-5 pb-5">
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => void handleConfirmPublish()}
                  className="relative flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#3567e9] text-[13.5px] font-semibold text-white transition hover:bg-[#4272ee] disabled:opacity-55"
                >
                  {publishing ? <RefreshCcw size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {currentProject?.status === "publicado" ? "Atualizar" : "Publicar agora"}
                  <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-white/95" />
                </button>
                {currentProject?.status === "publicado" && publicUrl ? (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 flex h-10 items-center justify-center gap-2 rounded-[10px] text-[12.5px] font-semibold text-white/70 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    <Link2 size={14} />
                    Abrir site publicado
                  </a>
                ) : null}
              </div>
            </motion.section>
          </>
        ) : null}
      </AnimatePresence>
    </main>
  );
};

export default GeneratedStoreEditorPage;
