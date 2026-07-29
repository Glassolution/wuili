import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Globe2,
  Link2,
  Loader2,
  NotebookText,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { proxyImageList } from "@/lib/imageProxy";
import { readAiProductPages, type AiProductPageStatus } from "@/lib/aiProductPages";
import { createUserProject } from "@/lib/userProjects";

const statusLabel: Record<AiProductPageStatus, string> = {
  rascunho: "Rascunho",
  gerando: "Gerando",
  publicada: "Publicada",
};

const statusClassName: Record<AiProductPageStatus, string> = {
  rascunho: "bg-[#F1F2F4] text-[#596170]",
  gerando: "bg-[#FFF3D6] text-[#9A6700]",
  publicada: "bg-[#E8F7EE] text-[#137A42]",
};

const formatUpdatedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Atualizada recentemente";

  return `Atualizada em ${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)}`;
};

type CatalogProductRow = Database["public"]["Tables"]["catalog_products"]["Row"];

type SavedProductSearchItem = Pick<CatalogProductRow, "id" | "title" | "category" | "cost_price" | "images"> & {
  added_at: string | null;
};

type SavedProductSearchRow = {
  product_id: string;
  added_at: string | null;
  catalog_products:
    | Pick<CatalogProductRow, "id" | "title" | "category" | "cost_price" | "images">
    | Array<Pick<CatalogProductRow, "id" | "title" | "category" | "cost_price" | "images">>
    | null;
};

type CreateStep = "produto" | "copy" | "template";
type TargetAudience = "mulher" | "homem" | "unissex";

const audienceOptions: Array<{ id: TargetAudience; label: string }> = [
  { id: "mulher", label: "Mulher" },
  { id: "homem", label: "Homem" },
  { id: "unissex", label: "Unissex" },
];

const copywritingAngles = [
  {
    id: "beneficio-principal",
    icon: "✨",
    title: "Benefício principal",
    description: "Copy focada no resultado mais desejado pelo comprador.",
  },
  {
    id: "uso-diario",
    icon: "⚡",
    title: "Uso no dia a dia",
    description: "Mostra como o produto melhora a rotina sem complicação.",
  },
  {
    id: "presente-ideal",
    icon: "🎁",
    title: "Presente ideal",
    description: "Aborda compradores procurando uma opção prática para presentear.",
  },
  {
    id: "qualidade-confianca",
    icon: "🛡️",
    title: "Qualidade e confiança",
    description: "Reforça segurança, durabilidade e decisão sem risco.",
  },
  {
    id: "oferta-direta",
    icon: "🏷️",
    title: "Oferta direta",
    description: "CTA mais objetivo para quem já entende o valor do produto.",
  },
  {
    id: "urgencia-leve",
    icon: "⏱️",
    title: "Urgência leve",
    description: "Estimula ação rápida sem parecer agressivo ou exagerado.",
  },
];

const templateOptions = [
  { id: "greens", name: "Greens", preview: "/template-produto-preview.png", editorTemplateId: "produto-1" },
  { id: "bloom", name: "Bloom", preview: "/template-produto-2-preview.png", editorTemplateId: "produto-2" },
  { id: "honey", name: "Honey", preview: "/template-produto-3-preview.png", editorTemplateId: "produto-3" },
  { id: "clarity", name: "Clarity", preview: "/template-produto-4-preview.png", editorTemplateId: "produto-4" },
];

const getProductImage = (images: Json | null) => {
  if (!images) return null;

  const rawList: string[] = (() => {
    if (Array.isArray(images)) {
      return images.filter((image): image is string => typeof image === "string" && image.trim().length > 0);
    }

    if (typeof images === "string") {
      try {
        const parsed: unknown = JSON.parse(images);
        return Array.isArray(parsed)
          ? parsed.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
          : [images];
      } catch {
        return [images];
      }
    }

    return [];
  })();

  const [image] = proxyImageList(rawList);
  return image ?? null;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const PageHeader = ({ onCreate }: { onCreate: () => void }) => (
  <header className="flex flex-col gap-5 border-b border-black/[0.07] pb-6 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#E8EFFF] text-[#2563EB] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.08)]">
          <NotebookText size={20} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A8495]">
            Produtos vencedores
          </p>
          <h1 className="mt-0.5 text-[25px] font-semibold leading-tight tracking-[-0.04em] text-[#171A21]">
            Páginas com IA
          </h1>
        </div>
      </div>
      <p className="mt-3 max-w-[620px] text-[13px] font-medium leading-5 text-[#697181]">
        Crie, encontre e gerencie páginas de produto desenvolvidas pela inteligência artificial da Velo.
      </p>
    </div>

    <button
      type="button"
      onClick={onCreate}
      data-testid="create-ai-page"
      className="group inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[13px] bg-[#1D4ED8] px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(29,78,216,0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#1E40AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40 focus-visible:ring-offset-2"
    >
      <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
      Criar Página com IA
      <Plus size={15} strokeWidth={2.2} className="transition-transform duration-200 group-hover:rotate-90" aria-hidden="true" />
    </button>
  </header>
);

export const AiProductPageCreatePendingPage = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const [productUrl, setProductUrl] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<SavedProductSearchItem | null>(null);
  const [createStep, setCreateStep] = useState<CreateStep>("produto");
  const [products, setProducts] = useState<SavedProductSearchItem[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearchError, setProductSearchError] = useState<string | null>(null);
  const [language, setLanguage] = useState("pt-BR");
  const [aiImageCount, setAiImageCount] = useState(0);
  const [targetAudience, setTargetAudience] = useState<TargetAudience>("homem");
  const [copywritingAngle, setCopywritingAngle] = useState(copywritingAngles[0].id);
  const [customAngle, setCustomAngle] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [creatingPage, setCreatingPage] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);

  const normalizedProductSearch = productSearch.trim();
  const canContinue = productUrl.trim().length > 0 || selectedProduct !== null;
  const filteredProducts = useMemo(() => {
    const term = normalizedProductSearch.toLocaleLowerCase("pt-BR");
    if (!term) return products;
    return products.filter((product) => product.title.toLocaleLowerCase("pt-BR").includes(term));
  }, [normalizedProductSearch, products]);

  useEffect(() => {
    if (!productDropdownOpen || !user?.id || productsLoaded) return;

    let active = true;
    setLoadingProducts(true);
    setProductSearchError(null);

    void (async () => {
      const { data, error } = await supabase
        .from("collection_products")
        .select(
          `
            product_id,
            added_at,
            collections!inner(user_id),
            catalog_products!inner(id,title,category,cost_price,images,is_active,is_blocked,stock_quantity)
          `,
        )
        .eq("collections.user_id", user.id)
        .eq("catalog_products.is_active", true)
        .eq("catalog_products.is_blocked", false)
        .gt("catalog_products.stock_quantity", 0)
        .order("added_at", { ascending: false, nullsFirst: false });

      if (!active) return;

      if (error) {
        setProductSearchError("Não foi possível buscar seus produtos agora.");
        setProducts([]);
      } else {
        const seen = new Set<string>();
        const nextProducts = ((data ?? []) as unknown as SavedProductSearchRow[]).flatMap((row) => {
          const product = Array.isArray(row.catalog_products) ? row.catalog_products[0] : row.catalog_products;
          if (!product || seen.has(product.id)) return [];
          seen.add(product.id);
          return [{ ...product, added_at: row.added_at }];
        });
        setProducts(nextProducts);
        setProductsLoaded(true);
      }

      setLoadingProducts(false);
    })();

    return () => {
      active = false;
    };
  }, [productDropdownOpen, productsLoaded, user?.id]);

  useEffect(() => {
    if (!productDropdownOpen) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && productSearchRef.current?.contains(target)) return;
      setProductDropdownOpen(false);
    };

    window.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [productDropdownOpen]);

  useEffect(() => {
    if (user?.id) return;
    setProducts([]);
    setProductsLoaded(false);
    setProductDropdownOpen(false);
    setProductSearchError(null);
  }, [user?.id]);

  const openProductDropdown = () => {
    setProductDropdownOpen(true);
    if (productSearchError) {
      setProductSearchError(null);
    }
  }

  const selectProduct = (product: SavedProductSearchItem) => {
    setSelectedProduct(product);
    setProductSearch(product.title);
    setProductUrl("");
    setProductDropdownOpen(false);
  };

  const handleCreatePage = async () => {
    if (!selectedTemplate || creatingPage) return;
    const selectedTemplateOption = templateOptions.find((template) => template.id === selectedTemplate);
    const editorTemplateId = selectedTemplateOption?.editorTemplateId ?? "produto-1";
    const selectedAngle = copywritingAngles.find((angle) => angle.id === copywritingAngle);
    const selectedAudience = audienceOptions.find((audience) => audience.id === targetAudience);
    const productImage = selectedProduct ? getProductImage(selectedProduct.images) ?? "" : "";
    const flowProduct = {
      id: selectedProduct?.id ?? "",
      title: selectedProduct?.title ?? "Produto importado por link",
      price: Number(selectedProduct?.cost_price ?? 0) || 0,
      imageUrl: productImage,
    };
    const flowState = {
      product: flowProduct,
      language,
      persona: selectedAudience?.label ?? "",
      salesAngle: customAngle.trim() || selectedAngle?.title || "",
    };

    setCreatingPage(true);
    const toastId = veloToast.loading("Criando página de produto...");

    try {
      try {
        sessionStorage.setItem("velo-onboarding-choice", "sales-page");
        sessionStorage.setItem("velo-example-product", JSON.stringify(flowProduct));
        sessionStorage.setItem("velo-store-language", language);
        sessionStorage.setItem("velo-customer-persona", flowState.persona);
        sessionStorage.setItem("velo-sales-angle", flowState.salesAngle);
      } catch {
        /* sessionStorage pode estar indisponível em navegação privada. */
      }

      const project = await createUserProject({
        nome: selectedProduct?.title.trim() || "Página de produto com IA",
        descricao: flowState.salesAngle || "Página de produto criada com IA pela Velo.",
        tipo: "pagina_venda",
        productIds: selectedProduct?.id ? [selectedProduct.id] : [],
        template: editorTemplateId,
      });

      veloToast.success("Página criada. Abrindo editor...", { id: toastId, duration: 2200 });
      navigate(`/minha-loja/editor/${project.id}`, {
        state: {
          ...flowState,
          projectId: project.id,
          aiProductPage: {
            template: editorTemplateId,
            productUrl: productUrl.trim() || null,
            aiImageCount,
            targetAudience,
            copywritingAngle,
            customAngle: customAngle.trim() || null,
          },
        },
      });
    } catch (error) {
      console.error("Falha ao criar página de produto com IA:", error);
      veloToast.error("Não foi possível criar a página agora. Tente novamente.", { id: toastId });
      setCreatingPage(false);
    }
  };

  if (createStep === "template") {
    return (
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-[1180px]"
        data-testid="ai-page-create-step-3"
      >
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setCreateStep("copy")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-black/[0.08] bg-white text-[#242933] transition hover:bg-[#F5F6F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35"
              aria-label="Voltar para a etapa de copy"
            >
              <ArrowLeft size={18} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A8495]">Etapa 3 de 3</p>
              <h1 className="mt-0.5 text-[24px] font-semibold leading-tight tracking-[-0.04em] text-[#171A21]">
                Criar página de produto com IA
              </h1>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_16px_45px_rgba(31,36,48,0.06)]">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-black/[0.06] px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={() => setCreateStep("copy")}
              disabled={creatingPage}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-black/[0.08] bg-white px-4 text-[13px] font-semibold text-[#242933] shadow-[0_2px_8px_rgba(31,36,48,0.03)] transition hover:bg-[#F5F6F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
              Voltar
            </button>
            <h2 className="min-w-0 text-center text-[16px] font-semibold tracking-[-0.025em] text-[#171A21]">
              Escolha o template
            </h2>
            <button
              type="button"
              onClick={handleCreatePage}
              disabled={creatingPage || !selectedTemplate}
              className="group inline-flex h-10 min-w-[190px] items-center justify-center gap-2 rounded-[12px] bg-[#2563EB] px-4 text-[13px] font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
            >
              {creatingPage ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
              )}
              {creatingPage ? "Criando..." : "Criar página de produto"}
            </button>
          </div>

          <div className="grid max-h-[calc(100vh-240px)] gap-4 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
            {templateOptions.map((template) => {
              const selected = selectedTemplate === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplate((current) => (current === template.id ? null : template.id))}
                  className={`group relative overflow-hidden rounded-[14px] border bg-white p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35 ${
                    selected
                      ? "border-[#2563EB]"
                      : "border-black/[0.08] hover:-translate-y-0.5 hover:border-[#2563EB]/35 hover:shadow-[0_12px_28px_rgba(31,36,48,0.08)]"
                  }`}
                  aria-pressed={selected}
                >
                  <span className="mb-2 block px-1 text-[14px] font-semibold text-[#171A21]">{template.name}</span>
                  <span className="relative block h-[310px] overflow-hidden rounded-[10px] bg-[#F3F5F8]">
                    <img
                      src={template.preview}
                      alt=""
                      className={`h-full w-full object-cover object-top transition duration-300 ${selected ? "scale-[1.01]" : "group-hover:scale-[1.025]"}`}
                    />
                    {!selected ? (
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/35 to-transparent pb-4 pt-16 opacity-0 transition group-hover:opacity-100">
                        <span className="rounded-[12px] bg-white px-5 py-2 text-[13px] font-semibold text-[#171A21] shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
                          Selecionar
                        </span>
                      </span>
                    ) : null}
                  </span>
                  {selected ? (
                    <span className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#2563EB] text-white ring-4 ring-white">
                      <CheckCircle2 size={18} strokeWidth={2.4} aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </motion.section>
    );
  }

  if (createStep === "copy") {
    return (
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-[1180px]"
        data-testid="ai-page-create-step-2"
      >
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setCreateStep("produto")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-black/[0.08] bg-white text-[#242933] transition hover:bg-[#F5F6F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35"
              aria-label="Voltar para a etapa de produto"
            >
              <ArrowLeft size={18} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A8495]">Etapa 2 de 3</p>
              <h1 className="mt-0.5 text-[24px] font-semibold leading-tight tracking-[-0.04em] text-[#171A21]">
                Criar página de produto com IA
              </h1>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_16px_45px_rgba(31,36,48,0.06)]">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-black/[0.06] px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={() => setCreateStep("produto")}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-black/[0.08] bg-white px-4 text-[13px] font-semibold text-[#242933] shadow-[0_2px_8px_rgba(31,36,48,0.03)] transition hover:bg-[#F5F6F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35"
            >
              <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
              Voltar
            </button>
            <h2 className="min-w-0 text-center text-[16px] font-semibold tracking-[-0.025em] text-[#171A21]">
              Escolha público e ângulo de copywriting
            </h2>
            <button
              type="button"
              onClick={() => setCreateStep("template")}
              className="group inline-flex h-10 items-center gap-2 rounded-[12px] bg-[#1D4ED8] px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(29,78,216,0.2)] transition hover:-translate-y-0.5 hover:bg-[#1E40AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40 focus-visible:ring-offset-2"
            >
              Próximo
              <ArrowRight size={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          </div>

          <div className="p-4 sm:p-5">
            <section>
              <p className="text-[13px] font-semibold text-[#242933]">Público-alvo</p>
              <p className="mt-1 text-[13px] font-medium text-[#747D8C]">
                Selecione o público do produto. Isso personaliza imagens, CTA, linguagem e copy da página.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {audienceOptions.map((option) => {
                  const selected = targetAudience === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTargetAudience(option.id)}
                      className={`h-11 rounded-[12px] border px-4 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35 ${
                        selected
                          ? "border-[#2563EB] bg-[#F3F6FF] text-[#171A21] shadow-[0_4px_14px_rgba(37,99,235,0.08)]"
                          : "border-black/[0.08] bg-white text-[#697181] hover:bg-[#F7F8FB]"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-5 border-t border-black/[0.06] pt-5">
              <p className="text-[13px] font-semibold text-[#242933]">Ângulo de copywriting</p>
              <p className="mt-1 text-[13px] font-medium text-[#747D8C]">
                O ângulo define como a oferta será posicionada para o mercado. Escolha o que combina melhor com o produto.
              </p>

              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {copywritingAngles.map((angle) => {
                  const selected = copywritingAngle === angle.id;
                  return (
                    <button
                      key={angle.id}
                      type="button"
                      onClick={() => setCopywritingAngle(angle.id)}
                      className={`flex min-h-[66px] items-center gap-3 rounded-[12px] border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35 ${
                        selected
                          ? "border-[#2563EB] bg-[#F7F8FF] shadow-[0_6px_18px_rgba(37,99,235,0.08)]"
                          : "border-black/[0.08] bg-white hover:bg-[#F7F8FB]"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          selected ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[#D6DBE5] bg-white"
                        }`}
                      >
                        {selected ? <CheckCircle2 size={13} strokeWidth={2.4} aria-hidden="true" /> : null}
                      </span>
                      <span className="text-[18px]" aria-hidden="true">
                        {angle.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold text-[#242933]">{angle.title}</span>
                        <span className="mt-0.5 block text-[12px] font-medium leading-4 text-[#747D8C]">{angle.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-5">
              <label htmlFor="custom-copy-angle" className="mb-2 block text-[13px] font-semibold text-[#242933]">
                Adicione seu próprio ângulo abaixo (opcional)
              </label>
              <textarea
                id="custom-copy-angle"
                value={customAngle}
                onChange={(event) => setCustomAngle(event.target.value)}
                placeholder="Digite um ângulo de copy personalizado..."
                rows={3}
                className="w-full resize-none rounded-[12px] border border-black/[0.08] bg-white px-4 py-3 text-[13px] font-medium leading-5 text-[#242933] outline-none transition placeholder:text-[#9AA2AF] focus:border-[#2563EB]/45 focus:ring-4 focus:ring-[#2563EB]/[0.08]"
              />
            </section>
          </div>
        </div>
      </motion.section>
    );
  };

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-[1180px]"
      data-testid="ai-page-create-step-1"
    >
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard/paginas-com-ia")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-black/[0.08] bg-white text-[#242933] transition hover:bg-[#F5F6F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35"
            aria-label="Voltar para a listagem"
          >
            <ArrowLeft size={18} strokeWidth={1.9} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A8495]">Etapa 1 de 3</p>
            <h1 className="mt-0.5 text-[24px] font-semibold leading-tight tracking-[-0.04em] text-[#171A21]">
              Criar página de produto com IA
            </h1>
          </div>
        </div>
      </div>

      <div className="overflow-visible rounded-[24px] border border-black/[0.07] bg-white p-4 shadow-[0_16px_45px_rgba(31,36,48,0.06)] sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_34px_minmax(0,1fr)] lg:items-start">
          <div>
            <label htmlFor="ai-product-url" className="mb-2 block text-[13px] font-semibold text-[#242933]">
              URL do produto (AliExpress, Amazon, TikTok, Etsy)
            </label>
            <div className="group flex h-11 items-center gap-3 rounded-[12px] border border-black/[0.08] bg-white px-4 shadow-[0_2px_8px_rgba(31,36,48,0.03)] transition focus-within:border-[#2563EB]/45 focus-within:ring-4 focus-within:ring-[#2563EB]/[0.08]">
              <Link2 size={17} strokeWidth={1.9} className="shrink-0 text-[#7A8495] transition group-focus-within:text-[#2563EB]" aria-hidden="true" />
              <input
                id="ai-product-url"
                type="url"
                value={productUrl}
                onChange={(event) => {
                  setProductUrl(event.target.value);
                  if (event.target.value.trim()) setSelectedProduct(null);
                }}
                placeholder="Cole o link do produto"
                className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] font-medium text-[#242933] outline-none placeholder:text-[#9AA2AF]"
              />
            </div>
          </div>

          <div className="flex items-center justify-center pt-0 lg:pt-8">
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full border border-black/[0.07] bg-[#F7F8FB] px-2 text-[11px] font-semibold lowercase text-[#7A8495]">
              ou
            </span>
          </div>

          <div ref={productSearchRef} className="relative">
            <label htmlFor="ai-product-search" className="mb-2 block text-[13px] font-semibold text-[#242933]">
              Buscar produto salvo na Velo
            </label>
            <div className="group flex h-11 items-center gap-3 rounded-[12px] border border-black/[0.08] bg-white px-4 shadow-[0_2px_8px_rgba(31,36,48,0.03)] transition focus-within:border-[#2563EB]/45 focus-within:ring-4 focus-within:ring-[#2563EB]/[0.08]">
              <Search size={17} strokeWidth={1.9} className="shrink-0 text-[#7A8495] transition group-focus-within:text-[#2563EB]" aria-hidden="true" />
              <input
                id="ai-product-search"
                type="search"
                value={productSearch}
                onFocus={openProductDropdown}
                onChange={(event) => {
                  setProductSearch(event.target.value);
                  setSelectedProduct(null);
                  setProductDropdownOpen(true);
                  if (productUrl.trim()) setProductUrl("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setProductDropdownOpen(false);
                  }
                }}
                placeholder="Digite o nome do produto salvo"
                autoComplete="off"
                aria-expanded={productDropdownOpen}
                aria-controls="saved-products-dropdown"
                className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] font-medium text-[#242933] outline-none placeholder:text-[#9AA2AF]"
              />
              {loadingProducts ? <Loader2 size={16} className="shrink-0 animate-spin text-[#7A8495]" aria-hidden="true" /> : null}
            </div>

            {selectedProduct ? (
              <div className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-[#137A42]">
                <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />
                Produto selecionado
              </div>
            ) : null}

            {productDropdownOpen ? (
              <div
                id="saved-products-dropdown"
                className="absolute left-0 right-0 top-[74px] z-20 overflow-hidden rounded-[16px] border border-black/[0.06] bg-white shadow-[0_18px_38px_rgba(31,36,48,0.13)]"
              >
                {productSearchError ? (
                  <p className="px-4 py-3 text-[13px] font-medium text-[#B42318]">{productSearchError}</p>
                ) : loadingProducts ? (
                  <div className="flex h-24 items-center justify-center gap-2 text-[13px] font-medium text-[#747D8C]">
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    Carregando produtos salvos...
                  </div>
                ) : filteredProducts.length > 0 ? (
                  <div className="max-h-[292px] overflow-y-auto p-1.5">
                    {filteredProducts.map((product) => {
                      const image = getProductImage(product.images);
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => selectProduct(product)}
                          className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition hover:bg-[#F5F7FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-[#F1F4F8] text-[#8B96A8]">
                            {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <NotebookText size={18} strokeWidth={1.7} aria-hidden="true" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 block text-[13px] font-semibold text-[#242933]">{product.title}</span>
                            <span className="mt-0.5 flex items-center gap-2 text-[11px] font-medium text-[#7A8495]">
                              <span className="truncate">{product.category ?? "Produto Velo"}</span>
                              <span className="shrink-0">{formatCurrency(product.cost_price)}</span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-4 py-3 text-[13px] font-medium text-[#747D8C]">Nenhum produto encontrado</p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-3 border-b border-black/[0.06] pb-5 text-[18px] font-semibold text-[#B9BEC7] sm:text-[20px]">
          <span className="text-[#F05A28]">AliExpress</span>
          <span className="text-[#232F3E]/55">amazon</span>
          <span className="text-[#111827]/35">TikTok Shop</span>
          <span className="text-[#F56400]/45">Etsy</span>
          <span className="tracking-[0.18em] text-[#111827]/30">SHEIN</span>
        </div>

        <div className="mt-5">
          <label htmlFor="ai-page-language" className="mb-2 block text-[13px] font-semibold text-[#242933]">
            Idioma
          </label>
          <select
            id="ai-page-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="h-11 w-full rounded-[12px] border border-black/[0.08] bg-white px-4 text-[13px] font-medium text-[#242933] outline-none transition focus:border-[#2563EB]/45 focus:ring-4 focus:ring-[#2563EB]/[0.08]"
          >
            <option value="pt-BR">🇧🇷 Brasileiro</option>
            <option value="en-US">🇺🇸 Inglês</option>
            <option value="es">🇪🇸 Espanhol</option>
          </select>
        </div>

        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-[#242933]">Criar imagens de produto com IA automaticamente com a página</p>
            <span className="rounded-full bg-[#F0E9FF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#7C3AED]">Novo</span>
          </div>
          <p className="mt-2 text-[12px] font-medium text-[#747D8C]">Quantas imagens criar?</p>
          <div className="mt-2 inline-grid grid-cols-7 overflow-hidden rounded-[12px] border border-black/[0.08] bg-[#F4F6F9] p-1">
            {[0, 1, 2, 3, 4, 5, 6].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setAiImageCount(count)}
                className={`h-8 min-w-11 rounded-[9px] px-3 text-[12px] font-semibold transition ${
                  aiImageCount === count
                    ? "bg-white text-[#242933] shadow-[0_2px_8px_rgba(31,36,48,0.08)]"
                    : "text-[#9AA2AF] hover:text-[#242933]"
                }`}
              >
                {count === 0 ? "Nenhuma" : count}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] font-medium text-[#747D8C]">
            Disponível apenas nos planos Starter e Scaler. <span className="font-semibold text-[#242933]">Fazer upgrade</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateStep("copy")}
          disabled={!canContinue}
          className="group mt-5 inline-flex h-10 items-center gap-2 rounded-[12px] bg-[#111827] px-5 text-[13px] font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:bg-[#A8AFBA] disabled:hover:translate-y-0"
        >
          Próximo
          <ArrowRight size={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      </div>
    </motion.section>
  );
};

const AiProductPagesPage = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const [pages] = useState(() => readAiProductPages(user?.id ?? "dev-user"));
  const hasPages = pages.length > 0;

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-[1180px]"
      data-testid="ai-pages-list"
    >
      <PageHeader onCreate={() => navigate("/dashboard/paginas-com-ia/criar")} />

      <div className="mt-6 overflow-hidden rounded-[24px] border border-black/[0.07] bg-white p-3 shadow-[0_16px_45px_rgba(31,36,48,0.06)] sm:p-4">
        {!hasPages ? (
          <div
            className="flex min-h-[430px] flex-col items-center justify-center rounded-[19px] bg-[#F8FAFC] px-6 py-12 text-center"
            data-testid="ai-pages-empty"
          >
            <div className="relative">
              <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-white text-[#2563EB] shadow-[0_10px_25px_rgba(31,36,48,0.08)] ring-1 ring-black/[0.05]">
                <NotebookText size={28} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#DCE7FF] text-[#1D4ED8] ring-4 ring-[#F8FAFC]">
                <Sparkles size={13} strokeWidth={2} aria-hidden="true" />
              </span>
            </div>
            <h2 className="mt-6 text-[20px] font-semibold tracking-[-0.035em] text-[#1F2430]">
              Nenhuma página encontrada
            </h2>
            <p className="mt-2 max-w-[440px] text-[13px] font-medium leading-5 text-[#747D8C]">
              Você ainda não criou páginas de produto com IA. Comece agora e transforme um produto em uma página pronta para vender.
            </p>
            <button
              type="button"
              onClick={() => navigate("/dashboard/paginas-com-ia/criar")}
              className="group mt-6 inline-flex h-11 items-center gap-2 rounded-[14px] border border-[#C9D6FA] bg-white px-5 text-[13px] font-semibold text-[#1D4ED8] shadow-[0_8px_20px_rgba(31,36,48,0.06)] transition hover:-translate-y-0.5 hover:border-[#2563EB]/35 hover:shadow-[0_12px_28px_rgba(37,99,235,0.12)]"
            >
              <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
              Criar primeira página com IA
              <ArrowRight size={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="ai-pages-grid">
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => navigate(`/dashboard/paginas-com-ia/${page.id}/editar`)}
                className="group overflow-hidden rounded-[18px] border border-black/[0.07] bg-white text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#2563EB]/25 hover:shadow-[0_12px_26px_rgba(31,36,48,0.08)]"
              >
                <div className="flex h-36 items-center justify-center overflow-hidden bg-[#F2F5F9]">
                  {page.productImage ? (
                    <img src={page.productImage} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" />
                  ) : (
                    <NotebookText size={30} strokeWidth={1.5} className="text-[#8B96A8]" aria-hidden="true" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="line-clamp-2 text-[14px] font-semibold leading-5 text-[#242933]">{page.productName}</h2>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClassName[page.status]}`}>
                      {statusLabel[page.status]}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-[11px] font-medium text-[#7A8495]">
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      <Globe2 size={13} aria-hidden="true" />
                      {page.source}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Clock3 size={13} aria-hidden="true" />
                      {formatUpdatedAt(page.updatedAt)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
};

export default AiProductPagesPage;
