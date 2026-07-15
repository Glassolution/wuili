import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  Code2,
  Heart,
  ExternalLink,
  Eraser,
  ImageIcon,
  LayoutTemplate,
  Menu,
  Monitor,
  MoreHorizontal,
  MousePointer2,
  PaintBucket,
  PackagePlus,
  Pencil,
  Play,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Truck,
  Type,
  UserCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type CatalogProduct = Pick<
  Database["public"]["Tables"]["catalog_products"]["Row"],
  "id" | "title" | "description" | "images" | "suggested_price" | "original_price" | "rating" | "category" | "stock_quantity"
>;
type ViewMode = "desktop" | "mobile";
type EditMode = "select" | "edit" | "fill" | "eraser" | null;
type ToolbarTool = Exclude<EditMode, null>;
type EditTarget = "headline" | "description" | "cta" | "buyNow" | "brand" | null;

const getFirstImage = (images: CatalogProduct["images"]) => {
  if (Array.isArray(images)) return images.find((image): image is string => typeof image === "string" && image.trim().length > 0) || "";
  if (typeof images === "string") {
    try {
      return getFirstImage(JSON.parse(images) as CatalogProduct["images"]);
    } catch {
      return images;
    }
  }
  return "";
};

const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fallbackCopy = {
  headline: "Moletom Oversized Essential",
  description: "Confeccionado em algodao premium de alta gramatura, entrega conforto e durabilidade. A modelagem oversized e o design minimalista tornam a peca um coringa para qualquer guarda-roupa.",
  cta: "Adicionar ao carrinho",
  buyNow: "Comprar agora",
  brand: "Velora",
};

const accentOptions = ["#111111", "#2563eb", "#ef2b2d", "#16a34a", "#f59e0b", "#ec4899", "#7c3aed"];
const storeNav = ["Inicio", "Loja", "Novidades", "Colecoes", "Ofertas", "Blog"];
const sizeOptions = ["PP", "P", "M", "G", "GG"];
const colorSwatches = [
  { name: "Grafite", value: "#4b4b4b" },
  { name: "Cinza", value: "#b9b9b7" },
  { name: "Areia", value: "#e6dcc8" },
  { name: "Preto", value: "#161616" },
];
const productTabs = ["Detalhes", "Materiais", "Tamanho e caimento", "Envio e trocas"];
const detailBullets = [
  "Modelagem oversized",
  "Tecido macio e encorpado",
  "Capuz com cordao ajustavel",
  "Punhos e barra canelados",
  "Estilo unissex",
];
const trustBadges: Array<[typeof Truck, string, string]> = [
  [Truck, "Frete gratis", "Em pedidos acima de R$ 199"],
  [RefreshCcw, "Troca facil", "30 dias para devolucao"],
  [ShieldCheck, "Pagamento seguro", "100% protegido"],
];
const fontOptions = [
  { name: "Geist", hint: "Refinada e delicada" },
  { name: "Plus Jakarta Sans", hint: "Moderna e comercial" },
  { name: "Inter", hint: "Limpa para conversao" },
];

const ProductLandingEditorPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");
  const [editMode, setEditMode] = useState<EditMode>("select");
  const [accent, setAccent] = useState("#111111");
  const [selectedTarget, setSelectedTarget] = useState<EditTarget>(null);
  const [selectedFont, setSelectedFont] = useState("Geist");
  const [heroImage, setHeroImage] = useState("");
  const [heroCtaUrl, setHeroCtaUrl] = useState("/catalogo");
  const [copy, setCopy] = useState(fallbackCopy);
  const [selectedSize, setSelectedSize] = useState("M");
  const [selectedColor, setSelectedColor] = useState(0);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    let active = true;
    const loadProduct = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("catalog_products")
        .select("id,title,description,images,suggested_price,original_price,rating,category,stock_quantity")
        .eq("is_active", true)
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;
      if (data) {
        setProduct(data);
        const image = getFirstImage(data.images);
        setHeroImage(image);
        setCopy({
          headline: data.title || fallbackCopy.headline,
          description: data.description?.slice(0, 260) || fallbackCopy.description,
          cta: fallbackCopy.cta,
          buyNow: fallbackCopy.buyNow,
          brand: fallbackCopy.brand,
        });
      }
      setLoading(false);
    };
    void loadProduct();
    return () => {
      active = false;
    };
  }, []);

  const price = product?.suggested_price || 299;
  const originalPrice = product?.original_price && product.original_price > price ? product.original_price : price * 1.5;
  const discountPct = originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;
  const rating = product?.rating || 4.8;
  const thumbnails = useMemo(() => {
    const main = heroImage || getFirstImage(product?.images ?? null);
    return [main, main, main, main].filter(Boolean);
  }, [heroImage, product?.images]);
  const relatedProducts = useMemo(
    () => Array.from({ length: 4 }, () => ({ name: product?.title || "Produto Velo", price })),
    [product?.title, price]
  );

  const updateCopy = (key: keyof typeof copy, value: string) => setCopy((current) => ({ ...current, [key]: value }));
  const textEditing = editMode === "select" || editMode === "edit";
  const editableClass = (target: EditTarget) =>
    textEditing
      ? `rounded-[6px] outline-offset-4 transition ${selectedTarget === target ? "outline outline-2 outline-[#111827]" : "hover:outline hover:outline-1 hover:outline-dashed hover:outline-[#2563eb]"}`
      : "";

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setHeroImage(URL.createObjectURL(file));
    setEditMode("select");
  };

  const openImagePicker = () => {
    fileInputRef.current?.click();
  };

  const toolbarOrientation = viewMode === "mobile" ? "vertical" : "horizontal";
  const toolbarTools = [
    { id: "select" as const, label: "Select", icon: MousePointer2 },
    { id: "edit" as const, label: "Pencil", icon: Pencil },
    { id: "fill" as const, label: "Fill", icon: PaintBucket },
    { id: "eraser" as const, label: "Eraser", icon: Eraser },
  ];
  const activeToolbarTool = toolbarTools.find((tool) => tool.id === editMode);
  const fillSwatches = accentOptions;
  const handleToolbarToolClick = (tool: ToolbarTool) => {
    if (tool === "eraser") {
      setAccent("#111111");
      setSelectedTarget(null);
    }
    setEditMode((current) => (current === tool && tool === "select" ? null : tool));
  };

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#1f1f1d] text-white" style={{ fontFamily: `${selectedFont}, Inter, system-ui, sans-serif` }}>
      <style>{`
        .product-editor-preview [contenteditable="true"]:focus{outline:2px solid #111827;outline-offset:4px}
        .product-editor-preview.editor-mode-active *:hover{outline:1.5px dashed #2563eb;outline-offset:2px}
        .product-editor-preview [data-editor-ignore],.product-editor-preview [data-editor-ignore] *{outline:none!important}
        .product-scrollbar::-webkit-scrollbar{height:0;width:0}
      `}</style>

      <header data-editor-ignore className="grid h-[70px] shrink-0 grid-cols-[minmax(280px,520px)_minmax(0,1fr)_auto] items-center border-b border-white/[0.07] bg-[#1f1f1d] px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-8 w-8 shrink-0 rounded-[9px] bg-gradient-to-br from-[#ff7a18] via-[#f43f5e] to-[#2563eb]" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <strong className="truncate text-[14px] font-semibold">Velora</strong>
              <ChevronDown size={13} className="text-white/45" />
            </div>
            <span className="block truncate text-[12px] text-white/45">Editando ultima versao salva</span>
          </div>
        </div>

        <div className="hidden min-w-0 items-center justify-center gap-3 lg:flex">
          <div className="flex h-10 items-center gap-1 rounded-full border border-white/[0.09] bg-[#171716] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <button type="button" className="inline-flex h-8 items-center gap-2 rounded-full bg-[#234cba] px-4 text-[13px] font-semibold text-[#9db7ff] shadow-[0_0_0_1px_rgba(96,145,255,0.35)]">
              <Sparkles size={16} /> Preview
            </button>
            <button type="button" className="flex h-8 w-9 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white" aria-label="Codigo">
              <Code2 size={15} />
            </button>
          </div>
          <div className="flex h-10 min-w-[260px] max-w-[380px] flex-1 items-center gap-2 rounded-full border border-white/[0.09] bg-[#171716] px-3 text-[13px] text-white/75">
            <button type="button" className="text-white/45 transition hover:text-white" aria-label="Atualizar preview">
              <RefreshCcw size={15} />
            </button>
            <span className="text-white/32">/</span>
            <span className="truncate font-medium">produto/editor</span>
            <ChevronDown size={14} className="ml-auto text-white/35" />
          </div>
          <button type="button" className="text-white/45 transition hover:text-white" aria-label="Abrir externo">
            <ExternalLink size={17} />
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          <div className="hidden rounded-full border border-white/[0.08] bg-[#171716] p-1 sm:flex">
            <button type="button" onClick={() => setViewMode("desktop")} className={`flex h-8 w-10 items-center justify-center rounded-full transition ${viewMode === "desktop" ? "bg-white/[0.12] text-white" : "text-white/35 hover:text-white"}`} aria-label="Preview desktop">
              <Monitor size={16} />
            </button>
            <button type="button" onClick={() => setViewMode("mobile")} className={`flex h-8 w-10 items-center justify-center rounded-full transition ${viewMode === "mobile" ? "bg-white/[0.12] text-white" : "text-white/35 hover:text-white"}`} aria-label="Preview mobile">
              <Smartphone size={15} />
            </button>
          </div>
          <button type="button" className="hidden h-10 w-10 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white md:flex" aria-label="Configuracoes">
            <Settings size={18} />
          </button>
          <button type="button" className="hidden h-10 w-10 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white md:flex" aria-label="Publicar preview">
            <Play size={18} />
          </button>
          <button type="button" className="h-10 rounded-[12px] bg-[#2f6df6] px-5 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_8px_22px_rgba(47,109,246,0.24)] transition hover:brightness-110">
            Publicar
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside data-editor-ignore className="w-[360px] shrink-0 overflow-y-auto border-r border-white/[0.08] bg-[#1f1f1d] px-4 py-6">
          <section className="overflow-hidden rounded-[16px] border border-white/[0.09] bg-[#282826] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-4">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#1f1f1d]">
                <LayoutTemplate size={14} />
              </span>
              <div className="min-w-0">
                <strong className="block truncate text-[14px] font-semibold">Velora Moda</strong>
                <span className="block truncate text-[11px] text-white/45">Template 01</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 p-2.5">
              <button type="button" className="h-9 rounded-[9px] border border-white/[0.11] bg-[#242423] text-[12px] font-medium text-white/78 transition hover:bg-white/[0.07]">Detalhes</button>
              <button type="button" className="h-9 rounded-[9px] border border-white/[0.12] bg-gradient-to-b from-white/[0.16] to-white/[0.07] text-[12px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">Personalizar</button>
            </div>
          </section>

          <div className="mt-5 flex items-center gap-4 text-white/72">
            <button type="button" onClick={() => navigate(-1)} className="transition hover:text-white" aria-label="Voltar"><ChevronLeft size={18} /></button>
            <button type="button" className="transition hover:text-white" aria-label="Mais opcoes"><MoreHorizontal size={19} /></button>
          </div>

          <div className="mt-5 space-y-3">
            <button type="button" className="group flex w-full items-center gap-3 rounded-[14px] border border-white/[0.08] bg-[#282826] p-3 text-left transition hover:bg-[#30302e]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#2563eb] text-white shadow-[0_10px_20px_rgba(37,99,235,0.24)]"><LayoutTemplate size={19} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Trocar template</span><span className="mt-0.5 block text-[11px] text-white/42">Atual: Velora Moda</span></span>
              <ChevronLeft size={15} className="rotate-180 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
            </button>

            <button type="button" className="group flex w-full items-center gap-3 rounded-[14px] border border-white/[0.08] bg-[#282826] p-3 text-left transition hover:bg-[#30302e]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#f97316] text-white shadow-[0_10px_20px_rgba(249,115,22,0.22)]"><PackagePlus size={19} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Produto principal</span><span className="mt-0.5 block text-[11px] text-white/42">Escolha no catalogo Velo</span></span>
              <span className="text-white/35">+</span>
            </button>

            <button type="button" onClick={openImagePicker} className="group flex w-full items-center gap-3 rounded-[14px] border border-white/[0.08] bg-[#282826] p-3 text-left transition hover:bg-[#30302e]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#7c3aed] text-white shadow-[0_10px_20px_rgba(124,58,237,0.22)]"><Sparkles size={19} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Imagem principal</span><span className="mt-0.5 block text-[11px] text-white/42">Envie a foto do produto</span></span>
              <span className="text-white/35">+</span>
            </button>

            <label className="block rounded-[14px] border border-white/[0.08] bg-[#282826] p-3">
              <span className="text-[12px] font-semibold text-white/85">Link do CTA do hero</span>
              <input value={heroCtaUrl} onChange={(event) => setHeroCtaUrl(event.target.value)} placeholder="/catalogo ou https://..." className="mt-2 h-9 w-full rounded-[10px] border border-white/[0.10] bg-[#1f1f1d] px-3 text-[12px] text-white outline-none transition placeholder:text-white/28 focus:border-white/35" />
            </label>
          </div>

          <div className="my-5 border-t border-white/[0.08]" />

          <section>
            <div className="flex items-center gap-2">
              <PaintBucket size={15} className="text-white/76" />
              <h2 className="text-[14px] font-black">Cor de destaque</h2>
            </div>
            <p className="mt-2 text-[12px] font-semibold text-white/76">Usada em botoes, preco e tags.</p>
            <div className="mt-4 flex items-center gap-2">
              {accentOptions.map((color) => (
                <button key={color} type="button" onClick={() => setAccent(color)} className={`flex h-9 w-9 items-center justify-center rounded-full border ${accent === color ? "border-white ring-2 ring-white" : "border-transparent"}`} style={{ backgroundColor: color }} aria-label={`Aplicar cor ${color}`}>
                  {accent === color ? <Check size={17} className="text-white drop-shadow" /> : null}
                </button>
              ))}
              <input type="color" value={accent} onChange={(event) => setAccent(event.target.value)} className="h-9 w-9 overflow-hidden rounded-full border-0 bg-transparent p-0" aria-label="Cor personalizada" />
            </div>
          </section>

          <section className="mt-6">
            <div className="flex items-center gap-2">
              <Type size={15} className="text-white/76" />
              <h2 className="text-[14px] font-black">Tipografia</h2>
            </div>
            <p className="mt-2 text-[12px] font-semibold text-white/76">Fonte dos titulos e textos do produto.</p>
            <div className="mt-4 space-y-2">
              {fontOptions.map((font) => (
                <button key={font.name} type="button" onClick={() => setSelectedFont(font.name)} className={`flex w-full items-center justify-between rounded-[10px] border p-3 text-left transition ${selectedFont === font.name ? "border-white bg-white/6" : "border-white/30 hover:border-white/70"}`}>
                  <span>
                    <span className="block text-[13px] font-black">{font.name}</span>
                    <span className="mt-1 block text-[11px] font-semibold text-white/42">{font.hint}</span>
                  </span>
                  {selectedFont === font.name ? <Check size={15} /> : null}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <div className="min-w-0 flex-1 overflow-auto bg-[#1f1f1d] p-3 sm:p-5">
          <button data-editor-ignore type="button" onClick={() => navigate(-1)} className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black transition hover:-translate-x-0.5 lg:hidden" aria-label="Voltar">
            <ArrowLeft size={18} />
          </button>

          <section className={`product-editor-preview editor-mode-active relative mx-auto min-h-full overflow-hidden rounded-[24px] bg-white text-[#111] shadow-[0_30px_100px_rgba(0,0,0,0.38)] ring-1 ring-black/10 transition-all ${viewMode === "mobile" ? "max-w-[390px]" : "max-w-[1488px]"}`} style={{ fontFamily: `${selectedFont}, Inter, system-ui, sans-serif` }}>
            {loading ? (
              <div className="flex min-h-[720px] items-center justify-center text-[13px] font-semibold text-black/45">Carregando produto real do catalogo...</div>
            ) : (
              <>
                {/* Barra de aviso */}
                <div className="relative flex items-center justify-center bg-[#f4f4f3] px-6 py-2.5 text-[12px] text-black/60">
                  <span className="flex items-center gap-2"><Truck size={14} /> Frete gratis em pedidos acima de R$ 199</span>
                  <span className="absolute right-6 hidden items-center gap-1 sm:flex">BRL R$ <ChevronDown size={12} /></span>
                </div>

                {/* Cabecalho da loja */}
                <header className="flex items-center justify-between border-b border-black/10 bg-white px-6 py-4 sm:px-8">
                  <div className="flex items-center gap-4">
                    <button type="button" className="text-black/70 lg:hidden" aria-label="Menu"><Menu size={20} /></button>
                    <span
                      contentEditable={textEditing}
                      suppressContentEditableWarning
                      onClick={() => setSelectedTarget("brand")}
                      onInput={(event) => updateCopy("brand", event.currentTarget.textContent || "")}
                      className={`text-[22px] font-black uppercase tracking-[0.18em] text-black ${editableClass("brand")}`}
                    >
                      {copy.brand}
                    </span>
                  </div>
                  <nav className="hidden items-center gap-7 text-[13px] font-semibold uppercase tracking-wide text-black/70 lg:flex">
                    {storeNav.map((item, index) => (
                      <span key={item} className="flex cursor-pointer items-center gap-1 transition hover:text-black">
                        {item}
                        {index === 1 ? <ChevronDown size={13} /> : null}
                      </span>
                    ))}
                  </nav>
                  <div className="flex items-center gap-4 text-black/75">
                    <Search size={19} />
                    <UserCircle size={20} />
                    <span className="relative">
                      <ShoppingBag size={20} />
                      <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">2</span>
                    </span>
                  </div>
                </header>

                {/* Produto */}
                <section className="px-6 py-8 sm:px-10">
                  <div
                    className="mx-auto grid max-w-[1180px] gap-8 lg:gap-12"
                    style={{ gridTemplateColumns: viewMode === "mobile" ? "1fr" : "minmax(0,1.05fr) minmax(0,1fr)" }}
                  >
                    {/* Galeria */}
                    <div className="flex gap-4">
                      <div className="flex flex-col gap-3">
                        {thumbnails.map((image, index) => (
                          <button
                            key={`${image}-${index}`}
                            type="button"
                            onClick={() => setHeroImage(image)}
                            className={`h-[86px] w-[70px] overflow-hidden rounded-[10px] border transition ${index === 0 ? "border-black" : "border-black/10 hover:border-black/40"}`}
                          >
                            <img src={image} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                      <button type="button" onClick={openImagePicker} className="group relative aspect-[4/5] flex-1 overflow-hidden rounded-[14px] bg-[#f1f1f0]">
                        {heroImage ? (
                          <img src={heroImage} alt={product?.title || "Produto"} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center"><ImageIcon size={70} className="text-black/20" /></span>
                        )}
                        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black opacity-0 shadow transition group-hover:opacity-100">Trocar imagem</span>
                        <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black shadow"><Search size={16} /></span>
                      </button>
                    </div>

                    {/* Informacoes */}
                    <div className="flex flex-col">
                      <span className="inline-flex w-fit items-center rounded-full bg-[#f0f0ef] px-3 py-1 text-[12px] font-semibold text-black/65">Novidade</span>
                      <h1
                        contentEditable={textEditing}
                        suppressContentEditableWarning
                        onClick={() => setSelectedTarget("headline")}
                        onInput={(event) => updateCopy("headline", event.currentTarget.textContent || "")}
                        className={`mt-4 max-w-[520px] text-[30px] font-black leading-[1.08] text-black md:text-[38px] ${editableClass("headline")}`}
                      >
                        {copy.headline}
                      </h1>
                      <div className="mt-3 flex items-center gap-2 text-[14px] text-black/55">
                        <span className="flex text-black">{Array.from({ length: 5 }).map((_, index) => <Star key={index} size={16} fill="currentColor" strokeWidth={0} />)}</span>
                        <span>{rating.toFixed(1)} (128 avaliacoes)</span>
                      </div>
                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <span className="text-[30px] font-black leading-none text-black">{formatBRL(price)}</span>
                        {discountPct > 0 ? <span className="text-[17px] text-black/35 line-through">{formatBRL(originalPrice)}</span> : null}
                        {discountPct > 0 ? <span className="rounded-[6px] px-2 py-1 text-[12px] font-bold text-white" style={{ backgroundColor: accent }}>{discountPct}% OFF</span> : null}
                      </div>
                      <p
                        contentEditable={textEditing}
                        suppressContentEditableWarning
                        onClick={() => setSelectedTarget("description")}
                        onInput={(event) => updateCopy("description", event.currentTarget.textContent || "")}
                        className={`mt-5 max-w-[520px] text-[15px] leading-[1.6] text-black/65 ${editableClass("description")}`}
                      >
                        {copy.description}
                      </p>

                      <div className="mt-6 h-px w-full bg-black/10" />

                      {/* Cor */}
                      <div className="mt-6">
                        <p className="text-[14px] font-semibold text-black">Cor: <span className="font-medium text-black/55">{colorSwatches[selectedColor].name}</span></p>
                        <div className="mt-3 flex items-center gap-3">
                          {colorSwatches.map((color, index) => (
                            <button
                              key={color.name}
                              type="button"
                              onClick={() => setSelectedColor(index)}
                              aria-label={color.name}
                              className="flex h-9 w-9 items-center justify-center rounded-full"
                              style={{ outline: selectedColor === index ? `2px solid ${accent}` : "none", outlineOffset: "2px" }}
                            >
                              <span className="h-8 w-8 rounded-full border border-black/10" style={{ backgroundColor: color.value }} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Tamanho */}
                      <div className="mt-6">
                        <div className="flex items-center justify-between">
                          <p className="text-[14px] font-semibold text-black">Tamanho: <span className="font-medium text-black/55">{selectedSize}</span></p>
                          <button type="button" className="text-[13px] font-medium text-black/55 underline underline-offset-4 transition hover:text-black">Guia de tamanhos</button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2.5">
                          {sizeOptions.map((size) => {
                            const isActive = selectedSize === size;
                            return (
                              <button
                                key={size}
                                type="button"
                                onClick={() => setSelectedSize(size)}
                                className={`h-11 min-w-[54px] rounded-[10px] border px-3 text-[14px] font-semibold transition ${isActive ? "border-transparent text-white" : "border-black/15 text-black hover:border-black/50"}`}
                                style={isActive ? { backgroundColor: accent } : undefined}
                              >
                                {size}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Acoes */}
                      <div className="mt-7 flex gap-3">
                        <button
                          type="button"
                          onClick={() => window.open(heroCtaUrl, "_self")}
                          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[12px] text-[15px] font-bold text-white transition hover:brightness-110"
                          style={{ backgroundColor: accent }}
                        >
                          <ShoppingBag size={19} />
                          <span
                            contentEditable={textEditing}
                            suppressContentEditableWarning
                            onClick={(event) => { event.stopPropagation(); setSelectedTarget("cta"); }}
                            onInput={(event) => updateCopy("cta", event.currentTarget.textContent || "")}
                            className={editableClass("cta")}
                          >
                            {copy.cta}
                          </span>
                        </button>
                        <button type="button" className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-black/15 text-black transition hover:bg-black/[0.04]" aria-label="Favoritar"><Heart size={20} /></button>
                      </div>

                      {/* Selos de confianca */}
                      <div className="mt-7 grid grid-cols-3 gap-4 border-t border-black/10 pt-6">
                        {trustBadges.map(([Icon, title, subtitle]) => (
                          <div key={title} className="flex flex-col items-start gap-1">
                            <Icon size={20} className="text-black/70" />
                            <span className="text-[13px] font-semibold text-black">{title}</span>
                            <span className="text-[11px] text-black/50">{subtitle}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Abas + detalhes */}
                <section className="border-t border-black/10 px-6 py-10 sm:px-10">
                  <div className="mx-auto max-w-[1180px]">
                    <div className="flex flex-wrap gap-7 border-b border-black/10">
                      {productTabs.map((tab, index) => {
                        const isActive = activeTab === index;
                        return (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(index)}
                            className={`-mb-px border-b-2 pb-3 text-[15px] transition ${isActive ? "border-black font-semibold text-black" : "border-transparent text-black/45 hover:text-black/70"}`}
                          >
                            {tab}
                          </button>
                        );
                      })}
                    </div>
                    <div
                      className="mt-8 grid gap-8 lg:gap-12"
                      style={{ gridTemplateColumns: viewMode === "mobile" ? "1fr" : "minmax(0,1fr) minmax(0,1fr)" }}
                    >
                      <div>
                        <p className="text-[15px] leading-[1.7] text-black/70">{copy.description}</p>
                        <ul className="mt-6 space-y-3">
                          {detailBullets.map((bullet) => (
                            <li key={bullet} className="flex items-center gap-3 text-[14px] font-medium text-black/75">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: accent }}><Check size={12} className="text-white" /></span>
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="aspect-[4/3] overflow-hidden rounded-[14px] bg-[#161616]">
                        {heroImage ? <img src={heroImage} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Voce tambem pode gostar */}
                <section className="bg-[#faf9f8] px-6 py-12 sm:px-10">
                  <div className="mx-auto max-w-[1180px]">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[24px] font-black text-black">Voce tambem pode gostar</h2>
                      <button type="button" className="flex items-center gap-1.5 text-[14px] font-semibold text-black/70 transition hover:text-black">Ver todos <ArrowRight size={16} /></button>
                    </div>
                    <div
                      className="mt-7 grid gap-5"
                      style={{ gridTemplateColumns: viewMode === "mobile" ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))" }}
                    >
                      {relatedProducts.map((item, index) => (
                        <article key={index} className="group">
                          <div className="relative aspect-square overflow-hidden rounded-[14px] bg-[#f1f1f0]">
                            {heroImage ? <img src={heroImage} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : null}
                            <button type="button" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black shadow transition hover:bg-white" aria-label="Favoritar"><Heart size={15} /></button>
                          </div>
                          <h3 className="mt-3 line-clamp-1 text-[14px] font-semibold text-black">{item.name}</h3>
                          <p className="mt-0.5 text-[14px] text-black/60">{formatBRL(item.price)}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
          </section>

          <div data-editor-ignore className={`pointer-events-none sticky z-30 mt-4 flex w-full gap-3 ${toolbarOrientation === "vertical" ? "bottom-6 justify-end pr-4" : "bottom-4 flex-col items-center"}`}>
            {editMode === "fill" ? (
              <div className={`pointer-events-auto rounded-[18px] bg-[#101010] p-3 text-white shadow-[0_16px_42px_rgba(0,0,0,0.28)] ${toolbarOrientation === "vertical" ? "mr-2 self-center" : "mb-1"}`}>
                <div className="mb-2 flex items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  <span>Cor de destaque</span>
                  <span className="h-4 w-4 rounded-full ring-1 ring-white/30" style={{ backgroundColor: accent }} />
                </div>
                <div className="flex items-center gap-2">
                  {fillSwatches.map((color) => (
                    <button key={color} type="button" onClick={() => setAccent(color)} aria-label={`Aplicar ${color}`} className={`h-7 w-7 rounded-full transition ${accent === color ? "ring-2 ring-white ring-offset-2 ring-offset-[#101010]" : "ring-1 ring-white/20 hover:scale-105"}`} style={{ backgroundColor: color }} />
                  ))}
                  <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full ring-1 ring-white/25" title="Cor personalizada">
                    <span className="absolute inset-0 bg-[conic-gradient(from_0deg,#ff0080,#ff8c00,#ffee00,#00ff85,#00b8ff,#8a2be2,#ff0080)]" />
                    <input type="color" value={accent} onChange={(event) => setAccent(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                  </label>
                </div>
              </div>
            ) : null}
            <div className={`pointer-events-auto flex items-center gap-1 rounded-full bg-[#101010] p-1.5 text-white shadow-[0_18px_44px_rgba(0,0,0,0.26)] ring-1 ring-white/10 ${toolbarOrientation === "vertical" ? "flex-col" : "flex-row"}`}>
              {toolbarTools.map((tool) => {
                const Icon = tool.icon;
                const isActive = editMode === tool.id;
                return (
                  <button key={tool.id} type="button" onClick={() => handleToolbarToolClick(tool.id)} aria-label={tool.label} className={`relative flex h-10 w-10 items-center justify-center rounded-full transition ${isActive ? "bg-white text-black shadow-[0_5px_16px_rgba(255,255,255,0.22)]" : "text-white hover:bg-white/10"}`}>
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
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>
      </div>
    </main>
  );
};

export default ProductLandingEditorPage;
