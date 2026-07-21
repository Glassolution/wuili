import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
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

// Tema escuro de formulário (referência): card #1E1E1E sobre o fundo, campos e
// blocos internos um degrau mais escuros (#242424), separados por borda fina.
// Botão primário "glossy": mesmo token de design do botão do modal de onboarding.
const primaryButtonStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 15%), #2A2A2A",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)",
  textShadow: "0 1px 2px rgba(0,0,0,0.40)",
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

// Tipo padrão quando o caller não especifica: página de vendas.
// Admins podem passar `defaultTipo="loja_completa"` para criar loja completa.
const DEFAULT_TIPO: ProjectType = "pagina_venda";

type ProjectCreationWizardProps = {
  open: boolean;
  onClose: () => void;
  /** Tipo do projeto a ser criado. Default: página de venda. Admin pode passar "loja_completa". */
  defaultTipo?: ProjectType;
  /** Reservado para uso futuro (travar tipo no wizard). */
  lockedTipo?: ProjectType;
  /** Se true, mostra chooser no início pra o usuário escolher entre página de venda e loja completa. */
  allowTipoChoice?: boolean;
  /** Se definido, pula a etapa de escolha de produtos e usa esses IDs. */
  preselectedProductIds?: string[];
  /** Retorna true quando o plano atual do usuário não permite criar aquele tipo. */
  isTipoRestricted?: (tipo: ProjectType) => boolean;
  /** Chamado quando o usuário tenta escolher/criar um tipo restrito. */
  onRestrictedTipo?: (tipo: ProjectType) => void;
  onCreated: (projectId: string) => void;
};

const ProjectCreationWizard = ({
  open,
  onClose,
  defaultTipo,
  allowTipoChoice = false,
  preselectedProductIds,
  isTipoRestricted,
  onRestrictedTipo,
  onCreated,
}: ProjectCreationWizardProps) => {
  const [tipo, setTipo] = useState<ProjectType>(defaultTipo ?? DEFAULT_TIPO);

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
  const [selectedProducts, setSelectedProducts] = useState<string[]>(preselectedProductIds ?? []);
  const defaultTemplateId = tipo === "loja_completa" ? "loja-1" : "produto-1";
  const [templateId, setTemplateId] = useState<string>(defaultTemplateId);


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
    setSelectedProducts(preselectedProductIds ?? []);
    setTipo(defaultTipo ?? DEFAULT_TIPO);
    setTemplateId((defaultTipo ?? DEFAULT_TIPO) === "loja_completa" ? "loja-1" : "produto-1");
    setSearch("");
    setLoadingIndex(0);
    setError(null);
    creatingRef.current = false;
  }, [open, preselectedProductIds, defaultTipo]);

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
      const path = `${uid}/store-logos/${crypto.randomUUID()}.${ext}`;
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
    if (isTipoRestricted?.(tipo)) {
      onRestrictedTipo?.(tipo);
      return;
    }
    creatingRef.current = true;
    setError(null);
    goTo("loading", 1);

    const started = Date.now();
    try {
      const project = await createUserProject({
        nome,
        descricao,
        tipo: tipo,
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
            className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[16px] border border-white/[0.08] bg-[#1E1E1E] shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
          >
            {/* Cabeçalho compacto: ícone circular + título/subtítulo + fechar. */}
            <div className="flex items-start gap-3 px-5 py-4">
              {showBack ? (
                <motion.button
                  type="button"
                  onClick={() => goTo(step === "produtos" ? "info" : skipProducts ? "info" : "produtos", -1)}
                  whileTap={reduce ? undefined : { scale: 0.94 }}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-[#242424] text-white transition-colors hover:bg-[#242424]"
                  aria-label="Voltar"
                >
                  <ArrowLeft size={18} strokeWidth={1.9} />
                </motion.button>
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-[#242424] text-white">
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
                    <h2 className="truncate text-[16px] font-semibold tracking-[-0.01em] text-white">
                      {copy.title}
                    </h2>
                    <p className="mt-0.5 text-[13px] leading-[18px] text-[#8A8A8A]">{copy.subtitle}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {step !== "loading" ? (
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileTap={reduce ? undefined : { scale: 0.9 }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[#6B6B6B] transition-colors hover:bg-[#242424] hover:text-white"
                  aria-label="Fechar"
                >
                  <X size={18} strokeWidth={1.9} />
                </motion.button>
              ) : null}
            </div>

            <div className="h-px w-full bg-white/[0.08]" />

            {/* Progresso segmentado com preenchimento animado. */}
            {step !== "loading" ? (
              <div className="flex items-center gap-2 px-5 pt-5">
                {(skipProducts ? [0, 1] : [0, 1, 2]).map((index) => {
                  const activeIndex = skipProducts ? (step === "info" ? 0 : 1) : stepIndex;
                  return (
                    <span key={index} className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/10">
                      <motion.span
                        className="block h-full w-full rounded-full bg-white"
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
                      {allowTipoChoice ? (
                        <motion.div variants={groupVariants}>
                          <label className="mb-2 block text-[14px] font-medium text-white">
                            Tipo de projeto
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            {([
                              { value: "pagina_venda" as ProjectType, title: "Página de venda", desc: "Uma oferta focada em conversão." },
                              { value: "loja_completa" as ProjectType, title: "Loja completa", desc: "Vitrine com vários produtos." },
                            ]).map((option) => {
                              const active = tipo === option.value;
                              const restricted = isTipoRestricted?.(option.value) ?? false;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    if (restricted) {
                                      onRestrictedTipo?.(option.value);
                                      return;
                                    }
                                    setTipo(option.value);
                                    setTemplateId(option.value === "loja_completa" ? "loja-1" : "produto-1");
                                  }}
                                  className={`relative rounded-[12px] border px-4 py-3 text-left transition-colors ${
                                    active
                                      ? "border-white/60 bg-[#2A2A2A] shadow-[0_0_0_3px_rgba(255,255,255,0.06)]"
                                      : "border-white/[0.08] bg-[#242424] hover:border-white/20"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    {option.value === "loja_completa" ? (
                                      <Store size={16} strokeWidth={1.9} className="text-white" />
                                    ) : (
                                      <Sparkles size={16} strokeWidth={1.9} className="text-white" />
                                    )}
                                    <span className="text-[13.5px] font-semibold text-white">{option.title}</span>
                                    {restricted ? (
                                      <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                                        Plano Pro
                                      </span>
                                    ) : active ? (
                                      <Check size={14} strokeWidth={2.2} className="ml-auto text-white" />
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-[12px] leading-4 text-[#8A8A8A]">{option.desc}</p>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      ) : null}

                      <motion.div variants={groupVariants}>
                        <label className="mb-2 block text-[14px] font-medium text-white">
                          Nome da loja
                        </label>
                        <input
                          value={nome}
                          onChange={(event) => setNome(event.target.value)}
                          placeholder="Ex.: Minha loja de acessórios"
                          autoFocus
                          className="h-12 w-full rounded-[12px] border border-white/[0.08] bg-[#242424] px-4 text-[14.5px] font-medium text-white outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#6B6B6B] focus:border-white/60 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)]"
                        />
                      </motion.div>

                      <motion.div variants={groupVariants}>
                        <label className="mb-2 block text-[14px] font-medium text-white">
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
                          className={`flex flex-col items-center rounded-[12px] border px-6 py-7 text-center transition-colors duration-200 ${
                            draggingLogo
                              ? "border-white/40 bg-[#2A2A2A]"
                              : "border-white/[0.08] bg-[#242424] hover:border-white/20"
                          }`}
                        >
                          <motion.span
                            animate={draggingLogo && !reduce ? { y: -3 } : { y: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 22 }}
                            className="grid h-10 w-10 place-items-center rounded-full text-[#8A8A8A]"
                          >
                            <UploadCloud size={24} strokeWidth={1.7} />
                          </motion.span>
                          <p className="mt-2 text-[14px] font-semibold text-white">
                            Escolha uma imagem ou arraste e solte aqui.
                          </p>
                          <p className="mt-1 text-[12.5px] text-[#8A8A8A]">
                            Formatos PNG ou JPG, até 5 MB.
                          </p>
                          <motion.button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={uploadingLogo}
                            whileTap={reduce ? undefined : { scale: 0.97 }}
                            className="mt-4 inline-flex items-center rounded-[8px] border border-white/[0.12] bg-[#242424] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:bg-[#242424] disabled:cursor-not-allowed disabled:opacity-50"
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
                              <div className="mt-3 flex items-center gap-3 rounded-[12px] border border-white/[0.08] bg-[#242424] p-3">
                                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[8px] border border-white/[0.08] bg-[#242424]">
                                  {logoImage ? (
                                    <img src={logoImage} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <ImageIcon size={17} strokeWidth={1.8} className="text-[#6B6B6B]" />
                                  )}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[13.5px] font-semibold text-white">
                                    {logoName ?? "Imagem da loja"}
                                  </p>
                                  <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#8A8A8A]">
                                    {uploadingLogo ? (
                                      <>
                                        <Loader2 size={12} className="animate-spin text-[#8A8A8A]" />
                                        Enviando...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 size={13} className="text-[#32D583]" />
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
                                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[#6B6B6B] transition-colors hover:bg-red-500/15 hover:text-red-300"
                                    aria-label="Remover imagem"
                                  >
                                    <Trash2 size={16} strokeWidth={1.9} />
                                  </motion.button>
                                ) : null}
                              </div>
                              {uploadingLogo ? (
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                  <motion.span
                                    className="block h-full rounded-full bg-white"
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
                          <span className="h-px flex-1 bg-white/10" />
                          <span className="text-[12px] font-medium text-[#6B6B6B]">OU</span>
                          <span className="h-px flex-1 bg-white/10" />
                        </div>

                        <label className="mb-2 block text-[14px] font-medium text-white">
                          Importar de uma URL
                        </label>
                        <div className="relative">
                          <Link2
                            size={16}
                            strokeWidth={1.9}
                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6B6B]"
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
                            className="h-11 w-full rounded-[10px] border border-white/[0.08] bg-[#242424] pl-10 pr-4 text-[13.5px] font-medium text-white outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#6B6B6B] focus:border-white/60 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)]"
                          />
                        </div>
                      </motion.div>

                      <motion.div variants={groupVariants}>
                        <label className="mb-2 block text-[14px] font-medium text-white">
                          Descrição
                        </label>
                        <textarea
                          value={descricao}
                          onChange={(event) => setDescricao(event.target.value)}
                          placeholder="Conte em poucas palavras o que você vende e para quem."
                          rows={3}
                          className="w-full resize-none rounded-[12px] border border-white/[0.08] bg-[#242424] px-4 py-3 text-[14.5px] font-medium leading-6 text-white outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#6B6B6B] focus:border-white/60 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)]"
                        />
                      </motion.div>
                    </div>
                  ) : null}

                  {step === "produtos" ? (
                    <div>
                      <motion.div variants={groupVariants} className="relative mb-4">
                        <Search
                          size={17}
                          strokeWidth={1.9}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6B6B]"
                        />
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Buscar produtos do catálogo Velo"
                          className="h-11 w-full rounded-[12px] border border-white/[0.08] bg-[#242424] pl-11 pr-4 text-[14px] font-medium text-white outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#6B6B6B] focus:border-white/60 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)]"
                        />
                      </motion.div>

                      {loadingProducts ? (
                        <div className="flex h-52 items-center justify-center gap-2.5 text-[13.5px] font-medium text-[#8A8A8A]">
                          <Loader2 size={18} className="animate-spin" />
                          Carregando catálogo...
                        </div>
                      ) : filteredProducts.length === 0 ? (
                        <div className="flex h-52 items-center justify-center text-[13.5px] font-medium text-[#8A8A8A]">
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
                                    ? "border-[1.5px] border-white/60 shadow-[0_4px_14px_rgba(0,0,0,0.10)]"
                                    : "border border-white/[0.08] hover:border-white/[0.12] hover:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.12)]"
                                }`}
                              >
                                <div className="aspect-square w-full overflow-hidden bg-[#242424]">
                                  {image ? (
                                    <img
                                      src={image}
                                      alt=""
                                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]"
                                    />
                                  ) : (
                                    <div className="grid h-full w-full place-items-center text-[#5A5A5A]">
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
                                      className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#242424] text-white shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                                    >
                                      <Check size={13} strokeWidth={2.6} />
                                    </motion.span>
                                  ) : null}
                                </AnimatePresence>
                                <div className="bg-[#242424] p-3">
                                  <p className="line-clamp-2 text-[12px] font-semibold leading-[17px] text-white">
                                    {product.title}
                                  </p>
                                  <p className="mt-1 text-[12px] font-semibold text-[#8A8A8A]">
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
                                ? "border-[1.5px] border-white/60 shadow-[0_4px_14px_rgba(0,0,0,0.10)]"
                                : "border border-white/[0.08] hover:-translate-y-0.5 hover:border-white/[0.12] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.16)]"
                            }`}
                          >
                            <div className="aspect-[4/3] w-full overflow-hidden bg-[#242424]">
                              <img src={template.preview} alt="" className="h-full w-full object-cover" />
                            </div>
                            <div className="flex items-start justify-between gap-2.5 bg-[#242424] p-4">
                              <div className="min-w-0">
                                <p className="text-[13.5px] font-semibold text-white">
                                  {template.label}
                                </p>
                                <p className="mt-1 text-[12.5px] leading-[18px] text-[#8A8A8A]">
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
                                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#242424] text-white"
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
                            className="absolute inset-0 rounded-full bg-white/10"
                            animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                          />
                          <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-[#1E1E1E] shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
                            <Sparkles size={26} strokeWidth={1.8} />
                          </span>
                        </span>
                        <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-white">
                          A IA está montando seu projeto
                        </h3>
                        <p className="mt-1 text-[13px] text-[#8A8A8A]">
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
                                active ? "bg-[#242424] text-white" : "text-[#8A8A8A]"
                              }`}
                            >
                              <span
                                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors duration-300 ${
                                  done
                                    ? "bg-white text-[#1E1E1E]"
                                    : active
                                      ? "bg-white/10 text-white"
                                      : "bg-white/10 text-[#5A5A5A]"
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
                <div className="h-px w-full bg-white/[0.08]" />
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <span className="text-[13px] font-medium text-[#8A8A8A]">
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
