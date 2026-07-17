import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, PackageOpen } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import StoreMockupPreview from "@/components/onboarding/StoreMockupPreview";
import { listItem, listStagger, screenEnter } from "@/components/onboarding/flowMotion";

const getFirstImage = (images: unknown): string => {
  if (Array.isArray(images)) return images.find((image): image is string => typeof image === "string" && image.trim().length > 0) || "";
  if (typeof images === "string") { try { return getFirstImage(JSON.parse(images)); } catch { return images; } }
  return "";
};

const PRODUCT_COUNT = 8;

const ExampleProductSelectionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<ExampleProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadProducts = async () => {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("id,title,cost_price,images")
        .eq("source", "c7drop")
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        // Sempre mostrar o que entrou de mais novo no catálogo. O scraper regrava
        // scraped_at/updated_at em todos os produtos a cada rodada, então só
        // created_at distingue as novidades do dia.
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(PRODUCT_COUNT);
      if (!mounted) return;
      if (error || !data?.length) { veloToast.error("Não foi possível carregar os produtos de exemplo."); setLoading(false); return; }
      const mapped = data.map((product) => ({ id: product.id, title: product.title || "Produto do catálogo Velo", price: Number(product.cost_price) || 0, imageUrl: getFirstImage(product.images) }));
      setProducts(mapped);
      setLoading(false);
    };
    loadProducts();
    return () => { mounted = false; };
  }, []);

  // O state da navegação some se o usuário recarregar a página, então a escolha
  // feita em /comecar também é lida do sessionStorage.
  const onboardingChoice =
    (location.state as { onboardingChoice?: string } | null)?.onboardingChoice ||
    sessionStorage.getItem("velo-onboarding-choice") ||
    "";

  // Clicar em um produto já avança: cada página/loja parte de um único produto,
  // que pode ser trocado depois no editor.
  const selectProduct = (product: ExampleProduct) => {
    if (onboardingChoice) sessionStorage.setItem("velo-onboarding-choice", onboardingChoice);
    sessionStorage.setItem("velo-example-product", JSON.stringify(product));
    sessionStorage.setItem("velo-example-products", JSON.stringify([product]));
    navigate("/onboarding/preparando-produto", { state: { product, products: [product], onboardingChoice } });
  };

  return (
    <main className="velo-flow min-h-screen">
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col items-center overflow-hidden px-6 py-7 sm:px-9 lg:px-12">
          <Link
            to="/comecar"
            className="vf-btn-ghost absolute left-6 top-7 inline-flex items-center sm:left-9 lg:left-12"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} />
          </Link>
          <div
            className="absolute left-1/2 top-7 h-[5px] w-[210px] -translate-x-1/2 overflow-hidden rounded-[1px] bg-white/10"
            aria-label="Progresso da criação"
          >
            <div className="h-full bg-white transition-all duration-300" style={{ width: "40%" }} />
          </div>

          <motion.div {...screenEnter} className="mt-[76px] w-full max-w-[580px]">
            <h1 className="vf-headline text-[24px] font-medium leading-[30px] tracking-[-0.6px]">
              Escolha um produto de exemplo
            </h1>
            <p className="vf-subhead mt-2 text-[18px] font-normal leading-[28px]">
              Selecione um destes produtos para ver como a Velo funciona.
            </p>

            {loading ? (
              <div className="flex min-h-[430px] items-center justify-center">
                <Loader2 className="vf-spin text-[var(--vf-text-3)]" />
              </div>
            ) : (
              <motion.div
                variants={listStagger}
                initial="initial"
                animate="animate"
                className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
              >
                {products.map((product) => (
                  <motion.button
                    variants={listItem}
                    key={product.id}
                    type="button"
                    onClick={() => selectProduct(product)}
                    className="group relative aspect-square overflow-hidden rounded-[10px] bg-[var(--vf-panel)] outline-none transition-transform duration-200 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <PackageOpen className="text-[var(--vf-text-3)]" size={32} />
                      </span>
                    )}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </motion.div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden border-l border-[var(--vf-border)] bg-[var(--vf-panel-side)] lg:flex">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage: "radial-gradient(circle, rgb(255,255,255) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <StoreMockupPreview className="relative z-10 scale-[0.84]" />
        </aside>
      </div>
    </main>
  );
};

export default ExampleProductSelectionPage;
