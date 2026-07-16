import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AlignCenter, AlignLeft, AlignRight, Baby, BookOpen, Boxes, Car, Check, ChevronDown, ChevronLeft, Circle, Code2, Copy, Dumbbell, Eraser, ExternalLink, Gamepad2, Gem, Gift, Globe2, Headphones, Heart, HeartPulse, History, Home, ImageIcon, Laptop, LayoutGrid, LayoutTemplate, LockKeyhole, Menu, Minus, Monitor, MoreHorizontal, MousePointer2, Package, PaintBucket, Palette, PawPrint, Pencil, Play, Plus, RefreshCcw, Settings, Shirt, ShoppingCart, Smartphone, Sparkles, Square, Star, Trash2, Truck, Type, X, type LucideIcon } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { useAuth } from "@/contexts/AuthContext";
import { getSavedStoreFlow, markStoreFlowCompleted } from "@/lib/storeFlowCompletion";
import { ensureExampleCollectionProducts } from "@/lib/collectionsApi";
import { formatReviewCount, getProductCatalogMetrics } from "@/components/dashboard/ProductCard";
import StorefrontNavbar from "@/components/storefront/StorefrontNavbar";
import ProductTemplate from "@/components/store-templates/ProductTemplate";
import ProductTemplateBeauty from "@/components/store-templates/ProductTemplateBeauty";
import ProductTemplateShopify from "@/components/store-templates/ProductTemplateShopify";

type FlowState = { product: ExampleProduct; language: string; persona: string; salesAngle: string };
type CatalogItem = ExampleProduct & { category: string; rating?: number; averageRating?: number; ratingCount?: string | number; reviewCount?: string | number; reviewsCount?: string | number };
type EditorPanelTab = "detalhes" | "personalizar";
type EditorPanelSection = "template" | "produtos" | "imagem" | "aparencia";
type ContextDrawerMode = "template" | "products";

const getFirstImage = (images: unknown) => {
  if (Array.isArray(images)) return images.find((image): image is string => typeof image === "string" && image.trim().length > 0) || "";
  if (typeof images === "string") { try { return getFirstImage(JSON.parse(images)); } catch { return images; } }
  return "";
};
const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
type EditorElementType = "image" | "icon" | "text" | "other";
type ImageShape = "auto" | "wide" | "square" | "circle";
type TextWeight = "400" | "500" | "600" | "700";
type ElementOverride = {
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: TextWeight;
  textAlign?: "left" | "center" | "right";
  imageSrc?: string;
  imageShape?: ImageShape;
  iconName?: string;
  iconSize?: number;
};
type SelectedEditorElement = {
  path: string;
  type: EditorElementType;
  rect: { top: number; left: number; width: number; height: number };
};
type ContextControls = {
  color: string;
  fontSize: number;
  fontWeight: TextWeight;
  textAlign: "left" | "center" | "right";
  imageShape: ImageShape;
  iconName: string;
  iconSize: number;
};

const defaultContextControls: ContextControls = {
  color: "#111111",
  fontSize: 16,
  fontWeight: "500",
  textAlign: "center",
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

const getIconComponent = (name: string) =>
  iconPickerOptions.find((option) => option.name === name)?.icon ?? Sparkles;

const renderIconMarkup = (name: string, size: number, color: string) => {
  const Icon = getIconComponent(name);
  return renderToStaticMarkup(<Icon size={size} strokeWidth={1.85} color={color} />);
};

const textWeightOptions: Array<{ value: TextWeight; label: string }> = [
  { value: "400", label: "Regular" },
  { value: "500", label: "Médio" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Negrito" },
];

const GeneratedStoreEditorPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const imageInput = useRef<HTMLInputElement>(null);
  const contextMediaInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const selectedElementRef = useRef<HTMLElement | null>(null);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [accent, setAccent] = useState("#111111");
  const [font, setFont] = useState("Geist");
  const [columns, setColumns] = useState(3);
  const [heroImage, setHeroImage] = useState("/hero-pasted-image-2.png");
  const [heroCtaUrl, setHeroCtaUrl] = useState("/catalogo");
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [storeName, setStoreName] = useState("Velo");
  const [showPlans, setShowPlans] = useState(false);
  const [editorPanelTab, setEditorPanelTab] = useState<EditorPanelTab>("personalizar");
  const [openPanelSections, setOpenPanelSections] = useState<Record<EditorPanelSection, boolean>>({
    template: true,
    produtos: true,
    imagem: true,
    aparencia: true,
  });
  const [contextDrawer, setContextDrawer] = useState<ContextDrawerMode | null>(null);
  const [templateCategory, setTemplateCategory] = useState<"loja" | "produto">("loja");
  const [currentTemplate, setCurrentTemplate] = useState("Template 1");
  const [activeTemplate, setActiveTemplate] = useState<{ kind: "loja" | "produto"; id: string }>({ kind: "loja", id: "loja-1" });
  const [draftTemplate, setDraftTemplate] = useState<{ kind: "loja" | "produto"; id: string }>({ kind: "loja", id: "loja-1" });
  const [draftProductId, setDraftProductId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [elementOverrides, setElementOverrides] = useState<Record<string, ElementOverride>>({});
  const [selectedElement, setSelectedElement] = useState<SelectedEditorElement | null>(null);
  const [contextControls, setContextControls] = useState<ContextControls>(defaultContextControls);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [weightMenuOpen, setWeightMenuOpen] = useState(false);
  const [contextNotice, setContextNotice] = useState<string | null>(null);
  const [fillColor, setFillColor] = useState("#111111");
  const [fillPickerOpen, setFillPickerOpen] = useState(false);
  const [generatingBanner, setGeneratingBanner] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [copyVariant, setCopyVariant] = useState(0);
  const [taglineVariant, setTaglineVariant] = useState(0);

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

  const getElementPath = (element: HTMLElement, root: HTMLElement): string => {
    const parts: string[] = [];
    let current: HTMLElement | null = element;
    while (current && current !== root) {
      const parent = current.parentElement;
      if (!parent) break;
      const index = Array.from(parent.children).indexOf(current);
      parts.unshift(`${current.tagName.toLowerCase()}:${index}`);
      current = parent;
    }
    return parts.join(">");
  };

  const getElementByPath = (path: string): HTMLElement | null => {
    const root = previewRef.current;
    if (!root || !path) return null;
    let current: Element = root;
    for (const part of path.split(">")) {
      const [, indexValue] = part.split(":");
      const index = Number(indexValue);
      if (!Number.isInteger(index)) return null;
      const child = current.children.item(index);
      if (!(child instanceof HTMLElement)) return null;
      current = child;
    }
    return current instanceof HTMLElement && current !== root ? current : null;
  };

  const getEditableTarget = (target: HTMLElement): HTMLElement | null => {
    const explicit = target.closest("[data-editor-type]");
    if (explicit instanceof HTMLElement) return explicit;
    const svg = target.closest("svg");
    if (svg instanceof HTMLElement) return svg;
    if (target instanceof HTMLImageElement) return target;
    const textTarget = target.closest("h1,h2,h3,p,span,strong,a,button,li");
    if (textTarget instanceof HTMLElement) return textTarget;
    return target === previewRef.current ? null : target;
  };

  const getEditorElementType = (element: HTMLElement): EditorElementType => {
    const explicit = element.dataset.editorType as EditorElementType | undefined;
    if (explicit === "image" || explicit === "icon" || explicit === "text") return explicit;
    if (element instanceof HTMLImageElement) return "image";
    if (element.tagName.toLowerCase() === "svg") return "icon";
    if (element.textContent?.trim() && !element.querySelector("img,svg")) return "text";
    return "other";
  };

  const getElementRect = (element: HTMLElement) => {
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

  const readControlsFromElement = (element: HTMLElement, type: EditorElementType): ContextControls => {
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
      fontSize: Math.round(override?.fontSize ?? fontSize),
      fontWeight: override?.fontWeight ?? detectFontWeight(computed.fontWeight),
      textAlign: override?.textAlign ?? detectTextAlign(computed.textAlign),
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
    setMediaModalOpen(false);
    setIconPickerOpen(false);
    setWeightMenuOpen(false);
    setFillPickerOpen(false);
  };

  const selectElement = (element: HTMLElement, options?: { openMedia?: boolean }) => {
    const root = previewRef.current;
    if (!root) return;
    const path = getElementPath(element, root);
    const type = getEditorElementType(element);
    setSelectedPath(path);
    setSelectedElement({ path, type, rect: getElementRect(element) });
    setContextControls(readControlsFromElement(element, type));
    if (type !== "icon") setIconPickerOpen(false);
    if (type !== "text") setWeightMenuOpen(false);
    if (type === "image" && options?.openMedia) setMediaModalOpen(true);
  };

  const applyOverrideToElement = (element: HTMLElement, override: ElementOverride) => {
    if (element.dataset.editorOriginalBackgroundColor === undefined) {
      element.dataset.editorOriginalBackgroundColor = element.style.backgroundColor;
    }
    if (override.backgroundColor) {
      element.style.backgroundColor = override.backgroundColor;
      element.dataset.editorFillOverride = "true";
    }
    if (override.color) {
      if (element.dataset.editorOriginalColor === undefined) element.dataset.editorOriginalColor = element.style.color;
      element.style.color = override.color;
      if (element.tagName.toLowerCase() === "svg") {
        element.setAttribute("color", override.color);
        element.style.color = override.color;
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
  };

  const resetElementOverride = (element: HTMLElement) => {
    const originalBackground = element.dataset.editorOriginalBackgroundColor;
    if (originalBackground) element.style.backgroundColor = originalBackground;
    else element.style.removeProperty("background-color");
    delete element.dataset.editorOriginalBackgroundColor;
    delete element.dataset.editorFillOverride;
    element.style.color = element.dataset.editorOriginalColor || "";
    element.style.fontSize = element.dataset.editorOriginalFontSize || "";
    element.style.fontWeight = element.dataset.editorOriginalFontWeight || "";
    element.style.textAlign = element.dataset.editorOriginalTextAlign || "";
    element.style.borderRadius = element.dataset.editorOriginalBorderRadius || "";
    element.style.aspectRatio = element.dataset.editorOriginalAspectRatio || "";
    element.style.objectFit = element.dataset.editorOriginalObjectFit || "";
    delete element.dataset.editorOriginalColor;
    delete element.dataset.editorOriginalFontSize;
    delete element.dataset.editorOriginalFontWeight;
    delete element.dataset.editorOriginalTextAlign;
    delete element.dataset.editorOriginalBorderRadius;
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
    target.dataset.editorType = target.dataset.editorType || "text";
    target.setAttribute("contenteditable", "true");
    target.style.outline = "2px solid #2563eb";
    target.style.outlineOffset = "2px";
    target.focus();
    const cleanup = () => {
      target.removeAttribute("contenteditable");
      target.style.outline = "";
      target.style.outlineOffset = "";
      target.removeEventListener("blur", cleanup);
    };
    target.addEventListener("blur", cleanup);
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
      if (element) startInlineEditing(element);
    }
    if (tool === "fill") setFillPickerOpen(Boolean(selectedPath));
    if (tool === "eraser" && selectedPath) resetPathOverride(selectedPath);
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
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [selectedElement?.path]);

  useEffect(() => {
    Object.entries(elementOverrides).forEach(([path, override]) => {
      const element = getElementByPath(path);
      if (element) applyOverrideToElement(element, override);
    });
  }, [elementOverrides]);

  const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!previewRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-editor-ignore]")) return;
    const editableTarget = getEditableTarget(target);
    if (!editableTarget) {
      clearSelection();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const type = getEditorElementType(editableTarget);
    selectElement(editableTarget, { openMedia: type === "image" });

    if (editMode === "edit") {
      startInlineEditing(editableTarget);
      return;
    }
    if (type === "text") startInlineEditing(editableTarget);
    if (editMode === "fill") {
      setFillPickerOpen(true);
      return;
    }
    if (editMode === "eraser") {
      resetPathOverride(getElementPath(editableTarget, previewRef.current));
    }
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
    setContextNotice(`${label} depende de uma Edge Function/Lovable dedicada para IA. UI pronta; integração real fica para um prompt separado.`);
  };

  const duplicateSelectedElement = () => {
    const element = getSelectedDomElement();
    if (!element || !previewRef.current) return;
    const clone = element.cloneNode(true) as HTMLElement;
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
    const state = location.state as Partial<FlowState> | null;
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
    return saved && saved.product && saved.language && saved.persona && saved.salesAngle ? saved : null;
  }, [location.state, user?.id]);

  useEffect(() => {
    if (flow && user?.id) markStoreFlowCompleted(user.id, flow);
  }, [flow, user?.id]);

  useEffect(() => {
    if (!flow) return;
    setHeroImage("/hero-pasted-image-2.png");
    let mounted = true;
    const loadStore = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) return;

      const [profileResult, initialCollectionProductsResult] = await Promise.all([
        supabase.from("profiles").select("store_name,loja_nome").eq("user_id", userId).maybeSingle(),
        fetchEditorCollectionProducts(userId),
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
          category: item.category?.trim() || "Outros",
        }];
      }).filter((item) => item.imageUrl);
      setProducts(mapped);
    };
    void loadStore();
    return () => { mounted = false; };
  }, [flow]);

  if (!flow) return <Navigate to="/comecar" replace />;
  const baseProducts = products.length ? products : [{ ...flow.product, category: "Outros" }];
  const displayedProducts = baseProducts;
  const featuredProduct = displayedProducts[0];
  const featuredPrice = featuredProduct?.price || 149.9;
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
    ],
  };
  const selectedFontStack = fontOptions.find((option) => option.name === font)?.stack || fontOptions[0].stack;
  const activeTemplateOption =
    templateOptions[activeTemplate.kind].find((template) => template.id === activeTemplate.id) ?? templateOptions.loja[0];
  const drawerTemplates = templateOptions[templateCategory];
  const drawerProducts = displayedProducts.slice(0, 9);
  const togglePanelSection = (section: EditorPanelSection) => {
    setOpenPanelSections((current) => ({ ...current, [section]: !current[section] }));
  };
  const openTemplateDrawer = () => {
    setTemplateCategory(activeTemplate.kind);
    setDraftTemplate(activeTemplate);
    setContextDrawer("template");
  };
  const openProductsDrawer = () => {
    setDraftProductId((current) => current ?? drawerProducts[0]?.id ?? null);
    setContextDrawer("products");
  };
  const applyTemplateDraft = () => {
    const selected = templateOptions[draftTemplate.kind].find((template) => template.id === draftTemplate.id);
    if (!selected) return;
    setCurrentTemplate(selected.name);
    setActiveTemplate(draftTemplate);
    setContextDrawer(null);
  };
  const applyProductDraft = () => {
    setContextDrawer(null);
    if (!draftProductId) navigate("/catalogo");
  };
  const panelSections: Array<{ id: EditorPanelSection; label: string }> = [
    { id: "template", label: "Template" },
    { id: "produtos", label: "Produtos" },
    { id: "imagem", label: "Imagem" },
    { id: "aparencia", label: "Aparência" },
  ];
  const toolbarOrientation = mobilePreview ? "vertical" : "horizontal";
  const toolbarTools = [
    { id: "select" as const, label: "Select", icon: MousePointer2 },
    { id: "edit" as const, label: "Pencil", icon: Pencil },
    { id: "fill" as const, label: "Fill", icon: PaintBucket },
    { id: "eraser" as const, label: "Eraser", icon: Eraser },
  ];
  const activeToolbarTool = toolbarTools.find((tool) => tool.id === editMode);
  const fillSwatches = ["#111111", "#2563eb", "#dc2626", "#f59e0b", "#ec4899", "#7c3aed"];
  const selectedDomElement = getSelectedDomElement();
  const selectedMediaSrc =
    selectedElement?.type === "image" && selectedDomElement instanceof HTMLImageElement
      ? selectedDomElement.currentSrc || selectedDomElement.src
      : "";
  const selectedToolbarTop = selectedElement
    ? Math.max(12, selectedElement.rect.top - (selectedElement.type === "image" ? 2 : 74))
    : 0;
  const selectedToolbarLeft = selectedElement
    ? selectedElement.type === "image"
      ? Math.min(window.innerWidth - 72, selectedElement.rect.left + selectedElement.rect.width + 12)
      : Math.min(
          window.innerWidth - 340,
          Math.max(16, selectedElement.rect.left + selectedElement.rect.width / 2 - 260),
        )
    : 0;
  const imageShapeOptions: Array<{ value: ImageShape; label: string; icon: LucideIcon }> = [
    { value: "auto", label: "Automático", icon: ImageIcon },
    { value: "wide", label: "Retangular", icon: LayoutGrid },
    { value: "square", label: "Quadrado", icon: Square },
    { value: "circle", label: "Circular", icon: Circle },
  ];

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#1f1f1d] text-white" style={{ fontFamily: selectedFontStack }}>
      <style>{`.store-editor-preview [data-editor-selected="true"]{outline:2px solid #111827;outline-offset:3px}.editor-mode-active *:hover{outline:1.5px dashed #2563eb;outline-offset:2px;cursor:pointer}.editor-mode-active [data-editor-ignore],.editor-mode-active [data-editor-ignore] *{outline:none!important;cursor:default}.editor-context-drawer{animation:editorDrawerIn 200ms ease both}@keyframes editorDrawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
      <header className="grid h-[70px] shrink-0 grid-cols-[minmax(280px,520px)_minmax(0,1fr)_auto] items-center border-b border-white/[0.07] bg-[#1f1f1d] px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#ff7a18] via-[#f43f5e] to-[#2563eb]" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <strong className="truncate text-[14px] font-semibold">{storeName}</strong>
              <ChevronDown size={13} className="text-white/45" />
            </div>
            <span className="block truncate text-[12px] text-white/45">Editando última versão salva</span>
          </div>
        </div>

        <div className="hidden min-w-0 items-center justify-center gap-3 lg:flex">
          <div className="flex h-10 items-center gap-1 rounded-full border border-white/[0.09] bg-[#171716] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <button type="button" className="inline-flex h-8 items-center gap-2 rounded-full bg-[#234cba] px-4 text-[13px] font-semibold text-[#9db7ff] shadow-[0_0_0_1px_rgba(96,145,255,0.35)]">
              <Globe2 size={16} /> Preview
            </button>
            <button type="button" className="flex h-8 w-9 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white" aria-label="Código">
              <Code2 size={15} />
            </button>
          </div>
          <div className="flex h-10 min-w-[260px] max-w-[380px] flex-1 items-center gap-2 rounded-full border border-white/[0.09] bg-[#171716] px-3 text-[13px] text-white/75">
            <button type="button" className="text-white/45 transition hover:text-white" aria-label="Atualizar preview">
              <RefreshCcw size={15} />
            </button>
            <span className="text-white/35">/</span>
            <span className="truncate font-medium">minha-loja/editor</span>
            <ChevronDown size={14} className="ml-auto text-white/35" />
          </div>
          <button type="button" className="text-white/45 transition hover:text-white" aria-label="Abrir preview">
            <ExternalLink size={17} />
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          <div className="hidden rounded-full border border-white/[0.08] bg-[#171716] p-1 sm:flex">
            <button type="button" onClick={()=>setMobilePreview(false)} className={`flex h-8 w-10 items-center justify-center rounded-full transition ${!mobilePreview?"bg-white/[0.12] text-white":"text-white/35 hover:text-white"}`} aria-label="Preview desktop">
              <Monitor size={16}/>
            </button>
            <button type="button" onClick={()=>setMobilePreview(true)} className={`flex h-8 w-10 items-center justify-center rounded-full transition ${mobilePreview?"bg-white/[0.12] text-white":"text-white/35 hover:text-white"}`} aria-label="Preview mobile">
              <Smartphone size={15}/>
            </button>
          </div>
          <button type="button" className="hidden h-10 w-10 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white md:flex" aria-label="Configurações">
            <Settings size={18}/>
          </button>
          <button type="button" className="hidden h-10 w-10 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white md:flex" aria-label="Visualizar">
            <Play size={18}/>
          </button>
          <button type="button" className="hidden h-10 w-10 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white md:flex" aria-label="Histórico">
            <History size={18}/>
          </button>
          <button onClick={()=>setShowPlans(true)} className="h-10 rounded-[12px] bg-[#2f6df6] px-5 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_8px_22px_rgba(47,109,246,0.24)] transition hover:brightness-110">
            Publicar
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(event)=>{const file=event.target.files?.[0];if(file)setHeroImage(URL.createObjectURL(file));}}/>
        <input ref={contextMediaInput} type="file" accept="image/*" className="hidden" onChange={handleContextImageUpload}/>
        <aside className="w-[360px] shrink-0 overflow-y-auto border-r border-[#27272A] bg-[#0f0f0f] px-4 py-5">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => history.back()} className="flex h-9 w-9 items-center justify-center rounded-[8px] text-white/70 transition hover:bg-white/[0.06] hover:text-white" aria-label="Voltar">
              <ChevronLeft size={18} />
            </button>
            <div className="min-w-0">
              <strong className="block truncate text-[14px] font-semibold">{storeName}</strong>
              <span className="block truncate text-[11px] text-white/42">Painel de edição</span>
            </div>
            <button type="button" className="ml-auto flex h-9 w-9 items-center justify-center rounded-[8px] text-white/50 transition hover:bg-white/[0.06] hover:text-white" aria-label="Mais opções">
              <MoreHorizontal size={18} />
            </button>
          </div>

          <div className="mt-5 flex items-center gap-5 border-b border-[#27272A]">
            {[
              { id: "detalhes" as const, label: "Detalhes", icon: LayoutTemplate },
              { id: "personalizar" as const, label: "Personalizar", icon: Palette },
            ].map((tab) => {
              const TabIcon = tab.icon;
              const active = editorPanelTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEditorPanelTab(tab.id)}
                  className={`relative flex h-11 items-center gap-2 text-[13px] font-semibold transition ${active ? "text-white" : "text-[#71717A] hover:text-white/80"}`}
                >
                  <TabIcon size={16} strokeWidth={1.5} />
                  {tab.label}
                  {active ? <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-white" /> : null}
                </button>
              );
            })}
          </div>

          <section className="mt-2 divide-y divide-[#27272A]">
            {panelSections.map((section) => (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => togglePanelSection(section.id)}
                  className="flex w-full items-center justify-between px-1 py-3 text-left"
                >
                  <span className="text-[13px] font-semibold text-white">{section.label}</span>
                  <ChevronDown size={16} className={`text-white/45 transition duration-150 ease-out ${openPanelSections[section.id] ? "rotate-180" : ""}`} />
                </button>

                {openPanelSections[section.id] ? (
                  <div className="pb-4">
                    {section.id === "template" ? (
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={openTemplateDrawer}
                          className="group aspect-[4/3] rounded-[12px] border-2 border-white bg-[#18181B] p-2 text-left transition hover:border-[#3F3F46]"
                        >
                          <div className="flex h-full flex-col justify-between">
                            <LayoutTemplate size={18} strokeWidth={1.6} className="text-white" />
                            <span className="text-[12px] font-medium text-white">{activeTemplateOption.name}</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={openTemplateDrawer}
                          className="group aspect-[4/3] rounded-[12px] border border-[#27272A] bg-[#18181B] p-2 text-left transition hover:border-[#3F3F46]"
                        >
                          <div className="flex h-full flex-col justify-between">
                            <Plus size={18} strokeWidth={1.6} className="text-white/70" />
                            <span className="text-[12px] font-medium text-white/75">Trocar</span>
                          </div>
                        </button>
                      </div>
                    ) : null}

                    {section.id === "produtos" ? (
                      <div className="grid grid-cols-3 gap-3">
                        <button type="button" onClick={openProductsDrawer} className="aspect-[4/3] rounded-[12px] border border-[#27272A] bg-[#18181B] p-2 text-left transition hover:border-[#3F3F46]">
                          <div className="flex h-full flex-col justify-between">
                            <Package size={18} strokeWidth={1.6} className="text-white" />
                            <span className="text-[12px] font-medium text-white">Adicionar</span>
                          </div>
                        </button>
                        <button type="button" onClick={() => navigate("/catalogo")} className="aspect-[4/3] rounded-[12px] border border-[#27272A] bg-[#18181B] p-2 text-left transition hover:border-[#3F3F46]">
                          <div className="flex h-full flex-col justify-between">
                            <LayoutGrid size={18} strokeWidth={1.6} className="text-white/70" />
                            <span className="text-[12px] font-medium text-white/75">Catálogo</span>
                          </div>
                        </button>
                      </div>
                    ) : null}

                    {section.id === "imagem" ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <button type="button" onClick={()=>imageInput.current?.click()} className="aspect-[4/3] rounded-[12px] border border-[#27272A] bg-[#18181B] p-2 text-left transition hover:border-[#3F3F46]">
                            <div className="flex h-full flex-col justify-between">
                              <ImageIcon size={18} strokeWidth={1.6} className="text-white" />
                              <span className="text-[12px] font-medium text-white">Banner</span>
                            </div>
                          </button>
                          <button type="button" onClick={generateBanner} className="aspect-[4/3] rounded-[12px] border border-[#27272A] bg-[#18181B] p-2 text-left transition hover:border-[#3F3F46]">
                            <div className="flex h-full flex-col justify-between">
                              <Sparkles size={18} strokeWidth={1.6} className="text-white/75" />
                              <span className="text-[12px] font-medium text-white/75">IA</span>
                            </div>
                          </button>
                        </div>
                        <label className="block rounded-[12px] border border-[#27272A] bg-[#18181B] p-3">
                          <span className="text-[12px] font-semibold text-white/85">Link do CTA do hero</span>
                          <input value={heroCtaUrl} onChange={(event)=>setHeroCtaUrl(event.target.value)} placeholder="/catalogo ou https://..." className="mt-2 h-9 w-full rounded-[8px] border border-[#27272A] bg-[#0f0f0f] px-3 text-[12px] text-white outline-none transition placeholder:text-white/28 focus:border-white/45" />
                        </label>
                        {bannerError ? <p className="text-[11px] font-medium text-red-300">{bannerError}</p> : null}
                      </div>
                    ) : null}

                    {section.id === "aparencia" ? (
                      <div className="space-y-5">
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[12px] font-semibold text-white/85">Cor de destaque</span>
                            <span className="text-[10px] text-white/36">Botões e preços</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {["#111111","#2563eb","#dc2626","#f59e0b","#ec4899","#7c3aed"].map((color)=>(
                              <button key={color} type="button" onClick={()=>setAccent(color)} aria-label={color} className={`aspect-[4/3] rounded-[12px] bg-[#18181B] p-2 transition hover:border-[#3F3F46] ${accent===color?"border-2 border-white":"border border-[#27272A]"}`}>
                                <span className="block h-full rounded-[8px]" style={{backgroundColor:color}} />
                              </button>
                            ))}
                            <label className={`relative aspect-[4/3] cursor-pointer overflow-hidden rounded-[12px] bg-[#18181B] p-2 transition hover:border-[#3F3F46] ${!["#111111","#2563eb","#dc2626","#f59e0b","#ec4899","#7c3aed"].includes(accent) ? "border-2 border-white" : "border border-[#27272A]"}`} title="Cor personalizada">
                              <span className="block h-full rounded-[8px] bg-[conic-gradient(from_0deg,#ff0080,#ff8c00,#ffee00,#00ff85,#00b8ff,#8a2be2,#ff0080)]" />
                              <input type="color" value={accent} onChange={(e)=>setAccent(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"/>
                            </label>
                          </div>
                        </div>

                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[12px] font-semibold text-white/85">Tipografia</span>
                            <span className="text-[10px] text-white/36">1 de {fontOptions.length}</span>
                          </div>
                          <div className="space-y-2">
                            {fontOptions.map((option)=>(
                              <button key={option.name} type="button" onClick={()=>setFont(option.name)} className={`w-full rounded-[10px] bg-[#18181B] p-4 text-left transition hover:border-[#3F3F46] ${font===option.name?"border-2 border-white":"border border-[#27272A]"}`}>
                                <span className="block text-[16px] font-bold text-white" style={{fontFamily:option.stack}}>{option.name}</span>
                                <span className="mt-1 block text-[13px] text-[#A1A1AA]" style={{fontFamily:option.stack}}>abcdefghijklmnopqrstuvwxyz</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[12px] font-semibold text-white/85">Colunas da grade</span>
                            <span className="text-[10px] text-white/36">Desktop</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {[2,3,4].map((value)=>(
                              <button key={value} type="button" onClick={()=>setColumns(value)} className={`aspect-[4/3] rounded-[12px] bg-[#18181B] p-2 transition hover:border-[#3F3F46] ${columns===value?"border-2 border-white":"border border-[#27272A]"}`}>
                                <span className="grid h-full items-end gap-1" style={{gridTemplateColumns:`repeat(${value}, minmax(0,1fr))`}}>{Array.from({length:value}).map((_,index)=><span key={index} className="h-8 rounded-[4px] bg-white/25"/>)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </section>
        </aside>

        <div className="min-w-0 flex-1 overflow-auto bg-[#1f1f1d] p-3 sm:p-5">
          <div ref={previewRef} onClick={handlePreviewClick} className={`store-editor-preview relative mx-auto min-h-full overflow-hidden rounded-[24px] bg-white text-[#111] shadow-[0_30px_100px_rgba(0,0,0,0.38)] ring-1 ring-black/10 transition-all ${mobilePreview?"max-w-[390px]":"max-w-[1488px]"} ${editMode?"editor-mode-active":""}`} style={{ fontFamily: selectedFontStack, cursor: editMode==="fill"?"copy":editMode==="eraser"?"not-allowed":editMode?"pointer":"default" }}>
            {activeTemplate.kind === "produto" ? (
              activeTemplate.id === "produto-2" ? (
                <ProductTemplateBeauty
                  brand={brandName}
                  title={featuredProduct?.title || storeName}
                  description={(flow.salesAngle || "Serum leve de rapida absorcao que hidrata profundamente e deixa a pele macia e saudavel no uso diario.").slice(0, 240)}
                  price={featuredPrice}
                  originalPrice={featuredPrice * 1.25}
                  image={featuredProduct?.imageUrl || heroImage}
                  accent={accent}
                  mobile={mobilePreview}
                />
              ) : activeTemplate.id === "produto-3" ? (
                <ProductTemplateShopify
                  brand={brandName}
                  title={featuredProduct?.title || storeName}
                  description={(flow.salesAngle || "Fuja do ruido e aumente seu foco. Conforto duradouro com ANC avancado, chamadas nitidas e 30 horas de bateria.").slice(0, 240)}
                  price={featuredPrice}
                  originalPrice={featuredPrice * 1.34}
                  image={featuredProduct?.imageUrl || heroImage}
                  accent={accent}
                  mobile={mobilePreview}
                />
              ) : (
                <ProductTemplate
                  brand={brandName}
                  title={featuredProduct?.title || storeName}
                  description={(flow.salesAngle || "Confeccionado em algodao premium de alta gramatura, entrega conforto e durabilidade. A modelagem oversized e o design minimalista tornam a peca um coringa para qualquer guarda-roupa.").slice(0, 240)}
                  price={featuredPrice}
                  originalPrice={featuredPrice * 1.5}
                  image={featuredProduct?.imageUrl || heroImage}
                  accent={accent}
                  mobile={mobilePreview}
                />
              )
            ) : (
            <>
            {/* === TEMPLATE 01 - C-STYLE INSPIRED === */}
            {/* Main header */}
            <StorefrontNavbar storeName={brandName} activePage="store" className="relative z-30" />

            {/* HERO - imagem literal com overlays percentuais */}
            <section className="relative overflow-hidden bg-[#062f4e] shadow-[0_14px_34px_rgba(6,42,67,0.2)]" style={{fontFamily:selectedFontStack}}>
              <img data-editor-type="image" data-editor-id="hero-image" src={heroImage} alt="" aria-hidden="true" className="block h-auto w-full"/>

              <div className="absolute inset-0" aria-label={"Conte\u00fado do banner principal"}>
                <div className="absolute z-20 overflow-hidden bg-white text-[#1f2933]" style={{ left: "3.12%", top: "0%", width: "19.45%", height: "100%" }}>
                  <div className="flex h-[7.9%] w-full items-center border-b border-black/5 bg-white px-[5%]" style={{ fontSize: "clamp(7.5px,0.82vw,13px)" }}>
                    <div className="flex h-[68%] w-full items-center gap-[7%] rounded-[3px] bg-[#082f4b] px-[6%] text-white">
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
                </div>                <span aria-hidden="true" className="absolute z-10 bg-[#00213c]" style={{ left: "27.1%", top: "3.55%", width: "39.2%", height: "3.8%" }} />
                <span aria-hidden="true" className="absolute z-10 bg-[#042f4f]" style={{ left: "80.6%", top: "3.55%", width: "14.2%", height: "3.8%" }} />
                {heroNavLinks.map((item)=>(
                  <a key={item.label} href={item.href} className="absolute z-20 flex items-center whitespace-nowrap px-[0.15%] font-semibold leading-none text-white transition hover:text-white/75" style={{ left: item.left, top: "3.92%", width: item.width, height: "3.05%", fontSize: "clamp(9.5px,0.86vw,14px)" }}>{item.label}</a>
                ))}
                <a href="tel:+551234567890" className="absolute z-20 flex items-center whitespace-nowrap px-[0.15%] font-semibold leading-none text-white transition hover:text-white/75" style={{ left: "81.1%", top: "3.92%", width: "13.45%", height: "3.05%", fontSize: "clamp(9.5px,0.86vw,14px)" }}>Suporte: (123) 456-7890</a>

                <div className="absolute text-white" style={{ left: "27.35%", top: "50%", width: "28.4%", transform: "translateY(-50%)" }}>
                  <span data-editor-type="text" className="block font-semibold uppercase tracking-[0.08em] text-[#e8c878]" style={{ fontSize: "clamp(6.5px,0.68vw,10.5px)" }}>{categories[0] || "Novidades"}</span>
                  <h1 data-editor-type="text" className="mt-[2.8%] font-semibold leading-[1.06] tracking-[-0.012em] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.22)]" style={{ fontSize: "clamp(22px,2.55vw,44px)" }}>{headlinePrimary}<br/>{headlineSecondary}</h1>
                  <p data-editor-type="text" className="mt-[3.4%] truncate font-normal leading-none text-white/72" style={{ fontSize: "clamp(8px,0.86vw,13.5px)" }}>{heroSubtitle}</p>
                  <a href={heroCtaHref} className="mt-[5%] inline-flex items-center justify-center whitespace-nowrap rounded-[4px] bg-[#f6ead2] font-semibold text-[#102434] shadow-[0_7px_18px_rgba(0,0,0,0.15)] transition hover:-translate-y-0.5 hover:bg-white" style={{ minWidth: "36%", height: "clamp(26px,2.65vw,44px)", paddingInline: "5.5%", gap: "0.45rem", fontSize: "clamp(6.5px,0.68vw,10.5px)" }}>{ctaPrimary || "Comprar agora"}<ChevronLeft aria-hidden="true" size={10} strokeWidth={2} className="rotate-180"/></a>
                </div>

                <div className="absolute z-20 flex items-center gap-[1.2%]" style={{ left: "39.9%", top: "94.1%", width: "8.8%", height: "2.8%" }} aria-label="Carrossel do banner">
                  {[0,1,2].map((dot)=>(
                    <button key={dot} type="button" aria-label={`Banner ${dot+1}`} className="h-full flex-1 rounded-full bg-transparent" />
                  ))}
                </div>
              </div>
            </section>
            {/* BROWSE BY CATEGORY */}
            <section className="px-6 pb-7 pt-5">
              <div className="mb-4 text-center">
                <h2 className="text-[15px] font-semibold leading-none tracking-normal">Navegue por categorias</h2>
                <p className="mt-1 text-[9px] leading-none text-black/50">{"Explore cole\u00e7\u00f5es selecionadas para cada parte da sua rotina."}</p>
              </div>
              <div className="relative">
                <div className="flex w-full items-start justify-between gap-3 overflow-x-auto pb-2 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {browseCategories.map(({category,imageUrl})=>(
                    <a key={category} href="#categorias" className="group grid w-[84px] shrink-0 grid-rows-[84px_28px] justify-items-center gap-2 text-center">
                      <span className="flex h-[84px] w-[84px] items-center justify-center overflow-hidden rounded-full bg-[#f3f1ee] transition duration-300 group-hover:-translate-y-1">
                        <img data-editor-type="image" src={imageUrl} alt={category} className="h-full w-full object-contain p-2"/>
                      </span>
                      <span className="flex min-h-[24px] items-start justify-center text-[8.5px] font-medium leading-tight text-black/80">{category}</span>
                    </a>
                  ))}
                </div>
                <button type="button" aria-label="Ver mais categorias" className="absolute right-0 top-[28px] flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-[0_4px_14px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5"><ChevronLeft size={14} className="rotate-180"/></button>
              </div>
            </section>

            {/* TRENDING PRODUCTS */}
            <section className="px-6 pb-8 pt-1">
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
                        <img data-editor-type="image" src={product.imageUrl||heroImage} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>
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
            {/* PROMO BANDS */}
            <section className="grid grid-cols-1 gap-4 px-8 py-10 md:grid-cols-2">
              <div className="relative flex min-h-[220px] overflow-hidden rounded-[8px] bg-black text-white">
                <div className="relative z-10 flex flex-1 flex-col justify-between p-6">
                  <div>
                    <strong className="text-[10px] font-semibold tracking-[0.18em] text-white/70">OFERTA ESPECIAL</strong>
                    <h3 className="mt-1 text-[28px] font-semibold leading-[1.04] tracking-[-0.015em]">{"Pre\u00e7os que surpreendem"}</h3>
                    <p className="mt-2 max-w-[180px] text-[10px] text-white/55">{"Encontre produtos selecionados com condi\u00e7\u00f5es especiais por tempo limitado."}</p>
                  </div>
                  <button className="mt-4 w-fit rounded-full bg-white px-4 py-1.5 text-[9.5px] font-medium text-black">Ver ofertas</button>
                </div>
                <div className="relative w-[44%] shrink-0 overflow-hidden"><img data-editor-type="image" src={displayedProducts[1%displayedProducts.length]?.imageUrl||heroImage} alt="" className="absolute inset-0 h-full w-full object-cover object-center"/></div>
              </div>
              <div className="relative flex min-h-[220px] overflow-hidden rounded-[8px] bg-[#eeece7]">
                <div className="relative z-10 flex flex-1 flex-col justify-between p-6">
                  <div>
                    <strong className="text-[10px] font-semibold tracking-[0.18em] text-black/50">ACABOU DE CHEGAR</strong>
                    <h3 className="mt-1 text-[28px] font-semibold leading-[1.04] tracking-[-0.015em]">{"Novidades para voc\u00ea"}</h3>
                    <p className="mt-2 max-w-[180px] text-[10px] text-black/55">{"Explore os lan\u00e7amentos mais recentes de todas as categorias da loja."}</p>
                  </div>
                  <button className="mt-4 w-fit rounded-full bg-black px-4 py-1.5 text-[9.5px] font-medium text-white">Conhecer novidades</button>
                </div>
                <div className="relative w-[44%] shrink-0 overflow-hidden"><img data-editor-type="image" src={displayedProducts[2%displayedProducts.length]?.imageUrl||heroImage} alt="" className="absolute inset-0 h-full w-full object-cover object-center"/></div>
              </div>
            </section>

            {/* FEATURED COLLECTIONS */}
            <section className="px-8 pb-6 pt-10">
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

            <section aria-label="Benef\u00edcios da loja" className="mx-8 mb-8 overflow-hidden rounded-[10px] bg-[#06263b] text-white shadow-[0_14px_30px_rgba(2,20,32,0.14)]">
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

            <footer className="border-t border-black/10 bg-[#f5f4f2] px-8 py-7 text-center text-[10px] tracking-[0.12em] text-black/45">{"\u00a9"} {new Date().getFullYear()} {brandName} {"\u00b7"} Todos os direitos reservados</footer>
            </>
            )}

          </div>

          {selectedElement?.type === "image" ? (
            <div
              data-editor-ignore
              className="fixed z-50 flex flex-col items-center gap-2 rounded-full bg-[#090909] p-2 text-white shadow-[0_22px_55px_rgba(0,0,0,0.38)] ring-1 ring-white/12"
              style={{ top: selectedToolbarTop, left: selectedToolbarLeft }}
            >
              <button type="button" onClick={()=>setMediaModalOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/12" aria-label="Editar imagem">
                <Pencil size={22} strokeWidth={2.1} />
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
              style={{ top: selectedToolbarTop, left: selectedToolbarLeft }}
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
                <input type="color" value={contextControls.color.startsWith("rgb") ? fillColor : contextControls.color} onChange={(event)=>applyElementColor(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <span className="h-8 w-px bg-white/12" />
              <button type="button" onClick={deleteSelectedElement} className="flex h-11 w-11 items-center justify-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-white" aria-label="Excluir ícone"><Trash2 size={22}/></button>
              <button type="button" onClick={clearSelection} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/75 transition hover:bg-white/18 hover:text-white" aria-label="Fechar toolbar"><X size={23}/></button>
            </div>
          ) : null}

          {selectedElement?.type === "text" ? (
            <div
              data-editor-ignore
              className="fixed z-50 flex min-h-[62px] items-center gap-3 rounded-[18px] bg-[#101010] px-4 py-2.5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.38)] ring-1 ring-white/12"
              style={{ top: selectedToolbarTop, left: selectedToolbarLeft }}
            >
              <button type="button" onClick={()=>handleAiPlaceholder("Reescrever texto com IA")} className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-[18px] font-semibold transition hover:bg-white/16">
                <Sparkles size={22} />
                Reescrever
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
                <input type="color" value={contextControls.color.startsWith("rgb") ? fillColor : contextControls.color} onChange={(event)=>applyElementColor(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <button type="button" onClick={clearSelection} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/75 transition hover:bg-white/18 hover:text-white" aria-label="Fechar toolbar"><X size={23}/></button>
            </div>
          ) : null}

          {contextNotice ? (
            <div data-editor-ignore className="fixed bottom-6 left-1/2 z-[60] max-w-[440px] -translate-x-1/2 rounded-full bg-[#101010] px-5 py-3 text-center text-[12px] font-medium text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
              {contextNotice}
              <button type="button" onClick={()=>setContextNotice(null)} className="ml-3 text-white/55 hover:text-white">Fechar</button>
            </div>
          ) : null}

          <div data-editor-ignore className={`pointer-events-none sticky z-30 mt-4 flex w-full gap-3 ${toolbarOrientation === "vertical" ? "bottom-6 justify-end pr-4" : "bottom-4 flex-col items-center"}`}>
            {editMode === "fill" && selectedPath && fillPickerOpen ? (
              <div className={`pointer-events-auto rounded-[18px] bg-[#101010] p-3 text-white shadow-[0_16px_42px_rgba(0,0,0,0.28)] ${toolbarOrientation === "vertical" ? "mr-2 self-center" : "mb-1"}`}>
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
            <div className={`pointer-events-auto flex items-center gap-1 rounded-full bg-[#101010] p-1.5 text-white shadow-[0_18px_44px_rgba(0,0,0,0.26)] ring-1 ring-white/10 ${toolbarOrientation === "vertical" ? "flex-col" : "flex-row"}`}>
              {toolbarTools.map((tool)=>{
                const Icon = tool.icon;
                const isActive = editMode === tool.id;
                return (
                  <button key={tool.id} type="button" onClick={()=>handleToolbarToolClick(tool.id)} aria-label={tool.label} className={`relative flex h-10 w-10 items-center justify-center rounded-full transition ${isActive?"bg-white text-black shadow-[0_5px_16px_rgba(255,255,255,0.22)]":"text-white hover:bg-white/10"}`}>
                    <Icon size={21} strokeWidth={2.2} />
                    {isActive ? (
                      <span className={`pointer-events-none absolute rounded-full bg-[#101010] px-3 py-1 text-[11px] font-semibold leading-none text-white shadow-[0_8px_22px_rgba(0,0,0,0.22)] ${toolbarOrientation === "vertical" ? "right-[calc(100%+10px)] top-1/2 -translate-y-1/2" : "left-1/2 top-[calc(100%+9px)] -translate-x-1/2"}`}>
                        {activeToolbarTool?.label}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>


        </div>
      </div>

      {mediaModalOpen && selectedElement?.type === "image" ? (
        <div
          data-editor-ignore
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onMouseDown={(event)=>{if(event.target===event.currentTarget)setMediaModalOpen(false)}}
        >
          <section className="w-full max-w-[560px] overflow-hidden rounded-[20px] border border-white/12 bg-[#101010] text-white shadow-[0_35px_120px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="text-[17px] font-semibold">Escolher mídia</h2>
                <p className="mt-1 text-[11px] text-white/45">Troque a imagem e ajuste o formato direto no preview.</p>
              </div>
              <button type="button" onClick={()=>setMediaModalOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white/70 transition hover:bg-white/14 hover:text-white" aria-label="Fechar mídia">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <div className="relative overflow-hidden rounded-[14px] border border-white/10 bg-black">
                {selectedMediaSrc ? (
                  <img
                    src={selectedMediaSrc}
                    alt=""
                    className="h-[260px] w-full object-cover"
                    style={{
                      aspectRatio: contextControls.imageShape === "wide" ? "16 / 9" : contextControls.imageShape === "auto" ? undefined : "1 / 1",
                      borderRadius: contextControls.imageShape === "circle" ? 999 : undefined,
                    }}
                  />
                ) : (
                  <div className="grid h-[260px] place-items-center text-[13px] text-white/45">Nenhuma imagem selecionada</div>
                )}
                <button type="button" onClick={()=>contextMediaInput.current?.click()} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[10px] bg-black/72 px-5 py-3 text-[14px] font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.28)] transition hover:bg-black/86">
                  Escolher mídia
                </button>
              </div>
              <button type="button" onClick={()=>handleAiPlaceholder("Editar imagem com IA")} className="mt-4 flex h-14 w-full items-center justify-center gap-3 rounded-[12px] bg-white/[0.12] text-[18px] font-semibold transition hover:bg-white/[0.18]">
                <Sparkles size={22} />
                Editar com IA
              </button>
              <div className="mt-4 rounded-[13px] bg-white/[0.055] p-2">
                <div className="grid grid-cols-4 gap-2">
                  {imageShapeOptions.map(({ value, label, icon: ShapeIcon }) => (
                    <button key={value} type="button" onClick={()=>handleImageShapeChange(value)} className={`flex h-12 items-center justify-center gap-2 rounded-[10px] text-[11px] font-semibold transition ${contextControls.imageShape===value?"bg-white text-black":"text-white/58 hover:bg-white/10 hover:text-white"}`}>
                      <ShapeIcon size={17} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={()=>setMediaModalOpen(false)} className="mt-5 h-11 w-full rounded-[11px] bg-white text-[13px] font-semibold text-black transition hover:bg-white/90">
                Aplicar
              </button>
            </div>
          </section>
        </div>
      ) : null}


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
                  <div className="flex flex-wrap items-center gap-3 p-5"><span className="h-4 w-4 rounded-full bg-[#1597f4] ring-4 ring-[#1597f4]/15"/><strong className="text-[18px]">Velo <em>PRO</em></strong><del className="ml-auto text-[20px] text-white/25">R$ 99,90</del><span className="rounded-[9px] bg-white/[0.08] px-3 py-2 text-[26px] font-semibold tracking-[-0.04em]">R$ 64,94 <small className="text-[11px] font-normal text-white/45">{"/m\u00eas"}</small></span></div>
                  <div className="flex items-center justify-between border-t border-white/15 bg-white/[0.05] px-5 py-3"><span className="text-[13px]"><strong className="text-orange-400">-35%</strong> com o {"c\u00f3digo"}</span><strong className="rounded-[6px] bg-[#f97316] px-4 py-2 text-[15px]">COPA</strong></div>
                </div>
                <div className="mt-5 flex items-start gap-3 rounded-[15px] bg-[#332e16] p-5"><Gift className="shrink-0 text-[#facc15]" size={22}/><div><strong className="text-[14px] text-[#f7d978]">{"Dom\u00ednio gr\u00e1tis com seu plano PRO!"}</strong><p className="mt-1 text-[11px] leading-relaxed text-white/45">{"Lance sua marca com um dom\u00ednio inclu\u00eddo no plano Velo Pro."}</p></div></div>
                <div className="mt-auto pt-8"><div className="rounded-[13px] bg-white/[0.055] p-5"><div className="text-[18px] tracking-[0.08em] text-[#facc15]">{"\u2605\u2605\u2605\u2605\u2605"}</div><p className="mt-3 text-[12px] leading-relaxed text-white/55">{"Editor completo, gera\u00e7\u00e3o com IA e suporte para publicar sua primeira loja."}</p></div><button type="button" onClick={()=>navigate("/checkout?plan=pro&promo=COPA")} className="mt-4 h-[58px] w-full rounded-[13px] bg-gradient-to-r from-[#0ea5e9] to-[#2563eb] text-[17px] font-semibold shadow-[0_12px_30px_rgba(14,165,233,0.26)] transition hover:brightness-110">Continuar com Pro&nbsp; {"\u2192"}</button><p className="mt-3 text-center text-[11px] text-white/40">Cancele a qualquer momento {"\u00b7"} Suporte 24/7</p></div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {contextDrawer ? (
        <div
          className="fixed inset-0 z-[55] bg-black/35 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setContextDrawer(null);
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
                  {contextDrawer === "template" ? "Trocar template" : "Adicionar produtos"}
                </h2>
                <p className="mt-1 truncate text-[11px] text-white/40">
                  {contextDrawer === "template" ? "Escolha uma base visual para a loja." : "Selecione produtos do catálogo Velo."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setContextDrawer(null)}
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
                <div className="grid grid-cols-2 gap-3">
                  {drawerProducts.map((product) => {
                    const selected = draftProductId === product.id;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setDraftProductId(product.id)}
                        className={`overflow-hidden rounded-[12px] bg-[#18181B] text-left transition hover:border-[#3F3F46] ${
                          selected ? "border-2 border-white" : "border border-[#27272A]"
                        }`}
                      >
                        <div className="relative aspect-[4/3] bg-white">
                          {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-contain p-3" /> : <div className="grid h-full place-items-center text-black/30"><Package size={24} /></div>}
                          {selected ? <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-black shadow-lg"><Check size={13} /></span> : null}
                        </div>
                        <div className="p-3">
                          <strong className="line-clamp-2 text-[12px] font-semibold leading-snug text-white">{product.title}</strong>
                          <span className="mt-1 block text-[11px] text-white/42">{formatBRL(product.price)}</span>
                        </div>
                      </button>
                    );
                  })}
                  {!drawerProducts.length ? (
                    <div className="col-span-2 rounded-[12px] border border-dashed border-[#27272A] p-5 text-center text-[12px] text-white/45">
                      Nenhum produto disponível nesta coleção.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <footer className="border-t border-[#27272A] p-4">
              <button
                type="button"
                onClick={contextDrawer === "template" ? applyTemplateDraft : applyProductDraft}
                className="h-11 w-full rounded-[8px] bg-[#2f6df6] text-[13px] font-semibold text-white shadow-[0_12px_28px_rgba(47,109,246,0.24)] transition hover:brightness-110"
              >
                {contextDrawer === "template" ? "Aplicar" : "Adicionar"}
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </main>
  );
};

export default GeneratedStoreEditorPage;
