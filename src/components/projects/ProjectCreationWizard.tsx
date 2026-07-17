import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Store,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { createUserProject, type ProjectType } from "@/lib/userProjects";
import { veloToast } from "@/components/ui/velo-toast";

type CatalogProduct = {
  id: string;
  title: string;
  cost_price: number;
  images: Json | null;
  category: string | null;
};

type TemplateOption = {
  id: string;
  label: string;
  description: string;
  preview: string;
  tipo: ProjectType;
};

const TEMPLATES: TemplateOption[] = [
  {
    id: "loja-1",
    label: "Vitrine completa",
    description: "Loja com destaque de coleções, grade de produtos e ofertas.",
    preview: "/template-01-loja-preview.png",
    tipo: "loja_completa",
  },
  {
    id: "produto-1",
    label: "Oferta clássica",
    description: "Página de venda focada, com herói forte e prova social.",
    preview: "/template-produto-preview.png",
    tipo: "pagina_venda",
  },
  {
    id: "produto-2",
    label: "Oferta minimal",
    description: "Layout limpo, direto ao ponto, ótimo para conversão rápida.",
    preview: "/template-produto-2-preview.png",
    tipo: "pagina_venda",
  },
  {
    id: "produto-3",
    label: "Oferta premium",
    description: "Visual sofisticado com blocos de benefício e depoimentos.",
    preview: "/template-produto-3-preview.png",
    tipo: "pagina_venda",
  },
];

const LOADING_STEPS = [
  "Preparando o ambiente do projeto...",
  "Selecionando os produtos escolhidos...",
  "Montando a estrutura do template...",
  "Gerando textos e chamadas de venda com IA...",
  "Aplicando identidade visual da Velo...",
  "Salvando e protegendo o seu projeto...",
];

const LOADING_FILES = [
  "app/loja/layout.tsx",
  "components/hero/HeroSection.tsx",
  "components/product/ProductGrid.tsx",
  "content/copy.pt-BR.json",
  "styles/theme.css",
  "data/products.json",
  "config/store.config.ts",
];

function getFirstImage(images: Json | null): string | null {
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in first) {
      const url = (first as { url?: unknown }).url;
      return typeof url === "string" ? url : null;
    }
  }
  return null;
}

type Step = "info" | "produtos" | "template" | "loading";

type ProjectCreationWizardProps = {
  open: boolean;
  onClose: () => void;
  defaultTipo?: ProjectType;
  /** Se definido, esconde a escolha "página de vendas / loja completa" e trava neste tipo. */
  lockedTipo?: ProjectType;
  /** Se definido, pula a etapa de escolha de produtos e usa esses IDs. */
  preselectedProductIds?: string[];
  onCreated: (projectId: string) => void;
};

const ProjectCreationWizard = ({
  open,
  onClose,
  defaultTipo = "pagina_venda",
  lockedTipo,
  preselectedProductIds,
  onCreated,
}: ProjectCreationWizardProps) => {
  const initialTipo = lockedTipo ?? defaultTipo;
  const skipProducts = !!(preselectedProductIds && preselectedProductIds.length > 0);
  const [step, setStep] = useState<Step>("info");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [tipo, setTipo] = useState<ProjectType>(initialTipo);
  const [selectedProducts, setSelectedProducts] = useState<string[]>(preselectedProductIds ?? []);
  const [templateId, setTemplateId] = useState<string>(
    initialTipo === "loja_completa" ? "loja-1" : "produto-1",
  );

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [search, setSearch] = useState("");

  const [loadingIndex, setLoadingIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const creatingRef = useRef(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep("info");
    setNome("");
    setDescricao("");
    setLogoImage(null);
    setTipo(initialTipo);
    setSelectedProducts(preselectedProductIds ?? []);
    setTemplateId(initialTipo === "loja_completa" ? "loja-1" : "produto-1");
    setSearch("");
    setLoadingIndex(0);
    setError(null);
    creatingRef.current = false;
  }, [open, initialTipo, preselectedProductIds]);

  useEffect(() => {
    if (!open || step !== "produtos" || products.length > 0) return;
    let active = true;
    setLoadingProducts(true);
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("catalog_products")
        .select("id,title,cost_price,images,category")
        .eq("source", "c7drop")
        .eq("is_active", true)
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        .order("orders_count", { ascending: false, nullsFirst: false })
        .limit(48);
      if (!active) return;
      if (queryError) {
        setError("Não foi possível carregar os produtos do catálogo.");
      } else {
        setProducts((data ?? []) as CatalogProduct[]);
      }
      setLoadingProducts(false);
    })();
    return () => {
      active = false;
    };
  }, [open, step, products.length]);

  const availableTemplates = useMemo(
    () => TEMPLATES.filter((template) => template.tipo === tipo),
    [tipo],
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => product.title.toLowerCase().includes(term));
  }, [products, search]);

  const toggleProduct = (id: string) => {
    setSelectedProducts((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const canContinueInfo = nome.trim().length >= 2;

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      veloToast.error("Envie um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      veloToast.error("A imagem deve ter no máximo 5MB.");
      return;
    }
    setUploadingLogo(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? "anon";
      const ext = file.name.split(".").pop() || "png";
      const path = `store-logos/${uid}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("assets").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("assets").getPublicUrl(path);
      setLogoImage(data.publicUrl);
    } catch (err) {
      console.error(err);
      veloToast.error("Falha ao enviar a imagem.");
    } finally {
      setUploadingLogo(false);
    }
  };


  const runCreation = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setError(null);
    setStep("loading");

    const started = Date.now();
    try {
      const project = await createUserProject({
        nome,
        descricao,
        tipo,
        productIds: selectedProducts,
        template: templateId,
        logoImage,
      });
      const elapsed = Date.now() - started;
      const minDuration = LOADING_STEPS.length * 700;
      if (elapsed < minDuration) {
        await new Promise((resolve) => setTimeout(resolve, minDuration - elapsed));
      }
      onCreated(project.id);
    } catch (createError) {
      creatingRef.current = false;
      setError(
        (createError as { message?: string })?.message ??
          "Não foi possível criar o projeto. Tente novamente.",
      );
      setStep("template");
    }
  };

  useEffect(() => {
    if (step !== "loading") return;
    setLoadingIndex(0);
    const interval = window.setInterval(() => {
      setLoadingIndex((current) => Math.min(current + 1, LOADING_STEPS.length - 1));
    }, 700);
    return () => window.clearInterval(interval);
  }, [step]);

  const stepIndex = step === "info" ? 0 : step === "produtos" ? 1 : step === "template" ? 2 : 3;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="wizard-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={step === "loading" ? undefined : onClose}
        >
          <motion.div
            key="wizard-panel"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_40px_120px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-center justify-between border-b border-[#ececea] px-6 py-4">
              <div className="flex items-center gap-3">
                {step !== "info" && step !== "loading" ? (
                  <button
                    type="button"
                    onClick={() => setStep(step === "produtos" ? "info" : skipProducts ? "info" : "produtos")}
                    className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#5f6368] transition hover:bg-[#f3f3f1]"
                    aria-label="Voltar"
                  >
                    <ArrowLeft size={17} />
                  </button>
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-black text-white">
                    <Sparkles size={16} />
                  </span>
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9a9a96]">
                    Novo projeto
                  </p>
                  <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[#18191c]">
                    {step === "info"
                      ? "Vamos começar"
                      : step === "produtos"
                        ? "Escolha os produtos"
                        : step === "template"
                          ? "Escolha o template"
                          : "Gerando seu projeto"}
                  </h2>
                </div>
              </div>
              {step !== "loading" ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#5f6368] transition hover:bg-[#f3f3f1]"
                  aria-label="Fechar"
                >
                  <X size={17} />
                </button>
              ) : null}
            </div>

            {step !== "loading" ? (
              <div className="flex items-center gap-1.5 px-6 pt-3">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      index <= stepIndex ? "bg-black" : "bg-[#e6e6e2]"
                    }`}
                  />
                ))}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {error ? (
                <div className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] font-semibold text-red-700">
                  {error}
                </div>
              ) : null}

              {step === "info" ? (
                <div className="space-y-5">
                  <div>
                    <label className="mb-1.5 block text-[12px] font-semibold text-[#33363b]">
                      Nome do projeto
                    </label>
                    <input
                      value={nome}
                      onChange={(event) => setNome(event.target.value)}
                      placeholder="Ex.: Minha loja de acessórios"
                      autoFocus
                      className="h-11 w-full rounded-[10px] border border-[#e0e0dc] px-3.5 text-[14px] font-medium outline-none transition focus:border-black focus:ring-4 focus:ring-black/5"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-semibold text-[#33363b]">
                      Descrição
                    </label>
                    <textarea
                      value={descricao}
                      onChange={(event) => setDescricao(event.target.value)}
                      placeholder="Conte em poucas palavras o que você vende e para quem."
                      rows={3}
                      className="w-full resize-none rounded-[10px] border border-[#e0e0dc] px-3.5 py-2.5 text-[14px] font-medium outline-none transition focus:border-black focus:ring-4 focus:ring-black/5"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[12px] font-semibold text-[#33363b]">
                      O que você quer criar?
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTipo("pagina_venda");
                          setTemplateId("produto-1");
                        }}
                        className={`flex flex-col gap-2 rounded-[14px] border p-4 text-left transition ${
                          tipo === "pagina_venda"
                            ? "border-black ring-1 ring-black"
                            : "border-[#e0e0dc] hover:border-black/40"
                        }`}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-black text-white">
                          <FileText size={17} />
                        </span>
                        <span className="text-[13.5px] font-semibold text-[#18191c]">
                          Página de vendas
                        </span>
                        <span className="text-[11.5px] leading-4 text-[#6b7079]">
                          Uma oferta focada em um único produto.
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTipo("loja_completa");
                          setTemplateId("loja-1");
                        }}
                        className={`flex flex-col gap-2 rounded-[14px] border p-4 text-left transition ${
                          tipo === "loja_completa"
                            ? "border-black ring-1 ring-black"
                            : "border-[#e0e0dc] hover:border-black/40"
                        }`}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-black text-white">
                          <Store size={17} />
                        </span>
                        <span className="text-[13.5px] font-semibold text-[#18191c]">
                          Loja completa
                        </span>
                        <span className="text-[11.5px] leading-4 text-[#6b7079]">
                          Uma vitrine com vários produtos e coleções.
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {step === "produtos" ? (
                <div>
                  <div className="relative mb-4">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9a96]"
                    />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar produtos do catálogo Velo"
                      className="h-10 w-full rounded-[10px] border border-[#e0e0dc] pl-9 pr-3 text-[13px] font-medium outline-none transition focus:border-black focus:ring-4 focus:ring-black/5"
                    />
                  </div>
                  {loadingProducts ? (
                    <div className="flex h-48 items-center justify-center gap-2 text-[13px] font-semibold text-[#747982]">
                      <Loader2 size={17} className="animate-spin" />
                      Carregando catálogo...
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="flex h-48 items-center justify-center text-[13px] font-semibold text-[#747982]">
                      Nenhum produto encontrado.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {filteredProducts.map((product) => {
                        const selected = selectedProducts.includes(product.id);
                        const image = getFirstImage(product.images);
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => toggleProduct(product.id)}
                            className={`group relative overflow-hidden rounded-[12px] border text-left transition ${
                              selected
                                ? "border-black ring-1 ring-black"
                                : "border-[#e8e8e4] hover:border-black/30"
                            }`}
                          >
                            <div className="aspect-square w-full overflow-hidden bg-[#f4f4f2]">
                              {image ? (
                                <img
                                  src={image}
                                  alt=""
                                  className="h-full w-full object-cover transition group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[#c4c4bf]">
                                  <Store size={22} />
                                </div>
                              )}
                            </div>
                            {selected ? (
                              <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black text-white">
                                <Check size={13} />
                              </span>
                            ) : null}
                            <div className="p-2.5">
                              <p className="line-clamp-2 text-[11.5px] font-semibold leading-4 text-[#232428]">
                                {product.title}
                              </p>
                              <p className="mt-1 text-[11px] font-semibold text-[#6b7079]">
                                R$ {(product.cost_price * 5).toFixed(2)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              {step === "template" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {availableTemplates.map((template) => {
                    const selected = templateId === template.id;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setTemplateId(template.id)}
                        className={`overflow-hidden rounded-[14px] border text-left transition ${
                          selected
                            ? "border-black ring-1 ring-black"
                            : "border-[#e8e8e4] hover:border-black/30"
                        }`}
                      >
                        <div className="aspect-[4/3] w-full overflow-hidden bg-[#f4f4f2]">
                          <img src={template.preview} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="flex items-start justify-between gap-2 p-3.5">
                          <div>
                            <p className="text-[13px] font-semibold text-[#18191c]">
                              {template.label}
                            </p>
                            <p className="mt-1 text-[11.5px] leading-4 text-[#6b7079]">
                              {template.description}
                            </p>
                          </div>
                          {selected ? (
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-white">
                              <Check size={13} />
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {step === "loading" ? (
                <div className="py-4">
                  <div className="mb-6 flex flex-col items-center text-center">
                    <span className="relative flex h-14 w-14 items-center justify-center">
                      <span className="absolute inset-0 animate-ping rounded-full bg-black/10" />
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white">
                        <Sparkles size={24} />
                      </span>
                    </span>
                    <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-[#18191c]">
                      A IA está montando seu projeto
                    </h3>
                    <p className="mt-1 text-[12.5px] text-[#6b7079]">
                      Isso leva só alguns segundos. Não feche esta janela.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {LOADING_STEPS.map((label, index) => {
                      const done = index < loadingIndex;
                      const active = index === loadingIndex;
                      return (
                        <div
                          key={label}
                          className={`flex items-center gap-3 rounded-[10px] px-3 py-2 text-[12.5px] font-medium transition ${
                            active ? "bg-[#f5f5f3] text-[#18191c]" : "text-[#7c8189]"
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full ${
                              done
                                ? "bg-black text-white"
                                : active
                                  ? "bg-black/10 text-black"
                                  : "bg-[#eeeeea] text-[#b7b7b1]"
                            }`}
                          >
                            {done ? (
                              <Check size={12} />
                            ) : active ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            )}
                          </span>
                          {label}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[12px] bg-[#0e0f11] p-4 font-mono text-[11px] leading-5 text-[#8ce39b]">
                    {LOADING_FILES.slice(0, Math.max(1, loadingIndex + 1)).map((file) => (
                      <div key={file} className="flex items-center gap-2">
                        <span className="text-[#5f6b73]">+</span>
                        <span className="text-[#c8cdd2]">criando</span>
                        <span>{file}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-[#5f6b73]">
                      <span className="inline-block h-3 w-1.5 animate-pulse bg-[#8ce39b]" />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {step !== "loading" ? (
              <div className="flex items-center justify-between gap-3 border-t border-[#ececea] px-6 py-4">
                <span className="text-[12px] font-semibold text-[#8c908f]">
                  {step === "produtos"
                    ? `${selectedProducts.length} produto(s) selecionado(s)`
                    : `Passo ${stepIndex + 1} de 3`}
                </span>
                {step === "info" ? (
                  <button
                    type="button"
                    disabled={!canContinueInfo}
                    onClick={() => setStep("produtos")}
                    className="flex h-10 items-center rounded-[9px] bg-black px-5 text-[13px] font-semibold text-white transition hover:bg-[#202020] disabled:cursor-not-allowed disabled:bg-[#d8dde8] disabled:text-[#8b94a6]"
                  >
                    Continuar
                  </button>
                ) : step === "produtos" ? (
                  <button
                    type="button"
                    onClick={() => setStep("template")}
                    className="flex h-10 items-center rounded-[9px] bg-black px-5 text-[13px] font-semibold text-white transition hover:bg-[#202020]"
                  >
                    Continuar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={runCreation}
                    className="flex h-10 items-center gap-2 rounded-[9px] bg-black px-5 text-[13px] font-semibold text-white transition hover:bg-[#202020]"
                  >
                    <Sparkles size={15} />
                    Gerar projeto
                  </button>
                )}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default ProjectCreationWizard;
