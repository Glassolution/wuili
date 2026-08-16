// Atlas Chat — assistente conversacional da Velo via Lovable AI Gateway (Gemini)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ATLAS_NAV_ITEMS,
  buildAtlasSystemPrompt,
  type AtlasNavItem,
} from "../_shared/atlas-knowledge.ts";
import {
  beginnerNicheSuggestions,
  findValidatedNiche,
  normalizeGuideText,
  VALIDATED_NICHES,
  type MarketSignal,
  type ValidatedNiche,
} from "../_shared/atlas-beginner-guide.ts";
import { atlasRouteTagPromptSection } from "../_shared/atlas-route-tags.ts";
import { resolveAtlasFaq } from "../_shared/atlas-faq.ts";
import { checarQuotaAtlas, mensagemDeQuotaEsgotada, ATLAS_ETAPA_RESUMO } from "../_shared/atlas-quota.ts";
import { montarJanelaDeContexto, MODELO_RESUMO, LIMITE_PARA_RESUMIR } from "../_shared/atlas-context.ts";
import { escolherModeloDoAtlas } from "../_shared/atlas-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ChatMessage = {
  role: "user" | "assistant" | string;
  content: string;
  product_data?: {
    actions?: AtlasAction[];
  } | null;
};

type NavigationAction = {
  type: "navigation";
  label: string;
  route: string;
  reason?: string;
  /** "primary" pede o Botão Pilot (fundo escuro sólido) no frontend. */
  variant?: "primary";
};

type ProductCardAction = {
  type: "product_card";
  product_id: string;
  reason?: string;
  product?: {
    id: string;
    title: string;
    image_url: string | null;
    margin_percent: number | null;
    suggested_price: number | null;
    route: string;
  };
};

type PageContext = {
  rota?: string;
  nome?: string;
};

type QuickReplyAction = {
  type: "quick_reply";
  label: string;
  message: string;
};

/**
 * Botão que inicia o OAuth do Mercado Livre direto do chat, sem o usuário ter
 * que caçar a tela de integrações. O frontend chama `startMercadoLivreOAuth()`,
 * que só redireciona para URLs de auth.mercadolivre.com.
 */
type ConnectMlAction = {
  type: "connect_ml";
  label: string;
};

/**
 * Abre a vitrine de produtos do guia (modal do frontend).
 *
 * O nicho vai junto para a vitrine cruzar o que o usuário acabou de escolher na
 * conversa com o perfil respondido no cadastro, em vez de mostrar só o perfil.
 */
type OpenShowcaseAction = {
  type: "open_showcase";
  label: string;
  niche?: { id: string; label: string; catalogTerms: string[] };
};

type AtlasAction =
  | NavigationAction
  | ProductCardAction
  | QuickReplyAction
  | ConnectMlAction
  | OpenShowcaseAction;


type AtlasResponse = {
  message: string;
  actions: AtlasAction[];
};

type CatalogProductPreview = {
  id: string;
  title: string;
  images: unknown;
  suggested_price: number | null;
  margin_percent: number | null;
  category: string | null;
  description?: string | null;
  orders_count?: number | null;
};

type ServiceClient = SupabaseClient<any> | null;

type MercadoLivreIntegrationRow = {
  access_token?: string | null;
  expires_at?: string | null;
  platform?: string | null;
};

const quickReply = (label: string, message = label): QuickReplyAction => ({
  type: "quick_reply",
  label,
  message,
});

const productCardFromRow = (product: CatalogProductPreview): ProductCardAction => ({
  type: "product_card",
  product_id: product.id,
  product: {
    id: product.id,
    title: product.title,
    image_url: getFirstImageUrl(product.images),
    margin_percent: product.margin_percent,
    suggested_price: product.suggested_price,
    route: `/dashboard/catalogo/${product.id}`,
  },
});

const isBeginnerTrigger = (message: string, userMessageCount: number) => {
  const normalized = normalizeGuideText(message);
  if (
    /\b(ajude|ajuda|quero|preciso).*\b(comecar|inicio|iniciar|zero)\b/.test(normalized) ||
    /\b(nao sei).*\b(comecar|por onde|o que fazer)\b/.test(normalized) ||
    /\b(nunca fiz|sou iniciante|iniciante|primeira vez|dropshipping)\b/.test(normalized)
  ) {
    return true;
  }

  if (userMessageCount <= 1) {
    return /^(oi|ola|opa|bom dia|boa tarde|boa noite|ajuda|me ajuda|como funciona|quero vender|quero comecar)$/i.test(
      normalized.trim(),
    );
  }

  return false;
};

/**
 * Contagem de produtos escrita como gente escreve.
 *
 * Antes saía "3 produto(s) desse nicho disponíveis", que é jeito de sistema
 * falar, não de alguém explicando.
 */
const contagemDeProdutos = (total: number) => {
  if (total <= 0) return "Ainda não tenho produto desse nicho com estoque no catálogo.";
  if (total === 1) return "Tem 1 produto desse nicho com estoque no catálogo agora.";
  return `Tem ${total} produtos desse nicho com estoque no catálogo agora.`;
};

const isConfirmText = (message: string) =>
  /\b(sim|isso|esse|essa|confirmo|confirmar|pode seguir|seguir|quero|vamos|ok|beleza|primeiro|1)\b/.test(
    normalizeGuideText(message),
  );

/** "Já conectei", "autorizei", "pronto" e afins, ditos no passo da conexão. */
const saidConnectedMl = (message: string) =>
  /\b(ja conectei|conectei|conectado|conectada|autorizei|autorizado|ja fiz|pronto|terminei|finalizei)\b/.test(
    normalizeGuideText(message),
  );

/** Pedido explícito de adiar a conexão, para o guia não virar uma parede. */
const wantsToConnectLater = (message: string) =>
  /\b(depois|mais tarde|agora nao|outra hora|pular|pula)\b/.test(normalizeGuideText(message));

const wantsOtherOptions = (message: string) =>
  /\b(outra|outras|outro|outros|mais opcoes|ver outras|trocar produto)\b/.test(normalizeGuideText(message));

// O "de" é opcional de propósito: os botões do guia mandam "Mudar de nicho", e
// sem essa tolerância a mensagem não casava e o usuário caía fora do fluxo.
const wantsChangeNiche = (message: string) =>
  /\b((mudar|trocar|escolher)( de)? nicho|outro nicho|outros nichos|ver outros nichos|voltar|recomecar)\b/.test(
    normalizeGuideText(message),
  );

const wantsNoNicheHelp = (message: string) =>
  /\b(nao sei|tanto faz|me sugere|sugere|escolha por mim|qual melhor)\b/.test(normalizeGuideText(message));

const isConversationalAside = (message: string) => {
  const normalized = normalizeGuideText(message).replace(/[?!.,]+/g, " ").replace(/\s+/g, " ").trim();
  const hasGuideIntent =
    /\b(continuar|seguir|proximo|proxima|guia|passo|nicho|produto|catalogo|mercado livre|conectar|publicar|vender|comecar|iniciar)\b/.test(
      normalized,
    );
  if (hasGuideIntent) return false;

  return (
    /^(oi|ola|opa|e ai|bom dia|boa tarde|boa noite)( atlas)?$/.test(normalized) ||
    /\b(tudo bem|tudo bom|como voce esta|como vc esta|como vai|voce esta bem)\b/.test(normalized) ||
    /\b(obrigado|obrigada|valeu|show|legal)\b/.test(normalized)
  );
};

const conversationalAsideResponse = (nome: string | null = null): AtlasResponse => ({
  message:
    `Oi${nome ? `, ${nome}` : ""}! Estou por aqui. 😄\n\nPode falar comigo normalmente: tiro dúvidas, explico dropshipping ou continuo o seu guia de onde parou.\n\nMe conta o que você quer fazer agora.`,
  actions: [],
});

const isBeginnerGuideReply = (message: string) => {
  const normalized = normalizeGuideText(message);
  return Boolean(
    findValidatedNiche(message) ||
      wantsChangeNiche(message) ||
      wantsNoNicheHelp(message) ||
      wantsOtherOptions(message) ||
      wantsToConnectLater(message) ||
      saidConnectedMl(message) ||
      /\b(sim|isso|esse|essa|ok|beleza|confirmo|confirmar|pode seguir|seguir|continuar|proximo|proxima|vamos|buscar produtos|quero esse|quero essa|quero seguir|conectar|mercado livre|publicar|abrir catalogo|abrir catálogo)\b/.test(
        normalized,
      ),
  );
};

const fetchMercadoLivreSignal = async (niche: ValidatedNiche): Promise<MarketSignal | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const url = new URL("https://api.mercadolibre.com/sites/MLB/search");
    url.searchParams.set("q", niche.marketQuery);
    url.searchParams.set("limit", "1");
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const data = await response.json();
    const total = Number(data?.paging?.total ?? 0);
    if (!Number.isFinite(total) || total <= 0) return null;
    const demand = Math.min(100, Math.round(Math.log10(total + 1) * 24));
    const competition = Math.min(100, Math.round(Math.log10(total + 1) * 20));
    const score = Math.max(1, Math.round(demand * 0.72 + (100 - competition) * 0.28));
    return {
      nicheId: niche.id,
      label: niche.label,
      source: "mercado_livre_public_search",
      demand,
      competition,
      score,
      note: `Para você ter uma ideia do tamanho: hoje o Mercado Livre mostra ${total.toLocaleString("pt-BR")} anúncios quando alguém busca por produtos desse tipo.`,
      catalogCount: 0,
    };
  } catch (error) {
    console.warn("atlas beginner market signal skipped", niche.id, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Categorias em destaque do passo 1, derivadas do catálogo.
 *
 * Nada de lista fixa: a taxonomia vem do scraping do fornecedor e já mudou por
 * inteiro num sync, deixando 11 das 13 categorias antigas com zero produto. Aqui
 * pegamos as N com mais produtos disponíveis, então um novo sync se ajusta sozinho.
 * O valor enviado na URL é exatamente o que está no banco — o mesmo que o
 * dropdown do catálogo usa, para chip e navegação manual não divergirem.
 */
const categoriasEmDestaque = async (
  supabase: ServiceClient,
  quantidade = 6,
): Promise<{ valor: string; total: number }[]> => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("catalog_products")
    .select("category")
    .eq("is_blocked", false)
    .gt("stock_quantity", 0)
    .limit(5000);
  if (error) {
    console.error("atlas destaque de categorias falhou", error);
    return [];
  }

  const contagem = new Map<string, number>();
  (data ?? []).forEach((linha: { category?: unknown }) => {
    const valor = typeof linha.category === "string" ? linha.category.trim() : "";
    if (!valor) return;
    contagem.set(valor, (contagem.get(valor) ?? 0) + 1);
  });

  return [...contagem.entries()]
    .map(([valor, total]) => ({ valor, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, quantidade);
};

/**
 * Disponibilidade real por nicho, em UMA consulta.
 *
 * Antes era uma consulta por nicho com `.limit(12)`: o número reportado não era
 * a contagem do nicho, era "quantos dos 12 primeiros bateram" — por isso o guia
 * chegou a dizer "0 produtos" para Acessórios, que tem centenas. Buscar o
 * catálogo inteiro uma vez (só título, descrição e categoria) sai mais barato
 * que 15 consultas e devolve o número certo.
 */
const fetchInternalCatalogSignals = async (
  supabase: ServiceClient,
): Promise<MarketSignal[]> => {
  const semDados = (): MarketSignal[] =>
    VALIDATED_NICHES.map((niche, index) => ({
      nicheId: niche.id,
      label: niche.label,
      source: "internal_catalog_fallback" as const,
      demand: 50 - index,
      competition: 45,
      score: 50 - index,
      // Sem contagem de estoque para mostrar, a nota vira uma dica útil. O
      // usuário não precisa saber que uma consulta interna não respondeu.
      note: "Vale conferir o estoque na hora de escolher, porque anúncio de produto sem estoque acaba pausado.",
      catalogCount: 0,
    }));

  if (!supabase) return semDados();

  const { data, error } = await supabase
    .from("catalog_products")
    .select("id,title,description,category,margin_percent,orders_count")
    .eq("source", "c7drop")
    .eq("is_active", true)
    .eq("is_blocked", false)
    .gt("stock_quantity", 0)
    .limit(1000);

  if (error) {
    console.error("atlas beginner catalog availability error", error);
    return semDados();
  }

  const produtos = (data ?? []) as CatalogProductPreview[];

  return VALIDATED_NICHES.map((niche) => {
    const doNicho = produtos.filter((produto) => contarTermosDoNicho(produto, niche) > 0);
    const avgMargin =
      doNicho.reduce((sum, row) => sum + Number(row.margin_percent ?? 0), 0) / Math.max(doNicho.length, 1);
    const demand = Math.min(100, doNicho.reduce((sum, row) => sum + Number(row.orders_count ?? 0), 0) / 4);
    const score = Math.round(Math.min(100, doNicho.length * 1.2 + avgMargin * 0.45 + demand * 0.2));
    return {
      nicheId: niche.id,
      label: niche.label,
      source: "internal_catalog_fallback" as const,
      demand: Math.round(demand),
      competition: Math.max(20, Math.min(80, Math.round(doNicho.length / 6))),
      score,
      note: contagemDeProdutos(doNicho.length),
      catalogCount: doNicho.length,
    };
  });
};

/**
 * Sinais de nicho para o guia.
 *
 * A disponibilidade no catálogo Velo é SEMPRE consultada e manda no resultado: a
 * demanda do Mercado Livre só reordena o que a gente tem para vender. Antes, se a
 * API do ML respondesse, o catálogo era ignorado e o guia chegava a sugerir nicho
 * com zero produto — o usuário confirmava e travava no passo seguinte.
 */
const researchMarketSignals = async (supabase: ServiceClient) => {
  const [liveSignals, internalSignals] = await Promise.all([
    Promise.all(VALIDATED_NICHES.map(fetchMercadoLivreSignal)),
    fetchInternalCatalogSignals(supabase),
  ]);

  const porNicho = new Map(internalSignals.map((signal) => [signal.nicheId, signal]));
  const combinados = internalSignals.map((interno) => {
    const live = liveSignals.find((signal) => signal?.nicheId === interno.nicheId) ?? null;
    if (!live) return interno;
    return {
      ...live,
      // A contagem do catálogo vem sempre do sinal interno; o do ML não a conhece.
      catalogCount: interno.catalogCount,
      note: `${live.note} ${contagemDeProdutos(interno.catalogCount)}`,
    };
  });

  void porNicho;
  return combinados;
};

/** Só entra na lista o nicho que a Velo consegue atender hoje. */
const nichosDisponiveis = (signals: MarketSignal[]) => signals.filter((signal) => signal.catalogCount > 0);

const researchSingleNiche = async (niche: ValidatedNiche, supabase: ServiceClient) => {
  const [liveSignal, internalSignals] = await Promise.all([
    fetchMercadoLivreSignal(niche),
    fetchInternalCatalogSignals(supabase),
  ]);
  const interno = internalSignals.find((signal) => signal.nicheId === niche.id);
  // O sinal do ML nunca sabe do nosso estoque: a contagem real vem do interno.
  if (liveSignal) return { ...liveSignal, catalogCount: interno?.catalogCount ?? 0 };
  return interno ?? {
    nicheId: niche.id,
    label: niche.label,
    source: "internal_catalog_fallback" as const,
    demand: 50,
    competition: 45,
    score: 50,
    note: "Esse é um nicho que a Velo já atende.",
    catalogCount: 0,
  };
};

const unsafePatterns = [
  /ignore (as )?instru(c|ç)(o|õ)es/i,
  /ignorar (as )?instru(c|ç)(o|õ)es/i,
  /instru(c|ç)(o|õ)es anteriores/i,
  /instrucoes anteriores/i,
  /instrucoes internas/i,
  /instru(c|ç)(o|õ)es internas/i,
  /diretrizes internas/i,
  /regras internas/i,
  /politicas internas/i,
  /pol[ií]ticas internas/i,
  /prompt (de )?sistema/i,
  /system prompt/i,
  /mensagem (do|de) sistema/i,
  /system message/i,
  /developer (message|instructions|prompt)/i,
  /instrucoes (de )?desenvolvedor/i,
  /instru(c|ç)(o|õ)es (de )?desenvolvedor/i,
  /repita (seu|o) prompt/i,
  /mostre (seu|o) prompt/i,
  /revele (seu|o) prompt/i,
  /cole (seu|o|a) (prompt|mensagem|instru(c|ç)(a|ã)o|instrucoes)/i,
  /modo (debug|manuten(c|ç)(a|ã)o|admin|desenvolvedor)/i,
  /manutencao/i,
  /manuten(c|ç)(a|ã)o/i,
  /\bdebug\b/i,
  /\badmin\b/i,
  /administrador/i,
  /master/i,
  /sou (administrador|admin|desenvolvedor|dev|funcion[aá]rio)/i,
  /voce e (administrador|admin|desenvolvedor|dev)/i,
  /você é (administrador|admin|desenvolvedor|dev)/i,
  /a partir de agora/i,
  /sem regras/i,
  /sem restri(c|ç)(o|õ)es/i,
  /jailbreak/i,
  /\bdan\b/i,
  /do anything now/i,
  /chave(s)? (de )?(api|ia)/i,
  /\bapi key\b/i,
  /\bkey\b/i,
  /service role/i,
  /service_role/i,
  /anon key/i,
  /jwt secret/i,
  /supabase.*(key|chave|secret|segredo)/i,
  /\bsecret(s)?\b/i,
  /segredo(s)?/i,
  /token(s)?/i,
  /arquitetura (do )?backend/i,
  /dados de outro(s)? usu[aá]rio(s)?/i,
  /outro(s)? usu[aá]rio(s)?/i,
  /custo(s)? real(is)?/i,
  /\bcost_price\b/i,
  /margem(ns)? real(is)?/i,
  /supplier_contact/i,
  /contato do fornecedor/i,
  /base64/i,
  /decodifique/i,
  /\bdecode\b/i,
];

const productIntentPatterns = [
  /recomend/i,
  /produto/i,
  /vencedor/i,
  /cat[aá]logo/i,
  /nich(o|os)/i,
  /encontrar/i,
  /achar/i,
  /alta/i,
];

const categoryHints = [
  "beleza",
  "casa",
  "eletronico",
  "eletrônico",
  "eletronicos",
  "eletrônicos",
  "pet",
  "pets",
  "cozinha",
  "moda",
  "saude",
  "saúde",
  "fitness",
  "infantil",
  "decoracao",
  "decoração",
  "automotivo",
  "celular",
];

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const createServiceClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
  const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? serviceRoleKey;
  if (!dbUrl || !dbKey) return null;
  return createClient(dbUrl, dbKey, { auth: { persistSession: false } });
};

/**
 * Uso reportado pela própria API, no formato OpenAI que o gateway devolve.
 *
 * Lido de forma defensiva: se o gateway parar de mandar algum campo, o registro
 * entra com null em vez de derrubar a resposta do chat.
 */
/** Modelo padrão quando a heurística de roteamento não escolhe outro. */
const MODELO_DO_ATLAS = "google/gemini-2.5-flash";

/**
 * System prompt congelado.
 *
 * Montado uma única vez por instância e reutilizado byte a byte em todo request:
 * é isso que permite ao provedor reconhecer o prefixo e cobrar cache em vez de
 * entrada nova. Nada variável (página atual, produto, resumo) entra aqui — vai
 * em mensagens posteriores, depois do bloco fixo.
 */
const ATLAS_SYSTEM_PROMPT = buildAtlasSystemPrompt();

type UsoDoModelo = {
  entrada: number | null;
  saida: number | null;
  cache: number | null;
  total: number | null;
};

const lerUsoDoModelo = (data: unknown): UsoDoModelo => {
  const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
  const usage = (data as { usage?: Record<string, unknown> } | null)?.usage;
  if (!usage) return { entrada: null, saida: null, cache: null, total: null };

  const detalhes = usage.prompt_tokens_details as Record<string, unknown> | undefined;
  return {
    entrada: numero(usage.prompt_tokens ?? usage.input_tokens),
    saida: numero(usage.completion_tokens ?? usage.output_tokens),
    // Nem todo provedor reporta cache. Quando não vier, fica null.
    cache: numero(detalhes?.cached_tokens ?? usage.cache_read_input_tokens),
    total: numero(usage.total_tokens),
  };
};

type RegistroDeUso = {
  userId: string | null;
  origem: "modelo" | "codigo";
  etapa: string;
  modelo?: string | null;
  uso?: UsoDoModelo | null;
  duracaoMs?: number | null;
  erro?: string | null;
};

/**
 * Grava uma linha por resposta do Atlas.
 *
 * Nunca lança e nunca é aguardado no caminho da resposta: medir custo não pode
 * ser motivo para o chat falhar nem para o usuário esperar mais.
 */
const registrarUso = (registro: RegistroDeUso) => {
  try {
    const supabase = createServiceClient();
    if (!supabase) return;
    void supabase
      .from("atlas_usage_logs")
      .insert({
        user_id: registro.userId,
        origem: registro.origem,
        etapa: registro.etapa,
        modelo: registro.modelo ?? null,
        tokens_entrada: registro.uso?.entrada ?? null,
        tokens_saida: registro.uso?.saida ?? null,
        tokens_cache: registro.uso?.cache ?? null,
        tokens_total: registro.uso?.total ?? null,
        duracao_ms: registro.duracaoMs ?? null,
        erro: registro.erro ?? null,
      })
      .then(({ error }) => {
        if (error) console.error("atlas usage log falhou", error.message);
      });
  } catch (e) {
    console.error("atlas usage log falhou", e);
  }
};

/**
 * Nome da etapa a partir da própria resposta.
 *
 * O guia já carrega "Passo N de 5" no texto, então dá para etiquetar sem
 * espalhar parâmetro por todas as funções que montam resposta.
 */
const etapaDaRespostaDoGuia = (resposta: AtlasResponse) => {
  const passo = resposta.message.match(/passo\s*([1-5])\s*de\s*5/i);
  return passo ? `guia_passo_${passo[1]}` : "guia_outro";
};

const authenticateRequest = async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return data.user.id;
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const getLastUserMessage = (messages: ChatMessage[]) =>
  [...messages].reverse().find((message) => message.role !== "assistant")?.content ?? "";

const getLastAssistantMessage = (messages: ChatMessage[]) =>
  [...messages].reverse().find((message) => message.role === "assistant") ?? null;

const getLastAssistantActions = (messages: ChatMessage[]) =>
  getLastAssistantMessage(messages)?.product_data?.actions ?? [];

const normalizeSafetyText = (value: string) =>
  normalizeText(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isUnsafeRequest = (message: string) => {
  const normalizedMessage = normalizeSafetyText(message);
  return unsafePatterns.some((pattern) => pattern.test(message) || pattern.test(normalizedMessage));
};

const sanitizeUnsafeHistory = (messages: ChatMessage[]) =>
  messages.map((message) => {
    if (message.role === "assistant" || !isUnsafeRequest(message.content)) return message;
    return {
      ...message,
      content: "[Mensagem anterior omitida por conter solicitação não permitida.]",
    };
  });

const refusalResponse = (): AtlasResponse => ({
  message:
    "Esse assunto eu não consigo ajudar. O que eu faço bem é te orientar dentro da Velo: conectar o Mercado Livre, encontrar produtos, publicar anúncios, acompanhar pedidos e cuidar da sua assinatura. Me diga qual dessas partes você quer resolver.",
  actions: [],
});

const scoreNavItem = (normalizedMessage: string, item: AtlasNavItem) => {
  let score = 0;
  for (const alias of item.aliases) {
    const normalizedAlias = normalizeText(alias);
    if (normalizedMessage.includes(normalizedAlias)) {
      score += Math.max(2, normalizedAlias.length / 4);
    }
  }
  if (normalizedMessage.includes(normalizeText(item.label))) score += 4;
  return score;
};

const resolveNavigationAction = (message: string): NavigationAction | null => {
  const normalizedMessage = normalizeText(message);
  const asksLocation =
    /\bonde\b/i.test(normalizedMessage) ||
    /fica/i.test(normalizedMessage) ||
    /abr(ir|e)/i.test(normalizedMessage) ||
    /ir para/i.test(normalizedMessage) ||
    /me leva/i.test(normalizedMessage) ||
    /como (acesso|entro|vou)/i.test(normalizedMessage);

  let best: { item: AtlasNavItem; score: number } | null = null;
  for (const item of ATLAS_NAV_ITEMS) {
    const score = scoreNavItem(normalizedMessage, item);
    if (!best || score > best.score) best = { item, score };
  }

  if (!best || best.score < 3) return null;
  if (!asksLocation && best.score < 5) return null;

  return {
    type: "navigation",
    label: `Abrir ${best.item.label}`,
    route: best.item.route,
  };
};

const shouldAttachProductCard = (message: string) => {
  const normalizedMessage = normalizeText(message);
  const onlyAsksLocation =
    /\bonde\b/i.test(normalizedMessage) ||
    /fica/i.test(normalizedMessage) ||
    /como (acesso|entro|vou)/i.test(normalizedMessage) ||
    /abr(ir|e)/i.test(normalizedMessage);
  const asksRecommendation = /recomend|indica|sugere|vencedor|alta|melhor/i.test(normalizedMessage);
  if (onlyAsksLocation && !asksRecommendation) return false;
  return productIntentPatterns.some((pattern) => pattern.test(normalizedMessage));
};

const getCategoryHint = (message: string) => {
  const normalizedMessage = normalizeText(message);
  return categoryHints.find((hint) => normalizedMessage.includes(normalizeText(hint))) ?? null;
};

const getFirstImageUrl = (images: unknown): string | null => {
  if (!images) return null;
  if (typeof images === "string") {
    const trimmed = images.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return getFirstImageUrl(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (Array.isArray(images)) {
    const first = images[0];
    if (!first) return null;
    if (typeof first === "string") return first;
    if (typeof first === "object" && first !== null) {
      const image = first as Record<string, unknown>;
      const url = image.url ?? image.src ?? image.image ?? image.secure_url;
      return typeof url === "string" ? url : null;
    }
  }
  if (typeof images === "object" && images !== null) {
    const image = images as Record<string, unknown>;
    const url = image.url ?? image.src ?? image.image ?? image.secure_url;
    return typeof url === "string" ? url : null;
  }
  return null;
};

const fetchProductCardAction = async (message: string): Promise<ProductCardAction | null> => {
  if (!shouldAttachProductCard(message)) return null;

  const supabase = createServiceClient();
  if (!supabase) return null;

  const categoryHint = getCategoryHint(message);
  let query = supabase
    .from("catalog_products")
    .select("id,title,images,suggested_price,margin_percent,category")
    .eq("source", "c7drop")
    .eq("is_active", true)
    .eq("is_blocked", false)
    .gt("stock_quantity", 0)
    .order("margin_percent", { ascending: false })
    .limit(1);

  if (categoryHint) {
    query = query.ilike("category", `%${categoryHint}%`);
  }

  const { data, error } = await query.maybeSingle();
  const product = data as CatalogProductPreview | null;
  if (error || !product?.id) {
    console.error("atlas-chat product lookup error", error);
    return null;
  }

  return {
    type: "product_card",
    product_id: product.id,
    reason: categoryHint ? `Produto do nicho ${categoryHint}` : "Produto com bom indicador de margem no catálogo",
    product: {
      id: product.id,
      title: product.title,
      image_url: getFirstImageUrl(product.images),
      margin_percent: product.margin_percent,
      suggested_price: product.suggested_price,
      route: `/dashboard/catalogo/${product.id}`,
    },
  };
};

/**
 * Casa o termo como palavra inteira (aceitando plural), não como pedaço de outra.
 *
 * O ilike do banco usa %termo% e não tem como exigir limite de palavra, então
 * "pet" trazia "rePETidor" e "taPETe". A conferência acontece aqui, já em JS.
 */
const termoCasaPalavra = (texto: string, termo: string) => {
  if (!termo) return false;
  const escapado = termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escapado}s?([^a-z0-9]|$)`).test(texto);
};

const contarTermosDoNicho = (product: CatalogProductPreview, niche: ValidatedNiche) => {
  const searchable = normalizeGuideText(`${product.title ?? ""} ${product.description ?? ""} ${product.category ?? ""}`);
  return niche.catalogTerms.filter((term) => termoCasaPalavra(searchable, normalizeGuideText(term))).length;
};

const scoreCatalogProduct = (product: CatalogProductPreview, niche: ValidatedNiche) => {
  const termScore = contarTermosDoNicho(product, niche) * 12;
  return termScore + Number(product.margin_percent ?? 0) * 0.7 + Number(product.orders_count ?? 0) * 0.12;
};

const searchCatalogProductsForNiche = async (
  supabase: ServiceClient,
  niche: ValidatedNiche,
  excludeIds: string[] = [],
) => {
  if (!supabase) return [];

  let query = supabase
    .from("catalog_products")
    .select("id,title,description,images,suggested_price,margin_percent,category,orders_count")
    .eq("source", "c7drop")
    .eq("is_active", true)
    .eq("is_blocked", false)
    .gt("stock_quantity", 0)
    .order("margin_percent", { ascending: false })
    .limit(18);

  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const ors = niche.catalogTerms
    .slice(0, 7)
    .map((term) => {
      const safe = normalizeGuideText(term).replace(/[%,]/g, " ").trim();
      return `title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`;
    })
    .join(",");
  if (ors) query = query.or(ors);

  const { data, error } = await query;
  if (error) {
    console.error("atlas beginner catalog search error", error);
    return [];
  }

  // Sem nenhum termo do nicho batendo como palavra inteira, o produto veio por
  // falso positivo do ilike e não deve ser sugerido.
  return ((data ?? []) as CatalogProductPreview[])
    .filter((product) => contarTermosDoNicho(product, niche) > 0)
    .sort((a, b) => scoreCatalogProduct(b, niche) - scoreCatalogProduct(a, niche))
    .slice(0, 3);
};

const getUserMercadoLivreStatus = async (supabase: ServiceClient, userId: string) => {
  if (!supabase) return { connected: false, tokenValid: false };

  const { data } = await supabase
    .from("user_integrations")
    .select("access_token,expires_at,platform")
    .eq("user_id", userId)
    .in("platform", ["mercadolivre", "mercado_livre", "ml"])
    .limit(1)
    .maybeSingle();

  const integration = data as MercadoLivreIntegrationRow | null;
  const expiresAt = integration?.expires_at ? new Date(String(integration.expires_at)).getTime() : 0;
  const tokenValid = Boolean(integration?.access_token) && (!expiresAt || expiresAt > Date.now() + 60_000);
  return { connected: Boolean(integration?.access_token), tokenValid };
};

/**
 * Primeiro nome do usuário, usado para o Atlas falar com uma pessoa e não com
 * "o usuário". Volta null quando o perfil não tem nome utilizável.
 */
const buscarPrimeiroNome = async (supabase: ServiceClient, userId: string): Promise<string | null> => {
  if (!supabase) return null;
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  const completo = String((data as { display_name?: string } | null)?.display_name ?? "").trim();
  const primeiro = completo.split(/[\s._\-]+/)[0] ?? "";
  if (primeiro.length < 2 || primeiro.length > 20 || /[^\p{L}]/u.test(primeiro)) return null;
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
};

/** "Ana, " quando há nome; string vazia quando não há. Evita saudação genérica. */
const vocativo = (nome: string | null, sufixo = ", ") => (nome ? `${nome}${sufixo}` : "");

const askBeginnerNiche = async (supabase: ServiceClient, nome: string | null = null): Promise<AtlasResponse> => {
  const signals = await researchMarketSignals(supabase);
  const disponiveis = nichosDisponiveis(signals);
  const suggestions = beginnerNicheSuggestions(disponiveis, 5);
  const sourceLabel = disponiveis[0]?.source === "mercado_livre_public_search"
    ? "a procura no Mercado Livre cruzada com o que temos em estoque"
    : "o que o catálogo Velo tem disponível agora";

  // Sem nenhum nicho atendido, não adianta pedir escolha: seria empurrar o
  // usuário para um passo 2 vazio.
  if (suggestions.length === 0) {
    const destaques = await categoriasEmDestaque(supabase);
    if (destaques.length === 0) {
      return {
        message:
          `Bora, ${nome ? `${nome}` : "vamos juntos"}! 🎉 Eu te acompanho até o seu primeiro anúncio no ar.\n\n**Passo 1 de 5: seu nicho**\n\n**Nicho** é o tipo de produto que você escolhe pra vender, tipo pets, beleza ou casa.\n\nVamos pelo caminho curto: abra o catálogo e escolha um produto que te chamou atenção. Eu monto o guia em cima dele.\n\nAbre o catálogo e me diz qual te agradou.`,
        actions: [{ type: "navigation", label: "Abrir Catálogo", route: "/dashboard/catalogo" }],
      };
    }
    return {
      message:
        `Bora, ${nome ? `${nome}` : "vamos juntos"}! 🎉 Eu te acompanho até o seu primeiro anúncio no ar.\n\n**Passo 1 de 5: seu nicho**\n\n**Nicho** é o tipo de produto que você escolhe pra vender, tipo pets, beleza ou casa.\n\nSeparei as categorias que mais saem aqui, pra você não garimpar o catálogo inteiro.\n\nEscolhe uma abaixo e eu te levo direto aos produtos dela.`,
      actions: [
        ...destaques.map((categoria) => ({
          type: "navigation" as const,
          label: categoria.valor,
          route: `/dashboard/catalogo?categoria=${encodeURIComponent(categoria.valor)}`,
          variant: "primary" as const,
        })),
        quickReply("Tentar de novo", "Ajude-me a começar"),
      ],
    };
  }

  return {
    message:
      `Bora, ${nome ? `${nome}` : "vamos juntos"}! 🎉 Uma coisa de cada vez até o seu primeiro anúncio no ar.\n\n**Passo 1 de 5: seu nicho**\n\n**Nicho** é o tipo de produto que você escolhe pra vender, tipo pets, beleza ou casa.\n\nEscolher um agora te poupa trabalho depois: você aprende sobre um público só e repete o que deu certo.\n\nOlhei ${sourceLabel} e separei o que está indo bem agora.\n\nEscolhe uma opção aqui embaixo, ou me diz outro nicho que você já tem em mente.`,
    actions: [
      ...suggestions.map((label) => quickReply(label, `Quero começar com ${label}`)),
      quickReply("Ainda não sei", "Ainda não sei qual nicho escolher"),
    ],
  };
};

const validateNicheStep = async (
  supabase: ServiceClient,
  niche: ValidatedNiche,
  nome: string | null = null,
): Promise<AtlasResponse> => {
  const signal = await researchSingleNiche(niche, supabase);
  const demandText = signal.demand >= 70 ? "boa demanda" : signal.demand >= 45 ? "demanda moderada" : "demanda mais específica";
  const competitionText = signal.competition >= 70 ? "concorrência alta" : signal.competition >= 45 ? "concorrência média" : "concorrência menor";

  // Nicho sem produto no catálogo não passa daqui. Confirmar levaria a um passo 2
  // sem nada para escolher, e o usuário perderia a viagem.
  if (signal.catalogCount === 0) {
    const alternativas = beginnerNicheSuggestions(nichosDisponiveis(await researchMarketSignals(supabase)), 4);
    return {
      message:
        `**Passo 1 de 5: seu nicho**\n\n${vocativo(nome, ", ").replace(/^(.)/, (letra) => letra.toUpperCase())}vou ser sincero com você: o catálogo Velo não tem produtos de **${niche.label}** agora.\n\nSeguir por aí te deixaria sem nada pra escolher no próximo passo.\n\n${
          alternativas.length > 0
            ? "Estes aqui a gente atende hoje. São parecidos o bastante para funcionar bem com o que você tinha em mente:"
            : "Vamos por outro caminho. Abra o catálogo e escolha a partir do que existe hoje."
        }`,
      actions: [
        ...alternativas.map((label) => quickReply(label, `Quero começar com ${label}`)),
        { type: "navigation", label: "Abrir Catálogo", route: "/dashboard/catalogo" },
      ],
    };
  }

  return {
    message:
      `Boa escolha${nome ? `, ${nome}` : ""}! Deixa eu te contar o que eu vi.\n\n**Passo 1 de 5: seu nicho**\n\nNicho sugerido: **${niche.label}**.\n\n**Demanda:** ${demandText}, ou seja, é assim que anda a procura por esses produtos.\n\n**Concorrência:** ${competitionText}, é o tanto de vendedor disputando essa procura.\n\n**Margem:** o que sobra pra você depois do custo, da tarifa do marketplace e do frete. É ela, junto com fotos boas, que decide o seu resultado.\n\n${signal.note}\n\nÉ com esse nicho que a gente vai trabalhar. Vamos aos produtos.`,
    actions: [
      quickReply(`Vamos aos produtos`, `Sim, buscar produtos de ${niche.label}`),
      quickReply("Quero outro nicho", "Quero ver outros nichos"),
    ],
  };
};

const extractNicheFromAssistantText = (message: string) => {
  const match = message.match(/Nicho sugerido:\s*\*\*([^*]+)\*\*/i);
  if (!match?.[1]) return null;
  return findValidatedNiche(match[1]);
};

const inferNicheFromConversation = (messages: ChatMessage[], fallbackText: string) => {
  const fromUser = findValidatedNiche(fallbackText);
  if (fromUser) return fromUser;

  const lastAssistant = getLastAssistantMessage(messages);
  if (lastAssistant) {
    const fromAssistant = extractNicheFromAssistantText(lastAssistant.content);
    if (fromAssistant) return fromAssistant;
  }

  for (const message of [...messages].reverse()) {
    const niche = findValidatedNiche(message.content);
    if (niche) return niche;
  }

  return null;
};

const showProductsForNiche = async (
  supabase: ServiceClient,
  niche: ValidatedNiche,
  excludeIds: string[] = [],
  nome: string | null = null,
): Promise<AtlasResponse> => {
  const products = await searchCatalogProductsForNiche(supabase, niche, excludeIds);
  if (products.length === 0) {
    return {
      message:
        `${nome ? `${nome}, p` : "P"}rocurei em **${niche.label}** e não achei nenhuma opção boa agora. Prefiro te dizer isso a te empurrar produto fraco.\n\nVamos trocar de nicho: eu te mostro o que o catálogo atende bem hoje.\n\nToca em ver outros nichos e seguimos.`,
      actions: [quickReply("Ver outros nichos", "Quero ver outros nichos")],
    };
  }

  return {
    message:
      `Nicho definido${nome ? `, ${nome}` : ""}! Agora vem a parte divertida. 😄\n\n**Passo 2 de 5: escolha do produto**\n\nCruzei **${niche.label}** com o catálogo e separei até 3 opções.\n\n**Estoque ativo:** produto sem estoque vira anúncio pausado.\n\n**Boa margem:** o que sobra pra você depois do custo, da tarifa e do frete.\n\nEscolhe uma agora. No próximo passo eu avalio como ela se sai nas redes.`,
    actions: [
      ...products.map(productCardFromRow),
      quickReply("Quero o primeiro", "Quero o primeiro produto"),
      quickReply("Ver outras opções", "Ver outras opções de produto"),
    ],
  };
};

/**
 * Passo 2: escolha do produto na vitrine.
 *
 * Assim que o nicho é confirmado, o guia abre a vitrine que já existe no
 * frontend em vez de despejar cards de texto no chat. A vitrine cruza o nicho
 * confirmado aqui com o perfil respondido no cadastro, e o produto escolhido
 * segue amarrado ao resto do guia até a publicação.
 */
const guideOpenShowcaseStep = async (
  supabase: ServiceClient,
  niche: ValidatedNiche,
  nome: string | null = null,
): Promise<AtlasResponse> => {
  const products = await searchCatalogProductsForNiche(supabase, niche);

  // Sem produto no nicho a vitrine abriria vazia: melhor trocar de nicho aqui.
  if (products.length === 0) return showProductsForNiche(supabase, niche, [], nome);

  return {
    message:
      `Nicho fechado${nome ? `, ${nome}` : ""}! **${niche.label}** é o nosso ponto de partida. 🎉\n\n**Passo 2 de 5: escolha do produto**\n\nAbri uma seleção feita pra você: seu nicho cruzado com o que você respondeu no cadastro, sem nada fora de estoque.\n\nOlha as fotos e o preço e escolhe um. Esse produto vai comigo até a publicação no Mercado Livre.\n\nToca em escolher meu produto pra abrir a seleção.`,
    actions: [
      {
        type: "open_showcase",
        label: "Escolher meu produto",
        niche: { id: niche.id, label: niche.label, catalogTerms: niche.catalogTerms },
      },
      quickReply("Ver o catálogo completo", "Quero ver o catálogo completo"),
      quickReply("Quero outro nicho", "Quero ver outros nichos"),
    ],
  };
};


// --- Passo 3: potencial de divulgação orgânica -------------------------------
// Sem API de TikTok/Instagram: o sinal é uma leitura do produto (o quanto ele é
// demonstrável em vídeo) cruzada com o sinal de mercado do nicho. É orientação,
// e o texto deixa claro que é isso — não inventamos métrica de rede social.
const VISUAL_NICHE_IDS = new Set([
  "beleza-cosmeticos",
  "perfumaria",
  "pets",
  "decoracao",
  "utilidades-domesticas",
  "eletronicos-acessorios",
  "esportivos",
  "bebes",
  "camping",
  "jardinagem",
]);

const DEMO_KEYWORDS = [
  "portatil", "dobravel", "automatico", "led", "recarregavel", "sem fio", "bluetooth",
  "massageador", "organizador", "multiuso", "kit", "escova", "aparador", "limpeza",
  "mini", "smart", "projetor", "umidificador", "luminaria",
];

const assessSocialPotential = (product: ProductCardAction, niche: ValidatedNiche | null) => {
  const title = normalizeGuideText(product.product?.title ?? "");
  const matches = DEMO_KEYWORDS.filter((keyword) => title.includes(keyword));
  // Sem nicho validado — caso de quem escolheu o produto direto no catálogo — a
  // leitura sai só do título, que já é a maior parte do sinal.
  const visualNiche = niche ? VISUAL_NICHE_IDS.has(niche.id) : false;
  const score = (visualNiche ? 2 : 0) + Math.min(matches.length, 3);

  if (score >= 3) {
    return {
      nivel: "forte" as const,
      leitura:
        "dá pra mostrar ele funcionando em poucos segundos, que é exatamente o que costuma render vídeo curto: antes e depois, demonstração de uso, reação de quem vê.",
    };
  }
  if (score >= 1) {
    return {
      nivel: "médio" as const,
      leitura:
        "dá pra fazer conteúdo, mas exige um pouco mais de criatividade: vale focar no problema que ele resolve em vez de só mostrar o produto parado.",
    };
  }
  return {
    nivel: "mais difícil" as const,
    leitura:
      "é um produto mais funcional que visual, então o vídeo tende a render menos sozinho. Isso não impede de vender pelo marketplace. Só quer dizer que a divulgação gratuita nas redes vai puxar menos venda para você.",
  };
};

const validateSocialPotentialStep = (
  product: ProductCardAction,
  niche: ValidatedNiche | null,
  /** Comemora a etapa que acabou de passar, quando o usuário vem da conexão. */
  prefacio?: string,
  nome: string | null = null,
): AtlasResponse => {
  const avaliacao = assessSocialPotential(product, niche);
  const titulo = product.product?.title ?? "esse produto";

  return {
    message:
      `${prefacio ? `${prefacio}\n\n` : `Produto escolhido${nome ? `, ${nome}` : ""}, você já está na metade do caminho!\n\n`}**Passo 4 de 5: potencial de divulgação**\n\nAntes de publicar, olha uma coisa que quase ninguém olha no começo: o quanto esse produto anda sozinho no TikTok e no Instagram.\n\n**Vídeo curto** faz parte da venda por você, de graça. Produto fácil de mostrar funcionando costuma render bem mais que produto genérico.\n\n**Minha leitura de ${titulo}:** potencial **${avaliacao.nivel}**. ${avaliacao.leitura}\n\n**Aviso honesto:** isso é leitura do tipo de produto e do nicho, não medição de rede social. Pra produzir o conteúdo, os influencers de IA ficam em #tiktok e as fotos em #imagens-ia.\n\nVamos levar ele pra publicação.`,
    actions: [
      product,
      quickReply("Seguir para a publicação", "Sim, seguir com esse produto para publicação"),
    ],
  };
};

const guidePublicationStep = async (
  supabase: ServiceClient,
  userId: string,
  product: ProductCardAction,
  niche: ValidatedNiche | null,
  nome: string | null = null,
): Promise<AtlasResponse> => {
  const mlStatus = await getUserMercadoLivreStatus(supabase, userId);
  const nicheLabel = niche?.label ?? "o que você escolheu";
  const productTitle = product.product?.title ?? "esse produto";
  const productRoute = product.product?.route ?? `/dashboard/catalogo/${product.product_id}`;

  if (!mlStatus.connected || !mlStatus.tokenValid) {
    return {
      message:
        `Último passo${nome ? `, ${nome}` : ""}! Olha o quanto você já avançou:\n\n**Passo 5 de 5: resumo e publicação**\n\n- **Nicho:** ${nicheLabel}\n- **Canal:** Mercado Livre\n- **Produto:** ${productTitle}, com potencial de divulgação já avaliado\n\nFalta **conectar a sua conta do Mercado Livre**: é ela que autoriza a Velo a publicar por você.\n\nÉ rápido: você entra na sua conta, clica em permitir e volta pra cá. Sua senha nunca passa pela Velo.\n\nToca em conectar agora e me avisa quando voltar.`,
      actions: [
        // Conecta pelo próprio chat: o usuário não precisa achar a tela sozinho.
        { type: "connect_ml", label: "Conectar Mercado Livre agora" },
        // Mantida junto de propósito: frontend que ainda não conhece connect_ml
        // descarta a ação acima, e sem esta o usuário ficaria sem caminho nenhum
        // para conectar.
        { type: "navigation", label: "Abrir Integrações", route: "/dashboard/integracoes" },
        { type: "navigation", label: "Abrir produto escolhido", route: productRoute },
        quickReply("Já conectei o ML", "Já conectei o Mercado Livre"),
      ],
    };
  }

  return {
    message:
      `Último passo${nome ? `, ${nome}` : ""}! 🎉 Olha o quanto você já avançou:\n\n**Passo 5 de 5: resumo e publicação**\n\n- **Nicho:** ${nicheLabel}\n- **Canal:** Mercado Livre, com a sua conta já conectada\n- **Produto:** ${productTitle}, com potencial de divulgação já avaliado\n\nReta final: abre o produto, revisa título e descrição, confere preço e margem, e publica.\n\n**Título:** use as palavras que o comprador digita na busca, senão o anúncio não aparece.\n\nDepois é só acompanhar em #publicacoes e as vendas em #pedidos.\n\nAbre o produto escolhido e coloca ele no ar.`,
    actions: [
      { type: "navigation", label: "Abrir produto escolhido", route: productRoute },
      { type: "navigation", label: "Ver Publicações", route: "/dashboard/publicacoes" },
      { type: "navigation", label: "Ver Pedidos", route: "/dashboard/pedidos" },
    ],
  };
};

/**
 * A foto do produto chega do cliente e acaba num <img src> do chat, então só
 * passa se for http(s) — nada de javascript:, data: ou string arbitrária.
 */
const safeImageUrl = (valor: unknown): string | null => {
  if (typeof valor !== "string" || valor.length > 500) return null;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

/**
 * Escolha de produto feita no catálogo, durante o guia.
 *
 * Chega como dado estruturado (id, nome, categoria, preço) no corpo da
 * requisição — não como prosa para o modelo interpretar. Assim o passo seguinte
 * nasce já amarrado ao produto certo, sem o usuário ter que descrevê-lo.
 */
const guideProductChosenStep = async (
  supabase: ServiceClient,
  userId: string,
  produto: {
    id: string;
    nome: string;
    categoria: string;
    preco: number;
    imagem?: string | null;
  },
  nome: string | null = null,
): Promise<AtlasResponse> => {
  const preco = Number.isFinite(produto.preco)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(produto.preco)
    : null;
  // A conta do ML é pré-requisito para publicar, então o passo já diz em que pé
  // ela está — quem ainda não conectou recebe o aviso e o botão aqui mesmo.
  const mlStatus = await getUserMercadoLivreStatus(supabase, userId);
  const mlPronto = mlStatus.connected && mlStatus.tokenValid;

  const sobreAConta = mlPronto
    ? "E boa notícia: sua conta do Mercado Livre já está conectada. Essa é a parte que mais trava quem começa, e você já resolveu."
    : "**Autorização:** pra publicar por você, a Velo precisa de uma permissão sua dentro do Mercado Livre, igual quando um site pede pra \"entrar com o Google\".\n\nSua senha continua só com o Mercado Livre e você desfaz a conexão quando quiser.";

  return {
    message:
      `Ótima escolha${nome ? `, ${nome}` : ""}! 😄 Anotei: **${produto.nome}**${preco ? ` (${preco})` : ""}, da categoria ${produto.categoria}.\n\n**Passo 3 de 5: onde vender**\n\nVocê vai vender no **Mercado Livre**, o caminho mais curto até a primeira venda.\n\n**Marketplace:** site que já tem milhões de pessoas comprando todo dia. Você entra onde a procura já existe, sem criar site nem pagar anúncio.\n\n${sobreAConta}\n\n${mlPronto ? "Bora pro próximo passo." : "Agora conecta a sua conta. É só o que falta pro seu anúncio poder ir ao ar."}`,
    actions: [
      {
        type: "product_card",
        product_id: produto.id,
        product: {
          id: produto.id,
          title: produto.nome,
          image_url: produto.imagem ?? null,
          margin_percent: null,
          suggested_price: Number.isFinite(produto.preco) ? produto.preco : null,
          route: `/dashboard/catalogo/${produto.id}`,
        },
      },
      ...(mlPronto
        ? []
        : ([
            { type: "connect_ml", label: "Conectar Mercado Livre" },
            // Frontend que não conheça connect_ml descarta a ação acima; sem
            // esta o usuário ficaria sem caminho para conectar.
            { type: "navigation", label: "Abrir Integrações", route: "/dashboard/integracoes" },
          ] as AtlasAction[])),
      mlPronto
        ? quickReply("Vamos seguir", "Sim, quero seguir com esse produto")
        : quickReply("Conectar agora", "Quero conectar minha conta do Mercado Livre"),
    ],
  };
};

/**
 * Passo 2, parte prática: conectar a conta do Mercado Livre.
 *
 * A conexão acontece aqui e não no fim do guia porque é ela que destrava a
 * publicação. Deixar para o último passo faz o usuário chegar animado ao final
 * e travar. O texto explica o que vai acontecer na tela, passo a passo, porque
 * quem está começando nunca viu um fluxo de autorização antes.
 */
const guideConnectMlStep = (
  product: ProductCardAction,
  jaDisseQueConectou: boolean,
  nome: string | null = null,
): AtlasResponse => {
  const passoAPasso =
    "1. Toque no botão **Conectar Mercado Livre** aqui embaixo.\n2. Vai abrir a página oficial do Mercado Livre. Entre com a sua conta de vendedor.\n3. O Mercado Livre vai perguntar se você autoriza a Velo. É só permitir.\n4. Você volta pra cá sozinho e a gente continua de onde parou.";

  if (jaDisseQueConectou) {
    return {
      message:
        `**Passo 3 de 5: conectar sua conta**\n\n${nome ? `${nome}, a` : "A"}inda não estou enxergando a conexão do meu lado. Quase sempre é uma destas três:\n\n1. A janela do Mercado Livre fechou antes do clique em permitir.\n2. O login foi numa conta diferente da que você quer usar pra vender.\n3. A autorização ainda está processando. Espera alguns segundos e me chama.\n\nNada grave. Vamos de novo, com calma:\n\n${passoAPasso}\n\nSe aparecer alguma mensagem estranha, me conta o que estava escrito.`,
      actions: [
        { type: "connect_ml", label: "Conectar Mercado Livre" },
        { type: "navigation", label: "Abrir Integrações", route: "/dashboard/integracoes" },
        product,
        quickReply("Já conectei", "Já conectei o Mercado Livre"),
        quickReply("Conecto depois", "Quero conectar o Mercado Livre depois"),
      ],
    };
  }

  return {
    message:
      `Vamos nessa${nome ? `, ${nome}` : ""}! É mais simples do que parece.\n\n**Passo 3 de 5: conectar sua conta**\n\n${passoAPasso}\n\n**Senha:** ela nunca passa pela Velo, quem cuida disso é o próprio Mercado Livre.\n\n**Desconectar:** um clique em #integracoes, quando você quiser.\n\nAinda não tem conta de vendedor? Dá pra criar na hora, é rápido e de graça.\n\nToca em conectar e me avisa quando voltar.`,
    actions: [
      { type: "connect_ml", label: "Conectar Mercado Livre" },
      { type: "navigation", label: "Abrir Integrações", route: "/dashboard/integracoes" },
      product,
      quickReply("Já conectei", "Já conectei o Mercado Livre"),
      quickReply("Conecto depois", "Quero conectar o Mercado Livre depois"),
    ],
  };
};

const maybeHandleBeginnerGuide = async (
  messages: ChatMessage[],
  userId: string,
  produtoDoCatalogo?: { id: string; nome: string; categoria: string; preco: number; imagem?: string | null } | null,
): Promise<AtlasResponse | null> => {
  const supabase = createServiceClient();
  // Nome do usuário buscado uma vez por requisição: o guia inteiro fala com ele
  // pelo primeiro nome, em vez de soar como manual.
  const nome = await buscarPrimeiroNome(supabase, userId);

  // Escolha no catálogo tem prioridade: é uma ação explícita do usuário e define
  // o produto de todos os passos seguintes.
  if (produtoDoCatalogo?.id) return guideProductChosenStep(supabase, userId, produtoDoCatalogo, nome);

  const lastUserMessage = getLastUserMessage(messages);
  const userMessageCount = messages.filter((message) => message.role !== "assistant").length;
  const lastAssistant = getLastAssistantMessage(messages);
  const lastAssistantText = normalizeGuideText(lastAssistant?.content ?? "");
  const lastActions = getLastAssistantActions(messages);
  const lastProductCards = lastActions.filter((action): action is ProductCardAction => action.type === "product_card");

  // O guia se identifica pelo marcador "passo N de 5", presente em toda etapa.
  // Antes isso dependia do título "Guia de Iniciante"; qualquer mudança de texto
  // quebrava a continuidade e o fluxo caía no modelo genérico no meio do caminho.
  const guideWasActive = /passo \d de 5/.test(lastAssistantText);
  const guideReply = isBeginnerGuideReply(lastUserMessage) || isBeginnerTrigger(lastUserMessage, userMessageCount);

  // O guia é um modo de ajuda, não uma prisão. Se o usuário fizer conversa normal
  // ou uma pergunta livre no meio dele, deixa o modelo responder como Atlas.
  if (guideWasActive && (!guideReply || isConversationalAside(lastUserMessage))) {
    return null;
  }

  if (wantsChangeNiche(lastUserMessage) || (guideWasActive && wantsNoNicheHelp(lastUserMessage))) {
    return askBeginnerNiche(supabase, nome);
  }

  const emPasso = (n: number) => guideWasActive && lastAssistantText.includes(`passo ${n} de 5`);

  // "Ver outras opções" vale em qualquer etapa que já tenha produto na tela.
  // Tratado antes das etapas específicas porque o botão aparece nos passos 2, 3
  // e 4 — preso só ao passo 2, os outros dois caíam fora do guia.
  if (guideWasActive && lastProductCards.length > 0 && wantsOtherOptions(lastUserMessage)) {
    const niche = inferNicheFromConversation(messages, lastUserMessage);
    if (niche) return showProductsForNiche(supabase, niche, lastProductCards.map((product) => product.product_id), nome);
    return askBeginnerNiche(supabase, nome);
  }

  // Passo 4 (divulgação) confirmado -> Passo 5 (resumo + publicação).
  if (emPasso(4) && lastProductCards.length > 0 && isConfirmText(lastUserMessage)) {
    const niche = inferNicheFromConversation(messages, lastUserMessage);
    return guidePublicationStep(supabase, userId, lastProductCards[0], niche, nome);
  }

  // Passo 3 (onde vender / conectar): com a conta no lugar, seguir para o passo
  // 4 (potencial de divulgação).
  if (
    emPasso(3) &&
    lastProductCards.length > 0 &&
    (isConfirmText(lastUserMessage) || /produto/i.test(lastUserMessage) || saidConnectedMl(lastUserMessage))
  ) {
    // Nicho pode não existir: quem escolheu o produto direto no catálogo nunca
    // passou pela etapa de nicho. Antes isso voltava o usuário ao passo 1 e
    // reiniciava o guia; agora o passo 4 segue com o produto que já foi escolhido.
    const niche = inferNicheFromConversation(messages, lastUserMessage);

    // Quem pediu para deixar a conexão para depois não fica preso nela: o guia
    // segue, e o passo 5 cobra a conta de novo antes de publicar.
    if (!wantsToConnectLater(lastUserMessage)) {
      const mlStatus = await getUserMercadoLivreStatus(supabase, userId);
      if (!mlStatus.connected || !mlStatus.tokenValid) {
        return guideConnectMlStep(lastProductCards[0], saidConnectedMl(lastUserMessage), nome);
      }
      if (saidConnectedMl(lastUserMessage)) {
        return validateSocialPotentialStep(
          lastProductCards[0],
          niche,
          `Conta conectada${nome ? `, ${nome}` : ""}! 🎉 Essa era a parte mais chata de todas, e já ficou pra trás.`,
          nome,
        );
      }
    }

    return validateSocialPotentialStep(lastProductCards[0], niche, undefined, nome);
  }

  // Passo 2 com cards na tela (fallback de quem não usou a vitrine): produto
  // confirmado -> passo 3, já amarrado ao produto escolhido.
  if (emPasso(2) && lastProductCards.length > 0 && (isConfirmText(lastUserMessage) || /produto/i.test(lastUserMessage))) {
    const escolhido = lastProductCards[0];
    return guideProductChosenStep(supabase, userId, {
      id: escolhido.product_id,
      nome: escolhido.product?.title ?? "o produto escolhido",
      categoria: inferNicheFromConversation(messages, lastUserMessage)?.label ?? "catálogo Velo",
      preco: escolhido.product?.suggested_price ?? Number.NaN,
      imagem: escolhido.product?.image_url ?? null,
    }, nome);
  }

  // Quem prefere garimpar sozinho sai da vitrine para a grade inteira, sem
  // perder o guia: o produto escolhido no catálogo volta pelo mesmo caminho.
  if (emPasso(2) && /catalogo completo/.test(normalizeGuideText(lastUserMessage))) {
    return {
      message:
        `Fechado${nome ? `, ${nome}` : ""}, vamos pelo catálogo completo.\n\n**Passo 2 de 5: escolha do produto**\n\nAbre o catálogo, usa os filtros e escolhe o produto que mais te agradar.\n\nQuando você clicar em escolher, eu sigo o guia com ele daqui.`,
      actions: [
        { type: "navigation", label: "Abrir Catálogo", route: "/dashboard/catalogo", variant: "primary" },
        quickReply("Prefiro a seleção do Atlas", "Ver outras opções de produto"),
      ],
    };
  }

  // Passo 2 sem cards: a vitrine é o caminho. Se ela foi fechada sem escolha, o
  // usuário pede de volta e o guia reabre em vez de travar.
  if (emPasso(2) && lastProductCards.length === 0 && (isConfirmText(lastUserMessage) || wantsOtherOptions(lastUserMessage))) {
    const niche = inferNicheFromConversation(messages, lastUserMessage);
    if (niche) return guideOpenShowcaseStep(supabase, niche, nome);
  }

  // Passo 5: usuário avisa que conectou o Mercado Livre.
  if (emPasso(5) && /\b(ja conectei|já conectei|conectei|conectado)\b/i.test(lastUserMessage)) {
    const productNav = lastActions.find(
      (action): action is NavigationAction => action.type === "navigation" && action.route.includes("/dashboard/catalogo/"),
    );
    return {
      message:
        `Conta conectada${nome ? `, ${nome}` : ""}! 🎉\n\n**Passo 5 de 5: revisão final**\n\nAbre o produto escolhido, revisa título, descrição, preço e margem, e publica.\n\n**Título:** use as palavras que o comprador digita na busca.\n\n**Prazo de entrega:** deixe realista, porque atraso vira reclamação e reclamação derruba sua nota.\n\nDepois de publicar, o status fica em #publicacoes e as vendas em #pedidos.\n\nAbre o produto e coloca ele no ar.`,
      actions: [
        ...(productNav ? [productNav] : [{ type: "navigation" as const, label: "Abrir Catálogo", route: "/dashboard/catalogo" }]),
        { type: "navigation", label: "Ver Publicações", route: "/dashboard/publicacoes" },
      ],
    };
  }

  const previousAskedForNiche =
    guideWasActive &&
    (lastAssistantText.includes("passo 1 de 5") ||
      lastAssistantText.includes("outro nicho que voce ja tenha em mente"));
  // O passo 1 fecha com "é com esse nicho que a gente vai trabalhar". Antes isso
  // procurava por "confirma esse nicho", texto que não existe mais em lugar
  // nenhum, e a confirmação do nicho caía fora do guia.
  const previousValidatedNiche =
    guideWasActive && lastAssistantText.includes("com esse nicho que a gente vai trabalhar");

  // Passo 1 confirmado -> Passo 2 (vitrine de produtos).
  if (previousValidatedNiche && isConfirmText(lastUserMessage)) {
    const niche = inferNicheFromConversation(messages, lastUserMessage);
    if (niche) return guideOpenShowcaseStep(supabase, niche, nome);
  }


  if (previousAskedForNiche || isBeginnerTrigger(lastUserMessage, userMessageCount)) {
    const niche = findValidatedNiche(lastUserMessage);
    if (niche) return validateNicheStep(supabase, niche, nome);
    return askBeginnerNiche(supabase, nome);
  }

  return null;
};

const sanitizeAction = (action: unknown): AtlasAction | null => {
  if (!action || typeof action !== "object") return null;
  const candidate = action as Record<string, unknown>;

  if (candidate.type === "navigation") {
    const label = typeof candidate.label === "string" ? candidate.label : "Abrir página";
    const route = typeof candidate.route === "string" ? candidate.route : "";
    const allowedRoute = ATLAS_NAV_ITEMS.some((item) => item.route === route);
    if (!allowedRoute) return null;
    return {
      type: "navigation",
      label,
      route,
      reason: typeof candidate.reason === "string" ? candidate.reason : undefined,
      variant: candidate.variant === "primary" ? "primary" : undefined,
    };
  }

  if (candidate.type === "product_card") {
    const productId = typeof candidate.product_id === "string" ? candidate.product_id : "";
    if (!productId) return null;
    return {
      type: "product_card",
      product_id: productId,
      reason: typeof candidate.reason === "string" ? candidate.reason : undefined,
    };
  }

  if (candidate.type === "quick_reply") {
    const label = typeof candidate.label === "string" ? candidate.label : "";
    const message = typeof candidate.message === "string" ? candidate.message : label;
    if (!label || !message) return null;
    return { type: "quick_reply", label, message };
  }

  if (candidate.type === "connect_ml") {
    const label = typeof candidate.label === "string" && candidate.label ? candidate.label : "Conectar Mercado Livre";
    return { type: "connect_ml", label };
  }

  return null;
};

const extractJsonText = (raw: string) => {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
};

const parseAtlasModelResponse = (raw: string): AtlasResponse => {
  try {
    const parsed = JSON.parse(extractJsonText(raw)) as Partial<AtlasResponse>;
    const message =
      typeof parsed.message === "string" && parsed.message.trim()
        ? parsed.message.trim()
        : "Desculpe, não consegui processar agora. Tente reformular sua pergunta.";
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions.map(sanitizeAction).filter((action): action is AtlasAction => Boolean(action))
      : [];
    return { message, actions };
  } catch {
    return {
      message: raw.trim() || "Desculpe, não consegui processar agora. Tente reformular sua pergunta.",
      actions: [],
    };
  }
};

const mergeActions = (actions: AtlasAction[], extras: Array<AtlasAction | null>) => {
  const merged = [...actions];
  for (const extra of extras) {
    if (!extra) continue;
    const exists = merged.some((action) => {
      if (action.type !== extra.type) return false;
      if (action.type === "navigation" && extra.type === "navigation") return action.route === extra.route;
      if (action.type === "product_card" && extra.type === "product_card") {
        return action.product_id === extra.product_id;
      }
      if (action.type === "quick_reply" && extra.type === "quick_reply") {
        return action.message === extra.message;
      }
      return false;
    });
    if (!exists) merged.push(extra);
  }
  return merged.slice(0, 12);
};

const fallbackReply = (message: string): AtlasResponse => {
  const normalizedMessage = normalizeText(message);
  if (isConversationalAside(message)) {
    return conversationalAsideResponse();
  }

  if (normalizedMessage.includes("anuncio") || normalizedMessage.includes("publica")) {
    return {
      message:
        "Posso te ajudar a criar um anúncio. O caminho é sempre o mesmo. Você escolhe um produto no Catálogo, revisa o título e a descrição, e publica com a sua conta do Mercado Livre conectada.\n\nO título é a parte que mais pesa. Ele precisa ter as palavras que a pessoa digita na busca, senão o anúncio não aparece.",
      actions: [{ type: "navigation", label: "Abrir Catálogo", route: "/dashboard/catalogo" }],
    };
  }

  if (normalizedMessage.includes("produto")) {
    return {
      message:
        "Para encontrar produtos, comece pelo Catálogo da Velo. Procure itens com estoque disponível e boa margem. Margem é o que sobra para você depois de tirar o custo do produto, a tarifa do marketplace e o frete.\n\nSe você me disser em que tipo de produto quer se concentrar, eu consigo te orientar melhor.",
      actions: [{ type: "navigation", label: "Abrir Catálogo", route: "/dashboard/catalogo" }],
    };
  }

  if (normalizedMessage.includes("mercado livre") || normalizedMessage.includes("ml")) {
    return {
      message:
        "A conexão com o Mercado Livre fica em Integrações. Você entra na sua conta pelo site oficial do Mercado Livre, autoriza a Velo e volta pra cá com a conta conectada. A sua senha não passa pela Velo em nenhum momento.",
      actions: [{ type: "navigation", label: "Abrir Integrações", route: "/dashboard/integracoes" }],
    };
  }

  if (normalizedMessage.includes("plano") || normalizedMessage.includes("assinatura")) {
    return {
      message:
        "Os planos da Velo mudam o quanto você pode usar: quantos produtos publicar, quantos marketplaces conectar, quantas páginas de venda criar. Os valores de hoje ficam na área de Planos, aqui no painel.",
      actions: [{ type: "navigation", label: "Ver Planos", route: "/dashboard/planos" }],
    };
  }

  return {
    message:
      "Oi! 😄 Me conta o que você quer fazer agora: encontrar produtos, conectar o Mercado Livre, criar um anúncio, gerar imagens, acompanhar pedidos ou mexer na assinatura. Eu te levo lá.",
    actions: [],
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authenticatedUserId = await authenticateRequest(req);
    if (!authenticatedUserId) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const { messages, produtoSelecionado, pageContext } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: "messages obrigatório" }, 400);
    }

    const normalizedMessages = messages.map((message: ChatMessage) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content ?? ""),
      product_data: message.product_data ?? null,
    }));
    const lastUserMessage = getLastUserMessage(normalizedMessages);

    const serviceClient = createServiceClient();
    const quota = await checarQuotaAtlas(serviceClient, authenticatedUserId);
    // Toda resposta leva o saldo do dia junto: é o que a UI mostra em
    // "restam X mensagens hoje" sem precisar de uma segunda chamada.
    const responder = (body: Record<string, unknown>, status = 200) =>
      jsonResponse({ ...body, quota }, status);

    if (isUnsafeRequest(lastUserMessage)) {
      registrarUso({ userId: authenticatedUserId, origem: "codigo", etapa: "recusa" });
      return responder(refusalResponse());
    }

    // Conversa livre ("oi, tudo bem?", "como você está?") vai para o modelo.
    // Antes caía numa resposta fixa aqui, então toda mensagem solta recebia
    // exatamente o mesmo texto — o Atlas parecia um robô de menu.


    // FAQ resolvido em código: dúvida de navegação repetida não precisa de modelo.
    // Só entra quando não há guia em andamento, para não cortar um passo no meio.
    const guiaEmAndamento = /passo \d de 5/i.test(getLastAssistantMessage(normalizedMessages)?.content ?? "");
    if (!guiaEmAndamento) {
      const faq = resolveAtlasFaq(lastUserMessage);
      if (faq) {
        registrarUso({ userId: authenticatedUserId, origem: "codigo", etapa: `faq_${faq.id}` });
        return responder({ message: faq.message, actions: faq.actions ?? [] });
      }
    }


    const produtoDoCatalogo =
      produtoSelecionado && typeof produtoSelecionado === "object" && typeof produtoSelecionado.id === "string"
        ? {
            id: String(produtoSelecionado.id),
            nome: String(produtoSelecionado.nome ?? "produto do catálogo"),
            categoria: String(produtoSelecionado.categoria ?? "sem categoria"),
            preco: Number(produtoSelecionado.preco ?? Number.NaN),
            imagem: safeImageUrl(produtoSelecionado.imagem),
          }
        : null;

    const beginnerGuideResponse = await maybeHandleBeginnerGuide(
      normalizedMessages,
      authenticatedUserId,
      produtoDoCatalogo,
    );
    if (beginnerGuideResponse) {
      registrarUso({
        userId: authenticatedUserId,
        origem: "codigo",
        etapa: etapaDaRespostaDoGuia(beginnerGuideResponse),
      });
      return responder(beginnerGuideResponse);
    }

    const safeMessagesForModel = sanitizeUnsafeHistory(normalizedMessages);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const navAction = resolveNavigationAction(lastUserMessage);
    const productAction = await fetchProductCardAction(lastUserMessage);
    const paginaAtual =
      pageContext && typeof pageContext === "object"
        ? (pageContext as PageContext)
        : null;
    const primeiroNomeDoUsuario = await buscarPrimeiroNome(serviceClient, authenticatedUserId);
    const nomeContextMessage = primeiroNomeDoUsuario
      ? `O primeiro nome do usuário é ${primeiroNomeDoUsuario}. Use na saudação e ao comemorar um passo concluído, sem repetir em toda frase.`
      : null;
    const pageContextMessage =
      paginaAtual?.nome || paginaAtual?.rota
        ? `Contexto atual da interface: o usuário está em ${paginaAtual.nome ?? "uma tela da Velo"} (${paginaAtual.rota ?? "rota não informada"}). Use isso apenas se ajudar a responder a última mensagem.`
        : null;

    if (!LOVABLE_API_KEY) {
      registrarUso({
        userId: authenticatedUserId,
        origem: "codigo",
        etapa: "fallback_sem_chave",
        erro: "LOVABLE_API_KEY ausente",
      });
      const fallback = fallbackReply(lastUserMessage);
      return responder({
        ...fallback,
        actions: mergeActions(fallback.actions, [navAction, productAction]),
      });
    }

    // Daqui para baixo a resposta custa modelo. É o único ponto que consome cota.
    if (!quota.permitido) {
      registrarUso({ userId: authenticatedUserId, origem: "codigo", etapa: "quota_esgotada" });
      return responder({
        message: mensagemDeQuotaEsgotada(quota),
        actions: quota.plano === "gratis"
          ? [{ type: "navigation", label: "Ver Planos", route: "/dashboard/planos", variant: "primary" }]
          : [],
        quotaExcedida: true,
      });
    }

    // Conversa longa: mantém as últimas cruas e resume o excedente uma vez.
    const janela = await montarJanelaDeContexto(safeMessagesForModel, {
      apiKey: LOVABLE_API_KEY,
      onUso: ({ data, duracaoMs, erro }) =>
        registrarUso({
          userId: authenticatedUserId,
          origem: "modelo",
          etapa: ATLAS_ETAPA_RESUMO,
          modelo: MODELO_RESUMO,
          uso: lerUsoDoModelo(data),
          duracaoMs,
          erro: erro ?? null,
        }),
    });

    const rota = escolherModeloDoAtlas(lastUserMessage, {
      temNavegacao: Boolean(navAction),
      historicoLongo: safeMessagesForModel.length > LIMITE_PARA_RESUMIR,
    });

    const inicioDaChamada = Date.now();
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: rota.modelo,
        messages: [
          // Bloco fixo primeiro e sempre idêntico: é o prefixo que o cache do
          // provedor reconhece. Tudo que varia vem depois dele.
          { role: "system", content: ATLAS_SYSTEM_PROMPT },
          ...(janela.resumo
            ? [{ role: "system" as const, content: `Resumo do que já foi conversado antes:\n${janela.resumo}` }]
            : []),
          ...(nomeContextMessage ? [{ role: "system" as const, content: nomeContextMessage }] : []),
          ...(pageContextMessage ? [{ role: "system" as const, content: pageContextMessage }] : []),
          ...janela.mensagens,
        ],
        temperature: 0.35,
        max_tokens: 1100,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("atlas-chat gateway error", resp.status, text);
      registrarUso({
        userId: authenticatedUserId,
        origem: "codigo",
        etapa: "fallback_gateway",
        modelo: rota.modelo,
        duracaoMs: Date.now() - inicioDaChamada,
        erro: `gateway ${resp.status}`,
      });
      const fallback = fallbackReply(lastUserMessage);
      return responder({
        ...fallback,
        actions: mergeActions(fallback.actions, [navAction, productAction]),
      });
    }

    const data = await resp.json();
    // Único ponto do fluxo em que o texto vem do modelo, e o único que custa.
    registrarUso({
      userId: authenticatedUserId,
      origem: "modelo",
      etapa: `pergunta_livre_${rota.rota}`,
      modelo: rota.modelo,
      uso: lerUsoDoModelo(data),
      duracaoMs: Date.now() - inicioDaChamada,
    });

    const rawMessage: string =
      data.choices?.[0]?.message?.content ||
      "Desculpe, não consegui processar agora. Tente reformular sua pergunta.";
    const parsed = parseAtlasModelResponse(rawMessage);

    // A resposta acabou de consumir uma mensagem: a UI recebe o saldo já atualizado.
    const quotaDepois = quota.limite === null
      ? quota
      : { ...quota, usadas: quota.usadas + 1, restantes: Math.max(0, quota.limite - quota.usadas - 1) };

    return jsonResponse({
      ...parsed,
      actions: mergeActions(parsed.actions, [navAction, productAction]),
      quota: quotaDepois,
    });

  } catch (err) {
    console.error("atlas-chat error", err);
    registrarUso({
      userId: null,
      origem: "codigo",
      etapa: "erro",
      erro: err instanceof Error ? err.message.slice(0, 300) : "erro desconhecido",
    });
    return jsonResponse(
      {
        message:
          "Alguma coisa falhou aqui do meu lado agora. Não foi nada que você fez.\n\nTente me perguntar de novo, com outras palavras, ou me diga qual parte do painel você quer usar. Eu continuo por aqui.",
        actions: [],
      },
      200,
    );
  }
});
