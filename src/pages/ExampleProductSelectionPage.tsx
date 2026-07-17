import { useEffect, useState } from "react";
import { Check, ChevronLeft, Loader2, PackageOpen, Store } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { createUserProject } from "@/lib/userProjects";
import { saveOnboardingProjectId, readOnboardingProjectId } from "@/lib/onboardingProject";

const getFirstImage = (images: unknown): string => {
  if (Array.isArray(images)) return images.find((image): image is string => typeof image === "string" && image.trim().length > 0) || "";
  if (typeof images === "string") { try { return getFirstImage(JSON.parse(images)); } catch { return images; } }
  return "";
};

const formatPrice = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PRODUCT_COUNT = 8;

const ExampleProductSelectionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<ExampleProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ExampleProduct[]>([]);
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
      setSelectedProducts([]);
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
  // Uma página de vendas é focada em um único produto.
  const singleSelection = onboardingChoice === "sales-page";

  const toggleProduct = (product: ExampleProduct) => {
    setSelectedProducts((current) => {
      const isSelected = current.some((item) => item.id === product.id);
      if (isSelected) return current.filter((item) => item.id !== product.id);
      if (singleSelection) return [product];
      return [...current, product];
    });
  };

  const [creating, setCreating] = useState(false);
  const continueWithProducts = async () => {
    const primaryProduct = selectedProducts[0];
    if (!primaryProduct || creating) return;
    if (onboardingChoice) sessionStorage.setItem("velo-onboarding-choice", onboardingChoice);
    sessionStorage.setItem("velo-example-product", JSON.stringify(primaryProduct));
    sessionStorage.setItem("velo-example-products", JSON.stringify(selectedProducts));

    // Fase 1: cria o user_projects logo no primeiro passo com dados de verdade
    // (produto + template default). As etapas seguintes fazem saveProjectDraft
    // incremental em cima desse mesmo id, então o editor recebe um projeto real
    // — nunca mais projectId===null vindo do onboarding.
    let projectId = readOnboardingProjectId();
    if (!projectId && onboardingChoice === "sales-page") {
      try {
        setCreating(true);
        const project = await createUserProject({
          nome: primaryProduct.title || "Página de venda",
          descricao: "",
          tipo: "pagina_venda",
          productIds: [primaryProduct.id],
          template: "produto-1",
        });
        projectId = project.id;
        saveOnboardingProjectId(projectId);
      } catch (err) {
        // Sem projectId a próxima tela continua funcionando (fallback do editor),
        // mas o loop de persistência não fica fechado. Mostramos aviso e seguimos.
        console.error("createUserProject failed:", err);
        veloToast.error("Não foi possível salvar o projeto agora — você poderá salvar depois no editor.");
      } finally {
        setCreating(false);
      }
    }

    navigate("/onboarding/preparando-produto", {
      state: { product: primaryProduct, products: selectedProducts, onboardingChoice, projectId },
    });
  };

  return (
    <main className="min-h-screen bg-[#fbfbfc] text-[#101522]" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <section className="mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-6 py-7 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-5">
          <Link to="/comecar" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#111827]/55 transition hover:text-[#111827]">
            <ChevronLeft size={17} /> Voltar
          </Link>
          <div className="flex w-[30%] max-w-[260px] min-w-[160px] items-center gap-2" aria-label="Progresso da criação">
            <div className="h-[4px] flex-1 rounded-full bg-black" />
            <div className="h-[4px] flex-1 rounded-full bg-black" />
            <div className="h-[4px] flex-1 rounded-full bg-[#e4e7ef]" />
          </div>
        </header>

        <div className="mt-12 flex flex-col gap-4 lg:mt-14 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#697083]">Produto de exemplo</p>
            <h1 className="mt-3 max-w-[560px] text-[30px] font-semibold leading-[1.06] tracking-[-0.045em] text-[#121827] sm:text-[38px]">
              Escolha o produto que combina com sua loja
            </h1>
            <p className="mt-3 max-w-[560px] text-[13.5px] leading-[1.55] text-[#687086]">
              {singleSelection
                ? "Sua página de vendas é focada em um único produto. Escolha um item real do catálogo Velo — depois você pode trocar tudo no editor."
                : "Selecione um item real do catálogo Velo para montar a primeira página. Depois você pode trocar tudo no editor."}
            </p>
          </div>

          <div className="rounded-full bg-[#eef0f5] px-3.5 py-1.5 text-[12px] font-semibold text-[#2b3140]">
            Passo 2 de 4
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[430px] items-center justify-center">
            <Loader2 className="animate-spin text-[#111827]/30" />
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {products.map((product) => {
                const active = selectedProducts.some((item) => item.id === product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleProduct(product)}
                    aria-pressed={active}
                    className={`group relative flex min-h-[305px] flex-col overflow-hidden rounded-[18px] border bg-white p-3.5 text-left shadow-[0_16px_42px_rgba(15,23,42,0.055)] outline-none transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_56px_rgba(15,23,42,0.09)] focus-visible:ring-4 focus-visible:ring-black/10 ${
                      active ? "border-black shadow-[0_28px_90px_rgba(15,23,42,0.16)]" : "border-[#dfe4ef]"
                    }`}
                  >
                    {active ? (
                      <span className="absolute right-3.5 top-3.5 inline-flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[10px] font-bold text-white">
                        <Check size={11} strokeWidth={2.4} /> Selecionado
                      </span>
                    ) : null}

                    <span className={`flex h-9 w-9 items-center justify-center rounded-[11px] shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition ${active ? "bg-black text-white" : "bg-[#202638] text-white"}`}>
                      <Store size={16} strokeWidth={1.8} />
                    </span>

                    <div className="mt-5 flex aspect-[1.18] items-center justify-center rounded-[14px] bg-[#f4f5f7] p-3.5">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.title} className="h-full w-full object-contain mix-blend-multiply transition duration-300 group-hover:scale-[1.025]" />
                      ) : (
                        <PackageOpen className="text-[#9aa2b5]" size={32} />
                      )}
                    </div>

                    <div className="mt-4 flex flex-1 flex-col">
                      <h2 className="line-clamp-2 text-[14px] font-semibold leading-[1.2] tracking-[-0.025em] text-[#121827]">
                        {product.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[#737b90]">
                        Produto pronto para testar a criação automática da primeira vitrine.
                      </p>
                      <div className="mt-auto pt-4">
                        <p className="text-[10.5px] font-semibold text-[#7c8497]">Custo estimado</p>
                        <p className="mt-0.5 text-[18px] font-bold tracking-[-0.04em] text-[#121827]">{formatPrice(product.price)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="sticky bottom-0 mt-7 flex flex-col gap-3 border-t border-[#e7ebf2] bg-[#fbfbfc]/92 py-4 backdrop-blur md:flex-row md:items-center md:justify-between">
              <p className="text-[12.5px] font-medium text-[#697083]">
                {selectedProducts.length > 0
                  ? `${selectedProducts.length} produto${selectedProducts.length > 1 ? "s" : ""} selecionado${selectedProducts.length > 1 ? "s" : ""}`
                  : singleSelection
                    ? "Escolha um produto para continuar"
                    : "Escolha um ou mais produtos para continuar"}
              </p>
              <button
                type="button"
                onClick={continueWithProducts}
                disabled={selectedProducts.length === 0 || creating}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-black px-8 text-[14px] font-bold text-white shadow-[0_14px_30px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:bg-[#202020] disabled:cursor-not-allowed disabled:bg-[#c9ced8] disabled:shadow-none"
              >
                {creating ? <><Loader2 size={15} className="animate-spin" /> Criando projeto</> : "Continuar"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
};

export default ExampleProductSelectionPage;
