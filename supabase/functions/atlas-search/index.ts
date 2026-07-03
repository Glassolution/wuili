// Atlas Search — interpreta texto livre via Lovable AI (Gemini) e busca
// produtos reais em catalog_products com suporte a contexto incremental.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_SOURCES = ["c7drop"];
const RESULT_LIMIT = 24;

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

function extractJson(raw: string): AtlasFilters {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return { ...DEFAULT_FILTERS };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return { ...DEFAULT_FILTERS };
    }
  }

  const obj = (parsed ?? {}) as Record<string, unknown>;
  const ordenar = typeof obj.ordenar_por === "string" ? obj.ordenar_por : null;
  const validOrdenar: AtlasFilters["ordenar_por"] =
    ordenar === "margem" || ordenar === "vendas" ||
    ordenar === "preco_asc" || ordenar === "preco_desc"
      ? ordenar
      : null;

  const keywords = Array.isArray(obj.palavras_chave)
    ? obj.palavras_chave
        .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
        .map((k) => k.trim())
        .slice(0, 8)
    : [];

  const responseText = typeof obj.resposta_chat === "string" && obj.resposta_chat.trim().length > 0
    ? obj.resposta_chat.trim()
    : "Encontrei este produto no catálogo para você:";

  return {
    categoria:
      typeof obj.categoria === "string" && obj.categoria.trim().length > 0
        ? obj.categoria.trim()
        : null,
    palavras_chave: keywords,
    ordenar_por: validOrdenar,
    estoque_minimo:
      typeof obj.estoque_minimo === "number" && obj.estoque_minimo > 0
        ? Math.floor(obj.estoque_minimo)
        : null,
    resposta_chat: responseText,
  };
}

async function inferFiltersWithAI(
  userText: string,
  history: Array<{ role: string; content: string }>,
  apiKey: string,
): Promise<AtlasFilters | null> {
  const systemPrompt =
    `Você é o cérebro de busca do Atlas, o assistente inteligente do catálogo de dropshipping da Velo (português brasileiro).
Sua tarefa é analisar a conversa entre o usuário e o assistente, e retornar as configurações de busca/filtros adequadas para a última mensagem do usuário, considerando as mensagens anteriores como contexto para refinamento incremental (ex: se o usuário pede "fones" e depois diz "os mais baratos", você deve manter a busca de fone e definir ordenar_por="preco_asc").

Responda APENAS com um JSON válido (sem markdown, sem comentários) no formato:
{
  "categoria": string|null,
  "palavras_chave": string[],
  "ordenar_por": "margem"|"vendas"|"preco_asc"|"preco_desc"|null,
  "estoque_minimo": number|null,
  "resposta_chat": string
}

Regras para os campos:
- "categoria": categoria principal identificada (ex: "casa", "eletrônicos", "esporte"), ou null.
- "palavras_chave": 1 a 6 termos de busca textual relevantes no título/descrição do produto. Refine com base nas preferências anteriores se o usuário estiver continuando a conversa. Se ele mudar de assunto totalmente (ex: "agora quero garrafas"), descarte as palavras-chave antigas.
- "ordenar_por": "margem" para lucro/margem; "vendas" para popularidade/viralizar; "preco_asc" para barato/menor preço; "preco_desc" para caro/premium; null caso contrário.
- "estoque_minimo": número se o usuário pedir estoque alto; null caso contrário.
- "resposta_chat": uma frase de resposta muito curta, profissional e amigável (máximo 150 caracteres) introduzindo a recomendação de forma contextualizada à busca (ex: "Encontrei este fone bluetooth com excelente margem:", "Aqui está o modelo mais barato disponível:").

Responda SOMENTE o JSON.`;

  const messages = [
    { role: "system", content: systemPrompt },
  ];

  // Adiciona histórico tratado
  if (Array.isArray(history)) {
    for (const msg of history) {
      if (msg && typeof msg.content === "string") {
        const role = msg.role === "user" ? "user" : "assistant";
        messages.push({ role, content: msg.content });
      }
    }
  }

  // Adiciona a mensagem atual
  messages.push({ role: "user", content: userText });

  try {
    const resp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: messages,
        }),
      },
    );

    if (!resp.ok) {
      console.error("Lovable AI gateway error", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return extractJson(content);
  } catch (err) {
    console.error("AI inference failed", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, history } = await req.json().catch(() => ({ query: "", history: [] }));
    const userText = typeof query === "string" ? query.trim() : "";

    if (!userText) {
      return new Response(
        JSON.stringify({ error: "missing_query" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    let filters: AtlasFilters | null = null;
    let usedFallback = false;

    if (apiKey) {
      filters = await inferFiltersWithAI(userText, history, apiKey);
    }
    if (!filters) {
      usedFallback = true;
      filters = {
        ...DEFAULT_FILTERS,
        palavras_chave: userText.split(/\s+/).filter((w) => w.length > 2).slice(0, 4),
      };
    }

    // Monta query
    let q = supabase
      .from("catalog_products")
      .select("id")
      .in("source", ALLOWED_SOURCES)
      .eq("is_blocked", false)
      .gt("stock_quantity", filters.estoque_minimo && filters.estoque_minimo > 0 ? filters.estoque_minimo - 1 : 0);

    // Categoria
    if (filters.categoria) {
      q = q.ilike("category", `%${filters.categoria}%`);
    }

    // Palavras-chave
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
        q = q.order("margin_percent", { ascending: false, nullsFirst: false });
        break;
      case "vendas":
        q = q
          .order("orders_count", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });
        break;
      case "preco_asc":
        q = q.gt("cost_price", 0).order("cost_price", { ascending: true, nullsFirst: false });
        break;
      case "preco_desc":
        q = q.order("cost_price", { ascending: false, nullsFirst: false });
        break;
      default:
        q = q
          .order("orders_count", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });
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

    // --------- Enriquecimento: análise do produto principal ---------
    let produto: Record<string, unknown> | null = null;
    let analise: Record<string, unknown> | null = null;
    let mensagem = filters.resposta_chat;

    if (ids.length > 0) {
      const topId = ids[0];
      const { data: topProd } = await supabase
        .from("catalog_products")
        .select(
          "id, title, category, cost_price, suggested_price, margin_percent, orders_count, images, product_url",
        )
        .eq("id", topId)
        .maybeSingle();

      if (topProd) {
        const imgs = Array.isArray(topProd.images)
          ? (topProd.images as unknown[])
          : typeof topProd.images === "string"
          ? (() => { try { return JSON.parse(topProd.images as string); } catch { return []; } })()
          : [];
        const imagem_url = Array.isArray(imgs) && imgs.length > 0 ? String(imgs[0]) : "";

        produto = {
          id: topProd.id,
          nome: topProd.title ?? "Produto",
          categoria: topProd.category ?? "Geral",
          preco: Number(topProd.suggested_price ?? topProd.cost_price ?? 0),
          imagem_url,
          catalogo_url: `/dashboard/catalogo/${topProd.id}`,
          fornecedor_url: topProd.product_url ?? "",
        };

        // Média da categoria para comparar margem
        let avgMargin: number | null = null;
        if (topProd.category) {
          const { data: catAvg } = await supabase
            .from("catalog_products")
            .select("margin_percent")
            .eq("category", topProd.category)
            .eq("is_blocked", false)
            .gt("stock_quantity", 0)
            .not("margin_percent", "is", null)
            .limit(200);
          if (catAvg && catAvg.length > 0) {
            const nums = catAvg
              .map((r: { margin_percent: number | null }) => Number(r.margin_percent))
              .filter((n) => Number.isFinite(n));
            if (nums.length) avgMargin = nums.reduce((a, b) => a + b, 0) / nums.length;
          }
        }

        const marginPct = Number(topProd.margin_percent ?? 0);
        const orders = Number(topProd.orders_count ?? 0);

        let margemTxt = "Margem em linha com a média da categoria.";
        if (avgMargin !== null) {
          if (marginPct >= avgMargin * 1.15) margemTxt = `Margem de ${marginPct.toFixed(0)}% — acima da média da categoria (${avgMargin.toFixed(0)}%).`;
          else if (marginPct <= avgMargin * 0.85) margemTxt = `Margem de ${marginPct.toFixed(0)}% — abaixo da média da categoria (${avgMargin.toFixed(0)}%).`;
          else margemTxt = `Margem de ${marginPct.toFixed(0)}% — em linha com a média da categoria (${avgMargin.toFixed(0)}%).`;
        } else if (marginPct > 0) {
          margemTxt = `Margem de ${marginPct.toFixed(0)}%.`;
        }

        let demandaTxt = "Demanda ainda incerta — poucos dados de vendas.";
        if (orders >= 500) demandaTxt = `Alta procura: ${orders} pedidos registrados na fonte.`;
        else if (orders >= 100) demandaTxt = `Procura média: ${orders} pedidos registrados.`;
        else if (orders > 0) demandaTxt = `Procura baixa: apenas ${orders} pedidos registrados.`;

        // Potencial viral + facilidade de venda via IA (curto, JSON)
        let viralTxt = "Potencial de conteúdo depende de bom vídeo demonstrativo.";
        let facilidadeTxt = "Concorrência moderada; preço acessível ajuda no giro.";
        let recomendacao: "bom" | "mediano" | "ruim" = "mediano";

        if (apiKey) {
          try {
            const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  {
                    role: "system",
                    content:
                      "Você avalia produtos de dropshipping BR. Responda APENAS JSON válido com as chaves potencial_viral (string curta), facilidade_venda (string curta), recomendacao ('bom'|'mediano'|'ruim').",
                  },
                  {
                    role: "user",
                    content: `Produto: ${topProd.title}\nCategoria: ${topProd.category}\nPreço sugerido: R$${Number(topProd.suggested_price ?? 0).toFixed(2)}\nMargem: ${marginPct.toFixed(0)}%\nPedidos: ${orders}\nAvalie potencial em vídeos curtos (TikTok/Reels) e facilidade de venda.`,
                  },
                ],
              }),
            });
            if (aiResp.ok) {
              const j = await aiResp.json();
              const raw = String(j?.choices?.[0]?.message?.content ?? "");
              const m = raw.match(/\{[\s\S]*\}/);
              if (m) {
                const parsed = JSON.parse(m[0]);
                if (typeof parsed.potencial_viral === "string") viralTxt = parsed.potencial_viral;
                if (typeof parsed.facilidade_venda === "string") facilidadeTxt = parsed.facilidade_venda;
                if (parsed.recomendacao === "bom" || parsed.recomendacao === "mediano" || parsed.recomendacao === "ruim") {
                  recomendacao = parsed.recomendacao;
                }
              }
            }
          } catch (e) {
            console.error("analise IA falhou", e);
          }
        }

        // Heurística de fallback para recomendação
        if (!apiKey) {
          const scoreMargin = avgMargin !== null ? (marginPct >= avgMargin ? 1 : 0) : (marginPct >= 40 ? 1 : 0);
          const scoreOrders = orders >= 300 ? 1 : orders >= 50 ? 0.5 : 0;
          const score = scoreMargin + scoreOrders;
          recomendacao = score >= 1.5 ? "bom" : score >= 0.5 ? "mediano" : "ruim";
        }

        analise = {
          margem: margemTxt,
          demanda: demandaTxt,
          potencial_viral: viralTxt,
          facilidade_venda: facilidadeTxt,
          recomendacao,
        };

        const veredito = recomendacao === "bom"
          ? "Vale a pena testar."
          : recomendacao === "mediano"
          ? "Vale com ressalvas — teste com verba controlada."
          : "Não recomendado no momento.";
        mensagem = `${filters.resposta_chat} ${margemTxt} ${demandaTxt} ${viralTxt} ${facilidadeTxt} ${veredito}`;
      }
    }

    return new Response(
      JSON.stringify({
        // contrato novo
        mensagem,
        produto,
        analise,
        // contrato legado (mantido p/ compatibilidade com o frontend atual)
        ids,
        count: ids.length,
        filters,
        resposta_chat: mensagem,
        used_fallback: usedFallback,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("atlas-search error", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
