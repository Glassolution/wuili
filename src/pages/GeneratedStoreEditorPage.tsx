import { useEffect, useMemo, useRef, useState } from "react";
import { Baby, BookOpen, Boxes, Car, Check, ChevronLeft, Dumbbell, Gamepad2, Gem, Gift, GitCompareArrows, Headphones, Heart, HeartPulse, History, Home, Laptop, LayoutGrid, LayoutTemplate, Menu, MessageSquare, Monitor, MoreHorizontal, MousePointer2, Package, Palette, PawPrint, Pencil, Play, Plus, Search, Settings, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Star, Type, X } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { useAuth } from "@/contexts/AuthContext";
import { getSavedStoreFlow, markStoreFlowCompleted } from "@/lib/storeFlowCompletion";
import { formatReviewCount } from "@/components/dashboard/ProductCard";

const getMockRating = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const rating = (4 + (Math.abs(hash) % 10) / 10).toFixed(1);
  const reviewCount = 50 + (Math.abs(hash) % 950);
  return { rating, reviewCount };
};

type FlowState = { product: ExampleProduct; language: string; persona: string; salesAngle: string };
type CatalogItem = ExampleProduct & { category: string; rating?: number; averageRating?: number; ratingCount?: string | number; reviewCount?: string | number; reviewsCount?: string | number };
type EditorPanel = "template" | null;

const getFirstImage = (images: unknown) => {
  if (Array.isArray(images)) return images.find((image): image is string => typeof image === "string" && image.trim().length > 0) || "";
  if (typeof images === "string") { try { return getFirstImage(JSON.parse(images)); } catch { return images; } }
  return "";
};
const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

const mockStudioImage = (variant: string, accent = "#111827") => {
  const objects: Record<string, string> = {
    lamp: `<g><rect x="136" y="116" width="48" height="92" rx="18" fill="${accent}"/><path d="M112 110h96l-18-42h-60z" fill="#f8fafc" stroke="${accent}" stroke-width="8"/><rect x="116" y="214" width="88" height="14" rx="7" fill="#cbd5e1"/></g>`,
    headphones: `<g><path d="M88 165c0-48 34-86 72-86s72 38 72 86" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round"/><rect x="66" y="154" width="46" height="72" rx="18" fill="${accent}"/><rect x="208" y="154" width="46" height="72" rx="18" fill="${accent}"/><path d="M116 225c28 16 60 16 88 0" fill="none" stroke="#94a3b8" stroke-width="10" stroke-linecap="round"/></g>`,
    backpack: `<g><rect x="98" y="86" width="124" height="154" rx="30" fill="${accent}"/><path d="M118 112h84" stroke="#f8fafc" stroke-width="10" stroke-linecap="round" opacity=".55"/><rect x="120" y="164" width="80" height="52" rx="16" fill="#f8fafc" opacity=".22"/><path d="M98 142c-24 12-32 40-20 70" fill="none" stroke="#64748b" stroke-width="12" stroke-linecap="round"/><path d="M222 142c24 12 32 40 20 70" fill="none" stroke="#64748b" stroke-width="12" stroke-linecap="round"/></g>`,
    jewelry: `<g><circle cx="160" cy="156" r="54" fill="none" stroke="${accent}" stroke-width="10"/><circle cx="160" cy="218" r="22" fill="#f8fafc" stroke="${accent}" stroke-width="8"/><circle cx="128" cy="112" r="10" fill="#cbd5e1"/><circle cx="192" cy="112" r="10" fill="#cbd5e1"/></g>`,
    bottle: `<g><rect x="134" y="78" width="52" height="24" rx="8" fill="#94a3b8"/><rect x="122" y="98" width="76" height="146" rx="28" fill="${accent}"/><path d="M138 126h44" stroke="#f8fafc" stroke-width="8" stroke-linecap="round" opacity=".5"/><path d="M138 188h44" stroke="#f8fafc" stroke-width="8" stroke-linecap="round" opacity=".25"/></g>`,
    skincare: `<g><rect x="100" y="104" width="54" height="128" rx="18" fill="#f8fafc" stroke="${accent}" stroke-width="8"/><rect x="170" y="80" width="54" height="152" rx="18" fill="${accent}"/><circle cx="127" cy="82" r="18" fill="#cbd5e1"/><path d="M185 116h24" stroke="#f8fafc" stroke-width="7" stroke-linecap="round" opacity=".55"/></g>`,
    chair: `<g><rect x="102" y="98" width="116" height="74" rx="18" fill="${accent}"/><rect x="122" y="170" width="76" height="48" rx="14" fill="#94a3b8"/><path d="M122 222l-18 36M198 222l18 36" stroke="#64748b" stroke-width="10" stroke-linecap="round"/></g>`,
    teddy: `<g><circle cx="160" cy="156" r="54" fill="${accent}"/><circle cx="116" cy="112" r="26" fill="${accent}"/><circle cx="204" cy="112" r="26" fill="${accent}"/><circle cx="142" cy="148" r="7" fill="#f8fafc"/><circle cx="178" cy="148" r="7" fill="#f8fafc"/><ellipse cx="160" cy="174" rx="24" ry="18" fill="#f8fafc" opacity=".75"/><rect x="112" y="206" width="96" height="38" rx="19" fill="${accent}"/></g>`,
    pet: `<g><circle cx="122" cy="124" r="22" fill="${accent}"/><circle cx="198" cy="124" r="22" fill="${accent}"/><circle cx="160" cy="112" r="24" fill="${accent}"/><circle cx="116" cy="184" r="26" fill="${accent}"/><circle cx="204" cy="184" r="26" fill="${accent}"/><path d="M126 214c18-34 50-34 68 0" fill="${accent}"/></g>`,
    wheel: `<g><circle cx="160" cy="160" r="72" fill="none" stroke="${accent}" stroke-width="18"/><circle cx="160" cy="160" r="22" fill="${accent}"/><path d="M160 92v136M92 160h136M112 112l96 96M208 112l-96 96" stroke="#94a3b8" stroke-width="8" stroke-linecap="round"/></g>`,
    sneakers: `<g><path d="M78 184c42 0 62-34 88-64 22 28 44 50 84 54 8 22-5 42-30 42H92c-20 0-28-12-14-32z" fill="${accent}"/><path d="M104 184h128" stroke="#f8fafc" stroke-width="8" stroke-linecap="round" opacity=".6"/><path d="M142 146l30 20" stroke="#f8fafc" stroke-width="7" stroke-linecap="round" opacity=".55"/></g>`,
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><defs><radialGradient id="bg" cx="50%" cy="34%" r="70%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#f2f4f7"/></radialGradient><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#0f172a" flood-opacity="0.12"/></filter></defs><rect width="320" height="320" fill="url(#bg)"/><ellipse cx="160" cy="254" rx="86" ry="18" fill="#d8dee7" opacity="0.55"/><g filter="url(#shadow)">${objects[variant] || objects.lamp}</g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const previewFallbackProducts: CatalogItem[] = [
  { id: "preview-casa-01", title: "Lumin\u00e1ria de Mesa Minimalista", price: 89.9, category: "Casa", imageUrl: mockStudioImage("lamp", "#334155") },
  { id: "preview-eletronicos-01", title: "Fone Bluetooth Compacto", price: 52.9, category: "Eletr\u00f4nicos", imageUrl: mockStudioImage("headphones", "#111827") },
  { id: "preview-moda-01", title: "Mochila Urbana Imperme\u00e1vel", price: 134.9, category: "Moda", imageUrl: mockStudioImage("backpack", "#1e3a8a") },
  { id: "preview-bijuterias-01", title: "Colar Dourado Delicado", price: 39.9, category: "Bijuterias", imageUrl: mockStudioImage("jewelry", "#475569") },
  { id: "preview-beleza-01", title: "Kit Skincare Di\u00e1rio", price: 76.9, category: "Beleza", imageUrl: mockStudioImage("skincare", "#64748b") },
  { id: "preview-esporte-01", title: "Garrafa T\u00e9rmica Fitness", price: 48.9, category: "Esporte e Fitness", imageUrl: mockStudioImage("bottle", "#0f766e") },
];

const categoryPreviewImages: Record<string, string> = {
  Casa: mockStudioImage("lamp", "#334155"),
  "Eletr\u00f4nicos": mockStudioImage("headphones", "#111827"),
  Moda: mockStudioImage("backpack", "#1e3a8a"),
  Bijuterias: mockStudioImage("jewelry", "#475569"),
  "Decora\u00e7\u00e3o": mockStudioImage("chair", "#64748b"),
  "Beb\u00ea e Infantil": mockStudioImage("teddy", "#8b5e3c"),
  Pet: mockStudioImage("pet", "#334155"),
  Beleza: mockStudioImage("skincare", "#64748b"),
  "Sa\u00fade e Bem-estar": mockStudioImage("bottle", "#0f766e"),
  "Esporte e Fitness": mockStudioImage("wheel", "#111827"),
  Outros: mockStudioImage("sneakers", "#475569"),
};
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

type EditMode = "select" | "text" | "edit" | "comment" | null;
type Comment = { id: string; x: number; y: number; text: string; open: boolean };

const GeneratedStoreEditorPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const imageInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [panel, setPanel] = useState<EditorPanel>(null);
  const [accent, setAccent] = useState("#111111");
  const [font, setFont] = useState("Geist");
  const [columns, setColumns] = useState(3);
  const [heroImage, setHeroImage] = useState("/hero-pasted-image-2.png");
  const [heroCtaUrl, setHeroCtaUrl] = useState("/catalogo");
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [storeName, setStoreName] = useState("Velo");
  const [showPlans, setShowPlans] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState("Velo Modern");
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
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

  const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!editMode || !previewRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-editor-ignore]")) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = previewRef.current.getBoundingClientRect();

    if (editMode === "comment") {
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      setComments((prev) => [...prev, { id: crypto.randomUUID(), x, y, text: "", open: true }]);
      return;
    }
    if (editMode === "select") {
      setSelectedPath(getElementPath(target, previewRef.current));
      return;
    }
    if ((editMode === "text" || editMode === "edit") && target.textContent?.trim()) {
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
    }
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

      const [{ data: profile }, { data: collectionProducts }] = await Promise.all([
        supabase.from("profiles").select("store_name,loja_nome").eq("user_id", userId).maybeSingle(),
        supabase
          .from("collection_products")
          .select("added_at,collections!inner(user_id),catalog_products!inner(id,title,cost_price,images,category,is_active,is_blocked,stock_quantity)")
          .eq("collections.user_id", userId)
          .eq("catalog_products.is_active", true)
          .eq("catalog_products.is_blocked", false)
          .gt("catalog_products.stock_quantity", 0)
          .order("added_at", { ascending: false })
          .limit(12),
      ]);

      if (!mounted) return;
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
  const baseProducts = products.length ? products : [];
  const displayedProducts = [...baseProducts, ...previewFallbackProducts.filter((fallback) => !baseProducts.some((product) => product.id === fallback.id))].slice(0, Math.max(6, baseProducts.length));
  const categories = Array.from(new Set(displayedProducts.map((product) => product.category).filter(Boolean))).slice(0, 8);
  const browseCategories = catalogTaxonomy.map((category, index) => ({
    category,
    imageUrl: displayedProducts.find((product) => product.category === category)?.imageUrl || categoryPreviewImages[category] || displayedProducts[index % displayedProducts.length]?.imageUrl || heroImage,
  }));
  const menuCategories = catalogTaxonomy;
  const sidebarIconCategories = catalogTaxonomy.slice(0, 10);
  const sidebarExtraCategories = catalogTaxonomy.slice(10);
  const heroNavLinks = [
    { label: "Loja", href: "#", left: "27.85%", width: "4.25%" },
    { label: "Ofertas", href: "#ofertas", left: "35.82%", width: "4.4%" },
    { label: "Novidades", href: "#novidades", left: "44.18%", width: "4.75%" },
    { label: "Marcas", href: "#marcas", left: "52.58%", width: "4.25%" },
    { label: "Inspira\u00e7\u00e3o", href: "#inspiracao", left: "60.6%", width: "5.8%" },
  ];
  const categoryHighlights = Array.from({ length: 4 }, (_, index) => {
    const category = categories[index % categories.length] || displayedProducts[index % displayedProducts.length]?.category || "Outros";
    return {
      category,
      imageUrl: displayedProducts.find((product) => product.category === category)?.imageUrl || heroImage,
      key: `${category}-${index}`,
    };
  });
  const brandName = storeName;
  const brandInitial = brandName.charAt(0);
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
  const selectedFontStack = fontOptions.find((option) => option.name === font)?.stack || fontOptions[0].stack;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#050505] text-white" style={{ fontFamily: selectedFontStack }}>
      <style>{`.editor-mode-active *:hover{outline:1.5px dashed #2563eb;outline-offset:2px;cursor:pointer}.editor-mode-active [data-editor-ignore],.editor-mode-active [data-editor-ignore] *{outline:none!important;cursor:default}`}</style>
      <header className="flex h-[72px] shrink-0 items-center justify-between px-5">

        <div className="flex items-center gap-4"><button type="button" onClick={() => history.back()} className="text-white/55 hover:text-white"><ChevronLeft /></button><button type="button" onClick={()=>setPanel(panel==="template"?null:"template")} className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition ${panel==="template"?"bg-white/15 text-white":"bg-white/[0.07] text-white/60 hover:text-white"}`} aria-label="Editar template"><MoreHorizontal size={18}/></button><div><strong className="block text-[14px]">{storeName}</strong><span className="text-[10px] text-white/30">Template 01 {"\u00b7"} {currentTemplate}</span></div></div>
        <div className="flex items-center gap-2"><div className="flex rounded-[9px] bg-white/[0.06] p-1"><button onClick={()=>setMobilePreview(false)} className={`flex h-9 w-12 items-center justify-center rounded-[7px] ${!mobilePreview?"bg-white/15":"text-white/35"}`}><Monitor size={17}/></button><button onClick={()=>setMobilePreview(true)} className={`flex h-9 w-12 items-center justify-center rounded-[7px] ${mobilePreview?"bg-white/15":"text-white/35"}`}><Smartphone size={17}/></button></div><button className="p-3 text-white/45"><Settings size={18}/></button><button className="p-3 text-white/45"><Play size={18}/></button><button className="p-3 text-white/45"><History size={18}/></button><div className="relative ml-1 pb-2"><button onClick={()=>setShowPlans(true)} className="relative min-w-[112px] overflow-hidden rounded-[9px] bg-gradient-to-r from-[#3b82f6] via-[#2563eb] to-[#1d4ed8] px-5 pb-3 pt-2 text-[13px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_6px_18px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:brightness-110"><span className="relative z-10">Publicar</span><span className="absolute inset-x-0 top-0 h-px bg-white/45" /></button><span className="absolute -bottom-0.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-b from-[#fde047] to-[#facc15] px-3 py-1 text-[8px] font-extrabold tracking-[0.02em] text-[#5b4300] shadow-[0_2px_7px_rgba(0,0,0,0.38)]">{"DOM\u00cdNIO GR\u00c1TIS"}</span></div></div>
      </header>

      <div className="flex min-h-0 flex-1">
        <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(event)=>{const file=event.target.files?.[0];if(file)setHeroImage(URL.createObjectURL(file));}}/>
        {panel==="template" ? (
          <aside className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-[#0b0b0b]">
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <div><strong className="block text-[14px]">Personalizar template</strong><span className="text-[10.5px] text-white/40">Ajuste a cara da sua loja</span></div>
              <button onClick={()=>setPanel(null)} className="text-white/40 hover:text-white"><X size={16}/></button>
            </div>

            <div className="space-y-3 px-5 pb-6">
              {/* Acoes principais */}
              <button type="button" onClick={()=>setShowTemplates(true)} className="group flex w-full items-center gap-3 rounded-[13px] bg-white/[0.05] p-3 text-left transition hover:bg-white/[0.09]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] shadow-[0_6px_16px_rgba(37,99,235,0.35)]"><LayoutTemplate size={20}/></span>
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Trocar template</span><span className="block text-[11px] text-white/45">Atual: {currentTemplate}</span></span>
                <ChevronLeft size={14} className="rotate-180 text-white/35" />
              </button>

              <button type="button" onClick={()=>navigate("/catalogo")} className="group flex w-full items-center gap-3 rounded-[13px] bg-white/[0.05] p-3 text-left transition hover:bg-white/[0.09]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#f97316] to-[#c2410c] shadow-[0_6px_16px_rgba(249,115,22,0.35)]"><Package size={20}/></span>
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Adicionar produtos</span><span className="block text-[11px] text-white/45">Escolha do cat\u00e1logo Velo</span></span>
                <Plus size={14} className="text-white/35" />
              </button>

              <button type="button" onClick={()=>imageInput.current?.click()} className="group flex w-full items-center gap-3 rounded-[13px] bg-white/[0.05] p-3 text-left transition hover:bg-white/[0.09]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#a855f7] to-[#6d28d9] shadow-[0_6px_16px_rgba(168,85,247,0.35)]"><Sparkles size={20}/></span>
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Imagem principal</span><span className="block text-[11px] text-white/45">Envie a foto do banner</span></span>
                <Plus size={14} className="text-white/35" />
              </button>
              <label className="block rounded-[13px] border border-white/10 bg-white/[0.035] p-3">
                <span className="text-[12px] font-semibold text-white/75">Link do CTA do hero</span>
                <input value={heroCtaUrl} onChange={(event)=>setHeroCtaUrl(event.target.value)} placeholder="/catalogo ou https://..." className="mt-2 h-9 w-full rounded-[9px] border border-white/10 bg-black/30 px-3 text-[12px] text-white outline-none transition placeholder:text-white/25 focus:border-white/35" />
              </label>
            </div>

            <div className="mx-5 border-t border-white/[0.06]" />

            <div className="space-y-6 px-5 py-6">
              {/* Cor de destaque */}
              <div>
                <div className="flex items-center gap-2"><Palette size={13} className="text-white/55"/><strong className="text-[12px]">Cor de destaque</strong></div>
                <p className="mt-1 text-[10.5px] text-white/40">Usada em bot\u00f5es, pre\u00e7os e tags.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {["#111111","#2563eb","#dc2626","#16a34a","#f59e0b","#ec4899","#7c3aed"].map((color)=>(
                    <button key={color} type="button" onClick={()=>setAccent(color)} aria-label={color} className={`relative h-8 w-8 rounded-full transition ${accent===color?"ring-2 ring-white ring-offset-2 ring-offset-[#0b0b0b]":"ring-1 ring-white/10"}`} style={{backgroundColor:color}}>{accent===color?<Check size={13} className="absolute inset-0 m-auto text-white drop-shadow"/>:null}</button>
                  ))}
                  <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full ring-1 ring-white/15" title="Cor personalizada">
                    <span className="absolute inset-0 bg-[conic-gradient(from_0deg,#ff0080,#ff8c00,#ffee00,#00ff85,#00b8ff,#8a2be2,#ff0080)]" />
                    <input type="color" value={accent} onChange={(e)=>setAccent(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"/>
                  </label>
                </div>
              </div>

              {/* Tipografia */}
              <div>
                <div className="flex items-center gap-2"><Type size={13} className="text-white/55"/><strong className="text-[12px]">Tipografia</strong></div>
                <p className="mt-1 text-[10.5px] text-white/40">{"Fonte dos t\u00edtulos e textos da loja."}</p>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {fontOptions.map((option)=>(
                    <button key={option.name} type="button" onClick={()=>setFont(option.name)} className={`flex items-center justify-between rounded-[11px] border p-3 text-left transition ${font===option.name?"border-white/70 bg-white/[0.08]":"border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                      <span><span className="block text-[15px]" style={{fontFamily:option.stack}}>{option.name}</span><span className="block text-[10.5px] text-white/40">{option.mood}</span></span>
                      {font===option.name?<Check size={14} className="text-white"/>:null}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colunas */}
              <div>
                <div className="flex items-center gap-2"><LayoutGrid size={13} className="text-white/55"/><strong className="text-[12px]">Colunas da grade</strong></div>
                <p className="mt-1 text-[10.5px] text-white/40">Quantos produtos por linha no desktop.</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[2,3,4].map((value)=>(
                    <button key={value} type="button" onClick={()=>setColumns(value)} className={`flex flex-col items-center gap-2 rounded-[11px] border p-3 transition ${columns===value?"border-white/70 bg-white/[0.08]":"border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                      <span className={`grid w-full gap-1`} style={{gridTemplateColumns:`repeat(${value}, minmax(0,1fr))`}}>{Array.from({length:value}).map((_,index)=><span key={index} className="h-6 rounded-[3px] bg-white/25"/>)}</span>
                      <span className="text-[10.5px] text-white/55">{value} colunas</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        ) : null}

        <div className="relative min-w-0 flex-1 overflow-auto rounded-tl-[18px] bg-[#111] p-3 sm:p-5">
          <div ref={previewRef} onClick={handlePreviewClick} className={`relative mx-auto min-h-full overflow-hidden bg-white text-[#111] shadow-[0_30px_100px_rgba(0,0,0,0.5)] transition-all ${mobilePreview?"max-w-[390px]":"max-w-[1180px]"} ${editMode?"editor-mode-active":""}`} style={{ fontFamily: selectedFontStack, cursor: editMode==="comment"?"crosshair":editMode?"pointer":"default" }}>
            {/* === TEMPLATE 01 - C-STYLE INSPIRED === */}
            {/* Main header */}
            <nav className="flex flex-wrap items-center gap-4 bg-white py-3 pr-5">
              <div className="box-border flex items-center gap-2 px-5" style={{ marginLeft: "3.12%", width: "19.45%" }}>
                <span className="relative flex h-9 w-8 items-center justify-center">
                  <ShoppingBag size={29} strokeWidth={1.55} className="text-[#071f35]"/>
                  <span className="absolute top-[9px] text-[10px] font-bold leading-none text-[#071f35]">{brandInitial}</span>
                </span>
                <span className="leading-none">
                  <strong className="block text-[18px] font-semibold tracking-normal text-[#071f35]">{brandName}</strong>
                  <span className="block text-[7px] font-semibold tracking-normal text-black/45">Escolhas para voc\u00ea.</span>
                </span>
              </div>
              <div className="order-3 flex h-9 w-full flex-1 items-center overflow-hidden border border-black/10 bg-[#f7f7f7] text-[10px] text-black/50 md:order-none md:min-w-[300px]">
                <label className="flex min-w-0 flex-1 items-center gap-2 px-3">
                  <Search size={13} strokeWidth={1.6} className="shrink-0 text-black/45"/>
                  <input placeholder="Buscar produtos, marcas e mais..." className="w-full bg-transparent outline-none placeholder:text-black/40"/>
                </label>
                <button type="button" aria-label="Buscar" className="flex h-full w-12 shrink-0 items-center justify-center bg-[#082f4b] text-white transition hover:bg-[#061f33]">
                  <Search size={17} strokeWidth={1.8}/>
                </button>
              </div>
              <div className="ml-auto flex items-center gap-5 text-[#071f35]">
                {[
                  { icon: Heart, label: "Favoritos" },
                  { icon: GitCompareArrows, label: "Comparar" },
                ].map(({ icon: Icon, label })=>(
                  <button key={label} type="button" className="hidden flex-col items-center gap-0.5 text-[8px] font-medium text-black/75 sm:flex">
                    <Icon size={15} strokeWidth={1.55}/>
                    <span>{label}</span>
                  </button>
                ))}
                <button type="button" className="relative flex flex-col items-center gap-0.5 text-[8px] font-medium text-black/75">
                  <ShoppingBag size={16} strokeWidth={1.55}/>
                  <span>Carrinho</span>
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#082f4b] px-1 text-[8px] font-bold text-white">0</span>
                </button>
              </div>
            </nav>

            {/* HERO - imagem literal com overlays percentuais */}
            <section className="relative overflow-hidden bg-[#062f4e] shadow-[0_14px_34px_rgba(6,42,67,0.2)]" style={{fontFamily:selectedFontStack}}>
              <img src={heroImage} alt="" aria-hidden="true" className="block h-auto w-full"/>

              <div className="absolute inset-0" aria-label={"Conte\u00fado do banner principal"}>
                <div className="absolute z-20 overflow-hidden bg-white text-[#1f2933]" style={{ left: "3.12%", top: "0%", width: "19.45%", height: "100%" }}>
                  <div className="flex h-[7.3%] w-full items-center border-b border-black/5 bg-white px-[5%]" style={{ fontSize: "clamp(5px,0.66vw,11px)" }}>
                    <div className="flex h-[68%] w-full items-center gap-[7%] rounded-[3px] bg-[#082f4b] px-[6%] text-white">
                      <Menu size={13} strokeWidth={2} className="h-[1.05em] w-[1.05em] shrink-0"/>
                      <span className="font-medium leading-none">Categorias</span>
                    </div>
                  </div>
                  <div className="h-[92.7%] overflow-y-auto px-[7%] py-[4.2%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {sidebarIconCategories.map((category)=>{
                      const CategoryIcon = getCategoryIcon(category);
                      return <a key={category} href="#categorias" onMouseEnter={(event)=>{event.currentTarget.style.backgroundColor=accent;event.currentTarget.style.color="#fff";}} onMouseLeave={(event)=>{event.currentTarget.style.backgroundColor="";event.currentTarget.style.color="#1f2933";}} className="group flex h-[8.7%] min-h-[24px] w-full items-center gap-[8%] rounded-[2px] px-[3%] font-medium leading-none text-[#1f2933] transition" style={{ fontSize: "clamp(5px,0.54vw,8px)" }}>
                        <CategoryIcon size={12} strokeWidth={1.65} className="h-[1.35em] w-[1.35em] shrink-0"/>
                        <span className="min-w-0 flex-1 truncate">{category}</span>
                        <ChevronLeft size={10} className="h-[1.15em] w-[1.15em] shrink-0 rotate-180 text-current opacity-70"/>
                      </a>;
                    })}
                    {sidebarExtraCategories.map((category)=>{
                      return <a key={category} href="#categorias" onMouseEnter={(event)=>{event.currentTarget.style.backgroundColor=accent;event.currentTarget.style.color="#fff";}} onMouseLeave={(event)=>{event.currentTarget.style.backgroundColor="";event.currentTarget.style.color="#1f2933";}} className="flex min-h-[20px] w-full items-center rounded-[2px] px-[3%] font-medium leading-none text-[#1f2933] transition" style={{ fontSize: "clamp(5px,0.5vw,7.5px)" }}>{category}</a>;
                    })}
                    <div className="my-[4%] border-t border-black/10" />
                    {["Ofertas especiais","Cart\u00f5es presente"].map((item)=>(
                      <a key={item} href="#ofertas" onMouseEnter={(event)=>{event.currentTarget.style.backgroundColor=accent;event.currentTarget.style.color="#fff";}} onMouseLeave={(event)=>{event.currentTarget.style.backgroundColor="";event.currentTarget.style.color="#1f2933";}} className="flex min-h-[22px] w-full items-center gap-[8%] rounded-[2px] px-[3%] font-medium leading-none text-[#1f2933] transition" style={{ fontSize: "clamp(5px,0.54vw,8px)" }}>
                        <Gift size={12} strokeWidth={1.65} className="h-[1.35em] w-[1.35em] shrink-0"/>
                        <span className="min-w-0 flex-1 truncate">{item}</span>
                      </a>
                    ))}
                  </div>
                </div>                <span aria-hidden="true" className="absolute z-10 bg-[#00213c]" style={{ left: "27.1%", top: "3.55%", width: "39.2%", height: "3.8%" }} />
                <span aria-hidden="true" className="absolute z-10 bg-[#042f4f]" style={{ left: "81.25%", top: "3.55%", width: "11.9%", height: "3.8%" }} />
                {heroNavLinks.map((item)=>(
                  <a key={item.label} href={item.href} className="absolute z-20 flex items-center whitespace-nowrap px-[0.15%] font-semibold leading-none text-white transition hover:text-white/75" style={{ left: item.left, top: "4.05%", width: item.width, height: "2.8%", fontSize: "clamp(7px,0.68vw,11px)" }}>{item.label}</a>
                ))}
                <a href="tel:+551234567890" className="absolute z-20 flex items-center whitespace-nowrap px-[0.15%] font-semibold leading-none text-white transition hover:text-white/75" style={{ left: "81.85%", top: "4.05%", width: "11.05%", height: "2.8%", fontSize: "clamp(7px,0.68vw,11px)" }}>Suporte: (123) 456-7890</a>

                <div className="absolute text-white" style={{ left: "27.35%", top: "50%", width: "28.4%", transform: "translateY(-50%)" }}>
                  <span className="block font-semibold uppercase tracking-[0.08em] text-[#e8c878]" style={{ fontSize: "clamp(6.5px,0.68vw,10.5px)" }}>{categories[0] || "Novidades"}</span>
                  <h1 className="mt-[2.8%] font-semibold leading-[1.06] tracking-[-0.012em] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.22)]" style={{ fontSize: "clamp(22px,2.55vw,44px)" }}>{headlinePrimary}<br/>{headlineSecondary}</h1>
                  <p className="mt-[3.4%] truncate font-normal leading-none text-white/72" style={{ fontSize: "clamp(8px,0.86vw,13.5px)" }}>{heroSubtitle}</p>
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
                        <img src={imageUrl} alt={category} className="h-full w-full object-contain p-2"/>
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
                  const mockRating = getMockRating(product.id);
                  const ratingLabel = typeof explicitRating === "number" ? `${explicitRating.toFixed(1)}${explicitCount ? ` (${explicitCount})` : ""}` : `${mockRating.rating} (${formatReviewCount(mockRating.reviewCount)})`;
                  return (
                    <article key={product.id} className="group min-w-0">
                      <div className="relative aspect-[1/1.04] overflow-hidden rounded-[16px] bg-white">
                        <img src={product.imageUrl||heroImage} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>
                        <button type="button" aria-label={`Favoritar ${product.title}`} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-black/70 shadow-sm transition hover:text-black"><Heart size={12} strokeWidth={1.5}/></button>
                      </div>
                      {ratingLabel ? <div className="mt-2 flex items-center gap-1 text-[8.5px] font-semibold text-black/45"><Star size={10} strokeWidth={1.8} className="fill-[#f5b800] text-[#f5b800]"/><span>{ratingLabel}</span></div> : null}
                      <h3 className="mt-1 line-clamp-2 min-h-[28px] text-[11px] font-medium leading-snug text-black/85">{product.title}</h3>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <strong className="text-[12px] font-semibold text-black">{formatBRL(Math.max(product.price*2.1,product.price+20))}</strong>
                        <button type="button" aria-label={`Adicionar ${product.title} ao carrinho`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border border-black/20 bg-white text-black shadow-sm transition hover:-translate-y-0.5 hover:text-black"><ShoppingCart size={14} strokeWidth={1.75}/></button>
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
                <div className="relative w-[44%] shrink-0 overflow-hidden"><img src={displayedProducts[1%displayedProducts.length]?.imageUrl||heroImage} alt="" className="absolute inset-0 h-full w-full object-cover object-center"/></div>
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
                <div className="relative w-[44%] shrink-0 overflow-hidden"><img src={displayedProducts[2%displayedProducts.length]?.imageUrl||heroImage} alt="" className="absolute inset-0 h-full w-full object-cover object-center"/></div>
              </div>
            </section>

            {/* FEATURED COLLECTIONS */}
            <section className="px-8 py-10">
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-normal">{"Cole\u00e7\u00f5es em destaque"}</h2>
                  <p className="mt-1 text-[11px] text-black/50">{"Explore a loja pela categoria que combina com voc\u00ea."}</p>
                </div>
                <span className="flex items-center gap-2 text-[11px]">Ver todas <span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/20">{"\u2039"}</span><span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/20">{"\u203a"}</span></span>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {categoryHighlights.map(({category,imageUrl,key})=>(
                  <div key={key} className="group relative aspect-square cursor-pointer overflow-hidden rounded-[8px] bg-[#eeece7]">
                    <img src={imageUrl} alt={category} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-4 text-white">
                      <strong className="block text-[19px] font-semibold leading-tight">{category}</strong>
                      <span className="mt-1 block text-[9.5px] font-normal text-white/80">Explorar categoria</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <footer className="border-t border-black/10 bg-[#f5f4f2] px-8 py-7 text-center text-[10px] tracking-[0.12em] text-black/45">{"\u00a9"} {new Date().getFullYear()} {brandName} {"\u00b7"} Todos os direitos reservados</footer>



            {/* Comment pins */}
            {comments.map((comment)=>(
              <div key={comment.id} data-editor-ignore className="absolute z-40" style={{ left: `${comment.x}%`, top: `${comment.y}%`, transform: "translate(-50%, -100%)" }} onClick={(e)=>e.stopPropagation()}>
                <div className="flex flex-col items-start gap-1">
                  <button type="button" onClick={()=>setComments((prev)=>prev.map((item)=>item.id===comment.id?{...item,open:!item.open}:item))} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#facc15] text-black shadow-[0_4px_12px_rgba(0,0,0,0.3)]" aria-label={"Coment\u00e1rio"}><MessageSquare size={14}/></button>
                  {comment.open ? (
                    <div className="min-w-[220px] rounded-[12px] border border-black/10 bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                      <textarea autoFocus value={comment.text} onChange={(e)=>{const value=e.target.value;setComments((prev)=>prev.map((item)=>item.id===comment.id?{...item,text:value}:item));}} placeholder={"Escreva um coment\u00e1rio..."} className="h-20 w-full resize-none rounded-[8px] border border-black/10 bg-white p-2 text-[12px] text-black outline-none focus:border-[#2563eb]"/>
                      <div className="mt-2 flex items-center justify-between"><button type="button" onClick={()=>setComments((prev)=>prev.filter((item)=>item.id!==comment.id))} className="text-[11px] text-black/45 hover:text-black">Remover</button><button type="button" onClick={()=>setComments((prev)=>prev.map((item)=>item.id===comment.id?{...item,open:false}:item))} className="rounded-full bg-black px-3 py-1 text-[11px] text-white">Salvar</button></div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="pointer-events-none sticky bottom-4 z-30 mt-4 flex flex-col items-center gap-2">
            {editMode ? <span className="pointer-events-auto rounded-full bg-black/80 px-3 py-1 text-[10.5px] font-medium text-white shadow-lg backdrop-blur">{editMode==="select"?"Clique em qualquer elemento para selecionar":editMode==="text"?"Clique em um texto para editar":editMode==="edit"?"Clique para editar conte\u00fado":"Clique onde deseja adicionar um coment\u00e1rio"} {"\u00b7"} <button onClick={()=>setEditMode(null)} className="underline">sair</button></span> : null}
            <div data-editor-ignore className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/40 bg-white/25 px-2 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-2xl backdrop-saturate-150">
              <button type="button" onClick={()=>setEditMode(editMode==="select"?null:"select")} aria-label="Selecionar" className={`flex h-8 w-8 items-center justify-center rounded-full transition ${editMode==="select"?"bg-[#111] text-white":"text-[#111] hover:bg-white/40"}`}><MousePointer2 size={15}/></button>
              <button type="button" onClick={()=>setEditMode(editMode==="text"?null:"text")} aria-label="Texto" className={`flex h-8 w-8 items-center justify-center rounded-full transition ${editMode==="text"?"bg-[#111] text-white":"text-[#111] hover:bg-white/40"}`}><Type size={15}/></button>
              <button type="button" onClick={()=>setEditMode(editMode==="edit"?null:"edit")} aria-label="Editar" className={`flex h-8 w-8 items-center justify-center rounded-full transition ${editMode==="edit"?"bg-[#111] text-white":"text-[#111] hover:bg-white/40"}`}><Pencil size={14}/></button>
              <button type="button" onClick={()=>setEditMode(editMode==="comment"?null:"comment")} aria-label="Comentar" className={`flex h-8 w-8 items-center justify-center rounded-full transition ${editMode==="comment"?"bg-[#facc15] text-black":"text-[#111] hover:bg-white/40"}`}><MessageSquare size={14}/></button>
            </div>
          </div>


        </div>
      </div>


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

      {showTemplates ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget)setShowTemplates(false)}}>
          <section role="dialog" aria-modal="true" aria-labelledby="templates-title" className="relative w-full max-w-[880px] overflow-hidden rounded-[24px] bg-[#111] p-6 text-white shadow-[0_30px_120px_rgba(0,0,0,0.8)] sm:p-8">
            <button type="button" onClick={()=>setShowTemplates(false)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-white/55 transition hover:bg-white/10 hover:text-white"><X size={16}/></button>
            <h2 id="templates-title" className="text-[24px] font-semibold tracking-[-0.03em]">Escolha um template</h2>
            <p className="mt-1 text-[12px] text-white/45">{"Troque o visual base da sua loja. Todo o conte\u00fado \u00e9 mantido."}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {name:"Velo Modern",desc:"Clean e minimalista",gradient:"from-neutral-100 to-neutral-300"},
                {name:"Velo Bold",desc:"Alto contraste e s\u00e9rio",gradient:"from-zinc-800 to-black"},
                {name:"Velo Warm",desc:"Aconchegante e artesanal",gradient:"from-amber-100 to-orange-300"},
                {name:"Velo Neo",desc:"Vibrante e jovem",gradient:"from-fuchsia-400 to-indigo-500"},
                {name:"Velo Studio",desc:"Editorial e fotogr\u00e1fico",gradient:"from-stone-200 to-stone-400"},
                {name:"Velo Fresh",desc:"Natural e leve",gradient:"from-emerald-200 to-teal-400"},
              ].map((template)=>(
                <button key={template.name} type="button" onClick={()=>{setCurrentTemplate(template.name);setShowTemplates(false);}} className={`group overflow-hidden rounded-[16px] border text-left transition ${currentTemplate===template.name?"border-white/70 bg-white/[0.08]":"border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                  <div className={`relative aspect-[4/3] w-full bg-gradient-to-br ${template.gradient}`}>
                    <div className="absolute inset-3 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[8px] font-semibold text-black/50"><span>VELO</span><span>{"\u25a0 \u25a0 \u25a0"}</span></div>
                      <div className="grid grid-cols-3 gap-1">{[0,1,2].map((index)=><span key={index} className="aspect-square rounded-[3px] bg-white/70"/>)}</div>
                    </div>
                    {currentTemplate===template.name?<span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-black"><Check size={13}/></span>:null}
                  </div>
                  <div className="p-3"><strong className="block text-[13px]">{template.name}</strong><span className="block text-[11px] text-white/45">{template.desc}</span></div>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
};

export default GeneratedStoreEditorPage;
