import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  Search,
  Sparkles,
  Store,
  Trash2,
  UploadCloud,
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

// Easing "ease-out expo" — mesma sensação premium usada no modal de onboarding.
const EASE = [0.22, 1, 0.36, 1] as const;

// Botão primário "glossy": mesmo token de design do botão do modal de onboarding
// (fundo #1D1F23 com brilho no topo, stroke preto, sombra dupla e text-shadow).
const primaryButtonStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 15%), #1D1F23",
  borderTop: "1.5px solid rgba(255,255,255,0.15)",
  boxShadow: "0px 4px 7px rgba(0,0,0,0.2), 0px 0px 0px 1.5px #000000",
  textShadow: "0px 4px 4px rgba(0,0,0,0.4)",
};

const STEP_COPY: Record<Step, { title: string; subtitle: string }> = {
  info: {
    title: "Vamos começar",
    subtitle: "Dê um nome e uma identidade ao seu projeto.",
  },
  produtos: {
    title: "Escolha os produtos",
    subtitle: "Selecione o que vai fazer parte deste projeto.",
  },
  template: {
    title: "Escolha o template",
    subtitle: "Selecione o layout que combina com a sua marca.",
  },
  loading: {
    title: "Gerando seu projeto",
    subtitle: "Isso leva só alguns segundos. Não feche esta janela.",
  },
};

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
  const [direction, setDirection] = useState(0);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [draggingLogo, setDraggingLogo] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState("");
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
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    setStep("info");
    setDirection(0);
    setNome("");
    setDescricao("");
    setLogoImage(null);
    setLogoName(null);
    setDraggingLogo(false);
    setLogoUrlInput("");
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

  // Navegação entre etapas guardando a direção, para o slide sair no sentido certo.
  const goTo = (next: Step, dir: 1 | -1) => {
    setDirection(dir);
    setStep(next);
  };

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
      setLogoName(file.name);
    } catch (err) {
      console.error(err);
      veloToast.error("Falha ao enviar a imagem.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingLogo(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleLogoUpload(file);
  };

  // Importa a logo a partir de uma URL pública, sem passar pelo Storage.
  const applyLogoUrl = () => {
    const url = logoUrlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      veloToast.error("Informe uma URL válida começando com http:// ou https://");
      return;
    }
    setLogoImage(url);
    setLogoName(url.split("/").pop()?.split("?")[0] || "imagem-da-url");
    setLogoUrlInput("");
  };

  const removeLogo = () => {
    setLogoImage(null);
    setLogoName(null);
  };

  const runCreation = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setError(null);
    goTo("loading", 1);

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
      goTo("template", -1);
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
  const totalSteps = skipProducts ? 2 : 3;
  const currentStepNumber = skipProducts ? (step === "info" ? 1 : 2) : stepIndex + 1;

  // Slide + fade direcional do conteúdo da etapa, com stagger dos grupos ao entrar.
  const contentVariants: Variants = {
    initial: (dir: number) => ({ opacity: 0, x: reduce ? 0 : dir >= 0 ? 24 : -24 }),
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: reduce ? 0.001 : 0.3,
        ease: EASE,
        staggerChildren: reduce ? 0 : 0.05,
        delayChildren: reduce ? 0 : 0.04,
      },
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: reduce ? 0 : dir >= 0 ? -24 : 24,
      transition: { duration: reduce ? 0.001 : 0.2, ease: EASE },
    }),
  };

  const groupVariants: Variants = {
    initial: { opacity: 0, y: reduce ? 0 : 10 },
    animate: { opacity: 1, y: 0, transition: { duration: reduce ? 0.001 : 0.28, ease: EASE } },
  };

  const copy = STEP_COPY[step];
  const showBack = step !== "info" && step !== "loading";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="wizard-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0C111D]/50 p-4 backdrop-blur-[3px]"
          onClick={step === "loading" ? undefined : onClose}
        >
          <motion.div
            key="wizard-panel"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 10 }}
            transition={{ type: "spring", stiffness: 340, damping: 32, mass: 0.9 }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_24px_64px_rgba(16,24,40,0.18),0_0_0_1px_rgba(16,24,40,0.04)]"
          >
            {/* Cabeçalho compacto: ícone circular + título/subtítulo + fechar. */}
            <div className="flex items-start gap-3 px-5 py-4">
              {showBack ? (
                <motion.button
                  type="button"
                  onClick={() => goTo(step === "produtos" ? "info" : skipProducts ? "info" : "produtos", -1)}
                  whileTap={reduce ? undefined : { scale: 0.94 }}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#EAECF0] bg-white text-[#344054] transition-colors hover:bg-[#F9FAFB]"
                  aria-label="Voltar"
                >
                  <ArrowLeft size={18} strokeWidth={1.9} />
                </motion.button>
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#EAECF0] bg-white text-[#101828]">
                  <Sparkles size={18} strokeWidth={1.8} />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    transition={{ duration: reduce ? 0.001 : 0.24, ease: EASE }}
                  >
                    <h2 className="truncate text-[16px] font-semibold tracking-[-0.01em] text-[#101828]">
                      {copy.title}
                    </h2>
                    <p className="mt-0.5 text-[13px] leading-[18px] text-[#667085]">{copy.subtitle}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {step !== "loading" ? (
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileTap={reduce ? undefined : { scale: 0.9 }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[#98A2B3] transition-colors hover:bg-[#F2F4F7] hover:text-[#344054]"
                  aria-label="Fechar"
                >
                  <X size={18} strokeWidth={1.9} />
                </motion.button>
              ) : null}
            </div>

            <div className="h-px w-full bg-[#EEF0F3]" />

            {/* Progresso segmentado com preenchimento animado. */}
            {step !== "loading" ? (
              <div className="flex items-center gap-2 px-5 pt-5">
                {(skipProducts ? [0, 1] : [0, 1, 2]).map((index) => {
                  const activeIndex = skipProducts ? (step === "info" ? 0 : 1) : stepIndex;
                  return (
                    <span key={index} className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#EAECF0]">
                      <motion.span
                        className="block h-full w-full rounded-full bg-[#101828]"
                        style={{ originX: 0 }}
                        initial={false}
                        animate={{ scaleX: index <= activeIndex ? 1 : 0 }}
                        transition={{ duration: reduce ? 0.001 : 0.42, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </span>
                  );
                })}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {error ? (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 rounded-[12px] border border-[#FECDCA] bg-[#FEF3F2] px-4 py-3 text-[13px] font-medium text-[#B42318]"
                >
                  {error}
                </motion.div>
              ) : null}

              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={contentVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {step === "info" ? (
                    <div className="space-y-5">
                      <motion.div variants={groupVariants}>
                        <label className="mb-2 block text-[13px] font-semibold text-[#344054]">
                          Nome da loja
                        </label>
                        <input
                          value={nome}
                          onChange={(event) => setNome(event.target.value)}
                          placeholder="Ex.: Minha loja de acessórios"
                          autoFocus
                          className="h-12 w-full rounded-[12px] border border-[#E4E7EC] bg-white px-4 text-[14.5px] font-medium text-[#101828] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#98A2B3] focus:border-[#101828] focus:shadow-[0_0_0_4px_rgba(16,24,40,0.06)]"
                        />
                      </motion.div>

                      <motion.div variants={groupVariants}>
                        <label className="mb-2 block text-[13px] font-semibold text-[#344054]">
                          Logo / Foto da loja
                        </label>

                        {/* Zona de drop centralizada: ícone, chamada, formatos e botão. */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDraggingLogo(true);
                          }}
                          onDragLeave={() => setDraggingLogo(false)}
                          onDrop={handleLogoDrop}
                          className={`flex flex-col items-center rounded-[12px] border border-dashed px-6 py-7 text-center transition-colors duration-200 ${
                            draggingLogo
                              ? "border-[#101828] bg-[#F9FAFB]"
                              : "border-[#D0D5DD] bg-white hover:border-[#98A2B3]"
                          }`}
                        >
                          <motion.span
                            animate={draggingLogo && !reduce ? { y: -3 } : { y: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 22 }}
                            className="grid h-10 w-10 place-items-center rounded-full text-[#475467]"
                          >
                            <UploadCloud size={24} strokeWidth={1.7} />
                          </motion.span>
                          <p className="mt-2 text-[14px] font-semibold text-[#101828]">
                            Escolha uma imagem ou arraste e solte aqui.
                          </p>
                          <p className="mt-1 text-[12.5px] text-[#667085]">
                            Formatos PNG ou JPG, até 5 MB.
                          </p>
                          <motion.button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={uploadingLogo}
                            whileTap={reduce ? undefined : { scale: 0.97 }}
                            className="mt-4 inline-flex items-center rounded-[8px] border border-[#D0D5DD] bg-white px-4 py-2 text-[13px] font-semibold text-[#344054] shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Selecionar arquivo
                          </motion.button>
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleLogoUpload(f);
                              e.target.value = "";
                            }}
                          />
                        </div>

                        {/* Card do arquivo: miniatura, nome, status e remover. */}
                        <AnimatePresence>
                          {uploadingLogo || logoImage ? (
                            <motion.div
                              initial={reduce ? false : { opacity: 0, y: -6, height: 0 }}
                              animate={{ opacity: 1, y: 0, height: "auto" }}
                              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, height: 0 }}
                              transition={{ duration: 0.24, ease: EASE }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 flex items-center gap-3 rounded-[12px] border border-[#E4E7EC] bg-white p-3">
                                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[8px] border border-[#EAECF0] bg-[#F9FAFB]">
                                  {logoImage ? (
                                    <img src={logoImage} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <ImageIcon size={17} strokeWidth={1.8} className="text-[#98A2B3]" />
                                  )}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[13.5px] font-semibold text-[#101828]">
                                    {logoName ?? "Imagem da loja"}
                                  </p>
                                  <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#667085]">
                                    {uploadingLogo ? (
                                      <>
                                        <Loader2 size={12} className="animate-spin text-[#475467]" />
                                        Enviando...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 size={13} className="text-[#12B76A]" />
                                        Concluído
                                      </>
                                    )}
                                  </p>
                                </div>
                                {!uploadingLogo ? (
                                  <motion.button
                                    type="button"
                                    onClick={removeLogo}
                                    whileTap={reduce ? undefined : { scale: 0.9 }}
                                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[#98A2B3] transition-colors hover:bg-[#FEF3F2] hover:text-[#B42318]"
                                    aria-label="Remover imagem"
                                  >
                                    <Trash2 size={16} strokeWidth={1.9} />
                                  </motion.button>
                                ) : null}
                              </div>
                              {uploadingLogo ? (
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#EAECF0]">
                                  <motion.span
                                    className="block h-full rounded-full bg-[#101828]"
                                    initial={{ width: "10%" }}
                                    animate={{ width: "90%" }}
                                    transition={{ duration: 1.6, ease: "easeOut" }}
                                  />
                                </div>
                              ) : null}
                            </motion.div>
                          ) : null}
                        </AnimatePresence>

                        {/* Divisor "OU" + importação por URL. */}
                        <div className="my-4 flex items-center gap-3">
                          <span className="h-px flex-1 bg-[#EAECF0]" />
                          <span className="text-[12px] font-medium text-[#98A2B3]">OU</span>
                          <span className="h-px flex-1 bg-[#EAECF0]" />
                        </div>

                        <label className="mb-2 block text-[13px] font-semibold text-[#344054]">
                          Importar de uma URL
                        </label>
                        <div className="relative">
                          <Link2
                            size={16}
                            strokeWidth={1.9}
                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                          />
                          <input
                            value={logoUrlInput}
                            onChange={(event) => setLogoUrlInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                applyLogoUrl();
                              }
                            }}
                            onBlur={applyLogoUrl}
                            placeholder="Cole o link da imagem"
                            className="h-11 w-full rounded-[10px] border border-[#E4E7EC] bg-white pl-10 pr-4 text-[13.5px] font-medium text-[#101828] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#98A2B3] focus:border-[#101828] focus:shadow-[0_0_0_4px_rgba(16,24,40,0.06)]"
                          />
                        </div>
                      </motion.div>

                      <motion.div variants={groupVariants}>
                        <label className="mb-2 block text-[13px] font-semibold text-[#344054]">
                          Descrição
                        </label>
                        <textarea
                          value={descricao}
                          onChange={(event) => setDescricao(event.target.value)}
                          placeholder="Conte em poucas palavras o que você vende e para quem."
                          rows={3}
                          className="w-full resize-none rounded-[12px] border border-[#E4E7EC] bg-white px-4 py-3 text-[14.5px] font-medium leading-6 text-[#101828] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#98A2B3] focus:border-[#101828] focus:shadow-[0_0_0_4px_rgba(16,24,40,0.06)]"
                        />
                      </motion.div>

                      {!lockedTipo ? (
                        <motion.div variants={groupVariants}>
                          <label className="mb-2.5 block text-[13px] font-semibold text-[#344054]">
                            O que você quer criar?
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {[
                              {
                                value: "pagina_venda" as ProjectType,
                                template: "produto-1",
                                icon: FileText,
                                label: "Página de vendas",
                                description: "Uma oferta focada em um único produto.",
                              },
                              {
                                value: "loja_completa" as ProjectType,
                                template: "loja-1",
                                icon: Store,
                                label: "Loja completa",
                                description: "Uma vitrine com vários produtos e coleções.",
                              },
                            ].map((option) => {
                              const selected = tipo === option.value;
                              const Icon = option.icon;
                              return (
                                <motion.button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    setTipo(option.value);
                                    setTemplateId(option.template);
                                  }}
                                  aria-pressed={selected}
                                  whileTap={reduce ? undefined : { scale: 0.98 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                  className={`flex flex-col gap-2.5 rounded-[16px] p-4 text-left transition-[border-color,box-shadow,transform] duration-200 ${
                                    selected
                                      ? "border-[1.5px] border-[#101828] bg-white shadow-[0_4px_14px_rgba(16,24,40,0.08)]"
                                      : "border border-[#E4E7EC] bg-white hover:-translate-y-0.5 hover:border-[#D0D5DD] hover:shadow-[0_6px_16px_-6px_rgba(16,24,40,0.12)]"
                                  }`}
                                >
                                  <span
                                    className={`grid h-10 w-10 place-items-center rounded-[11px] transition-colors duration-200 ${
                                      selected
                                        ? "bg-[#101828] text-white"
                                        : "border border-[#EAECF0] bg-[#F9FAFB] text-[#475467]"
                                    }`}
                                  >
                                    <Icon size={18} strokeWidth={1.8} />
                                  </span>
                                  <span className="text-[14px] font-semibold text-[#101828]">
                                    {option.label}
                                  </span>
                                  <span className="text-[12.5px] leading-[18px] text-[#667085]">
                                    {option.description}
                                  </span>
                                </motion.button>
                              );
                            })}
                          </div>
                        </motion.div>
                      ) : null}
                    </div>
                  ) : null}

                  {step === "produtos" ? (
                    <div>
                      <motion.div variants={groupVariants} className="relative mb-4">
                        <Search
                          size={17}
                          strokeWidth={1.9}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3]"
                        />
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Buscar produtos do catálogo Velo"
                          className="h-11 w-full rounded-[12px] border border-[#E4E7EC] bg-white pl-11 pr-4 text-[14px] font-medium text-[#101828] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#98A2B3] focus:border-[#101828] focus:shadow-[0_0_0_4px_rgba(16,24,40,0.06)]"
                        />
                      </motion.div>

                      {loadingProducts ? (
                        <div className="flex h-52 items-center justify-center gap-2.5 text-[13.5px] font-medium text-[#667085]">
                          <Loader2 size={18} className="animate-spin" />
                          Carregando catálogo...
                        </div>
                      ) : filteredProducts.length === 0 ? (
                        <div className="flex h-52 items-center justify-center text-[13.5px] font-medium text-[#667085]">
                          Nenhum produto encontrado.
                        </div>
                      ) : (
                        <motion.div variants={groupVariants} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {filteredProducts.map((product) => {
                            const selected = selectedProducts.includes(product.id);
                            const image = getFirstImage(product.images);
                            return (
                              <motion.button
                                key={product.id}
                                type="button"
                                onClick={() => toggleProduct(product.id)}
                                aria-pressed={selected}
                                whileTap={reduce ? undefined : { scale: 0.98 }}
                                className={`group relative overflow-hidden rounded-[14px] text-left transition-[border-color,box-shadow] duration-200 ${
                                  selected
                                    ? "border-[1.5px] border-[#101828] shadow-[0_4px_14px_rgba(16,24,40,0.10)]"
                                    : "border border-[#E4E7EC] hover:border-[#D0D5DD] hover:shadow-[0_6px_16px_-6px_rgba(16,24,40,0.12)]"
                                }`}
                              >
                                <div className="aspect-square w-full overflow-hidden bg-[#F2F4F7]">
                                  {image ? (
                                    <img
                                      src={image}
                                      alt=""
                                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]"
                                    />
                                  ) : (
                                    <div className="grid h-full w-full place-items-center text-[#C6CBD4]">
                                      <Store size={22} strokeWidth={1.7} />
                                    </div>
                                  )}
                                </div>
                                <AnimatePresence>
                                  {selected ? (
                                    <motion.span
                                      initial={reduce ? false : { scale: 0, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                                      transition={{ type: "spring", stiffness: 520, damping: 26 }}
                                      className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#101828] text-white shadow-[0_2px_6px_rgba(16,24,40,0.3)]"
                                    >
                                      <Check size={13} strokeWidth={2.6} />
                                    </motion.span>
                                  ) : null}
                                </AnimatePresence>
                                <div className="bg-white p-3">
                                  <p className="line-clamp-2 text-[12px] font-semibold leading-[17px] text-[#101828]">
                                    {product.title}
                                  </p>
                                  <p className="mt-1 text-[12px] font-semibold text-[#667085]">
                                    R$ {(product.cost_price * 5).toFixed(2)}
                                  </p>
                                </div>
                              </motion.button>
                            );
                          })}
                        </motion.div>
                      )}
                    </div>
                  ) : null}

                  {step === "template" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {availableTemplates.map((template) => {
                        const selected = templateId === template.id;
                        return (
                          <motion.button
                            key={template.id}
                            type="button"
                            variants={groupVariants}
                            onClick={() => setTemplateId(template.id)}
                            aria-pressed={selected}
                            whileTap={reduce ? undefined : { scale: 0.98 }}
                            className={`overflow-hidden rounded-[16px] text-left transition-[border-color,box-shadow,transform] duration-200 ${
                              selected
                                ? "border-[1.5px] border-[#101828] shadow-[0_4px_14px_rgba(16,24,40,0.10)]"
                                : "border border-[#E4E7EC] hover:-translate-y-0.5 hover:border-[#D0D5DD] hover:shadow-[0_8px_20px_-8px_rgba(16,24,40,0.16)]"
                            }`}
                          >
                            <div className="aspect-[4/3] w-full overflow-hidden bg-[#F2F4F7]">
                              <img src={template.preview} alt="" className="h-full w-full object-cover" />
                            </div>
                            <div className="flex items-start justify-between gap-2.5 bg-white p-4">
                              <div className="min-w-0">
                                <p className="text-[13.5px] font-semibold text-[#101828]">
                                  {template.label}
                                </p>
                                <p className="mt-1 text-[12.5px] leading-[18px] text-[#667085]">
                                  {template.description}
                                </p>
                              </div>
                              <AnimatePresence>
                                {selected ? (
                                  <motion.span
                                    initial={reduce ? false : { scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 520, damping: 26 }}
                                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#101828] text-white"
                                  >
                                    <Check size={13} strokeWidth={2.6} />
                                  </motion.span>
                                ) : null}
                              </AnimatePresence>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  ) : null}

                  {step === "loading" ? (
                    <div className="py-2">
                      <div className="mb-6 flex flex-col items-center text-center">
                        <span className="relative grid h-16 w-16 place-items-center">
                          <motion.span
                            className="absolute inset-0 rounded-full bg-[#101828]/10"
                            animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                          />
                          <span className="grid h-16 w-16 place-items-center rounded-full bg-[#101828] text-white shadow-[0_8px_24px_rgba(16,24,40,0.28)]">
                            <Sparkles size={26} strokeWidth={1.8} />
                          </span>
                        </span>
                        <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-[#101828]">
                          A IA está montando seu projeto
                        </h3>
                        <p className="mt-1 text-[13px] text-[#667085]">
                          Isso leva só alguns segundos. Não feche esta janela.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        {LOADING_STEPS.map((label, index) => {
                          const done = index < loadingIndex;
                          const active = index === loadingIndex;
                          return (
                            <motion.div
                              key={label}
                              initial={false}
                              animate={{ opacity: done || active ? 1 : 0.55 }}
                              className={`flex items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-[13px] font-medium transition-colors duration-300 ${
                                active ? "bg-[#F9FAFB] text-[#101828]" : "text-[#667085]"
                              }`}
                            >
                              <span
                                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors duration-300 ${
                                  done
                                    ? "bg-[#101828] text-white"
                                    : active
                                      ? "bg-[#101828]/10 text-[#101828]"
                                      : "bg-[#EAECF0] text-[#B6BCC7]"
                                }`}
                              >
                                {done ? (
                                  <Check size={12} strokeWidth={2.8} />
                                ) : active ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                )}
                              </span>
                              {label}
                            </motion.div>
                          );
                        })}
                      </div>

                      <div className="mt-5 overflow-hidden rounded-[14px] bg-[#0C111D] p-4 font-mono text-[11.5px] leading-5 text-[#7FE3A0]">
                        {LOADING_FILES.slice(0, Math.max(1, loadingIndex + 1)).map((file) => (
                          <motion.div
                            key={file}
                            initial={reduce ? false : { opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.24, ease: EASE }}
                            className="flex items-center gap-2"
                          >
                            <span className="text-[#5F6B73]">+</span>
                            <span className="text-[#C8CDD2]">criando</span>
                            <span>{file}</span>
                          </motion.div>
                        ))}
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3 w-1.5 animate-pulse bg-[#7FE3A0]" />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Rodapé: contador de etapa + botão primário glossy. */}
            {step !== "loading" ? (
              <>
                <div className="h-px w-full bg-[#EEF0F3]" />
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <span className="text-[13px] font-medium text-[#667085]">
                    {step === "produtos"
                      ? `${selectedProducts.length} produto(s) selecionado(s)`
                      : `Passo ${currentStepNumber} de ${totalSteps}`}
                  </span>

                  {step === "info" ? (
                    <motion.button
                      type="button"
                      disabled={!canContinueInfo}
                      onClick={() => goTo(skipProducts ? "template" : "produtos", 1)}
                      style={primaryButtonStyle}
                      whileTap={reduce || !canContinueInfo ? undefined : { scale: 0.97 }}
                      className="inline-flex h-11 items-center gap-2 rounded-[10px] px-5 text-[15px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Continuar
                      <ArrowRight size={16} strokeWidth={2} />
                    </motion.button>
                  ) : step === "produtos" ? (
                    <motion.button
                      type="button"
                      onClick={() => goTo("template", 1)}
                      style={primaryButtonStyle}
                      whileTap={reduce ? undefined : { scale: 0.97 }}
                      className="inline-flex h-11 items-center gap-2 rounded-[10px] px-5 text-[15px] font-medium text-white transition-opacity"
                    >
                      Continuar
                      <ArrowRight size={16} strokeWidth={2} />
                    </motion.button>
                  ) : (
                    <motion.button
                      type="button"
                      onClick={runCreation}
                      style={primaryButtonStyle}
                      whileTap={reduce ? undefined : { scale: 0.97 }}
                      className="inline-flex h-11 items-center gap-2 rounded-[10px] px-5 text-[15px] font-medium text-white transition-opacity"
                    >
                      <Sparkles size={16} strokeWidth={2} />
                      Gerar projeto
                    </motion.button>
                  )}
                </div>
              </>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default ProjectCreationWizard;
