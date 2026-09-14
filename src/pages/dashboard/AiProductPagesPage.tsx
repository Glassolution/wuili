import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Link2,
  Loader2,
  NotebookText,
  Pencil,
  Search,
  Trash2,
  Wallet,
  WandSparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import PixKeyModal from "@/components/dashboard/PixKeyModal";
import { veloToast } from "@/components/ui/velo-toast";
import { isSupabaseEnabled, supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { proxyImageList } from "@/lib/imageProxy";
import { editorTemplateName, salesPageTemplates } from "@/lib/salesPageTemplates";
import { CURRENT_PRODUCT_TEMPLATE_ID } from "@/components/store-templates/productTemplateRegistry";
import { createUserProject, fetchUserProjects, getProjectProductIds, type ProjectStatus, type UserProject } from "@/lib/userProjects";
import { listAiProductPages, type AiProductPageRow } from "@/lib/aiPageGeneration";

const statusLabel: Record<ProjectStatus, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
};

const statusClassName: Record<ProjectStatus, string> = {
  rascunho: "border-[#F4D2D2] bg-[#FFF6F6] text-[#A02C2C]",
  publicado: "border-[#CBEBD8] bg-[#F1FFF6] text-[#137A42]",
};

const formatProjectDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Criada recentemente";

  const dayMonth = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return `${dayMonth} às ${time}`;
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

type ProductPreview = Pick<CatalogProductRow, "id" | "title" | "images">;

type AiProjectListItem = {
  id: string;
  name: string;
  image: string | null;
  templateName: string;
  source: string;
  status: ProjectStatus;
  createdAt: string;
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

const templateOptions = salesPageTemplates;

const getProjectMetadata = (project: UserProject) => {
  const metadata = project.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
};

const getProjectTemplateName = (project: UserProject) => {
  const template = getProjectMetadata(project).template;
  // Id de template removido (projeto antigo) abre no template atual — mostrar o
  // id cru aqui faria a lista prometer um layout que não existe mais.
  const currentName = editorTemplateName[CURRENT_PRODUCT_TEMPLATE_ID];
  if (typeof template !== "string") return "Template";
  return editorTemplateName[template] ?? (template.startsWith("loja") ? "Loja" : currentName);
};

const getProjectSource = (project: UserProject) => {
  const metadata = getProjectMetadata(project);
  const source = metadata.source;
  if (typeof source === "string" && source.trim()) return source.trim();
  if (project.source_kind === "aliexpress") return "AliExpress";
  if (project.source_kind === "mercado_livre") return "Mercado Livre";
  if (project.source_kind === "shopee") return "Shopee";
  return getProjectProductIds(project).length > 0 ? "Velo" : "Link externo";
};

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

const PageHeader = ({
  onAddPix,
  onCreate,
  onTutorial,
}: {
  onAddPix: () => void;
  onCreate: () => void;
  onTutorial: () => void;
}) => (
  <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-2.5">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#0F1117] transition hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/25"
        aria-label="Voltar"
      >
        <ArrowLeft size={22} strokeWidth={2.35} aria-hidden="true" />
      </button>
      <h1 className="truncate text-[28px] font-black leading-none tracking-[-0.05em] text-[#090B10]">
        Páginas com IA
      </h1>
    </div>

    <div className="flex shrink-0 flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={onTutorial}
        className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-black/[0.14] bg-white px-3.5 text-[13px] font-black tracking-[-0.015em] text-[#0F1117] shadow-[0_1px_3px_rgba(15,17,23,0.11)] transition duration-150 hover:border-black/[0.22] hover:bg-[#FAFAFA] hover:shadow-[0_2px_5px_rgba(15,17,23,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/25"
      >
        <GraduationCap size={17} strokeWidth={2.1} aria-hidden="true" />
        Ver tutorial
      </button>

      <button
        type="button"
        onClick={onAddPix}
        className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-[#C7D7FE] bg-[#EFF6FF] px-3.5 text-[13px] font-black tracking-[-0.015em] text-[#2563EB] shadow-[0_1px_3px_rgba(37,99,235,0.10)] transition duration-150 hover:border-[#9DB8FD] hover:bg-[#E7F0FF] hover:shadow-[0_2px_5px_rgba(37,99,235,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/25"
      >
        <Wallet size={16} strokeWidth={2.05} aria-hidden="true" />
        Adicionar Pix
      </button>

      <button
        type="button"
        onClick={onCreate}
        data-testid="create-ai-page"
        className="velo-prime-button velo-prime-button--blue"
      >
        <WandSparkles size={16} strokeWidth={2.05} aria-hidden="true" />
        <span>Criar página com IA</span>
      </button>
    </div>
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
  // Quando o usuário chega clicando num card da galeria de Modelos, aquele
  // template vem em location.state. Sem isso a escolha dele era descartada e o
  // wizard caía no template padrão.
  const location = useLocation();
  const templateFromGallery = (location.state as { templateId?: string } | null)?.templateId;
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(
    templateOptions.some((template) => template.id === templateFromGallery) ? templateFromGallery! : null,
  );
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
      try {
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
        if (error) throw error;

        const seen = new Set<string>();
        const nextProducts = ((data ?? []) as unknown as SavedProductSearchRow[]).flatMap((row) => {
          const product = Array.isArray(row.catalog_products) ? row.catalog_products[0] : row.catalog_products;
          if (!product || seen.has(product.id)) return [];
          seen.add(product.id);
          return [{ ...product, added_at: row.added_at }];
        });

        if (nextProducts.length > 0) {
          setProducts(nextProducts);
          setProductsLoaded(true);
          return;
        }

        const catalogResult = await supabase
          .from("catalog_products")
          .select("id,title,category,cost_price,images")
          .eq("is_active", true)
          .eq("is_blocked", false)
          .gt("stock_quantity", 0)
          .order("orders_count", { ascending: false, nullsFirst: false })
          .limit(60);

        if (!active) return;
        if (catalogResult.error) throw catalogResult.error;

        const fallbackProducts = ((catalogResult.data ?? []) as Array<Pick<CatalogProductRow, "id" | "title" | "category" | "cost_price" | "images">>)
          .map((product) => ({ ...product, added_at: null }));

        setProducts(fallbackProducts);
        setProductsLoaded(true);
      } catch (error) {
        console.error("Falha ao buscar produtos salvos:", error);
        if (!active) return;
        setProductSearchError("Não foi possível buscar seus produtos agora.");
        setProducts([]);
      } finally {
        if (active) setLoadingProducts(false);
      }
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
    const editorTemplateId = selectedTemplateOption?.editorTemplateId ?? CURRENT_PRODUCT_TEMPLATE_ID;
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
                <WandSparkles size={15} strokeWidth={2} aria-hidden="true" />
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

/**
 * Prévias geradas pelo fluxo novo da Velo. Ficam separadas das páginas
 * do editor porque não são a mesma coisa: estas ainda não viraram projeto e,
 * principalmente, não estão publicadas em lugar nenhum.
 */
const AiPreviewsSection = () => {
  const navigate = useNavigate();
  const [previews, setPreviews] = useState<AiProductPageRow[]>([]);

  useEffect(() => {
    void listAiProductPages(6)
      .then(setPreviews)
      .catch(() => setPreviews([]));
  }, []);

  if (previews.length === 0) return null;

  return (
    <section className="mt-6 rounded-[20px] border border-black/[0.07] bg-white p-4 shadow-[0_10px_30px_rgba(31,36,48,0.05)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-[#0A0A0A]">Prévias geradas por IA</h2>
          <p className="mt-0.5 text-[12px] text-[#747D8C]">Salvas na Velo e ainda não publicadas.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {previews.map((preview) => (
          <button
            key={preview.id}
            type="button"
            onClick={() => navigate(`/dashboard/paginas-com-ia/previa/${preview.id}`)}
            className="flex w-full items-center gap-3 rounded-[12px] border border-transparent px-3 py-2.5 text-left transition hover:border-black/[0.08] hover:bg-[#F8FAFC]"
          >
            <span className="min-w-0 flex-1">
              <span className="line-clamp-1 block text-[13px] font-semibold text-[#0A0A0A]">
                {preview.source_url ?? "Página gerada"}
              </span>
              <span className="text-[11px] text-[#747D8C]">{formatProjectDate(preview.created_at)}</span>
            </span>

            {preview.status === "gerando" && (
              <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[#747D8C]">
                <Loader2 size={12} className="animate-spin" /> Gerando
              </span>
            )}
            {preview.status === "pronto" && (
              <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[#22C55E]">
                <CheckCircle2 size={12} /> Pronta
              </span>
            )}
            {preview.status === "erro" && (
              <span className="shrink-0 text-[11px] font-semibold text-[#B42318]">Falhou</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
};

const AiProductPagesPage = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pages, setPages] = useState<AiProjectListItem[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [pageSearch, setPageSearch] = useState("");
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(() => new Set());
  const [deletingPages, setDeletingPages] = useState(false);
  const normalizedPageSearch = pageSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredPages = useMemo(() => {
    if (!normalizedPageSearch) return pages;
    return pages.filter((page) => page.name.toLocaleLowerCase("pt-BR").includes(normalizedPageSearch));
  }, [normalizedPageSearch, pages]);
  const hasPages = pages.length > 0;
  const filteredPageIds = useMemo(() => filteredPages.map((page) => page.id), [filteredPages]);
  const selectedCount = selectedPageIds.size;
  const allVisibleSelected =
    filteredPageIds.length > 0 && filteredPageIds.every((pageId) => selectedPageIds.has(pageId));

  const togglePageSelection = (pageId: string) => {
    setSelectedPageIds((current) => {
      const next = new Set(current);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedPageIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        filteredPageIds.forEach((pageId) => next.delete(pageId));
      } else {
        filteredPageIds.forEach((pageId) => next.add(pageId));
      }
      return next;
    });
  };

  const handleDeleteSelectedPages = async () => {
    if (!user?.id || selectedPageIds.size === 0 || deletingPages) return;

    const idsToDelete = Array.from(selectedPageIds);
    const confirmed = window.confirm(
      idsToDelete.length === 1
        ? "Tem certeza que deseja excluir esta página com IA? Essa ação não pode ser desfeita."
        : `Tem certeza que deseja excluir ${idsToDelete.length} páginas com IA? Essa ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    setDeletingPages(true);
    try {
      const { error } = await supabase
        .from("user_projects")
        .delete()
        .in("id", idsToDelete)
        .eq("user_id", user.id)
        .eq("tipo_projeto", "pagina_venda");
      if (error) throw error;

      const deletedIds = new Set(idsToDelete);
      setPages((current) => current.filter((page) => !deletedIds.has(page.id)));
      setSelectedPageIds(new Set());
      veloToast.success(idsToDelete.length === 1 ? "Página excluída." : "Páginas excluídas.");
    } catch (error) {
      console.error("Falha ao excluir páginas com IA:", error);
      veloToast.error("Não foi possível excluir agora. Tente novamente.");
    } finally {
      setDeletingPages(false);
    }
  };

  const selectionCheckboxClass =
    "velo-selection-checkbox disabled:cursor-not-allowed disabled:opacity-50";

  useEffect(() => {
    if (!user?.id) {
      setPages([]);
      setLoadingPages(false);
      return;
    }

    if (!isSupabaseEnabled) {
      setPages([]);
      setLoadingPages(false);
      return;
    }

    let active = true;
    setLoadingPages(true);
    setPagesError(null);

    void (async () => {
      try {
        const projects = (await fetchUserProjects())
          .filter((project) => project.tipo_projeto === "pagina_venda")
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const productIds = Array.from(new Set(projects.flatMap((project) => getProjectProductIds(project).slice(0, 1))));
        const productById = new Map<string, ProductPreview>();

        if (productIds.length > 0) {
          const { data, error } = await supabase
            .from("catalog_products")
            .select("id,title,images")
            .in("id", productIds);
          if (error) throw error;
          (data ?? []).forEach((product) => productById.set(product.id, product));
        }

        const nextPages = projects.map((project): AiProjectListItem => {
          const productId = getProjectProductIds(project)[0];
          const product = productId ? productById.get(productId) : undefined;
          const metadata = getProjectMetadata(project);
          const storeName = typeof metadata.storeName === "string" && metadata.storeName.trim()
            ? metadata.storeName.trim()
            : "";

          return {
            id: project.id,
            name: product?.title || storeName || project.nome || "Página de produto",
            image: product?.images ? getProductImage(product.images) : null,
            templateName: getProjectTemplateName(project),
            source: getProjectSource(project),
            status: project.status === "publicado" ? "publicado" : "rascunho",
            createdAt: project.created_at,
          };
        });

        if (active) setPages(nextPages);
      } catch (error) {
        console.error("Falha ao carregar páginas com IA:", error);
        if (active) {
          setPages([]);
          setPagesError("Não foi possível carregar suas páginas agora.");
        }
      } finally {
        if (active) setLoadingPages(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-none px-0 py-0"
      data-testid="ai-pages-list"
    >
      <PageHeader
        onAddPix={() => setPixModalOpen(true)}
        onCreate={() => navigate("/dashboard/paginas-com-ia/criar")}
        onTutorial={() => veloToast.info("Tutorial das páginas com IA em breve.")}
      />

      <PixKeyModal open={pixModalOpen} onClose={() => setPixModalOpen(false)} />

      <AiPreviewsSection />


      <div className="mt-5 overflow-hidden rounded-[20px] border border-black/[0.16] bg-white p-4 shadow-[0_2px_5px_rgba(15,17,23,0.13)]">
        <div className="mb-5 flex h-[50px] items-center gap-3 rounded-[10px] border border-black/[0.12] bg-white px-4 shadow-[0_1px_5px_rgba(15,17,23,0.08)] transition focus-within:border-[#2563EB]/45 focus-within:ring-4 focus-within:ring-[#2563EB]/[0.08]">
          <Search size={20} strokeWidth={2.05} className="shrink-0 text-[#7D8798]" aria-hidden="true" />
          <input
            type="search"
            value={pageSearch}
            onChange={(event) => setPageSearch(event.target.value)}
            placeholder="Buscar páginas pelo nome..."
            className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-bold tracking-[-0.02em] text-[#111827] outline-none placeholder:text-[#8A93A5]"
          />
        </div>

        {selectedCount > 0 && !loadingPages ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#2563EB]/18 bg-[#EFF6FF] px-4 py-3">
            <p className="text-[13px] font-black tracking-[-0.015em] text-[#1E3A8A]">
              {selectedCount} {selectedCount === 1 ? "página selecionada" : "páginas selecionadas"}
            </p>
            <button
              type="button"
              onClick={handleDeleteSelectedPages}
              disabled={deletingPages}
              className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-[#F4B4B4] bg-white px-3.5 text-[13px] font-black tracking-[-0.015em] text-[#B42318] shadow-[0_1px_4px_rgba(15,17,23,0.08)] transition hover:border-[#E47D7D] hover:bg-[#FFF5F5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingPages ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} strokeWidth={2.1} aria-hidden="true" />}
              Excluir
            </button>
          </div>
        ) : null}

        {loadingPages ? (
          <div className="grid min-h-[360px] place-items-center rounded-[15px] bg-[#F8F9FB]">
            <div className="flex items-center gap-2 text-[14px] font-black tracking-[-0.02em] text-[#6F7788]">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Carregando páginas...
            </div>
          </div>
        ) : !hasPages ? (
          <div
            className="flex min-h-[360px] flex-col items-center justify-center rounded-[15px] bg-[#F8F9FB] px-6 py-11 text-center"
            data-testid="ai-pages-empty"
          >
            <span className="grid h-[52px] w-[52px] place-items-center rounded-[13px] bg-[#ECEEEF] text-[#0F1117]">
              <NotebookText size={27} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <h2 className="mt-6 text-[22px] font-black leading-tight tracking-[-0.05em] text-[#090B10]">
              Nenhuma página com IA encontrada
            </h2>
            <p className="mt-2.5 max-w-[560px] text-[16px] font-bold leading-snug tracking-[-0.02em] text-[#727B8D]">
              Você ainda não criou nenhuma página de produto com IA. Comece agora e veja como é fácil.
            </p>
            <button
              type="button"
              onClick={() => navigate("/dashboard/paginas-com-ia/criar")}
              className="mt-6 inline-flex h-10 items-center gap-2.5 rounded-[9px] border border-black/[0.13] bg-white px-4 text-[14px] font-black tracking-[-0.02em] text-[#0F1117] shadow-[0_1px_5px_rgba(15,17,23,0.12)] transition hover:bg-[#FAFAFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/25"
            >
              <WandSparkles size={18} strokeWidth={2.1} aria-hidden="true" />
              Criar primeira página com IA
            </button>
          </div>
        ) : (
          <div data-testid="ai-pages-table" className="overflow-hidden rounded-[15px] bg-white">
            <div className="overflow-x-auto rounded-[15px] border border-black/[0.09] bg-white">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[42px_minmax(260px,1.45fr)_minmax(120px,0.48fr)_minmax(120px,0.48fr)_minmax(130px,0.56fr)_minmax(180px,0.62fr)] items-center border-b border-black/[0.09] bg-white px-4 py-4 text-[12px] font-black uppercase tracking-[-0.01em] text-[#131722]">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleSelection}
                    disabled={filteredPageIds.length === 0 || deletingPages}
                    aria-label="Selecionar páginas visíveis"
                    className={selectionCheckboxClass}
                  />
                  <span>Página</span>
                  <span>Template</span>
                  <span>Origem</span>
                  <span>Status</span>
                  <span>Ações</span>
                </div>

                {pagesError ? (
                  <div className="px-4 py-8 text-center text-[15px] font-bold text-[#B42318]">{pagesError}</div>
                ) : filteredPages.length > 0 ? (
                  <div className="divide-y divide-black/[0.075]">
                    {filteredPages.map((page) => (
                      <div
                        key={page.id}
                        className="grid min-h-[78px] grid-cols-[42px_minmax(260px,1.45fr)_minmax(120px,0.48fr)_minmax(120px,0.48fr)_minmax(130px,0.56fr)_minmax(180px,0.62fr)] items-center px-4 py-3 transition hover:bg-[#FAFAFB]"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPageIds.has(page.id)}
                          onChange={() => togglePageSelection(page.id)}
                          disabled={deletingPages}
                          aria-label={`Selecionar ${page.name}`}
                          className={selectionCheckboxClass}
                        />
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#F3F4F6] text-[#8B96A8]">
                            {page.image ? <img src={page.image} alt="" className="h-full w-full object-cover" /> : <NotebookText size={18} strokeWidth={1.7} aria-hidden="true" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-black tracking-[-0.025em] text-[#171A21]">{page.name}</span>
                            <span className="mt-0.5 block text-[12.5px] font-bold tracking-[-0.01em] text-[#727B8D]">{formatProjectDate(page.createdAt)}</span>
                          </span>
                        </div>
                        <span className="flex items-center gap-1.5 text-[13.5px] font-black tracking-[-0.015em] text-[#242933]">
                          <Link2 size={15} strokeWidth={2.1} className="text-[#111827]" aria-hidden="true" />
                          {page.templateName}
                        </span>
                        <span className="flex items-center gap-1.5 text-[13.5px] font-black tracking-[-0.015em] text-[#242933]">
                          <Link2 size={15} strokeWidth={2.1} className="text-[#111827]" aria-hidden="true" />
                          {page.source}
                        </span>
                        <span>
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-black tracking-[-0.015em] ${statusClassName[page.status]}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${page.status === "publicado" ? "bg-[#16A34A]" : "bg-[#E11D48]"}`} aria-hidden="true" />
                            {statusLabel[page.status]}
                          </span>
                        </span>
                        <span>
                          <button
                            type="button"
                            onClick={() => navigate(`/minha-loja/editor/${page.id}`, { state: { projectId: page.id } })}
                            className="inline-flex h-10 max-w-full items-center gap-2 rounded-[9px] border border-black/[0.10] bg-white px-3.5 text-[13.5px] font-black tracking-[-0.015em] text-[#111827] shadow-[0_1px_5px_rgba(15,17,23,0.10)] transition hover:border-black/[0.16] hover:bg-[#FAFAFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/25"
                          >
                            <Pencil size={17} strokeWidth={2.1} aria-hidden="true" />
                            <span className="truncate">Editar e publicar</span>
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-10 text-center text-[16px] font-bold text-[#747D8C]">
                    Nenhuma página encontrada para essa busca.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
};

export default AiProductPagesPage;
