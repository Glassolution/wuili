import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, ChevronLeft, Gift, Heart, History, LayoutGrid, LayoutTemplate, Menu, MessageSquare, Monitor, MoreHorizontal, MousePointer2, Package, Palette, Pencil, Play, Plus, Search, Settings, ShoppingBag, Smartphone, Type, UserRound, X } from "lucide-react";
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

const GeneratedStoreEditorPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const imageInput = useRef<HTMLInputElement>(null);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [panel, setPanel] = useState<EditorPanel>(null);
  const [accent, setAccent] = useState("#111111");
  const [font, setFont] = useState("Helvetica Neue");
  const [columns, setColumns] = useState(3);
  const [heroImage, setHeroImage] = useState("");
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [showPlans, setShowPlans] = useState(false);
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
  const categories = Array.from(new Set(displayedProducts.map((product) => product.category))).slice(0, 5);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#050505] text-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <header className="flex h-[72px] shrink-0 items-center justify-between px-5">
        <div className="flex items-center gap-4"><button type="button" onClick={() => history.back()} className="text-white/55 hover:text-white"><ChevronLeft /></button><button type="button" onClick={()=>setPanel(panel==="template"?null:"template")} className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition ${panel==="template"?"bg-white/15 text-white":"bg-white/[0.07] text-white/60 hover:text-white"}`} aria-label="Editar template"><MoreHorizontal size={18}/></button><div><strong className="block text-[14px]">Loja de Moda</strong><span className="text-[10px] text-white/30">Template 01 · Velo Modern</span></div></div>
        <div className="flex items-center gap-2"><div className="flex rounded-[9px] bg-white/[0.06] p-1"><button onClick={()=>setMobilePreview(false)} className={`flex h-9 w-12 items-center justify-center rounded-[7px] ${!mobilePreview?"bg-white/15":"text-white/35"}`}><Monitor size={17}/></button><button onClick={()=>setMobilePreview(true)} className={`flex h-9 w-12 items-center justify-center rounded-[7px] ${mobilePreview?"bg-white/15":"text-white/35"}`}><Smartphone size={17}/></button></div><button className="p-3 text-white/45"><Settings size={18}/></button><button className="p-3 text-white/45"><Play size={18}/></button><button className="p-3 text-white/45"><History size={18}/></button><div className="relative ml-1 pb-2"><button onClick={()=>setShowPlans(true)} className="relative min-w-[112px] overflow-hidden rounded-[9px] bg-gradient-to-r from-[#3b82f6] via-[#2563eb] to-[#1d4ed8] px-5 pb-3 pt-2 text-[13px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_6px_18px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:brightness-110"><span className="relative z-10">Publicar</span><span className="absolute inset-x-0 top-0 h-px bg-white/45" /></button><span className="absolute -bottom-0.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-b from-[#fde047] to-[#facc15] px-3 py-1 text-[8px] font-extrabold tracking-[0.02em] text-[#5b4300] shadow-[0_2px_7px_rgba(0,0,0,0.38)]">🎁 DOMÍNIO GRÁTIS</span></div></div>
      </header>

      <div className="flex min-h-0 flex-1">
        <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(event)=>{const file=event.target.files?.[0];if(file)setHeroImage(URL.createObjectURL(file));}}/>
        {panel==="template" ? (
          <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-white/[0.05] bg-[#0c0c0c] p-5">
            <div className="flex items-center justify-between"><strong className="text-[13px]">Personalizar template</strong><button onClick={()=>setPanel(null)} className="text-white/35 hover:text-white"><X size={16}/></button></div>
            <div className="mt-7 space-y-7">
              <label className="block"><span className="text-[11px] text-white/45">Cor de destaque</span><input type="color" value={accent} onChange={(e)=>setAccent(e.target.value)} className="mt-3 h-10 w-full rounded bg-transparent"/></label>
              <label className="block"><span className="text-[11px] text-white/45">Tipografia</span><select value={font} onChange={(e)=>setFont(e.target.value)} className="mt-3 h-10 w-full rounded bg-white/[0.07] px-3 text-white"><option>Helvetica Neue</option><option>Georgia</option><option>Trebuchet MS</option></select></label>
              <div><span className="text-[11px] text-white/45">Colunas da grade</span><div className="mt-3 grid grid-cols-3 gap-2">{[2,3,4].map(value=><button key={value} onClick={()=>setColumns(value)} className={`rounded bg-white/[0.07] p-3 text-[12px] ${columns===value?"ring-1 ring-white/60":""}`}>{value} col.</button>)}</div></div>
              <div><span className="text-[11px] text-white/45">Imagem principal</span><button onClick={()=>imageInput.current?.click()} className="mt-3 flex h-10 w-full items-center justify-center rounded bg-white/[0.07] text-[12px] hover:bg-white/[0.12]">Adicionar imagem</button></div>
            </div>
          </aside>
        ) : null}

        <div className="relative min-w-0 flex-1 overflow-auto rounded-tl-[18px] bg-[#111] p-3 sm:p-5">
          <div className={`mx-auto min-h-full overflow-hidden bg-white text-[#111] shadow-[0_30px_100px_rgba(0,0,0,0.5)] transition-all ${mobilePreview?"max-w-[390px]":"max-w-[1450px]"}`} style={{ fontFamily: font }}>
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
          </div>

          <div className="pointer-events-none sticky bottom-4 z-30 mt-4 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/40 bg-white/25 px-2 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-2xl backdrop-saturate-150">
              <button type="button" aria-label="Selecionar" className="flex h-8 w-8 items-center justify-center rounded-full text-[#111] hover:bg-white/40"><MousePointer2 size={15}/></button>
              <button type="button" aria-label="Texto" className="flex h-8 w-8 items-center justify-center rounded-full text-[#111] hover:bg-white/40"><Type size={15}/></button>
              <button type="button" aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-full text-[#111] hover:bg-white/40"><Pencil size={14}/></button>
              <button type="button" aria-label="Comentar" className="flex h-8 w-8 items-center justify-center rounded-full text-[#111] hover:bg-white/40"><MessageSquare size={14}/></button>
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
    </main>
  );
};

export default GeneratedStoreEditorPage;
