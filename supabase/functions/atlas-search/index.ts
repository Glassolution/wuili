// Atlas/Aquas — assistente conversacional real:
// - Classifica cada turno como "search" (buscar novo produto) ou "chat" (analisar/discutir o atual).
// - Em "search", retorna produto + análise estruturada.
// - Em "chat", responde perguntas do usuário sobre o produto em contexto (nicho, facilidade de venda, alternativas etc.).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_SOURCES = ["c7drop"];
const RESULT_LIMIT = 24;
const AI_MODEL = "google/gemini-3-flash-preview";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type AtlasFilters = {
  categoria: string | null;
  palavras_chave: string[];
  ordenar_por: "margem" | "vendas" | "preco_asc" | "preco_desc" | null;
  estoque_minimo: number | null;
  resposta_chat: string;
};

const DEFAULT_FILTERS: AtlasFilters = {
  categoria: null,
  palavras_chave: [],
  ordenar_por: null,
  estoque_minimo: null,
  resposta_chat: "Encontrei este produto no catálogo para você:",
};

type ChatHistoryItem = { role: string; content: string };
type UserContext = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

type AtlasActionType = "navigate" | "diagnose" | "publish_start" | "publish_complete" | "product_search";

type AtlasAction = {
  type: AtlasActionType;
  label: string;
  path?: string;
  payload?: Record<string, unknown>;
  variant?: "primary" | "secondary";
};

type MlStatus = {
  connected: boolean;
  token_valid: boolean;
  last_sync: string | null;
};

type PublishRequirements = {
  has_images: boolean;
  has_price: boolean;
  has_stock: boolean;
  missing: string[];
};

type CatalogProductFull = {
  id: string;
  title: string | null;
  category: string | null;
  description: string | null;
  cost_price: number | null;
  suggested_price: number | null;
  margin_percent: number | null;
  orders_count: number | null;
  images: unknown;
  product_url: string | null;
  stock_quantity: number | null;
};

type SearchProductRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  orders_count: number | null;
  margin_percent: number | null;
};

type SupabaseClient = ReturnType<typeof createClient>;

const ROUTE_MAP = [
  {
    key: "catalogo",
    label: "Catálogo",
    path: "/dashboard/catalogo",
    description: "Buscar, filtrar, favoritar e abrir produtos do catálogo Velo.",
    terms: ["catalogo", "produto", "produtos", "buscar", "busca", "c7drop"],
  },
  {
    key: "colecoes",
    label: "Coleções",
    path: "/dashboard",
    description: "Organizar produtos em pastas e coleções dentro do painel inicial.",
    terms: ["colecao", "colecoes", "pasta", "pastas", "organizar"],
  },
  {
    key: "integracoes",
    label: "Integrações",
    path: "/dashboard/configuracoes",
    description: "Conectar Mercado Livre e revisar integrações da conta.",
    terms: ["integracao", "integracoes", "mercado livre", "ml", "conectar", "token"],
  },
  {
    key: "assinatura",
    label: "Assinatura",
    path: "/checkout",
    description: "Ver planos, upgrade e assinatura da Velo.",
    terms: ["assinatura", "plano", "premium", "upgrade", "pagamento", "checkout"],
  },
  {
    key: "metricas",
    label: "Métricas",
    path: "/dashboard",
    description: "Acompanhar visão geral, resultados e indicadores do dashboard.",
    terms: ["metrica", "metricas", "dashboard", "resultado", "relatorio", "relatorios"],
  },
  {
    key: "publicacoes",
    label: "Publicações",
    path: "/dashboard/publicacoes",
    description: "Ver anúncios e produtos publicados.",
    terms: ["publicacao", "publicacoes", "anuncio", "anuncios", "publicado", "publicados"],
  },
] as const;

const STOPWORDS = new Set([
  "quero", "queria", "preciso", "procurar", "procuro", "procurando", "buscar", "busca",
  "busque", "encontre", "encontrar", "achar", "ache", "outro", "outros", "outra", "outras",
  "produto", "produtos", "item", "itens", "opcao", "opcoes", "para", "sobre", "com", "uma",
  "uns", "umas", "meu", "minha", "esse", "essa", "isso", "aquele", "aquela", "novo", "nova",
  "mais", "bom", "boa", "bons", "boas", "catalogo", "vender", "venda",
  "barato", "baratos", "barata", "baratas", "caro", "caros", "cara", "caras",
  "melhor", "melhores", "pior", "piores", "top", "vendido", "vendidos", "vendida",
  "vendidas", "popular", "populares", "viral", "virais", "margem", "lucro",
]);

// Detecta pedidos "só-ordenação" (sem palavra-chave específica de produto)
function detectSortOnlyOrder(text: string): AtlasFilters["ordenar_por"] | null {
  const n = normalizeText(text);
  if (/\b(mais barato|menor preco|preco baixo|barato|baratos)\b/.test(n)) return "preco_asc";
  if (/\b(mais caro|maior preco|preco alto|caro|caros|premium)\b/.test(n)) return "preco_desc";
  if (/\b(maior margem|melhor margem|mais lucro|maior lucro)\b/.test(n)) return "margem";
  if (/\b(mais vendido|mais vendidos|mais popular|top vendas|bestseller|campeao de vendas)\b/.test(n)) return "vendas";
  return null;
}

function readUserContext(value: unknown): UserContext {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return {
    id: typeof record.id === "string" ? record.id : null,
    name: typeof record.name === "string" ? record.name : null,
    email: typeof record.email === "string" ? record.email : null,
  };
}

function userContextLine(userContext: UserContext) {
  const safeName = userContext.name?.trim();
  if (!safeName || safeName.toLowerCase() === "usuario") return "";
  return `\nUsuário atual: ${safeName}. Use o nome com naturalidade apenas quando fizer sentido, sem repetir em toda resposta.`;
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractFallbackKeywords(text: string) {
  const normalized = normalizeText(text);
  const words = normalized
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));

  const expanded = new Set(words);

  if (/\b(copa|fifa|mundial|futebol|brasil|selecao)\b/.test(normalized)) {
    ["copa", "fifa", "mundial", "futebol", "album", "figurinha", "brasil", "bola"].forEach((word) => expanded.add(word));
  }

  if (/\b(cozinha|casa|louca|prato|organizador)\b/.test(normalized)) {
    ["cozinha", "casa", "organizador", "prato", "louca"].forEach((word) => expanded.add(word));
  }

  if (/\b(tiktok|viral|virais|reels|anuncio|anuncios)\b/.test(normalized)) {
    ["viral", "tiktok", "criativo", "demonstracao"].forEach((word) => expanded.add(word));
  }

  return Array.from(expanded).slice(0, 8);
}

function extractProtectedKeywords(text: string) {
  const normalized = normalizeText(text);

  if (/\b(copa|fifa|mundial|futebol|brasil|selecao)\b/.test(normalized)) {
    return ["copa", "fifa", "world cup", "mundial", "album", "figurinha", "brasil", "bola"];
  }

  return [];
}

function scoreSearchProduct(row: SearchProductRow, keywords: string[]) {
  const title = normalizeText(row.title ?? "");
  const description = normalizeText(row.description ?? "");
  const category = normalizeText(row.category ?? "");
  const searchable = `${title} ${description} ${category}`;
  let score = 0;

  keywords.forEach((keyword) => {
    const cleanKeyword = normalizeText(keyword).trim();
    if (!cleanKeyword) return;

    if (title.includes(cleanKeyword)) score += 14;
    if (category.includes(cleanKeyword)) score += 7;
    if (description.includes(cleanKeyword)) score += 4;

    cleanKeyword.split(/\s+/).forEach((part) => {
      if (part.length <= 2) return;
      if (title.includes(part)) score += 4;
      else if (searchable.includes(part)) score += 1;
    });
  });

  return score;
}

function orderResultsByRelevance(rows: SearchProductRow[], keywords: string[]) {
  if (keywords.length === 0) return rows;

  return [...rows].sort((a, b) => {
    const scoreDiff = scoreSearchProduct(b, keywords) - scoreSearchProduct(a, keywords);
    if (scoreDiff !== 0) return scoreDiff;

    const ordersDiff = Number(b.orders_count ?? 0) - Number(a.orders_count ?? 0);
    if (ordersDiff !== 0) return ordersDiff;

    return Number(b.margin_percent ?? 0) - Number(a.margin_percent ?? 0);
  });
}

function isExplicitSearchRequest(text: string) {
  const normalized = normalizeText(text);
  return [
    /\b(encontre|encontrar|achar|busca|buscar|busque|procure|procurar|descubra|descobrir|mostre|recomende|indique)\b/,
    /\b(ajuda|ajude|preciso)\b.*\b(achar|encontrar|buscar|procurar|descobrir)\b/,
    /\b(outro|outros|outra|outras|alternativa|alternativas|trocar|troque|substituir|substitua)\b.*\b(produto|produtos|opcao|opcoes)\b/,
    /\b(produto|produtos|item|itens|opcao|opcoes)\b.*\b(barato|baratos|margem|viral|virais|estoque|categoria|casa|cozinha|eletronico|eletronicos|moda|pet|bebe|automotivo|decoracao)\b/,
    /\b(item|itens|produto|produtos|algo|coisa|opcao|opcoes)\s+(de|da|do|para)\s+\w+/,
  ].some((pattern) => pattern.test(normalized));
}

function isCasualOrFollowUpChat(text: string) {
  const normalized = normalizeText(text);
  return [
    /\b(oi|ola|opa|e ai|tudo bem|bom dia|boa tarde|boa noite|beleza)\b/,
    /\b(explica|explique|detalha|detalhe|melhor|vale a pena|compensa|e bom|serve|vender|viraliza|tiktok|reels|anuncio|publico|nicho|margem|preco|concorrencia)\b/,
  ].some((pattern) => pattern.test(normalized));
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned) as Record<string, unknown>; } catch { /* try substring */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as Record<string, unknown>; } catch { return null; }
}

async function callAI(apiKey: string, messages: Array<{ role: string; content: string }>): Promise<string | null> {
  try {
    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL, messages }),
    });
    if (!resp.ok) {
      console.error("AI gateway error", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch (e) {
    console.error("AI call failed", e);
    return null;
  }
}

// Classifica turno: nova busca de produto, chat sobre produto atual, ou dúvida geral sobre a Velo.
async function classifyIntent(
  apiKey: string,
  userText: string,
  history: ChatHistoryItem[],
  hasCurrentProduct: boolean,
): Promise<"search" | "chat" | "general"> {
  if (isExplicitSearchRequest(userText)) return "search";

  const sys = `Você classifica a intenção da mensagem do usuário no assistente Atlas da Velo (dropshipping BR).
Responda APENAS JSON: {"intencao":"search"|"chat"|"general"}.
- "search": usuário quer encontrar/listar/trocar PRODUTOS no catálogo (ex: "me mostre fones", "encontre algo mais barato", "produto pra cozinha", "trocar produto", "outra opção").
- "chat": usuário quer discutir/analisar o PRODUTO atualmente aberto (ex: "esse é bom pro meu nicho?", "vale a pena?", "como divulgar esse?"). Só use se houver produto no contexto.
- "general": qualquer outra dúvida, conversa ou pedido de ajuda sobre a plataforma Velo, planos, assinatura, integração com Mercado Livre, publicação, pagamentos, saldos, comissões, cadastro, senha, funcionamento do dashboard, dúvidas conceituais, saudações, small talk. Use este quando NÃO for busca de produto nem análise do produto atual.
Contexto: hasCurrentProduct=${hasCurrentProduct}.`;
  const messages = [
    { role: "system", content: sys },
    ...history.slice(-6).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
    { role: "user", content: userText },
  ];
  const raw = await callAI(apiKey, messages);
  if (!raw) return hasCurrentProduct ? "chat" : "general";
  const parsed = extractJsonObject(raw);
  const intent = parsed?.intencao;
  if (intent === "search") return "search";
  if (intent === "chat" && hasCurrentProduct) return "chat";
  if (intent === "general") return "general";
  return hasCurrentProduct ? "chat" : "general";
}


async function inferFilters(
  apiKey: string,
  userText: string,
  history: ChatHistoryItem[],
  userContext: UserContext,
): Promise<AtlasFilters | null> {
  const systemPrompt = `Você é o cérebro de busca do Aquas (catálogo Velo, PT-BR).
Analise a conversa e retorne filtros para a última mensagem do usuário, considerando o contexto anterior para refinamento incremental.
Você atua como agente pessoal do usuário dentro da Velo: ajuda a descobrir produtos, entender se são vendáveis, orientar publicação no Mercado Livre e explicar onde cada recurso do dashboard fica.${userContextLine(userContext)}
Fonte de produtos permitida: exclusivamente catálogo Velo alimentado pelo scraper C7Drop. Nunca cite, sugira ou dependa de outra fonte.
Se o usuário pedir navegação, diagnóstico ou publicação, mantenha filtros simples e deixe as ferramentas do backend criarem ações concretas.

Responda APENAS JSON:
{"categoria":string|null,"palavras_chave":string[],"ordenar_por":"margem"|"vendas"|"preco_asc"|"preco_desc"|null,"estoque_minimo":number|null,"resposta_chat":string}

- palavras_chave: 1-6 termos relevantes ao título/desc; descarte antigos se o usuário mudou de assunto.
- ordenar_por: "margem"=lucro, "vendas"=viral/popular, "preco_asc"=barato, "preco_desc"=premium.
- resposta_chat: frase curta (<=150 chars) introduzindo a recomendação.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
    { role: "user", content: userText },
  ];
  const raw = await callAI(apiKey, messages);
  if (!raw) return null;
  const obj = extractJsonObject(raw) ?? {};

  const ordenar = typeof obj.ordenar_por === "string" ? obj.ordenar_por : null;
  const validOrdenar: AtlasFilters["ordenar_por"] =
    ordenar === "margem" || ordenar === "vendas" || ordenar === "preco_asc" || ordenar === "preco_desc"
      ? ordenar : null;
  const keywords = Array.isArray(obj.palavras_chave)
    ? obj.palavras_chave.filter((k): k is string => typeof k === "string" && k.trim().length > 0)
        .map((k) => k.trim()).slice(0, 8)
    : [];

  return {
    categoria: typeof obj.categoria === "string" && obj.categoria.trim().length > 0 ? obj.categoria.trim() : null,
    palavras_chave: keywords,
    ordenar_por: validOrdenar,
    estoque_minimo: typeof obj.estoque_minimo === "number" && obj.estoque_minimo > 0 ? Math.floor(obj.estoque_minimo) : null,
    resposta_chat: typeof obj.resposta_chat === "string" && obj.resposta_chat.trim().length > 0
      ? obj.resposta_chat.trim() : "Encontrei este produto no catálogo para você:",
  };
}

async function loadProductFull(supabase: ReturnType<typeof createClient>, id: string) {
  const { data } = await supabase
    .from("catalog_products")
    .select("id, title, category, description, cost_price, suggested_price, margin_percent, orders_count, images, product_url, stock_quantity")
    .eq("id", id)
    .maybeSingle();
  return data;
}

function firstImageOf(images: unknown): string {
  if (Array.isArray(images) && images.length > 0) return String(images[0] ?? "");
  if (typeof images === "string") {
    try {
      const arr = JSON.parse(images);
      if (Array.isArray(arr) && arr.length > 0) return String(arr[0] ?? "");
    } catch { /* ignore */ }
  }
  return "";
}

function getRouteMap() {
  return ROUTE_MAP.map(({ key, label, path, description }) => ({ key, label, path, description }));
}

function matchRouteAction(text: string): AtlasAction | null {
  const normalized = normalizeText(text);
  const route = ROUTE_MAP.find((item) => item.terms.some((term) => normalized.includes(normalizeText(term))));
  if (!route) return null;

  return {
    type: "navigate",
    label: `Abrir ${route.label}`,
    path: route.path,
    payload: { route: route.key, description: route.description },
  };
}

function isNavigationRequest(text: string) {
  const normalized = normalizeText(text);
  return /\b(onde|como acesso|como abrir|abrir|ir para|me leva|navegar|configuracao|configuracoes|integracao|integracoes|assinatura|plano|colecao|colecoes|publicacoes|metricas|relatorios)\b/.test(normalized);
}

function isDiagnosisRequest(text: string) {
  const normalized = normalizeText(text);
  return /\b(erro|problema|bug|falha|nao consigo|nao publica|nao conecta|token|travou|diagnostico|diagnosticar|ml|mercado livre)\b/.test(normalized);
}

function isPublishRequest(text: string) {
  const normalized = normalizeText(text);
  return /\b(publicar|publicacao|subir anuncio|anunciar|mercado livre|vender agora|colocar a venda)\b/.test(normalized);
}

// Deriva o user_id real a partir do token da sessão — nunca confiar no
// `user_context.id` que o client manda no corpo, que é só um dado
// não-verificado usado antes disso para autorizar leituras de outro usuário
// (user_integrations, user_publications). Mesmo padrão de atlas-chat/index.ts.
async function authenticateRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return data.user.id;
}

async function logAction(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  actionType: AtlasActionType,
  payload: Record<string, unknown>,
  conversationId?: string | null,
) {
  if (!userId) return;
  const { error } = await supabase
    .from("aquas_actions")
    .insert({
      user_id: userId,
      conversation_id: conversationId ?? null,
      action_type: actionType,
      payload,
    });

  if (error) console.warn("aquas_actions log skipped", error.message);
}

async function getUserMlStatus(supabase: SupabaseClient, userId: string | null | undefined): Promise<MlStatus> {
  if (!userId) return { connected: false, token_valid: false, last_sync: null };

  const { data, error } = await supabase
    .from("user_integrations")
    .select("access_token, expires_at, updated_at, created_at, platform")
    .eq("user_id", userId)
    .in("platform", ["mercado_livre", "mercadolivre", "ml"])
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return { connected: false, token_valid: false, last_sync: null };

  const expiresAt = typeof data.expires_at === "string" ? new Date(data.expires_at).getTime() : 0;
  const hasValidExpiry = Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000;
  const connected = Boolean(data.access_token);

  return {
    connected,
    token_valid: connected && hasValidExpiry,
    last_sync: typeof data.updated_at === "string" ? data.updated_at : typeof data.created_at === "string" ? data.created_at : null,
  };
}

async function getUserPublishedProducts(supabase: SupabaseClient, userId: string | null | undefined) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("user_publications")
    .select("id, title, status, price, published_at, permalink")
    .eq("user_id", userId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(10);

  if (error) {
    console.warn("published products unavailable", error.message);
    return [];
  }

  return data ?? [];
}

async function getRecentErrors(_supabase: SupabaseClient, _userId: string | null | undefined, _limit = 5) {
  return [];
}

function getPublishRequirements(product: CatalogProductFull): PublishRequirements {
  const missing: string[] = [];
  const hasImages = Boolean(firstImageOf(product.images));
  const hasPrice = Number(product.suggested_price ?? product.cost_price ?? 0) > 0;
  const hasStock = Number(product.stock_quantity ?? 0) > 0;

  if (!hasImages) missing.push("imagens");
  if (!hasPrice) missing.push("preço");
  if (!hasStock) missing.push("estoque");

  return {
    has_images: hasImages,
    has_price: hasPrice,
    has_stock: hasStock,
    missing,
  };
}

function startPublishFlow(product: CatalogProductFull, mlStatus: MlStatus) {
  const requirements = getPublishRequirements(product);

  if (!mlStatus.connected || !mlStatus.token_valid) {
    const action: AtlasAction = {
      type: "navigate",
      label: "Conectar Mercado Livre",
      path: "/dashboard/configuracoes",
      payload: { reason: "ml_disconnected", product_id: product.id },
    };
    return { requirements, action, ready: false };
  }

  if (requirements.missing.length > 0) {
    const action: AtlasAction = {
      type: "publish_start",
      label: "Completar cadastro",
      path: `/dashboard/catalogo/${product.id}`,
      payload: { product_id: product.id, missing: requirements.missing },
    };
    return { requirements, action, ready: false };
  }

  const action: AtlasAction = {
    type: "publish_start",
    label: "Publicar agora",
    path: `/dashboard/catalogo/${product.id}`,
    payload: { product_id: product.id },
  };

  return { requirements, action, ready: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authenticatedUserId = await authenticateRequest(req);
    if (!authenticatedUserId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const userText = typeof body?.query === "string" ? body.query.trim() : "";
    const history: ChatHistoryItem[] = Array.isArray(body?.history) ? body.history : [];
    const currentProductId: string | null = typeof body?.current_product_id === "string" ? body.current_product_id : null;
    const forceMode: "chat" | "search" | null =
      body?.force_mode === "chat" ? "chat" : body?.force_mode === "search" ? "search" : null;
    // `userContext` só alimenta o tom da IA (nome/email) — nunca mais é usado
    // para decidir de qual usuário buscar/gravar dados (isso agora vem de
    // `authenticatedUserId`, derivado do token real acima).
    const userContext = readUserContext(body?.user_context);
    const conversationId = typeof body?.conversation_id === "string" ? body.conversation_id : null;
    const excludeIds = Array.isArray(body?.exclude_ids)
      ? body.exclude_ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];

    if (!userText) {
      return new Response(JSON.stringify({ error: "missing_query" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } });
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    // --- Roteamento por intenção ---
    if (!forceMode && isNavigationRequest(userText)) {
      const routeAction = matchRouteAction(userText);
      if (routeAction) {
        await logAction(supabase, authenticatedUserId, "navigate", {
          query: userText,
          route: routeAction.payload,
        }, conversationId);

        return new Response(JSON.stringify({
          mode: "navigate",
          mensagem: `Posso te levar direto para ${routeAction.label.replace(/^Abrir\s+/i, "")}.`,
          actions: [routeAction],
          route_map: getRouteMap(),
          ids: [],
          count: 0,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!forceMode && !isPublishRequest(userText) && isDiagnosisRequest(userText)) {
      const [mlStatus, publications, recentErrors] = await Promise.all([
        getUserMlStatus(supabase, authenticatedUserId),
        getUserPublishedProducts(supabase, authenticatedUserId),
        getRecentErrors(supabase, authenticatedUserId, 5),
      ]);
      const actions: AtlasAction[] = [];

      if (!mlStatus.connected || !mlStatus.token_valid) {
        actions.push({
          type: "navigate",
          label: "Abrir integrações",
          path: "/dashboard/configuracoes",
          payload: { reason: "ml_disconnected" },
        });
      } else {
        actions.push({
          type: "navigate",
          label: "Ver publicações",
          path: "/dashboard/publicacoes",
          payload: { reason: "check_publications" },
        });
      }

      await logAction(supabase, authenticatedUserId, "diagnose", {
        query: userText,
        ml_status: mlStatus,
        publications_count: publications.length,
        recent_errors_count: recentErrors.length,
      }, conversationId);

      const statusText = mlStatus.connected && mlStatus.token_valid
        ? "Sua integração do Mercado Livre parece conectada e com token válido."
        : "Sua integração do Mercado Livre precisa de atenção antes de publicar com segurança.";

      return new Response(JSON.stringify({
        mode: "diagnose",
        mensagem: `${statusText} Encontrei ${publications.length} publicação recente na sua conta. O próximo passo mais seguro é revisar o ponto indicado abaixo.`,
        actions,
        ml_status: mlStatus,
        published_products: publications,
        recent_errors: recentErrors,
        ids: [],
        count: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!forceMode && isPublishRequest(userText) && currentProductId) {
      const product = await loadProductFull(supabase, currentProductId);
      if (product) {
        const mlStatus = await getUserMlStatus(supabase, authenticatedUserId);
        const publishFlow = startPublishFlow(product as CatalogProductFull, mlStatus);
        await logAction(supabase, authenticatedUserId, "publish_start", {
          query: userText,
          product_id: currentProductId,
          requirements: publishFlow.requirements,
          ready: publishFlow.ready,
        }, conversationId);

        const missingText = publishFlow.requirements.missing.length > 0
          ? `Antes disso, falta completar: ${publishFlow.requirements.missing.join(", ")}.`
          : "O cadastro parece pronto para iniciar o fluxo.";
        const mlText = mlStatus.connected && mlStatus.token_valid
          ? "O Mercado Livre está conectado."
          : "Primeiro conecte o Mercado Livre.";

        return new Response(JSON.stringify({
          mode: "publish_start",
          mensagem: `${mlText} ${missingText}`,
          actions: [publishFlow.action],
          product_actions: { [currentProductId]: publishFlow.action },
          publish_requirements: publishFlow.requirements,
          ids: [currentProductId],
          count: 1,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const intent: "search" | "chat" | "general" = forceMode === "search"
      ? "search"
      : forceMode === "chat" && currentProductId
      ? "chat"
      : apiKey
      ? await classifyIntent(apiKey, userText, history, Boolean(currentProductId))
      : (currentProductId ? "chat" : "general");

    // ================= MODO GENERAL (IA generalista sobre a Velo) =================
    if (intent === "general" && apiKey) {
      const [mlStatus, publications] = await Promise.all([
        getUserMlStatus(supabase, authenticatedUserId),
        getUserPublishedProducts(supabase, authenticatedUserId),
      ]);

      const mlLine = mlStatus.connected
        ? `Mercado Livre: conectado${mlStatus.token_valid ? " (token válido)" : " (token expirado, precisa reconectar)"}.`
        : "Mercado Livre: não conectado.";
      const pubLine = `Publicações recentes na conta: ${publications.length}.`;

      const sys = `Você é o Atlas, a IA oficial da Velo — plataforma brasileira de dropshipping com IA. Responda SEMPRE em português brasileiro, tom direto, humano e útil, sem enrolação. Use parágrafos curtos e listas quando ajudar. Nunca invente funcionalidades, preços, prazos ou integrações — se não souber, oriente o usuário a abrir um chamado em contato@velo.com.br ou na aba Suporte.${userContextLine(userContext)}

CONHECIMENTO DA VELO:
- Missão: ajudar iniciantes brasileiros a vender por dropshipping usando o catálogo Velo (produtos curados via scraping C7Drop de fornecedores nacionais) e publicando no Mercado Livre.
- Slogan: "Apenas venda."
- Catálogo (/dashboard/catalogo): busca por categoria/palavra-chave, filtros de margem, estoque e preço. Só mostra produtos com estoque > 0.
- Importar/Publicar: abrir o produto no catálogo → clicar em "Importar" → a IA gera título e descrição otimizados → revisa → publica no Mercado Livre via OAuth.
- Conectar Mercado Livre: /dashboard/configuracoes → aba Integrações → "Conectar Mercado Livre". Sem isso, não é possível publicar.
- Publicações (/dashboard/publicacoes): lista todos os anúncios com status sincronizado com o ML.
- Pedidos (/dashboard/pedidos): mostra vendas reais recebidas do ML com nome, endereço, telefone do comprador e link do fornecedor.
- Saldos/Transações (/dashboard/saldos, /dashboard/transacoes): faturamento real baseado nos pedidos.
- Suporte: /dashboard/configuracoes → aba Suporte, ou email contato@velo.com.br.
- Planos: Grátis (modo teste, sem publicar), Pro R$79,80/mês (30 produtos, 2 marketplaces, 3 agentes IA), Business R$159,60/mês (ilimitado). Assinatura em /checkout.
- Reembolso: janela de 7 dias, solicitação via Suporte; admins gerenciam em /admin/reembolsos.
- Fluxo recomendado para iniciante: 1) conectar Mercado Livre, 2) escolher produto no catálogo, 3) importar/publicar, 4) acompanhar pedidos em /dashboard/pedidos.

CAPACIDADES SUAS (Atlas):
- Você também pode buscar produtos: se o usuário pedir explicitamente "encontre/mostre/quero um produto de X", oriente que basta pedir direto e o próprio Atlas trará opções do catálogo.
- Você pode explicar telas, navegação, planos, integração ML, publicação, pedidos, reembolso, cobrança.

CONTEXTO ATUAL DO USUÁRIO:
- ${mlLine}
- ${pubLine}

Se a pergunta for ambígua, pergunte de volta com uma opção clara. Nunca peça senhas ou tokens. Nunca cite CJ Dropshipping — foi descontinuada.`;

      const messages = [
        { role: "system", content: sys },
        ...history.slice(-10).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
        { role: "user", content: userText },
      ];
      const raw = await callAI(apiKey, messages);
      const mensagem = (raw ?? "").trim() || "Não consegui processar agora, pode reformular a pergunta?";

      return new Response(JSON.stringify({
        mode: "chat",
        mensagem,
        resposta_chat: mensagem,
        ids: [],
        count: 0,
        used_fallback: false,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ================= MODO CHAT (discussão sobre produto atual) =================
    if (intent === "chat" && currentProductId && apiKey) {
      const prod = await loadProductFull(supabase, currentProductId);
      if (prod) {
        const sys = `Você é o Atlas, assistente pessoal de dropshipping BR da Velo. Responda em PT-BR, tom direto, útil, sem enrolação (3-6 frases).${userContextLine(userContext)}
Responsabilidades: orientar navegação no dashboard, diagnosticar problemas, ajudar no fluxo de publicação e descobrir produtos vendáveis.
Fonte de produtos: somente catálogo Velo via C7Drop. Nunca invente fornecedores, secrets, credenciais ou dados não disponíveis.
Você está analisando este produto para o usuário:
- Nome: ${prod.title}
- Categoria: ${prod.category}
- Preço sugerido: R$${Number(prod.suggested_price ?? 0).toFixed(2)}
- Custo: R$${Number(prod.cost_price ?? 0).toFixed(2)}
- Margem: ${Number(prod.margin_percent ?? 0).toFixed(0)}%
- Pedidos registrados: ${Number(prod.orders_count ?? 0)}
- Estoque: ${Number(prod.stock_quantity ?? 0)}
${prod.description ? `- Descrição: ${String(prod.description).slice(0, 500)}` : ""}

Ao responder, considere:
- Se serve para o nicho pretendido pelo usuário.
- Facilidade de venda (concorrência, apelo, preço).
- Facilidade de uso/entendimento pelo comprador final.
- Se vale sugerir alternativas melhores no catálogo (apenas mencione, sem inventar produtos).
Nunca invente dados que você não tem. Se o usuário fizer nova busca, apenas peça para reformular como pedido de produto.`;
        const messages = [
          { role: "system", content: sys },
          ...history.slice(-8).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
          { role: "user", content: userText },
        ];
        const raw = await callAI(apiKey, messages);
        const mensagem = (raw ?? "").trim() || "Posso te ajudar com mais alguma dúvida sobre esse produto?";

        return new Response(JSON.stringify({
          mode: "chat",
          mensagem,
          resposta_chat: mensagem,
          ids: [],
          count: 0,
          used_fallback: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }


    // ================= MODO SEARCH (busca produto novo) =================
    let filters: AtlasFilters | null = null;
    let usedFallback = false;

    if (apiKey) filters = await inferFilters(apiKey, userText, history, userContext);
    if (!filters) {
      usedFallback = true;
      filters = {
        ...DEFAULT_FILTERS,
        palavras_chave: extractFallbackKeywords(userText),
      };
    }

    filters.palavras_chave = filters.palavras_chave
      .map((word) => normalizeText(word).trim())
      .filter((word) => word.length > 2 && !STOPWORDS.has(word))
      .slice(0, 8);

    // Se o usuário pediu "mais barato / mais vendido / maior margem" sem citar produto,
    // trata como ordenação pura em vez de filtro por palavra.
    const sortOnly = detectSortOnlyOrder(userText);
    if (sortOnly && filters.palavras_chave.length === 0) {
      filters.ordenar_por = sortOnly;
    }

    if (filters.palavras_chave.length === 0 && !sortOnly) {
      filters.palavras_chave = extractFallbackKeywords(userText);
    }

    const protectedKeywords = extractProtectedKeywords(userText);
    if (protectedKeywords.length > 0) {
      filters.categoria = null;
      filters.palavras_chave = Array.from(new Set([...protectedKeywords, ...filters.palavras_chave])).slice(0, 10);
    }

    let q = supabase
      .from("catalog_products")
      .select("id, title, description, category, orders_count, margin_percent")
      .in("source", ALLOWED_SOURCES)
      .eq("is_blocked", false)
      .gt("stock_quantity", filters.estoque_minimo && filters.estoque_minimo > 0 ? filters.estoque_minimo - 1 : 0);

    if (excludeIds.length > 0) q = q.not("id", "in", `(${excludeIds.join(",")})`);

    if (filters.categoria) q = q.ilike("category", `%${filters.categoria}%`);

    if (filters.palavras_chave.length > 0) {
      const ors = filters.palavras_chave
        .map((kw) => {
          const safe = kw.replace(/[%,]/g, " ").trim();
          return `title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`;
        })
        .join(",");
      q = q.or(ors);
    }

    switch (filters.ordenar_por) {
      case "margem":
        q = q.order("margin_percent", { ascending: false, nullsFirst: false }); break;
      case "vendas":
        q = q.order("orders_count", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }); break;
      case "preco_asc":
        q = q.gt("cost_price", 0).order("cost_price", { ascending: true, nullsFirst: false }); break;
      case "preco_desc":
        q = q.order("cost_price", { ascending: false, nullsFirst: false }); break;
      default:
        q = q.order("orders_count", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    }

    q = q.limit(RESULT_LIMIT);
    let { data, error } = await q;

    if (error || !data || data.length === 0) {
      if (error) console.error("Primary query failed", error);
      const safe = userText.replace(/[%,]/g, " ").trim();
      let fbQ = supabase
        .from("catalog_products")
        .select("id, title, description, category, orders_count, margin_percent")
        .in("source", ALLOWED_SOURCES)
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        .not("id", "in", `(${excludeIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);

      // Se o pedido era só-ordenação, ignorar filtro textual e ordenar direto.
      if (sortOnly === "preco_asc") {
        fbQ = fbQ.gt("cost_price", 0).order("cost_price", { ascending: true, nullsFirst: false });
      } else if (sortOnly === "preco_desc") {
        fbQ = fbQ.order("cost_price", { ascending: false, nullsFirst: false });
      } else if (sortOnly === "margem") {
        fbQ = fbQ.order("margin_percent", { ascending: false, nullsFirst: false });
      } else if (sortOnly === "vendas") {
        fbQ = fbQ.order("orders_count", { ascending: false, nullsFirst: false });
      } else {
        fbQ = fbQ
          .or(`title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`)
          .order("orders_count", { ascending: false, nullsFirst: false });
      }

      const fb = await fbQ.limit(RESULT_LIMIT);
      data = fb.data ?? [];
      usedFallback = true;

      // Fallback final: nenhum filtro textual — devolve top produtos por ordenação pedida.
      if (!data || data.length === 0) {
        let lastQ = supabase
          .from("catalog_products")
          .select("id, title, description, category, orders_count, margin_percent")
          .in("source", ALLOWED_SOURCES)
          .eq("is_blocked", false)
          .gt("stock_quantity", 0);
        switch (filters.ordenar_por) {
          case "preco_asc":
            lastQ = lastQ.gt("cost_price", 0).order("cost_price", { ascending: true, nullsFirst: false }); break;
          case "preco_desc":
            lastQ = lastQ.order("cost_price", { ascending: false, nullsFirst: false }); break;
          case "margem":
            lastQ = lastQ.order("margin_percent", { ascending: false, nullsFirst: false }); break;
          default:
            lastQ = lastQ.order("orders_count", { ascending: false, nullsFirst: false });
        }
        const last = await lastQ.limit(RESULT_LIMIT);
        data = last.data ?? [];
      }
    }

    const rankedRows = orderResultsByRelevance((data ?? []) as SearchProductRow[], filters.palavras_chave);
    const ids = rankedRows.map((r) => r.id);
    let produto: Record<string, unknown> | null = null;
    let analise: Record<string, unknown> | null = null;
    const productActions: Record<string, AtlasAction> = {};
    let mensagem = filters.resposta_chat;

    if (ids.length > 0) {
      const topProd = await loadProductFull(supabase, ids[0]);
      if (topProd) {
        const imagem_url = firstImageOf(topProd.images);
        produto = {
          id: topProd.id,
          nome: topProd.title ?? "Produto",
          categoria: topProd.category ?? "Geral",
          preco: Number(topProd.suggested_price ?? topProd.cost_price ?? 0),
          imagem_url,
          catalogo_url: `/dashboard/catalogo/${topProd.id}`,
          fornecedor_url: topProd.product_url ?? "",
        };

        const mlStatus = await getUserMlStatus(supabase, authenticatedUserId);
        const publishFlow = startPublishFlow(topProd as CatalogProductFull, mlStatus);
        productActions[topProd.id] = publishFlow.action;

        const marginPct = Number(topProd.margin_percent ?? 0);
        const orders = Number(topProd.orders_count ?? 0);

        // Média categoria p/ margem
        let avgMargin: number | null = null;
        if (topProd.category) {
          const { data: catAvg } = await supabase
            .from("catalog_products").select("margin_percent")
            .eq("category", topProd.category).eq("is_blocked", false)
            .gt("stock_quantity", 0).not("margin_percent", "is", null).limit(200);
          if (catAvg && catAvg.length > 0) {
            const nums = catAvg.map((r: { margin_percent: number | null }) => Number(r.margin_percent))
              .filter((n) => Number.isFinite(n));
            if (nums.length) avgMargin = nums.reduce((a, b) => a + b, 0) / nums.length;
          }
        }

        let margemTxt = marginPct > 0 ? `Margem de ${marginPct.toFixed(0)}%.` : "Margem indefinida.";
        if (avgMargin !== null) {
          if (marginPct >= avgMargin * 1.15) margemTxt = `Margem ${marginPct.toFixed(0)}% — acima da média (${avgMargin.toFixed(0)}%).`;
          else if (marginPct <= avgMargin * 0.85) margemTxt = `Margem ${marginPct.toFixed(0)}% — abaixo da média (${avgMargin.toFixed(0)}%).`;
          else margemTxt = `Margem ${marginPct.toFixed(0)}% — em linha com a média (${avgMargin.toFixed(0)}%).`;
        }
        let demandaTxt = "Demanda ainda incerta.";
        if (orders >= 500) demandaTxt = `Alta procura: ${orders} pedidos.`;
        else if (orders >= 100) demandaTxt = `Procura média: ${orders} pedidos.`;
        else if (orders > 0) demandaTxt = `Procura baixa: ${orders} pedidos.`;

        let viralTxt = "Potencial de conteúdo depende de bom vídeo demonstrativo.";
        let facilidadeTxt = "Concorrência moderada; preço acessível ajuda no giro.";
        let recomendacao: "bom" | "mediano" | "ruim" = "mediano";

        if (apiKey) {
          const raw = await callAI(apiKey, [
            { role: "system", content: "Avalie produto dropshipping BR. Responda APENAS JSON: {\"potencial_viral\":string,\"facilidade_venda\":string,\"recomendacao\":\"bom\"|\"mediano\"|\"ruim\"}." },
            { role: "user", content: `Produto: ${topProd.title}\nCategoria: ${topProd.category}\nPreço R$${Number(topProd.suggested_price ?? 0).toFixed(2)}\nMargem ${marginPct.toFixed(0)}%\nPedidos ${orders}` },
          ]);
          if (raw) {
            const parsed = extractJsonObject(raw);
            if (parsed) {
              if (typeof parsed.potencial_viral === "string") viralTxt = parsed.potencial_viral;
              if (typeof parsed.facilidade_venda === "string") facilidadeTxt = parsed.facilidade_venda;
              if (parsed.recomendacao === "bom" || parsed.recomendacao === "mediano" || parsed.recomendacao === "ruim") {
                recomendacao = parsed.recomendacao;
              }
            }
          }
        } else {
          const s = (avgMargin !== null ? (marginPct >= avgMargin ? 1 : 0) : (marginPct >= 40 ? 1 : 0))
            + (orders >= 300 ? 1 : orders >= 50 ? 0.5 : 0);
          recomendacao = s >= 1.5 ? "bom" : s >= 0.5 ? "mediano" : "ruim";
        }

        analise = { margem: margemTxt, demanda: demandaTxt, potencial_viral: viralTxt, facilidade_venda: facilidadeTxt, recomendacao };
        const veredito = recomendacao === "bom" ? "Vale a pena testar."
          : recomendacao === "mediano" ? "Vale com ressalvas — teste com verba controlada."
          : "Não recomendado no momento.";
        mensagem = `${filters.resposta_chat} ${margemTxt} ${demandaTxt} ${viralTxt} ${facilidadeTxt} ${veredito}`;

        await logAction(supabase, authenticatedUserId, "product_search", {
          query: userText,
          product_id: topProd.id,
          ids,
          filters,
          publish_requirements: publishFlow.requirements,
        }, conversationId);
      }
    } else {
      mensagem = "Não encontrei produtos que atendam a esse pedido no catálogo. Quer tentar palavras diferentes?";
    }

    return new Response(JSON.stringify({
      mode: "search",
      mensagem, produto, analise,
      product_actions: productActions,
      ids, count: ids.length, filters,
      resposta_chat: mensagem, used_fallback: usedFallback,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("atlas-search error", err);
    return new Response(JSON.stringify({ error: "internal_error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
