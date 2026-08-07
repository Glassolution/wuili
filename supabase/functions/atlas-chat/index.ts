// Atlas Chat — assistente conversacional da Velo via Lovable AI Gateway (Gemini)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

type AtlasAction = NavigationAction | ProductCardAction | QuickReplyAction | ConnectMlAction;

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

const isConfirmText = (message: string) =>
  /\b(sim|isso|esse|essa|confirmo|confirmar|pode seguir|seguir|quero|vamos|ok|beleza|primeiro|1)\b/.test(
    normalizeGuideText(message),
  );

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
      note: `Sinal público do Mercado Livre: ${total.toLocaleString("pt-BR")} resultados para termos do nicho.`,
    };
  } catch (error) {
    console.warn("atlas beginner market signal skipped", niche.id, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const fetchInternalCatalogSignals = async (supabase: ReturnType<typeof createClient> | null): Promise<MarketSignal[]> => {
  if (!supabase) {
    return VALIDATED_NICHES.map((niche, index) => ({
      nicheId: niche.id,
      label: niche.label,
      source: "internal_catalog_fallback",
      demand: 50 - index,
      competition: 45,
      score: 50 - index,
      note: "Fallback local de nichos validados da Velo.",
    }));
  }

  return Promise.all(
    VALIDATED_NICHES.map(async (niche) => {
      let query = supabase
        .from("catalog_products")
        .select("id,margin_percent,orders_count,category,title,description")
        .eq("source", "c7drop")
        .eq("is_active", true)
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        .limit(12);

      const ors = niche.catalogTerms
        .slice(0, 5)
        .map((term) => {
          const safe = normalizeGuideText(term).replace(/[%,]/g, " ").trim();
          return `title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`;
        })
        .join(",");
      if (ors) query = query.or(ors);

      const { data } = await query;
      const rows = data ?? [];
      const avgMargin =
        rows.reduce((sum, row) => sum + Number(row.margin_percent ?? 0), 0) / Math.max(rows.length, 1);
      const demand = Math.min(100, rows.reduce((sum, row) => sum + Number(row.orders_count ?? 0), 0) / 4);
      const score = Math.round(Math.min(100, rows.length * 7 + avgMargin * 0.45 + demand * 0.2));
      return {
        nicheId: niche.id,
        label: niche.label,
        source: "internal_catalog_fallback" as const,
        demand: Math.round(demand),
        competition: Math.max(20, Math.min(80, rows.length * 6)),
        score,
        note: `Sinal interno: ${rows.length} produtos equivalentes no catálogo Velo.`,
      };
    }),
  );
};

const researchMarketSignals = async (supabase: ReturnType<typeof createClient> | null) => {
  const liveSignals = await Promise.all(VALIDATED_NICHES.map(fetchMercadoLivreSignal));
  const validLiveSignals = liveSignals.filter((signal): signal is MarketSignal => Boolean(signal));
  if (validLiveSignals.length >= 5) return validLiveSignals;
  return fetchInternalCatalogSignals(supabase);
};

const researchSingleNiche = async (niche: ValidatedNiche, supabase: ReturnType<typeof createClient> | null) => {
  const liveSignal = await fetchMercadoLivreSignal(niche);
  if (liveSignal) return liveSignal;
  const internalSignals = await fetchInternalCatalogSignals(supabase);
  return internalSignals.find((signal) => signal.nicheId === niche.id) ?? {
    nicheId: niche.id,
    label: niche.label,
    source: "internal_catalog_fallback" as const,
    demand: 50,
    competition: 45,
    score: 50,
    note: "Nicho validado pela base interna da Velo.",
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
    "Não posso ajudar com esse tipo de solicitação. Posso te orientar no uso da Velo, como conectar o Mercado Livre, encontrar produtos, publicar anúncios, acompanhar pedidos ou gerenciar sua assinatura.",
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

const scoreCatalogProduct = (product: CatalogProductPreview, niche: ValidatedNiche) => {
  const searchable = normalizeGuideText(`${product.title ?? ""} ${product.description ?? ""} ${product.category ?? ""}`);
  const termScore = niche.catalogTerms.reduce((score, term) => {
    const clean = normalizeGuideText(term);
    if (!clean) return score;
    return searchable.includes(clean) ? score + 12 : score;
  }, 0);
  return termScore + Number(product.margin_percent ?? 0) * 0.7 + Number(product.orders_count ?? 0) * 0.12;
};

const searchCatalogProductsForNiche = async (
  supabase: ReturnType<typeof createClient> | null,
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

  return ((data ?? []) as CatalogProductPreview[])
    .sort((a, b) => scoreCatalogProduct(b, niche) - scoreCatalogProduct(a, niche))
    .slice(0, 3);
};

const getUserMercadoLivreStatus = async (supabase: ReturnType<typeof createClient> | null, userId: string) => {
  if (!supabase) return { connected: false, tokenValid: false };

  const { data } = await supabase
    .from("user_integrations")
    .select("access_token,expires_at,platform")
    .eq("user_id", userId)
    .in("platform", ["mercadolivre", "mercado_livre", "ml"])
    .limit(1)
    .maybeSingle();

  const expiresAt = data?.expires_at ? new Date(String(data.expires_at)).getTime() : 0;
  const tokenValid = Boolean(data?.access_token) && (!expiresAt || expiresAt > Date.now() + 60_000);
  return { connected: Boolean(data?.access_token), tokenValid };
};

const askBeginnerNiche = async (supabase: ReturnType<typeof createClient> | null): Promise<AtlasResponse> => {
  const signals = await researchMarketSignals(supabase);
  const suggestions = beginnerNicheSuggestions(signals, 5);
  const sourceLabel = signals[0]?.source === "mercado_livre_public_search"
    ? "pesquisa pública do Mercado Livre"
    : "sinais internos do catálogo Velo";

  return {
    message:
      `Tudo bem, já que esse é o seu começo na Velo, vou te guiar por isso passo a passo — uma coisa de cada vez, sem pressa.\n\n**Passo 1 de 4 — seu nicho**\n\nNicho é o tipo de produto que você quer vender, como pets, beleza ou utilidades para casa. Escolher um deixa tudo mais fácil daqui pra frente.\n\nOlhei ${sourceLabel} e separei algumas opções que estão indo bem agora. Pode escolher uma, ou me dizer outro nicho que você já tenha em mente — não precisa ficar preso a essa lista.`,
    actions: [
      ...suggestions.map((label) => quickReply(label, `Quero começar com ${label}`)),
      quickReply("Ainda não sei", "Ainda não sei qual nicho escolher"),
    ],
  };
};

const validateNicheStep = async (
  supabase: ReturnType<typeof createClient> | null,
  niche: ValidatedNiche,
): Promise<AtlasResponse> => {
  const signal = await researchSingleNiche(niche, supabase);
  const demandText = signal.demand >= 70 ? "boa demanda" : signal.demand >= 45 ? "demanda moderada" : "demanda mais específica";
  const competitionText = signal.competition >= 70 ? "concorrência alta" : signal.competition >= 45 ? "concorrência média" : "concorrência menor";

  return {
    message:
      `**Passo 1 de 4 — seu nicho**\n\nNicho sugerido: **${niche.label}**.\n\nEsse nicho parece ter ${demandText} e ${competitionText}. Na prática: existe procura, e o que vai definir o resultado é escolher produtos com boa margem e fotos claras.\n\n${signal.note}\n\nConfirma esse nicho para a gente seguir para o próximo passo?`,
    actions: [
      quickReply("Sim, buscar produtos", `Sim, buscar produtos de ${niche.label}`),
      quickReply("Ver outros nichos", "Quero ver outros nichos"),
      quickReply("Vou digitar outro", "Quero escolher outro nicho"),
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
  supabase: ReturnType<typeof createClient> | null,
  niche: ValidatedNiche,
  excludeIds: string[] = [],
): Promise<AtlasResponse> => {
  const products = await searchCatalogProductsForNiche(supabase, niche, excludeIds);
  if (products.length === 0) {
    return {
      message:
        `Procurei produtos de **${niche.label}** no catálogo real da Velo e não encontrei uma opção forte agora. Posso testar outro nicho ou abrir o catálogo para você explorar manualmente.`,
      actions: [
        { type: "navigation", label: "Abrir Catálogo", route: "/dashboard/catalogo" },
        quickReply("Ver outros nichos", "Quero ver outros nichos"),
        quickReply("Tentar outro termo", "Quero escolher outro nicho"),
      ],
    };
  }

  return {
    message:
      `**Passo 2 de 4 — escolha do produto**\n\nAgora cruzei **${niche.label}** com o catálogo real da Velo. Separei até 3 opções, priorizando estoque ativo e indicador de margem.\n\nEscolha uma e no próximo passo eu avalio o potencial dela nas redes.`,
    actions: [
      ...products.map(productCardFromRow),
      quickReply("Quero o primeiro", "Quero o primeiro produto"),
      quickReply("Ver outras opções", "Ver outras opções de produto"),
      quickReply("Mudar de nicho", "Mudar de nicho"),
    ],
  };
};


// --- Passo 2: onde vender ---------------------------------------------------
// PENDÊNCIA: loja própria via Shopify está em planejamento e NÃO deve ser
// oferecida como se existisse. Quando a integração for lançada, este passo passa
// a apresentar as duas opções e a pergunta vira uma escolha de verdade.
const askSalesChannelStep = (niche: ValidatedNiche): AtlasResponse => ({
  message:
    `Boa, **${niche.label}** fechado.\n\n**Passo 2 de 4 — onde vender**\n\nHoje a Velo publica direto no **Mercado Livre**, através de uma conexão oficial com a sua conta de vendedor. É o caminho mais rápido para a primeira venda: o marketplace já traz o público, você não precisa montar loja nem trazer visita por conta própria.\n\nA parte técnica dessa conexão fica em #integracoes, e a gente faz isso junto mais pra frente — agora é só alinhar o caminho.\n\nSeguimos pelo Mercado Livre?`,
  actions: [
    quickReply("Sim, Mercado Livre", "Sim, quero vender pelo Mercado Livre"),
    quickReply("Tenho uma dúvida", "Tenho uma dúvida sobre vender no Mercado Livre"),
    quickReply("Mudar de nicho", "Mudar de nicho"),
  ],
});

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

const assessSocialPotential = (product: ProductCardAction, niche: ValidatedNiche) => {
  const title = normalizeGuideText(product.product?.title ?? "");
  const matches = DEMO_KEYWORDS.filter((keyword) => title.includes(keyword));
  const visualNiche = VISUAL_NICHE_IDS.has(niche.id);
  const score = (visualNiche ? 2 : 0) + Math.min(matches.length, 3);

  if (score >= 3) {
    return {
      nivel: "forte" as const,
      leitura:
        "dá pra mostrar funcionando em poucos segundos, que é exatamente o que costuma render vídeo curto — antes e depois, demonstração de uso, reação.",
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
      "é um produto mais funcional que visual, então o vídeo tende a render menos sozinho. Não impede de vender pelo marketplace, mas a divulgação orgânica vai puxar menos.",
  };
};

const validateSocialPotentialStep = (
  product: ProductCardAction,
  niche: ValidatedNiche,
): AtlasResponse => {
  const avaliacao = assessSocialPotential(product, niche);
  const titulo = product.product?.title ?? "esse produto";

  return {
    message:
      `**Passo 3 de 4 — potencial de divulgação**\n\nAntes de publicar, vale olhar uma coisa que quase ninguém olha no começo: o quanto esse produto se sustenta sozinho no TikTok e no Instagram.\n\nProduto visual, com "efeito uau", fácil de mostrar em uso, costuma render bem mais que produto genérico — porque o vídeo faz parte do trabalho de venda por você, de graça.\n\nMinha leitura de **${titulo}**: potencial **${avaliacao.nivel}**. ${avaliacao.leitura}\n\nIsso é orientação a partir do tipo de produto e do nicho, não medição das redes. Quando quiser produzir esse conteúdo, os influencers de IA ficam em #tiktok e as fotos em #imagens-ia.\n\nQuer seguir com ele para a publicação?`,
    actions: [
      product,
      quickReply("Sim, seguir com ele", "Sim, seguir com esse produto para publicação"),
      quickReply("Ver outras opções", "Ver outras opções de produto"),
      quickReply("Mudar de nicho", "Mudar de nicho"),
    ],
  };
};

const guidePublicationStep = async (
  supabase: ReturnType<typeof createClient> | null,
  userId: string,
  product: ProductCardAction,
  niche: ValidatedNiche | null,
): Promise<AtlasResponse> => {
  const mlStatus = await getUserMercadoLivreStatus(supabase, userId);
  const nicheLabel = niche?.label ?? "o que você escolheu";
  const productTitle = product.product?.title ?? "esse produto";
  const productRoute = product.product?.route ?? `/dashboard/catalogo/${product.product_id}`;

  if (!mlStatus.connected || !mlStatus.tokenValid) {
    return {
      message:
        `**Passo 4 de 4 — resumo e publicação**\n\nFechamos assim:\n\n- **Nicho:** ${nicheLabel}\n- **Canal:** Mercado Livre\n- **Produto:** ${productTitle} — potencial de divulgação avaliado\n\nFalta uma coisa antes de publicar: conectar sua conta do Mercado Livre. É uma autorização oficial — você entra no ML, permite a conexão e volta pra cá. Isso se faz em #integracoes.\n\nDepois de conectar, a gente abre o produto, revisa título e descrição e publica. Me avisa quando estiver conectado.`,
      actions: [
        // Conecta pelo próprio chat: o usuário não precisa achar a tela sozinho.
        { type: "connect_ml", label: "Conectar Mercado Livre agora" },
        // Mantida junto de propósito: frontend que ainda não conhece connect_ml
        // descarta a ação acima, e sem esta o usuário ficaria sem caminho nenhum
        // para conectar.
        { type: "navigation", label: "Abrir Integrações", route: "/dashboard/integracoes" },
        { type: "navigation", label: "Abrir produto escolhido", route: productRoute },
        quickReply("Já conectei o ML", "Já conectei o Mercado Livre"),
        quickReply("Ver outras opções", "Ver outras opções de produto"),
      ],
    };
  }

  return {
    message:
      `**Passo 4 de 4 — resumo e publicação**\n\nFechamos assim:\n\n- **Nicho:** ${nicheLabel}\n- **Canal:** Mercado Livre (conta já conectada)\n- **Produto:** ${productTitle} — potencial de divulgação avaliado\n\nAgora é a parte final: abra o produto, revise título e descrição, confira preço e margem, e publique. Depois é só acompanhar o status em #publicacoes e as vendas em #pedidos.\n\nSe travar em algum ponto, me chama que eu destravo.`,
    actions: [
      { type: "navigation", label: "Abrir produto escolhido", route: productRoute },
      { type: "navigation", label: "Ver Publicações", route: "/dashboard/publicacoes" },
      { type: "navigation", label: "Ver Pedidos", route: "/dashboard/pedidos" },
      quickReply("Ver outras opções", "Ver outras opções de produto"),
      quickReply("Mudar de nicho", "Mudar de nicho"),
    ],
  };
};

const maybeHandleBeginnerGuide = async (messages: ChatMessage[], userId: string): Promise<AtlasResponse | null> => {
  const supabase = createServiceClient();
  const lastUserMessage = getLastUserMessage(messages);
  const userMessageCount = messages.filter((message) => message.role !== "assistant").length;
  const lastAssistant = getLastAssistantMessage(messages);
  const lastAssistantText = normalizeGuideText(lastAssistant?.content ?? "");
  const lastActions = getLastAssistantActions(messages);
  const lastProductCards = lastActions.filter((action): action is ProductCardAction => action.type === "product_card");

  // O guia se identifica pelo marcador "passo N de 4", presente em toda etapa.
  // Antes isso dependia do título "Guia de Iniciante"; qualquer mudança de texto
  // quebrava a continuidade e o fluxo caía no modelo genérico no meio do caminho.
  const guideWasActive = /passo \d de 4/.test(lastAssistantText) || lastActions.some((action) => action.type === "quick_reply");

  if (wantsChangeNiche(lastUserMessage) || (guideWasActive && wantsNoNicheHelp(lastUserMessage))) {
    return askBeginnerNiche(supabase);
  }

  const emPasso = (n: number) => guideWasActive && lastAssistantText.includes(`passo ${n} de 4`);

  // "Ver outras opções" vale em qualquer etapa que já tenha produto na tela.
  // Tratado antes das etapas específicas porque o botão aparece nos passos 2, 3
  // e 4 — preso só ao passo 2, os outros dois caíam fora do guia.
  if (guideWasActive && lastProductCards.length > 0 && wantsOtherOptions(lastUserMessage)) {
    const niche = inferNicheFromConversation(messages, lastUserMessage);
    if (niche) return showProductsForNiche(supabase, niche, lastProductCards.map((product) => product.product_id));
    return askBeginnerNiche(supabase);
  }

  // Passo 3 confirmado -> Passo 4 (resumo + publicação).
  if (emPasso(3) && lastProductCards.length > 0 && isConfirmText(lastUserMessage)) {
    const niche = inferNicheFromConversation(messages, lastUserMessage);
    return guidePublicationStep(supabase, userId, lastProductCards[0], niche);
  }

  // Produto escolhido na lista -> Passo 3 (potencial de divulgação).
  if (emPasso(2) && lastProductCards.length > 0 && (isConfirmText(lastUserMessage) || /produto/i.test(lastUserMessage))) {
    // Sem nicho identificado o passo 3 ficaria sem contexto; volta ao passo 1 em
    // vez de devolver a conversa para o modelo genérico no meio do guia.
    const niche = inferNicheFromConversation(messages, lastUserMessage);
    if (!niche) return askBeginnerNiche(supabase);
    return validateSocialPotentialStep(lastProductCards[0], niche);
  }

  // Passo 2 (canal) confirmado -> lista de produtos do nicho.
  if (emPasso(2) && lastProductCards.length === 0 && isConfirmText(lastUserMessage)) {
    const niche = inferNicheFromConversation(messages, lastUserMessage);
    if (niche) return showProductsForNiche(supabase, niche);
  }

  // Passo 4: usuário avisa que conectou o Mercado Livre.
  if (emPasso(4) && /\b(ja conectei|já conectei|conectei|conectado)\b/i.test(lastUserMessage)) {
    const productNav = lastActions.find(
      (action): action is NavigationAction => action.type === "navigation" && action.route.includes("/dashboard/catalogo/"),
    );
    return {
      message:
        "**Passo 4 de 4 — revisão final**\n\nBoa. Agora abra o produto escolhido, revise título, descrição, preço e margem, e publique.\n\nDepois de publicar, o status aparece em #publicacoes e as vendas em #pedidos. Qualquer dúvida no meio do caminho, é só me chamar.",
      actions: [
        ...(productNav ? [productNav] : [{ type: "navigation" as const, label: "Abrir Catálogo", route: "/dashboard/catalogo" }]),
        { type: "navigation", label: "Ver Publicações", route: "/dashboard/publicacoes" },
        quickReply("Ver outras opções", "Ver outras opções de produto"),
        quickReply("Mudar de nicho", "Mudar de nicho"),
      ],
    };
  }

  const previousAskedForNiche =
    guideWasActive &&
    (lastAssistantText.includes("passo 1 de 4") ||
      lastAssistantText.includes("outro nicho que voce ja tenha em mente"));
  const previousValidatedNiche = guideWasActive && lastAssistantText.includes("confirma esse nicho");

  // Passo 1 confirmado -> Passo 2 (canal de venda).
  if (previousValidatedNiche && isConfirmText(lastUserMessage)) {
    const niche = inferNicheFromConversation(messages, lastUserMessage);
    if (niche) return askSalesChannelStep(niche);
  }

  if (previousAskedForNiche || isBeginnerTrigger(lastUserMessage, userMessageCount)) {
    const niche = findValidatedNiche(lastUserMessage);
    if (niche) return validateNicheStep(supabase, niche);
    return askBeginnerNiche(supabase);
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
  if (normalizedMessage.includes("anuncio") || normalizedMessage.includes("publica")) {
    return {
      message:
        "Posso te ajudar a criar um anúncio. O caminho normal é escolher um produto no Catálogo, revisar título/descrição e publicar com o Mercado Livre conectado.",
      actions: [{ type: "navigation", label: "Abrir Catálogo", route: "/dashboard/catalogo" }],
    };
  }

  if (normalizedMessage.includes("produto")) {
    return {
      message:
        "Para encontrar produtos, comece pelo Catálogo da Velo. Procure itens ativos, com estoque e bom indicador de margem. Se você me disser um nicho, eu consigo orientar melhor.",
      actions: [{ type: "navigation", label: "Abrir Catálogo", route: "/dashboard/catalogo" }],
    };
  }

  if (normalizedMessage.includes("mercado livre") || normalizedMessage.includes("ml")) {
    return {
      message:
        "A conexão com o Mercado Livre fica em Integrações. Você autoriza pelo site oficial do ML e volta para a Velo com a conta conectada.",
      actions: [{ type: "navigation", label: "Abrir Integrações", route: "/dashboard/integracoes" }],
    };
  }

  if (normalizedMessage.includes("plano") || normalizedMessage.includes("assinatura")) {
    return {
      message:
        "A Velo usa planos com limites diferentes de produtos, marketplaces, páginas e automações. Para valores atuais, confira a área de Planos no painel.",
      actions: [{ type: "navigation", label: "Ver Planos", route: "/dashboard/planos" }],
    };
  }

  return {
    message:
      "Posso te orientar na Velo. Me diga se você quer encontrar produtos, conectar o Mercado Livre, criar um anúncio, gerar imagens, acompanhar pedidos ou mexer na assinatura.",
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

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: "messages obrigatório" }, 400);
    }

    const normalizedMessages = messages.map((message: ChatMessage) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content ?? ""),
      product_data: message.product_data ?? null,
    }));
    const lastUserMessage = getLastUserMessage(normalizedMessages);

    if (isUnsafeRequest(lastUserMessage)) {
      return jsonResponse(refusalResponse());
    }

    const beginnerGuideResponse = await maybeHandleBeginnerGuide(normalizedMessages, authenticatedUserId);
    if (beginnerGuideResponse) {
      return jsonResponse(beginnerGuideResponse);
    }

    const safeMessagesForModel = sanitizeUnsafeHistory(normalizedMessages);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const navAction = resolveNavigationAction(lastUserMessage);
    const productAction = await fetchProductCardAction(lastUserMessage);

    if (!LOVABLE_API_KEY) {
      const fallback = fallbackReply(lastUserMessage);
      return jsonResponse({
        ...fallback,
        actions: mergeActions(fallback.actions, [navAction, productAction]),
      });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: buildAtlasSystemPrompt() },
          ...safeMessagesForModel,
        ],
        temperature: 0.35,
        max_tokens: 1100,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("atlas-chat gateway error", resp.status, text);
      const fallback = fallbackReply(lastUserMessage);
      return jsonResponse({
        ...fallback,
        actions: mergeActions(fallback.actions, [navAction, productAction]),
      });
    }

    const data = await resp.json();
    const rawMessage: string =
      data.choices?.[0]?.message?.content ||
      "Desculpe, não consegui processar agora. Tente reformular sua pergunta.";
    const parsed = parseAtlasModelResponse(rawMessage);

    return jsonResponse({
      ...parsed,
      actions: mergeActions(parsed.actions, [navAction, productAction]),
    });
  } catch (err) {
    console.error("atlas-chat error", err);
    return jsonResponse(
      {
        message:
          "Tive uma instabilidade agora, mas posso continuar te ajudando. Tente reformular a pergunta ou escolha uma área do painel.",
        actions: [],
      },
      200,
    );
  }
});
