import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, PackageOpen, Store } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import type { ExampleProduct } from "@/pages/StartChoicePage";

const getFirstImage = (images: unknown): string => {
  if (Array.isArray(images)) return images.find((image): image is string => typeof image === "string" && image.trim().length > 0) || "";
  if (typeof images === "string") { try { return getFirstImage(JSON.parse(images)); } catch { return images; } }
  return "";
};

const ExampleProductSelectionPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ExampleProduct[]>([]);
  const [selected, setSelected] = useState<ExampleProduct | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadProducts = async () => {
      const { data, error } = await supabase.from("catalog_products").select("id,title,cost_price,images").eq("source", "c7drop").eq("is_blocked", false).gt("stock_quantity", 0).limit(8);
      if (!mounted) return;
      if (error || !data?.length) { veloToast.error("Não foi possível carregar os produtos de exemplo."); setLoading(false); return; }
      const mapped = data.map((product) => ({ id: product.id, title: product.title || "Produto do catálogo Velo", price: Number(product.cost_price) || 0, imageUrl: getFirstImage(product.images) }));
      setProducts(mapped);
      setSelected(mapped[0]);
      setLoading(false);
    };
    loadProducts();
    return () => { mounted = false; };
  }, []);

  const chooseProduct = (product: ExampleProduct) => {
    setSelected(product);
    sessionStorage.setItem("velo-example-product", JSON.stringify(product));
    navigate("/onboarding/preparando-produto", { state: { product } });
  };

  return (
    <main className="min-h-screen bg-black text-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col bg-[#0d0d0d] px-7 py-7 sm:px-10 lg:px-16 lg:py-8 xl:px-24">
          <header className="flex items-center justify-between"><Link to="/comecar" className="inline-flex items-center gap-2 text-[12px] text-white/45 transition hover:text-white"><ChevronLeft size={17} /> Voltar</Link><div className="w-[42%] max-w-[310px]"><div className="h-[4px] rounded-full bg-white/[0.09]"><div className="h-full w-[24%] rounded-full bg-white/40" /></div></div></header>
          <div className="mx-auto w-full max-w-[720px] pt-14 lg:pt-16">
            <h1 className="text-[30px] font-medium tracking-[-0.04em] sm:text-[36px]">Escolha um produto de exemplo</h1>
            <p className="mt-3 text-[15px] text-white/52">Selecione um produto do catálogo Velo para ver como a criação da loja funciona.</p>
            {loading ? <div className="flex min-h-[400px] items-center justify-center"><Loader2 className="animate-spin text-white/35" /></div> : (
              <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {products.map((product) => (
                  <button key={product.id} type="button" onMouseEnter={() => setSelected(product)} onFocus={() => setSelected(product)} onClick={() => chooseProduct(product)} className="group relative aspect-square overflow-hidden rounded-[12px] bg-white/[0.06] outline-none transition hover:-translate-y-1 hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-white/60">
                    {product.imageUrl ? <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <PackageOpen className="mx-auto text-white/20" />}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/35"><span className="translate-y-2 rounded-full bg-white/90 px-4 py-2 text-[12px] font-semibold text-black opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">Selecionar</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden bg-[#010101] p-12 lg:flex">
          <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(255,255,255,0.16)_1px,transparent_1.2px)] [background-position:2px_2px] [background-size:32px_32px]" />
          <div className="relative z-10 flex min-h-[560px] w-full max-w-[330px] flex-col overflow-hidden rounded-[18px] bg-[#151515] shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
            <div className="bg-[#2563eb] px-5 py-4 text-[12px] font-semibold">Prévia da loja Velo</div>
            <div className="flex items-center justify-between bg-white px-5 py-4 text-black"><strong>Velo Store</strong><Store size={19} /></div>
            <div className="flex flex-1 flex-col items-center justify-center bg-[#f4f5ff] p-6 text-center text-black">
              {selected?.imageUrl ? <img src={selected.imageUrl} alt="" className="mb-5 h-36 w-36 rounded-[10px] object-contain mix-blend-multiply" /> : null}
              <p className="line-clamp-2 text-[13px] font-medium">{selected?.title || "Escolha um produto"}</p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default ExampleProductSelectionPage;
