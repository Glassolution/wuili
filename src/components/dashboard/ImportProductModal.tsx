import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Check, Loader2, Sparkles, Globe, ExternalLink, ArrowRight, Store, ShieldCheck, CheckCircle2, Link2 } from "lucide-react";
import { veloToast } from "@/components/ui/velo-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UpgradeLimitModal from "@/components/UpgradeLimitModal";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";
import MLAccountVerificationModal from "@/components/dashboard/MLAccountVerificationModal";
import MlMissingInfoModal from "@/components/dashboard/MlMissingInfoModal";
// import { ManualCategoryDialog } from "@/components/dashboard/ManualCategoryDialog"; // removido a pedido
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useStartMode } from "@/hooks/useStartMode";
import { startMercadoLivreOAuth } from "@/lib/mercadoLivreOAuth";
import {
  getActiveStore,
  getStorePublishedCount,
  incrementStorePublishedCount,
} from "@/components/dashboard/FirstStoreOnboarding";
import {
  ErroDePublicacao,
  MULTIPLICADOR_SUGERIDO,
  gerarDescricaoComIa,
  inferProductBrand,
  inferStickerAlbumName,
  isStickerAlbumProduct,
  montarAtributosMl,
  montarCorpoDePublicacao,
  primeiraImagemDoProduto,
  publicarNoMercadoLivre,
  type ResultadoDaPublicacao,
  type ProdutoDoCatalogo,
} from "@/lib/publicacaoMercadoLivre";
import { getProductPricingEstimate } from "@/lib/productPricing";
import { trackMobileHomeEvent } from "@/lib/mobileHomeTracking";
import { clearProductImportDraft, readProductImportDraft, saveProductImportDraft } from "@/lib/productImportDraft";
import { salvarRetornoMl } from "@/lib/mlOauthRetorno";
import { enfileirarPublicacaoPendente, tentarPublicarPendentesAgora } from "@/lib/publicacaoPendente";
import MLConnectPrepareModal from "@/components/dashboard/MLConnectPrepareModal";
import { lerRespostasDoQuiz } from "@/lib/perfilDoQuiz";

/**
 * O tipo e as regras de publicação vivem em `@/lib/publicacaoMercadoLivre`: o
 * Atlas publica pelo chat com exatamente as mesmas, e duas cópias divergiriam.
 */
export type CatalogProduct = ProdutoDoCatalogo;

type Props = {
  open: boolean;
  onClose: () => void;
  product: CatalogProduct | null;
  /**
   * Se true, ao clicar em "Publicar produto" na etapa Revisão exibimos o
   * tutorial de verificação da conta do Mercado Livre em vez de publicar.
   * Deixe indefinido/false enquanto não houver um sinal real do backend
   * indicando conta não verificada / fora do modo vendedor.
   */
  mlAccountNeedsVerification?: boolean;
};

const MAX_TITLE_LENGTH = 60;
const ACCENT = "#2563EB";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const STEPS = [
  { num: 1, label: "Detalhes" },
  { num: 2, label: "Conexão" },
  { num: 3, label: "Revisão" },
  { num: 4, label: "Plano" },
];

const ImportProductModal = ({ open, onClose, product, mlAccountNeedsVerification }: Props) => {
  const { user } = useAuth();
  const upgradeModal = useUpgradeModal();
  const planLimits = usePlanLimits();
  const isStartMode = false;

  const [step, setStep] = useState(1); // Start at step 1 (details)
  const [title, setTitle] = useState("");
  const [sellPrice, setSellPrice] = useState(0);
  const [visible, setVisible] = useState(false);
  const [isConnectedToML, setIsConnectedToML] = useState<boolean | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ permalink: string; item_id: string } | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [mlVerifyModalOpen, setMlVerifyModalOpen] = useState(false);
  // Códigos crus do ML (ex.: "address_pending") quando a publicação é
  // bloqueada por cadastro incompleto — alimentam o modal que diz o que falta.
  const [mlMissingCodes, setMlMissingCodes] = useState<string[] | null>(null);
  const [checkingSeller, setCheckingSeller] = useState(false);
  const [prepareOpen, setPrepareOpen] = useState(false);
  // Resposta do onboarding: quem disse que ainda não tem conta de vendedor vê
  // o guia de criação antes de tentar conectar.
  const semContaDeVendedor = lerRespostasDoQuiz(user).mercadoLivre === "nao";
  const flowOpenedAt = useRef(Date.now());
  const stepOpenedAt = useRef(Date.now());
  const previousStep = useRef(1);
  const autoDescriptionAttempted = useRef(false);
  const restoredProductId = useRef<string | null>(null);
  // Estado do modal manual de categoria removido a pedido do usuário.

  /*
    Pricing engine. O multiplicador inicial é a sugestão da Velo: sai de uma constante
    porque a ficha do produto não mostra mais preço sugerido nem margem — a sugestão
    aparece aqui, e o número exibido tem que ser exatamente o que o slider já aplicou.
  */
  const [, setMultiplier] = useState(MULTIPLICADOR_SUGERIDO);

  // AI description
  const [description, setDescription] = useState("");
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [albumName, setAlbumName] = useState("");
  const [saleFormat, setSaleFormat] = useState<"unit" | "kit">("unit");

  // Translation
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState(false);

  // Platforms (review step)
  const [platforms] = useState<{ ml: boolean; shopee: boolean; tiktok: boolean }>({
    ml: true,
    shopee: false,
    tiktok: false,
  });

  // Marca/Modelo — obrigatórios para publicar em várias categorias do ML.
  // São pré-preenchidos com o que veio do scraper (quando existir) e podem
  // ser editados pelo usuário na etapa de Revisão. Sem marca, o backend usa
  // "Genérica" como fallback; sem modelo, cai para uma versão curta do título.
  // Check ML connection
  useEffect(() => {
    if (!user || !open) return;
    (async () => {
      const { data } = await supabase
        .from("user_integrations")
        .select("access_token")
        .eq("user_id", user.id)
        .eq("platform", "mercadolivre")
        .maybeSingle();
      setIsConnectedToML(!!data?.access_token);
    })();
  }, [user, open]);

  // Animate
  useEffect(() => {
    if (open) requestAnimationFrame(() => setVisible(true));
    else setVisible(false);
  }, [open]);

  // Cadastro de vendedor no Mercado Livre (modo vendedor + Mercado Envios +
  // endereço de retirada) é obrigatório para TODA conta antes de publicar.
  // Consultamos a fonte da verdade (ML /users/me via edge function), mas esta
  // função apenas informa: quem decide abrir o tutorial é o clique em publicar.
  // Abrir sozinho (ao montar, ou de novo ao fechar) prendia o usuário num laço
  // em que o modal reaparecia toda vez que ele clicava no X.
  // Retorna null quando a checagem não foi possível — aí vale o que o backend
  // sinalizou na última publicação (prop mlAccountNeedsVerification).
  const fetchSellerReady = useCallback(async (): Promise<boolean | null> => {
    if (!user) return null;
    try {
      const { data } = await supabase.functions.invoke("ml-seller-status");
      if (data?.connected && data?.canList === false) return false;
      return true;
    } catch {
      return null;
    }
  }, [user]);

  // Restaura o rascunho do produto ou inicia um novo fluxo.
  const [lastProductId, setLastProductId] = useState<string | null>(null);
  if (product && product.id !== lastProductId) {
    setLastProductId(product.id);
    const truncated = product.title.length > MAX_TITLE_LENGTH
      ? product.title.substring(0, MAX_TITLE_LENGTH)
      : product.title;
    const pricing = getProductPricingEstimate(product.cost_price, product.suggested_price);
    const draft = user?.id ? readProductImportDraft(user.id, product.id) : null;
    setTitle(draft?.title ?? truncated);
    const restoredPrice = draft?.sellPrice ?? pricing.suggestedSalePrice;
    setMultiplier(product.cost_price > 0 ? restoredPrice / product.cost_price : MULTIPLICADOR_SUGERIDO);
    setSellPrice(restoredPrice);
    setStep(draft ? Math.min(Math.max(draft.step, 1), 4) : 1);
    setPublishResult(null);
    setPublishing(false);
    setMlMissingCodes(null);
    setDescription(draft?.description ?? "");
    setTranslated(false);
    setBrand(draft?.brand ?? inferProductBrand(product, truncated));
    setModel(draft?.model ?? (product.model ?? "").trim());
    setAlbumName(draft?.albumName ?? inferStickerAlbumName(product, truncated));
    setSaleFormat(draft?.saleFormat ?? (product.title.toLowerCase().includes("kit") ? "kit" : "unit"));
    restoredProductId.current = product.id;
    autoDescriptionAttempted.current = Boolean(draft?.description);
  }

  const costPrice = product?.cost_price ?? 0;
  const totalCost = costPrice;
  const suggestedPricing = getProductPricingEstimate(costPrice, product?.suggested_price);

  useEffect(() => {
    if (!open || !user?.id || !product?.id) return;
    flowOpenedAt.current = Date.now();
    stepOpenedAt.current = Date.now();
    trackMobileHomeEvent(user.id, "import_flow_open", { productId: product.id });
  }, [open, product?.id, user?.id]);

  useEffect(() => {
    if (!open || !user?.id || !product?.id) return;
    const elapsedMs = Date.now() - stepOpenedAt.current;
    trackMobileHomeEvent(user.id, "import_flow_step", { productId: product.id, detail: String(step), elapsedMs });
    previousStep.current = step;
    stepOpenedAt.current = Date.now();
  }, [open, product?.id, step, user?.id]);

  useEffect(() => {
    if (!open || !user?.id || !product?.id || restoredProductId.current !== product.id || step > 4) return;
    saveProductImportDraft(user.id, {
      productId: product.id, step, title, sellPrice, description, brand, model, albumName, saleFormat,
    });
  }, [albumName, brand, description, model, open, product?.id, saleFormat, sellPrice, step, title, user?.id]);

  const handlePriceChange = (val: string) => {
    if (val === "") {
      setSellPrice(0);
      return;
    }
    const numericVal = Number(val);
    if (!isNaN(numericVal)) {
      setSellPrice(numericVal);
      if (costPrice > 0) {
        const calculatedMult = numericVal / costPrice;
        const clampedMult = Math.min(Math.max(calculatedMult, 1.5), 5.0);
        setMultiplier(clampedMult);
      }
    }
  };

  const profit = useMemo(() => Math.round((sellPrice - totalCost) * 100) / 100, [sellPrice, totalCost]);
  const profitMargin = useMemo(
    () => (sellPrice > 0 ? Math.round(((sellPrice - totalCost) / sellPrice) * 100) : 0),
    [sellPrice, totalCost]
  );

  const img = product ? primeiraImagemDoProduto(product.images) : null;
  const stockQty = product?.stock_quantity ?? 0;
  const hasStock = stockQty > 0;
  const requiresStickerAttrs = isStickerAlbumProduct(product, title);
  const mlAttributes = montarAtributosMl({
    marca: brand,
    modelo: model,
    nomeDoAlbum: albumName,
    formatoDeVenda: saleFormat,
    exigeAtributosDeAlbum: requiresStickerAttrs,
  });

  // A descrição não é mais pré-preenchida com a descrição original do produto
  // (que vinha com HTML cru do fornecedor). O usuário gera uma descrição limpa
  // pelo botão "Gerar descrição com IA".

  const handleClose = () => {
    if (publishing) return;
    setMlMissingCodes(null);
    trackMobileHomeEvent(user?.id, "import_flow_exit", { productId: product?.id, detail: `step_${step}`, elapsedMs: Date.now() - flowOpenedAt.current });
    setVisible(false);
    setTimeout(onClose, 160);
  };

  // Antes de sair do app, uma tela curta explica o que vai acontecer e avisa
  // quem está dentro do navegador do Instagram/TikTok.
  const handleConnectML = () => {
    if (!user) return;
    trackMobileHomeEvent(user.id, "ml_prepare_open", { productId: product?.id, detail: `import_step_${step}` });
    setPrepareOpen(true);
  };

  const confirmarConexaoMl = async () => {
    if (!user) return;
    setPrepareOpen(false);
    try {
      trackMobileHomeEvent(user.id, "ml_connect_open", { productId: product?.id, detail: `import_step_${step}` });
      if (product) {
        salvarRetornoMl({ origem: "product_import", rota: `/dashboard/catalogo/${product.id}?publicar=1` });
      }
      await startMercadoLivreOAuth();
    } catch (err) {
      trackMobileHomeEvent(user.id, "import_flow_error", { productId: product?.id, detail: "connection_start" });
      veloToast.error("Não foi possível iniciar a conexão com o Mercado Livre. Tente de novo em instantes.");
      return;
    }
  };


  const handleTranslate = async () => {
    if (!product) return;
    setTranslating(true);
    const toastId = veloToast.loading("Traduzindo título...");
    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [{
            role: "user",
            content: `Você é um tradutor especialista em e-commerce brasileiro. Traduza o nome deste produto para português do Brasil, adaptando para linguagem de venda. Máximo ${MAX_TITLE_LENGTH} caracteres. Produto: "${product.title}". Responda APENAS com o título traduzido, sem aspas, sem explicação.`
          }]
        },
      });
      if (error) throw error;
      const text = data?.response || data?.choices?.[0]?.message?.content || "";
      if (typeof text === "string" && text.trim()) {
        const cleaned = text.trim().replace(/^["']|["']$/g, '');
        const truncated = cleaned.length > MAX_TITLE_LENGTH ? cleaned.substring(0, MAX_TITLE_LENGTH) : cleaned;
        setTitle(truncated);
        setTranslated(true);
        veloToast.success("Título traduzido", { id: toastId });
      } else {
        veloToast.error("Não foi possível traduzir", { id: toastId });
      }
    } catch {
      veloToast.error("Erro ao traduzir", { id: toastId });
    } finally {
      setTranslating(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!product) return;
    setGeneratingDesc(true);
    const toastId = veloToast.loading("Gerando descrição com IA...");
    try {
      const texto = await gerarDescricaoComIa({
        titulo: title,
        categoria: product.category,
        preco: sellPrice,
      });
      setDescription(texto);
      veloToast.success("Descrição gerada", { id: toastId });
    } catch (e) {
      trackMobileHomeEvent(user?.id, "import_flow_error", { productId: product?.id, detail: "description_generation" });
      veloToast.error(e instanceof Error ? e.message : "Erro ao gerar descrição", { id: toastId });
    } finally {
      setGeneratingDesc(false);
    }
  };

  useEffect(() => {
    if (!open || step !== 3 || description.trim() || generatingDesc || autoDescriptionAttempted.current) return;
    autoDescriptionAttempted.current = true;
    void handleGenerateDescription();
  }, [description, generatingDesc, open, step]);

  const trackError = (detail: string) => {
    trackMobileHomeEvent(user?.id, "import_flow_error", { productId: product?.id, detail });
  };

  const advanceTo = (nextStep: number) => {
    trackMobileHomeEvent(user?.id, "import_flow_advance", {
      productId: product?.id,
      detail: `${step}_to_${nextStep}`,
      elapsedMs: Date.now() - stepOpenedAt.current,
    });
    setStep(nextStep);
  };

  const validatePublish = (): boolean => {
    if (!title.trim()) return veloToast.error("Preencha o título"), false;
    if (title.length > MAX_TITLE_LENGTH) return veloToast.error(`Máximo ${MAX_TITLE_LENGTH} caracteres`), false;
    if (sellPrice <= 0) return veloToast.error("Defina um preço válido"), false;
    if (sellPrice <= totalCost) return veloToast.error("Preço deve ser maior que o custo"), false;
    if (!platforms.ml && !platforms.shopee && !platforms.tiktok) return veloToast.error("Selecione ao menos uma plataforma"), false;
    if (platforms.ml && !isConnectedToML) return veloToast.error("Conecte sua conta do Mercado Livre"), false;
    if (!hasStock) return veloToast.error("Produto sem estoque"), false;
    if (platforms.ml && !brand.trim()) return veloToast.error("Informe a marca do produto"), false;
    if (platforms.ml && requiresStickerAttrs && !albumName.trim()) return veloToast.error("Informe o nome do álbum"), false;
    return true;
  };

  const handlePublish = async (
    override?: { categoryId?: string; sizeGridId?: string },
  ) => {
    if (!validatePublish() || !user) return;

    // Publicar no Mercado Livre não exige loja Velo — basta a conta ML conectada.
    const activeStore = getActiveStore();
    if (activeStore) {
      const publishedCount = getStorePublishedCount(activeStore.id);
      const productLimit = activeStore.productLimit ?? 30;
      if (publishedCount >= productLimit) {
        veloToast.error(`Limite de ${productLimit} produtos atingido nesta loja`);
        return;
      }
    }

    if (planLimits.loading) {
      veloToast.info("Verificando seu plano...");
      return;
    }

    if (!planLimits.canPublishProducts) {
      // Limite do Pro continua no modal de limite; plano grátis abre o modal
      // animado de planos (mesmo usado no restante do app).
      if (planLimits.plan === "pro" && planLimits.productLimitReached) {
        setUpgradeModalOpen(true);
      } else {
        upgradeModal.open({ defaultPlan: "base", origin: "product_import", productId: product.id });
      }
      return;
    }

    // Cada tentativa deve refletir apenas a resposta atual do Mercado Livre.
    setMlMissingCodes(null);
    setPublishing(true);
    // Não exibimos toast de carregamento: o próprio botão já comunica o estado.
    const toastId = `ml-publish-${Date.now()}`;
    try {
      let data: ResultadoDaPublicacao;
      try {
        data = await publicarNoMercadoLivre({
          produto: product,
          titulo: title,
          preco: sellPrice,
          descricao: description,
          marca: brand,
          modelo: model,
          atributos: mlAttributes,
          estoque: stockQty,
          override,
        });
      } catch (erro) {
        const codigo = erro instanceof ErroDePublicacao ? erro.codigo : undefined;

        // Categoria não pôde ser resolvida automaticamente → apenas informa o usuário.
        // (O modal manual foi removido a pedido: publicação no Mercado Livre está
        // temporariamente indisponível para produtos sem categoria confiável.)
        if (codigo === "CATEGORY_REQUIRES_MANUAL" || codigo === "CATEGORY_LOW_CONFIDENCE") {
          trackError(`publish:${codigo}`);
          veloToast.error(
            "Não foi possível publicar este produto no Mercado Livre no momento. Tente outro produto.",
            { id: toastId },
          );
          setPublishing(false);
          return;
        }

        // Conta do ML ainda não habilitada a vender. Como o pagamento vem antes
        // da ativação, o anúncio não se perde: guardamos pronto e ele sobe
        // sozinho assim que a conta for liberada.
        if (codigo === "ML_SELLER_CANNOT_LIST") {
          trackError("publish:ml_seller_cannot_list");
          veloToast.dismiss(toastId);
          trackMobileHomeEvent(user.id, "paid_without_seller", { productId: product.id, detail: "na_publicacao" });
          void enfileirarPublicacaoPendente({
            userId: user.id,
            productId: product.id,
            title: title.trim(),
            payload: montarCorpoDePublicacao({
              produto: product,
              titulo: title,
              preco: sellPrice,
              descricao: description,
              marca: brand,
              modelo: model,
              atributos: mlAttributes,
              estoque: stockQty,
              override,
            }),
          }).then((id) => {
            if (id) trackMobileHomeEvent(user.id, "pending_publication_queued", { productId: product.id });
          });
          if (erro instanceof ErroDePublicacao && erro.sellerCodes?.length) {
            setMlMissingCodes(erro.sellerCodes);
          } else {
            setMlVerifyModalOpen(true);
          }
          setPublishing(false);
          return;
        }

        trackError(codigo ? `publish:${codigo}` : "publish:known_error");
        veloToast.error(erro instanceof Error ? erro.message : "Não foi possível publicar. Confira os dados e tente novamente.", { id: toastId });
        setPublishing(false);
        return;
      }

      setMlMissingCodes(null);
      setPublishResult({ permalink: data.permalink, item_id: data.item_id });
      trackMobileHomeEvent(user.id, "publish_result", { productId: product.id, detail: data.parcial ? "partial" : "success" });
      trackMobileHomeEvent(user.id, "import_flow_complete", { productId: product.id, detail: data.parcial ? "partial" : "success", elapsedMs: Date.now() - flowOpenedAt.current });
      clearProductImportDraft(user.id, product.id);
      setStep(5);
      if (activeStore) incrementStorePublishedCount(activeStore.id);

      // Publicação por variação (anúncios-irmãos): se alguma variação falhou,
      // não podemos dizer "publicado com sucesso" — mostramos o placar exato.
      const avisoDeVariacoes = data.mensagem;
      if (data.parcial) {
        veloToast.info(avisoDeVariacoes ?? "Algumas variações não foram publicadas.", { id: toastId });
      } else veloToast.success(avisoDeVariacoes ?? "Produto publicado com sucesso", {
        id: toastId,
        action: data.permalink ? { label: "Ver", onClick: () => window.open(data.permalink, "_blank", "noopener,noreferrer") } : undefined,
      });
      void planLimits.refreshUsage();
      if (data.permalink) window.open(data.permalink, "_blank", "noopener,noreferrer");
    } catch (err) {
      trackError("publish:unexpected");
      veloToast.error(err instanceof Error ? err.message : "Não foi possível publicar agora. Tente novamente.", { id: toastId });
    } finally {
      setPublishing(false);
    }
  };

  const handleContinueFromReview = async () => {
    if (planLimits.loading) {
      veloToast.info("Verificando seu plano...");
      return;
    }

    if (!brand.trim()) {
      trackError("review:brand");
      veloToast.error("Informe a marca do produto (use 'Genérica' se não houver).");
      return;
    }

    if (!description.trim()) {
      trackError("review:description");
      veloToast.error("Confira a descrição ou toque em Gerar novamente antes de continuar.");
      return;
    }

    if (planLimits.canPublishProducts) {
      // Quem já paga publica direto. Se o Mercado Livre recusar por conta sem
      // perfil de vendedor, o próprio handlePublish guarda o anúncio e abre a
      // ajuda com texto e vídeo.
      void handlePublish();
      return;
    }

    // Quem ainda não assina segue direto para o plano: a conta de vendedor
    // deixou de bloquear o caminho antes do pagamento. A ajuda para ativar a
    // conta acontece depois, com o anúncio já pronto e salvo.
    advanceTo(4);
  };

  if (!open && !visible) return null;
  if (!product) return null;

  const titleLength = title.length;
  const canAdvanceDetails = hasStock && !!title.trim() && sellPrice > totalCost;
  const canAdvanceConnection = isConnectedToML === true;
  const titleNeedsTranslation = /[\u3040-\u30ff\u3400-\u9fff]|\b(with|wireless|women|men|kids|portable|for|and)\b/i.test(title);
  const visibleSteps = planLimits.canPublishProducts ? STEPS.slice(0, 3) : STEPS;
  const startModeOffset = isStartMode ? 48 : 0;
  const reachedProProductLimit = planLimits.plan === "pro" && planLimits.productLimitReached;
  const publishUpgradeTitle = reachedProProductLimit
    ? "Limite do Pro atingido"
    : "Desbloqueie a operação completa";
  const publishUpgradeMessage = reachedProProductLimit
    ? "Você atingiu o limite de 30 produtos do plano Pro."
    : "O plano grátis é modo teste: você pode explorar o catálogo e conectar 1 marketplace, mas publicações reais exigem um plano operacional.";
  const publishUpgradeCta = reachedProProductLimit
    ? "Upgrade Business"
    : "Desbloquear operação completa";
  const publishUpgradeTargetPlan = reachedProProductLimit ? "business" : "pro";
  const publishUpgradeBenefits = reachedProProductLimit
    ? ["Produtos ilimitados", "Marketplaces ilimitados", "Agentes IA ilimitados", "Operação sem limites"]
    : ["Publicação automática", "Até 30 produtos publicados", "Monitoramento básico 24h", "Relatórios financeiros"];

  return createPortal(
    <div
      className="fixed left-0 right-0 bottom-0 z-[60] flex justify-end"
      // 100dvh (não 100vh): no iOS Safari o 100vh usa o viewport "grande" (com as
      // barras recolhidas), maior que a área visível, e empurrava o rodapé com o
      // botão de publicar para baixo da tela. O dvh acompanha a altura real visível.
      style={{ top: startModeOffset, height: `calc(100dvh - ${startModeOffset}px)` }}
    >
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-[#0F172A]/35 backdrop-blur-[2px] transition-opacity duration-150 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`relative flex h-full w-full max-w-[1080px] overflow-hidden border-l border-[#DBEAFE] bg-white shadow-[-24px_0_70px_-24px_rgba(37,99,235,0.35)] transition-transform duration-150 ease-out md:rounded-l-[28px] ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ============== LEFT — MAIN ============== */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#E5EDFF] bg-[#F8FBFF] px-4 pb-4 pt-4 sm:px-6 md:px-8 md:pb-5 md:pt-7">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#EFF6FF] text-[#2563EB] ring-1 ring-[#DBEAFE]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[#0F172A] leading-tight">Importar produto</h2>
                <p className="text-[12.5px] text-[#64748B] mt-0.5">
                  {planLimits.canPublishProducts
                    ? "Confira os detalhes, conecte sua conta e revise antes de publicar."
                    : "Confira os detalhes, conecte sua conta, revise e escolha seu plano."}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              aria-label="Fechar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-white hover:text-[#0F172A]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Stepper */}
          <div className="mobile-hide-scrollbar overflow-x-auto border-b border-[#E5EDFF] bg-[#F8FBFF] px-4 pb-4 pt-1 sm:px-6 md:overflow-visible md:px-8 md:pb-5">
            <div className="flex min-w-max items-center md:min-w-0">
              {visibleSteps.map((s, i) => {
                const active = step === s.num;
                const done = step > s.num;
                return (
                  <div key={s.num} className="flex items-center md:flex-1 md:last:flex-initial">
                    <button
                      onClick={() => { if (done) setStep(s.num); }}
                      className="group flex items-center gap-2"
                      disabled={!done && !active}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-300 ${
                          active
                            ? "text-white shadow-[0_0_0_4px_rgba(37,99,235,0.16)]"
                            : done
                            ? "bg-[#2563EB] text-white"
                            : "bg-white text-[#94A3B8] ring-1 ring-[#E2E8F0]"
                        }`}
                        style={active ? { background: ACCENT } : undefined}
                      >
                        {done ? <Check size={12} strokeWidth={3} /> : s.num}
                      </span>
                      <span
                        className={`text-[13px] font-medium transition-colors ${
                          active ? "text-[#0F172A]" : done ? "text-[#0F172A]" : "text-[#94A3B8]"
                        }`}
                      >
                        {s.label}
                      </span>
                    </button>
                    {i < visibleSteps.length - 1 && (
                      <div className="relative mx-2 h-px w-8 overflow-hidden bg-[#DDE7FB] md:mx-3 md:w-auto md:flex-1">
                        <div
                          className="absolute inset-y-0 left-0 bg-[#2563EB] transition-all duration-500 ease-out"
                          style={{ width: step > s.num ? "100%" : "0%" }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content — animated per step */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 md:px-8" style={{ scrollbarWidth: "thin", minHeight: 0 }}>
            {/* STEP 1 — Detalhes */}
            {step === 1 && (
              <div key="s2" className="step-fade space-y-6 pb-6">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0A0A0A]">Título e precificação</h3>
                  <p className="text-[12.5px] text-gray-500 mt-1">Edite o título e defina seu preço de venda.</p>
                </div>

                {/* Stock warning */}
                {!hasStock && (
                  <div className="rounded-xl border border-red-100 bg-red-50/40 px-4 py-3">
                    <p className="text-[13px] font-medium text-red-600">Produto sem estoque disponível</p>
                    <p className="text-[11.5px] text-red-500/80 mt-0.5">Não é possível continuar com este produto.</p>
                  </div>
                )}

                {/* Title */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-medium text-gray-600">Título do anúncio</label>
                    {titleNeedsTranslation && (
                      <button
                        onClick={handleTranslate}
                        disabled={translating}
                        className="flex min-h-11 items-center gap-1.5 text-[12px] font-medium text-[#475569] transition-colors hover:text-[#0F172A] disabled:opacity-50"
                      >
                        {translating ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
                        {translating ? "Traduzindo" : translated ? "Traduzir novamente" : "Traduzir para português"}
                      </button>
                    )}
                  </div>
                  <input
                    value={title}
                    onChange={(e) => { if (e.target.value.length <= MAX_TITLE_LENGTH) setTitle(e.target.value); }}
                    maxLength={MAX_TITLE_LENGTH}
                    className="w-full rounded-xl border border-[#DCE7FA] bg-white px-4 py-2.5 text-[13px] text-[#0F172A] transition-colors placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none focus:ring-4 focus:ring-[#2563EB]/10"
                    placeholder="Digite o título"
                  />
                  <p className="text-[10.5px] text-gray-400 text-right mt-1.5">{titleLength}/{MAX_TITLE_LENGTH}</p>
                </div>

                {/* Pricing — o mais simples possível: custo → preço → lucro */}
                <div className="space-y-3">
                  <p className="text-[12px] font-medium text-gray-600">Seu preço de venda</p>

                  {/*
                    A ficha do produto mostra só o custo. Aqui, na hora de publicar, a
                    pessoa vê a sugestão da Velo e quanto sobra por venda — em linguagem
                    direta, sem multiplicador nem caixas empilhadas.
                  */}
                  <div className="rounded-xl bg-[#F4F8FF] px-4 py-3">
                    <p className="text-[12px] leading-[1.6] text-[#475569]">
                      Este produto custa{" "}
                      <span className="font-semibold text-[#0F172A]">{formatBRL(costPrice)}</span> para você.{" "}
                      A Velo sugere vender por{" "}
                      <span className="font-semibold text-[#0F172A]">
                        {formatBRL(suggestedPricing.suggestedSalePrice)}
                      </span>
                      , mas quem decide o preço é você.
                    </p>
                  </div>

                  {/* Sell price */}
                  <div>
                    <label className="text-[12px] font-medium text-gray-600 mb-2 block">
                      Por quanto você quer vender?
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] text-gray-400">R$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={sellPrice || ""}
                        onChange={(e) => handlePriceChange(e.target.value)}
                        className="w-full rounded-xl border border-[#DCE7FA] bg-white pl-10 pr-4 py-3 text-[15px] font-semibold text-[#0F172A] outline-none transition-colors hover:border-[#BBD0F7] focus:border-[#2563EB] focus:bg-white focus:ring-4 focus:ring-[#2563EB]/10"
                      />
                    </div>
                    {Math.abs(sellPrice - suggestedPricing.suggestedSalePrice) > 0.009 && (
                      <button
                        type="button"
                        onClick={() => handlePriceChange(String(suggestedPricing.suggestedSalePrice))}
                        className="mt-2 min-h-11 text-[12.5px] font-semibold text-[#2563EB]"
                      >
                        Usar preço sugerido de {formatBRL(suggestedPricing.suggestedSalePrice)}
                      </button>
                    )}
                  </div>

                  {/* Profit single line */}
                  <div className="flex items-center justify-between rounded-xl bg-[#F4F8FF] px-4 py-3">
                    <span className="text-[12px] text-[#64748B]">Sobra bruta estimada</span>
                    <span className={`text-[13.5px] font-semibold ${profit > 0 ? "text-[#0F172A]" : "text-red-500"}`}>
                      {formatBRL(profit)} <span className="text-[11px] font-medium text-gray-400 ml-1">· {profitMargin}%</span>
                    </span>
                  </div>
                  <p className="text-[11px] leading-4 text-[#64748B]">Antes das taxas do Mercado Livre, frete e impostos.</p>

                  {/* Explicação honesta sobre taxas */}
                  <div className="rounded-xl border border-[#E3EAF5] bg-white p-4">
                    <h4 className="text-[13.5px] font-semibold text-[#0F172A]">O que ainda sai desse valor</h4>
                    <p className="mt-1 text-[12.5px] leading-5 text-[#64748B]">
                      A Velo mostra uma estimativa bruta: preço de venda menos o que você paga pelo produto. Quando a venda acontece, o Mercado Livre ainda desconta:
                    </p>
                    <ul className="mt-2 space-y-1.5 text-[12.5px] leading-5 text-[#475569]">
                      <li>• <strong className="font-semibold text-[#0F172A]">Comissão do Mercado Livre</strong> — um percentual sobre o preço de venda, que muda conforme a categoria e o tipo de anúncio.</li>
                      <li>• <strong className="font-semibold text-[#0F172A]">Taxa fixa</strong> — cobrada em produtos de valor mais baixo.</li>
                      <li>• <strong className="font-semibold text-[#0F172A]">Frete</strong> — em muitos casos quem paga é o vendedor.</li>
                      <li>• <strong className="font-semibold text-[#0F172A]">Impostos</strong> — dependem da sua situação como vendedor.</li>
                    </ul>
                    <p className="mt-2.5 text-[12px] leading-4.5 text-[#64748B]">
                      Por isso o que entra no seu bolso é menor que o valor acima. Considere isso antes de definir um preço muito próximo do custo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 — Conexão */}
            {step === 2 && (
              <div key="s2-connect" className="step-fade space-y-5 pb-6">
                <div>
                  <h3 className="text-[17px] font-semibold text-[#0F172A]">Conecte onde o anúncio será publicado</h3>
                  <p className="mt-1 text-[13px] leading-5 text-[#64748B]">A Velo usa sua conta de vendedor do Mercado Livre para colocar o anúncio no ar.</p>
                </div>
                {isConnectedToML === null ? (
                  <div className="flex items-center gap-3 rounded-xl border border-[#DBEAFE] bg-[#F8FBFF] p-4 text-[13px] text-[#475569]">
                    <Loader2 size={18} className="animate-spin text-[#2563EB]" /> Verificando sua conta…
                  </div>
                ) : isConnectedToML ? (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-600" />
                    <div><p className="text-[14px] font-semibold text-emerald-800">Conta conectada</p><p className="mt-1 text-[12.5px] leading-5 text-emerald-700">Tudo certo para revisar seu anúncio.</p></div>
                  </div>
                ) : semContaDeVendedor ? (
                  <div className="rounded-xl border border-[#DBEAFE] bg-[#F8FBFF] p-4">
                    <div className="flex items-start gap-3">
                      <Link2 size={22} className="mt-0.5 shrink-0 text-[#2563EB]" />
                      <div>
                        <p className="text-[14px] font-semibold text-[#0F172A]">Conecte sua conta do Mercado Livre</p>
                        <p className="mt-1 text-[12.5px] leading-5 text-[#64748B]">
                          Pode conectar a conta que você já usa. Se ela ainda não estiver liberada para vender,
                          a gente te ajuda a resolver depois — seu anúncio fica guardado.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleConnectML}
                      className="mt-4 min-h-12 w-full rounded-xl bg-[#2563EB] px-4 text-[14px] font-semibold text-white"
                    >
                      Conectar Mercado Livre
                    </button>
                    <button
                      type="button"
                      onClick={() => setMlVerifyModalOpen(true)}
                      className="mt-2 min-h-12 w-full rounded-xl border border-[#DBEAFE] bg-white px-4 text-[13px] font-medium text-[#2563EB]"
                    >
                      Ainda não tenho conta no Mercado Livre
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#DBEAFE] bg-[#F8FBFF] p-4">
                    <div className="flex items-start gap-3"><Link2 size={22} className="mt-0.5 shrink-0 text-[#2563EB]" /><div><p className="text-[14px] font-semibold text-[#0F172A]">Conecte sua conta do Mercado Livre</p><p className="mt-1 text-[12.5px] leading-5 text-[#64748B]">Você voltará para este produto com título e preço preservados.</p></div></div>
                    <button type="button" onClick={handleConnectML} className="mt-4 min-h-12 w-full rounded-xl bg-[#2563EB] px-4 text-[14px] font-semibold text-white">Conectar Mercado Livre</button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3 — Revisão */}
            {step === 3 && (
              <div key="s3" className="step-fade space-y-6 pb-6">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0A0A0A]">Revisar anúncio</h3>
                  <p className="text-[12.5px] text-gray-500 mt-1">Escolha onde publicar e finalize a descrição.</p>
                </div>

                {/* Platforms — hoje a publicação é só no Mercado Livre */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Store size={12} className="text-gray-500" />
                    <p className="text-[12px] font-medium text-gray-600">Onde seu anúncio vai aparecer</p>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-[#2563EB] bg-[#EFF6FF] px-4 py-3">
                    <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-[13px] font-semibold text-[#2563EB]">Mercado Livre</p>
                      <p className="text-[11px] text-gray-500">
                        {isConnectedToML ? "Conta conectada — tudo certo para publicar" : "Conta ainda não conectada"}
                      </p>
                    </div>
                    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600">
                      <Check size={11} strokeWidth={3} className="text-white" />
                    </span>
                  </div>
                </div>

                {/* Summary */}
                <div className="rounded-xl border border-[#DCE7FA] divide-y divide-[#EDF2FF]">
                  <Row label="Título" value={title} />
                  <Row label="Plataforma" value="Mercado Livre" />
                  <Row label="Preço" value={formatBRL(sellPrice)} />
                  <Row label="Quantidade disponível para venda" value={`${stockQty} unidades`} />
                  <Row label="Sobra bruta estimada" value={formatBRL(profit)} strong />
                </div>

                {/* Mercado Livre attributes */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="text-[12px] font-medium text-gray-600">Marca e atributos</label>
                    <span className="text-[11px] font-medium text-gray-400">Exigido pelo Mercado Livre</span>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <input
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="Marca"
                      className="w-full rounded-xl border border-[#DCE7FA] bg-white px-4 py-2.5 text-[13px] text-[#0F172A] outline-none transition-colors hover:border-[#BBD0F7] focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 placeholder:text-[#94A3B8]"
                    />
                    <input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="Modelo (opcional)"
                      className="w-full rounded-xl border border-[#DCE7FA] bg-white px-4 py-2.5 text-[13px] text-[#0F172A] outline-none transition-colors hover:border-[#BBD0F7] focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 placeholder:text-[#94A3B8]"
                    />
                  </div>
                  {requiresStickerAttrs && (
                    <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[1fr_150px]">
                      <input
                        value={albumName}
                        onChange={(e) => setAlbumName(e.target.value)}
                        placeholder="Nome do álbum"
                        className="w-full rounded-xl border border-[#DCE7FA] bg-white px-4 py-2.5 text-[13px] text-[#0F172A] outline-none transition-colors hover:border-[#BBD0F7] focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 placeholder:text-[#94A3B8]"
                      />
                      <select
                        value={saleFormat}
                        onChange={(e) => setSaleFormat(e.target.value === "kit" ? "kit" : "unit")}
                        className="w-full rounded-xl border border-[#DCE7FA] bg-white px-4 py-2.5 text-[13px] text-[#0F172A] outline-none transition-colors hover:border-[#BBD0F7] focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                      >
                        <option value="unit">Unidade</option>
                        <option value="kit">Kit</option>
                      </select>
                    </div>
                  )}
                  {!brand.trim() && (
                    <p className="mt-1.5 text-[11.5px] text-red-600">
                      Informe a marca antes de publicar. Se o produto não tem marca formal, use "Genérica".
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-medium text-gray-600">Descrição do anúncio</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleGenerateDescription}
                        disabled={generatingDesc}
                        className="flex items-center gap-1.5 text-[11.5px] font-medium text-gray-500 hover:text-[#0A0A0A] transition-colors disabled:opacity-50"
                      >
                        {generatingDesc ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                        {generatingDesc ? "Gerando" : "Gerar com IA"}
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={generatingDesc ? "Preparando sua descrição…" : "Confira ou edite a descrição do anúncio"}
                    rows={5}
                    className="w-full resize-none rounded-xl border border-[#DCE7FA] bg-white px-4 py-3 text-[13px] text-[#0F172A] transition-colors placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none focus:ring-4 focus:ring-[#2563EB]/10"
                  />
                  {generatingDesc && <p className="mt-2 flex items-center gap-2 text-[12px] text-[#64748B]"><Loader2 size={13} className="animate-spin text-[#2563EB]" /> A IA está preparando uma descrição para você conferir.</p>}
                </div>

                <div className="rounded-xl border border-[#DCE7FA] bg-[#F8FBFF] p-4">
                  <p className="text-[11px] font-semibold uppercase text-[#64748B]">Prévia do anúncio</p>
                  <div className="mt-3 flex gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white">{img ? <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}</div>
                    <div className="min-w-0"><p className="line-clamp-2 text-[13px] font-semibold text-[#0F172A]">{title}</p><p className="mt-2 text-[16px] font-bold text-[#0F172A]">{formatBRL(sellPrice)}</p></div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 — Assinatura */}
            {step === 4 && (
              <div key="s3-plan" className="step-fade pb-6">
                <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.45)]">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#2563EB] text-white">
                      <ShieldCheck size={22} strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Plano Velo Pro</p>
                      <h3 className="mt-1 text-[22px] font-semibold leading-tight text-[#0A0A0A]">
                        Assine o Pro para publicar este produto
                      </h3>
                      <p className="mt-2 max-w-[520px] text-[13.5px] leading-relaxed text-gray-500">
                        Seu anúncio já está pronto. Revise o produto abaixo e assine o plano Pro para publicar.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-3xl bg-gray-50 p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100">
                        {img ? <img src={img} alt={title} className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-gray-500">Produto customizado</p>
                        <p className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-[#0A0A0A]">
                          {title || product.title}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-gray-500">
                          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-gray-100">
                            Preço definido: <strong className="font-semibold text-[#0A0A0A]">{formatBRL(sellPrice)}</strong>
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-gray-100">
                            Sobra bruta estimada: <strong className="font-semibold text-[#0A0A0A]">{formatBRL(profit)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => upgradeModal.open({ defaultPlan: "base", origin: "product_import", productId: product.id })}
                    className="mt-6 flex h-[52px] w-full items-center justify-center rounded-full bg-[#2563EB] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
                  >
                    Assinar Base — R$ 39,90/mês
                  </button>
                  <p className="mt-3 text-center text-[12.5px] leading-relaxed text-gray-500">
                    Assinatura mensal do plano Base. Cancele quando quiser.
                  </p>
                  <button
                    type="button"
                    onClick={() => upgradeModal.open({ defaultPlan: "pro", origin: "product_import", productId: product.id })}
                    className="mx-auto mt-4 block max-w-[520px] text-center text-[12.5px] font-medium leading-relaxed text-gray-500 underline underline-offset-4 transition-colors hover:text-[#2563EB]"
                  >
                    Prefere começar direto no Pro (R$ 79,80/mês) com automações completas?
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4 — Success */}
            {step === 5 && publishResult && (
              <div key="s4" className="step-fade flex flex-col items-center justify-center py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full mb-5" style={{ background: ACCENT }}>
                  <Check size={26} strokeWidth={3} className="text-white" />
                </div>
                <h3 className="text-[16px] font-semibold text-[#0A0A0A]">Anúncio publicado</h3>
                <p className="text-[12.5px] text-gray-500 mt-1.5 max-w-[320px]">Seu produto já está no Mercado Livre. ID: <span className="font-medium text-[#0A0A0A]">{publishResult.item_id}</span></p>
                <a
                  href={publishResult.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#2563EB] px-6 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:bg-[#1D4ED8]"
                >
                  <ExternalLink size={13} />
                  Abrir no Mercado Livre
                </a>
              </div>
            )}
          </div>

          {/* Footer — permanece visível no celular, inclusive com o teclado aberto. */}
          <div
            className="flex shrink-0 items-center justify-end border-t border-[#E5EDFF] bg-[#F8FBFF] px-4 py-3 sm:px-6 md:px-8 md:py-4"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex w-full items-center justify-end gap-2 md:w-auto">
              {step < 5 && (
                <button
                  onClick={handleClose}
                  className="rounded-[100px] px-4 py-2 text-[12.5px] font-[400] text-[#737373] transition-all duration-[120ms] hover:text-[#0A0A0A]"
                >
                  Cancelar
                </button>
              )}
              {step > 1 && step < 5 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="rounded-[100px] border-[1.5px] border-[#E5E5E5] px-4 py-2 text-[12.5px] font-[400] text-[#0A0A0A] transition-all duration-[120ms] hover:border-[#0A0A0A] hover:bg-[#F5F5F5]"
                >
                  Voltar
                </button>
              )}
              {step === 1 && (
                <button
                  onClick={() => {
                    if (!hasStock) return void (trackError("details:no_stock"), veloToast.error("Este produto está sem estoque. Escolha outro produto para publicar."));
                    if (!title.trim()) return void (trackError("details:title"), veloToast.error("Digite um título para continuar."));
                    if (sellPrice <= totalCost) return void (trackError("details:price"), veloToast.error("Escolha um preço maior que o custo do produto."));
                    advanceTo(2);
                  }}
                  disabled={!canAdvanceDetails}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#2563EB] px-6 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Continuar para conexão
                  <ArrowRight size={13} />
                </button>
              )}
              {step === 2 && (
                <button
                  onClick={() => {
                    if (!canAdvanceConnection) {
                      trackError("connection:not_connected");
                      veloToast.info("Conecte sua conta do Mercado Livre para continuar.");
                      return;
                    }
                    advanceTo(3);
                  }}
                  disabled={!canAdvanceConnection}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#2563EB] px-6 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isConnectedToML === null ? "Verificando conta…" : "Continuar para revisão"}
                  <ArrowRight size={13} />
                </button>
              )}
              {step === 3 && (
                <button
                  onClick={() => void handleContinueFromReview()}
                  disabled={checkingSeller || publishing || generatingDesc}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#2563EB] px-6 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:bg-[#1D4ED8]"
                >
                  {generatingDesc
                    ? "Preparando descrição…"
                    : checkingSeller
                      ? "Verificando conta…"
                      : planLimits.canPublishProducts
                        ? "Publicar produto"
                        : "Continuar para o plano"}
                  <ArrowRight size={13} />
                </button>
              )}
              {step === 5 && (
                <button onClick={handleClose} className="inline-flex h-11 items-center justify-center rounded-full bg-[#2563EB] px-6 text-[13px] font-semibold text-white">
                  Concluir
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ============== RIGHT — PRODUCT DETAIL ============== */}
        <div className="hidden w-[300px] shrink-0 flex-col border-l border-[#E5EDFF] bg-[#F8FBFF] md:flex">
          <div className="flex items-center justify-between px-6 pt-7 pb-4">
            <h3 className="text-[13px] font-semibold text-[#0A0A0A]">Detalhes do produto</h3>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5" style={{ scrollbarWidth: "thin" }}>
            {/* Image + title */}
            <div className="flex gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white border border-gray-100">
                {img ? <img src={img} alt={title} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-[#0A0A0A] leading-snug line-clamp-2">{title || product.title}</p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-200" />

            {/* Info rows — só o essencial para decidir */}
            <div className="space-y-3">
              <DetailRow label="Custo para você" value={formatBRL(costPrice)} />
              <DetailRow label="Seu preço" value={<span className="font-semibold text-[#0A0A0A]">{formatBRL(sellPrice || costPrice * 2.5)}</span>} />
              <DetailRow label="Sobra bruta estimada" value={<span className={profit > 0 ? "text-[#0A0A0A] font-medium" : "text-red-500"}>{formatBRL(profit)}</span>} />
              <DetailRow label="Estoque" value={`${stockQty} un`} />
            </div>
          </div>
        </div>

      </div>

      <UpgradeLimitModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title={publishUpgradeTitle}
        message={publishUpgradeMessage}
        cta={publishUpgradeCta}
        targetPlan={publishUpgradeTargetPlan}
        benefits={publishUpgradeBenefits}
      />

      <MLConnectPrepareModal
        open={prepareOpen}
        onClose={() => setPrepareOpen(false)}
        onConfirm={() => void confirmarConexaoMl()}
      />

      <MLAccountVerificationModal
        open={mlVerifyModalOpen}
        onClose={() => setMlVerifyModalOpen(false)}
        // Fechar e concluir apenas fecham. A conta é revalidada no próximo clique
        // em "Publicar produto" — rechecar aqui reabria o modal na sequência.
        onFinish={() => setMlVerifyModalOpen(false)}
        // "Já criei minha conta, verificar de novo" confirmou a conta: quem ainda
        // não tem plano segue para a etapa de plano, quem já tem publica.
        onVerified={() => {
          setMlVerifyModalOpen(false);
          if (planLimits.canPublishProducts) void handlePublish();
          else if (isConnectedToML) advanceTo(4);
        }}
      />

      <MlMissingInfoModal
        open={mlMissingCodes !== null}
        sellerCodes={mlMissingCodes ?? []}
        onClose={() => setMlMissingCodes(null)}
      />

      {/* ManualCategoryDialog removido: não exibir seletor de categoria manual. */}



      {/* Animations */}
      <style>{`
        .step-fade {
          animation: stepIn 150ms ease both;
        }
        @keyframes stepIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  , document.body);
};

/* ---------- Small presentational helpers ---------- */

const Row = ({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) => (
  <div className="flex items-center justify-between px-4 py-2.5">
    <span className="text-[12px] text-gray-500">{label}</span>
    <span className={`text-[12.5px] text-right truncate max-w-[60%] ${strong ? "font-semibold text-[#0A0A0A]" : "text-[#0A0A0A]"}`}>
      {value}
    </span>
  </div>
);

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between">
    <span className="text-[11.5px] text-gray-500">{label}</span>
    <span className="text-[12px] text-[#0A0A0A]">{value}</span>
  </div>
);

export default ImportProductModal;
