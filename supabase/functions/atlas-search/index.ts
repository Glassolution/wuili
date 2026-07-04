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

// Classifica turno: nova busca vs continuar conversa sobre produto atual.
async function classifyIntent(
  apiKey: string,
  userText: string,
  history: ChatHistoryItem[],
  hasCurrentProduct: boolean,
): Promise<"search" | "chat"> {
  if (!hasCurrentProduct) return "search";

  const sys = `Você classifica intenção do usuário no assistente Aquas (dropshipping BR).
Responda APENAS JSON: {"intencao":"search"|"chat"}.
- "search": usuário quer NOVOS produtos (ex: "me mostre fones", "encontre algo mais barato", "outros produtos", "algo de cozinha", "trocar produto").
- "chat": usuário quer discutir/analisar o produto atualmente mostrado (ex: "esse é bom pro meu nicho?", "é fácil de vender?", "e a concorrência?", "explica melhor", "vale a pena?", "como divulgar?").`;
  const messages = [
    { role: "system", content: sys },
    ...history.slice(-6).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
    { role: "user", content: userText },
  ];
  const raw = await callAI(apiKey, messages);
  if (!raw) return "search";
  const parsed = extractJsonObject(raw);
  return parsed?.intencao === "chat" ? "chat" : "search";
}

async function inferFilters(
  apiKey: string,
  userText: string,
  history: ChatHistoryItem[],
): Promise<AtlasFilters | null> {
  const systemPrompt = `Você é o cérebro de busca do Aquas (catálogo Velo, PT-BR).
Analise a conversa e retorne filtros para a última mensagem do usuário, considerando o contexto anterior para refinamento incremental.

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const userText = typeof body?.query === "string" ? body.query.trim() : "";
    const history: ChatHistoryItem[] = Array.isArray(body?.history) ? body.history : [];
    const currentProductId: string | null = typeof body?.current_product_id === "string" ? body.current_product_id : null;

    if (!userText) {
      return new Response(JSON.stringify({ error: "missing_query" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } });
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    // --- Roteamento por intenção ---
    const intent = apiKey
      ? await classifyIntent(apiKey, userText, history, Boolean(currentProductId))
      : "search";

    // ================= MODO CHAT (discussão sobre produto atual) =================
    if (intent === "chat" && currentProductId && apiKey) {
      const prod = await loadProductFull(supabase, currentProductId);
      if (prod) {
        const sys = `Você é o Aquas, assistente de dropshipping BR da Velo. Responda em PT-BR, tom direto, útil, sem enrolação (3-6 frases).
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

    if (apiKey) filters = await inferFilters(apiKey, userText, history);
    if (!filters) {
      usedFallback = true;
      filters = {
        ...DEFAULT_FILTERS,
        palavras_chave: userText.split(/\s+/).filter((w) => w.length > 2).slice(0, 4),
      };
    }

    let q = supabase
      .from("catalog_products")
      .select("id")
      .in("source", ALLOWED_SOURCES)
      .eq("is_blocked", false)
      .gt("stock_quantity", filters.estoque_minimo && filters.estoque_minimo > 0 ? filters.estoque_minimo - 1 : 0);

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
      const fb = await supabase
        .from("catalog_products")
        .select("id")
        .in("source", ALLOWED_SOURCES)
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        .or(`title.ilike.%${safe}%,category.ilike.%${safe}%`)
        .order("orders_count", { ascending: false, nullsFirst: false })
        .limit(RESULT_LIMIT);
      data = fb.data ?? [];
      usedFallback = true;
    }

    const ids = (data ?? []).map((r) => r.id as string);
    let produto: Record<string, unknown> | null = null;
    let analise: Record<string, unknown> | null = null;
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
      }
    } else {
      mensagem = "Não encontrei produtos que atendam a esse pedido no catálogo. Quer tentar palavras diferentes?";
    }

    return new Response(JSON.stringify({
      mode: "search",
      mensagem, produto, analise,
      ids, count: ids.length, filters,
      resposta_chat: mensagem, used_fallback: usedFallback,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("atlas-search error", err);
    return new Response(JSON.stringify({ error: "internal_error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
