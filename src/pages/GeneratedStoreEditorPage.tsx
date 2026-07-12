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
            <nav className="flex h-[82px] items-center justify-between px-7"><Menu size={21}/><strong className="text-[28px] tracking-[-0.07em]">VELO/W</strong><div className="flex items-center gap-4"><span className="hidden text-[11px] sm:inline">Blog</span><span className="hidden text-[11px] sm:inline">FAQ</span><Bell size={17}/><ShoppingBag size={17}/><UserRound size={17}/></div></nav>
            <div className="flex flex-wrap items-center gap-2 px-7 pb-6"><button className="rounded-full bg-[#f5f5f5] px-4 py-2 text-[11px]">Roupas⌄</button><button className="rounded-full bg-[#f5f5f5] px-4 py-2 text-[11px]">Novidades</button><button className="rounded-full bg-[#f5f5f5] px-4 py-2 text-[11px]">Promoções</button><label className="flex min-w-[180px] flex-1 items-center rounded-full bg-[#f5f5f5] px-4"><input placeholder="Buscar..." className="h-9 min-w-0 flex-1 bg-transparent text-[11px] outline-none"/><Search size={15}/></label>{["Masculino","Feminino","Infantil"].map(item=><button key={item} className="rounded-full bg-[#f5f5f5] px-4 py-2 text-[11px]">{item}</button>)}</div>
            <section className="relative mx-7 min-h-[285px] overflow-hidden rounded-[18px] bg-[#ebe9e5]">
              <img src={heroImage} alt="Coleção Velo" className="absolute inset-0 h-full w-full object-cover object-center" />
              <div className={`relative z-10 ml-auto flex min-h-[285px] flex-col justify-center p-8 ${mobilePreview?"w-full bg-gradient-to-r from-transparent via-[#ebe9e5]/80 to-[#ebe9e5] pl-[34%]":"w-[38%]"}`}>
                <span className="text-[11px]">— Coleções</span>
                <h1 className="mt-4 text-[27px] font-medium leading-[1.08] tracking-[-0.035em]">Explore a nova coleção Velo</h1>
                <p className="mt-4 text-[12px] leading-relaxed text-black/55">Peças escolhidas para um estilo moderno, leve e autêntico.</p>
              </div>
            </section>

            <div className={`grid gap-7 px-7 py-9 ${mobilePreview?"grid-cols-1":"md:grid-cols-[180px_1fr]"}`}>
              {!mobilePreview?<aside><p className="text-[11px] text-black/40">Início · Coleção</p><h2 className="mt-3 text-[18px] font-semibold">Coleção Velo</h2><div className="mt-8"><strong className="text-[12px]">Categorias</strong><div className="mt-3 space-y-3">{categories.map((category,index)=><label key={category} className="flex items-center gap-2 text-[11px]"><input type="checkbox" defaultChecked={index<2} style={{accentColor:accent}}/>{category}</label>)}</div></div><button className="mt-6 w-full rounded-full py-2 text-[11px] text-white" style={{backgroundColor:accent}}>Mostrar mais</button><div className="mt-8"><strong className="text-[12px]">Preço</strong><input type="range" className="mt-4 w-full" style={{accentColor:accent}}/></div></aside>:null}
              <section className={`grid gap-4 ${mobilePreview?"grid-cols-1":columns===2?"grid-cols-2":columns===4?"grid-cols-2 xl:grid-cols-4":"grid-cols-2 xl:grid-cols-3"}`}>
                {displayedProducts.map((product,index)=><article key={product.id} className="group rounded-[16px] bg-white p-2 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"><div className="relative aspect-[0.84] overflow-hidden rounded-[13px] bg-[#ececea]"><img src={index===0?heroImage:product.imageUrl} alt={product.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"/><button className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90"><Heart size={15}/></button></div><div className="p-3"><h3 className="line-clamp-1 text-[16px] font-semibold tracking-[-0.03em]">{product.title}</h3><p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-black/42">{product.category} · seleção especial da Velo.</p><div className="mt-4 flex items-center justify-between"><strong className="rounded-[7px] px-3 py-2 text-[12px] text-white" style={{backgroundColor:accent}}>{formatBRL(Math.max(product.price*2.1,product.price+20))}</strong><button className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10"><ShoppingBag size={15}/></button></div></div></article>)}
              </section>
            </div>

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
