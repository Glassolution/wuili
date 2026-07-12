import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, ChevronLeft, Gift, Heart, History, LayoutGrid, LayoutTemplate, Menu, MessageSquare, Monitor, MoreHorizontal, MousePointer2, Package, Palette, Pencil, Play, Plus, Search, Settings, ShoppingBag, Smartphone, Sparkles, Type, UserRound, X } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { ExampleProduct } from "@/pages/StartChoicePage";

type FlowState = { product: ExampleProduct; language: string; persona: string; salesAngle: string };
type CatalogItem = ExampleProduct & { category: string; brand: string };
type EditorPanel = "template" | null;

const getFirstImage = (images: unknown) => {
  if (Array.isArray(images)) return images.find((image): image is string => typeof image === "string" && image.trim().length > 0) || "";
  if (typeof images === "string") { try { return getFirstImage(JSON.parse(images)); } catch { return images; } }
  return "";
};
const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type EditMode = "select" | "text" | "edit" | "comment" | null;
type Comment = { id: string; x: number; y: number; text: string; open: boolean };

const GeneratedStoreEditorPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const imageInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [panel, setPanel] = useState<EditorPanel>(null);
  const [accent, setAccent] = useState("#111111");
  const [font, setFont] = useState("Helvetica Neue");
  const [columns, setColumns] = useState(3);
  const [heroImage, setHeroImage] = useState("");
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [showPlans, setShowPlans] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState("Velo Modern");
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [generatingBanner, setGeneratingBanner] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const generateBanner = async () => {
    if (generatingBanner) return;
    setGeneratingBanner(true);
    setBannerError(null);
    try {
      const first = displayedProducts[0];
      const { data, error } = await supabase.functions.invoke("generate-store-banner", {
        body: {
          brandName,
          persona: flow?.persona,
          salesAngle: flow?.salesAngle,
          category: first?.category,
          productTitle: first?.title,
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
    } catch { return null; }
    return product && language && persona && salesAngle ? { product, language, persona, salesAngle } : null;
  }, [location.state]);

  useEffect(() => {
    if (!flow) return;
    setHeroImage("/velo-fashion-banner-v1.png");
    let mounted = true;
    supabase.from("catalog_products").select("id,title,cost_price,images,category,brand").eq("source", "c7drop").eq("is_blocked", false).gt("stock_quantity", 0).limit(12).then(({ data }) => {
      if (!mounted || !data) return;
      setProducts(data.map((item) => ({ id: item.id, title: item.title, price: Number(item.cost_price) || 0, imageUrl: getFirstImage(item.images), category: item.category || "Moda", brand: item.brand || "Velo" })).filter((item) => item.imageUrl));
    });
    return () => { mounted = false; };
  }, [flow]);

  if (!flow) return <Navigate to="/comecar" replace />;
  const displayedProducts = products.length ? products : [{ ...flow.product, category: "Moda", brand: "Velo" }];
  const categories = Array.from(new Set(displayedProducts.map((product) => product.category))).slice(0, 7);
  const brandName = ((displayedProducts[0] as CatalogItem).brand || "Velo").toUpperCase();
  const brandInitial = brandName.charAt(0);
  const salesAngleText = flow.salesAngle || "";
  const personaText = flow.persona || "";
  const isLuxury = /premium|luxo|sofistic|elegan/i.test(salesAngleText + personaText);
  const isYouth = /jovem|urban|street|casual/i.test(salesAngleText + personaText);
  const headlinePrimary = isLuxury ? "VISTA SUA" : isYouth ? "SEU ESTILO" : "VISTA SUA";
  const headlineSecondary = isLuxury ? "ELEGÂNCIA" : isYouth ? "SEM LIMITES" : "CONFIANÇA";
  const heroSubtitle = salesAngleText ? salesAngleText.slice(0, 120) : `Peças atemporais. ${brandName} tem tudo o que você precisa para se sentir bem.`;
  const collectionLabels = ["O Essencial", "Fim de Semana", "Noite", "Poder Feminino"];

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#050505] text-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <style>{`.editor-mode-active *:hover{outline:1.5px dashed #2563eb;outline-offset:2px;cursor:pointer}.editor-mode-active [data-editor-ignore],.editor-mode-active [data-editor-ignore] *{outline:none!important;cursor:default}`}</style>
      <header className="flex h-[72px] shrink-0 items-center justify-between px-5">

        <div className="flex items-center gap-4"><button type="button" onClick={() => history.back()} className="text-white/55 hover:text-white"><ChevronLeft /></button><button type="button" onClick={()=>setPanel(panel==="template"?null:"template")} className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition ${panel==="template"?"bg-white/15 text-white":"bg-white/[0.07] text-white/60 hover:text-white"}`} aria-label="Editar template"><MoreHorizontal size={18}/></button><div><strong className="block text-[14px]">Loja de Moda</strong><span className="text-[10px] text-white/30">Template 01 · {currentTemplate}</span></div></div>
        <div className="flex items-center gap-2"><div className="flex rounded-[9px] bg-white/[0.06] p-1"><button onClick={()=>setMobilePreview(false)} className={`flex h-9 w-12 items-center justify-center rounded-[7px] ${!mobilePreview?"bg-white/15":"text-white/35"}`}><Monitor size={17}/></button><button onClick={()=>setMobilePreview(true)} className={`flex h-9 w-12 items-center justify-center rounded-[7px] ${mobilePreview?"bg-white/15":"text-white/35"}`}><Smartphone size={17}/></button></div><button className="p-3 text-white/45"><Settings size={18}/></button><button className="p-3 text-white/45"><Play size={18}/></button><button className="p-3 text-white/45"><History size={18}/></button><div className="relative ml-1 pb-2"><button onClick={()=>setShowPlans(true)} className="relative min-w-[112px] overflow-hidden rounded-[9px] bg-gradient-to-r from-[#3b82f6] via-[#2563eb] to-[#1d4ed8] px-5 pb-3 pt-2 text-[13px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_6px_18px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:brightness-110"><span className="relative z-10">Publicar</span><span className="absolute inset-x-0 top-0 h-px bg-white/45" /></button><span className="absolute -bottom-0.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-b from-[#fde047] to-[#facc15] px-3 py-1 text-[8px] font-extrabold tracking-[0.02em] text-[#5b4300] shadow-[0_2px_7px_rgba(0,0,0,0.38)]">🎁 DOMÍNIO GRÁTIS</span></div></div>
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
              {/* Ações principais */}
              <button type="button" onClick={()=>setShowTemplates(true)} className="group flex w-full items-center gap-3 rounded-[13px] bg-white/[0.05] p-3 text-left transition hover:bg-white/[0.09]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] shadow-[0_6px_16px_rgba(37,99,235,0.35)]"><LayoutTemplate size={20}/></span>
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Trocar template</span><span className="block text-[11px] text-white/45">Atual: {currentTemplate}</span></span>
                <ChevronLeft size={14} className="rotate-180 text-white/35" />
              </button>

              <button type="button" onClick={()=>navigate("/catalogo")} className="group flex w-full items-center gap-3 rounded-[13px] bg-white/[0.05] p-3 text-left transition hover:bg-white/[0.09]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#f97316] to-[#c2410c] shadow-[0_6px_16px_rgba(249,115,22,0.35)]"><Package size={20}/></span>
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Adicionar produtos</span><span className="block text-[11px] text-white/45">Escolha do catálogo Velo</span></span>
                <Plus size={14} className="text-white/35" />
              </button>

              <button type="button" onClick={()=>imageInput.current?.click()} className="group flex w-full items-center gap-3 rounded-[13px] bg-white/[0.05] p-3 text-left transition hover:bg-white/[0.09]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#a855f7] to-[#6d28d9] shadow-[0_6px_16px_rgba(168,85,247,0.35)]"><Sparkles size={20}/></span>
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Imagem principal</span><span className="block text-[11px] text-white/45">Envie a foto do banner</span></span>
                <Plus size={14} className="text-white/35" />
              </button>
            </div>

            <div className="mx-5 border-t border-white/[0.06]" />

            <div className="space-y-6 px-5 py-6">
              {/* Cor de destaque */}
              <div>
                <div className="flex items-center gap-2"><Palette size={13} className="text-white/55"/><strong className="text-[12px]">Cor de destaque</strong></div>
                <p className="mt-1 text-[10.5px] text-white/40">Usada em botões, preços e tags.</p>
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
                <p className="mt-1 text-[10.5px] text-white/40">Fonte dos títulos e textos da loja.</p>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {[{name:"Helvetica Neue",stack:'"Helvetica Neue", Helvetica, sans-serif',mood:"Moderna e limpa"},{name:"Georgia",stack:'Georgia, serif',mood:"Clássica e elegante"},{name:"Trebuchet MS",stack:'"Trebuchet MS", sans-serif',mood:"Amigável e leve"}].map((option)=>(
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
          <div ref={previewRef} onClick={handlePreviewClick} className={`relative mx-auto min-h-full overflow-hidden bg-white text-[#111] shadow-[0_30px_100px_rgba(0,0,0,0.5)] transition-all ${mobilePreview?"max-w-[390px]":"max-w-[1450px]"} ${editMode?"editor-mode-active":""}`} style={{ fontFamily: font, cursor: editMode==="comment"?"crosshair":editMode?"pointer":"default" }}>
            {/* === TEMPLATE 01 — C-STYLE INSPIRED === */}
            {/* Announcement bar */}
            <div className="grid grid-cols-3 items-center bg-black px-6 py-1.5 text-[10px] text-white">
              <span />
              <span className="text-center tracking-[0.02em]">FRETE GRÁTIS ACIMA DE R$ 299&nbsp;&nbsp;|&nbsp;&nbsp;TROCAS FÁCEIS</span>
              <span className="flex items-center justify-end gap-2 text-white/85"><span>Encontre uma loja</span><span>·</span><span>Ajuda</span><UserRound size={11} strokeWidth={1.5}/><Search size={11} strokeWidth={1.5}/></span>
            </div>

            {/* Main nav */}
            <nav className="flex items-center gap-8 bg-white px-8 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black"><span className="font-serif text-[16px] italic leading-none">{brandInitial}</span></span>
                <strong className="font-serif text-[19px] tracking-[0.02em]">{brandName}</strong>
              </div>
              <ul className="flex flex-1 items-center justify-center gap-8 text-[11px] font-medium tracking-[0.14em]">
                {["NOVIDADES","FEMININO","MASCULINO","CALÇADOS","ACESSÓRIOS","OFERTAS"].map((item)=><li key={item}>{item}</li>)}
              </ul>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 rounded-full bg-[#f5f4f2] px-4 py-2 text-[11px] text-black/50"><Search size={12} strokeWidth={1.6}/><input placeholder="Buscar peças, marcas..." className="w-[150px] bg-transparent outline-none placeholder:text-black/40"/></label>
                <UserRound size={16} strokeWidth={1.4}/>
                <Heart size={16} strokeWidth={1.4}/>
                <span className="relative"><ShoppingBag size={16} strokeWidth={1.4}/><span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#1e40af] px-1 text-[9px] font-bold text-white">0</span></span>
              </div>
            </nav>

            {/* HERO — banner cobre toda a seção */}
            <section className="relative mx-4 min-h-[440px] overflow-hidden rounded-[6px] bg-[#eeece7]">
              {heroImage ? <img src={heroImage} alt={brandName} className="absolute inset-0 h-full w-full object-cover"/> : null}
              {/* Overlay de leitura à esquerda */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#eeece7] via-[#eeece7]/85 to-transparent md:via-[#eeece7]/70"/>
              {/* Botão de geração — só dono da loja */}
              <div data-editor-ignore className="absolute right-4 top-4 z-30 flex flex-col items-end gap-2">
                <button type="button" onClick={generateBanner} disabled={generatingBanner} className="flex items-center gap-2 rounded-full bg-black/85 px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur-md transition hover:bg-black disabled:opacity-70">
                  <Sparkles size={13} className={generatingBanner?"animate-spin":""}/>
                  {generatingBanner ? "Gerando banner..." : "Gerar banner com IA"}
                </button>
                {bannerError ? <span className="max-w-[240px] rounded-md bg-red-500/90 px-2 py-1 text-[10px] text-white">{bannerError}</span> : <span className="rounded-md bg-white/85 px-2 py-1 text-[9.5px] font-medium text-black/60">Visível só para o dono da loja</span>}
              </div>
              {/* Conteúdo hero */}
              <div className="relative z-10 flex min-h-[440px] max-w-[55%] flex-col justify-center px-10 py-14">
                <h1 className="font-serif text-[64px] font-normal leading-[0.92] tracking-[-0.01em] md:text-[80px]">{headlinePrimary}<br/>{headlineSecondary}</h1>
                <p className="mt-6 max-w-[320px] text-[12.5px] leading-[1.6] text-black/75">{heroSubtitle}</p>
                <div className="mt-8 flex items-center gap-3">
                  <button className="flex items-center gap-2 rounded-full bg-black px-6 py-3 text-[11px] font-medium tracking-[0.15em] text-white" style={{backgroundColor:accent}}>COMPRAR AGORA <span className="ml-1">→</span></button>
                  <button className="rounded-full border border-black bg-white/60 px-6 py-3 text-[11px] font-medium tracking-[0.15em] backdrop-blur-sm">EXPLORAR COLEÇÕES</button>
                </div>
              </div>
              {/* Cartão da marca sobre a imagem */}
              <div className="absolute right-[8%] top-1/2 z-10 flex h-[110px] w-[130px] -translate-y-1/2 flex-col items-center justify-center gap-1 bg-[#f5f2ec] shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
                <span className="font-serif text-[36px] italic leading-none">{brandInitial}</span>
                <span className="font-serif text-[10px] tracking-[0.14em]">{brandName}</span>
                <span className="text-[6px] tracking-[0.3em] text-black/50">MAKE YOUR STATEMENT</span>
              </div>
            </section>

            {/* Info strip */}
            <div className="mx-4 mt-3 grid grid-cols-2 items-center gap-0 rounded-[6px] border border-black/10 bg-white px-2 md:grid-cols-4">
              {[
                {icon:<Package size={22} strokeWidth={1.2}/>,title:"FRETE GRÁTIS",desc:"Compras acima de R$ 299"},
                {icon:<History size={22} strokeWidth={1.2}/>,title:"TROCAS FÁCEIS",desc:"Política de 30 dias"},
                {icon:<ShoppingBag size={22} strokeWidth={1.2}/>,title:"PAGAMENTO SEGURO",desc:"Checkout 100% protegido"},
                {icon:<Search size={22} strokeWidth={1.2}/>,title:"LOJAS PERTO DE VOCÊ",desc:`Encontre uma ${brandName}`},
              ].map((item,index)=>(
                <div key={item.title} className={`flex items-center gap-3 px-4 py-4 ${index<3?"md:border-r md:border-black/10":""}`}>
                  <span className="text-black/70">{item.icon}</span>
                  <div><strong className="block text-[10.5px] font-semibold tracking-[0.1em]">{item.title}</strong><span className="text-[10.5px] text-black/45">{item.desc}</span></div>
                </div>
              ))}
            </div>

            {/* SHOP BY CATEGORY */}
            <section className="px-8 pb-8 pt-14">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold tracking-[0.18em]">COMPRE POR CATEGORIA</h2>
                <span className="flex items-center gap-2 text-[11px]">Ver todas <span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/20">→</span></span>
              </div>
              <div className="grid grid-cols-4 gap-6 md:grid-cols-7">
                {[...categories, "Acessórios","Masculino","Ofertas"].slice(0,7).map((category,index)=>{
                  const isSale = index === 6;
                  return (
                    <div key={index} className="flex flex-col items-center gap-3">
                      <div className={`aspect-square w-full overflow-hidden rounded-full ${isSale?"bg-black":"bg-[#eeece7]"}`}>
                        {isSale ? (
                          <div className="flex h-full w-full items-center justify-center font-serif text-[24px] italic text-white">SALE</div>
                        ) : (
                          <img src={displayedProducts[index%displayedProducts.length]?.imageUrl||heroImage} alt={category} className="h-full w-full object-cover"/>
                        )}
                      </div>
                      <span className="text-[11.5px]">{isSale ? "Ofertas" : category}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* NEW ARRIVALS */}
            <section className="px-8 pb-12 pt-6">
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-[0.18em]">NOVIDADES</h2>
                  <p className="mt-1 text-[11px] text-black/50">Novos looks. Direto do estúdio.</p>
                </div>
                <span className="flex items-center gap-2 text-[11px]">Ver todos <span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/20">←</span><span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/20">→</span></span>
              </div>
              <div className={`grid gap-4 ${mobilePreview?"grid-cols-2":columns===2?"grid-cols-2":columns===4?"grid-cols-2 md:grid-cols-4":"grid-cols-2 md:grid-cols-6"}`}>
                {displayedProducts.slice(0,6).map((product,index)=>(
                  <article key={product.id+"-"+index} className="group">
                    <div className="relative aspect-[0.82] overflow-hidden rounded-[4px] bg-[#f2f0eb]">
                      <img src={product.imageUrl||heroImage} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>
                      <button className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/95"><Heart size={12} strokeWidth={1.5}/></button>
                    </div>
                    <h3 className="mt-3 line-clamp-1 text-[12px]">{product.title}</h3>
                    <strong className="text-[12px] font-semibold" style={{color:accent}}>{formatBRL(Math.max(product.price*2.1,product.price+20))}</strong>
                    <div className="mt-2 flex items-center gap-1.5">{["#c9c1b3","#8a7a63","#e8dccc","#3b3b3b"].map((color)=><span key={color} className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:color}}/>)}</div>
                  </article>
                ))}
              </div>
            </section>

            {/* PROMO BANDS */}
            <section className="grid grid-cols-1 gap-3 px-8 pb-12 md:grid-cols-3">
              <div className="relative flex overflow-hidden rounded-[6px] bg-black text-white">
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <strong className="text-[10px] font-semibold tracking-[0.18em] text-white/70">ESTUDANTES GANHAM</strong>
                    <h3 className="mt-1 font-serif text-[30px] leading-none">10% OFF</h3>
                    <p className="mt-2 max-w-[150px] text-[10px] text-white/55">Comprove seu status e ganhe desconto exclusivo.</p>
                  </div>
                  <button className="mt-4 w-fit rounded-full bg-white px-4 py-1.5 text-[9.5px] font-semibold tracking-[0.14em] text-black">GANHAR DESCONTO</button>
                </div>
                <div className="w-[45%] overflow-hidden"><img src={displayedProducts[1%displayedProducts.length]?.imageUrl||heroImage} alt="" className="h-full w-full object-cover"/></div>
              </div>
              <div className="relative flex overflow-hidden rounded-[6px] bg-[#eeece7]">
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <strong className="text-[10px] font-semibold tracking-[0.18em] text-black/50">NOVA ESTAÇÃO</strong>
                    <h3 className="mt-1 font-serif text-[30px] leading-none">NEW LOOK</h3>
                    <p className="mt-2 max-w-[160px] text-[10px] text-black/55">Descubra as últimas tendências curadas para você.</p>
                  </div>
                  <button className="mt-4 w-fit rounded-full bg-black px-4 py-1.5 text-[9.5px] font-semibold tracking-[0.14em] text-white">COMPRAR AGORA</button>
                </div>
                <div className="w-[45%] overflow-hidden"><img src={displayedProducts[2%displayedProducts.length]?.imageUrl||heroImage} alt="" className="h-full w-full object-cover"/></div>
              </div>
              <div className="relative overflow-hidden rounded-[6px]">
                <img src={displayedProducts[3%displayedProducts.length]?.imageUrl||heroImage} alt="" className="absolute inset-0 h-full w-full object-cover"/>
                <div className="relative flex h-full min-h-[170px] flex-col justify-between bg-gradient-to-r from-white/85 via-white/50 to-transparent p-5">
                  <div>
                    <strong className="text-[10px] font-semibold tracking-[0.18em]">VISITE-NOS</strong>
                    <h3 className="mt-1 font-serif text-[20px] leading-tight">Encontre a loja {brandName} <br/>mais próxima</h3>
                  </div>
                  <button className="mt-4 w-fit rounded-full bg-white px-4 py-1.5 text-[9.5px] font-semibold tracking-[0.14em]">ENCONTRAR LOJA</button>
                </div>
              </div>
            </section>

            {/* EXPLORE COLLECTIONS */}
            <section className="px-8 pb-14">
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-[0.18em]">EXPLORE AS COLEÇÕES</h2>
                  <p className="mt-1 text-[11px] text-black/50">Looks selecionados para cada momento.</p>
                </div>
                <span className="flex items-center gap-2 text-[11px]">Ver todas <span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/20">←</span><span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/20">→</span></span>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {collectionLabels.map((label,index)=>(
                  <div key={label} className="relative aspect-[0.68] overflow-hidden rounded-[6px]">
                    <img src={displayedProducts[(index+1)%displayedProducts.length]?.imageUrl||heroImage} alt={label} className="h-full w-full object-cover"/>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-4 text-white">
                      <strong className="block font-serif text-[19px] leading-tight">{label}</strong>
                      <span className="mt-1 block text-[9.5px] tracking-[0.14em] text-white/80">COMPRE AGORA</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Bottom values bar */}
            <footer className="grid grid-cols-1 gap-4 border-t border-white/10 bg-black px-8 py-5 text-white md:grid-cols-3">
              {[
                {title:"MATERIAIS SUSTENTÁVEIS",desc:"Melhor para você. Melhor para o planeta."},
                {title:"PRODUÇÃO ÉTICA",desc:"Feito com cuidado e respeito."},
                {title:"FOCO NA COMUNIDADE",desc:"Moda que devolve."},
              ].map((item)=>(
                <div key={item.title} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30"><Heart size={13} strokeWidth={1.4}/></span>
                  <div><strong className="block text-[10.5px] font-semibold tracking-[0.14em]">{item.title}</strong><span className="text-[10.5px] text-white/55">{item.desc}</span></div>
                </div>
              ))}
            </footer>



            {/* Comment pins */}
            {comments.map((comment)=>(
              <div key={comment.id} data-editor-ignore className="absolute z-40" style={{ left: `${comment.x}%`, top: `${comment.y}%`, transform: "translate(-50%, -100%)" }} onClick={(e)=>e.stopPropagation()}>
                <div className="flex flex-col items-start gap-1">
                  <button type="button" onClick={()=>setComments((prev)=>prev.map((item)=>item.id===comment.id?{...item,open:!item.open}:item))} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#facc15] text-black shadow-[0_4px_12px_rgba(0,0,0,0.3)]" aria-label="Comentário"><MessageSquare size={14}/></button>
                  {comment.open ? (
                    <div className="min-w-[220px] rounded-[12px] border border-black/10 bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                      <textarea autoFocus value={comment.text} onChange={(e)=>{const value=e.target.value;setComments((prev)=>prev.map((item)=>item.id===comment.id?{...item,text:value}:item));}} placeholder="Escreva um comentário..." className="h-20 w-full resize-none rounded-[8px] border border-black/10 bg-white p-2 text-[12px] text-black outline-none focus:border-[#2563eb]"/>
                      <div className="mt-2 flex items-center justify-between"><button type="button" onClick={()=>setComments((prev)=>prev.filter((item)=>item.id!==comment.id))} className="text-[11px] text-black/45 hover:text-black">Remover</button><button type="button" onClick={()=>setComments((prev)=>prev.map((item)=>item.id===comment.id?{...item,open:false}:item))} className="rounded-full bg-black px-3 py-1 text-[11px] text-white">Salvar</button></div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="pointer-events-none sticky bottom-4 z-30 mt-4 flex flex-col items-center gap-2">
            {editMode ? <span className="pointer-events-auto rounded-full bg-black/80 px-3 py-1 text-[10.5px] font-medium text-white shadow-lg backdrop-blur">{editMode==="select"?"Clique em qualquer elemento para selecionar":editMode==="text"?"Clique em um texto para editar":editMode==="edit"?"Clique para editar conteúdo":"Clique onde deseja adicionar um comentário"} · <button onClick={()=>setEditMode(null)} className="underline">sair</button></span> : null}
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
                  {["Publique lojas sem limite","Redator de IA ilimitado","Seções focadas em conversão","Créditos mensais para imagens IA","Novos recursos todos os meses","Editor completo incluído"].map((feature,index)=><li key={feature} className="flex min-h-[44px] items-center gap-3 rounded-[9px] bg-white/[0.055] px-4 text-[13px] font-medium"><span className="text-[18px]">{["🚀","🤖","🎨","🌠","∞","🛍️"][index]}</span>{feature}</li>)}
                </ul>
              </div>

              <div className="flex flex-col">
                <div className="overflow-hidden rounded-[17px] border-[3px] border-[#1597f4] bg-[#303030] shadow-[0_5px_0_#1597f4]">
                  <div className="flex flex-wrap items-center gap-3 p-5"><span className="h-4 w-4 rounded-full bg-[#1597f4] ring-4 ring-[#1597f4]/15"/><strong className="text-[18px]">Velo <em>PRO</em></strong><del className="ml-auto text-[20px] text-white/25">R$ 99,90</del><span className="rounded-[9px] bg-white/[0.08] px-3 py-2 text-[26px] font-semibold tracking-[-0.04em]">R$ 64,94 <small className="text-[11px] font-normal text-white/45">/mês</small></span></div>
                  <div className="flex items-center justify-between border-t border-white/15 bg-white/[0.05] px-5 py-3"><span className="text-[13px]"><strong className="text-orange-400">-35%</strong> com o código</span><strong className="rounded-[6px] bg-[#f97316] px-4 py-2 text-[15px]">COPA</strong></div>
                </div>
                <div className="mt-5 flex items-start gap-3 rounded-[15px] bg-[#332e16] p-5"><Gift className="shrink-0 text-[#facc15]" size={22}/><div><strong className="text-[14px] text-[#f7d978]">Domínio grátis com seu plano PRO!</strong><p className="mt-1 text-[11px] leading-relaxed text-white/45">Lance sua marca com um domínio incluído no plano Velo Pro.</p></div></div>
                <div className="mt-auto pt-8"><div className="rounded-[13px] bg-white/[0.055] p-5"><div className="text-[18px] tracking-[0.08em] text-[#facc15]">★★★★★</div><p className="mt-3 text-[12px] leading-relaxed text-white/55">Editor completo, geração com IA e suporte para publicar sua primeira loja.</p></div><button type="button" onClick={()=>navigate("/checkout?plan=pro&promo=COPA")} className="mt-4 h-[58px] w-full rounded-[13px] bg-gradient-to-r from-[#0ea5e9] to-[#2563eb] text-[17px] font-semibold shadow-[0_12px_30px_rgba(14,165,233,0.26)] transition hover:brightness-110">Continuar com Pro&nbsp; →</button><p className="mt-3 text-center text-[11px] text-white/40">Cancele a qualquer momento · Suporte 24/7</p></div>
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
            <p className="mt-1 text-[12px] text-white/45">Troque o visual base da sua loja. Todo o conteúdo é mantido.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {name:"Velo Modern",desc:"Clean e minimalista",gradient:"from-neutral-100 to-neutral-300"},
                {name:"Velo Bold",desc:"Alto contraste e sério",gradient:"from-zinc-800 to-black"},
                {name:"Velo Warm",desc:"Aconchegante e artesanal",gradient:"from-amber-100 to-orange-300"},
                {name:"Velo Neo",desc:"Vibrante e jovem",gradient:"from-fuchsia-400 to-indigo-500"},
                {name:"Velo Studio",desc:"Editorial e fotográfico",gradient:"from-stone-200 to-stone-400"},
                {name:"Velo Fresh",desc:"Natural e leve",gradient:"from-emerald-200 to-teal-400"},
              ].map((template)=>(
                <button key={template.name} type="button" onClick={()=>{setCurrentTemplate(template.name);setShowTemplates(false);}} className={`group overflow-hidden rounded-[16px] border text-left transition ${currentTemplate===template.name?"border-white/70 bg-white/[0.08]":"border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                  <div className={`relative aspect-[4/3] w-full bg-gradient-to-br ${template.gradient}`}>
                    <div className="absolute inset-3 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[8px] font-semibold text-black/50"><span>VELO</span><span>▤ ▤ ▤</span></div>
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
